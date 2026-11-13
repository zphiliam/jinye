// 程序化世界：海岛轮廓、四种生物群系、起伏、土径、资源有意图地分布
import { mulberry32, fbm, vnoise, RNG, range, clamp, smooth } from '../util/rng';

export const enum Biome { Forest = 0, Clearing = 1, Rocky = 2, Swamp = 3 }
export const BIOME_NAMES = ['密林', '空地', '页岩地', '沼泽'];

export const WORLD = 520;
export const HALF = WORLD / 2;
export const GRID = 512;
const CELL = WORLD / GRID;

export type SpawnKind =
  | 'pine' | 'birch' | 'dead' | 'sapling' | 'grass' | 'bush' | 'flower' | 'carrot' | 'boulder' | 'flint'
  | 'reeds' | 'mushroom' | 'den' | 'fern' | 'pebbles' | 'bones' | 'tuft' | 'tuft_swamp';

export interface Spawn { kind: SpawnKind; x: number; z: number; v: number }

interface Region { x: number; z: number; b: Biome }

export class World {
  seed: number;
  biome = new Uint8Array(GRID * GRID);
  weights = new Uint8Array(GRID * GRID * 4);
  extra = new Uint8Array(GRID * GRID * 4); // R 土径 G 湿度 B 崖边
  heights = new Float32Array((GRID + 1) * (GRID + 1));
  regions: Region[] = [];
  spawns: Spawn[] = [];
  pathCanvas!: HTMLCanvasElement;
  rng: RNG;

  constructor(seed: number) {
    this.seed = seed;
    this.rng = mulberry32(seed);
    this.genRegions();
    this.genBiomes();
    this.genPaths();
    this.genHeights();
    this.genSpawns();
  }

  islandR(x: number, z: number): number {
    const a = Math.atan2(z, x);
    return 222 + (fbm(Math.cos(a) * 2 + 10, Math.sin(a) * 2 + 10, this.seed + 5, 4) - 0.5) * 70;
  }
  edge(x: number, z: number): number { return Math.hypot(x, z) - this.islandR(x, z); }
  inside(x: number, z: number, margin = 3): boolean { return this.edge(x, z) < -margin; }

  private warp(x: number, z: number): [number, number] {
    const s = this.seed;
    return [x + (fbm(x * 0.012, z * 0.012, s + 1, 3) - 0.5) * 60, z + (fbm(x * 0.012 + 40, z * 0.012 + 40, s + 2, 3) - 0.5) * 60];
  }

  private genRegions() {
    const r = this.rng;
    const pts: Region[] = [{ x: 0, z: 0, b: Biome.Clearing }];
    let tries = 0;
    while (pts.length < 78 && tries++ < 5000) {
      const x = range(r, -HALF, HALF), z = range(r, -HALF, HALF);
      if (!this.inside(x, z, -10)) continue;
      if (pts.some((p) => Math.hypot(p.x - x, p.z - z) < 38)) continue;
      const d = Math.hypot(x, z);
      const a = fbm(x * 0.006, z * 0.006, this.seed + 9, 3), b = fbm(x * 0.006 + 99, z * 0.006 + 99, this.seed + 19, 3);
      let bio: Biome = Biome.Forest;
      if (d < 50) bio = r() < 0.65 ? Biome.Forest : Biome.Clearing;
      else if (a > 0.57) bio = Biome.Rocky;
      else if (b > 0.62) bio = Biome.Swamp;
      else if (a < 0.36 || r() < 0.1) bio = Biome.Clearing;
      pts.push({ x, z, b: bio });
    }
    // 保证每种群系至少出现若干块
    const ensure = (b: Biome, n: number) => {
      let have = pts.filter((p) => p.b === b).length;
      const cands = pts.slice(1).filter((p) => p.b === Biome.Forest && Math.hypot(p.x, p.z) > 80).sort(() => r() - 0.5);
      while (have < n && cands.length) { cands.pop()!.b = b; have++; }
    };
    ensure(Biome.Rocky, 7); ensure(Biome.Swamp, 7); ensure(Biome.Clearing, 7);
    // 出生点旁边至少一片林子
    const near = pts.slice(1).sort((p, q) => Math.hypot(p.x, p.z) - Math.hypot(q.x, q.z));
    if (near[0]) near[0].b = Biome.Forest;
    if (near[1]) near[1].b = Biome.Forest;
    if (near[2]) near[2].b = Biome.Forest;
    this.regions = pts;
  }

