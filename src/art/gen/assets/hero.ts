/**
 * 行者（侧面）骨骼部件：与 src/art/rig.ts 的剪纸骨骼一一对应（同名部件、同一套关节点），
 * HeroRig 无需改动即可驱动。每个部件 = 少量平涂色块（固有色 / 背光 / 迎光）+ 墨线，最后统一水墨晕染。
 * 远侧肢体（*F）用压暗的色板，形成前后层次。坐标单位：像素（110 px / 世界单位，与手绘部件一致）。
 */
import { register, GenOut } from '../registry';
import { rng, Rand } from '../noise';
import { canvas, wash } from '../wash';
import { P, smoothClosed, smoothOpen, wobble, taper, ellipsePts } from '../brush';

type Ctx = CanvasRenderingContext2D;
const PAD = 7;

const BASE = {
  robe: '#3e4449', robeD: '#272b30', robeL: '#5f6668', trim: '#8a8a84', inner: '#1c1f24',
  pants: '#2c2d33', pantsD: '#1d1e23', pantsL: '#43454e',
  scarf: '#9b2e22', scarfD: '#5e1816', scarfL: '#cc5236',
  straw: '#a57b45', strawD: '#6c4c29', strawL: '#d6ac6b', band: '#3a281b',
  skin: '#a87253', skinD: '#6e432e', skinL: '#cf9a71', hair: '#1b1613',
  wrap: '#7c6a56', wrapD: '#4f4234', wrapL: '#a39079', sandal: '#a8844e', sandalD: '#6e532e', sandalL: '#d2b47a', cloth: '#a99d86', clothD: '#706653',
  sash: '#5d4129', sashL: '#8a6440', gourd: '#a6622b', gourdL: '#d79552', gourdD: '#6a3a18',
  ink: 'rgba(20,14,11,0.7)', inkS: 'rgba(20,14,11,0.45)',
};
type Pal = typeof BASE;
/** 远侧肢体：整体压暗、略偏冷 */
function farPal(): Pal {
  const o: Record<string, string> = {};
  for (const [k, v] of Object.entries(BASE)) {
    if (!v.startsWith('#')) { o[k] = v; continue; }
    const n = parseInt(v.slice(1), 16), f = 0.7;
    const r = Math.round(((n >> 16) & 255) * f), g = Math.round(((n >> 8) & 255) * f), b = Math.round((n & 255) * f * 1.06);
    o[k] = '#' + ((1 << 24) | (r << 16) | (g << 8) | Math.min(255, b)).toString(16).slice(1);
  }
  return o as Pal;
}
const FAR = farPal();

interface Draw { g: Ctx; l: Ctx; r: Rand; c: Pal }
/** 部件画布：drawFn 在“手绘部件坐标”里作画；返回带关节点的 GenOut */
function part(w: number, h: number, pts: Record<string, [number, number]>, seed: number, fn: (d: Draw) => void, c: Pal = BASE): GenOut {
  const W = w + PAD * 2, H = h + PAD * 2;
  const [cv, g] = canvas(W, H), [lc, l] = canvas(W, H);
  g.translate(PAD, PAD); l.translate(PAD, PAD);
  fn({ g, l, r: rng(seed), c });
  const out = wash(cv, { seed, bleed: 1.5, inkAmt: 0.92, edge: 0.25, edgeR: 2.4, form: 0.3, formR: 9, pigScale: 9, pigment: 0.08, grain: 0.06, rimAmt: 0.2, rimW: 1.3, lines: lc });
  const P2: Record<string, [number, number]> = {};
  for (const [k, v] of Object.entries(pts)) P2[k] = [+(v[0] + PAD).toFixed(1), +(v[1] + PAD).toFixed(1)];
  return { canvas: out, pivot: [P2.joint[0] / W, P2.joint[1] / H], points: P2 };
}

// —— 小工具 ——
function fill(g: Ctx, col: string, pts: P[], wob = 0.8, seed = 1, t = 0.5) { g.fillStyle = col; g.beginPath(); smoothClosed(g, wob ? wobble(pts, wob, seed, 3, 0.35) : pts, t); g.fill(); }
function clipTo(g: Ctx, pts: P[], fn: () => void, t = 0.5) { g.save(); g.beginPath(); smoothClosed(g, pts, t); g.clip(); fn(); g.restore(); }
function stroke(l: Ctx, pts: P[], w = 1, col = BASE.ink) { l.strokeStyle = col; l.lineWidth = w; l.lineCap = 'round'; l.lineJoin = 'round'; l.beginPath(); smoothOpen(l, pts); l.stroke(); }
/** 撕裂的下摆：沿 a→b 生成锯齿边（向 dir 方向下垂） */
function tatter(a: P, b: P, n: number, depth: number, r: Rand): P[] {
  const out: P[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t;
    const long = i % 2 && r() < 0.34 ? 2.1 + r() * 0.6 : 1;   // 偶尔一条长布条
    out.push([x + (r() - 0.5) * 2, y + (i % 2 ? depth * (0.4 + r() * 0.9) * long : -depth * 0.15 * r())]);
  }
  return out;
}

/** 毛边：在下摆布条尖端垂几根细线头（色层画，随墨晕包边） */
function fringe(g: Ctx, hem: P[], col: string, r: Rand, len = 4) {
  g.save(); g.strokeStyle = col; g.lineCap = 'round';
  for (let i = 1; i < hem.length - 1; i++) {
    const [x, y] = hem[i]; if (y < hem[i - 1][1] || y < hem[i + 1][1]) continue;   // 只在布条尖
    for (let k = 0; k < 2 + Math.floor(r() * 2); k++) {
      const dx = (r() - 0.5) * 3, L = len * (0.5 + r());
      g.lineWidth = 0.6 + r() * 0.5; g.beginPath(); g.moveTo(x + dx, y - 1); g.quadraticCurveTo(x + dx + (r() - 0.5) * 2, y + L * 0.5, x + dx + (r() - 0.5) * 3, y + L); g.stroke();
    }
  }
  g.restore();
}
/** 旧衣：下摆积尘、一块缝补的补丁、两三个破洞、褪色斑（须在 clipTo 内调用） */
function wear(g: Ctx, l: Ctx, x0: number, y0: number, x1: number, y1: number, r: Rand, c: Pal, patch = true) {
  const gr = g.createLinearGradient(0, y0 + (y1 - y0) * 0.55, 0, y1);
  gr.addColorStop(0, 'rgba(120,96,64,0)'); gr.addColorStop(1, 'rgba(120,96,64,0.38)');
  g.fillStyle = gr; g.fillRect(x0 - 4, y0, x1 - x0 + 8, y1 - y0 + 6);
  for (let k = 0; k < 4; k++) { g.fillStyle = 'rgba(190,190,170,0.10)'; g.beginPath(); g.ellipse(x0 + (x1 - x0) * r(), y0 + (y1 - y0) * r(), 3 + r() * 5, 2 + r() * 4, r() * 3, 0, Math.PI * 2); g.fill(); }
  if (patch) {
    const px = x0 + (x1 - x0) * (0.25 + r() * 0.4), py = y0 + (y1 - y0) * (0.3 + r() * 0.3), pw = 7 + r() * 5, ph = 6 + r() * 5, a = (r() - 0.5) * 0.4;
    g.save(); g.translate(px, py); g.rotate(a); g.fillStyle = c.robeL; g.fillRect(-pw / 2, -ph / 2, pw, ph); g.fillStyle = 'rgba(150,120,80,0.35)'; g.fillRect(-pw / 2, -ph / 2, pw, ph); g.restore();
    l.save(); l.translate(px, py); l.rotate(a); l.strokeStyle = 'rgba(30,20,14,0.55)'; l.lineWidth = 0.6; l.setLineDash([1.6, 1.4]); l.strokeRect(-pw / 2 + 1, -ph / 2 + 1, pw - 2, ph - 2); l.restore();
  }
  for (let k = 0; k < 2; k++) {
    const hx = x0 + (x1 - x0) * (0.15 + r() * 0.7), hy = y0 + (y1 - y0) * (0.55 + r() * 0.3);
    g.fillStyle = 'rgba(14,12,14,0.85)'; g.beginPath(); smoothClosed(g, wobble(ellipsePts(hx, hy, 1.6 + r() * 1.6, 1.0 + r() * 1.4, 7, r() * 3, 0.3, r), 0.5, Math.floor(r() * 99), 3, 0.3)); g.fill();
    stroke(l, [[hx - 2, hy - 2], [hx + 1, hy - 3]], 0.5, 'rgba(200,190,160,0.5)');
  }
}

