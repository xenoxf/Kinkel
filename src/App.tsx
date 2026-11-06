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
import { CELL_W } from "./game/metrics";
import {
  ACCENTS,
  KEY_BY_CODE,
  keyDefForEvent,
  resolveChar,
  type KeyDef,
} from "./keyboard/layout";

const STORAGE_TEXT = "kinkel:board-v2";
const STORAGE_TEXT_LEGACY = "kinkel:text-v1";
const STORAGE_MUTED = "kinkel:muted-v1";
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
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  /** Línea del texto donde aterrizará la tecla. */
  line: number;
  /** Tecla que no está en el dibujo: aparece desde los alrededores. */
  remote: boolean;
}

interface SpawnRequest {
  def: KeyDef;
  cell: BoardCell;
  remote?: boolean;
  /** Línea destino (Enter puede aterrizar en la línea anterior). */
  line?: number;
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
  const [muted, setMuted] = useState(loadMuted);
  const [flashLine, setFlashLine] = useState<number | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [maxCols, setMaxCols] = useState(() =>
    Math.max(12, Math.floor((window.innerWidth - 320) / CELL_W)),
  );

  const stageHolderRef = useRef<HTMLDivElement>(null);
  const flightSeq = useRef(0);
  const maxColsRef = useRef(maxCols);
  const keyDownRef = useRef<(event: KeyboardEvent) => void>(() => {});
  const isWeb = !isTauri();
  const closeDownload = useCallback(() => setDownloadOpen(false), []);

  useEffect(() => {
    maxColsRef.current = maxCols;
  }, [maxCols]);

  // Ancho disponible para el texto → cuántos caracteres caben por línea.
  useEffect(() => {
    const holder = stageHolderRef.current;
    if (!holder) return;

    const recompute = () => {
      const sample = holder.querySelector<HTMLElement>(".line-text");
      const width = sample?.clientWidth ?? 0;
      if (width > 60) {
        setMaxCols(Math.max(10, Math.floor(width / CELL_W)));
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

    const pendingOn = (line: number) =>
      flights.reduce(
        (count, flight) => count + (flight.line === line ? 1 : 0),
        0,
      );

    let plannedCol = lines[targetLine].length + pendingOn(targetLine);

    if (plannedCol >= maxColsRef.current) {
      if (targetLine === lines.length - 1) {
        setLines((prev) => [...prev, []]);
        return;
      }

      // La línea de Enter ya se cerró y estaba llena: cae en la nueva.
      targetLine = lines.length - 1;
      plannedCol = lines[targetLine].length + pendingOn(targetLine);
      if (plannedCol >= maxColsRef.current) {
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

    const cellCenterX = lineRect.left + plannedCol * CELL_W + CELL_W / 2;
    const cellCenterY = lineRect.top + lineRect.height / 2;

    const flight: Flight = {
      id: ++flightSeq.current,
      def: request.def,
      cell: request.cell,
      width,
      height,
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

  const caret = useMemo(() => {
    const last = lines.length - 1;
    const pending = flights.reduce(
      (count, flight) => count + (flight.line === last ? 1 : 0),
      0,
    );
    return { line: last, col: lines[last].length + pending };
  }, [lines, flights]);

  const landFlight = (flight: Flight) => {
    setFlights((prev) => prev.filter((item) => item.id !== flight.id));
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

      if (next[index].length >= maxColsRef.current) {
        if (index === next.length - 1) {
          next.push([]);
          index = next.length - 1;
        } else {
          index = next.length - 1;
          if (next[index].length >= maxColsRef.current) {
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

  const handleBackspace = () => {
    setPendingAccent(null);

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
    setPendingAccent(null);
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

    if (pendingAccent) {
      const composed = ACCENTS[pendingAccent]?.compose[char];
      setPendingAccent(null);
      if (composed) char = composed;
    }

    commitCell(def, cellFromKey(def, char, shift, caps));
  };

  const handleKeyDown = (event: KeyboardEvent): void => {
    if (confirmClear || downloadOpen) {
      if (event.key === "Escape") {
        event.preventDefault();
        setConfirmClear(false);
        setDownloadOpen(false);
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
        setPendingAccent(null);
        commitCell(def, cellFromKey(def, " ", event.shiftKey, caps));
        return;
      }
      case "dead": {
        const accent = event.shiftKey
          ? (def.shiftLabel ?? def.label)
          : def.label;
        setPendingAccent(accent);
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
    setPendingAccent(null);
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
            <p className="brand-tag">¡Escribe y mira volar tus letras!</p>
          </div>
        </div>
        <div className="topbar-actions">
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

      <div className="stage-holder" ref={stageHolderRef}>
        <TextStage lines={lines} caret={caret} flashLine={flashLine} />
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
          />
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
                scale: flight.remote ? [0.3, 1.06, 0.55] : [1, 1.06, 0.55],
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
