import { PAPER_3PL_CONFIG } from "./paperScoring.ts";

export interface SelectiveReportingPlan {
  planId: string;
  calibrationSeed: number;
  evaluationSeed: number;
  candidate: {
    id: "fixed30-n02-info025-mass095";
    fixedLength: 30;
    selectionMethod: "randomesque";
    randomesqueSize: 5;
    selectionPriorMean: 0;
    selectionPriorStandardDeviation: 1;
    reportingPriorMean: 0;
    reportingPriorStandardDeviation: 2;
    informationEquivalentStandardDeviationThreshold: 0.25;
    posteriorMassThreshold: 0.95;
  };
  informationSupportRange: {
    lowerTheta: number;
    upperTheta: number;
  };
  selectionEvent: "posterior-within-range-and-eap-inside-support";
  calibration: {
    thetas: number[];
    targetSelectedPathsPerTheta: number;
    maximumGeneratedPathsPerTheta: number;
    nominalCoverage: 0.95;
    simultaneousQuantileMethod:
      "exact-binomial-bonferroni-order-statistic-v1";
    familywiseAlpha: 0.05;
    monotoneEnvelopeMethod: "conservative-minorant-majorant-v1";
  };
  evaluationCells: Array<{ theta: number; generatedPaths: number }>;
  inversionGrid: {
    minimumTheta: -6;
    maximumTheta: 6;
    step: 0.01;
    includeExactSupportEndpoints: true;
  };
  intervalRule: {
    id: "selective-eap-neyman-central";
    statistic: "eap-normal-0-2";
    disconnectedSetRule: "convex-hull";
    pointContainmentRule: "include-eap-by-hull-expansion";
    emptySetRule: "full-information-support-range";
    finalRangeRule: "intersect-information-support-range";
  };
  initialLevelMinimum: 3;
  initialLevelMaximum: 5;
  highLevelFloor: 7;
  minimumHighLevelItems: 2;
  boundaryIndifferenceMargin: 0.5;
  decisionCriteria: {
    binomialIntervalMethod: "wilson-score-tost";
    equivalenceZ: number;
    minimumSelectedEvaluationPathsPerSupportedTheta: number;
    maximumFalseNumericReportRateOutside: number;
    maximumOppositeExtremeRate: number;
    minimumReportableRateInterior: number;
    maximumEmptyInversionFallbackRate: number;
    maximumAbsoluteThetaBiasSelected: number;
    maximumThetaRmseSelected: number;
    minimumCoverage: number;
    maximumCoverage: number;
    maximumOneSidedMissRate: number;
    maximumMeanThetaIntervalWidth: number;
    maximumP90ThetaIntervalWidth: number;
  };
  confirmationReplicationsPerThetaIfPassed: number;
}

export interface SimultaneousCentralRanks {
  lowerRankOneBased: number;
  upperRankOneBased: number;
  perEndpointAlpha: number;
  achievedLowerTailProbability: number;
}

function binomialCdf(successes: number, trials: number, probability: number): number {
  if (successes < 0) return 0;
  if (successes >= trials) return 1;
  let term = (1 - probability) ** trials;
  let total = term;
  for (let count = 0; count < successes; count += 1) {
    term *=
      ((trials - count) / (count + 1)) *
      (probability / (1 - probability));
    total += term;
  }
  return total;
}

export function exactBonferroniCentralRanks(
  selectedPathsPerTheta: number,
  calibrationThetaCount: number,
  nominalCoverage: number,
  familywiseAlpha: number
): SimultaneousCentralRanks {
  if (
    !Number.isInteger(selectedPathsPerTheta) ||
    selectedPathsPerTheta < 1 ||
    !Number.isInteger(calibrationThetaCount) ||
    calibrationThetaCount < 1 ||
    !Number.isFinite(nominalCoverage) ||
    nominalCoverage <= 0 ||
    nominalCoverage >= 1 ||
    !Number.isFinite(familywiseAlpha) ||
    familywiseAlpha <= 0 ||
    familywiseAlpha >= 1
  ) {
    throw new RangeError("Invalid simultaneous central-rank contract.");
  }
  const tailProbability = (1 - nominalCoverage) / 2;
  const perEndpointAlpha = familywiseAlpha / (2 * calibrationThetaCount);
  let lowerRankOneBased = 0;
  let achievedLowerTailProbability = 0;
  for (let rank = 1; rank <= selectedPathsPerTheta; rank += 1) {
    const probability = binomialCdf(
      rank - 1,
      selectedPathsPerTheta,
      tailProbability
    );
    if (probability <= perEndpointAlpha) {
      lowerRankOneBased = rank;
      achievedLowerTailProbability = probability;
    } else {
      break;
    }
  }
  if (lowerRankOneBased < 1) {
    throw new RangeError(
      "Calibration sample is too small for the simultaneous quantile contract."
    );
  }
  return {
    lowerRankOneBased,
    upperRankOneBased: selectedPathsPerTheta - lowerRankOneBased + 1,
    perEndpointAlpha,
    achievedLowerTailProbability,
  };
}

