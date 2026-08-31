// src/repositories/procurement/GoodsReceiptItemRepository.ts
import { storageKeys } from '../../repositories/storageKeys';
import { GoodsReceiptItem } from '../../types/procurement';
import { IGoodsReceiptItemRepository } from '../../types/procurementRepository';
import { readList, writeList, cloneSerializable, validateSafeInteger } from './common';

export class GoodsReceiptItemRepository implements IGoodsReceiptItemRepository {
  private validate(orgId: string, item: GoodsReceiptItem): void {
    if (!item.id) throw new Error('Missing id');
    if (!item.organizationId) throw new Error('Missing organizationId');
    if (item.organizationId !== orgId) throw new Error('Organization mismatch');
    if (!item.goodsReceiptId) throw new Error('Missing goodsReceiptId');
    if (!item.purchaseOrderItemId) throw new Error('Missing purchaseOrderItemId');

    validateSafeInteger(item.receivedQuantityMilli, 'receivedQuantityMilli');
    if (item.receivedQuantityMilli < 0) {
        throw new Error('receivedQuantityMilli cannot be negative');
    }
    validateSafeInteger(item.unitCostCents, 'unitCostCents');
    validateSafeInteger(item.totalCostCents, 'totalCostCents');
  }

  async getById(organizationId: string, id: string): Promise<GoodsReceiptItem | null> {
    const all = readList<GoodsReceiptItem>(storageKeys.goodsReceiptItems(organizationId));
    const found = all.find(i => i.id === id) ?? null;
    return found ? cloneSerializable(found) : null;
  }

  async listAll(organizationId: string): Promise<GoodsReceiptItem[]> {
    const all = readList<GoodsReceiptItem>(storageKeys.goodsReceiptItems(organizationId));
    return cloneSerializable(all);
  }

  async listByReceiptId(organizationId: string, receiptId: string): Promise<GoodsReceiptItem[]> {
    const all = readList<GoodsReceiptItem>(storageKeys.goodsReceiptItems(organizationId));
    const filtered = all.filter(i => i.goodsReceiptId === receiptId);
    return cloneSerializable(filtered);
  }

  async save(organizationId: string, item: GoodsReceiptItem): Promise<GoodsReceiptItem> {
    this.validate(organizationId, item);
    const all = readList<GoodsReceiptItem>(storageKeys.goodsReceiptItems(organizationId));

    const idx = all.findIndex(i => i.id === item.id);
    const copy = cloneSerializable(item);
    if (idx >= 0) {
      all[idx] = copy;
    } else {
      all.push(copy);
    }

    writeList(storageKeys.goodsReceiptItems(organizationId), all);
    return cloneSerializable(copy);
  }

  async saveMany(organizationId: string, items: GoodsReceiptItem[]): Promise<GoodsReceiptItem[]> {
    const all = readList<GoodsReceiptItem>(storageKeys.goodsReceiptItems(organizationId));

    for (const item of items) {
      this.validate(organizationId, item);
    }

    const allMap = new Map(all.map(i => [i.id, i]));

    for (const item of items) {
      allMap.set(item.id, cloneSerializable(item));
    }

    const newAll = Array.from(allMap.values());
    writeList(storageKeys.goodsReceiptItems(organizationId), newAll);
    return cloneSerializable(items);
  }
}
