import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import type { Item } from "../src/types.ts";
import {
  estimateAbilityCandidates,
  EXPLORATORY_ABILITY_ESTIMATORS,
  type AbilityEstimatorResult,
} from "../src/utils/abilityEstimators.ts";
import { estimatePaperPosteriorEap } from "../src/utils/paperScoring.ts";

interface ExpectedEstimate {
  theta: number;
  posteriorStandardDeviation?: number;
  posteriorCredibleInterval95?: { lower: number; upper: number };
  localInformationEquivalentStandardDeviation?: number;
  boundaryHit: boolean;
}

interface ReferenceFixture {
  contractId: string;
  generatedBy: string;
  referenceRuntime: string;
  tolerance: { absolute: number; relative: number };
  scenarios: Array<{
    name: string;
    administered: number[];
    responses: Array<0 | 1>;
    estimates: Record<string, ExpectedEstimate>;
  }>;
}

const fixture = JSON.parse(
  readFileSync(
    new URL("./fixtures/ability-estimators-v1.json", import.meta.url),
    "utf8"
  )
) as ReferenceFixture;
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

function assertClose(actual: number, expected: number, label: string): void {
  const difference = Math.abs(actual - expected);
  const tolerance = Math.max(
    fixture.tolerance.absolute,
    fixture.tolerance.relative * Math.max(1, Math.abs(expected))
  );
  assert.ok(
    difference <= tolerance,
    `${label}: expected ${expected}, received ${actual}, difference ${difference}`
  );
}

function resultById(
  results: AbilityEstimatorResult[],
  estimatorId: string
): AbilityEstimatorResult {
  const result = results.find((candidate) => candidate.estimatorId === estimatorId);
  assert.ok(result, `Missing result for ${estimatorId}`);
  return result;
}

test("estimator candidates match independent base-R reference calculations", () => {
  assert.equal(fixture.contractId, "ability-estimators-v1");
  assert.equal(fixture.generatedBy, "scripts/reference-ability-estimators.R");
  assert.match(fixture.referenceRuntime, /^R /);
  for (const scenario of fixture.scenarios) {
    const results = estimateAbilityCandidates(
      itemBank,
      scenario.administered,
      scenario.responses
    );
    assert.equal(results.length, EXPLORATORY_ABILITY_ESTIMATORS.length);
    for (const [estimatorId, expected] of Object.entries(scenario.estimates)) {
      const actual = resultById(results, estimatorId);
      assertClose(actual.theta, expected.theta, `${scenario.name} ${estimatorId} theta`);
      assert.equal(actual.boundaryHit, expected.boundaryHit);
      if (expected.posteriorStandardDeviation === undefined) {
        assert.equal(actual.posteriorStandardDeviation, null);
      } else {
        assert.ok(actual.posteriorStandardDeviation !== null);
        assertClose(
          actual.posteriorStandardDeviation,
          expected.posteriorStandardDeviation,
          `${scenario.name} ${estimatorId} posterior SD`
        );
      }
      if (expected.posteriorCredibleInterval95 === undefined) {
        assert.equal(actual.posteriorCredibleInterval95, null);
      } else {
        assert.ok(actual.posteriorCredibleInterval95 !== null);
        assertClose(
          actual.posteriorCredibleInterval95.lower,
          expected.posteriorCredibleInterval95.lower,
          `${scenario.name} ${estimatorId} posterior lower 95% bound`
        );
        assertClose(
          actual.posteriorCredibleInterval95.upper,
          expected.posteriorCredibleInterval95.upper,
          `${scenario.name} ${estimatorId} posterior upper 95% bound`
        );
      }
      if (expected.localInformationEquivalentStandardDeviation === undefined) {
        assert.equal(actual.localInformationEquivalentStandardDeviation, null);
      } else {
        assert.ok(actual.localInformationEquivalentStandardDeviation !== null);
        assertClose(
          actual.localInformationEquivalentStandardDeviation,
          expected.localInformationEquivalentStandardDeviation,
          `${scenario.name} ${estimatorId} information-equivalent SD`
        );
      }
    }
  }
});

test("standard-normal EAP remains exactly aligned with paper-3pl-v1", () => {
  for (const scenario of fixture.scenarios) {
    const established = estimatePaperPosteriorEap(
      itemBank,
      scenario.administered,
      scenario.responses
    );
    const exploratory = resultById(
      estimateAbilityCandidates(
        itemBank,
        scenario.administered,
        scenario.responses,
        [EXPLORATORY_ABILITY_ESTIMATORS[0]]
      ),
      "eap-normal-0-1"
    );
    assertClose(exploratory.theta, established.theta, `${scenario.name} EAP theta`);
    assert.ok(exploratory.posteriorStandardDeviation !== null);
    assertClose(
      exploratory.posteriorStandardDeviation,
      established.thetaStandardDeviation,
      `${scenario.name} EAP posterior SD`
    );
  }
});

test("constant response patterns expose bounded MLE and finite Warm WLE", () => {
  for (const scenarioName of ["all_correct_eight", "all_incorrect_eight"]) {
    const scenario = fixture.scenarios.find(({ name }) => name === scenarioName);
    assert.ok(scenario);
    const results = estimateAbilityCandidates(
      itemBank,
      scenario.administered,
      scenario.responses
    );
    const mle = resultById(results, "mle-bounded");
    const wle = resultById(results, "warm-wle-bounded");
    assert.equal(mle.boundaryHit, true);
    assert.equal(Math.abs(mle.theta), 6);
    assert.equal(wle.boundaryHit, false);
    assert.ok(Number.isFinite(wle.theta));
  }
});

test("estimator inputs reject empty, duplicated, and prior-free specifications", () => {
  assert.throws(
    () => estimateAbilityCandidates(itemBank, [], []),
    /At least one administered/
  );
  assert.throws(
    () => estimateAbilityCandidates(itemBank, [0, 0], [1, 0]),
    /cannot be administered more than once/
  );
  assert.throws(
    () =>
      estimateAbilityCandidates(itemBank, [0], [1], [
        { estimatorId: "eap-without-prior", method: "EAP" },
      ]),
    /require a finite normal prior/
  );
  assert.throws(
    () =>
      estimateAbilityCandidates(itemBank, [0], [1], [
        { estimatorId: "duplicate", method: "MLE" },
        { estimatorId: "duplicate", method: "WARM_WLE" },
      ]),
    /non-empty and unique/
  );
});
