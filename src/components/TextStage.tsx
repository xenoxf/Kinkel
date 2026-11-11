import { useEffect, useRef } from "react";
import type { CSSProperties } from "react";
import type { BoardCell } from "../game/board";
import { boardKeyView } from "../game/boardView";

interface TextStageProps {
  lines: BoardCell[][];
  caret: { line: number; offset: number };
  flashLine: number | null;
}

export function TextStage({ lines, caret, flashLine }: TextStageProps) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [lines.length, caret.line, caret.offset]);

  const isEmpty = lines.length === 1 && lines[0].length === 0 && caret.offset === 0;

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
                  const view = boardKeyView(cell);
                  const cellStyle = {
                    "--cell-w": `${view.width}px`,
                    "--board-key-font": `${view.fontSize}px`,
                  } as CSSProperties;

                  return (
                    <span className="char" key={cellIndex} style={cellStyle}>
                      <span
                        className={[
                          "board-key",
                          `key--${view.finger}`,
                          view.isSpace ? "board-key--space" : "",
                          view.isUtility ? "board-key--util" : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                        title={view.label}
                      >
                        {view.label}
                      </span>
                    </span>
                  );
                })}
                {caret.line === lineIndex ? (
                  <span
                    className="caret"
                    style={{ transform: `translateX(${caret.offset}px)` }}
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
