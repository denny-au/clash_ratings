require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const warTracker = require('./warTracker');

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.COC_API_KEY;
const COC_BASE = 'https://api.clashofclans.com/v1';
const POLL_INTERVAL_MINUTES = Number(process.env.POLL_INTERVAL_MINUTES) || 15;

// When the frontend is hosted separately (e.g. GitHub Pages) it calls this
// server's API from a different origin, so the browser needs CORS headers
// to allow it. Everything here is read-only clan data (no auth, no
// per-user writes, the API key never leaves the server), so a wide-open
// origin is safe — there's nothing sensitive a stranger's browser could do
// with these endpoints beyond what anyone could already see in-game.
app.use(cors());

app.use(express.static(path.join(__dirname, 'public')));

// Turns "2y8v0ylq", "#2y8v0ylq", " #2Y8V0YLQ " into a clean "#2Y8V0YLQ"
function normalizeTag(raw) {
  if (!raw) return null;
  let tag = raw.trim().toUpperCase();
  if (!tag.startsWith('#')) tag = '#' + tag;
  return tag;
}

function authHeaders() {
  return {
    Authorization: `Bearer ${API_KEY}`,
    Accept: 'application/json',
  };
}

// Tiny in-memory cache with a TTL, so re-searching the same clan a minute
// later doesn't re-fetch it from scratch. Lost on server restart, which is
// fine: it's a speed-up, not a source of truth.
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
function makeCache(ttlMs) {
  const store = new Map();
  return {
    get(key) {
      const entry = store.get(key);
      if (entry && entry.expiresAt > Date.now()) return entry.value;
      return undefined;
    },
    set(key, value) {
      store.set(key, { value, expiresAt: Date.now() + ttlMs });
    },
  };
}
const raidSeasonCache = makeCache(CACHE_TTL_MS);
// Current war is cached only briefly — it needs to feel live, not just fast.
const CURRENT_WAR_CACHE_TTL_MS = 30 * 1000; // 30 seconds
const currentWarCache = makeCache(CURRENT_WAR_CACHE_TTL_MS);

// Raw /currentwar payload for a clan, cached briefly. Returns null on any
// failure (private war log, bad key, network hiccup, etc.) so a currentwar
// problem never breaks the rest of the clan search — it just means live war
// stars won't be merged in for this request.
async function fetchCurrentWarRaw(tag) {
  const cached = currentWarCache.get(tag);
  if (cached !== undefined) return cached;
  try {
    const encoded = encodeURIComponent(tag);
    const r = await fetch(`${COC_BASE}/clans/${encoded}/currentwar`, {
      headers: authHeaders(),
    });
    if (!r.ok) return null;
    const data = await r.json();
    currentWarCache.set(tag, data);
    return data;
  } catch {
    return null;
  }
}

// Most recent Capital Raid Weekend season for a clan (ongoing or just
// ended), including per-member attack counts. Returns null on any failure
// so a raid-data hiccup never breaks the rest of the clan search.
async function fetchLatestRaidSeason(tag) {
  const cached = raidSeasonCache.get(tag);
  if (cached !== undefined) return cached;
  try {
    const encoded = encodeURIComponent(tag);
    const r = await fetch(`${COC_BASE}/clans/${encoded}/capitalraidseasons?limit=1`, {
      headers: authHeaders(),
    });
    if (!r.ok) return null;
    const data = await r.json();
    const items = data.items || [];
    // Defensive: make sure we really have the newest one, in case ordering isn't guaranteed.
    items.sort((a, b) => (a.startTime < b.startTime ? 1 : -1));
    const result = items.length ? items[0] : null;
    raidSeasonCache.set(tag, result);
    return result;
  } catch {
    return null;
  }
}

function describeRaidWeekend(season) {
  if (!season) return null;
  const end = warTracker.parseClashTimestamp(season.endTime);
  return {
    state: season.state, // 'ongoing' | 'ended'
    endLabel: end ? end.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : null,
  };
}

