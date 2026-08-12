import type { Item, OptionChoice } from "../types";
import {
  canStartAudioOption,
  isAudioOptionKey,
  isAudioResponseReady,
  type AudioPlaybackStatus,
} from "../utils/audioAdministrationPolicy";

interface TestViewProps {
  item: Item;
  questionNumber: number;
  totalQuestions: number;
  progressPct: number;
  options: OptionChoice[];
  onSelect: (label: string, value: string) => void;
  onPlayOptionAudio: (label: string, value: string) => void;
  audioPlaybackStatus: AudioPlaybackStatus;
  isProcessing: boolean;
}

export function TestView({
  item,
  questionNumber,
  totalQuestions,
  progressPct,
  options,
  onSelect,
  onPlayOptionAudio,
  audioPlaybackStatus,
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

              <p className="test-instruction">
                日本語の問題語を確認し、英語の選択肢音声をAからDの順に
                1回ずつ最後まで聞いてください。その後、A〜Dを押して回答します。
              </p>

              <div
                className="progress modern-progress mb-4"
                role="progressbar"
                aria-label="テストの進行状況"
                aria-valuenow={progressPct}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div
                  className="progress-bar"
                  style={{ width: `${progressPct}%` }}
                >
                  {progressPct}%
                </div>
              </div>

              <div className="question-panel text-center">
                <p className="question-label">日本語の問題語（視覚提示のみ）</p>
                <h2 className="question-word">{item.Item}</h2>
              </div>

              <div className="option-grid mt-5">
                {options.map((option) => {
                  const labelText = option.label.toUpperCase();
                  const optionKey = option.label.toLowerCase();
                  if (!isAudioOptionKey(optionKey)) return null;
                  const playbackState = audioPlaybackStatus[optionKey];
                  const statusText = {
                    "not-played": "未再生",
                    playing: "再生中",
                    completed: "再生済み",
                    failed: "再生エラー（再試行）",
                  }[playbackState];
                  return (
                    <div className="option-card" key={`${item.id}-${option.label}`}>
                      <button
                        type="button"
                        className="option-button"
                        onClick={() => onSelect(option.label, option.text)}
                        aria-label={`選択肢${labelText}を回答`}
                        disabled={
                          isProcessing || !isAudioResponseReady(audioPlaybackStatus)
                        }
                      >
                        <span className="option-letter">{labelText}</span>
                      </button>
                      <button
                        type="button"
                        className="option-audio"
                        onClick={(event) => {
                          event.stopPropagation();
                          onPlayOptionAudio(option.label, option.text);
                        }}
                        aria-label={`選択肢${labelText}の音声を再生: ${statusText}`}
                        disabled={
                          isProcessing ||
                          !canStartAudioOption(optionKey, audioPlaybackStatus)
                        }
                      >
                        <span aria-hidden="true">🔊</span>
                        <span className="visually-hidden">
                          {labelText} の単語を再生: {statusText}
                        </span>
                      </button>
                      <span className="audio-status" aria-live="polite">
                        {statusText}
                      </span>
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
