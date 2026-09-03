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

// --- Clan War League (CWL) tracking ---
//
// CWL doesn't show up through /currentwar at all — Supercell runs it as a
// separate system: /clans/{tag}/currentwar/leaguegroup gives the group
// (which clans, which rounds), and each round's individual war lives at
// /clanwarleagues/wars/{warTag}. A finished CWL war is fed through the
// exact same warTracker.recordWarIfNew used for regular wars — same
// per-attack town-hall-adjusted MR math, same storage — so CWL stars just
// add onto the same monthly War Stars total with no separate tracking.
const CWL_LIVE_CACHE_TTL_MS = 30 * 1000; // matches currentWarCache — feel live
// Shared by both processCwlForClan and fetchCurrentCwlWar (see
// scanCwlForClan below) so they can never disagree about what's live.
const cwlScanCache = makeCache(CWL_LIVE_CACHE_TTL_MS);
const CWL_WAR_FETCH_CACHE_TTL_MS = 3 * 60 * 1000;
const cwlWarFetchCache = makeCache(CWL_WAR_FETCH_CACHE_TTL_MS);
// War tags we've already confirmed are finished and recorded (or found to
// already be recorded) — avoids re-fetching+re-checking the same finished
// CWL war on every poll for the rest of the season. In-memory only: worst
// case after a restart is a handful of harmless re-fetches that land on
// warTracker's own endTime-based dedupe and do nothing.
const recordedCwlWarTags = new Set();

