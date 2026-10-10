const $ = (id) => document.getElementById(id);

const form = $('search-form');
const input = $('clan-tag-input');
const statusEl = $('status');
const clanInfo = $('clan-info');
const clanBadge = $('clan-badge');
const clanName = $('clan-name');
const clanTagEl = $('clan-tag');
const clanMeta = $('clan-meta');
const openInGameBtn = $('open-in-game-btn');
const menuToggle = $('menu-toggle');
const sideDrawer = $('side-drawer');
const drawerOverlay = $('drawer-overlay');
const drawerTabs = document.querySelectorAll('.drawer-tab');

const tabsEl = $('tabs');
const tabButtons = Array.from(document.querySelectorAll('.tab'));
const panels = { month: $('panel-month'), last: $('panel-last'), war: $('panel-war'), guide: $('panel-guide') };

// How many leaderboard rows show before the "Show all" button. Change this
// one number to show more or fewer by default (set it very high to always
// show everyone).
const TOP_N = 10;

let currentClanTag = null;
let membersByTag = new Map(); // current clan members, used to add role/icon to last month's rows

// --- Hamburger menu / FAQ / About drawer ---
function openDrawer() {
  sideDrawer.classList.add('open');
  drawerOverlay.classList.add('open');
  menuToggle.setAttribute('aria-expanded', 'true');
  document.body.classList.add('menu-open');
}

function closeDrawer() {
  sideDrawer.classList.remove('open');
  drawerOverlay.classList.remove('open');
  menuToggle.setAttribute('aria-expanded', 'false');
  document.body.classList.remove('menu-open');
}

function showDrawerPanel(name) {
  for (const tab of drawerTabs) {
    tab.classList.toggle('active', tab.dataset.panel === name);
  }
  $('drawer-panel-faq').hidden = name !== 'faq';
  $('drawer-panel-about').hidden = name !== 'about';
}

menuToggle.addEventListener('click', () => {
  if (sideDrawer.classList.contains('open')) {
    closeDrawer();
  } else {
    openDrawer();
    // Default to FAQ the first time it's opened if nothing's selected yet.
    if (!document.querySelector('.drawer-tab.active')) showDrawerPanel('faq');
  }
});

drawerOverlay.addEventListener('click', closeDrawer);

for (const tab of drawerTabs) {
  tab.addEventListener('click', () => showDrawerPanel(tab.dataset.panel));
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeDrawer();
});

// Loaded automatically on page open so there's always something on screen
// without typing anything — the search bar stays empty, with this tag
// showing only as its placeholder (greyed-out example text).
const DEFAULT_CLAN_TAG = '#2RJPU9JY0';

// Where the API lives. When this page is served by the same server that
// exposes /api/... (local `npm start`), relative paths just work. When the
// frontend is hosted separately (GitHub Pages), it has to call the backend
// by its full URL instead — set that URL below once the backend is
// deployed (see DEPLOYMENT.md). Local dev is auto-detected, so this one
// line is the only thing that needs editing.
const BACKEND_URL =
  location.hostname === 'localhost' || location.hostname === '127.0.0.1'
    ? ''
    : 'https://147-224-36-247.sslip.io';

// ---------- Tabs: This Month / Last Month / War ----------
let activeTab = 'month';

// The gold pill behind the selected tab. First placement is instant; after
// that it slides + snaps (CSS does the spring, we just set x/width).
const pillEl = $('tab-pill');
let pillPlaced = false;
let pillTimer = null;

function positionPill(animate) {
  const sel = tabButtons.find((b) => b.getAttribute('aria-selected') === 'true' && !b.hidden);
  if (!pillEl || !sel || !sel.offsetWidth) return; // tabs not visible yet; the ResizeObserver retries
  const x = sel.offsetLeft;
  const w = sel.offsetWidth;
  const changed = pillEl.style.getPropertyValue('--pill-x') !== x + 'px' || pillEl.style.getPropertyValue('--pill-w') !== w + 'px';
  pillEl.style.setProperty('--pill-x', x + 'px');
  pillEl.style.setProperty('--pill-w', w + 'px');
  tabsEl.classList.add('has-pill');
  if (!pillPlaced) {
    pillPlaced = true;
    // enable the transition only after the first (instant) placement has painted
    requestAnimationFrame(() => requestAnimationFrame(() => tabsEl.classList.add('pill-ready')));
    return;
  }
  if (animate && changed && tabsEl.classList.contains('pill-ready')) {
    tabsEl.classList.remove('pill-moving');
    void tabsEl.offsetWidth; // restart the squish animation
    tabsEl.classList.add('pill-moving');
    clearTimeout(pillTimer);
    pillTimer = setTimeout(() => tabsEl.classList.remove('pill-moving'), 600);
  }
}

if (window.ResizeObserver) {
  const ro = new ResizeObserver(() => positionPill(false));
  ro.observe(tabsEl);
  for (const b of tabButtons) ro.observe(b);
} else {
  window.addEventListener('resize', () => positionPill(false));
}
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => positionPill(false));

const boardReplays = {}; // tab name -> function that replays that board's entrance

function activateTab(name, { updateHash = true } = {}) {
  const btn = tabButtons.find((b) => b.dataset.tab === name);
  if (!btn || btn.hidden) name = 'month'; // e.g. "#last" but there's no last-month data
  activeTab = name;
  for (const b of tabButtons) {
    const on = b.dataset.tab === name;
    b.setAttribute('aria-selected', on ? 'true' : 'false');
    b.tabIndex = on ? 0 : -1;
  }
  for (const [key, el] of Object.entries(panels)) el.hidden = key !== name;
  positionPill(true);
  if (boardReplays[name]) boardReplays[name]();
  syncSummary(); // the strip is this month's numbers, so it sits out the Last Month tab
  if (updateHash) {
    try {
      const hash = name === 'guide' && window.CR_GUIDE ? window.CR_GUIDE.hash() : `#${name}`;
      history.replaceState(null, '', name === 'month' ? location.pathname + location.search : hash);
    } catch (e) {
      /* file:// or sandboxed — the hash is just a convenience */
    }
  }
}

for (const b of tabButtons) {
  b.addEventListener('click', () => activateTab(b.dataset.tab));
  b.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const visible = tabButtons.filter((t) => !t.hidden);
    const i = visible.indexOf(b);
    const next = visible[(i + (e.key === 'ArrowRight' ? 1 : visible.length - 1)) % visible.length];
    next.focus();
    activateTab(next.dataset.tab);
  });
}

function hashTab() {
  const h = location.hash.replace('#', '').split('/')[0];
  return panels[h] ? h : 'month';
}

// ---------- Formatting helpers ----------
const ROLE_LABELS = { leader: 'Leader', coLeader: 'Co-Leader', admin: 'Elder', member: 'Member' };
const fmt = (n) => (Number(n) || 0).toLocaleString();

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : String(str);
  return div.innerHTML;
}

function safeIconUrl(url) {
  return typeof url === 'string' && /^https:\/\//i.test(url) ? url.replace(/"/g, '%22') : null;
}

// Clash's API sends times like "20261101T040000.000Z".
function parseCocTime(raw) {
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/.exec(raw || '');
  return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6])) : null;
}

