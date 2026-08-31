import React from 'react';
import { useArteFlow } from '../../context/ArteFlowContext';
import { MATERIAL_CATEGORIES, MATERIAL_UNITS, MATERIAL_UNIT_LABELS } from '../../domain/constants';
import { Search, RotateCcw, AlertTriangle, Filter } from 'lucide-react';

export const InventoryFilters: React.FC = () => {
  const { materialFilter, setMaterialFilter, resetMaterialFilter, materials } = useArteFlow();

  const activeFiltersCount = [
    materialFilter.category !== 'ALL',
    materialFilter.unit !== 'ALL',
    materialFilter.belowMinimumOnly,
    materialFilter.status !== 'ALL',
    materialFilter.dataOrigin !== 'ALL',
  ].filter(Boolean).length;

  const totalBelowMin = materials.filter(
    (m) => m.isActive && m.stockOnHandMilli < m.minimumStockMilli
  ).length;

  return (
    <div className="bg-white border-b border-slate-200/80 px-4 md:px-6 py-3 space-y-3 flex-shrink-0">
      {/* Top line: Search and quick filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search input */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Pesquisar por nome do material ou SKU..."
            value={materialFilter.searchQuery}
            onChange={(e) => setMaterialFilter({ searchQuery: e.target.value })}
            className="w-full pl-9 pr-8 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all placeholder:text-slate-400"
          />
          {materialFilter.searchQuery && (
            <button
              onClick={() => setMaterialFilter({ searchQuery: '' })}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
            >
              ×
            </button>
          )}
        </div>

        {/* Quick actions & below minimum toggle */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          <button
            type="button"
            onClick={() =>
              setMaterialFilter({
                belowMinimumOnly: !materialFilter.belowMinimumOnly,
              })
            }
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all flex-shrink-0 border ${
              materialFilter.belowMinimumOnly
                ? 'bg-amber-500 text-white border-amber-600 shadow-xs'
                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Abaixo do Mínimo</span>
            {totalBelowMin > 0 && (
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  materialFilter.belowMinimumOnly ? 'bg-amber-700 text-white' : 'bg-amber-100 text-amber-800'
                }`}
              >
                {totalBelowMin}
              </span>
            )}
          </button>

          {activeFiltersCount > 0 && (
            <button
              onClick={resetMaterialFilter}
              className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors flex-shrink-0 text-xs flex items-center gap-1"
              title="Limpar todos os filtros"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Limpar</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter dropdowns row */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
        <span className="text-[11px] font-bold uppercase text-slate-400 flex items-center gap-1 flex-shrink-0 mr-1">
          <Filter className="w-3 h-3" />
          Filtros:
        </span>

        {/* Category */}
        <select
          value={materialFilter.category}
          onChange={(e) => setMaterialFilter({ category: e.target.value })}
          className="px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 text-xs focus:ring-1 focus:ring-sky-500 focus:outline-none flex-shrink-0 cursor-pointer"
        >
          <option value="ALL">Todas as Categorias</option>
          {MATERIAL_CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>

        {/* Unit */}
        <select
          value={materialFilter.unit}
          onChange={(e) => setMaterialFilter({ unit: e.target.value })}
          className="px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 text-xs focus:ring-1 focus:ring-sky-500 focus:outline-none flex-shrink-0 cursor-pointer"
        >
          <option value="ALL">Todas as Unidades</option>
          {MATERIAL_UNITS.map((u) => (
            <option key={u} value={u}>
              {MATERIAL_UNIT_LABELS[u].label} ({MATERIAL_UNIT_LABELS[u].abbr})
            </option>
          ))}
        </select>

        {/* Status */}
        <select
          value={materialFilter.status}
          onChange={(e) => setMaterialFilter({ status: e.target.value as any })}
          className="px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 text-xs focus:ring-1 focus:ring-sky-500 focus:outline-none flex-shrink-0 cursor-pointer"
        >
          <option value="ALL">Todos os Status</option>
          <option value="ACTIVE">Apenas Ativos</option>
          <option value="INACTIVE">Inativos</option>
        </select>

        {/* Origin */}
        <select
          value={materialFilter.dataOrigin}
          onChange={(e) => setMaterialFilter({ dataOrigin: e.target.value as any })}
          className="px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 text-xs focus:ring-1 focus:ring-sky-500 focus:outline-none flex-shrink-0 cursor-pointer"
        >
          <option value="ALL">Todas as Origens</option>
          <option value="user">Criados pelo Usuário</option>
          <option value="demo">Demonstração</option>
        </select>
      </div>
    </div>
  );
};
