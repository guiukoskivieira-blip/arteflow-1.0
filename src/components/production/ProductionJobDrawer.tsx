import React, { useState, useEffect } from 'react';
import { useArteFlow } from '../../context/ArteFlowContext';
import {
  ArtworkGate,
  MaterialGate,
  FinancialGate,
  Priority,
  ProductionEvent,
  ProductionMaterialRequirement,
  StockReservation,
} from '../../types/domain';
import { DEMO_USERS, MATERIAL_UNIT_LABELS } from '../../domain/constants';
import { OriginBadge } from '../common/OriginBadge';
import { getJobBlockDetails, isJobOverdue, formatISODateTimeBR } from '../../domain/jobStatus';
import { formatMilliToQuantity, parseQuantityInputToMilli } from '../../domain/quantity';
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
  Package,
  Lock,
  Unlock,
  CheckCircle2,
  Plus,
  Play,
} from 'lucide-react';

export const ProductionJobDrawer: React.FC = () => {
  const {
    selectedJob,
    isJobDrawerOpen,
    setIsJobDrawerOpen,
    stages,
    materials,
    moveJobStage,
    updateArtworkGate,
    updateMaterialGate,
    updateFinancialGate,
    updateJobAssignee,
    updateJobPriority,
    updateJobDeadline,
    addJobNote,
    getJobEvents,
    getJobRequirements,
    getJobReservations,
    addJobRequirement,
    reserveRequirement,
    releaseReservation,
    consumeReservation,
  } = useArteFlow();

  const [events, setEvents] = useState<ProductionEvent[]>([]);
  const [requirements, setRequirements] = useState<ProductionMaterialRequirement[]>([]);
  const [reservations, setReservations] = useState<StockReservation[]>([]);
  const [newNote, setNewNote] = useState('');
  const [loadingEvents, setLoadingEvents] = useState(false);

  // Form para adicionar requisito
  const [isAddingReq, setIsAddingReq] = useState(false);
  const [selectedMatId, setSelectedMatId] = useState('');
  const [reqQtyStr, setReqQtyStr] = useState('');
  const [materialActionError, setMaterialActionError] = useState('');

  const loadData = async (jobId: string) => {
    setLoadingEvents(true);
    const [evts, reqs, res] = await Promise.all([
      getJobEvents(jobId),
      getJobRequirements(jobId),
      getJobReservations(jobId),
    ]);
    setEvents(evts);
    setRequirements(reqs);
    setReservations(res);
    setLoadingEvents(false);
  };

  useEffect(() => {
    if (selectedJob && isJobDrawerOpen) {
      loadData(selectedJob.id);
      setIsAddingReq(false);
      setMaterialActionError('');
    }
  }, [selectedJob?.id, isJobDrawerOpen]);

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
    await loadData(selectedJob.id);
  };

  const handleAddRequirementSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMaterialActionError('');

    const targetMatId = selectedMatId || (materials.filter((m) => m.isActive)[0]?.id ?? '');
    if (!targetMatId) {
      setMaterialActionError('Selecione um material válido do estoque.');
      return;
    }

    const qtyMilli = parseQuantityInputToMilli(reqQtyStr);
    if (qtyMilli <= 0) {
      setMaterialActionError('A quantidade necessária deve ser maior que zero.');
      return;
    }

    try {
      await addJobRequirement({
        productionJobId: selectedJob.id,
        materialId: targetMatId,
        requiredQuantityMilli: qtyMilli,
        dataOrigin: selectedJob.dataOrigin,
      });

      setReqQtyStr('');
      setIsAddingReq(false);
      await loadData(selectedJob.id);
    } catch (err: any) {
      setMaterialActionError(err.message || 'Erro ao adicionar requisito.');
    }
  };

  const handleReserve = async (req: ProductionMaterialRequirement, amountMilli: number) => {
    setMaterialActionError('');
    try {
      await reserveRequirement({
        requirementId: req.id,
        quantityMilli: amountMilli,
      });
      await loadData(selectedJob.id);
    } catch (err: any) {
      setMaterialActionError(err.message || 'Erro ao reservar material.');
    }
  };

  const handleRelease = async (reservationId: string) => {
    setMaterialActionError('');
    try {
      await releaseReservation(reservationId);
      await loadData(selectedJob.id);
    } catch (err: any) {
      setMaterialActionError(err.message || 'Erro ao liberar reserva.');
    }
  };

  const handleConsume = async (reservationId: string) => {
    setMaterialActionError('');
    try {
      await consumeReservation(reservationId);
      await loadData(selectedJob.id);
    } catch (err: any) {
      setMaterialActionError(err.message || 'Erro ao consumir reserva de material.');
    }
  };

  const deadlineInputVal = selectedJob.deadlineISO
    ? selectedJob.deadlineISO.substring(0, 10)
    : '';

  const activeMaterials = materials.filter((m) => m.isActive);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="job-drawer-title"
      data-testid="job-drawer"
      className="fixed inset-0 z-50 overflow-hidden flex justify-end"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
        onClick={() => setIsJobDrawerOpen(false)}
      />

      {/* Slide-over Card */}
      <div className="relative w-full max-w-2xl bg-white shadow-2xl border-l border-slate-200 flex flex-col h-full z-10">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/90 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-sky-600 flex items-center justify-center text-white shadow-sm">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-black text-sky-800 bg-sky-50 border border-sky-200 px-2 py-0.5 rounded">
                  {selectedJob.jobCode}
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  Ref. Pedido: {selectedJob.orderNumber}
                </span>
                <OriginBadge type="data" value={selectedJob.dataOrigin} />
              </div>
              <h3 id="job-drawer-title" className="text-base font-bold text-slate-900 leading-tight mt-0.5">
                {selectedJob.productName}
              </h3>
            </div>
          </div>

          <button
            onClick={() => setIsJobDrawerOpen(false)}
            aria-label="Fechar gaveta da OP"
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
              <Layers className="w-4 h-4 text-sky-600" />
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
                className="w-full text-xs font-medium px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 focus:outline-none"
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
                  className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-sky-500"
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
                  className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-sky-500"
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
                  className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-sky-500"
                >
                  <option value="RELEASED">Liberado</option>
                  <option value="DEPOSIT_PENDING">Sinal pendente (Bloqueia)</option>
                  <option value="PAYMENT_PENDING">Pgto pendente (Bloqueia)</option>
                  <option value="BLOCKED">Bloqueado</option>
                </select>
              </div>
            </div>

            {/* Priority, Assignee & Deadline */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-200">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Prioridade:
                </label>
                <select
                  value={selectedJob.priority}
                  onChange={handlePriorityChange}
                  className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg focus:outline-none"
                >
                  <option value="LOW">Baixa</option>
                  <option value="MEDIUM">Média</option>
                  <option value="HIGH">Alta</option>
                  <option value="URGENT">Urgente</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Responsável:
                </label>
                <select
                  value={selectedJob.assignee?.id || 'UNASSIGNED'}
                  onChange={handleAssigneeChange}
                  className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg focus:outline-none"
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
                  Prazo de Entrega:
                </label>
                <input
                  type="date"
                  value={deadlineInputVal}
                  onChange={handleDeadlineChange}
                  className="w-full text-xs px-2.5 py-1 bg-white border border-slate-300 rounded-lg focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* SECTION: PLANO DE MATERIAIS & RESERVAS (FASE 2A) */}
          <div className="border border-slate-200 rounded-xl p-4 space-y-4 bg-white shadow-2xs">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-sky-600" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Plano de Materiais & Reservas ({requirements.length})
                </h4>
              </div>

              {!isAddingReq && (
                <button
                  onClick={() => setIsAddingReq(true)}
                  className="px-2.5 py-1 text-xs font-semibold text-sky-700 bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded-lg flex items-center gap-1 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Vincular Material</span>
                </button>
              )}
            </div>

            {materialActionError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs font-semibold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{materialActionError}</span>
              </div>
            )}

            {/* Form de Vincular Material */}
            {isAddingReq && (
              <form
                onSubmit={handleAddRequirementSubmit}
                className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800">
                    Vincular Requisito de Estoque à OP
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsAddingReq(false)}
                    className="text-xs text-slate-400 hover:text-slate-600"
                  >
                    Cancelar
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Material Disponível no Estoque *
                    </label>
                    <select
                      value={selectedMatId || (activeMaterials[0]?.id ?? '')}
                      onChange={(e) => setSelectedMatId(e.target.value)}
                      className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg focus:outline-none font-semibold text-slate-800"
                    >
                      {activeMaterials.map((m) => (
                        <option key={m.id} value={m.id}>
                          [{m.sku}] {m.name} ({MATERIAL_UNIT_LABELS[m.unit].abbr})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Quantidade Necessária *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: 50"
                      value={reqQtyStr}
                      onChange={(e) => setReqQtyStr(e.target.value)}
                      className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsAddingReq(false)}
                    className="px-3 py-1 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg"
                  >
                    Fechar
                  </button>
                  <button
                    type="submit"
                    className="px-3 py-1 text-xs font-bold text-white bg-sky-600 hover:bg-sky-700 rounded-lg shadow-2xs"
                  >
                    Salvar Requisito
                  </button>
                </div>
              </form>
            )}

            {/* Requirements List */}
            {requirements.length === 0 ? (
              <p className="text-xs text-slate-400 py-3 text-center border border-dashed border-slate-200 rounded-lg">
                Nenhum plano de materiais cadastrado para esta OP (Gate = Não Verificado).
              </p>
            ) : (
              <div className="space-y-3">
                {requirements.map((req) => {
                  const reqRes = reservations.filter((r) => r.requirementId === req.id);
                  const activeRes = reqRes.filter((r) => r.status === 'ACTIVE');
                  const consumedRes = reqRes.filter((r) => r.status === 'CONSUMED');

                  const activeReservedMilli = activeRes.reduce((sum, r) => sum + r.reservedQuantityMilli, 0);
                  const consumedMilli = consumedRes.reduce((sum, r) => sum + r.reservedQuantityMilli, 0);
                  const totalCoveredMilli = activeReservedMilli + consumedMilli;
                  const uncoveredMilli = Math.max(0, req.requiredQuantityMilli - totalCoveredMilli);

                  const isFullyCovered = totalCoveredMilli >= req.requiredQuantityMilli;
                  const unitAbbr = MATERIAL_UNIT_LABELS[req.materialSnapshot.unit].abbr;

                  return (
                    <div
                      key={req.id}
                      className="p-3.5 bg-slate-50/70 border border-slate-200 rounded-xl space-y-2.5 text-xs"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-[10px] font-bold px-1 bg-slate-200 text-slate-700 rounded">
                              {req.materialSnapshot.sku}
                            </span>
                            <span className="font-bold text-slate-900">{req.materialSnapshot.name}</span>
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            Necessário:{' '}
                            <strong className="text-slate-800">
                              {formatMilliToQuantity(req.requiredQuantityMilli)} {unitAbbr}
                            </strong>
                          </div>
                        </div>

                        <div>
                          {isFullyCovered ? (
                            <span className="px-2 py-0.5 bg-sky-50 text-sky-700 border border-sky-200 rounded text-[10px] font-bold flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              100% Coberto
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 rounded text-[10px] font-bold">
                              Faltam {formatMilliToQuantity(uncoveredMilli)} {unitAbbr}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Status breakdown & action bar */}
                      <div className="flex items-center justify-between flex-wrap gap-2 pt-2 border-t border-slate-200/80">
                        <div className="text-[11px] text-slate-600 flex items-center gap-3">
                          <span>
                            Reservado:{' '}
                            <strong className="text-sky-700">
                              {formatMilliToQuantity(activeReservedMilli)} {unitAbbr}
                            </strong>
                          </span>
                          {consumedMilli > 0 && (
                            <span>
                              Consumido:{' '}
                              <strong className="text-blue-700">
                                {formatMilliToQuantity(consumedMilli)} {unitAbbr}
                              </strong>
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5">
                          {uncoveredMilli > 0 && (
                            <button
                              onClick={() => handleReserve(req, uncoveredMilli)}
                              className="px-2.5 py-1 bg-sky-600 hover:bg-sky-700 text-white rounded font-semibold text-[11px] flex items-center gap-1 shadow-2xs transition-colors"
                            >
                              <Lock className="w-3 h-3" />
                              <span>Reservar ({formatMilliToQuantity(uncoveredMilli)})</span>
                            </button>
                          )}

                          {activeRes.map((res) => (
                            <div key={res.id} className="flex items-center gap-1">
                              <button
                                onClick={() => handleConsume(res.id)}
                                className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded font-semibold text-[11px] flex items-center gap-1 shadow-2xs transition-colors"
                                title="Baixar saldo físico do estoque"
                              >
                                <Play className="w-3 h-3" />
                                <span>Consumir</span>
                              </button>
                              <button
                                onClick={() => handleRelease(res.id)}
                                className="px-2 py-1 bg-white hover:bg-red-50 text-slate-600 hover:text-red-700 border border-slate-300 rounded font-semibold text-[11px] flex items-center gap-1 transition-colors"
                                title="Liberar reserva de estoque"
                              >
                                <Unlock className="w-3 h-3" />
                                <span>Liberar</span>
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Technical Specs */}
          <div className="border border-slate-200 rounded-xl p-4 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-sky-600" />
              <span>Especificações do Produto</span>
            </h4>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <span className="text-slate-400 block">Quantidade:</span>
                <span className="font-bold text-slate-900">
                  {selectedJob.quantity} {selectedJob.unit}
                </span>
              </div>

              <div>
                <span className="text-slate-400 block">Setor Produtivo:</span>
                <span className="font-semibold text-slate-800">{selectedJob.sector}</span>
              </div>

              {selectedJob.dimensions && (
                <div>
                  <span className="text-slate-400 block">Dimensões:</span>
                  <span className="font-semibold text-slate-800 font-mono">
                    {selectedJob.dimensions.width} x {selectedJob.dimensions.height}{' '}
                    {selectedJob.dimensions.unit}
                  </span>
                </div>
              )}
            </div>

            {/* Finishings */}
            {selectedJob.finishings && selectedJob.finishings.length > 0 && (
              <div className="pt-2 border-t border-slate-100">
                <span className="text-xs text-slate-400 font-medium block mb-1">
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
              <Building2 className="w-4 h-4 text-sky-600" />
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
                <History className="w-4 h-4 text-sky-600" />
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
                className="flex-1 text-xs px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:ring-1 focus:ring-sky-500 focus:outline-none"
              />
              <button
                type="submit"
                disabled={!newNote.trim()}
                className="px-3 py-2 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
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