app.get('/api/clan', async (req, res) => {
  if (!API_KEY) {
    return res.status(500).json({
      error: 'Server is missing COC_API_KEY. Copy .env.example to .env and add your key.',
    });
  }

  const tag = normalizeTag(req.query.tag);
  if (!tag || tag.length < 2) {
    return res.status(400).json({ error: 'Please provide a clan tag, e.g. #2Y8V0YLQ' });
  }

  const encodedTag = encodeURIComponent(tag); // '#' -> '%23'

  try {
    const response = await fetch(`${COC_BASE}/clans/${encodedTag}`, {
      headers: authHeaders(),
    });

    if (response.status === 403) {
      return res.status(403).json({
        error:
          'Supercell rejected this request (403). Your API key is likely locked to a different IP address than this server is currently using. Regenerate the key at developer.clashofclans.com for your current IP.',
      });
    }
    if (response.status === 404) {
      return res.status(404).json({ error: `No clan found for tag ${tag}.` });
    }
    if (response.status === 429) {
      return res.status(429).json({ error: 'Rate limited by the Clash of Clans API. Try again shortly.' });
    }
    if (!response.ok) {
      const text = await response.text();
      return res.status(response.status).json({ error: `Clash of Clans API error: ${text}` });
    }

    const data = await response.json();

    // Shape a clean payload for the frontend
    const members = (data.memberList || []).map((m) => ({
      tag: m.tag,
      name: m.name,
      donations: m.donations,
      clanRank: m.clanRank,
      monthWarStars: 0, // filled in below
      raidAttacks: 0, // filled in below
      raidAttacksMax: null,
      mr: 0, // filled in below
    }));

    // This month's war stars (and their MR value) come from our own
    // recorded history (local file, no extra API calls — Supercell has no
    // "war stars this month" endpoint to call anyway). Only the raid
    // season needs a live request.
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    // Fold in the war happening right now, if any, so War Stars/MR don't
    // wait for the background poller (up to POLL_INTERVAL_MINUTES) to catch
    // up. A war can only ever count once: while it's live it's counted via
    // liveStatsByTag below (never in monthStatsByTag, since recordWarIfNew
    // requires state === 'warEnded'); the moment it ends, we record it
    // immediately here — before reading monthWars — so it moves straight
    // into the "recorded" bucket in this very request instead of briefly
    // counting nowhere.
    let liveStatsByTag = new Map();
    const currentWarData = await fetchCurrentWarRaw(tag);
    if (currentWarData && currentWarData.state === 'warEnded') {
      await warTracker.recordWarIfNew(tag, currentWarData);
    } else if (currentWarData && (currentWarData.state === 'inWar' || currentWarData.state === 'preparation')) {
      const liveAnnotated = warTracker.annotateMembers(currentWarData);
      const liveSummary = warTracker.summarizeByMember([{ members: liveAnnotated }]);
      liveStatsByTag = new Map(liveSummary.map((s) => [s.tag, s]));
    }

    const monthWars = await warTracker.getHistoryForClanInMonth(tag, currentYear, currentMonth);
    const monthSummary = warTracker.summarizeByMember(monthWars);
    const monthStatsByTag = new Map(monthSummary.map((s) => [s.tag, s]));

    const raidSeason = await fetchLatestRaidSeason(tag);

    const raidMemberByTag = new Map();
    for (const rm of (raidSeason && raidSeason.members) || []) {
      raidMemberByTag.set(rm.tag, rm);
    }

    // MR (Member Rating) — this site's main ranking. 1 point per donation,
    // 25 per raid weekend attack, and this month's war stars weighted by
    // how much harder/easier the target's town hall was (see warTracker's
    // warStarMrMultiplier for the exact table).
    members.forEach((m) => {
      const monthStats = monthStatsByTag.get(m.tag);
      const liveStats = liveStatsByTag.get(m.tag);
      const recordedStars = monthStats ? monthStats.stars : 0;
      const recordedWarStarMR = monthStats ? monthStats.warStarMR : 0;
      const liveStars = liveStats ? liveStats.stars : 0;
      const liveWarStarMR = liveStats ? liveStats.warStarMR : 0;
      m.monthWarStars = recordedStars + liveStars;
      const warStarMR = recordedWarStarMR + liveWarStarMR;

      const rm = raidMemberByTag.get(m.tag);
      if (rm) {
        m.raidAttacks = rm.attacks;
        m.raidAttacksMax = rm.attackLimit + rm.bonusAttackLimit;
      }

      const donationMR = m.donations * 1;
      const raidMR = m.raidAttacks * 25;
      m.mr = Math.round(donationMR + raidMR + warStarMR);
    });

    // MR is the main ranking for this site — sort by it, highest first.
    members.sort((a, b) => b.mr - a.mr);
    members.forEach((m, i) => {
      m.mrRank = i + 1;
    });

    // Remember this as the clan to auto-poll for war history in the background.
    await warTracker.setTrackedTag(data.tag);

    res.json({
      tag: data.tag,
      name: data.name,
      level: data.clanLevel,
      memberCount: data.members,
      badgeUrl: data.badgeUrls ? data.badgeUrls.medium : null,
      raidWeekend: describeRaidWeekend(raidSeason),
      monthLabel: warTracker.monthLabel(currentYear, currentMonth),
      members,
    });
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: 'Could not reach the Clash of Clans API. Check your network connection.' });
  }
});

