import type { Elements, ElementRates } from '../core/kepler';

/** 1 世界单位 = 1 AU */
export const AU = 100;
/** 1 AU = 1.495978707 亿公里 */
export const KM_PER_AU = 149597870.7;

export type BodyType = 'star' | 'planet' | 'dwarf' | 'moon';
export type TextureKind = 'rocky' | 'gas' | 'earth' | 'ice' | 'sun';

export interface MoonOrbit {
  /** 半长轴（真实，AU） */
  aAU: number;
  e: number;
  /** 相对黄道的倾角（度） */
  i: number;
  /** 恒星周期（天） */
  periodDays: number;
  /** J2000 平近点角（度） */
  phaseDeg: number;
  /** 升交点黄经（度） */
  nodeDeg: number;
  /** 交点进动（度/世纪） */
  nodeRate: number;
  /** 显示轨道半径（世界单位），即"为了看得见"的放大 */
  displayOrbit: number;
}

export interface BodyInfo {
  /** 距太阳 */
  distance: string;
  /** 平均半径 */
  radius: string;
  /** 质量 */
  mass: string;
  /** 公转周期 */
  period: string;
  /** 自转周期 */
  rotation: string;
  /** 表面/大气温度 */
  temperature: string;
  /** 卫星数 */
  moons: string;
  /** 发现 */
  discovery: string;
  /** 一句话构成描述 */
  composition: string;
}

export interface Body {
  id: string;
  name: string;
  latin: string;
  type: BodyType;
  /** 卫星的母天体 id */
  parent?: string;
  /** 行星轨道根数（黄道系，J2000 历元） */
  elements?: Elements;
  rates?: ElementRates;
  /** 卫星轨道参数 */
  moon?: MoonOrbit;
  /** 真实半径（km） */
  kmRadius: number;
  /** 显示半径（世界单位，放大后的观感尺寸） */
  displayRadius: number;
  color: number;
  texture: TextureKind;
  /** 自转周期（小时，负值表示逆行） */
  rotationHours: number;
  /** 转轴倾角（度） */
  tilt: number;
  info: BodyInfo;
  /** 一句诗 */
  poetry: string;
  /** 是否带环 */
  rings?: boolean;
}

/* ------------------------------------------------------------------ *
 * 行星：根数取自 JPL 近似星历表（1800–2050），值为 J2000 历元，
 * 变化率为每儒略世纪。
 * ------------------------------------------------------------------ */

