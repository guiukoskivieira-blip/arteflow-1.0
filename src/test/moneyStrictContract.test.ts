import { describe, expect, it } from 'vitest';
import {
  formatCentsToBRL,
  parseStrictBRLToCents,
  parseBRLInputToCents,
  safeAddCents,
  safeMultiplyCents,
  computeSubtotalCents,
  computeWeightedAverageCostCents,
  calculateOrderTotalCents,
  isValidCents,
  isValidNonNegativeCents,
} from '../domain/money';

describe('E9-03 — Contrato Monetário End-to-End e Parser Estrito', () => {
  describe('1. Parser Estrito (parseStrictBRLToCents)', () => {
    it('aceita formatos monetários válidos', () => {
      expect(parseStrictBRLToCents('1')).toBe(100);
      expect(parseStrictBRLToCents('1,00')).toBe(100);
      expect(parseStrictBRLToCents('1.234,56')).toBe(123456);
      expect(parseStrictBRLToCents('0,01')).toBe(1);
      expect(parseStrictBRLToCents('1234,56')).toBe(123456);
      expect(parseStrictBRLToCents('R$ 1.234,56')).toBe(123456);
      expect(parseStrictBRLToCents('r$ 0,50')).toBe(50);
      expect(parseStrictBRLToCents('10')).toBe(1000);
      expect(parseStrictBRLToCents('12.345.678,90')).toBe(1234567890);
      expect(parseStrictBRLToCents(5000)).toBe(5000);
      expect(parseStrictBRLToCents(0)).toBe(0);
    });

    it('rejeita estritamente entradas inválidas, malformadas ou maliciosas', () => {
      const invalidInputs = [
        '-1,00',
        'abc1',
        '1abc',
        '1,2,3',
        '1.23,45',
        'R$ abc',
        '1.234.56',
        '1,234',
        ',50',
        '--10',
        'null',
        'undefined',
        '',
        '   ',
        '1.00', // padrão BR usa vírgula decimal
      ];

      for (const invalid of invalidInputs) {
        expect(() => parseStrictBRLToCents(invalid)).toThrow();
      }
    });

    it('rejeita valores numéricos fora dos limites seguros', () => {
      expect(() => parseStrictBRLToCents(-1)).toThrow();
      expect(() => parseStrictBRLToCents(Number.MAX_SAFE_INTEGER + 1)).toThrow();
      expect(() => parseStrictBRLToCents(Infinity)).toThrow();
      expect(() => parseStrictBRLToCents(NaN)).toThrow();
    });

    it('rejeita valores monetários formatados que causam overflow de MAX_SAFE_INTEGER', () => {
      // 9007199254740992 reais em centavos excede MAX_SAFE_INTEGER
      expect(() => parseStrictBRLToCents('9007199254740992,00')).toThrow(/limite seguro/);
      expect(() => parseStrictBRLToCents('999999999999999999999999999')).toThrow(/limite seguro/);
    });
  });

  describe('2. Helper parseBRLInputToCents (compatibilidade segura com formulários)', () => {
    it('retorna centavos inteiros para entradas válidas e 0 para strings vazias ou inválidas', () => {
      expect(parseBRLInputToCents('1,00')).toBe(100);
      expect(parseBRLInputToCents('1.234,56')).toBe(123456);
      expect(parseBRLInputToCents('0,01')).toBe(1);
      expect(parseBRLInputToCents('')).toBe(0);
      expect(parseBRLInputToCents('abc')).toBe(0);
      expect(parseBRLInputToCents('-1,00')).toBe(0);
      expect(parseBRLInputToCents('1,2,3')).toBe(0);
    });
  });

  describe('3. Soma Segura (safeAddCents e calculateOrderTotalCents)', () => {
    it('soma parcelas válidas com precisão exata em centavos', () => {
      expect(safeAddCents(1000, 2500)).toBe(3500);
      expect(safeAddCents(0, 0)).toBe(0);
      expect(safeAddCents(Number.MAX_SAFE_INTEGER - 100, 100)).toBe(Number.MAX_SAFE_INTEGER);
    });

    it('falha explicitamente em caso de overflow em vez de ignorar itens', () => {
      expect(() => safeAddCents(Number.MAX_SAFE_INTEGER, 1)).toThrow(/limite seguro/);
      expect(() => safeAddCents(Number.MAX_SAFE_INTEGER - 10, 20)).toThrow(/limite seguro/);
    });

    it('rejeita parcelas negativas ou não-inteiras', () => {
      expect(() => safeAddCents(-100, 500)).toThrow();
      expect(() => safeAddCents(100, -500)).toThrow();
      expect(() => safeAddCents(100.5, 200)).toThrow();
    });

    it('calculateOrderTotalCents falha com erro explícito se qualquer item causar overflow', () => {
      const validItems = [{ totalPriceCents: 1000 }, { totalPriceCents: 2000 }, { totalPriceCents: 3000 }];
      expect(calculateOrderTotalCents(validItems)).toBe(6000);

      const overflowItems = [{ totalPriceCents: Number.MAX_SAFE_INTEGER }, { totalPriceCents: 1 }];
      expect(() => calculateOrderTotalCents(overflowItems)).toThrow(/limite seguro/);
    });
  });

  describe('4. Multiplicação Segura (safeMultiplyCents e computeSubtotalCents)', () => {
    it('multiplica centavos com segurança e exatidão', () => {
      expect(safeMultiplyCents(1500, 2)).toBe(3000);
      expect(safeMultiplyCents(1000, 1.5)).toBe(1500);
      expect(safeMultiplyCents(0, 50)).toBe(0);
    });

    it('lança erro em caso de overflow na multiplicação', () => {
      expect(() => safeMultiplyCents(Number.MAX_SAFE_INTEGER, 2)).toThrow(/limite seguro/);
      expect(() => computeSubtotalCents(1000000000000, 1000000000000)).toThrow(/limite numérico seguro/);
    });

    it('computeSubtotalCents calcula quantidade milli x custo unitário cents com half-up rounding', () => {
      // 2.500 un (2500 milli) a R$ 10,00 (1000 cents) = R$ 25,00 (2500 cents)
      expect(computeSubtotalCents(2500, 1000)).toBe(2500);
      // 1.333 milli a 333 cents = (1333 * 333 + 500) / 1000 = 444 cents
      expect(computeSubtotalCents(1333, 333)).toBe(444);
    });
  });

  describe('5. Custo Médio Ponderado (computeWeightedAverageCostCents)', () => {
    it('calcula o novo custo médio ponderado sem perda de precisão', () => {
      // Estoque: 10 un (10000 milli) a R$ 10,00 (1000 cents) -> R$ 100,00
      // Entrada: 10 un (10000 milli) a R$ 20,00 (2000 cents) -> R$ 200,00
      // Total: 20 un (20000 milli) -> R$ 300,00 -> Custo médio = R$ 15,00 (1500 cents)
      const avg = computeWeightedAverageCostCents(10000, 1000, 10000, 2000);
      expect(avg).toBe(1500);
    });

    it('falha explicitamente se os inputs ou resultados ultrapassarem limites seguros', () => {
      expect(() =>
        computeWeightedAverageCostCents(Number.MAX_SAFE_INTEGER, 1000, 1000, 1000)
      ).toThrow(/limite/);
    });
  });

  describe('6. Validações de Centavos e Formatação', () => {
    it('isValidCents e isValidNonNegativeCents validam estritamente o domínio', () => {
      expect(isValidCents(1)).toBe(true);
      expect(isValidCents(Number.MAX_SAFE_INTEGER)).toBe(true);
      expect(isValidCents(0)).toBe(false);
      expect(isValidCents(-1)).toBe(false);
      expect(isValidCents(Number.MAX_SAFE_INTEGER + 1)).toBe(false);
      expect(isValidCents(10.5)).toBe(false);

      expect(isValidNonNegativeCents(0)).toBe(true);
      expect(isValidNonNegativeCents(100)).toBe(true);
      expect(isValidNonNegativeCents(-1)).toBe(false);
    });

    it('formatCentsToBRL formata valores para padrão Real brasileiro', () => {
      expect(formatCentsToBRL(100)).toMatch(/R\$\s*1,00/);
      expect(formatCentsToBRL(123456)).toMatch(/R\$\s*1\.234,56/);
      expect(formatCentsToBRL(0)).toMatch(/R\$\s*0,00/);
      expect(formatCentsToBRL(NaN)).toBe('R$ 0,00');
    });
  });
});
