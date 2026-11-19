import { StyleSheet, Text } from "react-native";

import { Button } from "@/components/Button";
import { debateSeconds } from "@/engine/game";
import { debateDone } from "@/store/gameSlice";
import { useRoomState } from "@/features/rooms/useRoomState";
import { useAppTheme } from "@/theme/useAppTheme";

import {
  ClueList,
  Countdown,
  PhaseFrame,
  roundTitle,
  useGame,
} from "../GameKit";

/** Everyone talks. The app only keeps the clues and the clock. */
export default function DebatePhase() {
  const { colors } = useAppTheme();
  const { dispatch, config, round, names } = useGame();
  const room = useRoomState();
  const k = round.spyIds.length;

  return (
    <PhaseFrame
      title={roundTitle(config, round)}
      subtitle="Debate"
      footer={room.role === "client" ? (
        <Text style={[styles.text, { color: colors.inkSoft }]}>
          Waiting for the host to start the vote.
        </Text>
      ) : (
        <Button
          testID="go-vote"
          variant="primary"
          label="Go to the vote"
          onPress={() => dispatch(debateDone())}
        />
      )}
    >
      <Countdown seconds={debateSeconds(config)} resetKey={round.index} />
      <Text style={[styles.text, { color: colors.ink }]}>
        Talk it over. Who gave a clue that does not quite fit? Ask questions and
        say who you suspect.
      </Text>
      <Text style={[styles.text, { color: colors.inkSoft }]}>
        {config.style === "two-round"
          ? `Next, everyone secretly names ${k} ${k === 1 ? "Spy" : "Spies"}.`
          : "Next, everyone secretly votes for one player to remove."}
      </Text>
      <ClueList
        clues={round.clues}
        names={names}
        typed={config.clueInput === "typed"}
      />
    </PhaseFrame>
  );
}

const styles = StyleSheet.create({
  text: { fontSize: 15, lineHeight: 22 },
});