// Per-member stars earned in the clan's current war (only meaningful while
// a war is actually happening; requires the clan's war log to be public).
app.get('/api/currentwar', async (req, res) => {
  if (!API_KEY) {
    return res.status(500).json({
      error: 'Server is missing COC_API_KEY. Copy .env.example to .env and add your key.',
    });
  }

  const tag = normalizeTag(req.query.tag);
  if (!tag || tag.length < 2) {
    return res.status(400).json({ error: 'Please provide a clan tag, e.g. #2Y8V0YLQ' });
  }

  const encodedTag = encodeURIComponent(tag);

  try {
    const response = await fetch(`${COC_BASE}/clans/${encodedTag}/currentwar`, {
      headers: authHeaders(),
    });

    if (response.status === 403) {
      // Supercell returns 403 both for a bad key/IP and for a clan that has
      // its war log set to private — tell them apart using the reason code.
      const body = await response.json().catch(() => ({}));
      const isIpIssue = (body.reason || '').includes('invalidIp');
      return res.status(403).json({
        error: isIpIssue
          ? 'Supercell rejected this request (403). Your API key is likely locked to a different IP address than this server is currently using. Regenerate the key at developer.clashofclans.com for your current IP.'
          : "This clan's war log is set to private, so current war data isn't available through the public API.",
      });
    }
    if (response.status === 404) {
      return res.status(404).json({ error: `No war data found for ${tag}.` });
    }
    if (response.status === 429) {
      return res.status(429).json({ error: 'Rate limited by the Clash of Clans API. Try again shortly.' });
    }
    if (!response.ok) {
      const text = await response.text();
      return res.status(response.status).json({ error: `Clash of Clans API error: ${text}` });
    }

    const data = await response.json();

    // If this war just concluded, save it to history (no-op if we already
    // have it, or if the war isn't finished yet).
    await warTracker.recordWarIfNew(tag, data);

    if (data.state === 'notInWar') {
      return res.json({ state: 'notInWar' });
    }

    // Same per-attack annotation (mirror match, town hall difference) used
    // for saved war history, so the live view and history agree.
    const members = warTracker
      .annotateMembers(data)
      .slice()
      .sort((a, b) => a.mapPosition - b.mapPosition)
      .map((m) => ({
        tag: m.tag,
        name: m.name,
        mapPosition: m.mapPosition,
        attacksUsed: m.attacks.length,
        starsEarned: m.attacks.reduce((sum, a) => sum + a.stars, 0),
        bestDestruction: m.attacks.length ? Math.max(...m.attacks.map((a) => a.destructionPercentage)) : null,
        attacks: m.attacks,
      }));

    res.json({
      state: data.state,
      teamSize: data.teamSize,
      attacksPerMember: data.attacksPerMember || 2,
      opponentName: data.opponent ? data.opponent.name : null,
      endTime: data.endTime || null,
      members,
    });
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: 'Could not reach the Clash of Clans API. Check your network connection.' });
  }
});

