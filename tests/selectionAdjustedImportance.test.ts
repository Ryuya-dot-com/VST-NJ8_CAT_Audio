import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  defensiveMixtureWeight,
  empiricalBernsteinBoundedMean,
  validateSelectionAdjustedImportancePlan,
  type SelectionAdjustedImportancePlan,
} from "../src/utils/selectionAdjustedImportance.ts";

const plan = JSON.parse(
  readFileSync(
    new URL(
      "../simulation/plans/selection-adjusted-importance-validation-v1.json",
      import.meta.url
    ),
    "utf8"
  )
) as SelectionAdjustedImportancePlan;

test("importance validation freezes defensive mixtures and independent seeds", () => {
  assert.doesNotThrow(() => validateSelectionAdjustedImportancePlan(plan));
  assert.notEqual(plan.mixtureSeed, plan.directSeed);
  assert.equal(
    1 / plan.defensiveTargetWeight,
    5,
    "defensive mixture must analytically bound every raw weight"
  );
});

test("defensive path weights are exact and bounded", () => {
  assert.equal(defensiveMixtureWeight(0, 0, 0.2), 1);
  assert.ok(Math.abs(defensiveMixtureWeight(0, Math.log(4), 0.2) - 1 / 3.4) < 1e-15);
  assert.ok(defensiveMixtureWeight(10, -10, 0.2) < 5);
  assert.throws(
    () => defensiveMixtureWeight(0, 0, 0),
    /Invalid defensive-mixture/
  );
});

test("empirical Bernstein intervals use observable variance and bounded support", () => {
  const bound = empiricalBernsteinBoundedMean([0, 1, 0, 1], 1, 0.05);
  const expectedVariance = 1 / 3;
  const expectedHalfWidth =
    Math.sqrt((2 * expectedVariance * Math.log(40)) / 4) +
    (7 * Math.log(40)) / 9;
  assert.equal(bound.estimate, 0.5);
  assert.ok(Math.abs(bound.empiricalBernsteinHalfWidth - expectedHalfWidth) < 1e-15);
  assert.equal(bound.lower, 0);
  assert.equal(bound.upper, 1);
});

test("importance validation rejects post-hoc proposal movement", () => {
  const changed = structuredClone(plan);
  changed.experiments[0].auxiliaryTheta += 0.01;
  assert.throws(
    () => validateSelectionAdjustedImportancePlan(changed),
    /incomplete or reordered/
  );
});
