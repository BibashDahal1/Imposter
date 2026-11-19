import type { Middleware, UnknownAction } from "@reduxjs/toolkit";

import {
  clueProblem,
  currentGuesserId,
  currentSpeakerId,
  currentVoterId,
  voteProblem,
} from "../engine/game";
import type { GameEvent, GameState } from "../engine/types";
import { roomNetwork } from "../features/rooms/roomNetwork";

import {
  briefingNext,
  briefingReady,
  castVote,
  continueGame,
  debateDone,
  receiveEvent,
  resetGame,
  startGame,
  submitClue,
  submitGuess,
  wordReady,
} from "./gameSlice";

type SyncState = { game: GameState };

function toGameEvent(action: unknown): GameEvent | null {
  if (startGame.match(action)) return { type: "START", ...action.payload };
  if (wordReady.match(action)) return { type: "WORD_READY", word: action.payload };
  if (briefingReady.match(action))
    return { type: "BRIEFING_READY", playerId: action.payload };
  if (briefingNext.match(action)) return { type: "BRIEFING_NEXT" };
  if (submitClue.match(action)) return { type: "CLUE", text: action.payload };
  if (debateDone.match(action)) return { type: "DEBATE_DONE" };
  if (castVote.match(action)) return { type: "VOTE", ...action.payload };
  if (continueGame.match(action)) return { type: "CONTINUE", ...action.payload };
  if (submitGuess.match(action)) return { type: "GUESS", text: action.payload };
  if (resetGame.match(action)) return { type: "RESET" };
  return null;
}

export function canAcceptRemoteEvent(
  state: GameState,
  event: GameEvent,
  playerId: string,
  hostPlayerId: string,
): boolean {
  if (event.type === "START" || event.type === "WORD_READY") return false;
  if (event.type === "BRIEFING_READY")
    return (
      event.playerId === playerId &&
      state.phase === "briefing" &&
      !!state.round?.seating.includes(playerId) &&
      !state.round.briefingReadyIds.includes(playerId)
    );
  if (event.type === "CLUE")
    return (
      currentSpeakerId(state) === playerId &&
      clueProblem(state, event.text) === null
    );
  if (event.type === "VOTE")
    return (
      event.voterId === playerId &&
      currentVoterId(state) === playerId &&
      voteProblem(state, event.voterId, event.targets) === null
    );
  if (event.type === "GUESS")
    return (
      currentGuesserId(state) === playerId &&
      state.phase === "lastChance" &&
      event.text.trim().length > 0
    );
  if (playerId !== hostPlayerId) return false;
  if (event.type === "DEBATE_DONE") return state.phase === "debate";
  if (event.type === "CONTINUE") return state.phase === "reveal";
  if (event.type === "BRIEFING_NEXT") return state.phase === "briefing";
  return event.type === "RESET";
}

export const roomSyncMiddleware: Middleware<unknown, SyncState> =
  ({ dispatch, getState }) => {
    roomNetwork.setRemoteActionHandler((playerId, event) => {
      const room = roomNetwork.getState();
      if (room.role === "host") {
        if (
          !room.hostPlayerId ||
          !canAcceptRemoteEvent(
            getState().game,
            event,
            playerId,
            room.hostPlayerId,
          )
        ) {
          return false;
        }
        dispatch(receiveEvent(event));
        if (getState().game.phase === "gameOver")
          roomNetwork.setGameFinished();
        roomNetwork.broadcastGameEvent(event);
        return true;
      }
      if (room.role === "client") {
        dispatch(receiveEvent(event));
        if (event.type === "RESET" || getState().game.phase === "gameOver")
          roomNetwork.setGameFinished();
        return true;
      }
      return false;
    });

    return (next) => (action) => {
      const event = toGameEvent(action);
      const room = roomNetwork.getState();
      if (event && room.role === "client") {
        roomNetwork.sendGameEvent(event);
        return action;
      }

      const result = next(action as UnknownAction);
      if (event && room.role === "host") {
        if (event.type === "START") roomNetwork.setGameStarted();
        else if (event.type === "RESET" || getState().game.phase === "gameOver")
          roomNetwork.setGameFinished();
        roomNetwork.broadcastGameEvent(event);
      }
      return result;
    };
  };
