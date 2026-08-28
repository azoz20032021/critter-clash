/* Proves the game is actually endless: run prestige cycle after prestige cycle
   with an auto-player and check that depth keeps growing and nothing overflows. */
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ROOT = path.join(__dirname, '..', 'www');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json' };
const serve = p => new Promise(r => {
  const s = http.createServer((q, rp) => {
    let u = q.url.split('?')[0]; if (u === '/') u = '/index.html';
    const f = path.join(ROOT, u);
    if (!fs.existsSync(f)) { rp.writeHead(404); rp.end(); return; }
    rp.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'text/plain' });
    fs.createReadStream(f).pipe(rp);
  }); s.listen(p, () => r(s));
});

(async () => {
  const server = await serve(5203);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('http://localhost:5203/', { waitUntil: 'networkidle' });
  await page.waitForSelector('#app:not([hidden])');
  await page.waitForTimeout(600);
  const tut = await page.$('.modal-bg [data-close]'); if (tut) await tut.click();

  const out = await page.evaluate(async (CYCLES) => {
    const CC = window.CC, D = CC.D;
    const g = window.CCDEBUG.state();
    CC.game.running = true;
    /* headless speed: no sound, no UI churn, no visual effects */
    g.sound = false; g.music = false; g.reduceFx = true;
    CC.audio.setSfx(false); CC.audio.setMusic(false);
    CC.game.onEvent = null;
    const log = [];

    function autoBuy() {
      for (let pass = 0; pass < 25; pass++) {
        let best = null, bestVal = -Infinity;
        const top = CC.data.highestUnlockedTier(g.bestStage);
        for (let ti = Math.max(0, top - 14); ti <= top; ti++) {
          const c = CC.data.getCritter(ti);
          const lv = g.critters[c.id] || 0;
          const cost = D.bulkCost(c.baseCost, c.costMult, lv, 1);
          if (cost.gt(g.gold)) continue;
          const cur = D(c.baseDps).mul(lv * CC.data.critterMilestoneMult(lv));
          const nxt = D(c.baseDps).mul((lv + 1) * CC.data.critterMilestoneMult(lv + 1));
          const val = nxt.sub(cur).div(cost).log10();
          if (val > bestVal) { bestVal = val; best = { kind: 'c', id: c.id }; }
        }
        for (const u of CC.data.UPGRADES) {
          const lv = g.upgrades[u.id] || 0;
          if (lv >= u.max) continue;
          const cost = D.bulkCost(u.baseCost, u.costMult, lv, 1);
          if (cost.gt(g.gold)) continue;
          const w = { squad: 0.10, greed: 0.05, power: 0.02, claw: 0.01, crit: 0.02,
                      critdmg: 0.01, tapdps: 0.02, multi: 0.01, bosstime: 0.005, gemluck: 0.001,
                      focus: 0.03, fortune: 0.03, haste: 0.01, treasure: 0.002, soulseek: 0.02 }[u.id] || 0.01;
          const val = CC.game.d.dps.mul(w).div(cost).log10();
          if (val > bestVal) { bestVal = val; best = { kind: 'u', id: u.id }; }
        }
        for (const sk of CC.data.SKILLS) {
          if (!CC.game.skillUnlocked(sk.id)) continue;
          const lv = CC.state.skillLevel(g, sk.id);
          if (lv >= sk.maxLv) continue;
          const cost = D.bulkCost(sk.upCost, sk.upMult, lv, 1);
          if (cost.gt(g.gold)) continue;
          const val = CC.game.d.dps.mul(0.02).div(cost).log10();
          if (val > bestVal) { bestVal = val; best = { kind: 's', id: sk.id }; }
        }
        if (!best) break;
        if (best.kind === 'c') CC.game.buyCritter(best.id, 1);
        else if (best.kind === 's') CC.game.buySkillUpgrade(best.id, 1);
        else CC.game.buyUpgrade(best.id, 1);
      }
    }

    function buyRelics() {
      /* Ancient Map first: skipping the walk back is worth more than raw damage */
      for (let i = 0; i < 60; i++) {
        if (CC.game.relicCost('r_start') > g.souls / 2) break;
        if (!CC.game.buyRelic('r_start')) break;
      }
      for (let i = 0; i < 40; i++) {
        let bought = false;
        for (const r of CC.data.RELICS) {
          const cost = CC.game.relicCost(r.id);
          if (cost <= g.souls / 3) { if (CC.game.buyRelic(r.id)) bought = true; }
        }
        if (!bought) break;
      }
    }

    /** Play one run until progress stalls; returns the stage reached. */
    function playRun(maxSimSeconds) {
      let lastStage = g.stage, stagnant = 0;
      for (let sec = 0; sec < maxSimSeconds; sec++) {
        for (let k = 0; k < 4; k++) {
          CC.game.tick(0.25);
          if (k % 2 === 0) CC.game.tap(100, 100);
        }
        if (sec % 2 === 0) autoBuy();
        if (sec % 4 === 0) for (const sk of CC.data.SKILLS) CC.game.useSkill(sk.id);
        if (g.stage > lastStage) { lastStage = g.stage; stagnant = 0; }
        else if (++stagnant > 60) break;         // 60s with no new stage = walled
        if (g.bossFailed) { g.bossFailed = false; CC.game.startBoss(); }
      }
      return g.bestStage;
    }

    for (let cycle = 0; cycle < CYCLES; cycle++) {
      const reached = playRun(cycle === 0 ? 700 : 500);
      const souls = CC.game.prestigeGain();
      log.push({
        cycle: cycle + 1,
        stage: reached,
        souls,
        totalSouls: g.souls + souls,
        power: D.format(CC.data.soulMultiplier(g.souls + souls)),
        dps: D.format(CC.game.d.dps),
        gold: D.format(g.gold),
        tiers: CC.data.highestUnlockedTier(reached) + 1,
        finite: isFinite(CC.game.d.dps.log10()) && isFinite(g.gold.log10())
      });
      buyRelics();
      CC.game.doPrestige();
    }
    return log;
  }, 9);

  console.log('\n  Endless-progression simulation (auto-player, 9 prestige cycles)\n');
  console.log('  cycle |  stage  |  souls gained |  soul power  |  peak DPS  | critter tiers');
  console.log('  ------+---------+---------------+--------------+------------+--------------');
  out.forEach(r => {
    console.log('   ' + String(r.cycle).padStart(4) + ' | ' + String(r.stage).padStart(7) + ' | ' +
      String(r.souls).padStart(13) + ' | ' + String(r.power).padStart(12) + ' | ' +
      String(r.dps).padStart(10) + ' | ' + String(r.tiers).padStart(12));
  });

  let ok = true;
  const fails = [];
  for (let i = 1; i < out.length; i++) {
    if (out[i].stage <= out[i - 1].stage) { ok = false; fails.push('cycle ' + (i + 1) + ' did not go deeper'); }
  }
  if (!out.every(r => r.finite)) { ok = false; fails.push('a value overflowed to Infinity'); }
  if (out[out.length - 1].stage < 500) { ok = false; fails.push('final depth under stage 500'); }
  if (errors.length) { ok = false; fails.push('runtime errors: ' + errors.slice(0, 2).join(' | ')); }

  const growth = out[out.length - 1].stage / out[0].stage;
  console.log('\n  depth multiplied ' + growth.toFixed(0) + '× over 9 prestiges, deepest stage ' +
    out[out.length - 1].stage);
  console.log(ok ? '\n  PASS — progression is unbounded and numerically stable'
                 : '\n  FAIL — ' + fails.join('; '));

  await browser.close(); server.close();
  if (!ok) process.exit(1);
})().catch(e => { console.error(e); process.exit(1); });
