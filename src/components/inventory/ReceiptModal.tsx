import React, { useState, useEffect, useRef } from 'react';
import { useArteFlow } from '../../context/ArteFlowContext';
import { MATERIAL_UNIT_LABELS } from '../../domain/constants';
import { parseQuantityInputToMilli, formatMilliToQuantity } from '../../domain/quantity';
import { parseBRLInputToCents, formatCentsToBRL } from '../../domain/money';
import { X, ArrowDownToLine, Calculator, CheckCircle2 } from 'lucide-react';

export const ReceiptModal: React.FC = () => {
  const {
    isReceiptModalOpen,
    setIsReceiptModalOpen,
    receiptTargetMaterial,
    setReceiptTargetMaterial,
    materials,
    recordReceipt,
  } = useArteFlow();

  const [selectedMatId, setSelectedMatId] = useState('');
  const [quantityStr, setQuantityStr] = useState('');
  const [unitCostStr, setUnitCostStr] = useState('0,00');
  const [supplierName, setSupplierName] = useState('');
  const [reason, setReason] = useState('Entrada de compra / NF-e');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const triggerElementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isReceiptModalOpen) {
      triggerElementRef.current = document.activeElement as HTMLElement | null;

      if (receiptTargetMaterial) {
        setSelectedMatId(receiptTargetMaterial.id);
        setSupplierName(receiptTargetMaterial.supplierName || '');
        setUnitCostStr(formatCentsToBRL(receiptTargetMaterial.averageCostCents).replace('R$', '').trim());
      } else if (materials.length > 0) {
        setSelectedMatId(materials[0].id);
      }

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') handleClose();
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isReceiptModalOpen, receiptTargetMaterial, materials]);

  const handleClose = () => {
    setIsReceiptModalOpen(false);
    setReceiptTargetMaterial(null);
    setErrorMsg('');
    setQuantityStr('');
    setTimeout(() => {
      triggerElementRef.current?.focus();
    }, 0);
  };

  if (!isReceiptModalOpen) return null;

  const currentMat = materials.find((m) => m.id === selectedMatId);
  const qtyMilli = parseQuantityInputToMilli(quantityStr);
  const unitCostCents = parseBRLInputToCents(unitCostStr);

  // Simulação de cálculo em tempo real
  const currentStock = currentMat?.stockOnHandMilli || 0;
  const currentAvg = currentMat?.averageCostCents || 0;
  const newStock = currentStock + qtyMilli;

  let simulatedAvgCost = currentAvg;
  if (currentMat && qtyMilli > 0 && unitCostCents > 0) {
    const currentVal = Math.round((currentStock / 1000) * currentAvg);
    const incomingVal = Math.round((qtyMilli / 1000) * unitCostCents);
    simulatedAvgCost = Math.round((currentVal + incomingVal) / (newStock / 1000));
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!currentMat) {
      setErrorMsg('Selecione um material.');
      return;
    }
    if (qtyMilli <= 0) {
      setErrorMsg('A quantidade de entrada deve ser maior que zero.');
      return;
    }

    try {
      setIsSubmitting(true);
      await recordReceipt({
        materialId: currentMat.id,
        quantityMilli: qtyMilli,
        unitCostCents: unitCostCents > 0 ? unitCostCents : undefined,
        supplierName: supplierName.trim() || undefined,
        reason: reason.trim() || 'Entrada de compra',
      });

      handleClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao registrar entrada de estoque.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="receipt-modal-title"
      data-testid="receipt-modal"
      className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4"
    >
      {/* Backdrop */}
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity" onClick={handleClose} />

      {/* Card */}
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden z-10 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white">
              <ArrowDownToLine className="w-4 h-4" />
            </div>
            <div>
              <h3 id="receipt-modal-title" className="text-base font-bold text-slate-900 leading-tight">
                Registrar Entrada de Material
              </h3>
              <p className="text-xs text-slate-500">
                Aumenta o saldo físico e recalcula o custo médio ponderado
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            aria-label="Fechar modal de entrada"
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
              className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-1 focus:ring-teal-500 focus:outline-none font-semibold text-slate-800"
            >
              {materials.map((m) => (
                <option key={m.id} value={m.id}>
                  [{m.sku}] {m.name} ({MATERIAL_UNIT_LABELS[m.unit].abbr})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Quantidade Recebida ({currentMat ? MATERIAL_UNIT_LABELS[currentMat.unit].abbr : 'un'}) *
              </label>
              <input
                type="text"
                required
                placeholder="Ex: 50"
                value={quantityStr}
                onChange={(e) => setQuantityStr(e.target.value)}
                className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-1 focus:ring-teal-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Custo Unitário da Entrada (R$)
              </label>
              <input
                type="text"
                placeholder="0,00"
                value={unitCostStr}
                onChange={(e) => setUnitCostStr(e.target.value)}
                className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-1 focus:ring-teal-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Fornecedor / Nota Fiscal
            </label>
            <input
              type="text"
              placeholder="Ex: Distribuidora Brasil / NF-e 4920"
              value={supplierName}
              onChange={(e) => setSupplierName(e.target.value)}
              className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-1 focus:ring-teal-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Justificativa / Motivo
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-1 focus:ring-teal-500 focus:outline-none"
            />
          </div>

          {/* Simulation Preview Card */}
          {currentMat && qtyMilli > 0 && (
            <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-2 text-xs">
              <div className="flex items-center gap-1.5 font-bold text-emerald-900">
                <Calculator className="w-4 h-4 text-emerald-700" />
                <span>Simulação do Impacto no Estoque:</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px] text-emerald-800">
                <div>
                  <span className="text-slate-500">Saldo Físico Atual: </span>
                  <span className="font-bold font-mono">
                    {formatMilliToQuantity(currentStock)} {MATERIAL_UNIT_LABELS[currentMat.unit].abbr}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">Novo Saldo Físico: </span>
                  <span className="font-bold font-mono text-emerald-900">
                    {formatMilliToQuantity(newStock)} {MATERIAL_UNIT_LABELS[currentMat.unit].abbr}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">Custo Médio Atual: </span>
                  <span className="font-bold font-mono">{formatCentsToBRL(currentAvg)}</span>
                </div>
                <div>
                  <span className="text-slate-500">Novo Custo Médio: </span>
                  <span className="font-bold font-mono text-emerald-900">
                    {formatCentsToBRL(simulatedAvgCost)}
                  </span>
                </div>
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
            className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 rounded-lg shadow-sm transition-all flex items-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{isSubmitting ? 'Registrando...' : 'Confirmar Entrada'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
