import type { Item, OptionChoice } from "../types";

interface TestViewProps {
  item: Item;
  questionNumber: number;
  totalQuestions: number;
  progressPct: number;
  options: OptionChoice[];
  onSelect: (value: string) => void;
  onPlayAudio: (value: string) => void;
  isProcessing: boolean;
}

export function TestView({
  item,
  questionNumber,
  totalQuestions,
  progressPct,
  options,
  onSelect,
  onPlayAudio,
  isProcessing,
}: TestViewProps) {
  const hasPartOfSpeech = Boolean(item.PartOfSpeech && item.PartOfSpeech !== "-");

  return (
    <div className="app-shell">
      <div className="container py-5">
        <div className="row justify-content-center">
          <div className="col-xl-8">
            <div className="surface-card p-5">
              <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-4">
                <span className="pill pill-accent">
                  問題 {questionNumber} / {totalQuestions}
                </span>
                <div className="d-flex flex-wrap gap-2">
                  {hasPartOfSpeech && (
                    <span className="pill pill-tonal">{item.PartOfSpeech}</span>
                  )}
                  <span className="pill pill-neutral">Level {item.Level}</span>
                </div>
              </div>

              <div className="progress modern-progress mb-4" role="progressbar">
                <div
                  className="progress-bar"
                  style={{ width: `${progressPct}%` }}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  {progressPct}%
                </div>
              </div>

              <div className="question-panel text-center">
                <h2 className="question-word">{item.Item}</h2>
              </div>

              <div className="option-grid mt-5">
                {options.map((option) => {
                  const labelText = option.label.toUpperCase();
                  return (
                    <div className="option-card" key={`${item.id}-${option.label}`}>
                      <button
                        type="button"
                        className="option-button"
                        onClick={() => onSelect(option.text)}
                        disabled={isProcessing}
                      >
                        <span className="option-letter">{labelText}</span>
                        <span className="visually-hidden">{option.text}</span>
                      </button>
                      <button
                        type="button"
                        className="option-audio"
                        onClick={(event) => {
                          event.stopPropagation();
                          onPlayAudio(option.text);
                        }}
                        aria-label={`選択肢${labelText}の音声を再生`}
                        disabled={isProcessing}
                      >
                        <span aria-hidden="true">🔊</span>
                        <span className="visually-hidden">
                          {labelText} の単語を再生
                        </span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
