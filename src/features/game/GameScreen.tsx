import { useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/Button";
import { roomNetwork } from "@/features/rooms/roomNetwork";
import { useRoomState } from "@/features/rooms/useRoomState";
import { resetGame } from "@/store/gameSlice";
import { useAppDispatch, useAppSelector } from "@/store";
import { fonts } from "@/theme/fonts";
import { useAppTheme } from "@/theme/useAppTheme";

import BriefingPhase from "./phases/BriefingPhase";
import CluesPhase from "./phases/CluesPhase";
import DebatePhase from "./phases/DebatePhase";
import GameOverPhase from "./phases/GameOverPhase";
import LastChancePhase from "./phases/LastChancePhase";
import NeedWordPhase from "./phases/NeedWordPhase";
import RevealPhase from "./phases/RevealPhase";
import VotePhase from "./phases/VotePhase";
import { PhaseFrame } from "./GameKit";

/** Shows the screen that belongs to the current moment of the game. */
export default function GameScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const room = useRoomState();
  const phase = useAppSelector((s) => s.game.phase);

  if (room.role && room.status === "error") return <RoomErrorScreen />;

  if (room.role === "client" && phase === "idle") {
    return (
      <PhaseFrame
        title="Room lobby"
        subtitle={room.code ? `Room code ${room.code}` : undefined}
      >
        <Text style={[styles.text, { color: colors.inkSoft }]}>
          You joined the room. Waiting for the host to choose game options and
          start.
        </Text>
        <View style={[styles.players, { backgroundColor: colors.surface }]}>
          {room.players.map((player) => (
            <Text key={player.id} style={[styles.text, { color: colors.ink }]}>
              {player.name}
              {player.id === room.hostPlayerId ? " (host)" : ""}
            </Text>
          ))}
        </View>
      </PhaseFrame>
    );
  }

  switch (phase) {
    case "needWord":
      return <NeedWordPhase />;
    case "briefing":
      return <BriefingPhase />;
    case "clues":
      return <CluesPhase />;
    case "debate":
      return <DebatePhase />;
    case "vote":
      return <VotePhase />;
    case "reveal":
      return <RevealPhase />;
    case "lastChance":
      return <LastChancePhase />;
    case "gameOver":
      return <GameOverPhase />;
    default:
      // idle: the page was opened without starting a game (for example after a reload)
      return (
        <View style={[styles.empty, { backgroundColor: colors.bg }]}>
          <Text style={[styles.title, { color: colors.ink }]}>
            No game in progress
          </Text>
          <Text style={[styles.text, { color: colors.inkSoft }]}>
            Set up the players and options to start a game.
          </Text>
          <Button
            variant="primary"
            label="Set up a game"
            onPress={() => router.replace("/play")}
          />
        </View>
      );
  }
}

function RoomErrorScreen() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const room = useRoomState();
  const { colors } = useAppTheme();
  const [error, setError] = useState<string | null>(null);

  const leave = async () => {
    try {
      await roomNetwork.leave();
      dispatch(resetGame());
      router.replace("/play");
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Could not leave the room.",
      );
    }
  };

  return (
    <View style={[styles.empty, { backgroundColor: colors.bg }]}>
      <Text style={[styles.title, { color: colors.ink }]}>
        Room connection lost
      </Text>
      <Text style={[styles.text, { color: colors.inkSoft }]}>
        {room.error ?? "The room can no longer continue this game."}
      </Text>
      {error ? (
        <Text accessibilityRole="alert" style={[styles.text, { color: colors.accent }]}>
          {error}
        </Text>
      ) : null}
      <Button variant="primary" label="Leave room" onPress={() => void leave()} />
    </View>
  );
}

const styles = StyleSheet.create({
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 14,
  },
  players: {
    width: "100%",
    maxWidth: 480,
    borderRadius: 14,
    padding: 14,
    gap: 8,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 30,
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  text: { fontSize: 15, textAlign: "center" },
});
