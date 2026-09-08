import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ArteFlowProvider, useArteFlow } from '../context/ArteFlowContext';
import { HelpCenterModal } from '../components/help/HelpCenterModal';
import { PrexyonBar } from '../components/layout/PrexyonBar';
import { DEMO_ORGANIZATION } from '../domain/seed';
import { DEMO_USERS } from '../domain/constants';

const TestAppWrapper: React.FC = () => {
  const { setIsHelpModalOpen } = useArteFlow();
  return (
    <div>
      <PrexyonBar />
      <button onClick={() => setIsHelpModalOpen(true)}>Abrir Manual Externo</button>
      <HelpCenterModal />
    </div>
  );
};

describe('ArteFlow — Central de Ajuda, Mini Manual e Relato de Suporte', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  const renderWithContext = () => {
    return render(
      <ArteFlowProvider
        identity={{
          organization: DEMO_ORGANIZATION,
          currentUser: DEMO_USERS[0],
        }}
        allowDemoData={true}
      >
        <TestAppWrapper />
      </ArteFlowProvider>
    );
  };

  it('A. Botão de Ajuda na Global Bar abre a Central de Ajuda', () => {
    renderWithContext();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    const helpBtn = screen.getByRole('button', { name: /central de ajuda arteflow/i });
    fireEvent.click(helpBtn);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/central de ajuda arteflow/i)).toBeInTheDocument();
  });

  it('B. Modal fecha corretamente pelo botão X ou Fechar', () => {
    renderWithContext();
    const helpBtn = screen.getByRole('button', { name: /central de ajuda arteflow/i });
    fireEvent.click(helpBtn);
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    const closeBtn = screen.getByRole('button', { name: /fechar central de ajuda/i });
    fireEvent.click(closeBtn);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('C. Mini manual contém abas e não afirma que importação automática OrçaGraf nem comissões existem', () => {
    renderWithContext();
    fireEvent.click(screen.getByRole('button', { name: /central de ajuda arteflow/i }));

    // Aba Pedidos
    fireEvent.click(screen.getByRole('button', { name: /pedidos/i }));
    expect(screen.getByText(/importação automatizada direta do orçagraf está em desenvolvimento/i)).toBeInTheDocument();

    // Aba Financeiro
    fireEvent.click(screen.getByRole('button', { name: /financeiro/i }));
    expect(screen.getByText(/comissões de vendedores e operadores está previsto para a fase seguinte/i)).toBeInTheDocument();
  });

  it('D. Busca pesquisa entre os tópicos do manual em tempo real', () => {
    renderWithContext();
    fireEvent.click(screen.getByRole('button', { name: /central de ajuda arteflow/i }));

    const searchInput = screen.getByPlaceholderText(/buscar em todo o manual/i);
    fireEvent.change(searchInput, { target: { value: 'Kanban' } });

    expect(screen.getByText(/3\. Chão de Fábrica e Quadro Kanban de Produção/i)).toBeInTheDocument();
  });

  it('E. Formulário de suporte exige tipo, título e descrição', async () => {
    renderWithContext();
    fireEvent.click(screen.getByRole('button', { name: /central de ajuda arteflow/i }));

    fireEvent.click(screen.getByRole('button', { name: /relatar problema/i }));

    const submitBtn = screen.getByRole('button', { name: /gerar relatório de suporte/i });
    fireEvent.click(submitBtn);

    expect(screen.getByText(/informe um título claro para o relato/i)).toBeInTheDocument();
    expect(screen.getByText(/descreva os detalhes do relato/i)).toBeInTheDocument();
  });

  it('F. Gera relatório estruturado sem expor tokens ou credenciais e permite cópia', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
      },
    });

    renderWithContext();
    fireEvent.click(screen.getByRole('button', { name: /central de ajuda arteflow/i }));
    fireEvent.click(screen.getByRole('button', { name: /relatar problema/i }));

    const titleInput = screen.getByPlaceholderText(/botão de impressão travou/i);
    fireEvent.change(titleInput, { target: { value: 'Erro ao imprimir OP' } });

    const descInput = screen.getByPlaceholderText(/descreva claramente o que você estava tentando fazer/i);
    fireEvent.change(descInput, { target: { value: 'Ao clicar no botão de impressão a tela piscou e não gerou PDF.' } });

    const submitBtn = screen.getByRole('button', { name: /gerar relatório de suporte/i });
    fireEvent.click(submitBtn);

    // Valida que o relatório gerado é exibido
    const reportPre = screen.getByText(/ARTEFLOW — RELATO/i);
    expect(reportPre).toBeInTheDocument();
    expect(reportPre.textContent).toContain('TÍTULO: Erro ao imprimir OP');
    expect(reportPre.textContent).toContain('ORGANIZAÇÃO: Gráfica & Visual Express (Demo)');
    expect(reportPre.textContent).not.toContain('access_token');
    expect(reportPre.textContent).not.toContain('refresh_token');
    expect(reportPre.textContent).not.toContain('secret');

    // Botão Copiar
    const copyBtn = screen.getByRole('button', { name: /copiar relatório/i });
    fireEvent.click(copyBtn);

    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalled();
      expect(screen.getByText(/copiado para área de transferência/i)).toBeInTheDocument();
    });
  });
});
