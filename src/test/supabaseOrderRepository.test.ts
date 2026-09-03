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
});
