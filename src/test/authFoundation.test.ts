import { describe, expect, it, vi } from 'vitest';
import type { Session, SupabaseClient, User as SupabaseUser } from '@supabase/supabase-js';
import { getArteFlowRuntimeConfig } from '../config/runtime';
import {
  hasArteFlowPermission,
  resolveArteFlowPermissions,
} from '../auth/permissions';
import {
  evaluateTenantBootstrap,
  TenantBootstrapError,
  type BootstrapAuthoritySnapshot,
} from '../services/tenantBootstrapService';
import { exchangePrexyonCode, readPrexyonCode } from '../services/prexyonSsoService';

const authUser = { id: 'user-1', email: 'member@example.test' } as SupabaseUser;

function snapshot(overrides: Partial<BootstrapAuthoritySnapshot> = {}): BootstrapAuthoritySnapshot {
  return {
    authUser,
    memberships: [{
      id: 'membership-1',
      organization_id: 'org-1',
      user_id: 'user-1',
      role: 'member',
      is_active: true,
      is_locked: false,
    }],
    organization: {
      id: 'org-1',
      trade_name: 'Gráfica Teste',
      document: null,
      is_active: true,
      deleted_at: null,
      created_at: '2026-01-01T00:00:00.000Z',
    },
    profile: { id: 'user-1', email: 'member@example.test', full_name: 'Pessoa Teste' },
    entitled: true,
    productAccess: true,
    grants: ['arteflow.view', 'arteflow.production.view'],
    ...overrides,
  };
}

function expectBootstrapCode(input: BootstrapAuthoritySnapshot, code: TenantBootstrapError['code']): void {
  expect(() => evaluateTenantBootstrap(input, 'org-1')).toThrowError(
    expect.objectContaining({ code })
  );
}

const session = {
  access_token: 'public-test-token',
  refresh_token: 'public-test-refresh',
  expires_in: 3600,
  token_type: 'bearer',
  user: authUser,
} as Session;

