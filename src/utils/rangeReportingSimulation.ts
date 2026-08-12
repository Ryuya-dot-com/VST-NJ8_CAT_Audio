import type { Item } from "../types";
import {
  deriveInformationSupportRange,
  type InformationSupportRange,
  type MeasurementRangeClassification,
} from "./measurementRange.ts";
import {
  PAPER_3PL_CONFIG,
  computeLevelParameterMeans,
  paperItemInformation3pl,
  paperProbability3pl,
  paperVocabularyAtThetaFromMeans,
} from "./paperScoring.ts";

export interface RangePathRule {
  id: string;
  fixedLength: number;
  selectionMethod: "maximum-information" | "randomesque";
  randomesqueSize?: number;
}

export interface RangePosteriorSpecification {
  id: string;
  priorMean: number;
  priorStandardDeviation: number;
}

export interface RangeReportingDecisionCriteria {
  binomialIntervalMethod: "wilson-score";
  monteCarloZ: number;
  maximumFalseNumericReportRateOutside: number;
  maximumOppositeExtremeRate: number;
  minimumNumericReportRateInterior: number;
  maximumAbsoluteThetaBiasReported: number;
  maximumThetaRmseReported: number;
  minimumIntervalCoverageReported: number;
  maximumIntervalCoverageReported: number;
}

export interface RangeReportingSimulationPlan {
  planId: string;
  seed: number;
  replicationsPerTheta: number;
  trueThetas: number[];
  pathRules: RangePathRule[];
  posteriorSpecifications: RangePosteriorSpecification[];
  selectionPosteriorId: string;
  informationEquivalentStandardDeviationThresholds: number[];
  posteriorMassThresholds: number[];
  boundaryIndifferenceMargin: number;
  credibleMass: number;
  initialLevelMinimum: number;
  initialLevelMaximum: number;
  highLevelFloor: number;
  minimumHighLevelItems: number;
  decisionCriteria: RangeReportingDecisionCriteria;
  candidatePreferenceOrder: string[];
}

export interface RangeReportingProvenance {
  nodeVersion: string;
  platform: string;
  architecture: string;
  sourceSha256: Record<string, string>;
}

export type TrueRangeRegion = "below-range" | "within-range" | "above-range";
export type RangeEvaluationZone =
  | "clearly-outside"
  | "validated-interior"
  | "boundary-indifference";

export interface RateWithMonteCarloError {
  rate: number;
  monteCarloStandardError: number;
}

export interface ScorePerformanceMetrics {
  trials: number;
  thetaBias: number;
  thetaRmse: number;
  thetaCoverage: number;
  vocabularyBias: number;
  vocabularyRmse: number;
  vocabularyCoverage: number;
  meanPosteriorStandardDeviation: number;
  monteCarloStandardErrors: {
    thetaBias: number;
    thetaRmse: number;
    thetaCoverage: number;
    vocabularyBias: number;
    vocabularyRmse: number;
    vocabularyCoverage: number;
  };
}

export interface RangeConditionalMetrics {
  trueTheta: number;
  trueRegion: TrueRangeRegion;
  evaluationZone: RangeEvaluationZone;
  trials: number;
  classificationRates: Record<MeasurementRangeClassification, number>;
  correctClassification: RateWithMonteCarloError;
  decisiveClassification: RateWithMonteCarloError;
  numericReport: RateWithMonteCarloError;
  falseNumericReport: RateWithMonteCarloError | null;
  numericWithholding: RateWithMonteCarloError | null;
  oppositeExtreme: RateWithMonteCarloError;
  allPaths: ScorePerformanceMetrics;
  numericallyReported: ScorePerformanceMetrics | null;
}

export interface RangeCandidateSpecification {
  candidateId: string;
  posteriorSpecification: RangePosteriorSpecification;
  informationEquivalentStandardDeviationThreshold: number;
  posteriorMassThreshold: number;
  range: InformationSupportRange;
}

export interface RangeCandidateSummary {
  passesAllGates: boolean;
  gates: {
    outsideFalseNumericReporting: boolean;
    oppositeExtremeClassification: boolean;
    interiorNumericAvailability: boolean;
    reportedThetaBias: boolean;
    reportedThetaRmse: boolean;
    reportedIntervalCoverage: boolean;
    transformedScoreIntervalCoverage: boolean;
  };
  failedGates: string[];
  evaluatedCells: {
    clearlyOutside: number;
    validatedInterior: number;
    boundaryIndifference: number;
  };
  observed: {
    maximumFalseNumericReportRateOutside: number | null;
    maximumOppositeExtremeRate: number;
    minimumNumericReportRateInterior: number | null;
    maximumAbsoluteReportedThetaBiasInterior: number | null;
    maximumReportedThetaRmseInterior: number | null;
    minimumReportedThetaCoverageInterior: number | null;
    maximumReportedThetaCoverageInterior: number | null;
    minimumReportedVocabularyCoverageInterior: number | null;
    maximumReportedVocabularyCoverageInterior: number | null;
  };
}

