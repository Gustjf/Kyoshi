# Project Context: Kyoshi — a home for small vanilla HTML/JS apps (Bosco, Momo, …)
Kyoshi holds the user's single-purpose apps and their shared "DNA" (look, storage, sync, backups,
pop-ups, bug reports, developer mode). It stays out of sight: the user only sees the app on screen,
switched from the icon button beside Theme. More apps will be added, each relying on the shared core.

## Tech Stack & Architecture
- **Stack:** Pure HTML5, CSS3, and Vanilla JavaScript (ES2020+). Plain `<script src>` tags — no ES modules — so it runs from GitHub Pages *and* from a double-clicked `index.html`.
- **Constraints:** NO frameworks, NO build tools, and **ABSOLUTELY NO CDN LINKS**.
- **Structure:** many small files instead of one big one — each has one job and starts with a header comment saying what it owns. Keep files under ~400 lines; split by concern when one grows.
- **Data & State:** localStorage only (each app in its own space), JSON export/import, and optional autosave & sync to a folder the user picks (one folder for every app, each in its own subfolder).
- **Assets:** If icons are needed, fetch the SVG data and bake the raw SVG code directly into the markup (Lucide / Lucide Lab, stroke style). Must be consistent style. Only use icons if needed, do not clutter.

## Token Efficiency & Coding Guidelines
- **Concise Responses:** Provide direct code blocks or diffs. Skip conversational filler, explanations, or lectures.
- **Targeted Edits:** Modify only the requested lines or sections. Do not rewrite whole files unless necessary.
- **No Workspace Scanning:** Use the map below (and `apps/<id>/CLAUDE.md` for an app) to open only the files a task needs. Every file's header comment says what's in it.

- Act as an expert coding partner, not an employee.
- Ask me when critical decisions need to be made.
- Ask me if i have a preference on something medium to big, or something that will impact scaling in the future. I have a laymans knowledge, so don't ask me critical software development questions.
- I trust you with the smaller things.
  Ensure to update the changelog in the dev console. Keep entries very brief and high level, a sentence per change.

## Changelog & Versioning
- Every change gets a CHANGELOG entry and a version bump. No exceptions.
- Each app has its own version and changelog (`apps/<id>/changelog.js`); the shared core has Kyoshi's (`core/changelog.js`). Bump whichever you changed — both when a change touches core and an app. Developer Mode shows both.
- Version format is X.YYY — each digit is a size tier, bump exactly one per change:
  - `+0.001` bug fix
  - `+0.010` tiny tweak
  - `+0.100` small feature
  - `+1` large feature

## Git Workflow
- Make a new branch with the feature and then give me instructions on how to test and accept the changes.

## Linked Repositories
- When other GitHub repositories are linked to the session (e.g. Bosco, Momo — the standalone originals), they are **read-only** references. Never edit, commit to, or push to them. Only edit the repository the change is for.

---

## Map
```
index.html            shell markup (header, switcher, banners, dev panel, bug pop-up) + every <link>/<script>, in load order
core/                 the shared DNA — K = window.Kyoshi
  base.js             K namespace; console capture for bug reports (loads first)
  changelog.js        Kyoshi's version + changelog
  util.js             K.util: numbers, text, dates (time-travel aware), formatting, files, clipboard
  seasons.js          K.seasons: when spring/summer/fall/winter start (North America)
  storage.js          K.storage + each app's A.store (keys "kyoshi.<id>.<key>"); test-mode shadowing
  modal.js            K.modal: pop-ups — define/open/close, Esc, ×, backdrop, "discard changes?"
  sync.js             K.sync: folder autosave & sync engine (clocks, merge calls, one subfolder per app). No UI.
  backup.js           K.backup: each app's "Backup & sync" section, sync banner, Export/Import JSON, Export/Import all
  bugs.js             K.bugs: "Report a bug" pop-up and log
  dev.js              K.dev: the one Developer Mode (Ctrl+9 / DEV badge), time travel & test mode
  shell.js            K.register, K.start, switcher menu, theme, keyboard, minute tick, other-tab reload
  kyoshi.css          theme tokens + shared components (buttons, inputs, sections, stats, tables, pop-ups, dev panel)
apps/<id>/            one folder per app — see apps/<id>/CLAUDE.md for its file map and data model
  bosco/              weight tracker with projections & GLP-1 dosing
  momo/               weekly time budget (YNAB for hours)
  _template/          starter files for a new app (not loaded)
```

## The app contract
Each app registers in its `app.js`: `const A = Kyoshi.register({ id, name, title, subtitle, width, icon, backupNote? })`.
`A` is the app's namespace; its other files attach to it and are wrapped as `(function (K, A) { … })(Kyoshi, Kyoshi.apps.<id>)`.

