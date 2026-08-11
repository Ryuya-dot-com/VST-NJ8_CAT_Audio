import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

import type { Item } from "../src/types.ts";
import {
  PAPER_3PL_CONFIG,
  computeLevelParameterMeans,
  deguessedVocabularyAtTheta,
  estimatePaperPosteriorEap,
  paperItemInformation3pl,
  paperLevelExpectedProbability,
  paperProbability3pl,
  paperVocabularyAtTheta,
  selectNextPaperItem,
  summarizePaperVocabularyPosterior,
} from "../src/utils/paperScoring.ts";

interface VocabularyFixture {
  posteriorMean: number;
  posteriorStandardDeviation: number;
  credibleIntervalLower: number;
  credibleIntervalUpper: number;
  plugInAtThetaMean: number;
}

interface Fixture {
  modelId: string;
  generatedBy: string;
  referenceRuntime: string;
  tolerance: { absolute: number; relative: number };
  itemBank: { path: string; sha256: string; itemCount: number };
  config: Record<string, unknown>;
  levelMeans: Array<{
    level: number;
    itemCount: number;
    discrimination: number;
    difficulty: number;
    guessing: number;
  }>;
  paperLowerAsymptote: number;
  levelFourExample: { theta: number; expectedProbability: number };
  vocabularyScenarios: Array<{
    theta: number;
    paperVocabulary: number;
    deguessedVocabulary: number;
  }>;
  itemScenarios: Array<{
    itemIndex: number;
    theta: number;
    probability: number;
    information: number;
  }>;
  abilityScenarios: Array<{
    name: string;
    administered: number[];
    responses: Array<0 | 1>;
    theta: number;
    thetaStandardDeviation: number;
    vocabulary: VocabularyFixture;
  }>;
  selectionScenarios: Array<{
    theta: number;
    administered: number[];
    needHigh: boolean;
    selected: number;
  }>;
}

const fixture = JSON.parse(
  readFileSync(
    new URL("./fixtures/paper-3pl-v1.json", import.meta.url),
    "utf8"
  )
) as Fixture;
const itemBankBytes = readFileSync(
  new URL(`../${fixture.itemBank.path}`, import.meta.url)
);

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

function assertClose(actual: number, expected: number, label: string): void {
  const difference = Math.abs(actual - expected);
  const allowedDifference = Math.max(
    fixture.tolerance.absolute,
    fixture.tolerance.relative * Math.max(1, Math.abs(expected))
  );
  assert.ok(
    difference <= allowedDifference,
    `${label}: expected ${expected}, received ${actual}, difference ${difference}, tolerance ${allowedDifference}`
  );
}

test("paper-3pl-v1 configuration and item bank match the R reference contract", () => {
  assert.equal(fixture.generatedBy, "scripts/reference-paper-3pl.R");
  assert.match(fixture.referenceRuntime, /^R /);
  assert.equal(
    createHash("sha256").update(itemBankBytes).digest("hex"),
    fixture.itemBank.sha256
  );
  assert.equal(itemBank.length, fixture.itemBank.itemCount);
  assert.equal(PAPER_3PL_CONFIG.scoreModelId, fixture.modelId);
  assert.deepEqual(PAPER_3PL_CONFIG, fixture.config);
});

test("unrounded level means and the published Level 4 example match base R", () => {
  const levelMeans = computeLevelParameterMeans(itemBank);
  assert.equal(levelMeans.length, fixture.levelMeans.length);
  for (let index = 0; index < levelMeans.length; index += 1) {
    const actual = levelMeans[index];
    const expected = fixture.levelMeans[index];
    assert.equal(actual.level, expected.level);
    assert.equal(actual.itemCount, expected.itemCount);
    assertClose(
      actual.discrimination,
      expected.discrimination,
      `Level ${actual.level} discrimination`
    );
    assertClose(
      actual.difficulty,
      expected.difficulty,
      `Level ${actual.level} difficulty`
    );
    assertClose(actual.guessing, expected.guessing, `Level ${actual.level} guessing`);
  }

  const levelFour = levelMeans[3];
  assertClose(
    paperLevelExpectedProbability(fixture.levelFourExample.theta, levelFour),
    fixture.levelFourExample.expectedProbability,
    "Published Level 4 probability at theta zero"
  );
  assert.ok(
    fixture.levelFourExample.expectedProbability >= 0.635 &&
      fixture.levelFourExample.expectedProbability < 0.645,
    "The published example must round to approximately 64%."
  );
});

