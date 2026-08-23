/* ============================================================
   Critter Clash Idle — rewarded-ad layer
   Real AdMob on device (@capacitor-community/admob),
   a simulated 5-second ad in the browser so the game is
   fully testable without an ad account.
   ============================================================ */
(function (global) {
  'use strict';
  const CC = global.CC || (global.CC = {});

  /* ----- Replace these with your own AdMob unit IDs before release ----- */
  const AD_UNITS = {
    android: { rewarded: 'ca-app-pub-3940256099942544/5224354917' },  // Google TEST id
    ios:     { rewarded: 'ca-app-pub-3940256099942544/1712485313' }   // Google TEST id
  };
  const USE_TEST_ADS = true;   // set to false once you paste real unit IDs

  let plugin = null, initialised = false, loading = false, loadedOnce = false;

  function platform() {
    const C = global.Capacitor;
    return (C && C.getPlatform && C.getPlatform()) || 'web';
  }
  function isNative() { const p = platform(); return p === 'android' || p === 'ios'; }

  async function init() {
    if (initialised) return;
    initialised = true;
    if (!isNative()) return;
    try {
      plugin = global.Capacitor.Plugins.AdMob;
      if (!plugin) return;
      await plugin.initialize({
        requestTrackingAuthorization: true,
        initializeForTesting: USE_TEST_ADS
      });
    } catch (e) { console.warn('AdMob init failed', e); plugin = null; }
  }

  function unitId() {
    const p = platform();
    return (AD_UNITS[p] || AD_UNITS.android).rewarded;
  }

  async function prepare() {
    if (!plugin || loading) return loadedOnce;
    loading = true;
    try {
      await plugin.prepareRewardVideoAd({ adId: unitId(), isTesting: USE_TEST_ADS });
      loadedOnce = true;
    } catch (e) { loadedOnce = false; }
    loading = false;
    return loadedOnce;
  }

  /**
   * Show a rewarded ad.
   * @returns {Promise<boolean>} true when the user earned the reward
   */
  async function showRewarded() {
    if (plugin) {
      try {
        if (!loadedOnce) await prepare();
        const res = await plugin.showRewardVideoAd();
        prepare();                                  // pre-load the next one
        return !!res;
      } catch (e) {
        console.warn('ad failed', e);
        return false;
      }
    }
    // ---- web / desktop simulation ----
    return simulate();
  }

  function simulate() {
    return new Promise(resolve => {
      const overlay = document.createElement('div');
      overlay.className = 'ad-sim';
      overlay.innerHTML =
        '<div class="ad-sim-box">' +
          '<div class="ad-sim-tag">AD</div>' +
          '<div class="ad-sim-art"><span>🎁</span></div>' +
          '<div class="ad-sim-txt"></div>' +
          '<div class="ad-sim-bar"><i></i></div>' +
          '<button class="ad-sim-skip" disabled></button>' +
        '</div>';
      document.body.appendChild(overlay);
      const txt = overlay.querySelector('.ad-sim-txt');
      const bar = overlay.querySelector('.ad-sim-bar i');
      const btn = overlay.querySelector('.ad-sim-skip');
      const t = CC.i18n.t;
      txt.textContent = t('ad_loading');
      let left = 5;
      btn.textContent = left + 's';
      const iv = setInterval(() => {
        left--;
        bar.style.width = ((5 - left) / 5 * 100) + '%';
        if (left > 0) { btn.textContent = left + 's'; return; }
        clearInterval(iv);
        btn.disabled = false;
        btn.textContent = t('claim');
        btn.onclick = () => { overlay.remove(); resolve(true); };
      }, 1000);
    });
  }

  CC.ads = { init, prepare, showRewarded, isNative, AD_UNITS };
})(window);
