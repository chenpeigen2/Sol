import * as THREE from 'three';
import { NOISE_GLSL } from './glsl';
import { createGlowTexture, createStarTexture } from './textures';
import { createSunMaterial } from './materials';

/* ------------------------------------------------------------------ *
 * 星空
 * ------------------------------------------------------------------ */

const STAR_VERT = /* glsl */ `
attribute float aSize;
attribute float aPhase;
attribute vec3  aColor;
uniform float uTime;
uniform float uPixelRatio;
varying vec3 vColor;
varying float vAlpha;
void main(){
  vColor = aColor;
  float tw = 0.82 + 0.18 * sin(uTime * 1.7 + aPhase * 31.4);
  vAlpha = tw;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = aSize * uPixelRatio * tw;
}
`;

const STAR_FRAG = /* glsl */ `
precision mediump float;
varying vec3 vColor;
varying float vAlpha;
void main(){
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  if (d > 0.5) discard;
  float a = smoothstep(0.5, 0.0, d);
  a *= a;
  gl_FragColor = vec4(vColor * vAlpha, a);
}
`;

export interface StarField {
  points: THREE.Points;
  material: THREE.ShaderMaterial;
}

export function createStarField(count: number, radius: number, seed = 1): StarField {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const phases = new Float32Array(count);

  let s = seed;
  const rand = () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };

  for (let i = 0; i < count; i++) {
    // 均匀球面分布
    const u = rand() * 2 - 1;
    const phi = rand() * Math.PI * 2;
    const r = Math.sqrt(1 - u * u);
    positions[i * 3] = radius * r * Math.cos(phi);
    positions[i * 3 + 1] = radius * u;
    positions[i * 3 + 2] = radius * r * Math.sin(phi);

    // 恒星色温：多数偏白，少量偏蓝或偏红
    const temp = rand();
    let col: THREE.Color;
    if (temp > 0.9) col = new THREE.Color(0.72, 0.82, 1.0);
    else if (temp > 0.74) col = new THREE.Color(1.0, 0.96, 0.88);
    else if (temp > 0.16) col = new THREE.Color(1.0, 1.0, 1.0);
    else col = new THREE.Color(1.0, 0.82, 0.66);
    const b = 0.5 + Math.pow(rand(), 2.2) * 1.15;
    colors[i * 3] = col.r * b;
    colors[i * 3 + 1] = col.g * b;
    colors[i * 3 + 2] = col.b * b;

    sizes[i] = 1.0 + Math.pow(rand(), 4.2) * 4.6;
    phases[i] = rand();
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
  geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  geo.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));

  const material = new THREE.ShaderMaterial({
    vertexShader: STAR_VERT,
    fragmentShader: STAR_FRAG,
    uniforms: {
      uTime: { value: 0 },
      uPixelRatio: { value: Math.min(2, window.devicePixelRatio || 1) },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const points = new THREE.Points(geo, material);
  points.frustumCulled = false;
  points.renderOrder = -10;
  return { points, material };
}

/* ------------------------------------------------------------------ *
 * 银河带
 * ------------------------------------------------------------------ */

const GALAXY_FRAG = /* glsl */ `
precision mediump float;
varying vec3 vDir;
uniform float uIntensity;

${NOISE_GLSL}

void main(){
  vec3 d = normalize(vDir);
  vec3 axis = normalize(vec3(0.36, 0.86, 0.36));
  float band = dot(d, axis);
  float core = exp(-band * band * 34.0);
  float halo = exp(-band * band * 7.0) * 0.22;

  float n = fbm(d * 3.4, 5) * 0.5 + 0.5;
  float fine = fbm(d * 11.0 + 3.0, 4) * 0.5 + 0.5;
  float dust = smoothstep(0.46, 0.80, fbm(d * 5.5 + 12.0, 4) * 0.5 + 0.5);

  float v = (core * (0.35 + 0.85 * n) + halo) * (1.0 - 0.72 * dust);
  v *= 0.35 + 0.85 * fine;
  v = pow(max(v, 0.0), 1.6);

  vec3 col = mix(vec3(0.30, 0.36, 0.66), vec3(0.86, 0.82, 0.72), core);
  gl_FragColor = vec4(col * v * uIntensity, 1.0);
}
`;

const GALAXY_VERT = /* glsl */ `
varying vec3 vDir;
void main(){
  vDir = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export function createGalaxy(radius: number): THREE.Mesh {
  const geo = new THREE.SphereGeometry(radius, 48, 32);
  const material = new THREE.ShaderMaterial({
    vertexShader: GALAXY_VERT,
    fragmentShader: GALAXY_FRAG,
    uniforms: { uIntensity: { value: 0.30 } },
    side: THREE.BackSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const mesh = new THREE.Mesh(geo, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = -20;
  return mesh;
}

/* ------------------------------------------------------------------ *
 * 太阳本体 + 日冕
 * ------------------------------------------------------------------ */

export interface SunVisual {
  group: THREE.Group;
  material: THREE.ShaderMaterial;
  glow: THREE.Sprite;
  halo: THREE.Sprite;
}

export function createSun(texture: THREE.Texture): SunVisual {
  const group = new THREE.Group();

  const material = createSunMaterial(texture);
  const sphere = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 64), material);
  sphere.frustumCulled = false;
  group.add(sphere);

  const glowTex = createGlowTexture();

  const glow = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTex,
      color: 0xfff0d0,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false,
    }),
  );
  glow.renderOrder = 5;
  group.add(glow);

  const halo = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTex,
      color: 0xffb066,
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false,
    }),
  );
  halo.renderOrder = 4;
  group.add(halo);

  return { group, material, glow, halo };
}

export function createStarSpriteMaterial(): THREE.SpriteMaterial {
  return new THREE.SpriteMaterial({
    map: createStarTexture(),
    color: 0xffffff,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
}
