// Small store for war history — two backends, picked automatically:
//
// 1. Local JSON files under data/ (the default). Simple, no setup, but the
//    files have to live on a disk that actually survives restarts.
// 2. GitHub, via the Contents API, writing to the same repo this project
//    lives in — used automatically when GITHUB_TOKEN + GITHUB_REPO are set.
//    This exists for hosts with an ephemeral/free-tier filesystem (e.g.
//    Render's free web services wipe local disk on every idle spin-down):
//    storing the data in the repo instead sidesteps that entirely, at $0
//    extra cost, since it's not sitting on the compute instance at all.
//
// Either way, callers just use loadData/saveData below and don't need to
// care which backend is active.
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

// --- Local file backend (default) ---
// Defaults to a local "data" folder next to this file. When deployed on a
// host with a persistent disk mounted somewhere specific (e.g. Render's
// paid disks), set DATA_DIR to that mount path so history survives
// restarts/redeploys instead of living on the container's throwaway disk.
// Irrelevant when the GitHub backend is active (see below).
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readJsonFile(fileName, fallback) {
  const file = path.join(DATA_DIR, fileName);
  ensureDataDir();
  if (!fs.existsSync(file)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJsonFile(fileName, data) {
  const file = path.join(DATA_DIR, fileName);
  ensureDataDir();
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// --- GitHub backend (used when configured) ---
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPO = process.env.GITHUB_REPO; // "yourname/clash-ratings"
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || 'main';
const GITHUB_DATA_DIR = process.env.GITHUB_DATA_DIR || 'data'; // path *inside* the repo
const useGitHubStorage = Boolean(GITHUB_TOKEN && GITHUB_REPO);

// Kept warm for the life of the process so repeat reads within one "awake"
// stretch don't hit the GitHub API every time — only the first read per
// file, and every write, actually make a request. `sha` is GitHub's blob
// hash for the file's current version, required to update (not create) it.
const githubCache = new Map(); // repoPath -> { data, sha }

function githubHeaders(extra) {
  return {
    Authorization: `Bearer ${GITHUB_TOKEN}`,
    Accept: 'application/vnd.github+json',
    ...extra,
  };
}

async function githubReadFile(fileName, fallback) {
  const repoPath = `${GITHUB_DATA_DIR}/${fileName}`;
  if (githubCache.has(repoPath)) return githubCache.get(repoPath).data;
  try {
    const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/${repoPath}?ref=${GITHUB_BRANCH}`;
    const r = await fetch(url, { headers: githubHeaders() });
    if (r.status === 404) {
      // File doesn't exist in the repo yet — normal on a fresh install.
      githubCache.set(repoPath, { data: fallback, sha: null });
      return fallback;
    }
    if (!r.ok) throw new Error(`GitHub API returned ${r.status}`);
    const body = await r.json();
    const text = Buffer.from(body.content, 'base64').toString('utf8');
    const data = JSON.parse(text);
    githubCache.set(repoPath, { data, sha: body.sha });
    return data;
  } catch (err) {
    console.error(`Could not read ${repoPath} from GitHub, using empty data for now:`, err.message);
    return fallback;
  }
}

async function githubWriteFile(fileName, data, message) {
  const repoPath = `${GITHUB_DATA_DIR}/${fileName}`;
  const cached = githubCache.get(repoPath);
  try {
    const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/${repoPath}`;
    const requestBody = {
      message,
      content: Buffer.from(JSON.stringify(data, null, 2), 'utf8').toString('base64'),
      branch: GITHUB_BRANCH,
    };
    if (cached && cached.sha) requestBody.sha = cached.sha;
    const r = await fetch(url, {
      method: 'PUT',
      headers: githubHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(requestBody),
    });
    if (!r.ok) throw new Error(`GitHub API returned ${r.status}`);
    const result = await r.json();
    githubCache.set(repoPath, { data, sha: result.content.sha });
  } catch (err) {
    // Don't crash the request over a persistence hiccup — just keep the
    // in-memory copy for the rest of this process's life and log it. Worst
    // case this one update doesn't make it to GitHub and is lost the next
    // time the process restarts.
    console.error(`Could not save ${repoPath} to GitHub:`, err.message);
    githubCache.set(repoPath, { data, sha: cached ? cached.sha : null });
  }
}

// --- Unified interface the rest of this file uses ---
async function loadData(fileName, fallback) {
  return useGitHubStorage ? githubReadFile(fileName, fallback) : readJsonFile(fileName, fallback);
}

async function saveData(fileName, data, message) {
  return useGitHubStorage ? githubWriteFile(fileName, data, message) : writeJsonFile(fileName, data);
}

const HISTORY_FILE = 'war-history.json';
const CONFIG_FILE = 'config.json';

// Clash's API returns timestamps like "20260815T183000.000Z" (ISO 8601
// "basic" format, no dashes/colons). Convert to something Date() reliably
// parses across Node versions rather than trusting it with the raw string.
function parseClashTimestamp(raw) {
  if (!raw) return null;
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(?:\.(\d+))?Z$/.exec(raw);
  if (!m) {
    const fallback = new Date(raw);
    return isNaN(fallback.getTime()) ? null : fallback;
  }
  const [, y, mo, d, h, mi, s, ms] = m;
  const millis = (ms || '000').padEnd(3, '0').slice(0, 3);
  const iso = `${y}-${mo}-${d}T${h}:${mi}:${s}.${millis}Z`;
  const parsed = new Date(iso);
  return isNaN(parsed.getTime()) ? null : parsed;
}

async function getTrackedTag() {
  const config = await loadData(CONFIG_FILE, {});
  return config.trackedTag || null;
}

async function setTrackedTag(tag) {
  const config = await loadData(CONFIG_FILE, {});
  if (config.trackedTag === tag) return; // no-op if unchanged — avoids a write (and, on the
  // GitHub backend, a commit) on every single page load when it's the same clan as last time.
  config.trackedTag = tag;
  await saveData(CONFIG_FILE, config, `Track clan ${tag}`);
}

// Takes a raw /currentwar (or recorded-war) payload and returns each clan
// member with their attacks annotated with who they actually hit: the
// defender's town hall (and the difference vs. the attacker's own), and
// whether it was their assigned "mirror" (same war map number) or not.
// Shared by the live current-war view and by what gets saved to history,
// so both show the exact same per-attack detail.
function annotateMembers(warData) {
  const opponentMembers = (warData.opponent && warData.opponent.members) || [];
  const defenderTownhallByTag = {};
  const defenderMapPositionByTag = {};
  for (const om of opponentMembers) {
    defenderTownhallByTag[om.tag] = om.townhallLevel;
    defenderMapPositionByTag[om.tag] = om.mapPosition;
  }

  const clanMembers = (warData.clan && warData.clan.members) || [];
  return clanMembers.map((m) => ({
    tag: m.tag,
    name: m.name,
    townhallLevel: m.townhallLevel,
    mapPosition: m.mapPosition,
    attacks: (m.attacks || []).map((a) => {
      const defenderTh = defenderTownhallByTag[a.defenderTag] ?? null;
      const defenderMapPos = defenderMapPositionByTag[a.defenderTag] ?? null;
      return {
        order: a.order,
        stars: a.stars,
        destructionPercentage: a.destructionPercentage,
        defenderMapPosition: defenderMapPos,
        defenderTownhall: defenderTh,
        thDelta: defenderTh != null && m.townhallLevel != null ? defenderTh - m.townhallLevel : null,
        // "Mirror" attack = hit the opponent sitting at the same map number
        // as them (the classic "attack your own number" war assignment).
        sameMapPosition:
          defenderMapPos != null && m.mapPosition != null ? defenderMapPos === m.mapPosition : null,
      };
    }),
  }));
}

// Records a finished war (from the /currentwar shape) if we haven't
// already recorded one with the same clan + endTime. Returns true if it
// was newly recorded, false if it was a duplicate or wasn't recordable.
async function recordWarIfNew(clanTag, warData) {
  if (!warData || warData.state !== 'warEnded' || !warData.endTime) return false;

  const history = await loadData(HISTORY_FILE, []);
  const alreadyRecorded = history.some((w) => w.clanTag === clanTag && w.endTime === warData.endTime);
  if (alreadyRecorded) return false;

  const members = annotateMembers(warData);

  const clanStars = warData.clan ? warData.clan.stars : null;
  const opponentStars = warData.opponent ? warData.opponent.stars : null;
  let result = null;
  if (clanStars != null && opponentStars != null) {
    result = clanStars > opponentStars ? 'win' : clanStars < opponentStars ? 'lose' : 'tie';
  }

  history.push({
    clanTag,
    opponentName: warData.opponent ? warData.opponent.name : null,
    result,
    teamSize: warData.teamSize,
    attacksPerMember: warData.attacksPerMember || 2,
    endTime: warData.endTime,
    recordedAt: new Date().toISOString(),
    members,
  });

  await saveData(HISTORY_FILE, history, `Record war vs ${warData.opponent ? warData.opponent.name : 'unknown'} (ended ${warData.endTime})`);
  return true;
}

// "2026-9" for September 2026. Used to group recorded wars by calendar
// month using the machine's local time zone (this server runs on the
// user's own computer, so "local" here matches their own wall clock).
function monthKey(date) {
  return `${date.getFullYear()}-${date.getMonth() + 1}`;
}

function monthLabel(year, month) {
  // month is 1-indexed
  return new Date(year, month - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

// Recorded wars for a clan whose endTime falls within the given calendar
// month (1-indexed month, local time).
async function getHistoryForClanInMonth(clanTag, year, month) {
  const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const end = new Date(year, month, 1, 0, 0, 0, 0);
  const history = await loadData(HISTORY_FILE, []);
  return history.filter((w) => {
    if (w.clanTag !== clanTag) return false;
    const ended = parseClashTimestamp(w.endTime);
    return ended && ended >= start && ended < end;
  });
}

// Distinct past calendar months (excluding the current one) that have at
// least one recorded war for this clan, most recent first. This is what
// populates the "Old History" dropdown — no separate archiving step is
// needed, since a past month's data was always just a date-filtered query
// away once the current month moves on.
async function getPastMonthsWithData(clanTag) {
  const now = new Date();
  const currentKey = monthKey(now);
  const seen = new Map();
  const history = await loadData(HISTORY_FILE, []);
  for (const w of history) {
    if (w.clanTag !== clanTag) continue;
    const ended = parseClashTimestamp(w.endTime);
    if (!ended) continue;
    const key = monthKey(ended);
    if (key === currentKey || seen.has(key)) continue;
    const year = ended.getFullYear();
    const month = ended.getMonth() + 1;
    seen.set(key, { year, month, label: monthLabel(year, month) });
  }
  return Array.from(seen.values()).sort((a, b) => b.year - a.year || b.month - a.month);
}

// MR (Member Rating) point value of one war star, as a multiplier on the
// base 50 MR/star. Only the town hall gap counts, not map position/mirror
// status — war matchmaking can pair unfair map numbers, but the town hall
// difference is the real signal of how hard a target was.
//   same TH:        1x  (no bonus or penalty)
//   1 TH lower:      0.75x (attacked an easier target — reduced value)
//   2+ TH lower:     0.5x  (much easier — halved)
//   1 TH higher:     1.25x (attacked a harder target — bonus)
//   2+ TH higher:    1.5x  (much harder — bigger bonus)
const WAR_STAR_MR = 50;
function warStarMrMultiplier(thDelta) {
  if (thDelta == null) return 1;
  if (thDelta <= -2) return 0.5;
  if (thDelta === -1) return 0.75;
  if (thDelta === 0) return 1;
  if (thDelta === 1) return 1.25;
  return 1.5;
}

// Aggregates a set of recorded wars into a per-member summary: total
// stars, attacks made, how many of those attacks were against a higher /
// lower / same town hall (and whether it was their assigned mirror or
// not), and the MR (Member Rating) points those stars are worth.
function summarizeByMember(wars) {
  const byTag = new Map();

  for (const war of wars) {
    for (const member of war.members) {
      if (!byTag.has(member.tag)) {
        byTag.set(member.tag, {
          tag: member.tag,
          name: member.name,
          townhallLevel: member.townhallLevel,
          wars: 0,
          attacks: 0,
          stars: 0,
          warStarMR: 0,
          attackedHigher: 0,
          attackedLower: 0,
          attackedSame: 0,
          attackedMirror: 0,
          attackedOffMirror: 0,
        });
      }
      const entry = byTag.get(member.tag);
      entry.wars += 1;
      entry.townhallLevel = member.townhallLevel; // keep most recent
      for (const attack of member.attacks) {
        entry.attacks += 1;
        entry.stars += attack.stars;
        entry.warStarMR += attack.stars * WAR_STAR_MR * warStarMrMultiplier(attack.thDelta);
        if (attack.thDelta > 0) entry.attackedHigher += 1;
        else if (attack.thDelta < 0) entry.attackedLower += 1;
        else if (attack.thDelta === 0) entry.attackedSame += 1;
        if (attack.sameMapPosition === true) entry.attackedMirror += 1;
        else if (attack.sameMapPosition === false) entry.attackedOffMirror += 1;
      }
    }
  }

  return Array.from(byTag.values()).sort((a, b) => b.stars - a.stars);
}

module.exports = {
  getTrackedTag,
  setTrackedTag,
  recordWarIfNew,
  getHistoryForClanInMonth,
  getPastMonthsWithData,
  monthLabel,
  summarizeByMember,
  parseClashTimestamp,
  annotateMembers,
};
