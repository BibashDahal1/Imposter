/**
 * Browser version of the loader. Expo picks this file instead of
 * TurtleLoader.tsx when running on web, so Skia / CanvasKit is never loaded.
 * It runs your original canvas engine (turtleLoaderEngine.ts) unchanged.
 */
import { useEffect, useRef, useState } from "react";

import { startTurtleLoader } from "./turtleLoaderEngine";

const SPARKS = [
  { left: "0%", top: "4%", size: 34, delay: "0.4s" },
  { left: "93%", top: "12%", size: 26, delay: "1.1s" },
  { left: "88%", top: "88%", size: 30, delay: "0.8s" },
  { left: "3%", top: "84%", size: 22, delay: "1.5s" },
  { left: "48%", top: "-6%", size: 20, delay: "1.9s" },
];

/*
 * Replaces the Tailwind classes from the Next.js version.
 * The bob / twinkle / breathe keyframes are approximations: if your Tailwind
 * config has the real ones, copy their values in here.
 */
const CSS = `
#turtle-loader{position:fixed;inset:0;z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;
  padding:max(1.5rem,env(safe-area-inset-top)) 1.5rem max(1.5rem,env(safe-area-inset-bottom));
  background:#000;touch-action:none;overscroll-behavior:none;transition:opacity 600ms ease-out,visibility 600ms ease-out}
#turtle-loader.done{pointer-events:none;visibility:hidden;opacity:0}
#turtle-loader .tl-sr{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
#turtle-loader .tl-wrap{position:relative;width:min(88vw,660px,calc(58vh * 1.3356))}
#turtle-loader canvas{display:block;width:100%;aspect-ratio:1584/1186;will-change:transform}
#turtle-loader i{position:absolute;aspect-ratio:1/1;background:#ffc933;opacity:0;pointer-events:none;
  clip-path:polygon(50% 0,61% 39%,100% 50%,61% 61%,50% 100%,39% 61%,0 50%,39% 39%)}
#turtle-loader .tl-shadow{margin:1rem auto 0;height:18px;width:62%;border-radius:50%;opacity:.9;
  background:radial-gradient(closest-side,rgba(60,30,5,.28),transparent)}
@media (prefers-color-scheme:dark){#turtle-loader .tl-shadow{background:radial-gradient(closest-side,rgba(255,255,255,.16),transparent)}}
@keyframes tl-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}
@keyframes tl-twinkle{0%,100%{opacity:0;transform:scale(.35) rotate(0deg)}50%{opacity:1;transform:scale(1) rotate(45deg)}}
@keyframes tl-breathe{0%,100%{transform:scaleX(1);opacity:.9}50%{transform:scaleX(.86);opacity:.6}}
@media (prefers-reduced-motion:no-preference){
  #turtle-loader.idle canvas{animation:tl-bob 3.2s ease-in-out infinite}
  #turtle-loader.idle i{animation:tl-twinkle 2.4s ease-in-out infinite}
  #turtle-loader.idle .tl-shadow{animation:tl-breathe 3.2s ease-in-out infinite}
}
@media (prefers-reduced-motion:reduce){#turtle-loader i{display:none}}
`;

type Props = {
  /** Set to true when the app has finished loading. */
  ready: boolean;
  /** Called once the loader has fully faded out. */
  onDone: () => void;
};

export default function TurtleLoader({ ready, onDone }: Props) {
  const loaderRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  const [gone, setGone] = useState(false);

  useEffect(() => {
    if (!loaderRef.current || !canvasRef.current) return;
    return startTurtleLoader(loaderRef.current, canvasRef.current, () => {
      setGone(true);
      doneRef.current();
    });
  }, []);

  // The engine also waits for the browser "load" event; this lets the app say "ready" too.
  useEffect(() => {
    if (ready) window.TurtleLoader?.finish();
  }, [ready]);

  if (gone) return null;

  return (
    <div
      id="turtle-loader"
      ref={loaderRef}
      role="status"
      aria-label="Loading Turtle Games"
    >
      <style>{CSS}</style>
      <span className="tl-sr">Loading…</span>
      <div className="tl-wrap">
        <canvas ref={canvasRef} aria-hidden="true" />
        {SPARKS.map((s, i) => (
          <i
            key={i}
            style={{
              left: s.left,
              top: s.top,
              width: s.size,
              animationDelay: s.delay,
            }}
          />
        ))}
      </div>
      <div className="tl-shadow" />
    </div>
  );
}
