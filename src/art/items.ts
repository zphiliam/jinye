// 物品图标（同时用作地面掉落物精灵）
import { PAL, Pt, Ctx, brush, blobPath, smoothPath, hatch, gouges, rimLight, shadeFill, polyPath, mix, rgba } from './ink';
import { sprite, Sprite } from './sprite';
import { RNG, range } from '../util/rng';

type Draw = (ctx: Ctx, r: RNG, u: number) => void;
const C = -0.5; // 图标中心 y（单位）

function stick(ctx: Ctx, r: RNG, u: number, x0: number, y0: number, x1: number, y1: number, w: number) {
  brush(ctx, [[x0 * u, y0 * u], [((x0 + x1) / 2) * u + (r() - 0.5) * 3, ((y0 + y1) / 2) * u], [x1 * u, y1 * u]], w * u, PAL.bark, { taper: [1, 0.8], jitter: 0.15 });
  brush(ctx, [[x0 * u - 1, y0 * u - 1], [x1 * u - 1, y1 * u - 1]], w * u * 0.3, PAL.barkLight, { taper: [0.5, 0.5], alpha: 0.8 });
}

function flintHead(ctx: Ctx, u: number, pts: Pt[]) {
  const p = polyPath(pts.map(([x, y]) => [x * u, y * u] as Pt), true);
  ctx.fillStyle = PAL.inkBlue; ctx.fill(p);
  rimLight(ctx, p, 3, 3, PAL.copperLight, 0.9);
  ctx.save(); ctx.clip(p);
  for (let i = 0; i < 4; i++) brush(ctx, [[pts[0][0] * u + i * 5, pts[0][1] * u], [pts[1][0] * u + i * 3, pts[1][1] * u]], 1.2, PAL.shaleLight, { alpha: 0.6 });
  ctx.restore();
}

function berryCluster(ctx: Ctx, r: RNG, u: number, cooked: boolean) {
  const pos: Pt[] = [[-0.14, C + 0.08], [0.12, C + 0.1], [0, C - 0.08], [-0.02, C + 0.2], [0.2, C - 0.08]];
  for (const [x, y] of pos) {
    const rad = 0.13 * u;
    ctx.fillStyle = PAL.ink; ctx.beginPath(); ctx.arc(x * u, y * u, rad + 2, 0, 6.28); ctx.fill();
    const g = ctx.createRadialGradient(x * u - 3, y * u - 3, 1, x * u, y * u, rad);
    g.addColorStop(0, cooked ? PAL.ember : PAL.bloodLight); g.addColorStop(1, cooked ? PAL.bloodDeep : PAL.blood);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x * u, y * u, rad, 0, 6.28); ctx.fill();
    ctx.fillStyle = PAL.bone; ctx.beginPath(); ctx.arc(x * u - rad * 0.35, y * u - rad * 0.35, rad * 0.22, 0, 6.28); ctx.fill();
    if (cooked) { brush(ctx, [[x * u - 4, y * u + 3], [x * u + 4, y * u + 2]], 1.4, PAL.ink, { alpha: 0.7 }); }
  }
  const leaf = blobPath(0.05 * u, (C - 0.24) * u, 0.12 * u, 0.05 * u, 0.2, r, 10, -0.4);
  ctx.fillStyle = cooked ? PAL.ochreDeep : PAL.moss; ctx.fill(leaf);
}

