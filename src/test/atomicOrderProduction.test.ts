import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseOrderRepository } from '../repositories/supabaseOrderRepository';
import { OrderService } from '../services/orderService';
import type { Order, ProductionJob } from '../types/domain';

const migration = readFileSync('supabase/migrations/20260906060000_add_atomic_order_production_rpc.sql', 'utf8');

const orgId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const orderId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const jobId1 = '11111111-1111-4111-8111-111111111111';
const jobId2 = '22222222-2222-4222-8222-222222222222';

function buildSampleOrder(): Order {
  return {
    id: 'order-local',
    orderNumber: 'PED-LOCAL-0001',
    organizationId: orgId,
    origin: 'MANUAL',
    customer: { id: 'cust-1', name: 'Cliente Atômico' },
    items: [
      {
        id: 'item-1',
        orderId: 'order-local',
        productName: 'Cartaz Offset',
        sector: 'Impressão Offset',
        quantity: 500,
        unit: 'un',
        unitPriceCents: 200,
        totalPriceCents: 100000,
        finishings: ['Verniz'],
        dataOrigin: 'user',
      },
      {
        id: 'item-2',
        orderId: 'order-local',
        productName: 'Banner Frontlight',
        sector: 'Comunicação Visual',
        dimensions: { width: 100, height: 200, unit: 'cm' },
        quantity: 2,
        unit: 'un',
        unitPriceCents: 15000,
        totalPriceCents: 30000,
        finishings: ['Ilhós'],
        dataOrigin: 'user',
      },
    ],
    totalAmountCents: 130000,
    status: 'IN_PRODUCTION',
    deliveryDateISO: '2026-09-15T00:00:00.000Z',
    createdAt: '2026-09-06T00:00:00.000Z',
    updatedAt: '2026-09-06T00:00:00.000Z',
    dataOrigin: 'user',
  };
}

describe('E9-05: Atomicidade Orders → Production (Migration & RPC Contract)', () => {
  it('define a RPC arteflow_create_order_with_production com search_path seguro e security definer', () => {
    expect(migration).toContain('arteflow_create_order_with_production');
    expect(migration).toContain("security definer");
    expect(migration).toContain("set search_path = ''");
    expect(migration).toContain("from public, anon");
    expect(migration).toContain("to authenticated");
  });

  it('valida autorizações de criação de pedido e gerenciamento de produção no início da transação', () => {
    expect(migration).toContain("private.arteflow_has_permission(p_organization_id, 'arteflow.orders.create')");
    expect(migration).toContain("private.arteflow_can_manage_production(p_organization_id)");
    expect(migration).toContain("ORDER_CREATE_FORBIDDEN");
    expect(migration).toContain("PRODUCTION_MANAGE_DENIED");
  });

  it('insere pedido, itens, ordens de produção e eventos na mesma transação PostgreSQL', () => {
    expect(migration).toContain('insert into public.arteflow_orders');
    expect(migration).toContain('insert into public.arteflow_order_items');
    expect(migration).toContain('insert into public.arteflow_production_jobs');
    expect(migration).toContain('insert into public.arteflow_production_job_events');
  });

  it('respeita os limites estritos de contrato monetário e de quantidade (E9-03 / E9-04)', () => {
    expect(migration).toContain('9007199254740991');
    expect(migration).toContain('INVALID_ITEM_UNIT_PRICE');
    expect(migration).toContain('INVALID_ITEM_QUANTITY');
    expect(migration).toContain('UNSAFE_ORDER_TOTAL');
  });
});

