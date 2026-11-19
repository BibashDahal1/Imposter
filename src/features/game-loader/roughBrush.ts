/**
 * Native stand-in for the web logo's "rough" brush.
 *
 * On web the brush is one straight serpentine stroke run through
 * feTurbulence + feDisplacementMap. react-native-svg has neither filter, so the
 * same serpentine (same rows, same 88-wide stroke, same round caps) is built
 * from a few slightly different hand-jittered copies. Their union gives the
 * wobbly bottom edge and the ragged leading tip. Everything is seeded, so the
 * result is identical on every launch and every device.
 */

export type BrushStroke = {
  /** Full path (used once the stroke is complete). */
  d: string;
  /** Real length of the polyline. */
  length: number;
  width: number;
  /** How far this pass's tip lags behind the others mid-reveal (px). All passes meet at the end. */
  pad: number;
  points: [number, number][];
  /** Cumulative length at each point. */
  cum: number[];
  /** "L x y" command for each point (the first one is replaced by "M" when drawing). */
  cmds: string[];
};

// Same geometry as: M470 160H990V216H470V272H990V328H470V384H990V440H470
const X0 = 470;
const X1 = 990;
const Y0 = 160;
const PITCH = 56;
const ROWS = 6;
const SPAN = X1 - X0;
const STEP = 6; // px between sample points

function mulberry32(seed: number) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Smooth 1-D value noise in [-1, 1]. */
function makeNoise(seed: number, wavelength: number) {
  const rand = mulberry32(seed);
  const N = 1024;
  const lattice = Array.from({ length: N }, () => rand() * 2 - 1);
  return (s: number) => {
    const x = s / wavelength;
    const i = Math.floor(x);
    const f = x - i;
    const t = (1 - Math.cos(f * Math.PI)) / 2;
    const a = lattice[((i % N) + N) % N];
    const b = lattice[(((i + 1) % N) + N) % N];
    return a + (b - a) * t;
  };
}

function buildStroke(
  seed: number,
  width: number,
  pad: number,
  amp: number,
): BrushStroke {
  const low = makeNoise(seed, 34);
  const high = makeNoise(seed + 101, 11);
  const jitter = (s: number) => low(s) * amp + high(s) * amp * 0.45;

  const pts: [number, number][] = [];
  const hSteps = Math.round(SPAN / STEP);
  const vSteps = Math.round(PITCH / STEP);
  let s = 0;

  for (let row = 0; row < ROWS; row++) {
    const y = Y0 + row * PITCH;
    const leftToRight = row % 2 === 0;

    for (let k = 0; k <= hSteps; k++) {
      const t = k / hSteps;
      const x = leftToRight ? X0 + t * SPAN : X1 - t * SPAN;
      pts.push([x, y + jitter(s + t * SPAN)]);
    }
    s += SPAN;

    if (row < ROWS - 1) {
      const edgeX = leftToRight ? X1 : X0;
      for (let k = 1; k <= vSteps; k++) {
        const t = k / vSteps;
        pts.push([edgeX + jitter(s + t * PITCH), y + t * PITCH]);
      }
      s += PITCH;
    }
  }

  let length = 0;
  const cum: number[] = [];
  const cmds: string[] = [];
  pts.forEach(([x, y], i) => {
    if (i > 0) {
      const [px, py] = pts[i - 1];
      length += Math.hypot(x - px, y - py);
    }
    cum.push(length);
    cmds.push(`${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`);
  });

  return { d: cmds.join(""), length, width, pad, points: pts, cum, cmds };
}

/** Three overlapping brush passes. Different pads stagger their tips. */
export const BRUSH_STROKES: BrushStroke[] = [
  buildStroke(4, 88, 0, 5),
  buildStroke(17, 86, 40, 5),
  buildStroke(29, 90, 20, 5),
];

/**
 * The part of the stroke drawn so far, as plain path data (no dash tricks).
 * progress 0 -> "" (nothing), progress 1 -> the whole stroke.
 */
export function partialPath(stroke: BrushStroke, progress: number): string {
  if (progress >= 1) return stroke.d;
  const target = stroke.length * progress - stroke.pad * (1 - progress);
  if (target <= 0.5) return "";

  const { cum, points, cmds } = stroke;
  let lo = 0;
  let hi = cum.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (cum[mid] <= target) lo = mid;
    else hi = mid;
  }
  const seg = cum[hi] - cum[lo] || 1;
  const f = (target - cum[lo]) / seg;
  const x = points[lo][0] + (points[hi][0] - points[lo][0]) * f;
  const y = points[lo][1] + (points[hi][1] - points[lo][1]) * f;
  return `${cmds.slice(0, lo + 1).join("")}L${x.toFixed(1)} ${y.toFixed(1)}`;
}
