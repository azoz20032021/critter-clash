/* ============================================================
   Critter Clash Idle — combat, progression & scene rendering
   ============================================================ */
(function (global) {
  'use strict';
  const CC = global.CC || (global.CC = {});
  const U = CC.util, DATA = CC.data, S = CC.state, SP = CC.sprites, D = CC.D;

  const MON_Y = 0.50;          // vertical anchor of the monster inside the scene

  const game = {
    g: null,            // save state
    d: null,            // derived stats (refreshed every frame)
    monster: null,
    scene: { w: 0, h: 0, dpr: 1, t: 0, shake: 0, camX: 0, targetCamX: 0 },
    fx: [], nums: [], coins: [], corpses: [],
    canvas: null, ctx: null, bg: null, bgZone: -1, bgW: 0, bgH: 0,
    hitPulse: 0, lastKillFlash: 0, running: false,
    allyAttack: [], onEvent: null
  };

  /* ---------------------------------------------------------
     Monster lifecycle
     --------------------------------------------------------- */
  function makeMonster(stage, index) {
    const boss = DATA.isBossStage(stage);
    const spec = SP.monsterSpec(stage, index, boss);
    let hp = DATA.monsterHP(stage);
    if (boss) hp = hp.mul(DATA.bossHPMult(stage));
    const pool = boss ? DATA.BOSS_NAMES : DATA.MONSTER_NAMES;
    const nm = pool[(stage * 7 + index * 3) % pool.length];
    return {
      spec, hp, maxHp: hp, boss, name: nm, index,
      hit: 0, dying: 0, dead: false, born: game.scene.t,
      look: { x: 0, y: 0 }
    };
  }

  function spawn(reset) {
    const g = game.g;
    const boss = DATA.isBossStage(g.stage);
    game.monster = makeMonster(g.stage, boss ? 0 : g.killsInStage);
    if (boss) {
      g.bossActive = true;
      g.bossTimer = game.d ? game.d.bossTime : DATA.BAL.bossTime;
      g.bossFailed = false;
      CC.audio.play('boss');
    } else {
      g.bossActive = false;
      g.bossTimer = 0;
      g.bossFailed = false;
    }
    if (reset) { game.fx.length = 0; game.nums.length = 0; game.corpses.length = 0; }
    emit('spawn');
  }

  function emit(type, payload) {
    if (game.onEvent) game.onEvent(type, payload);
  }

  /* ---------------------------------------------------------
     Damage & rewards
     --------------------------------------------------------- */
  function grantGold(amount) {
    const g = game.g;
    const a = D(amount);
    g.gold = g.gold.add(a);
    g.stats.totalGold = g.stats.totalGold.add(a);
  }

  function grantGems(n) {
    const g = game.g;
    n = Math.max(1, Math.round(n));
    g.gems += n;
    emit('gems', n);
  }

  const MAX_KILLS_PER_TICK = 60;

  function damage(amount, opts) {
    const m = game.monster;
    const amt = D(amount);
    if (!m || m.dead || amt.lte(0)) return;
    opts = opts || {};
    m.hp = m.hp.sub(amt);
    m.hit = Math.min(1, m.hit + (opts.tap ? 0.55 : 0.12));
    game.scene.shake = Math.min(9, game.scene.shake + (opts.crit ? 5 : opts.tap ? 2 : 0));
    if (opts.showNumber) pushNumber(amt, opts.crit, opts.x, opts.y);

    if (m.hp.lte(0)) {
      const overflow = m.hp.neg();               // damage the corpse could not absorb
      kill();
      /* Sweep: once you massively out-damage a stage, the leftover damage
         rolls straight into the next monster instead of being thrown away.
         This is what makes replaying early stages after a prestige feel fast. */
      if (overflow.gt(0) && game.monster && !game.monster.dead &&
          game._kills < MAX_KILLS_PER_TICK && overflow.gte(game.monster.hp)) {
        game._kills++;
        damage(overflow, { sweep: true });
      }
    }
  }

  function tap(x, y) {
    const g = game.g, d = game.d;
    g.stats.taps++;
    if (!game.monster || game.monster.dead) return;
    let dmg = d.tap;
    const crit = Math.random() < d.critChance;
    if (crit) { dmg = dmg.mul(d.critMult); g.stats.crits++; }
    let hits = 1;
    if (Math.random() < d.multiHit) hits = 2;
    for (let i = 0; i < hits; i++) {
      damage(dmg, { tap: true, crit, showNumber: true, x: x + U.rand(-24, 24), y: (y || 0) - i * 26 });
    }
    burst(x, y, crit ? 14 : 7, crit ? '#ffd43b' : '#ffffff');
    CC.audio.play(crit ? 'crit' : 'tap');
    if (g.haptics) CC.audio.vibrate(crit ? 22 : 8);
    game.hitPulse = 1;
  }

  function kill() {
    const g = game.g, d = game.d, m = game.monster;
    if (!m || m.dead) return;
    m.dead = true; m.dying = 0.001;

    let gold = DATA.monsterGold(g.stage).mul(d.goldMult);
    if (m.boss) gold = gold.mul(DATA.bossGoldMult(g.stage));
    grantGold(gold);
    g.stats.kills++;

    coinBurst(m.boss ? 16 : 6);
    poof(m);
    CC.audio.play(m.boss ? 'bossKill' : 'kill');
    if (g.haptics && m.boss) CC.audio.vibrate(40);
    emit('kill', { gold, boss: m.boss });

    retire(m);
    if (m.boss) {
      g.stats.bosses++;
      const chance = 0.18 + d.gemLuck;
      if (Math.random() < chance) grantGems(U.randInt(1, 3) * d.gemMult);
      g.bossActive = false;
      advance();
    } else {
      g.killsInStage++;
      if (g.killsInStage >= DATA.BAL.monstersPerStage) advance();
      else spawn();                     // instant respawn keeps tapping fluid
    }
    checkAchievements();
  }

  /** Move a dead monster onto the corpse list so the next one can appear at once. */
  function retire(m) {
    if (!m) return;
    game.corpses.push(m);
    if (game.corpses.length > 2) game.corpses.shift();
    if (game.monster === m) game.monster = null;
  }

  function advance() {
    const g = game.g;
    g.stage = g.stage + 1;
    g.killsInStage = 0;
    if (g.stage > g.bestStage) { g.bestStage = g.stage; emit('record', g.stage); }
    game.scene.targetCamX += game.scene.w;
    CC.audio.play('stage');
    emit('stage', g.stage);
    if (DATA.isBossStage(g.stage) && !g.autoAdvance) { game.monster = null; emit('bossPending'); }
    else spawn();
    checkAchievements();
  }

  function gotoStage(stage) {
    const g = game.g;
    stage = U.clamp(Math.floor(stage), 1, Math.max(1, g.bestStage));
    if (stage === g.stage && game.monster) return;
    game.scene.targetCamX += (stage > g.stage ? 1 : -1) * game.scene.w;
    g.stage = stage;
    g.killsInStage = 0;
    g.bossFailed = false;
    if (DATA.isBossStage(stage) && !g.autoAdvance) { game.monster = null; g.bossActive = false; emit('bossPending'); }
    else spawn(true);
    emit('stage', stage);
  }

  function startBoss() {
    if (!DATA.isBossStage(game.g.stage)) return;
    spawn(true);
  }

  function bossTimeout() {
    const g = game.g;
    g.bossActive = false;
    g.bossFailed = true;
    game.monster = null;
    CC.audio.play('error');
    emit('bossFailed');
  }

  /* ---------------------------------------------------------
     Skills
     --------------------------------------------------------- */
  function skillState(id) {
    const g = game.g;
    if (!g.skills[id]) g.skills[id] = { cdEnd: 0, activeEnd: 0 };
    return g.skills[id];
  }

  function skillUnlocked(id) {
    const def = S.skillDef(id);
    return game.g.bestStage >= def.unlock;
  }

  function useSkill(id) {
    const g = game.g, d = game.d, def = S.skillDef(id), t = Date.now();
    if (!def || !skillUnlocked(id)) return false;
    const st = skillState(id);
    if (st.cdEnd > t) return false;
    st.cdEnd = t + def.cd * 1000 * d.cdMult;
    if (def.dur > 0) st.activeEnd = t + def.dur * 1000;

    if (id === 'bolt') {
      const dmg = d.dps.mul(def.mult);
      damage(dmg, { crit: true, showNumber: true, x: game.scene.w / 2, y: game.scene.h * (MON_Y - 0.02) });
      lightning();
    } else if (id === 'warp') {
      const gps = goldPerSecond();
      const amount = gps.mul(def.mult);
      grantGold(amount);
      coinBurst(20);
      pushNumber(amount, false, game.scene.w / 2, game.scene.h * (MON_Y - 0.14), '#ffd43b', '+');
    }
    CC.audio.play('skill');
    emit('skill', id);
    return true;
  }

  function goldPerSecond() {
    const g = game.g, d = game.d;
    const hp = DATA.monsterHP(g.stage);
    if (hp.lte(0)) return D(0);
    return d.dps.div(hp).mul(DATA.monsterGold(g.stage)).mul(d.goldMult);
  }

  /* ---------------------------------------------------------
     Purchases
     --------------------------------------------------------- */
  function buyCount(mode, base, mult, owned, gold, cap) {
    if (mode === 'max') return D.maxAffordable(base, mult, owned, gold, cap);
    let n = mode;
    if (cap !== undefined) n = Math.min(n, cap);
    return n;
  }

  function buyCritter(id, mode) {
    const g = game.g;
    const def = DATA.critterById(id);
    if (!def || g.bestStage < def.unlock) return false;
    const owned = g.critters[id] || 0;
    const n = buyCount(mode || g.buyMode, def.baseCost, def.costMult, owned, g.gold);
    if (n <= 0) { CC.audio.play('error'); return false; }
    const cost = D.bulkCost(def.baseCost, def.costMult, owned, n);
    if (cost.gt(g.gold)) { CC.audio.play('error'); return false; }
    g.gold = g.gold.sub(cost);
    g.critters[id] = owned + n;
    CC.audio.play('buy');
    checkAchievements();
    emit('buy', { kind: 'critter', id, n });
    return true;
  }

  function buyUpgrade(id, mode) {
    const g = game.g;
    const def = DATA.UPGRADES.find(u => u.id === id);
    if (!def) return false;
    const owned = g.upgrades[id] || 0;
    if (owned >= def.max) return false;
    const n = buyCount(mode || g.buyMode, def.baseCost, def.costMult, owned, g.gold, def.max - owned);
    if (n <= 0) { CC.audio.play('error'); return false; }
    const cost = D.bulkCost(def.baseCost, def.costMult, owned, n);
    if (cost.gt(g.gold)) { CC.audio.play('error'); return false; }
    g.gold = g.gold.sub(cost);
    g.upgrades[id] = owned + n;
    CC.audio.play('buy');
    checkAchievements();
    emit('buy', { kind: 'upgrade', id, n });
    return true;
  }

  function buyRelic(id) {
    const g = game.g;
    const def = DATA.RELICS.find(r => r.id === id);
    if (!def) return false;
    const owned = g.relics[id] || 0;
    if (owned >= def.max) return false;
    const cost = Math.ceil(def.baseCost * Math.pow(def.costMult, owned));
    if (cost > g.souls) { CC.audio.play('error'); return false; }
    g.souls -= cost;
    g.relics[id] = owned + 1;
    CC.audio.play('buy');
    checkAchievements();
    emit('buy', { kind: 'relic', id, n: 1 });
    return true;
  }

  function relicCost(id) {
    const g = game.g;
    const def = DATA.RELICS.find(r => r.id === id);
    const owned = g.relics[id] || 0;
    if (owned >= def.max) return Infinity;
    return Math.ceil(def.baseCost * Math.pow(def.costMult, owned));
  }

  /* ---------------------------------------------------------
     Prestige
     --------------------------------------------------------- */
  function prestigeGain() {
    const g = game.g, d = game.d;
    return Math.floor(DATA.soulsFor(g.bestStage) * d.soulMultOnPrestige);
  }

  function doPrestige() {
    const g = game.g;
    if (g.bestStage < 10) return false;
    const gain = prestigeGain();
    g.souls += gain;
    g.prestiges++;
    g.gold = D(0);
    g.critters = {};
    g.upgrades = {};
    g.skills = {};
    g.boosts = {};
    g.killsInStage = 0;
    g.bossActive = false; g.bossFailed = false;
    const d = S.derive(g, Date.now());
    g.stage = Math.min(Math.max(1, d.startStage), Math.max(1, g.bestStage));
    game.d = d;
    spawn(true);
    CC.audio.play('prestige');
    checkAchievements();
    emit('prestige', gain);
    S.save(g, true);
    return gain;
  }

  /* ---------------------------------------------------------
     Achievements / chests / boosts
     --------------------------------------------------------- */
  function checkAchievements() {
    const g = game.g;
    for (const a of DATA.ACHIEVEMENTS) {
      if (g.achievements[a.id]) continue;
      let ok = false;
      try { ok = a.check(g); } catch (e) { ok = false; }
      if (ok) {
        g.achievements[a.id] = true;
        g.gems += a.gems;
        CC.audio.play('achieve');
        emit('achievement', a);
      }
    }
  }

  function addBoost(kind, mult, seconds) {
    const g = game.g, t = Date.now();
    const cur = g.boosts[kind];
    if (cur && cur.end > t && cur.mult === mult) cur.end += seconds * 1000;
    else g.boosts[kind] = { mult, end: t + seconds * 1000 };
    emit('boost', kind);
  }

  function rollChest() {
    const table = DATA.CHEST_TABLE;
    let total = 0;
    for (const e of table) total += e.w;
    let r = Math.random() * total;
    for (const e of table) { r -= e.w; if (r <= 0) return e; }
    return table[0];
  }

  function openChest() {
    const g = game.g, d = game.d;
    const e = rollChest();
    const res = { label: e.label, kind: e.kind };
    if (e.kind === 'gold') {
      const amount = goldPerSecond().mul(e.mult)
        .add(DATA.monsterGold(g.stage).mul(d.goldMult * 10))
        .max(50);
      grantGold(amount);
      res.amount = amount;
    } else if (e.kind === 'gems') {
      const n = Math.round(e.amount * d.gemMult);
      g.gems += n; res.amount = n;
    } else {
      addBoost(e.boost, e.mult, e.dur);
      res.mult = e.mult; res.dur = e.dur; res.boost = e.boost;
    }
    g.stats.chests++;
    CC.audio.play('chest');
    checkAchievements();
    return res;
  }

  /* ---------------------------------------------------------
     Offline earnings
     --------------------------------------------------------- */
  function offlineReport(g, d, nowMs) {
    const away = Math.max(0, (nowMs - (g.lastTick || nowMs)) / 1000);
    if (away < 60 || d.dps.isZero()) return null;
    const capped = Math.min(away, d.offlineCap);
    const hp = DATA.monsterHP(g.stage);
    const gold = DATA.monsterGold(g.stage)
      .mul((1 + S.upgEffect(g, 'greed').total / 100) * (1 + S.relicEffect(g, 'r_gold').total / 100));
    // deliberately excludes temporary boosts and skills
    const baseDps = d.rawDps.mul(1 + S.upgEffect(g, 'squad').total / 100).mul(d.soulMult);
    const earned = baseDps.div(hp).mul(gold).mul(capped * d.offlineRate);
    if (earned.lte(0)) return null;
    return { seconds: away, capped, gold: earned };
  }

  /* ---------------------------------------------------------
     Visual effects
     --------------------------------------------------------- */
  function pushNumber(v, crit, x, y, color, prefix) {
    if (game._kills > 3) return;                 // don't spam during a sweep
    if (game.g.reduceFx && game.nums.length > 8) return;
    if (game.nums.length > 40) game.nums.shift();
    game.nums.push({
      v, crit: !!crit, x: x || game.scene.w / 2, y: y || game.scene.h * MON_Y,
      vx: U.rand(-22, 22), vy: U.rand(-70, -46), life: 0, max: crit ? 1.15 : 0.9,
      color: color || (crit ? '#ffd43b' : '#ffffff'), prefix: prefix || ''
    });
  }

  function burst(x, y, n, color) {
    if (game.g.reduceFx) n = Math.ceil(n / 3);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = U.rand(60, 240);
      game.fx.push({
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 40,
        life: 0, max: U.rand(0.25, 0.55), r: U.rand(1.5, 4), color, g: 420
      });
    }
  }

  function poof(m) {
    const x = game.scene.w / 2, y = game.scene.h * MON_Y;
    if (game._kills > 3 && !m.boss) return;      // sweeping: skip the confetti
    const n = game.g.reduceFx ? 8 : (m.boss ? 46 : 20);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = U.rand(50, m.boss ? 380 : 220);
      game.fx.push({
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 60,
        life: 0, max: U.rand(0.4, 0.9), r: U.rand(2, m.boss ? 8 : 5),
        color: m.spec.pal[U.randInt(0, 2)], g: 300
      });
    }
    game.lastKillFlash = 1;
  }

  function coinBurst(n) {
    if (game._kills > 3) return;
    if (game.g.reduceFx) n = Math.ceil(n / 3);
    for (let i = 0; i < n; i++) {
      game.coins.push({
        x: game.scene.w / 2 + U.rand(-50, 50), y: game.scene.h * MON_Y,
        vx: U.rand(-140, 140), vy: U.rand(-320, -160),
        life: 0, max: U.rand(0.7, 1.1), rot: Math.random() * 6.28, spin: U.rand(-8, 8)
      });
    }
  }

  function lightning() {
    game.scene.shake = 12;
    for (let i = 0; i < 24; i++) {
      game.fx.push({
        x: game.scene.w / 2 + U.rand(-90, 90), y: game.scene.h * MON_Y + U.rand(-90, 90),
        vx: U.rand(-120, 120), vy: U.rand(-200, 60),
        life: 0, max: U.rand(0.3, 0.7), r: U.rand(2, 6), color: '#9ad8ff', g: 200
      });
    }
  }

  /* ---------------------------------------------------------
     Main tick
     --------------------------------------------------------- */
  function tick(dt) {
    const g = game.g;
    const t = Date.now();
    game.d = S.derive(g, t);
    const d = game.d;

    g.stats.playtime += dt;
    g.lastTick = t;
    game._kills = 0;

    /* auto taps from the Auto Claw relic */
    if (d.autoTaps > 0 && game.monster && !game.monster.dead) {
      game._autoAcc = (game._autoAcc || 0) + d.autoTaps * dt;
      while (game._autoAcc >= 1) {
        game._autoAcc -= 1;
        let dmg = d.tap;
        const crit = Math.random() < d.critChance;
        if (crit) { dmg = dmg.mul(d.critMult); g.stats.crits++; }
        damage(dmg, { tap: true, crit, showNumber: true, x: game.scene.w / 2 + U.rand(-60, 60), y: game.scene.h * (MON_Y - 0.02) });
      }
    }

    /* squad DPS */
    if (!d.dps.isZero() && game.monster && !game.monster.dead) {
      damage(d.dps.mul(dt), {});
      game._dpsAcc = (game._dpsAcc || 0) + dt;
      if (game._dpsAcc > 0.55) {
        game._dpsAcc = 0;
        pushNumber(d.dps.mul(0.55), false, game.scene.w / 2 + U.rand(-70, 70), game.scene.h * (MON_Y + 0.06), '#a8e6a3');
        for (let i = 0; i < game.allyAttack.length; i++) {
          if (Math.random() < 0.6) game.allyAttack[i] = 1;
        }
      }
    }

    /* boss timer */
    if (g.bossActive && game.monster && !game.monster.dead) {
      g.bossTimer -= dt;
      if (g.bossTimer <= 0) bossTimeout();
    }

    /* monster animation */
    const m = game.monster;
    if (m) {
      m.hit = Math.max(0, m.hit - dt * 3.2);
      if (m.dead) {
        m.dying += dt * 2.6;
        if (m.dying >= 1 && game.monster === m) game.monster = null;
      }
      m.look.x = U.lerp(m.look.x, Math.sin(game.scene.t * 0.7) * 0.5, dt * 3);
      m.look.y = U.lerp(m.look.y, Math.sin(game.scene.t * 0.43) * 0.3, dt * 3);
    }

    for (let i = game.corpses.length - 1; i >= 0; i--) {
      const c = game.corpses[i];
      c.dying += dt * 6;
      c.hit = Math.max(0, c.hit - dt * 3.2);
      if (c.dying >= 1) game.corpses.splice(i, 1);
    }

    /* respawn safety net (e.g. after boss retry, tab wake) */
    if (!game.monster && !g.bossFailed && game.running) {
      game._respawn = (game._respawn || 0) + dt;
      const needBossClick = DATA.isBossStage(g.stage) && !g.autoAdvance;
      if (game._respawn > 0.6 && !needBossClick) { game._respawn = 0; spawn(); }
    } else { game._respawn = 0; }

    /* particles */
    for (let i = game.fx.length - 1; i >= 0; i--) {
      const p = game.fx[i];
      p.life += dt;
      if (p.life >= p.max) { game.fx.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += p.g * dt;
    }
    for (let i = game.nums.length - 1; i >= 0; i--) {
      const n = game.nums[i];
      n.life += dt;
      if (n.life >= n.max) { game.nums.splice(i, 1); continue; }
      n.x += n.vx * dt; n.y += n.vy * dt; n.vy += 40 * dt;
    }
    for (let i = game.coins.length - 1; i >= 0; i--) {
      const c = game.coins[i];
      c.life += dt;
      if (c.life >= c.max) { game.coins.splice(i, 1); continue; }
      c.x += c.vx * dt; c.y += c.vy * dt; c.vy += 620 * dt; c.rot += c.spin * dt;
    }
    for (let i = 0; i < game.allyAttack.length; i++) {
      game.allyAttack[i] = Math.max(0, game.allyAttack[i] - dt * 3.5);
    }

    game.scene.shake = Math.max(0, game.scene.shake - dt * 26);
    game.hitPulse = Math.max(0, game.hitPulse - dt * 4);
    game.lastKillFlash = Math.max(0, game.lastKillFlash - dt * 3);
    game.scene.camX = U.lerp(game.scene.camX, game.scene.targetCamX, Math.min(1, dt * 5));
    game.scene.t += dt;
  }

  /* ---------------------------------------------------------
     Background painting (cached per zone)
     --------------------------------------------------------- */
  function paintBackground(w, h, stage) {
    const zone = DATA.zoneFor(stage);
    const zoneIdx = DATA.zoneIndex(stage) + DATA.zoneCycle(stage);
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const x = c.getContext('2d');
    const rng = U.seeded(zoneIdx * 7919 + 13);

    const sky = x.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, zone.sky[0]);
    sky.addColorStop(0.75, zone.sky[1]);
    sky.addColorStop(1, SP.shade(zone.ground, 0.06));
    x.fillStyle = sky; x.fillRect(0, 0, w, h);

    /* stars / motes in the sky band */
    x.fillStyle = 'rgba(255,255,255,0.35)';
    for (let i = 0; i < 60; i++) {
      const sx = rng() * w, sy = rng() * h * 0.5, r = rng() * 1.6;
      x.beginPath(); x.arc(sx, sy, r, 0, Math.PI * 2); x.fill();
    }

    /* distant silhouettes */
    function ridge(yBase, amp, color, step) {
      x.fillStyle = color;
      x.beginPath();
      x.moveTo(0, h);
      x.lineTo(0, yBase);
      for (let px = 0; px <= w; px += step) {
        const n = Math.sin(px * 0.008 + zoneIdx) * amp * 0.5 + Math.sin(px * 0.021 + rng() * 0.1) * amp * 0.3;
        x.lineTo(px, yBase + n);
      }
      x.lineTo(w, h); x.closePath(); x.fill();
    }
    ridge(h * 0.52, h * 0.09, SP.rgba(zone.fog, 0.45), 28);
    ridge(h * 0.60, h * 0.07, SP.rgba(zone.fog, 0.7), 22);

    /* mid props: trees / crystals / pillars depending on zone */
    const propColor = SP.shade(zone.ground, -0.2);
    for (let i = 0; i < 9; i++) {
      const px = rng() * w, ph = h * (0.09 + rng() * 0.13), py = h * 0.68;
      x.fillStyle = SP.rgba(propColor, 0.85);
      if (zoneIdx % 3 === 0) {           // trees
        x.fillRect(px - 3, py - ph * 0.4, 6, ph * 0.4);
        x.beginPath();
        x.moveTo(px - ph * 0.3, py - ph * 0.35);
        x.lineTo(px, py - ph);
        x.lineTo(px + ph * 0.3, py - ph * 0.35);
        x.closePath(); x.fill();
      } else if (zoneIdx % 3 === 1) {    // crystals
        x.beginPath();
        x.moveTo(px, py - ph);
        x.lineTo(px + ph * 0.18, py - ph * 0.35);
        x.lineTo(px, py);
        x.lineTo(px - ph * 0.18, py - ph * 0.35);
        x.closePath(); x.fill();
      } else {                            // pillars
        x.fillRect(px - ph * 0.09, py - ph, ph * 0.18, ph);
        x.fillRect(px - ph * 0.15, py - ph - 6, ph * 0.3, 8);
      }
    }

    /* ground */
    const gg = x.createLinearGradient(0, h * 0.68, 0, h);
    gg.addColorStop(0, zone.ground);
    gg.addColorStop(1, SP.shade(zone.ground, -0.45));
    x.fillStyle = gg;
    x.beginPath();
    x.moveTo(0, h * 0.7);
    for (let px = 0; px <= w; px += 24) x.lineTo(px, h * 0.7 + Math.sin(px * 0.02) * 4);
    x.lineTo(w, h); x.lineTo(0, h); x.closePath(); x.fill();

    /* ground speckles */
    for (let i = 0; i < 70; i++) {
      const sx = rng() * w, sy = h * (0.72 + rng() * 0.26);
      x.fillStyle = SP.rgba(rng() > 0.5 ? zone.accent : '#000000', 0.10 + rng() * 0.12);
      x.beginPath(); x.ellipse(sx, sy, 2 + rng() * 8, 1 + rng() * 2.5, 0, 0, Math.PI * 2); x.fill();
    }

    /* vignette */
    const vg = x.createRadialGradient(w / 2, h * 0.45, h * 0.2, w / 2, h * 0.5, h * 0.85);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.45)');
    x.fillStyle = vg; x.fillRect(0, 0, w, h);

    return c;
  }

  /* ---------------------------------------------------------
     Scene rendering
     --------------------------------------------------------- */
  function resize() {
    const cv = game.canvas;
    if (!cv) return;
    const rect = cv.getBoundingClientRect();
    const dpr = Math.min(2, global.devicePixelRatio || 1);
    const w = Math.max(200, Math.round(rect.width));
    const h = Math.max(200, Math.round(rect.height));
    cv.width = Math.round(w * dpr);
    cv.height = Math.round(h * dpr);
    game.scene.w = w; game.scene.h = h; game.scene.dpr = dpr;
    game.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    game.bg = null;
  }

  function render() {
    const ctx = game.ctx, sc = game.scene, g = game.g;
    if (!ctx) return;
    const w = sc.w, h = sc.h, t = sc.t;

    const zk = DATA.zoneKey(g.stage);
    if (!game.bg || game.bgZone !== zk || game.bgW !== w || game.bgH !== h) {
      game.bg = paintBackground(w, h, g.stage);
      game.bgZone = zk; game.bgW = w; game.bgH = h;
    }

    ctx.clearRect(0, 0, w, h);
    ctx.save();
    const sh = sc.shake;
    if (sh > 0.1) ctx.translate(U.rand(-sh, sh), U.rand(-sh, sh));

    /* parallax slide between stages */
    const slide = (sc.targetCamX - sc.camX);
    const off = -(slide % w) * 0.35;
    ctx.drawImage(game.bg, off, 0, w, h);
    if (Math.abs(off) > 0.5) {
      ctx.drawImage(game.bg, off + (off > 0 ? -w : w), 0, w, h);
    }

    /* floating motes */
    if (!g.reduceFx) {
      const zone = DATA.zoneFor(g.stage);
      ctx.fillStyle = SP.rgba(zone.accent, 0.22);
      for (let i = 0; i < 14; i++) {
        const px = ((i * 137 + t * (12 + i % 5)) % (w + 60)) - 30;
        const py = h * 0.28 + Math.sin(t * 0.6 + i) * 30 + (i % 6) * 22;
        ctx.beginPath(); ctx.arc(px, py, 1.5 + (i % 3), 0, Math.PI * 2); ctx.fill();
      }
    }

    /* kill flash */
    if (game.lastKillFlash > 0.02) {
      ctx.fillStyle = 'rgba(255,255,255,' + (game.lastKillFlash * 0.12) + ')';
      ctx.fillRect(0, 0, w, h);
    }

    /* fading corpses */
    for (const c of game.corpses) {
      const csize = Math.min(w, h) * (c.boss ? 0.27 : 0.21) * c.spec.scale;
      ctx.save();
      ctx.globalAlpha = 0.7;
      SP.drawCreature(ctx, c.spec, w / 2, h * MON_Y + c.dying * 30, csize * (1 - c.dying * 0.2), t, {
        hit: c.hit, look: c.look, dying: c.dying
      });
      ctx.restore();
    }

    /* the monster */
    const m = game.monster;
    if (m) {
      const size = Math.min(w, h) * (m.boss ? 0.27 : 0.21) * m.spec.scale;
      const bob = Math.sin(t * 1.5) * 4;
      const spawnT = Math.min(1, (t - m.born) * 3);
      const pop = U.easeOut(spawnT);
      ctx.save();
      ctx.translate(0, (1 - pop) * -60);
      ctx.globalAlpha = pop;
      SP.drawCreature(ctx, m.spec, w / 2, h * MON_Y + bob, size * (0.6 + pop * 0.4), t, {
        hit: m.hit, look: m.look, dying: m.dying
      });
      ctx.restore();
    }

    /* the squad */
    drawAllies(ctx, w, h, t);

    /* particles */
    for (const p of game.fx) {
      const a = 1 - p.life / p.max;
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r * a, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;

    /* coins */
    for (const c of game.coins) {
      const a = 1 - Math.max(0, (c.life - c.max * 0.6) / (c.max * 0.4));
      ctx.save();
      ctx.globalAlpha = a;
      ctx.translate(c.x, c.y); ctx.rotate(c.rot);
      ctx.fillStyle = '#ffd43b';
      ctx.beginPath(); ctx.ellipse(0, 0, 7, 7 * Math.abs(Math.cos(c.rot)), 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#b8860b';
      ctx.beginPath(); ctx.ellipse(0, 0, 3.4, 3.4 * Math.abs(Math.cos(c.rot)), 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    ctx.globalAlpha = 1;

    /* damage numbers */
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const n of game.nums) {
      const p = n.life / n.max;
      const a = 1 - p * p;
      const scale = n.crit ? 1.25 + (1 - a) * 0.3 : 1;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.translate(n.x, n.y);
      ctx.scale(scale, scale);
      ctx.font = (n.crit ? '900 ' : '800 ') + (n.crit ? 22 : 17) + 'px "Baloo 2", system-ui, sans-serif';
      ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,0.55)';
      const label = n.prefix + U.fmt(n.v);
      ctx.strokeText(label, 0, 0);
      ctx.fillStyle = n.color;
      ctx.fillText(label, 0, 0);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function drawAllies(ctx, w, h, t) {
    const g = game.g;
    const owned = Object.keys(g.critters)
      .filter(id => (g.critters[id] || 0) > 0)
      .map(id => DATA.critterById(id))
      .filter(Boolean)
      .sort((a, b) => a.tier - b.tier)
      .slice(-5);
    if (!owned.length) return;
    while (game.allyAttack.length < owned.length) game.allyAttack.push(0);
    const y = h * 0.78;
    const size = Math.min(w, h) * 0.055;
    owned.forEach((def, i) => {
      const spec = CC.mut ? CC.mut.spriteSpec(def, g.mutations[def.id]) : SP.critterSpec(def);
      const baseX = w * 0.13 + i * size * 1.5;
      const lunge = game.allyAttack[i] || 0;
      const x = baseX + U.easeOut(lunge) * size * 0.7;
      ctx.save();
      ctx.globalAlpha = 0.96;
      SP.drawCreature(ctx, spec, x, y - Math.sin(t * 3 + i) * 3, size, t + i, {
        hit: lunge * 0.4, look: { x: 0.6, y: 0 }, punch: lunge > 0.4
      });
      ctx.restore();
    });
  }

  /* ---------------------------------------------------------
     Boot
     --------------------------------------------------------- */
  function attach(canvas, g) {
    game.canvas = canvas;
    game.ctx = canvas.getContext('2d');
    game.g = g;
    game.d = S.derive(g, Date.now());
    resize();
    global.addEventListener('resize', resize);
  }

  CC.game = Object.assign(game, {
    attach, resize, render, tick, spawn, tap, damage, advance, gotoStage, startBoss,
    useSkill, skillUnlocked, skillState, buyCritter, buyUpgrade, buyRelic, relicCost,
    prestigeGain, doPrestige, checkAchievements, addBoost, openChest, offlineReport,
    goldPerSecond, grantGold, grantGems, pushNumber, coinBurst, makeMonster
  });
})(window);
