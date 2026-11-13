// 广告牌精灵批渲染：一个实例化网格画成千上万株草木；光照、摇曳、边缘光都在着色器里完成
import * as THREE from 'three';
import { U, GLSL_LIGHTS } from './shared';
import type { Frame } from '../art/atlas';

export const FLAG_EMISSIVE = 1, FLAG_FLIP = 2, FLAG_GHOST = 4, FLAG_NOLIGHT_RIM = 8;

const vert = /* glsl */ `
attribute vec3 iPos;
attribute vec2 iSize;
attribute vec4 iUV;
attribute vec4 iMisc;  // x 摇曳 y 相位 z 标志 w 落脚偏移
attribute vec4 iFx;    // x 闪白 y 抖动 z 透明 w 变暗
uniform vec3 uCamRight;
uniform vec3 uCamUp;
uniform float uTime;
uniform float uWind;
varying vec2 vUv;
varying vec4 vRect;
varying vec3 vWorld;
varying float vLocalY;
varying vec4 vMisc;
varying vec4 vFx;
varying float vRimX;
void main() {
  float flags = floor(iMisc.z + 0.5);
  float flip = mod(floor(flags / 2.0), 2.0) > 0.5 ? -1.0 : 1.0;
  vec2 p = position.xy; // x:-0.5..0.5, y:0..1
  float y = p.y;
  float sway = iMisc.x * (y * y) * (sin(uTime * 1.6 + iMisc.y) * 0.6 + sin(uTime * 2.7 + iMisc.y * 1.7) * 0.25 + 0.35 * uWind);
  float shake = iFx.y * sin(uTime * 55.0 + iMisc.y) * y;
  vec3 right = normalize(vec3(uCamRight.x, 0.0, uCamRight.z));
  vec3 up = normalize(mix(vec3(0.0, 1.0, 0.0), uCamUp, 0.55));
  vec3 wp = iPos + right * (p.x * iSize.x + sway + shake) + up * (y * iSize.y - iMisc.w);
  float u = mix(iUV.x, iUV.z, flip > 0.0 ? (p.x + 0.5) : (0.5 - p.x));
  float v = mix(iUV.y, iUV.w, y);
  vUv = vec2(u, v);
  vRect = iUV;
  vWorld = wp;
  vLocalY = y;
  vMisc = iMisc;
  vFx = iFx;
  vRimX = flip;
  gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
  // 同朝向的广告牌会共面：按实例哈希给极小的深度偏移，消除 z-fighting 条纹
  float h = fract(sin(dot(iPos.xz, vec2(12.9898, 78.233))) * 43758.5453);
  gl_Position.z -= h * 6e-5 * gl_Position.w;
}
`;

