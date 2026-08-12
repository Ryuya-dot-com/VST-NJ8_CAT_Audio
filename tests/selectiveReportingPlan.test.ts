import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  conservativeMonotoneAcceptanceEnvelope,
  exactBonferroniCentralRanks,
  validateSelectiveReportingPlan,
  type SelectiveReportingPlan,
} from "../src/utils/selectiveReportingPlan.ts";

const plan = JSON.parse(
  readFileSync(
    new URL(
      "../simulation/plans/selective-reporting-exploratory-v1.json",
      import.meta.url
    ),
    "utf8"
  )
) as SelectiveReportingPlan;

test("selective reporting plan freezes boundary evidence and exact ranks", () => {
  const ranks = validateSelectiveReportingPlan(plan);
  assert.equal(ranks.lowerRankOneBased, 40);
  assert.equal(ranks.upperRankOneBased, 2461);
  assert.equal(ranks.perEndpointAlpha, 0.05 / 54);
  assert.ok(
    Math.abs(ranks.achievedLowerTailProbability - 0.0008593981451653112) <
      1e-15
  );
  const supported = plan.evaluationCells.filter(
    ({ theta }) =>
      theta >= plan.informationSupportRange.lowerTheta &&
      theta <= plan.informationSupportRange.upperTheta
  );
  assert.equal(supported.length, 14);
  assert.equal(supported[0].generatedPaths, 100000);
  assert.equal(supported[supported.length - 1].generatedPaths, 100000);
});

test("conservative monotone envelope never narrows raw acceptance limits", () => {
  const rawLower = [-2, -1, -1.5, 0, 0.5];
  const rawUpper = [-0.5, 0.25, 0, 1, 0.75];
  const envelope = conservativeMonotoneAcceptanceEnvelope(
    rawLower,
    rawUpper
  );
  assert.deepEqual(envelope.lower, [-2, -1.5, -1.5, 0, 0.5]);
  assert.deepEqual(envelope.upper, [-0.5, 0.25, 0.25, 1, 1]);
  for (let index = 0; index < rawLower.length; index += 1) {
    assert.ok(envelope.lower[index] <= rawLower[index]);
    assert.ok(envelope.upper[index] >= rawUpper[index]);
    if (index > 0) {
      assert.ok(envelope.lower[index] >= envelope.lower[index - 1]);
      assert.ok(envelope.upper[index] >= envelope.upper[index - 1]);
    }
  }
});

test("selective plan rejects circular selection and missing boundary evidence", () => {
  assert.throws(
    () =>
      validateSelectiveReportingPlan({
        ...plan,
        selectionEvent: "interval-endpoints-inside-support" as never,
      }),
    /Invalid selective calibration contract|Invalid selective plan|selection/i
  );
  assert.throws(
    () =>
      validateSelectiveReportingPlan({
        ...plan,
        evaluationCells: plan.evaluationCells.slice(1),
      }),
    /Evaluation cells/
  );
  assert.throws(
    () =>
      exactBonferroniCentralRanks(1, 27, 0.95, 0.05),
    /too small/
  );
});
