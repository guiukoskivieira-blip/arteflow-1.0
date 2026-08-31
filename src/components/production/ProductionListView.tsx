import React from 'react';
import { useArteFlow } from '../../context/ArteFlowContext';
import { filterProductionJobs } from '../../services/filterService';
import { GateBadge } from '../common/GateBadge';
import { PriorityBadge } from '../common/PriorityBadge';
import { OriginBadge } from '../common/OriginBadge';
import { getJobBlockDetails, isJobOverdue, formatISODateBR } from '../../domain/jobStatus';
import { ChevronRight, ChevronLeft, AlertTriangle, Clock, Eye, Layers } from 'lucide-react';

export const ProductionListView: React.FC = () => {
  const {
    stages,
    jobs,
    filter,
    moveJobNext,
    moveJobPrev,
    setSelectedJob,
    setIsJobDrawerOpen,
  } = useArteFlow();

  const sortedStages = [...stages].sort((a, b) => a.sequence - b.sequence);
  const stageMap = new Map(stages.map((s) => [s.id, s]));
  const filteredJobs = filterProductionJobs(jobs, stages, filter);

  if (filteredJobs.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 text-slate-400">
        <Layers className="w-10 h-10 mb-3 text-slate-300 stroke-1" />
        <p className="text-sm font-medium text-slate-600">Nenhuma Ordem de Produção encontrada</p>
        <p className="text-xs text-slate-400 mt-1">Tente ajustar os filtros ou pesquisar com outros termos.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 p-4 md:p-6 overflow-y-auto">
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 text-slate-700 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">OP / Pedido</th>
                <th className="px-4 py-3">Cliente / Produto</th>
                <th className="px-4 py-3">Etapa Atual</th>
                <th className="px-4 py-3">Gates (Arte • Mat • Fin)</th>
                <th className="px-4 py-3">Prioridade / Setor</th>
                <th className="px-4 py-3">Responsável</th>
                <th className="px-4 py-3">Prazo</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredJobs.map((job) => {
                const stage = stageMap.get(job.stageId);
                const blockDetails = getJobBlockDetails(job);
                const overdue = isJobOverdue(job, stages);

                const currentStageIndex = sortedStages.findIndex((s) => s.id === job.stageId);
                const isFirstStage = currentStageIndex <= 0;
                const isLastStage = currentStageIndex >= sortedStages.length - 1;

                return (
                  <tr
                    key={job.id}
                    onClick={() => {
                      setSelectedJob(job);
                      setIsJobDrawerOpen(true);
                    }}
                    className={`hover:bg-slate-50/80 transition-colors cursor-pointer ${
                      blockDetails.isBlocked ? 'bg-red-50/20' : overdue ? 'bg-amber-50/20' : ''
                    }`}
                  >
                    {/* OP & Order */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="font-mono font-bold text-slate-900">{job.jobCode}</span>
                        <span className="text-[11px] text-slate-400 font-mono">{job.orderNumber}</span>
                        <div className="mt-1">
                          <OriginBadge type="data" value={job.dataOrigin} />
                        </div>
                      </div>
                    </td>

                    {/* Customer & Product */}
                    <td className="px-4 py-3">
                      <div className="flex flex-col max-w-xs">
                        <span className="font-semibold text-slate-900">{job.productName}</span>
                        <span className="text-[11px] text-slate-500">{job.customer.name}</span>
                        <span className="text-[11px] text-slate-400 mt-0.5">
                          Qtd: {job.quantity} {job.unit}
                        </span>
                      </div>
                    </td>

                    {/* Stage */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: stage?.color || '#94a3b8' }}
                        />
                        <span className="font-medium text-slate-800">{stage?.name || job.stageId}</span>
                      </div>
                    </td>

                    {/* Gates */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        <GateBadge type="artwork" value={job.artworkGate} size="sm" showLabel={false} />
                        <GateBadge type="material" value={job.materialGate} size="sm" showLabel={false} />
                        <GateBadge type="financial" value={job.financialGate} size="sm" showLabel={false} />
                      </div>
                      {blockDetails.isBlocked && (
                        <div className="flex items-center gap-1 text-[10px] text-red-600 font-semibold mt-1">
                          <AlertTriangle className="w-3 h-3" />
                          <span>Bloqueado</span>
                        </div>
                      )}
                    </td>

                    {/* Priority & Sector */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex flex-col gap-1 items-start">
                        <PriorityBadge priority={job.priority} size="sm" />
                        <span className="text-[11px] text-slate-500">{job.sector}</span>
                      </div>
                    </td>

                    {/* Assignee */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-slate-700 font-medium">
                        {job.assignee?.name || 'Não atribuído'}
                      </span>
                    </td>

                    {/* Deadline */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div
                        className={`flex items-center gap-1 ${
                          overdue ? 'text-red-600 font-bold' : 'text-slate-600'
                        }`}
                      >
                        <Clock className="w-3.5 h-3.5" />
                        <span>{formatISODateBR(job.deadlineISO)}</span>
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <div className="inline-flex items-center gap-1">
                        <button
                          onClick={() => moveJobPrev(job.id)}
                          disabled={isFirstStage}
                          className="p-1 rounded text-slate-500 hover:bg-slate-200 disabled:text-slate-300 disabled:hover:bg-transparent"
                          title="Voltar etapa"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setSelectedJob(job);
                            setIsJobDrawerOpen(true);
                          }}
                          className="p-1 rounded text-slate-500 hover:text-sky-600 hover:bg-sky-50"
                          title="Ver detalhes"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => moveJobNext(job.id)}
                          disabled={isLastStage}
                          className="p-1 rounded text-sky-700 bg-sky-50 hover:bg-sky-100 disabled:text-slate-300 disabled:bg-transparent"
                          title="Avançar etapa"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
