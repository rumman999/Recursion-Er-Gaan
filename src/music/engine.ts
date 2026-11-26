import * as Tone from 'tone';
import type { Composition, Layer, NoteEvent } from './mapping';

export interface Mix {
  /** Drone and the low resolving tones. */
  roots: number;
  melody: number;
  chimes: number;
  wind: number;
  /** Reverb amount. */
  space: number;
}

const hz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);
/** Sliders feel more even on a squared curve. */
const curve = (v: number) => v * v;

type Mono = Tone.FMSynth | Tone.Synth;

/** A few mono voices with their own panners, so every note can sit where its branch is. */
class VoicePool {
  private voices: { synth: Mono; panner: Tone.Panner; freeAt: number }[] = [];

  constructor(count: number, make: () => Mono, out: Tone.InputNode) {
    for (let i = 0; i < count; i++) {
      const panner = new Tone.Panner(0).connect(out);
      const synth = make().connect(panner);
      this.voices.push({ synth, panner, freeAt: 0 });
    }
  }

  play(n: NoteEvent, time: number, release: number) {
    let pick = this.voices[0];
    for (const v of this.voices) if (v.freeAt < pick.freeAt) pick = v;
    pick.panner.pan.setValueAtTime(n.pan, time);
    pick.synth.triggerAttackRelease(hz(n.midi), n.dur, time, n.vel);
    pick.freeAt = time + n.dur + release;
  }

  release(time: number) {
    for (const v of this.voices) {
      v.synth.triggerRelease(time);
      v.freeAt = 0;
    }
  }

  dispose() {
    for (const v of this.voices) {
      v.synth.dispose();
      v.panner.dispose();
    }
  }
}

/**
 * Phone-speaker adaptation, used for live playback only and only when switched on.
 *
 * Measured on the desktop mix: about 97% of its energy is below 300 Hz (the drone
 * and the low returning tones). Phone speakers roll off below roughly 300-400 Hz,
 * so on a phone most of the piece disappears and only the thin top is left.
 * This path:
 *  - cuts the sub-bass a phone can't play, so it stops using up the limiter's headroom
 *    and setting off the phone's own speaker protection;
 *  - doubles each low Roots note's 3rd and 4th harmonics (an octave and a fifth, and
 *    two octaves, above it), so the ear still hears the bass note from its overtones;
 *  - skips the gentle treble cut, which suits headphones but dulls a small speaker.
 * When it is off, none of this is connected and the desktop sound is untouched.
 */
class SmallSpeaker {
  readonly input: Tone.Filter;
  private trim: Tone.Gain;
  private liftFilter: Tone.Filter;
  private droneLift: Tone.PolySynth;
  private resolveLift: Tone.PolySynth;

  constructor(out: Tone.InputNode, roots: Tone.InputNode) {
    this.trim = new Tone.Gain(Tone.dbToGain(SMALL_SPEAKER_TRIM_DB)).connect(out);
    this.input = new Tone.Filter({ type: 'highpass', frequency: 140, rolloff: -24 }).connect(this.trim);
    this.liftFilter = new Tone.Filter({ type: 'lowpass', frequency: 1400 }).connect(roots);
    // Same envelopes as the voices they shadow, pure sines so they only add those harmonics.
    this.droneLift = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'sine' },
      envelope: { attack: 4, decay: 1, sustain: 0.8, release: 6 },
      volume: -26,
    }).connect(this.liftFilter);
    this.resolveLift = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'sine' },
      envelope: { attack: 0.9, decay: 1.5, sustain: 0.5, release: 5 },
      volume: -23,
    }).connect(this.liftFilter);
  }

  /** Roots-layer notes below ~165 Hz get their 3rd and 4th harmonics. */
  play(n: NoteEvent, time: number) {
    if (n.midi >= 52) return;
    const synth = n.layer === 'drone' ? this.droneLift : this.resolveLift;
    synth.triggerAttackRelease(hz(n.midi + 19), n.dur, time, n.vel * 0.7);
    synth.triggerAttackRelease(hz(n.midi + 24), n.dur, time, n.vel * 0.5);
  }

  release(time: number) {
    this.droneLift.releaseAll(time);
    this.resolveLift.releaseAll(time);
  }

  dispose() {
    for (const node of [this.droneLift, this.resolveLift, this.liftFilter, this.input, this.trim]) node.dispose();
  }
}

