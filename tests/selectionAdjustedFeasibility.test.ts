import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  oneSidedWilsonLower,
  validateSelectionAdjustedFeasibilityPlan,
  type SelectionAdjustedFeasibilityPlan,
} from "../src/utils/selectionAdjustedFeasibility.ts";

const plan = JSON.parse(
  readFileSync(
    new URL(
      "../simulation/plans/selection-adjusted-feasibility-v1.json",
      import.meta.url
    ),
    "utf8"
  )
) as SelectionAdjustedFeasibilityPlan;

test("selection-adjusted feasibility freezes nested cores and estimation domains", () => {
  assert.doesNotThrow(() => validateSelectionAdjustedFeasibilityPlan(plan));
  for (let index = 1; index < plan.operationalCandidates.length; index += 1) {
    const wider = plan.operationalCandidates[index - 1];
    const narrower = plan.operationalCandidates[index];
    assert.ok(narrower.selectionCore.lowerTheta > wider.selectionCore.lowerTheta);
    assert.ok(narrower.selectionCore.upperTheta < wider.selectionCore.upperTheta);
    assert.ok(
      narrower.estimationDomain.lowerTheta > wider.estimationDomain.lowerTheta
    );
    assert.ok(
      narrower.estimationDomain.upperTheta < wider.estimationDomain.upperTheta
    );
  }
});

test("selection-rate planning uses the frozen one-sided Wilson lower bound", () => {
  assert.equal(oneSidedWilsonLower(0, 10000, plan.calibrationPlanning.z), 0);
  assert.ok(
    Math.abs(
      oneSidedWilsonLower(500, 10000, plan.calibrationPlanning.z) -
        0.04728006976282915
    ) < 1e-15
  );
  assert.throws(
    () => oneSidedWilsonLower(10001, 10000, plan.calibrationPlanning.z),
    /Invalid Wilson/
  );
});

test("feasibility validation rejects post-hoc core reordering", () => {
  const changed = structuredClone(plan);
  changed.operationalCandidates.reverse();
  assert.throws(
    () => validateSelectionAdjustedFeasibilityPlan(changed),
    /incomplete or reordered/
  );
});
