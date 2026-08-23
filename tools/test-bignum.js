/* Unit tests for the big-number layer. */
const D = require('../www/js/bignum.js');
let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (extra !== undefined ? '  [' + extra + ']' : '')); }
}
const close = (a, b, tol) => Math.abs(a - b) <= (tol === undefined ? 1e-9 : tol) * Math.max(1, Math.abs(b));

ok('from number', D(1234).toNumber() === 1234);
ok('zero', D(0).isZero() && D(0).toNumber() === 0);
ok('negative', D(-42).toNumber() === -42);
ok('add same scale', close(D(1e10).add(D(2e10)).toNumber(), 3e10));
ok('add tiny to huge is a no-op', D('1|500').add(D(5)).log10() === 500);
ok('sub', close(D(500).sub(200).toNumber(), 300));
ok('sub to zero', D(7).sub(7).isZero());
ok('sub past zero is negative', close(D(3).sub(10).toNumber(), -7));
ok('mul', close(D(2e5).mul(3e5).toNumber(), 6e10));
ok('div', close(D(9e20).div(3e10).toNumber(), 3e10));
ok('mul beyond double range', close(D.pow10(400).mul(D.pow10(400)).log10(), 800, 1e-12));
ok('pow', close(D(2).pow(10).toNumber(), 1024, 1e-9));
ok('pow huge', close(D(1.57).pow(5000).log10(), 5000 * Math.log10(1.57), 1e-9));
ok('pow10 fractional', close(D.pow10(2.5).toNumber(), 316.227766, 1e-6));
ok('log10', close(D(1e123).log10(), 123, 1e-9));

ok('cmp equal', D(5).cmp(5) === 0);
ok('cmp bigger exponent', D('1|900').gt(D('9|899')));
ok('cmp negative vs positive', D(-1).lt(D(1)));
ok('cmp zero', D(0).lt(D(1)) && D(0).gt(D(-1)));
ok('min/max', D(3).max(9).toNumber() === 9 && D(3).min(9).toNumber() === 3);

ok('ratio in range', close(D(25).ratio(100), 0.25, 1e-9));
ok('ratio of enormous values', close(D.pow10(1000).ratio(D.pow10(1001)), 0.1, 1e-9));
ok('ratio guards against zero', D(5).ratio(0) === 0);

ok('roundtrip string', D(D('7.5|321').toString()).log10().toFixed(6) === D('7.5|321').log10().toFixed(6));
ok('parses plain numeric strings', close(D('12345').toNumber(), 12345));
ok('parses scientific beyond double', close(D('3.5e900').log10(), 900 + Math.log10(3.5), 1e-9));

ok('format small', D(999).format === undefined && D.format(D(999)) === '999');
ok('format K', D.format(D(1500)) === '1.50K', D.format(D(1500)));
ok('format M', D.format(D(2.5e6)) === '2.50M', D.format(D(2.5e6)));
ok('format aa tier (1e33)', /aa$/.test(D.format(D.pow10(33))), D.format(D.pow10(33)));
ok('format ab tier (1e36)', /ab$/.test(D.format(D.pow10(36))), D.format(D.pow10(36)));
ok('format stays short at 1e300', D.format(D.pow10(300)).length <= 8, D.format(D.pow10(300)));
ok('format goes scientific past the suffix table', /e/.test(D.format(D.pow10(70000))), D.format(D.pow10(70000)));
ok('format handles 1e100000', D.format(D.pow10(100000)).indexOf('e100000') > 0, D.format(D.pow10(100000)));

/* geometric cost helpers must agree with the naive loop */
function naiveBulk(base, mult, owned, count) {
  let s = 0;
  for (let i = 0; i < count; i++) s += base * Math.pow(mult, owned + i);
  return s;
}
ok('bulkCost matches naive sum', close(D.bulkCost(10, 1.09, 5, 20).toNumber(), naiveBulk(10, 1.09, 5, 20), 1e-9));
ok('bulkCost of 1 level', close(D.bulkCost(10, 1.09, 7, 1).toNumber(), 10 * Math.pow(1.09, 7), 1e-9));
ok('bulkCost zero levels', D.bulkCost(10, 1.09, 0, 0).isZero());

const afford = D.maxAffordable(10, 1.09, 0, D(1e6));
ok('maxAffordable is affordable', D.bulkCost(10, 1.09, 0, afford).lte(D(1e6)), afford);
ok('maxAffordable is maximal', D.bulkCost(10, 1.09, 0, afford + 1).gt(D(1e6)), afford);
const afford2 = D.maxAffordable(10, 1.09, 0, D.pow10(500));
ok('maxAffordable works past double range', afford2 > 1000 && D.bulkCost(10, 1.09, 0, afford2).lte(D.pow10(500)), afford2);
ok('maxAffordable honours the cap', D.maxAffordable(10, 1.09, 0, D(1e6), 12) === 12);
ok('maxAffordable returns 0 when broke', D.maxAffordable(1000, 1.09, 0, D(10)) === 0);

/* the real growth curves must survive very deep stages */
const hpAt = s => D(10).mul(D(1.57).pow(s - 1)).mul(s > 60 ? D(1.055).pow(s - 60) : 1);
ok('stage 1 hp', close(hpAt(1).toNumber(), 10, 1e-9));
ok('stage 5000 hp is finite and huge', isFinite(hpAt(5000).log10()) && hpAt(5000).log10() > 1000, hpAt(5000).log10().toFixed(0));
ok('stage 1e6 hp still finite', isFinite(hpAt(1e6).log10()), hpAt(1e6).log10().toFixed(0));
ok('soul multiplier at 50k souls is finite', isFinite(D(1.06).pow(50000).log10()), D(1.06).pow(50000).log10().toFixed(0));

console.log('\n' + pass + '/' + (pass + fail) + ' big-number checks passed');
if (fail) process.exit(1);
