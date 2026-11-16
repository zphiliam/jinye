/**
 * 生物：蜘蛛（参数化姿势 ×5 + 巢穴）、乌鸦（参数化姿势 ×4）、影怪。
 * 与手绘一致：同一种生物的各姿势画布等宽（资源包按宽度换算尺度），落脚点在底部。
 */
import { register, cropAlpha, GenOut } from '../registry';
import { rng, Rand } from '../noise';
import { wash, WashOpts, canvas } from '../wash';
import { P, smoothClosed, ellipsePts, taper, quadPts, wobble } from '../brush';
import { stage, Stage, fillPts, line } from '../kit';

type Ctx = CanvasRenderingContext2D;
const W_CREA: Partial<WashOpts> = { bleed: 1.7, inkAmt: 0.95, edge: 0.3, edgeR: 3, formR: 14, form: 0.36, pigScale: 14, pigment: 0.08, rimAmt: 0.28, rimW: 1.8, grain: 0.06 };

/** 固定画布宽度，只裁上下（同种生物各姿势尺度一致） */
function finishFixed(st: Stage, seed: number, W: number, o: Partial<WashOpts> = W_CREA, post?: (g: Ctx) => void, cx = st.bx): GenOut {
  const w = wash(st.cv, { seed, ...o, lines: st.lc } as WashOpts);
  if (post) post(w.getContext('2d')!);
  const cr = cropAlpha(w, 2);
  const x0 = Math.round(cx - W / 2);
  const [c, g] = canvas(W, cr.canvas.height);
  g.drawImage(w, -x0, -cr.oy);
  return { canvas: c, pivot: [(st.bx - x0) / W, (st.by - cr.oy) / cr.canvas.height] };
}

// —— 蜘蛛 ——
const SP = { body: '#18161a', mid: '#2b2729', lit: '#48403d', hi: '#6e655e', joint: '#5c524a', mark: '#e2d8c0', eye: '#ff3a22', belly: '#403936' };
interface SpPose { legs: (s: number, i: number) => { hip?: P; knee: P; foot: P }; ceph: P; abd: P; abdR: [number, number]; under?: boolean; fangs?: number; eyesDim?: boolean }

function leg(g: Ctx, l: Ctx, hip: P, knee: P, foot: P, w: number, r: Rand) {
  // 股节（粗）→ 膝 → 胫节（渐细）→ 跗节；关节处浅色环
  const ank: P = [knee[0] + (foot[0] - knee[0]) * 0.72, knee[1] + (foot[1] - knee[1]) * 0.72];
  const seg = (a: P, b: P, w0: number, w1: number, bend: number) => {
    const m: P = [(a[0] + b[0]) / 2 + bend * (b[1] - a[1]) * 0.08, (a[1] + b[1]) / 2 - bend * (b[0] - a[0]) * 0.08];
    const pts = quadPts(a, m, b, 8);
    g.fillStyle = SP.body; taper(g, pts, (t) => w0 + (w1 - w0) * t);
    g.fillStyle = SP.lit; taper(g, pts.map(([x, y]) => [x - w0 * 0.22, y - w0 * 0.28] as P), (t) => (w0 + (w1 - w0) * t) * 0.32);
    for (let k = 1; k < 7; k++) { const [x, y] = pts[k], ww = w0 + (w1 - w0) * k / 7, a2 = Math.atan2(b[1] - a[1], b[0] - a[0]) + (r() < 0.5 ? 1 : -1) * (1.1 + r() * 0.4);
      line(l, [[x, y], [x + Math.cos(a2) * ww * 1.1, y + Math.sin(a2) * ww * 1.1]], 0.7, 'rgba(20,12,8,0.7)'); }
    return pts;
  };
  seg(hip, knee, w, w * 0.8, 1);
  seg(knee, ank, w * 0.78, w * 0.45, -0.6);
  seg(ank, foot, w * 0.45, w * 0.18, 0);
  for (const [x, y] of [knee, ank]) { g.fillStyle = SP.joint; g.beginPath(); g.ellipse(x, y, w * 0.55, w * 0.42, 0, 0, Math.PI * 2); g.fill(); g.fillStyle = SP.body; g.beginPath(); g.ellipse(x + w * 0.15, y + w * 0.12, w * 0.35, w * 0.28, 0, 0, Math.PI * 2); g.fill(); }
}

