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
const RAID_HISTORY_FILE = 'raid-history.json';
const DONATION_HISTORY_FILE = 'donation-history.json';

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

// War history only ever covers "this month and last month". Anything that
// ended before the start of last calendar month is erased for good (not just
// hidden from the UI) the next time this runs — so on the 1st of a new
// month, the month before last disappears, last month becomes "previous",
// and the new month starts fresh. Same rule raid history already follows.
function historyCutoff(now = new Date()) {
  return new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
}

function pruneOldWars(history, now = new Date()) {
  const cutoff = historyCutoff(now);
  return history.filter((w) => {
    const ended = parseClashTimestamp(w.endTime);
    return ended && ended >= cutoff;
  });
}

// Loads war history, erases anything older than last calendar month (saving
// only if something was actually removed, so a normal call never causes a
// write/commit), and returns what's left.
async function pruneWarHistory(now = new Date()) {
  const raw = await loadData(HISTORY_FILE, []);
  const kept = pruneOldWars(raw, now);
  if (kept.length !== raw.length) {
    const cutoff = historyCutoff(now);
    await saveData(
      HISTORY_FILE,
      kept,
      `Prune war history older than ${monthLabel(cutoff.getFullYear(), cutoff.getMonth() + 1)}`
    );
    console.log(`Pruned ${raw.length - kept.length} war record(s) older than ${cutoff.toISOString()}.`);
  }
  return kept;
}

