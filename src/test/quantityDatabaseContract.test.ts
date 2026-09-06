import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const boundsMigration = readFileSync('supabase/migrations/20260906051500_enforce_strict_quantity_bounds.sql', 'utf8');
const procurementMigration = readFileSync('supabase/migrations/20260905003000_add_arteflow_multi_tenant_procurement.sql', 'utf8');

describe('E9-04 — Contrato PostgreSQL de Quantidades em Milésimos', () => {
  it('aplica constraints estritas [0, MAX_SAFE_INTEGER] em todas as colunas de quantidade do inventário', () => {
    expect(boundsMigration).toContain('arteflow_inventory_items_stock_on_hand_milli_check');
    expect(boundsMigration).toContain('check (stock_on_hand_milli >= 0 and stock_on_hand_milli <= 9007199254740991)');
    expect(boundsMigration).toContain('arteflow_inventory_items_minimum_stock_milli_check');
    expect(boundsMigration).toContain('check (minimum_stock_milli >= 0 and minimum_stock_milli <= 9007199254740991)');
    expect(boundsMigration).toContain('arteflow_inventory_requirements_required_quantity_milli_check');
    expect(boundsMigration).toContain('check (required_quantity_milli > 0 and required_quantity_milli <= 9007199254740991)');
    expect(boundsMigration).toContain('arteflow_inventory_reservations_reserved_quantity_milli_check');
    expect(boundsMigration).toContain('check (reserved_quantity_milli > 0 and reserved_quantity_milli <= 9007199254740991)');
    expect(boundsMigration).toContain('arteflow_inventory_movements_quantity_milli_check');
    expect(boundsMigration).toContain('check (quantity_milli > 0 and quantity_milli <= 9007199254740991)');
    expect(boundsMigration).toContain('arteflow_inventory_movements_previous_balance_milli_check');
    expect(boundsMigration).toContain('check (previous_balance_milli >= 0 and previous_balance_milli <= 9007199254740991)');
    expect(boundsMigration).toContain('arteflow_inventory_movements_resulting_balance_milli_check');
    expect(boundsMigration).toContain('check (resulting_balance_milli >= 0 and resulting_balance_milli <= 9007199254740991)');
  });

  it('audita e comprova proteção de limites de quantidade em Procurement', () => {
    expect(procurementMigration).toContain('requested_quantity_milli bigint not null check(requested_quantity_milli between 1 and 9007199254740991)');
    expect(procurementMigration).toContain('ordered_quantity_milli bigint not null check(ordered_quantity_milli between 1 and 9007199254740991)');
    expect(procurementMigration).toContain('received_quantity_milli bigint not null default 0 check(received_quantity_milli>=0 and received_quantity_milli<=ordered_quantity_milli)');
  });

  it('endurece as RPCs de compras e estoque contra overflow em quantidades', () => {
    expect(boundsMigration).toContain('function public.arteflow_add_inventory_requirement');
    expect(boundsMigration).toContain('p_quantity_milli>9007199254740991');

    expect(boundsMigration).toContain('function public.arteflow_reserve_inventory');
    expect(boundsMigration).toContain('p_quantity_milli>9007199254740991');

    expect(boundsMigration).toContain('function public.arteflow_create_purchase_request');
    expect(boundsMigration).toContain('v_qty>9007199254740991');
  });
});