function spider(seed: number, pose: SpPose, dead = false): GenOut {
  const r = rng(seed), st = stage(300, 320, 16), { g, l, bx, by } = st;
  const LW = 8.6;
  const legsOf = (back: boolean) => { for (const i of back ? [3, 2] : [1, 0]) for (const s of [-1, 1]) { const L = pose.legs(s, i); const hip = L.hip ?? [pose.ceph[0] + s * 14, pose.ceph[1] + (i - 1.5) * 4]; leg(g, l, hip, L.knee, L.foot, LW * (1 - i * 0.06), r); } };
  const abdomen = () => {
    const [ax, ay] = pose.abd, [rx, ry] = pose.abdR;
    fillPts(g, SP.body, ellipsePts(ax, ay, rx, ry, 22, 0, 0.03, r), 1.2, seed, 0.5);
    fillPts(g, pose.under ? SP.belly : SP.mid, ellipsePts(ax - rx * 0.12, ay - ry * 0.14, rx * 0.8, ry * 0.76, 18, 0, 0.04, r), 1, seed + 1, 0.5);
    fillPts(g, pose.under ? '#7a6250' : SP.lit, ellipsePts(ax - rx * 0.32, ay - ry * 0.4, rx * 0.36, ry * 0.26, 12, -0.5, 0.06, r), 0, 1, 0.5);
    // 毛
    for (let k = 0; k < 80; k++) { const a = r() * Math.PI * 2, d = Math.sqrt(r()); const x = ax + Math.cos(a) * rx * d, y = ay + Math.sin(a) * ry * d;
      line(l, [[x, y], [x + Math.cos(a) * 3, y + Math.sin(a) * 3 + 1]], 0.7, d > 0.6 ? 'rgba(15,8,4,0.6)' : 'rgba(150,120,90,0.35)'); }
    if (!pose.under) {   // 背上的骨白纹
      const top: P = [ax, ay - ry * 0.78], bot: P = [ax, ay + ry * 0.55];
      g.fillStyle = SP.mark; taper(g, [top, [ax + 1, ay - ry * 0.1], bot], (t) => 4.4 - t * 2.6);
      for (const [f, len] of [[0.22, 0.42], [0.42, 0.5], [0.62, 0.38], [0.8, 0.24]] as [number, number][]) for (const s of [-1, 1]) {
        const y = top[1] + (bot[1] - top[1]) * f;
        g.fillStyle = SP.mark; taper(g, quadPts([ax, y], [ax + s * rx * len * 0.5, y - 4], [ax + s * rx * len, y + 6], 6), (t) => 2.8 - t * 2.2);
      }
      fillPts(g, SP.mark, ellipsePts(top[0], top[1] + 3, 7, 5, 10, 0, 0.1, r), 0, 1, 0.5);
    }
  };
  const ceph = () => {
    const [cx, cy] = pose.ceph;
    fillPts(g, SP.body, ellipsePts(cx, cy, 30, 25, 18, 0, 0.04, r), 0.8, seed + 3, 0.5);
    fillPts(g, pose.under ? SP.belly : SP.mid, ellipsePts(cx - 3, cy - 5, 22, 16, 14, 0, 0.05, r), 0.6, seed + 4, 0.5);
    fillPts(g, SP.hi, ellipsePts(cx - 9, cy - 9, 6, 3.5, 10, -0.4, 0.05, r), 0, 1, 0.5);
    // 触肢 + 螯牙
    const fo = pose.fangs ?? 0.3;
    for (const s of [-1, 1]) {
      leg(g, l, [cx + s * 8, cy + 10], [cx + s * 16, cy + 14], [cx + s * 12, cy + 26], 3.6, r);
      g.fillStyle = '#120a06'; taper(g, quadPts([cx + s * 4, cy + 12], [cx + s * (7 + fo * 8), cy + 22], [cx + s * (2 + fo * 6), cy + 30], 6), (t) => 4.4 - t * 3.8);
    }
    // 八只眼
    for (const [x, y, rr] of [[-4, 5, 2.6], [4, 5, 2.6], [-9, 2, 1.9], [9, 2, 1.9], [-2, -1, 1.6], [2, -1, 1.6], [-12, 6, 1.5], [12, 6, 1.5]] as [number, number, number][]) {
      if (!pose.eyesDim) { const gr = g.createRadialGradient(cx + x, cy + y, 0, cx + x, cy + y, rr * 3); gr.addColorStop(0, 'rgba(255,60,30,0.55)'); gr.addColorStop(1, 'rgba(255,60,30,0)'); g.fillStyle = gr; g.fillRect(cx + x - rr * 3, cy + y - rr * 3, rr * 6, rr * 6); }
      g.fillStyle = pose.eyesDim ? '#4a1a14' : SP.eye; g.beginPath(); g.arc(cx + x, cy + y, rr, 0, Math.PI * 2); g.fill();
      if (!pose.eyesDim) { g.fillStyle = '#ffd0b0'; g.beginPath(); g.arc(cx + x - rr * 0.35, cy + y - rr * 0.35, rr * 0.35, 0, Math.PI * 2); g.fill(); }
    }
  };
  if (dead) { abdomen(); ceph(); legsOf(true); legsOf(false); }
  else { legsOf(true); abdomen(); legsOf(false); ceph(); }
  return finishFixed(st, seed, 236, W_CREA, undefined, 150);
}

