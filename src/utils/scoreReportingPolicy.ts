export const CAT_SCORE_REPORTING_METHOD = Object.freeze({
  methodId: "paper-3pl-cat-eap-v1",
  scoreModelId: "paper-3pl-v1",
  abilityEstimator: "EAP",
  vocabularyPointEstimate: "posterior-mean-after-paper-scale-transformation",
  uncertainty: "equal-tail-95-percent-posterior-credible-interval",
  administeredItemCount: 30,
} as const);

export interface PublicCatScoreResultInput {
  testLabel: string;
  userName: string;
  startedAt: string;
  endedAt: string;
  administeredItems: number;
  correctAnswers: number;
  accuracyPercent: number | null;
  thetaEap: number;
  thetaPosteriorStandardDeviation: number;
  estimatedVocabularySize: number;
  vocabularyPosteriorStandardDeviation: number;
  vocabularyIntervalLower: number;
  vocabularyIntervalUpper: number;
}

export type ResultValue = string | number | null;
export type ResultRecord = Record<string, ResultValue>;

export const PUBLIC_CAT_SCORE_RESULT_FIELDS = Object.freeze([
  "テスト形式",
  "受験者氏名",
  "開始日時",
  "終了日時",
  "推定語彙サイズ（0–8000語）",
  "推定語彙サイズ事後標準偏差",
  "推定語彙サイズ95%区間下限",
  "推定語彙サイズ95%区間上限",
  "能力値θ（EAP）",
  "能力値事後標準偏差",
  "推定方法",
  "実施項目数",
  "正答数",
  "正答率（%）",
] as const);

export function assertResultFieldsAllowed(
  records: readonly ResultRecord[],
  allowedFields: readonly string[]
): void {
  if (allowedFields.length === 0 || new Set(allowedFields).size !== allowedFields.length) {
    throw new Error("Result field allowlist must be non-empty and unique.");
  }
  const allowed = new Set(allowedFields);
  for (const record of records) {
    for (const fieldName of Object.keys(record)) {
      if (!allowed.has(fieldName)) {
        throw new Error(`Result field "${fieldName}" is not explicitly allowed.`);
      }
    }
  }
}

function assertFiniteScore(value: number, label: string): void {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${label} must be finite.`);
  }
}

export function buildPublicCatScoreResult(
  input: PublicCatScoreResultInput
): ResultRecord {
  for (const [label, value] of [
    ["theta EAP", input.thetaEap],
    ["theta posterior standard deviation", input.thetaPosteriorStandardDeviation],
    ["estimated vocabulary size", input.estimatedVocabularySize],
    ["vocabulary posterior standard deviation", input.vocabularyPosteriorStandardDeviation],
    ["vocabulary interval lower", input.vocabularyIntervalLower],
    ["vocabulary interval upper", input.vocabularyIntervalUpper],
  ] as const) {
    assertFiniteScore(value, label);
  }
  if (input.vocabularyIntervalLower > input.vocabularyIntervalUpper) {
    throw new RangeError("Vocabulary interval lower bound must not exceed its upper bound.");
  }

  const record: ResultRecord = {
    テスト形式: input.testLabel,
    受験者氏名: input.userName,
    開始日時: input.startedAt,
    終了日時: input.endedAt,
    "推定語彙サイズ（0–8000語）": input.estimatedVocabularySize,
    推定語彙サイズ事後標準偏差: input.vocabularyPosteriorStandardDeviation,
    "推定語彙サイズ95%区間下限": input.vocabularyIntervalLower,
    "推定語彙サイズ95%区間上限": input.vocabularyIntervalUpper,
    "能力値θ（EAP）": input.thetaEap,
    能力値事後標準偏差: input.thetaPosteriorStandardDeviation,
    推定方法: "3PL・EAP（30問のCAT回答）",
    実施項目数: input.administeredItems,
    正答数: input.correctAnswers,
    "正答率（%）": input.accuracyPercent,
  };
  assertResultFieldsAllowed([record], PUBLIC_CAT_SCORE_RESULT_FIELDS);
  return record;
}
