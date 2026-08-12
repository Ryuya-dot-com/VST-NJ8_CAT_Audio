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

const PART_OF_SPEECH_LABELS: Record<string, string> = {
  noun: "名詞",
  verb: "動詞",
  adjective: "形容詞",
  adverb: "副詞",
};

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
  const partOfSpeechLabel =
    PART_OF_SPEECH_LABELS[item.PartOfSpeech.toLowerCase()];

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
                {partOfSpeechLabel && (
                  <span className="pill pill-tonal">{partOfSpeechLabel}</span>
                )}
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
                        <span aria-hidden="true">再生</span>
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
