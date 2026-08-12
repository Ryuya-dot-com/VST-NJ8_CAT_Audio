import type { Item } from "../types";
import {
  PAPER_3PL_CONFIG,
  paperItemInformation3pl,
  paperProbability3pl,
} from "./paperScoring.ts";

export type GuardCandidateId = "guard-050" | "guard-075" | "guard-100";
export type ImportanceRole = "endpoint-stability" | "direct-overlap";

export interface ImportanceExperiment {
  id: string;
  candidateId: GuardCandidateId;
  side: "lower" | "upper";
  role: ImportanceRole;
  targetTheta: number;
  auxiliaryTheta: number;
  coreLowerTheta: number;
  coreUpperTheta: number;
}

export interface SelectionAdjustedImportancePlan {
  planId: "selection-adjusted-importance-validation-v1";
  mixtureSeed: number;
  directSeed: number;
  defensiveTargetWeight: number;
  mixturePathsPerExperiment: number;
  directPathsPerOverlapExperiment: number;
  informationSupportRange: { lowerTheta: number; upperTheta: number };
  cat: {
    fixedLength: 30;
    selectionMethod: "randomesque";
    randomesqueSize: 5;
    selectionPriorMean: 0;
    selectionPriorStandardDeviation: 1;
    reportingPriorMean: 0;
    reportingPriorStandardDeviation: 2;
    posteriorMassThreshold: 0.95;
    initialLevelMinimum: 3;
    initialLevelMaximum: 5;
    highLevelFloor: 7;
    minimumHighLevelItems: 2;
  };
  experiments: ImportanceExperiment[];
  uncertainty: {
    method: "empirical-bernstein-maurer-pontil-theorem4-bonferroni-v1";
    familywiseAlpha: 0.05;
    simultaneousEstimateCount: 30;
  };
  decisionCriteria: {
    maximumRawWeight: number;
    minimumEndpointSelectedEffectiveSampleSize: number;
    maximumEndpointSelectedNormalizedWeight: number;
    maximumOverlapCombinedProbabilityHalfWidth: number;
    calibrationProjectionCap: number;
    minimumProjectedEndpointSelectedEffectiveSampleSize: number;
  };
}

export interface SelectionAdjustedImportanceProvenance {
  nodeVersion: string;
  platform: string;
  architecture: string;
  sourceSha256: Record<string, string>;
}

interface BoundedMean {
  estimate: number;
  empiricalBernsteinHalfWidth: number;
  lower: number;
  upper: number;
}

export interface SelectionAdjustedImportanceReport {
  schemaVersion: "selection-adjusted-importance-validation-v1";
  engineId: "defensive-adaptive-path-importance-v1";
  randomGeneratorId: "mulberry32-v1";
  scoreModelId: "paper-3pl-v1";
  validationStatus: "method-validation-not-for-score-reporting";
  itemBankSha256: string;
  planSha256: string | null;
  provenance: SelectionAdjustedImportanceProvenance | null;
  plan: SelectionAdjustedImportancePlan;
  pathLikelihoodContract: {
    responseLikelihoodRatioIncludesAllAdministeredItems: true;
    itemSelectionFactorsCancelConditionally: true;
    mixtureWeightBound: number;
  };
  experiments: Array<{
    id: string;
    candidateId: GuardCandidateId;
    side: "lower" | "upper";
    role: ImportanceRole;
    targetTheta: number;
    auxiliaryTheta: number;
    mixturePaths: number;
    targetComponentPaths: number;
    maximumRawWeight: number;
    meanRawWeight: BoundedMean;
    weightedSelectionProbability: BoundedMean;
    selectedEffectiveSampleSize: number;
    selectedEffectiveSampleSizeFraction: number;
    maximumSelectedNormalizedWeight: number | null;
    projectedSelectedEffectiveSampleSizeAtCalibrationCap: number;
    directComparison: null | {
      paths: number;
      selectedPaths: number;
      probability: BoundedMean;
      absoluteDifference: number;
      combinedHalfWidth: number;
      agreesWithinSimultaneousBounds: boolean;
    };
    gates: {
      boundedWeight: boolean;
      meanWeightIdentity: boolean;
      endpointSelectedEss: boolean | null;
      endpointWeightConcentration: boolean | null;
      projectedCalibrationEss: boolean;
      overlapPrecision: boolean | null;
      overlapAgreement: boolean | null;
    };
  }>;
  decision: {
    passesAllValidationGates: boolean;
    failedExperimentGates: Array<{ experimentId: string; gate: string }>;
    nextStep: string;
  };
}

