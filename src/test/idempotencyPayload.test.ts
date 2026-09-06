import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migrationPath = 'supabase/migrations/20260906042913_validate_idempotency_request_payload.sql';
const migration = readFileSync(migrationPath, 'utf8');

describe('E9-02 canonical idempotency contract', () => {
  it('stores tenant-scoped operation, canonical payload, and prior result privately', () => {
    expect(migration).toContain('create table private.arteflow_idempotency_requests');
    expect(migration).toContain('primary key (organization_id, idempotency_key)');
    expect(migration).toContain('operation text not null');
    expect(migration).toContain('canonical_payload jsonb not null');
    expect(migration).toContain('result_id uuid not null');
    expect(migration).toContain('enable row level security');
    expect(migration).toContain('revoke all on table private.arteflow_idempotency_requests from public, anon, authenticated');
  });

  it('serializes concurrent requests before deciding replay or conflict', () => {
    expect(migration).toContain('pg_catalog.pg_advisory_xact_lock');
    expect(migration).toContain("p_organization_id::text || ':' || p_idempotency_key");
    expect(migration).toContain("raise exception 'IDEMPOTENCY_CONFLICT'");
    expect(migration).toContain("using errcode = 'P0001'");
    expect(migration).toMatch(/existing\.operation is distinct from p_operation\s+or existing\.canonical_payload is distinct from p_canonical_payload/);
  });

  it.each([
    ['arteflow_settle_receivable', 'finance.settle_receivable'],
    ['arteflow_settle_payable', 'finance.settle_payable'],
    ['arteflow_record_inventory_movement', 'inventory.record_movement'],
    ['arteflow_consume_inventory', 'inventory.consume'],
    ['arteflow_reverse_inventory_movement', 'inventory.reverse'],
    ['arteflow_receive_purchase_order', 'procurement.receive_purchase_order'],
  ])('%s binds the key to %s', (rpc, operation) => {
    expect(migration).toContain(`function public.${rpc}`);
    expect(migration).toContain(`'${operation}'`);
  });

  it('canonically compares finance operation, target, amount, date, method, and notes', () => {
    for (const field of ['targetId', 'amountCents', 'settledAt', 'method', 'notes']) {
      expect(migration).toContain(`'${field}'`);
    }
  });

  it('canonically compares inventory target, type, quantity, reason, and costs', () => {
    for (const field of ['itemId', 'type', 'quantityMilli', 'reason', 'unitCostCents', 'totalCostCents']) {
      expect(migration).toContain(`'${field}'`);
    }
  });

  it('canonically sorts purchase receipt items and compares resolved costs', () => {
    expect(migration).toContain("'purchaseOrderItemId'");
    expect(migration).toContain("'quantityMilli'");
    expect(migration).toContain("'unitCostCents'");
    expect(migration).toContain('order by (entry->>\'purchaseOrderItemId\')::uuid');
    expect(migration).toContain('canonical_order_item.unit_cost_cents');
    expect(migration).toContain("'invoiceNumber'");
  });

  it('preserves public RPC signatures and security posture without widening grants', () => {
    expect(migration.match(/security definer set search_path=''/g)).toHaveLength(6);
    expect(migration).not.toMatch(/grant\s+execute/i);
    expect(migration).not.toMatch(/alter\s+table\s+public\./i);
  });

  it('records completion only after each business mutation succeeds', () => {
    expect(migration.match(/perform private\.arteflow_idempotency_complete/g)).toHaveLength(6);
    expect(migration.match(/private\.arteflow_idempotency_replay/g)).toHaveLength(8);
  });
});
