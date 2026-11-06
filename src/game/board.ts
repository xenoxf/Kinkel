import type { Finger, KeyKind } from "../keyboard/layout";

/**
 * Cada carácter que llega a la pizarra conserva de qué tecla salió.
 * Así la pizarra puede dibujar una tecla completa (con su color de dedo)
 * en lugar de una letra suelta, incluso después de recargar la app.
 */
export interface BoardCell {
  char: string;
  /** Código físico de la tecla que lo produjo ("" en datos antiguos). */
  code: string;
  shift: boolean;
  caps: boolean;
  /** Tipo y color de tecla (también para teclas sintéticas). */
  kind?: KeyKind;
  finger?: Finger;
}

export function cellFromText(char: string): BoardCell {
  return { char, code: "", shift: false, caps: false };
}

const KEY_KINDS: ReadonlySet<string> = new Set([
  "letter",
  "punct",
  "dead",
  "space",
  "enter",
  "backspace",
  "caps",
  "shift",
  "tab",
  "mod",
]);

const FINGERS: ReadonlySet<string> = new Set([
  "pinky-l",
  "ring-l",
  "middle-l",
  "index-l",
  "index-r",
  "middle-r",
  "ring-r",
  "pinky-r",
  "thumb",
  "mod",
]);

export function isBoardCell(value: unknown): value is BoardCell {
  if (typeof value !== "object" || value === null) return false;
  const cell = value as Record<string, unknown>;
  const kindOk = cell.kind === undefined || KEY_KINDS.has(cell.kind as string);
  const fingerOk =
    cell.finger === undefined || FINGERS.has(cell.finger as string);
  return (
    typeof cell.char === "string" &&
    typeof cell.code === "string" &&
    typeof cell.shift === "boolean" &&
    typeof cell.caps === "boolean" &&
    kindOk &&
    fingerOk
  );
}
