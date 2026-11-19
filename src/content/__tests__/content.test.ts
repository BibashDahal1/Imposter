import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { loadPack } from "../loadPack";
import { PACKS } from "../manifest";
import {
  drawWord,
  hintFor,
  isPlayable,
  pickFrom,
  type Candidate,
} from "../pickWord";
import { clearSeen, loadSeen, saveSeen } from "../seen";
import { LANGS, type WordEntry } from "../types";

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

// Jest cannot run dynamic import(), but the app (Metro) can. Here the loaders read the same JSON files with require().
jest.mock("../manifest", () => {
  const actual = jest.requireActual<typeof import("../manifest")>(
    "../manifest",
  );
  const ids = ["food", "places", "festivals", "daily-life", "celebrities"];
  return {
    ...actual,
    PACK_LOADERS: Object.fromEntries(
      ids.map((id) => [
        id,
        () =>
          Promise.resolve(
            require(
              `../packs/${id === "celebrities" ? "celeb" : id}.json`,
            ),
          ),
      ]),
    ),
  };
});

const entry = (id: string, over: Partial<WordEntry> = {}): WordEntry => ({
  id,
  tier: 1,
  w: { en: id, ne: `${id}-ne` },
  hint: {
    hard: { en: "h" },
    normal: { en: "n", ne: "n-ne" },
    easy: { en: "e" },
  },
  ...over,
});
const cands = (...ids: string[]): Candidate[] =>
  ids.map((id) => ({ packId: "p", entry: entry(id) }));

describe("manifest", () => {
  it("loads the celebrity category", async () => {
    const file = await loadPack("celebrities");

    expect(file.id).toBe("celebrities");
    expect(file.words).toHaveLength(517);
    expect(file.words.every((word) => !!word.w.en && !!word.w.ne && !!word.w.ro))
      .toBe(true);
  });

  it("matches the pack files", async () => {
    for (const info of PACKS) {
      const file = await loadPack(info.id);
      expect(file.id).toBe(info.id);
      expect(file.version).toBe(info.version);
      expect(file.words).toHaveLength(info.count);
      const langs = LANGS.filter((l) => file.words.every((w) => !!w.w[l]));
      expect([...info.langs].sort()).toEqual([...langs].sort());
    }
  });
  it("has unique ids and valid tiers", async () => {
    const all = new Set<string>();
    for (const info of PACKS) {
      for (const w of (await loadPack(info.id)).words) {
        expect(all.has(w.id)).toBe(false);
        all.add(w.id);
        expect([1, 2, 3]).toContain(w.tier);
      }
    }
  });
  it("rejects an unknown pack", async () => {
    await expect(loadPack("nope")).rejects.toThrow("Unknown word pack");
  });
});

describe("hints and languages", () => {
  const e = entry("x");
  it("prefers the player language over the exact strength", () => {
    expect(hintFor(e, "ne", "easy")).toBe("n-ne");
  });
  it("falls back to English when the language has no hint", () => {
    expect(hintFor(e, "ro", "easy")).toBe("e");
  });
  it("needs the word itself in the chosen language", () => {
    expect(isPlayable(e, "ne", "normal")).toBe(true);
    expect(isPlayable(e, "ro", "normal")).toBe(false);
  });
});

describe("pickFrom", () => {
  it("skips seen words", () => {
    const r = pickFrom(cands("a", "b", "c"), {
      lang: "en",
      level: "normal",
      seen: new Set(["a", "b"]),
      rng: () => 0,
    });
    expect(r?.picked.id).toBe("c");
    expect(r?.reused).toBe(false);
  });
  it("starts over when everything was seen", () => {
    const r = pickFrom(cands("a", "b"), {
      lang: "en",
      level: "normal",
      seen: new Set(["a", "b"]),
      rng: () => 0.99,
    });
    expect(r?.picked.id).toBe("b");
    expect(r?.reused).toBe(true);
  });
  it("returns null when nothing can be played", () => {
    expect(
      pickFrom(cands("a"), { lang: "ro", level: "normal", seen: new Set() }),
    ).toBeNull();
  });
});

describe("drawWord", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    await clearSeen();
  });
  it("never repeats until the pool is used up, then starts over", async () => {
    const opts = {
      packIds: ["food"],
      lang: "en" as const,
      level: "normal" as const,
    };
    const words = await loadPack("food");
    await saveSeen(new Set(words.words.map((word) => word.id)));
    const next = await drawWord(opts);
    expect(next).not.toBeNull();
    expect((await loadSeen()).size).toBe(1); // started over
  });
  it("draws across several packs in Nepali with a hint", async () => {
    const p = await drawWord({
      packIds: ["food", "places"],
      lang: "ne",
      level: "normal",
    });
    expect(p?.word).toMatch(/[\u0900-\u097F]/);
    expect(p?.hint).toBeTruthy();
  });
  it("has a playable word for each pack language and hint strength", async () => {
    for (const info of PACKS) {
      const pack = await loadPack(info.id);
      for (const lang of info.langs) {
        for (const level of ["hard", "normal", "easy"] as const) {
          expect(
            pickFrom(
              pack.words.map((entry) => ({ packId: pack.id, entry })),
              { lang, level, seen: new Set() },
            ),
          ).not.toBeNull();
        }
      }
    }
  });
});
