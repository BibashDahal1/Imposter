import { rngFrom, shuffle } from "./rng";
import type {
  GameConfig,
  GameEvent,
  GameState,
  Outcome,
  Phase,
  Round,
  RoundResult,
} from "./types";

/*
 * The rules of the game as a pure function: reduce(state, event) returns a new state.
 * No screens, no storage, no randomness of its own (events carry a seed).
 */

export const initialGameState: GameState = {
  phase: "idle",
  config: null,
  alive: [],
  round: null,
  history: [],
  lastSpyIds: [],
  guesses: [],
  guessIdx: 0,
  outcome: null,
  gameNo: 0,
};

export const MAX_CLUE_LENGTH = 40;

/** About one Spy for every three players. (Same rule as the setup screen.) */
export const recommendedSpies = (players: number) =>
  Math.max(1, Math.floor((players - 1) / 3));

/** How many Spies a round gets. Elimination re-checks this every round, as players leave. */
export function spiesForRound(cfg: GameConfig, aliveCount: number): number {
  const hardMax = Math.max(1, aliveCount - 2); // at least two Suspects
  const wanted =
    cfg.style === "elimination"
      ? Math.min(cfg.spies, recommendedSpies(aliveCount))
      : cfg.spies;
  return Math.max(1, Math.min(wanted, hardMax));
}

/** Seconds for the debate: twice the clue turn, at least a minute. 0 = no timer. */
export const debateSeconds = (cfg: GameConfig) =>
  cfg.timerSec === 0 ? 0 : Math.max(60, cfg.timerSec * 2);

const normalizeText = (s: string) => s.trim().replace(/\s+/g, " ");
const sameText = (a: string, b: string) =>
  normalizeText(a).toLocaleLowerCase() === normalizeText(b).toLocaleLowerCase();
