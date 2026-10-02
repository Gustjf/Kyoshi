# Badgermole — workouts (a Kyoshi app)
Workouts as routines ("Pull A": its exercises, each with sets × reps at a weight) done in a rotation (the program,
repeats allowed: Upper, Lower, Upper, Lower). Home says what's next with a big Start; the session screen is made for a
glance between sets: the exercise big, "Set 2 of 3", weight and reps prefilled from last time (a step heavier once every
set hit its reps), − / + beside number fields, ✓ to log a set with one thumb, a PR badge the moment one beats the
exercise's best. Then this week's count against the weekly target, the streak (weeks in a row that hit it), and a month
calendar whose days open to fix what was logged. **Momo** decides when: the week's workouts fill your "Workout" cards in
program order, one a card. Named after Toph's badgermoles (the icon is Lucide's dumbbell, in Earth Kingdom green).
Rules, versioning and the app contract: the root `CLAUDE.md`. Version & changelog: `changelog.js`.

## Files (load order)
| File | What's in it |
|---|---|
| `app.js` | `Kyoshi.register` (name, title, icon, 780px wide, backup note, its checkup); constants (limits, `STEP` 5 lb / 2.5 kg, `LB_PER_KG`, `BLOCK` "Workout", `DEFAULT_MINUTES` 60, `ESTIMATE_RUNS` 5, `MAX_SESSION_MINUTES` 300, `STALE_HOURS` 6, `STARTER`, `DATA_SCHEMA_VERSION`); state `A.S`; helpers (text, minutes, `mondayOf`/`sundayOf`, `fmtDay`, units: `toKg`, `convert`, `inUnit`, `shownWeight`, `fmtWeight`, `fmtSet`; lookups: `liveExercises`, `liveRoutines`, `…ById`, `liveOrder`, `routineItems`, `sortedSessions`, `numbered`) |
| `markup.js` | the page: Home (Next up, stats and calendar, the setup folds, Backup & sync), the session view, and the pop-ups (exercise, routine, day, Pick a routine) |
| `changelog.js` | version history |
| `data.js` | cleaning (every copy, new ones too), `load`, `persist`/`save`, `storeLive`, backups and sync merge (`A.data`) |
| `stats.js` | the maths, remembered until the data or the day changes: session minutes and a routine's usual, week counts and the streak, `nextIndex`/`upNext`, bests and PRs, `prefill`, `monthCells` |
| `share.js` | what Momo reads (`inbox`) and opens (`open`) |
| `render.js` | `showView` (home or session), `renderAll`, Home (Next up, stats, calendar ‹ ›, Exercises with bests, Routines, Program, Settings), `reveal` |
| `session.js` | the session: start, steppers, ✓ / Log all sets, a logged set tapped to change (held), jump, Back / Next, Finish, Cancel (starting and ending a session tell `K.wakeLock`); the elapsed minutes; Pick a routine |
| `editors.js` | the exercise and routine pop-ups, the starter exercises, program edits, settings |
| `day.js` | the day pop-up: a day's sessions, their sets to fix, add or remove, Delete session |
| `events.js` | `A.init` wiring and the hooks: `onShow`, `awake` (a session in progress keeps the screen on: core/wakelock.js), `onTick`, `onReload`, `attention` (a dot when today's workout is needed for the week's target), `bugState` |
| `badgermole.css` | styles under `.app-badgermole` |

## State (`A.S`)
Saved and synced (each list item keeps `deleted`, `at` (a session: `started`) and `u`; a deleted one keeps only those, as a marker):
- `exercises` [{ id, name ≤ 40, bodyweight, deleted, at, u }]: a bodyweight exercise logs reps plus an added weight.
- `routines` [{ id, name ≤ 30, items: [{ exerciseId, sets 1–10, reps 1–100, weight 0–2000, unit }] (≤ 20, each exercise once), deleted, at, u }]
- `program` { order: [routineId…] (≤ 50, repeats allowed), u }: the next routine is worked out, never stored (stats.js `nextIndex`:
  the place whose run of routines, read backwards, best matches the latest sessions), so it syncs by itself and sets itself
  right after a routine done out of order.
- `sessions` [{ id, date (the day it started), routineId, name (the routine's, as it was), sets: [{ exerciseId, name, bodyweight,
  n, reps, weight, unit, at }] (≤ 200), started, finished, deleted, u }]: a set keeps its exercise's name and kind as they were;
  `n` is its number within its exercise; reps can be 0 only by editing a past session (such a set never counts for bests).
