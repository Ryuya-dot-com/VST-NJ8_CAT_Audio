interface ResultsViewProps {
  userName: string;
  theta: number;
  se: number;
  vocabSize: number;
  totalItems: number;
  correctAnswers: number;
  accuracy: number;
  onDownload: () => void;
  onRestart: () => void;
}

export function ResultsView({
  userName,
  theta,
  se,
  vocabSize,
  totalItems,
  correctAnswers,
  accuracy,
  onDownload,
  onRestart,
}: ResultsViewProps) {
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
                  お疲れさまでした！推定結果は以下のとおりです。
                  受験者: <strong>{userName || "（未入力）"}</strong>
                </p>
              </div>

              <div className="stat-grid mb-4">
                <div className="stat-card">
                  <span className="stat-label">推定語彙サイズ</span>
                  <span className="stat-value">{vocabSize.toLocaleString()} 語</span>
                </div>
                <div className="stat-card">
                  <span className="stat-label">能力値 θ</span>
                  <span className="stat-value">
                    {theta.toFixed(2)}
                    <span className="stat-sub">（SE {se.toFixed(2)}）</span>
                  </span>
                </div>
                <div className="stat-card">
                  <span className="stat-label">正答率</span>
                  <span className="stat-value">
                    {accuracy.toFixed(1)}%
                    <span className="stat-sub">
                      （{correctAnswers} / {totalItems}）
                    </span>
                  </span>
                </div>
              </div>

              <div className="result-actions d-flex flex-column flex-md-row justify-content-center gap-3">
                <button
                  type="button"
                  className="btn btn-gradient btn-lg"
                  onClick={onDownload}
                >
                  結果をExcelでダウンロード
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
