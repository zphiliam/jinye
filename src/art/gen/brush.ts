// 笔形：平滑闭合轮廓（带手抖）、渐细笔触。坐标为画布像素。
import { Noise2, valueNoise } from './noise';

export type P = [number, number];
type Ctx = CanvasRenderingContext2D;

/** Catmull-Rom → 贝塞尔，闭合 */
export function smoothClosed(g: Ctx | Path2D, pts: P[], tension = 0.5) {
  // 统一为顺时针：同一路径里多个子形状叠加时按 nonzero 规则求并，不会互相挖洞
  let area = 0;
  for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; area += a[0] * b[1] - b[0] * a[1]; }
  if (area < 0) pts = pts.slice().reverse();
  const n = pts.length;
  g.moveTo(pts[0][0], pts[0][1]);
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    const t = tension / 3;
    g.bezierCurveTo(p1[0] + (p2[0] - p0[0]) * t, p1[1] + (p2[1] - p0[1]) * t, p2[0] - (p3[0] - p1[0]) * t, p2[1] - (p3[1] - p1[1]) * t, p2[0], p2[1]);
  }
  g.closePath();
}
/** 开放曲线 */
export function smoothOpen(g: Ctx | Path2D, pts: P[], tension = 0.5) {
  const n = pts.length;
  g.moveTo(pts[0][0], pts[0][1]);
  for (let i = 0; i < n - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(n - 1, i + 2)];
    const t = tension / 3;
    g.bezierCurveTo(p1[0] + (p2[0] - p0[0]) * t, p1[1] + (p2[1] - p0[1]) * t, p2[0] - (p3[0] - p1[0]) * t, p2[1] - (p3[1] - p1[1]) * t, p2[0], p2[1]);
  }
}
/** 沿多边形边加密并按法线方向噪声位移（手绘的不规则边） */
export function wobble(pts: P[], amp: number, seed: number, step = 6, freq = 0.12, closed = true): P[] {
  const n: Noise2 = valueNoise(seed);
  const out: P[] = [];
  const m = closed ? pts.length : pts.length - 1;
  let acc = 0;
  for (let i = 0; i < m; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]), k = Math.max(1, Math.round(L / step));
    const nx = -(b[1] - a[1]) / (L || 1), ny = (b[0] - a[0]) / (L || 1);
    for (let j = 0; j < k; j++) {
      const t = j / k, d = (n(acc * freq, seed * 0.01) - 0.5) * 2 * amp;
      out.push([a[0] + (b[0] - a[0]) * t + nx * d, a[1] + (b[1] - a[1]) * t + ny * d]);
      acc += L / k;
    }
  }
  if (!closed) out.push(pts[pts.length - 1]);
  return out;
}
export function blob(g: Ctx, pts: P[], amp = 0, seed = 1, step = 6) {
  g.beginPath();
  smoothClosed(g, amp > 0 ? wobble(pts, amp, seed, step) : pts);
}
/** 椭圆形的点列（可做石头、果实等） */
export function ellipsePts(cx: number, cy: number, rx: number, ry: number, n = 14, rot = 0, jitter = 0, r?: () => number): P[] {
  const out: P[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2, j = 1 + (r ? (r() - 0.5) * 2 * jitter : 0);
    const x = Math.cos(a) * rx * j, y = Math.sin(a) * ry * j;
    out.push([cx + x * Math.cos(rot) - y * Math.sin(rot), cy + x * Math.sin(rot) + y * Math.cos(rot)]);
  }
  return out;
}
/** 渐细笔触：沿折线生成变宽多边形并填充；w(t) 给出 t∈[0,1] 处半宽 */
export function taper(g: Ctx, line: P[], w: (t: number) => number) {
  const L: P[] = [], R: P[] = [];
  for (let i = 0; i < line.length; i++) {
    const a = line[Math.max(0, i - 1)], b = line[Math.min(line.length - 1, i + 1)];
    const dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 1;
    const nx = -dy / d, ny = dx / d, hw = w(i / (line.length - 1));
    L.push([line[i][0] + nx * hw, line[i][1] + ny * hw]); R.push([line[i][0] - nx * hw, line[i][1] - ny * hw]);
  }
  g.beginPath();
  smoothClosed(g, L.concat(R.reverse()), 0.35);
  g.fill();
}
/** 二次贝塞尔采样成折线 */
export function quadPts(a: P, c: P, b: P, n = 12): P[] {
  const out: P[] = [];
  for (let i = 0; i <= n; i++) { const t = i / n, u = 1 - t; out.push([u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]]); }
  return out;
}
