import type { Item } from "../types";
import {
  PAPER_3PL_CONFIG,
  paperItemInformation3pl,
  paperProbability3pl,
} from "./paperScoring.ts";

export interface OperationalCandidate {
  id: "guard-050" | "guard-075" | "guard-100";
  guardBand: 0.5 | 0.75 | 1;
  selectionCore: { lowerTheta: number; upperTheta: number };
  estimationDomain: { lowerTheta: number; upperTheta: number };
}

export interface SelectionAdjustedFeasibilityPlan {
  planId: "selection-adjusted-feasibility-v1";
  seed: number;
  candidate: {
    fixedLength: 30;
    selectionMethod: "randomesque";
    randomesqueSize: 5;
    selectionPriorMean: 0;
    selectionPriorStandardDeviation: 1;
    reportingPriorMean: 0;
    reportingPriorStandardDeviation: 2;
    posteriorMassThreshold: 0.95;
  };
  informationSupportRange: { lowerTheta: number; upperTheta: number };
  operationalCandidates: OperationalCandidate[];
  thetaCells: Array<{ theta: number; generatedPaths: number }>;
  calibrationPlanning: {
    targetSelectedPathsPerTheta: 2500;
    maximumGeneratedPathsPerTheta: 250000;
    selectionRateLowerBound: "wilson-one-sided-90-v1";
    z: number;
  };
  initialLevelMinimum: 3;
  initialLevelMaximum: 5;
  highLevelFloor: 7;
  minimumHighLevelItems: 2;
}

export interface SelectionAdjustedFeasibilityProvenance {
  nodeVersion: string;
  platform: string;
  architecture: string;
  sourceSha256: Record<string, string>;
}

export interface SelectionAdjustedFeasibilityReport {
  schemaVersion: "selection-adjusted-feasibility-v1";
  engineId: "common-path-selection-rate-pilot-v1";
  randomGeneratorId: "mulberry32-v1";
  scoreModelId: "paper-3pl-v1";
  validationStatus: "planning-only-not-for-score-reporting";
  itemBankSha256: string;
  planSha256: string | null;
  provenance: SelectionAdjustedFeasibilityProvenance | null;
  plan: SelectionAdjustedFeasibilityPlan;
  totalGeneratedPaths: number;
  commonPathCandidateNestingVerified: true;
  cells: Array<{
    trueTheta: number;
    generatedPaths: number;
    posteriorMassPassPaths: number;
    candidates: Array<{
      id: OperationalCandidate["id"];
      calibrationDomainCell: boolean;
      selectedPaths: number;
      selectedRate: number;
      oneSided90WilsonLowerSelectionRate: number;
      projectedSelectedPathsLowerBoundAtCap: number;
      calibrationCapFeasible: boolean | null;
    }>;
  }>;
  planningDecision: {
    allCalibrationDomainCellsFeasible: boolean;
    infeasibleCandidateThetaCells: Array<{
      candidateId: OperationalCandidate["id"];
      theta: number;
    }>;
    nextStep: string;
  };
}

const LOWER_SUPPORT = -2.7578183981455946;
const UPPER_SUPPORT = 3.3090556474466313;

function equal(actual: number, expected: number): boolean {
  return actual === expected;
}

