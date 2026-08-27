/**
 * Gerador de chaves seguras e isoladas por organização para o localStorage
 */

const PREFIX = 'arteflow:v1';

export const CURRENT_SEED_VERSION = 3;

export type SeedState = 'NEVER_APPLIED' | 'APPLIED' | 'INTENTIONALLY_CLEARED';
export type InventorySeedState = 'NEVER_APPLIED' | 'APPLIED' | 'INTENTIONALLY_CLEARED';

export const storageKeys = {
  seedVersion: (orgId: string) => `${PREFIX}:${orgId}:seed_version`,
  seedState: (orgId: string) => `${PREFIX}:${orgId}:seed_state`,
  inventorySeedState: (orgId: string) => `${PREFIX}:${orgId}:inventory_seed_state`,
  orders: (orgId: string) => `${PREFIX}:${orgId}:orders`,
  jobs: (orgId: string) => `${PREFIX}:${orgId}:jobs`,
  stages: (orgId: string) => `${PREFIX}:${orgId}:stages`,
  events: (orgId: string) => `${PREFIX}:${orgId}:events`,
  materials: (orgId: string) => `${PREFIX}:${orgId}:materials`,
  requirements: (orgId: string) => `${PREFIX}:${orgId}:requirements`,
  reservations: (orgId: string) => `${PREFIX}:${orgId}:reservations`,
  movements: (orgId: string) => `${PREFIX}:${orgId}:movements`,
  organization: (orgId: string) => `${PREFIX}:${orgId}:org_info`,
};
