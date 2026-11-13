// 精灵图集：运行时程序化生成全部素材，一次性打包成一张纹理
import * as THREE from 'three';
import type { Sprite } from './sprite';
import * as P from './props';
import * as S from './structures';
import * as CR from './creatures';
import { itemSprite, ICON_IDS } from './items';
import { ArtPack, packSprite } from './pack';

export interface Frame {
  u0: number; v0: number; u1: number; v1: number;
  w: number; h: number; foot: number;
}

const SIZE = 4096;
const PAD = 3;

export class Atlas {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  frames = new Map<string, Frame>();
  texture!: THREE.CanvasTexture;
  /** 手绘资源包（为 null 时全部为程序化素材） */
  pack: ArtPack | null = null;
  /** 来自资源包的帧键 */
  fromPack = new Set<string>();
  private iconURLs = new Map<string, string>();
  /** 物品图标（data URL），取自图集中 item_<id> 的区域 */
  iconURL(id: string): string | null {
    let u = this.iconURLs.get(id);
    if (u) return u;
    const r = this.rects.get('item_' + id);
    if (!r) return null;
    const c = document.createElement('canvas');
    c.width = r[2]; c.height = r[3];
    c.getContext('2d')!.drawImage(this.canvas, r[0], r[1], r[2], r[3], 0, 0, r[2], r[3]);
    u = c.toDataURL();
    this.iconURLs.set(id, u);
    return u;
  }
  private shelfX = PAD; private shelfY = PAD; private shelfH = 0;
  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = SIZE; this.canvas.height = SIZE;
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true })!;
  }
  add(name: string, s: Sprite) {
    const c = s.canvas;
    if (this.shelfX + c.width + PAD > SIZE) { this.shelfX = PAD; this.shelfY += this.shelfH + PAD; this.shelfH = 0; }
    if (this.shelfY + c.height > SIZE) throw new Error('atlas full');
    const x = this.shelfX, y = this.shelfY;
    this.ctx.drawImage(c, x, y);
    this.rects.set(name, [x, y, c.width, c.height]);
    this.shelfX += c.width + PAD;
    this.shelfH = Math.max(this.shelfH, c.height);
    // 纹理 flipY=false：v 自上而下
    this.frames.set(name, { u0: (x + 0.5) / SIZE, v0: (y + c.height - 0.5) / SIZE, u1: (x + c.width - 0.5) / SIZE, v1: (y + 0.5) / SIZE, w: s.w, h: s.h, foot: s.foot });
  }
  private masks = new Map<string, Uint8Array>();
  private rects = new Map<string, [number, number, number, number]>();
  /** 拾取用：素材局部坐标 (fx 0..1 左→右, fy 0..1 下→上) 处是否不透明 */
  solidAt(name: string, fx: number, fy: number): boolean {
    let m = this.masks.get(name);
    const M = 32;
    if (!m) {
      const r = this.rects.get(name);
      if (!r) return true;
      const [x, y, w, h] = r;
      const d = this.ctx.getImageData(x, y, w, h).data;
      m = new Uint8Array(M * M);
      for (let j = 0; j < M; j++) for (let i = 0; i < M; i++) {
        let a = 0;
        // 取格内若干采样点的最大 alpha，并略微膨胀，便于点中
        for (let sj = 0; sj < 3; sj++) for (let si = 0; si < 3; si++) {
          const px = Math.min(w - 1, Math.floor(((i + si / 3) / M) * w)), py = Math.min(h - 1, Math.floor(((j + sj / 3) / M) * h));
          a = Math.max(a, d[(py * w + px) * 4 + 3]);
        }
        m[j * M + i] = a > 60 ? 1 : 0;
      }
      this.masks.set(name, m);
    }
    if (fx < 0 || fx > 1 || fy < 0 || fy > 1) return false;
    const i = Math.min(M - 1, Math.floor(fx * M)), j = Math.min(M - 1, Math.floor((1 - fy) * M));
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      const ii = i + di, jj = j + dj;
      if (ii >= 0 && jj >= 0 && ii < M && jj < M && m[jj * M + ii]) return true;
    }
    return false;
  }
  get(name: string): Frame {
    const f = this.frames.get(name);
    if (!f) throw new Error('missing frame ' + name);
    return f;
  }
  finalize() {
    const t = new THREE.CanvasTexture(this.canvas);
    t.flipY = false;
    t.colorSpace = THREE.NoColorSpace;
    t.anisotropy = 4;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.magFilter = THREE.LinearFilter;
    t.generateMipmaps = true;
    t.premultiplyAlpha = false;
    this.texture = t;
  }
}

type Job = [string, () => Sprite];

