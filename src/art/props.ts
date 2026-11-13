// 植物、岩石与环境素材 —— 木刻风格
import { PAL, Ctx, Pt, brush, blobPath, smoothPath, hatch, gouges, rimLight, shadeFill, contactShadow, polyPath, mix, rgba } from './ink';
import { sprite, Sprite } from './sprite';
import { RNG, range } from '../util/rng';

/* ---------------- 墨松 ---------------- */
function pineTrunk(ctx: Ctx, r: RNG, u: number, H: number, lean: number, wBase: number) {
  const pts: Pt[] = [];
  const L: Pt[] = [], R: Pt[] = [];
  const steps = 8;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const y = -t * H;
    const x = lean * t * t + Math.sin(t * 5 + r() * 0.4) * 0.03 * u;
    const w = wBase * (1 - t * 0.82) * (1 + (i === 0 ? 0.6 : 0));
    pts.push([x, y]);
    L.push([x - w, y]);
    R.push([x + w, y]);
  }
  const path = smoothPath([...L, ...R.reverse()], true);
  shadeFill(ctx, path, -wBase, 0, wBase, 0, [[0, PAL.barkLight], [0.45, PAL.bark], [1, PAL.barkDeep]]);
  gouges(ctx, path, { r, count: 26, area: (rr) => [range(rr, -wBase, wBase * 0.3), -rr() * H * 0.9], len: [0.12 * u, 0.4 * u], w: [1, 2.2], angle: () => -Math.PI / 2 + (r() - 0.5) * 0.2, color: PAL.paperDark, alpha: 0.45 });
  hatch(ctx, path, { x: -wBase, y: -H, w: wBase * 2, h: H }, { r, angle: -1.2, gap: 3.2, w: 1.3, color: PAL.ink, alpha: 0.75, mask: (x) => (x > lean * 0.3 + wBase * 0.15 ? 1 : 0) });
  // 根
  for (let k = 0; k < 4; k++) {
    const s = k < 2 ? -1 : 1;
    const ex = s * range(r, 0.35, 0.6) * u;
    brush(ctx, [[s * wBase * 0.4, -0.15 * u], [ex * 0.6, -0.02 * u], [ex, 0.04 * u]], wBase * 0.7, k % 2 ? PAL.barkDeep : PAL.bark, { taper: [1, 0.05] });
  }
}

export function drawPine(seed: number): Sprite {
  return sprite(3.6, 6.4, (ctx, r, u) => {
    const H = range(r, 5.0, 6.0) * u;
    const W = range(r, 2.7, 3.3) * u;
    const lean = (r() - 0.5) * 0.35 * u;
    contactShadow(ctx, 0, 0, 1.1 * u, 0.3 * u, 0.45);
    pineTrunk(ctx, r, u, H * 0.96, lean, 0.2 * u);
    const n = 5 + Math.floor(r() * 2);
    const tiers: { path: Path2D; cy: number; wh: number; th: number; cx: number }[] = [];
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const cy = -(0.26 + 0.66 * t) * H;
      const cx = lean * (0.26 + 0.66 * t) ** 2 + (r() - 0.5) * 0.08 * u;
      const wh = (W / 2) * (1 - t * 0.8) * range(r, 0.88, 1.08);
      const th = (0.27 - t * 0.1) * H * 0.75;
      const top: Pt = [cx + (r() - 0.5) * 0.1 * u, cy - th * 0.62];
      const pts: Pt[] = [top];
      // 右侧下垂
      pts.push([cx + wh * 0.35, cy - th * 0.2]);
      pts.push([cx + wh * 0.78, cy + th * 0.18]);
      // 锯齿状下沿（针叶簇）
      const teeth = 6 + Math.floor(wh / u * 3);
      for (let k = 0; k <= teeth; k++) {
        const s = 1 - (k / teeth) * 2;
        const x = cx + s * wh * (k === 0 || k === teeth ? 1 : range(r, 0.9, 1.0) * (1 - Math.abs(s) * 0.05));
        const droop = th * 0.42 * (1 - s * s * 0.3);
        const y = cy + droop + (k % 2 === 0 ? th * range(r, 0.06, 0.16) : -th * range(r, 0.02, 0.1));
        pts.push([x, y]);
      }
      pts.push([cx - wh * 0.78, cy + th * 0.18]);
      pts.push([cx - wh * 0.35, cy - th * 0.2]);
      tiers.push({ path: polyPath(pts, true), cy, wh, th, cx });
    }
    for (let i = 0; i < tiers.length; i++) {
      const T = tiers[i];
      const box = { x: T.cx - T.wh, y: T.cy - T.th, w: T.wh * 2, h: T.th * 1.8 };
      shadeFill(ctx, T.path, T.cx - T.wh * 0.6, T.cy - T.th * 0.6, T.cx + T.wh * 0.4, T.cy + T.th * 0.5, [[0, PAL.copper], [0.55, PAL.copperDeep], [1, mix(PAL.copperDeep, PAL.ink, 0.5)]]);
      // 暗部排线
      hatch(ctx, T.path, box, { r, angle: 0.5, gap: 3.4, w: 1.4, color: PAL.ink, alpha: 0.7, mask: (x, y) => ((y - T.cy) / T.th + (x - T.cx) / T.wh * 0.4 > 0.05 ? 1 : 0) });
      // 刻白针叶
      gouges(ctx, T.path, {
        r, count: Math.floor(16 + T.wh / u * 22),
        area: (rr) => { const s = rr() * 2 - 1; return [T.cx + s * T.wh * 0.92, T.cy + T.th * (0.36 - rr() * 0.75) * (1 - s * s * 0.3)]; },
        len: [0.1 * u, 0.26 * u], w: [1, 2],
        angle: (x) => Math.PI / 2 + (x - T.cx) / T.wh * 0.9 + (r() - 0.5) * 0.3,
        color: PAL.copperLight, alpha: 0.75,
      });
      rimLight(ctx, T.path, 5, 6, PAL.paper, 0.4);
      // 上层投影到下层
      if (i + 1 < tiers.length) {
        const U = tiers[i + 1];
        ctx.save();
        ctx.clip(T.path);
        ctx.fillStyle = rgba(PAL.ink, 0.45);
        ctx.fill(blobPath(U.cx + 4, U.cy + U.th * 0.55, U.wh * 0.95, U.th * 0.35, 0.2, r));
        ctx.restore();
      }
    }
    // 顶梢
    const T = tiers[tiers.length - 1];
    brush(ctx, [[T.cx, T.cy - T.th * 0.4], [T.cx + lean * 0.05, T.cy - T.th * 1.1]], 0.06 * u, PAL.copperDeep, { taper: [1, 0.05] });
  }, { seed, outline: 2.8 });
}

