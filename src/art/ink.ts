// 「烬野」共享木刻版画美术系统：所有素材都经由这里的笔触、刻痕、描边与纸纹，保证出自同一只手
import { RNG, mulberry32, vnoise, clamp } from '../util/rng';

export const PAL = {
  ink: '#16110d', ink2: '#241c16', ink3: '#3b2f26', inkBlue: '#1b2126',
  paper: '#ebdfc4', paper2: '#d9c7a1', paperDark: '#b09a70',
  blood: '#8e2b1f', bloodDeep: '#561611', bloodLight: '#bd4a30',
  copper: '#4c7566', copperLight: '#86ab95', copperDeep: '#26413a',
  bone: '#e8dec6', boneShade: '#b9a986', boneDeep: '#8a7a5c',
  ember: '#eaa23a', emberHot: '#ffe1a0', emberDeep: '#b5531b',
  moss: '#4e5c2f', mossLight: '#808c45', mossDeep: '#2a3419',
  ochre: '#a68240', ochreLight: '#cfa95e', ochreDeep: '#6e5223',
  shale: '#6f6c63', shaleLight: '#9e998c', shaleDeep: '#3d3b36',
  swamp: '#2e3a33', swampLight: '#5a6a55',
  bark: '#3d2b1f', barkLight: '#6e4d34', barkDeep: '#21170f',
};

export type Pt = [number, number];
export type Ctx = CanvasRenderingContext2D;

export function makeCanvas(w: number, h: number): [HTMLCanvasElement, Ctx] {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  const ctx = c.getContext('2d', { willReadFrequently: false })!;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  return [c, ctx];
}

/** Catmull-Rom 平滑采样 */
export function smoothPts(pts: Pt[], seg = 6, closed = false): Pt[] {
  const out: Pt[] = [];
  const n = pts.length;
  if (n < 3) return pts.slice();
  const get = (i: number) => (closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]);
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const p0 = get(i - 1), p1 = get(i), p2 = get(i + 1), p3 = get(i + 2);
    for (let s = 0; s < seg; s++) {
      const t = s / seg, t2 = t * t, t3 = t2 * t;
      out.push([
        0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
        0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
      ]);
    }
  }
  if (!closed) out.push(pts[n - 1]);
  return out;
}

export interface BrushOpts {
  taper?: [number, number]; // 起笔/收笔粗细比例
  jitter?: number;          // 粗细抖动
  seed?: number;
  alpha?: number;
  smooth?: boolean;
}

/** 毛笔/刻刀笔触：沿路径生成粗细变化的填充多边形 */
export function brush(ctx: Ctx, pts: Pt[], w: number, color: string, o: BrushOpts = {}) {
  const P = o.smooth === false ? pts : smoothPts(pts, 5);
  if (P.length < 2) return;
  const [t0, t1] = o.taper ?? [0.15, 0.1];
  const jit = o.jitter ?? 0.25;
  const seed = o.seed ?? 7;
  const L: Pt[] = [], R: Pt[] = [];
  const n = P.length;
  for (let i = 0; i < n; i++) {
    const a = P[Math.max(0, i - 1)], b = P[Math.min(n - 1, i + 1)];
    let dx = b[0] - a[0], dy = b[1] - a[1];
    const len = Math.hypot(dx, dy) || 1;
    dx /= len; dy /= len;
    const t = i / (n - 1);
    // 起笔压入、收笔提起
    const prof = Math.min(1, t / 0.18) * (1 - t0) + t0;
    const prof2 = Math.min(1, (1 - t) / 0.3) * (1 - t1) + t1;
    const ww = (w / 2) * Math.min(prof, prof2) * (1 + jit * (vnoise(i * 0.35, seed, seed) - 0.5) * 2);
    L.push([P[i][0] - dy * ww, P[i][1] + dx * ww]);
    R.push([P[i][0] + dy * ww, P[i][1] - dx * ww]);
  }
  ctx.save();
  if (o.alpha !== undefined) ctx.globalAlpha *= o.alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(L[0][0], L[0][1]);
  for (let i = 1; i < n; i++) ctx.lineTo(L[i][0], L[i][1]);
  for (let i = n - 1; i >= 0; i--) ctx.lineTo(R[i][0], R[i][1]);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** 不规则闭合形（手刻边缘的椭圆） */
export function blobPath(cx: number, cy: number, rx: number, ry: number, rough: number, r: RNG, n = 22, rot = 0): Path2D {
  const pts: Pt[] = [];
  const ph = r() * 100;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const k = 1 + rough * (vnoise(Math.cos(a) * 1.7 + ph, Math.sin(a) * 1.7 + ph) - 0.5) * 2 + rough * 0.3 * (r() - 0.5);
    const x = Math.cos(a) * rx * k, y = Math.sin(a) * ry * k;
    pts.push([cx + x * Math.cos(rot) - y * Math.sin(rot), cy + x * Math.sin(rot) + y * Math.cos(rot)]);
  }
  return polyPath(smoothPts(pts, 4, true), true);
}

