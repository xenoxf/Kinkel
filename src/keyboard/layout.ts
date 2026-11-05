/**
 * Definición del teclado físico LATAM (Español Latinoamérica).
 *
 * Las posiciones siguen los códigos físicos de `KeyboardEvent.code`
 * (independientes del idioma del sistema operativo) y las etiquetas
 * corresponden al layout LATAM real:
 *   1! 2" 3# 4$ 5% 6& 7/ 8( 9) 0= '? ¡¿
 *   QWERTYUIOP ´(¨) +
 *   ASDFGHJKLÑ Enter
 *   ZXCVBNM ,; .: -_
 *
 * `´` y `¨` son teclas muertas: se combinan con la vocal siguiente.
 *
 * Cada tecla tiene coordenadas en unidades (1u = una letra) para poder
 * dibujar el bloque principal del teclado LATAM.
 */
export type Finger =
  | "pinky-l"
  | "ring-l"
  | "middle-l"
  | "index-l"
  | "index-r"
  | "middle-r"
  | "ring-r"
  | "pinky-r"
  | "thumb"
  | "mod";

export type KeyKind =
  | "letter"
  | "punct"
  | "dead"
  | "space"
  | "enter"
  | "backspace"
  | "caps"
  | "shift"
  | "tab"
  | "mod";

export interface KeyDef {
  code: string;
  label: string;
  shiftLabel?: string;
  kind: KeyKind;
  finger: Finger;
  /** Ancho en unidades de tecla. */
  width: number;
  /** Fila (0 = números … 4 = barra espaciadora). */
  row: number;
  /** Columna en unidades de tecla. */
  col: number;
  /** Tecla guía de la fila base (muescas en F y J). */
  home?: boolean;
}

export const HOME_KEYS = new Set(["KeyF", "KeyJ"]);

/** Ancho total del dibujo: bloque principal de 15u. */
export const KEYBOARD_UNITS = 15;
export const KEYBOARD_COLS = Math.round(KEYBOARD_UNITS * 4);

export const ACCENTS: Record<string, { compose: Record<string, string> }> = {
  "´": {
    compose: {
      a: "á",
      e: "é",
      i: "í",
      o: "ó",
      u: "ú",
      A: "Á",
      E: "É",
      I: "Í",
      O: "Ó",
      U: "Ú",
    },
  },
  "¨": {
    compose: { u: "ü", U: "Ü" },
  },
};

type BaseKey = Omit<KeyDef, "row" | "col">;

function letter(code: string, label: string, finger: Finger): BaseKey {
  return { code, label, kind: "letter", finger, width: 1 };
}

function punct(
  code: string,
  label: string,
  shiftLabel: string,
  finger: Finger,
  width = 1,
): BaseKey {
  return { code, label, shiftLabel, kind: "punct", finger, width };
}

function special(
  kind: KeyKind,
  code: string,
  label: string,
  finger: Finger,
  width: number,
): BaseKey {
  return { code, label, kind, finger, width };
}

function withColumns(keys: BaseKey[], row: number): KeyDef[] {
  let col = 0;
  return keys.map((key) => {
    const placed: KeyDef = { ...key, row, col };
    col += key.width;
    return placed;
  });
}

const ROW_NUMBERS: BaseKey[] = [
  punct("Digit1", "1", "!", "pinky-l"),
  punct("Digit2", "2", '"', "ring-l"),
  punct("Digit3", "3", "#", "middle-l"),
  punct("Digit4", "4", "$", "index-l"),
  punct("Digit5", "5", "%", "index-l"),
  punct("Digit6", "6", "&", "index-r"),
  punct("Digit7", "7", "/", "index-r"),
  punct("Digit8", "8", "(", "middle-r"),
  punct("Digit9", "9", ")", "ring-r"),
  punct("Digit0", "0", "=", "pinky-r"),
  punct("Minus", "'", "?", "pinky-r"),
  punct("Equal", "¡", "¿", "pinky-r"),
  special("backspace", "Backspace", "Borrar", "pinky-r", 3),
];

