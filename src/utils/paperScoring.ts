import type { Item } from "../types";

export const PAPER_3PL_CONFIG = Object.freeze({
  scoreModelId: "paper-3pl-v1",
  itemResponse: Object.freeze({
    model: "3PL",
    logisticScale: 1.702,
  }),
  abilityEstimator: Object.freeze({
    method: "EAP",
    uncertainty: "posterior-standard-deviation",
  }),
  thetaGrid: Object.freeze({
    min: -6,
    max: 6,
    step: 0.01,
  }),
  prior: Object.freeze({
    mean: 0,
    standardDeviation: 1,
  }),
  vocabularyScale: Object.freeze({
    frequencyLevels: 8,
    itemsPerLevel: 20,
    wordsPerLevel: 1000,
    credibleMass: 0.95,
  }),
  contentConstraint: Object.freeze({
    highLevelFloor: 7,
  }),
});

export interface PosteriorEstimate {
  theta: number;
  thetaStandardDeviation: number;
  grid: readonly number[];
  weights: readonly number[];
}

export interface LevelParameterMean {
  level: number;
  itemCount: number;
  discrimination: number;
  difficulty: number;
  guessing: number;
}

export interface VocabularyPosteriorSummary {
  scoreModelId: string;
  posteriorMean: number;
  posteriorStandardDeviation: number;
  credibleMass: number;
  credibleIntervalLower: number;
  credibleIntervalUpper: number;
  plugInAtThetaMean: number;
}

function logistic(value: number): number {
  if (value >= 0) {
    const expNegative = Math.exp(-value);
    return 1 / (1 + expNegative);
  }
  const expPositive = Math.exp(value);
  return expPositive / (1 + expPositive);
}

function thetaGrid(): number[] {
  const { min, max, step } = PAPER_3PL_CONFIG.thetaGrid;
  const size = Math.round((max - min) / step) + 1;
  return Array.from({ length: size }, (_, index) => min + index * step);
}

function assertResponses(
  itemBank: Item[],
  administered: number[],
  responses: Array<0 | 1>
): void {
  if (administered.length !== responses.length) {
    throw new RangeError("Administered items and responses must have equal length.");
  }
  for (const index of administered) {
    if (!Number.isInteger(index) || index < 0 || index >= itemBank.length) {
      throw new RangeError(`Invalid administered item index: ${index}`);
    }
  }
  if (new Set(administered).size !== administered.length) {
    throw new RangeError("An item cannot be administered more than once.");
  }
}

export function paperProbability3pl(theta: number, item: Item): number {
  const linearPredictor =
    PAPER_3PL_CONFIG.itemResponse.logisticScale *
    item.Dscrimination *
    (theta - item.Difficulty);
  return item.Guessing + (1 - item.Guessing) * logistic(linearPredictor);
}

export function paperItemInformation3pl(theta: number, item: Item): number {
  const probability = paperProbability3pl(theta, item);
  if (probability <= item.Guessing || probability >= 1) {
    return 0;
  }
  const incorrectProbability = 1 - probability;
  const scaledDiscrimination =
    PAPER_3PL_CONFIG.itemResponse.logisticScale * item.Dscrimination;
  return (
    (scaledDiscrimination ** 2 *
      incorrectProbability *
      (probability - item.Guessing) ** 2) /
    (probability * (1 - item.Guessing) ** 2)
  );
}

