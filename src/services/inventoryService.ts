import {
  IMaterialRepository,
  IRequirementRepository,
  IReservationRepository,
  IMovementRepository,
  IProductionJobRepository,
  IProductionEventRepository,
} from '../types/repository';
import {
  InventoryMaterial,
  ProductionMaterialRequirement,
  StockReservation,
  StockMovement,
  MaterialUnit,
} from '../types/inventory';
import { MaterialGate, DataOrigin } from '../types/domain';
import { isValidQuantityMilli, isValidNonNegativeQuantityMilli } from '../domain/quantity';
import { isValidNonNegativeCents, computeWeightedAverageCostCents } from '../domain/money';

export class StockIntegrityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StockIntegrityError';
  }
}

export interface CreateMaterialInput {
  sku: string;
  name: string;
  category: string;
  unit: MaterialUnit;
  initialStockMilli?: number;
  minimumStockMilli: number;
  unitCostCents?: number;
  supplierName?: string;
  dataOrigin?: DataOrigin;
  userId: string;
  userName: string;
}

export interface UpdateMaterialInput {
  sku?: string;
  name?: string;
  category?: string;
  unit?: MaterialUnit;
  minimumStockMilli?: number;
  supplierName?: string;
  isActive?: boolean;
}

export interface RecordReceiptInput {
  materialId: string;
  quantityMilli: number;
  unitCostCents?: number;
  totalCostCents?: number;
  supplierName?: string;
  reason?: string;
  userId: string;
  userName: string;
  dataOrigin?: DataOrigin;
}

export interface AdjustStockInput {
  materialId: string;
  type: 'POSITIVE_ADJUSTMENT' | 'NEGATIVE_ADJUSTMENT' | 'RETURN';
  quantityMilli: number;
  reason: string;
  userId: string;
  userName: string;
  dataOrigin?: DataOrigin;
}

export interface AddRequirementInput {
  productionJobId: string;
  materialId: string;
  requiredQuantityMilli: number;
  dataOrigin?: DataOrigin;
  userId: string;
  userName: string;
}

export interface ReserveRequirementInput {
  requirementId: string;
  quantityMilli: number;
  userId: string;
  userName: string;
}

export class InventoryService {
  constructor(
    private materialRepo: IMaterialRepository,
    private requirementRepo: IRequirementRepository,
    private reservationRepo: IReservationRepository,
    private movementRepo: IMovementRepository,
    private jobRepo: IProductionJobRepository,
    private eventRepo: IProductionEventRepository
  ) {}

  /**
   * Calcula a disponibilidade estrita de um material sem usar Math.max para mascarar inconsistências.
   * availableQuantityMilli = stockOnHandMilli - soma das reservas ACTIVE
   * Se o saldo disponível for negativo, lança StockIntegrityError.
   */
  async getMaterialAvailability(
    organizationId: string,
    materialId: string
  ): Promise<{ stockOnHandMilli: number; reservedMilli: number; availableMilli: number }> {
    const material = await this.materialRepo.getById(organizationId, materialId);
    if (!material) {
      return { stockOnHandMilli: 0, reservedMilli: 0, availableMilli: 0 };
    }

    const reservations = await this.reservationRepo.listByMaterialId(organizationId, materialId);
    const activeReserved = reservations
      .filter((r) => r.status === 'ACTIVE')
      .reduce((sum, r) => sum + r.reservedQuantityMilli, 0);

    const availableMilli = material.stockOnHandMilli - activeReserved;

    if (availableMilli < 0) {
      throw new StockIntegrityError(
        `Inconsistência de integridade no estoque do material "${material.sku}": total reservado ativo (${activeReserved / 1000}) excede o saldo físico (${material.stockOnHandMilli / 1000}).`
      );
    }

    return {
      stockOnHandMilli: material.stockOnHandMilli,
      reservedMilli: activeReserved,
      availableMilli,
    };
  }

