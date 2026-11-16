/**
 * 其他树木：白桦（单干 / 分叉）、枯树、沼泽老树（垂苔）、树桩（松 / 桦）。
 */
import { register, GenOut } from '../registry';
import { rng, Rand } from '../noise';
import { P, smoothClosed, wobble, ellipsePts, taper, quadPts } from '../brush';
import { stage, finish, leafCluster, branches, limb, line, fillPts, W_TREE, W_MID, Stage, LeafPal, BarkPal } from '../kit';

const U = 76;
const BIRCH: BarkPal = { bark: '#d9d1bf', barkD: '#948d80', barkL: '#f3eee2', ink: 'rgba(20,14,11,0.45)' };
const BIRCH_TWIG: BarkPal = { bark: '#6d665c', barkD: '#3e3a35', barkL: '#9a9284', ink: 'rgba(20,14,11,0.45)' };
const AUTUMN: LeafPal = { deep: '#6a2211', mid: '#ad3d1a', lit: '#d9682a', hi: '#f2a355', ink: 'rgba(40,10,5,0.5)' };
const DEAD: BarkPal = { bark: '#4b453e', barkD: '#27231f', barkL: '#7b7366', ink: 'rgba(16,12,9,0.6)' };
const SWAMP: BarkPal = { bark: '#4a4637', barkD: '#25231b', barkL: '#78725a', ink: 'rgba(16,12,9,0.6)' };
const MOSS = { deep: '#38412c', mid: '#566246', lit: '#7f8c66' };

const spineOf = (bx: number, by: number, H: number, f: (t: number) => number, n = 16): P[] => Array.from({ length: n + 1 }, (_, i) => [f(i / n), by - (i / n) * H] as P);

/** 桦树皮的黑色皮孔与根部粗皮 */
function birchMarks(st: Stage, spine: P[], w: (t: number) => number, r: Rand) {
  const { g } = st;
  g.fillStyle = '#1d1814';
  for (let i = 1; i < spine.length - 1; i++) {
    const t = i / (spine.length - 1), hw = w(t);
    const k = 1 + Math.floor(r() * 2.5);
    for (let j = 0; j < k; j++) {
      const ox = (r() * 1.6 - 0.8) * hw, len = hw * (0.25 + r() * 0.6), y = spine[i][1] + (r() - 0.5) * 10;
      taper(g, [[spine[i][0] + ox - len / 2, y], [spine[i][0] + ox, y + (r() - 0.5) * 1.5], [spine[i][0] + ox + len / 2, y]], (u) => (1.2 + r() * 1.4) * Math.sin(Math.PI * u) + 0.2);
    }
  }
  // 根部粗皮：黑色的纵裂
  for (let j = 0; j < 7; j++) {
    const x = spine[0][0] + (r() - 0.5) * w(0) * 1.6;
    taper(g, [[x, st.by + 2], [x + (r() - 0.5) * 4, st.by - U * 0.3], [x + (r() - 0.5) * 6, st.by - U * (0.45 + r() * 0.3)]], (u) => 2.5 * (1 - u) + 0.3);
  }
}

