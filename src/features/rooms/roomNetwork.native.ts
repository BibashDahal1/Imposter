import TcpSocket from "react-native-tcp-socket";
import Zeroconf, {
  type PublishedService,
  type Service,
} from "react-native-zeroconf";

import type { GameEvent } from "@/engine/types";

import type {
  RoomPacket,
  RoomPlayer,
  RoomState,
} from "./types";
import { initialRoomState, isRoomPacket } from "./types";
import { OnlineRoomNetwork } from "./onlineRoomNetwork";
import { createRoomNetworkController } from "./roomNetworkController";

const SERVICE_TYPE = "imposter-room";
const SERVICE_PORT = 47829;
const MAX_PLAYERS = 12;
const MAX_PACKET_LENGTH = 16_384;
const DISCOVERY_TIMEOUT_MS = 8_000;

type Client = ReturnType<typeof TcpSocket.createConnection>;
type Server = ReturnType<typeof TcpSocket.createServer>;
type ServerSocket = Parameters<
  NonNullable<Parameters<typeof TcpSocket.createServer>[1]>
>[0];
type RemoteActionHandler = (playerId: string, event: GameEvent) => boolean;

type HostSocket = {
  playerId: string | null;
  buffer: string;
};

const makeId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

const makeCode = () =>
  String(Math.floor(100_000 + Math.random() * 900_000));

const cleanName = (value: string) =>
  value.trim().replace(/\s+/g, " ").slice(0, 16);

function writePacket(
  socket: Client | ServerSocket,
  packet: RoomPacket,
) {
  socket.write(`${JSON.stringify(packet)}\n`);
}

function parseServiceCode(service: Service): string | null {
  const code = service.txt.code;
  return /^\d{6}$/.test(code) ? code : null;
}

class LocalRoomNetwork {
  private state: RoomState = initialRoomState;
  private readonly listeners = new Set<(state: RoomState) => void>();
  private readonly serverSockets = new Map<
    ServerSocket,
    HostSocket
  >();
  private readonly clients = new Map<string, ServerSocket>();
  private players: RoomPlayer[] = [];
  private server: Server | null = null;
  private zeroconf: Zeroconf | null = null;
  private publishedServiceName: string | null = null;
  private client: Client | null = null;
  private remoteActionHandler: RemoteActionHandler | null = null;
  private started = false;

  getState = () => this.state;

