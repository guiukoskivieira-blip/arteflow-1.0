export const ARTEFLOW_PERMISSIONS = [
  'arteflow.view',
  'arteflow.orders.view',
  'arteflow.orders.create',
  'arteflow.orders.edit',
  'arteflow.production.view',
  'arteflow.production.manage',
  'arteflow.inventory.view',
  'arteflow.inventory.manage',
  'arteflow.procurement.view',
  'arteflow.procurement.manage',
  'arteflow.finance.view',
  'arteflow.finance.manage',
  'arteflow.settings.manage',
  'arteflow.users.manage',
] as const;

export type ArteFlowPermission = (typeof ARTEFLOW_PERMISSIONS)[number];

const KNOWN_PERMISSIONS = new Set<string>(ARTEFLOW_PERMISSIONS);

export interface PermissionAccess {
  organizationRole: string;
  grants: readonly string[];
}

export function isArteFlowPermission(value: string): value is ArteFlowPermission {
  return KNOWN_PERMISSIONS.has(value);
}

export function resolveArteFlowPermissions(access: PermissionAccess): ReadonlySet<ArteFlowPermission> {
  if (access.organizationRole === 'owner') {
    return new Set(ARTEFLOW_PERMISSIONS);
  }

  const normalized = access.grants.flatMap(grant => {
    if (isArteFlowPermission(grant)) return [grant];
    if (grant === 'arteflow.production.move_stages' || grant === 'arteflow.production.reassign') {
      return ['arteflow.production.manage' as const];
    }
    return [];
  });
  return new Set(normalized);
}

export function hasArteFlowPermission(
  permissions: ReadonlySet<ArteFlowPermission>,
  permission: ArteFlowPermission
): boolean {
  return permissions.has(permission);
}
