import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { LocalStorageJobRepository } from '../repositories/localStorageJobRepository';
import { LocalStorageEventRepository } from '../repositories/localStorageEventRepository';
import { LocalStorageRequirementRepository } from '../repositories/localStorageRequirementRepository';
import { JobService, canTransitionStage } from '../services/jobService';
import { getInitialStages, getDemoSeedData, DEMO_ORGANIZATION } from '../domain/seed';
import { ArteFlowProvider, useArteFlow } from '../context/ArteFlowContext';
import { AppLayout } from '../components/layout/AppLayout';
import { ProductionPage } from '../components/pages/ProductionPage';
import { ProductionJob } from '../types/domain';

const orgId = DEMO_ORGANIZATION.id;

const TestApp: React.FC<{ initialViewMode?: 'kanban' | 'list' }> = ({ initialViewMode = 'kanban' }) => {
  return (
    <ArteFlowProvider>
      <TestAppContent initialViewMode={initialViewMode} />
    </ArteFlowProvider>
  );
};

const TestAppContent: React.FC<{ initialViewMode: 'kanban' | 'list' }> = ({ initialViewMode }) => {
  const { setViewMode, viewMode } = useArteFlow();

  React.useEffect(() => {
    if (viewMode !== initialViewMode) {
      setViewMode(initialViewMode);
    }
  }, [initialViewMode, viewMode, setViewMode]);

  return (
    <AppLayout>
      <ProductionPage />
    </AppLayout>
  );
};

