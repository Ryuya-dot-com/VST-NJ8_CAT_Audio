import type { AbilityEstimate, Item } from "../types";
import { LEGACY_CAT_CONFIG } from "./catConfig.ts";

export function prob3pl(theta: number, a: number, b: number, c: number): number {
  const { logisticScale } = LEGACY_CAT_CONFIG.itemResponse;
  return c + (1 - c) / (1 + Math.exp(-logisticScale * a * (theta - b)));
}

export function itemInfo3pl(theta: number, item: Item): number {
  const p = prob3pl(theta, item.Dscrimination, item.Difficulty, item.Guessing);
  const q = 1 - p;
  if (p <= item.Guessing || p >= 1) {
    return 0;
  }
  const scaledDiscrimination =
    LEGACY_CAT_CONFIG.itemResponse.logisticScale * item.Dscrimination;
  const numerator = scaledDiscrimination ** 2 * q * (p - item.Guessing) ** 2;
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

  const { prior, thetaGrid } = LEGACY_CAT_CONFIG;
  const gridSize = Math.round(
    (thetaGrid.max - thetaGrid.min) / thetaGrid.step
  ) + 1;
  const grid: number[] = Array.from(
    { length: gridSize },
    (_, idx) => thetaGrid.min + idx * thetaGrid.step
  );
  const priorDensity: number[] = grid.map(
    (theta) =>
      Math.exp(
        -0.5 * ((theta - prior.mean) / prior.standardDeviation) ** 2
      ) /
      (prior.standardDeviation * Math.sqrt(2 * Math.PI))
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

  const posterior = likelihood.map((like, idx) => like * priorDensity[idx]);
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
    const highItems = candidateIndices.filter(
      (idx) =>
        itemBank[idx].Level >=
        LEGACY_CAT_CONFIG.contentConstraint.highLevelFloor
    );
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
  return LEGACY_CAT_CONFIG.vocabularyDifficultyThresholds.reduce(
    (acc, threshold) =>
      acc +
      LEGACY_CAT_CONFIG.vocabularyBandSize /
        (1 + Math.exp(-(theta - threshold))),
    0
  );
}
