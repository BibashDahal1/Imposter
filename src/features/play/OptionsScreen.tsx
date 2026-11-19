import { useRouter } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/components/Button";
import {
  Chip,
  FieldLabel,
  Help,
  Section,
  Segmented,
  Stepper,
  ToggleRow,
} from "@/components/FormKit";
import { ScreenHeader } from "@/components/ScreenHeader";
import { PACKS } from "@/content/manifest";
import type { Lang } from "@/content/types";
import { toGameConfig } from "@/features/game/toGameConfig";
import { useRoomState } from "@/features/rooms/useRoomState";
import { useAppDispatch, useAppSelector } from "@/store";
import { startGame } from "@/store/gameSlice";
import {
  maxSpies,
  recommendedSpies,
  setClueInput,
  setHint,
  setLanguage,
  setLastChanceGuess,
  setRevealOnOut,
  selectAllPacks,
  setSpies,
  setSpiesKnowEachOther,
  setStyle,
  setTimer,
  togglePack,
  validate,
  type ClueInput,
  type GameStyle,
  type SetupHint,
} from "@/store/setupSlice";
import { useAppTheme } from "@/theme/useAppTheme";

const MAX_WIDTH = 520;

const LANG_LABEL: Record<Lang, string> = {
  en: "English",
  ne: "नेपाली",
  ro: "Roman Nepali",
};
const HINT_HELP: Record<SetupHint, string> = {
  easy: "The Spy gets a clear description of the word.",
  normal: "The Spy only gets the category, like “A food”.",
  hard: "The Spy gets one vague word.",
  random: "One random hint strength is chosen for the whole game.",
};
const STYLE_HELP: Record<GameStyle, string> = {
  elimination:
    "Players are voted out one by one. Every round has a new secret word and a new Spy, until 3 players are left for the final round.",
  "two-round":
    "Two rounds of clues, then everyone names the Spy. The game ends whether the Spy is found or not.",
};

/** Step 2 of 2: how the game is played. */
export default function OptionsScreen() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const room = useRoomState();
  const s = useAppSelector((state) => state.setup);
  const editingRoom = room.role === "host" && room.status !== "idle";

  const n = s.players.length;
  const { ok, errors, warnings } = validate(s);
  const styleName =
    s.style === "elimination" ? "Elimination" : "Two-round guess";

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <ScreenHeader title="Game options" step="Step 2 of 2" />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.column}>
          <Section title="Game style" note={STYLE_HELP[s.style]}>
            <Segmented<GameStyle>
              label="Game style"
              value={s.style}
              onChange={(v) => dispatch(setStyle(v))}
              options={[
                { value: "elimination", label: "Elimination" },
                { value: "two-round", label: "Two-round guess" },
              ]}
            />
          </Section>

          <Section title="Spies">
            <Stepper
              label="Spies"
              value={s.spies}
              min={1}
              max={maxSpies(n)}
              onChange={(v) => dispatch(setSpies(v))}
            />
            <Help warning={s.spies > recommendedSpies(n)}>
              {s.spies > recommendedSpies(n)
                ? warnings[0]
                : `Recommended: ${recommendedSpies(n)} for ${n} players.`}
            </Help>
          </Section>

          <Section title="Words">
            <FieldLabel>Language</FieldLabel>
            <Segmented<Lang>
              label="Language"
              value={s.language}
              onChange={(v) => dispatch(setLanguage(v))}
              options={(["en", "ne", "ro"] as Lang[]).map((l) => ({
                value: l,
                label: LANG_LABEL[l],
              }))}
            />

            <FieldLabel>Word packs</FieldLabel>
            <View style={styles.chips}>
              {PACKS.map((p) => (
                <Chip
                  key={p.id}
                  label={p.name[s.language] ?? p.name.en ?? p.id}
                  sub={`${p.count} words`}
                  selected={s.packIds.includes(p.id)}
                  onPress={() => dispatch(togglePack(p.id))}
                />
              ))}
            </View>
            <Button
              variant="outline"
              label="Random"
              hint="Select all categories and choose a random hint strength for this game"
              trailing="↻"
              onPress={() => {
                dispatch(selectAllPacks());
                dispatch(setHint("random"));
              }}
            />

            <FieldLabel>Hint for the Spy</FieldLabel>
            <Segmented<SetupHint>
              label="Hint strength"
              value={s.hint}
              onChange={(v) => dispatch(setHint(v))}
              options={[
                { value: "easy", label: "Easy" },
                { value: "normal", label: "Normal" },
                { value: "hard", label: "Hard" },
                { value: "random", label: "Random" },
              ]}
            />
            <Help>{HINT_HELP[s.hint]}</Help>
          </Section>

          <Section title="Clues">
            <FieldLabel>How clues are given</FieldLabel>
            <Segmented<ClueInput>
              label="Clue style"
              value={s.clueInput}
              onChange={(v) => dispatch(setClueInput(v))}
              options={[
                { value: "spoken", label: "Spoken aloud" },
                { value: "typed", label: "Typed in the app" },
              ]}
            />
            <Help>Voting is always done in the app.</Help>

            <FieldLabel>Time for each turn</FieldLabel>
            <Segmented<number>
              label="Timer"
              value={s.timerSec}
              onChange={(v) => dispatch(setTimer(v))}
              options={[0, 30, 45, 60, 90].map((t) => ({
                value: t,
                label: t === 0 ? "Off" : `${t}s`,
              }))}
            />
          </Section>

          <Section title="Rules">
            {s.style === "elimination" ? (
              <ToggleRow
                label="Show the role when a player is out"
                hint="Everyone learns whether they were a Spy."
                value={s.revealOnOut}
                onValueChange={(v) => dispatch(setRevealOnOut(v))}
              />
            ) : (
              <ToggleRow
                label="Last chance for a caught Spy"
                hint="A caught Spy gets one guess at the secret word to win."
                value={s.lastChanceGuess}
                onValueChange={(v) => dispatch(setLastChanceGuess(v))}
              />
            )}
            {s.spies >= 2 ? (
              <ToggleRow
                label="Spies know each other"
                value={s.spiesKnowEachOther}
                onValueChange={(v) => dispatch(setSpiesKnowEachOther(v))}
              />
            ) : null}
          </Section>
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
          <Text style={[styles.summary, { color: colors.inkSoft }]}>
            {n} players · {s.spies} {s.spies === 1 ? "Spy" : "Spies"} ·{" "}
            {styleName}
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
            testID="start-game"
            variant="primary"
            label={editingRoom ? "Save and return to room" : "Start game"}
            disabled={!ok}
            onPress={() => {
              if (editingRoom) {
                router.back();
                return;
              }
              dispatch(startGame(toGameConfig(s)));
              router.push("/play/game");
            }}
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
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  bar: {
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  summary: { fontSize: 13, textAlign: "center" },
  error: { fontSize: 13, lineHeight: 19, textAlign: "center" },
});
