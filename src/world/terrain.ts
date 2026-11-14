// 地形网格：按群系混合五种手绘地表，带宏观明暗、湿润、土径、崖边深渊与火光照明
import * as THREE from 'three';
import { World, WORLD, GRID } from './worldgen';
import { U, GLSL_LIGHTS } from '../render/shared';
import { groundForest, groundGrass, groundRock, groundSwamp, groundDirt, noiseTexCanvas } from '../art/ground';

function tex(c: HTMLCanvasElement, repeat = true): THREE.Texture {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.NoColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  t.anisotropy = 8;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}

const vert = /* glsl */ `
varying vec3 vWorld;
varying vec3 vNormal;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  vNormal = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const frag = /* glsl */ `
uniform sampler2D tBiome;
uniform sampler2D tExtra;
uniform sampler2D tForest;
uniform sampler2D tGrass;
uniform sampler2D tRock;
uniform sampler2D tSwamp;
uniform sampler2D tDirt;
uniform sampler2D tNoise;
uniform float uWorld;
${GLSL_LIGHTS}
varying vec3 vWorld;
varying vec3 vNormal;

vec3 tri(sampler2D t, vec2 p) {
  // 两个尺度混合，打散平铺感
  vec3 a = texture2D(t, p / 7.0).rgb;
  vec3 b = texture2D(t, vec2(p.y, -p.x) / 17.0 + 0.37).rgb;
  return mix(a, b, 0.35);
}

void main() {
  vec2 wuv = vWorld.xz / uWorld + 0.5;
  vec4 n = texture2D(tNoise, vWorld.xz * 0.012);
  vec4 n2 = texture2D(tNoise, vWorld.xz * 0.07);
  vec2 jitter = (n2.rg - 0.5) * 0.006;
  vec4 w = texture2D(tBiome, wuv + jitter);
  // 用噪声让群系交界更像手撕的纸边
  w += (vec4(n2.b, n2.g, n2.r, n.g) - 0.5) * 0.35;
  w = max(w, 0.0);
  w = pow(w, vec4(3.0));
  w /= max(dot(w, vec4(1.0)), 1e-3);
  vec2 p = vWorld.xz;
  vec3 col = tri(tForest, p) * w.r + tri(tGrass, p) * w.g + tri(tRock, p) * w.b + tri(tSwamp, p) * w.a;
  vec4 ex = texture2D(tExtra, wuv + jitter * 0.5);
  float path = smoothstep(0.25, 0.75, ex.r + (n2.g - 0.5) * 0.4);
  col = mix(col, tri(tDirt, p * 1.3), path * 0.85);
  // 宏观明暗与色偏
  col *= 0.78 + 0.42 * n.r;
  col = mix(col, col * vec3(1.05, 0.95, 0.8), smoothstep(0.5, 0.8, n.g) * 0.5);
  // 湿润：更暗更冷
  col = mix(col, col * vec3(0.6, 0.7, 0.7), ex.g * 0.55);
  // 崖边：坠入墨色深渊
  float edge = ex.b;
  col = mix(col, vec3(0.05, 0.045, 0.04), smoothstep(0.55, 1.0, edge));
  vec3 N = normalize(vNormal);
  float diff = max(dot(N, normalize(uSunDir)), 0.0);
  vec3 light = uAmbient * (0.75 + 0.25 * N.y) + uSunColor * uSunInt * (0.35 + 0.85 * diff);
  vec3 rimAcc;
  light += pointLights(vWorld, rimAcc);
  col *= softLight(light);
  col = applyFog(col, vWorld);
  gl_FragColor = vec4(col, 1.0);
}
`;

export class Terrain {
  mesh: THREE.Mesh;
  material: THREE.ShaderMaterial;
  heightTex: THREE.DataTexture;
  constructor(world: World) {
    const SEG = 320;
    const SIZE = WORLD + 60;
    const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const inside = Math.abs(x) < WORLD / 2 && Math.abs(z) < WORLD / 2;
      pos.setY(i, inside ? world.height(x, z) : -9);
    }
    geo.computeVertexNormals();
    const dataTex = (arr: Uint8Array) => {
      const t = new THREE.DataTexture(arr, GRID, GRID, THREE.RGBAFormat);
      t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearFilter;
      t.needsUpdate = true;
      return t;
    };
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        ...U,
        tBiome: { value: dataTex(world.weights) },
        tExtra: { value: dataTex(world.extra) },
        tForest: { value: tex(groundForest()) },
        tGrass: { value: tex(groundGrass()) },
        tRock: { value: tex(groundRock()) },
        tSwamp: { value: tex(groundSwamp()) },
        tDirt: { value: tex(groundDirt()) },
        tNoise: { value: tex(noiseTexCanvas()) },
        uWorld: { value: WORLD },
      },
      vertexShader: vert,
      fragmentShader: frag,
    });
    this.mesh = new THREE.Mesh(geo, this.material);
    // 高度图（阴影等贴地用）
    const N = GRID + 1;
    const hd = new Uint16Array(N * N);
    for (let i = 0; i < N * N; i++) hd[i] = THREE.DataUtils.toHalfFloat(world.heights[i]);
    const ht = new THREE.DataTexture(hd, N, N, THREE.RedFormat, THREE.HalfFloatType);
    ht.magFilter = THREE.LinearFilter; ht.minFilter = THREE.LinearFilter;
    ht.needsUpdate = true;
    this.heightTex = ht;
  }
}
