import React, { useEffect, useRef, useState } from 'react';
import { Bell, Building2, Check, ChevronDown, Grid3X3, HelpCircle, LockKeyhole } from 'lucide-react';
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
    <header className="relative z-40 h-14 flex-shrink-0 border-b border-slate-800 bg-[#07192d] px-3 md:px-5 text-white shadow-[0_1px_0_rgba(255,255,255,0.04)]">
      <div className="mx-auto flex h-full w-full items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-[118px] items-center justify-center overflow-hidden rounded-lg bg-white px-2 shadow-sm sm:w-[132px]">
            <img src="/brand/prexyon-color.png" alt="Prexyon" className="h-full w-full object-contain" />
          </div>

          <div className="hidden h-6 w-px bg-white/10 sm:block" />

          <div className="relative" ref={switcherRef}>
            <button
              type="button"
              onClick={() => setIsSwitcherOpen((open) => !open)}
              aria-expanded={isSwitcherOpen}
              aria-haspopup="menu"
              className="flex h-9 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.06] px-2.5 text-xs font-semibold text-slate-100 transition hover:bg-white/10 sm:px-3"
            >
              <Grid3X3 className="h-4 w-4 text-cyan-300" />
              <span>ArteFlow</span>
              <ChevronDown className={`h-3.5 w-3.5 text-slate-400 transition ${isSwitcherOpen ? 'rotate-180' : ''}`} />
            </button>

            {isSwitcherOpen && (
              <div role="menu" className="absolute left-0 top-11 w-[310px] max-w-[calc(100vw-24px)] overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 text-slate-900 shadow-2xl shadow-slate-950/20">
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

        <div className="flex min-w-0 items-center gap-1.5 md:gap-2">
          <button type="button" className="hidden h-9 items-center gap-2 rounded-lg px-3 text-xs font-medium text-slate-300 transition hover:bg-white/[0.06] hover:text-white md:flex" title="Organização ativa">
            <Building2 className="h-4 w-4 text-cyan-300" />
            <span className="max-w-[210px] truncate">{organization.name}</span>
            <ChevronDown className="h-3.5 w-3.5 text-slate-500" />
          </button>
          <button type="button" aria-label="Ajuda" className="hidden h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white/[0.06] hover:text-white sm:flex">
            <HelpCircle className="h-[18px] w-[18px]" />
          </button>
          <button type="button" aria-label="Notificações" className="relative flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white/[0.06] hover:text-white">
            <Bell className="h-[18px] w-[18px]" />
            <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-cyan-400 ring-2 ring-[#07192d]" />
          </button>
          <div className="ml-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 to-cyan-400 text-[11px] font-black text-white shadow-sm ring-2 ring-white/10" title="Carlos Oliveira">
            CO
          </div>
        </div>
      </div>
    </header>
  );
};
