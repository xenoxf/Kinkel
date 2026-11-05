/**
 * Sonidos sintetizados con Web Audio API — sin archivos de audio.
 * El AudioContext se crea con el primer tecleo (gesto del usuario),
 * así que funciona sin permisos ni assets.
 */
let ctx: AudioContext | null = null;
let muted = false;

export function setMuted(value: boolean): void {
  muted = value;
}

function getCtx(): AudioContext | null {
  if (muted) return null;
  try {
    if (!ctx) ctx = new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

interface ToneOptions {
  freq: number;
  endFreq?: number;
  duration: number;
  type?: OscillatorType;
  volume?: number;
  delay?: number;
}

function tone({
  freq,
  endFreq,
  duration,
  type = "sine",
  volume = 0.12,
  delay = 0,
}: ToneOptions): void {
  const audio = getCtx();
  if (!audio) return;

  const t0 = audio.currentTime + delay;
  const oscillator = audio.createOscillator();
  const gain = audio.createGain();

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(freq, t0);
  if (endFreq !== undefined) {
    oscillator.frequency.exponentialRampToValueAtTime(
      Math.max(40, endFreq),
      t0 + duration,
    );
  }

  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(volume, t0 + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);

  oscillator.connect(gain).connect(audio.destination);
  oscillator.start(t0);
  oscillator.stop(t0 + duration + 0.05);
}

/** Pequeño "pop" al teclear; el tono varía según la letra. */
export function playPop(seed: number): void {
  const base = 480 + (seed % 9) * 42;
  tone({ freq: base, endFreq: base * 1.7, duration: 0.1, type: "triangle", volume: 0.15 });
}

/** Tick suave al borrar. */
export function playBackspace(): void {
  tone({ freq: 240, endFreq: 150, duration: 0.07, type: "square", volume: 0.045 });
}

/** Campanita al completar una línea con Enter. */
export function playLineDone(): void {
  tone({ freq: 660, duration: 0.14, type: "sine", volume: 0.1 });
  tone({ freq: 880, duration: 0.14, type: "sine", volume: 0.1, delay: 0.11 });
  tone({ freq: 1320, duration: 0.24, type: "sine", volume: 0.08, delay: 0.22 });
}

/** Sonidito al activar un acento (´ o ¨). */
export function playAccent(): void {
  tone({ freq: 760, endFreq: 1040, duration: 0.09, type: "sine", volume: 0.08 });
}
