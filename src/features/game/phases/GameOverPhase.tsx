import { useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/Button";
import type { Outcome } from "@/engine/types";
import { resetGame, startGame } from "@/store/gameSlice";
import { roomNetwork } from "@/features/rooms/roomNetwork";
import { useRoomState } from "@/features/rooms/useRoomState";
import { fonts } from "@/theme/fonts";
import { useAppTheme } from "@/theme/useAppTheme";
import { minPlayers } from "@/store/setupSlice";

import { PhaseFrame, useGame } from "../GameKit";

const REASON: Record<Outcome["reason"], { one: string; many: string }> = {
  caught: { one: "The Spy was caught.", many: "Every Spy was caught." },
  escaped: {
    one: "The Spy slipped through the vote.",
    many: "A Spy slipped through the vote.",
  },
  "last-chance-correct": {
    one: "The caught Spy guessed the secret word!",
    many: "A caught Spy guessed the secret word!",
  },
  "last-chance-failed": {
    one: "The caught Spy could not guess the word.",
    many: "No caught Spy could guess the word.",
  },
};

export default function GameOverPhase() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const { game, dispatch, config, round, names } = useGame();
  const room = useRoomState();
  const [leaveError, setLeaveError] = useState<string | null>(null);
  const outcome = game.outcome as Outcome;
  const spies = round.spyIds.length;
  const canPlayAgain =
    room.role !== "host" || room.players.length >= minPlayers(config.style);

  const headline =
    outcome.winner === "suspects"
      ? "The Suspects win"
      : spies === 1
        ? "The Spy wins"
        : "The Spies win";
  const reason =
    spies === 1 ? REASON[outcome.reason].one : REASON[outcome.reason].many;

  const leave = async (path: "/" | "/play" | "/play/options") => {
    try {
      if (room.role) await roomNetwork.leave();
      dispatch(resetGame());
      router.replace(path);
    } catch (error) {
      setLeaveError(
        error instanceof Error ? error.message : "The room could not close.",
      );
    }
  };

  return (
    <PhaseFrame title="Game over" canExit={false}>
      <View
        style={[
          styles.banner,
          {
            backgroundColor:
              outcome.winner === "suspects" ? colors.ink : colors.accent,
          },
        ]}
      >
        <Text
          testID="winner"
          accessibilityRole="header"
          style={[
            styles.headline,
            {
              color:
                outcome.winner === "suspects" ? colors.onInk : colors.onAccent,
            },
          ]}
        >
          {headline}
        </Text>
        <Text
          testID="reason"
          style={[
            styles.reason,
            {
              color:
                outcome.winner === "suspects" ? colors.onInk : colors.onAccent,
            },
          ]}
        >
          {reason}
        </Text>
      </View>

      <View style={[styles.history, { backgroundColor: colors.surface }]}>
        <Text style={[styles.historyTitle, { color: colors.ink }]}>
          What happened
        </Text>
        {game.history.map((h) => (
          <View key={h.index} style={styles.historyRow}>
            <Text style={[styles.historyHead, { color: colors.ink }]}>
              {config.style === "two-round"
                ? "The game"
                : `Round ${h.index}${h.isFinal ? " · Final" : ""}`}{" "}
              · {h.word}
            </Text>
            <Text style={[styles.historyText, { color: colors.inkSoft }]}>
              {h.spyIds.length === 1 ? "Spy" : "Spies"}:{" "}
              {h.spyIds.map((id) => names[id]).join(", ")}
            </Text>
            <Text style={[styles.historyText, { color: colors.inkSoft }]}>
              {config.style === "elimination"
                ? `Out: ${names[h.outId as string]} (${h.spyIds.includes(h.outId as string) ? "Spy" : "Suspect"})`
                : `Named: ${h.accused.map((id) => names[id]).join(", ")}`}
            </Text>
          </View>
        ))}
        {game.guesses.map((g, i) => (
          <Text key={i} style={[styles.historyText, { color: colors.inkSoft }]}>
            {names[g.spyId]} guessed “{g.guess}”:{" "}
            {g.correct ? "correct" : "wrong"}
          </Text>
        ))}
      </View>

      {room.role === "client" ? (
        <Text style={[styles.historyText, { color: colors.inkSoft }]}>
          Waiting for the host to start another game.
        </Text>
      ) : (
        <>
          <Button
            testID="play-again"
            variant="primary"
            label="Play again"
            disabled={!canPlayAgain}
            onPress={() =>
              dispatch(
                startGame({
                  ...config,
                  players: room.role
                    ? room.players.map(({ id, name }) => ({ id, name }))
                    : config.players,
                }),
              )
            }
          />
          {!canPlayAgain ? (
            <Text style={[styles.historyText, { color: colors.inkSoft }]}>
              Not enough players remain to start another game.
            </Text>
          ) : null}
        </>
      )}
      <Button
        testID="change-setup"
        variant="solid"
        label={room.role ? "Leave room" : "Change players or options"}
        onPress={() => void leave("/play")}
      />
      {leaveError ? (
        <Text accessibilityRole="alert" style={{ color: colors.accent }}>
          Could not leave the room: {leaveError}
        </Text>
      ) : null}
      {room.role ? null : (
        <Button
          testID="go-home"
          variant="outline"
          label="Home"
          onPress={() => void leave("/")}
        />
      )}
    </PhaseFrame>
  );
}

const styles = StyleSheet.create({
  banner: { borderRadius: 18, padding: 20, gap: 6 },
  headline: {
    fontFamily: fonts.display,
    fontSize: 38,
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  reason: { fontSize: 15, lineHeight: 22 },
  history: { borderRadius: 14, padding: 14, gap: 12 },
  historyTitle: {
    fontFamily: fonts.display,
    fontSize: 18,
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  historyRow: { gap: 2 },
  historyHead: { fontSize: 15, fontWeight: "700" },
  historyText: { fontSize: 14, lineHeight: 20 },
});
