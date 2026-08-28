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
    soulsPerStage: 10,          // souls = 10 × (bestStage − 9)^1.12
    soulExp: 1.12,
    soulPower: 1.06,            // each soul multiplies ALL damage by this
    minPrestigeStage: 10,
    eliteIndex: 6,              // the 7th monster of every stage is an elite
    eliteHPMult: 3.2,
    eliteGoldMult: 5,
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

  /** Elites are ordinary monsters that hit far harder in the wallet. */
  function isEliteIndex(index) { return index === BAL.eliteIndex; }

  function bossHPMult(stage) { return stage % 25 === 0 ? 12 : 5; }
  function bossGoldMult(stage) { return stage % 25 === 0 ? 20 : 9; }

  /**
   * Souls awarded for prestiging.
   * Linear-ish in stage, which — combined with a multiplicative per-soul
   * damage bonus — makes every prestige reach roughly 2.5× deeper than the
   * last, forever. That is what keeps an endless game actually endless.
   */
  function soulsFor(bestStage) {
    if (bestStage < BAL.minPrestigeStage) return 0;
    return Math.floor(BAL.soulsPerStage * Math.pow(bestStage - 9, BAL.soulExp));
  }

  /**
   * Souls a prestige actually pays out.
   *
   * `soulStage` is the deepest stage already cashed in. Only ground broken
   * SINCE the last prestige pays again — otherwise the button could be tapped
   * over and over for the same reward, which is exactly the exploit this
   * function exists to close.
   */
  function soulsGain(bestStage, soulStage) {
    const earned = soulsFor(bestStage) - soulsFor(Math.max(0, soulStage || 0));
    return Math.max(0, Math.floor(earned));
  }

  /** The shallowest stage that would pay at least one more soul. */
  function nextSoulStage(soulStage) {
    const have = soulsFor(Math.max(0, soulStage || 0));
    let s = Math.max(BAL.minPrestigeStage, Math.floor(soulStage || 0) + 1);
    for (let i = 0; i < 400 && soulsFor(s) <= have; i++) s++;
    return s;
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
    { ar: 'دودة رمل', en: 'Sandworm' }, { ar: 'تنين صغير', en: 'Draklet' }, { ar: 'آلي', en: 'Cogling' },
    { ar: 'سلطعون صخري', en: 'Rockcrab' }, { ar: 'يرقة شائكة', en: 'Thornlarva' }, { ar: 'عين طافية', en: 'Floating Eye' },
    { ar: 'هيكل صغير', en: 'Bonelet' }, { ar: 'قنديل مسموم', en: 'Venomjelly' }, { ar: 'خفاش رعدي', en: 'Stormbat' },
    { ar: 'جذر حي', en: 'Livingroot' }, { ar: 'شرارة عائمة', en: 'Sparkmote' }, { ar: 'زاحف الصدأ', en: 'Rustcrawler' },
    { ar: 'قط الظل', en: 'Shadecat' }, { ar: 'سمكة حمم', en: 'Magmafish' }, { ar: 'مهرج العدم', en: 'Voidjester' },
    { ar: 'حارس البوابة', en: 'Gatekeep' }, { ar: 'فقاعة سامة', en: 'Toxbubble' }, { ar: 'جندي بلوري', en: 'Shardling' }
  ];
  const BOSS_NAMES = [
    { ar: 'ملك الفطر', en: 'Shroom King' }, { ar: 'حارس البلور', en: 'Crystal Warden' },
    { ar: 'سيد الجمر', en: 'Ember Lord' }, { ar: 'عملاق الصقيع', en: 'Frost Giant' },
    { ar: 'أم السموم', en: 'Toxic Mother' }, { ar: 'العمدة الشبح', en: 'Ghost Mayor' },
    { ar: 'وحش الأعماق', en: 'Deep Horror' }, { ar: 'المحرك الأعظم', en: 'Grand Engine' },
    { ar: 'حورية السماء', en: 'Sky Seraph' }, { ar: 'آكل العوالم', en: 'World Eater' },
    { ar: 'طاغية الرماد', en: 'Ash Tyrant' }, { ar: 'أفعى الأبدية', en: 'Eternal Wyrm' },
    { ar: 'ملكة الأنياب', en: 'Fang Queen' }, { ar: 'حامل التاج', en: 'Crownbearer' },
    { ar: 'عرّاب الرعد', en: 'Storm Godfather' }, { ar: 'الراعي الصامت', en: 'Silent Shepherd' },
    { ar: 'أب الجذور', en: 'Rootfather' }, { ar: 'قاضي النجوم', en: 'Star Judge' },
    { ar: 'سجّان الأرواح', en: 'Soul Warden' }, { ar: 'المحرّك الأخير', en: 'Last Engine' }
  ];

  /* ---------------- critters (DPS units) ---------------- */
  /* cost = baseCost * costMult^level ; dps = baseDps * level * milestones */
  const CRITTERS = [
    { id: 'sparky',  name: { ar: 'شرارة',   en: 'Sparky' },   desc: { ar: 'قنفذ كهربائي سريع.', en: 'A fast electric hedgehog.' },
      baseCost: 10,        costMult: 1.086, baseDps: 4,        unlock: 1,   pal: ['#ffe066', '#ffb703', '#5a3e00'], shape: 'round' },
    { id: 'mossy',   name: { ar: 'طُحلب',    en: 'Mossy' },    desc: { ar: 'حارس الغابة الصبور.', en: 'Patient forest guardian.' },
      baseCost: 120,       costMult: 1.087, baseDps: 32,       unlock: 3,   pal: ['#8ce99a', '#2f9e44', '#12401f'], shape: 'blob' },
    { id: 'pyra',    name: { ar: 'لهيبة',   en: 'Pyra' },     desc: { ar: 'تنينة صغيرة نافثة للنار.', en: 'Tiny fire-breathing dragon.' },
      baseCost: 1600,      costMult: 1.088, baseDps: 220,      unlock: 6,   pal: ['#ff8787', '#e03131', '#5c1010'], shape: 'dragon' },
    { id: 'glacio',  name: { ar: 'جليدة',   en: 'Glacio' },   desc: { ar: 'دبٌ جليدي يجمّد الأعداء.', en: 'Ice bear that freezes foes.' },
      baseCost: 22000,     costMult: 1.089, baseDps: 1520,     unlock: 10,  pal: ['#a5d8ff', '#1c7ed6', '#0b3a63'], shape: 'bear' },
    { id: 'venn',    name: { ar: 'سُمّة',    en: 'Venn' },     desc: { ar: 'أفعى سامة خفية.', en: 'Stealthy venom serpent.' },
      baseCost: 300000,    costMult: 1.09, baseDps: 10400,    unlock: 15,  pal: ['#d8f5a2', '#66a80f', '#2b3d05'], shape: 'snake' },
    { id: 'phantom', name: { ar: 'طيف',     en: 'Phantom' },  desc: { ar: 'روح تمر عبر الدروع.', en: 'Spirit that pierces armour.' },
      baseCost: 4.2e6,     costMult: 1.091, baseDps: 72000,    unlock: 21,  pal: ['#e5dbff', '#7048e8', '#2b1a55'], shape: 'ghost' },
    { id: 'reefus',  name: { ar: 'مرجان',   en: 'Reefus' },   desc: { ar: 'أخطبوط بثمانية أذرع ضاربة.', en: 'Octopus with eight striking arms.' },
      baseCost: 6.5e7,     costMult: 1.092, baseDps: 520000,   unlock: 28,  pal: ['#99e9f2', '#0c8599', '#053742'], shape: 'octo' },
    { id: 'cogsworth', name: { ar: 'تِرس',  en: 'Cogsworth' },desc: { ar: 'آلي لا يتعب أبداً.', en: 'Automaton that never tires.' },
      baseCost: 1.1e9,     costMult: 1.093, baseDps: 3920000,  unlock: 36,  pal: ['#ffe8a3', '#d9a441', '#4a3410'], shape: 'robot' },
    { id: 'seraphin',name: { ar: 'سرافين',  en: 'Seraphin' }, desc: { ar: 'مخلوق سماوي مجنّح.', en: 'Winged celestial being.' },
      baseCost: 2.4e10,    costMult: 1.094, baseDps: 31.2e6,   unlock: 45,  pal: ['#ffd6f5', '#e64980', '#5c1236'], shape: 'angel' },
    { id: 'voidmaw', name: { ar: 'فك العدم', en: 'Voidmaw' }, desc: { ar: 'يلتهم كل ما يلمسه.', en: 'Devours everything it touches.' },
      baseCost: 6.0e11,    costMult: 1.095, baseDps: 248e6,    unlock: 55,  pal: ['#ff8ada', '#9c1f7a', '#2a0322'], shape: 'maw' },
    { id: 'titanix', name: { ar: 'تيتانِكس', en: 'Titanix' },  desc: { ar: 'عملاق قديم من الصخر الحي.', en: 'Ancient living-stone titan.' },
      baseCost: 1.8e13,    costMult: 1.096, baseDps: 2.16e9,   unlock: 68,  pal: ['#ced4da', '#868e96', '#2b3035'], shape: 'golem' },
    { id: 'astra',   name: { ar: 'أسترا',   en: 'Astra' },    desc: { ar: 'نجمة حية تحرق المجرات.', en: 'A living star that burns galaxies.' },
      baseCost: 7.5e14,    costMult: 1.097, baseDps: 2.04e10,  unlock: 82,  pal: ['#fff3bf', '#fab005', '#7a4a00'], shape: 'star' },
    { id: 'obsidia', name: { ar: 'أوبسيديا', en: 'Obsidia' },  desc: { ar: 'حارسة من الزجاج البركاني.', en: 'A guardian carved from volcanic glass.' },
      baseCost: 3.1e16,    costMult: 1.098, baseDps: 3.3e11,   unlock: 96,  pal: ['#b5aee0', '#4b3f7a', '#150f2e'], shape: 'golem' },
    { id: 'tempest', name: { ar: 'عاصفة',   en: 'Tempest' },  desc: { ar: 'إعصار في هيئة مخلوق.', en: 'A hurricane wearing a body.' },
      baseCost: 1.3e18,    costMult: 1.099, baseDps: 5.2e12,   unlock: 110, pal: ['#c5f6fa', '#3bc9db', '#0b3d47'], shape: 'ghost' },
    { id: 'gorehorn',name: { ar: 'قرن الدم', en: 'Gorehorn' }, desc: { ar: 'ثور مدرّع لا يعرف التراجع.', en: 'An armoured bull that never backs off.' },
      baseCost: 5.4e19,    costMult: 1.100, baseDps: 8.3e13,   unlock: 125, pal: ['#ffc9c9', '#c92a2a', '#3d0808'], shape: 'bear' },
    { id: 'oracle',  name: { ar: 'العرّافة', en: 'Oracle' },   desc: { ar: 'ترى ضربتك قبل أن تنويها.', en: 'Sees your strike before you plan it.' },
      baseCost: 2.3e21,    costMult: 1.101, baseDps: 1.3e15,   unlock: 141, pal: ['#e9d8ff', '#845ef7', '#2b1160'], shape: 'angel' },
    { id: 'nihil',   name: { ar: 'نِهيل',    en: 'Nihil' },    desc: { ar: 'ما تبقى بعد أن انتهى كل شيء.', en: 'What is left after everything ended.' },
      baseCost: 9.7e22,    costMult: 1.102, baseDps: 2.1e16,   unlock: 158, pal: ['#f1f3f5', '#212529', '#000000'], shape: 'maw' }
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

  const BASE_TIERS = CRITTERS.length;              // hand-authored tiers
  const LAST_UNLOCK = CRITTERS[BASE_TIERS - 1].unlock;
  const GEN_UNLOCK_STEP = 18;
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
        ar: 'مخلوق من أعماق المرحلة ' + (LAST_UNLOCK + n * GEN_UNLOCK_STEP) + '.',
        en: 'A horror born past stage ' + (LAST_UNLOCK + n * GEN_UNLOCK_STEP) + '.'
      },
      baseCost: D(last.baseCost).mul(D(GEN_COST_STEP).pow(n)),
      baseDps: D(last.baseDps).mul(D(GEN_DPS_STEP).pow(n)),
      costMult: Math.min(1.14, CRITTERS[BASE_TIERS - 1].costMult + n * 0.001),
      unlock: LAST_UNLOCK + n * GEN_UNLOCK_STEP,
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
    if (bestStage < LAST_UNLOCK) {
      let t = -1;
      for (let i = 0; i < BASE_TIERS; i++) if (bestStage >= CRITTERS[i].unlock) t = i;
      return t;
    }
    return (BASE_TIERS - 1) + Math.floor((bestStage - LAST_UNLOCK) / GEN_UNLOCK_STEP);
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

  /* ---------------- hero upgrades (gold) ----------------
     Cost is geometric in level, and the multipliers are steep on purpose:
     an upgrade should still be a real decision at stage 400, not something you
     max out in the first ten minutes and never think about again. */
  const UPGRADES = [
    { id: 'claw',     name: { ar: 'مخالب حادة', en: 'Sharp Claws' },
      desc: { ar: '+{v} ضرر لكل نقرة', en: '+{v} tap damage' },
      icon: '✊', baseCost: 250,  costMult: 1.135, effect: 4,   type: 'tapFlat', max: 500 },
    { id: 'power',    name: { ar: 'قوة الوحش', en: 'Beast Power' },
      desc: { ar: '+{v}% ضرر النقر', en: '+{v}% tap damage' },
      icon: '💥', baseCost: 6000, costMult: 1.165, effect: 12,  type: 'tapPct', max: 300 },
    { id: 'crit',     name: { ar: 'عين النمر', en: 'Tiger Eye' },
      desc: { ar: '+{v}% فرصة ضربة حرجة', en: '+{v}% critical chance' },
      icon: '🎯', baseCost: 26000, costMult: 1.26, effect: 1,   type: 'critChance', max: 45 },
    { id: 'critdmg',  name: { ar: 'ضربة قاتلة', en: 'Lethal Strike' },
      desc: { ar: '+{v}× ضرر الضربة الحرجة', en: '+{v}× critical damage' },
      icon: '🗡️', baseCost: 70000, costMult: 1.235, effect: 1,  type: 'critMult', max: 200 },
    { id: 'squad',    name: { ar: 'تدريب الفريق', en: 'Squad Training' },
      desc: { ar: '+{v}% ضرر المخلوقات', en: '+{v}% critter damage' },
      icon: '📯', baseCost: 140000, costMult: 1.158, effect: 10, type: 'dpsPct', max: 500 },
    { id: 'greed',    name: { ar: 'جشع', en: 'Greed' },
      desc: { ar: '+{v}% ذهب من كل عدو', en: '+{v}% gold from kills' },
      icon: '💰', baseCost: 260000, costMult: 1.195, effect: 8,  type: 'goldPct', max: 400 },
    { id: 'focus',    name: { ar: 'صيد الزعماء', en: 'Boss Hunter' },
      desc: { ar: '+{v}% ضرر ضد الزعماء', en: '+{v}% damage against bosses' },
      icon: '👑', baseCost: 1.4e6, costMult: 1.215, effect: 10, type: 'bossDmg', max: 300 },
    { id: 'tapdps',   name: { ar: 'صدى الفريق', en: 'Squad Echo' },
      desc: { ar: 'كل نقرة تضيف {v}% من ضررك/ث', en: 'Each tap adds {v}% of your DPS' },
      icon: '🔁', baseCost: 6.5e6, costMult: 1.205, effect: 5, type: 'tapFromDps', max: 200 },
    { id: 'fortune',  name: { ar: 'كنز الزعماء', en: 'Boss Hoard' },
      desc: { ar: '+{v}% ذهب من الزعماء', en: '+{v}% gold from bosses' },
      icon: '🏆', baseCost: 2.4e7, costMult: 1.25, effect: 15, type: 'bossGold', max: 200 },
    { id: 'bosstime', name: { ar: 'ضغط الزعيم', en: 'Boss Pressure' },
      desc: { ar: '+{v} ثانية في تحدي الزعيم', en: '+{v}s on boss timer' },
      icon: '⏱️', baseCost: 9e7, costMult: 1.55, effect: 2, type: 'bossTime', max: 20 },
    { id: 'multi',    name: { ar: 'ضربة مزدوجة', en: 'Double Hit' },
      desc: { ar: '+{v}% فرصة ضربة إضافية', en: '+{v}% chance of an extra hit' },
      icon: '✌️', baseCost: 3.2e8, costMult: 1.28, effect: 2, type: 'multiHit', max: 50 },
    { id: 'haste',    name: { ar: 'تعجيل المهارات', en: 'Skill Haste' },
      desc: { ar: '-{v}% زمن انتظار المهارات', en: '-{v}% skill cooldowns' },
      icon: '🌀', baseCost: 4.5e9, costMult: 1.62, effect: 2, type: 'cdPct', max: 20 },
    { id: 'treasure', name: { ar: 'صائد الصناديق', en: 'Chest Hunter' },
      desc: { ar: '-{v}% انتظار الصندوق المجاني', en: '-{v}% free-chest wait' },
      icon: '🎁', baseCost: 6e10, costMult: 1.6, effect: 3, type: 'chestWait', max: 20 },
    { id: 'gemluck',  name: { ar: 'حظ الجواهر', en: 'Gem Luck' },
      desc: { ar: '+{v}% فرصة جوهرة من الزعماء', en: '+{v}% gem chance from bosses' },
      icon: '💎', baseCost: 9e11, costMult: 1.45, effect: 5, type: 'gemLuck', max: 40 },
    { id: 'soulseek', name: { ar: 'باحث الأرواح', en: 'Soul Seeker' },
      desc: { ar: '+{v}% أرواح عند البعث', en: '+{v}% souls on prestige' },
      icon: '👻', baseCost: 2.5e13, costMult: 1.75, effect: 2, type: 'soulPct', max: 50 }
  ];

  /* ---------------- active skills ----------------
     Deliberately feeble out of the box. Every skill carries its own gold-bought
     upgrade track, so a terrifying Fury is earned rather than handed out. */
  const SKILLS = [
    { id: 'fury',    name: { ar: 'هياج', en: 'Fury' },
      desc: { ar: 'ضرر النقر ×{m} لمدة {d} ثانية', en: 'Tap damage ×{m} for {d}s' },
      icon: '🔥', dur: 8,  durGain: 0.25, cd: 75,  mult: 2,   gain: 0.5,  unlock: 1,
      upCost: 9000,   upMult: 1.62, maxLv: 50 },
    { id: 'rally',   name: { ar: 'نداء الحرب', en: 'War Rally' },
      desc: { ar: 'ضرر المخلوقات ×{m} لمدة {d} ثانية', en: 'Critter damage ×{m} for {d}s' },
      icon: '📣', dur: 12, durGain: 0.4,  cd: 100, mult: 1.5, gain: 0.28, unlock: 4,
      upCost: 90000,  upMult: 1.63, maxLv: 50 },
    { id: 'goldrush',name: { ar: 'حمى الذهب', en: 'Gold Rush' },
      desc: { ar: 'الذهب ×{m} لمدة {d} ثانية', en: 'Gold ×{m} for {d}s' },
      icon: '🪙', dur: 12, durGain: 0.4,  cd: 140, mult: 2,   gain: 0.35, unlock: 8,
      upCost: 7.5e5, upMult: 1.64, maxLv: 50 },
    { id: 'bolt',    name: { ar: 'صاعقة', en: 'Chain Bolt' },
      desc: { ar: 'ضرر فوري = {m}× ضررك/ث', en: 'Instant damage = {m}× your DPS' },
      icon: '⚡', dur: 0,  durGain: 0,    cd: 55,  mult: 8,   gain: 3.5,  unlock: 12,
      upCost: 1.1e7, upMult: 1.65, maxLv: 50 },
    { id: 'warp',    name: { ar: 'انزلاق الزمن', en: 'Time Warp' },
      desc: { ar: 'اربح ذهب {m} ثانية فوراً', en: 'Instantly gain {m}s of gold' },
      icon: '⏳', dur: 0,  durGain: 0,    cd: 300, mult: 20,  gain: 7,    unlock: 18,
      upCost: 1.6e8, upMult: 1.66, maxLv: 50 },
    { id: 'frost',   name: { ar: 'صقيع', en: 'Deep Freeze' },
      desc: { ar: 'يجمّد مؤقت الزعيم {d} ثانية', en: 'Freezes the boss timer for {d}s' },
      icon: '❄️', dur: 5,  durGain: 0.35, cd: 180, mult: 1,   gain: 0,    unlock: 25,
      upCost: 2.2e9, upMult: 1.68, maxLv: 40 },
    { id: 'berserk', name: { ar: 'استشاطة', en: 'Berserk' },
      desc: { ar: 'كل نقرة حرجة مؤكدة {d} ثانية', en: 'Every tap crits for {d}s' },
      icon: '🩸', dur: 5,  durGain: 0.3,  cd: 210, mult: 1,   gain: 0,    unlock: 32,
      upCost: 4e10,  upMult: 1.7,  maxLv: 40 }
  ];

  /** Effective strength of a skill at a given upgrade level. */
  function skillMult(def, lv) {
    return Math.round((def.mult + def.gain * (lv || 0)) * 100) / 100;
  }
  function skillDur(def, lv) {
    return Math.round((def.dur + def.durGain * (lv || 0)) * 10) / 10;
  }
  /** Levelling a skill shaves its cooldown too, but never below 45%. */
  function skillCd(def, lv) {
    return def.cd * Math.max(0.45, 1 - (lv || 0) * 0.011);
  }
  /* ---------------- fusion (permanent critter merging) ----------------
     Feed one critter to another and the survivor keeps a star forever —
     stars are the only critter power that lives through a prestige. */
  const FUSION = {
    maxStars: 8,
    dpsPerStar: 1.15,         // ×1.15 compounding per star — ×3.06 at eight
    arenaPerStar: 1.06,
    sacrificeLevel: 60,       // level the fodder must reach, × (stars + 1)
    gemCost: 90,              // gems for the first star
    gemMult: 1.9
  };

  /** Percent damage a single star adds — the UI quotes this, never a literal. */
  function fusionStarPct() { return Math.round((FUSION.dpsPerStar - 1) * 100); }

  function fusionStars(g, id) { return (g.fusions && g.fusions[id]) || 0; }
  function fusionMult(stars) { return Math.pow(FUSION.dpsPerStar, stars || 0); }
  function fusionArenaMult(stars) { return Math.pow(FUSION.arenaPerStar, stars || 0); }
  function fusionNeedLevel(stars) { return FUSION.sacrificeLevel * ((stars || 0) + 1); }
  function fusionCost(stars) { return Math.round(FUSION.gemCost * Math.pow(FUSION.gemMult, stars || 0)); }

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
      icon: '🗺️', baseCost: 8,  costMult: 1.78, effect: 2,  max: 40 },
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
    { id: 'a_squadall', name: { ar: 'الفريق الكامل', en: 'Full Roster' },      desc: { ar: 'جنّد كل المخلوقات الأساسية', en: 'Hire every founding critter' },check: g => CC.data.crittersOwned(g) >= CC.data.BASE_TIERS, gems: 150 },
    { id: 'a_lv100',    name: { ar: 'مدرّب', en: 'Trainer' },                  desc: { ar: 'ارفع مخلوقاً للمستوى ١٠٠', en: 'Level a critter to 100' }, check: g => CC.data.maxCritterLevel(g) >= 100, gems: 40 },
    { id: 'a_lv500',    name: { ar: 'أسطورة التدريب', en: 'Master Trainer' },  desc: { ar: 'ارفع مخلوقاً للمستوى ٥٠٠', en: 'Level a critter to 500' }, check: g => CC.data.maxCritterLevel(g) >= 500, gems: 120 },
    { id: 'a_pres1',    name: { ar: 'ولادة جديدة', en: 'Rebirth' },            desc: { ar: 'ابعث مرة واحدة', en: 'Prestige once' },        check: g => g.prestiges >= 1,        gems: 25 },
    { id: 'a_pres5',    name: { ar: 'دورة الأرواح', en: 'Soul Cycle' },        desc: { ar: 'ابعث ٥ مرات', en: 'Prestige 5 times' },        check: g => g.prestiges >= 5,        gems: 75 },
    { id: 'a_souls100', name: { ar: 'جامع الأرواح', en: 'Soul Collector' },    desc: { ar: 'اجمع ١٠٠ روح', en: 'Own 100 souls' },          check: g => g.souls >= 100,          gems: 60 },
    { id: 'a_gold1e9',  name: { ar: 'ثري', en: 'Rich' },                       desc: { ar: 'اربح مليار ذهب', en: 'Earn 1B total gold' },   check: g => CC.D(g.stats.totalGold).gte(1e9), gems: 50 },
    { id: 'a_relic5',   name: { ar: 'حافظ الآثار', en: 'Relic Keeper' },       desc: { ar: 'اشترِ ٥ آثار', en: 'Buy 5 relic levels' },     check: g => CC.data.relicLevels(g) >= 5, gems: 40 },
    { id: 'a_skillall', name: { ar: 'كل المهارات', en: 'All Skills' },         desc: { ar: 'افتح كل المهارات', en: 'Unlock every skill' }, check: g => g.bestStage >= SKILLS[SKILLS.length - 1].unlock, gems: 35 },
    { id: 'a_stage500', name: { ar: 'ما بعد النهاية', en: 'Past the End' },     desc: { ar: 'اوصل للمرحلة ٥٠٠', en: 'Reach stage 500' },    check: g => g.bestStage >= 500,  gems: 500 },
    { id: 'a_stage1k',  name: { ar: 'كاسر العوالم', en: 'World Breaker' },      desc: { ar: 'اوصل للمرحلة ١٠٠٠', en: 'Reach stage 1000' },  check: g => g.bestStage >= 1000, gems: 1000 },
    { id: 'a_pres25',   name: { ar: 'دائرة لا تنتهي', en: 'Endless Circle' },   desc: { ar: 'ابعث ٢٥ مرة', en: 'Prestige 25 times' },       check: g => g.prestiges >= 25,       gems: 300 },
    { id: 'a_fuse1',    name: { ar: 'أول دمج', en: 'First Fusion' },            desc: { ar: 'ادمج مخلوقاً مرة واحدة', en: 'Fuse a critter once' },  check: g => CC.data.fusionTotal(g) >= 1,  gems: 40 },
    { id: 'a_fuse10',   name: { ar: 'سيد الدمج', en: 'Fusion Master' },         desc: { ar: 'اجمع ١٠ نجوم دمج', en: 'Collect 10 fusion stars' },   check: g => CC.data.fusionTotal(g) >= 10, gems: 150 },
    { id: 'a_fuse8',    name: { ar: 'مخلوق مثالي', en: 'Perfect Beast' },       desc: { ar: 'ارفع مخلوقاً لـ٨ نجوم', en: 'Take one critter to 8 stars' }, check: g => CC.data.fusionBest(g) >= FUSION.maxStars, gems: 400 },
    { id: 'a_skillup',  name: { ar: 'مدرّب المهارات', en: 'Skill Trainer' },    desc: { ar: 'رقِّ مهارة ١٠ مستويات', en: 'Level a skill 10 times' },   check: g => CC.data.maxSkillLevel(g) >= 10, gems: 60 },
    { id: 'a_skillmax', name: { ar: 'قوة خارقة', en: 'Overpowered' },           desc: { ar: 'رقِّ مهارة ٣٠ مستوى', en: 'Level a skill 30 times' },    check: g => CC.data.maxSkillLevel(g) >= 30, gems: 220 },
    { id: 'a_mut5',     name: { ar: 'عالِم الطفرات', en: 'Geneticist' },        desc: { ar: 'طفّر ٥ مخلوقات', en: 'Mutate 5 critters' },   check: g => Object.keys(g.mutations || {}).length >= 5, gems: 80 },
    { id: 'a_arena10',  name: { ar: 'مقاتل الحلبة', en: 'Arena Fighter' },      desc: { ar: 'افز بـ١٠ معارك حلبة', en: 'Win 10 arena battles' }, check: g => (g.arena && g.arena.wins) >= 10, gems: 50 },
    { id: 'a_arena100', name: { ar: 'بطل الحلبة', en: 'Arena Champion' },       desc: { ar: 'افز بـ١٠٠ معركة حلبة', en: 'Win 100 arena battles' }, check: g => (g.arena && g.arena.wins) >= 100, gems: 250 }
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
  function fusionTotal(g) {
    let n = 0;
    for (const id in (g.fusions || {})) n += g.fusions[id] || 0;
    return n;
  }
  function fusionBest(g) {
    let m = 0;
    for (const id in (g.fusions || {})) m = Math.max(m, g.fusions[id] || 0);
    return m;
  }
  function maxSkillLevel(g) {
    let m = 0;
    for (const id in (g.skillLv || {})) m = Math.max(m, g.skillLv[id] || 0);
    return m;
  }

  CC.data = {
    BAL, ZONES, CRITTERS, UPGRADES, SKILLS, RELICS, ACHIEVEMENTS, MILESTONES, FUSION,
    MONSTER_NAMES, BOSS_NAMES, CHEST_TABLE,
    monsterHP, monsterGold, isBossStage, isEliteIndex, bossHPMult, bossGoldMult,
    soulsFor, soulsGain, nextSoulStage, soulMultiplier,
    getCritter, critterById, critterList, highestUnlockedTier, generatedCritter, BASE_TIERS,
    zoneFor, zoneIndex, zoneKey, zoneCycle, critterMilestoneMult, nextMilestone,
    skillMult, skillDur, skillCd,
    fusionStars, fusionMult, fusionArenaMult, fusionNeedLevel, fusionCost, fusionStarPct,
    crittersOwned, maxCritterLevel, relicLevels, fusionTotal, fusionBest, maxSkillLevel
  };
})(window);
