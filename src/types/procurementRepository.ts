import {
  Supplier,
  PurchaseRequest,
  PurchaseRequestItem,
  PurchaseOrder,
  PurchaseOrderItem,
  GoodsReceipt,
  GoodsReceiptItem,
  ProcurementEvent,
} from './procurement';



/** Supplier repository */
export interface ISupplierRepository {
  // Lookup methods (unchanged)
  getById(organizationId: string, id: string): Promise<Supplier | null>;
  getByCode(organizationId: string, code: string): Promise<Supplier | null>;
  getByDocument(organizationId: string, document: string): Promise<Supplier | null>;

  // Canonical methods (preferred)
  /** List all suppliers for an organization */
  list(organizationId: string): Promise<Supplier[]>;
  /** Create a new supplier */
  create(organizationId: string, supplier: Supplier): Promise<Supplier>;
  /** Update mutable fields of a supplier */
  update(organizationId: string, supplierId: string, changes: Partial<Supplier>): Promise<Supplier>;
  /** Deactivate (soft‑delete) a supplier */
  deactivate(organizationId: string, supplierId: string): Promise<Supplier>;

  // Backward‑compatible deprecated wrappers
  /** @deprecated use list */
  listAll(organizationId: string): Promise<Supplier[]>;
  /** @deprecated use create */
  save(organizationId: string, supplier: Supplier): Promise<Supplier>;
  /** @deprecated use bulk create (future) */
  saveMany(organizationId: string, suppliers: Supplier[]): Promise<Supplier[]>;
}

/** Purchase request repository */
export interface IPurchaseRequestRepository {
  getById(organizationId: string, id: string): Promise<PurchaseRequest | null>;
  getByRequestNumber(organizationId: string, requestNumber: string): Promise<PurchaseRequest | null>;
  listAll(organizationId: string): Promise<PurchaseRequest[]>;
  listByJobId(organizationId: string, jobId: string): Promise<PurchaseRequest[]>;
  save(organizationId: string, request: PurchaseRequest): Promise<PurchaseRequest>;
  saveMany(organizationId: string, requests: PurchaseRequest[]): Promise<PurchaseRequest[]>;
}

/** Purchase request item repository */
export interface IPurchaseRequestItemRepository {
  getById(organizationId: string, id: string): Promise<PurchaseRequestItem | null>;
  /** List items for a specific purchase request */
  listByRequest(organizationId: string, requestId: string): Promise<PurchaseRequestItem[]>;
  /** @deprecated use listByRequest */
  listByRequestId(organizationId: string, requestId: string): Promise<PurchaseRequestItem[]>;
  listAll(organizationId: string): Promise<PurchaseRequestItem[]>;
  /** Create a single purchase request item */
  create(organizationId: string, item: PurchaseRequestItem): Promise<PurchaseRequestItem>;
  /** Create many items atomically */
  createMany(organizationId: string, items: PurchaseRequestItem[]): Promise<PurchaseRequestItem[]>;
  /** @deprecated use create */
  save(organizationId: string, item: PurchaseRequestItem): Promise<PurchaseRequestItem>;
  /** @deprecated use createMany */
  saveMany(organizationId: string, items: PurchaseRequestItem[]): Promise<PurchaseRequestItem[]>;
}

/** Purchase order repository */
export interface IPurchaseOrderRepository {
  getById(organizationId: string, id: string): Promise<PurchaseOrder | null>;
  getByOrderNumber(organizationId: string, orderNumber: string): Promise<PurchaseOrder | null>;
  listAll(organizationId: string): Promise<PurchaseOrder[]>;
  listBySupplierId(organizationId: string, supplierId: string): Promise<PurchaseOrder[]>;
  save(organizationId: string, order: PurchaseOrder): Promise<PurchaseOrder>;
  saveMany(organizationId: string, orders: PurchaseOrder[]): Promise<PurchaseOrder[]>;
}

/** Purchase order item repository */
export interface IPurchaseOrderItemRepository {
  getById(organizationId: string, id: string): Promise<PurchaseOrderItem | null>;
  listByOrderId(organizationId: string, orderId: string): Promise<PurchaseOrderItem[]>;
  listAll(organizationId: string): Promise<PurchaseOrderItem[]>;
  save(organizationId: string, item: PurchaseOrderItem): Promise<PurchaseOrderItem>;
  saveMany(organizationId: string, items: PurchaseOrderItem[]): Promise<PurchaseOrderItem[]>;
}

/** Goods receipt repository */
export interface IGoodsReceiptRepository {
  getById(organizationId: string, id: string): Promise<GoodsReceipt | null>;
  getByIdempotencyKey(organizationId: string, idempotencyKey: string): Promise<GoodsReceipt | null>;
  listByOrderId(organizationId: string, orderId: string): Promise<GoodsReceipt[]>;
  listAll(organizationId: string): Promise<GoodsReceipt[]>;
  save(organizationId: string, receipt: GoodsReceipt): Promise<GoodsReceipt>;
  saveMany(organizationId: string, receipts: GoodsReceipt[]): Promise<GoodsReceipt[]>;
}

/** Goods receipt item repository */
export interface IGoodsReceiptItemRepository {
  getById(organizationId: string, id: string): Promise<GoodsReceiptItem | null>;
  listByReceiptId(organizationId: string, receiptId: string): Promise<GoodsReceiptItem[]>;
  listAll(organizationId: string): Promise<GoodsReceiptItem[]>;
  save(organizationId: string, item: GoodsReceiptItem): Promise<GoodsReceiptItem>;
  saveMany(organizationId: string, items: GoodsReceiptItem[]): Promise<GoodsReceiptItem[]>;
}

/** Procurement event repository (append‑only) */
export interface IProcurementEventRepository {
  listByEntity(organizationId: string, entityType: string, entityId: string): Promise<ProcurementEvent[]>;
  listAll(organizationId: string): Promise<ProcurementEvent[]>;
  append(organizationId: string, event: ProcurementEvent): Promise<ProcurementEvent>;
  appendMany(organizationId: string, events: ProcurementEvent[]): Promise<ProcurementEvent[]>;
}

/** Procurement sequence repository */
export interface IProcurementSequenceRepository {
  getNextSequence(organizationId: string, prefix: 'SC' | 'PC' | 'REC', year: number): Promise<number>;
  setSequence(organizationId: string, prefix: 'SC' | 'PC' | 'REC', year: number, val: number): Promise<void>;
}
