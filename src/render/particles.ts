// 粒子：火星、烟、落叶、尘埃、萤火、木屑石屑、受击飞溅
import * as THREE from 'three';
import { U, GLSL_LIGHTS } from './shared';

export const PT_GLOW = 0, PT_SMOKE = 1, PT_LEAF = 2, PT_SPARK = 3, PT_CHIP = 4, PT_MOTE = 5;

const vert = /* glsl */ `
attribute vec4 aColor;
attribute vec3 aParams; // 尺寸 类型 旋转
uniform float uPxScale;
uniform float uLit;
${GLSL_LIGHTS}
varying vec4 vColor;
varying float vType;
varying float vRot;
varying vec3 vLight;
void main() {
  vec4 mv = viewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = aParams.x * uPxScale / -mv.z;
  vColor = aColor;
  vType = aParams.y;
  vRot = aParams.z;
  vec3 rim;
  vec3 l = uAmbient + uSunColor * uSunInt * 0.8 + pointLights(position, rim);
  vLight = mix(vec3(1.0), softLight(l), uLit);
  vec3 wp = position;
  float d = distance(wp, uCamPos);
  vColor.a *= 1.0 - smoothstep(uFogNear, uFogFar, d) * 0.8;
}
`;

const frag = /* glsl */ `
varying vec4 vColor;
varying float vType;
varying float vRot;
varying vec3 vLight;
float h(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main() {
  vec2 p = gl_PointCoord * 2.0 - 1.0;
  float c = cos(vRot), s = sin(vRot);
  vec2 q = vec2(c * p.x - s * p.y, s * p.x + c * p.y);
  float a = 0.0;
  int t = int(vType + 0.5);
  if (t == 0 || t == 5) {
    float d = length(p);
    a = smoothstep(1.0, 0.0, d);
    a = t == 0 ? pow(a, 1.6) : a * a;
  } else if (t == 1) {
    float d = length(p + vec2(sin(vRot * 3.0) * 0.1, 0.0));
    a = smoothstep(1.0, 0.2, d) * (0.75 + 0.25 * h(floor(gl_PointCoord * 12.0)));
  } else if (t == 2) {
    // 叶片：带叶脉的柳叶形
    float e = (q.x * q.x) / 0.9 + (q.y * q.y) / 0.12;
    a = step(e, 1.0);
    if (abs(q.y) < 0.05 && abs(q.x) < 0.9) { gl_FragColor = vec4(vColor.rgb * 0.45 * vLight, vColor.a * a); return; }
  } else if (t == 3) {
    float e = (q.x * q.x) / 1.0 + (q.y * q.y) / 0.03;
    a = smoothstep(1.0, 0.2, e);
  } else {
    a = step(abs(q.x) + abs(q.y) * 1.6, 0.8);
  }
  if (a * vColor.a < 0.01) discard;
  gl_FragColor = vec4(vColor.rgb * vLight, vColor.a * a);
}
`;

interface P {
  x: number; y: number; z: number; vx: number; vy: number; vz: number;
  life: number; max: number; size: number; grow: number;
  r: number; g: number; b: number; a: number; fadeIn: number;
  type: number; rot: number; rotV: number; drag: number; grav: number; flutter: number;
}

export interface Emit {
  x: number; y: number; z: number; vx?: number; vy?: number; vz?: number;
  life: number; size: number; grow?: number; color: [number, number, number]; a?: number;
  type: number; rot?: number; rotV?: number; drag?: number; grav?: number; flutter?: number; fadeIn?: number;
}

export class ParticleSystem {
  points: THREE.Points;
  private ps: P[] = [];
  private posA: Float32Array; private colA: Float32Array; private parA: Float32Array;
  private geo: THREE.BufferGeometry;
  material: THREE.ShaderMaterial;
  constructor(public cap: number, additive: boolean, lit: boolean) {
    this.posA = new Float32Array(cap * 3);
    this.colA = new Float32Array(cap * 4);
    this.parA = new Float32Array(cap * 3);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.posA, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aColor', new THREE.BufferAttribute(this.colA, 4).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aParams', new THREE.BufferAttribute(this.parA, 3).setUsage(THREE.DynamicDrawUsage));
    g.setDrawRange(0, 0);
    this.geo = g;
    this.material = new THREE.ShaderMaterial({
      uniforms: { ...U, uPxScale: { value: 400 }, uLit: { value: lit ? 1 : 0 } },
      vertexShader: vert, fragmentShader: frag,
      transparent: true, depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(g, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = additive ? 5 : 4;
  }
  emit(e: Emit) {
    if (this.ps.length >= this.cap) this.ps.shift();
    this.ps.push({
      x: e.x, y: e.y, z: e.z, vx: e.vx ?? 0, vy: e.vy ?? 0, vz: e.vz ?? 0,
      life: 0, max: e.life, size: e.size, grow: e.grow ?? 0,
      r: e.color[0], g: e.color[1], b: e.color[2], a: e.a ?? 1, fadeIn: e.fadeIn ?? 0.1,
      type: e.type, rot: e.rot ?? Math.random() * 6.28, rotV: e.rotV ?? 0, drag: e.drag ?? 0, grav: e.grav ?? 0, flutter: e.flutter ?? 0,
    });
  }
  update(dt: number, wind: number) {
    const ps = this.ps;
    let w = 0;
    for (let i = 0; i < ps.length; i++) {
      const p = ps[i];
      p.life += dt;
      if (p.life >= p.max) continue;
      p.vy -= p.grav * dt;
      const dr = Math.exp(-p.drag * dt);
      p.vx *= dr; p.vy *= dr; p.vz *= dr;
      if (p.flutter) { p.vx += Math.sin(p.life * 3 + p.rot) * p.flutter * dt + wind * 0.4 * dt; p.vz += Math.cos(p.life * 2.3 + p.rot) * p.flutter * dt * 0.5; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      p.rot += p.rotV * dt;
      p.size += p.grow * dt;
      ps[w++] = p;
    }
    ps.length = w;
    for (let i = 0; i < w; i++) {
      const p = ps[i];
      const t = p.life / p.max;
      const fade = Math.min(1, p.life / Math.max(0.001, p.fadeIn * p.max)) * (1 - Math.pow(t, 2));
      this.posA[i * 3] = p.x; this.posA[i * 3 + 1] = p.y; this.posA[i * 3 + 2] = p.z;
      this.colA[i * 4] = p.r; this.colA[i * 4 + 1] = p.g; this.colA[i * 4 + 2] = p.b; this.colA[i * 4 + 3] = p.a * fade;
      this.parA[i * 3] = Math.max(0, p.size); this.parA[i * 3 + 1] = p.type; this.parA[i * 3 + 2] = p.rot;
    }
    this.geo.setDrawRange(0, w);
    (this.geo.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    (this.geo.getAttribute('aColor') as THREE.BufferAttribute).needsUpdate = true;
    (this.geo.getAttribute('aParams') as THREE.BufferAttribute).needsUpdate = true;
  }
  get count() { return this.ps.length; }
}
