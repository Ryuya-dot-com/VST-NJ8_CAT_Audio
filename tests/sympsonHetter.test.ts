import assert from "node:assert/strict";
import test from "node:test";

import {
  sympsonHetterAccepts,
  updateSympsonHetterParameters,
} from "../src/utils/sympsonHetter.ts";

test("Sympson-Hetter parameters implement min(1, r_max / P(S_i))", () => {
  const update = updateSympsonHetterParameters(
    new Uint32Array([0, 25, 50, 100]),
    100,
    0.25
  );
  assert.deepEqual(update.selectionRates, [0, 0.25, 0.5, 1]);
  assert.deepEqual(update.administrationParameters, [1, 1, 0.5, 0.25]);
});

test("the exposure probability experiment has explicit closed boundaries", () => {
  assert.equal(sympsonHetterAccepts(0.25, 0), true);
  assert.equal(sympsonHetterAccepts(0.25, 0.25), true);
  assert.equal(sympsonHetterAccepts(0.25, 0.2500001), false);
  assert.equal(sympsonHetterAccepts(1, 0.999999), true);
  assert.throws(
    () => sympsonHetterAccepts(1.1, 0.5),
    /parameters must be in/
  );
});

test("calibration rejects rates that cannot represent per-examinee events", () => {
  assert.throws(
    () => updateSympsonHetterParameters([101], 100, 0.25),
    /between zero and examinee count/
  );
  assert.throws(
    () => updateSympsonHetterParameters([1], 100, 0),
    /must be in/
  );
});
