import type { Composition } from '../music/mapping';
import { hash01 } from '../recursion/rng';

export const COLORS = {
  ink: '#0e1512',
  paper: [232, 220, 196] as const,
  twig: [184, 196, 160] as const,
  glow: '#e9a86b',
  leaves: ['#8fa876', '#e9a86b', '#d49a9a', '#cfe0c3'],
};

export interface View {
  scale: number;
  ox: number;
  oy: number;
}

/** Fit the plant into a box, trunk base at the bottom centre. */
export function fitView(comp: Composition, box: { x: number; y: number; w: number; h: number }): View {
  const { minX, maxX, minY, maxY } = comp.tree.bounds;
  const w = Math.max(1, maxX - minX);
  const h = Math.max(1, maxY - minY);
  const scale = Math.min(box.w / w, box.h / h) * 0.92;
  const ox = box.x + box.w / 2 - ((minX + maxX) / 2) * scale;
  const oy = box.y + box.h - maxY * scale - box.h * 0.02;
  return { scale, ox, oy };
}

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const easeBack = (t: number) => {
  const c = 1.6;
  return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
};

function branchColor(level: number, depth: number, alpha: number): string {
  const k = depth > 0 ? level / depth : 0;
  const [r1, g1, b1] = COLORS.paper;
  const [r2, g2, b2] = COLORS.twig;
  const r = Math.round(r1 + (r2 - r1) * k);
  const g = Math.round(g1 + (g2 - g1) * k);
  const b = Math.round(b1 + (b2 - b1) * k);
  return `rgba(${r},${g},${b},${alpha})`;
}

export interface DrawOptions {
  /** Seconds into the composition, or null to draw the finished plant. */
  time: number | null;
  alpha: number;
  reducedMotion: boolean;
}

export function drawPlant(ctx: CanvasRenderingContext2D, comp: Composition, view: View, opts: DrawOptions) {
  const { nodes, depth } = comp.tree;
  const { start, dur } = comp.timeline;
  const spb = comp.secPerBeat;
  const { scale, ox, oy } = view;
  const X = (x: number) => ox + x * scale;
  const Y = (y: number) => oy + y * scale;
  ctx.lineCap = 'round';

  for (const n of nodes) {
    const t0 = start[n.id] * spb;
    const local = opts.time === null ? Infinity : opts.time - t0;
    if (local < 0) continue;

    const growFor = Math.max(0.25, dur[n.id] * spb);
    const prog = opts.reducedMotion ? 1 : easeOut(Math.min(1, local / growFor));
    const fade = opts.reducedMotion ? Math.min(1, local / 0.6) : 1;
    const x1 = X(n.x1);
    const y1 = Y(n.y1);
    const x2 = x1 + (X(n.x2) - x1) * prog;
    const y2 = y1 + (Y(n.y2) - y1) * prog;
    const width = Math.max(0.8, n.length * scale * 0.055);

    ctx.strokeStyle = branchColor(n.level, depth, 0.88 * opts.alpha * fade);
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    // The call that is sounding right now glows, then cools.
    if (local < 1.4) {
      const g = 1 - local / 1.4;
      ctx.save();
      ctx.strokeStyle = `rgba(233,168,107,${0.75 * g * opts.alpha})`;
      ctx.shadowColor = COLORS.glow;
      ctx.shadowBlur = 14 * g;
      ctx.lineWidth = width + 1.5;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.restore();
    }

    if (n.isLeaf) drawLeaf(ctx, n.id, X(n.x2), Y(n.y2), scale, local, opts);
  }
}

function drawLeaf(
  ctx: CanvasRenderingContext2D,
  id: number,
  x: number,
  y: number,
  scale: number,
  local: number,
  opts: DrawOptions,
) {
  const color = COLORS.leaves[Math.floor(hash01(id, 3) * COLORS.leaves.length)];
  const size = (1.8 + hash01(id, 5) * 1.6) * Math.max(0.9, Math.min(2.2, scale * 1.1));
  const open = opts.reducedMotion ? Math.min(1, local / 0.6) : Math.min(1, easeBack(Math.min(1, local / 0.7)));
  const r = Math.max(0, size * open);

  // Halo that blooms when the chime sounds.
  if (local < 3) {
    const k = 1 - local / 3;
    ctx.fillStyle = hexA(color, 0.18 * k * opts.alpha);
    ctx.beginPath();
    ctx.arc(x, y, r * (2 + 3 * (1 - k)), 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = hexA(color, 0.92 * opts.alpha);
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();

  // A few seeds drift outward. Stateless: positions are a function of age.
  if (!opts.reducedMotion && local < 2.6) {
    const k = local / 2.6;
    for (let j = 0; j < 5; j++) {
      const a = hash01(id, 10 + j) * Math.PI * 2;
      const d = (6 + 16 * hash01(id, 20 + j)) * easeOut(k) * Math.max(1, scale);
      ctx.fillStyle = hexA(color, 0.7 * (1 - k) * opts.alpha);
      ctx.beginPath();
      ctx.arc(x + Math.cos(a) * d, y + Math.sin(a) * d - k * 6, 1.1, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function hexA(hex: string, a: number): string {
  const v = parseInt(hex.slice(1), 16);
  return `rgba(${(v >> 16) & 255},${(v >> 8) & 255},${v & 255},${Math.max(0, Math.min(1, a))})`;
}

/** Soft fireflies and a vignette. Cheap, and still when motion is reduced. */
export function drawBackdrop(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, reduced: boolean) {
  ctx.fillStyle = COLORS.ink;
  ctx.fillRect(0, 0, w, h);
  const g = ctx.createRadialGradient(w / 2, h * 0.75, 0, w / 2, h * 0.75, Math.max(w, h) * 0.8);
  g.addColorStop(0, 'rgba(38,58,48,0.55)');
  g.addColorStop(1, 'rgba(14,21,18,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  for (let i = 0; i < 18; i++) {
    const sx = hash01(i, 40);
    const sy = hash01(i, 41);
    const sp = 0.02 + hash01(i, 42) * 0.04;
    const time = reduced ? 0 : t;
    const x = (sx + Math.sin(time * sp + i) * 0.03) * w;
    const y = (sy * 0.85 + Math.cos(time * sp * 1.3 + i * 2) * 0.02) * h;
    const pulse = reduced ? 0.5 : 0.5 + 0.5 * Math.sin(time * (0.4 + sp * 6) + i * 3);
    ctx.fillStyle = `rgba(207,224,195,${0.08 + 0.22 * pulse})`;
    ctx.beginPath();
    ctx.arc(x, y, 1.2 + pulse * 0.6, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** A finished plant on a square card, for the PNG download. */
export function renderPoster(comp: Composition, caption: string, size = 2048): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d')!;
  drawBackdrop(ctx, size, size, 0, true);
  const pad = size * 0.08;
  const view = fitView(comp, { x: pad, y: pad, w: size - pad * 2, h: size - pad * 2.6 });
  drawPlant(ctx, comp, view, { time: null, alpha: 1, reducedMotion: true });
  ctx.fillStyle = 'rgba(232,220,196,0.92)';
  ctx.font = `500 ${Math.round(size * 0.028)}px Fraunces, Georgia, serif`;
  ctx.textAlign = 'center';
  ctx.fillText('Recursion Er Gaan', size / 2, size - pad * 0.95);
  ctx.fillStyle = 'rgba(169,160,142,0.95)';
  ctx.font = `400 ${Math.round(size * 0.014)}px "IBM Plex Mono", ui-monospace, monospace`;
  ctx.fillText(caption, size / 2, size - pad * 0.55);
  return c;
}
