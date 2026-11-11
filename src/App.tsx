import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { motion } from "framer-motion";
import * as sounds from "./audio/sounds";
import { DownloadModal } from "./components/DownloadModal";
import { Key } from "./components/Key";
import { Keyboard } from "./components/Keyboard";
import { TextStage } from "./components/TextStage";
import {
  DownloadIcon,
  SpeakerIcon,
  SpeakerOffIcon,
  TrashIcon,
} from "./components/Icons";
import { cellFromText, isBoardCell, type BoardCell } from "./game/board";
import {
  BOARD_KEY_GAP,
  boardCellUnits,
  boardCellsUnits,
} from "./game/boardView";
import { CELL_W } from "./game/metrics";
import {
  ACCENTS,
  KEY_BY_CODE,
  keyDefForEvent,
  resolveChar,
  type KeyDef,
  type Finger,
} from "./keyboard/layout";
import {
  BookIcon,
  EyeIcon,
  EyeOffIcon,
  KeyboardIcon,
  PenguinIcon,
} from "./components/Icons";
import { loadMode, modeTagline, saveMode, MODES } from "./modes/registry";
import type { ModeId } from "./modes/types";
import { Hands } from "./modes/typing/Hands";
import { TypingStage } from "./modes/typing/TypingStage";
import { TextMenu } from "./modes/typing/TextMenu";
import { TEXT_BY_ID, TYPING_TEXTS } from "./modes/typing/content";
import { keyForChar } from "./modes/typing/keysFor";
import {
  computeAccuracy,
  computePpm,
  loadTypingProgress,
  recordKeyError,
  recordLessonResult,
  saveTypingProgress,
  starsFor,
  type LessonResult,
  type TypingProgress,
} from "./modes/typing/stats";

const STORAGE_TEXT = "kinkel:board-v2";
const STORAGE_TEXT_LEGACY = "kinkel:text-v1";
const STORAGE_MUTED = "kinkel:muted-v1";
const STORAGE_HANDS = "kinkel:hands-v1";
const FLIGHT_SECONDS = 0.52;

const PREVENT_DEFAULT_CODES = new Set([
  "Tab",
  "Space",
  "Enter",
  "NumpadEnter",
  "Backspace",
  "CapsLock",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "Home",
  "End",
  "PageUp",
  "PageDown",
  "Insert",
  "Delete",
]);

function shouldPreventDefault(event: KeyboardEvent): boolean {
  if (PREVENT_DEFAULT_CODES.has(event.code)) return true;
  return (
    /^F\d{1,2}$/.test(event.code) &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.altKey
  );
}

interface Flight {
  id: number;
  /** La tecla completa que viaja y luego se queda en la pizarra. */
  def: KeyDef;
  cell: BoardCell;
  /** Tamaño real de la tecla en pantalla. */
  width: number;
  height: number;
  /** Escala final para aterrizar del tamaño de la mini tecla. */
  endScale: number;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  /** Línea del texto donde aterrizará la tecla. */
  line: number;
  /** Tecla que no está en el dibujo: aparece desde los alrededores. */
  remote: boolean;
  /** Índice de carácter destino en el modo mecanografía. */
  typingIndex?: number;
}

interface SpawnRequest {
  def: KeyDef;
  cell: BoardCell;
  remote?: boolean;
  /** Línea destino (Enter puede aterrizar en la línea anterior). */
  line?: number;
  typingIndex?: number;
}

function cellFromKey(
  def: KeyDef,
  char: string,
  shift: boolean,
  caps: boolean,
): BoardCell {
  return {
    char,
    code: def.code,
    shift,
    caps,
    kind: def.kind,
    finger: def.finger,
  };
}

