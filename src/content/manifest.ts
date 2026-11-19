import type { PackFile, PackInfo } from "./types";

/**
 * The list of word packs. This small file is loaded at start-up.
 * The big word lists stay on disk until a pack is actually chosen.
 */
export const PACKS: PackInfo[] = [
  {
    id: "food",
    name: { en: "Food", ne: "खाना", ro: "Khana" },
    version: 1,
    count: 336,
    langs: ["en", "ne", "ro"],
  },
  {
    id: "places",
    name: { en: "Places", ne: "ठाउँहरू", ro: "Thau" },
    version: 1,
    count: 500,
    langs: ["en", "ne", "ro"],
  },
  {
    id: "festivals",
    name: { en: "Festivals", ne: "चाडपर्व", ro: "Chadparba" },
    version: 1,
    count: 92,
    langs: ["en", "ne", "ro"],
  },
  {
    id: "daily-life",
    name: { en: "Daily life", ne: "दैनिक जीवन", ro: "Rojmarra" },
    version: 1,
    count: 500,
    langs: ["en", "ne", "ro"],
  },
  {
    id: "celebrities",
    name: {
      en: "Celebrities",
      ne: "प्रसिद्ध व्यक्तित्व",
      ro: "Prasiddha byaktitwa",
    },
    version: 1,
    count: 517,
    langs: ["en", "ne", "ro"],
  },
];

/**
 * One loader per pack. The dynamic import() keeps each JSON file out of the
 * main bundle: on the web it becomes its own file that is fetched on demand.
 */
export const PACK_LOADERS: Record<string, () => Promise<PackFile>> = {
  food: () =>
    import("./packs/food.json").then((m) => m.default as unknown as PackFile),
  places: () =>
    import("./packs/places.json").then((m) => m.default as unknown as PackFile),
  festivals: () =>
    import("./packs/festivals.json").then(
      (m) => m.default as unknown as PackFile,
    ),
  "daily-life": () =>
    import("./packs/daily-life.json").then(
      (m) => m.default as unknown as PackFile,
    ),
  celebrities: () =>
    import("./packs/celeb.json").then((m) => m.default as unknown as PackFile),
};
