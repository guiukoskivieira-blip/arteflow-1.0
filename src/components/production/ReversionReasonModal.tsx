import React, { useState, useEffect, useRef } from 'react';
import { ProductionJob } from '../../types/domain';
import { AlertTriangle, X } from 'lucide-react';

interface ReversionReasonModalProps {
  isOpen: boolean;
  job: ProductionJob | null;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}

export const ReversionReasonModal: React.FC<ReversionReasonModalProps> = ({
  isOpen,
  job,
  onClose,
  onConfirm,
}) => {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setReason('');
      setError(null);
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !job) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError('Por favor, informe a justificativa para retornar a OP.');
      return;
    }
    onConfirm(reason.trim());
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reversion-title"
    >
      <div
        className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-amber-50/50">
          <div className="flex items-center gap-2 text-amber-700">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            <h3 id="reversion-title" className="font-bold text-sm text-slate-900">
              Confirmar Retorno de OP Entregue
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-white"
            aria-label="Fechar modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-4 space-y-3.5">
          <p className="text-xs text-slate-600 leading-relaxed">
            A ordem de produção <strong className="text-slate-900 font-mono">{job.jobCode}</strong> ({job.productName}) já consta como <strong>Entregue</strong>.
            Para retornar esta OP para <strong>Pronto</strong>, informe a justificativa operacional que será registrada no histórico imutável:
          </p>

          <div className="space-y-1">
            <label htmlFor="reversion-reason-input" className="block text-xs font-semibold text-slate-700">
              Justificativa do Retorno <span className="text-red-500">*</span>
            </label>
            <textarea
              id="reversion-reason-input"
              ref={textareaRef}
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                if (error) setError(null);
              }}
              rows={3}
              placeholder="Ex: Cliente solicitou reajuste na arte ou acabamento adicional antes da retirada final..."
              className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-slate-800 resize-none"
            />
            {error && <p className="text-[11px] font-medium text-red-600">{error}</p>}
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!reason.trim()}
              className="px-3.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-xs font-bold shadow-xs transition-colors"
            >
              Confirmar Retorno
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
