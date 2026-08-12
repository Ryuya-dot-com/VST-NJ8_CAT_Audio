import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

import type { Item } from "../src/types.ts";
import {
  runEstimatorSensitivity,
  type EstimatorSensitivityPlan,
} from "../src/utils/estimatorSensitivity.ts";

const bankBytes = readFileSync(
  new URL("../public/jacet_parameters.csv", import.meta.url)
);
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
const bankSha = createHash("sha256").update(bankBytes).digest("hex");
const plan: EstimatorSensitivityPlan = {
  planId: "estimator-sensitivity-test-v1",
  seed: 20260812,
  replicationsPerTheta: 4,
  trueThetas: [-3.5, 0, 3.5],
  pathRules: [
    {
      id: "fixed8-randomesque3",
      fixedLength: 8,
      selectionMethod: "randomesque",
      randomesqueSize: 3,
    },
  ],
  initialLevelMinimum: 3,
  initialLevelMaximum: 5,
  highLevelFloor: 7,
  minimumHighLevelItems: 2,
};

test("common-path estimator sensitivity is exactly reproducible", () => {
  const first = runEstimatorSensitivity(itemBank, bankSha, plan);
  const second = runEstimatorSensitivity(itemBank, bankSha, plan);
  assert.deepEqual(first, second);
  assert.equal(first.schemaVersion, "estimator-sensitivity-v1");
  assert.equal(first.comparisonScale, "theta");
  assert.equal(first.commonRandomNumbers, true);
  assert.equal(first.results.length, 1);
  assert.equal(first.results[0].estimators.length, 6);
  assert.ok(first.results[0].exposure.maximumExposureRate > 0);

  for (const estimator of first.results[0].estimators) {
    assert.equal(estimator.conditional.length, plan.trueThetas.length);
    for (const condition of estimator.conditional) {
      assert.equal(condition.trials, plan.replicationsPerTheta);
      assert.ok(condition.thetaRmse >= Math.abs(condition.thetaBias));
      assert.ok(condition.boundaryRate >= 0 && condition.boundaryRate <= 1);
      if (estimator.specification.method === "EAP") {
        assert.ok(condition.posteriorCoverage95 !== null);
        assert.ok(condition.meanPosteriorStandardDeviation !== null);
      } else {
        assert.equal(condition.posteriorCoverage95, null);
      }
    }
  }
});

test("sensitivity plans reject ambiguous theta and path contracts", () => {
  assert.throws(
    () =>
      runEstimatorSensitivity(itemBank, bankSha, {
        ...plan,
        trueThetas: [0, 0],
      }),
    /unique and within/
  );
  assert.throws(
    () =>
      runEstimatorSensitivity(itemBank, bankSha, {
        ...plan,
        pathRules: [{ ...plan.pathRules[0], fixedLength: 1 }],
      }),
    /Invalid fixed length/
  );
});
