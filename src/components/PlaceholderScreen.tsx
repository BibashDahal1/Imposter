import { useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { fonts } from "@/theme/fonts";
import { useAppTheme } from "@/theme/useAppTheme";

import { Button } from "./Button";

type Props = { title: string; message: string };

/** Temporary screen for pages we build in later steps. */
export function PlaceholderScreen({ title, message }: Props) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();

  const goBack = () =>
    router.canGoBack() ? router.back() : router.replace("/");

  return (
    <View
      style={[
        styles.root,
        {
          backgroundColor: colors.bg,
          paddingTop: insets.top + 24,
          paddingBottom: insets.bottom + 24,
        },
      ]}
    >
      <View style={styles.body}>
        <Text
          accessibilityRole="header"
          style={[styles.title, { color: colors.ink }]}
        >
          {title}
        </Text>
        <Text style={[styles.message, { color: colors.inkSoft }]}>
          {message}
        </Text>
      </View>
      <View style={styles.footer}>
        <Button label="Back" variant="outline" onPress={goBack} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: "center", paddingHorizontal: 24 },
  body: {
    flex: 1,
    width: "100%",
    maxWidth: 420,
    justifyContent: "center",
    gap: 12,
  },
  footer: { width: "100%", maxWidth: 420 },
  title: {
    fontFamily: fonts.display,
    fontSize: 40,
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  message: { fontSize: 16, lineHeight: 24 },
});
