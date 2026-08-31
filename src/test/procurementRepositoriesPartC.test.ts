import { describe, it, expect, beforeEach } from 'vitest';
import { GoodsReceiptRepository } from '../repositories/procurement/GoodsReceiptRepository';
import { GoodsReceiptItemRepository } from '../repositories/procurement/GoodsReceiptItemRepository';
import { PurchaseOrderRepository } from '../repositories/procurement/PurchaseOrderRepository';
import { GoodsReceipt, GoodsReceiptItem, PurchaseOrder } from '../types/procurement';
import { storageKeys } from '../repositories/storageKeys';

describe('Procurement Repositories Part C (GR, GRI)', () => {
  const grRepo = new GoodsReceiptRepository();
  const griRepo = new GoodsReceiptItemRepository();
  const poRepo = new PurchaseOrderRepository();

  const ORG1 = 'org1';
  const ORG2 = 'org2';

  beforeEach(() => {
    localStorage.clear();
  });

  describe('GoodsReceiptRepository', () => {
    const validGR: GoodsReceipt = {
      id: 'gr1',
      organizationId: ORG1,
      purchaseOrderId: 'po1',
      receiptNumber: 'REC-2024-001',
      supplierSnapshot: {} as any,
      receivedAt: new Date().toISOString(),
      receivedBy: 'user1',
      receivedByName: 'User 1',
      idempotencyKey: 'idem1',
      dataOrigin: 'user',
      createdAt: new Date().toISOString()
    };

    it('1. criação e leitura de recebimento / 6. cópia na entrada / 7. cópia na saída', async () => {
      const input = { ...validGR };
      await grRepo.save(ORG1, input);

      input.notes = 'mutated'; // mutate input
      const read = await grRepo.getById(ORG1, 'gr1');
      expect(read?.notes).toBeUndefined();

      read!.notes = 'mutated again'; // mutate read
      const read2 = await grRepo.getById(ORG1, 'gr1');
      expect(read2?.notes).toBeUndefined();
    });

    it('2. consulta por pedido', async () => {
      await grRepo.save(ORG1, validGR);
      const read = await grRepo.listByOrderId(ORG1, 'po1');
      expect(read).toHaveLength(1);
    });

    it('3. isolamento por organização / 19. coerência de organização', async () => {
      await grRepo.save(ORG1, validGR);
      const read2 = await grRepo.listAll(ORG2);
      expect(read2).toHaveLength(0);
      await expect(grRepo.save(ORG2, { ...validGR, organizationId: ORG1 })).rejects.toThrow('Organization mismatch');
    });

    it('4. rejeição de recebimento inválido', async () => {
      await expect(grRepo.save(ORG1, { ...validGR, id: '' })).rejects.toThrow();
      await expect(grRepo.save(ORG1, { ...validGR, purchaseOrderId: '' })).rejects.toThrow();
    });

    it('5. unicidade de chave de negócio (receiptNumber e idempotencyKey)', async () => {
      await grRepo.save(ORG1, validGR);
      await expect(grRepo.save(ORG1, { ...validGR, id: 'gr2', idempotencyKey: 'idem2' })).rejects.toThrow('Duplicate receiptNumber');
      await expect(grRepo.save(ORG1, { ...validGR, id: 'gr3', receiptNumber: 'REC-2024-002' })).rejects.toThrow('Duplicate idempotencyKey');
    });
  });

  describe('GoodsReceiptItemRepository', () => {
    const validGRI: GoodsReceiptItem = {
      id: 'gri1',
      organizationId: ORG1,
      goodsReceiptId: 'gr1',
      purchaseOrderItemId: 'poi1',
      materialId: 'mat1',
      receivedQuantityMilli: 1000,
      unitCostCents: 150,
      totalCostCents: 150,
      stockMovementId: 'sm1',
      createdAt: new Date().toISOString()
    };

    it('8. criação de itens de recebimento', async () => {
      await griRepo.save(ORG1, validGRI);
      const read = await griRepo.getById(ORG1, 'gri1');
      expect(read).toEqual(validGRI);
    });

    it('9. consulta por goodsReceiptId', async () => {
      await griRepo.save(ORG1, validGRI);
      const read = await griRepo.listByReceiptId(ORG1, 'gr1');
      expect(read).toHaveLength(1);
    });

    it('10. rejeição de quantidade negativa', async () => {
      await expect(griRepo.save(ORG1, { ...validGRI, receivedQuantityMilli: -100 })).rejects.toThrow();
    });

    it('11. rejeição de quantidade decimal / 12. rejeição de número inseguro', async () => {
      await expect(griRepo.save(ORG1, { ...validGRI, receivedQuantityMilli: 10.5 })).rejects.toThrow();
      await expect(griRepo.save(ORG1, { ...validGRI, totalCostCents: NaN })).rejects.toThrow();
      await expect(griRepo.save(ORG1, { ...validGRI, totalCostCents: Number.MAX_SAFE_INTEGER + 1 })).rejects.toThrow();
    });

    it('13. operação em lote atômica / 15. preservação dos dados', async () => {
      await griRepo.save(ORG1, validGRI);

      const validGRI2 = { ...validGRI, id: 'gri2' };
      const invalidGRI3 = { ...validGRI, id: 'gri3', receivedQuantityMilli: -5 };

      await expect(griRepo.saveMany(ORG1, [validGRI2, invalidGRI3])).rejects.toThrow();

      const all = await griRepo.listAll(ORG1);
      expect(all).toHaveLength(1);
      expect(all[0].id).toBe('gri1'); // original preserved, gri2 not saved
    });

    it('14. duplicidade dentro do lote é tratada ou rejeitada', async () => {
      const g1 = { ...validGRI, id: 'gx' };
      const g2 = { ...validGRI, id: 'gx', receivedQuantityMilli: 5000 };
      // Map based saveMany overwrites duplicates in memory based on ID, this is acceptable for updates
      // But we just check it doesn't crash or corrupt
      await griRepo.saveMany(ORG1, [g1, g2]);
      const all = await griRepo.listAll(ORG1);
      expect(all).toHaveLength(1);
      expect(all[0].receivedQuantityMilli).toBe(5000);
    });
  });

  describe('Integração e Contratos', () => {
    it('16. JSON corrompido deve lançar erro e não assumir vazio', async () => {
      localStorage.setItem(storageKeys.goodsReceipts(ORG1), '{ corrupted');
      await expect(grRepo.listAll(ORG1)).rejects.toThrow();
    });

    it('17. propagação de erro de gravação', async () => {
      const original = localStorage.setItem;
      localStorage.setItem = () => { throw new Error('Quota Exceeded'); };
      await expect(grRepo.save(ORG1, {
        id: '1', organizationId: ORG1, purchaseOrderId: 'p1', receiptNumber: 'r1', idempotencyKey: 'i1',
        receivedBy: 'u1', receivedByName: 'u1', dataOrigin: 'user', supplierSnapshot: {} as any, createdAt: '', receivedAt: ''
      })).rejects.toThrow('Quota Exceeded');
      localStorage.setItem = original;
    });

    it('18. ausência de métodos de exclusão', () => {
      expect((grRepo as any).deleteById).toBeUndefined();
      expect((griRepo as any).deleteById).toBeUndefined();
    });

    it('20. regressão: PurchaseOrderRepository valida mas não recalcula totais', async () => {
      const validPO: PurchaseOrder = {
        id: 'po1', organizationId: ORG1, orderNumber: 'PC', supplierId: 's', supplierSnapshot: {} as any,
        status: 'DRAFT', freightCents: 100, discountCents: 0, subtotalCents: 200, totalCents: 1000,
        createdBy: 'u', createdByName: 'U', createdAt: '', updatedAt: '', dataOrigin: 'user'
      };

      // even if freight + subtotal - discount != total, repo accepts it blindly if it's safe int
      await poRepo.save(ORG1, validPO);
      const read = await poRepo.getById(ORG1, 'po1');
      expect(read?.totalCents).toBe(1000); // no auto-recalculation to 300
    });
  });
});
