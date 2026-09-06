import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FinancialPage } from '../components/pages/FinancialPage';

const context = vi.hoisted(() => ({ value: {} as any }));

vi.mock('../context/ArteFlowContext', () => ({
  useArteFlow: () => context.value,
}));

function buildFinancialContext(overrides: Partial<any> = {}) {
  return {
    can: (perm: string) => perm === 'arteflow.finance.manage',
    receivables: [
      {
        id: 'receivable-1',
        organizationId: 'org-1',
        orderId: 'order-1',
        orderNumber: 'PED-001',
        customerId: 'cust-1',
        customerName: 'Cliente Teste',
        totalCents: 10000,
        receivedCents: 0,
        dueDateISO: '2026-12-31',
        status: 'PENDING',
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
      },
      {
        id: 'receivable-2',
        organizationId: 'org-1',
        orderId: 'order-2',
        orderNumber: 'PED-002',
        customerId: 'cust-2',
        customerName: 'Cliente 2',
        totalCents: 5000,
        receivedCents: 0,
        dueDateISO: '2026-12-31',
        status: 'PENDING',
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
      },
    ],
    payables: [
      {
        id: 'payable-1',
        organizationId: 'org-1',
        purchaseOrderId: 'po-1',
        purchaseOrderNumber: 'PC-001',
        supplierId: 'sup-1',
        supplierName: 'Fornecedor Teste',
        description: 'Chapas PS',
        totalCents: 8000,
        paidCents: 0,
        dueDateISO: '2026-12-31',
        status: 'PENDING',
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
      },
    ],
    financialIndicators: {
      totalReceivableCents: 15000,
      totalReceivedCents: 0,
      totalOverdueCents: 0,
      openBalanceCents: 15000,
      pendingCount: 2,
    },
    financialSettlements: [],
    receivablePayments: [],
    registerReceivablePayment: vi.fn(),
    registerPayableSettlement: vi.fn(),
    ...overrides,
  };
}

describe('E9-07: Idempotência de Pagamento e Preservação de Key em Retries (FinancialPage)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('A & B. Reutiliza a MESMA idempotencyKey ao repetir tentativa (retry) após erro de submissão', async () => {
    const registerMock = vi.fn()
      .mockRejectedValueOnce(new Error('Falha de rede temporária'))
      .mockResolvedValueOnce(undefined);

    context.value = buildFinancialContext({ registerReceivablePayment: registerMock });
    render(<FinancialPage />);

    // Abre o modal de pagamento do primeiro título
    const payButtons = screen.getAllByRole('button', { name: 'Registrar pagamento' });
    fireEvent.click(payButtons[0]);

    // Preenche o valor: R$ 50,00 (5000 cents)
    const amountInput = screen.getByPlaceholderText('0,00');
    fireEvent.change(amountInput, { target: { value: '50,00' } });

    // 1ª tentativa -> falha
    const submitBtn = screen.getByRole('button', { name: 'Confirmar pagamento' });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(registerMock).toHaveBeenCalledTimes(1);
    });

    const firstCallKey = registerMock.mock.calls[0][0].idempotencyKey;
    expect(firstCallKey).toMatch(/^settle:receivable-1:/);

    // Erro é exibido na UI
    expect(await screen.findByRole('alert')).toHaveTextContent('Falha de rede temporária');

    // 2ª tentativa (retry no mesmo modal com mesmos dados) -> deve preservar a MESMA chave
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar pagamento' }));

    await waitFor(() => {
      expect(registerMock).toHaveBeenCalledTimes(2);
    });

    const secondCallKey = registerMock.mock.calls[1][0].idempotencyKey;
    expect(secondCallKey).toBe(firstCallKey);
  });

  it('C & D. Gera uma NOVA chave ao abrir outra operação lógica após fechar/concluir o modal', async () => {
    const registerMock = vi.fn().mockResolvedValue(undefined);
    context.value = buildFinancialContext({ registerReceivablePayment: registerMock });
    render(<FinancialPage />);

    // 1ª operação lógica no receivable-1
    const payButtons = screen.getAllByRole('button', { name: 'Registrar pagamento' });
    fireEvent.click(payButtons[0]);
    fireEvent.change(screen.getByPlaceholderText('0,00'), { target: { value: '20,00' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar pagamento' }));

    await waitFor(() => {
      expect(registerMock).toHaveBeenCalledTimes(1);
    });
    const key1 = registerMock.mock.calls[0][0].idempotencyKey;

    // Modal fechou com sucesso. Agora abre 2ª operação lógica no receivable-2
    const freshPayButtons = screen.getAllByRole('button', { name: 'Registrar pagamento' });
    fireEvent.click(freshPayButtons[1]);
    fireEvent.change(screen.getByPlaceholderText('0,00'), { target: { value: '30,00' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar pagamento' }));

    await waitFor(() => {
      expect(registerMock).toHaveBeenCalledTimes(2);
    });
    const key2 = registerMock.mock.calls[1][0].idempotencyKey;

    expect(key1).not.toBe(key2);
    expect(key2).toMatch(/^settle:receivable-2:/);
  });

  it('F. Altera a chave se o usuário modificar os dados (payload) após uma tentativa que falhou', async () => {
    const registerMock = vi.fn()
      .mockRejectedValueOnce(new Error('Erro de validação'))
      .mockResolvedValueOnce(undefined);

    context.value = buildFinancialContext({ registerReceivablePayment: registerMock });
    render(<FinancialPage />);

    // Abre o modal de pagamento do primeiro título
    const payButtons = screen.getAllByRole('button', { name: 'Registrar pagamento' });
    fireEvent.click(payButtons[0]);

    // Preenche valor inicial: R$ 40,00
    const amountInput = screen.getByPlaceholderText('0,00');
    fireEvent.change(amountInput, { target: { value: '40,00' } });

    // 1ª tentativa
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar pagamento' }));
    await waitFor(() => {
      expect(registerMock).toHaveBeenCalledTimes(1);
    });
    const keyAttempt1 = registerMock.mock.calls[0][0].idempotencyKey;

    // Usuário altera o valor para R$ 60,00 antes de tentar novamente (mudança de intenção/payload)
    fireEvent.change(amountInput, { target: { value: '60,00' } });

    // 2ª tentativa -> deve gerar NOVA chave para o novo payload e evitar conflito de idempotência
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar pagamento' }));
    await waitFor(() => {
      expect(registerMock).toHaveBeenCalledTimes(2);
    });
    const keyAttempt2 = registerMock.mock.calls[1][0].idempotencyKey;

    expect(keyAttempt2).not.toBe(keyAttempt1);
    expect(registerMock.mock.calls[1][0].amountCents).toBe(6000);
  });
});
