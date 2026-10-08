# Project Context: Kyoshi — a home for small vanilla HTML/JS apps (Bosco, Momo, Wan Shi Tong, Appa, Hawky, Iroh, Badgermole, Turtleduck, Pabu, …)
Kyoshi holds the user's single-purpose apps and their shared "DNA" (look, storage, sync, backups,
pop-ups, bug reports, developer mode, meetings). It stays out of sight: the user only sees the app on screen,
switched from the icon button beside Theme. More apps will be added, each relying on the shared core.

## Tech Stack & Hosting (built to run 10+ years untouched)
- **Pure HTML5, CSS3, Vanilla JS (ES2020+).** NO frameworks, NO build tools, **ABSOLUTELY NO CDN LINKS**.
- **Plain `<script src>` tags, no ES modules, no `fetch()` of the site's own files** (the one `fetch` is cloud sync's, to `https://api.github.com` only) — it must run from GitHub Pages (free plan, `main` from root, `.nojekyll`) *and* from a double-clicked `index.html`.
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
Then `node tests/run.js`: end-to-end tests (Playwright taps through the real page with made-up data); add tests for the flows you change.
Cloud sync runs against a fake GitHub in the tests (`tests/cloud.js`), never the real one; by hand, with a test repository and its own token.

---

## Map
```
index.html            shell markup (header, switcher, banners, dev panel, bug pop-up) + every <link>/<script>, in load order
roadmap/             roadmap.md: the plan, upcoming phases & apps (read when starting one); archive/: finished plans, dated
testplan.md           the flow test campaign: simulated lives through Momo and the apps that feed it (read when running it)
core/                 the shared DNA — K = window.Kyoshi
  base.js             K namespace; console capture for bug reports (loads first)
  changelog.js        Kyoshi's version + changelog
  util.js             K.util: numbers, text, dates (time-travel aware), formatting, files, clipboard, sync merges (newer, mergeById, mergeKeys: each app's combine, record.js, meetings.js)
  seasons.js          K.seasons: when spring/summer/fall/winter start (North America), the next after a day
  storage.js          K.storage: IndexedDB kept in memory, each app's A.store ("kyoshi.<id>.<key>"), K.store, other tabs, test mode
  files.js            K.files: photos & documents (IndexedDB "kyoshi-files"), each app's A.files, mirrored to the sync folder
  modal.js            K.modal: pop-ups — define/open/close, Esc, ×, backdrop, "discard changes?"
  sync.js             K.sync: the sync engine (version counters, combining another device's save, saveOf, saved, relation) and its transports (K.sync.use). No UI.
  sync-folder.js      K.folder: folder autosave & sync, a transport of K.sync (one subfolder per app, apps' files; a save by a newer Kyoshi stops it until reloaded, as the cloud does). No UI.
  github.js           K.github: a small GitHub REST client (one repository, a token; list, read, write a file; blobs, trees, commits, the branch; no delete). No UI.
  cloud-crypto.js     K.cloudCrypto: the cloud's key string (kyoshi1.<owner>/<repo>.<token>.<secret>) and its locked files (AES-256-GCM, gzip)
  cloud.js            K.cloud: cloud sync through a private GitHub repository, a transport of K.sync (data/<app>.json each, text only; lost or not), and a dated backup folder a day (backups/). No UI.
  cloud-key.js        K.cloud's key: Enter key, Set up a new cloud (KYOSHI.md), Update token, Disconnect; Download decrypted copy, Decrypt a file
  cloud-upkeep.js     K.cloud's upkeep: the repository's history trimmed to the last 8 days (daily, on its own), the token's expiry notice
  cloud-backups.js    K.cloud's daily backups, beside the constant sync: backups/<date>/ (each app's data/ file as it is, all.json), the last 8 days, one commit a day; Back up now; Restore a day…'s days and files
  cloud-ui.js         K.cloudUI: Developer Mode's Cloud block, its pop-up, and the banner and header glyph while the cloud needs you
  backup.js           K.backup: Developer Mode's "Backup & sync" block (the app on screen's Export/Import JSON, Export/Import all, Sync Folder…), sync & storage banners (imports dated; K.backup.ask: the import question; the cloud's encrypted files imported as they are)
  record.js           K.record: core's own record, the hidden Kyoshi app (id kyoshi: no page, never shown) holding the bug log and core's synced preferences (the theme), so they sync and are backed up as an app's data (data/kyoshi.json, apps.kyoshi; Clear and Delete leave markers)
  bugs.js             K.bugs: "Bugs & requests" pop-up (bug or feature request; all listed until cleared, a tap opens one to edit or delete) and the report's text
  dev.js              K.dev: the one Developer Mode (Ctrl+9 / DEV badge): Cloud sync, Backup & sync, time travel & test mode
  agenda.js           K.agenda: events at set times that apps share (each app's A.agenda), for Momo's board
  routine.js          K.routine: the slots apps keep at set times every week (each app's A.routine: Turtleduck's meals, its trips), for Momo's baseline; K.routine.unreadable (an app not started, or failing)
  meetings.js         K.meetings: each app's checkup ("Last checkup: 12 days ago", no schedule) or meetings (on a schedule, into K.inbox, once the app is in use): header line, Done ✓, settings pop-up, its "meetings" key
  inbox.js            K.inbox: what apps need done this week and next (each app's A.inbox, plus meetings): Momo's cards (one each, or filling blocks); K.inbox.open; K.inbox.unreadable
  wakelock.js         K.wakeLock: keeps the screen on while the app on screen's A.awake() says so (a timer, a workout)
  pdf-*.js            K.pdf, in load order: font (Helvetica, WinAnsi) · inflate · filters · parse · read (pages) · write (K.pdf.create) · import (other PDFs' pages)
  shell.js            K.register, K.start (K.ready once every app has started), switcher menu, theme, keyboard, minute tick, other-tab reload
  kyoshi.css          theme tokens + shared components (buttons, inputs, sections, stats, tables, pop-ups, dev panel)
apps/<id>/            one folder per app — its CLAUDE.md has its file map and data model
  bosco/              weight tracker with projections & GLP-1 dosing
  momo/               weekly time budget (YNAB for hours)
  wanshitong/         media tracker for recommendations (Active media, the backlog)
  appa/               preventive maintenance & records (each job a card of its own in Momo, PDF reports with proof)
  hawky/              errands (quick add on the phone, each a card of its own in Momo) & shopping lists (by store and topic, a 30- or 7-day cooling-off lock; not in Momo)
  iroh/               the goals ladder: each area's 10-year vision, the year's goals, the season's (their hours fill Momo's cards; progress from its close-out)
  badgermole/         workouts: routines in rotation, set logging on the phone, PRs & streak (each workout a card of its own in Momo)
  turtleduck/         meals: recipes (pasted in bulk), the two-week plan by drag and drop with batch portions, trips (a weekly schedule too) with a grocery list each, a cook view; Times & trips sets when (its meals and scheduled trips are slots in Momo's baseline, filled once a week is confirmed; cooking and extra trips pinned cards of their own)
  pabu/               keep in touch: people (a group and notes each) with calls, texts or visits, each on its own cadence (each a card of its own in Momo; This week at the top); birthdays as events on the board
  _template/          starter for a new app (not loaded) — its CLAUDE.md says how to add one
tools/decrypt.html    the cloud's files decrypted with the key, from disk, with no network (a backup's all.json as its Export all file; not loaded by index.html)
tests/                end-to-end tests, not part of the site: run.js (how to run; tests side by side, --serial for one at a time), lib.js, generate.js (made-up data), <app>.js (its screens), cloud.js (a fake GitHub), *.test.js
  sim/                the flow simulator (testplan.md): made-up lives through the real page; `node tests/sim/run.js` writes report.md and bundles/
```