describe('E9-05: OrderService & SupabaseOrderRepository Atomic Flow', () => {
  it('A. Sucesso: cria 1 Order e carrega todas as OPs vinculadas criadas na RPC atômica', async () => {
    const inputOrder = buildSampleOrder();
    const createdOrder: Order = {
      ...inputOrder,
      id: orderId,
      orderNumber: 'PED-2026-0001',
      items: [
        { ...inputOrder.items[0], id: 'db-item-1', orderId, generatedJobId: jobId1 },
        { ...inputOrder.items[1], id: 'db-item-2', orderId, generatedJobId: jobId2 },
      ],
    };

    const createdJobs: ProductionJob[] = [
      {
        id: jobId1,
        jobCode: 'OP-2026-0001',
        organizationId: orgId,
        orderId,
        orderItemId: 'db-item-1',
        orderNumber: 'PED-2026-0001',
        customer: { id: 'cust-1', name: 'Cliente Atômico' },
        productName: 'Cartaz Offset',
        quantity: 500,
        unit: 'un',
        finishings: ['Verniz'],
        stageId: 'stage-entry',
        artworkGate: 'NOT_RECEIVED',
        materialGate: 'NOT_CHECKED',
        financialGate: 'PAYMENT_PENDING',
        priority: 'MEDIUM',
        sector: 'Impressão Offset',
        assignee: null,
        deadlineISO: '2026-09-15T00:00:00.000Z',
        createdAt: '2026-09-06T00:00:00.000Z',
        updatedAt: '2026-09-06T00:00:00.000Z',
        dataOrigin: 'user',
      },
      {
        id: jobId2,
        jobCode: 'OP-2026-0002',
        organizationId: orgId,
        orderId,
        orderItemId: 'db-item-2',
        orderNumber: 'PED-2026-0001',
        customer: { id: 'cust-1', name: 'Cliente Atômico' },
        productName: 'Banner Frontlight',
        dimensions: { width: 100, height: 200, unit: 'cm' },
        quantity: 2,
        unit: 'un',
        finishings: ['Ilhós'],
        stageId: 'stage-entry',
        artworkGate: 'NOT_RECEIVED',
        materialGate: 'NOT_CHECKED',
        financialGate: 'PAYMENT_PENDING',
        priority: 'MEDIUM',
        sector: 'Comunicação Visual',
        assignee: null,
        deadlineISO: '2026-09-15T00:00:00.000Z',
        createdAt: '2026-09-06T00:00:00.000Z',
        updatedAt: '2026-09-06T00:00:00.000Z',
        dataOrigin: 'user',
      },
    ];

    const rpc = vi.fn().mockImplementation(async (fnName: string) => {
      if (fnName === 'arteflow_create_order_with_production') {
        return { data: createdOrder, error: null };
      }
      return { data: null, error: { message: `Unknown RPC: ${fnName}` } };
    });

    const orderRepo = new SupabaseOrderRepository({ rpc } as unknown as SupabaseClient);
    const jobRepo = {
      list: vi.fn().mockResolvedValue([]),
      listByOrderId: vi.fn().mockResolvedValue(createdJobs),
      saveMany: vi.fn(),
    };
    const eventRepo = {
      appendMany: vi.fn(),
    };

    const orderService = new OrderService(orderRepo, jobRepo as any, eventRepo as any);

    const result = await orderService.createManualOrder({
      organizationId: orgId,
      customer: { name: 'Cliente Atômico' },
      items: [
        {
          productName: 'Cartaz Offset',
          sector: 'Impressão Offset',
          unit: 'cm',
          quantity: 500,
          quantityUnit: 'un',
          unitPriceCents: 200,
          finishings: ['Verniz'],
        },
        {
          productName: 'Banner Frontlight',
          sector: 'Comunicação Visual',
          width: 100,
          height: 200,
          unit: 'cm',
          quantity: 2,
          quantityUnit: 'un',
          unitPriceCents: 15000,
          finishings: ['Ilhós'],
        },
      ],
      deliveryDateISO: '2026-09-15T00:00:00.000Z',
    });

    // Validar chamada da RPC única atômica
    expect(rpc).toHaveBeenCalledWith('arteflow_create_order_with_production', expect.objectContaining({
      p_organization_id: orgId,
      p_origin: 'MANUAL',
      p_customer: expect.objectContaining({ name: 'Cliente Atômico' }),
      p_items: expect.arrayContaining([
        expect.objectContaining({ productName: 'Cartaz Offset', unitPriceCents: 200 }),
        expect.objectContaining({ productName: 'Banner Frontlight', unitPriceCents: 15000 }),
      ]),
    }));

    // No modo atômico, não deve chamar individualmente jobRepo.saveMany ou eventRepo.appendMany no client
    expect(jobRepo.saveMany).not.toHaveBeenCalled();
    expect(eventRepo.appendMany).not.toHaveBeenCalled();

    expect(result.order).toEqual(createdOrder);
    expect(result.jobs).toHaveLength(2);
    expect(result.jobs[0].orderId).toBe(orderId);
    expect(result.jobs[1].orderId).toBe(orderId);
  });

  it('B. Falha forçada: se a RPC atômica falhar, nada persiste e erro é propagado integralmente', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'INVALID_STAGE' },
    });

    const orderRepo = new SupabaseOrderRepository({ rpc } as unknown as SupabaseClient);
    const jobRepo = {
      list: vi.fn().mockResolvedValue([]),
      listByOrderId: vi.fn(),
      saveMany: vi.fn(),
    };
    const eventRepo = { appendMany: vi.fn() };

    const orderService = new OrderService(orderRepo, jobRepo as any, eventRepo as any);

    await expect(
      orderService.createManualOrder({
        organizationId: orgId,
        customer: { name: 'Cliente' },
        items: [{ productName: 'Item', sector: 'Digital', unit: 'cm', quantity: 1, unitPriceCents: 100, finishings: [] }],
        deliveryDateISO: '2026-09-15T00:00:00.000Z',
      })
    ).rejects.toThrow('INVALID_STAGE');

    expect(jobRepo.saveMany).not.toHaveBeenCalled();
    expect(eventRepo.appendMany).not.toHaveBeenCalled();
  });

  it('C. Múltiplas OPs: se a validação/criação falhar para qualquer OP, a chamada é abortada', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'PRODUCTION_MANAGE_DENIED' },
    });

    const orderRepo = new SupabaseOrderRepository({ rpc } as unknown as SupabaseClient);
    const jobRepo = { list: vi.fn().mockResolvedValue([]), listByOrderId: vi.fn(), saveMany: vi.fn() };
    const eventRepo = { appendMany: vi.fn() };

    const orderService = new OrderService(orderRepo, jobRepo as any, eventRepo as any);

    await expect(
      orderService.createManualOrder({
        organizationId: orgId,
        customer: { name: 'Cliente' },
        items: [
          { productName: 'Item 1', sector: 'Digital', unit: 'cm', quantity: 1, unitPriceCents: 100, finishings: [] },
          { productName: 'Item 2', sector: 'Digital', unit: 'cm', quantity: 2, unitPriceCents: 200, finishings: [] },
        ],
        deliveryDateISO: '2026-09-15T00:00:00.000Z',
      })
    ).rejects.toThrow('PRODUCTION_MANAGE_DENIED');
  });

  it('D. Cross-tenant: rejeita chamada com tenant mismatch antes de acionar RPC', async () => {
    const rpc = vi.fn();
    const orderRepo = new SupabaseOrderRepository({ rpc } as unknown as SupabaseClient);
    const order = buildSampleOrder();

    await expect(
      orderRepo.createWithProductionJobs('cccccccc-cccc-4ccc-8ccc-cccccccccccc', order)
    ).rejects.toThrow('CROSS_TENANT_ORDER_WRITE');

    expect(rpc).not.toHaveBeenCalled();
  });
});
