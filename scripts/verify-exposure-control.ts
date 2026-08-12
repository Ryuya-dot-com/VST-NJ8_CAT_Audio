import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { assertReproducibleReportEqual } from "./assert-reproducible-report.ts";

import type { Item } from "../src/types.ts";
import {
  runExposureSimulation,
  type ExposureSimulationPlan,
  type ExposureSimulationReport,
} from "../src/utils/exposureSimulation.ts";

function option(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv
    .slice(2)
    .find((argument) => argument.startsWith(prefix))
    ?.slice(prefix.length);
}

function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
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

const reportPath = resolve(
  option("report") ?? "simulation/results/exposure-control-exploratory-v1.json"
);
const planPath = resolve(
  option("plan") ?? "simulation/plans/exposure-control-exploratory-v1.json"
);
const bankPath = resolve(option("bank") ?? "public/jacet_parameters.csv");
const report = JSON.parse(
  readFileSync(reportPath, "utf8")
) as ExposureSimulationReport;
const planBytes = readFileSync(planPath);
const bankBytes = readFileSync(bankPath);
const plan = JSON.parse(planBytes.toString("utf8")) as ExposureSimulationPlan;

assert.equal(report.schemaVersion, "exposure-simulation-v1");
assert.equal(report.planSha256, sha256(planBytes));
assert.equal(report.itemBankSha256, sha256(bankBytes));
assert.deepEqual(report.plan, plan);
assert.ok(report.provenance, "The stored report must contain provenance.");
for (const [relativePath, expectedHash] of Object.entries(
  report.provenance.sourceSha256
)) {
  assert.equal(sha256(readFileSync(relativePath)), expectedHash, relativePath);
}
const recomputed = runExposureSimulation(
  parseItemBank(bankBytes.toString("utf8")),
  report.itemBankSha256,
  plan,
  report.planSha256,
  report.provenance
);
assertReproducibleReportEqual(recomputed, report);
process.stdout.write(`verified ${report.plan.planId}\n`);
