import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  classifySelectivePath,
  invertSelectiveAcceptanceEnvelope,
  selectSelectiveRandomesqueItem,
} from "../src/utils/selectiveReportingSimulation.ts";
import type { SelectiveReportingPlan } from "../src/utils/selectiveReportingPlan.ts";
import type { Item } from "../src/types.ts";
import { paperItemInformation3pl } from "../src/utils/paperScoring.ts";

const plan = JSON.parse(
  readFileSync(
    new URL(
      "../simulation/plans/selective-reporting-exploratory-v1.json",
      import.meta.url
    ),
    "utf8"
  )
) as SelectiveReportingPlan;
const itemBank: Item[] = readFileSync(
  new URL("../public/jacet_parameters.csv", import.meta.url),
  "utf8"
)
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

test("selection event is fixed before and independently of the interval", () => {
  const selected = classifySelectivePath(
    {
      eap: 0.2,
      belowProbability: 0.01,
      withinProbability: 0.97,
      aboveProbability: 0.02,
    },
    plan
  );
  assert.deepEqual(selected, {
    classification: "within-range",
    selected: true,
  });
  const outsidePoint = classifySelectivePath(
    {
      eap: plan.informationSupportRange.upperTheta + 0.01,
      belowProbability: 0.01,
      withinProbability: 0.97,
      aboveProbability: 0.02,
    },
    plan
  );
  assert.equal(outsidePoint.classification, "within-range");
  assert.equal(outsidePoint.selected, false);
});

test("selective inversion uses a conservative hull, exact endpoints, and fallback", () => {
  const support = plan.informationSupportRange;
  const grid = [support.lowerTheta, -2, -1, 0, 1, 2, support.upperTheta];
  const ordinary = invertSelectiveAcceptanceEnvelope(
    0.1,
    grid,
    [-2, 0, 2],
    [-1, -0.5, 0],
    [0.2, 0.5, 1],
    support
  );
  assert.equal(ordinary.usedEmptyFallback, false);
  assert.ok(ordinary.lower <= 0.1);
  assert.ok(ordinary.upper >= 0.1);
  assert.ok(ordinary.lower >= support.lowerTheta);
  assert.ok(ordinary.upper <= support.upperTheta);

  const fallback = invertSelectiveAcceptanceEnvelope(
    0,
    grid,
    [-2, 0, 2],
    [1, 1, 1],
    [2, 2, 2],
    support
  );
  assert.deepEqual(fallback, {
    lower: support.lowerTheta,
    upper: support.upperTheta,
    usedEmptyFallback: true,
  });
});

test("bounded top-five scan exactly matches full information sorting", () => {
  const administered = [0, 1, 2, 140, 141];
  for (const theta of [-3, -1, 0, 1, 3]) {
    for (const needHigh of [false, true]) {
      const eligible = itemBank
        .map((item, index) => ({ item, index }))
        .filter(({ item, index }) => {
          if (administered.includes(index)) return false;
          if (!needHigh) return true;
          return item.Level >= plan.highLevelFloor;
        });
      const ranked = eligible
        .map(({ item, index }) => ({
          index,
          information: paperItemInformation3pl(theta, item),
        }))
        .sort(
          (left, right) =>
            right.information - left.information || left.index - right.index
        )
        .slice(0, 5);
      for (const randomUnit of [0, 0.2, 0.999999]) {
        assert.equal(
          selectSelectiveRandomesqueItem(
            itemBank,
            theta,
            administered,
            needHigh,
            randomUnit,
            plan
          ),
          ranked[Math.floor(randomUnit * ranked.length)].index
        );
      }
    }
  }
});
