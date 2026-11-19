import { useColorScheme } from "react-native";

import { darkPalette, lightPalette, type Palette } from "./colors";

/** Returns the palette for the current system light / dark setting. */
export function useAppTheme(): { colors: Palette; dark: boolean } {
  const dark = useColorScheme() === "dark";
  return { colors: dark ? darkPalette : lightPalette, dark };
}
