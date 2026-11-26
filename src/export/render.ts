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
export async function renderWav(
  comps: Composition[],
  mix: Mix,
  seconds?: number,
  /** Only for measuring phone-speaker mode; downloads always use the full-range mix. */
  smallSpeaker = false,
): Promise<Blob> {
  const placed = layout(comps);
  const last = placed[placed.length - 1];
  const natural = last.offset + last.comp.duration;
  const total = seconds ? Math.min(seconds, natural) : natural;

  // Same as Tone.Offline, except the transport clock runs synchronously. Tone's
  // async clock waits on setTimeout once per second of audio, and browsers
  // throttle that, which made a two-minute render take minutes.
  const live = Tone.getContext();
  const ctx = new Tone.OfflineContext(2, total, 44100);
  Tone.setContext(ctx);
  let buffer: Tone.ToneAudioBuffer;
  try {
    const g = await Graph.create(mix, 0.95, smallSpeaker);
    for (const p of placed) scheduleComposition(g, p.comp, ctx.transport, p.offset);
    g.fadeIn(0.6, 0);
    if (seconds && seconds < natural) g.fadeOut(5, total - 5);
    ctx.transport.start(0);
    buffer = await ctx.render(false);
  } finally {
    Tone.setContext(live);
  }

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

/** MIDI of the same notes. With `seconds`, notes are cut at the same point as the WAV. */
export function renderMidi(comps: Composition[], seconds?: number): Blob {
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
      const time = offset + n.time;
      if (seconds !== undefined && time >= seconds) continue;
      const duration = seconds !== undefined ? Math.min(n.dur, seconds - time) : n.dur;
      tracks.get(n.layer)!.addNote({ midi: n.midi, time, duration, velocity: n.vel });
    }
  }
  return new Blob([midi.toArray() as Uint8Array<ArrayBuffer>], { type: 'audio/midi' });
}
