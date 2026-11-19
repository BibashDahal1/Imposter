import { describe, expect, it } from "vitest";
import {
  clueProblem,
  currentBriefingId,
  currentGuesserId,
  currentSpeakerId,
  currentVoterId,
  debateSeconds,
  initialGameState,
  recommendedSpies,
  reduce,
  spiesForRound,
  voteProblem,
} from "../game";
import type { GameConfig, GameEvent, GameState } from "../types";

const names = [
  "Ram",
  "Sita",
  "Hari",
  "Maya",
  "Bikash",
  "Anil",
  "Gita",
  "Sunil",
  "Rita",
  "Dev",
  "Mina",
  "Raj",
];
const config = (over: Partial<GameConfig> = {}, n = 5): GameConfig => ({
  players: names.slice(0, n).map((name, i) => ({ id: `p${i + 1}`, name })),
  style: "elimination",
  spies: 1,
  clueInput: "spoken",
  language: "en",
  packIds: ["food"],
  hint: "normal",
  timerSec: 60,
  revealOnOut: true,
  spiesKnowEachOther: true,
  lastChanceGuess: false,
  ...over,
});

const run = (s: GameState, ...events: GameEvent[]) => events.reduce(reduce, s);
const word = (w = "Momo") => ({ id: "food.momo", word: w, hint: "A food" });
const start = (cfg: GameConfig, seed = 1) =>
  reduce(initialGameState, { type: "START", config: cfg, seed });
const withWord = (cfg: GameConfig, seed = 1, w = "Momo") =>
  reduce(start(cfg, seed), { type: "WORD_READY", word: word(w) });

/** Plays briefing, clues and debate with spoken clues, ending at the vote. */
function toVote(s: GameState): GameState {
  let g = s;
  while (g.phase === "briefing") g = reduce(g, { type: "BRIEFING_NEXT" });
  while (g.phase === "clues") g = reduce(g, { type: "CLUE", text: "" });
  return reduce(g, { type: "DEBATE_DONE" });
}

/** Everybody votes for `target` (the target themself votes for `fallback`). */
function voteAll(
  s: GameState,
  target: string,
  fallback: string,
  seed = 7,
): GameState {
  let g = s;
  while (g.phase === "vote") {
    const voter = currentVoterId(g)!;
    g = reduce(g, {
      type: "VOTE",
      voterId: voter,
      targets: [voter === target ? fallback : target],
      seed,
    });
  }
  return g;
}

describe("starting", () => {
  it("waits for a word, then starts the briefing", () => {
    const s = start(config());
    expect(s.phase).toBe("needWord");
    expect(s.round?.spyIds).toHaveLength(1);
    expect(s.alive).toHaveLength(5);
    expect(reduce(s, { type: "WORD_READY", word: word() }).phase).toBe(
      "briefing",
    );
  });
  it("is the same every time for the same seed", () => {
    expect(start(config(), 42).round).toEqual(start(config(), 42).round);
  });
  it("ignores events at the wrong time", () => {
    const s = start(config());
    expect(reduce(s, { type: "BRIEFING_NEXT" })).toBe(s);
    expect(reduce(s, { type: "DEBATE_DONE" })).toBe(s);
    expect(reduce(initialGameState, { type: "CONTINUE", seed: 1 })).toBe(
      initialGameState,
    );
  });
});

describe("number of spies", () => {
  it("follows the recommendation in elimination and shrinks as players leave", () => {
    expect(recommendedSpies(12)).toBe(3);
    const c = config({ spies: 3 }, 12);
    expect(spiesForRound(c, 12)).toBe(3);
    expect(spiesForRound(c, 6)).toBe(1);
    expect(spiesForRound(c, 3)).toBe(1);
  });
  it("keeps at least two suspects in two-round", () => {
    expect(spiesForRound(config({ style: "two-round", spies: 3 }, 4), 4)).toBe(
      2,
    );
  });
});