## The app contract
Each app registers in its `app.js`: `const A = Kyoshi.register({ id, name, title, subtitle, width, icon, backupNote?, meetings? })` — `id`: lowercase letters and digits, from a letter, unique (`storage` and `kyoshi` are core's); `hidden: true` is core's only, for its own record (the hidden Kyoshi app, `core/record.js`: no page, never shown nor in the switcher, its writes kept in test mode); `meetings`: `[{ id, title, every: "whenever"|"week"|"month"|"quarter"|"season"|"year", minutes, after? }]` (core/meetings.js): the apps used daily each name a checkup (`every: "whenever"`: no schedule, just when you last did it); one on a schedule is a regular meeting, for an app reviewed less often (Iroh's; a `"season"` one is due by the end of each new season's first week; `after: true` comes after the other apps' in Momo).
Its other files are wrapped as `(function (K, A) { … })(Kyoshi, Kyoshi.apps.<id>)`.

**Kyoshi provides on A** (never overwrite): `A.S` (state) · `A.$(id)` (element in this app) · `A.root` · `A.store.get/set/json/remove(key)`, `keys()` (instant) · `A.files.put/get/has/remove/ids` (photos & documents: Blobs, async) · `A.changed(unsaved = true, quiet = false)` (after storing a change: sync count, autosave, Export highlight; quiet: the app's own bookkeeping, not a change of the user's) · `A.listen(target, type, fn)` (page-wide listener, only while on screen) · `A.isActive()` · `A.setSubtitle(text)` · `A.refreshDev()`.

**The app defines on A** (all optional except `markup`):
| Hook | When Kyoshi calls it |
|---|---|
| `A.markup` | HTML string → `A.root`. |
| `A.load()` | at start and after another tab changed its keys: storage → `A.S` (no drawing) |
| `A.init()` | once, after load: wire events, first render |
| `A.onShow()` / `A.onHide()` | the app comes on / goes off screen |
| `A.onTick()` | every minute and when the page is back in view — every app, on screen or not |
| `A.onKeydown(e)` | keys while on screen; return `true` if handled |
| `A.onReload()` | after `A.load()` for another tab's change: redraw |
| `A.attention()` | short reason it needs the user, when you're behind ("" if none) → dot on its switcher icon |
| `A.awake()` | true while the screen should stay on with it on screen (a running timer, a workout); call `K.wakeLock.check()` when that changes (core also checks on show, `A.changed()`, reloads and every minute) — see `core/wakelock.js` |
| `A.renderDev(box)` | fill `box` with its Developer Mode tools (`.dev-block`s) |
| `A.bugState()` | lines (`"- Key: value"`) for bug reports — never personal data |
| `A.data` | backup & sync adapter `{ schemaVersion, build(), looksLike(raw), hasData(), importBackup(raw, ask) → true once it's in, combine(raw, how), afterSync() }` — see `core/sync.js`, `apps/bosco/data.js`. importBackup asks with `K.backup.ask(A, raw, "Replace …?")` (it adds the backup's date and how much newer what's here is). With photos/documents, also `files()` → `{ live, gone }` and `afterFiles()` — see `core/files.js` |
| `A.agenda(from, to)` | events at set times on those days, as copies `[{ id, title, date, time, minutes, note, done }]` for Momo's board — see `core/agenda.js` |
| `A.inbox(from, to)` | what it needs done this week and next, as copies `[{ id, title, block, details, fill, minutes, date, due, from, overdue, done, of, time, slot, fixed }]`: with `fill: "card"`, each a card of its own in Momo (titled `title`, `minutes` long; one with a `date` lands on that day by itself, near its `time`; a done one's `of` names the need it completes, whose card shows ✓; a dated one's `slot` names the routine slot whose card it fills that day, its `block` that slot's title; `fixed: true`: the app sets its day, time and length, so Momo pins it at its `time` and won't let it be moved, resized or deleted there), else filling Momo's blocks (cards titled `block`) — see `core/inbox.js` (ids starting `meeting:` are core's) |
| `A.routine()` | its slots at set times every week, as copies `[{ id, title, day (0 = Monday), time, minutes }]`: Momo keeps a pinned card for each in its baseline, following changes — see `core/routine.js` |
| `A.open(id)` | "Open in <App>" from Momo (after Kyoshi shows the app): show that need; for an empty slot's card ("Set in <App>"), the id of its routine slot |
| `A.CHANGELOG` / `A.VERSION` | changelog.js |

## Rules for app code
- **One app in the page at a time**; the others' roots are detached but keep running. Ids are unique only within an app: always `A.$` / `A.root.querySelector`, never `document.getElementById/querySelector`.
- Page-wide listeners go through `A.listen`; listeners on the app's own elements are fine.
- Pop-ups: `.overlay > .modal` markup + `K.modal` (`define` once, then `open`/`close`/`dismiss`).
- Styles: shared in `core/kyoshi.css`; app-specific in `apps/<id>/<id>.css` under `.app-<id>`; page-wide custom properties `--<id>-…`.
- Storage: only `A.store` (IndexedDB `kyoshi-data`, key `kyoshi.<id>.<key>`, held in memory; other tabs get changes); the keys `sync` and `meetings` are core's. A backup's and sync file's top-level `savedAt`, `sync` and `meetings` are core's too. `K.store` is core's own: the device id (the bug log is the hidden Kyoshi app's, `kyoshi.kyoshi.bugReports`); `K.storage.get/set` is localStorage (theme, last app, read-only carry-over of the standalone apps' old keys; the cloud's key `kyoshi.cloud`, a preference, never data). Core handles migration, fallbacks, quota warnings and test mode.
- A preference that should be the same on every device goes with its app's data (its `A.data.build()`); core's go in the hidden Kyoshi app's record (`core/record.js`, `prefs`: the theme); a device's own things (the last app open, Developer Mode, a session in progress, Momo's Later, the folds, the Bug / Feature request pick) stay on the device. Photos & documents: `A.files` (IndexedDB `kyoshi-files`); folder sync copies them as plain files, the cloud never does (it carries each app's save only, as `data/<app>.json`, and once a day a dated copy of them in `backups/<date>/`), backups hold data only.
- Within an app: destructure helpers only from `app.js`; call other files' functions as `A.name()`; expose with `Object.assign(A, { … })`.
- Apps may read one another and ask one another to change things, but only through functions the other app offers (its own save, undo and sync run); never its `A.S` or storage. So far: Momo reads every app's `A.agenda`, `A.inbox` and `A.routine` (its "Open in <App>" calls `A.open(id)`); Iroh reads Momo's `hoursSpent` (hours by title per closed week, for its goals' progress); Turtleduck reads Momo's `weekStatus` (whether a week has its slots).
- Checkups and meetings are core's: an app only names its defaults (`meetings` in `K.register`). Core shows them, stores them (`meetings` key), syncs and backs them up; one on a schedule also goes to Momo's "Meeting" cards and dots the app's icon when overdue, but only once the app is in use (`A.data.hasData()`).
- Apps start one at a time (`K.order`): an app reading the others (`K.inbox`, `K.agenda`, `K.routine`) before `K.ready` sees only those started before it.
- Time: `K.util.todayStr()` / `K.util.now()` (time travel aware); `Date.now()` only for change stamps (`u`, `savedAt`).
