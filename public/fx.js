// Visual effects only: floating embers behind the page and a soft spotlight
// that follows the cursor over the leaderboard. Nothing here touches data, and
// it all stays off for visitors who ask their device for reduced motion.
(function () {
  'use strict';

  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---- Embers: a few warm sparks drifting upward ----
  var canvas = document.getElementById('embers');
  if (canvas && !reduce && canvas.getContext) {
    var ctx = canvas.getContext('2d');
    var w = 0, h = 0, dpr = 1;
    var sparks = [];
    var running = false;
    var last = 0;

    var COLORS = [
      [255, 196, 84], // gold
      [255, 150, 48], // amber
      [255, 226, 160], // pale gold
      [255, 120, 60], // ember orange
    ];

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var want = Math.round(Math.max(14, Math.min(46, w / 30)));
      while (sparks.length < want) sparks.push(spawn(true));
      sparks.length = want;
    }

    function spawn(anywhere) {
      var c = COLORS[Math.random() < 0.14 ? 3 : Math.floor(Math.random() * 3)];
      return {
        x: Math.random() * w,
        y: anywhere ? Math.random() * h : h + 10 + Math.random() * 40,
        r: 0.7 + Math.random() * 1.9,
        vy: 12 + Math.random() * 26, // px per second, upward
        sway: 6 + Math.random() * 16,
        phase: Math.random() * Math.PI * 2,
        speed: 0.4 + Math.random() * 0.9,
        life: 0,
        max: 9 + Math.random() * 12,
        c: c,
      };
    }

    function frame(now) {
      if (!running) return;
      var dt = Math.min(0.05, (now - last) / 1000 || 0.016);
      last = now;
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'lighter';
      for (var i = 0; i < sparks.length; i++) {
        var s = sparks[i];
        s.life += dt;
        s.y -= s.vy * dt;
        var x = s.x + Math.sin(s.phase + s.life * s.speed) * s.sway;
        if (s.life > s.max || s.y < -10) {
          sparks[i] = spawn(false);
          continue;
        }
        // fade in, hold, fade out
        var t = s.life / s.max;
        var a = Math.min(1, t * 6) * Math.min(1, (1 - t) * 3) * (0.35 + 0.65 * Math.abs(Math.sin(s.life * 1.7 + s.phase)));
        var g = ctx.createRadialGradient(x, s.y, 0, x, s.y, s.r * 4);
        g.addColorStop(0, 'rgba(' + s.c[0] + ',' + s.c[1] + ',' + s.c[2] + ',' + (0.85 * a).toFixed(3) + ')');
        g.addColorStop(1, 'rgba(' + s.c[0] + ',' + s.c[1] + ',' + s.c[2] + ',0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, s.y, s.r * 4, 0, Math.PI * 2);
        ctx.fill();
      }
      requestAnimationFrame(frame);
    }

    function start() {
      if (running) return;
      running = true;
      last = performance.now();
      requestAnimationFrame(frame);
    }

    resize();
    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) running = false;
      else start();
    });
    start();
  }

  // ---- Spotlight: the leaderboard panel catches the cursor ----
  if (window.matchMedia && window.matchMedia('(hover: hover)').matches) {
    document.addEventListener('pointermove', function (e) {
      var board = e.target.closest && e.target.closest('.board');
      if (!board) return;
      var r = board.getBoundingClientRect();
      board.style.setProperty('--mx', e.clientX - r.left + 'px');
      board.style.setProperty('--my', e.clientY - r.top + 'px');
    });
  }
})();
