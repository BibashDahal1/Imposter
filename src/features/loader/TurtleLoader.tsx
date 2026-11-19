import {
  Canvas,
  Circle,
  FillType,
  Group,
  LinearGradient,
  Paint,
  Path,
  Picture,
  Points,
  RadialGradient,
  Rect,
  Skia,
  vec,
} from "@shopify/react-native-skia";
import { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, useWindowDimensions } from "react-native";
import Animated, {
  useAnimatedStyle,
  useDerivedValue,
  useFrameCallback,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { scheduleOnRN } from "react-native-worklets";

import { clamp01, eDraw, eSheen, eSoft, eUndraw } from "./easing";
import {
  H2,
  MAX_TIPS,
  T,
  W2,
  buildSchedule,
  pointAt,
  type Contour,
  type Schedule,
} from "./schedule";
import { COLS, DATA } from "./turtleArt";

/* layout */
const PAD = 56; // room around the logo for sparkles
const SHADOW_GAP = 16;
const SHADOW_H = 18;
const STROKE_DP = 2.6; // pen width on screen, whatever the logo size

/* idle loops (ms). Tune here to match your CSS keyframes. */
const BOB_PERIOD = 3200;
const BOB_DP = 10;
const TWINKLE_PERIOD = 2400;

const SPARKS = [
  { left: 0.0, top: 0.04, size: 34, delay: 400 },
  { left: 0.93, top: 0.12, size: 26, delay: 1100 },
  { left: 0.88, top: 0.88, size: 30, delay: 800 },
  { left: 0.03, top: 0.84, size: 22, delay: 1500 },
  { left: 0.48, top: -0.06, size: 20, delay: 1900 },
];

type Props = {
  /** Set to true when the app has finished loading. The loader exits after its next full cycle. */
  ready: boolean;
  /** Called once the loader has fully faded out. */
  onDone: () => void;
};

export default function TurtleLoader({ ready, onDone }: Props) {
  const sched = useMemo(() => buildSchedule(DATA), []);
  const empty = sched.contours.length === 0;

  useEffect(() => {
    if (!empty) return;
    console.warn(
      "[TurtleLoader] turtleArt.ts has no data. Paste COLS and DATA from the web loader.",
    );
    const id = setTimeout(onDone, 60);
    return () => clearTimeout(id);
  }, [empty, onDone]);

  if (empty) return null;
  return <Loader sched={sched} ready={ready} onDone={onDone} />;
}

function Loader({ sched, ready, onDone }: Props & { sched: Schedule }) {
  const light = false;
  const reduced = useReducedMotion();
  const { width: sw, height: sh } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  /* same sizing rule as the web version: min(88vw, 660, 58vh * aspect) */
  const logoW = Math.min(sw * 0.88, 660, sh * 0.58 * (W2 / H2));
  const logoH = (logoW * H2) / W2;
  const scale = logoW / W2;
  const canvasW = logoW + PAD * 2;
  const canvasH = logoH + SHADOW_GAP + SHADOW_H + PAD * 2;

  /* shared clocks, all driven by one frame callback on the UI thread */
  const time = useSharedValue(0);
  const artOpacity = useSharedValue(1);
  const bob = useSharedValue(0);
  const idleClock = useSharedValue(-1);
  const cycle0 = useSharedValue(-1);
  const idleStart = useSharedValue(-1);
  const fading = useSharedValue(false);
  const finished = useSharedValue(false);
  const readySV = useSharedValue(ready);
  const overlay = useSharedValue(1);
  const [done, setDone] = useState(false);

  useEffect(() => {
    readySV.value = ready;
  }, [ready, readySV]);

  const onFinish = useCallback(() => setDone(true), []);

  const { fillAt, holdEnd } = sched;
  useFrameCallback((frame) => {
    "worklet";
    if (finished.value) return;
    const now = frame.timeSinceFirstFrame;
    if (cycle0.value < 0) cycle0.value = now;
    let t = now - cycle0.value;

    if (t >= holdEnd) {
      if (!fading.value) {
        if (readySV.value) {
          finished.value = true;
          scheduleOnRN(onFinish);
          return;
        }
        fading.value = true; // not ready yet: fade out, replay the sketch
      }
      artOpacity.value = 1 - eSoft(clamp01((t - holdEnd) / T.FADE));
      if (t >= holdEnd + T.FADE + T.GAP) {
        cycle0.value = now;
        t = 0;
        fading.value = false;
        artOpacity.value = 1;
      }
    }
    time.value = t;

    if (idleStart.value < 0 && t > fillAt + T.FILL) idleStart.value = now;
    if (idleStart.value >= 0) {
      idleClock.value = now - idleStart.value;
      const ph = (idleClock.value % BOB_PERIOD) / BOB_PERIOD;
      bob.value = reduced ? 0 : 0.5 - 0.5 * Math.cos(ph * 2 * Math.PI);
    }
  });

  /* exit: fade the whole overlay, then tell the parent */
  useEffect(() => {
    if (!done) return;
    overlay.value = withTiming(0, { duration: 600 });
    const id = setTimeout(onDone, T.EXIT);
    return () => clearTimeout(id);
  }, [done, onDone, overlay]);
  const overlayStyle = useAnimatedStyle(() => ({ opacity: overlay.value }));

  const base = STROKE_DP / scale; // pen width in logo units
  const lineColor = light ? "#5a2d0c" : "#ffeab0";
  const glowColor = light ? "#e0a72e" : "#ffd45a";

  const logoTransform = useMemo(
    () => [{ translateX: PAD }, { translateY: PAD }, { scale }],
    [scale],
  );
  const bobTransform = useDerivedValue(() => [
    { translateY: -bob.value * BOB_DP },
  ]);

  return (
    <Animated.View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel="Loading Turtle Games"
      pointerEvents={done ? "none" : "auto"}
      style={[
        styles.overlay,
        {
          backgroundColor: light ? "#ffffff" : "#000000",
          paddingTop: Math.max(24, insets.top),
          paddingBottom: Math.max(24, insets.bottom),
        },
        overlayStyle,
      ]}
    >
      <Canvas style={{ width: canvasW, height: canvasH }}>
        <Shadow
          cx={canvasW / 2}
          cy={PAD + logoH + SHADOW_GAP + SHADOW_H / 2}
          width={logoW * 0.62}
          height={SHADOW_H}
          light={light}
          bob={bob}
        />

        <Group opacity={artOpacity}>
          <Group transform={bobTransform}>
            <Group transform={logoTransform}>
              <Fills sched={sched} time={time} />
              {sched.contours.map((c, i) => (
                <ContourStroke
                  key={i}
                  c={c}
                  time={time}
                  base={base}
                  scale={scale}
                  lineColor={lineColor}
                  glowColor={glowColor}
                />
              ))}
              <Tips
                sched={sched}
                time={time}
                base={base}
                glowColor={glowColor}
              />
            </Group>
          </Group>
        </Group>

        {SPARKS.map((s, i) => (
          <Spark
            key={i}
            cx={PAD + s.left * logoW + s.size / 2}
            cy={PAD + s.top * logoH + s.size / 2}
            size={s.size}
            delay={s.delay}
            idleClock={idleClock}
            reduced={reduced}
          />
        ))}
      </Canvas>
    </Animated.View>
  );
}

/* ---------- colour fills (recorded once) + diagonal sheen ---------- */

function Fills({
  sched,
  time,
}: {
  sched: Schedule;
  time: SharedValue<number>;
}) {
  const { fillAt, sheenAt } = sched;

  const picture = useMemo(() => {
    const rec = Skia.PictureRecorder();
    const canvas = rec.beginRecording(Skia.XYWHRect(0, 0, W2, H2));
    const paint = Skia.Paint();
    paint.setAntiAlias(true);
    DATA.forEach(([ci, d]) => {
      const parsed = Skia.Path.MakeFromSVGString(d);
      if (!parsed) return;
      const p = Skia.PathBuilder.MakeFromPath(parsed)
        .setFillType(FillType.EvenOdd)
        .build();
      paint.setColor(Skia.Color(COLS[ci]));
      canvas.drawPath(p, paint);
    });
    return rec.finishRecordingAsPicture();
  }, []);

  const fillAlpha = useDerivedValue(() =>
    eSoft(clamp01((time.value - fillAt) / T.FILL)),
  );
  const sheenOn = useDerivedValue(() => {
    const sp = clamp01((time.value - sheenAt) / T.SHEEN);
    return sp > 0 && sp < 1 ? 1 : 0;
  });
  /* band leans like the web version: iso-lines follow x + 0.36y */
  const bw = (W2 * 0.34) / 1.1296;
  const gStart = useDerivedValue(() => {
    const sp = clamp01((time.value - sheenAt) / T.SHEEN);
    const x = (-0.45 + eSheen(sp) * 1.9) * W2 + 0.18 * H2;
    return vec(x, 0);
  });
  const gEnd = useDerivedValue(() => {
    const sp = clamp01((time.value - sheenAt) / T.SHEEN);
    const x = (-0.45 + eSheen(sp) * 1.9) * W2 + 0.18 * H2;
    return vec(x + bw, 0.36 * bw);
  });

  return (
    <Group layer={<Paint opacity={fillAlpha} />}>
      <Picture picture={picture} />
      <Rect
        x={-W2}
        y={-H2}
        width={W2 * 3}
        height={H2 * 3}
        blendMode="srcATop"
        opacity={sheenOn}
      >
        <LinearGradient
          start={gStart}
          end={gEnd}
          colors={[
            "rgba(255,255,255,0)",
            "rgba(255,248,226,0.95)",
            "rgba(255,255,255,0)",
          ]}
          positions={[0, 0.5, 1]}
        />
      </Rect>
    </Group>
  );
}

/* ---------- one outline: draws in, then retracts ---------- */

function ContourStroke({
  c,
  time,
  base,
  scale,
  lineColor,
  glowColor,
}: {
  c: Contour;
  time: SharedValue<number>;
  base: number;
  scale: number;
  lineColor: string;
  glowColor: string;
}) {
  const path = useMemo(() => {
    const b = Skia.PathBuilder.Make();
    b.moveTo(c.xy[0], c.xy[1]);
    for (let i = 1; i < c.xy.length / 2; i++)
      b.lineTo(c.xy[2 * i], c.xy[2 * i + 1]);
    return b.build();
  }, [c]);

  const end = useDerivedValue(() => eDraw(clamp01((time.value - c.s) / c.d)));
  const start = useDerivedValue(() =>
    eUndraw(clamp01((time.value - c.u) / c.ud)),
  );
  const visible = useDerivedValue(() =>
    end.value > 0 && start.value < 1 ? 1 : 0,
  );

  const nudge = useMemo(
    () => [{ translateX: 0.75 / scale }, { translateY: -0.6 / scale }],
    [scale],
  );

  return (
    <Group opacity={visible}>
      <Path
        path={path}
        style="stroke"
        strokeCap="round"
        strokeJoin="round"
        color={glowColor}
        opacity={0.16}
        strokeWidth={base * 3.4}
        start={start}
        end={end}
      />
      <Group transform={nudge}>
        <Path
          path={path}
          style="stroke"
          strokeCap="round"
          strokeJoin="round"
          color={lineColor}
          opacity={0.4}
          strokeWidth={base * 0.65}
          start={start}
          end={end}
        />
      </Group>
      <Path
        path={path}
        style="stroke"
        strokeCap="round"
        strokeJoin="round"
        color={lineColor}
        strokeWidth={base}
        start={start}
        end={end}
      />
    </Group>
  );
}

/* ---------- glowing pen tips (up to MAX_TIPS at once) ---------- */

function Tips({
  sched,
  time,
  base,
  glowColor,
}: {
  sched: Schedule;
  time: SharedValue<number>;
  base: number;
  glowColor: string;
}) {
  const { contours, drawEnd } = sched;
  const tips = useDerivedValue(() => {
    const out: { x: number; y: number }[] = [];
    const now = time.value;
    if (now > drawEnd) return out;
    for (let i = 0; i < contours.length && out.length < MAX_TIPS; i++) {
      const c = contours[i];
      const p = eDraw(clamp01((now - c.s) / c.d));
      if (p > 0 && p < 1) out.push(pointAt(c, p * c.len));
    }
    return out;
  });
  return (
    <>
      <Points
        points={tips}
        mode="points"
        style="stroke"
        strokeCap="round"
        color={glowColor}
        opacity={0.35}
        strokeWidth={base * 4.4}
      />
      <Points
        points={tips}
        mode="points"
        style="stroke"
        strokeCap="round"
        color="#fffaf0"
        strokeWidth={base * 1.6}
      />
    </>
  );
}

/* ---------- soft ground shadow under the logo ---------- */

function Shadow({
  cx,
  cy,
  width,
  height,
  light,
  bob,
}: {
  cx: number;
  cy: number;
  width: number;
  height: number;
  light: boolean;
  bob: SharedValue<number>;
}) {
  const tf = useDerivedValue(() => [
    { translateX: cx },
    { translateY: cy },
    { scaleX: 1 - 0.14 * bob.value },
    { scaleY: height / width },
  ]);
  const op = useDerivedValue(() => 0.9 - 0.3 * bob.value);
  const r = width / 2;
  return (
    <Group transform={tf} opacity={op}>
      <Circle cx={0} cy={0} r={r}>
        <RadialGradient
          c={vec(0, 0)}
          r={r}
          colors={
            light
              ? ["rgba(60,30,5,0.28)", "rgba(60,30,5,0)"]
              : ["rgba(255,255,255,0.16)", "rgba(255,255,255,0)"]
          }
        />
      </Circle>
    </Group>
  );
}

/* ---------- twinkling four-point sparkles ---------- */

function Spark({
  cx,
  cy,
  size,
  delay,
  idleClock,
  reduced,
}: {
  cx: number;
  cy: number;
  size: number;
  delay: number;
  idleClock: SharedValue<number>;
  reduced: boolean;
}) {
  const star = useMemo(() => {
    const pts: [number, number][] = [
      [0.5, 0],
      [0.61, 0.39],
      [1, 0.5],
      [0.61, 0.61],
      [0.5, 1],
      [0.39, 0.61],
      [0, 0.5],
      [0.39, 0.39],
    ];
    const b = Skia.PathBuilder.Make();
    pts.forEach(([x, y], i) => {
      const px = (x - 0.5) * size;
      const py = (y - 0.5) * size;
      if (i === 0) b.moveTo(px, py);
      else b.lineTo(px, py);
    });
    b.close();
    return b.build();
  }, [size]);

  const phase = useDerivedValue(() => {
    const t0 = idleClock.value - delay;
    if (reduced || idleClock.value < 0 || t0 < 0) return -1;
    return (t0 % TWINKLE_PERIOD) / TWINKLE_PERIOD;
  });
  const tf = useDerivedValue(() => {
    const ph = phase.value < 0 ? 0 : phase.value;
    const v = Math.sin(ph * Math.PI);
    return [
      { translateX: cx },
      { translateY: cy },
      { rotate: ph * (Math.PI / 2) },
      { scale: 0.35 + 0.65 * v },
    ];
  });
  const op = useDerivedValue(() =>
    phase.value < 0 ? 0 : Math.sin(phase.value * Math.PI),
  );

  return (
    <Group transform={tf} opacity={op}>
      <Path path={star} color="#ffc933" />
    </Group>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 9999,
    elevation: 9999,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
});
