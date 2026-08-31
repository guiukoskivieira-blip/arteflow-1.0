import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ProcurementService } from '../services/procurementService';
import { LocalStorageSupplierRepository } from '../repositories/procurement/LocalStorageSupplierRepository';
import { PurchaseRequestRepository } from '../repositories/procurement/PurchaseRequestRepository';
import { LocalStoragePurchaseRequestItemRepository } from '../repositories/procurement/LocalStoragePurchaseRequestItemRepository';
import { PurchaseOrderRepository } from '../repositories/procurement/PurchaseOrderRepository';
import { PurchaseOrderItemRepository } from '../repositories/procurement/PurchaseOrderItemRepository';
import { GoodsReceiptRepository } from '../repositories/procurement/GoodsReceiptRepository';
import { GoodsReceiptItemRepository } from '../repositories/procurement/GoodsReceiptItemRepository';
import { LocalStorageProcurementEventRepository } from '../repositories/localStorageProcurementRepositories';
import { computeSubtotalCents } from '../domain/money';

const dummySequenceRepo = { getNextSequence: vi.fn(), setSequence: vi.fn() };
const dummyMaterialRepo = {
  getById: vi.fn().mockImplementation((_org, id) => {
    if (id === 'mat1') return { id: 'mat1', name: 'Material 1', sku: 'SKU1', unit: 'UN', averageCostCents: 100, stockOnHandMilli: 0, minimumStockMilli: 0, isActive: true };
    return null;
  }),
  save: vi.fn(), listAll: vi.fn(), deleteById: vi.fn()
};

describe('Procurement Service Hardening & Math (Fase 2B.2A-R1)', () => {
  let service: ProcurementService;
  let orderRepo: PurchaseOrderRepository;
  let supplierRepo: LocalStorageSupplierRepository;
  let eventRepo: LocalStorageProcurementEventRepository;

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();

    supplierRepo = new LocalStorageSupplierRepository();
    orderRepo = new PurchaseOrderRepository();
    eventRepo = new LocalStorageProcurementEventRepository();

    service = new ProcurementService(
      supplierRepo,
      new PurchaseRequestRepository(),
      new LocalStoragePurchaseRequestItemRepository(),
      orderRepo,
      new PurchaseOrderItemRepository(),
      new GoodsReceiptRepository(),
      new GoodsReceiptItemRepository(),
      eventRepo,
      dummySequenceRepo as any,
      dummyMaterialRepo as any
    );
  });

  describe('Risco 1 - Money Math.round & BigInt', () => {
    it('calcula quantidade exata sem fração', () => {
      expect(computeSubtotalCents(2000, 150)).toBe(300); // 2 units * 1.50
    });

    it('arredonda para baixo fração inferior a meio centavo', () => {
      // 1001 milli * 100 cents = 100100 -> 100.1 cents -> 100
      expect(computeSubtotalCents(1001, 100)).toBe(100);
    });

    it('arredonda para cima exatamente meio centavo', () => {
      // 1005 milli * 100 cents = 100500 -> 100.5 cents -> 101
      expect(computeSubtotalCents(1005, 100)).toBe(101);
    });

    it('arredonda para cima fração superior a meio centavo', () => {
      // 1006 milli * 100 cents = 100600 -> 100.6 cents -> 101
      expect(computeSubtotalCents(1006, 100)).toBe(101);
    });

    it('valores grandes ainda seguros (dentro do Number.MAX_SAFE_INTEGER no resultado)', () => {
      // 1 million units = 1,000,000,000 milli. Unit cost = 10,000. Product = 10^13. Max is 9*10^15.
      expect(computeSubtotalCents(1000000000, 10000)).toBe(10000000000);
    });

    it('produto intermediário inseguro tratado por BigInt', () => {
      // 10 billion units = 10,000,000,000,000 milli. Unit cost = 1,000,000 cents.
      // Product = 10^19. Exceeds MAX_SAFE_INTEGER.
      // But / 1000 = 10^16. Wait, 10^16 also exceeds max safe.
      // Let's do 1 billion units (10^12 milli) * 100,000 cents. Product = 10^17 (unsafe). Result = 10^14 (safe).
      expect(computeSubtotalCents(1000000000000, 100000)).toBe(100000000000000);
    });

    it('rejeita total negativo via orquestrador', async () => {
      const sup = await service.createSupplier('org1', { code: 'S1', tradeName: 'S1', userId: 'U1', userName: 'U1' });
      await expect(service.createPurchaseOrder('org1', {
        supplierId: sup.id,
        items: [{ materialId: 'mat1', orderedQuantityMilli: 1000, unitCostCents: 100 }], // subtotal = 100
        discountCents: 200, // discount > subtotal + freight
        userId: 'u', userName: 'u'
      })).rejects.toThrow('desconto não pode ultrapassar');
    });

    it('rejeita resultado final inseguro', () => {
      // 100 billion units * 10 million cents => Result > MAX_SAFE_INTEGER
      expect(() => computeSubtotalCents(100000000000000, 10000000)).toThrow('seguro em centavos');
    });
  });

  describe('Risco 2 & 3 - Transaction, Rollback e Efeitos Colaterais', () => {
    it('evento só é emitido se a transação commitar com sucesso', async () => {
      const appendSpy = vi.spyOn(eventRepo, 'append');

      const sup = await service.createSupplier('org1', { code: 'S2', tradeName: 'S2', userId: 'U1', userName: 'U1' });

      // Forçar falha no repositório de pedidos
      vi.spyOn(orderRepo, 'save').mockRejectedValueOnce(new Error('DB_FAIL'));

      await expect(service.createPurchaseOrder('org1', {
        supplierId: sup.id,
        items: [{ materialId: 'mat1', orderedQuantityMilli: 1000, unitCostCents: 100 }],
        userId: 'u', userName: 'u'
      })).rejects.toThrow('DB_FAIL');

      // O evento não pode ter sido chamado! (O rollback desfaz o state, mas o spy comprova que a linha do append não foi atingida)
      expect(appendSpy).not.toHaveBeenCalled();
    });

    it('diferencia chaves inexistentes no rollback', async () => {
      // Testa se uma chave que não existia no localStorage é removida (removeItem) após rollback
      localStorage.setItem('arteflow:org1:purchaseOrders', JSON.stringify([{id: 'existing'}]));
      // orderItems não existe no localStorage ainda

      const sup = await service.createSupplier('org1', { code: 'S3', tradeName: 'S3', userId: 'U1', userName: 'U1' });

      vi.spyOn(orderRepo, 'save').mockRejectedValueOnce(new Error('SIMULATED_FAIL'));

      await expect(service.createPurchaseOrder('org1', {
        supplierId: sup.id,
        items: [{ materialId: 'mat1', orderedQuantityMilli: 1000, unitCostCents: 100 }],
        userId: 'u', userName: 'u'
      })).rejects.toThrow('SIMULATED_FAIL');

      // purchaseOrders existia, deve ter sido restaurada
      expect(localStorage.getItem('arteflow:org1:purchaseOrders')).toContain('existing');

      // orderItems NÃO existia, deve ter sido REMOVIDA, ou seja, getItem retorna null
      expect(localStorage.getItem('arteflow:org1:purchaseOrderItems')).toBeNull();
    });
  });
});
