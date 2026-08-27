import React, { useState, useEffect } from 'react';
import { useArteFlow } from '../../context/ArteFlowContext';
import {
  ArtworkGate,
  MaterialGate,
  FinancialGate,
  Priority,
  ProductionEvent,
} from '../../types/domain';
import { DEMO_USERS } from '../../domain/constants';
import { OriginBadge } from '../common/OriginBadge';
import { getJobBlockDetails, isJobOverdue, formatISODateTimeBR } from '../../domain/jobStatus';
import {
  X,
  Clock,
  AlertTriangle,
  History,
  Send,
  Building2,
  FileText,
  Palette,
  Box,
  DollarSign,
  Layers,
} from 'lucide-react';

export const ProductionJobDrawer: React.FC = () => {
  const {
    selectedJob,
    isJobDrawerOpen,
    setIsJobDrawerOpen,
    stages,
    moveJobStage,
    updateArtworkGate,
    updateMaterialGate,
    updateFinancialGate,
    updateJobAssignee,
    updateJobPriority,
    updateJobDeadline,
    addJobNote,
    getJobEvents,
  } = useArteFlow();

  const [events, setEvents] = useState<ProductionEvent[]>([]);
  const [newNote, setNewNote] = useState('');
  const [loadingEvents, setLoadingEvents] = useState(false);

  useEffect(() => {
    if (selectedJob && isJobDrawerOpen) {
      setLoadingEvents(true);
      getJobEvents(selectedJob.id).then((evts) => {
        setEvents(evts);
        setLoadingEvents(false);
      });
    }
  }, [selectedJob?.id, isJobDrawerOpen, getJobEvents]);

  if (!isJobDrawerOpen || !selectedJob) return null;

  const blockDetails = getJobBlockDetails(selectedJob);
  const overdue = isJobOverdue(selectedJob, stages);
  const sortedStages = [...stages].sort((a, b) => a.sequence - b.sequence);

  const handleStageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    moveJobStage(selectedJob.id, e.target.value);
  };

  const handleArtworkChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    updateArtworkGate(selectedJob.id, e.target.value as ArtworkGate);
  };

  const handleMaterialChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    updateMaterialGate(selectedJob.id, e.target.value as MaterialGate);
  };

  const handleFinancialChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    updateFinancialGate(selectedJob.id, e.target.value as FinancialGate);
  };

  const handlePriorityChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    updateJobPriority(selectedJob.id, e.target.value as Priority);
  };

  const handleAssigneeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === 'UNASSIGNED') {
      updateJobAssignee(selectedJob.id, null);
    } else {
      const user = DEMO_USERS.find((u) => u.id === val);
      if (user) {
        updateJobAssignee(selectedJob.id, {
          id: user.id,
          name: user.name,
          email: user.email,
        });
      }
    }
  };

  const handleDeadlineChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.value) {
      const date = new Date(e.target.value);
      date.setHours(18, 0, 0, 0);
      updateJobDeadline(selectedJob.id, date.toISOString());
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim()) return;
    await addJobNote(selectedJob.id, newNote.trim());
    setNewNote('');
    const freshEvents = await getJobEvents(selectedJob.id);
    setEvents(freshEvents);
  };

  const deadlineInputVal = selectedJob.deadlineISO
    ? selectedJob.deadlineISO.substring(0, 10)
    : '';

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
        onClick={() => setIsJobDrawerOpen(false)}
      />

      {/* Drawer Panel */}
      <div className="relative w-full max-w-2xl bg-white shadow-2xl flex flex-col h-full z-10 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-slate-900 font-mono">
                  {selectedJob.jobCode}
                </h3>
                <span className="text-xs text-slate-500 font-mono bg-white px-2 py-0.5 rounded border border-slate-200">
                  {selectedJob.orderNumber}
                </span>
                <OriginBadge type="data" value={selectedJob.dataOrigin} />
              </div>
              <p className="text-xs text-slate-500 mt-0.5 font-medium">
                Ordem de Produção independente gerada do Pedido
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsJobDrawerOpen(false)}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Scrollable */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Alerts: Blocked or Overdue */}
          {blockDetails.isBlocked && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs">
              <div className="flex items-center gap-2 font-bold mb-1">
                <AlertTriangle className="w-4 h-4 text-red-600" />
                <span>Trabalho Bloqueado para Produção</span>
              </div>
              <ul className="list-disc list-inside space-y-0.5 text-red-700 pl-1">
                {blockDetails.reasons.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>
          )}

          {overdue && !blockDetails.isBlocked && (
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center gap-2 font-semibold">
              <Clock className="w-4 h-4 text-amber-600 flex-shrink-0" />
              <span>Prazo de entrega expirado. Requer priorização urgente.</span>
            </div>
          )}

          {/* Core Controls: Stage, Gates & Priority */}
          <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-teal-600" />
              <span>Controles Operacionais da OP</span>
            </h4>

            {/* Stage Selector */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Etapa Atual no Fluxo:
              </label>
              <select
                value={selectedJob.stageId}
                onChange={handleStageChange}
                className="w-full text-xs font-medium px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 focus:outline-none"
              >
                {sortedStages.map((s) => (
                  <option key={s.id} value={s.id}>
                    #{s.sequence} — {s.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Parallel Gates (3 independent controls) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              {/* Artwork Gate */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1 flex items-center gap-1">
                  <Palette className="w-3.5 h-3.5 text-purple-600" />
                  <span>1. Arte</span>
                </label>
                <select
                  value={selectedJob.artworkGate}
                  onChange={handleArtworkChange}
                  className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500"
                >
                  <option value="NOT_RECEIVED">Não recebida</option>
                  <option value="PENDING_REVIEW">Em análise</option>
                  <option value="APPROVED">Aprovada</option>
                  <option value="REJECTED">Reprovada (Bloqueia)</option>
                </select>
              </div>

              {/* Material Gate */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1 flex items-center gap-1">
                  <Box className="w-3.5 h-3.5 text-amber-600" />
                  <span>2. Material</span>
                </label>
                <select
                  value={selectedJob.materialGate}
                  onChange={handleMaterialChange}
                  className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500"
                >
                  <option value="NOT_CHECKED">Não verificado</option>
                  <option value="AVAILABLE">Disponível</option>
                  <option value="RESERVED">Reservado</option>
                  <option value="MISSING">Em falta (Bloqueia)</option>
                </select>
              </div>

              {/* Financial Gate */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1 flex items-center gap-1">
                  <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                  <span>3. Financeiro</span>
                </label>
                <select
                  value={selectedJob.financialGate}
                  onChange={handleFinancialChange}
                  className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500"
                >
                  <option value="RELEASED">Liberado</option>
                  <option value="DEPOSIT_PENDING">Sinal pendente</option>
                  <option value="PAYMENT_PENDING">Pagamento pendente</option>
                  <option value="BLOCKED">Bloqueado (Bloqueia)</option>
                </select>
              </div>
            </div>

            {/* Priority, Assignee & Deadline */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Prioridade
                </label>
                <select
                  value={selectedJob.priority}
                  onChange={handlePriorityChange}
                  className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500"
                >
                  <option value="LOW">Baixa</option>
                  <option value="MEDIUM">Média</option>
                  <option value="HIGH">Alta</option>
                  <option value="URGENT">Urgente</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Responsável
                </label>
                <select
                  value={selectedJob.assignee?.id || 'UNASSIGNED'}
                  onChange={handleAssigneeChange}
                  className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500"
                >
                  <option value="UNASSIGNED">Não atribuído</option>
                  {DEMO_USERS.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Prazo de Entrega
                </label>
                <input
                  type="date"
                  value={deadlineInputVal}
                  onChange={handleDeadlineChange}
                  className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500"
                />
              </div>
            </div>
          </div>

          {/* Product & Technical Snapshot */}
          <div className="border border-slate-200 rounded-xl p-4 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-teal-600" />
              <span>Especificações do Trabalho</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-slate-400 font-medium">Produto:</span>
                <p className="font-bold text-slate-900">{selectedJob.productName}</p>
              </div>
              <div>
                <span className="text-slate-400 font-medium">Setor de Produção:</span>
                <p className="font-semibold text-slate-800">{selectedJob.sector}</p>
              </div>
              <div>
                <span className="text-slate-400 font-medium">Quantidade:</span>
                <p className="font-bold text-slate-900">
                  {selectedJob.quantity} {selectedJob.unit}
                </p>
              </div>
              <div>
                <span className="text-slate-400 font-medium">Dimensões:</span>
                <p className="font-semibold text-slate-800">
                  {selectedJob.dimensions
                    ? `${selectedJob.dimensions.width} x ${selectedJob.dimensions.height} ${selectedJob.dimensions.unit}`
                    : 'Não especificadas'}
                </p>
              </div>
            </div>

            {/* Finishings */}
            {selectedJob.finishings && selectedJob.finishings.length > 0 && (
              <div className="pt-2 border-t border-slate-100">
                <span className="text-xs text-slate-400 font-medium block mb-1.5">
                  Acabamentos Obrigatórios:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {selectedJob.finishings.map((f, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 bg-slate-100 border border-slate-200 rounded text-xs font-medium text-slate-700"
                    >
                      {f}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Technical Notes */}
            {selectedJob.technicalNotes && (
              <div className="pt-2 border-t border-slate-100">
                <span className="text-xs text-slate-400 font-medium block mb-1">
                  Observações Técnicas:
                </span>
                <p className="text-xs text-slate-700 bg-slate-50 p-2.5 rounded-lg border border-slate-200 leading-relaxed">
                  {selectedJob.technicalNotes}
                </p>
              </div>
            )}
          </div>

          {/* Customer Snapshot */}
          <div className="border border-slate-200 rounded-xl p-4 space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-teal-600" />
              <span>Cliente (Snapshot Comercial)</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-slate-400">Nome / Razão:</span>
                <p className="font-semibold text-slate-900">{selectedJob.customer.name}</p>
              </div>
              {selectedJob.customer.document && (
                <div>
                  <span className="text-slate-400">Documento:</span>
                  <p className="text-slate-700 font-mono">{selectedJob.customer.document}</p>
                </div>
              )}
              {selectedJob.customer.phone && (
                <div>
                  <span className="text-slate-400">Telefone:</span>
                  <p className="text-slate-700">{selectedJob.customer.phone}</p>
                </div>
              )}
              {selectedJob.customer.email && (
                <div>
                  <span className="text-slate-400">E-mail:</span>
                  <p className="text-slate-700">{selectedJob.customer.email}</p>
                </div>
              )}
            </div>
          </div>

          {/* Append-Only Audit Trail */}
          <div className="border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                <History className="w-4 h-4 text-teal-600" />
                <span>Histórico Auditável (Append-Only)</span>
              </h4>
              <span className="text-[10px] text-slate-400 font-mono">
                {events.length} registros
              </span>
            </div>

            {/* Add note input */}
            <form onSubmit={handleAddNote} className="flex gap-2 pt-1">
              <input
                type="text"
                placeholder="Registrar anotação operacional no histórico..."
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                className="flex-1 text-xs px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:ring-1 focus:ring-teal-500 focus:outline-none"
              />
              <button
                type="submit"
                disabled={!newNote.trim()}
                className="px-3 py-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Salvar</span>
              </button>
            </form>

            {/* Timeline */}
            <div className="space-y-2.5 pt-2 max-h-60 overflow-y-auto">
              {loadingEvents ? (
                <p className="text-xs text-slate-400 text-center py-4">Carregando histórico...</p>
              ) : events.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-4">Nenhum evento registrado ainda.</p>
              ) : (
                events.map((evt) => (
                  <div
                    key={evt.id}
                    className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between text-[10px] text-slate-400">
                      <span className="font-semibold text-slate-700">{evt.authorName}</span>
                      <span>{formatISODateTimeBR(evt.timestamp)}</span>
                    </div>
                    <p className="text-slate-800 leading-snug">{evt.description}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between flex-shrink-0">
          <span className="text-xs text-slate-400">
            Atualizado em {formatISODateTimeBR(selectedJob.updatedAt)}
          </span>
          <button
            onClick={() => setIsJobDrawerOpen(false)}
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
