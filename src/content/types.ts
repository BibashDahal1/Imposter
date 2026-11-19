/** Languages a word can be written in. ne = Nepali (Devanagari), ro = Roman Nepali, en = English. */
export type Lang = "ne" | "ro" | "en";
export const LANGS: Lang[] = ["en", "ne", "ro"];

/** The same text in several languages. Any language can be missing. */
export type Localized = Partial<Record<Lang, string>>;

/** How much the Spy is told: hard = one vague word, normal = the category, easy = a clear description. */
export type HintLevel = "hard" | "normal" | "easy";

export type WordEntry = {
  /** Stable id such as "food.momo". Never change it once a word is in use. */
  id: string;
  /** 1 = everyone knows it, 2 = fairly common, 3 = tricky. */
  tier: 1 | 2 | 3;
  /** The secret word the Suspects see. */
  w: Localized;
  /** What the Spy sees, at three strengths. */
  hint: Record<HintLevel, Localized>;
  /** Optional labels for future filters. */
  tags?: string[];
};

/** One file on disk: a themed list of words. */
export type PackFile = {
  id: string;
  version: number;
  name: Localized;
  words: WordEntry[];
};

/** Tiny description of a pack, loaded at start-up without opening the pack itself. */
export type PackInfo = {
  id: string;
  name: Localized;
  version: number;
  /** Number of words in the pack. A test checks it matches the file. */
  count: number;
  /** Languages in which every word of the pack has a word text. */
  langs: Lang[];
};
