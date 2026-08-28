/* Stamps versionName / versionCode into the generated Android project.
 *
 * Google Play rejects any upload whose versionCode it has already seen, so the
 * number has to grow on every single build. `npm run android:stamp` reads the
 * name from package.json and takes the code from $VERSION_CODE (the CI run
 * number), falling back to a timestamp-derived value for local builds.
 *
 *   node tools/stamp-version.js              # auto version code
 *   VERSION_CODE=42 node tools/stamp-version.js
 */
const fs = require('fs');
const path = require('path');

const GRADLE = path.join(__dirname, '..', 'android', 'app', 'build.gradle');

function versionCode() {
  const env = parseInt(process.env.VERSION_CODE, 10);
  if (Number.isFinite(env) && env > 0) return env;
  // minutes since 2024-01-01: always increases, stays well inside Play's 2100000000 ceiling
  return Math.floor((Date.now() - Date.UTC(2024, 0, 1)) / 60000);
}

function main() {
  if (!fs.existsSync(GRADLE)) {
    console.error('android/app/build.gradle not found — run "npx cap add android" first.');
    process.exit(1);
  }
  const name = require(path.join(__dirname, '..', 'package.json')).version;
  const code = versionCode();

  let s = fs.readFileSync(GRADLE, 'utf8');
  const before = s;
  s = s.replace(/versionCode\s+\d+/, 'versionCode ' + code);
  s = s.replace(/versionName\s+"[^"]*"/, 'versionName "' + name + '"');

  if (s === before) {
    console.error('could not find versionCode/versionName in build.gradle — nothing stamped.');
    process.exit(1);
  }
  fs.writeFileSync(GRADLE, s);
  console.log('versionName ' + name + '  versionCode ' + code);
}

main();
