/**
 * 适配层（主线程同步版）：把代码生成的资产“伪装”成资源包条目，游戏其余代码零改动。
 * - sprite → pack.sprites[name] + pack.images[name]
 * - rig    → pack.images['rig_'+name] + pack.rig.parts[name]
 * - meta.fireCenter → pack.fire[fireKey].center
 * 游戏启动走 runtime.ts（Worker + IndexedDB 缓存）；这里是对照页和回退路径。
 */
import type { ArtPack } from '../pack';
import { listDefs } from './registry';
import { applyItems, CodeArtItem, CodeArtReport } from './apply';
import { CODE_NAMES } from './names';
import './assets';   // 注册全部生成器

export { asImage } from './apply';
export type { CodeArtReport } from './apply';
export { DEFAULT_GROUPS } from './names';
import { DEFAULT_GROUPS } from './names';

/** 在当前线程生成指定分组的全部资产 */
export function generateAll(groups = DEFAULT_GROUPS): { items: CodeArtItem[]; perAsset: Record<string, number> } {
  const items: CodeArtItem[] = [], perAsset: Record<string, number> = {};
  for (const d of listDefs()) {
    if (!groups.includes(d.group)) continue;
    const t = performance.now();
    const out = d.gen(d.seed);
    perAsset[d.kind + ':' + d.name] = +(performance.now() - t).toFixed(1);
    items.push({ kind: d.kind, name: d.name, group: d.group, canvas: out.canvas, pivot: out.pivot, points: out.points, meta: out.meta });
  }
  // 核对静态名单（主线程据此跳过 PNG）与注册表一致
  const want = new Set(groups.flatMap((g) => CODE_NAMES[g] ?? [])), got = new Set(items.map((i) => i.kind + ':' + i.name));
  const miss = [...want].filter((k) => !got.has(k)), extra = [...got].filter((k) => !want.has(k));
  if (miss.length || extra.length) console.warn('[烬野] names.ts 与注册表不一致', { miss, extra });
  return { items, perAsset };
}

/** 生成指定分组的代码资产并写入资源包（原地修改）。返回生成耗时。 */
export function applyCodeArt(pack: ArtPack, groups = DEFAULT_GROUPS): CodeArtReport {
  const t0 = performance.now();
  const { items, perAsset } = generateAll(groups);
  applyItems(pack, items, groups);
  return { ms: performance.now() - t0, count: items.length, perAsset, source: 'main' };
}
