import { IOrderRepository } from '../types/repository';
import { Order } from '../types/domain';
import { storageKeys } from './storageKeys';

export class LocalStorageOrderRepository implements IOrderRepository {
  private getStorage(): Storage | null {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
    return null;
  }

  private readAll(organizationId: string): Order[] {
    const storage = this.getStorage();
    if (!storage) return [];
    try {
      const raw = storage.getItem(storageKeys.orders(organizationId));
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.error(`Erro ao ler pedidos para org ${organizationId}:`, e);
      return [];
    }
  }

  private writeAll(organizationId: string, orders: Order[]): void {
    const storage = this.getStorage();
    if (!storage) return;
    try {
      storage.setItem(storageKeys.orders(organizationId), JSON.stringify(orders));
    } catch (e) {
      console.error(`Erro ao salvar pedidos para org ${organizationId}:`, e);
    }
  }

  async getById(organizationId: string, id: string): Promise<Order | null> {
    const orders = this.readAll(organizationId);
    return orders.find((o) => o.id === id) || null;
  }

  async getByOrderNumber(organizationId: string, orderNumber: string): Promise<Order | null> {
    const orders = this.readAll(organizationId);
    return orders.find((o) => o.orderNumber.toUpperCase() === orderNumber.toUpperCase()) || null;
  }

  async list(organizationId: string): Promise<Order[]> {
    return this.readAll(organizationId);
  }

  async save(organizationId: string, order: Order): Promise<Order> {
    const orders = this.readAll(organizationId);
    const existingIndex = orders.findIndex((o) => o.id === order.id);

    const updatedOrder: Order = {
      ...order,
      updatedAt: new Date().toISOString(),
    };

    if (existingIndex >= 0) {
      orders[existingIndex] = updatedOrder;
    } else {
      orders.unshift(updatedOrder);
    }

    this.writeAll(organizationId, orders);
    return updatedOrder;
  }

  async delete(organizationId: string, id: string): Promise<boolean> {
    const orders = this.readAll(organizationId);
    const initialLen = orders.length;
    const filtered = orders.filter((o) => o.id !== id);
    if (filtered.length !== initialLen) {
      this.writeAll(organizationId, filtered);
      return true;
    }
    return false;
  }

  async clear(organizationId: string): Promise<void> {
    const storage = this.getStorage();
    if (storage) {
      storage.removeItem(storageKeys.orders(organizationId));
    }
  }
}