function birch(seed: number, fork: boolean): GenOut {
  const r = rng(seed), H = (fork ? 6.8 : 6.6) * U;
  const st = stage(H * 0.95, H + 60);
  const { bx, by } = st;
  const trunks = fork ? [-0.11, 0.13] : [0.03];
  const tips: [P, number][] = [];
  const w = (t: number) => U * ((fork ? 0.12 : 0.15) * (1 - t) + 0.025) + U * 0.16 * Math.exp(-t * 14);
  const spines: P[][] = [];
  trunks.forEach((lean, ti) => {
    const ph = r() * 6, h = H * (ti === 0 ? 0.9 : 0.82);
    const sp = spineOf(bx, by, h, (t) => bx + lean * h * t + Math.sin(t * 3 + ph) * U * 0.1 * t);
    spines.push(sp);
    // 侧枝（先画，压在树干后）
    for (let k = 0; k < 6; k++) {
      const t = 0.38 + k * 0.1 + r() * 0.04, i = Math.round(t * 16), s = (k % 2 ? 1 : -1) * (lean < 0 && k % 3 === 0 ? -1 : 1);
      const a = -Math.PI / 2 + s * (0.55 + r() * 0.45);
      branches(st, sp[i], a, U * (0.75 - t * 0.4) * (0.8 + r() * 0.4), w(t) * 0.45, 2, r, BIRCH_TWIG, (p, an, d) => { if (d <= 1) tips.push([p, an]); }, 0.4);
    }
    tips.push([sp[16], -Math.PI / 2]);
  });
  spines.forEach((sp) => { limb(st.g, st.l, sp, w, r, false, BIRCH); birchMarks(st, sp, w, r); });
  // 叶团：枝梢 + 树冠
  const clumps: [number, number, number][] = tips.map(([p]) => [p[0] + (r() - 0.5) * 8, p[1] - U * 0.06, U * (0.24 + r() * 0.14)]);
  spines.forEach((sp) => { for (const t of [0.66, 0.78, 0.9, 1]) { const i = Math.round(t * 16); clumps.push([sp[i][0] + (r() - 0.5) * U * 0.6, sp[i][1] - U * 0.1, U * (0.3 + r() * 0.12)]); } });
  clumps.sort((a, b) => a[1] - b[1]).reverse();
  for (const [x, y, rad] of clumps) leafCluster(st, x, y, rad * 1.15, AUTUMN, r, U * 0.13);
  return finish(st, seed, W_TREE);
}

