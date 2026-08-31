import React from 'react';
import { useArteFlow } from '../../context/ArteFlowContext';
import { DEMO_USERS } from '../../domain/constants';
import { Menu, Plus, Building2, UserCircle2 } from 'lucide-react';

export const Header: React.FC = () => {
  const {
    organization,
    currentUser,
    setCurrentUser,
    setIsMobileDrawerOpen,
    setIsNewOrderModalOpen,
    activePage,
  } = useArteFlow();

  const getPageTitle = () => {
    switch (activePage) {
      case 'overview':
        return 'Visão Geral Operacional';
      case 'orders':
        return 'Gestão de Pedidos';
      case 'production':
        return 'Quadro de Produção';
      case 'inventory':
        return 'Estoque de Materiais & Insumos';
      case 'purchasing':
        return 'Ordens de Compra';
      case 'financial':
        return 'Financeiro Operacional';
      case 'dispatch':
        return 'Expedição & Logística';
      case 'settings':
        return 'Configurações do Sistema';
      default:
        return 'ArteFlow';
    }
  };

  return (
    <header className="h-[74px] bg-white/95 backdrop-blur border-b border-slate-200/80 px-4 md:px-7 flex items-center justify-between flex-shrink-0 z-10">
      {/* Left: Mobile Toggle & Page Title */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setIsMobileDrawerOpen(true)}
          className="lg:hidden p-2 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100"
          aria-label="Abrir menu de navegação"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div>
          <h1 className="text-base md:text-[19px] font-extrabold tracking-tight text-slate-950 leading-tight">
            {getPageTitle()}
          </h1>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1">
              <Building2 className="w-3 h-3 text-slate-400" />
              {organization.name}
            </span>
          </div>
        </div>
      </div>

      {/* Right: Actions, Honest Local Operator Selector, New Order Button */}
      <div className="flex items-center gap-2 md:gap-3">
        {/* Honest Local Demo Operator Selector */}
        <div
          className="hidden lg:flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200/80"
          title="Seletor de operador local para assinatura de eventos de auditoria"
        >
          <UserCircle2 className="w-4 h-4 text-sky-600 flex-shrink-0" />
          <div className="flex flex-col">
            <div className="flex items-center gap-1">
              <span className="text-[10px] uppercase font-bold text-slate-400">
                Operador Local (Demo):
              </span>
              <span className="text-[9px] px-1 bg-sky-50 text-sky-700 border border-sky-200 rounded font-semibold">
                Sem Auth
              </span>
            </div>
            <select
              value={currentUser.id}
              onChange={(e) => {
                const selected = DEMO_USERS.find((u) => u.id === e.target.value);
                if (selected) setCurrentUser(selected);
              }}
              className="text-xs font-semibold text-slate-800 bg-transparent border-none focus:ring-0 focus:outline-none cursor-pointer -ml-0.5"
            >
              {DEMO_USERS.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name} ({user.role})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Quick New Order Button */}
        <button
          onClick={() => setIsNewOrderModalOpen(true)}
          className="inline-flex items-center gap-2 px-3.5 md:px-4 py-2.5 text-xs md:text-sm font-bold text-white bg-gradient-to-r from-[#087ac1] to-[#08a9ca] hover:from-[#066cae] hover:to-[#0798b8] active:scale-[0.98] rounded-xl shadow-[0_8px_20px_rgba(2,132,199,0.22)] transition-all flex-shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Novo Pedido</span>
        </button>
      </div>
    </header>
  );
};
