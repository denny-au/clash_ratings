# Deploying Clash Ratings

The site has two halves that need to live in two different places, because GitHub Pages only serves static files (HTML/CSS/JS) — it can't run the Node/Express backend that holds your API key and does the background war-history tracking.

- **Frontend** (`public/`) → GitHub Pages. Free.
- **Backend** (`server.js`, `warTracker.js`) → Render's **free** web service tier, with war history stored in your GitHub repo instead of on Render's disk (explained below). Total cost: **$0/month**.

Do the steps in this order — the backend needs to exist before you can point the frontend at it.

## Why GitHub, not just Render's disk

Render's free tier is genuinely free, but it sleeps after 15 minutes with no visitors, and — this is the part that matters — **wipes any files the app wrote at runtime every time it wakes back up**. Persistent disks that survive that are a paid-only Render feature. Since this app's whole value is the war history it accumulates over time, losing it every time nobody visits for 15 minutes would break the site's main feature.

The fix: instead of writing `war-history.json` to Render's disk, the server writes it to your GitHub repo via GitHub's API — the same repo you're pushing the code to anyway. That data isn't on the compute instance at all, so Render sleeping and waking doesn't touch it. The only real cost is a ~30-50 second load delay the first time someone visits after the site's been idle a while (Render "waking up"). Everything else in the code already handles this — it just needs the two extra environment variables from step 2b below.

*(If down the road you'd rather pay for zero cold-starts, Render's cheapest always-on tier is about $7/month — same setup, just skip the GitHub-storage env vars and add a paid persistent disk instead. Not covered step-by-step here since you're going with the free path.)*

## 1. Put the project on GitHub

If you've never done this before, from a terminal inside your project folder (the one with `server.js` in it):

```bash
git init
git add .
git commit -m "Clash Ratings"
```

`git add .` will respect the `.gitignore` already in this project, so your `.env` (your API key) and `node_modules/` never get committed — good, keep it that way.

Then on github.com: click the **+** in the top right → **New repository** → name it something like `clash-ratings` → **Public** (Pages needs the repo to be public unless you're on a paid GitHub plan) → **Create repository**, and don't initialize it with a README (you already have files). GitHub will show you commands like these — run them:

```bash
git remote add origin https://github.com/YOUR-USERNAME/clash-ratings.git
git branch -M main
git push -u origin main
```

## 2a. Generate a GitHub token for the backend to use

The backend needs permission to write to your repo (just that one repo, just the `data/` folder). Make a scoped token so a leak can't do more than that:

1. Go to **github.com → Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**.
2. **Repository access**: choose **Only select repositories** → pick `clash-ratings`.
3. **Permissions** → **Repository permissions** → set **Contents** to **Read and write**. Leave everything else as **No access**.
4. Generate it and copy the token (starts with `github_pat_`) — you can only see it once.

## 2b. Deploy the backend to Render

1. Go to [render.com](https://render.com) and sign up (signing up with your GitHub account makes the next step easier).
2. **New +** → **Web Service** → connect your `clash-ratings` repo.
3. Settings:
   - **Root Directory**: leave blank (server.js is at the repo root).
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: **Free**.
4. **Environment Variables** — add:
   - `COC_API_KEY` = your actual Clash of Clans API key (never commit this to GitHub — this is the one place it should live for the deployed version).
   - `GITHUB_TOKEN` = the token from step 2a.
   - `GITHUB_REPO` = `YOUR-USERNAME/clash-ratings`.
5. Click **Create Web Service**. First deploy takes a few minutes — watch the logs for `Clash Ratings running at http://localhost:...`.
6. Once it's live, Render shows you the service's URL, something like `https://clash-ratings-xxxx.onrender.com`. Copy it.

### Point your API key at Render's IP

Same 403 issue as running it locally: your Clash of Clans API key is locked to one IP address, and Render's outbound IP is different from your home IP. In the Render dashboard, open your service → **Connect** tab → it lists the service's outbound IP address(es). Go to [developer.clashofclans.com](https://developer.clashofclans.com), edit your key (or make a new one for this purpose), and set its allowed IP to that address.

Worth knowing: Render doesn't guarantee that IP stays the same forever — a redeploy can occasionally shift it. If the deployed site starts throwing the same 403 "IP mismatch" error you saw early on, that's what happened — just check the Connect tab again and re-point the key. This is the trade-off for not paying for a dedicated static IP, which runs $100+/month and isn't worth it for a project like this.

## 3. Point the frontend at your deployed backend

Open `public/app.js` and find this near the top:

```js
const BACKEND_URL =
  location.hostname === 'localhost' || location.hostname === '127.0.0.1'
    ? ''
    : 'https://REPLACE-WITH-YOUR-RENDER-URL.onrender.com';
```

Replace `https://REPLACE-WITH-YOUR-RENDER-URL.onrender.com` with the actual Render URL from step 2b.6 (no trailing slash). This only affects the deployed site — running it locally with `npm start` is unaffected, since that branch of the check keeps using relative paths.

Commit and push:

```bash
git add public/app.js
git commit -m "Point frontend at deployed backend"
git push
```

## 4. Turn on GitHub Pages

This repo already includes a GitHub Actions workflow (`.github/workflows/deploy-pages.yml`) that publishes the `public/` folder automatically on every push to `main`.

1. On GitHub, go to your repo → **Settings** → **Pages**.
2. Under **Build and deployment** → **Source**, choose **GitHub Actions** (not "Deploy from a branch").
3. Go to the **Actions** tab — you should see a "Deploy frontend to GitHub Pages" run (it kicks off automatically the first time you push after this file exists, or click **Run workflow** to trigger it manually).
4. Once it finishes, back in **Settings → Pages** you'll see your live URL — something like `https://YOUR-USERNAME.github.io/clash-ratings/`.

That's it — that URL is now your public site, running for $0/month.

## What to expect day-to-day

- **First visit after the site's been quiet a while**: takes ~30-50 seconds to load while Render wakes the backend up. This is normal, not broken — it'll say "Searching..." the whole time.
- **War history persists** across all of that, because it lives in your GitHub repo, not on Render. You'll see small automated commits show up in your repo's history each time a war gets recorded or you switch which clan is tracked — that's expected and harmless, just the app saving its data the only way this setup makes free.
- **Occasional 403 after a Render redeploy**: re-check the Connect tab and re-point your API key's allowed IP, same fix as always.

## Updating the site later

- **Frontend changes** (`public/*`): just `git push` — the Pages workflow redeploys automatically in about a minute.
- **Backend changes** (`server.js`, `warTracker.js`): `git push` — Render auto-deploys on push too, by default.
