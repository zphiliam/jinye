// 营火、火焰、研机台、蛛巢
import { PAL, Pt, brush, blobPath, smoothPath, hatch, gouges, rimLight, shadeFill, contactShadow, polyPath, mix, rgba } from './ink';
import { sprite, Sprite } from './sprite';
import { RNG, range } from '../util/rng';

function stone(ctx: CanvasRenderingContext2D, r: RNG, x: number, y: number, s: number) {
  const p = blobPath(x, y - s * 0.45, s, s * 0.62, 0.22, r, 12);
  shadeFill(ctx, p, x - s, y - s, x + s * 0.5, y, [[0, PAL.shaleLight], [0.6, PAL.shale], [1, PAL.shaleDeep]]);
  hatch(ctx, p, { x: x - s, y: y - s, w: s * 2, h: s * 1.2 }, { r, gap: 2.6, w: 1.1, alpha: 0.6, mask: (px, py) => (px - x + (py - y + s * 0.4) > s * 0.2 ? 1 : 0) });
  rimLight(ctx, p, 3, 3, PAL.paper, 0.5);
  brush(ctx, [[x - s * 0.8, y - s * 0.1], [x + s * 0.8, y]], 1.6, PAL.ink, { alpha: 0.5 });
}

function logPiece(ctx: CanvasRenderingContext2D, r: RNG, x0: number, y0: number, x1: number, y1: number, w: number, charred: number) {
  const a = Math.atan2(y1 - y0, x1 - x0), nx = -Math.sin(a) * w, ny = Math.cos(a) * w;
  const body = polyPath([[x0 + nx, y0 + ny], [x1 + nx, y1 + ny], [x1 - nx, y1 - ny], [x0 - nx, y0 - ny]], true);
  shadeFill(ctx, body, x0 - nx, y0 - ny, x0 + nx, y0 + ny, [[0, mix(PAL.barkLight, PAL.ink, charred * 0.6)], [1, mix(PAL.barkDeep, PAL.ink, charred)]]);
  gouges(ctx, body, { r, count: 10, area: (rr) => { const t = rr(); return [x0 + (x1 - x0) * t, y0 + (y1 - y0) * t - w * 0.3]; }, len: [6, 14], w: [1, 2], angle: () => a, color: charred > 0.5 ? PAL.emberDeep : PAL.ochreLight, alpha: 0.6 });
  ctx.fillStyle = PAL.ochreLight;
  ctx.beginPath(); ctx.ellipse(x1, y1, w * 0.45, w, a, 0, 6.28); ctx.fill();
  ctx.strokeStyle = PAL.ochreDeep; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.ellipse(x1, y1, w * 0.25, w * 0.55, a, 0, 6.28); ctx.stroke();
}

export function drawCampfire(seed: number, pit: boolean, burnt: boolean): Sprite {
  return sprite(pit ? 2.4 : 2.0, 1.1, (ctx, r, u) => {
    contactShadow(ctx, 0, 0, (pit ? 1.1 : 0.9) * u, 0.28 * u, 0.6);
    // 灰烬床
    const ash = blobPath(0, -0.06 * u, (pit ? 0.7 : 0.55) * u, 0.16 * u, 0.2, r);
    ctx.fillStyle = burnt ? PAL.shaleDeep : PAL.ink2; ctx.fill(ash);
    gouges(ctx, ash, { r, count: 18, area: (rr) => [range(rr, -0.5, 0.5) * u, -0.06 * u + range(rr, -0.1, 0.1) * u], len: [3, 7], w: [1.5, 2.5], angle: (_x, _y, rr) => rr() * 6, color: burnt ? PAL.shaleLight : PAL.emberDeep, alpha: 0.7, curve: 1 });
    const ringR = (pit ? 0.92 : 0.72) * u;
    const n = pit ? 11 : 8;
    // 后排石块
    const stones: [number, number, number][] = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + 0.2;
      stones.push([Math.cos(a) * ringR, Math.sin(a) * ringR * 0.3 - 0.02 * u, (pit ? 0.2 : 0.16) * u * range(r, 0.85, 1.15)]);
    }
    stones.sort((a, b) => a[1] - b[1]);
    const back = stones.filter((s) => s[1] < -0.02 * u), front = stones.filter((s) => s[1] >= -0.02 * u);
    for (const [x, y, s] of back) stone(ctx, r, x, y, s);
    // 柴堆
    const ch = burnt ? 0.9 : 0.4;
    logPiece(ctx, r, -0.5 * u, -0.02 * u, 0.15 * u, -0.42 * u, 0.07 * u, ch);
    logPiece(ctx, r, 0.5 * u, 0.0, -0.12 * u, -0.45 * u, 0.07 * u, ch);
    logPiece(ctx, r, -0.1 * u, 0.04 * u, 0.05 * u, -0.5 * u, 0.065 * u, ch);
    if (!burnt) {
      const glow = blobPath(0, -0.1 * u, 0.3 * u, 0.08 * u, 0.3, r);
      ctx.fillStyle = PAL.ember; ctx.fill(glow);
    }
    for (const [x, y, s] of front) stone(ctx, r, x, y, s);
  }, { seed, outline: 2.2 });
}

