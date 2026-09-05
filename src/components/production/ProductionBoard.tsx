import React, { useState, useCallback } from 'react';
import {
  DndContext,
  DragOverlay,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  rectIntersection,
} from '@dnd-kit/core';
import { useArteFlow } from '../../context/ArteFlowContext';
import { ProductionStageColumn } from './ProductionStageColumn';
import { ProductionJobCard } from './ProductionJobCard';
import { ReversionReasonModal } from './ReversionReasonModal';
import { filterProductionJobs } from '../../services/filterService';
import { ProductionJob } from '../../types/domain';
import { Layers } from 'lucide-react';

export const ProductionBoard: React.FC = () => {
  const { stages, jobs, filter, transitionProductionJobStage, can = () => true } = useArteFlow();
  const canManageProduction = can('arteflow.production.manage');
  const [activeJob, setActiveJob] = useState<ProductionJob | null>(null);
  const [announcement, setAnnouncement] = useState<string>('');
  const [reversionTarget, setReversionTarget] = useState<{
    job: ProductionJob;
    targetStageId: string;
    method: 'BUTTON' | 'DRAG_DROP' | 'KEYBOARD';
  } | null>(null);

  const sortedStages = [...stages].sort((a, b) => a.sequence - b.sequence);
  const filteredJobs = filterProductionJobs(jobs, stages, filter);

  // Configuração dos sensores: Mouse (Pointer), Toque (Touch) e Teclado (Keyboard)
  const pointerSensor = useSensor(PointerSensor, {
    activationConstraint: {
      distance: 8, // Exige 8px de arrasto para diferenciar de clique simples
    },
  });

  const touchSensor = useSensor(TouchSensor, {
    activationConstraint: {
      delay: 200, // 200ms de segurada no touch para não travar scroll vertical
      tolerance: 8,
    },
  });

  const keyboardSensor = useSensor(KeyboardSensor, {
    coordinateGetter: (event, { context }) => {
      const key = event.code || event.key;
      if (key !== 'ArrowRight' && key !== 'ArrowLeft') return undefined;

      const activeId = context.active?.id;
      const job = jobs.find((j) => j.id === activeId);
      if (!job) return undefined;

      const currentStageIndex = sortedStages.findIndex((s) => s.id === job.stageId);
      const targetIndex = key === 'ArrowRight' ? currentStageIndex + 1 : currentStageIndex - 1;

      if (targetIndex < 0 || targetIndex >= sortedStages.length) return undefined;

      const targetStage = sortedStages[targetIndex];
      const rect = context.droppableRects.get(targetStage.id);
      if (!rect) return undefined;

      return {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      };
    },
  });

  const sensors = useSensors(pointerSensor, touchSensor, keyboardSensor);

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      if (!canManageProduction) return;
      const job = jobs.find((j) => j.id === event.active.id);
      if (job) {
        setActiveJob(job);
        setAnnouncement(`OP ${job.jobCode} selecionada para movimentação.`);
      }
    },
    [jobs, canManageProduction]
  );

  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      if (event.over) {
        const stage = stages.find((s) => s.id === event.over?.id);
        if (stage) {
          setAnnouncement(`Destino: ${stage.name}.`);
        }
      }
    },
    [stages]
  );

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      if (!canManageProduction) return;
      const { active, over } = event;
      setActiveJob(null);

      if (!over) {
        setAnnouncement('Movimentação cancelada.');
        return;
      }

      const jobId = String(active.id);
      const targetStageId = String(over.id);
      const job = jobs.find((j) => j.id === jobId);

      if (!job || job.stageId === targetStageId) {
        setAnnouncement('Movimentação cancelada.');
        return;
      }

      const method = event.activatorEvent instanceof KeyboardEvent ? 'KEYBOARD' : 'DRAG_DROP';

      // Regra 16: Retorno de Entregue para Pronto exige confirmação e justificativa
      const currentStageIndex = sortedStages.findIndex((s) => s.id === job.stageId);
      const targetStageIndex = sortedStages.findIndex((s) => s.id === targetStageId);
      if (
        currentStageIndex >= 0 &&
        targetStageIndex >= 0 &&
        sortedStages[currentStageIndex].id === 'stage-delivered' &&
        sortedStages[targetStageIndex].id === 'stage-ready'
      ) {
        setReversionTarget({ job, targetStageId, method });
        return;
      }

      try {
        await transitionProductionJobStage({
          productionJobId: jobId,
          targetStageId,
          method,
        });
        const targetStage = stages.find((s) => s.id === targetStageId);
        setAnnouncement(`OP ${job.jobCode} movida para ${targetStage?.name || targetStageId}.`);
      } catch (err: any) {
        const msg = err.message || 'Regras operacionais não atendidas.';
        setAnnouncement(msg.startsWith('Movimentação bloqueada') ? msg : `Movimentação bloqueada: ${msg}`);
      }
    },
    [jobs, stages, sortedStages, transitionProductionJobStage, canManageProduction]
  );

  const handleDragCancel = useCallback(() => {
    setActiveJob(null);
    setAnnouncement('Movimentação cancelada.');
  }, []);

  const handleRequestReversionReason = useCallback((job: ProductionJob) => {
    const readyStage = sortedStages.find((s) => s.id === 'stage-ready');
    if (readyStage) {
      setReversionTarget({
        job,
        targetStageId: readyStage.id,
        method: 'BUTTON',
      });
    }
  }, [sortedStages]);

  const handleConfirmReversion = useCallback(
    async (reason: string) => {
      if (!reversionTarget) return;
      try {
        await transitionProductionJobStage({
          productionJobId: reversionTarget.job.id,
          targetStageId: reversionTarget.targetStageId,
          method: reversionTarget.method,
          reversionReason: reason,
        });
        setReversionTarget(null);
      } catch {
        // Erro já tratado no contexto
      }
    },
    [reversionTarget, transitionProductionJobStage]
  );

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
    <DndContext
      sensors={sensors}
      collisionDetection={rectIntersection}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      {/* Live Region para Leitores de Tela */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement}
      </div>

      <div className="flex-1 min-w-0 p-4 md:p-6 overflow-x-auto overflow-y-hidden">
        <div className="flex gap-4 h-full min-w-max pb-4">
          {sortedStages.map((stage) => {
            const stageJobs = filteredJobs.filter((j) => j.stageId === stage.id);
            return (
              <ProductionStageColumn
                key={stage.id}
                stage={stage}
                jobs={stageJobs}
                activeJob={activeJob}
                onRequestReversionReason={handleRequestReversionReason}
              />
            );
          })}
        </div>
      </div>

      {/* Overlay Visual do Cartão sendo arrastado */}
      <DragOverlay dropAnimation={{ duration: 150, easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)' }}>
        {activeJob ? <ProductionJobCard job={activeJob} isOverlay /> : null}
      </DragOverlay>

      {/* Modal de Justificativa para Retorno de OP Entregue (Regra 16) */}
      <ReversionReasonModal
        isOpen={Boolean(reversionTarget)}
        job={reversionTarget?.job || null}
        onClose={() => setReversionTarget(null)}
        onConfirm={handleConfirmReversion}
      />
    </DndContext>
  );
};
