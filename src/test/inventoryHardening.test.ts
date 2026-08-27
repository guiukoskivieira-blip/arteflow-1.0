import { describe, it, expect, beforeEach } from 'vitest';
import { LocalStorageMaterialRepository } from '../repositories/localStorageMaterialRepository';
import { LocalStorageRequirementRepository } from '../repositories/localStorageRequirementRepository';
import { LocalStorageReservationRepository } from '../repositories/localStorageReservationRepository';
import { LocalStorageMovementRepository } from '../repositories/localStorageMovementRepository';
import { LocalStorageJobRepository } from '../repositories/localStorageJobRepository';
import { LocalStorageEventRepository } from '../repositories/localStorageEventRepository';
import { InventoryService, StockIntegrityError } from '../services/inventoryService';
import { getDemoSeedData } from '../domain/seed';

const orgId = 'org-test-hardening-01';

describe('ArteFlow — Hardening P1: Invariantes Matemáticas de Estoque (16 Garantias Estritas)', () => {
  let materialRepo: LocalStorageMaterialRepository;
  let reqRepo: LocalStorageRequirementRepository;
  let resRepo: LocalStorageReservationRepository;
  let movRepo: LocalStorageMovementRepository;
  let jobRepo: LocalStorageJobRepository;
  let eventRepo: LocalStorageEventRepository;
  let inventoryService: InventoryService;

  beforeEach(async () => {
    window.localStorage.clear();
    materialRepo = new LocalStorageMaterialRepository();
    reqRepo = new LocalStorageRequirementRepository();
    resRepo = new LocalStorageReservationRepository();
    movRepo = new LocalStorageMovementRepository();
    jobRepo = new LocalStorageJobRepository();
    eventRepo = new LocalStorageEventRepository();

    inventoryService = new InventoryService(
      materialRepo,
      reqRepo,
      resRepo,
      movRepo,
      jobRepo,
      eventRepo
    );
  });

  // Teste 1: available nunca é mascarado por Math.max
  it('1. available nunca é mascarado por Math.max quando reservas ativas são menores ou iguais ao físico', async () => {
    const { material } = await inventoryService.createMaterial(orgId, {
      sku: 'MAT-HARD-01',
      name: 'Papel Hardening 1',
      category: 'Papéis',
      unit: 'SHEET',
      initialStockMilli: 100000, // 100 fl
      minimumStockMilli: 10000,
      userId: 'u1',
      userName: 'Operador',
    });

    const avail1 = await inventoryService.getMaterialAvailability(orgId, material.id);
    expect(avail1.availableMilli).toBe(100000);
  });

  // Teste 2: reserva ativa maior que físico produz erro de integridade explícito
  it('2. reserva ativa maior que físico produz erro de integridade (StockIntegrityError) sem esconder com 0', async () => {
    const { material } = await inventoryService.createMaterial(orgId, {
      sku: 'MAT-HARD-02',
      name: 'Material com Corrupção Simulada',
      category: 'Lonas',
      unit: 'SQUARE_METER',
      initialStockMilli: 50000, // 50 m²
      minimumStockMilli: 10000,
      userId: 'u1',
      userName: 'Operador',
    });

    // Simula reserva ativa de 70 m² (acima do físico de 50 m²)
    await resRepo.save(orgId, {
      id: 'res-corrupt-01',
      organizationId: orgId,
      productionJobId: 'job-any',
      requirementId: 'req-any',
      materialId: material.id,
      reservedQuantityMilli: 70000,
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      userId: 'u1',
      userName: 'Operador',
    });

    await expect(inventoryService.getMaterialAvailability(orgId, material.id)).rejects.toThrow(
      StockIntegrityError
    );
    await expect(inventoryService.getMaterialAvailability(orgId, material.id)).rejects.toThrow(
      'Inconsistência de integridade'
    );
  });

  // Teste 3: ajuste negativo abaixo do reservado é bloqueado
  it('3. ajuste negativo abaixo do total reservado ativo é bloqueado', async () => {
    const { material } = await inventoryService.createMaterial(orgId, {
      sku: 'MAT-HARD-03',
      name: 'Material para Ajuste Negativo',
      category: 'Papéis',
      unit: 'SHEET',
      initialStockMilli: 100000, // 100 fl
      minimumStockMilli: 20000,
      userId: 'u1',
      userName: 'Operador',
    });

    // Cria reserva ativa de 60 fl
    await resRepo.save(orgId, {
      id: 'res-hard-03',
      organizationId: orgId,
      productionJobId: 'job-01',
      requirementId: 'req-01',
      materialId: material.id,
      reservedQuantityMilli: 60000, // 60 fl reservadas
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      userId: 'u1',
      userName: 'Operador',
    });

    // Tentar subtrair 50 fl deixaria 50 fl (menor que as 60 fl reservadas)
    await expect(
      inventoryService.adjustStock(orgId, {
        materialId: material.id,
        type: 'NEGATIVE_ADJUSTMENT',
        quantityMilli: 50000,
        reason: 'Ajuste excessivo',
        userId: 'u1',
        userName: 'Operador',
      })
    ).rejects.toThrow('deixaria o saldo físico');
  });

  // Teste 4: ajuste negativo até exatamente o reservado é permitido
  it('4. ajuste negativo até exatamente o saldo reservado ativo é permitido', async () => {
    const { material } = await inventoryService.createMaterial(orgId, {
      sku: 'MAT-HARD-04',
      name: 'Material Limite',
      category: 'Papéis',
      unit: 'SHEET',
      initialStockMilli: 100000, // 100 fl
      minimumStockMilli: 20000,
      userId: 'u1',
      userName: 'Operador',
    });

    await resRepo.save(orgId, {
      id: 'res-hard-04',
      organizationId: orgId,
      productionJobId: 'job-01',
      requirementId: 'req-01',
      materialId: material.id,
      reservedQuantityMilli: 60000, // 60 fl reservadas
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      userId: 'u1',
      userName: 'Operador',
    });

    // Subtrair exatamente 40 fl (100 - 40 = 60 fl == 60 fl reservadas)
    const { material: updated } = await inventoryService.adjustStock(orgId, {
      materialId: material.id,
      type: 'NEGATIVE_ADJUSTMENT',
      quantityMilli: 40000,
      reason: 'Ajuste até o limite do reservado',
      userId: 'u1',
      userName: 'Operador',
    });

    expect(updated.stockOnHandMilli).toBe(60000);
    const avail = await inventoryService.getMaterialAvailability(orgId, material.id);
    expect(avail.availableMilli).toBe(0);
  });

  // Teste 5: duas OPs não reservam o mesmo saldo
  it('5. duas OPs não reservam o mesmo saldo disponível', async () => {
    const seed = getDemoSeedData(orgId);
    await jobRepo.saveMany(orgId, seed.jobs);

    const { material } = await inventoryService.createMaterial(orgId, {
      sku: 'MAT-SHARED-01',
      name: 'Material Compartilhado',
      category: 'Tintas',
      unit: 'LITER',
      initialStockMilli: 10000, // 10 L
      minimumStockMilli: 2000,
      userId: 'u1',
      userName: 'Operador',
    });

    const req1 = await inventoryService.addRequirement(orgId, {
      productionJobId: 'job-demo-001',
      materialId: material.id,
      requiredQuantityMilli: 8000, // 8 L
      userId: 'u1',
      userName: 'Operador',
    });

    const req2 = await inventoryService.addRequirement(orgId, {
      productionJobId: 'job-demo-002',
      materialId: material.id,
      requiredQuantityMilli: 5000, // 5 L
      userId: 'u1',
      userName: 'Operador',
    });

    // OP 1 reserva 8 L (restam 2 L disponíveis)
    await inventoryService.reserveRequirement(orgId, {
      requirementId: req1.id,
      quantityMilli: 8000,
      userId: 'u1',
      userName: 'Operador',
    });

    // OP 2 tenta reservar 5 L (mas só há 2 L) -> Bloqueio!
    await expect(
      inventoryService.reserveRequirement(orgId, {
        requirementId: req2.id,
        quantityMilli: 5000,
        userId: 'u1',
        userName: 'Operador',
      })
    ).rejects.toThrow('excede o saldo disponível');
  });

  // Teste 6: dois requisitos do mesmo material não duplicam disponibilidade
  it('6. dois requisitos do mesmo material não duplicam disponibilidade ao avaliar gate', async () => {
    const seed = getDemoSeedData(orgId);
    await jobRepo.saveMany(orgId, seed.jobs);

    const { material } = await inventoryService.createMaterial(orgId, {
      sku: 'MAT-DUAL-01',
      name: 'Material Requisitos Duplos',
      category: 'Papéis',
      unit: 'SHEET',
      initialStockMilli: 100000, // 100 fl disponíveis
      minimumStockMilli: 10000,
      userId: 'u1',
      userName: 'Operador',
    });

    // OP possui 2 requisitos do mesmo material de 60 fl cada (total 120 fl > 100 fl estoque)
    await inventoryService.addRequirement(orgId, {
      productionJobId: 'job-demo-001',
      materialId: material.id,
      requiredQuantityMilli: 60000, // 60 fl
      userId: 'u1',
      userName: 'Operador',
    });

    await inventoryService.addRequirement(orgId, {
      productionJobId: 'job-demo-001',
      materialId: material.id,
      requiredQuantityMilli: 60000, // 60 fl
      userId: 'u1',
      userName: 'Operador',
    });

    // Soma das necessidades (120 fl) excede o saldo (100 fl) -> Gate DEVE ser MISSING!
    const gate = await inventoryService.deriveJobMaterialGate(orgId, 'job-demo-001');
    expect(gate).toBe('MISSING');
  });

  // Teste 7: duas reservas parciais completam um requisito
  it('7. duas reservas parciais completam um requisito e viram o gate para RESERVED', async () => {
    const seed = getDemoSeedData(orgId);
    await jobRepo.saveMany(orgId, seed.jobs);

    const { material } = await inventoryService.createMaterial(orgId, {
      sku: 'MAT-PART-01',
      name: 'Material Reserva Parcial',
      category: 'Papéis',
      unit: 'SHEET',
      initialStockMilli: 100000, // 100 fl
      minimumStockMilli: 10000,
      userId: 'u1',
      userName: 'Operador',
    });

    const req = await inventoryService.addRequirement(orgId, {
      productionJobId: 'job-demo-001',
      materialId: material.id,
      requiredQuantityMilli: 100000, // 100 fl necessárias
      userId: 'u1',
      userName: 'Operador',
    });

    // Reserva parcial 1: 40 fl
    await inventoryService.reserveRequirement(orgId, {
      requirementId: req.id,
      quantityMilli: 40000,
      userId: 'u1',
      userName: 'Operador',
    });

    let gate = await inventoryService.deriveJobMaterialGate(orgId, 'job-demo-001');
    expect(gate).toBe('AVAILABLE'); // ainda faltam 60 fl mas há saldo no estoque

    // Reserva parcial 2: 60 fl (completa 100 fl)
    await inventoryService.reserveRequirement(orgId, {
      requirementId: req.id,
      quantityMilli: 60000,
      userId: 'u1',
      userName: 'Operador',
    });

    gate = await inventoryService.deriveJobMaterialGate(orgId, 'job-demo-001');
    expect(gate).toBe('RESERVED');
  });

  // Teste 8: reserva acima do restante necessário é bloqueada
  it('8. reserva acima do restante necessário do requisito é bloqueada', async () => {
    const seed = getDemoSeedData(orgId);
    await jobRepo.saveMany(orgId, seed.jobs);

    const { material } = await inventoryService.createMaterial(orgId, {
      sku: 'MAT-OVER-01',
      name: 'Material Over Reserve',
      category: 'Papéis',
      unit: 'SHEET',
      initialStockMilli: 500000, // 500 fl
      minimumStockMilli: 10000,
      userId: 'u1',
      userName: 'Operador',
    });

    const req = await inventoryService.addRequirement(orgId, {
      productionJobId: 'job-demo-001',
      materialId: material.id,
      requiredQuantityMilli: 50000, // 50 fl
      userId: 'u1',
      userName: 'Operador',
    });

    await inventoryService.reserveRequirement(orgId, {
      requirementId: req.id,
      quantityMilli: 30000, // reservou 30 fl (restam 20 fl)
      userId: 'u1',
      userName: 'Operador',
    });

    // Tentar reservar 30 fl (quando só restam 20 fl necessárias) -> Bloqueia!
    await expect(
      inventoryService.reserveRequirement(orgId, {
        requirementId: req.id,
        quantityMilli: 30000,
        userId: 'u1',
        userName: 'Operador',
      })
    ).rejects.toThrow('excede a necessidade restante do requisito');
  });

  // Teste 9: ACTIVE conta no atendimento do requisito
  it('9. ACTIVE conta no atendimento do requisito', async () => {
    const seed = getDemoSeedData(orgId);
    await jobRepo.saveMany(orgId, seed.jobs);

    const { material } = await inventoryService.createMaterial(orgId, {
      sku: 'MAT-ACT-01',
      name: 'Material Active',
      category: 'Papéis',
      unit: 'SHEET',
      initialStockMilli: 100000,
      minimumStockMilli: 10000,
      userId: 'u1',
      userName: 'Operador',
    });

    const req = await inventoryService.addRequirement(orgId, {
      productionJobId: 'job-demo-001',
      materialId: material.id,
      requiredQuantityMilli: 100000,
      userId: 'u1',
      userName: 'Operador',
    });

    await inventoryService.reserveRequirement(orgId, {
      requirementId: req.id,
      quantityMilli: 100000,
      userId: 'u1',
      userName: 'Operador',
    });

    // Tentativa de reservar mais após 100% atendido
    await expect(
      inventoryService.reserveRequirement(orgId, {
        requirementId: req.id,
        quantityMilli: 1000,
        userId: 'u1',
        userName: 'Operador',
      })
    ).rejects.toThrow('já foi totalmente atendido');
  });

  // Teste 10: CONSUMED conta no atendimento histórico
  it('10. CONSUMED conta no atendimento histórico do requisito', async () => {
    const seed = getDemoSeedData(orgId);
    await jobRepo.saveMany(orgId, seed.jobs);

    const { material } = await inventoryService.createMaterial(orgId, {
      sku: 'MAT-CSM-01',
      name: 'Material Consumed Historical',
      category: 'Papéis',
      unit: 'SHEET',
      initialStockMilli: 100000,
      minimumStockMilli: 10000,
      userId: 'u1',
      userName: 'Operador',
    });

    const req = await inventoryService.addRequirement(orgId, {
      productionJobId: 'job-demo-001',
      materialId: material.id,
      requiredQuantityMilli: 100000,
      userId: 'u1',
      userName: 'Operador',
    });

    const res = await inventoryService.reserveRequirement(orgId, {
      requirementId: req.id,
      quantityMilli: 100000,
      userId: 'u1',
      userName: 'Operador',
    });

    // Consome reserva
    await inventoryService.consumeReservation(orgId, res.id, { id: 'u1', name: 'Operador' });

    // Gate da OP permanece RESERVED (requisito atendido historicamente)
    const gate = await inventoryService.deriveJobMaterialGate(orgId, 'job-demo-001');
    expect(gate).toBe('RESERVED');
  });

  // Teste 11: RELEASED não conta no atendimento
  it('11. RELEASED não conta no atendimento do requisito', async () => {
    const seed = getDemoSeedData(orgId);
    await jobRepo.saveMany(orgId, seed.jobs);

    const { material } = await inventoryService.createMaterial(orgId, {
      sku: 'MAT-RLS-01',
      name: 'Material Released',
      category: 'Papéis',
      unit: 'SHEET',
      initialStockMilli: 100000,
      minimumStockMilli: 10000,
      userId: 'u1',
      userName: 'Operador',
    });

    const req = await inventoryService.addRequirement(orgId, {
      productionJobId: 'job-demo-001',
      materialId: material.id,
      requiredQuantityMilli: 100000,
      userId: 'u1',
      userName: 'Operador',
    });

    const res = await inventoryService.reserveRequirement(orgId, {
      requirementId: req.id,
      quantityMilli: 100000,
      userId: 'u1',
      userName: 'Operador',
    });

    await inventoryService.releaseReservation(orgId, res.id, { id: 'u1', name: 'Operador' });

    // Pode reservar novamente a totalidade pois a reserva anterior foi liberada
    const newRes = await inventoryService.reserveRequirement(orgId, {
      requirementId: req.id,
      quantityMilli: 100000,
      userId: 'u1',
      userName: 'Operador',
    });
    expect(newRes.status).toBe('ACTIVE');
  });

  // Teste 12: consumo não libera falsamente uma necessidade já atendida
  it('12. consumo não libera falsamente uma necessidade já atendida permitindo sobre-reserva', async () => {
    const seed = getDemoSeedData(orgId);
    await jobRepo.saveMany(orgId, seed.jobs);

    const { material } = await inventoryService.createMaterial(orgId, {
      sku: 'MAT-CSM-02',
      name: 'Material Consumed Protection',
      category: 'Papéis',
      unit: 'SHEET',
      initialStockMilli: 200000,
      minimumStockMilli: 10000,
      userId: 'u1',
      userName: 'Operador',
    });

    const req = await inventoryService.addRequirement(orgId, {
      productionJobId: 'job-demo-001',
      materialId: material.id,
      requiredQuantityMilli: 100000,
      userId: 'u1',
      userName: 'Operador',
    });

    const res = await inventoryService.reserveRequirement(orgId, {
      requirementId: req.id,
      quantityMilli: 100000,
      userId: 'u1',
      userName: 'Operador',
    });

    await inventoryService.consumeReservation(orgId, res.id, { id: 'u1', name: 'Operador' });

    // Não pode reservar de novo para o mesmo requisito que já foi atendido por consumo
    await expect(
      inventoryService.reserveRequirement(orgId, {
        requirementId: req.id,
        quantityMilli: 50000,
        userId: 'u1',
        userName: 'Operador',
      })
    ).rejects.toThrow('já foi totalmente atendido');
  });

  // Teste 13: corrupção legada permite entrada para regularização
  it('13. corrupção legada permite entrada (recordReceipt) ou ajuste positivo para regularização', async () => {
    const { material } = await inventoryService.createMaterial(orgId, {
      sku: 'MAT-REG-01',
      name: 'Material para Regularização',
      category: 'Lonas',
      unit: 'SQUARE_METER',
      initialStockMilli: 50000, // 50 m²
      minimumStockMilli: 10000,
      userId: 'u1',
      userName: 'Operador',
    });

    // Injeta reserva de 80 m² (superior ao saldo de 50 m²)
    await resRepo.save(orgId, {
      id: 'res-reg-01',
      organizationId: orgId,
      productionJobId: 'job-any',
      requirementId: 'req-any',
      materialId: material.id,
      reservedQuantityMilli: 80000,
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      userId: 'u1',
      userName: 'Operador',
    });

    // Entrada de 50 m² deve ser permitida e regularizar o saldo físico para 100 m² (> 80 m² reservado)
    const { material: updated } = await inventoryService.recordReceipt(orgId, {
      materialId: material.id,
      quantityMilli: 50000,
      userId: 'u1',
      userName: 'Operador',
    });

    expect(updated.stockOnHandMilli).toBe(100000);

    const avail = await inventoryService.getMaterialAvailability(orgId, material.id);
    expect(avail.availableMilli).toBe(20000); // 100 - 80 = 20 m² livres!
  });

  // Teste 14: quantidades acima de Number.MAX_SAFE_INTEGER são rejeitadas
  it('14. quantidades acima de Number.MAX_SAFE_INTEGER ou não seguras são rejeitadas', async () => {
    const unsafeQty = Number.MAX_SAFE_INTEGER + 1000;

    await expect(
      inventoryService.createMaterial(orgId, {
        sku: 'MAT-UNSAFE-01',
        name: 'Material Inseguro',
        category: 'Outros',
        unit: 'UNIT',
        initialStockMilli: unsafeQty,
        minimumStockMilli: 1000,
        userId: 'u1',
        userName: 'Operador',
      })
    ).rejects.toThrow('número inteiro seguro');
  });

  // Teste 15: valores monetários inseguros são rejeitados
  it('15. valores monetários inseguros ou negativos são rejeitados', async () => {
    await expect(
      inventoryService.createMaterial(orgId, {
        sku: 'MAT-UNSAFE-02',
        name: 'Material Custo Inseguro',
        category: 'Outros',
        unit: 'UNIT',
        minimumStockMilli: 1000,
        unitCostCents: -500,
        userId: 'u1',
        userName: 'Operador',
      })
    ).rejects.toThrow('valor monetário seguro');
  });

  // Teste 16: gate MISSING, AVAILABLE e RESERVED permanece correto com requisitos repetidos
  it('16. gate MISSING, AVAILABLE e RESERVED permanece correto com requisitos repetidos do mesmo material', async () => {
    const seed = getDemoSeedData(orgId);
    await jobRepo.saveMany(orgId, seed.jobs);

    const { material } = await inventoryService.createMaterial(orgId, {
      sku: 'MAT-REP-01',
      name: 'Material Repetido',
      category: 'Papéis',
      unit: 'SHEET',
      initialStockMilli: 100000, // 100 fl
      minimumStockMilli: 10000,
      userId: 'u1',
      userName: 'Operador',
    });

    // Req 1: 50 fl
    const req1 = await inventoryService.addRequirement(orgId, {
      productionJobId: 'job-demo-001',
      materialId: material.id,
      requiredQuantityMilli: 50000,
      userId: 'u1',
      userName: 'Operador',
    });

    // Req 2: 50 fl (mesmo material)
    const req2 = await inventoryService.addRequirement(orgId, {
      productionJobId: 'job-demo-001',
      materialId: material.id,
      requiredQuantityMilli: 50000,
      userId: 'u1',
      userName: 'Operador',
    });

    // Estado inicial: 50 + 50 = 100 fl necessárias, 100 fl no estoque -> AVAILABLE
    let gate = await inventoryService.deriveJobMaterialGate(orgId, 'job-demo-001');
    expect(gate).toBe('AVAILABLE');

    // Reserva 50 fl no Req 1 -> ainda faltam 50 fl no Req 2, estoque disponível = 50 fl -> AVAILABLE
    await inventoryService.reserveRequirement(orgId, {
      requirementId: req1.id,
      quantityMilli: 50000,
      userId: 'u1',
      userName: 'Operador',
    });

    gate = await inventoryService.deriveJobMaterialGate(orgId, 'job-demo-001');
    expect(gate).toBe('AVAILABLE');

    // Reserva 50 fl no Req 2 -> 100% coberto -> RESERVED
    await inventoryService.reserveRequirement(orgId, {
      requirementId: req2.id,
      quantityMilli: 50000,
      userId: 'u1',
      userName: 'Operador',
    });

    gate = await inventoryService.deriveJobMaterialGate(orgId, 'job-demo-001');
    expect(gate).toBe('RESERVED');
  });
});
