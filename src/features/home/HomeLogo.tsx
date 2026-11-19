/** Phone version: a text logo for now. The full artwork needs react-native-svg, which we add later. */
import { StyleSheet, Text, View } from "react-native";

import type { Palette } from "@/theme/colors";
import { fonts } from "@/theme/fonts";

export default function HomeLogo({
  width,
  palette,
}: {
  width: number;
  palette: Palette;
}) {
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel="The Imposter – A Spy in Nepal"
      style={[styles.box, { width }]}
    >
      <Text
        style={[styles.title, { color: palette.ink, fontSize: width * 0.16 }]}
      >
        THE IMPOSTER
      </Text>
      <Text
        style={[styles.sub, { color: palette.ink, fontSize: width * 0.075 }]}
      >
        A SPY IN NEPAL
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: "center", gap: 6 },
  title: { fontFamily: fonts.display, letterSpacing: 2 },
  sub: { fontFamily: fonts.displayMedium, letterSpacing: 4 },
});
