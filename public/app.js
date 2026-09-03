const form = document.getElementById('search-form');
const input = document.getElementById('clan-tag-input');
const statusEl = document.getElementById('status');
const clanInfo = document.getElementById('clan-info');
const clanBadge = document.getElementById('clan-badge');
const clanName = document.getElementById('clan-name');
const clanMeta = document.getElementById('clan-meta');
const table = document.getElementById('member-table');
const rowsEl = document.getElementById('member-rows');
const monthTitle = document.getElementById('month-title');
const openInGameBtn = document.getElementById('open-in-game-btn');
const oldHistorySelect = document.getElementById('old-history-select');
const menuToggle = document.getElementById('menu-toggle');
const sideDrawer = document.getElementById('side-drawer');
const drawerOverlay = document.getElementById('drawer-overlay');
const drawerTabs = document.querySelectorAll('.drawer-tab');

let currentClanTag = null;

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
  document.getElementById('drawer-panel-faq').hidden = name !== 'faq';
  document.getElementById('drawer-panel-about').hidden = name !== 'about';
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

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const tag = input.value.trim();
  if (!tag) return;
  searchClan(tag);
});

async function searchClan(tag) {
  setStatus('Searching...', false);
  clanInfo.hidden = true;
  table.hidden = true;

  try {
    const res = await fetch(`${BACKEND_URL}/api/clan?tag=${encodeURIComponent(tag)}`);
    const data = await res.json();

    if (!res.ok) {
      setStatus(data.error || 'Something went wrong.', true);
      return;
    }

    currentClanTag = data.tag;
    renderClan(data);
    setStatus(`Found ${data.memberCount} members.`, false);
    fetchCurrentWar(data.tag);
    fetchWarHistory(data.tag);
    fetchHistoryMonths(data.tag);
    fetchRaidHistoryMonths(data.tag);
  } catch (err) {
    setStatus('Could not reach the server. Is it running?', true);
  }
}

searchClan(DEFAULT_CLAN_TAG);

oldHistorySelect.addEventListener('change', () => {
  const value = oldHistorySelect.value;
  const section = document.getElementById('old-history-section');
  if (!value || !currentClanTag) {
    section.hidden = true;
    return;
  }
  fetchOldHistory(currentClanTag, value);
});

function setStatus(message, isError) {
  statusEl.textContent = message;
  statusEl.classList.toggle('error', isError);
}

function renderClan(data) {
  clanName.textContent = `${data.name} (${data.tag})`;
  let meta = `Level ${data.level} - ${data.memberCount} members`;
  if (data.raidWeekend) {
    const label = data.raidWeekend.state === 'ongoing' ? 'ongoing' : `ended ${data.raidWeekend.endLabel}`;
    meta += ` - Raid Weekend: ${label}`;
  }
  clanMeta.textContent = meta;
  if (data.badgeUrl) {
    clanBadge.src = data.badgeUrl;
    clanBadge.alt = `${data.name} badge`;
  }
  clanInfo.hidden = false;

  monthTitle.textContent = data.monthLabel || '';

  const rawTag = (data.tag || '').replace('#', '');
  if (rawTag) {
    openInGameBtn.href = `https://link.clashofclans.com/en?action=OpenClanProfile&tag=${encodeURIComponent(rawTag)}`;
    openInGameBtn.hidden = false;
  } else {
    openInGameBtn.hidden = true;
  }

  rowsEl.innerHTML = '';
  for (const m of data.members) {
    const tr = document.createElement('tr');
    if (m.mrRank === 1) tr.classList.add('rank-gold');
    else if (m.mrRank === 2) tr.classList.add('rank-silver');
    else if (m.mrRank === 3) tr.classList.add('rank-bronze');
    tr.innerHTML = `
      <td>${m.mrRank}</td>
      <td>${escapeHtml(m.name)}</td>
      <td><strong>${m.mr.toLocaleString()}</strong></td>
      <td>${m.monthWarStars.toLocaleString()}</td>
      <td>${m.donations.toLocaleString()}</td>
      <td>${m.raidAttacks.toLocaleString()}</td>
    `;
    rowsEl.appendChild(tr);
  }
  table.hidden = false;
}