/* ---------------- 骨桦（秋叶） ---------------- */
function leafCluster(ctx: Ctx, r: RNG, u: number, cx: number, cy: number, rad: number, base: string, light: string) {
  const path = blobPath(cx, cy, rad, rad * 0.82, 0.32, r, 18);
  shadeFill(ctx, path, cx - rad, cy - rad, cx + rad * 0.6, cy + rad, [[0, light], [0.5, base], [1, mix(base, PAL.ink, 0.55)]]);
  hatch(ctx, path, { x: cx - rad, y: cy - rad, w: rad * 2, h: rad * 2 }, { r, angle: 0.7, gap: 3.2, w: 1.3, alpha: 0.65, mask: (x, y) => ((x - cx) * 0.6 + (y - cy) > rad * 0.15 ? 1 : 0) });
  gouges(ctx, path, { r, count: Math.floor(rad / u * 30), area: (rr) => { const a = rr() * 6.28, d = Math.sqrt(rr()) * rad * 0.85; return [cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.8]; }, len: [0.06 * u, 0.14 * u], w: [1.2, 2.4], angle: (_x, _y, rr) => rr() * 6.28, color: mix(light, PAL.paper, 0.4), alpha: 0.6, curve: 0.8 });
  rimLight(ctx, path, 5, 5, PAL.paper, 0.45);
}

