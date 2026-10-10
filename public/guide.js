// Guide tab: town hall picker + per-town-hall cards (bases, armies, tips).
// All content lives in guide-data.js; this file only draws it.
(function () {
  'use strict';

  var data = window.GUIDE_DATA || { townHalls: [], generalTips: [] };
  var root = document.getElementById('guide-root');
  if (!root) return;

  var selected = null; // town hall level currently open

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  // Only the game's own share links are ever turned into clickable links.
  function safeLink(u) {
    return typeof u === 'string' && /^https:\/\/link\.clashofclans\.com\//.test(u) ? u : null;
  }
  function safeVideo(u) {
    return typeof u === 'string' && /^https:\/\/(www\.youtube\.com\/watch\?[\w=&\-%.]+|youtu\.be\/[\w\-]+(\?[\w=&\-%.]+)?)$/.test(u) ? u : null;
  }
  function safeImg(u) {
    return typeof u === 'string' && /^[\w\-./]+\.(png|webp|jpe?g)$/i.test(u) ? u : null;
  }
  var list = (data.townHalls || []).slice().sort(function (x, y) { return x.level - y.level; });
  function find(level) {
    for (var i = 0; i < list.length; i++) if (list[i].level === level) return list[i];
    return null;
  }
  function themeOf(th) {
    var t = th && th.theme;
    return t && t.length === 3 && t.every(function (n) { return typeof n === 'number'; }) ? t : null;
  }

  // ---- pieces ----
  function thArt(th, cls) {
    var src = safeImg(th.image);
    var fallback = '<span class="th-fallback" aria-hidden="true"><b>' + esc(th.level) + '</b></span>';
    return '<span class="th-art ' + (cls || '') + '">' + (src ? '<img src="' + esc(src) + '" alt="" decoding="async" draggable="false" />' : fallback) + '</span>';
  }

  function carouselHtml() {
    return list
      .map(function (th) {
        var t = themeOf(th);
        return (
          '<button type="button" class="th-item' + (th.soon ? ' th-soon' : '') + '" data-th="' + esc(th.level) + '"' +
          (t ? ' style="--t:' + t.join(',') + '"' : '') + ' aria-label="Town Hall ' + esc(th.level) + (th.soon ? ' (coming soon)' : '') + '">' +
          thArt(th) +
          '<span class="th-name"><span class="th-name-long">Town Hall </span><span class="th-name-short">TH</span>' + esc(th.level) + '</span>' +
          '</button>'
        );
      })
      .join('');
  }

  var ICONS = {
    // sword (armies) and shield (bases)
    army: '<path d="M7.9 13.9 17.25 4.5 20.5 3.5l-1 3.25-9.4 9.4Z" fill="currentColor"/><path d="M6 12l6 6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M8.6 15.4 5.6 18.4" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/><circle cx="4.7" cy="19.3" r="1.5" fill="currentColor"/>',
    base: '<path d="M12 3 20 6v5.4c0 4.5-3.2 7.7-8 9.6-4.8-1.9-8-5.1-8-9.6V6l8-3Z" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/><path d="M12 7 16.2 8.5v3c0 2.5-1.7 4.2-4.2 5.3-2.5-1.1-4.2-2.8-4.2-5.3v-3L12 7Z" fill="currentColor" opacity=".5"/>',
    tips: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2V16h5v-.1c0-.8.4-1.5 1-2A6 6 0 0 0 12 3Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
  };
  function cardHead(icon, title, sub) {
    return '<header class="g-head"><span class="g-ico"><svg viewBox="0 0 24 24" aria-hidden="true">' + ICONS[icon] + '</svg></span><span class="g-title">' + esc(title) + '</span>' + (sub ? '<span class="g-sub">' + esc(sub) + '</span>' : '') + '</header>';
  }

  function actionHtml(link, label, soon) {
    var l = safeLink(link);
    return l
      ? '<a class="g-btn" href="' + esc(l) + '" target="_blank" rel="noopener noreferrer">' + esc(label) + '</a>'
      : '<span class="g-btn g-btn-off">' + esc(soon) + '</span>';
  }

  function videoHtml(url) {
    var v = safeVideo(url);
    return v ? '<a class="g-btn g-btn-ghost" href="' + esc(v) + '" target="_blank" rel="noopener noreferrer">Watch video</a>' : '';
  }
  // Army picture: `front` pictures in the foreground, `back` pictures behind them.
  function artHtml(art) {
    var inner = '';
    if (art && art.layers) {
      // Free placement: x = centre (% of the width), y = gap above the floor (% of the height),
      // h = height (% of the height); dim / ghost / flip are optional looks.
      var num = function (v, d) { v = Number(v); return isFinite(v) ? v : d; };
      inner = art.layers
        .map(function (l) {
          var s = safeImg(l.src);
          if (!s) return '';
          return '<img class="art-layer' + (l.dim ? ' dim' : '') + (l.ghost ? ' ghost' : '') + (l.flip ? ' flip' : '') + '" src="' + esc(s) + '" alt="" loading="lazy" style="left:' + num(l.x, 50) + '%;bottom:' + num(l.y, 0) + '%;height:' + num(l.h, 80) + '%" />';
        })
        .join('');
    } else if (art) {
      var row = function (list, cls) {
        var imgs = (list || [])
          .map(function (u) { var s = safeImg(u); return s ? '<img src="' + esc(s) + '" alt="" loading="lazy" />' : ''; })
          .join('');
        return imgs ? '<span class="art-row ' + cls + '">' + imgs + '</span>' : '';
      };
      inner = row(art.back, 'art-back') + row(art.front, 'art-front');
    }
    return '<span class="army-art' + (inner ? '' : ' army-art-empty') + '">' + (inner || '<span>Army picture coming soon</span>') + '</span>';
  }
  // If a picture file is missing, drop it quietly (and fall back to the placeholder if none are left).
  function wireArt(scope) {
    // a base picture that fails to load falls back to the placeholder box
    var shots = scope.querySelectorAll('.base-shot img');
    for (var s = 0; s < shots.length; s++) {
      shots[s].addEventListener('error', function (e) {
        var box = e.target.parentNode;
        box.innerHTML = '<span>Base picture<br>coming soon</span>';
      });
    }
    var imgs = scope.querySelectorAll('.army-art img');
    for (var i = 0; i < imgs.length; i++) {
      imgs[i].addEventListener('error', function (e) {
        var img = e.target, art = img.closest('.army-art');
        var row = img.parentNode;
        img.remove();
        if (row && row.classList.contains('art-row') && !row.querySelector('img')) row.remove();
        if (art && !art.querySelector('img')) {
          art.classList.add('army-art-empty');
          art.innerHTML = '<span>Army picture coming soon</span>';
        }
      });
    }
  }

  function byHtml(by) {
    return by ? '<span class="g-by">by ' + esc(by) + '</span>' : '';
  }

  function basesHtml(th) {
    var items = (th.bases || [])
      .map(function (b, i) {
        var img = safeImg(b.image);
        return (
          '<div class="g-item base" style="--i:' + i + '">' +
          '<span class="base-shot">' + (img ? '<img src="' + esc(img) + '" alt="" loading="lazy" />' : '<span>Base picture<br>coming soon</span>') + '</span>' +
          '<span class="g-item-name">' + esc(b.name) + '</span>' + byHtml(b.by) +
          (b.note ? '<span class="g-item-note">' + esc(b.note) + '</span>' : '') +
          '<span class="g-actions">' + actionHtml(b.link, 'Copy base', 'Link coming soon') + '</span>' +
          '</div>'
        );
      })
      .join('');
    return '<section class="g-card">' + cardHead('base', 'Bases', 'Tap a base to copy it into the game') + '<div class="g-grid">' + (items || '<p class="g-empty">Nothing here yet.</p>') + '</div></section>';
  }

  var KIND = { recommended: 'Recommended', ground: 'Ground', air: 'Air' };
  function armiesHtml(th) {
    var order = { recommended: 0, ground: 1, air: 2 };
    var list = (th.armies || []).slice(0, 3).sort(function (a, b) { return (order[a.kind] || 0) - (order[b.kind] || 0); });
    var items = list
      .map(function (a, i) {
        var troops = (a.troops || [])
          .map(function (t) { return '<li><b>' + esc(t.count) + '×</b> ' + esc(t.name) + '</li>'; })
          .join('');
        var typeTag = a.kind === 'recommended' && (a.type === 'air' || a.type === 'ground') ? '<span class="army-tag army-type army-type-' + a.type + '">' + (a.type === 'air' ? 'Air' : 'Ground') + '</span>' : '';
        var hasContent = troops || safeLink(a.link);
        return (
          '<div class="g-item army army-' + esc(a.kind) + '" style="--i:' + i + '">' +
          artHtml(a.art) +
          '<span class="army-tags"><span class="army-tag">' + esc(KIND[a.kind] || a.kind) + '</span>' + typeTag + '</span>' +
          '<span class="g-item-name">' + esc(a.name) + '</span>' + byHtml(a.by) +
          (a.summary ? '<span class="g-item-note">' + esc(a.summary) + '</span>' : '') +
          (troops ? '<ul class="army-troops">' + troops + '</ul>' : hasContent ? '' : '<span class="g-item-note army-todo">Army details coming soon.</span>') +
          '<span class="g-actions">' + actionHtml(a.link, 'Copy army', 'Link coming soon') + videoHtml(a.video) + '</span>' +
          '</div>'
        );
      })
      .join('');
    return '<section class="g-card">' + cardHead('army', 'Armies', th.armiesNote || data.armiesNote || '') + '<div class="g-grid g-grid-3">' + (items || '<p class="g-empty">Nothing here yet.</p>') + '</div></section>';
  }

  function tipsHtml(th) {
    var general = th.onlyOwnTips ? [] : (data.generalTips || []).filter(function (t) { return typeof t.from !== 'number' || th.level >= t.from; });
    var tips = general.concat(th.tips || []);
    var items = tips
      .map(function (t, i) {
        return '<li class="tip" style="--i:' + i + '"><span class="tip-n">' + (i + 1) + '</span><span class="tip-body"><b>' + esc(t.title) + '</b><span>' + esc(t.text) + '</span></span></li>';
      })
      .join('');
    return '<section class="g-card">' + cardHead('tips', 'Tips', 'General habits, plus ones for this town hall') + '<ol class="tips">' + (items || '<li class="g-empty">Nothing here yet.</li>') + '</ol></section>';
  }

  function soonHtml(th) {
    return '<section class="g-card g-soon"><p class="g-empty">The Town Hall ' + esc(th.level) + ' guide is still being written. Check back soon.</p></section>';
  }

  function detailHtml(th) {
    return th.soon ? soonHtml(th) : armiesHtml(th) + basesHtml(th) + tipsHtml(th);
  }

  // ---- render ----
  root.innerHTML =
    '<div class="th-carousel" role="group" aria-label="Choose a town hall">' +
    '<button type="button" class="th-nav th-prev" aria-label="Previous town hall"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 5-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg></button>' +
    '<div class="th-viewport"><div class="th-track">' + carouselHtml() + '</div></div>' +
    '<button type="button" class="th-nav th-next" aria-label="Next town hall"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg></button>' +
    '</div>' +
    '<div id="guide-detail" class="g-detail" aria-live="polite"></div>';

  var carouselEl = root.querySelector('.th-carousel');
  var viewportEl = root.querySelector('.th-viewport');
  var trackEl = root.querySelector('.th-track');
  var itemEls = Array.prototype.slice.call(trackEl.querySelectorAll('.th-item'));
  var detailEl = document.getElementById('guide-detail');
  var panelEl = document.getElementById('panel-guide');
  var firstLayout = true;

  function hash() {
    return '#guide/th' + selected;
  }
  function updateHash() {
    try { if (/^#guide/.test(location.hash) || !location.hash) history.replaceState(null, '', hash()); } catch (e) { /* file:// */ }
  }
  function themeRgb() {
    return themeOf(find(selected));
  }
  function panelActive() {
    return !!panelEl && !panelEl.hidden;
  }
  // Boxes, buttons and headings take the colour of the town hall in view (lighter tints for text).
  function paintPanel() {
    var t = themeRgb();
    if (!panelEl) return;
    if (!t) {
      ['--g-rgb', '--g-hi', '--g-pale'].forEach(function (k) { panelEl.style.removeProperty(k); });
      return;
    }
    var mix = function (k) { return t.map(function (v) { return Math.round(v + (255 - v) * k); }).join(','); };
    panelEl.style.setProperty('--g-rgb', t.join(','));
    panelEl.style.setProperty('--g-hi', 'rgb(' + mix(0.4) + ')');
    panelEl.style.setProperty('--g-pale', 'rgb(' + mix(0.8) + ')');
  }
  function pushTheme() {
    paintPanel();
    if (!panelActive()) return;
    window.CR_THEME_PENDING = themeRgb();
    if (window.CR_FX) window.CR_FX.setTheme(themeRgb());
  }

  // Slide the track so the chosen town hall sits in the middle. The big and
  // small widths come from CSS, so the maths follows the screen size.
  function layout(animate) {
    if (!viewportEl.clientWidth) return; // tab not visible yet; retried when it is
    var cs = getComputedStyle(carouselEl);
    var big = parseFloat(cs.getPropertyValue('--w-big')) || 200;
    var small = parseFloat(cs.getPropertyValue('--w-small')) || 90;
    var gap = parseFloat(cs.getPropertyValue('--gap')) || 8;
    var x = 0, center = 0;
    for (var i = 0; i < list.length; i++) {
      var w = list[i].level === selected ? big : small;
      if (list[i].level === selected) center = x + w / 2;
      x += w + gap;
    }
    if (!animate || firstLayout) trackEl.classList.add('no-anim');
    trackEl.style.setProperty('--tx', viewportEl.clientWidth / 2 - center + 'px');
    if (!animate || firstLayout) {
      void trackEl.offsetWidth;
      requestAnimationFrame(function () { trackEl.classList.remove('no-anim'); });
    }
    firstLayout = false;
  }

  // The guide underneath slides out the way you're heading and the next one slides in,
  // so it moves together with the carousel.
  var swapToken = 0;
  function swapDetail(th, prevLevel, animate) {
    var token = ++swapToken;
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var running = detailEl.getAnimations ? detailEl.getAnimations() : [];
    for (var i = 0; i < running.length; i++) running[i].cancel();
    var render = function () {
      detailEl.setAttribute('data-th', th.level);
      detailEl.innerHTML = detailHtml(th);
      wireArt(detailEl);
    };
    if (!animate || reduce || !detailEl.animate || !detailEl.innerHTML || prevLevel == null) {
      render();
      detailEl.classList.remove('enter');
      void detailEl.offsetWidth; // replay the entrance
      detailEl.classList.add('enter');
      return;
    }
    detailEl.classList.remove('enter');
    var dir = th.level > prevLevel ? 1 : -1;
    var out = detailEl.animate(
      [{ opacity: 1, transform: 'translateX(0)' }, { opacity: 0, transform: 'translateX(' + -dir * 40 + 'px)' }],
      { duration: 170, easing: 'ease-in', fill: 'forwards' }
    );
    out.onfinish = function () {
      if (token !== swapToken) return;
      render();
      out.cancel();
      detailEl.animate(
        [{ opacity: 0, transform: 'translateX(' + dir * 40 + 'px)' }, { opacity: 1, transform: 'translateX(0)' }],
        { duration: 360, easing: 'cubic-bezier(0.2, 0.9, 0.25, 1)' }
      );
    };
  }

  function select(level, opts) {
    opts = opts || {};
    var th = find(level);
    if (!th) return;
    var changed = selected !== level;
    var prevLevel = selected;
    selected = level;
    for (var i = 0; i < itemEls.length; i++) {
      var on = +itemEls[i].getAttribute('data-th') === selected;
      itemEls[i].classList.toggle('is-center', on);
      itemEls[i].setAttribute('aria-current', on ? 'true' : 'false');
      itemEls[i].tabIndex = on ? 0 : -1;
    }
    var t = themeOf(th);
    if (t) carouselEl.style.setProperty('--t', t.join(','));
    layout(opts.animate !== false);
    if (changed || !detailEl.innerHTML) swapDetail(th, prevLevel, opts.animate !== false);
    pushTheme();
    if (opts.updateHash !== false) updateHash();
  }

  function step(dir) {
    var i = list.findIndex(function (t) { return t.level === selected; });
    var n = list[i + dir];
    if (n) select(n.level);
  }

  carouselEl.addEventListener('click', function (e) {
    if (swiped) { swiped = false; return; }
    var item = e.target.closest('.th-item');
    if (item) { select(+item.getAttribute('data-th')); return; }
    if (e.target.closest('.th-prev')) step(-1);
    else if (e.target.closest('.th-next')) step(1);
  });
  carouselEl.addEventListener('keydown', function (e) {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    step(e.key === 'ArrowRight' ? 1 : -1);
    var c = trackEl.querySelector('.th-item.is-center');
    if (c) c.focus({ preventScroll: true });
  });

  // The viewport is only ever moved by the transform; if a browser scrolls it (focus / scroll-into-view), put it back.
  viewportEl.addEventListener('scroll', function () {
    if (viewportEl.scrollLeft) viewportEl.scrollLeft = 0;
  });

  // swipe left / right
  var swipe = null;
  var swiped = false;
  viewportEl.addEventListener('pointerdown', function (e) { swipe = { x: e.clientX, y: e.clientY }; });
  viewportEl.addEventListener('pointerup', function (e) {
    if (!swipe) return;
    var dx = e.clientX - swipe.x, dy = e.clientY - swipe.y;
    swipe = null;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      swiped = true; // the click that follows a drag must not undo it
      setTimeout(function () { swiped = false; }, 60);
      step(dx < 0 ? 1 : -1);
    }
  });
  viewportEl.addEventListener('pointercancel', function () { swipe = null; });

  // re-centre when the size changes or the tab becomes visible
  // Only a change of WIDTH needs a re-centre. (The viewport's height changes while a picture grows,
  // and re-laying out then used to cut the slide short.)
  var lastW = 0;
  var onSize = function () {
    var w = viewportEl.clientWidth;
    if (w === lastW) return;
    lastW = w;
    layout(false);
  };
  if (window.ResizeObserver) new ResizeObserver(onSize).observe(viewportEl);
  else window.addEventListener('resize', onSize);

  // Open straight to a town hall from a link like  #guide/th14
  var startLevel = data.defaultLevel && find(data.defaultLevel) ? data.defaultLevel : (list[0] && list[0].level);
  function fromHash() {
    var m = /^#guide\/th(\d+)$/.exec(location.hash);
    if (m && find(+m[1])) select(+m[1], { updateHash: false, animate: false });
  }
  select(startLevel, { updateHash: false, animate: false });
  fromHash();
  window.addEventListener('hashchange', fromHash);

  window.CR_GUIDE = { hash: hash, themeRgb: themeRgb };
})();
