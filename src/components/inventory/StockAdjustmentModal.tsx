import React, { useState, useEffect, useRef } from 'react';
import { useArteFlow } from '../../context/ArteFlowContext';
import { MATERIAL_UNIT_LABELS } from '../../domain/constants';
import { parseQuantityInputToMilli, formatMilliToQuantity } from '../../domain/quantity';
import { X, SlidersHorizontal, CheckCircle2, AlertTriangle } from 'lucide-react';

export const StockAdjustmentModal: React.FC = () => {
  const {
    isStockAdjustmentModalOpen,
    setIsStockAdjustmentModalOpen,
    adjustmentTargetMaterial,
    setAdjustmentTargetMaterial,
    materials,
    adjustStock,
  } = useArteFlow();

  const [selectedMatId, setSelectedMatId] = useState('');
  const [adjustType, setAdjustType] = useState<'POSITIVE_ADJUSTMENT' | 'NEGATIVE_ADJUSTMENT' | 'RETURN'>('POSITIVE_ADJUSTMENT');
  const [quantityStr, setQuantityStr] = useState('');
  const [reason, setReason] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const triggerElementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isStockAdjustmentModalOpen) {
      triggerElementRef.current = document.activeElement as HTMLElement | null;

      if (adjustmentTargetMaterial) {
        setSelectedMatId(adjustmentTargetMaterial.id);
      } else if (materials.length > 0) {
        setSelectedMatId(materials[0].id);
      }

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') handleClose();
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isStockAdjustmentModalOpen, adjustmentTargetMaterial, materials]);

  const handleClose = () => {
    setIsStockAdjustmentModalOpen(false);
    setAdjustmentTargetMaterial(null);
    setErrorMsg('');
    setQuantityStr('');
    setReason('');
    setTimeout(() => {
      triggerElementRef.current?.focus();
    }, 0);
  };

  if (!isStockAdjustmentModalOpen) return null;

  const currentMat = materials.find((m) => m.id === selectedMatId);
  const qtyMilli = parseQuantityInputToMilli(quantityStr);
  const currentStock = currentMat?.stockOnHandMilli || 0;

  let newStock = currentStock;
  if (adjustType === 'POSITIVE_ADJUSTMENT' || adjustType === 'RETURN') {
    newStock = currentStock + qtyMilli;
  } else if (adjustType === 'NEGATIVE_ADJUSTMENT') {
    newStock = currentStock - qtyMilli;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!currentMat) {
      setErrorMsg('Selecione um material.');
      return;
    }
    if (qtyMilli <= 0) {
      setErrorMsg('A quantidade deve ser um número positivo maior que zero.');
      return;
    }
    if (!reason.trim()) {
      setErrorMsg('A justificativa do ajuste é obrigatória para fins de auditoria.');
      return;
    }
    if (adjustType === 'NEGATIVE_ADJUSTMENT' && currentStock - qtyMilli < 0) {
      setErrorMsg(
        `Ajuste negativo de ${qtyMilli / 1000} excede o saldo físico atual de ${currentStock / 1000}.`
      );
      return;
    }

    try {
      setIsSubmitting(true);
      await adjustStock({
        materialId: currentMat.id,
        type: adjustType,
        quantityMilli: qtyMilli,
        reason: reason.trim(),
      });

      handleClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao realizar ajuste de estoque.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="adjustment-modal-title"
      data-testid="adjustment-modal"
      className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4"
    >
      {/* Backdrop */}
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity" onClick={handleClose} />

      {/* Card */}
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden z-10 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center text-white">
              <SlidersHorizontal className="w-4 h-4" />
            </div>
            <div>
              <h3 id="adjustment-modal-title" className="text-base font-bold text-slate-900 leading-tight">
                Ajuste Manual de Estoque
              </h3>
              <p className="text-xs text-slate-500">
                Gera movimentação imutável com justificativa de auditoria
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            aria-label="Fechar modal de ajuste"
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-semibold">
              {errorMsg}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Material / SKU *
            </label>
            <select
              value={selectedMatId}
              onChange={(e) => setSelectedMatId(e.target.value)}
              className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-1 focus:ring-sky-500 focus:outline-none font-semibold text-slate-800"
            >
              {materials.map((m) => (
                <option key={m.id} value={m.id}>
                  [{m.sku}] {m.name} ({MATERIAL_UNIT_LABELS[m.unit].abbr})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Tipo de Ajuste *
            </label>
            <select
              value={adjustType}
              onChange={(e) => setAdjustType(e.target.value as any)}
              className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-1 focus:ring-sky-500 focus:outline-none font-semibold text-slate-800"
            >
              <option value="POSITIVE_ADJUSTMENT">Ajuste Positivo (+) — Contagem / Inventário</option>
              <option value="NEGATIVE_ADJUSTMENT">Ajuste Negativo (-) — Perda / Avaria / Quebra</option>
              <option value="RETURN">Devolução (+) — Retorno de sobra de produção</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Quantidade ({currentMat ? MATERIAL_UNIT_LABELS[currentMat.unit].abbr : 'un'}) *
            </label>
            <input
              type="text"
              required
              placeholder="Ex: 10"
              value={quantityStr}
              onChange={(e) => setQuantityStr(e.target.value)}
              className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-1 focus:ring-sky-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Justificativa Obrigatória *
            </label>
            <textarea
              rows={3}
              required
              placeholder="Ex: Ajuste decorrente da contagem física mensal do inventário..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-1 focus:ring-sky-500 focus:outline-none"
            />
          </div>

          {/* Simulation impact */}
          {currentMat && qtyMilli > 0 && (
            <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl space-y-1 text-xs">
              <div className="flex items-center gap-1.5 font-bold text-amber-900">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                <span>Impacto no Saldo Físico:</span>
              </div>
              <div className="flex items-center justify-between text-[11px] text-amber-800 pt-1">
                <span>
                  Saldo Atual: <strong>{formatMilliToQuantity(currentStock)} {MATERIAL_UNIT_LABELS[currentMat.unit].abbr}</strong>
                </span>
                <span>➔</span>
                <span>
                  Novo Saldo: <strong className={newStock < 0 ? 'text-red-600' : 'text-amber-900'}>{formatMilliToQuantity(newStock)} {MATERIAL_UNIT_LABELS[currentMat.unit].abbr}</strong>
                </span>
              </div>
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50/80 flex items-center justify-end gap-3 flex-shrink-0">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg transition-colors"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-5 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 active:bg-amber-800 disabled:opacity-50 rounded-lg shadow-sm transition-all flex items-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{isSubmitting ? 'Ajustando...' : 'Confirmar Ajuste'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
