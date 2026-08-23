/* ============================================================
   Critter Clash Idle — Arena view + battle playback + Mutation Lab
   ============================================================ */
(function (global) {
  'use strict';
  const CC = global.CC || (global.CC = {});
  const U = CC.util, D = CC.D, DATA = CC.data, T = CC.i18n, SP = CC.sprites;
  const MUT = CC.mut, AR = CC.arena;

  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.prototype.slice.call((r || document).querySelectorAll(s));

  let g = null;
  let rivals = null, rivalSalt = 0;
  const iconCache = {};

  function unitIcon(unit, px) {
    const key = unit.id + '_' + (unit.mut ? unit.mut.seed + '_' + unit.mut.rarity : 'base') + '_' + (px || 64);
    if (!iconCache[key]) {
      try { iconCache[key] = SP.iconDataURL(MUT.spriteSpec(unit.def, unit.mut), px || 64); }
      catch (e) { iconCache[key] = ''; }
    }
    return iconCache[key];
  }

  /* =========================================================
     Arena view
     ========================================================= */
  function buildArena() {
    if (!g) return;
    $('#rivals-title').textContent = T.t('rivals_title');
    $('#lbl-trophies').textContent = T.t('trophies');
    $('#lbl-pr').textContent = T.t('power_rating');
    $('#arena-copy').textContent = T.t('my_team_code');
    $('#arena-friend').textContent = T.t('fight_friend');
    if (!rivals) rivals = AR.rivalSlate(g, rivalSalt);
    renderMyTeam();
    renderRivals();
    updateArena();
  }

  function renderMyTeam() {
    const host = $('#arena-myteam');
    const team = AR.myTeam(g);
    host.innerHTML = '';
    for (let i = 0; i < AR.TEAM_SIZE; i++) {
      const el = document.createElement('div');
      const u = team[i];
      if (!u) {
        el.className = 'teamslot empty';
        el.textContent = '+';
      } else {
        el.className = 'teamslot' + (u.mut ? ' r' + u.mut.rarity : '');
        const el2 = MUT.ELEMENTS[u.mut ? u.mut.element : (u.tier % 4)];
        el.innerHTML = '<img alt="" src="' + unitIcon(u, 96) + '">' +
          '<span class="el">' + el2.icon + '</span>' +
          '<span class="lv">' + T.t('level_short') + ' ' + u.level + '</span>';
      }
      host.appendChild(el);
    }
  }

  function renderRivals() {
    const host = $('#rival-list');
    host.innerHTML = '';
    const myPR = AR.powerRating(AR.myTeam(g));
    const labels = ['rival_easy', 'rival_even', 'rival_hard'];
    rivals.forEach((r, i) => {
      const pr = AR.powerRating(r.team);
      const el = document.createElement('div');
      el.className = 'rival' + (i === 0 ? ' easy' : i === 2 ? ' hard' : '');
      const imgs = r.team.slice(0, 5).map(u => '<img alt="" src="' + unitIcon(u, 48) + '">').join('');
      el.innerHTML =
        '<div class="rteam">' + imgs + '</div>' +
        '<div class="rinfo"><div class="rname">' + r.name + '</div>' +
        '<div class="rpr">' + T.t(labels[i]) + ' · ' + T.t('power_rating') + ' <b>' + pr + '</b></div></div>' +
        '<button class="fight">' + T.t('fight') + '</button>';
      $('.fight', el).onclick = () => {
        if (!AR.myTeam(g).length) { CC.ui.toast(T.t('need_team'), 'bad'); return; }
        openBattle(r, AR.battleSeed(myPR, pr, rivalSalt * 7 + i));
      };
      host.appendChild(el);
    });
  }

  function updateArena() {
    if (!g) return;
    const a = g.arena;
    const rank = AR.rankOf(a.trophies);
    const badge = $('#arena-rank');
    $('span', badge).textContent = rank.icon;
    $('em', badge).textContent = T.tl(rank.name);
    badge.style.color = rank.color;
    $('#arena-trophies').textContent = U.fmt(a.trophies);
    $('#arena-pr').textContent = AR.powerRating(AR.myTeam(g));
    $('#arena-record').innerHTML =
      '<span>' + T.t('record') + '</span><span class="v">' +
      T.t('wins') + ' ' + a.wins + ' · ' + T.t('losses') + ' ' + a.losses +
      (a.streak ? ' · ' + T.t('streak') + ' 🔥' + a.streak : '') + '</span>';
  }

  /* =========================================================
     Battle screen
     ========================================================= */
  let battle = null;

  function openBattle(opp, seed) {
    const mine = AR.myTeam(g);
    if (!mine.length) { CC.ui.toast(T.t('need_team'), 'bad'); return; }
    const res = AR.simulate(mine, opp.team, seed);
    const myPR = AR.powerRating(mine), oppPR = AR.powerRating(opp.team);

    const el = document.createElement('div');
    el.className = 'battle-screen';
    el.innerHTML =
      '<div class="battle-top">' +
        '<div class="side a"><div class="nm">' + (g.playerName || T.t('you')) + '</div>' +
        '<div class="pw">' + T.t('power_rating') + ' ' + myPR + '</div></div>' +
        '<div class="vs">VS</div>' +
        '<div class="side b"><div class="nm">' + opp.name + '</div>' +
        '<div class="pw">' + T.t('power_rating') + ' ' + oppPR + '</div></div>' +
      '</div>' +
      '<canvas id="battle-canvas"></canvas>' +
      '<div class="battle-result"><div class="big"></div><div class="sub"></div></div>' +
      '<div class="battle-bottom"><button class="btn ghost" data-skip>' + T.t('skip') + '</button></div>';
    document.body.appendChild(el);

    const canvas = $('#battle-canvas', el);
    const ctx = canvas.getContext('2d');

    battle = {
      el, canvas, ctx, res, opp, mine, myPR, oppPR,
      A: res.a.map(f => ({ f, hp: f.maxHp, shown: f.maxHp, lunge: 0, dead: false, flash: 0 })),
      B: res.b.map(f => ({ f, hp: f.maxHp, shown: f.maxHp, lunge: 0, dead: false, flash: 0 })),
      nums: [], t: 0, idx: 0, done: false, speed: Math.max(1.1, res.duration / 7),
      raf: 0, rewarded: false
    };
    sizeBattle();
    global.addEventListener('resize', sizeBattle);

    $('[data-skip]', el).onclick = () => finishBattle(true);
    battle.raf = requestAnimationFrame(battleFrame);
    battle.last = performance.now();
    CC.audio.play('boss');
  }

  function sizeBattle() {
    if (!battle) return;
    const c = battle.canvas;
    const r = c.getBoundingClientRect();
    const dpr = Math.min(2, global.devicePixelRatio || 1);
    c.width = Math.max(200, Math.round(r.width * dpr));
    c.height = Math.max(200, Math.round(r.height * dpr));
    battle.w = r.width; battle.h = r.height;
    battle.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function slotPos(side, i) {
    const w = battle.w, h = battle.h;
    const y = h * (0.13 + i * 0.178);
    const stagger = (i % 2) * 0.085;
    const x = side === 0 ? w * (0.23 + stagger) : w * (0.77 - stagger);
    return { x, y };
  }

  function fighterView(key) {
    const [side, slot] = key.split(':').map(Number);
    return (side === 0 ? battle.A : battle.B)[slot];
  }

  function battleFrame(ts) {
    if (!battle) return;
    battle.raf = requestAnimationFrame(battleFrame);
    const dt = Math.min(0.05, (ts - battle.last) / 1000);
    battle.last = ts;
    battle.t += dt * battle.speed;

    /* consume events up to the current playback time */
    const ev = battle.res.events;
    while (battle.idx < ev.length && ev[battle.idx].t <= battle.t) {
      applyEvent(ev[battle.idx++]);
    }
    if (battle.idx >= ev.length && !battle.done) finishBattle(false);

    /* animate */
    for (const v of battle.A.concat(battle.B)) {
      v.shown = U.lerp(v.shown, v.hp, Math.min(1, dt * 9));
      v.lunge = Math.max(0, v.lunge - dt * 3.4);
      v.flash = Math.max(0, v.flash - dt * 3.4);
    }
    for (let i = battle.nums.length - 1; i >= 0; i--) {
      const n = battle.nums[i];
      n.life += dt;
      if (n.life > 0.9) { battle.nums.splice(i, 1); continue; }
      n.y -= dt * 42;
    }
    drawBattle();
  }

  function applyEvent(e) {
    if (e.type === 'hit') {
      const dst = fighterView(e.to);
      const src = e.from ? fighterView(e.from) : null;
      if (src) src.lunge = 1;
      dst.hp = Math.max(0, dst.hp - e.dmg);
      dst.flash = 1;
      const p = slotPos(dst.f.side, dst.f.slot);
      battle.nums.push({
        x: p.x + U.rand(-14, 14), y: p.y - 26, life: 0,
        text: U.fmt(Math.round(e.dmg)),
        color: e.tag === 'thorns' ? '#c6ff5e' : e.tag === 'twin' ? '#ffd43b' : '#ffffff'
      });
      if (!g.reduceFx) CC.audio.play('tap');
    } else if (e.type === 'heal') {
      const dst = fighterView(e.to);
      dst.hp = Math.min(dst.f.maxHp, dst.hp + e.amount);
      const p = slotPos(dst.f.side, dst.f.slot);
      battle.nums.push({ x: p.x, y: p.y - 26, life: 0, text: '+' + U.fmt(Math.round(e.amount)), color: '#48d597' });
    } else if (e.type === 'death') {
      const dst = fighterView(e.to);
      dst.dead = true; dst.hp = 0;
      CC.audio.play('kill');
    } else if (e.type === 'revive') {
      const dst = fighterView(e.to);
      dst.dead = false; dst.hp = dst.f.maxHp * 0.5;
      const p = slotPos(dst.f.side, dst.f.slot);
      battle.nums.push({ x: p.x, y: p.y - 30, life: 0, text: '🕊️', color: '#ffd43b' });
      CC.audio.play('achieve');
    }
  }

  function drawBattle() {
    const ctx = battle.ctx, w = battle.w, h = battle.h, t = battle.t;
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#1a1338');
    sky.addColorStop(1, '#07060f');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);

    /* arena floor */
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 9; i++) {
      const y = h * (0.12 + i * 0.1);
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(255,93,108,0.16)';
    ctx.beginPath(); ctx.moveTo(w / 2, 0); ctx.lineTo(w / 2, h); ctx.stroke();

    const all = battle.A.map(v => ({ v, side: 0 })).concat(battle.B.map(v => ({ v, side: 1 })));
    for (const { v, side } of all) {
      const p = slotPos(side, v.f.slot);
      const size = Math.min(w, h) * 0.075;
      const dir = side === 0 ? 1 : -1;
      const x = p.x + U.easeOut(v.lunge) * size * 1.1 * dir;
      const spec = MUT.spriteSpec(v.f.unit.def, v.f.unit.mut);

      ctx.save();
      /* the renderer owns globalAlpha, so fading a corpse goes through `dying` */
      SP.drawCreature(ctx, spec, x, p.y + (v.dead ? size * 0.35 : 0), size, t + v.f.slot, {
        hit: v.flash, look: { x: dir * 0.7, y: 0 }, flip: side === 1,
        punch: v.lunge > 0.5, dying: v.dead ? 0.78 : 0
      });
      ctx.restore();

      /* hp bar */
      const bw = size * 1.9, bh = 6;
      const bx = x - bw / 2, by = p.y - size * 1.55;
      ctx.fillStyle = 'rgba(0,0,0,.55)';
      ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 3); ctx.fill();
      const frac = Math.max(0, Math.min(1, v.shown / v.f.maxHp));
      if (frac > 0.001) {
        ctx.fillStyle = v.dead ? '#3a3358' : side === 0 ? '#48d597' : '#ff5d6c';
        ctx.beginPath(); ctx.roundRect(bx, by, bw * frac, bh, 3); ctx.fill();
      }

      /* element pip */
      const el = MUT.ELEMENTS[v.f.element];
      ctx.font = '11px system-ui'; ctx.textAlign = 'center';
      ctx.fillText(el.icon, x, by - 4);
    }

    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const n of battle.nums) {
      const a = 1 - n.life / 0.9;
      ctx.globalAlpha = a;
      ctx.font = '800 14px "Baloo 2", system-ui, sans-serif';
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.6)';
      ctx.strokeText(n.text, n.x, n.y);
      ctx.fillStyle = n.color;
      ctx.fillText(n.text, n.x, n.y);
    }
    ctx.globalAlpha = 1;
  }

  function finishBattle(skipped) {
    if (!battle || battle.done) return;
    battle.done = true;
    if (skipped) {
      /* fast-forward: apply every remaining event at once */
      const ev = battle.res.events;
      while (battle.idx < ev.length) applyEvent(ev[battle.idx++]);
      for (const v of battle.A.concat(battle.B)) v.shown = v.hp;
      drawBattle();
    }

    const won = battle.res.winner === 0;
    const r = AR.applyResult(g, won, battle.myPR, battle.oppPR);
    CC.state.save(g, true);

    const box = $('.battle-result', battle.el);
    box.classList.add('show', won ? 'win' : 'lose');
    $('.big', box).textContent = won ? T.t('victory') : T.t('defeat');
    $('.sub', box).textContent = '🏆 ' + (r.delta > 0 ? '+' : '') + r.delta +
      (r.gems ? '   💎 +' + r.gems : '');
    CC.audio.play(won ? 'prestige' : 'error');

    const bottom = $('.battle-bottom', battle.el);
    bottom.innerHTML =
      '<button class="btn ghost" data-back>' + T.t('back_to_arena') + '</button>' +
      '<button class="btn gold" data-again>' + T.t('battle_again') + '</button>';
    $('[data-back]', bottom).onclick = closeBattle;
    $('[data-again]', bottom).onclick = () => {
      const opp = battle.opp;
      closeBattle();
      rivalSalt++;
      rivals = AR.rivalSlate(g, rivalSalt);
      renderRivals();
      openBattle(opp.generated ? AR.generateRival(g, rivalSalt * 13 + 5, opp.difficulty || 1) : opp,
        AR.battleSeed(battle ? 0 : 1, rivalSalt, Date.now() & 0xffff));
    };
  }

  function closeBattle() {
    if (!battle) return;
    cancelAnimationFrame(battle.raf);
    global.removeEventListener('resize', sizeBattle);
    battle.el.remove();
    battle = null;
    renderMyTeam();
    renderRivals();
    updateArena();
    CC.ui.updateHud();
  }

  /* =========================================================
     Friend codes
     ========================================================= */
  function copyMyCode() {
    if (!AR.myTeam(g).length) { CC.ui.toast(T.t('need_team'), 'bad'); return; }
    const code = AR.encodeTeam(g, g.playerName);
    const m = CC.ui.modal(
      '<div class="big-ico">📋</div><h3>' + T.t('my_team_code') + '</h3>' +
      '<p>' + T.t('code_copied') + '</p>' +
      '<textarea class="savebox" readonly>' + code + '</textarea>' +
      '<div class="btns"><button class="btn ghost" data-copy>' + T.t('copied') + '</button>' +
      '<button class="btn gold" data-close>' + T.t('close') + '</button></div>');
    const ta = $('textarea', m);
    try { ta.select(); document.execCommand('copy'); } catch (e) { /* ignore */ }
    $('[data-copy]', m).onclick = () => {
      try { ta.select(); document.execCommand('copy'); CC.ui.toast(T.t('copied'), 'good'); } catch (e) { /* ignore */ }
    };
    $('[data-close]', m).onclick = () => CC.ui.closeModal(m);
  }

  function fightFriend() {
    const m = CC.ui.modal(
      '<div class="big-ico">⚔️</div><h3>' + T.t('fight_friend') + '</h3>' +
      '<p>' + T.t('paste_code') + '</p>' +
      '<textarea class="savebox"></textarea>' +
      '<div class="btns"><button class="btn ghost" data-close>' + T.t('cancel') + '</button>' +
      '<button class="btn gold" data-ok>' + T.t('fight') + '</button></div>');
    $('[data-close]', m).onclick = () => CC.ui.closeModal(m);
    $('[data-ok]', m).onclick = () => {
      const code = $('textarea', m).value;
      let opp;
      try { opp = AR.decodeTeam(code); }
      catch (e) { CC.ui.toast(T.t('bad_code'), 'bad'); return; }
      CC.ui.closeModal(m);
      const mine = AR.encodeTeam(g, g.playerName);
      /* both players hash the same pair of codes, so both see the same fight */
      const seed = AR.battleSeed(mine < code ? mine : code, mine < code ? code : mine, 0);
      openBattle(opp, seed);
    };
  }

  /* =========================================================
     Mutation Lab
     ========================================================= */
  function mutCardHTML(def, mut, labelKey, isNew) {
    const rar = MUT.rarityOf(mut);
    const trait = MUT.traitOf(mut);
    const el = mut ? MUT.ELEMENTS[mut.element] : null;
    const img = SP.iconDataURL(MUT.spriteSpec(def, mut), 128);
    return '<div class="mut-card' + (isNew ? ' new rar-flash' : '') + '">' +
      '<div class="lbl">' + T.t(labelKey) + '</div>' +
      '<img alt="" src="' + img + '">' +
      '<div class="rar" style="color:' + (mut ? rar.color : '#8b83b5') + '">' +
        (mut ? T.tl(rar.name) : T.t('no_mutation')) + '</div>' +
      '<div class="tr">' + (trait ? trait.icon + ' ' + T.tl(trait.name) : '—') + '</div>' +
      (el ? '<div class="elem-chip">' + el.icon + ' ' + T.tl(el.name) + '</div>' : '') +
      '<div class="mm">×' + (mut ? MUT.dpsMult(mut).toFixed(2) : '1.00') + '</div>' +
      '</div>';
  }

  function openMutation(def) {
    const cur = g.mutations[def.id] || null;
    const price = MUT.cost(g, def.id);
    const m = CC.ui.modal(
      '<div class="big-ico">🧬</div><h3>' + T.t('mut_lab') + '</h3>' +
      '<p>' + T.t('mut_intro') + '</p>' +
      '<div class="mut-compare">' + mutCardHTML(def, cur, 'current', false) + '</div>' +
      '<div class="btns">' +
        '<button class="btn ghost" data-close>' + T.t('close') + '</button>' +
        '<button class="btn gold" data-roll>💎 ' + price + ' · ' + T.t('mutate') + '</button>' +
      '</div>' +
      '<div class="mut-hint">' + T.tl({ ar: 'الطفرات دائمة ولا تختفي عند البعث.', en: 'Mutations are permanent and survive prestige.' }) + '</div>');

    $('[data-close]', m).onclick = () => CC.ui.closeModal(m);
    $('[data-roll]', m).onclick = () => {
      const p = MUT.cost(g, def.id);
      if (g.gems < p) { CC.ui.toast(T.t('need_gems'), 'bad'); CC.audio.play('error'); return; }
      g.gems -= p;
      g.mutRolls[def.id] = (g.mutRolls[def.id] || 0) + 1;
      const rolled = MUT.roll();
      CC.audio.play(rolled.rarity >= 3 ? 'prestige' : 'chest');
      CC.ui.flashRes('gems');

      $('.mut-compare', m).innerHTML =
        mutCardHTML(def, cur, 'current', false) + mutCardHTML(def, rolled, 'new_roll', true);
      $('.btns', m).innerHTML =
        '<button class="btn ghost" data-keepold>' + T.t('keep_current') + '</button>' +
        '<button class="btn gold" data-keepnew>' + T.t('keep_new') + '</button>';

      const done = () => {
        CC.state.save(g, true);
        CC.ui.closeModal(m);
        CC.ui.refreshLists(true);
        CC.ui.updateHud();
        renderMyTeam();
      };
      $('[data-keepold]', m).onclick = done;
      $('[data-keepnew]', m).onclick = () => {
        g.mutations[def.id] = rolled;
        CC.ui.toast(T.t('mut_kept'), 'good');
        done();
      };
    };
  }

  /* =========================================================
     Wiring
     ========================================================= */
  function init(state) {
    g = state;
    $('#arena-copy').onclick = copyMyCode;
    $('#arena-friend').onclick = fightFriend;
    $('#arena-reroll').onclick = () => {
      rivalSalt++;
      rivals = AR.rivalSlate(g, rivalSalt);
      renderRivals();
      CC.audio.play('buy');
    };
  }

  CC.views = { init, buildArena, updateArena, renderMyTeam, renderRivals, openMutation, openBattle, closeBattle };
})(window);