/** 草鞋鞋底（侧面）：厚草编底 + 编纹 + 两端翘出的草梢 */
function waraji(g: Ctx, l: Ctx, xa: number, xb: number, y: number, r: Rand, c: Pal, th = 5) {
  const sole: P[] = [[xa, y - th], [xb, y - th], [xb + 2, y - th * 0.4], [xb, y + 1], [xa + 1, y + 1], [xa - 2, y - th * 0.5]];
  fill(g, c.sandal, sole, 0.3, 7, 0.4);
  clipTo(g, sole, () => {
    fill(g, c.sandalD, [[xa - 3, y - th * 0.35], [xb + 3, y - th * 0.35], [xb + 3, y + 2], [xa - 3, y + 2]], 0);
    g.strokeStyle = c.sandalL; g.lineWidth = 0.8;
    for (let x = xa; x < xb; x += 2.6) { g.beginPath(); g.moveTo(x, y - th + 0.6); g.lineTo(x + 1.6, y - th * 0.45); g.stroke(); }
    g.strokeStyle = c.sandalD; for (let x = xa + 1.3; x < xb; x += 2.6) { g.beginPath(); g.moveTo(x, y - th * 0.4); g.lineTo(x + 1.5, y); g.stroke(); }
  }, 0.4);
  g.strokeStyle = c.sandalL; g.lineWidth = 0.7;
  for (const [x, d] of [[xa - 1, -1], [xb + 1, 1]] as [number, number][]) for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(x, y - th * 0.5 + k); g.lineTo(x + d * (2 + r() * 2), y - th * 0.6 + k * 1.4 - r()); g.stroke(); }
  stroke(l, [[xa, y + 0.6], [xb, y + 0.6]], 0.9, BASE.inkS);
}

/** 布褶：从收紧处向下张开的暗楔 + 一侧亮边 */
function fold(g: Ctx, top: P, bot: P, w: number, dark: string, light: string) {
  g.fillStyle = dark; taper(g, [top, [(top[0] + bot[0]) / 2 + 0.5, (top[1] + bot[1]) / 2], bot], (t) => 0.4 + t * w);
  g.fillStyle = light; taper(g, [[top[0] - 1.5, top[1] + 3], [(top[0] + bot[0]) / 2 - w * 0.9, (top[1] + bot[1]) / 2], [bot[0] - w * 1.4, bot[1]]], (t) => 0.3 + t * w * 0.45);
}

// —— 部件 ——
function head(seed: number) {
  return part(95, 92, { joint: [59, 70.9], hatJoint: [47.2, 27.4] }, seed, ({ g, l, c }) => {
    // 脖子
    fill(g, c.skinD, [[50, 52], [64, 50], [66, 74], [52, 76]], 0);
    // 后脑头发与发髻
    fill(g, c.hair, [[56, 22], [70, 26], [74, 38], [72, 50], [64, 56], [56, 48], [54, 32]], 0.8, seed);
    fill(g, c.hair, [[70, 36], [80, 39], [83, 46], [77, 50], [71, 46]], 0.6, seed + 1);
    // 脸（侧面，朝左）
    const face: P[] = [[62, 24], [66, 36], [64, 50], [58, 60], [48, 63], [40, 61], [37.5, 57], [35, 54], [34, 50.5], [27.5, 48], [31.5, 42], [33.5, 34], [38, 27], [48, 22]];
    fill(g, c.skin, face, 0, seed, 0.45);
    clipTo(g, face, () => {
      fill(g, c.skinL, [[33, 45], [38, 44.5], [41, 49], [37, 52.5], [34, 50]], 0, seed);       // 迎光的颧
      fill(g, c.skinD, [[54, 24], [66, 30], [66, 56], [56, 56], [54, 40]], 0, seed);        // 背光的后脸
      fill(g, 'rgba(52,28,18,0.82)', [[20, 20], [70, 20], [70, 44], [46, 45], [36, 43.5], [20, 42]], 0); // 帽檐投影
    }, 0.45);
    fill(g, c.hair, [[52, 24], [64, 24], [62, 38], [55, 36]], 0.6, seed + 2);               // 鬓发
    fill(g, c.skinD, [[55, 40], [60, 39], [61, 46], [56, 47]], 0.4, seed + 3);              // 耳
    // 五官：极简的墨笔
    stroke(l, [[35.5, 38.5], [40.5, 38], [42.5, 39.5]], 1.4);
    // 帽檐阴影里一点眼光：看得出在看，看不清神情
    g.fillStyle = 'rgba(255,214,150,0.85)'; g.beginPath(); g.ellipse(38.6, 41.2, 1.25, 0.8, -0.1, 0, Math.PI * 2); g.fill();
    stroke(l, [[36, 41.6], [38.6, 42.4], [41, 41.4]], 0.8, BASE.inkS);
    stroke(l, [[44, 52], [46, 55.5], [50, 57]], 0.8, 'rgba(40,22,14,0.35)');
    stroke(l, [[35, 53.5], [38.5, 54]], 1, BASE.inkS);
    stroke(l, [[29, 48], [33, 49.5]], 0.9, BASE.inkS);
    stroke(l, [[57, 41.5], [58.5, 44], [57, 46]], 0.9, BASE.inkS);
    // 围巾缠颈
    const wrap: P[] = [[38, 59], [50, 57], [62, 51], [72, 55], [74, 66], [68, 76], [54, 80], [42, 76], [36, 66]];
    fill(g, c.scarf, wrap, 1, seed + 4);
    clipTo(g, wrap, () => {
      fill(g, c.scarfL, [[36, 60], [52, 57], [56, 62], [42, 67]], 0.6, seed + 5);
      fill(g, c.scarfD, [[60, 58], [76, 58], [76, 80], [56, 80], [62, 68]], 0.6, seed + 6);
    });
    stroke(l, [[40, 66], [52, 63], [64, 60]], 1.1);
    stroke(l, [[44, 73], [56, 70], [68, 67]], 1, BASE.inkS);
  });
}

function hat(seed: number) {
  return part(91, 39, { joint: [47.2, 27.4] }, seed, ({ g, l, r, c }) => {
    const sh: P[] = [[1, 31], [12, 26.5], [30, 15], [43, 5], [47, 2.5], [51, 5], [64, 15], [80, 25.5], [90, 30.5], [86, 34.5], [68, 36.5], [47, 37.5], [26, 36.5], [6, 34.5]];
    fill(g, c.straw, sh, 0, seed, 0.3);
    clipTo(g, sh, () => {
      fill(g, c.strawL, [[0, 32], [14, 25], [32, 13], [45, 3], [47, 6], [36, 20], [24, 31], [8, 34]], 0, seed, 0.3);
      fill(g, c.strawD, [[52, 4], [66, 14], [84, 26], [92, 32], [70, 30], [56, 22]], 0, seed, 0.3);
      fill(g, c.strawD, [[0, 33], [47, 34.5], [92, 32], [92, 40], [0, 40]], 0, seed, 0.2);        // 帽檐厚度
      fill(g, c.band, [[44, 4], [50, 4], [51, 7], [43, 7]], 0, seed);                                // 帽顶
    }, 0.3);
    // 编织：放射线 + 同心弧
    for (let i = 0; i <= 12; i++) { const t = i / 12, x = 4 + t * 84; stroke(l, [[47, 3], [47 + (x - 47) * 0.55, 18 + Math.abs(t - 0.5) * 2], [x, 32 + Math.sin(t * Math.PI) * 2.5]], 0.7, i % 2 ? BASE.inkS : 'rgba(255,230,180,0.28)'); }
    for (const k of [0.45, 0.75]) stroke(l, [[47 - 43 * k, 4 + 27 * k], [47, 4 + 30 * k], [47 + 43 * k, 4 + 27 * k]], 0.8, BASE.inkS);
    void r;
  });
}

