import {
  ProductionJob,
  WorkflowStage,
  ArtworkGate,
  MaterialGate,
  FinancialGate,
  Priority,
  ProductionEvent,
} from '../types/domain';
import {
  IProductionJobRepository,
  IProductionEventRepository,
  IRequirementRepository,
} from '../types/repository';
import {
  ARTWORK_GATE_CONFIG,
  MATERIAL_GATE_CONFIG,
  FINANCIAL_GATE_CONFIG,
  PRIORITY_CONFIG,
} from '../domain/constants';

export interface TransitionProductionJobStageInput {
  productionJobId: string;
  targetStageId: string;
  method: 'BUTTON' | 'DRAG_DROP' | 'KEYBOARD';
  userId: string;
  userName: string;
  reversionReason?: string;
}

export interface BlockingReason {
  code: string;
  message: string;
}

export interface TransitionCheckResult {
  allowed: boolean;
  blockingReasons: BlockingReason[];
  reason?: string;
}

/**
 * Validação pura das regras de transição de etapa de uma OP
 */
export function canTransitionStage(
  job: ProductionJob,
  targetStageId: string,
  stages: WorkflowStage[],
  hasRequirements: boolean
): TransitionCheckResult {
  const sortedStages = [...stages].sort((a, b) => a.sequence - b.sequence);
  const currentIndex = sortedStages.findIndex((s) => s.id === job.stageId);
  const targetIndex = sortedStages.findIndex((s) => s.id === targetStageId);

  if (currentIndex === -1 || targetIndex === -1) {
    const message = 'Etapa não encontrada no fluxo de produção.';
    return {
      allowed: false,
      blockingReasons: [{ code: 'STAGE_NOT_FOUND', message }],
      reason: message,
    };
  }

  if (currentIndex === targetIndex) {
    const message = 'A OP já está nesta etapa.';
    return {
      allowed: false,
      blockingReasons: [{ code: 'SAME_STAGE', message }],
      reason: message,
    };
  }

  // Regra: somente etapa imediatamente anterior ou seguinte
  if (Math.abs(targetIndex - currentIndex) > 1) {
    const message = 'Movimentação permitida somente para a etapa imediatamente ao lado.';
    return {
      allowed: false,
      blockingReasons: [{ code: 'INVALID_ADJACENCY', message }],
      reason: message,
    };
  }

  // Movimentação para trás (targetIndex < currentIndex) é permitida mesmo com gates bloqueados
  if (targetIndex < currentIndex) {
    return { allowed: true, blockingReasons: [] };
  }

  // Movimentação para frente (targetIndex > currentIndex)
  // Identifica a sequência da etapa "Programado"
  const scheduledStage = sortedStages.find((s) => s.id === 'stage-scheduled');
  const scheduledSequence = scheduledStage ? scheduledStage.sequence : 5;
  const targetStage = sortedStages[targetIndex];

  // Se o destino for "Programado" ou qualquer etapa posterior, checa gates obrigatórios
  if (targetStage.sequence >= scheduledSequence) {
    const blockingReasons: BlockingReason[] = [];

    // 1. ArtworkGate
    if (job.artworkGate !== 'APPROVED') {
      const artLabel = ARTWORK_GATE_CONFIG[job.artworkGate]?.label || job.artworkGate;
      blockingReasons.push({
        code: 'ARTWORK_NOT_APPROVED',
        message: `Arquivo de arte ainda não aprovado para produção (status: ${artLabel}).`,
      });
    }

    // 2. MaterialGate
    if (hasRequirements) {
      if (job.materialGate === 'MISSING') {
        blockingReasons.push({
          code: 'MATERIAL_MISSING',
          message: 'Materiais em falta no estoque.',
        });
      } else if (job.materialGate === 'AVAILABLE') {
        blockingReasons.push({
          code: 'MATERIAL_NOT_RESERVED',
          message: 'Materiais disponíveis mas ainda não reservados.',
        });
      } else if (job.materialGate !== 'RESERVED') {
        blockingReasons.push({
          code: 'MATERIAL_NOT_RESERVED',
          message: 'Materiais ainda não totalmente reservados para produção.',
        });
      }
    } else {
      if (job.materialGate === 'MISSING') {
        blockingReasons.push({
          code: 'MATERIAL_MISSING',
          message: 'Materiais em falta no estoque.',
        });
      }
    }

    // 3. FinancialGate
    if (job.financialGate === 'DEPOSIT_PENDING') {
      blockingReasons.push({
        code: 'FINANCIAL_DEPOSIT_PENDING',
        message: 'Sinal financeiro pendente.',
      });
    } else if (job.financialGate === 'PAYMENT_PENDING') {
      blockingReasons.push({
        code: 'FINANCIAL_PAYMENT_PENDING',
        message: 'Pagamento pendente.',
      });
    } else if (job.financialGate !== 'RELEASED') {
      const finLabel = FINANCIAL_GATE_CONFIG[job.financialGate]?.label || job.financialGate;
      blockingReasons.push({
        code: 'FINANCIAL_BLOCKED',
        message: `Sinal financeiro pendente ou bloqueado (status: ${finLabel}).`,
      });
    }

    if (blockingReasons.length > 0) {
      let consolidatedReason = '';
      if (blockingReasons.length === 1) {
        consolidatedReason = blockingReasons[0].message;
      } else {
        const parts = blockingReasons.map((r) => {
          let m = r.message.trim();
          if (m.endsWith('.')) m = m.slice(0, -1);
          return m.charAt(0).toLowerCase() + m.slice(1);
        });
        consolidatedReason = `Movimentação bloqueada: ${parts.join('; ')}.`;
      }

      return {
        allowed: false,
        blockingReasons,
        reason: consolidatedReason,
      };
    }
  }

  return { allowed: true, blockingReasons: [] };
}

