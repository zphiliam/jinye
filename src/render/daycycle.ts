// 昼夜循环：白昼 → 黄昏（明显的视听警示）→ 漆黑之夜
import * as THREE from 'three';
import { U } from './shared';
import type { Post } from './post';

export type Phase = 'day' | 'dusk' | 'night';

interface Key { c: number; amb: number[]; sun: number[]; si: number; fog: number[]; near: number; far: number; lift: number[]; gain: number[]; sat: number; vig: number; shafts: number }

const K: Key[] = [
  { c: 0.0, amb: [0.40, 0.34, 0.34], sun: [1.0, 0.72, 0.52], si: 0.42, fog: [0.52, 0.42, 0.40], near: 26, far: 80, lift: [0.03, 0.015, 0.02], gain: [1.0, 0.93, 0.88], sat: 0.85, vig: 0.55, shafts: 0.4 },
  { c: 0.07, amb: [0.52, 0.50, 0.46], sun: [1.0, 0.92, 0.78], si: 0.62, fog: [0.72, 0.66, 0.56], near: 36, far: 100, lift: [0.025, 0.02, 0.012], gain: [1.0, 0.97, 0.9], sat: 0.9, vig: 0.5, shafts: 0.0 },
  { c: 0.28, amb: [0.56, 0.54, 0.50], sun: [1.0, 0.96, 0.86], si: 0.70, fog: [0.77, 0.72, 0.62], near: 40, far: 110, lift: [0.02, 0.02, 0.015], gain: [1.0, 0.98, 0.92], sat: 0.92, vig: 0.45, shafts: 0.0 },
  { c: 0.45, amb: [0.50, 0.44, 0.38], sun: [1.0, 0.82, 0.60], si: 0.66, fog: [0.72, 0.60, 0.48], near: 36, far: 100, lift: [0.03, 0.02, 0.01], gain: [1.02, 0.95, 0.85], sat: 0.92, vig: 0.5, shafts: 0.15 },
  { c: 0.5, amb: [0.42, 0.31, 0.26], sun: [1.0, 0.58, 0.30], si: 0.64, fog: [0.62, 0.40, 0.30], near: 30, far: 90, lift: [0.04, 0.015, 0.01], gain: [1.05, 0.9, 0.78], sat: 0.95, vig: 0.58, shafts: 0.85 },
  { c: 0.6, amb: [0.20, 0.12, 0.13], sun: [0.95, 0.36, 0.18], si: 0.42, fog: [0.30, 0.15, 0.13], near: 22, far: 70, lift: [0.03, 0.01, 0.015], gain: [1.05, 0.88, 0.8], sat: 0.9, vig: 0.68, shafts: 0.6 },
  { c: 0.6875, amb: [0.03, 0.03, 0.055], sun: [0.4, 0.2, 0.2], si: 0.0, fog: [0.015, 0.015, 0.025], near: 12, far: 40, lift: [0.0, 0.0, 0.01], gain: [1.0, 0.92, 0.85], sat: 0.85, vig: 0.8, shafts: 0.0 },
  { c: 0.72, amb: [0.010, 0.012, 0.022], sun: [0, 0, 0], si: 0.0, fog: [0.0, 0.0, 0.006], near: 10, far: 36, lift: [0.0, 0.0, 0.006], gain: [1.0, 0.92, 0.85], sat: 0.85, vig: 0.85, shafts: 0.0 },
  { c: 0.965, amb: [0.02, 0.02, 0.035], sun: [0, 0, 0], si: 0.0, fog: [0.01, 0.01, 0.02], near: 12, far: 40, lift: [0.0, 0.0, 0.008], gain: [1.0, 0.92, 0.85], sat: 0.85, vig: 0.8, shafts: 0.0 },
  { c: 1.0, amb: [0.40, 0.34, 0.34], sun: [1.0, 0.72, 0.52], si: 0.42, fog: [0.52, 0.42, 0.40], near: 26, far: 80, lift: [0.03, 0.015, 0.02], gain: [1.0, 0.93, 0.88], sat: 0.85, vig: 0.55, shafts: 0.4 },
];

