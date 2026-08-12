import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

import type { Item } from "../src/types.ts";
import {
  runExposureSimulation,
  type ExposureSimulationPlan,
} from "../src/utils/exposureSimulation.ts";

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
const plan: ExposureSimulationPlan = {
  planId: "exposure-simulation-test-v1",
  seed: 20260812,
  calibrationCycles: 2,
  calibrationReplicationsPerTheta: 3,
  evaluationReplicationsPerTheta: 3,
  trueThetas: [-3, 0, 3],
  initialLevelMinimum: 3,
  initialLevelMaximum: 5,
  estimatorIds: ["eap-normal-0-1", "warm-wle-bounded"],
  designs: [
    {
      id: "fixed8-sh050-three-band",
      fixedLength: 8,
      targetMaximumExposure: 0.5,
      levelBands: [
        { id: "low", levels: [1, 2], minimumItems: 1 },
        { id: "middle", levels: [3, 4, 5, 6], minimumItems: 1 },
        { id: "high", levels: [7, 8], minimumItems: 1 },
      ],
    },
  ],
};

test("exposure calibration and evaluation are exactly reproducible", () => {
  const first = runExposureSimulation(itemBank, bankSha, plan);
  const second = runExposureSimulation(itemBank, bankSha, plan);
  assert.deepEqual(first, second);
  assert.equal(first.schemaVersion, "exposure-simulation-v1");
  assert.equal(first.exposureMethod, "unconditional-sympson-hetter");
  assert.equal(first.results.length, 1);
  const result = first.results[0];
  assert.equal(result.calibration.cycles.length, plan.calibrationCycles);
  assert.equal(result.calibration.administrationParameters.length, itemBank.length);
  assert.ok(
    result.calibration.administrationParameters.every(
      (parameter) => parameter >= 0 && parameter <= 1
    )
  );
  assert.equal(result.evaluation.blueprint.violationRate, 0);
  assert.equal(result.evaluation.estimators.length, plan.estimatorIds.length);
  assert.ok(result.evaluation.exposure.maximumExposureRate > 0);
  assert.ok(result.evaluation.exposure.maximumConditionalExposureRate > 0);
  for (const estimator of result.evaluation.estimators) {
    assert.equal(estimator.conditional.length, plan.trueThetas.length);
    assert.ok(estimator.maximumConditionalRmse >= 0);
  }
});

test("exposure plans reject overlapping and infeasible blueprints", () => {
  assert.throws(
    () =>
      runExposureSimulation(itemBank, bankSha, {
        ...plan,
        designs: [
          {
            ...plan.designs[0],
            levelBands: [
              { id: "a", levels: [1, 2], minimumItems: 1 },
              { id: "b", levels: [2, 3], minimumItems: 1 },
            ],
          },
        ],
      }),
    /must be disjoint/
  );
  assert.throws(
    () =>
      runExposureSimulation(itemBank, bankSha, {
        ...plan,
        designs: [
          {
            ...plan.designs[0],
            fixedLength: 2,
            levelBands: [
              { id: "low", levels: [1, 2], minimumItems: 2 },
              { id: "high", levels: [7, 8], minimumItems: 1 },
            ],
          },
        ],
      }),
    /minima exceed length/
  );
});
