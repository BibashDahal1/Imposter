import type { GameEvent } from "../../engine/types";

export const ROOM_PROTOCOL_VERSION = 2;

export type RoomPlayer = {
  id: string;
  name: string;
};

export type RoomMode = "nearby" | "online";
export type RoomStatus = "idle" | "connecting" | "lobby" | "playing" | "error";
export type RoomRole = "host" | "client" | null;

export type RoomState = {
  status: RoomStatus;
  role: RoomRole;
  mode: RoomMode | null;
  code: string | null;
  players: RoomPlayer[];
  localPlayerId: string | null;
  hostPlayerId: string | null;
  error: string | null;
};

export type RoomPacket =
  | { type: "create"; name: string }
  | { type: "join"; code: string; name: string }
  | {
      type: "created";
      protocolVersion?: number;
      code: string;
      playerId: string;
      hostPlayerId: string;
      players: RoomPlayer[];
    }
  | {
      type: "welcome";
      protocolVersion?: number;
      playerId: string;
      hostPlayerId: string;
      players: RoomPlayer[];
    }
  | { type: "lobby"; players: RoomPlayer[] }
  | { type: "gameEvent"; event: GameEvent; fromPlayerId?: string }
  | { type: "error"; message: string };

export const initialRoomState: RoomState = {
  status: "idle",
  role: null,
  mode: null,
  code: null,
  players: [],
  localPlayerId: null,
  hostPlayerId: null,
  error: null,
};

export function isRoomPacket(value: unknown): value is RoomPacket {
  if (typeof value !== "object" || value === null || !("type" in value))
    return false;
  const packet = value as Record<string, unknown>;
  if (packet.type === "create")
    return typeof packet.name === "string";
  if (packet.type === "join")
    return typeof packet.code === "string" && typeof packet.name === "string";
  const isPlayers = (players: unknown): players is RoomPlayer[] =>
    Array.isArray(players) &&
    players.every(
      (player) =>
        typeof player === "object" &&
        player !== null &&
        "id" in player &&
        typeof player.id === "string" &&
        "name" in player &&
        typeof player.name === "string",
    );
  if (packet.type === "created")
    return (
      (!("protocolVersion" in packet) ||
        packet.protocolVersion === ROOM_PROTOCOL_VERSION) &&
      typeof packet.code === "string" &&
      typeof packet.playerId === "string" &&
      typeof packet.hostPlayerId === "string" &&
      isPlayers(packet.players)
    );
  if (packet.type === "welcome")
    return (
      (!("protocolVersion" in packet) ||
        packet.protocolVersion === ROOM_PROTOCOL_VERSION) &&
      typeof packet.playerId === "string" &&
      typeof packet.hostPlayerId === "string" &&
      isPlayers(packet.players)
    );
  if (packet.type === "lobby") return isPlayers(packet.players);
  if (packet.type === "gameEvent") {
    if (
      "fromPlayerId" in packet &&
      typeof packet.fromPlayerId !== "string"
    )
      return false;
    if (typeof packet.event !== "object" || packet.event === null) return false;
    const event = packet.event as Record<string, unknown>;
    switch (event.type) {
      case "START":
        return (
          typeof event.seed === "number" &&
          Number.isFinite(event.seed) &&
          typeof event.config === "object" &&
          event.config !== null
        );
      case "WORD_READY":
        return (
          typeof event.word === "object" &&
          event.word !== null &&
          "id" in event.word &&
          typeof event.word.id === "string" &&
          "word" in event.word &&
          typeof event.word.word === "string" &&
          "hint" in event.word &&
          typeof event.word.hint === "string"
        );
      case "DEBATE_DONE":
      case "RESET":
      case "BRIEFING_NEXT":
        return true;
      case "BRIEFING_READY":
        return typeof event.playerId === "string";
      case "CLUE":
      case "GUESS":
        return typeof event.text === "string";
      case "VOTE":
        return (
          typeof event.voterId === "string" &&
          Array.isArray(event.targets) &&
          event.targets.every((target) => typeof target === "string") &&
          typeof event.seed === "number" &&
          Number.isFinite(event.seed)
        );
      case "CONTINUE":
        return typeof event.seed === "number" && Number.isFinite(event.seed);
      default:
        return false;
    }
  }
  return packet.type === "error" && typeof packet.message === "string";
}
