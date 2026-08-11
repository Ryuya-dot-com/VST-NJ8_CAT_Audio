export const LEGACY_CAT_CONFIG = Object.freeze({
  scoreModelId: "legacy-cat-v0",
  itemResponse: Object.freeze({
    model: "3PL",
    logisticScale: 1,
  }),
  abilityEstimator: Object.freeze({
    method: "EAP",
    uncertainty: "posterior-standard-deviation",
  }),
  thetaGrid: Object.freeze({
    min: -6,
    max: 6,
    step: 0.01,
  }),
  prior: Object.freeze({
    mean: 0,
    standardDeviation: 1,
  }),
  stopping: Object.freeze({
    minimumItems: 20,
    maximumItems: 30,
    targetPosteriorStandardDeviation: 0.4,
  }),
  contentConstraint: Object.freeze({
    initialLevelMinimum: 3,
    initialLevelMaximum: 5,
    highLevelFloor: 7,
    minimumHighLevelItems: 2,
  }),
  vocabularyBandSize: 1000,
  vocabularyDifficultyThresholds: Object.freeze([
    -2.206,
    -1.512,
    -0.701,
    -0.075,
    0.748,
    1.152,
    1.504,
    2.089,
  ]),
});

export interface StopState {
  posteriorStandardDeviation: number;
  administeredItems: number;
  highLevelItems: number;
}

/**
 * Reproduces the content constraint in the pre-remediation application.
 * This is a baseline contract, not a psychometric endorsement.
 */
export function needsHighLevelItems(
  highLevelItems: number,
  minimumHighLevelItems =
    LEGACY_CAT_CONFIG.contentConstraint.minimumHighLevelItems
): boolean {
  return highLevelItems < minimumHighLevelItems;
}

/**
 * Reproduces the pre-remediation stopping rule exactly:
 * continue while precision, minimum-length, or content criteria are unmet,
 * subject to an unconditional maximum length.
 */
export function shouldContinueTest(state: StopState): boolean {
  const { stopping } = LEGACY_CAT_CONFIG;
  return (
    (state.posteriorStandardDeviation >
      stopping.targetPosteriorStandardDeviation ||
      state.administeredItems < stopping.minimumItems ||
      needsHighLevelItems(state.highLevelItems)) &&
    state.administeredItems < stopping.maximumItems
  );
}
