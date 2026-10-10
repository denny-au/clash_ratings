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
    base: '<path d="M4 20V9l4-3 4 3 4-3 4 3v11H4Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M10 20v-5h4v5" fill="none" stroke="currentColor" stroke-width="1.8"/>',
    army: '<path d="M5 20 19 6M14 5h5v5M5 6l14 14M5 10V5h5" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>',
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

  function basesHtml(th) {
    var items = (th.bases || [])
      .map(function (b, i) {
        var img = safeImg(b.image);
        return (
          '<div class="g-item base" style="--i:' + i + '">' +
          '<span class="base-shot">' + (img ? '<img src="' + esc(img) + '" alt="" loading="lazy" />' : '<span>Base picture<br>coming soon</span>') + '</span>' +
          '<span class="g-item-name">' + esc(b.name) + '</span>' +
          (b.note ? '<span class="g-item-note">' + esc(b.note) + '</span>' : '') +
          actionHtml(b.link, 'Copy base', 'Link coming soon') +
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
        var variant = a.kind === 'recommended' && a.variantOf ? '<span class="g-item-note">A small variation on the ' + esc(a.variantOf) + ' army.</span>' : '';
        return (
          '<div class="g-item army army-' + esc(a.kind) + '" style="--i:' + i + '">' +
          '<span class="army-tag">' + esc(KIND[a.kind] || a.kind) + '</span>' +
          '<span class="g-item-name">' + esc(a.name) + '</span>' +
          variant +
          (a.summary ? '<span class="g-item-note">' + esc(a.summary) + '</span>' : '') +
          (troops ? '<ul class="army-troops">' + troops + '</ul>' : '<span class="g-item-note army-todo">Army details coming soon.</span>') +
          actionHtml(a.link, 'Copy army', 'Link coming soon') +
          '</div>'
        );
      })
      .join('');
    return '<section class="g-card">' + cardHead('army', 'Recommended armies', 'One ground, one air, and the overall pick') + '<div class="g-grid g-grid-3">' + (items || '<p class="g-empty">Nothing here yet.</p>') + '</div></section>';
  }

  function tipsHtml(th) {
    var tips = (data.generalTips || []).concat(th.tips || []);
    var items = tips
      .map(function (t, i) {
        return '<li class="tip" style="--i:' + i + '"><span class="tip-n">' + (i + 1) + '</span><span class="tip-body"><b>' + esc(t.title) + '</b><span>' + esc(t.text) + '</span></span></li>';
      })
      .join('');
    return '<section class="g-card">' + cardHead('tips', 'General tips', 'Good habits at any town hall') + '<ol class="tips">' + (items || '<li class="g-empty">Nothing here yet.</li>') + '</ol></section>';
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