export interface RangeExposureMetrics {
  maximumExposureRate: number;
  unusedItemRate: number;
  topExposedItems: Array<{
    itemIndex: number;
    level: number;
    administrations: number;
    exposureRate: number;
  }>;
}

export interface RangePathResult {
  pathRule: RangePathRule;
  exposure: RangeExposureMetrics;
  candidates: Array<{
    specification: RangeCandidateSpecification;
    summary: RangeCandidateSummary;
    conditional: RangeConditionalMetrics[];
  }>;
}

export interface RangeReportingSimulationReport {
  schemaVersion: "range-reporting-simulation-v1";
  engineId: "common-path-posterior-range-v1";
  randomGeneratorId: "mulberry32-v1";
  scoreModelId: string;
  commonResponsePaths: true;
  validationStatus: "exploratory-not-for-score-reporting";
  itemBankSha256: string;
  planSha256: string | null;
  provenance: RangeReportingProvenance | null;
  plan: RangeReportingSimulationPlan;
  informationSupportRanges: InformationSupportRange[];
  results: RangePathResult[];
  selection: {
    passingCandidateIds: string[];
    preferredCandidateId: string | null;
    preferenceOrder: string[];
    productionApproved: false;
    requiredNextEvidence: string;
  };
}

interface ModelCache {
  grid: number[];
  probabilities: Float64Array[];
  priorWeights: Map<string, Float64Array>;
  vocabularyValues: Float64Array;
}

interface PosteriorSummary {
  theta: number;
  standardDeviation: number;
  thetaLower: number;
  thetaUpper: number;
  vocabularyMean: number;
  vocabularyLower: number;
  vocabularyUpper: number;
  rangeProbabilities: Array<{
    below: number;
    within: number;
    above: number;
  }>;
}

interface ScoreAccumulator {
  trials: number;
  thetaErrorSum: number;
  thetaSquaredErrorSum: number;
  thetaFourthErrorSum: number;
  thetaCoverageCount: number;
  vocabularyErrorSum: number;
  vocabularySquaredErrorSum: number;
  vocabularyFourthErrorSum: number;
  vocabularyCoverageCount: number;
  posteriorStandardDeviationSum: number;
}

interface ConditionalAccumulator {
  trueTheta: number;
  trueRegion: TrueRangeRegion;
  evaluationZone: RangeEvaluationZone;
  trials: number;
  classificationCounts: Record<MeasurementRangeClassification, number>;
  correctCount: number;
  decisiveCount: number;
  numericReportCount: number;
  oppositeExtremeCount: number;
  allPaths: ScoreAccumulator;
  numericallyReported: ScoreAccumulator;
}

const CLASSIFICATIONS: MeasurementRangeClassification[] = [
  "below-range",
  "within-range",
  "above-range",
  "indeterminate",
];

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

function normalizeWeights(weights: Float64Array): void {
  let total = 0;
  for (const weight of weights) total += weight;
  if (!Number.isFinite(total) || total <= 0) {
    throw new RangeError("Range-simulation posterior cannot be normalized.");
  }
  for (let index = 0; index < weights.length; index += 1) {
    weights[index] /= total;
  }
}

