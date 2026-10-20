// The Planner page: paste a village export, see who is busy and who is free, and a calendar of the month.
// Everything stays in this browser (localStorage); nothing is sent anywhere.
(function () {
  'use strict';
  var D = window.CR_PLANNER_DATA || { names: {} };
  var N = D.names || {};
  var root = document.getElementById('planner-root');
  if (!root) return;

  var KEY_VILLAGE = 'cr-planner-village';
  var KEY_MODE = 'cr-planner-mode';
  var HUT = 1000015;
  var TOWN_HALL = 1000001;

  // ---------- small helpers ----------
  function store(k, v) {
    try {
      if (v == null) localStorage.removeItem(k);
      else localStorage.setItem(k, v);
    } catch (e) { /* storage blocked: the planner still works until the page closes */ }
  }
  function load(k) {
    try { return localStorage.getItem(k); } catch (e) { return null; }
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function num(x) { return typeof x === 'number' && isFinite(x) ? x : null; }
  function dateTime(ms) {
    return new Date(ms).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  }
  function dayLabel(ms) {
    return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }
  function longDate(ms) {
    return new Date(ms).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
  }
  function span(ms) {
    var m = Math.max(0, Math.floor(ms / 60000));
    var d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60), mm = m % 60;
    if (d > 0) return d + 'd ' + h + 'h';
    if (h > 0) return h + 'h ' + mm + 'm';
    return Math.max(mm, 1) + 'm';
  }
  function ago(ms) {
    var m = Math.floor(ms / 60000);
    if (m < 2) return 'just now';
    if (m < 90) return m + ' minutes ago';
    var h = Math.floor(m / 60);
    if (h < 48) return h + ' hours ago';
    return Math.floor(h / 24) + ' days ago';
  }
  function nameOf(group, id, fallback) {
    var t = N[group] || {};
    return t[id] || fallback + ' #' + id;
  }

  // ---------- reading the export ----------
  // The export is JSON. Each entry has a number saying what it is ("data"), its level ("lvl") and, if it is
  // being upgraded right now, "timer": the seconds left at the moment the export was made ("timestamp").
  function parse(raw) {
    var j;
    try { j = JSON.parse(raw); } catch (e) { j = null; }
    if (!j || typeof j !== 'object' || !Array.isArray(j.buildings)) {
      return { error: 'That does not look like a Clash of Clans village export. In the game open Settings, More Settings, then Data Export and tap Copy, and paste what it copied.' };
    }
    var exportedAt = num(j.timestamp) && j.timestamp > 1e9 ? j.timestamp * 1000 : Date.now();
    var tasks = [];
    var huts = 0;
    var th = null;

    function add(kind, group, e, fallback, hero) {
      var t = num(e.timer);
      if (t == null || t <= 0) return;
      tasks.push({
        kind: kind,
        hero: !!hero,
        name: nameOf(group, e.data, fallback),
        from: num(e.lvl),
        end: exportedAt + t * 1000,
        extra: !!e.extra,
      });
    }
    j.buildings.forEach(function (b) {
      if (!b || typeof b !== 'object') return;
      if (b.data === HUT) huts += num(b.cnt) || 1;
      if (b.data === TOWN_HALL && num(b.lvl)) th = b.lvl;
      add('builder', 'buildings', b, 'Building');
    });
    (j.units || []).forEach(function (e) { add('research', 'units', e || {}, 'Troop'); });
    (j.spells || []).forEach(function (e) { add('research', 'units', e || {}, 'Spell'); });
    (j.siege_machines || []).forEach(function (e) { add('research', 'units', e || {}, 'Siege machine'); });
    // a hero upgrade needs a builder too, so it counts as one of the builders' jobs
    (j.heroes || []).forEach(function (e) { add('builder', 'heroes', e || {}, 'Hero', true); });
    (j.pets || []).forEach(function (e) { add('pet', 'pets', e || {}, 'Pet'); });

    var helpers = (j.helpers || []).map(function (h) {
      return { name: nameOf('helpers', h && h.data, 'Helper'), lvl: num(h && h.lvl), ready: exportedAt + (num(h && h.helper_cooldown) || 0) * 1000 };
    });
    tasks.sort(function (a, b) { return a.end - b.end; });
    var busyBuilders = tasks.filter(function (t) { return t.kind === 'builder'; }).length;
    return {
      tag: typeof j.tag === 'string' ? j.tag.replace(/[^#0-9A-Za-z]/g, '').slice(0, 14) : '',
      exportedAt: exportedAt,
      th: th,
      json: j, // the raw export, kept in memory for the date maths (planner-calc.js)
      builders: Math.max(huts, busyBuilders),
      tasks: tasks,
      helpers: helpers,
    };
  }

  // A made-up village so people can see what the page does without pasting anything.
  function sampleRaw() {
    var h = 3600;
    return JSON.stringify({
      tag: '#SAMPLE',
      timestamp: Math.floor(Date.now() / 1000) - 2 * h,
      helpers: [{ data: 93000000, lvl: 8, helper_cooldown: 5 * h }, { data: 93000001, lvl: 12 }, { data: 93000002, lvl: 7 }, { data: 93000003, lvl: 1 }],
      buildings: [
        { data: 1000001, lvl: 17 },
        { data: 1000003, lvl: 17, timer: 50 * h },
        { data: 1000000, lvl: 12, timer: 80 * h },
        { data: 1000000, lvl: 12, timer: 6 * h },
        { data: 1000000, lvl: 12, timer: 118 * h },
        { data: 1000077, lvl: 3, timer: 52 * h },
        { data: HUT, lvl: 6, cnt: 6 },
      ],
      units: [{ data: 4000008, lvl: 11, timer: 90 * h }, { data: 4000132, lvl: 2, timer: 58 * h, extra: true }],
      heroes: [{ data: 28000000, lvl: 95, timer: 126 * h }],
      pets: [{ data: 73000009, lvl: 7, timer: 1 * h }],
    });
  }

  // ---------- state ----------
  var village = null; // the parsed export
  var mode = load(KEY_MODE) === 'max' ? 'max' : 'rush';
  var pasteError = '';

  function setVillage(raw) {
    var v = parse(raw);
    if (v.error) { pasteError = v.error; return false; }
    pasteError = '';
    village = v;
    store(KEY_VILLAGE, raw);
    return true;
  }
  (function restore() {
    var raw = load(KEY_VILLAGE);
    if (raw) {
      var v = parse(raw);
      if (!v.error) village = v;
    }
  })();

  // ---------- drawing ----------
  var KINDS = {
    builder: { label: 'Builder', cls: 'k-builder' }, // buildings and heroes (a hero upgrade takes a builder)
    research: { label: 'Research', cls: 'k-research' },
    pet: { label: 'Pet', cls: 'k-pet' },
  };
  // Little pictures instead of dots: a hammer for builders (and heroes), a spyglass for research, a cat paw for pets.
  var SVG = {
    builder: '<svg viewBox="0 0 24 24" focusable="false"><g transform="rotate(45 12 12)"><rect x="3.5" y="2.5" width="17" height="7" rx="1.8"/><rect x="10.4" y="8.5" width="3.2" height="14" rx="1.3"/></g></svg>',
    research: '<svg viewBox="0 0 24 24" focusable="false"><g transform="rotate(-40 12 12)"><rect x="1.5" y="9.6" width="4.6" height="4.8" rx="1"/><rect x="6.8" y="8.6" width="6.2" height="6.8" rx="1"/><rect x="13.7" y="7.2" width="8.8" height="9.6" rx="1.4"/></g></svg>',
    pet: '<svg viewBox="0 0 24 24" focusable="false"><ellipse cx="12" cy="16.2" rx="5.4" ry="4.4"/><ellipse cx="5" cy="11.2" rx="2" ry="2.8" transform="rotate(-22 5 11.2)"/><ellipse cx="9.2" cy="6.6" rx="2.1" ry="3" transform="rotate(-8 9.2 6.6)"/><ellipse cx="14.8" cy="6.6" rx="2.1" ry="3" transform="rotate(8 14.8 6.6)"/><ellipse cx="19" cy="11.2" rx="2" ry="2.8" transform="rotate(22 19 11.2)"/></svg>',
  };
  function ico(kind) { return '<span class="pl-ico ' + KINDS[kind].cls + '" aria-hidden="true">' + SVG[kind] + '</span>'; }
  function kindLabel(t) { return t.hero ? 'Hero' : KINDS[t.kind].label; }

  function taskText(t) {
    return (t.hero ? 'Hero · ' : '') + t.name + (t.from != null ? ' → lvl ' + (t.from + 1) : '');
  }

  var TH_ART = 18; // the highest Town Hall we have a picture for (assets/th/th1.webp ... th18.webp); raise it when a new Town Hall picture is added
  var TH_MAX = 18; // the highest Town Hall in the game right now
  // a Town Hall picture, or (until there is a picture for it) a gold numbered tile in the same size
  function thPic(n, cls) {
    if (!n || n < 1) return '';
    if (n > TH_ART) return '<span class="pl-th pl-th-tile ' + (cls || '') + '" role="img" aria-label="Town Hall ' + n + '"><b>' + n + '</b></span>';
    return '<img class="pl-th ' + (cls || '') + '" src="assets/th/th' + n + '.webp" alt="Town Hall ' + n + '" width="64" height="64" decoding="async" draggable="false" onerror="this.remove()" />';
  }
  var ARROW = '<svg class="pl-arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h14M12.5 5.5 19 12l-6.5 6.5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  // "about 3 weeks", "about 5 months", "about 2 years 3 months"
  function fmtDays(d) {
    d = Math.max(0, Math.round(d));
    if (d < 1) return 'less than a day';
    if (d < 14) return d + (d === 1 ? ' day' : ' days');
    if (d < 70) return 'about ' + Math.round(d / 7) + ' weeks';
    if (d < 540) return 'about ' + Math.round(d / 30.4) + ' months';
    var y = Math.floor(d / 365.25), mo = Math.round((d - y * 365.25) / 30.4);
    if (mo === 12) { y += 1; mo = 0; }
    return 'about ' + y + (y === 1 ? ' year' : ' years') + (mo ? ' ' + mo + (mo === 1 ? ' month' : ' months') : '');
  }
  function estimateFor(v) {
    if (!v.json || !v.th || !window.CR_CALC || !window.CR_MODEL) return null;
    try {
      return window.CR_CALC.estimate(v.json, { th: v.th, builders: v.builders, exportedAt: v.exportedAt, mode: mode });
    } catch (e) { return null; }
  }
  function goalHtml(v) {
    var top = v.th && v.th >= TH_MAX;
    var rush = mode === 'rush';
    var est = top && rush ? null : estimateFor(v);
    var head, sub, dateHtml = '', extra = '', note = '';
    if (rush && top) {
      head = 'You are at the highest Town Hall!';
      sub = 'There is no higher Town Hall to move up to.';
    } else if (!est) {
      head = rush ? (v.th ? 'Town Hall ' + (v.th + 1) : 'Next Town Hall') : (v.th ? 'Maxing Town Hall ' + v.th : 'Maxing');
      sub = v.th ? 'Working out the date…' : 'The date needs your Town Hall level, which this export does not show.';
    } else {
      head = rush ? 'Town Hall ' + (v.th + 1) : 'Maxing Town Hall ' + v.th;
      var daysFromNow = (est.date - Date.now()) / 86400000;
      dateHtml = '<p class="pl-goal-date">' + esc(longDate(est.date)) + '</p>';
      sub = (rush ? 'Estimated date you can move up' : 'Estimated date everything is done') + ' · ' +
        (daysFromNow <= 0 ? 'this export is old, paste a new one' : fmtDays(daysFromNow));
      if (rush) {
        if (est.already) extra = '<p class="pl-goal-more">Your Town Hall is already being upgraded.</p>';
        else {
          var startAfter = (est.startDate - Date.now()) / 86400000;
          extra = '<p class="pl-goal-more">' + (est.workLeft.upgrades
            ? esc(est.workLeft.upgrades + (est.workLeft.upgrades === 1 ? ' upgrade' : ' upgrades') + ' to finish first (' + fmtDays(est.workLeft.builderDays) + ' of builder time), then the Town Hall upgrade itself (' + fmtDays(est.thDays) + '), starting about ' + dayLabel(est.startDate) + '.')
            : esc('Nothing else to finish first. The Town Hall upgrade itself (' + fmtDays(est.thDays) + ') can start ' + (startAfter <= 0 ? 'now' : 'about ' + dayLabel(est.startDate)) + '.')) + '</p>';
        }
      } else {
        var p = est.parts, parts = [];
        parts.push('Builders ' + fmtDays(p.builder), 'Lab ' + fmtDays(p.lab), 'Pets ' + fmtDays(p.pets));
        extra = '<p class="pl-goal-more">' + esc(parts.join(' · ')) + '. The ' + esc(est.bottleneck === 'builders' ? 'builders are' : est.bottleneck === 'lab' ? 'lab is' : 'pets are') + ' the slowest.</p>';
      }
      // the details live in a "Breakdown" drop-down instead of a long sentence under the date
      note = '<details class="pl-how"><summary>Breakdown</summary>' + extra + '</details>';
      extra = '';
    }
    // your Town Hall, an arrow, and the next one. In Max mode the next one slides away to the right and yours
    // grows (CSS transitions on the .solo class). When the mode was just switched we first draw the old state,
    // then draw() flips the class so the move plays.
    var art = '';
    if (v.th) {
      var solo = top || mode === 'max';
      var shown = artFrom ? (top || artFrom === 'max') : solo;
      art = '<div class="pl-goal-art' + (shown ? ' solo' : '') + '"><span class="pl-thbox">' + thPic(v.th, 'pl-th-now') + '<em>TH' + v.th + '</em></span>' +
        (top ? '' : '<div class="pl-nx"' + (shown ? ' aria-hidden="true"' : '') + '>' + ARROW + '<span class="pl-thbox">' + thPic(v.th + 1, 'pl-th-next') + '<em>TH' + (v.th + 1) + '</em></span></div>') + '</div>';
    }
    return '<section class="pl-card pl-goal">' +
      '<div class="pl-goal-top">' +
        '<span class="pl-mode' + (rush ? ' on' : '') + '">Strategic rush</span>' +
        '<button type="button" class="pl-switch" role="switch" aria-checked="' + (mode === 'max') + '" aria-label="Max" data-act="mode"><i></i></button>' +
        '<span class="pl-mode' + (mode === 'max' ? ' on' : '') + '">Max</span>' +
      '</div>' +
      art +
      '<p class="pl-goal-head">' + esc(head) + '</p>' +
      dateHtml +
      '<p class="pl-goal-sub">' + esc(sub) + '</p>' +
      extra +
      note +
    '</section>';
  }

  function calendarHtml(v) {
    var now = new Date();
    var y = now.getFullYear(), m = now.getMonth();
    var first = new Date(y, m, 1);
    var days = new Date(y, m + 1, 0).getDate();
    var lead = (first.getDay() + 6) % 7; // Monday first
    var byDay = {};
    var list = [];
    v.tasks.forEach(function (t) {
      var d = new Date(t.end);
      if (d.getFullYear() !== y || d.getMonth() !== m) return;
      (byDay[d.getDate()] = byDay[d.getDate()] || []).push(t);
      list.push(t);
    });
    var cells = '';
    var i;
    for (i = 0; i < lead; i++) cells += '<span class="pl-day pl-blank" aria-hidden="true"></span>';
    for (i = 1; i <= days; i++) {
      var ev = byDay[i] || [];
      var dow = (lead + i - 1) % 7;
      var cls = 'pl-day' + (i === now.getDate() ? ' today' : '') + (dow >= 5 ? ' wkend' : '') + (ev.length ? ' has' : '');
      var dots = ev.slice(0, 4).map(function (t) { return ico(t.kind); }).join('');
      var tip = ev.map(function (t) { return kindLabel(t) + ': ' + t.name + (t.from != null ? ' → lvl ' + (t.from + 1) : '') + ' (' + dateTime(t.end) + ')'; }).join('\n');
      cells += '<span class="' + cls + '"' + (tip ? ' title="' + esc(tip) + '"' : '') + '><b>' + i + '</b><span class="pl-dots">' + dots + '</span></span>';
    }
    var head = now.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    var wk = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(function (d, k) { return '<span class="' + (k >= 5 ? 'wkend' : '') + '">' + d + '</span>'; }).join('');
    // what finishes after this month: next month in full, and a note about anything later
    var nm = new Date(y, m + 1, 1);
    var nextList = [], laterList = [];
    v.tasks.forEach(function (t) {
      var d = new Date(t.end);
      var idx = (d.getFullYear() - y) * 12 + (d.getMonth() - m);
      if (idx === 1) nextList.push(t);
      else if (idx > 1) laterList.push(t);
    });
    var nextHtml = '';
    if (nextList.length || laterList.length) {
      nextHtml = '<p class="pl-sub">Finishing next month <span class="pl-subm">' + esc(nm.toLocaleDateString(undefined, { month: 'long' })) + '</span></p>';
      nextHtml += nextList.length ? '<ul class="pl-events">' + nextList.map(function (t) {
        return '<li><span class="pl-when">' + esc(dayLabel(t.end)) + '</span>' + ico(t.kind) + '<span>' + esc(kindLabel(t) + ': ' + t.name + (t.from != null ? ' → lvl ' + (t.from + 1) : '')) + '</span></li>';
      }).join('') + '</ul>' : '<p class="pl-empty">Nothing finishes next month.</p>';
      if (laterList.length) {
        var last = laterList[laterList.length - 1];
        nextHtml += '<p class="pl-later">' + laterList.length + ' more finish' + (laterList.length === 1 ? 'es' : '') + ' after that, the last on ' + esc(dayLabel(last.end)) + '.</p>';
      }
    }
    var rows = list.map(function (t) {
      var done = t.end <= Date.now();
      return '<li class="' + (done ? 'done' : '') + '"><span class="pl-when">' + esc(dayLabel(t.end)) + '</span>' + ico(t.kind) + '<span>' + esc(kindLabel(t) + ': ' + t.name + (t.from != null ? ' → lvl ' + (t.from + 1) : '')) + '</span></li>';
    }).join('');
    return '<section class="pl-card pl-cal" aria-label="Calendar for ' + esc(head) + '">' +
      '<h3 class="pl-month">' + esc(head) + '</h3>' +
      '<div class="pl-weekdays" aria-hidden="true">' + wk + '</div>' +
      '<div class="pl-grid">' + cells + '</div>' +
      '<ul class="pl-legend" aria-hidden="true"><li>' + ico('builder') + 'Builder (buildings and heroes)</li><li>' + ico('research') + 'Research</li><li>' + ico('pet') + 'Pet</li></ul>' +
      '<div class="pl-lower">' +
        '<div class="pl-lists">' +
          (rows ? '<p class="pl-sub">Finishing this month</p><ul class="pl-events">' + rows + '</ul>' : '<p class="pl-empty">Nothing finishes this month.</p>') +
          nextHtml +
        '</div>' +
        '<div class="pl-crews">' + crewHtml(v) + '</div>' +
      '</div>' +
    '</section>';
  }

  // one compact line: who, what, and either the time left (busy) or a "Free" tag
  function rowHtml(label, t, freeText) {
    var now = Date.now();
    if (!t || t.end <= now) {
      var note = t ? taskText(t) + ' finished ' + dayLabel(t.end) : freeText;
      return '<li class="pl-mrow free"><span class="pl-who">' + esc(label) + '</span><span class="pl-what">' + esc(note) + '</span><span class="pl-badge free">Free</span></li>';
    }
    return '<li class="pl-mrow busy"><span class="pl-who">' + esc(label) + '</span>' +
      '<span class="pl-what">' + esc(taskText(t)) + '</span><span class="pl-left">' + esc(span(t.end - now)) + ' left</span></li>';
  }

  function crewHtml(v) {
    var now = Date.now();
    var by = function (k) { return v.tasks.filter(function (t) { return t.kind === k; }); };
    var builders = by('builder');
    var out = '';
    var head = function (kind, title, count) {
      return '<h4 class="pl-h">' + ico(kind) + '<span class="pl-h-t">' + title + '</span><span class="pl-count">' + count + '</span></h4>';
    };

    var freeCount = 0;
    var brows = '';
    for (var i = 0; i < v.builders; i++) {
      var t = builders[i];
      if (!t || t.end <= now) freeCount++;
      brows += rowHtml('Builder ' + (i + 1), t, 'ready for a new upgrade');
    }
    out += '<section class="pl-crew k-builder">' + head('builder', 'Builders', freeCount + ' of ' + v.builders + ' free') + '<ul class="pl-rows">' + brows + '</ul></section>';

    var res = by('research');
    var rrows = res.length ? res.map(function (t, k) { return rowHtml(k === 0 ? 'Laboratory' : 'Lab slot ' + (k + 1), t, ''); }).join('') : rowHtml('Laboratory', null, 'nothing is being researched');
    var resBusy = res.filter(function (t) { return t.end > now; }).length;
    out += '<section class="pl-crew k-research">' + head('research', 'Research', resBusy ? resBusy + ' running' : 'free') + '<ul class="pl-rows">' + rrows + '</ul></section>';

    var pets = by('pet');
    var prows = pets.length ? pets.map(function (t) { return rowHtml('Pet House', t, ''); }).join('') : rowHtml('Pet House', null, 'no pet is being upgraded');
    var petBusy = pets.filter(function (t) { return t.end > now; }).length;
    out += '<section class="pl-crew k-pet">' + head('pet', 'Pets', petBusy ? petBusy + ' running' : 'free') + '<ul class="pl-rows">' + prows + '</ul></section>';

    // (the helpers are read from the export and kept in v.helpers for later, but they are not part of the planner view)
    return out;
  }

  function villageHtml(v) {
    var age = Date.now() - v.exportedAt;
    var stale = age > 6 * 3600000;
    return '<div class="pl-bar"><div class="pl-vinfo">' +
        '<b>' + esc(v.tag || 'Your village') + '</b>' + (v.th ? '<span>Town Hall ' + v.th + '</span>' : '') +
        '<span>Exported ' + esc(ago(age)) + '</span></div>' +
      '</div>' +
      (stale ? '<p class="pl-stale">This export is ' + esc(span(age)) + ' old. Upgrades that have finished since are shown as free; paste a fresh export for exact times.</p>' : '') +
      goalHtml(v) + calendarHtml(v);
  }

  function pasteHtml(open) {
    return '<details class="pl-paste"' + (open ? ' open' : '') + '>' +
      '<summary>' + (village ? 'Paste a new export' : 'Load your village') + '</summary>' +
      '<ol class="pl-steps"><li>In Clash of Clans open <b>Settings</b>, then <b>More Settings</b>.</li><li>Scroll to <b>Data Export</b> and tap <b>Copy</b>.</li><li>Paste it below.</li></ol>' +
      '<textarea id="pl-text" rows="4" spellcheck="false" aria-label="Village export" placeholder="{&quot;tag&quot;:&quot;#...&quot;, ...}"></textarea>' +
      (pasteError ? '<p class="pl-error" role="alert">' + esc(pasteError) + '</p>' : '') +
      '<div class="pl-actions"><button type="button" class="pl-btn" data-act="load">Load village</button>' +
      '<button type="button" class="pl-btn ghost" data-act="sample">Try a sample village</button>' +
      (village ? '<button type="button" class="pl-btn ghost" data-act="clear">Remove my village</button>' : '') + '</div>' +
      '<p class="pl-privacy">Your village stays in this browser. Nothing is sent anywhere.</p>' +
    '</details>';
  }

  var viewEl;
  var artFrom = null; // the mode we are animating away from (only while drawing right after the switch)
  var calmMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // The Town Halls blow up to full size the first time they are on screen (also when the planner opens later)
  function popWhenSeen(art) {
    if (calmMotion || !('IntersectionObserver' in window)) return;
    art.classList.add('pre');
    var io = new IntersectionObserver(function (entries) {
      if (!entries.some(function (en) { return en.isIntersecting; })) return;
      io.disconnect();
      art.classList.remove('pre');
      art.classList.add('pop');
    }, { threshold: 0.4 });
    io.observe(art);
  }
  // fromMode: the mode we just switched away from (plays the slide); refresh: the 30-second refresh, which must
  // not close the Breakdown or replay the Town Hall pop-in
  function draw(fromMode, refresh) {
    if (!viewEl) return;
    var wasOpen = refresh && viewEl.querySelector('.pl-how[open]') !== null;
    artFrom = fromMode || null;
    viewEl.innerHTML = village ? villageHtml(village) : '<p class="pl-intro">See who is busy, who is free and when things finish. Load your village to begin.</p>';
    artFrom = null;
    if (wasOpen) { var hw = viewEl.querySelector('.pl-how'); if (hw) hw.open = true; }
    if (refresh) return;
    var art = viewEl.querySelector('.pl-goal-art');
    if (!art) return;
    var nx = art.querySelector('.pl-nx');
    if (fromMode) {
      if (!nx) return; // at the top Town Hall nothing moves
      void art.offsetWidth; // let the old state paint, then change it so the transition runs
      var solo = mode === 'max';
      art.classList.toggle('solo', solo);
      nx.setAttribute('aria-hidden', solo ? 'true' : 'false');
    } else {
      popWhenSeen(art);
    }
  }
  function shell() {
    root.innerHTML = '<div id="pl-pastewrap"></div><div id="pl-view"></div>'; // "Paste a new export" sits at the top
    viewEl = document.getElementById('pl-view');
    drawPaste(!village);
    draw();
  }
  function drawPaste(open) {
    var w = document.getElementById('pl-pastewrap');
    if (w) w.innerHTML = pasteHtml(open);
  }

  root.addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('[data-act]') : null;
    if (!b) return;
    var act = b.getAttribute('data-act');
    if (act === 'mode') {
      var was = mode;
      mode = mode === 'max' ? 'rush' : 'max';
      store(KEY_MODE, mode);
      draw(was);
    } else if (act === 'load') {
      var ta = document.getElementById('pl-text');
      var ok = setVillage(ta ? ta.value.trim() : '');
      drawPaste(!ok);
      draw();
      if (ok) {
        var top = document.getElementById('pl-view');
        if (top && top.scrollIntoView) top.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    } else if (act === 'sample') {
      setVillage(sampleRaw());
      drawPaste(false);
      draw();
    } else if (act === 'clear') {
      village = null;
      pasteError = '';
      store(KEY_VILLAGE, null);
      drawPaste(true);
      draw();
    }
  });

  // Keep "time left" and the free/busy badges fresh while the page is open.
  setInterval(function () {
    var page = document.getElementById('planner-page');
    if (village && page && !page.hidden && !document.hidden) draw(null, true);
  }, 30000);

  shell();
  window.CR_PLANNER = { parse: parse, sample: sampleRaw };
})();
