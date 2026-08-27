import {
  ProductionJob,
  WorkflowStage,
  ArtworkGate,
  MaterialGate,
  FinancialGate,
  Priority,
  ProductionEvent,
} from '../types/domain';
import { IProductionJobRepository, IProductionEventRepository } from '../types/repository';
import { ARTWORK_GATE_CONFIG, MATERIAL_GATE_CONFIG, FINANCIAL_GATE_CONFIG, PRIORITY_CONFIG } from '../domain/constants';

export class JobService {
  constructor(
    private jobRepo: IProductionJobRepository,
    private eventRepo: IProductionEventRepository
  ) {}

  private generateId(prefix: string): string {
    const random = Math.random().toString(36).substring(2, 9);
    const timestamp = Date.now().toString(36);
    return `${prefix}-${timestamp}-${random}`;
  }

  async moveStage(
    organizationId: string,
    jobId: string,
    targetStageId: string,
    stages: WorkflowStage[],
    author: { id: string; name: string }
  ): Promise<ProductionJob> {
    const job = await this.jobRepo.getById(organizationId, jobId);
    if (!job) {
      throw new Error(`Ordem de Produção ${jobId} não encontrada.`);
    }

    const previousStageId = job.stageId;
    if (previousStageId === targetStageId) {
      return job;
    }

    const targetStage = stages.find((s) => s.id === targetStageId);
    const prevStage = stages.find((s) => s.id === previousStageId);

    const nowISO = new Date().toISOString();
    const updatedJob: ProductionJob = {
      ...job,
      stageId: targetStageId,
      updatedAt: nowISO,
    };

    await this.jobRepo.save(organizationId, updatedJob);

    // Registro no histórico append-only
    const event: ProductionEvent = {
      id: this.generateId('evt'),
      jobId: job.id,
      organizationId,
      eventType: 'STAGE_CHANGED',
      fromValue: previousStageId,
      toValue: targetStageId,
      description: `Etapa alterada de "${prevStage?.name || previousStageId}" para "${targetStage?.name || targetStageId}"`,
      authorId: author.id,
      authorName: author.name,
      timestamp: nowISO,
      dataOrigin: job.dataOrigin,
    };

    await this.eventRepo.append(organizationId, event);
    return updatedJob;
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
    return this.moveStage(organizationId, jobId, nextStage.id, stages, author);
  }

  async movePreviousStage(
    organizationId: string,
    jobId: string,
    stages: WorkflowStage[],
    author: { id: string; name: string }
  ): Promise<ProductionJob> {
    const job = await this.jobRepo.getById(organizationId, jobId);
    if (!job) throw new Error(`OP ${jobId} não encontrada.`);

    const sortedStages = [...stages].sort((a, b) => a.sequence - b.sequence);
    const currentIndex = sortedStages.findIndex((s) => s.id === job.stageId);

    if (currentIndex <= 0) {
      return job; // Já está na primeira etapa
    }

    const prevStage = sortedStages[currentIndex - 1];
    return this.moveStage(organizationId, jobId, prevStage.id, stages, author);
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
