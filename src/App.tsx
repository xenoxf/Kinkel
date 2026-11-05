import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import * as sounds from "./audio/sounds";
import { Keyboard } from "./components/Keyboard";
import { TextStage } from "./components/TextStage";
import { SpeakerIcon, SpeakerOffIcon, TrashIcon } from "./components/Icons";
import { CELL_W, LINE_H } from "./game/metrics";
import {
  ACCENTS,
  KEY_BY_CODE,
  resolveChar,
  type KeyDef,
} from "./keyboard/layout";

const STORAGE_TEXT = "kinkel:text-v1";
const STORAGE_MUTED = "kinkel:muted-v1";
const FLIGHT_SECONDS = 0.46;

interface Flight {
  id: number;
  char: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  /** Línea del texto donde aterrizará la letra. */
  line: number;
}

interface SpawnRequest {
  char: string;
  /** Código físico de la tecla, para saber de dónde despega. */
  code: string;
}

function loadLines(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_TEXT);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (
        Array.isArray(parsed) &&
        parsed.length > 0 &&
        parsed.every((line) => typeof line === "string")
      ) {
        return (parsed as string[]).slice(-80);
      }
    }
  } catch {
    /* datos corruptos: se empieza de cero */
  }
  return [""];
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

  const [lines, setLines] = useState<string[]>(loadLines);
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
   * Procesa un carácter por vez: mide la tecla y su casilla destino,
   * y lanza la letra voladora. Si la línea está llena, primero crea
   * una línea nueva y se volverá a procesar en el siguiente render.
   */
  useEffect(() => {
    if (spawnQueue.length === 0) return;

    const request = spawnQueue[0];
    const def = KEY_BY_CODE[request.code];
    const keyEl = def
      ? document.querySelector<HTMLElement>(`[data-key="${def.code}"]`)
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
      setLines((prev) => [...prev, ""]);
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

    const flight: Flight = {
      id: ++flightSeq.current,
      char: request.char,
      fromX: keyRect.left + keyRect.width / 2 - CELL_W / 2,
      fromY: keyRect.top + keyRect.height / 2 - LINE_H / 2,
      toX: lineRect.left + plannedCol * CELL_W,
      toY: lineRect.top + lineRect.height / 2 - LINE_H / 2,
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
      while (next.length <= flight.line) next.push("");
      next[flight.line] += flight.char;
      return next;
    });
  };

  const typeDirect = (char: string) => {
    setLines((prev) => {
      const next = [...prev];
      let index = next.length - 1;
      if (next[index].length >= maxColsRef.current) {
        next.push("");
        index += 1;
      }
      next[index] += char;
      return next;
    });
  };

  const commitChar = (char: string, code: string) => {
    sounds.playPop(char.codePointAt(0) ?? 0);
    if (reducedMotion) {
      typeDirect(char);
      return;
    }
    setSpawnQueue((queue) => [...queue, { char, code }]);
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
        next[index] = Array.from(next[index]).slice(0, -1).join("");
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
    setLines((prev) => [...prev, ""]);
    if (hasContent) {
      setFlashLine(lastIndex);
      sounds.playLineDone();
    }
  };

  const handleCharKey = (def: KeyDef, event: KeyboardEvent) => {
    let char = resolveChar(
      def,
      event.shiftKey,
      event.getModifierState("CapsLock"),
    );
    if (!char) return;

    if (pendingAccent) {
      const composed = ACCENTS[pendingAccent]?.compose[char];
      setPendingAccent(null);
      if (composed) {
        char = composed;
      } else {
        // El acento no combina: se escribe tal cual y sigue la letra.
        commitChar(pendingAccent, "BracketLeft");
      }
    }

    commitChar(char, def.code);
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
      event.code === "CapsLock"
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
        return;
      case "backspace":
        handleBackspace();
        return;
      case "enter":
        handleEnter();
        return;
      case "space": {
        if (pendingAccent) {
          commitChar(pendingAccent, "BracketLeft");
          setPendingAccent(null);
        }
        commitChar(" ", def.code);
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
    setLines([""]);
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

      <div className="flight-layer" aria-hidden="true">
        {flights.map((flight) => {
          const arcY = Math.max(72, Math.min(flight.fromY, flight.toY) - 110);
          return (
            <motion.span
              key={flight.id}
              className="flying-letter"
              initial={{
                x: flight.fromX,
                y: flight.fromY,
                scale: 0.8,
                rotate: 0,
                opacity: 0.95,
              }}
              animate={{
                x: flight.toX,
                y: [flight.fromY, arcY, flight.toY],
                scale: [0.8, 1.25, 1],
                rotate: [0, -8, 0],
                opacity: [0.95, 1, 1],
              }}
              transition={{ duration: FLIGHT_SECONDS, ease: "easeInOut" }}
              onAnimationComplete={() => landFlight(flight)}
            >
              {flight.char === " " ? "\u00A0" : flight.char}
            </motion.span>
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
