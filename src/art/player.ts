// 主角「阿烬」—— 每帧程序化绘制：呼吸、眨眼、步态、挥砍、进食、黑暗中瑟缩
import { PAL, Pt, Ctx, brush, blobPath, smoothPath, hatch, gouges, rimLight, shadeFill, contactShadow, makeCanvas, inkOutline, applyGrain, mix, rgba } from './ink';
import { mulberry32 } from '../util/rng';
import { itemSprite } from './items';

export type Facing = 'down' | 'up' | 'side';
export type Action = 'none' | 'chop' | 'mine' | 'attack' | 'eat' | 'pickup' | 'hurt' | 'craft';

export interface PlayerPose {
  t: number;
  facing: Facing;
  flip: boolean;
  walk: number;      // 步态相位（弧度）
  moving: boolean;
  action: Action;
  actionT: number;   // 0..1
  held: string | null;
  armor: string | null;
  head: string | null;
  back: string | null;
  shiver: number;    // 0..1
  dead: boolean;
}

export const PLAYER_PPU = 110;
export const PLAYER_W = 2.2, PLAYER_H = 2.5;

export class PlayerArt {
  canvas: HTMLCanvasElement;
  private work: HTMLCanvasElement;
  private wctx: Ctx;
  /** 手部位置（世界单位，相对落脚点，x 向右、y 向上） */
  hand = { x: 0, y: 1 };
  pad = 8;
  constructor() {
    const W = Math.ceil(PLAYER_W * PLAYER_PPU) + 16, H = Math.ceil(PLAYER_H * PLAYER_PPU) + 16;
    [this.work, this.wctx] = makeCanvas(W, H);
    [this.canvas] = makeCanvas(W, H);
  }

