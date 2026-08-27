import {
  Organization,
  Order,
  OrderItem,
  ProductionJob,
  WorkflowStage,
  ProductionEvent,
} from '../types/domain';
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
    materialGate: 'AVAILABLE',
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
    materialGate: 'MISSING', // Bloqueia OP!
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
      description: 'OP movida para Aguardando Material devido à reposição de lona 440g',
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
      description: 'Lona 440g em falta no estoque local — solicitação de compra encaminhada',
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
    events,
  };
}
