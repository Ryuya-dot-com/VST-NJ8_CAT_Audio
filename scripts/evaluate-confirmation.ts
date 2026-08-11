import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import type {
  CatSimulationReport,
  ConditionalSimulationMetrics,
} from "../src/utils/catSimulation.ts";

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

function extremeBy(
  conditions: ConditionalSimulationMetrics[],
  value: (condition: ConditionalSimulationMetrics) => number,
  direction: "maximum" | "minimum"
): { trueTheta: number | null; value: number } {
  return conditions
    .map((condition) => ({ trueTheta: condition.trueTheta, value: value(condition) }))
    .reduce((extreme, current) => {
      const replace =
        direction === "maximum"
          ? current.value > extreme.value
          : current.value < extreme.value;
      return replace ? current : extreme;
    });
}

const reportPath = option("report");
if (reportPath === undefined) throw new RangeError("--report is required.");
const criteriaPath = resolve(
  option("criteria") ?? "simulation/decision-criteria-v1.md"
);
const planPath = resolve(
  option("plan") ?? "simulation/plans/confirmation-v1.json"
);
const reportBytes = readFileSync(resolve(reportPath));
const criteriaBytes = readFileSync(criteriaPath);
const planBytes = readFileSync(planPath);
const report = JSON.parse(reportBytes.toString("utf8")) as CatSimulationReport;
if (
  report.schemaVersion !== "cat-simulation-v1" ||
  report.plan.planId !== "confirmation-v1" ||
  report.plan.replicationsPerTheta !== 5000
) {
  throw new RangeError(
    "The evaluator only accepts the locked confirmation-v1 report."
  );
}
if (report.planSha256 !== sha256(planBytes)) {
  throw new RangeError("The report does not match the locked confirmation plan.");
}
if (report.provenance === null) {
  throw new RangeError("The confirmation report requires source provenance.");
}
for (const [relativePath, expectedSha256] of Object.entries(
  report.provenance.sourceSha256
)) {
  if (sha256(readFileSync(resolve(relativePath))) !== expectedSha256) {
    throw new RangeError(`The report source does not match ${relativePath}.`);
  }
}

const rules = report.results.map((result) => {
  const biasPass = result.conditional.every((condition) => {
    const theta = condition.trueTheta;
    if (theta === null) return false;
    const tolerance = Math.abs(theta) <= 2.5 ? 0.1 : 0.15;
    return Math.abs(condition.thetaBias) <= tolerance;
  });
  const rmsePass = result.conditional.every(
    (condition) => condition.thetaRmse <= 0.3
  );
  const coveragePass = result.conditional.every((condition) => {
    const margin = 1.96 * condition.monteCarloStandardErrors.thetaCoverage;
    return (
      condition.thetaCoverage + margin >= 0.925 &&
      condition.thetaCoverage - margin <= 0.975
    );
  });
  const numericalIntegrityPass =
    result.overall.stopRates["item-bank-exhausted"] === 0 &&
    result.overall.highLevelConstraintViolationRate === 0;
  const burdenPass =
    result.overall.meanLength <= 25 &&
    result.overall.lengthP90 <= 30 &&
    result.overall.stopRates["maximum-length"] <= 0.05 &&
    result.conditional.every(
      (condition) => condition.stopRates["maximum-length"] <= 0.1
    );
  const exposurePass =
    result.exposure.maximumExposureRate <= 0.25 &&
    result.exposure.unusedItemRate <= 0.1;
  const gates = {
    numericalIntegrity: numericalIntegrityPass,
    conditionalBias: biasPass,
    conditionalRmse: rmsePass,
    intervalCoverage: coveragePass,
    burden: burdenPass,
    bankExposure: exposurePass,
  };
  const failedGates = Object.entries(gates)
    .filter(([, passed]) => !passed)
    .map(([gate]) => gate);
  return {
    ruleId: result.rule.id,
    passesAll: failedGates.length === 0,
    gates,
    failedGates,
    observed: {
      overallMeanLength: result.overall.meanLength,
      overallLengthP90: result.overall.lengthP90,
      overallMaximumLengthStopRate:
        result.overall.stopRates["maximum-length"],
      maximumConditionalMaximumLengthStopRate: extremeBy(
        result.conditional,
        (condition) => condition.stopRates["maximum-length"],
        "maximum"
      ),
      maximumAbsoluteConditionalBias: extremeBy(
        result.conditional,
        (condition) => Math.abs(condition.thetaBias),
        "maximum"
      ),
      maximumConditionalRmse: extremeBy(
        result.conditional,
        (condition) => condition.thetaRmse,
        "maximum"
      ),
      minimumConditionalCoverage: extremeBy(
        result.conditional,
        (condition) => condition.thetaCoverage,
        "minimum"
      ),
      maximumItemExposureRate: result.exposure.maximumExposureRate,
      unusedItemRate: result.exposure.unusedItemRate,
      highLevelConstraintViolationRate:
        result.overall.highLevelConstraintViolationRate,
    },
  };
});

const evaluation = {
  schemaVersion: "cat-confirmation-evaluation-v1",
  reportSha256: sha256(reportBytes),
  criteriaSha256: sha256(criteriaBytes),
  evaluatorSha256: sha256(readFileSync(resolve("scripts/evaluate-confirmation.ts"))),
  planId: report.plan.planId,
  planSha256: report.planSha256,
  candidatesPassingAllGates: rules
    .filter((rule) => rule.passesAll)
    .map((rule) => rule.ruleId),
  rules,
};
const serialized = `${JSON.stringify(evaluation, null, 2)}\n`;
const outputPath = option("output");
const expectedPath = option("expected");
if (outputPath !== undefined && expectedPath !== undefined) {
  throw new RangeError("Use only one of --output or --expected.");
}
if (expectedPath !== undefined) {
  const expected = readFileSync(resolve(expectedPath), "utf8");
  if (serialized !== expected) {
    throw new RangeError("The committed confirmation evaluation is stale.");
  }
  process.stdout.write("confirmation-v1 evaluation verified\n");
} else if (outputPath === undefined) {
  process.stdout.write(serialized);
} else {
  const resolvedOutputPath = resolve(outputPath);
  mkdirSync(dirname(resolvedOutputPath), { recursive: true });
  writeFileSync(resolvedOutputPath, serialized, "utf8");
  process.stdout.write(`${resolvedOutputPath}\n`);
}
