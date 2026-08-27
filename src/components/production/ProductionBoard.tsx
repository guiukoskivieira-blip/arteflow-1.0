import React from 'react';
import { useArteFlow } from '../../context/ArteFlowContext';
import { ProductionStageColumn } from './ProductionStageColumn';
import { filterProductionJobs } from '../../services/filterService';
import { Layers } from 'lucide-react';

export const ProductionBoard: React.FC = () => {
  const { stages, jobs, filter } = useArteFlow();

  const sortedStages = [...stages].sort((a, b) => a.sequence - b.sequence);
  const filteredJobs = filterProductionJobs(jobs, stages, filter);

  if (stages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 text-slate-500">
        <div className="text-center">
          <Layers className="w-8 h-8 mx-auto mb-2 text-slate-400" />
          <p className="text-sm">Carregando fluxo de produção...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 min-w-0 p-4 md:p-6 overflow-x-auto overflow-y-hidden">
      <div className="flex gap-4 h-full min-w-max pb-4">
        {sortedStages.map((stage) => {
          const stageJobs = filteredJobs.filter((j) => j.stageId === stage.id);
          return (
            <ProductionStageColumn
              key={stage.id}
              stage={stage}
              jobs={stageJobs}
            />
          );
        })}
      </div>
    </div>
  );
};
