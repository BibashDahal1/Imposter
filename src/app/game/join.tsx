import { useRouter } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/components/Button";
import { FieldLabel, Help, Segmented, TextField } from "@/components/FormKit";
import { ScreenHeader } from "@/components/ScreenHeader";
import { roomNetwork } from "@/features/rooms/roomNetwork";
import type { RoomMode } from "@/features/rooms/types";
import { useRoomState } from "@/features/rooms/useRoomState";
import { useAppTheme } from "@/theme/useAppTheme";

const MAX_WIDTH = 520;

export default function JoinRoom() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const room = useRoomState();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [mode, setMode] = useState<RoomMode>("nearby");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const join = async () => {
    setBusy(true);
    setError(null);
    try {
      await roomNetwork.join(code, name, mode);
      router.replace("/play/game");
    } catch (reason) {
      let message =
        reason instanceof Error ? reason.message : "Could not join the room.";
      try {
        await roomNetwork.leave();
      } catch (cleanupError) {
        message += ` Connection cleanup failed: ${
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

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <ScreenHeader title="Join room" />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: insets.bottom + 24 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.column}>
          <Text style={[styles.intro, { color: colors.ink }]}>
            Join {mode === "online" ? "an online" : "a nearby"} game
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
              ? "Enter the host’s six-digit code. You can join from any internet connection."
              : "Connect to the host’s Wi-Fi or hotspot, then enter the six-digit room code they shared with you."}
          </Help>
          <FieldLabel>Six-digit room code</FieldLabel>
          <TextField
            accessibilityLabel="Six-digit room code"
            value={code}
            onChangeText={(value) =>
              setCode(value.replace(/\D/g, "").slice(0, 6))
            }
            placeholder="000000"
            keyboardType="number-pad"
            maxLength={6}
            returnKeyType="next"
          />
          <FieldLabel>Your player name</FieldLabel>
          <TextField
            accessibilityLabel="Your player name"
            value={name}
            onChangeText={setName}
            placeholder="Enter your name"
            maxLength={16}
            returnKeyType="go"
            onSubmitEditing={() => void join()}
          />
          {error || room.error ? (
            <Text accessibilityRole="alert" style={{ color: colors.accent }}>
              {error ?? room.error}
            </Text>
          ) : null}
          <Button
            variant="primary"
            label={busy ? "Finding room…" : "Join room"}
            disabled={busy || code.length !== 6 || name.trim().length === 0}
            onPress={() => void join()}
          />
          <Button
            variant="outline"
            label="Back"
            onPress={() => router.back()}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { alignItems: "center", padding: 16 },
  column: { width: "100%", maxWidth: MAX_WIDTH, gap: 14 },
  intro: { fontSize: 20, fontWeight: "700" },
});
