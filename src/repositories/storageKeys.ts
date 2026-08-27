/**
 * Gerador de chaves seguras e isoladas por organização para o localStorage
 */

const PREFIX = 'arteflow:v1';

export const storageKeys = {
  orders: (orgId: string) => `${PREFIX}:${orgId}:orders`,
  jobs: (orgId: string) => `${PREFIX}:${orgId}:jobs`,
  stages: (orgId: string) => `${PREFIX}:${orgId}:stages`,
  events: (orgId: string) => `${PREFIX}:${orgId}:events`,
  organization: (orgId: string) => `${PREFIX}:${orgId}:org_info`,
};
