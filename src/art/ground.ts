// 可无缝平铺的地表纹理：林地苔土、空地草甸、页岩碎石、沼泽泥沼、土径
import { PAL, makeCanvas, brush, blobPath, mix, rgba, Ctx } from './ink';
import { mulberry32, tileFbm, RNG, range } from '../util/rng';

const S = 512;

function base(ctx: Ctx, c0: string, c1: string, seed: number, scale = 6) {
  const img = ctx.createImageData(S, S);
  const a = parseInt(c0.slice(1), 16), b = parseInt(c1.slice(1), 16);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const n = tileFbm((x / S) * scale, (y / S) * scale, scale, seed, 5);
    const t = Math.min(1, Math.max(0, (n - 0.3) * 2.2));
    const i = (y * S + x) * 4;
    img.data[i] = ((a >> 16) & 255) * (1 - t) + ((b >> 16) & 255) * t;
    img.data[i + 1] = ((a >> 8) & 255) * (1 - t) + ((b >> 8) & 255) * t;
    img.data[i + 2] = (a & 255) * (1 - t) + (b & 255) * t;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}

/** 在环绕的 9 个位置绘制，保证无缝 */
function wrap(ctx: Ctx, x: number, y: number, rad: number, fn: (ox: number, oy: number) => void) {
  for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) {
    if (x + ox < -rad || x + ox > S + rad || y + oy < -rad || y + oy > S + rad) continue;
    ctx.save(); ctx.translate(ox, oy); fn(x, y); ctx.restore();
  }
}

function strokes(ctx: Ctx, r: RNG, n: number, len: [number, number], w: [number, number], cols: string[], ang: (r: RNG) => number, alpha = 1) {
  for (let i = 0; i < n; i++) {
    const x = r() * S, y = r() * S, a = ang(r), L = range(r, len[0], len[1]);
    const col = cols[Math.floor(r() * cols.length)];
    const ww = range(r, w[0], w[1]);
    const bend = (r() - 0.5) * L * 0.4;
    wrap(ctx, x, y, L, (px, py) => brush(ctx, [[px, py], [px + Math.cos(a) * L * 0.5 - Math.sin(a) * bend, py + Math.sin(a) * L * 0.5 + Math.cos(a) * bend], [px + Math.cos(a) * L, py + Math.sin(a) * L]], ww, col, { taper: [0.3, 0.1], alpha }));
  }
}

function blobs(ctx: Ctx, r: RNG, n: number, rad: [number, number], cols: string[], alpha: number, flat = 1) {
  for (let i = 0; i < n; i++) {
    const x = r() * S, y = r() * S, rr = range(r, rad[0], rad[1]);
    const col = cols[Math.floor(r() * cols.length)];
    const p = blobPath(0, 0, rr, rr * flat, 0.35, r, 14, r() * 6);
    wrap(ctx, x, y, rr, (px, py) => { ctx.save(); ctx.translate(px, py); ctx.globalAlpha = alpha; ctx.fillStyle = col; ctx.fill(p); ctx.restore(); });
  }
}

export function groundForest(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(S, S); const r = mulberry32(11);
  base(ctx, '#3a3220', '#22261a', 3, 5);
  blobs(ctx, r, 40, [20, 60], [PAL.mossDeep, '#2c3a1e', '#3b4424'], 0.55, 0.7);
  strokes(ctx, r, 900, [8, 18], [1.2, 2.2], ['#5a4a2c', '#6b5733', '#2a2014', '#7a6a3c'], (rr) => rr() * 6.28, 0.85);
  strokes(ctx, r, 300, [5, 10], [2, 3.5], [PAL.moss, PAL.mossLight, '#59692f'], (rr) => -1.57 + (rr() - 0.5) * 1.2, 0.75);
  // 小枝与松果
  for (let i = 0; i < 40; i++) { const x = r() * S, y = r() * S; wrap(ctx, x, y, 20, (px, py) => brush(ctx, [[px, py], [px + 14, py + (r() - 0.5) * 8], [px + 24, py + 3]], 2.4, PAL.barkDeep, {})); }
  for (let i = 0; i < 25; i++) { const x = r() * S, y = r() * S; wrap(ctx, x, y, 8, (px, py) => { ctx.fillStyle = PAL.barkLight; ctx.beginPath(); ctx.ellipse(px, py, 4, 6, r(), 0, 6.28); ctx.fill(); ctx.strokeStyle = PAL.ink; ctx.lineWidth = 1.2; ctx.stroke(); }); }
  return c;
}

export function groundGrass(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(S, S); const r = mulberry32(12);
  base(ctx, '#7c6e3e', '#565a2c', 5, 4);
  blobs(ctx, r, 30, [30, 70], ['#8a7a44', '#5d6430', '#6e6a36'], 0.4, 0.6);
  strokes(ctx, r, 2200, [7, 15], [1.2, 2.4], ['#9a8a4c', '#a8975a', '#5f6332', '#4d5228', '#b2a062', '#6f7a3a'], (rr) => -1.57 + (rr() - 0.5) * 0.9, 0.9);
  strokes(ctx, r, 260, [6, 12], [1.2, 2], [PAL.ink2], (rr) => -1.57 + (rr() - 0.5) * 0.9, 0.35);
  for (let i = 0; i < 50; i++) { const x = r() * S, y = r() * S; const col = [PAL.bone, PAL.bloodLight, PAL.ochreLight][i % 3]; wrap(ctx, x, y, 4, (px, py) => { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(px, py, 2.2, 0, 6.28); ctx.fill(); }); }
  return c;
}

