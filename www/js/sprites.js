/* ============================================================
   Critter Clash Idle — procedural creature renderer
   Everything is drawn with canvas paths: zero image assets,
   tiny download size, infinitely many distinct monsters.
   ============================================================ */
(function (global) {
  'use strict';
  const CC = global.CC || (global.CC = {});
  const U = CC.util;

  /* ---------------- colour helpers ---------------- */
  function hexToRgb(h) {
    h = h.replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    const n = parseInt(h, 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }
  function rgbToHex(r, g, b) {
    const c = v => ('0' + Math.round(U.clamp(v, 0, 255)).toString(16)).slice(-2);
    return '#' + c(r) + c(g) + c(b);
  }
  function shade(hex, amt) {
    const { r, g, b } = hexToRgb(hex);
    if (amt >= 0) return rgbToHex(r + (255 - r) * amt, g + (255 - g) * amt, b + (255 - b) * amt);
    return rgbToHex(r * (1 + amt), g * (1 + amt), b * (1 + amt));
  }
  function rgba(hex, a) {
    const { r, g, b } = hexToRgb(hex);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
  }
  function hsl(h, s, l) { return 'hsl(' + (h % 360) + ',' + s + '%,' + l + '%)'; }

  /* ---------------- archetypes ---------------- */
  /* every flag is optional; the renderer composes whatever is present */
  const ARCHETYPES = [
    { k: 'slime',   body: 'blob',   eyes: 2, mouth: 'smile', wobble: 0.22, squish: 1.1, shine: true },
    { k: 'bug',     body: 'oval',   eyes: 2, mouth: 'fangs', antennae: true, legs: 6, shell: true },
    { k: 'imp',     body: 'pear',   eyes: 2, mouth: 'grin', horns: 2, tail: 'arrow', arms: true, legs: 2 },
    { k: 'shroom',  body: 'round',  eyes: 2, mouth: 'smile', cap: true, legs: 2, spots: true },
    { k: 'bat',     body: 'round',  eyes: 2, mouth: 'fangs', wings: 'bat', ears: 'tall' },
    { k: 'wisp',    body: 'flame',  eyes: 3, mouth: 'none', glow: true, float: true },
    { k: 'gremlin', body: 'pear',   eyes: 2, mouth: 'grin', ears: 'wide', arms: true, legs: 2, spikes: 3 },
    { k: 'rock',    body: 'poly',   eyes: 2, mouth: 'flat', crystals: true, arms: true },
    { k: 'wolf',    body: 'oval',   eyes: 2, mouth: 'fangs', ears: 'tall', tail: 'bushy', legs: 4, snout: true },
    { k: 'scorpion',body: 'oval',   eyes: 4, mouth: 'flat', tail: 'sting', legs: 6, claws: true, shell: true },
    { k: 'frog',    body: 'wide',   eyes: 2, mouth: 'wide', legs: 4, spots: true, bulgeEyes: true },
    { k: 'ice',     body: 'poly',   eyes: 2, mouth: 'flat', crystals: true, glow: true },
    { k: 'worm',    body: 'segment',eyes: 2, mouth: 'maw', segments: 4 },
    { k: 'drake',   body: 'oval',   eyes: 2, mouth: 'fangs', horns: 2, wings: 'dragon', tail: 'arrow', snout: true, legs: 2 },
    { k: 'cog',     body: 'gear',   eyes: 1, mouth: 'flat', arms: true, glow: true },
    { k: 'ghosty',  body: 'ghost',  eyes: 2, mouth: 'oh', float: true, glow: true },
    { k: 'crab',    body: 'wide',   eyes: 2, mouth: 'flat', claws: true, legs: 6, shell: true, bulgeEyes: true },
    { k: 'golem',   body: 'poly',   eyes: 2, mouth: 'flat', arms: true, legs: 2, crystals: true, spikes: 4 },
    { k: 'hornet',  body: 'oval',   eyes: 4, mouth: 'fangs', wings: 'bat', antennae: true, legs: 6, tail: 'sting' },
    { k: 'mimic',   body: 'wide',   eyes: 2, mouth: 'maw', legs: 4, shell: true, spikes: 3 },
    { k: 'seer',    body: 'round',  eyes: 3, mouth: 'none', float: true, glow: true, crystals: true },
    { k: 'brute',   body: 'pear',   eyes: 2, mouth: 'fangs', arms: true, legs: 2, horns: 2, shell: true },
    { k: 'lich',    body: 'ghost',  eyes: 2, mouth: 'fangs', float: true, horns: 2, glow: true },
    { k: 'tick',    body: 'round',  eyes: 4, mouth: 'flat', legs: 6, spikes: 5, shell: true },
    { k: 'serpent', body: 'segment',eyes: 2, mouth: 'fangs', segments: 5, horns: 2, snout: true },
    { k: 'jelly',   body: 'blob',   eyes: 3, mouth: 'oh', wobble: 0.3, float: true, glow: true, shine: true },
    { k: 'sentry',  body: 'gear',   eyes: 2, mouth: 'flat', arms: true, spikes: 6 },
    { k: 'stalker', body: 'oval',   eyes: 4, mouth: 'grin', legs: 4, claws: true, tail: 'arrow', ears: 'tall' },
    { k: 'ember',   body: 'flame',  eyes: 2, mouth: 'grin', float: true, glow: true, horns: 2 },
    { k: 'behemoth',body: 'wide',   eyes: 2, mouth: 'maw', legs: 4, horns: 2, spikes: 6, snout: true, shell: true }
  ];

  /** Stable 32-bit hash of a string — sprite seeds must not depend on floats. */
  function hashId(str) {
    let h = 2166136261;
    str = String(str);
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  /* ---------------- spec generators ---------------- */
  function monsterSpec(stage, index, isBoss) {
    const rng = U.seeded(stage * 977 + index * 131 + 7);
    const zone = CC.data.zoneFor(stage);
    const zi = CC.data.zoneIndex(stage);
    const arch = ARCHETYPES[Math.floor(rng() * ARCHETYPES.length)];

    // palette: hue anchored to the zone accent, varied per monster
    const base = hexToRgb(zone.accent);
    const maxc = Math.max(base.r, base.g, base.b), minc = Math.min(base.r, base.g, base.b);
    let h = 0;
    const d = maxc - minc;
    if (d !== 0) {
      if (maxc === base.r) h = 60 * (((base.g - base.b) / d) % 6);
      else if (maxc === base.g) h = 60 * ((base.b - base.r) / d + 2);
      else h = 60 * ((base.r - base.g) / d + 4);
    }
    h = (h + 360 + (rng() * 90 - 45)) % 360;
    const sat = isBoss ? 62 + rng() * 20 : 48 + rng() * 30;
    const light = isBoss ? 42 + rng() * 10 : 52 + rng() * 14;

    return {
      arch,
      pal: [hsl(h, sat, light + 16), hsl(h, sat, light), hsl(h, sat + 8, Math.max(12, light - 32))],
      eyeColor: isBoss ? '#ffe3e3' : '#ffffff',
      pupil: isBoss ? '#ff2b2b' : '#12121a',
      boss: !!isBoss,
      seed: stage * 977 + index * 131,
      scale: isBoss ? 1.45 : 0.82 + rng() * 0.3,
      crown: isBoss,
      aura: isBoss ? zone.accent : null,
      zi
    };
  }

  function critterSpec(def) {
    const seed = hashId(def.id);
    const map = {
      round: 'slime', blob: 'shroom', dragon: 'drake', bear: 'wolf', snake: 'worm',
      ghost: 'ghosty', octo: 'crab', robot: 'cog', angel: 'wisp', maw: 'worm',
      golem: 'golem', star: 'wisp'
    };
    const key = map[def.shape] || 'slime';
    const arch = ARCHETYPES.find(a => a.k === key) || ARCHETYPES[0];
    return {
      arch, pal: def.pal.slice(), eyeColor: '#ffffff', pupil: '#12121a',
      boss: false, seed, scale: 1, crown: false,
      aura: def.shape === 'star' || def.shape === 'angel' ? def.pal[0] : null, zi: 0
    };
  }

  /* ---------------- path builders ---------------- */
  function blobPath(ctx, cx, cy, rx, ry, seed, wob, t) {
    const rng = U.seeded(seed);
    const N = 12;
    const offs = [];
    for (let i = 0; i < N; i++) offs.push(1 + (rng() - 0.5) * wob);
    ctx.beginPath();
    for (let i = 0; i <= N; i++) {
      const a = (i / N) * Math.PI * 2 - Math.PI / 2;
      const k = offs[i % N] + Math.sin(t * 2 + i) * 0.02;
      const x = cx + Math.cos(a) * rx * k;
      const y = cy + Math.sin(a) * ry * k;
      if (i === 0) ctx.moveTo(x, y);
      else {
        const pa = ((i - 1) / N) * Math.PI * 2 - Math.PI / 2;
        const pk = offs[(i - 1) % N] + Math.sin(t * 2 + i - 1) * 0.02;
        const px = cx + Math.cos(pa) * rx * pk, py = cy + Math.sin(pa) * ry * pk;
        const mx = (px + x) / 2, my = (py + y) / 2;
        ctx.quadraticCurveTo(px, py, mx, my);
      }
    }
    ctx.closePath();
  }

  function polyPath(ctx, cx, cy, rx, ry, seed, sides) {
    const rng = U.seeded(seed + 5);
    ctx.beginPath();
    for (let i = 0; i < sides; i++) {
      const a = (i / sides) * Math.PI * 2 - Math.PI / 2;
      const k = 0.82 + rng() * 0.32;
      const x = cx + Math.cos(a) * rx * k, y = cy + Math.sin(a) * ry * k;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
  }

  function ghostPath(ctx, cx, cy, rx, ry, t) {
    ctx.beginPath();
    ctx.moveTo(cx - rx, cy + ry * 0.4);
    ctx.bezierCurveTo(cx - rx, cy - ry * 1.4, cx + rx, cy - ry * 1.4, cx + rx, cy + ry * 0.4);
    const waves = 4;
    for (let i = waves; i >= 0; i--) {
      const x = cx - rx + (2 * rx * i) / waves;
      const y = cy + ry * (0.4 + (i % 2 === 0 ? 0.42 : 0.05) + Math.sin(t * 3 + i) * 0.05);
      ctx.lineTo(x, y);
    }
    ctx.closePath();
  }

  function flamePath(ctx, cx, cy, rx, ry, t) {
    ctx.beginPath();
    ctx.moveTo(cx, cy - ry * 1.25 - Math.sin(t * 4) * ry * 0.08);
    ctx.bezierCurveTo(cx + rx * 1.2, cy - ry * 0.2, cx + rx * 0.9, cy + ry, cx, cy + ry);
    ctx.bezierCurveTo(cx - rx * 0.9, cy + ry, cx - rx * 1.2, cy - ry * 0.2, cx, cy - ry * 1.25);
    ctx.closePath();
  }

  function gearPath(ctx, cx, cy, r, teeth, rot) {
    ctx.beginPath();
    const inner = r * 0.78;
    for (let i = 0; i < teeth * 2; i++) {
      const a = rot + (i / (teeth * 2)) * Math.PI * 2;
      const rr = i % 2 === 0 ? r : inner;
      const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
  }

  /* ---------------- feature drawing ---------------- */
  function drawEye(ctx, x, y, r, spec, look, blink, angry) {
    if (blink) {
      ctx.strokeStyle = spec.pupil; ctx.lineWidth = Math.max(1.4, r * 0.36); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x - r, y); ctx.lineTo(x + r, y); ctx.stroke();
      return;
    }
    ctx.fillStyle = spec.eyeColor;
    ctx.beginPath(); ctx.ellipse(x, y, r, r * 1.05, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = spec.pupil;
    ctx.beginPath(); ctx.ellipse(x + look.x * r * 0.32, y + look.y * r * 0.3, r * 0.5, r * 0.56, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath(); ctx.arc(x - r * 0.24, y - r * 0.3, r * 0.19, 0, Math.PI * 2); ctx.fill();
    if (angry) {
      ctx.strokeStyle = spec.pal[2]; ctx.lineWidth = Math.max(1.6, r * 0.4); ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x - r * 1.25, y - r * 1.5);
      ctx.lineTo(x + r * 0.9, y - r * 0.75);
      ctx.stroke();
    }
  }

  function drawMouth(ctx, kind, cx, cy, w, h, spec, open) {
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const dark = spec.pal[2];
    switch (kind) {
      case 'smile':
        ctx.strokeStyle = dark; ctx.lineWidth = Math.max(1.6, w * 0.09);
        ctx.beginPath(); ctx.arc(cx, cy - h * 0.4, w * 0.5, 0.18 * Math.PI, 0.82 * Math.PI); ctx.stroke();
        break;
      case 'grin': {
        ctx.fillStyle = '#2b0d16';
        ctx.beginPath();
        ctx.moveTo(cx - w * 0.5, cy - h * 0.15);
        ctx.quadraticCurveTo(cx, cy + h * (0.55 + open * 0.5), cx + w * 0.5, cy - h * 0.15);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#fff';
        for (let i = -1; i <= 1; i++) {
          ctx.beginPath();
          ctx.moveTo(cx + i * w * 0.24 - w * 0.08, cy - h * 0.13);
          ctx.lineTo(cx + i * w * 0.24 + w * 0.08, cy - h * 0.13);
          ctx.lineTo(cx + i * w * 0.24, cy + h * 0.16);
          ctx.closePath(); ctx.fill();
        }
        break;
      }
      case 'fangs': {
        ctx.fillStyle = '#2b0d16';
        ctx.beginPath();
        ctx.ellipse(cx, cy, w * 0.36, h * (0.3 + open * 0.55), 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.moveTo(cx - w * 0.22, cy - h * 0.28); ctx.lineTo(cx - w * 0.06, cy - h * 0.28);
        ctx.lineTo(cx - w * 0.14, cy + h * 0.1); ctx.closePath(); ctx.fill();
        ctx.beginPath();
        ctx.moveTo(cx + w * 0.22, cy - h * 0.28); ctx.lineTo(cx + w * 0.06, cy - h * 0.28);
        ctx.lineTo(cx + w * 0.14, cy + h * 0.1); ctx.closePath(); ctx.fill();
        break;
      }
      case 'maw': {
        ctx.fillStyle = '#2b0d16';
        ctx.beginPath(); ctx.arc(cx, cy, w * (0.42 + open * 0.1), 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff';
        const teeth = 8;
        for (let i = 0; i < teeth; i++) {
          const a = (i / teeth) * Math.PI * 2;
          const r1 = w * 0.42, r2 = w * 0.24;
          ctx.beginPath();
          ctx.moveTo(cx + Math.cos(a - 0.2) * r1, cy + Math.sin(a - 0.2) * r1);
          ctx.lineTo(cx + Math.cos(a + 0.2) * r1, cy + Math.sin(a + 0.2) * r1);
          ctx.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2);
          ctx.closePath(); ctx.fill();
        }
        break;
      }
      case 'wide':
        ctx.strokeStyle = dark; ctx.lineWidth = Math.max(1.8, w * 0.1);
        ctx.beginPath(); ctx.moveTo(cx - w * 0.62, cy - h * 0.1);
        ctx.quadraticCurveTo(cx, cy + h * 0.55, cx + w * 0.62, cy - h * 0.1); ctx.stroke();
        break;
      case 'oh':
        ctx.fillStyle = '#2b0d16';
        ctx.beginPath(); ctx.ellipse(cx, cy, w * 0.2, h * 0.32, 0, 0, Math.PI * 2); ctx.fill();
        break;
      case 'flat':
        ctx.strokeStyle = dark; ctx.lineWidth = Math.max(1.6, w * 0.09);
        ctx.beginPath(); ctx.moveTo(cx - w * 0.32, cy); ctx.lineTo(cx + w * 0.32, cy); ctx.stroke();
        break;
      default: break;
    }
  }

  function drawHorns(ctx, cx, cy, r, spec, n) {
    ctx.fillStyle = shade(spec.pal[2], 0.12);
    for (let i = 0; i < n; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const off = (Math.floor(i / 2) + 1) * 0.16;
      const bx = cx + side * r * (0.42 + off * 0.4);
      const by = cy - r * 0.72;
      ctx.beginPath();
      ctx.moveTo(bx - r * 0.1, by);
      ctx.quadraticCurveTo(bx + side * r * 0.18, by - r * 0.5, bx + side * r * 0.34, by - r * 0.62);
      ctx.quadraticCurveTo(bx + side * r * 0.06, by - r * 0.34, bx + r * 0.1, by);
      ctx.closePath(); ctx.fill();
    }
  }

  function drawEars(ctx, cx, cy, r, spec, kind) {
    ctx.fillStyle = spec.pal[1];
    ctx.strokeStyle = spec.pal[2]; ctx.lineWidth = Math.max(1, r * 0.05);
    for (const side of [-1, 1]) {
      ctx.beginPath();
      if (kind === 'tall') {
        ctx.moveTo(cx + side * r * 0.4, cy - r * 0.55);
        ctx.quadraticCurveTo(cx + side * r * 0.72, cy - r * 1.5, cx + side * r * 0.86, cy - r * 0.45);
      } else {
        ctx.moveTo(cx + side * r * 0.55, cy - r * 0.4);
        ctx.quadraticCurveTo(cx + side * r * 1.35, cy - r * 0.75, cx + side * r * 1.0, cy + r * 0.12);
      }
      ctx.quadraticCurveTo(cx + side * r * 0.62, cy - r * 0.1, cx + side * r * 0.36, cy - r * 0.3);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = rgba(spec.pal[0], 0.55);
      ctx.beginPath();
      ctx.ellipse(cx + side * r * (kind === 'tall' ? 0.62 : 0.8), cy - r * (kind === 'tall' ? 0.75 : 0.3),
        r * 0.1, r * 0.26, side * 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = spec.pal[1];
    }
  }

  function drawWings(ctx, cx, cy, r, spec, kind, t) {
    const flap = Math.sin(t * 6) * 0.28;
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.translate(cx + side * r * 0.55, cy - r * 0.15);
      ctx.rotate(side * (0.25 + flap));
      ctx.fillStyle = rgba(spec.pal[2], 0.92);
      ctx.beginPath();
      if (kind === 'bat' || kind === 'dragon') {
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(side * r * 1.1, -r * 0.95, side * r * 1.5, -r * 0.15);
        ctx.lineTo(side * r * 1.05, -r * 0.02);
        ctx.lineTo(side * r * 1.2, r * 0.34);
        ctx.lineTo(side * r * 0.72, r * 0.16);
        ctx.lineTo(side * r * 0.78, r * 0.5);
        ctx.closePath();
      } else {
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(side * r * 1.2, -r * 1.1, side * r * 1.35, r * 0.15);
        ctx.quadraticCurveTo(side * r * 0.8, r * 0.28, 0, 0);
        ctx.closePath();
      }
      ctx.fill();
      ctx.restore();
    }
  }

  function drawLegs(ctx, cx, cy, rx, ry, spec, n, t) {
    ctx.strokeStyle = spec.pal[2];
    ctx.lineWidth = Math.max(2, rx * 0.1); ctx.lineCap = 'round';
    if (n <= 2) {
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(cx + side * rx * 0.34, cy + ry * 0.72);
        ctx.lineTo(cx + side * rx * 0.42, cy + ry * 1.12);
        ctx.stroke();
        ctx.fillStyle = spec.pal[2];
        ctx.beginPath();
        ctx.ellipse(cx + side * rx * 0.46, cy + ry * 1.16, rx * 0.17, ry * 0.09, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      const pairs = Math.floor(n / 2);
      for (let i = 0; i < pairs; i++) {
        const yo = ry * (-0.1 + (i / Math.max(1, pairs - 1)) * 0.75);
        const wig = Math.sin(t * 8 + i) * ry * 0.06;
        for (const side of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(cx + side * rx * 0.6, cy + yo);
          ctx.quadraticCurveTo(cx + side * rx * 1.05, cy + yo + wig, cx + side * rx * 0.95, cy + yo + ry * 0.42);
          ctx.stroke();
        }
      }
    }
  }

  function drawArms(ctx, cx, cy, rx, ry, spec, t, punch) {
    ctx.strokeStyle = spec.pal[1];
    ctx.lineWidth = Math.max(3, rx * 0.14); ctx.lineCap = 'round';
    for (const side of [-1, 1]) {
      const sw = Math.sin(t * 3 + (side > 0 ? 1.5 : 0)) * ry * 0.08 + (punch ? -ry * 0.2 : 0);
      ctx.beginPath();
      ctx.moveTo(cx + side * rx * 0.72, cy - ry * 0.05);
      ctx.quadraticCurveTo(cx + side * rx * 1.05, cy + ry * 0.28 + sw, cx + side * rx * 0.9, cy + ry * 0.55 + sw);
      ctx.stroke();
      ctx.fillStyle = spec.pal[2];
      ctx.beginPath();
      ctx.arc(cx + side * rx * 0.9, cy + ry * 0.58 + sw, rx * 0.13, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawClaws(ctx, cx, cy, rx, ry, spec, t) {
    const snap = Math.abs(Math.sin(t * 4)) * 0.3;
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.translate(cx + side * rx * 1.0, cy + ry * 0.1);
      ctx.rotate(side * 0.3);
      ctx.fillStyle = spec.pal[1];
      ctx.beginPath(); ctx.ellipse(0, 0, rx * 0.3, ry * 0.2, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = spec.pal[2];
      ctx.beginPath();
      ctx.moveTo(0, -ry * 0.02);
      ctx.lineTo(side * rx * 0.4, -ry * (0.16 + snap));
      ctx.lineTo(side * rx * 0.34, ry * 0.02);
      ctx.closePath(); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(0, ry * 0.02);
      ctx.lineTo(side * rx * 0.4, ry * (0.18 + snap));
      ctx.lineTo(side * rx * 0.34, -ry * 0.02);
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }
  }

  function drawTail(ctx, cx, cy, rx, ry, spec, kind, t) {
    const sway = Math.sin(t * 2.5) * 0.25;
    ctx.strokeStyle = spec.pal[1];
    ctx.lineWidth = Math.max(3, rx * 0.13); ctx.lineCap = 'round';
    const sx = cx - rx * 0.8, sy = cy + ry * 0.4;
    if (kind === 'bushy') {
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.quadraticCurveTo(sx - rx * 0.7, sy - ry * (0.2 + sway), sx - rx * 0.55, sy - ry * (0.85 + sway));
      ctx.stroke();
      ctx.fillStyle = spec.pal[0];
      ctx.beginPath();
      ctx.ellipse(sx - rx * 0.55, sy - ry * (0.85 + sway), rx * 0.26, ry * 0.3, -0.4, 0, Math.PI * 2);
      ctx.fill();
    } else if (kind === 'sting') {
      ctx.beginPath();
      ctx.moveTo(sx + rx * 0.2, sy);
      ctx.quadraticCurveTo(cx - rx * 1.1, cy - ry * (0.9 + sway), cx - rx * 0.45, cy - ry * (1.35 + sway));
      ctx.stroke();
      ctx.fillStyle = spec.pal[2];
      ctx.beginPath();
      ctx.moveTo(cx - rx * 0.45, cy - ry * (1.35 + sway));
      ctx.lineTo(cx - rx * 0.16, cy - ry * (1.15 + sway));
      ctx.lineTo(cx - rx * 0.5, cy - ry * (1.05 + sway));
      ctx.closePath(); ctx.fill();
    } else {
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.quadraticCurveTo(sx - rx * 0.75, sy + ry * sway, sx - rx * 0.62, sy - ry * (0.55 + sway));
      ctx.stroke();
      ctx.fillStyle = spec.pal[2];
      ctx.beginPath();
      ctx.moveTo(sx - rx * 0.62, sy - ry * (0.85 + sway));
      ctx.lineTo(sx - rx * 0.44, sy - ry * (0.48 + sway));
      ctx.lineTo(sx - rx * 0.8, sy - ry * (0.48 + sway));
      ctx.closePath(); ctx.fill();
    }
  }

  function drawSpikes(ctx, cx, cy, rx, ry, spec, n) {
    ctx.fillStyle = shade(spec.pal[2], 0.1);
    for (let i = 0; i < n; i++) {
      const a = -Math.PI * 0.85 + (i / Math.max(1, n - 1)) * Math.PI * 0.7;
      const x = cx + Math.cos(a) * rx * 0.9, y = cy + Math.sin(a) * ry * 0.9;
      ctx.save(); ctx.translate(x, y); ctx.rotate(a + Math.PI / 2);
      ctx.beginPath();
      ctx.moveTo(-rx * 0.1, 0); ctx.lineTo(0, -ry * 0.32); ctx.lineTo(rx * 0.1, 0);
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }
  }

  function drawCrystals(ctx, cx, cy, rx, ry, spec, seed) {
    const rng = U.seeded(seed + 99);
    ctx.fillStyle = rgba(spec.pal[0], 0.85);
    for (let i = 0; i < 4; i++) {
      const a = -Math.PI * 0.9 + rng() * Math.PI * 0.8;
      const x = cx + Math.cos(a) * rx * 0.72, y = cy + Math.sin(a) * ry * 0.72;
      const s = ry * (0.16 + rng() * 0.2);
      ctx.save(); ctx.translate(x, y); ctx.rotate(a + Math.PI / 2 + (rng() - 0.5) * 0.6);
      ctx.beginPath();
      ctx.moveTo(0, -s); ctx.lineTo(s * 0.42, 0); ctx.lineTo(0, s * 0.7); ctx.lineTo(-s * 0.42, 0);
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }
  }

  function drawCap(ctx, cx, cy, rx, ry, spec) {
    const g = ctx.createLinearGradient(0, cy - ry * 1.3, 0, cy - ry * 0.2);
    g.addColorStop(0, shade(spec.pal[0], 0.15));
    g.addColorStop(1, spec.pal[2]);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(cx - rx * 1.15, cy - ry * 0.28);
    ctx.quadraticCurveTo(cx, cy - ry * 1.75, cx + rx * 1.15, cy - ry * 0.28);
    ctx.quadraticCurveTo(cx, cy - ry * 0.02, cx - rx * 1.15, cy - ry * 0.28);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = rgba('#ffffff', 0.55);
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.ellipse(cx + i * rx * 0.36, cy - ry * (0.65 + Math.abs(i) * -0.08), rx * 0.13, ry * 0.1, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawCrown(ctx, cx, cy, r, accent) {
    ctx.fillStyle = '#ffd43b';
    ctx.strokeStyle = '#b8860b'; ctx.lineWidth = Math.max(1, r * 0.03);
    const w = r * 0.9, h = r * 0.34, y = cy - r * 1.05;
    ctx.beginPath();
    ctx.moveTo(cx - w / 2, y + h);
    ctx.lineTo(cx - w / 2, y);
    ctx.lineTo(cx - w / 4, y + h * 0.5);
    ctx.lineTo(cx, y - h * 0.28);
    ctx.lineTo(cx + w / 4, y + h * 0.5);
    ctx.lineTo(cx + w / 2, y);
    ctx.lineTo(cx + w / 2, y + h);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = accent || '#ff6b6b';
    ctx.beginPath(); ctx.arc(cx, y + h * 0.55, r * 0.07, 0, Math.PI * 2); ctx.fill();
  }

  /* ---------------- main creature renderer ---------------- */
  /**
   * @param ctx      canvas 2d context
   * @param spec     from monsterSpec()/critterSpec()
   * @param x,y      centre of the body
   * @param size     body radius in px
   * @param t        time in seconds
   * @param o        { hit:0..1, look:{x,y}, dying:0..1, punch:bool, flip:bool }
   */
  function drawCreature(ctx, spec, x, y, size, t, o) {
    o = o || {};
    const a = spec.arch;
    const hit = o.hit || 0;
    const seed = spec.seed || 1;
    const breathe = 1 + Math.sin(t * 2.2 + seed % 7) * 0.035;
    const floatY = a.float ? Math.sin(t * 1.6 + seed % 5) * size * 0.09 : 0;
    const squashX = (a.squish || 1) * (1 + hit * 0.16);
    const squashY = 1 / (1 + hit * 0.2);

    const rx = size * squashX * (a.body === 'wide' ? 1.18 : 1) * breathe;
    const ry = size * squashY * (a.body === 'pear' ? 1.06 : a.body === 'wide' ? 0.82 : 1) * breathe;
    const cx = x, cy = y + floatY;

    ctx.save();
    if (o.flip) { ctx.translate(cx * 2, 0); ctx.scale(-1, 1); }
    ctx.globalAlpha = o.dying ? Math.max(0, 1 - o.dying) : 1;

    /* shadow */
    if (!a.float) {
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      ctx.beginPath();
      ctx.ellipse(cx, cy + ry * 1.16, rx * 0.78, ry * 0.14, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    /* aura */
    if (spec.aura) {
      const pulse = 1 + Math.sin(t * 3) * 0.06;
      const g = ctx.createRadialGradient(cx, cy, size * 0.4, cx, cy, size * 1.9 * pulse);
      g.addColorStop(0, rgba(spec.aura, 0.35));
      g.addColorStop(1, rgba(spec.aura, 0));
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(cx, cy, size * 1.9 * pulse, 0, Math.PI * 2); ctx.fill();
    }

    /* back features */
    if (a.wings) drawWings(ctx, cx, cy, size, spec, a.wings, t);
    if (a.tail) drawTail(ctx, cx, cy, rx, ry, spec, a.tail, t);
    if (a.legs) drawLegs(ctx, cx, cy, rx, ry, spec, a.legs, t);
    if (a.claws) drawClaws(ctx, cx, cy, rx, ry, spec, t);
    if (a.spikes) drawSpikes(ctx, cx, cy, rx, ry, spec, a.spikes);
    if (a.ears) drawEars(ctx, cx, cy, size, spec, a.ears);
    if (a.horns) drawHorns(ctx, cx, cy, size, spec, a.horns);

    /* body */
    const grad = ctx.createLinearGradient(cx - rx, cy - ry, cx + rx * 0.4, cy + ry);
    grad.addColorStop(0, shade(spec.pal[0], 0.12));
    grad.addColorStop(0.55, spec.pal[1]);
    grad.addColorStop(1, spec.pal[2]);
    ctx.fillStyle = grad;
    ctx.strokeStyle = shade(spec.pal[2], -0.25);
    ctx.lineWidth = Math.max(1.5, size * 0.05);

    switch (a.body) {
      case 'blob': blobPath(ctx, cx, cy, rx, ry, seed, 0.16, t); break;
      case 'poly': polyPath(ctx, cx, cy, rx, ry, seed, 7); break;
      case 'ghost': ghostPath(ctx, cx, cy, rx * 0.95, ry * 0.9, t); break;
      case 'flame': flamePath(ctx, cx, cy, rx * 0.85, ry * 0.9, t); break;
      case 'gear': gearPath(ctx, cx, cy, rx, 9, t * 0.6); break;
      case 'pear':
        ctx.beginPath();
        ctx.moveTo(cx - rx * 0.72, cy + ry * 0.72);
        ctx.bezierCurveTo(cx - rx * 1.05, cy - ry * 0.3, cx - rx * 0.6, cy - ry, cx, cy - ry);
        ctx.bezierCurveTo(cx + rx * 0.6, cy - ry, cx + rx * 1.05, cy - ry * 0.3, cx + rx * 0.72, cy + ry * 0.72);
        ctx.quadraticCurveTo(cx, cy + ry * 1.06, cx - rx * 0.72, cy + ry * 0.72);
        ctx.closePath();
        break;
      case 'segment': {
        ctx.beginPath();
        const segs = a.segments || 4;
        for (let i = segs - 1; i >= 0; i--) {
          const sy = cy + Math.sin(t * 3 + i) * ry * 0.1 + i * ry * 0.34;
          const sr = rx * (1 - i * 0.13);
          ctx.moveTo(cx + sr, sy);
          ctx.arc(cx, sy, sr, 0, Math.PI * 2);
        }
        break;
      }
      case 'oval':
      case 'wide':
      case 'round':
      default:
        ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); break;
    }
    ctx.fill(); ctx.stroke();

    /* shell / spots / crystals overlays */
    if (a.shell) {
      ctx.fillStyle = rgba(shade(spec.pal[2], 0.1), 0.6);
      ctx.beginPath(); ctx.ellipse(cx, cy - ry * 0.12, rx * 0.72, ry * 0.6, 0, 0, Math.PI * 2); ctx.fill();
    }
    if (a.spots) {
      const rng = U.seeded(seed + 31);
      ctx.fillStyle = rgba(shade(spec.pal[2], 0.25), 0.55);
      for (let i = 0; i < 4; i++) {
        const ang = rng() * Math.PI * 2, dist = rng() * 0.6;
        ctx.beginPath();
        ctx.ellipse(cx + Math.cos(ang) * rx * dist, cy + Math.sin(ang) * ry * dist + ry * 0.2,
          rx * (0.09 + rng() * 0.09), ry * (0.07 + rng() * 0.07), 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    if (a.crystals) drawCrystals(ctx, cx, cy, rx, ry, spec, seed);
    if (a.cap) drawCap(ctx, cx, cy, rx, ry, spec);

    /* shine */
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.beginPath();
    ctx.ellipse(cx - rx * 0.36, cy - ry * 0.46, rx * 0.26, ry * 0.17, -0.5, 0, Math.PI * 2);
    ctx.fill();

    /* front features */
    if (a.snout) {
      ctx.fillStyle = shade(spec.pal[1], 0.12);
      ctx.beginPath();
      ctx.ellipse(cx, cy + ry * 0.3, rx * 0.42, ry * 0.3, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    if (a.arms) drawArms(ctx, cx, cy, rx, ry, spec, t, o.punch);

    /* eyes */
    const look = o.look || { x: 0, y: 0 };
    const blinkPhase = (t * 0.55 + (seed % 10)) % 4.5;
    const blink = blinkPhase < 0.11;
    const eyeR = size * (a.bulgeEyes ? 0.2 : 0.155);
    const eyeY = cy - ry * (a.body === 'ghost' ? 0.25 : 0.16);
    if (a.eyes === 1) {
      drawEye(ctx, cx, eyeY, eyeR * 1.35, spec, look, blink, spec.boss);
    } else if (a.eyes === 3) {
      drawEye(ctx, cx, eyeY - eyeR * 1.5, eyeR * 0.8, spec, look, blink, spec.boss);
      drawEye(ctx, cx - rx * 0.3, eyeY + eyeR * 0.4, eyeR * 0.85, spec, look, blink, spec.boss);
      drawEye(ctx, cx + rx * 0.3, eyeY + eyeR * 0.4, eyeR * 0.85, spec, look, blink, spec.boss);
    } else if (a.eyes === 4) {
      for (let i = 0; i < 4; i++) {
        drawEye(ctx, cx + (i - 1.5) * rx * 0.3, eyeY, eyeR * 0.62, spec, look, blink, spec.boss);
      }
    } else {
      if (a.bulgeEyes) {
        ctx.fillStyle = spec.pal[1];
        for (const s of [-1, 1]) {
          ctx.beginPath(); ctx.arc(cx + s * rx * 0.36, eyeY - ry * 0.22, eyeR * 1.28, 0, Math.PI * 2); ctx.fill();
        }
        drawEye(ctx, cx - rx * 0.36, eyeY - ry * 0.22, eyeR, spec, look, blink, spec.boss);
        drawEye(ctx, cx + rx * 0.36, eyeY - ry * 0.22, eyeR, spec, look, blink, spec.boss);
      } else {
        drawEye(ctx, cx - rx * 0.32, eyeY, eyeR, spec, look, blink, spec.boss);
        drawEye(ctx, cx + rx * 0.32, eyeY, eyeR, spec, look, blink, spec.boss);
      }
    }

    /* mouth */
    if (a.mouth && a.mouth !== 'none') {
      drawMouth(ctx, a.mouth, cx, cy + ry * 0.42, rx * 0.62, ry * 0.34, spec, hit);
    }

    /* antennae */
    if (a.antennae) {
      ctx.strokeStyle = spec.pal[2]; ctx.lineWidth = Math.max(1.4, size * 0.045); ctx.lineCap = 'round';
      for (const s of [-1, 1]) {
        const w = Math.sin(t * 3 + s) * size * 0.06;
        ctx.beginPath();
        ctx.moveTo(cx + s * rx * 0.22, cy - ry * 0.8);
        ctx.quadraticCurveTo(cx + s * rx * 0.5, cy - ry * 1.25, cx + s * rx * 0.62 + w, cy - ry * 1.45);
        ctx.stroke();
        ctx.fillStyle = spec.pal[0];
        ctx.beginPath(); ctx.arc(cx + s * rx * 0.62 + w, cy - ry * 1.45, size * 0.07, 0, Math.PI * 2); ctx.fill();
      }
    }

    if (spec.crown) drawCrown(ctx, cx, cy - ry * 0.55, size, spec.pal[0]);

    /* hit flash */
    if (hit > 0.02) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = 'rgba(255,255,255,' + (hit * 0.5) + ')';
      ctx.beginPath(); ctx.ellipse(cx, cy, rx * 1.02, ry * 1.02, 0, 0, Math.PI * 2); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    }

    ctx.restore();
  }

  /** Render a creature into an offscreen canvas — used for list icons. */
  function iconDataURL(spec, px) {
    const c = document.createElement('canvas');
    c.width = c.height = px;
    const ctx = c.getContext('2d');
    drawCreature(ctx, spec, px / 2, px / 2 + px * 0.03, px * 0.34, 0.7, {});
    return c.toDataURL();
  }

  CC.sprites = {
    ARCHETYPES, monsterSpec, critterSpec, drawCreature, iconDataURL,
    shade, rgba, hexToRgb
  };
})(window);
