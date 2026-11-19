import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import WebSocket from "ws";

import { createRoomService } from "../src/server.js";

let service;
let url;
const sockets = new Set();

beforeEach(async () => {
  service = createRoomService();
  await new Promise((resolve) => service.httpServer.listen(0, "127.0.0.1", resolve));
  const { port } = service.httpServer.address();
  url = `ws://127.0.0.1:${port}`;
});

afterEach(async () => {
  for (const socket of sockets) socket.terminate();
  sockets.clear();
  await service.close();
});

function connect() {
  const socket = new WebSocket(url);
  sockets.add(socket);
  return new Promise((resolve, reject) => {
    socket.once("open", () => resolve(socket));
    socket.once("error", reject);
  });
}

function nextPacket(socket) {
  return new Promise((resolve, reject) => {
    const onMessage = (data) => {
      cleanup();
      try {
        resolve(JSON.parse(data.toString()));
      } catch (error) {
        reject(error);
      }
    };
    const onError = (error) => {
      cleanup();
      reject(error);
    };
    const cleanup = () => {
      socket.off("message", onMessage);
      socket.off("error", onError);
    };
    socket.once("message", onMessage);
    socket.once("error", onError);
  });
}

function create(socket, name) {
  const response = nextPacket(socket);
  socket.send(JSON.stringify({ type: "create", name }));
  return response;
}

describe("online room server", () => {
  it("reports healthy over HTTP", async () => {
    const response = await fetch(`${url.replace("ws://", "http://")}/health`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: "ok" });
  });

  it("creates six-digit rooms and updates the lobby for joined players", async () => {
    const host = await connect();
    const created = await create(host, "Host");
    assert.equal(created.type, "created");
    assert.equal(created.protocolVersion, 2);
    assert.match(created.code, /^\d{6}$/);
    assert.equal(created.players[0].name, "Host");

    const lobbyUpdate = nextPacket(host);
    const client = await connect();
    const welcome = nextPacket(client);
    client.send(
      JSON.stringify({ type: "join", code: created.code, name: "Player" }),
    );
    const joined = await welcome;
    assert.equal(joined.type, "welcome");
    assert.equal(joined.protocolVersion, 2);
    const lobby = await lobbyUpdate;
    assert.equal(lobby.type, "lobby");
    assert.deepEqual(
      lobby.players.map((player) => player.name),
      ["Host", "Player"],
    );
  });

  it("routes player actions to the host and host events to players", async () => {
    const host = await connect();
    const created = await create(host, "Host");
    const client = await connect();
    const welcome = nextPacket(client);
    client.send(
      JSON.stringify({ type: "join", code: created.code, name: "Player" }),
    );
    const clientWelcome = await welcome;
    await nextPacket(host);

    const readyEvent = nextPacket(host);
    client.send(
      JSON.stringify({
        type: "gameEvent",
        event: { type: "BRIEFING_READY", playerId: "self-reported-id" },
      }),
    );
    assert.deepEqual(await readyEvent, {
      type: "gameEvent",
      event: { type: "BRIEFING_READY", playerId: "self-reported-id" },
      fromPlayerId: clientWelcome.playerId,
    });

    const hostAction = nextPacket(host);
    client.send(
      JSON.stringify({
        type: "gameEvent",
        event: { type: "CLUE", text: "mild" },
        fromPlayerId: "forged-host-id",
      }),
    );
    assert.deepEqual(await hostAction, {
      type: "gameEvent",
      event: { type: "CLUE", text: "mild" },
      fromPlayerId: clientWelcome.playerId,
    });

    const clientEvent = nextPacket(client);
    host.send(
      JSON.stringify({
        type: "gameEvent",
        event: { type: "DEBATE_DONE" },
      }),
    );
    assert.deepEqual(await clientEvent, {
      type: "gameEvent",
      event: { type: "DEBATE_DONE" },
    });
  });

  it("rejects duplicate names and joins after a game starts", async () => {
    const host = await connect();
    const created = await create(host, "Host");
    const currentPlayer = await connect();
    const lobbyUpdate = nextPacket(host);
    const welcome = nextPacket(currentPlayer);
    currentPlayer.send(
      JSON.stringify({
        type: "join",
        code: created.code,
        name: "Current Player",
      }),
    );
    await welcome;
    await lobbyUpdate;

    const duplicate = await connect();
    const duplicateError = nextPacket(duplicate);
    duplicate.send(
      JSON.stringify({ type: "join", code: created.code, name: "host" }),
    );
    assert.match((await duplicateError).message, /already in this room/i);

    const startedEvent = nextPacket(currentPlayer);
    host.send(
      JSON.stringify({
        type: "gameEvent",
        event: { type: "START", seed: 1, config: {} },
      }),
    );
    assert.equal((await startedEvent).event.type, "START");

    const late = await connect();
    const lateError = nextPacket(late);
    late.send(
      JSON.stringify({ type: "join", code: created.code, name: "Late" }),
    );
    assert.match((await lateError).message, /already started/i);
  });
});
