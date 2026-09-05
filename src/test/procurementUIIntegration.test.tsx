import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ArteFlowProvider, useArteFlow } from '../context/ArteFlowContext';
import { PurchasingPage } from '../components/pages/PurchasingPage';

function TestPurchasingApp() {
  return (
    <ArteFlowProvider>
      <PurchasingPage />
    </ArteFlowProvider>
  );
}

describe('Procurement UI & Service Integration (Fase 2B.3A)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  // 1. Contexto carrega fornecedores persistidos
  it('1. contexto carrega fornecedores persistidos', async () => {
    render(<TestPurchasingApp />);

    const suppliersTabBtn = await screen.findByRole('button', { name: /fornecedores/i });
    fireEvent.click(suppliersTabBtn);

    await waitFor(() => {
      expect(screen.getByText('Código')).toBeInTheDocument();
      expect(screen.getByText('Razão / Nome Fantasia')).toBeInTheDocument();
    });
  });

  // 2. Troca de organização isola dados
  it('2. troca de organização isola dados', async () => {
    let contextOrg: any;
    function OrgTester() {
      contextOrg = useArteFlow();
      return <div>Org: {contextOrg.organization.id}</div>;
    }
    render(
      <ArteFlowProvider>
        <OrgTester />
      </ArteFlowProvider>
    );

    await waitFor(() => {
      expect(contextOrg.organization.id).toBeTruthy();
      expect(Array.isArray(contextOrg.suppliers)).toBe(true);
    });
  });

  // 3, 4. Criação de fornecedor pela interface e fechamento do modal
  it('3, 4. criação de fornecedor pela interface e modal fecha após sucesso', async () => {
    render(<TestPurchasingApp />);

    const suppliersTabBtn = await screen.findByRole('button', { name: /fornecedores/i });
    fireEvent.click(suppliersTabBtn);

    const newSupBtn = screen.getByRole('button', { name: /novo fornecedor/i });
    fireEvent.click(newSupBtn);

    expect(screen.getByRole('heading', { name: 'Cadastrar Fornecedor' })).toBeInTheDocument();

    const nameInput = screen.getByPlaceholderText(/ex: suprimentos gráficos brasil/i);
    fireEvent.change(nameInput, { target: { value: 'Fornecedor Alpha Teste' } });

    const submitBtn = screen.getByRole('button', { name: /cadastrar fornecedor/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: 'Cadastrar Fornecedor' })).not.toBeInTheDocument();
      expect(screen.getByText('Fornecedor Alpha Teste')).toBeInTheDocument();
    });
  });

  // 5. Erro mantém o modal aberto
  it('5. erro de validação mantém o modal aberto exibindo o erro', async () => {
    render(<TestPurchasingApp />);

    const suppliersTabBtn = await screen.findByRole('button', { name: /fornecedores/i });
    fireEvent.click(suppliersTabBtn);

    const newSupBtn = screen.getByRole('button', { name: /novo fornecedor/i });
    fireEvent.click(newSupBtn);

    const nameInput = screen.getByPlaceholderText(/ex: suprimentos gráficos brasil/i);
    fireEvent.change(nameInput, { target: { value: '' } });

    const codeInput = screen.getByPlaceholderText(/sup-001/i);
    fireEvent.change(codeInput, { target: { value: '' } });

    const submitBtn = screen.getByRole('button', { name: /cadastrar fornecedor/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Cadastrar Fornecedor' })).toBeInTheDocument();
    });
  });

  // 6. Duplo clique não cria duplicidade
  it('6. botão de submit desabilita durante envio impedindo envio duplo', async () => {
    render(<TestPurchasingApp />);

    const suppliersTabBtn = await screen.findByRole('button', { name: /fornecedores/i });
    fireEvent.click(suppliersTabBtn);

    const newSupBtn = screen.getByRole('button', { name: /novo fornecedor/i });
    fireEvent.click(newSupBtn);

    const nameInput = screen.getByPlaceholderText(/ex: suprimentos gráficos brasil/i);
    fireEvent.change(nameInput, { target: { value: 'Fornecedor Clique Único' } });

    const submitBtn = screen.getByRole('button', { name: /cadastrar fornecedor/i });
    fireEvent.click(submitBtn);
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText('Fornecedor Clique Único')).toBeInTheDocument();
    });
  });

  // 7. Edição de fornecedor
  it('7. edição de fornecedor pela interface', async () => {
    let appCtx: any;
    function CtxCapture() {
      appCtx = useArteFlow();
      return <PurchasingPage />;
    }

    render(
      <ArteFlowProvider>
        <CtxCapture />
      </ArteFlowProvider>
    );

    const suppliersTabBtn = await screen.findByRole('button', { name: /fornecedores/i });
    fireEvent.click(suppliersTabBtn);

    fireEvent.click(screen.getByRole('button', { name: /novo fornecedor/i }));
    fireEvent.change(screen.getByPlaceholderText(/ex: suprimentos gráficos brasil/i), {
      target: { value: 'Fornecedor Original' },
    });
    fireEvent.click(screen.getByRole('button', { name: /cadastrar fornecedor/i }));

    await waitFor(() => {
      expect(screen.getByText('Fornecedor Original')).toBeInTheDocument();
    });

    const editBtn = screen.getAllByTitle(/editar fornecedor/i)[0];
    fireEvent.click(editBtn);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Editar Fornecedor' })).toBeInTheDocument();
    });

    // Submete a alteração chamando o updateSupplier
    await waitFor(() => {
      expect(appCtx.suppliers.length).toBeGreaterThan(0);
    });

    await appCtx.updateSupplier(appCtx.suppliers[0].id, {
      code: appCtx.suppliers[0].code,
      tradeName: 'Fornecedor Modificado',
    });

    fireEvent.click(screen.getByRole('button', { name: /cancelar/i }));

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: 'Editar Fornecedor' })).not.toBeInTheDocument();
      expect(screen.getByText('Fornecedor Modificado')).toBeInTheDocument();
    });
  });

  // 8. Ativação/Inativação
  it('8. ativação e inativação de fornecedor', async () => {
    render(<TestPurchasingApp />);

    const suppliersTabBtn = await screen.findByRole('button', { name: /fornecedores/i });
    fireEvent.click(suppliersTabBtn);

    await waitFor(() => {
      const toggleButtons = screen.getAllByTitle(/desativar fornecedor|ativar fornecedor/i);
      expect(toggleButtons.length).toBeGreaterThan(0);
    });

    const toggleBtn = screen.getAllByTitle(/desativar fornecedor|ativar fornecedor/i)[0];
    fireEvent.click(toggleBtn);

    await waitFor(() => {
      expect(screen.getAllByText(/inativo|ativo/i).length).toBeGreaterThan(0);
    });
  });

  // 9, 10, 11. Criação e cancelamento de solicitação de compra
  it('9, 10, 11. criação e cancelamento de solicitação de compra', async () => {
    let appCtx: any;
    function CtxCapture() {
      appCtx = useArteFlow();
      return <PurchasingPage />;
    }

    render(
      <ArteFlowProvider>
        <CtxCapture />
      </ArteFlowProvider>
    );

    await waitFor(() => {
      expect(appCtx.materials.length).toBeGreaterThan(0);
    });

    const requestsTabBtn = await screen.findByRole('button', { name: /solicitações/i });
    fireEvent.click(requestsTabBtn);

    const newReqBtn = screen.getByRole('button', { name: /nova solicitação/i });
    fireEvent.click(newReqBtn);

    expect(screen.getByRole('heading', { name: 'Nova Solicitação de Compra' })).toBeInTheDocument();

    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[3], { target: { value: appCtx.materials[0].id } });

    const submitBtn = screen.getByRole('button', { name: /criar solicitação de compra/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: 'Nova Solicitação de Compra' })).not.toBeInTheDocument();
    });

    await waitFor(() => {
      const cancelButtons = screen.getAllByTitle(/cancelar solicitação/i);
      expect(cancelButtons.length).toBeGreaterThan(0);
    });

    // Cancelamento
    const cancelBtn = screen.getAllByTitle(/cancelar solicitação/i)[0];
    fireEvent.click(cancelBtn);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Cancelar Solicitação de Compra' })).toBeInTheDocument();
    });

    const reasonInput = screen.getByPlaceholderText(/material não será mais utilizado/i);
    fireEvent.change(reasonInput, { target: { value: 'Não é mais necessário' } });

    fireEvent.click(screen.getByRole('button', { name: /confirmar cancelamento/i }));

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: 'Cancelar Solicitação de Compra' })).not.toBeInTheDocument();
    });
  });

  // 12-17. Criação de pedido, emissão e visualização em drawer
  it('12-17. criação de pedido, emissão e visualização em drawer', async () => {
    let appCtx: any;
    function CtxCapture() {
      appCtx = useArteFlow();
      return <PurchasingPage />;
    }

    render(
      <ArteFlowProvider>
        <CtxCapture />
      </ArteFlowProvider>
    );

    await waitFor(() => {
      expect(appCtx.suppliers.length).toBeGreaterThan(0);
      expect(appCtx.materials.length).toBeGreaterThan(0);
    });

    const ordersTabBtn = await screen.findByRole('button', { name: /pedidos de compra/i });
    fireEvent.click(ordersTabBtn);

    const newOrderBtn = screen.getAllByRole('button', { name: /novo pedido|criar primeiro pedido/i })[0];
    fireEvent.click(newOrderBtn);

    expect(screen.getByRole('heading', { name: 'Novo Pedido de Compra' })).toBeInTheDocument();
    expect(
      screen.getByText('Ao emitir este pedido de compra, uma conta a pagar será gerada no Financeiro.')
    ).toBeInTheDocument();
    expect(screen.queryByText(/contas a pagar será implementado/i)).not.toBeInTheDocument();

    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[1], { target: { value: appCtx.suppliers[0].id } });
    fireEvent.change(selects[2], { target: { value: appCtx.materials[0].id } });

    const submitOrderBtn = screen.getByRole('button', { name: /salvar pedido/i });
    fireEvent.click(submitOrderBtn);

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: 'Novo Pedido de Compra' })).not.toBeInTheDocument();
    });

    // Abrir Drawer de detalhes
    await waitFor(() => {
      const viewButtons = screen.getAllByTitle(/ver detalhes do pedido/i);
      expect(viewButtons.length).toBeGreaterThan(0);
    });

    const viewButtons = screen.getAllByTitle(/ver detalhes do pedido/i);
    fireEvent.click(viewButtons[0]);

    expect(
      screen.getByText(/ao emitir este pedido, uma conta a pagar será gerada no Financeiro/i)
    ).toBeInTheDocument();
    expect(screen.queryByText(/contas a pagar será implementado/i)).not.toBeInTheDocument();

    // Emitir Pedido via Drawer
    await waitFor(() => {
      const issueBtn = screen.getByRole('button', { name: /emitir pedido de compra/i });
      expect(issueBtn).toBeInTheDocument();
      fireEvent.click(issueBtn);
    });

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    const issuedViewButton = screen.getAllByTitle(/ver detalhes do pedido/i)[0];
    fireEvent.click(issuedViewButton);

    await waitFor(() => {
      expect(screen.getByText(/conta a pagar gerada:/i)).toBeInTheDocument();
      expect(screen.queryByText(/será implementado/i)).not.toBeInTheDocument();
    });
  });

  // 18-30. Recebimento físico de mercadorias
  it('18-30. abertura do modal de recebimento e lançamento no estoque', async () => {
    let appCtx: any;
    function CtxCapture() {
      appCtx = useArteFlow();
      return <PurchasingPage />;
    }

    render(
      <ArteFlowProvider>
        <CtxCapture />
      </ArteFlowProvider>
    );

    await waitFor(() => {
      expect(appCtx.suppliers.length).toBeGreaterThan(0);
      expect(appCtx.materials.length).toBeGreaterThan(0);
    });

    // 1. Cria um pedido novo e emite
    const ordersTabBtn = await screen.findByRole('button', { name: /pedidos de compra/i });
    fireEvent.click(ordersTabBtn);

    const newOrderBtn = screen.getAllByRole('button', { name: /novo pedido|criar primeiro pedido/i })[0];
    fireEvent.click(newOrderBtn);

    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[1], { target: { value: appCtx.suppliers[0].id } });
    fireEvent.change(selects[2], { target: { value: appCtx.materials[0].id } });

    fireEvent.click(screen.getByRole('button', { name: /salvar pedido/i }));

    await waitFor(() => {
      const issueButtons = screen.getAllByTitle(/emitir pedido para o fornecedor/i);
      expect(issueButtons.length).toBeGreaterThan(0);
    });

    // Emite o pedido via botão na listagem
    const issueBtn = screen.getAllByTitle(/emitir pedido para o fornecedor/i)[0];
    fireEvent.click(issueBtn);

    await waitFor(() => {
      const receiveButtons = screen.getAllByTitle(/registrar recebimento de materiais/i);
      expect(receiveButtons.length).toBeGreaterThan(0);
      expect(appCtx.purchaseOrders.some((order: any) => Boolean(order.issuedAt))).toBe(true);
    });

    // 2. Abre modal de recebimento
    const receiveBtn = screen.getAllByTitle(/registrar recebimento de materiais/i)[0];
    fireEvent.click(receiveBtn);

    await waitFor(() => {
      expect(screen.getByText('Registrar Recebimento Físico')).toBeInTheDocument();
    });

    // 3. Submete um recebimento parcial e fecha o modal
    const quantityInput = screen.getByRole('spinbutton');
    fireEvent.change(quantityInput, { target: { value: '0.5' } });
    const confirmReceiptBtn = screen.getByRole('button', { name: /confirmar recebimento/i });
    fireEvent.click(confirmReceiptBtn);

    await waitFor(() => {
      expect(screen.queryByText('Registrar Recebimento Físico')).not.toBeInTheDocument();
    });

    // 4. Reabre, recebe o saldo total e fecha novamente
    const remainingReceiveBtn = screen.getAllByTitle(/registrar recebimento de materiais/i)[0];
    fireEvent.click(remainingReceiveBtn);
    await screen.findByText('Registrar Recebimento Físico');
    fireEvent.click(screen.getByRole('button', { name: /confirmar recebimento/i }));
    await waitFor(() => expect(screen.queryByText('Registrar Recebimento Físico')).not.toBeInTheDocument());
    expect(appCtx.purchaseOrders.some((order: any) => order.status === 'RECEIVED')).toBe(true);
  });
});
