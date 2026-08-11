import type { Item } from "../types";
import {
  PAPER_3PL_CONFIG,
  paperItemInformation3pl,
  paperProbability3pl,
} from "./paperScoring.ts";

export type AbilityEstimatorMethod = "EAP" | "MAP" | "MLE" | "WARM_WLE";

export interface NormalPriorSpecification {
  mean: number;
  standardDeviation: number;
}

export interface AbilityEstimatorSpecification {
  estimatorId: string;
  method: AbilityEstimatorMethod;
  prior?: NormalPriorSpecification;
}

export interface AbilityEstimatorResult {
  estimatorId: string;
  method: AbilityEstimatorMethod;
  theta: number;
  posteriorStandardDeviation: number | null;
  posteriorCredibleInterval95: { lower: number; upper: number } | null;
  localInformationEquivalentStandardDeviation: number | null;
  boundaryHit: boolean;
}

export const EXPLORATORY_ABILITY_ESTIMATORS: readonly AbilityEstimatorSpecification[] =
  Object.freeze([
    Object.freeze({
      estimatorId: "eap-normal-0-1",
      method: "EAP" as const,
      prior: Object.freeze({ mean: 0, standardDeviation: 1 }),
    }),
    Object.freeze({
      estimatorId: "eap-normal-0-2",
      method: "EAP" as const,
      prior: Object.freeze({ mean: 0, standardDeviation: 2 }),
    }),
    Object.freeze({
      estimatorId: "map-normal-0-1",
      method: "MAP" as const,
      prior: Object.freeze({ mean: 0, standardDeviation: 1 }),
    }),
    Object.freeze({
      estimatorId: "map-normal-0-2",
      method: "MAP" as const,
      prior: Object.freeze({ mean: 0, standardDeviation: 2 }),
    }),
    Object.freeze({ estimatorId: "mle-bounded", method: "MLE" as const }),
    Object.freeze({
      estimatorId: "warm-wle-bounded",
      method: "WARM_WLE" as const,
    }),
  ]);

interface PosteriorGridSummary {
  mean: number;
  standardDeviation: number;
  credibleInterval95: { lower: number; upper: number };
}

interface MaximumResult {
  theta: number;
  boundaryHit: boolean;
}

const GOLDEN_RATIO_CONJUGATE = (Math.sqrt(5) - 1) / 2;
const REFINEMENT_TOLERANCE = 1e-11;
const BOUNDARY_TOLERANCE = 1e-8;