function buildCache(
  itemBank: Item[],
  posteriorSpecifications: readonly RangePosteriorSpecification[]
): ModelCache {
  const { min, max, step } = PAPER_3PL_CONFIG.thetaGrid;
  const size = Math.round((max - min) / step) + 1;
  const grid = Array.from({ length: size }, (_, index) => min + index * step);
  const probabilities = itemBank.map((item) =>
    Float64Array.from(grid, (theta) => paperProbability3pl(theta, item))
  );
  const priorWeights = new Map<string, Float64Array>();
  for (const specification of posteriorSpecifications) {
    const weights = Float64Array.from(grid, (theta) => {
      const standardized =
        (theta - specification.priorMean) /
        specification.priorStandardDeviation;
      return Math.exp(-0.5 * standardized ** 2);
    });
    normalizeWeights(weights);
    priorWeights.set(specification.id, weights);
  }
  const levelMeans = computeLevelParameterMeans(itemBank);
  const vocabularyValues = Float64Array.from(grid, (theta) =>
    paperVocabularyAtThetaFromMeans(theta, levelMeans)
  );
  return { grid, probabilities, priorWeights, vocabularyValues };
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

function chooseInitialItem(
  itemBank: Item[],
  plan: RangeReportingSimulationPlan,
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
  used: Uint8Array,
  needHigh: boolean,
  plan: RangeReportingSimulationPlan,
  rule: RangePathRule,
  random: () => number
): number {
  let candidates = itemBank
    .map((_, index) => index)
    .filter((index) => used[index] === 0);
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

function generatePathPosteriors(
  itemBank: Item[],
  cache: ModelCache,
  plan: RangeReportingSimulationPlan,
  rule: RangePathRule,
  trueTheta: number,
  responseRandom: () => number,
  selectionRandom: () => number,
  exposureCounts: Uint32Array
): Map<string, Float64Array> {
  const posteriors = new Map<string, Float64Array>();
  for (const specification of plan.posteriorSpecifications) {
    const prior = cache.priorWeights.get(specification.id);
    if (prior === undefined) throw new RangeError(`Missing prior ${specification.id}.`);
    posteriors.set(specification.id, new Float64Array(prior));
  }
  const used = new Uint8Array(itemBank.length);
  let nextItem = chooseInitialItem(itemBank, plan, selectionRandom);
  let highLevelItems = 0;

  for (let length = 0; length < rule.fixedLength; length += 1) {
    const item = itemBank[nextItem];
    const response: 0 | 1 =
      responseRandom() < paperProbability3pl(trueTheta, item) ? 1 : 0;
    used[nextItem] = 1;
    exposureCounts[nextItem] += 1;
    if (item.Level >= plan.highLevelFloor) highLevelItems += 1;
    for (const weights of posteriors.values()) {
      updatePosterior(weights, cache.probabilities[nextItem], response);
    }
    if (length + 1 === rule.fixedLength) break;
    const selectionWeights = posteriors.get(plan.selectionPosteriorId);
    if (selectionWeights === undefined) {
      throw new RangeError("Selection posterior is unavailable.");
    }
    nextItem = chooseNextItem(
      itemBank,
      posteriorMean(cache.grid, selectionWeights),
      used,
      highLevelItems < plan.minimumHighLevelItems,
      plan,
      rule,
      selectionRandom
    );
  }
  if (highLevelItems < plan.minimumHighLevelItems) {
    throw new RangeError("Generated path violates the high-level constraint.");
  }
  return posteriors;
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

function summarizePosterior(
  cache: ModelCache,
  weights: Float64Array,
  ranges: readonly InformationSupportRange[],
  credibleMass: number
): PosteriorSummary {
  let theta = 0;
  let vocabularyMean = 0;
  const rangeProbabilities = ranges.map(() => ({
    below: 0,
    within: 0,
    above: 0,
  }));
  for (let index = 0; index < weights.length; index += 1) {
    const weight = weights[index];
    const gridTheta = cache.grid[index];
    theta += gridTheta * weight;
    vocabularyMean += cache.vocabularyValues[index] * weight;
    for (let rangeIndex = 0; rangeIndex < ranges.length; rangeIndex += 1) {
      const range = ranges[rangeIndex];
      if (gridTheta < range.lowerTheta) {
        rangeProbabilities[rangeIndex].below += weight;
      } else if (gridTheta > range.upperTheta) {
        rangeProbabilities[rangeIndex].above += weight;
      } else {
        rangeProbabilities[rangeIndex].within += weight;
      }
    }
  }
  let variance = 0;
  for (let index = 0; index < weights.length; index += 1) {
    variance += weights[index] * (cache.grid[index] - theta) ** 2;
  }
  const tail = (1 - credibleMass) / 2;
  return {
    theta,
    standardDeviation: Math.sqrt(variance),
    thetaLower: weightedQuantile(cache.grid, weights, tail),
    thetaUpper: weightedQuantile(cache.grid, weights, 1 - tail),
    vocabularyMean,
    vocabularyLower: weightedQuantile(cache.vocabularyValues, weights, tail),
    vocabularyUpper: weightedQuantile(
      cache.vocabularyValues,
      weights,
      1 - tail
    ),
    rangeProbabilities,
  };
}

function classificationFromProbabilities(
  probabilities: { below: number; within: number; above: number },
  massThreshold: number
): MeasurementRangeClassification {
  if (probabilities.below >= massThreshold) return "below-range";
  if (probabilities.above >= massThreshold) return "above-range";
  if (probabilities.within >= massThreshold) return "within-range";
  return "indeterminate";
}

function trueRegion(theta: number, range: InformationSupportRange): TrueRangeRegion {
  if (theta < range.lowerTheta) return "below-range";
  if (theta > range.upperTheta) return "above-range";
  return "within-range";
}

function evaluationZone(
  theta: number,
  range: InformationSupportRange,
  margin: number
): RangeEvaluationZone {
  if (theta < range.lowerTheta) {
    return range.lowerTheta - theta >= margin
      ? "clearly-outside"
      : "boundary-indifference";
  }
  if (theta > range.upperTheta) {
    return theta - range.upperTheta >= margin
      ? "clearly-outside"
      : "boundary-indifference";
  }
  return Math.min(theta - range.lowerTheta, range.upperTheta - theta) >= margin
    ? "validated-interior"
    : "boundary-indifference";
}

function createScoreAccumulator(): ScoreAccumulator {
  return {
    trials: 0,
    thetaErrorSum: 0,
    thetaSquaredErrorSum: 0,
    thetaFourthErrorSum: 0,
    thetaCoverageCount: 0,
    vocabularyErrorSum: 0,
    vocabularySquaredErrorSum: 0,
    vocabularyFourthErrorSum: 0,
    vocabularyCoverageCount: 0,
    posteriorStandardDeviationSum: 0,
  };
}

function createConditionalAccumulator(
  theta: number,
  range: InformationSupportRange,
  margin: number
): ConditionalAccumulator {
  return {
    trueTheta: theta,
    trueRegion: trueRegion(theta, range),
    evaluationZone: evaluationZone(theta, range, margin),
    trials: 0,
    classificationCounts: {
      "below-range": 0,
      "within-range": 0,
      "above-range": 0,
      indeterminate: 0,
    },
    correctCount: 0,
    decisiveCount: 0,
    numericReportCount: 0,
    oppositeExtremeCount: 0,
    allPaths: createScoreAccumulator(),
    numericallyReported: createScoreAccumulator(),
  };
}

function addScore(
  accumulator: ScoreAccumulator,
  posterior: PosteriorSummary,
  theta: number,
  vocabulary: number
): void {
  const thetaError = posterior.theta - theta;
  const vocabularyError = posterior.vocabularyMean - vocabulary;
  accumulator.trials += 1;
  accumulator.thetaErrorSum += thetaError;
  accumulator.thetaSquaredErrorSum += thetaError ** 2;
  accumulator.thetaFourthErrorSum += thetaError ** 4;
  accumulator.thetaCoverageCount +=
    posterior.thetaLower <= theta && theta <= posterior.thetaUpper ? 1 : 0;
  accumulator.vocabularyErrorSum += vocabularyError;
  accumulator.vocabularySquaredErrorSum += vocabularyError ** 2;
  accumulator.vocabularyFourthErrorSum += vocabularyError ** 4;
  accumulator.vocabularyCoverageCount +=
    posterior.vocabularyLower <= vocabulary &&
    vocabulary <= posterior.vocabularyUpper
      ? 1
      : 0;
  accumulator.posteriorStandardDeviationSum += posterior.standardDeviation;
}

function addOutcome(
  accumulator: ConditionalAccumulator,
  classification: MeasurementRangeClassification,
  posterior: PosteriorSummary,
  vocabulary: number
): void {
  accumulator.trials += 1;
  accumulator.classificationCounts[classification] += 1;
  accumulator.correctCount += classification === accumulator.trueRegion ? 1 : 0;
  accumulator.decisiveCount += classification === "indeterminate" ? 0 : 1;
  const numeric = classification === "within-range";
  accumulator.numericReportCount += numeric ? 1 : 0;
  const opposite =
    (accumulator.trueRegion === "below-range" &&
      classification === "above-range") ||
    (accumulator.trueRegion === "above-range" &&
      classification === "below-range");
  accumulator.oppositeExtremeCount += opposite ? 1 : 0;
  addScore(accumulator.allPaths, posterior, accumulator.trueTheta, vocabulary);
  if (numeric) {
    addScore(
      accumulator.numericallyReported,
      posterior,
      accumulator.trueTheta,
      vocabulary
    );
  }
}

function meanMonteCarloStandardError(
  sum: number,
  sumOfSquares: number,
  trials: number
): number {
  if (trials <= 1) return 0;
  const variance = Math.max(
    0,
    (sumOfSquares - sum ** 2 / trials) / (trials - 1)
  );
  return Math.sqrt(variance / trials);
}

function rmseMonteCarloStandardError(
  squaredErrorSum: number,
  fourthErrorSum: number,
  trials: number
): number {
  const meanSquaredError = squaredErrorSum / trials;
  if (trials <= 1 || meanSquaredError === 0) return 0;
  const variance = Math.max(
    0,
    (fourthErrorSum - squaredErrorSum ** 2 / trials) / (trials - 1)
  );
  return Math.sqrt(variance / trials) / (2 * Math.sqrt(meanSquaredError));
}

function rateWithError(count: number, trials: number): RateWithMonteCarloError {
  const rate = count / trials;
  return {
    rate,
    monteCarloStandardError: Math.sqrt((rate * (1 - rate)) / trials),
  };
}

function summarizeScore(accumulator: ScoreAccumulator): ScorePerformanceMetrics {
  const { trials } = accumulator;
  const thetaCoverage = accumulator.thetaCoverageCount / trials;
  const vocabularyCoverage = accumulator.vocabularyCoverageCount / trials;
  return {
    trials,
    thetaBias: accumulator.thetaErrorSum / trials,
    thetaRmse: Math.sqrt(accumulator.thetaSquaredErrorSum / trials),
    thetaCoverage,
    vocabularyBias: accumulator.vocabularyErrorSum / trials,
    vocabularyRmse: Math.sqrt(accumulator.vocabularySquaredErrorSum / trials),
    vocabularyCoverage,
    meanPosteriorStandardDeviation:
      accumulator.posteriorStandardDeviationSum / trials,
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
    },
  };
}

function summarizeConditional(
  accumulator: ConditionalAccumulator
): RangeConditionalMetrics {
  const numericReport = rateWithError(
    accumulator.numericReportCount,
    accumulator.trials
  );
  return {
    trueTheta: accumulator.trueTheta,
    trueRegion: accumulator.trueRegion,
    evaluationZone: accumulator.evaluationZone,
    trials: accumulator.trials,
    classificationRates: Object.fromEntries(
      CLASSIFICATIONS.map((classification) => [
        classification,
        accumulator.classificationCounts[classification] / accumulator.trials,
      ])
    ) as Record<MeasurementRangeClassification, number>,
    correctClassification: rateWithError(
      accumulator.correctCount,
      accumulator.trials
    ),
    decisiveClassification: rateWithError(
      accumulator.decisiveCount,
      accumulator.trials
    ),
    numericReport,
    falseNumericReport:
      accumulator.trueRegion === "within-range" ? null : numericReport,
    numericWithholding:
      accumulator.trueRegion === "within-range"
        ? rateWithError(
            accumulator.trials - accumulator.numericReportCount,
            accumulator.trials
          )
        : null,
    oppositeExtreme: rateWithError(
      accumulator.oppositeExtremeCount,
      accumulator.trials
    ),
    allPaths: summarizeScore(accumulator.allPaths),
    numericallyReported:
      accumulator.numericallyReported.trials > 0
        ? summarizeScore(accumulator.numericallyReported)
        : null,
  };
}

function maximumOrNull(values: number[]): number | null {
  return values.length === 0 ? null : Math.max(...values);
}

function minimumOrNull(values: number[]): number | null {
  return values.length === 0 ? null : Math.min(...values);
}

function summarizeCandidate(
  conditional: RangeConditionalMetrics[],
  criteria: RangeReportingDecisionCriteria
): RangeCandidateSummary {
  const outside = conditional.filter(
    ({ evaluationZone: zone }) => zone === "clearly-outside"
  );
  const interior = conditional.filter(
    ({ evaluationZone: zone }) => zone === "validated-interior"
  );
  const boundary = conditional.filter(
    ({ evaluationZone: zone }) => zone === "boundary-indifference"
  );
  const wilsonBounds = (
    rate: number,
    trials: number
  ): { lower: number; upper: number } => {
    const zSquared = criteria.monteCarloZ ** 2;
    const denominator = 1 + zSquared / trials;
    const center = (rate + zSquared / (2 * trials)) / denominator;
    const halfWidth =
      (criteria.monteCarloZ / denominator) *
      Math.sqrt(
        (rate * (1 - rate)) / trials + zSquared / (4 * trials ** 2)
      );
    return { lower: center - halfWidth, upper: center + halfWidth };
  };

  const outsideFalseNumericReporting =
    outside.length > 0 &&
    outside.every(
      ({ falseNumericReport, trials }) =>
        falseNumericReport !== null &&
        wilsonBounds(falseNumericReport.rate, trials).upper <=
          criteria.maximumFalseNumericReportRateOutside
    );
  const oppositeExtremeClassification = conditional.every(
    ({ oppositeExtreme, trials }) =>
      wilsonBounds(oppositeExtreme.rate, trials).upper <=
      criteria.maximumOppositeExtremeRate
  );
  const interiorNumericAvailability =
    interior.length > 0 &&
    interior.every(
      ({ numericReport, trials }) =>
        wilsonBounds(numericReport.rate, trials).lower >=
        criteria.minimumNumericReportRateInterior
    );
  const reportedThetaBias =
    interior.length > 0 &&
    interior.every(({ numericallyReported }) => {
      if (numericallyReported === null) return false;
      return (
        Math.abs(numericallyReported.thetaBias) +
          criteria.monteCarloZ *
            numericallyReported.monteCarloStandardErrors.thetaBias <=
        criteria.maximumAbsoluteThetaBiasReported
      );
    });
  const reportedThetaRmse =
    interior.length > 0 &&
    interior.every(({ numericallyReported }) => {
      if (numericallyReported === null) return false;
      return (
        numericallyReported.thetaRmse +
          criteria.monteCarloZ *
            numericallyReported.monteCarloStandardErrors.thetaRmse <=
        criteria.maximumThetaRmseReported
      );
    });
  const coverageContained = (
    rate: number,
    trials: number
  ): boolean =>
    wilsonBounds(rate, trials).lower >=
      criteria.minimumIntervalCoverageReported &&
    wilsonBounds(rate, trials).upper <=
      criteria.maximumIntervalCoverageReported;
  const reportedIntervalCoverage =
    interior.length > 0 &&
    interior.every(({ numericallyReported }) =>
      numericallyReported === null
        ? false
        : coverageContained(
            numericallyReported.thetaCoverage,
            numericallyReported.trials
          )
    );
  const transformedScoreIntervalCoverage =
    interior.length > 0 &&
    interior.every(({ numericallyReported }) =>
      numericallyReported === null
        ? false
        : coverageContained(
            numericallyReported.vocabularyCoverage,
            numericallyReported.trials
          )
    );
  const gates = {
    outsideFalseNumericReporting,
    oppositeExtremeClassification,
    interiorNumericAvailability,
    reportedThetaBias,
    reportedThetaRmse,
    reportedIntervalCoverage,
    transformedScoreIntervalCoverage,
  };
  const failedGates = Object.entries(gates)
    .filter(([, passed]) => !passed)
    .map(([gate]) => gate);
  const reportedInterior = interior
    .map(({ numericallyReported }) => numericallyReported)
    .filter((metrics): metrics is ScorePerformanceMetrics => metrics !== null);

  return {
    passesAllGates: failedGates.length === 0,
    gates,
    failedGates,
    evaluatedCells: {
      clearlyOutside: outside.length,
      validatedInterior: interior.length,
      boundaryIndifference: boundary.length,
    },
    observed: {
      maximumFalseNumericReportRateOutside: maximumOrNull(
        outside.flatMap(({ falseNumericReport }) =>
          falseNumericReport === null ? [] : [falseNumericReport.rate]
        )
      ),
      maximumOppositeExtremeRate: Math.max(
        ...conditional.map(({ oppositeExtreme }) => oppositeExtreme.rate)
      ),
      minimumNumericReportRateInterior: minimumOrNull(
        interior.map(({ numericReport }) => numericReport.rate)
      ),
      maximumAbsoluteReportedThetaBiasInterior: maximumOrNull(
        reportedInterior.map(({ thetaBias }) => Math.abs(thetaBias))
      ),
      maximumReportedThetaRmseInterior: maximumOrNull(
        reportedInterior.map(({ thetaRmse }) => thetaRmse)
      ),
      minimumReportedThetaCoverageInterior: minimumOrNull(
        reportedInterior.map(({ thetaCoverage }) => thetaCoverage)
      ),
      maximumReportedThetaCoverageInterior: maximumOrNull(
        reportedInterior.map(({ thetaCoverage }) => thetaCoverage)
      ),
      minimumReportedVocabularyCoverageInterior: minimumOrNull(
        reportedInterior.map(({ vocabularyCoverage }) => vocabularyCoverage)
      ),
      maximumReportedVocabularyCoverageInterior: maximumOrNull(
        reportedInterior.map(({ vocabularyCoverage }) => vocabularyCoverage)
      ),
    },
  };
}

function summarizeExposure(
  itemBank: Item[],
  counts: Uint32Array,
  trials: number
): RangeExposureMetrics {
  const ranked = Array.from(counts, (administrations, itemIndex) => ({
    itemIndex,
    level: itemBank[itemIndex].Level,
    administrations,
    exposureRate: administrations / trials,
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

function validateUniqueFinite(
  values: readonly number[],
  label: string,
  predicate: (value: number) => boolean
): void {
  if (
    values.length === 0 ||
    new Set(values).size !== values.length ||
    values.some((value) => !Number.isFinite(value) || !predicate(value))
  ) {
    throw new RangeError(`${label} must be finite, valid, and unique.`);
  }
}

function validatePlan(itemBank: Item[], plan: RangeReportingSimulationPlan): void {
  if (itemBank.length === 0 || plan.planId.trim().length === 0) {
    throw new RangeError("Range simulations require a bank and plan ID.");
  }
  if (!Number.isSafeInteger(plan.seed) || plan.seed < 0) {
    throw new RangeError("seed must be a non-negative safe integer.");
  }
  if (!Number.isInteger(plan.replicationsPerTheta) || plan.replicationsPerTheta < 1) {
    throw new RangeError("replicationsPerTheta must be a positive integer.");
  }
  if (
    plan.pathRules.length === 0 ||
    plan.posteriorSpecifications.length === 0
  ) {
    throw new RangeError("Range plans require path and posterior candidates.");
  }
  validateUniqueFinite(
    plan.trueThetas,
    "trueThetas",
    (theta) =>
      theta >= PAPER_3PL_CONFIG.thetaGrid.min &&
      theta <= PAPER_3PL_CONFIG.thetaGrid.max
  );
  validateUniqueFinite(
    plan.informationEquivalentStandardDeviationThresholds,
    "Information SD thresholds",
    (value) => value > 0
  );
  validateUniqueFinite(
    plan.posteriorMassThresholds,
    "Posterior-mass thresholds",
    (value) => value > 0.5 && value < 1
  );
  if (
    !Number.isFinite(plan.boundaryIndifferenceMargin) ||
    plan.boundaryIndifferenceMargin <= 0 ||
    !Number.isFinite(plan.credibleMass) ||
    plan.credibleMass <= 0 ||
    plan.credibleMass >= 1
  ) {
    throw new RangeError("Invalid boundary margin or credible mass.");
  }
  const posteriorIds = new Set<string>();
  for (const specification of plan.posteriorSpecifications) {
    if (
      specification.id.trim().length === 0 ||
      posteriorIds.has(specification.id) ||
      !Number.isFinite(specification.priorMean) ||
      !Number.isFinite(specification.priorStandardDeviation) ||
      specification.priorStandardDeviation <= 0
    ) {
      throw new RangeError("Posterior specifications must be valid and unique.");
    }
    posteriorIds.add(specification.id);
  }
  if (!posteriorIds.has(plan.selectionPosteriorId)) {
    throw new RangeError("selectionPosteriorId must reference a specification.");
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
    throw new RangeError("The bank cannot satisfy content constraints.");
  }
  const ruleIds = new Set<string>();
  for (const rule of plan.pathRules) {
    if (
      rule.id.trim().length === 0 ||
      ruleIds.has(rule.id) ||
      !Number.isInteger(rule.fixedLength) ||
      rule.fixedLength < plan.minimumHighLevelItems ||
      rule.fixedLength > itemBank.length ||
      (rule.selectionMethod !== "maximum-information" &&
        rule.selectionMethod !== "randomesque") ||
      (rule.selectionMethod === "randomesque" &&
        (!Number.isInteger(rule.randomesqueSize) ||
          (rule.randomesqueSize ?? 0) < 1))
    ) {
      throw new RangeError("Path rules must be feasible and unique.");
    }
    ruleIds.add(rule.id);
  }
  const criteriaValues = Object.entries(plan.decisionCriteria)
    .filter(([key]) => key !== "binomialIntervalMethod")
    .map(([, value]) => value as number);
  if (
    plan.decisionCriteria.binomialIntervalMethod !== "wilson-score" ||
    criteriaValues.some((value) => !Number.isFinite(value) || value < 0)
  ) {
    throw new RangeError("Decision criteria must be finite and nonnegative.");
  }
  if (
    plan.decisionCriteria.monteCarloZ <= 0 ||
    plan.decisionCriteria.maximumFalseNumericReportRateOutside > 1 ||
    plan.decisionCriteria.maximumOppositeExtremeRate > 1 ||
    plan.decisionCriteria.minimumNumericReportRateInterior > 1 ||
    plan.decisionCriteria.minimumIntervalCoverageReported > 1 ||
    plan.decisionCriteria.maximumIntervalCoverageReported > 1 ||
    plan.decisionCriteria.minimumIntervalCoverageReported >=
      plan.decisionCriteria.maximumIntervalCoverageReported ||
    plan.candidatePreferenceOrder.join("|") !==
      [
        "widest-validated-theta-interval",
        "shortest-fixed-length",
        "highest-posterior-mass-threshold",
        "posterior-specification-id",
      ].join("|")
  ) {
    throw new RangeError("Invalid decision or preference contract.");
  }
}

function clonePlan(plan: RangeReportingSimulationPlan): RangeReportingSimulationPlan {
  return {
    ...plan,
    trueThetas: [...plan.trueThetas],
    pathRules: plan.pathRules.map((rule) => ({ ...rule })),
    posteriorSpecifications: plan.posteriorSpecifications.map((specification) => ({
      ...specification,
    })),
    informationEquivalentStandardDeviationThresholds: [
      ...plan.informationEquivalentStandardDeviationThresholds,
    ],
    posteriorMassThresholds: [...plan.posteriorMassThresholds],
    decisionCriteria: { ...plan.decisionCriteria },
    candidatePreferenceOrder: [...plan.candidatePreferenceOrder],
  };
}

export function runRangeReportingSimulation(
  itemBank: Item[],
  itemBankSha256: string,
  plan: RangeReportingSimulationPlan,
  planSha256: string | null = null,
  provenance: RangeReportingProvenance | null = null
): RangeReportingSimulationReport {
  validatePlan(itemBank, plan);
  const ranges = plan.informationEquivalentStandardDeviationThresholds.map(
    (threshold) =>
      deriveInformationSupportRange(itemBank, {
        policyId: "information-support-exploratory-v1",
        informationEquivalentStandardDeviationThreshold: threshold,
      })
  );
  const cache = buildCache(itemBank, plan.posteriorSpecifications);
  const levelMeans = computeLevelParameterMeans(itemBank);
  const results: RangePathResult[] = [];

  for (const pathRule of plan.pathRules) {
    const exposureCounts = new Uint32Array(itemBank.length);
    const candidates = plan.posteriorSpecifications.flatMap(
      (posteriorSpecification) =>
        ranges.flatMap((range) =>
          plan.posteriorMassThresholds.map((posteriorMassThreshold) => {
            const candidateId = [
              pathRule.id,
              posteriorSpecification.id,
              `info-sd-${range.informationEquivalentStandardDeviationThreshold}`,
              `mass-${posteriorMassThreshold}`,
            ].join("__");
            const specification: RangeCandidateSpecification = {
              candidateId,
              posteriorSpecification: { ...posteriorSpecification },
              informationEquivalentStandardDeviationThreshold:
                range.informationEquivalentStandardDeviationThreshold,
              posteriorMassThreshold,
              range: { ...range },
            };
            return {
              specification,
              accumulators: plan.trueThetas.map((theta) =>
                createConditionalAccumulator(
                  theta,
                  range,
                  plan.boundaryIndifferenceMargin
                )
              ),
            };
          })
        )
    );

    for (let thetaIndex = 0; thetaIndex < plan.trueThetas.length; thetaIndex += 1) {
      const theta = plan.trueThetas[thetaIndex];
      const trueVocabulary = paperVocabularyAtThetaFromMeans(theta, levelMeans);
      for (
        let replication = 0;
        replication < plan.replicationsPerTheta;
        replication += 1
      ) {
        const posteriors = generatePathPosteriors(
          itemBank,
          cache,
          plan,
          pathRule,
          theta,
          createDeterministicRandom(
            deriveSeed(plan.seed, thetaIndex, replication, 0x52)
          ),
          createDeterministicRandom(
            deriveSeed(plan.seed, thetaIndex, replication, 0x53)
          ),
          exposureCounts
        );
        const summaries = new Map<string, PosteriorSummary>();
        for (const specification of plan.posteriorSpecifications) {
          const weights = posteriors.get(specification.id);
          if (weights === undefined) {
            throw new RangeError(`Missing posterior ${specification.id}.`);
          }
          summaries.set(
            specification.id,
            summarizePosterior(cache, weights, ranges, plan.credibleMass)
          );
        }
        for (const candidate of candidates) {
          const posterior = summaries.get(
            candidate.specification.posteriorSpecification.id
          );
          if (posterior === undefined) throw new RangeError("Missing summary.");
          const rangeIndex = ranges.findIndex(
            (range) =>
              range.informationEquivalentStandardDeviationThreshold ===
              candidate.specification
                .informationEquivalentStandardDeviationThreshold
          );
          const probabilities = posterior.rangeProbabilities[rangeIndex];
          const classification = classificationFromProbabilities(
            probabilities,
            candidate.specification.posteriorMassThreshold
          );
          addOutcome(
            candidate.accumulators[thetaIndex],
            classification,
            posterior,
            trueVocabulary
          );
        }
      }
    }
    const summarizedCandidates = candidates.map((candidate) => {
      const conditional = candidate.accumulators.map(summarizeConditional);
      return {
        specification: candidate.specification,
        summary: summarizeCandidate(conditional, plan.decisionCriteria),
        conditional,
      };
    });
    results.push({
      pathRule: { ...pathRule },
      exposure: summarizeExposure(
        itemBank,
        exposureCounts,
        plan.trueThetas.length * plan.replicationsPerTheta
      ),
      candidates: summarizedCandidates,
    });
  }

  const passing = results.flatMap(({ candidates }) =>
    candidates.filter(({ summary }) => summary.passesAllGates)
  );
  passing.sort((left, right) => {
    const leftWidth =
      left.specification.range.upperTheta - left.specification.range.lowerTheta;
    const rightWidth =
      right.specification.range.upperTheta - right.specification.range.lowerTheta;
    if (leftWidth !== rightWidth) return rightWidth - leftWidth;
    const leftPath = results.find(({ candidates }) => candidates.includes(left));
    const rightPath = results.find(({ candidates }) => candidates.includes(right));
    const lengthDifference =
      (leftPath?.pathRule.fixedLength ?? Infinity) -
      (rightPath?.pathRule.fixedLength ?? Infinity);
    if (lengthDifference !== 0) return lengthDifference;
    if (
      left.specification.posteriorMassThreshold !==
      right.specification.posteriorMassThreshold
    ) {
      return (
        right.specification.posteriorMassThreshold -
        left.specification.posteriorMassThreshold
      );
    }
    return left.specification.posteriorSpecification.id.localeCompare(
      right.specification.posteriorSpecification.id
    );
  });

  return {
    schemaVersion: "range-reporting-simulation-v1",
    engineId: "common-path-posterior-range-v1",
    randomGeneratorId: "mulberry32-v1",
    scoreModelId: PAPER_3PL_CONFIG.scoreModelId,
    commonResponsePaths: true,
    validationStatus: "exploratory-not-for-score-reporting",
    itemBankSha256,
    planSha256,
    provenance:
      provenance === null
        ? null
        : { ...provenance, sourceSha256: { ...provenance.sourceSha256 } },
    plan: clonePlan(plan),
    informationSupportRanges: ranges.map((range) => ({ ...range })),
    results,
    selection: {
      passingCandidateIds: passing.map(
        ({ specification }) => specification.candidateId
      ),
      preferredCandidateId: passing[0]?.specification.candidateId ?? null,
      preferenceOrder: [...plan.candidatePreferenceOrder],
      productionApproved: false,
      requiredNextEvidence:
        "Freeze one candidate and repeat with an independent seed and at least 5,000 replications per theta before any production reporting change.",
    },
  };
}
