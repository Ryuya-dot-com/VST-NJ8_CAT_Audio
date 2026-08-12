import type { Item, OptionChoice } from "../types";

export const AUDIO_OPTION_KEYS = Object.freeze(["a", "b", "c", "d"] as const);

export type AudioOptionKey = (typeof AUDIO_OPTION_KEYS)[number];
export type AudioPlaybackState =
  | "not-played"
  | "playing"
  | "completed"
  | "failed";
export type AudioPlaybackStatus = Record<AudioOptionKey, AudioPlaybackState>;

export const AUDIO_ADMINISTRATION_POLICY = Object.freeze({
  policyId: "audio-options-offline-mp3-ordered-once-v1",
  validationStatus: "research-stimulus-standardized-not-mode-valid",
  constructStatus: "audio-mode-requires-independent-calibration",
  questionPromptLanguage: "ja",
  questionPromptPresentation: "visible-text-no-audio",
  optionLanguage: "en",
  optionPresentation: "hidden-text-offline-mp3",
  optionPlaybackOrder: "A-B-C-D",
  requiredCompletedOptions: 4,
  successfulReplayAllowed: false,
  retryAfterFailureAllowed: true,
  concurrentPlaybackAllowed: false,
  playbackFailureTimeoutMs: 15000,
  deviceSpeechSynthesisFallbackAllowed: false,
  audioAssetManifestId: "vst-nj8-audio-options-v1",
  audioAssetManifestAlgorithm:
    "sha256(sorted UTF-8 lines: sha256(file-bytes), two spaces, basename, LF)",
  audioAssetManifestSha256: "f610cbf2c60a02ec6d3012c8c5827acdc0937bf3572b1c3e6bb6a6943a060772",
  audioAssetCount: 639,
  audioEncoding: "MP3",
  audioSampleRateHz: 24000,
  audioChannels: 1,
  audioBitRateBps: 64000,
  generatorFamily: "gTTS",
  generatorLanguage: "en",
  generatorSlow: false,
  generatorVersion: "unrecorded",
  voiceIdentity: "unrecorded",
  optionOrderRandomGeneratorId: "mulberry32-v1",
  optionOrderSeedDerivationId: "fnv1a32-domain-audio-options-v1",
} as const);

const AUDIO_ASSET_MANIFEST_SHA256_PATTERN = /^[0-9a-f]{64}$/u;

if (
  !AUDIO_ASSET_MANIFEST_SHA256_PATTERN.test(
    AUDIO_ADMINISTRATION_POLICY.audioAssetManifestSha256
  )
) {
  throw new Error("Audio asset manifest SHA-256 must be a lowercase hex digest.");
}

export const AUDIO_ADMINISTRATION_AUDIT_FIELDS = Object.freeze([
  "音声実施規則ID",
  "音声規則の位置づけ",
  "音声モード校正状態",
  "問題語提示方式",
  "選択肢提示方式",
  "選択肢音声提示順",
  "必須完了再生数",
  "音声再生timeout (ms)",
  "端末TTS fallback",
  "音声資産manifest ID",
  "音声資産manifest算出法",
  "音声資産manifest SHA-256",
  "音声資産数",
  "音声形式",
  "音声sample rate (Hz)",
  "音声channel数",
  "音声bit rate (bps)",
  "音声生成器",
  "音声生成言語",
  "音声生成slow設定",
  "音声生成器version",
  "音声voice ID",
  "選択肢順序乱数生成器ID",
  "選択肢順序seed導出ID",
] as const);

