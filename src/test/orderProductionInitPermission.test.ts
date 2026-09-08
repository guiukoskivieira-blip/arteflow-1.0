import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseOrderRepository } from '../repositories/supabaseOrderRepository';
import { OrderService } from '../services/orderService';
import type { Order, ProductionJob } from '../types/domain';

const migration = readFileSync('supabase/migrations/20260908000000_fix_order_production_init_permission.sql', 'utf8');

const orgA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const orgB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const orderId = '11111111-1111-4111-8111-111111111111';
const jobId1 = '22222222-2222-4222-8222-222222222222';
const jobId2 = '33333333-3333-4333-8333-333333333333';

function buildSampleOrder(organizationId: string = orgA): Order {
  return {
    id: 'order-local',
    orderNumber: 'PED-LOCAL-0001',
    organizationId,
    origin: 'MANUAL',
    customer: { id: 'cust-1', name: 'Cliente Teste Hotfix' },
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
    createdAt: '2026-09-08T00:00:00.000Z',
    updatedAt: '2026-09-08T00:00:00.000Z',
    dataOrigin: 'user',
  };
}

describe('Hotfix P1-01: Permissão na RPC arteflow_create_order_with_production', () => {
  it('1. Contrato da Migration: exige arteflow.orders.create e NÃO exige arteflow.production.manage na criação inicial', () => {
    expect(migration).toContain('arteflow_create_order_with_production');
    expect(migration).toContain('security definer');
    expect(migration).toContain("set search_path = ''");
    expect(migration).toContain("from public, anon");
    expect(migration).toContain("to authenticated");

    // Valida que orders.create é estritamente exigido
    expect(migration).toContain("private.arteflow_has_permission(p_organization_id, 'arteflow.orders.create')");
    expect(migration).toContain('ORDER_CREATE_FORBIDDEN');

    // Valida que production.manage FOI REMOVIDO da RPC de criação de pedido
    expect(migration).not.toContain('private.arteflow_can_manage_production');
    expect(migration).not.toContain('PRODUCTION_MANAGE_DENIED');
  });

  it('2. Assinatura pública compatível preservada', () => {
    expect(migration).toContain('p_organization_id uuid');
    expect(migration).toContain('p_origin text');
    expect(migration).toContain('p_customer jsonb');
    expect(migration).toContain('p_items jsonb');
    expect(migration).toContain('p_notes text');
    expect(migration).toContain('p_delivery_date timestamptz');
    expect(migration).toContain('returns jsonb');
  });
});

