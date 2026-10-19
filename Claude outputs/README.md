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

## Warboard (this month + last month only)

The member table's War Stars column and the Warboard track **the current calendar month** — e.g. if it's October, they cover wars that ended from October 1st onward. A "Last month" dropdown under the leaderboard shows **last month** (e.g. "September 2026"), with real War Stars and MR built from the recorded wars and raid weekends (last month's detailed War History table isn't shown, but its wars are kept so the leaderboard can be computed). Donated there comes from a **donation snapshot**: Supercell only exposes each member's live donation count, so the app saves what the leaderboard shows (`data/donation-history.json`) every time it sees the clan — on every page load and every 15 minutes in the background — and the last save before the month ends is what's kept. A month from before this existed (or when the server was off) simply shows 0.

Nothing older than last month is kept. Whenever the server checks in (every 15 minutes in the background, plus on every war check), any recorded war or raid weekend that ended before the start of last calendar month is **erased from `data/` for good**, not just hidden. So on the 1st of a new month, last month's data becomes "previous", the month before it is deleted, and the current leaderboard starts fresh. There's no dropdown and no way to look further back.

Important limitation, not a bug: Supercell's API only exposes per-member attack detail for the *current* war. Once a war finishes and rotates out, that breakdown is gone from their API — there's no endpoint to fetch "what did each member do 2 wars ago." So this app builds its own history by quietly checking in the background (every 15 minutes by default, configurable via `POLL_INTERVAL_MINUTES` in `.env`) and saving a war's results to a local file (`data/war-history.json`) the moment it ends. That means:

- History only covers wars that finished *while this server was running*. There's no way to backfill wars from before you started using this — including August, if this is the first time you're running this version.
- For a month's view to actually fill in, the server needs to be running (or at least started up again periodically) so it doesn't miss a war ending. If your computer's off when a war finishes, that one won't get recorded.
- It'll say "no wars recorded yet this month" right after a fresh install, or right after a new month starts — that's expected.

Two things are tracked per attack, in the "Same # / Diff #" and "TH Matchup" columns:

- **Same # / Diff #** — clan wars assign each member a map number, mirrored against an opponent at the same number. This counts how many of a member's attacks hit their assigned mirror (same number) vs. someone else's target (a different number).
- **TH Matchup** — compares the attacker's town hall level to whoever they hit: `↑` means they attacked a higher townhall, `↓` a lower one, `=` the same. Shown because it's the next best thing when a war doesn't have clean mirror match-ups (irregular team sizes, missed attacks elsewhere in the lineup, etc.) — between the two, this tells you if someone's picking easy targets even when the "same number" signal is muddy.

## Raid Weekend

The member table's "Raid Attacks" column shows attacks used out of the max available (e.g. `4/6`) for the most recent Capital Raid Weekend — ongoing or just-ended, whichever is more recent. Unlike regular wars, Supercell's API *does* keep this data around (via `/clans/{tag}/capitalraidseasons`), so no background tracking is needed for this one — it's always live. A member who shows just `0` (no slash) means they weren't in the season's participant list at all — didn't attack and didn't contribute Capital Gold.

## Rank movement, trends, awards, sharing