function hashText(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Punto de aparición para teclas que no existen en el teclado de la app.
 * Se elige un lado del teclado de forma estable según el código de la tecla,
 * para que Ctrl siempre entre por el mismo lado y no baile entre pulsaciones.
 */
function spawnAroundKeyboard(
  def: KeyDef,
  width: number,
  height: number,
): { x: number; y: number } {
  const wrap = document.querySelector<HTMLElement>(".keyboard-wrap");
  const rect = wrap?.getBoundingClientRect();
  const viewportW = window.innerWidth;
  const viewportH = window.innerHeight;

  if (!rect) {
    return {
      x: (viewportW - width) / 2,
      y: viewportH - height - 24,
    };
  }

  const hash = hashText(def.code);
  const side = hash % 4;
  const fraction = ((hash >>> 4) % 1000) / 1000;
  const minX = -width * 0.35;
  const maxX = viewportW - width * 0.65;
  const minY = 8;
  const maxY = viewportH - height - 8;

  let x = rect.left + (rect.width - width) / 2;
  let y = rect.top + (rect.height - height) / 2;

  switch (side) {
    case 0:
      x = rect.left - width * 0.55;
      y = rect.top + fraction * Math.max(0, rect.height - height);
      break;
    case 1:
      x = rect.right - width * 0.45;
      y = rect.top + fraction * Math.max(0, rect.height - height);
      break;
    case 2:
      x = rect.left + fraction * Math.max(0, rect.width - width);
      y = rect.top - height * 0.65;
      break;
    default:
      x = rect.left + fraction * Math.max(0, rect.width - width);
      y = rect.bottom - height * 0.35;
      break;
  }

  return { x: clamp(x, minX, maxX), y: clamp(y, minY, maxY) };
}

function loadLines(): BoardCell[][] {
  try {
    const raw = localStorage.getItem(STORAGE_TEXT);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (
        Array.isArray(parsed) &&
        parsed.length > 0 &&
        parsed.every(
          (line) => Array.isArray(line) && line.every(isBoardCell),
        )
      ) {
        return (parsed as BoardCell[][]).slice(-80);
      }
    }

    // Migración desde la versión que guardaba solo texto.
    const legacyRaw = localStorage.getItem(STORAGE_TEXT_LEGACY);
    if (legacyRaw) {
      const parsed: unknown = JSON.parse(legacyRaw);
      if (
        Array.isArray(parsed) &&
        parsed.length > 0 &&
        parsed.every((line) => typeof line === "string")
      ) {
        return (parsed as string[])
          .map((line) => Array.from(line).map(cellFromText))
          .slice(-80);
      }
    }
  } catch {
    /* datos corruptos: se empieza de cero */
  }
  return [[]];
}

function loadMuted(): boolean {
  try {
    return localStorage.getItem(STORAGE_MUTED) === "1";
  } catch {
    return false;
  }
}

function loadHandsHidden(): boolean {
  try {
    return localStorage.getItem(STORAGE_HANDS) === "1";
  } catch {
    return false;
  }
}

/**
 * Al escribir no importan ni las mayúsculas ni las tildes: `h` vale por `H`
 * e `i` vale por `í`. La ñ sí cuenta como letra aparte del alfabeto.
 */
const ENYE_SLOT = "\u0000";

function typingFold(text: string): string {
  return text
    .toLocaleLowerCase("es")
    .replace(/\u00f1/g, ENYE_SLOT) // la ñ no se descompone: es una letra distinta
    .normalize("NFD")
    .replace(/\p{M}+/gu, "") // quita tildes y diéresis (á→a, ü→u, …)
    .replace(new RegExp(ENYE_SLOT, "g"), "\u00f1");
}

function sameTypedChar(a: string, b: string): boolean {
  return typingFold(a) === typingFold(b);
}

/** Sesión de escritura para el modo mecanografía (solo en memoria). */
interface TypingSession {
  /** Índice del próximo carácter del texto objetivo. */
  cursor: number;
  errors: number;
  /** Cambia con cada error para re-animar la sacudida. */
  shake: number;
  startedAt: number | null;
  result: LessonResult | null;
}

