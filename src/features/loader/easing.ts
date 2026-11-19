/** Easing helpers. All are worklets so they can run on the UI thread. */

export function clamp01(v: number): number {
  "worklet";
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/** CSS-style cubic-bezier(x1, y1, x2, y2) evaluated at progress x (0..1). */
export function cubicBezier(
  x: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): number {
  "worklet";
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  let t = x;
  for (let i = 0; i < 6; i++) {
    const e = ((ax * t + bx) * t + cx) * t - x;
    if (Math.abs(e) < 1e-5) break;
    const d = (3 * ax * t + 2 * bx) * t + cx;
    if (Math.abs(d) < 1e-6) break;
    t -= e / d;
  }
  t = clamp01(t);
  return ((ay * t + by) * t + cy) * t;
}

export function eDraw(x: number): number {
  "worklet";
  return cubicBezier(x, 0.45, 0.05, 0.35, 1);
}
export function eUndraw(x: number): number {
  "worklet";
  return cubicBezier(x, 0.55, 0, 0.4, 1);
}
export function eSoft(x: number): number {
  "worklet";
  return cubicBezier(x, 0.42, 0, 0.58, 1);
}
export function eSheen(x: number): number {
  "worklet";
  return cubicBezier(x, 0.25, 0.6, 0.3, 1);
}
