/**
 * Gerador de chaves seguras e isoladas por organização para o localStorage
 */

const PREFIX = 'arteflow:v1';

export const CURRENT_SEED_VERSION = 2;

export type SeedState = 'NEVER_APPLIED' | 'APPLIED' | 'INTENTIONALLY_CLEARED';

export const storageKeys = {
  seedVersion: (orgId: string) => `${PREFIX}:${orgId}:seed_version`,
  seedState: (orgId: string) => `${PREFIX}:${orgId}:seed_state`,
  orders: (orgId: string) => `${PREFIX}:${orgId}:orders`,
  jobs: (orgId: string) => `${PREFIX}:${orgId}:jobs`,
  stages: (orgId: string) => `${PREFIX}:${orgId}:stages`,
  events: (orgId: string) => `${PREFIX}:${orgId}:events`,
  organization: (orgId: string) => `${PREFIX}:${orgId}:org_info`,
};
