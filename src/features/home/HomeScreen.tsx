import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/components/Button";
import { LinkButton } from "@/components/LinkButton";
import { darkPalette } from "@/theme/colors";

import HomeLogo from "./HomeLogo";

const LOGO_ASPECT = 620 / 525;
const MAX_CONTENT = 420;

export default function HomeScreen() {
  const router = useRouter();
  const colors = darkPalette;
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const timeout = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(timeout);
  }, []);

  /* a phone held sideways: logo on the left, menu on the right, so nothing needs scrolling */
  const screenWidth = mounted ? width : 0;
  const screenHeight = mounted ? height : 0;
  const sideways = mounted && screenWidth > screenHeight && screenHeight < 600;

  const logoW = Math.max(
    0,
    sideways
      ? Math.min(
          screenWidth * 0.36,
          340,
          (screenHeight - 64) * 0.6 * LOGO_ASPECT,
        )
      : Math.min(
          screenWidth - 48,
          380,
          screenHeight * 0.33 * LOGO_ASPECT,
        ),
  );
  const menuW = Math.max(
    0,
    sideways
      ? Math.min(screenWidth * 0.42, MAX_CONTENT)
      : Math.min(screenWidth - 48, MAX_CONTENT),
  );

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          {
            flexDirection: sideways ? "row" : "column",
            gap: sideways ? 48 : 24,
            paddingTop: insets.top + 24,
            paddingBottom: insets.bottom + 24,
            paddingLeft: insets.left + 24,
            paddingRight: insets.right + 24,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.group}>
          <HomeLogo width={logoW} palette={colors} />
          <Text
            style={[
              styles.tagline,
              { color: colors.inkSoft, maxWidth: menuW },
            ]}
          >
            Find the spy before the vote ends.
          </Text>
        </View>

        <View style={styles.group}>
          <View style={[styles.menu, { width: menuW }]}>
            <Button
              testID="btn-pass-play"
              palette={colors}
              variant="primary"
              compact={sideways}
              label="Pass & Play"
              hint="One phone, no internet needed"
              onPress={() => router.push("/play")}
            />
            <Button
              testID="btn-create-room"
              palette={colors}
              variant="solid"
              compact={sideways}
              label="Create Room"
              hint="Host online or nearby"
              onPress={() => router.push("/game/create")}
            />
            <Button
              testID="btn-join-room"
              palette={colors}
              variant="outline"
              compact={sideways}
              label="Join Room"
              hint="Join online or nearby"
              onPress={() => router.push("/game/join")}
            />
          </View>

          <View style={styles.links}>
            <LinkButton
              testID="link-how-to-play"
              palette={colors}
              label="How to play"
              onPress={() => router.push("/info/how-to-play")}
            />
            <Text style={[styles.dot, { color: colors.inkSoft }]}>•</Text>
            <LinkButton
              testID="link-settings"
              palette={colors}
              label="Settings"
              onPress={() => router.push("/settings/settings")}
            />
          </View>

          <Text style={[styles.footer, { color: colors.inkSoft }]}>
            A Turtle Games production
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flexGrow: 1, alignItems: "center", justifyContent: "center" },
  group: { alignItems: "center", gap: 24 },
  tagline: { fontSize: 15, lineHeight: 22, textAlign: "center" },
  menu: { gap: 12 },
  links: { flexDirection: "row", alignItems: "center", gap: 12 },
  dot: { fontSize: 12 },
  footer: { fontSize: 12, letterSpacing: 0.5 },
});
