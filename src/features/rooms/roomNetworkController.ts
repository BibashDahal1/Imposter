import type { GameEvent } from "@/engine/types";

import type { RoomMode, RoomState } from "./types";

type RoomTransport = {
  getState: () => RoomState;
  subscribe: (listener: (state: RoomState) => void) => () => void;
  setRemoteActionHandler: (
    handler: ((playerId: string, event: GameEvent) => boolean) | null,
  ) => void;
  createHost: (name: string) => Promise<RoomState>;
  join: (code: string, name: string) => Promise<RoomState>;
  sendGameEvent: (event: GameEvent) => void;
  broadcastGameEvent: (event: GameEvent) => void;
  setGameStarted: () => void;
  setGameFinished: () => void;
  leave: () => Promise<void>;
};

export function createRoomNetworkController(
  nearby: RoomTransport,
  online: RoomTransport,
) {
  const listeners = new Set<(state: RoomState) => void>();
  let active = nearby;
  let unsubscribeActive = active.subscribe(emit);

  function emit() {
    const state = active.getState();
    for (const listener of listeners) listener(state);
  }

  function activate(network: RoomTransport) {
    unsubscribeActive();
    active = network;
    unsubscribeActive = active.subscribe(emit);
    emit();
  }

  return {
    getState: () => active.getState(),
    subscribe(listener: (state: RoomState) => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    setRemoteActionHandler(handler: ((playerId: string, event: GameEvent) => boolean) | null) {
      nearby.setRemoteActionHandler(handler);
      online.setRemoteActionHandler(handler);
    },
    createHost(name: string, mode: RoomMode = "nearby") {
      const network = mode === "online" ? online : nearby;
      activate(network);
      return network.createHost(name);
    },
    join(code: string, name: string, mode: RoomMode = "nearby") {
      const network = mode === "online" ? online : nearby;
      activate(network);
      return network.join(code, name);
    },
    sendGameEvent(event: GameEvent) {
      active.sendGameEvent(event);
    },
    broadcastGameEvent(event: GameEvent) {
      active.broadcastGameEvent(event);
    },
    setGameStarted() {
      active.setGameStarted();
    },
    setGameFinished() {
      active.setGameFinished();
    },
    async leave() {
      await active.leave();
      activate(nearby);
    },
  };
}
