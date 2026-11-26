import type { GrowParams } from '../recursion/branch';
import type { SoundParams } from '../music/mapping';

export interface Preset {
  id: string;
  name: string;
  note: string;
  grow: Omit<GrowParams, 'seed'>;
  sound: SoundParams;
  seed: number;
}

export const PRESETS: Preset[] = [
  {
    id: 'fern',
    name: 'Fern at dusk',
    note: 'Two branches, slow and even. A good first listen.',
    grow: { depth: 7, branches: 2, spread: 24, ratio: 0.74, wildness: 0.3 },
    sound: { key: 2, mode: 'majpent', tempo: 62 },
    seed: 4127,
  },
  {
    id: 'willow',
    name: 'Willow',
    note: 'Long, narrow limbs and a minor scale.',
    grow: { depth: 8, branches: 2, spread: 14, ratio: 0.8, wildness: 0.45 },
    sound: { key: 9, mode: 'minpent', tempo: 56 },
    seed: 812,
  },
  {
    id: 'lantern',
    name: 'Lantern bloom',
    note: 'Three branches per call, so the leaves come in bright clusters.',
    grow: { depth: 5, branches: 3, spread: 38, ratio: 0.66, wildness: 0.25 },
    sound: { key: 5, mode: 'lydian', tempo: 66 },
    seed: 2209,
  },
  {
    id: 'roots',
    name: 'Deep roots',
    note: 'Wide and crooked, on a Japanese scale, very slow.',
    grow: { depth: 6, branches: 2, spread: 44, ratio: 0.7, wildness: 0.6 },
    sound: { key: 0, mode: 'hirajoshi', tempo: 50 },
    seed: 97,
  },
  {
    id: 'rain',
    name: 'Rain garden',
    note: 'Dense and short-lived, in Dorian.',
    grow: { depth: 6, branches: 3, spread: 30, ratio: 0.62, wildness: 0.5 },
    sound: { key: 4, mode: 'dorian', tempo: 60 },
    seed: 3301,
  },
];
