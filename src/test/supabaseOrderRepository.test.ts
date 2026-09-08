import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseOrderRepository } from '../repositories/supabaseOrderRepository';
import type { Order } from '../types/domain';

const organizationId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const orderId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

function order(overrides: Partial<Order> = {}): Order {
  return {
    id: 'order-local',
    orderNumber: 'PED-LOCAL-0001',
    organizationId,
    origin: 'MANUAL',
    customer: { id: 'customer-local', name: 'Cliente de Teste' },
    items: [{
      id: 'item-local',
      orderId: 'order-local',
      productName: 'Cartaz de teste',
      sector: 'Impressão Digital',
      quantity: 2,
      unit: 'un',
      unitPriceCents: 1250,
      totalPriceCents: 2500,
      finishings: [],
      generatedJobId: 'job-local',
      dataOrigin: 'user',
    }],
    totalAmountCents: 2500,
    status: 'IN_PRODUCTION',
    deliveryDateISO: '2026-09-10T12:00:00.000Z',
    createdAt: '2026-09-03T12:00:00.000Z',
    updatedAt: '2026-09-03T12:00:00.000Z',
    dataOrigin: 'user',
    ...overrides,
  };
}

describe('SupabaseOrderRepository', () => {
  it('cria pedido exclusivamente pela RPC atômica', async () => {
    const persisted = order({ id: orderId, orderNumber: 'PED-2026-0001' });
    const rpc = vi.fn().mockResolvedValue({ data: persisted, error: null });
    const repository = new SupabaseOrderRepository({ rpc } as unknown as SupabaseClient);

    await expect(repository.save(organizationId, order())).resolves.toEqual(persisted);
    expect(rpc).toHaveBeenCalledWith('arteflow_create_order', expect.objectContaining({
      p_organization_id: organizationId,
      p_origin: 'MANUAL',
      p_items: expect.arrayContaining([expect.objectContaining({ unitPriceCents: 1250 })]),
    }));
  });

  it('atualiza pedido UUID pela RPC protegida', async () => {
    const persisted = order({ id: orderId, status: 'COMPLETED' });
    const rpc = vi.fn().mockResolvedValue({ data: persisted, error: null });
    const repository = new SupabaseOrderRepository({ rpc } as unknown as SupabaseClient);

    await repository.save(organizationId, persisted);
    expect(rpc).toHaveBeenCalledWith('arteflow_update_order', expect.objectContaining({
      p_organization_id: organizationId,
      p_order_id: orderId,
      p_status: 'COMPLETED',
    }));
  });

  it('bloqueia escrita cross-tenant antes da chamada remota', async () => {
    const rpc = vi.fn();
    const repository = new SupabaseOrderRepository({ rpc } as unknown as SupabaseClient);
    await expect(repository.save('cccccccc-cccc-4ccc-8ccc-cccccccccccc', order()))
      .rejects.toThrow('CROSS_TENANT_ORDER_WRITE');
    expect(rpc).not.toHaveBeenCalled();
  });

  it('não oferece delete ou clear no modo conectado', async () => {
    const repository = new SupabaseOrderRepository({} as SupabaseClient);
    await expect(repository.delete(organizationId, orderId)).rejects.toThrow('não está habilitada');
    await expect(repository.clear(organizationId)).rejects.toThrow('não está habilitada');
  });

  it('propaga negação controlada da RPC', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: 'ORDER_CREATE_FORBIDDEN' } });
    const repository = new SupabaseOrderRepository({ rpc } as unknown as SupabaseClient);
    await expect(repository.save(organizationId, order())).rejects.toThrow('ORDER_CREATE_FORBIDDEN');
  });

  describe('Schema Drift & P2-03 Isolation', () => {
    it('list e getById NÃO selecionam seller_name nem campos de comissão (P2-03)', async () => {
      let selectedColumns = '';
      const mockSupabase = {
        from: vi.fn().mockImplementation((table: string) => {
          expect(table).toBe('arteflow_orders');
          return {
            select: vi.fn().mockImplementation((cols: string) => {
              selectedColumns = cols;
              return {
                eq: vi.fn().mockReturnValue({
                  order: vi.fn().mockResolvedValue({
                    data: [{
                      id: orderId,
                      organization_id: organizationId,
                      order_number: 'PED-2026-0001',
                      origin: 'MANUAL',
                      status: 'IN_PRODUCTION',
                      customer_snapshot_id: 'cust-1',
                      customer_name: 'Cliente Teste',
                      customer_document: null,
                      customer_email: null,
                      customer_phone: null,
                      customer_contact_person: null,
                      total_amount_cents: 2500,
                      notes: null,
                      orcagraf_quote_id: null,
                      delivery_date: '2026-09-10T12:00:00.000Z',
                      created_at: '2026-09-03T12:00:00.000Z',
                      updated_at: '2026-09-03T12:00:00.000Z',
                      data_origin: 'user',
                      arteflow_order_items: [],
                    }],
                    error: null,
                  }),
                  eq: vi.fn().mockReturnValue({
                    maybeSingle: vi.fn().mockResolvedValue({
                      data: {
                        id: orderId,
                        organization_id: organizationId,
                        order_number: 'PED-2026-0001',
                        origin: 'ORCAGRAF',
                        status: 'IN_PRODUCTION',
                        customer_snapshot_id: 'cust-1',
                        customer_name: 'Cliente Teste',
                        customer_document: null,
                        customer_email: null,
                        customer_phone: null,
                        customer_contact_person: null,
                        total_amount_cents: 2500,
                        notes: null,
                        orcagraf_quote_id: 'quote-123',
                        delivery_date: '2026-09-10T12:00:00.000Z',
                        created_at: '2026-09-03T12:00:00.000Z',
                        updated_at: '2026-09-03T12:00:00.000Z',
                        data_origin: 'user',
                        arteflow_order_items: [],
                      },
                      error: null,
                    }),
                  }),
                }),
              };
            }),
          };
        }),
      } as unknown as SupabaseClient;

      const repository = new SupabaseOrderRepository(mockSupabase);

      // Listar pedidos
      const orders = await repository.list(organizationId);
      expect(orders).toHaveLength(1);
      expect(orders[0].origin).toBe('MANUAL');

      // Buscar por ID com origin ORCAGRAF e orcagraf_quote_id
      const singleOrder = await repository.getById(organizationId, orderId);
      expect(singleOrder).not.toBeNull();
      expect(singleOrder?.origin).toBe('ORCAGRAF');
      expect(singleOrder?.orcagrafQuoteId).toBe('quote-123');

      // Verificar que seller_name e comissões NÃO estão no SELECT
      expect(selectedColumns).not.toContain('seller_name');
      expect(selectedColumns).not.toContain('seller_id');
      expect(selectedColumns).not.toContain('seller_commission_pct');
      expect(selectedColumns).not.toContain('commission');

      // Verificar que colunas canônicas e orcagraf_quote_id ESTÃO no SELECT
      expect(selectedColumns).toContain('id');
      expect(selectedColumns).toContain('organization_id');
      expect(selectedColumns).toContain('order_number');
      expect(selectedColumns).toContain('origin');
      expect(selectedColumns).toContain('orcagraf_quote_id');
    });
  });
});
