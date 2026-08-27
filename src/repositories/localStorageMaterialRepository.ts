import { IMaterialRepository } from '../types/repository';
import { InventoryMaterial } from '../types/inventory';
import { storageKeys } from './storageKeys';

export class LocalStorageMaterialRepository implements IMaterialRepository {
  private getStorage(): Storage | null {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
    return null;
  }

  private readAll(organizationId: string): InventoryMaterial[] {
    const storage = this.getStorage();
    if (!storage) return [];
    try {
      const raw = storage.getItem(storageKeys.materials(organizationId));
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.error(`Erro ao ler materiais para org ${organizationId}:`, e);
      return [];
    }
  }

  private writeAll(organizationId: string, materials: InventoryMaterial[]): void {
    const storage = this.getStorage();
    if (!storage) return;
    try {
      storage.setItem(storageKeys.materials(organizationId), JSON.stringify(materials));
    } catch (e) {
      console.error(`Erro ao salvar materiais para org ${organizationId}:`, e);
    }
  }

  async getById(organizationId: string, id: string): Promise<InventoryMaterial | null> {
    const all = this.readAll(organizationId);
    return all.find((m) => m.id === id) || null;
  }

  async getBySku(organizationId: string, sku: string): Promise<InventoryMaterial | null> {
    const all = this.readAll(organizationId);
    const normalized = sku.trim().toUpperCase();
    return all.find((m) => m.sku.trim().toUpperCase() === normalized) || null;
  }

  async list(organizationId: string): Promise<InventoryMaterial[]> {
    return this.readAll(organizationId);
  }

  async save(organizationId: string, material: InventoryMaterial): Promise<InventoryMaterial> {
    const all = this.readAll(organizationId);
    const existingIndex = all.findIndex((m) => m.id === material.id);
    if (existingIndex >= 0) {
      all[existingIndex] = material;
    } else {
      all.push(material);
    }
    this.writeAll(organizationId, all);
    return material;
  }

  async saveMany(organizationId: string, materials: InventoryMaterial[]): Promise<InventoryMaterial[]> {
    const all = this.readAll(organizationId);
    for (const mat of materials) {
      const idx = all.findIndex((m) => m.id === mat.id);
      if (idx >= 0) {
        all[idx] = mat;
      } else {
        all.push(mat);
      }
    }
    this.writeAll(organizationId, all);
    return materials;
  }

  async delete(organizationId: string, id: string): Promise<boolean> {
    const all = this.readAll(organizationId);
    const filtered = all.filter((m) => m.id !== id);
    if (filtered.length !== all.length) {
      this.writeAll(organizationId, filtered);
      return true;
    }
    return false;
  }

  async clear(organizationId: string): Promise<void> {
    const storage = this.getStorage();
    if (storage) {
      storage.removeItem(storageKeys.materials(organizationId));
    }
  }
}
