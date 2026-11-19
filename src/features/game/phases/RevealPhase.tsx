import { StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/Button";
import { continueGame } from "@/store/gameSlice";
import { useRoomState } from "@/features/rooms/useRoomState";
import { fonts } from "@/theme/fonts";
import { useAppTheme } from "@/theme/useAppTheme";

import { PhaseFrame, roundTitle, useGame } from "../GameKit";

/** Shows the votes and what they decided. */
export default function RevealPhase() {
  const { colors } = useAppTheme();
  const { game, dispatch, config, round, names } = useGame();
  const room = useRoomState();
  const result = round.result;
  if (!result || !round.word) return null;

  const elimination = config.style === "elimination";
  const rows = round.seating
    .map((id) => ({ id, votes: result.tally[id] ?? 0 }))
    .sort((a, b) => b.votes - a.votes);
  const maxVotes = Math.max(1, ...rows.map((r) => r.votes));
  const spyNames = round.spyIds.map((id) => names[id]).join(" and ");
  const showRoles = !elimination || round.isFinal || config.revealOnOut;

  let headline: string;
  if (elimination) headline = `${names[result.outId as string]} is out`;
  else
    headline = result.spiesCaught
      ? "Every Spy was named!"
      : "A Spy slipped through";

  let nextLabel: string;
  if (elimination) {
    nextLabel = round.isFinal
      ? "See the results"
      : game.alive.length - 1 <= 3
        ? "Start the final round"
        : "Start the next round";
  } else {
    nextLabel =
      config.lastChanceGuess && result.spiesCaught
        ? "The Spy’s last chance"
        : "See the results";
  }

  return (
    <PhaseFrame
      title={roundTitle(config, round)}
      subtitle="The vote"
      footer={room.role === "client" ? (
        <Text style={[styles.note, { color: colors.inkSoft }]}>
          Waiting for the host to continue.
        </Text>
      ) : (
        <Button
          testID="reveal-next"
          variant="primary"
          label={nextLabel}
          onPress={() => dispatch(continueGame())}
        />
      )}
    >
      <Text
        testID="reveal-headline"
        accessibilityRole="header"
        style={[styles.headline, { color: colors.ink }]}
      >
        {headline}
      </Text>

      <View style={styles.bars}>
        {rows.map((r) => {
          const out = result.accused.includes(r.id);
          return (
            <View key={r.id} style={styles.barRow}>
              <Text style={[styles.barName, { color: colors.ink }]}>
                {names[r.id]}
              </Text>
              <View style={[styles.track, { backgroundColor: colors.surface }]}>
                <View
                  style={[
                    styles.fill,
                    {
                      width: `${(r.votes / maxVotes) * 100}%`,
                      backgroundColor: out ? colors.accent : colors.ink,
                    },
                  ]}
                />
              </View>
              <Text style={[styles.barVotes, { color: colors.inkSoft }]}>
                {r.votes}
              </Text>
            </View>
          );
        })}
      </View>

      {result.tieBroken ? (
        <Text style={[styles.note, { color: colors.inkSoft }]}>
          The vote was tied, so chance decided.
        </Text>
      ) : round.tiedIds ? (
        <Text style={[styles.note, { color: colors.inkSoft }]}>
          These are the votes of the re-vote after a tie.
        </Text>
      ) : null}

      <View style={[styles.facts, { backgroundColor: colors.surface }]}>
        {showRoles ? (
          <>
            {elimination ? (
              <Text
                testID="reveal-role"
                style={[styles.fact, { color: colors.ink }]}
              >
                {names[result.outId as string]} was{" "}
                {result.outWasSpy ? "the Spy" : "a Suspect"}.
              </Text>
            ) : (
              <Text style={[styles.fact, { color: colors.ink }]}>
                You named: {result.accused.map((id) => names[id]).join(", ")}.
              </Text>
            )}
            <Text
              testID="reveal-spies"
              style={[styles.fact, { color: colors.ink }]}
            >
              {round.spyIds.length === 1 ? "The Spy was" : "The Spies were"}:{" "}
              {spyNames}.
            </Text>
          </>
        ) : (
          <Text style={[styles.fact, { color: colors.ink }]}>
            Roles stay hidden until the end of the game.
          </Text>
        )}
        <Text testID="reveal-word" style={[styles.fact, { color: colors.ink }]}>
          The secret word was: {round.word.word}
        </Text>
      </View>
    </PhaseFrame>
  );
}

const styles = StyleSheet.create({
  headline: {
    fontFamily: fonts.display,
    fontSize: 34,
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  bars: { gap: 8 },
  barRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  barName: { width: 90, fontSize: 14, fontWeight: "600" },
  track: { flex: 1, height: 14, borderRadius: 7, overflow: "hidden" },
  fill: { height: 14, borderRadius: 7 },
  barVotes: { width: 24, textAlign: "right", fontSize: 14 },
  note: { fontSize: 13 },
  facts: { borderRadius: 14, padding: 14, gap: 6 },
  fact: { fontSize: 15, lineHeight: 22 },
});
