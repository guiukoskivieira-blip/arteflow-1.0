import { DataOrigin } from './domain';

export type { DataOrigin };
import { MaterialUnit, MaterialSnapshot } from './inventory';

/**
 * Fornecedor cadastrado
 */
export interface Supplier {
  id: string;
  organizationId: string;
  code: string;
  tradeName: string;
  corporateName?: string;
  document?: string; // CPF ou CNPJ normalizado
  contactName?: string;
  email?: string;
  phone?: string;
  address?: string;
  defaultLeadTimeDays?: number;
  paymentTermsSnapshot?: string;
  notes?: string;
  isActive: boolean;
  dataOrigin: DataOrigin;
  createdAt: string;
  updatedAt: string;
}

/**
 * Snapshot imutável de fornecedor no momento da emissão do pedido
 */
export interface SupplierSnapshot {
  id: string;
  code: string;
  tradeName: string;
  corporateName?: string;
  document?: string;
  contactName?: string;
  email?: string;
  phone?: string;
}

export type PurchaseRequestStatus = 'DRAFT' | 'REQUESTED' | 'CONVERTED' | 'CANCELLED';

export type PurchaseRequestSource = 'MANUAL' | 'MINIMUM_STOCK' | 'PRODUCTION_SHORTAGE';

/**
 * Solicitação de Compra (SC)
 */
export interface PurchaseRequest {
  id: string;
  organizationId: string;
  requestNumber: string; // SC-YYYY-0001
  status: PurchaseRequestStatus;
  source: PurchaseRequestSource;
  productionJobId?: string;
  jobCode?: string;
  notes?: string;
  cancellationReason?: string;
  cancelledBy?: string;
  cancelledByName?: string;
  requestedBy: string;
  requestedByName: string;
  requestedAt: string;
  dataOrigin: DataOrigin;
  createdAt: string;
  updatedAt: string;
}

/**
 * Item de uma Solicitação de Compra
 */
export interface PurchaseRequestItem {
  id: string;
  organizationId: string;
  purchaseRequestId: string;
  materialId: string;
  materialSnapshot: MaterialSnapshot;
  requestedQuantityMilli: number;
  unit: MaterialUnit;
  reason: string;
  productionJobId?: string;
  createdAt: string;
}

export type PurchaseOrderStatus =
  | 'DRAFT'
  | 'ISSUED'
  | 'PARTIALLY_RECEIVED'
  | 'RECEIVED'
  | 'CANCELLED';

/**
 * Pedido de Compra (PC)
 */
export interface PurchaseOrder {
  id: string;
  organizationId: string;
  orderNumber: string; // PC-YYYY-0001
  supplierId: string;
  supplierSnapshot: SupplierSnapshot;
  status: PurchaseOrderStatus;
  expectedAt?: string;
  freightCents: number;
  discountCents: number;
  subtotalCents: number;
  totalCents: number;
  notes?: string;
  cancellationReason?: string;
  issuedAt?: string;
  createdBy: string;
  createdByName: string;
  dataOrigin: DataOrigin;
  createdAt: string;
  updatedAt: string;
}

/**
 * Item de um Pedido de Compra
 */
