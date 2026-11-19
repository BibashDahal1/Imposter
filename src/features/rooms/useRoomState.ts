import { useEffect, useState } from "react";

import { roomNetwork } from "./roomNetwork";
import type { RoomState } from "./types";

export function useRoomState() {
  const [state, setState] = useState<RoomState>(roomNetwork.getState);

  useEffect(() => roomNetwork.subscribe(setState), []);

  return state;
}