  draw(p: PlayerPose) {
    const ctx = this.wctx, u = PLAYER_PPU;
    const W = this.work.width, H = this.work.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.translate(W / 2, H - this.pad);
    if (p.flip) ctx.scale(-1, 1);
    const r = mulberry32(5);
    if (p.dead) {
      ctx.translate(0, -0.25 * u);
      ctx.rotate(-Math.PI / 2 * 0.92);
      ctx.translate(0.2 * u, 0);
    }
    const sh = p.shiver * Math.sin(p.t * 60) * 0.012 * u;
    const breath = Math.sin(p.t * 2.2) * 0.012 * u;
    const step = p.moving ? Math.sin(p.walk) : 0;
    const bob = p.moving ? -Math.abs(Math.cos(p.walk)) * 0.045 * u : 0;
    let lean = p.moving ? 0.06 : 0;
    const a = p.action, at = p.actionT;
    // 动作曲线：蓄力 → 挥下
    const swing = a === 'chop' || a === 'mine' || a === 'attack' ? (at < 0.45 ? -(at / 0.45) : -1 + Math.min(1, (at - 0.45) / 0.2) * 2.2) : 0;
    if (a === 'hurt') lean = -0.18 * Math.sin(at * Math.PI);
    if (a === 'pickup') lean = 0.35 * Math.sin(at * Math.PI);
    const bodyY = bob + breath * 0.3 + (a === 'pickup' ? Math.sin(at * Math.PI) * 0.18 * u : 0);

    if (!p.dead) contactShadow(ctx, 0, 0, 0.42 * u, 0.12 * u, 0.55);
    ctx.translate(sh, 0);

    const side = p.facing === 'side';
    const back = p.facing === 'up';
    // ---- 腿 ----
    const legs = () => {
      for (const s of [-1, 1]) {
        let hipX = s * 0.08 * u, footX = s * 0.1 * u, footY = 0;
        if (side) {
          hipX = s * 0.02 * u;
          footX = (step * s) * 0.2 * u;
          footY = -Math.max(0, step * s) * 0.08 * u;
        } else {
          footY = -Math.max(0, step * s) * 0.09 * u;
          footX += step * s * 0.02 * u;
        }
        if (p.shiver > 0.3 && !p.moving) footX *= 0.6;
        const hipY = -0.46 * u + bodyY;
        const kneeX = (hipX + footX) / 2 + (side ? 0.04 * u : 0), kneeY = (hipY + footY) / 2 - (side ? Math.max(0, step * s) * 0.03 * u : 0);
        const col = side && s < 0 ? PAL.ink : PAL.ink2;
        brush(ctx, [[hipX, hipY], [kneeX, kneeY], [footX, footY - 0.04 * u]], 0.085 * u, col, { taper: [1, 0.85], smooth: false });
        // 绑腿
        for (let k = 0; k < 3; k++) {
          const t = 0.45 + k * 0.15, x = hipX + (footX - hipX) * t, y = hipY + (footY - hipY) * t;
          brush(ctx, [[x - 0.045 * u, y], [x + 0.045 * u, y - 2]], 2.2, PAL.boneShade, {});
        }
        // 草鞋
        const shoe = blobPath(footX + (side ? 0.04 * u : 0), footY - 0.025 * u, side ? 0.085 * u : 0.06 * u, 0.035 * u, 0.15, r, 10);
        ctx.fillStyle = PAL.ochreDeep; ctx.fill(shoe);
      }
    };

    // ---- 背囊 ----
    const backpack = (front: boolean) => {
      if (!p.back) return;
      const bx = side ? -0.22 * u : 0, by = -0.78 * u + bodyY;
      const pack = blobPath(bx, by, (side ? 0.15 : 0.24) * u, 0.24 * u, 0.12, r, 14);
      shadeFill(ctx, pack, bx - 0.2 * u, by - 0.2 * u, bx + 0.2 * u, by + 0.2 * u, [[0, PAL.ochreLight], [1, PAL.ochreDeep]]);
      hatch(ctx, pack, { x: bx - 0.3 * u, y: by - 0.3 * u, w: 0.6 * u, h: 0.6 * u }, { r, gap: 3, angle: 1.1, alpha: 0.5 });
      if (front) {
        brush(ctx, [[bx - 0.18 * u, by - 0.05 * u], [bx + 0.18 * u, by - 0.07 * u]], 4, PAL.bark, { taper: [1, 1] });
        ctx.fillStyle = PAL.bone; ctx.beginPath(); ctx.arc(bx, by - 0.06 * u, 3, 0, 6.28); ctx.fill();
      }
    };

    // ---- 围巾尾 ----
    const scarfTail = () => {
      const nx = side ? -1 : (back ? 0.3 : -0.6);
      const base: Pt = [side ? -0.05 * u : 0.08 * u, -1.0 * u + bodyY];
      const pts: Pt[] = [base];
      const wind = p.moving ? 1 : 0.4;
      for (let i = 1; i <= 5; i++) {
        const t = i / 5;
        pts.push([base[0] + nx * t * (0.3 + wind * 0.14) * u, base[1] + t * (0.35 - wind * 0.2) * u + Math.sin(p.t * 7 - i * 0.9) * (0.03 + wind * 0.03) * u * t]);
      }
      brush(ctx, pts, 0.13 * u, PAL.blood, { taper: [1, 0.35], jitter: 0.15 });
      brush(ctx, pts.map(([x, y]) => [x, y - 3] as Pt), 0.03 * u, PAL.bloodLight, { taper: [0.8, 0.3], alpha: 0.8 });
      // 流苏
      const e = pts[pts.length - 1];
      for (let k = -1; k <= 1; k++) brush(ctx, [e, [e[0] + nx * 0.06 * u, e[1] + 0.05 * u + k * 4]], 2, PAL.bloodDeep, {});
    };

    // ---- 手臂（含持物） ----
    const arm = (s: number, front: boolean) => {
      const shX = side ? 0.02 * u : s * 0.17 * u, shY = -0.95 * u + bodyY + breath;
      let ang: number; // 0 = 垂下, 正向前
      let elbowBend = 0.3;
      if (side) ang = (p.moving ? step * s * 0.6 : 0.1) + lean;
      else ang = p.moving ? step * s * 0.25 : 0.05;
      const isTool = s === 1;
      if (isTool && (a === 'chop' || a === 'mine' || a === 'attack')) { ang = 0.6 + swing * -1.9; elbowBend = 0.15; }
      if (isTool && a === 'eat') { ang = 2.2 * Math.sin(Math.min(1, at * 2) * Math.PI * 0.5); elbowBend = 1.6 * Math.sin(at * Math.PI); }
      if (a === 'pickup') { ang = 0.9 * Math.sin(at * Math.PI); }
      if (a === 'craft') { ang = 0.9 + Math.sin(at * 30) * 0.15; elbowBend = 0.9; }
      if (p.shiver > 0.3 && !p.moving && a === 'none') { ang = 0.4; elbowBend = 2.0; }
      if (p.held === 'torch' || p.held === 'lantern') if (isTool && a === 'none') { ang = Math.max(ang, 0.55); elbowBend = 0.9; }
      const dirX = side ? 1 : s * 0.35;
      const len1 = 0.25 * u, len2 = 0.24 * u;
      const ex = shX + Math.sin(ang) * len1 * dirX + (side ? 0 : s * 0.04 * u), ey = shY + Math.cos(ang) * len1;
      const a2 = ang + elbowBend;
      const hx = ex + Math.sin(a2) * len2 * dirX, hy = ey + Math.cos(a2) * len2;
      if (isTool) this.hand = { x: (p.flip ? -hx : hx) / u, y: -hy / u };
      // 持物
      const drawHeld = () => {
        if (!isTool || !p.held || p.held === 'none') return;
        const spr = itemSprite(p.held);
        ctx.save();
        ctx.translate(hx, hy);
        let rot = (side ? a2 : a2 * s * 0.5) - Math.PI * 0.55;
        if (!side && a === 'none' && !p.moving) rot = -0.4;
        ctx.rotate(rot + Math.PI / 2 * 0.25);
        const sz = (p.held === 'spear' || p.held === 'spear2' ? 1.0 : 0.72) * u;
        ctx.drawImage(spr.canvas, -sz * 0.28, -sz * 0.78, sz, sz);
        ctx.restore();
      };
      if (!front) drawHeld();
      const col = front ? PAL.ink2 : PAL.ink;
      brush(ctx, [[shX, shY], [ex, ey], [hx, hy]], 0.1 * u, col, { taper: [1, 0.75], smooth: false });
      if (front) brush(ctx, [[shX - 2, shY], [ex - 2, ey]], 0.025 * u, PAL.shale, { alpha: 0.6 });
      ctx.fillStyle = PAL.bone; ctx.beginPath(); ctx.arc(hx, hy, 0.045 * u, 0, 6.28); ctx.fill();
      if (front) drawHeld();
    };

    // ---- 外衣 ----
    const coat = () => {
      const top = -1.05 * u + bodyY + breath, hem = -0.32 * u + bodyY;
      const sw = side ? 0.2 : 0.24, hw = side ? 0.28 : 0.34;
      const flap = p.moving ? Math.sin(p.walk * 2) * 0.02 * u : 0;
      const pts: Pt[] = [[-sw * 0.7 * u, top], [sw * 0.7 * u, top], [sw * u, top + 0.15 * u], [hw * u + flap, hem]];
      const teeth = 6;
      for (let i = 1; i < teeth; i++) {
        const x = hw * u - (i / teeth) * hw * 2 * u;
        pts.push([x + flap * 0.5, hem + (i % 2 ? 0.05 * u : -0.01 * u) + Math.sin(i * 3.1) * 0.02 * u]);
      }
      pts.push([-hw * u + flap, hem], [-sw * u, top + 0.15 * u]);
      const path = smoothPath(pts, true);
      const c0 = p.armor === 'armor_grass' ? PAL.ochre : p.armor === 'armor_wood' ? PAL.barkLight : PAL.ink3;
      const c1 = p.armor === 'armor_grass' ? PAL.ochreDeep : p.armor === 'armor_wood' ? PAL.barkDeep : PAL.ink;
      shadeFill(ctx, path, -hw * u, top, hw * u, hem, [[0, c0], [1, c1]]);
      if (p.armor === 'armor_wood') {
        ctx.save(); ctx.clip(path);
        for (let i = 0; i < 5; i++) brush(ctx, [[-0.4 * u + i * 0.18 * u, top], [-0.4 * u + i * 0.18 * u, hem + 0.05 * u]], 2, PAL.ink, { alpha: 0.7 });
        ctx.restore();
      } else if (p.armor === 'armor_grass') {
        gouges(ctx, path, { r, count: 30, area: (rr) => [(rr() - 0.5) * hw * 2 * u, top + rr() * (hem - top)], len: [6, 14], w: [1.5, 2.5], angle: () => Math.PI / 2, color: PAL.ochreLight, alpha: 0.8 });
      } else {
        gouges(ctx, path, { r, count: 22, area: (rr) => [(rr() - 0.6) * hw * 1.6 * u, top + 0.1 * u + rr() * (hem - top) * 0.85], len: [6, 16], w: [1, 2], angle: () => Math.PI / 2 + 0.15, color: PAL.shale, alpha: 0.65 });
      }
      hatch(ctx, path, { x: -hw * u, y: top, w: hw * 2 * u, h: hem - top + 0.1 * u }, { r, gap: 3, angle: 0.9, alpha: 0.6, mask: (x) => (x > 0.05 * u ? 1 : 0) });
      // 补丁
      if (!back && !p.armor) {
        const patch = blobPath(side ? 0.05 * u : -0.12 * u, -0.55 * u + bodyY, 0.07 * u, 0.06 * u, 0.2, r, 8, 0.4);
        ctx.fillStyle = PAL.boneShade; ctx.fill(patch);
        for (let k = 0; k < 4; k++) brush(ctx, [[(side ? 0.0 : -0.17) * u + k * 3.5, -0.6 * u + bodyY], [(side ? 0.0 : -0.17) * u + k * 3.5 + 1, -0.5 * u + bodyY]], 1, PAL.ink, {});
      }
      // 腰绳
      brush(ctx, [[-sw * 1.05 * u, -0.62 * u + bodyY], [0, -0.6 * u + bodyY], [sw * 1.05 * u, -0.63 * u + bodyY]], 4, PAL.ochreDeep, { taper: [1, 1] });
      rimLight(ctx, path, -4, 4, PAL.shaleLight, 0.55);
      // 围巾领
      const collar = smoothPath([[-0.2 * u, top - 0.02 * u], [0.2 * u, top - 0.02 * u], [0.18 * u, top + 0.09 * u], [-0.18 * u, top + 0.09 * u]], true);
      ctx.fillStyle = PAL.blood; ctx.fill(collar);
      hatch(ctx, collar, { x: -0.2 * u, y: top - 0.05 * u, w: 0.4 * u, h: 0.15 * u }, { r, gap: 2.5, alpha: 0.5, angle: 0.4 });
    };

    // ---- 头与斗笠 ----
    const head = () => {
      const hx = side ? 0.03 * u : 0, hy = -1.22 * u + bodyY + breath * 1.2;
      const tilt = (p.moving ? Math.sin(p.walk * 2) * 0.03 : 0) + (a === 'hurt' ? -0.2 * Math.sin(at * Math.PI) : 0);
      ctx.save(); ctx.translate(hx, hy); ctx.rotate(tilt);
      // 发
      const hair = blobPath(0, -0.03 * u, 0.2 * u, 0.17 * u, 0.25, r, 14);
      ctx.fillStyle = PAL.ink; ctx.fill(hair);
      if (!back) {
        const face = side
          ? smoothPath([[-0.12 * u, -0.1 * u], [0.12 * u, -0.12 * u], [0.19 * u, 0.0], [0.14 * u, 0.06 * u], [0.13 * u, 0.12 * u], [-0.02 * u, 0.15 * u], [-0.1 * u, 0.05 * u]], true)
          : blobPath(0, 0.02 * u, 0.165 * u, 0.15 * u, 0.06, r, 16);
        shadeFill(ctx, face, -0.15 * u, 0, 0.15 * u, 0, [[0, PAL.bone], [0.6, PAL.boneShade], [1, PAL.boneDeep]]);
        hatch(ctx, face, { x: -0.2 * u, y: -0.15 * u, w: 0.4 * u, h: 0.35 * u }, { r, gap: 2.4, w: 1, alpha: 0.45, mask: (x) => (x > 0.07 * u ? 1 : 0) });
        // 眼
        const blink = (p.t % 3.7) < 0.12 || a === 'hurt' ? 0.15 : 1;
        const wide = p.shiver > 0.3 ? 1.25 : 1;
        const eyes = side ? [[0.09 * u, 0.0]] : [[-0.065 * u, 0.0], [0.065 * u, 0.0]];
        for (const [ex, ey] of eyes) {
          ctx.fillStyle = PAL.ink;
          ctx.beginPath(); ctx.ellipse(ex, ey, 0.032 * u * wide, 0.045 * u * blink * wide, 0, 0, 6.28); ctx.fill();
          if (blink > 0.5) { ctx.fillStyle = PAL.paper; ctx.beginPath(); ctx.arc(ex - 2, ey - 3, 2.2, 0, 6.28); ctx.fill(); }
        }
        // 眉、口、腮红
        const worry = p.shiver > 0.3 || a === 'hurt' ? 1 : 0;
        for (const [ex] of eyes) brush(ctx, [[ex - 0.04 * u, -0.065 * u - worry * 3 * Math.sign(ex || 1)], [ex + 0.03 * u, -0.07 * u + worry * 3 * Math.sign(ex || 1)]], 2, PAL.ink, {});
        const mouthOpen = a === 'eat' ? Math.abs(Math.sin(at * 18)) * 4 : 0;
        if (mouthOpen > 1) { ctx.fillStyle = PAL.ink; ctx.beginPath(); ctx.ellipse(side ? 0.1 * u : 0, 0.08 * u, 3, mouthOpen, 0, 0, 6.28); ctx.fill(); }
        else brush(ctx, [[side ? 0.07 * u : -0.03 * u, 0.085 * u], [side ? 0.12 * u : 0.03 * u, 0.08 * u + worry * 2]], 1.6, PAL.ink, {});
        ctx.fillStyle = rgba(PAL.bloodLight, 0.35);
        for (const [ex] of eyes) { ctx.beginPath(); ctx.ellipse(ex + (side ? -0.03 * u : 0), 0.055 * u, 6, 3, 0, 0, 6.28); ctx.fill(); }
        // 额前碎发
        for (let k = 0; k < 4; k++) brush(ctx, [[(-0.12 + k * 0.07) * u + (side ? 0.04 * u : 0), -0.13 * u], [(-0.1 + k * 0.07) * u + (side ? 0.06 * u : 0), -0.05 * u]], 4, PAL.ink, { taper: [1, 0.05] });
      }
      // 斗笠
      const bw = 0.43 * u, by = -0.14 * u, peak = -0.5 * u;
      const brim = smoothPath([[-bw, by + 0.03 * u], [-bw * 0.6, by - 0.06 * u], [0, by - 0.1 * u], [bw * 0.6, by - 0.06 * u], [bw, by + 0.03 * u], [bw * 0.5, by + 0.07 * u], [0, by + 0.08 * u], [-bw * 0.5, by + 0.07 * u]], true);
      const cone = smoothPath([[-bw * 0.95, by + 0.02 * u], [-bw * 0.3, by - 0.2 * u], [(side ? 0.04 : 0) * u, peak], [bw * 0.3, by - 0.2 * u], [bw * 0.95, by + 0.02 * u], [0, by + 0.06 * u]], true);
      shadeFill(ctx, brim, -bw, 0, bw, 0, [[0, PAL.ochreLight], [1, PAL.ochreDeep]]);
      shadeFill(ctx, cone, -bw, by, bw * 0.8, by, [[0, PAL.ochreLight], [0.5, PAL.ochre], [1, PAL.ochreDeep]]);
      ctx.save(); ctx.clip(cone);
      for (let k = 0; k < 11; k++) {
        const x = -bw + (k / 10) * bw * 2;
        brush(ctx, [[(side ? 0.04 : 0) * u, peak], [x, by + 0.05 * u]], 1.4, PAL.ochreDeep, { alpha: 0.8 });
      }
      for (let k = 1; k < 4; k++) {
        const y = peak + (by - peak) * (k / 4) + 4;
        brush(ctx, [[-bw, y + 6], [0, y - 2], [bw, y + 6]], 1.2, PAL.ochreDeep, { alpha: 0.5 });
      }
      ctx.restore();
      hatch(ctx, cone, { x: -bw, y: peak, w: bw * 2, h: by - peak + 0.1 * u }, { r, gap: 2.8, alpha: 0.55, angle: 1.0, mask: (x) => (x > 0.08 * u ? 1 : 0) });
      rimLight(ctx, cone, 4, 4, PAL.paper, 0.6);
      // 斗笠缺口
      ctx.save(); ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath(); ctx.moveTo(bw * 0.62, by - 0.04 * u); ctx.lineTo(bw * 0.8, by - 0.03 * u); ctx.lineTo(bw * 0.72, by + 0.02 * u); ctx.closePath(); ctx.fill();
      ctx.restore();
      // 红绳
      brush(ctx, [[-bw * 0.4, by - 0.02 * u], [-bw * 0.42, by + 0.18 * u + Math.sin(p.t * 3) * 3]], 2, PAL.blood, {});
      ctx.fillStyle = PAL.blood; ctx.beginPath(); ctx.arc(-bw * 0.42, by + 0.2 * u, 3.5, 0, 6.28); ctx.fill();
      // 花冠
      if (p.head === 'garland') {
        for (let k = 0; k < 7; k++) {
          const x = -bw * 0.7 + k * bw * 0.23, y = by - 0.07 * u + Math.abs(k - 3) * 1.2;
          const col = [PAL.bone, PAL.bloodLight, PAL.copperLight][k % 3];
          for (let j = 0; j < 5; j++) { const b = j * 1.26; ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(x + Math.cos(b) * 3.5, y + Math.sin(b) * 3, 3.5, 2.2, b, 0, 6.28); ctx.fill(); }
          ctx.fillStyle = PAL.ember; ctx.beginPath(); ctx.arc(x, y, 1.6, 0, 6.28); ctx.fill();
        }
      }
      ctx.restore();
    };

    // 绘制顺序
    if (back) {
      arm(1, false); arm(-1, false);
      legs(); coat(); scarfTail(); backpack(true); head();
    } else if (side) {
      if (p.back) backpack(false);
      arm(-1, false); scarfTail(); legs(); coat(); head(); arm(1, true);
    } else {
      scarfTail(); if (p.back) backpack(false);
      legs(); coat(); arm(-1, true); arm(1, true); head();
    }
    void mix;
    // 合成：描边 + 纸纹
    const out = inkOutline(this.work, 2.4, PAL.ink, 3);
    applyGrain(out.getContext('2d')!, 0.16);
    const octx = this.canvas.getContext('2d')!;
    octx.clearRect(0, 0, W, H);
    octx.drawImage(out, 0, 0);
  }
}
