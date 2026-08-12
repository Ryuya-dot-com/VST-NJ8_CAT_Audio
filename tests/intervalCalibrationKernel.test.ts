import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

import type { Item } from "../src/types.ts";
import {
  summarizeIntervalNumericalKernel,
  type IntervalNumericalKernelSummary,
} from "../src/utils/intervalCalibrationSimulation.ts";

interface Fixture {
  contractId: string;
  generatedBy: string;
  generatorSha256: string;
  referenceRuntime: string;
  itemBankSha256: string;
  tolerance: { absolute: number; relative: number };
  scenarios: Array<{
    name: string;
    administered: number[];
    responses: Array<0 | 1>;
    priorStandardDeviation: number;
    expected: Omit<IntervalNumericalKernelSummary, "priorStandardDeviation">;
  }>;
}

const fixtureBytes = readFileSync(
  new URL("./fixtures/interval-calibration-kernel-v1.json", import.meta.url)
);
const fixture = JSON.parse(fixtureBytes.toString("utf8")) as Fixture;
const bankBytes = readFileSync(
  new URL("../public/jacet_parameters.csv", import.meta.url)
);
const referenceBytes = readFileSync(
  new URL("../scripts/reference-interval-calibration-kernel.R", import.meta.url)
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

function assertInterval(
  actual: { lower: number; upper: number; valid: boolean },
  expected: { lower: number; upper: number; valid: boolean },
  label: string
): void {
  assert.equal(actual.valid, expected.valid, `${label} validity`);
  assertClose(actual.lower, expected.lower, `${label} lower`);
  assertClose(actual.upper, expected.upper, `${label} upper`);
}

test("interval kernel fixture is pinned to independent base R and item bank", () => {
  assert.equal(fixture.contractId, "interval-calibration-kernel-v1");
  assert.equal(
    fixture.generatedBy,
    "scripts/reference-interval-calibration-kernel.R"
  );
  assert.match(fixture.referenceRuntime, /^R /);
  assert.equal(
    createHash("sha256").update(referenceBytes).digest("hex"),
    fixture.generatorSha256
  );
  assert.equal(
    createHash("sha256").update(bankBytes).digest("hex"),
    fixture.itemBankSha256
  );
});

test("posterior, LR, Warm objective, and interval inversion match base R", () => {
  for (const scenario of fixture.scenarios) {
    const actual = summarizeIntervalNumericalKernel(
      itemBank,
      scenario.administered,
      scenario.responses,
      scenario.priorStandardDeviation
    );
    const expected = scenario.expected;
    assert.equal(actual.priorStandardDeviation, scenario.priorStandardDeviation);
    assertClose(actual.eap, expected.eap, `${scenario.name} EAP`);
    assertClose(
      actual.posteriorStandardDeviation,
      expected.posteriorStandardDeviation,
      `${scenario.name} posterior SD`
    );
    assertInterval(
      { ...actual.posteriorEqualTail95, valid: true },
      { ...expected.posteriorEqualTail95, valid: true },
      `${scenario.name} posterior equal-tail interval`
    );
    assertClose(
      actual.likelihoodMaximumThetaOnGrid,
      expected.likelihoodMaximumThetaOnGrid,
      `${scenario.name} likelihood grid maximum`
    );
    assertClose(
      actual.warmWeightedLikelihoodMaximumThetaOnGrid,
      expected.warmWeightedLikelihoodMaximumThetaOnGrid,
      `${scenario.name} Warm grid maximum`
    );
    assertInterval(
      actual.likelihoodRatioChiSquare95,
      expected.likelihoodRatioChiSquare95,
      `${scenario.name} LR interval`
    );
    assertInterval(
      actual.warmWeightedLikelihoodChiSquareDiagnostic95,
      expected.warmWeightedLikelihoodChiSquareDiagnostic95,
      `${scenario.name} Warm diagnostic interval`
    );
    assertClose(
      actual.likelihoodRatioAtThetaZero,
      expected.likelihoodRatioAtThetaZero,
      `${scenario.name} LR statistic at theta zero`
    );
    assertClose(
      actual.warmWeightedLikelihoodRatioAtThetaZero,
      expected.warmWeightedLikelihoodRatioAtThetaZero,
      `${scenario.name} Warm LR statistic at theta zero`
    );
  }
});

test("interval numerical kernel rejects malformed paths", () => {
  assert.throws(
    () => summarizeIntervalNumericalKernel(itemBank, [0, 0], [1, 0], 1),
    /Invalid interval numerical-kernel inputs/
  );
  assert.throws(
    () => summarizeIntervalNumericalKernel(itemBank, [0], [], 1),
    /Invalid interval numerical-kernel inputs/
  );
});
