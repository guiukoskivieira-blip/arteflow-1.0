import { DataOrigin } from './domain';

/**
 * Unidades canônicas estáveis para materiais no ArteFlow
 */
export type MaterialUnit =
  | 'UNIT'
  | 'SHEET'
  | 'METER'
  | 'SQUARE_METER'
  | 'LITER'
  | 'KILOGRAM'
  | 'ROLL'
  | 'PACKAGE';

/**
 * Material de Estoque
 * Quantidades físicas e mínimas sempre em milésimos inteiros (quantityMilli)
 * Custos sempre em centavos inteiros (cents)
 */
export interface InventoryMaterial {
  id: string;
  organizationId: string;
  sku: string;
  name: string;
  category: string;
  unit: MaterialUnit;
  stockOnHandMilli: number;
  minimumStockMilli: number;
  averageCostCents: number;
  supplierName?: string;
  isActive: boolean;
  dataOrigin: DataOrigin;
  createdAt: string;
  updatedAt: string;
}

/**
 * Snapshot do material no momento da definição do requisito
 */
export interface MaterialSnapshot {
  sku: string;
  name: string;
  unit: MaterialUnit;
  averageCostCents: number;
}

/**
 * Requisito de material vinculado a uma Ordem de Produção (OP)
 */
export interface ProductionMaterialRequirement {
  id: string;
  organizationId: string;
  productionJobId: string;
  materialId: string;
  materialSnapshot: MaterialSnapshot;
  requiredQuantityMilli: number;
  createdAt: string;
  dataOrigin: DataOrigin;
}

export type ReservationStatus = 'ACTIVE' | 'RELEASED' | 'CONSUMED';

/**
 * Reserva de material para uma OP
 */
export interface StockReservation {
  id: string;
  organizationId: string;
  productionJobId: string;
  requirementId: string;
  materialId: string;
  reservedQuantityMilli: number;
  status: ReservationStatus;
  createdAt: string;
  updatedAt: string;
  releasedAt?: string;
  consumedAt?: string;
  userId: string;
  userName: string;
}

export type MovementType =
  | 'RECEIPT'
  | 'CONSUMPTION'
  | 'POSITIVE_ADJUSTMENT'
  | 'NEGATIVE_ADJUSTMENT'
  | 'RETURN';

/**
 * Movimentação de estoque imutável (append-only)
 */
export interface StockMovement {
  id: string;
  organizationId: string;
  materialId: string;
  type: MovementType;
  quantityMilli: number; // Sempre positivo
  previousBalanceMilli: number;
  resultingBalanceMilli: number;
  unitCostCents?: number;
  totalCostCents?: number;
  productionJobId?: string;
  reservationId?: string;
  reason: string;
  createdAt: string;
  userId: string;
  userName: string;
  dataOrigin: DataOrigin;
}

/**
 * Filtro para listagem de materiais
 */
export interface MaterialFilter {
  searchQuery: string;
  category: string;
  unit: string;
  belowMinimumOnly: boolean;
  status: 'ALL' | 'ACTIVE' | 'INACTIVE';
  dataOrigin: 'ALL' | 'demo' | 'user';
}
