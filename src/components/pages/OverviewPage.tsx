import React from 'react';
import { useArteFlow } from '../../context/ArteFlowContext';
import { isJobBlocked, isJobOverdue } from '../../domain/jobStatus';
import { formatCentsToBRL } from '../../domain/money';
import {
  Kanban,
  AlertTriangle,
  Clock,
  ShoppingCart,
  Layers,
  ArrowRight,
} from 'lucide-react';

export const OverviewPage: React.FC = () => {
  const {
    jobs,
    orders,
    stages,
    setActivePage,
    setSelectedJob,
    setIsJobDrawerOpen,
    setIsNewOrderModalOpen,
  } = useArteFlow();

  const totalJobs = jobs.length;
  const blockedJobs = jobs.filter((j) => isJobBlocked(j));
  const overdueJobs = jobs.filter((j) => isJobOverdue(j, stages));

  const readyStage = stages.find((s) => s.isFinal);
  const deliveredStage = stages.find((s) => s.isTerminal);

  const inProductionJobs = jobs.filter(
    (j) => j.stageId !== readyStage?.id && j.stageId !== deliveredStage?.id
  );

  const totalRevenueCents = orders.reduce((acc, o) => acc + o.totalAmountCents, 0);

  const handleOpenJob = (job: typeof jobs[0]) => {
    setSelectedJob(job);
    setIsJobDrawerOpen(true);
    setActivePage('production');
  };

  return (
    <div className="flex-1 p-4 md:p-7 space-y-5 overflow-y-auto max-w-[1480px] mx-auto w-full">
      {/* Top Banner */}
      <div className="relative overflow-hidden rounded-[22px] border border-sky-100 bg-white p-6 md:p-7 shadow-[0_16px_45px_rgba(15,74,122,0.08)] flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
        <div className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-sky-100/70 blur-3xl" />
        <div className="pointer-events-none absolute right-28 top-8 h-24 w-24 rounded-full bg-cyan-100/60 blur-2xl" />
        <div>
          <span className="text-[11px] uppercase tracking-[0.18em] text-sky-600 font-extrabold">
            ArteFlow Operacional
          </span>
          <h2 className="text-2xl md:text-[28px] text-slate-950 font-black tracking-tight mt-1">
            Painel Geral de Produção
          </h2>
          <p className="text-xs md:text-sm text-slate-500 mt-1.5 max-w-xl leading-relaxed">
            Acompanhamento em tempo real de pedidos, OPs ativas, gargalos de produção e situação dos gates.
          </p>
        </div>

        <div className="relative flex items-center gap-3">
          <button
            onClick={() => setIsNewOrderModalOpen(true)}
            className="af-primary-button text-xs"
          >
            + Novo Pedido
          </button>
          <button
            onClick={() => setActivePage('production')}
            className="px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 font-bold rounded-xl text-xs border border-slate-200 transition-colors flex items-center gap-1.5 shadow-sm"
          >
            <span>Ver Quadro</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total OPs */}
        <div className="af-surface p-5 transition hover:-translate-y-0.5 hover:shadow-[0_14px_36px_rgba(15,23,42,0.07)]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Em Produção Ativa</span>
            <div className="p-2.5 rounded-xl bg-sky-50 text-sky-600">
              <Kanban className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-slate-900">{inProductionJobs.length}</span>
            <span className="text-xs text-slate-400 ml-2">de {totalJobs} OPs</span>
          </div>
        </div>

        {/* Bloqueadas */}
        <div className="af-surface p-5 transition hover:-translate-y-0.5 hover:shadow-[0_14px_36px_rgba(15,23,42,0.07)]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">OPs Bloqueadas</span>
            <div className="p-2 rounded-lg bg-red-50 text-red-600">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-red-600">{blockedJobs.length}</span>
            <span className="text-xs text-slate-400 ml-2">requerem atenção</span>
          </div>
        </div>

        {/* Atrasadas */}
        <div className="af-surface p-5 transition hover:-translate-y-0.5 hover:shadow-[0_14px_36px_rgba(15,23,42,0.07)]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">OPs Atrasadas</span>
            <div className="p-2 rounded-lg bg-amber-50 text-amber-600">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-amber-600">{overdueJobs.length}</span>
            <span className="text-xs text-slate-400 ml-2">fora do prazo</span>
          </div>
        </div>

        {/* Total Pedidos / Faturamento */}
        <div className="af-surface p-5 transition hover:-translate-y-0.5 hover:shadow-[0_14px_36px_rgba(15,23,42,0.07)]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Pedidos Registrados</span>
            <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
              <ShoppingCart className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-slate-900">{orders.length}</span>
            <span className="text-xs text-slate-400 ml-2 font-mono">
              ({formatCentsToBRL(totalRevenueCents)})
            </span>
          </div>
        </div>
      </div>

      {/* Stage Breakdown Grid */}
      <div className="af-surface p-5 md:p-6 space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
          <Layers className="w-4 h-4 text-sky-600" />
          <span>Distribuição de Ordens de Produção por Etapa</span>
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {stages.map((stage) => {
            const stageJobs = jobs.filter((j) => j.stageId === stage.id);
            return (
              <div
                key={stage.id}
                onClick={() => setActivePage('production')}
                className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/70 hover:bg-sky-50/70 hover:border-sky-200 hover:-translate-y-0.5 transition-all cursor-pointer"
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: stage.color }}
                  />
                  <span className="text-[11px] font-semibold text-slate-800 truncate" title={stage.name}>
                    {stage.name}
                  </span>
                </div>
                <div className="flex items-baseline justify-between mt-2">
                  <span className="text-lg font-bold text-slate-900 font-mono">
                    {stageJobs.length}
                  </span>
                  <span className="text-[10px] text-slate-400">#{stage.sequence}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Attention section: Blocked & Urgent jobs */}
      {blockedJobs.length > 0 && (
        <div className="af-surface border-red-200 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-red-700 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600" />
              <span>Trabalhos Bloqueados Requerendo Ação Imediata</span>
            </h3>
            <span className="text-xs font-semibold text-red-600">
              {blockedJobs.length} {blockedJobs.length === 1 ? 'trabalho' : 'trabalhos'}
            </span>
          </div>

          <div className="divide-y divide-slate-100">
            {blockedJobs.map((job) => (
              <div
                key={job.id}
                onClick={() => handleOpenJob(job)}
                className="py-3 flex items-center justify-between gap-4 hover:bg-slate-50/80 px-2 rounded-lg cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="font-mono font-bold text-xs text-slate-900">{job.jobCode}</span>
                  <div>
                    <h5 className="text-xs font-bold text-slate-900">{job.productName}</h5>
                    <p className="text-[11px] text-slate-500">{job.customer.name}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-xs font-semibold text-red-600">
                    {job.artworkGate === 'REJECTED' && 'Arte reprovada'}
                    {job.materialGate === 'MISSING' && 'Material em falta'}
                    {job.financialGate === 'BLOCKED' && 'Financeiro bloqueado'}
                  </span>
                  <ArrowRight className="w-4 h-4 text-slate-400" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
