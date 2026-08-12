import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import type { Item } from "../src/types.ts";
import { deriveInformationSupportRange } from "../src/utils/measurementRange.ts";

interface MeasurementRangeDiagnosticPlan {
  planId: string;
  anchorTheta: number;
  informationEquivalentStandardDeviationThreshold: number;
  sensitivityStandardDeviationThresholds: number[];
  posteriorMassThreshold: number;
  search: {
    minimumTheta: number;
    maximumTheta: number;
    step: number;
    rootTolerance: number;
  };
}

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

interface RuntimeProvenance {
  nodeVersion: string;
  platform: string;
  architecture: string;
  sourceSha256: Record<string, string>;
}

function normalizeRuntimeProvenanceForComparison<
  T extends { provenance: RuntimeProvenance },
>(actual: T, expected: T): T {
  for (const value of [
    expected.provenance.nodeVersion,
    expected.provenance.platform,
    expected.provenance.architecture,
  ]) {
    if (typeof value !== "string" || value.trim().length === 0) {
      throw new RangeError(
        "The committed measurement-range diagnostic has invalid runtime provenance."
      );
    }
  }
  return {
    ...actual,
    provenance: {
      ...actual.provenance,
      nodeVersion: expected.provenance.nodeVersion,
      platform: expected.provenance.platform,
      architecture: expected.provenance.architecture,
    },
  };
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

function validatePlan(plan: MeasurementRangeDiagnosticPlan): void {
  if (plan.planId.trim().length === 0) {
    throw new RangeError("The plan requires a planId.");
  }
  if (
    !Number.isFinite(plan.posteriorMassThreshold) ||
    plan.posteriorMassThreshold <= 0.5 ||
    plan.posteriorMassThreshold >= 1
  ) {
    throw new RangeError("Posterior-mass threshold must be between .5 and 1.");
  }
  if (
    plan.sensitivityStandardDeviationThresholds.length === 0 ||
    new Set(plan.sensitivityStandardDeviationThresholds).size !==
      plan.sensitivityStandardDeviationThresholds.length ||
    !plan.sensitivityStandardDeviationThresholds.includes(
      plan.informationEquivalentStandardDeviationThreshold
    )
  ) {
    throw new RangeError(
      "Sensitivity thresholds must be unique and include the primary threshold."
    );
  }
}

const bankPath = resolve(option("bank") ?? "public/jacet_parameters.csv");
const planPath = resolve(
  option("plan") ?? "simulation/plans/measurement-range-diagnostic-v1.json"
);
const bankBytes = readFileSync(bankPath);
const planBytes = readFileSync(planPath);
const itemBank = parseItemBank(bankBytes.toString("utf8"));
const plan = JSON.parse(
  planBytes.toString("utf8")
) as MeasurementRangeDiagnosticPlan;
validatePlan(plan);

const ranges = plan.sensitivityStandardDeviationThresholds.map((threshold) =>
  deriveInformationSupportRange(itemBank, {
    policyId: "information-support-exploratory-v1",
    informationEquivalentStandardDeviationThreshold: threshold,
    anchorTheta: plan.anchorTheta,
    minimumTheta: plan.search.minimumTheta,
    maximumTheta: plan.search.maximumTheta,
    searchStep: plan.search.step,
    rootTolerance: plan.search.rootTolerance,
  })
);
const defaultRange = ranges.find(
  (range) =>
    range.informationEquivalentStandardDeviationThreshold ===
    plan.informationEquivalentStandardDeviationThreshold
);
if (defaultRange === undefined) {
  throw new RangeError("The primary measurement range was not computed.");
}

const sourcePaths = [
  "scripts/diagnose-measurement-range.ts",
  "src/utils/measurementRange.ts",
  "src/utils/paperScoring.ts",
];
const report = {
  schemaVersion: "measurement-range-diagnostic-v1",
  policyId: defaultRange.policyId,
  validationStatus: "exploratory-not-for-score-reporting",
  itemBankSha256: sha256(bankBytes),
  planSha256: sha256(planBytes),
  provenance: {
    nodeVersion: process.version,
    platform: process.platform,
    architecture: process.arch,
    sourceSha256: Object.fromEntries(
      sourcePaths.map((path) => [path, sha256(readFileSync(path))])
    ),
  },
  plan,
  defaultRange,
  sensitivityRanges: ranges,
  interpretation: {
    informationRangeIsOperationalReportingRange: false,
    informationEquivalentStandardDeviationIsObservedCatRmse: false,
    posteriorClassifierIsProductionApproved: false,
    requiredNextEvidence:
      "Pre-specified common-path simulation of classification errors, bias, RMSE, and interval coverage, followed by a frozen independent confirmation run.",
  },
};

const serialized = `${JSON.stringify(report, null, 2)}\n`;
const outputPath = option("output");
const expectedPath = option("expected");
if (outputPath !== undefined && expectedPath !== undefined) {
  throw new RangeError("Use only one of --output or --expected.");
}
if (expectedPath !== undefined) {
  const expected = readFileSync(resolve(expectedPath), "utf8");
  const expectedReport = JSON.parse(expected) as typeof report;
  const comparable = `${JSON.stringify(
    normalizeRuntimeProvenanceForComparison(report, expectedReport),
    null,
    2
  )}\n`;
  if (comparable !== expected) {
    throw new RangeError("The committed measurement-range diagnostic is stale.");
  }
  process.stdout.write("measurement-range-diagnostic-v1 verified\n");
} else if (outputPath === undefined) {
  process.stdout.write(serialized);
} else {
  const resolvedOutputPath = resolve(outputPath);
  mkdirSync(dirname(resolvedOutputPath), { recursive: true });
  writeFileSync(resolvedOutputPath, serialized, "utf8");
  process.stdout.write(`${resolvedOutputPath}\n`);
}
