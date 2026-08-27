import React from 'react';
import { WorkflowStage, ProductionJob } from '../../types/domain';
import { ProductionJobCard } from './ProductionJobCard';
import { Layers } from 'lucide-react';

interface ProductionStageColumnProps {
  stage: WorkflowStage;
  jobs: ProductionJob[];
}

export const ProductionStageColumn: React.FC<ProductionStageColumnProps> = ({ stage, jobs }) => {
  return (
    <div className="w-80 flex-shrink-0 flex flex-col bg-slate-100/80 rounded-xl border border-slate-200/80 max-h-full">
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

      {/* Cards Container */}
      <div className="p-2.5 flex-1 overflow-y-auto space-y-2.5 min-h-[150px]">
        {jobs.length === 0 ? (
          <div className="h-32 flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-200/70 rounded-lg p-4 text-center">
            <Layers className="w-5 h-5 mb-1.5 stroke-1" />
            <span className="text-xs">Nenhum trabalho nesta etapa</span>
          </div>
        ) : (
          jobs.map((job) => <ProductionJobCard key={job.id} job={job} />)
        )}
      </div>
    </div>
  );
};
