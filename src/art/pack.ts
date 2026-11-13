// 美术资源包：public/art/ 下的手绘精灵（透明 PNG）+ manifest.json
// 加载失败时返回 null，游戏退回到全程序化素材。
import type { Sprite } from './sprite';

export interface PackSprite { file: string; w: number; h: number; pivot: [number, number] }
export interface PackKey { src: string; spec: ['h' | 'w' | 'fit', number]; mirror: boolean }
export interface ArtPack {
  heroPPU: number;
  sprites: Record<string, PackSprite>;
  keys: Record<string, PackKey>;
  hero: Record<string, string>;
  images: Map<string, HTMLImageElement>;
}

export async function loadArtPack(base = 'art/', onProgress?: (p: number, label: string) => void): Promise<ArtPack | null> {
  try {
    const res = await fetch(base + 'manifest.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error('manifest ' + res.status);
    const m = await res.json() as Omit<ArtPack, 'images'>;
    const names = Object.keys(m.sprites);
    const images = new Map<string, HTMLImageElement>();
    let done = 0;
    await Promise.all(names.map(async (n) => {
      const img = new Image();
      img.src = base + m.sprites[n].file;
      await img.decode();
      images.set(n, img);
      onProgress?.(++done / names.length, n);
    }));
    return { ...m, images };
  } catch (e) {
    console.warn('[烬野] 美术资源包加载失败，改用程序化素材：', e);
    return null;
  }
}

const PAD = 3;

/** 把资源包里的一张图按 manifest 规格转成标准 Sprite（枢轴对齐到画布水平中心、底部留白=落脚点） */
export function packSprite(pack: ArtPack, key: string): Sprite | null {
  const k = pack.keys[key];
  if (!k) return null;
  const sp = pack.sprites[k.src], img = pack.images.get(k.src);
  if (!sp || !img) return null;
  const w = img.naturalWidth, h = img.naturalHeight;
  const [kind, val] = k.spec;
  const pxRaw = sp.pivot[0] * w, footPx = (1 - sp.pivot[1]) * h;
  const ppu = kind === 'h' ? (h - footPx) / val : kind === 'w' ? w / val : Math.max(w, h) / val;
  const half = Math.ceil(Math.max(pxRaw, w - pxRaw)) + 1;
  const W = half * 2 + PAD * 2, H = h + PAD * 2;
  if (kind === 'fit') {
    // 图标：居中放进正方形
    const S = Math.max(w, h), C = document.createElement('canvas');
    C.width = S + PAD * 2; C.height = S + PAD * 2;
    const cx = C.getContext('2d')!;
    cx.drawImage(img, PAD + (S - w) / 2, PAD + (S - h) / 2);
    return { canvas: C, w: C.width / ppu, h: C.height / ppu, foot: PAD / ppu, ppu };
  }
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d')!;
  // 镜像时整体水平翻转画布；由于槽位关于枢轴对称，枢轴仍落在 W/2
  if (k.mirror) { ctx.translate(W, 0); ctx.scale(-1, 1); }
  ctx.drawImage(img, PAD + half - pxRaw, PAD);
  return { canvas: c, w: W / ppu, h: H / ppu, foot: (PAD + footPx) / ppu, ppu };
}
