/**
 * Game logo stage ("The Imposter: A Spy in Nepal") for phones and tablets.
 * Expo uses GameLoader.web.tsx on web and this file on iOS / Android.
 *
 * Same behaviour as the web version:
 * - While `active` is false the logo is already built but hidden, under the company loader.
 * - When `active` turns true the brush reveal plays once, holds, then fades out.
 * - Tap to skip to the finished logo.
 *
 * Everything is driven by one JS clock (no Reanimated, no dash tricks), so it behaves the
 * same on iOS and Android.
 *
 * Needs: react-native-svg, react-native-safe-area-context
 *   npx expo install react-native-svg react-native-safe-area-context
 */
import { memo, useCallback, useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Easing,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Defs, Mask, Path, Rect } from "react-native-svg";

import { BG_PATH, FIG_PATH } from "./gameLogoArt";
import { SUB_PATH, TITLE_PATH } from "./gameLogoText";
import { BRUSH_STROKES, partialPath, type BrushStroke } from "./roughBrush";

/** 'auto' follows the device. Use 'light' to always show the original dark ink on white. */
const THEME: "dark" = "dark";

/**
 * When true, a phone that has "reduce motion" / "remove animations" turned on skips straight
 * to the finished logo. Leave false so the animation always plays.
 */
const RESPECT_REDUCED_MOTION = false;

const HOLD = 900; // ms the finished logo stays on screen
const FADE = 500; // ms to fade the stage out
const REDUCED_HOLD = 1200;
const SKIP_SETTLE = 350;

// Same curves and timings as the web version.
const EASE_STROKE = Easing.bezier(0.45, 0, 0.25, 1);
const EASE_SLIDE = Easing.bezier(0.16, 1, 0.3, 1);
const EASE_FADE = Easing.bezier(0, 0, 0.58, 1); // CSS "ease-out"
const BRUSH_MS = 2000;
const SLIDE_MS = 1100;
const FIG_DELAY = 1900;
const TITLE_DELAY = 2800;
const SUB_DELAY = 3400;
const TOTAL_MS = SUB_DELAY + SLIDE_MS; // everything has landed

// Logo coordinate space (the web viewBox).
const VB_X = 395;
const VB_Y = 120;
const VB_W = 620;
const VB_H = 525;
const VIEW_BOX = `${VB_X} ${VB_Y} ${VB_W} ${VB_H}`;

const absoluteFill = {
  position: "absolute" as const,
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
};

type Progress = { brush: number; fig: number; title: number; sub: number };
const START: Progress = { brush: 0, fig: 0, title: 0, sub: 0 };
const END: Progress = { brush: 1, fig: 1, title: 1, sub: 1 };

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

function progressAt(ms: number): Progress {
  return {
    brush: EASE_STROKE(clamp01(ms / BRUSH_MS)),
    fig: EASE_SLIDE(clamp01((ms - FIG_DELAY) / SLIDE_MS)),
    title: EASE_SLIDE(clamp01((ms - TITLE_DELAY) / SLIDE_MS)),
    sub: EASE_SLIDE(clamp01((ms - SUB_DELAY) / SLIDE_MS)),
  };
}

function clearTimer(t: ReturnType<typeof setTimeout> | null) {
  if (t) clearTimeout(t);
}

