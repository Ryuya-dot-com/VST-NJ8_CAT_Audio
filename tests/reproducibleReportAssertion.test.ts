import assert from "node:assert/strict";
import test from "node:test";

import {
  assertReproducibleReportEqual,
  FLOATING_POINT_TOLERANCE_IN_EPSILONS,
} from "../scripts/assert-reproducible-report.ts";

test("report comparison admits only machine-scale floating-point drift", () => {
  const expected = { metric: 0.016687198058281897, trials: 500 };
  const withinTolerance = { metric: 0.016687198058281894, trials: 500 };
  assert.doesNotThrow(() =>
    assertReproducibleReportEqual(withinTolerance, expected)
  );

  const tolerance =
    FLOATING_POINT_TOLERANCE_IN_EPSILONS * Number.EPSILON;
  assert.throws(() =>
    assertReproducibleReportEqual(
      { metric: expected.metric + tolerance * 2, trials: 500 },
      expected
    )
  );
});

test("report comparison keeps integers, structure, and non-numbers exact", () => {
  assert.throws(() =>
    assertReproducibleReportEqual({ trials: 501 }, { trials: 500 })
  );
  assert.throws(() =>
    assertReproducibleReportEqual({ status: "pass" }, { status: "fail" })
  );
  assert.throws(() =>
    assertReproducibleReportEqual({ values: [1, 2] }, { values: [1] })
  );
  assert.throws(() =>
    assertReproducibleReportEqual({ metric: 1 }, { metric: 1, extra: true })
  );
});
