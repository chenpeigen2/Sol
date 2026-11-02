import * as THREE from 'three';
import { NOISE_GLSL } from './glsl';

const PLANET_VERT = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>

varying vec2 vUv;
varying vec3 vNormalW;
varying vec3 vWorldPos;
void main(){
  vUv = uv;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  vNormalW = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * wp;
  #include <logdepthbuf_vertex>
}
`;

const PLANET_FRAG = /* glsl */ `
precision highp float;
#include <common>
#include <logdepthbuf_pars_fragment>

varying vec2 vUv;
varying vec3 vNormalW;
varying vec3 vWorldPos;

uniform sampler2D uMap;
uniform sampler2D uNightMap;
uniform float uHasNight;
uniform vec3  uSunDir;
uniform vec3  uSunColor;
uniform float uSunIntensity;
uniform vec3  uAmbient;
uniform float uNightIntensity;
uniform vec3  uRimColor;
uniform float uRimStrength;
uniform vec3  uAtmoColor;
uniform float uAtmoStrength;
uniform float uEarth;
uniform float uRelief;
uniform vec2 uTexel;

// Derivative bump mapping: local tonal detail creates small-scale relief, not silhouette noise.
vec3 surfaceNormal(vec3 normal, vec3 albedo) {
  vec3 q0 = dFdx(vWorldPos), q1 = dFdy(vWorldPos);
  float h = dot(albedo, vec3(0.2126, 0.7152, 0.0722));
  vec3 r1 = cross(q1, normal), r2 = cross(normal, q0);
  float det = dot(q0, r1);
  vec3 gradient = sign(det) * (dFdx(h) * r1 + dFdy(h) * r2);
  return normalize(abs(det) * normal - gradient * uRelief);
}

void main(){
  vec3 base = texture2D(uMap, vUv).rgb;
  vec3 geometricNormal = normalize(vNormalW);
  vec3 N = surfaceNormal(geometricNormal, base);
  vec3 V = normalize(cameraPosition - vWorldPos);
  float ndl = dot(N, uSunDir);
  float terminator = smoothstep(-0.07, 0.12, dot(geometricNormal, uSunDir));
  float diffuse = pow(max(ndl, 0.0), 0.72) * terminator;
  vec3 col = base * (uSunColor * uSunIntensity * diffuse + uAmbient);

  if (uHasNight > 0.5) {
    vec3 night = texture2D(uNightMap, vUv).rgb;
    col += night * (1.0 - smoothstep(-0.16, 0.1, ndl)) * uNightIntensity;
  }

  // Blue water glints; dry land remains matte. Imagery is already linear when sampled.
  float water = smoothstep(0.008, 0.04, base.b - max(base.r, base.g) * 0.83) * uEarth;
  vec3 H = normalize(V + uSunDir);
  float specular = pow(max(dot(N, H), 0.0), 95.0) * water * terminator;
  col += vec3(0.55, 0.68, 0.78) * specular * 0.32;

  float fres = pow(1.0 - max(dot(geometricNormal, V), 0.0), 4.5);
  float litRim = smoothstep(-0.2, 0.55, dot(geometricNormal, uSunDir));
  col += fres * uRimColor * uRimStrength * litRim;
  col += fres * uAtmoColor * uAtmoStrength * 0.12 * litRim;

  gl_FragColor = vec4(col, 1.0);
  #include <logdepthbuf_fragment>
}
`;

const CLOUD_FRAG = /* glsl */ `
precision highp float;
#include <common>
#include <logdepthbuf_pars_fragment>

varying vec2 vUv;
varying vec3 vNormalW;
varying vec3 vWorldPos;
uniform sampler2D uMap;
uniform vec3  uSunDir;
uniform vec3  uSunColor;
uniform float uSunIntensity;
uniform vec3  uAmbient;
uniform float uCloudImage;

void main(){
  vec4 tex = texture2D(uMap, vUv);
  float alpha = uCloudImage > 0.5 ? smoothstep(0.12, 0.88, tex.r) : tex.a;
  if (alpha < 0.015) discard;
  vec3 N = normalize(vNormalW);
  float ndl = dot(N, uSunDir);
  float light = pow(max(ndl, 0.0), 0.65) * smoothstep(-0.08, 0.18, ndl);
  vec3 col = vec3(0.94, 0.97, 1.0) * (uSunColor * uSunIntensity * light + uAmbient);
  gl_FragColor = vec4(col, alpha * 0.88);
  #include <logdepthbuf_fragment>
}
`;

const HALO_FRAG = /* glsl */ `
precision highp float;
#include <common>
#include <logdepthbuf_pars_fragment>

