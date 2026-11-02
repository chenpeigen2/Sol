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

void main(){
  vec3 N = normalize(vNormalW);
  vec3 V = normalize(cameraPosition - vWorldPos);
  float ndl = dot(N, uSunDir);

  // 软化的晨昏线
  float light = smoothstep(-0.20, 0.34, ndl);

  vec3 base = texture2D(uMap, vUv).rgb;
  vec3 col = base * (uSunColor * uSunIntensity * light + uAmbient);

  if (uHasNight > 0.5) {
    vec3 night = texture2D(uNightMap, vUv).rgb;
    col += night * (1.0 - light) * uNightIntensity;
  }

  float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);
  col += fres * uRimColor * uRimStrength * smoothstep(-0.55, 0.65, ndl);
  col += fres * uAtmoColor * uAtmoStrength;

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

void main(){
  vec4 tex = texture2D(uMap, vUv);
  if (tex.a < 0.02) discard;
  vec3 N = normalize(vNormalW);
  float ndl = dot(N, uSunDir);
  float light = smoothstep(-0.30, 0.42, ndl);
  vec3 col = tex.rgb * (uSunColor * uSunIntensity * light + uAmbient);
  gl_FragColor = vec4(col, tex.a * 0.9);
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
  float fres = pow(1.0 - max(dot(N, V), 0.0), 3.4);
  float lit = smoothstep(-0.7, 0.6, dot(N, uSunDir));
  float a = fres * uStrength * (0.25 + 0.75 * lit);
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
}

export function createPlanetMaterial(opts: PlanetMaterialOptions): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: PLANET_VERT,
    fragmentShader: PLANET_FRAG,
    uniforms: {
      uMap: { value: opts.day },
      uNightMap: { value: opts.night ?? opts.day },
      uHasNight: { value: opts.night ? 1 : 0 },
      uSunDir: { value: new THREE.Vector3(1, 0, 0) },
      uSunColor: { value: new THREE.Color(1, 0.97, 0.92) },
      uSunIntensity: { value: 1 },
      uAmbient: { value: new THREE.Color(0.035, 0.04, 0.06) },
      uNightIntensity: { value: 1.6 },
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
