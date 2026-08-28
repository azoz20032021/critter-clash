/* Smoke test for the systems added in 1.1: the prestige soul ledger, the
   gold-bought skill track, the Fusion Lab and elite monsters — driven through
   the real UI, not just the model. */
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..', 'www');
const SHOTS = path.join(__dirname, '..', 'shots');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json' };

const serve = p => new Promise(r => {
  const s = http.createServer((q, rp) => {
    let u = decodeURIComponent(q.url.split('?')[0]); if (u === '/') u = '/index.html';
    const f = path.join(ROOT, u);
    if (!f.startsWith(ROOT) || !fs.existsSync(f)) { rp.writeHead(404); rp.end(); return; }
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
  const server = await serve(5205);
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

  await page.goto('http://localhost:5205/', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#app:not([hidden])', { timeout: 8000 });
  await page.waitForTimeout(700);
  const tut = await page.$('.modal-bg [data-close]'); if (tut) await tut.click();
  await page.waitForTimeout(200);
  fs.mkdirSync(SHOTS, { recursive: true });

  /* ---- elites actually spawn and are worth more ---- */
  const elite = await page.evaluate(() => {
    const CC = window.CC;
    const normal = CC.game.makeMonster(3, 0);
    const el = CC.game.makeMonster(3, CC.data.BAL.eliteIndex);
    return { isElite: !!el.elite, notElite: !normal.elite, ratio: el.maxHp.div(normal.maxHp).toNumber() };
  });
  check('an elite spawns at its slot in every stage', elite.isElite && elite.notElite);
  check('elites are meaningfully tougher', elite.ratio > 2.5, '×' + elite.ratio.toFixed(1));

  /* ---- the prestige panel explains the soul rule ---- */
  await page.evaluate(() => { window.CCDEBUG.jump(30); });
  await page.click('#tabs .tab[data-view="prestige"]');
  await page.waitForTimeout(400);
  const pNote = await page.textContent('#p-note');
  check('prestige panel names the next paying stage', /\d/.test(pNote) && pNote.length > 8, pNote);
  const btnBefore = await page.textContent('#prestige-btn');
  check('prestige button shows the pending souls', /👻/.test(btnBefore), btnBefore);

  await page.click('#prestige-btn');
  await page.waitForTimeout(250);
  await page.click('.modal-bg [data-yes]');
  await page.waitForTimeout(700);
  const skip = await page.$('.modal-bg [data-skip]'); if (skip) await skip.click();
  await page.waitForTimeout(300);

  await page.click('#tabs .tab[data-view="prestige"]');
  await page.waitForTimeout(400);
  const btnAfter = await page.textContent('#prestige-btn');
  const disabled = await page.evaluate(() => document.getElementById('prestige-btn').disabled);
  check('the button locks once the depth is paid for', disabled === true, btnAfter);
  await page.screenshot({ path: path.join(SHOTS, 'v-prestige-ledger.png') });

  /* pushing deeper unlocks it again */
  await page.evaluate(() => { window.CCDEBUG.jump(60); });
  await page.click('#tabs .tab[data-view="battle"]');
  await page.click('#tabs .tab[data-view="prestige"]');
  await page.waitForTimeout(400);
  const reEnabled = await page.evaluate(() => document.getElementById('prestige-btn').disabled);
  check('going deeper unlocks prestige again', reEnabled === false);

  /* ---- skill upgrades in the UI ---- */
  await page.evaluate(() => { window.CCDEBUG.addGold(1e10); });
  await page.click('#tabs .tab[data-view="upgrades"]');
  await page.waitForTimeout(500);
  const skillRows = await page.evaluate(() => document.querySelectorAll('#skill-list .card').length);
  check('every skill has an upgrade row', skillRows === 7, skillRows);
  const before = await page.textContent('#skill-list .card:first-child .s-ds');
  await page.click('#skill-list .card:first-child .buy');
  await page.waitForTimeout(400);
  const after = await page.textContent('#skill-list .card:first-child .s-ds');
  const lvTxt = await page.textContent('#skill-list .card:first-child .s-lv');
  check('buying a skill level changes its stated power', after !== before, before + ' -> ' + after);
  check('the skill row shows its level', /1\//.test(lvTxt), lvTxt);
  await page.screenshot({ path: path.join(SHOTS, 'v-skill-upgrades.png'), fullPage: true });

  /* ---- Fusion Lab ---- */
  const setup = await page.evaluate(() => {
    const g = window.CCDEBUG.state(), CC = window.CC, D = CC.data;
    g.gems = 5000;
    const target = D.getCritter(1).id;
    g.critters[target] = 3;
    g.critters[D.getCritter(0).id] = D.fusionNeedLevel(0);
    return { target, need: D.fusionNeedLevel(0) };
  });
  await page.click('#tabs .tab[data-view="critters"]');
  await page.waitForTimeout(500);
  await page.click('#critter-list .card[data-id="' + setup.target + '"] .fuse-btn');
  await page.waitForTimeout(400);
  const rows = await page.evaluate(() => document.querySelectorAll('.modal-bg .fuse-row').length);
  check('the fusion lab lists eligible sacrifices', rows >= 1, rows);
  await page.screenshot({ path: path.join(SHOTS, 'v-fusion.png') });
  await page.click('.modal-bg [data-fuse]');
  await page.waitForTimeout(500);
  const fused = await page.evaluate(() => {
    const g = window.CCDEBUG.state();
    return { fusions: g.fusions, gems: g.gems };
  });
  check('fusing through the UI awards a star', Object.values(fused.fusions).some(v => v > 0), JSON.stringify(fused.fusions));
  const starLabel = await page.textContent('#critter-list .card[data-id="' + setup.target + '"] .fuse-btn');
  check('the card badges the star count', starLabel.includes('1'), starLabel);
  await page.screenshot({ path: path.join(SHOTS, 'v-critters-fused.png'), fullPage: true });

  /* ---- every new upgrade and skill has to actually do something ---- */
  const effects = await page.evaluate(() => {
    const g = window.CCDEBUG.state(), CC = window.CC;
    const D0 = () => CC.state.derive(g, Date.now());
    g.upgrades = {}; g.relics = {}; g.skills = {}; g.boosts = {};
    const base = D0();

    g.upgrades.focus = 10;      const focus = D0().bossDmg;
    g.upgrades.fortune = 10;    const fortune = D0().bossGoldMult;
    g.upgrades.haste = 10;      const haste = D0().cdMult;
    g.upgrades.treasure = 10;   const chest = D0().chestWait;
    g.upgrades.soulseek = 10;   const soul = D0().soulMultOnPrestige;

    /* boss-only damage must not leak onto ordinary monsters */
    CC.game.gotoStage(3);
    const plain = CC.game.makeMonster(3, 0);
    CC.game.monster = plain;
    const beforePlain = plain.hp.log10();
    CC.game.damage(CC.D(1));
    const plainDrop = beforePlain - CC.game.monster.hp.log10();

    /* the two new skills */
    g.bestStage = 400;
    CC.game.skillState('frost').cdEnd = 0;
    CC.game.skillState('berserk').cdEnd = 0;
    const frostUsed = CC.game.useSkill('frost');
    const berserkUsed = CC.game.useSkill('berserk');
    const d = D0();
    return {
      baseBossDmg: base.bossDmg, focus, fortune,
      baseCd: base.cdMult, haste, chest, soul,
      plainUnaffected: plainDrop > 0,
      frostUsed, berserkUsed, frozen: d.frozen, crit: d.critChance
    };
  });
  check('Boss Hunter raises boss damage', effects.baseBossDmg === 1 && effects.focus > 1, '×' + effects.focus);
  check('Boss Hoard raises boss gold', effects.fortune > 1, '×' + effects.fortune);
  check('Skill Haste shortens cooldowns', effects.haste < effects.baseCd, effects.baseCd + ' -> ' + effects.haste);
  check('Chest Hunter shortens the chest wait', effects.chest < 1, '×' + effects.chest.toFixed(2));
  check('Soul Seeker raises the prestige payout', effects.soul > 1, '×' + effects.soul);
  check('ordinary monsters still take normal damage', effects.plainUnaffected);
  check('Deep Freeze holds the boss timer', effects.frostUsed && effects.frozen === true);
  check('Berserk guarantees critical taps', effects.berserkUsed && effects.crit === 1, effects.crit);

  /* the freeze must really stop the clock, not just set a flag */
  const frozenTimer = await page.evaluate(() => {
    const g = window.CCDEBUG.state(), CC = window.CC;
    /* strip the player's damage so the boss survives long enough to be timed */
    g.critters = {}; g.upgrades = {}; g.relics = {}; g.souls = 0; g.boosts = {};
    CC.game.gotoStage(5);
    g.bossActive = true; g.bossTimer = 30;
    CC.game.skillState('frost').activeEnd = Date.now() + 20000;
    for (let i = 0; i < 20; i++) CC.game.tick(0.1);
    const held = g.bossTimer;
    CC.game.skillState('frost').activeEnd = 0;
    for (let i = 0; i < 20; i++) CC.game.tick(0.1);
    return { held, thawed: g.bossTimer };
  });
  check('the boss clock does not move while frozen', frozenTimer.held === 30, frozenTimer.held);
  check('the boss clock resumes when it thaws', frozenTimer.thawed < frozenTimer.held,
        frozenTimer.held + ' -> ' + frozenTimer.thawed.toFixed(1));

  /* ---- migrating a v1 save ----
     A save made before the ledger existed has no soulStage. A player who has
     already prestiged has, by definition, been paid for everything they have
     reached; a player who never prestiged must keep their full first payout. */
  const migrated = await page.evaluate(() => {
    const CC = window.CC;
    const veteran = CC.state.parse(JSON.stringify({
      v: 1, bestStage: 900, stage: 40, prestiges: 7, souls: 5000, gold: '1|6'
    }));
    const rookie = CC.state.parse(JSON.stringify({
      v: 1, bestStage: 120, stage: 40, prestiges: 0, souls: 0, gold: '1|6'
    }));
    const capped = CC.state.parse(JSON.stringify({
      v: 1, bestStage: 50, stage: 10, prestiges: 1, soulStage: 9999, souls: 1
    }));
    return {
      vetStage: veteran.soulStage,
      vetGain: CC.data.soulsGain(veteran.bestStage, veteran.soulStage),
      rookieStage: rookie.soulStage,
      rookieGain: CC.data.soulsGain(rookie.bestStage, rookie.soulStage),
      cappedStage: capped.soulStage,
      hasLedgers: !!veteran.fusions && !!veteran.skillLv
    };
  });
  check('a veteran v1 save cannot re-claim ground it already cashed in',
        migrated.vetStage === 900 && migrated.vetGain === 0, 'gain=' + migrated.vetGain);
  check('a v1 save that never prestiged keeps its full first payout',
        migrated.rookieStage === 0 && migrated.rookieGain > 0, 'gain=' + migrated.rookieGain);
  check('a tampered soulStage is clamped to the real best stage',
        migrated.cappedStage === 50, migrated.cappedStage);
  check('old saves gain the new fusion and skill ledgers', migrated.hasLedgers);

  check('no runtime errors anywhere in the flow', errors.length === 0, errors.slice(0, 2).join(' | '));

  await browser.close(); server.close();
  const failed = results.filter(r => !r.ok);
  console.log('\n' + (results.length - failed.length) + '/' + results.length + ' new-system checks passed');
  if (failed.length) { console.log('FAILED: ' + failed.map(f => f.name).join(', ')); process.exit(1); }
})().catch(e => { console.error(e); process.exit(1); });
