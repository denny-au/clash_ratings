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
const panels = { month: $('panel-month'), war: $('panel-war'), guide: $('panel-guide') };

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

// ---------- Tabs: Leaderboard / War / Guide ----------
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
  if (!btn || btn.hidden) name = 'month'; // unknown tab names fall back to the leaderboard
  activeTab = name;
  for (const b of tabButtons) {
    const on = b.dataset.tab === name;
    b.setAttribute('aria-selected', on ? 'true' : 'false');
    b.tabIndex = on ? 0 : -1;
  }
  for (const [key, el] of Object.entries(panels)) el.hidden = key !== name;
  positionPill(true);
  // the Guide tints the floating lights to the town hall in view; every other tab is back to amber
  const theme = name === 'guide' && window.CR_GUIDE ? window.CR_GUIDE.themeRgb() : null;
  window.CR_THEME_PENDING = theme;
  if (window.CR_FX) window.CR_FX.setTheme(theme);
  if (boardReplays[name]) boardReplays[name]();
  syncSummary(); // the strip is this month's numbers, so it sits out the Guide
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

// Warboard top three: shield icons (1st purple, 2nd gold, 3rd red).
function rankIconHtml(rank) {
  return `<img class="wh-icon" src="assets/site/rank-${rank}.png" width="40" height="40" alt="Rank ${rank}" title="Rank ${rank}" draggable="false">`;
}

// Small trophy shown next to last month's Champion.
function champHtml(label) {
  return `<svg class="champ" viewBox="0 0 24 24" role="img" aria-label="${escapeHtml(label)}"><title>${escapeHtml(label)}</title>
    <path d="M7 3h10v4a5 5 0 0 1-10 0V3Z" /><path d="M7 4H3.5v1.5A3.5 3.5 0 0 0 7 9M17 4h3.5v1.5A3.5 3.5 0 0 1 17 9" fill="none" stroke-width="1.6" />
    <rect x="10.5" y="12" width="3" height="4" /><rect x="7.5" y="17" width="9" height="3" rx="1" />
  </svg>`;
}

// Written label beside the trophy, so it is clear what the trophy means.
const CHAMP_TAG = '<span class="champ-tag">Previous month\'s champion</span>';

// Wraps the part of a name the member search matched in <mark>.
function highlightHtml(name, q) {
  const text = String(name || '');
  const lower = text.toLowerCase();
  const at = q && lower.length === text.length ? lower.indexOf(q) : -1;
  if (at < 0) return escapeHtml(text);
  return `${escapeHtml(text.slice(0, at))}<mark class="hit">${escapeHtml(text.slice(at, at + q.length))}</mark>${escapeHtml(text.slice(at + q.length))}`;
}

