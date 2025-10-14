import Papa from "papaparse";
import type { ParseResult } from "papaparse";
import type { Item } from "../types";

export async function loadItemBank(): Promise<Item[]> {
  const response = await fetch("/jacet_parameters.csv");
  if (!response.ok) {
    throw new Error("Failed to fetch item bank");
  }

  const csvText = await response.text();

  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, string>>(csvText, {
      header: true,
      skipEmptyLines: true,
      complete: (results: ParseResult<Record<string, string>>) => {
        const data = results.data;
        const items: Item[] = data
          .filter((row) => row.Item)
          .map((row, idx) => ({
            id: idx,
            Level: Number(row.Level),
            Item: row.Item,
            PartOfSpeech: row.PartOfSpeech,
            CorrectAnswer: row.CorrectAnswer,
            Distractor_1: row.Distractor_1,
            Distractor_2: row.Distractor_2,
            Distractor_3: row.Distractor_3,
            Dscrimination: Number(row.Dscrimination),
            Difficulty: Number(row.Difficulty),
            Guessing: Number(row.Guessing),
          }));

        resolve(items);
      },
      error: (error: Error, _file: Papa.LocalFile | string) => {
        reject(error);
      },
    });
  });
}
