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
  { id: 'inventory', label: 'Estoque', icon: Package },
  { id: 'purchasing', label: 'Compras', icon: ShoppingBag },
  { id: 'financial', label: 'Financeiro', icon: DollarSign },
  { id: 'dispatch', label: 'Expedição', icon: Truck },
  { id: 'settings', label: 'Configurações', icon: Settings },
];

export const Sidebar: React.FC = () => {
  const { activePage, setActivePage, jobs } = useArteFlow();

  const totalActiveJobs = jobs.length;

  return (
    <aside className="hidden lg:flex flex-col w-[244px] bg-gradient-to-b from-[#075aa9] via-[#087bc2] to-[#08a8ca] text-blue-50 border-r border-sky-900/10 flex-shrink-0 select-none shadow-[8px_0_28px_rgba(2,94,154,0.08)]">
      {/* Brand Header */}
      <div className="h-[86px] flex items-center px-5 border-b border-white/15 bg-white/[0.04]">
        <img src="/brand/arteflow-white.png" alt="ArteFlow — Gestão da Produção" className="h-[54px] w-[180px] object-contain object-left" />
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto">
        <div className="px-3 pb-2.5 text-[10px] font-bold uppercase tracking-[0.16em] text-blue-100/70">
          Operação & Fluxo
        </div>

        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activePage === item.id;

          return (
            <button
              key={item.id}
              onClick={() => setActivePage(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all group ${
                isActive
                  ? 'bg-white text-[#086aaa] font-bold shadow-[0_8px_20px_rgba(3,67,120,0.16)]'
                  : 'text-blue-50/90 hover:bg-white/10 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon
                  className={`w-4 h-4 transition-colors ${
                    isActive ? 'text-[#079ac7]' : 'text-blue-100/75 group-hover:text-white'
                  }`}
                />
                <span>{item.label}</span>
              </div>

              {item.isCentral && totalActiveJobs > 0 && (
                <span
                  className={`px-1.5 py-0.5 text-[10px] font-bold rounded-full ${
                    isActive ? 'bg-sky-50 text-sky-700' : 'bg-white/15 text-white border border-white/15'
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

    </aside>
  );
};
