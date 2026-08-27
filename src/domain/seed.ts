import {
  Organization,
  Order,
  OrderItem,
  ProductionJob,
  WorkflowStage,
  ProductionEvent,
} from '../types/domain';
import {
  InventoryMaterial,
  ProductionMaterialRequirement,
  StockReservation,
  StockMovement,
} from '../types/inventory';
import { DEFAULT_ORGANIZATION_ID, INITIAL_WORKFLOW_STAGES, DEMO_USERS } from './constants';

export const DEMO_ORGANIZATION: Organization = {
  id: DEFAULT_ORGANIZATION_ID,
  name: 'Gráfica & Visual Express (Demo)',
  document: '18.992.341/0001-85',
  segment: 'COMUNICACAO_VISUAL',
  createdAt: '2026-01-15T08:00:00.000Z',
};

export function getInitialStages(organizationId: string = DEFAULT_ORGANIZATION_ID): WorkflowStage[] {
  return INITIAL_WORKFLOW_STAGES.map((s) => ({
    ...s,
    organizationId,
  }));
}

export function getDemoSeedData(organizationId: string = DEFAULT_ORGANIZATION_ID) {
  const now = new Date('2026-08-27T10:00:00.000Z');
  const nowISO = now.toISOString();

  const deadlineJob1 = new Date(now);
  deadlineJob1.setDate(deadlineJob1.getDate() + 2);

  const deadlineJob2 = new Date(now);
  deadlineJob2.setDate(deadlineJob2.getDate() + 4);

  const orderId = 'order-demo-001';
  const orderNumber = 'PED-2026-0001';

  const item1Id = 'item-demo-001';
  const item2Id = 'item-demo-002';

  const job1Id = 'job-demo-001';
  const job2Id = 'job-demo-002';

  const customer = {
    id: 'cust-demo-001',
    name: 'Studio Design Alfa Ltda',
    document: '12.345.678/0001-90',
    email: 'contato@studiodesignalfa.com.br',
    phone: '(11) 98765-4321',
    contactPerson: 'Renata Albuquerque',
  };

  const item1: OrderItem = {
    id: item1Id,
    orderId,
    productName: 'Cartão de Visita 4x4 Couché 300g',
    category: 'Papelaria Institucional',
    sector: 'Impressão Digital',
    dimensions: {
      width: 90,
      height: 50,
      unit: 'mm',
    },
    quantity: 1000,
    unit: 'un',
    unitPriceCents: 12, // R$ 0,12 unitário
    totalPriceCents: 12000, // R$ 120,00
    finishings: ['Laminação Fosca Bopp', 'Verniz Localizado Frente'],
    technicalNotes: 'Sangria de 2mm em todos os lados. Margem de segurança de 3mm.',
    generatedJobId: job1Id,
    dataOrigin: 'demo',
  };

  const item2: OrderItem = {
    id: item2Id,
    orderId,
    productName: 'Banner Lona 440g c/ Ilhós e Bainha',
    category: 'Comunicação Visual',
    sector: 'Comunicação Visual',
    dimensions: {
      width: 100,
      height: 150,
      unit: 'cm',
    },
    quantity: 2,
    unit: 'un',
    unitPriceCents: 9500, // R$ 95,00 unitário
    totalPriceCents: 19000, // R$ 190,00
    finishings: ['Ilhós Reforçado a cada 30cm', 'Bainha Soldada Alta Resistência'],
    technicalNotes: 'Impressão solvente alta definição 1200 dpi para uso externo.',
    generatedJobId: job2Id,
    dataOrigin: 'demo',
  };

  const order: Order = {
    id: orderId,
    orderNumber,
    organizationId,
    origin: 'MANUAL',
    customer,
    items: [item1, item2],
    totalAmountCents: 31000, // R$ 310,00
    status: 'IN_PRODUCTION',
    notes: 'Cliente solicitou conferência rigorosa de cor no logotipo Pantone 286C.',
    deliveryDateISO: deadlineJob2.toISOString(),
    createdAt: '2026-08-25T14:30:00.000Z',
    updatedAt: nowISO,
    dataOrigin: 'demo',
  };

  const job1: ProductionJob = {
    id: job1Id,
    jobCode: 'OP-2026-0001',
    orderId,
    orderNumber,
    orderItemId: item1Id,
    organizationId,
    customer,
    productName: item1.productName,
    dimensions: item1.dimensions,
    quantity: item1.quantity,
    unit: item1.unit,
    finishings: item1.finishings,
    technicalNotes: item1.technicalNotes,
    stageId: 'stage-prepress', // Pré-impressão
    artworkGate: 'APPROVED',
    materialGate: 'RESERVED', // Totalmente reservado
    financialGate: 'RELEASED',
    priority: 'HIGH',
    sector: item1.sector,
    assignee: {
      id: DEMO_USERS[1].id,
      name: DEMO_USERS[1].name,
      email: DEMO_USERS[1].email,
    },
    deadlineISO: deadlineJob1.toISOString(),
    createdAt: '2026-08-25T14:30:00.000Z',
    updatedAt: nowISO,
    dataOrigin: 'demo',
  };

  const job2: ProductionJob = {
    id: job2Id,
    jobCode: 'OP-2026-0002',
    orderId,
    orderNumber,
    orderItemId: item2Id,
    organizationId,
    customer,
    productName: item2.productName,
    dimensions: item2.dimensions,
    quantity: item2.quantity,
    unit: item2.unit,
    finishings: item2.finishings,
    technicalNotes: item2.technicalNotes,
    stageId: 'stage-awaiting-material', // Aguardando material
    artworkGate: 'APPROVED',
    materialGate: 'MISSING', // Bloqueia OP por falta de fita dupla face!
    financialGate: 'DEPOSIT_PENDING',
    priority: 'MEDIUM',
    sector: item2.sector,
    assignee: {
      id: DEMO_USERS[2].id,
      name: DEMO_USERS[2].name,
      email: DEMO_USERS[2].email,
    },
    deadlineISO: deadlineJob2.toISOString(),
    createdAt: '2026-08-25T14:30:00.000Z',
    updatedAt: nowISO,
    dataOrigin: 'demo',
  };

  // Materiais Demonstrativos (Fase 2A)
  const mat1: InventoryMaterial = {
    id: 'mat-demo-1',
    organizationId,
    sku: 'MAT-PAP-300',
    name: 'Papel Couchê 300g Brilho 66x96cm',
    category: 'Papéis & Cartões',
    unit: 'SHEET',
    stockOnHandMilli: 5000000, // 5000 folhas
    minimumStockMilli: 1000000, // 1000 folhas
    averageCostCents: 45, // R$ 0,45 / folha
    supplierName: 'Distribuidora Papéis Brasil',
    isActive: true,
    dataOrigin: 'demo',
    createdAt: '2026-08-20T08:00:00.000Z',
    updatedAt: nowISO,
  };

  const mat2: InventoryMaterial = {
    id: 'mat-demo-2',
    organizationId,
    sku: 'MAT-LON-440',
    name: 'Lona Frontlight 440g Fosca 3,20m',
    category: 'Lonas & Banners',
    unit: 'SQUARE_METER',
    stockOnHandMilli: 150000, // 150 m²
    minimumStockMilli: 50000, // 50 m²
    averageCostCents: 1800, // R$ 18,00 / m²
    supplierName: 'Suprimentos Visuais SA',
    isActive: true,
    dataOrigin: 'demo',
    createdAt: '2026-08-20T08:00:00.000Z',
    updatedAt: nowISO,
  };

  const mat3: InventoryMaterial = {
    id: 'mat-demo-3',
    organizationId,
    sku: 'MAT-TNT-ECO',
    name: 'Tinta Eco Solvente Cyan Ultra',
    category: 'Tintas & Solventes',
    unit: 'LITER',
    stockOnHandMilli: 8000, // 8 L
    minimumStockMilli: 5000, // 5 L
    averageCostCents: 12000, // R$ 120,00 / L
    supplierName: 'Colors Digital Inks',
    isActive: true,
    dataOrigin: 'demo',
    createdAt: '2026-08-20T08:00:00.000Z',
    updatedAt: nowISO,
  };

  const mat4: InventoryMaterial = {
    id: 'mat-demo-4',
    organizationId,
    sku: 'MAT-ILH-054',
    name: 'Ilhós Metálico N° 54 Niquelado',
    category: 'Acabamentos & Acessórios',
    unit: 'UNIT',
    stockOnHandMilli: 2000000, // 2000 un
    minimumStockMilli: 500000, // 500 un
    averageCostCents: 15, // R$ 0,15 / un
    supplierName: 'Ferragens & Rebites Central',
    isActive: true,
    dataOrigin: 'demo',
    createdAt: '2026-08-20T08:00:00.000Z',
    updatedAt: nowISO,
  };

  const mat5: InventoryMaterial = {
    id: 'mat-demo-5',
    organizationId,
    sku: 'MAT-FIT-001',
    name: 'Fita Dupla Face Alta Fixação 19mm',
    category: 'Acabamentos & Acessórios',
    unit: 'METER',
    stockOnHandMilli: 0, // 0 m — Esgotado / Em Falta!
    minimumStockMilli: 50000, // 50 m
    averageCostCents: 250, // R$ 2,50 / m
    supplierName: 'Adesivos & Fitas Express',
    isActive: true,
    dataOrigin: 'demo',
    createdAt: '2026-08-20T08:00:00.000Z',
    updatedAt: nowISO,
  };

  const materials: InventoryMaterial[] = [mat1, mat2, mat3, mat4, mat5];

  // Requisitos vinculados às OPs
  const req1: ProductionMaterialRequirement = {
    id: 'req-demo-001',
    organizationId,
    productionJobId: job1Id,
    materialId: mat1.id,
    materialSnapshot: {
      sku: mat1.sku,
      name: mat1.name,
      unit: mat1.unit,
      averageCostCents: mat1.averageCostCents,
    },
    requiredQuantityMilli: 500000, // 500 folhas
    createdAt: '2026-08-25T14:30:00.000Z',
    dataOrigin: 'demo',
  };

  const req2: ProductionMaterialRequirement = {
    id: 'req-demo-002',
    organizationId,
    productionJobId: job2Id,
    materialId: mat2.id,
    materialSnapshot: {
      sku: mat2.sku,
      name: mat2.name,
      unit: mat2.unit,
      averageCostCents: mat2.averageCostCents,
    },
    requiredQuantityMilli: 3000, // 3 m²
    createdAt: '2026-08-25T14:30:00.000Z',
    dataOrigin: 'demo',
  };

  const req3: ProductionMaterialRequirement = {
    id: 'req-demo-003',
    organizationId,
    productionJobId: job2Id,
    materialId: mat4.id,
    materialSnapshot: {
      sku: mat4.sku,
      name: mat4.name,
      unit: mat4.unit,
      averageCostCents: mat4.averageCostCents,
    },
    requiredQuantityMilli: 12000, // 12 un
    createdAt: '2026-08-25T14:30:00.000Z',
    dataOrigin: 'demo',
  };

  const req4: ProductionMaterialRequirement = {
    id: 'req-demo-004',
    organizationId,
    productionJobId: job2Id,
    materialId: mat5.id,
    materialSnapshot: {
      sku: mat5.sku,
      name: mat5.name,
      unit: mat5.unit,
      averageCostCents: mat5.averageCostCents,
    },
    requiredQuantityMilli: 5000, // 5 m (Fita em falta)
    createdAt: '2026-08-25T14:30:00.000Z',
    dataOrigin: 'demo',
  };

  const requirements: ProductionMaterialRequirement[] = [req1, req2, req3, req4];

  // Reserva ativa para OP 1
  const res1: StockReservation = {
    id: 'res-demo-001',
    organizationId,
    productionJobId: job1Id,
    requirementId: req1.id,
    materialId: mat1.id,
    reservedQuantityMilli: 500000, // 500 folhas
    status: 'ACTIVE',
    createdAt: '2026-08-25T15:00:00.000Z',
    updatedAt: '2026-08-25T15:00:00.000Z',
    userId: DEMO_USERS[1].id,
    userName: DEMO_USERS[1].name,
  };

  const reservations: StockReservation[] = [res1];

  // Movimentações iniciais de estoque
  const movements: StockMovement[] = [
    {
      id: 'mov-demo-001',
      organizationId,
      materialId: mat1.id,
      type: 'RECEIPT',
      quantityMilli: 5000000,
      previousBalanceMilli: 0,
      resultingBalanceMilli: 5000000,
      unitCostCents: 45,
      totalCostCents: 225000,
      reason: 'Entrada de compra NF-e 4492',
      createdAt: '2026-08-20T08:00:00.000Z',
      userId: DEMO_USERS[0].id,
      userName: DEMO_USERS[0].name,
      dataOrigin: 'demo',
    },
    {
      id: 'mov-demo-002',
      organizationId,
      materialId: mat2.id,
      type: 'RECEIPT',
      quantityMilli: 150000,
      previousBalanceMilli: 0,
      resultingBalanceMilli: 150000,
      unitCostCents: 1800,
      totalCostCents: 270000,
      reason: 'Entrada de compra NF-e 4495',
      createdAt: '2026-08-20T08:30:00.000Z',
      userId: DEMO_USERS[0].id,
      userName: DEMO_USERS[0].name,
      dataOrigin: 'demo',
    },
    {
      id: 'mov-demo-003',
      organizationId,
      materialId: mat3.id,
      type: 'RECEIPT',
      quantityMilli: 8000,
      previousBalanceMilli: 0,
      resultingBalanceMilli: 8000,
      unitCostCents: 12000,
      totalCostCents: 96000,
      reason: 'Entrada de reposição de tintas',
      createdAt: '2026-08-20T09:00:00.000Z',
      userId: DEMO_USERS[0].id,
      userName: DEMO_USERS[0].name,
      dataOrigin: 'demo',
    },
    {
      id: 'mov-demo-004',
      organizationId,
      materialId: mat4.id,
      type: 'RECEIPT',
      quantityMilli: 2000000,
      previousBalanceMilli: 0,
      resultingBalanceMilli: 2000000,
      unitCostCents: 15,
      totalCostCents: 30000,
      reason: 'Entrada pacote fechado ilhoses',
      createdAt: '2026-08-20T09:30:00.000Z',
      userId: DEMO_USERS[0].id,
      userName: DEMO_USERS[0].name,
      dataOrigin: 'demo',
    },
  ];

  const events: ProductionEvent[] = [
    {
      id: 'evt-demo-1',
      jobId: job1Id,
      organizationId,
      eventType: 'JOB_CREATED',
      toValue: 'stage-entry',
      description: 'Ordem de Produção gerada a partir do item 1 do Pedido PED-2026-0001',
      authorId: 'user-system',
      authorName: 'Sistema ArteFlow',
      timestamp: '2026-08-25T14:30:00.000Z',
      dataOrigin: 'demo',
    },
    {
      id: 'evt-demo-2',
      jobId: job1Id,
      organizationId,
      eventType: 'STAGE_CHANGED',
      fromValue: 'stage-entry',
      toValue: 'stage-prepress',
      description: 'OP movida de Entrada para Pré-impressão',
      authorId: DEMO_USERS[1].id,
      authorName: DEMO_USERS[1].name,
      timestamp: '2026-08-26T09:15:00.000Z',
      dataOrigin: 'demo',
    },
    {
      id: 'evt-demo-3',
      jobId: job1Id,
      organizationId,
      eventType: 'ARTWORK_GATE_CHANGED',
      fromValue: 'PENDING_REVIEW',
      toValue: 'APPROVED',
      description: 'Arte técnica inspecionada e aprovada pelo cliente',
      authorId: DEMO_USERS[1].id,
      authorName: DEMO_USERS[1].name,
      timestamp: '2026-08-26T11:00:00.000Z',
      dataOrigin: 'demo',
    },
    {
      id: 'evt-demo-3b',
      jobId: job1Id,
      organizationId,
      eventType: 'MATERIAL_RESERVED',
      description: 'Reserva realizada: 500 fl de Papel Couchê 300g',
      authorId: DEMO_USERS[1].id,
      authorName: DEMO_USERS[1].name,
      timestamp: '2026-08-26T11:30:00.000Z',
      dataOrigin: 'demo',
    },
    {
      id: 'evt-demo-4',
      jobId: job2Id,
      organizationId,
      eventType: 'JOB_CREATED',
      toValue: 'stage-entry',
      description: 'Ordem de Produção gerada a partir do item 2 do Pedido PED-2026-0001',
      authorId: 'user-system',
      authorName: 'Sistema ArteFlow',
      timestamp: '2026-08-25T14:30:00.000Z',
      dataOrigin: 'demo',
    },
    {
      id: 'evt-demo-5',
      jobId: job2Id,
      organizationId,
      eventType: 'STAGE_CHANGED',
      fromValue: 'stage-entry',
      toValue: 'stage-awaiting-material',
      description: 'OP movida para Aguardando Material devido à reposição de fita dupla face',
      authorId: DEMO_USERS[2].id,
      authorName: DEMO_USERS[2].name,
      timestamp: '2026-08-26T14:00:00.000Z',
      dataOrigin: 'demo',
    },
    {
      id: 'evt-demo-6',
      jobId: job2Id,
      organizationId,
      eventType: 'MATERIAL_GATE_CHANGED',
      fromValue: 'NOT_CHECKED',
      toValue: 'MISSING',
      description: 'Fita Dupla Face 19mm em falta no estoque — gate bloqueado',
      authorId: DEMO_USERS[2].id,
      authorName: DEMO_USERS[2].name,
      timestamp: '2026-08-26T14:05:00.000Z',
      dataOrigin: 'demo',
    },
  ];

  return {
    organization: DEMO_ORGANIZATION,
    stages: getInitialStages(organizationId),
    orders: [order],
    jobs: [job1, job2],
    materials,
    requirements,
    reservations,
    movements,
    events,
  };
}
