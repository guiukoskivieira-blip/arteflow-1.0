import React from 'react';
import { ProductionJob } from '../../types/domain';
import { useArteFlow } from '../../context/ArteFlowContext';
import { GateBadge } from '../common/GateBadge';
import { PriorityBadge } from '../common/PriorityBadge';
import { OriginBadge } from '../common/OriginBadge';
import { getJobBlockDetails, isJobOverdue, isJobDueToday, formatISODateBR } from '../../domain/jobStatus';
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  AlertTriangle,
  User,
  Eye,
} from 'lucide-react';

interface ProductionJobCardProps {
  job: ProductionJob;
}

export const ProductionJobCard: React.FC<ProductionJobCardProps> = ({ job }) => {
  const {
    stages,
    moveJobNext,
    moveJobPrev,
    setSelectedJob,
    setIsJobDrawerOpen,
  } = useArteFlow();

  const sortedStages = [...stages].sort((a, b) => a.sequence - b.sequence);
  const currentStageIndex = sortedStages.findIndex((s) => s.id === job.stageId);

  const isFirstStage = currentStageIndex <= 0;
  const isLastStage = currentStageIndex >= sortedStages.length - 1;

  const blockDetails = getJobBlockDetails(job);
  const overdue = isJobOverdue(job, stages);
  const dueToday = isJobDueToday(job);

  const handleOpenDetails = () => {
    setSelectedJob(job);
    setIsJobDrawerOpen(true);
  };

  const handlePrevStage = (e: React.MouseEvent) => {
    e.stopPropagation();
    moveJobPrev(job.id);
  };

  const handleNextStage = (e: React.MouseEvent) => {
    e.stopPropagation();
    moveJobNext(job.id);
  };

  return (
    <div
      onClick={handleOpenDetails}
      className={`bg-white rounded-xl border transition-all duration-200 hover:shadow-md cursor-pointer flex flex-col p-3.5 space-y-2.5 relative group ${
        blockDetails.isBlocked
          ? 'border-red-300 ring-1 ring-red-400/30'
          : overdue
          ? 'border-amber-300 ring-1 ring-amber-400/30'
          : 'border-slate-200/90 hover:border-teal-300'
      }`}
    >
      {/* Header: OP Code, Order Code, Origin, Priority */}
      <div className="flex items-center justify-between gap-1.5 flex-wrap">
        <div className="flex items-center gap-1.5">
          <span className="font-extrabold text-xs text-slate-900 font-mono tracking-tight">
            {job.jobCode}
          </span>
          <span
            className="text-[10px] font-mono text-slate-500 bg-slate-100 px-1 py-0.5 rounded"
            title={`Pedido: ${job.orderNumber}`}
          >
            {job.orderNumber}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <OriginBadge type="data" value={job.dataOrigin} />
          <PriorityBadge priority={job.priority} size="sm" />
        </div>
      </div>

      {/* Blocked or Overdue Alerts */}
      {(blockDetails.isBlocked || overdue) && (
        <div className="space-y-1">
          {blockDetails.isBlocked && (
            <div className="flex items-start gap-1.5 px-2 py-1 rounded bg-red-50 border border-red-200 text-red-700 text-[11px] font-medium leading-tight">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              <span>{blockDetails.reasons.join(' • ')}</span>
            </div>
          )}
          {overdue && !blockDetails.isBlocked && (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-medium">
              <Clock className="w-3.5 h-3.5 flex-shrink-0" />
              <span>Trabalho em atraso</span>
            </div>
          )}
        </div>
      )}

      {/* Product & Customer Info */}
      <div>
        <h4 className="text-xs font-bold text-slate-900 leading-snug line-clamp-2" title={job.productName}>
          {job.productName}
        </h4>
        <p className="text-[11px] font-medium text-slate-600 truncate mt-0.5" title={job.customer.name}>
          {job.customer.name}
        </p>
      </div>

      {/* Dimensions, Quantity, Sector */}
      <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100">
        <span className="font-semibold text-slate-700">
          {job.quantity} {job.unit}
          {job.dimensions && (
            <span className="text-slate-500 font-normal">
              {' '}({job.dimensions.width}x{job.dimensions.height} {job.dimensions.unit})
            </span>
          )}
        </span>
        <span className="text-slate-500 truncate max-w-[120px]" title={job.sector}>
          {job.sector}
        </span>
      </div>

      {/* Gate Badges (Arte, Material, Financeiro) */}
      <div className="grid grid-cols-3 gap-1 pt-1">
        <GateBadge type="artwork" value={job.artworkGate} size="sm" />
        <GateBadge type="material" value={job.materialGate} size="sm" />
        <GateBadge type="financial" value={job.financialGate} size="sm" />
      </div>

      {/* Assignee and Deadline Footer */}
      <div className="flex items-center justify-between pt-1 text-[11px] text-slate-500">
        <div className="flex items-center gap-1 truncate max-w-[130px]">
          <User className="w-3 h-3 text-slate-400 flex-shrink-0" />
          <span className="truncate">{job.assignee?.name || 'Não atribuído'}</span>
        </div>

        <div
          className={`inline-flex items-center gap-1 font-medium ${
            overdue
              ? 'text-red-600 font-bold'
              : dueToday
              ? 'text-amber-600 font-bold'
              : 'text-slate-500'
          }`}
        >
          <Clock className="w-3 h-3" />
          <span>{formatISODateBR(job.deadlineISO)}</span>
        </div>
      </div>

      {/* Action Footer: Stage advance/back accessible buttons */}
      <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-1">
        <button
          type="button"
          onClick={handlePrevStage}
          disabled={isFirstStage}
          className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium transition-colors ${
            isFirstStage
              ? 'text-slate-300 cursor-not-allowed'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
          title={isFirstStage ? 'Primeira etapa' : 'Mover para etapa anterior'}
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          <span>Voltar</span>
        </button>

        <button
          type="button"
          onClick={handleOpenDetails}
          className="p-1 text-slate-400 hover:text-teal-600 rounded hover:bg-teal-50"
          title="Ver detalhes da OP"
        >
          <Eye className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onClick={handleNextStage}
          disabled={isLastStage}
          className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-semibold transition-colors ${
            isLastStage
              ? 'text-slate-300 cursor-not-allowed'
              : 'text-teal-700 bg-teal-50 hover:bg-teal-100 hover:text-teal-800'
          }`}
          title={isLastStage ? 'Última etapa' : 'Avançar para próxima etapa'}
        >
          <span>Avançar</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
