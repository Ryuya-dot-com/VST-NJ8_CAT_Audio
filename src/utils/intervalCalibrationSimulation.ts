import type { Item } from "../types";
import {
  deriveInformationSupportRange,
  type InformationSupportRange,
} from "./measurementRange.ts";
import {
  PAPER_3PL_CONFIG,
  computeLevelParameterMeans,
  type LevelParameterMean,
  paperItemInformation3pl,
  paperProbability3pl,
  paperVocabularyAtThetaFromMeans,
} from "./paperScoring.ts";

export type IntervalKind =
  | "posterior-equal-tail"
  | "likelihood-ratio-fixed-cutoff"
  | "likelihood-ratio-calibrated"
  | "weighted-likelihood-ratio-calibrated"
  | "eap-central-calibrated";

export interface IntervalMethodSpecification {
  id: string;
  kind: IntervalKind;
  cutoff?: number;
}

export interface IntervalReportingCandidate {
  id: string;
  fixedLength: number;
  selectionMethod: "maximum-information" | "randomesque";
  randomesqueSize?: number;
  reportingPriorMean: number;
  reportingPriorStandardDeviation: number;
  informationEquivalentStandardDeviationThreshold: number;
  posteriorMassThreshold: number;
}

export interface IntervalCalibrationDecisionCriteria {
  binomialIntervalMethod: "wilson-score-tost";
  equivalenceZ: number;
  maximumFalseNumericReportRateOutside: number;
  maximumOppositeExtremeRate: number;
  minimumReportableRateInterior: number;
  maximumInvalidIntervalRateInterior: number;
  maximumAbsoluteThetaBiasReported: number;
  maximumThetaRmseReported: number;
  minimumCoverage: number;
  maximumCoverage: number;
  maximumOneSidedMissRate: number;
  maximumMeanThetaIntervalWidth: number;
  maximumP90ThetaIntervalWidth: number;
}

export interface IntervalCalibrationPlan {
  planId: string;
  calibrationSeed: number;
  evaluationSeed: number;
  calibrationReplicationsPerTheta: number;
  evaluationReplicationsPerTheta: number;
  calibrationThetas: number[];
  evaluationThetas: number[];
  reportingCandidates: IntervalReportingCandidate[];
  selectionPriorMean: number;
  selectionPriorStandardDeviation: number;
  intervalMethods: IntervalMethodSpecification[];
  nominalCoverage: number;
  calibrationQuantileMethod: "conservative-order-statistic-v1";
  isotonicEapAcceptanceBounds: true;
  inversionGrid: {
    minimumTheta: number;
    maximumTheta: number;
    step: number;
  };
  boundaryIndifferenceMargin: number;
  initialLevelMinimum: number;
  initialLevelMaximum: number;
  highLevelFloor: number;
  minimumHighLevelItems: number;
  decisionCriteria: IntervalCalibrationDecisionCriteria;
  selectionPreference: {
    candidateOrder: string[];
    methodOrder: string[];
    tieBreaker: "smallest-maximum-conditional-mean-theta-width";
  };
}

export interface IntervalCalibrationProvenance {
  nodeVersion: string;
  platform: string;
  architecture: string;
  sourceSha256: Record<string, string>;
}

export interface IntervalNumericalKernelSummary {
  priorStandardDeviation: number;
  eap: number;
  posteriorStandardDeviation: number;
  posteriorEqualTail95: { lower: number; upper: number };
  likelihoodMaximumThetaOnGrid: number;
  warmWeightedLikelihoodMaximumThetaOnGrid: number;
  likelihoodRatioChiSquare95: {
    lower: number;
    upper: number;
    valid: boolean;
  };
  warmWeightedLikelihoodChiSquareDiagnostic95: {
    lower: number;
    upper: number;
    valid: boolean;
  };
  likelihoodRatioAtThetaZero: number;
  warmWeightedLikelihoodRatioAtThetaZero: number;
}

export interface CalibrationCurve {
  candidateId: string;
  methodId: string;
  calibrationThetas: number[];
  lowerValues: number[] | null;
  upperValues: number[] | null;
  cutoffValues: number[] | null;
  calibrationSampleSizePerTheta: number;
  calibrationSeed: number;
}

export interface IntervalConditionalMetrics {
  trueTheta: number;
  trueRegion: "below-range" | "within-range" | "above-range";
  evaluationZone:
    | "clearly-outside"
    | "validated-interior"
    | "boundary-indifference";
  trials: number;
  rangeClassificationRates: {
    belowRange: number;
    withinRange: number;
    aboveRange: number;
    indeterminate: number;
  };
  oppositeExtremeRate: number;
  intervalValidRate: number;
  reportableRate: number;
  falseNumericReportRate: number | null;
  invalidIntervalRate: number;
  reportedTrials: number;
  thetaBiasReported: number | null;
  thetaRmseReported: number | null;
  thetaCoverageReported: number | null;
  lowerMissRateReported: number | null;
  upperMissRateReported: number | null;
  meanThetaIntervalWidthReported: number | null;
  p90ThetaIntervalWidthReported: number | null;
  vocabularyCoverageReported: number | null;
  meanVocabularyIntervalWidthReported: number | null;
  monteCarloStandardErrors: {
    thetaBiasReported: number | null;
    thetaRmseReported: number | null;
  };
}

export interface IntervalMethodSummary {
  passesAllGates: boolean;
  gates: {
    outsideFalseNumericReporting: boolean;
    oppositeExtremeClassification: boolean;
    interiorReportability: boolean;
    interiorIntervalValidity: boolean;
    reportedThetaBias: boolean;
    reportedThetaRmse: boolean;
    reportedCoverage: boolean;
    reportedTailBalance: boolean;
    reportedMeanWidth: boolean;
    reportedP90Width: boolean;
  };
  failedGates: string[];
  observed: {
    maximumFalseNumericReportRateOutside: number | null;
    maximumOppositeExtremeRate: number;
    minimumReportableRateInterior: number | null;
    maximumInvalidIntervalRateInterior: number | null;
    maximumAbsoluteThetaBiasReported: number | null;
    maximumThetaRmseReported: number | null;
    minimumCoverageReported: number | null;
    maximumCoverageReported: number | null;
    maximumLowerMissRate: number | null;
    maximumUpperMissRate: number | null;
    maximumMeanThetaIntervalWidth: number | null;
    maximumP90ThetaIntervalWidth: number | null;
  };
}

export interface IntervalCalibrationReport {
  schemaVersion: "interval-calibration-simulation-v1";
  engineId: "common-path-neyman-interval-calibration-v1";
  randomGeneratorId: "mulberry32-v1";
  scoreModelId: string;
  commonRandomNumbersAcrossCandidates: true;
  commonResponsePathsWithinCandidate: true;
  calibrationEvaluationSeedsSeparated: true;
  validationStatus: "exploratory-not-for-score-reporting";
  itemBankSha256: string;
  planSha256: string | null;
  provenance: IntervalCalibrationProvenance | null;
  plan: IntervalCalibrationPlan;
  calibrationCurves: CalibrationCurve[];
  results: Array<{
    candidate: IntervalReportingCandidate;
    range: InformationSupportRange;
    exposure: {
      maximumExposureRate: number;
      unusedItemRate: number;
    };
    methods: Array<{
      method: IntervalMethodSpecification;
      summary: IntervalMethodSummary;
      conditional: IntervalConditionalMetrics[];
    }>;
  }>;
  selection: {
    passingMethodIds: string[];
    preferredMethodId: string | null;
    productionApproved: false;
    requiredNextEvidence: string;
  };
}

