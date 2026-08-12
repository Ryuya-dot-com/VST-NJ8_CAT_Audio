import { useEffect, useMemo, useRef, useState } from "react";
import { utils, writeFile } from "xlsx";
import "./App.css";
import { LandingView } from "./components/LandingView";
import { ResultsView } from "./components/ResultsView";
import { TestView } from "./components/TestView";
import type { Item, OptionChoice } from "./types";
import { loadItemBank } from "./utils/data";
import { estimatePaperPosteriorEap } from "./utils/paperScoring";
import { shuffleArray } from "./utils/random";
import { playWordAudio } from "./utils/audio";
import { speakWord } from "./utils/speech";
import {
  RESEARCH_ADMINISTRATION_AUDIT_FIELDS,
  RESEARCH_ADMINISTRATION_POLICY,
  buildResearchAdministrationAudit,
  createResearchAdministrationRandom,
  createResearchAdministrationSeed,
  selectInitialResearchItem,
  selectNextResearchItem,
  shouldContinueResearchAdministration,
  type ResearchStopReason,
} from "./utils/researchAdministrationPolicy";
import {
  PUBLIC_OBSERVED_RESULT_FIELDS,
  assertPublicResultFieldsAllowed,
  buildPublicObservedResult,
} from "./utils/scoreReportingPolicy";

const TOTAL_ITEMS = RESEARCH_ADMINISTRATION_POLICY.fixedLength;
const TEST_LABEL = "音声版";
type DownloadStatus = "idle" | "success" | "error";
type OptionKey = "a" | "b" | "c" | "d";

const PUBLIC_SUMMARY_FIELDS = Object.freeze([
  ...PUBLIC_OBSERVED_RESULT_FIELDS,
  ...RESEARCH_ADMINISTRATION_AUDIT_FIELDS,
  "総回答時間（秒）",
  "平均回答時間（秒）",
  "A選択数",
  "B選択数",
  "C選択数",
  "D選択数",
  "問題語音声再生合計",
  "選択肢音声再生合計",
  "選択肢A音声再生合計",
  "選択肢B音声再生合計",
  "選択肢C音声再生合計",
  "選択肢D音声再生合計",
]);

const PUBLIC_RESPONSE_FIELDS = Object.freeze([
  "問題番号",
  "項目ID",
  "単語",
  "品詞",
  "レベル",
  "選択ラベル",
  "選択回答",
  "正答",
  "正誤",
  "回答値",
  "回答時刻",
  "回答時間（秒）",
  "選択肢A",
  "選択肢B",
  "選択肢C",
  "選択肢D",
  "問題語音声再生回数",
  "選択肢A音声再生回数",
  "選択肢B音声再生回数",
  "選択肢C音声再生回数",
  "選択肢D音声再生回数",
  "音声再生総回数",
]);

interface AudioPlayCounts {
  question: number;
  a: number;
  b: number;
  c: number;
  d: number;
}

interface ResultSnapshot {
  administered: number[];
  responses: (0 | 1)[];
  selectedLabels: string[];
  selectedAnswers: string[];
  optionOrders: OptionChoice[][];
  responseTimes: number[];
  answerTimestamps: string[];
  audioPlayCounts: AudioPlayCounts[];
  administrationSeed: number;
  stopReason: ResearchStopReason;
  testStartedAtMs: number | null;
  testEndedAtMs: number | null;
}

function roundFinite(value: number, digits: number): number | null {
  return Number.isFinite(value) ? Number(value.toFixed(digits)) : null;
}

function formatTimestampForFilename(date: Date): string {
  const pad = (value: number) => value.toString().padStart(2, "0");
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    "_",
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join("");
}

function createEmptyAudioPlayCounts(): AudioPlayCounts {
  return {
    question: 0,
    a: 0,
    b: 0,
    c: 0,
    d: 0,
  };
}

function isOptionKey(value: string): value is OptionKey {
  return value === "a" || value === "b" || value === "c" || value === "d";
}

function countSelectedLabels(labels: string[]) {
  return {
    A: labels.filter((label) => label === "A").length,
    B: labels.filter((label) => label === "B").length,
    C: labels.filter((label) => label === "C").length,
    D: labels.filter((label) => label === "D").length,
  };
}

function sumAudioPlayCounts(counts: AudioPlayCounts[]): AudioPlayCounts {
  return counts.reduce<AudioPlayCounts>(
    (acc, value) => ({
      question: acc.question + value.question,
      a: acc.a + value.a,
      b: acc.b + value.b,
      c: acc.c + value.c,
      d: acc.d + value.d,
    }),
    createEmptyAudioPlayCounts()
  );
}

