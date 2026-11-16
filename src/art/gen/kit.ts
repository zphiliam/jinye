/**
 * 道具生成的公共工具：收尾（晕染 + 裁边 + 枢轴）、石头、叶团、草叶、分叉枝、叶片。
 * 约定：生成器在大画布上以“落脚点” (bx, by) 为原点作画，色层 g、墨线层 l。
 */
import { GenOut, cropAlpha } from './registry';
import { canvas, wash, WashOpts } from './wash';
import { Rand } from './noise';
import { P, smoothClosed, wobble, ellipsePts, taper, quadPts } from './brush';
import { limb, BarkPal } from './assets/pine';

export type Ctx = CanvasRenderingContext2D;
export interface Stage { g: Ctx; l: Ctx; cv: HTMLCanvasElement; lc: HTMLCanvasElement; bx: number; by: number }

export function stage(w: number, h: number, footY = 24): Stage {
  const [cv, g] = canvas(w, h), [lc, l] = canvas(w, h);
  return { g, l, cv, lc, bx: w / 2, by: h - footY };
}
export const W_SMALL: Partial<WashOpts> = { bleed: 1.8, inkAmt: 0.9, edgeR: 3, formR: 10, form: 0.3, pigScale: 12, rimAmt: 0.22, rimW: 1.6 };
export const W_MID: Partial<WashOpts> = { bleed: 2.2, inkAmt: 0.92, edgeR: 3.5, formR: 16, form: 0.32, pigScale: 18, rimAmt: 0.22 };
export const W_TREE: Partial<WashOpts> = { bleed: 2.6, inkAmt: 0.95, edgeR: 5, formR: 28, form: 0.3, pigScale: 28, rimAmt: 0.2 };

/** post：在水墨合成之后再画（细丝等不该被晕染粘连的笔触） */
export function finish(s: Stage, seed: number, o: Partial<WashOpts> = W_SMALL, pivotX?: number, post?: (g: CanvasRenderingContext2D) => void): GenOut {
  const w = wash(s.cv, { seed, ...o, lines: s.lc });
  if (post) post(w.getContext('2d')!);
  const cr = cropAlpha(w, 3);
  return { canvas: cr.canvas, pivot: [((pivotX ?? s.bx) - cr.ox) / cr.canvas.width, (s.by - cr.oy) / cr.canvas.height] };
}

export function fillPts(g: Ctx, col: string, pts: P[], wob = 0, seed = 1, t = 0.5, step = 4) {
  g.fillStyle = col; g.beginPath(); smoothClosed(g, wob ? wobble(pts, wob, seed, step, 0.3) : pts, t); g.fill();
}
export function line(l: Ctx, pts: P[], w = 1, col = 'rgba(20,14,11,0.6)') {
  l.strokeStyle = col; l.lineWidth = w; l.lineCap = 'round'; l.lineJoin = 'round';
  l.beginPath(); l.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) l.lineTo(pts[i][0], pts[i][1]); l.stroke();
}

