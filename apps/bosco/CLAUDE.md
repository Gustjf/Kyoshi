# Bosco — weight tracker with projections (a Kyoshi app)
The app is called **Bosco** (its standalone original lives in the GitHub repo named Project-Wan-Shi-Tong, read-only).
Weigh-ins, a weekly pace goal, goal weights with ETAs and season projections, a chart, a shareable progress image,
and GLP-1 dosing (Tirzepatide, Semaglutide, Retatrutide): a dosing plan, one active vial, doses logged only once confirmed,
each at the next injection site in rotation.
Rules, versioning and the app contract: the root `CLAUDE.md`. Version & changelog: `changelog.js` (continues the standalone's).

## Files (load order)
| File | What's in it |
|---|---|
| `app.js` | `Kyoshi.register` (name, title, icon, 780px wide); constants (`MEDICATIONS`, `SITES` in rotation order, `DEFAULT_SITES`, `ONE_TIME_FIELDS`, limits, `DATA_SCHEMA_VERSION`); state `A.S`; helpers (weights & units, medication/plan/vial lookups, dose math, `activeSites`, `siteLabel`/`siteShort`, `fmtUnits`, `readNumber`) |
| `markup.js` | the page: Get Started, Add Entry, Upcoming Doses, Current Trend, History, Goal Weights, Chart, Backup & sync, and the dose pop-up |
| `changelog.js` | version history |
| `data.js` | storage (`load` incl. first-run carry-over from the standalone, `persist`, `save`), cleaning (`normalizeBackup`, `cleanSites`, `cleanDosePlan`, `cleanVial`, `cleanPaceGoal`), backups (`A.data`: build/import) and sync merge (`combine`) |
| `trend.js` | math: weekly trend, pace goal & status, `model()`, goal status/ETA, dose totals |
| `render.js` | `renderAll` and each section: history, upcoming doses, stats, goals & season projections, SVG chart |
| `setup.js` | Get Started: one-time questions, dosing plan, anchor dose, injection sites, vial calculator, pace goal, `saveOneTimeInfo` |
| `doses.js` | dose schedule and its sites (worked out, never stored: `lastSite`, `nextSite`), the confirm / Not yet / postpone pop-up with its site menu, and `agenda` (the doses, for Momo's board) |
| `image.js` | the progress image (PNG) |
| `events.js` | `A.init` wiring, add entry/goal, and the hooks: `onTick`, `onKeydown`, `onReload`, `attention` (a due dose), `renderDev` ("Edit start-up info"), `bugState` |
| `bosco.css` | styles under `.app-bosco` |

## State (`A.S`)
`entries` [{ date "YYYY-MM-DD", weight|null, doseMg|null, medication|null, site: a `SITES` id|null (only with a dose; an unknown plain id from a newer version is kept) }] one per date, sorted · `goals` [numbers] high→low ·
`profile` { name, unit, medication, medicationAsked, dosingAsked, dosePlan, vial, paceGoal, sites, schemaVersion } (`sites`: the injection sites on, in `SITES` order;
null until changed in start-up info = `DEFAULT_SITES`; [] = sites off) · `unit` "lb"|"kg" ·
UI: `rateMode`, `trendWindow`, `avgWindow`, `currentPage`, `entryDateDefault`, `dosingAsking`, `paceAsking`, `vialEditing`, `anchorEditing`, `vialMode`, `doseAsking` (+ `site`, `picked`: the pop-up's site).

## Storage (`A.store`) and backups
Keys: `entries`, `goals`, `profile`, `doseSnooze` (this device's "Not yet"), `sync` and `meetings` (core's). First open reads the standalone's
`weightTrackerEntries_v1` / `weightTrackerGoals_v1` / `weightTrackerProfile_v1` (never changes them).
Backup JSON (Export, autosave files) = the standalone's format, so old backups import as-is: `{ schemaVersion: 4, appVersion, unit, name, medication, dosePlan, vial, paceGoal, sites, entries, goals, cumulativeDoseMgByMedication }`
(`sites`: as `profile.sites`; a file without them keeps yours, and where two saves combine the newer one's win).
Bump `DATA_SCHEMA_VERSION` only when import has to migrate data (see its comment in `app.js`).

## Shared with other apps
`A.agenda(from, to)` (read-only, through `K.agenda` — see `core/agenda.js`): the doses on those days, logged ones (`done`) and
the schedule's, each `{ id: "dose:<date>", title: "<Medication> dose", date, time: the usual dose time or null, minutes: 15, note: "<mg> mg" }`
(no injection site: the owner keeps it to Bosco). Momo's board shows them and remembers moves by `id`, so keep ids as they are.

## Invariants
- Dates are calendar-day strings; date math is UTC (`K.util`), and "today" is `K.util.todayStr()` (time-travel aware).
- One unit at a time: weights are stored in `S.unit` at 1 decimal; changing units converts everything.
- Doses are logged only by confirming a due dose; the schedule is derived from the plan, never stored.
- Each dose goes to the next site on after the one the last dose was logged at (worked out from the logged sites, never
  stored); a site off is skipped, and after the last one the rotation starts over. `SITES` ids are stored: never change one.
- The dosing plan and vial belong to one medication; where two versions meet, the later `savedAt` wins.
- Bug reports never include weights, doses, dates or names.
