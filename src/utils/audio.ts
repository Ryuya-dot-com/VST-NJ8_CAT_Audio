import {
  AUDIO_ADMINISTRATION_POLICY,
  audioStimulusFilename,
} from "./audioAdministrationPolicy";

const audioCache = new Map<string, HTMLAudioElement>();
let playbackActive = false;

export type AudioPlaybackResult = "completed" | "failed" | "busy";

function getAudioSrc(word: string): string {
  const base = (import.meta.env.BASE_URL ?? "/").replace(/\/?$/, "/");
  return `${base}audio/${audioStimulusFilename(word)}`;
}

export async function playWordAudio(word: string): Promise<AudioPlaybackResult> {
  if (typeof window === "undefined" || typeof Audio === "undefined") {
    return "failed";
  }
  if (playbackActive) {
    return "busy";
  }

  const src = getAudioSrc(word);
  let audio = audioCache.get(src);

  try {
    if (!audio) {
      audio = new Audio(src);
      audio.preload = "auto";
      audioCache.set(src, audio);
    }
    audio.currentTime = 0;
  } catch (error) {
    console.warn(`Failed to prepare audio for "${word}" from ${src}`, error);
    audioCache.delete(src);
    return "failed";
  }
  playbackActive = true;

  return new Promise((resolve) => {
    let settled = false;
    let timeout: number | null = null;
    const finish = (result: AudioPlaybackResult, error?: unknown) => {
      if (settled) return;
      settled = true;
      playbackActive = false;
      if (timeout !== null) window.clearTimeout(timeout);
      audio?.removeEventListener("ended", handleEnded);
      audio?.removeEventListener("error", handleError);
      audio?.removeEventListener("abort", handleAbort);
      if (result === "failed") {
        audio?.pause();
        console.warn(`Failed to play audio for "${word}" from ${src}`, error);
        audioCache.delete(src);
      }
      resolve(result);
    };
    const handleEnded = () => finish("completed");
    const handleError = (event: Event) => finish("failed", event);
    const handleAbort = (event: Event) => finish("failed", event);

    audio.addEventListener("ended", handleEnded, { once: true });
    audio.addEventListener("error", handleError, { once: true });
    audio.addEventListener("abort", handleAbort, { once: true });
    timeout = window.setTimeout(() => {
      finish("failed", new Error("Audio playback timed out."));
    }, AUDIO_ADMINISTRATION_POLICY.playbackFailureTimeoutMs);
    try {
      audio.play().catch((error) => finish("failed", error));
    } catch (error) {
      finish("failed", error);
    }
  });
}