function torso(seed: number) {
  return part(66, 99, { joint: [35.7, 90.2], neck: [31.9, 5.4], shN: [57.9, 16.8], shF: [6.7, 16.8] }, seed, ({ g, l, r, c }) => {
    const body: P[] = [[22, 3], [41, 2], [52, 7], [59, 13], [63, 23], [61, 42], [57, 62], [56, 80], [57, 97], [15, 97], [16, 80], [11, 60], [5, 40], [3, 23], [8, 13], [16, 7]];
    fill(g, c.robe, body, 0.7, seed, 0.4);
    clipTo(g, body, () => {
      fill(g, c.robeD, [[43, 3], [60, 12], [66, 24], [62, 50], [58, 99], [42, 99], [46, 60], [49, 28]], 1, seed + 1);
      fill(g, c.robeL, [[6, 15], [21, 7], [29, 18], [25, 44], [12, 54], [5, 36]], 1, seed + 2);
      // 交领：内衬暗 V + 领缘亮带
      fill(g, c.inner, [[22, 2], [36, 2], [23, 24]], 0, seed);
      g.fillStyle = c.trim; taper(g, [[40, 2], [33, 14], [24, 28], [15, 46]], (t) => 3.6 - t * 1.2);
      g.fillStyle = c.robeD; taper(g, [[22, 3], [19, 12], [14, 22]], () => 2);
      fold(g, [22, 76], [30, 40], 2.2, c.robeD, c.robeL);
      fold(g, [44, 76], [40, 46], 2, c.robeD, c.robeL);
      wear(g, l, 4, 10, 60, 74, r, c, false);
      // 腰带
      fill(g, c.sash, [[6, 77], [62, 75], [62, 90], [6, 92]], 0.6, seed + 3);
      fill(g, c.sashL, [[6, 77], [62, 75], [62, 79], [6, 81]], 0, seed);
    }, 0.4);
    // 腰带结与垂带（前侧）
    fill(g, c.sash, [[10, 80], [20, 81], [19, 89], [9, 89]], 0.5, seed + 4);
    g.fillStyle = c.sash; taper(g, [[13, 88], [11, 96], [12, 104]], (t) => 3 - t * 1.5);
    // 酒葫芦（后腰）
    g.fillStyle = c.gourd;
    g.beginPath(); g.ellipse(57, 76, 5.5, 6, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(59, 89, 9, 9.5, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = c.gourdD; g.beginPath(); g.ellipse(61.5, 91, 6.5, 7.5, 0, -0.6, 2.2); g.fill();
    g.fillStyle = c.gourdL; g.beginPath(); g.ellipse(55.5, 86, 3, 3.6, -0.5, 0, Math.PI * 2); g.fill();
    g.fillStyle = c.band; g.fillRect(53, 80.5, 8, 2.2);
    // 衣褶墨线
    stroke(l, [[30, 30], [32, 50], [30, 72]], 1, BASE.inkS);
    stroke(l, [[46, 22], [50, 45], [48, 74]], 1.1);
    stroke(l, [[14, 56], [22, 64], [24, 74]], 0.9, BASE.inkS);
    stroke(l, [[6, 85], [60, 83]], 0.8, BASE.inkS);
  });
}

function skirt(seed: number) {
  return part(76, 93, { joint: [43.3, 3.6] }, seed, ({ g, l, r, c }) => {
    const hem = tatter([79, 83], [-2, 86], 15, 7, r);
    const sh: P[] = [[18, 0], [67, 0], [71, 26], [76, 56], ...hem, [2, 58], [10, 28]];
    fill(g, c.robe, sh, 0.5, seed, 0.35);
    clipTo(g, sh, () => {
      fill(g, c.robeD, [[50, 0], [70, 0], [78, 50], [80, 96], [52, 96], [56, 50]], 1, seed + 1);
      fill(g, c.robeD, [[-2, 74], [80, 70], [80, 96], [-2, 96]], 1.5, seed + 3);
      fill(g, c.robeL, [[12, 2], [26, 2], [24, 40], [14, 66], [6, 64], [8, 30]], 1, seed + 2);
      // 前襟开衩：露出暗色内衬
      fill(g, c.robeD, [[14, 44], [18, 46], [15, 96], [9, 96]], 0.6, seed + 4);
      for (const [x0, x1, w] of [[28, 22, 3.2], [40, 42, 3.6], [55, 63, 3.4], [66, 76, 2.6]] as [number, number, number][]) fold(g, [x0, 8], [x1, 88], w, c.robeD, c.robeL);
      wear(g, l, 0, 0, 78, 92, r, c);
    }, 0.35);
    fringe(g, hem, c.robeD, r, 5);
    for (const [x0, x1, w] of [[30, 26, 1.1], [44, 48, 1], [58, 66, 1.1], [20, 12, 0.9]] as [number, number, number][]) stroke(l, [[x0, 6], [(x0 + x1) / 2 + 1, 45], [x1, 82]], w, w > 1 ? BASE.ink : BASE.inkS);
  });
}

function scarf(seed: number) {
  return part(70, 119, { joint: [16.9, 8.3] }, seed, ({ g, l, r, c }) => {
    // 结 + 两条 S 形飘带：后带细、在后；主带宽，过半后撕成三缕各自飘散，尖端起毛
    const S = (x0: number, y0: number, x1: number, y1: number, amp: number, ph: number, n = 7): P[] => {
      const o: P[] = []; for (let i = 0; i <= n; i++) { const t = i / n; o.push([x0 + (x1 - x0) * t + Math.sin(t * Math.PI * 1.6 + ph) * amp * t, y0 + (y1 - y0) * t]); } return o;
    };
    const tips: [P, string][] = [];
    const strand = (pts: P[], w0: number, w1: number, col: string) => { g.fillStyle = col; taper(g, pts, (t) => w0 + (w1 - w0) * t); tips.push([pts[pts.length - 1], col]); };
    // 后带两缕
    strand(S(19, 8, 60, 80, 4, 0.8), 5, 1.2, c.scarfD);
    strand(S(22, 12, 66, 70, 3, 2.0, 6), 3.5, 1, c.scarfD);
    // 主带：上段宽带
    const main = S(16, 6, 36, 60, 3, 0.2, 6);
    g.fillStyle = c.scarf; taper(g, main, (t) => 9 + t * 3);
    const m = main[main.length - 1];
    for (const [dx, ex, ey, amp, ph, w] of [[-4, 36, 112, 4, 0.3, 4.2], [0, 48, 108, 5, 1.4, 4.6], [4, 58, 98, 3.5, 2.4, 3.6]] as number[][]) {
      strand(S(m[0] + dx, m[1] - 2, ex + (r() - 0.5) * 3, ey, amp, ph, 6), w, 0.9, c.scarf);
    }
    g.save(); g.globalCompositeOperation = 'source-atop';
    g.fillStyle = c.scarfD; taper(g, main.map(([x, y], i) => [x + 4 + i * 0.6, y - 1] as P), (t) => 3.5 + t * 2.5);
    g.fillStyle = c.scarfL; taper(g, [[14, 8], [18, 20], [24, 36]], (t) => 3.5 - t * 2);
    g.fillStyle = c.scarfL; taper(g, [[28, 44], [31, 56], [35, 70], [38, 84]], (t) => 2.6 - t * 1.8);
    g.restore();
    // 线头
    g.save(); g.lineCap = 'round';
    for (const [[x, y], col] of tips) for (let k = 0; k < 3; k++) { g.strokeStyle = col; g.lineWidth = 0.7; g.beginPath(); g.moveTo(x, y - 1); g.quadraticCurveTo(x + (r() - 0.3) * 3, y + 2, x + 1 + (r() - 0.2) * 4, y + 3 + r() * 4); g.stroke(); }
    g.restore();
    // 结
    fill(g, c.scarf, [[8, 2], [22, 0], [27, 9], [20, 16], [10, 14]], 0.6, seed + 9, 0.55);
    fill(g, c.scarfL, [[9, 3], [17, 2], [15, 8], [10, 9]], 0, seed, 0.55);
    stroke(l, [[20, 20], [26, 38], [33, 56]], 1, BASE.inkS);
    stroke(l, [[34, 62], [40, 66]], 1.1);
    stroke(l, [[44, 84], [50, 90]], 0.9, BASE.inkS);
    stroke(l, [[12, 10], [20, 9]], 1, BASE.ink);
  });
}

function sleeve(seed: number, far: boolean) {
  const c = far ? FAR : BASE;
  const [w, h, j, e] = far ? [46, 79, [18.9, 3.5], [20.2, 42.7]] : [49, 87, [21.9, 4.5], [21.5, 58.1]];
  const k = h / 87;
  return part(w, h, { joint: j as [number, number], elbow: e as [number, number] }, seed, ({ g, l, r, c: cc }) => {
    const ex = e[0], ey = e[1];
    const hem = tatter([ex + 19, h - 3], [ex - 17, h - 2], 7, 5, r);
    const sh: P[] = [[j[0] - 10, 0], [j[0] + 10, 0], [j[0] + 13, ey * 0.5], [ex + 15, ey], [ex + 19, h - 7], ...hem, [ex - 17, h - 7], [ex - 13, ey], [j[0] - 11, ey * 0.45]];
    fill(g, cc.robe, sh, 0.5, seed, 0.4);
    clipTo(g, sh, () => {
      fill(g, cc.robeD, [[j[0] + 3, -2], [j[0] + 14, -2], [ex + 18, ey], [ex + 18, h + 2], [ex + 4, h + 2], [ex + 3, ey * 0.6]], 1, seed + 1);
      fill(g, cc.robeL, [[j[0] - 11, 1], [j[0] - 3, 1], [ex - 5, ey * 0.7], [ex - 12, ey + 4], [ex - 12, ey * 0.5]], 1, seed + 2);
      fill(g, cc.robeD, [[ex - 18, h - 6], [ex, h - 9], [ex + 20, h - 6], [ex + 20, h + 2], [ex - 18, h + 2]], 0.8, seed + 3);   // 袖口暗部
      fold(g, [ex - 2, ey * 0.75], [ex - 8, h - 6], 2.4, cc.robeD, cc.robeL);
      fold(g, [ex + 6, ey * 0.9], [ex + 10, h - 6], 2.2, cc.robeD, cc.robeL);
    }, 0.4);
    fringe(g, hem, cc.robeD, r, 4);
    stroke(l, [[j[0] + 2, 10 * k], [ex + 4, ey * 0.7], [ex + 6, h - 10]], 1, BASE.inkS);
    stroke(l, [[ex - 4, ey * 0.6], [ex - 7, ey + 6], [ex - 6, h - 9]], 0.9, BASE.inkS);
  }, c);
}

function fore(seed: number, far: boolean) {
  const c = far ? FAR : BASE;
  const [w, h, j, gp] = far ? [26, 58, [15.2, 5.7], [11.5, 44.9]] : [24, 46, [12.5, 5.1], [11.1, 32.2]];
  return part(w, h, { joint: j as [number, number], grip: gp as [number, number] }, seed, ({ g, l, c: cc }) => {
    const wy = gp[1] - 8;
    // 前臂（缠布）
    const arm: P[] = [[j[0] - 6, 0], [j[0] + 6, 0], [gp[0] + 5.5, wy], [gp[0] - 4.5, wy]];
    fill(g, cc.cloth, arm, 0.4, seed, 0.3);
    clipTo(g, arm, () => { fill(g, cc.clothD, [[j[0] + 1, -1], [j[0] + 8, -1], [gp[0] + 7, wy + 1], [gp[0] + 1, wy + 1]], 0, seed); }, 0.3);
    for (let y = 4; y < wy - 2; y += 4.5) stroke(l, [[j[0] - 6 + (y / wy) * (gp[0] - j[0]) + 1, y + 2], [j[0] + 5 + (y / wy) * (gp[0] - j[0]), y - 1]], 0.8, BASE.inkS);
    // 拳
    const fist: P[] = [[gp[0] - 6.5, gp[1] - 6], [gp[0] + 4, gp[1] - 8], [gp[0] + 7, gp[1] - 1], [gp[0] + 5, gp[1] + 6], [gp[0] - 2, gp[1] + 7.5], [gp[0] - 7, gp[1] + 3]];
    fill(g, cc.skin, fist, 0.3, seed + 1, 0.55);
    clipTo(g, fist, () => { fill(g, cc.skinD, [[gp[0] + 1, gp[1] - 9], [gp[0] + 9, gp[1] - 2], [gp[0] + 6, gp[1] + 9], [gp[0] + 1, gp[1] + 4]], 0, seed); fill(g, cc.skinL, [[gp[0] - 7, gp[1] - 5], [gp[0] - 2, gp[1] - 6], [gp[0] - 4, gp[1] + 1]], 0, seed); }, 0.55);
    stroke(l, [[gp[0] - 5, gp[1] - 1], [gp[0] - 1, gp[1] + 1], [gp[0] + 3, gp[1]]], 0.9);
  }, c);
}

function thigh(seed: number, far: boolean) {
  const c = far ? FAR : BASE;
  const [w, h, j, kn] = far ? [52, 65, [22.8, 1.8], [28.9, 54.5]] : [46, 66, [21, 1.8], [24.9, 55]];
  return part(w, h, { joint: j as [number, number], knee: kn as [number, number] }, seed, ({ g, l, c: cc }) => {
    const sh: P[] = [[j[0] - 14, -1], [j[0] + 15, -1], [w - 2, 22], [kn[0] + 14, 46], [kn[0] + 12, h - 1], [kn[0] - 11, h], [kn[0] - 15, 46], [3, 20]];
    fill(g, cc.pants, sh, 0.6, seed, 0.45);
    clipTo(g, sh, () => {
      fill(g, cc.pantsD, [[j[0] + 6, -2], [w + 2, 18], [w + 2, h + 2], [kn[0] + 2, h + 2], [kn[0] + 4, 30]], 1, seed + 1);
      fill(g, cc.pantsL, [[j[0] - 12, 0], [j[0] - 3, 0], [kn[0] - 6, 34], [kn[0] - 12, 46], [4, 22]], 1, seed + 2);
    }, 0.45);
    stroke(l, [[j[0] - 6, 14], [kn[0] - 2, 34], [kn[0] + 6, 44]], 1, BASE.inkS);
    stroke(l, [[kn[0] - 8, 50], [kn[0] + 2, 56], [kn[0] + 10, 52]], 1, BASE.inkS);
  }, c);
}

function shin(seed: number, far: boolean) {
  const c = far ? FAR : BASE;
  const [w, h, j, an, so] = far ? [64, 103, [40.9, 14.5], [35.1, 80.4], [35.1, 100.8]] : [68, 102, [46.9, 15], [38.8, 78.5], [38.8, 98.8]];
  return part(w, h, { joint: j as [number, number], ankle: an as [number, number], sole: so as [number, number] }, seed, ({ g, l, r, c: cc }) => {
    // 裤管（收进绑腿）
    const cuff: P[] = [[j[0] - 15, 0], [j[0] + 14, 0], [j[0] + 14, 22], [j[0] + 9, 34], [j[0] - 11, 34], [j[0] - 15, 20]];
    fill(g, cc.pants, cuff, 0.6, seed, 0.45);
    clipTo(g, cuff, () => fill(g, cc.pantsD, [[j[0] + 2, -2], [j[0] + 16, -2], [j[0] + 14, 36], [j[0] + 2, 36]], 1, seed + 1), 0.45);
    // 绑腿：沿 膝→踝 的筒
    const top: P = [j[0] - 1, 28], bot: P = [an[0], an[1] + 2];
    const leg: P[] = [[top[0] - 13, top[1]], [top[0] + 12, top[1]], [bot[0] + 9.5, bot[1]], [bot[0] - 10, bot[1]]];
    fill(g, cc.wrap, leg, 0.4, seed + 2, 0.3);
    clipTo(g, leg, () => {
      fill(g, cc.wrapD, [[top[0] + 3, top[1] - 1], [top[0] + 12, top[1] - 1], [bot[0] + 10, bot[1] + 1], [bot[0] + 2, bot[1] + 1]], 0, seed);
      fill(g, cc.wrapL, [[top[0] - 11, top[1]], [top[0] - 5, top[1]], [bot[0] - 4, bot[1]], [bot[0] - 9, bot[1]]], 0, seed);
    }, 0.3);
    for (let i = 0; i < 8; i++) {   // 交叉缠绕的带子
      const t = (i + 0.5) / 8, x = top[0] + (bot[0] - top[0]) * t, y = top[1] + (bot[1] - top[1]) * t;
      stroke(l, [[x - 12, y + 4.5], [x + 12, y - 4.5]], 1.1, BASE.ink);
      if (i % 2) stroke(l, [[x - 12, y - 3.5], [x + 12, y + 3.5]], 0.8, BASE.inkS);
    }
    // 脚：草鞋 + 脚背
    const foot: P[] = [[an[0] - 7, an[1] + 2], [an[0] + 8, an[1] + 1], [an[0] + 11, so[1] - 6], [an[0] + 10, so[1] - 3], [an[0] - 28, so[1] - 3], [an[0] - 31, so[1] - 7], [an[0] - 22, so[1] - 11], [an[0] - 12, so[1] - 14]];
    fill(g, cc.skin, foot, 0.4, seed + 3, 0.45);
    clipTo(g, foot, () => { fill(g, cc.skinD, [[an[0] + 2, an[1]], [an[0] + 14, an[1]], [an[0] + 14, so[1]], [an[0] + 4, so[1]]], 0, seed); fill(g, cc.skinL, [[an[0] - 26, so[1] - 9], [an[0] - 12, so[1] - 14], [an[0] - 8, so[1] - 10], [an[0] - 22, so[1] - 6]], 0, seed); }, 0.45);
    waraji(g, l, an[0] - 33, an[0] + 12, so[1], r, cc, 5.5);
    // 草绳：脚尖套环 → 脚背交叉 → 绕踝两圈打结
    g.save(); g.strokeStyle = cc.sandalL; g.lineCap = 'round'; g.lineWidth = 1.8;
    for (const pts of [[[an[0] - 27, so[1] - 5], [an[0] - 20, so[1] - 11], [an[0] - 6, an[1] + 6]], [[an[0] - 12, so[1] - 5], [an[0] - 12, so[1] - 12], [an[0] + 6, an[1] + 5]], [[an[0] - 8, an[1] + 2], [an[0] + 2, an[1] + 5], [an[0] + 10, an[1] + 3]], [[an[0] - 8, an[1] + 6], [an[0] + 2, an[1] + 9], [an[0] + 10, an[1] + 7]]] as P[][]) { g.beginPath(); smoothOpen(g, pts); g.stroke(); }
    g.restore();
    stroke(l, [[an[0] - 27, so[1] - 5], [an[0] - 20, so[1] - 11], [an[0] - 6, an[1] + 6]], 0.6, BASE.inkS);
    stroke(l, [[an[0] - 8, an[1] + 6], [an[0] + 2, an[1] + 9], [an[0] + 10, an[1] + 7]], 0.6, BASE.inkS);
    g.fillStyle = cc.sandalD; g.beginPath(); g.ellipse(an[0] + 10, an[1] + 6, 2.2, 1.8, 0, 0, Math.PI * 2); g.fill();   // 绳结
    void r;
  }, c);
}

// —— 注册（名字 = rig 部件名） ——
const S0 = 9100;
const HERO: Record<string, (s: number) => GenOut> = {
  head, hat, torso, skirt, scarf,
  upperN: (s) => sleeve(s, false), upperF: (s) => sleeve(s, true),
  foreN: (s) => fore(s, false), foreF: (s) => fore(s, true),
  thighN: (s) => thigh(s, false), thighF: (s) => thigh(s, true),
  shinN: (s) => shin(s, false), shinF: (s) => shin(s, true),
};
Object.entries(HERO).forEach(([name, gen], i) => register({ name, kind: 'rig', group: 'hero', seed: S0 + i * 13, gen }));

// —— 正面 / 背面部件（与 rig.ts 的 drawFB 对应；斗笠沿用侧面那顶，圆锥从各方向看都一样） ——
const sym = (cx: number, half: P[]): P[] => half.concat(half.slice().reverse().map(([x, y]) => [2 * cx - x, y] as P));

function fHead(seed: number, back: boolean) {
  const [w, h, j, hj] = back ? [77, 117, [38, 52.6], [38, 18.7]] : [66, 120, [33, 62.6], [33, 25.6]];
  const cx = j[0];
  return part(w, h, { joint: j as [number, number], hatJoint: hj as [number, number] }, seed, ({ g, l, c }) => {
    const top = hj[1] - 4, chin = j[1] - 6;
    fill(g, c.skinD, [[cx - 6, chin - 8], [cx + 6, chin - 8], [cx + 7, j[1] + 10], [cx - 7, j[1] + 10]], 0);   // 颈
    if (!back) {
      const face = sym(cx, [[cx, top], [cx - 12, top + 3], [cx - 14.5, top + 16], [cx - 13, chin - 10], [cx - 8, chin - 2], [cx, chin + 1]]);
      fill(g, c.skin, face, 0, seed, 0.5);
      clipTo(g, face, () => {
        fill(g, c.skinD, [[cx + 3, top], [cx + 16, top], [cx + 16, chin + 2], [cx + 5, chin]], 0, seed);       // 右半背光
        fill(g, c.skinL, [[cx - 11, top + 18], [cx - 5, top + 17], [cx - 6, top + 25], [cx - 11, top + 23]], 0, seed);
        fill(g, 'rgba(52,28,18,0.82)', [[cx - 20, top - 2], [cx + 20, top - 2], [cx + 20, top + 16], [cx, top + 18], [cx - 20, top + 16]], 0);
      });
      fill(g, c.hair, [[cx - 15, top + 1], [cx - 11, top], [cx - 12, top + 22], [cx - 16, top + 18]], 0.5, seed + 1);
      fill(g, c.hair, [[cx + 15, top + 1], [cx + 11, top], [cx + 12, top + 22], [cx + 16, top + 18]], 0.5, seed + 2);
      stroke(l, [[cx - 9, top + 13], [cx - 4, top + 12.5]], 1.4);
      stroke(l, [[cx + 4, top + 12.5], [cx + 9, top + 13]], 1.4);
      stroke(l, [[cx - 1, top + 16], [cx - 2, top + 21], [cx + 1, top + 22]], 0.9, BASE.inkS);
      // 帽影里两点眼光 + 若有若无的嘴角
      g.fillStyle = 'rgba(255,214,150,0.85)';
      for (const ex of [cx - 6.2, cx + 6.2]) { g.beginPath(); g.ellipse(ex, top + 15, 1.2, 0.75, 0, 0, Math.PI * 2); g.fill(); }
      g.fillStyle = 'rgba(255,214,150,0.35)'; g.beginPath(); g.ellipse(cx + 6.2, top + 15, 1.0, 0.6, 0, 0, Math.PI * 2); g.fill();
      stroke(l, [[cx - 3.5, chin - 7], [cx, chin - 6.2], [cx + 3, chin - 7]], 0.8, 'rgba(40,22,14,0.45)');
    } else {
      const skull = sym(cx, [[cx, top - 1], [cx - 14, top + 3], [cx - 16, top + 18], [cx - 12, chin - 2], [cx, chin + 2]]);
      fill(g, c.hair, skull, 0.6, seed, 0.5);
      clipTo(g, skull, () => fill(g, '#2e2620', [[cx - 16, top], [cx - 4, top], [cx - 8, top + 20], [cx - 16, top + 22]], 0, seed));
      fill(g, c.hair, [[cx - 5, top + 12], [cx + 5, top + 12], [cx + 6, top + 22], [cx, top + 26], [cx - 6, top + 22]], 0.5, seed + 3);   // 发髻
      fill(g, c.band, [[cx - 6, top + 15], [cx + 6, top + 15], [cx + 6, top + 17.5], [cx - 6, top + 17.5]], 0);
      fill(g, c.skinD, [[cx - 17, top + 14], [cx - 14, top + 13], [cx - 14, top + 21], [cx - 17, top + 20]], 0.3, seed + 4);   // 耳
      fill(g, c.skinD, [[cx + 17, top + 14], [cx + 14, top + 13], [cx + 14, top + 21], [cx + 17, top + 20]], 0.3, seed + 5);
    }
    // 围巾缠颈（正面打结垂一缕；背面在后颈打结，飘带另由 b_scarf 画）
    const wrap = sym(cx, [[cx, chin - 4], [cx - 16, chin - 2], [cx - 20, chin + 8], [cx - 17, j[1] + 12], [cx, j[1] + 16]]);
    fill(g, c.scarf, wrap, 1, seed + 6);
    clipTo(g, wrap, () => {
      fill(g, c.scarfL, [[cx - 20, chin - 2], [cx - 4, chin - 3], [cx - 6, chin + 6], [cx - 20, chin + 8]], 0.6, seed + 7);
      fill(g, c.scarfD, [[cx + 4, chin + 6], [cx + 22, chin + 2], [cx + 22, j[1] + 20], [cx + 2, j[1] + 20]], 0.6, seed + 8);
    });
    stroke(l, [[cx - 17, chin + 6], [cx, chin + 9], [cx + 17, chin + 6]], 1.1);
    stroke(l, [[cx - 15, j[1] + 4], [cx, j[1] + 8], [cx + 15, j[1] + 4]], 1, BASE.inkS);
    if (!back) {
      g.fillStyle = c.scarf; taper(g, [[cx - 10, j[1] + 8], [cx - 13, j[1] + 26], [cx - 12, h - 14], [cx - 15, h - 3]], (t) => 6 - t * 3);
      g.fillStyle = c.scarfD; taper(g, [[cx - 7, j[1] + 10], [cx - 9, j[1] + 28], [cx - 9, h - 18]], (t) => 2.5 - t);
      g.fillStyle = c.scarf; taper(g, [[cx - 6, j[1] + 10], [cx - 4, j[1] + 24], [cx - 6, h - 20], [cx - 4, h - 10]], (t) => 3.6 - t * 2.4);
      g.save(); g.strokeStyle = c.scarf; g.lineWidth = 0.7; g.lineCap = 'round';
      for (const [x0, y0] of [[cx - 15, h - 3], [cx - 4, h - 10]] as P[]) for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(x0, y0 - 1); g.lineTo(x0 + (k - 1) * 1.6, y0 + 2.5 + k); g.stroke(); }
      g.restore();
    }
  });
}

function fTorso(seed: number, back: boolean) {
  const [w, h, j, nk, sL, sR] = back ? [87, 135, [43.3, 80.5], [42.8, 3.8], [13.6, 19.3], [72.9, 19.3]] : [94, 152, [45.5, 90.7], [46.8, 3.9], [17.9, 21.5], [77.1, 21.5]];
  const cx = j[0], wy = j[1];
  return part(w, h, { joint: j as [number, number], neck: nk as [number, number], shL: sL as [number, number], shR: sR as [number, number] }, seed, ({ g, l, c }) => {
    const body = sym(cx, [[cx, nk[1] - 2], [cx - 12, nk[1] - 1], [sL[0] - 6 + (cx - (sL[0] + sR[0]) / 2), sL[1] - 4], [sL[0] - 10 + (cx - (sL[0] + sR[0]) / 2), sL[1] + 12], [cx - 30, wy - 30], [cx - 31, wy + 6], [cx - 30, wy + 12], [cx, wy + 13]]);
    fill(g, c.robe, body, 0.7, seed, 0.4);
    clipTo(g, body, () => {
      fill(g, c.robeD, [[cx + 8, 0], [w + 2, 0], [w + 2, h + 2], [cx + 10, h + 2], [cx + 14, wy - 20]], 1.2, seed + 1);
      fill(g, c.robeL, [[cx - 34, sL[1] - 2], [cx - 18, sL[1] - 6], [cx - 16, wy - 34], [cx - 30, wy - 20]], 1, seed + 2);
      if (!back) {
        fill(g, c.inner, [[cx - 9, nk[1] - 2], [cx + 9, nk[1] - 2], [cx, nk[1] + 20]], 0, seed);
        g.fillStyle = c.trim; taper(g, [[cx - 11, nk[1]], [cx - 2, nk[1] + 22], [cx + 10, wy - 28], [cx + 20, wy - 10]], (t) => 3.6 - t);   // 交领（右衽）
        g.fillStyle = c.robeD; taper(g, [[cx + 11, nk[1]], [cx + 5, nk[1] + 14]], () => 2.2);
      } else {
        fill(g, c.robeD, [[cx - 3, nk[1] + 4], [cx + 3, nk[1] + 4], [cx + 2, wy - 12], [cx - 2, wy - 12]], 0.6, seed + 3);   // 背缝
      }
      fold(g, [cx - 24, wy - 14], [cx - 10, sL[1] + 30], 2.2, c.robeD, c.robeL);
      fold(g, [cx + 24, wy - 14], [cx + 12, sL[1] + 30], 2.2, c.robeD, c.robeL);
      fold(g, [cx - 6, wy - 14], [cx - 2, wy - 44], 1.6, c.robeD, c.robeL);
      fill(g, c.sash, [[cx - 40, wy - 12], [cx + 40, wy - 13], [cx + 40, wy + 4], [cx - 40, wy + 5]], 0.6, seed + 4);
      fill(g, c.sashL, [[cx - 40, wy - 12], [cx + 40, wy - 13], [cx + 40, wy - 8], [cx - 40, wy - 7]], 0, seed);
    }, 0.4);
    if (back) {   // 背后绳结 + 葫芦
      fill(g, c.sash, [[cx - 6, wy - 10], [cx + 6, wy - 10], [cx + 5, wy + 3], [cx - 5, wy + 3]], 0.5, seed + 5);
      g.fillStyle = c.sash; taper(g, [[cx - 2, wy + 2], [cx - 5, wy + 16], [cx - 4, wy + 26]], (t) => 2.6 - t);
      g.fillStyle = c.sash; taper(g, [[cx + 2, wy + 2], [cx + 6, wy + 14], [cx + 6, wy + 22]], (t) => 2.4 - t);
    }
    const gx = back ? cx - 26 : cx + 28;
    g.fillStyle = c.gourd; g.beginPath(); g.ellipse(gx, wy + 2, 5, 5.5, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(gx + 1, wy + 14, 8.5, 9, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = c.gourdD; g.beginPath(); g.ellipse(gx + 3.5, wy + 16, 6, 7, 0, -0.6, 2.2); g.fill();
    g.fillStyle = c.gourdL; g.beginPath(); g.ellipse(gx - 2, wy + 11, 2.6, 3.2, -0.5, 0, Math.PI * 2); g.fill();
    stroke(l, [[cx - 16, sL[1] + 14], [cx - 18, wy - 30], [cx - 15, wy - 14]], 1, BASE.inkS);
    stroke(l, [[cx + 18, sL[1] + 12], [cx + 20, wy - 30], [cx + 17, wy - 14]], 1.1);
  });
}

function fSkirt(seed: number, back: boolean) {
  const [w, h, j] = back ? [90, 112, [41.6, 3.7]] : [92, 112, [43, 3.3]];
  const cx = j[0];
  return part(w, h, { joint: j as [number, number] }, seed, ({ g, l, r, c }) => {
    const hem = tatter([cx + 46, h - 12], [cx - 46, h - 10], 17, 7, r);
    const sh: P[] = [[cx - 30, 0], [cx + 30, 0], [cx + 37, 40], [cx + 44, h - 14], ...hem, [cx - 44, h - 14], [cx - 37, 40]];
    fill(g, c.robe, sh, 0.5, seed, 0.35);
    clipTo(g, sh, () => {
      fill(g, c.robeD, [[cx + 10, 0], [w + 2, 0], [w + 2, h + 2], [cx + 14, h + 2]], 1, seed + 1);
      fill(g, c.robeD, [[-2, h - 26], [w + 2, h - 30], [w + 2, h + 2], [-2, h + 2]], 1.5, seed + 3);
      fill(g, c.robeL, [[cx - 30, 2], [cx - 18, 2], [cx - 22, 50], [cx - 36, 70], [cx - 36, 36]], 1, seed + 2);
      for (const [x0, x1, fw] of [[-22, -32, 3.4], [-8, -11, 3.8], [12, 16, 3.6], [24, 36, 3]]) fold(g, [cx + x0, 6], [cx + x1, h - 14], fw, c.robeD, c.robeL);
      wear(g, l, cx - 44, 0, cx + 44, h - 4, r, c);
      if (!back) fill(g, c.inner, [[cx - 2, 26], [cx + 3, 26], [cx + 8, h + 2], [cx - 6, h + 2]], 0.6, seed + 4);   // 前襟开衩
    }, 0.35);
    fringe(g, hem, c.robeD, r, 5);
    for (const [x0, x1] of [[-20, -26], [-6, -8], [14, 18], [26, 34]]) stroke(l, [[cx + x0, 6], [cx + (x0 + x1) / 2, 50], [cx + x1, h - 16]], 1, BASE.inkS);
  });
}

function fArm(seed: number, view: 'f' | 'b', side: 'L' | 'R') {
  const D: Record<string, [number, number, [number, number], [number, number]]> = {
    fL: [54, 115, [25.9, 4.4], [27, 106.5]], fR: [52, 117, [24.1, 4.5], [24, 108.5]],
    bL: [52, 117, [25.1, 4.4], [19.7, 108.5]], bR: [49, 117, [22.5, 4.5], [23.9, 108.5]],
  };
  const [w, h, j, hd] = D[view + side];
  const lit = side === 'L';   // 光从左上：左臂迎光
  return part(w, h, { joint: j, hand: hd }, seed, ({ g, l, r, c }) => {
    const cuffY = hd[1] - 30;
    // 前臂 + 拳（袖口下露出）
    const arm: P[] = [[hd[0] - 6, cuffY - 6], [hd[0] + 6, cuffY - 6], [hd[0] + 5.5, hd[1] - 6], [hd[0] - 5.5, hd[1] - 6]];
    fill(g, c.cloth, arm, 0.3, seed, 0.3);
    for (let y = cuffY; y < hd[1] - 8; y += 4.5) stroke(l, [[hd[0] - 5.5, y + 2], [hd[0] + 5.5, y - 1]], 0.8, BASE.inkS);
    const fist: P[] = [[hd[0] - 6.5, hd[1] - 7], [hd[0] + 6.5, hd[1] - 7], [hd[0] + 7, hd[1] + 2], [hd[0] + 3, hd[1] + 7], [hd[0] - 3, hd[1] + 7], [hd[0] - 7, hd[1] + 2]];
    fill(g, view === 'b' ? c.skinD : c.skin, fist, 0.3, seed + 1, 0.55);
    clipTo(g, fist, () => fill(g, lit ? c.skinL : c.skinD, lit ? [[hd[0] - 8, hd[1] - 8], [hd[0] - 1, hd[1] - 8], [hd[0] - 4, hd[1] + 2]] : [[hd[0] + 1, hd[1] - 8], [hd[0] + 8, hd[1] - 8], [hd[0] + 8, hd[1] + 8], [hd[0] + 2, hd[1] + 4]], 0), 0.55);
    if (view === 'f') stroke(l, [[hd[0] - 4, hd[1] + 1], [hd[0], hd[1] + 2.5], [hd[0] + 4, hd[1] + 1]], 0.9);
    // 宽袖
    const hem = tatter([hd[0] + 19, cuffY + 2], [hd[0] - 19, cuffY + 3], 7, 5, r);
    const sh: P[] = [[j[0] - 11, 0], [j[0] + 11, 0], [j[0] + 14, 40], [hd[0] + 19, cuffY - 8], ...hem, [hd[0] - 19, cuffY - 8], [j[0] - 14, 40]];
    fill(g, c.robe, sh, 0.5, seed + 2, 0.4);
    clipTo(g, sh, () => {
      if (lit) { fill(g, c.robeL, [[j[0] - 12, 1], [j[0] - 4, 1], [hd[0] - 8, cuffY - 14], [hd[0] - 20, cuffY - 6], [j[0] - 14, 40]], 1, seed + 3); fill(g, c.robeD, [[j[0] + 6, -2], [j[0] + 16, -2], [hd[0] + 22, cuffY + 6], [hd[0] + 8, cuffY + 6]], 1, seed + 4); }
      else fill(g, c.robeD, [[j[0] - 2, -2], [j[0] + 16, -2], [hd[0] + 22, cuffY + 6], [hd[0] - 6, cuffY + 6]], 1, seed + 4);
      fill(g, c.robeD, [[hd[0] - 22, cuffY - 6], [hd[0] + 22, cuffY - 8], [hd[0] + 22, cuffY + 8], [hd[0] - 22, cuffY + 8]], 0.8, seed + 5);
      fold(g, [hd[0] - 3, cuffY - 40], [hd[0] - 9, cuffY - 2], 2.6, c.robeD, c.robeL);
      fold(g, [hd[0] + 5, cuffY - 34], [hd[0] + 11, cuffY - 2], 2.2, c.robeD, c.robeL);
    }, 0.4);
    fringe(g, hem, c.robeD, r, 4);
    stroke(l, [[j[0], 12], [j[0] + (hd[0] - j[0]) * 0.6 + 2, cuffY * 0.6], [hd[0] + 4, cuffY - 6]], 1, BASE.inkS);
  });
}

function fLeg(seed: number, view: 'f' | 'b', side: 'L' | 'R') {
  const D: Record<string, [number, number, [number, number], [number, number]]> = {
    fL: [49, 154, [25.9, 3.8], [22.1, 151.7]], fR: [50, 155, [24.1, 3.8], [27.4, 152.7]],
    bL: [45, 153, [24.7, 4.1], [21.4, 150.4]], bR: [60, 154, [21.8, 4.1], [27.6, 151.4]],
  };
  const [w, h, j, so] = D[view + side];
  const lit = side === 'L';
  return part(w, h, { joint: j, sole: so }, seed, ({ g, l, r, c }) => {
    const kneeY = j[1] + (so[1] - j[1]) * 0.44, anY = so[1] - 16;
    // 裤腿（大腿段，rig 会伸缩）
    const pants: P[] = [[j[0] - 15, -1], [j[0] + 15, -1], [j[0] + 16, kneeY - 10], [so[0] + 13, kneeY + 14], [so[0] - 13, kneeY + 14], [j[0] - 16, kneeY - 10]];
    fill(g, c.pants, pants, 0.6, seed, 0.45);
    clipTo(g, pants, () => { fill(g, lit ? c.pantsL : c.pantsD, lit ? [[j[0] - 16, -2], [j[0] - 6, -2], [so[0] - 6, kneeY + 16], [so[0] - 15, kneeY + 16]] : [[j[0] + 4, -2], [j[0] + 18, -2], [so[0] + 15, kneeY + 16], [so[0] + 4, kneeY + 16]], 1, seed + 1); }, 0.45);
    stroke(l, [[j[0] - 4, 20], [j[0] - 2, kneeY - 10], [so[0] + 2, kneeY + 6]], 1, BASE.inkS);
    // 绑腿
    const top = kneeY + 8;
    const leg: P[] = [[so[0] - 12, top], [so[0] + 12, top], [so[0] + 9, anY], [so[0] - 9, anY]];
    fill(g, c.wrap, leg, 0.4, seed + 2, 0.3);
    clipTo(g, leg, () => fill(g, lit ? c.wrapL : c.wrapD, lit ? [[so[0] - 13, top], [so[0] - 6, top], [so[0] - 5, anY], [so[0] - 10, anY]] : [[so[0] + 3, top], [so[0] + 13, top], [so[0] + 10, anY], [so[0] + 2, anY]], 0), 0.3);
    for (let i = 0; i < 9; i++) { const y = top + 4 + (anY - top - 6) * i / 8, hw = 12 - 3 * i / 8; stroke(l, [[so[0] - hw, y + 3.5], [so[0] + hw, y - 3.5]], 1.1); if (i % 2) stroke(l, [[so[0] - hw, y - 2.5], [so[0] + hw, y + 2.5]], 0.8, BASE.inkS); }
    // 脚与草鞋：正面看到脚背和脚趾，背面看到脚跟
    if (view === 'f') {
      const foot: P[] = [[so[0] - 8, anY - 2], [so[0] + 8, anY - 2], [so[0] + 10, so[1] - 4], [so[0] + 7, so[1] - 1], [so[0] - 7, so[1] - 1], [so[0] - 10, so[1] - 4]];
      fill(g, c.skin, foot, 0.3, seed + 3, 0.5);
      waraji(g, l, so[0] - 11, so[0] + 11, so[1] + 1, r, c, 4.5);
      g.save(); g.strokeStyle = c.sandalL; g.lineWidth = 1.7; g.lineCap = 'round';
      for (const pts of [[[so[0] - 9, so[1] - 3], [so[0], so[1] - 9], [so[0] + 9, so[1] - 3]], [[so[0] - 8, anY + 1], [so[0], anY + 4], [so[0] + 8, anY + 1]], [[so[0], so[1] - 9], [so[0] - 1, anY + 4]]] as P[][]) { g.beginPath(); smoothOpen(g, pts); g.stroke(); }
      g.restore();
      stroke(l, [[so[0] - 9, so[1] - 3.5], [so[0], so[1] - 9.5], [so[0] + 9, so[1] - 3.5]], 0.6, BASE.inkS);
      for (const dx of [-5, -1.5, 2, 5.5]) stroke(l, [[so[0] + dx, so[1] - 3.5], [so[0] + dx, so[1] - 1.5]], 0.7, BASE.inkS);
    } else {
      const heel: P[] = [[so[0] - 8, anY - 2], [so[0] + 8, anY - 2], [so[0] + 9, so[1] - 4], [so[0] + 6, so[1] - 1], [so[0] - 6, so[1] - 1], [so[0] - 9, so[1] - 4]];
      fill(g, c.skinD, heel, 0.3, seed + 3, 0.5);
      waraji(g, l, so[0] - 9, so[0] + 9, so[1] + 1, r, c, 4.5);
      g.save(); g.strokeStyle = c.sandalL; g.lineWidth = 1.7; g.lineCap = 'round';
      for (const pts of [[[so[0] - 8, anY + 1], [so[0], anY + 4], [so[0] + 8, anY + 1]], [[so[0] - 8, anY + 5], [so[0], anY + 8], [so[0] + 8, anY + 5]]] as P[][]) { g.beginPath(); smoothOpen(g, pts); g.stroke(); }
      g.restore();
    }
  });
}

function bScarf(seed: number) {
  return part(69, 123, { joint: [11.2, 6.4] }, seed, ({ g, l, r, c }) => {
    fill(g, c.scarf, [[4, 0], [18, 0], [21, 9], [13, 14], [5, 11]], 0.5, seed + 1, 0.55);   // 结
    const S = (x0: number, y0: number, x1: number, y1: number, amp: number, ph: number, n = 7): P[] => {
      const o: P[] = []; for (let i = 0; i <= n; i++) { const t = i / n; o.push([x0 + (x1 - x0) * t + Math.sin(t * Math.PI * 1.7 + ph) * amp * t, y0 + (y1 - y0) * t]); } return o;
    };
    const tips: [P, string][] = [];
    const st = (pts: P[], w0: number, w1: number, col: string) => { g.fillStyle = col; taper(g, pts, (t) => w0 + (w1 - w0) * t); tips.push([pts[pts.length - 1], col]); };
    // 后（暗）带：两缕斜飘
    st(S(14, 8, 46, 96, 4, 0.6), 4.6, 1.2, c.scarfD);
    st(S(16, 10, 58, 84, 3, 1.8, 6), 3.2, 1, c.scarfD);
    // 主带：上段一整条，过半撕成三缕
    const main = S(11, 8, 17, 62, 2.5, 0.3, 6);
    g.fillStyle = c.scarf; taper(g, main, (t) => 7 + t * 2.5);
    const m = main[main.length - 1];
    for (const [dx, ex, ey, amp, ph, w] of [[-3, 10, 116, 3, 0.4, 3.4], [0, 20, 112, 4, 1.5, 3.8], [3, 30, 104, 3, 2.5, 3]] as number[][]) st(S(m[0] + dx, m[1] - 2, ex + (r() - 0.5) * 2, ey, amp, ph, 6), w, 0.9, c.scarf);
    g.save(); g.globalCompositeOperation = 'source-atop';
    g.fillStyle = c.scarfL; taper(g, [[9, 10], [11, 30], [14, 50]], (t) => 3 - t * 1.6);
    g.fillStyle = c.scarfD; taper(g, main.map(([x, y], i) => [x + 3 + i * 0.3, y] as P), (t) => 2.4 + t * 1.6);
    g.restore();
    g.save(); g.lineCap = 'round';
    for (const [[x, y], col] of tips) for (let k = 0; k < 3; k++) { g.strokeStyle = col; g.lineWidth = 0.7; g.beginPath(); g.moveTo(x, y - 1); g.quadraticCurveTo(x + (r() - 0.5) * 3, y + 2, x + (r() - 0.5) * 4, y + 3 + r() * 4); g.stroke(); }
    g.restore();
    stroke(l, [[13, 20], [17, 50], [20, 80]], 1, BASE.inkS);
    stroke(l, [[7, 6], [16, 5]], 1);
  });
}

const FB: Record<string, (s: number) => GenOut> = {
  f_head: (s) => fHead(s, false), b_head: (s) => fHead(s, true),
  f_torso: (s) => fTorso(s, false), b_torso: (s) => fTorso(s, true),
  f_skirt: (s) => fSkirt(s, false), b_skirt: (s) => fSkirt(s, true),
  f_armL: (s) => fArm(s, 'f', 'L'), f_armR: (s) => fArm(s, 'f', 'R'), b_armL: (s) => fArm(s, 'b', 'L'), b_armR: (s) => fArm(s, 'b', 'R'),
  f_legL: (s) => fLeg(s, 'f', 'L'), f_legR: (s) => fLeg(s, 'f', 'R'), b_legL: (s) => fLeg(s, 'b', 'L'), b_legR: (s) => fLeg(s, 'b', 'R'),
  b_scarf: bScarf,
};
Object.entries(FB).forEach(([name, gen], i) => register({ name, kind: 'rig', group: 'hero', seed: S0 + 500 + i * 17, gen }));
