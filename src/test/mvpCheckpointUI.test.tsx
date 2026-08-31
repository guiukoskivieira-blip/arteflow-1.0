import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import App from '../App';

describe('Checkpoint visual e financeiro do MVP', () => {
  beforeEach(() => localStorage.clear());

  it('remove referências visuais internas a fases do menu e módulos', async () => {
    render(<App />);
    await screen.findByText('ArteFlow');
    expect(screen.queryByText(/Fase 1 — Standalone/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Fase 2A?$/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^Estoque$/i }));
    expect((await screen.findAllByText(/Estoque de Materiais/i)).length).toBeGreaterThan(0);
    expect(screen.queryByText(/^Fase 2A$/i)).not.toBeInTheDocument();
  });

  it('apresenta Expedição profissionalmente como Em breve', async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: /^Expedição$/i }));
    expect(await screen.findByText('Em breve')).toBeInTheDocument();
    expect(screen.queryByText(/módulo planejado para a fase/i)).not.toBeInTheDocument();
  });

  it('renderiza financeiro operacional responsivo com contas e indicadores reais', async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: /^Financeiro$/i }));
    expect(await screen.findByTestId('financial-page')).toHaveClass('p-4', 'md:p-6');
    await waitFor(() => expect(screen.getByText('Total a receber')).toBeInTheDocument());
    expect(screen.getByText('Saldo em aberto')).toBeInTheDocument();
    expect(screen.getByRole('table')).toBeInTheDocument();
  });
});
