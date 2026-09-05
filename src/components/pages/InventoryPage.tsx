import React, { useMemo } from 'react';
import { useArteFlow } from '../../context/ArteFlowContext';
import { InventoryFilters } from '../inventory/InventoryFilters';
import { MATERIAL_UNIT_LABELS } from '../../domain/constants';
import { formatMilliToQuantity } from '../../domain/quantity';
import { formatCentsToBRL } from '../../domain/money';
import { OriginBadge } from '../common/OriginBadge';
import {
  Package,
  ArrowDownToLine,
  SlidersHorizontal,
  Plus,
  AlertTriangle,
  Lock,
  Boxes,
  DollarSign,
  Eye,
} from 'lucide-react';

export const InventoryPage: React.FC = () => {
  const {
    can = () => true,
    materials,
    reservations,
    materialFilter,
    setSelectedMaterial,
    setIsMaterialDrawerOpen,
    setIsNewMaterialModalOpen,
    setIsReceiptModalOpen,
    setIsStockAdjustmentModalOpen,
    setReceiptTargetMaterial,
    setAdjustmentTargetMaterial,
  } = useArteFlow();
  const canManageInventory = can('arteflow.inventory.manage');

  // Mapa de reservas ativas por material
  const activeReservationsMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const res of reservations) {
      if (res.status === 'ACTIVE') {
        const current = map.get(res.materialId) || 0;
        map.set(res.materialId, current + res.reservedQuantityMilli);
      }
    }
    return map;
  }, [reservations]);

  // Filtragem de materiais
  const filteredMaterials = useMemo(() => {
    return materials.filter((m) => {
      // Busca por nome ou SKU
      if (materialFilter.searchQuery.trim()) {
        const q = materialFilter.searchQuery.trim().toLowerCase();
        const matchesName = m.name.toLowerCase().includes(q);
        const matchesSku = m.sku.toLowerCase().includes(q);
        if (!matchesName && !matchesSku) return false;
      }

      // Categoria
      if (materialFilter.category !== 'ALL' && m.category !== materialFilter.category) {
        return false;
      }

      // Unidade
      if (materialFilter.unit !== 'ALL' && m.unit !== materialFilter.unit) {
        return false;
      }

      // Status
      if (materialFilter.status === 'ACTIVE' && !m.isActive) return false;
      if (materialFilter.status === 'INACTIVE' && m.isActive) return false;

      // Origem
      if (materialFilter.dataOrigin !== 'ALL' && m.dataOrigin !== materialFilter.dataOrigin) {
        return false;
      }

      // Abaixo do mínimo
      if (materialFilter.belowMinimumOnly) {
        if (!m.isActive || m.stockOnHandMilli >= m.minimumStockMilli) return false;
      }

      return true;
    });
  }, [materials, materialFilter]);

  // Métricas do Topo
  const activeMaterialsCount = materials.filter((m) => m.isActive).length;
  const belowMinCount = materials.filter(
    (m) => m.isActive && m.stockOnHandMilli < m.minimumStockMilli
  ).length;

  const totalReservationsCount = reservations.filter((r) => r.status === 'ACTIVE').length;

  const totalEstimatedValueCents = materials.reduce((acc, m) => {
    if (!m.isActive) return acc;
    return acc + Math.round((m.stockOnHandMilli / 1000) * m.averageCostCents);
  }, 0);

  const handleOpenDetails = (mat: typeof materials[0]) => {
    setSelectedMaterial(mat);
    setIsMaterialDrawerOpen(true);
  };

  const handleOpenReceipt = (mat: typeof materials[0], e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canManageInventory) return;
    setReceiptTargetMaterial(mat);
    setIsReceiptModalOpen(true);
  };

  const handleOpenAdjustment = (mat: typeof materials[0], e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canManageInventory) return;
    setAdjustmentTargetMaterial(mat);
    setIsStockAdjustmentModalOpen(true);
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-slate-50">
      {/* Top Banner & Action Bar */}
      <div className="bg-white border-b border-slate-200/80 px-4 md:px-6 py-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 flex-shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg md:text-xl font-bold text-slate-900 leading-tight">
              Estoque de Materiais & Insumos
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Controle de saldo físico, reservas ativas e disponibilidade para Ordens de Produção
          </p>
        </div>

        {canManageInventory && <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setIsReceiptModalOpen(true)}
            className="px-3 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg transition-colors flex items-center gap-1.5 shadow-2xs"
          >
            <ArrowDownToLine className="w-3.5 h-3.5 text-emerald-600" />
            <span>Entrada</span>
          </button>

          <button
            onClick={() => setIsStockAdjustmentModalOpen(true)}
            className="px-3 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg transition-colors flex items-center gap-1.5 shadow-2xs"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-amber-600" />
            <span>Ajustar Saldo</span>
          </button>

          <button
            onClick={() => setIsNewMaterialModalOpen(true)}
            className="px-3.5 py-2 text-xs font-bold text-white bg-sky-600 hover:bg-sky-700 active:bg-sky-800 rounded-lg shadow-sm transition-all flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Novo Material</span>
          </button>
        </div>}
      </div>

      {/* KPI Cards Row */}
      <div className="p-4 md:px-6 md:pt-4 md:pb-2 grid grid-cols-2 lg:grid-cols-4 gap-3 flex-shrink-0">
        {/* Materiais Ativos */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span className="font-semibold">Materiais Ativos</span>
            <Boxes className="w-4 h-4 text-sky-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl font-black text-slate-900 font-mono">{activeMaterialsCount}</span>
            <span className="text-[11px] text-slate-400">itens no catálogo</span>
          </div>
        </div>

        {/* Valor Total Estimado */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span className="font-semibold">Valor em Estoque</span>
            <DollarSign className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl font-black text-slate-900 font-mono">
              {formatCentsToBRL(totalEstimatedValueCents)}
            </span>
          </div>
        </div>

        {/* Abaixo do Mínimo */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span className="font-semibold">Abaixo do Mínimo</span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span
              className={`text-xl font-black font-mono ${
                belowMinCount > 0 ? 'text-amber-600' : 'text-slate-900'
              }`}
            >
              {belowMinCount}
            </span>
            <span className="text-[11px] text-slate-400">demandam compra</span>
          </div>
        </div>

        {/* Reservas Ativas */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span className="font-semibold">Reservas Ativas</span>
            <Lock className="w-4 h-4 text-sky-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl font-black text-slate-900 font-mono">{totalReservationsCount}</span>
            <span className="text-[11px] text-slate-400">empenhos em OPs</span>
          </div>
        </div>
      </div>

      {/* Filter Component */}
      <InventoryFilters />

      {/* Materials Table Area */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 md:px-6 py-4">
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50/90 text-slate-700 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-200 select-none">
                <tr>
                  <th className="px-4 py-3">SKU</th>
                  <th className="px-4 py-3">Material & Categoria</th>
                  <th className="px-4 py-3">Unidade</th>
                  <th className="px-4 py-3 text-right">Estoque Físico</th>
                  <th className="px-4 py-3 text-right">Reservado</th>
                  <th className="px-4 py-3 text-right">Disponível</th>
                  <th className="px-4 py-3 text-right">Estoque Mín.</th>
                  <th className="px-4 py-3 text-right">Custo Médio</th>
                  <th className="px-4 py-3 text-center">Situação</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {filteredMaterials.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-12 text-center text-slate-400">
                      <Package className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                      <p className="font-semibold text-sm text-slate-600">Nenhum material encontrado</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Tente ajustar os filtros de pesquisa ou cadastre um novo material
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredMaterials.map((mat) => {
                    const unitInfo = MATERIAL_UNIT_LABELS[mat.unit];
                    const reservedMilli = activeReservationsMap.get(mat.id) || 0;
                    const availableMilli = Math.max(0, mat.stockOnHandMilli - reservedMilli);
                    const isBelowMin = mat.isActive && mat.stockOnHandMilli < mat.minimumStockMilli;
                    const isOut = mat.isActive && availableMilli === 0;

                    return (
                      <tr
                        key={mat.id}
                        onClick={() => handleOpenDetails(mat)}
                        className="hover:bg-slate-50/80 cursor-pointer transition-colors group"
                      >
                        {/* SKU */}
                        <td className="px-4 py-3 font-mono font-bold text-slate-900 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <span className="bg-slate-100 group-hover:bg-sky-50 group-hover:text-sky-900 border border-slate-200 px-1.5 py-0.5 rounded text-[11px] transition-colors">
                              {mat.sku}
                            </span>
                            <OriginBadge type="data" value={mat.dataOrigin} />
                          </div>
                        </td>

                        {/* Nome & Categoria */}
                        <td className="px-4 py-3">
                          <div className="font-bold text-slate-900 text-xs">{mat.name}</div>
                          <div className="text-[11px] text-slate-400">{mat.category}</div>
                        </td>

                        {/* Unidade */}
                        <td className="px-4 py-3 font-semibold text-slate-700 whitespace-nowrap">
                          {unitInfo.abbr}
                        </td>

                        {/* Saldo Físico */}
                        <td className="px-4 py-3 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                          {formatMilliToQuantity(mat.stockOnHandMilli)}
                        </td>

                        {/* Reservado */}
                        <td className="px-4 py-3 text-right font-mono font-semibold text-sky-700 whitespace-nowrap">
                          {reservedMilli > 0 ? formatMilliToQuantity(reservedMilli) : '—'}
                        </td>

                        {/* Disponível */}
                        <td className="px-4 py-3 text-right font-mono font-black whitespace-nowrap">
                          <span
                            className={
                              isOut
                                ? 'text-red-600 bg-red-50 px-1.5 py-0.5 rounded'
                                : 'text-emerald-700'
                            }
                          >
                            {formatMilliToQuantity(availableMilli)}
                          </span>
                        </td>

                        {/* Estoque Mínimo */}
                        <td className="px-4 py-3 text-right font-mono text-slate-500 whitespace-nowrap">
                          {formatMilliToQuantity(mat.minimumStockMilli)}
                        </td>

                        {/* Custo Médio */}
                        <td className="px-4 py-3 text-right font-mono font-bold text-slate-800 whitespace-nowrap">
                          {formatCentsToBRL(mat.averageCostCents)}
                        </td>

                        {/* Situação */}
                        <td className="px-4 py-3 text-center whitespace-nowrap">
                          {!mat.isActive ? (
                            <span className="px-2 py-0.5 bg-slate-100 text-slate-600 border border-slate-200 rounded text-[10px] font-bold">
                              Inativo
                            </span>
                          ) : isBelowMin ? (
                            <span className="px-2 py-0.5 bg-amber-50 text-amber-800 border border-amber-300 rounded text-[10px] font-bold inline-flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3 text-amber-600" />
                              Abaixo Mín.
                            </span>
                          ) : isOut ? (
                            <span className="px-2 py-0.5 bg-red-50 text-red-800 border border-red-200 rounded text-[10px] font-bold">
                              Sem Saldo
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded text-[10px] font-bold">
                              Normal
                            </span>
                          )}
                        </td>

                        {/* Ações */}
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1">
                            {canManageInventory && <button
                              onClick={(e) => handleOpenReceipt(mat, e)}
                              className="p-1 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded transition-colors"
                              title="Registrar Entrada"
                            >
                              <ArrowDownToLine className="w-3.5 h-3.5" />
                            </button>}
                            {canManageInventory && <button
                              onClick={(e) => handleOpenAdjustment(mat, e)}
                              className="p-1 text-slate-500 hover:text-amber-700 hover:bg-amber-50 rounded transition-colors"
                              title="Ajustar Saldo"
                            >
                              <SlidersHorizontal className="w-3.5 h-3.5" />
                            </button>}
                            <button
                              onClick={() => handleOpenDetails(mat)}
                              className="p-1 text-slate-500 hover:text-sky-700 hover:bg-sky-50 rounded transition-colors"
                              title="Ver Detalhes e Histórico"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
