# Clash Ratings

A basic web app: type in a Clash of Clans clan tag, get back the member list ranked by MR (Member Rating — see below), plus current-war and monthly war-history breakdowns. Opens by default to a specific clan (`#2RJPU9JY0`, configurable — see "Default clan" below); the search bar itself stays empty with that tag shown only as greyed-out placeholder text.

This runs as a small local server. That's not optional — Supercell's API keys are locked to the IP address they were created for, and the browser can't call the API directly (no CORS support), so a tiny backend has to hold the key and proxy the requests. The steps below get that backend running on your machine.

## 1. Get a Clash of Clans API key

1. Go to https://developer.clashofclans.com and create an account (or log in).
2. Find your current public IP address — search "what is my ip" or visit https://api.ipify.org.
3. In the developer portal, create a new API key. Give it a name (e.g. "clan-tracker-local") and enter the IP address from step 2 as the allowed IP.
4. Copy the generated key (you can only view it once, so copy it now).

Keep in mind: if your IP address changes (common with home internet, VPNs, or if you later deploy this somewhere), requests will start failing with a 403 until you regenerate the key for the new IP. The app will tell you if that happens.

## Why a clan search is fast now (it used to fetch a lot more)

Early versions of this app made one extra API call *per member* to pull their lifetime war star total, which is what made searches slow on bigger clans. That's gone now — war stars are shown per calendar month instead (see below), pulled from this app's own recorded history rather than from Supercell at all, so a search today is just the clan lookup plus one call for the current raid weekend. Raid weekend data is still cached in memory for 5 minutes so back-to-back searches of the same clan don't even re-fetch that.

## 2. Configure the app

1. Copy `.env.example` to a new file named `.env`.
2. Paste your key in as `COC_API_KEY=your_key_here`.

## 3. Install and run

Requires Node.js (18 or newer recommended).

```bash
npm install
npm start
```

Then open http://localhost:3000 in your browser.

## 4. Try it

The page loads with a clan already searched by default (see "Default clan" below), so you'll see results immediately. To look up a different clan, type its tag into the search bar, including the `#` (the greyed-out text in the search bar is just an example, not a real value — typing clears it like any placeholder), and hit Search. You can find your own clan's tag in-game under your clan's info screen.

## Default clan

The clan tag that loads automatically on page open is hardcoded in `public/app.js` as `DEFAULT_CLAN_TAG` (currently `#2RJPU9JY0`) — change that one line and restart the server to point it at a different clan. It's also what's shown as the search bar's placeholder text.

## MR (Member Rating)

This is the site's main ranking, and what the member table is sorted by (highest first). It's a single score combining three things:

