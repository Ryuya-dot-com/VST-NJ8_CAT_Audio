interface ResultsViewProps {
  userName: string;
  totalItems: number;
  correctAnswers: number;
  accuracy: number;
  theta: number;
  thetaStandardDeviation: number;
  estimatedVocabularySize: number;
  vocabularyIntervalLower: number;
  vocabularyIntervalUpper: number;
  downloadStatus: "idle" | "success" | "error";
  onDownload: () => void;
  onRestart: () => void;
}

function formatWords(value: number): string {
  return Math.round(value).toLocaleString("ja-JP");
}

export function ResultsView({
  userName,
  totalItems,
  correctAnswers,
  accuracy,
  theta,
  thetaStandardDeviation,
  estimatedVocabularySize,
  vocabularyIntervalLower,
  vocabularyIntervalUpper,
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
          <div className="col-xl-9">
            <div className="surface-card p-5 text-center">
              <div className="text-center mb-4">
                <span className="eyebrow text-uppercase">Result</span>
                <h2 className="hero-title mb-2">テスト結果</h2>
                <p className="hero-subtitle mb-0">
                  お疲れさまでした。30問の回答から推定した結果です。
                  受験者: <strong>{userName || "（未入力）"}</strong>
                </p>
              </div>

              <section className="score-highlight mb-4" aria-labelledby="vocabulary-score-title">
                <span className="score-label" id="vocabulary-score-title">
                  推定語彙サイズ
                </span>
                <strong className="score-value">
                  {formatWords(estimatedVocabularySize)} <small>語</small>
                </strong>
                <span className="score-range">
                  95%推定範囲: {formatWords(vocabularyIntervalLower)}–
                  {formatWords(vocabularyIntervalUpper)}語
                </span>
                <span className="score-scale">New JACET 8000（0–8,000語尺度）</span>
              </section>

              <div className="stat-grid mb-4">
                <div className="stat-card">
                  <span className="stat-label">能力値</span>
                  <span className="stat-value">θ {theta.toFixed(2)}</span>
                  <span className="stat-sub">
                    推定の不確かさ（事後SD） {thetaStandardDeviation.toFixed(2)}
                  </span>
                </div>
                <div className="stat-card">
                  <span className="stat-label">正答数</span>
                  <span className="stat-value">{correctAnswers} / {totalItems} 問</span>
                </div>
                <div className="stat-card">
                  <span className="stat-label">正答率</span>
                  <span className="stat-value">{accuracy.toFixed(1)}%</span>
                </div>
              </div>

              <div className="modern-alert mb-4 text-start" role="note">
                <strong>結果の計算方法</strong>
                <p className="mb-0 mt-2">
                  今回出題された30問の正誤から、各問題の難しさ・識別力・偶然正答率を考慮して能力値を推定し、VST-NJ8原論文の式で0–8,000語尺度へ換算しています。推定範囲は、30問で測定したことによる不確かさを示します。
                </p>
              </div>

              <p
                className={`download-status mb-4 ${
                  downloadStatus === "error" ? "status-error" : "status-success"
                }`}
                role={downloadStatus === "error" ? "alert" : "status"}
              >
                {downloadMessage}
              </p>

              <div className="result-actions d-flex flex-column flex-md-row justify-content-center gap-3">
                <button type="button" className="btn btn-gradient btn-lg" onClick={onDownload}>
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
