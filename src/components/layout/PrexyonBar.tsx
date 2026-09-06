import React, { useEffect, useRef, useState } from 'react';
import { Bell, Building2, Check, ChevronDown, HelpCircle, LockKeyhole } from 'lucide-react';
import { useArteFlow } from '../../context/ArteFlowContext';

const products = [
  { name: 'OrçaGraf', description: 'Orçamentos e gestão comercial', color: 'from-emerald-500 to-green-600', available: false },
  { name: 'ArteFlow', description: 'Produção e operação gráfica', color: 'from-sky-500 to-cyan-400', available: true },
  { name: 'ArteCheck', description: 'Conferência e pré-impressão', color: 'from-violet-500 to-fuchsia-500', available: false },
];

export const PrexyonBar: React.FC = () => {
  const { organization } = useArteFlow();
  const [isSwitcherOpen, setIsSwitcherOpen] = useState(false);
  const switcherRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!switcherRef.current?.contains(event.target as Node)) setIsSwitcherOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  return (
    <header className="relative z-40 flex h-[72px] shrink-0 items-center justify-between bg-[#031225] px-4 text-white shadow-lg shadow-slate-950/10 sm:px-6 lg:px-8">
      <div className="flex min-w-0 items-center gap-3 sm:gap-5">
        <span className="rounded-lg bg-white px-2 py-1">
          <img src="/brand/prexyon-color.png" alt="Prexyon" className="h-7 w-[120px] object-contain object-left sm:h-8 sm:w-[138px]" />
        </span>

        <div className="hidden h-8 w-px bg-white/25 md:block" />

        <button
          type="button"
          className="hidden items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-sky-400 md:flex"
          title="Organização ativa"
        >
          <Building2 className="h-4 w-4 text-sky-400" />
          <span className="max-w-[210px] truncate">{organization.name}</span>
          <ChevronDown className="h-4 w-4 text-white/75" />
        </button>

        <div className="relative" ref={switcherRef}>
          <button
            type="button"
            onClick={() => setIsSwitcherOpen((open) => !open)}
            aria-expanded={isSwitcherOpen}
            aria-haspopup="menu"
            aria-label="Produto selecionado: ArteFlow"
            className="flex items-center gap-2.5 sm:gap-3 rounded-xl border border-white/25 bg-white/[0.04] px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm font-semibold shadow-inner transition hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-sky-400"
          >
            <span className="flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-lg border border-sky-400/70 bg-sky-500/15 text-[11px] sm:text-xs font-black text-sky-300">
              AF
            </span>
            <span>ArteFlow</span>
            <ChevronDown className={`h-3.5 w-3.5 sm:h-4 sm:w-4 text-white/75 transition ${isSwitcherOpen ? 'rotate-180' : ''}`} />
          </button>

          {isSwitcherOpen && (
            <div role="menu" className="absolute left-0 top-14 w-[310px] max-w-[calc(100vw-24px)] overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 text-slate-900 shadow-2xl shadow-slate-950/20 z-50">
              <div className="px-2 pb-2 pt-1">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Aplicativos Prexyon</p>
                <p className="mt-0.5 text-xs text-slate-500">Troque de produto sem sair do ecossistema.</p>
              </div>
              <div className="space-y-1">
                {products.map((product) => (
                  <button
                    key={product.name}
                    type="button"
                    role="menuitem"
                    disabled={!product.available}
                    className="group flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left transition enabled:hover:bg-slate-50 disabled:cursor-not-allowed"
                  >
                    <span className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${product.color} text-sm font-black text-white shadow-sm`}>
                      {product.name.slice(0, 1)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2 text-sm font-bold text-slate-800">
                        {product.name}
                        {product.available && <Check className="h-3.5 w-3.5 text-sky-600" />}
                      </span>
                      <span className="block truncate text-[11px] text-slate-500">{product.description}</span>
                    </span>
                    {!product.available && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-slate-500">
                        <LockKeyhole className="h-2.5 w-2.5" /> Em breve
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1 sm:gap-2">
        <button
          type="button"
          aria-label="Ajuda"
          className="hidden rounded-lg px-3 py-2 text-sm font-medium hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-sky-400 lg:block"
        >
          Ajuda
        </button>
        <button
          type="button"
          aria-label="Central de ajuda"
          className="rounded-full p-2 text-white/90 hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-sky-400"
        >
          <HelpCircle className="h-6 w-6" />
        </button>
        <button
          type="button"
          aria-label="Notificações"
          className="relative rounded-full p-2 text-white/90 hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-sky-400"
        >
          <Bell className="h-6 w-6" />
          <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-sky-400 ring-2 ring-[#031225]" />
        </button>
        <div
          className="ml-1 flex h-10 w-10 items-center justify-center rounded-full bg-white font-bold text-slate-900 ring-2 ring-white/10 shadow-sm"
          title="Carlos Oliveira"
        >
          CO
        </div>
      </div>
    </header>
  );
};
