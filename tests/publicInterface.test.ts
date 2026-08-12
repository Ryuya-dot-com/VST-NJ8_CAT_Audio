import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const landingSource = readFileSync(
  new URL("../src/components/LandingView.tsx", import.meta.url),
  "utf8"
);
const testSource = readFileSync(
  new URL("../src/components/TestView.tsx", import.meta.url),
  "utf8"
);
const resultsSource = readFileSync(
  new URL("../src/components/ResultsView.tsx", import.meta.url),
  "utf8"
);
const indexHtml = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const indexCss = readFileSync(
  new URL("../src/index.css", import.meta.url),
  "utf8"
);

test("audio instructions describe the implemented presentation order", () => {
  assert.match(landingSource, /日本語の問題語を画面で確認します/u);
  assert.match(landingSource, /英語選択肢をAからDの順に1回ずつ聞きます/u);
  assert.match(testSource, /日本語の問題語（視覚提示のみ）/u);
  assert.match(testSource, /英語の選択肢音声をAからDの順/u);
});

test("the audio examinee interface does not expose item-bank frequency levels", () => {
  assert.doesNotMatch(testSource, /item\.Level/u);
  assert.doesNotMatch(testSource, />Level\s*\{/u);
});

test("audio item-bank part-of-speech codes are localized for examinees", () => {
  assert.match(testSource, /noun: "名詞"/u);
  assert.match(testSource, /verb: "動詞"/u);
  assert.match(testSource, /adjective: "形容詞"/u);
  assert.match(testSource, /adverb: "副詞"/u);
  assert.doesNotMatch(testSource, />\{item\.PartOfSpeech\}</u);
});

test("audio playback controls use a stable text label instead of an emoji", () => {
  assert.match(testSource, />再生<\/span>/u);
  assert.doesNotMatch(testSource, /🔊/u);
});

test("audio UI layout is bundled and does not depend on a third-party CSS CDN", () => {
  assert.match(indexHtml, /<html lang="ja">/u);
  assert.doesNotMatch(indexHtml, /cdnjs|bootstrap/u);
  assert.match(indexCss, /\.container\s*\{/u);
  assert.match(indexCss, /\.row\.g-4 > \.col-md-6/u);
});

test("audio results identify the paper transformation without claiming a zero lower bound", () => {
  assert.match(resultsSource, /VST-NJ8原論文換算/u);
  assert.doesNotMatch(resultsSource, /0–8,000語尺度/u);
});
