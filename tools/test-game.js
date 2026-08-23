/* Headless smoke + balance test for Critter Clash Idle */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..', 'www');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json' };

function serve(port) {
  return new Promise(res => {
    const s = http.createServer((req, rp) => {
      let p = decodeURIComponent(req.url.split('?')[0]);
      if (p === '/') p = '/index.html';
      const f = path.join(ROOT, p);
      if (!f.startsWith(ROOT) || !fs.existsSync(f)) { rp.writeHead(404); rp.end('nope'); return; }
      rp.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
      fs.createReadStream(f).pipe(rp);
    });
    s.listen(port, () => res(s));
  });
}

/** big numbers cross the page boundary as {m,e} — collapse them for assertions */
function bv(v) {
  if (v && typeof v === 'object' && 'm' in v && 'e' in v) {
    if (v.e > 308) return Infinity;
    return v.m * Math.pow(10, v.e);
  }
  return v;
}
function blog(v) {
  if (v && typeof v === 'object' && 'm' in v && 'e' in v) return v.m === 0 ? -Infinity : v.e + Math.log10(v.m);
  return v > 0 ? Math.log10(v) : -Infinity;
}

const results = [];
function check(name, cond, extra) {
  results.push({ name, ok: !!cond, extra: extra === undefined ? '' : String(extra) });
  console.log((cond ? '  PASS  ' : '  FAIL  ') + name + (extra !== undefined ? '  [' + extra + ']' : ''));
}

