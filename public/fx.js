// Visual effects only: floating embers behind the page and a soft spotlight
// that follows the cursor over the leaderboard. Nothing here touches data, and
// it all stays off for visitors who ask their device for reduced motion.
(function () {
  'use strict';

  // The big glows at the top and bottom of the page follow the Guide's town hall colour
  // (null puts the original amber back). There are two copies of the lights (#atm-a / #atm-b): the new colour is
  // set on the hidden copy, which then fades in over the other. (The old way, animating the colour variables, made
  // the browser redraw the whole page on every frame of every tab change.)
  // ---- The beams: painted once onto small canvases, then the browser only turns the little pictures ----
  // (a 2400px conic-gradient layer with a mask, turning, needed a texture of millions of pixels: the biggest cost)
  var canConic = !!(window.CanvasRenderingContext2D && CanvasRenderingContext2D.prototype.createConicGradient);
  if (!canConic) document.documentElement.classList.add('beam-css'); // old CSS beams as the fallback
  // [degrees, opacity] along the fan (0 to 60 degrees); the same shape as the old CSS gradients
  var FAN_AMBER = [[0, 0], [2, 0.017], [4, 0.028], [6, 0.05], [8, 0.084], [10, 0.115], [12, 0.124], [14, 0.113], [16, 0.103], [18, 0.109], [20, 0.131], [22, 0.163], [24, 0.197], [26, 0.227], [28, 0.248], [30, 0.255], [32, 0.248], [34, 0.227], [36, 0.197], [38, 0.163], [40, 0.131], [42, 0.109], [44, 0.103], [46, 0.113], [48, 0.124], [50, 0.115], [52, 0.084], [54, 0.05], [56, 0.028], [58, 0.017], [60, 0]];
  var FAN_PEARL = [[0, 0], [3, 0.018], [6, 0.037], [9, 0.068], [12, 0.084], [15, 0.081], [18, 0.088], [21, 0.116], [24, 0.151], [27, 0.179], [30, 0.19], [33, 0.179], [36, 0.151], [39, 0.116], [42, 0.088], [45, 0.081], [48, 0.084], [51, 0.068], [54, 0.037], [57, 0.018], [60, 0]];
  // how the light fades along the beam (position 0..1 of its length, opacity): grows out of the glow, thins out
  var FADE = [[0, 0], [0.0804, 0.35], [0.1786, 1], [0.375, 0.62], [0.6786, 0.26], [1, 0]];
  // rgbOf(deg) gives the colour at that angle ("r, g, b")
  function paintBeam(cv, fan, rgbOf) {
    if (!canConic || !cv || !cv.getContext) return;
    var c = cv.getContext('2d'), W = cv.width, H = cv.height;
    c.globalCompositeOperation = 'source-over';
    c.clearRect(0, 0, W, H);
    var g = c.createConicGradient((150 - 90) * Math.PI / 180, W / 2, 0); // CSS "from 150deg" = 60deg from the canvas x axis
    fan.forEach(function (st) { g.addColorStop(st[0] / 360, 'rgba(' + rgbOf(st[0]) + ',' + st[1] + ')'); });
    c.fillStyle = g;
    c.fillRect(0, 0, W, H);
    var m = c.createRadialGradient(W / 2, 0, 0, W / 2, 0, H);
    FADE.forEach(function (st) { m.addColorStop(st[0], 'rgba(0,0,0,' + st[1] + ')'); });
    c.globalCompositeOperation = 'destination-in';
    c.fillStyle = m;
    c.fillRect(0, 0, W, H);
  }
  // the amber/colour beam of one light copy: gl-2 at the edges, gl-1 in the middle of the fan
  function paintAtm(copy, c1, c2) {
    var cv = copy && copy.querySelector('canvas.bm');
    paintBeam(cv, FAN_AMBER, function (deg) { return deg >= 18 && deg <= 42 ? c1 : c2; });
  }
  var AMBER = ['255, 176, 62', '255, 104, 36'];
  // the Planner's four pearly beams, painted once from their --c colour
  Array.prototype.forEach.call(document.querySelectorAll('.planner-light canvas.bm'), function (cv) {
    var col = (cv.style.getPropertyValue('--c') || '255, 214, 140').trim();
    paintBeam(cv, FAN_PEARL, function () { return col; });
  });

  var atms = [document.getElementById('atm-a'), document.getElementById('atm-b')];
  var atmCur = 0;
  paintAtm(atms[0], AMBER[0], AMBER[1]);
  paintAtm(atms[1], AMBER[0], AMBER[1]);
  var glowKey = '';
  function setGlow(rgb) {
    var root = document.documentElement.style;
    var vals = null;
    if (rgb) {
      var deep = rgb.map(function (v) { return Math.round(v * 0.72); });
      vals = { '--gl-1': rgb.join(', '), '--gl-2': deep.join(', '), '--gl-f': rgb.join(', ') };
    }
    // the root keeps the current colours as a plain record too (cheap: it happens once per change, not every frame)
    ['--gl-1', '--gl-2', '--gl-f'].forEach(function (k) { if (vals) root.setProperty(k, vals[k]); else root.removeProperty(k); });
    var key = vals ? vals['--gl-1'] : '';
    if (key === glowKey || !atms[0] || !atms[1]) return;
    glowKey = key;
    var next = atms[1 - atmCur], old = atms[atmCur];
    ['--gl-1', '--gl-2', '--gl-f'].forEach(function (k) { if (vals) next.style.setProperty(k, vals[k]); else next.style.removeProperty(k); });
    paintAtm(next, vals ? vals['--gl-1'] : AMBER[0], vals ? vals['--gl-2'] : AMBER[1]);
    next.classList.add('on');
    old.classList.remove('on');
    atmCur = 1 - atmCur;
  }

  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---- Title glint: switched on for ~1.3s every 8s (and not at all while the tab is hidden) ----
  var titleEl = document.getElementById('site-title');
  if (titleEl && !reduce) {
    titleEl.addEventListener('animationend', function (e) {
      if (e.animationName === 'title-shine') titleEl.classList.remove('shine');
    });
    var glint = function () {
      if (document.hidden || document.documentElement.classList.contains('lite')) return;
      titleEl.classList.remove('shine');
      void titleEl.offsetWidth; // restart
      titleEl.classList.add('shine');
    };
    setTimeout(function () { glint(); setInterval(glint, 8000); }, 2400);
  }

  // ---- Embers: a few warm sparks drifting upward ----
  // Kept deliberately light: each colour is drawn once to a tiny sprite and
  // stamped with drawImage (no per-frame gradients), at ~30 frames a second,
  // and it stops entirely while the tab is hidden.
  var canvas = document.getElementById('embers');
  if (canvas && !reduce && canvas.getContext) {
    var ctx = canvas.getContext('2d');
    var w = 0, h = 0;
    var sparks = [];
    var running = false;
    var last = 0;
    var acc = 0;
    var STEP = 1 / 20; // ~20 fps: slow dust, and every frame costs a repaint of the whole screen layer
    var SCALE = 0.5;

    var DEFAULT_COLORS = [
      [255, 196, 84], // gold
      [255, 150, 48], // amber
      [255, 226, 160], // pale gold
      [255, 120, 60], // ember orange
    ];
    var SPRITE = 32;
    function makeSprites(colors) {
      return colors.map(function (c) {
        var cv = document.createElement('canvas');
        cv.width = cv.height = SPRITE;
        var g = cv.getContext('2d');
        var gr = g.createRadialGradient(SPRITE / 2, SPRITE / 2, 0, SPRITE / 2, SPRITE / 2, SPRITE / 2);
        gr.addColorStop(0, 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',0.95)');
        gr.addColorStop(0.35, 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',0.35)');
        gr.addColorStop(1, 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',0)');
        g.fillStyle = gr;
        g.fillRect(0, 0, SPRITE, SPRITE);
        return cv;
      });
    }
    // A town hall's colour becomes a small family of tints (same count as the default set).
    function mix(c, to, t) {
      return [Math.round(c[0] + (to[0] - c[0]) * t), Math.round(c[1] + (to[1] - c[1]) * t), Math.round(c[2] + (to[2] - c[2]) * t)];
    }
    function themeColors(rgb) {
      return [rgb, mix(rgb, [255, 255, 255], 0.35), mix(rgb, [255, 255, 255], 0.65), mix(rgb, [0, 0, 0], 0.18)];
    }
    var sprites = makeSprites(DEFAULT_COLORS);
    var prevSprites = null; // the old colours fading out during a theme change
    var fade = 1; // 0 -> 1 over FADE_MS
    var fadeStart = 0;
    var FADE_MS = 700;
    var themeKey = '';

    function resize() {
      w = window.innerWidth;
      h = window.innerHeight;
      // Half size on purpose: the dots are soft blurs, so a quarter of the pixels looks identical and is much
      // cheaper for the browser to hand to the screen 30 times a second (the CSS stretches it back to full size).
      canvas.width = Math.ceil(w * SCALE);
      canvas.height = Math.ceil(h * SCALE);
      ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
      var want = Math.round(Math.max(10, Math.min(26, w / 45)));
      while (sparks.length < want) sparks.push(spawn(true));
      sparks.length = want;
    }

    function spawn(anywhere) {
      return {
        x: Math.random() * w,
        y: anywhere ? Math.random() * h : h + 10 + Math.random() * 40,
        r: 1.6 + Math.random() * 3.4, // sprite radius in px
        vy: 12 + Math.random() * 26, // px per second, upward
        sway: 6 + Math.random() * 16,
        phase: Math.random() * Math.PI * 2,
        speed: 0.4 + Math.random() * 0.9,
        life: 0,
        max: 9 + Math.random() * 12,
        ci: Math.floor(Math.random() * DEFAULT_COLORS.length),
      };
    }

    function frame(now) {
      if (!running) return;
      requestAnimationFrame(frame);
      acc += Math.min(0.1, (now - last) / 1000 || 0);
      last = now;
      if (acc < STEP) return; // skip frames: ~30fps is plenty for slow dust
      if (document.body.classList.contains('menu-open')) { acc = 0; return; } // rest while the menu is open
      var dt = acc;
      acc = 0;
      if (fade < 1) fade = Math.min(1, (now - fadeStart) / FADE_MS);
      else prevSprites = null;
      ctx.clearRect(0, 0, w, h);
      for (var i = 0; i < sparks.length; i++) {
        var s = sparks[i];
        s.life += dt;
        s.y -= s.vy * dt;
        if (s.life > s.max || s.y < -10) {
          sparks[i] = spawn(false);
          continue;
        }
        var x = s.x + Math.sin(s.phase + s.life * s.speed) * s.sway;
        var t = s.life / s.max;
        var a = Math.min(1, t * 6) * Math.min(1, (1 - t) * 3) * (0.35 + 0.65 * Math.abs(Math.sin(s.life * 1.7 + s.phase)));
        var d = s.r * 4;
        if (fade < 1 && prevSprites) {
          ctx.globalAlpha = a * (1 - fade);
          ctx.drawImage(prevSprites[s.ci], x - d / 2, s.y - d / 2, d, d);
        }
        ctx.globalAlpha = a * (fade < 1 && prevSprites ? fade : 1);
        ctx.drawImage(sprites[s.ci], x - d / 2, s.y - d / 2, d, d);
      }
      ctx.globalAlpha = 1;
    }

    // Guide tab: tint the lights to the town hall in view; null goes back to amber.
    window.CR_FX = {
      setTheme: function (rgb) {
        setGlow(rgb);
        var key = rgb ? rgb.join(',') : '';
        if (key === themeKey) return;
        themeKey = key;
        window.CR_THEME_APPLIED = key;
        prevSprites = sprites;
        sprites = makeSprites(rgb ? themeColors(rgb) : DEFAULT_COLORS);
        fade = 0;
        fadeStart = performance.now();
      },
    };

    function start() {
      if (running || document.documentElement.classList.contains('lite')) return;
      running = true;
      last = performance.now();
      acc = 0;
      requestAnimationFrame(frame);
    }

    resize();
    if (window.CR_THEME_PENDING) window.CR_FX.setTheme(window.CR_THEME_PENDING);
    var resizeTimer = null;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(resize, 150);
    });
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) running = false;
      else start();
    });
    start();
    window.CR_EMBERS = { start: start, stop: function () { running = false; ctx.clearRect(0, 0, w, h); } };
  }


  // ---- The light clock: turns the beams and the Planner's colour wheel in small steps ----
  // (instead of CSS animations that ask the browser for a new picture of a screen-sized light 60 times a second).
  // About 20 steps a second in full mode, 12 in smooth mode; the colour wheel moves 10 (5) times a second, one degree at a time.
  if (canConic && !reduce) {
    var htmlEl = document.documentElement;
    var atmCv = Array.prototype.slice.call(document.querySelectorAll('.atm canvas.bm'));
    var plWrap = document.getElementById('planner-light');
    var plCv = plWrap ? Array.prototype.slice.call(plWrap.querySelectorAll('canvas.bm')) : [];
    var hueEls = Array.prototype.slice.call(document.querySelectorAll('.atm')).concat([document.getElementById('embers'), plWrap]).filter(Boolean);
    plCv.forEach(function (cv) {
      cv._d = (parseFloat(cv.style.getPropertyValue('--d')) || 50) * 1000;
      cv._o = (parseFloat(cv.style.getPropertyValue('--o')) || 0) * 1000;
      cv._k = parseFloat(cv.style.getPropertyValue('--k')) || 1;
    });
    var sw = 32; // how far a beam swings to each side (the --sw variable: less on a tall phone screen)
    var readSw = function () { var v = parseFloat(getComputedStyle(htmlEl).getPropertyValue('--sw')); sw = isFinite(v) ? v : 32; };
    readSw();
    var swTimer = null;
    window.addEventListener('resize', function () { clearTimeout(swTimer); swTimer = setTimeout(readSw, 200); });
    // back and forth, slowing at each end (like the old ease-in-out): +amp .. -amp
    var swing = function (t, dur, off, amp) {
      var p = (((t - off) / dur) % 2 + 2) % 2;
      if (p > 1) p = 2 - p;
      return amp * (1 - 2 * p * p * (3 - 2 * p));
    };
    var lastTick = 0, lastHue = 0, wasPl = false, hueStart = 0, raf = 0;
    var update = function (now) {
      var onPl = htmlEl.classList.contains('on-planner');
      var lt = htmlEl.classList.contains('lite');
      if (onPl !== wasPl) {
        wasPl = onPl;
        hueStart = now;
        lastHue = 0;
        if (!onPl) hueEls.forEach(function (el) { el.style.removeProperty('filter'); });
      }
      if (onPl) {
        for (var i = 0; i < plCv.length; i++) plCv[i].style.transform = 'rotate(' + swing(now, plCv[i]._d, plCv[i]._o, sw * plCv[i]._k).toFixed(2) + 'deg)';
        if (now - lastHue >= (lt ? 190 : 95)) {
          lastHue = now;
          var f = 'hue-rotate(' + (((now - hueStart) / 36000 * 360) % 360).toFixed(1) + 'deg)';
          for (var j = 0; j < hueEls.length; j++) hueEls[j].style.filter = f;
        }
      } else {
        var a = 'rotate(' + swing(now, 48000, -14000, sw).toFixed(2) + 'deg)';
        for (var k = 0; k < atmCv.length; k++) atmCv[k].style.transform = a;
      }
    };
    var tick = function (now) {
      raf = requestAnimationFrame(tick);
      if (now - lastTick < (htmlEl.classList.contains('lite') ? 74 : 43)) return;
      lastTick = now;
      update(now);
    };
    var startClock = function () { if (!raf && !document.hidden) { update(performance.now()); raf = requestAnimationFrame(tick); } };
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) { cancelAnimationFrame(raf); raf = 0; } else startClock();
    });
    startClock();
  }

  // ---- Pause the podium's endless animations while the podium is off the screen ----
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { en.target.classList.toggle('anim-off', !en.isIntersecting); });
    }, { rootMargin: '80px' });
    document.querySelectorAll('.podium-wrap').forEach(function (el) { io.observe(el); });
  }

  if (!window.CR_FX) window.CR_FX = { setTheme: function (rgb) { setGlow(rgb); } };


  // ---- Smooth mode: a lighter look for slower devices ----
  // The page watches its own frame rate. If it is choppy (lots of slow frames while the person is using it),
  // three bad checks (with good ones cancelling them out) switch smooth mode on and remember it. The menu switch turns it on or off by hand;
  // switching it off by hand also stops the automatic check from turning it back on.
  var lite = document.documentElement.classList;
  var liteBtn = document.getElementById('lite-toggle');
  function store(v) { try { localStorage.setItem('cr-lite', v); } catch (e) {} }
  function read() { try { return localStorage.getItem('cr-lite'); } catch (e) { return null; } }
  function setLite(on, save) {
    lite.toggle('lite', on);
    if (liteBtn) liteBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
    if (window.CR_EMBERS) { if (on) window.CR_EMBERS.stop(); else window.CR_EMBERS.start(); }
    if (save) store(on ? '1' : '0');
  }
  if (liteBtn) {
    liteBtn.setAttribute('aria-pressed', lite.contains('lite') ? 'true' : 'false');
    liteBtn.addEventListener('click', function () { setLite(!lite.contains('lite'), true); });
  }
  if (lite.contains('lite') && window.CR_EMBERS) window.CR_EMBERS.stop();
  window.CR_LITE = { set: function (on) { setLite(on, true); } };

  if (!reduce && read() === null && 'requestAnimationFrame' in window) {
    var strikes = 0, sampling = false, lastBurst = 0, checks = 0;
    // Watches ~2 seconds of frames; "choppy" = under about 36 frames a second on average, or 30% of the frames taking over 40ms.
    var sample = function () {
      if (sampling || document.hidden || lite.contains('lite') || read() !== null) return;
      if (performance.now() - lastBurst < 1500) return;
      sampling = true;
      var t0 = performance.now(), prev = t0, n = 0, slow = 0, sum = 0;
      (function f(now) {
        var d = now - prev; prev = now;
        if (d < 400) { n++; sum += d; if (d > 40) slow++; } // a long gap means the tab was hidden or busy loading, not choppy
        if (now - t0 < 2000 && !document.hidden) { requestAnimationFrame(f); return; }
        sampling = false; lastBurst = performance.now(); checks++;
        if (n >= 30 && (slow / n > 0.3 || sum / n > 28)) strikes++; else if (n >= 30) strikes = Math.max(0, strikes - 1);
        if (strikes >= 3) { setLite(true, true); }
      })(t0);
    };
    // after the intro has settled, and then while the person scrolls or clicks around
    setTimeout(sample, 3500);
    setTimeout(sample, 7000);
    var poke = function () { if (checks < 14) setTimeout(sample, 800); }; // wait for the click's own redraw to finish first
    window.addEventListener('scroll', poke, { passive: true });
    document.addEventListener('click', poke, true);
  }

  // ---- Spotlight: the leaderboard panel catches the cursor ----
  // Coordinates are applied at most once per frame.
  if (window.matchMedia && window.matchMedia('(hover: hover)').matches) {
    var pending = null;
    var scheduled = false;
    document.addEventListener('pointermove', function (e) {
      var board = e.target.closest && e.target.closest('.board');
      if (!board) return;
      pending = { board: board, x: e.clientX, y: e.clientY };
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(function () {
        scheduled = false;
        if (!pending) return;
        var r = pending.board.getBoundingClientRect();
        pending.board.style.setProperty('--mx', pending.x - r.left + 'px');
        pending.board.style.setProperty('--my', pending.y - r.top + 'px');
        pending = null;
      });
    });
  }
})();