const LOWER_SUPPORT = -2.7578183981455946;
const UPPER_SUPPORT = 3.3090556474466313;

const EXPECTED_EXPERIMENTS = [
  ["guard-050-lower-endpoint", "guard-050", "lower", "endpoint-stability", LOWER_SUPPORT, LOWER_SUPPORT + 0.5, LOWER_SUPPORT + 0.5, UPPER_SUPPORT - 0.5],
  ["guard-050-lower-overlap", "guard-050", "lower", "direct-overlap", LOWER_SUPPORT + 0.25, LOWER_SUPPORT + 0.5, LOWER_SUPPORT + 0.5, UPPER_SUPPORT - 0.5],
  ["guard-075-lower-endpoint", "guard-075", "lower", "endpoint-stability", LOWER_SUPPORT + 0.25, LOWER_SUPPORT + 0.75, LOWER_SUPPORT + 0.75, UPPER_SUPPORT - 0.75],
  ["guard-075-lower-overlap", "guard-075", "lower", "direct-overlap", LOWER_SUPPORT + 0.5, LOWER_SUPPORT + 0.75, LOWER_SUPPORT + 0.75, UPPER_SUPPORT - 0.75],
  ["guard-100-lower-endpoint", "guard-100", "lower", "endpoint-stability", LOWER_SUPPORT + 0.5, LOWER_SUPPORT + 1, LOWER_SUPPORT + 1, UPPER_SUPPORT - 1],
  ["guard-100-lower-overlap", "guard-100", "lower", "direct-overlap", LOWER_SUPPORT + 0.75, LOWER_SUPPORT + 1, LOWER_SUPPORT + 1, UPPER_SUPPORT - 1],
  ["guard-100-upper-overlap", "guard-100", "upper", "direct-overlap", UPPER_SUPPORT - 0.75, UPPER_SUPPORT - 1, LOWER_SUPPORT + 1, UPPER_SUPPORT - 1],
  ["guard-100-upper-endpoint", "guard-100", "upper", "endpoint-stability", UPPER_SUPPORT - 0.5, UPPER_SUPPORT - 1, LOWER_SUPPORT + 1, UPPER_SUPPORT - 1],
  ["guard-075-upper-overlap", "guard-075", "upper", "direct-overlap", UPPER_SUPPORT - 0.5, UPPER_SUPPORT - 0.75, LOWER_SUPPORT + 0.75, UPPER_SUPPORT - 0.75],
  ["guard-075-upper-endpoint", "guard-075", "upper", "endpoint-stability", UPPER_SUPPORT - 0.25, UPPER_SUPPORT - 0.75, LOWER_SUPPORT + 0.75, UPPER_SUPPORT - 0.75],
  ["guard-050-upper-overlap", "guard-050", "upper", "direct-overlap", UPPER_SUPPORT - 0.25, UPPER_SUPPORT - 0.5, LOWER_SUPPORT + 0.5, UPPER_SUPPORT - 0.5],
  ["guard-050-upper-endpoint", "guard-050", "upper", "endpoint-stability", UPPER_SUPPORT, UPPER_SUPPORT - 0.5, LOWER_SUPPORT + 0.5, UPPER_SUPPORT - 0.5],
] as const;

