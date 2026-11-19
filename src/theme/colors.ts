/** Colour palettes. The logo is dark ink on white, so light mode keeps that and dark mode inverts it. */
export type Palette = {
  bg: string;
  surface: string;
  ink: string; // main text, logo, dark buttons
  inkSoft: string; // secondary text
  onInk: string; // text on an ink-coloured button
  line: string; // borders
  accent: string; // main call to action
  onAccent: string;
};

export const lightPalette: Palette = {
  bg: "#FFFFFF",
  surface: "#F4F1EA",
  ink: "#2B2F32",
  inkSoft: "#5C6166",
  onInk: "#FFFFFF",
  line: "#D9D5CC",
  accent: "#B52337",
  onAccent: "#FFFFFF",
};

export const darkPalette: Palette = {
  bg: "#000000",
  surface: "#15171A",
  ink: "#F4F1EA",
  inkSoft: "#A9ADB1",
  onInk: "#111315",
  line: "#2A2D31",
  accent: "#B52337",
  onAccent: "#FFFFFF",
};
