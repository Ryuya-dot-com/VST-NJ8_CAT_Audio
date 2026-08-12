import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  ITEM_BANK_LOGICAL_SCHEMA_VERSION,
  identifyItemBank,
} from "../scripts/item-bank-identity.ts";

const bankBytes = readFileSync(
  new URL("../public/jacet_parameters.csv", import.meta.url)
);

test("item-bank identity separates logical content from artifact bytes", () => {
  const identity = identifyItemBank(bankBytes);
  assert.deepEqual(identity, {
    logicalSchemaVersion: "vst-nj8-item-bank-logical-v1",
    logicalSha256: "d94031e23515d7ed4a4d7db01d6202027874d3c9c9140cc75df93d6f58ec04f4",
    artifactSha256: "ed058c8b87ef951c70512f89ac2ba708f18db983dd5b449b201e9b2dc97d0d47",
  });
  assert.equal(identity.logicalSchemaVersion, ITEM_BANK_LOGICAL_SCHEMA_VERSION);
});

test("logical identity ignores BOM, line endings, and equivalent numeric spelling", () => {
  const original = identifyItemBank(bankBytes);
  const normalized = Buffer.from(
    bankBytes
      .toString("utf8")
      .replace(/^\uFEFF/u, "")
      .replace(/\r\n?/gu, "\n")
      .replace("1.981565266", "1.9815652660"),
    "utf8"
  );
  const normalizedIdentity = identifyItemBank(normalized);
  assert.equal(normalizedIdentity.logicalSha256, original.logicalSha256);
  assert.notEqual(normalizedIdentity.artifactSha256, original.artifactSha256);
});

test("logical identity changes when an item parameter changes", () => {
  const changed = Buffer.from(
    bankBytes.toString("utf8").replace("1.981565266", "1.981565267"),
    "utf8"
  );
  assert.notEqual(
    identifyItemBank(changed).logicalSha256,
    identifyItemBank(bankBytes).logicalSha256
  );
});
