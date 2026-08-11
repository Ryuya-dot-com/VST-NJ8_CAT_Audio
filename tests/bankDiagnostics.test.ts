import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

import type { Item } from "../src/types.ts";
import {
  diagnoseItemBank,
  type BankDiagnosticPlan,
  type OracleLengthDiagnostic,
} from "../src/utils/bankDiagnostics.ts";
import { paperItemInformation3pl } from "../src/utils/paperScoring.ts";

const bankBytes = readFileSync(
  new URL("../public/jacet_parameters.csv", import.meta.url)
);
const bankSha256 = createHash("sha256").update(bankBytes).digest("hex");
interface ReferenceFixture {
  numericalTolerance: number;
  cases: Array<{
    theta: number;
    fullBankInformation: number;
    fullBankInformationEquivalentStandardDeviation: number;
    effectiveItemCount: number;
    topItemIndex: number;
    oracle: Array<{
      testLength: number;
      information: number;
      standardDeviation: number;
      highLevelItemCount: number;
    }>;
  }>;
  parameters: {
    maximumDiscrimination: number;
    minimumDifficulty: number;
    maximumDifficulty: number;
  };
}
const reference = JSON.parse(
  readFileSync(
    new URL("./fixtures/bank-diagnostic-v1.json", import.meta.url),
    "utf8"
  )
) as ReferenceFixture;
const itemBank: Item[] = bankBytes
  .toString("utf8")
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

const plan: BankDiagnosticPlan = {
  planId: "bank-diagnostic-test-v1",
  trueThetas: [-3.5, 0, 3.5],
  testLengths: [20, 30, 160],
  highLevelFloor: 7,
  minimumHighLevelItems: 2,
  informationThresholds: [0.1, 0.5],
};

function assertClose(actual: number, expected: number, label: string): void {
  assert.ok(
    Math.abs(actual - expected) <= reference.numericalTolerance,
    `${label}: expected ${expected}, received ${actual}`
  );
}

test("bank diagnostics match the independent base-R reference", () => {
  const referencePlan: BankDiagnosticPlan = {
    ...plan,
    trueThetas: reference.cases.map((scenario) => scenario.theta),
    testLengths: [20, 30, 40, 160],
  };
  const report = diagnoseItemBank(itemBank, bankSha256, referencePlan);
  for (const scenario of reference.cases) {
    const diagnostic = report.thetaDiagnostics.find(
      (candidate) => candidate.theta === scenario.theta
    );
    assert.ok(diagnostic);
    assertClose(
      diagnostic.fullBankInformation,
      scenario.fullBankInformation,
      `theta ${scenario.theta} full information`
    );
    assertClose(
      diagnostic.fullBankInformationEquivalentStandardDeviation,
      scenario.fullBankInformationEquivalentStandardDeviation,
      `theta ${scenario.theta} full information SD`
    );
    assertClose(
      diagnostic.informationConcentration.effectiveItemCount,
      scenario.effectiveItemCount,
      `theta ${scenario.theta} effective item count`
    );
    assert.equal(diagnostic.topItems[0].itemIndex, scenario.topItemIndex);
    for (const oracleReference of scenario.oracle) {
      const oracle: OracleLengthDiagnostic | undefined =
        diagnostic.oracleByLength.find(
        (candidate) => candidate.testLength === oracleReference.testLength
      );
      assert.ok(oracle);
      assertClose(
        oracle.totalInformation,
        oracleReference.information,
        `theta ${scenario.theta} oracle ${oracleReference.testLength} information`
      );
      assertClose(
        oracle.informationEquivalentStandardDeviation,
        oracleReference.standardDeviation,
        `theta ${scenario.theta} oracle ${oracleReference.testLength} SD`
      );
      assert.equal(
        oracle.highLevelItemCount,
        oracleReference.highLevelItemCount
      );
    }
  }
  assertClose(
    report.parameterGroups.overall.discrimination.maximum,
    reference.parameters.maximumDiscrimination,
    "maximum discrimination"
  );
  assertClose(
    report.parameterGroups.overall.difficulty.minimum,
    reference.parameters.minimumDifficulty,
    "minimum difficulty"
  );
  assertClose(
    report.parameterGroups.overall.difficulty.maximum,
    reference.parameters.maximumDifficulty,
    "maximum difficulty"
  );
});

test("bank diagnostics exactly decompose item information", () => {
  const report = diagnoseItemBank(itemBank, bankSha256, plan);
  assert.equal(report.schemaVersion, "bank-diagnostic-v1");
  assert.equal(report.parameterGroups.byLevel.length, 8);
  assert.equal(report.parameterGroups.byPartOfSpeech.length, 4);
  assert.equal(report.thetaDiagnostics.length, 3);

  for (const diagnostic of report.thetaDiagnostics) {
    const directInformation = itemBank.reduce(
      (sum, item) => sum + paperItemInformation3pl(diagnostic.theta, item),
      0
    );
    assert.ok(
      Math.abs(diagnostic.fullBankInformation - directInformation) <= 1e-12
    );
    const lengths = diagnostic.oracleByLength;
    assert.ok(lengths[0].totalInformation <= lengths[1].totalInformation);
    assert.ok(lengths[1].totalInformation <= lengths[2].totalInformation);
    assert.ok(
      Math.abs(lengths[2].totalInformation - directInformation) <= 1e-12
    );
    for (const length of lengths) {
      assert.equal(length.selectedItemIndices.length, length.testLength);
      assert.ok(length.highLevelItemCount >= plan.minimumHighLevelItems);
      assert.ok(length.informationEquivalentStandardDeviation > 0);
      assert.ok(
        length.priorAugmentedInformationEquivalentStandardDeviation <=
          length.informationEquivalentStandardDeviation
      );
    }
    assert.ok(
      diagnostic.informationConcentration.effectiveItemCount >= 1 &&
        diagnostic.informationConcentration.effectiveItemCount <= itemBank.length
    );
    assert.ok(
      diagnostic.informationConcentration.highLevelInformationShare >= 0 &&
        diagnostic.informationConcentration.highLevelInformationShare <= 1
    );
  }
});

test("bank diagnostics are deterministic and reject ambiguous plans", () => {
  assert.deepEqual(
    diagnoseItemBank(itemBank, bankSha256, plan),
    diagnoseItemBank(itemBank, bankSha256, plan)
  );
  assert.throws(
    () =>
      diagnoseItemBank(itemBank, bankSha256, {
        ...plan,
        trueThetas: [0, 0],
      }),
    /finite and unique/
  );
  assert.throws(
    () =>
      diagnoseItemBank(itemBank, bankSha256, {
        ...plan,
        testLengths: [20, 20],
      }),
    /valid and unique/
  );
});
