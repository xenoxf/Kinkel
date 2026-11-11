import { useEffect, useRef } from "react";
import { TYPING_TEXTS } from "./content";
import type { TypingProgress } from "./stats";

interface TextMenuProps {
  progress: TypingProgress;
  currentId: string;
  onSelect: (id: string) => void;
  onClose: () => void;
}

/**
 * Menú desplegable del botón "Elegir texto".
 *
 * Muestra solo los títulos (sin descripciones) y las estrellas conseguidas,
 * para elegir rápido entre los 20 textos sin abrir un modal grande.
 */
export function TextMenu({ progress, currentId, onSelect, onClose }: TextMenuProps) {
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const active = listRef.current?.querySelector<HTMLButtonElement>(
      ".text-menu-item--active",
    );
    active?.focus({ preventScroll: true });
    active?.scrollIntoView({ block: "nearest" });
  }, []);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Element && target.closest(".text-menu-wrap")) return;
      onClose();
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [onClose]);

  return (
    <div className="text-menu" role="menu" aria-label="Elegir texto">
      <ul className="text-menu-list" ref={listRef}>
        {TYPING_TEXTS.map((text) => {
          const stars = progress.lessons[text.id]?.stars ?? 0;
          const active = text.id === currentId;
          return (
            <li key={text.id} role="none">
              <button
                type="button"
                role="menuitemradio"
                aria-checked={active}
                className={active ? "text-menu-item text-menu-item--active" : "text-menu-item"}
                onClick={() => onSelect(text.id)}
              >
                <span className="text-menu-item-title">{text.titulo}</span>
                {stars > 0 ? (
                  <span
                    className="text-menu-stars"
                    aria-label={`${stars} ${stars === 1 ? "estrella" : "estrellas"}`}
                  >
                    {"★".repeat(stars)}
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
