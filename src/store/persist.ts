import AsyncStorage from "@react-native-async-storage/async-storage";

import { PACKS } from "@/content/manifest";
import { LANGS } from "@/content/types";

import { store } from "./index";
import {
  MAX_PLAYERS,
  TIMERS,
  hydrate,
  normalizeName,
  type SetupState,
} from "./setupSlice";

const KEY = "imposter.setup.v1";

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null;

/** Keeps only saved values that are still valid. Anything odd is ignored, never trusted. */
export function sanitize(raw: unknown): Partial<SetupState> {
  if (!isObj(raw)) return {};
  const out: Partial<SetupState> = {};

  if (Array.isArray(raw.players)) {
    const ids = new Set<string>();
    const players = raw.players
      .filter(
        (p): p is { id: string; name: string } =>
          isObj(p) && typeof p.id === "string" && typeof p.name === "string",
      )
      .filter((p) => (ids.has(p.id) ? false : (ids.add(p.id), true)))
      .slice(0, MAX_PLAYERS)
      .map((p) => ({ id: p.id, name: normalizeName(p.name) }));
    if (players.length >= 3) out.players = players;
  }
  if (raw.style === "elimination" || raw.style === "two-round")
    out.style = raw.style;
  if (typeof raw.spies === "number" && Number.isFinite(raw.spies))
    out.spies = raw.spies;
  if (raw.clueInput === "typed" || raw.clueInput === "spoken")
    out.clueInput = raw.clueInput;
  if (LANGS.includes(raw.language as never))
    out.language = raw.language as SetupState["language"];
  if (Array.isArray(raw.packIds)) {
    const known = new Set(PACKS.map((p) => p.id));
    const ids = raw.packIds.filter(
      (id): id is string => typeof id === "string" && known.has(id),
    );
    if (ids.length > 0) out.packIds = ids;
  }
  if (
    raw.hint === "easy" ||
    raw.hint === "normal" ||
    raw.hint === "hard" ||
    raw.hint === "random"
  )
    out.hint = raw.hint;
  if (
    typeof raw.timerSec === "number" &&
    (TIMERS as readonly number[]).includes(raw.timerSec)
  )
    out.timerSec = raw.timerSec;
  if (typeof raw.revealOnOut === "boolean") out.revealOnOut = raw.revealOnOut;
  if (typeof raw.spiesKnowEachOther === "boolean")
    out.spiesKnowEachOther = raw.spiesKnowEachOther;
  if (typeof raw.lastChanceGuess === "boolean")
    out.lastChanceGuess = raw.lastChanceGuess;
  return out;
}

/** Loads the last used players and options from the device. */
export async function hydrateSetup(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) store.dispatch(hydrate(sanitize(JSON.parse(raw))));
  } catch {
    /* unreadable or blocked: start with the defaults */
  }
}

/** Saves the setup shortly after every change. Returns a function that stops saving. */
export function startPersisting(): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let last = store.getState().setup;
  const unsubscribe = store.subscribe(() => {
    const next = store.getState().setup;
    if (next === last) return;
    last = next;
    clearTimeout(timer);
    timer = setTimeout(() => {
      AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
    }, 400);
  });
  return () => {
    clearTimeout(timer);
    unsubscribe();
  };
}