async function fetchCurrentWar(tag) {
  const section = document.getElementById('war-section');
  const warStatus = document.getElementById('war-status');
  const warTable = document.getElementById('war-table');
  const warRows = document.getElementById('war-rows');
  const liveDot = document.getElementById('war-live-dot');

  section.hidden = false;
  warStatus.textContent = 'Checking current war...';
  warStatus.classList.remove('error');
  warTable.hidden = true;
  liveDot.hidden = true;

  try {
    const res = await fetch(`${BACKEND_URL}/api/currentwar?tag=${encodeURIComponent(tag)}`);
    const data = await res.json();

    if (!res.ok) {
      warStatus.textContent = data.error || 'Could not load war data.';
      warStatus.classList.add('error');
      return;
    }

    // The pulsing dot means "a war is actively happening right now" —
    // preparation day or the war itself, not once it's ended.
    liveDot.hidden = !(data.state === 'inWar' || data.state === 'preparation');

    if (data.state === 'notInWar') {
      warStatus.textContent = 'This clan is not currently in a war.';
      return;
    }

    const stateLabel =
      {
        preparation: 'Preparation day — no attacks yet.',
        inWar: 'War is live.',
        warEnded: 'War has ended.',
      }[data.state] || data.state;

    const cwlPrefix = data.isCwl ? '[CWL] ' : '';
    warStatus.textContent = data.opponentName
      ? `${cwlPrefix}${stateLabel} Opponent: ${data.opponentName}.`
      : `${cwlPrefix}${stateLabel}`;

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
    warStatus.textContent = 'Could not reach the server for war data.';
    warStatus.classList.add('error');
  }
}

// Shared by the current-month panel and the old-history (past month) panel
// — same columns, same meaning, just a different date range behind them.
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
  const section = document.getElementById('history-section');
  const title = document.getElementById('history-title');
  const historyStatus = document.getElementById('history-status');
  const historyTable = document.getElementById('history-table');
  const historyRows = document.getElementById('history-rows');

  section.hidden = false;
  historyStatus.textContent = 'Loading war history...';
  historyStatus.classList.remove('error');
  historyTable.hidden = true;

  try {
    const res = await fetch(`${BACKEND_URL}/api/war-history?tag=${encodeURIComponent(tag)}`);
    const data = await res.json();

    if (!res.ok) {
      historyStatus.textContent = data.error || 'Could not load war history.';
      historyStatus.classList.add('error');
      return;
    }

    title.textContent = `War History — ${data.monthLabel}`;

    if (data.warsRecorded === 0) {
      historyStatus.textContent =
        'No wars recorded yet this month. This app can only see wars that finished while it was running and tracking this clan — leave it running (or start it back up regularly) and this will fill in as wars wrap up.';
      return;
    }

    historyStatus.textContent = `${data.warsRecorded} war${data.warsRecorded === 1 ? '' : 's'} recorded in ${data.monthLabel} so far.`;

    renderHistoryRows(historyRows, data.members);
    historyTable.hidden = false;
  } catch (err) {
    historyStatus.textContent = 'Could not reach the server for war history.';
    historyStatus.classList.add('error');
  }
}

async function fetchHistoryMonths(tag) {
  try {
    const res = await fetch(`${BACKEND_URL}/api/history-months?tag=${encodeURIComponent(tag)}`);
    const data = await res.json();

    // Reset to just the placeholder option, then add one per past month.
    oldHistorySelect.innerHTML = '<option value="">Old History</option>';
    document.getElementById('old-history-section').hidden = true;

    if (!res.ok || !data.months || data.months.length === 0) {
      oldHistorySelect.hidden = true;
      return;
    }

    for (const m of data.months) {
      const opt = document.createElement('option');
      opt.value = `${m.year}-${m.month}`;
      opt.textContent = `${m.label}'s Stats`;
      oldHistorySelect.appendChild(opt);
    }
    oldHistorySelect.hidden = false;
  } catch (err) {
    oldHistorySelect.hidden = true;
  }
}

