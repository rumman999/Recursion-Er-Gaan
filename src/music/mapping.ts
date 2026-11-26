import { growTree, TRUNK_LENGTH, type GrowParams, type Tree } from '../recursion/branch';
import { buildTimeline, type Timeline } from '../recursion/timeline';
import { hash01 } from '../recursion/rng';
import { degreeToMidi, fold, MODES, type ModeId } from './scales';

export type Layer = 'drone' | 'melody' | 'chime' | 'resolve';

export interface NoteEvent {
  /** Seconds from the start of the composition. */
  time: number;
  dur: number;
  midi: number;
  /** 0..1 */
  vel: number;
  /** -1..1 */
  pan: number;
  layer: Layer;
  node: number;
}

export interface SoundParams {
  /** Pitch class of the key, 0 = C. */
  key: number;
  mode: ModeId;
  tempo: number;
}

export interface WindPoint {
  time: number;
  value: number;
}

export interface Composition {
  tree: Tree;
  timeline: Timeline;
  sound: SoundParams;
  notes: NoteEvent[];
  wind: WindPoint[];
  secPerBeat: number;
  /** Seconds until the recursion has fully returned. */
  body: number;
  /** body plus the reverb tail. */
  duration: number;
}

const TAIL = 7;

export function compose(grow: GrowParams, sound: SoundParams): Composition {
  const tree = growTree(grow);
  const timeline = buildTimeline(tree);
  const { nodes } = tree;
  const mode = MODES[sound.mode];
  const spb = 60 / sound.tempo;
  const notes: NoteEvent[] = [];

  const { minX, maxX } = tree.bounds;
  const cx = (minX + maxX) / 2;
  const half = Math.max(1, (maxX - minX) / 2);
  const panOf = (id: number) => Math.max(-0.75, Math.min(0.75, ((nodes[id].x2 - cx) / half) * 0.75));

  // Sections: a new chord starts with the trunk and with every grandchild of it.
  const sectionStarts: number[] = [];
  for (const c of timeline.calls) {
    const n = nodes[c.node];
    if (c.kind === 'enter' && (n.level === 0 || n.level === 2)) sectionStarts.push(c.time);
  }
  const sections = sectionStarts.filter((t, i) => i === 0 || t > sectionStarts[i - 1]);
  const rootAt = (beat: number) => {
    let idx = 0;
    for (let i = 0; i < sections.length; i++) if (sections[i] <= beat + 1e-9) idx = i;
    return mode.roots[idx % mode.roots.length];
  };

  // Drone: open fifths on each section's root, held into the next section.
  sections.forEach((start, i) => {
    const end = i + 1 < sections.length ? sections[i + 1] : timeline.totalBeats;
    const root = fold(36 + sound.key + mode.roots[i % mode.roots.length], 36, 47);
    const dur = (end - start + 1.5) * spb;
    for (const [m, v] of [
      [root, 0.5],
      [root + 7, 0.36],
      [root + 12, 0.22],
    ] as const) {
      notes.push({ time: start * spb, dur, midi: m, vel: v, pan: 0, layer: 'drone', node: 0 });
    }
  });

  for (const c of timeline.calls) {
    const n = nodes[c.node];
    const beat = c.time;

    if (c.kind === 'enter') {
      if (n.level === 0) {
        // The trunk: one low, long tone that opens the piece.
        notes.push({
          time: beat * spb,
          dur: 6 * spb,
          midi: fold(48 + sound.key, 45, 56),
          vel: 0.4,
          pan: 0,
          layer: 'resolve',
          node: n.id,
        });
      } else if (n.isLeaf) {
        // Base case: a soft chime, pitched by how the path to it turned.
        const degree = n.turn + n.childIndex * 2 + mode.steps.length;
        notes.push({
          time: beat * spb,
          dur: Math.max(0.4, timeline.dur[n.id] * 2) * spb,
          midi: fold(degreeToMidi(sound.key, mode.steps, degree, 72), 76, 98),
          vel: 0.16 + hash01(n.id, 7) * 0.16,
          pan: panOf(n.id),
          layer: 'chime',
          node: n.id,
        });
      } else {
        // Recursive call: a melody note. Left turns climb, right turns fall.
        const register = 60 + 12 * Math.floor((n.level - 1) / 3);
        const midi = fold(degreeToMidi(sound.key, mode.steps, n.turn, register), 57, 88);
        const strength = Math.sqrt(n.length / TRUNK_LENGTH);
        notes.push({
          time: beat * spb,
          dur: timeline.dur[n.id] * 1.6 * spb,
          midi,
          vel: 0.24 + 0.42 * strength,
          pan: panOf(n.id) * 0.8,
          layer: 'melody',
          node: n.id,
        });
      }
    } else if (!n.isLeaf && n.level <= 1) {
      // Returning from a big branch: settle onto the current chord root.
      const final = n.level === 0;
      const root = fold(48 + sound.key + rootAt(beat - 0.01), 43, 55);
      notes.push({
        time: beat * spb,
        dur: (final ? 8 : 3) * spb,
        midi: final ? root - 12 : root,
        vel: final ? 0.42 : 0.3,
        pan: 0,
        layer: 'resolve',
        node: n.id,
      });
      if (final) {
        notes.push({ time: beat * spb, dur: 8 * spb, midi: root - 5, vel: 0.26, pan: 0, layer: 'resolve', node: n.id });
      }
    }
  }

  // Wind follows how busy the recursion is: more calls per bar, more air.
  const wind: WindPoint[] = [];
  const enters = timeline.calls.filter((c) => c.kind === 'enter').map((c) => c.time);
  for (let b = 0; b <= timeline.totalBeats; b += 2) {
    let count = 0;
    for (const t of enters) if (t > b - 4 && t <= b) count++;
    wind.push({ time: b * spb, value: 0.2 + 0.8 * Math.min(1, count / 10) });
  }
  wind.push({ time: timeline.totalBeats * spb + 2, value: 0 });

  notes.sort((a, b) => a.time - b.time);
  const body = timeline.totalBeats * spb;
  return { tree, timeline, sound, notes, wind, secPerBeat: spb, body, duration: body + TAIL };
}

export function formatDuration(sec: number): string {
  const s = Math.round(sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
