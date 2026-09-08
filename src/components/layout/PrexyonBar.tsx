import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Building2, Check, ChevronDown, HelpCircle, Loader2, LogOut, Shield } from 'lucide-react';
import { useArteFlow } from '../../context/ArteFlowContext';
import { useOptionalAuth } from '../../context/AuthContext';
import { getArteFlowRuntimeConfig } from '../../config/runtime';
import { getSupabaseClient } from '../../services/supabaseClient';
import { generateSsoCodeForProduct } from '../../services/prexyonSsoService';

type ProductCode = 'orcagraf' | 'arteflow' | 'artecheck';

interface ProductItem {
  code: ProductCode;
  name: string;
  badge: string;
  description: string;
  color: string;
  isActive: boolean;
}

const PRODUCTS: ProductItem[] = [
  {
    code: 'orcagraf',
    name: 'OrçaGraf',
    badge: 'OG',
    description: 'Orçamentos e gestão comercial',
    color: 'from-emerald-500 to-green-600',
    isActive: false,
  },
  {
    code: 'arteflow',
    name: 'ArteFlow',
    badge: 'AF',
    description: 'Produção e operação gráfica',
    color: 'from-sky-500 to-cyan-400',
    isActive: true,
  },
  {
    code: 'artecheck',
    name: 'ArteCheck',
    badge: 'AC',
    description: 'Conferência e pré-impressão',
    color: 'from-violet-500 to-fuchsia-500',
    isActive: false,
  },
];

