import type { Item } from "../types";
import {
  estimateAbilityCandidates,
  EXPLORATORY_ABILITY_ESTIMATORS,
  type AbilityEstimatorResult,
  type AbilityEstimatorSpecification,
} from "./abilityEstimators.ts";
import {
  PAPER_3PL_CONFIG,
  paperItemInformation3pl,
  paperProbability3pl,
} from "./paperScoring.ts";
import {
  sympsonHetterAccepts,
  updateSympsonHetterParameters,
} from "./sympsonHetter.ts";

export interface LevelBandConstraint {
  id: string;
  levels: number[];
  minimumItems: number;
}

export interface ExposureDesign {
  id: string;
  fixedLength: number;
  targetMaximumExposure: number;
  levelBands: LevelBandConstraint[];
}

export interface ExposureSimulationPlan {
  planId: string;
  seed: number;
  calibrationCycles: number;
  calibrationReplicationsPerTheta: number;
  evaluationReplicationsPerTheta: number;
  trueThetas: number[];
  initialLevelMinimum: number;
  initialLevelMaximum: number;
  estimatorIds: string[];
  designs: ExposureDesign[];
}

export interface ExposureSimulationProvenance {
  nodeVersion: string;
  platform: string;
  architecture: string;
  sourceSha256: Record<string, string>;
}

export interface ExposureCalibrationCycle {
  cycle: number;
  maximumExposureRate: number;
  itemsAboveTarget: number;
  maximumSelectionRate: number;
  minimumAdministrationParameterBefore: number;
  minimumAdministrationParameterAfter: number;
  meanRejectionsPerTest: number;
  forcedFallbackRate: number;
}

export interface ExposureMetrics {
  maximumExposureRate: number;
  maximumExposureItemIndex: number;
  itemsAboveTarget: number;
  unusedItemRate: number;
  expectedPairwiseOverlapFromMarginals: number;
  expectedPairwiseOverlapRateFromMarginals: number;
  maximumConditionalExposureRate: number;
  maximumConditionalExposureItemIndex: number;
  maximumConditionalExposureTheta: number;
  topExposedItems: Array<{
    itemIndex: number;
    level: number;
    administrations: number;
    exposureRate: number;
  }>;
}

export interface BlueprintMetrics {
  violationRate: number;
  meanItemsByBand: Record<string, number>;
}

export interface ConditionalEstimatorMetrics {
  trueTheta: number;
  trials: number;
  thetaBias: number;
  thetaRmse: number;
  boundaryRate: number;
  posteriorCoverage95: number | null;
  monteCarloStandardErrors: {
    thetaBias: number;
    thetaRmse: number;
    boundaryRate: number;
    posteriorCoverage95: number | null;
  };
}

export interface ExposureDesignResult {
  design: ExposureDesign;
  calibration: {
    cycles: ExposureCalibrationCycle[];
    administrationParameters: number[];
  };
  evaluation: {
    exposure: ExposureMetrics;
    blueprint: BlueprintMetrics;
    meanRejectionsPerTest: number;
    forcedFallbackRate: number;
    estimators: Array<{
      specification: AbilityEstimatorSpecification;
      worstAbsoluteConditionalBias: number;
      maximumConditionalRmse: number;
      maximumBoundaryRate: number;
      minimumPosteriorCoverage95: number | null;
      conditional: ConditionalEstimatorMetrics[];
    }>;
  };
}

export interface ExposureSimulationReport {
  schemaVersion: "exposure-simulation-v1";
  engineId: "sympson-hetter-blueprint-v1";
  randomGeneratorId: "mulberry32-v1";
  scoreModelId: string;
  exposureMethod: "unconditional-sympson-hetter";
  itemBankSha256: string;
  planSha256: string | null;
  provenance: ExposureSimulationProvenance | null;
  plan: ExposureSimulationPlan;
  results: ExposureDesignResult[];
}

interface PathCache {
  grid: number[];
  priorWeights: Float64Array;
  probabilities: Float64Array[];
}

interface GeneratedPath {
  administered: number[];
  responses: Array<0 | 1>;
  rejections: number;
  forcedFallback: boolean;
  bandCounts: number[];
}

interface PathCounters {
  selectionCounts: Uint32Array;
  administrationCounts: Uint32Array;
  rejections: number;
  forcedFallbacks: number;
  tests: number;
}

