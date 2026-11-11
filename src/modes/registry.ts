import type { ModeDef, ModeId } from "./types";

const STORAGE_MODE = "kinkel:mode-v1";

export const MODES: readonly ModeDef[] = [
  {
    id: "kids",
    label: "Niños 5–7",
    tagline: "¡Escribe y mira volar tus letras!",
  },
  {
    id: "typing",
    label: "Mecanografía",
    tagline: "Aprende a escribir con todos los dedos",
  },
];

export const DEFAULT_MODE: ModeId = "kids";

export function isModeId(value: unknown): value is ModeId {
  return MODES.some((mode) => mode.id === value);
}

export function loadMode(): ModeId {
  try {
    const raw = localStorage.getItem(STORAGE_MODE);
    return isModeId(raw) ? raw : DEFAULT_MODE;
  } catch {
    return DEFAULT_MODE;
  }
}

export function saveMode(mode: ModeId): void {
  try {
    localStorage.setItem(STORAGE_MODE, mode);
  } catch {
    /* sin almacenamiento: se ignora */
  }
}

export function modeTagline(mode: ModeId): string {
  return MODES.find((entry) => entry.id === mode)?.tagline ?? "";
}