(async () => {
  const server = await serve(5199);
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
  const page = await ctx.newPage();

  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));

  await page.goto('http://localhost:5199/', { waitUntil: 'networkidle' });
  await page.waitForSelector('#app:not([hidden])', { timeout: 8000 });
  await page.waitForTimeout(900);

  // dismiss tutorial modal if present
  const modalBtn = await page.$('.modal-bg [data-close]');
  if (modalBtn) await modalBtn.click();
  await page.waitForTimeout(300);

  check('page booted without console errors', errors.length === 0, errors.slice(0, 3).join(' | '));

  /* ---- tapping deals damage & earns gold ---- */
  const box = await page.$('#taplayer');
  const b = await box.boundingBox();
  for (let i = 0; i < 30; i++) {
    await page.mouse.click(b.x + b.width / 2, b.y + b.height * 0.4);
  }
  await page.waitForTimeout(400);
  let st = await page.evaluate(() => window.CCDEBUG.state());
  check('taps registered', st.stats.taps >= 30, st.stats.taps);
  check('gold earned from kills', bv(st.gold) > 0, Math.round(bv(st.gold)));
  check('monsters killed', st.stats.kills > 0, st.stats.kills);

  /* ---- hiring a critter creates DPS ---- */
  await page.click('#tabs .tab[data-view="critters"]');
  await page.waitForTimeout(250);
  await page.evaluate(() => window.CCDEBUG.addGold(1e5));
  await page.waitForTimeout(350);
  await page.click('#critter-list .card:first-child .buy');
  await page.waitForTimeout(500);
  let d = await page.evaluate(() => window.CCDEBUG.derive());
  check('critter hire produced DPS', bv(d.dps) > 0, bv(d.dps).toFixed(2));

  /* ---- upgrades apply ---- */
  await page.click('#tabs .tab[data-view="upgrades"]');
  await page.waitForTimeout(250);
  const tapBefore = bv((await page.evaluate(() => window.CCDEBUG.derive())).tap);
  await page.click('#upgrade-list > .card:first-child .buy');
  await page.waitForTimeout(300);
  const tapAfter = bv((await page.evaluate(() => window.CCDEBUG.derive())).tap);
  check('upgrade increased tap damage', tapAfter > tapBefore, tapBefore.toFixed(1) + ' -> ' + tapAfter.toFixed(1));

  /* ---- boss stage reachable and timer runs ---- */
  await page.click('#tabs .tab[data-view="battle"]');
  await page.evaluate(() => window.CCDEBUG.jump(5));
  await page.waitForTimeout(1200);
  st = await page.evaluate(() => window.CCDEBUG.state());
  check('boss stage started with a timer', st.bossActive && st.bossTimer > 0, 'timer=' + st.bossTimer.toFixed(1));
  await page.screenshot({ path: path.join(__dirname, '..', 'shots', 'boss.png') });

  /* ---- skills ---- */
  const usedSkill = await page.evaluate(() => {
    const g = window.CCDEBUG.state();
    g.bestStage = 20;
    return window.CC.game.useSkill('fury');
  });
  await page.waitForTimeout(200);
  const furyOn = await page.evaluate(() => window.CCDEBUG.derive().furyMult);
  check('skill Fury activates', usedSkill && furyOn > 1, 'mult=' + furyOn);

  /* ---- prestige ---- */
  const gain = await page.evaluate(() => {
    const g = window.CCDEBUG.state();
    g.bestStage = 40;
    return window.CC.game.prestigeGain();
  });
  check('prestige grants souls at stage 40', gain > 0, gain);
  await page.evaluate(() => window.CC.game.doPrestige());
  await page.waitForTimeout(600);
  st = await page.evaluate(() => window.CCDEBUG.state());
  check('prestige reset gold & kept souls', bv(st.gold) === 0 && st.souls > 0, 'souls=' + st.souls);
  check('prestige incremented counter', st.prestiges === 1, st.prestiges);

  /* ---- the HP bar must track the monster, not just exist ----
     Regression: after the big-number conversion the bar did `hp / maxHp`
     on two objects, got NaN, and silently froze at 100% while monsters
     vanished. Assert the rendered width against the true ratio.        */
  await page.click('#tabs .tab[data-view="battle"]');
  await page.evaluate(() => window.CCDEBUG.jump(12));
  await page.waitForTimeout(900);

  const hpFull = await page.evaluate(() => {
    const m = window.CC.game.monster;
    return {
      width: document.getElementById('hp-fill').style.width,
      text: document.getElementById('hp-text').textContent,
      ratio: m ? m.hp.ratio(m.maxHp) : -1
    };
  });
  const wFull = parseFloat(hpFull.width);
  check('HP bar renders a real percentage', isFinite(wFull) && wFull > 90 && wFull <= 100, hpFull.width);
  check('HP label shows real numbers', !/NaN|∞|undefined/.test(hpFull.text), hpFull.text);

  const hpHalf = await page.evaluate(() => {
    const m = window.CC.game.monster;
    window.CC.game.damage(m.hp.mul(0.5));      // exactly half its remaining health
    window.CC.ui.updateHud();
    return {
      width: document.getElementById('hp-fill').style.width,
      text: document.getElementById('hp-text').textContent,
      ratio: window.CC.game.monster ? window.CC.game.monster.hp.ratio(window.CC.game.monster.maxHp) : -1
    };
  });
  const wHalf = parseFloat(hpHalf.width);
  check('HP bar drops to ~50% after half the health is removed',
        Math.abs(wHalf - 50) < 2, hpHalf.width);
  check('HP bar strictly decreases as damage lands', wHalf < wFull - 20, wFull + '% -> ' + wHalf + '%');
  check('HP bar matches the true ratio', Math.abs(wHalf / 100 - hpHalf.ratio) < 0.02,
        (wHalf / 100).toFixed(4) + ' vs ' + hpHalf.ratio.toFixed(4));

  const hpQuarter = await page.evaluate(() => {
    const m = window.CC.game.monster;
    window.CC.game.damage(m.hp.mul(0.5));
    window.CC.ui.updateHud();
    return parseFloat(document.getElementById('hp-fill').style.width);
  });
  check('HP bar keeps tracking on further hits', Math.abs(hpQuarter - 25) < 2, hpQuarter + '%');

  /* ---- doubling offline gold must actually double it ----
     Regression: `rep.gold * 2` on a big number produced NaN and granted zero. */
  const offline = await page.evaluate(() => {
    const g = window.CCDEBUG.state(), CC = window.CC;
    const rep = { seconds: 3600, capped: 3600, gold: CC.D(1e6) };
    const before = g.gold;
    CC.game.grantGold(rep.gold);
    const single = g.gold.sub(before).log10();
    const mid = g.gold;
    CC.game.grantGold(rep.gold.mul(2));
    const doubled = g.gold.sub(mid).log10();
    return { single, doubled };
  });
  check('offline ×2 grants exactly twice the base', 
        Math.abs(offline.doubled - offline.single - Math.log10(2)) < 1e-9,
        '10^' + offline.single.toFixed(3) + ' -> 10^' + offline.doubled.toFixed(3));

  /* ---- big-number achievement thresholds ----
     Regression: `bigNumber >= 1e9` is always false. */
  const rich = await page.evaluate(() => {
    const g = window.CCDEBUG.state(), CC = window.CC;
    delete g.achievements.a_gold1e9;
    g.stats.totalGold = CC.D(5e9);
    CC.game.checkAchievements();
    return !!g.achievements.a_gold1e9;
  });
  check('gold-threshold achievement fires on big numbers', rich);

  /* ---- optional ×2 ad on prestige ---- */
  await page.click('#tabs .tab[data-view="battle"]');
  await page.evaluate(() => window.CCDEBUG.jump(60));
  await page.waitForTimeout(700);
  await page.click('#tabs .tab[data-view="prestige"]');
  await page.waitForTimeout(400);
  const soulsBefore = (await page.evaluate(() => window.CCDEBUG.state())).souls;
  const expectGain = await page.evaluate(() => window.CC.game.prestigeGain());
  await page.click('#prestige-btn');
  await page.waitForTimeout(300);
  await page.click('.modal-bg [data-yes]');
  await page.waitForTimeout(900);
  const hasOffer = await page.$('.modal-bg [data-double]');
  check('prestige shows the optional x2 offer', !!hasOffer, 'gain=' + expectGain);
  const soulsAfterBase = (await page.evaluate(() => window.CCDEBUG.state())).souls;
  check('base souls granted before the ad is shown', soulsAfterBase === soulsBefore + expectGain,
        soulsBefore + ' -> ' + soulsAfterBase);
  await page.screenshot({ path: path.join(__dirname, '..', 'shots', 'prestige-x2.png') });
  await hasOffer.click();
  await page.waitForSelector('.ad-sim', { timeout: 4000 });
  await page.waitForSelector('.ad-sim-skip:not([disabled])', { timeout: 12000 });
  await page.click('.ad-sim-skip');
  await page.waitForTimeout(500);
  const soulsDoubled = (await page.evaluate(() => window.CCDEBUG.state())).souls;
  check('watching the ad doubles the souls', soulsDoubled === soulsBefore + expectGain * 2,
        soulsAfterBase + ' -> ' + soulsDoubled);
  const adsCount = (await page.evaluate(() => window.CCDEBUG.state())).stats.ads;
  check('ad view counted in stats', adsCount >= 1, adsCount);

  /* skipping the offer must keep the base reward */
  await page.evaluate(() => { window.CCDEBUG.state().bestStage = 60; });
  await page.click('#tabs .tab[data-view="prestige"]');
  await page.waitForTimeout(300);
  const sBefore2 = (await page.evaluate(() => window.CCDEBUG.state())).souls;
  const gain2 = await page.evaluate(() => window.CC.game.prestigeGain());
  await page.click('#prestige-btn');
  await page.waitForTimeout(250);
  await page.click('.modal-bg [data-yes]');
  await page.waitForTimeout(800);
  await page.click('.modal-bg [data-skip]');
  await page.waitForTimeout(300);
  const sAfter2 = (await page.evaluate(() => window.CCDEBUG.state())).souls;
  check('skipping the ad still keeps the base souls', sAfter2 === sBefore2 + gain2, sBefore2 + ' -> ' + sAfter2);

  /* ---- persistence ---- */
  await page.evaluate(() => { window.CCDEBUG.addGold(123456); window.CCDEBUG.save(); });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('#app:not([hidden])');
  await page.waitForTimeout(900);
  const m2 = await page.$('.modal-bg [data-x1]');
  if (m2) await m2.click();
  st = await page.evaluate(() => window.CCDEBUG.state());
  check('save survived reload', bv(st.gold) >= 123456 && st.souls > 0, Math.round(bv(st.gold)));

  /* ---- language switch ---- */
  await page.click('#tabs .tab[data-view="more"]');
  await page.waitForTimeout(200);
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('#more-body .buymode button'));
    const en = btns.find(b => b.textContent === 'English');
    if (en) en.click();
  });
  await page.waitForTimeout(400);
  const dir = await page.evaluate(() => document.documentElement.dir);
  check('language switch flips direction to LTR', dir === 'ltr', dir);
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('#more-body .buymode button'));
    const ar = btns.find(b => b.textContent === 'العربية');
    if (ar) ar.click();
  });
  await page.waitForTimeout(300);

  /* ---- screenshots of every view ---- */
  fs.mkdirSync(path.join(__dirname, '..', 'shots'), { recursive: true });
  for (const v of ['battle', 'critters', 'upgrades', 'prestige', 'more']) {
    await page.click('#tabs .tab[data-view="' + v + '"]');
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(__dirname, '..', 'shots', v + '.png') });
  }

  /* ---- long-run simulation: 12 minutes of idle play, no errors, real progress ---- */
  await page.click('#tabs .tab[data-view="battle"]');
  await page.evaluate(() => window.CCDEBUG.wipe());
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('#app:not([hidden])');
  await page.waitForTimeout(800);
  const tut = await page.$('.modal-bg [data-close]');
  if (tut) await tut.click();

  const sim = await page.evaluate(async () => {
    const g = window.CCDEBUG.state();
    const CC = window.CC;
    const marks = [];
    // simulate 12 minutes at 20 ticks/sec with a tap every ~0.5s
    for (let s = 0; s < 12 * 60; s++) {
      for (let k = 0; k < 20; k++) {
        CC.game.tick(0.05);
        if (k % 10 === 0) CC.game.tap(100, 100);
      }
      // spend gold like a competent player: best DPS-gain per gold, repeatedly
      if (s % 3 === 0) {
        for (let pass = 0; pass < 12; pass++) {
          let best = null;
          const top = CC.data.highestUnlockedTier(g.bestStage);
          for (let ti = 0; ti <= top; ti++) {
            const c = CC.data.getCritter(ti);
            const lv = g.critters[c.id] || 0;
            const cost = CC.D.bulkCost(c.baseCost, c.costMult, lv, 1);
            if (cost.gt(g.gold)) continue;
            const cur = CC.D(c.baseDps).mul(lv * CC.data.critterMilestoneMult(lv));
            const nxt = CC.D(c.baseDps).mul((lv + 1) * CC.data.critterMilestoneMult(lv + 1));
            const val = nxt.sub(cur).div(cost).log10();
            if (!best || val > best.val) best = { val, kind: 'c', id: c.id };
          }
          for (const u of CC.data.UPGRADES) {
            const lv = g.upgrades[u.id] || 0;
            if (lv >= u.max) continue;
            const cost = CC.D.bulkCost(u.baseCost, u.costMult, lv, 1);
            if (cost.gt(g.gold)) continue;
            // rough worth: treat a damage/gold upgrade as a % of current dps
            const w = { squad: 0.10, greed: 0.05, power: 0.02, claw: 0.01, crit: 0.02,
                        critdmg: 0.01, tapdps: 0.02, multi: 0.01, bosstime: 0.005, gemluck: 0.001 }[u.id] || 0.01;
            const val = CC.game.d.dps.mul(w).div(cost).log10();
            if (!best || val > best.val) best = { val, kind: 'u', id: u.id };
          }
          if (!best) break;
          if (best.kind === 'c') CC.game.buyCritter(best.id, 1);
          else CC.game.buyUpgrade(best.id, 1);
        }
      }
      // use every skill the moment it comes off cooldown
      if (s % 5 === 0) for (const sk of CC.data.SKILLS) CC.game.useSkill(sk.id);
      if (s % 120 === 0) marks.push({ min: s / 60, stage: g.stage, dps: CC.D.format(CC.game.d.dps) });
    }
    return { marks, stage: g.stage, best: g.bestStage, dps: CC.D.format(CC.game.d.dps),
             kills: g.stats.kills, souls: CC.game.prestigeGain() };
  });
  console.log('\n  12-minute idle simulation:');
  sim.marks.forEach(m => console.log('    t=' + m.min + 'min  stage ' + m.stage + '  dps ' + m.dps));
  console.log('    final: stage ' + sim.stage + ', dps ' + sim.dps + ', kills ' + sim.kills + ', souls-if-prestige ' + sim.souls);
  check('12 min of play reaches a healthy stage (15-90)', sim.stage >= 15 && sim.stage <= 90, 'stage ' + sim.stage);
  check('prestige is worthwhile after 12 min', sim.souls >= 3, sim.souls);
  check('no errors during long run', errors.length === 0, errors.slice(0, 3).join(' | '));

  await browser.close();
  server.close();

  const failed = results.filter(r => !r.ok);
  console.log('\n' + (results.length - failed.length) + '/' + results.length + ' checks passed');
  if (failed.length) { console.log('FAILED: ' + failed.map(f => f.name).join(', ')); process.exit(1); }
})().catch(e => { console.error(e); process.exit(1); });
