/* ============================================================
   Critter Clash Idle — the Mutation Lab
   Spend gems to re-roll a critter into a procedurally unique
   variant: new rarity, new trait, new body, new colours.
   Mutations survive prestige, so they are the long game.
   ============================================================ */
(function (global) {
  'use strict';
  const CC = global.CC || (global.CC = {});
  const U = CC.util, D = CC.D;

  const RARITIES = [
    { id: 'common',    w: 520, mult: 1.0,  arena: 1.0,  color: '#9aa0b5',
      name: { ar: 'عادي', en: 'Common' } },
    { id: 'rare',      w: 280, mult: 1.7,  arena: 1.15, color: '#4dabf7',
      name: { ar: 'نادر', en: 'Rare' } },
    { id: 'epic',      w: 130, mult: 3.0,  arena: 1.32, color: '#b197fc',
      name: { ar: 'ملحمي', en: 'Epic' } },
    { id: 'legendary', w: 55,  mult: 5.5,  arena: 1.55, color: '#ffc23c',
      name: { ar: 'أسطوري', en: 'Legendary' } },
    { id: 'mythic',    w: 15,  mult: 10,   arena: 1.85, color: '#ff6bd6',
      name: { ar: 'خرافي', en: 'Mythic' } }
  ];

  /* trait effects:
     dps    → multiplies that critter's idle DPS
     gold / crit → global, counted once per owning critter
     atk / hp / spd / dodge → arena only
     special → handled inside the arena resolver                */
  const TRAITS = [
    { id: 'sharp',    icon: '🗡️', dps: 1.30,
      name: { ar: 'حادّ', en: 'Sharp' },      desc: { ar: '+٣٠٪ ضرر هذا المخلوق', en: '+30% this critter’s damage' } },
    { id: 'greedy',   icon: '💰', gold: 10,
      name: { ar: 'جشِع', en: 'Greedy' },     desc: { ar: '+١٠٪ ذهب لكل الفريق', en: '+10% gold for the whole squad' } },
    { id: 'lucky',    icon: '🍀', crit: 3,
      name: { ar: 'محظوظ', en: 'Lucky' },     desc: { ar: '+٣٪ فرصة ضربة حرجة', en: '+3% critical chance' } },
    { id: 'swift',    icon: '💨', spd: 1.30,
      name: { ar: 'سريع', en: 'Swift' },      desc: { ar: '+٣٠٪ سرعة في الحلبة', en: '+30% arena attack speed' } },
    { id: 'giant',    icon: '🗿', hp: 1.45,
      name: { ar: 'عملاق', en: 'Giant' },     desc: { ar: '+٤٥٪ صحة في الحلبة', en: '+45% arena health' } },
    { id: 'ember',    icon: '🔥', atk: 1.35,
      name: { ar: 'ملتهب', en: 'Ember' },     desc: { ar: '+٣٥٪ هجوم في الحلبة', en: '+35% arena attack' } },
    { id: 'thorns',   icon: '🌵', special: 'thorns',
      name: { ar: 'شوكي', en: 'Thorns' },     desc: { ar: 'يرتد ٢٥٪ من الضرر على المهاجم', en: 'Reflects 25% of damage taken' } },
    { id: 'vampire',  icon: '🩸', special: 'vampire',
      name: { ar: 'مصّاص', en: 'Vampire' },   desc: { ar: 'يشفي ٢٥٪ من ضرره', en: 'Heals for 25% of damage dealt' } },
    { id: 'twin',     icon: '👯', special: 'twin',
      name: { ar: 'توأم', en: 'Twin Strike' },desc: { ar: '٣٠٪ فرصة ضربة مزدوجة', en: '30% chance to strike twice' } },
    { id: 'guardian', icon: '🛡️', special: 'guardian',
      name: { ar: 'حارس', en: 'Guardian' },   desc: { ar: 'يتلقى ضرراً أقل بـ٢٥٪', en: 'Takes 25% less damage' } },
    { id: 'venomous', icon: '☠️', special: 'venom',
      name: { ar: 'سام', en: 'Venomous' },    desc: { ar: 'يسمّم الهدف: ضرر مستمر', en: 'Poisons the target for damage over time' } },
    { id: 'phoenix',  icon: '🕊️', special: 'phoenix',
      name: { ar: 'عنقاء', en: 'Phoenix' },   desc: { ar: 'يعود للحياة مرة بنصف صحته', en: 'Revives once at half health' } }
  ];

  const SHAPES = ['golem', 'dragon', 'ghost', 'octo', 'robot', 'maw', 'snake', 'bear', 'star', 'blob', 'round'];
  const ELEMENTS = [
    { id: 'fire',  icon: '🔥', beats: 'nature', name: { ar: 'نار', en: 'Fire' },  hue: 12 },
    { id: 'nature',icon: '🌿', beats: 'water',  name: { ar: 'طبيعة', en: 'Nature' }, hue: 120 },
    { id: 'water', icon: '💧', beats: 'storm',  name: { ar: 'ماء', en: 'Water' },  hue: 205 },
    { id: 'storm', icon: '⚡', beats: 'fire',   name: { ar: 'رعد', en: 'Storm' },  hue: 280 }
  ];

  const BASE_COST = 25;          // gems for the first roll on a critter
  const COST_STEP = 1.45;        // each re-roll of the same critter costs more
  const COST_CAP = 400;

  function rarityOf(mut) { return RARITIES[(mut && mut.rarity) || 0]; }
  function traitOf(mut) { return mut && mut.trait ? TRAITS.find(t => t.id === mut.trait) : null; }
  function elementOf(mut) { return ELEMENTS[(mut && mut.element) || 0]; }
  function rarityById(id) { return RARITIES.find(r => r.id === id) || RARITIES[0]; }

  function cost(g, critterId) {
    const rolls = (g.mutRolls && g.mutRolls[critterId]) || 0;
    return Math.min(COST_CAP, Math.round(BASE_COST * Math.pow(COST_STEP, rolls)));
  }

  function weightedRarity(rng) {
    let total = 0;
    for (const r of RARITIES) total += r.w;
    let x = rng() * total;
    for (let i = 0; i < RARITIES.length; i++) {
      x -= RARITIES[i].w;
      if (x <= 0) return i;
    }
    return 0;
  }

  /** Roll a brand-new mutation for a critter (does not save it). */
  function roll() {
    const rng = Math.random;
    return {
      rarity: weightedRarity(rng),
      trait: TRAITS[Math.floor(rng() * TRAITS.length)].id,
      element: Math.floor(rng() * ELEMENTS.length),
      shape: SHAPES[Math.floor(rng() * SHAPES.length)],
      hue: Math.floor(rng() * 360),
      seed: Math.floor(rng() * 1e9)
    };
  }

  /** Idle-DPS multiplier this mutation grants its critter. */
  function dpsMult(mut) {
    if (!mut) return 1;
    const t = traitOf(mut);
    return rarityOf(mut).mult * (t && t.dps ? t.dps : 1);
  }

  /** Squad-wide bonuses summed over every mutated critter the player owns. */
  function globals(g) {
    let goldPct = 0, critPct = 0;
    for (const id in g.mutations) {
      if (!(g.critters[id] > 0)) continue;
      const t = traitOf(g.mutations[id]);
      if (!t) continue;
      if (t.gold) goldPct += t.gold;
      if (t.crit) critPct += t.crit;
    }
    return { goldPct, critPct };
  }

  /** A sprite spec for the mutated look — feeds the same renderer as everything else. */
  function spriteSpec(def, mut) {
    if (!mut) return CC.sprites.critterSpec(def);
    const r = rarityOf(mut);
    const h = mut.hue;
    const spec = CC.sprites.critterSpec({
      id: def.id + '_m' + mut.seed,
      shape: mut.shape,
      baseDps: mut.seed,
      pal: [
        'hsl(' + h + ',78%,70%)',
        'hsl(' + h + ',66%,50%)',
        'hsl(' + ((h + 18) % 360) + ',72%,22%)'
      ]
    });
    spec.seed = mut.seed;
    spec.aura = mut.rarity >= 2 ? r.color : null;
    spec.crown = mut.rarity >= 3;
    spec.eyeColor = mut.rarity >= 4 ? '#fff0fb' : '#ffffff';
    spec.pupil = mut.rarity >= 4 ? '#ff2bb0' : '#12121a';
    return spec;
  }

  /**
   * How much stronger a mutation makes a unit *in the arena*.
   * Used to keep generated rivals honest: a rival rolled with a Mythic
   * Vampire is stronger than its raw power suggests, so its power is
   * discounted by exactly this factor before the difficulty is applied.
   */
  function arenaAdvantage(mut) {
    if (!mut) return 1;
    const r = rarityOf(mut), t = traitOf(mut);
    let adv = r.arena;
    if (t) {
      if (t.atk) adv *= t.atk;
      if (t.hp) adv *= Math.sqrt(t.hp);
      if (t.spd) adv *= t.spd;
      if (t.special) adv *= 1.14;          // thorns / vampire / twin / guardian / phoenix
    }
    return adv;
  }

  /**
   * Everything a mutation is worth in an arena fight: the idle-DPS boost is
   * already baked into a unit's power rating, and the arena adds combat
   * flavour on top — a generated rival must be discounted by both.
   */
  function arenaTotal(mut) {
    return dpsMult(mut) * arenaAdvantage(mut);
  }

  /** Elemental damage multiplier attacker → defender. */
  function elementMult(aIdx, dIdx) {
    const a = ELEMENTS[aIdx], d = ELEMENTS[dIdx];
    if (!a || !d) return 1;
    if (a.beats === d.id) return 1.35;
    if (d.beats === a.id) return 0.8;
    return 1;
  }

  CC.mut = {
    RARITIES, TRAITS, ELEMENTS, SHAPES, BASE_COST,
    rarityOf, traitOf, elementOf, rarityById, cost, roll, dpsMult, globals, arenaAdvantage, arenaTotal,
    spriteSpec, elementMult
  };
})(window);
