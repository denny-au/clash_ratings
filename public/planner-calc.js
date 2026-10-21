// The Planner's date maths. It takes a village export plus the upgrade times in planner-model.js and works out
//   * "rush":  when you can reach the next Town Hall, doing what the Rush Bible does first
//   * "max":   when everything is maxed at your current Town Hall
// by pretending to run your builders (and lab, and pet house) forward from the moment of the export.
//
// Assumptions (shown on the Planner too): the times are the game's normal times (no boosts, potions, hammers or
// Builder's Apprentice) unless the Gold Pass switch is on, which takes opts.cut (17%) off every upgrade still to start, builders and the lab never sit idle, and walls, traps and equipment are left out.
(function (root) {
  'use strict';
  var M = root.CR_MODEL;

  var TOWN_HALL = 1000001, HUT = 1000015, PET_HOUSE = 1000068;
  // Rush Bible: before moving up, finish Army Camps, Clan Castle, Hero Hall and drop the new buildings
  var RUSH_FIRST = { 1000000: 1, 1000014: 1, 1000071: 1 };
  // TH16 is the one mandatory stop: Eagle Artillery plus the Cannons and Archer Towers that get merged
  var TH16_STOP = { 1000031: 1, 1000008: 1, 1000009: 1 };

  function capLevel(e, limit) {
    var lv = 0;
    for (var i = 0; i < e.r.length; i++) if (e.r[i] <= limit) lv = i + 1;
    return lv;
  }
  function num(x) { return typeof x === 'number' && isFinite(x) ? x : 0; }

  // a job is one thing climbing from level `from` to level `to`; step i costs t[from + i] seconds
  var CUT = 0; // share of every new upgrade's time that a Gold Pass takes off (0 = none)
  function makeJob(kind, id, e, from, to, readyAt, first) {
    var steps = [];
    for (var l = from; l < to; l++) steps.push((e.t[l] || 0) * (1 - CUT));
    return { kind: kind, id: id, name: e.n, cat: e.cat, steps: steps, at: 0, ready: readyAt || 0, first: !!first, left: steps.reduce(function (a, b) { return a + b; }, 0) };
  }

  // Run the jobs on the given slots (each slot = a builder or a lab, with the time it is next free).
  // Jobs marked `first` are always picked before the others; otherwise the job with most work left goes first.
  function run(jobs, slots) {
    var finish = 0;
    var open = jobs.filter(function (j) { return j.steps.length > j.at; });
    var guard = 0;
    while (open.length && guard++ < 200000) {
      var s = 0;
      for (var i = 1; i < slots.length; i++) if (slots[i] < slots[s]) s = i;
      var t = slots[s];
      var pick = null, soonest = Infinity;
      for (var k = 0; k < open.length; k++) {
        var j = open[k];
        if (j.ready <= t) {
          if (!pick || (j.first && !pick.first) || (j.first === pick.first && j.left > pick.left)) pick = j;
        } else if (j.ready < soonest) soonest = j.ready;
      }
      if (!pick) { slots[s] = soonest; continue; } // nothing ready yet: this slot waits
      var step = pick.steps[pick.at++];
      pick.left -= step;
      pick.ready = slots[s] = t + step;
      pick.end = pick.ready; // when this job's last finished step ends
      if (pick.ready > finish) finish = pick.ready;
      if (pick.at >= pick.steps.length) open.splice(open.indexOf(pick), 1);
    }
    return finish;
  }

  // is the Pet House built? true / false, or null when the export is too short to tell
  function petHouseBuilt(j) {
    var list = (j && j.buildings) || [];
    if (list.length < 15) return true; // a very short export: do not guess
    return list.some(function (b) { return b && b.data === PET_HOUSE && (num(b.lvl) >= 1 || !(num(b.timer) > 0)); }); // built, unless it is still being put up (level 0 with a timer)
  }

  function slotsFrom(busy, count) {
    var s = busy.slice();
    while (s.length < count) s.push(0);
    return s;
  }
  function sum(jobs) { return jobs.reduce(function (a, j) { return a + j.steps.reduce(function (x, y) { return x + y; }, 0); }, 0); }
  function steps(jobs) { return jobs.reduce(function (a, j) { return a + j.steps.length; }, 0); }

  // j: the export (already parsed), opts: { th, builders, exportedAt, mode }
  function estimate(j, opts) {
    if (!M || !j) return null;
    var T = opts.th;
    if (!T || T < 1 || T > M.th.length) return null;
    var builders = Math.max(1, opts.builders || 5);
    CUT = opts.cut > 0 && opts.cut < 1 ? opts.cut : 0; // timers already running in the export are left as they are
    var DAY = 86400;
    var mode = { max: 1, heroes: 1, lab: 1, pets: 1, defenses: 1 }[opts.mode] ? opts.mode : 'rush'; // rush, max, or one part of maxing: heroes / lab / pets / defenses

    // ----- builder side -----
    var owned = {};     // how many of each building you have
    var busyB = [];     // builders working right now (seconds from the export until they are free)
    var busyDef = [];   // ...the ones of them that are upgrading a defence
    var jobsB = [];
    var thBusy = null;  // the Town Hall itself is being upgraded
    var petHouse = petHouseBuilt(j);
    (j.buildings || []).forEach(function (b) {
      if (!b || typeof b !== 'object' || b.data === HUT) return;
      var e = M.b[b.data];
      var cnt = Math.max(1, num(b.cnt) || 1);
      var lvl = num(b.lvl);
      var timer = num(b.timer);
      if (b.data === TOWN_HALL) { if (timer > 0) { thBusy = timer; if (mode !== 'rush') busyB.push(timer); } return; } // (outside Strategic rush the Town Hall upgrade keeps one builder busy)
      if (!e) { if (timer > 0) busyB.push(timer); return; }
      owned[b.data] = (owned[b.data] || 0) + cnt;
      var cap = capLevel(e, T);
      var from = timer > 0 ? lvl + 1 : lvl; // an upgrade in progress ends one level higher
      if (timer > 0) { busyB.push(timer); if (e.cat === 'defenses') busyDef.push(timer); }
      var gate = mode === 'rush' ? (RUSH_FIRST[b.data] || (T === 16 && TH16_STOP[b.data])) : true;
      if (!gate || from >= cap) return;
      for (var c = 0; c < cnt; c++) jobsB.push(makeJob('b', b.data, e, from, cap, timer > 0 ? timer : 0, true));
    });
    // buildings you are allowed at this Town Hall but have not built yet (skipped for a very short export,
    // which would make every building look missing)
    var partial = (j.buildings || []).length < 15;
    Object.keys(M.b).forEach(function (id) {
      var e = M.b[id];
      if (partial) return;
      if (+id === HUT || e.cat === 'guardians') return;
      var allowed = e.c[T] || 0;
      var miss = allowed - (owned[id] || 0);
      if (allowed <= 0 || miss <= 0) return;
      var cap = capLevel(e, T);
      for (var m = 0; m < miss; m++) jobsB.push(makeJob('b', +id, e, 0, mode === 'rush' ? Math.min(1, cap) : cap, 0, true));
    });

    // heroes: a hero upgrade takes a builder
    var hallLvl = M.hall.filter(function (x) { return x <= T; }).length;
    var heroBusy = [];
    var heroOwed = {};
    var heroJobs = [];
    var heroRows = []; // one per hero: its name, a running upgrade's timer, and its job (for the bottleneck)
    var heroOpen = false;
    (j.heroes || []).forEach(function (h) {
      var e = h && M.h[h.data];
      if (!e) return;
      heroOwed[h.data] = 1;
      var cap = capLevel(e, hallLvl), timer = num(h.timer), from = timer > 0 ? num(h.lvl) + 1 : num(h.lvl);
      if (timer > 0) heroBusy.push(timer);
      var hjob = null;
      if (from < cap) { heroOpen = true; hjob = makeJob('h', h.data, e, from, cap, timer > 0 ? timer : 0, false); heroJobs.push(hjob); }
      heroRows.push({ name: e.n, timer: timer, job: hjob });
    });
    if (mode !== 'rush') {
      Object.keys(M.h).forEach(function (id) {
        var e = M.h[id];
        if (heroOwed[id] || e.r[0] > hallLvl) return;
        var cap = capLevel(e, hallLvl);
        if (cap > 1) { heroOpen = true; var mj = makeJob('h', +id, e, 1, cap, 0, false); heroJobs.push(mj); heroRows.push({ name: e.n, timer: 0, job: mj }); }
      });
    }

    var out = { mode: mode, th: T, builders: builders, partial: partial };
    var anyRushJobs = jobsB.length;
    var startMs, doneSec, finishB;
    if (mode === 'rush') {
      if (thBusy != null) {
        doneSec = thBusy;
        out.already = true;
        out.startSec = 0;
      } else {
        // one builder stays on a hero all the time, as the Rush Bible says
        var reserve = heroBusy.length || (heroOpen ? 1 : 0);
        var usable = Math.max(1, builders - Math.min(reserve, builders - 1));
        var slots = slotsFrom(busyB, usable);
        finishB = run(jobsB, slots);
        var free = Math.min.apply(null, slots);
        var start = Math.max(finishB, free);
        out.startSec = start;
        var thTime = (M.th[T] || 0) * (1 - CUT); // the time to reach Town Hall T+1
        doneSec = start + thTime;
        out.thDays = thTime / DAY;
      }
      out.workLeft = { upgrades: steps(jobsB), builderDays: sum(jobsB) / DAY, jobs: anyRushJobs };
    } else {
      heroJobs.forEach(function (hj) { hj.first = true; }); // heroes are long chains, so they start early
      var wantB = mode === 'max' || mode === 'heroes' || mode === 'defenses';
      var all = mode === 'max' ? jobsB.concat(heroJobs) : mode === 'heroes' ? heroJobs : mode === 'defenses' ? jobsB.filter(function (jb) { return jb.cat === 'defenses'; }) : [];
      builders = Math.max(builders, busyB.length + heroBusy.length); // (never more work at once than builders)
      out.builders = builders;
      var slotsM = slotsFrom(busyB.concat(heroBusy), builders);
      finishB = wantB ? run(all, slotsM) : 0;
      // lab: troops, spells and siege machines (one at a time, two while the second slot is in use)
      var labBusy = [], labSeen = {}, labJobs = [], extra = false;
      ['units', 'spells', 'siege_machines'].forEach(function (k) {
        (j[k] || []).forEach(function (u) {
          var e = u && M.l[u.data];
          if (!e) return;
          labSeen[u.data] = 1;
          if (u.extra) extra = true;
          var timer = num(u.timer), cap = capLevel(e, T), from = timer > 0 ? num(u.lvl) + 1 : num(u.lvl);
          if (timer > 0) labBusy.push(timer);
          if (from < cap) labJobs.push(makeJob('l', u.data, e, from, cap, timer > 0 ? timer : 0, false));
        });
      });
      Object.keys(M.l).forEach(function (id) {
        var e = M.l[id];
        if (labSeen[id] || e.r[0] > T) return;
        var cap = capLevel(e, T);
        if (cap > 1) labJobs.push(makeJob('l', +id, e, 1, cap, 0, false));
      });
      // only ONE lab slot is counted (the second one is not always there); anything already running just goes first
      var labSlots = [labBusy.reduce(function (a, b) { return a + b; }, 0)];
      var finishL = run(labJobs, labSlots);
      // pets
      var petBusy = [], petSeen = {}, petJobs = [];
      // (pets that are already being upgraded show up in the export, so the Pet House must exist)
      (j.pets || []).forEach(function (p) {
        var e = p && M.p[p.data];
        if (!e) return;
        petSeen[p.data] = 1;
        var timer = num(p.timer), cap = capLevel(e, T), from = timer > 0 ? num(p.lvl) + 1 : num(p.lvl);
        if (timer > 0) petBusy.push(timer);
        if (from < cap) petJobs.push(makeJob('p', p.data, e, from, cap, timer > 0 ? timer : 0, false));
      });
      Object.keys(M.p).forEach(function (id) {
        var e = M.p[id];
        if (petSeen[id] || e.r[0] > T) return;
        var cap = capLevel(e, T);
        if (cap > 1) petJobs.push(makeJob('p', +id, e, 1, cap, 0, false));
      });
      if (!petHouse) petJobs = []; // no Pet House yet: pets cannot be upgraded, so they are left out
      var finishP = run(petJobs, [petBusy.reduce(function (a, b) { return a + b; }, 0)]);
      out.petsLocked = !petHouse;
      var mx = function (a) { return a.length ? Math.max.apply(null, a) : 0; };
      out.heroes = heroRows.map(function (h) {
        var end = h.job && h.job.steps.length ? h.job.end : h.timer;
        return { name: h.name, days: end / DAY };
      }).filter(function (h) { return h.days > 0; }).sort(function (a, b) { return b.days - a.days; });
      if (mode === 'max') {
        doneSec = Math.max(finishB, finishL, finishP, mx(busyB.concat(heroBusy, labBusy, petBusy)));
        out.parts = { builder: finishB / DAY, lab: finishL / DAY, pets: finishP / DAY };
        out.bottleneck = finishL >= finishB && finishL >= finishP ? 'lab' : finishP > finishB ? 'pets' : 'builders';
      } else if (mode === 'heroes') doneSec = Math.max(finishB, mx(heroBusy));
      else if (mode === 'defenses') doneSec = Math.max(finishB, mx(busyDef));
      else if (mode === 'lab') doneSec = Math.max(finishL, mx(labBusy));
      else doneSec = Math.max(finishP, mx(petBusy));
      out.labSlots = 1;
      out.workLeft = {
        upgrades: steps(all), builderDays: sum(all) / DAY,
        labUpgrades: steps(labJobs), labDays: sum(labJobs) / DAY,
        petUpgrades: steps(petJobs), petDays: sum(petJobs) / DAY,
      };
    }
    out.doneSec = doneSec;
    out.days = doneSec / DAY;
    out.date = opts.exportedAt + doneSec * 1000;
    if (out.startSec != null) out.startDate = opts.exportedAt + out.startSec * 1000;
    return out;
  }

  root.CR_CALC = { estimate: estimate, petHouseBuilt: petHouseBuilt, _capLevel: capLevel, _run: run };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.CR_CALC;
})(typeof window !== 'undefined' ? window : globalThis);