const DRAWS: Record<string, Draw> = {
  grass: (ctx, r, u) => {
    for (let i = 0; i < 14; i++) {
      const x = (r() - 0.5) * 0.35, a = -1.2 + r() * 0.5 + (i % 2) * 0.2;
      brush(ctx, [[x * u, (C + 0.35) * u], [(x + Math.cos(a) * 0.3) * u, (C + 0.35 - 0.4) * u], [(x + Math.cos(a) * 0.55) * u, (C - 0.35) * u]], 5, i % 3 ? PAL.ochre : PAL.ochreLight, { taper: [1, 0.05] });
    }
    brush(ctx, [[-0.2 * u, (C + 0.15) * u], [0.22 * u, (C + 0.1) * u]], 6, PAL.blood, { taper: [1, 1] });
  },
  twig: (ctx, r, u) => {
    stick(ctx, r, u, -0.38, C + 0.3, 0.36, C - 0.28, 0.08);
    stick(ctx, r, u, -0.3, C - 0.22, 0.38, C + 0.25, 0.07);
    brush(ctx, [[0.05 * u, (C - 0.05) * u], [0.18 * u, (C - 0.25) * u]], 3, PAL.bark, { taper: [1, 0.1] });
  },
  flint: (ctx, _r, u) => flintHead(ctx, u, [[-0.3, C + 0.25], [-0.05, C - 0.32], [0.3, C - 0.05], [0.18, C + 0.28]]),
  stone: (ctx, r, u) => {
    const p = blobPath(0, C * u + 4, 0.36 * u, 0.28 * u, 0.22, r, 12);
    shadeFill(ctx, p, -0.3 * u, (C - 0.3) * u, 0.3 * u, (C + 0.3) * u, [[0, PAL.shaleLight], [1, PAL.shaleDeep]]);
    hatch(ctx, p, { x: -0.4 * u, y: (C - 0.4) * u, w: 0.8 * u, h: 0.8 * u }, { r, gap: 3, alpha: 0.6, mask: (x, y) => (x + y - C * u > 0.08 * u ? 1 : 0) });
    rimLight(ctx, p, 3, 3, PAL.paper, 0.6);
  },
  log: (ctx, r, u) => {
    const body = polyPath([[-0.4 * u, (C - 0.05) * u], [0.25 * u, (C - 0.25) * u], [0.35 * u, (C + 0.05) * u], [-0.3 * u, (C + 0.25) * u]], true);
    shadeFill(ctx, body, 0, (C - 0.2) * u, 0, (C + 0.2) * u, [[0, PAL.barkLight], [1, PAL.barkDeep]]);
    gouges(ctx, body, { r, count: 9, area: (rr) => [range(rr, -0.3, 0.2) * u, (C + range(rr, -0.1, 0.1)) * u], len: [8, 16], w: [1, 2], angle: () => -0.3, color: PAL.ochreLight, alpha: 0.6 });
    const end = blobPath(0.3 * u, (C - 0.1) * u, 0.09 * u, 0.16 * u, 0.1, r, 12, -0.3);
    ctx.fillStyle = PAL.ochreLight; ctx.fill(end);
    ctx.strokeStyle = PAL.ochreDeep; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.ellipse(0.3 * u, (C - 0.1) * u, 0.05 * u, 0.09 * u, -0.3, 0, 6.28); ctx.stroke();
  },
  rope: (ctx, _r, u) => {
    for (let k = 0; k < 3; k++) {
      ctx.strokeStyle = k === 1 ? PAL.ochreDeep : PAL.ochre; ctx.lineWidth = 0.07 * u;
      ctx.beginPath(); ctx.ellipse(0, C * u + (k - 1) * 4, (0.3 - k * 0.03) * u, 0.2 * u, 0.2, 0, 6.28); ctx.stroke();
    }
    for (let i = 0; i < 10; i++) { const a = i * 0.63; brush(ctx, [[Math.cos(a) * 0.28 * u, C * u + Math.sin(a) * 0.18 * u], [Math.cos(a + 0.2) * 0.32 * u, C * u + Math.sin(a + 0.2) * 0.21 * u]], 1.2, PAL.ink, { alpha: 0.6 }); }
    brush(ctx, [[0.2 * u, (C + 0.12) * u], [0.36 * u, (C + 0.36) * u]], 0.06 * u, PAL.ochre, { taper: [1, 0.2] });
  },
  berry: (ctx, r, u) => berryCluster(ctx, r, u, false),
  berry_cooked: (ctx, r, u) => berryCluster(ctx, r, u, true),
  carrot: (ctx, r, u) => carrot(ctx, r, u, false),
  carrot_cooked: (ctx, r, u) => carrot(ctx, r, u, true),
  petals: (ctx, r, u) => {
    for (let i = 0; i < 5; i++) {
      const a = i * 1.26 + 0.3, x = Math.cos(a) * 0.17 * u, y = C * u + Math.sin(a) * 0.17 * u;
      const p = blobPath(x, y, 0.15 * u, 0.08 * u, 0.15, r, 10, a);
      shadeFill(ctx, p, x - 8, y - 8, x + 8, y + 8, [[0, PAL.bone], [1, i % 2 ? PAL.bloodLight : PAL.boneShade]]);
    }
    ctx.fillStyle = PAL.ember; ctx.beginPath(); ctx.arc(0, C * u, 0.07 * u, 0, 6.28); ctx.fill();
  },
  silk: (ctx, r, u) => {
    const p = blobPath(0, C * u, 0.3 * u, 0.24 * u, 0.15, r, 14);
    shadeFill(ctx, p, -0.3 * u, (C - 0.3) * u, 0.3 * u, (C + 0.3) * u, [[0, PAL.paper], [1, PAL.boneDeep]]);
    ctx.save(); ctx.clip(p);
    for (let i = 0; i < 12; i++) { const y = (C + range(r, -0.3, 0.3)) * u; brush(ctx, [[-0.35 * u, y], [0, y + (r() - 0.5) * 10], [0.35 * u, y + (r() - 0.5) * 6]], 1.3, i % 2 ? PAL.boneDeep : PAL.paper, {}); }
    ctx.restore();
    brush(ctx, [[0.2 * u, (C + 0.1) * u], [0.4 * u, (C + 0.38) * u]], 1.5, PAL.bone, {});
  },
  gland: (ctx, r, u) => {
    const p = smoothPath([[0, (C - 0.35) * u], [0.22 * u, (C - 0.05) * u], [0.18 * u, (C + 0.25) * u], [-0.18 * u, (C + 0.25) * u], [-0.22 * u, (C - 0.05) * u]], true);
    shadeFill(ctx, p, -0.2 * u, (C - 0.3) * u, 0.2 * u, (C + 0.3) * u, [[0, PAL.inkBlue], [1, PAL.ink]]);
    rimLight(ctx, p, 3, 3, PAL.copperLight, 0.8);
    ctx.fillStyle = PAL.blood; ctx.beginPath(); ctx.arc(-0.05 * u, (C + 0.05) * u, 0.07 * u, 0, 6.28); ctx.fill();
    gouges(ctx, p, { r, count: 6, area: (rr) => [range(rr, -0.1, 0.1) * u, (C + range(rr, -0.2, 0.15)) * u], len: [4, 8], w: [1, 1.5], angle: () => 1.4, color: PAL.copper, alpha: 0.7 });
  },
  meat: (ctx, r, u) => meat(ctx, r, u, false),
  meat_cooked: (ctx, r, u) => meat(ctx, r, u, true),
  reed: (ctx, r, u) => {
    for (let i = 0; i < 5; i++) {
      const x = (i - 2) * 0.06;
      brush(ctx, [[(x - 0.2) * u, (C + 0.35) * u], [(x + 0.25) * u, (C - 0.38) * u]], 4, i % 2 ? PAL.mossLight : PAL.moss, { taper: [1, 0.3] });
    }
    brush(ctx, [[-0.22 * u, (C + 0.05) * u], [0.2 * u, (C + 0.02) * u]], 5, PAL.ochreDeep, { taper: [1, 1] });
    void r;
  },
  mushroom: (ctx, r, u) => mush(ctx, r, u, false),
  mushroom_cooked: (ctx, r, u) => mush(ctx, r, u, true),
  axe: (ctx, r, u) => {
    stick(ctx, r, u, -0.32, C + 0.38, 0.22, C - 0.34, 0.075);
    flintHead(ctx, u, [[0.05, C - 0.38], [0.4, C - 0.32], [0.38, C - 0.02], [0.1, C - 0.12]]);
    brush(ctx, [[0.08 * u, (C - 0.3) * u], [0.2 * u, (C - 0.14) * u]], 4, PAL.ochre, {});
  },
  pickaxe: (ctx, r, u) => {
    stick(ctx, r, u, -0.3, C + 0.38, 0.18, C - 0.3, 0.075);
    const p = smoothPath([[-0.32 * u, (C - 0.12) * u], [0.0, (C - 0.42) * u], [0.36 * u, (C - 0.36) * u], [0.42 * u, (C - 0.06) * u], [0.3 * u, (C - 0.28) * u], [0.05 * u, (C - 0.3) * u]], true);
    ctx.fillStyle = PAL.inkBlue; ctx.fill(p); rimLight(ctx, p, 3, 3, PAL.copperLight, 0.9);
    brush(ctx, [[0.1 * u, (C - 0.38) * u], [0.2 * u, (C - 0.22) * u]], 4, PAL.ochre, {});
  },
  torch: (ctx, r, u) => {
    stick(ctx, r, u, -0.22, C + 0.4, 0.12, C - 0.12, 0.07);
    const head = blobPath(0.15 * u, (C - 0.2) * u, 0.11 * u, 0.14 * u, 0.2, r, 12, 0.5);
    ctx.fillStyle = PAL.ochre; ctx.fill(head);
    for (let i = 0; i < 3; i++) brush(ctx, [[0.06 * u, (C - 0.24 + i * 0.06) * u], [0.25 * u, (C - 0.18 + i * 0.06) * u]], 2, PAL.ochreDeep, {});
    const fl = smoothPath([[0.06 * u, (C - 0.28) * u], [0.12 * u, (C - 0.5) * u], [0.2 * u, (C - 0.42) * u], [0.3 * u, (C - 0.62) * u], [0.3 * u, (C - 0.3) * u]], true);
    shadeFill(ctx, fl, 0, (C - 0.3) * u, 0, (C - 0.6) * u, [[0, PAL.emberHot], [1, PAL.emberDeep]]);
  },
  spear: (ctx, r, u) => spear(ctx, r, u, false),
  spear2: (ctx, r, u) => spear(ctx, r, u, true),
  lantern: (ctx, r, u) => {
    brush(ctx, [[-0.1 * u, (C - 0.3) * u], [0, (C - 0.45) * u], [0.1 * u, (C - 0.3) * u]], 3, PAL.ink2, {});
    const body = smoothPath([[-0.18 * u, (C - 0.28) * u], [0.18 * u, (C - 0.28) * u], [0.24 * u, C * u], [0.16 * u, (C + 0.3) * u], [-0.16 * u, (C + 0.3) * u], [-0.24 * u, C * u]], true);
    ctx.fillStyle = PAL.paper; ctx.fill(body);
    const g = ctx.createRadialGradient(0, C * u, 0, 0, C * u, 0.3 * u);
    g.addColorStop(0, rgba(PAL.emberHot, 1)); g.addColorStop(1, rgba(PAL.ember, 0.3));
    ctx.save(); ctx.clip(body); ctx.fillStyle = g; ctx.fillRect(-u, -u, 2 * u, 2 * u);
    for (let i = -2; i <= 2; i++) brush(ctx, [[i * 0.07 * u, (C - 0.3) * u], [i * 0.09 * u, (C + 0.3) * u]], 1.6, PAL.copperDeep, {});
    ctx.restore();
    brush(ctx, [[-0.2 * u, (C - 0.28) * u], [0.2 * u, (C - 0.28) * u]], 5, PAL.copperDeep, { taper: [1, 1] });
    brush(ctx, [[-0.17 * u, (C + 0.3) * u], [0.17 * u, (C + 0.3) * u]], 5, PAL.copperDeep, { taper: [1, 1] });
    void r;
  },
  backpack: (ctx, r, u) => {
    const p = smoothPath([[-0.26 * u, (C - 0.2) * u], [0, (C - 0.35) * u], [0.26 * u, (C - 0.2) * u], [0.3 * u, (C + 0.3) * u], [-0.3 * u, (C + 0.3) * u]], true);
    shadeFill(ctx, p, -0.3 * u, 0, 0.3 * u, 0, [[0, PAL.ochreLight], [1, PAL.ochreDeep]]);
    hatch(ctx, p, { x: -0.3 * u, y: (C - 0.35) * u, w: 0.6 * u, h: 0.7 * u }, { r, gap: 3, angle: 1.2, alpha: 0.5 });
    const flap = smoothPath([[-0.27 * u, (C - 0.18) * u], [0, (C - 0.33) * u], [0.27 * u, (C - 0.18) * u], [0.2 * u, (C + 0.02) * u], [-0.2 * u, (C + 0.02) * u]], true);
    ctx.fillStyle = PAL.bark; ctx.fill(flap);
    ctx.fillStyle = PAL.bone; ctx.beginPath(); ctx.arc(0, (C + 0.0) * u, 0.05 * u, 0, 6.28); ctx.fill();
    brush(ctx, [[-0.18 * u, (C - 0.3) * u], [-0.22 * u, (C - 0.45) * u], [0.0, (C - 0.48) * u]], 3, PAL.barkDeep, {});
  },
  armor_grass: (ctx, r, u) => armor(ctx, r, u, PAL.ochre, PAL.ochreLight),
  armor_wood: (ctx, r, u) => armor(ctx, r, u, PAL.bark, PAL.barkLight),
  garland: (ctx, r, u) => {
    ctx.strokeStyle = PAL.moss; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.ellipse(0, C * u, 0.32 * u, 0.2 * u, 0, 0, 6.28); ctx.stroke();
    for (let i = 0; i < 8; i++) {
      const a = i * 0.785, x = Math.cos(a) * 0.32 * u, y = C * u + Math.sin(a) * 0.2 * u;
      const col = [PAL.bone, PAL.bloodLight, PAL.copperLight][i % 3];
      for (let k = 0; k < 5; k++) { const b = k * 1.26; ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(x + Math.cos(b) * 4, y + Math.sin(b) * 4, 4, 2.5, b, 0, 6.28); ctx.fill(); }
      ctx.fillStyle = PAL.ember; ctx.beginPath(); ctx.arc(x, y, 2, 0, 6.28); ctx.fill();
    }
    void r;
  },
  salve: (ctx, r, u) => {
    const jar = smoothPath([[-0.22 * u, (C - 0.1) * u], [0.22 * u, (C - 0.1) * u], [0.25 * u, (C + 0.3) * u], [-0.25 * u, (C + 0.3) * u]], true);
    shadeFill(ctx, jar, -0.25 * u, 0, 0.25 * u, 0, [[0, PAL.copperLight], [1, PAL.copperDeep]]);
    const lid = blobPath(0, (C - 0.12) * u, 0.24 * u, 0.07 * u, 0.1, r, 12);
    ctx.fillStyle = PAL.bark; ctx.fill(lid);
    const cream = blobPath(0, (C - 0.2) * u, 0.15 * u, 0.08 * u, 0.3, r, 10);
    ctx.fillStyle = PAL.bone; ctx.fill(cream);
    brush(ctx, [[-0.12 * u, (C + 0.1) * u], [0.12 * u, (C + 0.1) * u]], 6, PAL.blood, { taper: [1, 1] });
    brush(ctx, [[0, (C + 0.02) * u], [0, (C + 0.18) * u]], 6, PAL.blood, { taper: [1, 1] });
  },
  campfire: (ctx, r, u) => {
    for (let i = 0; i < 6; i++) { const a = i * 1.05; const p = blobPath(Math.cos(a) * 0.3 * u, (C + 0.18) * u + Math.sin(a) * 0.1 * u, 0.09 * u, 0.06 * u, 0.2, r, 10); shadeFill(ctx, p, 0, (C + 0.1) * u, 0, (C + 0.3) * u, [[0, PAL.shaleLight], [1, PAL.shaleDeep]]); }
    stick(ctx, r, u, -0.25, C + 0.2, 0.1, C - 0.1, 0.07); stick(ctx, r, u, 0.25, C + 0.2, -0.1, C - 0.1, 0.07);
    const fl = smoothPath([[-0.15 * u, (C + 0.1) * u], [-0.1 * u, (C - 0.25) * u], [0, (C - 0.15) * u], [0.05 * u, (C - 0.42) * u], [0.15 * u, (C - 0.1) * u], [0.15 * u, (C + 0.1) * u]], true);
    shadeFill(ctx, fl, 0, (C + 0.1) * u, 0, (C - 0.4) * u, [[0, PAL.emberHot], [1, PAL.emberDeep]]);
  },
  firepit: (ctx, r, u) => {
    for (let i = 0; i < 9; i++) { const a = i * 0.7; const p = blobPath(Math.cos(a) * 0.34 * u, (C + 0.12) * u + Math.sin(a) * 0.14 * u, 0.1 * u, 0.08 * u, 0.2, r, 10); shadeFill(ctx, p, 0, (C) * u, 0, (C + 0.3) * u, [[0, PAL.shaleLight], [1, PAL.shaleDeep]]); }
    const fl = smoothPath([[-0.12 * u, (C + 0.1) * u], [-0.08 * u, (C - 0.2) * u], [0, (C - 0.1) * u], [0.04 * u, (C - 0.35) * u], [0.12 * u, (C - 0.08) * u], [0.12 * u, (C + 0.1) * u]], true);
    shadeFill(ctx, fl, 0, (C + 0.1) * u, 0, (C - 0.4) * u, [[0, PAL.emberHot], [1, PAL.emberDeep]]);
  },
  bench: (ctx, r, u) => {
    brush(ctx, [[-0.32 * u, (C + 0.38) * u], [-0.3 * u, (C + 0.02) * u]], 5, PAL.bark, { taper: [1, 1] });
    brush(ctx, [[0.32 * u, (C + 0.38) * u], [0.3 * u, (C + 0.02) * u]], 5, PAL.bark, { taper: [1, 1] });
    const top = polyPath([[-0.4 * u, (C + 0.02) * u], [0.4 * u, (C + 0.02) * u], [0.38 * u, (C - 0.06) * u], [-0.38 * u, (C - 0.06) * u]], true);
    ctx.fillStyle = PAL.barkLight; ctx.fill(top);
    ctx.strokeStyle = PAL.copper; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.ellipse(0.1 * u, (C - 0.3) * u, 0.18 * u, 0.18 * u, 0, 0, 6.28); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(0.1 * u, (C - 0.3) * u, 0.18 * u, 0.06 * u, -0.5, 0, 6.28); ctx.stroke();
    ctx.fillStyle = PAL.ember; ctx.beginPath(); ctx.arc(0.1 * u, (C - 0.3) * u, 0.04 * u, 0, 6.28); ctx.fill();
    void r;
  },
};

