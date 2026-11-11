/**
 * Manos de Kinkel — una a cada lado del teclado.
 *
 * Cada mano se dibuja en vertical con los dedos hacia arriba y el pulgar
 * apuntando hacia el teclado. Los dedos conservan el color del canto de sus
 * teclas, la palma es amarilla estilo Simpson y todo el conjunto tiene un
 * acabado translúcido tipo vidrio. La mano derecha es el reflejo exacto de
 * la izquierda.
 */
import type { Finger } from "../../keyboard/layout";

interface HandsProps {
  /** Dedo con el que se escribe el próximo carácter (null en reposo). */
  nextFinger: Finger | null;
  /** Dedos con su tecla pulsada en este momento. */
  pressedFingers: ReadonlySet<Finger>;
}

type FingerSlot = "pinky" | "ring" | "middle" | "index";

interface FingerSpec {
  slot: FingerSlot;
  baseX: number;
  baseY: number;
  tipX: number;
  tipY: number;
  widthBase: number;
  widthTip: number;
}

/** Geometría de la mano izquierda; la derecha es este mismo dibujo reflejado. */
const FINGERS: FingerSpec[] = [
  { slot: "pinky", baseX: 16.5, baseY: 74, tipX: 12.5, tipY: 40, widthBase: 9.6, widthTip: 7.2 },
  { slot: "ring", baseX: 26.5, baseY: 75, tipX: 25, tipY: 28, widthBase: 10.2, widthTip: 7.8 },
  { slot: "middle", baseX: 36, baseY: 75.5, tipX: 36.5, tipY: 20.5, widthBase: 10.6, widthTip: 8.2 },
  { slot: "index", baseX: 45.5, baseY: 74, tipX: 48.5, tipY: 29, widthBase: 10.4, widthTip: 8 },
];

const FINGER_CLASS: Record<string, string> = {
  "pinky-l": "hf--pinky-l",
  "ring-l": "hf--ring-l",
  "middle-l": "hf--middle-l",
  "index-l": "hf--index-l",
  "index-r": "hf--index-r",
  "middle-r": "hf--middle-r",
  "ring-r": "hf--ring-r",
  "pinky-r": "hf--pinky-r",
  thumb: "hf--thumb",
};

/** Palma izquierda; la derecha se obtiene reflejándola sobre x = 35. */
const PALM_PATH =
  "M 14 72 C 11.5 80 12.4 91 16 100 C 18 105 22 109 27 111 " +
  "C 30 112.4 33.2 113 36 113 C 39 113 42.4 112.2 46 110.6 " +
  "C 51.6 108 55.8 102 58 95 C 60 88 60.6 79 60 72 " +
  "C 59.4 68.2 56 66 51 66 C 46 66 41 67 36 67 " +
  "C 31 67 26 66 21 66 C 16.2 66 14.4 68 14 72 Z";

const PALM_GLOSS =
  "M 20 69.5 C 27 67.8 36 67.4 44 68.2 C 50 68.8 54.5 70 57 72";

function fingerClass(
  finger: Finger,
  nextFinger: Finger | null,
  pressed: ReadonlySet<Finger>,
): string {
  const classes = ["hand-finger", FINGER_CLASS[finger]];
  if (nextFinger === finger) classes.push("hand-finger--next");
  if (pressed.has(finger)) classes.push("hand-finger--down");
  return classes.join(" ");
}

/** Dedo cónico con la punta redondeada, del nacimiento (base) a la yema. */
function fingerPath({ tipX, tipY, baseX, baseY, widthBase, widthTip }: FingerSpec): string {
  const hb = widthBase / 2;
  const ht = widthTip / 2;
  const side = tipY + ht;
  return [
    `M ${baseX - hb} ${baseY}`,
    `C ${baseX - hb} ${baseY - 11} ${tipX - ht} ${side + 13} ${tipX - ht} ${side}`,
    `A ${ht} ${ht} 0 0 1 ${tipX + ht} ${side}`,
    `C ${tipX + ht} ${side + 13} ${baseX + hb} ${baseY - 11} ${baseX + hb} ${baseY}`,
    "Z",
  ].join(" ");
}

