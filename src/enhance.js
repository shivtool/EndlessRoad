/* Endless Road - Visual Enhancer v2 (src/enhance.js)
   Cinematic lighting, colour grading, bloom, clouds, aurora, fireflies, lightning,
   headlight beams, anamorphic flare, fog, chromatic aberration, wet-road reflections,
   lens rain, speed streaks, film grain, vignette and an animated glass HUD.
   Does not change gameplay. */
(function () {
  'use strict';
  if (typeof draw !== 'function' || typeof g === 'undefined' || typeof cv === 'undefined') return;

  // ---- on/off switches (set window.ENH = {name:false} before loading to disable) ----
  const ENH = window.ENH = Object.assign({
    css: true, filter: true, haze: true, sun: true, grade: true, lights: true, wet: true,
    lensRain: true, speedFx: true, vignette: true, grain: true, nitroZoom: true, night: true,
    clouds: true, aurora: true, particles: true, lightning: true, beams: true,
    flare: true, fog: true, chroma: true, nitroGlow: true, bokeh: true,
    golden: true, rainbow: true, birds: true, wiper: false, sparks: true, splash: true,
    heat: true, caveFx: true, auto: true
  }, window.ENH);

  // ---- 1. HUD / UI styling + animations ----
  if (ENH.css) {
    const st = document.createElement('style');
    st.textContent = `
    @keyframes enhGlow{0%,100%{box-shadow:0 8px 28px rgba(0,0,0,.4),0 0 0 rgba(120,200,255,0)}50%{box-shadow:0 8px 28px rgba(0,0,0,.4),0 0 22px rgba(120,200,255,.28)}}
    @keyframes enhShine{0%{background-position:-200% 0}100%{background-position:200% 0}}
    @keyframes enhPulse{0%,100%{box-shadow:0 0 12px rgba(255,150,60,.35)}50%{box-shadow:0 0 24px rgba(255,190,80,.75)}}
    @keyframes enhMsg{0%,100%{text-shadow:0 4px 26px rgba(0,0,0,.65),0 0 14px rgba(255,200,120,.3)}50%{text-shadow:0 4px 26px rgba(0,0,0,.65),0 0 30px rgba(255,210,140,.7)}}
    #hud{background:linear-gradient(135deg,rgba(10,18,30,.62),rgba(10,18,30,.25));backdrop-filter:blur(12px) saturate(1.4);-webkit-backdrop-filter:blur(12px) saturate(1.4);border:1px solid rgba(255,255,255,.18);border-radius:18px;padding:10px 18px;animation:enhGlow 4s ease-in-out infinite;transition:transform .25s ease}
    #lv{background:rgba(10,18,30,.45);backdrop-filter:blur(10px) saturate(1.3);-webkit-backdrop-filter:blur(10px) saturate(1.3);border:1px solid rgba(255,255,255,.15);border-radius:16px;padding:8px 14px;box-shadow:0 6px 22px rgba(0,0,0,.35)}
    #zn{background:linear-gradient(110deg,rgba(10,18,30,.5) 30%,rgba(255,255,255,.18) 50%,rgba(10,18,30,.5) 70%);background-size:200% 100%;animation:enhShine 6s linear infinite;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,.16);border-radius:20px;padding:5px 14px;letter-spacing:.18em}
    #msg{letter-spacing:.05em;animation:enhMsg 2.6s ease-in-out infinite}
    #nb{border-radius:10px;overflow:hidden;animation:enhPulse 1.8s ease-in-out infinite}
    #nf{background:linear-gradient(90deg,#ff5a2a,#ffd24a,#ff5a2a)!important;background-size:200% 100%!important;animation:enhShine 1.6s linear infinite}
    .cb{backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,.28)!important;box-shadow:0 6px 18px rgba(0,0,0,.35);transition:transform .15s ease,box-shadow .2s ease,background .2s ease}
    .cb:hover{box-shadow:0 8px 24px rgba(120,200,255,.35);transform:translateY(-1px)}
    .cb:active{transform:scale(.92)}
    body{-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale}`;
    document.head.appendChild(st);
  }

  // ---- 2. GPU colour boost + nitro zoom on the canvas ----
  if (ENH.filter) cv.style.filter = 'saturate(1.18) contrast(1.07) brightness(1.02)';
  cv.style.transition = 'transform .45s cubic-bezier(.2,.8,.2,1)'; cv.style.transformOrigin = '50% 62%';
  let zoomed = false;

  // ---- helpers ----
  const rgba = (c, a) => 'rgba(' + c.map(Math.round).join(',') + ',' + a + ')';
  const GRADE = ['rgba(70,160,110,.10)', 'rgba(255,170,90,.10)', 'rgba(70,130,220,.12)', 'rgba(210,90,210,.10)', 'rgba(50,200,200,.10)'];
  const R = Math.random, TAU = Math.PI * 2;

  let vk = '', vg = null;
  const vig = () => { const k = W + 'x' + H; if (k !== vk) { vk = k; vg = g.createRadialGradient(W / 2, H * .55, H * .35, W / 2, H * .55, H * .95); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.55)') } return vg };

  const gc = document.createElement('canvas'); gc.width = gc.height = 128;
  { const x = gc.getContext('2d'), id = x.createImageData(128, 128); for (let i = 0; i < id.data.length; i += 4) { id.data[i] = id.data[i + 1] = id.data[i + 2] = R() * 255; id.data[i + 3] = 255 } x.putImageData(id, 0, 0) }
  let gp = null;

  const drops = [];

  // ---- clouds (day) ----
  const CLOUDS = Array.from({ length: 7 }, (_, i) => ({ x: R(), y: .08 + R() * .5, s: .6 + R() * .9, v: .004 + R() * .006, p: Array.from({ length: 6 }, () => [R() * 2 - 1, R() * .5 - .25, .5 + R() * .6]) }));
  function drawClouds(day, w, h) {
    const a0 = day * (1 - rain * .5) * .16; if (a0 < .01) return;
    const lim = HZ * .75;
    g.save(); g.beginPath(); g.rect(0, 0, w, HZ); g.clip();
    for (const c of CLOUDS) {
      const cx = (((c.x + T * c.v) % 1.4) - .2) * w, cy = c.y * lim, sz = h * .09 * c.s;
      for (const [dx, dy, r] of c.p) {
        const x = cx + dx * sz * 1.6, y = cy + dy * sz, rr = r * sz;
        const gr = g.createRadialGradient(x, y, 0, x, y, rr);
        gr.addColorStop(0, 'rgba(255,248,235,' + a0 + ')'); gr.addColorStop(1, 'rgba(255,248,235,0)');
        g.fillStyle = gr; g.beginPath(); g.arc(x, y, rr, 0, TAU); g.fill();
      }
    }
    g.restore();
  }

  // ---- aurora (clear nights) ----
  function drawAurora(n, w, h) {
    const a0 = n * (1 - rain) * .5; if (a0 < .05) return;
    g.save(); g.beginPath(); g.rect(0, 0, w, HZ); g.clip(); g.globalCompositeOperation = 'lighter';
    const cols = [[80, 255, 170], [90, 170, 255], [170, 120, 255]];
    for (let k = 0; k < 3; k++) {
      const base = HZ * (.2 + k * .09), amp = h * (.03 + k * .01);
      const gr = g.createLinearGradient(0, base - h * .12, 0, base + h * .1);
      const c = cols[k];
      gr.addColorStop(0, rgba(c, 0)); gr.addColorStop(.5, rgba(c, a0 * .16)); gr.addColorStop(1, rgba(c, 0));
      g.fillStyle = gr; g.beginPath(); g.moveTo(0, base + h * .1);
      for (let x = 0; x <= w; x += w / 24) {
        const y = base + Math.sin(x * .004 + T * (.25 + k * .1) + k * 2) * amp + Math.sin(x * .011 - T * .4) * amp * .4;
        g.lineTo(x, y - h * .08 * (.6 + .4 * Math.sin(x * .006 + T * .3 + k)));
      }
      g.lineTo(w, base + h * .1); g.closePath(); g.fill();
    }
    g.restore();
  }

  // ---- night sky: half moon, many kinds of stars, shooting stars, milky way ----
  const STARS = Array.from({ length: 190 }, (_, i) => { const r = R(); return { x: R(), y: R(), t: r < .58 ? 0 : r < .78 ? 1 : r < .9 ? 2 : 3, p: R() * 6.28, s: 1 + R() * 3, c: ['#ffffff', '#cfe3ff', '#fff1c9', '#ffd2c2', '#bcd0ff'][i % 5] } });
  let shoot = null;
  function drawNight(n, w, h) {
    const a0 = n * (1 - rain * .8); if (a0 < .04) return;
    const top = HZ * .62, off = (typeof bg === 'number' ? bg : 0) * .03, s = h / 900;
    g.save(); g.beginPath(); g.rect(0, 0, w, HZ); g.clip();
    // milky way band
    g.save(); g.globalCompositeOperation = 'lighter'; g.translate(w * .38, top * .55); g.rotate(-.35); g.scale(3.2, .3);
    const mg = g.createRadialGradient(0, 0, 0, 0, 0, h * .3); mg.addColorStop(0, 'rgba(190,210,255,' + a0 * .12 + ')'); mg.addColorStop(1, 'rgba(190,210,255,0)');
    g.fillStyle = mg; g.beginPath(); g.arc(0, 0, h * .3, 0, 7); g.fill(); g.restore();
    // stars
    g.globalCompositeOperation = 'lighter';
    for (const st of STARS) {
      const x = (((st.x + off) % 1) + 1) % 1 * w, y = st.y * top, tw = .55 + .45 * Math.sin(T * (1.5 + st.s * .5) + st.p), a = a0 * tw * (1 - st.y * .5);
      g.globalAlpha = Math.max(0, a); g.fillStyle = st.c;
      if (st.t === 0) g.fillRect(x, y, s * 1.4, s * 1.4);
      else if (st.t === 1) { g.beginPath(); g.arc(x, y, s * 1.8, 0, 7); g.fill(); g.globalAlpha *= .25; g.beginPath(); g.arc(x, y, s * 5, 0, 7); g.fill() }
      else if (st.t === 2) { const L = s * (6 + st.s * 2), t = s * .9; g.beginPath(); g.moveTo(x - L, y); g.lineTo(x, y - t); g.lineTo(x + L, y); g.lineTo(x, y + t); g.closePath(); g.moveTo(x, y - L); g.lineTo(x + t, y); g.lineTo(x, y + L); g.lineTo(x - t, y); g.closePath(); g.fill() }
      else { g.beginPath(); g.arc(x, y, s * 2.4, 0, 7); g.fill(); g.globalAlpha *= .2; g.beginPath(); g.arc(x, y, s * 9, 0, 7); g.fill() }
    }
    g.globalAlpha = 1;
    // shooting star
    if (!shoot && R() < .004 * a0) shoot = { x: w * .1 + R() * w * .8, y: R() * top * .4, vx: (8 + R() * 6) * s * (R() < .5 ? -1 : 1), vy: (3 + R() * 3) * s, l: 1 };
    if (shoot) {
      const q = shoot; q.x += q.vx * 2; q.y += q.vy * 2; q.l -= .03; const tx = q.x - q.vx * 9, ty = q.y - q.vy * 9, lg = g.createLinearGradient(q.x, q.y, tx, ty);
      lg.addColorStop(0, 'rgba(255,255,255,' + a0 * Math.max(0, q.l) + ')'); lg.addColorStop(1, 'rgba(255,255,255,0)');
      g.strokeStyle = lg; g.lineWidth = 2 * s; g.beginPath(); g.moveTo(q.x, q.y); g.lineTo(tx, ty); g.stroke(); if (q.l <= 0) shoot = null
    }
// half moon with glow, earthshine, craters, and a gleaming star on one tip
    const mx = w * .78 + Math.sin(T * .03) * w * .015, my = top * .42, r = Math.max(18, h * .055);
    
    // Outer atmospheric glow
    const gl = g.createRadialGradient(mx, my, r * .6, mx, my, r * 5.5); 
    gl.addColorStop(0, 'rgba(170,200,255,' + a0 * (.3 + .04 * Math.sin(T * .8)) + ')'); 
    gl.addColorStop(1, 'rgba(170,200,255,0)');
    g.fillStyle = gl; 
    g.beginPath(); 
    g.arc(mx, my, r * 5.5, 0, Math.PI * 2); 
    g.fill();

    g.save();
    g.globalCompositeOperation = 'source-over'; 
    g.globalAlpha = Math.min(1, a0 * 1.2);

    // Earthshine (dark side illuminated by earth)
    g.fillStyle = 'rgba(45,60,100,.65)'; 
    g.beginPath(); 
    g.arc(mx, my, r, Math.PI / 2, Math.PI * 1.5); 
    g.closePath(); 
    g.fill();

    // Lit side of the moon
    const lm = g.createLinearGradient(mx - r, my - r, mx + r, my + r); 
    lm.addColorStop(0, '#ffffee'); 
    lm.addColorStop(0.5, '#e6dec2');
    lm.addColorStop(1, '#b8b095');
    g.fillStyle = lm; 
    g.beginPath(); 
    g.arc(mx, my, r, -Math.PI / 2, Math.PI / 2); 
    g.closePath(); 
    g.fill();

    // Realistic craters with inner shadows and rims
    g.save(); 
    g.beginPath(); 
    g.arc(mx, my, r, -Math.PI / 2, Math.PI / 2); 
    g.closePath(); 
    g.clip(); 
    
    const craters = [
        [.30, -.4, .18, 'rgba(90,80,65,.35)'], 
        [.50, .20, .22, 'rgba(90,80,65,.4)'], 
        [.15, .55, .12, 'rgba(90,80,65,.3)'], 
        [.65, -.15, .10, 'rgba(90,80,65,.35)'],
        [.45, -.10, .14, 'rgba(255,255,255,.2)'] // Crater rim highlight
    ];
    
    for (const [cx, cy, cr, col] of craters) { 
        g.fillStyle = col;
        g.beginPath(); 
        g.arc(mx + cx * r, my + cy * r, cr * r, 0, Math.PI * 2); 
        g.fill(); 
    }
    g.restore();

    // Terminator edge soft highlight & limb glowing stroke
    g.strokeStyle = 'rgba(255,255,240,.65)'; 
    g.lineWidth = 1.4 * s; 
    g.beginPath(); 
    g.arc(mx, my, r, -Math.PI / 2, Math.PI / 2); 
    g.stroke();

    // --- GLEAMING STAR ON THE TOP TIP ---
    const starX = mx;
    const starY = my - r - (4 * s);
    const starPulse = .7 + .3 * Math.sin(T * 3.5);
    const starSize = (6 + 2 * Math.sin(T * 2)) * s;

    g.save();
    g.translate(starX, starY);
    g.scale(starPulse, starPulse);

    // Star glow aura
    const stGlow = g.createRadialGradient(0, 0, 0, 0, 0, starSize * 2.5);
    stGlow.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
    stGlow.addColorStop(0.4, 'rgba(200, 225, 255, 0.4)');
    stGlow.addColorStop(1, 'rgba(150, 200, 255, 0)');
    g.fillStyle = stGlow;
    g.beginPath();
    g.arc(0, 0, starSize * 2.5, 0, Math.PI * 2);
    g.fill();

    // 4-Point Star Shape
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.moveTo(0, -starSize * 1.8);
    g.quadraticCurveTo(0, 0, starSize * 1.8, 0);
    g.quadraticCurveTo(0, 0, 0, starSize * 1.8);
    g.quadraticCurveTo(0, 0, -starSize * 1.8, 0);
    g.quadraticCurveTo(0, 0, 0, -starSize * 1.8);
    g.closePath();
    g.fill();

    g.restore();

    g.globalAlpha = 1;
    g.restore(); // closes moon save
    g.restore(); // closes sky clip save
  }

  // ---- floating dust (day) and fireflies (night) ----
  const PARTS = Array.from({ length: 48 }, () => ({ x: R(), y: R(), v: .3 + R() * .7, p: R() * 6.28, r: .6 + R() * 1.4 }));
  function drawParticles(n, day, w, h, s) {
    const aD = day * (1 - rain) * .35, aN = n * (1 - rain * .7);
    if (aD < .02 && aN < .05) return;
    g.save(); g.globalCompositeOperation = 'lighter';
    for (const p of PARTS) {
      const x = ((((p.x + T * .004 * p.v + Math.sin(T * .4 + p.p) * .02) % 1) + 1) % 1) * w;
      const y = HZ * .9 + ((((p.y - T * .006 * p.v) % 1) + 1) % 1) * (h - HZ * .9);
      const tw = .5 + .5 * Math.sin(T * 2 + p.p), r = p.r * s * 2;
      if (aN > .05) {
        g.fillStyle = 'rgba(190,255,130,' + aN * .75 * tw + ')'; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
        g.fillStyle = 'rgba(190,255,130,' + aN * .12 * tw + ')'; g.beginPath(); g.arc(x, y, r * 5, 0, TAU); g.fill();
      } else {
        g.fillStyle = 'rgba(255,225,150,' + aD * tw + ')'; g.beginPath(); g.arc(x, y, r * .7, 0, TAU); g.fill();
      }
    }
    g.restore();
  }

  // ---- night bokeh lights near the horizon ----
  const BOKEH = Array.from({ length: 14 }, () => ({ x: R(), y: R(), r: .5 + R() * 1, p: R() * 6.28, c: [[255, 200, 120], [120, 190, 255], [255, 130, 160]][(R() * 3) | 0] }));
  function drawBokeh(n, w, h) {
    const a0 = n * (1 - rain * .5) * .16; if (a0 < .015) return;
    g.save(); g.globalCompositeOperation = 'lighter';
    for (const b of BOKEH) {
      const x = ((((b.x + Math.sin(T * .1 + b.p) * .01) % 1) + 1) % 1) * w, y = HZ - h * .02 + b.y * h * .08, r = h * .018 * b.r, a = a0 * (.6 + .4 * Math.sin(T + b.p));
      const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, rgba(b.c, a)); gr.addColorStop(1, rgba(b.c, 0));
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    }
    g.restore();
  }

  // ---- lightning ----
  let flash = 0, bolt = null;
  function drawLightning(w, h, s) {
    if (rain > .55 && R() < .0035 * rain) {
      flash = 1;
      const pts = []; let x = w * (.15 + R() * .7), y = 0;
      while (y < HZ * .9) { pts.push([x, y]); x += (R() - .5) * 50 * s; y += (12 + R() * 22) * s }
      bolt = pts;
    }
    if (flash > .02) {
      if (flash < .5 && flash > .4 && R() < .3) flash = .85; // flicker
      g.save(); g.globalCompositeOperation = 'lighter';
      g.fillStyle = 'rgba(200,215,255,' + flash * .3 + ')'; g.fillRect(0, 0, w, h);
      if (bolt && flash > .3) {
        g.strokeStyle = 'rgba(235,240,255,' + flash + ')'; g.lineWidth = 2.5 * s; g.shadowColor = '#a8c4ff'; g.shadowBlur = 18 * s;
        g.beginPath(); bolt.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.stroke();
      }
      g.restore(); flash *= .87;
    }
  }


  // =====================================================================
  //  EXTRA FEATURES
  // =====================================================================
  // ---- tiny on-screen toast ----
  let tEl = null, tTm = 0;
  function say(msg) {
    try {
      if (!tEl) { tEl = document.createElement('div'); tEl.style.cssText = 'position:fixed;left:50%;bottom:7%;transform:translateX(-50%);padding:6px 16px;border-radius:14px;background:rgba(10,18,30,.6);color:#fff;font:600 13px system-ui,sans-serif;letter-spacing:.08em;z-index:99999;pointer-events:none;opacity:0;transition:opacity .3s;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)'; document.body.appendChild(tEl) }
      tEl.textContent = msg; tEl.style.opacity = 1; clearTimeout(tTm); tTm = setTimeout(() => { tEl.style.opacity = 0 }, 1500);
    } catch (e) { }
  }

  // ---- keys: L = headlights auto/on/off, F9 = all visual FX on/off ----
  ENH.hlMode = ENH.hlMode || 'auto';
  addEventListener('keydown', e => {
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.code === 'KeyL') { ENH.hlMode = ENH.hlMode === 'auto' ? 'on' : ENH.hlMode === 'on' ? 'off' : 'auto'; say('HEADLIGHTS: ' + ENH.hlMode.toUpperCase()) }
    else if (e.code === 'F9') {
      ENH.master = ENH.master === false; e.preventDefault();
      cv.style.filter = (ENH.master !== false && ENH.filter) ? 'saturate(1.18) contrast(1.07) brightness(1.02)' : '';
      say('VISUAL FX: ' + (ENH.master === false ? 'OFF' : 'ON'));
    }
  });

  // ---- automatic performance mode (drops heavy effects on slow devices) ----
  const Q = { lvl: 0, ema: 16, last: 0, bad: 0 };
  function autoQ() {
    if (ENH.auto === false) return;
    const t = performance.now();
    if (Q.last) Q.ema += (Math.min(100, t - Q.last) - Q.ema) * .05;
    Q.last = t;
    if (Q.ema > 28) Q.bad++; else Q.bad = Math.max(0, Q.bad - 1);
    if (Q.bad > 120 && Q.lvl < 2) {
      Q.lvl++; Q.bad = 0; Q.ema = 16;
      (Q.lvl === 1 ? ['grain', 'bokeh', 'particles', 'birds', 'heat', 'splash'] : ['clouds', 'aurora', 'chroma', 'fog', 'flare', 'lensRain', 'sparks']).forEach(k => { ENH[k] = false });
      say('PERFORMANCE MODE ' + Q.lvl);
    }
  }

  // ---- headlights ----
  function lightLevel(n, cave) {
    const m = ENH.hlMode;
    if (m === 'off') return 0;
    let lt = Math.max(n, cave ? .85 : 0, rain > .5 ? .4 : 0);   // auto-on at night, in caves and in storms
    if (m === 'on') lt = Math.max(lt, .9);
    return Math.min(1, lt);
  }

  // Pre-rendered soft beam: bright near the lamp, widens a little, then narrows toward the far end
  // (like light lying on the road), smooth falloff on the sides and along the length. No banding.
  let beamSpr = null;
  function beamSprite() {
    if (beamSpr) return beamSpr;
    const SW = 128, SH = 256, c = document.createElement('canvas'); c.width = SW; c.height = SH;
    const x = c.getContext('2d'), id = x.createImageData(SW, SH), d = id.data;
    for (let py = 0; py < SH; py++) {
      const t = 1 - py / (SH - 1), k = Math.min(1, t / .18), grow = k * k * (3 - 2 * k);
      const hw = (.3 + .7 * grow) * (1 - .78 * Math.max(0, (t - .18) / .82)), I = Math.pow(1 - t, 1.7);
      for (let px = 0; px < SW; px++) {
        const u = Math.abs((px + .5) / SW * 2 - 1) / hw; let a = 0;
        if (u < 1) { const e = 1 - u * u; a = e * e * .75 + Math.exp(-u * u * 7) * .25 }
        const i = (py * SW + px) * 4; d[i] = 255; d[i + 1] = 244; d[i + 2] = 210; d[i + 3] = Math.min(255, a * I * 255);
      }
    }
    x.putImageData(id, 0, 0); return (beamSpr = c);
  }
  function drawBeam(ox, oy, fx, fy, halfW, A) {
    const L = Math.hypot(fx - ox, fy - oy); if (L < 2) return;
    g.save(); g.translate(ox, oy); g.rotate(Math.atan2(fy - oy, fx - ox) + Math.PI / 2); g.globalAlpha = Math.min(1, A);
    g.drawImage(beamSprite(), -halfW, -L, halfW * 2, L); g.restore();
  }

  // ENH.carY (0..1 of screen height) and ENH.carX(w) (pixel offset) line the lights up with the car sprite.
  function drawHeadlights(lt, w, h, s) {
    const cx = w / 2 + (typeof ENH.carX === 'function' ? (+ENH.carX(w) || 0) : 0), ly = h * (ENH.carY || .8);
    const fl = .96 + .04 * Math.sin(T * 9), vol = Math.min(1.6, 1 + rain * .6);
    const oy = ly - h * .03;                                       // beams leave from the FRONT (hood) of the car
    const yFar = Math.max(HZ + h * .02, oy - h * .5), kf = (oy - yFar) / Math.max(1, oy - HZ);
    const halfW = Math.min(w * .05, h * .09);
    g.save(); g.globalCompositeOperation = 'lighter';
    // soft light pool lying on the road just ahead of the car
    g.save(); g.translate(cx, oy - h * .1); g.scale(2.2, .5);
    const pg = g.createRadialGradient(0, 0, 0, 0, 0, h * .18);
    pg.addColorStop(0, 'rgba(255,240,190,' + .12 * lt * fl + ')'); pg.addColorStop(1, 'rgba(255,240,190,0)');
    g.fillStyle = pg; g.beginPath(); g.arc(0, 0, h * .18, 0, TAU); g.fill(); g.restore();
    for (const side of [-1, 1]) {
      const ox = cx + side * w * .032, fx = ox + (cx - ox) * kf;   // converges toward the vanishing point
      if (ENH.beams) {
        drawBeam(ox, oy, fx, yFar, halfW, .5 * lt * fl * vol);
        if (rain > .1) drawBeam(ox, oy, fx, yFar, halfW * 1.7, .16 * rain * lt * fl);   // light scattering in rain / mist
      }
      // gentle light spill on the front corners of the hood
      const gr = h * .03, hg = g.createRadialGradient(ox, oy, 0, ox, oy, gr);
      hg.addColorStop(0, 'rgba(255,248,225,' + .3 * lt * fl + ')'); hg.addColorStop(1, 'rgba(255,230,170,0)');
      g.fillStyle = hg; g.beginPath(); g.arc(ox, oy, gr, 0, TAU); g.fill();
      // red tail-light glow at the rear of the car
      const tx = cx + side * w * .029, ty = ly + h * .012, tr = h * .03, tg = g.createRadialGradient(tx, ty, 0, tx, ty, tr);
      tg.addColorStop(0, 'rgba(255,50,40,' + (.3 + .25 * lt) + ')'); tg.addColorStop(1, 'rgba(255,40,30,0)');
      g.fillStyle = tg; g.beginPath(); g.arc(tx, ty, tr, 0, TAU); g.fill();
    }
    g.restore();
  }

  // ---- wet road: perspective reflection streaks (replaces the old vertical white columns) ----
  function drawWet(lt, w, h, s) {
    const gr = g.createLinearGradient(0, h * .55, 0, h); gr.addColorStop(0, 'rgba(200,220,255,0)'); gr.addColorStop(1, 'rgba(200,220,255,' + rain * .1 + ')');
    g.fillStyle = gr; g.fillRect(0, h * .55, w, h * .45);
    g.save(); g.globalCompositeOperation = 'lighter';
    const col = lt > .3 ? '255,225,170' : '200,220,255', base = rain * (.025 + lt * .1), y0 = HZ + h * .02, y1 = h;
    for (let i = -3; i <= 3; i++) {
      const sh = Math.sin(T * 1.7 + i * 1.3), x0 = w / 2 + i * w * .012 + sh * s, x1 = w / 2 + i * w * .17 + sh * 6 * s;
      const a = base * (1 - Math.abs(i) * .18), lg = g.createLinearGradient(0, y0, 0, y1);
      lg.addColorStop(0, 'rgba(' + col + ',0)'); lg.addColorStop(1, 'rgba(' + col + ',' + a + ')');
      g.fillStyle = lg;
      for (const [k, m] of [[1, .35], [.6, .4], [.28, .5]]) {
        const a0 = 1.5 * s * k, a1 = 26 * s * k; g.globalAlpha = m;
        g.beginPath(); g.moveTo(x0 - a0, y0); g.lineTo(x0 + a0, y0); g.lineTo(x1 + a1, y1); g.lineTo(x1 - a1, y1); g.closePath(); g.fill();
      }
    }
    g.restore();
  }

  // ---- rain splash rings on the road ----
  const splash = [];
  function drawSplash(w, h, s) {
    if (splash.length < 60 && R() < rain * .7) { const y = HZ + h * .1 + R() * (h - HZ - h * .1); splash.push({ x: R() * w, y, l: 0, r: (2 + R() * 3) * s * (.3 + (y - HZ) / (h - HZ)) }) }
    g.save(); g.lineWidth = 1;
    for (let i = splash.length - 1; i >= 0; i--) {
      const p = splash[i]; p.l += .06; if (p.l >= 1) { splash.splice(i, 1); continue }
      const rx = p.r * (1 + p.l * 3); g.strokeStyle = 'rgba(220,235,255,' + (1 - p.l) * .35 + ')'; g.beginPath(); g.ellipse(p.x, p.y, rx, rx * .35, 0, 0, TAU); g.stroke();
    }
    g.restore();
  }

  // ---- heat shimmer at the horizon ----
  function drawHeat(day, w, h, s) {
    const a = day * (1 - rain) * .05 * (curZ === 1 ? 1 : .35); if (a < .008) return;
    g.save(); g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 6; i++) {
      const y = HZ + h * (.004 + i * .007), ox = Math.sin(T * 1.3 + i * 1.7) * w * .02, lg = g.createLinearGradient(0, 0, w, 0);
      lg.addColorStop(0, 'rgba(255,240,210,0)'); lg.addColorStop(.5, 'rgba(255,240,210,' + a * (1 - i * .12) + ')'); lg.addColorStop(1, 'rgba(255,240,210,0)');
      g.fillStyle = lg; g.fillRect(ox - w * .1, y, w * 1.2, Math.max(1, h * .0035));
    }
    g.restore();
  }

  // ---- glowing cave spores ----
  function drawCaveFx(w, h, s) {
    g.save(); g.globalCompositeOperation = 'lighter';
    const tg = g.createLinearGradient(0, 0, 0, h * .35); tg.addColorStop(0, 'rgba(60,200,220,.10)'); tg.addColorStop(1, 'rgba(60,200,220,0)');
    g.fillStyle = tg; g.fillRect(0, 0, w, h * .35);
    for (const p of PARTS) {
      const x = ((((p.x + T * .003 * p.v + Math.sin(T * .5 + p.p) * .02) % 1) + 1) % 1) * w, y = ((((p.y - T * .01 * p.v) % 1) + 1) % 1) * h;
      const tw = .5 + .5 * Math.sin(T * 2.2 + p.p), r = p.r * s * 1.6;
      g.fillStyle = 'rgba(120,230,255,' + .55 * tw + ')'; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
      g.fillStyle = 'rgba(120,230,255,' + .1 * tw + ')'; g.beginPath(); g.arc(x, y, r * 5, 0, TAU); g.fill();
    }
    g.restore();
  }

  // ---- golden hour glow at dawn / dusk ----
  function drawGolden(n, w, h) {
    if (n < .08 || n > .92) return;
    const a = Math.sin(n * Math.PI) * (1 - rain * .7) * .3; if (a < .02) return;
    const gr = g.createLinearGradient(0, HZ - h * .35, 0, HZ + h * .05);
    gr.addColorStop(0, 'rgba(255,120,80,0)'); gr.addColorStop(.7, 'rgba(255,150,70,' + a + ')'); gr.addColorStop(1, 'rgba(255,200,110,' + a * .6 + ')');
    g.save(); g.globalCompositeOperation = 'lighter'; g.fillStyle = gr; g.fillRect(0, HZ - h * .35, w, h * .4); g.restore();
  }

  // ---- rainbow after a storm ----
  let maxRain = 0, rbT = 1;
  function drawRainbow(day, w, h, s) {
    maxRain = Math.max(rain, maxRain * .9995);
    if (maxRain > .45 && rain < .12 && day > .4 && rbT >= 1) { rbT = 0; maxRain = 0 }
    if (rbT >= 1) return;
    rbT += .0012;
    const al = Math.pow(Math.max(0, Math.sin(Math.min(1, rbT) * Math.PI)), .7) * .2 * day;
    const cols = [[255, 70, 70], [255, 150, 60], [255, 230, 80], [90, 220, 110], [70, 160, 255], [110, 100, 230], [170, 90, 220]];
    g.save(); g.beginPath(); g.rect(0, 0, w, HZ + h * .01); g.clip(); g.globalCompositeOperation = 'lighter'; g.lineWidth = h * .014;
    cols.forEach((c, i) => { g.strokeStyle = rgba(c, al); g.beginPath(); g.arc(w * .62, HZ + h * .05, h * .62 + i * h * .0125, Math.PI * 1.12, Math.PI * 1.88); g.stroke() });
    g.restore();
  }

  // ---- birds (day) ----
  const BIRDS = Array.from({ length: 9 }, () => ({ x: R(), y: .15 + R() * .5, v: .006 + R() * .004, p: R() * 6.28, z: .7 + R() * .6 }));
  function drawBirds(day, w, h, s) {
    const a = day * (1 - rain) * .55; if (a < .05) return;
    g.save(); g.beginPath(); g.rect(0, 0, w, HZ); g.clip(); g.strokeStyle = 'rgba(15,20,30,' + a + ')'; g.lineWidth = Math.max(1, 1.4 * s); g.lineCap = 'round';
    for (const b of BIRDS) {
      const x = ((((b.x + T * b.v) % 1.2) + 1.2) % 1.2 - .1) * w, y = (b.y + Math.sin(T * .5 + b.p) * .015) * HZ * .8;
      const z = h * .012 * b.z, f = Math.sin(T * 7 + b.p);
      g.beginPath(); g.moveTo(x - z, y - f * z * .6); g.quadraticCurveTo(x - z * .4, y - z * .5 - f * z * .3, x, y); g.quadraticCurveTo(x + z * .4, y - z * .5 - f * z * .3, x + z, y - f * z * .6); g.stroke();
    }
    g.restore();
  }

  // ---- nitro: flame glow + flying sparks ----
  const sparks = [];
  function drawSparks(nitro, w, h, s) {
    const cy = h * ((ENH.carY || .8) + .08);
    if (nitro && sparks.length < 90) for (let k = 0; k < 3; k++) sparks.push({ x: w / 2 + (R() - .5) * w * .07, y: cy, vx: (R() - .5) * 5 * s, vy: -(2 + R() * 5) * s, l: 1 });
    if (!nitro && !sparks.length) return;
    g.save(); g.globalCompositeOperation = 'lighter'; g.lineCap = 'round';
    if (nitro) {
      const fg = g.createRadialGradient(w / 2, cy, 0, w / 2, cy, h * .12), p = .8 + .2 * Math.sin(T * 25);
      fg.addColorStop(0, 'rgba(255,200,90,' + .5 * p + ')'); fg.addColorStop(.4, 'rgba(255,110,40,' + .25 * p + ')'); fg.addColorStop(1, 'rgba(255,80,30,0)');
      g.fillStyle = fg; g.beginPath(); g.arc(w / 2, cy, h * .12, 0, TAU); g.fill();
    }
    for (let i = sparks.length - 1; i >= 0; i--) {
      const p = sparks[i]; p.x += p.vx; p.y += p.vy; p.vy += .18 * s; p.l -= .03;
      if (p.l <= 0) { sparks.splice(i, 1); continue }
      g.strokeStyle = 'rgba(255,' + ((140 + p.l * 90) | 0) + ',60,' + p.l + ')'; g.lineWidth = Math.max(1, 2 * s * p.l);
      g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x - p.vx * 2, p.y - p.vy * 2); g.stroke();
    }
    g.restore();
  }

  // ---- windscreen wiper in heavy rain (wipes the lens drops away) ----
  function drawWiper(w, h, s) {
    if (rain < .45) return;
    const px = w / 2, py = h * 1.04, len = h * .82, a = -Math.PI / 2 + Math.sin(T * 2.4);
    for (let i = drops.length - 1; i >= 0; i--) {
      const d = drops[i], dx = d.x - px, dy = d.y - py, an = Math.atan2(dy, dx);
      if (Math.hypot(dx, dy) < len + 10 && Math.abs(Math.atan2(Math.sin(an - a), Math.cos(an - a))) < .05) drops.splice(i, 1);
    }
    g.save(); g.strokeStyle = 'rgba(8,10,16,' + .5 * Math.min(1, (rain - .45) * 4) + ')'; g.lineWidth = 5 * s; g.lineCap = 'round';
    g.beginPath(); g.moveTo(px + Math.cos(a) * len * .25, py + Math.sin(a) * len * .25); g.lineTo(px + Math.cos(a) * len, py + Math.sin(a) * len); g.stroke();
    g.restore();
  }

  // ---- 3. post-processing pass, runs after the game draws each frame ----
  function post() {
    if (!started || ENH.master === false) return;
    const n = nightAmt(), day = 1 - n, cave = curZ === 4, sp = Math.min(1.4, speed / MAX), w = W, h = H, s = h / 900;
    const nitro = !!nitOn && state === 'play';
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0);

    // horizon haze for depth
    if (ENH.haze) {
      const c = skyCur[2], gr = g.createLinearGradient(0, HZ - h * .14, 0, HZ + h * .12), a = cave ? .1 : .3;
      gr.addColorStop(0, rgba(c, 0)); gr.addColorStop(.55, rgba(c, a)); gr.addColorStop(1, rgba(c, 0));
      g.fillStyle = gr; g.fillRect(0, HZ - h * .14, w, h * .26);
    }

    // drifting fog bands
    if (ENH.fog && !cave) {
      const c = skyCur[2], a = (.05 + rain * .08) * (.6 + .4 * Math.sin(T * .2));
      for (let i = 0; i < 2; i++) {
        const ox = Math.sin(T * (.08 + i * .05) + i * 3) * w * .12, y = HZ + h * (.01 + i * .03);
        const gr = g.createLinearGradient(0, y - h * .04, 0, y + h * .04);
        gr.addColorStop(0, rgba(c, 0)); gr.addColorStop(.5, rgba(c, a)); gr.addColorStop(1, rgba(c, 0));
        g.fillStyle = gr; g.fillRect(-w * .15 + ox, y - h * .04, w * 1.3, h * .08);
      }
    }

    if (ENH.clouds && !cave) drawClouds(day, w, h);
    if (ENH.night && !cave) drawNight(n, w, h);
    if (ENH.aurora && !cave) drawAurora(n, w, h);
    if (ENH.bokeh && !cave) drawBokeh(n, w, h);
    if (ENH.golden && !cave) drawGolden(n, w, h);
    if (ENH.rainbow && !cave) drawRainbow(day, w, h, s);
    if (ENH.birds && !cave) drawBirds(day, w, h, s);

    // sun bloom, god-rays and lens flare
    if (ENH.sun && !cave && day > .15) {
      const a = day * (1 - rain * .85) * .35, sx = w * .5, sy = HZ * .62;
      g.globalCompositeOperation = 'lighter';
      const gr = g.createRadialGradient(sx, sy, 0, sx, sy, h * .55);
      gr.addColorStop(0, 'rgba(255,225,160,' + a + ')'); gr.addColorStop(.4, 'rgba(255,190,110,' + a * .3 + ')'); gr.addColorStop(1, 'rgba(255,170,90,0)');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      // god-rays: clipped to the sky and faded out toward the horizon (they used to spill onto the road as white columns)
      g.save(); g.beginPath(); g.rect(0, 0, w, HZ); g.clip();
      { const rg = g.createLinearGradient(0, sy - h * .1, 0, HZ); const ra = a * .12 * (.85 + .15 * Math.sin(T * .7)); rg.addColorStop(0, 'rgba(255,230,170,' + ra + ')'); rg.addColorStop(1, 'rgba(255,230,170,0)'); g.fillStyle = rg }
      for (let i = 0; i < 7; i++) { const an = Math.PI * (.1 + i * .13) + Math.sin(T * .1 + i) * .03; g.beginPath(); g.moveTo(sx, sy); g.lineTo(sx + Math.cos(an) * h * 1.3 - h * .05, sy + Math.sin(an) * h * 1.3); g.lineTo(sx + Math.cos(an) * h * 1.3 + h * .05, sy + Math.sin(an) * h * 1.3); g.fill() }
      for (let i = 1; i <= 3; i++) { const fx = sx - i * w * .09, fy = sy + i * h * .035; g.fillStyle = 'rgba(255,220,160,' + a * .15 + ')'; g.beginPath(); g.arc(fx, fy, h * .03 * i, 0, 7); g.fill() }
      g.restore();
      // anamorphic horizontal streak
      if (ENH.flare) {
        const lg = g.createLinearGradient(0, 0, w, 0);
        lg.addColorStop(0, 'rgba(120,180,255,0)'); lg.addColorStop(.5, 'rgba(190,220,255,' + a * .55 + ')'); lg.addColorStop(1, 'rgba(120,180,255,0)');
        g.fillStyle = lg; g.fillRect(0, sy - 1.5 * s, w, 3 * s);
        const lg2 = g.createLinearGradient(w * .2, 0, w * .8, 0);
        lg2.addColorStop(0, 'rgba(255,255,255,0)'); lg2.addColorStop(.5, 'rgba(255,255,255,' + a * .35 + ')'); lg2.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = lg2; g.fillRect(w * .2, sy - .6 * s, w * .6, 1.2 * s);
      }
      g.globalCompositeOperation = 'source-over';
    }

    // colour grading per zone + night blue
    if (ENH.grade) {
      g.globalCompositeOperation = 'soft-light'; g.fillStyle = GRADE[curZ] || GRADE[0]; g.fillRect(0, 0, w, h);
      if (n > .05) { g.globalCompositeOperation = 'multiply'; g.fillStyle = 'rgba(40,60,130,' + n * .22 + ')'; g.fillRect(0, 0, w, h) }
      g.globalCompositeOperation = 'source-over';
    }

    // headlights: ground pool, tapered beams, lamp glow (press L: auto / on / off)
    const lt = lightLevel(n, cave);
    if (ENH.lights && lt > .05 && state === 'play') drawHeadlights(lt, w, h, s);

    // wet-road gloss + perspective reflections, splashes, heat shimmer, cave spores
    if (ENH.wet && rain > .15) drawWet(lt, w, h, s);
    if (ENH.splash && rain > .2) drawSplash(w, h, s);
    if (ENH.heat && !cave) drawHeat(day, w, h, s);
    if (ENH.caveFx && cave) drawCaveFx(w, h, s);

    if (ENH.particles) drawParticles(n, day, w, h, s);

    // speed streaks at the screen edges
    if (ENH.speedFx && sp > .7 && state === 'play') {
      const k = Math.floor((sp - .7) * 24); g.strokeStyle = 'rgba(255,255,255,' + (.06 + (sp - .7) * .12) + ')'; g.lineWidth = Math.max(1, s * 1.4); g.beginPath();
      for (let i = 0; i < k; i++) { const an = R() * 6.283, r1 = h * (.45 + R() * .1), r2 = r1 + h * (.1 + sp * .12); g.moveTo(w / 2 + Math.cos(an) * r1 * 1.6, HZ + Math.sin(an) * r1); g.lineTo(w / 2 + Math.cos(an) * r2 * 1.6, HZ + Math.sin(an) * r2) }
      g.stroke();
    }

    // chromatic aberration at the edges (speed / nitro)
    if (ENH.chroma && state === 'play' && (sp > .8 || nitro)) {
      const k = Math.min(1, (sp - .8) * 2.5 + (nitro ? .5 : 0)), bw = w * .09;
      g.globalCompositeOperation = 'lighter';
      let lg = g.createLinearGradient(0, 0, bw, 0); lg.addColorStop(0, 'rgba(255,40,60,' + .12 * k + ')'); lg.addColorStop(1, 'rgba(255,40,60,0)');
      g.fillStyle = lg; g.fillRect(0, 0, bw, h);
      lg = g.createLinearGradient(w, 0, w - bw, 0); lg.addColorStop(0, 'rgba(40,200,255,' + .12 * k + ')'); lg.addColorStop(1, 'rgba(40,200,255,0)');
      g.fillStyle = lg; g.fillRect(w - bw, 0, bw, h);
      g.globalCompositeOperation = 'source-over';
    }

    // nitro edge glow
    if (ENH.nitroGlow && nitro) {
      const p = .75 + .25 * Math.sin(T * 10);
      g.globalCompositeOperation = 'lighter';
      const gr = g.createRadialGradient(w / 2, h * .6, h * .35, w / 2, h * .6, h * .9);
      gr.addColorStop(0, 'rgba(255,120,40,0)'); gr.addColorStop(1, 'rgba(255,120,40,' + .22 * p + ')');
      g.fillStyle = gr; g.fillRect(0, 0, w, h); g.globalCompositeOperation = 'source-over';
    }

    if (ENH.sparks) drawSparks(nitro, w, h, s);

    // raindrops on the lens
    if (ENH.lensRain) {
      if (rain > .3 && drops.length < 40 && R() < rain * .5) drops.push({ x: R() * w, y: R() * h * .8, r: (3 + R() * 6) * s, v: 0, l: 1 });
      for (let i = drops.length - 1; i >= 0; i--) {
        const d = drops[i]; d.v += .015 * s; if (R() < .02) d.v += .4 * s; d.y += d.v; d.l -= .004; if (d.l <= 0 || d.y > h) { drops.splice(i, 1); continue }
        g.globalAlpha = Math.min(1, d.l * 1.5); g.fillStyle = 'rgba(255,255,255,.07)'; g.beginPath(); g.ellipse(d.x, d.y, d.r * .8, d.r, 0, 0, 7); g.fill();
        g.strokeStyle = 'rgba(255,255,255,.3)'; g.lineWidth = 1; g.stroke();
        g.fillStyle = 'rgba(255,255,255,.55)'; g.beginPath(); g.arc(d.x - d.r * .25, d.y - d.r * .35, d.r * .2, 0, 7); g.fill();
      }
      g.globalAlpha = 1;
    }

    if (ENH.wiper) drawWiper(w, h, s);
    if (ENH.lightning) drawLightning(w, h, s);

    // vignette
    if (ENH.vignette) {
      g.globalCompositeOperation = 'multiply'; g.fillStyle = vig(); g.fillRect(0, 0, w, h);
      if (sp > .6 && state === 'play') { const tg = g.createRadialGradient(w / 2, h * .58, h * .25, w / 2, h * .58, h * .85); tg.addColorStop(0, 'rgba(0,0,0,0)'); tg.addColorStop(1, 'rgba(0,0,0,' + Math.min(.35, (sp - .6) * .4) + ')'); g.fillStyle = tg; g.fillRect(0, 0, w, h) }
      g.globalCompositeOperation = 'source-over'
    }

    // film grain
    if (ENH.grain) {
      gp = gp || g.createPattern(gc, 'repeat'); g.globalCompositeOperation = 'overlay'; g.globalAlpha = .05;
      g.translate(R() * 128, R() * 128); g.fillStyle = gp; g.fillRect(-128, -128, w + 256, h + 256);
    }
    g.restore();

    // nitro zoom
    if (ENH.nitroZoom) { if (nitro !== zoomed) { zoomed = nitro; cv.style.transform = nitro ? 'scale(1.05)' : 'scale(1)' } }
  }

  // ---- hook into the game's draw ----
  const _draw = draw;
  draw = function () { try { autoQ() } catch (e) { } _draw(); try { post() } catch (e) { ENH.err = e } };
})();
