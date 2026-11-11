import type { ReactNode } from "react";
import { KEYBOARD_KEYS } from "../keyboard/layout";
import { Key } from "./Key";

interface KeyboardProps {
  pressed: ReadonlySet<string>;
  shiftHeld: boolean;
  capsOn: boolean;
  pendingAccent: string | null;
  /** Código de la tecla que escribe el próximo carácter (modo mecanografía). */
  nextKey?: string | null;
  /** Capa decorativa encima del teclado (manos del modo mecanografía). */
  overlay?: ReactNode;
}

export function Keyboard({ pressed, shiftHeld, capsOn, pendingAccent, nextKey, overlay }: KeyboardProps) {
  return (
    <div className="keyboard-wrap">
      <div className="keyboard" role="img" aria-label="Teclado latinoamericano en pantalla">
        {KEYBOARD_KEYS.map((def) => {
          const accentPending =
            def.kind === "dead" &&
            pendingAccent !== null &&
            (def.label === pendingAccent || def.shiftLabel === pendingAccent);

          return (
            <Key
              key={def.code}
              def={def}
              pressed={pressed.has(def.code)}
              shiftHeld={shiftHeld}
              capsOn={capsOn}
              accentPending={accentPending}
              next={nextKey === def.code}
              style={{
                gridColumn: `${def.col * 4 + 1} / span ${Math.round(def.width * 4)}`,
                gridRow: def.row + 1,
              }}
            />
          );
        })}
      </div>
      {overlay}
    </div>
  );
}
