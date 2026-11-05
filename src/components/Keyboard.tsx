import { KEY_ROWS } from "../keyboard/layout";
import { Key } from "./Key";

interface KeyboardProps {
  pressed: ReadonlySet<string>;
  shiftHeld: boolean;
  capsOn: boolean;
  pendingAccent: string | null;
}

export function Keyboard({ pressed, shiftHeld, capsOn, pendingAccent }: KeyboardProps) {
  return (
    <div className="keyboard-wrap">
      <div className="keyboard" role="img" aria-label="Teclado latinoamericano en pantalla">
        {KEY_ROWS.flat().map((def) => {
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
            />
          );
        })}
      </div>
    </div>
  );
}