function getOptionText(optionOrder: OptionChoice[], label: OptionKey): string {
  return optionOrder.find((option) => option.label === label)?.text ?? "";
}

function App() {
  const [itemBank, setItemBank] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userName, setUserName] = useState("");
  const [started, setStarted] = useState(false);
  const [done, setDone] = useState(false);
  const [administered, setAdministered] = useState<number[]>([]);
  const [responses, setResponses] = useState<(0 | 1)[]>([]);
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);
  const [selectedAnswers, setSelectedAnswers] = useState<string[]>([]);
  const [optionOrders, setOptionOrders] = useState<OptionChoice[][]>([]);
  const [responseTimes, setResponseTimes] = useState<number[]>([]);
  const [answerTimestamps, setAnswerTimestamps] = useState<string[]>([]);
  const [audioPlayCountsHistory, setAudioPlayCountsHistory] = useState<
    AudioPlayCounts[]
  >([]);
  const [currentIndex, setCurrentIndex] = useState<number | null>(null);
  const [questionStartMs, setQuestionStartMs] = useState<number | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [downloadStatus, setDownloadStatus] = useState<DownloadStatus>("idle");
  const [testStartedAtMs, setTestStartedAtMs] = useState<number | null>(null);
  const [testEndedAtMs, setTestEndedAtMs] = useState<number | null>(null);
  const [administrationSeed, setAdministrationSeed] = useState<number | null>(null);
  const [stopReason, setStopReason] = useState<ResearchStopReason | null>(null);
  const selectionRandomRef = useRef<(() => number) | null>(null);
  const currentAudioPlayCountsRef = useRef<AudioPlayCounts>(
    createEmptyAudioPlayCounts()
  );

  useEffect(() => {
    let isMounted = true;
    loadItemBank()
      .then((items) => {
        if (isMounted) {
          setItemBank(items);
        }
      })
      .catch((err: Error) => {
        console.error(err);
        if (isMounted) {
          setError(err.message);
        }
      })
      .finally(() => {
        if (isMounted) {
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!started || done) {
      return;
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [started, done]);

  const currentItem = useMemo(
    () => (currentIndex !== null ? itemBank[currentIndex] : null),
    [currentIndex, itemBank]
  );

  const optionChoices = useMemo<OptionChoice[]>(() => {
    if (!currentItem) {
      return [];
    }
    const shuffled = shuffleArray([
      currentItem.CorrectAnswer,
      currentItem.Distractor_1,
      currentItem.Distractor_2,
      currentItem.Distractor_3,
    ]);
    const labels = ["a", "b", "c", "d"];
    return shuffled.map((text, idx) => ({
      label: labels[idx] ?? "?",
      text,
    }));
  }, [currentItem]);

  const progressPct = Math.min(
    100,
    Math.round((administered.length / TOTAL_ITEMS) * 100)
  );

  const correctAnswers = responses.reduce<number>((acc, value) => acc + value, 0);
  const accuracy =
    responses.length > 0 ? (correctAnswers / responses.length) * 100 : 0;
  const handleStart = () => {
    if (loading || itemBank.length === 0) {
      return;
    }
    const seed = createResearchAdministrationSeed();
    const selectionRandom = createResearchAdministrationRandom(seed);
    const initialIndex = selectInitialResearchItem(itemBank, selectionRandom);

    const startedAt = Date.now();
    selectionRandomRef.current = selectionRandom;
    currentAudioPlayCountsRef.current = createEmptyAudioPlayCounts();

    setStarted(true);
    setDone(false);
    setAdministered([]);
    setResponses([]);
    setSelectedLabels([]);
    setSelectedAnswers([]);
    setOptionOrders([]);
    setResponseTimes([]);
    setAnswerTimestamps([]);
    setAudioPlayCountsHistory([]);
    setCurrentIndex(initialIndex);
    setQuestionStartMs(startedAt);
    setDownloadStatus("idle");
    setTestStartedAtMs(startedAt);
    setTestEndedAtMs(null);
    setAdministrationSeed(seed);
    setStopReason(null);
  };

  const handleAnswer = (selectedLabel: string, optionText: string) => {
    if (
      !currentItem ||
      currentIndex === null ||
      done ||
      isProcessing ||
      questionStartMs === null ||
      administrationSeed === null ||
      selectionRandomRef.current === null
    ) {
      return;
    }

    setIsProcessing(true);
    const now = Date.now();
    const timeSpentSeconds = Math.max(0, (now - questionStartMs) / 1000);
    const roundedTime = Number(timeSpentSeconds.toFixed(2));

    const isCorrect: 0 | 1 = optionText === currentItem.CorrectAnswer ? 1 : 0;
    const nextAdministered = [...administered, currentIndex];
    const nextResponses = [...responses, isCorrect];
    const nextSelectedLabels = [
      ...selectedLabels,
      selectedLabel.toUpperCase(),
    ];
    const nextSelectedAnswers = [...selectedAnswers, optionText];
    const nextOptionOrders = [
      ...optionOrders,
      optionChoices.map((option) => ({ ...option })),
    ];
    const nextTimes = [...responseTimes, roundedTime];
    const nextAnswerTimestamps = [
      ...answerTimestamps,
      new Date(now).toLocaleString("ja-JP"),
    ];
    const nextAudioPlayCountsHistory = [
      ...audioPlayCountsHistory,
      { ...currentAudioPlayCountsRef.current },
    ];
    setAdministered(nextAdministered);
    setResponses(nextResponses);
    setSelectedLabels(nextSelectedLabels);
    setSelectedAnswers(nextSelectedAnswers);
    setOptionOrders(nextOptionOrders);
    setResponseTimes(nextTimes);
    setAnswerTimestamps(nextAnswerTimestamps);
    setAudioPlayCountsHistory(nextAudioPlayCountsHistory);

    const estimate = estimatePaperPosteriorEap(
      itemBank,
      nextAdministered,
      nextResponses
    );
    const shouldContinue = shouldContinueResearchAdministration(
      nextAdministered.length
    );

    if (shouldContinue) {
      const nextIndex = selectNextResearchItem(
        itemBank,
        estimate.theta,
        nextAdministered,
        selectionRandomRef.current
      );
      if (nextIndex === null) {
        const finalStopReason: ResearchStopReason = "item-bank-exhausted";
        const nextSnapshot: ResultSnapshot = {
          administered: nextAdministered,
          responses: nextResponses,
          selectedLabels: nextSelectedLabels,
          selectedAnswers: nextSelectedAnswers,
          optionOrders: nextOptionOrders,
          responseTimes: nextTimes,
          answerTimestamps: nextAnswerTimestamps,
          audioPlayCounts: nextAudioPlayCountsHistory,
          administrationSeed,
          stopReason: finalStopReason,
          testStartedAtMs,
          testEndedAtMs: now,
        };
        setDone(true);
        setStopReason(finalStopReason);
        setTestEndedAtMs(now);
        setCurrentIndex(null);
        setQuestionStartMs(null);
        downloadResultWorkbook(nextSnapshot);
      } else {
        currentAudioPlayCountsRef.current = createEmptyAudioPlayCounts();
        setCurrentIndex(nextIndex);
        setQuestionStartMs(Date.now());
      }
    } else {
      const finalStopReason: ResearchStopReason = "fixed-length";
      const nextSnapshot: ResultSnapshot = {
        administered: nextAdministered,
        responses: nextResponses,
        selectedLabels: nextSelectedLabels,
        selectedAnswers: nextSelectedAnswers,
        optionOrders: nextOptionOrders,
        responseTimes: nextTimes,
        answerTimestamps: nextAnswerTimestamps,
        audioPlayCounts: nextAudioPlayCountsHistory,
        administrationSeed,
        stopReason: finalStopReason,
        testStartedAtMs,
        testEndedAtMs: now,
      };
      setDone(true);
      setStopReason(finalStopReason);
      setTestEndedAtMs(now);
      setCurrentIndex(null);
      setQuestionStartMs(null);
      downloadResultWorkbook(nextSnapshot);
    }

    setIsProcessing(false);
  };

  const playAudioText = (text: string) => {
    const fallbackToSpeech = () => {
      const success = speakWord(text);
      if (!success) {
        console.warn("Speech synthesis is not supported in this browser.");
      }
    };

    playWordAudio(text)
      .then((played) => {
        if (!played) {
          fallbackToSpeech();
        }
      })
      .catch((error) => {
        console.error("Audio playback failed, falling back to speech synthesis.", error);
        fallbackToSpeech();
      });
  };

  const handlePlayQuestionAudio = () => {
    if (!currentItem || isProcessing) {
      return;
    }

    currentAudioPlayCountsRef.current = {
      ...currentAudioPlayCountsRef.current,
      question: currentAudioPlayCountsRef.current.question + 1,
    };
    playAudioText(currentItem.Item);
  };

  const handlePlayOptionAudio = (label: string, text: string) => {
    if (isProcessing) {
      return;
    }

    const optionKey = label.toLowerCase();
    if (isOptionKey(optionKey)) {
      currentAudioPlayCountsRef.current = {
        ...currentAudioPlayCountsRef.current,
        [optionKey]: currentAudioPlayCountsRef.current[optionKey] + 1,
      };
    }
    playAudioText(text);
  };

  const downloadResultWorkbook = (snapshot: ResultSnapshot) => {
    const snapshotCorrectAnswers = snapshot.responses.reduce<number>(
      (acc, value) => acc + value,
      0
    );
    const snapshotAccuracy =
      snapshot.responses.length > 0
        ? (snapshotCorrectAnswers / snapshot.responses.length) * 100
        : 0;
    const snapshotTotalTimeSeconds = snapshot.responseTimes.reduce(
      (acc, value) => acc + value,
      0
    );
    const snapshotAverageTimeSeconds =
      snapshot.responseTimes.length > 0
        ? snapshotTotalTimeSeconds / snapshot.responseTimes.length
        : 0;
    const selectedLabelCounts = countSelectedLabels(snapshot.selectedLabels);
    const audioPlayTotals = sumAudioPlayCounts(snapshot.audioPlayCounts);
    const totalOptionAudioPlays =
      audioPlayTotals.a + audioPlayTotals.b + audioPlayTotals.c + audioPlayTotals.d;
    const createdAt = new Date();

    const responsesSheet = snapshot.administered.map((idx, i) => {
      const item = itemBank[idx];
      const isCorrect = snapshot.responses[i] === 1;
      const timeSeconds = snapshot.responseTimes[i] ?? null;
      const optionOrder = snapshot.optionOrders[i] ?? [];
      const audioCounts =
        snapshot.audioPlayCounts[i] ?? createEmptyAudioPlayCounts();
      return {
        問題番号: i + 1,
        項目ID: idx + 1,
        単語: item.Item,
        品詞: item.PartOfSpeech || "",
        レベル: item.Level,
        選択ラベル: snapshot.selectedLabels[i] ?? "",
        選択回答: snapshot.selectedAnswers[i] ?? "",
        正答: item.CorrectAnswer,
        正誤: isCorrect ? "正解" : "不正解",
        回答値: snapshot.responses[i],
        回答時刻: snapshot.answerTimestamps[i] ?? "",
        "回答時間（秒）": timeSeconds,
        選択肢A: getOptionText(optionOrder, "a"),
        選択肢B: getOptionText(optionOrder, "b"),
        選択肢C: getOptionText(optionOrder, "c"),
        選択肢D: getOptionText(optionOrder, "d"),
        問題語音声再生回数: audioCounts.question,
        選択肢A音声再生回数: audioCounts.a,
        選択肢B音声再生回数: audioCounts.b,
        選択肢C音声再生回数: audioCounts.c,
        選択肢D音声再生回数: audioCounts.d,
        音声再生総回数:
          audioCounts.question + audioCounts.a + audioCounts.b + audioCounts.c + audioCounts.d,
      };
    });

    const summarySheet = [
      {
        ...buildPublicObservedResult({
          testLabel: TEST_LABEL,
          userName,
          startedAt: snapshot.testStartedAtMs
            ? new Date(snapshot.testStartedAtMs).toLocaleString("ja-JP")
            : "",
          endedAt: snapshot.testEndedAtMs
            ? new Date(snapshot.testEndedAtMs).toLocaleString("ja-JP")
            : createdAt.toLocaleString("ja-JP"),
          administeredItems: snapshot.administered.length,
          correctAnswers: snapshotCorrectAnswers,
          accuracyPercent: roundFinite(snapshotAccuracy, 1),
        }),
        ...buildResearchAdministrationAudit(
          snapshot.administrationSeed,
          snapshot.stopReason
        ),
        "総回答時間（秒）": roundFinite(snapshotTotalTimeSeconds, 2),
        "平均回答時間（秒）": roundFinite(snapshotAverageTimeSeconds, 2),
        A選択数: selectedLabelCounts.A,
        B選択数: selectedLabelCounts.B,
        C選択数: selectedLabelCounts.C,
        D選択数: selectedLabelCounts.D,
        問題語音声再生合計: audioPlayTotals.question,
        選択肢音声再生合計: totalOptionAudioPlays,
        選択肢A音声再生合計: audioPlayTotals.a,
        選択肢B音声再生合計: audioPlayTotals.b,
        選択肢C音声再生合計: audioPlayTotals.c,
        選択肢D音声再生合計: audioPlayTotals.d,
      },
    ];
    assertPublicResultFieldsAllowed(summarySheet, PUBLIC_SUMMARY_FIELDS);
    assertPublicResultFieldsAllowed(responsesSheet, PUBLIC_RESPONSE_FIELDS);

    try {
      const workbook = utils.book_new();
      const summaryWorksheet = utils.json_to_sheet(summarySheet);
      const responsesWorksheet = utils.json_to_sheet(responsesSheet);
      summaryWorksheet["!cols"] = [
        { wch: 14 },
        { wch: 18 },
        { wch: 22 },
        { wch: 22 },
        { wch: 12 },
        { wch: 12 },
        { wch: 16 },
        { wch: 10 },
        { wch: 10 },
        { wch: 12 },
        { wch: 16 },
        { wch: 18 },
        { wch: 10 },
        { wch: 10 },
        { wch: 10 },
        { wch: 10 },
        { wch: 18 },
        { wch: 18 },
        { wch: 20 },
        { wch: 20 },
        { wch: 20 },
        { wch: 20 },
      ];
      responsesWorksheet["!cols"] = [
        { wch: 10 },
        { wch: 10 },
        { wch: 20 },
        { wch: 12 },
        { wch: 10 },
        { wch: 10 },
        { wch: 20 },
        { wch: 20 },
        { wch: 10 },
        { wch: 10 },
        { wch: 20 },
        { wch: 14 },
        { wch: 20 },
        { wch: 20 },
        { wch: 20 },
        { wch: 20 },
        { wch: 18 },
        { wch: 20 },
        { wch: 20 },
        { wch: 20 },
        { wch: 20 },
        { wch: 16 },
      ];
      utils.book_append_sheet(workbook, summaryWorksheet, "概要");
      utils.book_append_sheet(workbook, responsesWorksheet, "回答履歴");

      const timestamp = formatTimestampForFilename(createdAt);
      writeFile(workbook, `jacet_cat_audio_result_${timestamp}.xlsx`);
      setDownloadStatus("success");
    } catch (error) {
      console.error("Failed to download result workbook.", error);
      setDownloadStatus("error");
    }
  };

  const handleDownload = () => {
    if (administrationSeed === null || stopReason === null) {
      setDownloadStatus("error");
      return;
    }
    downloadResultWorkbook({
      administered,
      responses,
      selectedLabels,
      selectedAnswers,
      optionOrders,
      responseTimes,
      answerTimestamps,
      audioPlayCounts: audioPlayCountsHistory,
      administrationSeed,
      stopReason,
      testStartedAtMs,
      testEndedAtMs,
    });
  };

  const handleRestart = () => {
    setStarted(false);
    setDone(false);
    setAdministered([]);
    setResponses([]);
    setSelectedLabels([]);
    setSelectedAnswers([]);
    setOptionOrders([]);
    setResponseTimes([]);
    setAnswerTimestamps([]);
    setAudioPlayCountsHistory([]);
    setCurrentIndex(null);
    setQuestionStartMs(null);
    setIsProcessing(false);
    setDownloadStatus("idle");
    setTestStartedAtMs(null);
    setTestEndedAtMs(null);
    setAdministrationSeed(null);
    setStopReason(null);
    selectionRandomRef.current = null;
    currentAudioPlayCountsRef.current = createEmptyAudioPlayCounts();
  };

  if (!started) {
    return (
      <LandingView
        name={userName}
        onNameChange={setUserName}
        onStart={handleStart}
        loading={loading}
        error={error}
      />
    );
  }

  if (done) {
    return (
      <ResultsView
        userName={userName}
        totalItems={administered.length}
        correctAnswers={correctAnswers}
        accuracy={Math.round(accuracy * 10) / 10}
        downloadStatus={downloadStatus}
        onDownload={handleDownload}
        onRestart={handleRestart}
      />
    );
  }

  if (!currentItem) {
    return null;
  }

  return (
    <TestView
      item={currentItem}
      questionNumber={administered.length + 1}
      totalQuestions={TOTAL_ITEMS}
      progressPct={progressPct}
      options={optionChoices}
      onSelect={handleAnswer}
      onPlayQuestionAudio={handlePlayQuestionAudio}
      onPlayOptionAudio={handlePlayOptionAudio}
      isProcessing={isProcessing}
    />
  );
}

export default App;
