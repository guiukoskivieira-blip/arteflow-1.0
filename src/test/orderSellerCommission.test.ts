import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseOrderRepository } from '../repositories/supabaseOrderRepository';
import { OrderService } from '../services/orderService';
import type { Order } from '../types/domain';
import type { IOrderRepository, IProductionEventRepository, IProductionJobRepository } from '../types/repository';

const organizationId = '11111111-1111-4111-8111-111111111111';
const sellerId = '22222222-2222-4222-8222-222222222222';
const orderId = '33333333-3333-4333-8333-333333333333';

describe('P2-03 — Seller and Commission Integration on Orders and Financials', () => {
  it('1. Pedido sem comissão: não envia seller nem commission para a persistência', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { id: orderId, orderNumber: 'PED-2026-0001', totalAmountCents: 10000 },
      error: null,
    });
    const repo = new SupabaseOrderRepository({ rpc } as unknown as SupabaseClient);

    const testOrder: Order = {
      id: orderId,
      orderNumber: 'PED-2026-0001',
      organizationId,
      origin: 'MANUAL',
      customer: { id: 'cust-1', name: 'Cliente Teste' },
      items: [{
        id: 'item-1',
        orderId,
        productName: 'Banner Lona',
        sector: 'Comunicação Visual',
        quantity: 1,
        unit: 'un',
        unitPriceCents: 10000,
        totalPriceCents: 10000,
        finishings: [],
        dataOrigin: 'user',
      }],
      totalAmountCents: 10000,
      status: 'IN_PRODUCTION',
      deliveryDateISO: '2026-09-12T12:00:00Z',
      createdAt: '2026-09-08T12:00:00Z',
      updatedAt: '2026-09-08T12:00:00Z',
      dataOrigin: 'user',
    };

    await repo.createWithProductionJobs(organizationId, testOrder);

    expect(rpc).toHaveBeenCalledWith('arteflow_create_order_with_production', expect.objectContaining({
      p_organization_id: organizationId,
      p_seller_id: null,
      p_seller_name: null,
      p_commission_rate_percent: null,
      p_commission_amount_cents: null,
    }));
  });

  it('2. Pedido manual com comissão: dados de seller e comissão são enviados corretamente', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        id: orderId,
        orderNumber: 'PED-2026-0002',
        totalAmountCents: 10000,
        sellerId,
        sellerName: 'Carlos Oliveira',
        sellerCommissionPct: 5,
        sellerCommissionAmountCents: 500,
      },
      error: null,
    });
    const repo = new SupabaseOrderRepository({ rpc } as unknown as SupabaseClient);

    const testOrder: Order = {
      id: orderId,
      orderNumber: 'PED-2026-0002',
      organizationId,
      origin: 'MANUAL',
      customer: { id: 'cust-2', name: 'Cliente com Comissão' },
      items: [{
        id: 'item-1',
        orderId,
        productName: 'Adesivo Vinil',
        sector: 'Impressão Digital',
        quantity: 2,
        unit: 'un',
        unitPriceCents: 5000,
        totalPriceCents: 10000,
        finishings: [],
        dataOrigin: 'user',
      }],
      totalAmountCents: 10000,
      status: 'IN_PRODUCTION',
      sellerId,
      sellerName: 'Carlos Oliveira',
      sellerCommissionPct: 5,
      sellerCommissionAmountCents: 500,
      deliveryDateISO: '2026-09-12T12:00:00Z',
      createdAt: '2026-09-08T12:00:00Z',
      updatedAt: '2026-09-08T12:00:00Z',
      dataOrigin: 'user',
    };

    await repo.createWithProductionJobs(organizationId, testOrder);

    expect(rpc).toHaveBeenCalledWith('arteflow_create_order_with_production', expect.objectContaining({
      p_organization_id: organizationId,
      p_seller_id: sellerId,
      p_seller_name: 'Carlos Oliveira',
      p_commission_rate_percent: 5,
      p_commission_amount_cents: 500,
    }));
  });

  it('3. OrderService cria pedido preservando sellerId e sellerCommissionPct no objeto retornado', async () => {
    let savedOrder: Order | null = null;
    const mockOrderRepo: IOrderRepository = {
      list: vi.fn().mockResolvedValue([]),
      getById: vi.fn().mockResolvedValue(null),
      getByOrderNumber: vi.fn().mockResolvedValue(null),
      save: vi.fn().mockImplementation((_orgId, ord) => {
        savedOrder = ord;
        return Promise.resolve(ord);
      }),
      delete: vi.fn().mockResolvedValue(true),
      clear: vi.fn().mockResolvedValue(undefined),
    };

    const mockJobRepo: IProductionJobRepository = {
      list: vi.fn().mockResolvedValue([]),
      getById: vi.fn().mockResolvedValue(null),
      getByJobCode: vi.fn().mockResolvedValue(null),
      listByOrderId: vi.fn().mockResolvedValue([]),
      listByStageId: vi.fn().mockResolvedValue([]),
      save: vi.fn().mockResolvedValue({} as any),
      saveMany: vi.fn().mockResolvedValue([]),
      delete: vi.fn().mockResolvedValue(true),
      clear: vi.fn().mockResolvedValue(undefined),
    };

    const mockEventRepo: IProductionEventRepository = {
      listByJobId: vi.fn().mockResolvedValue([]),
      listAll: vi.fn().mockResolvedValue([]),
      append: vi.fn().mockResolvedValue({} as any),
      appendMany: vi.fn().mockResolvedValue([]),
      clear: vi.fn().mockResolvedValue(undefined),
    };

    const service = new OrderService(mockOrderRepo, mockJobRepo, mockEventRepo);

    const result = await service.createManualOrder({
      organizationId,
      customer: { name: 'Cliente Alpha' },
      sellerId,
      sellerName: 'Vendedor Responsável',
      sellerCommissionPct: 7.5,
      sellerCommissionAmountCents: 750,
      deliveryDateISO: '2026-09-15T12:00:00Z',
      items: [{
        productName: 'Faixa Frontlight',
        sector: 'Comunicação Visual',
        quantity: 1,
        unitPriceCents: 10000,
        unit: 'm',
        finishings: [],
      }],
    });

    expect(result.order.sellerId).toBe(sellerId);
    expect(result.order.sellerName).toBe('Vendedor Responsável');
    expect(result.order.sellerCommissionPct).toBe(7.5);
    expect(result.order.sellerCommissionAmountCents).toBe(750);
    expect(savedOrder).not.toBeNull();
    expect((savedOrder as any)?.sellerName).toBe('Vendedor Responsável');
  });

  it('4. Importação OrçaGraf preserva dados autoritativos de comissão recebidos do orçamento', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        id: orderId,
        orderNumber: 'PED-2026-0003',
        origin: 'ORCAGRAF',
        orcagrafQuoteId: 'quote-real-uuid-001',
        sellerId: 'seller-orcagraf-uuid',
        sellerName: 'Vendedora OrçaGraf',
        sellerCommissionPct: 10,
        sellerCommissionAmountCents: 12345,
      },
      error: null,
    });
    const repo = new SupabaseOrderRepository({ rpc } as unknown as SupabaseClient);

    const orcagrafOrder: Order = {
      id: orderId,
      orderNumber: 'PED-2026-0003',
      organizationId,
      origin: 'ORCAGRAF',
      orcagrafQuoteId: 'quote-real-uuid-001',
      customer: { id: 'cust-orcagraf', name: 'Cliente OrçaGraf Aprovado' },
      sellerId: 'seller-orcagraf-uuid',
      sellerName: 'Vendedora OrçaGraf',
      sellerCommissionPct: 10,
      sellerCommissionAmountCents: 12345,
      items: [{
        id: 'item-1',
        orderId,
        productName: 'Display de Balcão PS 2mm',
        sector: 'Comunicação Visual',
        quantity: 50,
        unit: 'un',
        unitPriceCents: 2469,
        totalPriceCents: 123450,
        finishings: ['Corte Especial Laser'],
        dataOrigin: 'user',
      }],
      totalAmountCents: 123450,
      status: 'IN_PRODUCTION',
      deliveryDateISO: '2026-09-20T12:00:00Z',
      createdAt: '2026-09-08T12:00:00Z',
      updatedAt: '2026-09-08T12:00:00Z',
      dataOrigin: 'user',
    };

    const saved = await repo.createWithProductionJobs(organizationId, orcagrafOrder);

    expect(rpc).toHaveBeenCalledWith('arteflow_create_order_with_production', expect.objectContaining({
      p_organization_id: organizationId,
      p_origin: 'ORCAGRAF',
      p_orcagraf_quote_id: 'quote-real-uuid-001',
      p_seller_id: 'seller-orcagraf-uuid',
      p_seller_name: 'Vendedora OrçaGraf',
      p_commission_rate_percent: 10,
      p_commission_amount_cents: 12345,
    }));
    expect(saved.sellerCommissionAmountCents).toBe(12345);
  });

  describe('5. Contrato SQL da Migration 20260908050000_add_order_seller_and_commission.sql', () => {
    it('verifica regras estritas de schema, idempotência e permissões no SQL', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const sqlPath = path.resolve(process.cwd(), 'supabase/migrations/20260908050000_add_order_seller_and_commission.sql');
      const sql = fs.readFileSync(sqlPath, 'utf8');

      // A. Schema alterations em arteflow_orders
      expect(sql).toContain('alter table public.arteflow_orders');
      expect(sql).toContain('add column if not exists seller_id uuid null');
      expect(sql).toContain('add column if not exists seller_name text null');
      expect(sql).toContain('add column if not exists commission_rate_percent numeric null');
      expect(sql).toContain('add column if not exists commission_amount_cents bigint null');

      // B. Schema alterations em arteflow_financial_payables
      expect(sql).toContain('alter table public.arteflow_financial_payables');
      expect(sql).toContain('add column if not exists order_id uuid null');
      expect(sql).toContain('add column if not exists commission_seller_id uuid null');

      // C. Tenant FK de order_id em payables
      expect(sql).toContain('foreign key (organization_id, order_id)');
      expect(sql).toContain('references public.arteflow_orders(organization_id, id)');

      // D. Índice UNIQUE parcial para comissão
      expect(sql).toContain('create unique index if not exists arteflow_fin_payables_org_order_uidx');
      expect(sql).toContain('on public.arteflow_financial_payables(organization_id, order_id)');
      expect(sql).toContain('where order_id is not null');

      // E. Criação de payable OPEN com supplier_name = seller_name e purchase_order_id = NULL
      expect(sql).toContain('status,');
      expect(sql).toContain("'OPEN'");
      expect(sql).toContain("'Comissão de venda — Pedido '");

      // F. Evento PAYABLE_CREATED registrado na mesma transação
      expect(sql).toContain('insert into public.arteflow_financial_events');
      expect(sql).toContain("'PAYABLE_CREATED'");

      // G. Permissões P1-01 preservadas (arteflow.orders.create, sem exigir finance.manage)
      expect(sql).toContain("private.arteflow_has_permission(p_organization_id, 'arteflow.orders.create')");
      expect(sql).not.toContain("private.arteflow_require_finance(p_organization_id");

      // H. P2-01 e P2-02 preservados (quote anti-duplicidade e dynamic stage resolution)
      expect(sql).toContain('p_orcagraf_quote_id text default null');
      expect(sql).toContain('ORCAGRAF_QUOTE_ALREADY_IMPORTED');
      expect(sql).toContain('v_default_stage_id');
      expect(sql).toContain('public.arteflow_production_stages');
    });
  });
});