export function validateSelectionAdjustedImportancePlan(
  plan: SelectionAdjustedImportancePlan
): void {
  if (
    plan.planId !== "selection-adjusted-importance-validation-v1" ||
    plan.mixtureSeed !== 20260820 ||
    plan.directSeed !== 20260821 ||
    plan.defensiveTargetWeight !== 0.2 ||
    plan.mixturePathsPerExperiment !== 20000 ||
    plan.directPathsPerOverlapExperiment !== 20000
  ) {
    throw new RangeError("Importance-validation identity is not frozen.");
  }
  if (
    plan.informationSupportRange.lowerTheta !== LOWER_SUPPORT ||
    plan.informationSupportRange.upperTheta !== UPPER_SUPPORT
  ) {
    throw new RangeError("Importance-validation support is not frozen.");
  }
  const cat = plan.cat;
  if (
    cat.fixedLength !== 30 ||
    cat.selectionMethod !== "randomesque" ||
    cat.randomesqueSize !== 5 ||
    cat.selectionPriorMean !== 0 ||
    cat.selectionPriorStandardDeviation !== 1 ||
    cat.reportingPriorMean !== 0 ||
    cat.reportingPriorStandardDeviation !== 2 ||
    cat.posteriorMassThreshold !== 0.95 ||
    cat.initialLevelMinimum !== 3 ||
    cat.initialLevelMaximum !== 5 ||
    cat.highLevelFloor !== 7 ||
    cat.minimumHighLevelItems !== 2
  ) {
    throw new RangeError("Importance-validation CAT rules are not frozen.");
  }
  if (
    plan.experiments.length !== EXPECTED_EXPERIMENTS.length ||
    plan.experiments.some((experiment, index) => {
      const expected = EXPECTED_EXPERIMENTS[index];
      return (
        experiment.id !== expected[0] ||
        experiment.candidateId !== expected[1] ||
        experiment.side !== expected[2] ||
        experiment.role !== expected[3] ||
        experiment.targetTheta !== expected[4] ||
        experiment.auxiliaryTheta !== expected[5] ||
        experiment.coreLowerTheta !== expected[6] ||
        experiment.coreUpperTheta !== expected[7]
      );
    })
  ) {
    throw new RangeError("Importance-validation experiments are incomplete or reordered.");
  }
  const uncertainty = plan.uncertainty;
  const criteria = plan.decisionCriteria;
  if (
    uncertainty.method !==
      "empirical-bernstein-maurer-pontil-theorem4-bonferroni-v1" ||
    uncertainty.familywiseAlpha !== 0.05 ||
    uncertainty.simultaneousEstimateCount !== 30 ||
    criteria.maximumRawWeight !== 5.000000000001 ||
    criteria.minimumEndpointSelectedEffectiveSampleSize !== 1000 ||
    criteria.maximumEndpointSelectedNormalizedWeight !== 0.01 ||
    criteria.maximumOverlapCombinedProbabilityHalfWidth !== 0.025 ||
    criteria.calibrationProjectionCap !== 250000 ||
    criteria.minimumProjectedEndpointSelectedEffectiveSampleSize !== 2500
  ) {
    throw new RangeError("Importance-validation gates are not frozen.");
  }
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
  experimentIndex: number,
  replication: number,
  stream: number
): number {
  let hash = (baseSeed ^ 0x811c9dc5) >>> 0;
  for (const value of [experimentIndex, replication, stream]) {
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
    throw new RangeError("Importance posterior cannot be normalized.");
  }
  for (let index = 0; index < weights.length; index += 1) weights[index] /= total;
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

function posteriorMean(grid: readonly number[], weights: Float64Array): number {
  let result = 0;
  for (let index = 0; index < grid.length; index += 1) result += grid[index] * weights[index];
  return result;
}

function updatePosterior(
  weights: Float64Array,
  probabilities: Float64Array,
  response: 0 | 1
): void {
  for (let index = 0; index < weights.length; index += 1) {
    weights[index] *= response === 1 ? probabilities[index] : 1 - probabilities[index];
  }
  normalize(weights);
}

function chooseNext(
  itemBank: Item[],
  theta: number,
  used: Uint8Array,
  needHigh: boolean,
  random: () => number,
  plan: SelectionAdjustedImportancePlan
): number {
  const requireHigh =
    needHigh &&
    itemBank.some(
      (item, index) => used[index] === 0 && item.Level >= plan.cat.highLevelFloor
    );
  const top: Array<{ index: number; information: number }> = [];
  for (let index = 0; index < itemBank.length; index += 1) {
    if (used[index] === 1) continue;
    if (requireHigh && itemBank[index].Level < plan.cat.highLevelFloor) continue;
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
    ) position += 1;
    if (position < plan.cat.randomesqueSize) {
      top.splice(position, 0, candidate);
      if (top.length > plan.cat.randomesqueSize) top.pop();
    }
  }
  if (top.length === 0) throw new RangeError("Item bank exhausted.");
  return top[Math.floor(random() * top.length)].index;
}

