/**
 * 开普勒轨道力学。
 *
 * 坐标约定：天文黄道坐标系（右手系，Z 指向北黄极，X 指向春分点）。
 * 三维场景中映射为 scene(x=ecl.x, y=ecl.z, z=-ecl.y)，保持右手系。
 */

export const DEG = Math.PI / 180;
export const RAD = 180 / Math.PI;

/** 轨道根数：a=半长轴(AU)，e=偏心率，i=倾角(°)，L=平黄经(°)，peri=近日点黄经(°)，node=升交点黄经(°) */
export interface Elements {
  a: number;
  e: number;
  i: number;
  L: number;
  peri: number;
  node: number;
}

/** 每儒略世纪的根数变化率 */
export type ElementRates = { [K in keyof Elements]: number };

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export function elementsAt(base: Elements, rates: ElementRates | undefined, T: number): Elements {
  if (!rates) return { ...base };
  return {
    a: base.a + rates.a * T,
    e: base.e + rates.e * T,
    i: base.i + rates.i * T,
    L: base.L + rates.L * T,
    peri: base.peri + rates.peri * T,
    node: base.node + rates.node * T,
  };
}

/** 归一化到 [-180, 180) */
export function normalizeAngle(deg: number): number {
  let d = deg % 360;
  if (d >= 180) d -= 360;
  if (d < -180) d += 360;
  return d;
}

/** 牛顿迭代解开普勒方程 M = E - e·sinE */
export function solveKepler(M: number, e: number): number {
  let E = M + e * Math.sin(M);
  for (let k = 0; k < 12; k++) {
    const f = E - e * Math.sin(E) - M;
    const fp = 1 - e * Math.cos(E);
    const d = f / fp;
    E -= d;
    if (Math.abs(d) < 1e-11) break;
  }
  return E;
}

/** 由根数求黄道直角坐标位置（AU） */
export function positionFromElements(el: Elements): Vec3 {
  const w = (el.peri - el.node) * DEG; // 近日点角距
  const M = normalizeAngle(el.L - el.peri) * DEG;
  const E = solveKepler(M, el.e);
  const xp = el.a * (Math.cos(E) - el.e);
  const yp = el.a * Math.sqrt(Math.max(0, 1 - el.e * el.e)) * Math.sin(E);

  const cw = Math.cos(w);
  const sw = Math.sin(w);
  const cn = Math.cos(el.node * DEG);
  const sn = Math.sin(el.node * DEG);
  const ci = Math.cos(el.i * DEG);
  const si = Math.sin(el.i * DEG);

  return {
    x: (cw * cn - sw * sn * ci) * xp + (-sw * cn - cw * sn * ci) * yp,
    y: (cw * sn + sw * cn * ci) * xp + (-sw * sn + cw * cn * ci) * yp,
    z: sw * si * xp + cw * si * yp,
  };
}

export interface OrbitBasis {
  /** 半长轴方向单位向量 */
  ex: Vec3;
  /** 半短轴方向单位向量 */
  ey: Vec3;
}

/** 计算轨道在黄道面内的基向量，避免每帧重复计算旋转矩阵 */
export function orbitBasis(el: Elements): OrbitBasis {
  const w = (el.peri - el.node) * DEG;
  const cw = Math.cos(w);
  const sw = Math.sin(w);
  const cn = Math.cos(el.node * DEG);
  const sn = Math.sin(el.node * DEG);
  const ci = Math.cos(el.i * DEG);
  const si = Math.sin(el.i * DEG);
  return {
    ex: { x: cw * cn - sw * sn * ci, y: cw * sn + sw * cn * ci, z: sw * si },
    ey: { x: -sw * cn - cw * sn * ci, y: -sw * sn + cw * cn * ci, z: cw * si },
  };
}

/** 用基向量 + 平近点角求位置（AU） */
export function positionFromBasis(basis: OrbitBasis, a: number, e: number, Mdeg: number): Vec3 {
  const M = normalizeAngle(Mdeg) * DEG;
  const E = solveKepler(M, e);
  const xp = a * (Math.cos(E) - e);
  const yp = a * Math.sqrt(Math.max(0, 1 - e * e)) * Math.sin(E);
  return {
    x: basis.ex.x * xp + basis.ey.x * yp,
    y: basis.ex.y * xp + basis.ey.y * yp,
    z: basis.ex.z * xp + basis.ey.z * yp,
  };
}

/** 采样一整条椭圆轨道，用于绘制轨道线 */
export function sampleOrbit(el: Elements, segments = 256): Float32Array {
  const out = new Float32Array(segments * 3);
  const w = (el.peri - el.node) * DEG;
  const cw = Math.cos(w);
  const sw = Math.sin(w);
  const cn = Math.cos(el.node * DEG);
  const sn = Math.sin(el.node * DEG);
  const ci = Math.cos(el.i * DEG);
  const si = Math.sin(el.i * DEG);
  const b = el.a * Math.sqrt(Math.max(0, 1 - el.e * el.e));

  for (let s = 0; s < segments; s++) {
    const E = (s / segments) * Math.PI * 2;
    const xp = el.a * (Math.cos(E) - el.e);
    const yp = b * Math.sin(E);
    out[s * 3] = (cw * cn - sw * sn * ci) * xp + (-sw * cn - cw * sn * ci) * yp;
    out[s * 3 + 1] = (cw * sn + sw * cn * ci) * xp + (-sw * sn + cw * cn * ci) * yp;
    out[s * 3 + 2] = sw * si * xp + cw * si * yp;
  }
  return out;
}
