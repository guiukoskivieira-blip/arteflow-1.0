import React from 'react';
import { useArteFlow, AppPage } from '../../context/ArteFlowContext';
import {
  LayoutDashboard,
  ShoppingCart,
  Kanban,
  Package,
  ShoppingBag,
  DollarSign,
  Truck,
  Settings,
  Layers,
  Sparkles,
} from 'lucide-react';

interface NavItem {
  id: AppPage;
  label: string;
  icon: React.ElementType;
  badge?: string;
  isCentral?: boolean;
}

const navItems: NavItem[] = [
  { id: 'overview', label: 'Visão Geral', icon: LayoutDashboard },
  { id: 'orders', label: 'Pedidos', icon: ShoppingCart },
  { id: 'production', label: 'Produção', icon: Kanban, isCentral: true },
  { id: 'inventory', label: 'Estoque', icon: Package, badge: 'Fase 2' },
  { id: 'purchasing', label: 'Compras', icon: ShoppingBag, badge: 'Fase 2' },
  { id: 'financial', label: 'Financeiro', icon: DollarSign, badge: 'Fase 2' },
  { id: 'dispatch', label: 'Expedição', icon: Truck, badge: 'Fase 2' },
  { id: 'settings', label: 'Configurações', icon: Settings },
];

export const Sidebar: React.FC = () => {
  const { activePage, setActivePage, jobs } = useArteFlow();

  const totalActiveJobs = jobs.length;

  return (
    <aside className="hidden lg:flex flex-col w-64 bg-slate-900 text-slate-300 border-r border-slate-800 flex-shrink-0 select-none">
      {/* Brand Header */}
      <div className="h-16 flex items-center gap-3 px-5 border-b border-slate-800/80 bg-slate-950/40">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-teal-600 to-emerald-400 flex items-center justify-center text-white shadow-md shadow-teal-900/30">
          <Layers className="w-5 h-5" />
        </div>
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span className="font-extrabold text-white text-base tracking-tight">ArteFlow</span>
            <span className="text-[10px] uppercase font-bold px-1.5 py-0.2 bg-teal-500/20 text-teal-300 rounded border border-teal-500/30">
              Beta
            </span>
          </div>
          <span className="text-[11px] text-slate-400 font-medium tracking-wide">Ecossistema Prexyon</span>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
          Operação & Fluxo
        </div>

        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activePage === item.id;

          return (
            <button
              key={item.id}
              onClick={() => setActivePage(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-all group ${
                isActive
                  ? 'bg-teal-600 text-white font-semibold shadow-sm'
                  : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon
                  className={`w-4 h-4 transition-colors ${
                    isActive ? 'text-white' : 'text-slate-400 group-hover:text-teal-400'
                  }`}
                />
                <span>{item.label}</span>
              </div>

              {item.isCentral && totalActiveJobs > 0 && (
                <span
                  className={`px-1.5 py-0.5 text-[10px] font-bold rounded-full ${
                    isActive ? 'bg-white text-teal-900' : 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                  }`}
                >
                  {totalActiveJobs}
                </span>
              )}

              {item.badge && !item.isCentral && (
                <span className="text-[9px] px-1.5 py-0.2 bg-slate-800 text-slate-400 rounded border border-slate-700">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Bottom Info Card */}
      <div className="p-3 border-t border-slate-800/80 bg-slate-950/20">
        <div className="p-3 rounded-lg bg-slate-800/60 border border-slate-700/60">
          <div className="flex items-center gap-2 text-teal-400 text-xs font-semibold mb-1">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Fase 1 — Standalone</span>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Gestão operacional com persistência local e OPs desacopladas.
          </p>
        </div>
      </div>
    </aside>
  );
};
