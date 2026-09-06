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

export function isValidCents(cents: number): boolean {
  return Number.isSafeInteger(cents) && cents > 0 && cents <= Number.MAX_SAFE_INTEGER;
}

export function isValidNonNegativeCents(cents: number): boolean {
  return Number.isSafeInteger(cents) && cents >= 0 && cents <= Number.MAX_SAFE_INTEGER;
}

export function safeAddCents(a: number, b: number): number {
  if (!Number.isSafeInteger(a) || !Number.isSafeInteger(b)) {
    throw new Error('Parcelas devem ser inteiros seguros.');
  }
  if (a < 0 || b < 0) {
    throw new Error('Parcelas monetárias não podem ser negativas.');
  }
  const sum = BigInt(a) + BigInt(b);
  if (sum > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error('Soma monetária excede o limite seguro (MAX_SAFE_INTEGER).');
  }
  return Number(sum);
}

export function safeMultiplyCents(cents: number, factor: number): number {
  if (!Number.isSafeInteger(cents)) {
    throw new Error('Valor em centavos deve ser um inteiro seguro.');
  }
  if (!Number.isFinite(factor) || factor < 0) {
    throw new Error('Fator de multiplicação deve ser um número não-negativo.');
  }
  if (cents < 0) {
    throw new Error('Valor monetário não pode ser negativo.');
  }
  if (Number.isInteger(factor) && Number.isSafeInteger(factor)) {
    const prod = BigInt(cents) * BigInt(factor);
    if (prod > BigInt(Number.MAX_SAFE_INTEGER)) {
      throw new Error('Multiplicação monetária excede o limite seguro (MAX_SAFE_INTEGER).');
    }
    return Number(prod);
  }
  // Se for fracionário, computa com aritmética de alta precisão
  const scaledFactor = Math.round(factor * 1000000);
  const prod = BigInt(cents) * BigInt(scaledFactor);
  const rounded = (prod + 500000n) / 1000000n;
  if (rounded > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error('Multiplicação monetária excede o limite seguro (MAX_SAFE_INTEGER).');
  }
  return Number(rounded);
}

/**
 * Parser monetário estrito para moeda brasileira (BRL).
 * Casos válidos:
 * "1" -> 100
 * "1,00" -> 100
 * "1.234,56" -> 123456
 * "0,01" -> 1
 * "1234,56" -> 123456
 *
 * Casos inválidos (lançam erro):
 * "-1,00", "abc1", "1abc", "1,2,3", "1.23,45", "R$ abc", etc.
 */
export function parseStrictBRLToCents(input: string | number): number {
  if (typeof input === 'number') {
    if (!Number.isSafeInteger(input) || input < 0 || input > Number.MAX_SAFE_INTEGER) {
      throw new Error('Valor numérico fora dos limites seguros em centavos.');
    }
    return input;
  }

  if (typeof input !== 'string') {
    throw new Error('Entrada monetária inválida.');
  }

  const raw = input.trim();
  if (!raw) {
    throw new Error('Entrada monetária vazia.');
  }

  // Remove prefixo R$ ou r$ opcional com espaçamento
  const clean = raw.replace(/^r\$\s*/i, '').trim();
  if (!clean) {
    throw new Error('Valor monetário inválido.');
  }

  // Padrão 1: apenas dígitos inteiros (ex: "1", "100", "1234") -> interpreta como Reais inteiros
  if (/^\d+$/.test(clean)) {
    const reais = BigInt(clean);
    const cents = reais * 100n;
    if (cents > BigInt(Number.MAX_SAFE_INTEGER)) {
      throw new Error('Valor monetário excede o limite seguro.');
    }
    return Number(cents);
  }

  // Padrão 2: Formato sem pontos de milhar com centavos opcionais ou obrigatórios (ex: "1234,56", "1,00", "0,01", "12,3")
  // Formato 3: Formato com pontos de milhar estritos (ex: "1.234,56", "12.345.678,90")
  const standardPattern = /^(\d{1,3}(\.\d{3})+|\d+),(\d{1,2})$/;
  const match = clean.match(standardPattern);

  if (!match) {
    throw new Error(`Formato monetário inválido: "${input}".`);
  }

  const integerPartRaw = match[1].replace(/\./g, '');
  const fractionalPartRaw = match[3].padEnd(2, '0');

  const integerPart = BigInt(integerPartRaw);
  const fractionalPart = BigInt(fractionalPartRaw);

  const totalCents = integerPart * 100n + fractionalPart;
  if (totalCents > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error('Valor monetário excede o limite seguro.');
  }

  return Number(totalCents);
}

