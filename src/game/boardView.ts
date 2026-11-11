import type { Finger, KeyDef, KeyKind } from "../keyboard/layout";
import { KEY_BY_CODE } from "../keyboard/layout";
import type { BoardCell } from "./board";
import { CELL_W } from "./metrics";

/**
 * Geometría de las mini teclas de la pizarra.
 *
 * Las etiquetas largas (Enter, Borrar, ImprPant…) necesitan más ancho para
 * conservar un tamaño de letra legible. Cada tecla ocupa entre 1u y 2.75u,
 * donde 1u es el ancho de una letra, y el resto de la línea se reparte entre
 * esos anchos variables para que la pizarra no parezca una cuadrícula plana.
 */

export const BOARD_KEY_MIN_UNITS = 1;
export const BOARD_KEY_MAX_UNITS = 2.75;

/** Separación entre mini teclas (la casilla es más ancha que la tecla). */
export const BOARD_KEY_GAP = 3;

const UTILITY_KINDS: ReadonlySet<KeyKind> = new Set([
  "enter",
  "backspace",
  "caps",
  "shift",
  "tab",
  "mod",
]);

export interface BoardKeyView {
  label: string;
  kind: KeyKind | undefined;
  finger: Finger;
  isSpace: boolean;
  isUtility: boolean;
  /** Ancho de la casilla en unidades de letra. */
  units: number;
  /** Ancho de la casilla en píxeles. */
  width: number;
  /** Tamaño de letra que mantiene legible la etiqueta. */
  fontSize: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function labelLength(label: string): number {
  return Math.max(1, Array.from(label).length);
}

/**
 * Ancho en unidades: parte del ancho físico de la tecla, pero nunca queda por
 * debajo de lo que pide su etiqueta y se acota para no romper el ritmo.
 */
function widthUnits(def: KeyDef | undefined, label: string): number {
  const chars = labelLength(label);
  const byLabel = 1 + (chars - 1) * 0.24;
  const physical = Math.min(def?.width ?? 1, BOARD_KEY_MAX_UNITS);
  return clamp(
    Math.max(byLabel, physical),
    BOARD_KEY_MIN_UNITS,
    BOARD_KEY_MAX_UNITS,
  );
}

/** Calcula una letra grande y legible en lugar de encogerla hasta desaparecer. */
function fontFor(width: number, label: string): number {
  const inner = width - BOARD_KEY_GAP - 6;
  const fit = inner / (labelLength(label) * 0.64);
  return clamp(fit, 11, 17);
}

export function boardKeyView(cell: BoardCell): BoardKeyView {
  const def = cell.code ? KEY_BY_CODE[cell.code] : undefined;
  const kind = cell.kind ?? def?.kind;
  const finger = cell.finger ?? def?.finger ?? "mod";
  const isSpace = kind === "space" || cell.char === " ";
  const isUtility =
    (kind !== undefined && UTILITY_KINDS.has(kind)) ||
    (!def && cell.char.length > 1);
  const label = isSpace
    ? "espacio"
    : isUtility && def
      ? def.label
      : cell.char;

  const units = widthUnits(def, label);
  const width = units * CELL_W;

  return {
    label,
    kind,
    finger,
    isSpace,
    isUtility,
    units,
    width,
    fontSize: fontFor(width, label),
  };
}

/** Ancho de una celda en unidades de letra (para el caret y los saltos). */
export function boardCellUnits(cell: BoardCell): number {
  return boardKeyView(cell).units;
}

/** Ancho total de una línea en unidades de letra. */
export function boardCellsUnits(cells: readonly BoardCell[]): number {
  return cells.reduce((units, cell) => units + boardCellUnits(cell), 0);
}
