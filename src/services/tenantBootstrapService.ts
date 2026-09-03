import type { SupabaseClient, User as SupabaseUser } from '@supabase/supabase-js';
import { resolveArteFlowPermissions } from '../auth/permissions';
import type { TenantBootstrapData } from '../auth/types';

interface MembershipRow {
  id: string;
  organization_id: string;
  user_id: string;
  role: string;
  is_active: boolean;
  is_locked: boolean;
}

interface OrganizationRow {
  id: string;
  trade_name: string;
  document: string | null;
  is_active: boolean;
  deleted_at: string | null;
  created_at: string;
}

interface ProfileRow {
  id: string;
  email: string;
  full_name: string;
}

export interface BootstrapAuthoritySnapshot {
  authUser: SupabaseUser;
  memberships: MembershipRow[];
  organization: OrganizationRow | null;
  profile: ProfileRow | null;
  entitled: boolean;
  productAccess: boolean | null;
  grants: readonly string[];
}

interface PermissionDefinitionRow {
  id: string;
  permission_key: string;
}

interface ProductPermissionRow {
  permission_key: string;
  is_granted: boolean;
}

export class TenantBootstrapError extends Error {
  constructor(
    public readonly code:
      | 'NO_MEMBERSHIP'
      | 'MEMBERSHIP_INACTIVE'
      | 'AMBIGUOUS_ORGANIZATION'
      | 'CROSS_TENANT'
      | 'ORGANIZATION_INACTIVE'
      | 'NO_ENTITLEMENT'
      | 'NO_PRODUCT_ACCESS'
      | 'NO_ARTEFLOW_VIEW'
      | 'BOOTSTRAP_FAILED'
  ) {
    super(code);
  }
}

function isEntitled(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const data = value as Record<string, unknown>;
  return data.is_entitled === true &&
    Array.isArray(data.effective_products) &&
    data.effective_products.includes('arteflow');
}

export function evaluateTenantBootstrap(
  snapshot: BootstrapAuthoritySnapshot,
  expectedOrganizationId?: string
): TenantBootstrapData {
  const candidates = expectedOrganizationId
    ? snapshot.memberships.filter(row => row.organization_id === expectedOrganizationId)
    : snapshot.memberships;
  if (candidates.length === 0) throw new TenantBootstrapError('NO_MEMBERSHIP');
  const active = candidates.filter(row => row.is_active && !row.is_locked);
  if (active.length === 0) throw new TenantBootstrapError('MEMBERSHIP_INACTIVE');
  if (!expectedOrganizationId && active.length !== 1) throw new TenantBootstrapError('AMBIGUOUS_ORGANIZATION');

  const member = active[0];
  if (member.user_id !== snapshot.authUser.id) throw new TenantBootstrapError('CROSS_TENANT');
  if (expectedOrganizationId && member.organization_id !== expectedOrganizationId) {
    throw new TenantBootstrapError('CROSS_TENANT');
  }
  const organization = snapshot.organization;
  if (!organization || organization.id !== member.organization_id) throw new TenantBootstrapError('CROSS_TENANT');
  if (!organization.is_active || organization.deleted_at) throw new TenantBootstrapError('ORGANIZATION_INACTIVE');
  if (!snapshot.entitled) throw new TenantBootstrapError('NO_ENTITLEMENT');
  if (snapshot.productAccess !== true) {
    throw new TenantBootstrapError('NO_PRODUCT_ACCESS');
  }
  if (!snapshot.profile || snapshot.profile.id !== snapshot.authUser.id) {
    throw new TenantBootstrapError('CROSS_TENANT');
  }

  const permissions = resolveArteFlowPermissions({ organizationRole: member.role, grants: snapshot.grants });
  if (!permissions.has('arteflow.view')) throw new TenantBootstrapError('NO_ARTEFLOW_VIEW');

  return {
    identity: {
      id: snapshot.authUser.id,
      name: snapshot.profile.full_name,
      email: snapshot.profile.email || snapshot.authUser.email || '',
      role: 'OPERADOR',
      organizationId: organization.id,
    },
    organization: {
      id: organization.id,
      name: organization.trade_name,
      document: organization.document ?? undefined,
      segment: 'GERAL',
      createdAt: organization.created_at,
    },
    membership: {
      id: member.id,
      organizationId: member.organization_id,
      userId: member.user_id,
      role: member.role,
      isActive: member.is_active,
      isLocked: member.is_locked,
    },
    permissions,
    productAccess: true,
    entitlement: true,
  };
}