const PLANETS: Body[] = [
  {
    id: 'sun',
    name: '太阳',
    latin: 'Sol',
    type: 'star',
    kmRadius: 696000,
    displayRadius: 16,
    color: 0xffd9a0,
    texture: 'sun',
    rotationHours: 609.12, // 25.38 天（赤道）
    tilt: 7.25,
    info: {
      distance: '—',
      radius: '696,000 km',
      mass: '333,000 地球',
      period: '银河系 2.3 亿年 / 绕银心',
      rotation: '25.4 天',
      temperature: '表面 5,500°C / 核心 1,500 万°C',
      moons: '8 行星 · 5 矮行星',
      discovery: '自古已知',
      composition: '氢 73.5% / 氦 24.9% / 氧 0.8% / 碳 0.3%',
    },
    poetry: '我们唯一认识的火，也是唯一一盏从不回声的路灯。',
  },
  {
    id: 'mercury',
    name: '水星',
    latin: 'Mercurius',
    type: 'planet',
    elements: { a: 0.38709927, e: 0.20563593, i: 7.00497902, L: 252.2503235, peri: 77.45779628, node: 48.33076593 },
    rates: { a: 0.00000037, e: 0.00001906, i: -0.00594749, L: 149472.67411175, peri: 0.16047689, node: -0.12534081 },
    kmRadius: 2439.7,
    displayRadius: 0.75,
    color: 0x9c8e83,
    texture: 'rocky',
    rotationHours: 1407.6,
    tilt: 0.034,
    info: {
      distance: '0.39 AU / 5790 万 km',
      radius: '2,440 km',
      mass: '0.055 地球',
      period: '88 天',
      rotation: '59 天（3:2 自旋轨道共振）',
      temperature: '−173 ~ 427°C',
      moons: '无',
      discovery: '史前即知（中国称辰星）',
      composition: '铁核 85% / 硅酸盐岩石与硅酸盐壳',
    },
    poetry: '离火最近的守夜人，一辈子没有等到过天亮。',
  },
  {
    id: 'venus',
    name: '金星',
    latin: 'Venus',
    type: 'planet',
    elements: { a: 0.72333566, e: 0.00677672, i: 3.39467605, L: 181.9790995, peri: 131.60246718, node: 76.67984255 },
    rates: { a: 0.0000039, e: -0.00004107, i: -0.0007889, L: 58517.81538729, peri: 0.00268329, node: -0.27769418 },
    kmRadius: 6051.8,
    displayRadius: 1.15,
    color: 0xe8c98a,
    texture: 'rocky',
    rotationHours: -5832.5,
    tilt: 177.36,
    info: {
      distance: '0.72 AU / 1.082 亿 km',
      radius: '6,052 km',
      mass: '0.815 地球',
      period: '225 天',
      rotation: '243 天（逆行）',
      temperature: '464°C（地表）',
      moons: '无',
      discovery: '史前即知（太白 / 启明）',
      composition: '96.5% 二氧化碳大气 / 硫酸云层 / 玄武岩壳',
    },
    poetry: '一颗被自己的天空闷死的星星，漂亮得让人忘了它是尸体。',
  },
  {
    id: 'earth',
    name: '地球',
    latin: 'Terra',
    type: 'planet',
    elements: { a: 1.00000261, e: 0.01671123, i: -0.00001531, L: 100.46457166, peri: 102.93768193, node: 0 },
    rates: { a: 0.00000562, e: -0.00004392, i: -0.01294668, L: 35999.37244981, peri: 0.32327364, node: 0 },
    kmRadius: 6371,
    displayRadius: 1.3,
    color: 0x4b7fd4,
    texture: 'earth',
    rotationHours: 23.9345,
    tilt: 23.44,
    info: {
      distance: '1 AU / 1.496 亿 km',
      radius: '6,371 km',
      mass: '1 地球',
      period: '365.25 天',
      rotation: '23小时56分',
      temperature: '平均 15°C',
      moons: '1（月球）',
      discovery: '—',
      composition: '71% 水 / 29% 陆地 / 氮氧大气',
    },
    poetry: '在所有已知的黑暗里，恰好有一颗长出了名字。',
  },
  {
    id: 'mars',
    name: '火星',
    latin: 'Mars',
    type: 'planet',
    elements: { a: 1.52371034, e: 0.0933941, i: 1.84969142, L: -4.55343205, peri: -23.94362959, node: 49.55953891 },
    rates: { a: 0.00001847, e: 0.00007882, i: -0.00813131, L: 19140.30268499, peri: 0.44441088, node: -0.29257343 },
    kmRadius: 3389.5,
    displayRadius: 0.95,
    color: 0xc1502e,
    texture: 'rocky',
    rotationHours: 24.6229,
    tilt: 25.19,
    info: {
      distance: '1.52 AU / 2.279 亿 km',
      radius: '3,390 km',
      mass: '0.107 地球',
      period: '687 天',
      rotation: '24小时37分',
      temperature: '−63°C（平均）',
      moons: '2（火卫一、火卫二）',
      discovery: '史前即知（荧惑）',
      composition: '氧化铁尘土（锈红）/ 稀薄二氧化碳大气 / 冰盖',
    },
    poetry: '宇宙中最安静的一场谋杀，凶手是时间，案发现场还留着水。',
  },
  {
    id: 'jupiter',
    name: '木星',
    latin: 'Iupiter',
    type: 'planet',
    elements: { a: 5.202887, e: 0.04838624, i: 1.30439695, L: 34.39644051, peri: 14.72847983, node: 100.47390909 },
    rates: { a: -0.00011607, e: -0.00013253, i: -0.00183714, L: 3034.74612775, peri: 0.21252668, node: 0.20469106 },
    kmRadius: 69911,
    displayRadius: 5.2,
    color: 0xd8b48a,
    texture: 'gas',
    rotationHours: 9.925,
    tilt: 3.13,
    info: {
      distance: '5.20 AU / 7.785 亿 km',
      radius: '69,911 km',
      mass: '317.8 地球',
      period: '11.86 年',
      rotation: '9小时56分',
      temperature: '−110°C（云顶）',
      moons: '95',
      discovery: '史前即知 / 伽利略 1610 年发现其卫星',
      composition: '90% 氢 / 10% 氦 / 氨水云带 / 可能含岩石核',
    },
    poetry: '用一整个世界的重量，守住一圈不安分的石头。',
  },
  {
    id: 'saturn',
    name: '土星',
    latin: 'Saturnus',
    type: 'planet',
    elements: { a: 9.53667594, e: 0.05386179, i: 2.48599187, L: 49.95424423, peri: 92.59887831, node: 113.66242448 },
    rates: { a: -0.0012506, e: -0.00050991, i: 0.00193609, L: 1222.49362201, peri: -0.41897216, node: -0.28867794 },
    kmRadius: 58232,
    displayRadius: 4.5,
    color: 0xe3d1a8,
    texture: 'gas',
    rotationHours: 10.656,
    tilt: 26.73,
    rings: true,
    info: {
      distance: '9.54 AU / 14.34 亿 km',
      radius: '58,232 km',
      mass: '95.2 地球',
      period: '29.45 年',
      rotation: '10小时33分',
      temperature: '−140°C（云顶）',
      moons: '146',
      discovery: '史前即知 / 惠更斯 1655 年发现光环',
      composition: '96% 氢 / 3% 氦 / 氨冰云带 / 环由水冰碎块构成',
    },
    poetry: '戴着它唯一的证物，环游一条无人认领的走廊。',
  },
  {
    id: 'uranus',
    name: '天王星',
    latin: 'Uranus',
    type: 'planet',
    elements: { a: 19.18916464, e: 0.04725744, i: 0.77263783, L: 313.23810451, peri: 170.9542763, node: 74.01692503 },
    rates: { a: -0.00196176, e: -0.00004397, i: -0.00242939, L: 428.48202785, peri: 0.40805281, node: 0.04240589 },
    kmRadius: 25362,
    displayRadius: 2.7,
    color: 0x9fd8de,
    texture: 'gas',
    rotationHours: -17.24,
    tilt: 97.77,
    rings: true,
    info: {
      distance: '19.19 AU / 28.71 亿 km',
      radius: '25,362 km',
      mass: '14.5 地球',
      period: '84 年',
      rotation: '17小时14分（逆行）',
      temperature: '−195°C',
      moons: '28',
      discovery: '1781 年，威廉·赫歇尔',
      composition: '83% 氢 / 15% 氦 / 15% 甲烷（呈青蓝）/ 水氨冰幔',
    },
    poetry: '躺着走了八十年，谁也没有叫醒它。',
  },
  {
    id: 'neptune',
    name: '海王星',
    latin: 'Neptunus',
    type: 'planet',
    elements: { a: 30.06992276, e: 0.00859048, i: 1.77004347, L: -55.12002969, peri: 44.96476227, node: 131.78422574 },
    rates: { a: 0.00026291, e: 0.00005105, i: 0.00035372, L: 218.45945325, peri: -0.32241464, node: -0.00508664 },
    kmRadius: 24622,
    displayRadius: 2.55,
    color: 0x3f66c9,
    texture: 'gas',
    rotationHours: 16.11,
    tilt: 28.32,
    info: {
      distance: '30.07 AU / 45.04 亿 km',
      radius: '24,622 km',
      mass: '17.1 地球',
      period: '165 年',
      rotation: '16小时06分',
      temperature: '−200°C',
      moons: '16',
      discovery: '1846 年，勒维耶推算 / 伽勒望远镜证实',
      composition: '氢氦大气 / 甲烷吸收红光呈深蓝 / 内部可能存在冰幔',
    },
    poetry: '在黑暗的最远处，风速超过两千米每小时，却没有人听见。',
  },
  {
    id: 'pluto',
    name: '冥王星',
    latin: 'Pluto',
    type: 'dwarf',
    elements: { a: 39.48211675, e: 0.2488273, i: 17.14001206, L: 238.92903833, peri: 224.06891629, node: 110.30393684 },
    rates: { a: -0.00031596, e: 0.0000517, i: 0.00004818, L: 145.20780515, peri: -0.04062942, node: -0.01183482 },
    kmRadius: 1188.3,
    displayRadius: 0.62,
    color: 0xc9b6a4,
    texture: 'ice',
    rotationHours: -153.29,
    tilt: 122.53,
    info: {
      distance: '39.5 AU（平均）/ 29.7–49.3 AU',
      radius: '1,188 km',
      mass: '0.0022 地球（月球的 1/6）',
      period: '248 年',
      rotation: '153 小时（逆行）',
      temperature: '−229°C',
      moons: '5',
      discovery: '1930 年，克莱德·汤博',
      composition: '氮冰为主 / 甲烷与一氧化碳冰 / 岩石核',
    },
    poetry: '被踢出名单之后，反而成了最浪漫的地方。',
  },
];

