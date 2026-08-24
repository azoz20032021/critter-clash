/* ============================================================
   Critter Clash Idle — save state, derived stats, persistence
   ============================================================ */
(function (global) {
  'use strict';
  const CC = global.CC || (global.CC = {});
  const DATA = CC.data, U = CC.util, D = CC.D;
  const MUT = () => CC.mut;

  const SAVE_KEY = 'critterclash.save.v1';
  const SAVE_VERSION = 1;

  function freshState() {
    return {
      v: SAVE_VERSION,
      lang: /^en/i.test(navigator.language || '') ? 'en' : 'ar',   // Arabic-first, English for en-* devices
      sound: true, music: true, haptics: true, reduceFx: false,

      gold: D(0), gems: 0, souls: 0,
      stage: 1, killsInStage: 0, bestStage: 1,
      bossActive: false, bossTimer: 0, bossFailed: false,
      autoAdvance: true,

      critters: {}, upgrades: {}, relics: {}, achievements: {},
      mutations: {},           // critterId -> { rarity, trait, element, shape, hue, seed }
      mutRolls: {},            // critterId -> how many times it has been re-rolled
      arena: { trophies: 0, wins: 0, losses: 0, lastOpponents: [], nextFree: 0 },
      online: { uid: null, friendCode: '', friends: {}, attackLog: [], lastSync: 0 },
      skills: {},              // id -> { cdEnd, activeEnd }
      boosts: {},              // 'gold' | 'dmg' -> { mult, end }

      prestiges: 0,
      buyMode: 1,              // 1 | 10 | 100 | 'max'

      stats: { taps: 0, kills: 0, bosses: 0, crits: 0, totalGold: D(0), playtime: 0, ads: 0, chests: 0 },

      nextFreeChest: 0,
      tutorialSeen: false,
      lastSave: Date.now(),
      lastTick: Date.now(),
      createdAt: Date.now()
    };
  }

  /* --------------------------------------------------------
     Derived stats
     -------------------------------------------------------- */
  function lvl(map, id) { return map[id] || 0; }

  function relicEffect(g, id) {
    const r = DATA.RELICS.find(x => x.id === id);
    const n = lvl(g.relics, id);
    return { n, total: n * r.effect, def: r };
  }

  function upgEffect(g, id) {
    const u = DATA.UPGRADES.find(x => x.id === id);
    const n = lvl(g.upgrades, id);
    return { n, total: n * u.effect, def: u };
  }

  function boostMult(g, kind, t) {
    const b = g.boosts[kind];
    if (!b || b.end <= t) return 1;
    return b.mult;
  }

  function skillActive(g, id, t) {
    const s = g.skills[id];
    return !!(s && s.activeEnd && s.activeEnd > t);
  }

  function skillDef(id) { return DATA.SKILLS.find(s => s.id === id); }

  /** Everything the combat loop needs, recomputed each frame (cheap). */
  function derive(g, t) {
    t = t || Date.now();

    const soulMult = DATA.soulMultiplier(g.souls);            // big
    const relicDmg = 1 + relicEffect(g, 'r_dmg').total / 100;
    const relicTap = 1 + relicEffect(g, 'r_tap').total / 100;
    const relicGold = 1 + relicEffect(g, 'r_gold').total / 100;
    const relicGem = 1 + relicEffect(g, 'r_gem').total / 100;

    const dmgBoost = boostMult(g, 'dmg', t);
    const goldBoost = boostMult(g, 'gold', t);

    const furyMult = skillActive(g, 'fury', t) ? skillDef('fury').mult : 1;
    const rallyMult = skillActive(g, 'rally', t) ? skillDef('rally').mult : 1;
    const rushMult = skillActive(g, 'goldrush', t) ? skillDef('goldrush').mult : 1;

    /* ---- critter DPS ---- */
    let rawDps = D(0);
    for (const id in g.critters) {
      const n = g.critters[id] | 0;
      if (n <= 0) continue;
      const def = DATA.critterById(id);
      if (!def) continue;
      const mult = CC.mut ? CC.mut.dpsMult(g.mutations && g.mutations[id]) : 1;
      rawDps = rawDps.add(D(def.baseDps).mul(n * DATA.critterMilestoneMult(n) * mult));
    }
    const mg = CC.mut ? CC.mut.globals(g) : { goldPct: 0, critPct: 0 };
    const squadPct = 1 + upgEffect(g, 'squad').total / 100;
    const dps = rawDps.mul(squadPct * relicDmg * dmgBoost * rallyMult).mul(soulMult);

    /* ---- tap damage ---- */
    const flat = DATA.BAL.baseTapDamage + upgEffect(g, 'claw').total;
    const tapPct = 1 + upgEffect(g, 'power').total / 100;
    const echoPct = upgEffect(g, 'tapdps').total / 100;
    const tap = D(flat * tapPct * relicTap * relicDmg * dmgBoost * furyMult)
      .mul(soulMult)
      .add(dps.mul(echoPct));

    /* ---- crits & extras ---- */
    const critChance = Math.min(0.75, DATA.BAL.critChance + (upgEffect(g, 'crit').total + mg.critPct) / 100);
    const critMult = DATA.BAL.critMult + upgEffect(g, 'critdmg').total;
    const multiHit = Math.min(0.9, upgEffect(g, 'multi').total / 100);

    /* ---- gold ---- */
    const goldMult = (1 + (upgEffect(g, 'greed').total + mg.goldPct) / 100) * relicGold * goldBoost * rushMult;

    /* ---- misc ---- */
    const bossTime = DATA.BAL.bossTime + upgEffect(g, 'bosstime').total + relicEffect(g, 'r_boss').total;
    const autoTaps = relicEffect(g, 'r_auto').total;
    const cdMult = Math.max(0.4, 1 - relicEffect(g, 'r_cd').total / 100);
    const offlineRate = DATA.BAL.offlineRate * (1 + relicEffect(g, 'r_off').total / 100);
    const offlineCap = (DATA.BAL.offlineCapHours + relicEffect(g, 'r_off').n) * 3600;
    const gemLuck = upgEffect(g, 'gemluck').total / 100;
    const gemMult = relicGem;
    const soulMultOnPrestige = 1 + relicEffect(g, 'r_soul').total / 100;
    // Ancient Map skips you past ground you have already cleared, which is what
    // keeps a stage-15000 save replayable instead of a 40-minute walk back.
    const startPct = Math.min(60, relicEffect(g, 'r_start').total) / 100;
    const startStage = Math.max(1, Math.floor((g.bestStage || 1) * startPct));

    return {
      dps, rawDps, tap, critChance, critMult, multiHit, goldMult,
      bossTime, autoTaps, cdMult, offlineRate, offlineCap,
      gemLuck, gemMult, soulMult, soulMultOnPrestige, startStage,
      dmgBoost, goldBoost, furyMult, rallyMult, rushMult
    };
  }

  /* --------------------------------------------------------
     Persistence
     -------------------------------------------------------- */
  function serialize(g) {
    const copy = JSON.parse(JSON.stringify(g));
    copy.lastSave = Date.now();
    return JSON.stringify(copy);
  }

  function save(g, silent) {
    if (CC.state && CC.state.__noSave) return false;   // test hook
    try {
      const json = serialize(g);
      localStorage.setItem(SAVE_KEY, json);
      // mirror into native storage when running inside Capacitor
      const Pref = global.Capacitor && global.Capacitor.Plugins && global.Capacitor.Plugins.Preferences;
      if (Pref) { try { Pref.set({ key: SAVE_KEY, value: json }); } catch (e) { /* ignore */ } }
      g.lastSave = Date.now();
      if (!silent && CC.ui && CC.ui.toast) CC.ui.toast(CC.i18n.t('saved'));
      return true;
    } catch (e) {
      console.warn('save failed', e);
      return false;
    }
  }

  function parse(json) {
    const raw = JSON.parse(json);
    const g = freshState();
    U.deepMerge(g, raw);
    // sanity clamps + big-number rehydration (old numeric saves load fine)
    g.stage = Math.max(1, Math.floor(g.stage) || 1);
    g.bestStage = Math.max(1, Math.floor(g.bestStage) || 1);
    g.gold = D(g.gold);
    if (g.gold.lt(0)) g.gold = D(0);
    g.stats.totalGold = D(g.stats.totalGold);
    g.gems = Math.max(0, Math.floor(+g.gems || 0));
    g.souls = Math.max(0, Math.floor(+g.souls || 0));
    g.killsInStage = U.clamp(Math.floor(g.killsInStage) || 0, 0, DATA.BAL.monstersPerStage);
    if (!g.mutations) g.mutations = {};
    if (!g.mutRolls) g.mutRolls = {};
    if (!g.playerName) g.playerName = '';
    if (!g.arena) g.arena = { trophies: 0, wins: 0, losses: 0, lastOpponents: [], nextFree: 0 };
    if (!g.online) g.online = { uid: null, friendCode: '', friends: {}, attackLog: [], lastSync: 0 };
    if (!g.online.friends) g.online.friends = {};
    if (!g.online.attackLog) g.online.attackLog = [];
    return g;
  }

  async function load() {
    let json = null;
    try { json = localStorage.getItem(SAVE_KEY); } catch (e) { /* ignore */ }
    if (!json) {
      const Pref = global.Capacitor && global.Capacitor.Plugins && global.Capacitor.Plugins.Preferences;
      if (Pref) {
        try { const r = await Pref.get({ key: SAVE_KEY }); json = r && r.value; } catch (e) { /* ignore */ }
      }
    }
    if (!json) return freshState();
    try { return parse(json); }
    catch (e) { console.warn('corrupt save, starting fresh', e); return freshState(); }
  }

  function exportSave(g) {
    return btoa(unescape(encodeURIComponent(serialize(g))));
  }
  function importSave(code) {
    const json = decodeURIComponent(escape(atob(code.trim())));
    return parse(json);
  }
  function wipe() {
    try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ }
    const Pref = global.Capacitor && global.Capacitor.Plugins && global.Capacitor.Plugins.Preferences;
    if (Pref) { try { Pref.remove({ key: SAVE_KEY }); } catch (e) { /* ignore */ } }
  }

  CC.state = {
    SAVE_KEY, freshState, derive, save, load, exportSave, importSave, wipe,
    relicEffect, upgEffect, boostMult, skillActive, skillDef, lvl, parse
  };
})(window);
