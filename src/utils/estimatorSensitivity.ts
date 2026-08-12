import type { Item } from "../types";
import {
  estimateAbilityCandidates,
  EXPLORATORY_ABILITY_ESTIMATORS,
  type AbilityEstimatorMethod,
  type AbilityEstimatorSpecification,
} from "./abilityEstimators.ts";
import {
  PAPER_3PL_CONFIG,
  paperItemInformation3pl,
  paperProbability3pl,
} from "./paperScoring.ts";

export type SensitivitySelectionMethod = "maximum-information" | "randomesque";

export interface SensitivityPathRule {
  id: string;
  fixedLength: number;
  selectionMethod: SensitivitySelectionMethod;
  randomesqueSize?: number;
}

export interface EstimatorSensitivityPlan {
  planId: string;
  seed: number;
  replicationsPerTheta: number;
  trueThetas: number[];
  pathRules: SensitivityPathRule[];
  initialLevelMinimum: number;
  initialLevelMaximum: number;
  highLevelFloor: number;
  minimumHighLevelItems: number;
}

export interface EstimatorSensitivityProvenance {
  nodeVersion: string;
  platform: string;
  architecture: string;
  sourceSha256: Record<string, string>;
}

export interface EstimatorConditionalMetrics {
  trueTheta: number;
  trials: number;
  meanEstimate: number;
  thetaBias: number;
  thetaRmse: number;
  boundaryRate: number;
  posteriorCoverage95: number | null;
  meanPosteriorStandardDeviation: number | null;
  meanLocalInformationEquivalentStandardDeviation: number | null;
  monteCarloStandardErrors: {
    thetaBias: number;
    thetaRmse: number;
    boundaryRate: number;
    posteriorCoverage95: number | null;
  };
}

export interface EstimatorSensitivitySummary {
  worstAbsoluteConditionalBias: number;
  maximumConditionalRmse: number;
  maximumBoundaryRate: number;
  minimumPosteriorCoverage95: number | null;
}

export interface SensitivityExposureMetrics {
  maximumExposureRate: number;
  unusedItemRate: number;
  topExposedItems: Array<{
    itemIndex: number;
    level: number;
    administrations: number;
    exposureRate: number;
  }>;
}

export interface EstimatorPathResult {
  pathRule: SensitivityPathRule;
  exposure: SensitivityExposureMetrics;
  estimators: Array<{
    specification: AbilityEstimatorSpecification;
    summary: EstimatorSensitivitySummary;
    conditional: EstimatorConditionalMetrics[];
  }>;
}

export interface EstimatorSensitivityReport {
  schemaVersion: "estimator-sensitivity-v1";
  engineId: "common-path-estimator-sensitivity-v1";
  randomGeneratorId: "mulberry32-v1";
  scoreModelId: string;
  comparisonScale: "theta";
  commonRandomNumbers: true;
  itemBankSha256: string;
  planSha256: string | null;
  provenance: EstimatorSensitivityProvenance | null;
  plan: EstimatorSensitivityPlan;
  estimatorSpecifications: AbilityEstimatorSpecification[];
  results: EstimatorPathResult[];
}

interface PathCache {
  grid: number[];
  priorWeights: Float64Array;
  probabilities: Float64Array[];
}

interface MetricsAccumulator {
  trueTheta: number;
  trials: number;
  estimateSum: number;
  errorSum: number;
  squaredErrorSum: number;
  fourthErrorSum: number;
  boundaryCount: number;
  posteriorCoverageCount: number;
  posteriorCoverageTrials: number;
  posteriorStandardDeviationSum: number;
  posteriorStandardDeviationTrials: number;
  localInformationStandardDeviationSum: number;
  localInformationStandardDeviationTrials: number;
}

