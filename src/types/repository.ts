/**
 * ArteFlow — Interfaces de Repositório
 * Preparado para substituir implementações locais por backend real futuramente.
 */

import { Order, ProductionJob, WorkflowStage, ProductionEvent } from './domain';

export interface IOrderRepository {
  getById(organizationId: string, id: string): Promise<Order | null>;
  getByOrderNumber(organizationId: string, orderNumber: string): Promise<Order | null>;
  list(organizationId: string): Promise<Order[]>;
  save(organizationId: string, order: Order): Promise<Order>;
  delete(organizationId: string, id: string): Promise<boolean>;
  clear(organizationId: string): Promise<void>;
}

export interface IProductionJobRepository {
  getById(organizationId: string, id: string): Promise<ProductionJob | null>;
  getByJobCode(organizationId: string, jobCode: string): Promise<ProductionJob | null>;
  list(organizationId: string): Promise<ProductionJob[]>;
  listByOrderId(organizationId: string, orderId: string): Promise<ProductionJob[]>;
  listByStageId(organizationId: string, stageId: string): Promise<ProductionJob[]>;
  save(organizationId: string, job: ProductionJob): Promise<ProductionJob>;
  saveMany(organizationId: string, jobs: ProductionJob[]): Promise<ProductionJob[]>;
  delete(organizationId: string, id: string): Promise<boolean>;
  clear(organizationId: string): Promise<void>;
}

export interface IWorkflowStageRepository {
  list(organizationId: string): Promise<WorkflowStage[]>;
  getById(organizationId: string, id: string): Promise<WorkflowStage | null>;
  save(organizationId: string, stage: WorkflowStage): Promise<WorkflowStage>;
  saveMany(organizationId: string, stages: WorkflowStage[]): Promise<WorkflowStage[]>;
  clear(organizationId: string): Promise<void>;
}

export interface IProductionEventRepository {
  listByJobId(organizationId: string, jobId: string): Promise<ProductionEvent[]>;
  listAll(organizationId: string): Promise<ProductionEvent[]>;
  append(organizationId: string, event: ProductionEvent): Promise<ProductionEvent>;
  appendMany(organizationId: string, events: ProductionEvent[]): Promise<ProductionEvent[]>;
  clear(organizationId: string): Promise<void>;
}
