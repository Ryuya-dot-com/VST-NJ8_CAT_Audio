import assert from "node:assert/strict";

export const FLOATING_POINT_TOLERANCE_IN_EPSILONS = 128;

function formatPath(parent: string, key: string): string {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key)
    ? `${parent}.${key}`
    : `${parent}[${JSON.stringify(key)}]`;
}

export function assertReproducibleReportEqual(
  actual: unknown,
  expected: unknown,
  path = "$"
): void {
  if (Object.is(actual, expected)) return;

  if (typeof actual === "number" && typeof expected === "number") {
    if (
      !Number.isFinite(actual) ||
      !Number.isFinite(expected) ||
      Number.isInteger(actual) ||
      Number.isInteger(expected)
    ) {
      assert.fail(`${path}: expected exact numeric equality (${actual} !== ${expected})`);
    }
    const scale = Math.max(1, Math.abs(actual), Math.abs(expected));
    const tolerance =
      FLOATING_POINT_TOLERANCE_IN_EPSILONS * Number.EPSILON * scale;
    const difference = Math.abs(actual - expected);
    assert.ok(
      difference <= tolerance,
      `${path}: floating-point difference ${difference} exceeds ${tolerance}`
    );
    return;
  }

  assert.equal(typeof actual, typeof expected, `${path}: value types differ`);

  if (Array.isArray(actual) || Array.isArray(expected)) {
    assert.ok(
      Array.isArray(actual) && Array.isArray(expected),
      `${path}: array shape differs`
    );
    assert.equal(actual.length, expected.length, `${path}: array length differs`);
    for (let index = 0; index < actual.length; index += 1) {
      assertReproducibleReportEqual(actual[index], expected[index], `${path}[${index}]`);
    }
    return;
  }

  if (actual !== null && expected !== null && typeof actual === "object") {
    const actualRecord = actual as Record<string, unknown>;
    const expectedRecord = expected as Record<string, unknown>;
    const actualKeys = Object.keys(actualRecord).sort();
    const expectedKeys = Object.keys(expectedRecord).sort();
    assert.deepEqual(actualKeys, expectedKeys, `${path}: object keys differ`);
    for (const key of actualKeys) {
      assertReproducibleReportEqual(
        actualRecord[key],
        expectedRecord[key],
        formatPath(path, key)
      );
    }
    return;
  }

  assert.deepEqual(actual, expected, `${path}: values differ`);
}
