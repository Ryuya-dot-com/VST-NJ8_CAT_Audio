import type { Item } from "../types";
import {
  computeLevelParameterMeans,
  PAPER_3PL_CONFIG,
  paperItemInformation3pl,
  paperProbability3pl,
  paperVocabularyAtThetaFromMeans,
  type LevelParameterMean,
} from "./paperScoring.ts";
import {
  conservativeMonotoneAcceptanceEnvelope,
  validateSelectiveReportingPlan,
  type SelectiveReportingPlan,
  type SimultaneousCentralRanks,
} from "./selectiveReportingPlan.ts";

export interface SelectiveReportingProvenance {
  nodeVersion: string;
  platform: string;
  architecture: string;
  sourceSha256: Record<string, string>;
}

export interface SelectiveCalibrationCell {
  trueTheta: number;
  generatedPaths: number;
  selectedPaths: number;
  selectedRate: number;
  rawLowerAcceptanceLimit: number;
  rawUpperAcceptanceLimit: number;
  lowerAcceptanceLimit: number;
  upperAcceptanceLimit: number;
}

export interface SelectiveConditionalMetrics {
  trueTheta: number;
  trueRegion: "below-range" | "within-range" | "above-range";
  evaluationZone:
    | "clearly-outside"
    | "validated-interior"
    | "supported-boundary"
    | "boundary-indifference";
  generatedPaths: number;
  rangeClassificationRates: {
    belowRange: number;
    withinRange: number;
    aboveRange: number;
    indeterminate: number;
  };
  oppositeExtremeRate: number;
  selectedPaths: number;
  selectedRate: number;
  emptyInversionFallbackRateSelected: number | null;
  thetaBiasSelected: number | null;
  thetaRmseSelected: number | null;
  thetaCoverageSelected: number | null;
  lowerMissRateSelected: number | null;
  upperMissRateSelected: number | null;
  meanThetaIntervalWidthSelected: number | null;
  p90ThetaIntervalWidthSelected: number | null;
  vocabularyCoverageSelected: number | null;
  meanVocabularyIntervalWidthSelected: number | null;
  monteCarloStandardErrors: {
    thetaBiasSelected: number | null;
    thetaRmseSelected: number | null;
  };
}

export interface SelectiveMethodSummary {
  passesAllGates: boolean;
  gates: {
    outsideFalseNumericReporting: boolean;
    oppositeExtremeClassification: boolean;
    interiorReportability: boolean;
    supportedThetaEvidence: boolean;
    emptyInversionFallback: boolean;
    selectedThetaBias: boolean;
    selectedThetaRmse: boolean;
    selectedCoverage: boolean;
    selectedTailBalance: boolean;
    selectedMeanWidth: boolean;
    selectedP90Width: boolean;
  };
  failedGates: string[];
  observed: {
    maximumFalseNumericReportRateOutside: number | null;
    maximumOppositeExtremeRate: number;
    minimumReportableRateInterior: number | null;
    minimumSelectedPathsSupportedTheta: number | null;
    maximumEmptyInversionFallbackRateSelected: number | null;
    maximumAbsoluteThetaBiasSelected: number | null;
    maximumThetaRmseSelected: number | null;
    minimumCoverageSelected: number | null;
    maximumCoverageSelected: number | null;
    maximumLowerMissRateSelected: number | null;
    maximumUpperMissRateSelected: number | null;
    maximumMeanThetaIntervalWidthSelected: number | null;
    maximumP90ThetaIntervalWidthSelected: number | null;
    aggregateFalseCoverageStatementRateSupportedTheta: number | null;
  };
}

export interface SelectiveReportingReport {
  schemaVersion: "selective-reporting-simulation-v1";
  engineId: "conditional-eap-neyman-selective-reporting-v1";
  randomGeneratorId: "mulberry32-v1";
  scoreModelId: string;
  calibrationEvaluationSeedsSeparated: true;
  intervalIndependentSelectionEvent: true;
  validationStatus: "exploratory-not-for-score-reporting";
  itemBankSha256: string;
  planSha256: string | null;
  provenance: SelectiveReportingProvenance | null;
  plan: SelectiveReportingPlan;
  simultaneousCentralRanks: SimultaneousCentralRanks;
  calibration: {
    succeeded: true;
    totalGeneratedPaths: number;
    totalSelectedPaths: number;
    cells: SelectiveCalibrationCell[];
  };
  exposure: {
    maximumExposureRate: number;
    unusedItemRate: number;
  };
  selectableMethod: {
    id: "selective-eap-neyman-central";
    summary: SelectiveMethodSummary;
    conditional: SelectiveConditionalMetrics[];
  };
  diagnosticBaseline: {
    id: "eap-equal-tail-diagnostic-only";
    selectable: false;
    summary: SelectiveMethodSummary;
    conditional: SelectiveConditionalMetrics[];
  };
  selection: {
    passesExploratoryGates: boolean;
    preferredMethodId: "selective-eap-neyman-central" | null;
    productionApproved: false;
    requiredNextEvidence: string;
  };
}

