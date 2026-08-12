import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import type { Item } from "../src/types.ts";
import {
  runEstimatorSensitivity,
  type EstimatorSensitivityPlan,
  type EstimatorSensitivityProvenance,
} from "../src/utils/estimatorSensitivity.ts";

function option(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv
    .slice(2)
    .find((argument) => argument.startsWith(prefix))
    ?.slice(prefix.length);
}

function parseItemBank(csv: string): Item[] {
  return csv
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter(Boolean)
    .slice(1)
    .map((line, id) => {
      const values = line.split(",");
      return {
        id,
        Level: Number(values[0]),
        Item: values[1] ?? "",
        PartOfSpeech: values[2] ?? "",
        CorrectAnswer: values[3] ?? "",
        Distractor_1: values[4] ?? "",
        Distractor_2: values[5] ?? "",
        Distractor_3: values[6] ?? "",
        Dscrimination: Number(values[7]),
        Difficulty: Number(values[8]),
        Guessing: Number(values[9]),
      };
    });
}

function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

const bankPath = resolve(option("bank") ?? "public/jacet_parameters.csv");
const planPath = resolve(
  option("plan") ?? "simulation/plans/estimator-sensitivity-exploratory-v1.json"
);
const bankBytes = readFileSync(bankPath);
const planBytes = readFileSync(planPath);
const plan = JSON.parse(planBytes.toString("utf8")) as EstimatorSensitivityPlan;
const sourceSha256 = Object.fromEntries(
  [
    "scripts/simulate-estimator-sensitivity.ts",
    "src/utils/estimatorSensitivity.ts",
    "src/utils/abilityEstimators.ts",
    "src/utils/paperScoring.ts",
  ].map((relativePath) => [relativePath, sha256(readFileSync(relativePath))])
);
const provenance: EstimatorSensitivityProvenance = {
  nodeVersion: process.version,
  platform: process.platform,
  architecture: process.arch,
  sourceSha256,
};
const report = runEstimatorSensitivity(
  parseItemBank(bankBytes.toString("utf8")),
  sha256(bankBytes),
  plan,
  sha256(planBytes),
  provenance
);
const serialized = `${JSON.stringify(report, null, 2)}\n`;
const outputPath = option("output");
if (outputPath === undefined) {
  process.stdout.write(serialized);
} else {
  const resolved = resolve(outputPath);
  mkdirSync(dirname(resolved), { recursive: true });
  writeFileSync(resolved, serialized, "utf8");
  process.stdout.write(`${resolved}\n`);
}
