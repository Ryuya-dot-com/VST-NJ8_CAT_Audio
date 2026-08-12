import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

import type { Item } from "../src/types.ts";
import {
  estimatePaperPosteriorEap,
  paperItemInformation3pl,
} from "../src/utils/paperScoring.ts";
import {
  RESEARCH_ADMINISTRATION_AUDIT_FIELDS,
  RESEARCH_ADMINISTRATION_POLICY,
  buildResearchAdministrationAudit,
  createResearchAdministrationRandom,
  selectInitialResearchItem,
  selectNextResearchItem,
  shouldContinueResearchAdministration,
} from "../src/utils/researchAdministrationPolicy.ts";

const itemBankBytes = readFileSync(
  new URL("../public/jacet_parameters.csv", import.meta.url)
);
const itemBank: Item[] = itemBankBytes.toString("utf8")
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

test("research administration is fixed-length and explicitly not score-valid", () => {
  const policy = RESEARCH_ADMINISTRATION_POLICY;
  assert.equal(policy.policyId, "research-fixed30-randomesque5-paper3pl-v1");
  assert.equal(policy.validationStatus, "research-baseline-not-score-valid");
  assert.equal(policy.evidenceBasis, "confirmation-v1/fixed30-randomesque5");
  assert.equal(policy.evidencePlanSha256, "1aab9c60dd0c5036342caeec19c0e9f3d2e653d5d494cf73de42ce3bac7af60a");
  assert.equal(policy.evidenceReportSha256, "5af908caffebccd9d295133277d95a01a56085a7e9e1c55b0ef0d2ae5c785752");
  assert.equal(policy.evidenceEvaluationSha256, "d0c20daa6b7a678162e20c11d292695241722ef0b97a0109ef16e49a076d566c");
  assert.equal(policy.scoreModelId, "paper-3pl-v1");
  assert.equal(
    createHash("sha256").update(itemBankBytes).digest("hex"),
    policy.itemBankSha256
  );
  assert.equal(policy.fixedLength, 30);
  assert.equal(policy.randomesqueSize, 5);
  assert.equal(policy.precisionStoppingEnabled, false);
  assert.equal(Object.isFrozen(policy), true);
  assert.equal(shouldContinueResearchAdministration(29), true);
  assert.equal(shouldContinueResearchAdministration(30), false);
  assert.equal(shouldContinueResearchAdministration(31), false);
});

test("seeded fixed-30 administration is reproducible and satisfies the high-level constraint", () => {
  function run(seed: number): number[] {
    const random = createResearchAdministrationRandom(seed);
    const administered = [selectInitialResearchItem(itemBank, random)];
    const responses: Array<0 | 1> = [1];
    while (shouldContinueResearchAdministration(administered.length)) {
      const posterior = estimatePaperPosteriorEap(
        itemBank,
        administered,
        responses
      );
      const next = selectNextResearchItem(
        itemBank,
        posterior.theta,
        administered,
        random
      );
      assert.notEqual(next, null);
      administered.push(next as number);
      responses.push(administered.length % 2 === 0 ? 0 : 1);
    }
    return administered;
  }

  const first = run(20260812);
  const second = run(20260812);
  assert.deepEqual(second, first);
  assert.deepEqual(first, [
    87, 124, 146, 112, 88, 154, 78, 101, 90, 105,
    72, 109, 62, 64, 70, 66, 73, 52, 53, 50,
    68, 91, 67, 77, 85, 51, 57, 118, 71, 45,
  ]);
  assert.equal(first.length, 30);
  assert.equal(new Set(first).size, 30);
  assert.ok(
    first.filter(
      (index) => itemBank[index].Level >= RESEARCH_ADMINISTRATION_POLICY.highLevelFloor
    ).length >= RESEARCH_ADMINISTRATION_POLICY.minimumHighLevelItems
  );
});

test("randomesque selection uses only the top five paper-3PL information items", () => {
  const administered = [80, 120, 121];
  const theta = 0.25;
  const expectedTopFive = itemBank
    .map((_, index) => index)
    .filter((index) => !administered.includes(index))
    .map((index) => ({
      index,
      information: paperItemInformation3pl(theta, itemBank[index]),
    }))
    .sort(
      (left, right) =>
        right.information - left.information || left.index - right.index
    )
    .slice(0, RESEARCH_ADMINISTRATION_POLICY.randomesqueSize)
    .map(({ index }) => index);

  for (const [randomValue, expectedPosition] of [
    [0, 0],
    [0.199999999, 0],
    [0.2, 1],
    [0.999999999, 4],
  ] as const) {
    assert.equal(
      selectNextResearchItem(itemBank, theta, administered, () => randomValue),
      expectedTopFive[expectedPosition]
    );
  }
});

test("administration audit is complete and rejects invalid contracts", () => {
  const audit = buildResearchAdministrationAudit(123, "fixed-length");
  assert.deepEqual(Object.keys(audit), [...RESEARCH_ADMINISTRATION_AUDIT_FIELDS]);
  assert.equal(audit.項目選択seed, 123);
  assert.equal(audit.停止理由, "fixed-length");
  assert.equal(audit.内部推定法ID, "eap-normal-0-1");
  assert.equal(
    audit["確認判定SHA-256"],
    RESEARCH_ADMINISTRATION_POLICY.evidenceEvaluationSha256
  );
  assert.throws(() => createResearchAdministrationRandom(-1), RangeError);
  assert.throws(() => shouldContinueResearchAdministration(1.5), RangeError);
  assert.throws(
    () => selectNextResearchItem(itemBank, 0, [0, 0], () => 0),
    RangeError
  );
  assert.throws(
    () => selectNextResearchItem(itemBank, 0, [], () => 1),
    /\[0, 1\)/
  );
});
