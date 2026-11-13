// 主角「行者」—— 手绘立绘版本（资源包），接口与程序化 PlayerArt 相同
// 每个动作一张关键姿势；行走为 待机/迈步 交替 + 上下起伏；另加呼吸、瑟缩、动作摆动等程序微动。
import type { PlayerPose } from './player';
import type { ArtPack } from './pack';

type PoseName = 'idle' | 'walk' | 'chop' | 'attack' | 'torch';

export class HeroArt {
  canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  /** 手部（火把）位置：世界单位，相对落脚点；x 为朝向前方 */
  hand = { x: 0.38, y: 1.6 };
  pad = 10;
  private imgs = new Map<PoseName, { img: HTMLImageElement; px: number; py: number }>();
  constructor(pack: ArtPack) {
    const W = 330, H = 372; // PLAYER_PPU=110 → 3.0 × 3.38 单位，留出斧头/火焰高举的空间
    this.canvas = document.createElement('canvas');
    this.canvas.width = W; this.canvas.height = H;
    this.ctx = this.canvas.getContext('2d')!;
    for (const [pose, src] of Object.entries(pack.hero)) {
      const img = pack.images.get(src), sp = pack.sprites[src];
      if (img && sp) this.imgs.set(pose as PoseName, { img, px: sp.pivot[0], py: sp.pivot[1] });
    }
  }
  static usable(pack: ArtPack | null): pack is ArtPack {
    return !!pack && ['idle', 'walk', 'chop', 'attack', 'torch'].every((k) => pack.hero?.[k] && pack.images.has(pack.hero[k]));
  }

  draw(p: PlayerPose) {
    const ctx = this.ctx, c = this.canvas;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, c.width, c.height);
    let pose: PoseName = 'idle';
    const a = p.action, at = p.actionT;
    const torch = p.held === 'torch' || p.held === 'lantern';
    if (!p.dead) {
      if (a === 'chop' || a === 'mine') pose = 'chop';
      else if (a === 'attack') pose = 'attack';
      else if (torch) pose = 'torch';
      else if (p.moving) pose = Math.sin(p.walk) > 0 ? 'walk' : 'idle';
    }
    const fr = this.imgs.get(pose) ?? this.imgs.get('idle')!;
    const { img, px, py } = fr;
    const w = img.naturalWidth, h = img.naturalHeight;
    ctx.translate(c.width / 2, c.height - this.pad);
    // 微动
    const breath = Math.sin(p.t * 2.2) * 0.008;
    const bob = p.moving ? -Math.abs(Math.cos(p.walk)) * 5 : 0;
    const shiver = p.shiver * Math.sin(p.t * 60) * 1.3;
    let rot = p.moving ? 0.035 : 0, sy = 1 + breath, sx = 1 - breath * 0.5, dy = bob;
    if (a === 'chop' || a === 'mine') {
      // 蓄力后仰 → 劈下前倾
      const k = at < 0.55 ? -at / 0.55 : (at - 0.55) / 0.45;
      rot = 0.1 * k; dy += Math.abs(k) * -2;
    } else if (a === 'attack') {
      rot = 0.12 * Math.sin(at * Math.PI);
    } else if (a === 'eat' || a === 'pickup' || a === 'craft') {
      const k = Math.sin(at * Math.PI);
      sy *= 1 - 0.07 * k; rot = 0.06 * k;
    } else if (a === 'hurt') {
      rot = -0.12 * Math.sin(at * Math.PI);
    }
    if (p.dead) {
      ctx.translate(0, -0.2 * 110);
      ctx.rotate(-Math.PI / 2 * 0.92);
      ctx.translate(0.25 * 110, 0);
    }
    ctx.translate(shiver, dy);
    // 立绘默认朝左；未翻转（朝右）时镜像
    if (!p.flip) ctx.scale(-1, 1);
    ctx.rotate(-rot);
    ctx.scale(sx, sy);
    ctx.drawImage(img, -px * w, -py * h);
  }
}