interface ModelCache {
  grid: number[];
  probabilities: Float64Array[];
  selectionPrior: Float64Array;
  reportingToSelectionPriorRatio: Float64Array;
  levelMeans: LevelParameterMean[];
  initialCandidates: number[];
}

interface PathStatistics {
  eap: number;
  posteriorLower: number;
  posteriorUpper: number;
  belowProbability: number;
  withinProbability: number;
  aboveProbability: number;
}

interface ThetaInterval {
  lower: number;
  upper: number;
  usedEmptyFallback: boolean;
}

interface Accumulator {
  theta: number;
  region: SelectiveConditionalMetrics["trueRegion"];
  zone: SelectiveConditionalMetrics["evaluationZone"];
  generated: number;
  below: number;
  within: number;
  above: number;
  indeterminate: number;
  opposite: number;
  selected: number;
  emptyFallback: number;
  errorSum: number;
  squaredErrorSum: number;
  fourthErrorSum: number;
  covered: number;
  lowerMiss: number;
  upperMiss: number;
  thetaWidths: number[];
  vocabularyCovered: number;
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
    throw new RangeError("Selective posterior cannot be normalized.");
  }
  for (let index = 0; index < weights.length; index += 1) {
    weights[index] /= total;
  }
}

function normalWeights(
  grid: readonly number[],
  mean: number,
  standardDeviation: number
): Float64Array {
  const result = Float64Array.from(grid, (theta) =>
    Math.exp(-0.5 * ((theta - mean) / standardDeviation) ** 2)
  );
  normalize(result);
  return result;
}

function augmentedInversionGrid(plan: SelectiveReportingPlan): number[] {
  const { minimumTheta, maximumTheta, step } = plan.inversionGrid;
  const paperGrid = Array.from(
    { length: Math.round((maximumTheta - minimumTheta) / step) + 1 },
    (_, index) => minimumTheta + index * step
  );
  return [
    ...new Set([
      ...paperGrid,
      plan.informationSupportRange.lowerTheta,
      plan.informationSupportRange.upperTheta,
    ]),
  ].sort((left, right) => left - right);
}

function buildCache(itemBank: Item[], plan: SelectiveReportingPlan): ModelCache {
  const { min, max, step } = PAPER_3PL_CONFIG.thetaGrid;
  const grid = Array.from(
    { length: Math.round((max - min) / step) + 1 },
    (_, index) => min + index * step
  );
  const probabilities = itemBank.map((item) =>
    Float64Array.from(grid, (theta) => paperProbability3pl(theta, item))
  );
  const reportingWeights = normalWeights(
    grid,
    plan.candidate.reportingPriorMean,
    plan.candidate.reportingPriorStandardDeviation
  );
  const selectionPrior = normalWeights(
    grid,
    plan.candidate.selectionPriorMean,
    plan.candidate.selectionPriorStandardDeviation
  );
  const levelMeans = computeLevelParameterMeans(itemBank);
  const initialCandidates = itemBank
    .map((item, index) => ({ item, index }))
    .filter(
      ({ item }) =>
        item.Level >= plan.initialLevelMinimum &&
        item.Level <= plan.initialLevelMaximum
    )
    .map(({ index }) => index);
  if (initialCandidates.length === 0) throw new RangeError("No initial items.");
  return {
    grid,
    probabilities,
    selectionPrior,
    reportingToSelectionPriorRatio: Float64Array.from(
      reportingWeights,
      (value, index) => value / selectionPrior[index]
    ),
    levelMeans,
    initialCandidates,
  };
}

function posteriorMean(grid: readonly number[], weights: Float64Array): number {
  let result = 0;
  for (let index = 0; index < grid.length; index += 1) {
    result += grid[index] * weights[index];
  }
  return result;
}

function updatePosterior(
  weights: Float64Array,
  probabilities: Float64Array,
  response: 0 | 1
): void {
  let total = 0;
  for (let index = 0; index < weights.length; index += 1) {
    const factor = response === 1 ? probabilities[index] : 1 - probabilities[index];
    weights[index] *= factor;
    total += weights[index];
  }
  if (!Number.isFinite(total) || total <= 0) {
    throw new RangeError("Selective posterior cannot be normalized.");
  }
  for (let index = 0; index < weights.length; index += 1) {
    weights[index] /= total;
  }
}