export function estimatePaperPosteriorEap(
  itemBank: Item[],
  administered: number[],
  responses: Array<0 | 1>
): PosteriorEstimate {
  assertResponses(itemBank, administered, responses);
  const grid = thetaGrid();
  const { mean, standardDeviation } = PAPER_3PL_CONFIG.prior;
  const logNormalizingConstant = Math.log(
    standardDeviation * Math.sqrt(2 * Math.PI)
  );
  const logPosterior = grid.map((theta) => {
    const standardized = (theta - mean) / standardDeviation;
    let value = -0.5 * standardized ** 2 - logNormalizingConstant;
    for (
      let responseIndex = 0;
      responseIndex < administered.length;
      responseIndex += 1
    ) {
      const item = itemBank[administered[responseIndex]];
      const probability = paperProbability3pl(theta, item);
      value +=
        responses[responseIndex] === 1
          ? Math.log(probability)
          : Math.log1p(-probability);
    }
    return value;
  });

  const maximumLogPosterior = Math.max(...logPosterior);
  const unnormalizedWeights = logPosterior.map((value) =>
    Math.exp(value - maximumLogPosterior)
  );
  const weightTotal = unnormalizedWeights.reduce(
    (sum, weight) => sum + weight,
    0
  );
  if (!Number.isFinite(weightTotal) || weightTotal <= 0) {
    throw new RangeError("The posterior distribution could not be normalized.");
  }

  const weights = unnormalizedWeights.map((weight) => weight / weightTotal);
  const theta = weights.reduce(
    (sum, weight, index) => sum + weight * grid[index],
    0
  );
  const variance = weights.reduce((sum, weight, index) => {
    const difference = grid[index] - theta;
    return sum + weight * difference ** 2;
  }, 0);

  return {
    theta,
    thetaStandardDeviation: Math.sqrt(variance),
    grid,
    weights,
  };
}

export function computeLevelParameterMeans(
  itemBank: Item[]
): LevelParameterMean[] {
  const { frequencyLevels, itemsPerLevel } =
    PAPER_3PL_CONFIG.vocabularyScale;
  return Array.from({ length: frequencyLevels }, (_, levelIndex) => {
    const level = levelIndex + 1;
    const items = itemBank.filter((item) => item.Level === level);
    if (items.length !== itemsPerLevel) {
      throw new RangeError(
        `Frequency level ${level} must contain ${itemsPerLevel} items; received ${items.length}.`
      );
    }
    return {
      level,
      itemCount: items.length,
      discrimination:
        items.reduce((sum, item) => sum + item.Dscrimination, 0) /
        items.length,
      difficulty:
        items.reduce((sum, item) => sum + item.Difficulty, 0) / items.length,
      guessing:
        items.reduce((sum, item) => sum + item.Guessing, 0) / items.length,
    };
  });
}

export function paperVocabularyAtThetaFromMeans(
  theta: number,
  levelMeans: readonly LevelParameterMean[]
): number {
  const { frequencyLevels, wordsPerLevel } =
    PAPER_3PL_CONFIG.vocabularyScale;
  if (levelMeans.length !== frequencyLevels) {
    throw new RangeError(
      `Expected ${frequencyLevels} frequency-level means; received ${levelMeans.length}.`
    );
  }
  for (let index = 0; index < levelMeans.length; index += 1) {
    const level = levelMeans[index];
    if (
      level.level !== index + 1 ||
      level.itemCount !== PAPER_3PL_CONFIG.vocabularyScale.itemsPerLevel
    ) {
      throw new RangeError("Frequency-level means are incomplete or out of order.");
    }
  }
  return levelMeans.reduce(
    (sum, level) =>
      sum + wordsPerLevel * paperLevelExpectedProbability(theta, level),
    0
  );
}

export function paperLevelExpectedProbability(
  theta: number,
  level: LevelParameterMean
): number {
  const logisticScale = PAPER_3PL_CONFIG.itemResponse.logisticScale;
  return (
    level.guessing +
    (1 - level.guessing) *
      logistic(
        logisticScale *
          level.discrimination *
          (theta - level.difficulty)
      )
  );
}

export function paperVocabularyAtTheta(
  theta: number,
  itemBank: Item[]
): number {
  return paperVocabularyAtThetaFromMeans(
    theta,
    computeLevelParameterMeans(itemBank)
  );
}

export function deguessedVocabularyAtTheta(
  theta: number,
  itemBank: Item[]
): number {
  computeLevelParameterMeans(itemBank);
  const { itemsPerLevel, wordsPerLevel } =
    PAPER_3PL_CONFIG.vocabularyScale;
  const itemWeight = wordsPerLevel / itemsPerLevel;
  const logisticScale = PAPER_3PL_CONFIG.itemResponse.logisticScale;
  return itemBank.reduce(
    (sum, item) =>
      sum +
      itemWeight *
        logistic(
          logisticScale *
            item.Dscrimination *
            (theta - item.Difficulty)
        ),
    0
  );
}