/** 火焰帧（自发光层） */
export function drawFlame(frame: number, frames: number): Sprite {
  return sprite(1.3, 2.0, (ctx, r, u) => {
    const ph = (frame / frames) * Math.PI * 2;
    const layer = (scale: number, col0: string, col1: string, sway: number, k: number) => {
      const H = (1.45 + Math.sin(ph * 2 + k) * 0.12) * u * scale, W = 0.46 * u * scale;
      const pts: Pt[] = [];
      pts.push([-W, -0.05 * u]);
      const tongues = 3;
      for (let i = 0; i < tongues; i++) {
        const t = (i + 0.5) / tongues;
        const x = -W + t * 2 * W;
        const th = H * (0.6 + 0.4 * Math.sin(ph + i * 2.1 + k) ** 2) * (i === 1 ? 1 : 0.72);
        pts.push([x - W * 0.25 + Math.sin(ph + i) * sway * u, -th * 0.45]);
        pts.push([x + Math.sin(ph * 1.5 + i * 1.7 + k) * sway * u * 2.2, -th]);
        pts.push([x + W * 0.25 + Math.sin(ph + i) * sway * u, -th * 0.45]);
      }
      pts.push([W, -0.05 * u]);
      pts.push([W * 0.5, 0.04 * u], [-W * 0.5, 0.04 * u]);
      const p = smoothPath(pts, true);
      shadeFill(ctx, p, 0, 0, 0, -H, [[0, col0], [1, col1]]);
      return p;
    };
    void r;
    const outer = layer(1, PAL.emberDeep, PAL.blood, 0.1, 0);
    // 外焰内刻纹
    gouges(ctx, outer, { r, count: 10, area: (rr) => [range(rr, -0.35, 0.35) * u, -range(rr, 0.2, 1.1) * u], len: [8, 18], w: [2, 3.5], angle: () => -Math.PI / 2 + Math.sin(ph) * 0.3, color: PAL.ember, alpha: 0.8 });
    layer(0.72, PAL.ember, PAL.emberDeep, 0.08, 1.3);
    layer(0.42, PAL.emberHot, PAL.ember, 0.05, 2.6);
  }, { outline: 0, grain: 0.12 });
}