describe("briefing and clues", () => {
  it("shows every player their card once, then clues", () => {
    let s = withWord(config());
    const seen = new Set<string>();
    while (s.phase === "briefing") {
      seen.add(currentBriefingId(s)!);
      s = reduce(s, { type: "BRIEFING_NEXT" });
    }
    expect(seen.size).toBe(5);
    expect(s.phase).toBe("clues");
  });
  it("starts room clues only after every active player confirms", () => {
    let s = withWord(config());
    const seating = s.round!.seating;

    for (const playerId of seating.slice(0, -1)) {
      s = reduce(s, { type: "BRIEFING_READY", playerId });
      expect(s.phase).toBe("briefing");
    }

    const previous = s;
    s = reduce(s, {
      type: "BRIEFING_READY",
      playerId: seating[0],
    });
    expect(s).toBe(previous);

    s = reduce(s, {
      type: "BRIEFING_READY",
      playerId: seating[seating.length - 1],
    });
    expect(s.phase).toBe("clues");
    expect(s.round?.briefingReadyIds).toHaveLength(seating.length);
  });
  it("gives each player one clue turn, then the debate", () => {
    let s = withWord(config());
    while (s.phase === "briefing") s = reduce(s, { type: "BRIEFING_NEXT" });
    const speakers = new Set<string>();
    while (s.phase === "clues") {
      speakers.add(currentSpeakerId(s)!);
      s = reduce(s, { type: "CLUE", text: "" });
    }
    expect(speakers.size).toBe(5);
    expect(s.phase).toBe("debate");
    expect(s.round?.clues[0]).toHaveLength(5);
  });
  it("rejects empty and repeated typed clues", () => {
    const cfg = config({ style: "two-round", clueInput: "typed" });
    let s = withWord(cfg);
    while (s.phase === "briefing") s = reduce(s, { type: "BRIEFING_NEXT" });
    expect(clueProblem(s, "   ")).toMatch(/Type a clue/);
    expect(reduce(s, { type: "CLUE", text: "  " })).toBe(s);
    for (let i = 0; i < 5; i++)
      s = reduce(s, { type: "CLUE", text: `clue ${i}` });
    expect(s.round?.clueRound).toBe(2);
    expect(clueProblem(s, "CLUE   0")).toMatch(/different clue/);
    expect(clueProblem(s, "something new")).toBeNull();
    expect(reduce(s, { type: "CLUE", text: "clue 0" })).toBe(s);
  });
  it("uses the debate length from the timer", () => {
    expect(debateSeconds(config({ timerSec: 0 }))).toBe(0);
    expect(debateSeconds(config({ timerSec: 30 }))).toBe(60);
    expect(debateSeconds(config({ timerSec: 90 }))).toBe(180);
  });
});

describe("voting", () => {
  const atVote = () => toVote(withWord(config()));
  it("only accepts the right voter and a valid target", () => {
    const s = atVote();
    const voter = currentVoterId(s)!;
    expect(voteProblem(s, voter, [voter])).toMatch(/yourself/);
    expect(voteProblem(s, "p5", ["p1"])).toMatch(/not this player/);
    expect(voteProblem(s, voter, [])).toMatch(/Pick 1/);
    expect(voteProblem(s, voter, ["nobody"])).toMatch(/not in this round/);
    expect(voteProblem(s, voter, [voter === "p1" ? "p2" : "p1"])).toBeNull();
  });
  it("votes out the player with most votes", () => {
    const s = voteAll(atVote(), "p3", "p1");
    expect(s.phase).toBe("reveal");
    expect(s.round?.result?.outId).toBe("p3");
    expect(s.round?.result?.tally.p3).toBe(4);
  });
  it("asks for a re-vote on a tie and counts only the re-vote", () => {
    let s = atVote();
    // p1 and p2 tie with 2 votes each
    const picks: Record<string, string> = {
      p1: "p2",
      p2: "p1",
      p3: "p2",
      p4: "p1",
      p5: "p3",
    };
    for (const id of Object.keys(picks))
      s = reduce(s, {
        type: "VOTE",
        voterId: id,
        targets: [picks[id]],
        seed: 5,
      });
    expect(s.phase).toBe("vote");
    expect([...(s.round?.tiedIds ?? [])].sort()).toEqual(["p1", "p2"]);
    expect(voteProblem(s, "p1", ["p3"])).toMatch(/tied players/);
    // re-vote: p1 gets 3 votes, p2 gets 2
    const again: Record<string, string> = {
      p1: "p2",
      p2: "p1",
      p3: "p2",
      p4: "p1",
      p5: "p1",
    };
    for (const id of Object.keys(again))
      s = reduce(s, {
        type: "VOTE",
        voterId: id,
        targets: [again[id]],
        seed: 5,
      });
    expect(s.phase).toBe("reveal");
    expect(s.round?.result?.outId).toBe("p1");
    expect(s.round?.result?.tieBroken).toBe(false);
  });
  it("settles a second tie by chance, the same way for the same seed", () => {
    const six = () => toVote(withWord(config({}, 6)));
    const first: Record<string, string> = {
      p1: "p2",
      p2: "p1",
      p3: "p2",
      p4: "p1",
      p5: "p3",
      p6: "p4",
    };
    const second: Record<string, string> = {
      p1: "p2",
      p2: "p1",
      p3: "p2",
      p4: "p1",
      p5: "p2",
      p6: "p1",
    };
    const play = (seed: number) => {
      let s = six();
      for (const id of Object.keys(first))
        s = reduce(s, {
          type: "VOTE",
          voterId: id,
          targets: [first[id]],
          seed,
        });
      expect(s.phase).toBe("vote");
      for (const id of Object.keys(second))
        s = reduce(s, {
          type: "VOTE",
          voterId: id,
          targets: [second[id]],
          seed,
        });
      return s;
    };
    const a = play(21);
    expect(a.phase).toBe("reveal");
    expect(a.round?.result?.tieBroken).toBe(true);
    expect(["p1", "p2"]).toContain(a.round?.result?.outId);
    expect(play(21).round?.result?.outId).toBe(a.round?.result?.outId);
  });
});

