import type { Item } from "../types";
import type { LevelParameterMean } from "./paperScoring.ts";
import {
  PAPER_3PL_CONFIG,
  computeLevelParameterMeans,
  paperItemInformation3pl,
  paperProbability3pl,
  paperVocabularyAtThetaFromMeans,
} from "./paperScoring.ts";

export type SelectionMethod = "maximum-information" | "randomesque";
export type StopReason =
  | "precision"
  | "fixed-length"
  | "maximum-length"
  | "item-bank-exhausted";

export interface SimulationRule {
  id: string;
  minimumItems: number;
  maximumItems: number;
  targetPosteriorStandardDeviation: number | null;
  selectionMethod: SelectionMethod;
  randomesqueSize?: number;
}

export interface SimulationPlan {
  planId: string;
  seed: number;
  replicationsPerTheta: number;
  trueThetas: number[];
  rules: SimulationRule[];
  initialLevelMinimum: number;
  initialLevelMaximum: number;
  highLevelFloor: number;
  minimumHighLevelItems: number;
  credibleMass: number;
}

export interface ConditionalSimulationMetrics {
  trueTheta: number | null;
  trials: number;
  thetaBias: number;
  thetaRmse: number;
  thetaCoverage: number;
  meanPosteriorStandardDeviation: number;
  vocabularyBias: number;
  vocabularyRmse: number;
  vocabularyCoverage: number;
  meanLength: number;
  lengthP10: number;
  lengthP50: number;
  lengthP90: number;
  stopRates: Record<StopReason, number>;
  highLevelConstraintViolationRate: number;
  monteCarloStandardErrors: {
    thetaBias: number;
    thetaRmse: number;
    thetaCoverage: number;
    vocabularyBias: number;
    vocabularyRmse: number;
    vocabularyCoverage: number;
    meanLength: number;
    highLevelConstraintViolationRate: number;
  };
}

export interface SimulationProvenance {
  nodeVersion: string;
  platform: string;
  architecture: string;
  sourceSha256: Record<string, string>;
}

export interface ExposureMetrics {
  maximumExposureRate: number;
  unusedItemRate: number;
  topExposedItems: Array<{
    itemIndex: number;
    level: number;
    administrations: number;
    exposureRate: number;
  }>;
}

export interface RuleSimulationResult {
  rule: SimulationRule;
  overall: ConditionalSimulationMetrics;
  conditional: ConditionalSimulationMetrics[];
  exposure: ExposureMetrics;
}

export interface CatSimulationReport {
  schemaVersion: "cat-simulation-v1";
  engineId: "cat-eap-3pl-monte-carlo-v1";
  randomGeneratorId: "mulberry32-v1";
  scoreModelId: string;
  itemBankSha256: string;
  planSha256: string | null;
  provenance: SimulationProvenance | null;
  plan: SimulationPlan;
  results: RuleSimulationResult[];
}

interface ModelCache {
  grid: number[];
  priorWeights: Float64Array;
  probabilities: Float64Array[];
  vocabularyValues: Float64Array;
  levelMeans: LevelParameterMean[];
}

interface PosteriorMoments {
  theta: number;
  standardDeviation: number;
}

interface TrialOutcome {
  thetaError: number;
  thetaSquaredError: number;
  thetaCovered: boolean;
  posteriorStandardDeviation: number;
  vocabularyError: number;
  vocabularySquaredError: number;
  vocabularyCovered: boolean;
  length: number;
  stopReason: StopReason;
  highLevelConstraintViolated: boolean;
}

interface MetricsAccumulator {
  trueTheta: number | null;
  trials: number;
  thetaErrorSum: number;
  thetaSquaredErrorSum: number;
  thetaFourthErrorSum: number;
  thetaCoverageCount: number;
  posteriorStandardDeviationSum: number;
  vocabularyErrorSum: number;
  vocabularySquaredErrorSum: number;
  vocabularyFourthErrorSum: number;
  vocabularyCoverageCount: number;
  lengths: number[];
  stopCounts: Record<StopReason, number>;
  highLevelConstraintViolationCount: number;
}

const STOP_REASONS: StopReason[] = [
  "precision",
  "fixed-length",
  "maximum-length",
  "item-bank-exhausted",
];

