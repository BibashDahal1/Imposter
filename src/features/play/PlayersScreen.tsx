import { useRouter } from "expo-router";
import { useRef } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/components/Button";
import { TextField, type TextFieldHandle } from "@/components/FormKit";
import { ScreenHeader } from "@/components/ScreenHeader";
import { useAppDispatch, useAppSelector } from "@/store";
import {
  MAX_PLAYERS,
  addPlayer,
  playerErrors,
  removePlayer,
  setName,
} from "@/store/setupSlice";
import { fonts } from "@/theme/fonts";
import { useAppTheme } from "@/theme/useAppTheme";

const MAX_WIDTH = 520;

/** Step 1 of 2: who is at the table. */
export default function PlayersScreen() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const setup = useAppSelector((s) => s.setup);
  const inputs = useRef<(TextFieldHandle | null)[]>([]);

  const errors = playerErrors(setup);
  const count = setup.players.length;
  const canAdd = count < MAX_PLAYERS;

  const add = () => {
    dispatch(addPlayer());
    // focus the new field once it exists
    setTimeout(() => inputs.current[count]?.focus(), 60);
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <ScreenHeader title="Players" step="Step 1 of 2" />

      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.column}>
          <Text style={[styles.lead, { color: colors.inkSoft }]}>
            Add everyone at the table, in seating order. You can leave a name
            blank and we will call that player “Player 1”, “Player 2” and so on.
          </Text>

          {setup.players.map((p, i) => (
            <View key={p.id} style={styles.row}>
              <View style={[styles.badge, { backgroundColor: colors.ink }]}>
                <Text style={[styles.badgeText, { color: colors.onInk }]}>
                  {i + 1}
                </Text>
              </View>
              <TextField
                ref={(el) => {
                  inputs.current[i] = el;
                }}
                testID={`player-${i}`}
                accessibilityLabel={`Name of player ${i + 1}`}
                value={p.name}
                placeholder={`Player ${i + 1}`}
                maxLength={16}
                returnKeyType={i === count - 1 ? "done" : "next"}
                submitBehavior={i === count - 1 ? "blurAndSubmit" : "submit"}
                onChangeText={(name) => dispatch(setName({ id: p.id, name }))}
                onSubmitEditing={() => inputs.current[i + 1]?.focus()}
              />
              {count > 3 ? (
                <Pressable
                  testID={`remove-${i}`}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove player ${i + 1}`}
                  onPress={() => dispatch(removePlayer(p.id))}
                  hitSlop={8}
                  style={({ pressed }) => [
                    styles.remove,
                    { borderColor: colors.line, opacity: pressed ? 0.5 : 1 },
                  ]}
                >
                  <Text style={[styles.removeText, { color: colors.inkSoft }]}>
                    ✕
                  </Text>
                </Pressable>
              ) : (
                <View style={styles.removeSpace} />
              )}
            </View>
          ))}

          <Button
            testID="add-player"
            variant="outline"
            compact
            trailing="+"
            label={canAdd ? "Add player" : `Maximum ${MAX_PLAYERS} players`}
            disabled={!canAdd}
            onPress={add}
          />
        </View>
      </ScrollView>

      <View
        style={[
          styles.bar,
          {
            borderTopColor: colors.line,
            paddingBottom: insets.bottom + 12,
            backgroundColor: colors.bg,
          },
        ]}
      >
        <View style={styles.column}>
          <Text style={[styles.count, { color: colors.inkSoft }]}>
            {count} players
          </Text>
          {errors.map((e) => (
            <Text
              key={e}
              accessibilityRole="alert"
              style={[styles.error, { color: colors.accent }]}
            >
              {e}
            </Text>
          ))}
          <Button
            testID="next-options"
            variant="primary"
            label="Next: Game options"
            disabled={errors.length > 0}
            onPress={() => router.push("/play/options")}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { alignItems: "center", padding: 16, paddingBottom: 24 },
  column: { width: "100%", maxWidth: MAX_WIDTH, gap: 12 },
  lead: { fontSize: 14, lineHeight: 21, marginBottom: 4 },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  badge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { fontFamily: fonts.displayMedium, fontSize: 15 },
  remove: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  removeSpace: { width: 36 },
  removeText: { fontSize: 14 },
  bar: {
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  count: { fontSize: 13, textAlign: "center" },
  error: { fontSize: 13, lineHeight: 19, textAlign: "center" },
});
