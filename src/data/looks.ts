import type { BodyLook } from '../render/textures';

/** 每个天体的程序化贴图配色 */
export const LOOKS: Record<string, BodyLook> = {
  sun: {
    a: 0xffd27a, b: 0xff8c2a, c: 0xa8300a, param: 1,
  },
  mercury: {
    a: 0x6b6058, b: 0xa2968c, c: 0x4a423c, param: 0.0,
  },
  venus: {
    a: 0xc9a05a, b: 0xf0dcae, c: 0xa97f42, param: 0.0,
  },
  earth: {
    a: 0x0b2f5c, b: 0x2f6b3a, c: 0x8a7a4e, param: 0.0,
  },
  mars: {
    a: 0x8c3a22, b: 0xc9693f, c: 0xe8d9c8, param: 0.35,
  },
  jupiter: {
    a: 0xd9c2a0, b: 0xf4ead8, c: 0xa8794f, param: 13.0,
    spot: { color: 0xd4704a, dir: [-0.55, -0.35, 0.76], size: 0.28 },
  },
  saturn: {
    a: 0xdcc79c, b: 0xf8efd8, c: 0xb59463, param: 10.0,
  },
  uranus: {
    a: 0x8fd3de, b: 0xcaf0f6, c: 0x6fb4c4, param: 6.0,
  },
  neptune: {
    a: 0x2f57b5, b: 0x5b86e0, c: 0x1e3a86, param: 8.0,
    spot: { color: 0x16295c, dir: [0.4, -0.5, 0.76], size: 0.24 },
  },
  pluto: {
    a: 0xa89580, b: 0xd8cbb8, c: 0x7a6a5c, param: 0.55,
  },
  moon: {
    a: 0x5c5852, b: 0xa8a49c, c: 0x3a3835, param: 0.0,
  },
  io: {
    a: 0xcfc04a, b: 0xf2e08a, c: 0x8c3a1e, param: 0.0,
  },
  europa: {
    a: 0xbfb39a, b: 0xf0eadc, c: 0x9a6f52, param: 0.3,
  },
  ganymede: {
    a: 0x6e6355, b: 0xa89b8c, c: 0x453d33, param: 0.25,
  },
  callisto: {
    a: 0x4f4740, b: 0x8c8175, c: 0x2e2823, param: 0.15,
  },
  titan: {
    a: 0xb87a2c, b: 0xe8b95c, c: 0x8a5a1c, param: 7.0,
  },
  enceladus: {
    a: 0xd8dee2, b: 0xffffff, c: 0xa8b4bc, param: 0.2,
  },
  iapetus: {
    a: 0x3a2f26, b: 0xd8cfc0, c: 0x6a5c4c, param: 0.5,
  },
  triton: {
    a: 0xb8c2c8, b: 0xe8eef2, c: 0x8a96a0, param: 0.25,
  },
  phobos: {
    a: 0x4e453c, b: 0x8a7d6d, c: 0x2e2823, param: 0.0,
  },
  deimos: {
    a: 0x6a6152, b: 0x9c8f7e, c: 0x413a30, param: 0.0,
  },
  charon: {
    a: 0x5a5049, b: 0x9e948b, c: 0x7a4438, param: 0.0,
  },
};

/** 大气辉光：颜色与强度 */
export const ATMOSPHERES: Record<string, { color: number; strength: number; rim: number; rimStrength: number }> = {
  earth: { color: 0x5c9bff, strength: 0.5, rim: 0x8fc4ff, rimStrength: 0.3 },
  venus: { color: 0xffd9a0, strength: 0.42, rim: 0xffe9c0, rimStrength: 0.26 },
  mars: { color: 0xd98a63, strength: 0.16, rim: 0xe8a070, rimStrength: 0.18 },
  jupiter: { color: 0xffd9a8, strength: 0.2, rim: 0xffe6c0, rimStrength: 0.2 },
  saturn: { color: 0xffe9b8, strength: 0.2, rim: 0xfff0d0, rimStrength: 0.18 },
  uranus: { color: 0x9fe6f0, strength: 0.24, rim: 0xc8f2fa, rimStrength: 0.24 },
  neptune: { color: 0x6a9cff, strength: 0.3, rim: 0x9cc0ff, rimStrength: 0.26 },
  pluto: { color: 0xc9b6a4, strength: 0.1, rim: 0xd8c8b8, rimStrength: 0.1 },
  titan: { color: 0xffb45a, strength: 0.38, rim: 0xffd08a, rimStrength: 0.26 },
  io: { color: 0xffe08a, strength: 0.12, rim: 0xfff0c0, rimStrength: 0.12 },
};