function assertResponseData(
  itemBank: Item[],
  administered: number[],
  responses: Array<0 | 1>
): void {
  if (administered.length === 0) {
    throw new RangeError("At least one administered item is required.");
  }
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

function assertPrior(
  prior: NormalPriorSpecification | undefined
): asserts prior is NormalPriorSpecification {
  if (
    prior === undefined ||
    !Number.isFinite(prior.mean) ||
    !Number.isFinite(prior.standardDeviation) ||
    prior.standardDeviation <= 0
  ) {
    throw new RangeError("EAP and MAP require a finite normal prior with positive SD.");
  }
}

function thetaGrid(): number[] {
  const { min, max, step } = PAPER_3PL_CONFIG.thetaGrid;
  const size = Math.round((max - min) / step) + 1;
  return Array.from({ length: size }, (_, index) => min + index * step);
}

function logLikelihood(
  theta: number,
  itemBank: Item[],
  administered: number[],
  responses: Array<0 | 1>
): number {
  let value = 0;
  for (let responseIndex = 0; responseIndex < administered.length; responseIndex += 1) {
    const probability = paperProbability3pl(
      theta,
      itemBank[administered[responseIndex]]
    );
    value +=
      responses[responseIndex] === 1
        ? Math.log(probability)
        : Math.log1p(-probability);
  }
  return value;
}

function logNormalPrior(theta: number, prior: NormalPriorSpecification): number {
  const standardized = (theta - prior.mean) / prior.standardDeviation;
  return (
    -0.5 * standardized ** 2 -
    Math.log(prior.standardDeviation * Math.sqrt(2 * Math.PI))
  );
}

function administeredInformation(
  theta: number,
  itemBank: Item[],
  administered: number[]
): number {
  return administered.reduce(
    (sum, index) => sum + paperItemInformation3pl(theta, itemBank[index]),
    0
  );
}

function summarizePosteriorGrid(logWeights: readonly number[]): PosteriorGridSummary {
  const grid = thetaGrid();
  if (logWeights.length !== grid.length) {
    throw new RangeError("Posterior values must cover the complete theta grid.");
  }
  const maximum = Math.max(...logWeights);
  if (!Number.isFinite(maximum)) {
    throw new RangeError("The posterior is zero throughout the theta grid.");
  }
  const weights = logWeights.map((value) => Math.exp(value - maximum));
  const total = weights.reduce((sum, value) => sum + value, 0);
  if (!Number.isFinite(total) || total <= 0) {
    throw new RangeError("The posterior distribution could not be normalized.");
  }
  const normalizedWeights = weights.map((weight) => weight / total);
  const mean = normalizedWeights.reduce(
    (sum, weight, index) => sum + weight * grid[index],
    0
  );
  const variance = normalizedWeights.reduce((sum, weight, index) => {
    const difference = grid[index] - mean;
    return sum + weight * difference ** 2;
  }, 0);
  const quantile = (probability: number): number => {
    let cumulative = 0;
    for (let index = 0; index < grid.length; index += 1) {
      cumulative += normalizedWeights[index];
      if (cumulative >= probability) return grid[index];
    }
    return grid[grid.length - 1];
  };
  return {
    mean,
    standardDeviation: Math.sqrt(variance),
    credibleInterval95: { lower: quantile(0.025), upper: quantile(0.975) },
  };
}

function refineMaximum(
  objective: (theta: number) => number,
  initialLower: number,
  initialUpper: number
): number {
  let lower = initialLower;
  let upper = initialUpper;
  let left = upper - GOLDEN_RATIO_CONJUGATE * (upper - lower);
  let right = lower + GOLDEN_RATIO_CONJUGATE * (upper - lower);
  let leftValue = objective(left);
  let rightValue = objective(right);

  while (upper - lower > REFINEMENT_TOLERANCE) {
    if (leftValue > rightValue) {
      upper = right;
      right = left;
      rightValue = leftValue;
      left = upper - GOLDEN_RATIO_CONJUGATE * (upper - lower);
      leftValue = objective(left);
    } else {
      lower = left;
      left = right;
      leftValue = rightValue;
      right = lower + GOLDEN_RATIO_CONJUGATE * (upper - lower);
      rightValue = objective(right);
    }
  }
  return leftValue > rightValue ? left : right;
}

function maximizeOnPaperBounds(
  objective: (theta: number) => number,
  gridValues: readonly number[]
): MaximumResult {
  const grid = thetaGrid();
  if (gridValues.length !== grid.length) {
    throw new RangeError("Objective values must cover the complete theta grid.");
  }
  let bestIndex = 0;
  let bestValue = gridValues[0];
  for (let index = 1; index < grid.length; index += 1) {
    const value = gridValues[index];
    if (value > bestValue) {
      bestIndex = index;
      bestValue = value;
    }
  }
  if (!Number.isFinite(bestValue)) {
    throw new RangeError("The estimator objective is non-finite throughout the theta grid.");
  }

  const lastIndex = grid.length - 1;
  if (bestIndex === 0 || bestIndex === lastIndex) {
    return { theta: grid[bestIndex], boundaryHit: true };
  }

  const refined = refineMaximum(
    objective,
    grid[bestIndex - 1],
    grid[bestIndex + 1]
  );
  const candidates = [grid[bestIndex], refined];
  let theta = candidates[0];
  let value = objective(theta);
  for (const candidate of candidates.slice(1)) {
    const candidateValue = objective(candidate);
    if (candidateValue > value) {
      theta = candidate;
      value = candidateValue;
    }
  }
  const { min, max } = PAPER_3PL_CONFIG.thetaGrid;
  return {
    theta,
    boundaryHit:
      Math.abs(theta - min) <= BOUNDARY_TOLERANCE ||
      Math.abs(theta - max) <= BOUNDARY_TOLERANCE,
  };
}

function localInformationEquivalentStandardDeviation(
  theta: number,
  itemBank: Item[],
  administered: number[]
): number {
  const information = administeredInformation(theta, itemBank, administered);
  return information > 0 ? 1 / Math.sqrt(information) : Number.POSITIVE_INFINITY;
}

export function estimateAbilityCandidates(
  itemBank: Item[],
  administered: number[],
  responses: Array<0 | 1>,
  specifications: readonly AbilityEstimatorSpecification[] =
    EXPLORATORY_ABILITY_ESTIMATORS
): AbilityEstimatorResult[] {
  assertResponseData(itemBank, administered, responses);
  if (specifications.length === 0) {
    throw new RangeError("At least one estimator specification is required.");
  }
  const estimatorIds = specifications.map(({ estimatorId }) => estimatorId);
  if (
    estimatorIds.some((estimatorId) => estimatorId.trim().length === 0) ||
    new Set(estimatorIds).size !== estimatorIds.length
  ) {
    throw new RangeError("Estimator IDs must be non-empty and unique.");
  }

  const likelihood = (theta: number): number =>
    logLikelihood(theta, itemBank, administered, responses);
  const grid = thetaGrid();
  const likelihoodGrid = grid.map(likelihood);
  const informationGrid = specifications.some(
    ({ method }) => method === "WARM_WLE"
  )
    ? grid.map((theta) => administeredInformation(theta, itemBank, administered))
    : null;

  return specifications.map((specification) => {
    if (specification.method === "EAP") {
      assertPrior(specification.prior);
      const prior = specification.prior;
      const posterior = summarizePosteriorGrid(
        grid.map(
          (theta, index) =>
            likelihoodGrid[index] + logNormalPrior(theta, prior)
        )
      );
      return {
        estimatorId: specification.estimatorId,
        method: specification.method,
        theta: posterior.mean,
        posteriorStandardDeviation: posterior.standardDeviation,
        posteriorCredibleInterval95: posterior.credibleInterval95,
        localInformationEquivalentStandardDeviation: null,
        boundaryHit: false,
      };
    }

    if (specification.method === "MAP") {
      assertPrior(specification.prior);
      const prior = specification.prior;
      const maximum = maximizeOnPaperBounds(
        (theta) => likelihood(theta) + logNormalPrior(theta, prior),
        grid.map(
          (theta, index) =>
            likelihoodGrid[index] + logNormalPrior(theta, prior)
        )
      );
      return {
        estimatorId: specification.estimatorId,
        method: specification.method,
        theta: maximum.theta,
        posteriorStandardDeviation: null,
        posteriorCredibleInterval95: null,
        localInformationEquivalentStandardDeviation: null,
        boundaryHit: maximum.boundaryHit,
      };
    }

    if (specification.method === "MLE") {
      const maximum = maximizeOnPaperBounds(likelihood, likelihoodGrid);
      return {
        estimatorId: specification.estimatorId,
        method: specification.method,
        theta: maximum.theta,
        posteriorStandardDeviation: null,
        posteriorCredibleInterval95: null,
        localInformationEquivalentStandardDeviation:
          localInformationEquivalentStandardDeviation(
            maximum.theta,
            itemBank,
            administered
          ),
        boundaryHit: maximum.boundaryHit,
      };
    }

    if (informationGrid === null) {
      throw new RangeError("Warm WLE requires administered-test information.");
    }
    const wleObjective = (theta: number): number => {
      const information = administeredInformation(theta, itemBank, administered);
      return information > 0
        ? likelihood(theta) + 0.5 * Math.log(information)
        : Number.NEGATIVE_INFINITY;
    };
    const maximum = maximizeOnPaperBounds(
      wleObjective,
      informationGrid.map((information, index) =>
        information > 0
          ? likelihoodGrid[index] + 0.5 * Math.log(information)
          : Number.NEGATIVE_INFINITY
      )
    );
    return {
      estimatorId: specification.estimatorId,
      method: specification.method,
      theta: maximum.theta,
      posteriorStandardDeviation: null,
      posteriorCredibleInterval95: null,
      localInformationEquivalentStandardDeviation:
        localInformationEquivalentStandardDeviation(
          maximum.theta,
          itemBank,
          administered
        ),
      boundaryHit: maximum.boundaryHit,
    };
  });
}