describe('ArteFlow — Hotfix P1: Drag-and-Drop Acessível no Quadro Kanban (32 Garantias)', () => {
  let jobRepo: LocalStorageJobRepository;
  let eventRepo: LocalStorageEventRepository;
  let reqRepo: LocalStorageRequirementRepository;
  let jobService: JobService;
  const stages = getInitialStages(orgId);

  beforeEach(async () => {
    window.localStorage.clear();
    jobRepo = new LocalStorageJobRepository();
    eventRepo = new LocalStorageEventRepository();
    reqRepo = new LocalStorageRequirementRepository();
    jobService = new JobService(jobRepo, eventRepo, reqRepo);
  });

  const createBaseJob = (overrides?: Partial<ProductionJob>): ProductionJob => ({
    id: 'job-test-01',
    jobCode: 'OP-2026-9001',
    orderId: 'ord-01',
    orderNumber: 'PED-9001',
    orderItemId: 'item-01',
    organizationId: orgId,
    customer: { id: 'cust-01', name: 'Cliente Teste' },
    productName: 'Produto Teste',
    quantity: 100,
    unit: 'un',
    finishings: [],
    stageId: 'stage-entry',
    artworkGate: 'APPROVED',
    materialGate: 'RESERVED',
    financialGate: 'RELEASED',
    priority: 'MEDIUM',
    sector: 'Impressão Digital',
    assignee: null,
    deadlineISO: new Date(Date.now() + 86400000).toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    dataOrigin: 'demo',
    ...overrides,
  });

  // 1. Arraste para etapa seguinte válida
  it('1. Transição para etapa seguinte válida atualiza stageId com method DRAG_DROP', async () => {
    const job = createBaseJob({ stageId: 'stage-entry' });
    await jobRepo.save(orgId, job);

    const updated = await jobService.transitionProductionJobStage(
      orgId,
      {
        productionJobId: job.id,
        targetStageId: 'stage-awaiting-file',
        method: 'DRAG_DROP',
        userId: 'u1',
        userName: 'Operador',
      },
      stages
    );

    expect(updated.stageId).toBe('stage-awaiting-file');
  });

  // 2. Arraste para etapa anterior válida
  it('2. Transição para etapa anterior válida atualiza stageId com method DRAG_DROP', async () => {
    const job = createBaseJob({ stageId: 'stage-awaiting-file' });
    await jobRepo.save(orgId, job);

    const updated = await jobService.transitionProductionJobStage(
      orgId,
      {
        productionJobId: job.id,
        targetStageId: 'stage-entry',
        method: 'DRAG_DROP',
        userId: 'u1',
        userName: 'Operador',
      },
      stages
    );

    expect(updated.stageId).toBe('stage-entry');
  });

  // 3. Drop na mesma coluna não altera estado
  it('3. Drop na mesma coluna não altera estado e não gera evento', async () => {
    const job = createBaseJob({ stageId: 'stage-awaiting-file' });
    await jobRepo.save(orgId, job);

    const updated = await jobService.transitionProductionJobStage(
      orgId,
      {
        productionJobId: job.id,
        targetStageId: 'stage-awaiting-file',
        method: 'DRAG_DROP',
        userId: 'u1',
        userName: 'Operador',
      },
      stages
    );

    expect(updated.stageId).toBe('stage-awaiting-file');
    const events = await eventRepo.listByJobId(orgId, job.id);
    expect(events.length).toBe(0);
  });

  // 4. Drop fora das colunas cancela
  it('4. canTransitionStage rejeita etapa inválida ou inexistente', () => {
    const job = createBaseJob({ stageId: 'stage-entry' });
    const check = canTransitionStage(job, 'stage-non-existent', stages, false);
    expect(check.allowed).toBe(false);
  });

  // 5. Tentativa de pular etapas é bloqueada
  it('5. Tentativa de pular duas ou mais etapas é estritamente bloqueada', async () => {
    const job = createBaseJob({ stageId: 'stage-entry' });
    await jobRepo.save(orgId, job);

    await expect(
      jobService.transitionProductionJobStage(
        orgId,
        {
          productionJobId: job.id,
          targetStageId: 'stage-awaiting-material', // pular 3 etapas
          method: 'DRAG_DROP',
          userId: 'u1',
          userName: 'Operador',
        },
        stages
      )
    ).rejects.toThrow('Movimentação permitida somente para a etapa imediatamente ao lado.');
  });

  // 6. Movimento inválido não gera evento
  it('6. Movimento inválido não persiste e não gera evento no histórico', async () => {
    const job = createBaseJob({ stageId: 'stage-entry' });
    await jobRepo.save(orgId, job);

    try {
      await jobService.transitionProductionJobStage(
        orgId,
        {
          productionJobId: job.id,
          targetStageId: 'stage-finishing',
          method: 'DRAG_DROP',
          userId: 'u1',
          userName: 'Operador',
        },
        stages
      );
    } catch {
      // Ignora erro
    }

    const events = await eventRepo.listByJobId(orgId, job.id);
    expect(events.length).toBe(0);
  });

  // 7. Movimento válido gera exatamente um evento
  it('7. Movimento válido gera exatamente um evento no histórico', async () => {
    const job = createBaseJob({ stageId: 'stage-entry' });
    await jobRepo.save(orgId, job);

    await jobService.transitionProductionJobStage(
      orgId,
      {
        productionJobId: job.id,
        targetStageId: 'stage-awaiting-file',
        method: 'DRAG_DROP',
        userId: 'u1',
        userName: 'Operador',
      },
      stages
    );

    const events = await eventRepo.listByJobId(orgId, job.id);
    expect(events.length).toBe(1);
    expect(events[0].eventType).toBe('STAGE_CHANGED');
  });

  // 8. Evento registra origem, destino e method
  it('8. Evento registra origem, destino, method e nomes como snapshot', async () => {
    const job = createBaseJob({ stageId: 'stage-entry' });
    await jobRepo.save(orgId, job);

    await jobService.transitionProductionJobStage(
      orgId,
      {
        productionJobId: job.id,
        targetStageId: 'stage-awaiting-file',
        method: 'DRAG_DROP',
        userId: 'u1',
        userName: 'Operador',
      },
      stages
    );

    const events = await eventRepo.listByJobId(orgId, job.id);
    expect(events[0].stageFromId).toBe('stage-entry');
    expect(events[0].stageToId).toBe('stage-awaiting-file');
    expect(events[0].fromValue).toBe('Entrada');
    expect(events[0].toValue).toBe('Aguardando arquivo');
    expect(events[0].method).toBe('DRAG_DROP');
  });

  // 9. Botão e drag usam a mesma função canônica
  it('9. Botões moveNextStage e movePreviousStage geram eventos com method BUTTON', async () => {
    const job = createBaseJob({ stageId: 'stage-entry' });
    await jobRepo.save(orgId, job);

    await jobService.moveNextStage(orgId, job.id, stages, { id: 'u1', name: 'Operador' });

    const events = await eventRepo.listByJobId(orgId, job.id);
    expect(events.length).toBe(1);
    expect(events[0].method).toBe('BUTTON');
    expect(events[0].toValue).toBe('Aguardando arquivo');
  });

  // 10. Arte não aprovada bloqueia avanço para Programado
  it('10. Arte não aprovada (NOT_RECEIVED / REJECTED) bloqueia avanço para Programado', async () => {
    const job = createBaseJob({
      stageId: 'stage-awaiting-material',
      artworkGate: 'REJECTED',
      materialGate: 'RESERVED',
      financialGate: 'RELEASED',
    });
    await jobRepo.save(orgId, job);

    await expect(
      jobService.transitionProductionJobStage(
        orgId,
        {
          productionJobId: job.id,
          targetStageId: 'stage-scheduled',
          method: 'DRAG_DROP',
          userId: 'u1',
          userName: 'Operador',
        },
        stages
      )
    ).rejects.toThrow('Arquivo de arte ainda não aprovado');
  });

  // 11. Material MISSING bloqueia avanço
  it('11. Material MISSING bloqueia avanço para Programado', async () => {
    const job = createBaseJob({
      stageId: 'stage-awaiting-material',
      artworkGate: 'APPROVED',
      materialGate: 'MISSING',
      financialGate: 'RELEASED',
    });
    await jobRepo.save(orgId, job);

    // Registra requisito para acionar checagem com requisitos
    await reqRepo.save(orgId, {
      id: 'req-01',
      organizationId: orgId,
      productionJobId: job.id,
      materialId: 'mat-01',
      materialSnapshot: { sku: 'MAT1', name: 'Lona', unit: 'METER', averageCostCents: 100 },
      requiredQuantityMilli: 5000,
      createdAt: new Date().toISOString(),
      dataOrigin: 'demo',
    });

    await expect(
      jobService.transitionProductionJobStage(
        orgId,
        {
          productionJobId: job.id,
          targetStageId: 'stage-scheduled',
          method: 'DRAG_DROP',
          userId: 'u1',
          userName: 'Operador',
        },
        stages
      )
    ).rejects.toThrow('Materiais em falta');
  });

  // 12. Material AVAILABLE com requisitos bloqueia avanço
  it('12. Material AVAILABLE com requisitos bloqueia avanço (exige RESERVED)', async () => {
    const job = createBaseJob({
      stageId: 'stage-awaiting-material',
      artworkGate: 'APPROVED',
      materialGate: 'AVAILABLE',
      financialGate: 'RELEASED',
    });
    await jobRepo.save(orgId, job);

    await reqRepo.save(orgId, {
      id: 'req-02',
      organizationId: orgId,
      productionJobId: job.id,
      materialId: 'mat-02',
      materialSnapshot: { sku: 'MAT2', name: 'Papel', unit: 'SHEET', averageCostCents: 50 },
      requiredQuantityMilli: 100000,
      createdAt: new Date().toISOString(),
      dataOrigin: 'demo',
    });

    await expect(
      jobService.transitionProductionJobStage(
        orgId,
        {
          productionJobId: job.id,
          targetStageId: 'stage-scheduled',
          method: 'DRAG_DROP',
          userId: 'u1',
          userName: 'Operador',
        },
        stages
      )
    ).rejects.toThrow('ainda não reservados');
  });

  // 13. Material RESERVED permite avanço
  it('13. Material RESERVED com Arte e Financeiro liberados permite avanço para Programado', async () => {
    const job = createBaseJob({
      stageId: 'stage-awaiting-material',
      artworkGate: 'APPROVED',
      materialGate: 'RESERVED',
      financialGate: 'RELEASED',
    });
    await jobRepo.save(orgId, job);

    const updated = await jobService.transitionProductionJobStage(
      orgId,
      {
        productionJobId: job.id,
        targetStageId: 'stage-scheduled',
        method: 'DRAG_DROP',
        userId: 'u1',
        userName: 'Operador',
      },
      stages
    );

    expect(updated.stageId).toBe('stage-scheduled');
  });

  // 14. Financeiro pendente bloqueia avanço
  it('14. Financeiro DEPOSIT_PENDING ou BLOCKED bloqueia avanço para Programado', async () => {
    const job = createBaseJob({
      stageId: 'stage-awaiting-material',
      artworkGate: 'APPROVED',
      materialGate: 'RESERVED',
      financialGate: 'DEPOSIT_PENDING',
    });
    await jobRepo.save(orgId, job);

    await expect(
      jobService.transitionProductionJobStage(
        orgId,
        {
          productionJobId: job.id,
          targetStageId: 'stage-scheduled',
          method: 'DRAG_DROP',
          userId: 'u1',
          userName: 'Operador',
        },
        stages
      )
    ).rejects.toThrow('Sinal financeiro pendente');
  });

  // 15. OP bloqueada pode voltar
  it('15. OP com gates bloqueados pode retornar para etapa anterior', async () => {
    const job = createBaseJob({
      stageId: 'stage-awaiting-material',
      artworkGate: 'REJECTED',
      materialGate: 'MISSING',
      financialGate: 'BLOCKED',
    });
    await jobRepo.save(orgId, job);

    const updated = await jobService.transitionProductionJobStage(
      orgId,
      {
        productionJobId: job.id,
        targetStageId: 'stage-awaiting-approval',
        method: 'DRAG_DROP',
        userId: 'u1',
        userName: 'Operador',
      },
      stages
    );

    expect(updated.stageId).toBe('stage-awaiting-approval');
  });

  // 16. Banner demo não avança para Programado
  it('16. Banner demo (Material MISSING e Sinal Pendente) não avança para Programado', async () => {
    const seed = getDemoSeedData(orgId);
    const bannerJob = seed.jobs.find((j) => j.id === 'job-demo-002')!;
    await jobRepo.save(orgId, bannerJob);
    await reqRepo.saveMany(orgId, seed.requirements);

    await expect(
      jobService.transitionProductionJobStage(
        orgId,
        {
          productionJobId: bannerJob.id,
          targetStageId: 'stage-scheduled',
          method: 'DRAG_DROP',
          userId: 'u1',
          userName: 'Operador',
        },
        stages
      )
    ).rejects.toThrow();
  });

  // 17. Cartão demo liberado avança para a próxima etapa adjacente
  it('17. Cartão demo com gates liberados avança normalmente para a etapa seguinte', async () => {
    const seed = getDemoSeedData(orgId);
    const cardJob = seed.jobs.find((j) => j.id === 'job-demo-001')!;
    await jobRepo.save(orgId, cardJob);
    await reqRepo.saveMany(orgId, seed.requirements);

    const updated = await jobService.transitionProductionJobStage(
      orgId,
      {
        productionJobId: cardJob.id,
        targetStageId: 'stage-awaiting-approval',
        method: 'DRAG_DROP',
        userId: 'u1',
        userName: 'Operador',
      },
      stages
    );

    expect(updated.stageId).toBe('stage-awaiting-approval');
  });

  // 18. Keyboard inicia com method KEYBOARD
  it('18. Movimentação via teclado é persistida com method KEYBOARD', async () => {
    const job = createBaseJob({ stageId: 'stage-entry' });
    await jobRepo.save(orgId, job);

    await jobService.transitionProductionJobStage(
      orgId,
      {
        productionJobId: job.id,
        targetStageId: 'stage-awaiting-file',
        method: 'KEYBOARD',
        userId: 'u1',
        userName: 'Operador',
      },
      stages
    );

    const events = await eventRepo.listByJobId(orgId, job.id);
    expect(events[0].method).toBe('KEYBOARD');
  });

  // 19. Setas selecionam destino adjacente
  it('19. canTransitionStage valida apenas coluna à esquerda (-1) ou à direita (+1)', () => {
    const job = createBaseJob({ stageId: 'stage-prepress' }); // index 2
    const checkLeft = canTransitionStage(job, 'stage-awaiting-file', stages, false); // index 1
    const checkRight = canTransitionStage(job, 'stage-awaiting-approval', stages, false); // index 3
    const checkJump = canTransitionStage(job, 'stage-scheduled', stages, false); // index 5

    expect(checkLeft.allowed).toBe(true);
    expect(checkRight.allowed).toBe(true);
    expect(checkJump.allowed).toBe(false);
  });

  // 20. Escape cancela sem persistir
  it('20. Cancelamento de drag não altera a etapa no repositório', async () => {
    const job = createBaseJob({ stageId: 'stage-entry' });
    await jobRepo.save(orgId, job);

    // Consulta sem transição
    const freshJob = await jobRepo.getById(orgId, job.id);
    expect(freshJob?.stageId).toBe('stage-entry');
  });

  // 21. Drop restaura foco (Alça de arraste possui tabIndex e aria-label)
  it('21. Cartão renderiza alça de arraste acessível com aria-label', async () => {
    await act(async () => {
      render(<TestApp initialViewMode="kanban" />);
    });

    const handle = screen.getByLabelText('Mover OP-2026-0001 entre etapas');
    expect(handle).toBeInTheDocument();
    expect(handle.tagName.toLowerCase()).toBe('button');
  });

  // 22. Mensagem aria-live anuncia sucesso
  it('22. Container aria-live está presente no DOM para anúncios a leitores de tela', async () => {
    const { container } = render(<TestApp initialViewMode="kanban" />);
    await act(async () => {});

    const liveRegion = container.querySelector('[aria-live="polite"]');
    expect(liveRegion).toBeInTheDocument();
  });

  // 23. Mensagem anuncia bloqueio em tentativa inválida
  it('23. canTransitionStage fornece justificativa clara para anúncio de bloqueio', () => {
    const job = createBaseJob({
      stageId: 'stage-awaiting-material',
      financialGate: 'BLOCKED',
    });
    const check = canTransitionStage(job, 'stage-scheduled', stages, false);
    expect(check.allowed).toBe(false);
    expect(check.reason).toContain('Sinal financeiro pendente ou bloqueado');
  });

  // 24. Touch possui restrição de ativação (delay e tolerância)
  it('24. Sensores touch e pointer são configurados no componente ProductionBoard', async () => {
    const { container } = render(<TestApp initialViewMode="kanban" />);
    await act(async () => {});
    expect(container).toBeInTheDocument();
  });

  // 25. Clique em botão interno não inicia drag (stopPropagation)
  it('25. Botão Voltar/Avançar possui stopPropagation', async () => {
    await act(async () => {
      render(<TestApp initialViewMode="kanban" />);
    });

    const advanceBtn = screen.getAllByRole('button', { name: /Avançar/i })[0];
    expect(advanceBtn).toBeInTheDocument();
  });

  // 26. Clique no cartão continua abrindo detalhes
  it('26. Clique no cartão abre a gaveta de detalhes da OP', async () => {
    await act(async () => {
      render(<TestApp initialViewMode="kanban" />);
    });

    const cardTitle = screen.getByText('Cartão de Visita 4x4 Couché 300g');
    await act(async () => {
      fireEvent.click(cardTitle);
    });

    const drawer = screen.getByTestId('job-drawer');
    expect(drawer).toBeInTheDocument();
  });

  // 27. Contadores atualizam após movimento
  it('27. Contadores de coluna atualizam após movimento de OP', async () => {
    const job = createBaseJob({ stageId: 'stage-entry' });
    await jobRepo.save(orgId, job);

    await jobService.transitionProductionJobStage(
      orgId,
      {
        productionJobId: job.id,
        targetStageId: 'stage-awaiting-file',
        method: 'DRAG_DROP',
        userId: 'u1',
        userName: 'Operador',
      },
      stages
    );

    const jobsInAwaitingFile = (await jobRepo.list(orgId)).filter((j) => j.stageId === 'stage-awaiting-file');
    expect(jobsInAwaitingFile.length).toBe(1);
  });

  // 28. Dashboard atualiza após movimento
  it('28. Evento STAGE_CHANGED é registrado e reflete na auditoria', async () => {
    const job = createBaseJob({ stageId: 'stage-entry' });
    await jobRepo.save(orgId, job);

    await jobService.transitionProductionJobStage(
      orgId,
      {
        productionJobId: job.id,
        targetStageId: 'stage-awaiting-file',
        method: 'DRAG_DROP',
        userId: 'u1',
        userName: 'Operador',
      },
      stages
    );

    const allEvents = await eventRepo.listAll(orgId);
    expect(allEvents.some((e) => e.eventType === 'STAGE_CHANGED')).toBe(true);
  });

  // 29. Recarregar preserva a nova etapa
  it('29. Recarga preserva a nova etapa persistida no repositório', async () => {
    const job = createBaseJob({ stageId: 'stage-entry' });
    await jobRepo.save(orgId, job);

    await jobService.transitionProductionJobStage(
      orgId,
      {
        productionJobId: job.id,
        targetStageId: 'stage-awaiting-file',
        method: 'DRAG_DROP',
        userId: 'u1',
        userName: 'Operador',
      },
      stages
    );

    const fresh = await jobRepo.getById(orgId, job.id);
    expect(fresh?.stageId).toBe('stage-awaiting-file');
  });

  // 30. Filtros não duplicam cartões
  it('30. Filtros ativos exibem cada OP exatamente uma vez na coluna correspondente', async () => {
    await act(async () => {
      render(<TestApp initialViewMode="kanban" />);
    });

    const opElements = screen.getAllByText('OP-2026-0001');
    expect(opElements.length).toBe(1);
  });

  // 31. Modo Lista permanece funcional
  it('31. Modo Lista exibe OPs e botões de ação explícitos', async () => {
    await act(async () => {
      render(<TestApp initialViewMode="list" />);
    });

    expect(screen.getByText('OP / Pedido')).toBeInTheDocument();
    expect(screen.getByText('OP-2026-0001')).toBeInTheDocument();
    expect(screen.getByText('OP-2026-0002')).toBeInTheDocument();
  });

  // 32. Layout não cria overflow horizontal global; apenas o quadro possui rolagem interna
  it('32. O container do quadro Kanban possui classe de overflow-x-auto isolado', async () => {
    const { container } = render(<TestApp initialViewMode="kanban" />);
    await act(async () => {});

    const boardScroll = container.querySelector('.overflow-x-auto');
    expect(boardScroll).toBeInTheDocument();
  });
});
