# Project Context: Kyoshi — a home for small vanilla HTML/JS apps (Bosco, Momo, Wan Shi Tong, Appa, …)
Kyoshi holds the user's single-purpose apps and their shared "DNA" (look, storage, sync, backups,
pop-ups, bug reports, developer mode). It stays out of sight: the user only sees the app on screen,
switched from the icon button beside Theme. More apps will be added, each relying on the shared core.

## Tech Stack & Hosting (built to run 10+ years untouched)
- **Pure HTML5, CSS3, Vanilla JS (ES2020+).** NO frameworks, NO build tools, **ABSOLUTELY NO CDN LINKS**.
- **Plain `<script src>` tags, no ES modules, no `fetch()` of the site's own files** — it must run from GitHub Pages (free plan, `main` from root, `.nojekyll`) *and* from a double-clicked `index.html`.
- **Many small files**, each with one job and a header comment saying what it owns; keep each under ~400 lines.
- **Relative paths** (`core/util.js`, never `/core/util.js`); lowercase names, no spaces.
- **The repo is public:** never commit personal data (backups, exports, screenshots with real numbers).
- **No service worker/offline cache.** Feature-detect newer APIs (folder sync, `navigator.storage`, `BroadcastChannel`); never use deprecated ones (`document.write`, sync XHR, `unload`).
- **Data outlives code:** plain JSON; each app's backups carry a `schemaVersion`; loading/imports accept every older version forever; never rename or drop a stored key without carrying its data over.
- **Icons** only when needed: raw Lucide / Lucide Lab SVG (stroke style) baked into the markup.

