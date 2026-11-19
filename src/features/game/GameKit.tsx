import { useRouter } from "expo-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type TextStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/components/Button";
import type { Clue, GameConfig, Role, Round } from "@/engine/types";
import { roomNetwork } from "@/features/rooms/roomNetwork";
import { useRoomState } from "@/features/rooms/useRoomState";
import { useAppDispatch, useAppSelector } from "@/store";
import { resetGame } from "@/store/gameSlice";
import { fonts } from "@/theme/fonts";
import { useAppTheme } from "@/theme/useAppTheme";

const MAX_WIDTH = 520;
const noSelect = (Platform.OS === "web"
  ? { userSelect: "none" }
  : {}) as unknown as TextStyle;

/** Current game state plus player names by id. Only use inside screens that run during a game. */
export function useGame() {
  const dispatch = useAppDispatch();
  const game = useAppSelector((s) => s.game);
  const config = game.config as GameConfig;
  const round = game.round as Round;
  const names = useMemo(
    () => Object.fromEntries(config.players.map((p) => [p.id, p.name])),
    [config],
  );
  return { game, dispatch, config, round, names };
}

/** "Round 2", "Round 3 · Final", or just "The game" in two-round. */
export function roundTitle(config: GameConfig, round: Round) {
  if (config.style === "two-round") return "The game";
  return `Round ${round.index}${round.isFinal ? " · Final" : ""}`;
}

/* ---------- layout shared by every phase ---------- */

export function PhaseFrame({
  title,
  subtitle,
  children,
  footer,
  canExit = true,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  canExit?: boolean;
}) {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const room = useRoomState();
  const [confirm, setConfirm] = useState(false);
  const [exitError, setExitError] = useState<string | null>(null);

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <View
        style={[
          styles.header,
          { paddingTop: insets.top + 12, borderBottomColor: colors.line },
        ]}
      >
        <View style={styles.headerTexts}>
          <Text
            accessibilityRole="header"
            style={[styles.title, { color: colors.ink }]}
          >
            {title}
          </Text>
          {subtitle ? (
            <Text style={[styles.subtitle, { color: colors.inkSoft }]}>
              {subtitle}
            </Text>
          ) : null}
          {room.status === "error" && room.error ? (
            <Text
              accessibilityRole="alert"
              style={[styles.subtitle, { color: colors.accent }]}
            >
              {room.error}
            </Text>
          ) : null}
        </View>
        {canExit ? (
          <Pressable
            testID="exit-game"
            accessibilityRole="button"
            accessibilityLabel="Leave the game"
            onPress={() => setConfirm(true)}
            hitSlop={10}
            style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
          >
            <Text style={[styles.exit, { color: colors.inkSoft }]}>Exit</Text>
          </Pressable>
        ) : null}
      </View>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.column}>{children}</View>
      </ScrollView>

      {footer ? (
        <View
          style={[
            styles.footer,
            {
              borderTopColor: colors.line,
              paddingBottom: insets.bottom + 12,
              backgroundColor: colors.bg,
            },
          ]}
        >
          <View style={styles.column}>{footer}</View>
        </View>
      ) : null}

      <ConfirmModal
        visible={confirm}
        title="Leave the game?"
        message={
          exitError
            ? `Could not leave the room: ${exitError}`
            : "Your progress in this game will be lost."
        }
        confirmLabel="Leave"
        cancelLabel="Keep playing"
        onCancel={() => {
          setConfirm(false);
          setExitError(null);
        }}
        onConfirm={() => void leaveGame()}
      />
    </View>
  );

  async function leaveGame() {
    try {
      if (room.role) await roomNetwork.leave();
      dispatch(resetGame());
      router.replace("/play");
    } catch (error) {
      setExitError(
        error instanceof Error ? error.message : "The room could not close.",
      );
    }
  }
}