// 姿势：s = -1 左 / 1 右；i = 0 前足 … 3 后足
const SPIDER: Record<string, (s: number) => GenOut> = {
  spider_den: (s) => den(s),
  spider: (s) => spider(s, { ceph: [150, 236], abd: [150, 176], abdR: [60, 54], legs: (sd, i) => ({ knee: [150 + sd * (40 + i * 18), 196 - i * 10 + (i === 0 ? 10 : 0)], foot: [150 + sd * (52 + i * 22), 302 - [0, 10, 26, 44][i]] }) }),
  spider_walk: (s) => spider(s, { ceph: [154, 238], abd: [146, 178], abdR: [60, 54], legs: (sd, i) => { const up = (i + (sd > 0 ? 1 : 0)) % 2 === 0; return { knee: [152 + sd * (40 + i * 18) + (up ? sd * 6 : 0), 196 - i * 10 - (up ? 14 : 0)], foot: [152 + sd * (48 + i * 22) + (up ? sd * 8 : -sd * 4), 302 - [0, 10, 26, 44][i] - (up ? 22 : 0)] }; } }),
  spider_rear: (s) => spider(s, { ceph: [150, 178], abd: [150, 236], abdR: [62, 50], under: true, fangs: 1, legs: (sd, i) => i < 2
    ? { knee: [150 + sd * (44 + i * 22), 128 - i * 8], foot: [150 + sd * (70 + i * 30), 60 + i * 24] }
    : { knee: [150 + sd * (48 + i * 14), 214 - i * 6], foot: [150 + sd * (60 + i * 20), 302 - (i - 2) * 16] } }),
  spider_lunge: (s) => spider(s, { ceph: [150, 252], abd: [150, 196], abdR: [56, 48], fangs: 1, legs: (sd, i) => i < 2
    ? { knee: [150 + sd * (56 + i * 18), 226 - i * 6], foot: [150 + sd * (100 + i * 18), 304 - i * 6] }
    : { knee: [150 + sd * (44 + i * 16), 196 - i * 6], foot: [150 + sd * (64 + i * 16), 286 - (i - 2) * 14] } }),
  spider_dead: (s) => spider(s, { ceph: [176, 268], abd: [138, 262], abdR: [58, 44], under: true, eyesDim: true, fangs: 0.1, legs: (sd, i) => {
    const hx = 158 + sd * 16, kx = 158 + sd * (46 + i * 20), ky = 200 - (3 - i) * 8 + (sd > 0 ? 6 : 0);
    return { hip: [hx, 254], knee: [kx, ky], foot: [kx - sd * (26 - i * 2), ky + 30 + i * 6] }; } }, true),
};

