/* Arena (async PvP) + Mutation Lab tests */
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

const results = [];
function check(name, cond, extra) {
  results.push({ name, ok: !!cond });
  console.log((cond ? '  PASS  ' : '  FAIL  ') + name + (extra !== undefined ? '  [' + extra + ']' : ''));
}

(async () => {
  const server = await serve(5204);
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

  await page.goto('http://localhost:5204/', { waitUntil: 'networkidle' });
  await page.waitForSelector('#app:not([hidden])');
  await page.waitForTimeout(700);
  const tut = await page.$('.modal-bg [data-close]'); if (tut) await tut.click();

  /* give the player a real roster */
  await page.evaluate(() => {
    const g = window.CCDEBUG.state();
    g.bestStage = 60; g.gems = 5000; g.playerName = 'Tester';
    ['sparky', 'mossy', 'pyra', 'glacio', 'venn', 'phantom', 'reefus'].forEach((id, i) => {
      g.critters[id] = [300, 220, 160, 120, 80, 40, 15][i];
    });
  });
  await page.waitForTimeout(300);

  /* ---------- team codes ---------- */
  const codeTest = await page.evaluate(() => {
    const g = window.CCDEBUG.state(), AR = window.CC.arena;
    const code = AR.encodeTeam(g, 'Tester');
    const back = AR.decodeTeam(code);
    const mine = AR.myTeam(g);
    return {
      code, len: code.length, name: back.name,
      sameSize: back.team.length === mine.length,
      sameTiers: back.team.every((u, i) => u.tier === mine[i].tier),
      sameLevels: back.team.every((u, i) => u.level === mine[i].level),
      prMine: AR.powerRating(mine), prBack: AR.powerRating(back.team)
    };
  });
  check('team code round-trips the roster', codeTest.sameSize && codeTest.sameTiers && codeTest.sameLevels);
  check('team code preserves power rating', codeTest.prMine === codeTest.prBack, codeTest.prMine + ' / ' + codeTest.prBack);
  check('team code keeps the player name', codeTest.name === 'Tester');
  check('team code is short enough to paste in a chat', codeTest.len < 400, codeTest.len + ' chars');

  const badCode = await page.evaluate(() => {
    try { window.CC.arena.decodeTeam('not-a-code'); return 'accepted'; }
    catch (e) { return 'rejected'; }
  });
  check('malformed codes are rejected', badCode === 'rejected');

  /* ---------- determinism ---------- */
  const det = await page.evaluate(() => {
    const g = window.CCDEBUG.state(), AR = window.CC.arena;
    const mine = AR.myTeam(g);
    const rival = AR.generateRival(g, 12345, 1.0);
    const r1 = AR.simulate(mine, rival.team, 777);
    const r2 = AR.simulate(mine, rival.team, 777);
    const r3 = AR.simulate(mine, rival.team, 778);
    const dmg1 = r1.events.filter(e => e.type === 'hit').map(e => e.dmg);
    const dmg2 = r2.events.filter(e => e.type === 'hit').map(e => e.dmg);
    const dmg3 = r3.events.filter(e => e.type === 'hit').map(e => e.dmg);
    return {
      same: r1.winner === r2.winner && r1.events.length === r2.events.length &&
            Math.abs(r1.duration - r2.duration) < 1e-9 &&
            dmg1.every((d, i) => d === dmg2[i]),
      differs: dmg3.length !== dmg1.length || dmg3.some((d, i) => d !== dmg1[i]),
      events: r1.events.length, dur: r1.duration
    };
  });
  check('same seed reproduces the exact same battle', det.same, det.events + ' events, ' + det.dur + 's');
  check('a different seed produces a different battle', det.differs);
  check('battles resolve in a watchable time', det.dur > 0.5 && det.dur < 46, det.dur + 's');

  /* ---------- power actually decides fights ---------- */
  const fairness = await page.evaluate(() => {
    const g = window.CCDEBUG.state(), AR = window.CC.arena;
    const mine = AR.myTeam(g);
    let winsVsWeak = 0, winsVsStrong = 0, winsVsEven = 0;
    for (let i = 0; i < 40; i++) {
      if (AR.simulate(mine, AR.generateRival(g, i + 1, 0.25).team, i * 31 + 1).winner === 0) winsVsWeak++;
      if (AR.simulate(mine, AR.generateRival(g, i + 1, 4.0).team, i * 31 + 2).winner === 0) winsVsStrong++;
      if (AR.simulate(mine, AR.generateRival(g, i + 1, 1.0).team, i * 31 + 3).winner === 0) winsVsEven++;
    }
    return { winsVsWeak, winsVsStrong, winsVsEven };
  });
  check('beats far weaker rivals', fairness.winsVsWeak >= 38, fairness.winsVsWeak + '/40');
  check('loses to far stronger rivals', fairness.winsVsStrong <= 3, fairness.winsVsStrong + '/40');
  check('even rivals are a real coin-flip', fairness.winsVsEven >= 10 && fairness.winsVsEven <= 30, fairness.winsVsEven + '/40');

  /* ---------- ladder bookkeeping ---------- */
  const ladder = await page.evaluate(() => {
    const g = window.CCDEBUG.state(), AR = window.CC.arena;
    g.arena = { trophies: 0, wins: 0, losses: 0, streak: 0, gemsToday: 0, day: 0 };
    const gemsBefore = g.gems;
    const w = AR.applyResult(g, true, 100, 110);
    const afterWin = g.arena.trophies;
    const l = AR.applyResult(g, false, 100, 90);
    const afterLoss = g.arena.trophies;
    g.arena.trophies = 3;
    AR.applyResult(g, false, 100, 90);
    const floored = g.arena.trophies;
    let capped = 0;
    for (let i = 0; i < 40; i++) { AR.applyResult(g, true, 100, 100); }
    capped = g.arena.gemsToday;
    return { win: w.delta, afterWin, loss: l.delta, afterLoss, floored, gems: w.gems, gemsGained: g.gems - gemsBefore, capped };
  });
  check('a win adds trophies', ladder.win > 0 && ladder.afterWin === ladder.win, '+' + ladder.win);
  check('a loss removes trophies', ladder.loss < 0 && ladder.afterLoss < ladder.afterWin, ladder.loss);
  check('trophies never go below zero', ladder.floored === 0, ladder.floored);
  check('winning pays gems', ladder.gems > 0, ladder.gems);
  check('daily gem reward is capped', ladder.capped <= 60, ladder.capped);

  /* ---------- mutations ---------- */
  const mutTest = await page.evaluate(() => {
    const g = window.CCDEBUG.state(), CC = window.CC;
    const before = CC.state.derive(g, Date.now()).dps.log10();
    const cost1 = CC.mut.cost(g, 'sparky');
    // force a known good mutation
    g.mutRolls.sparky = 1;
    g.mutations.sparky = { rarity: 4, trait: 'sharp', element: 0, shape: 'dragon', hue: 20, seed: 4242 };
    const after = CC.state.derive(g, Date.now()).dps.log10();
    const cost2 = CC.mut.cost(g, 'sparky');
    // a global-trait mutation must lift gold
    const goldBefore = CC.state.derive(g, Date.now()).goldMult;
    g.mutations.mossy = { rarity: 1, trait: 'greedy', element: 1, shape: 'blob', hue: 100, seed: 99 };
    const goldAfter = CC.state.derive(g, Date.now()).goldMult;
    // random rolls stay in range
    let bad = 0;
    for (let i = 0; i < 400; i++) {
      const r = CC.mut.roll();
      if (r.rarity < 0 || r.rarity > 4) bad++;
      if (!CC.mut.TRAITS.some(t => t.id === r.trait)) bad++;
      if (r.element < 0 || r.element > 3) bad++;
    }
    return { before, after, cost1, cost2, goldBefore, goldAfter, bad };
  });
  check('a mythic Sharp mutation raises DPS', mutTest.after > mutTest.before,
        '10^' + mutTest.before.toFixed(2) + ' -> 10^' + mutTest.after.toFixed(2));
  check('re-rolling the same critter costs more', mutTest.cost2 > mutTest.cost1, mutTest.cost1 + ' -> ' + mutTest.cost2);
  check('a Greedy trait raises gold globally', mutTest.goldAfter > mutTest.goldBefore,
        mutTest.goldBefore.toFixed(3) + ' -> ' + mutTest.goldAfter.toFixed(3));
  check('400 random rolls are all valid', mutTest.bad === 0, mutTest.bad + ' invalid');

  /* ---------- mutations survive prestige ---------- */
  const survive = await page.evaluate(() => {
    const g = window.CCDEBUG.state(), CC = window.CC;
    g.bestStage = 60;
    CC.game.doPrestige();
    return { hasSparky: !!g.mutations.sparky, critters: Object.keys(g.critters).length };
  });
  check('mutations survive prestige', survive.hasSparky, 'critters reset to ' + survive.critters);

  /* ---------- full UI battle flow ---------- */
  await page.evaluate(() => {
    const g = window.CCDEBUG.state();
    g.bestStage = 60; g.gems = 3000;
    ['sparky', 'mossy', 'pyra', 'glacio', 'venn'].forEach((id, i) => { g.critters[id] = [300, 220, 160, 120, 80][i]; });
  });
  await page.click('#tabs .tab[data-view="arena"]');
  await page.waitForTimeout(700);
  const rivalCount = await page.$$eval('#rival-list .rival', els => els.length);
  check('arena lists three rivals', rivalCount === 3, rivalCount);
  const slots = await page.$$eval('#arena-myteam .teamslot:not(.empty)', els => els.length);
  check('arena shows the player squad', slots === 5, slots);
  await page.screenshot({ path: path.join(__dirname, '..', 'shots', 'v-arena.png') });

  await page.click('#rival-list .rival:nth-child(2) .fight');
  await page.waitForSelector('.battle-screen', { timeout: 5000 });
  await page.waitForTimeout(1400);
  await page.screenshot({ path: path.join(__dirname, '..', 'shots', 'v-battle.png') });
  const skip = await page.$('.battle-screen [data-skip]');
  if (skip) await skip.click();
  await page.waitForSelector('.battle-result.show', { timeout: 8000 });
  await page.waitForTimeout(600);
  const resultShown = await page.$eval('.battle-result', el => el.classList.contains('show'));
  check('battle plays out and shows a result', resultShown);
  await page.screenshot({ path: path.join(__dirname, '..', 'shots', 'v-battle-result.png') });
  await page.click('.battle-screen [data-back]');
  await page.waitForTimeout(500);
  const closed = await page.$('.battle-screen');
  check('battle screen closes cleanly', !closed);

  /* ---------- mutation lab UI ---------- */
  await page.click('#tabs .tab[data-view="critters"]');
  await page.waitForTimeout(500);
  await page.click('#critter-list .card:first-child .mut-btn');
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(__dirname, '..', 'shots', 'v-mutation.png') });
  const gemsBefore = await page.evaluate(() => window.CCDEBUG.state().gems);
  await page.click('.modal-bg [data-roll]');
  await page.waitForTimeout(600);
  const gemsAfter = await page.evaluate(() => window.CCDEBUG.state().gems);
  check('mutating spends gems', gemsAfter < gemsBefore, gemsBefore + ' -> ' + gemsAfter);
  const hasCompare = await page.$$eval('.mut-card', els => els.length);
  check('lab shows current vs new side by side', hasCompare === 2, hasCompare);
  await page.screenshot({ path: path.join(__dirname, '..', 'shots', 'v-mutation-roll.png') });
  await page.click('.modal-bg [data-keepnew]');
  await page.waitForTimeout(400);
  const kept = await page.evaluate(() => {
    const g = window.CCDEBUG.state();
    const first = Object.keys(g.mutations);
    return first.length;
  });
  check('keeping the roll stores the mutation', kept >= 1, kept);

  check('no runtime errors in the whole flow', errors.length === 0, errors.slice(0, 2).join(' | '));

  await browser.close(); server.close();
  const failed = results.filter(r => !r.ok);
  console.log('\n' + (results.length - failed.length) + '/' + results.length + ' arena checks passed');
  if (failed.length) { console.log('FAILED: ' + failed.map(f => f.name).join(', ')); process.exit(1); }
})().catch(e => { console.error(e); process.exit(1); });
