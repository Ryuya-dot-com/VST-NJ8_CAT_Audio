import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

import type { Item } from "../src/types.ts";
import {
  EXPLORATORY_MEASUREMENT_RANGE_CONFIG,
  classifyPosteriorMeasurementRange,
  deriveInformationSupportRange,
  type InformationSupportRange,
} from "../src/utils/measurementRange.ts";
import {
  paperItemInformation3pl,
  type PosteriorEstimate,
} from "../src/utils/paperScoring.ts";

interface ReferenceCase {
  informationEquivalentStandardDeviationThreshold: number;
  lowerTheta: number;
  upperTheta: number;
  informationThreshold: number;
  lowerInformation: number;
  upperInformation: number;
  lowerPaperVocabularyScore: number;
  upperPaperVocabularyScore: number;
}

interface ReferenceFixture {
  policyId: string;
  generatedBy: string;
  referenceRuntime: string;
  numericalTolerance: number;
  itemBank: { path: string; sha256: string; itemCount: number };
  cases: ReferenceCase[];
}

const reference = JSON.parse(
  readFileSync(
    new URL("./fixtures/measurement-range-v1.json", import.meta.url),
    "utf8"
  )
) as ReferenceFixture;
const bankBytes = readFileSync(
  new URL(`../${reference.itemBank.path}`, import.meta.url)
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
  assert.ok(
    Math.abs(actual - expected) <= reference.numericalTolerance,
    `${label}: expected ${expected}, received ${actual}`
  );
}

test("information-support boundaries match the independent base-R reference", () => {
  assert.equal(reference.generatedBy, "scripts/reference-measurement-range.R");
  assert.match(reference.referenceRuntime, /^R /);
  assert.equal(reference.policyId, EXPLORATORY_MEASUREMENT_RANGE_CONFIG.policyId);
  assert.equal(
    createHash("sha256").update(bankBytes).digest("hex"),
    reference.itemBank.sha256
  );
  assert.equal(itemBank.length, reference.itemBank.itemCount);

  for (const scenario of reference.cases) {
    const actual = deriveInformationSupportRange(itemBank, {
      informationEquivalentStandardDeviationThreshold:
        scenario.informationEquivalentStandardDeviationThreshold,
    });
    assertClose(actual.lowerTheta, scenario.lowerTheta, "lower theta");
    assertClose(actual.upperTheta, scenario.upperTheta, "upper theta");
    assertClose(
      actual.informationThreshold,
      scenario.informationThreshold,
      "information threshold"
    );
    assertClose(
      actual.lowerBoundaryInformation,
      scenario.lowerInformation,
      "lower-boundary information"
    );
    assertClose(
      actual.upperBoundaryInformation,
      scenario.upperInformation,
      "upper-boundary information"
    );
    assertClose(
      actual.lowerPaperVocabularyScore,
      scenario.lowerPaperVocabularyScore,
      "lower-boundary model score"
    );
    assertClose(
      actual.upperPaperVocabularyScore,
      scenario.upperPaperVocabularyScore,
      "upper-boundary model score"
    );
  }
});

test("the support interval is the connected component containing theta zero", () => {
  const range = deriveInformationSupportRange(itemBank);
  assert.equal(range.definition, "connected-full-bank-information-component");
  assert.ok(range.lowerTheta < 0 && range.upperTheta > 0);
  const threshold = range.informationThreshold;
  const information = (theta: number): number =>
    itemBank.reduce(
      (sum, item) => sum + paperItemInformation3pl(theta, item),
      0
    );
  assert.ok(information(range.lowerTheta + 1e-6) > threshold);
  assert.ok(information(range.lowerTheta - 1e-6) < threshold);
  assert.ok(information(range.upperTheta - 1e-6) > threshold);
  assert.ok(information(range.upperTheta + 1e-6) < threshold);

  const strict = deriveInformationSupportRange(itemBank, {
    informationEquivalentStandardDeviationThreshold: 0.25,
  });
  const permissive = deriveInformationSupportRange(itemBank, {
    informationEquivalentStandardDeviationThreshold: 0.35,
  });
  assert.ok(permissive.lowerTheta < range.lowerTheta);
  assert.ok(range.lowerTheta < strict.lowerTheta);
  assert.ok(strict.upperTheta < range.upperTheta);
  assert.ok(range.upperTheta < permissive.upperTheta);
});

function syntheticPosterior(weights: number[]): PosteriorEstimate {
  const grid = [-4, -3, 0, 3, 4];
  const theta = weights.reduce(
    (sum, weight, index) => sum + weight * grid[index],
    0
  );
  const variance = weights.reduce((sum, weight, index) => {
    return sum + weight * (grid[index] - theta) ** 2;
  }, 0);
  return {
    theta,
    thetaStandardDeviation: Math.sqrt(variance),
    grid,
    weights,
  };
}

const syntheticRange: InformationSupportRange = {
  policyId: "synthetic",
  definition: "connected-full-bank-information-component",
  anchorTheta: 0,
  informationEquivalentStandardDeviationThreshold: 0.3,
  informationThreshold: 1 / 0.3 ** 2,
  lowerTheta: -2.5,
  upperTheta: 2.5,
  lowerPaperVocabularyScore: 1000,
  upperPaperVocabularyScore: 7000,
  lowerBoundaryInformation: 1 / 0.3 ** 2,
  upperBoundaryInformation: 1 / 0.3 ** 2,
};

test("posterior range classification requires decisive probability mass", () => {
  const scenarios: Array<{
    weights: number[];
    expected: string;
  }> = [
    { weights: [0.96, 0, 0.04, 0, 0], expected: "below-range" },
    { weights: [0, 0, 0.96, 0, 0.04], expected: "within-range" },
    { weights: [0, 0, 0.04, 0, 0.96], expected: "above-range" },
    { weights: [0.5, 0, 0.5, 0, 0], expected: "indeterminate" },
  ];
  for (const scenario of scenarios) {
    const result = classifyPosteriorMeasurementRange(
      syntheticPosterior(scenario.weights),
      syntheticRange
    );
    assert.equal(result.classification, scenario.expected);
    assert.equal(result.validationStatus, "exploratory-not-for-score-reporting");
    assertClose(
      result.belowRangeProbability +
        result.withinRangeProbability +
        result.aboveRangeProbability,
      1,
      "classification probability total"
    );
  }
});

test("range derivation and classification reject ambiguous inputs", () => {
  assert.throws(() => deriveInformationSupportRange([]), /item bank is empty/);
  assert.throws(
    () =>
      deriveInformationSupportRange(itemBank, {
        informationEquivalentStandardDeviationThreshold: 0.01,
      }),
    /anchor theta is outside/
  );
  assert.throws(
    () =>
      classifyPosteriorMeasurementRange(
        syntheticPosterior([0, 0, 0.9, 0, 0]),
        syntheticRange
      ),
    /normalized/
  );
  assert.throws(
    () =>
      classifyPosteriorMeasurementRange(
        syntheticPosterior([0, 0, 1, 0, 0]),
        syntheticRange,
        0.5
      ),
    /strictly between/
  );
});