export function createDeterministicRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function deriveSeed(
  baseSeed: number,
  thetaIndex: number,
  replication: number,
  stream: number
): number {
  let hash = (baseSeed ^ 0x811c9dc5) >>> 0;
  for (const value of [thetaIndex, replication, stream]) {
    hash ^= value >>> 0;
    hash = Math.imul(hash, 0x01000193) >>> 0;
    hash ^= hash >>> 16;
  }
  return hash >>> 0;
}

function buildGrid(): number[] {
  const { min, max, step } = PAPER_3PL_CONFIG.thetaGrid;
  const size = Math.round((max - min) / step) + 1;
  return Array.from({ length: size }, (_, index) => min + index * step);
}

function buildModelCache(itemBank: Item[]): ModelCache {
  const grid = buildGrid();
  const { mean, standardDeviation } = PAPER_3PL_CONFIG.prior;
  const priorWeights = Float64Array.from(
    grid,
    (theta) =>
      Math.exp(-0.5 * ((theta - mean) / standardDeviation) ** 2) /
      (standardDeviation * Math.sqrt(2 * Math.PI))
  );
  normalizeWeights(priorWeights);
  const probabilities = itemBank.map((item) =>
    Float64Array.from(grid, (theta) => paperProbability3pl(theta, item))
  );
  const levelMeans = computeLevelParameterMeans(itemBank);
  const vocabularyValues = Float64Array.from(grid, (theta) =>
    paperVocabularyAtThetaFromMeans(theta, levelMeans)
  );
  return { grid, priorWeights, probabilities, vocabularyValues, levelMeans };
}

function normalizeWeights(weights: Float64Array): void {
  let total = 0;
  for (const weight of weights) total += weight;
  if (!Number.isFinite(total) || total <= 0) {
    throw new RangeError("Simulation posterior weights cannot be normalized.");
  }
  for (let index = 0; index < weights.length; index += 1) {
    weights[index] /= total;
  }
}

function updatePosterior(
  weights: Float64Array,
  itemProbabilities: Float64Array,
  response: 0 | 1
): void {
  for (let index = 0; index < weights.length; index += 1) {
    const probability = itemProbabilities[index];
    weights[index] *= response === 1 ? probability : 1 - probability;
  }
  normalizeWeights(weights);
}

function posteriorMoments(
  grid: readonly number[],
  weights: Float64Array
): PosteriorMoments {
  let theta = 0;
  for (let index = 0; index < grid.length; index += 1) {
    theta += grid[index] * weights[index];
  }
  let variance = 0;
  for (let index = 0; index < grid.length; index += 1) {
    variance += (grid[index] - theta) ** 2 * weights[index];
  }
  return { theta, standardDeviation: Math.sqrt(variance) };
}

function weightedQuantile(
  values: ArrayLike<number>,
  weights: Float64Array,
  probability: number
): number {
  let cumulative = 0;
  for (let index = 0; index < weights.length; index += 1) {
    cumulative += weights[index];
    if (cumulative >= probability) return values[index];
  }
  return values[values.length - 1];
}

function chooseInitialItem(
  itemBank: Item[],
  plan: SimulationPlan,
  random: () => number
): number {
  const candidates = itemBank
    .map((item, index) => ({ item, index }))
    .filter(
      ({ item }) =>
        item.Level >= plan.initialLevelMinimum &&
        item.Level <= plan.initialLevelMaximum
    );
  if (candidates.length === 0) {
    throw new RangeError("No items satisfy the initial-level constraint.");
  }
  return candidates[Math.floor(random() * candidates.length)].index;
}

function chooseNextItem(
  itemBank: Item[],
  theta: number,
  administered: Uint8Array,
  needHigh: boolean,
  highLevelFloor: number,
  rule: SimulationRule,
  random: () => number
): number | null {
  let candidates = itemBank
    .map((_, index) => index)
    .filter((index) => administered[index] === 0);
  if (needHigh) {
    const highCandidates = candidates.filter(
      (index) => itemBank[index].Level >= highLevelFloor
    );
    if (highCandidates.length > 0) candidates = highCandidates;
  }
  if (candidates.length === 0) return null;

  const ranked = candidates
    .map((index) => ({
      index,
      information: paperItemInformation3pl(theta, itemBank[index]),
    }))
    .sort(
      (left, right) =>
        right.information - left.information || left.index - right.index
    );
  if (rule.selectionMethod === "maximum-information") return ranked[0].index;
  const randomesqueSize = Math.min(rule.randomesqueSize ?? 1, ranked.length);
  return ranked[Math.floor(random() * randomesqueSize)].index;
}

