import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { ARTEFLOW_PERMISSIONS, type ArteFlowPermission } from '../auth/permissions';
import type { AccessState } from '../auth/types';
import { getArteFlowRuntimeConfig } from '../config/runtime';
import { DEMO_USERS } from '../domain/constants';
import { DEMO_ORGANIZATION } from '../domain/seed';
import { exchangePrexyonCode, readPrexyonCode } from '../services/prexyonSsoService';
import { getSupabaseClient } from '../services/supabaseClient';
import { bootstrapArteFlowTenant, TenantBootstrapError } from '../services/tenantBootstrapService';

interface AuthContextValue extends AccessState {
  can: (permission: ArteFlowPermission) => boolean;
  signOut: () => Promise<void>;
  returnToPrexyon: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const INITIAL_STATE: AccessState = {
  status: 'LOADING',
  mode: 'connected',
  session: null,
  authUser: null,
  tenant: null,
  reason: null,
};

function safeReason(error: unknown): string {
  if (error instanceof TenantBootstrapError) {
    if (error.code === 'NO_MEMBERSHIP') return 'NOT_MEMBER';
    if (error.code === 'NO_ENTITLEMENT') return 'PRODUCT_NOT_ENTITLED';
    if (error.code === 'NO_PRODUCT_ACCESS') return 'PRODUCT_ACCESS_DISABLED';
    return error.code;
  }
  if (error instanceof Error) return error.message;
  return 'ACCESS_BOOTSTRAP_FAILED';
}

function isAuthorizationFailure(reason: string): boolean {
  return [
    'INVALID_CODE',
    'CODE_EXPIRED',
    'REPLAY_BLOCKED',
    'INVALID_AUDIENCE',
    'INVALID_SSO_RESPONSE',
    'AUTH_FAILED',
    'IDENTITY_MISMATCH',
    'NOT_MEMBER',
    'MEMBERSHIP_INACTIVE',
    'AMBIGUOUS_ORGANIZATION',
    'CROSS_TENANT',
    'ORGANIZATION_INACTIVE',
    'PRODUCT_NOT_ENTITLED',
    'PRODUCT_ACCESS_DISABLED',
    'NO_ARTEFLOW_VIEW',
  ].some(code => reason.includes(code));
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const config = useMemo(() => getArteFlowRuntimeConfig(), []);
  const [state, setState] = useState<AccessState>({ ...INITIAL_STATE, mode: config.mode });
  const generation = useRef(0);

  const deny = useCallback((reason: string) => {
    setState({
      status: isAuthorizationFailure(reason) ? 'UNAUTHORIZED' : 'ERROR',
      mode: config.mode,
      session: null,
      authUser: null,
      tenant: null,
      reason,
    });
  }, [config.mode]);

  const authorizeSession = useCallback(async (session: Session, expectedOrganizationId?: string) => {
    const requestGeneration = ++generation.current;
    const supabase = getSupabaseClient();
    if (!supabase) {
      deny('SUPABASE_UNAVAILABLE');
      return;
    }
    setState(previous => ({ ...previous, status: 'LOADING', reason: null }));
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user || data.user.id !== session.user.id) throw new Error('INVALID_AUTH_SESSION');
      const tenant = await bootstrapArteFlowTenant(supabase, data.user, expectedOrganizationId);
      if (requestGeneration !== generation.current) return;
      setState({
        status: 'AUTHORIZED',
        mode: 'connected',
        session,
        authUser: data.user,
        tenant,
        reason: null,
      });
    } catch (error) {
      if (requestGeneration !== generation.current) return;
      await supabase.auth.signOut();
      deny(safeReason(error));
    }
  }, [deny]);

  useEffect(() => {
    if (config.mode === 'standalone') {
      setState({
        status: 'AUTHORIZED',
        mode: 'standalone',
        session: null,
        authUser: null,
        tenant: {
          identity: DEMO_USERS[0],
          organization: DEMO_ORGANIZATION,
          membership: {
            id: 'standalone-development',
            organizationId: DEMO_ORGANIZATION.id,
            userId: DEMO_USERS[0].id,
            role: 'development',
            isActive: true,
            isLocked: false,
          },
          permissions: new Set(ARTEFLOW_PERMISSIONS),
          productAccess: true,
          entitlement: true,
        },
        reason: null,
      });
      return;
    }

    if (!config.isSupabaseConfigured) {
      deny('SUPABASE_UNAVAILABLE');
      return;
    }

    const supabase = getSupabaseClient();
    if (!supabase) {
      deny('SUPABASE_UNAVAILABLE');
      return;
    }

    let active = true;
    const bootstrap = async () => {
      try {
        const isCallback = window.location.pathname === '/auth/prexyon';
        if (isCallback) {
          const callbackSearch = window.location.search;
          const currentCallback = `${window.location.origin}${window.location.pathname}`.replace(/\/$/, '');
          window.history.replaceState({}, document.title, '/');
          if (!config.callbackUrl) throw new Error('CALLBACK_URL_NOT_CONFIGURED');
          if (currentCallback !== config.callbackUrl) throw new Error('INVALID_CALLBACK_URL');
          const code = readPrexyonCode(callbackSearch);
          const exchange = await exchangePrexyonCode(supabase, code);
          if (active) await authorizeSession(exchange.session, exchange.organizationId);
          return;
        }

        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (!data.session) {
          deny('AUTHENTICATION_REQUIRED');
          return;
        }
        if (active) await authorizeSession(data.session);
      } catch (error) {
        if (active) deny(safeReason(error));
      }
    };
    void bootstrap();

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === 'SIGNED_OUT' || !session) {
        generation.current += 1;
        deny('AUTHENTICATION_REQUIRED');
      }
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [authorizeSession, config.callbackUrl, config.isSupabaseConfigured, config.mode, deny]);

  const signOut = useCallback(async () => {
    generation.current += 1;
    setState({ ...INITIAL_STATE, mode: config.mode, status: 'UNAUTHORIZED', reason: 'SIGNED_OUT' });
    const supabase = getSupabaseClient();
    if (supabase) await supabase.auth.signOut();
  }, [config.mode]);

  const returnToPrexyon = useCallback(() => {
    if (config.prexyonPortalUrl) window.location.assign(config.prexyonPortalUrl);
  }, [config.prexyonPortalUrl]);

  const can = useCallback(
    (permission: ArteFlowPermission) => state.status === 'AUTHORIZED' && Boolean(state.tenant?.permissions.has(permission)),
    [state.status, state.tenant]
  );

  const value = useMemo<AuthContextValue>(() => ({ ...state, can, signOut, returnToPrexyon }), [state, can, signOut, returnToPrexyon]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return value;
}

export function useOptionalAuth(): AuthContextValue | null {
  return useContext(AuthContext);
}