export function atlasJobs(): Job[] {
  const j: Job[] = [];
  for (let i = 0; i < 4; i++) j.push([`pine${i}`, () => P.drawPine(100 + i * 7)]);
  for (let i = 0; i < 3; i++) j.push([`birch${i}`, () => P.drawBirch(200 + i * 13)]);
  for (let i = 0; i < 2; i++) j.push([`dead${i}`, () => P.drawDeadTree(300 + i * 5)]);
  j.push(['stump_pine', () => P.drawStump(1, 'pine')], ['stump_birch', () => P.drawStump(2, 'birch')], ['stump_dead', () => P.drawStump(3, 'dead')]);
  for (let i = 0; i < 2; i++) j.push([`boulder${i}`, () => P.drawBoulder(400 + i * 3)]);
  j.push(['bush', () => P.drawBerryBush(5, true)], ['bush_empty', () => P.drawBerryBush(5, false)]);
  j.push(['grass', () => P.drawGrassTuft(6, false)], ['grass_picked', () => P.drawGrassTuft(6, true)]);
  j.push(['sapling', () => P.drawSapling(7, false)], ['sapling_picked', () => P.drawSapling(7, true)]);
  for (let i = 0; i < 3; i++) j.push([`flower${i}`, () => P.drawFlower(10 + i, i)]);
  j.push(['carrot', () => P.drawCarrotPlant(8)]);
  j.push(['reeds', () => P.drawReeds(9, false)], ['reeds_picked', () => P.drawReeds(9, true)]);
  for (let i = 0; i < 2; i++) j.push([`fern${i}`, () => P.drawFern(20 + i)]);
  j.push(['mushroom', () => P.drawMushrooms(30)]);
  for (let i = 0; i < 2; i++) j.push([`pebbles${i}`, () => P.drawPebbles(40 + i)]);
  j.push(['bones', () => P.drawBones(50)]);
  for (let i = 0; i < 2; i++) j.push([`tuft${i}`, () => P.drawTuft(60 + i, false)]);
  j.push(['tuft_swamp', () => P.drawTuft(70, true)]);
  j.push(['flint_ground', () => P.drawFlintGround(80)]);
  j.push(['campfire', () => S.drawCampfire(1, false, false)], ['campfire_burnt', () => S.drawCampfire(1, false, true)]);
  j.push(['firepit', () => S.drawCampfire(2, true, false)], ['firepit_burnt', () => S.drawCampfire(2, true, true)]);
  for (let i = 0; i < 6; i++) j.push([`flame${i}`, () => S.drawFlame(i, 6)]);
  j.push(['bench', () => S.drawBench(1)], ['den0', () => S.drawDen(1, false)], ['den1', () => S.drawDen(2, true)]);
  for (const p of ['walk0', 'walk1', 'walk2', 'walk3', 'windup', 'bite', 'hurt', 'dead', 'sleep'] as CR.SpiderPose[]) j.push([`spider_${p}`, () => CR.drawSpider(p)]);
  for (const p of ['stand', 'peck', 'fly0', 'fly1'] as CR.CrowPose[]) j.push([`crow_${p}`, () => CR.drawCrow(p)]);
  j.push(['eyes1', () => CR.drawEyes(1)], ['eyes0', () => CR.drawEyes(0.35)]);
  for (const id of ICON_IDS) j.push([`item_${id}`, () => itemSprite(id)]);
  return j;
}

/** 分帧生成，避免卡死并汇报进度 */
export async function buildAtlas(onProgress: (p: number, label: string) => void, pack: ArtPack | null = null): Promise<Atlas> {
  const atlas = new Atlas();
  atlas.pack = pack;
  const jobs = atlasJobs();
  if (pack) {
    // 资源包优先：同名键改用手绘图，资源包独有的键（如噬影现身形态）追加
    for (let i = 0; i < jobs.length; i++) {
      const [name, proc] = jobs[i];
      jobs[i] = [name, () => { const s = packSprite(pack, name); if (s) { atlas.fromPack.add(name); return s; } return proc(); }];
    }
    const have = new Set(jobs.map((j) => j[0]));
    for (const name of Object.keys(pack.keys)) if (!have.has(name) && pack.images.has(pack.keys[name].src)) jobs.push([name, () => { atlas.fromPack.add(name); return packSprite(pack, name)!; }]);
  }
  // 先按高度排序打包更紧凑
  const sprites: [string, Sprite][] = [];
  let last = performance.now();
  for (let i = 0; i < jobs.length; i++) {
    sprites.push([jobs[i][0], jobs[i][1]()]);
    if (performance.now() - last > 30) {
      onProgress(i / jobs.length, jobs[i][0]);
      await new Promise((r) => requestAnimationFrame(() => r(null)));
      last = performance.now();
    }
  }
  sprites.sort((a, b) => b[1].canvas.height - a[1].canvas.height);
  for (const [n, s] of sprites) atlas.add(n, s);
  atlas.finalize();
  onProgress(1, '完成');
  return atlas;
}
