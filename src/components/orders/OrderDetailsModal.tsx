import React from 'react';
import { useArteFlow } from '../../context/ArteFlowContext';
import { OriginBadge } from '../common/OriginBadge';
import { formatCentsToBRL } from '../../domain/money';
import { formatISODateBR, formatISODateTimeBR } from '../../domain/jobStatus';
import {
  X,
  Building2,
  Package,
  ArrowRight,
} from 'lucide-react';

export const OrderDetailsModal: React.FC = () => {
  const {
    selectedOrder,
    isOrderDetailsModalOpen,
    setIsOrderDetailsModalOpen,
    jobs,
    stages,
    setSelectedJob,
    setIsJobDrawerOpen,
    setActivePage,
  } = useArteFlow();

  if (!isOrderDetailsModalOpen || !selectedOrder) return null;

  const orderJobs = jobs.filter((j) => j.orderId === selectedOrder.id);
  const stageMap = new Map(stages.map((s) => [s.id, s]));

  const handleOpenJob = (jobId: string) => {
    const job = jobs.find((j) => j.id === jobId);
    if (job) {
      setIsOrderDetailsModalOpen(false);
      setSelectedJob(job);
      setIsJobDrawerOpen(true);
      setActivePage('production');
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
        onClick={() => setIsOrderDetailsModalOpen(false)}
      />

      {/* Modal Card */}
      <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden z-10 flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900 font-mono">
                  {selectedOrder.orderNumber}
                </h3>
                <OriginBadge type="order" value={selectedOrder.origin} />
                <OriginBadge type="data" value={selectedOrder.dataOrigin} />
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Criado em {formatISODateTimeBR(selectedOrder.createdAt)}
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsOrderDetailsModalOpen(false)}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Customer Snapshot */}
          <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-sky-600" />
              <span>Cliente (Snapshot do Pedido)</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
              <div>
                <span className="text-slate-400 font-medium">Nome:</span>
                <p className="font-bold text-slate-900">{selectedOrder.customer.name}</p>
              </div>
              {selectedOrder.customer.document && (
                <div>
                  <span className="text-slate-400 font-medium">Documento:</span>
                  <p className="font-mono text-slate-800">{selectedOrder.customer.document}</p>
                </div>
              )}
              {selectedOrder.customer.phone && (
                <div>
                  <span className="text-slate-400 font-medium">Telefone:</span>
                  <p className="text-slate-800">{selectedOrder.customer.phone}</p>
                </div>
              )}
              {selectedOrder.customer.email && (
                <div>
                  <span className="text-slate-400 font-medium">E-mail:</span>
                  <p className="text-slate-800">{selectedOrder.customer.email}</p>
                </div>
              )}
              <div>
                <span className="text-slate-400 font-medium">Prazo Geral:</span>
                <p className="font-semibold text-slate-800">
                  {formatISODateBR(selectedOrder.deliveryDateISO)}
                </p>
              </div>
            </div>
          </div>

          {/* Items & Generated OPs */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <Package className="w-4 h-4 text-sky-600" />
              <span>Itens & Ordens de Produção ({selectedOrder.items.length})</span>
            </h4>

            <div className="space-y-3">
              {selectedOrder.items.map((item, idx) => {
                const linkedJob = orderJobs.find((j) => j.orderItemId === item.id || j.id === item.generatedJobId);
                const stage = linkedJob ? stageMap.get(linkedJob.stageId) : null;

                return (
                  <div
                    key={item.id || idx}
                    className="p-4 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-2"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Item #{idx + 1}
                        </span>
                        <h5 className="text-xs font-bold text-slate-900">{item.productName}</h5>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Setor: {item.sector} • Quantidade: {item.quantity} {item.unit}
                          {item.dimensions && (
                            <span> • {item.dimensions.width}x{item.dimensions.height} {item.dimensions.unit}</span>
                          )}
                        </p>
                      </div>

                      <div className="text-right">
                        <span className="text-xs font-bold text-slate-900 block">
                          {formatCentsToBRL(item.totalPriceCents)}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {formatCentsToBRL(item.unitPriceCents)} / {item.unit}
                        </span>
                      </div>
                    </div>

                    {/* Finishings */}
                    {item.finishings && item.finishings.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {item.finishings.map((f, fi) => (
                          <span
                            key={fi}
                            className="px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded text-[10px] text-slate-600"
                          >
                            {f}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Linked Production Job pill */}
                    {linkedJob && (
                      <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between bg-slate-50 p-2 rounded-lg">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-bold text-slate-900">
                            {linkedJob.jobCode}
                          </span>
                          <div className="flex items-center gap-1 text-[11px]">
                            <span
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: stage?.color || '#94a3b8' }}
                            />
                            <span className="font-medium text-slate-700">
                              {stage?.name || linkedJob.stageId}
                            </span>
                          </div>
                        </div>

                        <button
                          onClick={() => handleOpenJob(linkedJob.id)}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-sky-700 hover:text-sky-900 hover:underline"
                        >
                          <span>Ver OP no Fluxo</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Notes */}
          {selectedOrder.notes && (
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
              <span className="text-slate-400 font-semibold block mb-1">Observações do Pedido:</span>
              <p className="text-slate-700">{selectedOrder.notes}</p>
            </div>
          )}

          {/* Total */}
          <div className="p-4 bg-sky-50/50 rounded-xl border border-sky-100 flex items-center justify-between">
            <span className="text-xs font-semibold text-sky-900">Total do Pedido:</span>
            <span className="text-lg font-bold text-sky-900 font-mono">
              {formatCentsToBRL(selectedOrder.totalAmountCents)}
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end flex-shrink-0">
          <button
            onClick={() => setIsOrderDetailsModalOpen(false)}
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
