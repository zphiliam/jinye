// 种子化噪声：值噪声 + fbm。纯 JS，无依赖。
export type Rand = () => number;

export function rng(seed: number): Rand {
  let a = (seed >>> 0) || 0x9e3779b9;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Noise2 { (x: number, y: number): number }

/** 值噪声（0..1），格点哈希 + 平滑插值 */
export function valueNoise(seed: number): Noise2 {
  const N = 256, perm = new Uint8Array(N * 2), val = new Float32Array(N);
  const r = rng(seed);
  for (let i = 0; i < N; i++) { perm[i] = i; val[i] = r(); }
  for (let i = N - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [perm[i], perm[j]] = [perm[j], perm[i]]; }
  for (let i = 0; i < N; i++) perm[N + i] = perm[i];
  const h = (x: number, y: number) => val[perm[(perm[x & 255] + y) & 511]];
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = h(xi, yi), b = h(xi + 1, yi), c = h(xi, yi + 1), d = h(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
}

export function fbm(seed: number, oct = 4): Noise2 {
  const ns = Array.from({ length: oct }, (_, i) => valueNoise(seed + i * 101));
  return (x, y) => {
    let s = 0, a = 0.5, f = 1, n = 0;
    for (let i = 0; i < oct; i++) { s += ns[i](x * f, y * f) * a; n += a; a *= 0.5; f *= 2.03; }
    return s / n;
  };
}
