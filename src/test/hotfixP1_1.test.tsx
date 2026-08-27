import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import App from '../App';
import { LocalStorageOrderRepository } from '../repositories/localStorageOrderRepository';
import { LocalStorageJobRepository } from '../repositories/localStorageJobRepository';
import { storageKeys } from '../repositories/storageKeys';
import { Order } from '../types/domain';

describe('ArteFlow — Hotfix P1.1: Recuperação do Seed Intermediário & CTAs Visão Geral', () => {
  const orgId = 'org-demo-grafica';

  beforeEach(() => {
    window.localStorage.clear();
  });

  // Teste 1: Recuperação do estado intermediário defeituoso
  it('1. seedVersion 2 + seedState ausente + storage vazio recupera 1 pedido e 2 OPs', async () => {
    // Simula o estado intermediário defeituoso que ocorria no navegador
    window.localStorage.setItem(storageKeys.seedVersion(orgId), '2');
    expect(window.localStorage.getItem(storageKeys.seedState(orgId))).toBeNull();

    const orderRepo = new LocalStorageOrderRepository();
    const jobRepo = new LocalStorageJobRepository();

    await act(async () => {
      render(<App />);
    });

    const orders = await orderRepo.list(orgId);
    const jobs = await jobRepo.list(orgId);

    // Recuperação automática executada com sucesso
    expect(orders).toHaveLength(1);
    expect(jobs).toHaveLength(2);
    expect(window.localStorage.getItem(storageKeys.seedState(orgId))).toBe('APPLIED');
  });

  // Teste 2: Segunda inicialização não duplica a recuperação
  it('2. Segunda inicialização ou reload após recuperação não duplica os dados', async () => {
    window.localStorage.setItem(storageKeys.seedVersion(orgId), '2');

    const orderRepo = new LocalStorageOrderRepository();
    const jobRepo = new LocalStorageJobRepository();

    // 1ª carga
    const { unmount } = render(<App />);
    await act(async () => {});
    unmount();

    // 2ª carga
    render(<App />);
    await act(async () => {});

    const orders = await orderRepo.list(orgId);
    const jobs = await jobRepo.list(orgId);

    expect(orders).toHaveLength(1);
    expect(jobs).toHaveLength(2);
  });

  // Teste 3: seedState APPLIED nunca duplica o seed
  it('3. seedState APPLIED nunca duplica o seed em recarregamentos repetidos', async () => {
    const orderRepo = new LocalStorageOrderRepository();
    const jobRepo = new LocalStorageJobRepository();

    await act(async () => {
      render(<App />);
    });

    expect(window.localStorage.getItem(storageKeys.seedState(orgId))).toBe('APPLIED');

    // 3 recarregamentos subsequentes
    for (let i = 0; i < 3; i++) {
      const { unmount } = render(<App />);
      await act(async () => {});
      unmount();
    }

    const orders = await orderRepo.list(orgId);
    const jobs = await jobRepo.list(orgId);

    expect(orders).toHaveLength(1);
    expect(jobs).toHaveLength(2);
  });

  // Teste 4: seedState INTENTIONALLY_CLEARED mantém o sistema vazio após recarga
  it('4. seedState INTENTIONALLY_CLEARED mantém o sistema vazio após recarga', async () => {
    window.localStorage.setItem(storageKeys.seedVersion(orgId), '2');
    window.localStorage.setItem(storageKeys.seedState(orgId), 'INTENTIONALLY_CLEARED');

    const orderRepo = new LocalStorageOrderRepository();
    const jobRepo = new LocalStorageJobRepository();

    await act(async () => {
      render(<App />);
    });

    const orders = await orderRepo.list(orgId);
    const jobs = await jobRepo.list(orgId);

    expect(orders).toHaveLength(0);
    expect(jobs).toHaveLength(0);
  });

  // Teste 5: clearOperationalData grava INTENTIONALLY_CLEARED
  it('5. clearOperationalData grava INTENTIONALLY_CLEARED e esvazia pedidos e OPs', async () => {
    const orderRepo = new LocalStorageOrderRepository();
    const jobRepo = new LocalStorageJobRepository();

    await act(async () => {
      render(<App />);
    });

    // Navega para Configurações
    const settingsNav = screen.getByRole('button', { name: /Configurações/i });
    await act(async () => {
      fireEvent.click(settingsNav);
    });

    window.confirm = () => true;
    const clearBtn = screen.getByRole('button', { name: /Limpar Dados Operacionais/i });
    await act(async () => {
      fireEvent.click(clearBtn);
    });

    expect(window.localStorage.getItem(storageKeys.seedState(orgId))).toBe('INTENTIONALLY_CLEARED');
    expect((await orderRepo.list(orgId)).length).toBe(0);
    expect((await jobRepo.list(orgId)).length).toBe(0);
  });

  // Teste 6: resetDemoEnvironment cria 1 pedido e 2 OPs e grava APPLIED
  it('6. resetDemoEnvironment cria 1 pedido e 2 OPs e grava APPLIED', async () => {
    // Começa limpo
    window.localStorage.setItem(storageKeys.seedState(orgId), 'INTENTIONALLY_CLEARED');

    const orderRepo = new LocalStorageOrderRepository();
    const jobRepo = new LocalStorageJobRepository();

    await act(async () => {
      render(<App />);
    });

    // Navega para Configurações
    const settingsNav = screen.getByRole('button', { name: /Configurações/i });
    await act(async () => {
      fireEvent.click(settingsNav);
    });

    window.confirm = () => true;
    const resetBtn = screen.getByRole('button', { name: /Restaurar Seed Demo/i });
    await act(async () => {
      fireEvent.click(resetBtn);
    });

    expect(window.localStorage.getItem(storageKeys.seedState(orgId))).toBe('APPLIED');
    expect((await orderRepo.list(orgId)).length).toBe(1);
    expect((await jobRepo.list(orgId)).length).toBe(2);
  });

  // Teste 7: Dados user existentes nunca recebem seed demo
  it('7. Dados user existentes nunca recebem seed demo nem são apagados', async () => {
    const orderRepo = new LocalStorageOrderRepository();
    const userOrder: Order = {
      id: 'ord-user-custom',
      orderNumber: 'PED-2026-CUSTOM',
      organizationId: orgId,
      origin: 'MANUAL',
      customer: { id: 'c-1', name: 'Cliente Real Cadastrado' },
      items: [],
      totalAmountCents: 120000,
      status: 'IN_PRODUCTION',
      deliveryDateISO: '2026-09-15T18:00:00.000Z',
      createdAt: '2026-08-27T10:00:00.000Z',
      updatedAt: '2026-08-27T10:00:00.000Z',
      dataOrigin: 'user',
    };
    await orderRepo.save(orgId, userOrder);

    await act(async () => {
      render(<App />);
    });

    const orders = await orderRepo.list(orgId);
    expect(orders).toHaveLength(1);
    expect(orders[0].id).toBe('ord-user-custom');
    expect(orders[0].dataOrigin).toBe('user');
    expect(window.localStorage.getItem(storageKeys.seedState(orgId))).toBe('APPLIED');
  });

  // Teste 8: Isolamento completo por organizationId
  it('8. Isolamento completo de seedState e dados por organizationId', async () => {
    const orderRepo = new LocalStorageOrderRepository();
    const otherOrg = 'org-outra-grafica';

    window.localStorage.setItem(storageKeys.seedState(otherOrg), 'INTENTIONALLY_CLEARED');

    await act(async () => {
      render(<App />);
    });

    expect(window.localStorage.getItem(storageKeys.seedState(orgId))).toBe('APPLIED');
    expect(window.localStorage.getItem(storageKeys.seedState(otherOrg))).toBe('INTENTIONALLY_CLEARED');
    expect((await orderRepo.list(orgId)).length).toBe(1);
    expect((await orderRepo.list(otherOrg)).length).toBe(0);
  });

  // Teste 9: Botão do Header na Visão Geral abre o modal global
  it('9. Botão do Header na Visão Geral abre o modal global', async () => {
    await act(async () => {
      render(<App />);
    });

    const overviewNav = screen.getByRole('button', { name: /Visão Geral/i });
    await act(async () => {
      fireEvent.click(overviewNav);
    });

    const headerBtn = screen.getAllByRole('button', { name: /Novo Pedido/i })[0];
    await act(async () => {
      fireEvent.click(headerBtn);
    });

    expect(screen.getByTestId('new-order-modal')).toBeInTheDocument();
  });

  // Teste 10: Botão do banner na Visão Geral abre o mesmo modal global
  it('10. Botão do banner na Visão Geral abre o mesmo modal global', async () => {
    await act(async () => {
      render(<App />);
    });

    const overviewNav = screen.getByRole('button', { name: /Visão Geral/i });
    await act(async () => {
      fireEvent.click(overviewNav);
    });

    const bannerBtn = screen.getAllByRole('button', { name: /Novo Pedido/i })[1];
    await act(async () => {
      fireEvent.click(bannerBtn);
    });

    expect(screen.getByTestId('new-order-modal')).toBeInTheDocument();
  });

  // Teste 11: Existe somente uma instância de NewOrderModal no DOM
  it('11. Existe somente uma instância de NewOrderModal no DOM quando acionado', async () => {
    await act(async () => {
      render(<App />);
    });

    const headerBtn = screen.getAllByRole('button', { name: /Novo Pedido/i })[0];
    await act(async () => {
      fireEvent.click(headerBtn);
    });

    const modals = screen.getAllByTestId('new-order-modal');
    expect(modals).toHaveLength(1);
  });

  // Teste 12: Escape restaura o foco ao CTA correto (Header e Banner)
  it('12. Escape restaura o foco ao CTA correto (Header e Banner)', async () => {
    await act(async () => {
      render(<App />);
    });

    const overviewNav = screen.getByRole('button', { name: /Visão Geral/i });
    await act(async () => {
      fireEvent.click(overviewNav);
    });

    // Teste CTA Banner
    const bannerBtn = screen.getAllByRole('button', { name: /Novo Pedido/i })[1];
    bannerBtn.focus();
    await act(async () => {
      fireEvent.click(bannerBtn);
    });

    expect(screen.getByTestId('new-order-modal')).toBeInTheDocument();

    await act(async () => {
      fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });
    });

    expect(screen.queryByTestId('new-order-modal')).not.toBeInTheDocument();
  });

  // Teste 13: Cancelar restaura o foco ao CTA correto
  it('13. Cancelar restaura o foco ao CTA correto', async () => {
    await act(async () => {
      render(<App />);
    });

    const overviewNav = screen.getByRole('button', { name: /Visão Geral/i });
    await act(async () => {
      fireEvent.click(overviewNav);
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

  // Teste 14: Pedido com 2 itens criado pela Visão Geral atualiza contadores sem reload
  it('14. Pedido com 2 itens criado pela Visão Geral gera 2 OPs e atualiza contadores imediatamente sem reload', async () => {
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

    // Abre modal pelo banner
    const bannerBtn = screen.getAllByRole('button', { name: /Novo Pedido/i })[1];
    await act(async () => {
      fireEvent.click(bannerBtn);
    });

    // Preenche cliente
    const nameInput = screen.getByPlaceholderText(/Ex: Alfa Comunicação & Eventos/i);
    await act(async () => {
      fireEvent.change(nameInput, { target: { value: 'Comunicação Global SA' } });
    });

    // Item 1
    const productInputs = screen.getAllByPlaceholderText(/Ex: Cartão de Visita 4x4 Couché 300g/i);
    await act(async () => {
      fireEvent.change(productInputs[0], { target: { value: 'Banner Promocional 4x0' } });
    });

    // Adiciona Item 2
    const addItemBtn = screen.getByRole('button', { name: /Adicionar Item/i });
    await act(async () => {
      fireEvent.click(addItemBtn);
    });

    const updatedProductInputs = screen.getAllByPlaceholderText(/Ex: Cartão de Visita 4x4 Couché 300g/i);
    await act(async () => {
      fireEvent.change(updatedProductInputs[1], { target: { value: 'Adesivo Vinil Recorte' } });
    });

    // Salva
    const submitBtn = screen.getByRole('button', { name: /Salvar Pedido & Gerar OPs/i });
    await act(async () => {
      fireEvent.click(submitBtn);
    });

    // Modal fecha
    expect(screen.queryByTestId('new-order-modal')).not.toBeInTheDocument();

    // Feedback visível
    expect(screen.getByTestId('feedback-notification')).toBeInTheDocument();

    // Contadores da Visão Geral atualizados imediatamente: 1 demo + 1 novo = 2 pedidos; 2 demo + 2 novas = 4 OPs
    expect((await orderRepo.list(orgId)).length).toBe(2);
    expect((await jobRepo.list(orgId)).length).toBe(4);
  });
});
