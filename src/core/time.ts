/** 儒略历时间工具 */

export const J2000 = 2451545.0; // 2000-01-01 12:00 TT
export const DAYS_PER_CENTURY = 36525;

export function jdFromDate(d: Date): number {
  return d.getTime() / 86400000 + 2440587.5;
}

export function dateFromJd(jd: number): Date {
  return new Date((jd - 2440587.5) * 86400000);
}

/** 距 J2000 的儒略世纪数 */
export function centuriesSinceJ2000(jd: number): number {
  return (jd - J2000) / DAYS_PER_CENTURY;
}

const MONTHS = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

export function formatDate(jd: number): string {
  const d = dateFromJd(jd);
  const y = d.getUTCFullYear();
  const mo = MONTHS[d.getUTCMonth()];
  const day = String(d.getUTCDate()).padStart(2, '0');
  const h = String(d.getUTCHours()).padStart(2, '0');
  const m = String(d.getUTCMinutes()).padStart(2, '0');
  return `${y}年${mo}${day}日 ${h}:${m}`;
}

/** 时间倍率：每真实秒推进多少模拟天 */
export const SPEED_PRESETS = [
  { label: '实时', daysPerSecond: 1 / 86400 },
  { label: '1秒 = 1分钟', daysPerSecond: 1 / 1440 },
  { label: '1秒 = 1小时', daysPerSecond: 1 / 24 },
  { label: '1秒 = 1天', daysPerSecond: 1 },
  { label: '1秒 = 1周', daysPerSecond: 7 },
  { label: '1秒 = 1月', daysPerSecond: 30 },
  { label: '1秒 = 1年', daysPerSecond: 365.25 },
  { label: '1秒 = 10年', daysPerSecond: 3652.5 },
];
