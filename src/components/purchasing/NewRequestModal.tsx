import React, { useState, useEffect } from 'react';
import { useArteFlow } from '../../context/ArteFlowContext';
import { PurchaseRequestSource } from '../../types/procurement';
import { X, FilePlus, AlertCircle, Plus, Trash2 } from 'lucide-react';

interface RequestItemRow {
  materialId: string;
  quantity: string;
  reason: string;
}

export const NewRequestModal: React.FC = () => {
  const {
    can = () => true,
    isNewRequestModalOpen,
    setIsNewRequestModalOpen,
    prefillRequestItem,
    setPrefillRequestItem,
    materials,
    jobs,
    createPurchaseRequest,
  } = useArteFlow();

  const [source, setSource] = useState<PurchaseRequestSource>('MANUAL');
  const [selectedJobId, setSelectedJobId] = useState<string>('');
  const [items, setItems] = useState<RequestItemRow[]>([
    { materialId: '', quantity: '', reason: '' },
  ]);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const activeMaterials = materials.filter((m) => m.isActive);

  useEffect(() => {
    if (isNewRequestModalOpen) {
      if (prefillRequestItem) {
        setSource(prefillRequestItem.source || 'MANUAL');
        setSelectedJobId(prefillRequestItem.productionJobId || '');
        setItems([
          {
            materialId: prefillRequestItem.materialId,
            quantity: prefillRequestItem.requestedQuantityMilli
              ? String(prefillRequestItem.requestedQuantityMilli / 1000)
              : '1',
            reason: prefillRequestItem.reason || 'Necessidade de compra identificada',
          },
        ]);
      } else {
        setSource('MANUAL');
        setSelectedJobId('');
        setItems([
          {
            materialId: activeMaterials[0]?.id || '',
            quantity: '1',
            reason: 'Reposição de estoque',
          },
        ]);
      }
      setNotes('');
      setError(null);
    }
  }, [isNewRequestModalOpen, prefillRequestItem, activeMaterials.length]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isNewRequestModalOpen) {
        setIsNewRequestModalOpen(false);
        setPrefillRequestItem(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isNewRequestModalOpen, setIsNewRequestModalOpen, setPrefillRequestItem]);

  if (!isNewRequestModalOpen || !can('arteflow.procurement.manage')) return null;

  const handleAddItemRow = () => {
    setItems((prev) => [
      ...prev,
      {
        materialId: activeMaterials[0]?.id || '',
        quantity: '1',
        reason: 'Necessidade adicional',
      },
    ]);
  };

  const handleRemoveItemRow = (idx: number) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleItemChange = (idx: number, field: keyof RequestItemRow, val: string) => {
    setItems((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [field]: val };
      return copy;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (items.length === 0) {
      setError('Adicione ao menos um material na solicitação.');
      return;
    }

    const payloadItems = [];
    for (const item of items) {
      if (!item.materialId) {
        setError('Selecione o material para todos os itens.');
        return;
      }
      const qtyNum = parseFloat(item.quantity.replace(',', '.'));
      if (isNaN(qtyNum) || qtyNum <= 0) {
        setError('Informe uma quantidade válida e positiva para todos os itens.');
        return;
      }
      const qtyMilli = Math.round(qtyNum * 1000);
      if (qtyMilli <= 0) {
        setError('A quantidade deve ser maior que zero.');
        return;
      }

      payloadItems.push({
        materialId: item.materialId,
        requestedQuantityMilli: qtyMilli,
        reason: item.reason.trim() || 'Necessidade de compra',
        productionJobId: selectedJobId || undefined,
      });
    }

    const linkedJob = jobs.find((j) => j.id === selectedJobId);

    setIsSubmitting(true);
    try {
      await createPurchaseRequest({
        source,
        productionJobId: selectedJobId || undefined,
        jobCode: linkedJob?.jobCode,
        notes: notes.trim() || undefined,
        items: payloadItems,
      });

      setIsNewRequestModalOpen(false);
      setPrefillRequestItem(null);
    } catch (err: any) {
      setError(err.message || 'Erro ao criar solicitação de compra.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-request-title"
    >
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden my-8">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center">
              <FilePlus className="w-5 h-5" />
            </div>
            <div>
              <h3 id="new-request-title" className="text-base font-bold text-slate-900">
                Nova Solicitação de Compra
              </h3>
              <p className="text-xs text-slate-500">
                Registre a necessidade de compra antes de gerar o pedido para o fornecedor
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setIsNewRequestModalOpen(false);
              setPrefillRequestItem(null);
            }}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Origem da Solicitação</label>
              <select
                value={source}
                onChange={(e) => setSource(e.target.value as any)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900"
              >
                <option value="MANUAL">Manual / Avulsa</option>
                <option value="MINIMUM_STOCK">Reposição de Estoque Mínimo</option>
                <option value="PRODUCTION_SHORTAGE">Falta em Ordem de Produção (OP)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Vincular a uma OP (Opcional)
              </label>
              <select
                value={selectedJobId}
                onChange={(e) => setSelectedJobId(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900"
              >
                <option value="">Nenhuma (Uso Geral)</option>
                {jobs.map((job) => (
                  <option key={job.id} value={job.id}>
                    {job.jobCode} — {job.productName} ({job.customer.name})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Itens */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Materiais Solicitados
              </label>
              <button
                type="button"
                onClick={handleAddItemRow}
                className="text-xs text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Adicionar Material
              </button>
            </div>

            <div className="space-y-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              {items.map((row, idx) => {
                const selectedMat = activeMaterials.find((m) => m.id === row.materialId);

                return (
                  <div
                    key={idx}
                    className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end bg-white p-3 rounded-lg border border-slate-200"
                  >
                    <div className="sm:col-span-5">
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">Material *</label>
                      <select
                        value={row.materialId}
                        onChange={(e) => handleItemChange(idx, 'materialId', e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-slate-900"
                        required
                      >
                        <option value="">Selecione um material...</option>
                        {activeMaterials.map((mat) => (
                          <option key={mat.id} value={mat.id}>
                            {mat.sku} — {mat.name} ({mat.unit})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="sm:col-span-3">
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Qtd {selectedMat ? `(${selectedMat.unit})` : ''} *
                      </label>
                      <input
                        type="number"
                        step="any"
                        min="0.001"
                        value={row.quantity}
                        onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                        placeholder="Ex: 5"
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 font-semibold focus:outline-none focus:border-slate-900"
                        required
                      />
                    </div>

                    <div className="sm:col-span-3">
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">Justificativa</label>
                      <input
                        type="text"
                        value={row.reason}
                        onChange={(e) => handleItemChange(idx, 'reason', e.target.value)}
                        placeholder="Ex: Reposição"
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-slate-900"
                      />
                    </div>

                    <div className="sm:col-span-1 flex justify-end">
                      {items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveItemRow(idx)}
                          className="p-1.5 rounded text-red-500 hover:text-red-700 hover:bg-red-50 transition-colors"
                          title="Remover item"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Observações Gerais</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Informações adicionais para o comprador..."
              rows={2}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900"
            />
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => {
                setIsNewRequestModalOpen(false);
                setPrefillRequestItem(null);
              }}
              className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition-colors shadow-xs"
            >
              {isSubmitting ? 'Gerando...' : 'Criar Solicitação de Compra'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
