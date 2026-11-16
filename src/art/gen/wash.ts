/**
 * 水墨晕染合成器（风格核心）。
 * 生成器只画“剪影 + 少量平涂色块”，这里统一加：
 *   墨边晕开（轮廓外不规则的墨晕）、湿边积色（边缘颜料沉积变深）、
 *   体积暗部（背光侧整块压暗）、轮廓光（迎光侧细亮边）、颜料浓淡、纸纹颗粒。
 * 所有素材走同一套参数，风格自然统一。
 */
import { fbm, valueNoise } from './noise';

export type RGB = [number, number, number];

export interface WashOpts {
  seed: number;
  light?: [number, number];   // 指向光源的单位向量（画布坐标，y 向下），默认左上
  ink?: RGB;                  // 墨色
  bleed?: number;             // 墨晕半径（像素）
  inkAmt?: number;            // 墨边浓度 0..1
  edge?: number;              // 湿边积色强度
  edgeR?: number;             // 湿边宽度（像素）
  form?: number;              // 体积暗部强度
  formR?: number;             // 体积尺度（像素）
  rim?: RGB;                  // 轮廓光颜色
  rimAmt?: number;
  rimW?: number;              // 轮廓光宽（像素）
  pigment?: number;           // 颜料浓淡幅度
  pigScale?: number;          // 颜料斑块尺度（像素）
  grain?: number;             // 纸纹颗粒
  lines?: HTMLCanvasElement;  // 合成后叠加的墨线层（同尺寸）
}

/**
 * 画布工厂：主线程用 <canvas>，Worker 里用 OffscreenCanvas（两者 2D API 相同，这里统一按 HTMLCanvasElement 类型使用）。
 */
export function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const W = Math.max(1, Math.ceil(w)), H = Math.max(1, Math.ceil(h));
  const c = (typeof document !== 'undefined' ? Object.assign(document.createElement('canvas'), { width: W, height: H }) : new OffscreenCanvas(W, H)) as unknown as HTMLCanvasElement;
  return [c, c.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D];
}

/** 三次盒式模糊 ≈ 高斯 */
export function blur(src: Float32Array, W: number, H: number, r: number): Float32Array {
  let a = Float32Array.from(src), b = new Float32Array(src.length);
  const rr = Math.max(1, Math.round(r / 1.7));
  for (let pass = 0; pass < 3; pass++) {
    // 横
    for (let y = 0; y < H; y++) {
      const o = y * W; let s = 0;
      for (let x = -rr; x <= rr; x++) s += a[o + Math.min(W - 1, Math.max(0, x))];
      for (let x = 0; x < W; x++) {
        b[o + x] = s / (2 * rr + 1);
        s += a[o + Math.min(W - 1, x + rr + 1)] - a[o + Math.max(0, x - rr)];
      }
    }
    // 竖
    for (let x = 0; x < W; x++) {
      let s = 0;
      for (let y = -rr; y <= rr; y++) s += b[Math.min(H - 1, Math.max(0, y)) * W + x];
      for (let y = 0; y < H; y++) {
        a[y * W + x] = s / (2 * rr + 1);
        s += b[Math.min(H - 1, y + rr + 1) * W + x] - b[Math.max(0, y - rr) * W + x];
      }
    }
  }
  return a;
}

function sample(f: Float32Array, W: number, H: number, x: number, y: number) {
  if (x < 0 || y < 0 || x > W - 1 || y > H - 1) return 0;
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const x1 = Math.min(W - 1, xi + 1), y1 = Math.min(H - 1, yi + 1);
  const a = f[yi * W + xi], b = f[yi * W + x1], c = f[y1 * W + xi], d = f[y1 * W + x1];
  return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
}
const ss = (e0: number, e1: number, x: number) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };

export const DEFAULT: Required<Omit<WashOpts, 'lines' | 'seed'>> = {
  light: [-0.55, -0.83], ink: [27, 19, 15], bleed: 2.2, inkAmt: 0.85,
  edge: 0.28, edgeR: 3.5, form: 0.34, formR: 14, rim: [255, 214, 160], rimAmt: 0.22, rimW: 2.2,
  pigment: 0.09, pigScale: 22, grain: 0.07,
};

