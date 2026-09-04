import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migration = readFileSync(resolve('supabase/migrations/20260904211430_add_arteflow_multi_tenant_inventory_ledger.sql'), 'utf8');
const context = readFileSync(resolve('src/context/ArteFlowContext.tsx'), 'utf8');
const service = readFileSync(resolve('src/services/supabaseInventoryService.ts'), 'utf8');

describe('Etapa 5 — contrato PostgreSQL do estoque', () => {
  it('cria item, requisitos, reservas e ledger tenant-scoped', () => {
    for (const table of ['items','requirements','reservations','movements']) {
      expect(migration).toContain(`arteflow_inventory_${table}`);
    }
    expect(migration.match(/organization_id uuid not null/g)?.length).toBeGreaterThanOrEqual(4);
  });
  it('usa bigint para quantidades em milésimos e centavos', () => {
    expect(migration).toContain('stock_on_hand_milli bigint');
    expect(migration).toContain('quantity_milli bigint');
    expect(migration).toContain('average_cost_cents bigint');
  });
  it('mantém o ledger imutável pelo cliente', () => {
    expect(migration).toContain('grant select on public.arteflow_inventory_items');
    expect(migration).not.toMatch(/grant\s+(insert|update|delete).*arteflow_inventory_movements/i);
  });
  it('habilita RLS e aplica inventory.view às quatro tabelas', () => {
    expect(migration.match(/enable row level security/g)).toHaveLength(4);
    expect(migration.match(/arteflow\.inventory\.view/g)?.length).toBeGreaterThanOrEqual(4);
  });
  it('protege mutações com inventory.manage e auth.uid fail-closed', () => {
    expect(migration).toContain("'arteflow.inventory.manage'");
    expect(migration).toContain('(select auth.uid()) is null');
    expect(migration.match(/perform private\.arteflow_require_inventory\(p_organization_id,true\)/g)?.length).toBeGreaterThanOrEqual(8);
  });
  it('serializa reserva, consumo, ajuste e estorno com row locks', () => {
    expect(migration.match(/for update/g)?.length).toBeGreaterThanOrEqual(5);
    expect(migration).toContain("raise exception 'INSUFFICIENT_STOCK'");
  });
  it('oferece idempotência para operações reenviáveis', () => {
    expect(migration).toContain('unique (organization_id, idempotency_key)');
    expect(migration).toContain('p_idempotency_key');
  });
  it('implementa estorno por evento inverso sem apagar o original', () => {
    expect(migration).toContain('arteflow_reverse_inventory_movement');
    expect(migration).toContain('reversal_of_id');
    expect(migration).toContain("'MOVEMENT_ALREADY_REVERSED'");
  });
  it('integra requisito e consumo à OP com FKs tenant-aware e gate server-side', () => {
    expect(migration).toContain('arteflow_inventory_requirements_job_fk');
    expect(migration).toContain('arteflow_refresh_material_gate');
    expect(migration).toContain("'MATERIAL_GATE_CHANGED'");
  });
  it('usa Supabase somente no conectado e preserva repositórios locais no standalone', () => {
    expect(context).toContain('createSupabaseInventoryRepositories');
    expect(context).toContain('new SupabaseInventoryService');
    expect(context).toContain('new LocalStorageMaterialRepository()');
    expect(context).toContain('if (allowDemoData) return null');
    expect(service).toContain("this.supabase.rpc(name,args)");
  });
});
