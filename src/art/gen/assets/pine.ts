/**
 * 松树（两种原型，皆为“剪影 + 三阶色块 + 墨晕”）：
 *  - pad：中国画式的“云片松”——扭动的树干、横枝、顶端扁平的松针云团
 *  - spire：层叠下垂的针叶塔（云杉 / 冷杉感）
 * 种子控制：高度、扭动、偏冠、层数、云团数量与大小。
 */
import { register, cropAlpha, GenOut } from '../registry';
import { rng, Rand } from '../noise';
import { canvas, wash } from '../wash';
import { P, smoothClosed, wobble, ellipsePts, taper, quadPts } from '../brush';

const U = 74; // 像素 / 世界单位（与手绘松树一致）
export const PINE = {
  under: '#0d1814', deep: '#163126', mid: '#234e3a', lit: '#386a4a', hi: '#7c9f68',
  bark: '#5b3424', barkD: '#331b13', barkL: '#93593a', ink: 'rgba(22,14,10,0.62)',
};
/** 云片松用的暖绿（偏橄榄、少青）；针叶塔仍用 PINE */
const PADP = { under: '#122017', deep: '#1d3826', mid: '#2e5434', lit: '#4b7541', hi: '#8fae63', ink: 'rgba(22,14,10,0.62)' };
const PAD_BARK: BarkPal = { bark: '#6e3322', barkD: '#3a1910', barkL: '#a9593a', ink: 'rgba(22,12,8,0.62)' };
type Ctx = CanvasRenderingContext2D;
const PINE_BARK: BarkPal = { bark: '#5b3424', barkD: '#331b13', barkL: '#93593a', ink: 'rgba(22,14,10,0.62)' };

export interface PineCfg { kind: 'pad' | 'spire'; h: number; w: number; lean: number; tiers?: number; pads?: number }

/** 松针扇：自 (x,y) 向 ang 方向张开的一簇短笔 */
export function needleFan(g: Ctx, x: number, y: number, ang: number, len: number, n: number, spread: number, r: Rand, lw = 1.1) {
  g.lineCap = 'round'; g.lineWidth = lw;
  g.beginPath();
  for (let i = 0; i < n; i++) {
    const a = ang + (i / (n - 1) - 0.5) * spread + (r() - 0.5) * 0.12, l = len * (0.7 + 0.45 * r());
    g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
  }
  g.stroke();
}

export interface BarkPal { bark: string; barkD: string; barkL: string; ink: string }
/** 树干 / 枝：三阶色块（固有色 + 背光侧暗带 + 迎光侧亮带）+ 鳞皴墨线；pal 可换成桦树、枯树等树皮色 */
export function limb(g: Ctx, lg: Ctx, line: P[], w0: (t: number) => number, r: Rand, bark = true, PINE: BarkPal = PINE_BARK) {
  const ph = r() * 50;
  const w = (t: number) => w0(t) * (1 + 0.07 * Math.sin(t * 31 + ph) + 0.05 * Math.sin(t * 13 + ph * 2));
  g.fillStyle = PINE.bark; taper(g, line, w);
  g.save();
  const clip = new Path2D();
  { // 剪辑到枝干轮廓
    const L: P[] = [], R: P[] = [];
    for (let i = 0; i < line.length; i++) {
      const a = line[Math.max(0, i - 1)], b = line[Math.min(line.length - 1, i + 1)];
      const dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 1, hw = w(i / (line.length - 1));
      L.push([line[i][0] - dy / d * hw, line[i][1] + dx / d * hw]); R.push([line[i][0] + dy / d * hw, line[i][1] - dx / d * hw]);
    }
    smoothClosed(clip, L.concat(R.reverse()), 0.35);
  }
  g.clip(clip);
  // 背光（右侧）暗带、迎光（左侧）亮带：沿中线平移
  const shift = (k: number) => line.map((p, i) => [p[0] + w(i / (line.length - 1)) * k, p[1]] as P);
  g.fillStyle = PINE.barkD; taper(g, shift(0.62), (t) => w(t) * 0.62);
  g.fillStyle = PINE.barkL; taper(g, shift(-0.62), (t) => w(t) * 0.22);
  g.restore();
  if (!bark) return;
  // 鳞皴：沿干错落的弧形短笔
  lg.save(); lg.strokeStyle = 'rgba(18,10,7,0.8)'; lg.lineCap = 'round';
  for (let i = 1; i < line.length - 1; i++) {
    const t = i / (line.length - 1), hw = w(t);
    if (hw < 3) continue;
    const [x, y] = line[i];
    const k = Math.max(1, Math.round(hw / 3.5));
    for (let j = 0; j < k; j++) {
      const ox = (r() * 1.6 - 0.8) * hw * 0.7, oy = (r() - 0.5) * 8;
      lg.lineWidth = 0.8 + r() * 1.1;
      lg.beginPath(); lg.ellipse(x + ox, y + oy, hw * 0.28 * (0.6 + r() * 0.6), 2.2 + r() * 2.5, 0, Math.PI * 0.1, Math.PI * (0.85 + r() * 0.2)); lg.stroke();
    }
  }
  // 干笔皴擦：顺着枝干的断续长笔
  lg.save(); lg.lineCap = 'round';
  for (let k = 0; k < 4; k++) {
    const off = (k / 3 - 0.5) * 1.3 + (r() - 0.5) * 0.2;
    lg.strokeStyle = k % 2 ? 'rgba(22,14,10,0.35)' : 'rgba(170,110,70,0.28)'; lg.lineWidth = 1 + r();
    let on = r() < 0.5; lg.beginPath();
    for (let i = 0; i < line.length; i++) {
      const t = i / (line.length - 1), a = line[Math.max(0, i - 1)], b = line[Math.min(line.length - 1, i + 1)];
      const dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 1, hw = w(t);
      const px = line[i][0] - dy / d * hw * off, py = line[i][1] + dx / d * hw * off;
      if (r() < 0.25) on = !on;
      if (on) { if (i === 0 || r() < 0.3) lg.moveTo(px, py); else lg.lineTo(px, py); } else lg.moveTo(px, py);
    }
    lg.stroke();
  }
  lg.restore();
}

