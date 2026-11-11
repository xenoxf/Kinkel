import { useEffect, useMemo, useRef } from "react";
import type { TypingText } from "./content";
import type { LessonResult } from "./stats";
import { keyForChar } from "./keysFor";

interface TypingStageProps {
  text: TypingText;
  /** Índice del próximo carácter (igual al nº de caracteres correctos). */
  cursor: number;
  errors: number;
  /** Cambia con cada error para relanzar la animación de sacudida. */
  shake: number;
  done: boolean;
  result: LessonResult | null;
  reducedMotion: boolean;
  onRestart: () => void;
  onNextText: (() => void) | null;
}

const CONFETTI_COLORS = [
  "#f43f5e", "#f97316", "#eab308", "#22c55e",
  "#0d9488", "#3b82f6", "#8b5cf6", "#ec4899",
];

function StarIcon({ filled, size = 30 }: { filled: boolean; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 2.6l2.9 5.9 6.5 1-4.7 4.6 1.1 6.5L12 19.1 6.2 22l1.1-6.5L2.6 10l6.5-1z"
        fill={filled ? "#fbbf24" : "none"}
        stroke={filled ? "#f59e0b" : "#cbd5e1"}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function WordGroup({ word, baseIndex, cursor, shake }: {
  word: string;
  baseIndex: number;
  cursor: number;
  shake: number;
}) {
  return (
    <span className="typing-word">
      {Array.from(word).map((char, offset) => {
        const index = baseIndex + offset;
        const state =
          index < cursor ? "done" : index === cursor ? "current" : "pending";

        if (state === "done") {
          const known = keyForChar(char);
          return (
            <span
              key={index}
              data-idx={index}
              className={`typing-char typing-char--done key--${known?.finger ?? "mod"}`}
            >
              {char}
            </span>
          );
        }

        return (
          <span
            key={state === "current" ? `cur-${shake}` : index}
            data-idx={index}
            className={[
              "typing-char",
              `typing-char--${state}`,
              state === "current" && shake > 0 ? "typing-char--error" : "",
            ].filter(Boolean).join(" ")}
          >
            {char}
          </span>
        );
      })}
    </span>
  );
}

export function TypingStage({
  text,
  cursor,
  errors,
  shake,
  done,
  result,
  reducedMotion,
  onRestart,
  onNextText,
}: TypingStageProps) {
  const bodyRef = useRef<HTMLDivElement>(null);

  // Mantiene visible el carácter activo mientras el texto avanza.
  useEffect(() => {
    const current = bodyRef.current?.querySelector(".typing-char--current");
    current?.scrollIntoView({ block: "nearest" });
  }, [cursor, text.id]);

  // Agrupa el texto en palabras para no cortar líneas a media palabra.
  const words = useMemo(() => {
    const groups: { word: string; start: number }[] = [];
    let index = 0;
    for (const raw of text.contenido.split(" ")) {
      if (raw.length > 0) groups.push({ word: raw, start: index });
      index += raw.length + 1;
    }
    return groups;
  }, [text.contenido]);

  const confetti = useMemo(
    () =>
      Array.from({ length: 30 }, (_, index) => ({
        id: index,
        left: Math.random() * 100,
        delay: Math.random() * 0.8,
        duration: 1.5 + Math.random() * 1.4,
        color: CONFETTI_COLORS[index % CONFETTI_COLORS.length],
      })),
    [],
  );

  return (
    <section className="stage typing-stage" aria-label="Texto para escribir">
      <div className="typing-body" ref={bodyRef}>
        <p className="typing-text" aria-label={`Texto: ${text.contenido}`}>
          {words.map(({ word, start }, index) => (
            <span key={index} className="typing-word-wrap">
              <WordGroup word={word} baseIndex={start} cursor={cursor} shake={shake} />
              {index < words.length - 1 ? (
                <span
                  data-idx={start + word.length}
                  className={[
                    "typing-char",
                    "typing-char--space",
                    start + word.length < cursor
                      ? "typing-char--done key--thumb"
                      : start + word.length === cursor
                        ? "typing-char--current"
                        : "typing-char--pending",
                  ].join(" ")}
                >
                  {start + word.length < cursor ? "·" : " "}
                </span>
              ) : null}
            </span>
          ))}
        </p>

        {done && result ? (
          <div className="typing-result" role="status">
            {!reducedMotion
              ? confetti.map((piece) => (
                  <span
                    key={piece.id}
                    className="confetti-piece"
                    style={{
                      left: `${piece.left}%`,
                      background: piece.color,
                      animationDelay: `${piece.delay}s`,
                      animationDuration: `${piece.duration}s`,
                    }}
                  />
                ))
              : null}
            <h3>¡Texto completado!</h3>
            <div className="typing-stars">
              {[1, 2, 3].map((value) => (
                <span
                  key={value}
                  className={value <= result.stars ? "star star--on" : "star"}
                  style={{ animationDelay: `${0.15 + value * 0.18}s` }}
                >
                  <StarIcon filled={value <= result.stars} />
                </span>
              ))}
            </div>
            <dl className="typing-result-stats">
              <div>
                <dt>Velocidad</dt>
                <dd>{Math.round(result.ppm)} ppm</dd>
              </div>
              <div>
                <dt>Precisión</dt>
                <dd>{Math.round(result.accuracy)}%</dd>
              </div>
              <div>
                <dt>Errores</dt>
                <dd>{errors}</dd>
              </div>
            </dl>
            <div className="typing-result-actions">
              <button type="button" className="btn" onClick={onRestart}>
                Repetir
              </button>
              {onNextText ? (
                <button type="button" className="btn btn--primary" onClick={onNextText} autoFocus>
                  Siguiente texto →
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
