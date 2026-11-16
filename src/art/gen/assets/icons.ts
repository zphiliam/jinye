/**
 * 物品图标（29 个）：统一的“图标风格”——
 * 粗剪影 + 三阶色块 + 少量高光 / 墨线，统一用更利落的 W_ICON 合成（墨边细、体积感强），
 * 在背包格子（约 40px）里也认得出。工具类图标额外输出 handle / head 两点，供骨骼动画握持。
 */
import { register, cropAlpha, GenOut } from '../registry';
import { rng, Rand } from '../noise';
import { wash, WashOpts } from '../wash';
import { P, smoothClosed, ellipsePts, taper, quadPts, wobble } from '../brush';
import { stage, Stage, fillPts, line, leafShape, rock, ROCK, blade } from '../kit';

type Ctx = CanvasRenderingContext2D;
const W_ICON: Partial<WashOpts> = { bleed: 1.5, inkAmt: 0.95, edge: 0.3, edgeR: 2.5, formR: 10, form: 0.36, pigScale: 12, pigment: 0.07, rimAmt: 0.18, rimW: 1.4, grain: 0.05 };
const WOOD = { b: '#7a5232', d: '#45291a', l: '#b38250' };
const CORD = { b: '#9a7a4c', d: '#5e4628', l: '#cdb07a' };
const GR = ['#5b6a2e', '#74833a', '#8e9a48', '#a8a85a', '#6a5f30'];

function icon(seed: number, draw: (st: Stage, r: Rand) => Record<string, P> | void): GenOut {
  const r = rng(seed), st = stage(190, 190, 26);
  const pts = draw(st, r) || {};
  const w = wash(st.cv, { seed, ...W_ICON, lines: st.lc } as WashOpts);
  const cr = cropAlpha(w, 3);
  const points: Record<string, [number, number]> = {};
  for (const [k, [x, y]] of Object.entries(pts)) points[k] = [x - cr.ox, y - cr.oy];
  return { canvas: cr.canvas, pivot: [(st.bx - cr.ox) / cr.canvas.width, (st.by - cr.oy) / cr.canvas.height], points };
}

/** 一根木棍：两侧明暗 + 树皮纹 */
function stick(g: Ctx, l: Ctx, a: P, b: P, w0: number, w1: number, pal = WOOD, bend = 0) {
  const m: P = [(a[0] + b[0]) / 2 + bend, (a[1] + b[1]) / 2];
  const pts = quadPts(a, m, b, 12);
  g.fillStyle = pal.d; taper(g, pts, (t) => w0 + (w1 - w0) * t);
  const nx = -(b[1] - a[1]), ny = b[0] - a[0], nl = Math.hypot(nx, ny), ox = nx / nl, oy = ny / nl;
  g.fillStyle = pal.b; taper(g, pts.map(([x, y], i) => [x - ox * (w0 + (w1 - w0) * i / 11) * 0.12, y - oy * (w0 + (w1 - w0) * i / 11) * 0.12] as P), (t) => (w0 + (w1 - w0) * t) * 0.75);
  g.fillStyle = pal.l; taper(g, pts.map(([x, y], i) => [x - ox * (w0 + (w1 - w0) * i / 11) * 0.42, y - oy * (w0 + (w1 - w0) * i / 11) * 0.42] as P), (t) => (w0 + (w1 - w0) * t) * 0.22);
  for (let i = 2; i < 11; i += 3) { const [x, y] = pts[i], ww = (w0 + (w1 - w0) * i / 11) * 0.4; line(l, [[x - ox * ww, y - oy * ww], [x + ox * ww * 0.3 + (b[0] - a[0]) * 0.03, y + oy * ww * 0.3 + (b[1] - a[1]) * 0.03]], 0.8, 'rgba(25,14,8,0.5)'); }
  return pts;
}
function lash(g: Ctx, l: Ctx, c: P, ang: number, w: number, n = 4) {
  for (let k = 0; k < n; k++) {
    const t = (k - (n - 1) / 2) * 3.2, x = c[0] + Math.cos(ang) * t, y = c[1] + Math.sin(ang) * t, nx = -Math.sin(ang) * w, ny = Math.cos(ang) * w;
    g.strokeStyle = k % 2 ? CORD.b : CORD.l; g.lineWidth = 2.6; g.lineCap = 'round'; g.beginPath(); g.moveTo(x - nx, y - ny); g.lineTo(x + nx + Math.cos(ang) * 2, y + ny + Math.sin(ang) * 2); g.stroke();
    line(l, [[x - nx, y - ny + 1.4], [x + nx, y + ny + 1.4]], 0.6, 'rgba(30,20,10,0.5)');
  }
}
function berry(g: Ctx, x: number, y: number, rad: number, col: string, dark: string, hi: string) {
  g.fillStyle = dark; g.beginPath(); g.arc(x + 0.8, y + 0.8, rad, 0, Math.PI * 2); g.fill();
  g.fillStyle = col; g.beginPath(); g.arc(x - 0.4, y - 0.4, rad * 0.85, 0, Math.PI * 2); g.fill();
  g.fillStyle = hi; g.beginPath(); g.ellipse(x - rad * 0.35, y - rad * 0.4, rad * 0.28, rad * 0.2, -0.6, 0, Math.PI * 2); g.fill();
}
function glow(g: Ctx, x: number, y: number, rad: number, col: string) {
  const gr = g.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
}
function flame(g: Ctx, x: number, y: number, h: number, w: number, r: Rand) {
  for (const [col, k] of [['#b8341a', 1], ['#e8742a', 0.75], ['#ffc84a', 0.5], ['#fff2b0', 0.26]] as [string, number][]) {
    const pts: P[] = [[x - w * k, y], [x - w * k * 0.9, y - h * k * 0.4], [x - w * k * 0.3 + (r() - 0.5) * 3, y - h * k * 0.75], [x + (r() - 0.5) * 4, y - h * k], [x + w * k * 0.35, y - h * k * 0.6], [x + w * k * 0.85, y - h * k * 0.5 + (r() - 0.5) * 4], [x + w * k, y]];
    fillPts(g, col, pts, 0, 1, 0.45);
  }
}