  private genBiomes() {
    const R = this.regions;
    for (let gy = 0; gy < GRID; gy++) for (let gx = 0; gx < GRID; gx++) {
      const x = -HALF + (gx + 0.5) * CELL, z = -HALF + (gy + 0.5) * CELL;
      const [wx, wz] = this.warp(x, z);
      let d1 = 1e9, d2 = 1e9, b1 = 0, b2 = 0;
      for (const p of R) {
        const d = (p.x - wx) ** 2 + (p.z - wz) ** 2;
        if (d < d1) { d2 = d1; b2 = b1; d1 = d; b1 = p.b; }
        else if (d < d2 && p.b !== b1) { d2 = d; b2 = p.b; }
      }
      const i = gy * GRID + gx;
      this.biome[i] = b1;
      const gap = Math.sqrt(d2) - Math.sqrt(d1);
      const w = 0.5 + 0.5 * smooth(0, 10, gap);
      const o = i * 4;
      this.weights[o] = this.weights[o + 1] = this.weights[o + 2] = this.weights[o + 3] = 0;
      this.weights[o + b1] += Math.round(w * 255);
      if (b2 !== b1) this.weights[o + b2] += Math.round((1 - w) * 255);
      else this.weights[o + b1] = 255;
      const e = this.edge(x, z);
      this.extra[o + 2] = Math.round(clamp((e + 14) / 14) * 255);
      this.extra[o + 1] = Math.round(clamp(fbm(x * 0.05, z * 0.05, this.seed + 33, 3) * (b1 === Biome.Swamp ? 1.4 : 0.5)) * 255);
      this.extra[o + 3] = 255;
    }
  }

  private genPaths() {
    const c = document.createElement('canvas');
    c.width = GRID; c.height = GRID;
    const ctx = c.getContext('2d')!;
    const R = this.regions.filter((p) => p.b !== Biome.Swamp || this.rng() < 0.4);
    // 最小生成树
    const inT = new Set<number>([0]);
    const edges: [number, number][] = [];
    while (inT.size < R.length) {
      let best = 1e9, bi = -1, bj = -1;
      for (const i of inT) for (let j = 0; j < R.length; j++) {
        if (inT.has(j)) continue;
        const d = Math.hypot(R[i].x - R[j].x, R[i].z - R[j].z);
        if (d < best) { best = d; bi = i; bj = j; }
      }
      if (bj < 0) break;
      inT.add(bj); edges.push([bi, bj]);
    }
    const toPx = (v: number) => ((v + HALF) / WORLD) * GRID;
    ctx.strokeStyle = '#fff';
    ctx.lineCap = 'round';
    ctx.shadowColor = '#fff';
    ctx.shadowBlur = 3;
    for (const [i, j] of edges) {
      if (this.rng() < 0.25 && i !== 0) continue; // 不是每条都有路
      const a = R[i], b = R[j];
      const n = 12;
      ctx.lineWidth = range(this.rng, 1.4, 2.2);
      ctx.beginPath();
      for (let k = 0; k <= n; k++) {
        const t = k / n;
        let x = a.x + (b.x - a.x) * t, z = a.z + (b.z - a.z) * t;
        const off = (vnoise(x * 0.03, z * 0.03, this.seed + 77) - 0.5) * 24 * Math.sin(t * Math.PI);
        const L = Math.hypot(b.x - a.x, b.z - a.z) || 1;
        x += (-(b.z - a.z) / L) * off; z += ((b.x - a.x) / L) * off;
        if (k === 0) ctx.moveTo(toPx(x), toPx(z)); else ctx.lineTo(toPx(x), toPx(z));
      }
      ctx.stroke();
    }
    const img = ctx.getImageData(0, 0, GRID, GRID).data;
    for (let i = 0; i < GRID * GRID; i++) this.extra[i * 4] = img[i * 4 + 3];
    this.pathCanvas = c;
  }

  private genHeights() {
    const N = GRID + 1;
    for (let gy = 0; gy < N; gy++) for (let gx = 0; gx < N; gx++) {
      const x = -HALF + gx * CELL, z = -HALF + gy * CELL;
      const b = this.biomeAtGrid(Math.min(GRID - 1, gx), Math.min(GRID - 1, gy));
      const wi = (Math.min(GRID - 1, gy) * GRID + Math.min(GRID - 1, gx)) * 4;
      const rock = this.weights[wi + 2] / 255, swamp = this.weights[wi + 3] / 255;
      let h = (fbm(x * 0.02, z * 0.02, this.seed + 3, 4) - 0.5) * 2.2;
      h += rock * (fbm(x * 0.06, z * 0.06, this.seed + 4, 3)) * 2.4;
      h -= swamp * 0.5;
      h *= 1 - this.extra[wi] / 255 * 0.5;
      void b;
      const e = this.edge(x, z);
      if (e > -6) h = h * (1 - smooth(-6, 0, e)) - smooth(-4, 4, e) * 9;
      this.heights[gy * N + gx] = h;
    }
  }

