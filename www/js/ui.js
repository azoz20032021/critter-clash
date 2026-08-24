/* ============================================================
   Critter Clash Idle — user interface
   ============================================================ */
(function (global) {
  'use strict';
  const CC = global.CC || (global.CC = {});
  const U = CC.util, DATA = CC.data, S = CC.state, T = CC.i18n, D = CC.D;

  const ui = { g: null, view: 'battle', moreTab: 'ach', els: {}, built: false, lastList: 0, lastHud: 0 };
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.prototype.slice.call((r || document).querySelectorAll(s));

  /* =========================================================
     Toast
     ========================================================= */
  function toast(msg, kind) {
    const box = $('#toasts');
    if (!box) return;
    while (box.children.length > 2) box.firstChild.remove();
    const el = document.createElement('div');
    el.className = 'toast' + (kind ? ' ' + kind : '');
    el.textContent = msg;
    box.appendChild(el);
    setTimeout(() => el.remove(), 2300);
  }

  /* =========================================================
     Modals
     ========================================================= */
  function modal(html, opts) {
    opts = opts || {};
    const bg = document.createElement('div');
    bg.className = 'modal-bg';
    bg.innerHTML = '<div class="modal">' + html + '</div>';
    $('#modals').appendChild(bg);
    if (!opts.sticky) {
      bg.addEventListener('click', e => { if (e.target === bg) bg.remove(); });
    }
    return bg;
  }
  function closeModal(el) { if (el && el.parentNode) el.remove(); }

  function confirmBox(text, onYes) {
    const m = modal(
      '<div class="big-ico">⚠️</div><p>' + text + '</p>' +
      '<div class="btns"><button class="btn ghost" data-no>' + T.t('cancel') + '</button>' +
      '<button class="btn danger" data-yes>' + T.t('confirm') + '</button></div>');
    $('[data-no]', m).onclick = () => closeModal(m);
    $('[data-yes]', m).onclick = () => { closeModal(m); onYes(); };
  }

  /* =========================================================
     Build static shell text
     ========================================================= */
  function applyStaticText() {
    const g = ui.g;
    document.title = T.getLang() === 'ar' ? 'صدام المخلوقات' : 'Critter Clash';
    const tabs = { battle: 'tab_battle', critters: 'tab_critters', upgrades: 'tab_upgrades', prestige: 'tab_prestige', arena: 'tab_arena', more: 'tab_more' };
    $$('#tabs .tab').forEach(b => { $('em', b).textContent = T.t(tabs[b.dataset.view]); });
    $('#critters-title').textContent = T.t('critters_title');
    $('#upgrades-title').textContent = T.t('upgrades_title');
    $('#prestige-title').textContent = T.t('prestige_title');
    $('#prestige-desc').textContent = T.t('prestige_desc');
    $('#relics-title').textContent = T.t('relics_title');
    $('#relics-desc').textContent = T.t('relics_desc');
    $('#lbl-souls').textContent = T.t('souls');
    $('#lbl-pcount').textContent = T.t('prestige_count');
    $('#lbl-sbonus').textContent = T.t('soul_bonus');
    $('#dps-lbl').textContent = T.t('dps');
    buildBuyMode();
    buildCritterList();
    buildUpgradeList();
    buildRelicList();
    buildSkillBar();
    buildMore();
  }

  /* =========================================================
     Buy-mode selector
     ========================================================= */
  function buildBuyMode() {
    const modes = [[1, 'buy_1'], [10, 'buy_10'], [100, 'buy_100'], ['max', 'buy_max']];
    ['#buymode', '#buymode2'].forEach(sel => {
      const host = $(sel);
      host.innerHTML = '';
      modes.forEach(([m, key]) => {
        const b = document.createElement('button');
        b.textContent = T.t(key);
        b.className = ui.g.buyMode === m ? 'on' : '';
        b.onclick = () => { ui.g.buyMode = m; buildBuyMode(); refreshLists(true); };
        host.appendChild(b);
      });
    });
  }

  /* =========================================================
     Critters
     ========================================================= */
  const critterIcons = {};
  function critterIcon(def, mut) {
    const key = def.id + (mut ? '_' + mut.seed : '');
    if (!critterIcons[key]) {
      try {
        const spec = CC.mut ? CC.mut.spriteSpec(def, mut) : CC.sprites.critterSpec(def);
        critterIcons[key] = CC.sprites.iconDataURL(spec, 96);
      } catch (e) { critterIcons[key] = ''; }
    }
    return critterIcons[key];
  }

  function buildCritterList() {
    const g = ui.g;
    const host = $('#critter-list');
    host.innerHTML = '';
    ui.critterTier = DATA.highestUnlockedTier(g.bestStage);
    DATA.critterList(g.bestStage, g.critters).forEach(def => {
      const el = document.createElement('div');
      el.className = 'card';
      el.dataset.id = def.id;
      el.innerHTML =
        '<div class="art"><img alt="" src="' + critterIcon(def) + '"></div>' +
        '<div class="info">' +
          '<div class="nm"><span class="c-nm"></span><i class="c-lv"></i></div>' +
          '<div class="ds c-ds"></div>' +
          '<div class="ms c-ms"></div>' +
          '<div class="mini"><i></i></div>' +
        '</div>' +
        '<button class="mut-btn" hidden>🧬</button>' +
        '<button class="buy"><span class="b1"></span><span class="b2"></span></button>';
      $('.buy', el).onclick = () => {
        if (CC.game.buyCritter(def.id)) { refreshLists(true); flashRes('gold'); }
        else toast(T.t('not_enough'), 'bad');
      };
      $('.mut-btn', el).onclick = () => { if (CC.views) CC.views.openMutation(def); };
      host.appendChild(el);
    });
  }

  function updateCritterList() {
    const g = ui.g;
    if (ui.critterTier !== DATA.highestUnlockedTier(g.bestStage)) buildCritterList();
    $$('#critter-list .card').forEach(el => {
      const def = DATA.critterById(el.dataset.id);
      if (!def) return;
      const lv = g.critters[def.id] || 0;
      const mut = g.mutations[def.id];
      const unlocked = g.bestStage >= def.unlock;
      el.classList.toggle('locked', !unlocked);
      $('.c-nm', el).textContent = T.tl(def.name);
      $('.c-lv', el).textContent = lv > 0 ? T.t('level_short') + ' ' + lv : '';
      const total = D(def.baseDps).mul(lv * DATA.critterMilestoneMult(lv));
      $('.c-ds', el).textContent = unlocked
        ? (lv > 0 ? U.fmt(total) + ' ' + T.t('dps') : T.tl(def.desc))
        : T.t('locked_at') + ' ' + def.unlock;

      if (mut) {
        const rar = CC.mut.rarityOf(mut), tr = CC.mut.traitOf(mut);
        const elx = CC.mut.ELEMENTS[mut.element];
        $('.c-ds', el).innerHTML =
          '<span style="color:' + rar.color + ';font-weight:800">' + T.tl(rar.name) + '</span> · ' +
          (tr ? tr.icon + ' ' + T.tl(tr.name) : '') + ' · ' + elx.icon +
          '  <span style="color:var(--green)">×' + CC.mut.dpsMult(mut).toFixed(2) + '</span>';
      }
      const nm = DATA.nextMilestone(lv);
      const ms = $('.c-ms', el);
      const bar = $('.mini i', el);
      if (unlocked && nm) {
        ms.textContent = T.t('next_milestone') + ' ' + T.t('level_short') + ' ' + nm + ' → ×2';
        const prev = (function () { let p = 0; for (const x of DATA.MILESTONES) { if (x <= lv) p = x; } return p; })();
        bar.style.width = U.clamp(((lv - prev) / (nm - prev)) * 100, 0, 100) + '%';
        ms.parentNode.querySelector('.mini').style.display = '';
      } else {
        ms.textContent = unlocked ? T.t('maxed') : '';
        ms.parentNode.querySelector('.mini').style.display = 'none';
      }

      const img = $('.art img', el);
      const wanted = critterIcon(def, mut);
      if (img && img.getAttribute('src') !== wanted) img.src = wanted;
      const mb = $('.mut-btn', el);
      mb.hidden = lv <= 0;
      mb.classList.toggle('has', !!mut);

      const btn = $('.buy', el);
      const mode = g.buyMode;
      const n = mode === 'max'
        ? Math.max(1, D.maxAffordable(def.baseCost, def.costMult, lv, g.gold))
        : mode;
      const cost = D.bulkCost(def.baseCost, def.costMult, lv, n);
      const can = unlocked && cost.lte(g.gold);
      btn.disabled = !can;
      $('.b1', btn).textContent = (lv > 0 ? '+' : T.t('hire') + ' ') + n;
      $('.b2', btn).textContent = '🪙 ' + U.fmt(cost);
    });
  }

  /* =========================================================
     Upgrades
     ========================================================= */
  function buildUpgradeList() {
    const host = $('#upgrade-list');
    host.innerHTML = '';
    DATA.UPGRADES.forEach(def => {
      const el = document.createElement('div');
      el.className = 'card';
      el.dataset.id = def.id;
      el.innerHTML =
        '<div class="art">' + def.icon + '</div>' +
        '<div class="info">' +
          '<div class="nm"><span class="c-nm"></span><i class="c-lv"></i></div>' +
          '<div class="ds c-ds"></div>' +
          '<div class="mini"><i></i></div>' +
        '</div>' +
        '<button class="buy"><span class="b1"></span><span class="b2"></span></button>';
      $('.buy', el).onclick = () => {
        if (CC.game.buyUpgrade(def.id)) { refreshLists(true); flashRes('gold'); }
        else toast(T.t('not_enough'), 'bad');
      };
      host.appendChild(el);
    });

    /* skills panel lives under the upgrades list */
    const sk = document.createElement('div');
    sk.className = 'view-head';
    sk.style.marginTop = '14px';
    sk.innerHTML = '<h2>' + T.t('skills_title') + '</h2>';
    host.appendChild(sk);
    const skl = document.createElement('div');
    skl.className = 'list';
    skl.id = 'skill-list';
    host.appendChild(skl);
    DATA.SKILLS.forEach(def => {
      const el = document.createElement('div');
      el.className = 'card';
      el.dataset.id = def.id;
      el.innerHTML =
        '<div class="art">' + def.icon + '</div>' +
        '<div class="info"><div class="nm"><span class="s-nm"></span></div>' +
        '<div class="ds s-ds"></div></div>' +
        '<div class="buy s-st" style="pointer-events:none"></div>';
      skl.appendChild(el);
    });
  }

  function updateUpgradeList() {
    const g = ui.g;
    $$('#upgrade-list > .card').forEach(el => {
      const def = DATA.UPGRADES.find(u => u.id === el.dataset.id);
      if (!def) return;
      const lv = g.upgrades[def.id] || 0;
      $('.c-nm', el).textContent = T.tl(def.name);
      $('.c-lv', el).textContent = lv > 0 ? T.t('level_short') + ' ' + lv + '/' + def.max : '';
      const shown = lv > 0 ? def.effect * lv : def.effect;
      $('.c-ds', el).textContent = T.tl(def.desc).replace('{v}', U.fmt(shown, 0));
      $('.mini i', el).style.width = (lv / def.max * 100) + '%';
      const btn = $('.buy', el);
      const maxed = lv >= def.max;
      const n = maxed ? 0 : (g.buyMode === 'max'
        ? Math.max(1, D.maxAffordable(def.baseCost, def.costMult, lv, g.gold, def.max - lv))
        : Math.min(g.buyMode, def.max - lv));
      const cost = D.bulkCost(def.baseCost, def.costMult, lv, n);
      btn.disabled = maxed || cost.gt(g.gold);
      $('.b1', btn).textContent = maxed ? '' : '+' + n;
      $('.b2', btn).textContent = maxed ? T.t('maxed') : '🪙 ' + U.fmt(cost);
    });

    const t = Date.now();
    $$('#skill-list .card').forEach(el => {
      const def = S.skillDef(el.dataset.id);
      const unlocked = CC.game.skillUnlocked(def.id);
      el.classList.toggle('locked', !unlocked);
      $('.s-nm', el).textContent = T.tl(def.name);
      $('.s-ds', el).textContent = unlocked
        ? T.tl(def.desc).replace('{m}', def.mult).replace('{d}', def.dur)
        : T.t('locked_at') + ' ' + def.unlock;
      const st = g.skills[def.id] || {};
      const stEl = $('.s-st', el);
      if (!unlocked) stEl.textContent = '🔒';
      else if (st.activeEnd > t) stEl.textContent = T.t('active');
      else if (st.cdEnd > t) stEl.textContent = U.fmtClock((st.cdEnd - t) / 1000);
      else stEl.textContent = T.t('ready');
    });
  }

  /* =========================================================
     Relics
     ========================================================= */
  function buildRelicList() {
    const host = $('#relic-list');
    host.innerHTML = '';
    DATA.RELICS.forEach(def => {
      const el = document.createElement('div');
      el.className = 'card';
      el.dataset.id = def.id;
      el.innerHTML =
        '<div class="art">' + def.icon + '</div>' +
        '<div class="info"><div class="nm"><span class="c-nm"></span><i class="c-lv"></i></div>' +
        '<div class="ds c-ds"></div><div class="mini"><i></i></div></div>' +
        '<button class="buy soul"><span class="b1"></span><span class="b2"></span></button>';
      $('.buy', el).onclick = () => {
        if (CC.game.buyRelic(def.id)) { refreshLists(true); flashRes('souls'); }
        else toast(T.t('not_enough'), 'bad');
      };
      host.appendChild(el);
    });
  }

  function updateRelicList() {
    const g = ui.g;
    $$('#relic-list .card').forEach(el => {
      const def = DATA.RELICS.find(r => r.id === el.dataset.id);
      const lv = g.relics[def.id] || 0;
      $('.c-nm', el).textContent = T.tl(def.name);
      $('.c-lv', el).textContent = lv > 0 ? T.t('level_short') + ' ' + lv + '/' + def.max : '';
      const base = lv > 0 ? def.effect * lv : def.effect;
      const val = base;
      $('.c-ds', el).textContent = T.tl(def.desc).replace('{v}', U.fmt(val, 0));
      $('.mini i', el).style.width = (lv / def.max * 100) + '%';
      const btn = $('.buy', el);
      const cost = CC.game.relicCost(def.id);
      const maxed = lv >= def.max;
      btn.disabled = maxed || cost > g.souls;
      $('.b1', btn).textContent = maxed ? '' : '+1';
      $('.b2', btn).textContent = maxed ? T.t('maxed') : '👻 ' + U.fmt(cost);
    });
  }

  /* =========================================================
     Skill bar (battle view)
     ========================================================= */
  function buildSkillBar() {
    const host = $('#skillbar');
    host.innerHTML = '';
    DATA.SKILLS.forEach(def => {
      const b = document.createElement('button');
      b.className = 'skill';
      b.dataset.id = def.id;
      b.innerHTML = '<span class="ic">' + def.icon + '</span><div class="cdfill"></div><div class="cd" hidden></div>';
      b.onclick = () => {
        if (!CC.game.skillUnlocked(def.id)) { toast(T.t('locked_at') + ' ' + def.unlock, 'bad'); return; }
        if (!CC.game.useSkill(def.id)) toast(T.t('not_enough'), 'bad');
      };
      host.appendChild(b);
    });
  }

  function updateSkillBar() {
    const g = ui.g, t = Date.now();
    $$('#skillbar .skill').forEach(b => {
      const def = S.skillDef(b.dataset.id);
      const unlocked = CC.game.skillUnlocked(def.id);
      const st = g.skills[def.id] || {};
      b.classList.toggle('locked', !unlocked);
      const cdEl = $('.cd', b), fill = $('.cdfill', b);
      if (!unlocked) {
        b.classList.remove('ready', 'active');
        cdEl.hidden = false; cdEl.textContent = '🔒'; fill.style.height = '0';
      } else if (st.activeEnd > t) {
        b.classList.add('active'); b.classList.remove('ready');
        cdEl.hidden = false; cdEl.textContent = Math.ceil((st.activeEnd - t) / 1000) + 's';
        cdEl.style.background = 'rgba(72,213,151,.28)';
        fill.style.height = '0';
      } else if (st.cdEnd > t) {
        b.classList.remove('ready', 'active');
        cdEl.hidden = false;
        cdEl.style.background = 'rgba(0,0,0,.62)';
        cdEl.textContent = Math.ceil((st.cdEnd - t) / 1000) + 's';
        const total = def.cd * 1000 * (CC.game.d ? CC.game.d.cdMult : 1);
        fill.style.height = (100 - ((st.cdEnd - t) / total) * 100) + '%';
      } else {
        b.classList.add('ready'); b.classList.remove('active');
        cdEl.hidden = true; fill.style.height = '0';
      }
    });
  }

  /* =========================================================
     More tab
     ========================================================= */
  function buildMore() {
    const seg = $('#more-seg');
    seg.innerHTML = '';
    [['ach', 'achievements'], ['stats', 'stats'], ['set', 'settings']].forEach(([k, key]) => {
      const b = document.createElement('button');
      b.textContent = T.t(key);
      b.className = ui.moreTab === k ? 'on' : '';
      b.onclick = () => { ui.moreTab = k; buildMore(); };
      seg.appendChild(b);
    });
    const body = $('#more-body');
    body.innerHTML = '';
    if (ui.moreTab === 'ach') buildAchievements(body);
    else if (ui.moreTab === 'stats') buildStats(body);
    else buildSettings(body);
  }

  function buildAchievements(body) {
    const g = ui.g;
    const done = DATA.ACHIEVEMENTS.filter(a => g.achievements[a.id]).length;
    const head = document.createElement('div');
    head.className = 'row';
    head.innerHTML = '<span>' + T.t('achievements') + '</span><span class="v">' + done + ' / ' + DATA.ACHIEVEMENTS.length + '</span>';
    body.appendChild(head);
    DATA.ACHIEVEMENTS.forEach(a => {
      const ok = !!g.achievements[a.id];
      const el = document.createElement('div');
      el.className = 'ach' + (ok ? ' done' : '');
      el.innerHTML =
        '<div class="ai">' + (ok ? '🏆' : '🔒') + '</div>' +
        '<div><div class="an">' + T.tl(a.name) + '</div><div class="ad">' + T.tl(a.desc) + '</div></div>' +
        '<div class="ag">💎 ' + a.gems + '</div>';
      body.appendChild(el);
    });
  }

  function buildStats(body) {
    const g = ui.g, d = CC.game.d || S.derive(g, Date.now());
    const rows = [
      ['best_stage', g.bestStage],
      ['st_total_gold', U.fmt(g.stats.totalGold)],
      ['st_total_kills', U.fmt(g.stats.kills)],
      ['st_bosses', U.fmt(g.stats.bosses)],
      ['st_total_taps', U.fmt(g.stats.taps)],
      ['st_crit_hits', U.fmt(g.stats.crits)],
      ['dps', U.fmt(d.dps)],
      ['tap_dmg', U.fmt(d.tap)],
      ['prestige_count', g.prestiges],
      ['souls', U.fmt(g.souls)],
      ['st_ads', g.stats.ads],
      ['st_playtime', U.fmtTime(g.stats.playtime)]
    ];
    rows.forEach(([k, v]) => {
      const el = document.createElement('div');
      el.className = 'row';
      el.innerHTML = '<span>' + T.t(k) + '</span><span class="v">' + v + '</span>';
      body.appendChild(el);
    });
  }

  function switchRow(labelKey, value, onChange) {
    const el = document.createElement('div');
    el.className = 'row';
    el.innerHTML = '<span>' + T.t(labelKey) + '</span><div class="switch' + (value ? ' on' : '') + '"><i></i></div>';
    const sw = $('.switch', el);
    sw.onclick = () => {
      const nv = !sw.classList.contains('on');
      sw.classList.toggle('on', nv);
      onChange(nv);
    };
    return el;
  }

  function buildSettings(body) {
    const g = ui.g;

    /* language */
    const langRow = document.createElement('div');
    langRow.className = 'row';
    langRow.innerHTML = '<span>' + T.t('language') + '</span>';
    const segl = document.createElement('div');
    segl.className = 'buymode';
    [['ar', 'العربية'], ['en', 'English']].forEach(([code, label]) => {
      const b = document.createElement('button');
      b.textContent = label;
      b.className = g.lang === code ? 'on' : '';
      b.onclick = () => { g.lang = code; T.setLang(code); applyStaticText(); buildMore(); S.save(g, true); };
      segl.appendChild(b);
    });
    langRow.appendChild(segl);
    body.appendChild(langRow);

    /* arena display name */
    const nameRow = document.createElement('div');
    nameRow.className = 'row';
    nameRow.innerHTML = '<span>' + T.t('your_name') + '</span>';
    const inp = document.createElement('input');
    inp.className = 'nameinput';
    inp.maxLength = 18;
    inp.value = g.playerName || ('Player' + Math.floor(1000 + Math.random() * 9000));
    inp.placeholder = 'Player' + Math.floor(1000 + Math.random() * 9000);
    inp.oninput = () => { g.playerName = inp.value.slice(0, 18) || ('Player' + Math.floor(1000 + Math.random() * 9000)); };
    inp.onblur = () => { S.save(g, true); if (CC.views) CC.views.renderMyTeam(); };
    nameRow.appendChild(inp);
    body.appendChild(nameRow);

    body.appendChild(switchRow('sound', g.sound, v => { g.sound = v; CC.audio.setSfx(v); }));
    body.appendChild(switchRow('music', g.music, v => { g.music = v; CC.audio.setMusic(v); }));
    body.appendChild(switchRow('haptics', g.haptics, v => { g.haptics = v; }));
    body.appendChild(switchRow('reduce_fx', g.reduceFx, v => { g.reduceFx = v; }));
    body.appendChild(switchRow('auto_advance', g.autoAdvance, v => { g.autoAdvance = v; }));

    /* Google Sign-In / Account linking */
    const googleBox = document.createElement('div');
    googleBox.className = 'google-box';
    googleBox.style.marginTop = '8px';
    const isGoogleLinked = CC.online && CC.online.isReady() && g.online && !g.online.isAnonymous && g.online.email;

    if (isGoogleLinked) {
      googleBox.innerHTML =
        '<div class="row" style="flex-direction:column;align-items:flex-start;gap:6px">' +
          '<div style="display:flex;align-items:center;justify-content:space-between;width:100%">' +
            '<span style="color:var(--green);font-weight:800">' + T.t('google_linked') + '</span>' +
            '<span class="muted" style="font-size:.7rem">' + g.online.email + '</span>' +
          '</div>' +
          '<button class="btn ghost mini" data-google-signout style="margin-top:4px">' + T.t('google_signout') + '</button>' +
        '</div>';
      setTimeout(() => {
        const btnOut = googleBox.querySelector('[data-google-signout]');
        if (btnOut) {
          btnOut.onclick = async () => {
            btnOut.disabled = true;
            await CC.online.signOutGoogle();
            toast(T.t('saved'), 'good');
            buildMore();
          };
        }
      }, 0);
    } else {
      googleBox.innerHTML =
        '<div class="row" style="flex-direction:column;align-items:stretch;gap:6px">' +
          '<p class="muted" style="font-size:.7rem;text-align:center">' + T.t('google_link_desc') + '</p>' +
          '<button class="btn gold" data-google-signin style="margin-top:4px">' + T.t('google_signin') + '</button>' +
        '</div>';
      setTimeout(() => {
        const btnIn = googleBox.querySelector('[data-google-signin]');
        if (btnIn) {
          btnIn.onclick = async () => {
            btnIn.disabled = true;
            btnIn.textContent = T.t('searching');
            const res = await CC.online.signInWithGoogle();
            if (res.ok) {
              if (res.redirect) return;
              toast(T.t('google_success'), 'good');
              CC.audio.play('achieve');
              buildMore();
            } else {
              btnIn.disabled = false;
              btnIn.textContent = T.t('google_signin');
              const msg = res.msg || res.error || T.t('google_failed');
              toast(msg, 'bad');
            }
          };
        }
      }, 0);
    }
    body.appendChild(googleBox);

    const btns = document.createElement('div');
    btns.style.cssText = 'display:flex;flex-direction:column;gap:8px;margin-top:12px';

    const bSave = document.createElement('button');
    bSave.className = 'btn ghost';
    bSave.textContent = T.t('save_now');
    bSave.onclick = () => { S.save(g); };
    btns.appendChild(bSave);

    const bExp = document.createElement('button');
    bExp.className = 'btn ghost';
    bExp.textContent = T.t('export_save');
    bExp.onclick = () => {
      const code = S.exportSave(g);
      const m = modal('<h3>' + T.t('export_save') + '</h3><textarea class="savebox" readonly>' + code + '</textarea>' +
        '<div class="btns"><button class="btn ghost" data-copy>' + T.t('copied') + '</button>' +
        '<button class="btn" data-close>' + T.t('close') + '</button></div>');
      $('textarea', m).select();
      $('[data-copy]', m).onclick = () => {
        try { $('textarea', m).select(); document.execCommand('copy'); toast(T.t('copied'), 'good'); } catch (e) { /* ignore */ }
      };
      $('[data-close]', m).onclick = () => closeModal(m);
    };
    btns.appendChild(bExp);

    const bImp = document.createElement('button');
    bImp.className = 'btn ghost';
    bImp.textContent = T.t('import_save');
    bImp.onclick = () => {
      const m = modal('<h3>' + T.t('import_save') + '</h3><p>' + T.t('import_prompt') + '</p>' +
        '<textarea class="savebox"></textarea>' +
        '<div class="btns"><button class="btn ghost" data-close>' + T.t('cancel') + '</button>' +
        '<button class="btn gold" data-ok>' + T.t('confirm') + '</button></div>');
      $('[data-close]', m).onclick = () => closeModal(m);
      $('[data-ok]', m).onclick = () => {
        try {
          const ns = S.importSave($('textarea', m).value);
          localStorage.setItem(S.SAVE_KEY, JSON.stringify(ns));
          closeModal(m);
          toast(T.t('import_ok'), 'good');
          setTimeout(() => location.reload(), 600);
        } catch (e) { toast(T.t('import_bad'), 'bad'); }
      };
    };
    btns.appendChild(bImp);

    const bReset = document.createElement('button');
    bReset.className = 'btn danger';
    bReset.textContent = T.t('reset_game');
    bReset.onclick = () => confirmBox(T.t('reset_confirm'), () => { S.wipe(); location.reload(); });
    btns.appendChild(bReset);

    body.appendChild(btns);

    const cred = document.createElement('p');
    cred.className = 'muted';
    cred.style.cssText = 'text-align:center;margin-top:14px';
    cred.textContent = T.t('credits') + ' 1.0.0';
    body.appendChild(cred);
  }

  /* =========================================================
     Reward centre (ads + free chest)
     ========================================================= */
  function openRewards() {
    const g = ui.g, t = Date.now();
    const freeReady = t >= (g.nextFreeChest || 0);
    const items = [
      { id: 'chest_free', ico: '🎁', name: T.t('chest_title'), free: true,
        label: freeReady ? T.t('open_chest') : U.fmtClock((g.nextFreeChest - t) / 1000), enabled: freeReady },
      { id: 'x2gold', ico: '🪙', name: T.t('ad_x2_gold'), label: T.t('watch_ad'), enabled: true },
      { id: 'x2dmg', ico: '💥', name: T.t('ad_x2_dps'), label: T.t('watch_ad'), enabled: true },
      { id: 'gems', ico: '💎', name: T.t('ad_gems'), label: T.t('watch_ad'), enabled: true },
      { id: 'chest_ad', ico: '🎁', name: T.t('ad_chest'), label: T.t('watch_ad'), enabled: true }
    ];
    let html = '<h3>' + T.t('free_reward') + '</h3><div class="reward-list">';
    items.forEach(it => {
      html += '<div class="reward-item" data-id="' + it.id + '"' + (it.enabled ? '' : ' style="opacity:.5"') + '>' +
        '<span class="ri">' + it.ico + '</span><span class="rn">' + it.name + '</span>' +
        '<span class="rb">' + it.label + '</span></div>';
    });
    html += '</div><button class="btn ghost" data-close>' + T.t('close') + '</button>';
    const m = modal(html);
    $('[data-close]', m).onclick = () => closeModal(m);
    $$('.reward-item', m).forEach(el => {
      el.onclick = async () => {
        const id = el.dataset.id;
        const it = items.find(x => x.id === id);
        if (!it.enabled) return;
        closeModal(m);
        if (id === 'chest_free') {
          g.nextFreeChest = Date.now() + 30 * 60 * 1000;
          showChest(CC.game.openChest(), true);   // free chest → offer the optional ×2
          return;
        }
        const ok = await CC.ads.showRewarded();
        if (!ok) { toast(T.t('ad_failed'), 'bad'); return; }
        g.stats.ads++;
        if (id === 'x2gold') { CC.game.addBoost('gold', 2, 1800); toast(T.t('ad_reward_given'), 'good'); }
        else if (id === 'x2dmg') { CC.game.addBoost('dmg', 2, 900); toast(T.t('ad_reward_given'), 'good'); }
        else if (id === 'gems') { CC.game.grantGems(25); toast('+25 💎', 'good'); flashRes('gems'); }
        else if (id === 'chest_ad') { showChest(CC.game.openChest()); }
        S.save(g, true);
      };
    });
  }

  /**
   * Generic optional-ad doubler. The base reward is ALREADY granted before this
   * is called, so a failed / skipped ad can never cost the player anything.
   *
   * @param o.icon    big emoji
   * @param o.title   heading
   * @param o.amount  formatted amount line (what they already got)
   * @param o.note    small explainer
   * @param o.onDouble  called when the ad completed — grant the SAME amount again
   */
  function offerDouble(o) {
    const g = ui.g;
    const m = modal(
      '<div class="big-ico">' + o.icon + '</div>' +
      '<h3>' + o.title + '</h3>' +
      '<div class="amount">' + o.amount + '</div>' +
      '<p>' + (o.note || T.t('double_ad_note')) + '</p>' +
      '<div class="btns">' +
        '<button class="btn ghost" data-skip>' + T.t('no_thanks') + '</button>' +
        '<button class="btn gold" data-double>▶ ' + T.t('double_it') + '</button>' +
      '</div>', { sticky: true });

    $('[data-skip]', m).onclick = () => closeModal(m);
    $('[data-double]', m).onclick = async () => {
      const btn = $('[data-double]', m);
      btn.disabled = true;
      btn.textContent = T.t('ad_loading');
      const ok = await CC.ads.showRewarded();
      closeModal(m);
      if (!ok) { toast(T.t('ad_failed'), 'bad'); return; }
      g.stats.ads++;
      o.onDouble();
      toast(T.t('doubled'), 'good');
      S.save(g, true);
    };
    return m;
  }

  /** Prestige payout screen with the optional ×2 ad. */
  function showPrestigeReward(gain) {
    const g = ui.g;
    offerDouble({
      icon: '👻',
      title: T.t('souls_earned'),
      amount: '👻 ' + U.fmt(gain),
      onDouble: () => {
        g.souls += gain;
        CC.game.checkAchievements();
        flashRes('souls');
        refreshLists(true);
      }
    });
    flashRes('souls');
  }

  function showChest(res, allowDouble) {
    const g = ui.g;
    let line = '';
    if (res.kind === 'gold') line = '🪙 ' + U.fmt(res.amount);
    else if (res.kind === 'gems') line = '💎 ' + res.amount;
    else line = (res.boost === 'gold' ? '🪙' : '💥') + ' ×' + res.mult + ' — ' + U.fmtTime(res.dur);
    flashRes(res.kind === 'gems' ? 'gems' : 'gold');

    /* only loot rewards can be doubled, and never right after an ad */
    if (allowDouble && (res.kind === 'gold' || res.kind === 'gems')) {
      offerDouble({
        icon: '🎁',
        title: T.t('you_got'),
        amount: line,
        onDouble: () => {
          if (res.kind === 'gold') CC.game.grantGold(res.amount);
          else { g.gems += res.amount; }
          CC.game.coinBurst(10);
          flashRes(res.kind === 'gems' ? 'gems' : 'gold');
        }
      });
      return;
    }
    const m = modal('<div class="big-ico">🎁</div><h3>' + T.t('you_got') + '</h3>' +
      '<div class="amount">' + line + '</div>' +
      '<p>' + T.tl(res.label) + '</p>' +
      '<button class="btn gold big" data-close>' + T.t('claim') + '</button>');
    $('[data-close]', m).onclick = () => closeModal(m);
  }

  function showOffline(rep) {
    const g = ui.g;
    const m = modal(
      '<div class="big-ico">🌙</div><h3>' + T.t('welcome_back') + '</h3>' +
      '<p>' + T.t('offline_time') + ': ' + U.fmtTime(rep.seconds) + '</p>' +
      '<p>' + T.t('offline_earned') + '</p>' +
      '<div class="amount">🪙 ' + U.fmt(rep.gold) + '</div>' +
      '<div class="btns">' +
      '<button class="btn ghost" data-x1>' + T.t('collect') + '</button>' +
      '<button class="btn gold" data-x2>' + T.t('collect_x2') + '</button></div>', { sticky: true });
    $('[data-x1]', m).onclick = () => { CC.game.grantGold(rep.gold); CC.game.coinBurst(10); closeModal(m); flashRes('gold'); };
    $('[data-x2]', m).onclick = async () => {
      const ok = await CC.ads.showRewarded();
      CC.game.grantGold(ok ? rep.gold.mul(2) : rep.gold);
      if (ok) g.stats.ads++;
      CC.game.coinBurst(18);
      closeModal(m); flashRes('gold');
    };
  }

  function showAchievement(a) {
    toast('🏆 ' + T.tl(a.name) + '  +💎' + a.gems, 'good');
  }

  /* =========================================================
     HUD update
     ========================================================= */
  function flashRes(kind) {
    const el = $('#res-' + kind);
    if (!el) return;
    el.classList.remove('flash');
    void el.offsetWidth;
    el.classList.add('flash');
  }

  function updateHud() {
    const g = ui.g, d = CC.game.d;
    $('#res-gold b').textContent = U.fmt(g.gold);
    $('#res-gems b').textContent = U.fmt(g.gems);
    $('#res-souls b').textContent = U.fmt(g.souls);
    $('#dps-val').textContent = U.fmt(d.dps);

    const zone = DATA.zoneFor(g.stage);
    $('#stage-name').textContent = T.t('stage') + ' ' + g.stage;
    $('#zone-name').textContent = T.tl(zone.name);

    /* progress dots */
    const dots = $('#stage-dots');
    const isBoss = DATA.isBossStage(g.stage);
    const need = isBoss ? 1 : DATA.BAL.monstersPerStage;
    if (dots.children.length !== need) {
      dots.innerHTML = '';
      for (let i = 0; i < need; i++) dots.appendChild(document.createElement('i'));
    }
    const have = isBoss ? 0 : g.killsInStage;
    for (let i = 0; i < dots.children.length; i++) dots.children[i].className = i < have ? 'on' : '';

    $('#stage-prev').disabled = g.stage <= 1;
    $('#stage-next').disabled = g.stage >= g.bestStage;

    /* hp bar */
    const m = CC.game.monster;
    const bar = $('.hpbar');
    const fill = $('#hp-fill');
    const txt = $('#hp-text');
    bar.classList.toggle('boss', !!(m && m.boss));
    if (m && !m.dead) {
      const pct = U.clamp(m.hp.ratio(m.maxHp) * 100, 0, 100);
      fill.style.width = pct + '%';
      const shown = m.hp.gt(0) ? m.hp : D(0);
      txt.textContent = (m.boss ? '👑 ' : '') + T.tl(m.name) + ' — ' + U.fmt(shown) + ' / ' + U.fmt(m.maxHp);
    } else {
      fill.style.width = '0%';
      txt.textContent = g.bossFailed ? T.t('boss_escaped') : '…';
    }

    /* boss timer */
    const bt = $('#boss-timer');
    if (g.bossActive && m && !m.dead) {
      bt.hidden = false;
      bt.classList.toggle('low', g.bossTimer <= 8);
      $('b', bt).textContent = U.fmtClock(g.bossTimer);
    } else bt.hidden = true;

    /* boss button / message */
    const bb = $('#boss-btn');
    const needStart = DATA.isBossStage(g.stage) && (!m || g.bossFailed) && !g.bossActive;
    bb.hidden = !needStart;
    if (needStart) bb.textContent = (g.bossFailed ? T.t('retry_boss') : T.t('fight_boss')) + ' 👑';

    /* boosts */
    const row = $('#boost-row');
    const t = Date.now();
    let html = '';
    for (const k in g.boosts) {
      const b = g.boosts[k];
      if (!b || b.end <= t) continue;
      html += '<span class="boost-chip">' + (k === 'gold' ? '🪙' : '💥') + ' ×' + b.mult + ' ' + U.fmtClock((b.end - t) / 1000) + '</span>';
    }
    if (row.innerHTML !== html) row.innerHTML = html;

    /* free chest button */
    $('#chest-btn').hidden = false;
    $('#chest-btn').style.filter = t >= (g.nextFreeChest || 0) ? '' : 'grayscale(.6)';

    updateSkillBar();
    updateTabDots();
  }

  function updateTabDots() {
    const g = ui.g;
    let critterAff = false;
    const top = DATA.highestUnlockedTier(g.bestStage);
    for (let i = 0; i <= top; i++) {
      const c = DATA.getCritter(i);
      const lv = g.critters[c.id] || 0;
      if (D.bulkCost(c.baseCost, c.costMult, lv, 1).lte(g.gold)) { critterAff = true; break; }
    }
    let upgAff = false;
    for (const u of DATA.UPGRADES) {
      const lv = g.upgrades[u.id] || 0;
      if (lv < u.max && D.bulkCost(u.baseCost, u.costMult, lv, 1).lte(g.gold)) { upgAff = true; break; }
    }
    let relicAff = false;
    for (const r of DATA.RELICS) {
      const lv = g.relics[r.id] || 0;
      if (lv < r.max && CC.game.relicCost(r.id) <= g.souls) { relicAff = true; break; }
    }
    const dots = {
      critters: critterAff, upgrades: upgAff,
      prestige: relicAff || (g.bestStage >= 10 && CC.game.prestigeGain() > 0 && g.prestiges === 0),
      more: false
    };
    $$('#tabs .tab').forEach(b => {
      const d = $('.dot', b);
      if (!d) return;
      d.hidden = !dots[b.dataset.view];
    });
  }

  function updatePrestige() {
    const g = ui.g;
    $('#p-souls').textContent = U.fmt(g.souls);
    $('#p-count').textContent = g.prestiges;
    $('#p-bonus').textContent = '×' + U.fmt(DATA.soulMultiplier(g.souls));
    const gain = CC.game.prestigeGain();
    const btn = $('#prestige-btn');
    const can = g.bestStage >= 10 && gain > 0;
    btn.disabled = !can;
    btn.textContent = can
      ? T.t('do_prestige') + ' — 👻 ' + U.fmt(gain)
      : T.t('prestige_need');
  }

  /* =========================================================
     Views
     ========================================================= */
  function switchView(name) {
    ui.view = name;
    ['battle', 'critters', 'upgrades', 'prestige', 'arena', 'more'].forEach(v => {
      $('#view-' + v).hidden = v !== name;
    });
    $$('#tabs .tab').forEach(b => b.classList.toggle('active', b.dataset.view === name));
    if (name === 'more') buildMore();
    if (name === 'arena' && CC.views) CC.views.buildArena();
    refreshLists(true);
    if (name === 'battle') CC.game.resize();
  }

  function refreshLists(force) {
    const now = performance.now();
    if (!force && now - ui.lastList < 220) return;
    ui.lastList = now;
    if (ui.view === 'arena') { if (CC.views) CC.views.updateArena(); return; }
    if (ui.view === 'critters') updateCritterList();
    else if (ui.view === 'upgrades') updateUpgradeList();
    else if (ui.view === 'prestige') { updateRelicList(); updatePrestige(); }
  }

  /* =========================================================
     Init
     ========================================================= */
  function init(g) {
    ui.g = g;
    T.setLang(g.lang);
    applyStaticText();

    $$('#tabs .tab').forEach(b => { b.onclick = () => { CC.audio.resume(); switchView(b.dataset.view); }; });
    $('#stage-prev').onclick = () => CC.game.gotoStage(g.stage - 1);
    $('#stage-next').onclick = () => CC.game.gotoStage(g.stage + 1);
    $('#chest-btn').onclick = () => { CC.audio.resume(); openRewards(); };
    $('#boss-btn').onclick = () => { g.bossFailed = false; CC.game.startBoss(); };
    $('#prestige-btn').onclick = () => {
      confirmBox(T.t('confirm_prestige'), () => {
        const gain = CC.game.doPrestige();
        switchView('battle');
        if (gain > 0) showPrestigeReward(gain);
      });
    };

    /* tap handling */
    const layer = $('#taplayer');
    const onTap = (clientX, clientY) => {
      const r = layer.getBoundingClientRect();
      const x = clientX - r.left, y = clientY - r.top;
      CC.audio.resume();
      CC.game.tap(x, y);
      if (!g.reduceFx) {
        const rip = document.createElement('div');
        rip.className = 'tap-ripple';
        rip.style.left = x + 'px'; rip.style.top = y + 'px';
        layer.appendChild(rip);
        setTimeout(() => rip.remove(), 460);
      }
    };
    layer.addEventListener('pointerdown', e => { e.preventDefault(); onTap(e.clientX, e.clientY); }, { passive: false });
    layer.addEventListener('touchstart', e => {
      e.preventDefault();
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        onTap(t.clientX, t.clientY);
      }
    }, { passive: false });

    /* game events -> UI reactions */
    CC.game.onEvent = (type, payload) => {
      if (type === 'achievement') showAchievement(payload);
      else if (type === 'record') { /* silent */ }
      else if (type === 'buy' || type === 'prestige') refreshLists(true);
    };

    if (CC.views) CC.views.init(g);
    ui.built = true;
    switchView('battle');
  }

  CC.ui = {
    init, toast, modal, closeModal, confirmBox, switchView, updateHud, refreshLists,
    showOffline, showChest, openRewards, applyStaticText, buildMore, flashRes,
    offerDouble, showPrestigeReward,
    get view() { return ui.view; }
  };
})(window);