export function ConfirmModal({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { colors } = useAppTheme();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.backdrop}>
        <View
          style={[
            styles.dialog,
            { backgroundColor: colors.bg, borderColor: colors.line },
          ]}
        >
          <Text
            accessibilityRole="header"
            style={[styles.dialogTitle, { color: colors.ink }]}
          >
            {title}
          </Text>
          <Text style={[styles.dialogText, { color: colors.inkSoft }]}>
            {message}
          </Text>
          <Button
            testID="confirm-cancel"
            variant="outline"
            compact
            label={cancelLabel}
            onPress={onCancel}
          />
          <Button
            testID="confirm-ok"
            variant="primary"
            compact
            label={confirmLabel}
            onPress={onConfirm}
          />
        </View>
      </View>
    </Modal>
  );
}

/* ---------- "pass the phone" screen ---------- */

export function PassGate({
  name,
  line,
  onReady,
}: {
  name: string;
  line: string;
  onReady: () => void;
}) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.gate}>
      <Text style={[styles.gateLine, { color: colors.inkSoft }]}>{line}</Text>
      <Text
        testID="gate-name"
        accessibilityRole="header"
        style={[styles.gateName, { color: colors.ink }]}
        adjustsFontSizeToFit
        numberOfLines={1}
      >
        {name}
      </Text>
      <Text style={[styles.gateLine, { color: colors.inkSoft }]}>
        Make sure nobody else is looking.
      </Text>
      <View style={styles.gateButton}>
        <Button
          testID="gate-ready"
          variant="primary"
          label={`I am ${name}`}
          onPress={onReady}
        />
      </View>
    </View>
  );
}

/* ---------- secret card, shown only while held ---------- */

export function RoleCard({
  role,
  word,
  hint,
  otherSpies,
  onRevealed,
}: {
  role: Role;
  word: string;
  hint: string;
  otherSpies: string[];
  onRevealed?: () => void;
}) {
  const { colors } = useAppTheme();
  const [held, setHeld] = useState(false);
  const isSpy = role === "spy";
  const bg = held ? (isSpy ? colors.accent : colors.ink) : colors.surface;
  const fg = held ? (isSpy ? colors.onAccent : colors.onInk) : colors.ink;

  return (
    <Pressable
      testID="role-card"
      accessibilityRole="button"
      accessibilityLabel="Hold to reveal your card"
      accessibilityHint="Press and hold. Let go to hide it again."
      onPressIn={() => {
        setHeld(true);
        onRevealed?.();
      }}
      onPressOut={() => setHeld(false)}
      style={[
        styles.card,
        noSelect,
        {
          backgroundColor: bg,
          borderColor: held ? bg : colors.line,
          borderStyle: held ? "solid" : "dashed",
        },
      ]}
    >
      {held ? (
        isSpy ? (
          <View style={styles.cardBody}>
            <Text testID="card-role" style={[styles.cardSmall, { color: fg }]}>
              YOU ARE THE SPY
            </Text>
            <Text style={[styles.cardSmall, { color: fg }]}>Your hint</Text>
            <Text testID="card-text" style={[styles.cardBig, { color: fg }]}>
              {hint}
            </Text>
            {otherSpies.length > 0 ? (
              <Text
                testID="card-others"
                style={[styles.cardSmall, { color: fg }]}
              >
                {otherSpies.length === 1 ? "The other Spy" : "The other Spies"}:{" "}
                {otherSpies.join(", ")}
              </Text>
            ) : null}
          </View>
        ) : (
          <View style={styles.cardBody}>
            <Text testID="card-role" style={[styles.cardSmall, { color: fg }]}>
              YOU ARE A SUSPECT
            </Text>
            <Text style={[styles.cardSmall, { color: fg }]}>
              The secret word
            </Text>
            <Text testID="card-text" style={[styles.cardBig, { color: fg }]}>
              {word}
            </Text>
          </View>
        )
      ) : (
        <View style={styles.cardBody}>
          <Text style={[styles.cardHold, { color: fg }]}>HOLD TO REVEAL</Text>
          <Text style={[styles.cardSmall, { color: colors.inkSoft }]}>
            Let go to hide it again
          </Text>
        </View>
      )}
    </Pressable>
  );
}

/* ---------- countdown ---------- */

