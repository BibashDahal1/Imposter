import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/Button";
import { TextField } from "@/components/FormKit";
import { clueProblem, MAX_CLUE_LENGTH, roleOf } from "@/engine/game";
import { useRoomState } from "@/features/rooms/useRoomState";
import { submitClue } from "@/store/gameSlice";
import { fonts } from "@/theme/fonts";
import { useAppTheme } from "@/theme/useAppTheme";

import {
  ClueList,
  Countdown,
  PassGate,
  PhaseFrame,
  RoleCard,
  roundTitle,
  useGame,
} from "../GameKit";

/** One clue per player, in turn. */
export default function CluesPhase() {
  const { round } = useGame();
  const room = useRoomState();
  if (room.role)
    return (
      <RoomClueTurn
        key={`${round.index}-${round.clueRound}-${round.turnIdx}`}
      />
    );
  // a new key gives every turn empty fields and a fresh timer
  return (
    <ClueTurn key={`${round.index}-${round.clueRound}-${round.turnIdx}`} />
  );
}

function RoomClueTurn() {
  const { colors } = useAppTheme();
  const room = useRoomState();
  const { game, dispatch, config, round, names } = useGame();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [peek, setPeek] = useState(false);
  const speakerId = round.order[round.turnIdx];
  const isMyTurn = room.localPlayerId === speakerId;
  const typed = config.clueInput === "typed";
  const lastTurn =
    round.turnIdx === round.order.length - 1 &&
    (config.style === "elimination" || round.clueRound === 2);

  const send = () => {
    const problem = clueProblem(game, text);
    if (problem) {
      setError(problem);
      return;
    }
    dispatch(submitClue(text));
  };

  if (peek && isMyTurn) {
    const role = roleOf(round, speakerId);
    const others =
      role === "spy" && config.spiesKnowEachOther
        ? round.spyIds.filter((id) => id !== speakerId).map((id) => names[id])
        : [];
    return (
      <PhaseFrame
        title={roundTitle(config, round)}
        subtitle="Your private card"
        footer={
          <Button
            variant="primary"
            label="Back to clue"
            onPress={() => setPeek(false)}
          />
        }
      >
        <RoleCard
          role={role}
          word={round.word?.word ?? ""}
          hint={round.word?.hint ?? ""}
          otherSpies={others}
        />
      </PhaseFrame>
    );
  }

  return (
    <PhaseFrame
      title={roundTitle(config, round)}
      subtitle={`Clue round ${round.clueRound}`}
    >
      <Countdown
        seconds={config.timerSec}
        resetKey={`${round.clueRound}-${round.turnIdx}`}
      />
      <Text style={[styles.speaker, { color: colors.ink }]}>
        {isMyTurn ? "Your turn to clue" : `${names[speakerId]} is giving a clue`}
      </Text>
      {isMyTurn ? (
        <>
          <Text style={[styles.help, { color: colors.inkSoft }]}>
            {typed
              ? "Type one clue on your device."
              : "Say one clue out loud, then mark your turn done."}
          </Text>
          {typed ? (
            <View style={styles.field}>
              <TextField
                accessibilityLabel="Your clue"
                value={text}
                maxLength={MAX_CLUE_LENGTH}
                placeholder="Your clue"
                returnKeyType="send"
                onChangeText={(value) => {
                  setText(value);
                  setError(null);
                }}
                onSubmitEditing={send}
              />
              {error ? (
                <Text accessibilityRole="alert" style={{ color: colors.accent }}>
                  {error}
                </Text>
              ) : null}
            </View>
          ) : null}
          <Button
            variant="outline"
            compact
            label="View my card"
            onPress={() => setPeek(true)}
          />
          <Button
            variant="primary"
            label={
              typed
                ? lastTurn
                  ? "Send clue and start debate"
                  : "Send clue"
                : lastTurn
                  ? "Done, start debate"
                  : "Done"
            }
            onPress={typed ? send : () => dispatch(submitClue(""))}
          />
        </>
      ) : (
        <Text style={[styles.help, { color: colors.inkSoft }]}>
          Give your clue on your own device when it is your turn.
        </Text>
      )}
      <ClueList
        clues={round.clues}
        names={names}
        typed={config.clueInput === "typed"}
      />
    </PhaseFrame>
  );
}

