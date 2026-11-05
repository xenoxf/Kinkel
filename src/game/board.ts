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
}

export function cellFromText(char: string): BoardCell {
  return { char, code: "", shift: false, caps: false };
}

export function isBoardCell(value: unknown): value is BoardCell {
  if (typeof value !== "object" || value === null) return false;
  const cell = value as Record<string, unknown>;
  return (
    typeof cell.char === "string" &&
    typeof cell.code === "string" &&
    typeof cell.shift === "boolean" &&
    typeof cell.caps === "boolean"
  );
}
