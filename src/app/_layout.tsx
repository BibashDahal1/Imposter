import {
  Oswald_500Medium,
  Oswald_700Bold,
  useFonts,
} from "@expo-google-fonts/oswald";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Provider } from "react-redux";

import GameLoader from "@/features/game-loader/GameLoader";
import { IntroContext } from "@/features/loader/IntroContext";
import TurtleLoader from "@/features/loader/TurtleLoader";
import { store } from "@/store";
import { hydrateSetup, startPersisting } from "@/store/persist";

// Keep the native splash up until our own loader is on screen (no flash between them).
SplashScreen.preventAutoHideAsync();

/** company logo -> game logo -> app */
type Stage = "company" | "game" | "app";

export default function RootLayout() {
  const [stage, setStage] = useState<Stage>("company");
  const [fontsLoaded, fontError] = useFonts({
    Oswald_500Medium,
    Oswald_700Bold,
  });
  const [hydrated, setHydrated] = useState(false);

  // Load the last used players and options, then keep saving changes.
  useEffect(() => {
    hydrateSetup().finally(() => setHydrated(true));
    return startPersisting();
  }, []);

  // The loaders stay until fonts and saved data are ready (a font error must not leave us stuck).
  const ready = (fontsLoaded || !!fontError) && hydrated;

  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  const handleCompanyDone = useCallback(() => setStage("game"), []);
  const handleGameDone = useCallback(() => setStage("app"), []);

  useEffect(() => {
    if (!ready || stage === "app") return;

    const timeoutMs = stage === "company" ? 15_000 : 7_000;
    const timeout = setTimeout(() => {
      setStage(stage === "company" ? "game" : "app");
    }, timeoutMs);

    return () => clearTimeout(timeout);
  }, [ready, stage]);

  return (
    <Provider store={store}>
      <IntroContext.Provider value={stage === "app"}>
        <GestureHandlerRootView style={{ flex: 1, backgroundColor: "#000000" }}>
          <StatusBar style={stage === "app" ? "auto" : "light"} />
          <Stack
            screenOptions={{
              headerShown: false,
              animation: "fade",
              contentStyle: { backgroundColor: "#000000" },
            }}
          />
          {/* Game stage sits underneath, painting only its background until the company loader is gone. */}
          {stage !== "app" && (
            <GameLoader
              active={stage === "game"}
              ready={ready}
              onDone={handleGameDone}
            />
          )}
          {stage === "company" && (
            <TurtleLoader ready={ready} onDone={handleCompanyDone} />
          )}
        </GestureHandlerRootView>
      </IntroContext.Provider>
    </Provider>
  );
}
