export type ModeId = 'majpent' | 'minpent' | 'dorian' | 'lydian' | 'hirajoshi';

export interface Mode {
  label: string;
  /** Semitones above the key. */
  steps: number[];
  /** Chord roots (semitones above the key) the sections cycle through. */
  roots: number[];
}

export const MODES: Record<ModeId, Mode> = {
  majpent: { label: 'Major pentatonic', steps: [0, 2, 4, 7, 9], roots: [0, 9, 5, 7] },
  minpent: { label: 'Minor pentatonic', steps: [0, 3, 5, 7, 10], roots: [0, 8, 5, 3] },
  dorian: { label: 'Dorian', steps: [0, 2, 3, 5, 7, 9, 10], roots: [0, 5, 10, 3] },
  lydian: { label: 'Lydian', steps: [0, 2, 4, 6, 7, 9, 11], roots: [0, 2, 7, 4] },
  hirajoshi: { label: 'Hirajōshi', steps: [0, 2, 3, 7, 8], roots: [0, 8, 3, 7] },
};

export const MODE_IDS = Object.keys(MODES) as ModeId[];

export const KEY_NAMES = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];

/** Scale degree (any integer, negative allowed) to a MIDI note. */
export function degreeToMidi(key: number, steps: number[], degree: number, base: number): number {
  const n = steps.length;
  const octave = Math.floor(degree / n);
  const idx = ((degree % n) + n) % n;
  return base + key + steps[idx] + 12 * octave;
}

/** Shift by octaves until the note sits inside [lo, hi]. */
export function fold(midi: number, lo: number, hi: number): number {
  let m = midi;
  while (m < lo) m += 12;
  while (m > hi) m -= 12;
  return m;
}
