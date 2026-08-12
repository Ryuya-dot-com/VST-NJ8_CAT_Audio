import {
  OBSERVED_RESULT_CAUTION,
  PUBLIC_SCORE_REPORTING_POLICY,
  SCORE_REPORT_WITHHELD_MESSAGE,
} from "../utils/scoreReportingPolicy";

interface ResultsViewProps {
  userName: string;
  totalItems: number;
  correctAnswers: number;
  accuracy: number;
  downloadStatus: "idle" | "success" | "error";
  onDownload: () => void;
  onRestart: () => void;
}

export function ResultsView({
  userName,
  totalItems,
  correctAnswers,
  accuracy,
  downloadStatus,
  onDownload,
  onRestart,
}: ResultsViewProps) {
  const downloadMessage =
    downloadStatus === "success"
      ? "結果ファイルを自動で保存しました。保存先はブラウザのダウンロード設定に従います。"
      : downloadStatus === "error"
        ? "結果ファイルを自動保存できなかった可能性があります。下のボタンから保存してください。"
        : "結果ファイルは自動でダウンロードされます。保存できなかった場合は下のボタンから再ダウンロードしてください。";

  return (
    <div className="app-shell">
      <div className="container py-5">
        <div className="row justify-content-center">
          <div className="col-xl-8">
            <div className="surface-card p-5 text-center">
              <div className="text-center mb-4">
                <span className="eyebrow text-uppercase">Result</span>
                <h2 className="hero-title mb-2">テスト結果</h2>
                <p className="hero-subtitle mb-0">
                  お疲れさまでした。回答の集計は以下のとおりです。
                  受験者: <strong>{userName || "（未入力）"}</strong>
                </p>
                <div className="modern-alert mt-4 text-start" role="note">
                  <strong>数値得点の報告を保留しています。</strong>
                  <p className="mb-1 mt-2">{SCORE_REPORT_WITHHELD_MESSAGE}</p>
                  <small>
                    {OBSERVED_RESULT_CAUTION}（ポリシー: {PUBLIC_SCORE_REPORTING_POLICY.policyId}）
                  </small>
                </div>
                <p
                  className={`download-status mt-3 mb-0 ${
                    downloadStatus === "error" ? "status-error" : "status-success"
                  }`}
                  role={downloadStatus === "error" ? "alert" : "status"}
                >
                  {downloadMessage}
                </p>
              </div>

              <div className="stat-grid mb-4">
                <div className="stat-card">
                  <span className="stat-label">実施項目数</span>
                  <span className="stat-value">{totalItems} 問</span>
                </div>
                <div className="stat-card">
                  <span className="stat-label">実施項目の正答数</span>
                  <span className="stat-value">{correctAnswers} 問</span>
                </div>
                <div className="stat-card">
                  <span className="stat-label">実施項目の正答率</span>
                  <span className="stat-value">
                    {accuracy.toFixed(1)}%
                  </span>
                </div>
              </div>

              <div className="result-actions d-flex flex-column flex-md-row justify-content-center gap-3">
                <button
                  type="button"
                  className="btn btn-gradient btn-lg"
                  onClick={onDownload}
                >
                  結果をExcelで再ダウンロード
                </button>
                <button type="button" className="btn btn-outline-secondary btn-lg" onClick={onRestart}>
                  もう一度受験する
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
