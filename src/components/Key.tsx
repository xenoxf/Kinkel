import type { CSSProperties } from "react";
import { HOME_KEYS, type KeyDef } from "../keyboard/layout";

interface KeyProps {
  def: KeyDef;
  pressed: boolean;
  shiftHeld: boolean;
  capsOn: boolean;
  accentPending: boolean;
  style?: CSSProperties;
}

const UTILITY_KINDS = new Set([
  "enter",
  "backspace",
  "caps",
  "shift",
  "tab",
  "mod",
  "space",
]);

export function Key({
  def,
  pressed,
  shiftHeld,
  capsOn,
  accentPending,
  style,
}: KeyProps) {
  const isLetter = def.kind === "letter";
  const upper = isLetter && shiftHeld !== capsOn;
  const useShiftGlyph = def.kind === "punct" && shiftHeld && def.shiftLabel !== undefined;

  const mainLabel = upper ? def.label.toUpperCase() : def.label;
  const shownLabel = useShiftGlyph ? (def.shiftLabel as string) : mainLabel;
  const subLabel =
    def.kind === "punct" && def.shiftLabel && !useShiftGlyph ? def.shiftLabel : null;

  const classes = [
    "key",
    `key--${def.finger}`,
    `key--${def.kind}`,
    UTILITY_KINDS.has(def.kind) ? "key--util" : "",
    pressed ? "key--pressed" : "",
    accentPending ? "key--pending" : "",
    HOME_KEYS.has(def.code) ? "key--home" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={classes}
      data-key={def.code}
      style={style}
      aria-label={def.label}
    >
      {subLabel ? <span className="key-sub">{subLabel}</span> : null}
      <span className="key-label">{shownLabel}</span>
      {HOME_KEYS.has(def.code) ? <span className="key-bump" aria-hidden="true" /> : null}
    </div>
  );
}