  subscribe = (listener: (state: RoomState) => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  setRemoteActionHandler(handler: RemoteActionHandler | null) {
    this.remoteActionHandler = handler;
  }

  async createHost(rawName: string): Promise<RoomState> {
    if (this.state.status !== "idle")
      throw new Error("Leave the current room before creating another.");
    const name = cleanName(rawName);
    if (!name) throw new Error("Enter your name before creating a room.");

    const code = makeCode();
    const hostPlayer = { id: makeId(), name };
    this.players = [hostPlayer];
    this.started = false;
    this.state = {
      status: "connecting",
      role: "host",
      mode: "nearby",
      code,
      players: this.players,
      localPlayerId: hostPlayer.id,
      hostPlayerId: hostPlayer.id,
      error: null,
    };
    this.emit();

    try {
      await new Promise<void>((resolve, reject) => {
        const server = TcpSocket.createServer((socket) => {
          socket.setEncoding("utf8");
          const clientState: HostSocket = { playerId: null, buffer: "" };
          this.serverSockets.set(socket, clientState);

          socket.on("data", (chunk) => {
            clientState.buffer += String(chunk);
            if (clientState.buffer.length > MAX_PACKET_LENGTH) {
              socket.destroy();
              return;
            }
            const lines = clientState.buffer.split("\n");
            clientState.buffer = lines.pop() ?? "";
            for (const line of lines)
              this.handleHostLine(socket, clientState, line);
          });
          socket.on("close", () => {
            this.serverSockets.delete(socket);
            if (!clientState.playerId) return;
            if (this.started) {
              const message =
                "A player disconnected. Leave the room and restart.";
              this.setError(message);
              this.broadcast({ type: "error", message });
              return;
            }
            this.clients.delete(clientState.playerId);
            this.players = this.players.filter(
              (player) => player.id !== clientState.playerId,
            );
            this.updatePlayers();
            this.broadcast({ type: "lobby", players: this.players });
          });
          socket.on("error", () => {
            socket.destroy();
          });
        });

        this.server = server;
        let listening = false;
        server.on("error", (error) => {
          if (!listening) {
            reject(error);
            return;
          }
          this.setError(`Room server failed: ${error.message}`);
        });
        server.listen({ port: SERVICE_PORT, host: "0.0.0.0" }, () => {
          listening = true;
          resolve();
        });
      });
    } catch (error) {
      await this.leave();
      throw error;
    }

    const zeroconf = new Zeroconf();
    this.zeroconf = zeroconf;
    zeroconf.on("error", (error) => {
      this.setError(`Room discovery failed: ${error.message}`);
    });
    let published: PublishedService;
    try {
      await this.checkLocalNetworkAccess(zeroconf);
      published = await zeroconf.publishService({
        name: `imposter-${code}`,
        type: SERVICE_TYPE,
        protocol: "tcp",
        domain: "local.",
        port: SERVICE_PORT,
        txt: { code },
      });
    } catch (error) {
      this.setError(
        error instanceof Error
          ? `Could not publish the room: ${error.message}`
          : "Could not publish the room on this network.",
      );
      await this.leave();
      throw error;
    }
    this.publishedServiceName = published.name;
    this.state = { ...this.state, status: "lobby" };
    this.emit();
    return this.state;
  }

  async join(
    rawCode: string,
    rawName: string,
    endpoint?: { host: string; port: number },
  ): Promise<RoomState> {
    if (this.state.status !== "idle")
      throw new Error("Leave the current room before joining another.");
    const code = rawCode.trim();
    const name = cleanName(rawName);
    if (!/^\d{6}$/.test(code)) throw new Error("Enter the 6-digit room code.");
    if (!name) throw new Error("Enter your name before joining.");

    this.state = {
      ...initialRoomState,
      status: "connecting",
      role: "client",
      mode: "nearby",
      code,
    };
    this.emit();

    const service = endpoint ? null : await this.discover(code);
    const host = endpoint?.host ?? service?.ipv4[0] ?? service?.addresses[0];
    const port = endpoint?.port ?? service?.port;
    if (!host || !port) {
      this.setError("Could not find that room on this Wi-Fi or hotspot.");
      throw new Error(this.state.error ?? "Could not find the room.");
    }

    await new Promise<void>((resolve, reject) => {
      const client = TcpSocket.createConnection(
        { host, port, connectTimeout: 8_000 },
        () => {
          writePacket(client, { type: "join", code, name });
        },
      );
      this.client = client;
      let buffer = "";
      client.setEncoding("utf8");
      client.on("data", (chunk) => {
        buffer += String(chunk);
        if (buffer.length > MAX_PACKET_LENGTH) {
          client.destroy();
          reject(new Error("Room sent an oversized message."));
          return;
        }
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          const packet = this.decode(line);
          if (!packet) {
            client.destroy();
            reject(new Error("Room sent an invalid message."));
            return;
          }
          if (packet.type === "error") {
            client.destroy();
            reject(new Error(packet.message));
            return;
          }
          this.handleClientPacket(packet);
          if (packet.type === "welcome") resolve();
        }
      });
      client.once("error", (error) => {
        this.setError(`Could not connect to room: ${error.message}`);
        reject(error);
      });
      client.on("close", () => {
        if (this.state.status === "connecting") {
          reject(new Error("The room closed before joining completed."));
        }
        if (this.state.status === "idle") return;
        this.setError("The room connection was closed.");
      });
    });
    return this.state;
  }

  sendGameEvent(event: GameEvent) {
    if (this.state.role !== "client" || !this.client)
      throw new Error("You are not connected to a room.");
    writePacket(this.client, { type: "gameEvent", event });
  }

  broadcastGameEvent(event: GameEvent) {
    if (this.state.role !== "host") return;
    this.broadcast({ type: "gameEvent", event });
  }

  setGameStarted() {
    this.started = true;
    this.state = { ...this.state, status: "playing" };
    this.emit();
  }

  setGameFinished() {
    this.started = false;
    this.state = { ...this.state, status: "lobby" };
    this.emit();
  }

  async leave() {
    const server = this.server;
    const client = this.client;
    const zeroconf = this.zeroconf;
    const publishedServiceName = this.publishedServiceName;
    this.server = null;
    this.client = null;
    this.zeroconf = null;
    this.publishedServiceName = null;
    this.players = [];
    this.clients.clear();
    const sockets = [...this.serverSockets.keys()];
    this.serverSockets.clear();
    this.started = false;
    this.state = initialRoomState;
    this.emit();
    client?.destroy();
    for (const socket of sockets) socket.destroy();
    try {
      if (server?.listening) {
        await new Promise<void>((resolve, reject) => {
          server.close((error) =>
            error ? reject(error) : resolve(),
          );
        });
      }
      if (zeroconf && publishedServiceName)
        await zeroconf.unpublishService(publishedServiceName);
    } finally {
      zeroconf?.stop();
      zeroconf?.removeDeviceListeners();
    }
  }