// —— 材料 ——
const G: Record<string, (s: number) => GenOut> = {
  icon_grass: (s) => icon(s, ({ g, l, bx, by }, r) => {
    const wy = by - 50;
    for (let k = 0; k < 26; k++) { const f = k / 25 * 2 - 1, col = GR[Math.floor(r() * GR.length)];
      blade(g, [bx + f * 5, wy], [bx + f * 34 + (r() - 0.5) * 8, by - 120 - (1 - Math.abs(f)) * 12 + r() * 10], f * 6, 2.6, col);
      blade(g, [bx + f * 5, wy], [bx + f * 16 + (r() - 0.5) * 5, by], -f * 2, 2.4, GR[Math.floor(r() * 4)]); }
    g.fillStyle = CORD.d; taper(g, [[bx - 10, wy - 3], [bx, wy + 1], [bx + 10, wy - 3]], () => 5); g.fillStyle = CORD.l; taper(g, [[bx - 9, wy - 4.5], [bx + 9, wy - 4.5]], () => 1.6);
    line(l, [[bx - 10, wy + 1], [bx + 10, wy + 1]], 0.8);
  }),
  icon_twigs: (s) => icon(s, ({ g, l, bx, by }, r) => {
    stick(g, l, [bx - 34, by - 4], [bx + 30, by - 118], 7, 3.5, WOOD, 6);
    stick(g, l, [bx + 26, by - 2], [bx - 22, by - 112], 6.5, 3, WOOD, -5);
    stick(g, l, [bx - 6, by - 50], [bx - 36, by - 86], 3.5, 1.6, WOOD);
    stick(g, l, [bx + 14, by - 70], [bx + 40, by - 96], 3.2, 1.4, WOOD);
    stick(g, l, [bx - 3, by - 2], [bx + 4, by - 100], 5, 2.5, WOOD, r() * 6 - 3);
  }),
  icon_flint: (s) => icon(s, ({ g, l, bx, by }) => {
    const tip: P = [bx + 8, by - 124];
    const pts: P[] = [[bx - 26, by - 4], [bx - 30, by - 48], [bx - 12, by - 98], tip, [bx + 22, by - 76], [bx + 28, by - 30], [bx + 16, by]];
    fillPts(g, '#24262d', pts, 0, 1, 0.05);
    g.save(); g.beginPath(); smoothClosed(g, pts, 0.05); g.clip();
    fillPts(g, '#d4ccb6', [[bx + 6, by + 4], [bx + 34, by + 4], [bx + 34, by - 44], [bx + 14, by - 26]], 0.8, 3, 0.4);
    fillPts(g, '#555c6c', [[bx - 30, by - 44], [bx - 12, by - 98], tip, [bx - 2, by - 40], [bx - 18, by - 6]], 0, 1, 0.05);
    fillPts(g, '#8c94a6', [[bx - 16, by - 76], [bx - 8, by - 102], [bx + 4, by - 112], [bx - 6, by - 66]], 0, 1, 0.05);
    for (let j = 0; j < 5; j++) { l.strokeStyle = 'rgba(12,12,18,0.45)'; l.lineWidth = 0.9; l.beginPath(); l.ellipse(bx - 22, by - 30, 12 + j * 9, 18 + j * 12, -0.5, -1.4, 0.2); l.stroke(); }
    g.restore();
    line(l, [tip, [bx - 12, by - 98], [bx - 30, by - 48]], 1.6, 'rgba(230,236,248,0.75)');
  }),
  icon_stone: (s) => icon(s, (st, r) => { rock(st, st.bx, st.by - 4, 46, 62, r, ROCK, { tall: 1, moss: 0, angular: 0.35 }); }),
  icon_log: (s) => icon(s, ({ g, l, bx, by }, r) => {
    const a: P = [bx - 30, by - 22], b: P = [bx + 26, by - 116], R = 22;
    const ang = Math.atan2(b[1] - a[1], b[0] - a[0]), nx = -Math.sin(ang) * R, ny = Math.cos(ang) * R;
    const body: P[] = [[a[0] + nx, a[1] + ny], [b[0] + nx, b[1] + ny], [b[0] - nx, b[1] - ny], [a[0] - nx, a[1] - ny]];
    fillPts(g, WOOD.d, body, 0.8, 4, 0.1);
    g.save(); g.beginPath(); smoothClosed(g, body, 0.1); g.clip();
    fillPts(g, WOOD.b, [[a[0] - nx * 0.9, a[1] - ny * 0.9], [b[0] - nx * 0.9, b[1] - ny * 0.9], [b[0] + nx * 0.2, b[1] + ny * 0.2], [a[0] + nx * 0.2, a[1] + ny * 0.2]], 0, 1, 0.1);
    fillPts(g, WOOD.l, [[a[0] - nx * 0.8, a[1] - ny * 0.8], [b[0] - nx * 0.8, b[1] - ny * 0.8], [b[0] - nx * 0.45, b[1] - ny * 0.45], [a[0] - nx * 0.45, a[1] - ny * 0.45]], 0, 1, 0.1);
    for (let k = 0; k < 9; k++) { const f = (k + 0.5) / 9 * 2 - 1, t0 = r() * 0.4, t1 = t0 + 0.3 + r() * 0.4;
      line(l, [[a[0] + (b[0] - a[0]) * t0 + nx * f, a[1] + (b[1] - a[1]) * t0 + ny * f], [a[0] + (b[0] - a[0]) * t1 + nx * f * 1.02, a[1] + (b[1] - a[1]) * t1 + ny * f * 1.02]], 1, 'rgba(25,12,6,0.55)'); }
    g.restore();
    // 截面年轮
    const er = ellipsePts(a[0], a[1], R * 0.62, R, 20, ang, 0.03, r);
    fillPts(g, '#d6a96a', er, 0, 1, 0.5);
    for (const k of [0.75, 0.5, 0.25]) { l.strokeStyle = 'rgba(110,62,28,0.7)'; l.lineWidth = 0.9; l.beginPath(); l.ellipse(a[0] + 1, a[1], R * 0.62 * k, R * k, ang, 0, Math.PI * 2); l.stroke(); }
    line(l, [[a[0], a[1]], [a[0] + 10, a[1] - 9]], 0.9, 'rgba(80,40,18,0.6)');
    stick(g, l, [bx + 6, by - 84], [bx + 30, by - 70], 5, 3);
  }),
  icon_rope: (s) => icon(s, ({ g, l, bx, by }) => {
    const cy = by - 62;
    for (let k = 0; k < 5; k++) {
      const rx = 48 - k * 5, ry = 30 - k * 3, y = cy + k * 2;
      g.strokeStyle = '#3e2a14'; g.lineWidth = 10; g.beginPath(); g.ellipse(bx, y, rx, ry, 0, 0, Math.PI * 2); g.stroke();
      g.strokeStyle = CORD.b; g.lineWidth = 7; g.beginPath(); g.ellipse(bx - 0.5, y - 0.8, rx, ry, 0, 0, Math.PI * 2); g.stroke();
      g.strokeStyle = CORD.l; g.lineWidth = 2.4; g.beginPath(); g.ellipse(bx - 1, y - 2.4, rx, ry, 0, Math.PI * 1.0, Math.PI * 1.9); g.stroke();
      l.strokeStyle = 'rgba(40,24,8,0.8)'; l.lineWidth = 1.2;
      for (let j = 0; j < 30; j++) { const a = j / 30 * Math.PI * 2, x = bx + Math.cos(a) * rx, yy = y + Math.sin(a) * ry; l.beginPath(); l.moveTo(x - 2.6, yy - 3.2); l.lineTo(x + 2.6, yy + 3.2); l.stroke(); }
    }
    const tail = [[bx + 44, cy + 8], [bx + 56, cy + 34], [bx + 48, by - 2]] as P[];
    g.fillStyle = CORD.b; taper(g, quadPts(tail[0], tail[1], tail[2], 10), () => 5);
    g.strokeStyle = CORD.l; g.lineWidth = 1; for (let k = 0; k < 4; k++) { g.beginPath(); g.moveTo(bx + 48, by - 3); g.lineTo(bx + 44 + k * 3, by + 6); g.stroke(); }
  }),
  icon_berries: (s) => icon(s, ({ g, l, bx, by }, r) => {
    g.fillStyle = '#4a3a24'; taper(g, quadPts([bx - 6, by], [bx - 10, by - 60], [bx + 8, by - 118], 12), (t) => 3 - t * 1.6);
    for (const [y, a] of [[-40, -2.5], [-55, -0.5], [-80, -2.6], [-92, -0.4], [-108, -2.2]] as [number, number][]) { g.fillStyle = r() < 0.5 ? '#4f6a32' : '#6b8740'; leafShape(g, bx - 8 + (y < -70 ? 6 : 0), by + y, 30, 9, a); }
    for (const [x, y] of [[-14, -62], [2, -66], [-6, -52], [10, -54], [-2, -98], [14, -102], [6, -112], [-18, -88]] as P[]) berry(g, bx + x, by + y, 7.5, '#c22a2a', '#6e1010', '#ffb0a0');
    line(l, [[bx - 8, by - 20], [bx - 9, by - 50]], 0.8);
  }),
  icon_berry_cooked: (s) => icon(s, ({ g, l, bx, by }) => {
    const leaf: P[] = [[bx - 44, by - 20], [bx - 30, by - 92], [bx + 10, by - 124], [bx + 46, by - 80], [bx + 38, by - 14], [bx - 6, by]];
    fillPts(g, '#5a3a20', leaf, 1.4, 8, 0.45); fillPts(g, '#8a5a2c', [[bx - 36, by - 30], [bx - 22, by - 88], [bx + 8, by - 116], [bx - 4, by - 40]], 1, 9, 0.45);
    line(l, [[bx - 30, by - 8], [bx + 6, by - 60], [bx + 20, by - 112]], 1.4, 'rgba(30,16,6,0.7)');
    for (const [x, y] of [[-14, -50], [12, -44], [-2, -70], [20, -72]] as P[]) for (let k = 0; k < 9; k++) berry(g, bx + x + Math.cos(k * 0.7) * (k ? 7 : 0), by + y + Math.sin(k * 0.7) * (k ? 7 : 0), 4.4, '#2a1830', '#0e0810', '#8a7aa0');
  }),
  icon_carrot: (s) => icon(s, ({ g, l, bx, by }, r) => carrot(g, l, bx, by, r, false)),
  icon_carrot_cooked: (s) => icon(s, ({ g, l, bx, by }, r) => carrot(g, l, bx, by, r, true)),
  icon_petals: (s) => icon(s, ({ g, l, bx, by }, r) => {
    for (let k = 0; k < 8; k++) { const x = bx + Math.cos(k * 2.4) * 34 * (0.4 + r() * 0.6), y = by - 60 + Math.sin(k * 2.4) * 40 * (0.4 + r() * 0.6), a = r() * 6;
      fillPts(g, '#7a1414', ellipsePts(x + 1, y + 1.5, 15, 11, 12, a, 0.12, r), 0, 1, 0.5);
      fillPts(g, '#c8282a', ellipsePts(x, y, 13, 9.5, 12, a, 0.12, r), 0, 1, 0.5);
      fillPts(g, '#e86a5a', ellipsePts(x - 3, y - 3, 6, 3.5, 10, a, 0.1, r), 0, 1, 0.5);
      line(l, [[x - Math.cos(a) * 8, y - Math.sin(a) * 8], [x + Math.cos(a) * 6, y + Math.sin(a) * 6]], 0.7, 'rgba(70,10,10,0.6)'); }
  }),
  icon_silk: (s) => icon(s, ({ g, bx, by }, r) => {
    const cx = bx, cy = by - 62;
    g.lineCap = 'round';
    for (let k = 0; k < 14; k++) { const a = k / 14 * Math.PI * 2 + r() * 0.2; g.strokeStyle = 'rgba(70,64,70,0.9)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * 56, cy + Math.sin(a) * 50); g.stroke(); }
    for (let k = 0; k < 70; k++) { const a = r() * Math.PI * 2, rr = 8 + r() * 38; g.strokeStyle = r() < 0.3 ? '#8a8490' : r() < 0.6 ? '#d8d4dc' : '#f4f2f6'; g.lineWidth = 0.9 + r() * 1.2; g.beginPath(); g.arc(cx + (r() - 0.5) * 8, cy + (r() - 0.5) * 8, rr, a, a + 0.8 + r() * 1.6); g.stroke(); }
    fillPts(g, '#ece8f0', ellipsePts(cx, cy, 14, 12, 12, 0, 0.2, r), 0, 1, 0.5);
    fillPts(g, '#a8a2b0', ellipsePts(cx + 4, cy + 4, 7, 5, 10, 0, 0.2, r), 0, 1, 0.5);
  }),
  icon_gland: (s) => icon(s, ({ g, l, bx, by }, r) => {
    glow(g, bx, by - 50, 62, 'rgba(230,40,30,0.55)');
    const sac: P[] = [[bx, by - 100], [bx + 26, by - 70], [bx + 30, by - 34], [bx + 12, by - 6], [bx - 14, by - 6], [bx - 30, by - 34], [bx - 26, by - 70]];
    fillPts(g, '#5e0e12', sac, 1, 5, 0.5);
    fillPts(g, '#b0222a', [[bx - 4, by - 92], [bx + 18, by - 66], [bx + 20, by - 30], [bx - 8, by - 14], [bx - 24, by - 40], [bx - 18, by - 70]], 1, 6, 0.5);
    fillPts(g, '#ff6a4a', ellipsePts(bx - 2, by - 48, 12, 16, 12, 0, 0.15, r), 0, 1, 0.5);
    fillPts(g, '#ffd0a0', ellipsePts(bx - 8, by - 62, 4, 6, 8, -0.4, 0.1, r), 0, 1, 0.5);
    for (let k = 0; k < 6; k++) { const a = k * 1.1; line(l, [[bx, by - 96], [bx + Math.sin(a) * 18, by - 66], [bx + Math.sin(a) * 26, by - 30]], 1, 'rgba(30,4,6,0.75)'); }
    g.fillStyle = '#3a1a12'; for (let k = 0; k < 6; k++) taper(g, [[bx, by - 98], [bx + (k - 2.5) * 5, by - 112], [bx + (k - 2.5) * 8, by - 120]], (t) => 2 - t * 1.4);
  }),
  icon_meat: (s) => icon(s, ({ g, l, bx, by }, r) => steak(g, l, bx, by, r, false)),
  icon_meat_cooked: (s) => icon(s, ({ g, l, bx, by }, r) => steak(g, l, bx, by, r, true)),
  icon_reed: (s) => icon(s, ({ g, l, bx, by }, r) => {
    const wy = by - 46;
    for (let k = 0; k < 9; k++) { const f = k / 8 * 2 - 1, tip: P = [bx + f * 26 + (r() - 0.5) * 6, by - 112 - (1 - Math.abs(f)) * 10];
      blade(g, [bx + f * 4, by], tip, f * 3, 2.6, k % 2 ? '#7d8a45' : '#a09a58');
      if (k % 2 === 0) { g.fillStyle = '#5a3820'; g.beginPath(); g.ellipse(tip[0] - f * 2, tip[1] + 14, 4, 11, f * 0.25, 0, Math.PI * 2); g.fill(); g.fillStyle = '#8a5a34'; g.beginPath(); g.ellipse(tip[0] - f * 2 - 1.4, tip[1] + 11, 1.4, 7, f * 0.25, 0, Math.PI * 2); g.fill(); } }
    for (let k = 0; k < 6; k++) { const f = k / 5 * 2 - 1; blade(g, [bx + f * 3, wy], [bx + f * 20, wy - 46], f * 4, 2.2, '#8e9a48'); }
    g.fillStyle = CORD.d; taper(g, [[bx - 10, wy], [bx + 10, wy]], () => 5); g.fillStyle = CORD.l; taper(g, [[bx - 9, wy - 1.5], [bx + 9, wy - 1.5]], () => 1.5);
    line(l, [[bx - 10, wy + 2.5], [bx + 10, wy + 2.5]], 0.8);
  }),
  icon_mushroom: (s) => icon(s, ({ g, l, bx, by }, r) => {
    fillPts(g, '#cdbf9e', [[bx - 14, by - 2], [bx - 12, by - 52], [bx + 12, by - 52], [bx + 16, by - 2]], 0.6, 3, 0.4);
    fillPts(g, '#f0e6cc', [[bx - 12, by - 4], [bx - 10, by - 50], [bx, by - 50], [bx - 2, by - 4]], 0, 1, 0.4);
    fillPts(g, '#8e8068', [[bx - 30, by - 54], [bx + 32, by - 54], [bx + 26, by - 46], [bx - 26, by - 46]], 0, 1, 0.4);
    const cap: P[] = [[bx - 46, by - 50], [bx - 40, by - 86], [bx - 10, by - 116], [bx + 18, by - 114], [bx + 44, by - 88], [bx + 48, by - 52]];
    fillPts(g, '#8a1a14', cap, 0.8, 4, 0.5);
    fillPts(g, '#cc3222', [[bx - 42, by - 56], [bx - 34, by - 88], [bx - 8, by - 110], [bx + 14, by - 108], [bx + 22, by - 80], [bx - 10, by - 62]], 0.8, 5, 0.5);
    fillPts(g, '#ff7a5a', ellipsePts(bx - 14, by - 96, 12, 6, 10, -0.5, 0.1, r), 0, 1, 0.5);
    for (const [x, y, rr] of [[-26, -78, 5], [-4, -96, 6], [18, -92, 4.5], [30, -70, 5], [-36, -60, 3.5], [6, -70, 4], [-14, -64, 3.5]] as [number, number, number][]) fillPts(g, '#f6eedc', ellipsePts(bx + x, by + y, rr, rr * 0.8, 9, 0, 0.2, r), 0, 1, 0.5);
    line(l, [[bx - 44, by - 52], [bx, by - 56], [bx + 46, by - 52]], 1.2);
  }),
  icon_mushroom_cooked: (s) => icon(s, ({ g, l, bx, by }, r) => {
    stick(g, l, [bx - 28, by - 2], [bx + 26, by - 124], 3.4, 2.2, { b: '#9a7a4c', d: '#5e4628', l: '#d0b080' });
    for (let k = 0; k < 4; k++) { const t = 0.22 + k * 0.19, x = bx - 28 + 54 * t, y = by - 2 - 122 * t;
      fillPts(g, '#3e2410', ellipsePts(x, y, 13, 10, 12, 0.3, 0.15, r), 0.6, k, 0.5);
      fillPts(g, '#7a4a22', ellipsePts(x - 2, y - 2, 10, 7, 12, 0.3, 0.15, r), 0.6, k + 9, 0.5);
      fillPts(g, '#b47a3e', ellipsePts(x - 4, y - 4, 4, 2.6, 8, 0.3, 0.1, r), 0, 1, 0.5);
      line(l, [[x - 9, y + 3], [x + 7, y - 5]], 1.2, 'rgba(20,8,2,0.75)'); }
  }),
};

function carrot(g: Ctx, l: Ctx, bx: number, by: number, r: Rand, cooked: boolean) {
  const top: P = [bx + 2, by - 84], tip: P = [bx - 12, by - 2];
  if (!cooked) for (let k = 0; k < 6; k++) { const a = -Math.PI / 2 + (k - 2.5) * 0.28; g.fillStyle = k % 2 ? '#4f7a32' : '#6e9a3e';
    taper(g, quadPts([top[0], top[1] + 2], [top[0] + Math.cos(a) * 20, top[1] + Math.sin(a) * 22], [top[0] + Math.cos(a) * 30 + (r() - 0.5) * 6, top[1] + Math.sin(a) * 40], 8), (t) => 2.4 - t * 1.6);
    for (let j = 0; j < 3; j++) leafShape(g, top[0] + Math.cos(a) * (14 + j * 8), top[1] + Math.sin(a) * (16 + j * 9), 9, 3.4, a + (j % 2 ? 0.8 : -0.8)); }
  else { g.fillStyle = '#3a2a14'; for (let k = 0; k < 3; k++) taper(g, [[top[0], top[1]], [top[0] + (k - 1) * 6, top[1] - 12]], (t) => 2 - t); }
  const body = [top, [bx - 2, by - 40], tip] as P[];
  g.fillStyle = cooked ? '#5a2a10' : '#a8461a'; taper(g, quadPts(body[0], body[1], body[2], 12), (t) => 15 * (1 - t) + 1);
  g.fillStyle = cooked ? '#a65a24' : '#ec7a2a'; taper(g, quadPts([top[0] - 3, top[1] + 2], [bx - 5, by - 40], [tip[0] - 1, tip[1] - 2], 12), (t) => 10 * (1 - t) + 0.6);
  g.fillStyle = cooked ? '#d08a44' : '#ffb06a'; taper(g, quadPts([top[0] - 7, top[1] + 6], [bx - 9, by - 44], [bx - 10, by - 24], 10), (t) => 3 * (1 - t) + 0.4);
  for (let k = 1; k < 7; k++) { const t = k / 7, x = top[0] + (tip[0] - top[0]) * t, y = top[1] + (tip[1] - top[1]) * t, w = 14 * (1 - t);
    line(l, [[x - w, y - 1], [x - w * 0.3, y + 1.5]], 0.9, 'rgba(70,24,6,0.6)'); }
  if (cooked) for (let k = 0; k < 3; k++) { const y = by - 70 + k * 18; line(l, [[bx - 14 + k * 2, y + 4], [bx + 12 - k * 2, y - 6]], 2.2, 'rgba(20,8,2,0.8)'); }
}
function steak(g: Ctx, l: Ctx, bx: number, by: number, r: Rand, cooked: boolean) {
  const sh: P[] = [[bx - 48, by - 30], [bx - 40, by - 82], [bx - 6, by - 110], [bx + 34, by - 104], [bx + 50, by - 70], [bx + 40, by - 24], [bx + 6, by - 4], [bx - 30, by - 8]];
  fillPts(g, cooked ? '#3a1c0c' : '#6a1414', sh, 1.2, 6, 0.5);
  fillPts(g, cooked ? '#7a4220' : '#b0302e', sh.map(([x, y]) => [bx + (x - bx) * 0.86 - 3, by - 56 + (y - by + 56) * 0.86 - 3] as P), 1.2, 7, 0.5);
  fillPts(g, cooked ? '#a8642e' : '#d8564a', ellipsePts(bx - 16, by - 76, 16, 10, 12, -0.5, 0.15, r), 0, 1, 0.5);
  if (!cooked) {
    g.strokeStyle = 'rgba(232,200,180,0.75)'; g.lineWidth = 2.6; g.beginPath(); smoothClosed(g, sh.map(([x, y]) => [bx + (x - bx) * 0.95, by - 56 + (y - by + 56) * 0.95] as P), 0.5); g.stroke();
    g.strokeStyle = 'rgba(240,200,190,0.55)'; g.lineWidth = 1.1;
    for (let k = 0; k < 7; k++) { g.beginPath(); smoothOpen2(g, [[bx - 30 + r() * 20, by - 30 - r() * 50], [bx + (r() - 0.5) * 30, by - 56 + (r() - 0.5) * 30], [bx + 10 + r() * 24, by - 40 - r() * 50]]); g.stroke(); }
  } else {
    g.strokeStyle = '#d89a5a'; g.lineWidth = 3; g.beginPath(); smoothClosed(g, sh.map(([x, y]) => [bx + (x - bx) * 0.95, by - 56 + (y - by + 56) * 0.95] as P), 0.5); g.stroke();
    for (let k = 0; k < 4; k++) line(l, [[bx - 36 + k * 18, by - 18], [bx - 6 + k * 18, by - 98]], 3, 'rgba(18,6,2,0.8)');
  }
}
function smoothOpen2(g: Ctx, pts: P[]) { g.moveTo(pts[0][0], pts[0][1]); g.quadraticCurveTo(pts[1][0], pts[1][1], pts[2][0], pts[2][1]); }

// —— 工具（输出 handle / head：柄端 → 头端，与手绘 manifest 的 rig.tools 同义） ——
const T: Record<string, (s: number) => GenOut> = {
  icon_axe: (s) => icon(s, ({ g, l, bx, by }) => {
    const h0: P = [bx - 18, by], h1: P = [bx + 10, by - 128];
    stick(g, l, h0, h1, 5.5, 4.5, WOOD, 4);
    const hc: P = [bx + 6, by - 108];
    const blade: P[] = [[hc[0] - 4, hc[1] - 10], [hc[0] + 22, hc[1] - 22], [hc[0] + 34, hc[1] - 6], [hc[0] + 30, hc[1] + 16], [hc[0] + 20, hc[1] + 18], [hc[0] - 2, hc[1] + 8]];
    fillPts(g, '#3c3e44', blade, 0, 1, 0.3);
    fillPts(g, '#7a808c', [[hc[0] + 4, hc[1] - 12], [hc[0] + 22, hc[1] - 20], [hc[0] + 28, hc[1] - 4], [hc[0] + 10, hc[1]]], 0, 1, 0.3);
    line(l, [[hc[0] + 33, hc[1] - 6], [hc[0] + 30, hc[1] + 16]], 1.8, 'rgba(235,240,250,0.8)');
    lash(g, l, [hc[0] + 1, hc[1]], Math.atan2(h1[1] - h0[1], h1[0] - h0[0]), 6);
    return { handle: h0, head: h1 };
  }),
  icon_pickaxe: (s) => icon(s, ({ g, l, bx, by }) => {
    const h0: P = [bx - 30, by], h1: P = [bx + 18, by - 120];
    stick(g, l, h0, h1, 5.5, 4.5, WOOD, 3);
    const c: P = [bx + 15, by - 112];
    const head = quadPts([c[0] - 46, c[1] + 22], [c[0] - 4, c[1] - 16], [c[0] + 50, c[1] + 4], 14);
    g.fillStyle = '#34363c'; taper(g, head, (t) => 7 * Math.sin(Math.PI * (0.08 + 0.84 * t)) + 1);
    g.fillStyle = '#80868f'; taper(g, head.map(([x, y]) => [x - 1, y - 2.5] as P), (t) => 3 * Math.sin(Math.PI * (0.1 + 0.8 * t)) + 0.5);
    lash(g, l, c, Math.atan2(h1[1] - h0[1], h1[0] - h0[0]), 7);
    return { handle: h0, head: h1 };
  }),
  icon_torch: (s) => icon(s, ({ g, l, bx, by }, r) => {
    const h0: P = [bx - 22, by], h1: P = [bx + 14, by - 126];
    stick(g, l, h0, h1, 5, 6, WOOD, 3);
    const c: P = [bx + 10, by - 106];
    fillPts(g, '#4a3a2a', ellipsePts(c[0], c[1], 9, 14, 12, 0.28, 0.15, r), 0, 1, 0.5);
    for (let k = 0; k < 3; k++) line(l, [[c[0] - 9, c[1] - 8 + k * 7], [c[0] + 9, c[1] - 12 + k * 7]], 1.4, 'rgba(20,12,6,0.7)');
    glow(g, c[0] + 2, c[1] - 26, 34, 'rgba(255,160,60,0.45)');
    flame(g, c[0] + 2, c[1] - 6, 44, 14, r);
    return { handle: h0, head: h1 };
  }),
  icon_spear: (s) => icon(s, ({ g, l, bx, by }) => {
    const h0: P = [bx - 26, by], h1: P = [bx + 22, by - 132];
    const ang = Math.atan2(h1[1] - h0[1], h1[0] - h0[0]), ca = Math.cos(ang), sa = Math.sin(ang);
    stick(g, l, h0, [h1[0] - ca * 26, h1[1] - sa * 26], 3.6, 3.2);
    const b: P = [h1[0] - ca * 30, h1[1] - sa * 30], nx = -sa, ny = ca;
    const tip: P[] = [h1, [b[0] + nx * 8 + ca * 8, b[1] + ny * 8 + sa * 8], [b[0], b[1]], [b[0] - nx * 8 + ca * 8, b[1] - ny * 8 + sa * 8]];
    fillPts(g, '#24262d', tip, 0, 1, 0.05);
    fillPts(g, '#7c8494', [h1, [b[0] - nx * 7 + ca * 8, b[1] - ny * 7 + sa * 8], [b[0] + ca * 6, b[1] + sa * 6]], 0, 1, 0.05);
    lash(g, l, [b[0] - ca * 2, b[1] - sa * 2], ang, 4.5, 3);
    return { handle: h0, head: h1 };
  }),
  icon_spear2: (s) => icon(s, ({ g, l, bx, by }) => {
    const h0: P = [bx - 20, by], h1: P = [bx + 18, by - 134];
    const ang = Math.atan2(h1[1] - h0[1], h1[0] - h0[0]), ca = Math.cos(ang), sa = Math.sin(ang), nx = -sa, ny = ca;
    stick(g, l, h0, [h1[0] - ca * 38, h1[1] - sa * 38], 3.6, 3.2, { b: '#5a3a24', d: '#2e1c10', l: '#8a6040' });
    const b: P = [h1[0] - ca * 42, h1[1] - sa * 42];
    fillPts(g, '#d8ccb0', [h1, [b[0] + nx * 6 + ca * 12, b[1] + ny * 6 + sa * 12], [b[0], b[1]], [b[0] - nx * 6 + ca * 12, b[1] - ny * 6 + sa * 12]], 0, 1, 0.3);
    fillPts(g, '#8e8268', [h1, [b[0] + nx * 5 + ca * 12, b[1] + ny * 5 + sa * 12], [b[0], b[1]]], 0, 1, 0.3);
    lash(g, l, [b[0] - ca * 3, b[1] - sa * 3], ang, 4.5, 4);
    g.fillStyle = '#9a2a20'; taper(g, [[b[0] - ca * 6, b[1] - sa * 6], [b[0] - ca * 6 + nx * 10, b[1] - sa * 6 + ny * 10 + 8], [b[0] - ca * 4 + nx * 8, b[1] + 22]], (t) => 2.4 - t * 1.6);
    return { handle: h0, head: h1 };
  }),
  icon_lantern: (s) => icon(s, ({ g, l, bx, by }, r) => {
    const cy = by - 62;
    glow(g, bx, cy, 66, 'rgba(255,150,60,0.5)');
    g.strokeStyle = '#2a1c10'; g.lineWidth = 3; g.beginPath(); g.arc(bx, by - 124, 9, Math.PI, 0); g.stroke();
    fillPts(g, '#2a1c12', [[bx - 14, by - 112], [bx + 14, by - 112], [bx + 12, by - 102], [bx - 12, by - 102]], 0, 1, 0.3);
    fillPts(g, '#9a2a14', ellipsePts(bx, cy, 28, 40, 18, 0, 0.02, r), 0, 1, 0.5);
    fillPts(g, '#e8662a', ellipsePts(bx - 2, cy, 22, 36, 18, 0, 0.02, r), 0, 1, 0.5);
    fillPts(g, '#ffc860', ellipsePts(bx - 4, cy - 2, 11, 24, 14, 0, 0.02, r), 0, 1, 0.5);
    for (const f of [-0.75, -0.4, 0, 0.4, 0.75]) { l.strokeStyle = 'rgba(60,16,6,0.6)'; l.lineWidth = 1; l.beginPath(); l.ellipse(bx, cy, Math.abs(f) * 28 + 0.5, 40, 0, f < 0 ? Math.PI / 2 : -Math.PI / 2, f < 0 ? Math.PI * 1.5 : Math.PI / 2); l.stroke(); }
    for (let k = 0; k < 5; k++) line(l, [[bx - 27 + (k === 0 || k === 4 ? 5 : 0), cy - 30 + k * 15], [bx + 27 - (k === 0 || k === 4 ? 5 : 0), cy - 30 + k * 15]], 0.8, 'rgba(70,20,8,0.5)');
    fillPts(g, '#2a1c12', [[bx - 12, by - 22], [bx + 12, by - 22], [bx + 10, by - 14], [bx - 10, by - 14]], 0, 1, 0.3);
    g.fillStyle = '#b02a1a'; for (let k = 0; k < 4; k++) taper(g, [[bx - 3 + k * 2, by - 14], [bx - 4 + k * 2.6, by]], () => 1.4);
    return { handle: [bx, by] as P, head: [bx, by - 128] as P };
  }),
};

// —— 装备 ——
const E: Record<string, (s: number) => GenOut> = {
  icon_backpack: (s) => icon(s, ({ g, l, bx, by }) => {
    const sh: P[] = [[bx - 42, by - 8], [bx - 46, by - 90], [bx - 30, by - 112], [bx + 30, by - 112], [bx + 46, by - 90], [bx + 42, by - 8]];
    g.strokeStyle = '#4a3020'; g.lineWidth = 7; g.beginPath(); g.moveTo(bx - 24, by - 108); g.bezierCurveTo(bx - 70, by - 120, bx - 70, by - 30, bx - 40, by - 20); g.stroke();
    fillPts(g, '#6e4c2a', sh, 0.8, 4, 0.35);
    g.save(); g.beginPath(); smoothClosed(g, sh, 0.35); g.clip();
    for (let y = by - 110; y < by; y += 7) for (let x = bx - 50; x < bx + 50; x += 9) { const o = ((y / 7) | 0) % 2 ? 4.5 : 0; g.fillStyle = (((x + o) / 9) | 0) % 2 ? '#a07a46' : '#8a6438'; g.beginPath(); g.ellipse(x + o, y, 4.6, 3, 0, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = 'rgba(30,18,8,0.35)'; g.fillRect(bx + 14, by - 120, 40, 130);
    g.restore();
    fillPts(g, '#5a3a20', [[bx - 44, by - 96], [bx - 30, by - 116], [bx + 30, by - 116], [bx + 44, by - 96], [bx + 30, by - 72], [bx - 30, by - 72]], 0.6, 5, 0.4);
    fillPts(g, '#8a5e34', [[bx - 38, by - 98], [bx - 26, by - 112], [bx + 10, by - 112], [bx - 6, by - 80], [bx - 28, by - 80]], 0.6, 6, 0.4);
    g.fillStyle = '#c8a46a'; g.beginPath(); g.ellipse(bx, by - 74, 5, 4, 0, 0, Math.PI * 2); g.fill();
    line(l, [[bx - 30, by - 72], [bx + 30, by - 72]], 1.2);
  }),
  icon_armor_grass: (s) => icon(s, ({ g, l, bx, by }, r) => vest(g, l, bx, by, r, 'grass')),
  icon_armor_wood: (s) => icon(s, ({ g, l, bx, by }, r) => vest(g, l, bx, by, r, 'wood')),
  icon_garland: (s) => icon(s, ({ g, bx, by }, r) => {
    const cx = bx, cy = by - 60;
    for (let k = 0; k < 44; k++) { const a = k / 44 * Math.PI * 2, rr = 44 + (r() - 0.5) * 6; g.fillStyle = r() < 0.5 ? '#3e5a2a' : '#5e7a36'; leafShape(g, cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.92, 14, 5, a + Math.PI / 2 + (r() - 0.5)); }
    const FC = [['#c22a2a', '#ffb0a0'], ['#e0b030', '#fff0a0'], ['#4a5ab8', '#b0c0ff'], ['#ece4d0', '#ffffff'], ['#9a3a8a', '#f0b0e0']];
    for (let k = 0; k < 14; k++) { const a = k / 14 * Math.PI * 2 + 0.2, [c1, c2] = FC[k % FC.length], x = cx + Math.cos(a) * 44, y = cy + Math.sin(a) * 40;
      for (let p = 0; p < 5; p++) { const pa = p / 5 * Math.PI * 2 + a; g.fillStyle = c1; g.beginPath(); g.ellipse(x + Math.cos(pa) * 5, y + Math.sin(pa) * 5, 4.6, 3, pa, 0, Math.PI * 2); g.fill(); }
      g.fillStyle = c2; g.beginPath(); g.arc(x - 1, y - 1, 2.4, 0, Math.PI * 2); g.fill(); g.fillStyle = '#6a4a1a'; g.beginPath(); g.arc(x, y, 1.6, 0, Math.PI * 2); g.fill(); }
  }),
  icon_salve: (s) => icon(s, ({ g, l, bx, by }, r) => {
    const pot: P[] = [[bx - 26, by - 4], [bx - 46, by - 40], [bx - 40, by - 76], [bx - 30, by - 86], [bx + 30, by - 86], [bx + 40, by - 76], [bx + 46, by - 40], [bx + 26, by - 4]];
    fillPts(g, '#6a3018', pot, 0.6, 3, 0.5);
    fillPts(g, '#a8542a', [[bx - 22, by - 8], [bx - 40, by - 40], [bx - 34, by - 74], [bx + 4, by - 78], [bx - 4, by - 30]], 0.8, 4, 0.5);
    fillPts(g, '#d88a52', ellipsePts(bx - 22, by - 52, 6, 14, 10, 0.1, 0.1, r), 0, 1, 0.5);
    fillPts(g, '#5a7a3a', ellipsePts(bx, by - 88, 30, 7, 14, 0, 0.1, r), 0, 1, 0.5);
    fillPts(g, '#8aae5a', ellipsePts(bx - 6, by - 90, 16, 3.4, 12, 0, 0.1, r), 0, 1, 0.5);
    const cloth: P[] = [[bx - 44, by - 88], [bx - 30, by - 100], [bx - 6, by - 96], [bx - 2, by - 84], [bx - 20, by - 70], [bx - 38, by - 66]];
    fillPts(g, '#c8b48a', cloth, 0.8, 9, 0.45); fillPts(g, '#e6d6aa', [[bx - 40, by - 88], [bx - 28, by - 98], [bx - 14, by - 94], [bx - 30, by - 82]], 0.6, 10, 0.45);
    g.strokeStyle = CORD.d; g.lineWidth = 2.6; g.beginPath(); g.ellipse(bx, by - 80, 38, 6, 0, 0.1, Math.PI - 0.1); g.stroke();
    line(l, [[bx - 38, by - 78], [bx, by - 72], [bx + 38, by - 78]], 1);
    for (let k = 0; k < 3; k++) line(l, [[bx - 30 + k * 26, by - 30], [bx - 20 + k * 26, by - 26]], 1, 'rgba(30,12,4,0.5)');
  }),
};
function vest(g: Ctx, l: Ctx, bx: number, by: number, r: Rand, kind: 'grass' | 'wood') {
  const sh: P[] = [[bx - 18, by - 122], [bx - 6, by - 108], [bx + 6, by - 108], [bx + 18, by - 122], [bx + 34, by - 116], [bx + 36, by - 84], [bx + 44, by - 76], [bx + 44, by - 4], [bx - 44, by - 4], [bx - 44, by - 76], [bx - 36, by - 84], [bx - 34, by - 116]];
  if (kind === 'grass') {
    const ST = ['#7a6234', '#94783e', '#ab8f50', '#6a5a2e', '#857a3e'];
    fillPts(g, '#5a4a24', sh, 0.6, 3, 0.3);
    g.save(); g.beginPath(); smoothClosed(g, sh, 0.3); g.clip();
    for (let row = 0; row < 6; row++) for (let k = 0; k < 22; k++) { const x = bx - 48 + k * 4.6 + (r() - 0.5) * 2, y0 = by - 124 + row * 20; blade(g, [x, y0], [x + (r() - 0.5) * 4, y0 + 28 + r() * 6], (r() - 0.5) * 3, 2.4, ST[Math.floor(r() * ST.length)]); }
    g.fillStyle = 'rgba(20,16,4,0.35)'; g.fillRect(bx + 12, by - 130, 40, 140);
    g.restore();
    for (let k = 0; k < 16; k++) { const x = bx - 44 + k * 5.8; blade(g, [x, by - 8], [x + (r() - 0.5) * 6, by + 6 + r() * 6], 0, 2, ST[Math.floor(r() * 4)]); }
    g.fillStyle = CORD.b; taper(g, [[bx - 44, by - 60], [bx + 44, by - 62]], () => 3.4);
  } else {
    fillPts(g, WOOD.d, sh, 0.4, 3, 0.2);
    g.save(); g.beginPath(); smoothClosed(g, sh, 0.2); g.clip();
    for (let k = 0; k < 9; k++) { const x = bx - 44 + k * 10; fillPts(g, k % 2 ? WOOD.b : '#8a5e38', [[x + 1, by - 130], [x + 9, by - 130], [x + 9, by + 4], [x + 1, by + 4]], 0, 1, 0.1); fillPts(g, WOOD.l, [[x + 2, by - 130], [x + 4, by - 130], [x + 4, by + 4], [x + 2, by + 4]], 0, 1, 0.1);
      line(l, [[x + 10, by - 130], [x + 10, by + 4]], 1.2, 'rgba(20,10,4,0.7)'); for (let j = 0; j < 3; j++) line(l, [[x + 3, by - 100 + j * 30 + r() * 8], [x + 7, by - 96 + j * 30 + r() * 8]], 0.8, 'rgba(30,14,6,0.5)'); }
    g.fillStyle = 'rgba(20,10,4,0.35)'; g.fillRect(bx + 14, by - 130, 40, 140);
    g.restore();
    for (const y of [by - 82, by - 40]) { g.fillStyle = CORD.b; taper(g, [[bx - 44, y], [bx + 44, y - 2]], () => 3.4); g.fillStyle = CORD.l; taper(g, [[bx - 44, y - 1.2], [bx + 44, y - 3.2]], () => 1); }
  }
  line(l, [[bx - 6, by - 108], [bx, by - 96], [bx + 6, by - 108]], 1.2);
}

let i = 0;
for (const [name, gen] of Object.entries({ ...G, ...T, ...E })) register({ name, kind: 'sprite', group: 'icons', seed: 1101 + i++, gen });
void wobble;