  /**
   * Cadastro de novo material com validação de SKU único por organização e inteiros seguros
   */
  async createMaterial(
    organizationId: string,
    input: CreateMaterialInput
  ): Promise<{ material: InventoryMaterial; movement?: StockMovement }> {
    const normalizedSku = input.sku.trim().toUpperCase();
    if (!normalizedSku) {
      throw new Error('O SKU do material é obrigatório.');
    }

    const existing = await this.materialRepo.getBySku(organizationId, normalizedSku);
    if (existing) {
      throw new Error(`SKU "${normalizedSku}" já cadastrado nesta organização.`);
    }

    if (!input.name.trim()) {
      throw new Error('O nome do material é obrigatório.');
    }

    const initialStock = input.initialStockMilli ?? 0;
    if (!isValidNonNegativeQuantityMilli(initialStock)) {
      throw new Error('O estoque inicial deve ser um número inteiro seguro não-negativo em milésimos.');
    }

    const minStock = input.minimumStockMilli ?? 0;
    if (!isValidNonNegativeQuantityMilli(minStock)) {
      throw new Error('O estoque mínimo deve ser um número inteiro seguro não-negativo em milésimos.');
    }

    const avgCost = input.unitCostCents ?? 0;
    if (!isValidNonNegativeCents(avgCost)) {
      throw new Error('O custo unitário deve ser um valor monetário seguro não-negativo em centavos.');
    }

    const now = new Date().toISOString();
    const materialId = `mat-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    const material: InventoryMaterial = {
      id: materialId,
      organizationId,
      sku: normalizedSku,
      name: input.name.trim(),
      category: input.category.trim() || 'Outros Insumos',
      unit: input.unit,
      stockOnHandMilli: initialStock,
      minimumStockMilli: minStock,
      averageCostCents: avgCost,
      supplierName: input.supplierName?.trim() || undefined,
      isActive: true,
      dataOrigin: input.dataOrigin || 'user',
      createdAt: now,
      updatedAt: now,
    };

    await this.materialRepo.save(organizationId, material);

    let movement: StockMovement | undefined;
    if (initialStock > 0) {
      movement = {
        id: `mov-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        organizationId,
        materialId,
        type: 'POSITIVE_ADJUSTMENT',
        quantityMilli: initialStock,
        previousBalanceMilli: 0,
        resultingBalanceMilli: initialStock,
        unitCostCents: avgCost > 0 ? avgCost : undefined,
        totalCostCents: avgCost > 0 ? Math.round((initialStock / 1000) * avgCost) : undefined,
        reason: 'Saldo inicial de cadastro de material',
        createdAt: now,
        userId: input.userId,
        userName: input.userName,
        dataOrigin: input.dataOrigin || 'user',
      };
      await this.movementRepo.append(organizationId, movement);
    }

    return { material, movement };
  }

  /**
   * Atualização de dados cadastrais de material
   */
  async updateMaterial(
    organizationId: string,
    materialId: string,
    input: UpdateMaterialInput
  ): Promise<InventoryMaterial> {
    const material = await this.materialRepo.getById(organizationId, materialId);
    if (!material) {
      throw new Error('Material não encontrado.');
    }

    if (input.sku !== undefined) {
      const normalizedSku = input.sku.trim().toUpperCase();
      if (!normalizedSku) {
        throw new Error('O SKU do material não pode ser vazio.');
      }
      if (normalizedSku !== material.sku) {
        const existing = await this.materialRepo.getBySku(organizationId, normalizedSku);
        if (existing && existing.id !== materialId) {
          throw new Error(`SKU "${normalizedSku}" já cadastrado para outro material.`);
        }
        material.sku = normalizedSku;
      }
    }

    if (input.name !== undefined) {
      if (!input.name.trim()) throw new Error('O nome do material não pode ser vazio.');
      material.name = input.name.trim();
    }
    if (input.category !== undefined) material.category = input.category.trim();
    if (input.unit !== undefined) material.unit = input.unit;
    if (input.minimumStockMilli !== undefined) {
      if (!isValidNonNegativeQuantityMilli(input.minimumStockMilli)) {
        throw new Error('Estoque mínimo deve ser um número inteiro seguro não-negativo.');
      }
      material.minimumStockMilli = input.minimumStockMilli;
    }
    if (input.supplierName !== undefined) material.supplierName = input.supplierName.trim() || undefined;
    if (input.isActive !== undefined) material.isActive = input.isActive;

    material.updatedAt = new Date().toISOString();
    await this.materialRepo.save(organizationId, material);
    return material;
  }

  /**
   * Registro de entrada com cálculo determinístico de custo médio ponderado arredondado com Math.round.
   * Permite entrada mesmo em cenário de corrupção pré-existente para fins de regularização.
   * Novo Custo Médio = Math.round(((EstoqueAtual * CustoAtual) + (QtdEntrada * CustoEntrada)) / (NovoEstoque))
   */
  async recordReceipt(
    organizationId: string,
    input: RecordReceiptInput
  ): Promise<{ material: InventoryMaterial; movement: StockMovement }> {
    if (!isValidQuantityMilli(input.quantityMilli)) {
      throw new Error('A quantidade de entrada deve ser um número inteiro positivo seguro em milésimos.');
    }

    const material = await this.materialRepo.getById(organizationId, input.materialId);
    if (!material) {
      throw new Error('Material não encontrado.');
    }

    const previousBalance = material.stockOnHandMilli;
    const incomingQty = input.quantityMilli;
    const newStock = previousBalance + incomingQty;

    if (!Number.isSafeInteger(newStock) || newStock > Number.MAX_SAFE_INTEGER) {
      throw new Error('O saldo físico resultante excede o limite numérico seguro permitido.');
    }

    // Recálculo do custo médio ponderado determinístico
    if (input.unitCostCents !== undefined && isValidNonNegativeCents(input.unitCostCents)) {
      material.averageCostCents = computeWeightedAverageCostCents(
        previousBalance,
        material.averageCostCents,
        incomingQty,
        input.unitCostCents,
        input.totalCostCents
      );
    }

    material.stockOnHandMilli = newStock;
    if (input.supplierName?.trim()) {
      material.supplierName = input.supplierName.trim();
    }
    const now = new Date().toISOString();
    material.updatedAt = now;
    await this.materialRepo.save(organizationId, material);

    const movement: StockMovement = {
      id: `mov-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      organizationId,
      materialId: material.id,
      type: 'RECEIPT',
      quantityMilli: incomingQty,
      previousBalanceMilli: previousBalance,
      resultingBalanceMilli: newStock,
      unitCostCents: input.unitCostCents,
      totalCostCents: input.totalCostCents,
      reason: input.reason?.trim() || 'Entrada de mercadoria',
      createdAt: now,
      userId: input.userId,
      userName: input.userName,
      dataOrigin: input.dataOrigin || 'user',
    };

    await this.movementRepo.append(organizationId, movement);

    // Recalcula gates de OPs afetadas por esta entrada
    await this.recalculateJobsForMaterial(organizationId, material.id);

    return { material, movement };
  }

  /**
   * Ajuste de estoque (Positivo, Negativo ou Devolução)
   * NEGATIVE_ADJUSTMENT é estritamente bloqueado quando: resultingBalanceMilli < activeReservedMilli
   */
  async adjustStock(
    organizationId: string,
    input: AdjustStockInput
  ): Promise<{ material: InventoryMaterial; movement: StockMovement }> {
    if (!isValidQuantityMilli(input.quantityMilli)) {
      throw new Error('A quantidade de ajuste deve ser um número inteiro positivo seguro em milésimos.');
    }
    if (!input.reason?.trim()) {
      throw new Error('A justificativa do ajuste é obrigatória.');
    }

    const material = await this.materialRepo.getById(organizationId, input.materialId);
    if (!material) {
      throw new Error('Material não encontrado.');
    }

    const previousBalance = material.stockOnHandMilli;
    let newStock = previousBalance;

    if (input.type === 'POSITIVE_ADJUSTMENT' || input.type === 'RETURN') {
      newStock = previousBalance + input.quantityMilli;
      if (!Number.isSafeInteger(newStock) || newStock > Number.MAX_SAFE_INTEGER) {
        throw new Error('O saldo resultante excede o limite numérico seguro.');
      }
    } else if (input.type === 'NEGATIVE_ADJUSTMENT') {
      const reservations = await this.reservationRepo.listByMaterialId(organizationId, input.materialId);
      const activeReserved = reservations
        .filter((r) => r.status === 'ACTIVE')
        .reduce((sum, r) => sum + r.reservedQuantityMilli, 0);

      // Invariante: não permite ajuste negativo se já houver corrupção com reservas acima do físico
      if (previousBalance < activeReserved) {
        throw new StockIntegrityError(
          `Inconsistência de integridade: reservas ativas (${activeReserved / 1000}) excedem o saldo físico (${previousBalance / 1000}). Ajuste negativo bloqueado até regularização do estoque.`
        );
      }

      const resultingBalance = previousBalance - input.quantityMilli;

      if (resultingBalance < 0) {
        throw new Error(
          `Ajuste negativo de ${input.quantityMilli / 1000} excede o saldo físico atual de ${previousBalance / 1000}.`
        );
      }

      // Invariante 2: resultingBalanceMilli não pode ser menor que activeReservedMilli
      if (resultingBalance < activeReserved) {
        throw new Error(
          `Ajuste negativo de ${input.quantityMilli / 1000} deixaria o saldo físico (${resultingBalance / 1000}) abaixo do total reservado ativo (${activeReserved / 1000}).`
        );
      }

      newStock = resultingBalance;
    }

    material.stockOnHandMilli = newStock;
    const now = new Date().toISOString();
    material.updatedAt = now;
    await this.materialRepo.save(organizationId, material);

    const movement: StockMovement = {
      id: `mov-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      organizationId,
      materialId: material.id,
      type: input.type,
      quantityMilli: input.quantityMilli,
      previousBalanceMilli: previousBalance,
      resultingBalanceMilli: newStock,
      reason: input.reason.trim(),
      createdAt: now,
      userId: input.userId,
      userName: input.userName,
      dataOrigin: input.dataOrigin || 'user',
    };

    await this.movementRepo.append(organizationId, movement);

    // Recalcula gates de OPs afetadas
    await this.recalculateJobsForMaterial(organizationId, material.id);

    return { material, movement };
  }

  /**
   * Adiciona um requisito de material a uma OP
   */
  async addRequirement(
    organizationId: string,
    input: AddRequirementInput
  ): Promise<ProductionMaterialRequirement> {
    if (!isValidQuantityMilli(input.requiredQuantityMilli)) {
      throw new Error('A quantidade necessária deve ser um número inteiro positivo seguro em milésimos.');
    }

    const job = await this.jobRepo.getById(organizationId, input.productionJobId);
    if (!job) {
      throw new Error('Ordem de Produção não encontrada.');
    }

    const material = await this.materialRepo.getById(organizationId, input.materialId);
    if (!material) {
      throw new Error('Material não encontrado no estoque.');
    }

    const now = new Date().toISOString();
    const req: ProductionMaterialRequirement = {
      id: `req-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      organizationId,
      productionJobId: job.id,
      materialId: material.id,
      materialSnapshot: {
        sku: material.sku,
        name: material.name,
        unit: material.unit,
        averageCostCents: material.averageCostCents,
      },
      requiredQuantityMilli: input.requiredQuantityMilli,
      createdAt: now,
      dataOrigin: input.dataOrigin || 'user',
    };

    await this.requirementRepo.save(organizationId, req);

    // Registra evento no histórico da OP
    await this.eventRepo.append(organizationId, {
      id: `evt-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      jobId: job.id,
      organizationId,
      eventType: 'REQUIREMENT_ADDED',
      description: `Requisito adicionado: ${material.name} (${input.requiredQuantityMilli / 1000} ${material.unit})`,
      authorId: input.userId,
      authorName: input.userName,
      timestamp: now,
    });

    // Deriva e atualiza MaterialGate da OP
    await this.updateJobMaterialGate(organizationId, job.id);

    return req;
  }

  /**
   * Reserva quantidade de estoque para um requisito da OP.
   * Regras estritas:
   * 1. fulfilledQuantityMilli = soma das reservas ACTIVE + CONSUMED do requisito
   * 2. remainingRequirementMilli = requiredQuantityMilli - fulfilledQuantityMilli
   * 3. Nova reserva <= remainingRequirementMilli
   * 4. Nova reserva <= availableQuantityMilli (sem Math.max)
   */
  async reserveRequirement(
    organizationId: string,
    input: ReserveRequirementInput
  ): Promise<StockReservation> {
    if (!isValidQuantityMilli(input.quantityMilli)) {
      throw new Error('A quantidade a reservar deve ser um número inteiro positivo seguro em milésimos.');
    }

    const req = await this.requirementRepo.getById(organizationId, input.requirementId);
    if (!req) {
      throw new Error('Requisito de material não encontrado.');
    }

    const material = await this.materialRepo.getById(organizationId, req.materialId);
    if (!material) {
      throw new Error('Material não encontrado no estoque.');
    }
    if (!material.isActive) {
      throw new Error('Material inativo não aceita novas reservas.');
    }

    // Calcula atendimento atual do requisito (ACTIVE + CONSUMED)
    const jobReservations = await this.reservationRepo.listByJobId(organizationId, req.productionJobId);
    const reqReservations = jobReservations.filter((r) => r.requirementId === req.id);
    const fulfilledQuantityMilli = reqReservations
      .filter((r) => r.status === 'ACTIVE' || r.status === 'CONSUMED')
      .reduce((sum, r) => sum + r.reservedQuantityMilli, 0);

    const remainingRequirementMilli = req.requiredQuantityMilli - fulfilledQuantityMilli;

    if (remainingRequirementMilli <= 0) {
      throw new Error('Este requisito já foi totalmente atendido por reservas ativas ou consumidas.');
    }

    if (input.quantityMilli > remainingRequirementMilli) {
      throw new Error(
        `Quantidade solicitada (${input.quantityMilli / 1000}) excede a necessidade restante do requisito (${remainingRequirementMilli / 1000}).`
      );
    }

    // Calcula disponibilidade estrita do material
    const { availableMilli } = await this.getMaterialAvailability(organizationId, material.id);
    if (input.quantityMilli > availableMilli) {
      throw new Error(
        `Quantidade solicitada (${input.quantityMilli / 1000}) excede o saldo disponível em estoque (${availableMilli / 1000}).`
      );
    }

    const now = new Date().toISOString();
    const reservation: StockReservation = {
      id: `res-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      organizationId,
      productionJobId: req.productionJobId,
      requirementId: req.id,
      materialId: material.id,
      reservedQuantityMilli: input.quantityMilli,
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
      userId: input.userId,
      userName: input.userName,
    };

    await this.reservationRepo.save(organizationId, reservation);

    // Registra evento de auditoria na OP
    await this.eventRepo.append(organizationId, {
      id: `evt-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      jobId: req.productionJobId,
      organizationId,
      eventType: 'MATERIAL_RESERVED',
      description: `Reserva realizada: ${input.quantityMilli / 1000} ${material.unit} de ${material.name}`,
      authorId: input.userId,
      authorName: input.userName,
      timestamp: now,
    });

    // Atualiza gate da OP
    await this.updateJobMaterialGate(organizationId, req.productionJobId);

    return reservation;
  }

  /**
   * Liberação de uma reserva ativa (devolve disponibilidade)
   */
  async releaseReservation(
    organizationId: string,
    reservationId: string,
    user: { id: string; name: string }
  ): Promise<StockReservation> {
    const res = await this.reservationRepo.getById(organizationId, reservationId);
    if (!res) {
      throw new Error('Reserva não encontrada.');
    }
    if (res.status !== 'ACTIVE') {
      throw new Error(`Somente reservas ativas podem ser liberadas. Status atual: ${res.status}`);
    }

    const now = new Date().toISOString();
    res.status = 'RELEASED';
    res.releasedAt = now;
    res.updatedAt = now;
    await this.reservationRepo.save(organizationId, res);

    const material = await this.materialRepo.getById(organizationId, res.materialId);

    // Registra evento de auditoria na OP
    await this.eventRepo.append(organizationId, {
      id: `evt-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      jobId: res.productionJobId,
      organizationId,
      eventType: 'RESERVATION_RELEASED',
      description: `Reserva liberada: ${res.reservedQuantityMilli / 1000} ${material?.unit || ''} de ${material?.name || 'material'}`,
      authorId: user.id,
      authorName: user.name,
      timestamp: now,
    });

    // Atualiza gate da OP
    await this.updateJobMaterialGate(organizationId, res.productionJobId);

    return res;
  }

  /**
   * Consumo de uma reserva ativa:
   * 1. Reduz stockOnHandMilli
   * 2. Cria movimento CONSUMPTION imutável
   * 3. Marca reserva como CONSUMED (continua contando no atendimento do requisito, mas sai das reservas ativas)
   */
  async consumeReservation(
    organizationId: string,
    reservationId: string,
    user: { id: string; name: string }
  ): Promise<{ reservation: StockReservation; movement: StockMovement }> {
    const res = await this.reservationRepo.getById(organizationId, reservationId);
    if (!res) {
      throw new Error('Reserva não encontrada.');
    }
    if (res.status !== 'ACTIVE') {
      throw new Error(`Somente reservas ativas podem ser consumidas. Status atual: ${res.status}`);
    }

    const material = await this.materialRepo.getById(organizationId, res.materialId);
    if (!material) {
      throw new Error('Material não encontrado.');
    }

    if (material.stockOnHandMilli < res.reservedQuantityMilli) {
      throw new Error('Saldo físico insuficiente para efetivar o consumo da reserva.');
    }

    // Bloqueia consumo se houver corrupção pré-existente
    const reservations = await this.reservationRepo.listByMaterialId(organizationId, res.materialId);
    const activeReserved = reservations
      .filter((r) => r.status === 'ACTIVE')
      .reduce((sum, r) => sum + r.reservedQuantityMilli, 0);

    if (activeReserved > material.stockOnHandMilli) {
      throw new StockIntegrityError(
        `Inconsistência de integridade: reservas ativas (${activeReserved / 1000}) excedem o saldo físico (${material.stockOnHandMilli / 1000}). Regularize o estoque antes de efetivar o consumo.`
      );
    }

    const previousBalance = material.stockOnHandMilli;
    const newStock = previousBalance - res.reservedQuantityMilli;
    const now = new Date().toISOString();

    material.stockOnHandMilli = newStock;
    material.updatedAt = now;
    await this.materialRepo.save(organizationId, material);

    res.status = 'CONSUMED';
    res.consumedAt = now;
    res.updatedAt = now;
    await this.reservationRepo.save(organizationId, res);

    const movement: StockMovement = {
      id: `mov-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      organizationId,
      materialId: material.id,
      type: 'CONSUMPTION',
      quantityMilli: res.reservedQuantityMilli,
      previousBalanceMilli: previousBalance,
      resultingBalanceMilli: newStock,
      productionJobId: res.productionJobId,
      reservationId: res.id,
      reason: `Consumo para produção da OP vinculada (${res.productionJobId})`,
      createdAt: now,
      userId: user.id,
      userName: user.name,
      dataOrigin: material.dataOrigin,
    };

    await this.movementRepo.append(organizationId, movement);

    // Registra evento de auditoria na OP
    await this.eventRepo.append(organizationId, {
      id: `evt-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      jobId: res.productionJobId,
      organizationId,
      eventType: 'MATERIAL_CONSUMED',
      description: `Material consumido na produção: ${res.reservedQuantityMilli / 1000} ${material.unit} de ${material.name}`,
      authorId: user.id,
      authorName: user.name,
      timestamp: now,
    });

    // Atualiza gate da OP
    await this.updateJobMaterialGate(organizationId, res.productionJobId);

    return { reservation: res, movement };
  }

  /**
   * Deriva o MaterialGate de uma OP com base no plano de materiais:
   * - Sem requisitos -> NOT_CHECKED
   * - Todos requisitos cobertos por reservas ACTIVE/CONSUMED -> RESERVED
   * - Agrega necessidades repetidas do mesmo material para checagem com o saldo global disponível
   * - Se saldo disponível cobrir todas as necessidades não atendidas -> AVAILABLE
   * - Se faltar saldo para qualquer material -> MISSING
   */
  async deriveJobMaterialGate(
    organizationId: string,
    jobId: string
  ): Promise<MaterialGate> {
    const reqs = await this.requirementRepo.listByJobId(organizationId, jobId);
    if (reqs.length === 0) {
      return 'NOT_CHECKED';
    }

    const reservations = await this.reservationRepo.listByJobId(organizationId, jobId);
    let allFullyCovered = true;

    // Agrupa necessidades não atendidas por material da OP
    const unfulfilledByMaterial = new Map<string, number>();

    for (const req of reqs) {
      const activeOrConsumed = reservations.filter(
        (r) => r.requirementId === req.id && (r.status === 'ACTIVE' || r.status === 'CONSUMED')
      );
      const coveredMilli = activeOrConsumed.reduce((sum, r) => sum + r.reservedQuantityMilli, 0);

      if (coveredMilli < req.requiredQuantityMilli) {
        allFullyCovered = false;
        const unfulfilled = req.requiredQuantityMilli - coveredMilli;
        const current = unfulfilledByMaterial.get(req.materialId) || 0;
        unfulfilledByMaterial.set(req.materialId, current + unfulfilled);
      }
    }

    if (allFullyCovered) {
      return 'RESERVED';
    }

    // Avalia disponibilidade global para cada material não atendido
    for (const [matId, totalUnfulfilled] of unfulfilledByMaterial.entries()) {
      const mat = await this.materialRepo.getById(organizationId, matId);
      if (!mat || !mat.isActive) {
        return 'MISSING';
      }

      try {
        const { availableMilli } = await this.getMaterialAvailability(organizationId, matId);
        if (availableMilli < totalUnfulfilled) {
          return 'MISSING';
        }
      } catch {
        // Em caso de erro de integridade de estoque, o gate torna-se MISSING
        return 'MISSING';
      }
    }

    return 'AVAILABLE';
  }

  /**
   * Atualiza o MaterialGate de uma OP se o valor derivado mudou
   */
  async updateJobMaterialGate(organizationId: string, jobId: string): Promise<MaterialGate> {
    const job = await this.jobRepo.getById(organizationId, jobId);
    if (!job) return 'NOT_CHECKED';

    const derivedGate = await this.deriveJobMaterialGate(organizationId, jobId);
    if (job.materialGate !== derivedGate) {
      const prevGate = job.materialGate;
      job.materialGate = derivedGate;
      job.updatedAt = new Date().toISOString();
      await this.jobRepo.save(organizationId, job);

      await this.eventRepo.append(organizationId, {
        id: `evt-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        jobId: job.id,
        organizationId,
        eventType: 'MATERIAL_GATE_CHANGED',
        fromValue: prevGate,
        toValue: derivedGate,
        description: `Gate de Material atualizado automaticamente para ${derivedGate}`,
        authorId: 'system',
        authorName: 'ArteFlow Engine',
        timestamp: new Date().toISOString(),
      });
    }

    return derivedGate;
  }

  /**
   * Recalcula os gates de todas as OPs que utilizam um material
   */
  private async recalculateJobsForMaterial(organizationId: string, materialId: string): Promise<void> {
    const allReqs = await this.requirementRepo.listAll(organizationId);
    const affectedJobIds = Array.from(
      new Set(allReqs.filter((r) => r.materialId === materialId).map((r) => r.productionJobId))
    );

    for (const jobId of affectedJobIds) {
      await this.updateJobMaterialGate(organizationId, jobId);
    }
  }

  /**
   * Recalcula todos os gates de material de todas as OPs da organização
   */
  async recalculateAllJobGates(organizationId: string): Promise<void> {
    const jobs = await this.jobRepo.list(organizationId);
    for (const job of jobs) {
      await this.updateJobMaterialGate(organizationId, job.id);
    }
  }
}
