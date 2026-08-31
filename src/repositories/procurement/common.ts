// src/repositories/procurement/common.ts

/**
 * Normalize a document string by removing all non‑digit characters.
 * Returns an empty string if the input is falsy.
 */
export function normalizeDocument(doc: string | undefined | null): string {
  if (!doc) return '';
  return doc.replace(/\D/g, '');
}

/**
 * Validate that a numeric value is a safe integer and non‑negative (unless allowNegative).
 * Throws InvalidProcurementNumericValueError on failure.
 */
import { InvalidProcurementNumericValueError } from '../../errors/procurementErrors';
// Deep clone using structuredClone if available, fallback to JSON round‑trip
export function cloneSerializable<T>(obj: T): T {
  if (typeof structuredClone === 'function') {
    return structuredClone(obj);
  }
  // fallback – works for plain JSON‑serializable objects
  return JSON.parse(JSON.stringify(obj)) as T;
}

export function validateSafeInteger(
  value: number,
  fieldName: string,
  allowNegative: boolean = false,
): void {
  if (!Number.isSafeInteger(value)) {
    throw new InvalidProcurementNumericValueError(`${fieldName} must be a safe integer`);
  }
  if (!allowNegative && value < 0) {
    throw new InvalidProcurementNumericValueError(`${fieldName} cannot be negative`);
  }
}

export function getStorage(): Storage | null {
  return typeof window !== 'undefined' && (window as any).localStorage ? (window as any).localStorage : null;
}

/** Read a list from localStorage. Throws on JSON parse errors. */
export function readList<T>(key: string): T[] {
  const storage = getStorage();
  if (!storage) return [];
  const raw = storage.getItem(key);
  if (!raw) return [];
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed) ? parsed : [];
}

/** Write a list to localStorage. Propagates errors. */
export function writeList<T>(key: string, items: T[]): void {
  const storage = getStorage();
  if (!storage) return;
  storage.setItem(key, JSON.stringify(items));
}