function ssoClient(options: {
  data?: Record<string, unknown>;
  error?: Error;
  verifiedSession?: Session | null;
  verifiedUser?: SupabaseUser | null;
  verifyError?: Error;
  authoritativeUser?: SupabaseUser | null;
  getUserError?: Error;
}): SupabaseClient {
  return {
    functions: {
      invoke: vi.fn().mockResolvedValue({ data: options.data ?? null, error: options.error ?? null }),
    },
    auth: {
      verifyOtp: vi.fn().mockResolvedValue({
        data: {
          session: options.verifiedSession === undefined ? session : options.verifiedSession,
          user: options.verifiedUser === undefined ? authUser : options.verifiedUser,
        },
        error: options.verifyError ?? null,
      }),
      getUser: vi.fn().mockResolvedValue({
        data: { user: options.authoritativeUser === undefined ? authUser : options.authoritativeUser },
        error: options.getUserError ?? null,
      }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
  } as unknown as SupabaseClient;
}

function validExchange(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    success: true,
    token_hash: 'hashed-auth-token',
    verification_type: 'magiclink',
    user_id: 'user-1',
    organization_id: 'org-1',
    product_code: 'arteflow',
    ...overrides,
  };
}

describe('fundação Prexyon fail-closed', () => {
  it('1. bootstrap OWNER autenticado recebe bypass legítimo', () => {
    const result = evaluateTenantBootstrap(snapshot({
      memberships: [{ ...snapshot().memberships[0], role: 'owner' }],
      productAccess: true,
      grants: [],
    }), 'org-1');
    expect(result.permissions.has('arteflow.settings.manage')).toBe(true);
  });

  it('2. bootstrap MEMBER autenticado usa apenas grants conhecidos', () => {
    const result = evaluateTenantBootstrap(snapshot(), 'org-1');
    expect([...result.permissions]).toEqual(['arteflow.view', 'arteflow.production.view']);
  });

  it('3. ausência de membership nega', () => {
    expectBootstrapCode(snapshot({ memberships: [] }), 'NO_MEMBERSHIP');
  });

  it('4. membership inativa nega', () => {
    expectBootstrapCode(snapshot({ memberships: [{ ...snapshot().memberships[0], is_active: false }] }), 'MEMBERSHIP_INACTIVE');
  });

  it('5. organização inativa nega', () => {
    expectBootstrapCode(snapshot({ organization: { ...snapshot().organization!, is_active: false } }), 'ORGANIZATION_INACTIVE');
  });

  it('6. ausência de entitlement ArteFlow nega', () => {
    expectBootstrapCode(snapshot({ entitled: false }), 'NO_ENTITLEMENT');
  });

  it('7. ausência de product access nega MEMBER', () => {
    expectBootstrapCode(snapshot({ productAccess: false }), 'NO_PRODUCT_ACCESS');
  });

  it('8. código vazio é inválido', async () => {
    await expect(exchangePrexyonCode(ssoClient({}), ' ')).rejects.toThrow('INVALID_CODE');
  });

  it('9. código expirado permanece negado', async () => {
    await expect(exchangePrexyonCode(ssoClient({ error: new Error('CODE_EXPIRED') }), 'code')).rejects.toThrow('CODE_EXPIRED');
  });

  it('10. replay permanece negado', async () => {
    await expect(exchangePrexyonCode(ssoClient({ error: new Error('REPLAY_BLOCKED') }), 'code')).rejects.toThrow('REPLAY_BLOCKED');
  });

  it('11. audience incorreta é negada', async () => {
    await expect(exchangePrexyonCode(ssoClient({ data: validExchange({ product_code: 'orcagraf' }) }), 'code'))
      .rejects.toThrow('INVALID_SSO_RESPONSE');
  });

  it('12. Supabase ausente em produção mantém modo connected', () => {
    const config = getArteFlowRuntimeConfig({ PROD: true, DEV: false, VITE_ARTEFLOW_MODE: 'standalone' });
    expect(config).toMatchObject({ mode: 'connected', isSupabaseConfigured: false });
  });

  it('13. permission desconhecida é negada pelo adapter', () => {
    const permissions = resolveArteFlowPermissions({ organizationRole: 'member', grants: ['arteflow.root'] });
    expect(permissions.size).toBe(0);
  });

  it('14. sem arteflow.view bootstrap nega', () => {
    expectBootstrapCode(snapshot({ grants: ['arteflow.production.view'] }), 'NO_ARTEFLOW_VIEW');
  });

  it('15. production.view permite visualização', () => {
    const result = evaluateTenantBootstrap(snapshot(), 'org-1');
    expect(hasArteFlowPermission(result.permissions, 'arteflow.production.view')).toBe(true);
  });

  it('16. production.manage nega sem grant', () => {
    const result = evaluateTenantBootstrap(snapshot(), 'org-1');
    expect(hasArteFlowPermission(result.permissions, 'arteflow.production.manage')).toBe(false);
  });

  it('17. inventory.manage nega sem grant', () => {
    expect(resolveArteFlowPermissions({ organizationRole: 'member', grants: ['arteflow.view'] }).has('arteflow.inventory.manage')).toBe(false);
  });

  it('18. procurement.manage nega sem grant', () => {
    expect(resolveArteFlowPermissions({ organizationRole: 'member', grants: ['arteflow.view'] }).has('arteflow.procurement.manage')).toBe(false);
  });

  it('19. finance.manage nega sem grant', () => {
    expect(resolveArteFlowPermissions({ organizationRole: 'member', grants: ['arteflow.view'] }).has('arteflow.finance.manage')).toBe(false);
  });

  it('20. owner bypass não é concedido para admin ou função operacional', () => {
    expect(resolveArteFlowPermissions({ organizationRole: 'admin', grants: [] }).size).toBe(0);
    expect(resolveArteFlowPermissions({ organizationRole: 'PRODUCAO', grants: [] }).size).toBe(0);
  });

  it('21. bootstrap cross-tenant nega', () => {
    expectBootstrapCode(snapshot({ organization: { ...snapshot().organization!, id: 'org-2' } }), 'CROSS_TENANT');
  });

  it('22. organizationId arbitrário do browser não seleciona tenant', () => {
    expect(() => evaluateTenantBootstrap(snapshot(), 'org-browser')).toThrowError(
      expect.objectContaining({ code: 'NO_MEMBERSHIP' })
    );
  });

  it('23. usuário demo não substitui identidade connected', () => {
    const result = evaluateTenantBootstrap(snapshot(), 'org-1');
    expect(result.identity.id).toBe('user-1');
    expect(result.identity.id).not.toContain('demo');
  });

  it('24. OWNER logout MEMBER não herda permissões', () => {
    const owner = resolveArteFlowPermissions({ organizationRole: 'owner', grants: [] });
    const member = resolveArteFlowPermissions({ organizationRole: 'member', grants: ['arteflow.view'] });
    expect(owner.has('arteflow.finance.manage')).toBe(true);
    expect(member.has('arteflow.finance.manage')).toBe(false);
  });

  it('25. MEMBER logout OWNER recalcula permissões sem herdar deny', () => {
    const member = resolveArteFlowPermissions({ organizationRole: 'member', grants: ['arteflow.view'] });
    const owner = resolveArteFlowPermissions({ organizationRole: 'owner', grants: [] });
    expect(member.has('arteflow.settings.manage')).toBe(false);
    expect(owner.has('arteflow.settings.manage')).toBe(true);
  });

  it('26. standalone exige DEV e flag explícita', () => {
    expect(getArteFlowRuntimeConfig({ DEV: true, PROD: false, VITE_ARTEFLOW_MODE: 'standalone' }).mode).toBe('standalone');
    expect(getArteFlowRuntimeConfig({ DEV: true, PROD: false }).mode).toBe('connected');
  });

  it('27. produção nunca faz fallback para demo', () => {
    const config = getArteFlowRuntimeConfig({ DEV: false, PROD: true, VITE_ARTEFLOW_MODE: 'standalone' });
    expect(config.mode).toBe('connected');
  });
});

describe('Prexyon SSO V2', () => {
  it('28. Edge Function success cria resultado autenticado', async () => {
    const result = await exchangePrexyonCode(ssoClient({ data: validExchange() }), 'one-time-code');
    expect(result).toMatchObject({ userId: 'user-1', organizationId: 'org-1', productCode: 'arteflow' });
    expect(result.session.user.id).toBe('user-1');
  });

  it('29. ausência de token_hash é negada', async () => {
    await expect(exchangePrexyonCode(ssoClient({ data: validExchange({ token_hash: undefined }) }), 'code'))
      .rejects.toThrow('INVALID_SSO_RESPONSE');
  });

  it('30. verification_type inválido é negado', async () => {
    await expect(exchangePrexyonCode(ssoClient({ data: validExchange({ verification_type: 'sms' }) }), 'code'))
      .rejects.toThrow('INVALID_SSO_RESPONSE');
  });

  it('31. verifyOtp recebe token_hash e tipo fornecidos pela Edge Function', async () => {
    const client = ssoClient({ data: validExchange() });
    await exchangePrexyonCode(client, 'code');
    expect(client.auth.verifyOtp).toHaveBeenCalledWith({ token_hash: 'hashed-auth-token', type: 'magiclink' });
  });

  it('32. falha no verifyOtp nega autenticação', async () => {
    await expect(exchangePrexyonCode(ssoClient({ data: validExchange(), verifyError: new Error('invalid') }), 'code'))
      .rejects.toThrow('AUTH_FAILED');
  });

  it('33. sessão ausente após verifyOtp é negada', async () => {
    const client = ssoClient({ data: validExchange(), verifiedSession: null });
    await expect(exchangePrexyonCode(client, 'code')).rejects.toThrow('AUTH_FAILED');
    expect(client.auth.signOut).toHaveBeenCalled();
  });

  it('34. usuário ausente após verifyOtp é negado', async () => {
    const client = ssoClient({ data: validExchange(), verifiedUser: null });
    await expect(exchangePrexyonCode(client, 'code')).rejects.toThrow('AUTH_FAILED');
    expect(client.auth.signOut).toHaveBeenCalled();
  });

  it('35. identity mismatch executa signOut e nega', async () => {
    const client = ssoClient({ data: validExchange({ user_id: 'other-user' }) });
    await expect(exchangePrexyonCode(client, 'code')).rejects.toThrow('IDENTITY_MISMATCH');
    expect(client.auth.signOut).toHaveBeenCalled();
  });

  it('36. getUser mismatch executa signOut e nega', async () => {
    const client = ssoClient({ data: validExchange(), authoritativeUser: { id: 'other-user' } as SupabaseUser });
    await expect(exchangePrexyonCode(client, 'code')).rejects.toThrow('IDENTITY_MISMATCH');
    expect(client.auth.getUser).toHaveBeenCalled();
    expect(client.auth.signOut).toHaveBeenCalled();
  });

  it('37. browser envia somente code e audience arteflow', async () => {
    const client = ssoClient({ data: validExchange() });
    await exchangePrexyonCode(client, 'one-time-code');
    expect(client.functions.invoke).toHaveBeenCalledWith('prexyon-sso-exchange', {
      body: { code: 'one-time-code', audience: 'arteflow' },
    });
  });

  it('38. INVALID_AUDIENCE da Edge Function permanece deny', async () => {
    await expect(exchangePrexyonCode(ssoClient({ error: new Error('INVALID_AUDIENCE') }), 'code'))
      .rejects.toThrow('INVALID_AUDIENCE');
  });

  it('39. replay da Edge Function permanece deny', async () => {
    await expect(exchangePrexyonCode(ssoClient({ error: new Error('REPLAY_BLOCKED') }), 'code'))
      .rejects.toThrow('REPLAY_BLOCKED');
  });

  it('40. auth válida sem entitlement continua negada no bootstrap', () => {
    expectBootstrapCode(snapshot({ entitled: false }), 'NO_ENTITLEMENT');
  });

  it('41. auth válida sem product access continua negada no bootstrap', () => {
    expectBootstrapCode(snapshot({ productAccess: false }), 'NO_PRODUCT_ACCESS');
  });

  it('42. auth válida sem arteflow.view continua negada', () => {
    expectBootstrapCode(snapshot({ grants: ['arteflow.orders.view'] }), 'NO_ARTEFLOW_VIEW');
  });

  it('43. owner real recebe bypass somente pelo role da membership', () => {
    const result = evaluateTenantBootstrap(snapshot({
      memberships: [{ ...snapshot().memberships[0], role: 'owner' }], grants: [], productAccess: true,
    }), 'org-1');
    expect([...result.permissions]).toEqual(expect.arrayContaining(['arteflow.view', 'arteflow.users.manage']));
  });

  it('43b. owner sem product access explícito também é negado', () => {
    expectBootstrapCode(snapshot({
      memberships: [{ ...snapshot().memberships[0], role: 'owner' }], grants: [], productAccess: false,
    }), 'NO_PRODUCT_ACCESS');
  });

  it('44. member recebe exatamente grants conhecidos e aliases limitados', () => {
    const permissions = resolveArteFlowPermissions({
      organizationRole: 'member',
      grants: ['arteflow.view', 'arteflow.orders.view', 'arteflow.production.move_stages'],
    });
    expect([...permissions]).toEqual(['arteflow.view', 'arteflow.orders.view', 'arteflow.production.manage']);
  });

  it('45. permission desconhecida não concede capacidade', () => {
    expect(resolveArteFlowPermissions({ organizationRole: 'member', grants: ['arteflow.unknown'] }).size).toBe(0);
  });

  it('46. organizationId fornecido pelo browser não troca tenant', () => {
    expect(() => evaluateTenantBootstrap(snapshot(), 'org-injetada')).toThrowError(
      expect.objectContaining({ code: 'NO_MEMBERSHIP' })
    );
  });

  it('47. identidade demo não substitui usuário autenticado connected', () => {
    expect(evaluateTenantBootstrap(snapshot(), 'org-1').identity.id).toBe(authUser.id);
  });

  it('48. owner seguido de member não herda grants', () => {
    const owner = resolveArteFlowPermissions({ organizationRole: 'owner', grants: [] });
    const member = resolveArteFlowPermissions({ organizationRole: 'member', grants: ['arteflow.view'] });
    expect(owner.has('arteflow.users.manage')).toBe(true);
    expect([...member]).toEqual(['arteflow.view']);
  });

  it('49. member seguido de owner recalcula o bypass', () => {
    const member = resolveArteFlowPermissions({ organizationRole: 'member', grants: [] });
    const owner = resolveArteFlowPermissions({ organizationRole: 'owner', grants: [] });
    expect(member.size).toBe(0);
    expect(owner.size).toBe(14);
  });

  it('50. standalone funciona somente com DEV e flag explícita', () => {
    expect(getArteFlowRuntimeConfig({ DEV: true, PROD: false, VITE_ARTEFLOW_MODE: 'standalone' }).mode).toBe('standalone');
    expect(getArteFlowRuntimeConfig({ DEV: true, PROD: false, MODE: 'standalone' }).mode).toBe('standalone');
  });

  it('51. produção recusa standalone mesmo com flag', () => {
    expect(getArteFlowRuntimeConfig({ DEV: false, PROD: true, VITE_ARTEFLOW_MODE: 'standalone' }).mode).toBe('connected');
    expect(getArteFlowRuntimeConfig({ DEV: false, PROD: true, MODE: 'standalone' }).mode).toBe('connected');
  });

  it('52. raw SSO code aceita parâmetros compatíveis e nunca é persistido', async () => {
    expect(readPrexyonCode('?code=one-time')).toBe('one-time');
    expect(readPrexyonCode('?sso_code=legacy-one-time')).toBe('legacy-one-time');
    expect(() => readPrexyonCode('?code=a&sso_code=b')).toThrow('INVALID_CODE');
    const storageSpy = vi.spyOn(Storage.prototype, 'setItem');
    await exchangePrexyonCode(ssoClient({ data: validExchange() }), 'one-time');
    expect(storageSpy).not.toHaveBeenCalled();
    storageSpy.mockRestore();
  });
});