// Records a finished war (from the /currentwar shape) if we haven't
// already recorded one with the same clan + endTime. Returns true if it
// was newly recorded, false if it was a duplicate or wasn't recordable.
// Also prunes expired history on every call, so the 2-month window rolls
// forward on its own even when no new war has ended.
async function recordWarIfNew(clanTag, warData) {
  const history = await pruneWarHistory();
  if (!warData || warData.state !== 'warEnded' || !warData.endTime) return false;

  // /currentwar keeps returning the last finished war until a new one starts,
  // which can be older than our window — don't re-add something that would
  // just be pruned again on the very next call.
  const endedAt = parseClashTimestamp(warData.endTime);
  if (!endedAt || endedAt < historyCutoff()) return false;

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

// The calendar month before the current one (the only past month that's
// still kept — see historyCutoff).
function getPreviousMonth(now = new Date()) {
  const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  return { year, month, label: monthLabel(year, month) };
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

// --- Donation snapshots ("a screenshot before the month rolls over") ---
//
// Supercell only exposes each member's *current* donation count, never a
// past one, so a month's final numbers have to be captured while that month
// is still running. Every time we see the clan's member list (any page
// load, plus the background poller), we overwrite that calendar month's
// snapshot with exactly what the leaderboard currently shows. The last
// overwrite before the month ends is what stays — i.e. the end-of-month
// "screenshot". Only this month and last month are kept (same window as
// war/raid history), and the file is only written when something actually
// changed, so frequent calls cost nothing.
function sameDonations(a, b) {
  if (a.length !== b.length) return false;
  const byTag = new Map(a.map((m) => [m.tag, m.donations]));
  return b.every((m) => byTag.get(m.tag) === m.donations);
}

async function recordDonationSnapshot(clanTag, memberList, now = new Date()) {
  // An empty/failed member list must never wipe out a good snapshot.
  if (!Array.isArray(memberList) || memberList.length === 0) return false;

  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const cutoff = historyCutoff(now);

  const raw = await loadData(DONATION_HISTORY_FILE, []);
  const kept = raw.filter((s) => new Date(s.year, s.month - 1, 1) >= cutoff);
  let changed = kept.length !== raw.length;

  const members = memberList.map((m) => ({ tag: m.tag, name: m.name, donations: m.donations || 0 }));
  const idx = kept.findIndex((s) => s.clanTag === clanTag && s.year === year && s.month === month);
  const snapshot = { clanTag, year, month, capturedAt: now.toISOString(), members };

  if (idx === -1) {
    kept.push(snapshot);
    changed = true;
  } else if (!sameDonations(kept[idx].members, members)) {
    kept[idx] = snapshot;
    changed = true;
  }

  if (changed) {
    await saveData(DONATION_HISTORY_FILE, kept, `Snapshot donations for ${clanTag} (${year}-${month})`);
  }
  return changed;
}

// The saved donation snapshot for a clan + calendar month, or [] if none
// was ever captured (e.g. any month from before this feature existed).
async function getDonationSnapshot(clanTag, year, month) {
  const history = await loadData(DONATION_HISTORY_FILE, []);
  const snap = history.find((s) => s.clanTag === clanTag && s.year === year && s.month === month);
  return snap ? snap.members : [];
}

// --- Capital Raid Weekend tracking (stacks through the month) ---
//
// The member table shows a running total of raid attacks for the whole
// calendar month, not just the most recent weekend — so, same as wars,
// each finished raid weekend gets snapshotted into its own history file
// the moment it ends. Unlike war history, raid records are deliberately
// short-lived: every time this runs it also prunes anything older than
// last calendar month, so raid history only ever covers "this month and
// last month" before it's erased for good (not just hidden from the UI —
// actually removed from storage).

// Drops any recorded raid weekend that ended before the start of last
// calendar month.
function pruneOldRaidSeasons(records, now = new Date()) {
  const cutoff = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
  return records.filter((r) => {
    const ended = parseClashTimestamp(r.endTime);
    return ended && ended >= cutoff;
  });
}

// Same as pruneWarHistory, for raid history: erases anything older than
// last calendar month, saving only if something was actually removed. Lets
// the poller roll the window forward even in a stretch where no raid weekend
// happens to end.
async function pruneRaidHistory(now = new Date()) {
  const raw = await loadData(RAID_HISTORY_FILE, []);
  const kept = pruneOldRaidSeasons(raw, now);
  if (kept.length !== raw.length) {
    await saveData(RAID_HISTORY_FILE, kept, 'Prune raid history older than last month');
    console.log(`Pruned ${raw.length - kept.length} raid record(s) older than last month.`);
  }
  return kept;
}

// Records a finished Capital Raid Weekend (from the capitalraidseasons
// shape) if we haven't already recorded one with the same clan + endTime.
// Prunes old records on every call (not just when a new one is found), so
// pruning stays current even on requests/polls that don't find anything
// new to record. Returns true if a new weekend was newly recorded.
async function recordRaidSeasonIfNew(clanTag, season) {
  const rawHistory = await loadData(RAID_HISTORY_FILE, []);
  const pruned = pruneOldRaidSeasons(rawHistory);
  let changed = pruned.length !== rawHistory.length;

  let recorded = false;
  if (season && season.state === 'ended' && season.endTime) {
    const alreadyRecorded = pruned.some((r) => r.clanTag === clanTag && r.endTime === season.endTime);
    if (!alreadyRecorded) {
      pruned.push({
        clanTag,
        startTime: season.startTime,
        endTime: season.endTime,
        recordedAt: new Date().toISOString(),
        members: (season.members || []).map((m) => ({
          tag: m.tag,
          name: m.name,
          attacks: m.attacks || 0,
        })),
      });
      changed = true;
      recorded = true;
    }
  }

  if (changed) {
    await saveData(
      RAID_HISTORY_FILE,
      pruned,
      `Record raid weekend for ${clanTag}${season && season.endTime ? ` (ended ${season.endTime})` : ''}`
    );
  }
  return recorded;
}

// Recorded (completed) raid weekends for a clan whose endTime falls
// within the given calendar month (1-indexed month, local time).
async function getRaidHistoryForClanInMonth(clanTag, year, month) {
  const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const end = new Date(year, month, 1, 0, 0, 0, 0);
  const history = await loadData(RAID_HISTORY_FILE, []);
  return history.filter((r) => {
    if (r.clanTag !== clanTag) return false;
    const ended = parseClashTimestamp(r.endTime);
    return ended && ended >= start && ended < end;
  });
}

// Sums raid attacks per member across a set of recorded raid weekends.
function summarizeRaidByMember(seasons) {
  const byTag = new Map();
  for (const season of seasons) {
    for (const member of season.members) {
      if (!byTag.has(member.tag)) {
        byTag.set(member.tag, { tag: member.tag, name: member.name, weekends: 0, attacks: 0 });
      }
      const entry = byTag.get(member.tag);
      entry.weekends += 1;
      entry.name = member.name; // keep most recent
      entry.attacks += member.attacks;
    }
  }
  return Array.from(byTag.values()).sort((a, b) => b.attacks - a.attacks);
}

module.exports = {
  getTrackedTag,
  setTrackedTag,
  recordWarIfNew,
  getHistoryForClanInMonth,
  getPreviousMonth,
  pruneWarHistory,
  pruneRaidHistory,
  recordDonationSnapshot,
  getDonationSnapshot,
  monthLabel,
  summarizeByMember,
  parseClashTimestamp,
  annotateMembers,
  recordRaidSeasonIfNew,
  getRaidHistoryForClanInMonth,
  summarizeRaidByMember,
};
