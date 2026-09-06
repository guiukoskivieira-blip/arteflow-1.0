import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const boundsMigration = readFileSync('supabase/migrations/20260906045500_enforce_safe_monetary_bounds.sql', 'utf8');
const ordersMigration = readFileSync('supabase/migrations/20260903140942_add_arteflow_multi_tenant_orders.sql', 'utf8');
const procurementMigration = readFileSync('supabase/migrations/20260905003000_add_arteflow_multi_tenant_procurement.sql', 'utf8');
const financialMigration = readFileSync('supabase/migrations/20260905090000_add_arteflow_multi_tenant_financial.sql', 'utf8');

describe('E9-03 — Contrato Monetário PostgreSQL / RPCs', () => {
  it('aplica constraints estritas de limites monetários [0, MAX_SAFE_INTEGER] nas tabelas de estoque', () => {
    expect(boundsMigration).toContain('arteflow_inventory_items_average_cost_cents_check');
    expect(boundsMigration).toContain('check (average_cost_cents >= 0 and average_cost_cents <= 9007199254740991)');
    expect(boundsMigration).toContain('arteflow_inventory_requirements_material_average_cost_cents_check');
    expect(boundsMigration).toContain('check (material_average_cost_cents >= 0 and material_average_cost_cents <= 9007199254740991)');
    expect(boundsMigration).toContain('arteflow_inventory_movements_unit_cost_cents_check');
    expect(boundsMigration).toContain('check (unit_cost_cents is null or (unit_cost_cents >= 0 and unit_cost_cents <= 9007199254740991))');
    expect(boundsMigration).toContain('arteflow_inventory_movements_total_cost_cents_check');
    expect(boundsMigration).toContain('check (total_cost_cents is null or (total_cost_cents >= 0 and total_cost_cents <= 9007199254740991))');
  });

  it('audita e comprova proteção de limites monetários em Orders, Procurement e Financial', () => {
    // Orders
    expect(ordersMigration).toContain('total_amount_cents bigint not null check (total_amount_cents >= 0 and total_amount_cents <= 9007199254740991)');
    expect(ordersMigration).toContain('unit_price_cents bigint not null check (unit_price_cents >= 0 and unit_price_cents <= 9007199254740991)');
    expect(ordersMigration).toContain('total_price_cents bigint not null check (total_price_cents >= 0 and total_price_cents <= 9007199254740991)');

    // Procurement
    expect(procurementMigration).toContain('material_average_cost_cents bigint not null check(material_average_cost_cents between 0 and 9007199254740991)');
    expect(procurementMigration).toContain('freight_cents bigint not null default 0 check(freight_cents between 0 and 9007199254740991)');
    expect(procurementMigration).toContain('discount_cents bigint not null default 0 check(discount_cents between 0 and 9007199254740991)');
    expect(procurementMigration).toContain('subtotal_cents bigint not null check(subtotal_cents between 0 and 9007199254740991)');
    expect(procurementMigration).toContain('total_cents bigint not null check(total_cents between 0 and 9007199254740991)');
    expect(procurementMigration).toContain('unit_cost_cents bigint not null check(unit_cost_cents between 0 and 9007199254740991)');
    expect(procurementMigration).toContain('total_cost_cents bigint not null check(total_cost_cents between 0 and 9007199254740991)');

    // Financial
    expect(financialMigration).toContain('amount_cents bigint not null check(amount_cents between 1 and 9007199254740991)');
    expect(financialMigration).toContain('paid_amount_cents bigint not null default 0 check(paid_amount_cents>=0 and paid_amount_cents<=amount_cents)');
  });

  it('endurece as RPCs de estoque e compras contra overflow em inputs e cálculos', () => {
    expect(boundsMigration).toContain('function public.arteflow_create_inventory_item');
    expect(boundsMigration).toContain('p_unit_cost_cents>9007199254740991');
    expect(boundsMigration).toContain('UNSAFE_MONETARY_VALUE');

    expect(boundsMigration).toContain('function public.arteflow_record_inventory_movement');
    expect(boundsMigration).toContain('p_unit_cost_cents>9007199254740991');
    expect(boundsMigration).toContain('p_total_cost_cents>9007199254740991');
    expect(boundsMigration).toContain('calc_cost>9007199254740991');

    expect(boundsMigration).toContain('function public.arteflow_receive_purchase_order');
    expect(boundsMigration).toContain('unit_cost>9007199254740991');
    expect(boundsMigration).toContain('line_total>9007199254740991');

    expect(boundsMigration).toContain('function public.arteflow_create_purchase_order');
    expect(boundsMigration).toContain('v_freight>9007199254740991');
    expect(boundsMigration).toContain('v_subtotal+v_line>9007199254740991');
  });

  it('endurece as RPCs financeiras contra inputs monetários acima do limite seguro', () => {
    expect(boundsMigration).toContain('function public.arteflow_create_receivable');
    expect(boundsMigration).toContain('p_amount_cents>9007199254740991');
    expect(boundsMigration).toContain('function public.arteflow_create_payable');
    expect(boundsMigration).toContain('function public.arteflow_settle_receivable');
    expect(boundsMigration).toContain('function public.arteflow_settle_payable');
  });
});
