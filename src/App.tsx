import { useEffect, useMemo, useState } from "react";
import { utils, writeFile } from "xlsx";
import "./App.css";
import { LandingView } from "./components/LandingView";
import { ResultsView } from "./components/ResultsView";
import { TestView } from "./components/TestView";
import type { Item, OptionChoice } from "./types";
import { estimateAbilityEap, selectNextItem, vocabFromTheta } from "./utils/cat";
import { loadItemBank } from "./utils/data";
import { shuffleArray } from "./utils/random";
import { playWordAudio } from "./utils/audio";
import { speakWord } from "./utils/speech";

const TOTAL_ITEMS = 30;

function pickInitialItemIndex(itemBank: Item[]): number | null {
  const candidates = itemBank
    .map((item, idx) => ({ item, idx }))
    .filter(({ item }) => item.Level >= 3 && item.Level <= 5);

  if (candidates.length === 0) {
    return itemBank.length > 0 ? 0 : null;
  }

  const randomCandidate =
    candidates[Math.floor(Math.random() * candidates.length)];
  return randomCandidate?.idx ?? null;
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
  const [responseTimes, setResponseTimes] = useState<number[]>([]);
  const [theta, setTheta] = useState(0);
  const [se, setSe] = useState(Number.POSITIVE_INFINITY);
  const [currentIndex, setCurrentIndex] = useState<number | null>(null);
  const [questionStartMs, setQuestionStartMs] = useState<number | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

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
  }, [currentItem?.id]);

  const progressPct = Math.min(
    100,
    Math.round((administered.length / TOTAL_ITEMS) * 100)
  );

  const correctAnswers = responses.reduce<number>((acc, value) => acc + value, 0);
  const accuracy =
    responses.length > 0 ? (correctAnswers / responses.length) * 100 : 0;
  const vocabSize = vocabFromTheta(theta);
  const totalTimeSeconds = responseTimes.reduce((acc, value) => acc + value, 0);
  const averageTimeSeconds =
    responseTimes.length > 0 ? totalTimeSeconds / responseTimes.length : 0;

  const handleStart = () => {
    if (loading || itemBank.length === 0) {
      return;
    }
    const initialIndex = pickInitialItemIndex(itemBank);
    if (initialIndex === null) {
      setError("No items available to start the test.");
      return;
    }

    setStarted(true);
    setDone(false);
    setAdministered([]);
    setResponses([]);
    setResponseTimes([]);
    setTheta(0);
    setSe(Number.POSITIVE_INFINITY);
    setCurrentIndex(initialIndex);
    setQuestionStartMs(Date.now());
  };

  const handleAnswer = (optionText: string) => {
    if (
      !currentItem ||
      currentIndex === null ||
      done ||
      isProcessing ||
      questionStartMs === null
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
    const nextTimes = [...responseTimes, roundedTime];
    setAdministered(nextAdministered);
    setResponses(nextResponses);
    setResponseTimes(nextTimes);

    const estimate = estimateAbilityEap(
      itemBank,
      nextAdministered,
      nextResponses
    );
    setTheta(estimate.theta);
    setSe(estimate.se);

    const highCount = nextAdministered.filter(
      (idx) => itemBank[idx]?.Level >= 7
    ).length;
    const needHigh = highCount < 2;
    const shouldContinue =
      (estimate.se > 0.4 || nextAdministered.length < 20 || needHigh) &&
      nextAdministered.length < TOTAL_ITEMS;

    if (shouldContinue) {
      const nextIndex = selectNextItem(
        itemBank,
        estimate.theta,
        nextAdministered,
        needHigh
      );
      if (nextIndex === null) {
        setDone(true);
        setCurrentIndex(null);
        setQuestionStartMs(null);
      } else {
        setCurrentIndex(nextIndex);
        setQuestionStartMs(Date.now());
      }
    } else {
      setDone(true);
      setCurrentIndex(null);
      setQuestionStartMs(null);
    }

    setIsProcessing(false);
  };

  const handlePlayAudio = (text: string) => {
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

  const handleDownload = () => {
    const responsesSheet = administered.map((idx, i) => {
      const item = itemBank[idx];
      const isCorrect = responses[i] === 1;
      const timeSeconds = responseTimes[i] ?? null;
      return {
        item_id: idx + 1,
        word: item.Item,
        level: item.Level,
        response: responses[i],
        correct: isCorrect ? "正解" : "不正解",
        time_seconds: timeSeconds,
      };
    });

    const summarySheet = [
      {
        test_taker_name: userName,
        theta,
        standard_error: se,
        vocabulary_size: vocabSize,
        total_items: administered.length,
        correct_answers: correctAnswers,
        accuracy: Math.round(accuracy * 10) / 10,
        total_time_seconds: Number(totalTimeSeconds.toFixed(2)),
        average_time_seconds: Number(averageTimeSeconds.toFixed(2)),
      },
    ];

    const workbook = utils.book_new();
    const summaryWorksheet = utils.json_to_sheet(summarySheet);
    const responsesWorksheet = utils.json_to_sheet(responsesSheet);
    utils.book_append_sheet(workbook, summaryWorksheet, "Summary");
    utils.book_append_sheet(workbook, responsesWorksheet, "Responses");

    const today = new Date().toISOString().slice(0, 10);
    writeFile(workbook, `jacet_cat_result_${today}.xlsx`);
  };

  const handleRestart = () => {
    setStarted(false);
    setDone(false);
    setAdministered([]);
    setResponses([]);
    setResponseTimes([]);
    setTheta(0);
    setSe(Number.POSITIVE_INFINITY);
    setCurrentIndex(null);
    setQuestionStartMs(null);
    setIsProcessing(false);
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
        theta={theta}
        se={se}
        vocabSize={Math.round(vocabSize)}
        totalItems={administered.length}
        correctAnswers={correctAnswers}
        accuracy={Math.round(accuracy * 10) / 10}
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
      onPlayAudio={handlePlayAudio}
      isProcessing={isProcessing}
    />
  );
}

export default App;
