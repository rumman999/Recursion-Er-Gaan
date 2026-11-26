import * as Tone from 'tone';
import { Midi } from '@tonejs/midi';
import { Graph, scheduleComposition, type Mix } from '../music/engine';
import type { Composition, Layer } from '../music/mapping';
import { encodeWav } from './wav';

/** Lay compositions end to end the same way endless mode does. */
function layout(comps: Composition[]): { comp: Composition; offset: number }[] {
  let offset = 0.25;
  return comps.map((comp) => {
    const placed = { comp, offset };
    offset += comp.body + 1.5;
    return placed;
  });
}

/**
 * Render offline with the same graph used for live playback.
 * If `seconds` is given, the audio is cut there with a fade-out.
 */
export async function renderWav(comps: Composition[], mix: Mix, seconds?: number): Promise<Blob> {
  const placed = layout(comps);
  const last = placed[placed.length - 1];
  const natural = last.offset + last.comp.duration;
  const total = seconds ? Math.min(seconds, natural) : natural;

  const buffer = await Tone.Offline(async (ctx) => {
    const g = await Graph.create(mix, 0.95);
    for (const p of placed) scheduleComposition(g, p.comp, ctx.transport, p.offset);
    g.fadeIn(0.6, 0);
    if (seconds && seconds < natural) g.fadeOut(5, total - 5);
    ctx.transport.start(0);
  }, total, 2, 44100);

  const audio = buffer.get();
  if (!audio) throw new Error('Render produced no audio');
  return new Blob([encodeWav(audio)], { type: 'audio/wav' });
}

const TRACK_NAMES: Record<Layer, string> = {
  drone: 'Drone (sections)',
  resolve: 'Returns',
  melody: 'Recursive calls',
  chime: 'Leaves (base case)',
};

export function renderMidi(comps: Composition[]): Blob {
  const midi = new Midi();
  midi.header.setTempo(comps[0].sound.tempo);
  midi.header.name = 'Recursion Er Gaan';
  const tracks = new Map<Layer, ReturnType<Midi['addTrack']>>();
  for (const layer of Object.keys(TRACK_NAMES) as Layer[]) {
    const t = midi.addTrack();
    t.name = TRACK_NAMES[layer];
    tracks.set(layer, t);
  }
  for (const { comp, offset } of layout(comps)) {
    for (const n of comp.notes) {
      tracks.get(n.layer)!.addNote({ midi: n.midi, time: offset + n.time, duration: n.dur, velocity: n.vel });
    }
  }
  return new Blob([midi.toArray() as Uint8Array<ArrayBuffer>], { type: 'audio/midi' });
}
