import { createSlice, nanoid, type PayloadAction } from "@reduxjs/toolkit";

import { PACKS } from "@/content/manifest";
import type { HintLevel, Lang } from "@/content/types";

export type GameStyle = "elimination" | "two-round";
export type ClueInput = "typed" | "spoken";
export type Player = { id: string; name: string };
export type SetupHint = HintLevel | "random";

export type SetupState = {
  players: Player[];
  style: GameStyle;
  spies: number;
  clueInput: ClueInput;
  language: Lang;
  packIds: string[];
  hint: SetupHint;
  /** Seconds for each clue and debate turn. 0 means no timer. */
  timerSec: number;
  /** Elimination only: show a player's role when they are voted out. */
  revealOnOut: boolean;
  /** With two or more Spies: do they know each other? */
  spiesKnowEachOther: boolean;
  /** Two-round only: a caught Spy gets one guess at the secret word. */
  lastChanceGuess: boolean;
};

export const MAX_PLAYERS = 12;
export const TIMERS = [0, 30, 45, 60, 90] as const;

/** Elimination needs one more player, so a final round of 3 can still happen. */
export const minPlayers = (style: GameStyle) =>
  style === "elimination" ? 4 : 3;
/** At least two Suspects must remain. */
export const maxSpies = (players: number) => Math.max(1, players - 2);
/** About one Spy for every three players. */
export const recommendedSpies = (players: number) =>
  Math.max(1, Math.floor((players - 1) / 3));

export const normalizeName = (raw: string) =>
  raw.trim().replace(/\s+/g, " ").slice(0, 16);
/** The names the game will use. A blank name becomes "Player 3" and so on. */
export const finalNames = (players: Player[]) =>
  players.map((p, i) => normalizeName(p.name) || `Player ${i + 1}`);

export const initialState: SetupState = {
  players: [1, 2, 3, 4].map((n) => ({ id: `p${n}`, name: "" })),
  style: "elimination",
  spies: 1,
  clueInput: "spoken",
  language: "en",
  packIds: PACKS.map((p) => p.id),
  hint: "normal",
  timerSec: 60,
  revealOnOut: true,
  spiesKnowEachOther: true,
  lastChanceGuess: false,
};

/** Problems with the list of players. */
export function playerErrors(s: SetupState): string[] {
  const errors: string[] = [];
  const need = minPlayers(s.style);
  if (s.players.length < need) {
    errors.push(
      `${s.style === "elimination" ? "Elimination" : "Two-round"} needs at least ${need} players.`,
    );
  }
  const seen = new Map<string, string>();
  for (const name of finalNames(s.players)) {
    const key = name.toLocaleLowerCase();
    if (seen.has(key)) {
      errors.push(
        `Two players are called "${seen.get(key)}". Give each player a different name.`,
      );
      break;
    }
    seen.set(key, name);
  }
  return errors;
}

/** Problems with the game options. */
export function optionErrors(s: SetupState): string[] {
  const errors: string[] = [];
  if (s.packIds.length === 0) errors.push("Pick at least one word pack.");
  else if (
    !s.packIds.some((id) =>
      PACKS.find((p) => p.id === id)?.langs.includes(s.language),
    )
  ) {
    errors.push("None of the chosen packs has words in this language.");
  }
  if (s.spies < 1 || s.spies > maxSpies(s.players.length)) {
    errors.push(`Choose between 1 and ${maxSpies(s.players.length)} Spies.`);
  }
  return errors;
}

export function validate(s: SetupState) {
  const errors = [...playerErrors(s), ...optionErrors(s)];
  const warnings: string[] = [];
  if (s.spies > recommendedSpies(s.players.length)) {
    warnings.push(
      `That is a lot of Spies for ${s.players.length} players. About ${recommendedSpies(s.players.length)} works best.`,
    );
  }
  return { ok: errors.length === 0, errors, warnings };
}

const clampSpies = (s: SetupState) => {
  s.spies = Math.min(
    Math.max(1, Math.round(s.spies)),
    maxSpies(s.players.length),
  );
};

const slice = createSlice({
  name: "setup",
  initialState,
  reducers: {
    setName(s, a: PayloadAction<{ id: string; name: string }>) {
      const p = s.players.find((x) => x.id === a.payload.id);
      if (p) p.name = a.payload.name.slice(0, 16);
    },
    addPlayer: {
      reducer(s, a: PayloadAction<{ id: string }>) {
        if (s.players.length < MAX_PLAYERS)
          s.players.push({ id: a.payload.id, name: "" });
      },
      prepare: () => ({ payload: { id: nanoid(8) } }),
    },
    removePlayer(s, a: PayloadAction<string>) {
      if (s.players.length > 3)
        s.players = s.players.filter((p) => p.id !== a.payload);
      clampSpies(s);
    },
    setStyle(s, a: PayloadAction<GameStyle>) {
      s.style = a.payload;
    },
    setSpies(s, a: PayloadAction<number>) {
      s.spies = a.payload;
      clampSpies(s);
    },
    setClueInput(s, a: PayloadAction<ClueInput>) {
      s.clueInput = a.payload;
    },
    setLanguage(s, a: PayloadAction<Lang>) {
      s.language = a.payload;
    },
    togglePack(s, a: PayloadAction<string>) {
      s.packIds = s.packIds.includes(a.payload)
        ? s.packIds.filter((id) => id !== a.payload)
        : [...s.packIds, a.payload];
    },
    selectAllPacks(s) {
      s.packIds = PACKS.map((p) => p.id);
    },
    setHint(s, a: PayloadAction<SetupHint>) {
      s.hint = a.payload;
    },
    setTimer(s, a: PayloadAction<number>) {
      s.timerSec = a.payload;
    },
    setRevealOnOut(s, a: PayloadAction<boolean>) {
      s.revealOnOut = a.payload;
    },
    setSpiesKnowEachOther(s, a: PayloadAction<boolean>) {
      s.spiesKnowEachOther = a.payload;
    },
    setLastChanceGuess(s, a: PayloadAction<boolean>) {
      s.lastChanceGuess = a.payload;
    },
    /** Replaces saved values. The caller must pass only checked values (see persist.ts). */
    hydrate(s, a: PayloadAction<Partial<SetupState>>) {
      Object.assign(s, a.payload);
      clampSpies(s);
    },
    resetNames(s) {
      s.players = initialState.players.map((p) => ({ ...p }));
      clampSpies(s);
    },
  },
});

export const {
  setName,
  addPlayer,
  removePlayer,
  setStyle,
  setSpies,
  setClueInput,
  setLanguage,
  togglePack,
  selectAllPacks,
  setHint,
  setTimer,
  setRevealOnOut,
  setSpiesKnowEachOther,
  setLastChanceGuess,
  hydrate,
  resetNames,
} = slice.actions;

export default slice.reducer;
