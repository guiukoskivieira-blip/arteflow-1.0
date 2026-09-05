import React, { useState, useMemo } from 'react';
import { useArteFlow } from '../../context/ArteFlowContext';
import {
  PurchaseOrder,
  PurchaseOrderStatus,
  PURCHASE_ORDER_STATUS_CONFIG,
} from '../../types/procurement';
import {
  Plus,
  Search,
  ShoppingCart,
  Send,
  PackageCheck,
  Eye,
  XCircle,
  Clock,
  Building2,
} from 'lucide-react';
import { formatMoneyFromCents } from '../../domain/money';

export const PurchaseOrdersTab: React.FC = () => {
  const {
    can = () => true,
    purchaseOrders,
    purchaseOrderItems,
    setSelectedPurchaseOrder,
    setIsPurchaseOrderDetailDrawerOpen,
    setIsNewPurchaseOrderModalOpen,
    setIsRecordReceiptModalOpen,
    issuePurchaseOrder,
    cancelPurchaseOrder,
  } = useArteFlow();
  const canManage = can('arteflow.procurement.manage');

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<PurchaseOrderStatus | 'ALL'>('ALL');
  const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  const filteredOrders = useMemo(() => {
    return purchaseOrders.filter((po) => {
      const matchStatus = statusFilter === 'ALL' || po.status === statusFilter;
      const q = search.toLowerCase();
      const matchSearch =
        !q ||
        po.orderNumber.toLowerCase().includes(q) ||
        po.supplierSnapshot.tradeName.toLowerCase().includes(q) ||
        po.createdByName.toLowerCase().includes(q);
      return matchStatus && matchSearch;
    });
  }, [purchaseOrders, statusFilter, search]);

  const handleOpenDetails = (po: PurchaseOrder) => {
    setSelectedPurchaseOrder(po);
    setIsPurchaseOrderDetailDrawerOpen(true);
  };

  const handleOpenReceiptModal = (po: PurchaseOrder) => {
    setSelectedPurchaseOrder(po);
    setIsRecordReceiptModalOpen(true);
  };

  const handleIssue = async (orderId: string) => {
    try {
      await issuePurchaseOrder(orderId);
    } catch {
      // Notificado pelo contexto
    }
  };

  const handleConfirmCancel = async () => {
    if (!cancellingOrderId || !cancelReason.trim()) return;
    try {
      await cancelPurchaseOrder(cancellingOrderId, cancelReason);
      setCancellingOrderId(null);
      setCancelReason('');
    } catch {
      // Notificado pelo contexto
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por número, fornecedor..."
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
            <option value="DRAFT">Rascunho</option>
            <option value="ISSUED">Emitido / Aguardando</option>
            <option value="PARTIALLY_RECEIVED">Recebido Parcial</option>
            <option value="RECEIVED">Recebido Total</option>
            <option value="CANCELLED">Cancelado</option>
          </select>
        </div>

        {canManage && <button
          type="button"
          onClick={() => setIsNewPurchaseOrderModalOpen(true)}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold transition-colors shadow-xs"
        >
          <Plus className="w-4 h-4" />
          Novo Pedido de Compra
        </button>}
      </div>

      {/* Tabela de Pedidos */}
      {filteredOrders.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-xs">
          <ShoppingCart className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-900 mb-1">Nenhum Pedido de Compra Encontrado</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mb-5">
            Crie pedidos de compra a partir de solicitações abertas ou diretamente para um fornecedor homologado.
          </p>
          {canManage && <button
            type="button"
            onClick={() => setIsNewPurchaseOrderModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-semibold transition-colors"
          >
            <Plus className="w-4 h-4" />
            Criar Primeiro Pedido
          </button>}
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                  <th className="py-3.5 px-4">Número</th>
                  <th className="py-3.5 px-4">Fornecedor</th>
                  <th className="py-3.5 px-4">Emissão / Previsão</th>
                  <th className="py-3.5 px-4">Progresso de Entrega</th>
                  <th className="py-3.5 px-4">Valor Total</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredOrders.map((po) => {
                  const items = purchaseOrderItems.filter((i) => i.purchaseOrderId === po.id);
                  const totalOrdered = items.reduce((sum, i) => sum + i.orderedQuantityMilli, 0);
                  const totalReceived = items.reduce((sum, i) => sum + i.receivedQuantityMilli, 0);
                  const percentReceived = totalOrdered > 0 ? Math.round((totalReceived / totalOrdered) * 100) : 0;
                  const cfg = PURCHASE_ORDER_STATUS_CONFIG[po.status];

                  return (
                    <tr key={po.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                        {po.orderNumber}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-slate-400" />
                          {po.supplierSnapshot.tradeName}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono">
                          {po.supplierSnapshot.code}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="text-slate-900">
                          {po.issuedAt ? new Date(po.issuedAt).toLocaleDateString('pt-BR') : 'Não emitido'}
                        </div>
                        {po.expectedAt && (
                          <div className="text-[11px] text-slate-500 flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-400" />
                            Prev: {new Date(po.expectedAt).toLocaleDateString('pt-BR')}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="w-36 space-y-1">
                          <div className="flex justify-between text-[11px]">
                            <span className="font-medium text-slate-700">{percentReceived}% recebido</span>
                            <span className="text-slate-400">{items.length} itens</span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                percentReceived === 100
                                  ? 'bg-emerald-500'
                                  : percentReceived > 0
                                  ? 'bg-amber-500'
                                  : 'bg-slate-300'
                              }`}
                              style={{ width: `${percentReceived}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-slate-900 whitespace-nowrap">
                        {formatMoneyFromCents(po.totalCents)}
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
                          <button
                            type="button"
                            onClick={() => handleOpenDetails(po)}
                            title="Ver detalhes do pedido"
                            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {canManage && po.status === 'DRAFT' && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleIssue(po.id)}
                                title="Emitir pedido para o fornecedor"
                                className="px-2.5 py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 font-medium text-xs flex items-center gap-1.5 transition-colors"
                              >
                                <Send className="w-3.5 h-3.5" />
                                Emitir
                              </button>

                              <button
                                type="button"
                                onClick={() => setCancellingOrderId(po.id)}
                                title="Cancelar pedido"
                                className="p-1.5 rounded-lg text-red-500 hover:text-red-700 hover:bg-red-50 transition-colors"
                              >
                                <XCircle className="w-4 h-4" />
                              </button>
                            </>
                          )}

                          {canManage && (po.status === 'ISSUED' || po.status === 'PARTIALLY_RECEIVED') && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleOpenReceiptModal(po)}
                                title="Registrar recebimento de materiais"
                                className="px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-medium text-xs flex items-center gap-1.5 transition-colors"
                              >
                                <PackageCheck className="w-3.5 h-3.5" />
                                Receber
                              </button>

                              {po.status === 'ISSUED' && (
                                <button
                                  type="button"
                                  onClick={() => setCancellingOrderId(po.id)}
                                  title="Cancelar pedido"
                                  className="p-1.5 rounded-lg text-red-500 hover:text-red-700 hover:bg-red-50 transition-colors"
                                >
                                  <XCircle className="w-4 h-4" />
                                </button>
                              )}
                            </>
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

      {/* Modal de Cancelamento de Pedido */}
      {cancellingOrderId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 mb-2">Cancelar Pedido de Compra</h3>
            <p className="text-xs text-slate-600 mb-4">
              O cancelamento registrará um evento imutável na auditoria de compras.
            </p>

            <div className="mb-4">
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Motivo do Cancelamento *</label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Ex: Fornecedor sem disponibilidade / Pedido substituído..."
                rows={3}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
              />
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setCancellingOrderId(null);
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