function den(seed: number): GenOut {
  const r = rng(seed), st = stage(360, 380, 24), { g, l, bx, by } = st;
  // 底：暗红褐的泥土堆
  fillPts(g, '#3a1e14', ellipsePts(bx, by - 8, 150, 26, 22, 0, 0.12, r), 2, seed, 0.5);
  fillPts(g, '#5e2e1e', ellipsePts(bx - 14, by - 14, 120, 18, 20, 0, 0.12, r), 2, seed + 1, 0.5);
  // 枯枝堆：向上戳出的断枝
  for (let k = 0; k < 26; k++) { const f = (r() - 0.5) * 2, x = bx + f * 110, h = (1 - Math.abs(f) * 0.7) * (150 + r() * 130), lean = f * 40 + (r() - 0.5) * 30;
    const col = r() < 0.5 ? '#3a2416' : '#5a3a24'; g.fillStyle = col; taper(g, [[x, by - 6], [x + lean * 0.5, by - h * 0.5], [x + lean, by - h]], (t) => 7 * (1 - t) + 1); }
  // 蛛网罩：半透明白色网面 + 网丝
  const mound: P[] = [[bx - 140, by - 8], [bx - 120, by - 110], [bx - 60, by - 210], [bx, by - 250], [bx + 50, by - 220], [bx + 118, by - 120], [bx + 142, by - 10]];
  for (let k = 0; k < 26; k++) { const f = (r() - 0.5) * 2, x = bx + f * 100, h = (1 - Math.abs(f) * 0.6) * (120 + r() * 120), lean = f * 30 + (r() - 0.5) * 40;
    g.fillStyle = ['#2e1c12', '#4a2e1c', '#6a4428', '#7e5634'][Math.floor(r() * 4)]; taper(g, [[x, by - 6], [x + lean * 0.5, by - h * 0.5], [x + lean, by - h]], (t) => 7 * (1 - t) + 1); }
  g.save(); g.beginPath(); smoothClosed(g, mound, 0.5); g.clip();
  // 洞：黑色洞口 + 网缘
  for (let k = 0; k < 4; k++) { const x = bx + (r() - 0.5) * 150, y = by - 30 - r() * 120, rr = 8 + r() * 9;
    fillPts(g, '#120a08', ellipsePts(x, y, rr, rr * 0.8, 12, r(), 0.15, r), 1, k, 0.5);
    l.strokeStyle = 'rgba(240,235,225,0.8)'; l.lineWidth = 1.4; l.beginPath(); l.ellipse(x, y, rr + 3, rr * 0.8 + 3, 0, 0, Math.PI * 2); l.stroke(); }
  // 卵囊
  for (let k = 0; k < 5; k++) { const x = bx + (r() - 0.5) * 150, y = by - 20 - r() * 120; fillPts(g, '#efe8da', ellipsePts(x, y, 7, 6, 10, 0, 0.1, r), 0, 1, 0.5); fillPts(g, '#b8ae9e', ellipsePts(x + 2, y + 2, 3.5, 3, 8, 0, 0.1, r), 0, 1, 0.5); }
  g.restore();
  // 前排断枝压在网上
  for (let k = 0; k < 14; k++) { const f = (r() - 0.5) * 2, x = bx + f * 120, h = (1 - Math.abs(f) * 0.6) * (60 + r() * 110), lean = f * 50;
    g.fillStyle = r() < 0.5 ? '#4a2c1a' : '#6a4428'; taper(g, [[x, by - 4], [x + lean * 0.5, by - h * 0.5], [x + lean, by - h]], (t) => 6 * (1 - t) + 0.8); }
  // 网丝：枝梢之间拉的丝 + 网面上的同心丝
  for (let k = 0; k < 30; k++) { const x0 = bx + (r() - 0.5) * 220, y0 = by - 40 - r() * 200, x1 = x0 + (r() - 0.5) * 120, y1 = y0 + (r() - 0.3) * 90;
    l.strokeStyle = 'rgba(245,240,230,0.7)'; l.lineWidth = 0.8; l.beginPath(); l.moveTo(x0, y0); l.quadraticCurveTo((x0 + x1) / 2, Math.max(y0, y1) + 14, x1, y1); l.stroke(); }
  l.lineCap = 'round';
  for (let k = 0; k < 40; k++) { const a = r() * Math.PI, x0 = bx + (r() - 0.5) * 240, y0 = by - 20 - r() * 200; l.strokeStyle = r() < 0.6 ? 'rgba(250,246,238,0.75)' : 'rgba(120,110,100,0.5)'; l.lineWidth = 0.7; l.beginPath(); l.moveTo(x0, y0); l.quadraticCurveTo(x0 + Math.cos(a) * 30, y0 + 20, x0 + Math.cos(a) * 60, y0 + Math.sin(a) * 30); l.stroke(); }
  const webs: [P, P, P][] = [];
  for (let k = 0; k < 170; k++) { const x0 = bx + (r() - 0.5) * 230, y0 = by - 20 - r() * 230 * (1 - Math.abs(x0 - bx) / 160), x1 = x0 + (r() - 0.5) * 90, y1 = y0 + (r() - 0.4) * 70; webs.push([[x0, y0], [(x0 + x1) / 2, Math.max(y0, y1) + 10 + r() * 10], [x1, y1]]); }
  return finishFixed(st, seed, 330, { ...W_CREA, formR: 22 }, (pg) => {
    pg.lineCap = 'round';
    for (const [a2, m, b2] of webs) { pg.strokeStyle = `rgba(240,234,222,${0.45 + r() * 0.4})`; pg.lineWidth = 0.7 + r() * 0.6; pg.beginPath(); pg.moveTo(a2[0], a2[1]); pg.quadraticCurveTo(m[0], m[1], b2[0], b2[1]); pg.stroke(); }
  });
}