export function validateSelectionAdjustedFeasibilityPlan(
  plan: SelectionAdjustedFeasibilityPlan
): void {
  if (plan.planId !== "selection-adjusted-feasibility-v1") {
    throw new RangeError("Invalid feasibility plan ID.");
  }
  if (!Number.isSafeInteger(plan.seed) || plan.seed !== 20260819) {
    throw new RangeError("The feasibility seed is not frozen.");
  }
  const cat = plan.candidate;
  if (
    cat.fixedLength !== 30 ||
    cat.selectionMethod !== "randomesque" ||
    cat.randomesqueSize !== 5 ||
    cat.selectionPriorMean !== 0 ||
    cat.selectionPriorStandardDeviation !== 1 ||
    cat.reportingPriorMean !== 0 ||
    cat.reportingPriorStandardDeviation !== 2 ||
    cat.posteriorMassThreshold !== 0.95
  ) {
    throw new RangeError("The feasibility CAT candidate is not frozen.");
  }
  const support = plan.informationSupportRange;
  if (
    !equal(support.lowerTheta, LOWER_SUPPORT) ||
    !equal(support.upperTheta, UPPER_SUPPORT)
  ) {
    throw new RangeError("The information-support range is not frozen.");
  }
  const expectedCandidates = [
    ["guard-050", 0.5, LOWER_SUPPORT + 0.5, UPPER_SUPPORT - 0.5, LOWER_SUPPORT, UPPER_SUPPORT],
    ["guard-075", 0.75, LOWER_SUPPORT + 0.75, UPPER_SUPPORT - 0.75, LOWER_SUPPORT + 0.25, UPPER_SUPPORT - 0.25],
    ["guard-100", 1, LOWER_SUPPORT + 1, UPPER_SUPPORT - 1, LOWER_SUPPORT + 0.5, UPPER_SUPPORT - 0.5],
  ] as const;
  if (
    plan.operationalCandidates.length !== expectedCandidates.length ||
    plan.operationalCandidates.some((candidate, index) => {
      const expected = expectedCandidates[index];
      return (
        candidate.id !== expected[0] ||
        candidate.guardBand !== expected[1] ||
        !equal(candidate.selectionCore.lowerTheta, expected[2]) ||
        !equal(candidate.selectionCore.upperTheta, expected[3]) ||
        !equal(candidate.estimationDomain.lowerTheta, expected[4]) ||
        !equal(candidate.estimationDomain.upperTheta, expected[5])
      );
    })
  ) {
    throw new RangeError("Operational candidates are incomplete or reordered.");
  }
  const expectedThetas = [
    LOWER_SUPPORT - 0.25,
    LOWER_SUPPORT,
    LOWER_SUPPORT + 0.25,
    LOWER_SUPPORT + 0.5,
    LOWER_SUPPORT + 0.75,
    LOWER_SUPPORT + 1,
    0,
    UPPER_SUPPORT - 1,
    UPPER_SUPPORT - 0.75,
    UPPER_SUPPORT - 0.5,
    UPPER_SUPPORT - 0.25,
    UPPER_SUPPORT,
    UPPER_SUPPORT + 0.25,
  ];
  if (
    plan.thetaCells.length !== expectedThetas.length ||
    plan.thetaCells.some(
      (cell, index) =>
        !equal(cell.theta, expectedThetas[index]) || cell.generatedPaths !== 10000
    )
  ) {
    throw new RangeError("Feasibility theta cells are incomplete or reordered.");
  }
  const calibration = plan.calibrationPlanning;
  if (
    calibration.targetSelectedPathsPerTheta !== 2500 ||
    calibration.maximumGeneratedPathsPerTheta !== 250000 ||
    calibration.selectionRateLowerBound !== "wilson-one-sided-90-v1" ||
    calibration.z !== 1.2815515655446004 ||
    plan.initialLevelMinimum !== 3 ||
    plan.initialLevelMaximum !== 5 ||
    plan.highLevelFloor !== 7 ||
    plan.minimumHighLevelItems !== 2
  ) {
    throw new RangeError("Feasibility planning or content rules are not frozen.");
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
    throw new RangeError("Feasibility posterior cannot be normalized.");
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
  const weights = Float64Array.from(grid, (theta) =>
    Math.exp(-0.5 * ((theta - mean) / standardDeviation) ** 2)
  );
  normalize(weights);
  return weights;
}

function posteriorMean(grid: readonly number[], weights: Float64Array): number {
  let mean = 0;
  for (let index = 0; index < grid.length; index += 1) {
    mean += grid[index] * weights[index];
  }
  return mean;
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
  plan: SelectionAdjustedFeasibilityPlan
): number {
  const requireHigh =
    needHigh &&
    itemBank.some(
      (item, index) => used[index] === 0 && item.Level >= plan.highLevelFloor
    );
  const top: Array<{ index: number; information: number }> = [];
  for (let index = 0; index < itemBank.length; index += 1) {
    if (used[index] === 1) continue;
    if (requireHigh && itemBank[index].Level < plan.highLevelFloor) continue;
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

function pathStatistics(
  itemBank: Item[],
  grid: number[],
  probabilities: Float64Array[],
  selectionPrior: Float64Array,
  reportingPriorRatio: Float64Array,
  initialCandidates: number[],
  plan: SelectionAdjustedFeasibilityPlan,
  trueTheta: number,
  responseRandom: () => number,
  selectionRandom: () => number
): { eap: number; withinProbability: number } {
  const posterior = new Float64Array(selectionPrior);
  const used = new Uint8Array(itemBank.length);
  let next = initialCandidates[Math.floor(selectionRandom() * initialCandidates.length)];
  let highCount = 0;
  for (let length = 0; length < plan.candidate.fixedLength; length += 1) {
    const item = itemBank[next];
    const response: 0 | 1 =
      responseRandom() < paperProbability3pl(trueTheta, item) ? 1 : 0;
    used[next] = 1;
    if (item.Level >= plan.highLevelFloor) highCount += 1;
    updatePosterior(posterior, probabilities[next], response);
    if (length + 1 < plan.candidate.fixedLength) {
      next = chooseNext(
        itemBank,
        posteriorMean(grid, posterior),
        used,
        highCount < plan.minimumHighLevelItems,
        selectionRandom,
        plan
      );
    }
  }
  if (highCount < plan.minimumHighLevelItems) {
    throw new RangeError("Generated path violates the content constraint.");
  }
  const reporting = Float64Array.from(
    posterior,
    (value, index) => value * reportingPriorRatio[index]
  );
  normalize(reporting);
  let withinProbability = 0;
  for (let index = 0; index < grid.length; index += 1) {
    if (
      grid[index] >= plan.informationSupportRange.lowerTheta &&
      grid[index] <= plan.informationSupportRange.upperTheta
    ) {
      withinProbability += reporting[index];
    }
  }
  return { eap: posteriorMean(grid, reporting), withinProbability };
}

export function oneSidedWilsonLower(
  successes: number,
  trials: number,
  z: number
): number {
  if (
    !Number.isInteger(successes) ||
    !Number.isInteger(trials) ||
    successes < 0 ||
    trials < 1 ||
    successes > trials ||
    !Number.isFinite(z) ||
    z <= 0
  ) {
    throw new RangeError("Invalid Wilson lower-bound inputs.");
  }
  const rate = successes / trials;
  const z2 = z ** 2;
  const denominator = 1 + z2 / trials;
  const center = (rate + z2 / (2 * trials)) / denominator;
  const half =
    (z / denominator) *
    Math.sqrt(rate * (1 - rate) / trials + z2 / (4 * trials ** 2));
  return Math.max(0, center - half);
}

export function runSelectionAdjustedFeasibility(
  itemBank: Item[],
  itemBankSha256: string,
  plan: SelectionAdjustedFeasibilityPlan,
  planSha256: string | null = null,
  provenance: SelectionAdjustedFeasibilityProvenance | null = null
): SelectionAdjustedFeasibilityReport {
  validateSelectionAdjustedFeasibilityPlan(plan);
  if (itemBank.length === 0 || new Set(itemBank.map(({ id }) => id)).size !== itemBank.length) {
    throw new RangeError("The feasibility item bank is empty or has duplicate IDs.");
  }
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
    plan.candidate.selectionPriorMean,
    plan.candidate.selectionPriorStandardDeviation
  );
  const reportingPrior = normalWeights(
    grid,
    plan.candidate.reportingPriorMean,
    plan.candidate.reportingPriorStandardDeviation
  );
  const reportingPriorRatio = Float64Array.from(
    reportingPrior,
    (value, index) => value / selectionPrior[index]
  );
  const initialCandidates = itemBank
    .map((item, index) => ({ item, index }))
    .filter(
      ({ item }) =>
        item.Level >= plan.initialLevelMinimum &&
        item.Level <= plan.initialLevelMaximum
    )
    .map(({ index }) => index);
  if (initialCandidates.length === 0) throw new RangeError("No initial items.");

  const infeasibleCandidateThetaCells: Array<{
    candidateId: OperationalCandidate["id"];
    theta: number;
  }> = [];
  const cells = plan.thetaCells.map((cell, thetaIndex) => {
    const selectedCounts = new Array<number>(plan.operationalCandidates.length).fill(0);
    let posteriorMassPassPaths = 0;
    for (let replication = 0; replication < cell.generatedPaths; replication += 1) {
      const statistics = pathStatistics(
        itemBank,
        grid,
        probabilities,
        selectionPrior,
        reportingPriorRatio,
        initialCandidates,
        plan,
        cell.theta,
        createDeterministicRandom(deriveSeed(plan.seed, thetaIndex, replication, 0x62)),
        createDeterministicRandom(deriveSeed(plan.seed, thetaIndex, replication, 0x63))
      );
      const massPass =
        statistics.withinProbability >= plan.candidate.posteriorMassThreshold;
      if (massPass) posteriorMassPassPaths += 1;
      let previousSelected = true;
      for (let index = 0; index < plan.operationalCandidates.length; index += 1) {
        const core = plan.operationalCandidates[index].selectionCore;
        const selected =
          massPass && statistics.eap >= core.lowerTheta && statistics.eap <= core.upperTheta;
        if (selected) selectedCounts[index] += 1;
        if (selected && !previousSelected) {
          throw new RangeError("Nested selection cores produced a non-nested event.");
        }
        previousSelected = selected;
      }
    }
    return {
      trueTheta: cell.theta,
      generatedPaths: cell.generatedPaths,
      posteriorMassPassPaths,
      candidates: plan.operationalCandidates.map((candidate, index) => {
        const selectedPaths = selectedCounts[index];
        const lowerRate = oneSidedWilsonLower(
          selectedPaths,
          cell.generatedPaths,
          plan.calibrationPlanning.z
        );
        const projected =
          lowerRate * plan.calibrationPlanning.maximumGeneratedPathsPerTheta;
        const calibrationDomainCell =
          cell.theta >= candidate.estimationDomain.lowerTheta &&
          cell.theta <= candidate.estimationDomain.upperTheta;
        const feasible = calibrationDomainCell
          ? projected >= plan.calibrationPlanning.targetSelectedPathsPerTheta
          : null;
        if (feasible === false) {
          infeasibleCandidateThetaCells.push({
            candidateId: candidate.id,
            theta: cell.theta,
          });
        }
        return {
          id: candidate.id,
          calibrationDomainCell,
          selectedPaths,
          selectedRate: selectedPaths / cell.generatedPaths,
          oneSided90WilsonLowerSelectionRate: lowerRate,
          projectedSelectedPathsLowerBoundAtCap: projected,
          calibrationCapFeasible: feasible,
        };
      }),
    };
  });
  const allFeasible = infeasibleCandidateThetaCells.length === 0;
  return {
    schemaVersion: "selection-adjusted-feasibility-v1",
    engineId: "common-path-selection-rate-pilot-v1",
    randomGeneratorId: "mulberry32-v1",
    scoreModelId: PAPER_3PL_CONFIG.scoreModelId,
    validationStatus: "planning-only-not-for-score-reporting",
    itemBankSha256,
    planSha256,
    provenance,
    plan,
    totalGeneratedPaths: plan.thetaCells.reduce(
      (sum, { generatedPaths }) => sum + generatedPaths,
      0
    ),
    commonPathCandidateNestingVerified: true,
    cells,
    planningDecision: {
      allCalibrationDomainCellsFeasible: allFeasible,
      infeasibleCandidateThetaCells,
      nextStep: allFeasible
        ? "freeze-full-selection-adjusted-point-plan"
        : "redesign-calibration-before-evaluation",
    },
  };
}
