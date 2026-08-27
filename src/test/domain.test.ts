import { describe, it, expect, beforeEach } from 'vitest';
import { OrderService } from '../services/orderService';
import { JobService } from '../services/jobService';
import { LocalStorageOrderRepository } from '../repositories/localStorageOrderRepository';
import { LocalStorageJobRepository } from '../repositories/localStorageJobRepository';
import { LocalStorageStageRepository } from '../repositories/localStorageStageRepository';
import { LocalStorageEventRepository } from '../repositories/localStorageEventRepository';
import { getInitialStages, getDemoSeedData } from '../domain/seed';
import { isJobBlocked, isJobOverdue, getJobBlockDetails } from '../domain/jobStatus';
import { formatCentsToBRL, parseBRLInputToCents, calculateOrderTotalCents } from '../domain/money';

describe('ArteFlow — Regras de Domínio Operacional (Fase 1)', () => {
  const orgId = 'org-test-domain';
  let orderRepo: LocalStorageOrderRepository;
  let jobRepo: LocalStorageJobRepository;
  let stageRepo: LocalStorageStageRepository;
  let eventRepo: LocalStorageEventRepository;
  let orderService: OrderService;
  let jobService: JobService;

  beforeEach(() => {
    window.localStorage.clear();
    orderRepo = new LocalStorageOrderRepository();
    jobRepo = new LocalStorageJobRepository();
    stageRepo = new LocalStorageStageRepository();
    eventRepo = new LocalStorageEventRepository();
    orderService = new OrderService(orderRepo, jobRepo, eventRepo);
    jobService = new JobService(jobRepo, eventRepo);
  });

  // Requisito 1: Um pedido com dois itens gera duas OPs independentes
  it('1. Um pedido com dois itens gera duas OPs independentes', async () => {
    const stages = getInitialStages(orgId);
    await stageRepo.saveMany(orgId, stages);

    const { order, jobs } = await orderService.createManualOrder({
      organizationId: orgId,
      customer: {
        name: 'Gráfica Modelo Ltda',
        document: '11.222.333/0001-44',
      },
      items: [
        {
          productName: 'Cartão de Visita 4x4 Couché 300g',
          sector: 'Impressão Digital',
          unit: 'cm',
          quantity: 1000,
          quantityUnit: 'un',
          unitPriceCents: 15, // R$ 0,15
          finishings: ['Laminação Fosca'],
          priority: 'MEDIUM',
        },
        {
          productName: 'Banner Lona 440g c/ Ilhós 100x150cm',
          sector: 'Comunicação Visual',
          width: 100,
          height: 150,
          unit: 'cm',
          quantity: 2,
          quantityUnit: 'un',
          unitPriceCents: 9000, // R$ 90,00
          finishings: ['Ilhós 30cm', 'Bainha'],
          priority: 'HIGH',
        },
      ],
      deliveryDateISO: '2026-09-01T18:00:00.000Z',
    });

    expect(order.items).toHaveLength(2);
    expect(jobs).toHaveLength(2);
    expect(jobs[0].id).not.toEqual(jobs[1].id);
    expect(jobs[0].jobCode).not.toEqual(jobs[1].jobCode);
    expect(jobs[0].orderId).toBe(order.id);
    expect(jobs[1].orderId).toBe(order.id);
    expect(jobs[0].productName).toBe('Cartão de Visita 4x4 Couché 300g');
    expect(jobs[1].productName).toBe('Banner Lona 440g c/ Ilhós 100x150cm');
  });

  // Requisito 2: Alterar uma OP não altera a outra
  it('2. Alterar uma OP não altera silenciosamente outras OPs do mesmo pedido', async () => {
    const stages = getInitialStages(orgId);
    await stageRepo.saveMany(orgId, stages);

    const { jobs } = await orderService.createManualOrder({
      organizationId: orgId,
      customer: { name: 'Cliente Multi-Item' },
      items: [
        { productName: 'Item A', sector: 'Impressão Digital', quantity: 10, unitPriceCents: 1000, finishings: [], unit: 'cm' },
        { productName: 'Item B', sector: 'Acabamento Gráfico', quantity: 20, unitPriceCents: 2000, finishings: [], unit: 'cm' },
      ],
      deliveryDateISO: '2026-09-01T18:00:00.000Z',
    });

    const [jobA, jobB] = jobs;

    // Move Job A para 'stage-in-production' e atualiza gate de arte para APPROVED
    await jobService.moveStage(orgId, jobA.id, 'stage-in-production', stages, { id: 'u1', name: 'Operador' });
    await jobService.updateArtworkGate(orgId, jobA.id, 'APPROVED', { id: 'u1', name: 'Operador' });
    await jobService.updatePriority(orgId, jobA.id, 'URGENT', { id: 'u1', name: 'Operador' });

    // Consulta Job A e Job B frescos do repositório
    const freshA = await jobRepo.getById(orgId, jobA.id);
    const freshB = await jobRepo.getById(orgId, jobB.id);

    expect(freshA?.stageId).toBe('stage-in-production');
    expect(freshA?.artworkGate).toBe('APPROVED');
    expect(freshA?.priority).toBe('URGENT');

    // Job B deve permanecer inalterado em stage-entry, NOT_RECEIVED, MEDIUM
    expect(freshB?.stageId).toBe('stage-entry');
    expect(freshB?.artworkGate).toBe('NOT_RECEIVED');
    expect(freshB?.priority).toBe('MEDIUM');
  });

  // Requisito 3: Movimentação registra evento append-only
  it('3. Movimentação e alterações registram eventos no histórico append-only', async () => {
    const stages = getInitialStages(orgId);
    await stageRepo.saveMany(orgId, stages);

    const { jobs } = await orderService.createManualOrder({
      organizationId: orgId,
      customer: { name: 'Cliente Eventos' },
      items: [{ productName: 'Adesivo Vinil', sector: 'Comunicação Visual', quantity: 1, unitPriceCents: 5000, finishings: [], unit: 'cm' }],
      deliveryDateISO: '2026-09-01T18:00:00.000Z',
      authorId: 'user-op',
      authorName: 'Marcos Silva',
    });

    const job = jobs[0];

    // Eventos iniciais (JOB_CREATED)
    let events = await eventRepo.listByJobId(orgId, job.id);
    expect(events.length).toBe(1);
    expect(events[0].eventType).toBe('JOB_CREATED');

    // Transição 1: Mudança de etapa
    await jobService.moveStage(orgId, job.id, 'stage-prepress', stages, { id: 'user-prep', name: 'Ana Designer' });

    // Transição 2: Alteração de Gate
    await jobService.updateMaterialGate(orgId, job.id, 'MISSING', { id: 'user-prep', name: 'Ana Designer' }, 'Falta vinil brilho');

    events = await eventRepo.listByJobId(orgId, job.id);
    expect(events.length).toBe(3);

    // O repositório lista ordenado por timestamp descendente
    const eventTypes = events.map((e) => e.eventType);
    expect(eventTypes).toContain('MATERIAL_GATE_CHANGED');
    expect(eventTypes).toContain('STAGE_CHANGED');
    expect(eventTypes).toContain('JOB_CREATED');
  });

  // Requisito 4: Etapas são referenciadas por ID
  it('4. Etapas são estritamente referenciadas por IDs estáveis, independente de nomes textuais', async () => {
    const stages = getInitialStages(orgId);
    expect(stages.map((s) => s.id)).toEqual([
      'stage-entry',
      'stage-awaiting-file',
      'stage-prepress',
      'stage-awaiting-approval',
      'stage-awaiting-material',
      'stage-scheduled',
      'stage-in-production',
      'stage-finishing',
      'stage-quality-control',
      'stage-ready',
      'stage-delivered',
    ]);

    const { jobs } = await orderService.createManualOrder({
      organizationId: orgId,
      customer: { name: 'Cliente Etapas' },
      items: [{ productName: 'Flyer', sector: 'Impressão Offset', quantity: 5000, unitPriceCents: 10, finishings: [], unit: 'cm' }],
      deliveryDateISO: '2026-09-01T18:00:00.000Z',
    });

    // Modifica nome da etapa no banco sem quebrar o ID
    const stageModified = { ...stages[6], name: 'Impressão Pesada Modificada' };
    await stageRepo.save(orgId, stageModified);

    await jobService.moveStage(orgId, jobs[0].id, 'stage-in-production', [stageModified], { id: 'u1', name: 'Op' });
    const freshJob = await jobRepo.getById(orgId, jobs[0].id);

    expect(freshJob?.stageId).toBe('stage-in-production');
  });

  // Requisito 7: Registros demo e user são diferenciados
  it('7. Registros demo e user possuem dataOrigin estritamente diferenciado', async () => {
    const seed = getDemoSeedData(orgId);
    expect(seed.orders[0].dataOrigin).toBe('demo');
    expect(seed.jobs[0].dataOrigin).toBe('demo');
    expect(seed.jobs[1].dataOrigin).toBe('demo');
    expect(seed.events[0].dataOrigin).toBe('demo');

    const userCreated = await orderService.createManualOrder({
      organizationId: orgId,
      customer: { name: 'Cliente Criado por Usuário' },
      items: [{ productName: 'Cardápio PVC', sector: 'Comunicação Visual', quantity: 5, unitPriceCents: 3000, finishings: [], unit: 'cm' }],
      deliveryDateISO: '2026-09-05T18:00:00.000Z',
      dataOrigin: 'user',
    });

    expect(userCreated.order.dataOrigin).toBe('user');
    expect(userCreated.jobs[0].dataOrigin).toBe('user');
  });

  // Requisito 10: Detecção de atraso
  it('10. Detecção correta de trabalhos atrasados com base na data de referência', () => {
    const stages = getInitialStages(orgId);
    const referenceDate = new Date('2026-08-27T12:00:00.000Z');

    const overdueJob: any = {
      id: 'job-overdue',
      stageId: 'stage-in-production',
      deadlineISO: '2026-08-20T18:00:00.000Z', // 7 dias atrás
    };

    const futureJob: any = {
      id: 'job-future',
      stageId: 'stage-in-production',
      deadlineISO: '2026-09-05T18:00:00.000Z', // Futuro
    };

    const finishedJob: any = {
      id: 'job-finished',
      stageId: 'stage-delivered', // Finalizado / entregue não atrasa
      deadlineISO: '2026-08-10T18:00:00.000Z',
    };

    expect(isJobOverdue(overdueJob, stages, referenceDate)).toBe(true);
    expect(isJobOverdue(futureJob, stages, referenceDate)).toBe(false);
    expect(isJobOverdue(finishedJob, stages, referenceDate)).toBe(false);
  });

  // Requisito 11: Detecção de bloqueio por arte, material ou financeiro
  it('11. Detecção de bloqueio por arte (REJECTED), material (MISSING) ou financeiro (BLOCKED)', () => {
    const normalJob: any = {
      artworkGate: 'APPROVED',
      materialGate: 'AVAILABLE',
      financialGate: 'RELEASED',
    };

    const artworkBlockedJob: any = {
      artworkGate: 'REJECTED',
      materialGate: 'AVAILABLE',
      financialGate: 'RELEASED',
    };

    const materialBlockedJob: any = {
      artworkGate: 'APPROVED',
      materialGate: 'MISSING',
      financialGate: 'RELEASED',
    };

    const financialBlockedJob: any = {
      artworkGate: 'APPROVED',
      materialGate: 'AVAILABLE',
      financialGate: 'BLOCKED',
    };

    expect(isJobBlocked(normalJob)).toBe(false);
    expect(isJobBlocked(artworkBlockedJob)).toBe(true);
    expect(isJobBlocked(materialBlockedJob)).toBe(true);
    expect(isJobBlocked(financialBlockedJob)).toBe(true);

    const blockDetails = getJobBlockDetails(artworkBlockedJob);
    expect(blockDetails.artworkBlocked).toBe(true);
    expect(blockDetails.reasons[0]).toContain('Arte reprovada');
  });

  // Requisito 12: Valores monetários usam centavos inteiros
  it('12. Valores monetários operam e persistem exclusivamente em centavos inteiros', () => {
    // 15000 centavos = R$ 150,00
    expect(formatCentsToBRL(15000)).toMatch(/R\$\s*150,00/);
    expect(formatCentsToBRL(12)).toMatch(/R\$\s*0,12/);
    expect(formatCentsToBRL(31000)).toMatch(/R\$\s*310,00/);

    // Conversão de inputs
    expect(parseBRLInputToCents('150,00')).toBe(15000);
    expect(parseBRLInputToCents('1.250,50')).toBe(125050);
    expect(parseBRLInputToCents('0,12')).toBe(12);

    // Soma em centavos
    const items = [
      { totalPriceCents: 12000 },
      { totalPriceCents: 19000 },
    ];
    expect(calculateOrderTotalCents(items)).toBe(31000);
  });

  // Requisito 13: Origem ORCAGRAF não representa sincronização real
  it('13. Origem ORCAGRAF atua exclusivamente como etiqueta contratual sem simular sincronização', async () => {
    const { order } = await orderService.createManualOrder({
      organizationId: orgId,
      origin: 'ORCAGRAF',
      customer: { name: 'Cliente Importado Contratual' },
      items: [{ productName: 'Catálogo 16p', sector: 'Impressão Offset', quantity: 200, unitPriceCents: 850, finishings: [], unit: 'cm' }],
      deliveryDateISO: '2026-09-10T18:00:00.000Z',
    });

    expect(order.origin).toBe('ORCAGRAF');
    // Salvo localmente sem chamadas de rede ou falsos endpoints
    const saved = await orderRepo.getById(orgId, order.id);
    expect(saved?.origin).toBe('ORCAGRAF');
  });
});
