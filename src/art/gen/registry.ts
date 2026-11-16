/**
 * 代码美术“资产工厂”注册表。
 * 每个资产 = 一个纯函数生成器：seed（+ 参数）→ 画布 + 枢轴 + 关节点/元数据。
 * 游戏按“名字”取资产，不关心来源（PNG / 代码）：适配层（pack-adapter.ts）
 * 把生成结果写进与 PNG 资源包相同的数据结构（sprites / images / rig.parts / fire）。
 */
import { canvas } from './wash';

export type GenKind = 'sprite' | 'rig';

export interface GenOut {
  canvas: HTMLCanvasElement;
  /** 枢轴（落脚点 / 关节）在画布中的比例位置 */
  pivot: [number, number];
  /** 关节等命名点（画布像素坐标），rig 部件必须含 joint */
  points?: Record<string, [number, number]>;
  /** 其他元数据，如火堆的火焰中心高度 fireCenter（0..1，自底向上） */
  meta?: Record<string, number>;
}

export interface AssetDef {
  /** 资产名：sprite 对应资源包的图片名（如 pine_old），rig 对应部件名（如 torso） */
  name: string;
  kind: GenKind;
  /** 分组：hero / pine / campfire ……，用于按组替换 */
  group: string;
  seed: number;
  gen: (seed: number) => GenOut;
}

const REG = new Map<string, AssetDef>();
const key = (kind: GenKind, name: string) => kind + ':' + name;

export function register(def: AssetDef) { REG.set(key(def.kind, def.name), def); }
export function getDef(kind: GenKind, name: string) { return REG.get(key(kind, name)); }
export function listDefs(group?: string): AssetDef[] { return [...REG.values()].filter((d) => !group || d.group === group); }
export function generate(kind: GenKind, name: string, seed?: number): GenOut {
  const d = REG.get(key(kind, name));
  if (!d) throw new Error('未注册的代码资产：' + key(kind, name));
  return d.gen(seed ?? d.seed);
}

/** 裁到不透明区域的包围盒（留 pad 像素），返回新画布与偏移 */
export function cropAlpha(c: HTMLCanvasElement, pad = 3): { canvas: HTMLCanvasElement; ox: number; oy: number } {
  const g = c.getContext('2d', { willReadFrequently: true })!;
  const { data } = g.getImageData(0, 0, c.width, c.height);
  let x0 = c.width, y0 = c.height, x1 = -1, y1 = -1;
  for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
    if (data[(y * c.width + x) * 4 + 3] > 4) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  if (x1 < 0) return { canvas: c, ox: 0, oy: 0 };
  x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(c.width - 1, x1 + pad); y1 = Math.min(c.height - 1, y1 + pad);
  const [o, og] = canvas(x1 - x0 + 1, y1 - y0 + 1);
  og.drawImage(c, -x0, -y0);
  return { canvas: o, ox: x0, oy: y0 };
}
