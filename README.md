# Kyoshi

A quiet home for small, private, offline apps — currently **Bosco** (weight tracker with projections)
and **Momo** (weekly time budget). You only see the app you're using; switch apps from the icon
button beside **Theme**. Everything runs locally in your browser: no accounts, no servers, no CDN.

- **Open it:** the GitHub Pages link, or `index.html` straight from a download of this repo.
- **Your data:** stays in this browser. Each app has Export/Import JSON in its *Backup & sync* section,
  and one sync folder (e.g. shared by Syncthing) keeps every app up to date across devices.
  Developer Mode (Ctrl+9, or the DEV badge) can export or import every app at once.
- **Coming from the standalone Bosco or Momo** on the same site? Your data comes over on first open;
  otherwise, export it there and use Import JSON here.

Working on it (people or AI): start with [`CLAUDE.md`](CLAUDE.md) — the rules, a map of every file,
and how to add a new app.
