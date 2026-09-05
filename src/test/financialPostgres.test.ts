import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { SupabaseFinancialPayableRepository, SupabaseFinancialSettlementRepository, SupabaseReceivablePaymentRepository, SupabaseReceivableRepository } from '../repositories/supabaseFinancialRepositories';

const migration = readFileSync('supabase/migrations/20260905090000_add_arteflow_multi_tenant_financial.sql', 'utf8');

describe('Financeiro PostgreSQL multi-tenant', () => {
  it('cria contas a receber, pagar, baixas e histórico tenant-scoped com RLS', () => {
    for (const table of ['receivables', 'payables', 'settlements', 'events']) expect(migration).toContain(`arteflow_financial_${table}`);
    expect(migration).toContain('enable row level security');
    expect(migration).toContain("'arteflow.finance.view'");
  });
  it('protege mutações com finance.manage, auth.uid e RPC SECURITY DEFINER endurecida', () => {
    expect(migration).toContain('private.arteflow_require_finance');
    expect(migration).toContain("'arteflow.finance.manage'");
    expect(migration).toContain('(select auth.uid()) is null');
    expect(migration).toContain("security definer set search_path=''");
  });
  it('mantém valores monetários em bigint inteiro seguro', () => {
    expect(migration).toContain('amount_cents bigint');
    expect(migration).toContain('paid_amount_cents bigint');
    expect(migration).toContain('9007199254740991');
    expect(migration).not.toMatch(/\b(double precision|real)\b/i);
  });
  it('garante idempotência, lock, limite de saldo e histórico imutável', () => {
    expect(migration).toContain('unique(organization_id,idempotency_key)');
    expect(migration).toContain('idempotency_nonempty');
    expect(migration).toContain('for update');
    expect(migration).toContain('PAYMENT_EXCEEDS_REMAINING');
    expect(migration).toContain('arteflow_financial_events');
  });
  it('integra Pedido→recebível, Compra→pagável e quitação→gate financeiro', () => {
    expect(migration).toContain('arteflow_order_financial_after');
    expect(migration).toContain('arteflow_purchase_financial_after');
    expect(migration).toContain("then 'RELEASED' else 'PAYMENT_PENDING'");
  });
  it('nega escrita direta e execução anônima', () => {
    expect(migration).toContain("revoke all on public.%I from public,anon,authenticated");
    expect(migration).toContain("from public,anon");
  });
  it('repositório filtra organization_id e recusa escrita direta', async () => {
    const order = vi.fn().mockResolvedValue({ data: [], error: null });
    let eq: any; eq = vi.fn().mockReturnValue({ eq, order });
    const from = vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ eq }) });
    const repo = new SupabaseReceivableRepository({ from } as any);
    await repo.list('org-a');
    expect(eq.mock.calls[0]).toEqual(['organization_id', 'org-a']);
    await expect(repo.save()).rejects.toThrow(/RPC transacional/);
  });
  it('recusa bigint monetário fora do intervalo seguro no frontend', async () => {
    const rows = [{ id:'s', organization_id:'o', receivable_id:'r', amount_cents:'9007199254740992', settled_at:'2026-01-01', method:'PIX', idempotency_key:'k', created_by:'u', actor_name:'A', created_at:'x' }];
    const order = vi.fn().mockResolvedValue({ data: rows, error: null });
    const not = vi.fn().mockReturnValue({ order });
    const eq = vi.fn().mockReturnValue({ not });
    const from = vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ eq }) });
    await expect(new SupabaseReceivablePaymentRepository({ from } as any).list('o')).rejects.toThrow(/inseguro/);
  });
  it('carrega payables e settlements sempre com filtro do tenant', async () => {
    const order = vi.fn().mockResolvedValue({ data: [], error: null });
    const eq = vi.fn().mockReturnValue({ order });
    const from = vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ eq }) });
    await new SupabaseFinancialPayableRepository({ from } as any).list('org-b');
    await new SupabaseFinancialSettlementRepository({ from } as any).list('org-b');
    expect(eq).toHaveBeenNthCalledWith(1, 'organization_id', 'org-b');
    expect(eq).toHaveBeenNthCalledWith(2, 'organization_id', 'org-b');
  });
});
