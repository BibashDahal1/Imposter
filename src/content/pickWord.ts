import { loadPack } from "./loadPack";
import { loadSeen, saveSeen } from "./seen";
import type { HintLevel, Lang, WordEntry } from "./types";

/** Which hint strength to try next if the chosen one is missing. */
const LEVEL_ORDER: Record<HintLevel, HintLevel[]> = {
  hard: ["hard", "normal", "easy"],
  normal: ["normal", "hard", "easy"],
  easy: ["easy", "normal", "hard"],
};

/** Which language to try next if the chosen one is missing. */
const LANG_ORDER: Record<Lang, Lang[]> = {
  ne: ["ne", "en", "ro"],
  ro: ["ro", "en", "ne"],
  en: ["en", "ro", "ne"],
};

/**
 * The hint text for a word.
 * Language comes first: a hint in the player's own language at a nearby strength
 * is better than an English hint at the exact strength they asked for.
 */
export function hintFor(
  entry: WordEntry,
  lang: Lang,
  level: HintLevel,
): string | undefined {
  for (const lg of LANG_ORDER[lang]) {
    for (const lv of LEVEL_ORDER[level]) {
      const text = entry.hint[lv]?.[lg];
      if (text) return text;
    }
  }
  return undefined;
}

/** A word can be played if it exists in the chosen language and has some hint. */
export function isPlayable(
  entry: WordEntry,
  lang: Lang,
  level: HintLevel,
): boolean {
  return !!entry.w[lang] && !!hintFor(entry, lang, level);
}

export type Candidate = { packId: string; entry: WordEntry };
export type Picked = { id: string; packId: string; word: string; hint: string };
export type PickOptions = {
  lang: Lang;
  level: HintLevel;
  seen: ReadonlySet<string>;
  rng?: () => number;
};

/**
 * Chooses one word. Words played before are skipped; once every playable word
 * has been seen, the pool starts over and `reused` is true.
 */
export function pickFrom(
  candidates: Candidate[],
  { lang, level, seen, rng = Math.random }: PickOptions,
): { picked: Picked; reused: boolean } | null {
  const playable = candidates.filter((c) => isPlayable(c.entry, lang, level));
  if (playable.length === 0) return null;

  const fresh = playable.filter((c) => !seen.has(c.entry.id));
  const pool = fresh.length > 0 ? fresh : playable;
  const chosen =
    pool[Math.min(pool.length - 1, Math.floor(rng() * pool.length))];

  return {
    picked: {
      id: chosen.entry.id,
      packId: chosen.packId,
      word: chosen.entry.w[lang] as string,
      hint: hintFor(chosen.entry, lang, level) as string,
    },
    reused: fresh.length === 0,
  };
}

export type DrawOptions = {
  packIds: string[];
  lang: Lang;
  level: HintLevel;
  rng?: () => number;
};

/** Loads the chosen packs, picks a word nobody has played yet, and remembers it. */
export async function drawWord({
  packIds,
  lang,
  level,
  rng,
}: DrawOptions): Promise<Picked | null> {
  const packs = await Promise.all(packIds.map((id) => loadPack(id)));
  const candidates: Candidate[] = packs.flatMap((p) =>
    p.words.map((entry) => ({ packId: p.id, entry })),
  );

  const seen = await loadSeen();
  const result = pickFrom(candidates, { lang, level, seen, rng });
  if (!result) return null;

  if (result.reused) for (const c of candidates) seen.delete(c.entry.id); // everything was played: start over
  seen.add(result.picked.id);
  await saveSeen(seen);
  return result.picked;
}