  biomeAtGrid(gx: number, gy: number): Biome { return this.biome[gy * GRID + gx] as Biome; }
  biomeAt(x: number, z: number): Biome {
    const gx = clamp(Math.floor((x + HALF) / CELL), 0, GRID - 1), gy = clamp(Math.floor((z + HALF) / CELL), 0, GRID - 1);
    return this.biome[gy * GRID + gx] as Biome;
  }
  pathAt(x: number, z: number): number {
    const gx = clamp(Math.floor((x + HALF) / CELL), 0, GRID - 1), gy = clamp(Math.floor((z + HALF) / CELL), 0, GRID - 1);
    return this.extra[(gy * GRID + gx) * 4] / 255;
  }
  height(x: number, z: number): number {
    const N = GRID + 1;
    const fx = clamp((x + HALF) / CELL, 0, GRID - 0.001), fz = clamp((z + HALF) / CELL, 0, GRID - 0.001);
    const ix = Math.floor(fx), iz = Math.floor(fz), tx = fx - ix, tz = fz - iz;
    const h00 = this.heights[iz * N + ix], h10 = this.heights[iz * N + ix + 1], h01 = this.heights[(iz + 1) * N + ix], h11 = this.heights[(iz + 1) * N + ix + 1];
    return (h00 * (1 - tx) + h10 * tx) * (1 - tz) + (h01 * (1 - tx) + h11 * tx) * tz;
  }

