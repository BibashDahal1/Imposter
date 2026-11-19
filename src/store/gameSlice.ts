import { createSlice, current, type PayloadAction } from "@reduxjs/toolkit";

import { initialGameState, reduce } from "../engine/game";
import { newSeed } from "../engine/rng";
import type {
  GameConfig,
  GameEvent,
  GameState,
  WordInfo,
} from "../engine/types";

/** Runs one event through the pure rules. The result replaces the state. */
const apply = (s: GameState, e: GameEvent): GameState =>
  reduce(current(s) as GameState, e);

/*
 * Random seeds are created here, when an action is made (prepare),
 * so the reducers themselves stay pure.
 */
const slice = createSlice({
  name: "game",
  initialState: initialGameState,
  reducers: {
    receiveEvent: (s, a: PayloadAction<GameEvent>) => apply(s, a.payload),
    startGame: {
      reducer: (s, a: PayloadAction<{ config: GameConfig; seed: number }>) =>
        apply(s, { type: "START", ...a.payload }),
      prepare: (config: GameConfig) => ({
        payload: { config, seed: newSeed() },
      }),
    },
    wordReady: (s, a: PayloadAction<WordInfo>) =>
      apply(s, { type: "WORD_READY", word: a.payload }),
    briefingReady: (s, a: PayloadAction<string>) =>
      apply(s, { type: "BRIEFING_READY", playerId: a.payload }),
    briefingNext: (s) => apply(s, { type: "BRIEFING_NEXT" }),
    submitClue: (s, a: PayloadAction<string>) =>
      apply(s, { type: "CLUE", text: a.payload }),
    debateDone: (s) => apply(s, { type: "DEBATE_DONE" }),
    castVote: {
      reducer: (
        s,
        a: PayloadAction<{ voterId: string; targets: string[]; seed: number }>,
      ) => apply(s, { type: "VOTE", ...a.payload }),
      prepare: (voterId: string, targets: string[]) => ({
        payload: { voterId, targets, seed: newSeed() },
      }),
    },
    continueGame: {
      reducer: (s, a: PayloadAction<{ seed: number }>) =>
        apply(s, { type: "CONTINUE", seed: a.payload.seed }),
      prepare: () => ({ payload: { seed: newSeed() } }),
    },
    submitGuess: (s, a: PayloadAction<string>) =>
      apply(s, { type: "GUESS", text: a.payload }),
    resetGame: (s) => apply(s, { type: "RESET" }),
  },
});

export const {
  receiveEvent,
  startGame,
  wordReady,
  briefingReady,
  briefingNext,
  submitClue,
  debateDone,
  castVote,
  continueGame,
  submitGuess,
  resetGame,
} = slice.actions;

export default slice.reducer;
