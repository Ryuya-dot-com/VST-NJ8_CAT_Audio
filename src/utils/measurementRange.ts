import type { Item } from "../types";
import {
  paperItemInformation3pl,
  paperVocabularyAtTheta,
  type PosteriorEstimate,
} from "./paperScoring.ts";

export const EXPLORATORY_MEASUREMENT_RANGE_CONFIG = Object.freeze({
  policyId: "information-support-exploratory-v1",
  validationStatus: "exploratory-not-for-score-reporting",
  informationEquivalentStandardDeviationThreshold: 0.3,
  posteriorMassThreshold: 0.95,
  anchorTheta: 0,
  search: Object.freeze({
    minimumTheta: -6,
    maximumTheta: 6,
    step: 0.01,
    rootTolerance: 1e-12,
    maximumBisectionIterations: 200,
  }),
});

export interface InformationSupportRangeOptions {
  policyId?: string;
  informationEquivalentStandardDeviationThreshold?: number;
  anchorTheta?: number;
  minimumTheta?: number;
  maximumTheta?: number;
  searchStep?: number;
  rootTolerance?: number;
  maximumBisectionIterations?: number;
}

export interface InformationSupportRange {
  policyId: string;
  definition: "connected-full-bank-information-component";
  anchorTheta: number;
  informationEquivalentStandardDeviationThreshold: number;
  informationThreshold: number;
  lowerTheta: number;
  upperTheta: number;
  lowerPaperVocabularyScore: number;
  upperPaperVocabularyScore: number;
  lowerBoundaryInformation: number;
  upperBoundaryInformation: number;
}

export type MeasurementRangeClassification =
  | "below-range"
  | "within-range"
  | "above-range"
  | "indeterminate";

export interface PosteriorRangeClassification {
  policyId: string;
  validationStatus: "exploratory-not-for-score-reporting";
  classification: MeasurementRangeClassification;
  posteriorMassThreshold: number;
  belowRangeProbability: number;
  withinRangeProbability: number;
  aboveRangeProbability: number;
  thetaPosteriorMean: number;
  thetaPosteriorStandardDeviation: number;
}

function totalBankInformation(itemBank: readonly Item[], theta: number): number {
  return itemBank.reduce(
    (sum, item) => sum + paperItemInformation3pl(theta, item),
    0
  );
}

