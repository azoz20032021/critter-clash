/* ============================================================
   Critter Clash Idle — the Arena (asynchronous PvP)

   There is no server: a team is packed into a short shareable
   code, and both players resolve the same deterministic battle
   from the same seed, so the result always matches. Generated
   rivals keep the ladder playable with no friends online.
   ============================================================ */
(function (global) {
  'use strict';
  const CC = global.CC || (global.CC = {});
  const U = CC.util, D = CC.D, DATA = CC.data;

  const TEAM_SIZE = 5;
  const TICK = 0.1;                 // battle resolution step, seconds
  const MAX_TIME = 45;              // hard stop

  const BOT_FIRST = {
    ar: ['أبو', 'سيد', 'ملك', 'صائد', 'شبح', 'أمير', 'وحش', 'ظل', 'فارس', 'حارس'],
    en: ['Lord', 'Doctor', 'Captain', 'Ghost', 'King', 'Hunter', 'Baron', 'Shadow', 'Sir', 'Mad']
  };
  const BOT_LAST = {
    ar: ['المخالب', 'الرعد', 'الجحيم', 'الفطر', 'البلور', 'الرمال', 'العدم', 'الصقيع', 'الأنياب', 'الحمم'],
    en: ['Claw', 'Thunder', 'Ember', 'Shroom', 'Crystal', 'Sands', 'Void', 'Frost', 'Fang', 'Magma']
  };

  /* ---------------------------------------------------------
     Teams
     --------------------------------------------------------- */
  /** The player's five strongest critters. */
  function myTeam(g) {
    const owned = [];
    for (const id in g.critters) {
      const lv = g.critters[id] | 0;
      if (lv <= 0) continue;
      const def = DATA.critterById(id);
      if (!def) continue;
      owned.push(unitFrom(def, lv, g.mutations[id]));
    }
    owned.sort((a, b) => b.logPower - a.logPower);
    return owned.slice(0, TEAM_SIZE);
  }

  function unitFrom(def, level, mut) {
    const mult = CC.mut.dpsMult(mut);
    const power = D(def.baseDps).mul(level * DATA.critterMilestoneMult(level) * mult);
    return {
      tier: def.tier,
      id: def.id,
      def,
      level,
      mut: mut || null,
      name: def.name,
      logPower: Math.max(0, power.log10())
    };
  }

  /** One number that summarises a whole team, safe at any scale. */
  function powerRating(team) {
    if (!team || !team.length) return 0;
    let sum = 0;
    for (const u of team) sum += u.logPower;
    return Math.round(sum * 10);
  }

  /* ---------------------------------------------------------
     Share codes
     --------------------------------------------------------- */
  function encodeTeam(g, name) {
    const team = myTeam(g);
    const payload = {
      v: 1,
      n: (name || g.playerName || ('Player' + Math.floor(1000 + Math.random() * 9000))).slice(0, 18),
      s: g.bestStage,
      t: team.map(u => [
        u.tier, u.level,
        u.mut ? u.mut.rarity : 0,
        u.mut ? CC.mut.TRAITS.findIndex(t => t.id === u.mut.trait) : -1,
        u.mut ? u.mut.element : (u.tier % 4),
        u.mut ? CC.mut.SHAPES.indexOf(u.mut.shape) : -1,
        u.mut ? u.mut.hue : 0,
        u.mut ? u.mut.seed % 100000 : 0
      ])
    };
    const json = JSON.stringify(payload);
    return 'CC1' + btoa(unescape(encodeURIComponent(json))).replace(/=+$/, '');
  }

  function decodeTeam(code) {
    code = String(code || '').trim().replace(/\s+/g, '');
    if (code.indexOf('CC1') !== 0) throw new Error('bad prefix');
    const b64 = code.slice(3);
    const json = decodeURIComponent(escape(atob(b64 + '==='.slice((b64.length + 3) % 4))));
    const p = JSON.parse(json);
    if (!p || !Array.isArray(p.t) || !p.t.length) throw new Error('bad payload');
    const team = p.t.slice(0, TEAM_SIZE).map(a => {
      const def = DATA.getCritter(Math.max(0, a[0] | 0));
      const traitIdx = a[3] | 0;
      const mut = traitIdx >= 0 ? {
        rarity: U.clamp(a[2] | 0, 0, CC.mut.RARITIES.length - 1),
        trait: (CC.mut.TRAITS[traitIdx] || CC.mut.TRAITS[0]).id,
        element: U.clamp(a[4] | 0, 0, 3),
        shape: CC.mut.SHAPES[a[5] | 0] || CC.mut.SHAPES[0],
        hue: (a[6] | 0) % 360,
        seed: (a[7] | 0) || 1,
        rolls: 1
      } : null;
      return unitFrom(def, Math.max(1, a[1] | 0), mut);
    });
    return { name: String(p.n || ('Player' + Math.floor(1000 + Math.random() * 9000))).slice(0, 18), stage: p.s | 0, team };
  }

  /* ---------------------------------------------------------
     Generated rivals
     --------------------------------------------------------- */
  function botName(seed) {
    const rng = U.seeded(seed);
    const lang = CC.i18n.getLang();
    const a = BOT_FIRST[lang] || BOT_FIRST.en;
    const b = BOT_LAST[lang] || BOT_LAST.en;
    return a[Math.floor(rng() * a.length)] + ' ' + b[Math.floor(rng() * b.length)];
  }

  /**
   * Build a rival by perturbing the player's own roster, so fights stay close.
   * `difficulty` shifts their power: 0.9 easy, 1.0 even, 1.25 champion.
   */
  function generateRival(g, seed, difficulty) {
    const rng = U.seeded(seed);
    const mine = myTeam(g);
    const base = mine.length ? mine : [unitFrom(DATA.getCritter(0), 1, null)];
    const shift = Math.log10(difficulty || 1);
    const team = [];
    for (let i = 0; i < TEAM_SIZE; i++) {
      const src = base[Math.min(i, base.length - 1)];
      /* Same tier as the player's slot: a tier is worth ~16× damage, so
         jittering it would drown out the difficulty setting entirely.
         Variety comes from levels, mutations and elements instead. */
      const def = DATA.getCritter(src.tier);
      const lvJitter = 0.88 + rng() * 0.26;
      const level = Math.max(1, Math.round(src.level * lvJitter));
      let mut = null;
      if (rng() < 0.55) {
        mut = {
          rarity: rng() < 0.06 ? 4 : rng() < 0.18 ? 3 : rng() < 0.4 ? 2 : rng() < 0.7 ? 1 : 0,
          trait: CC.mut.TRAITS[Math.floor(rng() * CC.mut.TRAITS.length)].id,
          element: Math.floor(rng() * 4),
          shape: CC.mut.SHAPES[Math.floor(rng() * CC.mut.SHAPES.length)],
          hue: Math.floor(rng() * 360),
          seed: Math.floor(rng() * 1e6),
          rolls: 1
        };
      }
      const u = unitFrom(def, level, mut);
      /* discount whatever the rolled mutation is worth in the arena, so
         "even" really means even and the difficulty dial stays truthful */
      u.logPower = Math.max(0, u.logPower + shift - Math.log10(CC.mut.arenaTotal(mut)));
      team.push(u);
    }
    return { name: botName(seed), stage: g.bestStage, team, generated: true, difficulty: difficulty || 1 };
  }

  /** Three rivals to choose from, refreshed on demand. */
  function rivalSlate(g, salt) {
    const base = (salt || 0) + (g.arena.trophies | 0) * 31 + 17;
    return [
      generateRival(g, base + 1, 0.88),
      generateRival(g, base + 2, 1.0),
      generateRival(g, base + 3, 1.3)
    ];
  }

  /* ---------------------------------------------------------
     Battle resolution — deterministic given the seed
     --------------------------------------------------------- */
  function buildFighters(team, side, scale) {
    return team.map((u, i) => {
      const mut = u.mut;
      const rarity = mut ? CC.mut.RARITIES[mut.rarity] : CC.mut.RARITIES[0];
      const trait = mut ? CC.mut.traitOf(mut) : null;
      const rel = Math.max(1e-4, Math.pow(10, Math.min(0, u.logPower - scale)));
      const sideHpMult = (side === 0) ? 3 : 1;
      const hp = 3000 * rel * rarity.arena * (trait && trait.hp ? trait.hp : 1) * sideHpMult;
      const atk = 420 * rel * rarity.arena * (trait && trait.atk ? trait.atk : 1);
      const spd = 1 * (trait && trait.spd ? trait.spd : 1);
      return {
        side, slot: i, unit: u,
        name: u.name, element: mut ? mut.element : (u.tier % 4),
        trait: trait ? trait.id : null,
        maxHp: hp, hp, atk, spd,
        cd: 0.6 + (i * 0.11), poison: 0, poisonT: 0, revived: false, alive: true
      };
    });
  }

  /**
   * Click / Tap damage in battle, based on trophies.
   * Base 1, then +1 per 100 trophies (e.g. 0-99 -> 1, 100-199 -> 2, 200-299 -> 3).
   */
  function tapDamageOf(trophies) {
    return 1 + Math.floor((trophies || 0) / 100);
  }

  /**
   * Offline drain: HP per second lost by the attacker (side 0) when attacking offline opponents.
   * Base 1, then +1 per 100 trophies.
   */
  function offlineDrainPerSec(trophies) {
    return 1 + Math.floor((trophies || 0) / 100);
  }

  /**
   * @param {Object} [opts] – optional settings
   * @param {number} [opts.offlineDrain] – HP/s drain on side 0 fighters (offline penalty)
   * @returns {{winner:number, events:Array, a:Array, b:Array, duration:number}}
   */
  function simulate(teamA, teamB, seed, opts) {
    opts = opts || {};
    let scale = 0;
    for (const u of teamA.concat(teamB)) scale = Math.max(scale, u.logPower);
    const A = buildFighters(teamA, 0, scale);
    const B = buildFighters(teamB, 1, scale);
    const rng = U.seeded(seed >>> 0);
    const events = [];
    let t = 0;

    // Offline drain: fraction of maxHp lost per second on side 0
    const drainPerSec = opts.offlineDrain || 0;
    // Normalize drain to be relative to the battle HP scale
    // buildFighters gives ~3000 * rel * bonuses for maxHp, so 1 drain ≈ 0.03% of max
    // We want it subtle but noticeable — scale against the average maxHp of A
    let avgMaxHpA = 0;
    if (drainPerSec > 0) {
      for (const f of A) avgMaxHpA += f.maxHp;
      avgMaxHpA = avgMaxHpA / Math.max(1, A.length);
    }
    // drain is drainPerSec * (avgMaxHp / 3000) per second = small fraction per tick
    const drainPerTick = drainPerSec > 0 ? drainPerSec * (avgMaxHpA / 3000) * TICK : 0;

    const living = arr => arr.filter(f => f.alive);

    function hit(src, dst, factor, tag) {
      let dmg = src.atk * factor * (0.9 + rng() * 0.2);
      dmg *= CC.mut.elementMult(src.element, dst.element);
      if (dst.trait === 'guardian') dmg *= 0.75;
      dst.hp -= dmg;
      events.push({ t, type: 'hit', from: src.side + ':' + src.slot, to: dst.side + ':' + dst.slot, dmg, tag: tag || null });

      if (src.trait === 'vampire') {
        const heal = Math.min(dmg * 0.25, src.maxHp - src.hp);
        if (heal > 0) { src.hp += heal; events.push({ t, type: 'heal', to: src.side + ':' + src.slot, amount: heal }); }
      }
      if (dst.trait === 'thorns' && dst.hp > 0) {
        const back = dmg * 0.25;
        src.hp -= back;
        events.push({ t, type: 'hit', from: dst.side + ':' + dst.slot, to: src.side + ':' + src.slot, dmg: back, tag: 'thorns' });
        checkDeath(src);
      }
      if (src.trait === 'venom') { dst.poison = src.atk * 0.18; dst.poisonT = 3; }
      checkDeath(dst);
    }

    function checkDeath(f) {
      if (!f.alive || f.hp > 0) return;
      if (f.trait === 'phoenix' && !f.revived) {
        f.revived = true;
        f.hp = f.maxHp * 0.5;
        events.push({ t, type: 'revive', to: f.side + ':' + f.slot });
        return;
      }
      f.alive = false; f.hp = 0;
      events.push({ t, type: 'death', to: f.side + ':' + f.slot });
    }

    while (t < MAX_TIME && living(A).length && living(B).length) {
      // Offline drain on side A (attacker)
      if (drainPerTick > 0) {
        for (const f of A) {
          if (!f.alive) continue;
          f.hp -= drainPerTick;
          if (f.hp <= 0) checkDeath(f);
        }
        // Emit a drain event every full second for visual feedback
        if (Math.abs(t - Math.round(t)) < TICK * 0.6 && t > 0) {
          for (const f of A) {
            if (!f.alive) continue;
            events.push({ t, type: 'drain', to: f.side + ':' + f.slot, dmg: drainPerSec * (avgMaxHpA / 3000) });
          }
        }
      }

      for (const f of A.concat(B)) {
        if (!f.alive) continue;
        if (f.poisonT > 0) {
          f.poisonT -= TICK;
          f.hp -= f.poison * TICK;
          if (f.hp <= 0) checkDeath(f);
          if (!f.alive) continue;
        }
        f.cd -= TICK * f.spd;
        if (f.cd > 0) continue;
        f.cd += 1.0;
        const foes = living(f.side === 0 ? B : A);
        if (!foes.length) break;
        const target = foes[Math.floor(rng() * foes.length)];
        hit(f, target, 1, null);
        if (f.trait === 'twin' && rng() < 0.30 && target.alive) hit(f, target, 0.7, 'twin');
      }
      t = Math.round((t + TICK) * 10) / 10;
    }

    const aAlive = living(A).length, bAlive = living(B).length;
    let winner;
    if (aAlive && !bAlive) winner = 0;
    else if (bAlive && !aAlive) winner = 1;
    else {
      const fa = A.reduce((s, f) => s + f.hp / f.maxHp, 0);
      const fb = B.reduce((s, f) => s + f.hp / f.maxHp, 0);
      winner = fa >= fb ? 0 : 1;
    }
    return { winner, events, a: A, b: B, duration: t };
  }

  /** Stable seed so both players resolve an identical fight. */
  function battleSeed(codeA, codeB, salt) {
    const str = String(codeA) + '|' + String(codeB) + '|' + (salt || 0);
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  /* ---------------------------------------------------------
     Ladder bookkeeping
     --------------------------------------------------------- */
  function todayKey() {
    const d = new Date();
    return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
  }

  function applyResult(g, won, myPR, oppPR) {
    const a = g.arena;
    if (a.day !== todayKey()) { a.day = todayKey(); a.gemsToday = 0; }
    const edge = U.clamp((oppPR - myPR) / Math.max(1, myPR) * 100, -60, 60);
    let delta;
    if (won) {
      delta = Math.round(U.clamp(16 + edge * 0.6, 6, 45));
      a.wins++; a.trophies += delta;
      a.streak = (a.streak || 0) + 1;
    } else {
      delta = -Math.round(U.clamp(12 - edge * 0.4, 3, 25));
      a.losses++;
      a.trophies = Math.max(0, a.trophies + delta);
      a.streak = 0;
    }
    a.best = Math.max(a.best || 0, a.trophies);
    let gems = 0;
    if (won && (a.gemsToday || 0) < 60) {
      gems = Math.min(60 - (a.gemsToday || 0), 6 + Math.floor(a.trophies / 250));
      a.gemsToday = (a.gemsToday || 0) + gems;
      g.gems += gems;
    }
    return { delta, gems, streak: a.streak };
  }

  function rankOf(trophies) {
    const t = trophies | 0;
    if (t >= 4000) return { id: 'mythic', icon: '🌌', name: { ar: 'خرافي', en: 'Mythic' }, color: '#ff6bd6' };
    if (t >= 2500) return { id: 'master', icon: '👑', name: { ar: 'أستاذ', en: 'Master' }, color: '#ffc23c' };
    if (t >= 1500) return { id: 'diamond', icon: '💎', name: { ar: 'ماسي', en: 'Diamond' }, color: '#4dd0ff' };
    if (t >= 800)  return { id: 'gold', icon: '🥇', name: { ar: 'ذهبي', en: 'Gold' }, color: '#ffd43b' };
    if (t >= 300)  return { id: 'silver', icon: '🥈', name: { ar: 'فضي', en: 'Silver' }, color: '#ced4da' };
    return { id: 'bronze', icon: '🥉', name: { ar: 'برونزي', en: 'Bronze' }, color: '#e8a87c' };
  }

  CC.arena = {
    TEAM_SIZE, myTeam, unitFrom, powerRating, encodeTeam, decodeTeam,
    generateRival, rivalSlate, simulate, battleSeed, applyResult, rankOf, botName,
    tapDamageOf, offlineDrainPerSec
  };
})(window);
