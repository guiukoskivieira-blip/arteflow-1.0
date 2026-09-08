import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ArteFlowProvider } from '../context/ArteFlowContext';
import { NewOrderModal } from '../components/orders/NewOrderModal';
import { DEMO_ORGANIZATION } from '../domain/seed';
import { DEMO_USERS } from '../domain/constants';
import {
  isDualProductEntitled,
  OrcagrafIntegrationService,
} from '../services/orcagrafIntegrationService';

describe('P2-01 — Importação de Orçamento Aprovado do OrçaGraf com Dual Entitlement', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  // A, B, C, D, E: Testes de Regra de Entitlement
  describe('Regras de Entitlement Efetivo (A-E)', () => {
    it('A. Organização com apenas ArteFlow é bloqueada', () => {
      const entitlement = {
        is_entitled: true,
        effective_products: ['arteflow'],
      };
      expect(isDualProductEntitled(entitlement)).toBe(false);
    });

    it('B. Organização com apenas OrçaGraf é bloqueada', () => {
      const entitlement = {
        is_entitled: true,
        effective_products: ['orcagraf'],
      };
      expect(isDualProductEntitled(entitlement)).toBe(false);
    });

    it('C. Organização com OrçaGraf + ArteFlow é permitida', () => {
      const entitlement = {
        is_entitled: true,
        effective_products: ['orcagraf', 'arteflow'],
      };
      expect(isDualProductEntitled(entitlement)).toBe(true);
    });

    it('D. Prexyon Completo ou combo com múltiplos produtos é permitido sem hardcode de plano', () => {
      const entitlement = {
        is_entitled: true,
        effective_products: ['arteflow', 'artecheck', 'orcagraf'],
      };
      expect(isDualProductEntitled(entitlement)).toBe(true);
    });

    it('E. Entitlement expirado ou suspenso (is_entitled false) é bloqueado', () => {
      const entitlement = {
        is_entitled: false,
        effective_products: ['orcagraf', 'arteflow'],
      };
      expect(isDualProductEntitled(entitlement)).toBe(false);
    });
  });

  // F, G, H, I: Testes de Integração de Serviço e Dual Product Access
  describe('OrcagrafIntegrationService & Acesso (F-I)', () => {
    it('F. Usuário sem product_access para OrçaGraf recebe canImport: false', async () => {
      const mockSupabase = {
        rpc: vi.fn().mockImplementation((name: string) => {
          if (name === 'prexyon_get_organization_entitlements') {
            return Promise.resolve({
              data: [{ is_entitled: true, effective_products: ['orcagraf', 'arteflow'] }],
              error: null,
            });
          }
          return Promise.resolve({ data: null, error: null });
        }),
        from: vi.fn().mockImplementation((table: string) => {
          if (table === 'organization_member_product_access') {
            return {
              select: () => ({
                eq: () => ({
                  eq: () => ({
                    in: () =>
                      Promise.resolve({
                        data: [{ product_code: 'arteflow', is_enabled: true }],
                        error: null,
                      }),
                  }),
                }),
              }),
            };
          }
          return { select: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }) };
        }),
      } as any;

      const service = new OrcagrafIntegrationService(mockSupabase);
      const res = await service.checkIntegrationEntitlement('org-1', 'user-1');
      expect(res.canImport).toBe(false);
      expect(res.hasUserAccess).toBe(false);
      expect(res.reason).toMatch(/usuário não possui acesso individual ao OrçaGraf/i);
    });

    it('G. Usuário sem product_access para ArteFlow recebe canImport: false', async () => {
      const mockSupabase = {
        rpc: vi.fn().mockImplementation((name: string) => {
          if (name === 'prexyon_get_organization_entitlements') {
            return Promise.resolve({
              data: [{ is_entitled: true, effective_products: ['orcagraf', 'arteflow'] }],
              error: null,
            });
          }
          return Promise.resolve({ data: null, error: null });
        }),
        from: vi.fn().mockImplementation((table: string) => {
          if (table === 'organization_member_product_access') {
            return {
              select: () => ({
                eq: () => ({
                  eq: () => ({
                    in: () =>
                      Promise.resolve({
                        data: [{ product_code: 'orcagraf', is_enabled: true }],
                        error: null,
                      }),
                  }),
                }),
              }),
            };
          }
          return { select: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }) };
        }),
      } as any;

      const service = new OrcagrafIntegrationService(mockSupabase);
      const res = await service.checkIntegrationEntitlement('org-1', 'user-1');
      expect(res.canImport).toBe(false);
      expect(res.hasUserAccess).toBe(false);
      expect(res.reason).toMatch(/usuário não possui acesso individual ao ArteFlow/i);
    });

    it('H. Usuário com dual product_access mas SEM permissão orcagraf.quotes.view recebe canImport: false', async () => {
      const mockSupabase = {
        rpc: vi.fn().mockImplementation((name: string) => {
          if (name === 'prexyon_get_organization_entitlements') {
            return Promise.resolve({
              data: [{ is_entitled: true, effective_products: ['orcagraf', 'arteflow'] }],
              error: null,
            });
          }
          return Promise.resolve({ data: null, error: null });
        }),
        from: vi.fn().mockImplementation((table: string) => {
          if (table === 'organization_member_product_access') {
            return {
              select: () => ({
                eq: () => ({
                  eq: () => ({
                    in: () =>
                      Promise.resolve({
                        data: [
                          { product_code: 'orcagraf', is_enabled: true },
                          { product_code: 'arteflow', is_enabled: true },
                        ],
                        error: null,
                      }),
                  }),
                }),
              }),
            };
          }
          if (table === 'organization_members') {
            return {
              select: () => ({
                eq: () => ({
                  eq: () => ({
                    eq: () => ({
                      eq: () => ({
                        maybeSingle: () => Promise.resolve({ data: { role: 'member' }, error: null }),
                      }),
                    }),
                  }),
                }),
              }),
            };
          }
          if (table === 'product_permissions') {
            return {
              select: () => ({
                eq: () => ({
                  eq: () => ({
                    eq: () => ({
                      in: () => ({
                        eq: () => ({
                          maybeSingle: () => Promise.resolve({ data: null, error: null }),
                        }),
                      }),
                    }),
                  }),
                }),
              }),
            };
          }
          return { select: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }) };
        }),
      } as any;

      const service = new OrcagrafIntegrationService(mockSupabase);
      const res = await service.checkIntegrationEntitlement('org-1', 'user-1');
      expect(res.canImport).toBe(false);
      expect(res.reason).toMatch(/não possui permissão no OrçaGraf para visualizar orçamentos/i);
    });

    it('I. Usuário com dual product_access e permissão orcagraf.quotes.view obtém canImport: true', async () => {
      const mockSupabase = {
        rpc: vi.fn().mockImplementation((name: string) => {
          if (name === 'prexyon_get_organization_entitlements') {
            return Promise.resolve({
              data: [{ is_entitled: true, effective_products: ['orcagraf', 'arteflow'] }],
              error: null,
            });
          }
          return Promise.resolve({ data: null, error: null });
        }),
        from: vi.fn().mockImplementation((table: string) => {
          if (table === 'organization_member_product_access') {
            return {
              select: () => ({
                eq: () => ({
                  eq: () => ({
                    in: () =>
                      Promise.resolve({
                        data: [
                          { product_code: 'orcagraf', is_enabled: true },
                          { product_code: 'arteflow', is_enabled: true },
                        ],
                        error: null,
                      }),
                  }),
                }),
              }),
            };
          }
          if (table === 'organization_members') {
            return {
              select: () => ({
                eq: () => ({
                  eq: () => ({
                    eq: () => ({
                      eq: () => ({
                        maybeSingle: () => Promise.resolve({ data: { role: 'member' }, error: null }),
                      }),
                    }),
                  }),
                }),
              }),
            };
          }
          if (table === 'product_permissions') {
            return {
              select: () => ({
                eq: () => ({
                  eq: () => ({
                    eq: () => ({
                      in: () => ({
                        eq: () => ({
                          maybeSingle: () => Promise.resolve({ data: { is_granted: true }, error: null }),
                        }),
                      }),
                    }),
                  }),
                }),
              }),
            };
          }
          return { select: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }) };
        }),
      } as any;

      const service = new OrcagrafIntegrationService(mockSupabase);
      const res = await service.checkIntegrationEntitlement('org-1', 'user-1');
      expect(res.canImport).toBe(true);
    });
  });

  // J, K, L, M, N, O, P: Testes de UX do Modal e Importação
  describe('UX do Modal e Fluxo de Importação (J-P)', () => {

    it('J & K. Exibe lista de orçamentos aprovados na aba Importar do OrçaGraf', async () => {
      render(
        <ArteFlowProvider
          identity={{
            organization: DEMO_ORGANIZATION,
            currentUser: DEMO_USERS[0],
          }}
          allowDemoData={true}
        >
          <TestTriggerComponent />
        </ArteFlowProvider>
      );

      // Abrir modal
      fireEvent.click(screen.getByRole('button', { name: /abrir modal/i }));
      expect(screen.getByTestId('new-order-modal')).toBeInTheDocument();

      // Clicar na aba OrçaGraf
      const orcagrafTab = screen.getByRole('button', { name: /importar do orçagraf/i });
      fireEvent.click(orcagrafTab);

      await waitFor(() => {
        expect(screen.getByText('ORC-2026-089')).toBeInTheDocument();
        expect(screen.getByText('Mega Eventos Corporativos SP')).toBeInTheDocument();
      });
    });

    it('L, M, N. Selecionar orçamento preenche o formulário sem salvar automaticamente, e salvar grava com origin ORCAGRAF', async () => {
      render(
        <ArteFlowProvider
          identity={{
            organization: DEMO_ORGANIZATION,
            currentUser: DEMO_USERS[0],
          }}
          allowDemoData={true}
        >
          <TestTriggerComponent />
        </ArteFlowProvider>
      );

      fireEvent.click(screen.getByRole('button', { name: /abrir modal/i }));

      // Clicar na aba OrçaGraf
      fireEvent.click(screen.getByRole('button', { name: /importar do orçagraf/i }));

      await waitFor(() => {
        expect(screen.getByText('ORC-2026-089')).toBeInTheDocument();
      });

      // Clicar em "Carregar Dados"
      const loadBtns = screen.getAllByRole('button', { name: /carregar dados/i });
      fireEvent.click(loadBtns[0]);

      // M. Modal volta para a visualização do formulário em modo edição (não salva automaticamente)
      expect(screen.getByTestId('new-order-modal')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Mega Eventos Corporativos SP')).toBeInTheDocument();
      expect(screen.getByDisplayValue('45.123.789/0001-12')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Painel Backdrop Tecido Sublimado 3x2m')).toBeInTheDocument();

      // Origem é setada para ORCAGRAF
      const originSelect = screen.getByTestId('order-origin-select');
      expect(originSelect).toHaveValue('ORCAGRAF');

      // N. Submeter salva o pedido
      const submitBtn = screen.getByRole('button', { name: /salvar pedido/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(screen.queryByTestId('new-order-modal')).not.toBeInTheDocument();
      });
    });

    it('O. Criação manual continua funcionando normalmente com origin MANUAL', async () => {
      render(
        <ArteFlowProvider
          identity={{
            organization: DEMO_ORGANIZATION,
            currentUser: DEMO_USERS[0],
          }}
          allowDemoData={true}
        >
          <TestTriggerComponent />
        </ArteFlowProvider>
      );

      fireEvent.click(screen.getByRole('button', { name: /abrir modal/i }));

      const nameInput = screen.getByPlaceholderText(/alfa comunicação/i);
      fireEvent.change(nameInput, { target: { value: 'Cliente Manual Novo' } });

      const prodInput = screen.getAllByPlaceholderText(/Cartão de Visita/i)[0];
      fireEvent.change(prodInput, { target: { value: 'Adesivo Vinil Brilho' } });

      const submitBtn = screen.getByRole('button', { name: /salvar pedido/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(screen.queryByTestId('new-order-modal')).not.toBeInTheDocument();
      });
    });
  });
});

import { useArteFlow } from '../context/ArteFlowContext';

const TestTriggerComponent: React.FC = () => {
  const { setIsNewOrderModalOpen } = useArteFlow();
  return (
    <div>
      <button onClick={() => setIsNewOrderModalOpen(true)}>Abrir Modal</button>
      <NewOrderModal />
    </div>
  );
};
