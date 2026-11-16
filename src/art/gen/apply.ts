/**
 * 把生成结果（无论来自主线程、Worker 还是 IndexedDB 缓存）写进资源包。
 * 不引入任何生成器，主线程走 Worker 路径时只加载这一小块。
 */
import type { ArtPack } from '../pack';
import type { GenKind } from './registry';

export interface CodeArtItem {
  kind: GenKind; name: string; group: string;
  canvas: HTMLCanvasElement;
  pivot: [number, number];
  points?: Record<string, [number, number]>;
  meta?: Record<string, number>;
}

export interface CodeArtReport {
  ms: number; count: number; perAsset: Record<string, number>;
  /** 资产来源：main = 主线程现场生成；worker = Worker 现场生成；cache = IndexedDB 缓存 */
  source?: 'main' | 'worker' | 'cache';
  hash?: string;
  /** 分段耗时（ms）：worker 内生成 / 解码 / 写入资源包 */
  phases?: Record<string, number>;
}

/** 画布当作 HTMLImageElement 使用（部分代码读取 naturalWidth/Height） */
export function asImage(c: HTMLCanvasElement): HTMLImageElement {
  Object.defineProperty(c, 'naturalWidth', { get: () => c.width, configurable: true });
  Object.defineProperty(c, 'naturalHeight', { get: () => c.height, configurable: true });
  return c as unknown as HTMLImageElement;
}

type RigPack = ArtPack & { rig?: { ppu: number; parts: Record<string, Record<string, unknown>>; tools?: Record<string, { icon: string; handle: [number, number]; head: [number, number] }> }; fire?: Record<string, { center: number }> };

export function applyItems(pack: ArtPack, items: CodeArtItem[], groups: string[]) {
  const p = pack as RigPack;
  const heroFB = new Set<string>();
  for (const it of items) {
    const { canvas, pivot } = it;
    if (it.kind === 'sprite') {
      p.sprites[it.name] = { file: 'code:' + it.name, w: canvas.width, h: canvas.height, pivot };
      p.images.set(it.name, asImage(canvas));
      // 工具图标：骨骼动画按 handle / head 握持
      if (it.points?.handle && it.points?.head && p.rig?.tools) for (const t of Object.values(p.rig.tools)) if (t.icon === it.name) { t.handle = it.points.handle; t.head = it.points.head; }
      if (it.meta?.fireCenter !== undefined && p.fire) {
        const fk = it.name.replace(/_base$/, '');
        if (p.fire[fk]) p.fire[fk].center = it.meta.fireCenter;
      }
    } else {
      if (!p.rig) continue;
      const part: Record<string, unknown> = { file: 'code:rig_' + it.name, w: canvas.width, h: canvas.height };
      for (const [k, v] of Object.entries(it.points ?? {})) part[k] = v;
      p.rig.parts[it.name] = part;
      p.images.set('rig_' + it.name, asImage(canvas));
      if (/^[fb]_/.test(it.name)) heroFB.add(it.name);
    }
  }
  // 主角：未用代码生成的正/背面部件一律移除，避免画风混搭（退回侧面视图）
  if (groups.includes('hero') && p.rig) {
    for (const n of Object.keys(p.rig.parts)) if (/^[fb]_/.test(n) && !heroFB.has(n)) p.images.delete('rig_' + n);
  }
}