/** 云片松针团：几团交叠的椭圆组成扁平云片，底面压暗，顶缘与底缘用针簇墨笔收边 */
function cloudPad(g: Ctx, lg: Ctx, cx: number, cy: number, rx: number, ry: number, r: Rand, s: number) {
  const n = 3 + Math.floor(r() * 3);
  const C: [number, number, number, number][] = [];
  for (let i = 0; i < n; i++) {
    const f = i / (n - 1) * 2 - 1, cr = ry * (1.15 - 0.4 * f * f) * (0.85 + 0.3 * r());
    C.push([cx + f * rx * 0.72 + (r() - 0.5) * ry * 0.3, cy - cr * 0.25 + (r() - 0.5) * ry * 0.2 + f * f * ry * 0.25, cr * 1.15, cr * 0.8]);
  }
  const path = new Path2D(), seed = Math.floor(r() * 1e6);
  C.forEach(([x, y, a, b], i) => smoothClosed(path, wobble(ellipsePts(x, y, a, b, 16, 0, 0.07, r), 1.8, seed + i, 4, 0.3)));
  // 底边：略外凸的平底 + 细小的针穗起伏
  const fr: P[] = [];
  const bx0 = cx - rx * 0.95, bx1 = cx + rx * 0.95, by = cy + ry * 0.22;
  fr.push([bx0 + rx * 0.05, cy - ry * 0.2]);
  for (let i = 0; i <= 10; i++) { const f = i / 10, e = Math.sin(f * Math.PI); fr.push([bx0 + (bx1 - bx0) * f, by + e * ry * (0.22 + 0.12 * r())]); }
  fr.push([bx1 - rx * 0.05, cy - ry * 0.2]);
  smoothClosed(path, wobble(fr, 1.5, seed + 77, 4, 0.5), 0.5);
  // 底面投影（厚度）
  g.save(); g.translate(-1.5 * s, 4.5); g.fillStyle = PADP.under; g.fill(path); g.restore();
  g.fillStyle = PADP.deep; g.fill(path);
  g.save(); g.clip(path);
  g.fillStyle = PADP.mid;
  C.forEach(([x, y, a, b], i) => { g.beginPath(); smoothClosed(g, wobble(ellipsePts(x - a * 0.1, y - b * 0.3, a * 0.86, b * 0.7, 12, 0, 0.08, r), 1.6, seed + 50 + i, 4, 0.3)); g.fill(); });
  g.fillStyle = PADP.lit;
  C.forEach(([x, y, a, b], i) => { if (i > n * 0.6 && r() < 0.7) return; g.beginPath(); smoothClosed(g, wobble(ellipsePts(x - a * 0.28, y - b * 0.55, a * 0.5, b * 0.34, 10, -0.12, 0.1, r), 1.3, seed + 90 + i, 4, 0.3)); g.fill(); });
  // 亮部松针（扇形短笔）
  g.strokeStyle = PADP.hi; g.globalAlpha = 0.8;
  C.forEach(([x, y, a, b], i) => { if (i > n * 0.7) return; for (let k = 0; k < 2; k++) needleFan(g, x - a * (0.45 - k * 0.35), y - b * 0.5 + 4, -Math.PI / 2 - 0.3 + k * 0.4, b * 0.45, 7, 1.5, r, 1); });
  // 密集针纹：整片云团铺满细小针扇（亮部用浅色、暗部用深色），近看不再是平涂色块
  // 两层：先一层大而粗的针簇（远看/放大后仍有笔触），再一层细针
  for (let k = 0; k < Math.round(rx * ry / 60); k++) {
    const x = cx + (r() * 2 - 1) * rx * 0.85, y = cy + (r() * 1.5 - 1.05) * ry;
    const litSide = (x - cx) / rx * 0.5 + (y - cy) / ry < -0.1;
    g.strokeStyle = litSide ? PADP.hi : PADP.under;
    g.globalAlpha = litSide ? 0.8 : 0.9;
    needleFan(g, x, y + 4, -Math.PI / 2 + (x - cx) / rx * 0.5 + (r() - 0.5) * 0.4, 10 + r() * 6, 7, 1.5, r, 1.4);
  }
  for (let k = 0; k < Math.round(rx * ry / 26); k++) {
    const x = cx + (r() * 2 - 1) * rx * 0.9, y = cy + (r() * 1.6 - 1.1) * ry;
    const litSide = (x - cx) / rx * 0.5 + (y - cy) / ry < 0;
    g.strokeStyle = litSide ? (r() < 0.5 ? PADP.hi : PADP.lit) : (r() < 0.5 ? PADP.deep : PADP.mid);
    g.globalAlpha = litSide ? 0.7 : 0.85;
    needleFan(g, x, y, -Math.PI / 2 + (r() - 0.5) * 0.8, 6 + r() * 4, 5, 1.6, r, 0.9);
  }
  g.globalAlpha = 1;
  g.restore();
  // 松果：挂在云团底下
  if (r() < 0.45) for (let k = 0; k < 1 + Math.floor(r() * 2); k++) {
    const x = cx + (r() - 0.5) * rx, y = cy + ry * 0.45;
    g.fillStyle = '#4a2c1a'; g.beginPath(); g.ellipse(x, y + 4, 3.6, 5.2, 0.1, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#8a5a34'; for (let j = 0; j < 3; j++) { g.beginPath(); g.ellipse(x - 0.8, y + 1.5 + j * 2.2, 2.4, 0.9, 0, 0, Math.PI * 2); g.fill(); }
  }
  // 墨线（剪影内）：团与团之间的分界弧 + 底面一道暗笔（先擦掉被云团遮住的树干墨线）
  lg.save(); lg.globalCompositeOperation = 'destination-out'; lg.fill(path); lg.restore();
  lg.save(); lg.strokeStyle = PADP.ink; lg.lineCap = 'round';
  C.forEach(([x, y, a, b], i) => {
    if (i === 0) return;
    lg.lineWidth = 1.1; lg.beginPath(); lg.ellipse(x, y, a * 0.95, b * 0.95, 0, Math.PI * 0.62, Math.PI * 1.12); lg.stroke();
  });
  lg.lineWidth = 1.6; lg.beginPath(); lg.moveTo(bx0 + rx * 0.2, by - 1); lg.quadraticCurveTo(cx, by + ry * 0.35, bx1 - rx * 0.2, by - 1); lg.stroke();
  lg.restore();
  // 剪影外缘的针簇（直接画在色层上，成为轮廓的一部分，再被墨晕包边）
  g.save(); g.strokeStyle = PADP.deep;
  C.forEach(([x, y, a, b]) => {
    for (let k = 0; k < 8; k++) { const t = Math.PI * (1.0 + k * 0.14 + (r() - 0.5) * 0.08); needleFan(g, x + Math.cos(t) * a * 0.82, y + Math.sin(t) * b * 0.82, t, 8 + r() * 6, 5, 1.0, r, 1.3); }
  });
  for (let i = 0; i < 14; i++) { const f = 0.05 + 0.9 * i / 13; needleFan(g, bx0 + (bx1 - bx0) * f, by + Math.sin(f * Math.PI) * ry * 0.2, Math.PI / 2 + (f - 0.5) * 0.8, 8 + r() * 7, 5, 0.9, r, 1.3); }
  g.restore();
}

function padPine(c: PineCfg, seed: number): GenOut {
  const r = rng(seed);
  const H = c.h * U, CW = Math.ceil(c.w * U * 1.6 + 80), CH = Math.ceil(H + 80);
  const [cv, g] = canvas(CW, CH), [lc, lg] = canvas(CW, CH);
  const bx = CW / 2 - c.lean * U * 0.55, by = CH - 30;
  const Ht = H * 0.8, ph = r() * Math.PI * 2, amp = 0.38 + r() * 0.22;
  const sx = (t: number) => bx + c.lean * U * 1.7 * Math.pow(t, 1.6) + Math.sin(t * Math.PI * 1.8 + ph) * U * amp * t;
  const spine: P[] = [];
  for (let i = 0; i <= 24; i++) { const t = i / 24; spine.push([sx(t), by - t * Ht]); }
  const tw = (t: number) => U * (0.3 * Math.pow(1 - t, 0.9) + 0.06) + U * 0.36 * Math.exp(-t * 12);
  // 根：几条向两侧伸出的根脚
  for (const s of [-1, 1, -0.5, 0.6]) {
    const L = U * (0.45 + r() * 0.25) * Math.abs(s);
    limb(g, lg, quadPts([bx, by - U * 0.35], [bx + s * L * 0.3, by - 4], [bx + Math.sign(s) * L, by + 2], 6), (t) => U * 0.16 * (1 - t) + 1.5, r, false);
  }
  // 枝 + 云团：枝数、高度、左右都带随机（不严格交替），每根枝梢分出几根小枝，各托一片小云片
  type Pad = { x: number; y: number; rx: number; ry: number; s: number; from: P; w: number };
  const nb = Math.round(c.h * 1.25) + Math.floor(r() * 2);
  const pads: Pad[] = [];
  let side = r() < 0.5 ? -1 : 1;
  for (let k = 0; k < nb; k++) {
    const t = 0.46 + (0.95 - 0.46) * k / Math.max(1, nb - 1) + (r() - 0.5) * 0.04;
    const s = side; side = r() < 0.72 ? -side : side;
    const bias = c.lean !== 0 ? (s === Math.sign(c.lean) ? 1.25 : 0.75) : 1;
    const env = Math.sqrt(Math.max(0.08, 1 - ((t - 0.66) / 0.38) ** 2));   // 椭圆树冠包络
    const len = c.w * U * 0.34 * env * (0.7 + 0.45 * r()) * bias;
    const P0: P = [sx(t), by - t * Ht], P2: P = [P0[0] + s * len, P0[1] - len * (0.05 + r() * 0.3)];
    const P1: P = [P0[0] + s * len * 0.45, P0[1] + len * (0.04 + r() * 0.14)];
    const bw0 = tw(t) * 0.55;
    const bl = quadPts(P0, P1, P2, 10);
    limb(g, lg, bl, (u) => bw0 * (1 - u * 0.72) + 1, r, true, PAD_BARK);
    // 小枝 → 云片
    const nG = 3 + Math.floor(r() * 3), base = U * (0.3 - 0.1 * t) * Math.min(1.1, bias);
    for (let q = 0; q < nG; q++) {
      const u = 0.6 + 0.4 * (q / (nG - 1)) + (r() - 0.5) * 0.06, from = bl[Math.min(bl.length - 1, Math.round(u * (bl.length - 1)))];
      const rx = base * (0.65 + r() * 0.55) * (q === nG - 1 ? 1.15 : 1);
      const dx = s * (r() - 0.2) * base * 0.8, dy = -U * (0.04 + r() * 0.16);
      pads.push({ x: from[0] + dx, y: from[1] + dy, rx, ry: rx * (0.44 + r() * 0.14), s, from, w: bw0 * 0.35 + 0.8 });
    }
  }
  limb(g, lg, spine, tw, r, true, PAD_BARK);
  // 顶冠：一簇大小不一的云片
  const top = spine[spine.length - 1];
  for (let q = 0; q < 5; q++) {
    const rx = U * (0.32 + r() * 0.25);
    pads.push({ x: top[0] + (r() - 0.5) * U * 1.2, y: top[1] - U * (0.02 + r() * 0.2), rx, ry: rx * (0.45 + r() * 0.12), s: r() < 0.5 ? -1 : 1, from: top, w: 2 });
  }
  pads.sort((a, b) => b.y - a.y);   // 自下而上：上层云片压住下层
  for (const p of pads) {
    // 先画托着这片云的红褐小枝（压在更低的云片上，于是在云片之间露出来）
    const m: P = [(p.from[0] + p.x) / 2 + (r() - 0.5) * 6, Math.max(p.from[1], p.y) + 3];
    limb(g, lg, quadPts(p.from, m, [p.x, p.y + p.ry * 0.3], 6), (u) => p.w * (1 - u * 0.6) + 0.6, r, false, PAD_BARK);
    cloudPad(g, lg, p.x, p.y, p.rx, p.ry, r, p.s);
  }
  const w = wash(cv, { seed, bleed: 2.8, inkAmt: 0.95, edgeR: 5, formR: 30, form: 0.3, pigScale: 30, rimAmt: 0.2, lines: lc });
  const cr = cropAlpha(w, 3);
  return { canvas: cr.canvas, pivot: [(bx - cr.ox) / cr.canvas.width, (by - cr.oy) / cr.canvas.height] };
}

/** 水滴形针簇：圆头在 (x,y)，尖端朝 ang 方向 */
function clumpPts(x: number, y: number, rc: number, ang: number, tip: number): P[] {
  const out: P[] = [];
  for (let i = 0; i < 12; i++) {
    const a = ang + Math.PI * 0.5 + (i / 11) * Math.PI;   // 背向尖端的半圆
    out.push([x + Math.cos(a) * rc, y + Math.sin(a) * rc]);
  }
  out.push([x + Math.cos(ang - 0.35) * rc * 0.9, y + Math.sin(ang - 0.35) * rc * 0.9]);
  out.push([x + Math.cos(ang) * (rc + tip), y + Math.sin(ang) * (rc + tip)]);
  out.push([x + Math.cos(ang + 0.35) * rc * 0.9, y + Math.sin(ang + 0.35) * rc * 0.9]);
  return out;
}

/** 针叶塔：一层 = 屋顶状主体 + 一排下垂的水滴针簇 */
function tier(g: Ctx, lg: Ctx, x: number, y: number, wl: number, wr: number, hh: number, r: Rand) {
  const sd = Math.floor(r() * 1e6);
  const path = new Path2D();
  const top: P = [x + (r() - 0.5) * 3, y - hh * 0.55];
  smoothClosed(path, wobble([top, [x + wr * 0.45, y - hh * 0.22], [x + wr * 0.92, y + hh * 0.12], [x + wr * 0.4, y + hh * 0.2], [x - wl * 0.4, y + hh * 0.2], [x - wl * 0.92, y + hh * 0.12], [x - wl * 0.45, y - hh * 0.22]], 1.5, sd, 4, 0.25), 0.45);
  const m = Math.max(4, Math.round((wl + wr) / (hh * 0.3)));
  const clumps: [number, number, number, number][] = [];
  for (let i = 0; i < m; i++) {
    const f = (i + 0.5) / m, px = x - wl + (wl + wr) * f + (r() - 0.5) * hh * 0.12, e = Math.abs(f * 2 - 1);
    const rc = hh * (0.11 + 0.1 * r()) * (1 - 0.25 * e), ang = Math.PI / 2 + (f - 0.5) * 1.5 + (r() - 0.5) * 0.25;
    const cy = y + hh * (0.14 + 0.16 * e * e) + (r() - 0.5) * hh * 0.08;
    clumps.push([px, cy, rc, ang]);
    smoothClosed(path, clumpPts(px, cy, rc, ang, rc * (0.9 + 0.6 * r())), 0.5);
  }
  g.save(); g.translate(1, 4); g.fillStyle = PINE.under; g.fill(path); g.restore();
  g.fillStyle = PINE.deep; g.fill(path);
  g.save(); g.clip(path);
  // 迎光色块：屋顶左上部分 + 左侧针簇的上半
  g.fillStyle = PINE.mid;
  g.beginPath(); smoothClosed(g, wobble([[top[0] - 1, top[1] - 4], [x + wr * 0.4, y - hh * 0.18], [x + wr * 0.2, y + hh * 0.0], [x - wl * 0.5, y + hh * 0.08], [x - wl * 1.05, y + hh * 0.05]], 1.6, sd + 3, 4, 0.3), 0.5); g.fill();
  for (const [px, cy, rc] of clumps) if (px < x - wl * 0.35 && r() < 0.6) { g.beginPath(); g.ellipse(px - rc * 0.2, cy - rc * 0.45, rc * 0.6, rc * 0.4, -0.3, 0, Math.PI * 2); g.fill(); }
  g.fillStyle = PINE.lit;
  g.beginPath(); smoothClosed(g, wobble([[top[0] - 2, top[1] - 3], [x - wl * 0.05, y - hh * 0.18], [x - wl * 0.45, y - hh * 0.06], [x - wl * 0.75, y - hh * 0.04]], 1.2, sd + 5, 4, 0.3), 0.5); g.fill();
  g.strokeStyle = PINE.hi; g.globalAlpha = 0.75;
  for (let k = 0; k < 3; k++) needleFan(g, x - wl * (0.12 + k * 0.22), y - hh * (0.3 - k * 0.09), Math.PI * 0.68 + k * 0.06, hh * 0.3, 5, 0.9, r, 1);
  // 内部密针纹
  for (let k = 0; k < Math.round((wl + wr) * hh / 30); k++) {
    const u = r(), px = x - wl + (wl + wr) * u, py = y - hh * 0.3 + r() * hh * 0.5;
    g.strokeStyle = u < 0.45 && py < y ? (r() < 0.5 ? PINE.hi : PINE.lit) : (r() < 0.5 ? PINE.under : PINE.mid);
    g.globalAlpha = 0.75;
    needleFan(g, px, py, Math.PI / 2 + (u - 0.5) * 1.6, hh * (0.1 + r() * 0.08), 4, 0.8, r, 0.8);
  }
  g.globalAlpha = 1;
  g.restore();
  // 轮廓毛刺：沿层的两肩和下缘撒细针，剪影变得毛茸茸
  g.save(); g.strokeStyle = PINE.deep;
  for (let k = 0; k < Math.round((wl + wr) / 3.2); k++) {
    const u = r(), side = u < 0.5 ? -1 : 1, e = Math.abs(u * 2 - 1);
    const px = x + (u * 2 - 1) * (side < 0 ? wl : wr) * 0.95, py = y - hh * 0.5 * (1 - e) + hh * (0.12 + 0.22 * e * e) * (0.6 + r() * 0.6);
    const ang = Math.PI / 2 + side * (0.4 + e * 0.9) + (r() - 0.5) * 0.5;
    needleFan(g, px, py, ang, hh * (0.1 + r() * 0.1), 3, 0.7, r, 1);
  }
  g.restore();
  // 针簇尖端的针（色层，成为轮廓）+ 墨线分层
  g.save(); g.strokeStyle = PINE.deep;
  for (const [px, cy, rc, ang] of clumps) needleFan(g, px + Math.cos(ang) * rc * 0.8, cy + Math.sin(ang) * rc * 0.8, ang, rc * 1.1, 5, 0.9, r, 1.1);
  g.restore();
  lg.save(); lg.globalCompositeOperation = 'destination-out'; lg.fill(path); lg.restore();
  lg.save(); lg.strokeStyle = PINE.ink; lg.lineCap = 'round';
  for (const [px, cy, rc, ang] of clumps) if (r() < 0.35) { lg.lineWidth = 1; lg.beginPath(); lg.arc(px, cy, rc * 0.95, ang + 0.9, ang + Math.PI - 0.9, false); lg.stroke(); }
  lg.lineWidth = 1.4; lg.beginPath(); lg.moveTo(x - wl * 0.7, y + hh * 0.08); lg.quadraticCurveTo(x, y + hh * 0.22, x + wr * 0.75, y + hh * 0.06); lg.stroke();
  lg.restore();
}

function spirePine(c: PineCfg, seed: number): GenOut {
  const r = rng(seed);
  const H = c.h * U, CW = Math.ceil(c.w * U * 1.4 + 80), CH = Math.ceil(H + 80);
  const [cv, g] = canvas(CW, CH), [lc, lg] = canvas(CW, CH);
  const bx = CW / 2, by = CH - 30;
  const sx = (t: number) => bx + c.lean * U * t * t + Math.sin(t * 7 + seed) * 2;
  const spine: P[] = []; for (let i = 0; i <= 10; i++) { const t = i / 10; spine.push([sx(t), by - t * H * 0.97]); }
  for (const s of [-1, 1]) limb(g, lg, quadPts([bx, by - U * 0.25], [bx + s * U * 0.12, by - 3], [bx + s * U * (0.3 + r() * 0.15), by + 2], 6), (t) => U * 0.1 * (1 - t) + 1.2, r, false);
  limb(g, lg, spine, (t) => U * (0.15 * (1 - t) + 0.025) + U * 0.12 * Math.exp(-t * 18), r);
  const T = c.tiers ?? 11, t0 = 0.2;
  // 树冠内部的暗芯：层与层之间透出的是深色而不是纸色
  g.fillStyle = PINE.under; g.beginPath();
  smoothClosed(g, wobble([[sx(1), by - H * 0.95], [sx(0.5) + c.w * U * 0.22, by - H * 0.55], [sx(t0) + c.w * U * 0.3, by - H * (t0 + 0.02)], [sx(t0) - c.w * U * 0.3, by - H * (t0 + 0.02)], [sx(0.5) - c.w * U * 0.22, by - H * 0.55]], 2, seed, 6), 0.4); g.fill();
  const hh = (H * (1 - t0) / T) * 1.9;
  for (let k = 0; k < T; k++) {
    const f = k / T, t = t0 + (1 - t0) * f;
    // 轮廓不做完美圆锥：层宽交替长短 + 低频起伏，偶有缺层露出树干
    const wob = 1 + 0.18 * Math.sin(k * 2.3 + seed) + (k % 2 ? -0.08 : 0.06);
    const half = c.w * U * 0.5 * Math.pow(1 - f, 0.92) * (0.8 + 0.4 * r()) * wob + U * 0.14;
    const asym = (r() - 0.5) * 0.55 + c.lean * 0.5;
    if (k > 1 && k < T - 2 && r() < 0.12) {   // 断层：只留一侧短枝
      const s = r() < 0.5 ? -1 : 1;
      limb(g, lg, quadPts([sx(t), by - t * H], [sx(t) + s * half * 0.4, by - t * H + 4], [sx(t) + s * half * 0.75, by - t * H - 2], 6), (u) => 3.2 * (1 - u * 0.7), r, false);
      tier(g, lg, sx(t) + s * half * 0.45, by - t * H, half * 0.4, half * 0.4, hh * 0.7, r);
      continue;
    }
    tier(g, lg, sx(t), by - t * H, half * (1 - asym), half * (1 + asym), hh * (1 - f * 0.35) * (0.85 + 0.3 * r()), r);
  }
  // 顶梢
  const tp = spine[spine.length - 1];
  g.fillStyle = PINE.deep; g.beginPath(); smoothClosed(g, [[tp[0], tp[1] - U * 0.45], [tp[0] + 5, tp[1] + 6], [tp[0] - 5, tp[1] + 6]], 0.3); g.fill();
  const w = wash(cv, { seed, bleed: 2.8, inkAmt: 0.95, edgeR: 5, formR: 28, form: 0.3, pigScale: 28, rimAmt: 0.2, lines: lc });
  const cr = cropAlpha(w, 3);
  return { canvas: cr.canvas, pivot: [(bx - cr.ox) / cr.canvas.width, (by - cr.oy) / cr.canvas.height] };
}

export function genPine(c: PineCfg, seed: number): GenOut { return c.kind === 'pad' ? padPine(c, seed) : spirePine(c, seed); }

// 注册：沿用资源包里的图片名，这样 pine0..3 等键位直接生效
export const PINE_VARIANTS: Record<string, PineCfg & { seed: number }> = {
  pine_old: { kind: 'pad', h: 7.6, w: 4.4, lean: 0, pads: 7, seed: 11 },
  pine_dense: { kind: 'spire', h: 7.0, w: 3.6, lean: 0, tiers: 12, seed: 23 },
  pine_young: { kind: 'spire', h: 5.4, w: 2.5, lean: 0, tiers: 9, seed: 37 },
  pine_windbent: { kind: 'pad', h: 6.8, w: 4.6, lean: 0.55, pads: 6, seed: 41 },
};
for (const [name, cfg] of Object.entries(PINE_VARIANTS)) register({ name, kind: 'sprite', group: 'pine', seed: cfg.seed, gen: (s) => genPine(cfg, s) });
