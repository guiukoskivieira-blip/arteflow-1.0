import { IReservationRepository } from '../types/repository';
import { StockReservation } from '../types/inventory';
import { storageKeys } from './storageKeys';

export class LocalStorageReservationRepository implements IReservationRepository {
  private getStorage(): Storage | null {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
    return null;
  }

  private readAll(organizationId: string): StockReservation[] {
    const storage = this.getStorage();
    if (!storage) return [];
    try {
      const raw = storage.getItem(storageKeys.reservations(organizationId));
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.error(`Erro ao ler reservas para org ${organizationId}:`, e);
      return [];
    }
  }

  private writeAll(organizationId: string, reservations: StockReservation[]): void {
    const storage = this.getStorage();
    if (!storage) return;
    try {
      storage.setItem(storageKeys.reservations(organizationId), JSON.stringify(reservations));
    } catch (e) {
      console.error(`Erro ao salvar reservas para org ${organizationId}:`, e);
    }
  }

  async getById(organizationId: string, id: string): Promise<StockReservation | null> {
    const all = this.readAll(organizationId);
    return all.find((r) => r.id === id) || null;
  }

  async listByJobId(organizationId: string, jobId: string): Promise<StockReservation[]> {
    const all = this.readAll(organizationId);
    return all.filter((r) => r.productionJobId === jobId);
  }

  async listByMaterialId(organizationId: string, materialId: string): Promise<StockReservation[]> {
    const all = this.readAll(organizationId);
    return all.filter((r) => r.materialId === materialId);
  }

  async listAll(organizationId: string): Promise<StockReservation[]> {
    return this.readAll(organizationId);
  }

  async save(organizationId: string, reservation: StockReservation): Promise<StockReservation> {
    const all = this.readAll(organizationId);
    const existingIndex = all.findIndex((r) => r.id === reservation.id);
    if (existingIndex >= 0) {
      all[existingIndex] = reservation;
    } else {
      all.push(reservation);
    }
    this.writeAll(organizationId, all);
    return reservation;
  }

  async saveMany(organizationId: string, reservations: StockReservation[]): Promise<StockReservation[]> {
    const all = this.readAll(organizationId);
    for (const res of reservations) {
      const idx = all.findIndex((r) => r.id === res.id);
      if (idx >= 0) {
        all[idx] = res;
      } else {
        all.push(res);
      }
    }
    this.writeAll(organizationId, all);
    return reservations;
  }

  async clear(organizationId: string): Promise<void> {
    const storage = this.getStorage();
    if (storage) {
      storage.removeItem(storageKeys.reservations(organizationId));
    }
  }
}
