import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

import type { Item } from "../src/types.ts";
import {
  runRangeReportingSimulation,
  type RangeReportingSimulationPlan,
} from "../src/utils/rangeReportingSimulation.ts";

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

const plan: RangeReportingSimulationPlan = {
  planId: "range-reporting-test-v1",
  seed: 20260814,
  replicationsPerTheta: 4,
  trueThetas: [-4, 0, 4],
  pathRules: [
    {
      id: "fixed8-randomesque3",
      fixedLength: 8,
      selectionMethod: "randomesque",
      randomesqueSize: 3,
    },
  ],
  posteriorSpecifications: [
    {
      id: "eap-normal-0-1",
      priorMean: 0,
      priorStandardDeviation: 1,
    },
  ],
  selectionPosteriorId: "eap-normal-0-1",
  informationEquivalentStandardDeviationThresholds: [0.3],
  posteriorMassThresholds: [0.9],
  boundaryIndifferenceMargin: 0.5,
  credibleMass: 0.95,
  initialLevelMinimum: 3,
  initialLevelMaximum: 5,
  highLevelFloor: 7,
  minimumHighLevelItems: 2,
  decisionCriteria: {
    binomialIntervalMethod: "wilson-score",
    monteCarloZ: 1.96,
    maximumFalseNumericReportRateOutside: 0.05,
    maximumOppositeExtremeRate: 0.01,
    minimumNumericReportRateInterior: 0.9,
    maximumAbsoluteThetaBiasReported: 0.1,
    maximumThetaRmseReported: 0.3,
    minimumIntervalCoverageReported: 0.925,
    maximumIntervalCoverageReported: 0.975,
  },
  candidatePreferenceOrder: [
    "widest-validated-theta-interval",
    "shortest-fixed-length",
    "highest-posterior-mass-threshold",
    "posterior-specification-id",
  ],
};

test("range-reporting simulation is deterministic and probability complete", () => {
  const first = runRangeReportingSimulation(itemBank, bankSha256, plan);
  const second = runRangeReportingSimulation(itemBank, bankSha256, plan);
  assert.deepEqual(first, second);
  assert.equal(first.schemaVersion, "range-reporting-simulation-v1");
  assert.equal(first.commonResponsePaths, true);
  assert.equal(first.validationStatus, "exploratory-not-for-score-reporting");
  assert.equal(first.selection.productionApproved, false);
  assert.equal(first.results.length, 1);
  assert.equal(first.results[0].candidates.length, 1);
  assert.ok(first.results[0].exposure.maximumExposureRate > 0);

  const candidate = first.results[0].candidates[0];
  assert.equal(candidate.conditional.length, plan.trueThetas.length);
  for (const condition of candidate.conditional) {
    assert.equal(condition.trials, plan.replicationsPerTheta);
    const total = Object.values(condition.classificationRates).reduce(
      (sum, rate) => sum + rate,
      0
    );
    assert.ok(Math.abs(total - 1) <= 1e-12);
    assert.ok(condition.allPaths.thetaRmse >= Math.abs(condition.allPaths.thetaBias));
    if (condition.numericReport.rate === 0) {
      assert.equal(condition.numericallyReported, null);
    } else {
      assert.equal(
        condition.numericallyReported?.trials,
        condition.numericReport.rate * condition.trials
      );
    }
    assert.equal(
      condition.allPaths.thetaCoverage,
      condition.allPaths.vocabularyCoverage
    );
  }
});

test("range-reporting plans reject ambiguous candidate contracts", () => {
  assert.throws(
    () =>
      runRangeReportingSimulation(itemBank, bankSha256, {
        ...plan,
        trueThetas: [0, 0],
      }),
    /trueThetas/
  );
  assert.throws(
    () =>
      runRangeReportingSimulation(itemBank, bankSha256, {
        ...plan,
        selectionPosteriorId: "missing",
      }),
    /selectionPosteriorId/
  );
  assert.throws(
    () =>
      runRangeReportingSimulation(itemBank, bankSha256, {
        ...plan,
        posteriorMassThresholds: [0.5],
      }),
    /Posterior-mass thresholds/
  );
});