function chooseNext(
  itemBank: Item[],
  theta: number,
  used: Uint8Array,
  needHigh: boolean,
  plan: SelectiveReportingPlan,
  random: () => number
): number {
  const eligibleHighExists =
    needHigh &&
    itemBank.some(
      (item, index) =>
        used[index] === 0 && item.Level >= plan.highLevelFloor
    );
  const top: Array<{ index: number; information: number }> = [];
  for (let index = 0; index < itemBank.length; index += 1) {
    if (used[index] === 1) continue;
    if (eligibleHighExists && itemBank[index].Level < plan.highLevelFloor) continue;
    const candidate = {
      index,
      information: paperItemInformation3pl(theta, itemBank[index]),
    };
    let position = 0;
    while (
      position < top.length &&
      (top[position].information > candidate.information ||
        (top[position].information === candidate.information &&
          top[position].index < candidate.index))
    ) {
      position += 1;
    }
    if (position < plan.candidate.randomesqueSize) {
      top.splice(position, 0, candidate);
      if (top.length > plan.candidate.randomesqueSize) top.pop();
    }
  }
  if (top.length === 0) throw new RangeError("Item bank exhausted.");
  return top[Math.floor(random() * top.length)].index;
}

export function selectSelectiveRandomesqueItem(
  itemBank: Item[],
  theta: number,
  administered: readonly number[],
  needHigh: boolean,
  randomUnit: number,
  plan: SelectiveReportingPlan
): number {
  if (
    !Number.isFinite(theta) ||
    !Number.isFinite(randomUnit) ||
    randomUnit < 0 ||
    randomUnit >= 1 ||
    new Set(administered).size !== administered.length ||
    administered.some(
      (index) => !Number.isInteger(index) || index < 0 || index >= itemBank.length
    )
  ) {
    throw new RangeError("Invalid selective item-selection inputs.");
  }
  const used = new Uint8Array(itemBank.length);
  for (const index of administered) used[index] = 1;
  return chooseNext(
    itemBank,
    theta,
    used,
    needHigh,
    plan,
    () => randomUnit
  );
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

function generatePath(
  itemBank: Item[],
  cache: ModelCache,
  plan: SelectiveReportingPlan,
  trueTheta: number,
  responseRandom: () => number,
  selectionRandom: () => number,
  exposure: Uint32Array | null
): PathStatistics {
  const selection = new Float64Array(cache.selectionPrior);
  const used = new Uint8Array(itemBank.length);
  let next =
    cache.initialCandidates[
      Math.floor(selectionRandom() * cache.initialCandidates.length)
    ];
  let highCount = 0;
  for (let length = 0; length < plan.candidate.fixedLength; length += 1) {
    const item = itemBank[next];
    const response: 0 | 1 =
      responseRandom() < paperProbability3pl(trueTheta, item) ? 1 : 0;
    used[next] = 1;
    if (exposure !== null) exposure[next] += 1;
    if (item.Level >= plan.highLevelFloor) highCount += 1;
    updatePosterior(
      selection,
      cache.probabilities[next],
      response
    );
    if (length + 1 < plan.candidate.fixedLength) {
      next = chooseNext(
        itemBank,
        posteriorMean(cache.grid, selection),
        used,
        highCount < plan.minimumHighLevelItems,
        plan,
        selectionRandom
      );
    }
  }
  if (highCount < plan.minimumHighLevelItems) {
    throw new RangeError("Selective path violates content constraint.");
  }
  const reporting = Float64Array.from(
    selection,
    (value, index) => value * cache.reportingToSelectionPriorRatio[index]
  );
  normalize(reporting);
  const eap = posteriorMean(cache.grid, reporting);
  let belowProbability = 0;
  let withinProbability = 0;
  let aboveProbability = 0;
  for (let index = 0; index < reporting.length; index += 1) {
    const theta = cache.grid[index];
    if (theta < plan.informationSupportRange.lowerTheta) {
      belowProbability += reporting[index];
    } else if (theta > plan.informationSupportRange.upperTheta) {
      aboveProbability += reporting[index];
    } else {
      withinProbability += reporting[index];
    }
  }
  return {
    eap,
    posteriorLower: weightedQuantile(cache.grid, reporting, 0.025),
    posteriorUpper: weightedQuantile(cache.grid, reporting, 0.975),
    belowProbability,
    withinProbability,
    aboveProbability,
  };
}

export function classifySelectivePath(
  statistics: Pick<
    PathStatistics,
    "eap" | "belowProbability" | "withinProbability" | "aboveProbability"
  >,
  plan: SelectiveReportingPlan
): {
  classification: "below-range" | "within-range" | "above-range" | "indeterminate";
  selected: boolean;
} {
  const threshold = plan.candidate.posteriorMassThreshold;
  const classification =
    statistics.belowProbability >= threshold
      ? "below-range"
      : statistics.aboveProbability >= threshold
        ? "above-range"
        : statistics.withinProbability >= threshold
          ? "within-range"
          : "indeterminate";
  const selected =
    classification === "within-range" &&
    statistics.eap >= plan.informationSupportRange.lowerTheta &&
    statistics.eap <= plan.informationSupportRange.upperTheta;
  return { classification, selected };
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

export function invertSelectiveAcceptanceEnvelope(
  eap: number,
  inversionGrid: readonly number[],
  calibrationThetas: readonly number[],
  lowerAcceptanceLimits: readonly number[],
  upperAcceptanceLimits: readonly number[],
  support: { lowerTheta: number; upperTheta: number }
): ThetaInterval {
  if (
    !Number.isFinite(eap) ||
    calibrationThetas.length === 0 ||
    calibrationThetas.length !== lowerAcceptanceLimits.length ||
    calibrationThetas.length !== upperAcceptanceLimits.length ||
    !calibrationThetas.every(
      (theta, index) => index === 0 || theta > calibrationThetas[index - 1]
    ) ||
    eap < support.lowerTheta ||
    eap > support.upperTheta
  ) {
    throw new RangeError("Invalid selective interval inversion inputs.");
  }
  let lower = Number.POSITIVE_INFINITY;
  let upper = Number.NEGATIVE_INFINITY;
  for (const theta of inversionGrid) {
    if (theta < support.lowerTheta || theta > support.upperTheta) continue;
    const acceptanceLower = interpolate(
      calibrationThetas,
      lowerAcceptanceLimits,
      theta
    );
    const acceptanceUpper = interpolate(
      calibrationThetas,
      upperAcceptanceLimits,
      theta
    );
    if (acceptanceLower <= eap && eap <= acceptanceUpper) {
      lower = Math.min(lower, theta);
      upper = Math.max(upper, theta);
    }
  }
  if (!Number.isFinite(lower)) {
    return {
      lower: support.lowerTheta,
      upper: support.upperTheta,
      usedEmptyFallback: true,
    };
  }
  return {
    lower: Math.max(support.lowerTheta, Math.min(lower, eap)),
    upper: Math.min(support.upperTheta, Math.max(upper, eap)),
    usedEmptyFallback: false,
  };
}

function calibrationCells(
  itemBank: Item[],
  cache: ModelCache,
  plan: SelectiveReportingPlan,
  ranks: SimultaneousCentralRanks
): {
  totalGeneratedPaths: number;
  totalSelectedPaths: number;
  cells: SelectiveCalibrationCell[];
} {
  const raw: Array<{
    theta: number;
    generated: number;
    selectedEaps: number[];
    rawLower: number;
    rawUpper: number;
  }> = [];
  let totalGeneratedPaths = 0;
  let totalSelectedPaths = 0;
  for (
    let thetaIndex = 0;
    thetaIndex < plan.calibration.thetas.length;
    thetaIndex += 1
  ) {
    const theta = plan.calibration.thetas[thetaIndex];
    const selectedEaps: number[] = [];
    let generated = 0;
    while (
      generated < plan.calibration.maximumGeneratedPathsPerTheta &&
      selectedEaps.length < plan.calibration.targetSelectedPathsPerTheta
    ) {
      const statistics = generatePath(
        itemBank,
        cache,
        plan,
        theta,
        createDeterministicRandom(
          deriveSeed(plan.calibrationSeed, thetaIndex, generated, 0x52)
        ),
        createDeterministicRandom(
          deriveSeed(plan.calibrationSeed, thetaIndex, generated, 0x53)
        ),
        null
      );
      if (classifySelectivePath(statistics, plan).selected) {
        selectedEaps.push(statistics.eap);
      }
      generated += 1;
    }
    if (
      selectedEaps.length < plan.calibration.targetSelectedPathsPerTheta
    ) {
      throw new RangeError(
        `Calibration theta ${theta} obtained ${selectedEaps.length} selected paths before its generation cap.`
      );
    }
    selectedEaps.sort((left, right) => left - right);
    const rawLower = selectedEaps[ranks.lowerRankOneBased - 1];
    const rawUpper = selectedEaps[ranks.upperRankOneBased - 1];
    raw.push({ theta, generated, selectedEaps, rawLower, rawUpper });
    totalGeneratedPaths += generated;
    totalSelectedPaths += selectedEaps.length;
  }
  const envelope = conservativeMonotoneAcceptanceEnvelope(
    raw.map(({ rawLower }) => rawLower),
    raw.map(({ rawUpper }) => rawUpper)
  );
  return {
    totalGeneratedPaths,
    totalSelectedPaths,
    cells: raw.map((cell, index) => ({
      trueTheta: cell.theta,
      generatedPaths: cell.generated,
      selectedPaths: cell.selectedEaps.length,
      selectedRate: cell.selectedEaps.length / cell.generated,
      rawLowerAcceptanceLimit: cell.rawLower,
      rawUpperAcceptanceLimit: cell.rawUpper,
      lowerAcceptanceLimit: envelope.lower[index],
      upperAcceptanceLimit: envelope.upper[index],
    })),
  };
}

function regionAndZone(
  theta: number,
  plan: SelectiveReportingPlan
): Pick<Accumulator, "region" | "zone"> {
  const { lowerTheta, upperTheta } = plan.informationSupportRange;
  const region =
    theta < lowerTheta
      ? "below-range"
      : theta > upperTheta
        ? "above-range"
        : "within-range";
  if (region === "within-range") {
    const distance = Math.min(theta - lowerTheta, upperTheta - theta);
    return {
      region,
      zone:
        distance >= plan.boundaryIndifferenceMargin
          ? "validated-interior"
          : "supported-boundary",
    };
  }
  const outsideDistance =
    region === "below-range" ? lowerTheta - theta : theta - upperTheta;
  return {
    region,
    zone:
      outsideDistance >= plan.boundaryIndifferenceMargin
        ? "clearly-outside"
        : "boundary-indifference",
  };
}

function createAccumulator(
  theta: number,
  plan: SelectiveReportingPlan
): Accumulator {
  const { region, zone } = regionAndZone(theta, plan);
  return {
    theta,
    region,
    zone,
    generated: 0,
    below: 0,
    within: 0,
    above: 0,
    indeterminate: 0,
    opposite: 0,
    selected: 0,
    emptyFallback: 0,
    errorSum: 0,
    squaredErrorSum: 0,
    fourthErrorSum: 0,
    covered: 0,
    lowerMiss: 0,
    upperMiss: 0,
    thetaWidths: [],
    vocabularyCovered: 0,
    vocabularyWidths: [],
  };
}

function addEvaluation(
  accumulator: Accumulator,
  classification: ReturnType<typeof classifySelectivePath>["classification"],
  selected: boolean,
  interval: ThetaInterval | null,
  statistics: PathStatistics,
  cache: ModelCache
): void {
  accumulator.generated += 1;
  if (classification === "below-range") accumulator.below += 1;
  else if (classification === "within-range") accumulator.within += 1;
  else if (classification === "above-range") accumulator.above += 1;
  else accumulator.indeterminate += 1;
  const opposite =
    (accumulator.region === "below-range" && classification === "above-range") ||
    (accumulator.region === "above-range" && classification === "below-range");
  accumulator.opposite += opposite ? 1 : 0;
  if (!selected || interval === null) return;
  accumulator.selected += 1;
  accumulator.emptyFallback += interval.usedEmptyFallback ? 1 : 0;
  const error = statistics.eap - accumulator.theta;
  accumulator.errorSum += error;
  accumulator.squaredErrorSum += error ** 2;
  accumulator.fourthErrorSum += error ** 4;
  if (accumulator.theta < interval.lower) accumulator.lowerMiss += 1;
  else if (accumulator.theta > interval.upper) accumulator.upperMiss += 1;
  else accumulator.covered += 1;
  accumulator.thetaWidths.push(interval.upper - interval.lower);
  const lowerVocabulary = paperVocabularyAtThetaFromMeans(
    interval.lower,
    cache.levelMeans
  );
  const upperVocabulary = paperVocabularyAtThetaFromMeans(
    interval.upper,
    cache.levelMeans
  );
  const trueVocabulary = paperVocabularyAtThetaFromMeans(
    accumulator.theta,
    cache.levelMeans
  );
  accumulator.vocabularyCovered +=
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
  accumulator: Accumulator
): SelectiveConditionalMetrics {
  const n = accumulator.generated;
  const selected = accumulator.selected;
  const rate = (count: number): number => count / n;
  const selectedRate = (count: number): number | null =>
    selected > 0 ? count / selected : null;
  return {
    trueTheta: accumulator.theta,
    trueRegion: accumulator.region,
    evaluationZone: accumulator.zone,
    generatedPaths: n,
    rangeClassificationRates: {
      belowRange: rate(accumulator.below),
      withinRange: rate(accumulator.within),
      aboveRange: rate(accumulator.above),
      indeterminate: rate(accumulator.indeterminate),
    },
    oppositeExtremeRate: rate(accumulator.opposite),
    selectedPaths: selected,
    selectedRate: rate(selected),
    emptyInversionFallbackRateSelected: selectedRate(accumulator.emptyFallback),
    thetaBiasSelected: selected > 0 ? accumulator.errorSum / selected : null,
    thetaRmseSelected:
      selected > 0 ? Math.sqrt(accumulator.squaredErrorSum / selected) : null,
    thetaCoverageSelected: selectedRate(accumulator.covered),
    lowerMissRateSelected: selectedRate(accumulator.lowerMiss),
    upperMissRateSelected: selectedRate(accumulator.upperMiss),
    meanThetaIntervalWidthSelected:
      selected > 0
        ? accumulator.thetaWidths.reduce((sum, value) => sum + value, 0) /
          selected
        : null,
    p90ThetaIntervalWidthSelected:
      selected > 0 ? sampleQuantile(accumulator.thetaWidths, 0.9) : null,
    vocabularyCoverageSelected: selectedRate(accumulator.vocabularyCovered),
    meanVocabularyIntervalWidthSelected:
      selected > 0
        ? accumulator.vocabularyWidths.reduce((sum, value) => sum + value, 0) /
          selected
        : null,
    monteCarloStandardErrors: {
      thetaBiasSelected:
        selected > 0
          ? meanMcse(accumulator.errorSum, accumulator.squaredErrorSum, selected)
          : null,
      thetaRmseSelected:
        selected > 0
          ? rmseMcse(
              accumulator.squaredErrorSum,
              accumulator.fourthErrorSum,
              selected
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
  conditional: SelectiveConditionalMetrics[],
  plan: SelectiveReportingPlan
): SelectiveMethodSummary {
  const criteria = plan.decisionCriteria;
  const outside = conditional.filter(
    ({ evaluationZone }) => evaluationZone === "clearly-outside"
  );
  const interior = conditional.filter(
    ({ evaluationZone }) => evaluationZone === "validated-interior"
  );
  const supported = conditional.filter(
    ({ trueRegion }) => trueRegion === "within-range"
  );
  const upper = (rate: number, trials: number): number =>
    wilsonBounds(rate, trials, criteria.equivalenceZ).upper;
  const lower = (rate: number, trials: number): number =>
    wilsonBounds(rate, trials, criteria.equivalenceZ).lower;
  const supportedEvidence =
    supported.length === 14 &&
    supported.every(
      ({ selectedPaths }) =>
        selectedPaths >= criteria.minimumSelectedEvaluationPathsPerSupportedTheta
    );
  const outsideFalseNumericReporting =
    outside.length > 0 &&
    outside.every(
      (cell) =>
        upper(cell.selectedRate, cell.generatedPaths) <=
        criteria.maximumFalseNumericReportRateOutside
    );
  const oppositeExtremeClassification = conditional.every(
    (cell) =>
      upper(cell.oppositeExtremeRate, cell.generatedPaths) <=
      criteria.maximumOppositeExtremeRate
  );
  const interiorReportability =
    interior.length > 0 &&
    interior.every(
      (cell) =>
        lower(cell.selectedRate, cell.generatedPaths) >=
        criteria.minimumReportableRateInterior
    );
  const emptyInversionFallback =
    supportedEvidence &&
    supported.every(
      (cell) =>
        cell.emptyInversionFallbackRateSelected !== null &&
        upper(
          cell.emptyInversionFallbackRateSelected,
          cell.selectedPaths
        ) <= criteria.maximumEmptyInversionFallbackRate
    );
  const selectedThetaBias =
    supportedEvidence &&
    supported.every(
      (cell) =>
        cell.thetaBiasSelected !== null &&
        cell.monteCarloStandardErrors.thetaBiasSelected !== null &&
        Math.abs(cell.thetaBiasSelected) +
          criteria.equivalenceZ *
            cell.monteCarloStandardErrors.thetaBiasSelected <=
          criteria.maximumAbsoluteThetaBiasSelected
    );
  const selectedThetaRmse =
    supportedEvidence &&
    supported.every(
      (cell) =>
        cell.thetaRmseSelected !== null &&
        cell.monteCarloStandardErrors.thetaRmseSelected !== null &&
        cell.thetaRmseSelected +
          criteria.equivalenceZ *
            cell.monteCarloStandardErrors.thetaRmseSelected <=
          criteria.maximumThetaRmseSelected
    );
  const selectedCoverage =
    supportedEvidence &&
    supported.every((cell) => {
      if (cell.thetaCoverageSelected === null) return false;
      const bounds = wilsonBounds(
        cell.thetaCoverageSelected,
        cell.selectedPaths,
        criteria.equivalenceZ
      );
      return (
        bounds.lower >= criteria.minimumCoverage &&
        bounds.upper <= criteria.maximumCoverage
      );
    });
  const selectedTailBalance =
    supportedEvidence &&
    supported.every(
      (cell) =>
        cell.lowerMissRateSelected !== null &&
        cell.upperMissRateSelected !== null &&
        upper(cell.lowerMissRateSelected, cell.selectedPaths) <=
          criteria.maximumOneSidedMissRate &&
        upper(cell.upperMissRateSelected, cell.selectedPaths) <=
          criteria.maximumOneSidedMissRate
    );
  const selectedMeanWidth =
    supportedEvidence &&
    supported.every(
      (cell) =>
        cell.meanThetaIntervalWidthSelected !== null &&
        cell.meanThetaIntervalWidthSelected <=
          criteria.maximumMeanThetaIntervalWidth
    );
  const selectedP90Width =
    supportedEvidence &&
    supported.every(
      (cell) =>
        cell.p90ThetaIntervalWidthSelected !== null &&
        cell.p90ThetaIntervalWidthSelected <=
          criteria.maximumP90ThetaIntervalWidth
    );
  const gates = {
    outsideFalseNumericReporting,
    oppositeExtremeClassification,
    interiorReportability,
    supportedThetaEvidence: supportedEvidence,
    emptyInversionFallback,
    selectedThetaBias,
    selectedThetaRmse,
    selectedCoverage,
    selectedTailBalance,
    selectedMeanWidth,
    selectedP90Width,
  };
  const totalSelected = supported.reduce(
    (sum, cell) => sum + cell.selectedPaths,
    0
  );
  const totalFalseCoverage = supported.reduce(
    (sum, cell) =>
      sum +
      (cell.lowerMissRateSelected === null ||
      cell.upperMissRateSelected === null
        ? 0
        : (cell.lowerMissRateSelected + cell.upperMissRateSelected) *
          cell.selectedPaths),
    0
  );
  return {
    passesAllGates: Object.values(gates).every(Boolean),
    gates,
    failedGates: Object.entries(gates)
      .filter(([, passed]) => !passed)
      .map(([gate]) => gate),
    observed: {
      maximumFalseNumericReportRateOutside: nullableMaximum(
        outside.map((cell) => cell.selectedRate)
      ),
      maximumOppositeExtremeRate: Math.max(
        ...conditional.map((cell) => cell.oppositeExtremeRate)
      ),
      minimumReportableRateInterior: nullableMinimum(
        interior.map((cell) => cell.selectedRate)
      ),
      minimumSelectedPathsSupportedTheta:
        supported.length > 0
          ? Math.min(...supported.map((cell) => cell.selectedPaths))
          : null,
      maximumEmptyInversionFallbackRateSelected: nullableMaximum(
        supported.map((cell) => cell.emptyInversionFallbackRateSelected)
      ),
      maximumAbsoluteThetaBiasSelected: nullableMaximum(
        supported.map((cell) =>
          cell.thetaBiasSelected === null ? null : Math.abs(cell.thetaBiasSelected)
        )
      ),
      maximumThetaRmseSelected: nullableMaximum(
        supported.map((cell) => cell.thetaRmseSelected)
      ),
      minimumCoverageSelected: nullableMinimum(
        supported.map((cell) => cell.thetaCoverageSelected)
      ),
      maximumCoverageSelected: nullableMaximum(
        supported.map((cell) => cell.thetaCoverageSelected)
      ),
      maximumLowerMissRateSelected: nullableMaximum(
        supported.map((cell) => cell.lowerMissRateSelected)
      ),
      maximumUpperMissRateSelected: nullableMaximum(
        supported.map((cell) => cell.upperMissRateSelected)
      ),
      maximumMeanThetaIntervalWidthSelected: nullableMaximum(
        supported.map((cell) => cell.meanThetaIntervalWidthSelected)
      ),
      maximumP90ThetaIntervalWidthSelected: nullableMaximum(
        supported.map((cell) => cell.p90ThetaIntervalWidthSelected)
      ),
      aggregateFalseCoverageStatementRateSupportedTheta:
        totalSelected > 0 ? totalFalseCoverage / totalSelected : null,
    },
  };
}

function clonePlan(plan: SelectiveReportingPlan): SelectiveReportingPlan {
  return JSON.parse(JSON.stringify(plan)) as SelectiveReportingPlan;
}

export function runSelectiveReportingSimulation(
  itemBank: Item[],
  itemBankSha256: string,
  plan: SelectiveReportingPlan,
  planSha256: string | null = null,
  provenance: SelectiveReportingProvenance | null = null
): SelectiveReportingReport {
  if (itemBank.length === 0) throw new RangeError("Item bank is empty.");
  const ranks = validateSelectiveReportingPlan(plan);
  const cache = buildCache(itemBank, plan);
  const calibration = calibrationCells(itemBank, cache, plan, ranks);
  const calibrationThetas = calibration.cells.map(({ trueTheta }) => trueTheta);
  const lowerLimits = calibration.cells.map(
    ({ lowerAcceptanceLimit }) => lowerAcceptanceLimit
  );
  const upperLimits = calibration.cells.map(
    ({ upperAcceptanceLimit }) => upperAcceptanceLimit
  );
  const inversionGrid = augmentedInversionGrid(plan);
  const selectiveAccumulators = plan.evaluationCells.map(({ theta }) =>
    createAccumulator(theta, plan)
  );
  const baselineAccumulators = plan.evaluationCells.map(({ theta }) =>
    createAccumulator(theta, plan)
  );
  const exposure = new Uint32Array(itemBank.length);
  let totalEvaluationPaths = 0;
  for (
    let thetaIndex = 0;
    thetaIndex < plan.evaluationCells.length;
    thetaIndex += 1
  ) {
    const cell = plan.evaluationCells[thetaIndex];
    for (let replication = 0; replication < cell.generatedPaths; replication += 1) {
      const statistics = generatePath(
        itemBank,
        cache,
        plan,
        cell.theta,
        createDeterministicRandom(
          deriveSeed(plan.evaluationSeed, thetaIndex, replication, 0x52)
        ),
        createDeterministicRandom(
          deriveSeed(plan.evaluationSeed, thetaIndex, replication, 0x53)
        ),
        exposure
      );
      const { classification, selected } = classifySelectivePath(
        statistics,
        plan
      );
      const selectiveInterval = selected
        ? invertSelectiveAcceptanceEnvelope(
            statistics.eap,
            inversionGrid,
            calibrationThetas,
            lowerLimits,
            upperLimits,
            plan.informationSupportRange
          )
        : null;
      const baselineInterval: ThetaInterval | null = selected
        ? {
            lower: Math.max(
              plan.informationSupportRange.lowerTheta,
              Math.min(statistics.posteriorLower, statistics.eap)
            ),
            upper: Math.min(
              plan.informationSupportRange.upperTheta,
              Math.max(statistics.posteriorUpper, statistics.eap)
            ),
            usedEmptyFallback: false,
          }
        : null;
      addEvaluation(
        selectiveAccumulators[thetaIndex],
        classification,
        selected,
        selectiveInterval,
        statistics,
        cache
      );
      addEvaluation(
        baselineAccumulators[thetaIndex],
        classification,
        selected,
        baselineInterval,
        statistics,
        cache
      );
    }
    totalEvaluationPaths += cell.generatedPaths;
  }
  const selectiveConditional = selectiveAccumulators.map(summarizeAccumulator);
  const baselineConditional = baselineAccumulators.map(summarizeAccumulator);
  const selectiveSummary = summarizeMethod(selectiveConditional, plan);
  const baselineSummary = summarizeMethod(baselineConditional, plan);
  const maximumExposureRate = Math.max(...exposure) / totalEvaluationPaths;
  const unusedItemRate =
    Array.from(exposure).filter((count) => count === 0).length / itemBank.length;
  return {
    schemaVersion: "selective-reporting-simulation-v1",
    engineId: "conditional-eap-neyman-selective-reporting-v1",
    randomGeneratorId: "mulberry32-v1",
    scoreModelId: PAPER_3PL_CONFIG.scoreModelId,
    calibrationEvaluationSeedsSeparated: true,
    intervalIndependentSelectionEvent: true,
    validationStatus: "exploratory-not-for-score-reporting",
    itemBankSha256,
    planSha256,
    provenance:
      provenance === null
        ? null
        : { ...provenance, sourceSha256: { ...provenance.sourceSha256 } },
    plan: clonePlan(plan),
    simultaneousCentralRanks: ranks,
    calibration: { succeeded: true, ...calibration },
    exposure: { maximumExposureRate, unusedItemRate },
    selectableMethod: {
      id: "selective-eap-neyman-central",
      summary: selectiveSummary,
      conditional: selectiveConditional,
    },
    diagnosticBaseline: {
      id: "eap-equal-tail-diagnostic-only",
      selectable: false,
      summary: baselineSummary,
      conditional: baselineConditional,
    },
    selection: {
      passesExploratoryGates: selectiveSummary.passesAllGates,
      preferredMethodId: selectiveSummary.passesAllGates
        ? "selective-eap-neyman-central"
        : null,
      productionApproved: false,
      requiredNextEvidence: selectiveSummary.passesAllGates
        ? "Freeze this complete selective reporting rule and run at least 5,000 independent replications per theta; then obtain empirical model and mode evidence."
        : "No confirmation run is authorized; revise the complete selective reporting protocol prospectively.",
    },
  };
}
