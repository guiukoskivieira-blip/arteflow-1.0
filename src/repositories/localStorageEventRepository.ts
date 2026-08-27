import { IProductionEventRepository } from '../types/repository';
import { ProductionEvent } from '../types/domain';
import { storageKeys } from './storageKeys';

export class LocalStorageEventRepository implements IProductionEventRepository {
  private getStorage(): Storage | null {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
    return null;
  }

  private readAll(organizationId: string): ProductionEvent[] {
    const storage = this.getStorage();
    if (!storage) return [];
    try {
      const raw = storage.getItem(storageKeys.events(organizationId));
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.error(`Erro ao ler eventos para org ${organizationId}:`, e);
      return [];
    }
  }

  private writeAll(organizationId: string, events: ProductionEvent[]): void {
    const storage = this.getStorage();
    if (!storage) return;
    try {
      storage.setItem(storageKeys.events(organizationId), JSON.stringify(events));
    } catch (e) {
      console.error(`Erro ao salvar eventos para org ${organizationId}:`, e);
    }
  }

  async listByJobId(organizationId: string, jobId: string): Promise<ProductionEvent[]> {
    const events = this.readAll(organizationId);
    return events
      .filter((e) => e.jobId === jobId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  async listAll(organizationId: string): Promise<ProductionEvent[]> {
    const events = this.readAll(organizationId);
    return events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  async append(organizationId: string, event: ProductionEvent): Promise<ProductionEvent> {
    const events = this.readAll(organizationId);
    // Append-only guarantee
    const newEvent: ProductionEvent = {
      ...event,
      timestamp: event.timestamp || new Date().toISOString(),
    };
    events.push(newEvent);
    this.writeAll(organizationId, events);
    return newEvent;
  }

  async appendMany(organizationId: string, newEvents: ProductionEvent[]): Promise<ProductionEvent[]> {
    const events = this.readAll(organizationId);
    const nowISO = new Date().toISOString();
    const prepared = newEvents.map((e) => ({
      ...e,
      timestamp: e.timestamp || nowISO,
    }));
    events.push(...prepared);
    this.writeAll(organizationId, events);
    return prepared;
  }

  async clear(organizationId: string): Promise<void> {
    const storage = this.getStorage();
    if (storage) {
      storage.removeItem(storageKeys.events(organizationId));
    }
  }
}
