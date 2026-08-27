import { ProductionJob, WorkflowStage } from '../types/domain';
import { ARTWORK_GATE_CONFIG, MATERIAL_GATE_CONFIG, FINANCIAL_GATE_CONFIG } from './constants';

export interface JobBlockStatus {
  isBlocked: boolean;
  reasons: string[];
  artworkBlocked: boolean;
  materialBlocked: boolean;
  financialBlocked: boolean;
}

export function isJobBlocked(job: ProductionJob): boolean {
  return (
    ARTWORK_GATE_CONFIG[job.artworkGate]?.isBlocking ||
    MATERIAL_GATE_CONFIG[job.materialGate]?.isBlocking ||
    FINANCIAL_GATE_CONFIG[job.financialGate]?.isBlocking ||
    false
  );
}

export function getJobBlockDetails(job: ProductionJob): JobBlockStatus {
  const artworkBlocked = ARTWORK_GATE_CONFIG[job.artworkGate]?.isBlocking || false;
  const materialBlocked = MATERIAL_GATE_CONFIG[job.materialGate]?.isBlocking || false;
  const financialBlocked = FINANCIAL_GATE_CONFIG[job.financialGate]?.isBlocking || false;

  const reasons: string[] = [];
  if (artworkBlocked) {
    reasons.push(`Arte reprovada (${ARTWORK_GATE_CONFIG[job.artworkGate].label})`);
  }
  if (materialBlocked) {
    reasons.push(`Material em falta (${MATERIAL_GATE_CONFIG[job.materialGate].label})`);
  }
  if (financialBlocked) {
    reasons.push(`Financeiro bloqueado (${FINANCIAL_GATE_CONFIG[job.financialGate].label})`);
  }

  return {
    isBlocked: reasons.length > 0,
    reasons,
    artworkBlocked,
    materialBlocked,
    financialBlocked,
  };
}

export function isJobOverdue(job: ProductionJob, stages: WorkflowStage[], referenceDate = new Date()): boolean {
  if (!job.deadlineISO) return false;

  // Se o trabalho já estiver concluído ou entregue, não conta como atrasado
  const currentStage = stages.find((s) => s.id === job.stageId);
  if (currentStage?.isFinal || currentStage?.isTerminal) {
    return false;
  }

  const deadline = new Date(job.deadlineISO);
  if (isNaN(deadline.getTime())) return false;

  // Compara com final do dia do prazo
  const deadlineEndOfDay = new Date(deadline);
  deadlineEndOfDay.setHours(23, 59, 59, 999);

  return referenceDate.getTime() > deadlineEndOfDay.getTime();
}

export function isJobDueToday(job: ProductionJob, referenceDate = new Date()): boolean {
  if (!job.deadlineISO) return false;

  const deadline = new Date(job.deadlineISO);
  if (isNaN(deadline.getTime())) return false;

  return (
    deadline.getFullYear() === referenceDate.getFullYear() &&
    deadline.getMonth() === referenceDate.getMonth() &&
    deadline.getDate() === referenceDate.getDate()
  );
}

export function formatISODateBR(isoString: string): string {
  if (!isoString) return '—';
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return '—';
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}

export function formatISODateTimeBR(isoString: string): string {
  if (!isoString) return '—';
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return '—';
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}