function durationLabel(ms) {
  if (!(ms > 0)) return null;
  const mins = Math.floor(ms / 60000);
  const d = Math.floor(mins / 1440);
  const h = Math.floor((mins % 1440) / 60);
  const m = mins % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${Math.max(m, 1)}m`;
}

// ---------- Crowns (top 3) ----------
const CROWN_TIERS = { 1: 'gold', 2: 'silver', 3: 'bronze' };

function crownHtml(rank) {
  return `<span class="crown ${CROWN_TIERS[rank]}" role="img" aria-label="Rank ${rank}" title="Rank ${rank}">
    <svg viewBox="0 0 32 26" aria-hidden="true">
      <path d="M3 22 L1.6 7.5 L9.6 13.2 L16 3.2 L22.4 13.2 L30.4 7.5 L29 22 Z" />
      <rect x="3" y="22" width="26" height="3" rx="1.5" />
      <circle cx="1.8" cy="6.6" r="1.8" /><circle cx="16" cy="3" r="1.9" /><circle cx="30.2" cy="6.6" r="1.8" />
    </svg>
    <b>${rank}</b>
  </span>`;
}

// Small trophy shown next to last month's Champion.
function champHtml(label) {
  return `<svg class="champ" viewBox="0 0 24 24" role="img" aria-label="${escapeHtml(label)}"><title>${escapeHtml(label)}</title>
    <path d="M7 3h10v4a5 5 0 0 1-10 0V3Z" /><path d="M7 4H3.5v1.5A3.5 3.5 0 0 0 7 9M17 4h3.5v1.5A3.5 3.5 0 0 1 17 9" fill="none" stroke-width="1.6" />
    <rect x="10.5" y="12" width="3" height="4" /><rect x="7.5" y="17" width="9" height="3" rx="1" />
  </svg>`;
}

function memberCellHtml(row, reserveIcon) {
  const iconUrl = safeIconUrl(row.leagueIcon);
  const icon = iconUrl
    ? `<img class="league" src="${iconUrl}" alt="" width="26" height="26" loading="lazy" referrerpolicy="no-referrer" />`
    : reserveIcon
      ? '<span class="league league-empty"></span>'
      : '';
  const label = ROLE_LABELS[row.role];
  const roleHtml = label
    ? `<span class="sep" aria-hidden="true">|</span><span class="role role-${escapeHtml(row.role)}">${label}</span>`
    : '';
  const champ = row.champLabel ? champHtml(row.champLabel) : '';
  return `<td class="member"><div class="who">${icon}<span class="who-text"><span class="name-line"><span class="name">${escapeHtml(row.name)}</span>${champ}</span>${roleHtml}</span></div></td>`;
}

// ---------- Rank movement + sparkline ----------
function moveHtml(change) {
  if (change == null) return '';
  if (change > 0) return `<span class="move up" title="Up ${change} since the last saved day">▲${change}</span>`;
  if (change < 0) return `<span class="move down" title="Down ${-change} since the last saved day">▼${-change}</span>`;
  return '<span class="move same" title="Same place as the last saved day">–</span>';
}

// values: numbers or null (null = no entry that day). Draws a thin line.
function sparklineSvg(values, w, h, { area = false } = {}) {
  const pts = [];
  values.forEach((v, i) => {
    if (v != null) pts.push([i, v]);
  });
  if (pts.length < 2) return '';
  const n = values.length - 1 || 1;
  const min = Math.min(...pts.map((p) => p[1]));
  const max = Math.max(...pts.map((p) => p[1]));
  const span = max - min || 1;
  const pad = 3;
  const xy = pts.map(([i, v]) => [pad + (i / n) * (w - pad * 2), h - pad - ((v - min) / span) * (h - pad * 2)]);
  const d = xy.map(([x, y], k) => `${k ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const last = xy[xy.length - 1];
  const fill = area ? `<path class="spark-area" d="${d} L${last[0].toFixed(1)} ${h} L${xy[0][0].toFixed(1)} ${h} Z" />` : '';
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true" focusable="false">${fill}<path class="spark-line" d="${d}" /><circle cx="${last[0].toFixed(1)}" cy="${last[1].toFixed(1)}" r="2.2" /></svg>`;
}

// ---------- Player card (opens under a row) ----------
const HERO_SHORT = { 'Barbarian King': 'BK', 'Archer Queen': 'AQ', 'Grand Warden': 'GW', 'Royal Champion': 'RC', 'Minion Prince': 'MP', 'Dragon Duke': 'DD' };
// Known heroes use the table above; a brand-new multi-word hero falls back to its initials.
function heroShort(name) {
  if (HERO_SHORT[name]) return HERO_SHORT[name];
  const words = String(name || '').trim().split(/\s+/).filter(Boolean);
  return words.length > 1 ? words.map((w) => w[0].toUpperCase()).join('').slice(0, 3) : String(name || '');
}
const profileCache = new Map(); // tag -> profile | { error }

function starsHtml(n) {
  const k = Math.max(0, Math.min(3, Number(n) || 0));
  return `<span class="stars" aria-label="${k} stars">${'★'.repeat(k)}<i>${'★'.repeat(3 - k)}</i></span>`;
}

function thDeltaLabel(a) {
  if (a.defenderTownhall == null) return '';
  const d = a.thDelta;
  const rel = d == null ? '' : d > 0 ? ` (+${d})` : d < 0 ? ` (${d})` : ' (=)';
  return `TH${a.defenderTownhall}${rel}`;
}

function mrBreakdownHtml(b, mr) {
  if (!b) return '';
  const total = Math.max(1, (b.donations || 0) + (b.raids || 0) + (b.wars || 0));
  const seg = (cls, v) => (v > 0 ? `<i class="${cls}" style="width:${((v / total) * 100).toFixed(2)}%"></i>` : '');
  const item = (cls, label, v) => `<li><span class="dot ${cls}"></span>${label}<b>${fmt(v)}</b></li>`;
  return `<div class="mr-split" role="img" aria-label="MR split">${seg('s-don', b.donations)}${seg('s-raid', b.raids)}${seg('s-war', b.wars)}</div>
    <ul class="mr-legend">${item('s-don', 'Donations', b.donations)}${item('s-raid', 'Raids', b.raids)}${item('s-war', 'Wars', b.wars)}</ul>`;
}

function profileHtml(p) {
  if (!p) return '<p class="dc-note">Loading profile…</p>';
  if (p.error) return `<p class="dc-note error">${escapeHtml(p.error)}</p>`;
  const icon = safeIconUrl(p.leagueIcon);
  const heroes = (p.heroes || [])
    .map((h) => {
      const pct = h.maxLevel ? Math.round((h.level / h.maxLevel) * 100) : 0;
      const short = heroShort(h.name);
      return `<li title="${escapeHtml(h.name)} ${h.level}/${h.maxLevel}"><span>${escapeHtml(short)}</span><span class="hbar"><i style="width:${pct}%"></i></span><b>${h.level}</b></li>`;
    })
    .join('');
  const facts = [
    p.townHall ? ['Town Hall', p.townHall] : null,
    p.expLevel ? ['XP level', p.expLevel] : null,
    p.lifetimeWarStars != null ? ['War stars (all-time)', fmt(p.lifetimeWarStars)] : null,
    p.seasonDonated != null ? ['Donated this season', fmt(p.seasonDonated)] : null,
    p.seasonReceived != null ? ['Received this season', fmt(p.seasonReceived)] : null,
  ].filter(Boolean);
  return `<div class="dc-league">${icon ? `<img src="${icon}" alt="" width="40" height="40" loading="lazy" referrerpolicy="no-referrer" />` : ''}
      <div><b>${escapeHtml(p.leagueName || 'Unranked')}</b><span>${p.trophies != null ? `${fmt(p.trophies)} trophies` : ''}${p.bestTrophies != null ? ` · best ${fmt(p.bestTrophies)}` : ''}</span></div></div>
    <dl class="dc-facts">${facts.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>
    ${heroes ? `<ul class="dc-heroes">${heroes}</ul>` : ''}`;
}

function warAttacksHtml(list) {
  if (!list) return '';
  if (!list.length) return '<p class="dc-note">No recorded war attacks yet this month.</p>';
  const shown = list.slice(0, 6);
  return `<ul class="dc-attacks">${shown
    .map(
      (a) => `<li>${starsHtml(a.stars)}<span class="pct">${Math.round(a.destruction || 0)}%</span><span class="vs">${escapeHtml(a.opponent || 'war')}</span><span class="th">${escapeHtml(thDeltaLabel(a))}</span></li>`
    )
    .join('')}</ul>${list.length > shown.length ? `<p class="dc-note">+ ${list.length - shown.length} more this month</p>` : ''}`;
}

function detailInnerHtml(row, profile, rankBaselineLabel) {
  const move = row.rankChange;
  const moveText =
    move == null
      ? ''
      : move > 0
        ? `Up ${move} place${move === 1 ? '' : 's'} since ${rankBaselineLabel}`
        : move < 0
          ? `Down ${-move} place${move === -1 ? '' : 's'} since ${rankBaselineLabel}`
          : `Holding steady since ${rankBaselineLabel}`;
  const spark = sparklineSvg(row.trend || [], 240, 56, { area: true });
  return `<div class="dc-grid">
    <section class="dc-col">
      <h5>MR this month</h5>
      ${mrBreakdownHtml(row.breakdown, row.mr)}
      ${spark ? `<div class="dc-spark">${spark}<span class="dc-sub">MR day by day</span></div>` : ''}
      ${moveText ? `<p class="dc-move ${move > 0 ? 'up' : move < 0 ? 'down' : ''}">${moveText}</p>` : ''}
    </section>
    <section class="dc-col dp">${profileHtml(profile)}</section>
    <section class="dc-col">
      <h5>War attacks this month</h5>
      <div class="dw">${profile ? (profile.error ? '<p class="dc-note">Unavailable right now.</p>' : warAttacksHtml(profile.warAttacks)) : '<p class="dc-note">Loading…</p>'}</div>
    </section>
  </div>`;
}

const profileErrors = new Map(); // tag -> { error } from the last failed open (retried next open)

// Successful profiles are cached for the page's lifetime; failures never are.
async function loadProfile(tag) {
  if (profileCache.has(tag)) return profileCache.get(tag);
  try {
    const res = await fetch(`${BACKEND_URL}/api/player?tag=${encodeURIComponent(tag)}&clan=${encodeURIComponent(currentClanTag || '')}`);
    const data = await res.json();
    if (!res.ok) return { error: data.error || "Couldn't load this player." };
    profileCache.set(tag, data);
    return data;
  } catch (e) {
    return { error: "Couldn't reach the server." };
  }
}

const profileFor = (tag) => profileCache.get(tag) || profileErrors.get(tag) || null;

// Little stars that float up off the podium block. Pure CSS; positions and
// timings are fixed per slot so the cards never "re-roll" when redrawn.
const SPARK_SLOTS = [
  [12, 0, 3.4], [27, 1.3, 4.1], [41, 0.6, 3.7], [56, 2.1, 4.4], [70, 0.9, 3.5], [84, 1.8, 4.0], [93, 2.6, 3.8],
];
function sparksHtml(rank) {
  const slots = rank === 1 ? SPARK_SLOTS.filter((_, i) => i % 2 === 0 || i === 3) : SPARK_SLOTS.filter((_, i) => i === 1 || i === 4);
  return slots.map(([x, d, t]) => `<i style="--x:${x}%;--d:${d}s;--t:${t}s"></i>`).join('');
}

// ---------- Entrance animation + count-up ----------
const reduceMotion = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

function countUp(el, ms = 1100) {
  const target = Number(el.dataset.count) || 0;
  if (reduceMotion() || target < 10) {
    el.textContent = fmt(target);
    return;
  }
  const t0 = performance.now();
  const step = (now) => {
    const t = Math.min(1, (now - t0) / ms);
    const eased = 1 - Math.pow(1 - t, 3);
    el.textContent = fmt(Math.round(target * eased));
    if (t < 1) requestAnimationFrame(step);
  };
  el.textContent = '0';
  requestAnimationFrame(step);
}

// Restarts the CSS entrance on a board/podium by toggling a class, and counts
// the podium numbers up. Safe to call any time; does nothing visual when the
// user prefers reduced motion (the CSS also switches animations off).
function playEntrance(...els) {
  for (const el of els) {
    if (!el) continue;
    el.classList.remove('enter');
    void el.offsetWidth; // restart the animation
    el.classList.add('enter');
    clearTimeout(el._enterTimer);
    el._enterTimer = setTimeout(() => el.classList.remove('enter'), 2200);
    el.querySelectorAll('[data-count]').forEach((n) => countUp(n));
  }
}

// ---------- Leaderboard component (used by This Month and Last Month) ----------
// rows: [{ tag, rank, name, role, leagueIcon, mr, warStars, donated, raids,
//          rankChange, trend, breakdown, champLabel }]
// opts.trend  -> show rank arrows (the sparkline lives in the player card)
// opts.details -> rows open into a player card on click/Enter
function createLeaderboard(prefix, opts = {}) {
  const table = $(`${prefix}-table`);
  const body = $(`${prefix}-rows`);
  const moreBtn = $(`${prefix}-more`);
  const podiumEl = opts.podium ? $(`${prefix}-podium`) : null;
  const boardEl = table.closest('.board');
  let rows = [];
  let expanded = false;
  const open = new Set();
  let baselineLabel = 'the last check';

  // Columns actually showing (some columns hide on phones). A colspan
  // bigger than that would add a phantom column and squash the member names.
  const colCount = () => Array.from(table.querySelectorAll('thead th')).filter((th) => th.offsetParent !== null).length || 1;

  function draw() {
    const maxMr = Math.max(1, ...rows.map((r) => r.mr || 0));
    const reserveIcon = rows.some((r) => safeIconUrl(r.leagueIcon));
    const start = hasPodium() ? 3 : 0; // the top three live on the podium
    const visible = expanded ? rows.slice(start) : rows.slice(start, Math.max(start, TOP_N));

    body.innerHTML = visible
      .map((r, idx) => {
        const pct = Math.max(3, Math.round(((r.mr || 0) / maxMr) * 100));
        const move = opts.trend ? moveHtml(r.rankChange) : '';
        const rankCell = r.rank <= 3 ? `${crownHtml(r.rank)}${move}` : `<span class="rank-num">${r.rank}</span>${move}`;
        const isOpen = opts.details && open.has(r.tag);
        const attrs = opts.details ? ` data-tag="${escapeHtml(r.tag)}" tabindex="0" aria-expanded="${isOpen}"` : '';
        const main = `<tr class="${r.rank <= 3 ? `rank-${r.rank}` : ''}${opts.details ? ' expandable' : ''}${isOpen ? ' is-open' : ''}" style="--i:${idx}"${attrs}>
          <td class="rank">${rankCell}</td>
          ${memberCellHtml(r, reserveIcon)}
          <td class="num mr"><span class="mr-val">${fmt(r.mr)}</span><span class="mr-bar"><i style="width:${pct}%"></i></span></td>
          <td class="num">${fmt(r.warStars)}</td>
          <td class="num">${fmt(r.donated)}</td>
          <td class="num">${fmt(r.raids)}</td>
        </tr>`;
        if (!isOpen) return main;
        return `${main}<tr class="detail" data-for="${escapeHtml(r.tag)}"><td colspan="${colCount()}"><div class="detail-card">${detailInnerHtml(r, profileFor(r.tag), baselineLabel)}</div></td></tr>`;
      })
      .join('');

    const hasMore = rows.length > TOP_N;
    moreBtn.hidden = !hasMore;
    moreBtn.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    moreBtn.textContent = expanded ? `Show top ${TOP_N}` : `Show all ${rows.length}`;
    table.hidden = visible.length === 0;
    if (boardEl) boardEl.hidden = visible.length === 0;
  }

  // ---- Podium: the top three as big cards (2nd | 1st | 3rd) ----
  const hasPodium = () => !!podiumEl && rows.length >= 3;

  function podHtml(r) {
    const iconUrl = safeIconUrl(r.leagueIcon);
    const icon = iconUrl ? `<img class="league" src="${iconUrl}" alt="" width="28" height="28" referrerpolicy="no-referrer" />` : '';
    const label = ROLE_LABELS[r.role] || '';
    const isOpen = opts.details && open.has(r.tag);
    const el = opts.details ? 'button' : 'div';
    const attrs = opts.details ? ` type="button" data-tag="${escapeHtml(r.tag)}" aria-expanded="${isOpen}"` : '';
    return `<${el} class="pod pod-${r.rank}${isOpen ? ' is-open' : ''}"${attrs}>
      <span class="pod-glow" aria-hidden="true"></span>
      ${r.rank === 1 ? '<span class="pod-ring" aria-hidden="true"><i></i></span>' : ''}
      <span class="pod-crown">${crownHtml(r.rank)}</span>
      <span class="pod-who">${icon}<span class="pod-name">${escapeHtml(r.name)}</span>${r.champLabel ? champHtml(r.champLabel) : ''}</span>
      <span class="pod-role">${escapeHtml(label)}</span>
      <span class="pod-mr"><b data-count="${Number(r.mr) || 0}">${fmt(r.mr)}</b><i>MR</i></span>
      ${opts.trend ? `<span class="pod-move">${moveHtml(r.rankChange)}</span>` : ''}
      <span class="pod-stats"><span><b>${fmt(r.warStars)}</b>stars</span><span><b>${fmt(r.donated)}</b>donated</span><span><b>${fmt(r.raids)}</b>raids</span></span>
      <span class="pod-sparks" aria-hidden="true">${sparksHtml(r.rank)}</span>
      <span class="pod-base" aria-hidden="true"></span>
    </${el}>`;
  }

  function podiumDetailHtml() {
    return rows
      .slice(0, 3)
      .filter((r) => opts.details && open.has(r.tag))
      .map(
        (r) => `<div class="pod-detail" data-for="${escapeHtml(r.tag)}">
          <div class="pod-detail-head"><span>${escapeHtml(r.name)}</span><button type="button" class="pod-close" data-close="${escapeHtml(r.tag)}" aria-label="Close player card">×</button></div>
          <div class="detail-card">${detailInnerHtml(r, profileFor(r.tag), baselineLabel)}</div>
        </div>`
      )
      .join('');
  }

  // Cards are only rebuilt when the rows change, so their entrance animation
  // doesn't replay every time a player card is opened.
  function drawPodium() {
    if (!podiumEl) return;
    if (!hasPodium()) {
      podiumEl.hidden = true;
      podiumEl.innerHTML = '';
      return;
    }
    const [a, b, c] = rows;
    podiumEl.innerHTML = `<div class="podium">${podHtml(b)}${podHtml(a)}${podHtml(c)}</div><div class="pod-detail-slot">${podiumDetailHtml()}</div>`;
    podiumEl.hidden = false;
  }

  function drawPodiumDetail() {
    const slot = podiumEl && podiumEl.querySelector('.pod-detail-slot');
    if (slot) slot.innerHTML = podiumDetailHtml();
    for (const pod of podiumEl ? podiumEl.querySelectorAll('.pod[data-tag]') : []) {
      const on = open.has(pod.dataset.tag);
      pod.classList.toggle('is-open', on);
      pod.setAttribute('aria-expanded', on ? 'true' : 'false');
    }
  }

  function refreshDetail(tag) {
    const row = rows.find((r) => r.tag === tag);
    const holder = body.querySelector(`tr.detail[data-for="${CSS.escape(tag)}"] .detail-card`);
    if (row && holder) holder.innerHTML = detailInnerHtml(row, profileFor(tag), baselineLabel);
    const pod = podiumEl && podiumEl.querySelector(`.pod-detail[data-for="${CSS.escape(tag)}"] .detail-card`);
    if (row && pod) pod.innerHTML = detailInnerHtml(row, profileFor(tag), baselineLabel);
  }

  async function toggle(tag) {
    // One player card open at a time, across the podium and the table.
    const wasOpen = open.has(tag);
    open.clear();
    if (!wasOpen) open.add(tag);
    if (boardEl) boardEl.classList.remove('enter'); // don't replay the row entrance
    draw();
    drawPodiumDetail();
    const tr = body.querySelector(`tr[data-tag="${CSS.escape(tag)}"]`) || (podiumEl && podiumEl.querySelector(`.pod[data-tag="${CSS.escape(tag)}"]`));
    if (tr) tr.focus({ preventScroll: true });
    if (open.has(tag) && !profileCache.has(tag)) {
      profileErrors.delete(tag);
      const result = await loadProfile(tag);
      if (result.error) profileErrors.set(tag, result);
      refreshDetail(tag);
    }
  }

  if (opts.details) {
    body.addEventListener('click', (e) => {
      const tr = e.target.closest('tr.expandable');
      if (tr) toggle(tr.dataset.tag);
    });
    body.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const tr = e.target.closest('tr.expandable');
      if (!tr || e.target !== tr) return;
      e.preventDefault();
      toggle(tr.dataset.tag);
    });
  }

  if (podiumEl && opts.details) {
    podiumEl.addEventListener('click', (e) => {
      const close = e.target.closest('[data-close]');
      if (close) {
        toggle(close.dataset.close);
        return;
      }
      const pod = e.target.closest('.pod[data-tag]');
      if (pod) toggle(pod.dataset.tag);
    });
  }

  moreBtn.addEventListener('click', () => {
    expanded = !expanded;
    draw();
  });

  // Crossing the phone/desktop breakpoint changes which columns show.
  if (opts.details && window.matchMedia) {
    window.matchMedia('(max-width: 640px)').addEventListener('change', () => {
      if (rows.length) draw();
    });
  }

  return {
    show(newRows, extra = {}) {
      rows = newRows;
      expanded = false;
      open.clear();
      baselineLabel = extra.baselineLabel || 'the last check';
      draw();
      drawPodium();
      this.replay();
    },
    // Re-run the entrance animation (rows slide in, numbers count up).
    replay() {
      playEntrance(boardEl, podiumEl);
    },
    rows: () => rows,
    clear() {
      rows = [];
      expanded = false;
      open.clear();
      body.innerHTML = '';
      table.hidden = true;
      moreBtn.hidden = true;
      if (podiumEl) {
        podiumEl.hidden = true;
        podiumEl.innerHTML = '';
      }
    },
  };
}

