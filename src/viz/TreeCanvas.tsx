import { useEffect, useRef } from 'react';
import { player } from '../music/player';
import { useStore } from '../state/store';
import { drawBackdrop, drawPlant, fitView } from './draw';
import { useReducedMotion } from './useReducedMotion';

export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/** Full-bleed canvas. Reads the audio clock every frame so the plant grows exactly with the sound. */
export function TreeCanvas({ insets }: { insets: Insets }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const insetsRef = useRef(insets);
  insetsRef.current = insets;
  const reduced = useReducedMotion();
  const reducedRef = useRef(reduced);
  reducedRef.current = reduced;

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext('2d')!;
    let raf = 0;
    const t0 = performance.now();

    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(canvas.clientWidth * dpr);
      canvas.height = Math.round(canvas.clientHeight * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const frame = () => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      const ins = insetsRef.current;
      const box = {
        x: ins.left + 24,
        y: ins.top + 16,
        w: Math.max(60, w - ins.left - ins.right - 48),
        h: Math.max(60, h - ins.top - ins.bottom - 24),
      };
      const rm = reducedRef.current;
      drawBackdrop(ctx, w, h, (performance.now() - t0) / 1000, rm);

      const { status, comp } = useStore.getState();
      const cur = player.current;
      if (status === 'idle' || status === 'loading' || !cur) {
        // Before playing: a faint sketch of the plant you are about to hear.
        drawPlant(ctx, comp, fitView(comp, box), { time: null, alpha: status === 'loading' ? 0.3 : 0.2, reducedMotion: true });
      } else {
        const now = player.now();
        const prev = player.previous;
        if (prev) {
          const fade = 1 - (now - cur.offset) / 6;
          if (fade > 0) {
            drawPlant(ctx, prev.comp, fitView(prev.comp, box), { time: null, alpha: fade * 0.9, reducedMotion: true });
          }
        }
        drawPlant(ctx, cur.comp, fitView(cur.comp, box), { time: now - cur.offset, alpha: 1, reducedMotion: rm });
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={ref}
      id="plant-canvas"
      className="fixed inset-0 h-full w-full"
      role="img"
      aria-label="A fractal plant that grows one branch per recursive call, in time with the music"
    />
  );
}
