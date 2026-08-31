import { Order } from '../types/domain';
import {
  FinancialIndicators,
  IReceivablePaymentRepository,
  IReceivableRepository,
  PaymentMethod,
  ReceivableAccount,
  ReceivablePayment,
  ReceivableStatus,
} from '../types/financial';
import { IProductionJobRepository } from '../types/repository';
import { JobService } from './jobService';

export interface RegisterPaymentInput {
  receivableId: string;
  amountCents: number;
  paidAt: string;
  method: PaymentMethod;
  notes?: string;
  idempotencyKey: string;
  userId: string;
  userName: string;
}

function safeAdd(a: number, b: number): number {
  const value = a + b;
  if (!Number.isSafeInteger(value)) throw new Error('Valor monetário excede o limite seguro.');
  return value;
}

export function deriveReceivableStatus(account: ReceivableAccount, today = new Date()): ReceivableStatus {
  if (account.status === 'CANCELLED') return 'CANCELLED';
  if (account.receivedCents >= account.totalCents) return 'PAID';
  if (account.receivedCents > 0) return 'PARTIAL';
  const due = new Date(`${account.dueDateISO.slice(0, 10)}T23:59:59`);
  return due.getTime() < today.getTime() ? 'OVERDUE' : 'PENDING';
}

export class FinancialService {
  constructor(
    private receivableRepo: IReceivableRepository,
    private paymentRepo: IReceivablePaymentRepository,
    private jobRepo: IProductionJobRepository,
    private jobService: JobService
  ) {}

  async ensureAccountsForOrders(organizationId: string, orders: Order[]): Promise<ReceivableAccount[]> {
    const existing = await this.receivableRepo.list(organizationId);
    const created: ReceivableAccount[] = [];
    for (const order of orders) {
      if (order.organizationId !== organizationId || order.status === 'CANCELLED') continue;
      if (existing.some((account) => account.orderId === order.id)) continue;
      if (!Number.isSafeInteger(order.totalAmountCents) || order.totalAmountCents <= 0) continue;
      const now = new Date().toISOString();
      created.push({
        id: `recv-${order.id}`,
        organizationId,
        orderId: order.id,
        orderNumber: order.orderNumber,
        customerId: order.customer.id,
        customerName: order.customer.name,
        totalCents: order.totalAmountCents,
        receivedCents: 0,
        dueDateISO: order.deliveryDateISO.slice(0, 10),
        status: 'PENDING',
        createdAt: now,
        updatedAt: now,
      });
    }
    if (created.length) await this.receivableRepo.saveMany(organizationId, created);
    return (await this.receivableRepo.list(organizationId)).map((account) => ({
      ...account,
      status: deriveReceivableStatus(account),
    }));
  }

  async registerPayment(organizationId: string, input: RegisterPaymentInput): Promise<{ account: ReceivableAccount; payment: ReceivablePayment }> {
    const key = input.idempotencyKey.trim();
    if (!key) throw new Error('Identificador da operação é obrigatório.');
    const duplicate = await this.paymentRepo.getByIdempotencyKey(organizationId, key);
    if (duplicate) {
      const account = await this.receivableRepo.getById(organizationId, duplicate.receivableId);
      if (!account || duplicate.receivableId !== input.receivableId) throw new Error('Conflito de idempotência.');
      return { account, payment: duplicate };
    }
    if (!Number.isSafeInteger(input.amountCents) || input.amountCents <= 0) {
      throw new Error('O pagamento deve ser informado em centavos inteiros positivos.');
    }
    if (!input.paidAt || Number.isNaN(new Date(input.paidAt).getTime())) throw new Error('Data de pagamento inválida.');
    const account = await this.receivableRepo.getById(organizationId, input.receivableId);
    if (!account) throw new Error('Conta a receber não encontrada.');
    if (account.status === 'CANCELLED') throw new Error('Conta cancelada não aceita pagamentos.');
    const balance = account.totalCents - account.receivedCents;
    if (balance <= 0) throw new Error('Esta conta já está integralmente paga.');
    if (input.amountCents > balance) throw new Error('O pagamento não pode superar o saldo em aberto.');

    const now = new Date().toISOString();
    const nextReceived = safeAdd(account.receivedCents, input.amountCents);
    const updated: ReceivableAccount = {
      ...account,
      receivedCents: nextReceived,
      status: nextReceived === account.totalCents ? 'PAID' : 'PARTIAL',
      updatedAt: now,
    };
    const payment: ReceivablePayment = {
      id: `pay-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      organizationId,
      receivableId: account.id,
      amountCents: input.amountCents,
      paidAt: new Date(input.paidAt).toISOString(),
      method: input.method,
      notes: input.notes?.trim() || undefined,
      idempotencyKey: key,
      createdBy: input.userId,
      createdByName: input.userName,
      createdAt: now,
    };

    await this.receivableRepo.save(organizationId, updated);
    try {
      await this.paymentRepo.save(organizationId, payment);
    } catch (error) {
      await this.receivableRepo.save(organizationId, account);
      throw error;
    }

    const targetGate = updated.status === 'PAID' ? 'RELEASED' : 'PAYMENT_PENDING';
    const jobs = await this.jobRepo.listByOrderId(organizationId, account.orderId);
    for (const job of jobs) {
      await this.jobService.updateFinancialGate(
        organizationId,
        job.id,
        targetGate,
        { id: input.userId, name: input.userName },
        updated.status === 'PAID' ? `Pagamento integral da conta ${account.orderNumber}` : `Pagamento parcial da conta ${account.orderNumber}`
      );
    }
    return { account: updated, payment };
  }

  calculateIndicators(accounts: ReceivableAccount[]): FinancialIndicators {
    return accounts.reduce<FinancialIndicators>((result, raw) => {
      const account = { ...raw, status: deriveReceivableStatus(raw) };
      if (account.status === 'CANCELLED') return result;
      const balance = account.totalCents - account.receivedCents;
      result.totalReceivableCents = safeAdd(result.totalReceivableCents, account.totalCents);
      result.totalReceivedCents = safeAdd(result.totalReceivedCents, account.receivedCents);
      result.openBalanceCents = safeAdd(result.openBalanceCents, balance);
      if (account.status === 'OVERDUE') result.totalOverdueCents = safeAdd(result.totalOverdueCents, balance);
      if (account.status !== 'PAID') result.pendingCount += 1;
      return result;
    }, { totalReceivableCents: 0, totalReceivedCents: 0, totalOverdueCents: 0, openBalanceCents: 0, pendingCount: 0 });
  }
}