const monthBoard = createLeaderboard('member', { trend: true, details: true, podium: true });
const lastBoard = createLeaderboard('last', { podium: true });
boardReplays.month = () => monthBoard.replay();
boardReplays.last = () => lastBoard.replay();

// ---------- Search ----------
form.addEventListener('submit', (e) => {
  e.preventDefault();
  const tag = input.value.trim();
  if (!tag) return;
  searchClan(tag);
});

function setStatus(message, isError) {
  statusEl.textContent = message;
  statusEl.classList.toggle('error', isError);
}

async function searchClan(tag) {
  setStatus('Searching...', false);
  clanInfo.hidden = true;
  tabsEl.hidden = true;
  for (const el of Object.values(panels)) el.hidden = true;
  monthBoard.clear();
  lastBoard.clear();
  summaryHasData = false;
  summaryEl.hidden = true;
  $('month-awards').hidden = true;
  shareData.month = shareData.last = null;
  $('tab-last').hidden = true;
  $('war-live-dot').hidden = true;
  $('history-card').hidden = true;

  try {
    const res = await fetch(`${BACKEND_URL}/api/clan?tag=${encodeURIComponent(tag)}`);
    const data = await res.json();

    if (!res.ok) {
      setStatus(data.error || 'Something went wrong.', true);
      return;
    }

    currentClanTag = data.tag;
    renderClan(data);
    setStatus('', false); // the clan card already says how many members — no need to repeat it
    tabsEl.hidden = false;
    activateTab(hashTab(), { updateHash: false });
    fetchCurrentWar(data.tag);
    fetchWarHistory(data.tag);
    fetchPreviousMonth(data.tag);
  } catch (err) {
    setStatus('Could not reach the server. Is it running?', true);
  }
}


