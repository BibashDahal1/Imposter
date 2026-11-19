import type { GameConfig } from "@/engine/types";
import type { HintLevel } from "@/content/types";
import { finalNames, type SetupState } from "@/store/setupSlice";

const HINT_LEVELS: HintLevel[] = ["easy", "normal", "hard"];

/** Copies the chosen setup into the settings the game rules use. */
export function toGameConfig(
  s: SetupState,
  rng: () => number = Math.random,
): GameConfig {
  const names = finalNames(s.players);
  const hint =
    s.hint === "random"
      ? HINT_LEVELS[
          Math.max(
            0,
            Math.min(
              HINT_LEVELS.length - 1,
              Math.floor(rng() * HINT_LEVELS.length),
            ),
          )
        ]
      : s.hint;
  return {
    players: s.players.map((p, i) => ({ id: p.id, name: names[i] })),
    style: s.style,
    spies: s.spies,
    clueInput: s.clueInput,
    language: s.language,
    packIds: [...s.packIds],
    hint,
    timerSec: s.timerSec,
    revealOnOut: s.revealOnOut,
    spiesKnowEachOther: s.spiesKnowEachOther,
    lastChanceGuess: s.lastChanceGuess,
  };
}