export function audioStimulusFilename(word: string): string {
  const slug = word
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${slug || "audio"}.mp3`;
}

export function createEmptyAudioPlaybackStatus(): AudioPlaybackStatus {
  return {
    a: "not-played",
    b: "not-played",
    c: "not-played",
    d: "not-played",
  };
}

export function isAudioOptionKey(value: string): value is AudioOptionKey {
  return AUDIO_OPTION_KEYS.includes(value as AudioOptionKey);
}

export function isAudioResponseReady(status: AudioPlaybackStatus): boolean {
  return AUDIO_OPTION_KEYS.every((key) => status[key] === "completed");
}

export function canStartAudioOption(
  key: AudioOptionKey,
  status: AudioPlaybackStatus
): boolean {
  if (AUDIO_OPTION_KEYS.some((optionKey) => status[optionKey] === "playing")) {
    return false;
  }
  const firstIncomplete = AUDIO_OPTION_KEYS.find(
    (optionKey) => status[optionKey] !== "completed"
  );
  return firstIncomplete === key;
}

function assertUint32(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0 || value > 0xffffffff) {
    throw new RangeError(`${label} must be an unsigned 32-bit integer.`);
  }
}

export function deriveAudioOptionOrderSeed(
  administrationSeed: number,
  itemIndex: number,
  questionNumber: number
): number {
  assertUint32(administrationSeed, "Administration seed");
  if (!Number.isInteger(itemIndex) || itemIndex < 0) {
    throw new RangeError("Item index must be a nonnegative integer.");
  }
  if (!Number.isInteger(questionNumber) || questionNumber < 1) {
    throw new RangeError("Question number must be a positive integer.");
  }

  let hash = (administrationSeed ^ 0xa10d10a0) >>> 0;
  for (const value of [itemIndex, questionNumber]) {
    hash ^= value >>> 0;
    hash = Math.imul(hash, 0x01000193) >>> 0;
    hash ^= hash >>> 16;
  }
  return hash >>> 0;
}

function createDeterministicRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function orderAudioOptions(
  item: Item,
  administrationSeed: number,
  itemIndex: number,
  questionNumber: number
): OptionChoice[] {
  const random = createDeterministicRandom(
    deriveAudioOptionOrderSeed(administrationSeed, itemIndex, questionNumber)
  );
  const values = [
    item.CorrectAnswer,
    item.Distractor_1,
    item.Distractor_2,
    item.Distractor_3,
  ];
  for (let index = values.length - 1; index > 0; index -= 1) {
    const selected = Math.floor(random() * (index + 1));
    [values[index], values[selected]] = [values[selected], values[index]];
  }
  return AUDIO_OPTION_KEYS.map((label, index) => ({
    label,
    text: values[index],
  }));
}

export function buildAudioAdministrationAudit(): Record<
  (typeof AUDIO_ADMINISTRATION_AUDIT_FIELDS)[number],
  string | number
> {
  const policy = AUDIO_ADMINISTRATION_POLICY;
  return {
    音声実施規則ID: policy.policyId,
    音声規則の位置づけ: policy.validationStatus,
    音声モード校正状態: policy.constructStatus,
    問題語提示方式: `${policy.questionPromptLanguage}/${policy.questionPromptPresentation}`,
    選択肢提示方式: `${policy.optionLanguage}/${policy.optionPresentation}`,
    選択肢音声提示順: policy.optionPlaybackOrder,
    必須完了再生数: policy.requiredCompletedOptions,
    "音声再生timeout (ms)": policy.playbackFailureTimeoutMs,
    "端末TTS fallback": policy.deviceSpeechSynthesisFallbackAllowed ? "許可" : "禁止",
    "音声資産manifest ID": policy.audioAssetManifestId,
    音声資産manifest算出法: policy.audioAssetManifestAlgorithm,
    "音声資産manifest SHA-256": policy.audioAssetManifestSha256,
    音声資産数: policy.audioAssetCount,
    音声形式: policy.audioEncoding,
    "音声sample rate (Hz)": policy.audioSampleRateHz,
    音声channel数: policy.audioChannels,
    "音声bit rate (bps)": policy.audioBitRateBps,
    音声生成器: policy.generatorFamily,
    音声生成言語: policy.generatorLanguage,
    音声生成slow設定: String(policy.generatorSlow),
    音声生成器version: policy.generatorVersion,
    "音声voice ID": policy.voiceIdentity,
    選択肢順序乱数生成器ID: policy.optionOrderRandomGeneratorId,
    選択肢順序seed導出ID: policy.optionOrderSeedDerivationId,
  };
}