export class JobService {
  constructor(
    private jobRepo: IProductionJobRepository,
    private eventRepo: IProductionEventRepository,
    private requirementRepo?: IRequirementRepository
  ) {}

  private generateId(prefix: string): string {
    const random = Math.random().toString(36).substring(2, 9);
    const timestamp = Date.now().toString(36);
    return `${prefix}-${timestamp}-${random}`;
  }

  private get serverRepo() {
    return this.jobRepo as IProductionJobRepository & {
      serverManaged?: boolean;
      moveAtomic?: (organizationId: string, input: TransitionProductionJobStageInput, expectedVersion: number) => Promise<ProductionJob>;
      updateAtomic?: (organizationId: string, jobId: string, version: number, field: string, value: string, note?: string) => Promise<ProductionJob>;
      addNoteAtomic?: (organizationId: string, jobId: string, note: string) => Promise<void>;
    };
  }

  /**
   * Função canônica única de transição de etapa de uma OP.
   * Usada por Arraste (Drag-and-Drop), Teclado e Botões.
   */
  async transitionProductionJobStage(
    organizationId: string,
    input: TransitionProductionJobStageInput,
    stages: WorkflowStage[]
  ): Promise<ProductionJob> {
    const job = await this.jobRepo.getById(organizationId, input.productionJobId);
    if (!job) {
      throw new Error(`Ordem de Produção ${input.productionJobId} não encontrada.`);
    }

    if (job.stageId === input.targetStageId) {
      return job; // Soltar na mesma etapa não altera nada
    }

    const sortedStages = [...stages].sort((a, b) => a.sequence - b.sequence);
    const currentIndex = sortedStages.findIndex((s) => s.id === job.stageId);
    const targetIndex = sortedStages.findIndex((s) => s.id === input.targetStageId);

    if (currentIndex === -1 || targetIndex === -1) {
      throw new Error('Etapa de produção não encontrada no fluxo.');
    }

    // Regra 16: Retorno de "Entregue" para "Pronto" exige justificativa
    if (
      sortedStages[currentIndex].id === 'stage-delivered' &&
      sortedStages[targetIndex].id === 'stage-ready'
    ) {
      if (!input.reversionReason?.trim()) {
        throw new Error(
          'Para retirar uma OP de Entregue e voltar para Pronto é obrigatório confirmar e informar a justificativa do retorno.'
        );
      }
    }

    // Checa requisitos da OP se o repositório estiver disponível
    let hasRequirements = false;
    if (this.requirementRepo) {
      const reqs = await this.requirementRepo.listByJobId(organizationId, job.id);
      hasRequirements = reqs.length > 0;
    }

    const check = canTransitionStage(job, input.targetStageId, stages, hasRequirements);
    if (!check.allowed) {
      throw new Error(check.reason || 'Movimentação não permitida pelas regras operacionais.');
    }

    if (this.serverRepo.serverManaged && this.serverRepo.moveAtomic) {
      return this.serverRepo.moveAtomic(organizationId, input, job.version ?? 1);
    }

    const prevStage = sortedStages[currentIndex];
    const targetStage = sortedStages[targetIndex];
    const nowISO = new Date().toISOString();

    const updatedJob: ProductionJob = {
      ...job,
      stageId: input.targetStageId,
      updatedAt: nowISO,
    };

    await this.jobRepo.save(organizationId, updatedJob);

    const methodLabel =
      input.method === 'DRAG_DROP'
        ? 'arraste'
        : input.method === 'KEYBOARD'
        ? 'teclado'
        : 'botão';
    const reasonSuffix = input.reversionReason?.trim()
      ? ` — Justificativa: ${input.reversionReason.trim()}`
      : '';

    const event: ProductionEvent = {
      id: this.generateId('evt'),
      jobId: job.id,
      organizationId,
      eventType: 'STAGE_CHANGED',
      fromValue: prevStage.name,
      toValue: targetStage.name,
      stageFromId: prevStage.id,
      stageToId: targetStage.id,
      method: input.method,
      description: `Etapa alterada de "${prevStage.name}" para "${targetStage.name}" via ${methodLabel}${reasonSuffix}`,
      reason: input.reversionReason?.trim(),
      authorId: input.userId,
      authorName: input.userName,
      timestamp: nowISO,
      dataOrigin: job.dataOrigin,
    };

    await this.eventRepo.append(organizationId, event);
    return updatedJob;
  }

