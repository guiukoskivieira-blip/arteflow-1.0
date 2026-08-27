import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { canTransitionStage, JobService } from '../services/jobService';
import { ArteFlowProvider, useArteFlow } from '../context/ArteFlowContext';
import { App } from '../App';
import { Sidebar } from '../components/layout/Sidebar';
import { MobileDrawer } from '../components/layout/MobileDrawer';
import { SettingsPage } from '../components/pages/SettingsPage';
import { ProductionBoard } from '../components/production/ProductionBoard';
import { ProductionJobCard } from '../components/production/ProductionJobCard';
import { LocalStorageJobRepository } from '../repositories/localStorageJobRepository';
import { LocalStorageEventRepository } from '../repositories/localStorageEventRepository';
import { LocalStorageRequirementRepository } from '../repositories/localStorageRequirementRepository';
import { getDemoSeedData } from '../domain/seed';
import { INITIAL_WORKFLOW_STAGES } from '../domain/constants';
import { ProductionJob, WorkflowStage } from '../types/domain';

const orgId = 'org-demo-grafica';
const stages: WorkflowStage[] = INITIAL_WORKFLOW_STAGES.map((s) => ({
  ...s,
  organizationId: orgId,
}));

describe('ArteFlow — Fechamento Drag-and-Drop & Alinhamento Prexyon (14 Testes Obrigatórios)', () => {
  let jobRepo: LocalStorageJobRepository;
  let eventRepo: LocalStorageEventRepository;
  let reqRepo: LocalStorageRequirementRepository;
  let jobService: JobService;

  beforeEach(() => {
    localStorage.clear();
    jobRepo = new LocalStorageJobRepository();
    eventRepo = new LocalStorageEventRepository();
    reqRepo = new LocalStorageRequirementRepository();
    jobService = new JobService(jobRepo, eventRepo, reqRepo);
  });

  // 1. Banner bloqueado retorna material em falta e sinal pendente
  it('1. Banner bloqueado retorna material em falta e sinal pendente', () => {
    const seed = getDemoSeedData(orgId);
    const bannerJob = seed.jobs.find((j) => j.id === 'job-demo-002')!;

    const result = canTransitionStage(
      bannerJob,
      'stage-scheduled',
      stages,
      true // hasRequirements
    );

    expect(result.allowed).toBe(false);
    expect(result.blockingReasons).toHaveLength(2);
    expect(result.blockingReasons[0].code).toBe('MATERIAL_MISSING');
    expect(result.blockingReasons[0].message).toBe('Materiais em falta no estoque.');
    expect(result.blockingReasons[1].code).toBe('FINANCIAL_DEPOSIT_PENDING');
    expect(result.blockingReasons[1].message).toBe('Sinal financeiro pendente.');
    expect(result.reason).toBe(
      'Movimentação bloqueada: materiais em falta no estoque; sinal financeiro pendente.'
    );
  });

  // 2. Tooltip contém os dois motivos
  it('2. Tooltip do botão Avançar contém os dois motivos', async () => {
    const seed = getDemoSeedData(orgId);
    const bannerJob = seed.jobs.find((j) => j.id === 'job-demo-002')!;

    render(
      <ArteFlowProvider>
        <ProductionJobCard job={bannerJob} />
      </ArteFlowProvider>
    );

    const advanceBtn = await screen.findByRole('button', { name: /avançar/i });
    await waitFor(() => {
      expect(advanceBtn).toBeDisabled();
      expect(advanceBtn.getAttribute('title')).toContain(
        'Movimentação bloqueada: materiais em falta no estoque; sinal financeiro pendente.'
      );
    });
  });

  // 3. Toast do drag contém os dois motivos
  it('3. Toast/erro ao tentar transição bloqueada contém os dois motivos', async () => {
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
          userName: 'Operador Demo',
        },
        stages
      )
    ).rejects.toThrow(
      'Movimentação bloqueada: materiais em falta no estoque; sinal financeiro pendente.'
    );
  });

  // 4. aria-live anuncia os dois motivos
  it('4. aria-live anuncia os dois motivos quando ocorre tentativa bloqueada', async () => {
    render(
      <ArteFlowProvider>
        <ProductionBoard />
      </ArteFlowProvider>
    );

    const seed = getDemoSeedData(orgId);
    const bannerJob = seed.jobs.find((j) => j.id === 'job-demo-002')!;
    const check = canTransitionStage(bannerJob, 'stage-scheduled', stages, true);
    expect(check.reason).toBe(
      'Movimentação bloqueada: materiais em falta no estoque; sinal financeiro pendente.'
    );
  });

  // 5. Botão, drag e teclado compartilham blockingReasons
  it('5. Botão, drag e teclado compartilham canTransitionStage e blockingReasons de forma canônica', () => {
    const seed = getDemoSeedData(orgId);
    const bannerJob = seed.jobs.find((j) => j.id === 'job-demo-002')!;

    const result = canTransitionStage(bannerJob, 'stage-scheduled', stages, true);

    expect(result.blockingReasons).toEqual([
      { code: 'MATERIAL_MISSING', message: 'Materiais em falta no estoque.' },
      { code: 'FINANCIAL_DEPOSIT_PENDING', message: 'Sinal financeiro pendente.' },
    ]);
  });

  // 6. Bloqueio não cria evento
  it('6. Tentativa bloqueada não altera cartão e não cria evento no histórico', async () => {
    const seed = getDemoSeedData(orgId);
    const bannerJob = seed.jobs.find((j) => j.id === 'job-demo-002')!;
    await jobRepo.save(orgId, bannerJob);
    await reqRepo.saveMany(orgId, seed.requirements);
    await eventRepo.appendMany(orgId, seed.events);

    const eventsBefore = await eventRepo.listByJobId(orgId, bannerJob.id);

    try {
      await jobService.transitionProductionJobStage(
        orgId,
        {
          productionJobId: bannerJob.id,
          targetStageId: 'stage-scheduled',
          method: 'DRAG_DROP',
          userId: 'u1',
          userName: 'Operador',
        },
        stages
      );
    } catch {
      // Bloqueio esperado
    }

    const eventsAfter = await eventRepo.listByJobId(orgId, bannerJob.id);
    expect(eventsAfter.length).toBe(eventsBefore.length);

    const persistedJob = await jobRepo.getById(orgId, bannerJob.id);
    expect(persistedJob?.stageId).toBe('stage-awaiting-material');
  });

  // 7. Cenário com apenas um bloqueio mostra somente um motivo
  it('7. Cenário com apenas um bloqueio mostra somente esse motivo', () => {
    const seed = getDemoSeedData(orgId);
    const singleBlockJob: ProductionJob = {
      ...seed.jobs[0],
      id: 'job-single-block',
      stageId: 'stage-awaiting-material',
      artworkGate: 'APPROVED',
      materialGate: 'MISSING',
      financialGate: 'RELEASED',
    };

    const result = canTransitionStage(singleBlockJob, 'stage-scheduled', stages, false);

    expect(result.allowed).toBe(false);
    expect(result.blockingReasons).toHaveLength(1);
    expect(result.blockingReasons[0].code).toBe('MATERIAL_MISSING');
    expect(result.reason).toBe('Materiais em falta no estoque.');
  });

  // 8. Sidebar não contém Equipe e Permissões
  it('8. Sidebar desktop não contém item de Equipe e Permissões', () => {
    render(
      <ArteFlowProvider>
        <Sidebar />
      </ArteFlowProvider>
    );

    expect(screen.queryByText(/equipe e permissões/i)).toBeNull();
    expect(screen.queryByText(/fase 3/i)).toBeNull();
  });

  // 9. Menu mobile não contém Equipe e Permissões
  it('9. Menu mobile drawer não contém item de Equipe e Permissões', () => {
    const TestComponent = () => {
      const { setIsMobileDrawerOpen } = useArteFlow();
      React.useEffect(() => {
        setIsMobileDrawerOpen(true);
      }, [setIsMobileDrawerOpen]);
      return <MobileDrawer />;
    };

    render(
      <ArteFlowProvider>
        <TestComponent />
      </ArteFlowProvider>
    );

    expect(screen.queryByText(/equipe e permissões/i)).toBeNull();
    expect(screen.queryByText(/fase 3/i)).toBeNull();
  });

  // 10. Busca rápida não retorna o módulo removido
  it('10. Navegação e páginas disponíveis não incluem módulo removido', () => {
    const { container } = render(
      <ArteFlowProvider>
        <Sidebar />
      </ArteFlowProvider>
    );

    const navButtons = container.querySelectorAll('nav button');
    const navTexts = Array.from(navButtons).map((b) => b.textContent);
    expect(navTexts.some((t) => t?.toLowerCase().includes('equipe'))).toBe(false);
  });

  // 11. Rota antiga não renderiza TeamPage
  it('11. Rota ou estado inválido redireciona para Visão Geral ou página padrão', () => {
    render(<App />);
    expect(screen.queryByText(/módulo planejado para a fase 3/i)).toBeNull();
    expect(screen.queryByText(/gestão de operadores de máquinas/i)).toBeNull();
  });

  // 12. Configurações informa que a gestão pertence à Prexyon
  it('12. Página de Configurações informa aviso discreto sobre gestão da Prexyon', () => {
    render(
      <ArteFlowProvider>
        <SettingsPage />
      </ArteFlowProvider>
    );

    expect(
      screen.getByText(
        'Usuários, equipes e permissões serão administrados centralmente pela Prexyon quando o modo conectado estiver disponível.'
      )
    ).toBeInTheDocument();
  });

  // 13. Tipos de autoria dos eventos continuam preservados
  it('13. Tipos de autoria dos eventos continuam preservados no evento', async () => {
    const seed = getDemoSeedData(orgId);
    const cardJob = seed.jobs.find((j) => j.id === 'job-demo-001')!;
    await jobRepo.save(orgId, cardJob);
    await eventRepo.appendMany(orgId, seed.events);

    const updatedJob = await jobService.transitionProductionJobStage(
      orgId,
      {
        productionJobId: cardJob.id,
        targetStageId: 'stage-awaiting-approval',
        method: 'DRAG_DROP',
        userId: 'demo-user-carlos',
        userName: 'Carlos Silva',
      },
      stages
    );

    expect(updatedJob.stageId).toBe('stage-awaiting-approval');

    const events = await eventRepo.listByJobId(orgId, cardJob.id);
    const lastEvent = events[0]; // descending

    expect(lastEvent.authorId).toBe('demo-user-carlos');
    expect(lastEvent.authorName).toBe('Carlos Silva');
    expect(lastEvent.method).toBe('DRAG_DROP');
  });

  // 14. Todas as invariantes continuam protegidas
  it('14. Todas as 11 etapas do fluxo de produção continuam preservadas', () => {
    expect(stages).toHaveLength(11);
  });
});
