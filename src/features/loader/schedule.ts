/**
 * Pure (non-UI) part of the loader: parses the outline data and works out
 * when every stroke starts, how long it takes and when it retracts.
 * Same numbers as the web version.
 */

export const W2 = 1584;
export const H2 = 1186;

/** timing (ms) */
export const T = {
  START: 200,
  SPREAD: 2400,
  ROWDELAY: 350,
  ROW_SPLIT: 500,
  SPEED: 3.0,
  DMIN: 220,
  DMAX: 2800,
  FILL_GAP: 200,
  FILL: 1200,
  SHEEN: 1300,
  UNDRAW_AFTER: 900,
  USPREAD: 800,
  HOLD: 1100,
  FADE: 700,
  GAP: 300,
  EXIT: 700,
} as const;

/** Most pen-tip dots shown at once. */
export const MAX_TIPS = 40;

export type Contour = {
  xy: number[]; // x0,y0,x1,y1,...
  cum: number[]; // cumulative length at each point
  len: number;
  cx: number;
  cy: number;
  s: number; // draw start (ms)
  d: number; // draw duration (ms)
  u: number; // retract start (ms)
  ud: number; // retract duration (ms)
};

export type Schedule = {
  contours: Contour[];
  drawEnd: number;
  fillAt: number;
  sheenAt: number;
  undrawEnd: number;
  settled: number;
  holdEnd: number;
};

export function buildSchedule(
  data: ReadonlyArray<readonly [number, string]>,
): Schedule {
  const contours: Contour[] = [];
  const seen = new Set<string>();

  data.forEach((entry) => {
    entry[1].split("z").forEach((sub) => {
      if (seen.has(sub)) return;
      const m = /^M(-?\d+) (-?\d+)l(.*)$/.exec(sub);
      if (!m) return;
      seen.add(sub);
      let x = +m[1];
      let y = +m[2];
      const pts: number[] = [x, y];
      const nums = m[3].match(/-?\d+/g) || [];
      for (let i = 0; i + 1 < nums.length; i += 2) {
        x += +nums[i];
        y += +nums[i + 1];
        pts.push(x, y);
      }
      pts.push(pts[0], pts[1]); // close the loop
      const n = pts.length / 2;
      const cum: number[] = new Array(n).fill(0);
      let minx = 1e9;
      let maxx = -1e9;
      let miny = 1e9;
      let maxy = -1e9;
      for (let i = 1; i < n; i++) {
        cum[i] =
          cum[i - 1] +
          Math.hypot(
            pts[2 * i] - pts[2 * i - 2],
            pts[2 * i + 1] - pts[2 * i - 1],
          );
      }
      for (let i = 0; i < n; i++) {
        if (pts[2 * i] < minx) minx = pts[2 * i];
        if (pts[2 * i] > maxx) maxx = pts[2 * i];
        if (pts[2 * i + 1] < miny) miny = pts[2 * i + 1];
        if (pts[2 * i + 1] > maxy) maxy = pts[2 * i + 1];
      }
      contours.push({
        xy: pts,
        cum,
        len: cum[n - 1],
        cx: (minx + maxx) / 2,
        cy: (miny + maxy) / 2,
        s: 0,
        d: 0,
        u: 0,
        ud: 0,
      });
    });
  });

  const N = contours.length;

  /* draw schedule: left to right, top row first */
  let drawEnd = 0;
  contours.forEach((c, i) => {
    const row = c.cy < T.ROW_SPLIT ? 0 : 1;
    const big = Math.min(1, c.len / 6000);
    c.s =
      c.len > 7000
        ? 0
        : T.START +
          (c.cx / W2) * T.SPREAD * (1 - 0.8 * big) +
          row * T.ROWDELAY +
          ((i * 37) % 90);
    c.d = Math.min(T.DMAX, Math.max(T.DMIN, c.len / T.SPEED));
    drawEnd = Math.max(drawEnd, c.s + c.d);
  });

  const fillAt = drawEnd + T.FILL_GAP;
  const sheenAt = fillAt + 700;
  const undrawAt = fillAt + T.UNDRAW_AFTER;

  /* retract in the same order the strokes were drawn */
  const order = contours
    .map((_, i) => i)
    .sort((a, b) => contours[a].s - contours[b].s);
  let undrawEnd = 0;
  order.forEach((i, r) => {
    const c = contours[i];
    c.u = undrawAt + (r / Math.max(1, N - 1)) * T.USPREAD;
    c.ud = Math.min(900, Math.max(300, c.d * 0.6));
    undrawEnd = Math.max(undrawEnd, c.u + c.ud);
  });

  const settled = Math.max(undrawEnd, fillAt + T.FILL, sheenAt + T.SHEEN);
  const holdEnd = settled + T.HOLD;

  return { contours, drawEnd, fillAt, sheenAt, undrawEnd, settled, holdEnd };
}

/** Point at distance l along a contour. Runs on the UI thread. */
export function pointAt(c: Contour, l: number): { x: number; y: number } {
  "worklet";
  const cum = c.cum;
  const xy = c.xy;
  if (l < 0) l = 0;
  else if (l > c.len) l = c.len;
  let lo = 0;
  let hi = cum.length - 1;
  while (hi - lo > 1) {
    const m = (lo + hi) >> 1;
    if (cum[m] <= l) lo = m;
    else hi = m;
  }
  const span = cum[hi] - cum[lo] || 1;
  const t = (l - cum[lo]) / span;
  return {
    x: xy[2 * lo] + t * (xy[2 * hi] - xy[2 * lo]),
    y: xy[2 * lo + 1] + t * (xy[2 * hi + 1] - xy[2 * lo + 1]),
  };
}
