// src/repositories/procurement/GoodsReceiptRepository.ts
import { storageKeys } from '../../repositories/storageKeys';
import { GoodsReceipt } from '../../types/procurement';
import { IGoodsReceiptRepository } from '../../types/procurementRepository';
import { readList, writeList, cloneSerializable } from './common';

export class GoodsReceiptRepository implements IGoodsReceiptRepository {
  private validate(orgId: string, receipt: GoodsReceipt): void {
    if (!receipt.id) throw new Error('Missing id');
    if (!receipt.organizationId) throw new Error('Missing organizationId');
    if (receipt.organizationId !== orgId) throw new Error('Organization mismatch');
    if (!receipt.purchaseOrderId) throw new Error('Missing purchaseOrderId');
    if (!receipt.receiptNumber) throw new Error('Missing receiptNumber');
    if (!receipt.idempotencyKey) throw new Error('Missing idempotencyKey');
    if (!receipt.receivedBy) throw new Error('Missing receivedBy');
    if (!receipt.dataOrigin) throw new Error('Missing dataOrigin');
  }

  async getById(organizationId: string, id: string): Promise<GoodsReceipt | null> {
    const all = readList<GoodsReceipt>(storageKeys.goodsReceipts(organizationId));
    const found = all.find(r => r.id === id) ?? null;
    return found ? cloneSerializable(found) : null;
  }

  async getByIdempotencyKey(organizationId: string, idempotencyKey: string): Promise<GoodsReceipt | null> {
    const all = readList<GoodsReceipt>(storageKeys.goodsReceipts(organizationId));
    const found = all.find(r => r.idempotencyKey === idempotencyKey) ?? null;
    return found ? cloneSerializable(found) : null;
  }

  async listByOrderId(organizationId: string, orderId: string): Promise<GoodsReceipt[]> {
    const all = readList<GoodsReceipt>(storageKeys.goodsReceipts(organizationId));
    const filtered = all.filter(r => r.purchaseOrderId === orderId);
    return cloneSerializable(filtered);
  }

  async listAll(organizationId: string): Promise<GoodsReceipt[]> {
    const all = readList<GoodsReceipt>(storageKeys.goodsReceipts(organizationId));
    return cloneSerializable(all);
  }

  async save(organizationId: string, receipt: GoodsReceipt): Promise<GoodsReceipt> {
    this.validate(organizationId, receipt);
    const all = readList<GoodsReceipt>(storageKeys.goodsReceipts(organizationId));

    const existingNum = all.find(r => r.receiptNumber === receipt.receiptNumber && r.id !== receipt.id);
    if (existingNum) throw new Error('Duplicate receiptNumber');

    const existingIdem = all.find(r => r.idempotencyKey === receipt.idempotencyKey && r.id !== receipt.id);
    if (existingIdem) throw new Error('Duplicate idempotencyKey');

    const idx = all.findIndex(r => r.id === receipt.id);
    const copy = cloneSerializable(receipt);
    if (idx >= 0) {
      all[idx] = copy;
    } else {
      all.push(copy);
    }

    writeList(storageKeys.goodsReceipts(organizationId), all);
    return cloneSerializable(copy);
  }

  async saveMany(organizationId: string, receipts: GoodsReceipt[]): Promise<GoodsReceipt[]> {
    const all = readList<GoodsReceipt>(storageKeys.goodsReceipts(organizationId));

    for (const r of receipts) {
      this.validate(organizationId, r);
    }

    const allMap = new Map(all.map(r => [r.id, r]));
    const numberMap = new Map(all.map(r => [r.receiptNumber, r.id]));
    const idemMap = new Map(all.map(r => [r.idempotencyKey, r.id]));

    for (const r of receipts) {
      const existingOwner = numberMap.get(r.receiptNumber);
      if (existingOwner && existingOwner !== r.id) {
        throw new Error(`Duplicate receiptNumber: ${r.receiptNumber}`);
      }
      numberMap.set(r.receiptNumber, r.id);

      const existingIdem = idemMap.get(r.idempotencyKey);
      if (existingIdem && existingIdem !== r.id) {
        throw new Error(`Duplicate idempotencyKey: ${r.idempotencyKey}`);
      }
      idemMap.set(r.idempotencyKey, r.id);
    }

    for (const r of receipts) {
      allMap.set(r.id, cloneSerializable(r));
    }

    const newAll = Array.from(allMap.values());
    writeList(storageKeys.goodsReceipts(organizationId), newAll);
    return cloneSerializable(receipts);
  }
}