function stoppingReason(
  rule: SimulationRule,
  length: number,
  posteriorStandardDeviation: number,
  highLevelItems: number,
  minimumHighLevelItems: number
): StopReason | null {
  if (rule.targetPosteriorStandardDeviation === null) {
    return length >= rule.maximumItems ? "fixed-length" : null;
  }
  if (
    length >= rule.minimumItems &&
    posteriorStandardDeviation <= rule.targetPosteriorStandardDeviation &&
    highLevelItems >= minimumHighLevelItems
  ) {
    return "precision";
  }
  return length >= rule.maximumItems ? "maximum-length" : null;
}

function simulateTrial(
  itemBank: Item[],
  cache: ModelCache,
  plan: SimulationPlan,
  rule: SimulationRule,
  trueTheta: number,
  responseRandom: () => number,
  selectionRandom: () => number,
  exposureCounts: Uint32Array
): TrialOutcome {
  const weights = new Float64Array(cache.priorWeights);
  const administered = new Uint8Array(itemBank.length);
  let nextItem: number | null = chooseInitialItem(
    itemBank,
    plan,
    selectionRandom
  );
  let length = 0;
  let highLevelItems = 0;
  let moments = posteriorMoments(cache.grid, weights);
  let stopReason: StopReason = "item-bank-exhausted";

  while (nextItem !== null) {
    const item = itemBank[nextItem];
    const response: 0 | 1 =
      responseRandom() < paperProbability3pl(trueTheta, item) ? 1 : 0;
    administered[nextItem] = 1;
    exposureCounts[nextItem] += 1;
    length += 1;
    if (item.Level >= plan.highLevelFloor) highLevelItems += 1;
    updatePosterior(weights, cache.probabilities[nextItem], response);
    moments = posteriorMoments(cache.grid, weights);

    const reason = stoppingReason(
      rule,
      length,
      moments.standardDeviation,
      highLevelItems,
      plan.minimumHighLevelItems
    );
    if (reason !== null) {
      stopReason = reason;
      break;
    }
    nextItem = chooseNextItem(
      itemBank,
      moments.theta,
      administered,
      highLevelItems < plan.minimumHighLevelItems,
      plan.highLevelFloor,
      rule,
      selectionRandom
    );
  }

  const tailProbability = (1 - plan.credibleMass) / 2;
  const thetaLower = weightedQuantile(cache.grid, weights, tailProbability);
  const thetaUpper = weightedQuantile(cache.grid, weights, 1 - tailProbability);
  let vocabularyMean = 0;
  for (let index = 0; index < weights.length; index += 1) {
    vocabularyMean += weights[index] * cache.vocabularyValues[index];
  }
  const vocabularyLower = weightedQuantile(
    cache.vocabularyValues,
    weights,
    tailProbability
  );
  const vocabularyUpper = weightedQuantile(
    cache.vocabularyValues,
    weights,
    1 - tailProbability
  );
  const trueVocabulary = paperVocabularyAtThetaFromMeans(
    trueTheta,
    cache.levelMeans
  );
  const thetaError = moments.theta - trueTheta;
  const vocabularyError = vocabularyMean - trueVocabulary;

  return {
    thetaError,
    thetaSquaredError: thetaError ** 2,
    thetaCovered: thetaLower <= trueTheta && trueTheta <= thetaUpper,
    posteriorStandardDeviation: moments.standardDeviation,
    vocabularyError,
    vocabularySquaredError: vocabularyError ** 2,
    vocabularyCovered:
      vocabularyLower <= trueVocabulary && trueVocabulary <= vocabularyUpper,
    length,
    stopReason,
    highLevelConstraintViolated:
      highLevelItems < plan.minimumHighLevelItems,
  };
}

