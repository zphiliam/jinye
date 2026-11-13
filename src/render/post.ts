// 后期：泛光、调色、纸纹颗粒、暗角、理智扭曲（色散/波动/低语闪烁）、受伤与黑暗侵蚀
import * as THREE from 'three';
import { grainTile } from '../art/ink';

const quadVert = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const brightFrag = /* glsl */ `
uniform sampler2D tSrc;
uniform float uThreshold;
varying vec2 vUv;
void main() {
  vec3 c = texture2D(tSrc, vUv).rgb;
  float l = max(c.r, max(c.g, c.b));
  float k = smoothstep(uThreshold, uThreshold + 0.5, l);
  gl_FragColor = vec4(c * k, 1.0);
}
`;

const blurFrag = /* glsl */ `
uniform sampler2D tSrc;
uniform vec2 uDir;
varying vec2 vUv;
void main() {
  vec3 c = texture2D(tSrc, vUv).rgb * 0.227027;
  c += texture2D(tSrc, vUv + uDir * 1.3846).rgb * 0.3162162;
  c += texture2D(tSrc, vUv - uDir * 1.3846).rgb * 0.3162162;
  c += texture2D(tSrc, vUv + uDir * 3.2307).rgb * 0.0702702;
  c += texture2D(tSrc, vUv - uDir * 3.2307).rgb * 0.0702702;
  gl_FragColor = vec4(c, 1.0);
}
`;

