import type { GrowParams } from '../recursion/branch';
import type { SoundParams } from '../music/mapping';
import { MODE_IDS, type ModeId } from '../music/scales';

/** Short keys keep shared links readable: #d=7&b=2&a=24&r=0.74&w=0.3&s=4127&k=2&m=majpent&t=62 */
export function writeHash(grow: GrowParams, sound: SoundParams) {
  const q = new URLSearchParams({
    d: String(grow.depth),
    b: String(grow.branches),
    a: String(grow.spread),
    r: String(grow.ratio),
    w: String(grow.wildness),
    s: String(grow.seed),
    k: String(sound.key),
    m: sound.mode,
    t: String(sound.tempo),
  });
  history.replaceState(null, '', `#${q.toString()}`);
}

export function readHash(): { grow: Partial<GrowParams>; sound: Partial<SoundParams> } {
  if (typeof location === 'undefined' || location.hash.length < 2) return { grow: {}, sound: {} };
  const q = new URLSearchParams(location.hash.slice(1));
  const num = (key: string, lo: number, hi: number) => {
    const raw = q.get(key);
    if (raw === null) return undefined;
    const v = Number(raw);
    return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : undefined;
  };
  const grow: Partial<GrowParams> = {};
  const sound: Partial<SoundParams> = {};
  const set = <T extends object>(obj: T, key: keyof T, v: unknown) => {
    if (v !== undefined) (obj as Record<keyof T, unknown>)[key] = v;
  };
  set(grow, 'depth', num('d', 1, 9) && Math.round(num('d', 1, 9)!));
  const b = num('b', 2, 3);
  set(grow, 'branches', b === undefined ? undefined : b >= 2.5 ? 3 : 2);
  set(grow, 'spread', num('a', 10, 60));
  set(grow, 'ratio', num('r', 0.55, 0.85));
  set(grow, 'wildness', num('w', 0, 1));
  set(grow, 'seed', num('s', 1, 9999) && Math.round(num('s', 1, 9999)!));
  set(sound, 'key', num('k', 0, 11) !== undefined ? Math.round(num('k', 0, 11)!) : undefined);
  set(sound, 'tempo', num('t', 48, 84));
  const m = q.get('m');
  if (m && (MODE_IDS as string[]).includes(m)) sound.mode = m as ModeId;
  return { grow, sound };
}
