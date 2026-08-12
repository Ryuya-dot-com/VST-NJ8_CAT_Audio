import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  CAT_SCORE_REPORTING_METHOD,
  PUBLIC_CAT_SCORE_RESULT_FIELDS,
  assertResultFieldsAllowed,
  buildPublicCatScoreResult,
} from "../src/utils/scoreReportingPolicy.ts";

const appSource = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
const resultsSource = readFileSync(
  new URL("../src/components/ResultsView.tsx", import.meta.url),
  "utf8"
);
const landingSource = readFileSync(
  new URL("../src/components/LandingView.tsx", import.meta.url),
  "utf8"
);

assert.equal(CAT_SCORE_REPORTING_METHOD.scoreModelId, "paper-3pl-v1");
assert.equal(CAT_SCORE_REPORTING_METHOD.abilityEstimator, "EAP");
assert.equal(CAT_SCORE_REPORTING_METHOD.administeredItemCount, 30);

for (const requiredAppPattern of [
  /estimatePaperPosteriorEap/u,
  /summarizePaperVocabularyPosterior/u,
  /buildPublicCatScoreResult/u,
  /PUBLIC_SUMMARY_FIELDS/u,
  /PUBLIC_RESPONSE_FIELDS/u,
]) {
  assert.match(appSource, requiredAppPattern);
}

for (const requiredResultPattern of [
  /推定語彙サイズ/u,
  /能力値/u,
  /95%推定範囲/u,
  /VST-NJ8原論文の式/u,
]) {
  assert.match(resultsSource, requiredResultPattern);
}

for (const internalPresentationPattern of [
  /妥当化未完了/u,
  /報告手続/u,
  /ポリシー:/u,
  /数値得点の報告を保留/u,
  /研究用の固定規則/u,
]) {
  assert.doesNotMatch(resultsSource, internalPresentationPattern);
  assert.doesNotMatch(landingSource, internalPresentationPattern);
}

const publicRecord = buildPublicCatScoreResult({
  testLabel: "verification",
  userName: "",
  startedAt: "",
  endedAt: "",
  administeredItems: 30,
  correctAnswers: 20,
  accuracyPercent: 66.7,
  thetaEap: 0.25,
  thetaPosteriorStandardDeviation: 0.32,
  estimatedVocabularySize: 4000,
  vocabularyPosteriorStandardDeviation: 600,
  vocabularyIntervalLower: 2800,
  vocabularyIntervalUpper: 5200,
});
assertResultFieldsAllowed([publicRecord], PUBLIC_CAT_SCORE_RESULT_FIELDS);

console.log(
  `Public CAT score reporting verifier passed (${CAT_SCORE_REPORTING_METHOD.methodId}).`
);