/* ------------------------------------------------------------------ *
 * 卫星：真实轨道要素 + 为可视化而放大的显示轨道半径
 * ------------------------------------------------------------------ */

const MOONS: Body[] = [
  {
    id: 'moon',
    name: '月球',
    latin: 'Luna',
    type: 'moon',
    parent: 'earth',
    moon: { aAU: 0.00257, e: 0.0549, i: 5.145, periodDays: 27.321661, phaseDeg: 134.963, nodeDeg: 125.045, nodeRate: -1934.1, displayOrbit: 3.4 },
    kmRadius: 1737.4,
    displayRadius: 0.34,
    color: 0xbcbcbc,
    texture: 'rocky',
    rotationHours: 655.72,
    tilt: 6.68,
    info: {
      distance: '38.4 万 km（地球）',
      radius: '1,737 km',
      mass: '0.0123 地球（1/81）',
      period: '27.32 天（绕地球）',
      rotation: '27.3 天（潮汐锁定）',
      temperature: '−20 ~ 127°C',
      moons: '—',
      discovery: '自古已知',
      composition: '岩石与月壤 / 月海为远古玄武岩熔岩',
    },
    poetry: '所有的海都在这里，只是从来没有过水。',
  },
  {
    id: 'io',
    name: '木卫一',
    latin: 'Io',
    type: 'moon',
    parent: 'jupiter',
    moon: { aAU: 0.00282, e: 0.0041, i: 0.05, periodDays: 1.769138, phaseDeg: 200.0, nodeDeg: 43.977, nodeRate: 0, displayOrbit: 22 },
    kmRadius: 1821.6,
    displayRadius: 0.4,
    color: 0xe8d26a,
    texture: 'rocky',
    rotationHours: 42.46,
    tilt: 0,
    info: {
      distance: '42.2 万 km（木星）',
      radius: '1,822 km',
      mass: '0.015 地球',
      period: '1.77 天',
      rotation: '1.77 天（潮汐锁定）',
      temperature: '−143°C',
      moons: '—',
      discovery: '1610 年，伽利略',
      composition: '硫与二氧化硫地表 / 400 余座活火山',
    },
    poetry: '火山的心跳，和宇宙里最刺鼻的味道。',
  },
  {
    id: 'europa',
    name: '木卫二',
    latin: 'Europa',
    type: 'moon',
    parent: 'jupiter',
    moon: { aAU: 0.00448, e: 0.009, i: 0.47, periodDays: 3.551181, phaseDeg: 60.0, nodeDeg: 219.106, nodeRate: 0, displayOrbit: 29 },
    kmRadius: 1520.8,
    displayRadius: 0.36,
    color: 0xd9cbb0,
    texture: 'ice',
    rotationHours: 85.23,
    tilt: 0.1,
    info: {
      distance: '67.1 万 km（木星）',
      radius: '1,521 km',
      mass: '0.008 地球',
      period: '3.55 天',
      rotation: '3.55 天（潮汐锁定）',
      temperature: '−171°C',
      moons: '—',
      discovery: '1610 年，伽利略',
      composition: '冰壳之下可能存在深达 100 km 的液态水海洋',
    },
    poetry: '冰壳之下，是一片比地球更深的海。',
  },
  {
    id: 'ganymede',
    name: '木卫三',
    latin: 'Ganymede',
    type: 'moon',
    parent: 'jupiter',
    moon: { aAU: 0.00715, e: 0.0013, i: 0.2, periodDays: 7.154553, phaseDeg: 300.0, nodeDeg: 63.552, nodeRate: 0, displayOrbit: 37 },
    kmRadius: 2634.1,
    displayRadius: 0.5,
    color: 0xa89b8c,
    texture: 'rocky',
    rotationHours: 171.71,
    tilt: 0.33,
    info: {
      distance: '107 万 km（木星）',
      radius: '2,634 km',
      mass: '0.025 地球',
      period: '7.15 天',
      rotation: '7.15 天（潮汐锁定）',
      temperature: '−163°C',
      moons: '—',
      discovery: '1610 年，伽利略',
      composition: '冰与岩石各半 / 太阳系唯一拥有自身磁场的卫星',
    },
    poetry: '太阳系里唯一自带磁场的卫星，像一枚被磁化的心脏。',
  },
  {
    id: 'callisto',
    name: '木卫四',
    latin: 'Callisto',
    type: 'moon',
    parent: 'jupiter',
    moon: { aAU: 0.01258, e: 0.0074, i: 0.19, periodDays: 16.689017, phaseDeg: 120.0, nodeDeg: 298.848, nodeRate: 0, displayOrbit: 46 },
    kmRadius: 2410.3,
    displayRadius: 0.44,
    color: 0x8c8175,
    texture: 'rocky',
    rotationHours: 400.54,
    tilt: 0,
    info: {
      distance: '188 万 km（木星）',
      radius: '2,410 km',
      mass: '0.018 地球',
      period: '16.69 天',
      rotation: '16.69 天（潮汐锁定）',
      temperature: '−139°C',
      moons: '—',
      discovery: '1610 年，伽利略',
      composition: '太阳系表面最古老、撞击坑最密集的天体之一',
    },
    poetry: '太阳系里最老的一张脸，四十亿年没有换过表情。',
  },
  {
    id: 'titan',
    name: '土卫六',
    latin: 'Titan',
    type: 'moon',
    parent: 'saturn',
    moon: { aAU: 0.01914, e: 0.0288, i: 0.35, periodDays: 15.945, phaseDeg: 250.0, nodeDeg: 28.06, nodeRate: 0, displayOrbit: 38 },
    kmRadius: 2574.7,
    displayRadius: 0.4,
    color: 0xd8a24a,
    texture: 'gas',
    rotationHours: 382.68,
    tilt: 0,
    info: {
      distance: '122 万 km（土星）',
      radius: '2,575 km',
      mass: '0.0225 地球',
      period: '15.95 天',
      rotation: '15.95 天（潮汐锁定）',
      temperature: '−179°C',
      moons: '—',
      discovery: '1655 年，惠更斯',
      composition: '95% 氮气大气 / 地表有液态甲烷湖泊与河流',
    },
    poetry: '另一颗星球的天空下，下着甲烷的雨。',
  },
  {
    id: 'enceladus',
    name: '土卫二',
    latin: 'Enceladus',
    type: 'moon',
    parent: 'saturn',
    moon: { aAU: 0.00974, e: 0.0047, i: 0.02, periodDays: 1.370218, phaseDeg: 30.0, nodeDeg: 342.507, nodeRate: 0, displayOrbit: 24 },
    kmRadius: 252.1,
    displayRadius: 0.18,
    color: 0xf2f6f8,
    texture: 'ice',
    rotationHours: 32.88,
    tilt: 0,
    info: {
      distance: '238 万 km（土星）',
      radius: '252 km',
      mass: '0.00002 地球',
      period: '1.37 天',
      rotation: '1.37 天（潮汐锁定）',
      temperature: '−198°C',
      moons: '—',
      discovery: '1789 年，威廉·赫歇尔',
      composition: '全球冰壳 / 南极喷出含盐的水汽羽流，指示地下存在热液',
    },
    poetry: '在极南偷偷喷出海水，是整个太阳系最含蓄的热情。',
  },
  {
    id: 'iapetus',
    name: '土卫八',
    latin: 'Iapetus',
    type: 'moon',
    parent: 'saturn',
    moon: { aAU: 0.0293, e: 0.0286, i: 15.47, periodDays: 79.3215, phaseDeg: 200.0, nodeDeg: 81.105, nodeRate: 0, displayOrbit: 56 },
    kmRadius: 734.5,
    displayRadius: 0.2,
    color: 0xa89680,
    texture: 'ice',
    rotationHours: 1903.9,
    tilt: 0,
    info: {
      distance: '356 万 km（土星）',
      radius: '735 km',
      mass: '0.00025 地球',
      period: '79.3 天',
      rotation: '79.3 天（潮汐锁定）',
      temperature: '−173°C',
      moons: '—',
      discovery: '1671 年，卡西尼',
      composition: '一半极暗、一半极亮，反照率相差十倍之巨',
    },
    poetry: '一半漆黑一半雪白，像被劈开的两颗星球在互相伤害。',
  },
  {
    id: 'triton',
    name: '海卫一',
    latin: 'Triton',
    type: 'moon',
    parent: 'neptune',
    moon: { aAU: 0.00286, e: 0.000016, i: 156.885, periodDays: -5.876854, phaseDeg: 90.0, nodeDeg: 178.1, nodeRate: 0, displayOrbit: 26 },
    kmRadius: 1353.4,
    displayRadius: 0.32,
    color: 0xd0d8dc,
    texture: 'ice',
    rotationHours: -141.04,
    tilt: 0,
    info: {
      distance: '35,400 km（海王星）',
      radius: '1,353 km',
      mass: '0.0036 地球',
      period: '5.88 天（逆行）',
      rotation: '5.88 天（潮汐锁定）',
      temperature: '−235°C',
      moons: '—',
      discovery: '1846 年，拉塞尔',
      composition: '氮气冰壳 / 氮气间歇泉 / 潮汐加热',
    },
    poetry: '逆着整个太阳系的方向运行，正在被一点点拆散。',
  },
  {
    id: 'phobos',
    name: '火卫一',
    latin: 'Phobos',
    type: 'moon',
    parent: 'mars',
    moon: { aAU: 0.0000629, e: 0.0151, i: 1.093, periodDays: 0.31891, phaseDeg: 45.0, nodeDeg: 164.931, nodeRate: 0, displayOrbit: 3.6 },
    kmRadius: 11.267,
    displayRadius: 0.14,
    color: 0x8a7d6d,
    texture: 'rocky',
    rotationHours: 7.6539,
    tilt: 0,
    info: {
      distance: '9376 km（火星）',
      radius: '11.3 km',
      mass: '1.8×10⁻¹⁵ 地球',
      period: '7小时39分',
      rotation: '7小时39分',
      temperature: '−40°C',
      moons: '—',
      discovery: '1877 年，阿萨夫·霍尔',
      composition: '碳质含硅岩石 / 布满沟槽',
    },
    poetry: '正在坠落的太小石块，被火星一把锁死。',
  },
  {
    id: 'deimos',
    name: '火卫二',
    latin: 'Deimos',
    type: 'moon',
    parent: 'mars',
    moon: { aAU: 0.0001567, e: 0.00033, i: 0.93, periodDays: 1.263, phaseDeg: 200.0, nodeDeg: 339.6, nodeRate: 0, displayOrbit: 5.2 },
    kmRadius: 6.2,
    displayRadius: 0.11,
    color: 0x9c8f7e,
    texture: 'rocky',
    rotationHours: 30.31,
    tilt: 0,
    info: {
      distance: '23,460 km（火星）',
      radius: '6.2 km',
      mass: '1.5×10⁻¹⁶ 地球',
      period: '1.26 天',
      rotation: '1.26 天',
      temperature: '−40°C',
      moons: '—',
      discovery: '1877 年，阿萨夫·霍尔',
      composition: '碳质含硅岩石 / 表土有风化层',
    },
    poetry: '像一颗被磨圆了的小行星，从来没有人多看它一眼。',
  },
  {
    id: 'charon',
    name: '冥卫一',
    latin: 'Charon',
    type: 'moon',
    parent: 'pluto',
    moon: { aAU: 0.0001959, e: 0.0002, i: 0.08, periodDays: 6.3872, phaseDeg: 130.0, nodeDeg: 223.0, nodeRate: 0, displayOrbit: 3.2 },
    kmRadius: 606,
    displayRadius: 0.24,
    color: 0x9e948b,
    texture: 'rocky',
    rotationHours: 153.29,
    tilt: 0,
    info: {
      distance: '19,591 km（冥王星）',
      radius: '606 km',
      mass: '0.00007 地球（月球的 1/18）',
      period: '6.39 天',
      rotation: '6.39 天（相互潮汐锁定）',
      temperature: '−220°C',
      moons: '—',
      discovery: '1978 年，克里斯·詹姆斯',
      composition: '冰岩混合 / 表面有深红色托林沉积',
    },
    poetry: '两个矮人互相拉着转，像一支谁也不肯先松手的舞。',
  },
];

export const BODIES: Body[] = [...PLANETS, ...MOONS];

export const BODY_BY_ID = new Map(BODIES.map((b) => [b.id, b]));

/** 真实半径（世界单位） */
export function realRadius(body: Body): number {
  return body.kmRadius / KM_PER_AU * AU;
}

/** 太阳的真实半径（世界单位） */
export const SUN_REAL_RADIUS = realRadius(BODY_BY_ID.get('sun')!);
