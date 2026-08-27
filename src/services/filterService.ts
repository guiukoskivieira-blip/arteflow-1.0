import { ProductionJob, ProductionJobFilter, WorkflowStage } from '../types/domain';
import { isJobBlocked, isJobOverdue, isJobDueToday } from '../domain/jobStatus';

export function filterProductionJobs(
  jobs: ProductionJob[],
  stages: WorkflowStage[],
  filter: Partial<ProductionJobFilter>,
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

    // 6. Filtro por Prazo de Entrega
    if (filter.deadlineRange && filter.deadlineRange !== 'ALL') {
      const isOverdue = isJobOverdue(job, stages, referenceDate);
      const isToday = isJobDueToday(job, referenceDate);

      const jobDeadline = new Date(job.deadlineISO);
      const diffDays = (jobDeadline.getTime() - referenceDate.getTime()) / (1000 * 60 * 60 * 24);

      if (filter.deadlineRange === 'OVERDUE' && !isOverdue) return false;
      if (filter.deadlineRange === 'TODAY' && !isToday) return false;
      if (filter.deadlineRange === 'THIS_WEEK') {
        if (isOverdue || diffDays > 7) return false;
      }
      if (filter.deadlineRange === 'FUTURE') {
        if (isOverdue || isToday || diffDays <= 7) return false;
      }
    }

    // 7. Filtro por Status de Gates
    if (filter.gateStatus && filter.gateStatus !== 'ALL') {
      const isBlocked = isJobBlocked(job);

      if (filter.gateStatus === 'BLOCKED' && !isBlocked) return false;
      if (filter.gateStatus === 'ARTWORK_PENDING' && job.artworkGate !== 'PENDING_REVIEW') return false;
      if (filter.gateStatus === 'MATERIAL_MISSING' && job.materialGate !== 'MISSING') return false;
      if (filter.gateStatus === 'FINANCIAL_BLOCKED' && (job.financialGate !== 'BLOCKED' && job.financialGate !== 'DEPOSIT_PENDING')) return false;
      if (filter.gateStatus === 'ALL_RELEASED') {
        if (job.artworkGate !== 'APPROVED' || job.materialGate !== 'AVAILABLE' && job.materialGate !== 'RESERVED' || job.financialGate !== 'RELEASED') {
          return false;
        }
      }
    }

    // 8. Filtro por Origem de Dados (Demo vs Usuário)
    if (filter.dataOrigin && filter.dataOrigin !== 'ALL') {
      if (job.dataOrigin !== filter.dataOrigin) return false;
    }

    return true;
  });
}