varying vec2 vUv;
varying vec3 vNormalW;
varying vec3 vWorldPos;
uniform vec3  uColor;
uniform float uStrength;
uniform vec3  uSunDir;

void main(){
  vec3 N = normalize(vNormalW);
  vec3 V = normalize(cameraPosition - vWorldPos);
  // Render the back of a thin shell. Back-facing normals need the opposite dot sign.
  float facing = clamp(-dot(N, V), 0.0, 1.0);
  float fres = pow(1.0 - facing, 5.0);
  float lit = smoothstep(-0.2, 0.55, dot(N, uSunDir));
  float a = fres * uStrength * lit;
  gl_FragColor = vec4(uColor * a, a);
  #include <logdepthbuf_fragment>
}
`;

const SUN_VERT = PLANET_VERT;

const SUN_FRAG = /* glsl */ `
precision highp float;
#include <common>
#include <logdepthbuf_pars_fragment>

varying vec2 vUv;
varying vec3 vNormalW;
varying vec3 vWorldPos;

uniform sampler2D uMap;
uniform float uTime;
uniform float uIntensity;

${NOISE_GLSL}

void main(){
  vec3 N = normalize(vNormalW);
  vec3 V = normalize(cameraPosition - vWorldPos);
  float ndv = max(dot(N, V), 0.0);
  float limb = pow(ndv, 0.42);

  vec3 tex = texture2D(uMap, vUv).rgb;
  float gran = fbm(N * 9.0 + vec3(uTime * 0.03, uTime * 0.02, 0.0), 4) * 0.5 + 0.5;
  vec3 col = tex * (0.86 + 0.30 * gran);

  // 边缘略暗，中心更亮
  col *= mix(0.72, 1.35, limb);
  col *= uIntensity;

  gl_FragColor = vec4(col, 1.0);
  #include <logdepthbuf_fragment>
}
`;

export interface PlanetMaterialOptions {
  day: THREE.Texture;
  night?: THREE.Texture;
  rimColor: number;
  rimStrength: number;
  atmoColor: number;
  atmoStrength: number;
  earth?: boolean;
  relief?: number;
}

export function createPlanetMaterial(opts: PlanetMaterialOptions): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: PLANET_VERT,
    fragmentShader: PLANET_FRAG,
    uniforms: {
      uEarth: { value: opts.earth ? 1 : 0 },
      uRelief: { value: opts.relief ?? 0 },
      uTexel: { value: new THREE.Vector2(1 / 2048, 1 / 1024) },
      uMap: { value: opts.day },
      uNightMap: { value: opts.night ?? opts.day },
      uHasNight: { value: opts.night ? 1 : 0 },
      uSunDir: { value: new THREE.Vector3(1, 0, 0) },
      uSunColor: { value: new THREE.Color(1, 0.97, 0.92) },
      uSunIntensity: { value: 1 },
      uAmbient: { value: new THREE.Color(0.018, 0.022, 0.03) },
      uNightIntensity: { value: 0.8 },
      uRimColor: { value: new THREE.Color(opts.rimColor) },
      uRimStrength: { value: opts.rimStrength },
      uAtmoColor: { value: new THREE.Color(opts.atmoColor) },
      uAtmoStrength: { value: opts.atmoStrength },
    },
  });
}

export function createCloudMaterial(day: THREE.Texture): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: PLANET_VERT,
    fragmentShader: CLOUD_FRAG,
    uniforms: {
      uCloudImage: { value: 0 },
      uMap: { value: day },
      uSunDir: { value: new THREE.Vector3(1, 0, 0) },
      uSunColor: { value: new THREE.Color(1, 0.97, 0.92) },
      uSunIntensity: { value: 1 },
      uAmbient: { value: new THREE.Color(0.035, 0.04, 0.06) },
    },
    transparent: true,
    depthWrite: false,
  });
}

export function createHaloMaterial(color: number, strength: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: PLANET_VERT,
    fragmentShader: HALO_FRAG,
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uStrength: { value: strength },
      uSunDir: { value: new THREE.Vector3(1, 0, 0) },
    },
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.BackSide,
  });
}

export function createSunMaterial(map: THREE.Texture): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: SUN_VERT,
    fragmentShader: SUN_FRAG,
    uniforms: {
      uMap: { value: map },
      uTime: { value: 0 },
      uIntensity: { value: 3.2 },
    },
  });
}
