// 主角「行者」分层骨骼动画（剪纸木偶式）
// 部件来自资源包 rig_*.png；每帧用正向运动学 + 两段 IK 摆出姿势，再按层级画进玩家画布。
// 坐标：画布“立绘空间”，原点为落脚点，x 向右（= 身后，因为立绘朝左），y 向下；前进方向为 -x。
// 角度：0 = 竖直向下，正值 = 向前（-x）摆。
import type { PlayerPose } from './player';
import type { ArtPack } from './pack';

type V = { x: number; y: number };
interface Part { img: HTMLImageElement; j: V; pts: Record<string, V> }
interface Tool { img: HTMLImageElement; handle: V; head: V; len: number }
interface RigData { parts: Record<string, Record<string, unknown>>; tools: Record<string, { icon: string; handle: [number, number]; head: [number, number] }> }

const TAU = Math.PI * 2;
const dir = (r: number): V => ({ x: -Math.sin(r), y: Math.cos(r) });
const angOf = (dx: number, dy: number) => Math.atan2(-dx, dy);
const add = (a: V, b: V): V => ({ x: a.x + b.x, y: a.y + b.y });
const rot = (v: V, r: number): V => { const c = Math.cos(r), s = Math.sin(r); return { x: v.x * c - v.y * s, y: v.x * s + v.y * c }; };
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const smooth = (t: number) => t * t * (3 - 2 * t);
const easeIn = (t: number) => t * t * t;
const easeOut = (t: number) => 1 - (1 - t) ** 3;
/** 世界长度（单位）→ 画布像素 */
const PPU = 110;
const TOOL_LEN: Record<string, number> = { axe: 1.0, pickaxe: 1.05, spear: 2.0, spear2: 2.0, torch: 0.85, lantern: 0.62 };

/** 关键帧：t ∈ [0,1]，值为数字数组；ease 作用于进入该帧的这一段 */
type Key = { t: number; v: number[]; ease?: (t: number) => number };
function sample(keys: Key[], t: number): number[] {
  if (t <= keys[0].t) return keys[0].v;
  for (let i = 1; i < keys.length; i++) {
    const b = keys[i];
    if (t <= b.t) {
      const a = keys[i - 1], u = (b.ease ?? smooth)((t - a.t) / (b.t - a.t));
      return a.v.map((x, k) => lerp(x, b.v[k], u));
    }
  }
  return keys[keys.length - 1].v;
}

// 双手持械动作的关键帧：[近手x, 近手y, 武器方向(弧度, 画布坐标 atan2), 躯干前倾, 骨盆下沉, 前脚x, 后脚x, 远手沿柄距离(像素)]
// 方向：-π/2 = 朝上，π = 朝前(左)，-π/4 = 朝后上，3π/4 = 朝前下
const CHOP: Key[] = [
  { t: 0.0, v: [-16, -166, -2.0, 0.04, 2, -20, 18, 34] },
  { t: 0.42, v: [18, -246, -0.32, -0.16, -2, -22, 20, 30], ease: easeOut },                    // 蓄力：高举过头、后仰
  { t: 0.55, v: [-40, -150, 2.5, 0.26, 10, -26, 22, 30], ease: easeIn },                     // 劈下：快速、前倾下沉
  { t: 0.72, v: [-34, -128, 2.2, 0.3, 12, -26, 22, 30], ease: easeOut },                     // 随势：继续下压
  { t: 1.0, v: [-16, -166, -2.0, 0.04, 2, -20, 18, 34], ease: smooth },                      // 收势
];
const THRUST: Key[] = [
  { t: 0.0, v: [-20, -160, Math.PI - 0.3, 0.02, 3, -18, 20, 70] },
  { t: 0.32, v: [12, -162, Math.PI - 0.2, -0.12, 5, -16, 22, 70], ease: easeOut },           // 后撤蓄力
  { t: 0.46, v: [-64, -166, Math.PI - 0.08, 0.24, 9, -36, 24, 70], ease: easeIn },           // 突刺：前脚跨出
  { t: 0.64, v: [-60, -164, Math.PI - 0.1, 0.22, 9, -36, 24, 70], ease: easeOut },           // 停顿
  { t: 1.0, v: [-20, -160, Math.PI - 0.3, 0.02, 3, -18, 20, 70], ease: smooth },
];
const SWING: Key[] = [   // 非长矛的攻击：斜劈
  { t: 0.0, v: [-16, -166, -2.0, 0.04, 2, -20, 18, 34] },
  { t: 0.3, v: [18, -238, -0.7, -0.12, 0, -22, 20, 30], ease: easeOut },
  { t: 0.45, v: [-44, -150, 2.7, 0.24, 9, -28, 22, 30], ease: easeIn },
  { t: 0.66, v: [-32, -130, 2.25, 0.26, 10, -28, 22, 30], ease: easeOut },
  { t: 1.0, v: [-16, -166, -2.0, 0.04, 2, -20, 18, 34], ease: smooth },
];
const PUNCH: Key[] = [ // 空手：[近手x, 近手y, 前倾, 下沉, 前脚, 后脚]
  { t: 0, v: [-18, -170, 0.04, 3, -18, 18] },
  { t: 0.3, v: [2, -176, -0.1, 5, -16, 20], ease: easeOut },
  { t: 0.46, v: [-62, -180, 0.22, 8, -32, 22], ease: easeIn },
  { t: 0.66, v: [-56, -178, 0.2, 8, -32, 22], ease: easeOut },
  { t: 1, v: [-18, -170, 0.04, 3, -18, 18], ease: smooth },
];

