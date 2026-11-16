/// <reference lib="webworker" />
/**
 * 代码美术 Worker：在 OffscreenCanvas 上生成全部资产，不占主线程。
 * 结果按“生成器版本哈希”缓存在 IndexedDB（每项一张 PNG Blob + 枢轴/关节元数据）：
 * - 热启动：读缓存 → createImageBitmap 解码 → 转交主线程
 * - 冷启动：现场生成 → 先把位图转交主线程（不等编码）→ 再后台编码 PNG 写入缓存
 * 生成器代码一改，哈希就变，旧缓存自动作废并清理。
 */
import { generateAll } from './pack-adapter';
import type { GenKind } from './registry';

export interface WorkerReq { groups: string[]; hash: string; useCache: boolean }
export interface WorkerItem { kind: GenKind; name: string; group: string; bitmap: ImageBitmap; pivot: [number, number]; points?: Record<string, [number, number]>; meta?: Record<string, number> }
export type WorkerRes =
  | { type: 'items'; source: 'cache' | 'worker'; items: WorkerItem[]; perAsset: Record<string, number>; phases: Record<string, number> }
  | { type: 'stored'; ms: number; bytes: number }
  | { type: 'error'; message: string };

interface Rec { kind: GenKind; name: string; group: string; blob: Blob; pivot: [number, number]; points?: Record<string, [number, number]>; meta?: Record<string, number> }

const DB = 'jinye-codeart', STORE = 'packs';
function openDB(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const q = indexedDB.open(DB, 1);
    q.onupgradeneeded = () => q.result.createObjectStore(STORE);
    q.onsuccess = () => res(q.result);
    q.onerror = () => rej(q.error);
  });
}
function idbGet<T>(db: IDBDatabase, key: string): Promise<T | undefined> {
  return new Promise((res, rej) => { const q = db.transaction(STORE).objectStore(STORE).get(key); q.onsuccess = () => res(q.result as T); q.onerror = () => rej(q.error); });
}
function idbPutReplace(db: IDBDatabase, key: string, val: unknown): Promise<void> {
  return new Promise((res, rej) => {
    const tx = db.transaction(STORE, 'readwrite'), st = tx.objectStore(STORE);
    st.clear();   // 只保留当前版本，旧哈希一并清掉
    st.put(val, key);
    tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error);
  });
}

const ctx = self as unknown as DedicatedWorkerGlobalScope;
ctx.onmessage = async (e: MessageEvent<WorkerReq>) => {
  const { groups, hash, useCache } = e.data;
  const key = hash + '|' + groups.slice().sort().join(',');
  try {
    let db: IDBDatabase | null = null;
    try { db = await openDB(); } catch { db = null; }
    if (db && useCache) {
      const t0 = performance.now();
      const recs = await idbGet<Rec[]>(db, key);
      const tRead = performance.now();
      if (recs && recs.length) {
        const bitmaps = await Promise.all(recs.map((r) => createImageBitmap(r.blob)));
        const items: WorkerItem[] = recs.map((r, i) => ({ kind: r.kind, name: r.name, group: r.group, bitmap: bitmaps[i], pivot: r.pivot, points: r.points, meta: r.meta }));
        const msg: WorkerRes = { type: 'items', source: 'cache', items, perAsset: {}, phases: { idbRead: tRead - t0, decode: performance.now() - tRead } };
        ctx.postMessage(msg, bitmaps);
        return;
      }
    }
    const t0 = performance.now();
    const { items: gen, perAsset } = generateAll(groups);
    const tGen = performance.now();
    const canvases = gen.map((g) => g.canvas as unknown as OffscreenCanvas);
    const bitmaps = await Promise.all(canvases.map((c) => createImageBitmap(c)));
    const items: WorkerItem[] = gen.map((g, i) => ({ kind: g.kind, name: g.name, group: g.group, bitmap: bitmaps[i], pivot: g.pivot, points: g.points, meta: g.meta }));
    const msg: WorkerRes = { type: 'items', source: 'worker', items, perAsset, phases: { generate: tGen - t0, bitmap: performance.now() - tGen } };
    ctx.postMessage(msg, bitmaps);
    // 后台写缓存：编码 PNG（无损，保证与现场生成逐像素一致）
    if (db) {
      const t1 = performance.now();
      const blobs = await Promise.all(canvases.map((c) => c.convertToBlob({ type: 'image/png' })));
      const recs: Rec[] = gen.map((g, i) => ({ kind: g.kind, name: g.name, group: g.group, blob: blobs[i], pivot: g.pivot, points: g.points, meta: g.meta }));
      await idbPutReplace(db, key, recs);
      const done: WorkerRes = { type: 'stored', ms: performance.now() - t1, bytes: blobs.reduce((s, b) => s + b.size, 0) };
      ctx.postMessage(done);
    }
  } catch (err) {
    const msg: WorkerRes = { type: 'error', message: String((err as Error)?.stack || err) };
    ctx.postMessage(msg);
  }
};