test("paper and deguessed vocabulary scales match the independent R fixtures", () => {
  assertClose(
    paperVocabularyAtTheta(-100, itemBank),
    fixture.paperLowerAsymptote,
    "Paper-score lower asymptote"
  );
  let previousPaperScore = Number.NEGATIVE_INFINITY;
  let previousDeguessedScore = Number.NEGATIVE_INFINITY;
  for (const scenario of fixture.vocabularyScenarios) {
    const paperScore = paperVocabularyAtTheta(scenario.theta, itemBank);
    const deguessedScore = deguessedVocabularyAtTheta(
      scenario.theta,
      itemBank
    );
    assertClose(
      paperScore,
      scenario.paperVocabulary,
      `Paper vocabulary at theta ${scenario.theta}`
    );
    assertClose(
      deguessedScore,
      scenario.deguessedVocabulary,
      `Deguessed vocabulary at theta ${scenario.theta}`
    );
    assert.ok(paperScore > previousPaperScore);
    assert.ok(deguessedScore > previousDeguessedScore);
    assert.ok(paperScore >= 0 && paperScore <= 8000);
    assert.ok(deguessedScore >= 0 && deguessedScore <= 8000);
    previousPaperScore = paperScore;
    previousDeguessedScore = deguessedScore;
  }
});

test("3PL probability and information include D=1.702", () => {
  for (const scenario of fixture.itemScenarios) {
    const item = itemBank[scenario.itemIndex];
    assert.ok(item);
    assertClose(
      paperProbability3pl(scenario.theta, item),
      scenario.probability,
      `Item ${scenario.itemIndex} probability`
    );
    assertClose(
      paperItemInformation3pl(scenario.theta, item),
      scenario.information,
      `Item ${scenario.itemIndex} information`
    );
  }
});

test("EAP posterior and transformed vocabulary uncertainty match base R", () => {
  for (const scenario of fixture.abilityScenarios) {
    const posterior = estimatePaperPosteriorEap(
      itemBank,
      scenario.administered,
      scenario.responses
    );
    const summary = summarizePaperVocabularyPosterior(itemBank, posterior);
    assertClose(posterior.theta, scenario.theta, `${scenario.name} theta`);
    assertClose(
      posterior.thetaStandardDeviation,
      scenario.thetaStandardDeviation,
      `${scenario.name} theta posterior standard deviation`
    );
    assertClose(
      posterior.weights.reduce((sum, weight) => sum + weight, 0),
      1,
      `${scenario.name} normalized posterior weights`
    );
    assert.equal(summary.scoreModelId, fixture.modelId);
    assert.equal(summary.credibleMass, 0.95);
    for (const field of [
      "posteriorMean",
      "posteriorStandardDeviation",
      "credibleIntervalLower",
      "credibleIntervalUpper",
      "plugInAtThetaMean",
    ] as const) {
      assertClose(
        summary[field],
        scenario.vocabulary[field],
        `${scenario.name} vocabulary ${field}`
      );
    }
    assert.ok(summary.credibleIntervalLower <= summary.posteriorMean);
    assert.ok(summary.posteriorMean <= summary.credibleIntervalUpper);
  }

  const mixedScenario = fixture.abilityScenarios.find(
    (scenario) => scenario.name === "mixed-eight"
  );
  assert.ok(mixedScenario);
  assert.ok(
    Math.abs(
      mixedScenario.vocabulary.posteriorMean -
        mixedScenario.vocabulary.plugInAtThetaMean
    ) > 1,
    "The fixture must detect the nonlinear plug-in error."
  );
});

test("maximum-information item selection matches base R", () => {
  for (const scenario of fixture.selectionScenarios) {
    assert.equal(
      selectNextPaperItem(
        itemBank,
        scenario.theta,
        scenario.administered,
        scenario.needHigh
      ),
      scenario.selected
    );
  }
  assert.equal(
    selectNextPaperItem(
      itemBank,
      0,
      itemBank.map((_, index) => index),
      false
    ),
    null
  );
});

test("invalid response and item-bank contracts fail explicitly", () => {
  assert.throws(
    () => estimatePaperPosteriorEap(itemBank, [0], []),
    RangeError
  );
  assert.throws(
    () => estimatePaperPosteriorEap(itemBank, [itemBank.length], [1]),
    RangeError
  );
  assert.throws(
    () => estimatePaperPosteriorEap(itemBank, [0, 0], [1, 1]),
    RangeError
  );
  assert.throws(() => computeLevelParameterMeans(itemBank.slice(1)), RangeError);
  assert.throws(
    () =>
      summarizePaperVocabularyPosterior(itemBank, {
        theta: 0,
        thetaStandardDeviation: 1,
        grid: [0, 1],
        weights: [0.2, 0.2],
      }),
    RangeError
  );
});
