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

export const formatMoneyFromCents = formatCentsToBRL;

export function parseBRLInputToCents(input: string | number): number {
  if (typeof input === 'number') {
    if (!Number.isFinite(input) || input < 0 || input > Number.MAX_SAFE_INTEGER / 100) return 0;
    const rounded = Math.round(input * 100);
    return Number.isSafeInteger(rounded) ? rounded : 0;
  }
  if (!input || typeof input !== 'string') return 0;
  const cleanStr = input.trim().replace(/[^\d.,]/g, '');
  if (!cleanStr) return 0;
  let normalized = cleanStr;
  if (cleanStr.includes(',') && cleanStr.includes('.')) {
    normalized = cleanStr.replace(/\./g, '').replace(',', '.');
  } else if (cleanStr.includes(',')) {
    normalized = cleanStr.replace(',', '.');
  }
  const floatValue = parseFloat(normalized);
  if (isNaN(floatValue) || !isFinite(floatValue) || floatValue < 0 || floatValue > Number.MAX_SAFE_INTEGER / 100) return 0;
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

export function computeSubtotalCents(quantityMilli: number, unitCostCents: number): number {
  if (!Number.isSafeInteger(quantityMilli) || !Number.isSafeInteger(unitCostCents)) {
    throw new Error('Valores de entrada não são inteiros seguros.');
  }
  if (quantityMilli < 0 || unitCostCents < 0) {
    throw new Error('Quantidade e custo devem ser não-negativos.');
  }
  const prod = BigInt(quantityMilli) * BigInt(unitCostCents);
  const rounded = (prod + 500n) / 1000n;
  const result = Number(rounded);
  if (!Number.isSafeInteger(result)) {
    throw new Error('Resultado excede o limite numérico seguro em centavos.');
  }
  return result;
}

/**
 * Calcula o custo médio ponderado em centavos após uma entrada de mercadoria.
 * Fórmula:
 * novoValorTotal = valorAtual + valorEntrada
 * novoCustoMedio = novoValorTotal / novaQuantidadeTotal
 *
 * Utiliza BigInt para evitar overflow intermediário e aplica arredondamento comercial (half-up).
 */
export function computeWeightedAverageCostCents(
  currentStockMilli: number,
  currentAverageCostCents: number,
  incomingQuantityMilli: number,
  incomingUnitCostCents: number,
  incomingTotalCostCents?: number
): number {
  if (
    !Number.isSafeInteger(currentStockMilli) ||
    !Number.isSafeInteger(currentAverageCostCents) ||
    !Number.isSafeInteger(incomingQuantityMilli) ||
    !Number.isSafeInteger(incomingUnitCostCents) ||
    (incomingTotalCostCents !== undefined && !Number.isSafeInteger(incomingTotalCostCents))
  ) {
    throw new Error('Valores para cálculo de custo médio não são inteiros seguros.');
  }

  if (
    currentStockMilli < 0 ||
    currentAverageCostCents < 0 ||
    incomingQuantityMilli <= 0 ||
    incomingUnitCostCents < 0 ||
    (incomingTotalCostCents !== undefined && incomingTotalCostCents < 0)
  ) {
    throw new Error('Valores para cálculo de custo médio devem ser positivos/não-negativos válidos.');
  }

  const newStockMilli = currentStockMilli + incomingQuantityMilli;
  if (!Number.isSafeInteger(newStockMilli)) {
    throw new Error('Saldo resultante excede o limite numérico seguro.');
  }

  if (newStockMilli === 0) return 0;

  // Valor total atual em centavos (com arredondamento comercial)
  const currentTotalValCents = (BigInt(currentStockMilli) * BigInt(currentAverageCostCents) + 500n) / 1000n;

  // Valor total de entrada em centavos
  const incomingTotalValCents = incomingTotalCostCents !== undefined
    ? BigInt(incomingTotalCostCents)
    : (BigInt(incomingQuantityMilli) * BigInt(incomingUnitCostCents) + 500n) / 1000n;

  const newTotalValCents = currentTotalValCents + incomingTotalValCents;

  // novoCustoMedio = (newTotalValCents / (newStockMilli / 1000))
  // Equivalente com BigInt e half-up (+ newStockMilli / 2):
  // novoCustoMedio = (newTotalValCents * 1000n + (newStockMilli / 2)) / newStockMilli
  const numerator = newTotalValCents * 1000n;
  const divisor = BigInt(newStockMilli);
  const halfDivisor = divisor / 2n;
  const newAvgCost = (numerator + halfDivisor) / divisor;

  const result = Number(newAvgCost);
  if (!Number.isSafeInteger(result) || result < 0) {
    throw new Error('Custo médio resultante excede o limite numérico seguro.');
  }

  return result;
}