export function drawBirch(seed: number): Sprite {
  return sprite(3.4, 5.6, (ctx, r, u) => {
    const H = range(r, 4.0, 4.8) * u;
    contactShadow(ctx, 0, 0, 0.9 * u, 0.25 * u, 0.45);
    const lean = (r() - 0.5) * 0.4 * u;
    const wB = 0.17 * u;
    const L: Pt[] = [], R: Pt[] = [];
    for (let i = 0; i <= 8; i++) {
      const t = i / 8, y = -t * H * 0.85, x = lean * t + Math.sin(t * 7) * 0.05 * u;
      const w = wB * (1 - t * 0.6) * (i === 0 ? 1.5 : 1);
      L.push([x - w, y]); R.push([x + w, y]);
    }
    const trunk = smoothPath([...L, ...R.reverse()], true);
    shadeFill(ctx, trunk, -wB, 0, wB, 0, [[0, PAL.bone], [0.6, PAL.boneShade], [1, PAL.boneDeep]]);
    // 桦树“眼”纹
    ctx.save(); ctx.clip(trunk);
    for (let k = 0; k < 11; k++) {
      const t = r() * 0.85, y = -t * H * 0.85, x = lean * t;
      brush(ctx, [[x - wB * 1.1, y], [x + (r() - 0.5) * wB, y + (r() - 0.5) * 3], [x + wB * 1.1, y + 2]], range(r, 2, 5), PAL.ink, { taper: [0.1, 0.6] });
    }
    ctx.restore();
    hatch(ctx, trunk, { x: -wB * 2, y: -H, w: wB * 4, h: H }, { r, angle: -1.3, gap: 3, alpha: 0.6, mask: (x, y) => (x > lean * (-y / H) + wB * 0.2 ? 1 : 0) });
    // 枝
    const tips: Pt[] = [];
    const branch = (x: number, y: number, a: number, len: number, w: number, d: number) => {
      const ex = x + Math.cos(a) * len, ey = y + Math.sin(a) * len;
      brush(ctx, [[x, y], [(x + ex) / 2 + (r() - 0.5) * len * 0.2, (y + ey) / 2], [ex, ey]], w, PAL.ink2, { taper: [1, 0.2] });
      if (d <= 0) { tips.push([ex, ey]); return; }
      branch(ex, ey, a - range(r, 0.3, 0.6), len * 0.7, w * 0.65, d - 1);
      branch(ex, ey, a + range(r, 0.3, 0.6), len * 0.7, w * 0.65, d - 1);
    };
    const top: Pt = [lean * 0.85, -H * 0.72];
    branch(top[0], top[1], -Math.PI / 2 - 0.5, 0.7 * u, 0.12 * u, 2);
    branch(top[0], top[1], -Math.PI / 2 + 0.5, 0.7 * u, 0.12 * u, 2);
    branch(lean * 0.6, -H * 0.55, -0.4, 0.6 * u, 0.08 * u, 1);
    // 叶簇（由后往前）
    const palettes: [string, string][] = [[PAL.ochre, PAL.ochreLight], [PAL.bloodLight, PAL.ember], [PAL.ochreDeep, PAL.ochre], [PAL.blood, PAL.bloodLight]];
    const pal = palettes[Math.floor(r() * palettes.length)];
    const clusters: [number, number, number][] = [];
    for (const t of tips) clusters.push([t[0], t[1], range(r, 0.42, 0.62) * u]);
    clusters.push([top[0], top[1] - 0.9 * u, 0.75 * u]);
    clusters.sort((a, b) => a[1] - b[1]);
    for (const [x, y, rad] of clusters) leafCluster(ctx, r, u, x, y, rad, pal[0], pal[1]);
  }, { seed, outline: 2.6 });
}

/* ---------------- 沼柳（枯木） ---------------- */
let deadStrands: Pt[] = [];
export function drawDeadTree(seed: number): Sprite {
  return sprite(3.6, 5.4, (ctx, r, u) => {
    contactShadow(ctx, 0, 0, 1.0 * u, 0.28 * u, 0.5);
    const strands: Pt[] = [];
    deadStrands = strands;
    const branch = (x: number, y: number, a: number, len: number, w: number, d: number) => {
      const pts: Pt[] = [[x, y]];
      let cx = x, cy = y, ca = a;
      for (let i = 0; i < 4; i++) {
        ca += (r() - 0.5) * 0.7;
        cx += Math.cos(ca) * len / 4; cy += Math.sin(ca) * len / 4;
        pts.push([cx, cy]);
      }
      brush(ctx, pts, w, d > 2 ? PAL.barkDeep : PAL.ink2, { taper: [1, 0.15], jitter: 0.4 });
      if (w > 0.1 * u) brush(ctx, pts.map(([px, py]) => [px - w * 0.2, py] as Pt), w * 0.25, PAL.barkLight, { taper: [0.5, 0.1], alpha: 0.5 });
      if (d <= 0) { strands.push([cx, cy]); return; }
      const k = 2 + (r() < 0.3 ? 1 : 0);
      for (let i = 0; i < k; i++) branch(cx, cy, ca + (i - (k - 1) / 2) * range(r, 0.5, 0.9), len * range(r, 0.55, 0.75), w * 0.6, d - 1);
      if (r() < 0.5) strands.push([cx, cy]);
    };
    // 树干与根
    for (let k = 0; k < 5; k++) {
      const s = (k / 4) * 2 - 1;
      brush(ctx, [[s * 0.1 * u, -0.4 * u], [s * 0.4 * u, -0.08 * u], [s * 0.75 * u, 0.05 * u]], 0.18 * u, PAL.barkDeep, { taper: [1, 0.05] });
    }
    branch(0, 0.02 * u, -Math.PI / 2 + (r() - 0.5) * 0.2, 2.4 * u, 0.5 * u, 3);
  }, {
    seed, outline: 2.2, post: (ctx, r, u) => {
      // 垂挂苔丝（描边后绘制，保持纤细）
      for (const [x, y] of deadStrands) {
        const len = range(r, 0.5, 1.4) * u;
        for (let j = 0; j < 5; j++) {
          const ox = (r() - 0.5) * 0.25 * u;
          const l = len * range(r, 0.5, 1);
          brush(ctx, [[x + ox * 0.3, y], [x + ox + (r() - 0.5) * 0.12 * u, y + l * 0.5], [x + ox + (r() - 0.5) * 0.1 * u, y + l]], range(r, 1.2, 2.4), j % 2 ? PAL.copperDeep : mix(PAL.copper, PAL.ink, 0.3), { taper: [0.9, 0.05] });
        }
      }
    },
  });
}

