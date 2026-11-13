// 地面投影：白天随太阳拉长，夜里背离最近的火光
import * as THREE from 'three';
import { U, GLSL_LIGHTS } from './shared';

const vert = /* glsl */ `
attribute vec4 iShadow; // x z 半径 高度
attribute float iStr;
${GLSL_LIGHTS}
varying vec2 vLocal;
varying float vStr;
varying vec3 vWorld;
uniform float uGroundY;
uniform sampler2D tHeight;
uniform float uWorldSize;
void main() {
  vec2 c = iShadow.xy;
  float rad = iShadow.z;
  float h = iShadow.w;
  // 太阳方向（投向背光侧）
  vec2 sd = -normalize(uSunDir.xz + 1e-4);
  float elev = max(uSunDir.y, 0.08);
  float sunLen = clamp(h * 0.55 / elev, 0.0, h * 2.2) * step(0.001, uSunInt);
  vec2 dir = sd;
  float len = sunLen;
  float strength = clamp(uSunInt * 1.6, 0.0, 1.0);
  // 最近的强光源
  float best = 0.0;
  for (int i = 0; i < MAX_LIGHTS; i++) {
    vec4 lp = uLightPos[i];
    vec4 lc = uLightCol[i];
    if (lc.w <= 0.0) continue;
    vec2 d = c - lp.xz;
    float dist = length(d);
    float k = clamp(1.0 - dist / lp.w, 0.0, 1.0) * lc.w;
    if (k > best && dist > 0.3) {
      best = k;
      vec2 ld = d / dist;
      float lw = clamp(k * 1.5, 0.0, 1.0);
      dir = normalize(mix(dir, ld, lw * (1.0 - strength * 0.6)) + 1e-4);
      len = mix(len, h * 0.9 * (0.6 + dist / lp.w), lw * (1.0 - strength * 0.6));
      strength = max(strength, lw * 0.9);
    }
  }
  vec2 p = position.xy; // -0.5..0.5
  vec2 side = vec2(-dir.y, dir.x);
  vec2 along = dir;
  float L = rad + len;
  vec2 offset = along * (len * 0.5);
  vec2 wp2 = c + offset + side * p.x * rad * 2.0 + along * p.y * L * 1.2;
  vLocal = p;
  vStr = iStr * strength;
  vec2 hg = (wp2 / uWorldSize + 0.5) * 512.0;
  float y = texture2D(tHeight, (hg + 0.5) / 513.0).r;
  vec3 wp = vec3(wp2.x, y + 0.04, wp2.y);
  vWorld = wp;
  gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
}
`;

const frag = /* glsl */ `
varying vec2 vLocal;
varying float vStr;
varying vec3 vWorld;
uniform vec3 uFogColor;
uniform vec3 uCamPos;
uniform float uFogFar;
void main() {
  vec2 q = vLocal * 2.0;
  float d = length(q);
  float a = smoothstep(1.0, 0.25, d) * vStr * 0.55;
  a *= 1.0 - smoothstep(uFogFar * 0.5, uFogFar, distance(vWorld, uCamPos));
  if (a < 0.01) discard;
  gl_FragColor = vec4(0.05, 0.04, 0.05, a);
}
`;

export class ShadowLayer {
  mesh: THREE.Mesh;
  geo: THREE.InstancedBufferGeometry;
  data: Float32Array;
  str: Float32Array;
  a1: THREE.InstancedBufferAttribute; a2: THREE.InstancedBufferAttribute;
  count = 0;
  material: THREE.ShaderMaterial;
  /** 地形高度采样（阴影贴地） */
  constructor(public capacity: number, heightTex: THREE.Texture, worldSize: number) {
    const plane = new THREE.PlaneGeometry(1, 1);
    const geo = new THREE.InstancedBufferGeometry();
    geo.index = plane.index;
    geo.setAttribute('position', plane.getAttribute('position'));
    this.data = new Float32Array(capacity * 4);
    this.str = new Float32Array(capacity);
    this.a1 = new THREE.InstancedBufferAttribute(this.data, 4); this.a1.setUsage(THREE.DynamicDrawUsage);
    this.a2 = new THREE.InstancedBufferAttribute(this.str, 1); this.a2.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('iShadow', this.a1);
    geo.setAttribute('iStr', this.a2);
    geo.instanceCount = 0;
    this.geo = geo;
    this.material = new THREE.ShaderMaterial({
      uniforms: { ...U, uGroundY: { value: 0 }, tHeight: { value: null }, uWorldSize: { value: 520 } },
      vertexShader: vert, fragmentShader: frag,
      transparent: true, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    });
    this.material.uniforms.tHeight.value = heightTex;
    this.material.uniforms.uWorldSize.value = worldSize;
    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 1;
  }
  push(x: number, z: number, rad: number, h: number, s = 1): number {
    if (this.count >= this.capacity) return -1;
    const i = this.count++;
    this.set(i, x, z, rad, h, s);
    return i;
  }
  set(i: number, x: number, z: number, rad: number, h: number, s = 1) {
    this.data[i * 4] = x; this.data[i * 4 + 1] = z; this.data[i * 4 + 2] = rad; this.data[i * 4 + 3] = h;
    this.str[i] = s;
  }
  commit() {
    this.geo.instanceCount = this.count;
    this.a1.needsUpdate = true; this.a2.needsUpdate = true;
  }
}
