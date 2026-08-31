// src/repositories/procurement/PurchaseOrderRepository.ts
import { storageKeys } from '../../repositories/storageKeys';
import { PurchaseOrder } from '../../types/procurement';
import { IPurchaseOrderRepository } from '../../types/procurementRepository';
import { readList, writeList, cloneSerializable, validateSafeInteger } from './common';

export class PurchaseOrderRepository implements IPurchaseOrderRepository {
  private validate(orgId: string, order: PurchaseOrder): void {
    if (!order.id) throw new Error('Missing id');
    if (!order.organizationId) throw new Error('Missing organizationId');
    if (order.organizationId !== orgId) throw new Error('Organization mismatch');
    if (!order.orderNumber) throw new Error('Missing orderNumber');
    if (!order.supplierId) throw new Error('Missing supplierId');
    if (!order.status) throw new Error('Missing status');

    validateSafeInteger(order.freightCents, 'freightCents');
    validateSafeInteger(order.discountCents, 'discountCents');
    validateSafeInteger(order.subtotalCents, 'subtotalCents');
    validateSafeInteger(order.totalCents, 'totalCents');
  }

  async getById(organizationId: string, id: string): Promise<PurchaseOrder | null> {
    const all = readList<PurchaseOrder>(storageKeys.purchaseOrders(organizationId));
    const found = all.find(p => p.id === id) ?? null;
    return found ? cloneSerializable(found) : null;
  }

  async getByOrderNumber(organizationId: string, orderNumber: string): Promise<PurchaseOrder | null> {
    const all = readList<PurchaseOrder>(storageKeys.purchaseOrders(organizationId));
    const found = all.find(p => p.orderNumber === orderNumber) ?? null;
    return found ? cloneSerializable(found) : null;
  }

  async listAll(organizationId: string): Promise<PurchaseOrder[]> {
    const all = readList<PurchaseOrder>(storageKeys.purchaseOrders(organizationId));
    return cloneSerializable(all);
  }

  async listBySupplierId(organizationId: string, supplierId: string): Promise<PurchaseOrder[]> {
    const all = readList<PurchaseOrder>(storageKeys.purchaseOrders(organizationId));
    const filtered = all.filter(p => p.supplierId === supplierId);
    return cloneSerializable(filtered);
  }

  async save(organizationId: string, order: PurchaseOrder): Promise<PurchaseOrder> {
    this.validate(organizationId, order);
    const all = readList<PurchaseOrder>(storageKeys.purchaseOrders(organizationId));

    const existingNum = all.find(p => p.orderNumber === order.orderNumber && p.id !== order.id);
    if (existingNum) throw new Error('Duplicate orderNumber');

    const idx = all.findIndex(p => p.id === order.id);
    const copy = cloneSerializable(order);
    if (idx >= 0) {
      all[idx] = copy;
    } else {
      all.push(copy);
    }

    writeList(storageKeys.purchaseOrders(organizationId), all);
    return cloneSerializable(copy);
  }

  async saveMany(organizationId: string, orders: PurchaseOrder[]): Promise<PurchaseOrder[]> {
    const all = readList<PurchaseOrder>(storageKeys.purchaseOrders(organizationId));

    for (const order of orders) {
      this.validate(organizationId, order);
    }

    const allMap = new Map(all.map(p => [p.id, p]));
    const numberMap = new Map(all.map(p => [p.orderNumber, p.id]));

    for (const order of orders) {
      const existingOwner = numberMap.get(order.orderNumber);
      if (existingOwner && existingOwner !== order.id) {
        throw new Error(`Duplicate orderNumber: ${order.orderNumber}`);
      }
      numberMap.set(order.orderNumber, order.id);
    }

    for (const order of orders) {
      allMap.set(order.id, cloneSerializable(order));
    }

    const newAll = Array.from(allMap.values());
    writeList(storageKeys.purchaseOrders(organizationId), newAll);
    return cloneSerializable(orders);
  }
}