export function drawBench(seed: number): Sprite {
  return sprite(2.6, 2.8, (ctx, r, u) => {
    contactShadow(ctx, 0, 0, 1.2 * u, 0.3 * u, 0.55);
    // 桌腿
    for (const [x, w] of [[-0.85, 0.09], [0.85, 0.09], [-0.55, 0.07], [0.6, 0.07]] as [number, number][]) {
      const y0 = x > 0 === (w < 0.08) ? -0.05 : 0;
      brush(ctx, [[x * u, y0 * u], [x * 0.96 * u, -0.95 * u]], w * u * 2, w < 0.08 ? PAL.barkDeep : PAL.bark, { taper: [1, 1], jitter: 0.1 });
    }
    // 横撑
    brush(ctx, [[-0.85 * u, -0.35 * u], [0.85 * u, -0.38 * u]], 0.08 * u, PAL.barkDeep, { taper: [1, 1] });
    // 桌面
    const top = polyPath([[-1.1 * u, -0.95 * u], [1.1 * u, -0.98 * u], [1.0 * u, -1.18 * u], [-0.98 * u, -1.15 * u]], true);
    shadeFill(ctx, top, 0, -1.18 * u, 0, -0.95 * u, [[0, PAL.barkLight], [1, PAL.bark]]);
    gouges(ctx, top, { r, count: 22, area: (rr) => [range(rr, -1, 1) * u, -range(rr, 0.98, 1.14) * u], len: [10, 26], w: [1, 2], angle: () => 0, color: PAL.ochreLight, alpha: 0.5 });
    const front = polyPath([[-1.1 * u, -0.95 * u], [1.1 * u, -0.98 * u], [1.1 * u, -0.88 * u], [-1.1 * u, -0.85 * u]], true);
    ctx.fillStyle = PAL.barkDeep; ctx.fill(front);
    // 卷轴
    const scroll = smoothPath([[-0.95 * u, -1.1 * u], [-0.35 * u, -1.12 * u], [-0.33 * u, -1.2 * u], [-0.94 * u, -1.18 * u]], true);
    ctx.fillStyle = PAL.paper; ctx.fill(scroll);
    for (let i = 0; i < 4; i++) brush(ctx, [[-0.88 * u + i * 9, -1.17 * u], [-0.86 * u + i * 9, -1.13 * u]], 1.2, PAL.ink, {});
    brush(ctx, [[-0.98 * u, -1.09 * u], [-0.98 * u, -1.21 * u]], 6, PAL.blood, { taper: [1, 1] });
    // 墨壶
    const pot = blobPath(-0.18 * u, -1.22 * u, 0.1 * u, 0.09 * u, 0.1, r);
    ctx.fillStyle = PAL.ink2; ctx.fill(pot); rimLight(ctx, pot, 3, 2, PAL.copperLight, 0.8);
    brush(ctx, [[-0.2 * u, -1.28 * u], [-0.05 * u, -1.6 * u]], 2.5, PAL.bone, { taper: [1, 0.1] });
    // 铜仪：支柱 + 两道环 + 指针
    const cx = 0.45 * u, cy = -1.85 * u;
    brush(ctx, [[cx, -1.15 * u], [cx, cy + 0.3 * u]], 0.07 * u, PAL.copperDeep, { taper: [1, 0.6] });
    const base = blobPath(cx, -1.17 * u, 0.25 * u, 0.07 * u, 0.1, r);
    ctx.fillStyle = PAL.copperDeep; ctx.fill(base);
    for (const [rx, ry, rot, col] of [[0.5, 0.5, 0, PAL.copper], [0.5, 0.16, -0.5, PAL.copperLight], [0.16, 0.5, 0.4, PAL.copper]] as [number, number, number, string][]) {
      ctx.save();
      ctx.strokeStyle = PAL.ink; ctx.lineWidth = 0.1 * u;
      ctx.beginPath(); ctx.ellipse(cx, cy, rx * u, ry * u, rot, 0, 6.28); ctx.stroke();
      ctx.strokeStyle = col; ctx.lineWidth = 0.055 * u;
      ctx.beginPath(); ctx.ellipse(cx, cy, rx * u, ry * u, rot, 0, 6.28); ctx.stroke();
      ctx.restore();
    }
    // 刻度
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * 6.28;
      brush(ctx, [[cx + Math.cos(a) * 0.47 * u, cy + Math.sin(a) * 0.47 * u], [cx + Math.cos(a) * 0.53 * u, cy + Math.sin(a) * 0.53 * u]], 1.6, PAL.ink, {});
    }
    // 中心“眼”
    ctx.fillStyle = PAL.ink; ctx.beginPath(); ctx.arc(cx, cy, 0.12 * u, 0, 6.28); ctx.fill();
    ctx.fillStyle = PAL.ember; ctx.beginPath(); ctx.arc(cx, cy, 0.07 * u, 0, 6.28); ctx.fill();
    ctx.fillStyle = PAL.emberHot; ctx.beginPath(); ctx.arc(cx - 2, cy - 2, 0.025 * u, 0, 6.28); ctx.fill();
    brush(ctx, [[cx, cy], [cx + 0.42 * u, cy - 0.32 * u]], 3, PAL.blood, { taper: [1, 0.05] });
    // 悬挂的骨坠
    brush(ctx, [[1.0 * u, -1.0 * u], [1.02 * u, -0.65 * u]], 1.2, PAL.ink, {});
    const charm = blobPath(1.02 * u, -0.6 * u, 0.05 * u, 0.08 * u, 0.2, r);
    ctx.fillStyle = PAL.bone; ctx.fill(charm);
    hatch(ctx, front, { x: -1.1 * u, y: -1 * u, w: 2.2 * u, h: 0.2 * u }, { r, gap: 2.5, alpha: 0.5 });
  }, { seed, outline: 2.6 });
}

