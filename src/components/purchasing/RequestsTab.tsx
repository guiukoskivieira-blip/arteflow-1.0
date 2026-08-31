import React, { useState, useMemo } from 'react';
import { useArteFlow } from '../../context/ArteFlowContext';
import {
  PurchaseRequest,
  PurchaseRequestStatus,
  PURCHASE_REQUEST_STATUS_CONFIG,
} from '../../types/procurement';
import {
  Plus,
  Search,
  FileText,
  ShoppingCart,
  XCircle,
  Layers,
  CheckCircle2,
} from 'lucide-react';

export const RequestsTab: React.FC = () => {
  const {
    purchaseRequests,
    purchaseRequestItems,
    setIsNewRequestModalOpen,
    setIsNewPurchaseOrderModalOpen,
    cancelPurchaseRequest,
    setPrefillRequestItem,
  } = useArteFlow();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<PurchaseRequestStatus | 'ALL'>('ALL');
  const [cancellingRequestId, setCancellingRequestId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  const filteredRequests = useMemo(() => {
    return purchaseRequests.filter((req) => {
      const matchStatus = statusFilter === 'ALL' || req.status === statusFilter;
      const q = search.toLowerCase();
      const matchSearch =
        !q ||
        req.requestNumber.toLowerCase().includes(q) ||
        (req.jobCode && req.jobCode.toLowerCase().includes(q)) ||
        req.requestedByName.toLowerCase().includes(q);
      return matchStatus && matchSearch;
    });
  }, [purchaseRequests, statusFilter, search]);

  const handleOpenNewManualRequest = () => {
    setPrefillRequestItem(null);
    setIsNewRequestModalOpen(true);
  };

  const handleConvertToOrder = (_req: PurchaseRequest) => {
    // Abre modal de Novo Pedido de Compra
    setIsNewPurchaseOrderModalOpen(true);
  };

  const handleConfirmCancel = async () => {
    if (!cancellingRequestId || !cancelReason.trim()) return;
    try {
      await cancelPurchaseRequest(cancellingRequestId, cancelReason);
      setCancellingRequestId(null);
      setCancelReason('');
    } catch {
      // Erro tratado pelo context notification
    }
  };

  const getSourceBadge = (source: PurchaseRequest['source']) => {
    switch (source) {
      case 'PRODUCTION_SHORTAGE':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-50 text-red-700 border border-red-200">
            Falta na Produção
          </span>
        );
      case 'MINIMUM_STOCK':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
            Estoque Mínimo
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
            Manual
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Controles do Topo */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por número, OP ou solicitante..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900"
          >
            <option value="ALL">Todos os Status</option>
            <option value="REQUESTED">Solicitado</option>
            <option value="CONVERTED">Convertido em Pedido</option>
            <option value="CANCELLED">Cancelado</option>
          </select>
        </div>

        <button
          type="button"
          onClick={handleOpenNewManualRequest}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold transition-colors shadow-xs"
        >
          <Plus className="w-4 h-4" />
          Nova Solicitação de Compra
        </button>
      </div>

      {/* Tabela de Solicitações */}
      {filteredRequests.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-xs">
          <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-900 mb-1">Nenhuma Solicitação de Compra Encontrada</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mb-5">
            Gere solicitações a partir da aba de Necessidades ou crie uma solicitação avulsa manualmente.
          </p>
          <button
            type="button"
            onClick={handleOpenNewManualRequest}
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-semibold transition-colors"
          >
            <Plus className="w-4 h-4" />
            Criar Primeira Solicitação
          </button>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                  <th className="py-3.5 px-4">Número</th>
                  <th className="py-3.5 px-4">Origem</th>
                  <th className="py-3.5 px-4">Itens Solicitados</th>
                  <th className="py-3.5 px-4">OP Vinculada</th>
                  <th className="py-3.5 px-4">Solicitante</th>
                  <th className="py-3.5 px-4">Data</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredRequests.map((req) => {
                  const items = purchaseRequestItems.filter((i) => i.purchaseRequestId === req.id);
                  const cfg = PURCHASE_REQUEST_STATUS_CONFIG[req.status];

                  return (
                    <tr key={req.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                        {req.requestNumber}
                      </td>
                      <td className="py-3.5 px-4">{getSourceBadge(req.source)}</td>
                      <td className="py-3.5 px-4">
                        <div className="space-y-1">
                          {items.map((item) => (
                            <div key={item.id} className="text-xs">
                              <span className="font-semibold text-slate-900">
                                {item.requestedQuantityMilli / 1000} {item.unit}
                              </span>{' '}
                              <span className="text-slate-600">— {item.materialSnapshot.name}</span>
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        {req.jobCode ? (
                          <span className="inline-flex items-center gap-1 font-semibold text-slate-800">
                            <Layers className="w-3.5 h-3.5 text-slate-400" />
                            {req.jobCode}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-slate-700">{req.requestedByName}</td>
                      <td className="py-3.5 px-4 text-slate-500 whitespace-nowrap">
                        {new Date(req.requestedAt).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg.bg} ${cfg.color} ${cfg.border}`}
                        >
                          {cfg.label}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          {req.status === 'REQUESTED' && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleConvertToOrder(req)}
                                title="Transformar em Pedido de Compra"
                                className="px-2.5 py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 font-medium text-xs flex items-center gap-1.5 transition-colors"
                              >
                                <ShoppingCart className="w-3.5 h-3.5" />
                                Criar Pedido
                              </button>

                              <button
                                type="button"
                                onClick={() => setCancellingRequestId(req.id)}
                                title="Cancelar Solicitação"
                                className="px-2.5 py-1.5 rounded-lg bg-red-50 text-red-700 hover:bg-red-100 font-medium text-xs flex items-center gap-1.5 transition-colors"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                                Cancelar
                              </button>
                            </>
                          )}

                          {req.status === 'CONVERTED' && (
                            <span className="text-xs text-sky-700 font-medium flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Atendida
                            </span>
                          )}

                          {req.status === 'CANCELLED' && (
                            <span className="text-xs text-slate-400 italic">Cancelada</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal de Confirmação de Cancelamento */}
      {cancellingRequestId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 mb-2">Cancelar Solicitação de Compra</h3>
            <p className="text-xs text-slate-600 mb-4">
              Informe o motivo do cancelamento para fins de auditoria e histórico operacional.
            </p>

            <div className="mb-4">
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Motivo do Cancelamento *</label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Ex: Material não será mais utilizado na OP / Estoque reajustado..."
                rows={3}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
              />
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setCancellingRequestId(null);
                  setCancelReason('');
                }}
                className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Voltar
              </button>
              <button
                type="button"
                disabled={!cancelReason.trim()}
                onClick={handleConfirmCancel}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold"
              >
                Confirmar Cancelamento
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
