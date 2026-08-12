import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

import type { Item } from "../src/types.ts";
import {
  runIntervalCalibrationSimulation,
  type IntervalCalibrationPlan,
} from "../src/utils/intervalCalibrationSimulation.ts";

const bankBytes = readFileSync(
  new URL("../public/jacet_parameters.csv", import.meta.url)
);
const bankSha256 = createHash("sha256").update(bankBytes).digest("hex");
const itemBank: Item[] = bankBytes
  .toString("utf8")
  .replace(/^\uFEFF/, "")
  .split(/\r?\n/)
  .filter(Boolean)
  .slice(1)
  .map((line, id) => {
    const values = line.split(",");
    return {
      id,
      Level: Number(values[0]),
      Item: values[1] ?? "",
      PartOfSpeech: values[2] ?? "",
      CorrectAnswer: values[3] ?? "",
      Distractor_1: values[4] ?? "",
      Distractor_2: values[5] ?? "",
      Distractor_3: values[6] ?? "",
      Dscrimination: Number(values[7]),
      Difficulty: Number(values[8]),
      Guessing: Number(values[9]),
    };
  });

const plan: IntervalCalibrationPlan = {
  planId: "interval-calibration-test-v1",
  calibrationSeed: 10,
  evaluationSeed: 11,
  calibrationReplicationsPerTheta: 6,
  evaluationReplicationsPerTheta: 5,
  calibrationThetas: [-3, 0, 3],
  evaluationThetas: [-3.5, 0, 3.5],
  reportingCandidates: [
    {
      id: "fixed8-n01",
      fixedLength: 8,
      selectionMethod: "randomesque",
      randomesqueSize: 3,
      reportingPriorMean: 0,
      reportingPriorStandardDeviation: 1,
      informationEquivalentStandardDeviationThreshold: 0.3,
      posteriorMassThreshold: 0.9,
    },
  ],
  selectionPriorMean: 0,
  selectionPriorStandardDeviation: 1,
  intervalMethods: [
    { id: "eap-equal-tail", kind: "posterior-equal-tail" },
    {
      id: "likelihood-ratio-chi-square",
      kind: "likelihood-ratio-fixed-cutoff",
      cutoff: 3.841458820694124,
    },
    {
      id: "likelihood-ratio-neyman",
      kind: "likelihood-ratio-calibrated",
    },
    {
      id: "warm-weighted-likelihood-neyman",
      kind: "weighted-likelihood-ratio-calibrated",
    },
    { id: "eap-neyman-central", kind: "eap-central-calibrated" },
  ],
  nominalCoverage: 0.95,
  calibrationQuantileMethod: "conservative-order-statistic-v1",
  isotonicEapAcceptanceBounds: true,
  inversionGrid: { minimumTheta: -6, maximumTheta: 6, step: 0.01 },
  boundaryIndifferenceMargin: 0.5,
  initialLevelMinimum: 3,
  initialLevelMaximum: 5,
  highLevelFloor: 7,
  minimumHighLevelItems: 2,
  decisionCriteria: {
    binomialIntervalMethod: "wilson-score-tost",
    equivalenceZ: 1.6448536269514722,
    maximumFalseNumericReportRateOutside: 0.05,
    maximumOppositeExtremeRate: 0.01,
    minimumReportableRateInterior: 0.9,
    maximumInvalidIntervalRateInterior: 0.01,
    maximumAbsoluteThetaBiasReported: 0.1,
    maximumThetaRmseReported: 0.3,
    minimumCoverage: 0.925,
    maximumCoverage: 0.975,
    maximumOneSidedMissRate: 0.05,
    maximumMeanThetaIntervalWidth: 0.8,
    maximumP90ThetaIntervalWidth: 1,
  },
  selectionPreference: {
    candidateOrder: ["fixed8-n01"],
    methodOrder: [
      "eap-equal-tail",
      "likelihood-ratio-chi-square",
      "likelihood-ratio-neyman",
      "warm-weighted-likelihood-neyman",
      "eap-neyman-central",
    ],
    tieBreaker: "smallest-maximum-conditional-mean-theta-width",
  },
};

test("interval calibration separates seeds and is exactly reproducible", () => {
  const first = runIntervalCalibrationSimulation(itemBank, bankSha256, plan);
  const second = runIntervalCalibrationSimulation(itemBank, bankSha256, plan);
  assert.deepEqual(first, second);
  assert.equal(first.schemaVersion, "interval-calibration-simulation-v1");
  assert.equal(first.calibrationEvaluationSeedsSeparated, true);
  assert.equal(first.commonRandomNumbersAcrossCandidates, true);
  assert.equal(first.commonResponsePathsWithinCandidate, true);
  assert.equal(first.validationStatus, "exploratory-not-for-score-reporting");
  assert.equal(first.results.length, 1);
  assert.equal(first.results[0].methods.length, plan.intervalMethods.length);
  assert.equal(first.calibrationCurves.length, 3);
  assert.equal(first.selection.productionApproved, false);
  for (const method of first.results[0].methods) {
    assert.equal(method.conditional.length, plan.evaluationThetas.length);
    for (const cell of method.conditional) {
      const classificationTotal = Object.values(
        cell.rangeClassificationRates
      ).reduce((sum, rate) => sum + rate, 0);
      assert.ok(Math.abs(classificationTotal - 1) <= 1e-12);
      assert.ok(cell.reportableRate <= cell.intervalValidRate);
      if (cell.reportedTrials > 0) {
        assert.equal(
          cell.thetaCoverageReported,
          cell.vocabularyCoverageReported
        );
      }
    }
  }
});

test("interval calibration rejects leaked or ambiguous contracts", () => {
  assert.throws(
    () =>
      runIntervalCalibrationSimulation(itemBank, bankSha256, {
        ...plan,
        evaluationSeed: plan.calibrationSeed,
      }),
    /distinct nonnegative integers/
  );
  assert.throws(
    () =>
      runIntervalCalibrationSimulation(itemBank, bankSha256, {
        ...plan,
        calibrationThetas: [0, 0],
      }),
    /Calibration thetas/
  );
  assert.throws(
    () =>
      runIntervalCalibrationSimulation(itemBank, bankSha256, {
        ...plan,
        selectionPreference: {
          ...plan.selectionPreference,
          methodOrder: [
            ...plan.selectionPreference.methodOrder.slice(0, -1),
            "not-a-frozen-method",
          ],
        },
      }),
    /frozen calibration or selection contract/
  );
});

test("selection preference may deliberately differ from definition order", () => {
  const reordered = runIntervalCalibrationSimulation(itemBank, bankSha256, {
    ...plan,
    selectionPreference: {
      ...plan.selectionPreference,
      methodOrder: [...plan.selectionPreference.methodOrder].reverse(),
    },
  });
  assert.equal(reordered.selection.productionApproved, false);
});