## Working with me
- Be concise: direct code/diffs, no filler or lectures. Targeted edits, no whole-file rewrites unless needed.
- No workspace scanning: use the map below and `apps/<id>/CLAUDE.md`; every file's header says what's in it.
- Act as an expert coding partner. I trust you with small things; ask me about medium/big choices or anything that affects future scaling — in plain terms (I'm a layman).

## Changelog & Versioning (every change, no exceptions)
- Add a changelog entry (a brief, high-level sentence per change) and bump the version: the app's (`apps/<id>/changelog.js`), core's (`core/changelog.js`), or both if both changed. Developer Mode shows both.
- Version X.YYY, bump exactly one tier: `+0.001` bug fix · `+0.010` tiny tweak · `+0.100` small feature · `+1` large feature.
- New build stamp on every link in `index.html`: `sed -i "s/?v=[0-9][0-9-]*/?v=$(date -u +%Y%m%d-%H%M)/g" index.html`

## Git Workflow
- **Push finished, checked changes straight to `main`** (live in a minute or two). **Don't check that the site is live after pushing** — no fetching/polling the Pages URL; just report the push.
- Use a branch only with a reason (risky stored-data/sync change, big redesign, something I should see first) and say why. I try a branch via GitHub → **Code → Download ZIP** → open `index.html` (separate data; don't connect it to the real sync folder), and accept it by merging into `main`.
- Other linked repos (e.g. the standalone Bosco, Momo) are **read-only** references.

## Checking a change
Open `index.html` from disk, switch to the app, check the console for errors. Developer Mode's time travel rehearses day/week changes without saving.

---

## Map
```
index.html            shell markup (header, switcher, banners, dev panel, bug pop-up) + every <link>/<script>, in load order
roadmap.md            the plan: upcoming phases & apps (read when starting one)
core/                 the shared DNA — K = window.Kyoshi
  base.js             K namespace; console capture for bug reports (loads first)
  changelog.js        Kyoshi's version + changelog
  util.js             K.util: numbers, text, dates (time-travel aware), formatting, files, clipboard
  seasons.js          K.seasons: when spring/summer/fall/winter start (North America)
  storage.js          K.storage: IndexedDB kept in memory, each app's A.store ("kyoshi.<id>.<key>"), K.store, other tabs, test mode
  files.js            K.files: photos & documents (IndexedDB "kyoshi-files"), each app's A.files, mirrored to the sync folder
  modal.js            K.modal: pop-ups — define/open/close, Esc, ×, backdrop, "discard changes?"
  sync.js             K.sync: folder autosave & sync engine (clocks, merge calls, one subfolder per app, apps' files). No UI.
  backup.js           K.backup: each app's "Backup & sync" section, sync & storage banners, Export/Import JSON & all
  bugs.js             K.bugs: "Report a bug" pop-up and log
  dev.js              K.dev: the one Developer Mode (Ctrl+9 / DEV badge), time travel & test mode
  agenda.js           K.agenda: events at set times that apps share (each app's A.agenda), for Momo's board
  inbox.js            K.inbox: what apps need done this week and next (each app's A.inbox), filling Momo's blocks; K.inbox.open
  pdf-*.js            K.pdf, in load order: font (Helvetica, WinAnsi) · inflate · filters · parse · read (pages) · write (K.pdf.create) · import (other PDFs' pages)
  shell.js            K.register, K.start, switcher menu, theme, keyboard, minute tick, other-tab reload
  kyoshi.css          theme tokens + shared components (buttons, inputs, sections, stats, tables, pop-ups, dev panel)
apps/<id>/            one folder per app — its CLAUDE.md has its file map and data model
  bosco/              weight tracker with projections & GLP-1 dosing
  momo/               weekly time budget (YNAB for hours)
  wanshitong/         media tracker for recommendations (In progress, Up next, the backlog)
  appa/               preventive maintenance & records (jobs to Momo, PDF reports with proof)
  _template/          starter for a new app (not loaded) — its CLAUDE.md says how to add one
```

## The app contract
Each app registers in its `app.js`: `const A = Kyoshi.register({ id, name, title, subtitle, width, icon, backupNote? })` — `id`: lowercase letters and digits, from a letter, unique (`storage` is core's).
Its other files are wrapped as `(function (K, A) { … })(Kyoshi, Kyoshi.apps.<id>)`.

**Kyoshi provides on A** (never overwrite): `A.S` (state) · `A.$(id)` (element in this app) · `A.root` · `A.store.get/set/json/remove(key)`, `keys()` (instant) · `A.files.put/get/has/remove/ids` (photos & documents: Blobs, async) · `A.changed(unsaved = true)` (after storing a change: sync count, autosave, Export highlight) · `A.listen(target, type, fn)` (page-wide listener, only while on screen) · `A.isActive()` · `A.setSubtitle(text)` · `A.refreshDev()`.

**The app defines on A** (all optional except `markup`):
| Hook | When Kyoshi calls it |
|---|---|
| `A.markup` | HTML string → `A.root`. `<section data-kyoshi="backup"></section>` marks where Backup & sync goes. |
| `A.load()` | at start and after another tab changed its keys: storage → `A.S` (no drawing) |
| `A.init()` | once, after load: wire events, first render |
| `A.onShow()` / `A.onHide()` | the app comes on / goes off screen |
| `A.onTick()` | every minute and when the page is back in view — every app, on screen or not |
| `A.onKeydown(e)` | keys while on screen; return `true` if handled |
| `A.onReload()` | after `A.load()` for another tab's change: redraw |
| `A.attention()` | short reason it needs the user ("" if none) → dot on its switcher icon |
| `A.renderDev(box)` | fill `box` with its Developer Mode tools (`.dev-block`s) |
| `A.bugState()` | lines (`"- Key: value"`) for bug reports — never personal data |
| `A.data` | backup & sync adapter `{ schemaVersion, build(), looksLike(raw), hasData(), importBackup(raw, ask), combine(raw, how), afterSync() }` — see `core/sync.js`, `apps/bosco/data.js`. With photos/documents, also `files()` → `{ live, gone }` and `afterFiles()` — see `core/files.js` |
| `A.agenda(from, to)` | events at set times on those days, as copies `[{ id, title, date, time, minutes, note, done }]` for Momo's board — see `core/agenda.js` |
| `A.inbox(from, to)` | what it needs done this week and next, as copies `[{ id, title, block, details, fill, minutes, date, due, overdue, done }]`, filling Momo's blocks (cards titled `block`) — see `core/inbox.js` |
| `A.open(id)` | "Open in <App>" from Momo (after Kyoshi shows the app): show that need |
| `A.CHANGELOG` / `A.VERSION` | changelog.js |

## Rules for app code
- **One app in the page at a time**; the others' roots are detached but keep running. Ids are unique only within an app: always `A.$` / `A.root.querySelector`, never `document.getElementById/querySelector`.
- Page-wide listeners go through `A.listen`; listeners on the app's own elements are fine.
- Pop-ups: `.overlay > .modal` markup + `K.modal` (`define` once, then `open`/`close`/`dismiss`).
- Styles: shared in `core/kyoshi.css`; app-specific in `apps/<id>/<id>.css` under `.app-<id>`; page-wide custom properties `--<id>-…`.
- Storage: only `A.store` (IndexedDB `kyoshi-data`, key `kyoshi.<id>.<key>`, held in memory; other tabs get changes). `K.store` is core's own; `K.storage.get/set` is localStorage (theme, last app, read-only carry-over of the standalone apps' old keys). Core handles migration, fallbacks, quota warnings and test mode. Photos & documents: `A.files` (IndexedDB `kyoshi-files`); folder sync copies them as plain files, backups hold data only.
- Within an app: destructure helpers only from `app.js`; call other files' functions as `A.name()`; expose with `Object.assign(A, { … })`.
- Between apps: never touch another app's `A.S` or storage. A provider may offer a small read-only function — ask me first. So far: Momo reads every app's `A.agenda` and `A.inbox` (its "Open in <App>" calls `A.open(id)`).
- Time: `K.util.todayStr()` / `K.util.now()` (time travel aware); `Date.now()` only for change stamps (`u`, `savedAt`).
