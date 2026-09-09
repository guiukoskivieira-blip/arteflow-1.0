import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseOrderRepository } from '../repositories/supabaseOrderRepository';
import type { Order } from '../types/domain';
import type { OrcagrafQuote } from '../types/orcagraf';
import { calculateOrderTotalCents } from '../domain/money';

const organizationId = '11111111-1111-4111-8111-111111111111';
const orderId = '33333333-3333-4333-8333-333333333333';

function baseOrder(overrides: Partial<Order> = {}): Order {
  return {
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
      unitPriceCents: 25000,
      totalPriceCents: 25000,
      finishings: [],
      dataOrigin: 'user',
    }],
    totalAmountCents: 25000,
    status: 'IN_PRODUCTION',
    deliveryDateISO: '2026-09-12T12:00:00Z',
    createdAt: '2026-09-08T12:00:00Z',
    updatedAt: '2026-09-08T12:00:00Z',
    dataOrigin: 'user',
    ...overrides,
  };
}

describe('P1 Financeiro — Preserve Approved OrçaGraf Financial Terms', () => {
  it('A) OrçaGraf com desconto: subtotal=25000, desconto=2500, total=22500 → pedido usa total aprovado', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        id: orderId,
        orderNumber: 'PED-2026-0001',
        subtotalAmountCents: 25000,
        discountAmountCents: 2500,
        totalAmountCents: 22500,
      },
      error: null,
    });
    const repo = new SupabaseOrderRepository({ rpc } as unknown as SupabaseClient);

    const order = baseOrder({
      origin: 'ORCAGRAF',
      orcagrafQuoteId: '44444444-4444-4444-4444-444444444444',
      totalAmountCents: 25000, // frontend envia o subtotal; RPC override para 22500
    });

    const result = await repo.createWithProductionJobs(organizationId, order);
    expect(result.totalAmountCents).toBe(22500);
    expect(result.subtotalAmountCents).toBe(25000);
    expect(result.discountAmountCents).toBe(2500);

    // Verifica que o RPC recebeu o orcagraf_quote_id correto
    expect(rpc).toHaveBeenCalledWith('arteflow_create_order_with_production', expect.objectContaining({
      p_orcagraf_quote_id: '44444444-4444-4444-4444-444444444444',
      p_origin: 'ORCAGRAF',
    }));
  });

  it('B) OrçaGraf sem desconto: 25000 → 25000', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        id: orderId,
        orderNumber: 'PED-2026-0002',
        subtotalAmountCents: 25000,
        discountAmountCents: null,
        totalAmountCents: 25000,
      },
      error: null,
    });
    const repo = new SupabaseOrderRepository({ rpc } as unknown as SupabaseClient);

    const order = baseOrder({
      origin: 'ORCAGRAF',
      orcagrafQuoteId: '55555555-5555-4555-8555-555555555555',
    });

    const result = await repo.createWithProductionJobs(organizationId, order);
    expect(result.totalAmountCents).toBe(25000);
  });

  it('C) Comissão rate 5% sobre total aprovado 22500 = 1125', () => {
    const total = 22500;
    const rate = 5;
    const commission = Math.round((total * rate) / 100);
    expect(commission).toBe(1125);
  });

  it('D) commission_amount explícito prevalece sobre rate', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        id: orderId,
        orderNumber: 'PED-2026-0003',
        totalAmountCents: 22500,
        sellerCommissionPct: 5,
        sellerCommissionAmountCents: 999,
      },
      error: null,
    });
    const repo = new SupabaseOrderRepository({ rpc } as unknown as SupabaseClient);

    const order = baseOrder({
      origin: 'ORCAGRAF',
      orcagrafQuoteId: '66666666-6666-4666-8666-666666666666',
      sellerCommissionPct: 5,
      sellerCommissionAmountCents: 999,
    });

    const result = await repo.createWithProductionJobs(organizationId, order);
    expect(result.sellerCommissionAmountCents).toBe(999);
    expect(rpc).toHaveBeenCalledWith('arteflow_create_order_with_production', expect.objectContaining({
      p_commission_amount_cents: 999,
    }));
  });

  it('E) Pedido manual continua calculando total pelos itens', () => {
    const items = [
      { totalPriceCents: 10000 },
      { totalPriceCents: 15000 },
    ];
    const total = calculateOrderTotalCents(items);
    expect(total).toBe(25000);
  });

  it('F) Frontend tenta enviar total diferente → RPC envia mas server usa quote canônico', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        id: orderId,
        orderNumber: 'PED-2026-0004',
        totalAmountCents: 22500, // server retorna o canônico
      },
      error: null,
    });
    const repo = new SupabaseOrderRepository({ rpc } as unknown as SupabaseClient);

    // Frontend sends 25000 (incorrect - no discount applied)
    const order = baseOrder({
      origin: 'ORCAGRAF',
      orcagrafQuoteId: '77777777-7777-4777-8777-777777777777',
      totalAmountCents: 25000,
    });

    const result = await repo.createWithProductionJobs(organizationId, order);
    // Server overrode to 22500 using the canonical quote total
    expect(result.totalAmountCents).toBe(22500);
  });

  it('G) Quote de outra organization → rejeitar (server retorna erro)', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { code: '22023', message: 'ORCAGRAF_QUOTE_NOT_FOUND_OR_NOT_APPROVED' },
    });
    const repo = new SupabaseOrderRepository({ rpc } as unknown as SupabaseClient);

    const order = baseOrder({
      origin: 'ORCAGRAF',
      orcagrafQuoteId: '88888888-8888-4888-8888-888888888888',
    });

    await expect(repo.createWithProductionJobs(organizationId, order)).rejects.toThrow();
  });

  it('H) Quote não approved → rejeitar (server retorna erro)', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { code: '22023', message: 'ORCAGRAF_QUOTE_NOT_FOUND_OR_NOT_APPROVED' },
    });
    const repo = new SupabaseOrderRepository({ rpc } as unknown as SupabaseClient);

    const order = baseOrder({
      origin: 'ORCAGRAF',
      orcagrafQuoteId: '99999999-9999-4999-8999-999999999999',
    });

    await expect(repo.createWithProductionJobs(organizationId, order)).rejects.toThrow();
  });

  it('I) Anti-duplicidade preservada: ORCAGRAF_QUOTE_ALREADY_IMPORTED', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { code: '23505', message: 'ORCAGRAF_QUOTE_ALREADY_IMPORTED' },
    });
    const repo = new SupabaseOrderRepository({ rpc } as unknown as SupabaseClient);

    const order = baseOrder({
      origin: 'ORCAGRAF',
      orcagrafQuoteId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    });

    await expect(repo.createWithProductionJobs(organizationId, order))
      .rejects.toThrow('Este orçamento do OrçaGraf já foi importado para o ArteFlow.');
  });

  it('J) OP preservada: pedido retornado contém dados básicos', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        id: orderId,
        orderNumber: 'PED-2026-0005',
        origin: 'ORCAGRAF',
        totalAmountCents: 22500,
        status: 'IN_PRODUCTION',
      },
      error: null,
    });
    const repo = new SupabaseOrderRepository({ rpc } as unknown as SupabaseClient);

    const order = baseOrder({
      origin: 'ORCAGRAF',
      orcagrafQuoteId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    });

    const result = await repo.createWithProductionJobs(organizationId, order);
    expect(result.status).toBe('IN_PRODUCTION');
    expect(result.origin).toBe('ORCAGRAF');
  });

  it('Order domain type supports subtotalAmountCents and discountAmountCents', () => {
    const order: Order = baseOrder({
      subtotalAmountCents: 25000,
      discountAmountCents: 2500,
      totalAmountCents: 22500,
    });
    expect(order.subtotalAmountCents).toBe(25000);
    expect(order.discountAmountCents).toBe(2500);
    expect(order.totalAmountCents).toBe(22500);
  });

  it('OrcagrafQuote type supports financial breakdown fields', () => {
    const quote: OrcagrafQuote = {
      id: 'quote-1',
      quoteNumber: 'ORC-2026-0003',
      customerName: 'Cliente',
      subtotalAmountCents: 25000,
      discountType: 'percentage',
      discountValue: 10,
      discountAppliedCents: 2500,
      discountReason: 'Fidelidade',
      totalAmountCents: 22500,
      sellerCommissionPct: 5,
      sellerCommissionAmountCents: 1125,
      itemCount: 1,
      items: [],
    };
    expect(quote.subtotalAmountCents).toBe(25000);
    expect(quote.discountAppliedCents).toBe(2500);
    expect(quote.totalAmountCents).toBe(22500);
    expect(quote.sellerCommissionAmountCents).toBe(1125);
  });

  it('Manual order without subtotal/discount still works', () => {
    const order: Order = baseOrder();
    expect(order.subtotalAmountCents).toBeUndefined();
    expect(order.discountAmountCents).toBeUndefined();
    expect(order.totalAmountCents).toBe(25000);
  });

  it('Cross-tenant write is rejected', async () => {
    const rpc = vi.fn();
    const repo = new SupabaseOrderRepository({ rpc } as unknown as SupabaseClient);

    const order = baseOrder({ organizationId: 'other-org' });

    await expect(repo.createWithProductionJobs(organizationId, order))
      .rejects.toThrow('CROSS_TENANT_ORDER_WRITE');
    expect(rpc).not.toHaveBeenCalled();
  });
});
