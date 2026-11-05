import { useEffect, useRef } from "react";
import { CELL_W } from "../game/metrics";

interface TextStageProps {
  lines: string[];
  caret: { line: number; col: number };
  flashLine: number | null;
}

export function TextStage({ lines, caret, flashLine }: TextStageProps) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [lines.length, caret.line, caret.col]);

  const isEmpty = lines.length === 1 && lines[0].length === 0 && caret.col === 0;

  return (
    <section className="stage" aria-label="Tus letras">
      <div className="stage-scroll">
        <div className="stage-lines">
          {lines.map((line, lineIndex) => (
            <div
              key={lineIndex}
              className={[
                "line",
                lineIndex < lines.length - 1 ? "line--done" : "",
                flashLine === lineIndex ? "line--flash" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <span className="line-num" aria-hidden="true">
                {lineIndex + 1}
              </span>
              <div className="line-text" data-line={lineIndex}>
                {Array.from(line).map((char, charIndex) => (
                  <span className="char" key={charIndex}>
                    {char === " " ? "\u00A0" : char}
                  </span>
                ))}
                {caret.line === lineIndex ? (
                  <span
                    className="caret"
                    style={{ transform: `translateX(${caret.col * CELL_W}px)` }}
                    aria-hidden="true"
                  />
                ) : null}
              </div>
            </div>
          ))}
          <div ref={endRef} className="stage-end" aria-hidden="true" />
        </div>
      </div>
      {isEmpty ? (
        <p className="stage-empty">
          Escribe en tu teclado y mira cómo vuelan tus letras…
        </p>
      ) : null}
    </section>
  );
}