describe('Hotfix P1-01: Cenários de Validação Obrigatórios (A - G)', () => {
  it('A. OWNER: possui acesso e cria pedido normalmente com OPs vinculadas', async () => {
    const inputOrder = buildSampleOrder(orgA);
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
        organizationId: orgA,
        orderId,
        orderItemId: 'db-item-1',
        orderNumber: 'PED-2026-0001',
        customer: { id: 'cust-1', name: 'Cliente Teste Hotfix' },
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
        createdAt: '2026-09-08T00:00:00.000Z',
        updatedAt: '2026-09-08T00:00:00.000Z',
        dataOrigin: 'user',
      },
      {
        id: jobId2,
        jobCode: 'OP-2026-0002',
        organizationId: orgA,
        orderId,
        orderItemId: 'db-item-2',
        orderNumber: 'PED-2026-0001',
        customer: { id: 'cust-1', name: 'Cliente Teste Hotfix' },
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
        createdAt: '2026-09-08T00:00:00.000Z',
        updatedAt: '2026-09-08T00:00:00.000Z',
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
    const jobRepo = { list: vi.fn().mockResolvedValue([]), listByOrderId: vi.fn().mockResolvedValue(createdJobs), saveMany: vi.fn() };
    const eventRepo = { appendMany: vi.fn() };
    const orderService = new OrderService(orderRepo, jobRepo as any, eventRepo as any);

    const result = await orderService.createManualOrder({
      organizationId: orgA,
      customer: { name: 'Cliente Teste Hotfix' },
      items: [
        { productName: 'Cartaz Offset', sector: 'Impressão Offset', unit: 'cm', quantity: 500, unitPriceCents: 200, finishings: ['Verniz'] },
        { productName: 'Banner Frontlight', sector: 'Comunicação Visual', width: 100, height: 200, unit: 'cm', quantity: 2, unitPriceCents: 15000, finishings: ['Ilhós'] },
      ],
      deliveryDateISO: '2026-09-15T00:00:00.000Z',
    });

    expect(result.order.id).toBe(orderId);
    expect(result.jobs).toHaveLength(2);
    expect(rpc).toHaveBeenCalledWith('arteflow_create_order_with_production', expect.anything());
  });

  it('B. MEMBER com orders.create e production.view (sem production.manage): cria pedido + OPs com sucesso', async () => {
    const inputOrder = buildSampleOrder(orgA);
    const createdOrder: Order = {
      ...inputOrder,
      id: orderId,
      orderNumber: 'PED-2026-0002',
      items: [{ ...inputOrder.items[0], id: 'db-item-1', orderId, generatedJobId: jobId1 }],
    };

    const createdJobs: ProductionJob[] = [
      {
        id: jobId1,
        jobCode: 'OP-2026-0003',
        organizationId: orgA,
        orderId,
        orderItemId: 'db-item-1',
        orderNumber: 'PED-2026-0002',
        customer: { id: 'cust-1', name: 'Cliente Teste Hotfix' },
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
        createdAt: '2026-09-08T00:00:00.000Z',
        updatedAt: '2026-09-08T00:00:00.000Z',
        dataOrigin: 'user',
      },
    ];

    const rpc = vi.fn().mockResolvedValue({ data: createdOrder, error: null });
    const orderRepo = new SupabaseOrderRepository({ rpc } as unknown as SupabaseClient);
    const jobRepo = { list: vi.fn().mockResolvedValue([]), listByOrderId: vi.fn().mockResolvedValue(createdJobs), saveMany: vi.fn() };
    const eventRepo = { appendMany: vi.fn() };
    const orderService = new OrderService(orderRepo, jobRepo as any, eventRepo as any);

    const result = await orderService.createManualOrder({
      organizationId: orgA,
      customer: { name: 'Cliente Teste Hotfix' },
      items: [
        { productName: 'Cartaz Offset', sector: 'Impressão Offset', unit: 'cm', quantity: 500, unitPriceCents: 200, finishings: ['Verniz'] },
      ],
      deliveryDateISO: '2026-09-15T00:00:00.000Z',
    });

    expect(result.order.id).toBe(orderId);
    expect(result.jobs).toHaveLength(1);
    expect(result.jobs[0].jobCode).toBe('OP-2026-0003');
  });

  it('C. MEMBER sem orders.create: recebe deny (ORDER_CREATE_FORBIDDEN)', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'ORDER_CREATE_FORBIDDEN', code: '42501' },
    });

    const orderRepo = new SupabaseOrderRepository({ rpc } as unknown as SupabaseClient);
    const jobRepo = { list: vi.fn().mockResolvedValue([]), listByOrderId: vi.fn(), saveMany: vi.fn() };
    const eventRepo = { appendMany: vi.fn() };
    const orderService = new OrderService(orderRepo, jobRepo as any, eventRepo as any);

    await expect(
      orderService.createManualOrder({
        organizationId: orgA,
        customer: { name: 'Cliente' },
        items: [{ productName: 'Item', sector: 'Digital', unit: 'cm', quantity: 1, unitPriceCents: 100, finishings: [] }],
        deliveryDateISO: '2026-09-15T00:00:00.000Z',
      })
    ).rejects.toThrow('ORDER_CREATE_FORBIDDEN');
  });

  it('D. Cross-tenant: usuário tentando criar pedido com organization_id diferente é rejeitado fail-closed', async () => {
    const rpc = vi.fn();
    const orderRepo = new SupabaseOrderRepository({ rpc } as unknown as SupabaseClient);
    const order = buildSampleOrder(orgA);

    await expect(
      orderRepo.createWithProductionJobs(orgB, order)
    ).rejects.toThrow('CROSS_TENANT_ORDER_WRITE');

    expect(rpc).not.toHaveBeenCalled();
  });

  it('E. Usuário não autenticado: recebe deny (AUTHENTICATION_REQUIRED)', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'AUTHENTICATION_REQUIRED', code: '42501' },
    });

    const orderRepo = new SupabaseOrderRepository({ rpc } as unknown as SupabaseClient);
    const jobRepo = { list: vi.fn().mockResolvedValue([]), listByOrderId: vi.fn(), saveMany: vi.fn() };
    const eventRepo = { appendMany: vi.fn() };
    const orderService = new OrderService(orderRepo, jobRepo as any, eventRepo as any);

    await expect(
      orderService.createManualOrder({
        organizationId: orgA,
        customer: { name: 'Cliente' },
        items: [{ productName: 'Item', sector: 'Digital', unit: 'cm', quantity: 1, unitPriceCents: 100, finishings: [] }],
        deliveryDateISO: '2026-09-15T00:00:00.000Z',
      })
    ).rejects.toThrow('AUTHENTICATION_REQUIRED');
  });

  it('F. Escopo de permissão: orders.create NÃO concede capacidade de gestão posterior da produção', () => {
    const productionMigration = readFileSync('supabase/migrations/20260904043000_add_arteflow_multi_tenant_production.sql', 'utf8');

    expect(productionMigration).toContain('arteflow_create_production_job');
    expect(productionMigration).toContain('arteflow_move_production_job');
    expect(productionMigration).toContain('arteflow_update_production_job');
    expect(productionMigration).toContain('arteflow_add_production_note');
    expect(productionMigration).toContain('private.arteflow_can_manage_production');
  });

  it('G. Atomic rollback: falha em qualquer item ou validação na RPC reverte a criação integral', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'INVALID_STAGE', code: '22023' },
    });

    const orderRepo = new SupabaseOrderRepository({ rpc } as unknown as SupabaseClient);
    const jobRepo = { list: vi.fn().mockResolvedValue([]), listByOrderId: vi.fn(), saveMany: vi.fn() };
    const eventRepo = { appendMany: vi.fn() };
    const orderService = new OrderService(orderRepo, jobRepo as any, eventRepo as any);

    await expect(
      orderService.createManualOrder({
        organizationId: orgA,
        customer: { name: 'Cliente' },
        items: [
          { productName: 'Item 1', sector: 'Digital', unit: 'cm', quantity: 1, unitPriceCents: 100, finishings: [], initialStageId: 'stage-inexistente' },
        ],
        deliveryDateISO: '2026-09-15T00:00:00.000Z',
      })
    ).rejects.toThrow('INVALID_STAGE');

    expect(jobRepo.saveMany).not.toHaveBeenCalled();
    expect(eventRepo.appendMany).not.toHaveBeenCalled();
  });

  describe('Hotfix P2-01: Persistência de orcagraf_quote_id e Bloqueio de Duplicidade (1 - 8)', () => {
    const p2Migration = readFileSync(
      'supabase/migrations/20260908030000_persist_orcagraf_quote_id_in_order_production.sql',
      'utf8'
    );

    it('1 & 2. Importação OrçaGraf: orcagrafQuoteId chega ao repository e RPC recebe p_orcagraf_quote_id', async () => {
      const rpc = vi.fn().mockResolvedValue({
        data: { id: orderId, order_number: 'PED-2026-0001' },
        error: null,
      });

      const orderRepo = new SupabaseOrderRepository({ rpc } as unknown as SupabaseClient);
      const jobRepo = { list: vi.fn().mockResolvedValue([]), listByOrderId: vi.fn(), saveMany: vi.fn() };
      const eventRepo = { appendMany: vi.fn() };
      const orderService = new OrderService(orderRepo, jobRepo as any, eventRepo as any);

      await orderService.createManualOrder({
        organizationId: orgA,
        origin: 'ORCAGRAF',
        orcagrafQuoteId: 'orc-quote-uuid-1234',
        customer: { name: 'Cliente OrçaGraf' },
        items: [
          { productName: 'Banner 440g', sector: 'Digital', unit: 'm', quantity: 2, unitPriceCents: 5000, finishings: [] },
        ],
        deliveryDateISO: '2026-09-15T00:00:00.000Z',
      });

      expect(rpc).toHaveBeenCalledWith(
        'arteflow_create_order_with_production',
        expect.objectContaining({
          p_organization_id: orgA,
          p_origin: 'ORCAGRAF',
          p_orcagraf_quote_id: 'orc-quote-uuid-1234',
        })
      );
    });

    it('3 & 4. Migration persiste orcagraf_quote_id no INSERT e pedido manual envia p_orcagraf_quote_id = NULL', async () => {
      // 3. Verifica contrato SQL da migration
      expect(p2Migration).toContain('p_orcagraf_quote_id text default null');
      expect(p2Migration).toContain('orcagraf_quote_id, delivery_date, created_by, updated_by, data_origin');
      expect(p2Migration).toContain('v_clean_quote_id, p_delivery_date, v_user_id, v_user_id, \'user\'');

      // 4. Pedido manual envia null
      const rpc = vi.fn().mockResolvedValue({
        data: { id: orderId, order_number: 'PED-2026-0002' },
        error: null,
      });
      const orderRepo = new SupabaseOrderRepository({ rpc } as unknown as SupabaseClient);
      const jobRepo = { list: vi.fn().mockResolvedValue([]), listByOrderId: vi.fn(), saveMany: vi.fn() };
      const eventRepo = { appendMany: vi.fn() };
      const orderService = new OrderService(orderRepo, jobRepo as any, eventRepo as any);

      await orderService.createManualOrder({
        organizationId: orgA,
        origin: 'MANUAL',
        customer: { name: 'Cliente Manual' },
        items: [
          { productName: 'Cartão de Visita', sector: 'Digital', unit: 'mm', quantity: 1000, unitPriceCents: 10, finishings: [] },
        ],
        deliveryDateISO: '2026-09-15T00:00:00.000Z',
      });

      expect(rpc).toHaveBeenCalledWith(
        'arteflow_create_order_with_production',
        expect.objectContaining({
          p_origin: 'MANUAL',
          p_orcagraf_quote_id: null,
        })
      );
    });

    it('5 & 6. Erro de duplicidade 23505 traduzido para mensagem amigável sem vazar detalhes internos', async () => {
      const rpc = vi.fn().mockResolvedValue({
        data: null,
        error: {
          code: '23505',
          message: 'duplicate key value violates unique constraint "arteflow_orders_org_orcagraf_quote_uidx"',
        },
      });

      const orderRepo = new SupabaseOrderRepository({ rpc } as unknown as SupabaseClient);
      const jobRepo = { list: vi.fn().mockResolvedValue([]), listByOrderId: vi.fn(), saveMany: vi.fn() };
      const eventRepo = { appendMany: vi.fn() };
      const orderService = new OrderService(orderRepo, jobRepo as any, eventRepo as any);

      await expect(
        orderService.createManualOrder({
          organizationId: orgA,
          origin: 'ORCAGRAF',
          orcagrafQuoteId: 'orc-quote-uuid-1234',
          customer: { name: 'Cliente Duplicado' },
          items: [
            { productName: 'Item Duplicado', sector: 'Digital', unit: 'cm', quantity: 1, unitPriceCents: 1000, finishings: [] },
          ],
          deliveryDateISO: '2026-09-15T00:00:00.000Z',
        })
      ).rejects.toThrow('Este orçamento do OrçaGraf já foi importado para o ArteFlow.');
    });

    it('7 & 8. P1-01 preservado e criação normal continua gerando pedido + OPs', () => {
      // P1-01 preservado
      expect(p2Migration).toContain("private.arteflow_has_permission(p_organization_id, 'arteflow.orders.create')");
      expect(p2Migration).not.toContain('private.arteflow_can_manage_production');
      expect(p2Migration).not.toContain('PRODUCTION_MANAGE_DENIED');
      // Geração de OP e eventos preservada
      expect(p2Migration).toContain('insert into public.arteflow_production_jobs');
      expect(p2Migration).toContain('insert into public.arteflow_production_job_events');
    });
  });

  describe('Hotfix P2-02: Etapa Inicial Dinâmica por Item (1 - 13)', () => {
    const p202Migration = readFileSync(
      'supabase/migrations/20260908040000_dynamic_initial_stage_resolution.sql',
      'utf8'
    );

    it('1. SQL Migration remove literal stage-entry do fluxo operacional e usa stages ativas', () => {
      expect(p202Migration).not.toContain("'stage-entry'");
      expect(p202Migration).toContain('from public.arteflow_production_stages');
      expect(p202Migration).toContain('is_active = true');
    });

    it('2, 3, 4, 5, 6, 7. Resolução de fallback por is_initial, sequence e falha segura', () => {
      expect(p202Migration).toContain('case when is_initial = true then 0 else 1 end');
      expect(p202Migration).toContain('sequence asc');
      expect(p202Migration).toContain('Nenhuma etapa de produção ativa está configurada para esta organização.');
      expect(p202Migration).toContain('INVALID_STAGE');
    });

    it('8 & 9. Itens distintos podem enviar stages iniciais diferentes via OrderService / Repository', async () => {
      const rpc = vi.fn().mockResolvedValue({
        data: { id: orderId, order_number: 'PED-2026-0003' },
        error: null,
      });
      const orderRepo = new SupabaseOrderRepository({ rpc } as unknown as SupabaseClient);
      const jobRepo = { list: vi.fn().mockResolvedValue([]), listByOrderId: vi.fn(), saveMany: vi.fn() };
      const eventRepo = { appendMany: vi.fn() };
      const orderService = new OrderService(orderRepo, jobRepo as any, eventRepo as any);

      await orderService.createManualOrder({
        organizationId: orgA,
        origin: 'MANUAL',
        customer: { name: 'Cliente Multi-Stage' },
        items: [
          { productName: 'Item A', sector: 'Digital', unit: 'cm', quantity: 1, unitPriceCents: 100, finishings: [], initialStageId: 'stage-prepress' },
          { productName: 'Item B', sector: 'Digital', unit: 'cm', quantity: 1, unitPriceCents: 200, finishings: [], initialStageId: 'stage-scheduled' },
        ],
        deliveryDateISO: '2026-09-15T00:00:00.000Z',
      });

      expect(rpc).toHaveBeenCalledWith(
        'arteflow_create_order_with_production',
        expect.objectContaining({
          p_items: [
            expect.objectContaining({ productName: 'Item A', initialStageId: 'stage-prepress' }),
            expect.objectContaining({ productName: 'Item B', initialStageId: 'stage-scheduled' }),
          ],
        })
      );
    });

    it('10, 11, 12, 13. P1-01, P2-01 e IN_PRODUCTION preservados', () => {
      expect(p202Migration).toContain("private.arteflow_has_permission(p_organization_id, 'arteflow.orders.create')");
      expect(p202Migration).toContain('p_orcagraf_quote_id text default null');
      expect(p202Migration).toContain("'IN_PRODUCTION'");
    });
  });
});
