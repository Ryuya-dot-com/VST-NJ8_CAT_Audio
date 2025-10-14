import type { AbilityEstimate, Item } from "../types";

export function prob3pl(theta: number, a: number, b: number, c: number): number {
  return c + (1 - c) / (1 + Math.exp(-a * (theta - b)));
}

export function itemInfo3pl(theta: number, item: Item): number {
  const p = prob3pl(theta, item.Dscrimination, item.Difficulty, item.Guessing);
  const q = 1 - p;
  if (p <= item.Guessing || p >= 1) {
    return 0;
  }
  const numerator = item.Dscrimination ** 2 * q * (p - item.Guessing) ** 2;
  const denominator = p * (1 - item.Guessing) ** 2;
  return numerator / denominator;
}

export function estimateAbilityEap(
  itemBank: Item[],
  administered: number[],
  responses: (0 | 1)[]
): AbilityEstimate {
  if (administered.length === 0) {
    return { theta: 0, se: Number.POSITIVE_INFINITY };
  }

  const gridSize = 1201;
  const grid: number[] = Array.from({ length: gridSize }, (_, idx) => -6 + idx * 0.01);
  const prior: number[] = grid.map(
    (theta) => Math.exp(-0.5 * theta ** 2) / Math.sqrt(2 * Math.PI)
  );
  const likelihood: number[] = Array(gridSize).fill(1);

  for (let i = 0; i < administered.length; i += 1) {
    const item = itemBank[administered[i]];
    const isCorrect = responses[i] === 1;
    for (let j = 0; j < gridSize; j += 1) {
      const prob = prob3pl(grid[j], item.Dscrimination, item.Difficulty, item.Guessing);
      likelihood[j] *= isCorrect ? prob : 1 - prob;
    }
  }

  const posterior = likelihood.map((like, idx) => like * prior[idx]);
  const sumPosterior = posterior.reduce((acc, value) => acc + value, 0);

  if (!Number.isFinite(sumPosterior) || sumPosterior === 0) {
    return { theta: 0, se: Number.POSITIVE_INFINITY };
  }

  const normalized = posterior.map((value) => value / sumPosterior);
  const theta = normalized.reduce((acc, weight, idx) => acc + grid[idx] * weight, 0);
  const variance = normalized.reduce((acc, weight, idx) => {
    const diff = grid[idx] - theta;
    return acc + diff * diff * weight;
  }, 0);
  const se = Math.sqrt(variance);

  return { theta, se };
}

export function selectNextItem(
  itemBank: Item[],
  theta: number,
  administered: number[],
  needHigh: boolean
): number | null {
  const administeredSet = new Set(administered);
  let candidateIndices = itemBank
    .map((_, idx) => idx)
    .filter((idx) => !administeredSet.has(idx));

  if (needHigh) {
    const highItems = candidateIndices.filter((idx) => itemBank[idx].Level >= 7);
    if (highItems.length > 0) {
      candidateIndices = highItems;
    }
  }

  if (candidateIndices.length === 0) {
    return null;
  }

  let bestIndex = candidateIndices[0];
  let bestInfo = -Infinity;

  for (const idx of candidateIndices) {
    const info = itemInfo3pl(theta, itemBank[idx]);
    if (info > bestInfo) {
      bestInfo = info;
      bestIndex = idx;
    }
  }

  return bestIndex;
}

export function vocabFromTheta(theta: number): number {
  const diff = [-2.206, -1.512, -0.701, -0.075, 0.748, 1.152, 1.504, 2.089];
  return diff.reduce((acc, threshold) => acc + 1000 / (1 + Math.exp(-(theta - threshold))), 0);
}