interface EstimatorAccumulator {
  trueTheta: number;
  trials: number;
  errorSum: number;
  squaredErrorSum: number;
  fourthErrorSum: number;
  boundaryCount: number;
  coverageCount: number;
  coverageTrials: number;
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

function deriveSeed(baseSeed: number, values: number[]): number {
  let hash = (baseSeed ^ 0x811c9dc5) >>> 0;
  for (const value of values) {
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
    throw new RangeError("Exposure-simulation posterior cannot be normalized.");
  }
  for (let index = 0; index < weights.length; index += 1) {
    weights[index] /= total;
  }
}

function updatePosterior(
  weights: Float64Array,
  probabilities: Float64Array,
  response: 0 | 1
): void {
  for (let index = 0; index < weights.length; index += 1) {
    const probability = probabilities[index];
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

function shuffled(values: number[], random: () => number): number[] {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function bandIndexForLevel(design: ExposureDesign, level: number): number {
  return design.levelBands.findIndex((band) => band.levels.includes(level));
}

function orderedCandidates(
  itemBank: Item[],
  design: ExposureDesign,
  theta: number,
  blocked: Uint8Array,
  bandCounts: number[],
  administeredLength: number,
  initialLevelMinimum: number,
  initialLevelMaximum: number,
  selectionRandom: () => number
): number[] {
  let candidates = itemBank
    .map((_, index) => index)
    .filter((index) => blocked[index] === 0);
  if (administeredLength === 0) {
    const initial = candidates.filter(
      (index) =>
        itemBank[index].Level >= initialLevelMinimum &&
        itemBank[index].Level <= initialLevelMaximum
    );
    if (initial.length > 0) return shuffled(initial, selectionRandom);
  }
  const remainingSlots = design.fixedLength - administeredLength;
  const deficits = design.levelBands.map((band, index) =>
    Math.max(0, band.minimumItems - bandCounts[index])
  );
  const totalDeficit = deficits.reduce((sum, deficit) => sum + deficit, 0);
  if (remainingSlots <= totalDeficit && totalDeficit > 0) {
    const urgent = candidates.filter((index) => {
      const bandIndex = bandIndexForLevel(design, itemBank[index].Level);
      return bandIndex >= 0 && deficits[bandIndex] > 0;
    });
    if (urgent.length > 0) candidates = urgent;
  }
  return candidates
    .map((index) => ({
      index,
      information: paperItemInformation3pl(theta, itemBank[index]),
    }))
    .sort(
      (left, right) =>
        right.information - left.information || left.index - right.index
    )
    .map(({ index }) => index);
}

function selectWithExposureControl(
  ordered: number[],
  blocked: Uint8Array,
  administrationParameters: readonly number[],
  exposureRandom: () => number,
  selectionCounts: Uint32Array
): { itemIndex: number; rejections: number; forcedFallback: boolean } {
  if (ordered.length === 0) {
    throw new RangeError("No item remains eligible for administration.");
  }
  let rejections = 0;
  for (const itemIndex of ordered) {
    selectionCounts[itemIndex] += 1;
    blocked[itemIndex] = 1;
    if (
      sympsonHetterAccepts(
        administrationParameters[itemIndex],
        exposureRandom()
      )
    ) {
      return { itemIndex, rejections, forcedFallback: false };
    }
    rejections += 1;
  }
  return {
    itemIndex: ordered[ordered.length - 1],
    rejections,
    forcedFallback: true,
  };
}

function generatePath(
  itemBank: Item[],
  cache: PathCache,
  plan: ExposureSimulationPlan,
  design: ExposureDesign,
  trueTheta: number,
  administrationParameters: readonly number[],
  responseRandom: () => number,
  selectionRandom: () => number,
  exposureRandom: () => number,
  counters: PathCounters
): GeneratedPath {
  const weights = new Float64Array(cache.priorWeights);
  const blocked = new Uint8Array(itemBank.length);
  const administered: number[] = [];
  const responses: Array<0 | 1> = [];
  const bandCounts = design.levelBands.map(() => 0);
  let rejections = 0;
  let forcedFallback = false;

  while (administered.length < design.fixedLength) {
    const ordered = orderedCandidates(
      itemBank,
      design,
      posteriorMean(cache.grid, weights),
      blocked,
      bandCounts,
      administered.length,
      plan.initialLevelMinimum,
      plan.initialLevelMaximum,
      selectionRandom
    );
    const selected = selectWithExposureControl(
      ordered,
      blocked,
      administrationParameters,
      exposureRandom,
      counters.selectionCounts
    );
    const item = itemBank[selected.itemIndex];
    const response: 0 | 1 =
      responseRandom() < paperProbability3pl(trueTheta, item) ? 1 : 0;
    administered.push(selected.itemIndex);
    responses.push(response);
    counters.administrationCounts[selected.itemIndex] += 1;
    rejections += selected.rejections;
    forcedFallback ||= selected.forcedFallback;
    const bandIndex = bandIndexForLevel(design, item.Level);
    if (bandIndex >= 0) bandCounts[bandIndex] += 1;
    updatePosterior(weights, cache.probabilities[selected.itemIndex], response);
  }
  counters.rejections += rejections;
  counters.forcedFallbacks += forcedFallback ? 1 : 0;
  counters.tests += 1;
  return { administered, responses, rejections, forcedFallback, bandCounts };
}

function createCounters(itemCount: number): PathCounters {
  return {
    selectionCounts: new Uint32Array(itemCount),
    administrationCounts: new Uint32Array(itemCount),
    rejections: 0,
    forcedFallbacks: 0,
    tests: 0,
  };
}

function calibrationCycleSummary(
  cycle: number,
  counters: PathCounters,
  target: number,
  parametersBefore: readonly number[],
  parametersAfter: readonly number[]
): ExposureCalibrationCycle {
  const exposureRates = Array.from(
    counters.administrationCounts,
    (count) => count / counters.tests
  );
  const selectionRates = Array.from(
    counters.selectionCounts,
    (count) => count / counters.tests
  );
  return {
    cycle,
    maximumExposureRate: Math.max(...exposureRates),
    itemsAboveTarget: exposureRates.filter((rate) => rate > target).length,
    maximumSelectionRate: Math.max(...selectionRates),
    minimumAdministrationParameterBefore: Math.min(...parametersBefore),
    minimumAdministrationParameterAfter: Math.min(...parametersAfter),
    meanRejectionsPerTest: counters.rejections / counters.tests,
    forcedFallbackRate: counters.forcedFallbacks / counters.tests,
  };
}

function createEstimatorAccumulator(trueTheta: number): EstimatorAccumulator {
  return {
    trueTheta,
    trials: 0,
    errorSum: 0,
    squaredErrorSum: 0,
    fourthErrorSum: 0,
    boundaryCount: 0,
    coverageCount: 0,
    coverageTrials: 0,
  };
}

function addEstimate(
  accumulator: EstimatorAccumulator,
  estimate: AbilityEstimatorResult
): void {
  const error = estimate.theta - accumulator.trueTheta;
  accumulator.trials += 1;
  accumulator.errorSum += error;
  accumulator.squaredErrorSum += error ** 2;
  accumulator.fourthErrorSum += error ** 4;
  accumulator.boundaryCount += estimate.boundaryHit ? 1 : 0;
  if (estimate.posteriorCredibleInterval95 !== null) {
    accumulator.coverageTrials += 1;
    accumulator.coverageCount +=
      estimate.posteriorCredibleInterval95.lower <= accumulator.trueTheta &&
      accumulator.trueTheta <= estimate.posteriorCredibleInterval95.upper
        ? 1
        : 0;
  }
}

function meanMcse(sum: number, sumSquares: number, trials: number): number {
  if (trials <= 1) return 0;
  const variance = Math.max(
    0,
    (sumSquares - sum ** 2 / trials) / (trials - 1)
  );
  return Math.sqrt(variance / trials);
}

function rmseMcse(sumSquares: number, sumFourth: number, trials: number): number {
  const meanSquared = sumSquares / trials;
  if (trials <= 1 || meanSquared === 0) return 0;
  const variance = Math.max(
    0,
    (sumFourth - sumSquares ** 2 / trials) / (trials - 1)
  );
  return Math.sqrt(variance / trials) / (2 * Math.sqrt(meanSquared));
}

function binomialMcse(rate: number, trials: number): number {
  return Math.sqrt((rate * (1 - rate)) / trials);
}

function summarizeEstimatorAccumulator(
  accumulator: EstimatorAccumulator
): ConditionalEstimatorMetrics {
  const boundaryRate = accumulator.boundaryCount / accumulator.trials;
  const coverage =
    accumulator.coverageTrials > 0
      ? accumulator.coverageCount / accumulator.coverageTrials
      : null;
  return {
    trueTheta: accumulator.trueTheta,
    trials: accumulator.trials,
    thetaBias: accumulator.errorSum / accumulator.trials,
    thetaRmse: Math.sqrt(
      accumulator.squaredErrorSum / accumulator.trials
    ),
    boundaryRate,
    posteriorCoverage95: coverage,
    monteCarloStandardErrors: {
      thetaBias: meanMcse(
        accumulator.errorSum,
        accumulator.squaredErrorSum,
        accumulator.trials
      ),
      thetaRmse: rmseMcse(
        accumulator.squaredErrorSum,
        accumulator.fourthErrorSum,
        accumulator.trials
      ),
      boundaryRate: binomialMcse(boundaryRate, accumulator.trials),
      posteriorCoverage95:
        coverage === null
          ? null
          : binomialMcse(coverage, accumulator.coverageTrials),
    },
  };
}

function summarizeExposure(
  itemBank: Item[],
  counts: Uint32Array,
  conditionalCounts: Uint32Array[],
  trialsPerTheta: number,
  totalTrials: number,
  design: ExposureDesign
): ExposureMetrics {
  const ranked = Array.from(counts, (administrations, itemIndex) => ({
    itemIndex,
    level: itemBank[itemIndex].Level,
    administrations,
    exposureRate: administrations / totalTrials,
  })).sort(
    (left, right) =>
      right.exposureRate - left.exposureRate || left.itemIndex - right.itemIndex
  );
  let maximumConditionalExposureRate = -1;
  let maximumConditionalExposureItemIndex = -1;
  let maximumConditionalExposureTheta = Number.NaN;
  for (let thetaIndex = 0; thetaIndex < conditionalCounts.length; thetaIndex += 1) {
    for (let itemIndex = 0; itemIndex < itemBank.length; itemIndex += 1) {
      const rate = conditionalCounts[thetaIndex][itemIndex] / trialsPerTheta;
      if (rate > maximumConditionalExposureRate) {
        maximumConditionalExposureRate = rate;
        maximumConditionalExposureItemIndex = itemIndex;
        maximumConditionalExposureTheta = thetaIndex;
      }
    }
  }
  const marginalOverlap = ranked.reduce(
    (sum, { exposureRate }) => sum + exposureRate ** 2,
    0
  );
  return {
    maximumExposureRate: ranked[0].exposureRate,
    maximumExposureItemIndex: ranked[0].itemIndex,
    itemsAboveTarget: ranked.filter(
      ({ exposureRate }) => exposureRate > design.targetMaximumExposure
    ).length,
    unusedItemRate:
      ranked.filter(({ administrations }) => administrations === 0).length /
      itemBank.length,
    expectedPairwiseOverlapFromMarginals: marginalOverlap,
    expectedPairwiseOverlapRateFromMarginals:
      marginalOverlap / design.fixedLength,
    maximumConditionalExposureRate,
    maximumConditionalExposureItemIndex,
    maximumConditionalExposureTheta,
    topExposedItems: ranked.slice(0, 10),
  };
}

function validatePlan(itemBank: Item[], plan: ExposureSimulationPlan): void {
  if (itemBank.length === 0 || plan.planId.trim().length === 0) {
    throw new RangeError("Exposure simulations require a bank and plan ID.");
  }
  if (!Number.isSafeInteger(plan.seed) || plan.seed < 0) {
    throw new RangeError("seed must be a non-negative safe integer.");
  }
  for (const value of [
    plan.calibrationCycles,
    plan.calibrationReplicationsPerTheta,
    plan.evaluationReplicationsPerTheta,
  ]) {
    if (!Number.isInteger(value) || value < 1) {
      throw new RangeError("Simulation counts must be positive integers.");
    }
  }
  if (
    plan.trueThetas.length === 0 ||
    new Set(plan.trueThetas).size !== plan.trueThetas.length ||
    plan.trueThetas.some(
      (theta) =>
        !Number.isFinite(theta) ||
        theta < PAPER_3PL_CONFIG.thetaGrid.min ||
        theta > PAPER_3PL_CONFIG.thetaGrid.max
    )
  ) {
    throw new RangeError("trueThetas must be unique and within the theta grid.");
  }
  if (
    !Number.isInteger(plan.initialLevelMinimum) ||
    !Number.isInteger(plan.initialLevelMaximum) ||
    plan.initialLevelMinimum > plan.initialLevelMaximum
  ) {
    throw new RangeError("Invalid initial-level range.");
  }
  const estimatorIds = new Set(
    EXPLORATORY_ABILITY_ESTIMATORS.map(({ estimatorId }) => estimatorId)
  );
  if (
    plan.estimatorIds.length === 0 ||
    new Set(plan.estimatorIds).size !== plan.estimatorIds.length ||
    plan.estimatorIds.some((id) => !estimatorIds.has(id))
  ) {
    throw new RangeError("Estimator IDs must be unique supported candidates.");
  }
  const designIds = new Set<string>();
  for (const design of plan.designs) {
    if (design.id.trim().length === 0 || designIds.has(design.id)) {
      throw new RangeError("Exposure design IDs must be non-empty and unique.");
    }
    designIds.add(design.id);
    if (
      !Number.isInteger(design.fixedLength) ||
      design.fixedLength < 1 ||
      design.fixedLength > itemBank.length ||
      !Number.isFinite(design.targetMaximumExposure) ||
      design.targetMaximumExposure <= 0 ||
      design.targetMaximumExposure > 1
    ) {
      throw new RangeError(`Invalid exposure settings for ${design.id}.`);
    }
    const usedLevels = new Set<number>();
    let minimumTotal = 0;
    for (const band of design.levelBands) {
      if (
        band.id.trim().length === 0 ||
        band.levels.length === 0 ||
        !Number.isInteger(band.minimumItems) ||
        band.minimumItems < 0 ||
        band.levels.some(
          (level) => !Number.isInteger(level) || level < 1 || level > 8
        )
      ) {
        throw new RangeError(`Invalid level band in ${design.id}.`);
      }
      for (const level of band.levels) {
        if (usedLevels.has(level)) {
          throw new RangeError(`Level bands must be disjoint in ${design.id}.`);
        }
        usedLevels.add(level);
      }
      const eligible = itemBank.filter((item) =>
        band.levels.includes(item.Level)
      ).length;
      if (eligible < band.minimumItems) {
        throw new RangeError(`The bank cannot satisfy ${band.id}.`);
      }
      minimumTotal += band.minimumItems;
    }
    if (minimumTotal > design.fixedLength) {
      throw new RangeError(`Blueprint minima exceed length for ${design.id}.`);
    }
  }
}

function cloneSpecification(
  specification: AbilityEstimatorSpecification
): AbilityEstimatorSpecification {
  return specification.prior === undefined
    ? { estimatorId: specification.estimatorId, method: specification.method }
    : { ...specification, prior: { ...specification.prior } };
}

export function runExposureSimulation(
  itemBank: Item[],
  itemBankSha256: string,
  plan: ExposureSimulationPlan,
  planSha256: string | null = null,
  provenance: ExposureSimulationProvenance | null = null
): ExposureSimulationReport {
  validatePlan(itemBank, plan);
  const cache = buildCache(itemBank);
  const specifications = plan.estimatorIds.map((id) => {
    const specification = EXPLORATORY_ABILITY_ESTIMATORS.find(
      ({ estimatorId }) => estimatorId === id
    );
    if (specification === undefined) throw new RangeError(`Unknown estimator ${id}.`);
    return specification;
  });

  const results = plan.designs.map((design, designIndex) => {
    let parameters = itemBank.map(() => 1);
    const cycles: ExposureCalibrationCycle[] = [];
    for (let cycle = 0; cycle < plan.calibrationCycles; cycle += 1) {
      const counters = createCounters(itemBank.length);
      for (let thetaIndex = 0; thetaIndex < plan.trueThetas.length; thetaIndex += 1) {
        const trueTheta = plan.trueThetas[thetaIndex];
        for (
          let replication = 0;
          replication < plan.calibrationReplicationsPerTheta;
          replication += 1
        ) {
          const prefix = [0x43, designIndex, cycle, thetaIndex, replication];
          generatePath(
            itemBank,
            cache,
            plan,
            design,
            trueTheta,
            parameters,
            createDeterministicRandom(deriveSeed(plan.seed, [...prefix, 0x52])),
            createDeterministicRandom(deriveSeed(plan.seed, [...prefix, 0x53])),
            createDeterministicRandom(deriveSeed(plan.seed, [...prefix, 0x45])),
            counters
          );
        }
      }
      const updated = updateSympsonHetterParameters(
        counters.selectionCounts,
        counters.tests,
        design.targetMaximumExposure
      ).administrationParameters;
      cycles.push(
        calibrationCycleSummary(
          cycle + 1,
          counters,
          design.targetMaximumExposure,
          parameters,
          updated
        )
      );
      parameters = updated;
    }

    const evaluationCounters = createCounters(itemBank.length);
    const conditionalExposureCounts = plan.trueThetas.map(
      () => new Uint32Array(itemBank.length)
    );
    const bandTotals = design.levelBands.map(() => 0);
    let blueprintViolations = 0;
    const accumulatorByEstimator = new Map(
      specifications.map((specification) => [
        specification.estimatorId,
        new Map(
          plan.trueThetas.map((theta) => [theta, createEstimatorAccumulator(theta)])
        ),
      ])
    );

    for (let thetaIndex = 0; thetaIndex < plan.trueThetas.length; thetaIndex += 1) {
      const trueTheta = plan.trueThetas[thetaIndex];
      for (
        let replication = 0;
        replication < plan.evaluationReplicationsPerTheta;
        replication += 1
      ) {
        const prefix = [0x45, designIndex, thetaIndex, replication];
        const path = generatePath(
          itemBank,
          cache,
          plan,
          design,
          trueTheta,
          parameters,
          createDeterministicRandom(deriveSeed(plan.seed, [...prefix, 0x52])),
          createDeterministicRandom(deriveSeed(plan.seed, [...prefix, 0x53])),
          createDeterministicRandom(deriveSeed(plan.seed, [...prefix, 0x45])),
          evaluationCounters
        );
        for (const itemIndex of path.administered) {
          conditionalExposureCounts[thetaIndex][itemIndex] += 1;
        }
        for (let bandIndex = 0; bandIndex < path.bandCounts.length; bandIndex += 1) {
          bandTotals[bandIndex] += path.bandCounts[bandIndex];
        }
        if (
          path.bandCounts.some(
            (count, index) => count < design.levelBands[index].minimumItems
          )
        ) {
          blueprintViolations += 1;
        }
        const estimates = estimateAbilityCandidates(
          itemBank,
          path.administered,
          path.responses,
          specifications
        );
        for (const estimate of estimates) {
          const accumulator = accumulatorByEstimator
            .get(estimate.estimatorId)
            ?.get(trueTheta);
          if (accumulator === undefined) {
            throw new RangeError(`Missing estimator accumulator ${estimate.estimatorId}.`);
          }
          addEstimate(accumulator, estimate);
        }
      }
    }

    const totalTrials = evaluationCounters.tests;
    const estimators = specifications.map((specification) => {
      const conditional = plan.trueThetas.map((theta) => {
        const accumulator = accumulatorByEstimator
          .get(specification.estimatorId)
          ?.get(theta);
        if (accumulator === undefined) throw new RangeError("Missing theta accumulator.");
        return summarizeEstimatorAccumulator(accumulator);
      });
      const coverages = conditional
        .map(({ posteriorCoverage95 }) => posteriorCoverage95)
        .filter((value): value is number => value !== null);
      return {
        specification: cloneSpecification(specification),
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
        conditional,
      };
    });
    const exposure = summarizeExposure(
      itemBank,
      evaluationCounters.administrationCounts,
      conditionalExposureCounts,
      plan.evaluationReplicationsPerTheta,
      totalTrials,
      design
    );
    exposure.maximumConditionalExposureTheta =
      plan.trueThetas[exposure.maximumConditionalExposureTheta];
    return {
      design: {
        ...design,
        levelBands: design.levelBands.map((band) => ({
          ...band,
          levels: [...band.levels],
        })),
      },
      calibration: { cycles, administrationParameters: [...parameters] },
      evaluation: {
        exposure,
        blueprint: {
          violationRate: blueprintViolations / totalTrials,
          meanItemsByBand: Object.fromEntries(
            design.levelBands.map((band, index) => [
              band.id,
              bandTotals[index] / totalTrials,
            ])
          ),
        },
        meanRejectionsPerTest:
          evaluationCounters.rejections / evaluationCounters.tests,
        forcedFallbackRate:
          evaluationCounters.forcedFallbacks / evaluationCounters.tests,
        estimators,
      },
    };
  });

  return {
    schemaVersion: "exposure-simulation-v1",
    engineId: "sympson-hetter-blueprint-v1",
    randomGeneratorId: "mulberry32-v1",
    scoreModelId: PAPER_3PL_CONFIG.scoreModelId,
    exposureMethod: "unconditional-sympson-hetter",
    itemBankSha256,
    planSha256,
    provenance:
      provenance === null
        ? null
        : { ...provenance, sourceSha256: { ...provenance.sourceSha256 } },
    plan: {
      ...plan,
      trueThetas: [...plan.trueThetas],
      estimatorIds: [...plan.estimatorIds],
      designs: plan.designs.map((design) => ({
        ...design,
        levelBands: design.levelBands.map((band) => ({
          ...band,
          levels: [...band.levels],
        })),
      })),
    },
    results,
  };
}
