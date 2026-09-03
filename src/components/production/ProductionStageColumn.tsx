import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { WorkflowStage, ProductionJob } from '../../types/domain';
import { TransitionCheckResult } from '../../services/jobService';
import { ProductionJobCard } from './ProductionJobCard';
import { Layers, CheckCircle2, AlertCircle } from 'lucide-react';
import { useArteFlow } from '../../context/ArteFlowContext';

interface ProductionStageColumnProps {
  stage: WorkflowStage;
  jobs: ProductionJob[];
  activeJob: ProductionJob | null;
  onRequestReversionReason?: (job: ProductionJob) => void;
}

export const ProductionStageColumn: React.FC<ProductionStageColumnProps> = ({
  stage,
  jobs,
  activeJob,
  onRequestReversionReason,
}) => {
  const { canJobTransitionTo } = useArteFlow();
  const { setNodeRef, isOver } = useDroppable({
    id: stage.id,
    data: { stage },
  });

  const isCurrentStageOfActive = activeJob ? activeJob.stageId === stage.id : false;
  const transitionCheck: TransitionCheckResult = activeJob && !isCurrentStageOfActive
    ? canJobTransitionTo(activeJob, stage.id)
    : { allowed: false, blockingReasons: [] };

  const isAllowedDestination = activeJob && !isCurrentStageOfActive && transitionCheck.allowed;
  const isBlockedOver = activeJob && isOver && !isAllowedDestination && !isCurrentStageOfActive;

  return (
    <div
      ref={setNodeRef}
      className={`w-80 flex-shrink-0 flex flex-col rounded-xl border transition-all duration-200 max-h-full ${
        isOver && isAllowedDestination
          ? 'bg-sky-50/70 border-sky-500 ring-2 ring-sky-400 shadow-md'
          : isBlockedOver
          ? 'bg-red-50/70 border-red-400 ring-2 ring-red-400/60 shadow-md'
          : isAllowedDestination
          ? 'bg-sky-50/20 border-sky-300/80'
          : 'bg-slate-100/80 border-slate-200/80'
      }`}
    >
      {/* Column Header */}
      <div className="p-3 border-b border-slate-200 bg-white/70 rounded-t-xl flex items-center justify-between sticky top-0 z-10 backdrop-blur-xs">
        <div className="flex items-center gap-2">
          <span
            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: stage.color }}
          />
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-slate-900 leading-tight">
                {stage.name}
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                #{stage.sequence}
              </span>
            </div>
          </div>
        </div>

        <span
          className={`px-2 py-0.5 text-xs font-bold rounded-full ${
            jobs.length > 0
              ? 'bg-slate-900 text-white'
              : 'bg-slate-200 text-slate-600'
          }`}
        >
          {jobs.length}
        </span>
      </div>

      {/* Destination feedback banner while dragging */}
      {isOver && isAllowedDestination && (
        <div className="px-3 py-1.5 bg-sky-500 text-white text-[11px] font-bold flex items-center gap-1.5 shadow-xs">
          <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
          <span>Solte para mover para {stage.name}</span>
        </div>
      )}

      {isBlockedOver && (
        <div className="px-3 py-1.5 bg-red-600 text-white text-[11px] font-semibold flex items-start gap-1.5 shadow-xs leading-tight">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <span>{transitionCheck.reason || 'Movimentação bloqueada'}</span>
        </div>
      )}

      {/* Cards Container */}
      <div className="p-2.5 flex-1 overflow-y-auto space-y-2.5 min-h-[150px]">
        {jobs.length === 0 ? (
          <div className="h-32 flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-200/70 rounded-lg p-4 text-center">
            <Layers className="w-5 h-5 mb-1.5 stroke-1" />
            <span className="text-xs">Nenhum trabalho nesta etapa</span>
          </div>
        ) : (
          jobs.map((job) => (
            <ProductionJobCard
              key={job.id}
              job={job}
              onRequestReversionReason={onRequestReversionReason}
            />
          ))
        )}
      </div>
    </div>
  );
};
