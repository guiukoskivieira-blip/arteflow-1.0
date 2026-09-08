import type { SupabaseClient } from '@supabase/supabase-js';
import type { OrcagrafQuote, OrcagrafEntitlementStatus } from '../types/orcagraf';

export function isDualProductEntitled(value: unknown): boolean {
  if (!value) return false;
  const item = Array.isArray(value) ? value[0] : value;
  if (!item || typeof item !== 'object') return false;
  const data = item as Record<string, unknown>;
  if (data.is_entitled !== true || !Array.isArray(data.effective_products)) {
    return false;
  }
  const products = data.effective_products as string[];
  return products.includes('orcagraf') && products.includes('arteflow');
}

export class OrcagrafIntegrationService {
  constructor(private supabase: SupabaseClient | null) {}

  async checkIntegrationEntitlement(
    organizationId: string,
    userId: string
  ): Promise<OrcagrafEntitlementStatus> {
    if (!this.supabase) {
      return {
        isEntitled: true,
        hasUserAccess: true,
        canImport: true,
      };
    }

    try {
      const { data: entitlement, error: entError } = await this.supabase.rpc(
        'prexyon_get_organization_entitlements',
        { p_org_id: organizationId }
      );

      if (entError || !isDualProductEntitled(entitlement)) {
        return {
          isEntitled: false,
          hasUserAccess: false,
          canImport: false,
          reason: 'A organização não possui assinatura ativa conjunta para OrçaGraf e ArteFlow.',
        };
      }

      // Check user product access for both products
      const { data: accesses, error: accessError } = await this.supabase
        .from('organization_member_product_access')
        .select('product_key, is_enabled')
        .eq('organization_id', organizationId)
        .eq('user_id', userId)
        .in('product_key', ['orcagraf', 'arteflow']);

      if (accessError || !accesses) {
        return {
          isEntitled: true,
          hasUserAccess: false,
          canImport: false,
          reason: 'Não foi possível validar o acesso individual aos produtos.',
        };
      }

      const hasArteflow = accesses.some(
        (a: { product_key: string; is_enabled: boolean }) =>
          a.product_key === 'arteflow' && a.is_enabled === true
      );
      const hasOrcagraf = accesses.some(
        (a: { product_key: string; is_enabled: boolean }) =>
          a.product_key === 'orcagraf' && a.is_enabled === true
      );

      if (!hasArteflow) {
        return {
          isEntitled: true,
          hasUserAccess: false,
          canImport: false,
          reason: 'O usuário não possui acesso individual ao ArteFlow.',
        };
      }

      if (!hasOrcagraf) {
        return {
          isEntitled: true,
          hasUserAccess: false,
          canImport: false,
          reason: 'O usuário não possui acesso individual ao OrçaGraf.',
        };
      }

      // Dual entitlement and dual product_access validated.
      // Final granular RBAC (orcagraf.quotes.view, arteflow.orders.create, explicit deny) is strictly enforced server-side by the RPC.
      return {
        isEntitled: true,
        hasUserAccess: true,
        canImport: true,
      };
    } catch {
      return {
        isEntitled: false,
        hasUserAccess: false,
        canImport: false,
        reason: 'Falha ao consultar a autorização da integração OrçaGraf.',
      };
    }
  }

  async listImportableQuotes(organizationId: string): Promise<OrcagrafQuote[]> {
    if (!this.supabase) {
      return [];
    }

    const { data, error } = await this.supabase.rpc('arteflow_list_importable_orcagraf_quotes', {
      p_organization_id: organizationId,
    });

    if (error) {
      const msg = error.message || '';
      if (
        error.code === '42501' ||
        msg.includes('42501') ||
        msg.includes('ORDER_CREATE_FORBIDDEN') ||
        msg.includes('ORCAGRAF_INTEGRATION_NOT_ENTITLED') ||
        msg.includes('AUTHENTICATION_REQUIRED') ||
        msg.includes('permission denied')
      ) {
        throw new Error('Você não possui permissão para importar orçamentos do OrçaGraf.');
      }
      if (import.meta.env.DEV) {
        console.error('[OrcagrafIntegrationService] Erro ao listar orçamentos:', error);
      }
      throw new Error('Não foi possível carregar os orçamentos do OrçaGraf. Tente novamente.');
    }

    return (data ?? []) as OrcagrafQuote[];
  }
}
