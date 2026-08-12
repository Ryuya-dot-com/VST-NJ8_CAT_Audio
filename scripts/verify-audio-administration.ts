import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { basename, resolve } from "node:path";

import {
  AUDIO_ADMINISTRATION_POLICY,
  audioStimulusFilename,
} from "../src/utils/audioAdministrationPolicy.ts";

function sha256(bytes: Buffer | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function assertFrozenMp3Header(bytes: Buffer, filename: string): void {
  assert.ok(bytes.length > 4, `${filename} is empty.`);
  const header = bytes.readUInt32BE(0);
  assert.equal((header >>> 21) & 0x7ff, 0x7ff, `${filename} sync`);
  assert.equal((header >>> 19) & 0x3, 0x2, `${filename} MPEG-2`);
  assert.equal((header >>> 17) & 0x3, 0x1, `${filename} Layer III`);
  assert.equal((header >>> 12) & 0xf, 0x8, `${filename} 64 kbps`);
  assert.equal((header >>> 10) & 0x3, 0x1, `${filename} 24 kHz`);
  assert.equal((header >>> 6) & 0x3, 0x3, `${filename} mono`);
}

const projectRoot = resolve(new URL("..", import.meta.url).pathname);
const appSource = readFileSync(resolve(projectRoot, "src/App.tsx"), "utf8");
const testViewSource = readFileSync(
  resolve(projectRoot, "src/components/TestView.tsx"),
  "utf8"
);
const rows = readFileSync(
  resolve(projectRoot, "public/jacet_parameters.csv"),
  "utf8"
)
  .replace(/^\uFEFF/, "")
  .split(/\r?\n/)
  .filter(Boolean)
  .slice(1);
const expectedWords = rows.flatMap((line) => line.split(",").slice(3, 7));
const expectedFiles = [...new Set(expectedWords.map(audioStimulusFilename))].sort();
const audioDirectory = resolve(projectRoot, "public/audio");
const actualFiles = readdirSync(audioDirectory)
  .filter((name) => name.endsWith(".mp3"))
  .sort();

assert.equal(rows.length, 160);
assert.equal(expectedWords.length, 640);
assert.equal(new Set(expectedWords).size, 639);
assert.deepEqual(actualFiles, expectedFiles);
assert.equal(actualFiles.length, AUDIO_ADMINISTRATION_POLICY.audioAssetCount);

const inventory =
  actualFiles
    .map((filename) => {
      const bytes = readFileSync(resolve(audioDirectory, filename));
      assertFrozenMp3Header(bytes, filename);
      return `${sha256(bytes)}  ${basename(filename)}`;
    })
    .join("\n") + "\n";
assert.equal(
  sha256(inventory),
  AUDIO_ADMINISTRATION_POLICY.audioAssetManifestSha256
);

assert.equal(AUDIO_ADMINISTRATION_POLICY.audioEncoding, "MP3");
assert.equal(AUDIO_ADMINISTRATION_POLICY.audioSampleRateHz, 24000);
assert.equal(AUDIO_ADMINISTRATION_POLICY.audioChannels, 1);
assert.equal(AUDIO_ADMINISTRATION_POLICY.audioBitRateBps, 64000);
assert.equal(AUDIO_ADMINISTRATION_POLICY.generatorFamily, "gTTS");
assert.equal(AUDIO_ADMINISTRATION_POLICY.generatorVersion, "unrecorded");
assert.equal(AUDIO_ADMINISTRATION_POLICY.voiceIdentity, "unrecorded");
assert.equal(
  AUDIO_ADMINISTRATION_POLICY.deviceSpeechSynthesisFallbackAllowed,
  false
);
assert.equal(AUDIO_ADMINISTRATION_POLICY.successfulReplayAllowed, false);
assert.equal(AUDIO_ADMINISTRATION_POLICY.requiredCompletedOptions, 4);
assert.equal(AUDIO_ADMINISTRATION_POLICY.playbackFailureTimeoutMs, 15000);

for (const requiredPattern of [
  /orderAudioOptions/u,
  /isAudioResponseReady/u,
  /canStartAudioOption/u,
  /buildAudioAdministrationAudit/u,
  /result === "completed"/u,
]) {
  assert.match(appSource, requiredPattern);
}
for (const forbiddenPattern of [
  /speakWord/u,
  /speechSynthesis/u,
  /handlePlayQuestionAudio/u,
  /currentItem\.Item\)/u,
]) {
  assert.doesNotMatch(appSource, forbiddenPattern);
}
assert.match(testViewSource, /視覚提示のみ/u);
assert.match(testViewSource, /AからDの順/u);
assert.match(testViewSource, /isAudioResponseReady/u);
assert.doesNotMatch(testViewSource, /この単語を聞く/u);
assert.doesNotMatch(testViewSource, />\{option\.text\}</u);

console.log(
  `Audio administration verified (${AUDIO_ADMINISTRATION_POLICY.policyId}; ${actualFiles.length} assets).`
);
