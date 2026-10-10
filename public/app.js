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
const panels = { month: $('panel-month'), last: $('panel-last'), war: $('panel-war') };

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
}

function closeDrawer() {
  sideDrawer.classList.remove('open');
  drawerOverlay.classList.remove('open');
  menuToggle.setAttribute('aria-expanded', 'false');
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
  if (updateHash) {
    try {
      history.replaceState(null, '', name === 'month' ? location.pathname + location.search : `#${name}`);
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
  const h = location.hash.replace('#', '');
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
  return `<td class="member"><div class="who">${icon}<span class="who-text"><span class="name">${escapeHtml(row.name)}</span>${roleHtml}</span></div></td>`;
}

// ---------- Leaderboard component (used by This Month and Last Month) ----------
// rows: [{ rank, name, role, leagueIcon, mr, warStars, donated, raids }]
function createLeaderboard(prefix) {
  const table = $(`${prefix}-table`);
  const body = $(`${prefix}-rows`);
  const moreBtn = $(`${prefix}-more`);
  let rows = [];
  let expanded = false;

  function draw() {
    const maxMr = Math.max(1, ...rows.map((r) => r.mr || 0));
    const reserveIcon = rows.some((r) => safeIconUrl(r.leagueIcon));
    const visible = expanded ? rows : rows.slice(0, TOP_N);

    body.innerHTML = visible
      .map((r) => {
        const pct = Math.max(3, Math.round(((r.mr || 0) / maxMr) * 100));
        const rankCell = r.rank <= 3 ? crownHtml(r.rank) : r.rank;
        return `<tr class="${r.rank <= 3 ? `rank-${r.rank}` : ''}">
          <td class="rank">${rankCell}</td>
          ${memberCellHtml(r, reserveIcon)}
          <td class="num mr"><span class="mr-val">${fmt(r.mr)}</span><span class="mr-bar"><i style="width:${pct}%"></i></span></td>
          <td class="num">${fmt(r.warStars)}</td>
          <td class="num">${fmt(r.donated)}</td>
          <td class="num">${fmt(r.raids)}</td>
        </tr>`;
      })
      .join('');

    const hasMore = rows.length > TOP_N;
    moreBtn.hidden = !hasMore;
    moreBtn.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    moreBtn.textContent = expanded ? `Show top ${TOP_N}` : `Show all ${rows.length}`;
    table.hidden = rows.length === 0;
  }

  moreBtn.addEventListener('click', () => {
    expanded = !expanded;
    draw();
  });

  return {
    show(newRows) {
      rows = newRows;
      expanded = false;
      draw();
    },
    clear() {
      rows = [];
      expanded = false;
      body.innerHTML = '';
      table.hidden = true;
      moreBtn.hidden = true;
    },
  };
}

const monthBoard = createLeaderboard('member');
const lastBoard = createLeaderboard('last');

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

searchClan(DEFAULT_CLAN_TAG);

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

  monthBoard.show(
    data.members.map((m) => ({
      rank: m.mrRank,
      name: m.name,
      role: m.role,
      leagueIcon: m.leagueIcon,
      mr: m.mr,
      warStars: m.monthWarStars,
      donated: m.donations,
      raids: m.raidAttacks,
    }))
  );
}

// ---------- War tab: compact current-war card ----------
const warToggle = $('war-toggle');
const warDetail = $('war-detail');

warToggle.addEventListener('click', () => {
  const open = warToggle.getAttribute('aria-expanded') !== 'true';
  warToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  warDetail.hidden = !open;
});

function setWarCard({ headline, badge = false, expandable = false }) {
  $('war-headline').textContent = headline;
  $('war-badge').hidden = !badge;
  warToggle.disabled = !expandable;
  if (!expandable) {
    warToggle.setAttribute('aria-expanded', 'false');
    warDetail.hidden = true;
  }
}

async function fetchCurrentWar(tag) {
  const warStatus = $('war-status');
  const warTable = $('war-table');
  const warRows = $('war-rows');
  const liveDot = $('war-live-dot');

  setWarCard({ headline: 'Checking current war...' });
  warStatus.textContent = '';
  warStatus.classList.remove('error');
  warTable.hidden = true;
  liveDot.hidden = true;

  try {
    const res = await fetch(`${BACKEND_URL}/api/currentwar?tag=${encodeURIComponent(tag)}`);
    const data = await res.json();

    if (!res.ok) {
      setWarCard({ headline: 'War info unavailable' });
      warStatus.textContent = data.error || 'Could not load war data.';
      warStatus.classList.add('error');
      return;
    }

    // The pulsing dot means "a war is actively happening right now" —
    // preparation day or the war itself, not once it's ended.
    liveDot.hidden = !(data.state === 'inWar' || data.state === 'preparation');

    if (data.state === 'notInWar') {
      setWarCard({ headline: 'Not in a war right now' });
      return;
    }

    const stateLabel = { preparation: 'Prep day', inWar: 'War live', warEnded: 'War ended' }[data.state] || data.state;
    const parts = [stateLabel];
    if (data.opponentName) parts.push(`vs ${data.opponentName}`);

    const totalAttacks = (data.teamSize || data.members.length) * (data.attacksPerMember || 1);
    if (data.state !== 'preparation') {
      const used = data.members.reduce((sum, m) => sum + (m.attacksUsed || 0), 0);
      parts.push(`${used} of ${totalAttacks} attacks used`);
    }
    if (data.state === 'inWar') {
      const end = parseCocTime(data.endTime);
      const left = end ? durationLabel(end.getTime() - Date.now()) : null;
      if (left) parts.push(`ends in ${left}`);
    }

    setWarCard({ headline: parts.join(' · '), badge: !!data.isCwl, expandable: true });

    warRows.innerHTML = '';
    for (const m of data.members) {
      if (m.attacks.length === 0) {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${m.mapPosition}</td>
          <td>${escapeHtml(m.name)}</td>
          <td colspan="5"><em>No attack yet (0/${data.attacksPerMember})</em></td>
        `;
        warRows.appendChild(tr);
        continue;
      }

      m.attacks.forEach((a, i) => {
        const tr = document.createElement('tr');
        const targetCell =
          a.defenderMapPosition != null
            ? `#${a.defenderMapPosition}${a.sameMapPosition ? ' (mirror)' : ''}`
            : '—';
        const thCell =
          a.defenderTownhall != null
            ? `${a.defenderTownhall} (${a.thDelta > 0 ? '+' : ''}${a.thDelta})`
            : '—';
        tr.innerHTML = `
          <td>${i === 0 ? m.mapPosition : ''}</td>
          <td>${i === 0 ? escapeHtml(m.name) : ''}</td>
          <td>${a.order != null ? a.order : i + 1}/${data.attacksPerMember}</td>
          <td>${targetCell}</td>
          <td>${thCell}</td>
          <td>${a.stars}</td>
          <td>${a.destructionPercentage}%</td>
        `;
        warRows.appendChild(tr);
      });
    }
    warTable.hidden = false;
  } catch (err) {
    setWarCard({ headline: 'War info unavailable' });
    warStatus.textContent = 'Could not reach the server for war data.';
    warStatus.classList.add('error');
  }
}