async function fetchOldHistory(tag, monthValue) {
  const section = document.getElementById('old-history-section');
  const title = document.getElementById('old-history-title');
  const oldStatus = document.getElementById('old-history-status');
  const oldTable = document.getElementById('old-history-table');
  const oldRows = document.getElementById('old-history-rows');

  section.hidden = false;
  title.textContent = 'Old History';
  oldStatus.textContent = 'Loading...';
  oldStatus.classList.remove('error');
  oldTable.hidden = true;

  try {
    const res = await fetch(`${BACKEND_URL}/api/war-history?tag=${encodeURIComponent(tag)}&month=${monthValue}`);
    const data = await res.json();

    if (!res.ok) {
      oldStatus.textContent = data.error || 'Could not load that month.';
      oldStatus.classList.add('error');
      return;
    }

    title.textContent = `${data.monthLabel}'s Stats`;

    if (data.warsRecorded === 0) {
      oldStatus.textContent = 'No wars recorded for this month.';
      return;
    }

    oldStatus.textContent = `${data.warsRecorded} war${data.warsRecorded === 1 ? '' : 's'} recorded.`;
    renderHistoryRows(oldRows, data.members);
    oldTable.hidden = false;
  } catch (err) {
    oldStatus.textContent = 'Could not reach the server.';
    oldStatus.classList.add('error');
  }
}

// No dropdown — this just finds the most recent past raid month (if any)
// and shows its leaderboard directly, titled with the month itself (e.g.
// "August 2026") rather than a generic "Raid Archive" label.
async function fetchRaidHistoryMonths(tag) {
  const section = document.getElementById('raid-archive-section');
  try {
    const res = await fetch(`${BACKEND_URL}/api/raid-history-months?tag=${encodeURIComponent(tag)}`);
    const data = await res.json();

    if (!res.ok || !data.months || data.months.length === 0) {
      section.hidden = true;
      return;
    }

    // Months come back most-recent-first — only the latest past month is shown.
    const latest = data.months[0];
    fetchRaidArchive(tag, `${latest.year}-${latest.month}`);
  } catch (err) {
    section.hidden = true;
  }
}

async function fetchRaidArchive(tag, monthValue) {
  const section = document.getElementById('raid-archive-section');
  const title = document.getElementById('raid-archive-title');
  const archiveStatus = document.getElementById('raid-archive-status');
  const archiveTable = document.getElementById('raid-archive-table');
  const archiveRows = document.getElementById('raid-archive-rows');

  section.hidden = false;
  archiveStatus.textContent = 'Loading...';
  archiveStatus.classList.remove('error');
  archiveTable.hidden = true;

  try {
    const res = await fetch(`${BACKEND_URL}/api/raid-history?tag=${encodeURIComponent(tag)}&month=${monthValue}`);
    const data = await res.json();

    if (!res.ok) {
      archiveStatus.textContent = data.error || 'Could not load that month.';
      archiveStatus.classList.add('error');
      return;
    }

    title.textContent = data.monthLabel;

    if (data.weekendsRecorded === 0) {
      archiveStatus.textContent = 'No raid weekends recorded for this month.';
      return;
    }

    // No caption here, same as the main leaderboard — the title alone is enough.
    archiveStatus.textContent = '';

    // Same look as the main leaderboard (#, Name, MR, War Stars, Donated,
    // Raid Attacks + gold/silver/bronze podium rows). War Stars and Donated
    // aren't tracked for past months, so those show 0 — but MR is still
    // computed from what IS known (25 pts per raid attack, same formula as
    // the live leaderboard), not just zeroed out. Since donations/war stars
    // contribute 0 for everyone here, ranking by attacks (what the backend
    // already sorts by) and ranking by MR come out identical.
    archiveRows.innerHTML = '';
    data.members.forEach((m, i) => {
      const rank = i + 1;
      const mr = m.attacks * 25;
      const tr = document.createElement('tr');
      if (rank === 1) tr.classList.add('rank-gold');
      else if (rank === 2) tr.classList.add('rank-silver');
      else if (rank === 3) tr.classList.add('rank-bronze');
      tr.innerHTML = `
        <td>${rank}</td>
        <td>${escapeHtml(m.name)}</td>
        <td><strong>${mr.toLocaleString()}</strong></td>
        <td>0</td>
        <td>0</td>
        <td>${m.attacks.toLocaleString()}</td>
      `;
      archiveRows.appendChild(tr);
    });
    archiveTable.hidden = false;
  } catch (err) {
    archiveStatus.textContent = 'Could not reach the server.';
    archiveStatus.classList.add('error');
  }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}