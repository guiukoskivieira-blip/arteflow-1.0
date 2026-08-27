import React from 'react';
import { useArteFlow } from '../../context/ArteFlowContext';
import { SECTORS, DEMO_USERS } from '../../domain/constants';
import { Priority } from '../../types/domain';
import {
  Search,
  Filter,
  X,
  Kanban,
  List,
  RotateCcw,
} from 'lucide-react';

export const ProductionFilters: React.FC = () => {
  const { filter, setFilter, resetFilter, viewMode, setViewMode } = useArteFlow();

  const isFiltered =
    Boolean(filter.searchQuery) ||
    filter.stageId !== 'ALL' ||
    filter.priority !== 'ALL' ||
    filter.sector !== 'ALL' ||
    filter.assigneeId !== 'ALL' ||
    filter.deadlineRange !== 'ALL' ||
    filter.gateStatus !== 'ALL' ||
    filter.dataOrigin !== 'ALL';

  return (
    <div className="bg-white border-b border-slate-200/80 px-4 md:px-6 py-3 space-y-3 flex-shrink-0">
      {/* Top row: Search input + View Switcher */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-lg">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Pesquisar por cliente, pedido, OP, produto ou setor..."
            value={filter.searchQuery || ''}
            onChange={(e) => setFilter({ searchQuery: e.target.value })}
            className="w-full pl-9 pr-8 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all placeholder:text-slate-400"
          />
          {filter.searchQuery && (
            <button
              onClick={() => setFilter({ searchQuery: '' })}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600 rounded"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* View Switcher & Clear Filters */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
          {isFiltered && (
            <button
              onClick={resetFilter}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg border border-slate-200 transition-colors"
              title="Limpar todos os filtros"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Limpar filtros</span>
            </button>
          )}

          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
            <button
              onClick={() => setViewMode('kanban')}
              className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                viewMode === 'kanban'
                  ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Kanban className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Quadro</span>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                viewMode === 'list'
                  ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Lista</span>
            </button>
          </div>
        </div>
      </div>

      {/* Second row: Dropdown Filters */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs no-scrollbar">
        <div className="flex items-center gap-1 text-slate-400 text-xs flex-shrink-0 mr-1">
          <Filter className="w-3.5 h-3.5" />
          <span className="font-medium">Filtros:</span>
        </div>

        {/* Prioridade */}
        <select
          value={filter.priority || 'ALL'}
          onChange={(e) => setFilter({ priority: e.target.value as Priority | 'ALL' })}
          className="px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 text-xs focus:ring-1 focus:ring-teal-500 focus:outline-none flex-shrink-0 cursor-pointer"
        >
          <option value="ALL">Todas Prioridades</option>
          <option value="LOW">Baixa</option>
          <option value="MEDIUM">Média</option>
          <option value="HIGH">Alta</option>
          <option value="URGENT">Urgente</option>
        </select>

        {/* Setor */}
        <select
          value={filter.sector || 'ALL'}
          onChange={(e) => setFilter({ sector: e.target.value })}
          className="px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 text-xs focus:ring-1 focus:ring-teal-500 focus:outline-none flex-shrink-0 cursor-pointer"
        >
          <option value="ALL">Todos os Setores</option>
          {SECTORS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        {/* Responsável */}
        <select
          value={filter.assigneeId || 'ALL'}
          onChange={(e) => setFilter({ assigneeId: e.target.value })}
          className="px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 text-xs focus:ring-1 focus:ring-teal-500 focus:outline-none flex-shrink-0 cursor-pointer"
        >
          <option value="ALL">Todos Responsáveis</option>
          <option value="UNASSIGNED">Não atribuído</option>
          {DEMO_USERS.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>

        {/* Prazo */}
        <select
          value={filter.deadlineRange || 'ALL'}
          onChange={(e) => setFilter({ deadlineRange: e.target.value as any })}
          className="px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 text-xs focus:ring-1 focus:ring-teal-500 focus:outline-none flex-shrink-0 cursor-pointer"
        >
          <option value="ALL">Todos os Prazos</option>
          <option value="OVERDUE">Atrasadas</option>
          <option value="TODAY">Para Hoje</option>
          <option value="THIS_WEEK">Próximos 7 dias</option>
          <option value="FUTURE">Futuras</option>
        </select>

        {/* Status Gates / Bloqueio */}
        <select
          value={filter.gateStatus || 'ALL'}
          onChange={(e) => setFilter({ gateStatus: e.target.value as any })}
          className="px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 text-xs focus:ring-1 focus:ring-teal-500 focus:outline-none flex-shrink-0 cursor-pointer"
        >
          <option value="ALL">Todos Status de Gates</option>
          <option value="BLOCKED">Apenas Bloqueadas (Qualquer Gate)</option>
          <option value="ARTWORK_PENDING">Arte Pendente</option>
          <option value="MATERIAL_MISSING">Material em Falta</option>
          <option value="FINANCIAL_BLOCKED">Financeiro Bloqueado</option>
          <option value="ALL_RELEASED">100% Liberadas</option>
        </select>

        {/* Origem dos dados */}
        <select
          value={filter.dataOrigin || 'ALL'}
          onChange={(e) => setFilter({ dataOrigin: e.target.value as any })}
          className="px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 text-xs focus:ring-1 focus:ring-teal-500 focus:outline-none flex-shrink-0 cursor-pointer"
        >
          <option value="ALL">Todas Origens</option>
          <option value="user">Criados pelo Usuário</option>
          <option value="demo">Demonstração</option>
        </select>
      </div>
    </div>
  );
};
