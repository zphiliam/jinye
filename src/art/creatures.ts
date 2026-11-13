// 墨蛛、寒鸦、暗中之眼
import { PAL, Pt, brush, blobPath, smoothPath, hatch, gouges, rimLight, shadeFill, contactShadow, rgba } from './ink';
import { sprite, Sprite } from './sprite';
import { range } from '../util/rng';

export type SpiderPose = 'walk0' | 'walk1' | 'walk2' | 'walk3' | 'windup' | 'bite' | 'hurt' | 'dead' | 'sleep';

export function drawSpider(pose: SpiderPose, warrior = false): Sprite {
  return sprite(2.1, 1.7, (ctx, r, u) => {
    const dead = pose === 'dead';
    const wi = pose.startsWith('walk') ? Number(pose[4]) : 0;
    const phase = (wi / 4) * Math.PI * 2;
    let bodyY = -0.62 * u + Math.sin(phase * 2) * 0.03 * u;
    let tilt = 0;
    if (pose === 'windup') { bodyY = -0.82 * u; tilt = -0.25; }
    if (pose === 'bite') { bodyY = -0.42 * u; tilt = 0.18; }
    if (pose === 'hurt') bodyY = -0.5 * u;
    if (pose === 'sleep') bodyY = -0.38 * u;
    if (dead) bodyY = -0.38 * u;
    contactShadow(ctx, 0, 0, 0.95 * u, 0.24 * u, 0.6);
    const legCol = warrior ? PAL.bloodDeep : PAL.ink2;
    const leg = (side: number, i: number, back: boolean) => {
      const spread = [0.55, 0.2, -0.2, -0.55][i];
      const hip: Pt = [side * 0.18 * u, bodyY + 0.05 * u + i * 0.02 * u];
      const step = Math.sin(phase + i * Math.PI / 2 + (side > 0 ? Math.PI : 0));
      let fx = side * (0.62 + (1 - Math.abs(spread)) * 0.1 + Math.abs(spread) * 0.42) * u + step * 0.12 * u * side;
      let fy = (back ? -0.06 : 0.04) * u + spread * -0.06 * u - Math.max(0, step) * 0.08 * u * (pose.startsWith('walk') ? 1 : 0);
      if (pose === 'sleep') { fx *= 0.75; fy = 0.02 * u; }
      let kx = side * (0.5 + Math.abs(spread) * 0.3) * u, ky = bodyY - (0.28 + (1 - Math.abs(spread)) * 0.1) * u;
      if (pose === 'windup' && i === 0) { fx = side * 0.45 * u; fy = bodyY - 0.55 * u; kx = side * 0.55 * u; ky = bodyY - 0.4 * u; }
      if (pose === 'windup' && i === 1) { fx = side * 0.75 * u; fy = bodyY - 0.15 * u; }
      if (dead) { kx = side * (0.25 + i * 0.06) * u; ky = bodyY - (0.45 + i * 0.05) * u; fx = side * (0.12 + i * 0.05) * u; fy = bodyY - (0.62 + (3 - i) * 0.04) * u; }
      const col = back ? PAL.ink : legCol;
      brush(ctx, [hip, [(hip[0] + kx) / 2, (hip[1] + ky) / 2 - 0.04 * u], [kx, ky]], 0.075 * u, col, { taper: [1, 0.7], smooth: false });
      brush(ctx, [[kx, ky], [(kx + fx) / 2 + side * 0.03 * u, (ky + fy) / 2], [fx, fy]], 0.06 * u, col, { taper: [1, 0.05] });
      // 膝节高光
      ctx.fillStyle = rgba(PAL.bone, back ? 0.25 : 0.55);
      ctx.beginPath(); ctx.arc(kx - side * 1.5, ky - 1.5, 2, 0, 6.28); ctx.fill();
      // 腿毛
      for (let k = 0; k < 3; k++) {
        const t = 0.25 + k * 0.22, px = kx + (fx - kx) * t, py = ky + (fy - ky) * t;
        brush(ctx, [[px, py], [px + side * 5, py - 3]], 1.2, col, {});
      }
    };
    for (let i = 3; i >= 0; i--) { leg(-1, i, true); leg(1, i, true); }
    ctx.save();
    ctx.translate(0, bodyY);
    ctx.rotate(tilt);
    // 腹部（后、上）
    const ab = blobPath(0, -0.3 * u, 0.5 * u, 0.4 * u, 0.08, r, 22);
    shadeFill(ctx, ab, -0.3 * u, -0.7 * u, 0.3 * u, 0.1 * u, [[0, warrior ? PAL.bloodDeep : PAL.ink3], [0.5, PAL.ink2], [1, PAL.ink]]);
    // 骨白面具纹
    const mask = smoothPath([[0, -0.62 * u], [0.24 * u, -0.5 * u], [0.26 * u, -0.28 * u], [0.12 * u, -0.08 * u], [0, -0.14 * u], [-0.12 * u, -0.08 * u], [-0.26 * u, -0.28 * u], [-0.24 * u, -0.5 * u]], true);
    ctx.save(); ctx.clip(ab);
    shadeFill(ctx, mask, -0.2 * u, -0.6 * u, 0.2 * u, 0, [[0, PAL.bone], [1, PAL.boneDeep]]);
    ctx.fillStyle = PAL.ink;
    ctx.fill(blobPath(-0.1 * u, -0.36 * u, 0.06 * u, 0.09 * u, 0.15, r, 10, -0.4));
    ctx.fill(blobPath(0.1 * u, -0.36 * u, 0.06 * u, 0.09 * u, 0.15, r, 10, 0.4));
    brush(ctx, [[-0.08 * u, -0.18 * u], [0, -0.22 * u], [0.08 * u, -0.18 * u]], 2.2, PAL.ink, {});
    // 泪痕
    brush(ctx, [[-0.1 * u, -0.28 * u], [-0.11 * u, -0.12 * u]], 2, warrior ? PAL.ember : PAL.blood, { taper: [0.8, 0.1] });
    ctx.restore();
    hatch(ctx, ab, { x: -0.5 * u, y: -0.7 * u, w: u, h: 0.8 * u }, { r, gap: 3, angle: 0.5, alpha: 0.55, mask: (x, y) => (x * 0.4 + (y + 0.3 * u) > 0.12 * u ? 1 : 0) });
    gouges(ctx, ab, { r, count: 30, area: (rr) => { const a = rr() * 6.28, d = 0.38 + rr() * 0.1; return [Math.cos(a) * d * u, -0.3 * u + Math.sin(a) * d * 0.8 * u]; }, len: [3, 7], w: [1, 1.8], angle: (x, y) => Math.atan2(y + 0.3 * u, x), color: PAL.shaleLight, alpha: 0.6 });
    rimLight(ctx, ab, 5, 5, PAL.paper, 0.35);
    // 头胸
    const head = blobPath(0, 0.02 * u, 0.24 * u, 0.17 * u, 0.1, r, 16);
    shadeFill(ctx, head, 0, -0.15 * u, 0, 0.2 * u, [[0, PAL.ink3], [1, PAL.ink]]);
    rimLight(ctx, head, 3, 4, PAL.shaleLight, 0.5);
    // 眼
    const eyeCol = pose === 'windup' ? PAL.emberHot : pose === 'sleep' || dead ? PAL.ink3 : PAL.bloodLight;
    for (const [ex, ey, er] of [[-0.08, -0.02, 0.04], [0.08, -0.02, 0.04], [0, -0.07, 0.03], [-0.15, 0.02, 0.022], [0.15, 0.02, 0.022]] as [number, number, number][]) {
      ctx.fillStyle = eyeCol; ctx.beginPath(); ctx.arc(ex * u, ey * u, er * u, 0, 6.28); ctx.fill();
      if (pose !== 'sleep' && !dead) { ctx.fillStyle = PAL.bone; ctx.beginPath(); ctx.arc(ex * u - 1, ey * u - 1, er * u * 0.3, 0, 6.28); ctx.fill(); }
    }
    if (pose === 'sleep') for (const s of [-1, 1]) brush(ctx, [[s * 0.12 * u, -0.02 * u], [s * 0.04 * u, -0.01 * u]], 2, PAL.bone, {});
    // 螯牙
    const open = pose === 'windup' ? 0.07 : pose === 'bite' ? 0.02 : 0.035;
    for (const s of [-1, 1]) {
      brush(ctx, [[s * 0.06 * u, 0.1 * u], [s * (0.06 + open) * u, 0.2 * u], [s * 0.03 * u, 0.28 * u]], 5, PAL.bone, { taper: [1, 0.05] });
    }
    ctx.restore();
    for (let i = 3; i >= 0; i--) { leg(-1, i, false); leg(1, i, false); }
    if (pose === 'sleep') {
      ctx.fillStyle = rgba(PAL.bone, 0.85);
      ctx.font = `bold ${0.22 * u}px serif`;
      ctx.fillText('z', 0.4 * u, -1.1 * u); ctx.font = `bold ${0.15 * u}px serif`; ctx.fillText('z', 0.58 * u, -1.3 * u);
    }
  }, { outline: 2.4, seed: 11 + (warrior ? 5 : 0) });
}

