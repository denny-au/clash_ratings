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
const raidHistorySelect = document.getElementById('raid-history-select');

let currentClanTag = null;

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

raidHistorySelect.addEventListener('change', () => {
  const value = raidHistorySelect.value;
  const section = document.getElementById('raid-archive-section');
  if (!value || !currentClanTag) {
    section.hidden = true;
    return;
  }
  fetchRaidArchive(currentClanTag, value);
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

  section.hidden = false;
  warStatus.textContent = 'Checking current war...';
  warStatus.classList.remove('error');
  warTable.hidden = true;

  try {
    const res = await fetch(`${BACKEND_URL}/api/currentwar?tag=${encodeURIComponent(tag)}`);
    const data = await res.json();

    if (!res.ok) {
      warStatus.textContent = data.error || 'Could not load war data.';
      warStatus.classList.add('error');
      return;
    }

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

    warStatus.textContent = data.opponentName ? `${stateLabel} Opponent: ${data.opponentName}.` : stateLabel;

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

async function fetchRaidHistoryMonths(tag) {
  try {
    const res = await fetch(`${BACKEND_URL}/api/raid-history-months?tag=${encodeURIComponent(tag)}`);
    const data = await res.json();

    // Reset to just the placeholder option, then add one per past month.
    raidHistorySelect.innerHTML = '<option value="">Raid Archive</option>';
    document.getElementById('raid-archive-section').hidden = true;

    if (!res.ok || !data.months || data.months.length === 0) {
      raidHistorySelect.hidden = true;
      return;
    }

    for (const m of data.months) {
      const opt = document.createElement('option');
      opt.value = `${m.year}-${m.month}`;
      opt.textContent = m.label;
      raidHistorySelect.appendChild(opt);
    }
    raidHistorySelect.hidden = false;
  } catch (err) {
    raidHistorySelect.hidden = true;
  }
}

async function fetchRaidArchive(tag, monthValue) {
  const section = document.getElementById('raid-archive-section');
  const title = document.getElementById('raid-archive-title');
  const archiveStatus = document.getElementById('raid-archive-status');
  const archiveTable = document.getElementById('raid-archive-table');
  const archiveRows = document.getElementById('raid-archive-rows');

  section.hidden = false;
  title.textContent = 'Raid Archive';
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

    title.textContent = `Raid Archive — ${data.monthLabel}`;

    if (data.weekendsRecorded === 0) {
      archiveStatus.textContent = 'No raid weekends recorded for this month.';
      return;
    }

    archiveStatus.textContent = `${data.weekendsRecorded} raid weekend${data.weekendsRecorded === 1 ? '' : 's'} recorded.`;

    archiveRows.innerHTML = '';
    for (const m of data.members) {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${escapeHtml(m.name)}</td>
        <td>${m.weekends}</td>
        <td>${m.attacks.toLocaleString()}</td>
      `;
      archiveRows.appendChild(tr);
    }
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