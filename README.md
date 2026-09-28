# Kyoshi

A quiet home for small, private apps that run entirely in your browser — currently **Bosco** (weight
tracker with projections), **Momo** (weekly time budget) and **Wan Shi Tong** (media recommendations:
what's in progress, what's up next, and the rest). You only see the app you're using; switch
apps from the icon button beside **Theme**. No accounts, no servers, no CDN: plain HTML, CSS and
JavaScript, built to keep working for years.

- **Open it:** the GitHub Pages link, or `index.html` straight from a download of this repo.
- **Your data:** stays in this browser, in its large storage (IndexedDB). Each app has Export/Import JSON
  in its *Backup & sync* section, and one sync folder (e.g. shared by Syncthing) keeps every app up to
  date across devices. Developer Mode (Ctrl+9, or the DEV badge) can export or import every app at once,
  and shows how much storage Kyoshi uses.
- **Keep backups:** a browser can erase a site's data (clearing browsing data, a full device, or on
  iPhone a week or so without a visit). Kyoshi asks the browser to protect it, but export now and then.
- **Coming from the standalone Bosco or Momo** on the same site? Your data comes over on first open;
  otherwise, export it there and use Import JSON here.
- **Updates:** just reload. Every file link carries a build stamp, so a reload gets the newest files.

## Hosting on GitHub Pages (free plan)
1. Keep the repository **public** (the free plan needs it), so never commit personal data or backups.
2. On GitHub: **Settings → Pages → Build and deployment → Source: Deploy from a branch → `main`, `/ (root)` → Save.**
3. A minute or two later the site is at `https://<user>.github.io/<repo>/`. Every merge into `main` goes
   live the same way.

Working on it (people or AI): start with [`CLAUDE.md`](CLAUDE.md) — the rules, a map of every file,
how to add a new app, and how to test a branch before it goes live.
