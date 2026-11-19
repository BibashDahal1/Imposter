import { afterEach, describe, expect, it } from "vitest";

import type { GameEvent } from "@/engine/types";
import { OnlineRoomNetwork } from "../onlineRoomNetwork";

import { createRoomService } from "../../../../server/src/server.js";

const waitFor = async (condition: () => boolean) => {
  const deadline = Date.now() + 2_000;
  while (!condition()) {
    if (Date.now() >= deadline) throw new Error("Timed out waiting for room event.");
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
};

describe("online room event routing", () => {
  let service: ReturnType<typeof createRoomService> | undefined;
  let host: OnlineRoomNetwork | undefined;
  let client: OnlineRoomNetwork | undefined;
  let originalUrl: string | undefined;

  afterEach(async () => {
    await host?.leave();
    await client?.leave();
    await service?.close();
    if (originalUrl === undefined) delete process.env.EXPO_PUBLIC_ROOM_SERVER_URL;
    else process.env.EXPO_PUBLIC_ROOM_SERVER_URL = originalUrl;
  });

  it("routes readiness and clues using the joining player's server identity", async () => {
    originalUrl = process.env.EXPO_PUBLIC_ROOM_SERVER_URL;
    service = createRoomService();
    await new Promise<void>((resolve) => {
      service?.httpServer.listen(0, "127.0.0.1", resolve);
    });
    const address = service.httpServer.address();
    if (!address || typeof address === "string")
      throw new Error("Expected the test relay to listen on a TCP port.");
    process.env.EXPO_PUBLIC_ROOM_SERVER_URL = `ws://127.0.0.1:${address.port}`;

    host = new OnlineRoomNetwork();
    client = new OnlineRoomNetwork();
    const received: { playerId: string; event: GameEvent }[] = [];
    host.setRemoteActionHandler((playerId, event) => {
      received.push({ playerId, event });
      return true;
    });

    const hostState = await host.createHost("Host");
    const clientState = await client.join(hostState.code ?? "", "Player");
    const playerId = clientState.localPlayerId;
    if (!playerId) throw new Error("Expected the joined player to have an id.");
    client.sendGameEvent({ type: "BRIEFING_READY", playerId });

    await waitFor(() => received.length === 1);
    expect(received[0]).toEqual({
      playerId,
      event: { type: "BRIEFING_READY", playerId },
    });

    client.sendGameEvent({ type: "CLUE", text: "mild" });

    await waitFor(() => received.length === 2);
    expect(received[1]).toEqual({
      playerId,
      event: { type: "CLUE", text: "mild" },
    });
  });
});