describe("elimination game", () => {
  it("plays 5 players down to a final round of 3, with a new word and Spy each round", () => {
    let s = toVote(withWord(config(), 3));
    const spy1 = s.round!.spyIds[0];
    const out1 = s.round!.seating.find((id) => id !== spy1)!;
    s = voteAll(s, out1, spy1);
    expect(s.round?.result?.outWasSpy).toBe(false);

    s = reduce(s, { type: "CONTINUE", seed: 11 });
    expect(s.phase).toBe("needWord");
    expect(s.alive).toHaveLength(4);
    expect(s.alive).not.toContain(out1);
    expect(s.round?.index).toBe(2);
    expect(s.round?.isFinal).toBe(false);
    expect(s.round?.spyIds).not.toContain(spy1); // not the Spy twice in a row

    s = toVote(reduce(s, { type: "WORD_READY", word: word("Dal bhat") }));
    const spy2 = s.round!.spyIds[0];
    const out2 = s.round!.seating.find((id) => id !== spy2)!;
    s = reduce(voteAll(s, out2, spy2), { type: "CONTINUE", seed: 12 });
    expect(s.alive).toHaveLength(3);
    expect(s.round?.index).toBe(3);
    expect(s.round?.isFinal).toBe(true);

    // final round: the Spy is voted out, so the Suspects win
    s = toVote(reduce(s, { type: "WORD_READY", word: word("Chiya") }));
    const spy3 = s.round!.spyIds[0];
    const other = s.round!.seating.find((id) => id !== spy3)!;
    s = reduce(voteAll(s, spy3, other), { type: "CONTINUE", seed: 13 });
    expect(s.phase).toBe("gameOver");
    expect(s.outcome).toEqual({ winner: "suspects", reason: "caught" });
    expect(s.history).toHaveLength(3);
    expect(s.history.map((h) => h.word)).toEqual(["Momo", "Dal bhat", "Chiya"]);
  });
  it("lets the Spy win when the wrong player is voted out in the final round", () => {
    let s = toVote(withWord(config({}, 4), 9));
    s = reduce(
      voteAll(
        s,
        s.round!.seating.find((id) => !s.round!.spyIds.includes(id))!,
        s.round!.spyIds[0],
      ),
      { type: "CONTINUE", seed: 2 },
    );
    expect(s.round?.isFinal).toBe(true);
    s = toVote(reduce(s, { type: "WORD_READY", word: word() }));
    const spy = s.round!.spyIds[0];
    const innocent = s.round!.seating.find((id) => id !== spy)!;
    const other = s.round!.seating.find((id) => id !== innocent)!;
    s = reduce(voteAll(s, innocent, other), { type: "CONTINUE", seed: 3 });
    expect(s.outcome).toEqual({ winner: "spies", reason: "escaped" });
  });
});