function renderClan(data) {
  clanName.textContent = data.name;
  clanTagEl.textContent = data.tag;
  let meta = `Level ${data.level} · ${data.memberCount} members`;
  if (data.raidWeekend) {
    const label = data.raidWeekend.state === 'ongoing' ? 'ongoing' : `ended ${data.raidWeekend.endLabel}`;
    meta += ` · Raid Weekend: ${label}`;
  }
  clanMeta.textContent = meta;
  if (data.badgeUrl) {
    clanBadge.src = data.badgeUrl;
    clanBadge.alt = `${data.name} badge`;
  }
  clanInfo.hidden = false;

  $('month-title').textContent = data.monthLabel || '';

  const rawTag = (data.tag || '').replace('#', '');
  if (rawTag) {
    openInGameBtn.href = `https://link.clashofclans.com/en?action=OpenClanProfile&tag=${encodeURIComponent(rawTag)}`;
    openInGameBtn.hidden = false;
  } else {
    openInGameBtn.hidden = true;
  }

  membersByTag = new Map(data.members.map((m) => [m.tag, m]));

  const champTag = data.lastChampion ? data.lastChampion.tag : null;
  const champLabel = data.lastChampion ? `Champion of ${data.lastChampion.monthLabel}` : '';
  const baselineLabel = shortDateLabel(data.rankBaseline);

  monthBoard.show(
    data.members.map((m) => ({
      tag: m.tag,
      rank: m.mrRank,
      name: m.name,
      role: m.role,
      leagueIcon: m.leagueIcon,
      mr: m.mr,
      warStars: m.monthWarStars,
      donated: m.donations,
      raids: m.raidAttacks,
      rankChange: m.rankChange,
      trend: m.trend,
      breakdown: m.breakdown,
      champLabel: champTag && m.tag === champTag ? champLabel : '',
    })),
    { baselineLabel }
  );

  renderSummary(data.summary);
  renderMonthAwards(data.awards);
  shareData.month = { monthLabel: data.monthLabel, clanName: data.name, rows: monthBoard.rows() };
}

// "Oct 6" for a "2026-10-06" date key.
function shortDateLabel(key) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key || '');
  if (!m) return 'the last check';
  return new Date(+m[1], +m[2] - 1, +m[3]).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// ---------- Clan summary strip ----------
const summaryEl = $('summary');
let summaryHasData = false;

function syncSummary() {
  summaryEl.hidden = !summaryHasData || activeTab === 'last' || activeTab === 'guide';
}

function renderSummary(sum) {
  summaryHasData = !!sum;
  if (!sum) {
    syncSummary();
    return;
  }
  const w = sum.wars || {};
  const record = w.total ? `${w.won || 0}–${w.lost || 0}${w.tied ? `–${w.tied}` : ''}` : '–';
  // Same left-to-right order as the leaderboard columns (MR, War Stars,
  // Donated, Raid Attacks) so each tile sits over the column it summarises;
  // the war record sits on the left over the member names.
  const tiles = [
    ['Wars W–L', record, null],
    ['Avg MR', fmt(sum.avgMr), sum.avgMr],
    ['War stars', fmt(sum.warStars), sum.warStars],
    ['Donated', fmt(sum.totalDonations), sum.totalDonations],
    ['Raid attacks', fmt(sum.raidAttacks), sum.raidAttacks],
  ];
  summaryEl.innerHTML = tiles
    .map(([label, value, n], i) => `<div class="stat" style="--i:${i}"><b${n == null ? '' : ` data-count="${Number(n) || 0}"`}>${escapeHtml(value)}</b><span>${escapeHtml(label)}</span></div>`)
    .join('');
  summaryEl.querySelectorAll('[data-count]').forEach((n) => countUp(n));
  syncSummary();
}

// ---------- Awards ----------
const AWARD_ICONS = {
  champion: '<path d="M7 3h10v4a5 5 0 0 1-10 0V3Z"/><path d="M7 4H3.5v1.5A3.5 3.5 0 0 0 7 9M17 4h3.5v1.5A3.5 3.5 0 0 1 17 9" fill="none" stroke-width="1.6"/><rect x="10.5" y="12" width="3" height="4"/><rect x="7.5" y="17" width="9" height="3" rx="1"/>',
  donor: '<path d="M12 20.5s-7.5-4.6-7.5-10A4.2 4.2 0 0 1 12 8a4.2 4.2 0 0 1 7.5 2.5c0 5.4-7.5 10-7.5 10Z"/>',
  stars: '<path d="m12 2.8 2.7 5.6 6.1.8-4.5 4.3 1.1 6.1L12 16.6 6.6 19.6l1.1-6.1L3.2 9.2l6.1-.8L12 2.8Z"/>',
  raider: '<path d="M4 21V4h2v2h12l-2.5 4L18 14H6v7H4Z"/>',
  challenger: '<path d="M4 4l11 11M20 4 9 15" stroke-width="2.2" stroke-linecap="round" fill="none"/><path d="M13 17l4-4M7 13l4 4" stroke-width="2.2" stroke-linecap="round" fill="none"/><path d="M16 16l3 3M8 16l-3 3" stroke-width="2.2" stroke-linecap="round" fill="none"/><circle cx="20" cy="20" r="1.4"/><circle cx="4" cy="20" r="1.4"/>',
  sharpshooter: '<circle cx="12" cy="12" r="8.5" fill="none" stroke-width="1.8"/><circle cx="12" cy="12" r="4.6" fill="none" stroke-width="1.8"/><circle cx="12" cy="12" r="1.6"/>',
};

// Tint (r,g,b) for each award card.
const AWARD_TINTS = {
  champion: '242,193,78',
  donor: '255,138,168',
  stars: '255,150,48',
  raider: '176,140,255',
  sharpshooter: '111,216,238',
  challenger: '255,82,110',
};

// Every award always gets a card; when nobody has earned it the card is
// greyed out with the requirement, so the set never changes shape.
const AWARD_SLOTS = [
  { key: 'champion', title: 'Champion', hint: 'Needs a Mastery Rating above 0' },
  { key: 'donor', title: 'Top Donor', hint: 'Needs at least 1 troop donated' },
  { key: 'stars', title: 'Star Collector', hint: 'Needs at least 1 war star' },
  { key: 'raider', title: 'Raid Master', hint: 'Needs at least 1 raid attack' },
  { key: 'sharpshooter', title: 'Sharpshooter', hint: 'Needs 2+ war attacks' },
  { key: 'challenger', title: 'Challenger', hint: 'Needs 3+ attacks on higher town halls, over half of their war attacks', rare: true },
];

