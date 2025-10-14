let cachedVoice: SpeechSynthesisVoice | null = null;
let voicesInitialized = false;

function resolveVoice(): SpeechSynthesisVoice | null {
  if (cachedVoice) {
    return cachedVoice;
  }

  if (typeof window === "undefined" || !window.speechSynthesis) {
    return null;
  }

  const synth = window.speechSynthesis;
  let voices = synth.getVoices();

  if (!voicesInitialized && voices.length === 0) {
    // Some browsers require accessing getVoices after voiceschanged fires.
    synth.addEventListener("voiceschanged", () => {
      voices = synth.getVoices();
      cachedVoice =
        voices.find((voice) => voice.lang.toLowerCase().startsWith("en")) ??
        voices.find((voice) => voice.lang.toLowerCase().includes("en")) ??
        null;
    });
    voicesInitialized = true;
    voices = synth.getVoices();
  }

  cachedVoice =
    voices.find((voice) => voice.lang.toLowerCase().startsWith("en")) ??
    voices.find((voice) => voice.lang.toLowerCase().includes("en")) ??
    null;

  return cachedVoice;
}

export function speakWord(text: string): boolean {
  if (typeof window === "undefined" || !window.speechSynthesis) {
    return false;
  }

  const synth = window.speechSynthesis;
  const utterance = new SpeechSynthesisUtterance(text);

  const voice = resolveVoice();
  if (voice) {
    utterance.voice = voice;
  } else {
    utterance.lang = "en-US";
  }

  utterance.rate = 0.9;
  utterance.pitch = 1;

  // Cancel any ongoing speech to prevent overlap.
  synth.cancel();
  synth.speak(utterance);

  return true;
}
