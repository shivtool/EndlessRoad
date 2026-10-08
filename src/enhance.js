/* Endless Road - Visual Enhancer (src/enhance.js)
   Adds cinematic lighting, colour grading, bloom, wet-road reflections, lens rain,
   speed blur, film grain, vignette and a glass-style HUD. Does not change gameplay. */
(function () {
  'use strict';
  if (typeof draw !== 'function' || typeof g === 'undefined') return;

  // ---- on/off switches (set false to disable a feature) ----
  const ENH = window.ENH = Object.assign({ css: true, filter: true, haze: true, sun: true, grade: true, lights: true, wet: true, lensRain: true, speedFx: true, vignette: true, grain: true, nitroZoom: true, night: true }, window.ENH);

  // ---- 1. HUD / UI styling ----
  if (ENH.css) {
    const st = document.createElement('style');
    st.textContent = `
    #hud{background:linear-gradient(135deg,rgba(10,18,30,.6),rgba(10,18,30,.25));backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,.16);border-radius:18px;padding:10px 18px;box-shadow:0 8px 28px rgba(0,0,0,.4)}
    #lv{background:rgba(10,18,30,.45);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,.14);border-radius:16px;padding:8px 14px;box-shadow:0 6px 22px rgba(0,0,0,.35)}
    #zn{background:rgba(10,18,30,.45);backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,.14);border-radius:20px;padding:5px 14px;letter-spacing:.18em}
    #msg{text-shadow:0 4px 26px rgba(0,0,0,.65),0 0 18px rgba(255,200,120,.35);letter-spacing:.05em}
    #nb{border-radius:10px;overflow:hidden;box-shadow:0 0 14px rgba(255,150,60,.4)}
    #nf{background:linear-gradient(90deg,#ff5a2a,#ffd24a)!important}
    .cb{backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,.25)!important;box-shadow:0 6px 18px rgba(0,0,0,.35)}
    .cb:active{transform:scale(.92)}`;
    document.head.appendChild(st);
  }

  // ---- 2. GPU colour boost + nitro zoom on the canvas ----
  if (ENH.filter) cv.style.filter = 'saturate(1.15) contrast(1.06) brightness(1.02)';
  cv.style.transition = 'transform .35s ease-out'; cv.style.transformOrigin = '50% 62%';
  let zoomed = false;

  // ---- helpers ----
  const rgba = (c, a) => 'rgba(' + c.map(Math.round).join(',') + ',' + a + ')';
  const GRADE = ['rgba(70,160,110,.10)', 'rgba(255,170,90,.10)', 'rgba(70,130,220,.12)', 'rgba(210,90,210,.10)', 'rgba(50,200,200,.10)'];

  let vk = '', vg = null;
  const vig = () => { const k = W + 'x' + H; if (k !== vk) { vk = k; vg = g.createRadialGradient(W / 2, H * .55, H * .35, W / 2, H * .55, H * .95); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.55)') } return vg };

  const gc = document.createElement('canvas'); gc.width = gc.height = 128;
  { const x = gc.getContext('2d'), id = x.createImageData(128, 128); for (let i = 0; i < id.data.length; i += 4) { id.data[i] = id.data[i + 1] = id.data[i + 2] = Math.random() * 255; id.data[i + 3] = 255 } x.putImageData(id, 0, 0) }
  let gp = null;

  const drops = [];

  // ---- night sky: half moon, many kinds of stars, shooting stars, milky way ----
  const STARS = Array.from({ length: 170 }, (_, i) => { const r = Math.random(); return { x: Math.random(), y: Math.random(), t: r < .58 ? 0 : r < .78 ? 1 : r < .9 ? 2 : 3, p: Math.random() * 6.28, s: 1 + Math.random() * 3, c: ['#ffffff', '#cfe3ff', '#fff1c9', '#ffd2c2', '#bcd0ff'][i % 5] } });
  let shoot = null;
  function drawNight(n, w, h) {
    const a0 = n * (1 - rain * .8); if (a0 < .04) return;
    const top = HZ * .62, off = (typeof bg === 'number' ? bg : 0) * .03, s = h / 900;
    g.save(); g.beginPath(); g.rect(0, 0, w, HZ); g.clip();
    // milky way band
    g.save(); g.globalCompositeOperation = 'lighter'; g.translate(w * .38, top * .55); g.rotate(-.35); g.scale(3.2, .3);
    const mg = g.createRadialGradient(0, 0, 0, 0, 0, h * .3); mg.addColorStop(0, 'rgba(190,210,255,' + a0 * .1 + ')'); mg.addColorStop(1, 'rgba(190,210,255,0)');
    g.fillStyle = mg; g.beginPath(); g.arc(0, 0, h * .3, 0, 7); g.fill(); g.restore();
    // stars: dots, glowing, 4-point sparkles, bright coloured
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
    if (!shoot && Math.random() < .003 * a0) shoot = { x: w * .1 + Math.random() * w * .8, y: Math.random() * top * .4, vx: (8 + Math.random() * 6) * s * (Math.random() < .5 ? -1 : 1), vy: (3 + Math.random() * 3) * s, l: 1 };
    if (shoot) { const q = shoot; q.x += q.vx * 2; q.y += q.vy * 2; q.l -= .03; const tx = q.x - q.vx * 8, ty = q.y - q.vy * 8, lg = g.createLinearGradient(q.x, q.y, tx, ty);
      lg.addColorStop(0, 'rgba(255,255,255,' + a0 * Math.max(0, q.l) + ')'); lg.addColorStop(1, 'rgba(255,255,255,0)');
      g.strokeStyle = lg; g.lineWidth = 2 * s; g.beginPath(); g.moveTo(q.x, q.y); g.lineTo(tx, ty); g.stroke(); if (q.l <= 0) shoot = null }
    // half moon with glow, earthshine, craters
    const mx = w * .78 + Math.sin(T * .03) * w * .015, my = top * .42, r = Math.max(18, h * .055);
    const gl = g.createRadialGradient(mx, my, r * .6, mx, my, r * 5); gl.addColorStop(0, 'rgba(170,200,255,' + a0 * .28 + ')'); gl.addColorStop(1, 'rgba(170,200,255,0)');
    g.fillStyle = gl; g.beginPath(); g.arc(mx, my, r * 5, 0, 7); g.fill();
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

  // ---- 3. post-processing pass, runs after the game draws each frame ----
  function post() {
    if (!started) return;
    const n = nightAmt(), day = 1 - n, cave = curZ === 4, sp = Math.min(1.4, speed / MAX), w = W, h = H, s = h / 900;
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0);

    // horizon haze for depth
    if (ENH.haze) {
      const c = skyCur[2], gr = g.createLinearGradient(0, HZ - h * .14, 0, HZ + h * .12), a = cave ? .1 : .3;
      gr.addColorStop(0, rgba(c, 0)); gr.addColorStop(.55, rgba(c, a)); gr.addColorStop(1, rgba(c, 0));
      g.fillStyle = gr; g.fillRect(0, HZ - h * .14, w, h * .26);
    }

    if (ENH.night && !cave) drawNight(n, w, h);

    // sun bloom, god-rays and lens flare
    if (ENH.sun && !cave && day > .15) {
      const a = day * (1 - rain * .85) * .35, sx = w * .5, sy = HZ * .62;
      g.globalCompositeOperation = 'lighter';
      const gr = g.createRadialGradient(sx, sy, 0, sx, sy, h * .55);
      gr.addColorStop(0, 'rgba(255,225,160,' + a + ')'); gr.addColorStop(.4, 'rgba(255,190,110,' + a * .3 + ')'); gr.addColorStop(1, 'rgba(255,170,90,0)');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      g.fillStyle = 'rgba(255,230,170,' + a * .12 + ')';
      for (let i = 0; i < 7; i++) { const an = Math.PI * (.1 + i * .13) + Math.sin(T * .1 + i) * .03; g.beginPath(); g.moveTo(sx, sy); g.lineTo(sx + Math.cos(an) * h * 1.3 - h * .05, sy + Math.sin(an) * h * 1.3); g.lineTo(sx + Math.cos(an) * h * 1.3 + h * .05, sy + Math.sin(an) * h * 1.3); g.fill() }
      for (let i = 1; i <= 3; i++) { const fx = sx + (w * .5 - sx) * i * .5, fy = sy + (h * .7 - sy) * i * .45; g.fillStyle = 'rgba(255,220,160,' + a * .15 + ')'; g.beginPath(); g.arc(fx, fy, h * .03 * i, 0, 7); g.fill() }
      g.globalCompositeOperation = 'source-over';
    }

    // colour grading per zone + night blue
    if (ENH.grade) {
      g.globalCompositeOperation = 'soft-light'; g.fillStyle = GRADE[curZ] || GRADE[0]; g.fillRect(0, 0, w, h);
      if (n > .05) { g.globalCompositeOperation = 'multiply'; g.fillStyle = 'rgba(40,60,130,' + n * .22 + ')'; g.fillRect(0, 0, w, h) }
      g.globalCompositeOperation = 'source-over';
    }

    // headlight pool on the road (night / cave)
    const lt = Math.max(n, cave ? .85 : 0);
    if (ENH.lights && lt > .05 && state === 'play') {
      g.globalCompositeOperation = 'lighter'; g.save(); g.translate(w / 2, h * .72); g.scale(1.9, .55);
      const gr = g.createRadialGradient(0, 0, 0, 0, 0, h * .38); gr.addColorStop(0, 'rgba(255,240,190,' + .2 * lt + ')'); gr.addColorStop(1, 'rgba(255,240,190,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(0, 0, h * .38, 0, 7); g.fill(); g.restore(); g.globalCompositeOperation = 'source-over';
    }

    // wet-road gloss + light reflections
    if (ENH.wet && rain > .15) {
      const gr = g.createLinearGradient(0, h * .55, 0, h); gr.addColorStop(0, 'rgba(200,220,255,0)'); gr.addColorStop(1, 'rgba(200,220,255,' + rain * .1 + ')');
      g.fillStyle = gr; g.fillRect(0, h * .55, w, h * .45);
      g.globalCompositeOperation = 'lighter';
      for (let i = -2; i <= 2; i++) { const x = w / 2 + i * w * .07 + Math.sin(T * 2 + i) * 4 * s, lg = g.createLinearGradient(0, h * .62, 0, h); lg.addColorStop(0, 'rgba(255,230,180,0)'); lg.addColorStop(1, 'rgba(255,230,180,' + rain * (.05 + lt * .08) + ')'); g.fillStyle = lg; g.fillRect(x - 3 * s, h * .62, 6 * s, h * .38) }
      g.globalCompositeOperation = 'source-over';
    }

    // speed streaks at the screen edges
    if (ENH.speedFx && sp > .7 && state === 'play') {
      const k = Math.floor((sp - .7) * 24); g.strokeStyle = 'rgba(255,255,255,' + (.06 + (sp - .7) * .12) + ')'; g.lineWidth = Math.max(1, s * 1.4); g.beginPath();
      for (let i = 0; i < k; i++) { const an = Math.random() * 6.283, r1 = h * (.45 + Math.random() * .1), r2 = r1 + h * (.1 + sp * .12); g.moveTo(w / 2 + Math.cos(an) * r1 * 1.6, HZ + Math.sin(an) * r1); g.lineTo(w / 2 + Math.cos(an) * r2 * 1.6, HZ + Math.sin(an) * r2) }
      g.stroke();
    }

    // raindrops on the lens
    if (ENH.lensRain) {
      if (rain > .3 && drops.length < 40 && Math.random() < rain * .5) drops.push({ x: Math.random() * w, y: Math.random() * h * .8, r: (3 + Math.random() * 6) * s, v: 0, l: 1 });
      for (let i = drops.length - 1; i >= 0; i--) {
        const d = drops[i]; d.v += .015 * s; if (Math.random() < .02) d.v += .4 * s; d.y += d.v; d.l -= .004; if (d.l <= 0 || d.y > h) { drops.splice(i, 1); continue }
        g.globalAlpha = Math.min(1, d.l * 1.5); g.fillStyle = 'rgba(255,255,255,.07)'; g.beginPath(); g.ellipse(d.x, d.y, d.r * .8, d.r, 0, 0, 7); g.fill();
        g.strokeStyle = 'rgba(255,255,255,.3)'; g.lineWidth = 1; g.stroke();
        g.fillStyle = 'rgba(255,255,255,.55)'; g.beginPath(); g.arc(d.x - d.r * .25, d.y - d.r * .35, d.r * .2, 0, 7); g.fill();
      }
      g.globalAlpha = 1;
    }

    // vignette
    if (ENH.vignette) { g.globalCompositeOperation = 'multiply'; g.fillStyle = vig(); g.fillRect(0, 0, w, h); g.globalCompositeOperation = 'source-over' }

    // film grain
    if (ENH.grain) {
      gp = gp || g.createPattern(gc, 'repeat'); g.globalCompositeOperation = 'overlay'; g.globalAlpha = .05;
      g.translate(Math.random() * 128, Math.random() * 128); g.fillStyle = gp; g.fillRect(-128, -128, w + 256, h + 256);
    }
    g.restore();

    // nitro zoom
    if (ENH.nitroZoom) { const z = !!nitOn && state === 'play'; if (z !== zoomed) { zoomed = z; cv.style.transform = z ? 'scale(1.04)' : 'scale(1)' } }
  }

  // ---- hook into the game's draw ----
  const _draw = draw;
  draw = function () { _draw(); try { post() } catch (e) { ENH.err = e } };
})();
