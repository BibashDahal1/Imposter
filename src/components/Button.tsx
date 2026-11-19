import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { fonts } from "@/theme/fonts";
import type { Palette } from "@/theme/colors";
import { useAppTheme } from "@/theme/useAppTheme";

type Variant = "primary" | "solid" | "outline";

type Props = {
  label: string;
  /** Small line under the label. */
  hint?: string;
  variant?: Variant;
  /** Slightly smaller, for short screens such as a phone held sideways. */
  compact?: boolean;
  /** Greyed out and not clickable. */
  disabled?: boolean;
  /** Symbol on the right. Defaults to an arrow. */
  trailing?: string;
  onPress: () => void;
  testID?: string;
  palette?: Palette;
};

/** Big menu button used on the homepage and later screens. */
export function Button({
  label,
  hint,
  variant = "solid",
  compact = false,
  disabled = false,
  trailing = "›",
  onPress,
  testID,
  palette,
}: Props) {
  const { colors: systemColors } = useAppTheme();
  const colors = palette ?? systemColors;
  const [hovered, setHovered] = useState(false);

  const look = {
    primary: { bg: colors.accent, fg: colors.onAccent, border: colors.accent },
    solid: { bg: colors.ink, fg: colors.onInk, border: colors.ink },
    outline: { bg: "transparent", fg: colors.ink, border: colors.ink },
  }[variant];

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={hint ? `${label}. ${hint}` : label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      style={({ pressed }) => [
        styles.base,
        compact && styles.baseCompact,
        {
          backgroundColor: look.bg,
          borderColor: look.border,
          opacity: disabled ? 0.4 : pressed ? 0.88 : hovered ? 0.93 : 1,
          transform: [
            { scale: disabled ? 1 : pressed ? 0.98 : hovered ? 1.01 : 1 },
          ],
        },
      ]}
    >
      <View style={styles.texts}>
        <Text
          style={[
            styles.label,
            compact && styles.labelCompact,
            { color: look.fg },
          ]}
        >
          {label}
        </Text>
        {hint ? (
          <Text
            style={[
              styles.hint,
              compact && styles.hintCompact,
              { color: look.fg },
            ]}
          >
            {hint}
          </Text>
        ) : null}
      </View>
      <Text style={[styles.chevron, { color: look.fg }]}>{trailing}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 68,
    borderRadius: 14,
    borderWidth: 2,
    paddingHorizontal: 20,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  baseCompact: { minHeight: 56, paddingVertical: 8 },
  texts: { flex: 1, gap: 2 },
  label: {
    fontFamily: fonts.display,
    fontSize: 22,
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  labelCompact: { fontSize: 18 },
  hint: { fontSize: 13, opacity: 0.85 },
  hintCompact: { fontSize: 12 },
  chevron: { fontSize: 34, lineHeight: 36 },
});
