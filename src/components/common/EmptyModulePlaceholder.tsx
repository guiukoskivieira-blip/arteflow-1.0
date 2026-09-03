import React from 'react';
import { LucideIcon, ArrowRight, ShieldCheck, Layers } from 'lucide-react';

interface EmptyModulePlaceholderProps {
  title: string;
  description: string;
  phase?: string;
  icon: LucideIcon;
  plannedFeatures: string[];
  onNavigateToProduction?: () => void;
}

export const EmptyModulePlaceholder: React.FC<EmptyModulePlaceholderProps> = ({
  title,
  description,
  phase,
  icon: Icon,
  plannedFeatures,
  onNavigateToProduction,
}) => {
  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto">
      {/* Top Banner */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 md:p-8 text-center sm:text-left flex flex-col sm:flex-row items-center gap-6">
        <div className="w-16 h-16 rounded-2xl bg-sky-50 border border-sky-100 flex items-center justify-center text-sky-600 flex-shrink-0">
          <Icon className="w-8 h-8" />
        </div>
        <div className="flex-1">
          {phase && <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200 mb-2"><span>{phase}</span></div>}
          <h2 className="text-xl md:text-2xl font-bold text-slate-900">{title}</h2>
          <p className="text-sm text-slate-600 mt-1 max-w-2xl">{description}</p>
        </div>
      </div>

      {/* Honest Roadmap Box */}
      <div className="mt-6 bg-slate-50/80 rounded-xl border border-slate-200 p-6">
        <div className="flex items-center gap-2 text-slate-800 font-semibold text-sm mb-4">
          <Layers className="w-4 h-4 text-sky-600" />
          <span>Funcionalidades planejadas para este módulo:</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {plannedFeatures.map((feat, idx) => (
            <div
              key={idx}
              className="flex items-start gap-2.5 p-3 rounded-lg bg-white border border-slate-200/80 text-xs text-slate-700 shadow-2xs"
            >
              <ShieldCheck className="w-4 h-4 text-sky-600 flex-shrink-0 mt-0.5" />
              <span>{feat}</span>
            </div>
          ))}
        </div>

        <div className="mt-6 pt-5 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-slate-500 text-center sm:text-left">Acompanhe pedidos e ordens de produção no Quadro Kanban.</p>
          {onNavigateToProduction && (
            <button
              onClick={onNavigateToProduction}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-lg transition-colors shadow-sm"
            >
              <span>Ir para Produção</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
