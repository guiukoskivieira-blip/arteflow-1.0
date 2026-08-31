// src/repositories/procurement/PurchaseOrderItemRepository.ts
import { storageKeys } from '../../repositories/storageKeys';
import { PurchaseOrderItem } from '../../types/procurement';
import { IPurchaseOrderItemRepository } from '../../types/procurementRepository';
import { readList, writeList, cloneSerializable, validateSafeInteger } from './common';

export class PurchaseOrderItemRepository implements IPurchaseOrderItemRepository {
  private validate(orgId: string, item: PurchaseOrderItem): void {
    if (!item.id) throw new Error('Missing id');
    if (!item.organizationId) throw new Error('Missing organizationId');
    if (item.organizationId !== orgId) throw new Error('Organization mismatch');
    if (!item.purchaseOrderId) throw new Error('Missing purchaseOrderId');
    if (!item.materialId) throw new Error('Missing materialId');

    validateSafeInteger(item.orderedQuantityMilli, 'orderedQuantityMilli');
    validateSafeInteger(item.receivedQuantityMilli, 'receivedQuantityMilli');
    validateSafeInteger(item.unitCostCents, 'unitCostCents');
    validateSafeInteger(item.totalCostCents, 'totalCostCents');
  }

  async getById(organizationId: string, id: string): Promise<PurchaseOrderItem | null> {
    const all = readList<PurchaseOrderItem>(storageKeys.purchaseOrderItems(organizationId));
    const found = all.find(i => i.id === id) ?? null;
    return found ? cloneSerializable(found) : null;
  }

  async listAll(organizationId: string): Promise<PurchaseOrderItem[]> {
    const all = readList<PurchaseOrderItem>(storageKeys.purchaseOrderItems(organizationId));
    return cloneSerializable(all);
  }

  async listByOrderId(organizationId: string, orderId: string): Promise<PurchaseOrderItem[]> {
    const all = readList<PurchaseOrderItem>(storageKeys.purchaseOrderItems(organizationId));
    const filtered = all.filter(i => i.purchaseOrderId === orderId);
    return cloneSerializable(filtered);
  }

  async save(organizationId: string, item: PurchaseOrderItem): Promise<PurchaseOrderItem> {
    this.validate(organizationId, item);
    const all = readList<PurchaseOrderItem>(storageKeys.purchaseOrderItems(organizationId));

    const idx = all.findIndex(i => i.id === item.id);
    const copy = cloneSerializable(item);
    if (idx >= 0) {
      all[idx] = copy;
    } else {
      all.push(copy);
    }

    writeList(storageKeys.purchaseOrderItems(organizationId), all);
    return cloneSerializable(copy);
  }

  async saveMany(organizationId: string, items: PurchaseOrderItem[]): Promise<PurchaseOrderItem[]> {
    const all = readList<PurchaseOrderItem>(storageKeys.purchaseOrderItems(organizationId));

    for (const item of items) {
      this.validate(organizationId, item);
    }

    const allMap = new Map(all.map(i => [i.id, i]));

    for (const item of items) {
      allMap.set(item.id, cloneSerializable(item));
    }

    const newAll = Array.from(allMap.values());
    writeList(storageKeys.purchaseOrderItems(organizationId), newAll);
    return cloneSerializable(items);
  }
}
