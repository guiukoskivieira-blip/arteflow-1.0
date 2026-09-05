import React, { useState, useEffect, useRef } from 'react';
import { useArteFlow } from '../../context/ArteFlowContext';
import { StockMovement, StockReservation } from '../../types/inventory';
import { MATERIAL_UNIT_LABELS } from '../../domain/constants';
import { formatMilliToQuantity } from '../../domain/quantity';
import { formatCentsToBRL } from '../../domain/money';
import { formatISODateTimeBR } from '../../domain/jobStatus';
import {
  X,
  Package,
  Layers,
  ArrowDownToLine,
  SlidersHorizontal,
  History,
  AlertTriangle,
  Lock,
  Power,
} from 'lucide-react';

export const MaterialDetailsDrawer: React.FC = () => {
  const {
    can = () => true,
    selectedMaterial,
    isMaterialDrawerOpen,
    setIsMaterialDrawerOpen,
    getMaterialMovements,
    getMaterialReservations,
    getMaterialAvailability,
    updateMaterial,
    setIsReceiptModalOpen,
    setReceiptTargetMaterial,
    setIsStockAdjustmentModalOpen,
    setAdjustmentTargetMaterial,
  } = useArteFlow();
  const canManageInventory = can('arteflow.inventory.manage');

  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [reservations, setReservations] = useState<StockReservation[]>([]);
  const [availability, setAvailability] = useState<{
    stockOnHandMilli: number;
    reservedMilli: number;
    availableMilli: number;
  }>({ stockOnHandMilli: 0, reservedMilli: 0, availableMilli: 0 });

  const triggerElementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (selectedMaterial && isMaterialDrawerOpen) {
      triggerElementRef.current = document.activeElement as HTMLElement | null;

      Promise.all([
        getMaterialMovements(selectedMaterial.id),
        getMaterialReservations(selectedMaterial.id),
        getMaterialAvailability(selectedMaterial.id).catch(() => ({
          stockOnHandMilli: selectedMaterial.stockOnHandMilli,
          reservedMilli: 0,
          availableMilli: selectedMaterial.stockOnHandMilli,
        })),
      ]).then(([movs, res, avail]) => {
        setMovements(movs);
        setReservations(res);
        setAvailability(avail);
      });

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') handleClose();
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [selectedMaterial, isMaterialDrawerOpen, getMaterialMovements, getMaterialReservations, getMaterialAvailability]);

  const handleClose = () => {
    setIsMaterialDrawerOpen(false);
    setTimeout(() => {
      triggerElementRef.current?.focus();
    }, 0);
  };

  if (!isMaterialDrawerOpen || !selectedMaterial) return null;

  const unitLabel = MATERIAL_UNIT_LABELS[selectedMaterial.unit];
  const isBelowMin = selectedMaterial.isActive && availability.stockOnHandMilli < selectedMaterial.minimumStockMilli;

  const totalValueCents = Math.round(
    (availability.stockOnHandMilli / 1000) * selectedMaterial.averageCostCents
  );

  const activeReservations = reservations.filter((r) => r.status === 'ACTIVE');

  const handleToggleActive = async () => {
    if (!canManageInventory) return;
    await updateMaterial(selectedMaterial.id, {
      isActive: !selectedMaterial.isActive,
    });
  };

  const handleOpenReceipt = () => {
    if (!canManageInventory) return;
    setReceiptTargetMaterial(selectedMaterial);
    setIsReceiptModalOpen(true);
  };

  const handleOpenAdjustment = () => {
    if (!canManageInventory) return;
    setAdjustmentTargetMaterial(selectedMaterial);
    setIsStockAdjustmentModalOpen(true);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="material-drawer-title"
      data-testid="material-drawer"
      className="fixed inset-0 z-50 overflow-hidden flex justify-end"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
        onClick={handleClose}
      />

      {/* Slide-over Card */}
      <div className="relative w-full max-w-xl bg-white shadow-2xl border-l border-slate-200 flex flex-col h-full z-10">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/90 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-sky-600 flex items-center justify-center text-white shadow-sm">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-sky-800 bg-sky-50 border border-sky-200 px-1.5 py-0.2 rounded">
                  {selectedMaterial.sku}
                </span>
                {!selectedMaterial.isActive && (
                  <span className="text-[10px] font-bold px-1.5 py-0.2 bg-slate-200 text-slate-700 rounded">
                    INATIVO
                  </span>
                )}
                {isBelowMin && (
                  <span className="text-[10px] font-bold px-1.5 py-0.2 bg-amber-100 text-amber-800 border border-amber-300 rounded flex items-center gap-0.5">
                    <AlertTriangle className="w-3 h-3" />
                    ABAIXO DO MÍNIMO
                  </span>
                )}
              </div>
              <h3 id="material-drawer-title" className="text-base font-bold text-slate-900 leading-tight mt-0.5">
                {selectedMaterial.name}
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            aria-label="Fechar gaveta de detalhes do material"
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action bar */}
        {canManageInventory && <div className="px-6 py-2.5 bg-white border-b border-slate-200 flex items-center justify-between flex-wrap gap-2 flex-shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={handleOpenReceipt}
              className="px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg flex items-center gap-1.5 shadow-2xs transition-colors"
            >
              <ArrowDownToLine className="w-3.5 h-3.5" />
              <span>Entrada</span>
            </button>
            <button
              onClick={handleOpenAdjustment}
              className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg flex items-center gap-1.5 transition-colors"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Ajustar Saldo</span>
            </button>
          </div>

          <button
            onClick={handleToggleActive}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg flex items-center gap-1.5 border transition-colors ${
              selectedMaterial.isActive
                ? 'text-slate-600 hover:text-red-700 border-slate-200 hover:bg-red-50'
                : 'text-sky-700 hover:text-sky-900 border-sky-200 bg-sky-50'
            }`}
          >
            <Power className="w-3.5 h-3.5" />
            <span>{selectedMaterial.isActive ? 'Desativar Material' : 'Ativar Material'}</span>
          </button>
        </div>}

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Triad of Stock Balances */}
          <div className="grid grid-cols-3 gap-3">
            {/* Físico */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-center">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Estoque Físico</span>
              <span className="text-lg font-black text-slate-900 font-mono block mt-1">
                {formatMilliToQuantity(availability.stockOnHandMilli)}
              </span>
              <span className="text-[10px] text-slate-500">{unitLabel.abbr} em galpão</span>
            </div>

            {/* Reservado */}
            <div className="p-3.5 rounded-xl bg-sky-50/70 border border-sky-200 text-center">
              <span className="text-[10px] uppercase font-bold text-sky-700 block">Reservado</span>
              <span className="text-lg font-black text-sky-900 font-mono block mt-1">
                {formatMilliToQuantity(availability.reservedMilli)}
              </span>
              <span className="text-[10px] text-sky-700">{activeReservations.length} reservas OPs</span>
            </div>

            {/* Disponível */}
            <div
              className={`p-3.5 rounded-xl border text-center ${
                availability.availableMilli === 0
                  ? 'bg-red-50 border-red-200'
                  : 'bg-emerald-50/70 border-emerald-200'
              }`}
            >
              <span
                className={`text-[10px] uppercase font-bold block ${
                  availability.availableMilli === 0 ? 'text-red-700' : 'text-emerald-700'
                }`}
              >
                Disponível
              </span>
              <span
                className={`text-lg font-black font-mono block mt-1 ${
                  availability.availableMilli === 0 ? 'text-red-700' : 'text-emerald-900'
                }`}
              >
                {formatMilliToQuantity(availability.availableMilli)}
              </span>
              <span className="text-[10px] text-slate-500">livre para novas OPs</span>
            </div>
          </div>

          {/* Details Specification */}
          <div className="bg-slate-50/70 rounded-xl border border-slate-200 p-4 space-y-3">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-sky-600" />
              <span>Especificações & Custos</span>
            </h4>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-slate-400 block text-[11px]">Categoria:</span>
                <span className="font-semibold text-slate-800">{selectedMaterial.category}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Unidade Canônica:</span>
                <span className="font-semibold text-slate-800">
                  {unitLabel.label} ({unitLabel.abbr})
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Estoque Mínimo:</span>
                <span className="font-mono font-semibold text-slate-800">
                  {formatMilliToQuantity(selectedMaterial.minimumStockMilli)} {unitLabel.abbr}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Custo Médio Ponderado:</span>
                <span className="font-mono font-bold text-slate-900">
                  {formatCentsToBRL(selectedMaterial.averageCostCents)} / {unitLabel.abbr}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Valor Total Estimado:</span>
                <span className="font-mono font-bold text-sky-800">
                  {formatCentsToBRL(totalValueCents)}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Fornecedor Snapshot:</span>
                <span className="font-medium text-slate-700">
                  {selectedMaterial.supplierName || 'Não especificado'}
                </span>
              </div>
            </div>

            {isBelowMin && (
              <div className="mt-2 p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-xs">
                <strong>Material abaixo do mínimo</strong> — gere uma solicitação no módulo de Compras.
              </div>
            )}
          </div>

          {/* Active Reservations */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-sky-600" />
                <span>Reservas Ativas Vinculadas ({activeReservations.length})</span>
              </h4>
            </div>

            {activeReservations.length === 0 ? (
              <div className="p-4 rounded-xl border border-dashed border-slate-200 text-center text-xs text-slate-400">
                Nenhuma reserva ativa no momento para este material.
              </div>
            ) : (
              <div className="space-y-2">
                {activeReservations.map((res) => (
                  <div
                    key={res.id}
                    className="p-3 bg-white rounded-lg border border-slate-200 text-xs flex items-center justify-between shadow-2xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-sky-800">
                          {formatMilliToQuantity(res.reservedQuantityMilli)} {unitLabel.abbr}
                        </span>
                        <span className="text-slate-400">•</span>
                        <span className="font-semibold text-slate-700">OP: {res.productionJobId}</span>
                      </div>
                      <span className="text-[11px] text-slate-400">
                        Por {res.userName} em {formatISODateTimeBR(res.createdAt)}
                      </span>
                    </div>
                    <span className="px-2 py-0.5 bg-sky-50 text-sky-700 border border-sky-200 rounded text-[10px] font-bold">
                      RESERVADO
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Immutable Movements History (Append-Only) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <History className="w-3.5 h-3.5 text-sky-600" />
                <span>Histórico Imutável de Movimentações ({movements.length})</span>
              </h4>
            </div>

            {movements.length === 0 ? (
              <div className="p-4 rounded-xl border border-dashed border-slate-200 text-center text-xs text-slate-400">
                Nenhuma movimentação registrada.
              </div>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {movements.map((mov) => {
                  let badge = { text: 'ENTRADA', bg: 'bg-emerald-50 text-emerald-800 border-emerald-200' };
                  if (mov.type === 'CONSUMPTION') {
                    badge = { text: 'CONSUMO', bg: 'bg-blue-50 text-blue-800 border-blue-200' };
                  } else if (mov.type === 'POSITIVE_ADJUSTMENT') {
                    badge = { text: 'AJUSTE (+)', bg: 'bg-sky-50 text-sky-800 border-sky-200' };
                  } else if (mov.type === 'NEGATIVE_ADJUSTMENT') {
                    badge = { text: 'AJUSTE (-)', bg: 'bg-red-50 text-red-800 border-red-200' };
                  } else if (mov.type === 'RETURN') {
                    badge = { text: 'DEVOLUÇÃO', bg: 'bg-purple-50 text-purple-800 border-purple-200' };
                  }

                  return (
                    <div
                      key={mov.id}
                      className="p-3 bg-white rounded-lg border border-slate-200 text-xs space-y-1 shadow-2xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className={`px-1.5 py-0.2 rounded border text-[10px] font-bold ${badge.bg}`}>
                          {badge.text}
                        </span>
                        <span className="text-[11px] text-slate-400">{formatISODateTimeBR(mov.createdAt)}</span>
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <span className="font-semibold text-slate-800">{mov.reason}</span>
                        <span className="font-mono font-bold text-slate-900">
                          {formatMilliToQuantity(mov.quantityMilli)} {unitLabel.abbr}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-500 pt-0.5 border-t border-slate-100">
                        <span>
                          Saldo: {formatMilliToQuantity(mov.previousBalanceMilli)} ➔{' '}
                          <strong>{formatMilliToQuantity(mov.resultingBalanceMilli)}</strong> {unitLabel.abbr}
                        </span>
                        <span>Resp: {mov.userName}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