const guessKey = (s: string) =>
  s
    .normalize("NFC")
    .toLocaleLowerCase()
    .replace(/[\s.,!?'"’“”\-_/\\()]+/g, "");

/* ---------- questions the screens ask ---------- */

export const roleOf = (round: Round, playerId: string) =>
  round.spyIds.includes(playerId) ? "spy" : "suspect";
export const currentBriefingId = (s: GameState) =>
  s.round?.seating[s.round.briefingIdx];
export const currentSpeakerId = (s: GameState) =>
  s.round?.order[s.round.turnIdx];
export const currentVoterId = (s: GameState) =>
  s.round?.seating[s.round.voterIdx];
export const currentGuesserId = (s: GameState) => s.round?.spyIds[s.guessIdx];

/** Why a clue is not allowed, or null if it is fine. */
export function clueProblem(s: GameState, text: string): string | null {
  const cfg = s.config;
  const r = s.round;
  if (!cfg || !r || s.phase !== "clues") return "Not time for clues.";
  if (cfg.clueInput === "spoken") return null;
  const clean = normalizeText(text);
  if (clean.length === 0) return "Type a clue first.";
  if (clean.length > MAX_CLUE_LENGTH)
    return `Keep it under ${MAX_CLUE_LENGTH} characters.`;
  if (r.clueRound === 2) {
    const speaker = r.order[r.turnIdx];
    const first = r.clues[0]?.find((c) => c.playerId === speaker);
    if (first && sameText(first.text, clean))
      return "Use a different clue from round 1.";
  }
  return null;
}

/** Why a vote is not allowed, or null if it is fine. */
export function voteProblem(
  s: GameState,
  voterId: string,
  targets: string[],
): string | null {
  const r = s.round;
  if (!r || s.phase !== "vote") return "Not time to vote.";
  if (voterId !== r.seating[r.voterIdx]) return "It is not this player’s turn.";
  const need = s.config?.style === "elimination" ? 1 : r.spyIds.length;
  if (targets.length !== need)
    return `Pick ${need} ${need === 1 ? "player" : "players"}.`;
  if (new Set(targets).size !== targets.length)
    return "Pick different players.";
  for (const t of targets) {
    if (t === voterId) return "You cannot vote for yourself.";
    if (!r.seating.includes(t)) return "That player is not in this round.";
    if (r.tiedIds && !r.tiedIds.includes(t))
      return "Choose one of the tied players.";
  }
  return null;
}

/* ---------- round set-up ---------- */

function beginRound(s: GameState, seed: number): GameState {
  const cfg = s.config as GameConfig;
  const rng = rngFrom(seed);
  const seating = s.alive;
  const k = spiesForRound(cfg, seating.length);

  // the same player is not the Spy twice in a row, when there is someone else to pick
  const pool = seating.filter((id) => !s.lastSpyIds.includes(id));
  const spyIds = shuffle(pool.length >= k ? pool : seating, rng).slice(0, k);

  // a different player starts the clues each round
  const start = Math.floor(rng() * seating.length);
  const order = [...seating.slice(start), ...seating.slice(0, start)];

  const round: Round = {
    index: s.history.length + 1,
    isFinal: cfg.style === "two-round" || seating.length <= 3,
    word: null,
    spyIds,
    seating,
    order,
    briefingIdx: 0,
    briefingReadyIds: [],
    clueRound: 1,
    turnIdx: 0,
    clues: [[]],
    voterIdx: 0,
    ballots: {},
    tiedIds: null,
    result: null,
  };
  return {
    ...s,
    round,
    phase: "needWord",
    guesses: [],
    guessIdx: 0,
    outcome: null,
  };
}

/* ---------- counting votes ---------- */

function tally(s: GameState, r: Round, seed: number): GameState {
  const cfg = s.config as GameConfig;
  const counts: Record<string, number> = Object.fromEntries(
    r.seating.map((id) => [id, 0]),
  );
  for (const t of Object.values(r.ballots).flat())
    counts[t] = (counts[t] ?? 0) + 1;

  let result: RoundResult;

  if (cfg.style === "elimination") {
    const top = Math.max(...Object.values(counts));
    const tied = r.seating.filter((id) => counts[id] === top);
    if (tied.length > 1 && r.tiedIds === null) {
      // first tie: everyone votes again, only among the tied players
      return { ...s, round: { ...r, tiedIds: tied, ballots: {}, voterIdx: 0 } };
    }
    const tieBroken = tied.length > 1; // still tied after the re-vote: chance decides
    const outId = tieBroken
      ? tied[Math.floor(rngFrom(seed)() * tied.length)]
      : tied[0];
    const outWasSpy = r.spyIds.includes(outId);
    result = {
      tally: counts,
      outId,
      accused: [outId],
      outWasSpy,
      spiesCaught: outWasSpy,
      tieBroken,
    };
  } else {
    // two-round: each player named as many suspects as there are Spies
    const k = r.spyIds.length;
    const sorted = [...r.seating].sort((a, b) => counts[b] - counts[a]);
    const boundary = counts[sorted[k - 1]];
    const sure = sorted.filter((id) => counts[id] > boundary);
    const group = r.seating.filter((id) => counts[id] === boundary);
    const need = k - sure.length;
    const tieBroken = group.length > need;
    const chosen = tieBroken
      ? shuffle(group, rngFrom(seed)).slice(0, need)
      : group;
    const accused = [...sure, ...chosen];
    result = {
      tally: counts,
      outId: null,
      accused,
      outWasSpy: false,
      spiesCaught: r.spyIds.every((id) => accused.includes(id)),
      tieBroken,
    };
  }
  return { ...s, phase: "reveal", round: { ...r, result } };
}

function finish(
  s: GameState,
  outcome: Outcome,
  extra: Partial<GameState> = {},
): GameState {
  return { ...s, ...extra, phase: "gameOver", outcome };
}

/* ---------- the rules ---------- */

export function reduce(s: GameState, e: GameEvent): GameState {
  const r = s.round;
  const cfg = s.config;

  switch (e.type) {
    case "START":
      return beginRound(
        {
          ...initialGameState,
          config: e.config,
          alive: e.config.players.map((p) => p.id),
          gameNo: s.gameNo + 1,
        },
        e.seed,
      );

    case "WORD_READY":
      if (s.phase !== "needWord" || !r) return s;
      return { ...s, phase: "briefing", round: { ...r, word: e.word } };

    case "BRIEFING_READY": {
      if (
        s.phase !== "briefing" ||
        !r ||
        !r.seating.includes(e.playerId) ||
        r.briefingReadyIds.includes(e.playerId)
      )
        return s;
      const briefingReadyIds = [...r.briefingReadyIds, e.playerId];
      return {
        ...s,
        phase:
          briefingReadyIds.length === r.seating.length ? "clues" : "briefing",
        round: { ...r, briefingReadyIds },
      };
    }

    case "BRIEFING_NEXT": {
      if (s.phase !== "briefing" || !r) return s;
      const briefingIdx = r.briefingIdx + 1;
      return {
        ...s,
        phase: briefingIdx >= r.seating.length ? "clues" : "briefing",
        round: { ...r, briefingIdx },
      };
    }

    case "CLUE": {
      if (s.phase !== "clues" || !r || !cfg || clueProblem(s, e.text)) return s;
      const text = cfg.clueInput === "typed" ? normalizeText(e.text) : "";
      const clues = r.clues.map((c) => [...c]);
      clues[r.clueRound - 1].push({ playerId: r.order[r.turnIdx], text });
      let turnIdx = r.turnIdx + 1;
      let clueRound = r.clueRound;
      let phase: Phase = s.phase;
      if (turnIdx >= r.order.length) {
        if (cfg.style === "two-round" && clueRound === 1) {
          clueRound = 2;
          turnIdx = 0;
          clues.push([]);
        } else {
          phase = "debate";
        }
      }
      return { ...s, phase, round: { ...r, clues, turnIdx, clueRound } };
    }

    case "DEBATE_DONE":
      if (s.phase !== "debate" || !r) return s;
      return {
        ...s,
        phase: "vote",
        round: { ...r, voterIdx: 0, ballots: {}, tiedIds: null },
      };

    case "VOTE": {
      if (voteProblem(s, e.voterId, e.targets) || !r) return s;
      const ballots = { ...r.ballots, [e.voterId]: [...e.targets] };
      const voterIdx = r.voterIdx + 1;
      const next = { ...r, ballots, voterIdx };
      if (voterIdx < r.seating.length) return { ...s, round: next };
      return tally(s, next, e.seed);
    }

    case "CONTINUE": {
      if (s.phase !== "reveal" || !r || !cfg || !r.word || !r.result) return s;
      const res = r.result;
      const history = [
        ...s.history,
        {
          index: r.index,
          isFinal: r.isFinal,
          word: r.word.word,
          spyIds: r.spyIds,
          outId: res.outId,
          accused: res.accused,
          spiesCaught: res.spiesCaught,
        },
      ];

      if (cfg.style === "elimination") {
        if (r.isFinal) {
          return finish(
            s,
            {
              winner: res.spiesCaught ? "suspects" : "spies",
              reason: res.spiesCaught ? "caught" : "escaped",
            },
            { history },
          );
        }
        const alive = s.alive.filter((id) => id !== res.outId);
        return beginRound(
          { ...s, history, alive, lastSpyIds: r.spyIds },
          e.seed,
        );
      }

      // two-round
      if (!res.spiesCaught)
        return finish(s, { winner: "spies", reason: "escaped" }, { history });
      if (cfg.lastChanceGuess)
        return { ...s, history, phase: "lastChance", guesses: [], guessIdx: 0 };
      return finish(s, { winner: "suspects", reason: "caught" }, { history });
    }

    case "GUESS": {
      if (s.phase !== "lastChance" || !r || !r.word) return s;
      const spyId = r.spyIds[s.guessIdx];
      const correct =
        guessKey(e.text) !== "" && guessKey(e.text) === guessKey(r.word.word);
      const guesses = [
        ...s.guesses,
        { spyId, guess: normalizeText(e.text), correct },
      ];
      const guessIdx = s.guessIdx + 1;
      if (correct)
        return finish(
          s,
          { winner: "spies", reason: "last-chance-correct" },
          { guesses, guessIdx },
        );
      if (guessIdx >= r.spyIds.length)
        return finish(
          s,
          { winner: "suspects", reason: "last-chance-failed" },
          { guesses, guessIdx },
        );
      return { ...s, guesses, guessIdx };
    }

    case "RESET":
      return { ...initialGameState, gameNo: s.gameNo };

    default:
      return s;
  }
}
