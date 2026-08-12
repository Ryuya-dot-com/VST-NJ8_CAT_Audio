export const PUBLIC_SCORE_REPORTING_POLICY = Object.freeze({
  policyId: "latent-score-reporting-default-deny-v1",
  status: "withheld-pending-confirmatory-validation",
  decision: "withhold-all-latent-score-values",
  allowsTheta: false,
  allowsStandardError: false,
  allowsVocabularyScale: false,
  allowsRangeClassification: false,
  evidenceRequirements: Object.freeze([
    "frozen-estimand-model-and-population",
    "predeclared-conditional-operating-characteristics",
    "stable-rare-event-calibration-with-monte-carlo-error",
    "independent-confirmation-on-fresh-random-seeds",
    "mode-specific-calibration-and-validation",
  ]),
} as const);

export const SCORE_REPORT_WITHHELD_MESSAGE =
  "推定語彙サイズ・能力値・測定範囲分類は、報告手続の確認的妥当化が完了していないため表示していません。";

export const OBSERVED_RESULT_CAUTION =
  "以下は適応的に出題された項目の回答集計であり、語彙サイズや能力値を表す得点ではありません。";

export interface PublicObservedResultInput {
  testLabel: string;
  userName: string;
  startedAt: string;
  endedAt: string;
  administeredItems: number;
  correctAnswers: number;
  accuracyPercent: number | null;
}

export type PublicResultValue = string | number | null;
export type PublicResultRecord = Record<string, PublicResultValue>;

export const PUBLIC_OBSERVED_RESULT_FIELDS = Object.freeze([
  "テスト形式",
  "受験者氏名",
  "開始日時",
  "終了日時",
  "数値得点報告",
  "得点報告ポリシーID",
  "報告保留理由",
  "実施項目数",
  "実施項目の正答数",
  "実施項目の正答率（%）",
  "集計上の注意",
] as const);

const FORBIDDEN_LATENT_FIELD_PATTERN =
  /(?:能力値|標準誤差|推定語彙|語彙サイズ|8000.*尺度|theta|vocab|latent.*score|standard.*error)/iu;

export function assertPublicResultContainsNoLatentScores(
  records: readonly PublicResultRecord[]
): void {
  for (const record of records) {
    for (const fieldName of Object.keys(record)) {
      if (FORBIDDEN_LATENT_FIELD_PATTERN.test(fieldName)) {
        throw new Error(
          `Public result field "${fieldName}" violates ${PUBLIC_SCORE_REPORTING_POLICY.policyId}.`
        );
      }
    }
  }
}

export function assertPublicResultFieldsAllowed(
  records: readonly PublicResultRecord[],
  allowedFields: readonly string[]
): void {
  if (allowedFields.length === 0 || new Set(allowedFields).size !== allowedFields.length) {
    throw new Error("Public result field allowlist must be non-empty and unique.");
  }
  const allowed = new Set(allowedFields);
  assertPublicResultContainsNoLatentScores(records);
  for (const record of records) {
    for (const fieldName of Object.keys(record)) {
      if (!allowed.has(fieldName)) {
        throw new Error(
          `Public result field "${fieldName}" is not explicitly allowed by ${PUBLIC_SCORE_REPORTING_POLICY.policyId}.`
        );
      }
    }
  }
}

export function buildPublicObservedResult(
  input: PublicObservedResultInput
): PublicResultRecord {
  const record: PublicResultRecord = {
    テスト形式: input.testLabel,
    受験者氏名: input.userName,
    開始日時: input.startedAt,
    終了日時: input.endedAt,
    数値得点報告: "保留（妥当化未完了）",
    得点報告ポリシーID: PUBLIC_SCORE_REPORTING_POLICY.policyId,
    報告保留理由: SCORE_REPORT_WITHHELD_MESSAGE,
    実施項目数: input.administeredItems,
    実施項目の正答数: input.correctAnswers,
    "実施項目の正答率（%）": input.accuracyPercent,
    集計上の注意: OBSERVED_RESULT_CAUTION,
  };
  assertPublicResultFieldsAllowed([record], PUBLIC_OBSERVED_RESULT_FIELDS);
  return record;
}