function logBernoulli(probability: number, response: 0 | 1): number {
  return response === 1 ? Math.log(probability) : Math.log1p(-probability);
}

function logAddExp(left: number, right: number): number {
  const maximum = Math.max(left, right);
  return maximum + Math.log(Math.exp(left - maximum) + Math.exp(right - maximum));
}

export function defensiveMixtureWeight(
  logTargetLikelihood: number,
  logAuxiliaryLikelihood: number,
  targetMixtureWeight: number
): number {
  if (
    !Number.isFinite(logTargetLikelihood) ||
    !Number.isFinite(logAuxiliaryLikelihood) ||
    !Number.isFinite(targetMixtureWeight) ||
    targetMixtureWeight <= 0 ||
    targetMixtureWeight >= 1
  ) {
    throw new RangeError("Invalid defensive-mixture likelihood inputs.");
  }
  const logMixture = logAddExp(
    Math.log(targetMixtureWeight) + logTargetLikelihood,
    Math.log1p(-targetMixtureWeight) + logAuxiliaryLikelihood
  );
  return Math.exp(logTargetLikelihood - logMixture);
}

interface PathResult {
  selected: boolean;
  logTargetLikelihood: number;
  logAuxiliaryLikelihood: number;
}

interface Cache {
  grid: number[];
  probabilities: Float64Array[];
  selectionPrior: Float64Array;
  reportingPriorRatio: Float64Array;
  initialCandidates: number[];
}