function memberCellHtml(row, reserveIcon, hl) {
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
  const nameLine = `<span class="name-line"><span class="name">${hl ? highlightHtml(row.name, hl) : escapeHtml(row.name)}</span>${champ}</span>`;
  // Last month's champion gets a written label under the name, beside the role.
  const nameBlock = row.champLabel ? `<span class="name-col">${nameLine}${CHAMP_TAG}</span>` : nameLine;
  return `<td class="member"><div class="who">${icon}<span class="who-text">${nameBlock}${roleHtml}</span></div></td>`;
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

// ---------- Leaderboard component (used by the Leaderboard and its Last month fold) ----------
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
  let filter = ''; // member search text
  let pickMode = false; // compare mode: tapping a member picks them instead of opening their card
  let picks = []; // tags picked for the comparison, in order (A, then B)
  const pickAttr = (tag) => {
    const i = picks.indexOf(tag);
    return i < 0 ? '' : ` data-pick="${i ? 'B' : 'A'}"`;
  };
  const pickClass = (tag) => {
    const i = picks.indexOf(tag);
    return i < 0 ? '' : i ? ' is-pick-b' : ' is-pick-a';
  };

  // Columns actually showing (some columns hide on phones). A colspan
  // bigger than that would add a phantom column and squash the member names.
  const colCount = () => Array.from(table.querySelectorAll('thead th')).filter((th) => th.offsetParent !== null).length || 1;

  function draw() {
    const maxMr = Math.max(1, ...rows.map((r) => r.mr || 0));
    const reserveIcon = rows.some((r) => safeIconUrl(r.leagueIcon));
    const q = filter.trim().toLowerCase();
    const searching = q.length > 0;
    const matches = searching ? rows.filter((r) => String(r.name || '').toLowerCase().includes(q)) : [];
    const start = hasPodium() && !searching ? 3 : 0; // the top three live on the podium (unless searching)
    const visible = searching ? matches : expanded ? rows.slice(start) : rows.slice(start, Math.max(start, TOP_N));

    body.innerHTML = visible
      .map((r, idx) => {
        const pct = Math.max(3, Math.round(((r.mr || 0) / maxMr) * 100));
        const move = opts.trend ? moveHtml(r.rankChange) : '';
        const rankCell = r.rank <= 3 ? `${crownHtml(r.rank)}${move}` : `<span class="rank-num">${r.rank}</span>${move}`;
        const isOpen = opts.details && open.has(r.tag);
        const attrs = opts.details ? ` data-tag="${escapeHtml(r.tag)}" tabindex="0" aria-expanded="${isOpen}"` : '';
        const main = `<tr class="${r.rank <= 3 ? `rank-${r.rank}` : ''}${opts.details ? ' expandable' : ''}${isOpen ? ' is-open' : ''}${pickClass(r.tag)}" style="--i:${idx}"${attrs}${pickAttr(r.tag)}>
          <td class="rank">${rankCell}</td>
          ${memberCellHtml(r, reserveIcon, searching ? q : '')}
          <td class="num mr"><span class="mr-val">${fmt(r.mr)}</span><span class="mr-bar"><i style="width:${pct}%"></i></span></td>
          <td class="num">${fmt(r.warStars)}</td>
          <td class="num">${fmt(r.donated)}</td>
          <td class="num">${fmt(r.raids)}</td>
        </tr>`;
        if (!isOpen) return main;
        return `${main}<tr class="detail" data-for="${escapeHtml(r.tag)}"><td colspan="${colCount()}"><div class="detail-card">${detailInnerHtml(r, profileFor(r.tag), baselineLabel)}</div></td></tr>`;
      })
      .join('');

    const hasMore = rows.length > TOP_N && !searching;
    moreBtn.hidden = !hasMore;
    moreBtn.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    moreBtn.textContent = expanded ? `Show top ${TOP_N}` : `Show all ${rows.length}`;
    table.hidden = visible.length === 0;
    if (boardEl) boardEl.hidden = visible.length === 0;
    if (podiumEl) podiumEl.hidden = searching || !hasPodium();
    if (opts.onFilter) opts.onFilter({ q: filter.trim(), count: matches.length, total: rows.length });
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
    return `<${el} class="pod pod-${r.rank}${isOpen ? ' is-open' : ''}${pickClass(r.tag)}"${attrs}${pickAttr(r.tag)}>
      <span class="pod-glow" aria-hidden="true"></span>
      ${r.rank === 1 ? '<span class="pod-ring" aria-hidden="true"><i></i></span>' : ''}
      <span class="pod-crown">${crownHtml(r.rank)}</span>
      <span class="pod-who">${icon}<span class="pod-name">${escapeHtml(r.name)}</span>${r.champLabel ? champHtml(r.champLabel) : ''}</span>
      <span class="pod-role">${escapeHtml(label)}</span>
      ${r.champLabel ? '<span class="pod-champ">Previous month\'s champion</span>' : ''}
      <span class="pod-mr"><b data-count="${Number(r.mr) || 0}">${fmt(r.mr)}</b><i>MR</i></span>
      ${opts.trend && r.rankChange ? `<span class="pod-move">${moveHtml(r.rankChange)}</span>` : ''}
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
    podiumEl.hidden = filter.trim().length > 0;
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

  // A tap opens the player card, or (in compare mode) picks the member for the head-to-head.
  function activate(tag) {
    if (pickMode && opts.onPick) opts.onPick(tag);
    else toggle(tag);
  }

  function refreshPicks() {
    for (const el of [...body.querySelectorAll('tr[data-tag]'), ...(podiumEl ? podiumEl.querySelectorAll('.pod[data-tag]') : [])]) {
      const i = picks.indexOf(el.dataset.tag);
      el.classList.toggle('is-pick-a', i === 0);
      el.classList.toggle('is-pick-b', i === 1);
      if (i < 0) el.removeAttribute('data-pick');
      else el.setAttribute('data-pick', i ? 'B' : 'A');
    }
    for (const el of [boardEl, podiumEl]) if (el) el.classList.toggle('pick-mode', pickMode);
  }

  if (opts.details) {
    body.addEventListener('click', (e) => {
      const tr = e.target.closest('tr.expandable');
      if (tr) activate(tr.dataset.tag);
    });
    body.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const tr = e.target.closest('tr.expandable');
      if (!tr || e.target !== tr) return;
      e.preventDefault();
      activate(tr.dataset.tag);
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
      if (pod) activate(pod.dataset.tag);
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
    setFilter(text) {
      filter = String(text || '');
      if (boardEl) boardEl.classList.remove('enter'); // don't replay the row entrance on every keystroke
      draw();
    },
    setPick(on, list = []) {
      pickMode = !!on;
      picks = pickMode ? list.slice(0, 2) : [];
      refreshPicks();
    },
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

const monthBoard = createLeaderboard('member', { trend: true, details: true, podium: true, onFilter: onFindResults, onPick: onComparePick });
const lastBoard = createLeaderboard('last', { podium: true });
boardReplays.month = () => monthBoard.replay();

// ---------- Find (search) ----------
// One small tool, used by both the Leaderboard and the Warboard.
function createFindTool(o) {
  const tool = {
    set(open, { focus = true } = {}) {
      o.bar.hidden = !open;
      o.btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      o.btn.classList.toggle('is-on', open);
      if (open) {
        if (focus) o.input.focus();
      } else if (o.input.value) {
        o.input.value = '';
        o.apply('');
      }
    },
    results({ q, count, total }) {
      o.count.textContent = q ? `${count} of ${total}` : '';
      o.clear.hidden = !q;
      const none = q && count === 0;
      o.empty.hidden = !none;
      if (none) o.empty.textContent = `No ${o.noun} matches \u201c${q}\u201d.`;
    },
  };
  o.btn.addEventListener('click', () => tool.set(o.bar.hidden));
  o.input.addEventListener('input', () => o.apply(o.input.value));
  o.input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      tool.set(false);
      o.btn.focus();
    }
  });
  o.clear.addEventListener('click', () => {
    o.input.value = '';
    o.apply('');
    o.input.focus();
  });
  return tool;
}

const memberFind = createFindTool({
  btn: $('find-btn'), bar: $('find-bar'), input: $('find-input'), count: $('find-count'), clear: $('find-clear'), empty: $('find-empty'),
  noun: 'member', apply: (text) => monthBoard.setFilter(text),
});
const setFind = (open, opts) => memberFind.set(open, opts);
function onFindResults(info) {
  memberFind.results(info);
}

// ---------- Compare two (head to head) ----------
const vsModal = $('vs-modal');
const vsSheet = $('vs-sheet');
let vsOpener = null;
let vsActive = null; // the compare tool whose sheet is open
let lastTrendDates = [];

function createCompareTool(o) {
  let picks = []; // tags, in order (A, then B)
  const tool = {
    picks: () => picks,
    rows: () => picks.map(o.rowFor),
    update() {
      const [a, b] = picks.map(o.rowFor);
      const fill = (el, row) => {
        el.classList.toggle('is-set', !!row);
        el.querySelector('b').textContent = row ? row.name : '?';
      };
      fill(o.slots.a, a);
      fill(o.slots.b, b);
      o.hint.textContent = picks.length === 0 ? `Tap two ${o.noun}s to compare` : picks.length === 1 ? `Now tap the second ${o.noun}` : 'Opening head to head\u2026';
    },
    set(on) {
      picks = [];
      o.bar.hidden = !on;
      o.btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      o.btn.classList.toggle('is-on', on);
      o.setPick(on, picks);
      tool.update();
    },
    pick(tag) {
      const at = picks.indexOf(tag);
      if (at >= 0) picks.splice(at, 1);
      else {
        if (picks.length === 2) picks.shift();
        picks.push(tag);
      }
      o.setPick(true, picks);
      tool.update();
      if (picks.length === 2) setTimeout(() => picks.length === 2 && tool.open(), reduceMotion() ? 0 : 320);
    },
    sheet() {
      const [a, b] = picks.map(o.rowFor);
      return a && b ? o.html(a, b) : '';
    },
    open() {
      const html = tool.sheet();
      if (!html) return;
      vsActive = tool;
      vsOpener = document.activeElement;
      vsSheet.innerHTML = html;
      vsModal.hidden = false;
      document.body.classList.add('modal-open');
      vsSheet.scrollTop = 0;
      vsSheet.querySelectorAll('[data-count]').forEach((n) => countUp(n, 1000));
      const x = vsSheet.querySelector('.vs-x');
      if (x) x.focus({ preventScroll: true });
    },
    swap() {
      picks.reverse();
      o.setPick(true, picks);
      tool.update();
      vsSheet.innerHTML = tool.sheet();
      vsSheet.querySelectorAll('[data-count]').forEach((n) => countUp(n, 800));
      const x = vsSheet.querySelector('.vs-x');
      if (x) x.focus({ preventScroll: true });
    },
  };
  o.btn.addEventListener('click', () => tool.set(o.bar.hidden));
  o.cancel.addEventListener('click', () => tool.set(false));
  return tool;
}

const memberCompare = createCompareTool({
  btn: $('compare-btn'), bar: $('compare-bar'), hint: $('cmp-hint'), cancel: $('cmp-cancel'), slots: { a: $('cmp-a'), b: $('cmp-b') },
  noun: 'member', rowFor: (tag) => monthBoard.rows().find((r) => r.tag === tag),
  setPick: (on, list) => monthBoard.setPick(on, list), html: (a, b) => vsHtml(a, b),
});
const setCompare = (on) => memberCompare.set(on);
function onComparePick(tag) {
  memberCompare.pick(tag);
}

// A dual line chart of both members' MR, day by day.
function vsChartSvg(ta, tb, w, h) {
  const series = [ta || [], tb || []];
  const all = series.flat().filter((v) => v != null);
  if (series.some((t) => t.filter((v) => v != null).length < 2) || all.length < 4) return '';
  const n = Math.max(...series.map((t) => t.length)) - 1 || 1;
  const min = Math.min(...all);
  const max = Math.max(...all);
  const span = max - min || 1;
  const pad = 6;
  const pt = (i, v) => [pad + (i / n) * (w - pad * 2), h - pad - ((v - min) / span) * (h - pad * 2 - 6)];
  const draw = (t, cls, gid) => {
    const xy = [];
    t.forEach((v, i) => {
      if (v != null) xy.push(pt(i, v));
    });
    const d = xy.map(([x, y], k) => `${k ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
    const last = xy[xy.length - 1];
    const area = `${d} L${last[0].toFixed(1)} ${h} L${xy[0][0].toFixed(1)} ${h} Z`;
    return `<path class="vs-area ${cls}" d="${area}" fill="url(#${gid})" /><path class="vs-line ${cls}" d="${d}" pathLength="1" /><circle class="vs-dot ${cls}" cx="${last[0].toFixed(1)}" cy="${last[1].toFixed(1)}" r="3.4" />`;
  };
  return `<svg class="vs-chart" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id="vsga" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="rgb(var(--ca))" stop-opacity=".38"/><stop offset="1" stop-color="rgb(var(--ca))" stop-opacity="0"/></linearGradient>
      <linearGradient id="vsgb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="rgb(var(--cb))" stop-opacity=".38"/><stop offset="1" stop-color="rgb(var(--cb))" stop-opacity="0"/></linearGradient>
    </defs>
    ${draw(series[0], 'a', 'vsga')}${draw(series[1], 'b', 'vsgb')}
  </svg>`;
}

function vsFighterHtml(r, side, wins) {
  const iconUrl = safeIconUrl(r.leagueIcon);
  const icon = iconUrl ? `<img class="vs-icon" src="${iconUrl}" alt="" width="44" height="44" referrerpolicy="no-referrer" />` : `<span class="vs-icon vs-icon-empty">${escapeHtml((r.name || '?').trim().charAt(0).toUpperCase())}</span>`;
  return `<div class="vs-fighter ${side}${wins ? ' is-lead' : ''}">
    ${wins ? '<span class="vs-lead-crown" aria-hidden="true"><svg viewBox="0 0 32 24"><path d="M3 20 1.5 6.5l8 5.5L16 3l6.5 9 8-5.5L29 20Z" /><rect x="3" y="21" width="26" height="3" rx="1.2" /></svg></span>' : ''}
    <span class="vs-icon-wrap">${icon}</span>
    <span class="vs-name">${escapeHtml(r.name)}</span>
    <span class="vs-meta"><span class="vs-rank">#${r.rank}</span>${escapeHtml(ROLE_LABELS[r.role] || '')}</span>
    <span class="vs-mr"><b data-count="${Number(r.mr) || 0}">${fmt(r.mr)}</b><i>MR</i></span>
  </div>`;
}

function vsRowHtml(label, a, b, i, format = fmt) {
  const max = Math.max(1, a, b);
  const lead = a === b ? '' : a > b ? 'a' : 'b';
  return `<div class="vs-row${lead ? ` lead-${lead}` : ''}" style="--i:${i}">
    <span class="vs-val a">${format(a)}</span>
    <span class="vs-label">${label}</span>
    <span class="vs-val b">${format(b)}</span>
    <span class="vs-bars"><span class="vs-half a"><i style="--w:${((a / max) * 100).toFixed(1)}%"></i></span><span class="vs-half b"><i style="--w:${((b / max) * 100).toFixed(1)}%"></i></span></span>
  </div>`;
}

function vsMixHtml(r, side) {
  const b = r.breakdown || {};
  const total = Math.max(1, (b.donations || 0) + (b.raids || 0) + (b.wars || 0));
  const seg = (cls, v) => (v > 0 ? `<i class="${cls}" style="width:${((v / total) * 100).toFixed(2)}%"></i>` : '');
  return `<div class="vs-mix ${side}"><span class="vs-mix-name">${escapeHtml(r.name)}</span><span class="mr-split">${seg('s-don', b.donations)}${seg('s-raid', b.raids)}${seg('s-war', b.wars)}</span></div>`;
}

function vsHtml(a, b) {
  const cats = [
    ['MR', a.mr || 0, b.mr || 0],
    ['War stars', a.warStars || 0, b.warStars || 0],
    ['Donated', a.donated || 0, b.donated || 0],
    ['Raid attacks', a.raids || 0, b.raids || 0],
  ];
  const winsA = cats.filter(([, x, y]) => x > y).length;
  const winsB = cats.filter(([, x, y]) => y > x).length;
  const leadA = winsA > winsB;
  const leadB = winsB > winsA;
  const share = (a.mr || 0) + (b.mr || 0) > 0 ? ((a.mr || 0) / ((a.mr || 0) + (b.mr || 0))) * 100 : 50;
  const verdict = leadA || leadB
    ? `<b>${escapeHtml((leadA ? a : b).name)}</b> leads in ${Math.max(winsA, winsB)} of ${cats.length} categories`
    : winsA === 0 ? 'Dead even, nothing separates them' : 'All square, two categories each';
  const chart = vsChartSvg(a.trend, b.trend, 320, 84);
  const dates = lastTrendDates.length > 1 ? `<span>${escapeHtml(shortDateLabel(lastTrendDates[0]))}</span><span>${escapeHtml(shortDateLabel(lastTrendDates[lastTrendDates.length - 1]))}</span>` : '';
  return `<button type="button" class="vs-x" data-close aria-label="Close">&times;</button>
    <p class="vs-kicker">Head to head</p>
    <div class="vs-top">
      ${vsFighterHtml(a, 'a', leadA)}
      <div class="vs-mid"><span class="vs-badge"><i></i><b>VS</b></span><span class="vs-tally"><b class="a">${winsA}</b>&ndash;<b class="b">${winsB}</b></span></div>
      ${vsFighterHtml(b, 'b', leadB)}
    </div>
    <div class="vs-tug" role="img" aria-label="MR share"><i class="a" style="--w:${share.toFixed(1)}%"></i><i class="b" style="--w:${(100 - share).toFixed(1)}%"></i><span class="vs-spark" style="--at:${share.toFixed(1)}%"></span></div>
    <div class="vs-rows">${cats.slice(1).map(([label, x, y], i) => vsRowHtml(label, x, y, i)).join('')}</div>
    <div class="vs-block"><h5>Where their MR comes from</h5>${vsMixHtml(a, 'a')}${vsMixHtml(b, 'b')}
      <ul class="mr-legend"><li><span class="dot s-don"></span>Donations</li><li><span class="dot s-raid"></span>Raids</li><li><span class="dot s-war"></span>Wars</li></ul></div>
    ${chart ? `<div class="vs-block"><h5>MR day by day</h5><div class="vs-chartbox">${chart}</div><div class="vs-dates">${dates}</div></div>` : ''}
    <p class="vs-verdict">${verdict}</p>
    <div class="vs-actions"><button type="button" class="ghost-btn" id="vs-swap">Swap sides</button><button type="button" class="ghost-btn" id="vs-again">Pick others</button></div>`;
}

function closeVs() {
  if (vsModal.hidden) return;
  vsModal.hidden = true;
  document.body.classList.remove('modal-open');
  vsSheet.innerHTML = '';
  if (vsOpener && vsOpener.focus) vsOpener.focus({ preventScroll: true });
}

vsModal.addEventListener('click', (e) => {
  if (e.target.closest('[data-close]')) return closeVs();
  if (e.target.closest('#vs-swap') && vsActive) return vsActive.swap();
  if (e.target.closest('#vs-again') && vsActive) {
    const tool = vsActive;
    closeVs();
    tool.set(true);
  }
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !vsModal.hidden) closeVs();
});

