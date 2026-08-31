/**
 * Gerador de chaves seguras e isoladas por organização para o localStorage
 */

const PREFIX = 'arteflow:v1';

export const CURRENT_SEED_VERSION = 3;

export type SeedState = 'NEVER_APPLIED' | 'APPLIED' | 'INTENTIONALLY_CLEARED';
export type InventorySeedState = 'NEVER_APPLIED' | 'APPLIED' | 'INTENTIONALLY_CLEARED';
export type ProcurementSeedState = 'NEVER_APPLIED' | 'APPLIED' | 'INTENTIONALLY_CLEARED';

export const storageKeys = {
  seedVersion: (orgId: string) => `${PREFIX}:${orgId}:seed_version`,
  seedState: (orgId: string) => `${PREFIX}:${orgId}:seed_state`,
  inventorySeedState: (orgId: string) => `${PREFIX}:${orgId}:inventory_seed_state`,
  procurementSeedState: (orgId: string) => `${PREFIX}:${orgId}:procurement_seed_state`,
  orders: (orgId: string) => `${PREFIX}:${orgId}:orders`,
  jobs: (orgId: string) => `${PREFIX}:${orgId}:jobs`,
  stages: (orgId: string) => `${PREFIX}:${orgId}:stages`,
  events: (orgId: string) => `${PREFIX}:${orgId}:events`,
  materials: (orgId: string) => `${PREFIX}:${orgId}:materials`,
  requirements: (orgId: string) => `${PREFIX}:${orgId}:requirements`,
  reservations: (orgId: string) => `${PREFIX}:${orgId}:reservations`,
  movements: (orgId: string) => `${PREFIX}:${orgId}:movements`,
  suppliers: (orgId: string) => `${PREFIX}:${orgId}:suppliers`,
  purchaseRequests: (orgId: string) => `${PREFIX}:${orgId}:purchase_requests`,
  purchaseRequestItems: (orgId: string) => `${PREFIX}:${orgId}:purchase_request_items`,
  purchaseOrders: (orgId: string) => `${PREFIX}:${orgId}:purchase_orders`,
  purchaseOrderItems: (orgId: string) => `${PREFIX}:${orgId}:purchase_order_items`,
  goodsReceipts: (orgId: string) => `${PREFIX}:${orgId}:goods_receipts`,
  goodsReceiptItems: (orgId: string) => `${PREFIX}:${orgId}:goods_receipt_items`,
  procurementEvents: (orgId: string) => `${PREFIX}:${orgId}:procurement_events`,
  procurementSequences: (orgId: string) => `${PREFIX}:${orgId}:procurement_sequences`,
  receivables: (orgId: string) => `${PREFIX}:${orgId}:receivables`,
  receivablePayments: (orgId: string) => `${PREFIX}:${orgId}:receivable_payments`,
  organization: (orgId: string) => `${PREFIX}:${orgId}:org_info`,
};