/** 各关节的平滑状态 */
interface Joints { [k: string]: number }

export class HeroRig {
  canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  /** 火把（手持光源）位置：世界单位，相对落脚点；x 为朝前距离。每帧更新 */
  hand = { x: 0.38, y: 1.6 };
  pad = 14;
  private P: Record<string, Part> = {};
  private T: Record<string, Tool> = {};
  private L = { th: 0, sh: 0, up: 0, fo: 0, upF: 0, foF: 0, ank: 0 };
  private cur: Joints = {};
  private lastT = -1;
  private hipH = 0;
  private strip = document.createElement('canvas');
  /** 地面速度在画面中的方向（由游戏传入）；默认横向 */
  private vel = { x: -1, y: 0, s: 0 };

  static usable(pack: ArtPack | null): boolean {
    const r = (pack as unknown as { rig?: RigData } | null)?.rig;
    return !!pack && !!r && ['head', 'hat', 'torso', 'skirt', 'scarf', 'upperN', 'foreN', 'upperF', 'foreF', 'thighN', 'shinN', 'thighF', 'shinF'].every((k) => pack.images.has('rig_' + k));
  }

  constructor(pack: ArtPack) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = 460; this.canvas.height = 420; // 4.2 × 3.8 单位：容纳长矛突刺与高举斧头
    this.ctx = this.canvas.getContext('2d')!;
    const rig = (pack as unknown as { rig: RigData }).rig;
    for (const [n, d] of Object.entries(rig.parts)) {
      const pts: Record<string, V> = {};
      for (const [k, v] of Object.entries(d)) if (Array.isArray(v)) pts[k] = { x: v[0] as number, y: v[1] as number };
      this.P[n] = { img: pack.images.get('rig_' + n)!, j: pts.joint, pts };
    }
    for (const [id, t] of Object.entries(rig.tools ?? {})) {
      const img = pack.images.get(t.icon);
      if (!img) continue;
      const handle = { x: t.handle[0], y: t.handle[1] }, head = { x: t.head[0], y: t.head[1] };
      this.T[id] = { img, handle, head, len: Math.hypot(head.x - handle.x, head.y - handle.y) };
    }
    const seg = (p: Part, a: string, b = 'joint') => Math.hypot(p.pts[a].x - p.pts[b].x, p.pts[a].y - p.pts[b].y);
    this.L.th = (seg(this.P.thighN, 'knee') + seg(this.P.thighF, 'knee')) / 2;
    this.L.sh = (seg(this.P.shinN, 'ankle') + seg(this.P.shinF, 'ankle')) / 2;
    this.L.up = seg(this.P.upperN, 'elbow'); this.L.fo = seg(this.P.foreN, 'grip');
    this.L.upF = seg(this.P.upperF, 'elbow'); this.L.foF = seg(this.P.foreF, 'grip');
    this.L.ank = this.P.shinN.pts.sole.y - this.P.shinN.pts.ankle.y;
    this.hipH = (this.L.th + this.L.sh) * 0.965 + this.L.ank;
  }

  /** 游戏传入角色在画面中的移动方向（右为 +x、朝镜头为 +y）与速率（单位/秒） */
  setVelocity(sx: number, sy: number, speed: number) {
    const l = Math.hypot(sx, sy);
    if (l > 1e-3) { this.vel.x = sx / l; this.vel.y = sy / l; }
    this.vel.s = speed;
  }

  // —— 绘制辅助 ——
  /** 调试：隐藏部件（开发测试页用） */
  static hide = new Set<string>();
  private part(name: string, at: V, r: number) {
    if (HeroRig.hide.has(name)) return;
    const p = this.P[name], c = this.ctx;
    c.save(); c.translate(at.x, at.y); c.rotate(r); c.drawImage(p.img, -p.j.x, -p.j.y); c.restore();
  }
  /** 部件内“关节→某点”的固有角度与向量 */
  private vec(name: string, pt: string): V { const p = this.P[name]; return { x: p.pts[pt].x - p.j.x, y: p.pts[pt].y - p.j.y }; }
  private segAng(name: string, pt: string) { const v = this.vec(name, pt); return angOf(v.x, v.y); }
  /** 以条带形变绘制（布料：围巾、下摆）：offset(row 0..1) → x 偏移 */
  private warped(name: string, at: V, r: number, off: (u: number) => number) {
    const p = this.P[name], c = this.ctx, w = p.img.naturalWidth, h = p.img.naturalHeight;
    c.save(); c.translate(at.x, at.y); c.rotate(r);
    const step = 2;
    for (let y = 0; y < h; y += step) {
      const u = y / h, dx = off(u);
      c.drawImage(p.img, 0, y, w, step + 0.6, -p.j.x + dx, -p.j.y + y, w, step + 0.6);
    }
    c.restore();
  }
  /** 两段 IK：返回两段的绝对角度；bend = +1 关节向前（膝），-1 向后（肘） */
  private ik(a: V, t: V, l1: number, l2: number, bend: number): [number, number, V] {
    let dx = t.x - a.x, dy = t.y - a.y;
    let d = Math.hypot(dx, dy);
    const dmax = l1 + l2 - 0.5, dmin = Math.abs(l1 - l2) + 0.5;
    if (d > dmax) { dx *= dmax / d; dy *= dmax / d; d = dmax; }
    if (d < dmin) { const k = dmin / Math.max(d, 1e-3); dx *= k; dy *= k; d = dmin; }
    const base = angOf(dx, dy);
    const c = Math.max(-1, Math.min(1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d)));
    const r1 = base + bend * Math.acos(c);
    const k = add(a, { x: dir(r1).x * l1, y: dir(r1).y * l1 });
    const r2 = angOf(a.x + dx - k.x, a.y + dy - k.y);
    return [r1, r2, k];
  }
  private tool(id: string | null): Tool | null { return id ? this.T[id] ?? null : null; }
  /** 画工具：grip 为手在柄上的位置（0=柄端，1=头端），ang 为柄端→头端在画布中的方向 */
  private drawTool(t: Tool, id: string, hand: V, ang: number, grip: number, smear = 0) {
    const c = this.ctx, s = (TOOL_LEN[id] ?? 1) * PPU / t.len;
    const a0 = Math.atan2(t.head.y - t.handle.y, t.head.x - t.handle.x);
    const g = { x: lerp(t.handle.x, t.head.x, grip), y: lerp(t.handle.y, t.head.y, grip) };
    const draw = (an: number, alpha: number) => {
      c.save(); c.globalAlpha = alpha; c.translate(hand.x, hand.y); c.rotate(an - a0); c.scale(s, s); c.drawImage(t.img, -g.x, -g.y); c.restore();
    };
    // 挥击拖影：沿来路叠几层半透明残影
    if (smear > 0.02) for (let i = 3; i >= 1; i--) draw(ang - smear * i * 0.22, 0.12 * (4 - i) / 3);
    draw(ang, 1);
  }
  /** 工具上某个比例位置的画布坐标 */
  private toolPoint(t: Tool, id: string, hand: V, ang: number, grip: number, at: number): V {
    const len = (TOOL_LEN[id] ?? 1) * PPU;
    return { x: hand.x + Math.cos(ang) * (at - grip) * len, y: hand.y + Math.sin(ang) * (at - grip) * len };
  }

  draw(p: PlayerPose) {
    const c = this.ctx, cv = this.canvas;
    const dt = this.lastT < 0 ? 1 / 60 : Math.max(0, Math.min(0.1, p.t - this.lastT));
    this.lastT = p.t;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, cv.width, cv.height);
    c.translate(cv.width / 2, cv.height - this.pad);
    // 立绘朝左；朝右时整体镜像
    if (!p.flip) c.scale(-1, 1);
    if (p.dead) { c.translate(0, -24); c.rotate(-Math.PI / 2 * 0.92); c.translate(30, 0); }

    const t = p.t, a = p.action, at = p.actionT;
    const held = p.held;
    const tool = this.tool(held);
    const twoHand = held === 'axe' || held === 'pickaxe' || held === 'spear' || held === 'spear2';
    const L = this.L;
    const tgt: Joints = {};

    // 画面中的移动方向（立绘空间）：朝右移动且未镜像时，立绘空间里是 -x
    const vArt = { x: (p.flip ? 1 : -1) * this.vel.x, y: this.vel.y * 0.55 };
    const lateral = Math.min(1, Math.abs(this.vel.x) * 1.15 + 0.12);
    const moving = p.moving && !a.match(/chop|mine|attack/);

    // ———— 基础：站立 / 行走 ————
    let pelvis: V = { x: 0, y: -this.hipH };
    let lean = 0, footN: V, footF: V;
    let armN = 0, armF = 0, elbN = 0.12, elbF = 0.12, headTilt = 0, hatLag = 0, twist = 0;
    let scarfTrail = 0, skirtSway = 0;
    if (moving) {
      // 步态：周期长度 2.2 单位，支撑相 46%（轻快的赶路小跑，带腾空），脚掌在支撑相严格随地面后移
      const CYC = 2.2, BETA = 0.46;
      const dist = p.walk / 2.1;               // game.walkPhase 每单位距离 +2.1
      const ph = (dist / CYC) % 1;
      const stride = BETA * CYC * PPU;         // 支撑相内脚相对身体移动的距离（像素）
      const leg = (q: number, side: number): V => {
        q = ((q % 1) + 1) % 1;
        let s: number, lift = 0;
        if (q < BETA) { const u = q / BETA; s = 0.5 - u; }        // 前 → 后（贴地）
        else {
          const u = (q - BETA) / (1 - BETA);
          s = -0.5 + smooth(u);                                    // 后 → 前（腾挪）
          lift = Math.sin(Math.PI * u) ** 0.9 * 22 + Math.sin(Math.PI * Math.min(1, u * 1.6)) * 6;
        }
        // s>0 在前：沿移动方向
        const fx = side + vArt.x * s * stride * lateral, fy = vArt.y * s * stride * 0.6;
        return { x: fx, y: -L.ank + fy - lift };
      };
      footN = leg(ph, -5); footF = leg(ph + 0.5, 7);
      // 重心：支撑中段最低、腾空最高（每周期两次）
      const bounce = Math.cos(TAU * (2 * ph - BETA)) ;
      pelvis = { x: -3 * lateral, y: -this.hipH + 4 + bounce * 5 };
      lean = 0.09 * lateral;
      // 手臂反向摆动（近臂与近腿相反），向前摆时屈肘更多
      const sw = Math.cos(TAU * ph);
      armN = -0.5 * sw * lateral; armF = 0.5 * sw * lateral;
      elbN = 0.25 + Math.max(0, armN) * 0.9; elbF = 0.25 + Math.max(0, armF) * 0.9;
      twist = 0.035 * sw * lateral;                 // 躯干随步伐轻微扭转（横向缩放模拟）
      headTilt = -0.05 * lean + 0.03 * Math.sin(TAU * 2 * ph - 0.9);   // 头部滞后
      hatLag = 1.6 * Math.sin(TAU * 2 * ph - 1.3);
      scarfTrail = 9 + 4 * Math.sin(TAU * 2 * ph);
      skirtSway = 0;
    } else {
      // 待机：呼吸 + 重心左右缓移（双脚不动，膝盖由 IK 自然屈伸）
      const shift = Math.sin(t * 0.55) * 3.2 + Math.sin(t * 1.37) * 0.8;
      const breath = Math.sin(t * 2.0);
      footN = { x: -10, y: -L.ank }; footF = { x: 11, y: -L.ank };
      pelvis = { x: shift, y: -this.hipH + 1.5 + Math.abs(shift) * 0.35 - breath * 0.6 };
      lean = 0.015 + breath * 0.008;
      armN = 0.04 + Math.sin(t * 1.1) * 0.025; armF = -0.03 + Math.sin(t * 1.1 + 0.8) * 0.025;
      elbN = 0.14 + breath * 0.02; elbF = 0.12;
      headTilt = Math.sin(t * 0.37) * 0.035 - shift * 0.004;
      hatLag = breath * 0.5;
      scarfTrail = 2 + Math.sin(t * 0.9) * 1.5;
      twist = shift * 0.004;
    }

    // ———— 动作 ————
    let handN: V | null = null, handF: V | null = null, toolAng = 0, toolGrip = 0.22, smear = 0;
    let farOnTool = -1;   // 远手在工具上的位置（比例），<0 表示不握
    if ((a === 'chop' || a === 'mine') || (a === 'attack')) {
      const spear = held === 'spear' || held === 'spear2';
      if (a === 'attack' && !tool) {
        const v = sample(PUNCH, at);
        handN = { x: v[0], y: v[1] }; lean = v[2]; pelvis = { x: 0, y: -this.hipH + v[3] };
        footN = { x: v[4], y: -L.ank }; footF = { x: v[5], y: -L.ank };
        armF = -0.35; elbF = 1.2;
      } else {
        const keys = a === 'attack' ? (spear ? THRUST : SWING) : CHOP;
        const v = sample(keys, at);
        handN = { x: v[0], y: v[1] }; toolAng = v[2]; lean = v[3]; pelvis = { x: lean * 10, y: -this.hipH + v[4] };
        footN = { x: v[5], y: -L.ank }; footF = { x: v[6], y: -L.ank };
        toolGrip = spear ? 0.5 : 0.3; farOnTool = spear ? 0.18 : 0.08;
        // 打击瞬间的拖影强度（角速度）
        const v2 = sample(keys, Math.min(1, at + 0.02));
        smear = Math.abs(v2[2] - v[2]) * 2.2;
      }
      headTilt = lean * 0.35; hatLag = -lean * 3;
      scarfTrail = 4 + Math.abs(lean) * 20;
      twist = lean * 0.08;
    } else if (a === 'pickup' || a === 'eat' || a === 'craft') {
      const k = Math.sin(Math.PI * at);
      if (a === 'pickup') {
        pelvis.y += 22 * k; lean = 0.38 * k; armN = 0.55 * k; elbN = 0.15 + 0.4 * k; footN = { x: -16, y: -L.ank }; footF = { x: 12, y: -L.ank };
      } else if (a === 'eat') {
        armN = 0.9 * k; elbN = 0.2 + 2.0 * k; headTilt = -0.06 * k; lean = 0.04;
      } else {
        lean = 0.14 * k; pelvis.y += 6 * k; armN = 0.7 + 0.15 * Math.sin(at * 30); elbN = 1.1; armF = 0.5; elbF = 1.0;
      }
    } else if (a === 'hurt') {
      const k = Math.sin(Math.PI * at);
      lean = -0.2 * k; headTilt = -0.15 * k; armN = 0.4 * k; armF = 0.5 * k; elbN = elbF = 0.6 * k; pelvis.x += 4 * k;
    }
    // 持械（非动作时）
    if (!handN && tool && !p.dead) {
      if (held === 'torch') { armN = 0.55 + (moving ? -armN * 0.15 : 0); elbN = 1.25; }
      else if (held === 'lantern') { armN = 0.35 + armN * 0.3; elbN = 0.9; }
      else if (held === 'spear' || held === 'spear2') { armN = 0.18 + armN * 0.35; elbN = 1.25; }
      else { armN = armN * 0.6 + 0.05; elbN = 0.45 + elbN * 0.5; }
    }
    // 瑟缩
    const shiv = p.shiver > 0.05 ? p.shiver * Math.sin(t * 61) * 1.1 : 0;
    pelvis.x += shiv;
    if (p.shiver > 0.3) { armN = Math.max(armN, 0.35 * p.shiver); elbN = Math.max(elbN, 1.6 * p.shiver); armF = Math.max(armF, 0.25 * p.shiver); elbF = Math.max(elbF, 1.5 * p.shiver); headTilt += 0.06 * p.shiver; }

    // ———— 平滑（过渡）————
    Object.assign(tgt, { px: pelvis.x, py: pelvis.y, lean, armN, armF, elbN, elbF, headTilt, hatLag, twist, scarfTrail, fnx: footN.x, fny: footN.y, ffx: footF.x, ffy: footF.y });
    const fast = moving || !!handN;
    const kRate = fast ? 40 : 11;
    const kk = 1 - Math.exp(-dt * kRate);
    for (const [key, val] of Object.entries(tgt)) {
      const cur = this.cur[key];
      this.cur[key] = cur === undefined ? val : cur + (val - cur) * kk;
    }
    // 行走时脚必须严格贴地：脚的位置不做平滑（只在开始/停止的短暂过渡中混合）
    const J = this.cur;
    if (moving) { J.fnx = footN.x; J.fny = footN.y; J.ffx = footF.x; J.ffy = footF.y; }
    pelvis = { x: J.px, y: J.py };
    footN = { x: J.fnx, y: J.fny }; footF = { x: J.ffx, y: J.ffy };

    // ———— 求解 ————
    const hipN = add(pelvis, { x: -4, y: 0 }), hipF = add(pelvis, { x: 6, y: -2 });
    const legSolve = (hip: V, foot: V, th: string, sh: string) => {
      const l1 = Math.hypot(this.vec(th, 'knee').x, this.vec(th, 'knee').y), l2 = Math.hypot(this.vec(sh, 'ankle').x, this.vec(sh, 'ankle').y);
      const [r1, r2, k] = this.ik(hip, foot, l1, l2, 1);
      return { r1: r1 - this.segAng(th, 'knee'), r2: r2 - this.segAng(sh, 'ankle'), knee: k };
    };
    const lgN = legSolve(hipN, footN, 'thighN', 'shinN');
    const lgF = legSolve(hipF, footF, 'thighF', 'shinF');
    const waist = add(pelvis, { x: 1, y: -16 });
    const torsoR = J.lean;
    const tP = (pt: string) => add(waist, rot(this.vec('torso', pt), torsoR));
    const shN = tP('shN'), shF = tP('shF'), neck = tP('neck');

    // 手臂：有目标手位时 IK（肘向后），否则正向运动学（上臂角 + 屈肘角）
    type ArmS = { up: number; fo: number; elbow: V; hand: V };
    const solveArm = (sh: V, hand: V | null, ang: number, elb: number, up: string, fo: string, lu: number, lf: number): ArmS => {
      if (hand) {
        const [r1, r2, e] = this.ik(sh, hand, lu, lf, -1);
        return { up: r1 - this.segAng(up, 'elbow'), fo: r2 - this.segAng(fo, 'grip'), elbow: e, hand: add(e, { x: dir(r2).x * lf, y: dir(r2).y * lf }) };
      }
      const r1 = ang + torsoR * 0.6, r2 = r1 + elb;
      const e = add(sh, { x: dir(r1).x * lu, y: dir(r1).y * lu });
      return { up: r1 - this.segAng(up, 'elbow'), fo: r2 - this.segAng(fo, 'grip'), elbow: e, hand: add(e, { x: dir(r2).x * lf, y: dir(r2).y * lf }) };
    };
    const armSN = solveArm(shN, handN, J.armN, J.elbN, 'upperN', 'foreN', L.up, L.fo);
    // 远手：双手握柄时 IK 到柄上
    let toolHand: V | null = null;
    if (tool && handN) {
      toolHand = armSN.hand;
      if (farOnTool >= 0 && twoHand) handF = this.toolPoint(tool, held!, toolHand, toolAng, toolGrip, farOnTool);
    }
    const armSF = solveArm(shF, handF, J.armF, J.elbF, 'upperF', 'foreF', L.upF, L.foF);
    // 非动作时手持工具的方向
    if (tool && !handN) {
      toolHand = armSN.hand;
      const foAbs = armSN.fo + this.segAng('foreN', 'grip');
      if (held === 'torch') { toolAng = -Math.PI / 2 - 0.25 + (foAbs - 1.8) * 0.3; toolGrip = 0.28; }
      else if (held === 'lantern') { toolAng = Math.PI / 2; toolGrip = 0.0; }
      else if (held === 'spear' || held === 'spear2') { toolAng = -Math.PI / 2 - 0.12 - J.armN * 0.25; toolGrip = 0.45; }
      else { const d = dir(foAbs); toolAng = Math.atan2(-d.y, -d.x) - 0.35; toolGrip = 0.74; }  // 斧/镐：握在斧头下方，柄自然垂在身侧
    }
    // 火把光源位置（世界单位，x 朝前）
    if (tool && toolHand && (held === 'torch' || held === 'lantern')) {
      const tip = held === 'lantern' ? toolHand : this.toolPoint(tool, held, toolHand, toolAng, toolGrip, 0.85);
      this.hand.x = -tip.x / PPU; this.hand.y = -tip.y / PPU - 0.45;
    }

    // ———— 绘制（由后到前）————
    const t2 = t;
    const flutter = (amp: number, freq: number, k: number) => (u: number) => Math.sin(t2 * freq - u * k) * amp * u ** 1.4;
    // 围巾尾（身后），随速度向后飘
    const scarfAt = add(neck, rot({ x: 12, y: 4 }, torsoR));
    const sf = flutter(moving ? 4.5 : 1.6, moving ? 9 : 2.2, 5);
    this.warped('scarf', scarfAt, torsoR * 0.5 - (J.scarfTrail * 0.012), (u) => u ** 1.3 * J.scarfTrail + sf(u));
    // 工具在身后（蓄力时斧头在脑后）
    const toolBehind = !!(tool && toolHand && handN && Math.cos(toolAng) > 0.25 && Math.sin(toolAng) < 0);
    // 远侧手臂
    this.part('upperF', shF, armSF.up);
    this.part('foreF', armSF.elbow, armSF.fo);
    if (toolBehind) this.drawTool(tool!, held!, toolHand!, toolAng, toolGrip, smear);
    // 腿
    this.part('shinF', lgF.knee, lgF.r2); this.part('thighF', hipF, lgF.r1);
    this.part('shinN', lgN.knee, lgN.r2); this.part('thighN', hipN, lgN.r1);
    // 下摆：随双膝前后摆动、行走时向后拖
    const kneeMid = (lgN.knee.x + lgF.knee.x) / 2 - pelvis.x;
    const skF = flutter(moving ? 2.2 : 0.8, moving ? 11 : 2.6, 4);
    this.warped('skirt', add(waist, rot({ x: 1, y: -5 }, torsoR)), torsoR * 0.45, (u) => u * (kneeMid * 0.45 + (moving ? 3 : 0)) + skF(u) + skirtSway);
    // 躯干（横向缩放模拟扭转）
    c.save(); c.translate(waist.x, waist.y); c.rotate(torsoR); c.scale(1 - Math.abs(J.twist) * 0.6, 1 + Math.sin(t * 2.0) * (moving ? 0 : 0.006));
    c.drawImage(this.P.torso.img, -this.P.torso.j.x + J.twist * 30, -this.P.torso.j.y); c.restore();
    // 头与斗笠（滞后）
    const headR = torsoR * 0.55 + J.headTilt;
    this.part('head', neck, headR);
    const hatAt = add(neck, rot({ x: this.P.head.pts.hatJoint.x - this.P.head.j.x, y: this.P.head.pts.hatJoint.y - this.P.head.j.y + J.hatLag * 0.6 }, headR));
    this.part('hat', hatAt, headR + J.hatLag * 0.012);
    // 工具（身前）与近侧手臂
    if (tool && toolHand && !toolBehind) {
      if (held === 'torch' || held === 'lantern') { this.drawTool(tool, held, toolHand, toolAng, toolGrip); }
      else this.drawTool(tool, held!, toolHand, toolAng, toolGrip, smear);
    }
    this.part('upperN', shN, armSN.up);
    this.part('foreN', armSN.elbow, armSN.fo);
  }
}
