import type { Item } from "../types";
import {
  PAPER_3PL_CONFIG,
  computeLevelParameterMeans,
  paperItemInformation3pl,
  paperProbability3pl,
  paperVocabularyAtThetaFromMeans,
} from "./paperScoring.ts";

export interface BankDiagnosticPlan {
  planId: string;
  trueThetas: number[];
  testLengths: number[];
  highLevelFloor: number;
  minimumHighLevelItems: number;
  informationThresholds: number[];
}

export interface NumericSummary {
  minimum: number;
  p10: number;
  median: number;
  mean: number;
  p90: number;
  maximum: number;
}

export interface ParameterGroupSummary {
  group: string;
  itemCount: number;
  discrimination: NumericSummary;
  difficulty: NumericSummary;
  guessing: NumericSummary;
}

export interface OracleLengthDiagnostic {
  testLength: number;
  totalInformation: number;
  informationEquivalentStandardDeviation: number;
  priorAugmentedInformationEquivalentStandardDeviation: number;
  highLevelItemCount: number;
  levelCounts: Record<string, number>;
  partOfSpeechCounts: Record<string, number>;
  selectedItemIndices: number[];
}

export interface ThetaBankDiagnostic {
  theta: number;
  paperVocabularyScore: number;
  expectedFullBankRawScore: number;
  fullBankInformation: number;
  fullBankInformationEquivalentStandardDeviation: number;
  fullBankPriorAugmentedInformationEquivalentStandardDeviation: number;
  normalizedSuccessAtOrBelowFivePercent: number;
  normalizedSuccessAtOrAboveNinetyFivePercent: number;
  itemCountsAtInformationThresholds: Record<string, number>;
  informationConcentration: {
    herfindahlIndex: number;
    effectiveItemCount: number;
    highLevelInformationShare: number;
  };
  topItems: Array<{
    itemIndex: number;
    level: number;
    partOfSpeech: string;
    difficulty: number;
    discrimination: number;
    guessing: number;
    probability: number;
    information: number;
  }>;
  oracleByLength: OracleLengthDiagnostic[];
}

export interface BankDiagnosticReport {
  schemaVersion: "bank-diagnostic-v1";
  scoreModelId: string;
  itemBankSha256: string;
  planSha256: string | null;
  provenance: BankDiagnosticProvenance | null;
  plan: BankDiagnosticPlan;
  parameterGroups: {
    overall: ParameterGroupSummary;
    byLevel: ParameterGroupSummary[];
    byPartOfSpeech: ParameterGroupSummary[];
  };
  thetaDiagnostics: ThetaBankDiagnostic[];
}

export interface BankDiagnosticProvenance {
  nodeVersion: string;
  platform: string;
  architecture: string;
  sourceSha256: Record<string, string>;
}

function quantileType7(sorted: readonly number[], probability: number): number {
  if (sorted.length === 0) throw new RangeError("Cannot summarize no values.");
  const position = (sorted.length - 1) * probability;
  const lowerIndex = Math.floor(position);
  const upperIndex = Math.ceil(position);
  const fraction = position - lowerIndex;
  return (
    sorted[lowerIndex] + fraction * (sorted[upperIndex] - sorted[lowerIndex])
  );
}

function summarizeNumbers(values: number[]): NumericSummary {
  if (values.some((value) => !Number.isFinite(value))) {
    throw new RangeError("Item parameters must be finite.");
  }
  const sorted = [...values].sort((left, right) => left - right);
  return {
    minimum: sorted[0],
    p10: quantileType7(sorted, 0.1),
    median: quantileType7(sorted, 0.5),
    mean: sorted.reduce((sum, value) => sum + value, 0) / sorted.length,
    p90: quantileType7(sorted, 0.9),
    maximum: sorted[sorted.length - 1],
  };
}

function summarizeGroup(group: string, items: Item[]): ParameterGroupSummary {
  if (items.length === 0) throw new RangeError(`Item group ${group} is empty.`);
  return {
    group,
    itemCount: items.length,
    discrimination: summarizeNumbers(items.map((item) => item.Dscrimination)),
    difficulty: summarizeNumbers(items.map((item) => item.Difficulty)),
    guessing: summarizeNumbers(items.map((item) => item.Guessing)),
  };
}

function countsBy<T>(values: T[], label: (value: T) => string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const value of values) {
    const key = label(value);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return Object.fromEntries(
    Object.entries(counts).sort(([left], [right]) =>
      left.localeCompare(right, "en", { numeric: true })
    )
  );
}

