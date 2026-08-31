// src/repositories/procurement/LocalStoragePurchaseRequestItemRepository.ts

import { PurchaseRequestItem } from '../../types/procurement';
import { IPurchaseRequestItemRepository } from '../../types/procurementRepository';
import { storageKeys } from '../../repositories/storageKeys';
import { cloneSerializable, validateSafeInteger } from './common';
import { InvalidProcurementNumericValueError } from '../../errors/procurementErrors';

/** LocalStorage implementation for PurchaseRequestItem repository.
 * Items are immutable historical records; no delete operations are provided.
 */
export class LocalStoragePurchaseRequestItemRepository implements IPurchaseRequestItemRepository {
  /** Helper to obtain the browser's localStorage (or null in non-browser environments). */
  private getStorage(): Storage | null {
    return typeof window !== 'undefined' && window.localStorage ? window.localStorage : null;
  }

  /** Read all PurchaseRequestItem records for the given organization. */
  private readAll(organizationId: string): PurchaseRequestItem[] {
    const storage = this.getStorage();
    const key = storageKeys.purchaseRequestItems(organizationId);
    const raw = storage?.getItem(key);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  /** Persist the full list of items for the given organization. */
  private writeAll(organizationId: string, items: PurchaseRequestItem[]): void {
    const storage = this.getStorage();
    const key = storageKeys.purchaseRequestItems(organizationId);
    storage?.setItem(key, JSON.stringify(items));
  }

  /** Validate numeric fields of a PurchaseRequestItem. */
  private validate(item: PurchaseRequestItem): void {
    validateSafeInteger(item.requestedQuantityMilli, 'requestedQuantityMilli');
  }

  async getById(organizationId: string, id: string): Promise<PurchaseRequestItem | null> {
    const found = this.readAll(organizationId).find(i => i.id === id) ?? null;
    return found ? cloneSerializable(found) : null;
  }

  async listByRequest(organizationId: string, requestId: string): Promise<PurchaseRequestItem[]> {
    const items = this.readAll(organizationId).filter(i => i.purchaseRequestId === requestId);
    return cloneSerializable(items);
  }

  // ---- Compatibility wrappers (deprecated) ----
  async listByRequestId(organizationId: string, requestId: string): Promise<PurchaseRequestItem[]> {
    // @deprecated use listByRequest instead
    return this.listByRequest(organizationId, requestId);
  }

  async listAll(organizationId: string): Promise<PurchaseRequestItem[]> {
    return cloneSerializable(this.readAll(organizationId));
  }

  async create(organizationId: string, item: PurchaseRequestItem): Promise<PurchaseRequestItem> {
    this.validate(item);
    const items = this.readAll(organizationId);
    if (items.some(i => i.id === item.id)) {
      throw new InvalidProcurementNumericValueError('Duplicate PurchaseRequestItem id');
    }
    items.push(item);
    this.writeAll(organizationId, items);
    return cloneSerializable(item);
  }

  async createMany(organizationId: string, newItems: PurchaseRequestItem[]): Promise<PurchaseRequestItem[]> {
    // Validate every item first; abort entirely if any fail.
    newItems.forEach(i => this.validate(i));
    const existing = this.readAll(organizationId);
    const existingIds = new Set(existing.map(i => i.id));
    for (const it of newItems) {
      if (existingIds.has(it.id)) {
        throw new InvalidProcurementNumericValueError('Duplicate PurchaseRequestItem id in createMany');
      }
      existingIds.add(it.id);
    }
    const combined = existing.concat(newItems);
    this.writeAll(organizationId, combined);
    return cloneSerializable(newItems);
  }

  // ---- Deprecated mutation wrappers ----
  async save(organizationId: string, item: PurchaseRequestItem): Promise<PurchaseRequestItem> {
    // @deprecated use create instead
    return this.create(organizationId, item);
  }

  async saveMany(organizationId: string, items: PurchaseRequestItem[]): Promise<PurchaseRequestItem[]> {
    // @deprecated use createMany instead
    return this.createMany(organizationId, items);
  }

  // No delete methods – records are immutable historical.
}