/**
 * Função utilitária retrocompatível que usa o parser estrito e retorna 0 apenas em caso de vazio ou lança/retorna 0
 * para formulários reativos quando especificado.
 */
export function parseBRLInputToCents(input: string | number): number {
  if (typeof input === 'number') {
    if (!Number.isSafeInteger(input) || input < 0 || input > Number.MAX_SAFE_INTEGER) return 0;
    return input;
  }
  if (!input || typeof input !== 'string') return 0;
  const trimmed = input.trim();
  if (!trimmed) return 0;
  try {
    return parseStrictBRLToCents(trimmed);
  } catch {
    return 0;
  }
}

export function calculateOrderTotalCents(items: { totalPriceCents: number }[]): number {
  return items.reduce((acc, item) => {
    const price = item.totalPriceCents;
    if (!Number.isSafeInteger(price) || price < 0) {
      throw new Error('Preço do item é inválido.');
    }
    return safeAddCents(acc, price);
  }, 0);
}

export function computeSubtotalCents(quantityMilli: number, unitCostCents: number): number {
  if (!Number.isSafeInteger(quantityMilli) || !Number.isSafeInteger(unitCostCents)) {
    throw new Error('Valores de entrada não são inteiros seguros.');
  }
  if (quantityMilli < 0 || unitCostCents < 0) {
    throw new Error('Quantidade e custo devem ser não-negativos.');
  }
  if (quantityMilli > Number.MAX_SAFE_INTEGER || unitCostCents > Number.MAX_SAFE_INTEGER) {
    throw new Error('Valores de entrada excedem o limite seguro.');
  }
  const prod = BigInt(quantityMilli) * BigInt(unitCostCents);
  const rounded = (prod + 500n) / 1000n;
  if (rounded > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error('Resultado excede o limite numérico seguro em centavos.');
  }
  return Number(rounded);
}

/**
 * Calcula o custo médio ponderado em centavos após uma entrada de mercadoria.
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

  if (
    currentStockMilli > Number.MAX_SAFE_INTEGER ||
    currentAverageCostCents > Number.MAX_SAFE_INTEGER ||
    incomingQuantityMilli > Number.MAX_SAFE_INTEGER ||
    incomingUnitCostCents > Number.MAX_SAFE_INTEGER ||
    (incomingTotalCostCents !== undefined && incomingTotalCostCents > Number.MAX_SAFE_INTEGER)
  ) {
    throw new Error('Valores para cálculo de custo médio excedem o limite seguro.');
  }

  const newStockMilliBig = BigInt(currentStockMilli) + BigInt(incomingQuantityMilli);
  if (newStockMilliBig > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error('Saldo resultante excede o limite numérico seguro.');
  }
  const newStockMilli = Number(newStockMilliBig);

  if (newStockMilli === 0) return 0;

  // Valor total atual em centavos (com arredondamento comercial)
  const currentTotalValCents = (BigInt(currentStockMilli) * BigInt(currentAverageCostCents) + 500n) / 1000n;
  if (currentTotalValCents > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error('Valor total do estoque atual excede o limite seguro.');
  }

  // Valor total de entrada em centavos
  const incomingTotalValCents = incomingTotalCostCents !== undefined
    ? BigInt(incomingTotalCostCents)
    : (BigInt(incomingQuantityMilli) * BigInt(incomingUnitCostCents) + 500n) / 1000n;
  if (incomingTotalValCents > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error('Valor total da entrada excede o limite seguro.');
  }

  const newTotalValCents = currentTotalValCents + incomingTotalValCents;
  if (newTotalValCents > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error('Valor total combinado excede o limite seguro.');
  }

  const numerator = newTotalValCents * 1000n;
  const divisor = BigInt(newStockMilli);
  const halfDivisor = divisor / 2n;
  const newAvgCost = (numerator + halfDivisor) / divisor;

  if (newAvgCost > BigInt(Number.MAX_SAFE_INTEGER) || newAvgCost < 0n) {
    throw new Error('Custo médio resultante excede o limite numérico seguro.');
  }

  return Number(newAvgCost);
}
