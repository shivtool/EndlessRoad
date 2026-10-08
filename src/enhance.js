/* Endless Road - Visual Enhancer v2 (src/enhance.js)
   Cinematic lighting, colour grading, bloom, clouds, aurora, fireflies, lightning,
   headlight beams, anamorphic flare, fog, chromatic aberration, wet-road reflections,
   lens rain, speed streaks, film grain, vignette and an animated glass HUD.
   Does not change gameplay. */
(function () {
  'use strict';
  if (typeof draw !== 'function' || typeof g === 'undefined') return;

  // ---- on/off switches (set window.ENH = {name:false} before loading to disable) ----
  const ENH = window.ENH = Object.assign({
    css: true, filter: true, haze: true, sun: true, grade: true, lights: true, wet: true,
    lensRain: true, speedFx: true, vignette: true, grain: true, nitroZoom: true, night: true,
    clouds: true, aurora: true, particles: true, lightning: true, beams: true,
    flare: true, fog: true, chroma: true, nitroGlow: true, bokeh: true
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
    if (shoot) { const q = shoot; q.x += q.vx * 2; q.y += q.vy * 2; q.l -= .03; const tx = q.x - q.vx * 9, ty = q.y - q.vy * 9, lg = g.createLinearGradient(q.x, q.y, tx, ty);
      lg.addColorStop(0, 'rgba(255,255,255,' + a0 * Math.max(0, q.l) + ')'); lg.addColorStop(1, 'rgba(255,255,255,0)');
      g.strokeStyle = lg; g.lineWidth = 2 * s; g.beginPath(); g.moveTo(q.x, q.y); g.lineTo(tx, ty); g.stroke(); if (q.l <= 0) shoot = null }
    // half moon with glow, earthshine, craters
    const mx = w * .78 + Math.sin(T * .03) * w * .015, my = top * .42, r = Math.max(18, h * .055);
    const gl = g.createRadialGradient(mx, my, r * .6, mx, my, r * 5.5); gl.addColorStop(0, 'rgba(170,200,255,' + a0 * (.3 + .04 * Math.sin(T * .8)) + ')'); gl.addColorStop(1, 'rgba(170,200,255,0)');
    g.fillStyle = gl; g.beginPath(); g.arc(mx, my, r * 5.5, 0, 7); g.fill();
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = Math.min(1, a0 * 1.2);
    g.fillStyle = 'rgba(40,55,95,.55)'; g.beginPath(); g.arc(mx, my, r, Math.PI / 2, Math.PI * 1.5); g.closePath(); g.fill();
    const lm = g.createLinearGradient(mx, my - r, mx + r, my + r); lm.addColorStop(0, '#fffbe8'); lm.addColorStop(1, '#d9d2b8');
    g.fillStyle = lm; g.beginPath(); g.arc(mx, my, r, -Math.PI / 2, Math.PI / 2); g.closePath(); g.fill();
    g.save(); g.beginPath(); g.arc(mx, my, r, -Math.PI / 2, Math.PI / 2); g.closePath(); g.clip(); g.fillStyle = 'rgba(120,110,90,.28)';
    for (const [cx, cy, cr] of [[.35, -.3, .16], [.55, .25, .2], [.2, .5, .11], [.7, -.1, .09]]) { g.beginPath(); g.arc(mx + cx * r, my + cy * r, cr * r, 0, 7); g.fill() }
    g.restore();
    g.strokeStyle = 'rgba(255,250,225,.5)'; g.lineWidth = 1.2 * s; g.beginPath(); g.arc(mx, my, r, -Math.PI / 2, Math.PI / 2); g.stroke();
    g.globalAlpha = 1; g.restore();
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
      const x = ((b.x + Math.sin(T * .1 + b.p) * .01) % 1) * w, y = HZ - h * .02 + b.y * h * .08, r = h * .018 * b.r, a = a0 * (.6 + .4 * Math.sin(T + b.p));
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

  // ---- 3. post-processing pass, runs after the game draws each frame ----
  function post() {
    if (!started) return;
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

    // sun bloom, god-rays and lens flare
    if (ENH.sun && !cave && day > .15) {
      const a = day * (1 - rain * .85) * .35, sx = w * .5, sy = HZ * .62;
      g.globalCompositeOperation = 'lighter';
      const gr = g.createRadialGradient(sx, sy, 0, sx, sy, h * .55);
      gr.addColorStop(0, 'rgba(255,225,160,' + a + ')'); gr.addColorStop(.4, 'rgba(255,190,110,' + a * .3 + ')'); gr.addColorStop(1, 'rgba(255,170,90,0)');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      g.fillStyle = 'rgba(255,230,170,' + a * .12 * (.85 + .15 * Math.sin(T * .7)) + ')';
      for (let i = 0; i < 7; i++) { const an = Math.PI * (.1 + i * .13) + Math.sin(T * .1 + i) * .03; g.beginPath(); g.moveTo(sx, sy); g.lineTo(sx + Math.cos(an) * h * 1.3 - h * .05, sy + Math.sin(an) * h * 1.3); g.lineTo(sx + Math.cos(an) * h * 1.3 + h * .05, sy + Math.sin(an) * h * 1.3); g.fill() }
      for (let i = 1; i <= 3; i++) { const fx = sx + (w * .5 - sx) * i * .5, fy = sy + (h * .7 - sy) * i * .45; g.fillStyle = 'rgba(255,220,160,' + a * .15 + ')'; g.beginPath(); g.arc(fx, fy, h * .03 * i, 0, 7); g.fill() }
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

    // headlight pool + beams on the road (night / cave)
    const lt = Math.max(n, cave ? .85 : 0);
    if (ENH.lights && lt > .05 && state === 'play') {
      g.globalCompositeOperation = 'lighter'; g.save(); g.translate(w / 2, h * .72); g.scale(1.9, .55);
      const gr = g.createRadialGradient(0, 0, 0, 0, 0, h * .38); gr.addColorStop(0, 'rgba(255,240,190,' + .2 * lt + ')'); gr.addColorStop(1, 'rgba(255,240,190,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(0, 0, h * .38, 0, 7); g.fill(); g.restore();
      if (ENH.beams) {
        const fl = .92 + .08 * Math.sin(T * 9);
        for (const side of [-1, 1]) {
          const bx = w / 2 + side * w * .045, by = h * .8;
          const lg = g.createLinearGradient(bx, by, w / 2 + side * w * .012, HZ);
          lg.addColorStop(0, 'rgba(255,240,200,' + .16 * lt * fl + ')'); lg.addColorStop(1, 'rgba(255,240,200,0)');
          g.fillStyle = lg; g.beginPath(); g.moveTo(bx - w * .015, by); g.lineTo(bx + w * .015, by);
          g.lineTo(w / 2 + side * w * .09, HZ); g.lineTo(w / 2 - side * w * .02, HZ); g.closePath(); g.fill();
        }
      }
      g.globalCompositeOperation = 'source-over';
    }

    // wet-road gloss + light reflections
    if (ENH.wet && rain > .15) {
      const gr = g.createLinearGradient(0, h * .55, 0, h); gr.addColorStop(0, 'rgba(200,220,255,0)'); gr.addColorStop(1, 'rgba(200,220,255,' + rain * .1 + ')');
      g.fillStyle = gr; g.fillRect(0, h * .55, w, h * .45);
      g.globalCompositeOperation = 'lighter';
      for (let i = -2; i <= 2; i++) { const x = w / 2 + i * w * .07 + Math.sin(T * 2 + i) * 4 * s, lg = g.createLinearGradient(0, h * .62, 0, h); lg.addColorStop(0, 'rgba(255,230,180,0)'); lg.addColorStop(1, 'rgba(255,230,180,' + rain * (.05 + lt * .08) + ')'); g.fillStyle = lg; g.fillRect(x - 3 * s, h * .62, 6 * s, h * .38) }
      g.globalCompositeOperation = 'source-over';
    }

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

    if (ENH.lightning) drawLightning(w, h, s);

    // vignette
    if (ENH.vignette) { g.globalCompositeOperation = 'multiply'; g.fillStyle = vig(); g.fillRect(0, 0, w, h); g.globalCompositeOperation = 'source-over' }

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
  draw = function () { _draw(); try { post() } catch (e) { ENH.err = e } };
})();
