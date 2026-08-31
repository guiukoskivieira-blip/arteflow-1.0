// src/repositories/procurement/SupplierRepository.ts
import { storageKeys } from '../../repositories/storageKeys';
import { Supplier } from '../../types/procurement';

/** Repository for Supplier entities. Scoped by organizationId. */
export class SupplierRepository {
  private getStorage(): Storage | null {
    return typeof window !== 'undefined' && window.localStorage ? window.localStorage : null;
  }

  private readAll(orgId: string): Supplier[] {
    const storage = this.getStorage();
    if (!storage) return [];
    const raw = storage.getItem(storageKeys.suppliers(orgId));
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private writeAll(orgId: string, data: Supplier[]): void {
    const storage = this.getStorage();
    if (!storage) return;
    storage.setItem(storageKeys.suppliers(orgId), JSON.stringify(data));
  }

  async list(orgId: string): Promise<Supplier[]> {
    return this.readAll(orgId);
  }

  async getById(orgId: string, id: string): Promise<Supplier | null> {
    return this.readAll(orgId).find(s => s.id === id) || null;
  }

  /** Save creates or updates a supplier. Deletion is not allowed; use isActive toggle. */
  async save(orgId: string, supplier: Supplier): Promise<Supplier> {
    const all = this.readAll(orgId);
    const idx = all.findIndex(s => s.id === supplier.id);
    if (idx >= 0) {
      all[idx] = supplier;
    } else {
      all.push(supplier);
    }
    this.writeAll(orgId, all);
    return supplier;
  }
}