/* ---------------- 树桩 ---------------- */
export function drawStump(seed: number, kind: 'pine' | 'birch' | 'dead'): Sprite {
  return sprite(1.6, 1.2, (ctx, r, u) => {
    contactShadow(ctx, 0, 0, 0.75 * u, 0.2 * u, 0.5);
    const w = (kind === 'birch' ? 0.3 : 0.38) * u, h = 0.55 * u;
    const body = smoothPath([[-w * 1.4, 0.03 * u], [-w, -h * 0.4], [-w, -h], [w, -h * 1.05], [w, -h * 0.4], [w * 1.5, 0.03 * u], [0, 0.08 * u]], true);
    const c0 = kind === 'birch' ? PAL.bone : PAL.barkLight, c1 = kind === 'birch' ? PAL.boneDeep : PAL.barkDeep;
    shadeFill(ctx, body, -w, 0, w, 0, [[0, c0], [1, c1]]);
    hatch(ctx, body, { x: -w * 1.5, y: -h, w: w * 3, h: h * 1.2 }, { r, gap: 3, alpha: 0.6, mask: (x) => (x > w * 0.1 ? 1 : 0) });
    // 断面年轮
    const top = blobPath(0, -h, w * 1.02, w * 0.38, 0.12, r);
    ctx.fillStyle = PAL.ochreLight; ctx.fill(top);
    ctx.save(); ctx.clip(top);
    for (let k = 1; k < 5; k++) { ctx.strokeStyle = rgba(PAL.ochreDeep, 0.8); ctx.lineWidth = 1.2; ctx.beginPath(); ctx.ellipse((r() - 0.5) * 3, -h, w * k / 5, w * 0.38 * k / 5, 0, 0, 6.28); ctx.stroke(); }
    // 斧痕
    brush(ctx, [[-w * 0.8, -h - w * 0.2], [w * 0.4, -h + w * 0.1]], 3, PAL.ochreDeep, {});
    ctx.restore();
  }, { seed, outline: 2.2 });
}

/* ---------------- 蓑草丛 ---------------- */
export function drawGrassTuft(seed: number, picked: boolean): Sprite {
  return sprite(1.3, 1.3, (ctx, r, u) => {
    contactShadow(ctx, 0, 0, 0.5 * u, 0.14 * u, 0.45);
    const n = picked ? 12 : 22;
    for (let i = 0; i < n; i++) {
      const s = (r() * 2 - 1);
      const x0 = s * 0.22 * u;
      const len = (picked ? range(r, 0.12, 0.22) : range(r, 0.6, 1.05)) * u * (1 - Math.abs(s) * 0.3);
      const bend = s * range(r, 0.15, 0.55) * u;
      const col = i % 3 === 0 ? PAL.ochreLight : i % 3 === 1 ? PAL.ochre : PAL.ochreDeep;
      brush(ctx, [[x0, 0], [x0 + bend * 0.3, -len * 0.5], [x0 + bend, -len]], range(r, 4, 7), col, { taper: [1, 0.02], jitter: 0.2 });
      if (i % 2 === 0) brush(ctx, [[x0 + 1, -len * 0.1], [x0 + bend * 0.3 + 1, -len * 0.5]], 1.4, PAL.paper, { alpha: 0.55 });
    }
    if (!picked) for (let i = 0; i < 4; i++) {
      const x = (r() - 0.5) * 0.5 * u;
      brush(ctx, [[x, -0.3 * u], [x + (r() - 0.5) * 0.3 * u, -0.95 * u]], 1.5, PAL.ink2, { taper: [0.5, 0.05] });
      ctx.fillStyle = PAL.ochreLight;
      ctx.fill(blobPath(x + (r() - 0.5) * 0.3 * u, -0.95 * u, 3, 7, 0.2, r));
    }
  }, { seed, outline: 1.8 });
}

/* ---------------- 枝苗 ---------------- */
export function drawSapling(seed: number, picked: boolean): Sprite {
  return sprite(1.4, 1.7, (ctx, r, u) => {
    contactShadow(ctx, 0, 0, 0.45 * u, 0.13 * u, 0.45);
    const n = picked ? 4 : 7;
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + ((i / (n - 1)) - 0.5) * 1.3 + (r() - 0.5) * 0.2;
      const len = (picked ? range(r, 0.15, 0.25) : range(r, 0.9, 1.4)) * u;
      const ex = Math.cos(a) * len, ey = Math.sin(a) * len;
      const mid: Pt = [ex * 0.5 + (r() - 0.5) * 0.12 * u, ey * 0.5];
      brush(ctx, [[0, 0], mid, [ex, ey]], 4.5, PAL.barkDeep, { taper: [1, 0.1] });
      brush(ctx, [[-1, -2], [mid[0] - 1, mid[1]]], 1.2, PAL.barkLight, { alpha: 0.7 });
      if (!picked) {
        for (let k = 0; k < 3; k++) {
          const t = 0.45 + k * 0.22;
          const lx = ex * t, ly = ey * t;
          const side = k % 2 ? 1 : -1;
          const leaf = blobPath(lx + side * 5, ly - 2, 6, 3, 0.2, r, 10, a + side * 0.9);
          ctx.fillStyle = k === 2 ? PAL.mossLight : PAL.moss;
          ctx.fill(leaf);
        }
      } else {
        ctx.fillStyle = PAL.ochreLight;
        ctx.beginPath(); ctx.ellipse(ex, ey, 3, 1.5, a, 0, 6.28); ctx.fill();
      }
    }
  }, { seed, outline: 1.8 });
}

