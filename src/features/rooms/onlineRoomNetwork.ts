import type { GameEvent } from "@/engine/types";

import {
  initialRoomState,
  isRoomPacket,
  ROOM_PROTOCOL_VERSION,
  type RoomPacket,
  type RoomState,
} from "./types";

const CONNECT_TIMEOUT_MS = 8_000;

type RemoteActionHandler = (playerId: string, event: GameEvent) => boolean;

function cleanName(value: string) {
  return value.trim().replace(/\s+/g, " ").slice(0, 16);
}

function getServerUrl() {
  const url = process.env.EXPO_PUBLIC_ROOM_SERVER_URL?.trim();
  if (!url) {
    throw new Error(
      "Online rooms are not configured. Set EXPO_PUBLIC_ROOM_SERVER_URL to the deployed wss:// room server.",
    );
  }
  if (!/^wss?:\/\/[^/\s]+(?:\/.*)?$/i.test(url)) {
    throw new Error(
      "The online room server URL must start with ws:// or wss://.",
    );
  }
  return url;
}

export class OnlineRoomNetwork {
  private state: RoomState = initialRoomState;
  private readonly listeners = new Set<(state: RoomState) => void>();
  private socket: WebSocket | null = null;
  private remoteActionHandler: RemoteActionHandler | null = null;

  getState = () => this.state;

