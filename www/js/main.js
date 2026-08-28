/* ============================================================
   Critter Clash Idle — bootstrap & main loop
   ============================================================ */
(function (global) {
  'use strict';
  const CC = global.CC;
  const S = CC.state, DATA = CC.data, U = CC.util, D = CC.D;

  let g = null, last = 0, hudAcc = 0, saveAcc = 0, rafId = 0;

  async function boot() {
    g = await S.load();

    CC.i18n.setLang(g.lang);
    CC.audio.init();
    CC.audio.setSfx(g.sound);
    CC.audio.setMusic(g.music);
    CC.ads.init();

    const canvas = document.getElementById('scene');
    CC.game.attach(canvas, g);
    CC.ui.init(g);

    /* Fired, not awaited: a slow or missing network must never hold the game
       on a black screen. Online features light up whenever they connect. */
    if (CC.online) {
      Promise.resolve()
        .then(() => CC.online.init(g))
        .catch(e => console.warn('online init failed', e));
    }

    /* offline earnings before we touch lastTick */
    const rep = CC.game.offlineReport(g, CC.game.d, Date.now());
    g.lastTick = Date.now();

    /* first monster */
    if (DATA.isBossStage(g.stage) && !g.autoAdvance) { g.bossFailed = true; }
    else CC.game.spawn(true);
    CC.game.running = true;

    document.getElementById('app').hidden = false;
    const bootEl = document.getElementById('boot');
    bootEl.classList.add('gone');
    setTimeout(() => bootEl.remove(), 400);

    CC.game.resize();
    CC.ui.updateHud();

    if (rep) setTimeout(() => CC.ui.showOffline(rep), 500);
    else if (!g.tutorialSeen) { g.tutorialSeen = true; setTimeout(showTutorial, 400); }

    last = performance.now();
    rafId = requestAnimationFrame(loop);

    bindLifecycle();
  }

  function showTutorial() {
    const T = CC.i18n.t;
    const html =
      '<div class="big-ico">🐾</div>' +
      '<h3>' + T('game_title') + '</h3>' +
      '<div class="reward-list">' +
        '<div class="reward-item"><span class="ri">👆</span><span class="rn">' +
          (CC.i18n.getLang() === 'ar'
            ? 'انقر على الوحش لتضربه واجمع الذهب.'
            : 'Tap the monster to hit it and collect gold.') + '</span></div>' +
        '<div class="reward-item"><span class="ri">🐾</span><span class="rn">' +
          (CC.i18n.getLang() === 'ar'
            ? 'جنّد مخلوقات لتقاتل عنك تلقائياً — حتى وأنت خارج اللعبة.'
            : 'Hire critters that fight for you — even while you are away.') + '</span></div>' +
        '<div class="reward-item"><span class="ri">👑</span><span class="rn">' +
          (CC.i18n.getLang() === 'ar'
            ? 'كل ٥ مراحل يظهر زعيم بمؤقت. اهزمه قبل انتهاء الوقت!'
            : 'Every 5 stages a timed boss appears. Beat the clock!') + '</span></div>' +
        '<div class="reward-item"><span class="ri">👻</span><span class="rn">' +
          (CC.i18n.getLang() === 'ar'
            ? 'عند التوقف عن التقدم، ابعث لتحصل على أرواح دائمة.'
            : 'When you stall, prestige for permanent Soul power.') + '</span></div>' +
      '</div>' +
      '<button class="btn gold big" data-close>' + T('claim') + ' 🎁 100 🪙</button>';
    const m = CC.ui.modal(html, { sticky: true });
    m.querySelector('[data-close]').onclick = () => {
      CC.game.grantGold(100);
      CC.game.grantGems(10);
      CC.ui.closeModal(m);
      CC.ui.flashRes('gold');
    };
  }

  function loop(ts) {
    rafId = requestAnimationFrame(loop);
    let dt = (ts - last) / 1000;
    last = ts;
    if (!(dt > 0)) dt = 0;
    if (dt > 0.25) dt = 0.25;          // tab was hidden / hitch

    CC.game.tick(dt);
    CC.game.render();

    hudAcc += dt;
    if (hudAcc > 0.08) { hudAcc = 0; CC.ui.updateHud(); CC.ui.refreshLists(false); }

    saveAcc += dt;
    if (saveAcc > 15) { saveAcc = 0; S.save(g, true); }
  }

  /* --------------------------------------------------------
     Background / foreground handling
     -------------------------------------------------------- */
  function onHide() {
    g.lastTick = Date.now();
    S.save(g, true);
    CC.audio.stopMusic();
  }

  function onShow() {
    const t = Date.now();
    const away = (t - (g.lastTick || t)) / 1000;
    if (away > 60) {
      const rep = CC.game.offlineReport(g, CC.game.d, t);
      if (rep) CC.ui.showOffline(rep);
    }
    g.lastTick = t;
    last = performance.now();
    if (g.music) CC.audio.startMusic();
    CC.game.resize();
  }

  function bindLifecycle() {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) onHide(); else onShow();
    });
    global.addEventListener('pagehide', onHide);
    global.addEventListener('beforeunload', onHide);

    const App = global.Capacitor && global.Capacitor.Plugins && global.Capacitor.Plugins.App;
    if (App) {
      App.addListener('appStateChange', ({ isActive }) => { if (isActive) onShow(); else onHide(); });
      App.addListener('backButton', () => {
        const open = document.querySelector('.modal-bg');
        if (open) { open.remove(); return; }
        if (CC.ui.view !== 'battle') { CC.ui.switchView('battle'); return; }
        App.exitApp();
      });
    }
    const SB = global.Capacitor && global.Capacitor.Plugins && global.Capacitor.Plugins.SplashScreen;
    if (SB) { try { SB.hide(); } catch (e) { /* ignore */ } }

    /* start audio on first interaction (browser autoplay policy) */
    const kick = () => {
      CC.audio.resume();
      if (g.music) CC.audio.startMusic();
      document.removeEventListener('pointerdown', kick);
      document.removeEventListener('touchstart', kick);
    };
    document.addEventListener('pointerdown', kick);
    document.addEventListener('touchstart', kick);

    /* Debug hook for the browser build only — the shipped Android/iOS app must
       not ship a console that hands out gold and stages. */
    const nativeBuild = !!(global.Capacitor && global.Capacitor.isNativePlatform
      && global.Capacitor.isNativePlatform());
    if (nativeBuild) return;
    global.CCDEBUG = {
      state: () => g,
      derive: () => CC.game.d,
      addGold: n => CC.game.grantGold(n),
      addSouls: n => { g.souls += n; },
      power: () => CC.D.format(CC.game.d.dps),
      jump: n => { g.bestStage = Math.max(g.bestStage, n); CC.game.gotoStage(n); },
      addGems: n => { g.gems += n; },
      save: () => S.save(g),
      wipe: () => { S.__noSave = true; CC.game.running = false; S.wipe(); }
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window);
