const audioCache = new Map<string, HTMLAudioElement>();

function slugify(word: string): string {
  return word
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "audio";
}

function getAudioSrc(word: string): string {
  const base = (import.meta.env.BASE_URL ?? "/").replace(/\/?$/, "/");
  return `${base}audio/${slugify(word)}.mp3`;
}

export async function playWordAudio(word: string): Promise<boolean> {
  if (typeof window === "undefined" || typeof Audio === "undefined") {
    return false;
  }

  const src = getAudioSrc(word);
  let audio = audioCache.get(src);

  if (!audio) {
    audio = new Audio(src);
    audio.preload = "auto";
    audioCache.set(src, audio);
  } else {
    audio.pause();
    audio.currentTime = 0;
  }

  try {
    await audio.play();
    return true;
  } catch (error) {
    console.warn(`Failed to play audio for "${word}" from ${src}`, error);
    audioCache.delete(src);
    return false;
  }
}
