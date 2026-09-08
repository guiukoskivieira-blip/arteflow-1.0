import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import App from '../App';

describe('Shell visual Prexyon e ArteFlow', () => {
  beforeEach(() => localStorage.clear());

  it('renderiza as marcas oficiais e preserva o aplicativo ativo', async () => {
    render(<App />);

    expect(await screen.findByAltText('Prexyon')).toHaveAttribute('src', '/brand/prexyon-color.png');
    expect(screen.getByAltText('ArteFlow — Gestão da Produção')).toHaveAttribute('src', '/brand/arteflow-white.png');
    expect(screen.getByRole('button', { name: /produto selecionado: arteflow/i })).toHaveAttribute('aria-expanded', 'false');
  });

  it('abre o seletor do ecossistema e exibe opções', async () => {
    render(<App />);

    const switcher = await screen.findByRole('button', { name: /produto selecionado: arteflow/i });
    fireEvent.click(switcher);

    expect(switcher).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /OrçaGraf/i })).toBeEnabled();
    expect(screen.getByRole('menuitem', { name: /ArteCheck/i })).toBeEnabled();
    expect(screen.getByRole('menuitem', { name: /ArteFlow/i })).toBeDisabled();
  });
});