  async moveStage(
    organizationId: string,
    jobId: string,
    targetStageId: string,
    stages: WorkflowStage[],
    author: { id: string; name: string },
    reversionReason?: string
  ): Promise<ProductionJob> {
    return this.transitionProductionJobStage(
      organizationId,
      {
        productionJobId: jobId,
        targetStageId,
        method: 'BUTTON',
        userId: author.id,
        userName: author.name,
        reversionReason,
      },
      stages
    );
  }

  async moveNextStage(
    organizationId: string,
    jobId: string,
    stages: WorkflowStage[],
    author: { id: string; name: string }
  ): Promise<ProductionJob> {
    const job = await this.jobRepo.getById(organizationId, jobId);
    if (!job) throw new Error(`OP ${jobId} não encontrada.`);

    const sortedStages = [...stages].sort((a, b) => a.sequence - b.sequence);
    const currentIndex = sortedStages.findIndex((s) => s.id === job.stageId);

    if (currentIndex < 0 || currentIndex >= sortedStages.length - 1) {
      return job; // Já está na última etapa
    }

    const nextStage = sortedStages[currentIndex + 1];
    return this.transitionProductionJobStage(
      organizationId,
      {
        productionJobId: jobId,
        targetStageId: nextStage.id,
        method: 'BUTTON',
        userId: author.id,
        userName: author.name,
      },
      stages
    );
  }

  async movePreviousStage(
    organizationId: string,
    jobId: string,
    stages: WorkflowStage[],
    author: { id: string; name: string },
    reversionReason?: string
  ): Promise<ProductionJob> {
    const job = await this.jobRepo.getById(organizationId, jobId);
    if (!job) throw new Error(`OP ${jobId} não encontrada.`);

    const sortedStages = [...stages].sort((a, b) => a.sequence - b.sequence);
    const currentIndex = sortedStages.findIndex((s) => s.id === job.stageId);

    if (currentIndex <= 0) {
      return job; // Já está na primeira etapa
    }

    const prevStage = sortedStages[currentIndex - 1];
    return this.transitionProductionJobStage(
      organizationId,
      {
        productionJobId: jobId,
        targetStageId: prevStage.id,
        method: 'BUTTON',
        userId: author.id,
        userName: author.name,
        reversionReason,
      },
      stages
    );
  }

  async updateArtworkGate(
    organizationId: string,
    jobId: string,
    newGate: ArtworkGate,
    author: { id: string; name: string },
    note?: string
  ): Promise<ProductionJob> {
    const job = await this.jobRepo.getById(organizationId, jobId);
    if (!job) throw new Error(`OP ${jobId} não encontrada.`);

    const prevGate = job.artworkGate;
    if (prevGate === newGate && !note) return job;

    if (this.serverRepo.serverManaged && this.serverRepo.updateAtomic) {
      return this.serverRepo.updateAtomic(organizationId, jobId, job.version ?? 1, 'artwork_gate', newGate, note);
    }

    const nowISO = new Date().toISOString();
    const updatedJob: ProductionJob = {
      ...job,
      artworkGate: newGate,
      updatedAt: nowISO,
    };

    await this.jobRepo.save(organizationId, updatedJob);

    const prevLabel = ARTWORK_GATE_CONFIG[prevGate]?.label || prevGate;
    const newLabel = ARTWORK_GATE_CONFIG[newGate]?.label || newGate;

    const event: ProductionEvent = {
      id: this.generateId('evt'),
      jobId: job.id,
      organizationId,
      eventType: 'ARTWORK_GATE_CHANGED',
      fromValue: prevGate,
      toValue: newGate,
      description: `Controle de Arte atualizado de "${prevLabel}" para "${newLabel}"${note ? ` — ${note}` : ''}`,
      authorId: author.id,
      authorName: author.name,
      timestamp: nowISO,
      dataOrigin: job.dataOrigin,
    };

    await this.eventRepo.append(organizationId, event);
    return updatedJob;
  }

