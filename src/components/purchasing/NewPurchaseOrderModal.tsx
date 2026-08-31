import React, { useState, useEffect, useMemo } from 'react';
import { useArteFlow } from '../../context/ArteFlowContext';
import {
  X,
  ShoppingCart,
  AlertCircle,
  Plus,
  Trash2,
  FileText,
  Info,
} from 'lucide-react';
import { formatMoneyFromCents } from '../../domain/money';

interface OrderItemRow {
  materialId: string;
  quantity: string;
  unitCost: string; // Em reais (ex: "15.50")
  purchaseRequestItemId?: string;
  productionJobId?: string;
}

export const NewPurchaseOrderModal: React.FC = () => {
  const {
    isNewPurchaseOrderModalOpen,
    setIsNewPurchaseOrderModalOpen,
    suppliers,
    materials,
    purchaseRequests,
    purchaseRequestItems,
    createPurchaseOrder,
  } = useArteFlow();

  const activeSuppliers = suppliers.filter((s) => s.isActive);
  const activeMaterials = materials.filter((m) => m.isActive);

  const [supplierId, setSupplierId] = useState('');
  const [selectedRequestIds, setSelectedRequestIds] = useState<string[]>([]);
  const [items, setItems] = useState<OrderItemRow[]>([]);
  const [freight, setFreight] = useState<string>('0');
  const [discount, setDiscount] = useState<string>('0');
  const [expectedAt, setExpectedAt] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Solicitações abertas disponíveis
  const openRequests = useMemo(() => {
    return purchaseRequests.filter((r) => r.status === 'REQUESTED');
  }, [purchaseRequests]);

  useEffect(() => {
    if (isNewPurchaseOrderModalOpen) {
      setSupplierId(activeSuppliers[0]?.id || '');
      setSelectedRequestIds([]);
      setFreight('0');
      setDiscount('0');
      setExpectedAt('');
      setNotes('');
      setError(null);

      // Se houver solicitações abertas, carrega os itens da primeira por conveniência
      if (openRequests.length > 0) {
        const firstReq = openRequests[0];
        setSelectedRequestIds([firstReq.id]);
        const reqItems = purchaseRequestItems.filter((i) => i.purchaseRequestId === firstReq.id);
        setItems(
          reqItems.map((ri) => {
            const mat = materials.find((m) => m.id === ri.materialId);
            return {
              materialId: ri.materialId,
              quantity: String(ri.requestedQuantityMilli / 1000),
              unitCost: mat ? (mat.averageCostCents / 100).toFixed(2) : '0.00',
              purchaseRequestItemId: ri.id,
              productionJobId: ri.productionJobId,
            };
          })
        );
      } else {
        setItems([
          {
            materialId: activeMaterials[0]?.id || materials[0]?.id || '',
            quantity: '1',
            unitCost: activeMaterials[0]
              ? (activeMaterials[0].averageCostCents / 100).toFixed(2)
              : materials[0]
              ? (materials[0].averageCostCents / 100).toFixed(2)
              : '0.00',
          },
        ]);
      }
    }
  }, [isNewPurchaseOrderModalOpen, activeSuppliers.length, activeMaterials.length, openRequests.length]);

  // Tecla Escape para fechar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isNewPurchaseOrderModalOpen) {
        setIsNewPurchaseOrderModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isNewPurchaseOrderModalOpen, setIsNewPurchaseOrderModalOpen]);

  if (!isNewPurchaseOrderModalOpen) return null;

  // Alterna solicitação de compra selecionada para importar itens
  const handleToggleRequest = (reqId: string) => {
    const isSelected = selectedRequestIds.includes(reqId);
    let newSelected: string[];
    if (isSelected) {
      newSelected = selectedRequestIds.filter((id) => id !== reqId);
    } else {
      newSelected = [...selectedRequestIds, reqId];
    }
    setSelectedRequestIds(newSelected);

    // Reconstrói itens a partir das solicitações selecionadas
    const loadedItems: OrderItemRow[] = [];
    for (const id of newSelected) {
      const reqItems = purchaseRequestItems.filter((i) => i.purchaseRequestId === id);
      for (const ri of reqItems) {
        const mat = materials.find((m) => m.id === ri.materialId);
        loadedItems.push({
          materialId: ri.materialId,
          quantity: String(ri.requestedQuantityMilli / 1000),
          unitCost: mat ? (mat.averageCostCents / 100).toFixed(2) : '0.00',
          purchaseRequestItemId: ri.id,
          productionJobId: ri.productionJobId,
        });
      }
    }

    if (loadedItems.length > 0) {
      setItems(loadedItems);
    }
  };

  const handleAddItemRow = () => {
    const firstMat = activeMaterials[0];
    setItems((prev) => [
      ...prev,
      {
        materialId: firstMat?.id || '',
        quantity: '1',
        unitCost: firstMat ? (firstMat.averageCostCents / 100).toFixed(2) : '0.00',
      },
    ]);
  };

  const handleRemoveItemRow = (idx: number) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleItemChange = (idx: number, field: keyof OrderItemRow, val: string) => {
    setItems((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [field]: val };
      if (field === 'materialId') {
        const mat = materials.find((m) => m.id === val);
        if (mat) {
          copy[idx].unitCost = (mat.averageCostCents / 100).toFixed(2);
        }
      }
      return copy;
    });
  };

  // Cálculos dinâmicos em centavos
  const calculatedSubtotalCents = items.reduce((sum, item) => {
    const qty = parseFloat(item.quantity.replace(',', '.')) || 0;
    const cost = parseFloat(item.unitCost.replace(',', '.')) || 0;
    const qtyMilli = Math.round(qty * 1000);
    const costCents = Math.round(cost * 100);
    if (qtyMilli <= 0 || costCents < 0) return sum;
    return sum + Math.round((qtyMilli * costCents) / 1000);
  }, 0);

  const freightCents = Math.round((parseFloat(freight.replace(',', '.')) || 0) * 100);
  const discountCents = Math.round((parseFloat(discount.replace(',', '.')) || 0) * 100);
  const totalCents = Math.max(0, calculatedSubtotalCents + freightCents - discountCents);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!supplierId) {
      setError('Selecione um fornecedor homologado.');
      return;
    }
    if (items.length === 0) {
      setError('O pedido de compra deve conter ao menos um item.');
      return;
    }

    const payloadItems = [];
    for (const item of items) {
      if (!item.materialId) {
        setError('Selecione o material para todos os itens.');
        return;
      }
      const qty = parseFloat(item.quantity.replace(',', '.'));
      if (isNaN(qty) || qty <= 0) {
        setError('Informe uma quantidade válida e positiva para todos os itens.');
        return;
      }
      const cost = parseFloat(item.unitCost.replace(',', '.'));
      if (isNaN(cost) || cost < 0) {
        setError('Informe um custo unitário válido não-negativo para todos os itens.');
        return;
      }

      payloadItems.push({
        materialId: item.materialId,
        orderedQuantityMilli: Math.round(qty * 1000),
        unitCostCents: Math.round(cost * 100),
        purchaseRequestItemId: item.purchaseRequestItemId,
        productionJobId: item.productionJobId,
      });
    }

    if (discountCents > calculatedSubtotalCents + freightCents) {
      setError('O desconto não pode exceder o subtotal + frete do pedido.');
      return;
    }

    setIsSubmitting(true);
    try {
      await createPurchaseOrder({
        supplierId,
        items: payloadItems,
        freightCents,
        discountCents,
        expectedAt: expectedAt || undefined,
        notes: notes.trim() || undefined,
        purchaseRequestIds: selectedRequestIds,
      });

      setIsNewPurchaseOrderModalOpen(false);
    } catch (err: any) {
      setError(err.message || 'Erro ao criar pedido de compra.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-purchase-order-title"
    >
      <div className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl border border-slate-200 overflow-hidden my-8">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center">
              <ShoppingCart className="w-5 h-5" />
            </div>
            <div>
              <h3 id="new-purchase-order-title" className="text-base font-bold text-slate-900">
                Novo Pedido de Compra
              </h3>
              <p className="text-xs text-slate-500">
                Emissão de ordem de compra comercial para fornecedor homologado
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsNewPurchaseOrderModalOpen(false)}
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

          {/* Selecionar Solicitações Abertas (Se existirem) */}
          {openRequests.length > 0 && (
            <div className="bg-blue-50/60 border border-blue-100 rounded-xl p-3.5 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-blue-900">
                <FileText className="w-4 h-4 text-blue-600" />
                Vincular Solicitações de Compra em Aberto
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                {openRequests.map((req) => {
                  const isSelected = selectedRequestIds.includes(req.id);
                  return (
                    <button
                      key={req.id}
                      type="button"
                      onClick={() => handleToggleRequest(req.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                        isSelected
                          ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      {req.requestNumber} {req.jobCode ? `(OP ${req.jobCode})` : ''}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Fornecedor Homologado *
              </label>
              <select
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900"
                required
              >
                <option value="">Selecione o fornecedor...</option>
                {activeSuppliers.map((sup) => (
                  <option key={sup.id} value={sup.id}>
                    {sup.code} — {sup.tradeName} ({sup.document || 'Sem doc'})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Previsão de Entrega
              </label>
              <input
                type="date"
                value={expectedAt}
                onChange={(e) => setExpectedAt(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900"
              />
            </div>
          </div>

          {/* Itens do Pedido */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Itens e Custos do Pedido
              </label>
              <button
                type="button"
                onClick={handleAddItemRow}
                className="text-xs text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Adicionar Item
              </button>
            </div>

            <div className="space-y-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              {items.map((row, idx) => {
                const selectedMat = materials.find((m) => m.id === row.materialId);
                const itemQty = parseFloat(row.quantity.replace(',', '.')) || 0;
                const itemUnitCost = parseFloat(row.unitCost.replace(',', '.')) || 0;
                const itemTotal = itemQty * itemUnitCost;

                return (
                  <div
                    key={idx}
                    className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end bg-white p-3 rounded-lg border border-slate-200"
                  >
                    <div className="sm:col-span-4">
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

                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Qtd {selectedMat ? `(${selectedMat.unit})` : ''} *
                      </label>
                      <input
                        type="number"
                        step="any"
                        min="0.001"
                        value={row.quantity}
                        onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 font-semibold focus:outline-none focus:border-slate-900"
                        required
                      />
                    </div>

                    <div className="sm:col-span-3">
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Custo Unit. (R$) *
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={row.unitCost}
                        onChange={(e) => handleItemChange(idx, 'unitCost', e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 font-semibold focus:outline-none focus:border-slate-900"
                        required
                      />
                    </div>

                    <div className="sm:col-span-2 text-right">
                      <label className="block text-[11px] font-semibold text-slate-400 mb-1">Subtotal</label>
                      <div className="text-xs font-bold text-slate-900 py-1.5 whitespace-nowrap">
                        {formatMoneyFromCents(Math.round(itemTotal * 100))}
                      </div>
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

          {/* Resumo Financeiro */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-100">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Frete (R$)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={freight}
                onChange={(e) => setFreight(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Desconto (R$)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900"
              />
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-col justify-center text-right">
              <span className="text-xs text-slate-500 font-medium">Valor Total do Pedido</span>
              <span className="text-lg font-bold text-slate-900">
                {formatMoneyFromCents(totalCents)}
              </span>
            </div>
          </div>

          {/* Aviso Financeiro Honesto */}
          <div className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-xl flex items-start gap-2.5 text-xs text-amber-900">
            <Info className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" />
            <span>
              O vínculo deste pedido de compra com Contas a Pagar será implementado no módulo Financeiro.
            </span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Observações do Pedido</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Instruções de entrega, horário de recebimento, faturamento..."
              rows={2}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900"
            />
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsNewPurchaseOrderModalOpen(false)}
              className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition-colors shadow-xs"
            >
              {isSubmitting ? 'Gerando...' : 'Salvar Pedido (Rascunho)'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