function ClueTurn() {
  const { colors } = useAppTheme();
  const { game, dispatch, config, round, names } = useGame();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [peek, setPeek] = useState<"off" | "gate" | "card">("off");

  const speakerId = round.order[round.turnIdx];
  const speaker = names[speakerId];
  const typed = config.clueInput === "typed";
  const lastTurnOfPhase =
    round.turnIdx === round.order.length - 1 &&
    (config.style === "elimination" || round.clueRound === 2);
  const subtitle =
    config.style === "two-round"
      ? `Clue round ${round.clueRound} of 2`
      : "Clues";
  const title = roundTitle(config, round);

  const send = () => {
    const problem = clueProblem(game, text);
    if (problem) {
      setError(problem);
      return;
    }
    dispatch(submitClue(text));
  };

  // the speaker can look at their own card again
  if (peek === "gate") {
    return (
      <PhaseFrame title={title} subtitle="Check your card">
        <PassGate
          name={speaker}
          line="Only this player should look"
          onReady={() => setPeek("card")}
        />
      </PhaseFrame>
    );
  }
  if (peek === "card") {
    const role = roleOf(round, speakerId);
    const others =
      role === "spy" && config.spiesKnowEachOther
        ? round.spyIds.filter((id) => id !== speakerId).map((id) => names[id])
        : [];
    return (
      <PhaseFrame
        title={title}
        subtitle="Check your card"
        footer={
          <Button
            testID="peek-close"
            variant="primary"
            label="Hide it"
            onPress={() => setPeek("off")}
          />
        }
      >
        <Text style={[styles.help, { color: colors.inkSoft }]}>
          Press and hold the card. Let go to hide it.
        </Text>
        <RoleCard
          role={role}
          word={round.word?.word ?? ""}
          hint={round.word?.hint ?? ""}
          otherSpies={others}
        />
      </PhaseFrame>
    );
  }

  return (
    <PhaseFrame
      title={title}
      subtitle={subtitle}
      footer={
        <Button
          testID="clue-send"
          variant="primary"
          label={
            typed
              ? lastTurnOfPhase
                ? "Send clue and start the debate"
                : "Send clue"
              : lastTurnOfPhase
                ? "Done, start the debate"
                : "Done"
          }
          onPress={typed ? send : () => dispatch(submitClue(""))}
        />
      }
    >
      <Countdown seconds={config.timerSec} resetKey="turn" />

      <View style={styles.turn}>
        <Text style={[styles.small, { color: colors.inkSoft }]}>
          It is the turn of
        </Text>
        <Text
          testID="speaker-name"
          style={[styles.speaker, { color: colors.ink }]}
          adjustsFontSizeToFit
          numberOfLines={1}
        >
          {speaker}
        </Text>
        <Text
          style={[styles.help, { color: colors.inkSoft, textAlign: "center" }]}
        >
          {typed
            ? "Type one clue: a word or a short phrase."
            : "Say one clue about the secret word out loud."}
        </Text>
      </View>

      {typed ? (
        <View style={styles.field}>
          <TextField
            testID="clue-input"
            accessibilityLabel={`Clue from ${speaker}`}
            value={text}
            maxLength={MAX_CLUE_LENGTH}
            placeholder="Your clue"
            autoFocus
            returnKeyType="send"
            onChangeText={(t) => {
              setText(t);
              setError(null);
            }}
            onSubmitEditing={send}
          />
          {error ? (
            <Text
              accessibilityRole="alert"
              style={[styles.error, { color: colors.accent }]}
            >
              {error}
            </Text>
          ) : null}
        </View>
      ) : null}

      <Button
        testID="peek-open"
        variant="outline"
        compact
        label="Check my card"
        onPress={() => setPeek("gate")}
      />

      <ClueList clues={round.clues} names={names} typed={typed} />
    </PhaseFrame>
  );
}

const styles = StyleSheet.create({
  turn: { alignItems: "center", gap: 6, paddingVertical: 8 },
  small: { fontSize: 13 },
  speaker: {
    fontFamily: fonts.display,
    fontSize: 48,
    letterSpacing: 2,
    textTransform: "uppercase",
    maxWidth: "100%",
  },
  help: { fontSize: 14, lineHeight: 21 },
  field: { flexDirection: "column", gap: 8 },
  error: { fontSize: 13 },
});