export function conservativeMonotoneAcceptanceEnvelope(
  rawLower: readonly number[],
  rawUpper: readonly number[]
): { lower: number[]; upper: number[] } {
  if (
    rawLower.length === 0 ||
    rawLower.length !== rawUpper.length ||
    rawLower.some((value) => !Number.isFinite(value)) ||
    rawUpper.some((value) => !Number.isFinite(value)) ||
    rawLower.some((value, index) => value > rawUpper[index])
  ) {
    throw new RangeError("Invalid raw selective acceptance limits.");
  }
  const lower = new Array<number>(rawLower.length);
  let suffixMinimum = Number.POSITIVE_INFINITY;
  for (let index = rawLower.length - 1; index >= 0; index -= 1) {
    suffixMinimum = Math.min(suffixMinimum, rawLower[index]);
    lower[index] = suffixMinimum;
  }
  const upper = new Array<number>(rawUpper.length);
  let prefixMaximum = Number.NEGATIVE_INFINITY;
  for (let index = 0; index < rawUpper.length; index += 1) {
    prefixMaximum = Math.max(prefixMaximum, rawUpper[index]);
    upper[index] = prefixMaximum;
  }
  return { lower, upper };
}

function strictlyIncreasing(values: readonly number[]): boolean {
  return values.every(
    (value, index) =>
      Number.isFinite(value) && (index === 0 || value > values[index - 1])
  );
}

