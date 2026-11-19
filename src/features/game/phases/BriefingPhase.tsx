import { useState } from "react";
import { StyleSheet, Text } from "react-native";

import { Button } from "@/components/Button";
import { roleOf } from "@/engine/game";
import { briefingReady, briefingNext } from "@/store/gameSlice";
import { useRoomState } from "@/features/rooms/useRoomState";
import { useAppTheme } from "@/theme/useAppTheme";

import {
  PassGate,
  PhaseFrame,
  RoleCard,
  roundTitle,
  useGame,
} from "../GameKit";

/** Every player, one at a time, looks at their secret card. */
export default function BriefingPhase() {
  const { round } = useGame();
  const room = useRoomState();
  if (room.role)
    return <RoomBriefingPhase key={`${round.index}-${room.localPlayerId}`} />;
  const playerId = round.seating[round.briefingIdx];
  // a new key gives each player a fresh "pass the phone" screen
  return (
    <BriefingTurn key={`${round.index}-${playerId}`} playerId={playerId} />
  );
}

function RoomBriefingPhase() {
  const { colors } = useAppTheme();
  const room = useRoomState();
  const { dispatch, config, round, names } = useGame();
  const [seen, setSeen] = useState(false);
  const playerId = room.localPlayerId;
  const isPlaying = !!playerId && round.seating.includes(playerId);
  const isReady = !!playerId && round.briefingReadyIds.includes(playerId);
  const role = isPlaying ? roleOf(round, playerId) : "suspect";
  const otherSpies =
    isPlaying && role === "spy" && config.spiesKnowEachOther
      ? round.spyIds.filter((id) => id !== playerId).map((id) => names[id])
      : [];

  return (
    <PhaseFrame title={roundTitle(config, round)} subtitle="Your private card">
      {isPlaying ? (
        <>
          <Text style={[styles.name, { color: colors.ink }]}>
            Your role and hint are shown only on this device.
          </Text>
          <RoleCard
            role={role}
            word={round.word?.word ?? ""}
            hint={round.word?.hint ?? ""}
            otherSpies={otherSpies}
            onRevealed={() => setSeen(true)}
          />
          <Button
            variant="primary"
            label={isReady ? "Confirmed" : "I have seen my card"}
            disabled={!seen || isReady}
            onPress={() => {
              if (playerId) dispatch(briefingReady(playerId));
            }}
          />
        </>
      ) : (
        <Text style={[styles.help, { color: colors.inkSoft }]}>
          You are watching this round.
        </Text>
      )}
      <Text style={[styles.help, { color: colors.inkSoft }]}>
        {round.briefingReadyIds.length} of {round.seating.length} players ready.
        Clues start when everyone has confirmed.
      </Text>
      {isReady ? (
        <Text style={[styles.help, { color: colors.inkSoft }]}>
          Waiting for the other players to confirm.
        </Text>
      ) : null}
      {!isPlaying && room.role === "client" ? (
        <Text style={[styles.help, { color: colors.inkSoft }]}>
          Waiting for the active players to confirm.
        </Text>
      ) : null}
    </PhaseFrame>
  );
}

function BriefingTurn({ playerId }: { playerId: string }) {
  const { colors } = useAppTheme();
  const { dispatch, config, round, names } = useGame();
  const [stage, setStage] = useState<"gate" | "card">("gate");
  const [seen, setSeen] = useState(false);

  const role = roleOf(round, playerId);
  const word = round.word;
  const isLast = round.briefingIdx === round.seating.length - 1;
  const otherSpies =
    role === "spy" && config.spiesKnowEachOther
      ? round.spyIds.filter((id) => id !== playerId).map((id) => names[id])
      : [];

  if (stage === "gate") {
    return (
      <PhaseFrame title={roundTitle(config, round)} subtitle="Secret briefing">
        <PassGate
          name={names[playerId]}
          line="Pass the phone to"
          onReady={() => setStage("card")}
        />
      </PhaseFrame>
    );
  }

  return (
    <PhaseFrame
      title={roundTitle(config, round)}
      subtitle="Secret briefing"
      footer={
        <Button
          testID="briefing-next"
          variant="primary"
          label={isLast ? "Hide it and start the clues" : "Hide it and pass on"}
          disabled={!seen}
          onPress={() => dispatch(briefingNext())}
        />
      }
    >
      <Text style={[styles.name, { color: colors.ink }]}>
        {names[playerId]}, this is your card
      </Text>
      <Text style={[styles.help, { color: colors.inkSoft }]}>
        Press and hold the card to see it. Let go before you pass the phone on.
      </Text>
      <RoleCard
        role={role}
        word={word?.word ?? ""}
        hint={word?.hint ?? ""}
        otherSpies={otherSpies}
        onRevealed={() => setSeen(true)}
      />
    </PhaseFrame>
  );
}

const styles = StyleSheet.create({
  name: { fontSize: 20, fontWeight: "700" },
  help: { fontSize: 14, lineHeight: 21 },
});