// ---------- Hall of Champions (stays empty until the server reveals it) ----------
async function fetchHall(tag) {
  const hall = $('hall');
  hall.hidden = true;
  try {
    const res = await fetch(`${BACKEND_URL}/api/hall-of-champions?tag=${encodeURIComponent(tag)}`);
    if (!res.ok) return;
    const data = await res.json();
    if (!data.revealed || !data.champions || !data.champions.length || tag !== currentClanTag) return;
    const latest = data.champions.length - 1;
    $('hall-list').innerHTML = data.champions
      .map((c, i) => {
        const when = new Date(c.year, c.month - 1, 1).toLocaleDateString(undefined, { month: 'short', year: i === 0 || c.month === 1 ? 'numeric' : undefined });
        return `<div class="hall-chip${i === latest ? ' is-latest' : ''}" style="--i:${i}"><span class="hall-when">${escapeHtml(when)}</span><span class="hall-name">${escapeHtml(c.name)}</span>${c.mr != null ? `<span class="hall-mr">${fmt(c.mr)} MR</span>` : ''}</div>`;
      })
      .join('');
    hall.hidden = false;
  } catch {
    /* the hall is a bonus: never let it break the page */
  }
}

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
  shareData.month = shareData.last = shareData.war = null;
  $('last-fold').hidden = true;
  $('last-fold').open = false;
  shareData.war = null;
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
    fetchHall(data.tag);
  } catch (err) {
    setStatus('Could not reach the server. Is it running?', true);
  }
}