const frag = /* glsl */ `
uniform sampler2D uAtlas;
uniform float uTexel;
uniform vec3 uCamRight;
${GLSL_LIGHTS}
varying vec2 vUv;
varying vec4 vRect;
varying vec3 vWorld;
varying float vLocalY;
varying vec4 vMisc;
varying vec4 vFx;
varying float vRimX;

float bayer(vec2 p) {
  vec2 q = mod(floor(p), 4.0);
  float b = 0.0;
  // 4x4 抖动阈值
  vec4 r0 = vec4(0.0, 8.0, 2.0, 10.0), r1 = vec4(12.0, 4.0, 14.0, 6.0), r2 = vec4(3.0, 11.0, 1.0, 9.0), r3 = vec4(15.0, 7.0, 13.0, 5.0);
  vec4 row = q.y < 1.0 ? r0 : q.y < 2.0 ? r1 : q.y < 3.0 ? r2 : r3;
  b = q.x < 1.0 ? row.x : q.x < 2.0 ? row.y : q.x < 3.0 ? row.z : row.w;
  return (b + 0.5) / 16.0;
}

void main() {
  vec4 tex = texture2D(uAtlas, vUv);
  float flags = floor(vMisc.z + 0.5); // 插值后的浮点可能是 1.9999，必须取整
  bool emissive = mod(flags, 2.0) > 0.5;
  bool ghost = mod(floor(flags / 4.0), 2.0) > 0.5;
  float alpha = tex.a * (1.0 - vFx.z);
  if (ghost) alpha *= 0.55;
  if (alpha < bayer(gl_FragCoord.xy) * 0.9 + 0.05) discard;
  vec3 col = tex.rgb;
  if (emissive) {
    vec3 e = col * 1.6;
    e = applyFog(e, vWorld) * 0.4 + e * 0.6;
    gl_FragColor = vec4(e, 1.0);
    return;
  }
  // 底部环境光遮蔽
  float ao = mix(0.62, 1.0, smoothstep(0.0, 0.22, vLocalY));
  vec3 light = uAmbient * ao + uSunColor * uSunInt * (0.55 + 0.45 * vLocalY);
  vec3 rimAcc;
  vec3 pl = pointLights(vWorld + vec3(0.0, 0.2, 0.0), rimAcc);
  light += pl * mix(0.8, 1.0, vLocalY);
  // 屏幕空间边缘光：沿光源方向采样一次 alpha，若外侧透明则是迎光的轮廓
  vec2 rimDir = vec2(dot(rimAcc.xz, normalize(uCamRight.xz)) * vRimX, 0.6);
  float rimStr = length(rimAcc.xz);
  vec2 rw = vec2(abs(vRect.z - vRect.x), abs(vRect.y - vRect.w));
  // 边缘光：朝光源方向偏移几个纹素采样 alpha；外侧透明 = 迎光轮廓。注意 v 轴在图集中自上而下，向上为 -v
  float TX = uTexel;
  vec2 rmin = min(vRect.xy, vRect.zw), rmax = max(vRect.xy, vRect.zw);
  float sunRim = 0.0;
  {
    float sx = dot(normalize(uSunDir.xz + 1e-4), normalize(uCamRight.xz)) * vRimX;
    vec2 o = normalize(vec2(sx, -0.7)) * 3.5 * TX;
    vec2 suv = clamp(vUv + o, rmin, rmax);
    sunRim = (1.0 - textureLod(uAtlas, suv, 0.0).a) * uSunInt * (1.0 - smoothstep(0.35, 0.9, uSunDir.y)) * smoothstep(0.15, 0.5, vLocalY);
  }
  if (rimStr > 0.03) {
    vec2 d = normalize(vec2(rimDir.x, -0.5)) * 3.5 * TX;
    vec2 ruv = clamp(vUv + d, rmin, rmax);
    float edge = 1.0 - textureLod(uAtlas, ruv, 0.0).a;
    light += vec3(1.0, 0.62, 0.3) * edge * min(rimStr, 1.2) * 0.9;
  }
  light += uSunColor * sunRim * 0.8;
  col *= light;
  col = mix(col, col * vec3(0.5, 0.45, 0.4), vFx.w);
  col = mix(col, vec3(1.0, 0.92, 0.85), vFx.x);
  col = applyFog(col, vWorld);
  gl_FragColor = vec4(col, 1.0);
}
`;

export function makeSpriteMaterial(tex: THREE.Texture): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { ...U, uAtlas: { value: tex }, uTexel: { value: 1 / ((tex.image as { width?: number })?.width || 4096) } },
    vertexShader: vert,
    fragmentShader: frag,
    transparent: false,
    depthWrite: true,
    side: THREE.DoubleSide,
  });
}

export interface SpriteInst {
  x: number; y: number; z: number;
  frame: Frame;
  sway?: number; phase?: number; flags?: number;
  flash?: number; shake?: number; fade?: number; dark?: number;
  scale?: number;
}

