import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { fonts } from "@/theme/fonts";
import { useAppTheme } from "@/theme/useAppTheme";

type Props = { title: string; step?: string };

/** Back button, title and an optional "Step 1 of 2" label. */
export function ScreenHeader({ title, step }: Props) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();

  const goBack = () =>
    router.canGoBack() ? router.back() : router.replace("/");

  return (
    <View
      style={[
        styles.bar,
        { paddingTop: insets.top + 12, borderBottomColor: colors.line },
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Go back"
        onPress={goBack}
        hitSlop={12}
        style={({ pressed }) => [styles.back, { opacity: pressed ? 0.5 : 1 }]}
      >
        <Text style={[styles.backIcon, { color: colors.ink }]}>‹</Text>
      </Pressable>
      <Text
        accessibilityRole="header"
        style={[styles.title, { color: colors.ink }]}
      >
        {title}
      </Text>
      {step ? (
        <Text style={[styles.step, { color: colors.inkSoft }]}>{step}</Text>
      ) : (
        <View style={styles.stepSpace} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  back: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  backIcon: { fontSize: 38, lineHeight: 40, marginTop: -4 },
  title: {
    flex: 1,
    fontFamily: fonts.display,
    fontSize: 24,
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  step: { fontSize: 13 },
  stepSpace: { width: 40 },
});
