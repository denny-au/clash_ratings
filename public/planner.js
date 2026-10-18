// The Planner page: paste a village export, see who is busy and who is free, and a calendar of the month.
// Everything stays in this browser (localStorage); nothing is sent anywhere.
(function () {
  'use strict';
  var D = window.CR_PLANNER_DATA || { estimate: { rushDays: 80, maxDays: 400 }, names: {} };
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

    function add(kind, group, e, fallback) {
      var t = num(e.timer);
      if (t == null || t <= 0) return;
      tasks.push({
        kind: kind,
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
    (j.heroes || []).forEach(function (e) { add('hero', 'heroes', e || {}, 'Hero'); });
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
    builder: { label: 'Builder', cls: 'k-builder' },
    research: { label: 'Research', cls: 'k-research' },
    pet: { label: 'Pet', cls: 'k-pet' },
    hero: { label: 'Hero', cls: 'k-hero' },
  };

  function taskText(t) {
    return t.name + (t.from != null ? ' → lvl ' + (t.from + 1) : '');
  }

  function goalHtml(v) {
    var days = mode === 'max' ? D.estimate.maxDays : D.estimate.rushDays;
    var when = Date.now() + days * 86400000;
    var head = mode === 'max' ? 'Everything maxed' : (v.th ? 'Town Hall ' + (v.th + 1) : 'Next Town Hall');
    var sub = mode === 'max' ? 'Estimated date everything is done' : 'Estimated date you can move up';
    return '<section class="pl-card pl-goal">' +
      '<div class="pl-goal-top">' +
        '<span class="pl-mode' + (mode === 'rush' ? ' on' : '') + '">Strategic rush</span>' +
        '<button type="button" class="pl-switch" role="switch" aria-checked="' + (mode === 'max') + '" aria-label="Max" data-act="mode"><i></i></button>' +
        '<span class="pl-mode' + (mode === 'max' ? ' on' : '') + '">Max</span>' +
      '</div>' +
      '<p class="pl-goal-head">' + esc(head) + '</p>' +
      '<p class="pl-goal-date">' + esc(longDate(when)) + '</p>' +
      '<p class="pl-goal-sub">' + sub + ' · about ' + days + ' days</p>' +
      '<p class="pl-goal-note">Placeholder estimate for now</p>' +
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
      var dots = ev.slice(0, 4).map(function (t) { return '<i class="' + KINDS[t.kind].cls + '"></i>'; }).join('');
      var tip = ev.map(function (t) { return KINDS[t.kind].label + ': ' + taskText(t) + ' (' + dateTime(t.end) + ')'; }).join('\n');
      cells += '<span class="' + cls + '"' + (tip ? ' title="' + esc(tip) + '"' : '') + '><b>' + i + '</b><span class="pl-dots">' + dots + '</span></span>';
    }
    var head = now.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    var wk = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(function (d, k) { return '<span class="' + (k >= 5 ? 'wkend' : '') + '">' + d + '</span>'; }).join('');
    var rows = list.map(function (t) {
      var done = t.end <= Date.now();
      return '<li class="' + (done ? 'done' : '') + '"><span class="pl-when">' + esc(dayLabel(t.end)) + '</span><i class="' + KINDS[t.kind].cls + '"></i><span>' + esc(KINDS[t.kind].label + ': ' + taskText(t)) + '</span></li>';
    }).join('');
    return '<section class="pl-card pl-cal" aria-label="Calendar for ' + esc(head) + '">' +
      '<h3 class="pl-month">' + esc(head) + '</h3>' +
      '<div class="pl-weekdays" aria-hidden="true">' + wk + '</div>' +
      '<div class="pl-grid">' + cells + '</div>' +
      '<ul class="pl-legend" aria-hidden="true"><li><i class="k-builder"></i>Builder</li><li><i class="k-research"></i>Research</li><li><i class="k-pet"></i>Pet</li><li><i class="k-hero"></i>Hero</li></ul>' +
      (rows ? '<p class="pl-sub">Finishing this month</p><ul class="pl-events">' + rows + '</ul>' : '<p class="pl-empty">Nothing finishes this month.</p>') +
    '</section>';
  }

  function rowHtml(label, t, freeText) {
    var now = Date.now();
    if (!t || t.end <= now) {
      var note = t ? taskText(t) + ' finished ' + dateTime(t.end) : freeText;
      return '<li class="pl-row free"><span class="pl-who">' + esc(label) + '</span><span class="pl-badge free">Free</span><span class="pl-what">' + esc(note) + '</span></li>';
    }
    return '<li class="pl-row busy"><span class="pl-who">' + esc(label) + '</span><span class="pl-badge busy">Busy</span>' +
      '<span class="pl-what">' + esc(taskText(t)) + '</span><span class="pl-left">' + esc(span(t.end - now)) + ' left</span></li>';
  }

  function crewHtml(v) {
    var now = Date.now();
    var by = function (k) { return v.tasks.filter(function (t) { return t.kind === k; }); };
    var builders = by('builder');
    var out = '';

    var freeCount = 0;
    var brows = '';
    for (var i = 0; i < v.builders; i++) {
      var t = builders[i];
      if (!t || t.end <= now) freeCount++;
      brows += rowHtml('Builder ' + (i + 1), t, 'ready for a new upgrade');
    }
    out += '<section class="pl-card"><h3 class="pl-h">Builders <span class="pl-count">' + freeCount + ' of ' + v.builders + ' free</span></h3><ul class="pl-rows">' + brows + '</ul></section>';

    var res = by('research');
    var rrows = res.length ? res.map(function (t, k) { return rowHtml(k === 0 ? 'Laboratory' : 'Lab slot ' + (k + 1), t, ''); }).join('') : rowHtml('Laboratory', null, 'nothing is being researched');
    var resBusy = res.filter(function (t) { return t.end > now; }).length;
    out += '<section class="pl-card"><h3 class="pl-h">Research <span class="pl-count">' + (resBusy ? resBusy + ' running' : 'free') + '</span></h3><ul class="pl-rows">' + rrows + '</ul></section>';

    var pets = by('pet');
    var prows = pets.length ? pets.map(function (t) { return rowHtml('Pet House', t, ''); }).join('') : rowHtml('Pet House', null, 'no pet is being upgraded');
    var petBusy = pets.filter(function (t) { return t.end > now; }).length;
    out += '<section class="pl-card"><h3 class="pl-h">Pets <span class="pl-count">' + (petBusy ? petBusy + ' running' : 'free') + '</span></h3><ul class="pl-rows">' + prows + '</ul></section>';

    var heroes = by('hero');
    if (heroes.length) {
      out += '<section class="pl-card"><h3 class="pl-h">Heroes <span class="pl-count">' + heroes.filter(function (t) { return t.end > now; }).length + ' upgrading</span></h3><ul class="pl-rows">' +
        heroes.map(function (t) { return rowHtml('Hero Hall', t, ''); }).join('') + '</ul></section>';
    }

    if (v.helpers.length) {
      out += '<section class="pl-card"><h3 class="pl-h">Helpers</h3><ul class="pl-helpers">' + v.helpers.map(function (h) {
        var ready = h.ready <= now;
        return '<li class="' + (ready ? 'ready' : 'wait') + '"><b>' + esc(h.name) + '</b>' + (h.lvl != null ? '<em>lvl ' + h.lvl + '</em>' : '') +
          '<span>' + (ready ? 'Ready' : 'Back in ' + esc(span(h.ready - now))) + '</span></li>';
      }).join('') + '</ul></section>';
    }
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
      goalHtml(v) + calendarHtml(v) + '<div class="pl-crews">' + crewHtml(v) + '</div>';
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
  function draw() {
    if (!viewEl) return;
    viewEl.innerHTML = village ? villageHtml(village) : '<p class="pl-intro">See who is busy, who is free and when things finish. Load your village to begin.</p>';
  }
  function shell() {
    root.innerHTML = '<div id="pl-view"></div><div id="pl-pastewrap"></div>';
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
      mode = mode === 'max' ? 'rush' : 'max';
      store(KEY_MODE, mode);
      draw();
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
    if (village && page && !page.hidden && !document.hidden) draw();
  }, 30000);

  shell();
  window.CR_PLANNER = { parse: parse, sample: sampleRaw };
})();