export interface PurchaseOrderItem {
  id: string;
  organizationId: string;
  purchaseOrderId: string;
  purchaseRequestItemId?: string;
  materialId: string;
  materialSnapshot: MaterialSnapshot;
  orderedQuantityMilli: number;
  receivedQuantityMilli: number;
  unit: MaterialUnit;
  unitCostCents: number;
  totalCostCents: number;
  productionJobId?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Recebimento Físico de Mercadorias (REC)
 */
export interface GoodsReceipt {
  id: string;
  organizationId: string;
  purchaseOrderId: string;
  receiptNumber: string; // REC-YYYY-0001
  supplierSnapshot: SupplierSnapshot;
  invoiceNumber?: string;
  receivedAt: string;
  receivedBy: string;
  receivedByName: string;
  notes?: string;
  idempotencyKey: string;
  dataOrigin: DataOrigin;
  createdAt: string;
}

/**
 * Item individual recebido em uma entrega
 */
export interface GoodsReceiptItem {
  id: string;
  organizationId: string;
  goodsReceiptId: string;
  purchaseOrderItemId: string;
  materialId: string;
  receivedQuantityMilli: number;
  unitCostCents: number;
  totalCostCents: number;
  stockMovementId: string;
  createdAt: string;
}

export type ProcurementEventType =
  | 'SUPPLIER_CREATED'
  | 'SUPPLIER_UPDATED'
  | 'SUPPLIER_TOGGLED'
  | 'REQUEST_CREATED'
  | 'REQUEST_UPDATED'
  | 'REQUEST_STATUS_CHANGED'
  | 'REQUEST_CONVERTED'
  | 'REQUEST_CANCELLED'
  | 'ORDER_CREATED'
  | 'ORDER_UPDATED'
  | 'ORDER_ISSUED'
  | 'ORDER_STATUS_CHANGED'
  | 'GOODS_RECEIVED'
  | 'ORDER_CANCELLED';

/**
 * Evento imutável de auditoria de compras (append-only)
 */
export interface ProcurementEvent {
  id: string;
  organizationId: string;
  entityType: 'SUPPLIER' | 'REQUEST' | 'ORDER' | 'RECEIPT';
  entityId: string;
  eventType: ProcurementEventType;
  description: string;
  metadata?: Record<string, any>;
  userId: string;
  userName: string;
  createdAt: string;
}

/**
 * Sugestão pura de compra calculada dinamicamente
 */
export interface ProcurementSuggestion {
  id: string; // Identificador determinístico da necessidade
  materialId: string;
  materialSku: string;
  materialName: string;
  unit: MaterialUnit;
  stockOnHandMilli: number;
  reservedMilli: number;
  availableMilli: number;
  minimumStockMilli: number;
  suggestedQuantityMilli: number;
  source: 'MINIMUM_STOCK' | 'PRODUCTION_SHORTAGE';
  productionJobId?: string;
  jobCode?: string;
  productName?: string;
  reason: string;
  hasOpenRequest: boolean;
}

export type ProcurementSeedState = 'NEVER_APPLIED' | 'APPLIED' | 'INTENTIONALLY_CLEARED';

export const PURCHASE_REQUEST_STATUS_CONFIG: Record<
  PurchaseRequestStatus,
  { label: string; color: string; bg: string; border: string }
> = {
  DRAFT: {
    label: 'Rascunho',
    color: 'text-slate-700',
    bg: 'bg-slate-100',
    border: 'border-slate-300',
  },
  REQUESTED: {
    label: 'Solicitado',
    color: 'text-amber-700',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
  },
  CONVERTED: {
    label: 'Convertido em Pedido',
    color: 'text-teal-700',
    bg: 'bg-teal-50',
    border: 'border-teal-200',
  },
  CANCELLED: {
    label: 'Cancelado',
    color: 'text-red-700',
    bg: 'bg-red-50',
    border: 'border-red-200',
  },
};

export const PURCHASE_ORDER_STATUS_CONFIG: Record<
  PurchaseOrderStatus,
  { label: string; color: string; bg: string; border: string }
> = {
  DRAFT: {
    label: 'Rascunho',
    color: 'text-slate-700',
    bg: 'bg-slate-100',
    border: 'border-slate-300',
  },
  ISSUED: {
    label: 'Emitido / Aguardando',
    color: 'text-blue-700',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
  },
  PARTIALLY_RECEIVED: {
    label: 'Recebido Parcial',
    color: 'text-amber-700',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
  },
  RECEIVED: {
    label: 'Recebido Total',
    color: 'text-emerald-700',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
  },
  CANCELLED: {
    label: 'Cancelado',
    color: 'text-red-700',
    bg: 'bg-red-50',
    border: 'border-red-200',
  },
};
