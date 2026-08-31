import { describe, it, expect, beforeEach } from 'vitest';
import { PurchaseRequestRepository } from '../repositories/procurement/PurchaseRequestRepository';
import { PurchaseOrderRepository } from '../repositories/procurement/PurchaseOrderRepository';
import { PurchaseOrderItemRepository } from '../repositories/procurement/PurchaseOrderItemRepository';
import { PurchaseRequest, PurchaseOrder, PurchaseOrderItem } from '../types/procurement';
import { storageKeys } from '../repositories/storageKeys';

describe('Procurement Repositories Part B (PR, PO, POI)', () => {
  const prRepo = new PurchaseRequestRepository();
  const poRepo = new PurchaseOrderRepository();
  const poiRepo = new PurchaseOrderItemRepository();

  const ORG1 = 'org1';
  const ORG2 = 'org2';

  beforeEach(() => {
    localStorage.clear();
  });

  describe('PurchaseRequestRepository', () => {
    const validPR: PurchaseRequest = {
      id: 'pr1',
      organizationId: ORG1,
      requestNumber: 'SC-2024-0001',
      status: 'DRAFT',
      source: 'MANUAL',
      requestedBy: 'user1',
      requestedByName: 'User 1',
      requestedAt: new Date().toISOString(),
      dataOrigin: 'user', createdAt: '', updatedAt: '',
    };

    it('1. criação e leitura de solicitação', async () => {
      await prRepo.save(ORG1, validPR);
      const read = await prRepo.getById(ORG1, 'pr1');
      expect(read).toEqual(validPR);
    });

    it('2. consulta por código ou operação equivalente do contrato', async () => {
      await prRepo.save(ORG1, validPR);
      const read = await prRepo.getByRequestNumber(ORG1, 'SC-2024-0001');
      expect(read).toEqual(validPR);
    });

    it('3. isolamento por organização, quando aplicável', async () => {
      await prRepo.save(ORG1, validPR);
      const readOrg2 = await prRepo.listAll(ORG2);
      expect(readOrg2).toHaveLength(0);
      await expect(prRepo.save(ORG2, { ...validPR, organizationId: ORG1 })).rejects.toThrow('Organization mismatch');
    });

    it('4. rejeição de solicitação inválida (sem id, org ou reqNum)', async () => {
      await expect(prRepo.save(ORG1, { ...validPR, id: '' })).rejects.toThrow();
      await expect(prRepo.save(ORG1, { ...validPR, requestNumber: '' })).rejects.toThrow();
    });

    it('5. cópia defensiva na entrada e saída', async () => {
      const pr = { ...validPR };
      await prRepo.save(ORG1, pr);
      pr.status = 'REQUESTED'; // mutate original
      const read = await prRepo.getById(ORG1, 'pr1');
      expect(read?.status).toBe('DRAFT'); // stored is untouched

      read!.status = 'CANCELED' as any; // mutate read
      const readAgain = await prRepo.getById(ORG1, 'pr1');
      expect(readAgain?.status).toBe('DRAFT'); // stored is untouched
    });
  });

  describe('PurchaseOrderRepository', () => {
    const validPO: PurchaseOrder = {
      id: 'po1',
      organizationId: ORG1,
      orderNumber: 'PC-2024-0001',
      supplierId: 'sup1',
      supplierSnapshot: {} as any,
      status: 'DRAFT',
      freightCents: 100,
      discountCents: 50,
      subtotalCents: 200,
      totalCents: 250,
      createdBy: 'user1',
      createdByName: 'User 1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      dataOrigin: 'user'
    };

    it('6. criação e leitura de pedido de compra', async () => {
      await poRepo.save(ORG1, validPO);
      const read = await poRepo.getById(ORG1, 'po1');
      expect(read).toEqual(validPO);
    });

    it('7. consulta pelo fornecedor ou operação equivalente existente', async () => {
      await poRepo.save(ORG1, validPO);
      const read = await poRepo.listBySupplierId(ORG1, 'sup1');
      expect(read).toHaveLength(1);
      expect(read[0].id).toBe('po1');
    });

    it('8. rejeição de valores monetários inválidos', async () => {
      await expect(poRepo.save(ORG1, { ...validPO, totalCents: 10.5 })).rejects.toThrow();
      await expect(poRepo.save(ORG1, { ...validPO, freightCents: NaN })).rejects.toThrow();
    });
  });

  describe('PurchaseOrderItemRepository', () => {
    const validItem1: PurchaseOrderItem = {
      id: 'poi1',
      organizationId: ORG1,
      purchaseOrderId: 'po1',
      materialId: 'm1',
      materialSnapshot: {} as any,
      orderedQuantityMilli: 1000,
      receivedQuantityMilli: 0,
      unit: 'UN' as any,
      unitCostCents: 100,
      totalCostCents: 100,
      createdAt: '',
      updatedAt: ''
    };
    const validItem2 = { ...validItem1, id: 'poi2' };

    it('9. criação de vários itens', async () => {
      await poiRepo.saveMany(ORG1, [validItem1, validItem2]);
      const all = await poiRepo.listAll(ORG1);
      expect(all).toHaveLength(2);
    });

    it('10. createMany atômico (nenhum salva se um falhar)', async () => {
      const invalidItem = { ...validItem1, id: 'poi3', totalCostCents: 10.5 };
      await expect(poiRepo.saveMany(ORG1, [validItem1, invalidItem])).rejects.toThrow();
      const all = await poiRepo.listAll(ORG1);
      expect(all).toHaveLength(0); // neither was saved
    });

    it('11. consulta dos itens por pedido', async () => {
      await poiRepo.saveMany(ORG1, [validItem1, { ...validItem2, purchaseOrderId: 'po2' }]);
      const read = await poiRepo.listByOrderId(ORG1, 'po1');
      expect(read).toHaveLength(1);
      expect(read[0].id).toBe('poi1');
    });

    it('14. ausência de métodos de exclusão não definidos', () => {
      expect((poiRepo as any).deleteById).toBeUndefined();
    });
  });

  describe('Gerais', () => {
    it('12. JSON corrompido', async () => {
      localStorage.setItem(storageKeys.purchaseRequests(ORG1), '{ corrupted');
      await expect(prRepo.listAll(ORG1)).rejects.toThrow();
    });

    it('13. propagação de falha de gravação', async () => {
      const originalSetItem = localStorage.setItem;
      localStorage.setItem = () => { throw new Error('Storage Full'); };
      await expect(prRepo.save(ORG1, {
        id: 'prX', organizationId: ORG1, requestNumber: 'X', status: 'DRAFT', source: 'MANUAL', requestedBy: 'u', requestedByName: 'U', requestedAt: '', dataOrigin: 'user', createdAt: '', updatedAt: ''
      })).rejects.toThrow('Storage Full');
      localStorage.setItem = originalSetItem;
    });

    it('15. preservação dos dados já gravados quando uma nova operação falhar', async () => {
      const validItem: PurchaseOrderItem = {
        id: 'poi1', organizationId: ORG1, purchaseOrderId: 'po1', materialId: 'm1', materialSnapshot: {} as any, orderedQuantityMilli: 1000, receivedQuantityMilli: 0, unit: 'UN' as any, unitCostCents: 100, totalCostCents: 100, createdAt: '', updatedAt: ''
      };
      await poiRepo.save(ORG1, validItem);

      const invalidItem = { ...validItem, id: 'poi2', unitCostCents: NaN };
      await expect(poiRepo.save(ORG1, invalidItem)).rejects.toThrow();

      const all = await poiRepo.listAll(ORG1);
      expect(all).toHaveLength(1);
      expect(all[0].id).toBe('poi1');
    });
  });
});
