import { ProductionJob, ProductionJobFilter, WorkflowStage } from '../types/domain';
import { isJobBlocked, isJobOverdue, isJobDueToday } from '../domain/jobStatus';

export function filterProductionJobs(
  jobs: ProductionJob[],
  stages: WorkflowStage[],
  filter: ProductionJobFilter,
  referenceDate = new Date()
): ProductionJob[] {
  return jobs.filter((job) => {
    // 1. Filtro por Busca Textual (Cliente, Pedido, OP, Produto)
    if (filter.searchQuery && filter.searchQuery.trim()) {
      const query = filter.searchQuery.trim().toLowerCase();
      const matchCustomer = job.customer.name.toLowerCase().includes(query);
      const matchCustomerDoc = job.customer.document?.toLowerCase().includes(query) || false;
      const matchOrder = job.orderNumber.toLowerCase().includes(query);
      const matchJobCode = job.jobCode.toLowerCase().includes(query);
      const matchProduct = job.productName.toLowerCase().includes(query);
      const matchSector = job.sector.toLowerCase().includes(query);

      if (!matchCustomer && !matchCustomerDoc && !matchOrder && !matchJobCode && !matchProduct && !matchSector) {
        return false;
      }
    }

    // 2. Filtro por Etapa
    if (filter.stageId && filter.stageId !== 'ALL') {
      if (job.stageId !== filter.stageId) return false;
    }

    // 3. Filtro por Prioridade
    if (filter.priority && filter.priority !== 'ALL') {
      if (job.priority !== filter.priority) return false;
    }

    // 4. Filtro por Setor
    if (filter.sector && filter.sector !== 'ALL') {
      if (job.sector.toLowerCase() !== filter.sector.toLowerCase()) return false;
    }

    // 5. Filtro por Responsável
    if (filter.assigneeId && filter.assigneeId !== 'ALL') {
      if (filter.assigneeId === 'UNASSIGNED') {
        if (job.assignee !== null) return false;
      } else {
        if (job.assignee?.id !== filter.assigneeId) return false;
      }
    }

    // 6. Filtro por Prazo
    if (filter.deadlineRange && filter.deadlineRange !== 'ALL') {
      const overdue = isJobOverdue(job, stages, referenceDate);
      const dueToday = isJobDueToday(job, referenceDate);

      if (filter.deadlineRange === 'OVERDUE' && !overdue) {
        return false;
      }

      if (filter.deadlineRange === 'TODAY' && !dueToday) {
        return false;
      }

      if (filter.deadlineRange === 'THIS_WEEK') {
        if (!job.deadlineISO) return false;
        const deadline = new Date(job.deadlineISO);
        const weekAhead = new Date(referenceDate);
        weekAhead.setDate(weekAhead.getDate() + 7);
        if (deadline < referenceDate && !overdue) return false;
        if (deadline > weekAhead) return false;
      }

      if (filter.deadlineRange === 'FUTURE') {
        if (overdue || dueToday) return false;
      }
    }

    // 7. Filtro por Status dos Gates / Bloqueio
    if (filter.gateStatus && filter.gateStatus !== 'ALL') {
      const blocked = isJobBlocked(job);

      if (filter.gateStatus === 'BLOCKED' && !blocked) {
        return false;
      }

      if (filter.gateStatus === 'ARTWORK_PENDING') {
        if (job.artworkGate !== 'NOT_RECEIVED' && job.artworkGate !== 'PENDING_REVIEW') return false;
      }

      if (filter.gateStatus === 'MATERIAL_MISSING') {
        if (job.materialGate !== 'MISSING') return false;
      }

      if (filter.gateStatus === 'FINANCIAL_BLOCKED') {
        if (job.financialGate !== 'BLOCKED') return false;
      }

      if (filter.gateStatus === 'ALL_RELEASED') {
        if (job.artworkGate !== 'APPROVED' || job.materialGate !== 'AVAILABLE' || job.financialGate !== 'RELEASED') {
          return false;
        }
      }
    }

    // 8. Filtro por DataOrigin
    if (filter.dataOrigin && filter.dataOrigin !== 'ALL') {
      if (job.dataOrigin !== filter.dataOrigin) return false;
    }

    return true;
  });
}