function awardsHtml(awards, { when = 'month' } = {}) {
  const byKey = new Map((awards || []).map((a) => [a.key, a]));
  const list = AWARD_SLOTS.map((slot) => byKey.get(slot.key) || { key: slot.key, title: slot.title, empty: true, hint: slot.hint });
  for (const a of awards || []) if (!AWARD_SLOTS.some((s) => s.key === a.key)) list.push(a); // future awards still show
  return list
    .map((a, i) => {
      if (a.empty) {
        const text = when === 'last' ? 'No one earned this' : 'No one has earned this yet';
        return `<div class="award award-${escapeHtml(a.key)} award-empty" style="--i:${i}">
        <span class="award-medal"><svg viewBox="0 0 24 24" aria-hidden="true">${AWARD_ICONS[a.key] || ''}</svg></span>
        <span class="award-body">
          <span class="award-title">${escapeHtml(a.title)}</span>
          <span class="award-name">${text}</span>
          <span class="award-sub">${escapeHtml(a.hint)}</span>
        </span>
      </div>`;
      }
      const rare = a.rare ? ' award-rare' : '';
      const sub = a.rare && a.of ? `<span class="award-sub">That's ${fmt(a.value)} of their ${fmt(a.of)} war attacks</span>` : '';
      return `<div class="award award-${escapeHtml(a.key)}${rare}" style="--ac:${AWARD_TINTS[a.key] || '242,193,78'};--i:${i}">
        <span class="award-medal"><svg viewBox="0 0 24 24" aria-hidden="true">${AWARD_ICONS[a.key] || ''}</svg></span>
        <span class="award-body">
          <span class="award-title">${escapeHtml(a.title)}${a.rare ? '<em class="rare-tag">Rare</em>' : ''}</span>
          <span class="award-name">${escapeHtml(a.name)}</span>
          <span class="award-value"><b>${fmt(a.value)}</b> ${escapeHtml(a.unit)}</span>
          ${sub}
        </span>
      </div>`;
    })
    .join('');
}

function renderMonthAwards(awards) {
  const card = $('month-awards');
  $('month-awards-body').innerHTML = awardsHtml(awards, { when: 'month' });
  card.hidden = false;
}

// ---------- Share as picture ----------
// Draws the top 5 onto a canvas and either opens the phone's share sheet or
// downloads a PNG. Uses only text and shapes (no game artwork).
const shareData = { month: null, last: null };

const METALS = {
  1: { a: '#fff0b0', b: '#f2c14e', c: '#c8902a', text: '#ffe9a6', wash: 'rgba(242,193,78,0.20)' },
  2: { a: '#ffffff', b: '#cfd5e3', c: '#8f98ad', text: '#eef1f8', wash: 'rgba(207,213,227,0.16)' },
  3: { a: '#f6c79d', b: '#d9935a', c: '#a8622f', text: '#f7d6b8', wash: 'rgba(217,147,90,0.17)' },
};

function fitText(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(t + '…').width > maxWidth) t = t.slice(0, -1);
  return t + '…';
}

