import type { Session, User as SupabaseUser } from '@supabase/supabase-js';
import type { Organization, User } from '../types/domain';
import type { ArteFlowPermission } from './permissions';

export type AccessStatus = 'LOADING' | 'AUTHORIZED' | 'UNAUTHORIZED' | 'ERROR';
export type ArteFlowRuntimeMode = 'connected' | 'standalone';

export interface PrexyonMembership {
  id: string;
  organizationId: string;
  userId: string;
  role: string;
  isActive: boolean;
  isLocked: boolean;
}

export interface TenantBootstrapData {
  identity: User;
  organization: Organization;
  membership: PrexyonMembership;
  permissions: ReadonlySet<ArteFlowPermission>;
  productAccess: true;
  entitlement: true;
}

export interface AccessState {
  status: AccessStatus;
  mode: ArteFlowRuntimeMode;
  session: Session | null;
  authUser: SupabaseUser | null;
  tenant: TenantBootstrapData | null;
  reason: string | null;
}

export interface SsoExchangeResult {
  userId: string;
  organizationId: string;
  productCode: string;
  session: Session;
}
