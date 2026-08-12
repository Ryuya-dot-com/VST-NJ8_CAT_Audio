import type { FormEvent } from "react";

interface LandingViewProps {
  name: string;
  onNameChange: (value: string) => void;
  onStart: () => void;
  loading: boolean;
  error: string | null;
}

export function LandingView({
  name,
  onNameChange,
  onStart,
  loading,
  error,
}: LandingViewProps) {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!loading && name.trim()) {
      onStart();
    }
  };

  const canStart = !loading && name.trim().length > 0;

  return (
    <div className="app-shell">
      <div className="container py-5">
        <div className="row justify-content-center">
          <div className="col-xl-8">
            <div className="surface-card p-5">
              <div className="text-center mb-5">
                <span className="eyebrow text-uppercase">
                  Computerized Adaptive Testing
                </span>
                <h1 className="hero-title mt-2 mb-3">JACET Vocabulary Size CAT</h1>
                <p className="hero-subtitle mb-0">
                  研究用の固定規則により30問を適応的に出題します。
                  終了時に回答集計ファイルを自動で保存します。
                </p>
              </div>

              <div className="row g-4 mb-4">
                <div className="col-md-6">
                  <div className="info-block h-100">
                    <h5 className="info-title">受験の流れ</h5>
                    <ul className="info-list">
                      <li>氏名を入力して開始します</li>
                      <li>単語と選択肢の音声を確認します</li>
                      <li>選択すると自動で次の問題へ進みます</li>
                      <li>終了時にExcelファイルが保存されます</li>
                    </ul>
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="info-block h-100">
                    <h5 className="info-title">受験前に</h5>
                    <ul className="info-list">
                      <li>音量とヘッドホンを確認してください</li>
                      <li>迷った場合も必ず1つ選択してください</li>
                      <li>ダウンロードの許可を求められたら許可してください</li>
                      <li>集中できる環境で受験してください</li>
                    </ul>
                  </div>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="mt-4">
                <div className="mb-4">
                  <label htmlFor="userName" className="form-label fw-semibold">
                    受験者氏名
                  </label>
                  <input
                    id="userName"
                    className="form-control form-control-lg input-soft"
                    placeholder="例：山田 太郎"
                    value={name}
                    onChange={(e) => onNameChange(e.target.value)}
                    disabled={loading}
                    required
                  />
                  <div className="form-text">
                    氏名を入力してからテストを開始してください。
                  </div>
                </div>

                {error && (
                  <div className="alert alert-danger modern-alert" role="alert">
                    データの読み込みに失敗しました。ページをリロードしてください。
                  </div>
                )}

                {loading && (
                  <div className="alert alert-secondary modern-alert" role="status">
                    テストデータを読み込み中です…
                  </div>
                )}

                <button
                  type="submit"
                  className="btn btn-gradient btn-lg w-100"
                  disabled={!canStart}
                >
                  テストを開始する
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
