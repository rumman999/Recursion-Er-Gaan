import { mulberry32 } from './rng';

export interface GrowParams {
  /** How many times grow() may call itself below the trunk. */
  depth: number;
  /** Children per call. */
  branches: 2 | 3;
  /** Angle between a child and its parent, in degrees. */
  spread: number;
  /** Each child is this fraction of its parent's length. */
  ratio: number;
  /** 0..1, seeded jitter on angle and length. */
  wildness: number;
  seed: number;
}

export interface BranchNode {
  id: number;
  parent: number;
  /** 0 for the trunk, +1 per recursive call. */
  level: number;
  childIndex: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** Absolute heading in degrees, 0 = straight up, negative = left. */
  heading: number;
  /** The turn this call made relative to its parent, in degrees. */
  angle: number;
  length: number;
  /** Cumulative left/right steps from the trunk. Left = +1, right = -1. Drives pitch. */
  turn: number;
  isLeaf: boolean;
}

export interface CallEvent {
  kind: 'enter' | 'return';
  node: number;
}

export interface Tree {
  params: GrowParams;
  /** Depth actually used (can be lower than requested to stay under MAX_NODES). */
  depth: number;
  nodes: BranchNode[];
  /** Every call and every return, in the order the recursion made them. */
  calls: CallEvent[];
  leaves: number;
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
}

export const MAX_NODES = 1500;
export const TRUNK_LENGTH = 100;
export const MIN_LENGTH = 1;

/** Largest depth whose full tree fits under MAX_NODES. */
export function maxDepthFor(branches: number): number {
  let total = 1;
  let level = 0;
  let width = 1;
  for (;;) {
    width *= branches;
    if (total + width > MAX_NODES) return level;
    total += width;
    level++;
  }
}

export function growTree(params: GrowParams): Tree {
  const rng = mulberry32(params.seed);
  const depth = Math.max(0, Math.min(params.depth, maxDepthFor(params.branches)));
  const sides = params.branches === 2 ? [1, -1] : [1, 0, -1];
  const nodes: BranchNode[] = [];
  const calls: CallEvent[] = [];
  let leaves = 0;

  // The recursive function the whole piece is built from.
  function grow(
    level: number,
    length: number,
    angle: number,
    heading: number,
    x: number,
    y: number,
    parent: number,
    childIndex: number,
    turn: number,
  ): void {
    const rad = (heading * Math.PI) / 180;
    const x2 = x + Math.sin(rad) * length;
    const y2 = y - Math.cos(rad) * length;
    const node: BranchNode = {
      id: nodes.length,
      parent,
      level,
      childIndex,
      x1: x,
      y1: y,
      x2,
      y2,
      heading,
      angle,
      length,
      turn,
      isLeaf: false,
    };
    nodes.push(node);
    calls.push({ kind: 'enter', node: node.id });

    // Base case: a leaf.
    if (level >= depth || length < MIN_LENGTH) {
      node.isLeaf = true;
      leaves++;
      calls.push({ kind: 'return', node: node.id });
      return;
    }

    sides.forEach((side, i) => {
      // side +1 bends left (negative heading), -1 bends right.
      const jitter = (rng() - 0.5) * params.wildness * params.spread;
      const childAngle = -side * params.spread + jitter;
      const stretch = 1 + (rng() - 0.5) * params.wildness * 0.5;
      grow(level + 1, length * params.ratio * stretch, childAngle, heading + childAngle, x2, y2, node.id, i, turn + side);
    });

    calls.push({ kind: 'return', node: node.id });
  }

  grow(0, TRUNK_LENGTH, 0, 0, 0, 0, -1, 0, 0);

  const bounds = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity };
  for (const n of nodes) {
    bounds.minX = Math.min(bounds.minX, n.x1, n.x2);
    bounds.maxX = Math.max(bounds.maxX, n.x1, n.x2);
    bounds.minY = Math.min(bounds.minY, n.y1, n.y2);
    bounds.maxY = Math.max(bounds.maxY, n.y1, n.y2);
  }

  return { params, depth, nodes, calls, leaves, bounds };
}

/** The call stack at a given node: trunk first, the node itself last. */
export function stackOf(nodes: BranchNode[], id: number): BranchNode[] {
  const out: BranchNode[] = [];
  let cur = id;
  while (cur >= 0) {
    out.push(nodes[cur]);
    cur = nodes[cur].parent;
  }
  return out.reverse();
}