export function drawDen(seed: number, big: boolean): Sprite {
  return sprite(big ? 3.0 : 2.4, big ? 2.6 : 2.0, (ctx, r, u) => {
    const S = big ? 1.2 : 1;
    contactShadow(ctx, 0, 0, 1.2 * u * S, 0.32 * u * S, 0.65);
    // 枯桩
    const stump = smoothPath([[-0.35 * u * S, 0], [-0.22 * u * S, -1.1 * u * S], [-0.35 * u * S, -1.5 * u * S], [-0.05 * u * S, -1.3 * u * S], [0.15 * u * S, -1.7 * u * S], [0.25 * u * S, -1.1 * u * S], [0.4 * u * S, 0]], true);
    ctx.fillStyle = PAL.barkDeep; ctx.fill(stump);
    // 丝茧团
    const mass = blobPath(0, -0.65 * u * S, 0.95 * u * S, 0.62 * u * S, 0.22, r, 20);
    shadeFill(ctx, mass, -0.8 * u, -1.2 * u * S, 0.8 * u, 0, [[0, PAL.bone], [0.55, PAL.boneShade], [1, PAL.boneDeep]]);
    hatch(ctx, mass, { x: -u * S, y: -1.3 * u * S, w: 2 * u * S, h: 1.3 * u * S }, { r, gap: 3, angle: 0.4, alpha: 0.55, mask: (x, y) => (x * 0.5 + (y + 0.65 * u * S) > 0.1 * u ? 1 : 0) });
    // 缠绕丝线
    ctx.save(); ctx.clip(mass);
    for (let i = 0; i < 26; i++) {
      const y = -range(r, 0.1, 1.25) * u * S, a = (r() - 0.5) * 0.9;
      const L = range(r, 0.6, 1.6) * u * S, x = (r() - 0.5) * u * S;
      brush(ctx, [[x - Math.cos(a) * L / 2, y - Math.sin(a) * L / 2], [x, y + (r() - 0.5) * 8], [x + Math.cos(a) * L / 2, y + Math.sin(a) * L / 2]], range(r, 1, 2.2), i % 3 ? PAL.boneDeep : PAL.paper, { alpha: 0.8 });
    }
    ctx.restore();
    // 洞口
    const holes = big ? 3 : 2;
    for (let i = 0; i < holes; i++) {
      const hx = range(r, -0.5, 0.45) * u * S, hy = -range(r, 0.35, 0.85) * u * S;
      const hole = blobPath(hx, hy, 0.13 * u * S, 0.1 * u * S, 0.3, r, 12);
      ctx.fillStyle = PAL.ink; ctx.fill(hole);
      ctx.fillStyle = PAL.blood; ctx.beginPath(); ctx.arc(hx + 3, hy + 1, 2.4, 0, 6.28); ctx.fill();
      ctx.beginPath(); ctx.arc(hx - 4, hy + 2, 1.8, 0, 6.28); ctx.fill();
    }
    rimLight(ctx, mass, 6, 6, PAL.paper, 0.5);
    // 外拉的丝
    for (let i = 0; i < 7; i++) {
      const a = Math.PI + (i / 6) * Math.PI;
      const sx = Math.cos(a) * 0.8 * u * S, sy = -0.65 * u * S + Math.sin(a) * 0.5 * u * S;
      brush(ctx, [[sx, sy], [sx * 1.5, sy * 0.4 + 0.02 * u], [sx * 1.6, 0.03 * u]], 1.2, rgba(PAL.bone, 0.75), { taper: [0.6, 0.2] });
    }
    // 骨骸点缀
    brush(ctx, [[0.6 * u * S, -0.02 * u], [0.95 * u * S, -0.1 * u]], 5, PAL.bone, { taper: [1, 0.6] });
  }, { seed, outline: 2.6 });
}

/** 地面上的掉落阴影小纸片（物品摆放用） */
export function drawSignpost(seed: number): Sprite {
  return sprite(1.2, 2.0, (ctx, r, u) => {
    contactShadow(ctx, 0, 0, 0.4 * u, 0.1 * u, 0.5);
    brush(ctx, [[0, 0], [0, -1.6 * u]], 0.12 * u, PAL.bark, { taper: [1, 1] });
    const b = polyPath([[-0.5 * u, -1.5 * u], [0.45 * u, -1.55 * u], [0.6 * u, -1.35 * u], [0.45 * u, -1.15 * u], [-0.5 * u, -1.1 * u]], true);
    shadeFill(ctx, b, 0, -1.5 * u, 0, -1.1 * u, [[0, PAL.barkLight], [1, PAL.bark]]);
    brush(ctx, [[-0.3 * u, -1.33 * u], [0.3 * u, -1.35 * u]], 3, PAL.blood, {});
    void r;
  }, { seed });
}
