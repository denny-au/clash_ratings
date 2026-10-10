// Visual effects only: floating embers behind the page and a soft spotlight
// that follows the cursor over the leaderboard. Nothing here touches data, and
// it all stays off for visitors who ask their device for reduced motion.
(function () {
  'use strict';

  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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
    var STEP = 1 / 30;

    var COLORS = [
      [255, 196, 84], // gold
      [255, 150, 48], // amber
      [255, 226, 160], // pale gold
      [255, 120, 60], // ember orange
    ];
    var SPRITE = 32;
    var sprites = COLORS.map(function (c) {
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

    function resize() {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w; // 1x on purpose: soft dots don't need retina sharpness
      canvas.height = h;
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
        s: sprites[Math.floor(Math.random() * sprites.length)],
      };
    }

    function frame(now) {
      if (!running) return;
      requestAnimationFrame(frame);
      acc += Math.min(0.1, (now - last) / 1000 || 0);
      last = now;
      if (acc < STEP) return; // skip frames: ~30fps is plenty for slow dust
      var dt = acc;
      acc = 0;
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
        ctx.globalAlpha = a;
        ctx.drawImage(s.s, x - d / 2, s.y - d / 2, d, d);
      }
      ctx.globalAlpha = 1;
    }

    function start() {
      if (running) return;
      running = true;
      last = performance.now();
      acc = 0;
      requestAnimationFrame(frame);
    }

    resize();
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
