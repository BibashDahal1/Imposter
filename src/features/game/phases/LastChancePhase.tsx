import { useState } from "react";
import { StyleSheet, Text } from "react-native";

import { Button } from "@/components/Button";
import { TextField } from "@/components/FormKit";
import { submitGuess } from "@/store/gameSlice";
import { useRoomState } from "@/features/rooms/useRoomState";
import { fonts } from "@/theme/fonts";
import { useAppTheme } from "@/theme/useAppTheme";

import { PassGate, PhaseFrame, roundTitle, useGame } from "../GameKit";

/** A caught Spy gets one guess at the secret word. */
export default function LastChancePhase() {
  const { game, round } = useGame();
  const room = useRoomState();
  if (room.role)
    return (
      <RoomGuessTurn
        key={`${round.index}-${game.guessIdx}`}
      />
    );
  const spyId = round.spyIds[game.guessIdx];
  return <GuessTurn key={`${round.index}-${spyId}`} spyId={spyId} />;
}

function RoomGuessTurn() {
  const { colors } = useAppTheme();
  const room = useRoomState();
  const { game, dispatch, config, round, names } = useGame();
  const [text, setText] = useState("");
  const spyId = round.spyIds[game.guessIdx];
  const isMyTurn = room.localPlayerId === spyId;

  return (
    <PhaseFrame title={roundTitle(config, round)} subtitle="Last chance">
      {isMyTurn ? (
        <>
          <Text style={[styles.question, { color: colors.ink }]}>
            What was the secret word?
          </Text>
          <Text style={[styles.help, { color: colors.inkSoft }]}>
            You get one guess. Enter it on your own device.
          </Text>
          <TextField
            accessibilityLabel="Your guess"
            value={text}
            onChangeText={setText}
            placeholder="The secret word"
            returnKeyType="done"
          />
          <Button
            variant="primary"
            label="Lock my guess"
            disabled={text.trim() === ""}
            onPress={() => dispatch(submitGuess(text))}
          />
        </>
      ) : (
        <Text style={[styles.help, { color: colors.inkSoft }]}>
          {names[spyId]} is making a private guess on their device.
        </Text>
      )}
    </PhaseFrame>
  );
}

function GuessTurn({ spyId }: { spyId: string }) {
  const { colors } = useAppTheme();
  const { dispatch, config, round, names } = useGame();
  const [stage, setStage] = useState<"gate" | "guess">("gate");
  const [text, setText] = useState("");
  const title = roundTitle(config, round);

  if (stage === "gate") {
    return (
      <PhaseFrame title={title} subtitle="Last chance">
        <PassGate
          name={names[spyId]}
          line="A caught Spy gets one guess. Pass the phone to"
          onReady={() => setStage("guess")}
        />
      </PhaseFrame>
    );
  }

  return (
    <PhaseFrame
      title={title}
      subtitle="Last chance"
      footer={
        <Button
          testID="lock-guess"
          variant="primary"
          label="Lock my guess"
          disabled={text.trim() === ""}
          onPress={() => dispatch(submitGuess(text))}
        />
      }
    >
      <Text style={[styles.question, { color: colors.ink }]}>
        {names[spyId]}, what was the secret word?
      </Text>
      <Text style={[styles.help, { color: colors.inkSoft }]}>
        Get it right and the Spies win after all. You only get one guess.
      </Text>
      <TextField
        testID="guess-input"
        accessibilityLabel="Your guess"
        value={text}
        onChangeText={setText}
        placeholder="The secret word"
        autoFocus
        returnKeyType="done"
      />
    </PhaseFrame>
  );
}

const styles = StyleSheet.create({
  question: {
    fontFamily: fonts.displayMedium,
    fontSize: 22,
    letterSpacing: 0.5,
  },
  help: { fontSize: 14, lineHeight: 21 },
});
