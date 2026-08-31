// src/repositories/procurement/LocalStorageSupplierRepository.ts
import { ISupplierRepository } from '../../types/procurementRepository';
import { Supplier } from '../../types/procurement';
import { storageKeys } from '../../repositories/storageKeys';
import { cloneSerializable, normalizeDocument } from './common';
import { DuplicateSupplierDocumentError } from '../../errors/procurementErrors';

/**
 * LocalStorage implementation of the supplier repository.
 * All data is scoped by `organizationId` to ensure isolation.
 */
export class LocalStorageSupplierRepository implements ISupplierRepository {
  /** Helper to obtain the browser's localStorage (or null in non‑browser environments). */
  private getStorage(): Storage | null {
    return typeof window !== 'undefined' && window.localStorage ? window.localStorage : null;
  }

  /** Read all suppliers for a given organization from localStorage. */
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

  /** Persist the full supplier array for an organization. */
  private writeAll(orgId: string, data: Supplier[]): void {
    const storage = this.getStorage();
    if (!storage) return;
    storage.setItem(storageKeys.suppliers(orgId), JSON.stringify(data));
  }

  // --------------------------------------------------------------------------
  // Canonical methods
  // --------------------------------------------------------------------------

  async list(organizationId: string): Promise<Supplier[]> {
    const suppliers = this.readAll(organizationId);
    return cloneSerializable(suppliers);
  }

  async getById(organizationId: string, id: string): Promise<Supplier | null> {
    const supplier = this.readAll(organizationId).find((s) => s.id === id) || null;
    return supplier ? cloneSerializable(supplier) : null;
  }

  async getByCode(organizationId: string, code: string): Promise<Supplier | null> {
    const supplier = this.readAll(organizationId).find((s) => s.code === code) || null;
    return supplier ? cloneSerializable(supplier) : null;
  }

  async getByDocument(organizationId: string, document: string): Promise<Supplier | null> {
    const normDoc = normalizeDocument(document);
    if (!normDoc) return null;
    const supplier = this.readAll(organizationId).find(
      (s) => normalizeDocument(s.document) === normDoc,
    ) || null;
    return supplier ? cloneSerializable(supplier) : null;
  }

  async create(organizationId: string, supplier: Supplier): Promise<Supplier> {
    // Validate organization match
    if (supplier.organizationId !== organizationId) {
      throw new Error('Supplier organizationId does not match the provided organizationId');
    }
    const all = this.readAll(organizationId);
    // Enforce unique document per organization (if document provided)
    const newDocNorm = normalizeDocument(supplier.document);
    if (newDocNorm) {
      const duplicate = all.find((s) => normalizeDocument(s.document) === newDocNorm);
      if (duplicate) {
        throw new DuplicateSupplierDocumentError();
      }
    }
    const now = new Date().toISOString();
    const toPersist: Supplier = {
      ...supplier,
      createdAt: supplier.createdAt ?? now,
      updatedAt: now,
    };
    all.push(toPersist);
    this.writeAll(organizationId, all);
    return cloneSerializable(toPersist);
  }

  async update(
    organizationId: string,
    supplierId: string,
    changes: Partial<Supplier>,
  ): Promise<Supplier> {
    const all = this.readAll(organizationId);
    const index = all.findIndex((s) => s.id === supplierId);
    if (index < 0) {
      throw new Error(`Supplier with id ${supplierId} not found`);
    }
    const existing = all[index];
    // Immutable fields cannot be changed
    if (changes.id && changes.id !== existing.id) {
      throw new Error('Cannot change supplier id');
    }
    if (changes.organizationId && changes.organizationId !== existing.organizationId) {
      throw new Error('Cannot change supplier organizationId');
    }
    // If document is changed, enforce uniqueness
    if (changes.document !== undefined) {
      const newNorm = normalizeDocument(changes.document);
      if (newNorm) {
        const duplicate = all.find(
          (s) => s.id !== supplierId && normalizeDocument(s.document) === newNorm,
        );
        if (duplicate) {
          throw new DuplicateSupplierDocumentError();
        }
      }
    }
    const updated: Supplier = {
      ...existing,
      ...changes,
      id: existing.id,
      organizationId: existing.organizationId,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    };
    all[index] = updated;
    this.writeAll(organizationId, all);
    return cloneSerializable(updated);
  }

  async deactivate(organizationId: string, supplierId: string): Promise<Supplier> {
    return this.update(organizationId, supplierId, { isActive: false } as Partial<Supplier>);
  }

  // --------------------------------------------------------------------------
  // Deprecated backward‑compatible wrappers
  // --------------------------------------------------------------------------

  /** @deprecated use list */
  async listAll(organizationId: string): Promise<Supplier[]> {
    return this.list(organizationId);
  }

  /** @deprecated use create or update */
  async save(organizationId: string, supplier: Supplier): Promise<Supplier> {
    const existing = await this.getById(organizationId, supplier.id);
    if (existing) {
      return this.update(organizationId, supplier.id, supplier);
    }
    return this.create(organizationId, supplier);
  }

  /** @deprecated use batch create – kept for compatibility */
  async saveMany(organizationId: string, suppliers: Supplier[]): Promise<Supplier[]> {
    const created: Supplier[] = [];
    for (const sup of suppliers) {
      const result = await this.create(organizationId, sup);
      created.push(result);
    }
    return created;
  }
}