async function fetchCwlGroup(tag) {
  try {
    const encoded = encodeURIComponent(tag);
    const r = await fetch(`${COC_BASE}/clans/${encoded}/currentwar/leaguegroup`, {
      headers: authHeaders(),
    });
    // 404 here just means "no CWL running right now" — true most of the
    // month, not an error.
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

async function fetchCwlWar(warTag) {
  const cached = cwlWarFetchCache.get(warTag);
  if (cached !== undefined) return cached;
  try {
    const encoded = encodeURIComponent(warTag);
    const r = await fetch(`${COC_BASE}/clanwarleagues/wars/${encoded}`, {
      headers: authHeaders(),
    });
    if (!r.ok) return null;
    const data = await r.json();
    cwlWarFetchCache.set(warTag, data);
    return data;
  } catch {
    return null;
  }
}

// The raw CWL war payload doesn't promise which side ("clan" vs
// "opponent") is us — normalize so warData.clan is always our own clan,
// matching the shape the rest of this app (annotateMembers,
// recordWarIfNew) already assumes from the regular /currentwar endpoint.
function orientCwlWar(warData, ourTag) {
  if (!warData) return null;
  if (warData.clan && warData.clan.tag === ourTag) return warData;
  if (warData.opponent && warData.opponent.tag === ourTag) {
    return { ...warData, clan: warData.opponent, opponent: warData.clan };
  }
  return null; // neither side matches — shouldn't happen, but don't guess
}

// Single shared scan of the clan's CWL group, used by BOTH processCwlForClan
// (War Stars/MR merge on /api/clan) and fetchCurrentCwlWar (the "Current
// War" view on /api/currentwar). Earlier these had two separate 30s caches
// populated independently by whichever endpoint got hit first — meaning the
// leaderboard and the live war view could each be looking at a scan taken
// at a slightly different moment and disagree with each other. One shared
// cache means both always see the exact same scan.
//
// Also wraps each individual war-tag fetch in its own try/catch: a CWL
// group has one war tag per clan pairing per round (e.g. 4 tags x 7 rounds
// for an 8-clan group), and only one of those ~28 tags is ever actually
// ours — a single malformed/failed response among the other clans'
// pairings must never be able to stop the scan before it reaches our own
// live round.
async function scanCwlForClan(tag) {
  const cached = cwlScanCache.get(tag);
  if (cached !== undefined) return cached;

  let liveStatsByTag = new Map();
  let activeWar = null;
  try {
    const group = await fetchCwlGroup(tag);
    if (group && group.state && group.state !== 'notInWar') {
      const warTags = (group.rounds || [])
        .flatMap((round) => round.warTags || [])
        .filter((t) => t && t !== '#0');

      for (const warTag of warTags) {
        if (recordedCwlWarTags.has(warTag)) continue;
        try {
          const raw = await fetchCwlWar(warTag);
          const warData = orientCwlWar(raw, tag);
          if (!warData) continue;

          if (warData.state === 'warEnded') {
            await warTracker.recordWarIfNew(tag, warData);
            recordedCwlWarTags.add(warTag); // done with this one for good
          } else if (warData.state === 'inWar' || warData.state === 'preparation') {
            const liveAnnotated = warTracker.annotateMembers(warData);
            const liveSummary = warTracker.summarizeByMember([{ members: liveAnnotated }]);
            for (const s of liveSummary) liveStatsByTag.set(s.tag, s);
            if (!activeWar) activeWar = warData; // only one round is ever active for a clan at a time
          }
        } catch (warErr) {
          console.error(`CWL war ${warTag} check failed:`, warErr.message);
        }
      }
    }
  } catch (err) {
    console.error('CWL check failed:', err.message);
  }

  const result = { liveStatsByTag, activeWar };
  cwlScanCache.set(tag, result);
  return result;
}

// Records any finished CWL war round we haven't seen yet (so it lands in
// the same war history/War Stars total as regular wars), and returns live
// per-member star stats for whichever CWL war is happening right now
// (inWar/preparation), if any — same "counts once, live or recorded" idea
// as regular wars.
async function processCwlForClan(tag) {
  const { liveStatsByTag } = await scanCwlForClan(tag);
  return liveStatsByTag;
}

// The clan's regular /currentwar endpoint goes quiet ("notInWar") for the
// entire week a clan is in Clan War League — CWL runs as a separate system
// (see the comment above fetchCwlGroup), so without this, the "Current War"
// section and its live dot would look empty all week during CWL even
// though a war is actively happening. Returns the oriented war payload
// (same shape /currentwar itself returns) for whichever CWL round is
// in-progress right now, or null if the clan isn't in CWL / no round is
// currently active.
async function fetchCurrentCwlWar(tag) {
  const { activeWar } = await scanCwlForClan(tag);
  return activeWar;
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
      raidAttacks: 0, // filled in below — stacks across the whole month, see below
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

    // Clan War League runs alongside/instead of regular wars for about a
    // week each month. This also records any newly-finished CWL round into
    // the same war history used above, and hands back live stats for
    // whichever CWL war is happening right now — merged additively into
    // liveStatsByTag so CWL stars land in the exact same War Stars total
    // and MR math as regular wars, live or recorded either way.
    const cwlLiveStatsByTag = await processCwlForClan(tag);
    for (const [cwlTag, cwlStats] of cwlLiveStatsByTag) {
      const existing = liveStatsByTag.get(cwlTag);
      if (existing) {
        liveStatsByTag.set(cwlTag, {
          ...existing,
          stars: existing.stars + cwlStats.stars,
          warStarMR: existing.warStarMR + cwlStats.warStarMR,
        });
      } else {
        liveStatsByTag.set(cwlTag, cwlStats);
      }
    }

    const monthWars = await warTracker.getHistoryForClanInMonth(tag, currentYear, currentMonth);
    const monthSummary = warTracker.summarizeByMember(monthWars);
    const monthStatsByTag = new Map(monthSummary.map((s) => [s.tag, s]));

    const raidSeason = await fetchLatestRaidSeason(tag);

    // Same live/recorded split as war stars above: a raid weekend counts
    // once — while it's ongoing its attacks are live (below), the moment
    // it ends this records it into raid history, so the monthly total
    // never double-counts and never briefly disappears in between.
    let liveRaidByTag = new Map();
    if (raidSeason && raidSeason.state === 'ended') {
      await warTracker.recordRaidSeasonIfNew(tag, raidSeason);
    } else if (raidSeason && raidSeason.state === 'ongoing') {
      liveRaidByTag = new Map((raidSeason.members || []).map((m) => [m.tag, m.attacks || 0]));
    }

    const monthRaidSeasons = await warTracker.getRaidHistoryForClanInMonth(tag, currentYear, currentMonth);
    const monthRaidSummary = warTracker.summarizeRaidByMember(monthRaidSeasons);
    const monthRaidByTag = new Map(monthRaidSummary.map((s) => [s.tag, s.attacks]));

    // MR (Member Rating) — this site's main ranking. 1 point per donation,
    // 25 per raid attack this month, and this month's war stars weighted
    // by how much harder/easier the target's town hall was (see
    // warTracker's warStarMrMultiplier for the exact table).
    members.forEach((m) => {
      const monthStats = monthStatsByTag.get(m.tag);
      const liveStats = liveStatsByTag.get(m.tag);
      const recordedStars = monthStats ? monthStats.stars : 0;
      const recordedWarStarMR = monthStats ? monthStats.warStarMR : 0;
      const liveStars = liveStats ? liveStats.stars : 0;
      const liveWarStarMR = liveStats ? liveStats.warStarMR : 0;
      m.monthWarStars = recordedStars + liveStars;
      const warStarMR = recordedWarStarMR + liveWarStarMR;

      const recordedRaidAttacks = monthRaidByTag.get(m.tag) || 0;
      const liveRaidAttacks = liveRaidByTag.get(m.tag) || 0;
      m.raidAttacks = recordedRaidAttacks + liveRaidAttacks;

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

    let warData = data;
    let isCwl = false;
    if (warData.state === 'notInWar') {
      // Regular war log is empty — check whether a Clan War League round
      // is live instead (see fetchCurrentCwlWar).
      const cwlWar = await fetchCurrentCwlWar(tag);
      if (cwlWar) {
        warData = cwlWar;
        isCwl = true;
      }
    }

    if (warData.state === 'notInWar') {
      return res.json({ state: 'notInWar' });
    }

    // Same per-attack annotation (mirror match, town hall difference) used
    // for saved war history, so the live view and history agree.
    const members = warTracker
      .annotateMembers(warData)
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
      state: warData.state,
      teamSize: warData.teamSize,
      attacksPerMember: warData.attacksPerMember || (isCwl ? 1 : 2),
      opponentName: warData.opponent ? warData.opponent.name : null,
      endTime: warData.endTime || null,
      isCwl,
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

// Aggregated per-member raid attacks for one calendar month. Same
// month-default/?month=YYYY-MM pattern as /api/war-history. Raid history
// only ever covers the current month plus the previous one — anything
// older is pruned automatically (see warTracker.js), so a request for an
// older month will just come back with zero weekends recorded.
app.get('/api/raid-history', async (req, res) => {
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

  const seasons = await warTracker.getRaidHistoryForClanInMonth(tag, year, month);
  const members = warTracker.summarizeRaidByMember(seasons);

  res.json({
    year,
    month,
    monthLabel: warTracker.monthLabel(year, month),
    isCurrentMonth: year === now.getFullYear() && month === now.getMonth() + 1,
    weekendsRecorded: seasons.length,
    members,
  });
});

// Past calendar months that have at least one recorded raid weekend for
// this clan — what populates the "Raid Archive" dropdown. In practice
// this will only ever list last month, since older raid data is erased.
app.get('/api/raid-history-months', async (req, res) => {
  const tag = normalizeTag(req.query.tag);
  if (!tag || tag.length < 2) {
    return res.status(400).json({ error: 'Please provide a clan tag, e.g. #2Y8V0YLQ' });
  }
  const months = await warTracker.getPastRaidMonthsWithData(tag);
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

// Same idea as pollTrackedClanForWarEnd, but for the tracked clan's Capital
// Raid Weekend — so a finished weekend gets recorded into raid history even
// if nobody has the page open right when it ends.
async function pollTrackedClanForRaidEnd() {
  if (!API_KEY) return;
  const tag = await warTracker.getTrackedTag();
  if (!tag) return;

  try {
    const encodedTag = encodeURIComponent(tag);
    const response = await fetch(`${COC_BASE}/clans/${encodedTag}/capitalraidseasons?limit=1`, {
      headers: authHeaders(),
    });
    if (!response.ok) return; // rate limited, etc. — just skip this round
    const data = await response.json();
    const items = data.items || [];
    const season = items.length ? items[0] : null;
    if (season && season.state === 'ended') {
      const recorded = await warTracker.recordRaidSeasonIfNew(tag, season);
      if (recorded) {
        console.log(`Recorded a finished raid weekend for ${tag}.`);
      }
    }
  } catch (err) {
    console.error('Background raid poll failed:', err.message);
  }
}

// Same idea again, but for Clan War League — checks the tracked clan's CWL
// group (if a season is running) and records any round that just ended,
// same as processCwlForClan does on a page load, so CWL history builds up
// even if nobody visits the site while a round wraps up.
async function pollTrackedClanForCwl() {
  if (!API_KEY) return;
  const tag = await warTracker.getTrackedTag();
  if (!tag) return;
  await processCwlForClan(tag);
}

app.listen(PORT, () => {
  console.log(`Clash Ratings running at http://localhost:${PORT}`);
  if (!API_KEY) {
    console.warn('Warning: COC_API_KEY is not set. Copy .env.example to .env and add your key.');
  }
  setTimeout(pollTrackedClanForWarEnd, 5000);
  setTimeout(pollTrackedClanForRaidEnd, 7000);
  setTimeout(pollTrackedClanForCwl, 9000);
  setInterval(pollTrackedClanForWarEnd, POLL_INTERVAL_MINUTES * 60 * 1000);
  setInterval(pollTrackedClanForRaidEnd, POLL_INTERVAL_MINUTES * 60 * 1000);
  setInterval(pollTrackedClanForCwl, POLL_INTERVAL_MINUTES * 60 * 1000);
});
