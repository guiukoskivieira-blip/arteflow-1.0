import { describe, it, expect } from 'vitest';
import { filterProductionJobs } from '../services/filterService';
import { ProductionJob, WorkflowStage } from '../types/domain';
import { getInitialStages } from '../domain/seed';

describe('ArteFlow — Pesquisa e Filtros de Produção (Fase 1)', () => {
  const stages: WorkflowStage[] = getInitialStages('org-test');
  const referenceDate = new Date('2026-08-27T12:00:00.000Z');

  const sampleJobs: ProductionJob[] = [
    {
      id: 'job-1',
      jobCode: 'OP-2026-0101',
      orderId: 'ord-101',
      orderNumber: 'PED-2026-0101',
      orderItemId: 'item-101',
      organizationId: 'org-test',
      customer: { id: 'c1', name: 'Padaria Estrela do Sul', document: '12.345.678/0001-90' },
      productName: 'Cardápio Encadernado Wire-o',
      quantity: 50,
      unit: 'un',
      finishings: [],
      stageId: 'stage-prepress',
      artworkGate: 'APPROVED',
      materialGate: 'AVAILABLE',
      financialGate: 'RELEASED',
      priority: 'HIGH',
      sector: 'Impressão Digital',
      assignee: { id: 'u1', name: 'Mariana Designer' },
      deadlineISO: '2026-08-27T18:00:00.000Z', // Hoje
      createdAt: '2026-08-25T10:00:00.000Z',
      updatedAt: '2026-08-25T10:00:00.000Z',
      dataOrigin: 'demo',
    },
    {
      id: 'job-2',
      jobCode: 'OP-2026-0102',
      orderId: 'ord-102',
      orderNumber: 'PED-2026-0102',
      orderItemId: 'item-102',
      organizationId: 'org-test',
      customer: { id: 'c2', name: 'Construtora Horizonte', document: '98.765.432/0001-11' },
      productName: 'Placa de Obra Galvanizada 2x1m',
      quantity: 4,
      unit: 'un',
      finishings: [],
      stageId: 'stage-awaiting-material',
      artworkGate: 'APPROVED',
      materialGate: 'MISSING', // Bloqueado
      financialGate: 'RELEASED',
      priority: 'URGENT',
      sector: 'Serralheria & Estrutura',
      assignee: { id: 'u2', name: 'Roberto Produção' },
      deadlineISO: '2026-08-20T18:00:00.000Z', // Atrasado
      createdAt: '2026-08-20T10:00:00.000Z',
      updatedAt: '2026-08-20T10:00:00.000Z',
      dataOrigin: 'user',
    },
    {
      id: 'job-3',
      jobCode: 'OP-2026-0103',
      orderId: 'ord-103',
      orderNumber: 'PED-2026-0103',
      orderItemId: 'item-103',
      organizationId: 'org-test',
      customer: { id: 'c3', name: 'Academia Corpo & Vida' },
      productName: 'Adesivo de Piso Antiderrapante',
      quantity: 10,
      unit: 'm²',
      finishings: [],
      stageId: 'stage-finishing',
      artworkGate: 'APPROVED',
      materialGate: 'AVAILABLE',
      financialGate: 'RELEASED',
      priority: 'LOW',
      sector: 'Comunicação Visual',
      assignee: null,
      deadlineISO: '2026-09-02T18:00:00.000Z', // Próxima semana
      createdAt: '2026-08-26T10:00:00.000Z',
      updatedAt: '2026-08-26T10:00:00.000Z',
      dataOrigin: 'user',
    },
  ];

  // Requisito 8: Pesquisa por cliente, pedido, OP e produto
  it('8. Pesquisa por cliente, número de pedido, número de OP e nome do produto', () => {
    // Busca por Cliente
    const resCustomer = filterProductionJobs(sampleJobs, stages, { searchQuery: 'Estrela do Sul' }, referenceDate);
    expect(resCustomer).toHaveLength(1);
    expect(resCustomer[0].id).toBe('job-1');

    // Busca por Número do Pedido
    const resOrder = filterProductionJobs(sampleJobs, stages, { searchQuery: 'PED-2026-0102' }, referenceDate);
    expect(resOrder).toHaveLength(1);
    expect(resOrder[0].id).toBe('job-2');

    // Busca por Número da OP
    const resJobCode = filterProductionJobs(sampleJobs, stages, { searchQuery: 'OP-2026-0103' }, referenceDate);
    expect(resJobCode).toHaveLength(1);
    expect(resJobCode[0].id).toBe('job-3');

    // Busca por Nome do Produto
    const resProduct = filterProductionJobs(sampleJobs, stages, { searchQuery: 'Galvanizada' }, referenceDate);
    expect(resProduct).toHaveLength(1);
    expect(resProduct[0].id).toBe('job-2');
  });

  // Requisito 9: Filtros por prazo, responsável, setor e prioridade
  it('9. Filtros funcionais por prazo, responsável, setor e prioridade', () => {
    // Filtro por Prioridade URGENT
    const resPriority = filterProductionJobs(sampleJobs, stages, { priority: 'URGENT' }, referenceDate);
    expect(resPriority).toHaveLength(1);
    expect(resPriority[0].id).toBe('job-2');

    // Filtro por Setor
    const resSector = filterProductionJobs(sampleJobs, stages, { sector: 'Impressão Digital' }, referenceDate);
    expect(resSector).toHaveLength(1);
    expect(resSector[0].id).toBe('job-1');

    // Filtro por Responsável (Não atribuído)
    const resUnassigned = filterProductionJobs(sampleJobs, stages, { assigneeId: 'UNASSIGNED' }, referenceDate);
    expect(resUnassigned).toHaveLength(1);
    expect(resUnassigned[0].id).toBe('job-3');

    // Filtro por Prazo (Atrasadas)
    const resOverdue = filterProductionJobs(sampleJobs, stages, { deadlineRange: 'OVERDUE' }, referenceDate);
    expect(resOverdue).toHaveLength(1);
    expect(resOverdue[0].id).toBe('job-2');

    // Filtro por Prazo (Para Hoje)
    const resToday = filterProductionJobs(sampleJobs, stages, { deadlineRange: 'TODAY' }, referenceDate);
    expect(resToday).toHaveLength(1);
    expect(resToday[0].id).toBe('job-1');

    // Filtro por Bloqueio
    const resBlocked = filterProductionJobs(sampleJobs, stages, { gateStatus: 'BLOCKED' }, referenceDate);
    expect(resBlocked).toHaveLength(1);
    expect(resBlocked[0].id).toBe('job-2');
  });
});