- **Donations** — 1 MR per troop donated (current count, as reported by the game — donations reset on Supercell's own schedule, not something this app controls).
- **Raid Weekend attacks** — 25 MR per attack used in the current/most recent Capital Raid Weekend.
- **War stars this month** — 50 MR per star, adjusted by how much harder or easier the target's town hall was compared to the attacker's own. Map position (mirror match or not) is deliberately ignored here, since war matchmaking can pair unfair map numbers — only the town hall gap counts:

  | Target's town hall vs. attacker's | Multiplier | MR per star |
  |---|---|---|
  | 2+ levels lower | 0.5x | 25 |
  | 1 level lower | 0.75x | 37.5 |
  | Same | 1x | 50 |
  | 1 level higher | 1.25x | 62.5 |
  | 2+ levels higher | 1.5x | 75 |

  So a 3-star attack against a target 2+ town halls higher is worth up to 225 MR; the same 3-star attack against a target 2+ town halls lower is worth only 75.

MR is recalculated fresh on every search — it isn't stored anywhere separately, just computed from the same donation/raid/war-star data already described above.

**War stars from a war still in progress count too.** The War Stars column and MR aren't waiting for a war to finish and get recorded into history — every time you search (or refresh), the app also checks the clan's live current war and folds in whatever stars have landed so far, on top of anything already recorded earlier in the month. "Real time" here means *refreshed on every search*, not a continuously-updating feed without touching the page — this app doesn't use websockets/push, it's request-driven like the rest of it. A star is only ever counted once: while a war is in progress it's counted live; the instant it ends, it's recorded into permanent history instead, and the live count for it stops.

## Current War

Shows exactly what each member attacked in the war happening right now (one row per attack, not just totals): which opponent number they hit, whether that was their assigned "mirror" (same map number), the defender's town hall vs. their own, stars, and destruction. Members who haven't attacked yet show a "no attack yet" row instead.

## War History and Old History (calendar month, not a rolling window)

The member table's War Stars column and the War History panel both track **the current calendar month only** — e.g. if it's September, they cover wars that ended from September 1st onward, and reset when October starts. This is deliberate, not a rolling "last 30 days" window.

When the month rolls over, that month's data doesn't disappear — it moves into the **Old History** dropdown next to the clan name at the top. Pick a past month from there (e.g. "August 2026's Stats") and its War History table loads below, in its own "Old History" panel, in the same format as the live one. The dropdown only lists months that actually have recorded wars, and stays hidden until there's at least one.

Important limitation, not a bug: Supercell's API only exposes per-member attack detail for the *current* war. Once a war finishes and rotates out, that breakdown is gone from their API — there's no endpoint to fetch "what did each member do 2 wars ago." So this app builds its own history by quietly checking in the background (every 15 minutes by default, configurable via `POLL_INTERVAL_MINUTES` in `.env`) and saving a war's results to a local file (`data/war-history.json`) the moment it ends. That means:

- History only covers wars that finished *while this server was running*. There's no way to backfill wars from before you started using this — including August, if this is the first time you're running this version.
- For a month's view to actually fill in, the server needs to be running (or at least started up again periodically) so it doesn't miss a war ending. If your computer's off when a war finishes, that one won't get recorded.
- It'll say "no wars recorded yet this month" right after a fresh install, or right after a new month starts — that's expected.

Two things are tracked per attack, in the "Same # / Diff #" and "TH Matchup" columns:

- **Same # / Diff #** — clan wars assign each member a map number, mirrored against an opponent at the same number. This counts how many of a member's attacks hit their assigned mirror (same number) vs. someone else's target (a different number).
- **TH Matchup** — compares the attacker's town hall level to whoever they hit: `↑` means they attacked a higher townhall, `↓` a lower one, `=` the same. Shown because it's the next best thing when a war doesn't have clean mirror match-ups (irregular team sizes, missed attacks elsewhere in the lineup, etc.) — between the two, this tells you if someone's picking easy targets even when the "same number" signal is muddy.

## Raid Weekend

The member table's "Raid Attacks" column shows attacks used out of the max available (e.g. `4/6`) for the most recent Capital Raid Weekend — ongoing or just-ended, whichever is more recent. Unlike regular wars, Supercell's API *does* keep this data around (via `/clans/{tag}/capitalraidseasons`), so no background tracking is needed for this one — it's always live. A member who shows just `0` (no slash) means they weren't in the season's participant list at all — didn't attack and didn't contribute Capital Gold.

## Project layout

- `server.js` — Express server. Serves the frontend and exposes:
  - `GET /api/clan?tag=...` — clan info + member list (this month's war stars from local history, donations, current raid weekend attacks).
  - `GET /api/currentwar?tag=...` — per-attack detail (target, mirror match, TH matchup, stars, destruction) for the clan's active war, if any.
  - `GET /api/war-history?tag=...` — aggregated per-member stats for the current calendar month; pass `&month=YYYY-MM` for a past month.
  - `GET /api/history-months?tag=...` — which past months have recorded data, for the Old History dropdown.
- `warTracker.js` — reads/writes `data/war-history.json` and `data/config.json`; groups recorded wars by calendar month and aggregates per-member stats for a given month.
- `public/` — the frontend: `index.html`, `style.css`, `app.js`.
- `.env` — your API key and settings (not committed anywhere, keep it private).
- `data/` — local war history and the currently-tracked clan tag. Auto-created; safe to delete if you want to start history over.

## Deploying it as a public website

See [DEPLOYMENT.md](DEPLOYMENT.md) for the full walkthrough — frontend on GitHub Pages, backend on Render's free tier with war history stored in your GitHub repo (so nothing's lost when the free tier sleeps). Total cost: **$0/month**.

## Next steps

Natural next additions from here: a proper "top players" leaderboard combining these metrics with your own weighting, clan games points, and a design pass on the look of the site.
