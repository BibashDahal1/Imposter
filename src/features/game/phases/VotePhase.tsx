import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/Button";
import { Chip } from "@/components/FormKit";
import { castVote } from "@/store/gameSlice";
import { useRoomState } from "@/features/rooms/useRoomState";
import { fonts } from "@/theme/fonts";
import { useAppTheme } from "@/theme/useAppTheme";

import {
  ClueList,
  PassGate,
  PhaseFrame,
  roundTitle,
  useGame,
} from "../GameKit";

/** Secret ballots: each player votes alone, then passes the phone on. */
export default function VotePhase() {
  const { round } = useGame();
  const room = useRoomState();
  if (room.role)
    return (
      <RoomVoteTurn
        key={`${round.index}-${round.tiedIds?.join("+") ?? ""}-${round.voterIdx}`}
      />
    );
  const voterId = round.seating[round.voterIdx];
  // a new key gives each voter a fresh gate, also after a tie
  return (
    <VoteTurn
      key={`${round.index}-${round.tiedIds?.join("+") ?? ""}-${voterId}`}
      voterId={voterId}
    />
  );
}

function RoomVoteTurn() {
  const { colors } = useAppTheme();
  const room = useRoomState();
  const { dispatch, config, round, names } = useGame();
  const [picked, setPicked] = useState<string[]>([]);
  const [showClues, setShowClues] = useState(false);
  const voterId = round.seating[round.voterIdx];
  const isMyTurn = room.localPlayerId === voterId;
  const elimination = config.style === "elimination";
  const need = elimination ? 1 : round.spyIds.length;
  const options = (round.tiedIds ?? round.seating).filter(
    (id) => id !== voterId,
  );
  const tieNote = round.tiedIds
    ? `Tie! Vote again, only between ${round.tiedIds.map((id) => names[id]).join(" and ")}.`
    : null;

  const toggle = (id: string) => {
    setPicked((current) => {
      if (current.includes(id)) return current.filter((value) => value !== id);
      if (need === 1) return [id];
      return current.length < need ? [...current, id] : current;
    });
  };

  return (
    <PhaseFrame title={roundTitle(config, round)} subtitle="Secret vote">
      {tieNote ? (
        <Text accessibilityRole="alert" style={[styles.tie, { color: colors.accent }]}>
          {tieNote}
        </Text>
      ) : null}
      {isMyTurn ? (
        <>
          <Text style={[styles.question, { color: colors.ink }]}>
            {elimination
              ? "Who should be voted out?"
              : `Who are the ${need === 1 ? "Spy" : `${need} Spies`}?`}
          </Text>
          <Text style={[styles.help, { color: colors.inkSoft }]}>
            {elimination
              ? "Pick one player. Your vote is private."
              : `Pick ${need} ${need === 1 ? "player" : "players"}. You cannot pick yourself.`}
            {need > 1 ? ` (${picked.length} of ${need})` : ""}
          </Text>
          <View style={styles.chips}>
            {options.map((id) => (
              <Chip
                key={id}
                label={names[id]}
                selected={picked.includes(id)}
                onPress={() => toggle(id)}
              />
            ))}
          </View>
          <Button
            testID="lock-vote"
            variant="primary"
            label="Lock my vote"
            disabled={picked.length !== need}
            onPress={() => dispatch(castVote(voterId, picked))}
          />
        </>
      ) : (
        <Text style={[styles.help, { color: colors.inkSoft }]}>
          {names[voterId]} is voting privately on their device. You will vote on
          your own turn.
        </Text>
      )}
      <Button
        testID="toggle-clues"
        variant="outline"
        compact
        label={showClues ? "Hide the clues" : "Show the clues"}
        onPress={() => setShowClues((value) => !value)}
      />
      {showClues ? (
        <ClueList
          clues={round.clues}
          names={names}
          typed={config.clueInput === "typed"}
        />
      ) : null}
    </PhaseFrame>
  );
}

function VoteTurn({ voterId }: { voterId: string }) {
  const { colors } = useAppTheme();
  const { dispatch, config, round, names } = useGame();
  const [stage, setStage] = useState<"gate" | "pick">("gate");
  const [picked, setPicked] = useState<string[]>([]);
  const [showClues, setShowClues] = useState(false);

  const elimination = config.style === "elimination";
  const need = elimination ? 1 : round.spyIds.length;
  const options = (round.tiedIds ?? round.seating).filter(
    (id) => id !== voterId,
  );
  const title = roundTitle(config, round);
  const tieNote = round.tiedIds
    ? `Tie! Everyone votes again, only between ${round.tiedIds.map((id) => names[id]).join(" and ")}.`
    : null;

  const toggle = (id: string) => {
    setPicked((cur) => {
      if (cur.includes(id)) return cur.filter((x) => x !== id);
      if (need === 1) return [id];
      return cur.length < need ? [...cur, id] : cur;
    });
  };

  if (stage === "gate") {
    return (
      <PhaseFrame title={title} subtitle="Secret vote">
        {tieNote ? (
          <Text
            accessibilityRole="alert"
            style={[styles.tie, { color: colors.accent }]}
          >
            {tieNote}
          </Text>
        ) : null}
        <PassGate
          name={names[voterId]}
          line="Vote in secret. Pass the phone to"
          onReady={() => setStage("pick")}
        />
      </PhaseFrame>
    );
  }

  return (
    <PhaseFrame
      title={title}
      subtitle="Secret vote"
      footer={
        <Button
          testID="lock-vote"
          variant="primary"
          label="Lock my vote"
          disabled={picked.length !== need}
          onPress={() => dispatch(castVote(voterId, picked))}
        />
      }
    >
      <Text style={[styles.question, { color: colors.ink }]}>
        {names[voterId]},{" "}
        {elimination
          ? "who should be voted out?"
          : `who are the ${need === 1 ? "Spy" : `${need} Spies`}?`}
      </Text>
      <Text style={[styles.help, { color: colors.inkSoft }]}>
        {elimination
          ? "Pick one player. The player with the most votes leaves the table."
          : `Pick ${need} ${need === 1 ? "player" : "players"}. You cannot pick yourself.`}
        {need > 1 ? `  (${picked.length} of ${need})` : ""}
      </Text>
      {tieNote ? (
        <Text
          accessibilityRole="alert"
          style={[styles.tie, { color: colors.accent }]}
        >
          {tieNote}
        </Text>
      ) : null}

      <View style={styles.chips}>
        {options.map((id) => (
          <Chip
            key={id}
            label={names[id]}
            selected={picked.includes(id)}
            onPress={() => toggle(id)}
          />
        ))}
      </View>

      <Button
        testID="toggle-clues"
        variant="outline"
        compact
        label={showClues ? "Hide the clues" : "Show the clues"}
        onPress={() => setShowClues((v) => !v)}
      />
      {showClues ? (
        <ClueList
          clues={round.clues}
          names={names}
          typed={config.clueInput === "typed"}
        />
      ) : null}
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
  tie: { fontSize: 14, lineHeight: 21, fontWeight: "600" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
});
