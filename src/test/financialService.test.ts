import { beforeEach, describe, expect, it } from 'vitest';
import { FinancialService } from '../services/financialService';
import { LocalStorageReceivablePaymentRepository, LocalStorageReceivableRepository } from '../repositories/localStorageFinancialRepositories';
import { LocalStorageJobRepository } from '../repositories/localStorageJobRepository';
import { LocalStorageEventRepository } from '../repositories/localStorageEventRepository';
import { JobService } from '../services/jobService';
import { Order, ProductionJob } from '../types/domain';

const ORG = 'org-fin';
const OTHER = 'org-other';

function order(organizationId = ORG): Order {
  return { id: 'order-1', orderNumber: 'PED-2026-0001', organizationId, origin: 'MANUAL', customer: { id: 'customer-1', name: 'Cliente Financeiro' }, items: [], totalAmountCents: 10000, status: 'IN_PRODUCTION', deliveryDateISO: '2099-12-31', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', dataOrigin: 'user' };
}

function job(): ProductionJob {
  return { id: 'job-1', jobCode: 'OP-1', orderId: 'order-1', orderNumber: 'PED-2026-0001', orderItemId: 'item-1', organizationId: ORG, customer: { id: 'customer-1', name: 'Cliente Financeiro' }, productName: 'Banner', quantity: 1, unit: 'un', finishings: [], stageId: 'stage-entry', artworkGate: 'APPROVED', materialGate: 'RESERVED', financialGate: 'PAYMENT_PENDING', priority: 'MEDIUM', sector: 'Impressão', assignee: null, deadlineISO: '2099-12-31', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', dataOrigin: 'user' };
}

describe('Financeiro operacional', () => {
  let receivables: LocalStorageReceivableRepository;
  let payments: LocalStorageReceivablePaymentRepository;
  let jobs: LocalStorageJobRepository;
  let service: FinancialService;
  beforeEach(async () => {
    localStorage.clear();
    receivables = new LocalStorageReceivableRepository(); payments = new LocalStorageReceivablePaymentRepository(); jobs = new LocalStorageJobRepository();
    const jobService = new JobService(jobs, new LocalStorageEventRepository());
    service = new FinancialService(receivables, payments, jobs, jobService);
    await jobs.save(ORG, job());
  });

  it('cria conta vinculada ao pedido e persiste após nova instância', async () => {
    const list = await service.ensureAccountsForOrders(ORG, [order()]);
    expect(list[0]).toMatchObject({ orderNumber: 'PED-2026-0001', totalCents: 10000, receivedCents: 0 });
    expect((await new LocalStorageReceivableRepository().list(ORG))[0].customerName).toBe('Cliente Financeiro');
  });

  it('registra pagamento parcial sem liberar o gate', async () => {
    const [account] = await service.ensureAccountsForOrders(ORG, [order()]);
    const result = await service.registerPayment(ORG, { receivableId: account.id, amountCents: 4000, paidAt: '2026-08-30', method: 'PIX', idempotencyKey: 'partial', userId: 'u1', userName: 'Operador' });
    expect(result.account).toMatchObject({ receivedCents: 4000, status: 'PARTIAL' });
    expect((await jobs.getById(ORG, 'job-1'))?.financialGate).toBe('PAYMENT_PENDING');
  });

  it('registra quitação e libera o gate financeiro', async () => {
    const [account] = await service.ensureAccountsForOrders(ORG, [order()]);
    await service.registerPayment(ORG, { receivableId: account.id, amountCents: 10000, paidAt: '2026-08-30', method: 'TRANSFER', idempotencyKey: 'full', userId: 'u1', userName: 'Operador' });
    expect((await receivables.getById(ORG, account.id))?.status).toBe('PAID');
    expect((await jobs.getById(ORG, 'job-1'))?.financialGate).toBe('RELEASED');
  });

  it('bloqueia pagamento superior ao saldo', async () => {
    const [account] = await service.ensureAccountsForOrders(ORG, [order()]);
    await expect(service.registerPayment(ORG, { receivableId: account.id, amountCents: 10001, paidAt: '2026-08-30', method: 'PIX', idempotencyKey: 'too-much', userId: 'u1', userName: 'Operador' })).rejects.toThrow(/superar o saldo/);
  });

  it('é idempotente para a mesma chave', async () => {
    const [account] = await service.ensureAccountsForOrders(ORG, [order()]);
    const input = { receivableId: account.id, amountCents: 3000, paidAt: '2026-08-30', method: 'PIX' as const, idempotencyKey: 'same', userId: 'u1', userName: 'Operador' };
    const first = await service.registerPayment(ORG, input); const second = await service.registerPayment(ORG, input);
    expect(second.payment.id).toBe(first.payment.id); expect((await payments.list(ORG))).toHaveLength(1); expect((await receivables.getById(ORG, account.id))?.receivedCents).toBe(3000);
  });

  it('calcula indicadores em centavos inteiros', async () => {
    const [account] = await service.ensureAccountsForOrders(ORG, [order()]);
    await service.registerPayment(ORG, { receivableId: account.id, amountCents: 2500, paidAt: '2026-08-30', method: 'CASH', idempotencyKey: 'indicator', userId: 'u1', userName: 'Operador' });
    expect(service.calculateIndicators(await receivables.list(ORG))).toEqual({ totalReceivableCents: 10000, totalReceivedCents: 2500, totalOverdueCents: 0, openBalanceCents: 7500, pendingCount: 1 });
  });

  it('isola contas e pagamentos por organização', async () => {
    await service.ensureAccountsForOrders(ORG, [order()]); await service.ensureAccountsForOrders(OTHER, [order(OTHER)]);
    expect(await receivables.list(ORG)).toHaveLength(1); expect(await receivables.list(OTHER)).toHaveLength(1);
    expect((await receivables.list(OTHER))[0].organizationId).toBe(OTHER);
  });
});
