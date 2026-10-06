# Kyoshi

A quiet home for small, private apps that run entirely in your browser — currently **Bosco** (weight
tracker with projections), **Momo** (weekly time budget), **Wan Shi Tong** (media recommendations:
what's in progress, what's up next, and the rest), **Appa** (preventive maintenance and records,
with PDF reports), **Hawky** (errands, jotted down in seconds on the phone), **Iroh** (goals: a vision
for each area of your life, this year's goals and this season's, whose hours Momo makes time for and logs
at its weekly close-out), **Badgermole** (workouts: routines in a rotation, each set logged with one
thumb, PRs and a streak), **Turtleduck** (meals: recipes, a two-week plan, shopping trips with a grocery
list each, and a cook view) and **Pabu** (keeping in touch: who's due a call, a text or a visit, and
birthdays coming up). You only see the app you're using; switch apps from the icon button beside
**Theme**. No accounts, no servers, no CDN: plain HTML, CSS and JavaScript, built to keep working for years.

- **Open it:** the GitHub Pages link, or `index.html` straight from a download of this repo.
- **Your data:** stays in this browser, in its large storage (IndexedDB). Developer Mode (Ctrl+9, or the
  DEV badge) holds *Cloud sync*: every app kept current on your phone and computers through a private
  GitHub repository, each app's file encrypted (AES-256-GCM) with a key only your devices hold (one key
  string, pasted once per device; photos and PDFs never go up: they stay on their device, and in the sync
  folder). It also holds *Backup & sync*: Export/Import JSON for the app on screen, Export/Import all
  (every app in one file), and the sync folder (e.g. shared by Syncthing), which keeps every app up to
  date across devices. Backups are text only (JSON): photos and PDFs travel through the sync folder as
  plain files, in `<folder>/<app>/files/`. Developer Mode also shows how much storage Kyoshi uses.
- **Keep backups:** a browser can erase a site's data (clearing browsing data, a full device, or on
  iPhone a week or so without a visit). Kyoshi asks the browser to protect it, but export now and then.
- **Coming from the standalone Bosco or Momo** on the same site? Your data comes over on first open;
  otherwise, export it there and use Import JSON (Developer Mode) here.
- **Updates:** just reload. Every file link carries a build stamp, so a reload gets the newest files.

## Hosting on GitHub Pages (free plan)
1. Keep the repository **public** (the free plan needs it), so never commit personal data or backups.
2. On GitHub: **Settings → Pages → Build and deployment → Source: Deploy from a branch → `main`, `/ (root)` → Save.**
3. A minute or two later the site is at `https://<user>.github.io/<repo>/`. Every merge into `main` goes
   live the same way.

Working on it (people or AI): start with [`CLAUDE.md`](CLAUDE.md) — the rules, a map of every file,
how to add a new app, and how to test a branch before it goes live. `node tests/run.js` runs the end-to-end
tests (Playwright and made-up data; not part of the site); `node tests/sim/run.js` lives six made-up lives
through the apps, day by day, and writes `tests/sim/report.md`.