/* ---------------- 赤莓丛 ---------------- */
export function drawBerryBush(seed: number, berries: boolean): Sprite {
  return sprite(1.9, 1.7, (ctx, r, u) => {
    contactShadow(ctx, 0, 0, 0.8 * u, 0.2 * u, 0.5);
    const leaves: [number, number, number][] = [];
    for (let i = 0; i < 28; i++) {
      const a = r() * Math.PI, d = Math.sqrt(r());
      leaves.push([Math.cos(a) * d * 0.72 * u, -Math.sin(a) * d * 0.95 * u - 0.15 * u, a]);
    }
    leaves.sort((a, b) => a[1] - b[1]);
    // 背后暗团
    const mass = blobPath(0, -0.5 * u, 0.82 * u, 0.55 * u, 0.25, r);
    ctx.fillStyle = PAL.mossDeep; ctx.fill(mass);
    hatch(ctx, mass, { x: -u, y: -1.2 * u, w: 2 * u, h: 1.3 * u }, { r, gap: 3, angle: 0.6, alpha: 0.6 });
    for (const [x, y] of leaves) {
      const sz = range(r, 0.13, 0.2) * u;
      const ang = Math.atan2(y + 0.4 * u, x) + (r() - 0.5) * 0.6;
      const tip: Pt = [x + Math.cos(ang) * sz * 1.4, y + Math.sin(ang) * sz * 1.4];
      const nx = -Math.sin(ang) * sz * 0.5, ny = Math.cos(ang) * sz * 0.5;
      const leaf = smoothPath([[x - Math.cos(ang) * sz * 0.4, y - Math.sin(ang) * sz * 0.4], [x + nx, y + ny], tip, [x - nx, y - ny]], true);
      const lit = (-y / u) * 0.5 + (x < 0 ? 0.3 : 0);
      ctx.fillStyle = mix(PAL.mossDeep, PAL.mossLight, Math.min(1, lit + r() * 0.3));
      ctx.fill(leaf);
      brush(ctx, [[x, y], tip], 1, PAL.ink, { alpha: 0.5 });
    }
    if (berries) {
      for (let i = 0; i < 9; i++) {
        const a = r() * Math.PI, d = Math.sqrt(r()) * 0.6;
        const bx = Math.cos(a) * d * u, by = -Math.sin(a) * d * 0.9 * u - 0.25 * u;
        for (let k = 0; k < 3; k++) {
          const ox = (k - 1) * 5 + (r() - 0.5) * 2, oy = (k === 1 ? -4 : 0);
          const rad = range(r, 4.5, 6.5);
          ctx.fillStyle = PAL.ink; ctx.beginPath(); ctx.arc(bx + ox, by + oy, rad + 1.6, 0, 6.28); ctx.fill();
          const g = ctx.createRadialGradient(bx + ox - 2, by + oy - 2, 0, bx + ox, by + oy, rad);
          g.addColorStop(0, PAL.bloodLight); g.addColorStop(1, PAL.bloodDeep);
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(bx + ox, by + oy, rad, 0, 6.28); ctx.fill();
          ctx.fillStyle = PAL.bone; ctx.beginPath(); ctx.arc(bx + ox - rad * 0.35, by + oy - rad * 0.35, rad * 0.25, 0, 6.28); ctx.fill();
        }
      }
    }
  }, { seed, outline: 2.2 });
}

