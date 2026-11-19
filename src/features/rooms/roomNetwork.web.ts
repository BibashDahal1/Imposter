import type { GameEvent } from "../../engine/types";

import { OnlineRoomNetwork } from "./onlineRoomNetwork";
import { createRoomNetworkController } from "./roomNetworkController";
import type { RoomState } from "./types";
import { initialRoomState } from "./types";

const errorMessage =
  "Nearby rooms require the installed Android or iOS app. Use Pass & Play on web.";

const unavailableNearby = {
  getState: (): RoomState => initialRoomState,
  subscribe: (_listener: (state: RoomState) => void) => () => {},
  setRemoteActionHandler: (
    _handler: ((id: string, event: GameEvent) => boolean) | null,
  ) => {},
  createHost: async (_name: string): Promise<RoomState> => {
    throw new Error(errorMessage);
  },
  join: async (_code: string, _name: string): Promise<RoomState> => {
    throw new Error(errorMessage);
  },
  sendGameEvent: (_event: GameEvent) => {
    throw new Error(errorMessage);
  },
  broadcastGameEvent: (_event: GameEvent) => {},
  setGameStarted: () => {},
  setGameFinished: () => {},
  leave: async () => {},
};

export const roomNetwork = createRoomNetworkController(
  unavailableNearby,
  new OnlineRoomNetwork(),
);