function deadTree(seed: number, swamp: boolean): GenOut {
  const r = rng(seed), H = (swamp ? 6.6 : 6.0) * U, pal = swamp ? SWAMP : DEAD;
  const st = stage(H * (swamp ? 1.3 : 1.05), H + 70);
  const { bx, by, g, l } = st;
  const ph = r() * 6, Ht = H * (swamp ? 0.55 : 0.62);
  const sx = (t: number) => bx + (Math.sin(t * 4.2 + ph) * (swamp ? 0.45 : 0.36) + Math.sin(t * 9 + ph * 2) * 0.08) * U * t;
  const sp = spineOf(bx, by, Ht, sx);
  const w = (t: number) => U * ((swamp ? 0.38 : 0.36) * (1 - t * 0.55)) + U * (swamp ? 0.45 : 0.38) * Math.exp(-t * 9);
  // 根
  // 根：沼泽树是一大团拱起的气根（先拱高再扎下，末端再分叉）；枯树是抓地的粗根
  const nR = swamp ? 13 : 7;
  for (let k = 0; k < nR; k++) {
    const s = k % 2 ? 1 : -1, f = (k + 1) / nR, L = U * (swamp ? 0.6 + f * 1.1 : 0.5 + r() * 0.5) * (0.8 + r() * 0.4);
    const arch = swamp ? U * (0.15 + r() * 0.35) : U * 0.05;
    const p0: P = [bx + s * U * 0.12 * r(), by - U * (0.35 + r() * 0.3)], p1: P = [bx + s * L * 0.5, by - arch - U * 0.1], p2: P = [bx + s * L, by + 2 + r() * 5];
    const root = quadPts(p0, p1, p2, 10);
    limb(g, l, root, (t) => U * (swamp ? 0.13 : 0.15) * (1 - t * 0.85) + 1.2, r, true, pal);
    if (r() < (swamp ? 0.8 : 0.4)) { const q = root[6]; limb(g, l, quadPts(q, [q[0] + s * U * 0.2, q[1] + U * 0.02], [q[0] + s * U * (0.3 + r() * 0.3), by + 3], 6), (t) => U * 0.05 * (1 - t) + 1, r, true, pal); }
  }
  if (swamp) fillPts(g, MOSS.deep, ellipsePts(bx, by + 2, U * 1.6, U * 0.22, 18, 0, 0.12, r), 2, seed);
  // 树冠枝（递归），先画；主干后画压住枝根
  const mossAt: P[] = [];
  const crown = sp[16];
  const mains = swamp ? [-1.15, -0.6, -0.15, -2.5, -1.95] : [-1.25, -0.75, -2.0, -1.65];
  mains.forEach((m) => branches(st, [crown[0] + (r() - 0.5) * 8, crown[1] + r() * U * 0.3], m + (r() - 0.5) * 0.2, U * (swamp ? 0.85 : 1.0) * (0.8 + r() * 0.3), w(1) * 0.85, swamp ? 3 : 4, r, pal, (p, _a, d) => { if (swamp && d <= 1) mossAt.push(p); }, 0.6));
  // 中段侧枝
  for (let k = 0; k < 2; k++) { const i = 7 + k * 3, s = k % 2 ? 1 : -1; branches(st, sp[i], -Math.PI / 2 + s * 1.05, U * 0.9, w(i / 16) * 0.4, 2, r, pal, (p, _a, d) => { if (swamp && d <= 1) mossAt.push(p); }, 0.6); }
  limb(g, l, sp, w, r, false, pal);
  // 绞股：主干由三四股螺旋缠绕的木筋组成，亮面 + 股间暗槽
  const NS = swamp ? 4 : 3;
  for (let k = 0; k < NS; k++) {
    const strand: P[] = [], groove: P[] = [];
    for (let i = 0; i <= 15; i++) { const t = i / 16, ww = w(t), a = i * 0.75 + k * (Math.PI * 2 / NS) + ph;
      strand.push([sp[i][0] + Math.sin(a) * ww * 0.55, sp[i][1]]); groove.push([sp[i][0] + Math.sin(a + 0.9) * ww * 0.62, sp[i][1]]); }
    g.save(); g.globalAlpha = 0.85;
    g.fillStyle = k % 2 ? pal.barkL : pal.bark; taper(g, strand, (t) => w(t * 0.95) * 0.3 * (1 - t * 0.4) + 1);
    g.restore();
    line(l, groove, 2.6, "rgba(10,8,6,0.7)");
  }
  // 扭纹：沿干的螺旋墨线
  for (let k = 0; k < 6; k++) { const off = (r() - 0.5) * 1.4; line(l, sp.slice(0, 15).map(([x, y], i) => [x + Math.sin(i * 0.7 + k) * w(i / 16) * 0.5 * off, y] as P), 1.1, 'rgba(14,10,8,0.5)'); }
  if (!swamp) {   // 树洞
    const hy = by - Ht * 0.45, hx = sx(0.45) + U * 0.04;
    fillPts(g, '#120e0b', ellipsePts(hx, hy, U * 0.11, U * 0.2, 12, 0.1, 0.1, r), 1, seed);
    fillPts(g, pal.barkL, [[hx - U * 0.13, hy - U * 0.22], [hx - U * 0.05, hy - U * 0.26], [hx - U * 0.09, hy + U * 0.1], [hx - U * 0.15, hy]], 0, 1, 0.4);
  }
  // 西班牙苔：每个挂点垂下一束细丝（灰绿，细而多），水墨合成之后再画，免得被晕染粘成布帘
  const moss = (mg: CanvasRenderingContext2D) => {
    const MC = ['#56613f', '#6f7a54', '#8b9570', '#616c48'];
    for (const p of mossAt) for (let k = 0; k < 7 + Math.floor(r() * 5); k++) {
      const x = p[0] + (r() - 0.5) * 22, y = p[1] + (r() - 0.5) * 6, len = U * (0.3 + r() * 0.85), sway = (r() - 0.5) * 8;
      const pts: P[] = Array.from({ length: 9 }, (_, i) => [x + Math.sin(i * 1.3 + k * 2.1) * 1.6 + sway * (i / 8) ** 2, y + len * i / 8] as P);
      const wd = 1.1 + r() * 1.0;
      mg.globalAlpha = 0.7; mg.fillStyle = 'rgba(24,26,16,0.9)'; taper(mg, pts.map(([a2, b2]) => [a2 + 0.8, b2 + 0.6] as P), (t) => (wd + 0.8) * (1 - t * 0.7));
      mg.globalAlpha = 0.85 + r() * 0.15; mg.fillStyle = MC[Math.floor(r() * MC.length)]; taper(mg, pts, (t) => wd * (1 - t * 0.7));
    }
    mg.globalAlpha = 1;
  };
  return finish(st, seed, W_TREE, undefined, swamp ? moss : undefined);
}

