import assert from "node:assert/strict";
import test from "node:test";

import {
  PUBLIC_SCORE_REPORTING_POLICY,
  assertPublicResultFieldsAllowed,
  assertPublicResultContainsNoLatentScores,
  buildPublicObservedResult,
} from "../src/utils/scoreReportingPolicy.ts";

test("public latent-score reporting is closed by an immutable default-deny policy", () => {
  assert.equal(
    PUBLIC_SCORE_REPORTING_POLICY.policyId,
    "latent-score-reporting-default-deny-v1"
  );
  assert.equal(PUBLIC_SCORE_REPORTING_POLICY.allowsTheta, false);
  assert.equal(PUBLIC_SCORE_REPORTING_POLICY.allowsStandardError, false);
  assert.equal(PUBLIC_SCORE_REPORTING_POLICY.allowsVocabularyScale, false);
  assert.equal(PUBLIC_SCORE_REPORTING_POLICY.allowsRangeClassification, false);
  assert.equal(Object.isFrozen(PUBLIC_SCORE_REPORTING_POLICY), true);
  assert.equal(Object.isFrozen(PUBLIC_SCORE_REPORTING_POLICY.evidenceRequirements), true);
});

test("public result contains observed response summaries and no latent-score fields", () => {
  const record = buildPublicObservedResult({
    testLabel: "音声版",
    userName: "test user",
    startedAt: "2026/8/12 10:00:00",
    endedAt: "2026/8/12 10:10:00",
    administeredItems: 20,
    correctAnswers: 14,
    accuracyPercent: 70,
  });

  assert.deepEqual(
    [record.実施項目数, record.実施項目の正答数, record["実施項目の正答率（%）"]],
    [20, 14, 70]
  );
  assert.equal(record.数値得点報告, "保留（妥当化未完了）");
  assertPublicResultContainsNoLatentScores([record]);
});

test("public export guard rejects latent-score field names", () => {
  for (const forbiddenField of [
    "能力値θ",
    "標準誤差",
    "推定語彙サイズ",
    "8000語尺度",
    "theta",
    "vocabularyScore",
    "latentScore",
    "standardError",
  ]) {
    assert.throws(
      () => assertPublicResultContainsNoLatentScores([{ [forbiddenField]: 1 }]),
      /latent-score-reporting-default-deny-v1/
    );
  }
});

test("public export allowlist rejects unreviewed aliases and malformed contracts", () => {
  assert.throws(
    () => assertPublicResultFieldsAllowed([{ スコア: 1 }], ["実施項目数"]),
    /not explicitly allowed/
  );
  assert.throws(() => assertPublicResultFieldsAllowed([], []), /non-empty and unique/);
  assert.throws(
    () => assertPublicResultFieldsAllowed([], ["field", "field"]),
    /non-empty and unique/
  );
});