export type CrowPose = 'stand' | 'peck' | 'fly0' | 'fly1';
export function drawCrow(pose: CrowPose): Sprite {
  return sprite(1.2, 1.1, (ctx, r, u) => {
    const fly = pose.startsWith('fly');
    if (!fly) contactShadow(ctx, 0, 0, 0.3 * u, 0.07 * u, 0.5);
    const by = fly ? -0.55 * u : -0.3 * u;
    const peck = pose === 'peck';
    // 身体
    const body = smoothPath([[-0.32 * u, by - 0.02 * u], [-0.1 * u, by - 0.18 * u], [0.14 * u, by - 0.16 * u], [0.22 * u, by - 0.02 * u], [0.05 * u, by + 0.1 * u], [-0.2 * u, by + 0.06 * u]], true);
    shadeFill(ctx, body, 0, by - 0.2 * u, 0, by + 0.1 * u, [[0, PAL.ink3], [1, PAL.ink]]);
    gouges(ctx, body, { r, count: 10, area: (rr) => [range(rr, -0.25, 0.1) * u, by + range(rr, -0.12, 0.04) * u], len: [5, 10], w: [1, 1.6], angle: () => Math.PI + 0.2, color: PAL.inkBlue, alpha: 0.9 });
    // 尾
    brush(ctx, [[-0.28 * u, by], [-0.45 * u, by + (fly ? 0 : 0.08) * u]], 0.12 * u, PAL.ink, { taper: [1, 0.3] });
    // 头
    const hx = peck ? 0.3 * u : 0.22 * u, hy = peck ? by + 0.08 * u : by - 0.17 * u;
    const head = blobPath(hx, hy, 0.1 * u, 0.09 * u, 0.1, r, 12);
    ctx.fillStyle = PAL.ink2; ctx.fill(head);
    brush(ctx, [[hx + 0.07 * u, hy], [hx + 0.24 * u, hy + (peck ? 0.06 : 0.02) * u]], 0.06 * u, PAL.shale, { taper: [1, 0.05] });
    ctx.fillStyle = PAL.ember; ctx.beginPath(); ctx.arc(hx + 0.03 * u, hy - 0.02 * u, 2.4, 0, 6.28); ctx.fill();
    // 翼
    if (fly) {
      const up = pose === 'fly0';
      const wing = smoothPath([[-0.1 * u, by - 0.08 * u], [-0.2 * u, by + (up ? -0.55 : 0.25) * u], [0.05 * u, by + (up ? -0.48 : 0.3) * u], [0.1 * u, by - 0.05 * u]], true);
      ctx.fillStyle = PAL.ink; ctx.fill(wing);
      gouges(ctx, wing, { r, count: 6, area: (rr) => [range(rr, -0.15, 0.05) * u, by + (up ? -0.3 : 0.1) * u + range(rr, -0.1, 0.1) * u], len: [6, 12], w: [1, 1.5], angle: () => (up ? -1.6 : 1.6), color: PAL.shale, alpha: 0.7 });
    } else {
      const wing = smoothPath([[-0.2 * u, by - 0.06 * u], [0.1 * u, by - 0.12 * u], [0.05 * u, by + 0.02 * u], [-0.3 * u, by + 0.04 * u]], true);
      ctx.fillStyle = PAL.ink; ctx.fill(wing);
      rimLight(ctx, wing, 2, 3, PAL.shaleLight, 0.6);
      for (const lx of [-0.02, 0.06]) brush(ctx, [[lx * u, by + 0.08 * u], [lx * u + 2, 0]], 2, PAL.ink, {});
    }
  }, { outline: 1.8, seed: 21 });
}

/** 黑暗中的眼睛（自发光） */
export function drawEyes(open: number): Sprite {
  return sprite(1.0, 0.5, (ctx, _r, u) => {
    for (const s of [-1, 1]) {
      const x = s * 0.2 * u, y = -0.22 * u;
      const g = ctx.createRadialGradient(x, y, 0, x, y, 0.14 * u);
      g.addColorStop(0, rgba(PAL.bloodLight, 0.6 * open)); g.addColorStop(1, rgba(PAL.blood, 0));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 0.14 * u, 0, 6.28); ctx.fill();
      ctx.fillStyle = PAL.emberHot;
      ctx.beginPath(); ctx.ellipse(x, y, 0.07 * u, 0.028 * u * open + 0.5, s * 0.25, 0, 6.28); ctx.fill();
      ctx.fillStyle = PAL.ink; ctx.beginPath(); ctx.ellipse(x, y, 0.012 * u, 0.025 * u * open, 0, 0, 6.28); ctx.fill();
    }
  }, { outline: 0, grain: 0 });
}
