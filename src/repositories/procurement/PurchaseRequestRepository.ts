// src/repositories/procurement/PurchaseRequestRepository.ts
import { storageKeys } from '../../repositories/storageKeys';
import { PurchaseRequest } from '../../types/procurement';
import { IPurchaseRequestRepository } from '../../types/procurementRepository';
import { readList, writeList, cloneSerializable } from './common';

export class PurchaseRequestRepository implements IPurchaseRequestRepository {
  private validate(orgId: string, req: PurchaseRequest): void {
    if (!req.id) throw new Error('Missing id');
    if (!req.organizationId) throw new Error('Missing organizationId');
    if (req.organizationId !== orgId) throw new Error('Organization mismatch');
    if (!req.requestNumber) throw new Error('Missing requestNumber');
    if (!req.status) throw new Error('Missing status');
    if (!req.requestedBy) throw new Error('Missing requestedBy');
  }

  async getById(organizationId: string, id: string): Promise<PurchaseRequest | null> {
    const all = readList<PurchaseRequest>(storageKeys.purchaseRequests(organizationId));
    const found = all.find(r => r.id === id) ?? null;
    return found ? cloneSerializable(found) : null;
  }

  async getByRequestNumber(organizationId: string, requestNumber: string): Promise<PurchaseRequest | null> {
    const all = readList<PurchaseRequest>(storageKeys.purchaseRequests(organizationId));
    const found = all.find(r => r.requestNumber === requestNumber) ?? null;
    return found ? cloneSerializable(found) : null;
  }

  async listAll(organizationId: string): Promise<PurchaseRequest[]> {
    const all = readList<PurchaseRequest>(storageKeys.purchaseRequests(organizationId));
    return cloneSerializable(all);
  }

  async listByJobId(organizationId: string, jobId: string): Promise<PurchaseRequest[]> {
    const all = readList<PurchaseRequest>(storageKeys.purchaseRequests(organizationId));
    const filtered = all.filter(r => r.productionJobId === jobId);
    return cloneSerializable(filtered);
  }

  async save(organizationId: string, request: PurchaseRequest): Promise<PurchaseRequest> {
    this.validate(organizationId, request);
    const all = readList<PurchaseRequest>(storageKeys.purchaseRequests(organizationId));

    // Check uniqueness of requestNumber
    const existingNum = all.find(r => r.requestNumber === request.requestNumber && r.id !== request.id);
    if (existingNum) throw new Error('Duplicate requestNumber');

    const idx = all.findIndex(r => r.id === request.id);
    const copy = cloneSerializable(request);
    if (idx >= 0) {
      all[idx] = copy;
    } else {
      all.push(copy);
    }

    writeList(storageKeys.purchaseRequests(organizationId), all);
    return cloneSerializable(copy);
  }

  async saveMany(organizationId: string, requests: PurchaseRequest[]): Promise<PurchaseRequest[]> {
    const all = readList<PurchaseRequest>(storageKeys.purchaseRequests(organizationId));

    // Validate all first
    for (const req of requests) {
      this.validate(organizationId, req);
    }

    // Prepare state
    const allMap = new Map(all.map(r => [r.id, r]));
    const numberMap = new Map(all.map(r => [r.requestNumber, r.id]));

    for (const req of requests) {
      const existingOwner = numberMap.get(req.requestNumber);
      if (existingOwner && existingOwner !== req.id) {
        throw new Error(`Duplicate requestNumber: ${req.requestNumber}`);
      }
      numberMap.set(req.requestNumber, req.id);
    }

    for (const req of requests) {
      allMap.set(req.id, cloneSerializable(req));
    }

    const newAll = Array.from(allMap.values());
    writeList(storageKeys.purchaseRequests(organizationId), newAll);
    return cloneSerializable(requests);
  }
}
