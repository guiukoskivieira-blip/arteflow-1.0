import {
  Supplier,
  SupplierSnapshot,
  PurchaseRequest,
  PurchaseRequestItem,
  PurchaseRequestSource,
  PurchaseOrder,
  PurchaseOrderItem,
  GoodsReceipt,
  GoodsReceiptItem,
  ProcurementEvent
} from '../types/procurement';
import { StockMovement } from '../types/inventory';
import { DataOrigin } from '../types/domain';
import { storageKeys } from '../repositories/storageKeys';
import {
  ISupplierRepository,
  IPurchaseRequestRepository,
  IPurchaseRequestItemRepository,
  IPurchaseOrderRepository,
  IPurchaseOrderItemRepository,
  IGoodsReceiptRepository,
  IGoodsReceiptItemRepository,
  IProcurementEventRepository,
  IProcurementSequenceRepository,
} from '../types/procurementRepository';
import { IMaterialRepository } from '../types/repository';
import { InventoryService } from './inventoryService';
import { isValidQuantityMilli } from '../domain/quantity';
import { isValidNonNegativeCents, computeSubtotalCents, computeWeightedAverageCostCents } from '../domain/money';
import { getStorage, readList, writeList } from '../repositories/procurement/common';

export interface CreateSupplierInput {
  code: string;
  tradeName: string;
  corporateName?: string;
  document?: string;
  contactName?: string;
  email?: string;
  phone?: string;
  address?: string;
  defaultLeadTimeDays?: number;
  paymentTermsSnapshot?: string;
  notes?: string;
  dataOrigin?: DataOrigin;
  userId: string;
  userName: string;
}

export interface UpdateSupplierInput {
  code?: string;
  tradeName?: string;
  corporateName?: string;
  document?: string;
  contactName?: string;
  email?: string;
  phone?: string;
  address?: string;
  defaultLeadTimeDays?: number;
  paymentTermsSnapshot?: string;
  notes?: string;
  userId: string;
  userName: string;
}

export interface CreatePurchaseRequestItemInput {
  materialId: string;
  requestedQuantityMilli: number;
  reason: string;
  productionJobId?: string;
}

export interface CreatePurchaseRequestInput {
  source: PurchaseRequestSource;
  productionJobId?: string;
  jobCode?: string;
  notes?: string;
  items: CreatePurchaseRequestItemInput[];
  dataOrigin?: DataOrigin;
  userId: string;
  userName: string;
}

export interface CreatePurchaseOrderItemInput {
  materialId: string;
  orderedQuantityMilli: number;
  unitCostCents: number;
  purchaseRequestItemId?: string;
  productionJobId?: string;
}

export interface CreatePurchaseOrderInput {
  supplierId: string;
  items: CreatePurchaseOrderItemInput[];
  freightCents?: number;
  discountCents?: number;
  notes?: string;
  expectedAt?: string;
  purchaseRequestIds?: string[];
  dataOrigin?: DataOrigin;
  userId: string;
  userName: string;
}

export interface RecordGoodsReceiptItemInput {
  purchaseOrderItemId: string;
  quantityMilli: number;
  unitCostCents?: number;
}

export interface RecordGoodsReceiptInput {
  purchaseOrderId: string;
  invoiceNumber?: string;
  notes?: string;
  idempotencyKey?: string;
  items: RecordGoodsReceiptItemInput[];
  dataOrigin?: DataOrigin;
  userId: string;
  userName: string;
}

export class ProcurementService {
  constructor(
    private supplierRepo: ISupplierRepository,
    private requestRepo: IPurchaseRequestRepository,
    private requestItemRepo: IPurchaseRequestItemRepository,
    private orderRepo: IPurchaseOrderRepository,
    private orderItemRepo: IPurchaseOrderItemRepository,
    private receiptRepo: IGoodsReceiptRepository,
    private receiptItemRepo: IGoodsReceiptItemRepository,
    private eventRepo: IProcurementEventRepository,
    private _sequenceRepo: IProcurementSequenceRepository,
    private materialRepo: IMaterialRepository,
    private _inventoryService?: InventoryService
  ) {}

