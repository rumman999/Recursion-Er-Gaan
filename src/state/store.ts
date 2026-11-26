import { create } from 'zustand';
import type { GrowParams } from '../recursion/branch';
import { compose, type Composition, type SoundParams } from '../music/mapping';
import type { Mix } from '../music/engine';
import { player } from '../music/player';
import { PRESETS } from './presets';
import { readHash } from './urlSync';

export type Status = 'idle' | 'loading' | 'playing' | 'paused';

interface State {
  grow: GrowParams;
  sound: SoundParams;
  mix: Mix;
  volume: number;
  comp: Composition;
  status: Status;
  started: boolean;
  endless: boolean;
  /** Minutes, 0 = off. */
  sleep: number;
  sleepEndsAt: number | null;
  focus: boolean;
  drawerOpen: boolean;
  exportOpen: boolean;
  helpOpen: boolean;
  /** Short line for the screen-reader live region. */
  announcement: string;

  setGrow: (patch: Partial<GrowParams>) => void;
  setSound: (patch: Partial<SoundParams>) => void;
  setMix: (patch: Partial<Mix>) => void;
  setVolume: (v: number) => void;
  applyPreset: (id: string) => void;
  newSeed: () => void;
  play: () => Promise<void>;
  pause: () => void;
  togglePlay: () => void;
  stop: (fade?: number) => void;
  setEndless: (on: boolean) => void;
  setSleep: (minutes: number) => void;
  setFocus: (on: boolean) => void;
  setDrawer: (open: boolean) => void;
  setExportOpen: (open: boolean) => void;
  setHelpOpen: (open: boolean) => void;
}

const first = PRESETS[0];
const defaults = {
  grow: { ...first.grow, seed: first.seed } as GrowParams,
  sound: { ...first.sound } as SoundParams,
  mix: { roots: 0.7, melody: 0.75, chimes: 0.65, wind: 0.45, space: 0.6 } as Mix,
};

const fromUrl = readHash();
const initialGrow = { ...defaults.grow, ...fromUrl.grow };
const initialSound = { ...defaults.sound, ...fromUrl.sound };

const randomSeed = () => 1 + Math.floor(Math.random() * 9999);

let regrowTimer: number | undefined;
let sleepTimer: number | undefined;
/** Set while endless mode is moving to the next seed, so the new plant is appended instead of replacing. */
let appendNext = false;

export const useStore = create<State>((set, get) => {
  /** Recompose and, if sound is running, hand the new piece to the player. */
  const recompose = (grow: GrowParams, sound: SoundParams) => {
    const comp = compose(grow, sound);
    set({ grow, sound, comp });
    const { status } = get();
    if (status === 'idle' || status === 'loading') return;
    window.clearTimeout(regrowTimer);
    if (appendNext) {
      appendNext = false;
      player.append(comp);
      return;
    }
    // Debounce so dragging a slider regrows once when you let go, not forty times.
    regrowTimer = window.setTimeout(() => player.replace(get().comp), 320);
  };

  return {
    ...defaults,
    grow: initialGrow,
    sound: initialSound,
    volume: 0.8,
    comp: compose(initialGrow, initialSound),
    status: 'idle',
    started: false,
    endless: true,
    sleep: 0,
    sleepEndsAt: null,
    focus: false,
    drawerOpen: typeof window !== 'undefined' ? window.innerWidth >= 1024 : true,
    exportOpen: false,
    helpOpen: false,
    announcement: '',

    setGrow: (patch) => recompose({ ...get().grow, ...patch }, get().sound),
    setSound: (patch) => recompose(get().grow, { ...get().sound, ...patch }),
    setMix: (patch) => {
      const mix = { ...get().mix, ...patch };
      set({ mix });
      player.setMix(mix);
    },
    setVolume: (volume) => {
      set({ volume });
      player.setVolume(volume);
    },
    applyPreset: (id) => {
      const p = PRESETS.find((x) => x.id === id);
      if (!p) return;
      recompose({ ...p.grow, seed: p.seed }, { ...p.sound });
      set({ announcement: `Preset ${p.name}` });
    },
    newSeed: () => {
      const seed = randomSeed();
      recompose({ ...get().grow, seed }, get().sound);
      set({ announcement: `New seed ${seed}` });
    },

    play: async () => {
      const s = get();
      if (s.status === 'playing' || s.status === 'loading') return;
      if (s.status === 'paused') {
        player.resume();
        set({ status: 'playing', announcement: 'Playing' });
        return;
      }
      set({ status: 'loading', started: true, announcement: 'Starting' });
      await player.start(s.comp, s.mix, s.volume);
      set({ status: 'playing', announcement: `Growing, depth ${s.comp.tree.depth}, seed ${s.grow.seed}` });
    },
    pause: () => {
      if (get().status !== 'playing') return;
      player.pause();
      set({ status: 'paused', announcement: 'Paused' });
    },
    togglePlay: () => {
      const { status, play, pause } = get();
      if (status === 'playing') pause();
      else void play();
    },
    stop: (fade = 1.5) => {
      player.stop(fade);
      window.clearTimeout(sleepTimer);
      set({ status: 'idle', sleep: 0, sleepEndsAt: null, announcement: 'Stopped' });
    },
    setEndless: (endless) => set({ endless, announcement: endless ? 'Endless on' : 'Endless off' }),
    setSleep: (minutes) => {
      window.clearTimeout(sleepTimer);
      if (!minutes) {
        set({ sleep: 0, sleepEndsAt: null, announcement: 'Sleep timer off' });
        return;
      }
      const ms = minutes * 60_000;
      sleepTimer = window.setTimeout(() => get().stop(12), ms);
      set({ sleep: minutes, sleepEndsAt: Date.now() + ms, announcement: `Fading out in ${minutes} minutes` });
    },
    setFocus: (focus) => set({ focus }),
    setDrawer: (drawerOpen) => set({ drawerOpen }),
    setExportOpen: (exportOpen) => set({ exportOpen }),
    setHelpOpen: (helpOpen) => set({ helpOpen }),
  };
});

// When a plant finishes: grow the next one, or let the reverb ring out and stop.
player.onEnd = () => {
  const s = useStore.getState();
  if (s.status !== 'playing') return;
  if (s.endless) {
    appendNext = true;
    s.setGrow({ seed: (s.grow.seed % 9999) + 1 });
    useStore.setState({ announcement: `Next plant, seed ${useStore.getState().grow.seed}` });
  } else {
    window.setTimeout(() => {
      if (useStore.getState().status === 'playing') useStore.getState().stop(3);
    }, 4000);
  }
};