function stump(seed: number, kind: 'pine' | 'birch'): GenOut {
  const r = rng(seed), V = 84, st = stage(220, 170, 30);
  const { bx, by, g, l } = st;
  const pal: BarkPal = kind === 'pine' ? { bark: '#5b3424', barkD: '#331b13', barkL: '#93593a', ink: 'rgba(22,14,10,0.62)' } : BIRCH;
  const rx = V * (kind === 'pine' ? 0.5 : 0.44), ry = rx * 0.38, topY = by - V * (kind === 'pine' ? 0.62 : 0.78);
  // 根脚
  for (const s of [-1, 1, -0.55, 0.6]) limb(g, l, quadPts([bx + s * rx * 0.5, by - V * 0.3], [bx + s * rx * 0.95, by - 6], [bx + s * rx * (1.35 + r() * 0.25), by + 2], 6), (t) => V * 0.13 * (1 - t) + 1.5, r, kind === 'pine', pal);
  // 桩身
  const body: P[] = [[bx - rx, topY], [bx + rx, topY], [bx + rx * 1.08, by - V * 0.25], [bx + rx * 1.3, by], [bx - rx * 1.3, by], [bx - rx * 1.08, by - V * 0.25]];
  const path = new Path2D(); smoothClosed(path, wobble(body, 1.4, seed, 5), 0.3);
  g.fillStyle = pal.bark; g.fill(path);
  g.save(); g.clip(path);
  g.fillStyle = pal.barkD; g.fillRect(bx + rx * 0.35, topY - 5, rx * 2, V * 2);
  g.fillStyle = pal.barkL; g.fillRect(bx - rx * 1.4, topY - 5, rx * 0.4, V * 2);
  g.restore();
  if (kind === 'birch') birchMarks(st, Array.from({ length: 6 }, (_, i) => [bx, topY + (by - topY) * i / 5] as P).reverse(), () => rx * 0.9, r);
  else for (let i = 0; i < 9; i++) { const x = bx + (r() - 0.5) * rx * 1.8; line(l, [[x, topY + 6 + r() * 6], [x + (r() - 0.5) * 3, by - 4 - r() * 10]], 1 + r() * 0.6); }
  // 截面：浅色木心 + 年轮 + 放射裂
  const wood = kind === 'pine' ? ['#c49a68', '#a67a4c', '#e2c08c'] : ['#d8c49a', '#b29a70', '#efe0bc'];
  fillPts(g, wood[0], ellipsePts(bx, topY, rx * 0.98, ry, 20, 0, 0.03, r), 0.8, seed + 1);
  fillPts(g, wood[2], ellipsePts(bx - rx * 0.3, topY - ry * 0.25, rx * 0.45, ry * 0.4, 12, 0, 0.05, r), 0, seed);
  g.strokeStyle = pal.barkD; g.lineWidth = 3; g.beginPath(); g.ellipse(bx, topY, rx * 0.98, ry, 0, 0, Math.PI * 2); g.stroke();
  for (let k = 1; k <= 4; k++) { l.strokeStyle = 'rgba(90,55,30,0.55)'; l.lineWidth = 0.9; l.beginPath(); l.ellipse(bx + k * 0.6, topY, rx * (0.92 - k * 0.19), ry * (0.92 - k * 0.19), 0, 0, Math.PI * 2); l.stroke(); }
  line(l, [[bx, topY], [bx + rx * 0.5, topY + ry * 0.4]], 1, 'rgba(40,24,12,0.6)');
  line(l, [[bx, topY], [bx - rx * 0.3, topY - ry * 0.55]], 0.9, 'rgba(40,24,12,0.5)');
  return finish(st, seed, W_MID);
}

const DEFS: [string, number, (s: number) => GenOut][] = [
  ['birch_a', 501, (s) => birch(s, false)], ['birch_fork', 502, (s) => birch(s, true)],
  ['tree_dead', 511, (s) => deadTree(s, false)], ['tree_swamp', 512, (s) => deadTree(s, true)],
  ['stump_pine', 521, (s) => stump(s, 'pine')], ['stump_birch', 522, (s) => stump(s, 'birch')],
];
for (const [name, seed, gen] of DEFS) register({ name, kind: 'sprite', group: 'props', seed, gen });
