import { ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Help, Section } from "@/components/FormKit";
import { ScreenHeader } from "@/components/ScreenHeader";
import { useAppTheme } from "@/theme/useAppTheme";

const MAX_WIDTH = 520;

export default function HowToPlay() {
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <ScreenHeader title="How to play" />
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: insets.bottom + 24 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.column}>
          <Section title="Start a game">
            <Help>
              Choose Pass & Play to share one phone, or create a room for
              separate phones. Pick Wi-Fi / hotspot for nearby play, or Online
              so players can join over the internet.
            </Help>
            <Help>
              The host creates the room and shares its six-digit code. The host
              is a player too and can be chosen as the Spy.
            </Help>
            <Help>
              Nearby rooms need every phone on the same Wi-Fi or hotspot.
              Online rooms work across different networks when online rooms are
              configured for the app.
            </Help>
          </Section>

          <Section title="Find the Spy">
            <Help>
              Everyone gets a secret role. Suspects see the secret word; the
              Spy gets a hint and tries to blend in. Keep your screen private
              while checking your role.
            </Help>
            <Help>
              In room games, reveal your card and confirm when you are ready.
              The clue phase starts only after every active player confirms.
            </Help>
            <Help>
              Take turns giving clues without saying the word. Discuss who
              sounds suspicious, then vote in the app.
            </Help>
          </Section>

          <Section title="Win the round">
            <Help>
              Suspects win by finding the Spy. The Spy wins by avoiding the
              vote, or by guessing the secret word when the last-chance rule is
              enabled.
            </Help>
            <Help>
              The host starts the game and manages the room, but takes turns
              and votes like everyone else.
            </Help>
          </Section>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { alignItems: "center", padding: 16 },
  column: { width: "100%", maxWidth: MAX_WIDTH, gap: 14 },
});
