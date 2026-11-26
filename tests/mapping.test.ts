import { describe, expect, it } from 'vitest';
import { compose } from '../src/music/mapping';
import { MODE_IDS, MODES } from '../src/music/scales';

const grow = { depth: 7, branches: 2 as const, spread: 24, ratio: 0.74, wildness: 0.3, seed: 4127 };

describe('compose', () => {
  it('keeps melody and chimes inside the chosen mode', () => {
    for (const mode of MODE_IDS) {
      for (const key of [0, 2, 9]) {
        const c = compose(grow, { key, mode, tempo: 62 });
        const steps = MODES[mode].steps;
        for (const n of c.notes.filter((x) => x.layer === 'melody' || x.layer === 'chime')) {
          expect(steps).toContain((((n.midi - key) % 12) + 12) % 12);
        }
      }
    }
  });

  it('plays one note per call: melody for recursive calls, chime for the base case', () => {
    const c = compose(grow, { key: 2, mode: 'majpent', tempo: 62 });
    const leaves = c.tree.nodes.filter((n) => n.isLeaf).length;
    const inner = c.tree.nodes.filter((n) => !n.isLeaf && n.level > 0).length;
    expect(c.notes.filter((n) => n.layer === 'chime').length).toBe(leaves);
    expect(c.notes.filter((n) => n.layer === 'melody').length).toBe(inner);
  });

  it('stays in a gentle range with sane values', () => {
    const c = compose(grow, { key: 5, mode: 'lydian', tempo: 70 });
    for (const n of c.notes) {
      expect(n.midi).toBeGreaterThanOrEqual(24);
      expect(n.midi).toBeLessThanOrEqual(98);
      expect(n.vel).toBeGreaterThan(0);
      expect(n.vel).toBeLessThanOrEqual(1);
      expect(Math.abs(n.pan)).toBeLessThanOrEqual(1);
      expect(n.time).toBeLessThanOrEqual(c.body + 1e-6);
    }
  });

  it('slower tempo means a longer piece', () => {
    const slow = compose(grow, { key: 0, mode: 'majpent', tempo: 50 });
    const fast = compose(grow, { key: 0, mode: 'majpent', tempo: 80 });
    expect(slow.body).toBeGreaterThan(fast.body);
  });
});
