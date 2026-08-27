import { IRequirementRepository } from '../types/repository';
import { ProductionMaterialRequirement } from '../types/inventory';
import { storageKeys } from './storageKeys';

export class LocalStorageRequirementRepository implements IRequirementRepository {
  private getStorage(): Storage | null {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
    return null;
  }

  private readAll(organizationId: string): ProductionMaterialRequirement[] {
    const storage = this.getStorage();
    if (!storage) return [];
    try {
      const raw = storage.getItem(storageKeys.requirements(organizationId));
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.error(`Erro ao ler requisitos para org ${organizationId}:`, e);
      return [];
    }
  }

  private writeAll(organizationId: string, reqs: ProductionMaterialRequirement[]): void {
    const storage = this.getStorage();
    if (!storage) return;
    try {
      storage.setItem(storageKeys.requirements(organizationId), JSON.stringify(reqs));
    } catch (e) {
      console.error(`Erro ao salvar requisitos para org ${organizationId}:`, e);
    }
  }

  async getById(organizationId: string, id: string): Promise<ProductionMaterialRequirement | null> {
    const all = this.readAll(organizationId);
    return all.find((r) => r.id === id) || null;
  }

  async listByJobId(organizationId: string, jobId: string): Promise<ProductionMaterialRequirement[]> {
    const all = this.readAll(organizationId);
    return all.filter((r) => r.productionJobId === jobId);
  }

  async listAll(organizationId: string): Promise<ProductionMaterialRequirement[]> {
    return this.readAll(organizationId);
  }

  async save(organizationId: string, req: ProductionMaterialRequirement): Promise<ProductionMaterialRequirement> {
    const all = this.readAll(organizationId);
    const existingIndex = all.findIndex((r) => r.id === req.id);
    if (existingIndex >= 0) {
      all[existingIndex] = req;
    } else {
      all.push(req);
    }
    this.writeAll(organizationId, all);
    return req;
  }

  async saveMany(organizationId: string, reqs: ProductionMaterialRequirement[]): Promise<ProductionMaterialRequirement[]> {
    const all = this.readAll(organizationId);
    for (const req of reqs) {
      const idx = all.findIndex((r) => r.id === req.id);
      if (idx >= 0) {
        all[idx] = req;
      } else {
        all.push(req);
      }
    }
    this.writeAll(organizationId, all);
    return reqs;
  }

  async delete(organizationId: string, id: string): Promise<boolean> {
    const all = this.readAll(organizationId);
    const filtered = all.filter((r) => r.id !== id);
    if (filtered.length !== all.length) {
      this.writeAll(organizationId, filtered);
      return true;
    }
    return false;
  }

  async clear(organizationId: string): Promise<void> {
    const storage = this.getStorage();
    if (storage) {
      storage.removeItem(storageKeys.requirements(organizationId));
    }
  }
}