function renderClan(data) {
  clanName.textContent = data.name;
  clanTagEl.textContent = data.tag;
  const meta = `Level ${data.level} · ${data.memberCount} members`;
  const raid = data.raidWeekend;
  const raidLive = !!(raid && raid.state === 'ongoing');
  clanMeta.textContent = raid && !raidLive ? `${meta} · Raid Weekend: ended ${raid.endLabel}` : meta;
  if (raidLive) {
    // A glowing pill so a live Raid Weekend is hard to miss.
    const pill = document.createElement('span');
    pill.className = 'raid-pill';
    const dot = document.createElement('i');
    dot.className = 'live-dot';
    pill.append(dot, 'Raid Weekend live');
    clanMeta.append(' ', pill);
  }
  // While a Raid Weekend is live, the clan card shows the raid art and glows.
  clanInfo.classList.toggle('raid-live', raidLive);
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
  lastTrendDates = data.trendDates || [];
  setFind(false);
  setCompare(false);

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
  summaryEl.hidden = !summaryHasData || activeTab === 'guide';
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
  conqueror: '<path d="M3 18 2 7l5.5 4L12 3.5l4.5 7.5L22 7l-1 11Z"/><rect x="3" y="19.5" width="18" height="2.2" rx="1"/>',
  challenger: '<path d="M4 4l11 11M20 4 9 15" stroke-width="2.2" stroke-linecap="round" fill="none"/><path d="M13 17l4-4M7 13l4 4" stroke-width="2.2" stroke-linecap="round" fill="none"/><path d="M16 16l3 3M8 16l-3 3" stroke-width="2.2" stroke-linecap="round" fill="none"/><circle cx="20" cy="20" r="1.4"/><circle cx="4" cy="20" r="1.4"/>',
  sharpshooter: '<circle cx="12" cy="12" r="8.5" fill="none" stroke-width="1.8"/><circle cx="12" cy="12" r="4.6" fill="none" stroke-width="1.8"/><circle cx="12" cy="12" r="1.6"/>',
};

