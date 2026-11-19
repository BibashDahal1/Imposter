import { describe, expect, it, jest } from "@jest/globals";

import { toGameConfig } from "../toGameConfig";

jest.mock("@/store/setupSlice", () => ({
  finalNames: (players: { name: string }[]) => players.map((p) => p.name),
}));

const setup = {
  players: [
    { id: "p1", name: "One" },
    { id: "p2", name: "Two" },
    { id: "p3", name: "Three" },
    { id: "p4", name: "Four" },
  ],
  style: "elimination" as const,
  spies: 1,
  clueInput: "spoken" as const,
  language: "en" as const,
  packIds: ["food"],
  hint: "random" as const,
  timerSec: 60,
  revealOnOut: true,
  spiesKnowEachOther: true,
  lastChanceGuess: false,
};

describe("toGameConfig", () => {
  it("chooses one random hint level when the game config is created", () => {
    const rng = jest.fn(() => 0.99);

    const config = toGameConfig(setup, rng);

    expect(config.hint).toBe("hard");
    expect(rng).toHaveBeenCalledTimes(1);
  });
});