function createAccumulator(trueTheta: number | null): MetricsAccumulator {
  return {
    trueTheta,
    trials: 0,
    thetaErrorSum: 0,
    thetaSquaredErrorSum: 0,
    thetaFourthErrorSum: 0,
    thetaCoverageCount: 0,
    posteriorStandardDeviationSum: 0,
    vocabularyErrorSum: 0,
    vocabularySquaredErrorSum: 0,
    vocabularyFourthErrorSum: 0,
    vocabularyCoverageCount: 0,
    lengths: [],
    stopCounts: {
      precision: 0,
      "fixed-length": 0,
      "maximum-length": 0,
      "item-bank-exhausted": 0,
    },
    highLevelConstraintViolationCount: 0,
  };
}

function addOutcome(
  accumulator: MetricsAccumulator,
  outcome: TrialOutcome
): void {
  accumulator.trials += 1;
  accumulator.thetaErrorSum += outcome.thetaError;
  accumulator.thetaSquaredErrorSum += outcome.thetaSquaredError;
  accumulator.thetaFourthErrorSum += outcome.thetaSquaredError ** 2;
  accumulator.thetaCoverageCount += outcome.thetaCovered ? 1 : 0;
  accumulator.posteriorStandardDeviationSum +=
    outcome.posteriorStandardDeviation;
  accumulator.vocabularyErrorSum += outcome.vocabularyError;
  accumulator.vocabularySquaredErrorSum += outcome.vocabularySquaredError;
  accumulator.vocabularyFourthErrorSum += outcome.vocabularySquaredError ** 2;
  accumulator.vocabularyCoverageCount += outcome.vocabularyCovered ? 1 : 0;
  accumulator.lengths.push(outcome.length);
  accumulator.stopCounts[outcome.stopReason] += 1;
  accumulator.highLevelConstraintViolationCount +=
    outcome.highLevelConstraintViolated ? 1 : 0;
}

