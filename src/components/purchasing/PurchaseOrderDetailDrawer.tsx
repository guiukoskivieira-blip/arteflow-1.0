import React, { useState, useEffect } from 'react';
import { useArteFlow } from '../../context/ArteFlowContext';
import {
  PurchaseOrderItem,
  GoodsReceipt,
  ProcurementEvent,
  PURCHASE_ORDER_STATUS_CONFIG,
} from '../../types/procurement';
import {
  X,
  ShoppingCart,
  Building2,
  Calendar,
  Send,
  PackageCheck,
  Truck,
  History as HistoryIcon,
  Info as InfoIcon,
} from 'lucide-react';
import { formatMoneyFromCents } from '../../domain/money';

export const PurchaseOrderDetailDrawer: React.FC = () => {
  const {
    can = () => true,
    isPurchaseOrderDetailDrawerOpen,
    setIsPurchaseOrderDetailDrawerOpen,
    selectedPurchaseOrder,
    getPurchaseOrderItems,
    getPurchaseOrderReceipts,
    getProcurementEvents,
    issuePurchaseOrder,
    cancelPurchaseOrder,
    setIsRecordReceiptModalOpen,
  } = useArteFlow();
  const canManage = can('arteflow.procurement.manage');

  const [items, setItems] = useState<PurchaseOrderItem[]>([]);
  const [receipts, setReceipts] = useState<GoodsReceipt[]>([]);
  const [events, setEvents] = useState<ProcurementEvent[]>([]);
  const [activeTab, setActiveTab] = useState<'items' | 'receipts' | 'history'>('items');
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  useEffect(() => {
    if (isPurchaseOrderDetailDrawerOpen && selectedPurchaseOrder) {
      getPurchaseOrderItems(selectedPurchaseOrder.id).then(setItems);
      getPurchaseOrderReceipts(selectedPurchaseOrder.id).then(setReceipts);
      getProcurementEvents('ORDER', selectedPurchaseOrder.id).then(setEvents);
      setActiveTab('items');
      setIsCancelling(false);
      setCancelReason('');
    }
  }, [
    isPurchaseOrderDetailDrawerOpen,
    selectedPurchaseOrder,
    getPurchaseOrderItems,
    getPurchaseOrderReceipts,
    getProcurementEvents,
  ]);

  // Tecla Escape para fechar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isPurchaseOrderDetailDrawerOpen) {
        setIsPurchaseOrderDetailDrawerOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPurchaseOrderDetailDrawerOpen, setIsPurchaseOrderDetailDrawerOpen]);

  if (!isPurchaseOrderDetailDrawerOpen || !selectedPurchaseOrder) return null;

  const po = selectedPurchaseOrder;
  const cfg = PURCHASE_ORDER_STATUS_CONFIG[po.status];
  const canReceive = po.status === 'ISSUED' || po.status === 'PARTIALLY_RECEIVED';
  const canCancel = (po.status === 'DRAFT' || po.status === 'ISSUED') && receipts.length === 0;

  const handleIssue = async () => {
    if (!canManage) return;
    try {
      await issuePurchaseOrder(po.id);
      setIsPurchaseOrderDetailDrawerOpen(false);
    } catch {
      // Notificado via contexto
    }
  };

  const handleConfirmCancel = async () => {
    if (!canManage) return;
    if (!cancelReason.trim()) return;
    try {
      await cancelPurchaseOrder(po.id, cancelReason);
      setIsPurchaseOrderDetailDrawerOpen(false);
    } catch {
      // Notificado via contexto
    }
  };

  const handleOpenReceiptModal = () => {
    if (!canManage) return;
    setIsRecordReceiptModalOpen(true);
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden bg-slate-900/60 backdrop-blur-xs flex justify-end"
      role="dialog"
      aria-modal="true"
      aria-labelledby="purchase-order-drawer-title"
    >
      <div className="w-full max-w-3xl bg-white h-full shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-200">
        {/* Header do Drawer */}
        <div className="p-6 border-b border-slate-200 bg-slate-50 flex items-start justify-between">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5">
              <h2 id="purchase-order-drawer-title" className="text-xl font-bold font-mono text-slate-900">
                {po.orderNumber}
              </h2>
              <span
                className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg.bg} ${cfg.color} ${cfg.border}`}
              >
                {cfg.label}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span>Criado por {po.createdByName}</span>
              <span>•</span>
              <span>{new Date(po.createdAt).toLocaleDateString('pt-BR')}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsPurchaseOrderDetailDrawerOpen(false)}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Informações do Fornecedor Snapshot */}
        <div className="p-6 border-b border-slate-100 bg-white grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="space-y-1">
            <span className="text-slate-400 uppercase tracking-wider font-semibold text-[10px]">
              Fornecedor Homologado (Snapshot)
            </span>
            <div className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-slate-500" />
              {po.supplierSnapshot.tradeName}
            </div>
            {po.supplierSnapshot.corporateName && (
              <div className="text-slate-500">{po.supplierSnapshot.corporateName}</div>
            )}
            {po.supplierSnapshot.document && (
              <div className="text-slate-600 font-mono">Doc: {po.supplierSnapshot.document}</div>
            )}
          </div>

          <div className="space-y-1 sm:text-right">
            <span className="text-slate-400 uppercase tracking-wider font-semibold text-[10px]">
              Prazos & Contato
            </span>
            <div className="text-slate-700 font-medium">
              Contato: {po.supplierSnapshot.contactName || 'Comercial'}
            </div>
            {po.supplierSnapshot.email && (
              <div className="text-slate-500">{po.supplierSnapshot.email}</div>
            )}
            {po.expectedAt && (
              <div className="text-blue-700 font-semibold flex items-center sm:justify-end gap-1 mt-1">
                <Calendar className="w-3.5 h-3.5" />
                Previsão de Entrega: {new Date(po.expectedAt).toLocaleDateString('pt-BR')}
              </div>
            )}
            {po.issuedAt && (
              <div className="text-emerald-700 font-semibold flex items-center sm:justify-end gap-1 mt-1">
                <Calendar className="w-3.5 h-3.5" />
                Emitido em: {new Date(po.issuedAt).toLocaleDateString('pt-BR')}
              </div>
            )}
          </div>
        </div>

        {/* Abas Internas */}
        <div className="flex border-b border-slate-200 px-6 bg-slate-50/50">
          <button
            type="button"
            onClick={() => setActiveTab('items')}
            className={`py-3 px-4 text-xs font-semibold border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'items'
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <ShoppingCart className="w-4 h-4" />
            Itens do Pedido ({items.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('receipts')}
            className={`py-3 px-4 text-xs font-semibold border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'receipts'
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Truck className="w-4 h-4" />
            Entregas e Recebimentos ({receipts.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`py-3 px-4 text-xs font-semibold border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'history'
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <HistoryIcon className="w-4 h-4" />
            Auditoria ({events.length})
          </button>
        </div>

        {/* Conteúdo das Abas */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeTab === 'items' && (
            <div className="space-y-6">
              {/* Tabela de Itens */}
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                      <th className="py-3 px-4">Material</th>
                      <th className="py-3 px-4 text-right">Pedido</th>
                      <th className="py-3 px-4 text-right">Recebido</th>
                      <th className="py-3 px-4 text-right">Pendente</th>
                      <th className="py-3 px-4 text-right">Custo Unit.</th>
                      <th className="py-3 px-4 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {items.map((item) => {
                      const pendingQty = item.orderedQuantityMilli - item.receivedQuantityMilli;
                      const isComplete = pendingQty <= 0;

                      return (
                        <tr key={item.id} className="hover:bg-slate-50/50">
                          <td className="py-3 px-4">
                            <div className="font-semibold text-slate-900">
                              {item.materialSnapshot.name}
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono">
                              SKU: {item.materialSnapshot.sku}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right font-medium text-slate-900">
                            {item.orderedQuantityMilli / 1000} {item.unit}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <span
                              className={`font-semibold ${
                                item.receivedQuantityMilli > 0 ? 'text-emerald-700' : 'text-slate-400'
                              }`}
                            >
                              {item.receivedQuantityMilli / 1000} {item.unit}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            {isComplete ? (
                              <span className="text-emerald-600 font-medium">Concluído</span>
                            ) : (
                              <span className="font-bold text-amber-700">
                                {pendingQty / 1000} {item.unit}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-slate-700">
                            {formatMoneyFromCents(item.unitCostCents)}
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-slate-900 font-mono">
                            {formatMoneyFromCents(item.totalCostCents)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Resumo de Valores */}
              <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200 space-y-2.5 max-w-sm ml-auto text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal dos Itens:</span>
                  <span className="font-semibold text-slate-900 font-mono">
                    {formatMoneyFromCents(po.subtotalCents)}
                  </span>
                </div>
                {po.freightCents > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>Frete:</span>
                    <span className="font-semibold text-slate-900 font-mono">
                      + {formatMoneyFromCents(po.freightCents)}
                    </span>
                  </div>
                )}
                {po.discountCents > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>Desconto Comercial:</span>
                    <span className="font-semibold text-emerald-700 font-mono">
                      - {formatMoneyFromCents(po.discountCents)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-bold text-slate-900 border-t border-slate-200/80 pt-2">
                  <span>Valor Total do Pedido:</span>
                  <span className="font-mono">{formatMoneyFromCents(po.totalCents)}</span>
                </div>
              </div>

              {/* Integração financeira */}
              <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-xl flex items-start gap-3 text-xs text-amber-900">
                <InfoIcon className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" />
                <div>
                  {po.issuedAt ? (
                    <><span className="font-semibold">Conta a pagar gerada:</span> consulte e liquide o título correspondente no Financeiro.</>
                  ) : (
                    <><span className="font-semibold">Integração financeira:</span> ao emitir este pedido, uma conta a pagar será gerada no Financeiro.</>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'receipts' && (
            <div className="space-y-4">
              {receipts.length === 0 ? (
                <div className="text-center py-12 border border-dashed border-slate-200 rounded-2xl">
                  <Truck className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  <div className="text-xs font-semibold text-slate-700">Nenhum recebimento registrado</div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Utilize a ação "Registrar Recebimento" para dar entrada nos materiais entregues.
                  </p>
                </div>
              ) : (
                receipts.map((rec) => (
                  <div
                    key={rec.id}
                    className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-bold font-mono text-slate-900 text-sm">
                        {rec.receiptNumber}
                      </div>
                      <div className="text-slate-500">
                        {new Date(rec.receivedAt).toLocaleDateString('pt-BR')}{' '}
                        {new Date(rec.receivedAt).toLocaleTimeString('pt-BR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                    </div>
                    <div className="text-slate-600">
                      Recebido por <span className="font-semibold text-slate-800">{rec.receivedByName}</span>
                      {rec.invoiceNumber && (
                        <span> • NF: <span className="font-mono font-semibold">{rec.invoiceNumber}</span></span>
                      )}
                    </div>
                    {rec.notes && <div className="text-slate-500 italic bg-slate-50 p-2 rounded-lg">{rec.notes}</div>}
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'history' && (
            <div className="space-y-3">
              {events.map((evt) => (
                <div key={evt.id} className="p-3 bg-slate-50 border border-slate-200/60 rounded-xl text-xs space-y-1">
                  <div className="flex items-center justify-between text-slate-500 text-[11px]">
                    <span className="font-semibold text-slate-700">{evt.userName}</span>
                    <span>{new Date(evt.createdAt).toLocaleString('pt-BR')}</span>
                  </div>
                  <div className="text-slate-900">{evt.description}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer com Ações */}
        {canManage && <div className="p-6 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
          <div>
            {canCancel && !isCancelling && (
              <button
                type="button"
                onClick={() => setIsCancelling(true)}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors"
              >
                Cancelar Pedido
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            {po.status === 'DRAFT' && (
              <button
                type="button"
                onClick={handleIssue}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-xs transition-colors"
              >
                <Send className="w-4 h-4" />
                Emitir Pedido de Compra
              </button>
            )}

            {canReceive && (
              <button
                type="button"
                onClick={handleOpenReceiptModal}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-xs transition-colors"
              >
                <PackageCheck className="w-4 h-4" />
                Registrar Recebimento Físico
              </button>
            )}
          </div>
        </div>}

        {/* Diálogo de Cancelamento Inline */}
        {canManage && isCancelling && (
          <div className="p-6 border-t border-red-200 bg-red-50/50 space-y-3">
            <h4 className="text-xs font-bold text-red-900">Motivo do Cancelamento do Pedido</h4>
            <textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Descreva por que o pedido está sendo cancelado..."
              rows={2}
              className="w-full px-3 py-2 bg-white border border-red-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsCancelling(false);
                  setCancelReason('');
                }}
                className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Voltar
              </button>
              <button
                type="button"
                disabled={!cancelReason.trim()}
                onClick={handleConfirmCancel}
                className="px-4 py-1.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold"
              >
                Confirmar Cancelamento
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
