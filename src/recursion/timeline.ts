import { TRUNK_LENGTH, type Tree } from './branch';

export interface TimedCall {
  kind: 'enter' | 'return';
  node: number;
  /** In beats from the start of the piece. */
  time: number;
}

export interface Timeline {
  calls: TimedCall[];
  /** Beat each node starts on. */
  start: Float64Array;
  /** Beats each node holds before the recursion moves on. */
  dur: Float64Array;
  totalBeats: number;
}

const GRID = 0.25;
const STRUM = 0.25;
const quantize = (b: number) => Math.max(GRID, Math.round(b / GRID) * GRID);

/** Base step by level: the trunk is slow, twigs move in eighth notes. */
function baseStep(level: number): number {
  if (level === 0) return 4;
  if (level === 1) return 2;
  if (level === 2) return 1;
  return 0.5;
}

/**
 * Turns the order of calls into rhythm. Time only moves forward on 'enter',
 * so the music follows the recursion exactly: down into a branch, through its
 * leaves, back up, and into the next sibling.
 */
export function buildTimeline(tree: Tree): Timeline {
  const { nodes, calls, params } = tree;
  const start = new Float64Array(nodes.length);
  const dur = new Float64Array(nodes.length);
  const timed: TimedCall[] = [];

  const childrenOf = new Map<number, number[]>();
  for (const n of nodes) {
    if (n.parent < 0) continue;
    const list = childrenOf.get(n.parent) ?? [];
    list.push(n.id);
    childrenOf.set(n.parent, list);
  }

  let t = 0;
  let clusterStart = 0;

  for (const call of calls) {
    const n = nodes[call.node];
    if (call.kind === 'enter') {
      const siblings = n.parent >= 0 ? childrenOf.get(n.parent)! : [n.id];
      // Leaves whose siblings are all leaves play as one strummed cluster.
      const cluster = n.isLeaf && n.parent >= 0 && siblings.every((id) => nodes[id].isLeaf);

      if (cluster) {
        const k = siblings.indexOf(n.id);
        if (k === 0) clusterStart = t;
        start[n.id] = clusterStart + k * STRUM;
        dur[n.id] = STRUM;
        timed.push({ kind: 'enter', node: n.id, time: start[n.id] });
        if (k === siblings.length - 1) t = clusterStart + quantize(siblings.length * STRUM + 0.25);
      } else {
        const expected = TRUNK_LENGTH * Math.pow(params.ratio, n.level);
        const rel = Math.min(1.4, Math.max(0.7, n.length / expected));
        const step = Math.max(0.5, quantize(baseStep(n.level) * rel));
        start[n.id] = t;
        dur[n.id] = step;
        timed.push({ kind: 'enter', node: n.id, time: t });
        t += step;
      }
    } else {
      timed.push({ kind: 'return', node: n.id, time: t });
      // Phrase ends: rest a little when the big branches finish.
      if (!n.isLeaf && n.level === 1) t += 1;
      if (!n.isLeaf && n.level === 0) t += 2;
    }
  }

  return { calls: timed, start, dur, totalBeats: t };
}