- **Daily MR snapshots** (`data/mr-history.json`): each member's MR and rank is saved about once a day (refreshed through the day, at most every 20 minutes, by page loads and the 15-minute background poller). They power the ▲/▼ arrows (compared with the last saved earlier day *this month*; the 1st of a month starts fresh because MR resets) and the MR-by-day line inside each player card. Same 2-month window as everything else: anything older than last month is erased. History starts the day this feature is deployed.
- **Player card**: tap a Leaderboard row or podium card, or a Warboard row, and the card opens right under it (MR split and day-by-day line, profile, this month's war attacks). One card is open at a time; tap again to close it.
- **Hall of Fame** (the awards): Champion (highest MR), Conqueror (top of the Warboard), Provider (most troops donated), Star Collector (war stars), Sharpshooter (stars per attack, min. 2 attacks) and Challenger (most attacks on higher town halls, no minimum). Ties go to the higher MR. The Warboard's top three wear shield icons (`public/assets/site/rank-1..3.png`), and a perfect 3.0 average gets an iridescent purple bar.
- **Share**: the Share button draws the top 5 onto an image in the browser (nothing is uploaded) and opens the phone's share sheet, or downloads a PNG on desktop.
- **Install on a phone**: `manifest.webmanifest` + the icons in `public/assets/icons/` let people use "Add to Home Screen".

## Project layout

- `server.js` — Express server. Serves the frontend and exposes:
  - `GET /api/clan?tag=...` — clan info + member list (this month's war stars from local history, donations, current raid weekend attacks), plus each member's MR breakdown, rank movement and daily MR trend, the summary-strip numbers, this month's award leaders, and last month's champion.
  - `GET /api/player?tag=...&clan=...` — one member's live game profile (town hall, trophies, heroes; cached 5 min) plus their war attacks recorded this month. Powers the card that opens when you click a row.
  - `GET /api/currentwar?tag=...` — per-attack detail (target, mirror match, TH matchup, stars, destruction) for the clan's active war, if any.
  - `GET /api/war-history?tag=...` — aggregated per-member stats for the current calendar month.
  - `GET /api/previous-month?tag=...` — last calendar month's leaderboard (MR, war stars, raid attacks) plus that month's awards (Hall of Fame).
  - `GET /api/img?u=...` — image fallback. Clan badges and league icons normally load straight from Supercell's image server; if a visitor's network or ad blocker blocks it, the site retries through this route (only `api-assets.clashofclans.com` is allowed, images are cached in memory). Once a browser has needed the fallback it remembers that and goes straight to this route next time (so a blocked or hanging host never slows the page down). If that fails too, the clan badge becomes the site shield and league icons are hidden.
- `warTracker.js` — reads/writes `data/war-history.json`, `raid-history.json`, `donation-history.json`, `mr-history.json` and `config.json`; groups recorded wars by calendar month, aggregates per-member stats, and prunes anything older than last month.
- `public/` — the frontend: `index.html`, `style.css`, `app.js`.
- `.env` — your API key and settings (not committed anywhere, keep it private).
- `data/` — local war history and the currently-tracked clan tag. Auto-created; safe to delete if you want to start history over.

## Deploying it as a public website

See [DEPLOYMENT.md](DEPLOYMENT.md) for the full walkthrough — frontend on GitHub Pages, backend on Render's free tier with war history stored in your GitHub repo (so nothing's lost when the free tier sleeps). Total cost: **$0/month**.

## Next steps

Natural next additions from here: a proper "top players" leaderboard combining these metrics with your own weighting, clan games points, and a design pass on the look of the site.

## Look and feel

- Tabs are **Leaderboard / War / Bulletin / Guide** (the Bulletin shows for every clan that is looked up). The top three of the leaderboard and of the "Last month" dropdown (under the month awards) stand on a podium (2nd | 1st | 3rd); ranks 4+ are the table. On the leaderboard the podium cards open the same player card as the table rows. `#last` opens the dropdown.
- **Find / Compare / Share** sit on their own row under the heading, on both the Leaderboard and the Warboard. On the Warboard, Compare is a war head-to-head (stars, avg stars per attack, attacks, wars, hits on higher town halls) and Share makes a Warboard picture.
- `public/fx.js` draws the floating embers (canvas) and the cursor spotlight on the leaderboard. Entrance animations, the title glint and the rotating gold border on 1st place are CSS (see the "WOW LAYER" block at the end of `style.css`). Everything animated switches off under `prefers-reduced-motion`.
- On desktop the leaderboard uses fixed column widths so the summary tiles (War record, Avg MR, War stars, Donated, Raid attacks) sit directly above the columns they describe.
- The podium blocks have a moving light, a floor glow and rising stars (CSS only). **Share** opens a preview sheet first (Share on phones that support it, otherwise Save picture); the picture is a warm mini-podium with the top 3 as cards and ranks 4-5 as rows, drawn on a canvas with no game art.
- The menu drawer (FAQ / About) is three short accordion cards plus the MR formula as chips, in the same glass/gold style.
- **Hall of Fame**: Champion, Conqueror, Provider, Star Collector, Sharpshooter and Challenger (see above).
- **Performance notes**: the dust is a 30fps canvas using pre-drawn sprites, and the spinning gold borders rotate with a transform (animating a gradient angle forced a repaint every frame and was the biggest cause of lag).
- **War tab**: a scoreboard for the live war (both clans' badges and stars, state pill, countdown, attack meter and chips) with the per-member attack list under "Show attacks"; and the **Warboard** (open by default; players with no war stars this month are left off, it starts fresh every month, and the top three get a subtle ember/flame effect) with the month's W–L record, recent-war chips (result, opponent, date, star score) and an attacker table with average-stars bars and a higher/same/lower matchup bar. `/api/currentwar` now also returns `startTime`, `clan` and `opponent` (name, badge, stars, destruction, attacks); recorded wars store `clanStars`/`opponentStars` going forward (older records just show W/L without a score). Equal stars are decided by total destruction, like the game.

- **Player cards**: only one stats card is open at a time (podium and table share the same rule). Heroes are abbreviated (BK, AQ, GW, RC, MP, DD; unknown new heroes fall back to initials). 2nd and 3rd place podium cards have silver and bronze metallic borders; 1st keeps the gold rotating ring.

- **Bulletin tab**: announcements shown to everyone who opens the site, whichever clan they look up (big events like Hammer Jam, huge balance changes). **All posts live in `public/bulletin-data.js`**: newest first, each with `title`, `date`, optional `label`, `image` (a file in `public/assets/bulletin/`), `body` paragraphs, `list` bullets and numbered `sections` (each with `title`, `text`, `points`, `links`), all plain text. The field list is at the top of that file. Delete a post's block when its event ends. A rounded card like the rest of the site with the Builder's hammer (`assets/bulletin/builder-hammer.png`) tapping the headline strip; each numbered tip is a closed dropdown . **Glow colours**: the glow at the top and the floating dots change per tab: soft blue on the Bulletin, fiery red on War, the town hall colour on the Guide, amber on the Leaderboard (`TAB_GLOW` in `app.js`). The clan stats strip shows on every tab. **Hammer Jam meteors**: the blue streaks in the site background (shown only on the Bulletin tab) are the `#meteors` div near the top of `index.html` plus the last block of `style.css`; delete both when the event ends. Deep link: `#bulletin`.
- **The light**: like the sun through a window. There are two identical copies of the lights (`#atm-a` / `#atm-b` in `index.html`). Each one is a glow fixed in the middle at the top of the screen (`.atm::before`), a fan of light (`.beam i`) that spreads down from it to the bottom of the screen, and a low glow along the bottom (`.atm::after`). The beam slowly swings from the bottom left to the bottom right and back (about 48 seconds each way; `--sw` is how far it swings, smaller on a tall phone screen). With "reduce motion" on it just rests, leaning a little. When a tab (or the Planner) changes the colour, `fx.js` sets it on the hidden copy and fades that copy in over the other one.
- **Smooth mode**: a lighter look for slower devices (`html.lite`, the block at the bottom of `style.css`): no floating dots or meteors, the beam rests instead of swinging, no podium/ring/crown animations, no blur. `fx.js` watches the page's own frame rate and switches it on by itself after three choppy checks in a row (it remembers that in `localStorage` key `cr-lite`); there is a **Smooth mode** switch at the bottom of the menu, and `?lite=1` / `?lite=0` force it on/off (turning it off by hand stops the automatic check).
- **Speed (the lag fix)**: colours are no longer animated with a CSS transition on `:root` (that made the browser re-style and redraw the whole page on every frame of every tab change). The beam layers are only as big as the visible light and carry their own fade-out mask, so they are drawn once and then just moved. The title glint is switched on by `fx.js` for about 1.3 seconds every 8 seconds instead of running forever, the embers canvas is drawn at half size, the podium's endless animations pause while the podium is off screen (`.anim-off`), and the pulsing dots and sparks only animate `transform`/`opacity`.
- **Clan stats strip**: the five stat tiles (wars W-L, avg MR, war stars, donated, raid attacks) are hidden until the clan card is clicked (or its chevron button). Click again to hide. It starts hidden for every search, and the numbers count up as it opens (`#summary`, `toggleSummary()` in `app.js`).
- **Planner page**: the Guide has a **Planner** button (centred in its own row right under the tabs, above the Guide heading; the master builder in front with the lab assistant and apprentice beside him, then the word Planner and an arrow; pictures in `public/assets/planner/`). It slides the tabs out to the left and the Planner page in from the right. The big title stays, **Planner** sits beneath it, and a back button (arrow, the word Guide and the little book) returns to the Guide.
  - **Colours**: builder = blue (buildings *and* heroes: a hero upgrade takes a builder, so heroes live in the Builders card and count towards the busy/free builders), research = purple, pet = white.
  - **Next month**: the calendar grid is the current month only; under it a "Finishing next month" list shows what finishes next month, plus one line for anything later ("N more finish after that, the last on …").
  - **Town Hall pictures**: your Town Hall's picture (`assets/th/th<level>.webp`, levels 1–17; TH1 and TH2 look the same in the game) sits beside the village name, and in Strategic rush mode the next Town Hall's picture shows on the goal card (none yet for TH18).
  - **Helpers** (Apprentice, Lab Assistant, Alchemist, Prospector) are read from the export and kept in `village.helpers`, but are not shown; they are there for later.
  - **Light**: the Planner's glows, beams and floating dots turn slowly through every colour (a `hue-rotate` animation, 36 seconds for the full circle; `pl-hue` in `style.css`). **Clicking the big "Clash Ratings" title anywhere goes back to the leaderboard.** Address: `#planner` (the browser's Back button works). To rename it change `<h2 id="planner-heading">` and the button label `.pb-text` in `index.html`.
  - **How it works**: the player pastes their village export (Clash of Clans, Settings, More Settings, Data Export, Copy). `planner.js` reads it: every upgrade with a `timer` (seconds left when the export was made, plus its `timestamp`) becomes a finish date. The page shows which **builders** are busy or free and on what, **research** (laboratory), the **pet** being upgraded, a **hero** upgrade and the **helpers** (ready or on cooldown), plus a calendar of the current month with a marker on each finish day. An old export is handled: upgrades that finished since are shown as free, with a note. The village is kept in this browser only (localStorage). "Try a sample village" loads a made-up one; "Remove my village" clears it.
  - **Strategic rush / Max switch**: strategic rush is the default and shows the next Town Hall with an estimated date; the Max switch shows when everything is done. **These two dates are placeholders** (`estimate` in `public/planner-data.js`: `rushDays` and `maxDays`) until the real upgrade times are added. The export only holds levels and timers, so a real estimate needs the time of every building level.
  - **Names**: `names` in `planner-data.js` turns the export's numbers into names (Army Camp, Dragon, Frosty...). An id that is not listed still shows, as e.g. "Building #1000099", so nothing breaks; add it to the list.
  - **Iridescent light**: on the Planner the usual amber beam is switched off and four soft beams (pink, sky blue, violet, gold) swing at different speeds (`#planner-light` in `index.html`, the Planner block at the end of `style.css`), while the glow and the floating dots drift through the same pearly colours (`startIrid()` in `app.js`).
- **Guide tab**: a slider of town halls (TH11–TH17) with the chosen one big in the middle and the others small beside it (swipe, tap a neighbour, use the arrows or ← → keys). TH14 and TH15 are written; the others show "coming soon". The floating lights change colour with the town hall (TH14 green, TH15 purple, etc.). Each written town hall has Armies (recommended / ground / air, with pictures), Bases and Tips. **All guide content lives in `public/guide-data.js`**: army/base `link`s must start with `https://link.clashofclans.com/`, plus pictures, troop lists, tips and each town hall's `theme` colour. Town hall pictures are `public/assets/th/th<level>.webp`, troop pictures `public/assets/troops/*.webp`, base pictures `public/assets/bases/*.jpg`. `guide.js` only draws it. Deep links: `#guide` and `#guide/th14`.