// —— 乌鸦（朝左） ——
const CR = { base: '#121218', mid: '#24263a', hi: '#4a5476', beak: '#2a2a2e', beakL: '#6a6a72', leg: '#1a1a1e' };
interface CrowPose { body: P; ang: number; head: P; beakAng: number; tail: number; wings: 'fold' | 'up' | 'down'; legs: boolean }
function feather(g: Ctx, base: P, ang: number, len: number, w: number, col: string) {
  const tip: P = [base[0] + Math.cos(ang) * len, base[1] + Math.sin(ang) * len], nx = -Math.sin(ang) * w, ny = Math.cos(ang) * w;
  fillPts(g, col, [[base[0] + nx, base[1] + ny], [base[0] + Math.cos(ang) * len * 0.7 + nx * 0.8, base[1] + Math.sin(ang) * len * 0.7 + ny * 0.8], tip, [base[0] + Math.cos(ang) * len * 0.7 - nx * 0.7, base[1] + Math.sin(ang) * len * 0.7 - ny * 0.7], [base[0] - nx, base[1] - ny]], 0, 1, 0.4);
}
function wing(g: Ctx, l: Ctx, root: P, dir: number, span: number, col: string, colL: string) {
  // 一扇翅：初级飞羽张开成扇
  for (let k = 0; k < 8; k++) { const a = dir + (k - 3.5) * 0.13; feather(g, [root[0] + Math.cos(dir) * span * 0.35, root[1] + Math.sin(dir) * span * 0.35], a, span * (0.62 + Math.sin(k / 7 * Math.PI) * 0.12 + (k < 3 ? 0.1 : 0)), 4.2, k % 2 ? col : colL); }
  fillPts(g, col, [[root[0] - 8, root[1] + 4], [root[0] + Math.cos(dir - 0.4) * span * 0.5, root[1] + Math.sin(dir - 0.4) * span * 0.5], [root[0] + Math.cos(dir + 0.4) * span * 0.5, root[1] + Math.sin(dir + 0.4) * span * 0.5], [root[0] + 8, root[1] + 2]], 0.6, 5, 0.5);
  line(l, [[root[0], root[1]], [root[0] + Math.cos(dir) * span * 0.45, root[1] + Math.sin(dir) * span * 0.45]], 0.8, 'rgba(120,140,190,0.4)');
}
function crow(seed: number, p: CrowPose): GenOut {
  const r = rng(seed), st = stage(200, 200, 14), { g, l, bx, by } = st;
  const [cx, cy] = p.body, ca = Math.cos(p.ang), sa = Math.sin(p.ang);
  if (p.wings === 'up') wing(g, l, [cx + 4, cy - 6], -1.2, 70, '#0c0c12', '#181a26');
  if (p.wings === 'down') wing(g, l, [cx + 4, cy], 1.75, 62, '#0c0c12', '#181a26');
  // 腿
  if (p.legs) for (const dx of [-5, 5]) { g.fillStyle = CR.leg; taper(g, [[cx + dx, cy + 12], [cx + dx * 1.4, by - 8], [cx + dx * 1.4 - 2, by]], () => 2.2);
    for (const t of [-8, -3, 4]) taper(g, [[cx + dx * 1.4 - 2, by - 1], [cx + dx * 1.4 - 2 + t, by]], () => 1.3); }
  else for (const dx of [-3, 4]) { g.fillStyle = CR.leg; taper(g, [[cx + dx, cy + 10], [cx + dx + 8, cy + 20]], () => 1.8); }
  // 尾
  for (let k = 0; k < 5; k++) feather(g, [cx + ca * 18, cy + sa * 18], p.tail + (k - 2) * 0.08, 34 + (2 - Math.abs(k - 2)) * 4, 5, k % 2 ? CR.base : CR.mid);
  // 身
  const body = ellipsePts(cx, cy, 26, 15, 18, p.ang, 0.03, r);
  fillPts(g, CR.base, body, 0.6, seed, 0.5);
  fillPts(g, CR.mid, ellipsePts(cx - ca * 4, cy - 4, 20, 9, 14, p.ang, 0.04, r), 0.4, seed + 1, 0.5);
  // 头颈
  const [hx, hy] = p.head;
  fillPts(g, CR.base, [[cx - ca * 16, cy - sa * 16 - 8], [hx + 4, hy - 9], [hx - 6, hy - 6], [hx - 8, hy + 4], [hx + 2, hy + 10], [cx - ca * 14, cy - sa * 14 + 10]], 0.6, seed + 2, 0.5);
  fillPts(g, CR.base, ellipsePts(hx, hy, 11, 10, 14, 0, 0.03, r), 0.4, seed + 3, 0.5);
  fillPts(g, CR.hi, ellipsePts(hx - 1, hy - 4, 6, 3, 10, -0.3, 0.05, r), 0, 1, 0.5);
  // 喙
  const ba = p.beakAng, bb: P = [hx - 6 * Math.cos(ba + Math.PI) - 2, hy + 1];
  const bt: P = [bb[0] + Math.cos(ba) * 20, bb[1] + Math.sin(ba) * 20], bn = [-Math.sin(ba), Math.cos(ba)];
  fillPts(g, CR.beak, [[bb[0] + bn[0] * 5, bb[1] + bn[1] * 5], bt, [bb[0] - bn[0] * 5, bb[1] - bn[1] * 5]], 0, 1, 0.2);
  fillPts(g, CR.beakL, [[bb[0] - bn[0] * 4, bb[1] - bn[1] * 4], [bt[0] - bn[0] * 0.5, bt[1] - bn[1] * 0.5], [bb[0] - bn[0] * 1, bb[1] - bn[1] * 1]], 0, 1, 0.2);
  // 眼
  g.fillStyle = '#d8d0b0'; g.beginPath(); g.arc(hx - 3, hy - 2, 2, 0, Math.PI * 2); g.fill(); g.fillStyle = '#000'; g.beginPath(); g.arc(hx - 3.2, hy - 2, 1.2, 0, Math.PI * 2); g.fill();
  // 折翅
  if (p.wings === 'fold') {
    const w0: P = [cx - ca * 12, cy - sa * 12 - 6];
    fillPts(g, '#0e0e14', [w0, [cx + ca * 10, cy + sa * 10 - 10], [cx + ca * 40, cy + sa * 40 - 2], [cx + ca * 30, cy + sa * 30 + 6], [cx - ca * 6, cy - sa * 6 + 8]], 0.4, seed + 6, 0.5);
    for (let k = 0; k < 4; k++) line(l, [[cx + ca * (4 + k * 6), cy + sa * (4 + k * 6) - 2 + k], [cx + ca * (26 + k * 3), cy + sa * (26 + k * 3) + 2 + k]], 0.8, 'rgba(110,130,180,0.45)');
    fillPts(g, CR.hi, [[w0[0] + 4, w0[1] + 1], [cx + ca * 8, cy + sa * 8 - 9], [cx + ca * 14, cy + sa * 14 - 6], [w0[0] + 6, w0[1] + 4]], 0, 1, 0.5);
  }
  if (p.wings === 'up') wing(g, l, [cx - 2, cy - 4], -1.75, 64, '#14141c', '#262a3c');
  if (p.wings === 'down') wing(g, l, [cx - 2, cy + 2], 1.4, 58, '#14141c', '#262a3c');
  return finishFixed(st, seed, 108, { ...W_CREA, bleed: 1.3, edgeR: 2.2, formR: 8, rimAmt: 0.32 }, undefined, 112);
}
const CROW: Record<string, (s: number) => GenOut> = {
  crow_stand: (s) => crow(s, { body: [104, 138], ang: 0.5, head: [80, 114], beakAng: Math.PI + 0.12, tail: 0.75, wings: 'fold', legs: true }),
  crow_peck: (s) => crow(s, { body: [114, 152], ang: -0.12, head: [80, 170], beakAng: Math.PI * 0.6, tail: -0.35, wings: 'fold', legs: true }),
  crow_fly0: (s) => crow(s, { body: [106, 140], ang: 0.25, head: [76, 128], beakAng: Math.PI + 0.1, tail: 0.3, wings: 'up', legs: true }),
  crow_fly1: (s) => crow(s, { body: [104, 112], ang: 0.1, head: [74, 104], beakAng: Math.PI + 0.05, tail: 0.15, wings: 'down', legs: false }),
};

