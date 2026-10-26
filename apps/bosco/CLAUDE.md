# Bosco — weight tracker with projections (a Kyoshi app)
The app is called **Bosco** (its standalone original lives in the GitHub repo named Project-Wan-Shi-Tong, read-only).
Weigh-ins, a weekly pace goal, goal weights with ETAs and season projections, a chart, a shareable progress image,
and GLP-1 dosing (Tirzepatide, Semaglutide, Retatrutide): a dosing plan, one active vial, doses logged only once confirmed,
each at the next injection site in rotation (the body parts take turns, each going through its own sites in an X);
and non-daily treatments (creams like tretinoin, tazarotene, glycopyrrolate: up to 8, a card each saying the day it was last taken; no schedule).
Rules, versioning and the app contract: the root `CLAUDE.md`. Version & changelog: `changelog.js` (continues the standalone's).

## Files (load order)
| File | What's in it |
|---|---|
| `app.js` | `Kyoshi.register` (name, title, icon, 780px wide); constants (`MEDICATIONS`, `RETINOIDS` (the old build-ups' retinoid names, for carry-over), the treatments' limits (`MAX_TREATMENTS`, `MAX_EVERY`, `DEFAULT_EVERY`), `SITES` (22, part by part, each part's in its X), `PARTS` (the order they take turns), `LEGACY_SITES` (the old ids), `DEFAULT_SITES`, `GOAL_AVG_DAYS`, `ONE_TIME_FIELDS`, limits, `DATA_SCHEMA_VERSION`); state `A.S`; helpers (weights & units, medication/plan/vial lookups, dose math, `activeSites`, `siteLabel`/`siteShort`, `standsFor`, `partOf`, `sitesIn`, `fmtUnits`, `readNumber`, `retinoidLabel`) |
| `markup.js` | the page: Get Started (with the Non-daily treatments list), Add Entry, Upcoming Doses, Non-daily treatments, Current Trend, History, Goal Weights, Chart, and the dose pop-up |
| `changelog.js` | version history |
| `data.js` | storage (`load` incl. first-run carry-over from the standalone, `persist`, `save`; a weigh-in or dose set: `setDay`, its stamp; a day deleted: `forget`, its marker), cleaning (`normalizeBackup`, `joinGone`/`cleanGone`, `cleanSites` (an old site turns on every site it's split into), `cleanSkips`, `cleanAsked` / `joinAsked` / `askedVersion` (start-up info's answers), `cleanDosePlan`, `cleanVial`, `cleanPaceGoal`; the treatments': treatments.js), backups (`A.data`: build/import, the `retinoids` key with them) and sync merge (`combine`, `mergeVersions`) |
| `trend.js` | math: weekly trend, pace goal & status, `averaged` (the 7-day averages goals go by), `model()` (`w`, `wa`), goal status/ETA, dose totals |
| `render.js` | `renderAll` and each section: history, upcoming doses (then the treatments': treatments.js), stats, goals & season projections, SVG chart |
| `setup.js` | Get Started: one-time questions, dosing plan, anchor dose, injection sites (a group per body part), vial calculator, pace goal, the Non-daily treatments list shown with them (treatments.js), `saveOneTimeInfo` (a treatment typed in added first) |
| `doses.js` | dose schedule and its sites (worked out, never stored: `lastSites`, `nextSiteIn`, `nextSite`), `dueAt`, the confirm / Not yet / postpone pop-up with its site menu (by body part), and `agenda` (the doses, for Momo's board) |
| `treatments.js` | the non-daily treatments: their data (`cleanRetinoids` (an old retinoid regimen read as a treatment), `mergeRetinoids`, `stampAbove`), `treatments`, `lastTaken`, `lastWords` ("10/25 - (yesterday)"), the section (`renderTreatments`: a card each, Took it today / Undo), start-up info's list (`renderTreatmentsSetup`, `addTyped`: add, rename in place, Remove), Developer Mode's days between (`renderDevTreatments`); `initTreatments` (from `A.init`) |
| `image.js` | the progress image (PNG): the weigh-ins (a dot each, joined by straight lines) and the goal table |
| `events.js` | `A.init` wiring, add entry/goal, deletes (they ask), and the hooks: `onTick`, `onKeydown`, `onReload`, `attention` (a due dose), `renderDev` ("Edit start-up info"; the next dose's site, Skip this site / Undo skips; the treatments' days between), `bugState` |
| `bosco.css` | styles under `.app-bosco` |

## State (`A.S`)
`entries` [{ date "YYYY-MM-DD", weight|null, doseMg|null, medication|null, site: a `SITES` or `LEGACY_SITES` id|null (only with a dose; an unknown plain id from a newer version is kept), wu, du: when its weigh-in, its dose last changed (`Date.now()`; each only with its part, once it has one, 7.601 on: a weigh-in added or replaced, a dose logged, an import), typed: { weight, unit }: the weigh-in as typed, only while it shows in the other unit (8.813 on; `typedAs`; an older copy drops it, and one that no longer shows as `weight` is ignored) }] one per date, sorted · `gone` [{ date, wu, du }]: the deleted days' markers, one per date, kept apart from `entries` so nothing else sees them, and for good: the stamps of the weigh-in and the dose each deletion took (0: unstamped; a part's only when it had one; the latest of each) · `goals` [numbers] high→low · `goalsAsEntered` [{ weight, unit }]: each goal as typed, in `goals`' order (8.812 on); goals are always converted from it, so a goal never drifts as units change ·
`profile` { name, unit, medication, medicationAsked, dosingAsked, dosePlan, vial, paceGoal, sites, skipSites, schemaVersion } (`medicationAsked`: the medication
question answered, here or on another device; `dosingAsked`: the version of the dosing questions answered (`DOSING_QUESTIONS_VERSION`; a later one counts as
answered, and it never goes down); `sites`: the injection sites on, in `SITES` order;
null until changed in start-up info = `DEFAULT_SITES` (the abdomen's 4 and the thighs' 12); [] = sites off; `skipSites`: the sites the next dose passes over, set in
Developer Mode, null once a dose is logged) · `unit` "lb"|"kg" ·
`retinoids` { regimens, log } (`treatments.js`; the key keeps the name of the retinoid build-ups it held 8.601–8.937): a treatment { id, name (≤ 40
characters), every: days between (1–90, a new one's 3; only lights its card), at (when added: the order), u, x? (removed) }; a log record
`{ id: "<treatment id>:<date>", r, date, u, x? (undone) }`, one per treatment per day. An old regimen { retinoid, pct, where, time, start, steps, next, … }
reads as a treatment named after its retinoid (`retinoidLabel`), every its last step's days; its log is the same ·
UI: `rateMode`, `trendWindow`, `avgWindow`, `currentPage`, `entryDateDefault`, `dosingAsking`, `paceAsking`, `vialEditing`, `anchorEditing`, `vialMode`, `doseAsking` (+ `site`, `picked`: the pop-up's site).

## Storage (`A.store`) and backups
Keys: `entries`, `gone`, `goals`, `goalsAsEntered`, `profile`, `retinoids` (the non-daily treatments), `doseSnooze` (this device's "Not yet"; the old `retinoidSnooze` is removed on load), `sync` and `meetings` (core's). First open reads the standalone's
`weightTrackerEntries_v1` / `weightTrackerGoals_v1` / `weightTrackerProfile_v1` (never changes them).
Backup JSON (Export, autosave files) = the standalone's format, so old backups import as-is: `{ schemaVersion: 4, appVersion, unit, name, medication, dosePlan, vial, paceGoal, sites, skipSites, asked, retinoids, entries, gone, goals, goalsAsEntered, cumulativeDoseMgByMedication }`
(`goals` stay numbers in the file's unit, so older copies read them; `goalsAsEntered`, when there, says how each was typed, and every goal from either save keeps its own)
(`sites`, `skipSites`: as in `profile`; a file without them keeps yours, and where two saves combine the newer one's win — for `skipSites`, whenever
the newer save has the field, so a device that logged the dose and forgot them wins).
`asked` (7.600 on): start-up info's answers, `{ medication: true|false, dosing: the version answered }` from `profile.medicationAsked` / `dosingAsked`.
Joined, never undone, so no `u`: asked on either save is asked (Import, a save taken whole and a combine alike), the dosing version only grows; a file
without it (an older copy) leaves yours. A device whose medication question wasn't answered takes the save's own `medication` with it, if this
version knows it ("none" or a medication; the doses' rule then leaves it alone, and still answers the question from a dose otherwise); one that
answered keeps its own. The dosing version is taken if this device's medication question was answered, by itself or by the save (one a dose answered
just now, or none, leaves the dosing questions to be asked).
Combining counts the answers only as asked or not, and the dosing version (`dataKey`; cleaned, `medication` is that yes or no and `answer` the
answer), so two devices with different medication answers never keep saving back and forth; an older copy's save, without them, isn't set apart by
them (no saving back for it, which would stamp ours newer than its next change).
Sync combines day by day and part by part (`mergeVersions`, 7.601): the weigh-in (with its `typed`), and the dose with its medication and its site, each take
the later change to them (`wu`, `du`; with neither stamped, or a tie, the more recent save's, as before 7.601), and a part only one save has
comes along. A marker deletes, on either side, the versions of the parts it names up to its stamps, so a part changed after them stays: a
dose logged on a device that hadn't seen the deletion, a day weighed in again (it doesn't get its old dose back). A stamp set here is
always later than the version it replaces and than its marker, whatever the clocks say (`above`: another device's may run ahead). An import
counts as a change made here now (every part stamped above every version of it known here), so a restored backup sticks on every device and
its days win over older changes there; this device's markers stay (a day deleted here that the backup lacks stays deleted). A save taken
whole keeps its own stamps. `load` puts a part this device set again after deleting its day back above its marker, should an older
tab have stripped its stamp (in memory, kept with the next change). `hasData` counts the markers too. Goals as before (every one from
either). An older file has neither stamps nor `gone` (its days count as unchanged, nothing deleted), and an older copy of Bosco drops both
when it saves: reload Bosco on every device after updating. Combining an older copy's save leaves the stamps and markers out of `same`, as for
the answers.
`retinoids` (8.601 on): the same object as the store key. Both lists merge record by record by the later change (`u`; `K.util.mergeById`), in
Import, a save taken whole and a combine alike; a file or save without the key (an older copy) leaves ours, and isn't set apart nor saved back for
by it alone (`same`, as for `asked`). Import counts as a change made here now: the backup's records are stamped above ours, so the backup wins where
both have a record, and keeps what it doesn't have. Nothing is deleted: a removed treatment and an undone day are markers (`x`, a later
`u`). `hasData` counts a treatment (a marker too). An older copy of Bosco drops the key when it saves: reload Bosco on every device after updating.
Bump `DATA_SCHEMA_VERSION` only when import has to migrate data (see its comment in `app.js`).

## Shared with other apps
`A.agenda(from, to)` (read-only, through `K.agenda` — see `core/agenda.js`): the doses on those days, logged ones (`done`) and
the schedule's, each `{ id: "dose:<date>", title: "<Medication> dose", date, time: the usual dose time or null, minutes: 15, note: "<mg> mg" }`
(no injection site: the owner keeps it to Bosco). Momo's board shows them and remembers moves by `id`, so keep ids as they are.
The non-daily treatments never go to Momo (the owner's choice, 2026-10-12, for the retinoids): no event on the board, no need in the inbox; their
reminder is Bosco's own amber card. Don't add them to `A.agenda` or an `A.inbox`.

## Invariants
- Dates are calendar-day strings; date math is UTC (`K.util`), and "today" is `K.util.todayStr()` (time-travel aware).
- One unit at a time: weights are stored in `S.unit` at 1 decimal; changing units converts everything, from how each was typed (weigh-ins: `typed`; goals: `goalsAsEntered`), so nothing drifts going back and forth.
- History's last page is filled out to 7 rows with blank ones (when there's more than one page), so the page buttons never move.
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
- Deleting a weigh-in, a day with a dose or a goal always asks first; replacing a weigh-in asks too. A deleted day leaves its marker
  (`gone`), so another device's copy of what was deleted doesn't come back; what it never saw (a later stamp) stays.
- The dosing plan and vial belong to one medication; where two versions meet, the later `savedAt` wins.
- Start-up info's answers travel with the data (`asked`): answered on one device, not asked on another.
- The progress image draws the weigh-ins as straight lines from one to the next, a dot at each in a white ring (the latest bigger), over a soft
  fill: every ring before any dot; a ring over the line (setting its weigh-in apart), or under it for a weigh-in close to the one before or after
  (less than a ring's width along the dates, or a line under 20 px between), or the rings would whiten the line. The page's chart is its own
  (`render.js`).
- Non-daily treatments (the owner's choice, 2026-10-26: flexibility over a schedule): no schedule, no pop-up, no switcher dot. A card each: the day
  last taken, "M/D - (today|yesterday|n days ago)" (the year too when it isn't this one), or "Not taken yet"; amber once `every` days have passed
  (never while today's is logged). Took it today logs today; Undo (while today's is the last) makes its record a marker. Names are set in start-up
  info (renamed in place, saved at once), the days between in Developer Mode. A removed treatment and an undone day are markers (`x: true`, a later `u`).
- Bug reports never include weights, doses, dates or names (the treatments: counts only).