async function requireData<T>(promise: PromiseLike<{ data: T | null; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await promise;
  if (error || data === null) throw new TenantBootstrapError('BOOTSTRAP_FAILED');
  return data;
}

export async function bootstrapArteFlowTenant(
  supabase: SupabaseClient,
  authUser: SupabaseUser,
  expectedOrganizationId?: string
): Promise<TenantBootstrapData> {
  let membershipQuery = supabase
    .from('organization_members')
    .select('id,organization_id,user_id,role,is_active,is_locked')
    .eq('user_id', authUser.id);
  if (expectedOrganizationId) membershipQuery = membershipQuery.eq('organization_id', expectedOrganizationId);

  const memberships = await requireData<MembershipRow[]>(membershipQuery);
  if (memberships.length === 0) throw new TenantBootstrapError('NO_MEMBERSHIP');
  const active = memberships.filter(row => row.is_active && !row.is_locked);
  if (active.length === 0) throw new TenantBootstrapError('MEMBERSHIP_INACTIVE');
  if (!expectedOrganizationId && active.length !== 1) throw new TenantBootstrapError('AMBIGUOUS_ORGANIZATION');

  const member = active[0];
  if (member.user_id !== authUser.id) throw new TenantBootstrapError('CROSS_TENANT');
  if (expectedOrganizationId && member.organization_id !== expectedOrganizationId) {
    throw new TenantBootstrapError('CROSS_TENANT');
  }

  const organization = await requireData<OrganizationRow>(
    supabase
      .from('organizations')
      .select('id,trade_name,document,is_active,deleted_at,created_at')
      .eq('id', member.organization_id)
      .single()
  );
  if (!organization.is_active || organization.deleted_at) {
    throw new TenantBootstrapError('ORGANIZATION_INACTIVE');
  }

  const { data: entitlement, error: entitlementError } = await supabase.rpc(
    'prexyon_get_organization_entitlements',
    { p_org_id: organization.id }
  );
  if (entitlementError || !isEntitled(entitlement)) throw new TenantBootstrapError('NO_ENTITLEMENT');

  const { data: productAccess, error: productAccessError } = await supabase
    .from('organization_member_product_access')
    .select('is_enabled')
    .eq('organization_id', organization.id)
    .eq('user_id', authUser.id)
    .eq('product_key', 'arteflow')
    .maybeSingle();
  if (productAccessError) throw new TenantBootstrapError('BOOTSTRAP_FAILED');
  const hasProductAccess = productAccess?.is_enabled === true;
  if (!hasProductAccess) throw new TenantBootstrapError('NO_PRODUCT_ACCESS');

  const profile = await requireData<ProfileRow>(
    supabase.from('profiles').select('id,email,full_name').eq('id', authUser.id).single()
  );
  if (profile.id !== authUser.id) throw new TenantBootstrapError('CROSS_TENANT');

  const definitions = await requireData<PermissionDefinitionRow[]>(
    supabase.from('prexyon_permission_definitions').select('id,permission_key').eq('product_code', 'arteflow')
  );
  const definitionById = new Map(definitions.map(item => [item.id, item.permission_key]));
  const grants = new Set<string>();

  const { data: productPermissions, error: productPermissionError } = await supabase
    .from('product_permissions')
    .select('permission_key,is_granted')
    .eq('organization_id', organization.id)
    .eq('user_id', authUser.id)
    .eq('product_key', 'arteflow');
  if (productPermissionError) throw new TenantBootstrapError('BOOTSTRAP_FAILED');
  for (const permission of (productPermissions ?? []) as ProductPermissionRow[]) {
    if (permission.is_granted) grants.add(permission.permission_key);
    else grants.delete(permission.permission_key);
  }

  const { data: assignments, error: assignmentError } = await supabase
    .from('prexyon_user_product_roles')
    .select('role_id')
    .eq('organization_id', organization.id)
    .eq('user_id', authUser.id)
    .eq('product_code', 'arteflow');
  if (assignmentError) throw new TenantBootstrapError('BOOTSTRAP_FAILED');

  const roleIds = (assignments ?? []).map(row => row.role_id as string);
  if (roleIds.length > 0) {
    const { data: rolePermissions, error } = await supabase
      .from('prexyon_role_permissions')
      .select('permission_definition_id')
      .in('role_id', roleIds);
    if (error) throw new TenantBootstrapError('BOOTSTRAP_FAILED');
    for (const row of rolePermissions ?? []) {
      const key = definitionById.get(row.permission_definition_id as string);
      if (key) grants.add(key);
    }
  }

  const { data: overrides, error: overrideError } = await supabase
    .from('prexyon_user_permission_overrides')
    .select('permission_definition_id,effect')
    .eq('organization_id', organization.id)
    .eq('user_id', authUser.id);
  if (overrideError) throw new TenantBootstrapError('BOOTSTRAP_FAILED');
  for (const row of overrides ?? []) {
    const key = definitionById.get(row.permission_definition_id as string);
    if (!key) continue;
    if (row.effect === 'allow') grants.add(key);
    else grants.delete(key);
  }

  const permissions = resolveArteFlowPermissions({
    organizationRole: member.role,
    grants: [...grants],
  });
  if (!permissions.has('arteflow.view')) throw new TenantBootstrapError('NO_ARTEFLOW_VIEW');

  return evaluateTenantBootstrap({
    authUser,
    memberships: [member],
    organization,
    profile,
    entitled: true,
    productAccess: hasProductAccess,
    grants: [...permissions],
  }, expectedOrganizationId);
}