/** Level trim for phone-speaker mode, set from measurement (see SmallSpeaker). */
const SMALL_SPEAKER_TRIM_DB = 0;

/**
 * The whole signal chain. Built the same way for live playback and for the
 * offline WAV render, so the download sounds like what you heard.
 */
export class Graph {
  readonly master: Tone.Gain;
  private layers: Record<'roots' | 'melody' | 'chimes' | 'wind', Tone.Gain>;
  private reverb: Tone.Reverb;
  private drone: Tone.PolySynth;
  private resolve: Tone.PolySynth;
  private melody: VoicePool;
  private chimes: VoicePool;
  private windEnv: Tone.Gain;
  private disposables: { dispose(): unknown }[] = [];
  private volume: number;
  private comp: Tone.Compressor;
  private shelf: Tone.Filter;
  private small: SmallSpeaker | null = null;
  private smallOn = false;

  private constructor(mix: Mix, volume: number) {
    this.volume = volume;
    const limiter = new Tone.Limiter(-1).toDestination();
    // Makeup gain: the layers are mixed with lots of headroom, this brings the
    // sum up to a normal listening level (peaks near -4 dBFS) before the limiter.
    const makeup = new Tone.Gain(5).connect(limiter);
    this.master = new Tone.Gain(0).connect(makeup);
    const comp = new Tone.Compressor({ threshold: -20, ratio: 2.5, attack: 0.03, release: 0.4 }).connect(this.master);
    const shelf = new Tone.Filter({ type: 'highshelf', frequency: 4500, gain: -6 }).connect(comp);
    this.comp = comp;
    this.shelf = shelf;
    this.reverb = new Tone.Reverb({ decay: 7, preDelay: 0.03, wet: 0.25 + curve(mix.space) * 0.6 }).connect(shelf);
    const delay = new Tone.FeedbackDelay({ delayTime: 0.45, feedback: 0.22, wet: 0.16 }).connect(this.reverb);
    const bus = new Tone.Gain(1).connect(delay);

    this.layers = {
      roots: new Tone.Gain(curve(mix.roots)).connect(bus),
      melody: new Tone.Gain(curve(mix.melody)).connect(bus),
      chimes: new Tone.Gain(curve(mix.chimes)).connect(bus),
      wind: new Tone.Gain(curve(mix.wind)).connect(bus),
    };

    // Drone: wide detuned sines under a slowly breathing lowpass.
    const droneFilter = new Tone.Filter({ type: 'lowpass', frequency: 800, rolloff: -24 }).connect(this.layers.roots);
    const droneLfo = new Tone.LFO({ frequency: 0.03, min: 420, max: 1100 }).connect(droneFilter.frequency).start();
    this.drone = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'fatsine', count: 3, spread: 14 },
      envelope: { attack: 4, decay: 1, sustain: 0.8, release: 6 },
      volume: -12,
    }).connect(droneFilter);

    // Resolving tones when big branches return.
    const resolveFilter = new Tone.Filter({ type: 'lowpass', frequency: 520 }).connect(this.layers.roots);
    this.resolve = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.9, decay: 1.5, sustain: 0.5, release: 5 },
      volume: -9,
    }).connect(resolveFilter);

    // Melody: soft FM bell, close to a felted marimba.
    this.melody = new VoicePool(
      6,
      () =>
        new Tone.FMSynth({
          harmonicity: 2,
          modulationIndex: 1.6,
          oscillator: { type: 'sine' },
          modulation: { type: 'triangle' },
          envelope: { attack: 0.03, decay: 1.4, sustain: 0.12, release: 2.4 },
          modulationEnvelope: { attack: 0.01, decay: 0.5, sustain: 0.05, release: 1 },
          volume: -10,
        }),
      this.layers.melody,
    );

    // Chimes: one oscillator with a few bell-like partials, very short attack, long ring.
    // (FM voices cost about four times as much to render, and leaves are the most numerous notes.)
    this.chimes = new VoicePool(
      6,
      () =>
        new Tone.Synth({
          oscillator: { type: 'custom', partials: [1, 0, 0.22, 0, 0.08, 0, 0.03] },
          envelope: { attack: 0.004, decay: 2.4, sustain: 0, release: 2.6 },
          volume: -13,
        }),
      this.layers.chimes,
    );

    // Wind: pink noise through a wandering band-pass.
    this.windEnv = new Tone.Gain(0).connect(this.layers.wind);
    const windFilter = new Tone.Filter({ type: 'bandpass', frequency: 700, Q: 0.6 }).connect(this.windEnv);
    const windLfo = new Tone.LFO({ frequency: 0.05, min: 320, max: 1300 }).connect(windFilter.frequency).start();
    const noise = new Tone.Noise({ type: 'pink', volume: -20 }).connect(windFilter).start();

    this.disposables.push(limiter, makeup, comp, shelf, delay, bus, droneFilter, droneLfo, resolveFilter, windFilter, windLfo, noise);
  }

  static async create(mix: Mix, volume: number, smallSpeaker = false): Promise<Graph> {
    const g = new Graph(mix, volume);
    await g.reverb.ready;
    if (smallSpeaker) g.setSmallSpeaker(true);
    return g;
  }

  /** Re-route the master path for a phone speaker, or back to the desktop path. */
  setSmallSpeaker(on: boolean, time = Tone.now()) {
    if (on === this.smallOn) return;
    if (on && !this.small) this.small = new SmallSpeaker(this.comp, this.layers.roots);
    this.reverb.disconnect();
    this.reverb.connect(on ? this.small!.input : this.shelf);
    if (!on) this.small?.release(time);
    this.smallOn = on;
  }

  get smallSpeaker(): boolean {
    return this.smallOn;
  }

  play(n: NoteEvent, time: number) {
    const layer: Layer = n.layer;
    if (layer === 'drone') this.drone.triggerAttackRelease(hz(n.midi), n.dur, time, n.vel);
    else if (layer === 'resolve') this.resolve.triggerAttackRelease(hz(n.midi), n.dur, time, n.vel);
    else if (layer === 'melody') this.melody.play(n, time, 2.4);
    else this.chimes.play(n, time, 3);
    if (this.smallOn && (layer === 'drone' || layer === 'resolve')) this.small!.play(n, time);
  }

  setWind(value: number, time: number) {
    this.windEnv.gain.cancelScheduledValues(time);
    this.windEnv.gain.linearRampToValueAtTime(value, time + 1.8);
  }

  setMix(mix: Mix) {
    this.layers.roots.gain.rampTo(curve(mix.roots), 0.3);
    this.layers.melody.gain.rampTo(curve(mix.melody), 0.3);
    this.layers.chimes.gain.rampTo(curve(mix.chimes), 0.3);
    this.layers.wind.gain.rampTo(curve(mix.wind), 0.3);
    this.reverb.wet.rampTo(0.25 + curve(mix.space) * 0.6, 0.5);
  }

  setVolume(volume: number) {
    this.volume = volume;
    if (this.master.gain.value > 0.0001) this.master.gain.rampTo(curve(volume), 0.2);
  }

  fadeIn(seconds = 2, time = Tone.now()) {
    this.master.gain.cancelScheduledValues(time);
    this.master.gain.setValueAtTime(this.master.gain.getValueAtTime(time), time);
    this.master.gain.linearRampToValueAtTime(curve(this.volume), time + seconds);
  }

  fadeOut(seconds = 1.5, time = Tone.now()) {
    this.master.gain.cancelScheduledValues(time);
    this.master.gain.setValueAtTime(this.master.gain.getValueAtTime(time), time);
    this.master.gain.linearRampToValueAtTime(0, time + seconds);
  }

  /** Let every sounding note ring out naturally. */
  releaseAll(time = Tone.now()) {
    this.drone.releaseAll(time);
    this.resolve.releaseAll(time);
    this.melody.release(time);
    this.chimes.release(time);
    this.small?.release(time);
  }

  dispose() {
    this.small?.dispose();
    this.drone.dispose();
    this.resolve.dispose();
    this.melody.dispose();
    this.chimes.dispose();
    this.reverb.dispose();
    this.windEnv.dispose();
    Object.values(this.layers).forEach((l) => l.dispose());
    this.master.dispose();
    this.disposables.forEach((d) => d.dispose());
  }
}

type Transport = ReturnType<typeof Tone.getTransport>;

/** Put every note and wind change of a composition on the transport, starting at `offset` seconds. */
export function scheduleComposition(g: Graph, c: Composition, transport: Transport, offset: number): number[] {
  const ids: number[] = [];
  for (const n of c.notes) ids.push(transport.schedule((t) => g.play(n, t), offset + n.time));
  for (const w of c.wind) ids.push(transport.schedule((t) => g.setWind(w.value, t), offset + w.time));
  return ids;
}
