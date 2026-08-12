import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import { RESEARCH_ADMINISTRATION_POLICY } from "../src/utils/researchAdministrationPolicy.ts";
import { identifyItemBank } from "./item-bank-identity.ts";

const appSource = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
const planBytes = readFileSync(
  new URL("../simulation/plans/confirmation-v1.json", import.meta.url)
);
const reportBytes = readFileSync(
  new URL("../simulation/results/confirmation-v1.json", import.meta.url)
);
const evaluationBytes = readFileSync(
  new URL("../simulation/results/confirmation-v1-evaluation.json", import.meta.url)
);
const plan = JSON.parse(planBytes.toString("utf8")) as {
  rules: Array<Record<string, unknown>>;
  initialLevelMinimum: number;
  initialLevelMaximum: number;
  highLevelFloor: number;
  minimumHighLevelItems: number;
};
const evaluation = JSON.parse(evaluationBytes.toString("utf8")) as {
  planSha256: string;
  reportSha256: string;
  candidatesPassingAllGates: string[];
  rules: Array<{
    ruleId: string;
    passesAll: boolean;
    failedGates: string[];
  }>;
};
const bankBytes = readFileSync(new URL("../public/jacet_parameters.csv", import.meta.url));
const policy = RESEARCH_ADMINISTRATION_POLICY;
const evidenceRule = plan.rules.find(({ id }) => id === "fixed30-randomesque5");
const evidenceEvaluation = evaluation.rules.find(
  ({ ruleId }) => ruleId === "fixed30-randomesque5"
);

assert.equal(policy.validationStatus, "research-baseline-not-score-valid");
assert.equal(policy.precisionStoppingEnabled, false);
assert.equal(
  createHash("sha256").update(planBytes).digest("hex"),
  policy.evidencePlanSha256
);
assert.equal(
  createHash("sha256").update(reportBytes).digest("hex"),
  policy.evidenceReportSha256
);
assert.equal(
  createHash("sha256").update(evaluationBytes).digest("hex"),
  policy.evidenceEvaluationSha256
);
assert.equal(evaluation.planSha256, policy.evidencePlanSha256);
assert.equal(evaluation.reportSha256, policy.evidenceReportSha256);
assert.deepEqual(evaluation.candidatesPassingAllGates, []);
assert.equal(evidenceEvaluation?.passesAll, false);
for (const failedScoreGate of [
  "conditionalBias",
  "conditionalRmse",
  "intervalCoverage",
]) {
  assert.ok(evidenceEvaluation?.failedGates.includes(failedScoreGate));
}

assert.deepEqual(evidenceRule, {
  id: "fixed30-randomesque5",
  minimumItems: policy.fixedLength,
  maximumItems: policy.fixedLength,
  targetPosteriorStandardDeviation: null,
  selectionMethod: policy.selectionMethod,
  randomesqueSize: policy.randomesqueSize,
});
assert.equal(plan.initialLevelMinimum, policy.initialLevelMinimum);
assert.equal(plan.initialLevelMaximum, policy.initialLevelMaximum);
assert.equal(plan.highLevelFloor, policy.highLevelFloor);
assert.equal(plan.minimumHighLevelItems, policy.minimumHighLevelItems);
const bankIdentity = identifyItemBank(bankBytes);
assert.equal(bankIdentity.logicalSchemaVersion, policy.itemBankLogicalSchemaVersion);
assert.equal(bankIdentity.logicalSha256, policy.itemBankLogicalSha256);
assert.equal(bankIdentity.artifactSha256, policy.itemBankArtifactSha256);

for (const requiredPattern of [
  /RESEARCH_ADMINISTRATION_POLICY/u,
  /estimatePaperPosteriorEap/u,
  /selectInitialResearchItem/u,
  /selectNextResearchItem/u,
  /shouldContinueResearchAdministration/u,
  /buildResearchAdministrationAudit/u,
]) {
  assert.match(appSource, requiredPattern);
}
for (const forbiddenPattern of [
  /estimateAbilityEap/u,
  /selectNextItem/u,
  /LEGACY_CAT_CONFIG/u,
  /shouldContinueTest/u,
  /needsHighLevelItems/u,
]) {
  assert.doesNotMatch(appSource, forbiddenPattern);
}

console.log(`Research administration verified (${policy.policyId}).`);
