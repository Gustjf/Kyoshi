# Bosco — weight tracker with projections (a Kyoshi app)
The app is called **Bosco** (its standalone original lives in the GitHub repo named Project-Wan-Shi-Tong, read-only).
Weigh-ins, a weekly pace goal, goal weights with ETAs and season projections, a chart, a shareable progress image,
and GLP-1 dosing (Tirzepatide, Semaglutide, Retatrutide): a dosing plan, one active vial, and doses logged only once confirmed.
Rules, versioning and the app contract: the root `CLAUDE.md`. Version & changelog: `changelog.js` (continues the standalone's).

## Files (load order)
| File | What's in it |
|---|---|
| `app.js` | `Kyoshi.register` (name, title, icon, 780px wide); constants (`MEDICATIONS`, `ONE_TIME_FIELDS`, limits, `DATA_SCHEMA_VERSION`); state `A.S`; helpers (weights & units, medication/plan/vial lookups, dose math, `fmtUnits`, `readNumber`) |
| `markup.js` | the page: Get Started, Add Entry, Upcoming Doses, Current Trend, History, Goal Weights, Chart, Backup & sync, and the dose pop-up |
| `changelog.js` | version history |
| `data.js` | storage (`load` incl. first-run carry-over from the standalone, `persist`, `save`), cleaning (`normalizeBackup`, `cleanDosePlan`, `cleanVial`, `cleanPaceGoal`), backups (`A.data`: build/import) and sync merge (`combine`) |
| `trend.js` | math: weekly trend, pace goal & status, `model()`, goal status/ETA, dose totals |
| `render.js` | `renderAll` and each section: history, upcoming doses, stats, goals & season projections, SVG chart |
| `setup.js` | Get Started: one-time questions, dosing plan, anchor dose, vial calculator, pace goal, `saveOneTimeInfo` |
| `doses.js` | dose schedule (worked out, never stored), the confirm / Not yet / postpone pop-up, and `agenda` (the doses, for Momo's board) |
| `image.js` | the progress image (PNG) |
| `events.js` | `A.init` wiring, add entry/goal, and the hooks: `onTick`, `onKeydown`, `onReload`, `attention` (a due dose), `renderDev` ("Edit start-up info"), `bugState` |
| `bosco.css` | styles under `.app-bosco` |

## State (`A.S`)
`entries` [{ date "YYYY-MM-DD", weight|null, doseMg|null, medication|null }] one per date, sorted · `goals` [numbers] high→low ·
`profile` { name, unit, medication, medicationAsked, dosingAsked, dosePlan, vial, paceGoal, schemaVersion } · `unit` "lb"|"kg" ·
UI: `rateMode`, `trendWindow`, `avgWindow`, `currentPage`, `entryDateDefault`, `dosingAsking`, `paceAsking`, `vialEditing`, `anchorEditing`, `vialMode`, `doseAsking`.

## Storage (`A.store`) and backups
Keys: `entries`, `goals`, `profile`, `doseSnooze` (this device's "Not yet"), `sync` (core's). First open reads the standalone's
`weightTrackerEntries_v1` / `weightTrackerGoals_v1` / `weightTrackerProfile_v1` (never changes them).
Backup JSON (Export, autosave files) = the standalone's format, so old backups import as-is: `{ schemaVersion: 4, appVersion, unit, name, medication, dosePlan, vial, paceGoal, entries, goals, cumulativeDoseMgByMedication }`.
Bump `DATA_SCHEMA_VERSION` only when import has to migrate data (see its comment in `app.js`).

## Shared with other apps
`A.agenda(from, to)` (read-only, through `K.agenda` — see `core/agenda.js`): the doses on those days, logged ones (`done`) and
the schedule's, each `{ id: "dose:<date>", title: "<Medication> dose", date, time: the usual dose time or null, minutes: 15, note: "<mg> mg" }`.
Momo's board shows them and remembers moves by `id`, so keep ids as they are.

## Invariants
- Dates are calendar-day strings; date math is UTC (`K.util`), and "today" is `K.util.todayStr()` (time-travel aware).
- One unit at a time: weights are stored in `S.unit` at 1 decimal; changing units converts everything.
- Doses are logged only by confirming a due dose; the schedule is derived from the plan, never stored.
- The dosing plan and vial belong to one medication; where two versions meet, the later `savedAt` wins.
- Bug reports never include weights, doses, dates or names.
