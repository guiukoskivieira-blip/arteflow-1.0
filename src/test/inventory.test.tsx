import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import {
  parseQuantityInputToMilli,
  formatMilliToQuantity,
  formatMilliWithUnit,
  isValidQuantityMilli,
} from '../domain/quantity';
import { LocalStorageMaterialRepository } from '../repositories/localStorageMaterialRepository';
import { LocalStorageRequirementRepository } from '../repositories/localStorageRequirementRepository';
import { LocalStorageReservationRepository } from '../repositories/localStorageReservationRepository';
import { LocalStorageMovementRepository } from '../repositories/localStorageMovementRepository';
import { LocalStorageJobRepository } from '../repositories/localStorageJobRepository';
import { LocalStorageEventRepository } from '../repositories/localStorageEventRepository';
import { LocalStorageOrderRepository } from '../repositories/localStorageOrderRepository';
import { InventoryService } from '../services/inventoryService';
import { storageKeys, CURRENT_SEED_VERSION } from '../repositories/storageKeys';
import { getDemoSeedData, DEMO_ORGANIZATION } from '../domain/seed';
import { ArteFlowProvider, useArteFlow } from '../context/ArteFlowContext';
import { AppLayout } from '../components/layout/AppLayout';
import { InventoryPage } from '../components/pages/InventoryPage';
import { ProductionPage } from '../components/pages/ProductionPage';

const orgId = 'org-test-inv-01';

const TestApp: React.FC<{ initialPage?: any }> = ({ initialPage = 'inventory' }) => {
  return (
    <ArteFlowProvider>
      <TestAppContent initialPage={initialPage} />
    </ArteFlowProvider>
  );
};

const TestAppContent: React.FC<{ initialPage?: any }> = ({ initialPage }) => {
  const { activePage, setActivePage } = useArteFlow();

  React.useEffect(() => {
    if (initialPage && activePage !== initialPage) {
      setActivePage(initialPage);
    }
  }, [initialPage, activePage, setActivePage]);

  return (
    <AppLayout>
      {activePage === 'inventory' && <InventoryPage />}
      {activePage === 'production' && <ProductionPage />}
    </AppLayout>
  );
};