const finalFrag = /* glsl */ `
uniform sampler2D tScene;
uniform sampler2D tBloom;
uniform sampler2D tPaper;
uniform vec2 uRes;
uniform float uTime;
uniform float uBloom;
uniform float uExposure;
uniform float uSat;
uniform float uContrast;
uniform vec3 uLift;
uniform vec3 uGain;
uniform float uVignette;
uniform float uInsane;
uniform float uHurt;
uniform float uDark;
uniform float uShafts;
uniform vec3 uShaftColor;
uniform float uFlicker;
uniform float uFade;
varying vec2 vUv;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += a * noise(p); p *= 2.03; a *= 0.5; } return s; }

vec3 tonemap(vec3 c) {
  c *= uExposure;
  // ACES 近似：保留中间调、柔化高光
  return clamp((c * (2.51 * c + 0.03)) / (c * (2.43 * c + 0.59) + 0.14), 0.0, 1.0);
}

void main() {
  vec2 uv = vUv;
  float ins = uInsane;
  vec2 asp = vec2(uRes.x / uRes.y, 1.0);
  // 理智低：画面如水波般轻轻扭动
  uv += vec2(sin(uv.y * 9.0 + uTime * 1.3) , cos(uv.x * 7.0 + uTime * 1.1)) * 0.0035 * ins * ins;
  vec2 dir = uv - 0.5;
  float ca = 0.0008 + ins * 0.007 + uHurt * 0.008;
  vec3 col;
  col.r = texture2D(tScene, uv + dir * ca).r;
  col.g = texture2D(tScene, uv).g;
  col.b = texture2D(tScene, uv - dir * ca).b;
  col += texture2D(tBloom, uv).rgb * uBloom;
  col = tonemap(col);
  // 调色：lift/gain + 对比 + 饱和
  col = col * uGain + uLift * (1.0 - col);
  col = (col - 0.45) * uContrast + 0.45;
  float l = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(vec3(l), col, uSat - ins * 0.45);
  // 黄昏光束（斜向光柱 + 浮尘）
  if (uShafts > 0.001) {
    vec2 sp = vec2(uv.x * asp.x * 0.8 + uv.y * 0.55, 0.0);
    float rays = fbm(vec2(sp.x * 6.0 + uTime * 0.05, uTime * 0.02)) * fbm(vec2(sp.x * 13.0 - uTime * 0.03, 3.0));
    rays = smoothstep(0.12, 0.45, rays) * smoothstep(1.2, 0.0, uv.y + uv.x * 0.2);
    col += uShaftColor * rays * uShafts * 0.35;
  }
  // 纸纹：纤维 + 颗粒，乘在画面上
  vec3 paper = texture2D(tPaper, uv * uRes / 300.0).rgb;
  col *= mix(vec3(1.0), paper * 1.25 + 0.38, 0.32);
  float g = hash(uv * uRes + fract(uTime * 7.0) * 100.0);
  col += (g - 0.5) * 0.045;
  // 暗角
  float vd = length(dir * asp * vec2(0.85, 1.0));
  float vig = smoothstep(0.3, 0.95, vd);
  col *= 1.0 - vig * uVignette;
  // 黑暗侵蚀：墨色从边缘爬入
  if (uDark > 0.001) {
    float n = fbm(dir * 5.0 + uTime * 0.15);
    float reach = 0.75 - uDark * 0.5;
    float m = smoothstep(reach - 0.15, reach + 0.1, vd + (n - 0.5) * 0.35);
    col = mix(col, vec3(0.0), m * min(1.0, uDark * 1.4));
  }
  // 理智极低：边缘的影子与闪烁
  if (ins > 0.35) {
    float k = (ins - 0.35) / 0.65;
    float tendr = fbm(vec2(atan(dir.y, dir.x) * 3.0, vd * 4.0 - uTime * 0.6));
    float shadow = smoothstep(0.55, 0.75, tendr) * smoothstep(0.35, 0.8, vd) * k;
    col = mix(col, vec3(0.02, 0.0, 0.01), shadow * 0.85);
    col = mix(col, vec3(1.0) - col, uFlicker * 0.12 * k);
  }
  // 受伤：血色边缘
  col = mix(col, vec3(0.45, 0.04, 0.03), uHurt * smoothstep(0.2, 0.9, vd) * 0.7);
  col *= 1.0 - uFade;
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;

export class Post {
  sceneRT: THREE.WebGLRenderTarget;
  rtA: THREE.WebGLRenderTarget; rtB: THREE.WebGLRenderTarget;
  private scene = new THREE.Scene();
  private cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private quad: THREE.Mesh;
  bright: THREE.ShaderMaterial; blur: THREE.ShaderMaterial; final: THREE.ShaderMaterial;
  constructor(private renderer: THREE.WebGLRenderer, w: number, h: number) {
    const opts = { type: THREE.HalfFloatType, depthBuffer: true, samples: (window as unknown as { __msaa?: number }).__msaa ?? 4 };
    this.sceneRT = new THREE.WebGLRenderTarget(w, h, opts);
    this.rtA = new THREE.WebGLRenderTarget(Math.ceil(w / 4), Math.ceil(h / 4), { type: THREE.HalfFloatType, depthBuffer: false });
    this.rtB = this.rtA.clone();
    this.bright = new THREE.ShaderMaterial({ uniforms: { tSrc: { value: null }, uThreshold: { value: 0.9 } }, vertexShader: quadVert, fragmentShader: brightFrag, depthTest: false });
    this.blur = new THREE.ShaderMaterial({ uniforms: { tSrc: { value: null }, uDir: { value: new THREE.Vector2() } }, vertexShader: quadVert, fragmentShader: blurFrag, depthTest: false });
    const paper = new THREE.CanvasTexture(grainTile());
    paper.wrapS = paper.wrapT = THREE.RepeatWrapping;
    paper.colorSpace = THREE.NoColorSpace;
    this.final = new THREE.ShaderMaterial({
      uniforms: {
        tScene: { value: null }, tBloom: { value: null }, tPaper: { value: paper },
        uRes: { value: new THREE.Vector2(w, h) }, uTime: { value: 0 },
        uBloom: { value: 0.8 }, uExposure: { value: 1.35 }, uSat: { value: 0.9 }, uContrast: { value: 1.08 },
        uLift: { value: new THREE.Vector3(0.02, 0.015, 0.01) }, uGain: { value: new THREE.Vector3(1, 0.97, 0.9) },
        uVignette: { value: 0.55 }, uInsane: { value: 0 }, uHurt: { value: 0 }, uDark: { value: 0 },
        uShafts: { value: 0 }, uShaftColor: { value: new THREE.Vector3(1, 0.6, 0.3) }, uFlicker: { value: 0 }, uFade: { value: 0 },
      },
      vertexShader: quadVert, fragmentShader: finalFrag, depthTest: false,
    });
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.final);
    this.quad.frustumCulled = false;
    this.scene.add(this.quad);
  }
  setSize(w: number, h: number) {
    this.sceneRT.setSize(w, h);
    this.rtA.setSize(Math.ceil(w / 4), Math.ceil(h / 4));
    this.rtB.setSize(Math.ceil(w / 4), Math.ceil(h / 4));
    this.final.uniforms.uRes.value.set(w, h);
  }
  private pass(mat: THREE.ShaderMaterial, target: THREE.WebGLRenderTarget | null) {
    this.quad.material = mat;
    this.renderer.setRenderTarget(target);
    this.renderer.render(this.scene, this.cam);
  }
  render(scene: THREE.Scene, camera: THREE.Camera) {
    const r = this.renderer;
    if ((window as unknown as { __nopost?: boolean }).__nopost) { r.setRenderTarget(null); r.clear(); r.render(scene, camera); return; }
    r.setRenderTarget(this.sceneRT);
    r.clear();
    r.render(scene, camera);
    this.bright.uniforms.tSrc.value = this.sceneRT.texture;
    this.pass(this.bright, this.rtA);
    const w = this.rtA.width, h = this.rtA.height;
    for (let i = 0; i < 2; i++) {
      this.blur.uniforms.tSrc.value = this.rtA.texture; this.blur.uniforms.uDir.value.set((1 + i) / w, 0);
      this.pass(this.blur, this.rtB);
      this.blur.uniforms.tSrc.value = this.rtB.texture; this.blur.uniforms.uDir.value.set(0, (1 + i) / h);
      this.pass(this.blur, this.rtA);
    }
    this.final.uniforms.tScene.value = this.sceneRT.texture;
    this.final.uniforms.tBloom.value = this.rtA.texture;
    this.pass(this.final, null);
  }
}
