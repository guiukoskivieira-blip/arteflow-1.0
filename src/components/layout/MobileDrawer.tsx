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
  X,
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

export const MobileDrawer: React.FC = () => {
  const { isMobileDrawerOpen, setIsMobileDrawerOpen, activePage, setActivePage, jobs } = useArteFlow();

  if (!isMobileDrawerOpen) return null;

  const handleSelect = (page: AppPage) => {
    setActivePage(page);
    setIsMobileDrawerOpen(false);
  };

  return (
    <div className="fixed inset-0 z-50 lg:hidden flex">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
        onClick={() => setIsMobileDrawerOpen(false)}
      />

      {/* Drawer Panel */}
      <div className="relative flex-1 flex flex-col max-w-xs w-full bg-gradient-to-b from-[#075aa9] via-[#087bc2] to-[#08a8ca] text-blue-50 shadow-2xl">
        {/* Header */}
        <div className="h-[78px] flex items-center justify-between px-5 border-b border-white/15 bg-white/[0.04]">
          <img src="/brand/arteflow-white.png" alt="ArteFlow — Gestão da Produção" className="h-[52px] w-[174px] object-contain object-left" />
          <button
            onClick={() => setIsMobileDrawerOpen(false)}
            className="p-2 text-blue-100 hover:text-white rounded-lg hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Links */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activePage === item.id;

            return (
              <button
                key={item.id}
                onClick={() => handleSelect(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-white text-[#086aaa] font-bold shadow-lg shadow-sky-950/10'
                    : 'text-blue-50/90 hover:bg-white/10 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-[#079ac7]' : 'text-blue-100/75'}`} />
                  <span>{item.label}</span>
                </div>

                {item.isCentral && jobs.length > 0 && (
                  <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded-full ${isActive ? 'bg-sky-50 text-sky-700' : 'bg-white/15 text-white'}`}>
                    {jobs.length}
                  </span>
                )}

                {item.badge && !item.isCentral && (
                  <span className="text-[9px] px-1.5 py-0.2 bg-slate-800 text-slate-400 rounded">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
};
