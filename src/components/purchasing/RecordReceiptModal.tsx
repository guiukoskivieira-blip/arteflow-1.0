import React, { useState, useEffect } from 'react';
import { useArteFlow } from '../../context/ArteFlowContext';
import { GoodsReceipt } from '../../types/procurement';
import {
  X,
  PackageCheck,
  AlertCircle,
  CheckCircle2,
  BookmarkPlus,
  ArrowRight,
} from 'lucide-react';


interface ItemReceiptState {
  purchaseOrderItemId: string;
  materialName: string;
  unit: string;
  orderedQty: number;
  alreadyReceivedQty: number;
  pendingQty: number;
  receivingQty: string;
  unitCostCents: number;
  productionJobId?: string;
}

export const RecordReceiptModal: React.FC = () => {
  const {
    can = () => true,
    isRecordReceiptModalOpen,
    setIsRecordReceiptModalOpen,
    selectedPurchaseOrder,
    getPurchaseOrderItems,
    recordGoodsReceipt,
    reserveRequirement,
    getJobRequirements,
    setActivePage,
    setSelectedJob,
    jobs,
  } = useArteFlow();

  const [itemsState, setItemsState] = useState<ItemReceiptState[]>([]);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [idempotencyKey, setIdempotencyKey] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [completedReceipt, setCompletedReceipt] = useState<GoodsReceipt | null>(null);
  const [affectedJobId, setAffectedJobId] = useState<string | null>(null);

  useEffect(() => {
    if (isRecordReceiptModalOpen && selectedPurchaseOrder) {
      setInvoiceNumber('');
      setIdempotencyKey(`idemp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`);
      setNotes('');
      setError(null);
      setCompletedReceipt(null);
      setAffectedJobId(null);

      getPurchaseOrderItems(selectedPurchaseOrder.id).then((poItems) => {
        const states: ItemReceiptState[] = poItems.map((item) => {
          const pending = Math.max(0, item.orderedQuantityMilli - item.receivedQuantityMilli);
          return {
            purchaseOrderItemId: item.id,
            materialName: item.materialSnapshot.name,
            unit: item.unit,
            orderedQty: item.orderedQuantityMilli,
            alreadyReceivedQty: item.receivedQuantityMilli,
            pendingQty: pending,
            receivingQty: pending > 0 ? String(pending / 1000) : '0',
            unitCostCents: item.unitCostCents,
            productionJobId: item.productionJobId,
          };
        });
        setItemsState(states);
      });
    }
  }, [isRecordReceiptModalOpen, selectedPurchaseOrder, getPurchaseOrderItems]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isRecordReceiptModalOpen) {
        setIsRecordReceiptModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isRecordReceiptModalOpen, setIsRecordReceiptModalOpen]);

  if (!isRecordReceiptModalOpen || !selectedPurchaseOrder || selectedPurchaseOrder.status === 'RECEIVED' || !can('arteflow.procurement.manage')) return null;

  const handleQtyChange = (idx: number, val: string) => {
    setItemsState((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], receivingQty: val };
      return copy;
    });
  };

  const handleReceiveAll = (idx: number) => {
    setItemsState((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], receivingQty: String(copy[idx].pendingQty / 1000) };
      return copy;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const payloadItems = [];
    let jobCandidate: string | null = null;

    for (const item of itemsState) {
      const qtyNum = parseFloat(item.receivingQty.replace(',', '.'));
      if (isNaN(qtyNum) || qtyNum < 0) {
        setError('Informe quantidades válidas não-negativas.');
        return;
      }
      const qtyMilli = Math.round(qtyNum * 1000);
      if (qtyMilli > 0) {
        if (qtyMilli > item.pendingQty) {
          setError(
            `A quantidade recebida de ${item.materialName} (${qtyMilli / 1000}) excede o saldo pendente (${item.pendingQty / 1000}).`
          );
          return;
        }

        payloadItems.push({
          purchaseOrderItemId: item.purchaseOrderItemId,
          quantityMilli: qtyMilli,
          unitCostCents: item.unitCostCents,
        });

        if (item.productionJobId) {
          jobCandidate = item.productionJobId;
        }
      }
    }

    if (payloadItems.length === 0) {
      setError('Informe ao menos um item com quantidade a receber maior que zero.');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await recordGoodsReceipt({
        purchaseOrderId: selectedPurchaseOrder.id,
        invoiceNumber: invoiceNumber.trim() || undefined,
        idempotencyKey: idempotencyKey.trim() || undefined,
        notes: notes.trim() || undefined,
        items: payloadItems,
      });

      setCompletedReceipt(result.receipt);
      setAffectedJobId(jobCandidate);
      setIsRecordReceiptModalOpen(false);
    } catch (err: any) {
      setError(err.message || 'Erro ao registrar recebimento.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReserveForJob = async () => {
    if (!affectedJobId) return;
    try {
      const reqs = await getJobRequirements(affectedJobId);
      for (const req of reqs) {
        try {
          await reserveRequirement({
            requirementId: req.id,
            quantityMilli: req.requiredQuantityMilli,
          });
        } catch {
          // Se já estiver reservado ou parcial, ignora
        }
      }

      const job = jobs.find((j) => j.id === affectedJobId);
      if (job) {
        setSelectedJob(job);
        setActivePage('production');
      }
      setIsRecordReceiptModalOpen(false);
    } catch (err: any) {
      setError(err.message || 'Erro ao reservar para a OP.');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="record-receipt-title"
    >
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden my-8">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center">
              <PackageCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 id="record-receipt-title" className="text-base font-bold text-slate-900">
                Registrar Recebimento Físico
              </h3>
              <p className="text-xs text-slate-500">
                Pedido: <span className="font-mono font-semibold">{selectedPurchaseOrder.orderNumber}</span> —{' '}
                {selectedPurchaseOrder.supplierSnapshot.tradeName}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsRecordReceiptModalOpen(false)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tela de Sucesso Pós-Recebimento */}
        {completedReceipt ? (
          <div className="p-8 text-center space-y-5">
            <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto border border-emerald-100">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div>
              <h4 className="text-lg font-bold text-slate-900 mb-1">
                Recebimento {completedReceipt.receiptNumber} Concluído!
              </h4>
              <p className="text-xs text-slate-600 max-w-md mx-auto">
                O estoque físico foi atualizado, os custos médios ponderados foram recalculados e a movimentação imutável foi arquivada.
              </p>
            </div>

            {affectedJobId && (
              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 max-w-md mx-auto text-left space-y-3">
                <div className="flex items-start gap-2.5">
                  <BookmarkPlus className="w-5 h-5 text-blue-700 flex-shrink-0 mt-0.5" />
                  <div className="text-xs text-blue-950">
                    <span className="font-bold">Material recebido para Ordem de Produção:</span> O material necessário para a OP agora está disponível no estoque. Deseja realizar a reserva formal para produção?
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleReserveForJob}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors"
                >
                  Material recebido — reservar para a OP <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            <div className="pt-2">
              <button
                type="button"
                onClick={() => setIsRecordReceiptModalOpen(false)}
                className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold"
              >
                Fechar
              </button>
            </div>
          </div>
        ) : (
          /* Formulário de Recebimento */
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {error && (
              <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Número da Nota Fiscal (NF-e)
                </label>
                <input
                  type="text"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  placeholder="Ex: 001.234.567"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Chave de Idempotência
                </label>
                <input
                  type="text"
                  value={idempotencyKey}
                  onChange={(e) => setIdempotencyKey(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-600 focus:outline-none"
                  title="Chave única que previne duplicidade de lançamentos acidentais"
                />
              </div>
            </div>

            {/* Itens a Receber */}
            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-900 uppercase tracking-wider block">
                Conferência de Quantidades Entregues
              </label>

              <div className="space-y-2.5 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                {itemsState.map((row, idx) => {
                  const isFinished = row.pendingQty <= 0;

                  return (
                    <div
                      key={row.purchaseOrderItemId}
                      className={`p-3 rounded-xl border transition-all ${
                        isFinished
                          ? 'bg-slate-100/70 border-slate-200 opacity-60'
                          : 'bg-white border-slate-200 shadow-xs'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <div className="font-bold text-slate-900 text-xs">{row.materialName}</div>
                          <div className="text-[11px] text-slate-500 space-x-2">
                            <span>Pedido: {row.orderedQty / 1000} {row.unit}</span>
                            <span>•</span>
                            <span>Já recebido: {row.alreadyReceivedQty / 1000} {row.unit}</span>
                            <span>•</span>
                            <span className="font-semibold text-amber-800">
                              Pendente: {row.pendingQty / 1000} {row.unit}
                            </span>
                          </div>
                        </div>

                        {!isFinished && (
                          <div className="flex items-center gap-2">
                            <div className="w-32">
                              <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                                Qtd Entregue ({row.unit})
                              </label>
                              <input
                                type="number"
                                step="any"
                                min="0"
                                max={row.pendingQty / 1000}
                                value={row.receivingQty}
                                onChange={(e) => handleQtyChange(idx, e.target.value)}
                                className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-900 text-right focus:outline-none focus:border-slate-900"
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => handleReceiveAll(idx)}
                              className="px-2.5 py-1.5 mt-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-semibold transition-colors"
                            >
                              Tudo
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Observações do Recebimento</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Condições da embalagem, conferência física, divergências..."
                rows={2}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900"
              />
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsRecordReceiptModalOpen(false)}
                className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting || itemsState.every((item) => item.pendingQty <= 0)}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition-colors shadow-xs"
              >
                {isSubmitting ? 'Gravando Entrada...' : 'Confirmar Recebimento Físico'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
