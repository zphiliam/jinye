/**
 * 游戏启动时加载代码美术：优先 Worker（OffscreenCanvas）+ IndexedDB 缓存，
 * 浏览器不支持或 Worker 出错时回退到主线程同步生成。
 */
import type { ArtPack } from '../pack';
import { applyItems, CodeArtItem, CodeArtReport, asImage } from './apply';
import type { WorkerReq, WorkerRes } from './worker';
import { CODEART_HASH } from 'virtual:codeart-hash';

export { DEFAULT_GROUPS } from './names';
import { DEFAULT_GROUPS } from './names';
export { CODEART_HASH };

export interface LoadOpts { groups?: string[]; useCache?: boolean; worker?: boolean; onStored?: (ms: number, bytes: number) => void }

function bitmapToCanvas(b: ImageBitmap): HTMLCanvasElement {
  const c = document.createElement('canvas'); c.width = b.width; c.height = b.height;
  c.getContext('2d')!.drawImage(b, 0, 0); b.close();
  return asImage(c) as unknown as HTMLCanvasElement;
}

async function viaMain(pack: ArtPack, groups: string[]): Promise<CodeArtReport> {
  const { applyCodeArt } = await import('./pack-adapter');
  return applyCodeArt(pack, groups);
}

export async function loadCodeArt(pack: ArtPack, opts: LoadOpts = {}): Promise<CodeArtReport> {
  const groups = opts.groups ?? DEFAULT_GROUPS;
  const t0 = performance.now();
  const canWorker = opts.worker !== false && typeof Worker !== 'undefined' && typeof OffscreenCanvas !== 'undefined' && typeof createImageBitmap !== 'undefined';
  if (!canWorker) return { ...(await viaMain(pack, groups)), hash: CODEART_HASH };
  try {
    const w = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    const res = await new Promise<Extract<WorkerRes, { type: 'items' }>>((resolve, reject) => {
      w.onmessage = (e: MessageEvent<WorkerRes>) => {
        const m = e.data;
        if (m.type === 'items') resolve(m);
        else if (m.type === 'stored') { opts.onStored?.(m.ms, m.bytes); w.terminate(); }
        else if (m.type === 'error') { reject(new Error(m.message)); w.terminate(); }
      };
      w.onerror = (ev) => { reject(new Error(ev.message || 'worker error')); w.terminate(); };
      const req: WorkerReq = { groups, hash: CODEART_HASH, useCache: opts.useCache !== false };
      w.postMessage(req);
    });
    if (res.source === 'cache') w.terminate();
    const tRecv = performance.now();
    const items: CodeArtItem[] = res.items.map((it) => ({ kind: it.kind, name: it.name, group: it.group, canvas: bitmapToCanvas(it.bitmap), pivot: it.pivot, points: it.points, meta: it.meta }));
    applyItems(pack, items, groups);
    const tEnd = performance.now();
    return { ms: tEnd - t0, count: items.length, perAsset: res.perAsset, source: res.source, hash: CODEART_HASH, phases: { ...res.phases, workerTotal: tRecv - t0, apply: tEnd - tRecv } };
  } catch (err) {
    console.warn('[烬野] 代码美术 Worker 失败，回退主线程：', err);
    return { ...(await viaMain(pack, groups)), hash: CODEART_HASH };
  }
}
