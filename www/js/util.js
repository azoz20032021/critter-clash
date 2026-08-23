/* ============================================================
   Critter Clash Idle — utilities
   ============================================================ */
(function (global) {
  'use strict';

  const CC = global.CC || (global.CC = {});

  /* ---------- number formatting ---------- */
  const SHORT = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No'];
  const LETTERS = 'abcdefghijklmnopqrstuvwxyz';

  function tierName(tier) {
    if (tier < SHORT.length) return SHORT[tier];
    let n = tier - SHORT.length;              // 0 -> aa
    const first = Math.floor(n / 26) % 26;
    const second = n % 26;
    const cycle = Math.floor(n / 676);
    const base = LETTERS[first] + LETTERS[second];
    return cycle > 0 ? base + cycle : base;
  }

  function fmt(num, decimals) {
    // big numbers own their own formatting
    if (num && typeof num === 'object' && 'm' in num && 'e' in num) return CC.D.format(num, decimals);
    if (typeof num === 'string') return CC.D.format(CC.D(num), decimals);
    if (!isFinite(num)) return '∞';
    if (num < 0) return '-' + fmt(-num, decimals);
    if (num < 1000) {
      if (num < 10 && num % 1 !== 0) return num.toFixed(decimals === undefined ? 1 : decimals);
      return String(Math.floor(num));
    }
    const tier = Math.floor(Math.log10(num) / 3);
    const scaled = num / Math.pow(10, tier * 3);
    const d = decimals === undefined ? (scaled < 10 ? 2 : scaled < 100 ? 1 : 0) : decimals;
    return scaled.toFixed(d) + tierName(tier);
  }

  function fmtTime(sec) {
    sec = Math.max(0, Math.floor(sec));
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (h > 0) return h + 'h ' + String(m).padStart(2, '0') + 'm';
    if (m > 0) return m + ':' + String(s).padStart(2, '0');
    return s + 's';
  }

  function fmtClock(sec) {
    sec = Math.max(0, Math.ceil(sec));
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return m + ':' + String(s).padStart(2, '0');
  }

  /* ---------- math ---------- */
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const rand = (a, b) => a + Math.random() * (b - a);
  const randInt = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  const easeIn = (t) => t * t * t;

  /** Deterministic seeded RNG (mulberry32) */
  function seeded(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /**
   * Cost of buying `count` levels of a geometric-cost upgrade.
   * base * mult^owned * (mult^count - 1) / (mult - 1)
   */
  function bulkCost(base, mult, owned, count) {
    if (count <= 0) return 0;
    if (mult === 1) return base * count;
    return base * Math.pow(mult, owned) * (Math.pow(mult, count) - 1) / (mult - 1);
  }

  /** Max levels affordable with `gold`. */
  function maxAffordable(base, mult, owned, gold, hardCap) {
    if (gold < base * Math.pow(mult, owned)) return 0;
    const first = base * Math.pow(mult, owned);
    let n = Math.floor(Math.log(1 + (gold * (mult - 1)) / first) / Math.log(mult));
    if (!isFinite(n) || n < 0) n = 0;
    if (hardCap !== undefined) n = Math.min(n, hardCap);
    // safety correction for float drift
    while (n > 0 && bulkCost(base, mult, owned, n) > gold) n--;
    return n;
  }

  /* ---------- misc ---------- */
  function now() { return Date.now(); }

  function uid() { return Math.random().toString(36).slice(2, 10); }

  function deepMerge(target, source) {
    for (const k in source) {
      if (!Object.prototype.hasOwnProperty.call(source, k)) continue;
      const sv = source[k];
      if (sv && typeof sv === 'object' && !Array.isArray(sv)) {
        if (!target[k] || typeof target[k] !== 'object') target[k] = {};
        deepMerge(target[k], sv);
      } else {
        target[k] = sv;
      }
    }
    return target;
  }

  CC.util = {
    fmt, fmtTime, fmtClock, clamp, lerp, rand, randInt, pick,
    easeOut, easeIn, seeded, bulkCost, maxAffordable, now, uid, deepMerge
  };
})(window);
