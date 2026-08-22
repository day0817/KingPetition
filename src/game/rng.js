// シード付き乱数（mulberry32）。
// テストの再現性と「日替わりチャレンジ」のために、Math.random は使わない。

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashSeed(text) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

/** YYYY-MM-DD 形式のローカル日付文字列。日替わりチャレンジのシードに使う。 */
export function todayKey(date = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}

export class Rng {
  constructor(seed) {
    this.seed = typeof seed === 'number' ? seed >>> 0 : hashSeed(String(seed ?? Date.now()));
    this._next = mulberry32(this.seed);
  }

  /** 1〜6 の出目 */
  die() {
    return 1 + Math.floor(this._next() * 6);
  }
}
