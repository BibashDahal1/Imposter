/** Finished game logo for the browser, drawn as an SVG in the theme colours. */
import { BG_PATH, FIG_PATH } from "@/features/game-loader/gameLogoArt";
import type { Palette } from "@/theme/colors";

const FONT = "Oswald_700Bold, Oswald, 'Arial Narrow', Impact, sans-serif";
const FONT_MEDIUM =
  "Oswald_500Medium, Oswald, 'Arial Narrow', Impact, sans-serif";

export default function HomeLogo({
  width,
  palette,
}: {
  width: number;
  palette: Palette;
}) {
  return (
    <svg
      width={width}
      height={(width * 525) / 620}
      viewBox="395 120 620 525"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="The Imposter – A Spy in Nepal"
      style={{ display: "block" }}
    >
      <path d={BG_PATH} fill={palette.ink} fillRule="evenodd" />
      <path d={FIG_PATH} fill={palette.ink} fillRule="evenodd" />
      <text
        x={723}
        y={566}
        textAnchor="middle"
        fontSize={80}
        fontWeight={700}
        fontFamily={FONT}
        fill={palette.ink}
        textLength={452}
        lengthAdjust="spacingAndGlyphs"
      >
        THE IMPOSTER
      </text>
      <text
        x={723}
        y={626}
        textAnchor="middle"
        fontSize={44}
        fontWeight={500}
        fontFamily={FONT_MEDIUM}
        letterSpacing={3}
        fill={palette.ink}
        textLength={340}
        lengthAdjust="spacing"
      >
        A SPY IN NEPAL
      </text>
    </svg>
  );
}
