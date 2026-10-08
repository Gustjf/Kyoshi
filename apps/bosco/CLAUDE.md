# Bosco — weight tracker with projections (a Kyoshi app)
The app is called **Bosco** (its standalone original lives in the GitHub repo named Project-Wan-Shi-Tong, read-only).
Weigh-ins, a weekly pace goal, goal weights with ETAs and season projections, a chart, a shareable progress image,
and GLP-1 dosing (Tirzepatide, Semaglutide, Retatrutide): a dosing plan, one active vial, doses logged only once confirmed,
each at the next injection site in rotation (the body parts take turns, each going through its own sites in an X).
Rules, versioning and the app contract: the root `CLAUDE.md`. Version & changelog: `changelog.js` (continues the standalone's).

## Files (load order)
| File | What's in it |
|---|---|
| `app.js` | `Kyoshi.register` (name, title, icon, 780px wide); constants (`MEDICATIONS`, `SITES` (22, part by part, each part's in its X), `PARTS` (the order they take turns), `LEGACY_SITES` (the old ids), `DEFAULT_SITES`, `GOAL_AVG_DAYS`, `ONE_TIME_FIELDS`, limits, `DATA_SCHEMA_VERSION`); state `A.S`; helpers (weights & units, medication/plan/vial lookups, dose math, `activeSites`, `siteLabel`/`siteShort`, `standsFor`, `partOf`, `sitesIn`, `fmtUnits`, `readNumber`) |
| `markup.js` | the page: Get Started, Add Entry, Upcoming Doses, Current Trend, History, Goal Weights, Chart, and the dose pop-up |
| `changelog.js` | version history |
| `data.js` | storage (`load` incl. first-run carry-over from the standalone, `persist`, `save`), cleaning (`normalizeBackup`, `cleanSites` (an old site turns on every site it's split into), `cleanSkips`, `cleanAsked` / `joinAsked` (start-up info's answers), `cleanDosePlan`, `cleanVial`, `cleanPaceGoal`), backups (`A.data`: build/import) and sync merge (`combine`) |
| `trend.js` | math: weekly trend, pace goal & status, `averaged` (the 7-day averages goals go by), `model()` (`w`, `wa`), goal status/ETA, dose totals |
| `render.js` | `renderAll` and each section: history, upcoming doses, stats, goals & season projections, SVG chart |
| `setup.js` | Get Started: one-time questions, dosing plan, anchor dose, injection sites (a group per body part), vial calculator, pace goal, `saveOneTimeInfo` |
| `doses.js` | dose schedule and its sites (worked out, never stored: `lastSites`, `nextSiteIn`, `nextSite`), the confirm / Not yet / postpone pop-up with its site menu (by body part), and `agenda` (the doses, for Momo's board) |
| `image.js` | the progress image (PNG): the weigh-ins (a dot each, joined by straight lines) and the goal table |
| `events.js` | `A.init` wiring, add entry/goal, deletes (they ask), and the hooks: `onTick`, `onKeydown`, `onReload`, `attention` (a due dose), `renderDev` ("Edit start-up info"; the next dose's site, Skip this site / Undo skips), `bugState` |
| `bosco.css` | styles under `.app-bosco` |

## State (`A.S`)
`entries` [{ date "YYYY-MM-DD", weight|null, doseMg|null, medication|null, site: a `SITES` or `LEGACY_SITES` id|null (only with a dose; an unknown plain id from a newer version is kept) }] one per date, sorted · `goals` [numbers] high→low ·
`profile` { name, unit, medication, medicationAsked, dosingAsked, dosePlan, vial, paceGoal, sites, skipSites, schemaVersion } (`medicationAsked`: the medication
question answered, here or on another device; `dosingAsked`: the version of the dosing questions answered (`DOSING_QUESTIONS_VERSION`; a later one counts as
answered, and it never goes down); `sites`: the injection sites on, in `SITES` order;
null until changed in start-up info = `DEFAULT_SITES` (the abdomen's 4 and the thighs' 12); [] = sites off; `skipSites`: the sites the next dose passes over, set in
Developer Mode, null once a dose is logged) · `unit` "lb"|"kg" ·
UI: `rateMode`, `trendWindow`, `avgWindow`, `currentPage`, `entryDateDefault`, `dosingAsking`, `paceAsking`, `vialEditing`, `anchorEditing`, `vialMode`, `doseAsking` (+ `site`, `picked`: the pop-up's site).

## Storage (`A.store`) and backups
Keys: `entries`, `goals`, `profile`, `doseSnooze` (this device's "Not yet"), `sync` and `meetings` (core's). First open reads the standalone's
`weightTrackerEntries_v1` / `weightTrackerGoals_v1` / `weightTrackerProfile_v1` (never changes them).
Backup JSON (Export, autosave files) = the standalone's format, so old backups import as-is: `{ schemaVersion: 4, appVersion, unit, name, medication, dosePlan, vial, paceGoal, sites, skipSites, asked, entries, goals, cumulativeDoseMgByMedication }`
(`sites`, `skipSites`: as in `profile`; a file without them keeps yours, and where two saves combine the newer one's win — for `skipSites`, whenever
the newer save has the field, so a device that logged the dose and forgot them wins).
`asked` (7.600 on): start-up info's answers, `{ medication: true|false, dosing: the version answered }` from `profile.medicationAsked` / `dosingAsked`.
Joined, never undone, so no `u`: asked on either save is asked (Import, a save taken whole and a combine alike), the dosing version only grows; a file
without it (an older copy) leaves yours. A device whose medication question wasn't answered takes the save's own `medication` with it ("none" or a
medication; before the doses' rule, which still answers it from a dose otherwise); one that answered keeps its own answer. Combining counts the
answers only as asked or not (`dataKey`), so two devices with different medication answers never keep saving back and forth.
Bump `DATA_SCHEMA_VERSION` only when import has to migrate data (see its comment in `app.js`).

## Shared with other apps
`A.agenda(from, to)` (read-only, through `K.agenda` — see `core/agenda.js`): the doses on those days, logged ones (`done`) and
the schedule's, each `{ id: "dose:<date>", title: "<Medication> dose", date, time: the usual dose time or null, minutes: 15, note: "<mg> mg" }`
(no injection site: the owner keeps it to Bosco). Momo's board shows them and remembers moves by `id`, so keep ids as they are.

## Invariants
- Dates are calendar-day strings; date math is UTC (`K.util`), and "today" is `K.util.todayStr()` (time-travel aware).
- One unit at a time: weights are stored in `S.unit` at 1 decimal; changing units converts everything.
- Doses are logged only by confirming a due dose; the schedule is derived from the plan, never stored.
- Injection sites, worked out from the logged sites, never stored: the body parts with a site on take turns (`PARTS`:
  abdomen, thigh, buttock, upper arm), each dose at the next part after the last dose's; within a part, at its next site
  on after the last one logged there (`SITES`' order for that part: the abdomen's and buttocks' X left upper → right
  lower → left lower → right upper, the thighs' twelve alternating legs and heights and swapping faces on each leg), or
  its first one on. A site off is passed over (a part's place in the X is kept); a part with none on is left out.
- An old site (`LEGACY_SITES`: `abd-l`, `thigh-l-upper`, …) stays as it is in the log and reads as it did; in the
  rotation it counts as the site it stands for (its side's upper, its height's front), and in `profile.sites` it turns on
  every site it was split into. `SITES` and `LEGACY_SITES` ids are stored: never change one.
- A skip (`profile.skipSites`, Developer Mode) is for the next dose only: it passes over those sites to its part's next
  one (the part keeps its turn; a part with all its sites on skipped gives its turn to the next), never leaving no site;
  confirming a dose sets it back to null.
- A goal is reached by the 7-day average (`GOAL_AVG_DAYS`, fixed, whatever the Average window shows): Reached once the
  latest average has passed it, dated the first day the average got there; ETAs, the season projections and the chart's
  goal tags go from the latest average, the chart's dots and line stay the weigh-ins. The progress image agrees.
- Deleting a weigh-in, a day with a dose or a goal always asks first; replacing a weigh-in asks too.
- The dosing plan and vial belong to one medication; where two versions meet, the later `savedAt` wins.
- Start-up info's answers travel with the data (`asked`): answered on one device, not asked on another.
- The progress image draws the weigh-ins as straight lines from one to the next, a dot at each (the latest bigger), over a soft fill; the page's
  chart is its own (`render.js`).
- Bug reports never include weights, doses, dates or names.
