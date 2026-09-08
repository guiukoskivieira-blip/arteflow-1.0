import type { EmailOtpType, Session, SupabaseClient } from '@supabase/supabase-js';
import type { SsoExchangeResult } from '../auth/types';

const SSO_FUNCTION_NAME = 'prexyon-sso-exchange';
const ARTEFLOW_AUDIENCE = 'arteflow';
const VALID_VERIFICATION_TYPES = new Set<EmailOtpType>([
  'signup', 'invite', 'magiclink', 'recovery', 'email_change', 'email',
]);

interface ExchangePayload {
  success?: boolean;
  token_hash?: string;
  verification_type?: string;
  user_id?: string;
  organization_id?: string;
  product_code?: string;
  error?: string;
}

function requiredText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function exchangeFailure(error: unknown, payload: ExchangePayload | null): Error {
  const message = [
    error instanceof Error ? error.message : '',
    error && typeof error === 'object' && 'message' in error ? String(error.message) : '',
    payload?.error ?? '',
  ].join(' ');
  if (message.includes('REPLAY_BLOCKED')) return new Error('REPLAY_BLOCKED');
  if (message.includes('CODE_EXPIRED')) return new Error('CODE_EXPIRED');
  if (message.includes('INVALID_AUDIENCE')) return new Error('INVALID_AUDIENCE');
  if (message.includes('INVALID_CODE')) return new Error('INVALID_CODE');
  return new Error('SSO_EXCHANGE_FAILED');
}

export function readPrexyonCode(search: string): string {
  const queryPart = search.includes('?') ? search.slice(search.indexOf('?')) : (search.startsWith('code=') || search.startsWith('sso_code=') ? `?${search}` : search);
  const params = new URLSearchParams(queryPart);
  const code = requiredText(params.get('code'));
  const legacyCode = requiredText(params.get('sso_code'));
  if (code && legacyCode && code !== legacyCode) throw new Error('INVALID_CODE');
  const selected = code ?? legacyCode;
  if (!selected || selected.length > 512) throw new Error('INVALID_CODE');
  return selected;
}

export async function exchangePrexyonCode(
  supabase: SupabaseClient,
  rawCode: string
): Promise<SsoExchangeResult> {
  const code = requiredText(rawCode);
  if (!code || code.length > 512) throw new Error('INVALID_CODE');

  const { data, error } = await supabase.functions.invoke<ExchangePayload>(SSO_FUNCTION_NAME, {
    body: { code, audience: ARTEFLOW_AUDIENCE },
  });
  const payload = data ?? null;
  if (error || payload?.success !== true) throw exchangeFailure(error, payload);

  const tokenHash = requiredText(payload.token_hash);
  const verificationType = requiredText(payload.verification_type);
  const userId = requiredText(payload.user_id);
  const organizationId = requiredText(payload.organization_id);
  if (
    !tokenHash || !verificationType ||
    !VALID_VERIFICATION_TYPES.has(verificationType as EmailOtpType) ||
    !userId || !organizationId || payload.product_code !== ARTEFLOW_AUDIENCE
  ) {
    throw new Error('INVALID_SSO_RESPONSE');
  }

  const verification = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: verificationType as EmailOtpType,
  });
  if (verification.error) throw new Error('AUTH_FAILED');

  const session: Session | null = verification.data.session;
  const user = verification.data.user;
  if (!session || !user) {
    await supabase.auth.signOut();
    throw new Error('AUTH_FAILED');
  }
  if (user.id !== userId || session.user.id !== userId) {
    await supabase.auth.signOut();
    throw new Error('IDENTITY_MISMATCH');
  }

  const authoritativeUser = await supabase.auth.getUser();
  if (authoritativeUser.error || authoritativeUser.data.user?.id !== userId) {
    await supabase.auth.signOut();
    throw new Error('IDENTITY_MISMATCH');
  }

  return {
    userId,
    organizationId,
    productCode: ARTEFLOW_AUDIENCE,
    session,
  };
}

export async function generateSsoCodeForProduct(
  supabase: SupabaseClient,
  organizationId: string,
  targetProductCode: string
): Promise<string> {
  const { data, error } = await supabase.rpc('prexyon_generate_sso_code', {
    p_organization_id: organizationId,
    p_product_code: targetProductCode,
  });

  if (error) {
    throw new Error(`SSO_GENERATE_FAILED: ${error.message}`);
  }

  const code = typeof data === 'string' ? data.trim() : (data as any)?.code;
  if (!code || typeof code !== 'string') {
    throw new Error('SSO_GENERATE_FAILED: Código não retornado pela autoridade Prexyon.');
  }

  return code;
}