function drawCrown(ctx, x, y, size, metal) {
  const s = size / 32;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  const g = ctx.createLinearGradient(0, 0, 0, 26);
  g.addColorStop(0, metal.a);
  g.addColorStop(0.55, metal.b);
  g.addColorStop(1, metal.c);
  ctx.fillStyle = g;
  ctx.strokeStyle = 'rgba(40,24,0,0.55)';
  ctx.lineWidth = 1;
  ctx.fill(new Path2D('M3 22 L1.6 7.5 L9.6 13.2 L16 3.2 L22.4 13.2 L30.4 7.5 L29 22 Z'));
  ctx.stroke(new Path2D('M3 22 L1.6 7.5 L9.6 13.2 L16 3.2 L22.4 13.2 L30.4 7.5 L29 22 Z'));
  ctx.beginPath();
  ctx.roundRect(3, 22, 26, 3, 1.5);
  ctx.fill();
  for (const [cx, cy, r] of [[1.8, 6.6, 1.8], [16, 3, 1.9], [30.2, 6.6, 1.8]]) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// Seeded random so the same leaderboard always makes the same picture.
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A crown with its place number on it.
function drawRankCrown(ctx, x, y, size, rank, font) {
  const metal = METALS[rank];
  drawCrown(ctx, x, y, size, metal);
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.font = `${Math.round(size * 0.45)}px ${font}`;
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(4, size * 0.092);
  ctx.strokeStyle = rank === 1 ? '#8a5f12' : rank === 2 ? '#5f6880' : '#7d4519';
  ctx.strokeText(String(rank), x + size / 2, y + size * 0.59);
  ctx.fillStyle = rank === 2 ? '#ffffff' : rank === 1 ? '#fff8de' : '#fff0df';
  ctx.fillText(String(rank), x + size / 2, y + size * 0.59);
  ctx.restore();
}

function drawStar4(ctx, x, y, r, color, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = r * 1.4;
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const ang = (Math.PI / 4) * i - Math.PI / 2;
    const rad = i % 2 === 0 ? r : r * 0.28;
    ctx.lineTo(x + Math.cos(ang) * rad, y + Math.sin(ang) * rad);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawListRow(ctx, r, y, W, rowH, font) {
  const x0 = 60;
  const w = W - 120;
  ctx.beginPath();
  ctx.roundRect(x0, y + 6, w, rowH - 14, 22);
  ctx.fillStyle = '#0e1017';
  ctx.fill();
  ctx.strokeStyle = '#272a38';
  ctx.lineWidth = 2;
  ctx.stroke();
  const cy = y + rowH / 2 - 1;
  ctx.textAlign = 'center';
  ctx.font = `46px ${font}`;
  ctx.fillStyle = '#9298ad';
  ctx.fillText(String(r.rank), x0 + 64, cy + 16);
  ctx.textAlign = 'left';
  ctx.font = `50px ${font}`;
  ctx.fillStyle = '#f4f1ea';
  ctx.fillText(fitText(ctx, r.name || '', 560), x0 + 140, cy - (r.role ? 2 : -14));
  const roleLabel = ROLE_LABELS[r.role];
  if (roleLabel) {
    ctx.font = `30px ${font}`;
    ctx.fillStyle = '#a3adcf';
    ctx.fillText(roleLabel, x0 + 142, cy + 38);
  }
  ctx.textAlign = 'right';
  ctx.font = `58px ${font}`;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(fmt(r.mr), x0 + w - 36, cy + 14);
  ctx.font = `26px ${font}`;
  ctx.fillStyle = '#9298ad';
  ctx.fillText('MR', x0 + w - 36, cy + 48);
}

// One podium place: metal-washed card, crown, name, big MR, three small stats,
// and the lit block it stands on.
function drawPodiumCard(ctx, r, rank, x, baseY, w, font) {
  const metal = METALS[rank];
  const dims = {
    1: { h: 560, bh: 64, crown: 130, name: 58, mr: 112 },
    2: { h: 490, bh: 46, crown: 100, name: 46, mr: 84 },
    3: { h: 460, bh: 34, crown: 90, name: 46, mr: 84 },
  }[rank];
  const top = baseY - dims.h;
  const cx = x + w / 2;
  const rgb = rank === 1 ? '242,193,78' : rank === 2 ? '207,213,227' : '217,147,90';

  // floor glow
  const floor = ctx.createRadialGradient(cx, baseY + 6, 4, cx, baseY + 6, w * 0.62);
  floor.addColorStop(0, `rgba(${rgb},0.55)`);
  floor.addColorStop(1, `rgba(${rgb},0)`);
  ctx.save();
  ctx.translate(0, 0);
  ctx.scale(1, 0.22);
  ctx.fillStyle = floor;
  ctx.beginPath();
  ctx.arc(cx, (baseY + 6) / 0.22, w * 0.62, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // card
  ctx.beginPath();
  ctx.roundRect(x, top, w, dims.h, [28, 28, 6, 6]);
  ctx.fillStyle = '#0e1017';
  ctx.fill();
  const wash = ctx.createLinearGradient(0, top, 0, baseY);
  wash.addColorStop(0, `rgba(${rgb},0.30)`);
  wash.addColorStop(0.65, `rgba(${rgb},0.06)`);
  wash.addColorStop(1, `rgba(${rgb},0.02)`);
  ctx.fillStyle = wash;
  ctx.fill();
  ctx.save();
  ctx.clip();
  const spot = ctx.createRadialGradient(cx, top, 10, cx, top, w * 0.9);
  spot.addColorStop(0, `rgba(${rgb},0.38)`);
  spot.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = spot;
  ctx.fillRect(x, top, w, dims.h);
  ctx.restore();
  ctx.beginPath();
  ctx.roundRect(x, top, w, dims.h, [28, 28, 6, 6]);
  ctx.strokeStyle = metal.b;
  ctx.lineWidth = rank === 1 ? 4 : 3;
  ctx.globalAlpha = rank === 1 ? 0.95 : 0.6;
  ctx.stroke();
  ctx.globalAlpha = 1;

  // crown
  if (rank === 1) {
    ctx.save();
    ctx.shadowColor = 'rgba(242,193,78,0.8)';
    ctx.shadowBlur = 40;
    drawRankCrown(ctx, cx - dims.crown / 2, top + 30, dims.crown, rank, font);
    ctx.restore();
  } else {
    drawRankCrown(ctx, cx - dims.crown / 2, top + 30, dims.crown, rank, font);
  }
  const crownH = dims.crown * (26 / 32);

  // name + role
  ctx.textAlign = 'center';
  ctx.fillStyle = metal.text;
  ctx.font = `${dims.name}px ${font}`;
  let y = top + 30 + crownH + dims.name + 8;
  ctx.fillText(fitText(ctx, r.name || '', w - 36), cx, y);
  const roleLabel = ROLE_LABELS[r.role];
  y += 38;
  if (roleLabel) {
    ctx.font = `28px ${font}`;
    ctx.fillStyle = '#a3adcf';
    ctx.fillText(roleLabel, cx, y);
  }

  // MR
  y += dims.mr * 0.95;
  ctx.save();
  ctx.shadowColor = `rgba(${rgb},0.6)`;
  ctx.shadowBlur = 26;
  ctx.font = `${dims.mr}px ${font}`;
  ctx.fillStyle = metal.text;
  ctx.fillText(fmt(r.mr), cx, y);
  ctx.restore();
  ctx.font = `30px ${font}`;
  ctx.fillStyle = `rgba(${rgb},0.9)`;
  ctx.fillText('MR', cx, y + 40);

  // small stats
  const sy = baseY - dims.bh - 56;
  ctx.strokeStyle = `rgba(${rgb},0.25)`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x + 28, sy - 44);
  ctx.lineTo(x + w - 28, sy - 44);
  ctx.stroke();
  const stats = [[r.warStars, 'stars'], [r.donated, 'donated'], [r.raids, 'raids']];
  stats.forEach(([v, label], i) => {
    const sx = x + (w / 3) * (i + 0.5);
    ctx.font = `${rank === 1 ? 38 : 32}px ${font}`;
    ctx.fillStyle = '#f4f1ea';
    ctx.fillText(fmt(v), sx, sy);
    ctx.font = `20px ${font}`;
    ctx.fillStyle = '#9298ad';
    ctx.fillText(label.toUpperCase(), sx, sy + 26);
  });

  // lit block
  const bg = ctx.createLinearGradient(0, baseY - dims.bh, 0, baseY);
  bg.addColorStop(0, `rgba(${rgb},0.65)`);
  bg.addColorStop(1, `rgba(${rgb},0.2)`);
  ctx.beginPath();
  ctx.roundRect(x, baseY - dims.bh, w, dims.bh, [0, 0, 6, 6]);
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.strokeStyle = metal.b;
  ctx.globalAlpha = 0.7;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.fillRect(x + 2, baseY - dims.bh, w - 4, 2);
  // diagonal glint across the block
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, baseY - dims.bh, w, dims.bh, [0, 0, 6, 6]);
  ctx.clip();
  const glint = ctx.createLinearGradient(x + w * 0.2, 0, x + w * 0.5, 0);
  glint.addColorStop(0, 'rgba(255,255,255,0)');
  glint.addColorStop(0.5, 'rgba(255,255,255,0.22)');
  glint.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = glint;
  ctx.fillRect(x, baseY - dims.bh, w, dims.bh);
  ctx.restore();
}

async function buildShareCanvas(info) {
  try {
    await Promise.all([document.fonts.load('64px "Titan One"'), document.fonts.load('40px "Lilita One"')]);
  } catch (e) {
    /* fall back to system fonts */
  }
  const W = 1080;
  const rows = info.rows.slice(0, 5);
  const podium = rows.length >= 3;
  const top = 380;
  const baseY = top + 560;
  const listTop = baseY + 56;
  const rowH = 130;
  const lower = podium ? rows.slice(3) : rows;
  const H = (podium ? listTop : top) + lower.length * rowH + 190;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const display = '"Lilita One", "Titan One", "Segoe UI", sans-serif';

  // Night + forge glow at the top, firelight along the bottom
  ctx.fillStyle = '#06070c';
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W / 2, 0, 20, W / 2, 0, 620);
  glow.addColorStop(0, 'rgba(255,176,62,0.42)');
  glow.addColorStop(0.5, 'rgba(255,104,36,0.2)');
  glow.addColorStop(1, 'rgba(255,104,36,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, 700);
  const fire = ctx.createRadialGradient(W / 2, H + 60, 20, W / 2, H + 60, 720);
  fire.addColorStop(0, 'rgba(242,193,78,0.22)');
  fire.addColorStop(1, 'rgba(242,193,78,0)');
  ctx.fillStyle = fire;
  ctx.fillRect(0, H - 720, W, 720);
  // stage light on the podium
  if (podium) {
    const beam = ctx.createRadialGradient(W / 2, top - 40, 10, W / 2, top - 40, 560);
    beam.addColorStop(0, 'rgba(255,226,150,0.22)');
    beam.addColorStop(1, 'rgba(255,226,150,0)');
    ctx.fillStyle = beam;
    ctx.fillRect(0, 0, W, H);
  }

  // Embers
  const rnd = mulberry32(2026);
  const emberColors = ['255,196,84', '255,150,48', '255,226,160', '255,120,60'];
  for (let i = 0; i < 90; i++) {
    const ex = rnd() * W;
    const ey = rnd() * H;
    const er = 1.5 + rnd() * 4;
    const c = emberColors[Math.floor(rnd() * emberColors.length)];
    const g = ctx.createRadialGradient(ex, ey, 0, ex, ey, er * 3.4);
    g.addColorStop(0, `rgba(${c},${(0.35 + rnd() * 0.5).toFixed(2)})`);
    g.addColorStop(1, `rgba(${c},0)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(ex, ey, er * 3.4, 0, Math.PI * 2);
    ctx.fill();
  }

  // Title
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.font = '120px "Titan One", "Lilita One", sans-serif';
  const tg = ctx.createLinearGradient(0, 90, 0, 210);
  tg.addColorStop(0, '#fff4c4');
  tg.addColorStop(0.5, '#ffcf4a');
  tg.addColorStop(1, '#ff9a1c');
  ctx.lineJoin = 'round';
  ctx.lineWidth = 14;
  ctx.strokeStyle = '#5a2f00';
  ctx.save();
  ctx.shadowColor = 'rgba(255,150,28,0.55)';
  ctx.shadowBlur = 36;
  ctx.strokeText('Clash Ratings', W / 2, 200);
  ctx.restore();
  ctx.strokeText('Clash Ratings', W / 2, 200);
  ctx.fillStyle = tg;
  ctx.fillText('Clash Ratings', W / 2, 200);

  ctx.font = `46px ${display}`;
  ctx.fillStyle = '#f3ecd8';
  ctx.fillText(fitText(ctx, info.clanName || '', W - 160), W / 2, 275);
  // month with little gold rules either side
  ctx.font = `36px ${display}`;
  ctx.fillStyle = '#ffe9a6';
  const label = info.monthLabel || '';
  ctx.fillText(label, W / 2, 330);
  const lw = ctx.measureText(label).width / 2;
  for (const dir of [-1, 1]) {
    const lg = ctx.createLinearGradient(W / 2 + dir * (lw + 24), 0, W / 2 + dir * (lw + 24 + 150), 0);
    lg.addColorStop(0, 'rgba(242,193,78,0.8)');
    lg.addColorStop(1, 'rgba(242,193,78,0)');
    ctx.fillStyle = lg;
    ctx.fillRect(Math.min(W / 2 + dir * (lw + 24), W / 2 + dir * (lw + 174)), 318, 150, 2);
  }

  if (podium) {
    const gap = 16;
    const sw = 290;
    const cw = 340;
    const startX = (W - (sw * 2 + cw + gap * 2)) / 2;
    drawPodiumCard(ctx, rows[1], 2, startX, baseY, sw, display);
    drawPodiumCard(ctx, rows[2], 3, startX + sw + gap + cw + gap, baseY, sw, display);
    drawPodiumCard(ctx, rows[0], 1, startX + sw + gap, baseY, cw, display);
    // stars around the champion
    const cx1 = startX + sw + gap + cw / 2;
    for (const [dx, dy, r, a] of [[-190, -430, 16, 0.95], [196, -380, 12, 0.8], [-230, -250, 9, 0.7], [236, -520, 9, 0.75], [-120, -540, 8, 0.7], [140, -300, 7, 0.6]]) {
      drawStar4(ctx, cx1 + dx, baseY + dy, r, '#ffe9a6', a);
    }
    lower.forEach((r, i) => drawListRow(ctx, r, listTop + i * rowH, W, rowH, display));
  } else {
    lower.forEach((r, i) => drawListRow(ctx, r, top - 20 + i * rowH, W, rowH, display));
  }

  // Footer
  ctx.textAlign = 'center';
  ctx.font = `40px ${display}`;
  ctx.fillStyle = '#f2c14e';
  ctx.fillText('clashratings.lol', W / 2, H - 100);
  ctx.font = '22px -apple-system, "Segoe UI", sans-serif';
  ctx.fillStyle = '#6f7388';
  ctx.fillText('Unofficial fan project. Not endorsed by Supercell.', W / 2, H - 56);
  return canvas;
}

// ---- Preview sheet: shows the picture first, then Share / Save ----
const shareModal = $('share-modal');
const sharePreview = $('share-preview');
const shareSend = $('share-send');
const shareSave = $('share-save');
const shareNote = $('share-note');
let shareState = null; // { blob, file, url, opener }

function closeShareModal() {
  if (shareModal.hidden) return;
  shareModal.hidden = true;
  document.body.classList.remove('modal-open');
  if (shareState) {
    URL.revokeObjectURL(shareState.url);
    if (shareState.opener && shareState.opener.focus) shareState.opener.focus();
  }
  sharePreview.removeAttribute('src');
  shareState = null;
}

function downloadShare() {
  if (!shareState) return;
  const a = document.createElement('a');
  a.href = shareState.url;
  a.download = shareState.file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  shareNote.textContent = 'Saved! Check your downloads.';
}

shareModal.addEventListener('click', (e) => {
  if (e.target.closest('[data-close]')) closeShareModal();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeShareModal();
});
shareSave.addEventListener('click', downloadShare);
shareSend.addEventListener('click', async () => {
  if (!shareState) return;
  try {
    await navigator.share({ files: [shareState.file], title: 'Clash Ratings' });
  } catch (e) {
    if (!e || e.name !== 'AbortError') downloadShare();
  }
});

async function shareBoard(info, button) {
  if (!info || !info.rows.length) return;
  const label = button.querySelector('.tb-label') || button;
  const original = label.textContent;
  button.disabled = true;
  button.classList.add('is-busy');
  label.textContent = 'Making…';
  try {
    const canvas = await buildShareCanvas(info);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('no image');
    const name = `clash-ratings-${(info.monthLabel || 'leaderboard').toLowerCase().replace(/\s+/g, '-')}.png`;
    const file = new File([blob], name, { type: 'image/png' });
    const url = URL.createObjectURL(blob);
    shareState = { blob, file, url, opener: button };
    sharePreview.src = url;
    const canShareFiles = !!(navigator.canShare && navigator.canShare({ files: [file] }));
    shareSend.hidden = !canShareFiles;
    shareSave.classList.toggle('btn-primary', !canShareFiles);
    shareSave.classList.toggle('ghost-btn', canShareFiles);
    shareNote.textContent = '';
    shareModal.hidden = false;
    document.body.classList.add('modal-open');
    (canShareFiles ? shareSend : shareSave).focus({ preventScroll: true });
  } catch (err) {
    console.error('Share picture failed:', err);
    label.textContent = "Couldn't make the picture";
    setTimeout(() => (label.textContent = original), 2500);
    button.classList.remove('is-busy');
    button.disabled = false;
    return;
  }
  label.textContent = original;
  button.classList.remove('is-busy');
  button.disabled = false;
}

$('share-month').addEventListener('click', (e) => shareBoard(shareData.month, e.currentTarget));
$('share-last').addEventListener('click', (e) => shareBoard(shareData.last, e.currentTarget));

// ---------- War tab: compact current-war card ----------
const warToggle = $('war-toggle');
const warDetail = $('war-detail');
const warCard = $('war-card');
let warTimerId = null;

function setWarOpen(open) {
  warToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  $('war-toggle-label').textContent = open ? 'Hide attacks' : 'Show attacks';
  warDetail.hidden = !open;
}

warToggle.addEventListener('click', () => setWarOpen(warToggle.getAttribute('aria-expanded') !== 'true'));

// The card with no scoreboard: loading, no war, or an error.
function setWarEmpty(headline, subline = '', state = 'none') {
  warCard.dataset.state = state;
  $('war-board').hidden = true;
  $('war-meter').hidden = true;
  $('war-empty').hidden = false;
  $('war-headline').textContent = headline;
  $('war-subline').textContent = subline;
  warToggle.hidden = true;
  setWarOpen(false);
  clearInterval(warTimerId);
}

function setTeam(prefix, name, badgeUrl) {
  $(`war-${prefix}-name`).textContent = name || '';
  const img = $(`war-${prefix}-badge`);
  const url = safeIconUrl(badgeUrl);
  if (url) {
    img.src = url;
    img.hidden = false;
  } else {
    img.removeAttribute('src');
    img.hidden = true;
  }
}

function warTimerText(data) {
  const now = Date.now();
  if (data.state === 'inWar') {
    const end = parseCocTime(data.endTime);
    const left = end ? durationLabel(end.getTime() - now) : null;
    return left ? `ends in ${left}` : '';
  }
  if (data.state === 'preparation') {
    const start = parseCocTime(data.startTime);
    const left = start ? durationLabel(start.getTime() - now) : null;
    return left ? `battle starts in ${left}` : 'attacks open soon';
  }
  const end = parseCocTime(data.endTime);
  return end ? `ended ${end.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}` : '';
}

function attackChipHtml(a) {
  const d = a.thDelta;
  const target = a.defenderMapPosition != null ? `#${a.defenderMapPosition}${a.sameMapPosition ? ' mirror' : ''}` : '';
  const th =
    a.defenderTownhall != null
      ? `<u class="thc ${d > 0 ? 'up' : d < 0 ? 'dn' : 'eq'}" title="${d > 0 ? 'Hit a higher' : d < 0 ? 'Hit a lower' : 'Hit the same'} town hall">TH${a.defenderTownhall}${d ? ` ${d > 0 ? '+' : ''}${d}` : ''}</u>`
      : '';
  return `<span class="atk s${a.stars}"><span class="atk-stars">${starsHtml(a.stars)}</span><b>${Math.round(a.destructionPercentage || 0)}%</b>${target ? `<em>${escapeHtml(target)}</em>` : ''}${th}</span>`;
}

function warListHtml(data) {
  const per = data.attacksPerMember || 1;
  return data.members
    .map((m) => {
      const used = m.attacks.length;
      const chips = m.attacks.map(attackChipHtml).join('');
      const left = per - used;
      let tail = '';
      if (used === 0) {
        tail = `<span class="wl-wait">${data.state === 'preparation' ? 'Preparing' : `No attack yet · 0/${per}`}</span>`;
      } else if (left > 0 && data.state === 'inWar') {
        tail = `<span class="atk atk-open">${left} left</span>`;
      }
      return `<div class="wl-row${used === 0 ? ' wl-idle' : ''}"><span class="wl-pos">${m.mapPosition}</span><span class="wl-name">${escapeHtml(m.name)}</span><span class="wl-atks">${chips}${tail}</span></div>`;
    })
    .join('');
}

function renderWar(data) {
  const live = data.state === 'inWar' || data.state === 'preparation';
  const members = data.members || [];
  const per = data.attacksPerMember || 1;
  const teamSize = data.teamSize || members.length;
  const totalAttacks = teamSize * per;
  const allAttacks = members.flatMap((m) => m.attacks || []);
  const usedAttacks = data.clan && data.clan.attacks != null ? data.clan.attacks : allAttacks.length;
  const ourStars = data.clan && data.clan.stars != null ? data.clan.stars : members.reduce((n, m) => n + (m.starsEarned || 0), 0);
  const theirStars = data.opponent && data.opponent.stars != null ? data.opponent.stars : null;

  warCard.dataset.state = data.state;
  $('war-empty').hidden = true;
  $('war-board').hidden = false;
  setTeam('us', (data.clan && data.clan.name) || clanName.textContent, data.clan && data.clan.badgeUrl);
  setTeam('them', (data.opponent && data.opponent.name) || data.opponentName || 'Opponent', data.opponent && data.opponent.badgeUrl);

  const showScore = data.state !== 'preparation';
  $('war-us-stars').textContent = showScore ? fmt(ourStars) : '–';
  $('war-them-stars').textContent = showScore && theirStars != null ? fmt(theirStars) : '–';
  warCard.classList.toggle('has-score', showScore && theirStars != null);
  let lead = '';
  if (showScore && theirStars != null) {
    if (ourStars > theirStars) lead = 'us';
    else if (ourStars < theirStars) lead = 'them';
    else if (data.clan && data.opponent && typeof data.clan.destruction === 'number' && typeof data.opponent.destruction === 'number' && data.clan.destruction !== data.opponent.destruction) {
      lead = data.clan.destruction > data.opponent.destruction ? 'us' : 'them';
    }
  }
  $('war-score-nums').dataset.lead = lead;

  const pill = $('war-state-pill');
  pill.className = `state-pill state-${data.state}`;
  pill.innerHTML = `${live ? '<i class="live-dot"></i>' : ''}${{ preparation: 'Prep day', inWar: 'War live', warEnded: 'War ended' }[data.state] || escapeHtml(data.state)}`;
  $('war-badge').hidden = !data.isCwl;
  const timer = $('war-timer');
  timer.textContent = warTimerText(data);
  clearInterval(warTimerId);
  if (live) {
    warTimerId = setInterval(() => (timer.textContent = warTimerText(data)), 30000);
  }

  // Attack meter + a few chips
  const meter = $('war-meter');
  if (data.state === 'preparation') {
    meter.hidden = true;
  } else {
    meter.hidden = false;
    $('war-meter-fill').style.width = `${totalAttacks ? Math.min(100, Math.round((usedAttacks / totalAttacks) * 100)) : 0}%`;
    const threes = allAttacks.filter((a) => a.stars === 3).length;
    const avgDestr = allAttacks.length ? Math.round(allAttacks.reduce((n, a) => n + (a.destructionPercentage || 0), 0) / allAttacks.length) : null;
    const chips = [`<span class="wchip"><b>${usedAttacks}</b>/${totalAttacks} attacks</span>`, `<span class="wchip"><b>${threes}</b> three-star${threes === 1 ? '' : 's'}</span>`];
    if (data.clan && typeof data.clan.destruction === 'number' && data.opponent && typeof data.opponent.destruction === 'number') {
      chips.push(`<span class="wchip"><b>${data.clan.destruction.toFixed(1)}%</b> vs ${data.opponent.destruction.toFixed(1)}% destroyed</span>`);
    } else if (avgDestr != null) {
      chips.push(`<span class="wchip"><b>${avgDestr}%</b> avg destruction</span>`);
    }
    $('war-chips').innerHTML = chips.join('');
  }

  $('war-list').innerHTML = warListHtml({ ...data, attacksPerMember: per });
  warToggle.hidden = false;
  setWarOpen(false);
}

async function fetchCurrentWar(tag) {
  const warStatus = $('war-status');
  const liveDot = $('war-live-dot');

  setWarEmpty('Checking current war...', '', 'loading');
  warStatus.textContent = '';
  warStatus.classList.remove('error');
  liveDot.hidden = true;

  try {
    const res = await fetch(`${BACKEND_URL}/api/currentwar?tag=${encodeURIComponent(tag)}`);
    const data = await res.json();

    if (!res.ok) {
      setWarEmpty('War info unavailable', '', 'error');
      warStatus.textContent = data.error || 'Could not load war data.';
      warStatus.classList.add('error');
      return;
    }

    // The pulsing dot on the tab means "a war is actively happening right
    // now": preparation day or the war itself, not once it's ended.
    liveDot.hidden = !(data.state === 'inWar' || data.state === 'preparation');

    if (data.state === 'notInWar') {
      setWarEmpty('No war right now', "Wars and Clan War League rounds show up here while they're running.");
      return;
    }

    renderWar(data);
  } catch (err) {
    setWarEmpty('War info unavailable', '', 'error');
    warStatus.textContent = 'Could not reach the server for war data.';
    warStatus.classList.add('error');
  }
}

// ---------- War tab: War History board ----------
const RESULT_LABEL = { win: 'W', lose: 'L', tie: 'T' };

function warChipHtml(w) {
  const res = RESULT_LABEL[w.result] || '?';
  const when = parseCocTime(w.endTime);
  const date = when ? when.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '';
  const score = w.clanStars != null && w.opponentStars != null ? ` · ${w.clanStars}★–${w.opponentStars}★` : '';
  return `<div class="ww ww-${w.result || 'unknown'}"><span class="ww-res">${res}</span><span class="ww-text"><b>vs ${escapeHtml(w.opponentName || 'Unknown')}</b><em>${escapeHtml(date)}${score}</em></span></div>`;
}

function renderHistoryRows(tbody, members) {
  const topAvg = 3;
  tbody.innerHTML = members
    .map((m, i) => {
      const rank = i + 1;
      const avg = m.attacks ? m.stars / m.attacks : 0;
      const higher = m.attackedHigher || 0;
      const lower = m.attackedLower || 0;
      const same = m.attackedSame || 0;
      const total = higher + lower + same;
      const bar = total
        ? `<span class="mu" title="${higher} higher · ${same} same · ${lower} lower"><i class="up" style="flex:${higher}"></i><i class="eq" style="flex:${same}"></i><i class="dn" style="flex:${lower}"></i></span>`
        : '<span class="mu mu-empty"></span>';
      const rankCell = rank <= 3 ? crownHtml(rank) : `<span class="rank-num">${rank}</span>`;
      const meta = `${m.wars} war${m.wars === 1 ? '' : 's'} · ${m.attacks} attack${m.attacks === 1 ? '' : 's'}`;
      return `<tr class="${rank <= 3 ? `rank-${rank}` : ''}" style="--i:${i}">
        <td class="wh-rank">${rankCell}</td>
        <td class="wh-name"><span class="name">${escapeHtml(m.name)}</span><span class="wh-meta">${meta}</span></td>
        <td class="num wh-stars"><span class="wh-big">${fmt(m.stars)}</span></td>
        <td class="wh-avg"><span class="wh-avgnum">${avg.toFixed(1)}</span><span class="avg-bar"><i style="width:${Math.min(100, (avg / topAvg) * 100)}%"></i></span></td>
        <td class="wh-mu">${bar}<span class="mu-txt">${higher}↑ ${same}= ${lower}↓</span></td>
      </tr>`;
    })
    .join('');
}

function renderHistorySummary(data) {
  const el = $('history-summary');
  const stars = data.members.reduce((n, m) => n + m.stars, 0);
  const attacks = data.members.reduce((n, m) => n + m.attacks, 0);
  const avg = attacks ? (stars / attacks).toFixed(2) : '0.00';
  const results = (data.wars || []).filter((w) => w.result);
  const won = results.filter((w) => w.result === 'win').length;
  const lost = results.filter((w) => w.result === 'lose').length;
  const tied = results.filter((w) => w.result === 'tie').length;
  const record = results.length ? `${won}–${lost}${tied ? `–${tied}` : ''}` : String(data.warsRecorded);
  const tiles = [
    [results.length ? 'Wars W–L' : 'Wars', record, results.length ? (won > lost ? 'good' : won < lost ? 'bad' : '') : ''],
    ['Stars', fmt(stars), ''],
    ['Attacks', fmt(attacks), ''],
    ['Avg ★ / attack', avg, ''],
  ];
  el.innerHTML = tiles.map(([label, value, tone], i) => `<div class="stat ${tone}" style="--i:${i}"><b>${escapeHtml(value)}</b><span>${escapeHtml(label)}</span></div>`).join('');
  el.hidden = false;
}

async function fetchWarHistory(tag) {
  const card = $('history-card');
  const title = $('history-title');
  const count = $('history-count');
  const historyStatus = $('history-status');
  const historyTable = $('history-table');
  const historyRows = $('history-rows');
  const summary = $('history-summary');
  const warsEl = $('history-wars');
  const board = $('history-board');

  historyStatus.textContent = '';
  historyStatus.classList.remove('error');
  historyTable.hidden = true;
  board.hidden = true;
  summary.hidden = true;
  warsEl.hidden = true;
  card.open = true;

  try {
    const res = await fetch(`${BACKEND_URL}/api/war-history?tag=${encodeURIComponent(tag)}`);
    const data = await res.json();

    if (!res.ok) {
      title.textContent = 'War History';
      count.textContent = '';
      historyStatus.textContent = data.error || 'Could not load war history.';
      historyStatus.classList.add('error');
      card.hidden = false;
      return;
    }

    title.textContent = `War History — ${data.monthLabel}`;
    card.hidden = false;

    if (data.warsRecorded === 0) {
      count.textContent = 'none yet';
      historyStatus.textContent = 'No wars recorded yet this month. Wars show up here once they finish.';
      return;
    }

    count.textContent = `${data.warsRecorded} war${data.warsRecorded === 1 ? '' : 's'}`;
    renderHistorySummary(data);
    if (data.wars && data.wars.length) {
      warsEl.innerHTML = data.wars.slice(0, 8).map(warChipHtml).join('');
      warsEl.hidden = false;
    }
    renderHistoryRows(historyRows, data.members);
    historyTable.hidden = false;
    board.hidden = false;
  } catch (err) {
    title.textContent = 'War History';
    count.textContent = '';
    historyStatus.textContent = 'Could not reach the server for war history.';
    historyStatus.classList.add('error');
    card.hidden = false;
  }
}

// ---------- Last Month tab ----------
// Last month's leaderboard — the only past month the site keeps (the server
// erases anything older, so on the 1st of a new month this automatically
// becomes the month that just ended). The tab only appears when there's data.
async function fetchPreviousMonth(tag) {
  const lastTab = $('tab-last');
  const lastTitle = $('last-title');
  const lastStatus = $('last-status');

  lastTab.hidden = true;
  lastStatus.textContent = '';
  lastStatus.classList.remove('error');
  lastBoard.clear();
  $('last-awards-wrap').hidden = true;
  $('share-last').hidden = true;

  const fail = () => {
    lastTitle.textContent = 'Last month';
    lastStatus.textContent = "Couldn't load last month's leaderboard.";
    lastStatus.classList.add('error');
    lastTab.hidden = false;
  };

  try {
    const res = await fetch(`${BACKEND_URL}/api/previous-month?tag=${encodeURIComponent(tag)}`);
    const data = await res.json();
    if (!res.ok) {
      fail();
      return;
    }

    if (data.members && data.members.length > 0) {
      lastTitle.textContent = data.monthLabel;
      // Same leaderboard as This Month. Role/league icon come from the
      // current member list when the person is still in the clan; Donated is
      // the end-of-month snapshot (0 for a month that was never captured).
      lastBoard.show(
        data.members.map((m, i) => {
          const current = membersByTag.get(m.tag) || {};
          return {
            rank: i + 1,
            name: m.name,
            role: current.role,
            leagueIcon: current.leagueIcon,
            mr: m.mr || 0,
            warStars: m.warStars || 0,
            donated: m.donated || 0,
            raids: m.raidAttacks || 0,
          };
        })
      );
      const awardsWrap = $('last-awards-wrap');
      $('last-awards').innerHTML = awardsHtml(data.awards, { when: 'last' });
      awardsWrap.hidden = false;
      shareData.last = { monthLabel: data.monthLabel, clanName: clanName.textContent, rows: lastBoard.rows() };
      $('share-last').hidden = false;
      lastTab.hidden = false;
      // If the page was opened straight to #last, switch to it now that it exists.
      if (hashTab() === 'last' && activeTab !== 'last') activateTab('last', { updateHash: false });
    }
  } catch (err) {
    console.error('Last month leaderboard failed:', err);
    fail();
  }
}

// Kick off the first search last, once everything above is defined.
searchClan(DEFAULT_CLAN_TAG);