**Kyoshi provides on A** (never overwrite these): `A.S` (the app's state object) · `A.$(id)` (element by id inside this app only) · `A.root` · `A.store.get/set/json/remove(key)` · `A.changed(unsaved = true)` (call after storing a change: counts it for sync, autosaves, highlights Export JSON) · `A.listen(target, type, fn)` (a document/window listener that only fires while the app is on screen) · `A.isActive()` · `A.setSubtitle(text)` · `A.refreshDev()`.

**The app defines on A** (all optional except `markup`):
| Hook | When Kyoshi calls it |
|---|---|
| `A.markup` | HTML string (markup.js); becomes `A.root`. Put `<section data-kyoshi="backup"></section>` where Backup & sync goes. |
| `A.load()` | at start and when another tab changed this app's keys: read storage into `A.S` (no drawing) |
| `A.init()` | once, after load: wire events, first render |
| `A.onShow()` / `A.onHide()` | the app comes on / goes off screen |
| `A.onTick()` | every minute and when the page is back in view — for every app, on screen or not |
| `A.onKeydown(e)` | keys while on screen; return `true` if handled (Kyoshi then does Esc → top pop-up → Developer Mode) |
| `A.onReload()` | after `A.load()` for another tab's change: redraw |
| `A.attention()` | a short reason it needs the user ("" if none) → dot on its icon in the switcher |
| `A.renderDev(box)` | fill `box` with its Developer Mode tools (`.dev-block`s) |
| `A.bugState()` | lines (`"- Key: value"`) for bug reports — never personal data |
| `A.data` | backup & sync adapter: `{ schemaVersion, build(), looksLike(raw), hasData(), importBackup(raw, ask), combine(raw, how), afterSync() }` — see `core/sync.js` and `apps/bosco/data.js` |
| `A.CHANGELOG` / `A.VERSION` | changelog.js |

## Rules for app code
- **Only one app is in the page at a time**; the others' roots are detached but keep running (ticks, sync). So: ids need only be unique within an app, and always look up with `A.$` / `A.root.querySelector` — never `document.getElementById`/`document.querySelector` for app elements.
- **Page-wide listeners** (document, window) go through `A.listen`, so they're quiet while another app is on screen. Listeners on the app's own elements are fine as they are.
- **Pop-ups** use `.overlay > .modal` markup and `K.modal` (`define` once, then `open`/`close`/`dismiss`). Esc, `.modal-close` and backdrop clicks come for free.
- **Styles**: shared components in `core/kyoshi.css`; everything app-specific in `apps/<id>/<id>.css` under `.app-<id>`. Name page-wide custom properties `--<id>-…`.
- **Storage**: only via `A.store` (the app's own space). Reading a *standalone* app's old keys (first-run carry-over) is `K.storage.get`, read-only.
- **Within an app**: destructure constants/helpers at the top of a file only from `app.js` (loaded first); call functions from other files as `A.name()` (every file is loaded before anything runs). Attach what other files need with `Object.assign(A, { … })`.
- **Between apps**: never read or write another app's `A.S` or storage. If one app ever needs another's data, give the provider a small read-only function and ask the user first.
- Time: "today" and "now" for the app's logic come from `K.util.todayStr()` / `K.util.now()`, so Developer Mode's time travel works; `Date.now()` is right only for change stamps (sync's `u`, `savedAt`).

## Where to edit what
| Change | Files |
|---|---|
| Colors, theme, a shared component's look | `core/kyoshi.css` |
| Header, switcher, theme button, app mounting, keys | `core/shell.js` (+ `index.html` markup) |
| Export/Import JSON, Backup & sync section, sync banner | `core/backup.js` |
| How syncing works | `core/sync.js` (the app side: its `data.js` → `A.data.combine`) |
| Developer Mode panel, time travel | `core/dev.js` (+ `index.html`); an app's own tools: its `A.renderDev` |
| Bug reports | `core/bugs.js`; an app's lines: its `A.bugState` |
| Anything inside one app | `apps/<id>/CLAUDE.md` says which file |

## Adding a new app
1. Copy `apps/_template/` to `apps/<id>/`; rename `template`/`Template` → `<id>`/`<Name>` in every file (including `.app-template` and `template.css` → `<id>.css`).
2. In `app.js` set its name, tab title, subtitle, page width and icon (a Lucide SVG with a stroke color, like Bosco's and Momo's).
3. Add its `<link>` and `<script>` tags to `index.html` (app.js first, events.js last). The switcher lists apps in that order.
4. Write `apps/<id>/CLAUDE.md` (its purpose, file map, data model). Start its changelog at 1.000, and add a line to Kyoshi's changelog.

## Checking a change
Open `index.html` (or the GitHub Pages link), switch to the app, and check the browser console for errors. Developer Mode's time travel rehearses day/week changes without saving anything.
