import { makeCanvas, inkOutline, applyGrain, Ctx } from './ink';
import { RNG, mulberry32 } from '../util/rng';

export interface Sprite {
  canvas: HTMLCanvasElement;
  w: number;     // 世界宽（单位）
  h: number;     // 世界高
  foot: number;  // 画布底边到落脚点的世界距离
  ppu: number;
}

export interface SpriteOpts {
  outline?: number;
  grain?: number;
  seed?: number;
  ppu?: number;
  post?: (ctx: Ctx, r: RNG, u: number) => void; // 描边之后绘制（细丝等）
}

export const PPU = 80;

/**
 * 在“落脚点坐标系”下绘制：原点位于素材接地点，x 向右、y 向下（向上为负），单位为像素（u = 每世界单位像素数）
 */
export function sprite(wu: number, hu: number, draw: (ctx: Ctx, r: RNG, u: number) => void, o: SpriteOpts = {}): Sprite {
  const ppu = o.ppu ?? PPU;
  const outline = o.outline ?? 2.6;
  const pad = Math.ceil(outline * 2 + 3);
  const W = Math.ceil(wu * ppu) + pad * 2, H = Math.ceil(hu * ppu) + pad * 2;
  const [c, ctx] = makeCanvas(W, H);
  ctx.translate(W / 2, H - pad);
  draw(ctx, mulberry32(o.seed ?? 1), ppu);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  let out = c;
  if (outline > 0) out = inkOutline(c, outline, undefined, o.seed ?? 1);
  if (o.post) {
    const pc = out.getContext('2d')!;
    pc.save(); pc.translate(W / 2, H - pad);
    o.post(pc, mulberry32((o.seed ?? 1) + 999), ppu);
    pc.restore();
  }
  if ((o.grain ?? 0.22) > 0) applyGrain(out.getContext('2d')!, o.grain ?? 0.22);
  return { canvas: out, w: W / ppu, h: H / ppu, foot: pad / ppu, ppu };
}