  subscribe = (listener: (state: RoomState) => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  setRemoteActionHandler(handler: RemoteActionHandler | null) {
    this.remoteActionHandler = handler;
  }

  createHost(rawName: string) {
    const name = cleanName(rawName);
    if (!name) return Promise.reject(new Error("Enter your name before creating a room."));
    return this.connect({ type: "create", name }, "host");
  }

  join(rawCode: string, rawName: string) {
    const code = rawCode.trim();
    const name = cleanName(rawName);
    if (!/^\d{6}$/.test(code))
      return Promise.reject(new Error("Enter the 6-digit room code."));
    if (!name) return Promise.reject(new Error("Enter your name before joining."));
    return this.connect({ type: "join", code, name }, "client", code);
  }

  sendGameEvent(event: GameEvent) {
    if (this.state.role !== "client" || this.socket?.readyState !== WebSocket.OPEN)
      throw new Error("You are not connected to an online room.");
    this.send({ type: "gameEvent", event });
  }

  broadcastGameEvent(event: GameEvent) {
    if (this.state.role !== "host" || this.socket?.readyState !== WebSocket.OPEN)
      return;
    this.send({ type: "gameEvent", event });
  }

  setGameStarted() {
    this.state = { ...this.state, status: "playing" };
    this.emit();
  }

  setGameFinished() {
    this.state = { ...this.state, status: "lobby" };
    this.emit();
  }

  async leave() {
    const socket = this.socket;
    this.socket = null;
    this.state = initialRoomState;
    this.emit();
    socket?.close();
  }

  private connect(
    request: Extract<RoomPacket, { type: "create" | "join" }>,
    role: Exclude<RoomState["role"], null>,
    code: string | null = null,
  ) {
    if (this.state.status !== "idle")
      return Promise.reject(new Error("Leave the current room before connecting."));

    let url: string;
    try {
      url = getServerUrl();
    } catch (error) {
      return Promise.reject(error);
    }

    this.state = {
      ...initialRoomState,
      status: "connecting",
      role,
      mode: "online",
      code,
    };
    this.emit();

    return new Promise<RoomState>((resolve, reject) => {
      let settled = false;
      let socket: WebSocket;
      try {
        socket = new WebSocket(url);
      } catch (error) {
        const reason =
          error instanceof Error
            ? error
            : new Error("Could not connect to the online room server.");
        this.setError(reason.message);
        reject(reason);
        return;
      }
      this.socket = socket;
      const timeout = setTimeout(() => {
        if (settled) return;
        const error = new Error("The online room server did not respond in time.");
        this.setError(error.message);
        socket.close();
        settled = true;
        reject(error);
      }, CONNECT_TIMEOUT_MS);
      const settle = (error?: Error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        if (error) reject(error);
        else resolve(this.state);
      };

      socket.onopen = () => {
        try {
          socket.send(JSON.stringify(request));
        } catch (error) {
          const reason =
            error instanceof Error ? error : new Error("Could not contact the room server.");
          this.setError(reason.message);
          settle(reason);
        }
      };
      socket.onmessage = (message) => {
        if (typeof message.data !== "string") {
          const error = new Error("The room server sent an invalid message.");
          this.setError(error.message);
          socket.close();
          settle(error);
          return;
        }
        let value: unknown;
        try {
          value = JSON.parse(message.data);
        } catch {
          const error = new Error("The room server sent an invalid message.");
          this.setError(error.message);
          socket.close();
          settle(error);
          return;
        }
        if (
          typeof value === "object" &&
          value !== null &&
          "type" in value &&
          (value.type === "created" || value.type === "welcome") &&
          (!("protocolVersion" in value) ||
            value.protocolVersion !== ROOM_PROTOCOL_VERSION)
        ) {
          const error = new Error(
            "The online room server is outdated. Deploy and restart the latest server, then create a new room.",
          );
          this.setError(error.message);
          socket.close();
          settle(error);
          return;
        }
        if (!isRoomPacket(value)) {
          const error = new Error("The room server sent an invalid message.");
          this.setError(error.message);
          socket.close();
          settle(error);
          return;
        }
        if (value.type === "error") {
          this.setError(value.message);
          socket.close();
          settle(new Error(value.message));
          return;
        }
        if (value.type === "create" || value.type === "join") {
          const error = new Error("The room server sent an invalid message.");
          this.setError(error.message);
          socket.close();
          settle(error);
          return;
        }
        this.handlePacket(value, role);
        if (value.type === "created" || value.type === "welcome")
          settle();
      };
      socket.onerror = () => {
        const error = new Error("Could not connect to the online room server.");
        this.setError(error.message);
        settle(error);
      };
      socket.onclose = () => {
        if (!settled && this.state.status === "connecting") {
          const error = new Error("The room server closed before joining completed.");
          this.setError(error.message);
          settle(error);
        } else if (this.state.status !== "idle" && this.state.status !== "error") {
          this.setError("The online room connection was closed.");
        }
      };
    });
  }

  private handlePacket(
    packet: Exclude<RoomPacket, { type: "create" | "join" | "error" }>,
    role: Exclude<RoomState["role"], null>,
  ) {
    if (packet.type === "created" && role === "host") {
      this.state = {
        ...this.state,
        status: "lobby",
        code: packet.code,
        localPlayerId: packet.playerId,
        hostPlayerId: packet.hostPlayerId,
        players: packet.players,
      };
      this.emit();
    } else if (packet.type === "welcome" && role === "client") {
      this.state = {
        ...this.state,
        status: "lobby",
        localPlayerId: packet.playerId,
        hostPlayerId: packet.hostPlayerId,
        players: packet.players,
      };
      this.emit();
    } else if (packet.type === "lobby") {
      this.state = { ...this.state, players: packet.players };
      this.emit();
    } else if (packet.type === "gameEvent") {
      if (role === "host" && !packet.fromPlayerId) {
        this.setError(
          "The online room server is outdated. Update and restart the room server, then create a new room.",
        );
        return;
      }
      if (role === "client" && packet.event.type === "START")
        this.setGameStarted();
      const playerId =
        role === "host" ? packet.fromPlayerId : this.state.localPlayerId;
      if (playerId) this.remoteActionHandler?.(playerId, packet.event);
    }
  }

  private send(packet: RoomPacket) {
    this.socket?.send(JSON.stringify(packet));
  }

  private setError(error: string) {
    this.state = { ...this.state, status: "error", error };
    this.emit();
  }

  private emit() {
    for (const listener of this.listeners) listener(this.state);
  }
}