  async updateMaterialGate(
    organizationId: string,
    jobId: string,
    newGate: MaterialGate,
    author: { id: string; name: string },
    note?: string
  ): Promise<ProductionJob> {
    const job = await this.jobRepo.getById(organizationId, jobId);
    if (!job) throw new Error(`OP ${jobId} não encontrada.`);

    const prevGate = job.materialGate;
    if (prevGate === newGate && !note) return job;

    if (this.serverRepo.serverManaged && this.serverRepo.updateAtomic) {
      return this.serverRepo.updateAtomic(organizationId, jobId, job.version ?? 1, 'material_gate', newGate, note);
    }

    const nowISO = new Date().toISOString();
    const updatedJob: ProductionJob = {
      ...job,
      materialGate: newGate,
      updatedAt: nowISO,
    };

    await this.jobRepo.save(organizationId, updatedJob);

    const prevLabel = MATERIAL_GATE_CONFIG[prevGate]?.label || prevGate;
    const newLabel = MATERIAL_GATE_CONFIG[newGate]?.label || newGate;

    const event: ProductionEvent = {
      id: this.generateId('evt'),
      jobId: job.id,
      organizationId,
      eventType: 'MATERIAL_GATE_CHANGED',
      fromValue: prevGate,
      toValue: newGate,
      description: `Controle de Material atualizado de "${prevLabel}" para "${newLabel}"${note ? ` — ${note}` : ''}`,
      authorId: author.id,
      authorName: author.name,
      timestamp: nowISO,
      dataOrigin: job.dataOrigin,
    };

    await this.eventRepo.append(organizationId, event);
    return updatedJob;
  }

  async updateFinancialGate(
    organizationId: string,
    jobId: string,
    newGate: FinancialGate,
    author: { id: string; name: string },
    note?: string
  ): Promise<ProductionJob> {
    const job = await this.jobRepo.getById(organizationId, jobId);
    if (!job) throw new Error(`OP ${jobId} não encontrada.`);

    const prevGate = job.financialGate;
    if (prevGate === newGate && !note) return job;

    if (this.serverRepo.serverManaged && this.serverRepo.updateAtomic) {
      return this.serverRepo.updateAtomic(organizationId, jobId, job.version ?? 1, 'financial_gate', newGate, note);
    }

    const nowISO = new Date().toISOString();
    const updatedJob: ProductionJob = {
      ...job,
      financialGate: newGate,
      updatedAt: nowISO,
    };

    await this.jobRepo.save(organizationId, updatedJob);

    const prevLabel = FINANCIAL_GATE_CONFIG[prevGate]?.label || prevGate;
    const newLabel = FINANCIAL_GATE_CONFIG[newGate]?.label || newGate;

    const event: ProductionEvent = {
      id: this.generateId('evt'),
      jobId: job.id,
      organizationId,
      eventType: 'FINANCIAL_GATE_CHANGED',
      fromValue: prevGate,
      toValue: newGate,
      description: `Controle Financeiro atualizado de "${prevLabel}" para "${newLabel}"${note ? ` — ${note}` : ''}`,
      authorId: author.id,
      authorName: author.name,
      timestamp: nowISO,
      dataOrigin: job.dataOrigin,
    };

    await this.eventRepo.append(organizationId, event);
    return updatedJob;
  }

  async updateAssignee(
    organizationId: string,
    jobId: string,
    assignee: { id: string; name: string; email?: string } | null,
    author: { id: string; name: string }
  ): Promise<ProductionJob> {
    const job = await this.jobRepo.getById(organizationId, jobId);
    if (!job) throw new Error(`OP ${jobId} não encontrada.`);

    const prevAssigneeName = job.assignee?.name || 'Não atribuído';
    const newAssigneeName = assignee?.name || 'Não atribuído';

    if (this.serverRepo.serverManaged && this.serverRepo.updateAtomic) {
      return this.serverRepo.updateAtomic(organizationId, jobId, job.version ?? 1, 'assignee', assignee?.id ?? '');
    }

    const nowISO = new Date().toISOString();
    const updatedJob: ProductionJob = {
      ...job,
      assignee,
      updatedAt: nowISO,
    };

    await this.jobRepo.save(organizationId, updatedJob);

    const event: ProductionEvent = {
      id: this.generateId('evt'),
      jobId: job.id,
      organizationId,
      eventType: 'ASSIGNEE_CHANGED',
      fromValue: prevAssigneeName,
      toValue: newAssigneeName,
      description: `Responsável alterado de "${prevAssigneeName}" para "${newAssigneeName}"`,
      authorId: author.id,
      authorName: author.name,
      timestamp: nowISO,
      dataOrigin: job.dataOrigin,
    };

    await this.eventRepo.append(organizationId, event);
    return updatedJob;
  }

