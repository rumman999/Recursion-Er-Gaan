// Renders the README / social images from the real drawing code.
// Needs the dev server running, then:
//   node scripts/shoot.mjs http://localhost:5173/ out 800 600 '[{"eval":"window.__layout=\"wide\";1"},{"evalFile":"scripts/render-hero.js","saveTo":"docs/screenshots/hero.png"},{"eval":"window.__layout=\"square\";1"},{"evalFile":"scripts/render-hero.js","saveTo":"docs/screenshots/hero-square.png"}]'
(async () => {
  const LAYOUT = window.__layout || 'wide';
  const d = await import('/src/viz/draw.ts');
  const m = await import('/src/music/mapping.ts');
  const b = await import('/src/recursion/branch.ts');
  await Promise.all([
    document.fonts.load('500 120px Fraunces'),
    document.fonts.load('italic 400 40px Fraunces'),
    document.fonts.load('400 36px "IBM Plex Sans"'),
    document.fonts.load('400 28px "IBM Plex Mono"'),
    document.fonts.load('500 28px "IBM Plex Mono"'),
  ]);
  await document.fonts.ready;

  const comp = m.compose(
    { depth: 5, branches: 3, spread: 38, ratio: 0.66, wildness: 0.25, seed: 2209 },
    { key: 5, mode: 'lydian', tempo: 66 },
  );
  const { nodes, bounds } = comp.tree;

  const W = LAYOUT === 'wide' ? 2400 : 2160;
  const H = LAYOUT === 'wide' ? 1350 : 2160;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d');

  // Backdrop: ink with a soft glow behind the tree.
  ctx.fillStyle = '#0e1512';
  ctx.fillRect(0, 0, W, H);
  const treeBox =
    LAYOUT === 'wide'
      ? { x: 90, y: 110, w: 1300, h: 1160 }
      : { x: 200, y: 170, w: W - 400, h: 1330 };
  const gcx = treeBox.x + treeBox.w / 2;
  const gcy = treeBox.y + treeBox.h * 0.45;
  const glow = ctx.createRadialGradient(gcx, gcy, 0, gcx, gcy, treeBox.w * 0.75);
  glow.addColorStop(0, 'rgba(44,66,54,0.55)');
  glow.addColorStop(1, 'rgba(14,21,18,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // A few still fireflies.
  for (let i = 0; i < 40; i++) {
    const r = (n) => {
      const x = Math.sin(i * 12.9898 + n * 78.233) * 43758.5453;
      return x - Math.floor(x);
    };
    ctx.fillStyle = `rgba(207,224,195,${0.08 + r(3) * 0.2})`;
    ctx.beginPath();
    ctx.arc(r(1) * W, r(2) * H, 1.2 + r(4) * 1.6, 0, Math.PI * 2);
    ctx.fill();
  }

  const view = d.fitView(comp, treeBox);
  d.drawPlant(ctx, comp, view, { time: null, alpha: 1, reducedMotion: true });

  // Highlight one real call path, trunk to leaf, on the right side of the crown.
  const tx = (bounds.minX + bounds.maxX) / 2 + (bounds.maxX - bounds.minX) * 0.27;
  const ty = bounds.minY + (bounds.maxY - bounds.minY) * 0.12;
  let leaf = null;
  let best = Infinity;
  for (const n of nodes) {
    if (!n.isLeaf) continue;
    const dist = Math.hypot(n.x2 - tx, n.y2 - ty);
    if (dist < best) {
      best = dist;
      leaf = n;
    }
  }
  const path = b.stackOf(nodes, leaf.id);
  const X = (x) => view.ox + x * view.scale;
  const Y = (y) => view.oy + y * view.scale;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.shadowColor = '#e9a86b';
  ctx.shadowBlur = 26;
  for (const n of path) {
    ctx.strokeStyle = 'rgba(233,168,107,0.95)';
    ctx.lineWidth = Math.max(2.5, n.length * view.scale * 0.055) + 1.5;
    ctx.beginPath();
    ctx.moveTo(X(n.x1), Y(n.y1));
    ctx.lineTo(X(n.x2), Y(n.y2));
    ctx.stroke();
  }
  ctx.restore();
  const lx = X(leaf.x2);
  const ly = Y(leaf.y2);
  ctx.fillStyle = 'rgba(233,168,107,0.18)';
  ctx.beginPath();
  ctx.arc(lx, ly, 34, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e9a86b';
  ctx.beginPath();
  ctx.arc(lx, ly, 10, 0, Math.PI * 2);
  ctx.fill();

  // Text.
  const depth = comp.tree.depth;
  const fmtA = (a) => `${a < 0 ? '−' : a > 0 ? '+' : ''}${Math.abs(Math.round(a))}°`;
  const frames = path.map((n) => `grow(${depth - n.level}, ${n.length.toFixed(1)}, ${fmtA(n.angle)})`);

  const drawText = (x, y, maxW, scale) => {
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#8e8878';
    ctx.font = `400 ${26 * scale}px "IBM Plex Mono"`;
    ctx.fillText('RECURSIVE SOUNDSCAPES · HUB’S QUEST, EPOCH 1', x, y);

    ctx.fillStyle = '#e8dcc4';
    ctx.font = `500 ${112 * scale}px Fraunces`;
    ctx.fillText('Recursion', x - 4, y + 140 * scale);
    ctx.fillText('Er Gaan', x - 4, y + 262 * scale);

    ctx.fillStyle = '#b0a792';
    ctx.font = `400 ${36 * scale}px "IBM Plex Sans"`;
    const lines = ['A plant that grows by calling itself.', 'Every call plays a note.'];
    lines.forEach((l, i) => ctx.fillText(l, x, y + (350 + i * 52) * scale));

    let yy = y + 520 * scale;
    ctx.font = `400 ${27 * scale}px "IBM Plex Mono"`;
    frames.forEach((f, i) => {
      const last = i === frames.length - 1;
      ctx.fillStyle = last ? '#e9a86b' : '#b0a792';
      ctx.fillText(f, x + i * 22 * scale, yy);
      yy += 44 * scale;
    });
    ctx.fillStyle = '#9db585';
    ctx.font = `italic 400 ${30 * scale}px Fraunces`;
    ctx.fillText('base case: a leaf, and a soft chime', x, yy + 18 * scale);
  };

  if (LAYOUT === 'wide') {
    drawText(1470, 300, 860, 1);
    ctx.fillStyle = '#8e8878';
    ctx.font = '400 24px "IBM Plex Mono"';
    ctx.fillText('seed 2209 · F lydian · 66 bpm · 364 calls', 1470, 1240);
  } else {
    // Square: title block under the tree, call stack on the right of it.
    ctx.textAlign = 'center';
    ctx.fillStyle = '#e8dcc4';
    ctx.font = '500 118px Fraunces';
    ctx.fillText('Recursion Er Gaan', W / 2, 1680);
    ctx.fillStyle = '#b0a792';
    ctx.font = '400 40px "IBM Plex Sans"';
    ctx.fillText('A plant that grows by calling itself. Every call plays a note.', W / 2, 1770);
    ctx.font = '400 30px "IBM Plex Mono"';
    ctx.fillStyle = '#e9a86b';
    ctx.fillText(frames.at(-1) + '  →  a leaf, a chime', W / 2, 1880);
    ctx.fillStyle = '#8e8878';
    ctx.font = '400 26px "IBM Plex Mono"';
    ctx.fillText('RECURSIVE SOUNDSCAPES · HUB’S QUEST, EPOCH 1', W / 2, 2040);
  }

  return c.toDataURL('image/png');
})().catch((e) => 'ERR ' + e.message);