function selectOracleItems(
  rankedIndices: number[],
  itemBank: Item[],
  testLength: number,
  highLevelFloor: number,
  minimumHighLevelItems: number
): number[] {
  const selected = rankedIndices.slice(0, testLength);
  let highCount = selected.filter(
    (index) => itemBank[index].Level >= highLevelFloor
  ).length;
  if (highCount >= minimumHighLevelItems) return selected;

  const selectedSet = new Set(selected);
  const highReplacements = rankedIndices.filter(
    (index) =>
      !selectedSet.has(index) && itemBank[index].Level >= highLevelFloor
  );
  const replaceablePositions = selected
    .map((index, position) => ({ index, position }))
    .filter(({ index }) => itemBank[index].Level < highLevelFloor)
    .reverse();
  while (highCount < minimumHighLevelItems) {
    const replacement = highReplacements.shift();
    const replaceable = replaceablePositions.shift();
    if (replacement === undefined || replaceable === undefined) {
      throw new RangeError("The content constraint cannot be satisfied.");
    }
    selected[replaceable.position] = replacement;
    highCount += 1;
  }
  return selected;
}

function informationEquivalentStandardDeviation(information: number): number {
  return information > 0 ? 1 / Math.sqrt(information) : Number.POSITIVE_INFINITY;
}

function validatePlan(itemBank: Item[], plan: BankDiagnosticPlan): void {
  if (plan.planId.trim().length === 0) {
    throw new RangeError("Diagnostic plans require a planId.");
  }
  if (
    plan.trueThetas.length === 0 ||
    plan.trueThetas.some((theta) => !Number.isFinite(theta)) ||
    new Set(plan.trueThetas).size !== plan.trueThetas.length
  ) {
    throw new RangeError("Diagnostic theta conditions must be finite and unique.");
  }
  if (
    plan.testLengths.length === 0 ||
    plan.testLengths.some(
      (length) =>
        !Number.isInteger(length) || length < 1 || length > itemBank.length
    ) ||
    new Set(plan.testLengths).size !== plan.testLengths.length
  ) {
    throw new RangeError("Diagnostic test lengths must be valid and unique.");
  }
  if (
    !Number.isInteger(plan.highLevelFloor) ||
    !Number.isInteger(plan.minimumHighLevelItems) ||
    plan.minimumHighLevelItems < 0 ||
    Math.min(...plan.testLengths) < plan.minimumHighLevelItems
  ) {
    throw new RangeError("Invalid diagnostic content constraint.");
  }
  if (
    itemBank.filter((item) => item.Level >= plan.highLevelFloor).length <
    plan.minimumHighLevelItems
  ) {
    throw new RangeError("The bank cannot satisfy the diagnostic constraint.");
  }
  if (
    plan.informationThresholds.length === 0 ||
    plan.informationThresholds.some(
      (threshold) => !Number.isFinite(threshold) || threshold <= 0
    )
  ) {
    throw new RangeError("Information thresholds must be positive and finite.");
  }
}