  private genSpawns() {
    const r = mulberry32(this.seed + 1000);
    const S = this.spawns;
    // 占位网格：防止重叠
    const OCC = 2; // 每格 0.5 单位
    const occ = new Uint8Array(WORLD * OCC * WORLD * OCC);
    const occIdx = (x: number, z: number) => Math.floor((z + HALF) * OCC) * WORLD * OCC + Math.floor((x + HALF) * OCC);
    const free = (x: number, z: number, rad: number) => {
      for (let dz = -rad; dz <= rad; dz += 0.5) for (let dx = -rad; dx <= rad; dx += 0.5) {
        if (dx * dx + dz * dz > rad * rad) continue;
        const i = occIdx(x + dx, z + dz);
        if (i < 0 || i >= occ.length || occ[i]) return false;
      }
      return true;
    };
    const mark = (x: number, z: number, rad: number) => {
      for (let dz = -rad; dz <= rad; dz += 0.5) for (let dx = -rad; dx <= rad; dx += 0.5) {
        if (dx * dx + dz * dz > rad * rad) continue;
        const i = occIdx(x + dx, z + dz);
        if (i >= 0 && i < occ.length) occ[i] = 1;
      }
    };
    const put = (kind: SpawnKind, x: number, z: number, rad: number, v = 0, force = false) => {
      if (!this.inside(x, z, 4)) return false;
      if (!force && !free(x, z, rad)) return false;
      if (rad > 0.3) mark(x, z, rad);
      S.push({ kind, x, z, v });
      return true;
    };
    // 出生点：清出一块空地，周围放好基础资源（不贫瘠，也不白给）
    mark(0, 0, 3.5);
    const ring = (kind: SpawnKind, n: number, r0: number, r1: number, rad: number) => {
      let k = 0, t = 0;
      while (k < n && t++ < 300) {
        const a = r() * Math.PI * 2, d = range(r, r0, r1);
        if (put(kind, Math.cos(a) * d, Math.sin(a) * d, rad, Math.floor(r() * 4))) k++;
      }
    };
    ring('grass', 5, 5, 14, 0.6);
    ring('sapling', 4, 5, 15, 0.6);
    ring('flint', 3, 4, 12, 0.4);
    ring('bush', 3, 8, 18, 0.8);
    ring('flower', 5, 4, 16, 0.4);
    ring('carrot', 2, 6, 16, 0.4);
    ring('pine', 6, 14, 24, 1.4);
    ring('boulder', 1, 18, 30, 1.6);

    // 群系密度表（每 100 平方单位的期望数量）
    type D = [SpawnKind, number, number]; // 种类, 密度, 占位半径
    const T: Record<number, D[]> = {
      [Biome.Forest]: [['pine', 6.0, 1.25], ['birch', 0.6, 1.25], ['sapling', 0.6, 0.6], ['grass', 0.2, 0.6], ['bush', 0.1, 0.8], ['mushroom', 0.25, 0.4], ['flint', 0.06, 0.4], ['boulder', 0.025, 1.6], ['fern', 2.2, 0.3], ['flower', 0.06, 0.4], ['tuft', 1.2, 0]],
      [Biome.Clearing]: [['grass', 1.1, 0.6], ['sapling', 0.4, 0.6], ['bush', 0.34, 0.8], ['flower', 0.7, 0.4], ['carrot', 0.16, 0.4], ['birch', 0.18, 1.3], ['flint', 0.18, 0.4], ['boulder', 0.03, 1.6], ['tuft', 3.5, 0], ['pine', 0.1, 1.3]],
      [Biome.Rocky]: [['boulder', 0.55, 1.6], ['flint', 0.5, 0.4], ['pebbles', 1.6, 0], ['bones', 0.035, 1.0], ['grass', 0.14, 0.6], ['dead', 0.06, 1.2], ['sapling', 0.08, 0.6]],
      [Biome.Swamp]: [['dead', 0.5, 1.2], ['reeds', 0.85, 0.6], ['tuft_swamp', 2.6, 0], ['mushroom', 0.14, 0.4], ['grass', 0.12, 0.6], ['flower', 0.05, 0.4], ['bush', 0.03, 0.8]],
    };
    const STEP = 1.6;
    for (let z = -HALF + 2; z < HALF - 2; z += STEP) for (let x = -HALF + 2; x < HALF - 2; x += STEP) {
      const px = x + (r() - 0.5) * STEP, pz = z + (r() - 0.5) * STEP;
      if (Math.hypot(px, pz) < 18) continue;
      if (!this.inside(px, pz, 5)) continue;
      const path = this.pathAt(px, pz);
      const b = this.biomeAt(px, pz);
      // 树林疏密由低频噪声控制：林间空隙与密丛
      const grove = smooth(0.3, 0.62, fbm(px * 0.04, pz * 0.04, this.seed + 50, 3));
      for (const [kind, dens, rad] of T[b]) {
        let p = (dens * STEP * STEP) / 100;
        if (kind === 'pine' || kind === 'dead') p *= 0.25 + grove * 1.5;
        if (kind === 'fern') p *= 0.4 + (1 - grove);
        if (path > 0.3 && rad > 0) p *= 0.1;
        if (r() < p) { put(kind, px, pz, rad, Math.floor(r() * 4)); break; }
      }
    }
    // 蛛巢：离出生点足够远，多在林缘、沼泽与页岩地
    let dens = 0, t = 0;
    while (dens < 14 && t++ < 4000) {
      const x = range(r, -HALF, HALF), z = range(r, -HALF, HALF);
      const d = Math.hypot(x, z);
      if (d < 62) continue;
      const b = this.biomeAt(x, z);
      if (b === Biome.Clearing && r() < 0.8) continue;
      if (S.some((s) => s.kind === 'den' && Math.hypot(s.x - x, s.z - z) < 45)) continue;
      if (put('den', x, z, 2.2, d > 140 ? 1 : 0)) dens++;
    }
  }

  /** 生成小地图用的底图 */
  mapCanvas(size = 256): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d')!;
    const img = ctx.createImageData(size, size);
    const cols = [[52, 66, 44], [126, 114, 64], [112, 106, 92], [40, 52, 46]];
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const gx = Math.floor((x / size) * GRID), gy = Math.floor((y / size) * GRID);
      const i = gy * GRID + gx, o = (y * size + x) * 4;
      const wx = -HALF + (gx + 0.5) * CELL, wz = -HALF + (gy + 0.5) * CELL;
      const c0 = cols[this.biome[i]];
      const path = this.extra[i * 4] / 255;
      const inside = this.edge(wx, wz) < 0;
      const k = inside ? 1 : 0;
      img.data[o] = inside ? c0[0] * (1 - path * 0.3) + 150 * path * 0.3 : 20;
      img.data[o + 1] = inside ? c0[1] * (1 - path * 0.3) + 120 * path * 0.3 : 18;
      img.data[o + 2] = inside ? c0[2] * (1 - path * 0.3) + 80 * path * 0.3 : 16;
      img.data[o + 3] = 255 * (k * 0.9 + 0.1);
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }
}