function assertPositiveFinite(value: number, label: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${label} must be positive and finite.`);
  }
}

function bisectCrossing(
  functionValue: (theta: number) => number,
  left: number,
  right: number,
  tolerance: number,
  maximumIterations: number
): number {
  let leftValue = functionValue(left);
  let rightValue = functionValue(right);
  if (leftValue === 0) return left;
  if (rightValue === 0) return right;
  if (Math.sign(leftValue) === Math.sign(rightValue)) {
    throw new RangeError("The root-search bracket does not contain a crossing.");
  }

  for (let iteration = 0; iteration < maximumIterations; iteration += 1) {
    const midpoint = (left + right) / 2;
    const midpointValue = functionValue(midpoint);
    if (midpointValue === 0 || (right - left) / 2 <= tolerance) {
      return midpoint;
    }
    if (Math.sign(midpointValue) === Math.sign(leftValue)) {
      left = midpoint;
      leftValue = midpointValue;
    } else {
      right = midpoint;
      rightValue = midpointValue;
    }
  }
  throw new RangeError("The information-range boundary did not converge.");
}

function bracketBoundary(
  functionValue: (theta: number) => number,
  anchorTheta: number,
  limitTheta: number,
  step: number
): [number, number] {
  const direction = limitTheta < anchorTheta ? -1 : 1;
  let supportedTheta = anchorTheta;
  while (
    direction < 0 ? supportedTheta > limitTheta : supportedTheta < limitTheta
  ) {
    const candidateTheta =
      direction < 0
        ? Math.max(limitTheta, supportedTheta - step)
        : Math.min(limitTheta, supportedTheta + step);
    if (functionValue(candidateTheta) < 0) {
      return direction < 0
        ? [candidateTheta, supportedTheta]
        : [supportedTheta, candidateTheta];
    }
    supportedTheta = candidateTheta;
  }
  throw new RangeError(
    "The connected information-support component does not close inside the search interval."
  );
}

export function deriveInformationSupportRange(
  itemBank: readonly Item[],
  options: InformationSupportRangeOptions = {}
): InformationSupportRange {
  if (itemBank.length === 0) throw new RangeError("The item bank is empty.");
  const defaults = EXPLORATORY_MEASUREMENT_RANGE_CONFIG;
  const informationEquivalentStandardDeviationThreshold =
    options.informationEquivalentStandardDeviationThreshold ??
    defaults.informationEquivalentStandardDeviationThreshold;
  const anchorTheta = options.anchorTheta ?? defaults.anchorTheta;
  const minimumTheta =
    options.minimumTheta ?? defaults.search.minimumTheta;
  const maximumTheta =
    options.maximumTheta ?? defaults.search.maximumTheta;
  const searchStep = options.searchStep ?? defaults.search.step;
  const rootTolerance =
    options.rootTolerance ?? defaults.search.rootTolerance;
  const maximumBisectionIterations =
    options.maximumBisectionIterations ??
    defaults.search.maximumBisectionIterations;

  assertPositiveFinite(
    informationEquivalentStandardDeviationThreshold,
    "Information-equivalent standard-deviation threshold"
  );
  assertPositiveFinite(searchStep, "Root-search step");
  assertPositiveFinite(rootTolerance, "Root tolerance");
  if (
    !Number.isFinite(minimumTheta) ||
    !Number.isFinite(maximumTheta) ||
    !Number.isFinite(anchorTheta) ||
    minimumTheta >= anchorTheta ||
    anchorTheta >= maximumTheta
  ) {
    throw new RangeError(
      "The finite search interval must strictly contain the anchor theta."
    );
  }
  if (
    !Number.isInteger(maximumBisectionIterations) ||
    maximumBisectionIterations < 1
  ) {
    throw new RangeError("Maximum bisection iterations must be a positive integer.");
  }

  const informationThreshold =
    1 / informationEquivalentStandardDeviationThreshold ** 2;
  const informationDifference = (theta: number): number =>
    totalBankInformation(itemBank, theta) - informationThreshold;
  if (informationDifference(anchorTheta) < 0) {
    throw new RangeError(
      "The anchor theta is outside the requested information-support set."
    );
  }

  const lowerBracket = bracketBoundary(
    informationDifference,
    anchorTheta,
    minimumTheta,
    searchStep
  );
  const upperBracket = bracketBoundary(
    informationDifference,
    anchorTheta,
    maximumTheta,
    searchStep
  );
  const lowerTheta = bisectCrossing(
    informationDifference,
    lowerBracket[0],
    lowerBracket[1],
    rootTolerance,
    maximumBisectionIterations
  );
  const upperTheta = bisectCrossing(
    informationDifference,
    upperBracket[0],
    upperBracket[1],
    rootTolerance,
    maximumBisectionIterations
  );

  return {
    policyId: options.policyId ?? defaults.policyId,
    definition: "connected-full-bank-information-component",
    anchorTheta,
    informationEquivalentStandardDeviationThreshold,
    informationThreshold,
    lowerTheta,
    upperTheta,
    lowerPaperVocabularyScore: paperVocabularyAtTheta(lowerTheta, [...itemBank]),
    upperPaperVocabularyScore: paperVocabularyAtTheta(upperTheta, [...itemBank]),
    lowerBoundaryInformation: totalBankInformation(itemBank, lowerTheta),
    upperBoundaryInformation: totalBankInformation(itemBank, upperTheta),
  };
}

function validatePosterior(posterior: PosteriorEstimate): void {
  if (
    posterior.grid.length === 0 ||
    posterior.grid.length !== posterior.weights.length
  ) {
    throw new RangeError(
      "Posterior grid and weights must be non-empty and equal length."
    );
  }
  let totalWeight = 0;
  for (let index = 0; index < posterior.grid.length; index += 1) {
    const theta = posterior.grid[index];
    const weight = posterior.weights[index];
    if (!Number.isFinite(theta) || !Number.isFinite(weight) || weight < 0) {
      throw new RangeError(
        "Posterior grid values and nonnegative weights must be finite."
      );
    }
    if (index > 0 && theta <= posterior.grid[index - 1]) {
      throw new RangeError("Posterior grid values must be strictly increasing.");
    }
    totalWeight += weight;
  }
  if (Math.abs(totalWeight - 1) > 1e-10) {
    throw new RangeError("Posterior weights must be normalized.");
  }
}

export function classifyPosteriorMeasurementRange(
  posterior: PosteriorEstimate,
  range: InformationSupportRange,
  posteriorMassThreshold: number =
    EXPLORATORY_MEASUREMENT_RANGE_CONFIG.posteriorMassThreshold
): PosteriorRangeClassification {
  validatePosterior(posterior);
  if (
    !Number.isFinite(range.lowerTheta) ||
    !Number.isFinite(range.upperTheta) ||
    range.lowerTheta >= range.upperTheta
  ) {
    throw new RangeError("Measurement-range bounds must be finite and ordered.");
  }
  if (
    !Number.isFinite(posteriorMassThreshold) ||
    posteriorMassThreshold <= 0.5 ||
    posteriorMassThreshold >= 1
  ) {
    throw new RangeError(
      "Posterior-mass threshold must be finite and strictly between .5 and 1."
    );
  }

  let belowRangeProbability = 0;
  let withinRangeProbability = 0;
  let aboveRangeProbability = 0;
  for (let index = 0; index < posterior.grid.length; index += 1) {
    const theta = posterior.grid[index];
    const weight = posterior.weights[index];
    if (theta < range.lowerTheta) {
      belowRangeProbability += weight;
    } else if (theta > range.upperTheta) {
      aboveRangeProbability += weight;
    } else {
      withinRangeProbability += weight;
    }
  }

  let classification: MeasurementRangeClassification = "indeterminate";
  if (belowRangeProbability >= posteriorMassThreshold) {
    classification = "below-range";
  } else if (aboveRangeProbability >= posteriorMassThreshold) {
    classification = "above-range";
  } else if (withinRangeProbability >= posteriorMassThreshold) {
    classification = "within-range";
  }

  return {
    policyId: range.policyId,
    validationStatus: "exploratory-not-for-score-reporting",
    classification,
    posteriorMassThreshold,
    belowRangeProbability,
    withinRangeProbability,
    aboveRangeProbability,
    thetaPosteriorMean: posterior.theta,
    thetaPosteriorStandardDeviation: posterior.thetaStandardDeviation,
  };
}
