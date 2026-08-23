/* ============================================================
   Critter Clash Idle — big numbers
   A value is stored as  m × 10^e  with 1 ≤ m < 10 (or m === 0).
   The exponent is itself a double, so the practical ceiling is
   10^(1.7e308) — the game can never reach it.
   ============================================================ */
(function (global) {
  'use strict';
  const CC = global.CC || (global.CC = {});

  const LOG10 = Math.log(10);
  const EXP_ZERO = -Infinity;

  function Big(m, e) {
    this.m = m;
    this.e = e;
    this.norm();
  }

  Big.prototype.norm = function () {
    if (!isFinite(this.m) || this.m === 0) {
      if (this.m === 0 || isNaN(this.m)) { this.m = 0; this.e = EXP_ZERO; }
      return this;
    }
    const neg = this.m < 0;
    let am = neg ? -this.m : this.m;
    if (am >= 10 || am < 1) {
      const shift = Math.floor(Math.log10(am));
      am /= Math.pow(10, shift);
      this.e += shift;
      // guard against float drift at the boundaries
      if (am >= 10) { am /= 10; this.e += 1; }
      else if (am < 1) { am *= 10; this.e -= 1; }
    }
    this.m = neg ? -am : am;
    if (this.e === EXP_ZERO) { this.m = 0; }
    return this;
  };

  /* ---------------- construction ---------------- */
  function fromNumber(n) {
    if (!isFinite(n) || n === 0) return new Big(0, EXP_ZERO);
    const e = Math.floor(Math.log10(Math.abs(n)));
    return new Big(n / Math.pow(10, e), e);
  }

  function fromString(s) {
    s = String(s).trim();
    if (s === '' || s === 'null' || s === 'undefined') return new Big(0, EXP_ZERO);
    // our own compact form: "m|e"
    const bar = s.indexOf('|');
    if (bar > 0) return new Big(parseFloat(s.slice(0, bar)), parseFloat(s.slice(bar + 1)));
    const n = parseFloat(s);
    if (isFinite(n)) return fromNumber(n);
    // fall back to "1.23e4567" style beyond double range
    const m = /^(-?[\d.]+)e([+-]?[\d.]+)$/i.exec(s);
    if (m) return new Big(parseFloat(m[1]), parseFloat(m[2]));
    return new Big(0, EXP_ZERO);
  }

  /** Accepts Big | number | string and always returns a Big. */
  function D(v) {
    if (v instanceof Big) return v;
    if (typeof v === 'number') return fromNumber(v);
    if (typeof v === 'string') return fromString(v);
    if (v && typeof v === 'object' && 'm' in v && 'e' in v) return new Big(v.m, v.e);
    return new Big(0, EXP_ZERO);
  }

  /** 10^x for any real x — the workhorse behind all the growth curves. */
  function pow10(x) {
    if (!isFinite(x)) return x > 0 ? new Big(Infinity, 0) : new Big(0, EXP_ZERO);
    const e = Math.floor(x);
    return new Big(Math.pow(10, x - e), e);
  }

  /* ---------------- arithmetic ---------------- */
  Big.prototype.isZero = function () { return this.m === 0; };

  Big.prototype.add = function (other) {
    const o = D(other);
    if (this.m === 0) return new Big(o.m, o.e);
    if (o.m === 0) return new Big(this.m, this.e);
    const de = this.e - o.e;
    if (de > 17) return new Big(this.m, this.e);
    if (de < -17) return new Big(o.m, o.e);
    if (de >= 0) return new Big(this.m + o.m / Math.pow(10, de), this.e);
    return new Big(o.m + this.m / Math.pow(10, -de), o.e);
  };

  Big.prototype.sub = function (other) {
    const o = D(other);
    return this.add(new Big(-o.m, o.e));
  };

  Big.prototype.mul = function (other) {
    const o = D(other);
    if (this.m === 0 || o.m === 0) return new Big(0, EXP_ZERO);
    return new Big(this.m * o.m, this.e + o.e);
  };

  Big.prototype.div = function (other) {
    const o = D(other);
    if (o.m === 0) return new Big(Infinity, 0);
    if (this.m === 0) return new Big(0, EXP_ZERO);
    return new Big(this.m / o.m, this.e - o.e);
  };

  Big.prototype.neg = function () { return new Big(-this.m, this.e); };
  Big.prototype.abs = function () { return new Big(Math.abs(this.m), this.e); };

  /** this ^ n, n is a plain number. */
  Big.prototype.pow = function (n) {
    if (n === 0) return fromNumber(1);
    if (this.m === 0) return new Big(0, EXP_ZERO);
    if (this.m < 0) {
      const r = this.abs().pow(n);
      return (Math.abs(n % 2) === 1) ? r.neg() : r;
    }
    return pow10(this.log10() * n);
  };

  Big.prototype.log10 = function () {
    if (this.m <= 0) return -Infinity;
    return this.e + Math.log10(this.m);
  };
  Big.prototype.ln = function () { return this.log10() * LOG10; };

  /** -1 / 0 / 1 */
  Big.prototype.cmp = function (other) {
    const o = D(other);
    if (this.m === 0 && o.m === 0) return 0;
    if (this.m === 0) return o.m > 0 ? -1 : 1;
    if (o.m === 0) return this.m > 0 ? 1 : -1;
    if (this.m > 0 !== o.m > 0) return this.m > 0 ? 1 : -1;
    const sign = this.m > 0 ? 1 : -1;
    if (this.e !== o.e) return (this.e > o.e ? 1 : -1) * sign;
    if (this.m === o.m) return 0;
    return this.m > o.m ? 1 : -1;
  };
  Big.prototype.gt = function (o) { return this.cmp(o) > 0; };
  Big.prototype.gte = function (o) { return this.cmp(o) >= 0; };
  Big.prototype.lt = function (o) { return this.cmp(o) < 0; };
  Big.prototype.lte = function (o) { return this.cmp(o) <= 0; };
  Big.prototype.eq = function (o) { return this.cmp(o) === 0; };
  Big.prototype.max = function (o) { return this.gte(o) ? this : D(o); };
  Big.prototype.min = function (o) { return this.lte(o) ? this : D(o); };

  /** Plain JS number — Infinity above ~1e308, use only for ratios/UI. */
  Big.prototype.toNumber = function () {
    if (this.m === 0) return 0;
    if (this.e > 308) return this.m > 0 ? Infinity : -Infinity;
    if (this.e < -320) return 0;
    return this.m * Math.pow(10, this.e);
  };

  /** Fraction of `other` as a plain number, clamped — safe for progress bars. */
  Big.prototype.ratio = function (other) {
    const o = D(other);
    if (o.m === 0) return 0;
    const l = this.log10() - o.log10();
    if (l > 3) return 1000;
    if (l < -30) return 0;
    return Math.pow(10, l);
  };

  Big.prototype.toString = function () {
    if (this.m === 0) return '0|0';
    return this.m.toPrecision(12) + '|' + this.e;
  };
  Big.prototype.toJSON = function () { return this.toString(); };

  /* ---------------- formatting ---------------- */
  const SHORT = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No'];
  const L = 'abcdefghijklmnopqrstuvwxyz';

  function tierName(tier) {
    if (tier < SHORT.length) return SHORT[tier];
    const n = tier - SHORT.length;
    if (n < 676) return L[Math.floor(n / 26) % 26] + L[n % 26];
    const n3 = n - 676;
    return L[Math.floor(n3 / 676) % 26] + L[Math.floor(n3 / 26) % 26] + L[n3 % 26];
  }

  /** Human string: 1.23K, 45.6aa, or 1.23e5000 once the suffixes run out. */
  function format(v, decimals) {
    const b = D(v);
    if (b.m === 0) return '0';
    if (b.m < 0) return '-' + format(b.neg(), decimals);
    if (b.e < 3) {
      const n = b.toNumber();
      if (n < 10 && n % 1 !== 0) return n.toFixed(decimals === undefined ? 1 : decimals);
      return String(Math.floor(n));
    }
    const tier = Math.floor(b.e / 3);
    if (tier >= 20000) {                       // past every suffix — scientific
      return b.m.toFixed(2) + 'e' + Math.round(b.e);
    }
    const scaled = b.m * Math.pow(10, b.e - tier * 3);
    const d = decimals === undefined ? (scaled < 10 ? 2 : scaled < 100 ? 1 : 0) : decimals;
    return scaled.toFixed(d) + tierName(tier);
  }

  /* ---------------- geometric-cost helpers ---------------- */
  /** base × mult^owned × (mult^count − 1)/(mult − 1) — exact in log space. */
  function bulkCost(base, mult, owned, count) {
    if (count <= 0) return D(0);
    const b = D(base);
    if (mult === 1) return b.mul(count);
    const first = b.mul(pow10(Math.log10(mult) * owned));
    const growth = pow10(Math.log10(mult) * count).sub(1).div(mult - 1);
    return first.mul(growth);
  }

  /** How many levels `budget` can buy. */
  function maxAffordable(base, mult, owned, budget, hardCap) {
    const b = D(base), g = D(budget);
    const first = b.mul(pow10(Math.log10(mult) * owned));
    if (g.lt(first)) return 0;
    if (mult === 1) return Math.floor(g.div(first).toNumber());
    // n = log_mult( 1 + budget×(mult−1)/first )
    const inner = g.mul(mult - 1).div(first).add(1);
    let n = Math.floor(inner.log10() / Math.log10(mult));
    if (!isFinite(n) || n < 0) n = 0;
    if (hardCap !== undefined) n = Math.min(n, hardCap);
    let guard = 0;
    while (n > 0 && bulkCost(base, mult, owned, n).gt(g) && guard++ < 64) n--;
    return n;
  }

  D.Big = Big;
  D.ZERO = () => new Big(0, EXP_ZERO);
  D.ONE = () => fromNumber(1);
  D.pow10 = pow10;
  D.fromNumber = fromNumber;
  D.fromString = fromString;
  D.format = format;
  D.bulkCost = bulkCost;
  D.maxAffordable = maxAffordable;
  D.isBig = v => v instanceof Big;

  CC.D = D;
  if (typeof module !== 'undefined' && module.exports) module.exports = D;
})(typeof window !== 'undefined' ? window : globalThis);
