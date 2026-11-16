/**
 * 地表道具：石头、灌木、草、花、芦苇、蕨、蘑菇、骨头、燧石、研究台。
 * 尺寸按手绘包同名图片的世界尺寸设计（键位与枢轴不变，玩法摆放不受影响）。
 */
import { register, GenOut } from '../registry';
import { rng, Rand } from '../noise';
import { P, smoothClosed, wobble, ellipsePts, taper, quadPts } from '../brush';
import { stage, finish, foliage, branches, rock, line, fillPts, leafShape, blade, tuft, W_SMALL, W_MID, Stage, LeafPal, BarkPal, RockPal, ROCK } from '../kit';

const U = 86;
const GRASS = ['#4f5a2c', '#66723a', '#7f8a45', '#98a055'];
const STRAW = ['#8a7444', '#a88d55', '#c2a96a'];
const GREEN: LeafPal = { deep: '#203320', mid: '#33502d', lit: '#4c6e3a', hi: '#7e9b55' };
const TWIG: BarkPal = { bark: '#6b5038', barkD: '#3c2b1d', barkL: '#987452', ink: 'rgba(20,14,11,0.5)' };
type Ctx = CanvasRenderingContext2D;

function berry(g: Ctx, x: number, y: number, rr: number) {
  g.fillStyle = '#5a0f12'; g.beginPath(); g.arc(x + 0.6, y + 0.6, rr, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#b3202a'; g.beginPath(); g.arc(x, y, rr * 0.85, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#f2a59a'; g.beginPath(); g.arc(x - rr * 0.35, y - rr * 0.35, rr * 0.28, 0, Math.PI * 2); g.fill();
}

function bush(seed: number, picked: boolean): GenOut {
  const r = rng(seed), st = stage(260, 240);
  const { bx, by, g } = st;
  // 枝干
  for (let k = 0; k < 5; k++) branches(st, [bx + (k - 2) * 3, by], -Math.PI / 2 + (k - 2) * (picked ? 0.13 : 0.2), U * (picked ? 0.62 : 0.45), 3.2, 2, r, TWIG, undefined, 0.35);
  if (!picked) {
    const C: [number, number, number][] = [[bx - U * 0.42, by - U * 0.55, U * 0.45], [bx + U * 0.42, by - U * 0.58, U * 0.45], [bx, by - U * 0.95, U * 0.55], [bx - U * 0.1, by - U * 0.45, U * 0.5]];
    for (const [x, y, rad] of C) foliage(st, x, y, rad, GREEN, r, { n: 5, flat: 0.8, under: '#101a10' });
    for (let k = 0; k < 14; k++) {
      const a = r() * Math.PI * 2, d = Math.sqrt(r()), x = bx + Math.cos(a) * U * 0.62 * d, y = by - U * 0.68 + Math.sin(a) * U * 0.42 * d;
      for (let j = 0; j < 2 + Math.floor(r() * 3); j++) berry(g, x + (r() - 0.5) * 9, y + (r() - 0.5) * 7, 3.2 + r() * 1.2);
    }
  } else {
    const C: [number, number, number][] = [[bx - U * 0.22, by - U * 0.9, U * 0.22], [bx + U * 0.25, by - U * 1.05, U * 0.2], [bx + U * 0.05, by - U * 1.35, U * 0.2], [bx - U * 0.18, by - U * 0.45, U * 0.18], [bx + U * 0.22, by - U * 0.55, U * 0.16]];
    for (const [x, y, rad] of C) foliage(st, x, y, rad, GREEN, r, { n: 3, flat: 0.75, leaf: rad * 0.35 });
  }
  return finish(st, seed, W_MID);
}

function grass(seed: number, cut: boolean): GenOut {
  const r = rng(seed), st = stage(160, 200);
  const { bx, by, g } = st;
  if (!cut) {
    tuft(g, bx, by, U * 1.25, U * 0.38, 15, [GRASS[0], GRASS[1], GRASS[2], STRAW[1]], r, 2.4);
    for (let k = 0; k < 3; k++) {   // 抽穗
      const tip: P = [bx + (k - 1) * U * 0.2 + (r() - 0.5) * 6, by - U * (1.38 + r() * 0.12)];
      blade(g, [bx + (k - 1) * 3, by], tip, (k - 1) * 6, 1.3, STRAW[0]);
      g.fillStyle = STRAW[2];
      for (let j = 0; j < 7; j++) leafShape(g, tip[0] + (r() - 0.5) * 2, tip[1] + j * 3.2, 7, 2, Math.PI / 2 + (j % 2 ? 0.5 : -0.5) + (k - 1) * 0.2);
    }
    tuft(g, bx, by, U * 0.6, U * 0.28, 7, [GRASS[2], GRASS[3]], r, 2);
  } else {
    for (let k = 0; k < 11; k++) { const f = k / 10 * 2 - 1, h = U * (0.38 + r() * 0.22); const tip: P = [bx + f * U * 0.2, by - h]; blade(g, [bx + f * 5, by], tip, f * 3, 2.6, k % 3 ? STRAW[1] : STRAW[0]); g.fillStyle = STRAW[2]; g.fillRect(tip[0] - 1.5, tip[1] - 1, 3, 2); }
    tuft(g, bx, by, U * 0.3, U * 0.25, 6, [GRASS[1], GRASS[2]], r, 1.8);
  }
  return finish(st, seed, W_SMALL);
}

function sapling(seed: number, cut: boolean): GenOut {
  const r = rng(seed), st = stage(170, 220);
  const { bx, by, g } = st;
  if (!cut) {
    for (let k = 0; k < 7; k++) branches(st, [bx + (k - 3) * 2, by], -Math.PI / 2 + (k - 3) * 0.13 + (r() - 0.5) * 0.08, U * (0.6 + r() * 0.3), 0.9, 2, r, TWIG, (p, a, d) => {
      if (r() < 0.35) return; g.fillStyle = r() < 0.5 ? GREEN.lit : GREEN.mid; for (let j = 0; j < 2; j++) leafShape(g, p[0], p[1], 5 + r() * 3, 2, a + (j - 0.5) * 0.8);
    }, 0.35);
    tuft(g, bx, by, U * 0.32, U * 0.22, 6, GRASS, r, 1.8);
  } else {
    for (let k = 0; k < 5; k++) { const x = bx + (k - 2) * 7 + (r() - 0.5) * 3, h = U * (0.4 + r() * 0.3), lean = (k - 2) * 3;
      g.fillStyle = TWIG.bark; taper(g, [[x, by], [x + lean * 0.5, by - h * 0.5], [x + lean, by - h]], (t) => 3.2 - t * 0.8);
      g.fillStyle = '#c9a874'; g.beginPath(); g.ellipse(x + lean, by - h, 2.6, 1.3, 0, 0, Math.PI * 2); g.fill(); }
    tuft(g, bx, by, U * 0.35, U * 0.28, 7, GRASS, r, 1.8);
  }
  return finish(st, seed, W_SMALL);
}

function flower(seed: number, kind: 'red' | 'yellow' | 'blue'): GenOut {
  const r = rng(seed), st = stage(150, 170);
  const { bx, by, g, l } = st;
  // 基生叶
  g.fillStyle = GREEN.mid;
  for (let k = 0; k < 9; k++) leafShape(g, bx + (k - 4) * 2, by, U * (0.3 + r() * 0.15), kind === 'blue' ? 3 : 6, -Math.PI / 2 + (k - 4) * 0.3);
  g.fillStyle = GREEN.lit;
  for (let k = 0; k < 3; k++) leafShape(g, bx - 4 + k * 2, by - 2, U * 0.18, 3.5, -Math.PI / 2 - 0.8 + k * 0.3);
  const n: number = kind === 'yellow' ? 6 : kind === 'red' ? 3 : 4;
  for (let k = 0; k < n; k++) {
    const f = n === 1 ? 0 : k / (n - 1) * 2 - 1, h = U * (kind === 'red' ? 1.0 + r() * 0.25 : 0.85 + r() * 0.35);
    const tip: P = [bx + f * U * 0.32 + (r() - 0.5) * 6, by - h];
    const ctrl: P = [(bx + tip[0]) / 2 + f * 8, (by + tip[1]) / 2];
    g.fillStyle = GREEN.deep; taper(g, quadPts([bx + f * 3, by], ctrl, tip, 10), () => 1.3);
    if (kind === 'red') {   // 罂粟：四瓣大花
      const cx = tip[0], cy = tip[1], R = 13 + r() * 3;
      for (let p = 0; p < 4; p++) { const a = -Math.PI / 2 + (p - 1.5) * 0.9; fillPts(g, p % 2 ? '#8e1d14' : '#b8291c', ellipsePts(cx + Math.cos(a) * R * 0.5, cy + Math.sin(a) * R * 0.35, R * 0.62, R * 0.48, 10, a, 0.12, r), 0.6, seed + k * 7 + p); }
      fillPts(g, '#e2563a', ellipsePts(cx - R * 0.3, cy - R * 0.35, R * 0.35, R * 0.22, 8, -0.3), 0);
      g.fillStyle = '#1b1411'; g.beginPath(); g.arc(cx, cy, 2.6, 0, Math.PI * 2); g.fill();
    } else if (kind === 'yellow') {   // 小菊
      const cx = tip[0], cy = tip[1];
      for (let p = 0; p < 7; p++) { const a = p / 7 * Math.PI * 2; g.fillStyle = p % 2 ? '#d9a62c' : '#f2ca4a'; leafShape(g, cx, cy, 9.5, 3.4, a); }
      g.fillStyle = '#6b4520'; g.beginPath(); g.arc(cx, cy, 3, 0, Math.PI * 2); g.fill();
    } else {   // 风铃草：弯垂的铃
      for (let b = 0; b < 3; b++) {
        const t = 0.62 + b * 0.16, x = bx + f * 3 + (tip[0] - bx) * t + f * 5, y = by + (tip[1] - by) * t;
        line(l, [[x, y], [x + 3, y + 3]], 0.8);
        const bell: P[] = [[x + 1, y + 2], [x + 8, y + 3], [x + 10, y + 13], [x + 5, y + 11.5], [x + 1, y + 14], [x - 3.5, y + 12]];
        fillPts(g, '#4f63ad', bell, 0, 1, 0.4);
        fillPts(g, '#8a9fe0', [[x + 1, y + 3], [x + 3, y + 3], [x + 1.5, y + 8], [x - 0.5, y + 8]], 0, 1, 0.4);
      }
    }
  }
  return finish(st, seed, W_SMALL);
}

function carrot(seed: number): GenOut {
  const r = rng(seed), st = stage(140, 160);
  const { bx, by, g } = st;
  fillPts(g, '#3a2b1f', ellipsePts(bx, by - 2, U * 0.3, U * 0.08, 12, 0, 0.1, r), 1, seed);
  fillPts(g, '#d0702a', [[bx - 8, by - 4], [bx + 8, by - 4], [bx + 6, by - 12], [bx - 5, by - 13]], 0.5, seed, 0.5);
  fillPts(g, '#ef9a48', [[bx - 6, by - 6], [bx - 1, by - 7], [bx - 2, by - 12], [bx - 5, by - 11]], 0, 1, 0.5);
  for (let k = 0; k < 7; k++) {
    const f = k / 6 * 2 - 1, tip: P = [bx + f * U * 0.38 + (r() - 0.5) * 6, by - U * (0.75 + r() * 0.3) * (1 - Math.abs(f) * 0.25)];
    g.fillStyle = GREEN.lit; taper(g, quadPts([bx + f * 2, by - 12], [(bx + tip[0]) / 2 - f * 4, (by + tip[1]) / 2], tip, 8), () => 1);
    for (let j = 1; j <= 6; j++) { const t = j / 7, x = bx + (tip[0] - bx) * t, y = by - 12 + (tip[1] - by + 12) * t; g.fillStyle = j % 2 ? GREEN.lit : GREEN.hi; leafShape(g, x, y, 9 - t * 3, 3, -Math.PI / 2 + f * 0.6 - 0.9); leafShape(g, x, y, 9 - t * 3, 3, -Math.PI / 2 + f * 0.6 + 0.9); }
  }
  return finish(st, seed, W_SMALL);
}

function reeds(seed: number, cut: boolean): GenOut {
  const r = rng(seed), st = stage(200, 230);
  const { bx, by, g } = st;
  const H = cut ? U * 0.65 : U * 1.75;
  // 叶：长带
  for (let k = 0; k < (cut ? 7 : 11); k++) { const f = k / 10 * 2 - 1, h = H * (0.6 + r() * 0.45); blade(g, [bx + f * 8, by], [bx + f * U * 0.55 + (r() - 0.5) * 10, by - h], f * 10 + (r() - 0.5) * 8, 3.2, [GRASS[0], GRASS[1], GRASS[2]][k % 3]); }
  // 香蒲
  for (let k = 0; k < (cut ? 3 : 4); k++) {
    const x = bx + (k - 1.5) * 9 + (r() - 0.5) * 4, h = cut ? U * (0.35 + r() * 0.2) : U * (1.45 + r() * 0.35), lean = (k - 1.5) * 5;
    g.fillStyle = GRASS[0]; taper(g, [[x, by], [x + lean * 0.5, by - h * 0.5], [x + lean, by - h]], () => 1.4);
    if (cut) { g.fillStyle = '#c4ad74'; g.beginPath(); g.ellipse(x + lean, by - h, 2.2, 1.1, 0, 0, Math.PI * 2); g.fill(); continue; }
    const cx = x + lean, cy = by - h + 10;
    fillPts(g, '#5d371f', [[cx - 4, cy - 12], [cx + 4, cy - 12], [cx + 4.5, cy + 10], [cx - 4.5, cy + 10]], 0, 1, 0.6);
    fillPts(g, '#8f5d36', [[cx - 3.5, cy - 11], [cx - 0.5, cy - 11], [cx - 1, cy + 8], [cx - 3.5, cy + 8]], 0, 1, 0.6);
    g.fillStyle = GRASS[0]; taper(g, [[cx, cy - 11], [cx + 0.5, cy - 22]], () => 0.9);
  }
  return finish(st, seed, W_SMALL);
}

function fern(seed: number): GenOut {
  const r = rng(seed), st = stage(200, 160);
  const { bx, by, g } = st;
  const fronds = 8, order = Array.from({ length: fronds }, (_, i) => i).sort((a, b) => Math.abs(b - 3.5) - Math.abs(a - 3.5));
  for (const k of order) {
    const f = k / (fronds - 1) * 2 - 1, len = U * (0.9 + r() * 0.25) * (1 - Math.abs(f) * 0.2);
    const tip: P = [bx + f * len * 0.85, by - len * (0.95 - Math.abs(f) * 0.55)];
    const ctrl: P = [bx + f * len * 0.25, by - len * 1.1];
    const pts = quadPts([bx, by], ctrl, tip, 14);
    const dark = Math.abs(f) > 0.6;
    g.fillStyle = GREEN.deep; taper(g, pts, (t) => 1.6 * (1 - t) + 0.4);
    for (let i = 2; i < pts.length - 1; i++) {
      const t = i / (pts.length - 1), [x, y] = pts[i], [x2, y2] = pts[i + 1], a = Math.atan2(y2 - y, x2 - x), L = (9 - t * 6) * (1 + 0.15 * Math.sin(i));
      g.fillStyle = dark ? GREEN.mid : i % 2 ? GREEN.hi : GREEN.lit; leafShape(g, x, y, L, 2.6, a - 1.15);
      g.fillStyle = dark ? GREEN.mid : GREEN.lit; leafShape(g, x, y, L, 2.6, a + 1.15);
    }
  }
  return finish(st, seed, W_SMALL);
}

function mushrooms(seed: number): GenOut {
  const r = rng(seed), st = stage(120, 120);
  const { bx, by, g, l } = st;
  const M: [number, number, number][] = [[bx + 12, U * 0.26, 12], [bx - 8, U * 0.4, 17], [bx + 3, U * 0.16, 9]];
  M.sort((a, b) => b[1] - a[1]);
  for (const [x, h, R] of M) {
    fillPts(g, '#d4c7ad', [[x - R * 0.28, by], [x + R * 0.3, by], [x + R * 0.22, by - h], [x - R * 0.2, by - h]], 0.4, seed, 0.4);
    fillPts(g, '#9c8e74', [[x + R * 0.05, by], [x + R * 0.3, by], [x + R * 0.22, by - h], [x + R * 0.05, by - h]], 0, 1, 0.4);
    const cap: P[] = [[x - R, by - h + 2], [x - R * 0.75, by - h - R * 0.55], [x, by - h - R * 0.8], [x + R * 0.75, by - h - R * 0.55], [x + R, by - h + 2], [x, by - h + 4]];
    fillPts(g, '#9e2a1d', cap, 0.4, seed + R, 0.5);
    fillPts(g, '#cf4a30', [[x - R * 0.8, by - h - 1], [x - R * 0.55, by - h - R * 0.55], [x - R * 0.05, by - h - R * 0.72], [x - R * 0.2, by - h - R * 0.2]], 0, 1, 0.5);
    fillPts(g, '#6b4a3a', [[x - R * 0.9, by - h + 1.5], [x + R * 0.9, by - h + 1.5], [x, by - h + 4.5]], 0, 1, 0.4);
    g.fillStyle = '#efe5cf';
    for (let k = 0; k < 4; k++) { g.beginPath(); g.ellipse(x + (r() - 0.5) * R * 1.2, by - h - R * (0.2 + r() * 0.4), 1.6 + r(), 1.1, 0, 0, Math.PI * 2); g.fill(); }
  }
  tuft(g, bx - 2, by, U * 0.18, U * 0.25, 6, GRASS, r, 1.5);
  void l;
  return finish(st, seed, W_SMALL);
}

/** 两色按比例混合（#rrggbb） */
function mix(a: string, b: string, t: number) {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const A = p(a), B = p(b);
  return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('');
}

function tuftProp(seed: number, kind: 'a' | 'b' | 'swamp'): GenOut {
  const r = rng(seed), st = stage(150, 130);
  const { g, l, bx, by } = st;
  const cols = kind === 'a' ? GRASS : kind === 'b' ? [STRAW[0], STRAW[1], GRASS[2], STRAW[2]] : ['#33402e', '#465640', '#5c6e50', '#3d4a3e'];
  const dark = cols.map((c) => mix(c, '#101810', 0.45)), light = cols.map((c) => mix(c, '#f0e6b0', 0.28));
  const H = U * (kind === 'b' ? 0.72 : 0.62);
  g.fillStyle = 'rgba(20,24,14,0.5)'; g.beginPath(); g.ellipse(bx, by, U * 0.36, U * 0.07, 0, 0, Math.PI * 2); g.fill();   // 根部阴影
  tuft(g, bx - 2, by, H * 1.1, U * 0.4, 12, dark, r, 2.2);                 // 后排：深、高
  tuft(g, bx, by, H, U * 0.46, 14, cols, r, 2.1);                           // 中排
  if (kind === 'swamp') for (let k = 0; k < 3; k++) {
    const tip: P = [bx + (k - 1) * 13, by - U * (0.85 + r() * 0.2)];
    blade(g, [bx + (k - 1) * 4, by], tip, (k - 1) * 3, 1.6, '#2c3626');
    g.fillStyle = '#5a3a22'; g.beginPath(); g.ellipse(tip[0], tip[1] + 8, 2.6, 7, (k - 1) * 0.1, 0, Math.PI * 2); g.fill();
  }
  if (kind === 'b') for (let k = 0; k < 4; k++) {   // 枯卷的叶
    const x = bx + (r() - 0.5) * 20, h = H * (0.5 + r() * 0.3), d = r() < 0.5 ? -1 : 1;
    g.fillStyle = STRAW[2]; taper(g, [[x, by], [x + d * 4, by - h * 0.6], [x + d * 14, by - h * 0.85], [x + d * 20, by - h * 0.6]], (t) => 2 * (1 - t) + 0.3);
  }
  tuft(g, bx + 2, by, H * 0.5, U * 0.34, 9, light, r, 1.8);                 // 前排：浅、短
  if (kind !== 'swamp') for (let k = 0; k < 4; k++) {                       // 草穗
    const x = bx + (r() - 0.5) * U * 0.6, y = by - H * (0.75 + r() * 0.35);
    line(l, [[x + (bx - x) * 0.3, by - H * 0.3], [x, y]], 0.8, 'rgba(60,50,30,0.55)');
    g.fillStyle = kind === 'b' ? '#d8c088' : '#c9c27a'; for (let j = 0; j < 4; j++) { g.beginPath(); g.ellipse(x + (j % 2 ? 1.4 : -1.4), y + j * 2.4, 1.5, 2.4, j % 2 ? 0.4 : -0.4, 0, Math.PI * 2); g.fill(); }
  }
  return finish(st, seed, W_SMALL);
}

function rocks(seed: number, kind: 'boulder_a' | 'boulder_b' | 'pebbles' | 'stones_moss'): GenOut {
  const r = rng(seed), V = 84, st = stage(320, 300, 30);
  const { bx, by } = st;
  if (kind === 'boulder_a') rock(st, bx, by - V * 0.06, V * 1.2, V * 1.75, r, ROCK, { tall: 1, moss: 1, angular: 0.15 });
  else if (kind === 'boulder_b') rock(st, bx, by - V * 0.06, V * 1.1, V * 2.05, r, { ...ROCK, base: '#4c4c4d', lit: '#7c7d7e', dark: '#29292b' }, { tall: 1, moss: 0.4, angular: 0.45 });
  else {
    const n = kind === 'pebbles' ? 5 : 3;
    const P0: [number, number, number][] = [];
    for (let i = 0; i < n; i++) P0.push([bx + (i - (n - 1) / 2) * V * (kind === 'pebbles' ? 0.2 : 0.3) + (r() - 0.5) * 8, by - (i % 2) * 7 - 2, V * (kind === 'pebbles' ? 0.12 + r() * 0.07 : 0.17 + r() * 0.08)]);
    P0.sort((a, b) => a[1] - b[1]);
    for (const [x, y, s] of P0) rock(st, x, y, s * 1.15, s * 1.25, r, ROCK, { tall: 1, moss: kind === 'stones_moss' ? 1.4 : 0, angular: 0.35 });
  }
  return finish(st, seed, kind.startsWith('boulder') ? W_MID : W_SMALL);
}

function flint(seed: number): GenOut {
  const r = rng(seed), st = stage(130, 110);
  const { bx, by, g, l } = st;
  // 地上的碎屑
  for (let k = 0; k < 6; k++) { const x = bx + (r() - 0.5) * 50, y = by - r() * 3; fillPts(g, k % 2 ? '#3a3d44' : '#6b6a64', [[x - 2.5, y], [x, y - 2.5 - r() * 2], [x + 3, y]], 0, 1, 0.1); }
  const N = 3 + (r() < 0.5 ? 1 : 0);
  for (let k = 0; k < N; k++) {
    const x = bx + (k - (N - 1) / 2) * 13 + (r() - 0.5) * 4, h = 16 + r() * 14, w = 8 + r() * 4, lean = (k - (N - 1) / 2) * 5 + (r() - 0.5) * 4;
    const tip: P = [x + lean, by - h];
    const pts: P[] = [[x - w, by], [x - w * 0.85, by - h * 0.4], [x - w * 0.3, by - h * 0.82], tip, [x + w * 0.55, by - h * 0.6], [x + w * 0.95, by - h * 0.2], [x + w, by]];
    fillPts(g, '#25272e', pts, 0, 1, 0.05);
    g.save(); g.beginPath(); smoothClosed(g, pts, 0.05); g.clip();
    // 白色皮壳（燧石结核外皮）
    fillPts(g, '#cfc8b4', [[x + w * 0.3, by + 2], [x + w * 1.2, by + 2], [x + w * 1.2, by - h * 0.5], [x + w * 0.6, by - h * 0.35]], 0.6, k, 0.4);
    // 打制面：亮灰的贝壳状剥片，层层弧纹
    fillPts(g, '#5a6070', [[x - w * 0.9, by - h * 0.35], [x - w * 0.25, by - h * 0.85], tip, [x + lean * 0.3, by - h * 0.3], [x - w * 0.5, by - 2]], 0, 1, 0.05);
    fillPts(g, '#8a92a4', [[x - w * 0.5, by - h * 0.6], [x - w * 0.15, by - h * 0.82], [x + lean * 0.7, by - h * 0.86], [x - w * 0.2, by - h * 0.48]], 0, 1, 0.05);
    for (let j = 0; j < 4; j++) { l.strokeStyle = 'rgba(15,15,20,0.45)'; l.lineWidth = 0.7; l.beginPath(); l.ellipse(x - w * 0.6, by - h * 0.3, w * (0.4 + j * 0.25), h * (0.15 + j * 0.12), -0.7, -1.2, 0.3); l.stroke(); }
    g.restore();
    line(l, [tip, [x - w * 0.3, by - h * 0.82], [x - w * 0.85, by - h * 0.4]], 1.1, 'rgba(225,232,245,0.7)');   // 锋口反光
    line(l, [tip, [x + w * 0.55, by - h * 0.6]], 0.8, 'rgba(225,232,245,0.4)');
  }
  return finish(st, seed, W_SMALL);
}

function bones(seed: number): GenOut {
  const r = rng(seed), V = 84, st = stage(260, 200);
  const { bx, by, g, l } = st;
  const BONE = ['#d6c9ab', '#9b8e72', '#f0e6cc'];
  // 肋骨与脊椎（右侧）
  const sx = bx + V * 0.25;
  for (let k = 0; k < 5; k++) { const x = sx + k * 11; g.fillStyle = k % 2 ? BONE[1] : BONE[0]; taper(g, quadPts([x, by - V * 0.42], [x + 16, by - V * 0.55], [x + 22, by - 2], 10), (t) => 2.6 - t * 1.2); }
  g.fillStyle = BONE[0]; taper(g, [[sx - 4, by - V * 0.42], [sx + 30, by - V * 0.46], [sx + 62, by - V * 0.38]], () => 3);
  for (let k = 0; k < 6; k++) { g.fillStyle = BONE[2]; g.beginPath(); g.ellipse(sx + k * 11, by - V * 0.43 - k * 0.3, 3.4, 2.4, 0, 0, Math.PI * 2); g.fill(); }
  // 颅骨（左侧，带角）
  const cx = bx - V * 0.25, cy = by - V * 0.38;
  for (const s of [-1, 1]) { g.fillStyle = s < 0 ? '#b3a280' : '#8d7e60'; taper(g, quadPts([cx + s * 12, cy - 10], [cx + s * 34, cy - 22], [cx + s * 30, cy - 44], 10), (t) => 5 * (1 - t) + 0.6); }
  const skull: P[] = [[cx - 18, cy - 14], [cx, cy - 20], [cx + 18, cy - 14], [cx + 14, cy + 6], [cx + 6, cy + 28], [cx - 6, cy + 28], [cx - 14, cy + 6]];
  fillPts(g, BONE[0], skull, 0.5, seed, 0.45);
  fillPts(g, BONE[2], [[cx - 16, cy - 13], [cx - 2, cy - 18], [cx - 4, cy + 4], [cx - 12, cy + 4]], 0, 1, 0.45);
  fillPts(g, BONE[1], [[cx + 4, cy - 16], [cx + 18, cy - 13], [cx + 12, cy + 10], [cx + 5, cy + 27], [cx + 3, cy + 6]], 0, 1, 0.45);
  for (const s of [-1, 1]) fillPts(g, '#1c1612', ellipsePts(cx + s * 7, cy - 3, 4.2, 5, 10, s * 0.3), 0);
  fillPts(g, '#3a2e24', [[cx - 3, cy + 18], [cx + 3, cy + 18], [cx + 1.5, cy + 23], [cx - 1.5, cy + 23]], 0);
  line(l, [[cx - 2, cy - 18], [cx - 1, cy - 8], [cx + 1, cy - 2]], 0.9);
  // 散骨
  g.fillStyle = BONE[0]; taper(g, [[bx - V * 0.62, by - 4], [bx - V * 0.4, by - 8]], () => 2.2);
  return finish(st, seed, W_SMALL);
}

function bench(seed: number): GenOut {
  const r = rng(seed), V = 86, st = stage(300, 300);
  const { bx, by, g, l } = st;
  const WOOD = ['#5a3b24', '#36231a', '#8a5e3a'];
  const tx = bx + V * 0.42, tw = V * 1.05, top = by - V * 0.95;
  // 腿（后 → 前）与横撑
  for (const [x, y, d] of [[tx - tw * 0.75, top + 6, true], [tx + tw * 0.85, top + 6, true]] as [number, number, boolean][]) { g.fillStyle = WOOD[1]; taper(g, [[x, y], [x + 1, by - 12]], () => 4); void d; }
  g.fillStyle = WOOD[1]; taper(g, [[tx - tw * 0.8, by - V * 0.35], [tx + tw * 0.8, by - V * 0.38]], () => 3);
  for (const x of [tx - tw * 0.9, tx + tw * 0.7]) { g.fillStyle = WOOD[0]; taper(g, [[x, top + 8], [x - 2, by]], () => 5.5); g.fillStyle = WOOD[2]; taper(g, [[x - 2.5, top + 10], [x - 4, by - 4]], () => 1.4); }
  // 桌面
  fillPts(g, WOOD[0], [[tx - tw, top], [tx + tw * 0.85, top - 8], [tx + tw * 0.9, top + 4], [tx - tw * 0.98, top + 13]], 0.6, seed, 0.2);
  fillPts(g, WOOD[2], [[tx - tw, top], [tx + tw * 0.85, top - 8], [tx + tw * 0.86, top - 4], [tx - tw * 0.99, top + 4]], 0, 1, 0.2);
  for (let k = 0; k < 3; k++) line(l, [[tx - tw * 0.9, top + 2 + k * 3], [tx + tw * 0.8, top - 6 + k * 3]], 0.7, 'rgba(25,15,8,0.5)');
  // 浑天仪
  const ax = tx - tw * 0.35, ay = top - V * 0.55;
  g.fillStyle = WOOD[1]; taper(g, [[ax, top], [ax, ay + 12]], () => 2.4);
  fillPts(g, WOOD[0], [[ax - 9, top + 1], [ax + 9, top - 1], [ax + 6, top - 6], [ax - 6, top - 5]], 0, 1, 0.3);
  g.strokeStyle = '#a07a3a'; g.lineWidth = 3;
  for (const [rx, ry, rot] of [[17, 17, 0], [17, 6, 0.4], [6, 17, -0.3], [17, 8, -0.9]] as [number, number, number][]) { g.beginPath(); g.ellipse(ax, ay, rx, ry, rot, 0, Math.PI * 2); g.stroke(); }
  g.fillStyle = '#c9a050'; g.beginPath(); g.arc(ax, ay, 3.5, 0, Math.PI * 2); g.fill();
  // 卷轴、钵
  fillPts(g, '#d9ccad', [[tx + 2, top - 10], [tx + 26, top - 15], [tx + 28, top - 8], [tx + 4, top - 3]], 0.3, seed + 3, 0.4);
  g.fillStyle = '#9a8b6c'; g.beginPath(); g.ellipse(tx + 27, top - 11.5, 3, 4, 0, 0, Math.PI * 2); g.fill();
  fillPts(g, '#2e2b28', [[tx + tw * 0.45, top - 14], [tx + tw * 0.78, top - 16], [tx + tw * 0.74, top - 4], [tx + tw * 0.5, top - 2]], 0.3, seed + 4, 0.6);
  fillPts(g, '#5a5650', [[tx + tw * 0.45, top - 14], [tx + tw * 0.78, top - 16], [tx + tw * 0.75, top - 12], [tx + tw * 0.47, top - 11]], 0, 1, 0.5);
  g.fillStyle = WOOD[2]; taper(g, [[tx + tw * 0.62, top - 12], [tx + tw * 0.8, top - 30]], (t) => 2.5 - t);
  // 挂在桌边的葫芦
  for (const [dx, s] of [[-tw * 1.0, 1], [-tw * 0.82, 0.8]] as [number, number][]) {
    const gx = tx + dx, gy = top + 24 * s + 10;
    line(l, [[gx, top + 6], [gx, gy - 9 * s]], 1);
    g.fillStyle = '#9b5a26'; g.beginPath(); g.ellipse(gx, gy - 7 * s, 4.5 * s, 5 * s, 0, 0, Math.PI * 2); g.fill(); g.beginPath(); g.ellipse(gx, gy + 4 * s, 7.5 * s, 8 * s, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#d18e4e'; g.beginPath(); g.ellipse(gx - 2.5 * s, gy + 1 * s, 2.4 * s, 3 * s, -0.4, 0, Math.PI * 2); g.fill();
  }
  void r;
  return finish(st, seed, W_MID);
}

const DEFS: [string, number, (s: number) => GenOut][] = [
  ['berrybush', 601, (s) => bush(s, false)], ['berrybush_picked', 602, (s) => bush(s, true)],
  ['grass_tuft', 611, (s) => grass(s, false)], ['grass_cut', 612, (s) => grass(s, true)],
  ['twig_bush', 621, (s) => sapling(s, false)], ['twig_cut', 622, (s) => sapling(s, true)],
  ['flower_red', 631, (s) => flower(s, 'red')], ['flower_yellow', 632, (s) => flower(s, 'yellow')], ['flower_blue', 633, (s) => flower(s, 'blue')],
  ['carrot_plant', 641, carrot], ['reeds', 651, (s) => reeds(s, false)], ['reeds_cut', 652, (s) => reeds(s, true)],
  ['fern', 661, fern], ['mushrooms', 671, mushrooms],
  ['tuft_a', 681, (s) => tuftProp(s, 'a')], ['tuft_b', 682, (s) => tuftProp(s, 'b')], ['tuft_swamp', 683, (s) => tuftProp(s, 'swamp')],
  ['boulder_a', 691, (s) => rocks(s, 'boulder_a')], ['boulder_b', 692, (s) => rocks(s, 'boulder_b')],
  ['pebbles', 693, (s) => rocks(s, 'pebbles')], ['stones_moss', 694, (s) => rocks(s, 'stones_moss')],
  ['flint_ground', 695, flint], ['bones', 701, bones], ['bench', 711, bench],
];
for (const [name, seed, gen] of DEFS) register({ name, kind: 'sprite', group: 'props', seed, gen });
export type { Stage, RockPal, Rand };
void smoothClosed; void wobble;
