/**
 * 火堆 / 火塘：石环 + 柴堆（新柴为锥形柴架，熄灭后为塌落的焦炭）。
 * 输出与资源包同名的三张图：<kind>_base、<kind>_burnt、<kind>_base_front（前排石头层，压住火焰根部），
 * 并在 meta.fireCenter 给出石环中心离落脚点的高度（世界单位），游戏据此摆放火焰与光源。
 */
import { register, cropAlpha, GenOut } from '../registry';
import { rng, Rand } from '../noise';
import { canvas, wash } from '../wash';
import { P, smoothClosed, wobble, ellipsePts, taper } from '../brush';

type Ctx = CanvasRenderingContext2D;
export const FIRE_PAL = {
  stone: '#46423d', stoneL: '#736c63', stoneD: '#2b2825', stoneU: '#221f1c',
  log: '#5b3a26', logL: '#8f5c39', logD: '#311e15', end: '#c79c68', endD: '#8a6440',
  char: '#1d1714', charL: '#575049', ember: '#c4521f', ash: '#6a635a', ashL: '#aaa294', bed: '#2a221d',
  ink: 'rgba(22,14,10,0.6)',
};

interface Stone { x: number; y: number; rx: number; ry: number; rot: number; seed: number; front: boolean }

function stone(g: Ctx, lg: Ctx, s: Stone, r: Rand) {
  const body = wobble(ellipsePts(s.x, s.y, s.rx, s.ry, 12, s.rot, 0.12, r), 1.4, s.seed, 5);
  const path = new Path2D(); smoothClosed(path, body, 0.5);
  if (s.front) { lg.save(); lg.globalCompositeOperation = 'destination-out'; lg.fill(path); lg.restore(); }   // 前排石头挡住后面的墨线
  g.fillStyle = FIRE_PAL.stone; g.fill(path);
  g.save(); g.clip(path);
  g.fillStyle = FIRE_PAL.stoneD;   // 背光下半
  g.beginPath(); smoothClosed(g, wobble(ellipsePts(s.x + s.rx * 0.25, s.y + s.ry * 0.55, s.rx * 1.05, s.ry * 0.75, 10, s.rot, 0.1, r), 1.2, s.seed + 1, 5)); g.fill();
  g.fillStyle = FIRE_PAL.stoneL;   // 迎光顶面：带棱角的切面
  const fx = s.x - s.rx * 0.2, fy = s.y - s.ry * 0.4;
  g.beginPath(); smoothClosed(g, [[fx - s.rx * 0.7, fy + s.ry * 0.15], [fx - s.rx * 0.25, fy - s.ry * 0.5], [fx + s.rx * (0.35 + 0.2 * r()), fy - s.ry * 0.45], [fx + s.rx * 0.55, fy + s.ry * 0.05], [fx + s.rx * 0.05, fy + s.ry * (0.3 + 0.15 * r())]], 0.12); g.fill();
  g.restore();
  g.save(); g.strokeStyle = 'rgba(20,16,13,0.85)'; g.lineWidth = 1.3; g.stroke(path); g.restore();
  // 裂纹墨线
  if (r() < 0.6) { lg.save(); lg.strokeStyle = FIRE_PAL.ink; lg.lineWidth = 1; lg.lineCap = 'round';
    const a = r() * Math.PI; lg.beginPath(); lg.moveTo(s.x - Math.cos(a) * s.rx * 0.5, s.y - s.ry * 0.1); lg.quadraticCurveTo(s.x, s.y + s.ry * 0.2, s.x + Math.cos(a) * s.rx * 0.3, s.y + s.ry * 0.35); lg.stroke(); lg.restore(); }
}