export function wash(src: HTMLCanvasElement, opts: WashOpts): HTMLCanvasElement {
  const o = { ...DEFAULT, ...opts };
  const W = src.width, H = src.height;
  const sctx = src.getContext('2d', { willReadFrequently: true })!;
  const img = sctx.getImageData(0, 0, W, H), d = img.data;
  const A = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) A[i] = d[i * 4 + 3] / 255;
  const Bs = blur(A, W, H, o.edgeR), Bf = blur(A, W, H, o.formR), Bo = blur(A, W, H, o.bleed);
  const pig = fbm(o.seed * 7 + 3, 4), fine = valueNoise(o.seed * 13 + 5), fib = valueNoise(o.seed * 17 + 9);
  const [lx, ly] = o.light, fo = o.formR * 0.9, rw = o.rimW;
  const out = new ImageData(W, H), q = out.data;
  const [ir, ig, ib] = o.ink, [rr, rg, rb] = o.rim;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, a = A[i], bo = Bo[i];
    if (a < 0.004 && bo < 0.02) continue;
    const n1 = pig(x / o.pigScale, y / o.pigScale);
    const nb = fine(x / 3.1, y / 3.1);
    let R = 0, G = 0, B = 0;
    if (a > 0.004) {
      R = d[i * 4]; G = d[i * 4 + 1]; B = d[i * 4 + 2];
      // 颜料浓淡
      let k = 1 + (n1 - 0.5) * 2 * o.pigment;
      // 湿边积色
      const e = ss(0.05, 0.55, 1 - Bs[i]);
      k *= 1 - o.edge * e * (0.55 + 0.9 * n1);
      // 体积：背光侧压暗、迎光侧微亮
      const sh = 1 - sample(Bf, W, H, x - lx * fo, y - ly * fo);
      const lit = 1 - sample(Bf, W, H, x + lx * fo, y + ly * fo);
      k *= (1 - o.form * ss(0.08, 0.75, sh)) * (1 + o.form * 0.35 * ss(0.1, 0.8, lit));
      // 纸纹
      const g = 1 + (nb - 0.5) * o.grain + (fib(x / 1.3, y / 7) - 0.5) * o.grain * 0.7;
      k *= g;
      R *= k; G *= k; B *= k;
      // 轮廓光
      const rimv = a * (1 - sample(A, W, H, x + lx * rw, y + ly * rw)) * o.rimAmt * (0.7 + 0.6 * nb);
      R += (rr - R) * rimv; G += (rg - G) * rimv; B += (rb - B) * rimv;
      // 内侧墨边（不均匀）
      const band = ss(0.97, 0.6, bo) * o.inkAmt * (0.6 + 0.7 * nb);
      R += (ir - R) * band; G += (ig - G) * band; B += (ib - B) * band;
    }
    // 外侧墨晕：阈值被噪声扰动 → 墨迹不规则地渗出
    const thr = 0.1 + 0.22 * fine(x / 5.3 + 40, y / 5.3);
    const h = ss(thr, thr + 0.28, bo) * o.inkAmt * (1 - a);
    const ao = a + h * (1 - a);
    if (ao < 0.003) continue;
    const ca = a / ao, ch = 1 - ca;
    q[i * 4] = R * ca + ir * ch; q[i * 4 + 1] = G * ca + ig * ch; q[i * 4 + 2] = B * ca + ib * ch;
    q[i * 4 + 3] = Math.min(255, ao * 255);
  }
  const [c, ctx] = canvas(W, H);
  ctx.putImageData(out, 0, 0);
  if (opts.lines) {
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';   // 墨线不越出剪影
    ctx.filter = 'blur(0.45px)';
    ctx.drawImage(opts.lines, 0, 0);
    ctx.restore();
  }
  return c;
}