function createDeterministicRandom(seed: number): () => number {
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

function buildCache(itemBank: Item[]): PathCache {
  const { min, max, step } = PAPER_3PL_CONFIG.thetaGrid;
  const size = Math.round((max - min) / step) + 1;
  const grid = Array.from({ length: size }, (_, index) => min + index * step);
  const priorWeights = Float64Array.from(grid, (theta) =>
    Math.exp(-0.5 * theta ** 2)
  );
  normalizeWeights(priorWeights);
  const probabilities = itemBank.map((item) =>
    Float64Array.from(grid, (theta) => paperProbability3pl(theta, item))
  );
  return { grid, priorWeights, probabilities };
}

function normalizeWeights(weights: Float64Array): void {
  let total = 0;
  for (const weight of weights) total += weight;
  if (!Number.isFinite(total) || total <= 0) {
    throw new RangeError("Path-selection posterior cannot be normalized.");
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

function posteriorMean(grid: readonly number[], weights: Float64Array): number {
  let mean = 0;
  for (let index = 0; index < grid.length; index += 1) {
    mean += grid[index] * weights[index];
  }
  return mean;
}

function chooseInitialItem(
  itemBank: Item[],
  plan: EstimatorSensitivityPlan,
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
  plan: EstimatorSensitivityPlan,
  rule: SensitivityPathRule,
  random: () => number
): number {
  let candidates = itemBank
    .map((_, index) => index)
    .filter((index) => administered[index] === 0);
  if (needHigh) {
    const highCandidates = candidates.filter(
      (index) => itemBank[index].Level >= plan.highLevelFloor
    );
    if (highCandidates.length > 0) candidates = highCandidates;
  }
  if (candidates.length === 0) {
    throw new RangeError("The item bank was exhausted before fixed length.");
  }
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

function generateCommonPath(
  itemBank: Item[],
  cache: PathCache,
  plan: EstimatorSensitivityPlan,
  rule: SensitivityPathRule,
  trueTheta: number,
  responseRandom: () => number,
  selectionRandom: () => number,
  exposureCounts: Uint32Array
): { administered: number[]; responses: Array<0 | 1> } {
  const weights = new Float64Array(cache.priorWeights);
  const used = new Uint8Array(itemBank.length);
  const administered: number[] = [];
  const responses: Array<0 | 1> = [];
  let highLevelItems = 0;
  let nextItem = chooseInitialItem(itemBank, plan, selectionRandom);

  while (administered.length < rule.fixedLength) {
    const item = itemBank[nextItem];
    const response: 0 | 1 =
      responseRandom() < paperProbability3pl(trueTheta, item) ? 1 : 0;
    administered.push(nextItem);
    responses.push(response);
    used[nextItem] = 1;
    exposureCounts[nextItem] += 1;
    if (item.Level >= plan.highLevelFloor) highLevelItems += 1;
    updatePosterior(weights, cache.probabilities[nextItem], response);
    if (administered.length === rule.fixedLength) break;
    nextItem = chooseNextItem(
      itemBank,
      posteriorMean(cache.grid, weights),
      used,
      highLevelItems < plan.minimumHighLevelItems,
      plan,
      rule,
      selectionRandom
    );
  }
  if (highLevelItems < plan.minimumHighLevelItems) {
    throw new RangeError("Generated path violates the high-level item constraint.");
  }
  return { administered, responses };
}

function createAccumulator(trueTheta: number): MetricsAccumulator {
  return {
    trueTheta,
    trials: 0,
    estimateSum: 0,
    errorSum: 0,
    squaredErrorSum: 0,
    fourthErrorSum: 0,
    boundaryCount: 0,
    posteriorCoverageCount: 0,
    posteriorCoverageTrials: 0,
    posteriorStandardDeviationSum: 0,
    posteriorStandardDeviationTrials: 0,
    localInformationStandardDeviationSum: 0,
    localInformationStandardDeviationTrials: 0,
  };
}

function addEstimate(
  accumulator: MetricsAccumulator,
  estimate: ReturnType<typeof estimateAbilityCandidates>[number]
): void {
  const error = estimate.theta - accumulator.trueTheta;
  accumulator.trials += 1;
  accumulator.estimateSum += estimate.theta;
  accumulator.errorSum += error;
  accumulator.squaredErrorSum += error ** 2;
  accumulator.fourthErrorSum += error ** 4;
  accumulator.boundaryCount += estimate.boundaryHit ? 1 : 0;
  if (estimate.posteriorCredibleInterval95 !== null) {
    accumulator.posteriorCoverageTrials += 1;
    accumulator.posteriorCoverageCount +=
      estimate.posteriorCredibleInterval95.lower <= accumulator.trueTheta &&
      accumulator.trueTheta <= estimate.posteriorCredibleInterval95.upper
        ? 1
        : 0;
  }
  if (estimate.posteriorStandardDeviation !== null) {
    accumulator.posteriorStandardDeviationSum +=
      estimate.posteriorStandardDeviation;
    accumulator.posteriorStandardDeviationTrials += 1;
  }
  if (estimate.localInformationEquivalentStandardDeviation !== null) {
    accumulator.localInformationStandardDeviationSum +=
      estimate.localInformationEquivalentStandardDeviation;
    accumulator.localInformationStandardDeviationTrials += 1;
  }
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

function binomialMonteCarloStandardError(rate: number, trials: number): number {
  return Math.sqrt((rate * (1 - rate)) / trials);
}

function summarizeAccumulator(
  accumulator: MetricsAccumulator
): EstimatorConditionalMetrics {
  const { trials } = accumulator;
  const boundaryRate = accumulator.boundaryCount / trials;
  const posteriorCoverage95 =
    accumulator.posteriorCoverageTrials > 0
      ? accumulator.posteriorCoverageCount / accumulator.posteriorCoverageTrials
      : null;
  return {
    trueTheta: accumulator.trueTheta,
    trials,
    meanEstimate: accumulator.estimateSum / trials,
    thetaBias: accumulator.errorSum / trials,
    thetaRmse: Math.sqrt(accumulator.squaredErrorSum / trials),
    boundaryRate,
    posteriorCoverage95,
    meanPosteriorStandardDeviation:
      accumulator.posteriorStandardDeviationTrials > 0
        ? accumulator.posteriorStandardDeviationSum /
          accumulator.posteriorStandardDeviationTrials
        : null,
    meanLocalInformationEquivalentStandardDeviation:
      accumulator.localInformationStandardDeviationTrials > 0
        ? accumulator.localInformationStandardDeviationSum /
          accumulator.localInformationStandardDeviationTrials
        : null,
    monteCarloStandardErrors: {
      thetaBias: meanMonteCarloStandardError(
        accumulator.errorSum,
        accumulator.squaredErrorSum,
        trials
      ),
      thetaRmse: rmseMonteCarloStandardError(
        accumulator.squaredErrorSum,
        accumulator.fourthErrorSum,
        trials
      ),
      boundaryRate: binomialMonteCarloStandardError(boundaryRate, trials),
      posteriorCoverage95:
        posteriorCoverage95 === null
          ? null
          : binomialMonteCarloStandardError(
              posteriorCoverage95,
              accumulator.posteriorCoverageTrials
            ),
    },
  };
}

function summarizeEstimator(
  conditional: EstimatorConditionalMetrics[]
): EstimatorSensitivitySummary {
  const coverages = conditional
    .map(({ posteriorCoverage95 }) => posteriorCoverage95)
    .filter((coverage): coverage is number => coverage !== null);
  return {
    worstAbsoluteConditionalBias: Math.max(
      ...conditional.map(({ thetaBias }) => Math.abs(thetaBias))
    ),
    maximumConditionalRmse: Math.max(
      ...conditional.map(({ thetaRmse }) => thetaRmse)
    ),
    maximumBoundaryRate: Math.max(
      ...conditional.map(({ boundaryRate }) => boundaryRate)
    ),
    minimumPosteriorCoverage95:
      coverages.length > 0 ? Math.min(...coverages) : null,
  };
}

function summarizeExposure(
  itemBank: Item[],
  exposureCounts: Uint32Array,
  totalTrials: number
): SensitivityExposureMetrics {
  const ranked = Array.from(exposureCounts, (administrations, itemIndex) => ({
    itemIndex,
    level: itemBank[itemIndex].Level,
    administrations,
    exposureRate: administrations / totalTrials,
  })).sort(
    (left, right) =>
      right.exposureRate - left.exposureRate || left.itemIndex - right.itemIndex
  );
  return {
    maximumExposureRate: ranked[0].exposureRate,
    unusedItemRate:
      ranked.filter(({ administrations }) => administrations === 0).length /
      itemBank.length,
    topExposedItems: ranked.slice(0, 10),
  };
}

function validatePlan(itemBank: Item[], plan: EstimatorSensitivityPlan): void {
  if (itemBank.length === 0 || plan.planId.trim().length === 0) {
    throw new RangeError("Sensitivity simulations require a bank and plan ID.");
  }
  if (!Number.isSafeInteger(plan.seed) || plan.seed < 0) {
    throw new RangeError("seed must be a non-negative safe integer.");
  }
  if (
    !Number.isInteger(plan.replicationsPerTheta) ||
    plan.replicationsPerTheta < 1 ||
    plan.trueThetas.length === 0 ||
    plan.pathRules.length === 0
  ) {
    throw new RangeError("Sensitivity plans require replications, theta, and paths.");
  }
  if (
    plan.trueThetas.some(
      (theta) =>
        !Number.isFinite(theta) ||
        theta < PAPER_3PL_CONFIG.thetaGrid.min ||
        theta > PAPER_3PL_CONFIG.thetaGrid.max
    ) ||
    new Set(plan.trueThetas).size !== plan.trueThetas.length
  ) {
    throw new RangeError("trueThetas must be unique and within the theta grid.");
  }
  if (
    !Number.isInteger(plan.initialLevelMinimum) ||
    !Number.isInteger(plan.initialLevelMaximum) ||
    plan.initialLevelMinimum > plan.initialLevelMaximum ||
    !Number.isInteger(plan.highLevelFloor) ||
    !Number.isInteger(plan.minimumHighLevelItems) ||
    plan.minimumHighLevelItems < 0
  ) {
    throw new RangeError("Invalid content constraints.");
  }
  if (
    !itemBank.some(
      (item) =>
        item.Level >= plan.initialLevelMinimum &&
        item.Level <= plan.initialLevelMaximum
    ) ||
    itemBank.filter((item) => item.Level >= plan.highLevelFloor).length <
      plan.minimumHighLevelItems
  ) {
    throw new RangeError("The item bank cannot satisfy content constraints.");
  }
  const ids = new Set<string>();
  for (const rule of plan.pathRules) {
    if (rule.id.trim().length === 0 || ids.has(rule.id)) {
      throw new RangeError("Path rule IDs must be non-empty and unique.");
    }
    ids.add(rule.id);
    if (
      !Number.isInteger(rule.fixedLength) ||
      rule.fixedLength < plan.minimumHighLevelItems ||
      rule.fixedLength > itemBank.length
    ) {
      throw new RangeError(`Invalid fixed length for ${rule.id}.`);
    }
    if (
      rule.selectionMethod !== "maximum-information" &&
      rule.selectionMethod !== "randomesque"
    ) {
      throw new RangeError(`Invalid selection method for ${rule.id}.`);
    }
    if (
      rule.selectionMethod === "randomesque" &&
      (!Number.isInteger(rule.randomesqueSize) ||
        (rule.randomesqueSize ?? 0) < 1)
    ) {
      throw new RangeError(`Invalid randomesque size for ${rule.id}.`);
    }
  }
}

function cloneSpecification(
  specification: AbilityEstimatorSpecification
): AbilityEstimatorSpecification {
  return specification.prior === undefined
    ? {
        estimatorId: specification.estimatorId,
        method: specification.method,
      }
    : { ...specification, prior: { ...specification.prior } };
}

export function runEstimatorSensitivity(
  itemBank: Item[],
  itemBankSha256: string,
  plan: EstimatorSensitivityPlan,
  planSha256: string | null = null,
  provenance: EstimatorSensitivityProvenance | null = null,
  specifications: readonly AbilityEstimatorSpecification[] =
    EXPLORATORY_ABILITY_ESTIMATORS
): EstimatorSensitivityReport {
  validatePlan(itemBank, plan);
  const cache = buildCache(itemBank);
  const results = plan.pathRules.map((pathRule) => {
    const exposureCounts = new Uint32Array(itemBank.length);
    const accumulators = new Map<
      string,
      Map<number, MetricsAccumulator>
    >(
      specifications.map((specification) => [
        specification.estimatorId,
        new Map(
          plan.trueThetas.map((trueTheta) => [
            trueTheta,
            createAccumulator(trueTheta),
          ])
        ),
      ])
    );

    for (let thetaIndex = 0; thetaIndex < plan.trueThetas.length; thetaIndex += 1) {
      const trueTheta = plan.trueThetas[thetaIndex];
      for (
        let replication = 0;
        replication < plan.replicationsPerTheta;
        replication += 1
      ) {
        const path = generateCommonPath(
          itemBank,
          cache,
          plan,
          pathRule,
          trueTheta,
          createDeterministicRandom(
            deriveSeed(plan.seed, thetaIndex, replication, 0x52)
          ),
          createDeterministicRandom(
            deriveSeed(plan.seed, thetaIndex, replication, 0x53)
          ),
          exposureCounts
        );
        const estimates = estimateAbilityCandidates(
          itemBank,
          path.administered,
          path.responses,
          specifications
        );
        for (const estimate of estimates) {
          const accumulator = accumulators
            .get(estimate.estimatorId)
            ?.get(trueTheta);
          if (accumulator === undefined) {
            throw new RangeError(`Missing accumulator for ${estimate.estimatorId}.`);
          }
          addEstimate(accumulator, estimate);
        }
      }
    }

    const estimators = specifications.map((specification) => {
      const byTheta = accumulators.get(specification.estimatorId);
      if (byTheta === undefined) {
        throw new RangeError(`Missing estimator ${specification.estimatorId}.`);
      }
      const conditional = plan.trueThetas.map((trueTheta) => {
        const accumulator = byTheta.get(trueTheta);
        if (accumulator === undefined) {
          throw new RangeError(`Missing theta condition ${trueTheta}.`);
        }
        return summarizeAccumulator(accumulator);
      });
      return {
        specification: cloneSpecification(specification),
        summary: summarizeEstimator(conditional),
        conditional,
      };
    });
    const totalTrials = plan.trueThetas.length * plan.replicationsPerTheta;
    return {
      pathRule: { ...pathRule },
      exposure: summarizeExposure(itemBank, exposureCounts, totalTrials),
      estimators,
    };
  });

  return {
    schemaVersion: "estimator-sensitivity-v1",
    engineId: "common-path-estimator-sensitivity-v1",
    randomGeneratorId: "mulberry32-v1",
    scoreModelId: PAPER_3PL_CONFIG.scoreModelId,
    comparisonScale: "theta",
    commonRandomNumbers: true,
    itemBankSha256,
    planSha256,
    provenance:
      provenance === null
        ? null
        : { ...provenance, sourceSha256: { ...provenance.sourceSha256 } },
    plan: {
      ...plan,
      trueThetas: [...plan.trueThetas],
      pathRules: plan.pathRules.map((rule) => ({ ...rule })),
    },
    estimatorSpecifications: specifications.map(cloneSpecification),
    results,
  };
}

export function estimatorMethodLabel(method: AbilityEstimatorMethod): string {
  return method === "WARM_WLE" ? "Warm WLE" : method;
}
