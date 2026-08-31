// src/test/procurementRepositoriesPartA.test.ts

import { describe, it, expect, beforeEach } from 'vitest';
import { LocalStorageSupplierRepository } from '../repositories/localStorageProcurementRepositories';
import { LocalStoragePurchaseRequestItemRepository } from '../repositories/localStorageProcurementRepositories';
import { DuplicateSupplierDocumentError, InvalidProcurementNumericValueError } from '../errors/procurementErrors';
import { Supplier, PurchaseRequestItem } from '../types/procurement';

/** Simple inâ€‘memory mock for window.localStorage */
class MemoryStorage implements Storage {
  private store: Record<string, string> = {};
  get length(): number { return Object.keys(this.store).length; }
  clear() { this.store = {}; }
  getItem(key: string): string | null { return this.store[key] ?? null; }
  key(index: number): string | null { return Object.keys(this.store)[index] ?? null; }
  removeItem(key: string): void { delete this.store[key]; }
  setItem(key: string, value: string): void { this.store[key] = value; }
}

beforeEach(() => {
  // @ts-ignore: assign mock to global window
  (global as any).window = { localStorage: new MemoryStorage() };
});

describe('LocalStorageSupplierRepository', () => {
  const orgA = 'orgA';
  const orgB = 'orgB';
  const repo = new LocalStorageSupplierRepository();

  it('lists empty initially', async () => {
    const list = await repo.list(orgA);
    expect(list).toEqual([]);
  });

  it('creates a supplier and enforces document uniqueness within organization', async () => {
    const supplier: Supplier = {
      id: 's1',
      organizationId: orgA,
      tradeName: 'Acme', code: 'S1', dataOrigin: 'user',
      document: '123-45-6789',
      isActive: true,
      createdAt: '',
      updatedAt: '',
    };
    const created = await repo.create(orgA, supplier);
    expect(created.id).toBe('s1');
    // duplicate doc should error
    const dup = { ...supplier, id: 's2' };
    await expect(repo.create(orgA, dup)).rejects.toBeInstanceOf(DuplicateSupplierDocumentError);
    // same doc allowed in different org
    const otherOrgSup = { ...supplier, id: 's3', organizationId: orgB };
    await expect(repo.create(orgB, otherOrgSup)).resolves.toBeTruthy();
  });

  it('prevents changing immutable fields', async () => {
    const supplier: Supplier = { id: 's4', organizationId: orgA, tradeName: 'Foo', code: 'S2', dataOrigin: 'user', document: '111', isActive: true, createdAt: '', updatedAt: '' };
    await repo.create(orgA, supplier);
    await expect(repo.update(orgA, 's4', { id: 'newId' } as any)).rejects.toThrow();
    await expect(repo.update(orgA, 's4', { organizationId: 'other' } as any)).rejects.toThrow();
  });

  it('deactivates supplier', async () => {
    const supplier: Supplier = { id: 's5', organizationId: orgA, tradeName: 'Bar', code: 'S3', dataOrigin: 'user', document: '222', isActive: true, createdAt: '', updatedAt: '' };
    await repo.create(orgA, supplier);
    await repo.deactivate(orgA, 's5');
    const fetched = await repo.getById(orgA, 's5');
    expect(fetched?.isActive).toBe(false);
  });

  it('returns deep cloned objects', async () => {
    const supplier: Supplier = { id: 's6', organizationId: orgA, tradeName: 'Baz', code: 'S4', dataOrigin: 'user', document: '333', isActive: true, createdAt: '', updatedAt: '' };
    const created = await repo.create(orgA, supplier);
    created.tradeName = 'Changed';
    const stored = await repo.getById(orgA, 's6');
    expect(stored?.tradeName).toBe('Baz');
  });
});

describe('LocalStoragePurchaseRequestItemRepository', () => {
  const org = 'orgX';
  const repo = new LocalStoragePurchaseRequestItemRepository();

  it('creates item and validates numeric field', async () => {
    const item: PurchaseRequestItem = {
      id: 'pr1',
      purchaseRequestId: 'req1',
      productId: 'prod1',
      requestedQuantityMilli: 1000,
    } as any; // other fields omitted for brevity
    const created = await repo.create(org, item);
    expect(created.id).toBe('pr1');
    const invalidItem = { ...item, id: 'pr2', requestedQuantityMilli: 3.14 } as any;
    await expect(repo.create(org, invalidItem)).rejects.toBeInstanceOf(InvalidProcurementNumericValueError);
  });

  it('prevents duplicate ids', async () => {
    const item: PurchaseRequestItem = { id: 'dup1', purchaseRequestId: 'req2', productId: 'p1', requestedQuantityMilli: 500 } as any;
    await repo.create(org, item);
    await expect(repo.create(org, item)).rejects.toBeInstanceOf(InvalidProcurementNumericValueError);
  });

  it('createMany atomicity', async () => {
    const items = [
      { id: 'm1', purchaseRequestId: 'r1', productId: 'p1', requestedQuantityMilli: 100 } as any,
      { id: 'm2', purchaseRequestId: 'r1', productId: 'p2', requestedQuantityMilli: 200 } as any,
    ];
    const created = await repo.createMany(org, items);
    expect(created).toHaveLength(2);
    // batch with duplicate id should abort
    const badBatch = [
      { id: 'm3', purchaseRequestId: 'r2', productId: 'p3', requestedQuantityMilli: 300 } as any,
      { id: 'm1', purchaseRequestId: 'r2', productId: 'p4', requestedQuantityMilli: 400 } as any, // duplicate of existing m1
    ];
    await expect(repo.createMany(org, badBatch)).rejects.toBeInstanceOf(InvalidProcurementNumericValueError);
    // ensure existing items unchanged
    const all = await repo.listAll(org);
    expect(all.map(i => i.id)).toEqual(['m1', 'm2']);
  });
});