export function validateSelectiveReportingPlan(
  plan: SelectiveReportingPlan
): SimultaneousCentralRanks {
  if (
    plan.planId.trim().length === 0 ||
    !Number.isSafeInteger(plan.calibrationSeed) ||
    !Number.isSafeInteger(plan.evaluationSeed) ||
    plan.calibrationSeed < 0 ||
    plan.evaluationSeed < 0 ||
    plan.calibrationSeed === plan.evaluationSeed
  ) {
    throw new RangeError("Invalid selective plan ID or random seeds.");
  }
  const candidate = plan.candidate;
  if (
    candidate.id !== "fixed30-n02-info025-mass095" ||
    candidate.fixedLength !== 30 ||
    candidate.selectionMethod !== "randomesque" ||
    candidate.randomesqueSize !== 5 ||
    candidate.selectionPriorMean !== 0 ||
    candidate.selectionPriorStandardDeviation !== 1 ||
    candidate.reportingPriorMean !== 0 ||
    candidate.reportingPriorStandardDeviation !== 2 ||
    candidate.informationEquivalentStandardDeviationThreshold !== 0.25 ||
    candidate.posteriorMassThreshold !== 0.95
  ) {
    throw new RangeError("The selective reporting candidate is not frozen.");
  }
  const { lowerTheta, upperTheta } = plan.informationSupportRange;
  if (
    lowerTheta !== -2.7578183981455946 ||
    upperTheta !== 3.3090556474466313 ||
    lowerTheta >= upperTheta
  ) {
    throw new RangeError("The information-support range is not frozen.");
  }
  if (
    plan.selectionEvent !==
      "posterior-within-range-and-eap-inside-support" ||
    plan.calibration.simultaneousQuantileMethod !==
      "exact-binomial-bonferroni-order-statistic-v1" ||
    plan.calibration.monotoneEnvelopeMethod !==
      "conservative-minorant-majorant-v1" ||
    plan.calibration.nominalCoverage !== 0.95 ||
    plan.calibration.familywiseAlpha !== 0.05 ||
    !Number.isInteger(plan.calibration.targetSelectedPathsPerTheta) ||
    !Number.isInteger(plan.calibration.maximumGeneratedPathsPerTheta) ||
    plan.calibration.targetSelectedPathsPerTheta < 1 ||
    plan.calibration.maximumGeneratedPathsPerTheta <
      plan.calibration.targetSelectedPathsPerTheta
  ) {
    throw new RangeError("Invalid selective calibration contract.");
  }
  const expectedCalibrationThetas = [
    lowerTheta,
    ...Array.from({ length: 25 }, (_, index) => -2.75 + index * 0.25),
    upperTheta,
  ];
  if (
    !strictlyIncreasing(plan.calibration.thetas) ||
    plan.calibration.thetas.length !== expectedCalibrationThetas.length ||
    plan.calibration.thetas.some(
      (theta, index) => theta !== expectedCalibrationThetas[index]
    )
  ) {
    throw new RangeError("Calibration theta cells are incomplete or reordered.");
  }
  if (
    plan.evaluationCells.length !== 27 ||
    !strictlyIncreasing(plan.evaluationCells.map(({ theta }) => theta)) ||
    plan.evaluationCells.some(
      ({ generatedPaths }) =>
        !Number.isInteger(generatedPaths) || generatedPaths < 1
    )
  ) {
    throw new RangeError("Evaluation cells must be 27 ordered fixed-size cells.");
  }
  const supportedCells = plan.evaluationCells.filter(
    ({ theta }) => theta >= lowerTheta && theta <= upperTheta
  );
  if (
    supportedCells.length !== 14 ||
    supportedCells[0].theta !== lowerTheta ||
    supportedCells[supportedCells.length - 1].theta !== upperTheta ||
    supportedCells.some(
      ({ generatedPaths }) =>
        generatedPaths <
        plan.decisionCriteria.minimumSelectedEvaluationPathsPerSupportedTheta
    )
  ) {
    throw new RangeError("Supported-theta evaluation evidence is incomplete.");
  }
  const grid = PAPER_3PL_CONFIG.thetaGrid;
  if (
    plan.inversionGrid.minimumTheta !== grid.min ||
    plan.inversionGrid.maximumTheta !== grid.max ||
    plan.inversionGrid.step !== grid.step ||
    plan.inversionGrid.includeExactSupportEndpoints !== true
  ) {
    throw new RangeError("Selective inversion must use the augmented paper grid.");
  }
  if (
    plan.intervalRule.id !== "selective-eap-neyman-central" ||
    plan.intervalRule.statistic !== "eap-normal-0-2" ||
    plan.intervalRule.disconnectedSetRule !== "convex-hull" ||
    plan.intervalRule.pointContainmentRule !==
      "include-eap-by-hull-expansion" ||
    plan.intervalRule.emptySetRule !== "full-information-support-range" ||
    plan.intervalRule.finalRangeRule !==
      "intersect-information-support-range"
  ) {
    throw new RangeError("Invalid selective interval rule.");
  }
  const criteria = plan.decisionCriteria;
  const probabilities = [
    criteria.maximumFalseNumericReportRateOutside,
    criteria.maximumOppositeExtremeRate,
    criteria.minimumReportableRateInterior,
    criteria.maximumEmptyInversionFallbackRate,
    criteria.minimumCoverage,
    criteria.maximumCoverage,
    criteria.maximumOneSidedMissRate,
  ];
  if (
    criteria.binomialIntervalMethod !== "wilson-score-tost" ||
    !Number.isFinite(criteria.equivalenceZ) ||
    criteria.equivalenceZ <= 0 ||
    probabilities.some((value) => value <= 0 || value >= 1) ||
    criteria.minimumCoverage >= criteria.maximumCoverage ||
    !Number.isInteger(
      criteria.minimumSelectedEvaluationPathsPerSupportedTheta
    ) ||
    criteria.minimumSelectedEvaluationPathsPerSupportedTheta < 1 ||
    criteria.maximumAbsoluteThetaBiasSelected <= 0 ||
    criteria.maximumThetaRmseSelected <= 0 ||
    criteria.maximumMeanThetaIntervalWidth <= 0 ||
    criteria.maximumP90ThetaIntervalWidth <= 0 ||
    plan.initialLevelMinimum !== 3 ||
    plan.initialLevelMaximum !== 5 ||
    plan.highLevelFloor !== 7 ||
    plan.minimumHighLevelItems !== 2 ||
    plan.boundaryIndifferenceMargin !== 0.5 ||
    plan.confirmationReplicationsPerThetaIfPassed < 5000
  ) {
    throw new RangeError("Invalid selective decision or content contract.");
  }
  return exactBonferroniCentralRanks(
    plan.calibration.targetSelectedPathsPerTheta,
    plan.calibration.thetas.length,
    plan.calibration.nominalCoverage,
    plan.calibration.familywiseAlpha
  );
}
