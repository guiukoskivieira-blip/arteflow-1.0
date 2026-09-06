import { describe, expect, it } from 'vitest';
import {
  parseStrictQuantityToMilli,
  parseQuantityInputToMilli,
  safeAddMilli,
  safeSubtractMilli,
  formatMilliToQuantity,
  formatMilliWithUnit,
  isValidQuantityMilli,
  isValidNonNegativeQuantityMilli,
} from '../domain/quantity';

describe('E9-04 — Contrato Estrito de Quantidades em Milésimos (quantityMilli)', () => {
  describe('1. Parser Estrito (parseStrictQuantityToMilli)', () => {
    it('aceita formatos decimais e inteiros válidos com até 3 casas', () => {
      expect(parseStrictQuantityToMilli('1')).toBe(1000);
      expect(parseStrictQuantityToMilli('1,5')).toBe(1500);
      expect(parseStrictQuantityToMilli('1.5')).toBe(1500);
      expect(parseStrictQuantityToMilli('0,001')).toBe(1);
      expect(parseStrictQuantityToMilli('0.001')).toBe(1);
      expect(parseStrictQuantityToMilli('2,75')).toBe(2750);
      expect(parseStrictQuantityToMilli('1.234,5')).toBe(1234500);
      expect(parseStrictQuantityToMilli('1,234.5')).toBe(1234500);
      expect(parseStrictQuantityToMilli(2500)).toBe(2500);
      expect(parseStrictQuantityToMilli(0)).toBe(0);
    });

    it('rejeita estritamente entradas parciais, alfanuméricas e malformadas', () => {
      const invalid = [
        '1abc',
        'abc1',
        '1,2,3',
        '1.23.4',
        '--1',
        '-1',
        '-1,5',
        'NaN',
        'Infinity',
        'null',
        'undefined',
        '',
        '   ',
        ',',
        '.',
        '1,2,3,4',
      ];
      for (const item of invalid) {
        expect(() => parseStrictQuantityToMilli(item)).toThrow();
      }
    });

    it('rejeita estritamente entradas com mais de 3 casas decimais sem arredondamento silencioso', () => {
      expect(() => parseStrictQuantityToMilli('1,2345')).toThrow(/no máximo 3 casas decimais/);
      expect(() => parseStrictQuantityToMilli('0.0001')).toThrow(/no máximo 3 casas decimais/);
      expect(() => parseStrictQuantityToMilli('10,1234')).toThrow(/no máximo 3 casas decimais/);
    });

    it('rejeita valores numéricos fora dos limites seguros', () => {
      expect(() => parseStrictQuantityToMilli(-1)).toThrow();
      expect(() => parseStrictQuantityToMilli(Number.MAX_SAFE_INTEGER + 1)).toThrow();
      expect(() => parseStrictQuantityToMilli(Infinity)).toThrow();
      expect(() => parseStrictQuantityToMilli(NaN)).toThrow();
    });

    it('rejeita strings de quantidade que resultem em overflow de MAX_SAFE_INTEGER em milésimos', () => {
      expect(() => parseStrictQuantityToMilli('9007199254740992')).toThrow(/limite numérico seguro/);
      expect(() => parseStrictQuantityToMilli('99999999999999999999')).toThrow(/limite numérico seguro/);
    });
  });

  describe('2. Helper parseQuantityInputToMilli', () => {
    it('converte entradas válidas e retorna 0 para inválidas ou vazias', () => {
      expect(parseQuantityInputToMilli('1,5')).toBe(1500);
      expect(parseQuantityInputToMilli('1.5')).toBe(1500);
      expect(parseQuantityInputToMilli('0,001')).toBe(1);
      expect(parseQuantityInputToMilli('')).toBe(0);
      expect(parseQuantityInputToMilli('1abc')).toBe(0);
      expect(parseQuantityInputToMilli('-1')).toBe(0);
    });
  });

  describe('3. Aritmética Segura em Milésimos (safeAddMilli e safeSubtractMilli)', () => {
    it('soma quantidades com precisão e segurança', () => {
      expect(safeAddMilli(1500, 2500)).toBe(4000);
      expect(safeAddMilli(0, 1000)).toBe(1000);
      expect(safeAddMilli(Number.MAX_SAFE_INTEGER - 500, 500)).toBe(Number.MAX_SAFE_INTEGER);
    });

    it('falha explicitamente em caso de overflow na soma', () => {
      expect(() => safeAddMilli(Number.MAX_SAFE_INTEGER, 1)).toThrow(/limite seguro/);
      expect(() => safeAddMilli(Number.MAX_SAFE_INTEGER - 10, 20)).toThrow(/limite seguro/);
    });

    it('subtrai quantidades com segurança e impede saldo negativo', () => {
      expect(safeSubtractMilli(5000, 2000)).toBe(3000);
      expect(safeSubtractMilli(1000, 1000)).toBe(0);
      expect(() => safeSubtractMilli(1000, 1500)).toThrow(/não pode ser negativo/);
    });

    it('rejeita entradas negativas em safeAddMilli e safeSubtractMilli', () => {
      expect(() => safeAddMilli(-100, 500)).toThrow();
      expect(() => safeSubtractMilli(-100, 500)).toThrow();
    });
  });

  describe('4. Formatação e Validação de Milésimos', () => {
    it('formatMilliToQuantity formata para padrão legível pt-BR', () => {
      expect(formatMilliToQuantity(1500)).toBe('1,5');
      expect(formatMilliToQuantity(1000)).toBe('1');
      expect(formatMilliToQuantity(2750)).toBe('2,75');
      expect(formatMilliToQuantity(1)).toBe('0,001');
      expect(formatMilliToQuantity(0)).toBe('0');
    });

    it('formatMilliWithUnit inclui abreviações corretas', () => {
      expect(formatMilliWithUnit(1500, 'METER')).toBe('1,5 m');
      expect(formatMilliWithUnit(500000, 'SHEET')).toBe('500 fl');
      expect(formatMilliWithUnit(2000, 'UNIT')).toBe('2 un');
    });

    it('isValidQuantityMilli e isValidNonNegativeQuantityMilli', () => {
      expect(isValidQuantityMilli(1)).toBe(true);
      expect(isValidQuantityMilli(Number.MAX_SAFE_INTEGER)).toBe(true);
      expect(isValidQuantityMilli(0)).toBe(false);
      expect(isValidQuantityMilli(-10)).toBe(false);
      expect(isValidQuantityMilli(Number.MAX_SAFE_INTEGER + 1)).toBe(false);

      expect(isValidNonNegativeQuantityMilli(0)).toBe(true);
      expect(isValidNonNegativeQuantityMilli(1000)).toBe(true);
      expect(isValidNonNegativeQuantityMilli(-1)).toBe(false);
    });
  });
});