export function diagnoseItemBank(
  itemBank: Item[],
  itemBankSha256: string,
  plan: BankDiagnosticPlan,
  planSha256: string | null = null,
  provenance: BankDiagnosticProvenance | null = null
): BankDiagnosticReport {
  if (itemBank.length === 0) throw new RangeError("The item bank is empty.");
  validatePlan(itemBank, plan);
  const levelMeans = computeLevelParameterMeans(itemBank);
  const levels = [...new Set(itemBank.map((item) => item.Level))].sort(
    (left, right) => left - right
  );
  const partsOfSpeech = [
    ...new Set(itemBank.map((item) => item.PartOfSpeech)),
  ].sort();
  const parameterGroups = {
    overall: summarizeGroup("overall", itemBank),
    byLevel: levels.map((level) =>
      summarizeGroup(
        `level-${level}`,
        itemBank.filter((item) => item.Level === level)
      )
    ),
    byPartOfSpeech: partsOfSpeech.map((partOfSpeech) =>
      summarizeGroup(
        `part-of-speech-${partOfSpeech}`,
        itemBank.filter((item) => item.PartOfSpeech === partOfSpeech)
      )
    ),
  };

  const thetaDiagnostics = plan.trueThetas.map((theta) => {
    const probabilities = itemBank.map((item) =>
      paperProbability3pl(theta, item)
    );
    const information = itemBank.map((item) =>
      paperItemInformation3pl(theta, item)
    );
    const rankedIndices = itemBank
      .map((_, index) => index)
      .sort(
        (left, right) => information[right] - information[left] || left - right
      );
    const fullBankInformation = information.reduce(
      (sum, value) => sum + value,
      0
    );
    const informationShares = information.map(
      (value) => value / fullBankInformation
    );
    const herfindahlIndex = informationShares.reduce(
      (sum, share) => sum + share ** 2,
      0
    );
    const highLevelInformation = itemBank.reduce(
      (sum, item, index) =>
        sum + (item.Level >= plan.highLevelFloor ? information[index] : 0),
      0
    );
    const normalizedSuccess = probabilities.map(
      (probability, index) =>
        (probability - itemBank[index].Guessing) /
        (1 - itemBank[index].Guessing)
    );
    const oracleByLength = plan.testLengths.map((testLength) => {
      const selectedIndices = selectOracleItems(
        rankedIndices,
        itemBank,
        testLength,
        plan.highLevelFloor,
        plan.minimumHighLevelItems
      );
      const selectedItems = selectedIndices.map((index) => itemBank[index]);
      const totalInformation = selectedIndices.reduce(
        (sum, index) => sum + information[index],
        0
      );
      const priorInformation =
        1 / PAPER_3PL_CONFIG.prior.standardDeviation ** 2;
      return {
        testLength,
        totalInformation,
        informationEquivalentStandardDeviation:
          informationEquivalentStandardDeviation(totalInformation),
        priorAugmentedInformationEquivalentStandardDeviation:
          informationEquivalentStandardDeviation(
            totalInformation + priorInformation
          ),
        highLevelItemCount: selectedItems.filter(
          (item) => item.Level >= plan.highLevelFloor
        ).length,
        levelCounts: countsBy(selectedItems, (item) => String(item.Level)),
        partOfSpeechCounts: countsBy(
          selectedItems,
          (item) => item.PartOfSpeech
        ),
        selectedItemIndices: [...selectedIndices].sort(
          (left, right) => left - right
        ),
      };
    });
    return {
      theta,
      paperVocabularyScore: paperVocabularyAtThetaFromMeans(theta, levelMeans),
      expectedFullBankRawScore: probabilities.reduce(
        (sum, probability) => sum + probability,
        0
      ),
      fullBankInformation,
      fullBankInformationEquivalentStandardDeviation:
        informationEquivalentStandardDeviation(fullBankInformation),
      fullBankPriorAugmentedInformationEquivalentStandardDeviation:
        informationEquivalentStandardDeviation(
          fullBankInformation +
            1 / PAPER_3PL_CONFIG.prior.standardDeviation ** 2
        ),
      normalizedSuccessAtOrBelowFivePercent: normalizedSuccess.filter(
        (value) => value <= 0.05
      ).length,
      normalizedSuccessAtOrAboveNinetyFivePercent: normalizedSuccess.filter(
        (value) => value >= 0.95
      ).length,
      itemCountsAtInformationThresholds: Object.fromEntries(
        plan.informationThresholds.map((threshold) => [
          String(threshold),
          information.filter((value) => value >= threshold).length,
        ])
      ),
      informationConcentration: {
        herfindahlIndex,
        effectiveItemCount: 1 / herfindahlIndex,
        highLevelInformationShare: highLevelInformation / fullBankInformation,
      },
      topItems: rankedIndices.slice(0, 10).map((itemIndex) => ({
        itemIndex,
        level: itemBank[itemIndex].Level,
        partOfSpeech: itemBank[itemIndex].PartOfSpeech,
        difficulty: itemBank[itemIndex].Difficulty,
        discrimination: itemBank[itemIndex].Dscrimination,
        guessing: itemBank[itemIndex].Guessing,
        probability: probabilities[itemIndex],
        information: information[itemIndex],
      })),
      oracleByLength,
    };
  });

  return {
    schemaVersion: "bank-diagnostic-v1",
    scoreModelId: PAPER_3PL_CONFIG.scoreModelId,
    itemBankSha256,
    planSha256,
    provenance:
      provenance === null
        ? null
        : {
            ...provenance,
            sourceSha256: { ...provenance.sourceSha256 },
          },
    plan: {
      ...plan,
      trueThetas: [...plan.trueThetas],
      testLengths: [...plan.testLengths],
      informationThresholds: [...plan.informationThresholds],
    },
    parameterGroups,
    thetaDiagnostics,
  };
}
