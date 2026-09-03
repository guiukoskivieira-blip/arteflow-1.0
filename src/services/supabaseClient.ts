import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getArteFlowRuntimeConfig } from '../config/runtime';

let client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  const config = getArteFlowRuntimeConfig();
  if (!config.isSupabaseConfigured) return null;

  if (!client) {
    client = createClient(config.supabaseUrl, config.supabaseKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    });
  }
  return client;
}

export function resetSupabaseClientForTests(): void {
  client = null;
}