// ---------- War tab: War History (collapsed by default) ----------
function renderHistoryRows(tbody, members) {
  tbody.innerHTML = '';
  for (const m of members) {
    const avg = m.attacks ? (m.stars / m.attacks).toFixed(1) : '0.0';
    const mirrorCell = `${m.attackedMirror} / ${m.attackedOffMirror}`;
    const thCell = `${m.attackedHigher}↑ ${m.attackedLower}↓ ${m.attackedSame}=`;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHtml(m.name)}</td>
      <td>${m.wars}</td>
      <td>${m.attacks}</td>
      <td>${m.stars}</td>
      <td>${avg}</td>
      <td>${mirrorCell}</td>
      <td>${thCell}</td>
    `;
    tbody.appendChild(tr);
  }
}

async function fetchWarHistory(tag) {
  const card = $('history-card');
  const title = $('history-title');
  const count = $('history-count');
  const historyStatus = $('history-status');
  const historyTable = $('history-table');
  const historyRows = $('history-rows');

  historyStatus.textContent = '';
  historyStatus.classList.remove('error');
  historyTable.hidden = true;
  card.open = false;

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
      historyStatus.textContent =
        'No wars recorded yet this month. Wars show up here once they finish.';
      return;
    }

    count.textContent = `${data.warsRecorded} war${data.warsRecorded === 1 ? '' : 's'}`;
    renderHistoryRows(historyRows, data.members);
    historyTable.hidden = false;
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
      lastTab.hidden = false;
      // If the page was opened straight to #last, switch to it now that it exists.
      if (hashTab() === 'last' && activeTab !== 'last') activateTab('last', { updateHash: false });
    }
  } catch (err) {
    console.error('Last month leaderboard failed:', err);
    fail();
  }
}