/** 一批实例化精灵；static 用于草木（按需更新），dynamic 每帧重建 */
export class SpriteBatch {
  mesh: THREE.Mesh;
  geo: THREE.InstancedBufferGeometry;
  pos: Float32Array; size: Float32Array; uv: Float32Array; misc: Float32Array; fx: Float32Array;
  attrs: THREE.InstancedBufferAttribute[];
  count = 0;
  private dirtyMin = Infinity; private dirtyMax = -1;
  constructor(public capacity: number, material: THREE.ShaderMaterial) {
    const plane = new THREE.PlaneGeometry(1, 1);
    plane.translate(0, 0.5, 0);
    const geo = new THREE.InstancedBufferGeometry();
    geo.index = plane.index;
    geo.setAttribute('position', plane.getAttribute('position'));
    geo.setAttribute('uv', plane.getAttribute('uv'));
    this.pos = new Float32Array(capacity * 3);
    this.size = new Float32Array(capacity * 2);
    this.uv = new Float32Array(capacity * 4);
    this.misc = new Float32Array(capacity * 4);
    this.fx = new Float32Array(capacity * 4);
    const mk = (arr: Float32Array, n: number, name: string) => {
      const a = new THREE.InstancedBufferAttribute(arr, n);
      a.setUsage(THREE.DynamicDrawUsage);
      geo.setAttribute(name, a);
      return a;
    };
    this.attrs = [mk(this.pos, 3, 'iPos'), mk(this.size, 2, 'iSize'), mk(this.uv, 4, 'iUV'), mk(this.misc, 4, 'iMisc'), mk(this.fx, 4, 'iFx')];
    geo.instanceCount = 0;
    this.geo = geo;
    this.mesh = new THREE.Mesh(geo, material);
    this.mesh.frustumCulled = false;
  }
  set(i: number, s: SpriteInst) {
    const f = s.frame, sc = s.scale ?? 1;
    this.pos[i * 3] = s.x; this.pos[i * 3 + 1] = s.y; this.pos[i * 3 + 2] = s.z;
    this.size[i * 2] = f.w * sc; this.size[i * 2 + 1] = f.h * sc;
    this.uv[i * 4] = f.u0; this.uv[i * 4 + 1] = f.v0; this.uv[i * 4 + 2] = f.u1; this.uv[i * 4 + 3] = f.v1;
    this.misc[i * 4] = s.sway ?? 0; this.misc[i * 4 + 1] = s.phase ?? 0; this.misc[i * 4 + 2] = s.flags ?? 0; this.misc[i * 4 + 3] = f.foot * sc;
    this.fx[i * 4] = s.flash ?? 0; this.fx[i * 4 + 1] = s.shake ?? 0; this.fx[i * 4 + 2] = s.fade ?? 0; this.fx[i * 4 + 3] = s.dark ?? 0;
    if (i < this.dirtyMin) this.dirtyMin = i;
    if (i > this.dirtyMax) this.dirtyMax = i;
  }
  push(s: SpriteInst): number {
    if (this.count >= this.capacity) return -1;
    const i = this.count++;
    this.set(i, s);
    return i;
  }
  hide(i: number) {
    this.size[i * 2] = 0; this.size[i * 2 + 1] = 0;
    if (i < this.dirtyMin) this.dirtyMin = i;
    if (i > this.dirtyMax) this.dirtyMax = i;
  }
  setFx(i: number, flash: number, shake: number) {
    this.fx[i * 4] = flash; this.fx[i * 4 + 1] = shake;
    if (i < this.dirtyMin) this.dirtyMin = i;
    if (i > this.dirtyMax) this.dirtyMax = i;
  }
  setFade(i: number, fade: number) {
    this.fx[i * 4 + 2] = fade;
    if (i < this.dirtyMin) this.dirtyMin = i;
    if (i > this.dirtyMax) this.dirtyMax = i;
  }
  clear() { this.count = 0; }
  commit() {
    this.geo.instanceCount = this.count;
    if (this.dirtyMax >= this.dirtyMin) {
      const sizes = [3, 2, 4, 4, 4];
      this.attrs.forEach((a, k) => {
        a.clearUpdateRanges();
        a.addUpdateRange(this.dirtyMin * sizes[k], (this.dirtyMax - this.dirtyMin + 1) * sizes[k]);
        a.needsUpdate = true;
      });
    }
    this.dirtyMin = Infinity; this.dirtyMax = -1;
  }
}