function log(g: Ctx, lg: Ctx, a: P, b: P, w: number, r: Rand, charred: boolean, cap: boolean) {
  const line: P[] = []; for (let i = 0; i <= 8; i++) { const t = i / 8; line.push([a[0] + (b[0] - a[0]) * t + Math.sin(t * 5 + w) * 0.8, a[1] + (b[1] - a[1]) * t]); }
  const wf = (t: number) => w * (1 - t * 0.25);
  g.fillStyle = charred ? FIRE_PAL.char : FIRE_PAL.log; taper(g, line, wf);
  const dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy), nx = -dy / d, ny = dx / d;
  const sgn = nx > 0 ? 1 : -1;   // 法线朝右的一侧为背光
  g.fillStyle = charred ? '#120d0b' : FIRE_PAL.logD; taper(g, line.map(([x, y], i) => [x + nx * sgn * wf(i / 8) * 0.5, y + ny * sgn * wf(i / 8) * 0.5] as P), (t) => wf(t) * 0.5);
  g.fillStyle = charred ? FIRE_PAL.charL : FIRE_PAL.logL; taper(g, line.map(([x, y], i) => [x - nx * sgn * wf(i / 8) * 0.55, y - ny * sgn * wf(i / 8) * 0.55] as P), (t) => wf(t) * 0.22);
  // 两条长边的墨线（画在色层，保持前后遮挡）
  g.save(); g.strokeStyle = 'rgba(18,12,9,0.9)'; g.lineCap = 'round';
  for (const k of [1, -1]) { g.lineWidth = k === sgn ? 1.6 : 0.9; g.beginPath(); line.forEach(([x, y], i) => { const hw = wf(i / 8) * 0.98; const px = x + nx * k * hw, py = y + ny * k * hw; if (i) g.lineTo(px, py); else g.moveTo(px, py); }); g.stroke(); }
  g.restore();
  if (charred) {   // 炭裂里的暗红余烬 + 灰白灰烬
    g.strokeStyle = FIRE_PAL.ember; g.lineWidth = 1.3; g.globalAlpha = 0.8;
    for (let i = 0; i < 4; i++) { const t = 0.15 + r() * 0.7, x = a[0] + dx * t, y = a[1] + dy * t; g.beginPath(); g.moveTo(x + nx * w * 0.4, y + ny * w * 0.4); g.lineTo(x - nx * w * 0.3 + dx / d * 3, y - ny * w * 0.3 + dy / d * 3); g.stroke(); }
    g.globalAlpha = 1; g.fillStyle = FIRE_PAL.ashL;
    for (let i = 0; i < 3; i++) { const t = r(), x = a[0] + dx * t - nx * sgn * w * 0.5, y = a[1] + dy * t - ny * sgn * w * 0.5; g.beginPath(); g.ellipse(x, y, 2 + r() * 2.5, 1.2 + r(), Math.atan2(dy, dx), 0, Math.PI * 2); g.fill(); }
  } else {
    lg.save(); lg.strokeStyle = FIRE_PAL.ink; lg.lineWidth = 0.9; lg.lineCap = 'round';
    for (let i = 0; i < 3; i++) { const t = 0.15 + r() * 0.6, l = 0.12 + r() * 0.2; lg.beginPath(); lg.moveTo(a[0] + dx * t + nx * w * 0.2, a[1] + dy * t + ny * w * 0.2); lg.lineTo(a[0] + dx * (t + l), a[1] + dy * (t + l)); lg.stroke(); }
    lg.restore();
  }
  if (cap) {   // 柴的截面（年轮）
    const ang = Math.atan2(dy, dx);
    g.fillStyle = charred ? FIRE_PAL.charL : FIRE_PAL.end;
    g.beginPath(); g.ellipse(a[0], a[1], w * 0.95, w * 0.62, ang + Math.PI / 2, 0, Math.PI * 2); g.fill();
    g.save(); g.strokeStyle = 'rgba(18,12,9,0.85)'; g.lineWidth = 1;
    g.beginPath(); g.ellipse(a[0], a[1], w * 0.95, w * 0.62, ang + Math.PI / 2, 0, Math.PI * 2); g.stroke();
    g.strokeStyle = charred ? 'rgba(18,12,9,0.6)' : FIRE_PAL.endD;
    g.beginPath(); g.ellipse(a[0] + 0.5, a[1], w * 0.5, w * 0.32, ang + Math.PI / 2, 0, Math.PI * 2); g.stroke(); g.restore();
  }
}

export interface FireCfg { widthU: number; rx: number; ry: number; stones: number; stoneR: number; logs: number; seed: number }

