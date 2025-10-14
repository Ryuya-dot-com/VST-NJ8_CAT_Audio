export interface Item {
  id: number;
  Level: number;
  Item: string;
  PartOfSpeech: string;
  CorrectAnswer: string;
  Distractor_1: string;
  Distractor_2: string;
  Distractor_3: string;
  Dscrimination: number;
  Difficulty: number;
  Guessing: number;
}
export interface AbilityEstimate {
  theta: number;
  se: number;
}

export interface OptionChoice {
  label: string;
  text: string;
}