function generatePath(
  itemBank: Item[],
  cache: Cache,
  plan: SelectionAdjustedImportancePlan,
  experiment: ImportanceExperiment,
  generatingTheta: number,
  responseRandom: () => number,
  selectionRandom: () => number
): PathResult {
  const posterior = new Float64Array(cache.selectionPrior);
  const used = new Uint8Array(itemBank.length);
  let next = cache.initialCandidates[Math.floor(selectionRandom() * cache.initialCandidates.length)];
  let highCount = 0;
  let logTargetLikelihood = 0;
  let logAuxiliaryLikelihood = 0;
  for (let length = 0; length < plan.cat.fixedLength; length += 1) {
    const item = itemBank[next];
    const generatedProbability = paperProbability3pl(generatingTheta, item);
    const response: 0 | 1 = responseRandom() < generatedProbability ? 1 : 0;
    const targetProbability = paperProbability3pl(experiment.targetTheta, item);
    const auxiliaryProbability = paperProbability3pl(experiment.auxiliaryTheta, item);
    logTargetLikelihood += logBernoulli(targetProbability, response);
    logAuxiliaryLikelihood += logBernoulli(auxiliaryProbability, response);
    used[next] = 1;
    if (item.Level >= plan.cat.highLevelFloor) highCount += 1;
    updatePosterior(posterior, cache.probabilities[next], response);
    if (length + 1 < plan.cat.fixedLength) {
      next = chooseNext(
        itemBank,
        posteriorMean(cache.grid, posterior),
        used,
        highCount < plan.cat.minimumHighLevelItems,
        selectionRandom,
        plan
      );
    }
  }
  if (highCount < plan.cat.minimumHighLevelItems) {
    throw new RangeError("Importance path violates the content constraint.");
  }
  const reporting = Float64Array.from(
    posterior,
    (value, index) => value * cache.reportingPriorRatio[index]
  );
  normalize(reporting);
  const eap = posteriorMean(cache.grid, reporting);
  let withinProbability = 0;
  for (let index = 0; index < cache.grid.length; index += 1) {
    if (
      cache.grid[index] >= plan.informationSupportRange.lowerTheta &&
      cache.grid[index] <= plan.informationSupportRange.upperTheta
    ) withinProbability += reporting[index];
  }
  return {
    selected:
      withinProbability >= plan.cat.posteriorMassThreshold &&
      eap >= experiment.coreLowerTheta &&
      eap <= experiment.coreUpperTheta,
    logTargetLikelihood,
    logAuxiliaryLikelihood,
  };
}

export function empiricalBernsteinBoundedMean(
  values: readonly number[],
  rangeMaximum: number,
  delta: number
): BoundedMean {
  if (
    values.length < 2 ||
    !Number.isFinite(rangeMaximum) ||
    rangeMaximum <= 0 ||
    !Number.isFinite(delta) ||
    delta <= 0 ||
    delta >= 1 ||
    values.some((value) => !Number.isFinite(value) || value < 0 || value > rangeMaximum)
  ) throw new RangeError("Invalid empirical-Bernstein inputs.");
  const n = values.length;
  const estimate = values.reduce((sum, value) => sum + value, 0) / n;
  const sampleVariance = values.reduce(
    (sum, value) => sum + (value - estimate) ** 2,
    0
  ) / (n - 1);
  const logTerm = Math.log(2 / delta);
  const halfWidth =
    Math.sqrt((2 * sampleVariance * logTerm) / n) +
    (7 * rangeMaximum * logTerm) / (3 * (n - 1));
  return {
    estimate,
    empiricalBernsteinHalfWidth: halfWidth,
    lower: Math.max(0, estimate - halfWidth),
    upper: Math.min(rangeMaximum, estimate + halfWidth),
  };
}

function buildCache(
  itemBank: Item[],
  plan: SelectionAdjustedImportancePlan
): Cache {
  const { min, max, step } = PAPER_3PL_CONFIG.thetaGrid;
  const grid = Array.from(
    { length: Math.round((max - min) / step) + 1 },
    (_, index) => min + index * step
  );
  const probabilities = itemBank.map((item) =>
    Float64Array.from(grid, (theta) => paperProbability3pl(theta, item))
  );
  const selectionPrior = normalWeights(
    grid,
    plan.cat.selectionPriorMean,
    plan.cat.selectionPriorStandardDeviation
  );
  const reportingPrior = normalWeights(
    grid,
    plan.cat.reportingPriorMean,
    plan.cat.reportingPriorStandardDeviation
  );
  const initialCandidates = itemBank
    .map((item, index) => ({ item, index }))
    .filter(
      ({ item }) =>
        item.Level >= plan.cat.initialLevelMinimum &&
        item.Level <= plan.cat.initialLevelMaximum
    )
    .map(({ index }) => index);
  if (initialCandidates.length === 0) throw new RangeError("No initial items.");
  return {
    grid,
    probabilities,
    selectionPrior,
    reportingPriorRatio: Float64Array.from(
      reportingPrior,
      (value, index) => value / selectionPrior[index]
    ),
    initialCandidates,
  };
}