/** Pulgar cónico en coordenadas locales: nace en (0,0) y apunta hacia -Y. */
function thumbPath(length: number, widthBase: number, widthTip: number): string {
  const hb = widthBase / 2;
  const ht = widthTip / 2;
  const side = -length + ht;
  return [
    `M ${-hb} 0`,
    `C ${-hb} ${-length * 0.34} ${-ht} ${side - 6} ${-ht} ${side}`,
    `A ${ht} ${ht} 0 0 1 ${ht} ${side}`,
    `C ${ht} ${side - 6} ${hb} ${-length * 0.34} ${hb} 0`,
    "Z",
  ].join(" ");
}

function Finger({ spec, side, nextFinger, pressedFingers }: {
  spec: FingerSpec;
  side: "left" | "right";
  nextFinger: Finger | null;
  pressedFingers: ReadonlySet<Finger>;
}) {
  const { slot, tipX, tipY, baseX, baseY, widthTip } = spec;
  const finger = `${slot}-${side === "left" ? "l" : "r"}` as Finger;
  const dx = tipX - baseX;
  const dy = tipY - baseY;
  const angle = (Math.atan2(dx, -dy) * 180) / Math.PI;
  const isNext = nextFinger === finger;

  return (
    <g className={fingerClass(finger, nextFinger, pressedFingers)}>
      <path className="hand-segment" d={fingerPath(spec)} />
      <ellipse
        className="hand-nail"
        cx={tipX + dx * 0.06}
        cy={tipY + 3.2}
        rx={widthTip * 0.26}
        ry={widthTip * 0.34}
        transform={`rotate(${angle} ${tipX + dx * 0.06} ${tipY + 3.2})`}
      />
      {isNext ? <circle className="hand-tip-halo" cx={tipX} cy={tipY + 1.5} r={widthTip * 0.85} /> : null}
    </g>
  );
}

function Thumb({ side, nextFinger, pressedFingers }: {
  side: "left" | "right";
  nextFinger: Finger | null;
  pressedFingers: ReadonlySet<Finger>;
}) {
  return (
    <g className={fingerClass("thumb", nextFinger, pressedFingers)}>
      <g transform="translate(50 88) rotate(58)">
        <path
          className="hand-segment hand-thumb-segment"
          d={thumbPath(19, 11.5, 8.4)}
          style={{ fill: `url(#handThumbFade-${side})` }}
        />
        <ellipse className="hand-nail" cx={0} cy={-15.6} rx={2.2} ry={2.8} />
      </g>
      {nextFinger === "thumb" ? (
        <circle className="hand-tip-halo" cx={66.1} cy={77.9} r={6.4} />
      ) : null}
    </g>
  );
}

function Hand({ side, nextFinger, pressedFingers }: {
  side: "left" | "right";
  nextFinger: Finger | null;
  pressedFingers: ReadonlySet<Finger>;
}) {
  return (
    <div className={`hands-side hands-side--${side}`} aria-hidden="true">
      <svg className="hands-svg" viewBox="0 0 70 120" role="presentation">
        <defs>
          <linearGradient id={`handThumbFade-${side}`} x1="0" y1="1" x2="0" y2="0">
            <stop offset="0" stopColor="#ffd90f" />
            <stop offset="0.55" stopColor="#e2cd86" />
            <stop offset="1" stopColor="#b6ab97" />
          </linearGradient>
        </defs>
        <g transform={side === "right" ? "translate(70 0) scale(-1 1)" : undefined}>
          {FINGERS.map((spec) => (
            <Finger
              key={spec.slot}
              spec={spec}
              side={side}
              nextFinger={nextFinger}
              pressedFingers={pressedFingers}
            />
          ))}
          <Thumb side={side} nextFinger={nextFinger} pressedFingers={pressedFingers} />
          <path className="hand-palm" d={PALM_PATH} />
          <path className="hand-gloss" d={PALM_GLOSS} />
        </g>
      </svg>
    </div>
  );
}

export function Hands({ nextFinger, pressedFingers }: HandsProps) {
  return (
    <>
      <Hand side="left" nextFinger={nextFinger} pressedFingers={pressedFingers} />
      <Hand side="right" nextFinger={nextFinger} pressedFingers={pressedFingers} />
    </>
  );
}