const BrushStrokePath = memo(function BrushStrokePath({
  stroke,
  progress,
}: {
  stroke: BrushStroke;
  progress: number;
}) {
  const d = partialPath(stroke, progress);
  if (!d) return null;
  return (
    <Path
      d={d}
      fill="none"
      stroke="#fff"
      strokeWidth={stroke.width}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
});

/** Background shape revealed by the growing brush mask. */
const BrushLayer = memo(function BrushLayer({
  ink,
  progress,
}: {
  ink: string;
  progress: number;
}) {
  return (
    <Svg
      width="100%"
      height="100%"
      viewBox={VIEW_BOX}
      style={StyleSheet.absoluteFill}
    >
      <Defs>
        <Mask
          id="gl-brush"
          maskUnits="userSpaceOnUse"
          x={VB_X}
          y={VB_Y}
          width={VB_W}
          height={VB_H}
        >
          {/* Solid black = hidden. Makes the "nothing drawn yet" state explicit. */}
          <Rect x={VB_X} y={VB_Y} width={VB_W} height={VB_H} fill="#000" />
          {BRUSH_STROKES.map((st, i) => (
            <BrushStrokePath key={i} stroke={st} progress={progress} />
          ))}
        </Mask>
      </Defs>
      <Path mask="url(#gl-brush)" fill={ink} fillRule="evenodd" d={BG_PATH} />
    </Svg>
  );
});

type Props = {
  /** false: logo is built but hidden. true: play the logo. */
  active: boolean;
  /** Set to true when the app has finished loading. The stage waits for it before leaving. */
  ready: boolean;
  /** Called once the stage has fully faded out. */
  onDone: () => void;
};

export default function GameLoader({ active, ready, onDone }: Props) {
  const insets = useSafeAreaInsets();
  const { width: winW, height: winH } = useWindowDimensions();

  const dark = THEME === "dark";
  const bg = dark ? "#000000" : "#ffffff";
  const ink = dark ? "#f4f1ea" : "#2b2f32";
  const textColor = dark ? "#f4f1ea" : "#26282a";

  // Same sizing rule as the web: width min(96vw, 900px), max-height 94vh, scaled to fit.
  const boxW = Math.min(winW * 0.96, 900);
  const boxH = Math.min((boxW * VB_H) / VB_W, winH * 0.94);
  const k = Math.min(boxW / VB_W, boxH / VB_H); // logo units -> screen px

  const [p, setP] = useState<Progress>(START);
  const [opacity, setOpacity] = useState(1);
  const [leaving, setLeaving] = useState(false);
  const [gone, setGone] = useState(false);

  const rafRef = useRef(0);
  const playedRef = useRef(false);
  const exitingRef = useRef(false);
  const skippedRef = useRef(false);
  const readyRef = useRef(ready);
  const reduceRef = useRef(false);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  const tryExit = useCallback(() => {
    if (exitingRef.current || !playedRef.current || !readyRef.current) return;
    exitingRef.current = true;
    setLeaving(true);
    const t0 = Date.now();
    const tick = () => {
      const t = clamp01((Date.now() - t0) / FADE);
      setOpacity(1 - EASE_FADE(t));
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setGone(true);
        doneRef.current();
      }
    };
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  useEffect(() => {
    readyRef.current = ready;
    tryExit();
  }, [ready, tryExit]);

  useEffect(() => {
    if (!RESPECT_REDUCED_MOTION) return;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => {
      reduceRef.current = v;
    });
    const sub = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      (v) => {
        reduceRef.current = v;
      },
    );
    return () => sub.remove();
  }, []);

  // Play. Starts two frames after `active` turns true, so the clock only runs once the
  // (already built) logo is on screen.
  useEffect(() => {
    if (!active) return;
    let raf1 = 0;
    let raf2 = 0;

    const begin = () => {
      if (skippedRef.current || exitingRef.current) return;

      if (RESPECT_REDUCED_MOTION && reduceRef.current) {
        setP(END);
        holdTimerRef.current = setTimeout(() => {
          playedRef.current = true;
          tryExit();
        }, REDUCED_HOLD);
        return;
      }

      const t0 = Date.now();
      const tick = () => {
        const ms = Date.now() - t0;
        if (ms >= TOTAL_MS) {
          setP(END);
          holdTimerRef.current = setTimeout(() => {
            playedRef.current = true;
            tryExit();
          }, HOLD);
          return;
        }
        setP(progressAt(ms));
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    };

    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(begin);
    });

    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      cancelAnimationFrame(rafRef.current);
      clearTimer(holdTimerRef.current);
    };
  }, [active, tryExit]);

  const skip = () => {
    if (!active || exitingRef.current || skippedRef.current) return;
    skippedRef.current = true;
    clearTimer(holdTimerRef.current);
    cancelAnimationFrame(rafRef.current);
    setP(END);
    holdTimerRef.current = setTimeout(() => {
      playedRef.current = true;
      tryExit();
    }, SKIP_SETTLE);
  };

  if (gone) return null;

  return (
    <View
      pointerEvents={active && !leaving ? "auto" : "none"}
      style={[
        styles.root,
        {
          backgroundColor: bg,
          opacity,
          paddingTop: Math.max(16, insets.top),
          paddingBottom: Math.max(16, insets.bottom),
        },
      ]}
    >
      <Pressable
        style={styles.press}
        onPress={skip}
        disabled={!active}
        accessibilityRole="progressbar"
        accessibilityLabel="Loading The Imposter"
      >
        {/* Built before it is needed. Everything starts hidden: the brush mask is empty and the
            pieces sit outside the clipped box. */}
        <View style={{ width: boxW, height: boxH, overflow: "hidden" }}>
          <BrushLayer ink={ink} progress={p.brush} />

          {/* Figure slides in from the left (translateX -700 -> 0) */}
          <View
            style={[
              StyleSheet.absoluteFill,
              { transform: [{ translateX: -700 * k * (1 - p.fig) }] },
            ]}
          >
            <Svg width="100%" height="100%" viewBox={VIEW_BOX}>
              <Path fill={ink} fillRule="evenodd" d={FIG_PATH} />
            </Svg>
          </View>

          {/* Title rises from below (translateY 320 -> 0) */}
          <View
            style={[
              StyleSheet.absoluteFill,
              { transform: [{ translateY: 320 * k * (1 - p.title) }] },
            ]}
          >
            <Svg width="100%" height="100%" viewBox={VIEW_BOX}>
              <Path fill={textColor} d={TITLE_PATH} />
            </Svg>
          </View>

          {/* Subtitle slides in from the right (translateX 700 -> 0) */}
          <View
            style={[
              StyleSheet.absoluteFill,
              { transform: [{ translateX: 700 * k * (1 - p.sub) }] },
            ]}
          >
            <Svg width="100%" height="100%" viewBox={VIEW_BOX}>
              <Path fill={textColor} d={SUB_PATH} />
            </Svg>
          </View>
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...absoluteFill,
    zIndex: 9998,
    elevation: 9998,
    paddingHorizontal: 16,
  },
  press: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
