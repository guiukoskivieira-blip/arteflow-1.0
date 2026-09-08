import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrexyonBar } from '../components/layout/PrexyonBar';
import { ArteFlowProvider } from '../context/ArteFlowContext';
import * as runtimeConfig from '../config/runtime';
import * as supabaseClient from '../services/supabaseClient';
import * as prexyonSsoService from '../services/prexyonSsoService';
import { DEMO_ORGANIZATION } from '../domain/seed';
import { DEMO_USERS } from '../domain/constants';

describe('Global Bar P2-04 Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  const renderPrexyonBar = (customConfig?: any) => {
    if (customConfig) {
      vi.spyOn(runtimeConfig, 'getArteFlowRuntimeConfig').mockReturnValue(customConfig);
    }
    return render(
      <ArteFlowProvider
        identity={{
          organization: DEMO_ORGANIZATION,
          currentUser: DEMO_USERS[0],
        }}
        allowDemoData={true}
      >
        <PrexyonBar />
      </ArteFlowProvider>
    );
  };

  it('A. Renderiza altura 72px e background #031225', () => {
    renderPrexyonBar();
    const header = screen.getByTestId('prexyon-global-bar');
    expect(header).toHaveClass('h-[72px]');
    expect(header).toHaveClass('bg-[#031225]');
  });

  it('B. Logo Prexyon é link com href para o portal e imagem oficial', () => {
    renderPrexyonBar({
      mode: 'connected',
      isDev: false,
      isProduction: true,
      supabaseUrl: 'https://test.supabase.co',
      supabaseKey: 'test-key',
      prexyonPortalUrl: 'https://portal.prexyon.test',
      arteFlowAppUrl: 'https://arteflow.prexyon.test',
      orcagrafAppUrl: 'https://orcagraf.prexyon.test',
      artecheckAppUrl: 'https://artecheck.prexyon.test',
      isSupabaseConfigured: true,
      callbackUrl: 'https://arteflow.prexyon.test/auth/prexyon',
    });

    const logoLink = screen.getByRole('link', { name: /portal prexyon/i });
    expect(logoLink).toHaveAttribute('href', 'https://portal.prexyon.test');

    const logoImg = screen.getByAltText('Prexyon');
    expect(logoImg).toHaveAttribute('src', '/brand/prexyon-color.png');
  });

  it('C. Seletor de produtos exibe OrçaGraf, ArteFlow (ativo), ArteCheck', () => {
    renderPrexyonBar();
    const switcher = screen.getByRole('button', { name: /produto selecionado: arteflow/i });
    expect(switcher).toBeInTheDocument();

    fireEvent.click(switcher);

    expect(screen.getByRole('menuitem', { name: /OrçaGraf/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /ArteFlow/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /ArteCheck/i })).toBeInTheDocument();

    // ArteFlow is active and disabled for clicking
    expect(screen.getByRole('menuitem', { name: /ArteFlow/i })).toBeDisabled();
  });

  it('D. Troca de produto chama generateSsoCodeForProduct e redireciona', async () => {
    const customConfig = {
      mode: 'connected' as const,
      isDev: false,
      isProduction: true,
      supabaseUrl: 'https://test.supabase.co',
      supabaseKey: 'test-key',
      prexyonPortalUrl: 'https://portal.prexyon.test',
      arteFlowAppUrl: 'https://arteflow.prexyon.test',
      orcagrafAppUrl: 'https://orcagraf.prexyon.test',
      artecheckAppUrl: 'https://artecheck.prexyon.test',
      isSupabaseConfigured: true,
      callbackUrl: 'https://arteflow.prexyon.test/auth/prexyon',
    };

    const mockSupabase = {
      rpc: vi.fn(),
    } as any;
    vi.spyOn(supabaseClient, 'getSupabaseClient').mockReturnValue(mockSupabase);

    const ssoSpy = vi.spyOn(prexyonSsoService, 'generateSsoCodeForProduct').mockResolvedValue('test_sso_code_123');

    const assignMock = vi.fn();
    delete (window as any).location;
    window.location = { assign: assignMock } as any;

    renderPrexyonBar(customConfig);
    const switcher = screen.getByRole('button', { name: /produto selecionado: arteflow/i });
    fireEvent.click(switcher);

    const arteCheckOption = screen.getByRole('menuitem', { name: /ArteCheck/i });
    fireEvent.click(arteCheckOption);

    await waitFor(() => {
      expect(ssoSpy).toHaveBeenCalledWith(mockSupabase, DEMO_ORGANIZATION.id, 'artecheck');
      expect(assignMock).toHaveBeenCalledWith(
        `https://artecheck.prexyon.test/auth/prexyon?code=test_sso_code_123&org=${encodeURIComponent(DEMO_ORGANIZATION.id)}`
      );
    });
  });

  it('E. Ajuda direciona para o Portal Prexyon', () => {
    renderPrexyonBar({
      mode: 'connected',
      isDev: false,
      isProduction: true,
      supabaseUrl: 'https://test.supabase.co',
      supabaseKey: 'test-key',
      prexyonPortalUrl: 'https://portal.prexyon.test',
      arteFlowAppUrl: 'https://arteflow.prexyon.test',
      orcagrafAppUrl: 'https://orcagraf.prexyon.test',
      artecheckAppUrl: 'https://artecheck.prexyon.test',
      isSupabaseConfigured: true,
      callbackUrl: 'https://arteflow.prexyon.test/auth/prexyon',
    });

    const helpLink = screen.getByRole('link', { name: /central de ajuda prexyon/i });
    expect(helpLink).toHaveAttribute('href', 'https://portal.prexyon.test');
  });

  it('F. Avatar abre menu de usuário e exibe botão de logout', () => {
    renderPrexyonBar();
    const avatarButton = screen.getByRole('button', { name: /menu do usu/i });
    expect(avatarButton).toBeInTheDocument();

    fireEvent.click(avatarButton);

    expect(screen.getByRole('menuitem', { name: /sair do arteflow/i })).toBeInTheDocument();
  });
});
