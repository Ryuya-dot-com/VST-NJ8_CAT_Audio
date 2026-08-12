import assert from "node:assert/strict";
import test from "node:test";

import {
  CAT_SCORE_REPORTING_METHOD,
  PUBLIC_CAT_SCORE_RESULT_FIELDS,
  assertResultFieldsAllowed,
  buildPublicCatScoreResult,
} from "../src/utils/scoreReportingPolicy.ts";

const validInput = {
  testLabel: "筆記版",
  userName: "test user",
  startedAt: "2026/8/12 10:00:00",
  endedAt: "2026/8/12 10:10:00",
  administeredItems: 30,
  correctAnswers: 21,
  accuracyPercent: 70,
  thetaEap: 0.42,
  thetaPosteriorStandardDeviation: 0.31,
  estimatedVocabularySize: 4210.25,
  vocabularyPosteriorStandardDeviation: 612.5,
  vocabularyIntervalLower: 3025.4,
  vocabularyIntervalUpper: 5388.8,
};

test("CAT score reporting method fixes the paper-model transformation contract", () => {
  assert.equal(CAT_SCORE_REPORTING_METHOD.methodId, "paper-3pl-cat-eap-v1");
  assert.equal(CAT_SCORE_REPORTING_METHOD.scoreModelId, "paper-3pl-v1");
  assert.equal(CAT_SCORE_REPORTING_METHOD.abilityEstimator, "EAP");
  assert.equal(CAT_SCORE_REPORTING_METHOD.administeredItemCount, 30);
  assert.equal(Object.isFrozen(CAT_SCORE_REPORTING_METHOD), true);
});

test("public result includes the estimated vocabulary scale, interval, and theta", () => {
  const record = buildPublicCatScoreResult(validInput);

  assert.equal(record["推定語彙サイズ（VST-NJ8原論文換算）"], 4210.25);
  assert.equal(record["推定語彙サイズ95%区間下限"], 3025.4);
  assert.equal(record["推定語彙サイズ95%区間上限"], 5388.8);
  assert.equal(record["能力値θ（EAP）"], 0.42);
  assert.equal(record.実施項目数, 30);
  assertResultFieldsAllowed([record], PUBLIC_CAT_SCORE_RESULT_FIELDS);
});

test("score export rejects non-finite values and reversed intervals", () => {
  assert.throws(
    () => buildPublicCatScoreResult({ ...validInput, thetaEap: Number.NaN }),
    /must be finite/
  );
  assert.throws(
    () =>
      buildPublicCatScoreResult({
        ...validInput,
        vocabularyIntervalLower: 6000,
        vocabularyIntervalUpper: 5000,
      }),
    /must not exceed/
  );
});

test("result export allowlist rejects unknown fields and malformed contracts", () => {
  assert.throws(
    () => assertResultFieldsAllowed([{ 未審査列: 1 }], ["実施項目数"]),
    /not explicitly allowed/
  );
  assert.throws(() => assertResultFieldsAllowed([], []), /non-empty and unique/);
  assert.throws(
    () => assertResultFieldsAllowed([], ["field", "field"]),
    /non-empty and unique/
  );
});