// Tint (r,g,b) for each award card.
const AWARD_TINTS = {
  champion: '242,193,78',
  donor: '255,138,168',
  stars: '255,150,48',
  conqueror: '176,140,255',
  sharpshooter: '111,216,238',
  challenger: '255,82,110',
};

// Every award always gets a card; when nobody has earned it the card is
// greyed out with the requirement, so the set never changes shape.
const AWARD_SLOTS = [
  { key: 'champion', title: 'Champion', hint: 'Needs a Mastery Rating above 0' },
  { key: 'conqueror', title: 'Conqueror', hint: 'Goes to the top of the Warboard' },
  { key: 'donor', title: 'Provider', hint: 'Needs at least 1 troop donated' },
  { key: 'stars', title: 'Star Collector', hint: 'Needs at least 1 war star' },
  { key: 'sharpshooter', title: 'Sharpshooter', hint: 'Needs 2+ war attacks' },
  { key: 'challenger', title: 'Challenger', hint: 'Most attacks on higher town halls' },
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
const shareData = { month: null, last: null, war: null };

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
  ctx.fillText(fitText(ctx, r.name || '', 560), x0 + 140, cy - (r.role || r.sub ? 2 : -14));
  const roleLabel = r.sub || ROLE_LABELS[r.role];
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
  ctx.fillText(r.bigLabel || 'MR', x0 + w - 36, cy + 48);
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
  const roleLabel = r.sub || ROLE_LABELS[r.role];
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
  ctx.fillText(r.bigLabel || 'MR', cx, y + 40);

  // small stats
  const sy = baseY - dims.bh - 56;
  ctx.strokeStyle = `rgba(${rgb},0.25)`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x + 28, sy - 44);
  ctx.lineTo(x + w - 28, sy - 44);
  ctx.stroke();
  const stats = r.stats || [[r.warStars, 'stars'], [r.donated, 'donated'], [r.raids, 'raids']];
  stats.forEach(([v, label], i) => {
    const sx = x + (w / 3) * (i + 0.5);
    ctx.font = `${rank === 1 ? 38 : 32}px ${font}`;
    ctx.fillStyle = '#f4f1ea';
    ctx.fillText(typeof v === 'number' ? fmt(v) : v, sx, sy);
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
  const label = info.heading || info.monthLabel || '';
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
    const name = `clash-ratings-${(info.fileLabel || info.monthLabel || 'leaderboard').toLowerCase().replace(/\s+/g, '-')}.png`;
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
$('share-war').addEventListener('click', (e) => shareBoard(shareData.war, e.currentTarget));

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

// ---------- War tab: the Warboard ----------
const RESULT_LABEL = { win: 'W', lose: 'L', tie: 'T' };

function warChipHtml(w, latest) {
  const res = RESULT_LABEL[w.result] || '?';
  const when = parseCocTime(w.endTime);
  const date = when ? when.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '';
  const score = w.clanStars != null && w.opponentStars != null ? ` · ${w.clanStars}★–${w.opponentStars}★` : '';
  const tag = latest ? '<span class="ww-new">Latest</span>' : '';
  return `<div class="ww ww-${w.result || 'unknown'}${latest ? ' ww-latest' : ''}"><span class="ww-res">${res}</span><span class="ww-text"><b>vs ${escapeHtml(w.opponentName || 'Unknown')}</b><em>${escapeHtml(date)}${score}</em></span>${tag}</div>`;
}

// The top three get a flame that streams across the whole row (the layers are drawn by CSS).
const flameHtml = () => '<span class="wh-fire" aria-hidden="true"><b class="f4"><i></i></b><b class="f1"><i></i></b><b class="f2"><i></i></b><b class="f3"><i></i></b></span>';

const warFind = createFindTool({
  btn: $('w-find-btn'), bar: $('w-find-bar'), input: $('w-find-input'), count: $('w-find-count'), clear: $('w-find-clear'), empty: $('w-find-empty'),
  noun: 'player', apply: (text) => warBoard.setFilter(text),
});

// The Warboard table: players with at least one star, best first. Supports search and compare picks.
const warBoard = (() => {
  const body = $('history-rows');
  let rows = [];
  let filter = '';
  let pickMode = false;
  let picks = [];

  const pickClass = (tag) => {
    const i = picks.indexOf(tag);
    return i < 0 ? '' : i ? ' is-pick-b' : ' is-pick-a';
  };

  function rowHtml(m, i, q) {
    const rank = m.rank;
    const topAvg = 3;
    const avg = m.attacks ? m.stars / m.attacks : 0;
    const perfect = m.attacks > 0 && m.stars === m.attacks * 3; // every attack a 3-star
    const higher = m.attackedHigher || 0;
    const lower = m.attackedLower || 0;
    const same = m.attackedSame || 0;
    const total = higher + lower + same;
    const bar = total
      ? `<span class="mu" title="${higher} higher · ${same} same · ${lower} lower"><i class="up" style="flex:${higher}"></i><i class="eq" style="flex:${same}"></i><i class="dn" style="flex:${lower}"></i></span>`
      : '<span class="mu mu-empty"></span>';
    const rankCell = rank <= 3 ? rankIconHtml(rank) : `<span class="rank-num">${rank}</span>`;
    const meta = `${m.wars} war${m.wars === 1 ? '' : 's'} · ${m.attacks} attack${m.attacks === 1 ? '' : 's'}`;
    return `<tr class="${rank <= 3 ? `rank-${rank}` : ''}${pickClass(m.tag)}" style="--i:${i}" data-tag="${escapeHtml(m.tag)}">
        <td class="wh-rank">${rank <= 3 ? flameHtml() : ''}${rankCell}</td>
        <td class="wh-name"><span class="name">${highlightHtml(m.name, q)}</span><span class="wh-meta">${meta}</span></td>
        <td class="num wh-stars"><span class="wh-big">${fmt(m.stars)}</span></td>
        <td class="wh-avg${perfect ? ' is-perfect' : ''}"><span class="wh-avgnum">${avg.toFixed(1)}</span><span class="avg-bar"><i style="width:${Math.min(100, (avg / topAvg) * 100)}%"></i></span></td>
        <td class="wh-mu">${bar}<span class="mu-txt">${higher}↑ ${same}= ${lower}↓</span></td>
      </tr>`;
  }

  function draw(still) {
    const q = filter.trim();
    const needle = q.toLowerCase();
    const visible = needle ? rows.filter((r) => String(r.name || '').toLowerCase().includes(needle)) : rows;
    body.classList.toggle('is-still', !!still); // searching/picking must not replay the entrance
    body.innerHTML = visible.map((m, i) => rowHtml(m, i, q)).join('');
    warFind.results({ q, count: visible.length, total: rows.length });
    $('history-table').hidden = visible.length === 0;
  }

  body.addEventListener('click', (e) => {
    const tr = e.target.closest('tr[data-tag]');
    if (tr && pickMode) warCompare.pick(tr.dataset.tag);
  });

  return {
    show(members) {
      // Players who scored no stars at all this month stay off the board.
      rows = members.filter((m) => (m.stars || 0) > 0).map((m, i) => ({ ...m, rank: i + 1 }));
      filter = '';
      pickMode = false;
      picks = [];
      draw(false);
    },
    rows: () => rows,
    clear() {
      rows = [];
      body.innerHTML = '';
    },
    setFilter(text) {
      filter = String(text || '');
      draw(true);
    },
    setPick(on, list = []) {
      pickMode = !!on;
      picks = pickMode ? list.slice(0, 2) : [];
      for (const tr of body.querySelectorAll('tr[data-tag]')) {
        const i = picks.indexOf(tr.dataset.tag);
        tr.classList.toggle('is-pick-a', i === 0);
        tr.classList.toggle('is-pick-b', i === 1);
      }
      $('history-board').classList.toggle('pick-mode', pickMode);
    },
  };
})();

// Head to head for two Warboard players.
function vsWarFighterHtml(r, side, wins) {
  const th = r.townhallLevel ? `TH${r.townhallLevel}` : '';
  return `<div class="vs-fighter ${side}${wins ? ' is-lead' : ''}">
    ${wins ? '<span class="vs-lead-crown" aria-hidden="true"><svg viewBox="0 0 32 24"><path d="M3 20 1.5 6.5l8 5.5L16 3l6.5 9 8-5.5L29 20Z" /><rect x="3" y="21" width="26" height="3" rx="1.2" /></svg></span>' : ''}
    <span class="vs-icon-wrap"><span class="vs-icon vs-icon-empty">${escapeHtml((r.name || '?').trim().charAt(0).toUpperCase())}</span></span>
    <span class="vs-name">${escapeHtml(r.name)}</span>
    <span class="vs-meta"><span class="vs-rank">#${r.rank}</span>${escapeHtml(th)}</span>
    <span class="vs-mr"><b data-count="${Number(r.stars) || 0}">${fmt(r.stars)}</b><i>STARS</i></span>
  </div>`;
}

function vsWarMixHtml(r, side) {
  const h = r.attackedHigher || 0;
  const e = r.attackedSame || 0;
  const l = r.attackedLower || 0;
  const bar = h + e + l
    ? `<span class="mu"><i class="up" style="flex:${h}"></i><i class="eq" style="flex:${e}"></i><i class="dn" style="flex:${l}"></i></span>`
    : '<span class="mu mu-empty"></span>';
  return `<div class="vs-mix ${side}"><span class="vs-mix-name">${escapeHtml(r.name)}</span><span class="vs-mix-bar">${bar}<span class="vs-mix-txt">${h}↑ ${e}= ${l}↓</span></span></div>`;
}

function vsWarHtml(a, b) {
  const avg = (r) => (r.attacks ? r.stars / r.attacks : 0);
  const cats = [
    ['Stars', a.stars || 0, b.stars || 0],
    ['Avg ★ / attack', avg(a), avg(b), (v) => v.toFixed(2)],
    ['Attacks', a.attacks || 0, b.attacks || 0],
    ['Wars', a.wars || 0, b.wars || 0],
    ['Hits on higher TH', a.attackedHigher || 0, b.attackedHigher || 0],
  ];
  const winsA = cats.filter(([, x, y]) => x > y).length;
  const winsB = cats.filter(([, x, y]) => y > x).length;
  const leadA = winsA > winsB;
  const leadB = winsB > winsA;
  const total = (a.stars || 0) + (b.stars || 0);
  const share = total > 0 ? ((a.stars || 0) / total) * 100 : 50;
  const verdict = leadA || leadB
    ? `<b>${escapeHtml((leadA ? a : b).name)}</b> leads in ${Math.max(winsA, winsB)} of ${cats.length} categories`
    : winsA === 0 ? 'Dead even, nothing separates them' : 'All square on the Warboard';
  return `<button type="button" class="vs-x" data-close aria-label="Close">&times;</button>
    <p class="vs-kicker">Warboard head to head</p>
    <div class="vs-top">
      ${vsWarFighterHtml(a, 'a', leadA)}
      <div class="vs-mid"><span class="vs-badge"><i></i><b>VS</b></span><span class="vs-tally"><b class="a">${winsA}</b>&ndash;<b class="b">${winsB}</b></span></div>
      ${vsWarFighterHtml(b, 'b', leadB)}
    </div>
    <div class="vs-tug" role="img" aria-label="Share of stars"><i class="a" style="--w:${share.toFixed(1)}%"></i><i class="b" style="--w:${(100 - share).toFixed(1)}%"></i><span class="vs-spark" style="--at:${share.toFixed(1)}%"></span></div>
    <div class="vs-rows">${cats.slice(1).map(([label, x, y, f], i) => vsRowHtml(label, x, y, i, f)).join('')}</div>
    <div class="vs-block"><h5>Who they attacked</h5>${vsWarMixHtml(a, 'a')}${vsWarMixHtml(b, 'b')}
      <ul class="mr-legend"><li><span class="dot s-up"></span>Higher town hall</li><li><span class="dot s-eq"></span>Same</li><li><span class="dot s-dn"></span>Lower</li></ul></div>
    <p class="vs-verdict">${verdict}</p>
    <div class="vs-actions"><button type="button" class="ghost-btn" id="vs-swap">Swap sides</button><button type="button" class="ghost-btn" id="vs-again">Pick others</button></div>`;
}

const warCompare = createCompareTool({
  btn: $('w-compare-btn'), bar: $('w-compare-bar'), hint: $('w-cmp-hint'), cancel: $('w-cmp-cancel'), slots: { a: $('w-cmp-a'), b: $('w-cmp-b') },
  noun: 'player', rowFor: (tag) => warBoard.rows().find((r) => r.tag === tag),
  setPick: (on, list) => warBoard.setPick(on, list), html: (a, b) => vsWarHtml(a, b),
});

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
    const summary = $('history-summary');
  const warsEl = $('history-wars');
  const board = $('history-board');

  historyStatus.textContent = '';
  historyStatus.classList.remove('error');
  historyTable.hidden = true;
  board.hidden = true;
  summary.hidden = true;
  warsEl.hidden = true;
  $('war-tools').hidden = true;
  $('history-note').hidden = true;
  warFind.set(false);
  warCompare.set(false);
  warBoard.clear();
  shareData.war = null;
  card.open = true;

  try {
    const res = await fetch(`${BACKEND_URL}/api/war-history?tag=${encodeURIComponent(tag)}`);
    const data = await res.json();

    if (!res.ok) {
      title.textContent = 'Warboard';
      count.textContent = '';
      historyStatus.textContent = data.error || 'Could not load the Warboard.';
      historyStatus.classList.add('error');
      card.hidden = false;
      return;
    }

    title.textContent = 'Warboard';
    card.hidden = false;

    if (data.warsRecorded === 0) {
      count.textContent = 'none yet';
      historyStatus.textContent = 'No wars recorded yet this month. Wars show up here once they finish.';
      return;
    }

    count.textContent = `${data.warsRecorded} war${data.warsRecorded === 1 ? '' : 's'}`;
    renderHistorySummary(data);
    if (data.wars && data.wars.length) {
      // Newest first, so the latest war is the highlighted one in the top left.
      const byNewest = data.wars.slice().sort((a, b) => (parseCocTime(b.endTime) || 0) - (parseCocTime(a.endTime) || 0));
      warsEl.innerHTML = byNewest.slice(0, 8).map((w, i) => warChipHtml(w, i === 0)).join('');
      warsEl.hidden = false;
    }
    warBoard.show(data.members);
    const ranked = warBoard.rows();
    if (!ranked.length) {
      historyStatus.textContent = 'No one has scored a star in a war yet this month.';
      return;
    }
    $('war-tools').hidden = false;
    historyTable.hidden = false;
    board.hidden = false;
    $('history-note').hidden = false;
    shareData.war = {
      kind: 'war',
      clanName: clanName.textContent,
      monthLabel: data.monthLabel,
      heading: `Warboard · ${data.monthLabel}`,
      fileLabel: `warboard-${data.monthLabel}`,
      rows: ranked.slice(0, 5).map((m) => ({
        rank: m.rank,
        name: m.name,
        sub: `${m.wars} war${m.wars === 1 ? '' : 's'} · ${m.attacks} attack${m.attacks === 1 ? '' : 's'}`,
        mr: m.stars,
        bigLabel: 'STARS',
        stats: [[(m.attacks ? m.stars / m.attacks : 0).toFixed(1), 'avg'], [m.wars, 'wars'], [m.attacks, 'attacks']],
      })),
    };
  } catch (err) {
    title.textContent = 'Warboard';
    count.textContent = '';
    historyStatus.textContent = 'Could not reach the server for the Warboard.';
    historyStatus.classList.add('error');
    card.hidden = false;
  }
}

// ---------- Last month (a dropdown under the leaderboard) ----------
// Last month's leaderboard — the only past month the site keeps (the server
// erases anything older, so on the 1st of a new month this automatically
// becomes the month that just ended). The dropdown only appears when there's data.
const lastFold = $('last-fold');
lastFold.addEventListener('toggle', () => {
  if (lastFold.open) lastBoard.replay();
});

async function fetchPreviousMonth(tag) {
  const lastTitle = $('last-title');
  const lastStatus = $('last-status');

  lastFold.hidden = true;
  lastStatus.textContent = '';
  lastStatus.classList.remove('error');
  lastBoard.clear();
  $('last-awards-wrap').hidden = true;
  $('share-last').hidden = true;

  const fail = () => {
    lastTitle.textContent = '';
    lastStatus.textContent = "Couldn't load last month's leaderboard.";
    lastStatus.classList.add('error');
    lastFold.hidden = false;
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
      // Same leaderboard as this month's. Role/league icon come from the
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
      lastFold.hidden = false;
      // Opened straight to #last: open the dropdown and bring it into view.
      if (location.hash.replace('#', '').split('/')[0] === 'last') {
        lastFold.open = true;
        setTimeout(() => lastFold.scrollIntoView({ block: 'start', behavior: reduceMotion() ? 'auto' : 'smooth' }), 250);
      }
    }
  } catch (err) {
    console.error('Last month leaderboard failed:', err);
    fail();
  }
}

// Kick off the first search last, once everything above is defined.
searchClan(DEFAULT_CLAN_TAG);