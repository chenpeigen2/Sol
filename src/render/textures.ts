import * as THREE from 'three';
import { NOISE_GLSL, QUAD_VERT } from './glsl';
import type { TextureKind } from '../data/bodies';

/* ------------------------------------------------------------------ *
 * 表面贴图生成（GPU，一次性烘焙进 RenderTarget）
 * ------------------------------------------------------------------ */

const SURFACE_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;

uniform int   uMode;      // 0 岩质 1 气态 2 地球 3 城市灯光 4 云层 5 冰 6 太阳
uniform float uSeed;
uniform vec3  uColA;
uniform vec3  uColB;
uniform vec3  uColC;
uniform vec3  uSpotColor;
uniform vec3  uSpotDir;
uniform float uParam;
uniform float uSpotSize;

${NOISE_GLSL}

vec3 sphereDir(vec2 uv){
  float lon = uv.x * 6.28318530718;
  float lat = (uv.y - 0.5) * 3.14159265359;
  float cl = cos(lat);
  return vec3(cl * cos(lon), sin(lat), cl * sin(lon));
}

// 地球海陆掩膜
float landMask(vec3 d){
  float w = fbm(d * 1.55 + uSeed * 3.7, 4);
  vec3 q = d * 2.35 + vec3(w * 0.95, w * 0.55, -w * 0.72);
  return fbm(q + uSeed, 6) * 0.5 + 0.5;
}