// —— 石头：剪影 + 迎光切面 + 背光切面 + 裂纹 + 可选苔藓 ——
export interface RockPal { base: string; lit: string; dark: string; moss?: string; mossL?: string }
export const ROCK: RockPal = { base: '#56524c', lit: '#87807a', dark: '#2f2c29', moss: '#55602f', mossL: '#86904a' };
export function rock(st: Stage, cx: number, cy: number, rx: number, ry: number, r: Rand, pal: RockPal = ROCK, o: { tall?: number; moss?: number; angular?: number } = {}) {
  const { g, l } = st, tall = o.tall ?? 1, ang = o.angular ?? 0.5;
  const H = ry * tall, top = cy - H;
  // 剪影：底边平、上部隆起；angular 越大越多棱角
  const peak = (r() - 0.5) * 0.5, j = () => 1 + (r() - 0.5) * 0.12 * (1 + ang);
  const pts: P[] = [
    [cx - rx, cy], [cx - rx * 0.97 * j(), cy - H * 0.42 * j()], [cx - rx * 0.62 * j(), cy - H * 0.86 * j()],
    [cx + rx * peak * 0.5, cy - H], [cx + rx * 0.58 * j(), cy - H * (0.82 - ang * 0.15) * j()], [cx + rx * 0.98 * j(), cy - H * 0.38 * j()],
    [cx + rx, cy], [cx + rx * 0.6, cy + ry * 0.06], [cx, cy + ry * 0.09], [cx - rx * 0.6, cy + ry * 0.06],
  ];
  const path = new Path2D(); smoothClosed(path, wobble(pts, 1.2, Math.floor(r() * 1e5), 6, 0.2), 0.6 - ang * 0.45);
  g.fillStyle = pal.base; g.fill(path);
  g.save(); g.clip(path);
  // 背光块（右下）与迎光块（左上），边界略带棱
  const px = cx + rx * (0.1 + peak * 0.5);
  g.fillStyle = pal.dark; g.beginPath();
  smoothClosed(g, wobble([[px, top - 6], [cx + rx * 1.3, top], [cx + rx * 1.3, cy + ry], [cx - rx * 1.3, cy + ry], [cx - rx * 1.3, cy - H * 0.12], [cx - rx * 0.2, cy - H * 0.2], [px + rx * 0.1, cy - H * 0.55]], 1.5, 7, 8), 0.2 + (1 - ang) * 0.3); g.fill();
  g.fillStyle = pal.lit; g.beginPath();
  smoothClosed(g, wobble([[cx - rx * 0.85, cy - H * 0.35], [cx - rx * 0.55, top + H * 0.15], [px - rx * 0.05, top + H * 0.05], [px - rx * 0.12, cy - H * 0.6], [cx - rx * 0.5, cy - H * 0.3]], 1.2, 9, 8), 0.2 + (1 - ang) * 0.35); g.fill();
  if (o.moss && pal.moss) {
    for (let i = 0; i < 3 + o.moss * 4; i++) {
      const x = cx + (r() - 0.6) * rx * 1.1, y = top + H * (0.08 + r() * 0.35), s = rx * (0.1 + r() * 0.14) * (0.6 + o.moss * 0.4);
      fillPts(g, pal.moss, ellipsePts(x, y, s * 1.4, s * 0.6, 9, (r() - 0.5) * 0.4, 0.25, r), 0.8, i + 3);
      fillPts(g, pal.mossL!, ellipsePts(x - s * 0.3, y - s * 0.22, s * 0.7, s * 0.28, 7, 0, 0.2, r), 0, i);
    }
  }
  g.restore();
  for (let i = 0; i < 2; i++) {
    const x0 = cx + (r() - 0.5) * rx, y0 = top + H * (0.25 + r() * 0.3);
    line(l, [[x0, y0], [x0 + (r() - 0.3) * rx * 0.25, y0 + H * 0.2], [x0 + (r() - 0.5) * rx * 0.3, y0 + H * 0.42]], 1 + r() * 0.5);
  }
  return path;
}

// —— 叶团：若干圆团求并，边缘缀叶片 ——
export interface LeafPal { deep: string; mid: string; lit: string; hi: string; ink?: string }
export function leafShape(g: Ctx, x: number, y: number, len: number, wid: number, ang: number) {
  const c = Math.cos(ang), s = Math.sin(ang);
  g.beginPath(); g.moveTo(x, y);
  g.quadraticCurveTo(x + c * len * 0.5 - s * wid, y + s * len * 0.5 + c * wid, x + c * len, y + s * len);
  g.quadraticCurveTo(x + c * len * 0.5 + s * wid, y + s * len * 0.5 - c * wid, x, y);
  g.fill();
}
export function foliage(st: Stage, cx: number, cy: number, rad: number, pal: LeafPal, r: Rand, o: { n?: number; flat?: number; leaf?: number; under?: string } = {}) {
  const { g, l } = st, n = o.n ?? 5, flat = o.flat ?? 0.8, leaf = o.leaf ?? rad * 0.22;
  const C: [number, number, number][] = [];
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2, d = rad * 0.5 * Math.sqrt(r());
    C.push([cx + Math.cos(a) * d, cy + Math.sin(a) * d * flat, rad * (0.42 + r() * 0.25)]);
  }
  const path = new Path2D(), sd = Math.floor(r() * 1e5);
  C.forEach(([x, y, rr], i) => smoothClosed(path, wobble(ellipsePts(x, y, rr, rr * flat, 14, 0, 0.1, r), 1.5, sd + i, 4, 0.3)));
  if (o.under) { g.save(); g.translate(-1, 3.5); g.fillStyle = o.under; g.fill(path); g.restore(); }
  g.fillStyle = pal.deep; g.fill(path);
  // 外缘叶片（色层：成为轮廓的一部分）
  g.fillStyle = pal.deep;
  C.forEach(([x, y, rr]) => { for (let k = 0; k < 7; k++) { const a = Math.PI * (0.9 + r() * 1.25); leafShape(g, x + Math.cos(a) * rr * 0.85, y + Math.sin(a) * rr * flat * 0.85, leaf * (0.8 + r() * 0.5), leaf * 0.32, a + (r() - 0.5) * 0.6); } });
  g.save(); g.clip(path);
  g.fillStyle = pal.mid;
  C.forEach(([x, y, rr], i) => { g.beginPath(); smoothClosed(g, wobble(ellipsePts(x - rr * 0.15, y - rr * 0.3 * flat, rr * 0.8, rr * 0.65 * flat, 12, 0, 0.1, r), 1.4, sd + 30 + i, 4, 0.3)); g.fill(); });
  g.fillStyle = pal.lit;
  C.forEach(([x, y, rr], i) => { if (x > cx + rad * 0.2 && r() < 0.7) return; g.beginPath(); smoothClosed(g, wobble(ellipsePts(x - rr * 0.32, y - rr * 0.48 * flat, rr * 0.46, rr * 0.32 * flat, 10, -0.2, 0.12, r), 1.2, sd + 60 + i, 4, 0.3)); g.fill(); });
  // 亮部叶片
  g.fillStyle = pal.hi;
  C.forEach(([x, y, rr]) => { if (x > cx + rad * 0.25) return; for (let k = 0; k < 3; k++) leafShape(g, x - rr * (0.2 + r() * 0.4), y - rr * flat * (0.35 + r() * 0.3), leaf * 0.8, leaf * 0.26, -Math.PI * (0.55 + r() * 0.5)); });
  g.restore();
  // 墨线：团与团的分界
  l.save(); l.strokeStyle = pal.ink ?? 'rgba(20,14,11,0.5)'; l.lineCap = 'round';
  C.forEach(([x, y, rr], i) => { if (i === 0) return; l.lineWidth = 1; l.beginPath(); l.ellipse(x, y, rr * 0.92, rr * flat * 0.92, 0, Math.PI * 0.55, Math.PI * 1.05); l.stroke(); });
  l.restore();
  return path;
}

