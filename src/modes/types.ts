/**
 * Un modo es un "juego" completo dentro de Kinkel: tema visual y
 * comportamiento del tablero. El registro vive en registry.ts.
 */
export type ModeId = "kids" | "typing";

export interface ModeDef {
  id: ModeId;
  /** Etiqueta corta para el selector del topbar. */
  label: string;
  /** Frase identitaria que acompaña al logo. */
  tagline: string;
}
