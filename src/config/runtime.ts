import type { ArteFlowRuntimeMode } from '../auth/types';

export interface ArteFlowRuntimeConfig {
  mode: ArteFlowRuntimeMode;
  isDev: boolean;
  isProduction: boolean;
  supabaseUrl: string;
  supabaseKey: string;
  prexyonPortalUrl: string;
  arteFlowAppUrl: string;
  isSupabaseConfigured: boolean;
  callbackUrl: string | null;
}

function safeHttpUrl(value: unknown): string {
  if (typeof value !== 'string' || value.trim() === '') return '';
  try {
    const parsed = new URL(value.trim());
    if (parsed.protocol !== 'https:' && parsed.hostname !== 'localhost' && parsed.hostname !== '127.0.0.1') {
      return '';
    }
    return parsed.toString().replace(/\/$/, '');
  } catch {
    return '';
  }
}

export function getArteFlowRuntimeConfig(
  env: Record<string, unknown> = import.meta.env
): ArteFlowRuntimeConfig {
  const isDev = env.DEV === true;
  const isProduction = env.PROD === true;
  const explicitStandalone =
    String(env.VITE_ARTEFLOW_MODE ?? '').toLowerCase() === 'standalone' ||
    String(env.MODE ?? '').toLowerCase() === 'standalone';
  const mode: ArteFlowRuntimeMode = isDev && explicitStandalone && !isProduction ? 'standalone' : 'connected';
  const supabaseUrl = safeHttpUrl(env.VITE_SUPABASE_URL);
  const supabaseKey = String(env.VITE_SUPABASE_ANON_KEY ?? env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '').trim();
  const prexyonPortalUrl = safeHttpUrl(env.VITE_PREXYON_PORTAL_URL);
  const arteFlowAppUrl = safeHttpUrl(env.VITE_ARTEFLOW_APP_URL);

  return {
    mode,
    isDev,
    isProduction,
    supabaseUrl,
    supabaseKey,
    prexyonPortalUrl,
    arteFlowAppUrl,
    isSupabaseConfigured: Boolean(supabaseUrl && supabaseKey),
    callbackUrl: arteFlowAppUrl ? `${arteFlowAppUrl}/auth/prexyon` : null,
  };
}