export function runSelectionAdjustedImportanceValidation(
  itemBank: Item[],
  itemBankSha256: string,
  plan: SelectionAdjustedImportancePlan,
  planSha256: string | null = null,
  provenance: SelectionAdjustedImportanceProvenance | null = null
): SelectionAdjustedImportanceReport {
  validateSelectionAdjustedImportancePlan(plan);
  if (itemBank.length === 0 || new Set(itemBank.map(({ id }) => id)).size !== itemBank.length) {
    throw new RangeError("The importance item bank is empty or has duplicate IDs.");
  }
  const cache = buildCache(itemBank, plan);
  const delta = plan.uncertainty.familywiseAlpha / plan.uncertainty.simultaneousEstimateCount;
  const failedExperimentGates: Array<{ experimentId: string; gate: string }> = [];
  const results = plan.experiments.map((experiment, experimentIndex) => {
    const weights: number[] = [];
    const selectedWeights: number[] = [];
    let targetComponentPaths = 0;
    let maximumRawWeight = 0;
    for (let replication = 0; replication < plan.mixturePathsPerExperiment; replication += 1) {
      const componentRandom = createDeterministicRandom(
        deriveSeed(plan.mixtureSeed, experimentIndex, replication, 0x70)
      );
      const targetComponent = componentRandom() < plan.defensiveTargetWeight;
      if (targetComponent) targetComponentPaths += 1;
      const path = generatePath(
        itemBank,
        cache,
        plan,
        experiment,
        targetComponent ? experiment.targetTheta : experiment.auxiliaryTheta,
        createDeterministicRandom(deriveSeed(plan.mixtureSeed, experimentIndex, replication, 0x71)),
        createDeterministicRandom(deriveSeed(plan.mixtureSeed, experimentIndex, replication, 0x72))
      );
      const weight = defensiveMixtureWeight(
        path.logTargetLikelihood,
        path.logAuxiliaryLikelihood,
        plan.defensiveTargetWeight
      );
      weights.push(weight);
      selectedWeights.push(path.selected ? weight : 0);
      maximumRawWeight = Math.max(maximumRawWeight, weight);
    }
    const meanRawWeight = empiricalBernsteinBoundedMean(
      weights,
      1 / plan.defensiveTargetWeight,
      delta
    );
    const weightedSelectionProbability = empiricalBernsteinBoundedMean(
      selectedWeights,
      1 / plan.defensiveTargetWeight,
      delta
    );
    const selectedWeightSum = selectedWeights.reduce((sum, value) => sum + value, 0);
    const selectedWeightSquareSum = selectedWeights.reduce(
      (sum, value) => sum + value ** 2,
      0
    );
    const selectedEffectiveSampleSize =
      selectedWeightSquareSum > 0
        ? selectedWeightSum ** 2 / selectedWeightSquareSum
        : 0;
    const maximumSelectedNormalizedWeight =
      selectedWeightSum > 0
        ? Math.max(...selectedWeights) / selectedWeightSum
        : null;
    const selectedEffectiveSampleSizeFraction =
      selectedEffectiveSampleSize / plan.mixturePathsPerExperiment;
    const projectedSelectedEffectiveSampleSizeAtCalibrationCap =
      selectedEffectiveSampleSizeFraction *
      plan.decisionCriteria.calibrationProjectionCap;

    let directComparison: SelectionAdjustedImportanceReport["experiments"][number]["directComparison"] = null;
    if (experiment.role === "direct-overlap") {
      const directValues: number[] = [];
      let directSelected = 0;
      for (
        let replication = 0;
        replication < plan.directPathsPerOverlapExperiment;
        replication += 1
      ) {
        const path = generatePath(
          itemBank,
          cache,
          plan,
          experiment,
          experiment.targetTheta,
          createDeterministicRandom(deriveSeed(plan.directSeed, experimentIndex, replication, 0x73)),
          createDeterministicRandom(deriveSeed(plan.directSeed, experimentIndex, replication, 0x74))
        );
        const selected = path.selected ? 1 : 0;
        directValues.push(selected);
        directSelected += selected;
      }
      const probability = empiricalBernsteinBoundedMean(directValues, 1, delta);
      const absoluteDifference = Math.abs(
        weightedSelectionProbability.estimate - probability.estimate
      );
      const combinedHalfWidth =
        weightedSelectionProbability.empiricalBernsteinHalfWidth +
        probability.empiricalBernsteinHalfWidth;
      directComparison = {
        paths: plan.directPathsPerOverlapExperiment,
        selectedPaths: directSelected,
        probability,
        absoluteDifference,
        combinedHalfWidth,
        agreesWithinSimultaneousBounds: absoluteDifference <= combinedHalfWidth,
      };
    }
    const endpoint = experiment.role === "endpoint-stability";
    const gates = {
      boundedWeight: maximumRawWeight <= plan.decisionCriteria.maximumRawWeight,
      meanWeightIdentity: meanRawWeight.lower <= 1 && meanRawWeight.upper >= 1,
      endpointSelectedEss: endpoint
        ? selectedEffectiveSampleSize >=
          plan.decisionCriteria.minimumEndpointSelectedEffectiveSampleSize
        : null,
      endpointWeightConcentration: endpoint
        ? maximumSelectedNormalizedWeight !== null &&
          maximumSelectedNormalizedWeight <=
            plan.decisionCriteria.maximumEndpointSelectedNormalizedWeight
        : null,
      projectedCalibrationEss:
        projectedSelectedEffectiveSampleSizeAtCalibrationCap >=
        plan.decisionCriteria.minimumProjectedEndpointSelectedEffectiveSampleSize,
      overlapPrecision:
        directComparison === null
          ? null
          : directComparison.combinedHalfWidth <=
            plan.decisionCriteria.maximumOverlapCombinedProbabilityHalfWidth,
      overlapAgreement:
        directComparison === null
          ? null
          : directComparison.agreesWithinSimultaneousBounds,
    };
    for (const [gate, passes] of Object.entries(gates)) {
      if (passes === false) failedExperimentGates.push({ experimentId: experiment.id, gate });
    }
    return {
      id: experiment.id,
      candidateId: experiment.candidateId,
      side: experiment.side,
      role: experiment.role,
      targetTheta: experiment.targetTheta,
      auxiliaryTheta: experiment.auxiliaryTheta,
      mixturePaths: plan.mixturePathsPerExperiment,
      targetComponentPaths,
      maximumRawWeight,
      meanRawWeight,
      weightedSelectionProbability,
      selectedEffectiveSampleSize,
      selectedEffectiveSampleSizeFraction,
      maximumSelectedNormalizedWeight,
      projectedSelectedEffectiveSampleSizeAtCalibrationCap,
      directComparison,
      gates,
    };
  });
  const passes = failedExperimentGates.length === 0;
  return {
    schemaVersion: "selection-adjusted-importance-validation-v1",
    engineId: "defensive-adaptive-path-importance-v1",
    randomGeneratorId: "mulberry32-v1",
    scoreModelId: PAPER_3PL_CONFIG.scoreModelId,
    validationStatus: "method-validation-not-for-score-reporting",
    itemBankSha256,
    planSha256,
    provenance,
    plan,
    pathLikelihoodContract: {
      responseLikelihoodRatioIncludesAllAdministeredItems: true,
      itemSelectionFactorsCancelConditionally: true,
      mixtureWeightBound: 1 / plan.defensiveTargetWeight,
    },
    experiments: results,
    decision: {
      passesAllValidationGates: passes,
      failedExperimentGates,
      nextStep: passes
        ? "freeze-selection-adjusted-point-evaluation-plan"
        : "abandon-or-redesign-importance-calibration",
    },
  };
}
