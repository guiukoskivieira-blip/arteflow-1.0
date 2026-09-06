import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { bootstrapArteFlowTenant } from '../services/tenantBootstrapService';

const migration = readFileSync('supabase/migrations/20260906033625_enforce_explicit_permission_deny_precedence.sql', 'utf8');
const permission = 'arteflow.inventory.manage';
type Scenario = { owner?: boolean; legacy?: boolean; role?: boolean; allow?: boolean; deny?: boolean; entitled?: boolean; access?: boolean; active?: boolean; locked?: boolean; orgActive?: boolean; crossTenant?: boolean };

// Exercise the real asynchronous frontend bootstrap, not a copy of its resolver.
function client(s: Scenario): SupabaseClient {
  const member = { id: 'membership', user_id: 'user', organization_id: 'org', role: s.owner ? 'owner' : 'member', is_active: s.active !== false, is_locked: s.locked === true };
  const rows: Record<string, unknown> = {
    organization_members: [member],
    organizations: { id: s.crossTenant ? 'other' : 'org', is_active: s.orgActive !== false, deleted_at: null, trade_name: 'E9 Test', document: null, created_at: '2026-01-01' },
    organization_member_product_access: { is_enabled: s.access !== false },
    profiles: { id: 'user', email: 'fixture@example.test', full_name: 'E9 Fixture' },
    prexyon_permission_definitions: [{ id: 'definition', permission_key: permission }],
    product_permissions: [{ permission_key: 'arteflow.view', is_granted: true }, ...(s.legacy ? [{ permission_key: permission, is_granted: true }] : [])],
    prexyon_user_product_roles: s.role ? [{ role_id: 'role' }] : [],
    prexyon_role_permissions: s.role ? [{ permission_definition_id: 'definition' }] : [],
    prexyon_user_permission_overrides: s.deny ? [{ permission_definition_id: 'definition', effect: 'deny' }] : s.allow ? [{ permission_definition_id: 'definition', effect: 'allow' }] : [],
  };
  return {
    from(table: string) {
      const query = {
        select: () => query, eq: () => query, in: () => query,
        single: () => query, maybeSingle: () => query,
        then: (resolve: (v: unknown) => unknown) => Promise.resolve({ data: rows[table], error: null }).then(resolve),
      };
      return query;
    },
    rpc: async () => ({ data: { is_entitled: s.entitled !== false, effective_products: ['arteflow'] }, error: null }),
  } as unknown as SupabaseClient;
}

describe('E9-01 explicit permission deny', () => {
  it('changes only the existing helper without changing EXECUTE or access prerequisites', () => {
    const sql = migration.replace(/--[^\n]*/g, '');
    expect(sql.match(/create or replace function/gi)).toHaveLength(1);
    expect(sql).toContain('private.arteflow_has_permission(');
    expect(sql).toContain('private.arteflow_can_access_product(p_organization_id)');
    expect(sql).toContain("set search_path = ''");
    expect(sql).toContain('security definer');
    expect(sql).not.toMatch(/\b(grant|revoke|drop|alter|insert|update|delete)\b/i);
    // Lock down the changed parenthesization, not only presence of a deny clause.
    expect(sql).toMatch(/om\.role = 'owner'::public\.user_role\s+or \(\s+not exists/);
    expect(sql).toMatch(/denial_definition\.permission_key = p_permission_key\s+\)\s+and \(\s+exists \(\s+select 1\s+from public\.product_permissions/);
  });

  it.each<[string, Scenario, boolean]>([
    ['MEMBER legacy + deny', { legacy: true, deny: true }, false],
    ['MEMBER role + deny', { role: true, deny: true }, false],
    ['MEMBER legacy without deny', { legacy: true }, true],
    ['MEMBER role without deny', { role: true }, true],
    ['MEMBER explicit allow', { allow: true }, true],
    ['MEMBER no grant', {}, false],
    ['OWNER granular bypass', { owner: true, deny: true }, true],
  ])('%s', async (_name, scenario, expected) => {
    const result = await bootstrapArteFlowTenant(client(scenario), { id: 'user' } as User, 'org');
    expect(result.permissions.has(permission)).toBe(expected);
  });

  it.each<[string, Scenario]>([
    ['OWNER no entitlement', { owner: true, entitled: false }],
    ['OWNER no product access', { owner: true, access: false }],
    ['OWNER inactive membership', { owner: true, active: false }],
    ['OWNER locked membership', { owner: true, locked: true }],
    ['OWNER inactive organization', { owner: true, orgActive: false }],
    ['cross tenant', { owner: true, crossTenant: true }],
  ])('%s remains denied by frontend', async (_name, scenario) => {
    await expect(bootstrapArteFlowTenant(client(scenario), { id: 'user' } as User, 'org')).rejects.toThrow();
  });
});
