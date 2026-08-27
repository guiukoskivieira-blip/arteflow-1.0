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
  Users,
  Settings,
  Layers,
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
  { id: 'inventory', label: 'Estoque', icon: Package, badge: 'Fase 2' },
  { id: 'purchasing', label: 'Compras', icon: ShoppingBag, badge: 'Fase 2' },
  { id: 'financial', label: 'Financeiro', icon: DollarSign, badge: 'Fase 2' },
  { id: 'dispatch', label: 'Expedição', icon: Truck, badge: 'Fase 2' },
  { id: 'team', label: 'Equipe e Permissões', icon: Users, badge: 'Fase 3' },
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
      <div className="relative flex-1 flex flex-col max-w-xs w-full bg-slate-900 text-slate-300 shadow-xl">
        {/* Header */}
        <div className="h-16 flex items-center justify-between px-5 border-b border-slate-800 bg-slate-950/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-600 flex items-center justify-center text-white">
              <Layers className="w-4 h-4" />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-white text-sm">ArteFlow</span>
              <span className="text-[10px] text-slate-400">Prexyon</span>
            </div>
          </div>
          <button
            onClick={() => setIsMobileDrawerOpen(false)}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
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
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-teal-600 text-white font-semibold shadow-sm'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </div>

                {item.isCentral && jobs.length > 0 && (
                  <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-teal-500/20 text-teal-300">
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
