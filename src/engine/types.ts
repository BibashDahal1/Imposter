import type { HintLevel, Lang } from "@/content/types";

export type GameStyle = "elimination" | "two-round";
export type ClueInput = "typed" | "spoken";
export type Role = "suspect" | "spy";

/** Everything the rules need to know, copied from the setup screens when the game starts. */
export type GameConfig = {
  /** In seating order. */
  players: { id: string; name: string }[];
  style: GameStyle;
  spies: number;
  clueInput: ClueInput;
  language: Lang;
  packIds: string[];
  hint: HintLevel;
  /** Seconds per clue turn. 0 = no timer. */
  timerSec: number;
  revealOnOut: boolean;
  spiesKnowEachOther: boolean;
  lastChanceGuess: boolean;
};

/** The secret word of a round and the hint the Spy gets. */
export type WordInfo = { id: string; word: string; hint: string };

export type Clue = {
  playerId: string;
  /** empty when clues are spoken */ text: string;
};

export type RoundResult = {
  /** Votes received by each player. */
  tally: Record<string, number>;
  /** Elimination: who is out. null in two-round. */
  outId: string | null;
  /** Elimination: the one voted out. Two-round: the players named as Spies. */
  accused: string[];
  outWasSpy: boolean;
  /** Elimination: the voted-out player was the Spy. Two-round: every Spy was named. */
  spiesCaught: boolean;
  /** A tie was settled by chance. */
  tieBroken: boolean;
};

export type Round = {
  index: number;
  /** The last round of the game. Always true in two-round. */
  isFinal: boolean;
  word: WordInfo | null;
  spyIds: string[];
  /** Players in this round, in seating order. Used for cards and votes. */
  seating: string[];
  /** Players in speaking order for clues. */
  order: string[];
  briefingIdx: number;
  briefingReadyIds: string[];
  clueRound: 1 | 2;
  turnIdx: number;
  clues: Clue[][];
  voterIdx: number;
  ballots: Record<string, string[]>;
  /** After a tie: the players the re-vote is limited to. */
  tiedIds: string[] | null;
  result: RoundResult | null;
};

export type RoundSummary = {
  index: number;
  isFinal: boolean;
  word: string;
  spyIds: string[];
  outId: string | null;
  accused: string[];
  spiesCaught: boolean;
};

export type Outcome = {
  winner: "suspects" | "spies";
  reason: "caught" | "escaped" | "last-chance-correct" | "last-chance-failed";
};

export type Phase =
  | "idle"
  | "needWord"
  | "briefing"
  | "clues"
  | "debate"
  | "vote"
  | "reveal"
  | "lastChance"
  | "gameOver";

export type Guess = { spyId: string; guess: string; correct: boolean };

export type GameState = {
  phase: Phase;
  config: GameConfig | null;
  /** Players still at the table, in seating order. */
  alive: string[];
  round: Round | null;
  history: RoundSummary[];
  /** Spies of the previous round (they are not picked again straight away). */
  lastSpyIds: string[];
  guesses: Guess[];
  guessIdx: number;
  outcome: Outcome | null;
  /** Goes up by one for every new game. */
  gameNo: number;
};

export type GameEvent =
  | { type: "START"; config: GameConfig; seed: number }
  | { type: "WORD_READY"; word: WordInfo }
  | { type: "BRIEFING_READY"; playerId: string }
  | { type: "BRIEFING_NEXT" }
  | { type: "CLUE"; text: string }
  | { type: "DEBATE_DONE" }
  | { type: "VOTE"; voterId: string; targets: string[]; seed: number }
  | { type: "CONTINUE"; seed: number }
  | { type: "GUESS"; text: string }
  | { type: "RESET" };
