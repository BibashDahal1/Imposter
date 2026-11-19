/**
 * Game logo stage ("The Imposter: A Spy in Nepal") for the browser.
 * Expo uses this file instead of GameLoader.tsx on web.
 *
 * - While `active` is false it only paints the background, so there is no
 *   flash between the company loader and this one.
 * - When `active` turns true the brush reveal plays once, holds, then fades out.
 * - Tap or click skips to the finished logo.
 */
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import { BG_PATH, FIG_PATH } from "./gameLogoArt";

/** 'auto' follows the device. Use 'light' to always show the original dark ink on white. */
const THEME: "dark" = "dark";

const HOLD = 900; // ms the finished logo stays on screen
const FADE = 500; // ms to fade the stage out

const EASE_STROKE = "cubic-bezier(.45,0,.25,1)";
const EASE_SLIDE = "cubic-bezier(.16,1,.3,1)";
const STEPS = [
  { id: "fig", delay: 1900, from: "translateX(-700px)" },
  { id: "title", delay: 2800, from: "translateY(320px)" },
  { id: "sub", delay: 3400, from: "translateX(700px)" },
] as const;

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Oswald:wght@500;700&display=swap');
#game-loader{--gl-bg:#ffffff;--gl-ink:#2b2f32;--gl-text:#26282a;
  position:fixed;inset:0;z-index:9998;display:flex;align-items:center;justify-content:center;overflow:hidden;
  padding:max(1rem,env(safe-area-inset-top)) 1rem max(1rem,env(safe-area-inset-bottom));
  background:var(--gl-bg);cursor:pointer;touch-action:manipulation;transition:opacity ${FADE}ms ease-out}
@media (prefers-color-scheme:dark){#game-loader[data-theme="auto"]{--gl-bg:#000000;--gl-ink:#f4f1ea;--gl-text:#f4f1ea}}
#game-loader[data-theme="dark"]{--gl-bg:#000000;--gl-ink:#f4f1ea;--gl-text:#f4f1ea}
#game-loader.gl-leaving{opacity:0;pointer-events:none}
#game-loader svg{width:min(96vw,900px);height:auto;max-height:94vh;display:block;overflow:hidden}
#game-loader .gl-ink{fill:var(--gl-ink)}
#game-loader .gl-t{font-family:"Oswald","Bebas Neue","Arial Narrow",Impact,sans-serif;fill:var(--gl-text)}
`;

type Props = {
  /** false: show only the background. true: play the logo. */
  active: boolean;
  /** Set to true when the app has finished loading. The stage waits for it before leaving. */
  ready: boolean;
  /** Called once the stage has fully faded out. */
  onDone: () => void;
};

export default function GameLoader({ active, ready, onDone }: Props) {
  const strokeRef = useRef<SVGPathElement>(null);
  const figRef = useRef<SVGPathElement>(null);
  const titleRef = useRef<SVGTextElement>(null);
  const subRef = useRef<SVGTextElement>(null);

  const animsRef = useRef<Animation[]>([]);
  const playedRef = useRef(false);
  const exitingRef = useRef(false);
  const readyRef = useRef(ready);
  const timerRef = useRef(0);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  const [leaving, setLeaving] = useState(false);
  const [gone, setGone] = useState(false);

  const tryExit = useCallback(() => {
    if (exitingRef.current || !playedRef.current || !readyRef.current) return;
    exitingRef.current = true;
    setLeaving(true);
    timerRef.current = window.setTimeout(() => {
      setGone(true);
      doneRef.current();
    }, FADE);
  }, []);

  useEffect(() => {
    readyRef.current = ready;
    tryExit();
  }, [ready, tryExit]);

  useEffect(() => () => window.clearTimeout(timerRef.current), []);

  // Start before the browser paints, so the finished logo never flashes first.
  useLayoutEffect(() => {
    if (!active) return;
    const stroke = strokeRef.current;
    const refs = {
      fig: figRef.current,
      title: titleRef.current,
      sub: subRef.current,
    };
    if (!stroke || !refs.fig || !refs.title || !refs.sub) return;

    const anims: Animation[] = [];
    anims.push(
      stroke.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], {
        duration: 2000,
        easing: EASE_STROKE,
        fill: "both",
      }),
    );
    STEPS.forEach((s) => {
      anims.push(
        refs[s.id]!.animate(
          [{ transform: s.from }, { transform: "translate(0,0)" }],
          {
            duration: 1100,
            delay: s.delay,
            easing: EASE_SLIDE,
            fill: "both",
          },
        ),
      );
    });
    animsRef.current = anims;

    let hold = 0;
    Promise.all(anims.map((a) => a.finished))
      .then(() => {
        hold = window.setTimeout(
          () => {
            playedRef.current = true;
            tryExit();
          },
          HOLD,
        );
      })
      .catch(() => {
        /* cancelled during cleanup */
      });

    return () => {
      anims.forEach((a) => a.cancel());
      window.clearTimeout(hold);
    };
  }, [active, tryExit]);

  const skip = () => {
    if (!active || exitingRef.current) return;
    animsRef.current.forEach((a) => a.finish());
    window.setTimeout(() => {
      playedRef.current = true;
      tryExit();
    }, 350);
  };

  if (gone) return null;

  return (
    <div
      id="game-loader"
      data-theme={THEME}
      className={leaving ? "gl-leaving" : undefined}
      role="status"
      aria-label="Loading The Imposter"
      onClick={skip}
    >
      <style>{CSS}</style>
      {active && (
        <svg
          viewBox="395 120 620 525"
          xmlns="http://www.w3.org/2000/svg"
          role="img"
          aria-label="The Imposter – A Spy in Nepal"
        >
          <defs>
            <filter id="gl-rough" x="-5%" y="-5%" width="110%" height="110%">
              <feTurbulence
                type="fractalNoise"
                baseFrequency=".035 .14"
                numOctaves={2}
                seed={4}
                result="n"
              />
              <feDisplacementMap in="SourceGraphic" in2="n" scale={16} />
            </filter>
            <mask
              id="gl-brush"
              maskUnits="userSpaceOnUse"
              x={395}
              y={120}
              width={620}
              height={525}
            >
              <g filter="url(#gl-rough)">
                <path
                  ref={strokeRef}
                  pathLength={1}
                  d="M470 160H990V216H470V272H990V328H470V384H990V440H470"
                  fill="none"
                  stroke="#fff"
                  strokeWidth={88}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray={1}
                  strokeDashoffset={1}
                />
              </g>
            </mask>
          </defs>
          <path
            mask="url(#gl-brush)"
            className="gl-ink"
            fillRule="evenodd"
            d={BG_PATH}
          />
          <path
            ref={figRef}
            className="gl-ink"
            fillRule="evenodd"
            d={FIG_PATH}
          />
          <text
            ref={titleRef}
            className="gl-t"
            x={723}
            y={566}
            textAnchor="middle"
            fontSize={80}
            fontWeight={700}
            textLength={452}
            lengthAdjust="spacingAndGlyphs"
          >
            THE IMPOSTER
          </text>
          <text
            ref={subRef}
            className="gl-t"
            x={723}
            y={626}
            textAnchor="middle"
            fontSize={44}
            fontWeight={500}
            letterSpacing={3}
            textLength={340}
            lengthAdjust="spacing"
          >
            A SPY IN NEPAL
          </text>
        </svg>
      )}
    </div>
  );
}
