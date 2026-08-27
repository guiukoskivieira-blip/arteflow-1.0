import { MaterialUnit } from '../types/inventory';
import { MATERIAL_UNIT_LABELS } from './constants';

/**
 * Utilitários puros para manipulação de quantidades escaladas em milésimos inteiros (quantityMilli).
 * Princípio comercial: elimina imprecisões de ponto flutuante.
 * 1 unidade real = 1000 milésimos inteiros.
 */

/**
 * Converte string ou número decimal (ex: "1,5", "1.5", 2.75) para milésimos inteiros.
 */
export function parseQuantityInputToMilli(input: string | number): number {
  if (typeof input === 'number') {
    if (isNaN(input) || !isFinite(input) || input < 0 || input > Number.MAX_SAFE_INTEGER) return 0;
    return Math.round(input * 1000);
  }

  if (!input || typeof input !== 'string') return 0;

  // Substitui vírgula por ponto e remove espaços
  const cleaned = input.trim().replace(/\s+/g, '').replace(',', '.');
  const parsed = parseFloat(cleaned);

  if (isNaN(parsed) || !isFinite(parsed) || parsed < 0 || parsed > Number.MAX_SAFE_INTEGER / 1000) return 0;

  const result = Math.round(parsed * 1000);
  return Number.isSafeInteger(result) ? result : 0;
}

/**
 * Formata milésimos inteiros para string decimal legível em padrão pt-BR.
 * Ex: 1500 -> "1,5" | 1000 -> "1" | 2750 -> "2,75" | 500000 -> "500"
 */
export function formatMilliToQuantity(
  milli: number,
  minDecimals: number = 0,
  maxDecimals: number = 3
): string {
  if (!milli || isNaN(milli) || !isFinite(milli)) return '0';

  const decimalVal = milli / 1000;

  return decimalVal.toLocaleString('pt-BR', {
    minimumFractionDigits: minDecimals,
    maximumFractionDigits: maxDecimals,
  });
}

/**
 * Formata milésimos com o sufixo/abreviação da unidade canônica.
 * Ex: (1500, 'METER') -> "1,5 m" | (500000, 'SHEET') -> "500 fl"
 */
export function formatMilliWithUnit(milli: number, unit: MaterialUnit): string {
  const formattedNumber = formatMilliToQuantity(milli);
  const unitInfo = MATERIAL_UNIT_LABELS[unit];
  const abbr = unitInfo ? unitInfo.abbr : unit;
  return `${formattedNumber} ${abbr}`;
}

/**
 * Valida se a quantidade em milésimos é um inteiro estritamente positivo e seguro (> 0).
 */
export function isValidQuantityMilli(milli: number): boolean {
  return Number.isSafeInteger(milli) && milli > 0 && milli <= Number.MAX_SAFE_INTEGER;
}

/**
 * Valida se a quantidade em milésimos é um inteiro não-negativo e seguro (>= 0).
 */
export function isValidNonNegativeQuantityMilli(milli: number): boolean {
  return Number.isSafeInteger(milli) && milli >= 0 && milli <= Number.MAX_SAFE_INTEGER;
}
