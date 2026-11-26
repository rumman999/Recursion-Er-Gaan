import * as Tone from 'tone';
import { Graph, scheduleComposition, type Mix } from './engine';
import type { Composition } from './mapping';

export interface Placed {
  comp: Composition;
  /** Transport seconds where this composition starts. */
  offset: number;
}

type Transport = ReturnType<typeof Tone.getTransport>;
type Ctx = ReturnType<typeof Tone.getContext>;

/**
 * Live playback. Owns one Graph and the main transport. The visuals read
 * `now()` and `current` every frame, so sound and picture share one clock.
 */
class Player {
  private graph: Graph | null = null;
  private pending: Promise<Graph> | null = null;
  private transport: Transport | null = null;
  private ctx: Ctx | null = null;
  private pauseTimer: number | undefined;
  current: Placed | null = null;
  previous: Placed | null = null;
  /** Called (on the UI thread) when the current composition's recursion has fully returned. */
  onEnd: (() => void) | null = null;

  private async ensure(mix: Mix, volume: number): Promise<Graph> {
    await Tone.start();
    if (this.graph) return this.graph;
    if (!this.pending) {
      // Capture the live clock before any offline render can swap the global context.
      this.transport = Tone.getTransport();
      this.ctx = Tone.getContext();
      this.ctx.lookAhead = 0.15;
      this.pending = Graph.create(mix, volume);
    }
    this.graph = await this.pending;
    return this.graph;
  }

  now(): number {
    return this.transport ? this.transport.seconds : 0;
  }

  get ready(): boolean {
    return this.graph !== null;
  }

  async start(comp: Composition, mix: Mix, volume: number) {
    const g = await this.ensure(mix, volume);
    const tr = this.transport!;
    window.clearTimeout(this.pauseTimer);
    tr.stop();
    tr.cancel(0);
    tr.seconds = 0;
    this.previous = null;
    this.current = null;
    this.place(comp, 0.25);
    tr.start('+0.05');
    g.fadeIn(2.5);
  }

  pause() {
    if (!this.graph || !this.transport) return;
    this.graph.fadeOut(0.8);
    window.clearTimeout(this.pauseTimer);
    this.pauseTimer = window.setTimeout(() => this.transport?.pause(), 850);
  }

  resume() {
    if (!this.graph || !this.transport) return;
    window.clearTimeout(this.pauseTimer);
    if (this.transport.state !== 'started') this.transport.start('+0.05');
    this.graph.fadeIn(1.5);
  }

  /** Fade out and stop. `seconds` lets the sleep timer use a long fade. */
  stop(seconds = 1.5) {
    if (!this.graph || !this.transport) return;
    this.graph.fadeOut(seconds);
    window.clearTimeout(this.pauseTimer);
    this.pauseTimer = window.setTimeout(() => {
      this.transport?.stop();
      this.transport?.cancel(0);
      this.graph?.releaseAll();
      this.current = null;
      this.previous = null;
    }, seconds * 1000 + 100);
  }

  /** Swap in a new plant now. Sounding notes ring out under the new one, so nothing is cut. */
  replace(comp: Composition) {
    if (!this.graph || !this.transport) return;
    const at = this.now() + 0.35;
    this.transport.cancel(this.now());
    this.graph.releaseAll();
    this.place(comp, at);
  }

  /** Endless mode: the next plant starts after a short breath. */
  append(comp: Composition) {
    if (!this.graph || !this.transport) return;
    this.place(comp, this.now() + 1.5);
  }

  setMix(mix: Mix) {
    this.graph?.setMix(mix);
  }

  setVolume(v: number) {
    this.graph?.setVolume(v);
  }

  private place(comp: Composition, offset: number) {
    const g = this.graph!;
    const tr = this.transport!;
    this.previous = this.current;
    this.current = { comp, offset };
    scheduleComposition(g, comp, tr, offset);
    const placed = this.current;
    // Transport callbacks run slightly ahead of the audio; wait until the sound actually gets there.
    // (Tone.Draw would drop this if a frame came late, which happens in background tabs.)
    tr.schedule((t) => {
      const delay = Math.max(0, (t - this.ctx!.currentTime) * 1000);
      window.setTimeout(() => {
        if (this.current === placed) this.onEnd?.();
      }, delay);
    }, offset + comp.body);
  }
}

export const player = new Player();