  async updatePriority(
    organizationId: string,
    jobId: string,
    priority: Priority,
    author: { id: string; name: string }
  ): Promise<ProductionJob> {
    const job = await this.jobRepo.getById(organizationId, jobId);
    if (!job) throw new Error(`OP ${jobId} não encontrada.`);

    const prevPriority = job.priority;
    if (prevPriority === priority) return job;

    if (this.serverRepo.serverManaged && this.serverRepo.updateAtomic) {
      return this.serverRepo.updateAtomic(organizationId, jobId, job.version ?? 1, 'priority', priority);
    }

    const nowISO = new Date().toISOString();
    const updatedJob: ProductionJob = {
      ...job,
      priority,
      updatedAt: nowISO,
    };

    await this.jobRepo.save(organizationId, updatedJob);

    const prevLabel = PRIORITY_CONFIG[prevPriority]?.label || prevPriority;
    const newLabel = PRIORITY_CONFIG[priority]?.label || priority;

    const event: ProductionEvent = {
      id: this.generateId('evt'),
      jobId: job.id,
      organizationId,
      eventType: 'PRIORITY_CHANGED',
      fromValue: prevPriority,
      toValue: priority,
      description: `Prioridade alterada de "${prevLabel}" para "${newLabel}"`,
      authorId: author.id,
      authorName: author.name,
      timestamp: nowISO,
      dataOrigin: job.dataOrigin,
    };

    await this.eventRepo.append(organizationId, event);
    return updatedJob;
  }

  async updateDeadline(
    organizationId: string,
    jobId: string,
    deadlineISO: string,
    author: { id: string; name: string }
  ): Promise<ProductionJob> {
    const job = await this.jobRepo.getById(organizationId, jobId);
    if (!job) throw new Error(`OP ${jobId} não encontrada.`);

    const prevDeadline = job.deadlineISO;
    if (prevDeadline === deadlineISO) return job;

    if (this.serverRepo.serverManaged && this.serverRepo.updateAtomic) {
      return this.serverRepo.updateAtomic(organizationId, jobId, job.version ?? 1, 'deadline', deadlineISO);
    }

    const nowISO = new Date().toISOString();
    const updatedJob: ProductionJob = {
      ...job,
      deadlineISO,
      updatedAt: nowISO,
    };

    await this.jobRepo.save(organizationId, updatedJob);

    const event: ProductionEvent = {
      id: this.generateId('evt'),
      jobId: job.id,
      organizationId,
      eventType: 'DEADLINE_CHANGED',
      fromValue: prevDeadline,
      toValue: deadlineISO,
      description: `Prazo de entrega alterado para ${deadlineISO.substring(0, 10)}`,
      authorId: author.id,
      authorName: author.name,
      timestamp: nowISO,
      dataOrigin: job.dataOrigin,
    };

    await this.eventRepo.append(organizationId, event);
    return updatedJob;
  }

  async addNote(
    organizationId: string,
    jobId: string,
    note: string,
    author: { id: string; name: string }
  ): Promise<ProductionEvent> {
    const job = await this.jobRepo.getById(organizationId, jobId);
    if (!job) throw new Error(`OP ${jobId} não encontrada.`);

    if (this.serverRepo.serverManaged && this.serverRepo.addNoteAtomic) {
      await this.serverRepo.addNoteAtomic(organizationId, jobId, note);
      const events = await this.eventRepo.listByJobId(organizationId, jobId);
      const created = events.find(event => event.eventType === 'NOTE_ADDED' && event.description === note.trim());
      if (!created) throw new Error('Nota registrada não pôde ser recarregada.');
      return created;
    }

    const nowISO = new Date().toISOString();
    const event: ProductionEvent = {
      id: this.generateId('evt'),
      jobId: job.id,
      organizationId,
      eventType: 'NOTE_ADDED',
      description: note.trim(),
      authorId: author.id,
      authorName: author.name,
      timestamp: nowISO,
      dataOrigin: job.dataOrigin,
    };

    await this.eventRepo.append(organizationId, event);
    return event;
  }
}