describe("two-round game", () => {
  const cfg = (over: Partial<GameConfig> = {}) =>
    config({ style: "two-round", spies: 2, ...over }, 5);
  const playTo = (s: GameState) => {
    let g = s;
    while (g.phase === "briefing") g = reduce(g, { type: "BRIEFING_NEXT" });
    while (g.phase === "clues") g = reduce(g, { type: "CLUE", text: "" });
    return reduce(g, { type: "DEBATE_DONE" });
  };
  const castAll = (s: GameState, picks: (voter: string) => string[]) => {
    let g = s;
    while (g.phase === "vote")
      g = reduce(g, {
        type: "VOTE",
        voterId: currentVoterId(g)!,
        targets: picks(currentVoterId(g)!),
        seed: 4,
      });
    return g;
  };

  it("has two clue rounds, one vote and ends", () => {
    const s = playTo(withWord(cfg(), 5));
    expect(s.round?.clues).toHaveLength(2);
    expect(s.round?.clues[1]).toHaveLength(5);
    expect(s.round?.isFinal).toBe(true);
  });
  it("wins for the suspects when every spy is named", () => {
    let s = playTo(withWord(cfg(), 5));
    const spies = s.round!.spyIds;
    s = castAll(s, (voter) => {
      const t = spies.filter((x) => x !== voter);
      return t.length === 2
        ? t
        : [...t, s.round!.seating.find((x) => x !== voter && !t.includes(x))!];
    });
    expect(s.round?.result?.spiesCaught).toBe(true);
    s = reduce(s, { type: "CONTINUE", seed: 1 });
    expect(s.outcome).toEqual({ winner: "suspects", reason: "caught" });
  });
  it("wins for the spies when one is not named", () => {
    let s = playTo(withWord(cfg(), 5));
    const [spyA] = s.round!.spyIds;
    const innocents = s.round!.seating.filter(
      (x) => !s.round!.spyIds.includes(x),
    );
    s = castAll(s, (voter) => {
      const options = [spyA, ...innocents].filter((x) => x !== voter);
      return options.slice(0, 2);
    });
    s = reduce(s, { type: "CONTINUE", seed: 1 });
    expect(s.outcome?.winner).toBeDefined();
    expect(s.phase).toBe("gameOver");
  });
  it("gives caught spies a last chance to guess the word", () => {
    let s = playTo(withWord(cfg({ lastChanceGuess: true }), 5, "Dal bhat"));
    const spies = s.round!.spyIds;
    s = castAll(s, (voter) => {
      const t = spies.filter((x) => x !== voter);
      return t.length === 2
        ? t
        : [...t, s.round!.seating.find((x) => x !== voter && !t.includes(x))!];
    });
    s = reduce(s, { type: "CONTINUE", seed: 1 });
    expect(s.phase).toBe("lastChance");
    expect(currentGuesserId(s)).toBe(spies[0]);
    s = reduce(s, { type: "GUESS", text: "wrong" });
    expect(s.phase).toBe("lastChance");
    s = reduce(s, { type: "GUESS", text: " DAL-bhat " });
    expect(s.phase).toBe("gameOver");
    expect(s.outcome).toEqual({
      winner: "spies",
      reason: "last-chance-correct",
    });
    expect(s.guesses.map((g) => g.correct)).toEqual([false, true]);
  });
  it("lets the suspects win when no caught spy guesses the word", () => {
    let s = playTo(withWord(cfg({ lastChanceGuess: true, spies: 1 }), 5));
    const spy = s.round!.spyIds[0];
    s = castAll(s, (voter) =>
      voter === spy ? [s.round!.seating.find((x) => x !== spy)!] : [spy],
    );
    s = reduce(reduce(s, { type: "CONTINUE", seed: 1 }), {
      type: "GUESS",
      text: "nope",
    });
    expect(s.outcome).toEqual({
      winner: "suspects",
      reason: "last-chance-failed",
    });
  });
});

describe("reset", () => {
  it("goes back to nothing but remembers the game number", () => {
    const s = reduce(start(config()), { type: "RESET" });
    expect(s.phase).toBe("idle");
    expect(s.gameNo).toBe(1);
    expect(reduce(s, { type: "START", config: config(), seed: 1 }).gameNo).toBe(
      2,
    );
  });
});