function build(c: FireCfg, burnt: boolean): { base: GenOut; front?: GenOut } {
  const U = 84, r = rng(c.seed), rB = rng(c.seed + 7);
  const CW = Math.ceil(c.widthU * U + 90), CH = Math.ceil(c.widthU * U * 0.9 + 90);
  const [cv, g] = canvas(CW, CH), [lc, lg] = canvas(CW, CH), [fm, fg] = canvas(CW, CH);
  const cx = CW / 2, Rx = c.rx * U, Ry = c.ry * U, sr = c.stoneR * U;
  const cy = CH - 40 - Ry - sr * 0.55;
  const by = cy + Ry + sr * 0.62;
  // 石环
  const stones: Stone[] = [];
  for (let i = 0; i < c.stones; i++) {
    const a = (i / c.stones) * Math.PI * 2 + (r() - 0.5) * 0.25 + 0.2, sy = Math.sin(a);
    const k = 0.85 + 0.3 * r();
    stones.push({ x: cx + Math.cos(a) * Rx, y: cy + sy * Ry, rx: sr * k * (1.05 - 0.15 * Math.abs(Math.cos(a))), ry: sr * k * 0.72, rot: Math.cos(a) * 0.3 * sy + (r() - 0.5) * 0.3, seed: Math.floor(r() * 1e6), front: sy > 0.12 });
  }
  // 火床（灰烬 / 炭）
  g.fillStyle = burnt ? FIRE_PAL.ash : FIRE_PAL.bed;
  g.beginPath(); smoothClosed(g, wobble(ellipsePts(cx, cy + 2, Rx * 0.92, Ry * 0.9, 16, 0, 0.05, r), 2, c.seed + 3, 6)); g.fill();
  if (burnt) { g.fillStyle = FIRE_PAL.ashL; g.globalAlpha = 0.55;
    for (let i = 0; i < 9; i++) { g.beginPath(); g.ellipse(cx + (r() - 0.5) * Rx * 1.2, cy + (r() - 0.5) * Ry * 0.9, 4 + r() * 9, 2 + r() * 3, 0, 0, Math.PI * 2); g.fill(); }
    g.globalAlpha = 1; }
  const back = stones.filter((s) => !s.front).sort((a, b) => a.y - b.y), fr = stones.filter((s) => s.front).sort((a, b) => a.y - b.y);
  for (const s of back) stone(g, lg, s, r);
  // 柴
  const w = U * 0.105;
  if (!burnt) {
    const apex: P = [cx + (rB() - 0.5) * 4, cy - U * 0.78];
    const L = c.logs, ends: { p: P; f: number }[] = [];
    for (let i = 0; i < L; i++) { const a = (i / L) * Math.PI * 2 + 0.4; ends.push({ p: [cx + Math.cos(a) * Rx * 0.68, cy + Math.sin(a) * Ry * 0.7 + 4], f: Math.sin(a) }); }
    ends.sort((a, b) => a.f - b.f);
    for (const e of ends) { const t: P = [apex[0] - (e.p[0] - cx) * 0.18, apex[1] - U * 0.1 + (rB() - 0.5) * 6]; log(g, lg, e.p, t, w * (0.95 + rB() * 0.25), rB, false, e.f > -0.1); }
    // 引火细枝
    for (let i = 0; i < 3; i++) { const a = -0.6 + i * 0.6; log(g, lg, [cx + Math.cos(a + 1.6) * Rx * 0.45, cy + Ry * 0.35], [cx + (rB() - 0.5) * 8, cy - U * 0.4], w * 0.4, rB, false, false); }
  } else {
    // 塌落的焦柴：从环边斜靠向中心，交叉堆起
    const L = Math.max(4, c.logs - 1), ends: { p: P; f: number; a: number }[] = [];
    for (let i = 0; i < L; i++) { const a = (i / L) * Math.PI * 2 + 0.7 + rB() * 0.3; ends.push({ p: [cx + Math.cos(a) * Rx * 0.7, cy + Math.sin(a) * Ry * 0.72 + 3], f: Math.sin(a), a }); }
    ends.sort((a, b) => a.f - b.f);
    for (const e of ends) { const t: P = [cx - Math.cos(e.a) * Rx * 0.25 + (rB() - 0.5) * 6, cy - U * (0.18 + rB() * 0.14)]; log(g, lg, e.p, t, w * (1.0 + rB() * 0.25), rB, true, e.f > 0.2); }
  }
  for (const s of fr) { stone(g, lg, s, r); fg.fillStyle = '#fff'; fg.beginPath(); smoothClosed(fg, ellipsePts(s.x, s.y, s.rx + 4, s.ry + 4, 14, s.rot), 0.5); fg.fill(); }
  const out = wash(cv, { seed: c.seed + (burnt ? 1 : 0), bleed: 2.2, edgeR: 3.5, formR: 12, form: 0.32, pigScale: 14, rimAmt: 0.24, lines: lc });
  const cr = cropAlpha(out, 3);
  const ppu = cr.canvas.width / c.widthU;
  const pivot: [number, number] = [(cx - cr.ox) / cr.canvas.width, (by - cr.oy) / cr.canvas.height];
  const base: GenOut = { canvas: cr.canvas, pivot, meta: { fireCenter: +((by - cy) / ppu).toFixed(3) } };
  if (burnt) return { base };
  // 前排石头层：从同一张晕染结果里按前排石头的（略外扩）剪影裁出，像素与底座完全一致
  const [fc, fx] = canvas(cr.canvas.width, cr.canvas.height);
  fx.drawImage(cr.canvas, 0, 0);
  fx.globalCompositeOperation = 'destination-in';
  fx.drawImage(fm, -cr.ox, -cr.oy);
  return { base, front: { canvas: fc, pivot } };
}

export const FIRE_KINDS: Record<string, FireCfg> = {
  campfire: { widthU: 2.1, rx: 0.76, ry: 0.34, stones: 11, stoneR: 0.23, logs: 5, seed: 301 },
  firepit: { widthU: 2.5, rx: 0.95, ry: 0.42, stones: 14, stoneR: 0.24, logs: 6, seed: 401 },
};
const cache = new Map<string, ReturnType<typeof build>>();
const get = (k: string, burnt: boolean, seed: number) => {
  const id = k + burnt + seed;
  if (!cache.has(id)) cache.set(id, build({ ...FIRE_KINDS[k], seed }, burnt));
  return cache.get(id)!;
};
export function genFire(kind: string, burnt: boolean, seed = FIRE_KINDS[kind].seed) { return build({ ...FIRE_KINDS[kind], seed }, burnt); }
for (const k of Object.keys(FIRE_KINDS)) {
  const s0 = FIRE_KINDS[k].seed;
  register({ name: k + '_base', kind: 'sprite', group: 'campfire', seed: s0, gen: (s) => get(k, false, s).base });
  register({ name: k + '_base_front', kind: 'sprite', group: 'campfire', seed: s0, gen: (s) => get(k, false, s).front! });
  register({ name: k + '_burnt', kind: 'sprite', group: 'campfire', seed: s0, gen: (s) => get(k, true, s).base });
}