  private generateId(prefix: string): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  }

  private normalizeDocument(doc?: string): string | undefined {
    if (!doc) return undefined;
    const clean = doc.replace(/\D/g, '');
    return clean || undefined;
  }

  private validateEmail(email?: string): void {
    if (!email || !email.trim()) return;
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!regex.test(email.trim())) {
      throw new Error('E-mail informado possui formato inválido.');
    }
  }

  private async withTransaction<T>(keys: string[], fn: () => Promise<T>): Promise<T> {
    const storage = getStorage();
    const snapshots: Record<string, string | null> = {};
    if (storage) {
      for (const key of keys) {
        snapshots[key] = storage.getItem(key);
      }
    }
    try {
      return await fn();
    } catch (err) {
      if (storage) {
        for (const key of keys) {
          const val = snapshots[key];
          if (val === null) {
            storage.removeItem(key);
          } else {
            storage.setItem(key, val);
          }
        }
      }
      throw err;
    }
  }

  private _reqSeq = 1;
  private _ordSeq = 1;
  private _recSeq = 1;

  private async generateRequestNumber(organizationId: string): Promise<string> {
    void this._sequenceRepo; void organizationId;
    return `SC-${Date.now()}-${this._reqSeq++}`;
  }

  private async generateOrderNumber(organizationId: string): Promise<string> {
    void this._inventoryService; void organizationId;
    return `PC-${Date.now()}-${this._ordSeq++}`;
  }

  private async generateReceiptNumber(organizationId: string): Promise<string> {
    void organizationId;
    return `REC-${Date.now()}-${this._recSeq++}`;
  }

  // ==========================================
  // FORNECEDORES (SUPPLIERS)
  // ==========================================

  async createSupplier(organizationId: string, input: CreateSupplierInput): Promise<Supplier> {
    const code = input.code.trim().toUpperCase();
    if (!code) throw new Error('Código do fornecedor é obrigatório.');

    const existingCode = await this.supplierRepo.getByCode(organizationId, code);
    if (existingCode) {
      throw new Error(`Código de fornecedor "${code}" já cadastrado nesta organização.`);
    }

    const tradeName = input.tradeName.trim();
    if (!tradeName) throw new Error('Nome fantasia do fornecedor é obrigatório.');

    const normalizedDoc = this.normalizeDocument(input.document);

    this.validateEmail(input.email);

    const now = new Date().toISOString();
    const supplier: Supplier = {
      id: this.generateId('sup'),
      organizationId,
      code,
      tradeName,
      corporateName: input.corporateName?.trim() || undefined,
      document: normalizedDoc,
      contactName: input.contactName?.trim() || undefined,
      email: input.email?.trim() || undefined,
      phone: input.phone?.trim() || undefined,
      address: input.address?.trim() || undefined,
      defaultLeadTimeDays: input.defaultLeadTimeDays,
      paymentTermsSnapshot: input.paymentTermsSnapshot?.trim() || undefined,
      notes: input.notes?.trim() || undefined,
      isActive: true,
      dataOrigin: input.dataOrigin || 'user',
      createdAt: now,
      updatedAt: now,
    };

    return await this.supplierRepo.save(organizationId, supplier);
  }

  async updateSupplier(organizationId: string, supplierId: string, input: UpdateSupplierInput): Promise<Supplier> {
    const supplier = await this.supplierRepo.getById(organizationId, supplierId);
    if (!supplier) throw new Error('Fornecedor não encontrado.');

    if (input.code) {
      const code = input.code.trim().toUpperCase();
      if (!code) throw new Error('Código do fornecedor é obrigatório.');
      if (code !== supplier.code) {
        const existingCode = await this.supplierRepo.getByCode(organizationId, code);
        if (existingCode && existingCode.id !== supplierId) {
          throw new Error(`Código de fornecedor "${code}" já cadastrado nesta organização.`);
        }
        supplier.code = code;
      }
    }

    if (input.tradeName) {
      const tradeName = input.tradeName.trim();
      if (!tradeName) throw new Error('Nome fantasia do fornecedor é obrigatório.');
      supplier.tradeName = tradeName;
    }

    if (input.document !== undefined) supplier.document = this.normalizeDocument(input.document);
    if (input.corporateName !== undefined) supplier.corporateName = input.corporateName.trim() || undefined;
    if (input.contactName !== undefined) supplier.contactName = input.contactName.trim() || undefined;
    if (input.email !== undefined) {
      this.validateEmail(input.email);
      supplier.email = input.email.trim() || undefined;
    }
    if (input.phone !== undefined) supplier.phone = input.phone.trim() || undefined;
    if (input.address !== undefined) supplier.address = input.address.trim() || undefined;
    if (input.defaultLeadTimeDays !== undefined) supplier.defaultLeadTimeDays = input.defaultLeadTimeDays;
    if (input.paymentTermsSnapshot !== undefined) supplier.paymentTermsSnapshot = input.paymentTermsSnapshot.trim() || undefined;
    if (input.notes !== undefined) supplier.notes = input.notes.trim() || undefined;

    supplier.updatedAt = new Date().toISOString();
    return await this.supplierRepo.save(organizationId, supplier);
  }

  async toggleSupplierActive(organizationId: string, supplierId: string, userId: string, userName: string): Promise<Supplier> {
    void userId; void userName;
    const supplier = await this.supplierRepo.getById(organizationId, supplierId);
    if (!supplier) throw new Error('Fornecedor não encontrado.');
    supplier.isActive = !supplier.isActive;
    supplier.updatedAt = new Date().toISOString();
    return await this.supplierRepo.save(organizationId, supplier);
  }
  // ==========================================
  // SOLICITAÇÕES DE COMPRA (PURCHASE REQUESTS)
  // ==========================================

  async createPurchaseRequest(
    organizationId: string,
    input: CreatePurchaseRequestInput
  ): Promise<{ request: PurchaseRequest; items: PurchaseRequestItem[] }> {
    if (!input.items || input.items.length === 0) {
      throw new Error('A solicitação de compra deve conter ao menos um item.');
    }

    const now = new Date().toISOString();
    const requestId = this.generateId('req');
    const requestNumber = await this.generateRequestNumber(organizationId);

    const createdItems: PurchaseRequestItem[] = [];

    for (const itemInput of input.items) {
      if (!isValidQuantityMilli(itemInput.requestedQuantityMilli)) {
        throw new Error('A quantidade solicitada deve ser um número inteiro positivo em milésimos.');
      }

      const material = await this.materialRepo.getById(organizationId, itemInput.materialId);
      if (!material) {
        throw new Error(`Material ${itemInput.materialId} não encontrado.`);
      }
      if (!material.isActive) {
        throw new Error(`Material inativo "${material.name}" não pode ser solicitado.`);
      }

      const item: PurchaseRequestItem = {
        id: this.generateId('rqi'),
        organizationId,
        purchaseRequestId: requestId,
        materialId: material.id,
        materialSnapshot: {
          sku: material.sku,
          name: material.name,
          unit: material.unit,
          averageCostCents: material.averageCostCents,
        },
        requestedQuantityMilli: itemInput.requestedQuantityMilli,
        unit: material.unit,
        reason: itemInput.reason.trim() || 'Necessidade de compra',
        productionJobId: itemInput.productionJobId || input.productionJobId,
        createdAt: now,
      };

      createdItems.push(item);
    }

    const request: PurchaseRequest = {
      id: requestId,
      organizationId,
      requestNumber,
      status: 'REQUESTED',
      source: input.source,
      productionJobId: input.productionJobId,
      jobCode: input.jobCode,
      notes: input.notes?.trim() || undefined,
      requestedBy: input.userId,
      requestedByName: input.userName,
      requestedAt: now,
      dataOrigin: input.dataOrigin || 'user',
      createdAt: now,
      updatedAt: now,
    };

    const eventToEmit: ProcurementEvent = {
      id: this.generateId('pevt'),
      organizationId,
      entityType: 'REQUEST',
      entityId: request.id,
      eventType: 'REQUEST_CREATED',
      description: `Solicitação de compra ${requestNumber} criada com ${createdItems.length} item(ns)`,
      userId: input.userId,
      userName: input.userName,
      createdAt: now,
    };

    await this.withTransaction([
      storageKeys.purchaseRequests(organizationId),
      storageKeys.purchaseRequestItems(organizationId)
    ], async () => {
      await this.requestRepo.save(organizationId, request);
      await this.requestItemRepo.saveMany(organizationId, createdItems);
    });

    await this.eventRepo.append(organizationId, eventToEmit);

    return { request, items: createdItems };
  }

  async cancelPurchaseRequest(
    organizationId: string,
    requestId: string,
    reason: string,
    userId: string,
    userName: string
  ): Promise<PurchaseRequest> {
    const request = await this.requestRepo.getById(organizationId, requestId);
    if (!request) throw new Error('Solicitação de compra não encontrada.');

    if (request.status === 'CONVERTED') {
      throw new Error('Solicitação já convertida em pedido de compra não pode ser cancelada.');
    }
    if (request.status === 'CANCELLED') {
      return request;
    }

    request.status = 'CANCELLED';
    request.updatedAt = new Date().toISOString();

    const eventToEmit: ProcurementEvent = {
      id: this.generateId('pevt'),
      organizationId,
      entityType: 'REQUEST',
      entityId: request.id,
      eventType: 'REQUEST_CANCELLED',
      description: `Solicitação cancelada: ${reason}`,
      userId,
      userName,
      createdAt: request.updatedAt,
    };

    await this.withTransaction([
      storageKeys.purchaseRequests(organizationId)
    ], async () => {
      await this.requestRepo.save(organizationId, request);
    });

    await this.eventRepo.append(organizationId, eventToEmit);

    return request;
  }
  // ==========================================
  // PEDIDOS DE COMPRA (PURCHASE ORDERS)
  // ==========================================

  async createPurchaseOrder(
    organizationId: string,
    input: CreatePurchaseOrderInput
  ): Promise<{ order: PurchaseOrder; items: PurchaseOrderItem[] }> {
    const supplier = await this.supplierRepo.getById(organizationId, input.supplierId);
    if (!supplier) throw new Error('Fornecedor não encontrado.');
    if (!supplier.isActive) throw new Error('Fornecedor inativo não pode receber novos pedidos de compra.');

    if (!input.items || input.items.length === 0) {
      throw new Error('O pedido de compra deve conter ao menos um item.');
    }

    const supplierSnapshot: SupplierSnapshot = {
      id: supplier.id,
      code: supplier.code,
      tradeName: supplier.tradeName,
      corporateName: supplier.corporateName,
      document: supplier.document,
      contactName: supplier.contactName,
      email: supplier.email,
      phone: supplier.phone,
    };

    const now = new Date().toISOString();
    const orderId = this.generateId('po');
    const orderNumber = await this.generateOrderNumber(organizationId);

    const orderItems: PurchaseOrderItem[] = [];
    let subtotalCents = 0;

    for (const itemInput of input.items) {
      if (!isValidQuantityMilli(itemInput.orderedQuantityMilli)) {
        throw new Error('A quantidade do pedido deve ser um número inteiro positivo em milésimos.');
      }
      if (!isValidNonNegativeCents(itemInput.unitCostCents)) {
        throw new Error('O custo unitário deve ser um número inteiro não-negativo em centavos.');
      }

      const material = await this.materialRepo.getById(organizationId, itemInput.materialId);
      if (!material) throw new Error(`Material ${itemInput.materialId} não encontrado.`);
      if (!material.isActive) throw new Error(`Material inativo "${material.name}" não pode ser incluído no pedido.`);

      const totalCostCents = computeSubtotalCents(itemInput.orderedQuantityMilli, itemInput.unitCostCents);
      subtotalCents += totalCostCents;

      const orderItem: PurchaseOrderItem = {
        id: this.generateId('poi'),
        organizationId,
        purchaseOrderId: orderId,
        purchaseRequestItemId: itemInput.purchaseRequestItemId,
        materialId: material.id,
        materialSnapshot: {
          sku: material.sku,
          name: material.name,
          unit: material.unit,
          averageCostCents: material.averageCostCents,
        },
        orderedQuantityMilli: itemInput.orderedQuantityMilli,
        receivedQuantityMilli: 0,
        unit: material.unit,
        unitCostCents: itemInput.unitCostCents,
        totalCostCents,
        productionJobId: itemInput.productionJobId,
        createdAt: now,
        updatedAt: now,
      };

      orderItems.push(orderItem);
    }

    const freightCents = input.freightCents ?? 0;
    const discountCents = input.discountCents ?? 0;

    if (!isValidNonNegativeCents(freightCents)) throw new Error('Frete deve ser um valor inteiro não-negativo em centavos.');
    if (!isValidNonNegativeCents(discountCents)) throw new Error('Desconto deve ser um valor inteiro não-negativo em centavos.');

    if (discountCents > subtotalCents + freightCents) {
      throw new Error('O desconto não pode ultrapassar o subtotal + frete do pedido.');
    }

    const totalCents = subtotalCents + freightCents - discountCents;

    const order: PurchaseOrder = {
      id: orderId,
      organizationId,
      orderNumber,
      supplierId: supplier.id,
      supplierSnapshot,
      status: 'DRAFT',
      expectedAt: input.expectedAt,
      freightCents,
      discountCents,
      subtotalCents,
      totalCents,
      notes: input.notes?.trim() || undefined,
      createdBy: input.userId,
      createdByName: input.userName,
      dataOrigin: input.dataOrigin || 'user',
      createdAt: now,
      updatedAt: now,
    };

    const eventsToEmit: ProcurementEvent[] = [];
    eventsToEmit.push({
      id: this.generateId('pevt'),
      organizationId,
      entityType: 'ORDER',
      entityId: order.id,
      eventType: 'ORDER_CREATED',
      description: `Pedido de compra ${orderNumber} criado (Rascunho) com ${orderItems.length} item(ns) para ${supplier.tradeName}`,
      userId: input.userId,
      userName: input.userName,
      createdAt: now,
    });

    const requestsToSave: PurchaseRequest[] = [];
    if (input.purchaseRequestIds && input.purchaseRequestIds.length > 0) {
      for (const reqId of input.purchaseRequestIds) {
        const req = await this.requestRepo.getById(organizationId, reqId);
        if (req && req.status !== 'CONVERTED') {
          req.status = 'CONVERTED';
          req.updatedAt = now;
          requestsToSave.push(req);

          eventsToEmit.push({
            id: this.generateId('pevt'),
            organizationId,
            entityType: 'REQUEST',
            entityId: req.id,
            eventType: 'REQUEST_CONVERTED',
            description: `Solicitação ${req.requestNumber} convertida no pedido ${orderNumber}`,
            userId: input.userId,
            userName: input.userName,
            createdAt: now,
          });
        }
      }
    }

    await this.withTransaction([
      storageKeys.purchaseOrders(organizationId),
      storageKeys.purchaseOrderItems(organizationId),
      storageKeys.purchaseRequests(organizationId)
    ], async () => {
      await this.orderRepo.save(organizationId, order);
      await this.orderItemRepo.saveMany(organizationId, orderItems);

      for (const req of requestsToSave) {
        await this.requestRepo.save(organizationId, req);
      }
    });

    for (const ev of eventsToEmit) {
      await this.eventRepo.append(organizationId, ev);
    }

    return { order, items: orderItems };
  }

  async issuePurchaseOrder(
    organizationId: string,
    orderId: string,
    userId: string,
    userName: string
  ): Promise<PurchaseOrder> {
    const order = await this.orderRepo.getById(organizationId, orderId);
    if (!order) throw new Error('Pedido de compra não encontrado.');

    if (order.status !== 'DRAFT') {
      throw new Error(`Somente pedidos em Rascunho podem ser emitidos. Status atual: ${order.status}.`);
    }

    const supplier = await this.supplierRepo.getById(organizationId, order.supplierId);
    if (supplier && !supplier.isActive) {
      throw new Error('Não é possível emitir pedido para um fornecedor inativo.');
    }

    const now = new Date().toISOString();
    order.status = 'ISSUED';
    order.updatedAt = now;

    const eventToEmit: ProcurementEvent = {
      id: this.generateId('pevt'),
      organizationId,
      entityType: 'ORDER',
      entityId: order.id,
      eventType: 'ORDER_ISSUED',
      description: `Pedido de compra ${order.orderNumber} emitido para ${order.supplierSnapshot.tradeName}`,
      userId,
      userName,
      createdAt: now,
    };

    await this.withTransaction([
      storageKeys.purchaseOrders(organizationId)
    ], async () => {
      await this.orderRepo.save(organizationId, order);
    });

    await this.eventRepo.append(organizationId, eventToEmit);
    return order;
  }
  async cancelPurchaseOrder(
    organizationId: string,
    orderId: string,
    reason: string,
    userId: string,
    userName: string
  ): Promise<PurchaseOrder> {
    const order = await this.orderRepo.getById(organizationId, orderId);
    if (!order) throw new Error('Pedido de compra não encontrado.');

    if (order.status === 'RECEIVED' || order.status === 'PARTIALLY_RECEIVED') {
      throw new Error(`Pedidos com recebimento (${order.status}) não podem ser cancelados.`);
    }
    if (order.status === 'CANCELLED') {
      return order;
    }

    const now = new Date().toISOString();
    order.status = 'CANCELLED';
    order.updatedAt = now;

    const eventToEmit: ProcurementEvent = {
      id: this.generateId('pevt'),
      organizationId,
      entityType: 'ORDER',
      entityId: order.id,
      eventType: 'ORDER_CANCELLED',
      description: `Pedido cancelado: ${reason}`,
      userId,
      userName,
      createdAt: now,
    };

    await this.withTransaction([
      storageKeys.purchaseOrders(organizationId)
    ], async () => {
      await this.orderRepo.save(organizationId, order);
    });

    await this.eventRepo.append(organizationId, eventToEmit);

    return order;
  }

  // ==========================================
  // RECEBIMENTOS (GOODS RECEIPTS)
  // ==========================================

  async recordGoodsReceipt(
    organizationId: string,
    input: RecordGoodsReceiptInput
  ): Promise<{ receipt: GoodsReceipt; order: PurchaseOrder; receiptItems: GoodsReceiptItem[] }> {
    const order = await this.orderRepo.getById(organizationId, input.purchaseOrderId);
    if (!order) throw new Error('Pedido de compra não encontrado.');

    // Idempotência avaliada antes para retornar recebimento já consolidado
    if (input.idempotencyKey?.trim()) {
      const existingReceipt = await this.receiptRepo.getByIdempotencyKey(organizationId, input.idempotencyKey.trim());
      if (existingReceipt) {
        if (existingReceipt.purchaseOrderId !== order.id) {
          throw new Error('Conflito de idempotência: a chave informada já foi utilizada em outro pedido.');
        }
        const existingItems = await this.receiptItemRepo.listByReceiptId(organizationId, existingReceipt.id);
        return { receipt: existingReceipt, order, receiptItems: existingItems };
      }
    }

    if (order.status !== 'ISSUED' && order.status !== 'PARTIALLY_RECEIVED') {
      throw new Error(`Somente pedidos Emitidos ou Parcialmente Recebidos podem receber entrega. Status atual: ${order.status}.`);
    }

    if (!input.items || input.items.length === 0) {
      throw new Error('O recebimento deve conter ao menos um item com quantidade positiva.');
    }

    const orderItems = await this.orderItemRepo.listByOrderId(organizationId, order.id);

    // Validação estrita de todos os itens antes de aplicar qualquer mutação (Atomicidade)
    for (const itemInput of input.items) {
      const orderItem = orderItems.find((i) => i.id === itemInput.purchaseOrderItemId);
      if (!orderItem) {
        throw new Error(`Item de pedido ${itemInput.purchaseOrderItemId} não pertence a este pedido.`);
      }

      if (!isValidQuantityMilli(itemInput.quantityMilli)) {
        throw new Error('A quantidade recebida deve ser um número inteiro positivo em milésimos.');
      }

      const pendingQty = orderItem.orderedQuantityMilli - orderItem.receivedQuantityMilli;
      if (itemInput.quantityMilli > pendingQty) {
        throw new Error(
          `Quantidade recebida (${itemInput.quantityMilli / 1000}) excede o saldo pendente (${pendingQty / 1000}) para o item "${orderItem.materialSnapshot.name}".`
        );
      }
    }

    const now = new Date().toISOString();
    const receiptId = this.generateId('rec');
    const receiptNumber = await this.generateReceiptNumber(organizationId);

    const createdReceiptItems: GoodsReceiptItem[] = [];
    const stockMovementsToAppend: StockMovement[] = [];
    const materialsToUpdate: { material: any; previousBalance: number; newBalance: number }[] = [];

    // Carrega materiais do estoque e prepara mutações de estoque
    for (const itemInput of input.items) {
      const orderItem = orderItems.find((i) => i.id === itemInput.purchaseOrderItemId)!;
      const unitCost = itemInput.unitCostCents ?? orderItem.unitCostCents;
      const totalCostCents = computeSubtotalCents(itemInput.quantityMilli, unitCost);

      const material = await this.materialRepo.getById(organizationId, orderItem.materialId);
      if (!material) {
        throw new Error(`Material ${orderItem.materialId} não encontrado no estoque.`);
      }

      const previousBalance = material.stockOnHandMilli;
      const incomingQty = itemInput.quantityMilli;
      const resultingBalance = previousBalance + incomingQty;

      if (!Number.isSafeInteger(resultingBalance) || resultingBalance > Number.MAX_SAFE_INTEGER) {
        throw new Error('O saldo físico resultante no estoque excede o limite numérico seguro.');
      }

      // Recálculo do custo médio ponderado determinístico
      if (unitCost !== undefined && isValidNonNegativeCents(unitCost)) {
        material.averageCostCents = computeWeightedAverageCostCents(
          previousBalance,
          material.averageCostCents,
          incomingQty,
          unitCost,
          totalCostCents
        );
      }

      material.stockOnHandMilli = resultingBalance;
      material.updatedAt = now;

      let movementId = `mov-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

      const receiptItem: GoodsReceiptItem = {
        id: this.generateId('gri'),
        organizationId,
        goodsReceiptId: receiptId,
        purchaseOrderItemId: orderItem.id,
        materialId: orderItem.materialId,
        receivedQuantityMilli: itemInput.quantityMilli,
        unitCostCents: unitCost,
        totalCostCents,
        stockMovementId: movementId,
        createdAt: now,
      };

      const stockMovement: StockMovement = {
        id: movementId,
        organizationId,
        materialId: material.id,
        type: 'RECEIPT',
        quantityMilli: incomingQty,
        previousBalanceMilli: previousBalance,
        resultingBalanceMilli: resultingBalance,
        unitCostCents: unitCost,
        totalCostCents: totalCostCents,
        reason: `Recebimento ${receiptNumber} do Pedido ${order.orderNumber}`,
        createdAt: now,
        userId: input.userId,
        userName: input.userName,
        dataOrigin: input.dataOrigin || 'user',
      };

      createdReceiptItems.push(receiptItem);
      stockMovementsToAppend.push(stockMovement);
      materialsToUpdate.push({ material, previousBalance, newBalance: resultingBalance });

      // Atualiza quantidades no item de pedido
      orderItem.receivedQuantityMilli += itemInput.quantityMilli;
      orderItem.updatedAt = now;
    }

    const receipt: GoodsReceipt = {
      id: receiptId,
      organizationId,
      purchaseOrderId: order.id,
      receiptNumber,
      supplierSnapshot: order.supplierSnapshot,
      invoiceNumber: input.invoiceNumber?.trim() || undefined,
      receivedAt: now,
      receivedBy: input.userId,
      receivedByName: input.userName,
      notes: input.notes?.trim() || undefined,
      idempotencyKey: input.idempotencyKey?.trim() || this.generateId('idem'),
      dataOrigin: input.dataOrigin || 'user',
      createdAt: now,
    };

    const allFullyReceived = orderItems.every((item) => item.receivedQuantityMilli >= item.orderedQuantityMilli);
    order.status = allFullyReceived ? 'RECEIVED' : 'PARTIALLY_RECEIVED';
    order.updatedAt = now;

    const eventToEmit: ProcurementEvent = {
      id: this.generateId('pevt'),
      organizationId,
      entityType: 'ORDER',
      entityId: order.id,
      eventType: 'GOODS_RECEIVED',
      description: `Recebimento ${receiptNumber} registrado. Pedido atualizado para ${order.status}.`,
      userId: input.userId,
      userName: input.userName,
      createdAt: now,
    };

    await this.withTransaction([
      storageKeys.goodsReceipts(organizationId),
      storageKeys.goodsReceiptItems(organizationId),
      storageKeys.purchaseOrderItems(organizationId),
      storageKeys.purchaseOrders(organizationId),
      storageKeys.materials(organizationId),
      storageKeys.movements(organizationId)
    ], async () => {
      // 1. Salvar cabeçalho e itens do recebimento
      await this.receiptRepo.save(organizationId, receipt);
      await this.receiptItemRepo.saveMany(organizationId, createdReceiptItems);

      // 2. Salvar itens do pedido atualizados e cabeçalho do pedido
      for (const orderItem of orderItems) {
        await this.orderItemRepo.save(organizationId, orderItem);
      }
      await this.orderRepo.save(organizationId, order);

      // 3. Salvar materiais atualizados no estoque
      for (const { material } of materialsToUpdate) {
        await this.materialRepo.save(organizationId, material);
      }

      // 4. Salvar movimentações de estoque (append) usando a abstração universal de storage
      const existingMovements = readList<StockMovement>(storageKeys.movements(organizationId));
      const updatedMovements = [...existingMovements, ...stockMovementsToAppend];
      writeList<StockMovement>(storageKeys.movements(organizationId), updatedMovements);
    });

    // Evento disparado estritamente após o commit
    await this.eventRepo.append(organizationId, eventToEmit);

    return { receipt, order, receiptItems: createdReceiptItems };
  }
}