function getInitials(name?: string): string {
  if (!name || !name.trim()) return 'U';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export const PrexyonBar: React.FC = () => {
  const config = useMemo(() => getArteFlowRuntimeConfig(), []);
  const auth = useOptionalAuth();
  const { organization, currentUser } = useArteFlow();

  const [isSwitcherOpen, setIsSwitcherOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [switchingProduct, setSwitchingProduct] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const switcherRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!switcherRef.current?.contains(target)) setIsSwitcherOpen(false);
      if (!userMenuRef.current?.contains(target)) setIsUserMenuOpen(false);
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const userName = auth?.tenant?.identity.name || currentUser.name || 'Usuário';
  const userEmail = auth?.tenant?.identity.email || currentUser.email || '';
  const userRole = auth?.tenant?.membership.role || currentUser.role || 'operator';
  const orgName = auth?.tenant?.organization.name || organization.name || 'Organização';
  const orgId = auth?.tenant?.organization.id || organization.id;

  const handleProductSwitch = async (targetProduct: ProductItem) => {
    if (targetProduct.isActive || switchingProduct) return;

    setErrorMessage(null);
    setSwitchingProduct(targetProduct.name);

    try {
      const supabase = getSupabaseClient();
      if (!supabase || !orgId) {
        throw new Error('Sessão Supabase indisponível para gerar troca segura de aplicativo.');
      }

      let targetBaseUrl = '';
      if (targetProduct.code === 'orcagraf') {
        targetBaseUrl = config.orcagrafAppUrl;
      } else if (targetProduct.code === 'artecheck') {
        targetBaseUrl = config.artecheckAppUrl;
      }

      if (!targetBaseUrl) {
        throw new Error(
          `URL do aplicativo ${targetProduct.name} não configurada no ambiente. Acesse pelo Portal Prexyon.`
        );
      }

      const ssoCode = await generateSsoCodeForProduct(supabase, orgId, targetProduct.code);
      const redirectUrl = `${targetBaseUrl}/auth/prexyon?code=${encodeURIComponent(ssoCode)}&org=${encodeURIComponent(orgId)}`;
      window.location.assign(redirectUrl);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Falha ao autenticar no produto de destino.');
      setSwitchingProduct(null);
    }
  };

  const handlePortalClick = (e: React.MouseEvent) => {
    if (config.prexyonPortalUrl) {
      e.preventDefault();
      window.location.assign(config.prexyonPortalUrl);
    }
  };

  const handleSignOut = async () => {
    setIsUserMenuOpen(false);
    if (auth?.signOut) {
      await auth.signOut();
    }
  };

  return (
    <header
      data-testid="prexyon-global-bar"
      className="relative z-40 flex h-[72px] shrink-0 items-center justify-between bg-[#031225] px-4 text-white shadow-lg shadow-slate-950/10 sm:px-6 lg:px-8"
    >
      {/* Left: Brand logo, Organization badge, Product Switcher */}
      <div className="flex min-w-0 items-center gap-3 sm:gap-5">
        <a
          href={config.prexyonPortalUrl || '#'}
          onClick={handlePortalClick}
          className="group flex items-center rounded-lg bg-white px-2 py-1 transition hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
          title="Ir para o Portal Prexyon"
          aria-label="Portal Prexyon"
        >
          <img
            src="/brand/prexyon-color.png"
            alt="Prexyon"
            className="h-7 w-[120px] object-contain object-left sm:h-8 sm:w-[138px]"
          />
        </a>

        <div className="hidden h-8 w-px bg-white/25 md:block" />

        <div
          className="hidden items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-medium text-slate-200 md:flex"
          title={`Organização: ${orgName}`}
        >
          <Building2 className="h-4 w-4 text-sky-400 flex-shrink-0" />
          <span className="max-w-[180px] truncate font-semibold">{orgName}</span>
          <span className="rounded bg-sky-500/20 px-1.5 py-0.5 text-[10px] font-bold text-sky-300 uppercase tracking-wider">
            {userRole}
          </span>
        </div>

        {/* Product Switcher */}
        <div className="relative" ref={switcherRef}>
          <button
            type="button"
            onClick={() => setIsSwitcherOpen((open) => !open)}
            disabled={Boolean(switchingProduct)}
            aria-expanded={isSwitcherOpen}
            aria-haspopup="menu"
            aria-label="Produto selecionado: ArteFlow"
            className="flex items-center gap-2.5 sm:gap-3 rounded-xl border border-white/25 bg-white/[0.04] px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm font-semibold shadow-inner transition hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-sky-400 disabled:opacity-60"
          >
            {switchingProduct ? (
              <Loader2 className="h-4 w-4 animate-spin text-sky-300" />
            ) : (
              <span className="flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-lg border border-sky-400/70 bg-sky-500/15 text-[11px] sm:text-xs font-black text-sky-300">
                AF
              </span>
            )}
            <span>ArteFlow</span>
            <ChevronDown
              className={`h-3.5 w-3.5 sm:h-4 sm:w-4 text-white/75 transition ${
                isSwitcherOpen ? 'rotate-180' : ''
              }`}
            />
          </button>

          {isSwitcherOpen && (
            <div
              role="menu"
              className="absolute left-0 top-14 w-[320px] max-w-[calc(100vw-24px)] overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 text-slate-900 shadow-2xl shadow-slate-950/20 z-50"
            >
              <div className="px-2 pb-2 pt-1">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                  Aplicativos Prexyon
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  Troque de produto com autenticação unificada SSO.
                </p>
              </div>

              {errorMessage && (
                <div className="mx-2 mb-2 rounded-lg bg-red-50 p-2 text-xs text-red-600 border border-red-200">
                  {errorMessage}
                </div>
              )}

              <div className="space-y-1">
                {PRODUCTS.map((product) => (
                  <button
                    key={product.name}
                    type="button"
                    role="menuitem"
                    disabled={Boolean(switchingProduct) || product.isActive}
                    onClick={() => void handleProductSwitch(product)}
                    className={`group flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left transition ${
                      product.isActive
                        ? 'bg-sky-50/80 cursor-default'
                        : 'hover:bg-slate-100 cursor-pointer'
                    }`}
                  >
                    <span
                      className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${product.color} text-xs font-black text-white shadow-sm`}
                    >
                      {product.badge}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2 text-sm font-bold text-slate-800">
                        {product.name}
                        {product.isActive && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-sky-700 bg-sky-100 px-1.5 py-0.5 rounded">
                            <Check className="h-3 w-3" /> Ativo
                          </span>
                        )}
                      </span>
                      <span className="block truncate text-[11px] text-slate-500">
                        {product.description}
                      </span>
                    </span>
                    {switchingProduct === product.name && (
                      <Loader2 className="h-4 w-4 animate-spin text-sky-600 flex-shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right: Help Center & User Avatar Menu */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Help Center */}
        <a
          href={config.prexyonPortalUrl || '#'}
          onClick={handlePortalClick}
          aria-label="Central de Ajuda Prexyon"
          title="Central de Ajuda Prexyon"
          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-200 hover:bg-white/10 hover:text-white transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
        >
          <HelpCircle className="h-5 w-5 text-slate-300" />
          <span className="hidden lg:inline">Ajuda</span>
        </a>

        {/* User Avatar with Dropdown Menu */}
        <div className="relative" ref={userMenuRef}>
          <button
            type="button"
            onClick={() => setIsUserMenuOpen((open) => !open)}
            aria-expanded={isUserMenuOpen}
            aria-haspopup="menu"
            aria-label={`Menu do usuário: ${userName}`}
            className="flex items-center gap-2 rounded-full ring-2 ring-white/20 hover:ring-sky-400 transition p-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
          >
            <div className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-white font-bold text-slate-900 shadow-sm text-xs sm:text-sm">
              {getInitials(userName)}
            </div>
          </button>

          {isUserMenuOpen && (
            <div
              role="menu"
              className="absolute right-0 top-12 w-64 rounded-2xl border border-slate-200 bg-white p-2 text-slate-900 shadow-2xl shadow-slate-950/20 z-50 animate-in fade-in zoom-in-95 duration-100"
            >
              <div className="border-b border-slate-100 px-3 py-2.5">
                <p className="text-sm font-bold text-slate-900 truncate">{userName}</p>
                {userEmail && <p className="text-xs text-slate-500 truncate">{userEmail}</p>}
                <div className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-sky-800 bg-sky-50 px-2 py-1 rounded-md border border-sky-100">
                  <Shield className="h-3.5 w-3.5 text-sky-600" />
                  <span>Perfil: {userRole}</span>
                </div>
              </div>

              <div className="pt-1">
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => void handleSignOut()}
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 transition text-left"
                >
                  <LogOut className="h-4 w-4 text-red-500" />
                  <span>Sair do ArteFlow</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