export function polyPath(pts: Pt[], closed = true): Path2D {
  const p = new Path2D();
  p.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) p.lineTo(pts[i][0], pts[i][1]);
  if (closed) p.closePath();
  return p;
}

export function smoothPath(pts: Pt[], closed = true): Path2D {
  return polyPath(smoothPts(pts, 6, closed), closed);
}

export interface Box { x: number; y: number; w: number; h: number }

/** 版画排线：剪裁在形内，以断续的、宽窄不一的线条画出暗部 */
export function hatch(ctx: Ctx, clip: Path2D, box: Box, o: { angle?: number; gap?: number; w?: number; color?: string; alpha?: number; r: RNG; break?: number; mask?: (x: number, y: number) => number }) {
  const ang = o.angle ?? -0.9;
  const gap = o.gap ?? 4;
  const w = o.w ?? 1.4;
  ctx.save();
  ctx.clip(clip);
  ctx.globalAlpha *= o.alpha ?? 0.8;
  const cx = box.x + box.w / 2, cy = box.y + box.h / 2;
  const diag = Math.hypot(box.w, box.h) / 2 + 4;
  const ca = Math.cos(ang), sa = Math.sin(ang);
  for (let d = -diag; d <= diag; d += gap * (0.75 + o.r() * 0.5)) {
    // 每条线分段，按 mask 决定浓淡
    const segs = 10;
    let run: Pt[] = [];
    for (let s = 0; s <= segs; s++) {
      const t = -diag + (2 * diag * s) / segs;
      const x = cx + ca * t - sa * d, y = cy + sa * t + ca * d;
      const m = o.mask ? o.mask(x, y) : 1;
      const on = m > 0.5 - (o.r() - 0.5) * (o.break ?? 0.3);
      if (on) run.push([x, y]);
      if ((!on || s === segs) && run.length > 1) {
        brush(ctx, run, w * (0.6 + o.r() * 0.8), o.color ?? PAL.ink, { taper: [0.2, 0.2], jitter: 0.5, seed: Math.floor(o.r() * 999), smooth: false });
        run = [];
      } else if (!on) run = [];
    }
  }
  ctx.restore();
}

/** 刻刀挑白：在暗面上刻出浅色短痕（木刻的灵魂） */
export function gouges(ctx: Ctx, clip: Path2D | null, o: { r: RNG; count: number; area: (r: RNG) => Pt; len: [number, number]; w: [number, number]; angle: (x: number, y: number, r: RNG) => number; color: string; alpha?: number; curve?: number }) {
  ctx.save();
  if (clip) ctx.clip(clip);
  ctx.globalAlpha *= o.alpha ?? 0.9;
  for (let i = 0; i < o.count; i++) {
    const [x, y] = o.area(o.r);
    const a = o.angle(x, y, o.r);
    const L = o.len[0] + o.r() * (o.len[1] - o.len[0]);
    const c = (o.curve ?? 0.25) * (o.r() - 0.5) * L;
    const mx = x + Math.cos(a) * L * 0.5 - Math.sin(a) * c, my = y + Math.sin(a) * L * 0.5 + Math.cos(a) * c;
    brush(ctx, [[x, y], [mx, my], [x + Math.cos(a) * L, y + Math.sin(a) * L]], o.w[0] + o.r() * (o.w[1] - o.w[0]), o.color, { taper: [0.1, 0.05], jitter: 0.3, seed: i });
  }
  ctx.restore();
}