const ROW_QWERTY: BaseKey[] = [
  special("tab", "Tab", "Tab", "pinky-l", 2.5),
  letter("KeyQ", "q", "pinky-l"),
  letter("KeyW", "w", "ring-l"),
  letter("KeyE", "e", "middle-l"),
  letter("KeyR", "r", "index-l"),
  letter("KeyT", "t", "index-l"),
  letter("KeyY", "y", "index-r"),
  letter("KeyU", "u", "index-r"),
  letter("KeyI", "i", "middle-r"),
  letter("KeyO", "o", "ring-r"),
  letter("KeyP", "p", "pinky-r"),
  {
    code: "BracketLeft",
    label: "´",
    shiftLabel: "¨",
    kind: "dead",
    finger: "pinky-r",
    width: 1,
  },
  punct("BracketRight", "+", "*", "pinky-r", 1.5),
];

const ROW_HOME: BaseKey[] = [
  special("caps", "CapsLock", "Mayús", "pinky-l", 1.75),
  letter("KeyA", "a", "pinky-l"),
  letter("KeyS", "s", "ring-l"),
  letter("KeyD", "d", "middle-l"),
  letter("KeyF", "f", "index-l"),
  letter("KeyG", "g", "index-l"),
  letter("KeyH", "h", "index-r"),
  letter("KeyJ", "j", "index-r"),
  letter("KeyK", "k", "middle-r"),
  letter("KeyL", "l", "ring-r"),
  letter("Semicolon", "ñ", "pinky-r"),
  special("enter", "Enter", "Enter", "pinky-r", 3.25),
];

const ROW_SHIFT: BaseKey[] = [
  special("shift", "ShiftLeft", "⇧", "pinky-l", 2.5),
  letter("KeyZ", "z", "pinky-l"),
  letter("KeyX", "x", "ring-l"),
  letter("KeyC", "c", "middle-l"),
  letter("KeyV", "v", "index-l"),
  letter("KeyB", "b", "index-l"),
  letter("KeyN", "n", "index-r"),
  letter("KeyM", "m", "index-r"),
  punct("Comma", ",", ";", "middle-r"),
  punct("Period", ".", ":", "ring-r"),
  punct("Slash", "-", "_", "pinky-r"),
  special("shift", "ShiftRight", "⇧", "pinky-r", 2.5),
];

const ROW_SPACE: BaseKey[] = [
  special("mod", "ControlLeft", "Ctrl", "mod", 1.5),
  special("mod", "AltLeft", "Alt", "mod", 1.5),
  special("space", "Space", "Espacio", "thumb", 9),
  special("mod", "AltRight", "AltGr", "mod", 1.5),
  special("mod", "ControlRight", "Ctrl", "mod", 1.5),
];

/**
 * Bloque principal del teclado LATAM (55 teclas).
 */
export const KEYBOARD_KEYS: KeyDef[] = [
  ...withColumns(ROW_NUMBERS, 0),
  ...withColumns(ROW_QWERTY, 1),
  ...withColumns(ROW_HOME, 2),
  ...withColumns(ROW_SHIFT, 3),
  ...withColumns(ROW_SPACE, 4),
];

export const KEY_BY_CODE: Record<string, KeyDef> = Object.fromEntries(
  KEYBOARD_KEYS.map((key) => [key.code, key]),
);

/** Carácter que produce una tecla según Shift / Bloq Mayús. */
export function resolveChar(
  def: KeyDef,
  shift: boolean,
  caps: boolean,
): string | null {
  switch (def.kind) {
    case "letter":
      return shift !== caps ? def.label.toUpperCase() : def.label;
    case "punct":
      return shift ? (def.shiftLabel ?? def.label) : def.label;
    case "space":
      return " ";
    default:
      return null;
  }
}
