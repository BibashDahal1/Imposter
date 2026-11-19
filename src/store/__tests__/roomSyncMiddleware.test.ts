import { describe, expect, it } from "vitest";

import {
  currentSpeakerId,
  currentVoterId,
  initialGameState,
  reduce,
} from "../../engine/game";
import type { GameConfig, GameEvent, GameState } from "../../engine/types";

import { canAcceptRemoteEvent } from "../roomSyncMiddleware";

const config: GameConfig = {
  players: [
    { id: "host", name: "Host" },
    { id: "p2", name: "Player 2" },
    { id: "p3", name: "Player 3" },
    { id: "p4", name: "Player 4" },
  ],
  style: "elimination",
  spies: 1,
  clueInput: "spoken",
  language: "en",
  packIds: ["food"],
  hint: "normal",
  timerSec: 0,
  revealOnOut: true,
  spiesKnowEachOther: true,
  lastChanceGuess: false,
};

function stateAtClues(): GameState {
  let state = reduce(initialGameState, {
    type: "START",
    config,
    seed: 1,
  });
  state = reduce(state, {
    type: "WORD_READY",
    word: { id: "food.momo", word: "Momo", hint: "A food" },
  });
  while (state.phase === "briefing")
    state = reduce(state, { type: "BRIEFING_NEXT" });
  return state;
}

function stateAtVote(): GameState {
  let state = stateAtClues();
  while (state.phase === "clues") state = reduce(state, { type: "CLUE", text: "" });
  return reduce(state, { type: "DEBATE_DONE" });
}

describe("remote room event authorization", () => {
  it("accepts readiness only from the player confirming their own card", () => {
    let state = reduce(initialGameState, {
      type: "START",
      config,
      seed: 1,
    });
    state = reduce(state, {
      type: "WORD_READY",
      word: { id: "food.momo", word: "Momo", hint: "A food" },
    });

    expect(
      canAcceptRemoteEvent(
        state,
        { type: "BRIEFING_READY", playerId: "p2" },
        "p2",
        "host",
      ),
    ).toBe(true);
    expect(
      canAcceptRemoteEvent(
        state,
        { type: "BRIEFING_READY", playerId: "host" },
        "p2",
        "host",
      ),
    ).toBe(false);
  });

  it("accepts a clue only from the player whose clue turn is active", () => {
    const state = stateAtClues();
    const speaker = currentSpeakerId(state);
    if (!speaker) throw new Error("Expected an active clue speaker.");

    expect(
      canAcceptRemoteEvent(
        state,
        { type: "CLUE", text: "" },
        speaker,
        "host",
      ),
    ).toBe(true);
    expect(
      canAcceptRemoteEvent(
        state,
        { type: "CLUE", text: "" },
        "not-the-speaker",
        "host",
      ),
    ).toBe(false);
  });

  it("binds a vote to the active voter and does not allow clients to advance host phases", () => {
    const state = stateAtVote();
    const voter = currentVoterId(state);
    if (!voter) throw new Error("Expected an active voter.");
    const target = state.round?.seating.find((id) => id !== voter);
    if (!target) throw new Error("Expected a valid vote target.");
    const vote: GameEvent = {
      type: "VOTE",
      voterId: voter,
      targets: [target],
      seed: 7,
    };

    expect(canAcceptRemoteEvent(state, vote, voter, "host")).toBe(true);
    expect(canAcceptRemoteEvent(state, vote, "another-player", "host")).toBe(
      false,
    );
    expect(
      canAcceptRemoteEvent(
        state,
        { type: "DEBATE_DONE" },
        voter,
        "host",
      ),
    ).toBe(false);
  });
});
