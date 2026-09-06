import { MaterialUnit } from '../types/inventory';
import { MATERIAL_UNIT_LABELS } from './constants';

/**
 * Utilitários puros para manipulação de quantidades escaladas em milésimos inteiros (quantityMilli).
 * Princípio comercial: elimina imprecisões de ponto flutuante.
 * 1 unidade real = 1000 milésimos inteiros.
 */

/**
 * Parser estrito para quantidade decimal ou inteira.
 * Aceita:
 * - Inteiros: "1", "100" -> 1000, 100000
 * - Decimais com vírgula ou ponto (com até 3 casas decimais): "1,5", "1.5" -> 1500; "0,001" -> 1; "0.125" -> 125
 * - Formato com separador de milhar: "1.234,5" -> 1234500
 *
 * Rejeita estritamente:
 * - Entradas parciais com letras: "1abc", "abc1"
 * - Sintaxe ambígua: "1,2,3", "1.23.4", "--1"
 * - Mais de 3 casas decimais: "1,2345"
 * - Negativos (onde não permitido) ou não finitos: "-1", "NaN", "Infinity"
 * - Valores que ultrapassem Number.MAX_SAFE_INTEGER
 */
export function parseStrictQuantityToMilli(input: string | number): number {
  if (typeof input === 'number') {
    if (!Number.isFinite(input) || !Number.isSafeInteger(input) || input < 0 || input > Number.MAX_SAFE_INTEGER) {
      throw new Error('Quantidade numérica fora dos limites seguros em milésimos.');
    }
    return input;
  }

  if (typeof input !== 'string') {
    throw new Error('Entrada de quantidade inválida.');
  }

  const raw = input.trim();
  if (!raw) {
    throw new Error('Entrada de quantidade vazia.');
  }

  // Padrão 1: apenas dígitos inteiros (ex: "1", "10", "250")
  if (/^\d+$/.test(raw)) {
    const units = BigInt(raw);
    const milli = units * 1000n;
    if (milli > BigInt(Number.MAX_SAFE_INTEGER)) {
      throw new Error('Quantidade em milésimos excede o limite numérico seguro.');
    }
    return Number(milli);
  }

  // Padrão 2: Formato com ponto ou vírgula decimal e até 3 casas decimais
  // Suporta opcionalmente separadores de milhar válidos
  // Ex: "1,5", "1.5", "0,001", "1.234,567", "1,234.567"
  let integerPartStr = '';
  let fractionalPartStr = '';

  if (raw.includes(',') && raw.includes('.')) {
    // Se tiver ambos, identifica qual é o decimal (o último)
    const lastComma = raw.lastIndexOf(',');
    const lastDot = raw.lastIndexOf('.');
    if (lastComma > lastDot) {
      // Padrão BR: 1.234,567
      const parts = raw.split(',');
      if (parts.length !== 2) throw new Error(`Formato de quantidade inválido: "${input}".`);
      if (!/^(\d{1,3}(\.\d{3})+|\d+)$/.test(parts[0])) throw new Error(`Separador de milhar inválido: "${input}".`);
      integerPartStr = parts[0].replace(/\./g, '');
      fractionalPartStr = parts[1];
    } else {
      // Padrão US: 1,234.567
      const parts = raw.split('.');
      if (parts.length !== 2) throw new Error(`Formato de quantidade inválido: "${input}".`);
      if (!/^(\d{1,3}(,\d{3})+|\d+)$/.test(parts[0])) throw new Error(`Separador de milhar inválido: "${input}".`);
      integerPartStr = parts[0].replace(/,/g, '');
      fractionalPartStr = parts[1];
    }
  } else if (raw.includes(',')) {
    const parts = raw.split(',');
    if (parts.length !== 2) throw new Error(`Formato de quantidade inválido: "${input}".`);
    if (!/^\d+$/.test(parts[0])) throw new Error(`Parte inteira inválida: "${input}".`);
    integerPartStr = parts[0];
    fractionalPartStr = parts[1];
  } else if (raw.includes('.')) {
    const parts = raw.split('.');
    if (parts.length !== 2) throw new Error(`Formato de quantidade inválido: "${input}".`);
    if (!/^\d+$/.test(parts[0])) throw new Error(`Parte inteira inválida: "${input}".`);
    integerPartStr = parts[0];
    fractionalPartStr = parts[1];
  } else {
    throw new Error(`Formato de quantidade inválido: "${input}".`);
  }

  if (!/^\d{1,3}$/.test(fractionalPartStr)) {
    if (/^\d+$/.test(fractionalPartStr) && fractionalPartStr.length > 3) {
      throw new Error(`Quantidade aceita no máximo 3 casas decimais (milésimos): "${input}".`);
    }
    throw new Error(`Casas decimais inválidas: "${input}".`);
  }

  const integerBig = BigInt(integerPartStr);
  const fractionalBig = BigInt(fractionalPartStr.padEnd(3, '0'));

  const totalMilli = integerBig * 1000n + fractionalBig;
  if (totalMilli > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error('Quantidade em milésimos excede o limite numérico seguro.');
  }

  return Number(totalMilli);
}

/**
 * Converte string ou número decimal para milésimos inteiros com tolerância a vazios para formulários.
 */
export function parseQuantityInputToMilli(input: string | number): number {
  if (typeof input === 'number') {
    if (!Number.isFinite(input) || !Number.isSafeInteger(input) || input < 0 || input > Number.MAX_SAFE_INTEGER) return 0;
    return input;
  }

  if (!input || typeof input !== 'string') return 0;
  const trimmed = input.trim();
  if (!trimmed) return 0;

  try {
    return parseStrictQuantityToMilli(trimmed);
  } catch {
    return 0;
  }
}

/**
 * Operação segura de soma de milésimos.
 */
export function safeAddMilli(a: number, b: number): number {
  if (!Number.isSafeInteger(a) || !Number.isSafeInteger(b)) {
    throw new Error('Parcelas de quantidade devem ser inteiros seguros.');
  }
  if (a < 0 || b < 0) {
    throw new Error('Quantidades em milésimos não podem ser negativas.');
  }
  const sum = BigInt(a) + BigInt(b);
  if (sum > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error('Soma de quantidades excede o limite seguro (MAX_SAFE_INTEGER).');
  }
  return Number(sum);
}

/**
 * Operação segura de subtração de milésimos.
 */
export function safeSubtractMilli(minuend: number, subtrahend: number): number {
  if (!Number.isSafeInteger(minuend) || !Number.isSafeInteger(subtrahend)) {
    throw new Error('Valores de quantidade devem ser inteiros seguros.');
  }
  if (minuend < 0 || subtrahend < 0) {
    throw new Error('Quantidades em milésimos não podem ser negativas.');
  }
  if (subtrahend > minuend) {
    throw new Error(`Resultado de subtração de quantidade não pode ser negativo (${minuend} < ${subtrahend}).`);
  }
  return minuend - subtrahend;
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
