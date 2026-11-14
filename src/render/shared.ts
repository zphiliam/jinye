// 全局共享的光照/雾/时间 uniform 与 GLSL 片段
import * as THREE from 'three';

export const MAX_LIGHTS = 12;

export const U = {
  uTime: { value: 0 },
  uAmbient: { value: new THREE.Color(0.5, 0.48, 0.44) },
  uSunColor: { value: new THREE.Color(1, 0.95, 0.85) },
  uSunDir: { value: new THREE.Vector3(0.4, 0.8, 0.3).normalize() },
  uSunInt: { value: 0.6 },
  uFogColor: { value: new THREE.Color(0.75, 0.7, 0.6) },
  uFogNear: { value: 30 },
  uFogFar: { value: 90 },
  uCamPos: { value: new THREE.Vector3() },
  uCamRight: { value: new THREE.Vector3(1, 0, 0) },
  uCamUp: { value: new THREE.Vector3(0, 1, 0) },
  uWind: { value: 1 },
  uLightPos: { value: Array.from({ length: MAX_LIGHTS }, () => new THREE.Vector4(0, -100, 0, 1)) },
  uLightCol: { value: Array.from({ length: MAX_LIGHTS }, () => new THREE.Vector4(0, 0, 0, 0)) },
  uNight: { value: 0 },
};

export const GLSL_LIGHTS = /* glsl */ `
#define MAX_LIGHTS ${MAX_LIGHTS}
uniform vec3 uAmbient;
uniform vec3 uSunColor;
uniform vec3 uSunDir;
uniform float uSunInt;
uniform vec3 uFogColor;
uniform float uFogNear;
uniform float uFogFar;
uniform vec3 uCamPos;
uniform vec4 uLightPos[MAX_LIGHTS];
uniform vec4 uLightCol[MAX_LIGHTS];
uniform float uTime;
uniform float uNight;

// 火光：暖色、平方衰减，近处偏白热
vec3 pointLights(vec3 wp, out vec3 rimDirAcc) {
  vec3 acc = vec3(0.0);
  rimDirAcc = vec3(0.0);
  for (int i = 0; i < MAX_LIGHTS; i++) {
    vec4 lp = uLightPos[i];
    vec4 lc = uLightCol[i];
    if (lc.w <= 0.0) continue;
    vec3 d = lp.xyz - wp;
    float dist = length(vec3(d.x, d.y * 0.6, d.z));
    float t = clamp(1.0 - dist / lp.w, 0.0, 1.0);
    // 平方衰减：核心明亮、边缘柔和地沉入黑暗；中心只留一点暖白，不再整片漂白
    // 线性尾巴：光圈边缘仍有一圈昏暗的暖光，与玩法上的“安全光圈”大致吻合
    float att = t * t * 0.55 + t * 0.45;
    vec3 c = lc.rgb * lc.w * att;
    c += vec3(1.0, 0.78, 0.5) * pow(t, 8.0) * lc.w * 0.22;
    acc += c;
    rimDirAcc += vec3(normalize(d.xz + 1e-4) * att * lc.w, att * lc.w).xzy;
  }
  return acc;
}

// 光照软肩：总照度超过 1 后渐进压缩，火边的纸色不会被乘爆成白色
vec3 softLight(vec3 l) {
  vec3 o = max(l - 1.0, 0.0);
  return min(l, 1.0) + o / (1.0 + o * 1.4);
}

vec3 applyFog(vec3 col, vec3 wp) {
  float d = distance(wp, uCamPos);
  float f = smoothstep(uFogNear, uFogFar, d);
  return mix(col, uFogColor, f);
}
`;
