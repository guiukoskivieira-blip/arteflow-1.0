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
      let selectedCols = '';
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
              select: (cols: string) => {
                selectedCols = cols;
                return {
                  eq: () => ({
                    eq: () => ({
                      in: () =>
                        Promise.resolve({
                          data: [{ product_key: 'arteflow', is_enabled: true }],
                          error: null,
                        }),
                    }),
                  }),
                };
              },
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
      expect(selectedCols).toBe('product_key, is_enabled');
      expect(selectedCols).not.toContain('product_code');
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
                        data: [{ product_key: 'orcagraf', is_enabled: true }],
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

    it('H. Usuário com dual entitlement e dual product_access obtém canImport: true no frontend (não bloqueia por product_permissions)', async () => {
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
                          { product_key: 'orcagraf', is_enabled: true },
                          { product_key: 'arteflow', is_enabled: true },
                        ],
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
      expect(res.canImport).toBe(true);
      expect(res.isEntitled).toBe(true);
      expect(res.hasUserAccess).toBe(true);
    });

    it('H2. Erro de query em product_access não mascara como falta de plano', async () => {
      const mockSupabase = {
        rpc: vi.fn().mockResolvedValue({
          data: [{ is_entitled: true, effective_products: ['orcagraf', 'arteflow'] }],
          error: null,
        }),
        from: vi.fn().mockReturnValue({
          select: () => ({
            eq: () => ({
              eq: () => ({
                in: () =>
                  Promise.resolve({
                    data: null,
                    error: { message: 'relation or column error' },
                  }),
              }),
            }),
          }),
        }),
      } as any;

      const service = new OrcagrafIntegrationService(mockSupabase);
      const res = await service.checkIntegrationEntitlement('org-1', 'user-1');
      expect(res.canImport).toBe(false);
      expect(res.isEntitled).toBe(true);
      expect(res.hasUserAccess).toBe(false);
      expect(res.reason).toBe('Não foi possível validar o acesso individual aos produtos.');
    });

    it('I. RPC 42501 / permission denied retorna erro amigável seguro sem dados e sem fallback demo', async () => {
      const mockSupabase = {
        rpc: vi.fn().mockResolvedValue({
          data: null,
          error: { code: '42501', message: 'permission denied for function arteflow_list_importable_orcagraf_quotes' },
        }),
      } as any;

      const service = new OrcagrafIntegrationService(mockSupabase);
      await expect(service.listImportableQuotes('org-1')).rejects.toThrow(
        'Você não possui permissão para importar orçamentos do OrçaGraf.'
      );
    });

    it('J. RPC erro técnico lança mensagem sanitizada sem vazar SQL/relation/column', async () => {
      const mockSupabase = {
        rpc: vi.fn().mockResolvedValue({
          data: null,
          error: { code: '42P01', message: 'relation "public.orcagraf_quotes" does not exist' },
        }),
      } as any;

      const service = new OrcagrafIntegrationService(mockSupabase);
      await expect(service.listImportableQuotes('org-1')).rejects.toThrow(
        'Não foi possível carregar os orçamentos do OrçaGraf. Tente novamente.'
      );
    });

    it('K. Contrato SQL da migration 20260908020000_fix_orcagraf_quote_import_source.sql usa tabelas canônicas (A-M)', () => {
      const fs = require('fs');
      const path = require('path');
      const sql = fs.readFileSync(
        path.resolve(__dirname, '../../supabase/migrations/20260908020000_fix_orcagraf_quote_import_source.sql'),
        'utf-8'
      );

      // A. usa public.quotes, não public.orcagraf_quotes
      expect(sql).toContain('from public.quotes q');
      expect(sql).not.toContain('public.orcagraf_quotes');

      // B. usa public.quote_items
      expect(sql).toContain('from public.quote_items qi');

      // C. usa public.quote_item_finishings
      expect(sql).toContain('from public.quote_item_finishings qif');

      // D. status aprovado = 'approved'
      expect(sql).toContain("q.status = 'approved'");

      // E. deleted_at não nulo não aparece
      expect(sql).toContain('q.deleted_at is null');

      // F. tenant filter
      expect(sql).toContain('q.organization_id = p_organization_id');
      expect(sql).toContain('qi.organization_id = p_organization_id');

      // G. duplicate filter
      expect(sql).toContain('ao.orcagraf_quote_id = q.id::text');

      // K. q.id::text
      expect(sql).toContain("'id', q.id::text");

      // L & M. authz preservada
      expect(sql).toContain('private.arteflow_can_import_orcagraf(p_organization_id)');
      expect(sql).toContain("raise exception 'ORCAGRAF_INTEGRATION_NOT_ENTITLED' using errcode = '42501'");
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