function weightedQuantile(
  sortedValues: readonly number[],
  weights: readonly number[],
  probability: number
): number {
  if (sortedValues.length === 0 || sortedValues.length !== weights.length) {
    throw new RangeError("Values and weights must be non-empty and equal length.");
  }
  if (probability < 0 || probability > 1) {
    throw new RangeError("Quantile probability must be between zero and one.");
  }
  let cumulativeWeight = 0;
  for (let index = 0; index < sortedValues.length; index += 1) {
    cumulativeWeight += weights[index];
    if (cumulativeWeight >= probability) {
      return sortedValues[index];
    }
  }
  return sortedValues[sortedValues.length - 1];
}

export function summarizePaperVocabularyPosterior(
  itemBank: Item[],
  posterior: PosteriorEstimate
): VocabularyPosteriorSummary {
  if (
    posterior.grid.length === 0 ||
    posterior.grid.length !== posterior.weights.length
  ) {
    throw new RangeError("Posterior grid and weights must be non-empty and equal length.");
  }
  const posteriorWeightTotal = posterior.weights.reduce(
    (sum, weight) => sum + weight,
    0
  );
  if (
    posterior.weights.some(
      (weight) => !Number.isFinite(weight) || weight < 0
    ) ||
    Math.abs(posteriorWeightTotal - 1) > 1e-10
  ) {
    throw new RangeError("Posterior weights must be finite, nonnegative, and normalized.");
  }
  for (let index = 1; index < posterior.grid.length; index += 1) {
    if (posterior.grid[index] <= posterior.grid[index - 1]) {
      throw new RangeError("Posterior grid values must be strictly increasing.");
    }
  }
  const levelMeans = computeLevelParameterMeans(itemBank);
  const vocabularyValues = posterior.grid.map((theta) =>
    paperVocabularyAtThetaFromMeans(theta, levelMeans)
  );
  const posteriorMean = posterior.weights.reduce(
    (sum, weight, index) => sum + weight * vocabularyValues[index],
    0
  );
  const variance = posterior.weights.reduce((sum, weight, index) => {
    const difference = vocabularyValues[index] - posteriorMean;
    return sum + weight * difference ** 2;
  }, 0);
  const credibleMass = PAPER_3PL_CONFIG.vocabularyScale.credibleMass;
  const lowerProbability = (1 - credibleMass) / 2;
  const upperProbability = 1 - lowerProbability;

  return {
    scoreModelId: PAPER_3PL_CONFIG.scoreModelId,
    posteriorMean,
    posteriorStandardDeviation: Math.sqrt(variance),
    credibleMass,
    credibleIntervalLower: weightedQuantile(
      vocabularyValues,
      posterior.weights,
      lowerProbability
    ),
    credibleIntervalUpper: weightedQuantile(
      vocabularyValues,
      posterior.weights,
      upperProbability
    ),
    plugInAtThetaMean: paperVocabularyAtThetaFromMeans(
      posterior.theta,
      levelMeans
    ),
  };
}

export function selectNextPaperItem(
  itemBank: Item[],
  theta: number,
  administered: number[],
  needHigh: boolean
): number | null {
  const administeredSet = new Set(administered);
  let candidates = itemBank
    .map((_, index) => index)
    .filter((index) => !administeredSet.has(index));

  if (needHigh) {
    const highCandidates = candidates.filter(
      (index) =>
        itemBank[index].Level >=
        PAPER_3PL_CONFIG.contentConstraint.highLevelFloor
    );
    if (highCandidates.length > 0) {
      candidates = highCandidates;
    }
  }
  if (candidates.length === 0) {
    return null;
  }

  let selected = candidates[0];
  let selectedInformation = Number.NEGATIVE_INFINITY;
  for (const index of candidates) {
    const information = paperItemInformation3pl(theta, itemBank[index]);
    if (information > selectedInformation) {
      selected = index;
      selectedInformation = information;
    }
  }
  return selected;
}