export function Countdown({
  seconds,
  resetKey,
}: {
  seconds: number;
  resetKey: string | number;
}) {
  const { colors } = useAppTheme();
  const [left, setLeft] = useState(seconds);

  useEffect(() => {
    setLeft(seconds);
    if (seconds <= 0) return;
    const end = Date.now() + seconds * 1000;
    const id = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((end - Date.now()) / 1000));
      setLeft(remaining);
      if (remaining === 0) clearInterval(id);
    }, 250);
    return () => clearInterval(id);
  }, [seconds, resetKey]);

  if (seconds <= 0) return null;
  const urgent = left <= 10;
  const mm = Math.floor(left / 60);
  const ss = String(left % 60).padStart(2, "0");
  return (
    <View accessibilityRole="timer" style={styles.timer}>
      <Text
        testID="countdown"
        style={[
          styles.timerText,
          { color: urgent ? colors.accent : colors.ink },
        ]}
      >
        {left === 0 ? "Time's up" : `${mm}:${ss}`}
      </Text>
    </View>
  );
}

/* ---------- clues so far ---------- */

export function ClueList({
  clues,
  names,
  typed,
}: {
  clues: Clue[][];
  names: Record<string, string>;
  typed: boolean;
}) {
  const { colors } = useAppTheme();
  const rounds = clues
    .map((list, i) => ({ list, i }))
    .filter((r) => r.list.length > 0);
  if (rounds.length === 0) return null;
  return (
    <View style={[styles.clueBox, { backgroundColor: colors.surface }]}>
      {rounds.map(({ list, i }) => (
        <View key={i} style={styles.clueGroup}>
          {clues.length > 1 ? (
            <Text style={[styles.clueRound, { color: colors.inkSoft }]}>
              Clue round {i + 1}
            </Text>
          ) : null}
          {list.map((c, j) => (
            <View key={`${c.playerId}-${j}`} style={styles.clueRow}>
              <Text style={[styles.clueName, { color: colors.inkSoft }]}>
                {names[c.playerId]}
              </Text>
              <Text
                testID="clue-row"
                style={[styles.clueText, { color: colors.ink }]}
              >
                {typed ? c.text : "✓ gave a clue"}
              </Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerTexts: { flex: 1 },
  title: {
    fontFamily: fonts.display,
    fontSize: 24,
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  subtitle: { fontSize: 13 },
  exit: {
    fontFamily: fonts.displayMedium,
    fontSize: 15,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  scroll: { flexGrow: 1, alignItems: "center", padding: 16 },
  column: { width: "100%", maxWidth: MAX_WIDTH, gap: 14 },
  footer: {
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  dialog: {
    width: "100%",
    maxWidth: 380,
    borderRadius: 18,
    borderWidth: 2,
    padding: 20,
    gap: 12,
  },
  dialogTitle: {
    fontFamily: fonts.display,
    fontSize: 24,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  dialogText: { fontSize: 15, lineHeight: 22 },
  gate: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingVertical: 24,
  },
  gateLine: { fontSize: 15, textAlign: "center" },
  gateName: {
    fontFamily: fonts.display,
    fontSize: 56,
    letterSpacing: 2,
    textTransform: "uppercase",
    textAlign: "center",
    maxWidth: "100%",
  },
  gateButton: { width: "100%", marginTop: 12 },
  card: {
    minHeight: 240,
    borderRadius: 20,
    borderWidth: 3,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  cardBody: { alignItems: "center", gap: 6 },
  cardHold: { fontFamily: fonts.display, fontSize: 30, letterSpacing: 2 },
  cardSmall: { fontSize: 14, textAlign: "center" },
  cardBig: {
    fontFamily: fonts.display,
    fontSize: 38,
    letterSpacing: 1,
    textAlign: "center",
  },
  timer: { alignItems: "center" },
  timerText: { fontFamily: fonts.display, fontSize: 40, letterSpacing: 2 },
  clueBox: { borderRadius: 14, padding: 14, gap: 10 },
  clueGroup: { gap: 6 },
  clueRound: { fontSize: 12, fontWeight: "600" },
  clueRow: { flexDirection: "row", gap: 12 },
  clueName: { width: 90, fontSize: 14 },
  clueText: { flex: 1, fontSize: 15, fontWeight: "600" },
});