/** 边缘光：形状朝光一侧的月牙亮边 */
export function rimLight(ctx: Ctx, path: Path2D, dx: number, dy: number, color: string, alpha = 0.9) {
  const W = ctx.canvas.width, H = ctx.canvas.height;
  const [tc, t] = makeCanvas(W, H);
  t.fillStyle = color;
  t.fill(path);
  t.globalCompositeOperation = 'destination-out';
  t.translate(dx, dy);
  t.fill(path);
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.clip(path);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(tc, 0, 0);
  ctx.restore();
  void tc;
}

/** 形体内的明暗渐变（从光面到暗面） */
export function shadeFill(ctx: Ctx, path: Path2D, x0: number, y0: number, x1: number, y1: number, stops: [number, string][]) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  for (const [o, c] of stops) g.addColorStop(o, c);
  ctx.fillStyle = g;
  ctx.fill(path);
}

let grainCanvas: HTMLCanvasElement | null = null;
export function grainTile(): HTMLCanvasElement {
  if (grainCanvas) return grainCanvas;
  const S = 256;
  const [c, ctx] = makeCanvas(S, S);
  const img = ctx.createImageData(S, S);
  const r = mulberry32(99);
  for (let i = 0; i < S * S; i++) {
    const x = i % S, y = (i / S) | 0;
    const fiber = vnoise(x * 0.08, y * 0.9, 3) * 0.5 + vnoise(x * 0.5, y * 0.05, 5) * 0.5;
    const v = 128 + (r() - 0.5) * 90 + (fiber - 0.5) * 60;
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = clamp(v, 0, 255);
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  grainCanvas = c;
  return c;
}

/** 在已绘制形体上叠加纸纹/刷痕颗粒（只作用于不透明处） */
export function applyGrain(ctx: Ctx, amount = 0.18) {
  const W = ctx.canvas.width, H = ctx.canvas.height;
  const [tc, t] = makeCanvas(W, H);
  t.fillStyle = t.createPattern(grainTile(), 'repeat')!;
  t.fillRect(0, 0, W, H);
  t.globalCompositeOperation = 'destination-in';
  t.drawImage(ctx.canvas, 0, 0);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = amount;
  ctx.drawImage(tc, 0, 0);
  ctx.restore();
}

/** 手墨描边：把形体剪影向四周偏移叠印，粗细随方向变化（下侧更重） */
export function inkOutline(src: HTMLCanvasElement, thick: number, color = PAL.ink, seed = 1): HTMLCanvasElement {
  const pad = Math.ceil(thick * 1.6) + 1;
  const [sil, sctx] = makeCanvas(src.width, src.height);
  sctx.drawImage(src, 0, 0);
  sctx.globalCompositeOperation = 'source-in';
  sctx.fillStyle = color;
  sctx.fillRect(0, 0, src.width, src.height);
  const [out, o] = makeCanvas(src.width, src.height);
  const r = mulberry32(seed);
  const N = 16;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    const down = Math.sin(a) > 0 ? 1 + Math.sin(a) * 0.45 : 1 + Math.sin(a) * 0.25;
    const k = thick * down * (0.8 + r() * 0.4);
    o.drawImage(sil, Math.cos(a) * k, Math.sin(a) * k);
  }
  o.drawImage(src, 0, 0);
  void pad;
  return out;
}

/** 由 SVG 字符串栅格化（异步），用于 UI 图标与装饰 */
export function svgToImage(svg: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  });
}

/** 地面接触阴影（画在素材自身底部的墨晕） */
export function contactShadow(ctx: Ctx, cx: number, cy: number, rx: number, ry: number, alpha = 0.35) {
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rx);
  g.addColorStop(0, `rgba(22,17,13,${alpha})`);
  g.addColorStop(1, 'rgba(22,17,13,0)');
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(1, ry / rx);
  ctx.translate(-cx, -cy);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, rx, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function mix(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ch = (p: number, sh: number) => (p >> sh) & 255;
  const m = (sh: number) => Math.round(ch(pa, sh) + (ch(pb, sh) - ch(pa, sh)) * t);
  return '#' + ((1 << 24) + (m(16) << 16) + (m(8) << 8) + m(0)).toString(16).slice(1);
}

export function rgba(hex: string, a: number): string {
  const p = parseInt(hex.slice(1), 16);
  return `rgba(${(p >> 16) & 255},${(p >> 8) & 255},${p & 255},${a})`;
}
