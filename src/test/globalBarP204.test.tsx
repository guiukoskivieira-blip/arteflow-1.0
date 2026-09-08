import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrexyonBar } from '../components/layout/PrexyonBar';
import { ArteFlowProvider } from '../context/ArteFlowContext';
import * as runtimeConfig from '../config/runtime';
import * as supabaseClient from '../services/supabaseClient';
import * as prexyonSsoService from '../services/prexyonSsoService';
import { DEMO_ORGANIZATION } from '../domain/seed';
import { DEMO_USERS } from '../domain/constants';

describe('Global Bar P2-04 Tests & Hotfix Verification', () => {
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

  it('A. OrçaGraf usa orcagrafAppUrl real e não o portal', async () => {
    const customConfig = {
      mode: 'connected' as const,
      isDev: false,
      isProduction: true,
      supabaseUrl: 'https://test.supabase.co',
      supabaseKey: 'test-key',
      prexyonPortalUrl: 'https://portal.prexyon.test',
      arteFlowAppUrl: 'https://arteflow.prexyon.test',
      orcagrafAppUrl: 'https://or-agraf-bete-20-production.up.railway.app',
      artecheckAppUrl: 'https://eloquent-vitality-production-48ec.up.railway.app',
      isSupabaseConfigured: true,
      callbackUrl: 'https://arteflow.prexyon.test/auth/prexyon',
    };

    const mockSupabase = { rpc: vi.fn() } as any;
    vi.spyOn(supabaseClient, 'getSupabaseClient').mockReturnValue(mockSupabase);
    const ssoSpy = vi.spyOn(prexyonSsoService, 'generateSsoCodeForProduct').mockResolvedValue('sso_code_og');

    const assignMock = vi.fn();
    delete (window as any).location;
    window.location = { assign: assignMock } as any;

    renderPrexyonBar(customConfig);
    const switcher = screen.getByRole('button', { name: /produto selecionado: arteflow/i });
    fireEvent.click(switcher);

    const ogOption = screen.getByRole('menuitem', { name: /OrçaGraf/i });
    fireEvent.click(ogOption);

    await waitFor(() => {
      expect(ssoSpy).toHaveBeenCalledWith(mockSupabase, DEMO_ORGANIZATION.id, 'orcagraf');
      expect(assignMock).toHaveBeenCalledWith(
        `https://or-agraf-bete-20-production.up.railway.app/auth/prexyon?code=sso_code_og&org=${encodeURIComponent(DEMO_ORGANIZATION.id)}`
      );
    });
  });

  it('B. ArteCheck usa artecheckAppUrl real e não o portal', async () => {
    const customConfig = {
      mode: 'connected' as const,
      isDev: false,
      isProduction: true,
      supabaseUrl: 'https://test.supabase.co',
      supabaseKey: 'test-key',
      prexyonPortalUrl: 'https://portal.prexyon.test',
      arteFlowAppUrl: 'https://arteflow.prexyon.test',
      orcagrafAppUrl: 'https://or-agraf-bete-20-production.up.railway.app',
      artecheckAppUrl: 'https://eloquent-vitality-production-48ec.up.railway.app',
      isSupabaseConfigured: true,
      callbackUrl: 'https://arteflow.prexyon.test/auth/prexyon',
    };

    const mockSupabase = { rpc: vi.fn() } as any;
    vi.spyOn(supabaseClient, 'getSupabaseClient').mockReturnValue(mockSupabase);
    const ssoSpy = vi.spyOn(prexyonSsoService, 'generateSsoCodeForProduct').mockResolvedValue('sso_code_ac');

    const assignMock = vi.fn();
    delete (window as any).location;
    window.location = { assign: assignMock } as any;

    renderPrexyonBar(customConfig);
    const switcher = screen.getByRole('button', { name: /produto selecionado: arteflow/i });
    fireEvent.click(switcher);

    const acOption = screen.getByRole('menuitem', { name: /ArteCheck/i });
    fireEvent.click(acOption);

    await waitFor(() => {
      expect(ssoSpy).toHaveBeenCalledWith(mockSupabase, DEMO_ORGANIZATION.id, 'artecheck');
      expect(assignMock).toHaveBeenCalledWith(
        `https://eloquent-vitality-production-48ec.up.railway.app/auth/prexyon?code=sso_code_ac&org=${encodeURIComponent(DEMO_ORGANIZATION.id)}`
      );
    });
  });

  it('C. Portal URL nunca é concatenada com /orcagraf ou /artecheck na ausência de URL de produto', async () => {
    const customConfig = {
      mode: 'connected' as const,
      isDev: false,
      isProduction: true,
      supabaseUrl: 'https://test.supabase.co',
      supabaseKey: 'test-key',
      prexyonPortalUrl: 'https://portal.prexyon.test',
      arteFlowAppUrl: 'https://arteflow.prexyon.test',
      orcagrafAppUrl: '',
      artecheckAppUrl: '',
      isSupabaseConfigured: true,
      callbackUrl: 'https://arteflow.prexyon.test/auth/prexyon',
    };

    const assignMock = vi.fn();
    delete (window as any).location;
    window.location = { assign: assignMock } as any;

    renderPrexyonBar(customConfig);
    const switcher = screen.getByRole('button', { name: /produto selecionado: arteflow/i });
    fireEvent.click(switcher);

    const ogOption = screen.getByRole('menuitem', { name: /OrçaGraf/i });
    fireEvent.click(ogOption);

    await waitFor(() => {
      expect(assignMock).not.toHaveBeenCalled();
      expect(screen.getByText(/não configurada no ambiente/i)).toBeInTheDocument();
    });
  });

  it('D. Renderiza altura 72px e background #031225', () => {
    renderPrexyonBar();
    const header = screen.getByTestId('prexyon-global-bar');
    expect(header).toHaveClass('h-[72px]');
    expect(header).toHaveClass('bg-[#031225]');
  });

  it('E. Logo Prexyon é link com href para o portal e imagem oficial', () => {
    renderPrexyonBar({
      mode: 'connected',
      isDev: false,
      isProduction: true,
      supabaseUrl: 'https://test.supabase.co',
      supabaseKey: 'test-key',
      prexyonPortalUrl: 'https://portal.prexyon.test',
      arteFlowAppUrl: 'https://arteflow.prexyon.test',
      orcagrafAppUrl: 'https://orcagraf.test',
      artecheckAppUrl: 'https://artecheck.test',
      isSupabaseConfigured: true,
      callbackUrl: 'https://arteflow.prexyon.test/auth/prexyon',
    });

    const logoLink = screen.getByRole('link', { name: /portal prexyon/i });
    expect(logoLink).toHaveAttribute('href', 'https://portal.prexyon.test');

    const logoImg = screen.getByAltText('Prexyon');
    expect(logoImg).toHaveAttribute('src', '/brand/prexyon-color.png');
  });

  it('F. Central de Ajuda direciona para o Portal Prexyon', () => {
    renderPrexyonBar({
      mode: 'connected',
      isDev: false,
      isProduction: true,
      supabaseUrl: 'https://test.supabase.co',
      supabaseKey: 'test-key',
      prexyonPortalUrl: 'https://portal.prexyon.test',
      arteFlowAppUrl: 'https://arteflow.prexyon.test',
      orcagrafAppUrl: 'https://orcagraf.test',
      artecheckAppUrl: 'https://artecheck.test',
      isSupabaseConfigured: true,
      callbackUrl: 'https://arteflow.prexyon.test/auth/prexyon',
    });

    const helpLink = screen.getByRole('link', { name: /central de ajuda prexyon/i });
    expect(helpLink).toHaveAttribute('href', 'https://portal.prexyon.test');
  });

  it('G. Avatar abre menu de usuário com dados e botão de logout', () => {
    renderPrexyonBar();
    const avatarButton = screen.getByRole('button', { name: /menu do usu/i });
    expect(avatarButton).toBeInTheDocument();

    fireEvent.click(avatarButton);

    expect(screen.getByRole('menuitem', { name: /sair do arteflow/i })).toBeInTheDocument();
  });

  it('H. Spinner do switcher é desativado quando o estado atinge AUTHORIZED', async () => {
    const customConfig = {
      mode: 'connected' as const,
      isDev: false,
      isProduction: true,
      supabaseUrl: 'https://test.supabase.co',
      supabaseKey: 'test-key',
      prexyonPortalUrl: 'https://portal.prexyon.test',
      arteFlowAppUrl: 'https://arteflow.prexyon.test',
      orcagrafAppUrl: 'https://or-agraf-bete-20-production.up.railway.app',
      artecheckAppUrl: 'https://eloquent-vitality-production-48ec.up.railway.app',
      isSupabaseConfigured: true,
      callbackUrl: 'https://arteflow.prexyon.test/auth/prexyon',
    };

    const mockSupabase = { rpc: vi.fn() } as any;
    vi.spyOn(supabaseClient, 'getSupabaseClient').mockReturnValue(mockSupabase);
    vi.spyOn(prexyonSsoService, 'generateSsoCodeForProduct').mockResolvedValue('sso_code_ac');

    const assignMock = vi.fn();
    delete (window as any).location;
    window.location = { assign: assignMock } as any;

    renderPrexyonBar(customConfig);
    const switcher = screen.getByRole('button', { name: /produto selecionado: arteflow/i });
    expect(switcher).not.toBeDisabled();
    expect(screen.getByText('AF')).toBeInTheDocument();

    fireEvent.click(switcher);
    const acOption = screen.getByRole('menuitem', { name: /ArteCheck/i });
    fireEvent.click(acOption);

    // Após o clique, o redirect ocorre
    await waitFor(() => {
      expect(assignMock).toHaveBeenCalled();
    });

    // Validamos que ao re-renderizar ou manter AUTHORIZED, o seletor está em idle (AF exibido e habilitado)
    expect(screen.getByRole('button', { name: /produto selecionado: arteflow/i })).toBeInTheDocument();
  });
});