function freshTypingSession(): TypingSession {
  return { cursor: 0, errors: 0, shake: 0, startedAt: null, result: null };
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => {
    try {
      return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(media.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  return reduced;
}

export default function App() {
  const reducedMotion = usePrefersReducedMotion();

  const [lines, setLines] = useState<BoardCell[][]>(loadLines);
  const [flights, setFlights] = useState<Flight[]>([]);
  const [spawnQueue, setSpawnQueue] = useState<SpawnRequest[]>([]);
  const [pressed, setPressed] = useState<ReadonlySet<string>>(() => new Set());
  const [shiftHeld, setShiftHeld] = useState(false);
  const [capsOn, setCapsOn] = useState(false);
  const [pendingAccent, setPendingAccent] = useState<string | null>(null);
  // Espejo síncrono: varias teclas muertas/letras pueden procesarse en el
  // mismo tick y deben ver el acento pendiente más reciente.
  const pendingAccentRef = useRef<string | null>(null);
  const updatePendingAccent = (value: string | null) => {
    pendingAccentRef.current = value;
    setPendingAccent(value);
  };
  const [muted, setMuted] = useState(loadMuted);
  const [flashLine, setFlashLine] = useState<number | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [mode, setMode] = useState<ModeId>(loadMode);
  const [typingProgress, setTypingProgress] =
    useState<TypingProgress>(loadTypingProgress);
  const [textId, setTextId] = useState<string>(() => {
    const saved = loadTypingProgress().lastLessonId;
    return saved && TEXT_BY_ID.has(saved) ? saved : TYPING_TEXTS[0].id;
  });
  const [textPickerOpen, setTextPickerOpen] = useState(false);
  const [handsHidden, setHandsHidden] = useState(loadHandsHidden);
  const [typingSession, setTypingSession] =
    useState<TypingSession>(freshTypingSession);
  // Espejo síncrono de la sesión: la rama de mecanografía debe leer siempre
  // el estado más reciente aunque varios keydowns caigan en el mismo tick.
  const typingSessionRef = useRef(typingSession);
  const [maxLineUnits, setMaxLineUnits] = useState(() =>
    Math.max(10, Math.floor((window.innerWidth - 320) / CELL_W)),
  );

  const stageHolderRef = useRef<HTMLDivElement>(null);
  const flightSeq = useRef(0);
  const maxLineUnitsRef = useRef(maxLineUnits);
  const keyDownRef = useRef<(event: KeyboardEvent) => void>(() => { });
  const isWeb = !isTauri();
  const closeDownload = useCallback(() => setDownloadOpen(false), []);

  // El modo vive también en <html> para que el fondo de la página siga el tema.
  useEffect(() => {
    document.documentElement.dataset.mode = mode;
    return () => {
      delete document.documentElement.dataset.mode;
    };
  }, [mode]);

  const typingText = TEXT_BY_ID.get(textId) ?? TYPING_TEXTS[0];
  const targetChars = useMemo(
    () => Array.from(typingText.contenido),
    [typingText],
  );

  const switchMode = (next: ModeId) => {
    if (next === mode) return;
    setMode(next);
    saveMode(next);
    updatePendingAccent(null);
  };

  const persistLastLesson = useCallback((id: string) => {
    setTypingProgress((prev) => {
      if (prev.lastLessonId === id) return prev;
      const next = { ...prev, lastLessonId: id };
      saveTypingProgress(next);
      return next;
    });
  }, []);

  const resetTyping = (id?: string) => {
    const target = id ?? textId;
    const fresh = freshTypingSession();
    setTextId(target);
    setTypingSession(fresh);
    typingSessionRef.current = fresh;
    updatePendingAccent(null);
    persistLastLesson(target);
  };

  const nextText = (() => {
    const index = TYPING_TEXTS.findIndex((entry) => entry.id === textId);
    if (index < 0 || index >= TYPING_TEXTS.length - 1) return null;
    const next = TYPING_TEXTS[index + 1];
    return () => resetTyping(next.id);
  })();

  const toggleHands = () => {
    setHandsHidden((hidden) => {
      const next = !hidden;
      try {
        localStorage.setItem(STORAGE_HANDS, next ? "1" : "0");
      } catch {
        /* sin almacenamiento: se ignora */
      }
      return next;
    });
  };

  useEffect(() => {
    maxLineUnitsRef.current = maxLineUnits;
  }, [maxLineUnits]);

  // Ancho disponible para el texto → cuántas unidades de letra caben por línea.
  useEffect(() => {
    const holder = stageHolderRef.current;
    if (!holder) return;

    const recompute = () => {
      const sample = holder.querySelector<HTMLElement>(".line-text");
      const width = sample?.clientWidth ?? 0;
      if (width > 60) {
        setMaxLineUnits(Math.max(10, Math.floor(width / CELL_W)));
      }
    };

    recompute();
    const observer = new ResizeObserver(recompute);
    observer.observe(holder);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    sounds.setMuted(muted);
    try {
      localStorage.setItem(STORAGE_MUTED, muted ? "1" : "0");
    } catch {
      /* sin almacenamiento: se ignora */
    }
  }, [muted]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_TEXT, JSON.stringify(lines.slice(-80)));
      localStorage.removeItem(STORAGE_TEXT_LEGACY);
    } catch {
      /* sin almacenamiento: se ignora */
    }
  }, [lines]);

  useEffect(() => {
    if (flashLine === null) return;
    const timer = window.setTimeout(() => setFlashLine(null), 900);
    return () => window.clearTimeout(timer);
  }, [flashLine]);

  /**
   * Procesa una tecla por vez: mide la tecla completa (o el punto de
   * aparición si no existe en el dibujo) y su casilla destino, y lanza
   * la tecla voladora. Si la línea está llena, primero crea una línea
   * nueva y se volverá a procesar en el siguiente render.
   */
  useEffect(() => {
    if (spawnQueue.length === 0) return;

    const request = spawnQueue[0];

    // Modo mecanografía: la tecla vuela hasta el hueco del carácter actual.
    if (request.typingIndex !== undefined) {
      const keyEl =
        document.querySelector<HTMLElement>(
          `.keyboard [data-key="${request.cell.code}"]`,
        );
      const slotEl = document.querySelector<HTMLElement>(
        `.typing-text [data-idx="${request.typingIndex}"]`,
      );

      if (keyEl && slotEl) {
        const keyRect = keyEl.getBoundingClientRect();
        const slotRect = slotEl.getBoundingClientRect();
        const width = Math.min(keyRect.width, keyRect.height * 2.8);
        const height = keyRect.height;

        const flight: Flight = {
          id: ++flightSeq.current,
          def: request.def,
          cell: request.cell,
          width,
          height,
          endScale: clamp((slotRect.width + 2) / width, 0.16, 0.5),
          fromX: keyRect.left + keyRect.width / 2 - width / 2,
          fromY: keyRect.top,
          toX: slotRect.left + slotRect.width / 2 - width / 2,
          toY: slotRect.top + slotRect.height / 2 - height / 2,
          line: -1,
          remote: false,
          typingIndex: request.typingIndex,
        };

        setFlights((prev) => [...prev, flight]);
      }

      setSpawnQueue((queue) => queue.slice(1));
      return;
    }

    const knownDef = KEY_BY_CODE[request.cell.code];
    const keyEl =
      request.remote || !knownDef
        ? null
        : document.querySelector<HTMLElement>(
          `.keyboard [data-key="${knownDef.code}"]`,
        );

    const lastIndex = lines.length - 1;
    let targetLine = Math.min(request.line ?? lastIndex, lastIndex);
    if (targetLine < 0) targetLine = 0;

    const pendingUnitsOn = (line: number) =>
      flights.reduce(
        (units, flight) =>
          units + (flight.line === line ? boardCellUnits(flight.cell) : 0),
        0,
      );

    const cellUnits = boardCellUnits(request.cell);
    let plannedUnits =
      boardCellsUnits(lines[targetLine]) + pendingUnitsOn(targetLine);

    if (plannedUnits + cellUnits > maxLineUnitsRef.current) {
      if (targetLine === lines.length - 1) {
        setLines((prev) => [...prev, []]);
        return;
      }

      // La línea de Enter ya se cerró y estaba llena: cae en la nueva.
      targetLine = lines.length - 1;
      plannedUnits =
        boardCellsUnits(lines[targetLine]) + pendingUnitsOn(targetLine);
      if (plannedUnits + cellUnits > maxLineUnitsRef.current) {
        setLines((prev) => [...prev, []]);
        return;
      }
    }

    const lineEl = document.querySelector<HTMLElement>(
      `.line-text[data-line="${targetLine}"]`,
    );
    if (!lineEl) return;

    const lineRect = lineEl.getBoundingClientRect();
    const remote = keyEl === null;
    let width = 0;
    let height = 0;
    let fromX = 0;
    let fromY = 0;

    if (keyEl) {
      const keyRect = keyEl.getBoundingClientRect();

      // La barra espaciadora mide 9u: se limita el ancho para que la tecla
      // voladora no sea gigante, pero conserva el aspecto de una tecla.
      width = Math.min(keyRect.width, keyRect.height * 2.8);
      height = keyRect.height;
      fromX = keyRect.left + keyRect.width / 2 - width / 2;
      fromY = keyRect.top;
    } else {
      const sampleKey = document.querySelector<HTMLElement>(".keyboard .key");
      const sampleRect = sampleKey?.getBoundingClientRect();
      height = sampleRect?.height ?? 44;

      const labelLength = Math.max(1, Array.from(request.def.label).length);
      width = Math.max(
        height * 1.1,
        Math.min(
          height * 2.6,
          labelLength * height * 0.42 + height * 0.25,
        ),
      );

      const origin = spawnAroundKeyboard(request.def, width, height);
      fromX = origin.x;
      fromY = origin.y;
    }

    const cellWidth = cellUnits * CELL_W;
    const cellCenterX =
      lineRect.left + plannedUnits * CELL_W + cellWidth / 2;
    const cellCenterY = lineRect.top + lineRect.height / 2;
    const targetWidth = Math.max(CELL_W * 0.6, cellWidth - BOARD_KEY_GAP);
    const endScale = clamp(targetWidth / width, 0.22, 0.9);

    const flight: Flight = {
      id: ++flightSeq.current,
      def: request.def,
      cell: request.cell,
      width,
      height,
      endScale,
      fromX,
      fromY,
      toX: cellCenterX - width / 2,
      toY: cellCenterY - height / 2,
      line: targetLine,
      remote,
    };

    setFlights((prev) => [...prev, flight]);
    setSpawnQueue((queue) => queue.slice(1));
  }, [spawnQueue, lines, flights]);

  const expectedChar = typingSession.result
    ? undefined
    : targetChars[typingSession.cursor];
  const nextFinger = expectedChar
    ? (keyForChar(expectedChar)?.finger ?? null)
    : null;
  const pressedFingers = useMemo(() => {
    const set = new Set<Finger>();
    for (const code of pressed) {
      const def = KEY_BY_CODE[code];
      if (def) set.add(def.finger);
    }
    return set;
  }, [pressed]);

  const caret = useMemo(() => {
    const last = lines.length - 1;
    const pendingUnits = flights.reduce(
      (units, flight) =>
        units + (flight.line === last ? boardCellUnits(flight.cell) : 0),
      0,
    );
    return {
      line: last,
      offset: (boardCellsUnits(lines[last]) + pendingUnits) * CELL_W,
    };
  }, [lines, flights]);

  const landFlight = (flight: Flight) => {
    setFlights((prev) => prev.filter((item) => item.id !== flight.id));
    if (flight.typingIndex !== undefined) return; // el carácter ya avanzó
    setLines((prev) => {
      const next = [...prev];
      while (next.length <= flight.line) next.push([]);
      next[flight.line] = [...next[flight.line], flight.cell];
      return next;
    });
  };

  const typeDirect = (cell: BoardCell, line?: number) => {
    setLines((prev) => {
      const next = [...prev];
      let index =
        line !== undefined && line >= 0 && line < next.length
          ? line
          : next.length - 1;

      if (
        boardCellsUnits(next[index]) + boardCellUnits(cell) >
        maxLineUnitsRef.current
      ) {
        if (index === next.length - 1) {
          next.push([]);
          index = next.length - 1;
        } else {
          index = next.length - 1;
          if (
            boardCellsUnits(next[index]) + boardCellUnits(cell) >
            maxLineUnitsRef.current
          ) {
            next.push([]);
            index = next.length - 1;
          }
        }
      }

      next[index] = [...next[index], cell];
      return next;
    });
  };

  const commitCell = (
    def: KeyDef,
    cell: BoardCell,
    options?: { line?: number; remote?: boolean },
  ) => {
    if (reducedMotion) {
      typeDirect(cell, options?.line);
      return;
    }

    setSpawnQueue((queue) => [
      ...queue,
      { def, cell, remote: options?.remote, line: options?.line },
    ]);
  };

  /**
   * Rama del modo mecanografía: la tecla correcta avanza el cursor (y su
   * tecla vuela al hueco del carácter); la incorrecta sacude y cuenta.
   * Las teclas muertas se componen igual que en el modo libre.
   */
  const handleTypingKey = (def: KeyDef, event: KeyboardEvent) => {
    const shift = event.shiftKey;
    const caps = event.getModifierState("CapsLock");

    if (def.kind === "backspace") {
      updatePendingAccent(null);
      const session = typingSessionRef.current;
      if (session.result || session.cursor === 0) return;
      const next = { ...session, cursor: session.cursor - 1 };
      typingSessionRef.current = next;
      setTypingSession(next);
      return;
    }

    if (def.kind === "dead") {
      const accent = shift ? (def.shiftLabel ?? def.label) : def.label;
      updatePendingAccent(accent);
      return;
    }

    const session = typingSessionRef.current;
    if (session.result) return; // lección terminada

    let produced: string | null = null;
    if (def.kind === "space") produced = " ";
    else if (def.kind === "letter" || def.kind === "punct") {
      produced = resolveChar(def, shift, caps);
    }
    if (!produced) return; // modificadores y teclas sin carácter

    const accentPending = pendingAccentRef.current;
    if (accentPending) {
      const composed = ACCENTS[accentPending]?.compose[produced];
      updatePendingAccent(null);
      if (composed) produced = composed;
    }

    if (targetChars.length === 0) return;
    const targetIndex = session.cursor;
    const expected = targetChars[targetIndex];

    if (sameTypedChar(produced, expected)) {
      const startedAt = session.startedAt ?? Date.now();
      const cursor = targetIndex + 1;
      const done = cursor >= targetChars.length;
      let result: LessonResult | null = null;

      if (done) {
        const ppm = computePpm(targetChars.length, Date.now() - startedAt);
        const accuracy = computeAccuracy(
          targetChars.length,
          session.errors,
        );
        result = { ppm, accuracy, stars: starsFor(accuracy) };
        const finished = result;
        setTypingProgress((prev) => {
          const next = recordLessonResult(prev, typingText.id, finished);
          saveTypingProgress(next);
          return next;
        });
        sounds.playComplete();
      }

      if (!reducedMotion) {
        setSpawnQueue((q) => [
          ...q,
          {
            def,
            cell: cellFromKey(def, expected, shift, caps),
            typingIndex: targetIndex,
          },
        ]);
      }

      const next = { ...session, cursor, startedAt, result };
      typingSessionRef.current = next;
      setTypingSession(next);
      return;
    }

    sounds.playError();
    const errored = { ...session, errors: session.errors + 1, shake: session.shake + 1 };
    typingSessionRef.current = errored;
    setTypingSession(errored);
    setTypingProgress((prev) => {
      const next = recordKeyError(prev, def.code);
      saveTypingProgress(next);
      return next;
    });
  };

  const handleBackspace = () => {
    updatePendingAccent(null);

    if (spawnQueue.length > 0) {
      setSpawnQueue((queue) => queue.slice(0, -1));
      return;
    }

    const lastIndex = lines.length - 1;
    let lastFlightPos = -1;
    flights.forEach((flight, index) => {
      if (flight.line === lastIndex) lastFlightPos = index;
    });
    if (lastFlightPos >= 0) {
      setFlights((prev) => prev.filter((_, index) => index !== lastFlightPos));
      return;
    }

    setLines((prev) => {
      const next = [...prev];
      const index = next.length - 1;
      if (next[index].length > 0) {
        next[index] = next[index].slice(0, -1);
        return next;
      }
      if (next.length > 1) next.pop();
      return next;
    });
  };

  const handleEnter = (def: KeyDef, event: KeyboardEvent) => {
    updatePendingAccent(null);
    const lastIndex = lines.length - 1;
    const hasContent =
      lines[lastIndex].length > 0 ||
      flights.some((flight) => flight.line === lastIndex);

    commitCell(
      def,
      cellFromKey(
        def,
        def.label,
        event.shiftKey,
        event.getModifierState("CapsLock"),
      ),
      { line: lastIndex },
    );
    setLines((prev) => [...prev, []]);

    if (hasContent) setFlashLine(lastIndex);
  };

  const handleCharKey = (def: KeyDef, event: KeyboardEvent) => {
    const shift = event.shiftKey;
    const caps = event.getModifierState("CapsLock");
    const known = KEY_BY_CODE[def.code];

    let char = known
      ? resolveChar(def, shift, caps)
      : Array.from(event.key).length === 1
        ? event.key
        : def.label;
    if (!char) return;

    const accentPending = pendingAccentRef.current;
    if (accentPending) {
      const composed = ACCENTS[accentPending]?.compose[char];
      updatePendingAccent(null);
      if (composed) char = composed;
    }

    commitCell(def, cellFromKey(def, char, shift, caps));
  };

  const handleKeyDown = (event: KeyboardEvent): void => {
    if (confirmClear || downloadOpen || textPickerOpen) {
      if (event.key === "Escape") {
        event.preventDefault();
        setConfirmClear(false);
        setDownloadOpen(false);
        setTextPickerOpen(false);
      }
      return;
    }

    const def = keyDefForEvent(event);

    if (shouldPreventDefault(event)) event.preventDefault();

    setPressed((prev) => {
      if (prev.has(event.code)) return prev;
      const next = new Set(prev);
      next.add(event.code);
      return next;
    });
    if (def.kind === "shift") setShiftHeld(true);
    setCapsOn(event.getModifierState("CapsLock"));

    if (event.repeat) return;

    sounds.playKey(def.code);

    if (mode === "typing") {
      handleTypingKey(def, event);
      return;
    }

    switch (def.kind) {
      case "shift":
      case "caps":
      case "tab":
      case "mod":
        commitCell(
          def,
          cellFromKey(
            def,
            def.label,
            event.shiftKey,
            event.getModifierState("CapsLock"),
          ),
          { remote: Boolean(def.synthetic) },
        );
        return;
      case "backspace":
        handleBackspace();
        return;
      case "enter":
        handleEnter(def, event);
        return;
      case "space": {
        const caps = event.getModifierState("CapsLock");
        updatePendingAccent(null);
        commitCell(def, cellFromKey(def, " ", event.shiftKey, caps));
        return;
      }
      case "dead": {
        const accent = event.shiftKey
          ? (def.shiftLabel ?? def.label)
          : def.label;
        updatePendingAccent(accent);
        commitCell(
          def,
          cellFromKey(
            def,
            def.label,
            event.shiftKey,
            event.getModifierState("CapsLock"),
          ),
        );
        return;
      }
      case "letter":
      case "punct":
        handleCharKey(def, event);
        return;
    }
  };

  useEffect(() => {
    keyDownRef.current = handleKeyDown;
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => keyDownRef.current(event);
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code === "ShiftLeft" || event.code === "ShiftRight") {
        setShiftHeld(false);
      }
      setPressed((prev) => {
        if (!prev.has(event.code)) return prev;
        const next = new Set(prev);
        next.delete(event.code);
        return next;
      });
    };
    const onBlur = () => {
      setPressed(new Set());
      setShiftHeld(false);
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, []);

  const clearAll = () => {
    setLines([[]]);
    setFlights([]);
    setSpawnQueue([]);
    updatePendingAccent(null);
    setConfirmClear(false);
    try {
      localStorage.removeItem(STORAGE_TEXT);
    } catch {
      /* se ignora */
    }
  };

  const accentHint =
    pendingAccent === "´"
      ? "´ + vocal = á é í ó ú"
      : pendingAccent === "¨"
        ? "¨ + vocal = ü"
        : null;

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <img className="brand-icon" src="/kinkel.svg" alt="" />
          <div className="brand-text">
            <h1 className="brand-name">Kinkel</h1>
            <p className="brand-tag">{modeTagline(mode)}</p>
          </div>
        </div>
        <div className="mode-switch" role="tablist" aria-label="Modo de la app">
          {MODES.map((entry) => {
            const active = mode === entry.id;
            return (
              <button
                key={entry.id}
                type="button"
                role="tab"
                aria-selected={active}
                className={active ? "mode-btn mode-btn--active" : "mode-btn"}
                onClick={(event) => {
                  switchMode(entry.id);
                  event.currentTarget.blur();
                }}
              >
                {entry.id === "kids" ? <PenguinIcon size={18} /> : <KeyboardIcon size={18} />}
                <span>{entry.label}</span>
              </button>
            );
          })}
        </div>
        <div className="topbar-actions">
          {mode === "typing" ? (
            <div className="text-menu-wrap">
              <button
                type="button"
                className={
                  textPickerOpen
                    ? "icon-btn icon-btn--picker icon-btn--picker-open"
                    : "icon-btn icon-btn--picker"
                }
                onClick={(event) => {
                  setTextPickerOpen((open) => !open);
                  event.currentTarget.blur();
                }}
                title="Elegir texto"
                aria-label="Elegir texto"
                aria-haspopup="menu"
                aria-expanded={textPickerOpen}
              >
                <BookIcon />
              </button>
              {textPickerOpen ? (
                <TextMenu
                  progress={typingProgress}
                  currentId={textId}
                  onSelect={(id) => {
                    resetTyping(id);
                    setTextPickerOpen(false);
                  }}
                  onClose={() => setTextPickerOpen(false)}
                />
              ) : null}
            </div>
          ) : null}
          {isWeb ? (
            <button
              type="button"
              className="icon-btn icon-btn--download"
              onClick={(event) => {
                setDownloadOpen(true);
                event.currentTarget.blur();
              }}
              title="Descargar para escritorio"
              aria-label="Descargar para escritorio"
              aria-haspopup="dialog"
              aria-expanded={downloadOpen}
            >
              <DownloadIcon />
            </button>
          ) : null}
          <button
            type="button"
            className="icon-btn"
            onClick={(event) => {
              setMuted((value) => !value);
              event.currentTarget.blur();
            }}
            title={muted ? "Activar sonido" : "Silenciar"}
            aria-label={muted ? "Activar sonido" : "Silenciar"}
            aria-pressed={muted}
          >
            {muted ? <SpeakerOffIcon /> : <SpeakerIcon />}
          </button>
          <button
            type="button"
            className="icon-btn"
            onClick={(event) => {
              setConfirmClear(true);
              event.currentTarget.blur();
            }}
            title="Borrar todo"
            aria-label="Borrar todo"
          >
            <TrashIcon />
          </button>
        </div>
      </header>

      <div className="container">
        <div className="stage-holder" ref={stageHolderRef}>
          {mode === "kids" ? (
            <TextStage lines={lines} caret={caret} flashLine={flashLine} />
          ) : (
            <TypingStage
              text={typingText}
              cursor={typingSession.cursor}
              errors={typingSession.errors}
              shake={typingSession.shake}
              done={typingSession.result !== null}
              result={typingSession.result}
              reducedMotion={reducedMotion}
              onRestart={() => resetTyping()}
              onNextText={nextText}
            />
          )}
        </div>

        <div className="keyboard-area">
          <div className="keyboard-stack">
            {accentHint ? (
              <div className="accent-hint" aria-live="polite">
                {accentHint}
              </div>
            ) : null}
            <Keyboard
              pressed={pressed}
              shiftHeld={shiftHeld}
              capsOn={capsOn}
              pendingAccent={pendingAccent}
              nextKey={mode === "typing" && expectedChar ? keyForChar(expectedChar)?.code ?? null : null}
              overlay={
                mode === "typing" ? (
                  <div className={`hands-zone${handsHidden ? " hands-zone--hidden" : ""}`}>
                    <Hands nextFinger={nextFinger} pressedFingers={pressedFingers} />
                    <button
                      type="button"
                      className="hands-toggle"
                      onClick={(event) => {
                        toggleHands();
                        event.currentTarget.blur();
                      }}
                      title={handsHidden ? "Mostrar manos" : "Ocultar manos"}
                      aria-label={handsHidden ? "Mostrar manos" : "Ocultar manos"}
                      aria-pressed={!handsHidden}
                    >
                      {handsHidden ? <EyeOffIcon size={18} /> : <EyeIcon size={18} />}
                    </button>
                  </div>
                ) : null
              }
            />
          </div>
        </div>
      </div>


      <div className="flight-layer" aria-hidden="true">
        {flights.map((flight) => {
          const arcY = Math.max(18, Math.min(flight.fromY, flight.toY) - 84);
          const tilt = flight.remote ? (hashText(flight.def.code) % 2 ? 9 : -9) : 0;

          return (
            <motion.div
              key={flight.id}
              className="flying-key"
              style={{ width: flight.width, height: flight.height }}
              initial={{
                x: flight.fromX,
                y: flight.fromY,
                scale: flight.remote ? 0.3 : 1,
                rotate: tilt,
                opacity: flight.remote ? 0 : 1,
              }}
              animate={{
                x: flight.toX,
                y: [flight.fromY, arcY, flight.toY],
                scale: flight.remote
                  ? [0.3, 1.06, flight.endScale]
                  : [1, 1.06, flight.endScale],
                rotate: [tilt, -4, 0],
                opacity: [flight.remote ? 0 : 1, 1, 1],
              }}
              transition={{
                duration: FLIGHT_SECONDS,
                ease: "easeInOut",
                opacity: flight.remote
                  ? { duration: 0.18, ease: "easeOut" }
                  : { duration: FLIGHT_SECONDS, ease: "easeInOut" },
              }}
              onAnimationComplete={() => landFlight(flight)}
            >
              <Key
                def={flight.def}
                pressed={false}
                shiftHeld={flight.cell.shift}
                capsOn={flight.cell.caps}
                accentPending={false}
              />
            </motion.div>
          );
        })}
      </div>

      {confirmClear ? (
        <div
          className="modal-backdrop"
          role="presentation"
          onPointerDown={() => setConfirmClear(false)}
        >
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="clear-title"
            onPointerDown={(event) => event.stopPropagation()}
          >
            <h2 id="clear-title">¿Borrar todo?</h2>
            <p>Se borrarán todas tus letras. Esta acción no se puede deshacer.</p>
            <div className="modal-actions">
              <button
                type="button"
                className="btn"
                onClick={(event) => {
                  setConfirmClear(false);
                  event.currentTarget.blur();
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn--danger"
                onClick={(event) => {
                  clearAll();
                  event.currentTarget.blur();
                }}
              >
                Sí, borrar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {downloadOpen ? <DownloadModal onClose={closeDownload} /> : null}
    </div>
  );
}