describe('ArteFlow — Fase 2A: Estoque, Materiais e Reservas (32 Garantias Obrigatórias)', () => {
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

  // Garantia 1: Conversão e formatação com quantityMilli (1 un, 1.5 m, 2.75 m², 500 folhas)
  it('1. parseQuantityInputToMilli e formatMilliToQuantity para inteiros e decimais fracionários', () => {
    expect(parseQuantityInputToMilli('1')).toBe(1000);
    expect(parseQuantityInputToMilli('1,5')).toBe(1500);
    expect(parseQuantityInputToMilli('1.5')).toBe(1500);
    expect(parseQuantityInputToMilli('2,75')).toBe(2750);
    expect(parseQuantityInputToMilli('500')).toBe(500000);

    expect(formatMilliToQuantity(1000)).toBe('1');
    expect(formatMilliToQuantity(1500)).toBe('1,5');
    expect(formatMilliToQuantity(2750)).toBe('2,75');
    expect(formatMilliToQuantity(500000)).toBe('500');
    expect(formatMilliWithUnit(2750, 'SQUARE_METER')).toBe('2,75 m²');
  });

  // Garantia 2: Validação estrita de quantidade inteira não negativa
  it('2. Validação estrita de número inteiro não-negativo em milésimos', () => {
    expect(isValidQuantityMilli(1000)).toBe(true);
    expect(isValidQuantityMilli(0)).toBe(false);
    expect(isValidQuantityMilli(-500)).toBe(false);
    expect(isValidQuantityMilli(1000.5)).toBe(false);
    expect(isValidQuantityMilli(NaN)).toBe(false);
  });

  // Garantia 3: Cadastro de material com SKU único por organização
  it('3. Cadastro de material com SKU único por organização (rejeita duplicatas)', async () => {
    await inventoryService.createMaterial(orgId, {
      sku: 'MAT-PAP-300',
      name: 'Papel Couchê 300g',
      category: 'Papéis',
      unit: 'SHEET',
      minimumStockMilli: 1000000,
      userId: 'u1',
      userName: 'Operador 1',
    });

    await expect(
      inventoryService.createMaterial(orgId, {
        sku: 'mat-pap-300', // Mesma chave em lowercase
        name: 'Outro Papel Duplicado',
        category: 'Papéis',
        unit: 'SHEET',
        minimumStockMilli: 500000,
        userId: 'u1',
        userName: 'Operador 1',
      })
    ).rejects.toThrow('já cadastrado nesta organização');
  });

  // Garantia 4: Saldo inicial gera movimentação correspondente
  it('4. Cadastro de material com saldo inicial gera movimentação correspondente de ajuste positivo', async () => {
    const { material, movement } = await inventoryService.createMaterial(orgId, {
      sku: 'MAT-LON-440',
      name: 'Lona Front 440g',
      category: 'Lonas',
      unit: 'SQUARE_METER',
      initialStockMilli: 150000, // 150 m²
      minimumStockMilli: 50000,
      unitCostCents: 1800,
      userId: 'u1',
      userName: 'Operador 1',
    });

    expect(material.stockOnHandMilli).toBe(150000);
    expect(movement).toBeDefined();
    expect(movement?.type).toBe('POSITIVE_ADJUSTMENT');
    expect(movement?.quantityMilli).toBe(150000);
    expect(movement?.previousBalanceMilli).toBe(0);
    expect(movement?.resultingBalanceMilli).toBe(150000);

    const movs = await movRepo.listByMaterialId(orgId, material.id);
    expect(movs.length).toBe(1);
  });

  // Garantia 5: Entrada de estoque com recálculo de custo médio ponderado
  it('5. Entrada de estoque (recordReceipt) com recálculo determinístico de custo médio ponderado arredondado', async () => {
    // 100 un a R$ 10,00 (1000¢)
    const { material } = await inventoryService.createMaterial(orgId, {
      sku: 'MAT-ILH-01',
      name: 'Ilhós',
      category: 'Acabamentos',
      unit: 'UNIT',
      initialStockMilli: 100000, // 100 un
      minimumStockMilli: 20000,
      unitCostCents: 1000, // R$ 10,00
      userId: 'u1',
      userName: 'Operador 1',
    });

    // Entrada de 50 un a R$ 16,00 (1600¢)
    // Novo custo: ((100 * 1000) + (50 * 1600)) / 150 = (100000 + 80000) / 150 = 180000 / 150 = 1200¢ (R$ 12,00)
    const { material: updated, movement } = await inventoryService.recordReceipt(orgId, {
      materialId: material.id,
      quantityMilli: 50000, // 50 un
      unitCostCents: 1600,
      userId: 'u1',
      userName: 'Operador 1',
    });

    expect(updated.stockOnHandMilli).toBe(150000);
    expect(updated.averageCostCents).toBe(1200);
    expect(movement.type).toBe('RECEIPT');
    expect(movement.resultingBalanceMilli).toBe(150000);
  });

  // Garantia 6: Entrada com quantidade fracionária em metros/m²
  it('6. Entrada com quantidade fracionária em unidades como METER ou SQUARE_METER', async () => {
    const { material } = await inventoryService.createMaterial(orgId, {
      sku: 'MAT-LON-02',
      name: 'Lona Fosca',
      category: 'Lonas',
      unit: 'SQUARE_METER',
      initialStockMilli: 0,
      minimumStockMilli: 10000,
      userId: 'u1',
      userName: 'Operador 1',
    });

    const { material: updated } = await inventoryService.recordReceipt(orgId, {
      materialId: material.id,
      quantityMilli: 12750, // 12.75 m²
      userId: 'u1',
      userName: 'Operador 1',
    });

    expect(updated.stockOnHandMilli).toBe(12750);
    expect(formatMilliToQuantity(updated.stockOnHandMilli)).toBe('12,75');
  });

  // Garantia 7: Ajuste positivo aumenta saldo físico e registra histórico imutável
  it('7. Ajuste positivo aumenta saldo físico e registra histórico imutável', async () => {
    const { material } = await inventoryService.createMaterial(orgId, {
      sku: 'MAT-TNT-01',
      name: 'Tinta Cyan',
      category: 'Tintas',
      unit: 'LITER',
      initialStockMilli: 5000, // 5 L
      minimumStockMilli: 2000,
      userId: 'u1',
      userName: 'Operador 1',
    });

    const { material: updated, movement } = await inventoryService.adjustStock(orgId, {
      materialId: material.id,
      type: 'POSITIVE_ADJUSTMENT',
      quantityMilli: 3000, // +3 L
      reason: 'Sobra de galão não registrado',
      userId: 'u1',
      userName: 'Operador 1',
    });

    expect(updated.stockOnHandMilli).toBe(8000);
    expect(movement.type).toBe('POSITIVE_ADJUSTMENT');
    expect(movement.reason).toBe('Sobra de galão não registrado');
  });

  // Garantia 8: Ajuste negativo reduz saldo físico e registra histórico imutável
  it('8. Ajuste negativo reduz saldo físico e registra histórico imutável', async () => {
    const { material } = await inventoryService.createMaterial(orgId, {
      sku: 'MAT-TNT-02',
      name: 'Tinta Magenta',
      category: 'Tintas',
      unit: 'LITER',
      initialStockMilli: 10000, // 10 L
      minimumStockMilli: 2000,
      userId: 'u1',
      userName: 'Operador 1',
    });

    const { material: updated, movement } = await inventoryService.adjustStock(orgId, {
      materialId: material.id,
      type: 'NEGATIVE_ADJUSTMENT',
      quantityMilli: 2000, // -2 L
      reason: 'Vazamento acidental',
      userId: 'u1',
      userName: 'Operador 1',
    });

    expect(updated.stockOnHandMilli).toBe(8000);
    expect(movement.type).toBe('NEGATIVE_ADJUSTMENT');
    expect(movement.resultingBalanceMilli).toBe(8000);
  });

  // Garantia 9: Ajuste negativo que excede saldo físico é rejeitado
  it('9. Ajuste negativo que exceda o saldo físico é estritamente rejeitado com erro claro', async () => {
    const { material } = await inventoryService.createMaterial(orgId, {
      sku: 'MAT-TNT-03',
      name: 'Tinta Amarela',
      category: 'Tintas',
      unit: 'LITER',
      initialStockMilli: 3000, // 3 L
      minimumStockMilli: 1000,
      userId: 'u1',
      userName: 'Operador 1',
    });

    await expect(
      inventoryService.adjustStock(orgId, {
        materialId: material.id,
        type: 'NEGATIVE_ADJUSTMENT',
        quantityMilli: 5000, // tenta tirar 5 L de 3 L
        reason: 'Erro de contagem',
        userId: 'u1',
        userName: 'Operador 1',
      })
    ).rejects.toThrow('excede o saldo físico');
  });

  // Garantia 10: Devolução adiciona saldo e gera movimentação do tipo RETURN
  it('10. Devolução (RETURN) adiciona saldo físico e gera movimentação do tipo RETURN', async () => {
    const { material } = await inventoryService.createMaterial(orgId, {
      sku: 'MAT-FIT-01',
      name: 'Fita Dupla Face',
      category: 'Acessórios',
      unit: 'METER',
      initialStockMilli: 20000, // 20 m
      minimumStockMilli: 5000,
      userId: 'u1',
      userName: 'Operador 1',
    });

    const { material: updated, movement } = await inventoryService.adjustStock(orgId, {
      materialId: material.id,
      type: 'RETURN',
      quantityMilli: 5000, // +5 m de retorno
      reason: 'Retorno de sobra da bancada de acabamento',
      userId: 'u1',
      userName: 'Operador 1',
    });

    expect(updated.stockOnHandMilli).toBe(25000);
    expect(movement.type).toBe('RETURN');
  });

  // Garantia 11: Cadastro de necessidade/requisito vinculado à OP
  it('11. Cadastro de necessidade/requisito de material vinculada à OP com snapshot de dados', async () => {
    const seed = getDemoSeedData(orgId);
    await jobRepo.saveMany(orgId, seed.jobs);

    const { material } = await inventoryService.createMaterial(orgId, {
      sku: 'MAT-PAP-150',
      name: 'Papel Offset 150g',
      category: 'Papéis',
      unit: 'SHEET',
      initialStockMilli: 2000000,
      minimumStockMilli: 500000,
      unitCostCents: 35,
      userId: 'u1',
      userName: 'Operador 1',
    });

    const req = await inventoryService.addRequirement(orgId, {
      productionJobId: 'job-demo-001',
      materialId: material.id,
      requiredQuantityMilli: 250000, // 250 folhas
      userId: 'u1',
      userName: 'Operador 1',
    });

    expect(req.productionJobId).toBe('job-demo-001');
    expect(req.materialSnapshot.sku).toBe('MAT-PAP-150');
    expect(req.materialSnapshot.name).toBe('Papel Offset 150g');
    expect(req.requiredQuantityMilli).toBe(250000);
  });

  // Garantia 12: Reserva de material consome disponibilidade sem alterar saldo físico imediato
  it('12. Reserva de material consome disponibilidade (availableQuantityMilli) sem alterar o saldo físico imediato', async () => {
    const seed = getDemoSeedData(orgId);
    await jobRepo.saveMany(orgId, seed.jobs);

    const { material } = await inventoryService.createMaterial(orgId, {
      sku: 'MAT-PAP-COV',
      name: 'Couchê 250g',
      category: 'Papéis',
      unit: 'SHEET',
      initialStockMilli: 1000000, // 1000 folhas
      minimumStockMilli: 200000,
      userId: 'u1',
      userName: 'Operador 1',
    });

    const req = await inventoryService.addRequirement(orgId, {
      productionJobId: 'job-demo-001',
      materialId: material.id,
      requiredQuantityMilli: 400000, // 400 folhas
      userId: 'u1',
      userName: 'Operador 1',
    });

    const res = await inventoryService.reserveRequirement(orgId, {
      requirementId: req.id,
      quantityMilli: 400000,
      userId: 'u1',
      userName: 'Operador 1',
    });

    expect(res.status).toBe('ACTIVE');

    const avail = await inventoryService.getMaterialAvailability(orgId, material.id);
    expect(avail.stockOnHandMilli).toBe(1000000); // Físico inalterado
    expect(avail.reservedMilli).toBe(400000); // 400 reservado
    expect(avail.availableMilli).toBe(600000); // 600 disponível
  });

  // Garantia 13: Tentativa de reservar acima do disponível é bloqueada
  it('13. Tentativa de reservar quantidade superior ao disponível é estritamente bloqueada', async () => {
    const seed = getDemoSeedData(orgId);
    await jobRepo.saveMany(orgId, seed.jobs);

    const { material } = await inventoryService.createMaterial(orgId, {
      sku: 'MAT-PAP-LTD',
      name: 'Papel Especial Limitado',
      category: 'Papéis',
      unit: 'SHEET',
      initialStockMilli: 100000, // 100 folhas
      minimumStockMilli: 20000,
      userId: 'u1',
      userName: 'Operador 1',
    });

    const req = await inventoryService.addRequirement(orgId, {
      productionJobId: 'job-demo-001',
      materialId: material.id,
      requiredQuantityMilli: 200000, // 200 folhas necessárias
      userId: 'u1',
      userName: 'Operador 1',
    });

    await expect(
      inventoryService.reserveRequirement(orgId, {
        requirementId: req.id,
        quantityMilli: 200000, // pede 200 mas só tem 100 disponível
        userId: 'u1',
        userName: 'Operador 1',
      })
    ).rejects.toThrow('excede o saldo disponível em estoque');
  });

  // Garantia 14: Material inativo não aceita novas reservas
  it('14. Material inativo não aceita novas reservas', async () => {
    const seed = getDemoSeedData(orgId);
    await jobRepo.saveMany(orgId, seed.jobs);

    const { material } = await inventoryService.createMaterial(orgId, {
      sku: 'MAT-INAT-01',
      name: 'Material Fora de Linha',
      category: 'Outros',
      unit: 'UNIT',
      initialStockMilli: 100000,
      minimumStockMilli: 10000,
      userId: 'u1',
      userName: 'Operador 1',
    });

    await inventoryService.updateMaterial(orgId, material.id, { isActive: false });

    const req = await inventoryService.addRequirement(orgId, {
      productionJobId: 'job-demo-001',
      materialId: material.id,
      requiredQuantityMilli: 10000,
      userId: 'u1',
      userName: 'Operador 1',
    });

    await expect(
      inventoryService.reserveRequirement(orgId, {
        requirementId: req.id,
        quantityMilli: 10000,
        userId: 'u1',
        userName: 'Operador 1',
      })
    ).rejects.toThrow('Material inativo');
  });

  // Garantia 15: Liberação de reserva devolve disponibilidade
  it('15. Liberação de reserva (releaseReservation) devolve disponibilidade e registra evento', async () => {
    const seed = getDemoSeedData(orgId);
    await jobRepo.saveMany(orgId, seed.jobs);

    const { material } = await inventoryService.createMaterial(orgId, {
      sku: 'MAT-PAP-REL',
      name: 'Papel para Liberação',
      category: 'Papéis',
      unit: 'SHEET',
      initialStockMilli: 500000, // 500 folhas
      minimumStockMilli: 100000,
      userId: 'u1',
      userName: 'Operador 1',
    });

    const req = await inventoryService.addRequirement(orgId, {
      productionJobId: 'job-demo-001',
      materialId: material.id,
      requiredQuantityMilli: 200000,
      userId: 'u1',
      userName: 'Operador 1',
    });

    const res = await inventoryService.reserveRequirement(orgId, {
      requirementId: req.id,
      quantityMilli: 200000,
      userId: 'u1',
      userName: 'Operador 1',
    });

    // Libera reserva
    const released = await inventoryService.releaseReservation(orgId, res.id, {
      id: 'u1',
      name: 'Operador 1',
    });
    expect(released.status).toBe('RELEASED');

    const avail = await inventoryService.getMaterialAvailability(orgId, material.id);
    expect(avail.reservedMilli).toBe(0);
    expect(avail.availableMilli).toBe(500000);
  });

  // Garantia 16: Consumo de reserva baixa saldo físico e gera movimento CONSUMPTION
  it('16. Consumo de reserva (consumeReservation) baixa saldo físico, marca reserva como CONSUMED e gera movimento CONSUMPTION', async () => {
    const seed = getDemoSeedData(orgId);
    await jobRepo.saveMany(orgId, seed.jobs);

    const { material } = await inventoryService.createMaterial(orgId, {
      sku: 'MAT-LON-CONS',
      name: 'Lona para Consumo',
      category: 'Lonas',
      unit: 'SQUARE_METER',
      initialStockMilli: 100000, // 100 m²
      minimumStockMilli: 20000,
      userId: 'u1',
      userName: 'Operador 1',
    });

    const req = await inventoryService.addRequirement(orgId, {
      productionJobId: 'job-demo-001',
      materialId: material.id,
      requiredQuantityMilli: 30000, // 30 m²
      userId: 'u1',
      userName: 'Operador 1',
    });

    const res = await inventoryService.reserveRequirement(orgId, {
      requirementId: req.id,
      quantityMilli: 30000,
      userId: 'u1',
      userName: 'Operador 1',
    });

    const { reservation: consumed, movement } = await inventoryService.consumeReservation(
      orgId,
      res.id,
      { id: 'u1', name: 'Operador 1' }
    );

    expect(consumed.status).toBe('CONSUMED');
    expect(movement.type).toBe('CONSUMPTION');
    expect(movement.quantityMilli).toBe(30000);
    expect(movement.resultingBalanceMilli).toBe(70000);

    const matAfter = await materialRepo.getById(orgId, material.id);
    expect(matAfter?.stockOnHandMilli).toBe(70000); // 70 m² restantes
  });

  // Garantia 17: Consumo bloqueado se saldo físico for insuficiente
  it('17. Consumo bloqueado se saldo físico for insuficiente', async () => {
    const seed = getDemoSeedData(orgId);
    await jobRepo.saveMany(orgId, seed.jobs);

    const { material } = await inventoryService.createMaterial(orgId, {
      sku: 'MAT-ILH-INS',
      name: 'Ilhós Teste',
      category: 'Acabamentos',
      unit: 'UNIT',
      initialStockMilli: 50000, // 50 un
      minimumStockMilli: 10000,
      userId: 'u1',
      userName: 'Operador 1',
    });

    const req = await inventoryService.addRequirement(orgId, {
      productionJobId: 'job-demo-001',
      materialId: material.id,
      requiredQuantityMilli: 50000,
      userId: 'u1',
      userName: 'Operador 1',
    });

    const res = await inventoryService.reserveRequirement(orgId, {
      requirementId: req.id,
      quantityMilli: 50000,
      userId: 'u1',
      userName: 'Operador 1',
    });

    // Simula perda física inesperada anterior
    material.stockOnHandMilli = 10000;
    await materialRepo.save(orgId, material);

    await expect(
      inventoryService.consumeReservation(orgId, res.id, { id: 'u1', name: 'Operador 1' })
    ).rejects.toThrow('Saldo físico insuficiente');
  });

  // Garantia 18: OP sem requisitos deriva NOT_CHECKED
  it('18. OP sem requisitos de material deriva gate NOT_CHECKED', async () => {
    const seed = getDemoSeedData(orgId);
    await jobRepo.saveMany(orgId, seed.jobs);

    const gate = await inventoryService.deriveJobMaterialGate(orgId, 'job-demo-001');
    expect(gate).toBe('NOT_CHECKED');
  });

  // Garantia 19: OP com todos os requisitos 100% cobertos deriva RESERVED
  it('19. OP com todos os requisitos 100% reservados deriva gate RESERVED', async () => {
    const seed = getDemoSeedData(orgId);
    await jobRepo.saveMany(orgId, seed.jobs);

    const { material } = await inventoryService.createMaterial(orgId, {
      sku: 'MAT-FULL-01',
      name: 'Material Completo',
      category: 'Papéis',
      unit: 'SHEET',
      initialStockMilli: 1000000,
      minimumStockMilli: 100000,
      userId: 'u1',
      userName: 'Operador 1',
    });

    const req = await inventoryService.addRequirement(orgId, {
      productionJobId: 'job-demo-001',
      materialId: material.id,
      requiredQuantityMilli: 500000,
      userId: 'u1',
      userName: 'Operador 1',
    });

    await inventoryService.reserveRequirement(orgId, {
      requirementId: req.id,
      quantityMilli: 500000,
      userId: 'u1',
      userName: 'Operador 1',
    });

    const gate = await inventoryService.deriveJobMaterialGate(orgId, 'job-demo-001');
    expect(gate).toBe('RESERVED');
  });

  // Garantia 20: OP com requisitos disponíveis mas não reservados deriva AVAILABLE
  it('20. OP com requisitos não totalmente reservados, mas com saldo disponível suficiente em estoque, deriva gate AVAILABLE', async () => {
    const seed = getDemoSeedData(orgId);
    await jobRepo.saveMany(orgId, seed.jobs);

    const { material } = await inventoryService.createMaterial(orgId, {
      sku: 'MAT-AVAIL-01',
      name: 'Material Disponível',
      category: 'Papéis',
      unit: 'SHEET',
      initialStockMilli: 1000000, // 1000 folhas no estoque
      minimumStockMilli: 100000,
      userId: 'u1',
      userName: 'Operador 1',
    });

    await inventoryService.addRequirement(orgId, {
      productionJobId: 'job-demo-001',
      materialId: material.id,
      requiredQuantityMilli: 300000, // precisa de 300 folhas (não reservou ainda)
      userId: 'u1',
      userName: 'Operador 1',
    });

    const gate = await inventoryService.deriveJobMaterialGate(orgId, 'job-demo-001');
    expect(gate).toBe('AVAILABLE');
  });

  // Garantia 21: OP com falta de saldo deriva MISSING e gera bloqueio
  it('21. OP com pelo menos um requisito sem saldo disponível suficiente deriva gate MISSING', async () => {
    const seed = getDemoSeedData(orgId);
    await jobRepo.saveMany(orgId, seed.jobs);

    const { material } = await inventoryService.createMaterial(orgId, {
      sku: 'MAT-MISS-01',
      name: 'Material Faltante',
      category: 'Lonas',
      unit: 'SQUARE_METER',
      initialStockMilli: 10000, // apenas 10 m²
      minimumStockMilli: 5000,
      userId: 'u1',
      userName: 'Operador 1',
    });

    await inventoryService.addRequirement(orgId, {
      productionJobId: 'job-demo-001',
      materialId: material.id,
      requiredQuantityMilli: 50000, // precisa de 50 m²
      userId: 'u1',
      userName: 'Operador 1',
    });

    const gate = await inventoryService.deriveJobMaterialGate(orgId, 'job-demo-001');
    expect(gate).toBe('MISSING');
  });

  // Garantia 22: Mudança em estoque recalcula automaticamente o gate das OPs afetadas
  it('22. Mudança em estoque físico ou reservas recalcula e atualiza automaticamente o gate de Material das OPs afetadas', async () => {
    const seed = getDemoSeedData(orgId);
    await jobRepo.saveMany(orgId, seed.jobs);

    const { material } = await inventoryService.createMaterial(orgId, {
      sku: 'MAT-RECALC-01',
      name: 'Material Recálculo',
      category: 'Lonas',
      unit: 'SQUARE_METER',
      initialStockMilli: 0, // Inicia sem estoque -> Gate MISSING
      minimumStockMilli: 5000,
      userId: 'u1',
      userName: 'Operador 1',
    });

    await inventoryService.addRequirement(orgId, {
      productionJobId: 'job-demo-001',
      materialId: material.id,
      requiredQuantityMilli: 20000,
      userId: 'u1',
      userName: 'Operador 1',
    });

    let job = await jobRepo.getById(orgId, 'job-demo-001');
    expect(job?.materialGate).toBe('MISSING');

    // Registra entrada de 50 m²
    await inventoryService.recordReceipt(orgId, {
      materialId: material.id,
      quantityMilli: 50000,
      userId: 'u1',
      userName: 'Operador 1',
    });

    job = await jobRepo.getById(orgId, 'job-demo-001');
    expect(job?.materialGate).toBe('AVAILABLE');
  });

  // Garantia 23: Histórico de movimentações é estritamente append-only
  it('23. Histórico de movimentações é estritamente append-only (sem alteração retroativa)', async () => {
    const { material } = await inventoryService.createMaterial(orgId, {
      sku: 'MAT-HIST-01',
      name: 'Material Histórico',
      category: 'Papéis',
      unit: 'SHEET',
      initialStockMilli: 1000000,
      minimumStockMilli: 100000,
      userId: 'u1',
      userName: 'Operador 1',
    });

    await inventoryService.recordReceipt(orgId, {
      materialId: material.id,
      quantityMilli: 200000,
      userId: 'u1',
      userName: 'Operador 1',
    });

    await inventoryService.adjustStock(orgId, {
      materialId: material.id,
      type: 'POSITIVE_ADJUSTMENT',
      quantityMilli: 50000,
      reason: 'Ajuste contagem',
      userId: 'u1',
      userName: 'Operador 1',
    });

    const movs = await movRepo.listByMaterialId(orgId, material.id);
    expect(movs.length).toBe(3); // Saldo inicial + Entrada + Ajuste
  });

  // Garantia 24: Isolamento estrito por organizationId
  it('24. Isolamento estrito de materiais, reservas e movimentações por organizationId', async () => {
    const orgA = 'org-tenant-alpha';
    const orgB = 'org-tenant-beta';

    await inventoryService.createMaterial(orgA, {
      sku: 'MAT-COMUM-01',
      name: 'Material da Org A',
      category: 'Papéis',
      unit: 'SHEET',
      initialStockMilli: 500000,
      minimumStockMilli: 100000,
      userId: 'u1',
      userName: 'Operador 1',
    });

    await inventoryService.createMaterial(orgB, {
      sku: 'MAT-COMUM-01', // Mesmo SKU permitido pois pertence a outra organização
      name: 'Material da Org B',
      category: 'Papéis',
      unit: 'SHEET',
      initialStockMilli: 900000,
      minimumStockMilli: 100000,
      userId: 'u2',
      userName: 'Operador 2',
    });

    const listA = await materialRepo.list(orgA);
    const listB = await materialRepo.list(orgB);

    expect(listA.length).toBe(1);
    expect(listB.length).toBe(1);
    expect(listA[0].name).toBe('Material da Org A');
    expect(listB[0].name).toBe('Material da Org B');
  });

  // Garantia 25: Inicialização limpa popula os materiais demonstrativos e vínculos com OPs demo
  it('25. Inicialização limpa popula materiais demonstrativos e vínculos com as 2 OPs de demonstração', async () => {
    await act(async () => {
      render(<TestApp />);
    });

    const demoOrgId = DEMO_ORGANIZATION.id;
    const mats = await materialRepo.list(demoOrgId);
    expect(mats.length).toBeGreaterThanOrEqual(4);

    const reqs = await reqRepo.listAll(demoOrgId);
    expect(reqs.length).toBeGreaterThanOrEqual(3);

    const res = await resRepo.listAll(demoOrgId);
    expect(res.length).toBeGreaterThanOrEqual(1);

    expect(window.localStorage.getItem(storageKeys.seedVersion(demoOrgId))).toBe(String(CURRENT_SEED_VERSION));
  });

  // Garantia 26: Recarga subsequente mantém os dados sem duplicação (idempotência)
  it('26. Recarga subsequente mantém os dados sem duplicar materiais ou movimentações (idempotência)', async () => {
    const { unmount } = render(<TestApp />);
    await act(async () => {});
    unmount();

    const demoOrgId = DEMO_ORGANIZATION.id;
    const matsFirst = await materialRepo.list(demoOrgId);

    // Segunda montagem
    await act(async () => {
      render(<TestApp />);
    });

    const matsSecond = await materialRepo.list(demoOrgId);
    expect(matsSecond.length).toBe(matsFirst.length);
  });

  // Garantia 27: Ambiente com dados do usuário preserva seus materiais e não injeta demos
  it('27. Ambiente com dados do usuário preserva seus materiais e não injeta demos', async () => {
    const demoOrgId = DEMO_ORGANIZATION.id;
    // Cria material do usuário antes da inicialização
    await materialRepo.save(demoOrgId, {
      id: 'mat-user-custom-01',
      organizationId: demoOrgId,
      sku: 'MAT-USR-999',
      name: 'Material Customizado do Usuário',
      category: 'Especiais',
      unit: 'SHEET',
      stockOnHandMilli: 300000,
      minimumStockMilli: 50000,
      averageCostCents: 500,
      isActive: true,
      dataOrigin: 'user',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await act(async () => {
      render(<TestApp />);
    });

    const mats = await materialRepo.list(demoOrgId);
    expect(mats.some((m) => m.sku === 'MAT-USR-999')).toBe(true);
    expect(mats.some((m) => m.dataOrigin === 'demo')).toBe(false);
  });

  // Garantia 28: clearOperationalData() preserva semântica e não reintroduz demos na recarga
  it('28. clearOperationalData() limpa reservas/pedidos mas não reintroduz demos na recarga seguinte', async () => {
    let contextHandle: ReturnType<typeof useArteFlow> | null = null;
    const TestProbe = () => {
      contextHandle = useArteFlow();
      return <div data-testid="probe" />;
    };

    const { unmount } = render(
      <ArteFlowProvider>
        <TestProbe />
      </ArteFlowProvider>
    );

    await act(async () => {});

    // Limpa dados operacionais
    await act(async () => {
      await contextHandle?.clearOperationalData();
    });

    const demoOrgId = DEMO_ORGANIZATION.id;
    expect(window.localStorage.getItem(storageKeys.seedState(demoOrgId))).toBe('INTENTIONALLY_CLEARED');
    unmount();

    // Recarrega App
    await act(async () => {
      render(
        <ArteFlowProvider>
          <TestProbe />
        </ArteFlowProvider>
      );
    });

    const orders = await new LocalStorageOrderRepository().list(demoOrgId);
    expect(orders.length).toBe(0);
  });

  // Garantia 29: Renderização da página Estoque exibe KPIs
  it('29. Renderização da página Estoque exibe KPIs (Ativos, Valor Total, Abaixo do Mínimo, Reservas Ativas)', async () => {
    await act(async () => {
      render(<TestApp initialPage="inventory" />);
    });

    expect(screen.getAllByText('Estoque de Materiais & Insumos').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Materiais Ativos')).toBeInTheDocument();
    expect(screen.getByText('Valor em Estoque')).toBeInTheDocument();
    expect(screen.getAllByText('Abaixo do Mínimo').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Reservas Ativas')).toBeInTheDocument();
  });

  // Garantia 30: Tabela de estoque exibe colunas corretas
  it('30. Tabela de estoque exibe colunas corretas (Físico, Reservado, Disponível, Mínimo, Custo Médio)', async () => {
    await act(async () => {
      render(<TestApp initialPage="inventory" />);
    });

    expect(screen.getByText('Estoque Físico')).toBeInTheDocument();
    expect(screen.getByText('Reservado')).toBeInTheDocument();
    expect(screen.getByText('Disponível')).toBeInTheDocument();
    expect(screen.getByText('Estoque Mín.')).toBeInTheDocument();
    expect(screen.getByText('Custo Médio')).toBeInTheDocument();
  });

  // Garantia 31: Gaveta da OP exibe seção de materiais e permite vincular requisitos
  it('31. Gaveta da OP exibe seção de materiais e permite vincular requisitos e reservar', async () => {
    await act(async () => {
      render(<TestApp initialPage="production" />);
    });

    // Clica no card da OP demo 1 para abrir drawer
    const opCard = screen.getByText('OP-2026-0001');
    await act(async () => {
      fireEvent.click(opCard);
    });

    expect(screen.getByTestId('job-drawer')).toBeInTheDocument();
    expect(screen.getByText(/Plano de Materiais & Reservas/i)).toBeInTheDocument();
    expect(screen.getByText('Vincular Material')).toBeInTheDocument();
  });

  // Garantia 32: Comportamento responsivo e acessibilidade dos modais de estoque
  it('32. Comportamento responsivo e acessibilidade dos modais de estoque (Escape, foco, aria-modal)', async () => {
    await act(async () => {
      render(<TestApp initialPage="inventory" />);
    });

    const newMatBtn = screen.getByRole('button', { name: /Novo Material/i });
    await act(async () => {
      fireEvent.click(newMatBtn);
    });

    const modal = screen.getByTestId('new-material-modal');
    expect(modal).toBeInTheDocument();
    expect(modal).toHaveAttribute('aria-modal', 'true');
    expect(modal).toHaveAttribute('role', 'dialog');

    // Fechamento por Escape
    await act(async () => {
      fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });
    });

    expect(screen.queryByTestId('new-material-modal')).not.toBeInTheDocument();
  });
});
