import { describe, it, expect, beforeEach } from 'vitest';
import { LocalStorageOrderRepository } from '../repositories/localStorageOrderRepository';
import { LocalStorageJobRepository } from '../repositories/localStorageJobRepository';
import { Order, ProductionJob } from '../types/domain';

describe('ArteFlow — Repositórios & Persistência Local (Fase 1)', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  // Requisito 5: Persistência após recarregar
  it('5. Dados persistem e são recuperados com sucesso após recarregar (nova instância do repositório)', async () => {
    const orgId = 'org-persist-test';
    const repo1 = new LocalStorageJobRepository();

    const sampleJob: ProductionJob = {
      id: 'job-persist-1',
      jobCode: 'OP-2026-0099',
      orderId: 'ord-persist-1',
      orderNumber: 'PED-2026-0099',
      orderItemId: 'item-persist-1',
      organizationId: orgId,
      customer: { id: 'c1', name: 'Cliente Persistente' },
      productName: 'Fachada em ACM Vazado',
      quantity: 1,
      unit: 'un',
      finishings: ['LED Neon'],
      stageId: 'stage-scheduled',
      artworkGate: 'APPROVED',
      materialGate: 'RESERVED',
      financialGate: 'RELEASED',
      priority: 'URGENT',
      sector: 'Serralheria & Estrutura',
      assignee: { id: 'u1', name: 'Carlos' },
      deadlineISO: '2026-09-15T18:00:00.000Z',
      createdAt: '2026-08-27T10:00:00.000Z',
      updatedAt: '2026-08-27T10:00:00.000Z',
      dataOrigin: 'user',
    };

    await repo1.save(orgId, sampleJob);

    // Simula reload da página instanciando um novo repositório limpo
    const repoReloaded = new LocalStorageJobRepository();
    const loaded = await repoReloaded.getById(orgId, 'job-persist-1');

    expect(loaded).not.toBeNull();
    expect(loaded?.jobCode).toBe('OP-2026-0099');
    expect(loaded?.productName).toBe('Fachada em ACM Vazado');
    expect(loaded?.materialGate).toBe('RESERVED');
    expect(loaded?.priority).toBe('URGENT');
  });

  // Requisito 6: Isolamento por organização
  it('6. Isolamento estrito por organizationId (multi-tenant no armazenamento local)', async () => {
    const orgAlpha = 'org-alpha';
    const orgBeta = 'org-beta';

    const orderRepo = new LocalStorageOrderRepository();

    const orderAlpha: Order = {
      id: 'order-alpha-1',
      orderNumber: 'PED-ALPHA-01',
      organizationId: orgAlpha,
      origin: 'MANUAL',
      customer: { id: 'c-alpha', name: 'Cliente Alpha' },
      items: [],
      totalAmountCents: 50000,
      status: 'IN_PRODUCTION',
      deliveryDateISO: '2026-09-01T18:00:00.000Z',
      createdAt: '2026-08-27T10:00:00.000Z',
      updatedAt: '2026-08-27T10:00:00.000Z',
      dataOrigin: 'user',
    };

    const orderBeta: Order = {
      id: 'order-beta-1',
      orderNumber: 'PED-BETA-01',
      organizationId: orgBeta,
      origin: 'MANUAL',
      customer: { id: 'c-beta', name: 'Cliente Beta' },
      items: [],
      totalAmountCents: 90000,
      status: 'IN_PRODUCTION',
      deliveryDateISO: '2026-09-02T18:00:00.000Z',
      createdAt: '2026-08-27T10:00:00.000Z',
      updatedAt: '2026-08-27T10:00:00.000Z',
      dataOrigin: 'user',
    };

    await orderRepo.save(orgAlpha, orderAlpha);
    await orderRepo.save(orgBeta, orderBeta);

    const listAlpha = await orderRepo.list(orgAlpha);
    const listBeta = await orderRepo.list(orgBeta);

    expect(listAlpha).toHaveLength(1);
    expect(listAlpha[0].orderNumber).toBe('PED-ALPHA-01');

    expect(listBeta).toHaveLength(1);
    expect(listBeta[0].orderNumber).toBe('PED-BETA-01');

    // Org Alpha não pode ver dados da Org Beta
    const crossCheck = await orderRepo.getById(orgAlpha, 'order-beta-1');
    expect(crossCheck).toBeNull();
  });
});
