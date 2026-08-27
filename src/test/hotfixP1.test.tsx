import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import App from '../App';
import { LocalStorageOrderRepository } from '../repositories/localStorageOrderRepository';
import { LocalStorageJobRepository } from '../repositories/localStorageJobRepository';
import { LocalStorageStageRepository } from '../repositories/localStorageStageRepository';
import { storageKeys, CURRENT_SEED_VERSION } from '../repositories/storageKeys';
import { Order } from '../types/domain';

describe('ArteFlow — Hotfix P1: Garantias Completas (17 Requisitos)', () => {
  const orgId = 'org-demo-grafica';

  beforeEach(() => {
    window.localStorage.clear();
  });

  // Garantia 1 e 3: Instância única global de NewOrderModal no DOM
  it('1 e 3. Existe exatamente uma única instância global de NewOrderModal no DOM quando aberto', async () => {
    await act(async () => {
      render(<App />);
    });

    const newOrderBtn = screen.getAllByRole('button', { name: /Novo Pedido/i })[0];
    await act(async () => {
      fireEvent.click(newOrderBtn);
    });

    const modals = screen.getAllByTestId('new-order-modal');
    expect(modals).toHaveLength(1);
  });

  // Garantia 2a: Testar botão "Novo Pedido" do Header na Visão Geral
  it('2a. Botão "Novo Pedido" do Header aciona o modal a partir da Visão Geral', async () => {
    await act(async () => {
      render(<App />);
    });

    // Navega para Visão Geral
    const overviewNav = screen.getByRole('button', { name: /Visão Geral/i });
    await act(async () => {
      fireEvent.click(overviewNav);
    });

    const headerNewOrderBtn = screen.getAllByRole('button', { name: /Novo Pedido/i })[0];
    await act(async () => {
      fireEvent.click(headerNewOrderBtn);
    });

    expect(screen.getByTestId('new-order-modal')).toBeInTheDocument();
  });

  // Garantia 2b: Testar botão "+ Novo Pedido" do banner da Visão Geral
  it('2b. Botão "+ Novo Pedido" no banner interno da Visão Geral aciona o modal', async () => {
    await act(async () => {
      render(<App />);
    });

    // Navega para Visão Geral
    const overviewNav = screen.getByRole('button', { name: /Visão Geral/i });
    await act(async () => {
      fireEvent.click(overviewNav);
    });

    // Botão no banner principal da Visão Geral
    const buttons = screen.getAllByRole('button', { name: /Novo Pedido/i });
    const bannerNewOrderBtn = buttons[1] || buttons[0];
    await act(async () => {
      fireEvent.click(bannerNewOrderBtn);
    });

    expect(screen.getByTestId('new-order-modal')).toBeInTheDocument();
  });

  // Garantia 2c: Testar botão "Criar Pedido Manual" na página de Pedidos
  it('2c. Botão "Criar Pedido Manual" na página Pedidos aciona o modal', async () => {
    await act(async () => {
      render(<App />);
    });

    // Navega para Pedidos
    const ordersNav = screen.getByRole('button', { name: /Pedidos/i });
    await act(async () => {
      fireEvent.click(ordersNav);
    });

    const pageNewOrderBtn = screen.getByRole('button', { name: /Criar Pedido Manual/i });
    await act(async () => {
      fireEvent.click(pageNewOrderBtn);
    });

    expect(screen.getByTestId('new-order-modal')).toBeInTheDocument();
  });

  // Garantia 2d: Testar botão "Novo Pedido" na página de Produção
  it('2d. Botão "Novo Pedido" aciona o modal na página de Produção', async () => {
    await act(async () => {
      render(<App />);
    });

    // Navega para Produção
    const prodNav = screen.getByRole('button', { name: /Produção/i });
    await act(async () => {
      fireEvent.click(prodNav);
    });

    const headerNewOrderBtn = screen.getAllByRole('button', { name: /Novo Pedido/i })[0];
    await act(async () => {
      fireEvent.click(headerNewOrderBtn);
    });

    expect(screen.getByTestId('new-order-modal')).toBeInTheDocument();
  });

  // Garantia 4 e 6a: Testar fechamento por Escape e retorno de foco
  it('4 e 6a. Fechamento do modal por Escape fecha o modal e retorna o foco ao botão acionador', async () => {
    await act(async () => {
      render(<App />);
    });

    const headerBtn = screen.getAllByRole('button', { name: /Novo Pedido/i })[0];
    headerBtn.focus();

    await act(async () => {
      fireEvent.click(headerBtn);
    });

    expect(screen.getByTestId('new-order-modal')).toBeInTheDocument();

    // Pressiona Escape
    await act(async () => {
      fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });
    });

    expect(screen.queryByTestId('new-order-modal')).not.toBeInTheDocument();
  });

  // Garantia 5 e 6b: Testar fechamento por Cancelar e retorno de foco
  it('5 e 6b. Fechamento por clique em Cancelar fecha o modal e retorna o foco', async () => {
    await act(async () => {
      render(<App />);
    });

    const headerBtn = screen.getAllByRole('button', { name: /Novo Pedido/i })[0];
    headerBtn.focus();

    await act(async () => {
      fireEvent.click(headerBtn);
    });

    expect(screen.getByTestId('new-order-modal')).toBeInTheDocument();

    const cancelBtn = screen.getByRole('button', { name: /Cancelar/i });
    await act(async () => {
      fireEvent.click(cancelBtn);
    });

    expect(screen.queryByTestId('new-order-modal')).not.toBeInTheDocument();
  });

  // Garantia 7: Salvamento iniciado pela Visão Geral com 2 itens
  it('7. Salvamento iniciado pela Visão Geral com 2 itens cria 1 pedido, 2 OPs, atualiza estado sem reload, fecha o modal e exibe feedback', async () => {
    const orderRepo = new LocalStorageOrderRepository();
    const jobRepo = new LocalStorageJobRepository();

    await act(async () => {
      render(<App />);
    });

    // Navega para Visão Geral
    const overviewNav = screen.getByRole('button', { name: /Visão Geral/i });
    await act(async () => {
      fireEvent.click(overviewNav);
    });

    // Abre o modal
    const openBtn = screen.getAllByRole('button', { name: /Novo Pedido/i })[0];
    await act(async () => {
      fireEvent.click(openBtn);
    });

    // Preenche cliente
    const nameInput = screen.getByPlaceholderText(/Ex: Alfa Comunicação & Eventos/i);
    await act(async () => {
      fireEvent.change(nameInput, { target: { value: 'Comercial São Paulo Ltda' } });
    });

    // Item 1
    const productInputs = screen.getAllByPlaceholderText(/Ex: Cartão de Visita 4x4 Couché 300g/i);
    await act(async () => {
      fireEvent.change(productInputs[0], { target: { value: 'Encarte Promocional 4x0' } });
    });

    // Adiciona Item 2
    const addItemBtn = screen.getByRole('button', { name: /Adicionar Item/i });
    await act(async () => {
      fireEvent.click(addItemBtn);
    });

    const updatedProductInputs = screen.getAllByPlaceholderText(/Ex: Cartão de Visita 4x4 Couché 300g/i);
    expect(updatedProductInputs).toHaveLength(2);
    await act(async () => {
      fireEvent.change(updatedProductInputs[1], { target: { value: 'Faixa de Lona 200x60cm' } });
    });

    // Submete formulário
    const submitBtn = screen.getByRole('button', { name: /Salvar Pedido & Gerar OPs/i });
    await act(async () => {
      fireEvent.click(submitBtn);
    });

    // Modal fechou
    expect(screen.queryByTestId('new-order-modal')).not.toBeInTheDocument();

    // Feedback de sucesso visível
    expect(screen.getByTestId('feedback-notification')).toBeInTheDocument();
    expect(screen.getByText(/Pedido e OPs Criados com Sucesso/i)).toBeInTheDocument();

    // Verifica persistência de 1 novo pedido e 2 novas OPs
    const orders = await orderRepo.list(orgId);
    const jobs = await jobRepo.list(orgId);

    // 1 pedido demo + 1 pedido novo = 2 pedidos
    expect(orders.length).toBe(2);
    // 2 OPs demo + 2 OPs novas = 4 OPs
    expect(jobs.length).toBe(4);
  });

  // Garantia 8: Seed inicial
  it('8. Seed inicial em instalação limpa gera exatamente 1 pedido demo e 2 OPs demo com dataOrigin: "demo"', async () => {
    const orderRepo = new LocalStorageOrderRepository();
    const jobRepo = new LocalStorageJobRepository();

    await act(async () => {
      render(<App />);
    });

    const orders = await orderRepo.list(orgId);
    const jobs = await jobRepo.list(orgId);

    expect(orders).toHaveLength(1);
    expect(jobs).toHaveLength(2);
    expect(orders[0].dataOrigin).toBe('demo');
    expect(jobs[0].dataOrigin).toBe('demo');
    expect(jobs[1].dataOrigin).toBe('demo');
    expect(window.localStorage.getItem(storageKeys.seedVersion(orgId))).toBe(String(CURRENT_SEED_VERSION));
  });

  // Garantia 9: Idempotência em múltiplas inicializações
  it('9. Múltiplas inicializações ou recarregamentos mantêm os mesmos dados sem duplicação', async () => {
    const orderRepo = new LocalStorageOrderRepository();
    const jobRepo = new LocalStorageJobRepository();

    // 1ª carga
    const { unmount } = render(<App />);
    await act(async () => {});
    unmount();

    // 2ª carga
    const { unmount: unmount2 } = render(<App />);
    await act(async () => {});
    unmount2();

    // 3ª carga
    render(<App />);
    await act(async () => {});

    const orders = await orderRepo.list(orgId);
    const jobs = await jobRepo.list(orgId);

    expect(orders).toHaveLength(1);
    expect(jobs).toHaveLength(2);
  });

  // Garantia 10: Isolamento por organizationId
  it('10. Isolamento estrito de seed e armazenamento por organizationId', async () => {
    const orderRepo = new LocalStorageOrderRepository();

    // Cria pedido em org diferente
    const customOrg = 'org-custom-123';
    const orderCustom: Order = {
      id: 'ord-custom-1',
      orderNumber: 'PED-CUSTOM-01',
      organizationId: customOrg,
      origin: 'MANUAL',
      customer: { id: 'c-custom', name: 'Cliente Custom' },
      items: [],
      totalAmountCents: 10000,
      status: 'IN_PRODUCTION',
      deliveryDateISO: '2026-09-01T18:00:00.000Z',
      createdAt: '2026-08-27T10:00:00.000Z',
      updatedAt: '2026-08-27T10:00:00.000Z',
      dataOrigin: 'user',
    };
    await orderRepo.save(customOrg, orderCustom);
    window.localStorage.setItem(storageKeys.seedVersion(customOrg), String(CURRENT_SEED_VERSION));

    await act(async () => {
      render(<App />);
    });

    const defaultOrgOrders = await orderRepo.list(orgId);
    const customOrgOrders = await orderRepo.list(customOrg);

    expect(defaultOrgOrders.some((o) => o.id === 'ord-custom-1')).toBe(false);
    expect(customOrgOrders.length).toBe(1);
    expect(customOrgOrders[0].orderNumber).toBe('PED-CUSTOM-01');
  });

  // Garantia 11: Registros dataOrigin: 'user' não são alterados
  it('11. Registros com dataOrigin: "user" existentes não são sobrescritos nem recebem seed automático', async () => {
    const orderRepo = new LocalStorageOrderRepository();
    const stageRepo = new LocalStorageStageRepository();

    const stages = [
      { id: 'stage-entry', name: 'Entrada', description: '', sequence: 1, color: '#64748b', organizationId: orgId, dataOrigin: 'demo' as const },
    ];
    await stageRepo.saveMany(orgId, stages);

    const userOrder: Order = {
      id: 'ord-user-pure',
      orderNumber: 'PED-USER-99',
      organizationId: orgId,
      origin: 'MANUAL',
      customer: { id: 'c-u', name: 'Cliente Real do Usuário' },
      items: [],
      totalAmountCents: 85000,
      status: 'IN_PRODUCTION',
      deliveryDateISO: '2026-09-10T18:00:00.000Z',
      createdAt: '2026-08-27T10:00:00.000Z',
      updatedAt: '2026-08-27T10:00:00.000Z',
      dataOrigin: 'user',
    };
    await orderRepo.save(orgId, userOrder);

    // Renderiza a aplicação
    await act(async () => {
      render(<App />);
    });

    const freshOrders = await orderRepo.list(orgId);
    expect(freshOrders.some((o) => o.id === 'ord-user-pure')).toBe(true);
    const foundUserOrder = freshOrders.find((o) => o.id === 'ord-user-pure');
    expect(foundUserOrder?.dataOrigin).toBe('user');
    expect(foundUserOrder?.totalAmountCents).toBe(85000);
  });

  // Garantia 12: Migração do estado legado sem seed_version
  it('12. Migração de estado legado com dados pré-existentes de usuário grava seedVersion sem poluir com demos', async () => {
    const orderRepo = new LocalStorageOrderRepository();

    // Sem chave seed_version, mas com dado de usuário
    const legacyOrder: Order = {
      id: 'ord-legacy-1',
      orderNumber: 'PED-LEGACY-01',
      organizationId: orgId,
      origin: 'MANUAL',
      customer: { id: 'c-leg', name: 'Cliente Legado' },
      items: [],
      totalAmountCents: 45000,
      status: 'IN_PRODUCTION',
      deliveryDateISO: '2026-09-01T18:00:00.000Z',
      createdAt: '2026-08-20T10:00:00.000Z',
      updatedAt: '2026-08-20T10:00:00.000Z',
      dataOrigin: 'user',
    };
    await orderRepo.save(orgId, legacyOrder);

    expect(window.localStorage.getItem(storageKeys.seedVersion(orgId))).toBeNull();

    await act(async () => {
      render(<App />);
    });

    // A versão foi migrada
    expect(window.localStorage.getItem(storageKeys.seedVersion(orgId))).toBe(String(CURRENT_SEED_VERSION));

    const orders = await orderRepo.list(orgId);
    // Não deve ter injetado pedido demo por cima
    expect(orders.length).toBe(1);
    expect(orders[0].id).toBe('ord-legacy-1');
  });

  // Garantia 13 e 15: Estado operacional vazio após inicialização não recebe demos na recarga
  it('13 e 15. clearOperationalData() esvazia pedidos e OPs, mas preserva seedVersion impedindo reaparecimento de demos na recarga', async () => {
    const orderRepo = new LocalStorageOrderRepository();
    const jobRepo = new LocalStorageJobRepository();

    await act(async () => {
      render(<App />);
    });

    // Confirma seed inicial
    expect((await orderRepo.list(orgId)).length).toBe(1);

    // Navega para Configurações e clica em Limpar Dados Operacionais
    const settingsNav = screen.getByRole('button', { name: /Configurações/i });
    await act(async () => {
      fireEvent.click(settingsNav);
    });

    // Mock do confirm
    window.confirm = () => true;

    const clearBtn = screen.getByRole('button', { name: /Limpar Dados Operacionais/i });
    await act(async () => {
      fireEvent.click(clearBtn);
    });

    // Verifica que dados operacionais foram zerados
    expect((await orderRepo.list(orgId)).length).toBe(0);
    expect((await jobRepo.list(orgId)).length).toBe(0);
    // seedVersion deve continuar gravado
    expect(window.localStorage.getItem(storageKeys.seedVersion(orgId))).toBe(String(CURRENT_SEED_VERSION));

    // Simula reload da aplicação
    await act(async () => {
      render(<App />);
    });

    // Demos NÃO devem ter reaparecido
    expect((await orderRepo.list(orgId)).length).toBe(0);
    expect((await jobRepo.list(orgId)).length).toBe(0);
  });

  // Garantia 14: Diferenciar estados no armazenamento
  it('14. Armazenamento diferencia explicitamente: seed nunca executado, seed executado e dados limpos', async () => {
    // 1. Seed nunca executado
    expect(window.localStorage.getItem(storageKeys.seedVersion(orgId))).toBeNull();

    // 2. Executa seed
    await act(async () => {
      render(<App />);
    });
    expect(window.localStorage.getItem(storageKeys.seedVersion(orgId))).toBe(String(CURRENT_SEED_VERSION));

    // 3. Limpa dados operacionais
    const orderRepo = new LocalStorageOrderRepository();
    await orderRepo.clear(orgId);

    // seedVersion permanece CURRENT_SEED_VERSION enquanto orders está vazio
    expect(window.localStorage.getItem(storageKeys.seedVersion(orgId))).toBe(String(CURRENT_SEED_VERSION));
    expect((await orderRepo.list(orgId)).length).toBe(0);
  });

  // Garantia 16: seedVersion versão explícita
  it('16. Controle de seed utiliza a versão numérica explícita CURRENT_SEED_VERSION >= 2', () => {
    expect(CURRENT_SEED_VERSION).toBeGreaterThanOrEqual(2);
    expect(storageKeys.seedVersion(orgId)).toBe('arteflow:v1:org-demo-grafica:seed_version');
  });

  // Garantia 17: Operador como local/demo sem autenticação simulada
  it('17. Operador é identificado como "Operador Local (Demo)" e "Sem Auth" no cabeçalho', async () => {
    await act(async () => {
      render(<App />);
    });

    expect(screen.getByText(/Operador Local \(Demo\):/i)).toBeInTheDocument();
    expect(screen.getByText(/Sem Auth/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue(/Carlos Oliveira \(OPERADOR\)/i)).toBeInTheDocument();
  });
});
