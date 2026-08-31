// src/repositories/procurement/PurchaseRequestItemRepository.ts
import { storageKeys } from '../../repositories/storageKeys';
import { PurchaseRequestItem } from '../../types/procurement';

export class PurchaseRequestItemRepository {
  private getStorage(): Storage | null {
    return typeof window !== 'undefined' && window.localStorage ? window.localStorage : null;
  }
  private readAll(orgId: string): PurchaseRequestItem[] {
    const storage = this.getStorage();
    if (!storage) return [];
    const raw = storage.getItem(storageKeys.purchaseRequestItems(orgId));
    if (!raw) return [];
    try { const parsed = JSON.parse(raw); return Array.isArray(parsed) ? parsed : []; } catch { return []; }
  }
  private writeAll(orgId: string, data: PurchaseRequestItem[]): void {
    const storage = this.getStorage();
    if (!storage) return;
    storage.setItem(storageKeys.purchaseRequestItems(orgId), JSON.stringify(data));
  }
  async list(orgId: string): Promise<PurchaseRequestItem[]> { return this.readAll(orgId); }
  async getById(orgId: string, id: string): Promise<PurchaseRequestItem | null> { return this.readAll(orgId).find(i => i.id === id) || null; }
  async save(orgId: string, item: PurchaseRequestItem): Promise<PurchaseRequestItem> {
    const all = this.readAll(orgId);
    const idx = all.findIndex(i => i.id === item.id);
    if (idx >= 0) all[idx] = item; else all.push(item);
    this.writeAll(orgId, all);
    return item;
  }
}