  private async discover(code: string): Promise<Service | null> {
    const zeroconf = new Zeroconf();
    this.zeroconf = zeroconf;
    await this.checkLocalNetworkAccess(zeroconf);
    return new Promise((resolve, reject) => {
      let settled = false;
      const timeout = setTimeout(() => {
        if (settled) return;
        settled = true;
        zeroconf.stop();
        reject(new Error("Room not found. Check the code and Wi-Fi connection."));
      }, DISCOVERY_TIMEOUT_MS);
      zeroconf.on("resolved", (service) => {
        if (parseServiceCode(service) !== code || settled) return;
        settled = true;
        clearTimeout(timeout);
        zeroconf.stop();
        resolve(service);
      });
      zeroconf.on("error", (error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        zeroconf.stop();
        reject(new Error(`Room discovery failed: ${error.message}`));
      });
      zeroconf.scan({
        type: SERVICE_TYPE,
        protocol: "tcp",
        domain: "local.",
      });
    });
  }

  private async checkLocalNetworkAccess(zeroconf: Zeroconf) {
    const access = await zeroconf.checkLocalNetworkAccess({
      type: SERVICE_TYPE,
      protocol: "tcp",
    });
    if (access !== "granted")
      throw new Error(
        "Allow local network access in Settings to find or host nearby rooms.",
      );
  }

  private handleHostLine(
    socket: ServerSocket,
    clientState: HostSocket,
    line: string,
  ) {
    const packet = this.decode(line);
    if (!packet) {
      socket.destroy();
      return;
    }
    if (!clientState.playerId) {
      if (
        packet.type !== "join" ||
        packet.code !== this.state.code ||
        this.started
      ) {
        writePacket(socket, {
          type: "error",
          message: this.started
            ? "This game has already started."
            : "That room code is not valid.",
        });
        socket.destroy();
        return;
      }
      const name = cleanName(packet.name);
      const duplicateName = this.players.some(
        (player) => player.name.toLocaleLowerCase() === name.toLocaleLowerCase(),
      );
      if (!name || this.players.length >= MAX_PLAYERS || duplicateName) {
        writePacket(socket, {
          type: "error",
          message: !name
            ? "Enter a valid player name."
            : duplicateName
              ? "That name is already in this room."
              : "This room is full.",
        });
        socket.destroy();
        return;
      }
      const player = { id: makeId(), name };
      clientState.playerId = player.id;
      this.players = [...this.players, player];
      this.clients.set(player.id, socket);
      const hostPlayerId = this.state.hostPlayerId;
      if (!hostPlayerId) {
        socket.destroy();
        return;
      }
      writePacket(socket, {
        type: "welcome",
        playerId: player.id,
        hostPlayerId,
        players: this.players,
      });
      this.updatePlayers();
      this.broadcast({ type: "lobby", players: this.players });
      return;
    }

    if (packet.type === "gameEvent") {
      const accepted =
        this.remoteActionHandler?.(clientState.playerId, packet.event) ?? false;
      if (!accepted) {
        writePacket(socket, {
          type: "error",
          message: "That action is not allowed right now.",
        });
      }
    }
  }

  private handleClientPacket(packet: RoomPacket) {
    if (packet.type === "welcome") {
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
      if (packet.event.type === "START") this.setGameStarted();
      const playerId = this.state.localPlayerId;
      if (playerId) this.remoteActionHandler?.(playerId, packet.event);
    } else if (packet.type === "error") {
      this.setError(packet.message);
    }
  }

  private decode(line: string): RoomPacket | null {
    if (line.length === 0 || line.length > MAX_PACKET_LENGTH) return null;
    let value: unknown;
    try {
      value = JSON.parse(line);
    } catch {
      return null;
    }
    return isRoomPacket(value) ? value : null;
  }

  private broadcast(packet: RoomPacket) {
    for (const socket of this.clients.values()) writePacket(socket, packet);
  }

  private updatePlayers() {
    this.state = { ...this.state, players: this.players };
    this.emit();
  }

  private setError(error: string) {
    this.state = { ...this.state, status: "error", error };
    this.emit();
  }

  private emit() {
    for (const listener of this.listeners) listener(this.state);
  }
}

const nearbyRoomNetwork = new LocalRoomNetwork();

export const roomNetwork = createRoomNetworkController(
  nearbyRoomNetwork,
  new OnlineRoomNetwork(),
);
