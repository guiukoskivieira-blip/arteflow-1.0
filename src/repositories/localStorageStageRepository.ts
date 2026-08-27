import { IWorkflowStageRepository } from '../types/repository';
import { WorkflowStage } from '../types/domain';
import { storageKeys } from './storageKeys';
import { getInitialStages } from '../domain/seed';

export class LocalStorageStageRepository implements IWorkflowStageRepository {
  private getStorage(): Storage | null {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
    return null;
  }

  private readAll(organizationId: string): WorkflowStage[] {
    const storage = this.getStorage();
    if (!storage) return getInitialStages(organizationId);
    try {
      const raw = storage.getItem(storageKeys.stages(organizationId));
      if (!raw) {
        const initial = getInitialStages(organizationId);
        this.writeAll(organizationId, initial);
        return initial;
      }
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.sort((a, b) => a.sequence - b.sequence);
      }
      const initial = getInitialStages(organizationId);
      this.writeAll(organizationId, initial);
      return initial;
    } catch (e) {
      console.error(`Erro ao ler etapas para org ${organizationId}:`, e);
      return getInitialStages(organizationId);
    }
  }

  private writeAll(organizationId: string, stages: WorkflowStage[]): void {
    const storage = this.getStorage();
    if (!storage) return;
    try {
      storage.setItem(storageKeys.stages(organizationId), JSON.stringify(stages));
    } catch (e) {
      console.error(`Erro ao salvar etapas para org ${organizationId}:`, e);
    }
  }

  async list(organizationId: string): Promise<WorkflowStage[]> {
    return this.readAll(organizationId);
  }

  async getById(organizationId: string, id: string): Promise<WorkflowStage | null> {
    const stages = this.readAll(organizationId);
    return stages.find((s) => s.id === id) || null;
  }

  async save(organizationId: string, stage: WorkflowStage): Promise<WorkflowStage> {
    const stages = this.readAll(organizationId);
    const existingIndex = stages.findIndex((s) => s.id === stage.id);
    if (existingIndex >= 0) {
      stages[existingIndex] = stage;
    } else {
      stages.push(stage);
    }
    stages.sort((a, b) => a.sequence - b.sequence);
    this.writeAll(organizationId, stages);
    return stage;
  }

  async saveMany(organizationId: string, stages: WorkflowStage[]): Promise<WorkflowStage[]> {
    const sorted = [...stages].sort((a, b) => a.sequence - b.sequence);
    this.writeAll(organizationId, sorted);
    return sorted;
  }

  async clear(organizationId: string): Promise<void> {
    const storage = this.getStorage();
    if (storage) {
      storage.removeItem(storageKeys.stages(organizationId));
    }
  }
}
