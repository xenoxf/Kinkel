/**
 * Piano sintetizado con Web Audio API — sin archivos de audio.
 * Cada tecla física tiene una nota asignada según su posición en el teclado.
 * El AudioContext se crea con el primer tecleo (gesto del usuario),
 * así que funciona sin permisos ni assets.
 */
import { KEY_BY_CODE } from "../keyboard/layout";

let ctx: AudioContext | null = null;
let muted = false;
let hammerBuffer: AudioBuffer | null = null;

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

/** Escala mayor: las notas blancas de una octava. */
const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11];

/** Pentatónica: suena bien incluso con notas al azar (teclas desconocidas). */
const PENTATONIC = [0, 2, 4, 7, 9];

/**
 * Nota base por fila: las filas de arriba suenan más agudas y la barra
 * espaciadora más grave, como si el teclado fuera un piano vertical.
 */
const ROW_BASE = [67, 55, 48, 43, 36];

function hashText(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** Devuelve la nota MIDI asociada a una tecla (0–127). */
function noteForCode(code: string): number {
  const def = KEY_BY_CODE[code];

  if (def) {
    const base = ROW_BASE[def.row] ?? 48;
    const step = Math.max(0, Math.round(def.col));
    return (
      base +
      MAJOR_SCALE[step % MAJOR_SCALE.length] +
      12 * Math.floor(step / MAJOR_SCALE.length)
    );
  }

  const seed = hashText(code);
  return 48 + (seed % 3) * 12 + PENTATONIC[Math.floor(seed / 3) % PENTATONIC.length];
}

function createHammer(audio: AudioContext): AudioBuffer {
  if (hammerBuffer) return hammerBuffer;

  const length = Math.max(1, Math.floor(audio.sampleRate * 0.028));
  const buffer = audio.createBuffer(1, length, audio.sampleRate);
  const data = buffer.getChannelData(0);

  for (let index = 0; index < length; index += 1) {
    const decay = 1 - index / length;
    data[index] = (Math.random() * 2 - 1) * decay * decay;
  }

  hammerBuffer = buffer;
  return buffer;
}

/**
 * Piano de cola de bolsillo: fundamental cálida + armónicos que se apagan
 * más rápido + un toque de ruido en el ataque. La nota se apaga con un
 * filtro paso bajo para que no suene metálica.
 */
function playPiano(midi: number): void {
  const audio = getCtx();
  if (!audio) return;

  const t0 = audio.currentTime + 0.001;
  const freq = 440 * Math.pow(2, (midi - 69) / 12);
  const duration = 1.45;

  const body = audio.createGain();
  body.gain.setValueAtTime(0.0001, t0);
  body.gain.exponentialRampToValueAtTime(0.13, t0 + 0.008);
  body.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);

  const toneFilter = audio.createBiquadFilter();
  toneFilter.type = "lowpass";
  toneFilter.frequency.setValueAtTime(Math.min(12500, freq * 9 + 1200), t0);
  toneFilter.frequency.exponentialRampToValueAtTime(
    Math.max(360, freq * 1.4),
    t0 + duration,
  );
  toneFilter.Q.setValueAtTime(0.65, t0);

  body.connect(toneFilter).connect(audio.destination);

  const partials: ReadonlyArray<readonly [number, number, OscillatorType]> = [
    [1, 0.62, "triangle"],
    [2.001, 0.18, "sine"],
    [3.002, 0.09, "sine"],
    [4.008, 0.05, "sine"],
    [5.996, 0.025, "sine"],
  ];

  for (const [factor, level, type] of partials) {
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(freq * factor, t0);

    const partialDuration = factor === 1 ? duration : duration * 0.7;
    gain.gain.setValueAtTime(level, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + partialDuration);

    oscillator.connect(gain).connect(body);
    oscillator.start(t0);
    oscillator.stop(t0 + partialDuration + 0.05);
  }

  const hammer = audio.createBufferSource();
  const hammerFilter = audio.createBiquadFilter();
  const hammerGain = audio.createGain();

  hammer.buffer = createHammer(audio);
  hammerFilter.type = "bandpass";
  hammerFilter.frequency.setValueAtTime(Math.min(7000, freq * 4 + 1400), t0);
  hammerFilter.Q.setValueAtTime(0.8, t0);
  hammerGain.gain.setValueAtTime(0.025, t0);
  hammerGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.045);

  hammer
    .connect(hammerFilter)
    .connect(hammerGain)
    .connect(audio.destination);
  hammer.start(t0);
  hammer.stop(t0 + 0.06);
}

/** Suena la nota de piano de una tecla física. */
export function playKey(code: string): void {
  playPiano(noteForCode(code));
}