- `settings` { unit: "lb" | "kg", weeklyTarget 1–14 (3), u }
This device only: `live` (the session in progress: a copy of the routine's lines at start, the sets logged, `pos.item`, the
steppers as left in `show`, and `held`: a logged set tapped to change, out of `sets` until it's logged again in its place, or
put back as it was on moving on or Finish), `version` (counts every change to the stored data, for stats.js's memo; the session
in progress isn't in it), `view` ("home" | "session": "← Home" leaves the session running, Home's Resume goes back), `month`,
`editing`, `day`, `knownToday`.

**Units:** each set and routine line keeps the unit it was typed in; `settings.unit` picks the unit for new sets and for
showing (others converted, 1 decimal). Nothing is ever converted in storage: an edited line or set left as it was keeps its own.

## Storage (`A.store`) and backups
Keys: `exercises`, `routines`, `program`, `sessions`, `settings`, plus `live` (written by `storeLive`, never `A.changed()`:
not synced, backed up, combined or counted in `hasData`) and core's `sync` and `meetings`. Backup JSON: `{ schemaVersion: 1,
appVersion, exercises, routines, program, sessions, settings }` (plus core's `meetings`). `looksLike`: `exercises` and `sessions`
are both lists (no other app keeps both). Import JSON refuses a file with no live exercises and no live sessions, warns on a
newer `schemaVersion`, confirms with counts and replaces the five; a session in progress stays. Sync merges the three lists
item by item by `u` (Appa's merge) and `program` and `settings` whole, the later `u` winning.

## Its checkup
`meetings` in `app.js`: a 15-minute checkup, no schedule ("Last checkup: 12 days ago" with Done ✓; core/meetings.js).

## Shared with other apps
`A.inbox(from, to)` (core/inbox.js; read-only copies), all `block: "Workout"`, `fill: "block"` (one need a card):
- every session done between `from` and `to`, in order: `{ id: "session:<id>", title: its name, date, done: true, details:
  ["6 exercises", "42 min"] }` → ✓ on that day's Workout card (dropped quietly when there's none: done needs never go to Tasks);
- once a routine is in the program, for each week from `from`'s to `to`'s (skipping weeks already over): the weekly target less
  the sessions done that week, in program order from the next routine, the rotation running on into next week:
  `{ id: "next:<Monday>:<slot>", title: the routine's name, minutes: its usual length (60 before any), from: Monday, due: Sunday,
  details: ["6 exercises", "Last: Sep 28" or "Not done yet"] }`. A week's slots keep their ids as sessions are logged (logging
  takes the lowest); what no card covers is a "Workout · Legs" task in Momo.
`A.open(id)` (Momo's "Open in Badgermole"): a `session:` id opens Home and that day's pop-up on the session; a `next:` one
shows Home with Next up flashing.

## Invariants
- Stats, PRs, bests, the next routine and the streak are worked out, never stored. "Today" is `K.util.todayStr()`; a session's
  `started`, `finished` and each set's `at` are `K.util.now()` (time travel works); `Date.now()` is only for `at` and `u` stamps.
- Bests: a weighted set's estimated one-rep max (Epley, in kg), a bodyweight one's reps then added weight, compared within the
  exercise and kind; ties go to the earliest. A set is a PR when an earlier one of its exercise exists and it beats them all (the
  first ever never is); the session in progress comes after every stored one.
- Prefill: this session's latest set of the exercise; else the last session with it (its set with the same number, else its
  last), one step up (5 lb / 2.5 kg, a bodyweight one +1 rep) when every planned set of it reached the routine's reps; else the
  routine's line. Weights in another unit convert to the nearest 0.5.
- The streak judges every week (Monday to Sunday) by the current target; this week counts once hit and never breaks it while open.
- The dot on the icon (`A.attention`): once a routine is in the program, when today's workout is needed to keep this week's target
  (workouts left ≥ days left, today included) and none is logged today yet; it clears once one is.
- A session left running over `STALE_HOURS` ends at its last set; its minutes are capped at `MAX_SESSION_MINUTES`. A session
  past midnight stays on the day it started. One at a time per device: a reload resumes it.
- The steppers' typing is stored when a field is left (− / + at once), so it survives a reload without a write per key.
- Deleting an exercise takes it out of every routine (their `u` bumps); deleting a routine takes it out of the program; sessions
  keep the names. Dangling ids are skipped wherever they're read, since sync can bring them back.
- Every cleaner drops what it can't use, so a damaged file never breaks the app. Weeks run Monday to Sunday, as in Momo.
- Not now: workout or rest timers, charts, imports, supersets, warm-up sets, a target history, notifications.
- Bug reports and console messages hold counts only: never exercise or routine names.