// —— 影怪 ——
function shade(seed: number): GenOut {
  const r = rng(seed), st = stage(240, 340, 12), { l, bx, by } = st;
  let g: Ctx = st.g;
  const C = ['#07060a', '#110e18', '#1c1726', '#2a2338'];
  const smoke = (x0: number, y0: number, x1: number, y1: number, w: number, col: string, amp: number, alpha = 1) => {
    const pts: P[] = []; const ph = r() * 6, fq = 5 + r() * 5;
    for (let i = 0; i <= 12; i++) { const t = i / 12; pts.push([x0 + (x1 - x0) * t + Math.sin(t * fq + ph) * amp * Math.sin(t * Math.PI), y0 + (y1 - y0) * t]); }
    g.globalAlpha = alpha; g.fillStyle = col; taper(g, pts, (t) => w * Math.sin(Math.PI * (0.15 + 0.85 * t)) * (1 - t * 0.6) + 0.5); g.globalAlpha = 1;
  };
  // 合成前只画一个淡淡的烟芯（给墨晕和体积），烟缕全部在合成后画，免得被晕染粘成实心
  g.globalAlpha = 0.45; fillPts(g, C[1], [[bx - 14, by - 60], [bx - 10, by - 110], [bx - 26, by - 190], [bx, by - 268], [bx + 26, by - 190], [bx + 10, by - 110], [bx + 14, by - 60]], 6, seed + 5, 0.5); g.globalAlpha = 1;
  const strands = () => {
  // 躯干：短烟缕按人形包络散布（肩宽、腰细、下摆散开），缕间留缝
  const env = (t: number) => t < 0.4 ? 30 - t * 45 : t < 0.75 ? 12 + (t - 0.4) * 60 : 33 - (t - 0.75) * 190;
  for (let k = 0; k < 90; k++) {
    const t0 = r() * 0.8, t1 = Math.min(0.86, t0 + 0.15 + r() * 0.25), f = (r() - 0.5) * 2;
    const y0 = by - 12 - t0 * 240, y1 = by - 12 - t1 * 240;
    smoke(bx + f * env(t0), y0, bx + f * env(t1) * 0.9 + (r() - 0.5) * 6, y1, 3 + r() * 5, C[Math.floor(r() * 3)], 6 + r() * 8, 0.55 + r() * 0.45);
  }
  // 烟脚：向两侧拖散
  for (let k = 0; k < 18; k++) { const f = (r() - 0.5) * 2; smoke(bx + f * 16, by - 50 - r() * 20, bx + f * 80, by - r() * 16, 5, C[Math.floor(r() * 3)], 14, 0.7); }
  // 长臂：垂到膝下，指尖散成烟爪
  for (const s of [-1, 1]) {
    for (let k = 0; k < 4; k++) smoke(bx + s * 14, by - 212 + k * 3, bx + s * (62 + k * 3), by - 176 + k * 4, 7, C[k % 3], 6, 0.85);
    for (let k = 0; k < 5; k++) smoke(bx + s * (60 + k * 2), by - 180, bx + s * (70 + k * 5), by - 90 - k * 6, 6 - k * 0.8, C[k % 3], 12, 0.85);
    for (let k = 0; k < 4; k++) smoke(bx + s * (70 + k * 3), by - 96, bx + s * (64 + k * 9), by - 58 + k * 5, 2.4, C[0], 8);
  }
  // 头：一团较密的烟，顶上烟缕向后上方卷走（不对称，像被风吹）
  fillPts(g, C[0], ellipsePts(bx, by - 248, 20, 23, 18, 0, 0.2, r), 3, seed, 0.5);
  for (let k = 0; k < 14; k++) { const a = -Math.PI / 2 + 0.5 + (r() - 0.5) * 2.2; smoke(bx + Math.cos(a) * 18, by - 246 + Math.sin(a) * 22, bx + Math.cos(a) * 46 + 14, by - 246 + Math.sin(a) * 50 - 10, 4.5, C[Math.floor(r() * 3)], 12, 0.8); }
  for (let k = 0; k < 18; k++) { const x = bx + (r() - 0.5) * 44, y = by - 60 - r() * 160; line(l, [[x, y], [x + (r() - 0.5) * 10, y - 20], [x + (r() - 0.5) * 16, y - 40]], 1, 'rgba(120,100,160,0.35)'); }
  };
  const post = (pg: Ctx) => {
    g = pg; strands();
    // 眼：合成后再画，保持锐利发光
    for (const s of [-1, 1]) {
      const x = bx + s * 11, y = by - 256;
      const gr = pg.createRadialGradient(x, y, 0, x, y, 16); gr.addColorStop(0, 'rgba(230,240,255,0.7)'); gr.addColorStop(1, 'rgba(160,190,255,0)'); pg.fillStyle = gr; pg.fillRect(x - 16, y - 16, 32, 32);
      pg.fillStyle = '#f4f8ff'; pg.beginPath(); pg.ellipse(x, y, 4.4, 2.8, s * -0.3, 0, Math.PI * 2); pg.fill();
    }
    pg.strokeStyle = 'rgba(200,210,240,0.35)'; pg.lineWidth = 1.2; pg.beginPath(); pg.moveTo(bx - 8, by - 236); pg.quadraticCurveTo(bx, by - 232, bx + 8, by - 237); pg.stroke();
    // 外缘飘散的细烟丝
    for (let k = 0; k < 40; k++) { const a = r() * Math.PI * 2, d = 40 + r() * 50, x = bx + Math.cos(a) * d * 0.9, y = by - 150 + Math.sin(a) * d * 1.6;
      pg.strokeStyle = `rgba(20,16,28,${0.3 + r() * 0.5})`; pg.lineWidth = 1 + r() * 1.5; pg.beginPath(); pg.moveTo(x, y); pg.quadraticCurveTo(x + (r() - 0.5) * 20, y - 14, x + (r() - 0.5) * 26, y - 30); pg.stroke(); }
  };
  return finishFixed(st, seed, 220, { ...W_CREA, rim: [150, 130, 220], rimAmt: 0.25, bleed: 2.4, inkAmt: 0.7 }, post);
}

let i = 0;
for (const [name, gen] of Object.entries({ ...SPIDER, ...CROW, shade })) register({ name, kind: 'sprite', group: 'creatures', seed: 1301 + i++, gen });
void wobble;