export function groundRock(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(S, S); const r = mulberry32(13);
  base(ctx, '#77705f', '#5a5649', 7, 5);
  // 页岩裂纹（片状）
  for (let i = 0; i < 70; i++) {
    const x = r() * S, y = r() * S, w = range(r, 30, 80), h = w * range(r, 0.3, 0.6);
    const p = blobPath(0, 0, w, h, 0.25, r, 8, range(r, -0.3, 0.3));
    const col = mix('#8a8372', '#5e584a', r());
    wrap(ctx, x, y, w, (px, py) => {
      ctx.save(); ctx.translate(px, py);
      ctx.fillStyle = col; ctx.globalAlpha = 0.6; ctx.fill(p);
      ctx.globalAlpha = 0.8; ctx.strokeStyle = PAL.ink2; ctx.lineWidth = 1.5; ctx.stroke(p);
      ctx.restore();
    });
  }
  strokes(ctx, r, 120, [20, 50], [1, 2], [PAL.ink2], (rr) => (rr() - 0.5) * 0.6, 0.6);
  // 碎石
  for (let i = 0; i < 160; i++) {
    const x = r() * S, y = r() * S, s = range(r, 2.5, 7);
    wrap(ctx, x, y, s * 2, (px, py) => {
      ctx.fillStyle = PAL.ink2; ctx.beginPath(); ctx.ellipse(px, py + 1.5, s + 1.5, s * 0.7 + 1.5, 0, 0, 6.28); ctx.fill();
      ctx.fillStyle = mix(PAL.shaleLight, PAL.shale, r()); ctx.beginPath(); ctx.ellipse(px, py, s, s * 0.7, 0, 0, 6.28); ctx.fill();
      ctx.fillStyle = rgba(PAL.paper, 0.5); ctx.beginPath(); ctx.ellipse(px - s * 0.3, py - s * 0.25, s * 0.35, s * 0.2, 0, 0, 6.28); ctx.fill();
    });
  }
  blobs(ctx, r, 60, [2, 5], [PAL.ochreLight, PAL.copperLight], 0.5);
  return c;
}

export function groundSwamp(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(S, S); const r = mulberry32(14);
  base(ctx, '#2d3229', '#1a201d', 9, 4);
  // 水洼
  for (let i = 0; i < 22; i++) {
    const x = r() * S, y = r() * S, w = range(r, 25, 70);
    const p = blobPath(0, 0, w, w * 0.55, 0.3, r, 16);
    wrap(ctx, x, y, w, (px, py) => {
      ctx.save(); ctx.translate(px, py);
      ctx.fillStyle = '#121a1a'; ctx.globalAlpha = 0.85; ctx.fill(p);
      ctx.globalAlpha = 0.5; ctx.strokeStyle = '#4d5d50'; ctx.lineWidth = 2; ctx.stroke(p);
      ctx.globalAlpha = 0.35;
      for (let k = 0; k < 3; k++) brush(ctx, [[-w * 0.5, -w * 0.15 + k * 6], [w * 0.1, -w * 0.18 + k * 6]], 1.5, PAL.copperLight, {});
      ctx.restore();
    });
  }
  strokes(ctx, r, 900, [8, 18], [1.4, 2.6], ['#3c4a36', '#4b5a40', '#26302a', '#59684a'], (rr) => -1.57 + (rr() - 0.5) * 1.4, 0.8);
  blobs(ctx, r, 80, [3, 8], ['#5d7048', '#6b7d4f'], 0.45);
  return c;
}

export function groundDirt(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(S, S); const r = mulberry32(15);
  base(ctx, '#7a6142', '#5b4730', 21, 6);
  strokes(ctx, r, 500, [6, 14], [1.2, 2.2], ['#8e7550', '#4a3a26', '#9a8460'], (rr) => (rr() - 0.5) * 0.5, 0.7);
  for (let i = 0; i < 70; i++) {
    const x = r() * S, y = r() * S, s = range(r, 2, 5);
    wrap(ctx, x, y, s * 2, (px, py) => { ctx.fillStyle = PAL.ink2; ctx.beginPath(); ctx.ellipse(px, py + 1, s + 1, s * 0.7 + 1, 0, 0, 6.28); ctx.fill(); ctx.fillStyle = PAL.shaleLight; ctx.beginPath(); ctx.ellipse(px, py, s, s * 0.7, 0, 0, 6.28); ctx.fill(); });
  }
  return c;
}

/** 噪声纹理（地表混合扰动、宏观明暗） */
export function noiseTexCanvas(): HTMLCanvasElement {
  const N = 256;
  const [c, ctx] = makeCanvas(N, N);
  const img = ctx.createImageData(N, N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = (y * N + x) * 4;
    img.data[i] = tileFbm(x / N * 4, y / N * 4, 4, 1, 5) * 255;
    img.data[i + 1] = tileFbm(x / N * 8, y / N * 8, 8, 2, 4) * 255;
    img.data[i + 2] = tileFbm(x / N * 16, y / N * 16, 16, 3, 3) * 255;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}
