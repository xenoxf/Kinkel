import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import * as sounds from "./audio/sounds";
import { Key } from "./components/Key";
import { Keyboard } from "./components/Keyboard";
import { TextStage } from "./components/TextStage";
import { SpeakerIcon, SpeakerOffIcon, TrashIcon } from "./components/Icons";
import { cellFromText, isBoardCell, type BoardCell } from "./game/board";
import { CELL_W } from "./game/metrics";
import {
  ACCENTS,
  KEY_BY_CODE,
  resolveChar,
  type KeyDef,
} from "./keyboard/layout";

const STORAGE_TEXT = "kinkel:board-v2";
const STORAGE_TEXT_LEGACY = "kinkel:text-v1";
const STORAGE_MUTED = "kinkel:muted-v1";
const FLIGHT_SECONDS = 0.52;

interface Flight {
  id: number;
  /** La tecla completa que viaja y luego se queda en la pizarra. */
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
}

interface SpawnRequest {
  cell: BoardCell;
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
  const [maxCols, setMaxCols] = useState(() =>
    Math.max(12, Math.floor((window.innerWidth - 320) / CELL_W)),
  );

  const stageHolderRef = useRef<HTMLDivElement>(null);
  const flightSeq = useRef(0);
  const maxColsRef = useRef(maxCols);
  const keyDownRef = useRef<(event: KeyboardEvent) => void>(() => {});

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
   * Procesa un carácter por vez: mide la tecla completa y su casilla
   * destino, y lanza la tecla voladora. Si la línea está llena, primero
   * crea una línea nueva y se volverá a procesar en el siguiente render.
   */
  useEffect(() => {
    if (spawnQueue.length === 0) return;

    const request = spawnQueue[0];
    const def = KEY_BY_CODE[request.cell.code];
    const keyEl = def
      ? document.querySelector<HTMLElement>(`.keyboard [data-key="${def.code}"]`)
      : null;

    if (!def || !keyEl) {
      setSpawnQueue((queue) => queue.slice(1));
      return;
    }

    const lastIndex = lines.length - 1;
    const pendingOnLast = flights.reduce(
      (count, flight) => count + (flight.line === lastIndex ? 1 : 0),
      0,
    );
    const plannedCol = lines[lastIndex].length + pendingOnLast;

    if (plannedCol >= maxColsRef.current) {
      setLines((prev) => [...prev, []]);
      return;
    }

    const lineEl = document.querySelector<HTMLElement>(
      `.line-text[data-line="${lastIndex}"]`,
    );
    if (!lineEl) {
      setSpawnQueue((queue) => queue.slice(1));
      return;
    }

    const keyRect = keyEl.getBoundingClientRect();
    const lineRect = lineEl.getBoundingClientRect();

    // La barra espaciadora mide 9u: se limita el ancho para que la tecla
    // voladora no sea gigante, pero conserva el aspecto de una tecla.
    const width = Math.min(keyRect.width, keyRect.height * 2.8);
    const height = keyRect.height;
    const cellCenterX = lineRect.left + plannedCol * CELL_W + CELL_W / 2;
    const cellCenterY = lineRect.top + lineRect.height / 2;

    const flight: Flight = {
      id: ++flightSeq.current,
      cell: request.cell,
      width,
      height,
      fromX: keyRect.left + keyRect.width / 2 - width / 2,
      fromY: keyRect.top,
      toX: cellCenterX - width / 2,
      toY: cellCenterY - height / 2,
      line: lastIndex,
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

  const typeDirect = (cell: BoardCell) => {
    setLines((prev) => {
      const next = [...prev];
      let index = next.length - 1;
      if (next[index].length >= maxColsRef.current) {
        next.push([]);
        index += 1;
      }
      next[index] = [...next[index], cell];
      return next;
    });
  };

  const commitChar = (
    char: string,
    code: string,
    shift: boolean,
    caps: boolean,
  ) => {
    sounds.playPop(char.codePointAt(0) ?? 0);
    const cell: BoardCell = { char, code, shift, caps };
    if (reducedMotion) {
      typeDirect(cell);
      return;
    }
    setSpawnQueue((queue) => [...queue, { cell }]);
  };

  const handleBackspace = () => {
    setPendingAccent(null);
    sounds.playBackspace();

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

  const handleEnter = () => {
    setPendingAccent(null);
    const lastIndex = lines.length - 1;
    const hasContent =
      lines[lastIndex].length > 0 ||
      flights.some((flight) => flight.line === lastIndex);
    setLines((prev) => [...prev, []]);
    if (hasContent) {
      setFlashLine(lastIndex);
      sounds.playLineDone();
    }
  };

  const handleCharKey = (def: KeyDef, event: KeyboardEvent) => {
    const shift = event.shiftKey;
    const caps = event.getModifierState("CapsLock");
    let char = resolveChar(def, shift, caps);
    if (!char) return;

    if (pendingAccent) {
      const composed = ACCENTS[pendingAccent]?.compose[char];
      setPendingAccent(null);
      if (composed) {
        char = composed;
      } else {
        // El acento no combina: se escribe tal cual y sigue la letra.
        commitChar(pendingAccent, "BracketLeft", pendingAccent === "¨", caps);
      }
    }

    commitChar(char, def.code, shift, caps);
  };

  const handleKeyDown = (event: KeyboardEvent): void => {
    if (confirmClear) {
      if (event.key === "Escape") {
        event.preventDefault();
        setConfirmClear(false);
      }
      return;
    }

    const isModifierCode = /^(Control|Alt|Meta|Shift)/.test(event.code);
    if ((event.ctrlKey || event.metaKey || event.altKey) && !isModifierCode) {
      return;
    }

    const def = KEY_BY_CODE[event.code];
    if (!def) return;

    if (
      event.code === "Tab" ||
      event.code === "Space" ||
      event.code === "Enter" ||
      event.code === "Backspace" ||
      event.code === "CapsLock" ||
      event.code.startsWith("Arrow")
    ) {
      event.preventDefault();
    }

    setPressed((prev) => {
      if (prev.has(event.code)) return prev;
      const next = new Set(prev);
      next.add(event.code);
      return next;
    });
    if (def.kind === "shift") setShiftHeld(true);
    setCapsOn(event.getModifierState("CapsLock"));

    if (event.repeat) return;

    switch (def.kind) {
      case "shift":
      case "caps":
      case "tab":
      case "mod":
      case "arrow":
        return;
      case "backspace":
        handleBackspace();
        return;
      case "enter":
        handleEnter();
        return;
      case "space": {
        const caps = event.getModifierState("CapsLock");
        if (pendingAccent) {
          commitChar(pendingAccent, "BracketLeft", pendingAccent === "¨", caps);
          setPendingAccent(null);
        }
        commitChar(" ", def.code, event.shiftKey, caps);
        return;
      }
      case "dead": {
        const accent = event.shiftKey
          ? (def.shiftLabel ?? def.label)
          : def.label;
        setPendingAccent(accent);
        sounds.playAccent();
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
          const def = KEY_BY_CODE[flight.cell.code];
          if (!def) return null;

          const arcY = Math.max(18, Math.min(flight.fromY, flight.toY) - 84);

          return (
            <motion.div
              key={flight.id}
              className="flying-key"
              style={{ width: flight.width, height: flight.height }}
              initial={{
                x: flight.fromX,
                y: flight.fromY,
                scale: 1,
                rotate: 0,
              }}
              animate={{
                x: flight.toX,
                y: [flight.fromY, arcY, flight.toY],
                scale: [1, 1.06, 0.55],
                rotate: [0, -4, 0],
              }}
              transition={{ duration: FLIGHT_SECONDS, ease: "easeInOut" }}
              onAnimationComplete={() => landFlight(flight)}
            >
              <Key
                def={def}
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
    </div>
  );
}
