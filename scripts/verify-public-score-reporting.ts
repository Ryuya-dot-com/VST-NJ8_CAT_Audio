import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  PUBLIC_SCORE_REPORTING_POLICY,
  assertPublicResultFieldsAllowed,
  assertPublicResultContainsNoLatentScores,
  buildPublicObservedResult,
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

assert.equal(PUBLIC_SCORE_REPORTING_POLICY.allowsTheta, false);
assert.equal(PUBLIC_SCORE_REPORTING_POLICY.allowsStandardError, false);
assert.equal(PUBLIC_SCORE_REPORTING_POLICY.allowsVocabularyScale, false);
assert.equal(PUBLIC_SCORE_REPORTING_POLICY.allowsRangeClassification, false);

for (const forbiddenAppPattern of [
  /\bvocabFromTheta\b/u,
  /const \[theta, setTheta\]/u,
  /const \[se, setSe\]/u,
  /theta:\s*estimate\.theta/u,
  /se:\s*estimate\.se/u,
  /["']能力値θ["']\s*:/u,
  /\b標準誤差\s*:/u,
  /\b推定語彙サイズ\s*:/u,
]) {
  assert.doesNotMatch(appSource, forbiddenAppPattern);
}
assert.match(appSource, /buildPublicObservedResult/u);
assert.match(appSource, /assertPublicResultFieldsAllowed/u);
assert.match(appSource, /PUBLIC_SUMMARY_FIELDS/u);
assert.match(appSource, /PUBLIC_RESPONSE_FIELDS/u);

for (const forbiddenResultsPattern of [
  /\btheta\s*:\s*number/u,
  /\bse\s*:\s*number/u,
  /\bvocabSize\b/u,
  />推定語彙サイズ</u,
  />能力値 θ</u,
]) {
  assert.doesNotMatch(resultsSource, forbiddenResultsPattern);
}
assert.match(resultsSource, /PUBLIC_SCORE_REPORTING_POLICY/u);
assert.doesNotMatch(landingSource, /語彙サイズを推定/u);
assert.match(landingSource, /適応的に出題/u);

const publicRecord = buildPublicObservedResult({
  testLabel: "verification",
  userName: "",
  startedAt: "",
  endedAt: "",
  administeredItems: 1,
  correctAnswers: 1,
  accuracyPercent: 100,
});
assertPublicResultContainsNoLatentScores([publicRecord]);
assertPublicResultFieldsAllowed([publicRecord], Object.keys(publicRecord));

console.log(
  `Public score reporting verifier passed (${PUBLIC_SCORE_REPORTING_POLICY.policyId}).`
);
