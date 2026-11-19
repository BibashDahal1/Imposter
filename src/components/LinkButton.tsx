import { useState } from "react";
import { Pressable, StyleSheet, Text } from "react-native";

import { fonts } from "@/theme/fonts";
import type { Palette } from "@/theme/colors";
import { useAppTheme } from "@/theme/useAppTheme";

type Props = {
  label: string;
  onPress: () => void;
  testID?: string;
  palette?: Palette;
};

/** Small text button for secondary actions. */
export function LinkButton({ label, onPress, testID, palette }: Props) {
  const { colors: systemColors } = useAppTheme();
  const colors = palette ?? systemColors;
  const [hovered, setHovered] = useState(false);
  return (
    <Pressable
      testID={testID}
      accessibilityRole="link"
      accessibilityLabel={label}
      onPress={onPress}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      hitSlop={10}
      style={({ pressed }) => [styles.base, { opacity: pressed ? 0.6 : 1 }]}
    >
      <Text
        style={[
          styles.label,
          {
            color: hovered ? colors.accent : colors.ink,
            textDecorationLine: hovered ? "underline" : "none",
          },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { paddingVertical: 6, paddingHorizontal: 4 },
  label: {
    fontFamily: fonts.displayMedium,
    fontSize: 16,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
});
