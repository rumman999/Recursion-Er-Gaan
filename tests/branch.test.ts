import { describe, expect, it } from 'vitest';
import { growTree, maxDepthFor, MAX_NODES, stackOf, type GrowParams } from '../src/recursion/branch';
import { buildTimeline } from '../src/recursion/timeline';

const base: GrowParams = { depth: 6, branches: 2, spread: 25, ratio: 0.72, wildness: 0.4, seed: 4127 };

describe('growTree', () => {
  it('is deterministic for a seed', () => {
    expect(growTree(base)).toEqual(growTree(base));
    expect(growTree(base).nodes[5].x2).not.toEqual(growTree({ ...base, seed: 4128 }).nodes[5].x2);
  });

  it('makes a full binary tree', () => {
    const tree = growTree({ ...base, wildness: 0 });
    expect(tree.nodes.length).toBe(2 ** 7 - 1);
    expect(tree.leaves).toBe(2 ** 6);
  });

  it('balances every enter with a return, nested like a stack', () => {
    const tree = growTree(base);
    const stack: number[] = [];
    for (const c of tree.calls) {
      if (c.kind === 'enter') stack.push(c.node);
      else expect(stack.pop()).toBe(c.node);
    }
    expect(stack.length).toBe(0);
    expect(tree.calls.length).toBe(tree.nodes.length * 2);
  });

  it('depth 0 is a single leaf', () => {
    const tree = growTree({ ...base, depth: 0 });
    expect(tree.nodes.length).toBe(1);
    expect(tree.nodes[0].isLeaf).toBe(true);
  });

  it('never exceeds the node cap', () => {
    const tree = growTree({ ...base, depth: 9, branches: 3 });
    expect(tree.nodes.length).toBeLessThanOrEqual(MAX_NODES);
    expect(tree.depth).toBe(maxDepthFor(3));
    expect(maxDepthFor(2)).toBe(9);
  });

  it('builds call stacks from the trunk down', () => {
    const tree = growTree(base);
    const leaf = tree.nodes.find((n) => n.isLeaf)!;
    const stack = stackOf(tree.nodes, leaf.id);
    expect(stack[0].id).toBe(0);
    expect(stack.at(-1)!.id).toBe(leaf.id);
    expect(stack.length).toBe(leaf.level + 1);
  });
});

describe('buildTimeline', () => {
  it('starts every node exactly once and never goes backwards on enter', () => {
    const tree = growTree(base);
    const tl = buildTimeline(tree);
    const enters = tl.calls.filter((c) => c.kind === 'enter');
    expect(enters.length).toBe(tree.nodes.length);
    for (let i = 1; i < enters.length; i++) expect(enters[i].time).toBeGreaterThanOrEqual(enters[i - 1].time);
    expect(tl.totalBeats).toBeGreaterThan(0);
  });

  it('puts all times on a sixteenth-note grid', () => {
    const tl = buildTimeline(growTree(base));
    for (const c of tl.calls) expect((c.time * 4) % 1).toBeCloseTo(0);
  });
});
