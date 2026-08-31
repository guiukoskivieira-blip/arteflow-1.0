import React, { useState } from 'react';
import { useArteFlow } from '../../context/ArteFlowContext';
import { NeedsTab } from '../purchasing/NeedsTab';
import { RequestsTab } from '../purchasing/RequestsTab';
import { PurchaseOrdersTab } from '../purchasing/PurchaseOrdersTab';
import { SuppliersTab } from '../purchasing/SuppliersTab';
import { NewSupplierModal } from '../purchasing/NewSupplierModal';
import { EditSupplierModal } from '../purchasing/EditSupplierModal';
import { NewRequestModal } from '../purchasing/NewRequestModal';
import { NewPurchaseOrderModal } from '../purchasing/NewPurchaseOrderModal';
import { PurchaseOrderDetailDrawer } from '../purchasing/PurchaseOrderDetailDrawer';
import { RecordReceiptModal } from '../purchasing/RecordReceiptModal';
import {
  AlertTriangle,
  FileText,
  Clock,
  DollarSign,
  Building2,
  ShoppingCart,
  Boxes,
} from 'lucide-react';
import { formatMoneyFromCents } from '../../domain/money';

export type PurchasingTabType = 'needs' | 'requests' | 'orders' | 'suppliers';

export const PurchasingPage: React.FC = () => {
  const {
    procurementSuggestions,
    purchaseRequests,
    purchaseOrders,
    suppliers,
  } = useArteFlow();

  const [activeTab, setActiveTab] = useState<PurchasingTabType>('needs');

  // Cálculos do Header KPI
  const needsCount = procurementSuggestions.length;
  const openRequestsCount = purchaseRequests.filter((r) => r.status === 'REQUESTED').length;
  const issuedOrdersCount = purchaseOrders.filter((o) => o.status === 'ISSUED').length;
  const partiallyReceivedCount = purchaseOrders.filter((o) => o.status === 'PARTIALLY_RECEIVED').length;
  const openOrdersTotalCents = purchaseOrders
    .filter((o) => o.status === 'ISSUED' || o.status === 'PARTIALLY_RECEIVED' || o.status === 'DRAFT')
    .reduce((sum, o) => sum + o.totalCents, 0);

  return (
    <div className="flex-1 overflow-y-auto py-6 space-y-6">
      {/* KPI Dashboard */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5 sm:gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">Necessidades</span>
            <AlertTriangle className={`w-4 h-4 ${needsCount > 0 ? 'text-amber-500' : 'text-slate-400'}`} />
          </div>
          <div className="text-2xl font-bold text-slate-900">{needsCount}</div>
          <div className="text-[11px] text-slate-500 mt-1">Materiais a solicitar</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">Solicitações Abertas</span>
            <FileText className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{openRequestsCount}</div>
          <div className="text-[11px] text-slate-500 mt-1">Aguardando cotação/pedido</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">Aguardando Entrega</span>
            <Clock className="w-4 h-4 text-purple-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{issuedOrdersCount}</div>
          <div className="text-[11px] text-slate-500 mt-1">Pedidos emitidos</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">Recebimento Parcial</span>
            <Boxes className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{partiallyReceivedCount}</div>
          <div className="text-[11px] text-slate-500 mt-1">Entregas em andamento</div>
        </div>

        <div className="col-span-2 lg:col-span-1 bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">Total em Pedidos</span>
            <DollarSign className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-xl font-bold text-slate-900 truncate font-mono">
            {formatMoneyFromCents(openOrdersTotalCents)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Valor aberto em compras</div>
        </div>
      </div>

      {/* Navegação por Abas */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        <div className="flex border-b border-slate-200 overflow-x-auto bg-slate-50/50 px-4">
          <button
            type="button"
            onClick={() => setActiveTab('needs')}
            className={`py-3.5 px-4 text-xs font-semibold border-b-2 flex items-center gap-2 transition-all whitespace-nowrap ${
              activeTab === 'needs'
                ? 'border-slate-900 text-slate-900 bg-white shadow-xs'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            Necessidades
            {needsCount > 0 && (
              <span className="ml-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800">
                {needsCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('requests')}
            className={`py-3.5 px-4 text-xs font-semibold border-b-2 flex items-center gap-2 transition-all whitespace-nowrap ${
              activeTab === 'requests'
                ? 'border-slate-900 text-slate-900 bg-white shadow-xs'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileText className="w-4 h-4 text-blue-500" />
            Solicitações de Compra
            <span className="ml-1 text-slate-400 font-normal">({purchaseRequests.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('orders')}
            className={`py-3.5 px-4 text-xs font-semibold border-b-2 flex items-center gap-2 transition-all whitespace-nowrap ${
              activeTab === 'orders'
                ? 'border-slate-900 text-slate-900 bg-white shadow-xs'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <ShoppingCart className="w-4 h-4 text-emerald-500" />
            Pedidos de Compra
            <span className="ml-1 text-slate-400 font-normal">({purchaseOrders.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('suppliers')}
            className={`py-3.5 px-4 text-xs font-semibold border-b-2 flex items-center gap-2 transition-all whitespace-nowrap ${
              activeTab === 'suppliers'
                ? 'border-slate-900 text-slate-900 bg-white shadow-xs'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Building2 className="w-4 h-4 text-purple-500" />
            Fornecedores Homologados
            <span className="ml-1 text-slate-400 font-normal">({suppliers.length})</span>
          </button>
        </div>

        {/* Conteúdo da Aba Ativa */}
        <div className="p-6">
          {activeTab === 'needs' && <NeedsTab />}
          {activeTab === 'requests' && <RequestsTab />}
          {activeTab === 'orders' && <PurchaseOrdersTab />}
          {activeTab === 'suppliers' && <SuppliersTab />}
        </div>
      </div>

      {/* Modais Globais do Módulo de Compras */}
      <NewSupplierModal />
      <EditSupplierModal />
      <NewRequestModal />
      <NewPurchaseOrderModal />
      <PurchaseOrderDetailDrawer />
      <RecordReceiptModal />
    </div>
  );
};
