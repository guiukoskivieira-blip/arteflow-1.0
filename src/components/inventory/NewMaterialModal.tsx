import React, { useState, useEffect, useRef } from 'react';
import { useArteFlow } from '../../context/ArteFlowContext';
import { MaterialUnit } from '../../types/inventory';
import { MATERIAL_CATEGORIES, MATERIAL_UNITS, MATERIAL_UNIT_LABELS } from '../../domain/constants';
import { parseQuantityInputToMilli } from '../../domain/quantity';
import { parseBRLInputToCents } from '../../domain/money';
import { X, PackagePlus, Sparkles, Building2 } from 'lucide-react';

export const NewMaterialModal: React.FC = () => {
  const { isNewMaterialModalOpen, setIsNewMaterialModalOpen, createMaterial } = useArteFlow();

  const [sku, setSku] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState(MATERIAL_CATEGORIES[0]);
  const [unit, setUnit] = useState<MaterialUnit>('UNIT');
  const [initialStockStr, setInitialStockStr] = useState('0');
  const [minStockStr, setMinStockStr] = useState('0');
  const [unitCostStr, setUnitCostStr] = useState('0,00');
  const [supplierName, setSupplierName] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const triggerElementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isNewMaterialModalOpen) {
      triggerElementRef.current = document.activeElement as HTMLElement | null;

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          handleClose();
        }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isNewMaterialModalOpen]);

  const handleClose = () => {
    setIsNewMaterialModalOpen(false);
    setErrorMsg('');
    setTimeout(() => {
      triggerElementRef.current?.focus();
    }, 0);
  };

  if (!isNewMaterialModalOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!sku.trim()) {
      setErrorMsg('O código SKU é obrigatório.');
      return;
    }
    if (!name.trim()) {
      setErrorMsg('O nome do material é obrigatório.');
      return;
    }

    const initialStockMilli = parseQuantityInputToMilli(initialStockStr);
    const minStockMilli = parseQuantityInputToMilli(minStockStr);
    const unitCostCents = parseBRLInputToCents(unitCostStr);

    if (initialStockMilli < 0) {
      setErrorMsg('O estoque inicial não pode ser negativo.');
      return;
    }
    if (minStockMilli < 0) {
      setErrorMsg('O estoque mínimo não pode ser negativo.');
      return;
    }

    try {
      setIsSubmitting(true);
      await createMaterial({
        sku: sku.trim().toUpperCase(),
        name: name.trim(),
        category,
        unit,
        initialStockMilli,
        minimumStockMilli: minStockMilli,
        unitCostCents,
        supplierName: supplierName.trim() || undefined,
        dataOrigin: 'user',
      });

      // Reset form
      setSku('');
      setName('');
      setCategory(MATERIAL_CATEGORIES[0]);
      setUnit('UNIT');
      setInitialStockStr('0');
      setMinStockStr('0');
      setUnitCostStr('0,00');
      setSupplierName('');

      handleClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao cadastrar material.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-material-modal-title"
      data-testid="new-material-modal"
      className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
        onClick={handleClose}
      />

      {/* Card */}
      <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden z-10 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-sky-600 flex items-center justify-center text-white">
              <PackagePlus className="w-4 h-4" />
            </div>
            <div>
              <h3 id="new-material-modal-title" className="text-base font-bold text-slate-900 leading-tight">
                Novo Material de Estoque
              </h3>
              <p className="text-xs text-slate-500">
                Cadastre a matéria-prima ou insumo com unidade canônica e estoque mínimo
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            aria-label="Fechar modal de novo material"
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-semibold">
              {errorMsg}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                SKU / Código *
              </label>
              <input
                type="text"
                required
                placeholder="Ex: MAT-PAP-300"
                value={sku}
                onChange={(e) => setSku(e.target.value.toUpperCase())}
                className="w-full text-xs font-mono font-bold px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-1 focus:ring-sky-500 focus:outline-none uppercase"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nome do Material / Especificação *
              </label>
              <input
                type="text"
                required
                placeholder="Ex: Papel Couchê 300g Brilho 66x96cm"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-1 focus:ring-sky-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Categoria
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-1 focus:ring-sky-500 focus:outline-none"
              >
                {MATERIAL_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Unidade de Medida Canônica *
              </label>
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value as MaterialUnit)}
                className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-1 focus:ring-sky-500 focus:outline-none font-semibold text-sky-800"
              >
                {MATERIAL_UNITS.map((u) => (
                  <option key={u} value={u}>
                    {MATERIAL_UNIT_LABELS[u].label} ({MATERIAL_UNIT_LABELS[u].abbr}) — {MATERIAL_UNIT_LABELS[u].description}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Saldos Iniciais & Parâmetros de Estoque
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Estoque Inicial ({MATERIAL_UNIT_LABELS[unit].abbr})
                </label>
                <input
                  type="text"
                  placeholder="0"
                  value={initialStockStr}
                  onChange={(e) => setInitialStockStr(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-1 focus:ring-sky-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Estoque Mínimo ({MATERIAL_UNIT_LABELS[unit].abbr})
                </label>
                <input
                  type="text"
                  placeholder="0"
                  value={minStockStr}
                  onChange={(e) => setMinStockStr(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-1 focus:ring-sky-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Custo Unitário (R$)
                </label>
                <input
                  type="text"
                  placeholder="0,00"
                  value={unitCostStr}
                  onChange={(e) => setUnitCostStr(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-1 focus:ring-sky-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
              <Building2 className="w-3.5 h-3.5 text-slate-400" />
              <span>Fornecedor Principal (Snapshot Textual)</span>
            </label>
            <input
              type="text"
              placeholder="Ex: Distribuidora Papéis Brasil Ltda"
              value={supplierName}
              onChange={(e) => setSupplierName(e.target.value)}
              className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-1 focus:ring-sky-500 focus:outline-none"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              * Cadastros de fornecedores e solicitações estão disponíveis no módulo de Compras.
            </p>
          </div>
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
            className="px-5 py-2 text-xs font-bold text-white bg-sky-600 hover:bg-sky-700 active:bg-sky-800 disabled:opacity-50 rounded-lg shadow-sm transition-all flex items-center gap-2"
          >
            <Sparkles className="w-4 h-4" />
            <span>{isSubmitting ? 'Cadastrando...' : 'Cadastrar Material'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
