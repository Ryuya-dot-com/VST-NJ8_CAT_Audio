import assert from "node:assert/strict";
import test from "node:test";

import type { Item } from "../src/types.ts";
import {
  AUDIO_ADMINISTRATION_AUDIT_FIELDS,
  AUDIO_ADMINISTRATION_POLICY,
  buildAudioAdministrationAudit,
  canStartAudioOption,
  createEmptyAudioPlaybackStatus,
  deriveAudioOptionOrderSeed,
  isAudioResponseReady,
  orderAudioOptions,
} from "../src/utils/audioAdministrationPolicy.ts";

const item: Item = {
  id: 0,
  Level: 1,
  Item: "売り場",
  PartOfSpeech: "noun",
  CorrectAnswer: "department",
  Distractor_1: "boy",
  Distractor_2: "meeting",
  Distractor_3: "town",
  Dscrimination: 1.98,
  Difficulty: -2.38,
  Guessing: 0.13,
};

test("audio policy excludes question-prompt audio and device TTS", () => {
  const policy = AUDIO_ADMINISTRATION_POLICY;
  assert.equal(policy.questionPromptPresentation, "visible-text-no-audio");
  assert.equal(policy.optionPresentation, "hidden-text-offline-mp3");
  assert.equal(policy.optionPlaybackOrder, "A-B-C-D");
  assert.equal(policy.requiredCompletedOptions, 4);
  assert.equal(policy.successfulReplayAllowed, false);
  assert.equal(policy.deviceSpeechSynthesisFallbackAllowed, false);
  assert.equal(policy.playbackFailureTimeoutMs, 15000);
  assert.equal(policy.generatorVersion, "unrecorded");
  assert.equal(policy.voiceIdentity, "unrecorded");
  assert.match(policy.audioAssetManifestSha256, /^[0-9a-f]{64}$/u);
  assert.equal(policy.validationStatus, "research-stimulus-standardized-not-mode-valid");
  assert.equal(Object.isFrozen(policy), true);
});

test("options unlock strictly in A-B-C-D order and responses wait for completion", () => {
  const status = createEmptyAudioPlaybackStatus();
  assert.equal(canStartAudioOption("a", status), true);
  assert.equal(canStartAudioOption("b", status), false);
  assert.equal(isAudioResponseReady(status), false);

  status.a = "playing";
  assert.equal(canStartAudioOption("a", status), false);
  assert.equal(canStartAudioOption("b", status), false);
  status.a = "completed";
  assert.equal(canStartAudioOption("a", status), false);
  assert.equal(canStartAudioOption("b", status), true);

  status.b = "completed";
  status.c = "completed";
  status.d = "failed";
  assert.equal(canStartAudioOption("d", status), true);
  assert.equal(isAudioResponseReady(status), false);
  status.d = "completed";
  assert.equal(isAudioResponseReady(status), true);
  assert.equal(canStartAudioOption("d", status), false);
});

test("option order is reproducible from the administration audit seed", () => {
  const first = orderAudioOptions(item, 20260812, 0, 1);
  assert.deepEqual(orderAudioOptions(item, 20260812, 0, 1), first);
  assert.deepEqual(first, [
    { label: "a", text: "town" },
    { label: "b", text: "meeting" },
    { label: "c", text: "department" },
    { label: "d", text: "boy" },
  ]);
  assert.equal(new Set(first.map(({ text }) => text)).size, 4);
  assert.notEqual(
    deriveAudioOptionOrderSeed(20260812, 0, 1),
    deriveAudioOptionOrderSeed(20260812, 0, 2)
  );
  assert.throws(() => deriveAudioOptionOrderSeed(-1, 0, 1), RangeError);
  assert.throws(() => deriveAudioOptionOrderSeed(1, -1, 1), RangeError);
  assert.throws(() => deriveAudioOptionOrderSeed(1, 0, 0), RangeError);
});

test("audio audit records the complete immutable stimulus contract", () => {
  const audit = buildAudioAdministrationAudit();
  assert.deepEqual(Object.keys(audit), [...AUDIO_ADMINISTRATION_AUDIT_FIELDS]);
  assert.equal(audit["端末TTS fallback"], "禁止");
  assert.equal(audit["音声資産数"], 639);
  assert.equal(
    audit["音声資産manifest SHA-256"],
    "f610cbf2c60a02ec6d3012c8c5827acdc0937bf3572b1c3e6bb6a6943a060772"
  );
});
