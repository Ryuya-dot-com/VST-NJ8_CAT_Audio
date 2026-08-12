import { createHash } from "node:crypto";

export const ITEM_BANK_LOGICAL_SCHEMA_VERSION =
  "vst-nj8-item-bank-logical-v1";

const ITEM_BANK_COLUMNS = Object.freeze([
  "Level",
  "Item",
  "PartOfSpeech",
  "CorrectAnswer",
  "Distractor_1",
  "Distractor_2",
  "Distractor_3",
  "Dscrimination",
  "Difficulty",
  "Guessing",
] as const);

function sha256(bytes: Buffer | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function canonicalizeItemBankLogicalContent(
  bytes: Buffer | string
): string {
  const text = (typeof bytes === "string" ? bytes : bytes.toString("utf8"))
    .replace(/^\uFEFF/u, "")
    .replace(/\r\n?/gu, "\n");
  const lines = text.split("\n").filter((line) => line.length > 0);
  const header = lines.shift()?.split(",");
  if (!header || header.join(",") !== ITEM_BANK_COLUMNS.join(",")) {
    throw new Error("Item-bank header does not match the logical identity schema.");
  }

  const rows = lines.map((line, index) => {
    const values = line.split(",");
    if (values.length !== ITEM_BANK_COLUMNS.length) {
      throw new Error(`Item-bank row ${index + 1} has ${values.length} columns.`);
    }
    const numericValues = [values[0], values[7], values[8], values[9]].map(Number);
    if (numericValues.some((value) => !Number.isFinite(value))) {
      throw new Error(`Item-bank row ${index + 1} contains a non-finite number.`);
    }
    return [
      numericValues[0],
      values[1],
      values[2],
      values[3],
      values[4],
      values[5],
      values[6],
      numericValues[1],
      numericValues[2],
      numericValues[3],
    ];
  });
  if (rows.length === 0) {
    throw new Error("Item bank must contain at least one data row.");
  }

  return `${JSON.stringify({
    schemaVersion: ITEM_BANK_LOGICAL_SCHEMA_VERSION,
    columns: ITEM_BANK_COLUMNS,
    rows,
  })}\n`;
}

export function identifyItemBank(bytes: Buffer): {
  logicalSchemaVersion: string;
  logicalSha256: string;
  artifactSha256: string;
} {
  return {
    logicalSchemaVersion: ITEM_BANK_LOGICAL_SCHEMA_VERSION,
    logicalSha256: sha256(canonicalizeItemBankLogicalContent(bytes)),
    artifactSha256: sha256(bytes),
  };
}
