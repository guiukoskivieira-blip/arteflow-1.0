/**
 * ArteFlow — Interfaces de Repositório (Fase 1 e Fase 2A)
 * Preparado para substituir implementações locais por backend real futuramente.
 */

import {
  Order,
  ProductionJob,
  WorkflowStage,
  ProductionEvent,
  InventoryMaterial,
  ProductionMaterialRequirement,
  StockReservation,
  StockMovement,
} from './domain';

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

export interface IMaterialRepository {
  getById(organizationId: string, id: string): Promise<InventoryMaterial | null>;
  getBySku(organizationId: string, sku: string): Promise<InventoryMaterial | null>;
  list(organizationId: string): Promise<InventoryMaterial[]>;
  save(organizationId: string, material: InventoryMaterial): Promise<InventoryMaterial>;
  saveMany(organizationId: string, materials: InventoryMaterial[]): Promise<InventoryMaterial[]>;
  delete(organizationId: string, id: string): Promise<boolean>;
  clear(organizationId: string): Promise<void>;
}

export interface IRequirementRepository {
  getById(organizationId: string, id: string): Promise<ProductionMaterialRequirement | null>;
  listByJobId(organizationId: string, jobId: string): Promise<ProductionMaterialRequirement[]>;
  listAll(organizationId: string): Promise<ProductionMaterialRequirement[]>;
  save(organizationId: string, req: ProductionMaterialRequirement): Promise<ProductionMaterialRequirement>;
  saveMany(organizationId: string, reqs: ProductionMaterialRequirement[]): Promise<ProductionMaterialRequirement[]>;
  delete(organizationId: string, id: string): Promise<boolean>;
  clear(organizationId: string): Promise<void>;
}

export interface IReservationRepository {
  getById(organizationId: string, id: string): Promise<StockReservation | null>;
  listByJobId(organizationId: string, jobId: string): Promise<StockReservation[]>;
  listByMaterialId(organizationId: string, materialId: string): Promise<StockReservation[]>;
  listAll(organizationId: string): Promise<StockReservation[]>;
  save(organizationId: string, reservation: StockReservation): Promise<StockReservation>;
  saveMany(organizationId: string, reservations: StockReservation[]): Promise<StockReservation[]>;
  clear(organizationId: string): Promise<void>;
}

export interface IMovementRepository {
  getById(organizationId: string, id: string): Promise<StockMovement | null>;
  listByMaterialId(organizationId: string, materialId: string): Promise<StockMovement[]>;
  listAll(organizationId: string): Promise<StockMovement[]>;
  append(organizationId: string, movement: StockMovement): Promise<StockMovement>;
  appendMany(organizationId: string, movements: StockMovement[]): Promise<StockMovement[]>;
  clear(organizationId: string): Promise<void>;
}