const L = (a: number, b: number, t: number) => a + (b - a) * t;
const LA = (a: number[], b: number[], t: number) => a.map((v, i) => L(v, b[i], t));

export class DayCycle {
  day = 1;
  t = 0; // 当天已过秒数
  lens: { day: number; dusk: number; night: number };
  constructor(easy: boolean) {
    this.lens = easy ? { day: 300, dusk: 100, night: 120 } : { day: 240, dusk: 90, night: 150 };
  }
  get total() { return this.lens.day + this.lens.dusk + this.lens.night; }
  get phase(): Phase { return this.t < this.lens.day ? 'day' : this.t < this.lens.day + this.lens.dusk ? 'dusk' : 'night'; }
  /** 把真实时间映射到关键帧时钟：day→[0,0.5) dusk→[0.5,0.6875) night→[0.6875,1) */
  get clock(): number {
    const { day, dusk, night } = this.lens;
    if (this.t < day) return (this.t / day) * 0.5;
    if (this.t < day + dusk) return 0.5 + ((this.t - day) / dusk) * 0.1875;
    return 0.6875 + ((this.t - day - dusk) / night) * 0.3125;
  }
  /** 0 = 全日光，1 = 全黑 */
  get darkness(): number {
    const c = this.clock;
    if (c < 0.5) return c < 0.02 ? 0.3 * (1 - c / 0.02) : 0;
    if (c < 0.6875) return Math.pow((c - 0.5) / 0.1875, 1.6) * 0.85;
    if (c > 0.97) return 1 - (c - 0.97) / 0.03 * 0.7;
    return 1;
  }
  setPhaseTime(phase: Phase, frac: number) {
    const { day, dusk, night } = this.lens;
    this.t = phase === 'day' ? day * frac : phase === 'dusk' ? day + dusk * frac : day + dusk + night * frac;
  }
  update(dt: number): boolean {
    this.t += dt;
    if (this.t >= this.total) { this.t -= this.total; this.day++; return true; }
    return false;
  }
  apply(post: Post) {
    const c = this.clock;
    let i = 0;
    while (i < K.length - 2 && K[i + 1].c <= c) i++;
    const a = K[i], b = K[i + 1];
    const t = Math.min(1, Math.max(0, (c - a.c) / (b.c - a.c)));
    const s = t * t * (3 - 2 * t);
    const amb = LA(a.amb, b.amb, s), sun = LA(a.sun, b.sun, s), fog = LA(a.fog, b.fog, s);
    U.uAmbient.value.setRGB(amb[0], amb[1], amb[2]);
    U.uSunColor.value.setRGB(sun[0], sun[1], sun[2]);
    U.uSunInt.value = L(a.si, b.si, s);
    U.uFogColor.value.setRGB(fog[0], fog[1], fog[2]);
    U.uFogNear.value = L(a.near, b.near, s);
    U.uFogFar.value = L(a.far, b.far, s);
    U.uNight.value = this.darkness;
    // 太阳轨迹：从东升到西落；黄昏时贴地，拉出长影
    const sunC = Math.min(1, c / 0.6875);
    const az = -0.6 + sunC * Math.PI * 0.95;
    const el = Math.max(0.08, Math.sin(sunC * Math.PI) * 0.85);
    U.uSunDir.value.set(Math.cos(az) * Math.cos(el), Math.sin(el), Math.sin(az) * Math.cos(el) * 0.6 + 0.35).normalize();
    const f = post.final.uniforms;
    const lift = LA(a.lift, b.lift, s), gain = LA(a.gain, b.gain, s);
    f.uLift.value.set(lift[0], lift[1], lift[2]);
    f.uGain.value.set(gain[0], gain[1], gain[2]);
    f.uSat.value = L(a.sat, b.sat, s);
    f.uVignette.value = L(a.vig, b.vig, s);
    f.uShafts.value = L(a.shafts, b.shafts, s);
    f.uShaftColor.value.set(sun[0], sun[1] * 0.85, sun[2] * 0.7);
  }
  get clearColor(): THREE.Color { return U.uFogColor.value; }
}
