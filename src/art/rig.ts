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

const FB_PARTS = ['head', 'torso', 'skirt', 'armL', 'armR', 'legL', 'legR'].flatMap((k) => ['f_' + k, 'b_' + k]).concat('b_scarf');

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
  /** 正面/背面部件套件是否齐全（朝镜头 / 背向镜头行走） */
  private fbOK = false;
  private fbCur: Joints = {};
  /** 穿戴物立绘（取资源包图标） */
  private gear: Record<string, HTMLImageElement | undefined> = {};

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
    this.fbOK = FB_PARTS.every((k) => !!this.P[k]?.img);
    for (const id of ['armor_grass', 'armor_wood', 'backpack', 'garland']) this.gear[id] = pack.images.get('icon_' + id);
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
    // 朝镜头 / 背向镜头：使用正面、背面部件（动作仍用侧面姿势）
    if (this.fbOK && (p.facing === 'down' || p.facing === 'up') && !p.dead && p.action === 'none') {
      this.drawFB(p.facing === 'down' ? 'f' : 'b', p, dt);
      return;
    }
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
    // 背囊（身后）
    const neckRel = this.vec('torso', 'neck');
    const pack = p.back ? this.gear[p.back] : undefined;
    if (pack) {
      c.save(); c.translate(waist.x, waist.y); c.rotate(torsoR * 0.9);
      const s = 0.5; c.drawImage(pack, 30 - pack.naturalWidth * s / 2, neckRel.y + 4, pack.naturalWidth * s, pack.naturalHeight * s); c.restore();
    }
    // 躯干（横向缩放模拟扭转）
    c.save(); c.translate(waist.x, waist.y); c.rotate(torsoR); c.scale(1 - Math.abs(J.twist) * 0.6, 1 + Math.sin(t * 2.0) * (moving ? 0 : 0.006));
    c.drawImage(this.P.torso.img, -this.P.torso.j.x + J.twist * 30, -this.P.torso.j.y);
    // 护甲（贴合躯干，侧面略收窄）
    const arm = p.armor ? this.gear[p.armor] : undefined;
    if (arm) {
      const tw = this.P.torso.img.naturalWidth, cx = -this.P.torso.j.x + tw / 2 + J.twist * 30;
      const w = tw * 1.1, h = -neckRel.y + 20;
      c.drawImage(arm, cx - w / 2 - 2, neckRel.y - 2, w, h);
    }
    if (pack) {   // 背带斜过胸前
      c.strokeStyle = '#4a321c'; c.lineWidth = 4.5; c.lineCap = 'round';
      c.beginPath(); c.moveTo(14, neckRel.y + 10); c.quadraticCurveTo(-2, neckRel.y + 34, -18, neckRel.y + 52); c.stroke();
      c.strokeStyle = 'rgba(150,110,60,0.6)'; c.lineWidth = 1.5; c.stroke();
    }
    c.restore();
    // 头与斗笠（滞后）
    const headR = torsoR * 0.55 + J.headTilt;
    this.part('head', neck, headR);
    const hatAt = add(neck, rot({ x: this.P.head.pts.hatJoint.x - this.P.head.j.x, y: this.P.head.pts.hatJoint.y - this.P.head.j.y + J.hatLag * 0.6 }, headR));
    this.garland(p.head, hatAt, headR + J.hatLag * 0.012, 'back');
    this.part('hat', hatAt, headR + J.hatLag * 0.012);
    this.garland(p.head, hatAt, headR + J.hatLag * 0.012, 'front');
    // 工具（身前）与近侧手臂
    if (tool && toolHand && !toolBehind) {
      if (held === 'torch' || held === 'lantern') { this.drawTool(tool, held, toolHand, toolAng, toolGrip); }
      else this.drawTool(tool, held!, toolHand, toolAng, toolGrip, smear);
    }
    this.part('upperN', shN, armSN.up);
    this.part('foreN', armSN.elbow, armSN.fo);
  }

  /** 花冠：压扁成环套在斗笠上；后半圈画在斗笠之前，前半圈画在之后 */
  private garland(id: string | null, hatAt: V, r: number, half: 'back' | 'front') {
    const g = id ? this.gear[id] : undefined;
    if (!g || HeroRig.hide.has('garland')) return;
    const c = this.ctx, w = g.naturalWidth, h = g.naturalHeight, k = 70 / w;
    c.save(); c.translate(hatAt.x, hatAt.y); c.rotate(r); c.translate(0, -8); c.scale(k, k * 0.45);
    if (half === 'back') c.drawImage(g, 0, 0, w, h / 2, -w / 2, -h / 2, w, h / 2);
    else c.drawImage(g, 0, h / 2, w, h / 2, -w / 2, 0, w, h / 2);
    c.restore();
  }

  /** 正面（f，朝镜头）/ 背面（b，背向镜头）行走与待机 */
  private drawFB(v: 'f' | 'b', p: PlayerPose, dt: number) {
    const c = this.ctx, t = p.t, P = this.P;
    const g = (n: string) => P[v + '_' + n];
    const legL = g('legL'), legR = g('legR'), torso = g('torso'), head = g('head');
    const Ln = ((legL.pts.sole.y - legL.j.y) + (legR.pts.sole.y - legR.j.y)) / 2;
    const fwd = v === 'f' ? 1 : -1;            // 画面中“前进”方向：朝镜头 = 向下
    const moving = p.moving;
    const held = p.held, tool = this.tool(held);
    let footL = { x: -10, y: 0, s: 0 }, footR = { x: 10, y: 0, s: 0 };
    const tg: Joints = {};
    if (moving) {
      const CYC = 2.2, BETA = 0.46;
      const ph = ((p.walk / 2.1) / CYC) % 1;
      const leg = (q: number, side: number) => {
        q = ((q % 1) + 1) % 1;
        let s: number, lift = 0;
        if (q < BETA) s = 0.5 - q / BETA;     // 支撑：脚贴地，相对身体后移
        else { const u = (q - BETA) / (1 - BETA); s = -0.5 + smooth(u); lift = Math.sin(Math.PI * u) ** 0.9 * 20; }
        return { x: side * 10 - side * lift * 0.12, y: fwd * s * 36 - lift, s };
      };
      footL = leg(ph, -1); footR = leg(ph + 0.5, 1);
      const bounce = Math.cos(TAU * (2 * ph - BETA));
      const sway = Math.sin(TAU * ph + 0.5);
      Object.assign(tg, { px: sway * 2.8, py: -Ln * 0.975 + 3 + bounce * 3.5, roll: sway * 0.035, swL: footR.s * 2, swR: footL.s * 2, tilt: Math.sin(TAU * 2 * ph - 0.9) * 0.025, hat: Math.sin(TAU * 2 * ph - 1.3) * 1.5, cloth: 1 });
    } else {
      const shift = Math.sin(t * 0.55) * 2.2 + Math.sin(t * 1.37) * 0.6, breath = Math.sin(t * 2.0);
      Object.assign(tg, { px: shift, py: -Ln * 0.975 + 1.2 - breath * 0.6, roll: shift * 0.006, swL: Math.sin(t * 1.1) * 0.06, swR: Math.sin(t * 1.1 + 0.8) * 0.06, tilt: Math.sin(t * 0.37) * 0.03, hat: breath * 0.5, cloth: 0 });
    }
    if (p.shiver > 0.05) tg.px += p.shiver * Math.sin(t * 61) * 1.1;
    const kk = 1 - Math.exp(-dt * (moving ? 30 : 10));
    for (const [k, val] of Object.entries(tg)) { const cur = this.fbCur[k]; this.fbCur[k] = cur === undefined ? val : cur + (val - cur) * kk; }
    const J = this.fbCur;
    if (!moving) { // 停步：脚滑回站姿
      for (const [k, x] of [['lx', -10], ['ly', 0], ['rx', 10], ['ry', 0]] as [string, number][]) J[k] = (J[k] ?? x) + (x - (J[k] ?? x)) * kk;
      footL = { x: J.lx, y: J.ly, s: 0 }; footR = { x: J.rx, y: J.ry, s: 0 };
    } else { J.lx = footL.x; J.ly = footL.y; J.rx = footR.x; J.ry = footR.y; }
    const pelvis: V = { x: J.px, y: J.py };
    const waist = add(pelvis, { x: 0, y: -16 });
    const roll = J.roll;
    const tP = (pt: string) => add(waist, rot({ x: torso.pts[pt].x - torso.j.x, y: torso.pts[pt].y - torso.j.y }, roll));

    // 腿：裤腿段伸缩（屈膝/前伸），小腿与草鞋保持原形；近处的腿略大
    const drawLeg = (part: Part, hip: V, foot: { x: number; y: number; s: number }) => {
      if (HeroRig.hide.has(v + '_leg')) return;
      const img = part.img, w = img.naturalWidth, h = img.naturalHeight;
      const jy = part.j.y, sy = part.pts.sole.y, knee = jy + (sy - jy) * 0.44;
      const persp = 1 + 0.05 * foot.s * fwd;
      const dx = foot.x - hip.x, dy = foot.y - hip.y, d = Math.hypot(dx, dy) / persp;
      const up = Math.max(12, d - (sy - knee));
      const k = up / (knee - jy);
      c.save(); c.translate(hip.x, hip.y); c.rotate(angOf(dx, dy)); c.scale(persp, persp);
      c.drawImage(img, 0, 0, w, knee + 1, -part.j.x, -jy * k, w, (knee + 1) * k);
      c.drawImage(img, 0, knee, w, h - knee, -part.j.x, up, w, h - knee);
      c.restore();
    };
    // 手臂：向前摆（朝镜头）时透视缩短、略放大
    const armPose = (part: Part, sh: V, side: number, sw: number, raise = 0) => {
      const r = side * (0.06 + Math.abs(sw) * 0.05) + raise + roll * 0.5;
      const sy = 1 - Math.abs(sw) * 0.09 - Math.abs(raise) * 0.25, sc = 1 + sw * fwd * 0.04;
      const hand = add(sh, rot({ x: (part.pts.hand.x - part.j.x) * sc, y: (part.pts.hand.y - part.j.y) * sy * sc }, r));
      return { r, sy, sc, hand };
    };
    const drawArm = (part: Part, sh: V, a: { r: number; sy: number; sc: number }) => {
      c.save(); c.translate(sh.x, sh.y + (1 - a.sy) * 6); c.rotate(a.r); c.scale(a.sc, a.sy * a.sc); c.drawImage(part.img, -part.j.x, -part.j.y); c.restore();
    };
    const t2 = t;
    const flutter = (amp: number, freq: number, kx: number) => (u: number) => Math.sin(t2 * freq - u * kx) * amp * u ** 1.4;
    const cloth = J.cloth;

    // 持物姿势：右手（画面右）
    let raiseR = 0, toolAng = 0, toolGrip = 0;
    if (tool) {
      if (held === 'torch') { raiseR = -0.42; toolAng = -Math.PI / 2 + 0.18; toolGrip = 0.28; }
      else if (held === 'lantern') { raiseR = -0.28; toolAng = Math.PI / 2; toolGrip = 0; }
      else if (held === 'spear' || held === 'spear2') { raiseR = -0.2; toolAng = -Math.PI / 2 + 0.06; toolGrip = 0.45; }
      else { raiseR = -0.08; toolAng = -Math.PI / 2 + 0.3; toolGrip = 0.74; }
    }
    const shL = tP('shL'), shR = tP('shR'), neck = tP('neck');
    const aL = armPose(g('armL'), shL, 1, J.swL), aR = armPose(g('armR'), shR, -1, tool ? J.swR * 0.25 : J.swR, raiseR);
    const toolHand = aR.hand;
    if (tool && (held === 'torch' || held === 'lantern')) {
      const tip = held === 'lantern' ? toolHand : this.toolPoint(tool, held!, toolHand, toolAng, toolGrip, 0.85);
      this.hand.x = tip.x / PPU * (p.flip ? -1 : 1); this.hand.y = -tip.y / PPU - 0.45;
    }
    const pack = p.back ? this.gear[p.back] : undefined;
    const armor = p.armor ? this.gear[p.armor] : undefined;
    const tw = torso.img.naturalWidth, nrel = torso.pts.neck.y - torso.j.y;

    // —— 由后到前 ——
    // 正面：背囊在身后，只从肩上露出
    if (pack && v === 'f') { const s = 0.62; c.save(); c.translate(waist.x, waist.y); c.rotate(roll); c.drawImage(pack, -pack.naturalWidth * s / 2, nrel - 12, pack.naturalWidth * s, pack.naturalHeight * s); c.restore(); }
    // 腿（远的先画）
    const hipL = add(pelvis, rot({ x: -9, y: 0 }, roll)), hipR = add(pelvis, rot({ x: 9, y: 0 }, roll));
    const legs: [Part, V, typeof footL][] = [[legL, hipL, footL], [legR, hipR, footR]];
    legs.sort((a, b) => a[2].y - b[2].y);
    for (const [pt, hp, ft] of legs) drawLeg(pt, hp, ft);
    // 下摆：随身体左右摆、行走时轻微飘动
    const sk = g('skirt'), skf = flutter(cloth ? 2.0 : 0.7, cloth ? 10 : 2.4, 4);
    this.warped(v + '_skirt', add(waist, rot({ x: 0, y: -6 }, roll)), roll * 0.6, (u) => u * (footL.y - footR.y) * 0.05 * fwd - u * J.px * 0.4 + skf(u));
    void sk;
    // 躯干
    c.save(); c.translate(waist.x, waist.y); c.rotate(roll); c.scale(1, 1 + Math.sin(t * 2.0) * (moving ? 0 : 0.006));
    c.drawImage(torso.img, -torso.j.x, -torso.j.y);
    if (pack && v === 'f') {   // 正面背带
      c.lineCap = 'round';
      for (const sd of [-1, 1]) {
        c.strokeStyle = '#4a321c'; c.lineWidth = 5;
        c.beginPath(); c.moveTo(sd * tw * 0.27, nrel + 8); c.quadraticCurveTo(sd * tw * 0.3, nrel + 32, sd * tw * 0.22, nrel + 56); c.stroke();
        c.strokeStyle = 'rgba(150,110,60,0.55)'; c.lineWidth = 1.5; c.stroke();
      }
    }
    c.restore();
    // 背面：围巾尾、背囊压在背上
    const headR = roll * 0.5 + J.tilt;
    if (v === 'b') {
      const sf = flutter(cloth ? 4 : 1.4, cloth ? 9 : 2.2, 5);
      const knot = add(neck, { x: 4, y: 10 });
      if (!pack) this.warped('b_scarf', knot, headR * 0.5 + 0.04, (u) => sf(u) + u * J.px * -0.6);
    }
    // 手臂（垂在身侧）与持物
    drawArm(g('armL'), shL, aL);
    const toolFirst = tool && v === 'b';
    if (toolFirst) this.drawTool(tool!, held!, toolHand, toolAng, toolGrip);
    drawArm(g('armR'), shR, aR);
    // 护甲是无袖背心：压在袖口根部之上；背面的背囊再压在护甲上
    c.save(); c.translate(waist.x, waist.y); c.rotate(roll);
    if (armor) { const w = tw * 0.9, h = -nrel + 26; c.drawImage(armor, -torso.j.x + tw / 2 - w / 2, nrel - 2, w, h); }
    if (pack && v === 'b') { const s = 0.62; c.drawImage(pack, -pack.naturalWidth * s / 2, nrel + 6, pack.naturalWidth * s, pack.naturalHeight * s); }
    c.restore();
    // 头、斗笠
    const headAt = add(neck, { x: 0, y: v === 'f' ? 4 : 6 });
    this.part(v + '_head', headAt, headR);
    if (v === 'b' && pack) { // 有背囊时围巾尾只露出一截
      const sf = flutter(cloth ? 3 : 1, cloth ? 9 : 2.2, 5);
      c.save(); c.beginPath(); c.rect(-200, -400, 400, headAt.y + 40 + 400); c.clip();
      this.warped('b_scarf', add(neck, { x: 4, y: 10 }), headR * 0.5 + 0.04, sf); c.restore();
    }
    const hj = { x: head.pts.hatJoint.x - head.j.x, y: head.pts.hatJoint.y - head.j.y + J.hat * 0.6 };
    const hatAt = add(headAt, rot(hj, headR));
    this.garland(p.head, hatAt, headR + J.hat * 0.01, 'back');
    this.part('hat', hatAt, headR + J.hat * 0.01);
    this.garland(p.head, hatAt, headR + J.hat * 0.01, 'front');
    if (tool && !toolFirst) this.drawTool(tool, held!, toolHand, toolAng, toolGrip);
  }
}
