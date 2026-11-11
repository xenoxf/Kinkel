/**
 * Progreso del modo Mecanografía: precisión, PPM, estrellas y errores por
 * tecla. Se guarda en localStorage (`kinkel:typing-v1`), sin red.
 */
export interface LessonStats {
  completed: boolean;
  attempts: number;
  bestPpm: number;
  bestAccuracy: number;
  stars: number;
}

export interface TypingProgress {
  lessons: Record<string, LessonStats>;
  /** Código físico → nº de pulsaciones erróneas. */
  keyErrors: Record<string, number>;
  /** Última lección abierta, para retomar donde quedaste. */
  lastLessonId?: string;
}

const STORAGE_TYPING = "kinkel:typing-v1";

export const EMPTY_PROGRESS: TypingProgress = {
  lessons: {},
  keyErrors: {},
};

export function loadTypingProgress(): TypingProgress {
  try {
    const raw = localStorage.getItem(STORAGE_TYPING);
    if (!raw) return { ...EMPTY_PROGRESS };
    const parsed = JSON.parse(raw) as Partial<TypingProgress> | null;
    if (!parsed || typeof parsed !== "object") return { ...EMPTY_PROGRESS };
    return {
      lessons:
        parsed.lessons && typeof parsed.lessons === "object"
          ? (parsed.lessons as Record<string, LessonStats>)
          : {},
      keyErrors:
        parsed.keyErrors && typeof parsed.keyErrors === "object"
          ? (parsed.keyErrors as Record<string, number>)
          : {},
      lastLessonId:
        typeof parsed.lastLessonId === "string" ? parsed.lastLessonId : undefined,
    };
  } catch {
    return { ...EMPTY_PROGRESS };
  }
}

export function saveTypingProgress(progress: TypingProgress): void {
  try {
    localStorage.setItem(STORAGE_TYPING, JSON.stringify(progress));
  } catch {
    /* sin almacenamiento: se ignora */
  }
}

/** Palabras por minuto: 1 palabra = 5 caracteres correctos. */
export function computePpm(correctChars: number, ms: number): number {
  if (ms <= 0) return 0;
  return (correctChars / 5 / (ms / 60_000)) || 0;
}

/** Precisión de la sesión (0–100). Sin errores todavía = 100%. */
export function computeAccuracy(correct: number, errors: number): number {
  const total = correct + errors;
  if (total === 0) return 100;
  return (correct / total) * 100;
}

/** 1★ completar · 2★ precisión ≥ 90% · 3★ precisión ≥ 97%. */
export function starsFor(accuracy: number): number {
  if (accuracy >= 97) return 3;
  if (accuracy >= 90) return 2;
  return 1;
}

export interface LessonResult {
  ppm: number;
  accuracy: number;
  stars: number;
}

/**
 * Registra el resultado de una lección completada y devuelve el progreso
 * actualizado. Las estrellas y el PPM conservan siempre el mejor valor.
 */
export function recordLessonResult(
  progress: TypingProgress,
  lessonId: string,
  result: LessonResult,
): TypingProgress {
  const prev = progress.lessons[lessonId];
  const next: LessonStats = {
    completed: true,
    attempts: (prev?.attempts ?? 0) + 1,
    bestPpm: Math.max(prev?.bestPpm ?? 0, Math.round(result.ppm)),
    bestAccuracy: Math.max(prev?.bestAccuracy ?? 0, Math.round(result.accuracy)),
    stars: Math.max(prev?.stars ?? 0, result.stars),
  };
  return {
    ...progress,
    lessons: { ...progress.lessons, [lessonId]: next },
    lastLessonId: lessonId,
  };
}

/** Anota una pulsación errónea sobre la tecla usada. */
export function recordKeyError(
  progress: TypingProgress,
  code: string,
): TypingProgress {
  return {
    ...progress,
    keyErrors: {
      ...progress.keyErrors,
      [code]: (progress.keyErrors[code] ?? 0) + 1,
    },
  };
}

export function lessonStars(
  progress: TypingProgress,
  lessonId: string,
): number {
  return progress.lessons[lessonId]?.stars ?? 0;
}
