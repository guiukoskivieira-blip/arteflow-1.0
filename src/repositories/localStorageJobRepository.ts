import { IProductionJobRepository } from '../types/repository';
import { ProductionJob } from '../types/domain';
import { storageKeys } from './storageKeys';

export class LocalStorageJobRepository implements IProductionJobRepository {
  private getStorage(): Storage | null {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
    return null;
  }

  private readAll(organizationId: string): ProductionJob[] {
    const storage = this.getStorage();
    if (!storage) return [];
    try {
      const raw = storage.getItem(storageKeys.jobs(organizationId));
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.error(`Erro ao ler OPs para org ${organizationId}:`, e);
      return [];
    }
  }

  private writeAll(organizationId: string, jobs: ProductionJob[]): void {
    const storage = this.getStorage();
    if (!storage) return;
    try {
      storage.setItem(storageKeys.jobs(organizationId), JSON.stringify(jobs));
    } catch (e) {
      console.error(`Erro ao salvar OPs para org ${organizationId}:`, e);
    }
  }

  async getById(organizationId: string, id: string): Promise<ProductionJob | null> {
    const jobs = this.readAll(organizationId);
    return jobs.find((j) => j.id === id) || null;
  }

  async getByJobCode(organizationId: string, jobCode: string): Promise<ProductionJob | null> {
    const jobs = this.readAll(organizationId);
    return jobs.find((j) => j.jobCode.toUpperCase() === jobCode.toUpperCase()) || null;
  }

  async list(organizationId: string): Promise<ProductionJob[]> {
    return this.readAll(organizationId);
  }

  async listByOrderId(organizationId: string, orderId: string): Promise<ProductionJob[]> {
    const jobs = this.readAll(organizationId);
    return jobs.filter((j) => j.orderId === orderId);
  }

  async listByStageId(organizationId: string, stageId: string): Promise<ProductionJob[]> {
    const jobs = this.readAll(organizationId);
    return jobs.filter((j) => j.stageId === stageId);
  }

  async save(organizationId: string, job: ProductionJob): Promise<ProductionJob> {
    const jobs = this.readAll(organizationId);
    const existingIndex = jobs.findIndex((j) => j.id === job.id);

    const updatedJob: ProductionJob = {
      ...job,
      updatedAt: new Date().toISOString(),
    };

    if (existingIndex >= 0) {
      jobs[existingIndex] = updatedJob;
    } else {
      jobs.unshift(updatedJob);
    }

    this.writeAll(organizationId, jobs);
    return updatedJob;
  }

  async saveMany(organizationId: string, newJobs: ProductionJob[]): Promise<ProductionJob[]> {
    const jobs = this.readAll(organizationId);
    const nowISO = new Date().toISOString();

    const processedJobs = newJobs.map((job) => ({
      ...job,
      updatedAt: nowISO,
    }));

    for (const pJob of processedJobs) {
      const idx = jobs.findIndex((j) => j.id === pJob.id);
      if (idx >= 0) {
        jobs[idx] = pJob;
      } else {
        jobs.unshift(pJob);
      }
    }

    this.writeAll(organizationId, jobs);
    return processedJobs;
  }

  async delete(organizationId: string, id: string): Promise<boolean> {
    const jobs = this.readAll(organizationId);
    const initialLen = jobs.length;
    const filtered = jobs.filter((j) => j.id !== id);
    if (filtered.length !== initialLen) {
      this.writeAll(organizationId, filtered);
      return true;
    }
    return false;
  }

  async clear(organizationId: string): Promise<void> {
    const storage = this.getStorage();
    if (storage) {
      storage.removeItem(storageKeys.jobs(organizationId));
    }
  }
}
