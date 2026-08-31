import {
  InventoryMaterial,
  ProductionMaterialRequirement,
  StockReservation,
} from '../types/inventory';
import { ProductionJob } from '../types/domain';
import {
  PurchaseRequest,
  PurchaseRequestItem,
  ProcurementSuggestion,
} from '../types/procurement';
import { isValidQuantityMilli } from '../domain/quantity';

export interface ComputeSuggestionsInput {
  organizationId: string;
  materials: InventoryMaterial[];
  requirements: ProductionMaterialRequirement[];
  reservations: StockReservation[];
  jobs: ProductionJob[];
  openRequests: {
    request: PurchaseRequest;
    items: PurchaseRequestItem[];
  }[];
}

/**
 * Serviço puro determinístico para detecção de necessidades e sugestões de compra
 */
export function computeProcurementSuggestions(
  input: ComputeSuggestionsInput
): ProcurementSuggestion[] {
  const suggestions: ProcurementSuggestion[] = [];
  const { materials, requirements, reservations, jobs, openRequests } = input;

  const activeMaterials = materials.filter((m) => m.isActive);

  // Mapeia reservas ACTIVE por material
  const activeReservationsByMaterial = new Map<string, number>();
  for (const res of reservations) {
    if (res.status === 'ACTIVE') {
      const current = activeReservationsByMaterial.get(res.materialId) || 0;
      activeReservationsByMaterial.set(res.materialId, current + res.reservedQuantityMilli);
    }
  }

  // Mapeia saldo disponível por material: stockOnHandMilli - activeReservations
  const availableStockByMaterial = new Map<string, number>();
  for (const mat of activeMaterials) {
    const activeRes = activeReservationsByMaterial.get(mat.id) || 0;
    const avail = Math.max(0, mat.stockOnHandMilli - activeRes);
    availableStockByMaterial.set(mat.id, avail);
  }

  // Identifica itens de solicitações abertas (DRAFT ou REQUESTED)
  const openRequestItemsByMaterial = new Map<string, Set<string>>(); // materialId -> Set de (jobId ou 'MINIMUM_STOCK')
  for (const { request, items } of openRequests) {
    if (request.status === 'DRAFT' || request.status === 'REQUESTED') {
      for (const item of items) {
        let set = openRequestItemsByMaterial.get(item.materialId);
        if (!set) {
          set = new Set<string>();
          openRequestItemsByMaterial.set(item.materialId, set);
        }
        if (item.productionJobId) {
          set.add(item.productionJobId);
        } else {
          set.add('MINIMUM_STOCK');
          set.add('MANUAL');
        }
      }
    }
  }

  // Simulação de alocação de saldo disponível para não contar duas vezes
  const simulatedAvailable = new Map<string, number>(availableStockByMaterial);

  // 1. Detectar falta de material em Ordens de Produção (OPs)
  // Ordena requisitos por data de criação / sequência
  const sortedReqs = [...requirements].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  for (const req of sortedReqs) {
    const mat = activeMaterials.find((m) => m.id === req.materialId);
    if (!mat) continue;

    const job = jobs.find((j) => j.id === req.productionJobId);
    if (!job) continue;

    // Se a OP já foi entregue ou cancelada, não gera necessidade de compra
    if (job.stageId === 'stage-delivered') continue;

    // Calcula atendimento atual (ACTIVE + CONSUMED)
    const reqReservations = reservations.filter(
      (r) => r.requirementId === req.id && (r.status === 'ACTIVE' || r.status === 'CONSUMED')
    );
    const fulfilledMilli = reqReservations.reduce((sum, r) => sum + r.reservedQuantityMilli, 0);
    const remainingReqMilli = req.requiredQuantityMilli - fulfilledMilli;

    if (remainingReqMilli > 0) {
      const currentAvail = simulatedAvailable.get(mat.id) || 0;
      if (currentAvail >= remainingReqMilli) {
        // Saldo cobre a necessidade desta OP nesta simulação
        simulatedAvailable.set(mat.id, currentAvail - remainingReqMilli);
      } else {
        // Saldo insuficiente: calcula o shortage exato
        const shortageMilli = remainingReqMilli - currentAvail;
        // Consome todo o saldo disponível simulado restante
        simulatedAvailable.set(mat.id, 0);

        if (isValidQuantityMilli(shortageMilli)) {
          const openSet = openRequestItemsByMaterial.get(mat.id);
          const hasOpenRequest = openSet ? openSet.has(job.id) : false;

          const totalActiveRes = activeReservationsByMaterial.get(mat.id) || 0;
          const globalAvail = Math.max(0, mat.stockOnHandMilli - totalActiveRes);

          suggestions.push({
            id: `sug-job-${req.id}-${job.id}`,
            materialId: mat.id,
            materialSku: mat.sku,
            materialName: mat.name,
            unit: mat.unit,
            stockOnHandMilli: mat.stockOnHandMilli,
            reservedMilli: totalActiveRes,
            availableMilli: globalAvail,
            minimumStockMilli: mat.minimumStockMilli,
            suggestedQuantityMilli: shortageMilli,
            source: 'PRODUCTION_SHORTAGE',
            productionJobId: job.id,
            jobCode: job.jobCode,
            productName: job.productName,
            reason: `Falta de material para a OP ${job.jobCode} (${job.productName})`,
            hasOpenRequest,
          });
        }
      }
    }
  }

  // 2. Detectar materiais abaixo do estoque mínimo
  for (const mat of activeMaterials) {
    if (mat.minimumStockMilli <= 0) continue;

    const totalActiveRes = activeReservationsByMaterial.get(mat.id) || 0;
    const globalAvail = Math.max(0, mat.stockOnHandMilli - totalActiveRes);

    if (globalAvail < mat.minimumStockMilli) {
      const shortageMilli = mat.minimumStockMilli - globalAvail;
      if (isValidQuantityMilli(shortageMilli)) {
        const openSet = openRequestItemsByMaterial.get(mat.id);
        const hasOpenRequest = openSet ? openSet.has('MINIMUM_STOCK') : false;

        suggestions.push({
          id: `sug-min-${mat.id}`,
          materialId: mat.id,
          materialSku: mat.sku,
          materialName: mat.name,
          unit: mat.unit,
          stockOnHandMilli: mat.stockOnHandMilli,
          reservedMilli: totalActiveRes,
          availableMilli: globalAvail,
          minimumStockMilli: mat.minimumStockMilli,
          suggestedQuantityMilli: shortageMilli,
          source: 'MINIMUM_STOCK',
          reason: `Estoque disponível (${globalAvail / 1000} ${mat.unit}) abaixo do mínimo (${mat.minimumStockMilli / 1000} ${mat.unit})`,
          hasOpenRequest,
        });
      }
    }
  }

  return suggestions;
}
