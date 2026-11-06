import { useEffect, useRef } from "react";
import type { BoardCell } from "../game/board";
import { CELL_W } from "../game/metrics";
import { KEY_BY_CODE } from "../keyboard/layout";

interface TextStageProps {
  lines: BoardCell[][];
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
    <section className="stage" aria-label="Tus teclas">
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
                {line.map((cell, cellIndex) => {
                  const def = cell.code ? KEY_BY_CODE[cell.code] : undefined;
                  const kind = cell.kind ?? def?.kind;
                  const finger = cell.finger ?? def?.finger ?? "mod";
                  const isSpace = kind === "space" || cell.char === " ";
                  const isUtility =
                    kind === "enter" ||
                    kind === "backspace" ||
                    kind === "caps" ||
                    kind === "shift" ||
                    kind === "tab" ||
                    kind === "mod" ||
                    (!def && cell.char.length > 1);
                  const label = isSpace
                    ? "espacio"
                    : isUtility && def
                      ? def.label
                      : cell.char;
                  const sizeClass = isSpace
                    ? ""
                    : label.length >= 6
                      ? "board-key--xs"
                      : label.length >= 4
                        ? "board-key--sm"
                        : "";

                  return (
                    <span className="char" key={cellIndex}>
                      <span
                        className={[
                          "board-key",
                          `key--${finger}`,
                          isSpace ? "board-key--space" : "",
                          isUtility ? "board-key--util" : "",
                          sizeClass,
                        ]
                          .filter(Boolean)
                          .join(" ")}
                        title={label}
                      >
                        {label}
                      </span>
                    </span>
                  );
                })}
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
          Escribe en tu teclado y mira cómo vuelan tus teclas…
        </p>
      ) : null}
    </section>
  );
}
