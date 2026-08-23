/* ============================================================
   Critter Clash Idle — static game data & balance tables
   ============================================================ */
(function (global) {
  'use strict';
  const CC = global.CC || (global.CC = {});
  const D = CC.D;

  /* ---------------- progression curves ---------------- */
  const BAL = {
    monstersPerStage: 10,
    bossEvery: 5,
    bossTime: 30,               // seconds to kill a boss
    baseTapDamage: 5,
    critChance: 0.05,
    critMult: 8,
    offlineRate: 0.5,           // fraction of DPS earned while away
    offlineCapHours: 8,
    soulsPerStage: 10,          // souls = 10 × (bestStage − 9)^1.05
    soulExp: 1.05,
    soulPower: 1.06,            // each soul multiplies ALL damage by this
    maxStage: Infinity          // truly endless
  };

  const LOG_HP = Math.log10(1.57);
  const LOG_HP2 = Math.log10(1.055);
  const LOG_GOLD = Math.log10(1.49);

  /** HP of a normal monster on a stage — unbounded. */
  function monsterHP(stage) {
    const s = Math.max(1, stage);
    let exp = 1 + LOG_HP * (s - 1);
    if (s > 60) exp += LOG_HP2 * (s - 60);      // steepening -> the prestige wall
    return D.pow10(exp);
  }

  /** Gold dropped by a normal monster on a stage — unbounded. */
  function monsterGold(stage) {
    const s = Math.max(1, stage);
    return D.pow10(Math.log10(4) + LOG_GOLD * (s - 1)).mul(1 + s * 0.02);
  }

  function isBossStage(stage) { return stage % BAL.bossEvery === 0; }

  function bossHPMult(stage) { return stage % 25 === 0 ? 12 : 5; }
  function bossGoldMult(stage) { return stage % 25 === 0 ? 20 : 9; }

  /**
   * Souls awarded for prestiging.
   * Linear-ish in stage, which — combined with a multiplicative per-soul
   * damage bonus — makes every prestige reach roughly 2.5× deeper than the
   * last, forever. That is what keeps an endless game actually endless.
   */
  function soulsFor(bestStage) {
    if (bestStage < 10) return 0;
    return Math.floor(BAL.soulsPerStage * Math.pow(bestStage - 9, BAL.soulExp));
  }

  /** Total damage multiplier granted by owning `souls` souls. */
  function soulMultiplier(souls) {
    if (!souls || souls <= 0) return D(1);
    return D(BAL.soulPower).pow(souls);
  }

  /* ---------------- zones (visual themes) ---------------- */
  const ZONES = [
    { name: { ar: 'غابة الفطر', en: 'Mushroom Woods' },  sky: ['#1c2a4a', '#3d5a80'], ground: '#25402f', accent: '#7bd389', fog: '#4a7c59' },
    { name: { ar: 'كهوف البلور', en: 'Crystal Caves' },  sky: ['#1a1330', '#432e6b'], ground: '#2a1f45', accent: '#9d7bff', fog: '#6b4fa8' },
    { name: { ar: 'رمال الجحيم', en: 'Ember Sands' },    sky: ['#3a1408', '#8c3a12'], ground: '#4a2410', accent: '#ffab5e', fog: '#b35a1f' },
    { name: { ar: 'قمم الصقيع', en: 'Frost Peaks' },     sky: ['#0f2740', '#5b8bb5'], ground: '#2b4a63', accent: '#9fe3ff', fog: '#6ea8c9' },
    { name: { ar: 'مستنقع السموم', en: 'Toxic Marsh' },  sky: ['#14260f', '#4f7a23'], ground: '#23361a', accent: '#c6ff5e', fog: '#6d9c33' },
    { name: { ar: 'مدينة الأشباح', en: 'Ghost City' },   sky: ['#101018', '#2e2e44'], ground: '#1b1b28', accent: '#c9c9ff', fog: '#4a4a68' },
    { name: { ar: 'شاطئ المرجان', en: 'Coral Shore' },   sky: ['#062a3a', '#1a7f9e'], ground: '#0e4356', accent: '#5ef0d4', fog: '#2596ad' },
    { name: { ar: 'ورشة الأتوماتون', en: 'Automaton Works' }, sky: ['#241a12', '#6b5233'], ground: '#332619', accent: '#ffd166', fog: '#8a6b3d' },
    { name: { ar: 'حديقة السماء', en: 'Sky Garden' },    sky: ['#2a1240', '#a34fb0'], ground: '#3d1c52', accent: '#ffb3f2', fog: '#8b3fa0' },
    { name: { ar: 'العدم', en: 'The Void' },             sky: ['#05040a', '#1d1040'], ground: '#0d0a1a', accent: '#ff5ec4', fog: '#3a1a60' }
  ];

  /* ---- endless zone variety ----
     Ten authored zones cycle every 50 stages; each new lap rotates the hue and
     deepens the palette, so stage 5000 never looks like stage 5.            */

  function hexToHsl(hex) {
    hex = hex.replace('#', '');
    if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    const n = parseInt(hex, 16);
    const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    let h = 0;
    if (d !== 0) {
      if (mx === r) h = 60 * (((g - b) / d) % 6);
      else if (mx === g) h = 60 * ((b - r) / d + 2);
      else h = 60 * ((r - g) / d + 4);
    }
    const l = (mx + mn) / 2;
    const sat = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
    return [(h + 360) % 360, sat, l];
  }

  function hslToHex(h, s2, l) {
    h = ((h % 360) + 360) % 360;
    s2 = Math.max(0, Math.min(1, s2));
    l = Math.max(0, Math.min(1, l));
    const c = (1 - Math.abs(2 * l - 1)) * s2;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;
    let r = 0, g = 0, b = 0;
    if (h < 60) { r = c; g = x; }
    else if (h < 120) { r = x; g = c; }
    else if (h < 180) { g = c; b = x; }
    else if (h < 240) { g = x; b = c; }
    else if (h < 300) { r = x; b = c; }
    else { r = c; b = x; }
    const q = v => ('0' + Math.round((v + m) * 255).toString(16)).slice(-2);
    return '#' + q(r) + q(g) + q(b);
  }

  function shiftHex(hex, deg, satMul, lightMul) {
    const [h, s2, l] = hexToHsl(hex);
    return hslToHex(h + deg, s2 * satMul, l * lightMul);
  }

  const zoneCache = {};

  function zoneCycle(stage) { return Math.floor((stage - 1) / (ZONES.length * 5)); }
  function zoneIndex(stage) { return Math.floor((stage - 1) / 5) % ZONES.length; }
  /** Unique cache key per visual variant. */
  function zoneKey(stage) { return zoneIndex(stage) + '_' + Math.min(60, zoneCycle(stage)); }

  function zoneFor(stage) {
    const zi = zoneIndex(stage);
    const cyc = Math.min(60, zoneCycle(stage));
    const key = zi + '_' + cyc;
    if (zoneCache[key]) return zoneCache[key];
    const base = ZONES[zi];
    if (cyc === 0) { zoneCache[key] = base; return base; }
    const deg = cyc * 47;
    const sat = 1 + Math.min(0.35, cyc * 0.05);
    const lit = Math.max(0.55, 1 - cyc * 0.045);
    const romanish = cyc + 1;
    const variant = {
      name: { ar: base.name.ar + ' ' + romanish, en: base.name.en + ' ' + romanish },
      sky: [shiftHex(base.sky[0], deg, sat, lit), shiftHex(base.sky[1], deg, sat, lit)],
      ground: shiftHex(base.ground, deg, sat, lit),
      accent: shiftHex(base.accent, deg, sat, Math.min(1.15, lit + 0.15)),
      fog: shiftHex(base.fog, deg, sat, lit),
      cycle: cyc
    };
    zoneCache[key] = variant;
    return variant;
  }

  /* ---------------- monster name pools ---------------- */
  const MONSTER_NAMES = [
    { ar: 'سليم', en: 'Slime' }, { ar: 'خنفساء', en: 'Beetle' }, { ar: 'قزم', en: 'Imp' },
    { ar: 'فطر حي', en: 'Shroomling' }, { ar: 'وطواط', en: 'Batling' }, { ar: 'شبح', en: 'Wisp' },
    { ar: 'غول صغير', en: 'Gremlin' }, { ar: 'حجري', en: 'Rockling' }, { ar: 'ذئب ظل', en: 'Shadewolf' },
    { ar: 'عقرب', en: 'Scorpling' }, { ar: 'ضفدع سام', en: 'Toxifrog' }, { ar: 'جليدي', en: 'Frostkin' },
    { ar: 'دودة رمل', en: 'Sandworm' }, { ar: 'تنين صغير', en: 'Draklet' }, { ar: 'آلي', en: 'Cogling' }
  ];
  const BOSS_NAMES = [
    { ar: 'ملك الفطر', en: 'Shroom King' }, { ar: 'حارس البلور', en: 'Crystal Warden' },
    { ar: 'سيد الجمر', en: 'Ember Lord' }, { ar: 'عملاق الصقيع', en: 'Frost Giant' },
    { ar: 'أم السموم', en: 'Toxic Mother' }, { ar: 'العمدة الشبح', en: 'Ghost Mayor' },
    { ar: 'وحش الأعماق', en: 'Deep Horror' }, { ar: 'المحرك الأعظم', en: 'Grand Engine' },
    { ar: 'حورية السماء', en: 'Sky Seraph' }, { ar: 'آكل العوالم', en: 'World Eater' }
  ];

  /* ---------------- critters (DPS units) ---------------- */
  /* cost = baseCost * costMult^level ; dps = baseDps * level * milestones */
  const CRITTERS = [
    { id: 'sparky',  name: { ar: 'شرارة',   en: 'Sparky' },   desc: { ar: 'قنفذ كهربائي سريع.', en: 'A fast electric hedgehog.' },
      baseCost: 10,        costMult: 1.086, baseDps: 1,        unlock: 1,   pal: ['#ffe066', '#ffb703', '#5a3e00'], shape: 'round' },
    { id: 'mossy',   name: { ar: 'طُحلب',    en: 'Mossy' },    desc: { ar: 'حارس الغابة الصبور.', en: 'Patient forest guardian.' },
      baseCost: 120,       costMult: 1.087, baseDps: 8,       unlock: 3,   pal: ['#8ce99a', '#2f9e44', '#12401f'], shape: 'blob' },
    { id: 'pyra',    name: { ar: 'لهيبة',   en: 'Pyra' },     desc: { ar: 'تنينة صغيرة نافثة للنار.', en: 'Tiny fire-breathing dragon.' },
      baseCost: 1600,      costMult: 1.088, baseDps: 55,      unlock: 6,   pal: ['#ff8787', '#e03131', '#5c1010'], shape: 'dragon' },
    { id: 'glacio',  name: { ar: 'جليدة',   en: 'Glacio' },   desc: { ar: 'دبٌ جليدي يجمّد الأعداء.', en: 'Ice bear that freezes foes.' },
      baseCost: 22000,     costMult: 1.089, baseDps: 380,     unlock: 10,  pal: ['#a5d8ff', '#1c7ed6', '#0b3a63'], shape: 'bear' },
    { id: 'venn',    name: { ar: 'سُمّة',    en: 'Venn' },     desc: { ar: 'أفعى سامة خفية.', en: 'Stealthy venom serpent.' },
      baseCost: 300000,    costMult: 1.09, baseDps: 2600,    unlock: 15,  pal: ['#d8f5a2', '#66a80f', '#2b3d05'], shape: 'snake' },
    { id: 'phantom', name: { ar: 'طيف',     en: 'Phantom' },  desc: { ar: 'روح تمر عبر الدروع.', en: 'Spirit that pierces armour.' },
      baseCost: 4.2e6,     costMult: 1.091, baseDps: 18000,   unlock: 21,  pal: ['#e5dbff', '#7048e8', '#2b1a55'], shape: 'ghost' },
    { id: 'reefus',  name: { ar: 'مرجان',   en: 'Reefus' },   desc: { ar: 'أخطبوط بثمانية أذرع ضاربة.', en: 'Octopus with eight striking arms.' },
      baseCost: 6.5e7,     costMult: 1.092, baseDps: 130000,  unlock: 28,  pal: ['#99e9f2', '#0c8599', '#053742'], shape: 'octo' },
    { id: 'cogsworth', name: { ar: 'تِرس',  en: 'Cogsworth' },desc: { ar: 'آلي لا يتعب أبداً.', en: 'Automaton that never tires.' },
      baseCost: 1.1e9,     costMult: 1.093, baseDps: 980000,  unlock: 36,  pal: ['#ffe8a3', '#d9a441', '#4a3410'], shape: 'robot' },
    { id: 'seraphin',name: { ar: 'سرافين',  en: 'Seraphin' }, desc: { ar: 'مخلوق سماوي مجنّح.', en: 'Winged celestial being.' },
      baseCost: 2.4e10,    costMult: 1.094, baseDps: 7.8e6,   unlock: 45,  pal: ['#ffd6f5', '#e64980', '#5c1236'], shape: 'angel' },
    { id: 'voidmaw', name: { ar: 'فك العدم', en: 'Voidmaw' }, desc: { ar: 'يلتهم كل ما يلمسه.', en: 'Devours everything it touches.' },
      baseCost: 6.0e11,    costMult: 1.095, baseDps: 62e6,    unlock: 55,  pal: ['#ff8ada', '#9c1f7a', '#2a0322'], shape: 'maw' },
    { id: 'titanix', name: { ar: 'تيتانِكس', en: 'Titanix' },  desc: { ar: 'عملاق قديم من الصخر الحي.', en: 'Ancient living-stone titan.' },
      baseCost: 1.8e13,    costMult: 1.096, baseDps: 5.4e8,   unlock: 68,  pal: ['#ced4da', '#868e96', '#2b3035'], shape: 'golem' },
    { id: 'astra',   name: { ar: 'أسترا',   en: 'Astra' },    desc: { ar: 'نجمة حية تحرق المجرات.', en: 'A living star that burns galaxies.' },
      baseCost: 7.5e14,    costMult: 1.097, baseDps: 5.1e9,   unlock: 82,  pal: ['#fff3bf', '#fab005', '#7a4a00'], shape: 'star' }
  ];

  /* ---------------- endless critter tiers ----------------
     The 12 above are hand-authored. Every tier past them is generated:
     the sprite engine already draws infinitely many distinct creatures,
     so the roster can grow with the stage count forever.            */

  const GEN_CREATURE = {
    ar: ['زاحف', 'نابض', 'ماحق', 'هادر', 'ناهش', 'طائف', 'ساحق', 'ملتهم', 'حارس', 'صائد'],
    en: ['Crawler', 'Render', 'Reaper', 'Howler', 'Gnasher', 'Drifter', 'Crusher', 'Devourer', 'Warden', 'Stalker']
  };
  const GEN_ELEMENT = {
    ar: ['الرماد', 'البلور', 'الصدأ', 'اللهب', 'الصقيع', 'الظل', 'النجم', 'العدم', 'الرعد', 'الحمم'],
    en: ['Ash', 'Crystal', 'Rust', 'Flame', 'Frost', 'Shade', 'Star', 'Void', 'Storm', 'Magma']
  };
  const GEN_SHAPES = ['golem', 'dragon', 'ghost', 'octo', 'robot', 'maw', 'snake', 'bear', 'star', 'blob'];

  const BASE_TIERS = CRITTERS.length;              // 12
  const GEN_UNLOCK_STEP = 15;
  const GEN_COST_STEP = 20;
  const GEN_DPS_STEP = 16;
  const genCache = {};

  function generatedCritter(tier) {
    if (genCache[tier]) return genCache[tier];
    const n = tier - (BASE_TIERS - 1);             // 1, 2, 3 …
    const last = CRITTERS[BASE_TIERS - 1];
    const ci = tier % 10;
    const ei = (tier * 7 + 3) % 10;
    const cycle = Math.floor(tier / 100);
    const suffix = cycle > 0 ? ' ' + (cycle + 1) : '';
    const hue = (tier * 47) % 360;
    const def = {
      id: 'gen' + tier,
      tier,
      generated: true,
      name: {
        ar: GEN_CREATURE.ar[ci] + ' ' + GEN_ELEMENT.ar[ei] + suffix,
        en: GEN_ELEMENT.en[ei] + GEN_CREATURE.en[ci].toLowerCase() + suffix
      },
      desc: {
        ar: 'مخلوق من أعماق المرحلة ' + (82 + n * GEN_UNLOCK_STEP) + '.',
        en: 'A horror born past stage ' + (82 + n * GEN_UNLOCK_STEP) + '.'
      },
      baseCost: D(last.baseCost).mul(D(GEN_COST_STEP).pow(n)),
      baseDps: D(last.baseDps).mul(D(GEN_DPS_STEP).pow(n)),
      costMult: Math.min(1.12, 1.097 + n * 0.001),
      unlock: 82 + n * GEN_UNLOCK_STEP,
      pal: [
        'hsl(' + hue + ',72%,68%)',
        'hsl(' + hue + ',64%,50%)',
        'hsl(' + ((hue + 12) % 360) + ',70%,22%)'
      ],
      shape: GEN_SHAPES[tier % GEN_SHAPES.length]
    };
    genCache[tier] = def;
    return def;
  }

  /* the hand-authored tiers get big-number fields too, once */
  CRITTERS.forEach((c, i) => { c.tier = i; c.baseCost = D(c.baseCost); c.baseDps = D(c.baseDps); });

  /** Any tier, hand-authored or generated. */
  function getCritter(tier) {
    if (tier < 0) return null;
    return tier < BASE_TIERS ? CRITTERS[tier] : generatedCritter(tier);
  }

  function critterById(id) {
    if (!id) return null;
    for (let i = 0; i < BASE_TIERS; i++) if (CRITTERS[i].id === id) return CRITTERS[i];
    const m = /^gen(\d+)$/.exec(id);
    return m ? generatedCritter(parseInt(m[1], 10)) : null;
  }

  /** Highest tier index a player at `bestStage` has unlocked (−1 if none). */
  function highestUnlockedTier(bestStage) {
    if (bestStage < 82) {
      let t = -1;
      for (let i = 0; i < BASE_TIERS; i++) if (bestStage >= CRITTERS[i].unlock) t = i;
      return t;
    }
    return (BASE_TIERS - 1) + Math.floor((bestStage - 82) / GEN_UNLOCK_STEP);
  }

  /** Tiers to show in the roster: everything unlocked plus the next two teasers. */
  function critterList(bestStage, ownedMap) {
    const top = highestUnlockedTier(bestStage);
    let last = top + 2;
    if (ownedMap) {                              // never hide something already owned
      for (const id in ownedMap) {
        const def = critterById(id);
        if (def && (ownedMap[id] || 0) > 0) last = Math.max(last, def.tier);
      }
    }
    const out = [];
    for (let i = 0; i <= Math.max(last, 2); i++) out.push(getCritter(i));
    return out;
  }

  /* milestone levels: each doubles that critter's DPS */
  const MILESTONES = [10, 25, 50, 100, 200, 400, 800, 1600, 3000, 5000];

  function critterMilestoneMult(level) {
    let m = 1;
    for (let i = 0; i < MILESTONES.length; i++) if (level >= MILESTONES[i]) m *= 2;
    return m;
  }
  function nextMilestone(level) {
    for (let i = 0; i < MILESTONES.length; i++) if (level < MILESTONES[i]) return MILESTONES[i];
    return null;
  }

  /* ---------------- hero upgrades (gold) ---------------- */
  const UPGRADES = [
    { id: 'claw',     name: { ar: 'مخالب حادة', en: 'Sharp Claws' },
      desc: { ar: '+{v} ضرر لكل نقرة', en: '+{v} tap damage' },
      icon: '✊', baseCost: 25,  costMult: 1.11, effect: 4,   type: 'tapFlat', max: 500 },
    { id: 'power',    name: { ar: 'قوة الوحش', en: 'Beast Power' },
      desc: { ar: '+{v}% ضرر النقر', en: '+{v}% tap damage' },
      icon: '💥', baseCost: 400, costMult: 1.14, effect: 12,  type: 'tapPct', max: 300 },
    { id: 'crit',     name: { ar: 'عين النمر', en: 'Tiger Eye' },
      desc: { ar: '+{v}% فرصة ضربة حرجة', en: '+{v}% critical chance' },
      icon: '🎯', baseCost: 900, costMult: 1.20, effect: 1,   type: 'critChance', max: 45 },
    { id: 'critdmg',  name: { ar: 'ضربة قاتلة', en: 'Lethal Strike' },
      desc: { ar: '+{v}× ضرر الضربة الحرجة', en: '+{v}× critical damage' },
      icon: '🗡️', baseCost: 2500, costMult: 1.19, effect: 1,  type: 'critMult', max: 200 },
    { id: 'squad',    name: { ar: 'تدريب الفريق', en: 'Squad Training' },
      desc: { ar: '+{v}% ضرر المخلوقات', en: '+{v}% critter damage' },
      icon: '📯', baseCost: 5000, costMult: 1.13, effect: 10, type: 'dpsPct', max: 500 },
    { id: 'greed',    name: { ar: 'جشع', en: 'Greed' },
      desc: { ar: '+{v}% ذهب من كل عدو', en: '+{v}% gold from kills' },
      icon: '💰', baseCost: 8000, costMult: 1.16, effect: 8,  type: 'goldPct', max: 400 },
    { id: 'tapdps',   name: { ar: 'صدى الفريق', en: 'Squad Echo' },
      desc: { ar: 'كل نقرة تضيف {v}% من ضررك/ث', en: 'Each tap adds {v}% of your DPS' },
      icon: '🔁', baseCost: 50000, costMult: 1.17, effect: 5, type: 'tapFromDps', max: 200 },
    { id: 'bosstime', name: { ar: 'ضغط الزعيم', en: 'Boss Pressure' },
      desc: { ar: '+{v} ثانية في تحدي الزعيم', en: '+{v}s on boss timer' },
      icon: '⏱️', baseCost: 120000, costMult: 1.45, effect: 2, type: 'bossTime', max: 20 },
    { id: 'multi',    name: { ar: 'ضربة مزدوجة', en: 'Double Hit' },
      desc: { ar: '+{v}% فرصة ضربة إضافية', en: '+{v}% chance of an extra hit' },
      icon: '✌️', baseCost: 400000, costMult: 1.22, effect: 2, type: 'multiHit', max: 50 },
    { id: 'gemluck',  name: { ar: 'حظ الجواهر', en: 'Gem Luck' },
      desc: { ar: '+{v}% فرصة جوهرة من الزعماء', en: '+{v}% gem chance from bosses' },
      icon: '💎', baseCost: 2.5e6, costMult: 1.35, effect: 5, type: 'gemLuck', max: 40 }
  ];

  /* ---------------- active skills ---------------- */
  const SKILLS = [
    { id: 'fury',    name: { ar: 'هياج', en: 'Fury' },
      desc: { ar: 'ضرر النقر ×{m} لمدة {d} ثانية', en: 'Tap damage ×{m} for {d}s' },
      icon: '🔥', dur: 15, cd: 60,  mult: 10, unlock: 1 },
    { id: 'rally',   name: { ar: 'نداء الحرب', en: 'War Rally' },
      desc: { ar: 'ضرر المخلوقات ×{m} لمدة {d} ثانية', en: 'Critter damage ×{m} for {d}s' },
      icon: '📣', dur: 20, cd: 90,  mult: 3,  unlock: 4 },
    { id: 'goldrush',name: { ar: 'حمى الذهب', en: 'Gold Rush' },
      desc: { ar: 'الذهب ×{m} لمدة {d} ثانية', en: 'Gold ×{m} for {d}s' },
      icon: '🪙', dur: 20, cd: 120, mult: 5,  unlock: 8 },
    { id: 'bolt',    name: { ar: 'صاعقة', en: 'Chain Bolt' },
      desc: { ar: 'ضرر فوري = {m}× ضررك/ث', en: 'Instant damage = {m}× your DPS' },
      icon: '⚡', dur: 0,  cd: 45,  mult: 40, unlock: 12 },
    { id: 'warp',    name: { ar: 'انزلاق الزمن', en: 'Time Warp' },
      desc: { ar: 'اربح ذهب {m} ثانية فوراً', en: 'Instantly gain {m}s of gold' },
      icon: '⏳', dur: 0,  cd: 300, mult: 90, unlock: 18 }
  ];

  /* ---------------- relics (soul shop, permanent) ---------------- */
  const RELICS = [
    { id: 'r_dmg',   name: { ar: 'ناب الأسلاف', en: 'Ancestor Fang' },
      desc: { ar: '+{v}% ضرر كلي', en: '+{v}% all damage' },
      icon: '🦷', baseCost: 3,  costMult: 1.35, effect: 15, max: 200 },
    { id: 'r_gold',  name: { ar: 'تاج الجشع', en: 'Crown of Greed' },
      desc: { ar: '+{v}% ذهب', en: '+{v}% gold' },
      icon: '👑', baseCost: 4,  costMult: 1.38, effect: 20, max: 200 },
    { id: 'r_tap',   name: { ar: 'قفاز التيتان', en: 'Titan Gauntlet' },
      desc: { ar: '+{v}% ضرر النقر', en: '+{v}% tap damage' },
      icon: '🧤', baseCost: 3,  costMult: 1.36, effect: 25, max: 200 },
    { id: 'r_start', name: { ar: 'خريطة قديمة', en: 'Ancient Map' },
      desc: { ar: 'ابدأ البعث من {v}% من أفضل مرحلة', en: 'Prestige starts you at {v}% of your best stage' },
      icon: '🗺️', baseCost: 8,  costMult: 1.85, effect: 2,  max: 30 },
    { id: 'r_off',   name: { ar: 'ساعة رملية', en: 'Hourglass' },
      desc: { ar: '+{v}% أرباح الأوفلاين (و+١ ساعة سقف)', en: '+{v}% offline earnings (+1h cap)' },
      icon: '⏳', baseCost: 6,  costMult: 1.5,  effect: 10, max: 40 },
    { id: 'r_boss',  name: { ar: 'قلب البطل', en: 'Hero Heart' },
      desc: { ar: '+{v} ثانية لمؤقت الزعيم', en: '+{v}s boss timer' },
      icon: '❤️', baseCost: 10, costMult: 2.0,  effect: 3,  max: 15 },
    { id: 'r_auto',  name: { ar: 'مخلب آلي', en: 'Auto Claw' },
      desc: { ar: '{v} نقرة تلقائية في الثانية', en: '{v} auto-taps per second' },
      icon: '🤖', baseCost: 15, costMult: 1.9,  effect: 1,  max: 20 },
    { id: 'r_soul',  name: { ar: 'مذبح الأرواح', en: 'Soul Altar' },
      desc: { ar: '+{v}% أرواح عند البعث', en: '+{v}% souls on prestige' },
      icon: '🕯️', baseCost: 20, costMult: 1.8,  effect: 10, max: 50 },
    { id: 'r_cd',    name: { ar: 'حجر السرعة', en: 'Haste Stone' },
      desc: { ar: '-{v}% زمن انتظار المهارات', en: '-{v}% skill cooldowns' },
      icon: '🌀', baseCost: 12, costMult: 1.85, effect: 4,  max: 15 },
    { id: 'r_gem',   name: { ar: 'منجم الجواهر', en: 'Gem Mine' },
      desc: { ar: '+{v}% جواهر من كل مصدر', en: '+{v}% gems from all sources' },
      icon: '💠', baseCost: 25, costMult: 1.7,  effect: 20, max: 30 }
  ];

  /* ---------------- achievements ---------------- */
  const ACHIEVEMENTS = [
    { id: 'a_stage5',   name: { ar: 'الخطوة الأولى', en: 'First Steps' },      desc: { ar: 'اوصل للمرحلة ٥', en: 'Reach stage 5' },        check: g => g.bestStage >= 5,    gems: 5 },
    { id: 'a_stage10',  name: { ar: 'مستكشف', en: 'Explorer' },                desc: { ar: 'اوصل للمرحلة ١٠', en: 'Reach stage 10' },      check: g => g.bestStage >= 10,   gems: 10 },
    { id: 'a_stage25',  name: { ar: 'مغامر', en: 'Adventurer' },               desc: { ar: 'اوصل للمرحلة ٢٥', en: 'Reach stage 25' },      check: g => g.bestStage >= 25,   gems: 20 },
    { id: 'a_stage50',  name: { ar: 'بطل', en: 'Champion' },                   desc: { ar: 'اوصل للمرحلة ٥٠', en: 'Reach stage 50' },      check: g => g.bestStage >= 50,   gems: 40 },
    { id: 'a_stage100', name: { ar: 'أسطورة', en: 'Legend' },                  desc: { ar: 'اوصل للمرحلة ١٠٠', en: 'Reach stage 100' },    check: g => g.bestStage >= 100,  gems: 100 },
    { id: 'a_stage200', name: { ar: 'خالد', en: 'Immortal' },                  desc: { ar: 'اوصل للمرحلة ٢٠٠', en: 'Reach stage 200' },    check: g => g.bestStage >= 200,  gems: 250 },
    { id: 'a_tap100',   name: { ar: 'إصبع نشيط', en: 'Busy Finger' },          desc: { ar: '١٠٠ نقرة', en: '100 taps' },                   check: g => g.stats.taps >= 100,     gems: 5 },
    { id: 'a_tap5k',    name: { ar: 'عاصفة نقر', en: 'Tap Storm' },            desc: { ar: '٥٬٠٠٠ نقرة', en: '5,000 taps' },               check: g => g.stats.taps >= 5000,    gems: 25 },
    { id: 'a_tap50k',   name: { ar: 'إعصار', en: 'Hurricane' },                desc: { ar: '٥٠٬٠٠٠ نقرة', en: '50,000 taps' },             check: g => g.stats.taps >= 50000,   gems: 80 },
    { id: 'a_kill100',  name: { ar: 'صياد', en: 'Hunter' },                    desc: { ar: 'اقتل ١٠٠ وحش', en: 'Slay 100 monsters' },      check: g => g.stats.kills >= 100,    gems: 10 },
    { id: 'a_kill1k',   name: { ar: 'مبيد', en: 'Slayer' },                    desc: { ar: 'اقتل ١٬٠٠٠ وحش', en: 'Slay 1,000 monsters' },  check: g => g.stats.kills >= 1000,   gems: 30 },
    { id: 'a_kill10k',  name: { ar: 'كابوس الوحوش', en: 'Monster Nightmare' }, desc: { ar: 'اقتل ١٠٬٠٠٠ وحش', en: 'Slay 10,000 monsters' },check: g => g.stats.kills >= 10000,  gems: 90 },
    { id: 'a_boss10',   name: { ar: 'قاتل الزعماء', en: 'Boss Killer' },       desc: { ar: 'اهزم ١٠ زعماء', en: 'Defeat 10 bosses' },      check: g => g.stats.bosses >= 10,    gems: 20 },
    { id: 'a_boss50',   name: { ar: 'مروض الوحوش', en: 'Beast Tamer' },        desc: { ar: 'اهزم ٥٠ زعيماً', en: 'Defeat 50 bosses' },     check: g => g.stats.bosses >= 50,    gems: 60 },
    { id: 'a_crit1k',   name: { ar: 'دقة قاتلة', en: 'Deadly Aim' },           desc: { ar: '١٬٠٠٠ ضربة حرجة', en: '1,000 critical hits' }, check: g => g.stats.crits >= 1000,   gems: 30 },
    { id: 'a_squad3',   name: { ar: 'فريق صغير', en: 'Small Squad' },          desc: { ar: 'جنّد ٣ مخلوقات', en: 'Hire 3 critters' },      check: g => CC.data.crittersOwned(g) >= 3,  gems: 10 },
    { id: 'a_squad6',   name: { ar: 'كتيبة', en: 'Battalion' },                desc: { ar: 'جنّد ٦ مخلوقات', en: 'Hire 6 critters' },      check: g => CC.data.crittersOwned(g) >= 6,  gems: 30 },
    { id: 'a_squadall', name: { ar: 'الفريق الكامل', en: 'Full Roster' },      desc: { ar: 'جنّد كل المخلوقات', en: 'Hire every critter' },check: g => CC.data.crittersOwned(g) >= 12, gems: 150 },
    { id: 'a_lv100',    name: { ar: 'مدرّب', en: 'Trainer' },                  desc: { ar: 'ارفع مخلوقاً للمستوى ١٠٠', en: 'Level a critter to 100' }, check: g => CC.data.maxCritterLevel(g) >= 100, gems: 40 },
    { id: 'a_lv500',    name: { ar: 'أسطورة التدريب', en: 'Master Trainer' },  desc: { ar: 'ارفع مخلوقاً للمستوى ٥٠٠', en: 'Level a critter to 500' }, check: g => CC.data.maxCritterLevel(g) >= 500, gems: 120 },
    { id: 'a_pres1',    name: { ar: 'ولادة جديدة', en: 'Rebirth' },            desc: { ar: 'ابعث مرة واحدة', en: 'Prestige once' },        check: g => g.prestiges >= 1,        gems: 25 },
    { id: 'a_pres5',    name: { ar: 'دورة الأرواح', en: 'Soul Cycle' },        desc: { ar: 'ابعث ٥ مرات', en: 'Prestige 5 times' },        check: g => g.prestiges >= 5,        gems: 75 },
    { id: 'a_souls100', name: { ar: 'جامع الأرواح', en: 'Soul Collector' },    desc: { ar: 'اجمع ١٠٠ روح', en: 'Own 100 souls' },          check: g => g.souls >= 100,          gems: 60 },
    { id: 'a_gold1e9',  name: { ar: 'ثري', en: 'Rich' },                       desc: { ar: 'اربح مليار ذهب', en: 'Earn 1B total gold' },   check: g => g.stats.totalGold >= 1e9, gems: 50 },
    { id: 'a_relic5',   name: { ar: 'حافظ الآثار', en: 'Relic Keeper' },       desc: { ar: 'اشترِ ٥ آثار', en: 'Buy 5 relic levels' },     check: g => CC.data.relicLevels(g) >= 5, gems: 40 },
    { id: 'a_skillall', name: { ar: 'كل المهارات', en: 'All Skills' },         desc: { ar: 'افتح كل المهارات', en: 'Unlock every skill' }, check: g => g.bestStage >= 18,       gems: 35 }
  ];

  /* ---------------- chest reward table ---------------- */
  const CHEST_TABLE = [
    { w: 34, kind: 'gold',  mult: 120,  label: { ar: 'كومة ذهب', en: 'Gold pile' } },
    { w: 20, kind: 'gold',  mult: 400,  label: { ar: 'كنز ذهبي', en: 'Gold hoard' } },
    { w: 18, kind: 'gems',  amount: 15, label: { ar: 'جواهر', en: 'Gems' } },
    { w: 9,  kind: 'gems',  amount: 40, label: { ar: 'جواهر وفيرة', en: 'Big gems' } },
    { w: 10, kind: 'boost', boost: 'gold', mult: 2, dur: 900,  label: { ar: 'معزّز ذهب ×٢', en: '×2 gold boost' } },
    { w: 7,  kind: 'boost', boost: 'dmg',  mult: 2, dur: 900,  label: { ar: 'معزّز ضرر ×٢', en: '×2 damage boost' } },
    { w: 2,  kind: 'boost', boost: 'dmg',  mult: 5, dur: 300,  label: { ar: 'معزّز ضرر ×٥!', en: '×5 damage boost!' } }
  ];

  /* ---------------- helpers over save state ---------------- */
  function crittersOwned(g) {
    let n = 0;
    for (const id in g.critters) if ((g.critters[id] || 0) > 0) n++;
    return n;
  }
  function maxCritterLevel(g) {
    let m = 0;
    for (const id in g.critters) m = Math.max(m, g.critters[id] || 0);
    return m;
  }
  function relicLevels(g) {
    let n = 0;
    for (const r of RELICS) n += g.relics[r.id] || 0;
    return n;
  }

  CC.data = {
    BAL, ZONES, CRITTERS, UPGRADES, SKILLS, RELICS, ACHIEVEMENTS, MILESTONES,
    MONSTER_NAMES, BOSS_NAMES, CHEST_TABLE,
    monsterHP, monsterGold, isBossStage, bossHPMult, bossGoldMult, soulsFor, soulMultiplier,
    getCritter, critterById, critterList, highestUnlockedTier, generatedCritter, BASE_TIERS,
    zoneFor, zoneIndex, zoneKey, zoneCycle, critterMilestoneMult, nextMilestone,
    crittersOwned, maxCritterLevel, relicLevels
  };
})(window);