function carrot(ctx: Ctx, r: RNG, u: number, cooked: boolean) {
  const body = smoothPath([[-0.12 * u, (C - 0.22) * u], [0.14 * u, (C - 0.2) * u], [0.05 * u, (C + 0.15) * u], [-0.06 * u, (C + 0.4) * u], [-0.1 * u, (C + 0.1) * u]], true);
  shadeFill(ctx, body, -0.12 * u, 0, 0.14 * u, 0, [[0, cooked ? PAL.emberDeep : PAL.ember], [1, cooked ? PAL.bloodDeep : PAL.emberDeep]]);
  for (let i = 0; i < 4; i++) brush(ctx, [[-0.09 * u, (C - 0.1 + i * 0.1) * u], [0.0, (C - 0.1 + i * 0.1) * u]], 1.4, PAL.ink, { alpha: 0.6 });
  if (cooked) gouges(ctx, body, { r, count: 6, area: (rr) => [range(rr, -0.08, 0.08) * u, (C + range(rr, -0.2, 0.2)) * u], len: [4, 7], w: [1.5, 2.5], angle: () => 0.3, color: PAL.ink, alpha: 0.6 });
  for (let i = 0; i < 4; i++) brush(ctx, [[0, (C - 0.2) * u], [(i - 1.5) * 0.08 * u, (C - 0.42) * u]], 3, cooked ? PAL.ochreDeep : PAL.moss, { taper: [1, 0.1] });
}
function meat(ctx: Ctx, r: RNG, u: number, cooked: boolean) {
  const p = blobPath(0.03 * u, C * u, 0.3 * u, 0.22 * u, 0.25, r, 14, -0.3);
  shadeFill(ctx, p, -0.3 * u, (C - 0.2) * u, 0.3 * u, (C + 0.2) * u, [[0, cooked ? PAL.barkLight : PAL.bloodLight], [1, cooked ? PAL.barkDeep : PAL.bloodDeep]]);
  ctx.save(); ctx.clip(p);
  for (let i = 0; i < 4; i++) brush(ctx, [[-0.3 * u, (C - 0.15 + i * 0.1) * u], [0.3 * u, (C - 0.2 + i * 0.1) * u]], 2, cooked ? PAL.ochre : PAL.copperDeep, { alpha: 0.7 });
  ctx.restore();
  brush(ctx, [[-0.2 * u, (C + 0.12) * u], [-0.38 * u, (C + 0.3) * u]], 0.07 * u, PAL.bone, { taper: [1, 1] });
  ctx.fillStyle = PAL.bone; ctx.beginPath(); ctx.arc(-0.4 * u, (C + 0.32) * u, 0.05 * u, 0, 6.28); ctx.fill();
}
function mush(ctx: Ctx, r: RNG, u: number, cooked: boolean) {
  brush(ctx, [[0, (C + 0.35) * u], [0.02 * u, (C - 0.05) * u]], 0.13 * u, cooked ? PAL.ochreLight : PAL.bone, { taper: [1, 0.8] });
  const cap = smoothPath([[-0.32 * u, (C - 0.02) * u], [-0.2 * u, (C - 0.3) * u], [0.05 * u, (C - 0.38) * u], [0.28 * u, (C - 0.25) * u], [0.34 * u, (C - 0.02) * u]], true);
  shadeFill(ctx, cap, -0.3 * u, 0, 0.3 * u, 0, [[0, cooked ? PAL.barkLight : PAL.bloodLight], [1, cooked ? PAL.barkDeep : PAL.bloodDeep]]);
  for (let k = 0; k < 5; k++) { ctx.fillStyle = cooked ? PAL.ochre : PAL.bone; ctx.beginPath(); ctx.arc((r() - 0.5) * 0.4 * u, (C - 0.12 - r() * 0.18) * u, 3, 0, 6.28); ctx.fill(); }
}
function spear(ctx: Ctx, r: RNG, u: number, fang: boolean) {
  stick(ctx, r, u, -0.38, C + 0.4, 0.22, C - 0.22, 0.06);
  if (fang) {
    const p = smoothPath([[0.18 * u, (C - 0.18) * u], [0.42 * u, (C - 0.44) * u], [0.3 * u, (C - 0.12) * u]], true);
    ctx.fillStyle = PAL.bone; ctx.fill(p); rimLight(ctx, p, 2, 2, PAL.paper, 0.8);
    brush(ctx, [[0.12 * u, (C - 0.12) * u], [0.24 * u, (C - 0.24) * u]], 6, PAL.paper, { taper: [1, 1] });
    brush(ctx, [[0.14 * u, (C - 0.08) * u], [0.0, (C + 0.12) * u]], 2, PAL.bone, {});
  } else {
    flintHead(ctx, u, [[0.18, C - 0.2], [0.42, C - 0.44], [0.28, C - 0.12]]);
    brush(ctx, [[0.12 * u, (C - 0.1) * u], [0.22 * u, (C - 0.2) * u]], 5, PAL.ochre, { taper: [1, 1] });
  }
}
function armor(ctx: Ctx, r: RNG, u: number, c0: string, c1: string) {
  const p = smoothPath([[-0.3 * u, (C - 0.28) * u], [-0.1 * u, (C - 0.34) * u], [0, (C - 0.24) * u], [0.1 * u, (C - 0.34) * u], [0.3 * u, (C - 0.28) * u], [0.26 * u, (C + 0.3) * u], [-0.26 * u, (C + 0.3) * u]], true);
  shadeFill(ctx, p, -0.3 * u, 0, 0.3 * u, 0, [[0, c1], [1, mix(c0, PAL.ink, 0.4)]]);
  ctx.save(); ctx.clip(p);
  for (let i = 0; i < 6; i++) brush(ctx, [[-0.3 * u, (C - 0.2 + i * 0.09) * u], [0.3 * u, (C - 0.2 + i * 0.09) * u + (r() - 0.5) * 4]], 2, PAL.ink, { alpha: 0.6 });
  ctx.restore();
  brush(ctx, [[-0.26 * u, (C + 0.02) * u], [0.26 * u, (C + 0.02) * u]], 5, PAL.blood, { taper: [1, 1] });
}

const cache = new Map<string, Sprite>();
export function itemSprite(id: string): Sprite {
  let s = cache.get(id);
  if (!s) {
    const d = DRAWS[id] ?? DRAWS.stone;
    s = sprite(1.0, 1.0, d, { ppu: 96, outline: 2.4, seed: id.length * 31 + id.charCodeAt(0) });
    cache.set(id, s);
  }
  return s;
}
export const ICON_IDS = Object.keys(DRAWS);
