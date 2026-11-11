/**
 * Inverso del layout: dado un carácter del texto objetivo, devuelve qué
 * tecla física lo produce y con qué dedo se pulsa. Lo usan las manos
 * animadas y el realce de la próxima tecla.
 */
import type { Finger, KeyDef } from "../../keyboard/layout";
import { KEYBOARD_KEYS, KEY_BY_CODE, resolveChar } from "../../keyboard/layout";

export interface KeyForChar {
  code: string;
  finger: Finger;
}

const CHAR_TO_KEY: Map<string, KeyForChar> = buildCharToKey();

function buildCharToKey(): Map<string, KeyForChar> {
  const map = new Map<string, KeyForChar>();
  const put = (char: string, def: KeyDef) => {
    if (!map.has(char)) map.set(char, { code: def.code, finger: def.finger });
  };

  for (const key of KEYBOARD_KEYS) {
    if (key.kind === "space") {
      put(" ", key);
      continue;
    }
    if (key.kind === "letter") {
      put(key.label, key);
      put(key.label.toUpperCase(), key);
      continue;
    }
    if (key.kind === "punct") {
      const normal = resolveChar(key, false, false);
      const shifted = resolveChar(key, true, false);
      if (normal) put(normal, key);
      if (shifted) put(shifted, key);
    }
  }

  // Vocales acentuadas y ü se escriben con la tecla de la vocal base.
  const baseFor: Record<string, string> = {
    á: "KeyA", é: "KeyE", í: "KeyI", ó: "KeyO", ú: "KeyU", ü: "KeyU",
    Á: "KeyA", É: "KeyE", Í: "KeyI", Ó: "KeyO", Ú: "KeyU", Ü: "KeyU",
  };
  for (const [char, code] of Object.entries(baseFor)) {
    const def = KEY_BY_CODE[code];
    if (def) map.set(char, { code: def.code, finger: def.finger });
  }

  return map;
}

export function keyForChar(char: string): KeyForChar | null {
  return CHAR_TO_KEY.get(char) ?? null;
}
