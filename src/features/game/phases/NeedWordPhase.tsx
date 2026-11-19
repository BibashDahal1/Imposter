import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/Button";
import { drawWord } from "@/content/pickWord";
import { roomNetwork } from "@/features/rooms/roomNetwork";
import { useRoomState } from "@/features/rooms/useRoomState";
import { resetGame, wordReady } from "@/store/gameSlice";
import { fonts } from "@/theme/fonts";
import { useAppTheme } from "@/theme/useAppTheme";

import { PhaseFrame, roundTitle, useGame } from "../GameKit";

/** Picks the secret word for the round, then moves on to the briefing. */
export default function NeedWordPhase() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const room = useRoomState();
  const { game, dispatch, config, round } = useGame();
  const [failure, setFailure] = useState<{
    title: string;
    message: string;
  } | null>(null);
  const [exitError, setExitError] = useState<string | null>(null);
  const drawn = useRef("");
  const key = `${game.gameNo}-${round.index}`;

  useEffect(() => {
    if (room.role === "client") return;
    if (drawn.current === key) return; // draw once per round, even if the screen renders twice
    drawn.current = key;
    drawWord({
      packIds: config.packIds,
      lang: config.language,
      level: config.hint,
    })
      .then((w) =>
        w
          ? dispatch(wordReady({ id: w.id, word: w.word, hint: w.hint }))
          : setFailure({
              title: "No playable word found",
              message:
                "The selected packs have no words in this language. Go back and choose another pack or language.",
            }),
      )
      .catch((error: unknown) =>
        setFailure({
          title: "Could not load word packs",
          message:
            error instanceof Error
              ? error.message
              : "An unexpected error occurred while loading the selected packs.",
        }),
      );
  }, [key, config, dispatch, room.role]);

  return (
    <PhaseFrame title={roundTitle(config, round)} subtitle="Getting ready">
      <View style={styles.center}>
        {failure ? (
          <>
            <Text
              accessibilityRole="alert"
              style={[styles.title, { color: colors.accent }]}
            >
              {failure.title}
            </Text>
            <Text style={[styles.text, { color: colors.inkSoft }]}>
              {failure.message}
            </Text>
            <Button
              variant="primary"
              label={room.role ? "Leave room and go back" : "Back to options"}
              onPress={() => {
                if (room.role) {
                  void leaveRoom();
                  return;
                }
                dispatch(resetGame());
                router.replace("/play/options");
              }}
            />
            {exitError ? (
              <Text
                accessibilityRole="alert"
                style={[styles.text, { color: colors.accent }]}
              >
                {exitError}
              </Text>
            ) : null}
          </>
        ) : (
          <Text style={[styles.text, { color: colors.inkSoft }]}>
            {room.role === "client"
              ? "Waiting for the host to choose a secret word…"
              : "Choosing a secret word…"}
          </Text>
        )}
      </View>
    </PhaseFrame>
  );

  async function leaveRoom() {
    try {
      await roomNetwork.leave();
      dispatch(resetGame());
      router.replace("/play/options");
    } catch (error) {
      setExitError(
        error instanceof Error ? error.message : "Could not leave the room.",
      );
    }
  }
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    paddingVertical: 48,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 28,
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  text: { fontSize: 15, lineHeight: 22, textAlign: "center" },
});
