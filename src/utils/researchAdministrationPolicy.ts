import type { Item } from "../types";
import {
  PAPER_3PL_CONFIG,
  paperItemInformation3pl,
} from "./paperScoring.ts";

export const RESEARCH_ADMINISTRATION_POLICY = Object.freeze({
  policyId: "research-fixed30-randomesque5-paper3pl-v1",
  validationStatus: "research-baseline-not-score-valid",
  evidenceBasis: "confirmation-v1/fixed30-randomesque5",
  evidencePlanSha256: "1aab9c60dd0c5036342caeec19c0e9f3d2e653d5d494cf73de42ce3bac7af60a",
  evidenceReportSha256: "5af908caffebccd9d295133277d95a01a56085a7e9e1c55b0ef0d2ae5c785752",
  evidenceEvaluationSha256: "d0c20daa6b7a678162e20c11d292695241722ef0b97a0109ef16e49a076d566c",
  scoreModelId: PAPER_3PL_CONFIG.scoreModelId,
  itemBankSha256: "ed058c8b87ef951c70512f89ac2ba708f18db983dd5b449b201e9b2dc97d0d47",
  estimator: "eap-normal-0-1",
  stoppingRule: "fixed-length",
  fixedLength: 30,
  selectionMethod: "randomesque",
  randomesqueSize: 5,
  randomGeneratorId: "mulberry32-v1",
  initialLevelMinimum: 3,
  initialLevelMaximum: 5,
  highLevelFloor: 7,
  minimumHighLevelItems: 2,
  precisionStoppingEnabled: false,
} as const);

export type ResearchStopReason = "fixed-length" | "item-bank-exhausted";

export const RESEARCH_ADMINISTRATION_AUDIT_FIELDS = Object.freeze([
  "研究実施規則ID",
  "実施規則の位置づけ",
  "項目応答モデルID",
  "内部推定法ID",
  "項目バンクSHA-256",
  "確認計画SHA-256",
  "確認結果SHA-256",
  "確認判定SHA-256",
  "項目選択法",
  "固定実施項目数",
  "乱数生成器ID",
  "項目選択seed",
  "停止理由",
] as const);

function assertRandomValue(value: number): void {
  if (!Number.isFinite(value) || value < 0 || value >= 1) {
    throw new RangeError("Random values must be finite in [0, 1).");
  }
}

function randomIndex(length: number, random: () => number): number {
  if (!Number.isInteger(length) || length < 1) {
    throw new RangeError("Random selection requires a non-empty candidate set.");
  }
  const value = random();
  assertRandomValue(value);
  return Math.floor(value * length);
}

export function createResearchAdministrationSeed(): number {
  if (!globalThis.crypto?.getRandomValues) {
    throw new Error("Cryptographic random seed generation is unavailable.");
  }
  return globalThis.crypto.getRandomValues(new Uint32Array(1))[0];
}

export function createResearchAdministrationRandom(seed: number): () => number {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) {
    throw new RangeError("Administration seed must be an unsigned 32-bit integer.");
  }
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function selectInitialResearchItem(
  itemBank: readonly Item[],
  random: () => number
): number {
  const policy = RESEARCH_ADMINISTRATION_POLICY;
  const candidates = itemBank
    .map((item, index) => ({ item, index }))
    .filter(
      ({ item }) =>
        item.Level >= policy.initialLevelMinimum &&
        item.Level <= policy.initialLevelMaximum
    );
  if (candidates.length === 0) {
    throw new RangeError("No items satisfy the research initial-level constraint.");
  }
  return candidates[randomIndex(candidates.length, random)].index;
}

export function selectNextResearchItem(
  itemBank: readonly Item[],
  theta: number,
  administered: readonly number[],
  random: () => number
): number | null {
  if (!Number.isFinite(theta)) {
    throw new RangeError("Selection theta must be finite.");
  }
  const administeredSet = new Set(administered);
  if (
    administeredSet.size !== administered.length ||
    administered.some(
      (index) => !Number.isInteger(index) || index < 0 || index >= itemBank.length
    )
  ) {
    throw new RangeError("Administered item indices must be unique and valid.");
  }

  const policy = RESEARCH_ADMINISTRATION_POLICY;
  let candidates = itemBank
    .map((_, index) => index)
    .filter((index) => !administeredSet.has(index));
  const highLevelItems = administered.reduce(
    (count, index) => count + (itemBank[index].Level >= policy.highLevelFloor ? 1 : 0),
    0
  );
  if (highLevelItems < policy.minimumHighLevelItems) {
    const highCandidates = candidates.filter(
      (index) => itemBank[index].Level >= policy.highLevelFloor
    );
    if (highCandidates.length > 0) candidates = highCandidates;
  }
  if (candidates.length === 0) return null;

  const ranked = candidates
    .map((index) => ({
      index,
      information: paperItemInformation3pl(theta, itemBank[index]),
    }))
    .sort(
      (left, right) =>
        right.information - left.information || left.index - right.index
    );
  const selectableCount = Math.min(policy.randomesqueSize, ranked.length);
  return ranked[randomIndex(selectableCount, random)].index;
}

export function shouldContinueResearchAdministration(
  administeredItems: number
): boolean {
  if (!Number.isInteger(administeredItems) || administeredItems < 0) {
    throw new RangeError("Administered item count must be a nonnegative integer.");
  }
  return administeredItems < RESEARCH_ADMINISTRATION_POLICY.fixedLength;
}

export function buildResearchAdministrationAudit(
  seed: number,
  stopReason: ResearchStopReason
): Record<(typeof RESEARCH_ADMINISTRATION_AUDIT_FIELDS)[number], string | number> {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) {
    throw new RangeError("Administration seed must be an unsigned 32-bit integer.");
  }
  if (stopReason !== "fixed-length" && stopReason !== "item-bank-exhausted") {
    throw new RangeError("Unknown research stopping reason.");
  }
  const policy = RESEARCH_ADMINISTRATION_POLICY;
  return {
    研究実施規則ID: policy.policyId,
    実施規則の位置づけ: policy.validationStatus,
    項目応答モデルID: policy.scoreModelId,
    内部推定法ID: policy.estimator,
    "項目バンクSHA-256": policy.itemBankSha256,
    "確認計画SHA-256": policy.evidencePlanSha256,
    "確認結果SHA-256": policy.evidenceReportSha256,
    "確認判定SHA-256": policy.evidenceEvaluationSha256,
    項目選択法: `${policy.selectionMethod}-${policy.randomesqueSize}`,
    固定実施項目数: policy.fixedLength,
    乱数生成器ID: policy.randomGeneratorId,
    項目選択seed: seed,
    停止理由: stopReason,
  };
}
