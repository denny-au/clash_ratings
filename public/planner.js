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
  var KEY_PASS = 'cr-planner-pass';
  var KEY_GOAL = 'cr-planner-goal';
  var PASS_CUT = 0.17; // what a Gold Pass realistically saves (the game says 20% faster, which is about 17% less time)
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
  // A name from planner-data.js, else from the upgrade-time table (planner-model.js), else a generic one
  var MODEL_GROUP = { buildings: 'b', units: 'l', heroes: 'h', pets: 'p' };
  function nameOf(group, id, fallback) {
    var t = N[group] || {};
    if (t[id]) return t[id];
    var M = window.CR_MODEL, g = M && M[MODEL_GROUP[group]];
    if (g && g[id] && g[id].n) return g[id].n;
    return fallback + ' #' + id;
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

  // ---------- state ----------
  var village = null; // the parsed export
  var mode = load(KEY_MODE) === 'max' ? 'max' : 'rush';
  // Extra goals next to the Strategic rush / Max switch: pick one and the card shows the date for just that part.
  var GOALS = {
    heroes: { label: 'Heroes', kind: 'builder', head: 'Maxing heroes' },
    lab: { label: 'Lab', kind: 'research', head: 'Finishing the lab' },
    pets: { label: 'Pets', kind: 'pet', head: 'Maxing pets' },
    defenses: { label: 'Defenses', kind: 'builder', head: 'Maxing defenses' },
  };
  var GOAL_ORDER = ['heroes', 'defenses', 'lab', 'pets'];
  var goal = GOALS[load(KEY_GOAL)] ? load(KEY_GOAL) : null; // null = just the Strategic rush / Max switch
  function eff() { return goal || mode; } // what the card is working out right now
  var gold = load(KEY_PASS) === 'gold'; // Gold Pass on (card tinted gold) or Silver Pass (no boost, tinted silver)
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
      return window.CR_CALC.estimate(v.json, { th: v.th, builders: v.builders, exportedAt: v.exportedAt, mode: eff(), cut: gold ? PASS_CUT : 0 });
    } catch (e) { return null; }
  }
  function passNote(g) { return g ? '<b class="g">Gold pass</b> · 17% realistic boost' : '<b class="s">Silver pass</b> · 0% boost'; }
  function bullet(kind, text) { return '<li>' + ico(kind) + '<span>' + esc(text) + '</span></li>'; }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }
  // the Breakdown: one line per point, each with the builder / lab / pet symbol for the kind of work
  function breakdownHtml(est, m, v) {
    var w = est.workLeft || {}, li = [];
    if (m === 'rush') {
      if (est.already) li.push(bullet('builder', 'Your Town Hall is already being upgraded.'));
      else {
        var startAfter = (est.startDate - Date.now()) / 86400000;
        if (w.upgrades) li.push(bullet('builder', plural(w.upgrades, 'upgrade', 'upgrades') + ' to finish first · ' + fmtDays(w.builderDays) + ' of builder time'));
        else li.push(bullet('builder', 'Nothing else to finish first'));
        li.push(bullet('builder', 'Town Hall upgrade itself · ' + fmtDays(est.thDays)));
        li.push(bullet('builder', startAfter <= 0 ? 'Can start now' : 'Starts about ' + dayLabel(est.startDate)));
      }
    } else if (m === 'max') {
      var p = est.parts, slow = est.bottleneck;
      li.push(bullet('builder', 'Builders · ' + fmtDays(p.builder) + (slow === 'builders' ? ' · slowest' : '')));
      li.push(bullet('research', 'Lab · ' + fmtDays(p.lab) + (slow === 'lab' ? ' · slowest' : '')));
      li.push(bullet('pet', 'Pets · ' + fmtDays(p.pets) + (slow === 'pets' ? ' · slowest' : '')));
    } else if (m === 'heroes' || m === 'defenses') {
      var what = m === 'heroes' ? ['hero upgrade', 'hero upgrades'] : ['defense upgrade', 'defense upgrades'];
      li.push(bullet('builder', plural(w.upgrades, what[0], what[1]) + ' · ' + fmtDays(w.builderDays) + (m === 'heroes' ? ' of hero time' : ' of builder time')));
      li.push(bullet('builder', m === 'heroes' ? 'Each hero upgrades one level at a time, so the slowest hero sets the date' : 'Shared across your ' + est.builders + ' builders'));
    } else if (m === 'lab') {
      li.push(bullet('research', plural(w.labUpgrades, 'lab upgrade', 'lab upgrades') + ' · ' + fmtDays(w.labDays) + ' of lab time'));
      li.push(bullet('research', est.labSlots === 2 ? 'Both lab slots working through them' : 'One lab slot working through them'));
    } else {
      li.push(bullet('pet', plural(w.petUpgrades, 'pet upgrade', 'pet upgrades') + ' · ' + fmtDays(w.petDays) + ' of pet time'));
      li.push(bullet('pet', 'The Pet House does one at a time'));
    }
    return '<details class="pl-how"><summary>Breakdown</summary><ul class="pl-how-list">' + li.join('') + '</ul></details>';
  }
  function goalHtml(v) {
    var m = eff();
    var top = v.th && v.th >= TH_MAX;
    var rush = m === 'rush';
    var est = top && rush ? null : estimateFor(v);
    var head, sub, dateHtml = '', extra = '', note = '';
    var headFor = function () { return goal ? GOALS[goal].head : (rush ? (v.th ? 'Town Hall ' + (v.th + 1) : 'Next Town Hall') : (v.th ? 'Maxing Town Hall ' + v.th : 'Maxing')); };
    if (rush && top) {
      head = 'You are at the highest Town Hall!';
      sub = 'There is no higher Town Hall to move up to.';
    } else if (!est) {
      head = headFor();
      sub = v.th ? 'Working out the date…' : 'The date needs your Town Hall level, which this export does not show.';
    } else if (!rush && est.doneSec <= 0) {
      head = headFor();
      sub = 'Nothing left to upgrade here at your Town Hall level.';
    } else {
      head = rush ? 'Town Hall ' + (v.th + 1) : headFor();
      var daysFromNow = (est.date - Date.now()) / 86400000;
      dateHtml = '<p class="pl-goal-date">' + esc(longDate(est.date)) + '</p>';
      sub = (rush ? 'Estimated date you can move up' : goal ? 'Estimated date this is done' : 'Estimated date everything is done') + ' · ' +
        (daysFromNow <= 0 ? 'this export is old, paste a new one' : fmtDays(daysFromNow));
      note = breakdownHtml(est, m, v);
    }
    // your Town Hall, an arrow, and the next one. In Max mode the next one slides away to the right and yours
    // grows (CSS transitions on the .solo class). When the mode was just switched we first draw the old state,
    // then draw() flips the class so the move plays.
    var art = '';
    if (v.th) {
      var solo = top || !rush;
      var shown = artFrom ? (top || artFrom !== 'rush') : solo;
      art = '<div class="pl-goal-art' + (shown ? ' solo' : '') + '"><span class="pl-thbox">' + thPic(v.th, 'pl-th-now') + '<em>TH' + v.th + '</em></span>' +
        (top ? '' : '<div class="pl-nx"' + (shown ? ' aria-hidden="true"' : '') + '>' + ARROW + '<span class="pl-thbox">' + thPic(v.th + 1, 'pl-th-next') + '<em>TH' + (v.th + 1) + '</em></span></div>') + '</div>';
    }
    var g = passFrom != null ? passFrom : gold; // while a flip is starting we first draw the old pass
    return '<section class="pl-card pl-goal ' + (g ? 'gold' : 'silver') + '">' +
      '<button type="button" class="pl-pass' + (g ? ' gold' : '') + '" data-act="pass" aria-pressed="' + g + '" aria-label="Gold Pass" title="Gold Pass">' +
        '<span class="pl-coin"><img class="pl-face front" src="assets/pass/silver.webp" alt="" width="40" height="40" decoding="async" draggable="false" /><img class="pl-face back" src="assets/pass/gold.webp" alt="" width="40" height="40" decoding="async" draggable="false" /></span>' +
      '</button>' +
      '<div class="pl-goal-top">' +
        '<span class="pl-mode' + (rush ? ' on' : '') + '">Strategic rush</span>' +
        '<button type="button" class="pl-switch' + (goal ? ' mid' : '') + '" role="switch" aria-checked="' + (m === 'max') + '" aria-label="Max" data-act="mode"><i></i></button>' +
        '<span class="pl-mode' + (m === 'max' ? ' on' : '') + '">Max</span>' +
      '</div>' +
      '<div class="pl-chips" role="group" aria-label="Other goals">' + GOAL_ORDER.map(function (id) {
        return '<button type="button" class="pl-chip k-' + GOALS[id].kind + (goal === id ? ' on' : '') + '" aria-pressed="' + (goal === id) + '" data-act="goal" data-goal="' + id + '">' + ico(GOALS[id].kind) + '<span>' + GOALS[id].label + '</span></button>';
      }).join('') + '</div>' +
      '<p class="pl-pass-note" aria-live="polite">' + passNote(g) + '</p>' +
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
    var lead = first.getDay(); // Sunday first
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
      var dow = (lead + i - 1) % 7; // 0 = Sunday
      var cls = 'pl-day' + (i === now.getDate() ? ' today' : '') + (dow === 0 || dow === 6 ? ' wkend' : '') + (ev.length ? ' has' : '');
      var dots = ev.slice(0, 4).map(function (t) { return ico(t.kind); }).join('');
      var tip = ev.map(function (t) { return kindLabel(t) + ': ' + t.name + (t.from != null ? ' → lvl ' + (t.from + 1) : '') + ' (' + dateTime(t.end) + ')'; }).join('\n');
      cells += '<span class="' + cls + '"' + (tip ? ' title="' + esc(tip) + '"' : '') + '><b>' + i + '</b><span class="pl-dots">' + dots + '</span></span>';
    }
    var head = now.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    var wk = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(function (d, k) { return '<span class="' + (k === 0 || k === 6 ? 'wkend' : '') + '">' + d + '</span>'; }).join('');
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
      brows += rowHtml(i >= 6 ? 'Goblin Builder' : 'Builder ' + (i + 1), t, 'ready for a new upgrade');
    }
    out += '<section class="pl-crew k-builder">' + head('builder', 'Builders', freeCount + ' of ' + v.builders + ' free') + '<ul class="pl-rows">' + brows + '</ul></section>';

    var res = by('research');
    var rrows = res.length ? res.map(function (t, k) { return rowHtml(k === 0 ? 'Laboratory' : 'Goblin Researcher', t, ''); }).join('') : rowHtml('Laboratory', null, 'nothing is being researched');
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
      (village ? '<button type="button" class="pl-btn ghost" data-act="clear">Remove my village</button>' : '') + '</div>' +
      '<p class="pl-privacy">Your village stays in this browser. Nothing is sent anywhere.</p>' +
    '</details>';
  }

  var viewEl;
  var passFrom = null; // the pass we are flipping away from (only while drawing right after the click)
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
  function draw(fromMode, refresh, passWas) {
    if (!viewEl) return;
    var wasOpen = (refresh || passWas != null) && viewEl.querySelector('.pl-how[open]') !== null;
    artFrom = fromMode || null;
    passFrom = passWas != null ? passWas : null;
    viewEl.innerHTML = village ? villageHtml(village) : '<p class="pl-intro">See who is busy, who is free and when things finish. Load your village to begin.</p>';
    artFrom = null; passFrom = null;
    if (passWas != null) { // old coin first, then flip it to the new one so the transition plays
      var goal = viewEl.querySelector('.pl-goal'), coin = viewEl.querySelector('.pl-pass');
      if (goal && coin) { void goal.offsetWidth; goal.classList.toggle('gold', gold); goal.classList.toggle('silver', !gold); coin.classList.toggle('gold', gold); coin.setAttribute('aria-pressed', gold); var pn = viewEl.querySelector('.pl-pass-note'); if (pn) pn.innerHTML = passNote(gold); coin.classList.add('hop'); setTimeout(function () { coin.classList.remove('hop'); }, 1000); }
    }
    if (wasOpen) { var hw = viewEl.querySelector('.pl-how'); if (hw) hw.open = true; }
    if (refresh || passWas != null) return;
    var art = viewEl.querySelector('.pl-goal-art');
    if (!art) return;
    var nx = art.querySelector('.pl-nx');
    if (fromMode) {
      if (!nx) return; // at the top Town Hall nothing moves
      void art.offsetWidth; // let the old state paint, then change it so the transition runs
      var solo = eff() !== 'rush';
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
      var was = eff();
      if (goal) { goal = null; mode = 'rush'; } // from an extra goal the switch goes back to Strategic rush
      else mode = mode === 'max' ? 'rush' : 'max';
      store(KEY_MODE, mode);
      store(KEY_GOAL, null);
      draw(was);
    } else if (act === 'goal') {
      var wasG = eff();
      var pick = b.getAttribute('data-goal');
      goal = goal === pick ? null : pick; // tap the lit one again to go back to the switch
      store(KEY_GOAL, goal);
      draw(wasG);
    } else if (act === 'pass') {
      var wasGold = gold;
      gold = !gold;
      store(KEY_PASS, gold ? 'gold' : 'silver');
      draw(null, false, wasGold);
    } else if (act === 'load') {
      var ta = document.getElementById('pl-text');
      var ok = setVillage(ta ? ta.value.trim() : '');
      drawPaste(!ok);
      draw();
      if (ok) {
        var top = document.getElementById('pl-view');
        if (top && top.scrollIntoView) top.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
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
  window.CR_PLANNER = { parse: parse };
})();
