/**
 * ArteFlow — Manipulação de Valores Monetários em Centavos Inteiros
 * Regra: Todos os valores trafegam e persistem exclusivamente como centavos inteiros (ex: 15000 = R$ 150,00).
 */

export function formatCentsToBRL(cents: number): string {
  if (!Number.isFinite(cents) || !Number.isSafeInteger(cents)) {
    return 'R$ 0,00';
  }

  const roundedCents = Math.round(cents);
  const reais = roundedCents / 100;

  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(reais);
}

export function parseBRLInputToCents(input: string | number): number {
  if (typeof input === 'number') {
    if (!Number.isFinite(input) || input < 0 || input > Number.MAX_SAFE_INTEGER / 100) return 0;
    const rounded = Math.round(input * 100);
    return Number.isSafeInteger(rounded) ? rounded : 0;
  }

  if (!input || typeof input !== 'string') {
    return 0;
  }

  // Remove caracteres não numéricos exceto vírgula e ponto
  const cleanStr = input.trim().replace(/[^\d.,]/g, '');
  if (!cleanStr) return 0;

  // Trata formato brasileiro (1.250,50) ou padrão (1250.50)
  let normalized = cleanStr;
  if (cleanStr.includes(',') && cleanStr.includes('.')) {
    normalized = cleanStr.replace(/\./g, '').replace(',', '.');
  } else if (cleanStr.includes(',')) {
    normalized = cleanStr.replace(',', '.');
  }

  const floatValue = parseFloat(normalized);
  if (isNaN(floatValue) || !isFinite(floatValue) || floatValue < 0 || floatValue > Number.MAX_SAFE_INTEGER / 100) {
    return 0;
  }

  const result = Math.round(floatValue * 100);
  return Number.isSafeInteger(result) ? result : 0;
}

export function calculateOrderTotalCents(items: { totalPriceCents: number }[]): number {
  return items.reduce((acc, item) => {
    const price = Math.round(item.totalPriceCents || 0);
    const next = acc + price;
    return Number.isSafeInteger(next) ? next : acc;
  }, 0);
}

export function isValidCents(cents: number): boolean {
  return Number.isSafeInteger(cents) && cents > 0 && cents <= Number.MAX_SAFE_INTEGER;
}

export function isValidNonNegativeCents(cents: number): boolean {
  return Number.isSafeInteger(cents) && cents >= 0 && cents <= Number.MAX_SAFE_INTEGER;
}
