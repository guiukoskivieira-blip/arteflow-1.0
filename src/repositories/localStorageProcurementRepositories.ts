// src/repositories/localStorageProcurementRepositories.ts

export { LocalStorageSupplierRepository } from './procurement/LocalStorageSupplierRepository';
export { LocalStoragePurchaseRequestItemRepository } from './procurement/LocalStoragePurchaseRequestItemRepository';
export { PurchaseRequestRepository as LocalStoragePurchaseRequestRepository } from './procurement/PurchaseRequestRepository';
export { PurchaseOrderRepository as LocalStoragePurchaseOrderRepository } from './procurement/PurchaseOrderRepository';
export { PurchaseOrderItemRepository as LocalStoragePurchaseOrderItemRepository } from './procurement/PurchaseOrderItemRepository';
export { GoodsReceiptRepository as LocalStorageGoodsReceiptRepository } from './procurement/GoodsReceiptRepository';
export { GoodsReceiptItemRepository as LocalStorageGoodsReceiptItemRepository } from './procurement/GoodsReceiptItemRepository';

import { ProcurementEvent } from '../types/procurement';
import { IProcurementEventRepository, IProcurementSequenceRepository } from '../types/procurementRepository';
import { storageKeys } from './storageKeys';

export class LocalStorageProcurementEventRepository implements IProcurementEventRepository {
  private getStorage(): Storage | null {
    return typeof window !== 'undefined' && window.localStorage ? window.localStorage : null;
  }
  private readAll(orgId: string): ProcurementEvent[] {
    const storage = this.getStorage();
    if (!storage) return [];
    const raw = storage.getItem(storageKeys.procurementEvents(orgId));
    if (!raw) return [];
    try { const parsed = JSON.parse(raw); return Array.isArray(parsed) ? parsed : []; } catch { return []; }
  }
  private writeAll(orgId: string, data: ProcurementEvent[]): void {
    const storage = this.getStorage();
    if (!storage) return;
    storage.setItem(storageKeys.procurementEvents(orgId), JSON.stringify(data));
  }
  async listByEntity(orgId: string, entityType: string, entityId: string): Promise<ProcurementEvent[]> {
    return this.readAll(orgId).filter(e => e.entityType === entityType && e.entityId === entityId);
  }
  async listAll(orgId: string): Promise<ProcurementEvent[]> {
    return this.readAll(orgId);
  }
  async append(orgId: string, event: ProcurementEvent): Promise<ProcurementEvent> {
    const all = this.readAll(orgId);
    all.push(event);
    this.writeAll(orgId, all);
    return event;
  }
  async appendMany(orgId: string, events: ProcurementEvent[]): Promise<ProcurementEvent[]> {
    const all = this.readAll(orgId);
    all.push(...events);
    this.writeAll(orgId, all);
    return events;
  }
}

export class LocalStorageProcurementSequenceRepository implements IProcurementSequenceRepository {
  private getStorage(): Storage | null {
    return typeof window !== 'undefined' && window.localStorage ? window.localStorage : null;
  }
  async getNextSequence(orgId: string, prefix: 'SC' | 'PC' | 'REC', year: number): Promise<number> {
    const storage = this.getStorage();
    if (!storage) return 1;
    const key = `proc_seq_${orgId}_${prefix}_${year}`;
    const current = storage.getItem(key);
    const nextVal = current ? parseInt(current, 10) + 1 : 1;
    storage.setItem(key, nextVal.toString());
    return nextVal;
  }
  async setSequence(orgId: string, prefix: 'SC' | 'PC' | 'REC', year: number, val: number): Promise<void> {
    const storage = this.getStorage();
    if (!storage) return;
    const key = `proc_seq_${orgId}_${prefix}_${year}`;
    storage.setItem(key, val.toString());
  }
}