/** 疏叶簇：小实心芯 + 大量散叶（桦、杨这类透气的树冠） */
export function leafCluster(st: Stage, cx: number, cy: number, rad: number, pal: LeafPal, r: Rand, leaf = rad * 0.3) {
  const { g } = st;
  fillPts(g, pal.deep, ellipsePts(cx, cy + rad * 0.1, rad * 0.55, rad * 0.42, 10, 0, 0.2, r), 1.5, Math.floor(r() * 1e4));
  const L: [number, number, number, number][] = [];
  for (let i = 0; i < 46; i++) {
    const a = r() * Math.PI * 2, d = rad * Math.sqrt(r());
    const x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d * 0.82;
    L.push([x, y, a + (r() - 0.5) * 1.2, (x - cx) / rad * 0.6 + (y - cy) / rad]);   // 最后一项：朝右下 → 越暗
  }
  L.sort((a, b) => b[3] - a[3]);   // 暗叶先画，亮叶压上
  for (const [x, y, a, k] of L) {
    g.fillStyle = k > 0.45 ? pal.deep : k > 0 ? pal.mid : k > -0.5 ? pal.lit : pal.hi;
    leafShape(g, x, y, leaf * (0.8 + r() * 0.5), leaf * 0.36, a);
  }
}

// —— 草叶 / 茎：沿二次曲线的渐细笔触 ——
export function blade(g: Ctx, base: P, tip: P, bend: number, w: number, col: string) {
  const mx = (base[0] + tip[0]) / 2 + bend, my = (base[1] + tip[1]) / 2;
  g.fillStyle = col; taper(g, quadPts(base, [mx, my], tip, 10), (t) => w * (1 - t) + 0.25);
}
/** 一簇草：n 片叶，从 (x,y) 向上扇形散开 */
export function tuft(g: Ctx, x: number, y: number, h: number, spread: number, n: number, cols: string[], r: Rand, w = 2.2) {
  const order = Array.from({ length: n }, (_, i) => i).sort(() => r() - 0.5);
  for (const i of order) {
    const f = n === 1 ? 0 : i / (n - 1) * 2 - 1, hh = h * (0.6 + 0.4 * (1 - Math.abs(f)) + (r() - 0.5) * 0.25);
    const tip: P = [x + f * spread + (r() - 0.5) * spread * 0.3, y - hh];
    blade(g, [x + f * w * 1.5, y], tip, f * spread * 0.35 + (r() - 0.5) * 4, w * (0.8 + r() * 0.4), cols[Math.floor(r() * cols.length)]);
  }
}

// —— 分叉枝（递归）——
export function branches(st: Stage, p: P, ang: number, len: number, w: number, depth: number, r: Rand, pal: BarkPal, onTip?: (p: P, ang: number, depth: number) => void, twist = 0.35) {
  const c: P = [p[0] + Math.cos(ang + (r() - 0.5) * twist) * len * 0.5, p[1] + Math.sin(ang + (r() - 0.5) * twist) * len * 0.5];
  const e: P = [p[0] + Math.cos(ang) * len, p[1] + Math.sin(ang) * len];
  limb(st.g, st.l, quadPts(p, c, e, 8), (t) => w * (1 - t * 0.55) + 0.6, r, w > 5, pal);
  if (depth <= 0 || w < 1.2) { onTip?.(e, ang, depth); return; }
  const k = 2 + (r() < 0.35 ? 1 : 0);
  for (let i = 0; i < k; i++) {
    const a = ang + (i / (k - 1 || 1) - 0.5) * (0.9 + r() * 0.4) + (r() - 0.5) * 0.25;
    branches(st, e, a, len * (0.62 + r() * 0.18), w * 0.6, depth - 1, r, pal, onTip, twist);
  }
  onTip?.(e, ang, depth);
}
export { limb };
export type { BarkPal };
