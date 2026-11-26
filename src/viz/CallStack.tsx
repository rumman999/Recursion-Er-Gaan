import { useEffect, useState } from 'react';
import { stackOf, type BranchNode } from '../recursion/branch';
import { player } from '../music/player';
import { useStore } from '../state/store';
import type { Composition } from '../music/mapping';

interface Frame {
  key: string;
  label: string;
  args: string;
}

interface Snapshot {
  frames: Frame[];
  event: 'enter' | 'leaf' | 'return' | 'idle';
  calls: number;
  total: number;
}

const fmtAngle = (a: number) => `${a < 0 ? '−' : a > 0 ? '+' : ''}${Math.abs(Math.round(a))}°`;

function frameOf(n: BranchNode, depth: number): Frame {
  return {
    key: String(n.id),
    label: 'grow',
    args: `${depth - n.level}, ${n.length.toFixed(1)}, ${fmtAngle(n.angle)}`,
  };
}

/** Find the last call that has happened by `time` (binary search on the sorted call list). */
function snapshot(comp: Composition, time: number): Snapshot {
  const calls = comp.timeline.calls;
  const spb = comp.secPerBeat;
  let lo = 0;
  let hi = calls.length - 1;
  let idx = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (calls[mid].time * spb <= time) {
      idx = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  const total = comp.tree.nodes.length;
  if (idx < 0) return { frames: [], event: 'idle', calls: 0, total };
  const c = calls[idx];
  const nodes = comp.tree.nodes;
  const n = nodes[c.node];
  const chain = c.kind === 'enter' ? stackOf(nodes, n.id) : n.parent >= 0 ? stackOf(nodes, n.parent) : [];
  let entered = 0;
  for (let i = 0; i <= idx; i++) if (calls[i].kind === 'enter') entered++;
  return {
    frames: chain.map((x) => frameOf(x, comp.tree.depth)),
    event: c.kind === 'return' ? 'return' : n.isLeaf ? 'leaf' : 'enter',
    calls: entered,
    total,
  };
}

const EVENT_TEXT: Record<Snapshot['event'], string> = {
  enter: 'calling itself',
  leaf: 'base case: a leaf',
  return: 'returning',
  idle: 'waiting',
};

/** The live call stack, so you can watch the recursion you are hearing. */
export function CallStack() {
  const status = useStore((s) => s.status);
  const [snap, setSnap] = useState<Snapshot>({ frames: [], event: 'idle', calls: 0, total: 0 });

  useEffect(() => {
    let raf = 0;
    let last = '';
    let lastAt = 0;
    const tick = (ts: number) => {
      raf = requestAnimationFrame(tick);
      if (ts - lastAt < 90) return;
      lastAt = ts;
      const cur = player.current;
      if (!cur) return;
      const s = snapshot(cur.comp, player.now() - cur.offset);
      const sig = `${s.event}:${s.calls}:${s.frames.length}:${s.frames.at(-1)?.key ?? ''}`;
      if (sig !== last) {
        last = sig;
        setSnap(s);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const live = status === 'playing' || status === 'paused';
  const shown = snap.frames.slice(-9);
  const hidden = snap.frames.length - shown.length;

  return (
    <section aria-label="Call stack" className="font-mono text-[12px] leading-[1.7] text-paper-dim">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h2 className="font-display text-[15px] italic text-paper">Call stack</h2>
        <span className="tabular-nums">
          {live ? `${snap.calls} / ${snap.total}` : '—'}
        </span>
      </div>
      {!live ? (
        <p className="max-w-[26ch] font-sans text-[13px] leading-snug">
          Press play to watch grow() call itself. Each line here is one call waiting for its branches to finish.
        </p>
      ) : (
        <>
          <ol className="space-y-0">
            {hidden > 0 && <li className="text-paper-faint">… {hidden} more below</li>}
            {shown.map((f, i) => {
              const top = i === shown.length - 1;
              return (
                <li
                  key={f.key}
                  className={top ? 'text-apricot' : ''}
                  style={{ paddingLeft: `${Math.min(i + hidden, 9) * 6}px` }}
                >
                  {f.label}(<span className={top ? 'text-paper' : 'text-paper-dim'}>{f.args}</span>)
                </li>
              );
            })}
          </ol>
          <p className="mt-2 text-moss">{EVENT_TEXT[snap.event]}</p>
        </>
      )}
      <p className="mt-3 font-sans text-[11px] text-paper-faint">args: depth left, length, turn</p>
    </section>
  );
}
