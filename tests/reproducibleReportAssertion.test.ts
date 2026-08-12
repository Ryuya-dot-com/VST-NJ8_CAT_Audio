import assert from "node:assert/strict";
import test from "node:test";

import {
  assertReproducibleReportEqual,
  FLOATING_POINT_ABSOLUTE_TOLERANCE,
  FLOATING_POINT_RELATIVE_TOLERANCE,
  REPRODUCIBLE_REPORT_COMPARISON_CONTRACT_ID,
} from "../scripts/assert-reproducible-report.ts";

test("report comparison applies the declared cross-platform numerical contract", () => {
  assert.equal(
    REPRODUCIBLE_REPORT_COMPARISON_CONTRACT_ID,
    "simulation-report-cross-platform-v1"
  );
  const expected = { metric: 0.016687198058281897, trials: 500 };
  const withinTolerance = { metric: 0.016687198058281894, trials: 500 };
  assert.doesNotThrow(() =>
    assertReproducibleReportEqual(withinTolerance, expected)
  );

  const tolerance =
    FLOATING_POINT_ABSOLUTE_TOLERANCE +
    FLOATING_POINT_RELATIVE_TOLERANCE * Math.abs(expected.metric);
  assert.throws(() =>
    assertReproducibleReportEqual(
      { metric: expected.metric + tolerance * 2, trials: 500 },
      expected
    )
  );

  assert.doesNotThrow(() =>
    assertReproducibleReportEqual(
      { vocabularyBias: 31.9 + 9.1e-13 },
      { vocabularyBias: 31.9 }
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