interface ModelCache {
  grid: number[];
  probabilities: Float64Array[];
  logProbabilitiesCorrect: Float64Array[];
  logProbabilitiesIncorrect: Float64Array[];
  itemInformation: Float64Array[];
  vocabularyValues: Float64Array;
  levelMeans: LevelParameterMean[];
  selectionPrior: Float64Array;
  reportingPriors: Map<string, Float64Array>;
}

interface TrialStatistics {
  eap: number;
  posteriorStandardDeviation: number;
  posteriorLower: number;
  posteriorUpper: number;
  belowProbability: number;
  withinProbability: number;
  aboveProbability: number;
  logLikelihood: Float64Array;
  logWeightedLikelihood: Float64Array;
}

interface CalibrationCell {
  eapValues: number[];
  likelihoodRatioStatistics: number[];
  weightedLikelihoodRatioStatistics: number[];
}

interface IntervalResult {
  lower: number;
  upper: number;
  valid: boolean;
}

interface MetricsAccumulator {
  theta: number;
  region: "below-range" | "within-range" | "above-range";
  zone: "clearly-outside" | "validated-interior" | "boundary-indifference";
  trials: number;
  belowCount: number;
  withinCount: number;
  aboveCount: number;
  indeterminateCount: number;
  oppositeCount: number;
  validIntervalCount: number;
  reportableCount: number;
  invalidIntervalCount: number;
  reportedCount: number;
  errorSum: number;
  squaredErrorSum: number;
  fourthErrorSum: number;
  coverageCount: number;
  lowerMissCount: number;
  upperMissCount: number;
  thetaWidths: number[];
  vocabularyCoverageCount: number;
  vocabularyWidths: number[];
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

function normalize(weights: Float64Array): void {
  let total = 0;
  for (const value of weights) total += value;
  if (!Number.isFinite(total) || total <= 0) {
    throw new RangeError("Interval posterior cannot be normalized.");
  }
  for (let index = 0; index < weights.length; index += 1) {
    weights[index] /= total;
  }
}

function normalPrior(
  grid: readonly number[],
  mean: number,
  standardDeviation: number
): Float64Array {
  const weights = Float64Array.from(grid, (theta) =>
    Math.exp(-0.5 * ((theta - mean) / standardDeviation) ** 2)
  );
  normalize(weights);
  return weights;
}

function buildCache(
  itemBank: Item[],
  plan: IntervalCalibrationPlan
): ModelCache {
  const { minimumTheta, maximumTheta, step } = plan.inversionGrid;
  const size = Math.round((maximumTheta - minimumTheta) / step) + 1;
  const grid = Array.from(
    { length: size },
    (_, index) => minimumTheta + index * step
  );
  const probabilities = itemBank.map((item) =>
    Float64Array.from(grid, (theta) => paperProbability3pl(theta, item))
  );
  const logProbabilitiesCorrect = probabilities.map((values) =>
    Float64Array.from(values, (value) => Math.log(value))
  );
  const logProbabilitiesIncorrect = probabilities.map((values) =>
    Float64Array.from(values, (value) => Math.log1p(-value))
  );
  const itemInformation = itemBank.map((item) =>
    Float64Array.from(grid, (theta) => paperItemInformation3pl(theta, item))
  );
  const levelMeans = computeLevelParameterMeans(itemBank);
  const vocabularyValues = Float64Array.from(grid, (theta) =>
    paperVocabularyAtThetaFromMeans(theta, levelMeans)
  );
  const selectionPrior = normalPrior(
    grid,
    plan.selectionPriorMean,
    plan.selectionPriorStandardDeviation
  );
  const reportingPriors = new Map<string, Float64Array>();
  for (const candidate of plan.reportingCandidates) {
    reportingPriors.set(
      candidate.id,
      normalPrior(
        grid,
        candidate.reportingPriorMean,
        candidate.reportingPriorStandardDeviation
      )
    );
  }
  return {
    grid,
    probabilities,
    logProbabilitiesCorrect,
    logProbabilitiesIncorrect,
    itemInformation,
    vocabularyValues,
    levelMeans,
    selectionPrior,
    reportingPriors,
  };
}

function posteriorMean(grid: readonly number[], weights: Float64Array): number {
  let mean = 0;
  for (let index = 0; index < weights.length; index += 1) {
    mean += grid[index] * weights[index];
  }
  return mean;
}

function updateSelectionPosterior(
  weights: Float64Array,
  probabilities: Float64Array,
  response: 0 | 1
): void {
  for (let index = 0; index < weights.length; index += 1) {
    weights[index] *= response === 1 ? probabilities[index] : 1 - probabilities[index];
  }
  normalize(weights);
}

function chooseInitial(
  itemBank: Item[],
  plan: IntervalCalibrationPlan,
  random: () => number
): number {
  const candidates = itemBank
    .map((item, index) => ({ item, index }))
    .filter(
      ({ item }) =>
        item.Level >= plan.initialLevelMinimum &&
        item.Level <= plan.initialLevelMaximum
    );
  if (candidates.length === 0) throw new RangeError("No initial items.");
  return candidates[Math.floor(random() * candidates.length)].index;
}

function chooseNext(
  itemBank: Item[],
  theta: number,
  used: Uint8Array,
  needHigh: boolean,
  plan: IntervalCalibrationPlan,
  candidate: IntervalReportingCandidate,
  random: () => number
): number {
  let candidates = itemBank
    .map((_, index) => index)
    .filter((index) => used[index] === 0);
  if (needHigh) {
    const high = candidates.filter(
      (index) => itemBank[index].Level >= plan.highLevelFloor
    );
    if (high.length > 0) candidates = high;
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
  if (ranked.length === 0) throw new RangeError("Item bank exhausted.");
  if (candidate.selectionMethod === "maximum-information") {
    return ranked[0].index;
  }
  const size = Math.min(candidate.randomesqueSize ?? 1, ranked.length);
  return ranked[Math.floor(random() * size)].index;
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

function trialStatistics(
  itemBank: Item[],
  cache: ModelCache,
  plan: IntervalCalibrationPlan,
  candidate: IntervalReportingCandidate,
  range: InformationSupportRange,
  trueTheta: number,
  responseRandom: () => number,
  selectionRandom: () => number,
  exposureCounts: Uint32Array | null
): TrialStatistics {
  const selectionWeights = new Float64Array(cache.selectionPrior);
  const logLikelihood = new Float64Array(cache.grid.length);
  const information = new Float64Array(cache.grid.length);
  const used = new Uint8Array(itemBank.length);
  let nextItem = chooseInitial(itemBank, plan, selectionRandom);
  let highCount = 0;

  for (let length = 0; length < candidate.fixedLength; length += 1) {
    const item = itemBank[nextItem];
    const response: 0 | 1 =
      responseRandom() < paperProbability3pl(trueTheta, item) ? 1 : 0;
    used[nextItem] = 1;
    if (exposureCounts !== null) exposureCounts[nextItem] += 1;
    if (item.Level >= plan.highLevelFloor) highCount += 1;
    const logValues =
      response === 1
        ? cache.logProbabilitiesCorrect[nextItem]
        : cache.logProbabilitiesIncorrect[nextItem];
    for (let gridIndex = 0; gridIndex < cache.grid.length; gridIndex += 1) {
      logLikelihood[gridIndex] += logValues[gridIndex];
      information[gridIndex] += cache.itemInformation[nextItem][gridIndex];
    }
    updateSelectionPosterior(
      selectionWeights,
      cache.probabilities[nextItem],
      response
    );
    if (length + 1 < candidate.fixedLength) {
      nextItem = chooseNext(
        itemBank,
        posteriorMean(cache.grid, selectionWeights),
        used,
        highCount < plan.minimumHighLevelItems,
        plan,
        candidate,
        selectionRandom
      );
    }
  }
  if (highCount < plan.minimumHighLevelItems) {
    throw new RangeError("Path violates content constraint.");
  }

  const prior = cache.reportingPriors.get(candidate.id);
  if (prior === undefined) throw new RangeError("Reporting prior missing.");
  const maximum = Math.max(
    ...Array.from(logLikelihood, (value, index) => value + Math.log(prior[index]))
  );
  const posterior = Float64Array.from(
    logLikelihood,
    (value, index) => Math.exp(value + Math.log(prior[index]) - maximum)
  );
  normalize(posterior);
  const eap = posteriorMean(cache.grid, posterior);
  let variance = 0;
  let belowProbability = 0;
  let withinProbability = 0;
  let aboveProbability = 0;
  for (let index = 0; index < posterior.length; index += 1) {
    variance += posterior[index] * (cache.grid[index] - eap) ** 2;
    if (cache.grid[index] < range.lowerTheta) belowProbability += posterior[index];
    else if (cache.grid[index] > range.upperTheta) aboveProbability += posterior[index];
    else withinProbability += posterior[index];
  }
  const tail = (1 - plan.nominalCoverage) / 2;
  const logWeightedLikelihood = Float64Array.from(
    logLikelihood,
    (value, index) => value + 0.5 * Math.log(Math.max(information[index], 1e-300))
  );
  return {
    eap,
    posteriorStandardDeviation: Math.sqrt(variance),
    posteriorLower: weightedQuantile(cache.grid, posterior, tail),
    posteriorUpper: weightedQuantile(cache.grid, posterior, 1 - tail),
    belowProbability,
    withinProbability,
    aboveProbability,
    logLikelihood,
    logWeightedLikelihood,
  };
}

function nearestGridIndex(grid: readonly number[], theta: number): number {
  const index = Math.round((theta - grid[0]) / (grid[1] - grid[0]));
  return Math.max(0, Math.min(index, grid.length - 1));
}

function likelihoodRatioStatistic(
  values: Float64Array,
  trueThetaIndex: number
): number {
  let maximum = Number.NEGATIVE_INFINITY;
  for (const value of values) maximum = Math.max(maximum, value);
  return 2 * (maximum - values[trueThetaIndex]);
}

function sortedQuantileConservative(
  values: readonly number[],
  probability: number,
  side: "lower" | "upper"
): number {
  if (values.length === 0) throw new RangeError("No calibration values.");
  const sorted = [...values].sort((left, right) => left - right);
  const raw = probability * (sorted.length + 1);
  const rank = side === "lower" ? Math.floor(raw) : Math.ceil(raw);
  return sorted[Math.max(1, Math.min(rank, sorted.length)) - 1];
}

function isotonicIncreasing(values: readonly number[]): number[] {
  const blocks = values.map((value, index) => ({
    start: index,
    end: index,
    weight: 1,
    mean: value,
  }));
  let index = 0;
  while (index < blocks.length - 1) {
    if (blocks[index].mean <= blocks[index + 1].mean) {
      index += 1;
      continue;
    }
    const left = blocks[index];
    const right = blocks[index + 1];
    const weight = left.weight + right.weight;
    blocks.splice(index, 2, {
      start: left.start,
      end: right.end,
      weight,
      mean: (left.mean * left.weight + right.mean * right.weight) / weight,
    });
    if (index > 0) index -= 1;
  }
  const result = new Array<number>(values.length);
  for (const block of blocks) {
    for (let position = block.start; position <= block.end; position += 1) {
      result[position] = block.mean;
    }
  }
  return result;
}

function interpolate(
  x: readonly number[],
  y: readonly number[],
  value: number
): number {
  if (value <= x[0]) return y[0];
  if (value >= x[x.length - 1]) return y[y.length - 1];
  let upper = 1;
  while (x[upper] < value) upper += 1;
  const lower = upper - 1;
  const fraction = (value - x[lower]) / (x[upper] - x[lower]);
  return y[lower] + fraction * (y[upper] - y[lower]);
}

function buildCalibrationCurves(
  itemBank: Item[],
  cache: ModelCache,
  plan: IntervalCalibrationPlan
): CalibrationCurve[] {
  const curves: CalibrationCurve[] = [];
  for (
    let candidateIndex = 0;
    candidateIndex < plan.reportingCandidates.length;
    candidateIndex += 1
  ) {
    const candidate = plan.reportingCandidates[candidateIndex];
    const range = deriveInformationSupportRange(itemBank, {
      informationEquivalentStandardDeviationThreshold:
        candidate.informationEquivalentStandardDeviationThreshold,
    });
    const cells: CalibrationCell[] = plan.calibrationThetas.map(() => ({
      eapValues: [],
      likelihoodRatioStatistics: [],
      weightedLikelihoodRatioStatistics: [],
    }));
    for (
      let thetaIndex = 0;
      thetaIndex < plan.calibrationThetas.length;
      thetaIndex += 1
    ) {
      const theta = plan.calibrationThetas[thetaIndex];
      const gridIndex = nearestGridIndex(cache.grid, theta);
      for (
        let replication = 0;
        replication < plan.calibrationReplicationsPerTheta;
        replication += 1
      ) {
        const statistics = trialStatistics(
          itemBank,
          cache,
          plan,
          candidate,
          range,
          theta,
          createDeterministicRandom(
            deriveSeed(
              plan.calibrationSeed,
              thetaIndex,
              replication,
              0x52
            )
          ),
          createDeterministicRandom(
            deriveSeed(
              plan.calibrationSeed,
              thetaIndex,
              replication,
              0x53
            )
          ),
          null
        );
        cells[thetaIndex].eapValues.push(statistics.eap);
        cells[thetaIndex].likelihoodRatioStatistics.push(
          likelihoodRatioStatistic(statistics.logLikelihood, gridIndex)
        );
        cells[thetaIndex].weightedLikelihoodRatioStatistics.push(
          likelihoodRatioStatistic(
            statistics.logWeightedLikelihood,
            gridIndex
          )
        );
      }
    }
    const tail = (1 - plan.nominalCoverage) / 2;
    const rawLower = cells.map((cell) =>
      sortedQuantileConservative(cell.eapValues, tail, "lower")
    );
    const rawUpper = cells.map((cell) =>
      sortedQuantileConservative(cell.eapValues, 1 - tail, "upper")
    );
    const lowerValues = isotonicIncreasing(rawLower);
    const upperValues = isotonicIncreasing(rawUpper).map(
      (upper, index) => Math.max(upper, lowerValues[index])
    );
    curves.push({
      candidateId: candidate.id,
      methodId: "eap-neyman-central",
      calibrationThetas: [...plan.calibrationThetas],
      lowerValues,
      upperValues,
      cutoffValues: null,
      calibrationSampleSizePerTheta: plan.calibrationReplicationsPerTheta,
      calibrationSeed: plan.calibrationSeed,
    });
    for (const [methodId, values] of [
      [
        "likelihood-ratio-neyman",
        cells.map((cell) =>
          sortedQuantileConservative(
            cell.likelihoodRatioStatistics,
            plan.nominalCoverage,
            "upper"
          )
        ),
      ],
      [
        "warm-weighted-likelihood-neyman",
        cells.map((cell) =>
          sortedQuantileConservative(
            cell.weightedLikelihoodRatioStatistics,
            plan.nominalCoverage,
            "upper"
          )
        ),
      ],
    ] as const) {
      curves.push({
        candidateId: candidate.id,
        methodId,
        calibrationThetas: [...plan.calibrationThetas],
        lowerValues: null,
        upperValues: null,
        cutoffValues: [...values],
        calibrationSampleSizePerTheta: plan.calibrationReplicationsPerTheta,
        calibrationSeed: plan.calibrationSeed,
      });
    }
  }
  return curves;
}

function objectiveInterval(
  values: Float64Array,
  cutoffs: Float64Array
): IntervalResult {
  let maximum = Number.NEGATIVE_INFINITY;
  let maximumIndex = 0;
  for (let index = 0; index < values.length; index += 1) {
    if (values[index] > maximum) {
      maximum = values[index];
      maximumIndex = index;
    }
  }
  const accepted = new Uint8Array(values.length);
  for (let index = 0; index < values.length; index += 1) {
    accepted[index] = 2 * (maximum - values[index]) <= cutoffs[index] ? 1 : 0;
  }
  let lowerIndex = -1;
  let upperIndex = -1;
  for (let index = 0; index < accepted.length; index += 1) {
    if (accepted[index] === 1) {
      if (lowerIndex < 0) lowerIndex = index;
      upperIndex = index;
    }
  }
  if (lowerIndex < 0) return { lower: NaN, upper: NaN, valid: false };
  let connected = true;
  for (let index = lowerIndex; index <= upperIndex; index += 1) {
    if (accepted[index] === 0) connected = false;
  }
  return {
    lower: lowerIndex,
    upper: upperIndex,
    valid: connected && lowerIndex <= maximumIndex && maximumIndex <= upperIndex,
  };
}

/**
 * Deterministic numerical-kernel diagnostic used only for cross-language
 * verification. The production exploration does not use the chi-square
 * diagnostic as a Warm interval; Warm intervals are simulation-calibrated.
 */
export function summarizeIntervalNumericalKernel(
  itemBank: Item[],
  administered: number[],
  responses: Array<0 | 1>,
  priorStandardDeviation: number
): IntervalNumericalKernelSummary {
  if (
    administered.length === 0 ||
    administered.length !== responses.length ||
    new Set(administered).size !== administered.length ||
    administered.some(
      (index) => !Number.isInteger(index) || index < 0 || index >= itemBank.length
    ) ||
    responses.some((response) => response !== 0 && response !== 1) ||
    !Number.isFinite(priorStandardDeviation) ||
    priorStandardDeviation <= 0
  ) {
    throw new RangeError("Invalid interval numerical-kernel inputs.");
  }
  const { min, max, step } = PAPER_3PL_CONFIG.thetaGrid;
  const grid = Array.from(
    { length: Math.round((max - min) / step) + 1 },
    (_, index) => min + index * step
  );
  const logLikelihood = new Float64Array(grid.length);
  const information = new Float64Array(grid.length);
  for (let responseIndex = 0; responseIndex < administered.length; responseIndex += 1) {
    const item = itemBank[administered[responseIndex]];
    const response = responses[responseIndex];
    for (let gridIndex = 0; gridIndex < grid.length; gridIndex += 1) {
      const probability = paperProbability3pl(grid[gridIndex], item);
      logLikelihood[gridIndex] +=
        response === 1 ? Math.log(probability) : Math.log1p(-probability);
      information[gridIndex] += paperItemInformation3pl(grid[gridIndex], item);
    }
  }
  const logWeightedLikelihood = Float64Array.from(
    logLikelihood,
    (value, index) => value + 0.5 * Math.log(Math.max(information[index], 1e-300))
  );
  const logPosterior = Float64Array.from(
    logLikelihood,
    (value, index) =>
      value - 0.5 * (grid[index] / priorStandardDeviation) ** 2
  );
  let posteriorMaximum = Number.NEGATIVE_INFINITY;
  for (const value of logPosterior) posteriorMaximum = Math.max(posteriorMaximum, value);
  const posterior = Float64Array.from(logPosterior, (value) =>
    Math.exp(value - posteriorMaximum)
  );
  normalize(posterior);
  const eap = posteriorMean(grid, posterior);
  let variance = 0;
  for (let index = 0; index < grid.length; index += 1) {
    variance += posterior[index] * (grid[index] - eap) ** 2;
  }
  const maximumIndex = (values: Float64Array): number => {
    let result = 0;
    for (let index = 1; index < values.length; index += 1) {
      if (values[index] > values[result]) result = index;
    }
    return result;
  };
  const cutoff = new Float64Array(grid.length).fill(3.841458820694124);
  const likelihoodRatioInterval = objectiveInterval(logLikelihood, cutoff);
  const warmDiagnostic = objectiveInterval(logWeightedLikelihood, cutoff);
  const thetaZeroIndex = nearestGridIndex(grid, 0);
  const asThetaInterval = (interval: IntervalResult) => ({
    lower: interval.valid ? grid[interval.lower] : NaN,
    upper: interval.valid ? grid[interval.upper] : NaN,
    valid: interval.valid,
  });
  return {
    priorStandardDeviation,
    eap,
    posteriorStandardDeviation: Math.sqrt(variance),
    posteriorEqualTail95: {
      lower: weightedQuantile(grid, posterior, 0.025),
      upper: weightedQuantile(grid, posterior, 0.975),
    },
    likelihoodMaximumThetaOnGrid: grid[maximumIndex(logLikelihood)],
    warmWeightedLikelihoodMaximumThetaOnGrid:
      grid[maximumIndex(logWeightedLikelihood)],
    likelihoodRatioChiSquare95: asThetaInterval(likelihoodRatioInterval),
    warmWeightedLikelihoodChiSquareDiagnostic95:
      asThetaInterval(warmDiagnostic),
    likelihoodRatioAtThetaZero: likelihoodRatioStatistic(
      logLikelihood,
      thetaZeroIndex
    ),
    warmWeightedLikelihoodRatioAtThetaZero: likelihoodRatioStatistic(
      logWeightedLikelihood,
      thetaZeroIndex
    ),
  };
}

function eapNeymanInterval(
  eap: number,
  grid: readonly number[],
  curve: CalibrationCurve
): IntervalResult {
  if (curve.lowerValues === null || curve.upperValues === null) {
    throw new RangeError("EAP calibration curve is incomplete.");
  }
  const accepted = grid.map((theta) => {
    const lower = interpolate(
      curve.calibrationThetas,
      curve.lowerValues as number[],
      theta
    );
    const upper = interpolate(
      curve.calibrationThetas,
      curve.upperValues as number[],
      theta
    );
    return lower <= eap && eap <= upper;
  });
  const indices = accepted
    .map((value, index) => (value ? index : -1))
    .filter((index) => index >= 0);
  if (indices.length === 0) return { lower: NaN, upper: NaN, valid: false };
  const lower = indices[0];
  const upper = indices[indices.length - 1];
  return {
    lower,
    upper,
    valid: indices.length === upper - lower + 1,
  };
}

function computeInterval(
  cache: ModelCache,
  statistics: TrialStatistics,
  method: IntervalMethodSpecification,
  curve: CalibrationCurve | undefined
): IntervalResult {
  if (method.kind === "posterior-equal-tail") {
    return {
      lower: nearestGridIndex(cache.grid, statistics.posteriorLower),
      upper: nearestGridIndex(cache.grid, statistics.posteriorUpper),
      valid: true,
    };
  }
  if (method.kind === "eap-central-calibrated") {
    if (curve === undefined) throw new RangeError("EAP curve missing.");
    return eapNeymanInterval(statistics.eap, cache.grid, curve);
  }
  let cutoffs: Float64Array;
  if (method.kind === "likelihood-ratio-fixed-cutoff") {
    if (method.cutoff === undefined) throw new RangeError("Fixed cutoff missing.");
    cutoffs = new Float64Array(cache.grid.length).fill(method.cutoff);
  } else {
    if (curve?.cutoffValues === null || curve?.cutoffValues === undefined) {
      throw new RangeError("Calibrated cutoff curve missing.");
    }
    cutoffs = Float64Array.from(cache.grid, (theta) =>
      interpolate(curve.calibrationThetas, curve.cutoffValues as number[], theta)
    );
  }
  return objectiveInterval(
    method.kind === "weighted-likelihood-ratio-calibrated"
      ? statistics.logWeightedLikelihood
      : statistics.logLikelihood,
    cutoffs
  );
}

function regionAndZone(
  theta: number,
  range: InformationSupportRange,
  margin: number
): Pick<MetricsAccumulator, "region" | "zone"> {
  const region =
    theta < range.lowerTheta
      ? "below-range"
      : theta > range.upperTheta
        ? "above-range"
        : "within-range";
  let zone: MetricsAccumulator["zone"] = "boundary-indifference";
  if (region === "below-range" && range.lowerTheta - theta >= margin) {
    zone = "clearly-outside";
  } else if (region === "above-range" && theta - range.upperTheta >= margin) {
    zone = "clearly-outside";
  } else if (
    region === "within-range" &&
    Math.min(theta - range.lowerTheta, range.upperTheta - theta) >= margin
  ) {
    zone = "validated-interior";
  }
  return { region, zone };
}

function createAccumulator(
  theta: number,
  range: InformationSupportRange,
  margin: number
): MetricsAccumulator {
  const { region, zone } = regionAndZone(theta, range, margin);
  return {
    theta,
    region,
    zone,
    trials: 0,
    belowCount: 0,
    withinCount: 0,
    aboveCount: 0,
    indeterminateCount: 0,
    oppositeCount: 0,
    validIntervalCount: 0,
    reportableCount: 0,
    invalidIntervalCount: 0,
    reportedCount: 0,
    errorSum: 0,
    squaredErrorSum: 0,
    fourthErrorSum: 0,
    coverageCount: 0,
    lowerMissCount: 0,
    upperMissCount: 0,
    thetaWidths: [],
    vocabularyCoverageCount: 0,
    vocabularyWidths: [],
  };
}

function rangeClassification(
  statistics: TrialStatistics,
  threshold: number
): "below-range" | "within-range" | "above-range" | "indeterminate" {
  if (statistics.belowProbability >= threshold) return "below-range";
  if (statistics.aboveProbability >= threshold) return "above-range";
  if (statistics.withinProbability >= threshold) return "within-range";
  return "indeterminate";
}

function addEvaluation(
  accumulator: MetricsAccumulator,
  classification: ReturnType<typeof rangeClassification>,
  interval: IntervalResult,
  cache: ModelCache,
  statistics: TrialStatistics,
  range: InformationSupportRange
): void {
  accumulator.trials += 1;
  if (classification === "below-range") accumulator.belowCount += 1;
  else if (classification === "within-range") accumulator.withinCount += 1;
  else if (classification === "above-range") accumulator.aboveCount += 1;
  else accumulator.indeterminateCount += 1;
  const opposite =
    (accumulator.region === "below-range" && classification === "above-range") ||
    (accumulator.region === "above-range" && classification === "below-range");
  accumulator.oppositeCount += opposite ? 1 : 0;

  const pointIndex = nearestGridIndex(cache.grid, statistics.eap);
  const indexValid =
    interval.valid &&
    Number.isInteger(interval.lower) &&
    Number.isInteger(interval.upper) &&
    interval.lower > 0 &&
    interval.upper < cache.grid.length - 1 &&
    interval.lower <= pointIndex &&
    pointIndex <= interval.upper;
  accumulator.validIntervalCount += indexValid ? 1 : 0;
  accumulator.invalidIntervalCount += indexValid ? 0 : 1;
  const endpointsInside =
    indexValid &&
    cache.grid[interval.lower] >= range.lowerTheta &&
    cache.grid[interval.upper] <= range.upperTheta;
  const reportable = classification === "within-range" && endpointsInside;
  accumulator.reportableCount += reportable ? 1 : 0;
  if (!reportable) return;

  accumulator.reportedCount += 1;
  const error = statistics.eap - accumulator.theta;
  accumulator.errorSum += error;
  accumulator.squaredErrorSum += error ** 2;
  accumulator.fourthErrorSum += error ** 4;
  const lowerTheta = cache.grid[interval.lower];
  const upperTheta = cache.grid[interval.upper];
  if (accumulator.theta < lowerTheta) accumulator.lowerMissCount += 1;
  else if (accumulator.theta > upperTheta) accumulator.upperMissCount += 1;
  else accumulator.coverageCount += 1;
  accumulator.thetaWidths.push(upperTheta - lowerTheta);
  const lowerVocabulary = cache.vocabularyValues[interval.lower];
  const upperVocabulary = cache.vocabularyValues[interval.upper];
  const trueVocabulary = paperVocabularyAtThetaFromMeans(
    accumulator.theta,
    cache.levelMeans
  );
  accumulator.vocabularyCoverageCount +=
    lowerVocabulary <= trueVocabulary && trueVocabulary <= upperVocabulary
      ? 1
      : 0;
  accumulator.vocabularyWidths.push(upperVocabulary - lowerVocabulary);
}

function sampleQuantile(values: readonly number[], probability: number): number {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.ceil(probability * sorted.length) - 1];
}

function meanMcse(sum: number, sumSquares: number, n: number): number {
  if (n <= 1) return 0;
  return Math.sqrt(
    Math.max(0, (sumSquares - sum ** 2 / n) / (n - 1)) / n
  );
}

function rmseMcse(sumSquares: number, sumFourth: number, n: number): number {
  const mse = sumSquares / n;
  if (n <= 1 || mse === 0) return 0;
  const variance = Math.max(
    0,
    (sumFourth - sumSquares ** 2 / n) / (n - 1)
  );
  return Math.sqrt(variance / n) / (2 * Math.sqrt(mse));
}

function summarizeAccumulator(
  accumulator: MetricsAccumulator
): IntervalConditionalMetrics {
  const n = accumulator.trials;
  const reported = accumulator.reportedCount;
  const rate = (count: number): number => count / n;
  return {
    trueTheta: accumulator.theta,
    trueRegion: accumulator.region,
    evaluationZone: accumulator.zone,
    trials: n,
    rangeClassificationRates: {
      belowRange: rate(accumulator.belowCount),
      withinRange: rate(accumulator.withinCount),
      aboveRange: rate(accumulator.aboveCount),
      indeterminate: rate(accumulator.indeterminateCount),
    },
    oppositeExtremeRate: rate(accumulator.oppositeCount),
    intervalValidRate: rate(accumulator.validIntervalCount),
    reportableRate: rate(accumulator.reportableCount),
    falseNumericReportRate:
      accumulator.region === "within-range"
        ? null
        : rate(accumulator.reportableCount),
    invalidIntervalRate: rate(accumulator.invalidIntervalCount),
    reportedTrials: reported,
    thetaBiasReported: reported > 0 ? accumulator.errorSum / reported : null,
    thetaRmseReported:
      reported > 0 ? Math.sqrt(accumulator.squaredErrorSum / reported) : null,
    thetaCoverageReported:
      reported > 0 ? accumulator.coverageCount / reported : null,
    lowerMissRateReported:
      reported > 0 ? accumulator.lowerMissCount / reported : null,
    upperMissRateReported:
      reported > 0 ? accumulator.upperMissCount / reported : null,
    meanThetaIntervalWidthReported:
      reported > 0
        ? accumulator.thetaWidths.reduce((sum, value) => sum + value, 0) /
          reported
        : null,
    p90ThetaIntervalWidthReported:
      reported > 0 ? sampleQuantile(accumulator.thetaWidths, 0.9) : null,
    vocabularyCoverageReported:
      reported > 0 ? accumulator.vocabularyCoverageCount / reported : null,
    meanVocabularyIntervalWidthReported:
      reported > 0
        ? accumulator.vocabularyWidths.reduce((sum, value) => sum + value, 0) /
          reported
        : null,
    monteCarloStandardErrors: {
      thetaBiasReported:
        reported > 0
          ? meanMcse(
              accumulator.errorSum,
              accumulator.squaredErrorSum,
              reported
            )
          : null,
      thetaRmseReported:
        reported > 0
          ? rmseMcse(
              accumulator.squaredErrorSum,
              accumulator.fourthErrorSum,
              reported
            )
          : null,
    },
  };
}

function wilsonBounds(
  rate: number,
  trials: number,
  z: number
): { lower: number; upper: number } {
  const z2 = z ** 2;
  const denominator = 1 + z2 / trials;
  const center = (rate + z2 / (2 * trials)) / denominator;
  const half =
    (z / denominator) *
    Math.sqrt(rate * (1 - rate) / trials + z2 / (4 * trials ** 2));
  return { lower: center - half, upper: center + half };
}

function nullableMaximum(values: Array<number | null>): number | null {
  const finite = values.filter((value): value is number => value !== null);
  return finite.length === 0 ? null : Math.max(...finite);
}

function nullableMinimum(values: Array<number | null>): number | null {
  const finite = values.filter((value): value is number => value !== null);
  return finite.length === 0 ? null : Math.min(...finite);
}

function summarizeMethod(
  conditional: IntervalConditionalMetrics[],
  criteria: IntervalCalibrationDecisionCriteria
): IntervalMethodSummary {
  const outside = conditional.filter(
    ({ evaluationZone }) => evaluationZone === "clearly-outside"
  );
  const interior = conditional.filter(
    ({ evaluationZone }) => evaluationZone === "validated-interior"
  );
  const reported = interior.filter(({ reportedTrials }) => reportedTrials > 0);
  const upperRate = (value: number, trials: number): number =>
    wilsonBounds(value, trials, criteria.equivalenceZ).upper;
  const lowerRate = (value: number, trials: number): number =>
    wilsonBounds(value, trials, criteria.equivalenceZ).lower;

  const outsideFalseNumericReporting =
    outside.length > 0 &&
    outside.every(
      (cell) =>
        cell.falseNumericReportRate !== null &&
        upperRate(cell.falseNumericReportRate, cell.trials) <=
          criteria.maximumFalseNumericReportRateOutside
    );
  const oppositeExtremeClassification = conditional.every(
    (cell) =>
      upperRate(cell.oppositeExtremeRate, cell.trials) <=
      criteria.maximumOppositeExtremeRate
  );
  const interiorReportability =
    interior.length > 0 &&
    interior.every(
      (cell) =>
        lowerRate(cell.reportableRate, cell.trials) >=
        criteria.minimumReportableRateInterior
    );
  const interiorIntervalValidity =
    interior.length > 0 &&
    interior.every(
      (cell) =>
        upperRate(cell.invalidIntervalRate, cell.trials) <=
        criteria.maximumInvalidIntervalRateInterior
    );
  const reportedThetaBias =
    reported.length === interior.length &&
    reported.every(
      (cell) =>
        cell.thetaBiasReported !== null &&
        cell.monteCarloStandardErrors.thetaBiasReported !== null &&
        Math.abs(cell.thetaBiasReported) +
          criteria.equivalenceZ *
            cell.monteCarloStandardErrors.thetaBiasReported <=
          criteria.maximumAbsoluteThetaBiasReported
    );
  const reportedThetaRmse =
    reported.length === interior.length &&
    reported.every(
      (cell) =>
        cell.thetaRmseReported !== null &&
        cell.monteCarloStandardErrors.thetaRmseReported !== null &&
        cell.thetaRmseReported +
          criteria.equivalenceZ *
            cell.monteCarloStandardErrors.thetaRmseReported <=
          criteria.maximumThetaRmseReported
    );
  const reportedCoverage =
    reported.length === interior.length &&
    reported.every((cell) => {
      if (cell.thetaCoverageReported === null) return false;
      const bounds = wilsonBounds(
        cell.thetaCoverageReported,
        cell.reportedTrials,
        criteria.equivalenceZ
      );
      return (
        bounds.lower >= criteria.minimumCoverage &&
        bounds.upper <= criteria.maximumCoverage
      );
    });
  const reportedTailBalance =
    reported.length === interior.length &&
    reported.every(
      (cell) =>
        cell.lowerMissRateReported !== null &&
        cell.upperMissRateReported !== null &&
        upperRate(cell.lowerMissRateReported, cell.reportedTrials) <=
          criteria.maximumOneSidedMissRate &&
        upperRate(cell.upperMissRateReported, cell.reportedTrials) <=
          criteria.maximumOneSidedMissRate
    );
  const reportedMeanWidth =
    reported.length === interior.length &&
    reported.every(
      (cell) =>
        cell.meanThetaIntervalWidthReported !== null &&
        cell.meanThetaIntervalWidthReported <=
          criteria.maximumMeanThetaIntervalWidth
    );
  const reportedP90Width =
    reported.length === interior.length &&
    reported.every(
      (cell) =>
        cell.p90ThetaIntervalWidthReported !== null &&
        cell.p90ThetaIntervalWidthReported <=
          criteria.maximumP90ThetaIntervalWidth
    );
  const gates = {
    outsideFalseNumericReporting,
    oppositeExtremeClassification,
    interiorReportability,
    interiorIntervalValidity,
    reportedThetaBias,
    reportedThetaRmse,
    reportedCoverage,
    reportedTailBalance,
    reportedMeanWidth,
    reportedP90Width,
  };
  return {
    passesAllGates: Object.values(gates).every(Boolean),
    gates,
    failedGates: Object.entries(gates)
      .filter(([, passed]) => !passed)
      .map(([gate]) => gate),
    observed: {
      maximumFalseNumericReportRateOutside: nullableMaximum(
        outside.map((cell) => cell.falseNumericReportRate)
      ),
      maximumOppositeExtremeRate: Math.max(
        ...conditional.map((cell) => cell.oppositeExtremeRate)
      ),
      minimumReportableRateInterior: nullableMinimum(
        interior.map((cell) => cell.reportableRate)
      ),
      maximumInvalidIntervalRateInterior: nullableMaximum(
        interior.map((cell) => cell.invalidIntervalRate)
      ),
      maximumAbsoluteThetaBiasReported: nullableMaximum(
        reported.map((cell) =>
          cell.thetaBiasReported === null
            ? null
            : Math.abs(cell.thetaBiasReported)
        )
      ),
      maximumThetaRmseReported: nullableMaximum(
        reported.map((cell) => cell.thetaRmseReported)
      ),
      minimumCoverageReported: nullableMinimum(
        reported.map((cell) => cell.thetaCoverageReported)
      ),
      maximumCoverageReported: nullableMaximum(
        reported.map((cell) => cell.thetaCoverageReported)
      ),
      maximumLowerMissRate: nullableMaximum(
        reported.map((cell) => cell.lowerMissRateReported)
      ),
      maximumUpperMissRate: nullableMaximum(
        reported.map((cell) => cell.upperMissRateReported)
      ),
      maximumMeanThetaIntervalWidth: nullableMaximum(
        reported.map((cell) => cell.meanThetaIntervalWidthReported)
      ),
      maximumP90ThetaIntervalWidth: nullableMaximum(
        reported.map((cell) => cell.p90ThetaIntervalWidthReported)
      ),
    },
  };
}

function validatePlan(itemBank: Item[], plan: IntervalCalibrationPlan): void {
  if (itemBank.length === 0 || plan.planId.trim().length === 0) {
    throw new RangeError("Interval calibration requires bank and plan ID.");
  }
  if (
    plan.calibrationSeed === plan.evaluationSeed ||
    !Number.isSafeInteger(plan.calibrationSeed) ||
    !Number.isSafeInteger(plan.evaluationSeed) ||
    plan.calibrationSeed < 0 ||
    plan.evaluationSeed < 0
  ) {
    throw new RangeError(
      "Calibration and evaluation seeds must be distinct nonnegative integers."
    );
  }
  if (
    !Number.isInteger(plan.calibrationReplicationsPerTheta) ||
    !Number.isInteger(plan.evaluationReplicationsPerTheta) ||
    plan.calibrationReplicationsPerTheta < 1 ||
    plan.evaluationReplicationsPerTheta < 1
  ) {
    throw new RangeError("Replication counts must be positive integers.");
  }
  const assertTheta = (values: number[], label: string): void => {
    if (
      values.length === 0 ||
      new Set(values).size !== values.length ||
      values.some((theta, index) => index > 0 && theta <= values[index - 1]) ||
      values.some(
        (theta) =>
          !Number.isFinite(theta) ||
          theta < plan.inversionGrid.minimumTheta ||
          theta > plan.inversionGrid.maximumTheta
      )
    ) {
      throw new RangeError(
        `${label} must be strictly increasing, unique, and inside inversion grid.`
      );
    }
  };
  const paperGrid = PAPER_3PL_CONFIG.thetaGrid;
  if (
    plan.inversionGrid.minimumTheta !== paperGrid.min ||
    plan.inversionGrid.maximumTheta !== paperGrid.max ||
    plan.inversionGrid.step !== paperGrid.step
  ) {
    throw new RangeError("Interval inversion must use the frozen paper-3pl-v1 grid.");
  }
  assertTheta(plan.calibrationThetas, "Calibration thetas");
  assertTheta(plan.evaluationThetas, "Evaluation thetas");
  if (
    plan.reportingCandidates.length === 0 ||
    plan.intervalMethods.length === 0 ||
    new Set(plan.reportingCandidates.map(({ id }) => id)).size !==
      plan.reportingCandidates.length ||
    new Set(plan.intervalMethods.map(({ id }) => id)).size !==
      plan.intervalMethods.length
  ) {
    throw new RangeError("Candidate and interval method IDs must be nonempty and unique.");
  }
  for (const candidate of plan.reportingCandidates) {
    if (
      candidate.id.trim().length === 0 ||
      !Number.isInteger(candidate.fixedLength) ||
      candidate.fixedLength < plan.minimumHighLevelItems ||
      candidate.fixedLength > itemBank.length ||
      !Number.isFinite(candidate.reportingPriorMean) ||
      !Number.isFinite(candidate.reportingPriorStandardDeviation) ||
      candidate.reportingPriorStandardDeviation <= 0 ||
      !Number.isFinite(candidate.informationEquivalentStandardDeviationThreshold) ||
      candidate.informationEquivalentStandardDeviationThreshold <= 0 ||
      !Number.isFinite(candidate.posteriorMassThreshold) ||
      candidate.posteriorMassThreshold <= 0.5 ||
      candidate.posteriorMassThreshold >= 1 ||
      (candidate.selectionMethod === "randomesque" &&
        (!Number.isInteger(candidate.randomesqueSize) ||
          (candidate.randomesqueSize ?? 0) < 1 ||
          (candidate.randomesqueSize ?? 0) > itemBank.length)) ||
      (candidate.selectionMethod === "maximum-information" &&
        candidate.randomesqueSize !== undefined)
    ) {
      throw new RangeError("Invalid reporting candidate.");
    }
  }
  const expectedMethods = new Map<string, IntervalKind>([
    ["eap-equal-tail", "posterior-equal-tail"],
    ["likelihood-ratio-chi-square", "likelihood-ratio-fixed-cutoff"],
    ["likelihood-ratio-neyman", "likelihood-ratio-calibrated"],
    [
      "warm-weighted-likelihood-neyman",
      "weighted-likelihood-ratio-calibrated",
    ],
    ["eap-neyman-central", "eap-central-calibrated"],
  ]);
  for (const method of plan.intervalMethods) {
    const expectedKind = expectedMethods.get(method.id);
    const fixedCutoffValid =
      method.id === "likelihood-ratio-chi-square"
        ? method.cutoff === 3.841458820694124
        : method.cutoff === undefined;
    if (expectedKind !== method.kind || !fixedCutoffValid) {
      throw new RangeError("Invalid frozen interval method contract.");
    }
  }
  if (plan.intervalMethods.length !== expectedMethods.size) {
    throw new RangeError("Every frozen interval method must be present exactly once.");
  }
  const criteria = plan.decisionCriteria;
  const unitIntervalValues = [
    plan.nominalCoverage,
    criteria.maximumFalseNumericReportRateOutside,
    criteria.maximumOppositeExtremeRate,
    criteria.minimumReportableRateInterior,
    criteria.maximumInvalidIntervalRateInterior,
    criteria.minimumCoverage,
    criteria.maximumCoverage,
    criteria.maximumOneSidedMissRate,
  ];
  const positiveValues = [
    plan.selectionPriorStandardDeviation,
    criteria.equivalenceZ,
    criteria.maximumAbsoluteThetaBiasReported,
    criteria.maximumThetaRmseReported,
    criteria.maximumMeanThetaIntervalWidth,
    criteria.maximumP90ThetaIntervalWidth,
  ];
  const contentLevels = itemBank.map(({ Level }) => Level);
  const minimumBankLevel = Math.min(...contentLevels);
  const maximumBankLevel = Math.max(...contentLevels);
  if (
    !Number.isFinite(plan.selectionPriorMean) ||
    positiveValues.some((value) => !Number.isFinite(value) || value <= 0) ||
    unitIntervalValues.some(
      (value) => !Number.isFinite(value) || value <= 0 || value >= 1
    ) ||
    criteria.minimumCoverage >= criteria.maximumCoverage ||
    !Number.isFinite(plan.boundaryIndifferenceMargin) ||
    plan.boundaryIndifferenceMargin < 0 ||
    !Number.isInteger(plan.initialLevelMinimum) ||
    !Number.isInteger(plan.initialLevelMaximum) ||
    !Number.isInteger(plan.highLevelFloor) ||
    !Number.isInteger(plan.minimumHighLevelItems) ||
    plan.initialLevelMinimum > plan.initialLevelMaximum ||
    plan.initialLevelMinimum < minimumBankLevel ||
    plan.initialLevelMaximum > maximumBankLevel ||
    plan.highLevelFloor < minimumBankLevel ||
    plan.highLevelFloor > maximumBankLevel ||
    plan.minimumHighLevelItems < 0 ||
    itemBank.filter(({ Level }) => Level >= plan.highLevelFloor).length <
      plan.minimumHighLevelItems
  ) {
    throw new RangeError("Invalid numeric, grid, or content calibration contract.");
  }
  const isPermutation = (actual: string[], expected: string[]): boolean =>
    actual.length === expected.length &&
    new Set(actual).size === actual.length &&
    actual.every((id) => expected.includes(id));
  const candidateIds = plan.reportingCandidates.map(({ id }) => id);
  const methodIds = plan.intervalMethods.map(({ id }) => id);
  if (
    plan.calibrationQuantileMethod !== "conservative-order-statistic-v1" ||
    plan.isotonicEapAcceptanceBounds !== true ||
    plan.decisionCriteria.binomialIntervalMethod !== "wilson-score-tost" ||
    plan.selectionPreference.tieBreaker !==
      "smallest-maximum-conditional-mean-theta-width" ||
    !isPermutation(plan.selectionPreference.candidateOrder, candidateIds) ||
    !isPermutation(plan.selectionPreference.methodOrder, methodIds)
  ) {
    throw new RangeError("Invalid frozen calibration or selection contract.");
  }
}

function clonePlan(plan: IntervalCalibrationPlan): IntervalCalibrationPlan {
  return JSON.parse(JSON.stringify(plan)) as IntervalCalibrationPlan;
}

export function runIntervalCalibrationSimulation(
  itemBank: Item[],
  itemBankSha256: string,
  plan: IntervalCalibrationPlan,
  planSha256: string | null = null,
  provenance: IntervalCalibrationProvenance | null = null
): IntervalCalibrationReport {
  validatePlan(itemBank, plan);
  const cache = buildCache(itemBank, plan);
  const curves = buildCalibrationCurves(itemBank, cache, plan);
  const results: IntervalCalibrationReport["results"] = [];

  for (
    let candidateIndex = 0;
    candidateIndex < plan.reportingCandidates.length;
    candidateIndex += 1
  ) {
    const candidate = plan.reportingCandidates[candidateIndex];
    const range = deriveInformationSupportRange(itemBank, {
      informationEquivalentStandardDeviationThreshold:
        candidate.informationEquivalentStandardDeviationThreshold,
    });
    const exposureCounts = new Uint32Array(itemBank.length);
    const accumulators = new Map(
      plan.intervalMethods.map((method) => [
        method.id,
        plan.evaluationThetas.map((theta) =>
          createAccumulator(theta, range, plan.boundaryIndifferenceMargin)
        ),
      ])
    );
    for (
      let thetaIndex = 0;
      thetaIndex < plan.evaluationThetas.length;
      thetaIndex += 1
    ) {
      const theta = plan.evaluationThetas[thetaIndex];
      for (
        let replication = 0;
        replication < plan.evaluationReplicationsPerTheta;
        replication += 1
      ) {
        const statistics = trialStatistics(
          itemBank,
          cache,
          plan,
          candidate,
          range,
          theta,
          createDeterministicRandom(
            deriveSeed(
              plan.evaluationSeed,
              thetaIndex,
              replication,
              0x52
            )
          ),
          createDeterministicRandom(
            deriveSeed(
              plan.evaluationSeed,
              thetaIndex,
              replication,
              0x53
            )
          ),
          exposureCounts
        );
        const classification = rangeClassification(
          statistics,
          candidate.posteriorMassThreshold
        );
        for (const method of plan.intervalMethods) {
          const curve = curves.find(
            (candidateCurve) =>
              candidateCurve.candidateId === candidate.id &&
              candidateCurve.methodId === method.id
          );
          const interval = computeInterval(cache, statistics, method, curve);
          const accumulator = accumulators.get(method.id)?.[thetaIndex];
          if (accumulator === undefined) throw new RangeError("Accumulator missing.");
          addEvaluation(
            accumulator,
            classification,
            interval,
            cache,
            statistics,
            range
          );
        }
      }
    }
    const totalTrials =
      plan.evaluationThetas.length * plan.evaluationReplicationsPerTheta;
    const maximumExposureRate = Math.max(...exposureCounts) / totalTrials;
    const unusedItemRate =
      Array.from(exposureCounts).filter((count) => count === 0).length /
      itemBank.length;
    results.push({
      candidate: { ...candidate },
      range,
      exposure: { maximumExposureRate, unusedItemRate },
      methods: plan.intervalMethods.map((method) => {
        const conditional = (accumulators.get(method.id) ?? []).map(
          summarizeAccumulator
        );
        return {
          method: { ...method },
          summary: summarizeMethod(conditional, plan.decisionCriteria),
          conditional,
        };
      }),
    });
  }

  const passing = results.flatMap((result) =>
    result.methods
      .filter(({ summary }) => summary.passesAllGates)
      .map((method) => ({ result, method }))
  );
  passing.sort((left, right) => {
    const candidateDifference =
      plan.selectionPreference.candidateOrder.indexOf(left.result.candidate.id) -
      plan.selectionPreference.candidateOrder.indexOf(right.result.candidate.id);
    if (candidateDifference !== 0) return candidateDifference;
    const methodDifference =
      plan.selectionPreference.methodOrder.indexOf(left.method.method.id) -
      plan.selectionPreference.methodOrder.indexOf(right.method.method.id);
    if (methodDifference !== 0) return methodDifference;
    return (
      (left.method.summary.observed.maximumMeanThetaIntervalWidth ?? Infinity) -
      (right.method.summary.observed.maximumMeanThetaIntervalWidth ?? Infinity)
    );
  });
  const passingIds = passing.map(
    ({ result, method }) => `${result.candidate.id}__${method.method.id}`
  );
  return {
    schemaVersion: "interval-calibration-simulation-v1",
    engineId: "common-path-neyman-interval-calibration-v1",
    randomGeneratorId: "mulberry32-v1",
    scoreModelId: PAPER_3PL_CONFIG.scoreModelId,
    commonRandomNumbersAcrossCandidates: true,
    commonResponsePathsWithinCandidate: true,
    calibrationEvaluationSeedsSeparated: true,
    validationStatus: "exploratory-not-for-score-reporting",
    itemBankSha256,
    planSha256,
    provenance:
      provenance === null
        ? null
        : { ...provenance, sourceSha256: { ...provenance.sourceSha256 } },
    plan: clonePlan(plan),
    calibrationCurves: curves,
    results,
    selection: {
      passingMethodIds: passingIds,
      preferredMethodId: passingIds[0] ?? null,
      productionApproved: false,
      requiredNextEvidence:
        "Freeze the complete reporting and interval rule and run at least 5,000 independent replications per theta before production reporting changes.",
    },
  };
}
