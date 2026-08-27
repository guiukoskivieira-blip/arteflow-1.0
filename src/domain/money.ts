/**
 * ArteFlow — Manipulação de Valores Monetários em Centavos Inteiros
 * Regra: Todos os valores trafegam e persistem exclusivamente como centavos inteiros (ex: 15000 = R$ 150,00).
 */

export function formatCentsToBRL(cents: number): string {
  if (!Number.isFinite(cents)) {
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
    return Math.round(input * 100);
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
  if (isNaN(floatValue)) return 0;

  return Math.round(floatValue * 100);
}

export function calculateOrderTotalCents(items: { totalPriceCents: number }[]): number {
  return items.reduce((acc, item) => acc + Math.round(item.totalPriceCents || 0), 0);
}
