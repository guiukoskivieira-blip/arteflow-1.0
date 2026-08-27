import React from 'react';
import { DataOrigin, OrderOrigin } from '../../types/domain';
import { Sparkles, User, FileText } from 'lucide-react';

interface OriginBadgeProps {
  type: 'data' | 'order';
  value: DataOrigin | OrderOrigin;
}

export const OriginBadge: React.FC<OriginBadgeProps> = ({ type, value }) => {
  if (type === 'data') {
    if (value === 'demo') {
      return (
        <span
          className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase rounded bg-purple-50 text-purple-700 border border-purple-200"
          title="Registro demonstrativo do sistema"
        >
          <Sparkles className="w-2.5 h-2.5" />
          Demo
        </span>
      );
    }
    return (
      <span
        className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase rounded bg-slate-100 text-slate-700 border border-slate-200"
        title="Registro criado por usuário"
      >
        <User className="w-2.5 h-2.5" />
        Usuário
      </span>
    );
  }

  // Order origin
  if (value === 'ORCAGRAF') {
    return (
      <span
        className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase rounded bg-blue-50 text-blue-700 border border-blue-200"
        title="Origem comercial contratual: OrçaGraf"
      >
        <FileText className="w-2.5 h-2.5" />
        OrçaGraf
      </span>
    );
  }

  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase rounded bg-slate-100 text-slate-700 border border-slate-200"
      title="Origem comercial: Manual"
    >
      <FileText className="w-2.5 h-2.5" />
      Manual
    </span>
  );
};
