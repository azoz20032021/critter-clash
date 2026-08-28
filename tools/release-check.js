/* Pre-release guard rail.
 *
 * Everything below is a mistake you can only make once, and each one is either
 * unfixable after publishing or costs you real money. Run it before every
 * store upload:  npm run release:check
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');

const problems = [];   // block the release
const warnings = [];   // worth knowing, not fatal

/* ---- 1. AdMob ----------------------------------------------------------
   Shipping Google's public test unit ids to production violates AdMob policy
   and can get the whole account suspended, so this blocks by default. Set
   ALLOW_TEST_ADS=1 if you deliberately want to publish before monetising. */
const adsAreFatal = process.env.ALLOW_TEST_ADS !== '1';
const adBucket = adsAreFatal ? problems : warnings;
const ads = read('www/js/ads.js');
if (/USE_TEST_ADS\s*=\s*true/.test(ads)) {
  adBucket.push(
    'www/js/ads.js still has USE_TEST_ADS = true — a released build would show ' +
    "Google's test ads and earn nothing. Set it to false.");
}
if (ads.includes('ca-app-pub-3940256099942544')) {
  adBucket.push(
    "www/js/ads.js still uses Google's public TEST ad unit ids. Paste your own " +
    'AdMob rewarded unit ids into AD_UNITS (or set ALLOW_TEST_ADS=1 to publish without ads).');
}

/* ---- 2. Identity ------------------------------------------------------- */
const cap = JSON.parse(read('capacitor.config.json'));
if (cap.appId === 'com.critterclash.idle') {
  warnings.push(
    'capacitor.config.json appId is still the sample "com.critterclash.idle". ' +
    'It can NEVER be changed after your first Play upload — make sure this is ' +
    'really the id you want.');
}
if (!/^[a-z][a-z0-9_]*(\.[a-z0-9_]+)+$/.test(cap.appId)) {
  problems.push('capacitor.config.json appId "' + cap.appId + '" is not a valid Android package name.');
}

/* ---- 3. Version -------------------------------------------------------- */
const pkg = JSON.parse(read('package.json'));
if (!/^\d+\.\d+\.\d+$/.test(pkg.version)) {
  problems.push('package.json version "' + pkg.version + '" should look like 1.2.3.');
}

/* ---- 4. Store assets --------------------------------------------------- */
const assets = [
  ['resources/icon-512.png', 'Play Console app icon (512×512)'],
  ['resources/feature-graphic.png', 'Play Console feature graphic (1024×500)'],
  ['www/icon-192.png', 'PWA icon'],
  ['www/icon-512.png', 'PWA icon'],
  ['docs/privacy.html', 'privacy policy page (Play requires a public URL)']
];
for (const [file, what] of assets) {
  if (!fs.existsSync(path.join(ROOT, file))) {
    problems.push('missing ' + file + ' — ' + what + '. Run "npm run icons".');
  }
}
const shots = fs.existsSync(path.join(ROOT, 'shots'))
  ? fs.readdirSync(path.join(ROOT, 'shots')).filter(f => f.endsWith('.png'))
  : [];
if (shots.length < 2) {
  problems.push('Play needs at least 2 phone screenshots — run "npm test" or "npm run shots".');
}

/* ---- 5. Debug surface -------------------------------------------------- */
const main = read('www/js/main.js');
if (main.includes('global.CCDEBUG') && !main.includes('nativeBuild')) {
  problems.push('www/js/main.js exposes CCDEBUG unconditionally — the shipped app would ship cheats.');
}

/* ---- report ------------------------------------------------------------ */
for (const w of warnings) console.log('  WARN   ' + w);
for (const p of problems) console.log('  BLOCK  ' + p);

if (!problems.length) {
  console.log('\n  release check passed' + (warnings.length ? ' (' + warnings.length + ' warning(s) above)' : '') + '.');
  process.exit(0);
}
console.log('\n  ' + problems.length + ' blocking issue(s). Fix these before uploading to Google Play.');
process.exit(1);
