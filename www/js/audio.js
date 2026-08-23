/* ============================================================
   Critter Clash Idle — WebAudio synth (no audio files shipped)
   ============================================================ */
(function (global) {
  'use strict';
  const CC = global.CC || (global.CC = {});

  let ctx = null, master = null, musicGain = null, sfxGain = null;
  let musicTimer = null, step = 0;
  let enabledSfx = true, enabledMusic = true, ready = false;

  function init() {
    if (ctx) return true;
    const AC = global.AudioContext || global.webkitAudioContext;
    if (!AC) return false;
    try { ctx = new AC(); } catch (e) { return false; }
    master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
    sfxGain = ctx.createGain(); sfxGain.gain.value = 0.55; sfxGain.connect(master);
    musicGain = ctx.createGain(); musicGain.gain.value = 0.16; musicGain.connect(master);
    ready = true;
    return true;
  }

  function resume() {
    if (!ctx) init();
    if (ctx && ctx.state === 'suspended') ctx.resume();
  }

  function env(node, t0, a, d, peak) {
    node.gain.cancelScheduledValues(t0);
    node.gain.setValueAtTime(0.0001, t0);
    node.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak), t0 + a);
    node.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d);
  }

  function tone(freq, dur, type, peak, slideTo, dest) {
    if (!ready || !enabledSfx) return;
    const t0 = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    env(g, t0, 0.008, dur, peak === undefined ? 0.35 : peak);
    o.connect(g); g.connect(dest || sfxGain);
    o.start(t0); o.stop(t0 + dur + 0.05);
  }

  function noise(dur, peak, filterFreq) {
    if (!ready || !enabledSfx) return;
    const t0 = ctx.currentTime;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = filterFreq || 2400;
    const g = ctx.createGain(); env(g, t0, 0.005, dur, peak || 0.3);
    src.connect(f); f.connect(g); g.connect(sfxGain);
    src.start(t0);
  }

  const SFX = {
    tap()      { tone(320 + Math.random() * 60, 0.09, 'square', 0.16, 180); noise(0.05, 0.1, 1800); },
    crit()     { tone(660, 0.16, 'sawtooth', 0.22, 320); tone(990, 0.14, 'square', 0.12, 500); noise(0.1, 0.18, 3200); },
    kill()     { tone(240, 0.2, 'triangle', 0.22, 90); noise(0.16, 0.2, 1200); },
    bossKill() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.26, 'triangle', 0.26), i * 90)); },
    stage()    { tone(523, 0.12, 'sine', 0.2); setTimeout(() => tone(784, 0.16, 'sine', 0.2), 90); },
    buy()      { tone(880, 0.08, 'square', 0.16, 1200); setTimeout(() => tone(1320, 0.09, 'square', 0.12), 60); },
    error()    { tone(160, 0.16, 'sawtooth', 0.16, 110); },
    skill()    { tone(180, 0.3, 'sawtooth', 0.22, 900); noise(0.25, 0.16, 900); },
    chest()    { [392, 523, 659, 880, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.22, 'triangle', 0.22), i * 70)); },
    prestige() { [262, 330, 392, 523, 659, 784].forEach((f, i) => setTimeout(() => tone(f, 0.5, 'sine', 0.24), i * 130)); },
    achieve()  { [659, 880, 1175].forEach((f, i) => setTimeout(() => tone(f, 0.2, 'square', 0.16), i * 80)); },
    boss()     { tone(90, 0.7, 'sawtooth', 0.28, 60); noise(0.6, 0.2, 500); }
  };

  function play(name) {
    if (!ready || !enabledSfx) return;
    const f = SFX[name];
    if (f) { try { f(); } catch (e) { /* ignore */ } }
  }

  /* ---------------- ambient music ---------------- */
  const SCALE = [0, 3, 5, 7, 10, 12, 15];
  const ROOTS = [130.81, 146.83, 174.61, 196.0];
  let rootIdx = 0;

  function musicStep() {
    if (!ready || !enabledMusic) return;
    const t0 = ctx.currentTime;
    if (step % 32 === 0) rootIdx = Math.floor(Math.random() * ROOTS.length);
    const root = ROOTS[rootIdx];

    // bass every 4 steps
    if (step % 4 === 0) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'triangle'; o.frequency.value = root / 2;
      env(g, t0, 0.05, 0.7, 0.35);
      o.connect(g); g.connect(musicGain); o.start(t0); o.stop(t0 + 0.9);
    }
    // arp
    const n = SCALE[(step * 3 + Math.floor(step / 7)) % SCALE.length];
    const freq = root * Math.pow(2, n / 12);
    const o2 = ctx.createOscillator(), g2 = ctx.createGain(), f2 = ctx.createBiquadFilter();
    o2.type = 'sine'; o2.frequency.value = freq * 2;
    f2.type = 'lowpass'; f2.frequency.value = 1800;
    env(g2, t0, 0.02, 0.35, 0.22);
    o2.connect(f2); f2.connect(g2); g2.connect(musicGain);
    o2.start(t0); o2.stop(t0 + 0.5);
    step++;
  }

  function startMusic() {
    if (!ready || musicTimer || !enabledMusic) return;
    musicTimer = setInterval(musicStep, 320);
  }
  function stopMusic() {
    if (musicTimer) { clearInterval(musicTimer); musicTimer = null; }
  }

  function setSfx(v) { enabledSfx = !!v; }
  function setMusic(v) {
    enabledMusic = !!v;
    if (enabledMusic) startMusic(); else stopMusic();
  }

  function vibrate(ms) {
    try {
      const H = global.Capacitor && global.Capacitor.Plugins && global.Capacitor.Plugins.Haptics;
      if (H) { H.impact({ style: ms > 25 ? 'MEDIUM' : 'LIGHT' }); return; }
      if (navigator.vibrate) navigator.vibrate(ms);
    } catch (e) { /* ignore */ }
  }

  CC.audio = { init, resume, play, startMusic, stopMusic, setSfx, setMusic, vibrate };
})(window);
