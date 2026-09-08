import type { ArteFlowRuntimeMode } from '../auth/types';

export interface ArteFlowRuntimeConfig {
  mode: ArteFlowRuntimeMode;
  isDev: boolean;
  isProduction: boolean;
  supabaseUrl: string;
  supabaseKey: string;
  prexyonPortalUrl: string;
  arteFlowAppUrl: string;
  orcagrafAppUrl: string;
  artecheckAppUrl: string;
  isSupabaseConfigured: boolean;
  callbackUrl: string | null;
}

function safeHttpUrl(value: unknown): string {
  if (typeof value !== 'string' || value.trim() === '') return '';
  try {
    const raw = value.trim();
    const parsed = new URL(raw.startsWith('http://') || raw.startsWith('https://') ? raw : `https://${raw}`);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return '';
    }
    if (parsed.protocol === 'http:' && parsed.hostname !== 'localhost' && parsed.hostname !== '127.0.0.1') {
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
  const supabaseKey = String(env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '').trim();

  // Centralized URLs supporting both VITE_PREXYON_*_URL and legacy VITE_*_APP_URL
  const prexyonPortalUrl = safeHttpUrl(env.VITE_PREXYON_PORTAL_URL);
  const arteFlowAppUrl = safeHttpUrl(env.VITE_PREXYON_ARTEFLOW_URL ?? env.VITE_ARTEFLOW_APP_URL);
  const orcagrafAppUrl = safeHttpUrl(env.VITE_PREXYON_ORCAGRAF_URL ?? env.VITE_ORCAGRAF_APP_URL);
  const artecheckAppUrl = safeHttpUrl(env.VITE_PREXYON_ARTECHECK_URL ?? env.VITE_ARTECHECK_APP_URL);

  return {
    mode,
    isDev,
    isProduction,
    supabaseUrl,
    supabaseKey,
    prexyonPortalUrl,
    arteFlowAppUrl,
    orcagrafAppUrl,
    artecheckAppUrl,
    isSupabaseConfigured: Boolean(supabaseUrl && supabaseKey),
    callbackUrl: arteFlowAppUrl ? `${arteFlowAppUrl}/auth/prexyon` : null,
  };
}

