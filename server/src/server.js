import { randomInt, randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { WebSocket, WebSocketServer } from "ws";

const MAX_PLAYERS = 12;
const MAX_PACKET_LENGTH = 16_384;
const CODE_ATTEMPTS = 20;
const ROOM_PROTOCOL_VERSION = 2;

function cleanName(value) {
  return value.trim().replace(/\s+/g, " ").slice(0, 16);
}

function isGameEvent(value) {
  if (!value || typeof value !== "object") return false;
  switch (value.type) {
    case "START":
      return (
        Number.isFinite(value.seed) &&
        value.config !== null &&
        typeof value.config === "object"
      );
    case "WORD_READY":
      return (
        value.word !== null &&
        typeof value.word === "object" &&
        typeof value.word.id === "string" &&
        typeof value.word.word === "string" &&
        typeof value.word.hint === "string"
      );
    case "DEBATE_DONE":
    case "RESET":
    case "BRIEFING_NEXT":
      return true;
    case "BRIEFING_READY":
      return typeof value.playerId === "string";
    case "CLUE":
    case "GUESS":
      return typeof value.text === "string";
    case "VOTE":
      return (
        typeof value.voterId === "string" &&
        Array.isArray(value.targets) &&
        value.targets.every((target) => typeof target === "string") &&
        Number.isFinite(value.seed)
      );
    case "CONTINUE":
      return Number.isFinite(value.seed);
    default:
      return false;
  }
}

function send(socket, packet) {
  if (socket.readyState === WebSocket.OPEN)
    socket.send(JSON.stringify(packet));
}

function playerList(room) {
  return [...room.players.values()].map(({ id, name }) => ({ id, name }));
}

function broadcastLobby(room) {
  const packet = { type: "lobby", players: playerList(room) };
  for (const player of room.players.values()) send(player.socket, packet);
}

function allocateCode(rooms) {
  for (let attempt = 0; attempt < CODE_ATTEMPTS; attempt += 1) {
    const code = String(randomInt(100_000, 1_000_000));
    if (!rooms.has(code)) return code;
  }
  throw new Error("Could not allocate a room code. Try again.");
}

function sendError(socket, message) {
  send(socket, { type: "error", message });
}

export function createRoomService() {
  const rooms = new Map();
  const connections = new WeakMap();
  const httpServer = createServer((request, response) => {
    if (request.method === "GET" && request.url === "/health") {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ status: "ok" }));
      return;
    }
    response.writeHead(404);
    response.end();
  });
  const webSocketServer = new WebSocketServer({
    server: httpServer,
    maxPayload: MAX_PACKET_LENGTH,
  });

  webSocketServer.on("connection", (socket) => {
    const connection = { roomCode: null, playerId: null, role: null };
    connections.set(socket, connection);

    socket.on("message", (data, isBinary) => {
      if (isBinary || data.length > MAX_PACKET_LENGTH) {
        sendError(socket, "Room messages must be valid JSON and under 16 KB.");
        socket.close(1003, "Invalid message");
        return;
      }

      let packet;
      try {
        packet = JSON.parse(data.toString());
      } catch {
        sendError(socket, "Room sent an invalid message.");
        socket.close(1003, "Invalid JSON");
        return;
      }

      if (connection.role === null) {
        if (packet?.type === "create" && typeof packet.name === "string") {
          createRoom(socket, connection, packet.name);
        } else if (
          packet?.type === "join" &&
          typeof packet.code === "string" &&
          typeof packet.name === "string"
        ) {
          joinRoom(socket, connection, packet.code, packet.name);
        } else {
          sendError(socket, "Create a room or join with a valid room code.");
          socket.close(1008, "Invalid room request");
        }
        return;
      }

      if (packet?.type !== "gameEvent" || !isGameEvent(packet.event)) {
        sendError(socket, "Room sent an invalid game action.");
        return;
      }
      relayGameEvent(socket, connection, packet.event);
    });

    socket.on("close", () => disconnect(socket, connection));
  });

  function createRoom(socket, connection, rawName) {
    const name = cleanName(rawName);
    if (!name) {
      sendError(socket, "Enter a valid player name.");
      socket.close(1008, "Invalid name");
      return;
    }

    let code;
    try {
      code = allocateCode(rooms);
    } catch (error) {
      sendError(socket, error.message);
      socket.close(1011, "Room creation failed");
      return;
    }
    const hostPlayerId = randomUUID();
    const host = { id: hostPlayerId, name, socket };
    const room = {
      code,
      hostPlayerId,
      players: new Map([[hostPlayerId, host]]),
      started: false,
    };
    rooms.set(code, room);
    Object.assign(connection, {
      roomCode: code,
      playerId: hostPlayerId,
      role: "host",
    });
    send(socket, {
      type: "created",
      protocolVersion: ROOM_PROTOCOL_VERSION,
      code,
      playerId: hostPlayerId,
      hostPlayerId,
      players: playerList(room),
    });
  }

  function joinRoom(socket, connection, code, rawName) {
    if (!/^\d{6}$/.test(code)) {
      sendError(socket, "Enter the 6-digit room code.");
      socket.close(1008, "Invalid room code");
      return;
    }
    const room = rooms.get(code);
    if (!room) {
      sendError(socket, "Room not found. Check the code and try again.");
      socket.close(1008, "Room not found");
      return;
    }
    if (room.started) {
      sendError(socket, "This game has already started.");
      socket.close(1008, "Game already started");
      return;
    }
    const name = cleanName(rawName);
    const duplicateName = [...room.players.values()].some(
      (player) => player.name.toLocaleLowerCase() === name.toLocaleLowerCase(),
    );
    if (!name || room.players.size >= MAX_PLAYERS || duplicateName) {
      sendError(
        socket,
        !name
          ? "Enter a valid player name."
          : duplicateName
            ? "That name is already in this room."
            : "This room is full.",
      );
      socket.close(1008, "Cannot join room");
      return;
    }

    const playerId = randomUUID();
    room.players.set(playerId, { id: playerId, name, socket });
    Object.assign(connection, {
      roomCode: code,
      playerId,
      role: "client",
    });
    send(socket, {
      type: "welcome",
      protocolVersion: ROOM_PROTOCOL_VERSION,
      playerId,
      hostPlayerId: room.hostPlayerId,
      players: playerList(room),
    });
    broadcastLobby(room);
  }

  function relayGameEvent(socket, connection, event) {
    const room = rooms.get(connection.roomCode);
    if (!room || room.players.get(connection.playerId)?.socket !== socket) {
      sendError(socket, "That room is no longer available.");
      socket.close(1008, "Room unavailable");
      return;
    }

    if (connection.role === "host") {
      if (event.type === "START") room.started = true;
      else if (event.type === "RESET") room.started = false;
      for (const player of room.players.values()) {
        if (player.id !== room.hostPlayerId)
          send(player.socket, { type: "gameEvent", event });
      }
      return;
    }

    if (!["BRIEFING_READY", "CLUE", "VOTE", "GUESS"].includes(event.type)) {
      sendError(socket, "That action is not allowed from a player device.");
      return;
    }
    const host = room.players.get(room.hostPlayerId);
    if (host)
      send(host.socket, {
        type: "gameEvent",
        event,
        fromPlayerId: connection.playerId,
      });
  }

  function disconnect(socket, connection) {
    const room = rooms.get(connection.roomCode);
    if (!room || room.players.get(connection.playerId)?.socket !== socket) return;

    if (connection.role === "host") {
      rooms.delete(room.code);
      for (const player of room.players.values()) {
        if (player.id !== room.hostPlayerId) {
          sendError(player.socket, "The host closed the room.");
          player.socket.close(1000, "Host left");
        }
      }
      return;
    }

    room.players.delete(connection.playerId);
    if (room.started) {
      const message = "A player disconnected. Leave the room and restart.";
      for (const player of room.players.values()) sendError(player.socket, message);
      return;
    }
    broadcastLobby(room);
  }

  return {
    httpServer,
    async close() {
      for (const socket of webSocketServer.clients) socket.terminate();
      await new Promise((resolve, reject) => {
        webSocketServer.close((error) => (error ? reject(error) : resolve()));
      });
      if (httpServer.listening) {
        await new Promise((resolve, reject) => {
          httpServer.close((error) => (error ? reject(error) : resolve()));
        });
      }
      rooms.clear();
    },
  };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const service = createRoomService();
  const port = Number(process.env.PORT ?? 47830);
  const host = process.env.HOST ?? "0.0.0.0";
  service.httpServer.listen(port, host, () => {
    console.log(`Imposter room server listening on ${host}:${port}`);
  });
}
