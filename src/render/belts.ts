import * as THREE from 'three';
import { DEG } from '../core/kepler';

/**
 * 小行星带 / 柯伊伯带。
 * 轨道在顶点着色器里求解（GPU 版开普勒方程），CPU 只负责生成静态根数。
 */

const BELT_VERT = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>

attribute vec3 aEx;      // 半长轴方向
attribute vec3 aEy;      // 半短轴方向
attribute vec3 aParam;   // (a, e, M0°)
attribute float aRate;   // 平近点角速度 °/天
attribute vec3 aRot;
attribute float aScale;
attribute vec3 aTint;

uniform float uDays;

varying vec3 vColor;
varying vec3 vNormalW;
varying vec3 vWorldPos;

float normDeg(float d){
  d = mod(d, 360.0);
  if (d > 180.0) d -= 360.0;
  if (d < -180.0) d += 360.0;
  return d;
}

float kepler(float M, float e){
  float E = M + e * sin(M);
  for (int i = 0; i < 5; i++){
    float f = E - e * sin(E) - M;
    E -= f / (1.0 - e * cos(E));
  }
  return E;
}

void main(){
  float a = aParam.x;
  float e = aParam.y;
  float M = normDeg(aParam.z + aRate * uDays) * 0.0174532925;
  float E = kepler(M, e);
  float xp = a * (cos(E) - e);
  float yp = a * sqrt(max(0.0, 1.0 - e * e)) * sin(E);
  vec3 center = aEx * xp + aEy * yp;

  float cx = cos(aRot.x), sx = sin(aRot.x);
  float cy = cos(aRot.y), sy = sin(aRot.y);
  float cz = cos(aRot.z), sz = sin(aRot.z);
  mat3 rotX = mat3(1.0, 0.0, 0.0,  0.0, cx, -sx,  0.0, sx, cx);
  mat3 rotY = mat3(cy, 0.0, -sy,   0.0, 1.0, 0.0,   sy, 0.0, cy);
  mat3 rotZ = mat3(cz, sz, 0.0,  -sz, cz, 0.0,   0.0, 0.0, 1.0);
  mat3 rot = rotZ * rotY * rotX;

  vec3 local = rot * (position * aScale);
  vec4 world = modelMatrix * vec4(center + local, 1.0);
  vWorldPos = world.xyz;
  vNormalW = normalize(mat3(modelMatrix) * rot * normal);
  vColor = aTint;

  vec4 mv = viewMatrix * world;
  gl_Position = projectionMatrix * mv;

  #include <logdepthbuf_vertex>
}
`;

const BELT_FRAG = /* glsl */ `
precision mediump float;
#include <common>
#include <logdepthbuf_pars_fragment>

varying vec3 vColor;
varying vec3 vNormalW;
varying vec3 vWorldPos;
void main(){
  vec3 N = normalize(vNormalW);
  vec3 L = normalize(-vWorldPos);       // 太阳在原点
  float ndl = max(dot(N, L), 0.0);
  float light = 0.12 + 0.88 * smoothstep(-0.1, 0.6, ndl);
  gl_FragColor = vec4(vColor * light, 1.0);

  #include <logdepthbuf_fragment>
}
`;

export interface BeltOptions {
  count: number;
  /** 半长轴范围（AU） */
  aMin: number;
  aMax: number;
  /** 偏心率范围 */
  eMax: number;
  /** 倾角范围（度） */
  iMax: number;
  /** 显示半径（世界单位） */
  sizeMin: number;
  sizeMax: number;
  color: [number, number, number];
  seed: number;
  /** 平近点角速度倍率（相对于 1/r^1.5 的开普勒第三定律） */
  rateScale?: number;
}

export interface Belt {
  mesh: THREE.Mesh;
  material: THREE.ShaderMaterial;
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createBelt(opts: BeltOptions): Belt {
  const rand = mulberry32(opts.seed);
  const count = opts.count;

  const base = new THREE.IcosahedronGeometry(1, 0);
  const geo = new THREE.InstancedBufferGeometry();
  geo.index = base.index;
  geo.setAttribute('position', base.getAttribute('position'));
  geo.setAttribute('normal', base.getAttribute('normal'));
  if (base.getAttribute('uv')) geo.setAttribute('uv', base.getAttribute('uv'));

  const ex = new Float32Array(count * 3);
  const ey = new Float32Array(count * 3);
  const param = new Float32Array(count * 3);
  const rate = new Float32Array(count);
  const rot = new Float32Array(count * 3);
  const scale = new Float32Array(count);
  const tint = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    const a = opts.aMin + rand() * (opts.aMax - opts.aMin);
    const e = rand() * rand() * opts.eMax;
    const inc = (rand() * 2 - 1) * opts.iMax * DEG;
    const node = rand() * Math.PI * 2;
    const argPeri = rand() * Math.PI * 2;

    const cw = Math.cos(argPeri);
    const sw = Math.sin(argPeri);
    const cn = Math.cos(node);
    const sn = Math.sin(node);
    const ci = Math.cos(inc);
    const si = Math.sin(inc);

    ex[i * 3] = cw * cn - sw * sn * ci;
    ex[i * 3 + 1] = cw * sn + sw * cn * ci;
    ex[i * 3 + 2] = sw * si;

    ey[i * 3] = -sw * cn - cw * sn * ci;
    ey[i * 3 + 1] = -sw * sn + cw * cn * ci;
    ey[i * 3 + 2] = cw * si;

    param[i * 3] = a;
    param[i * 3 + 1] = e;
    param[i * 3 + 2] = rand() * 360;

    // 平近点角速度：开普勒第三定律 n = 360 / (365.25 * a^1.5) 度/天
    const n = (360 / (365.25 * Math.pow(a, 1.5))) * (opts.rateScale ?? 1);
    rate[i] = n;

    rot[i * 3] = rand() * Math.PI * 2;
    rot[i * 3 + 1] = rand() * Math.PI * 2;
    rot[i * 3 + 2] = rand() * Math.PI * 2;

    const s = opts.sizeMin + rand() * (opts.sizeMax - opts.sizeMin);
    scale[i] = s;

    const shade = 0.55 + rand() * 0.45;
    tint[i * 3] = opts.color[0] * shade;
    tint[i * 3 + 1] = opts.color[1] * shade;
    tint[i * 3 + 2] = opts.color[2] * shade;
  }

  geo.setAttribute('aEx', new THREE.InstancedBufferAttribute(ex, 3));
  geo.setAttribute('aEy', new THREE.InstancedBufferAttribute(ey, 3));
  geo.setAttribute('aParam', new THREE.InstancedBufferAttribute(param, 3));
  geo.setAttribute('aRate', new THREE.InstancedBufferAttribute(rate, 1));
  geo.setAttribute('aRot', new THREE.InstancedBufferAttribute(rot, 3));
  geo.setAttribute('aScale', new THREE.InstancedBufferAttribute(scale, 1));
  geo.setAttribute('aTint', new THREE.InstancedBufferAttribute(tint, 3));
  geo.instanceCount = count;
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), opts.aMax * 100 + 10);

  const material = new THREE.ShaderMaterial({
    vertexShader: BELT_VERT,
    fragmentShader: BELT_FRAG,
    uniforms: {
      uDays: { value: 0 },
    },
  });

  const mesh = new THREE.Mesh(geo, material);
  mesh.frustumCulled = false;
  return { mesh, material };
}