// Aggregated per-member war history for one calendar month. Defaults to
// the current month; pass ?month=YYYY-MM for a past one (see
// /api/history-months for which past months actually have data). Only
// covers wars this server has actually recorded (from the moment it
// started tracking this clan onward) — the Clash of Clans API itself
// doesn't retain per-member attack detail for wars once they're no longer
// "current", so there's no way to backfill history from before tracking
// started.
app.get('/api/war-history', async (req, res) => {
  const tag = normalizeTag(req.query.tag);
  if (!tag || tag.length < 2) {
    return res.status(400).json({ error: 'Please provide a clan tag, e.g. #2Y8V0YLQ' });
  }

  const now = new Date();
  let year = now.getFullYear();
  let month = now.getMonth() + 1;
  const requested = /^(\d{4})-(\d{1,2})$/.exec(req.query.month || '');
  if (requested) {
    year = Number(requested[1]);
    month = Number(requested[2]);
  }

  const wars = await warTracker.getHistoryForClanInMonth(tag, year, month);
  const members = warTracker.summarizeByMember(wars);

  res.json({
    year,
    month,
    monthLabel: warTracker.monthLabel(year, month),
    isCurrentMonth: year === now.getFullYear() && month === now.getMonth() + 1,
    warsRecorded: wars.length,
    wars: wars
      .slice()
      .sort((a, b) => new Date(b.endTime) - new Date(a.endTime))
      .map((w) => ({ opponentName: w.opponentName, result: w.result, endTime: w.endTime })),
    members,
  });
});

// Past calendar months that have at least one recorded war for this clan —
// what populates the "Old History" dropdown.
app.get('/api/history-months', async (req, res) => {
  const tag = normalizeTag(req.query.tag);
  if (!tag || tag.length < 2) {
    return res.status(400).json({ error: 'Please provide a clan tag, e.g. #2Y8V0YLQ' });
  }
  const months = await warTracker.getPastMonthsWithData(tag);
  res.json({ months });
});

// Checks the tracked clan's current war and, if it just ended, records it.
// Runs once shortly after startup and then on a timer, so history builds up
// even if nobody has the page open when a war finishes.
async function pollTrackedClanForWarEnd() {
  if (!API_KEY) return;
  const tag = await warTracker.getTrackedTag();
  if (!tag) return;

  try {
    const encodedTag = encodeURIComponent(tag);
    const response = await fetch(`${COC_BASE}/clans/${encodedTag}/currentwar`, {
      headers: authHeaders(),
    });
    if (!response.ok) return; // private war log, rate limited, etc. — just skip this round
    const data = await response.json();
    const recorded = await warTracker.recordWarIfNew(tag, data);
    if (recorded) {
      console.log(`Recorded a finished war for ${tag} vs ${data.opponent ? data.opponent.name : 'unknown'}.`);
    }
  } catch (err) {
    console.error('Background war poll failed:', err.message);
  }
}

app.listen(PORT, () => {
  console.log(`Clash Ratings running at http://localhost:${PORT}`);
  if (!API_KEY) {
    console.warn('Warning: COC_API_KEY is not set. Copy .env.example to .env and add your key.');
  }
  setTimeout(pollTrackedClanForWarEnd, 5000);
  setInterval(pollTrackedClanForWarEnd, POLL_INTERVAL_MINUTES * 60 * 1000);
});
