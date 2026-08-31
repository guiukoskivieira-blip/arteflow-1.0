import {
  IReceivablePaymentRepository,
  IReceivableRepository,
  ReceivableAccount,
  ReceivablePayment,
} from '../types/financial';
import { storageKeys } from './storageKeys';
import { cloneSerializable, readList, writeList } from './procurement/common';

export class LocalStorageReceivableRepository implements IReceivableRepository {
  async list(organizationId: string): Promise<ReceivableAccount[]> {
    return cloneSerializable(readList<ReceivableAccount>(storageKeys.receivables(organizationId)));
  }
  async getById(organizationId: string, id: string): Promise<ReceivableAccount | null> {
    return (await this.list(organizationId)).find((item) => item.id === id) ?? null;
  }
  async getByOrderId(organizationId: string, orderId: string): Promise<ReceivableAccount | null> {
    return (await this.list(organizationId)).find((item) => item.orderId === orderId) ?? null;
  }
  async save(organizationId: string, account: ReceivableAccount): Promise<ReceivableAccount> {
    if (account.organizationId !== organizationId) throw new Error('Conta a receber pertence a outra organização.');
    const items = await this.list(organizationId);
    const index = items.findIndex((item) => item.id === account.id);
    const copy = cloneSerializable(account);
    if (index >= 0) items[index] = copy; else items.unshift(copy);
    writeList(storageKeys.receivables(organizationId), items);
    return cloneSerializable(copy);
  }
  async saveMany(organizationId: string, accounts: ReceivableAccount[]): Promise<ReceivableAccount[]> {
    const previous = await this.list(organizationId);
    try {
      const merged = [...previous];
      for (const account of accounts) {
        if (account.organizationId !== organizationId) throw new Error('Conta a receber pertence a outra organização.');
        const index = merged.findIndex((item) => item.id === account.id);
        if (index >= 0) merged[index] = cloneSerializable(account); else merged.unshift(cloneSerializable(account));
      }
      writeList(storageKeys.receivables(organizationId), merged);
      return cloneSerializable(accounts);
    } catch (error) {
      writeList(storageKeys.receivables(organizationId), previous);
      throw error;
    }
  }
}

export class LocalStorageReceivablePaymentRepository implements IReceivablePaymentRepository {
  async list(organizationId: string): Promise<ReceivablePayment[]> {
    return cloneSerializable(readList<ReceivablePayment>(storageKeys.receivablePayments(organizationId)));
  }
  async listByReceivableId(organizationId: string, receivableId: string): Promise<ReceivablePayment[]> {
    return (await this.list(organizationId)).filter((item) => item.receivableId === receivableId);
  }
  async getByIdempotencyKey(organizationId: string, key: string): Promise<ReceivablePayment | null> {
    return (await this.list(organizationId)).find((item) => item.idempotencyKey === key) ?? null;
  }
  async save(organizationId: string, payment: ReceivablePayment): Promise<ReceivablePayment> {
    if (payment.organizationId !== organizationId) throw new Error('Pagamento pertence a outra organização.');
    const items = await this.list(organizationId);
    const duplicate = items.find((item) => item.idempotencyKey === payment.idempotencyKey);
    if (duplicate) return cloneSerializable(duplicate);
    const copy = cloneSerializable(payment);
    writeList(storageKeys.receivablePayments(organizationId), [copy, ...items]);
    return cloneSerializable(copy);
  }
}
