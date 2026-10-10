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
  function find(level) {
    for (var i = 0; i < data.townHalls.length; i++) if (data.townHalls[i].level === level && !data.townHalls[i].soon) return data.townHalls[i];
    return null;
  }

  // ---- pieces ----
  function thArt(th, cls) {
    var src = !th.soon && safeImg(th.image);
    var fallback = '<span class="th-fallback" aria-hidden="true"><b>' + esc(th.level) + '</b></span>';
    return '<span class="th-art ' + (cls || '') + '">' + (src ? '<img src="' + esc(src) + '" alt="" loading="lazy" />' : fallback) + '</span>';
  }

  function pickerHtml() {
    return data.townHalls
      .map(function (th, i) {
        if (th.soon) {
          return '<div class="th-card th-soon" style="--i:' + i + '" aria-disabled="true">' + thArt(th) + '<span class="th-name">Town Hall ' + esc(th.level) + '</span><span class="th-sub">Coming soon</span></div>';
        }
        return '<button type="button" class="th-card" data-th="' + esc(th.level) + '" style="--i:' + i + '" aria-pressed="false">' + thArt(th) + '<span class="th-name">Town Hall ' + esc(th.level) + '</span><span class="th-sub">Bases · armies · tips</span></button>';
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
          '<span class="army-tags"><span class="army-tag">' + esc(KIND[a.kind] || a.kind) + '</span>' + typeTag + '</span>' +
          '<span class="g-item-name">' + esc(a.name) + '</span>' + byHtml(a.by) +
          (a.summary ? '<span class="g-item-note">' + esc(a.summary) + '</span>' : '') +
          (troops ? '<ul class="army-troops">' + troops + '</ul>' : hasContent ? '' : '<span class="g-item-note army-todo">Army details coming soon.</span>') +
          '<span class="g-actions">' + actionHtml(a.link, 'Copy army', 'Link coming soon') + videoHtml(a.video) + '</span>' +
          '</div>'
        );
      })
      .join('');
    return '<section class="g-card">' + cardHead('army', 'Recommended armies', 'One ground, one air, and the overall pick') + '<div class="g-grid g-grid-3">' + (items || '<p class="g-empty">Nothing here yet.</p>') + '</div></section>';
  }

  function tipsHtml(th) {
    var general = data.generalTips || [];
    var tips = general.concat(th.tips || []);
    var items = tips
      .map(function (t, i) {
        var chip = i >= general.length ? '<em class="tip-chip">TH' + esc(th.level) + '</em>' : '';
        return '<li class="tip" style="--i:' + i + '"><span class="tip-n">' + (i + 1) + '</span><span class="tip-body"><b>' + esc(t.title) + chip + '</b><span>' + esc(t.text) + '</span></span></li>';
      })
      .join('');
    return '<section class="g-card">' + cardHead('tips', 'Tips', 'General habits, plus ones for this town hall') + '<ol class="tips">' + (items || '<li class="g-empty">Nothing here yet.</li>') + '</ol></section>';
  }

  function detailHtml(th) {
    return (
      '<div class="g-detail-head">' + thArt(th, 'th-art-sm') + '<h4>Town Hall ' + esc(th.level) + ' guide</h4>' +
      '<button type="button" class="g-close" data-guide-close aria-label="Close this guide">Close</button></div>' +
      armiesHtml(th) + basesHtml(th) + tipsHtml(th)
    );
  }

  // ---- render ----
  root.innerHTML =
    '<div class="th-picker" role="group" aria-label="Choose a town hall">' + pickerHtml() + '</div>' +
    '<div id="guide-detail" class="g-detail" aria-live="polite" hidden></div>';

  var pickerEl = root.querySelector('.th-picker');
  var detailEl = document.getElementById('guide-detail');

  function hash() {
    return selected ? '#guide/th' + selected : '#guide';
  }
  function updateHash() {
    try { if (/^#guide/.test(location.hash) || !location.hash) history.replaceState(null, '', hash()); } catch (e) { /* file:// */ }
  }

  function select(level, opts) {
    opts = opts || {};
    var th = find(level);
    if (!th) level = null;
    selected = level && selected !== level ? level : opts.force ? level : null; // clicking the open one closes it
    var buttons = pickerEl.querySelectorAll('.th-card[data-th]');
    for (var i = 0; i < buttons.length; i++) {
      var on = selected !== null && +buttons[i].getAttribute('data-th') === selected;
      buttons[i].classList.toggle('is-open', on);
      buttons[i].setAttribute('aria-pressed', on ? 'true' : 'false');
    }
    if (selected) {
      detailEl.innerHTML = detailHtml(find(selected));
      detailEl.hidden = false;
      detailEl.classList.remove('enter');
      void detailEl.offsetWidth; // replay the entrance
      detailEl.classList.add('enter');
      var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (opts.scroll !== false) detailEl.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    } else {
      detailEl.hidden = true;
      detailEl.innerHTML = '';
    }
    if (opts.updateHash !== false) updateHash();
  }

  pickerEl.addEventListener('click', function (e) {
    var b = e.target.closest('.th-card[data-th]');
    if (b) select(+b.getAttribute('data-th'));
  });
  detailEl.addEventListener('click', function (e) {
    if (e.target.closest("[data-guide-close]")) {
      select(selected);
      var open = pickerEl.querySelector('.th-card[data-th]');
      if (open) open.focus({ preventScroll: true });
    }
  });

  // Open straight to a town hall from a link like  #guide/th14
  function fromHash() {
    var m = /^#guide\/th(\d+)$/.exec(location.hash);
    if (m && find(+m[1])) select(+m[1], { force: true, scroll: false, updateHash: false });
  }
  fromHash();
  window.addEventListener('hashchange', fromHash);

  window.CR_GUIDE = { hash: hash };
})();