/* ---------------- 夜铃花 ---------------- */
export function drawFlower(seed: number, variant: number): Sprite {
  const cols: [string, string][] = [[PAL.bone, PAL.boneShade], [PAL.bloodLight, PAL.blood], [PAL.copperLight, PAL.copper]];
  const [c0, c1] = cols[variant % 3];
  return sprite(0.9, 1.1, (ctx, r, u) => {
    contactShadow(ctx, 0, 0, 0.25 * u, 0.07 * u, 0.4);
    const heads = 2 + Math.floor(r() * 2);
    for (let h = 0; h < heads; h++) {
      const x = (h - (heads - 1) / 2) * 0.22 * u, top = -range(r, 0.55, 0.9) * u;
      const bend = (r() - 0.5) * 0.25 * u;
      brush(ctx, [[x * 0.3, 0], [x + bend * 0.5, top * 0.5], [x + bend, top]], 2.6, PAL.mossDeep, { taper: [1, 0.3] });
      brush(ctx, [[x * 0.3, -0.1 * u], [x * 0.3 + 6, -0.25 * u]], 4, PAL.moss, { taper: [0.2, 0.05] });
      // 铃形花冠，开口朝下
      const hx = x + bend, hy = top;
      const bell = smoothPath([[hx - 2, hy - 2], [hx - 9, hy + 6], [hx - 10, hy + 13], [hx - 5, hy + 11], [hx, hy + 14], [hx + 5, hy + 11], [hx + 10, hy + 13], [hx + 9, hy + 6], [hx + 2, hy - 2]], true);
      shadeFill(ctx, bell, hx - 10, hy, hx + 10, hy, [[0, c0], [1, c1]]);
      brush(ctx, [[hx + 4, hy + 1], [hx + 6, hy + 11]], 1.3, PAL.ink, { alpha: 0.6 });
      ctx.fillStyle = PAL.emberHot; ctx.beginPath(); ctx.arc(hx, hy + 14, 1.8, 0, 6.28); ctx.fill();
    }
  }, { seed, outline: 1.6 });
}

/* ---------------- 野萝卜 ---------------- */
export function drawCarrotPlant(seed: number): Sprite {
  return sprite(0.9, 0.9, (ctx, r, u) => {
    contactShadow(ctx, 0, 0, 0.3 * u, 0.08 * u, 0.4);
    const root = smoothPath([[-0.11 * u, -0.06 * u], [-0.09 * u, -0.17 * u], [0.09 * u, -0.18 * u], [0.12 * u, -0.05 * u], [0, 0.02 * u]], true);
    shadeFill(ctx, root, -0.12 * u, 0, 0.12 * u, 0, [[0, PAL.ember], [1, PAL.emberDeep]]);
    for (let i = 0; i < 3; i++) brush(ctx, [[-0.08 * u, -0.08 * u - i * 3], [-0.02 * u, -0.08 * u - i * 3]], 1.2, PAL.ink, { alpha: 0.6 });
    for (let i = 0; i < 6; i++) {
      const a = -Math.PI / 2 + (i / 5 - 0.5) * 1.4;
      const len = range(r, 0.4, 0.62) * u;
      const ex = Math.cos(a) * len, ey = Math.sin(a) * len - 0.16 * u;
      brush(ctx, [[0, -0.16 * u], [ex * 0.5, ey * 0.6], [ex, ey]], 2.2, PAL.moss, {});
      for (let k = 1; k < 5; k++) {
        const t = k / 5, px = ex * t, py = -0.16 * u + (ey + 0.16 * u) * t;
        brush(ctx, [[px, py], [px + 5, py - 4]], 2, k % 2 ? PAL.mossLight : PAL.moss, { taper: [0.5, 0.1] });
        brush(ctx, [[px, py], [px - 5, py - 4]], 2, PAL.moss, { taper: [0.5, 0.1] });
      }
    }
  }, { seed, outline: 1.6 });
}

/* ---------------- 燧岩（巨石） ---------------- */
export function drawBoulder(seed: number): Sprite {
  return sprite(2.4, 2.0, (ctx, r, u) => {
    contactShadow(ctx, 0, 0, 1.15 * u, 0.3 * u, 0.6);
    const W = range(r, 0.85, 1.05) * u, H = range(r, 1.1, 1.45) * u;
    const outline: Pt[] = [];
    const n = 9;
    for (let i = 0; i < n; i++) {
      const a = Math.PI + (i / (n - 1)) * Math.PI;
      const k = range(r, 0.85, 1.08);
      outline.push([Math.cos(a) * W * k, Math.sin(a) * H * k * (i === 0 || i === n - 1 ? 0.1 : 1)]);
    }
    outline.push([W * 0.6, 0.08 * u], [-W * 0.6, 0.08 * u]);
    const rock = polyPath(outline, true);
    ctx.fillStyle = PAL.shale; ctx.fill(rock);
    // 刻面
    const apex: Pt = [range(r, -0.2, 0.15) * W, -H * 0.55];
    for (let i = 0; i < outline.length - 2; i++) {
      const facet = polyPath([apex, outline[i], outline[i + 1]], true);
      const lit = 1 - i / (outline.length - 3);
      ctx.save(); ctx.clip(rock);
      ctx.fillStyle = mix(PAL.shaleDeep, PAL.shaleLight, Math.max(0, Math.min(1, lit * 0.9 + (r() - 0.5) * 0.25)));
      ctx.fill(facet);
      ctx.restore();
      brush(ctx, [apex, [(apex[0] + outline[i][0]) / 2 + (r() - 0.5) * 4, (apex[1] + outline[i][1]) / 2], outline[i]], 1.8, PAL.ink, { alpha: 0.75 });
    }
    ctx.save(); ctx.clip(rock);
    ctx.fillStyle = rgba(PAL.ink, 0.35);
    ctx.fillRect(-W * 1.2, -0.2 * u, W * 2.4, 0.4 * u);
    ctx.restore();
    hatch(ctx, rock, { x: -W, y: -H, w: W * 2, h: H }, { r, angle: -0.6, gap: 3.4, alpha: 0.7, mask: (x, y) => (x > apex[0] + W * 0.15 || y > -0.25 * u ? 1 : 0) });
    // 燧石脉
    for (let k = 0; k < 4; k++) {
      const x = range(r, -0.6, 0.5) * W, y = -range(r, 0.2, 0.75) * H;
      const shard = polyPath([[x, y - 7], [x + 9, y - 1], [x + 3, y + 7], [x - 6, y + 3]], true);
      ctx.save(); ctx.clip(rock);
      ctx.fillStyle = PAL.inkBlue; ctx.fill(shard);
      brush(ctx, [[x - 2, y - 4], [x + 5, y - 1]], 2, PAL.copperLight, { alpha: 0.9 });
      ctx.restore();
    }
    // 苔斑
    gouges(ctx, rock, { r, count: 30, area: (rr) => [range(rr, -0.8, 0.3) * W, -range(rr, 0.55, 1) * H], len: [3, 7], w: [2, 3.5], angle: (_x, _y, rr) => rr() * 6.28, color: PAL.mossLight, alpha: 0.6, curve: 1 });
    rimLight(ctx, rock, 6, 5, PAL.paper, 0.5);
  }, { seed, outline: 2.8 });
}