function empiricalQuantile(values: number[], probability: number): number {
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.ceil(probability * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
}

function meanMonteCarloStandardError(
  sum: number,
  sumOfSquares: number,
  trials: number
): number {
  if (trials <= 1) return 0;
  const sampleVariance = Math.max(
    0,
    (sumOfSquares - sum ** 2 / trials) / (trials - 1)
  );
  return Math.sqrt(sampleVariance / trials);
}

function rmseMonteCarloStandardError(
  squaredErrorSum: number,
  fourthErrorSum: number,
  trials: number
): number {
  const meanSquaredError = squaredErrorSum / trials;
  if (trials <= 1 || meanSquaredError === 0) return 0;
  const varianceOfSquaredErrors = Math.max(
    0,
    (fourthErrorSum - squaredErrorSum ** 2 / trials) / (trials - 1)
  );
  return (
    Math.sqrt(varianceOfSquaredErrors / trials) /
    (2 * Math.sqrt(meanSquaredError))
  );
}

function summarizeAccumulator(
  accumulator: MetricsAccumulator
): ConditionalSimulationMetrics {
  const trials = accumulator.trials;
  const stopRates = Object.fromEntries(
    STOP_REASONS.map((reason) => [reason, accumulator.stopCounts[reason] / trials])
  ) as Record<StopReason, number>;
  const thetaCoverage = accumulator.thetaCoverageCount / trials;
  const vocabularyCoverage = accumulator.vocabularyCoverageCount / trials;
  const highLevelConstraintViolationRate =
    accumulator.highLevelConstraintViolationCount / trials;
  const lengthSum = accumulator.lengths.reduce(
    (sum, length) => sum + length,
    0
  );
  const lengthSquaredSum = accumulator.lengths.reduce(
    (sum, length) => sum + length ** 2,
    0
  );
  return {
    trueTheta: accumulator.trueTheta,
    trials,
    thetaBias: accumulator.thetaErrorSum / trials,
    thetaRmse: Math.sqrt(accumulator.thetaSquaredErrorSum / trials),
    thetaCoverage,
    meanPosteriorStandardDeviation:
      accumulator.posteriorStandardDeviationSum / trials,
    vocabularyBias: accumulator.vocabularyErrorSum / trials,
    vocabularyRmse: Math.sqrt(
      accumulator.vocabularySquaredErrorSum / trials
    ),
    vocabularyCoverage,
    meanLength: lengthSum / trials,
    lengthP10: empiricalQuantile(accumulator.lengths, 0.1),
    lengthP50: empiricalQuantile(accumulator.lengths, 0.5),
    lengthP90: empiricalQuantile(accumulator.lengths, 0.9),
    stopRates,
    highLevelConstraintViolationRate,
    monteCarloStandardErrors: {
      thetaBias: meanMonteCarloStandardError(
        accumulator.thetaErrorSum,
        accumulator.thetaSquaredErrorSum,
        trials
      ),
      thetaRmse: rmseMonteCarloStandardError(
        accumulator.thetaSquaredErrorSum,
        accumulator.thetaFourthErrorSum,
        trials
      ),
      thetaCoverage: Math.sqrt(
        (thetaCoverage * (1 - thetaCoverage)) / trials
      ),
      vocabularyBias: meanMonteCarloStandardError(
        accumulator.vocabularyErrorSum,
        accumulator.vocabularySquaredErrorSum,
        trials
      ),
      vocabularyRmse: rmseMonteCarloStandardError(
        accumulator.vocabularySquaredErrorSum,
        accumulator.vocabularyFourthErrorSum,
        trials
      ),
      vocabularyCoverage: Math.sqrt(
        (vocabularyCoverage * (1 - vocabularyCoverage)) / trials
      ),
      meanLength: meanMonteCarloStandardError(
        lengthSum,
        lengthSquaredSum,
        trials
      ),
      highLevelConstraintViolationRate: Math.sqrt(
        (highLevelConstraintViolationRate *
          (1 - highLevelConstraintViolationRate)) /
          trials
      ),
    },
  };
}

function validatePlan(itemBank: Item[], plan: SimulationPlan): void {
  if (itemBank.length === 0) {
    throw new RangeError("CAT simulations require a non-empty item bank.");
  }
  if (plan.planId.trim().length === 0) {
    throw new RangeError("Simulation plans require a non-empty planId.");
  }
  if (!Number.isSafeInteger(plan.seed) || plan.seed < 0) {
    throw new RangeError("seed must be a non-negative safe integer.");
  }
  if (
    !Number.isInteger(plan.replicationsPerTheta) ||
    plan.replicationsPerTheta < 1
  ) {
    throw new RangeError("replicationsPerTheta must be a positive integer.");
  }
  if (plan.trueThetas.length === 0 || plan.rules.length === 0) {
    throw new RangeError("Simulation plans require theta conditions and rules.");
  }
  if (
    plan.trueThetas.some(
      (theta) =>
        !Number.isFinite(theta) ||
        theta < PAPER_3PL_CONFIG.thetaGrid.min ||
        theta > PAPER_3PL_CONFIG.thetaGrid.max
    )
  ) {
    throw new RangeError("trueThetas must be finite and within the theta grid.");
  }
  if (
    !Number.isFinite(plan.credibleMass) ||
    plan.credibleMass <= 0 ||
    plan.credibleMass >= 1
  ) {
    throw new RangeError("credibleMass must be strictly between zero and one.");
  }
  if (
    !Number.isInteger(plan.initialLevelMinimum) ||
    !Number.isInteger(plan.initialLevelMaximum) ||
    plan.initialLevelMinimum > plan.initialLevelMaximum ||
    !Number.isInteger(plan.highLevelFloor) ||
    !Number.isInteger(plan.minimumHighLevelItems) ||
    plan.minimumHighLevelItems < 0
  ) {
    throw new RangeError("Invalid content-constraint settings.");
  }
  const eligibleInitialItems = itemBank.filter(
    (item) =>
      item.Level >= plan.initialLevelMinimum &&
      item.Level <= plan.initialLevelMaximum
  ).length;
  const eligibleHighItems = itemBank.filter(
    (item) => item.Level >= plan.highLevelFloor
  ).length;
  if (
    eligibleInitialItems === 0 ||
    eligibleHighItems < plan.minimumHighLevelItems
  ) {
    throw new RangeError("The item bank cannot satisfy the content constraints.");
  }
  const ruleIds = new Set<string>();
  for (const rule of plan.rules) {
    if (rule.id.trim().length === 0) {
      throw new RangeError("Simulation rules require a non-empty id.");
    }
    if (ruleIds.has(rule.id)) {
      throw new RangeError(`Duplicate rule id: ${rule.id}`);
    }
    ruleIds.add(rule.id);
    if (
      !Number.isInteger(rule.minimumItems) ||
      !Number.isInteger(rule.maximumItems) ||
      rule.minimumItems < 1 ||
      rule.minimumItems > rule.maximumItems ||
      rule.maximumItems > itemBank.length
    ) {
      throw new RangeError(`Invalid test lengths for rule ${rule.id}.`);
    }
    if (rule.maximumItems < plan.minimumHighLevelItems) {
      throw new RangeError(
        `Rule ${rule.id} cannot satisfy the high-level item constraint.`
      );
    }
    if (
      rule.targetPosteriorStandardDeviation !== null &&
      (!Number.isFinite(rule.targetPosteriorStandardDeviation) ||
        rule.targetPosteriorStandardDeviation <= 0)
    ) {
      throw new RangeError(`Invalid precision target for rule ${rule.id}.`);
    }
    if (
      rule.targetPosteriorStandardDeviation === null &&
      rule.minimumItems !== rule.maximumItems
    ) {
      throw new RangeError(`Fixed-length rule ${rule.id} requires equal lengths.`);
    }
    if (
      rule.selectionMethod !== "maximum-information" &&
      rule.selectionMethod !== "randomesque"
    ) {
      throw new RangeError(`Invalid selection method for rule ${rule.id}.`);
    }
    if (
      rule.selectionMethod === "randomesque" &&
      (!Number.isInteger(rule.randomesqueSize) ||
        (rule.randomesqueSize ?? 0) < 1)
    ) {
      throw new RangeError(`Invalid randomesque size for rule ${rule.id}.`);
    }
  }
}

export function runCatSimulation(
  itemBank: Item[],
  itemBankSha256: string,
  plan: SimulationPlan,
  planSha256: string | null = null,
  provenance: SimulationProvenance | null = null
): CatSimulationReport {
  validatePlan(itemBank, plan);
  const cache = buildModelCache(itemBank);
  const results = plan.rules.map((rule) => {
    const exposureCounts = new Uint32Array(itemBank.length);
    const overallAccumulator = createAccumulator(null);
    const conditional = plan.trueThetas.map((trueTheta, thetaIndex) => {
      const accumulator = createAccumulator(trueTheta);
      for (
        let replication = 0;
        replication < plan.replicationsPerTheta;
        replication += 1
      ) {
        const responseRandom = createDeterministicRandom(
          deriveSeed(plan.seed, thetaIndex, replication, 0x52)
        );
        const selectionRandom = createDeterministicRandom(
          deriveSeed(plan.seed, thetaIndex, replication, 0x53)
        );
        const outcome = simulateTrial(
          itemBank,
          cache,
          plan,
          rule,
          trueTheta,
          responseRandom,
          selectionRandom,
          exposureCounts
        );
        addOutcome(accumulator, outcome);
        addOutcome(overallAccumulator, outcome);
      }
      return summarizeAccumulator(accumulator);
    });

    const totalTrials = overallAccumulator.trials;
    const rankedExposure = Array.from(exposureCounts, (count, itemIndex) => ({
      itemIndex,
      level: itemBank[itemIndex].Level,
      administrations: count,
      exposureRate: count / totalTrials,
    })).sort(
      (left, right) =>
        right.exposureRate - left.exposureRate || left.itemIndex - right.itemIndex
    );
    const exposure: ExposureMetrics = {
      maximumExposureRate: rankedExposure[0].exposureRate,
      unusedItemRate:
        rankedExposure.filter((item) => item.administrations === 0).length /
        itemBank.length,
      topExposedItems: rankedExposure.slice(0, 10),
    };
    return {
      rule: { ...rule },
      overall: summarizeAccumulator(overallAccumulator),
      conditional,
      exposure,
    };
  });

  return {
    schemaVersion: "cat-simulation-v1",
    engineId: "cat-eap-3pl-monte-carlo-v1",
    randomGeneratorId: "mulberry32-v1",
    scoreModelId: PAPER_3PL_CONFIG.scoreModelId,
    itemBankSha256,
    planSha256,
    provenance:
      provenance === null
        ? null
        : {
            ...provenance,
            sourceSha256: { ...provenance.sourceSha256 },
          },
    plan: {
      ...plan,
      trueThetas: [...plan.trueThetas],
      rules: plan.rules.map((rule) => ({ ...rule })),
    },
    results,
  };
}
