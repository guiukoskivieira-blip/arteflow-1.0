import { IMovementRepository } from '../types/repository';
import { StockMovement } from '../types/inventory';
import { storageKeys } from './storageKeys';

export class LocalStorageMovementRepository implements IMovementRepository {
  private getStorage(): Storage | null {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
    return null;
  }

  private readAll(organizationId: string): StockMovement[] {
    const storage = this.getStorage();
    if (!storage) return [];
    try {
      const raw = storage.getItem(storageKeys.movements(organizationId));
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.error(`Erro ao ler movimentações de estoque para org ${organizationId}:`, e);
      return [];
    }
  }

  private writeAll(organizationId: string, movements: StockMovement[]): void {
    const storage = this.getStorage();
    if (!storage) return;
    try {
      storage.setItem(storageKeys.movements(organizationId), JSON.stringify(movements));
    } catch (e) {
      console.error(`Erro ao salvar movimentações para org ${organizationId}:`, e);
    }
  }

  async getById(organizationId: string, id: string): Promise<StockMovement | null> {
    const all = this.readAll(organizationId);
    return all.find((m) => m.id === id) || null;
  }

  async listByMaterialId(organizationId: string, materialId: string): Promise<StockMovement[]> {
    const all = this.readAll(organizationId);
    return all
      .filter((m) => m.materialId === materialId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async listAll(organizationId: string): Promise<StockMovement[]> {
    const all = this.readAll(organizationId);
    return all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async append(organizationId: string, movement: StockMovement): Promise<StockMovement> {
    const all = this.readAll(organizationId);
    all.push(movement);
    this.writeAll(organizationId, all);
    return movement;
  }

  async appendMany(organizationId: string, movements: StockMovement[]): Promise<StockMovement[]> {
    const all = this.readAll(organizationId);
    all.push(...movements);
    this.writeAll(organizationId, all);
    return movements;
  }

  async clear(organizationId: string): Promise<void> {
    const storage = this.getStorage();
    if (storage) {
      storage.removeItem(storageKeys.movements(organizationId));
    }
  }
}
