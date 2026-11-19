import { useRouter } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/components/Button";
import { FieldLabel, Help, Segmented, TextField } from "@/components/FormKit";
import { ScreenHeader } from "@/components/ScreenHeader";
import { maxSpies, validate, type SetupState } from "@/store/setupSlice";
import { toGameConfig } from "@/features/game/toGameConfig";
import { roomNetwork } from "@/features/rooms/roomNetwork";
import type { RoomMode } from "@/features/rooms/types";
import { useRoomState } from "@/features/rooms/useRoomState";
import { startGame } from "@/store/gameSlice";
import { useAppDispatch, useAppSelector } from "@/store";
import { useAppTheme } from "@/theme/useAppTheme";
import { minPlayers } from "@/store/setupSlice";

const MAX_WIDTH = 520;

export default function CreateRoom() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const room = useRoomState();
  const setup = useAppSelector((state) => state.setup);
  const [name, setName] = useState("");
  const [mode, setMode] = useState<RoomMode>("nearby");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isLobby = room.role === "host" && room.status !== "idle";
  const roomSetup: SetupState = {
    ...setup,
    players: room.players.map(({ id, name }) => ({ id, name })),
    spies: Math.min(setup.spies, maxSpies(room.players.length)),
  };
  const validation = validate(roomSetup);
  const minimum = minPlayers(setup.style);

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      await roomNetwork.createHost(name, mode);
    } catch (reason) {
      let message =
        reason instanceof Error ? reason.message : "Could not create the room.";
      try {
        await roomNetwork.leave();
      } catch (cleanupError) {
        message += ` Room cleanup failed: ${
          cleanupError instanceof Error
            ? cleanupError.message
            : "unknown error"
        }`;
      }
      setError(message);
    } finally {
      setBusy(false);
    }
  };

  const start = () => {
    if (!validation.ok || room.players.length < minimum) return;
    const config = toGameConfig(roomSetup);
    dispatch(startGame(config));
    router.replace("/play/game");
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <ScreenHeader title="Create room" />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: insets.bottom + 24 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.column}>
          {!isLobby ? (
            <>
              <Text style={[styles.intro, { color: colors.ink }]}>
                Host {mode === "online" ? "an online" : "a nearby"} game
              </Text>
              <FieldLabel>Connection type</FieldLabel>
              <Segmented<RoomMode>
                label="Connection type"
                value={mode}
                onChange={(value) => {
                  setMode(value);
                  setError(null);
                }}
                options={[
                  { value: "nearby", label: "Wi-Fi / hotspot" },
                  { value: "online", label: "Online" },
                ]}
              />
              <Help>
                {mode === "online"
                  ? "Create an internet room and share its six-digit code. Players can join from anywhere; an online room server must be configured for this app."
                  : "Connect every phone to the same Wi-Fi network or hotspot first. Turn on your phone’s hotspot in system Settings; the app cannot enable it for you."}
              </Help>
              <FieldLabel>Your player name</FieldLabel>
              <TextField
                accessibilityLabel="Your player name"
                value={name}
                onChangeText={setName}
                placeholder="Enter your name"
                maxLength={16}
                returnKeyType="go"
                onSubmitEditing={() => void create()}
              />
              {error ? (
                <Text accessibilityRole="alert" style={{ color: colors.accent }}>
                  {error}
                </Text>
              ) : null}
              <Button
                variant="primary"
                label={busy ? "Starting room…" : "Create room"}
                disabled={busy || name.trim().length === 0}
                onPress={() => void create()}
              />
              <Button
                variant="outline"
                label="Back"
                onPress={() => router.back()}
              />
            </>
          ) : (
            <>
              <Text style={[styles.intro, { color: colors.ink }]}>
                Room code
              </Text>
              <Text
                accessibilityLabel={`Room code ${room.code}`}
                style={[styles.code, { color: colors.accent }]}
              >
                {room.code}
              </Text>
              <Help>
                Share this six-digit code.{" "}
                {room.mode === "online"
                  ? "Players can join from any internet connection."
                  : "Joining phones must be connected to your Wi-Fi or hotspot."}
              </Help>
              <Help>
                Choose game style, word packs, hint level, clue style, and timer
                before starting.
              </Help>
              {room.error ? (
                <Text accessibilityRole="alert" style={{ color: colors.accent }}>
                  {room.error}
                </Text>
              ) : null}
              {setup.spies > roomSetup.spies ? (
                <Help>
                  Spy count is capped at {roomSetup.spies} for the current
                  number of players.
                </Help>
              ) : null}

              <Text style={[styles.sectionTitle, { color: colors.ink }]}>
                Players ({room.players.length}/12)
              </Text>
              <View style={[styles.players, { backgroundColor: colors.surface }]}>
                {room.players.map((player, index) => (
                  <Text
                    key={player.id}
                    style={[styles.player, { color: colors.ink }]}
                  >
                    {index + 1}. {player.name}
                    {player.id === room.hostPlayerId ? " (host)" : ""}
                  </Text>
                ))}
              </View>
              <Help>
                {room.players.length < minimum
                  ? `Waiting for players. ${minimum} are needed for ${setup.style === "elimination" ? "Elimination" : "Two-round guess"}.`
                  : "Players are ready. Start when everyone has joined."}
              </Help>

              {validation.errors.map((message) => (
                <Text
                  key={message}
                  accessibilityRole="alert"
                  style={[styles.error, { color: colors.accent }]}
                >
                  {message}
                </Text>
              ))}

              <Button
                variant="outline"
                label="Edit game options"
                onPress={() => router.push("/play/options")}
              />
              <Button
                variant="primary"
                label="Start game"
                disabled={
                  room.status !== "lobby" ||
                  room.players.length < minimum ||
                  room.players.length > 12 ||
                  !validation.ok
                }
                onPress={start}
              />
              <Button
                variant="outline"
                label="Cancel room"
                onPress={() => void cancelRoom()}
              />
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );

  async function cancelRoom() {
    try {
      await roomNetwork.leave();
      router.back();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Could not close the room.",
      );
    }
  }
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { alignItems: "center", padding: 16 },
  column: { width: "100%", maxWidth: MAX_WIDTH, gap: 14 },
  intro: { fontSize: 20, fontWeight: "700" },
  code: {
    fontSize: 48,
    fontWeight: "800",
    letterSpacing: 8,
    textAlign: "center",
  },
  sectionTitle: { fontSize: 18, fontWeight: "700" },
  players: { borderRadius: 14, padding: 14, gap: 8 },
  player: { fontSize: 16 },
  error: { fontSize: 13, lineHeight: 19 },
});
