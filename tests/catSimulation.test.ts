import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

import type { Item } from "../src/types.ts";
import {
  createDeterministicRandom,
  runCatSimulation,
  type SimulationPlan,
} from "../src/utils/catSimulation.ts";

const itemBankBytes = readFileSync(
  new URL("../public/jacet_parameters.csv", import.meta.url)
);
const itemBankSha256 = createHash("sha256")
  .update(itemBankBytes)
  .digest("hex");

function parseItemBank(csv: string): Item[] {
  return csv
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
}

const itemBank = parseItemBank(itemBankBytes.toString("utf8"));
const smokePlan: SimulationPlan = {
  planId: "smoke-test-v1",
  seed: 20260812,
  replicationsPerTheta: 2,
  trueThetas: [-1, 0, 1],
  rules: [
    {
      id: "precision-smoke",
      minimumItems: 5,
      maximumItems: 8,
      targetPosteriorStandardDeviation: 0.5,
      selectionMethod: "maximum-information",
    },
    {
      id: "fixed-randomesque-smoke",
      minimumItems: 8,
      maximumItems: 8,
      targetPosteriorStandardDeviation: null,
      selectionMethod: "randomesque",
      randomesqueSize: 3,
    },
  ],
  initialLevelMinimum: 3,
  initialLevelMaximum: 5,
  highLevelFloor: 7,
  minimumHighLevelItems: 2,
  credibleMass: 0.95,
};

test("the seeded random generator has a stable sequence", () => {
  const random = createDeterministicRandom(123456789);
  const sequence = Array.from({ length: 5 }, () => random());
  assert.deepEqual(sequence, [
    0.2577907438389957,
    0.9707721115555614,
    0.7853280142880976,
    0.20616457983851433,
    0.30307188746519387,
  ]);
});

test("the CAT simulation is exactly reproducible for a fixed plan", () => {
  const first = runCatSimulation(itemBank, itemBankSha256, smokePlan);
  const second = runCatSimulation(itemBank, itemBankSha256, smokePlan);
  assert.deepEqual(second, first);
  assert.equal(first.schemaVersion, "cat-simulation-v1");
  assert.equal(first.engineId, "cat-eap-3pl-monte-carlo-v1");
  assert.equal(first.randomGeneratorId, "mulberry32-v1");
  assert.equal(first.scoreModelId, "paper-3pl-v1");
  assert.equal(first.results.length, smokePlan.rules.length);
  for (const result of first.results) {
    assert.equal(
      result.overall.trials,
      smokePlan.trueThetas.length * smokePlan.replicationsPerTheta
    );
    assert.ok(result.overall.meanLength >= result.rule.minimumItems);
    assert.ok(result.overall.meanLength <= result.rule.maximumItems);
    assert.ok(result.overall.thetaCoverage >= 0);
    assert.ok(result.overall.thetaCoverage <= 1);
    assert.ok(result.overall.vocabularyCoverage >= 0);
    assert.ok(result.overall.vocabularyCoverage <= 1);
    assert.ok(result.exposure.maximumExposureRate >= 0);
    assert.ok(result.exposure.maximumExposureRate <= 1);
    assert.ok(result.exposure.unusedItemRate >= 0);
    assert.ok(result.exposure.unusedItemRate <= 1);
    assert.equal(result.overall.highLevelConstraintViolationRate, 0);
    assert.ok(result.overall.monteCarloStandardErrors.thetaBias >= 0);
    assert.ok(result.overall.monteCarloStandardErrors.thetaRmse >= 0);
    assert.ok(result.overall.monteCarloStandardErrors.meanLength >= 0);
    const stopRateTotal = Object.values(result.overall.stopRates).reduce(
      (sum, rate) => sum + rate,
      0
    );
    assert.ok(Math.abs(stopRateTotal - 1) <= 1e-12);
  }
});

test("invalid simulation plans fail before generating responses", () => {
  assert.throws(
    () =>
      runCatSimulation(itemBank, itemBankSha256, {
        ...smokePlan,
        replicationsPerTheta: 0,
      }),
    RangeError
  );
  assert.throws(
    () =>
      runCatSimulation(itemBank, itemBankSha256, {
        ...smokePlan,
        rules: [smokePlan.rules[0], smokePlan.rules[0]],
      }),
    RangeError
  );
  assert.throws(
    () =>
      runCatSimulation(itemBank, itemBankSha256, {
        ...smokePlan,
        rules: [
          {
            ...smokePlan.rules[1],
            randomesqueSize: 0,
          },
        ],
      }),
    RangeError
  );
  assert.throws(
    () =>
      runCatSimulation(itemBank, itemBankSha256, {
        ...smokePlan,
        rules: [
          {
            ...smokePlan.rules[1],
            minimumItems: 5,
          },
        ],
      }),
    /Fixed-length rule/
  );
});