void main(){
  vec3 d = sphereDir(vUv);
  vec3 col = vec3(0.0);

  if (uMode == 0){
    // 岩质 / 尘土表面
    float base = fbm(d * 3.1 + uSeed, 5) * 0.5 + 0.5;
    float fine = fbm(d * 11.0 + uSeed * 2.3, 4) * 0.5 + 0.5;
    float cr   = ridged(d * 6.5 + uSeed * 1.1, 4);
    col = mix(uColA, uColB, smoothstep(0.30, 0.72, base));
    col = mix(col, uColC, smoothstep(0.52, 0.92, fine) * 0.42);
    col *= 0.80 + 0.40 * cr;
    float frost = smoothstep(0.76, 0.99, abs(d.y));
    col = mix(col, vec3(0.93, 0.95, 1.0), frost * uParam);
  } else if (uMode == 1){
    // 气态巨行星：纬度带 + 湍流 + 大红斑
    float warp  = fbm(d * 2.2 + uSeed, 4);
    float bands = sin(d.y * uParam + warp * 1.35);
    float turb  = fbm(vec3(d.x * 4.0, d.y * 16.0, d.z * 4.0) + uSeed * 1.7, 4);
    float t = clamp(0.5 + 0.44 * bands + 0.13 * turb, 0.0, 1.0);
    col = mix(uColA, uColB, smoothstep(0.10, 0.90, t));
    col = mix(col, uColC, smoothstep(0.70, 0.99, t) * 0.55);
    float sd = acos(clamp(dot(d, normalize(uSpotDir)), -1.0, 1.0));
    col = mix(col, uSpotColor, smoothstep(uSpotSize, uSpotSize * 0.35, sd) * 0.85);
  } else if (uMode == 2){
    // 地球
    float lm = landMask(d);
    float humid = fbm(d * 4.2 + 11.0, 4) * 0.5 + 0.5;
    vec3 deep    = uColA;
    vec3 shallow = mix(uColA, vec3(0.035, 0.22, 0.30), 0.75);
    vec3 ground  = mix(uColB, uColC, smoothstep(0.30, 0.74, humid));
    float ice = smoothstep(0.80, 0.96, abs(d.y));
    ground = mix(ground, vec3(0.87, 0.91, 1.0), ice);
    vec3 water = mix(shallow, deep, smoothstep(0.50, 0.62, lm));
    col = mix(water, ground, smoothstep(0.555, 0.60, lm));
  } else if (uMode == 3){
    // 夜间城市灯光
    float lm = landMask(d);
    float isLand = smoothstep(0.56, 0.60, lm);
    float cities = pow(max(0.0, fbm(d * 24.0 + 5.0, 4) * 0.5 + 0.5), 7.0);
    float cluster = pow(max(0.0, fbm(d * 3.1 + 21.0, 3) * 0.5 + 0.5), 3.0);
    float lights = isLand * (cities * 4.5 + 0.14 * cluster);
    lights *= 1.0 - smoothstep(0.80, 0.99, abs(d.y));
    col = vec3(1.0, 0.76, 0.42) * lights;
  } else if (uMode == 4){
    // 云层（写在 alpha 通道）
    float w = fbm(d * 2.2 + 7.0, 4);
    vec3 q = d * 3.1 + vec3(w * 1.25);
    float c = fbm(q + 3.0, 5) * 0.5 + 0.5;
    float a = smoothstep(0.54, 0.82, c);
    col = vec3(1.0);
    gl_FragColor = vec4(vec3(1.0), a * 0.85);
    return;
  } else if (uMode == 5){
    // 冰质世界
    float base = fbm(d * 3.4 + uSeed, 5) * 0.5 + 0.5;
    float cracks = ridged(d * 5.6 + uSeed * 2.0, 4);
    col = mix(uColA, uColB, base);
    col = mix(col, uColC, smoothstep(0.52, 0.92, cracks) * 0.65);
  } else {
    // 太阳米粒组织
    float gran = fbm(d * 20.0 + uSeed, 5) * 0.5 + 0.5;
    float big  = fbm(d * 4.6 + uSeed * 3.0, 4) * 0.5 + 0.5;
    float t = gran * 0.62 + big * 0.38;
    col = mix(uColA, uColB, t);
    float spots = smoothstep(0.70, 0.86, fbm(d * 8.0 + 13.0, 4) * 0.5 + 0.5);
    col = mix(col, uColC, spots * 0.75);
  }

  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;

export interface BodyTextures {
  day: THREE.Texture;
  night?: THREE.Texture;
  clouds?: THREE.Texture;
}

export interface BodyLook {
  a: number;
  b: number;
  c: number;
  /** 岩质：极冠强度；气态：纬度带密度；冰质：裂缝强度 */
  param: number;
  spot?: { color: number; dir: [number, number, number]; size: number };
  clouds?: boolean;
}

function renderQuad(
  renderer: THREE.WebGLRenderer,
  fragmentShader: string,
  uniforms: Record<string, THREE.IUniform>,
  width: number,
  height: number,
): THREE.Texture {
  const target = new THREE.WebGLRenderTarget(width, height, {
    minFilter: THREE.LinearMipmapLinearFilter,
    magFilter: THREE.LinearFilter,
    generateMipmaps: true,
    depthBuffer: false,
    stencilBuffer: false,
  });
  target.texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const material = new THREE.ShaderMaterial({
    vertexShader: QUAD_VERT,
    fragmentShader,
    uniforms,
    depthTest: false,
    depthWrite: false,
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  scene.add(quad);

  const prevTarget = renderer.getRenderTarget();
  renderer.setRenderTarget(target);
  renderer.render(scene, camera);
  renderer.setRenderTarget(prevTarget);

  quad.geometry.dispose();
  material.dispose();
  return target.texture;
}

export function createBodyTextures(
  renderer: THREE.WebGLRenderer,
  kind: TextureKind,
  seed: number,
  look: BodyLook,
  width = 1024,
): BodyTextures {
  const W = width;
  const H = width / 2;

  const common = () => ({
    uMode: { value: 0 },
    uSeed: { value: seed },
    // three 的 Color 构造器已自动把 sRGB 十六进制转到线性工作空间，不再二次转换
    uColA: { value: new THREE.Color(look.a) },
    uColB: { value: new THREE.Color(look.b) },
    uColC: { value: new THREE.Color(look.c) },
    uSpotColor: { value: new THREE.Color(look.spot?.color ?? 0xffffff) },
    uSpotDir: { value: new THREE.Vector3(...(look.spot?.dir ?? [0, 0, 1])) },
    uParam: { value: look.param },
    uSpotSize: { value: look.spot?.size ?? 0.2 },
  });

  let mode = 0;
  if (kind === 'gas') mode = 1;
  else if (kind === 'earth') mode = 2;
  else if (kind === 'ice') mode = 5;
  else if (kind === 'sun') mode = 6;

  const dayUniforms = common();
  dayUniforms.uMode.value = mode;
  const day = renderQuad(renderer, SURFACE_FRAG, dayUniforms, W, H);

  const result: BodyTextures = { day };

  if (kind === 'earth') {
    const nightUniforms = common();
    nightUniforms.uMode.value = 3;
    result.night = renderQuad(renderer, SURFACE_FRAG, nightUniforms, W, H);

    const cloudUniforms = common();
    cloudUniforms.uMode.value = 4;
    result.clouds = renderQuad(renderer, SURFACE_FRAG, cloudUniforms, W, H);
  }

  return result;
}

/* ------------------------------------------------------------------ *
 * 精灵与环系贴图（CPU 生成）
 * ------------------------------------------------------------------ */

export function createRadialTexture(
  size: number,
  stops: Array<[number, string]>,
  inner = 0.0,
): THREE.Texture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(size / 2, size / 2, size * inner, size / 2, size / 2, size / 2);
  for (const [offset, color] of stops) grad.addColorStop(offset, color);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createGlowTexture(): THREE.Texture {
  return createRadialTexture(512, [
    [0.0, 'rgba(255,255,255,1)'],
    [0.12, 'rgba(255,240,205,0.92)'],
    [0.28, 'rgba(255,190,110,0.42)'],
    [0.55, 'rgba(255,140,60,0.12)'],
    [1.0, 'rgba(255,120,40,0)'],
  ]);
}

export function createStarTexture(): THREE.Texture {
  return createRadialTexture(64, [
    [0.0, 'rgba(255,255,255,1)'],
    [0.25, 'rgba(255,255,255,0.75)'],
    [1.0, 'rgba(255,255,255,0)'],
  ]);
}

/** 弥散尘埃盘的径向密度剖面（1D alpha） */
export function createHazeTexture(gaps: number[] = []): THREE.Texture {
  const W = 1024;
  const data = new Uint8Array(W * 4);

  for (let i = 0; i < W; i++) {
    const t = i / (W - 1);
    // 中间密、边缘疏
    let a = Math.exp(-Math.pow((t - 0.48) / 0.30, 2) * 2.2);
    // 细密密度波
    a *= 0.86 + 0.14 * Math.sin(t * 97.0);
    for (const g of gaps) {
      const d = Math.abs(t - g);
      a *= 1 - 0.88 * Math.exp(-Math.pow(d / 0.016, 2));
    }
    a = Math.max(0, Math.min(1, a));
    const o = i * 4;
    data[o] = 255;
    data[o + 1] = 255;
    data[o + 2] = 255;
    data[o + 3] = Math.round(a * 255);
  }

  const tex = new THREE.DataTexture(data, W, 1, THREE.RGBAFormat);
  tex.needsUpdate = true;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.colorSpace = THREE.NoColorSpace;
  return tex;
}

/** 土星环：沿半径方向 1.11 → 2.32 土星半径 */
export function createRingTexture(): THREE.Texture {
  const W = 1024;
  const data = new Uint8Array(W * 4);

  const hash = (x: number) => {
    let h = Math.imul(x, 374761393) + 668265263;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  };
  const noise = (x: number) => {
    const i = Math.floor(x);
    const f = x - i;
    const u = f * f * (3 - 2 * f);
    return hash(i) * (1 - u) + hash(i + 1) * u;
  };
  const fbm = (x: number) => {
    let s = 0;
    let a = 0.5;
    let f = 1;
    for (let o = 0; o < 5; o++) {
      s += a * noise(x * f);
      f *= 2.1;
      a *= 0.5;
    }
    return s;
  };

  for (let i = 0; i < W; i++) {
    const t = i / (W - 1); // 0 = 内缘
    const r = 1.11 + t * (2.32 - 1.11); // 以土星半径为单位

    let alpha = 0;
    let bright = 0.75;

    if (r < 1.24) {
      // D 环：极淡
      alpha = 0.04 + 0.05 * fbm(t * 90);
      bright = 0.45;
    } else if (r < 1.52) {
      // C 环：半透明
      alpha = 0.22 + 0.16 * fbm(t * 160);
      bright = 0.6;
    } else if (r < 1.95) {
      // B 环：最亮最厚
      alpha = 0.78 + 0.2 * fbm(t * 200);
      bright = 1.0;
    } else if (r < 2.025) {
      // 卡西尼环缝
      alpha = 0.05 + 0.04 * fbm(t * 120);
      bright = 0.5;
    } else if (r < 2.27) {
      // A 环
      alpha = 0.5 + 0.22 * fbm(t * 170);
      bright = 0.85;
    } else {
      // F 环
      alpha = 0.28 * Math.exp(-Math.pow((r - 2.32) / 0.02, 2));
      bright = 0.9;
    }

    // 细密的环缝纹理
    const fine = fbm(t * 320);
    alpha *= 0.78 + 0.42 * fine;
    alpha = Math.max(0, Math.min(1, alpha));

    const o = i * 4;
    data[o] = Math.round(255 * bright * 0.95);
    data[o + 1] = Math.round(255 * bright * 0.9);
    data[o + 2] = Math.round(255 * bright * 0.79);
    data[o + 3] = Math.round(alpha * 255);
  }

  const tex = new THREE.DataTexture(data, W, 1, THREE.RGBAFormat);
  tex.needsUpdate = true;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.colorSpace = THREE.NoColorSpace;
  return tex;
}
