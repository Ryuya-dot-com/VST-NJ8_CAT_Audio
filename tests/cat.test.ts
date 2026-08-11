import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

import type { Item } from "../src/types.ts";
import {
  estimateAbilityEap,
  itemInfo3pl,
  prob3pl,
  selectNextItem,
  vocabFromTheta,
} from "../src/utils/cat.ts";
import {
  LEGACY_CAT_CONFIG,
  shouldContinueTest,
} from "../src/utils/catConfig.ts";

interface Fixture {
  modelId: string;
  numericalTolerance: number;
  itemBank: { path: string; sha256: string; itemCount: number };
  config: Record<string, unknown>;
  abilityScenarios: Array<{
    name: string;
    administered: number[];
    responses: Array<0 | 1>;
    theta: number;
    standardDeviation: number;
  }>;
  vocabularyScenarios: Array<{ theta: number; vocabularySize: number }>;
  selectionScenarios: Array<{
    theta: number;
    administered: number[];
    needHigh: boolean;
    selected: number;
  }>;
  itemScenarios: Array<{
    itemIndex: number;
    theta: number;
    probability: number;
    information: number;
  }>;
  stoppingScenarios: Array<{
    name: string;
    posteriorStandardDeviation: number;
    administeredItems: number;
    highLevelItems: number;
    shouldContinue: boolean;
  }>;
}

interface ParityManifest {
  contractId: string;
  artifacts: Record<string, string>;
}

const fixture = JSON.parse(
  readFileSync(
    new URL("./fixtures/legacy-cat-v0.json", import.meta.url),
    "utf8"
  )
) as Fixture;
const parityManifest = JSON.parse(
  readFileSync(
    new URL("./fixtures/repository-parity.json", import.meta.url),
    "utf8"
  )
) as ParityManifest;
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
  assert.ok(
    difference <= fixture.numericalTolerance,
    `${label}: expected ${expected}, received ${actual}, difference ${difference}`
  );
}

test("the item-bank artifact and legacy configuration are immutable contracts", () => {
  const checksum = createHash("sha256").update(itemBankBytes).digest("hex");
  assert.equal(checksum, fixture.itemBank.sha256);
  assert.equal(itemBank.length, fixture.itemBank.itemCount);
  assert.equal(LEGACY_CAT_CONFIG.scoreModelId, fixture.modelId);
  assert.deepEqual(LEGACY_CAT_CONFIG, fixture.config);
});

test("shared scoring artifacts satisfy the dual-repository parity manifest", () => {
  assert.equal(
    parityManifest.contractId,
    "legacy-cat-v0-dual-repository-parity"
  );
  for (const [path, expectedChecksum] of Object.entries(
    parityManifest.artifacts
  )) {
    const artifact = readFileSync(new URL(`../${path}`, import.meta.url));
    const checksum = createHash("sha256").update(artifact).digest("hex");
    assert.equal(checksum, expectedChecksum, path);
  }
});

test("EAP estimates reproduce the legacy numerical fixtures", () => {
  for (const scenario of fixture.abilityScenarios) {
    const estimate = estimateAbilityEap(
      itemBank,
      scenario.administered,
      scenario.responses
    );
    assertClose(estimate.theta, scenario.theta, `${scenario.name} theta`);
    assertClose(
      estimate.se,
      scenario.standardDeviation,
      `${scenario.name} posterior standard deviation`
    );
  }
});

test("the theta-to-vocabulary transform reproduces the legacy fixtures", () => {
  for (const scenario of fixture.vocabularyScenarios) {
    assertClose(
      vocabFromTheta(scenario.theta),
      scenario.vocabularySize,
      `vocabulary size at theta ${scenario.theta}`
    );
  }
});

test("item probability, information, and selection reproduce legacy fixtures", () => {
  for (const scenario of fixture.itemScenarios) {
    const item = itemBank[scenario.itemIndex];
    assert.ok(item);
    assertClose(
      prob3pl(
        scenario.theta,
        item.Dscrimination,
        item.Difficulty,
        item.Guessing
      ),
      scenario.probability,
      `item ${scenario.itemIndex} probability`
    );
    assertClose(
      itemInfo3pl(scenario.theta, item),
      scenario.information,
      `item ${scenario.itemIndex} information`
    );
  }

  for (const scenario of fixture.selectionScenarios) {
    assert.equal(
      selectNextItem(
        itemBank,
        scenario.theta,
        scenario.administered,
        scenario.needHigh
      ),
      scenario.selected
    );
  }
});

test("stopping boundaries reproduce the legacy rule", () => {
  for (const scenario of fixture.stoppingScenarios) {
    assert.equal(
      shouldContinueTest({
        posteriorStandardDeviation: scenario.posteriorStandardDeviation,
        administeredItems: scenario.administeredItems,
        highLevelItems: scenario.highLevelItems,
      }),
      scenario.shouldContinue,
      scenario.name
    );
  }
});