/* ---------------- 芦苇 ---------------- */
export function drawReeds(seed: number, picked: boolean): Sprite {
  return sprite(1.2, 2.0, (ctx, r, u) => {
    contactShadow(ctx, 0, 0, 0.45 * u, 0.12 * u, 0.4);
    const n = picked ? 8 : 9;
    for (let i = 0; i < n; i++) {
      const x = (r() - 0.5) * 0.5 * u;
      const len = (picked ? range(r, 0.12, 0.25) : range(r, 1.2, 1.8)) * u;
      const bend = (r() - 0.5) * 0.3 * u;
      brush(ctx, [[x, 0], [x + bend * 0.3, -len * 0.5], [x + bend, -len]], 3, i % 2 ? PAL.mossLight : PAL.moss, { taper: [1, 0.05] });
      if (!picked && i % 2 === 0) {
        const hx = x + bend * 0.85, hy = -len * 0.82;
        const head = smoothPath([[hx - 3, hy - 9], [hx + 3, hy - 9], [hx + 4, hy + 9], [hx - 4, hy + 9]], true);
        shadeFill(ctx, head, hx - 4, hy, hx + 4, hy, [[0, PAL.barkLight], [1, PAL.barkDeep]]);
      }
    }
    for (let i = 0; i < 3; i++) {
      const x = (r() - 0.5) * 0.6 * u;
      brush(ctx, [[x, 0], [x + 0.3 * u * (r() - 0.5), -0.5 * u], [x + 0.4 * u * (r() > 0.5 ? 1 : -1), -0.7 * u]], 4, PAL.copperDeep, { taper: [1, 0.05] });
    }
  }, { seed, outline: 1.6 });
}

/* ---------------- 装饰：蕨、菇、碎石、骨、矮草 ---------------- */
export function drawFern(seed: number): Sprite {
  return sprite(1.4, 1.0, (ctx, r, u) => {
    for (let i = 0; i < 6; i++) {
      const a = -Math.PI / 2 + (i / 5 - 0.5) * 2.2;
      const len = range(r, 0.45, 0.7) * u;
      const ex = Math.cos(a) * len, ey = Math.sin(a) * len * 0.8;
      const mid: Pt = [ex * 0.5, ey * 0.6 - 4];
      brush(ctx, [[0, 0], mid, [ex, ey]], 2, PAL.mossDeep, {});
      for (let k = 1; k < 7; k++) {
        const t = k / 7;
        const px = ex * t, py = (ey * t) + Math.sin(t * 3) * -4;
        const s = (1 - t) * 6 + 2;
        brush(ctx, [[px, py], [px - Math.sin(a) * s, py + Math.cos(a) * s * 0.4 - s * 0.6]], 3, k % 2 ? PAL.moss : PAL.mossLight, { taper: [0.8, 0.05] });
        brush(ctx, [[px, py], [px + Math.sin(a) * s, py - Math.cos(a) * s * 0.4 - s * 0.6]], 3, PAL.moss, { taper: [0.8, 0.05] });
      }
    }
  }, { seed, outline: 1.4, grain: 0.15 });
}

export function drawMushrooms(seed: number): Sprite {
  return sprite(0.8, 0.7, (ctx, r, u) => {
    contactShadow(ctx, 0, 0, 0.3 * u, 0.08 * u, 0.4);
    const n = 2 + Math.floor(r() * 2);
    for (let i = 0; i < n; i++) {
      const x = (i - (n - 1) / 2) * 0.18 * u + (r() - 0.5) * 6, h = range(r, 0.2, 0.42) * u, cw = range(r, 0.1, 0.17) * u;
      brush(ctx, [[x, 0], [x + (r() - 0.5) * 4, -h]], cw * 0.45, PAL.bone, { taper: [1, 0.8] });
      const cap = smoothPath([[x - cw, -h + 2], [x - cw * 0.6, -h - cw * 0.6], [x, -h - cw * 0.75], [x + cw * 0.6, -h - cw * 0.6], [x + cw, -h + 2]], true);
      shadeFill(ctx, cap, x - cw, -h, x + cw, -h, [[0, PAL.bloodLight], [1, PAL.bloodDeep]]);
      for (let k = 0; k < 3; k++) { ctx.fillStyle = PAL.bone; ctx.beginPath(); ctx.arc(x + (r() - 0.5) * cw, -h - r() * cw * 0.5, 1.6, 0, 6.28); ctx.fill(); }
    }
  }, { seed, outline: 1.4 });
}

export function drawPebbles(seed: number): Sprite {
  return sprite(1.0, 0.5, (ctx, r, u) => {
    for (let i = 0; i < 4; i++) {
      const x = (r() - 0.5) * 0.7 * u, y = (r() - 0.6) * 0.15 * u, s = range(r, 0.07, 0.15) * u;
      const p = blobPath(x, y - s * 0.4, s, s * 0.7, 0.25, r, 10);
      shadeFill(ctx, p, x - s, y - s, x + s, y, [[0, PAL.shaleLight], [1, PAL.shaleDeep]]);
    }
  }, { seed, outline: 1.3 });
}

export function drawBones(seed: number): Sprite {
  return sprite(1.8, 1.0, (ctx, r, u) => {
    contactShadow(ctx, 0, 0, 0.8 * u, 0.15 * u, 0.35);
    // 巨兽肋骨
    for (let i = 0; i < 4; i++) {
      const x = (i - 1.5) * 0.3 * u;
      brush(ctx, [[x, 0], [x - 0.05 * u, -0.4 * u], [x + 0.2 * u, -0.7 * u + i * 4]], 7, PAL.bone, { taper: [1, 0.4] });
      brush(ctx, [[x + 2, -0.1 * u], [x - 0.02 * u + 2, -0.4 * u]], 2, PAL.boneDeep, {});
    }
    // 颅骨
    const sk = blobPath(0.62 * u, -0.12 * u, 0.2 * u, 0.13 * u, 0.15, r);
    ctx.fillStyle = PAL.bone; ctx.fill(sk);
    ctx.fillStyle = PAL.ink; ctx.beginPath(); ctx.ellipse(0.56 * u, -0.14 * u, 4, 3, 0, 0, 6.28); ctx.fill();
    hatch(ctx, sk, { x: 0.4 * u, y: -0.3 * u, w: 0.5 * u, h: 0.3 * u }, { r, gap: 2.6, alpha: 0.5, mask: (_x, y) => (y > -0.12 * u ? 1 : 0) });
  }, { seed, outline: 1.6 });
}

export function drawTuft(seed: number, swampy: boolean): Sprite {
  return sprite(0.8, 0.6, (ctx, r, u) => {
    for (let i = 0; i < 9; i++) {
      const x = (r() - 0.5) * 0.4 * u, len = range(r, 0.25, 0.5) * u, b = (r() - 0.5) * 0.3 * u;
      brush(ctx, [[x, 0], [x + b, -len]], 3, swampy ? (i % 2 ? PAL.swampLight : PAL.copperDeep) : (i % 2 ? PAL.mossLight : PAL.ochre), { taper: [1, 0.02] });
    }
  }, { seed, outline: 1.1, grain: 0.1 });
}

/* ---------------- 地面燧石（可拾取） ---------------- */
export function drawFlintGround(seed: number): Sprite {
  return sprite(0.7, 0.45, (ctx, r, u) => {
    contactShadow(ctx, 0, 0, 0.25 * u, 0.06 * u, 0.5);
    const s = 0.18 * u;
    const shard = polyPath([[-s, 0], [-s * 0.4, -s * 1.3], [s * 0.6, -s * 0.9], [s, 0]], true);
    ctx.fillStyle = PAL.inkBlue; ctx.fill(shard);
    brush(ctx, [[-s * 0.4, -s * 1.1], [s * 0.3, -s * 0.6]], 2.4, PAL.copperLight, {});
    brush(ctx, [[-s * 0.6, -s * 0.3], [0, -s * 0.2]], 1.4, PAL.shaleLight, {});
  }, { seed, outline: 1.6 });
}
void PAL;
