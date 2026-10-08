# Badgermole — workouts (a Kyoshi app)
Workouts as routines ("Pull A": its exercises, each with sets × reps at a weight; a line can go "to failure", its reps a
minimum, and two lines next to each other can be a superset) done in a rotation: a program (repeats allowed: Upper, Lower,
Upper, Lower), one of several, the one followed picked by hand (picking one starts it from its first routine). Home says
what's next with a big Start; the session screen is made for a glance between sets: the exercise big, "Set 2 of 3",
weight and reps prefilled from last time (heavier by the exercise's own progression step once every set hit its reps),
− / + beside number fields, ✓ to log a set with one thumb (in a superset it goes on to the partner), a PR badge the moment
one beats the exercise's best. Then this week's count against the weekly target, the streak (weeks in a row that hit
it), and a month calendar whose days open to fix what was logged. **Momo** decides when: each of the week's workouts is a card of its own
there, as long as its routine says (typed in its pop-up), in program order, waiting in its Tasks until you drag it onto a
day; a logged one shows ✓ on the card of the one it stands for. Named after Toph's badgermoles (the icon is Lucide's
dumbbell, in Earth Kingdom green).
Rules, versioning and the app contract: the root `CLAUDE.md`. Version & changelog: `changelog.js`.

## Files (load order)
| File | What's in it |
|---|---|
| `app.js` | `Kyoshi.register` (name, title, icon, 780px wide, backup note, its checkup); constants (limits, `MAX_PROGRAMS` 20, `MAIN_PROGRAM` "main", `STEPS` 2.5/5/7.5/10 lb, `DEFAULT_STEP` 5, `STEP` 5 lb / 2.5 kg (an exercise gone), `MAX_PAIR` 9, `LB_PER_KG`, `MIN_ROUTINE_MINUTES` 5, `DEFAULT_MINUTES` 60, `MAX_SESSION_MINUTES` 300 (a routine's minutes, and a session's at most), `STALE_HOURS` 6, `STARTER`, `DATA_SCHEMA_VERSION`); state `A.S`; helpers (text, minutes, `mondayOf`/`sundayOf`, `fmtDay`, units: `toKg`, `convert`, `inUnit`, `shownWeight`, `fmtWeight`, `fmtSet`; `stepOf` (an exercise's step in the unit shown); supersets: `fixPairs`, `pairClass`; lookups: `liveExercises`, `liveRoutines`, `livePrograms`, `…ById`, `activeProgram`, `liveOrder`, `routineItems`, `sortedSessions`, `numbered`) |
| `markup.js` | the page: Home (Next up, stats and calendar, the setup folds), the session view, and the pop-ups (exercise, routine, program, day, Pick a routine) |
| `changelog.js` | version history |
| `data.js` | cleaning (every copy, new ones too; the rotation from before programs becomes one), `load`, `persist`/`save`, `storeLive`, backups and sync merge (`A.data`) |
| `stats.js` | the maths, remembered until the data or the day changes: session minutes (a routine's are typed, never worked out), week counts and the streak, `nextIndex`/`upNext`, bests and PRs, `prefill`, `monthCells` |
| `share.js` | what Momo reads (`inbox`) and opens (`open`) |
| `render.js` | `showView` (home or session), `renderAll`, Home (Next up, stats, calendar ‹ ›, Exercises with bests, Routines, Program: the programs and the rotation followed, Settings), `reveal` |
| `session.js` | the session: start, steppers (− / + by the exercise's step), ✓ (on to a superset's partner) / Log all sets, a logged set tapped to change (held), jump, Back / Next, Finish, Cancel (starting and ending a session tell `K.wakeLock`); the elapsed minutes; Pick a routine |
| `editors.js` | the exercise pop-up (its step), the routine pop-up (how long it takes, to failure, supersets), the starter exercises, the programs (follow one, `#programOverlay`: new, rename, delete) and edits of the rotation followed, settings |
| `day.js` | the day pop-up: a day's sessions, their sets to fix, add or remove, Delete session |
| `events.js` | `A.init` wiring and the hooks: `onShow`, `awake` (a session in progress keeps the screen on: core/wakelock.js), `onTick`, `onReload`, `attention` (a dot when today's workout is needed for the week's target), `bugState` |
| `badgermole.css` | styles under `.app-badgermole` (the superset colours `.pair-1` to `.pair-5`) |

## State (`A.S`)
Saved and synced (each list item keeps `deleted`, `at` (a session: `started`) and `u`; a deleted one keeps only those, as a marker):
- `exercises` [{ id, name ≤ 40, bodyweight, step: 2.5 | 5 | 7.5 | 10 (lb, default 5), deleted, at, u }]: a bodyweight exercise
  logs reps plus an added weight; `step` is its progression step (in kg mode shown converted, to the nearest 0.5: +1, +2.5,
  +3.5, +4.5), hidden in the pop-up for a bodyweight one (it steps up a rep; its added weight's − / + still use it).
- `routines` [{ id, name ≤ 30, minutes 5–300 (how long it takes, typed in its pop-up; 60 until it is), items: [{ exerciseId,
  sets 1–10, reps 1–100, weight 0–2000, unit, toFailure, pair 0–9 }] (≤ 20, each exercise once), deleted, at, u }]:
  `toFailure`: the reps are a minimum ("8+"), go to failure and log the good reps;
  `pair`: a superset, the number exactly two lines next to each other share (0: none; `fixPairs` clears any other);
  `minutes`: its cards' length in Momo, planned and logged alike (Next up and its row on Home show it).
- `programs` [{ id, name ≤ 30, order: [routineId…] (≤ 50, repeats allowed), deleted, at, u }] (≤ 20 made by hand).
- `program` { order, active, since, u }: `active` the program followed ("" for none), `since` when it was picked (`K.util.now()`),
  `order` its rotation again (older copies read only that; every edit writes it). The next routine is worked out, never
  stored (stats.js `nextIndex`: the place whose run of routines, read backwards, best matches the latest sessions started
  since `since`), so it syncs by itself, sets itself right after a routine done out of order, and picking a program starts
  it from its first routine. Without a live `active` program, `program.order` is the rotation.
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
Keys: `exercises`, `routines`, `sessions`, `programs`, `program`, `settings`, plus `live` (written by `storeLive`, never
`A.changed()`: not synced, backed up, combined or counted in `hasData`) and core's `sync` and `meetings`. Backup JSON:
`{ schemaVersion: 1, appVersion, exercises, routines, programs, program, sessions, settings }` (plus core's `meetings`).
`looksLike`: `exercises` and `sessions` are both lists (no other app keeps both). Import JSON refuses a file with no live
exercises and no live sessions, warns on a newer `schemaVersion`, confirms with counts and replaces the six; a session in
progress stays. Sync merges the four lists item by item by `u` (Appa's merge) and `program` and `settings` whole, the later
`u` winning. `hasData` counts exercises, routines and sessions only.
**From before programs** (no live program, a non-empty `program.order`: old storage, an old backup or sync file),
`cleanAll` makes the rotation the program `{ id: "main", name: "Program", at and u: program.u }`, followed with `since` 0
(every session counts, so its next routine stays): the same on every device, so two doing it apart agree. Adding to the
rotation with no program followed (a first one) makes "Program" too (id "main" while that's free).

## Its checkup
`meetings` in `app.js`: a 15-minute checkup, no schedule ("Last checkup: 12 days ago" with Done ✓; core/meetings.js).

## Shared with other apps
`A.inbox(from, to)` (core/inbox.js; read-only copies), all `fill: "card"` (each a card of its own in Momo, titled by it):
- every session done between `from` and `to`, in order: `{ id: "session:<id>", title: its name ("Workout" without one), date,
  done: true, minutes: its routine's (as typed; its routine deleted: how long it took when that's 5 minutes or more, else
  60), of: "next:<Monday>:<k>"
  (k: its rank, 1-based by `started`, among its week's sessions — the k-th session takes slot k), time: when it started
  ("HH:MM", this device's clock), details: ["6 exercises", "took 42 min" (its clock time, when known)] }` → ✓ on the card
  of the slot it took, else Momo places one on its day at that time (done needs never go to Tasks);
- once a routine is in the program, for each week from `from`'s to `to`'s (skipping weeks already over): the weekly target less
  the sessions done that week, in program order from the next routine, the rotation running on into next week:
  `{ id: "next:<Monday>:<slot>", title: the routine's name, minutes: the routine's (as typed), from: Monday, due: Sunday,
  details: ["6 exercises", "Last: Sep 28" or "Not done yet"] }`. A week's slots keep their ids as sessions are logged (logging
  takes the lowest, numbered from the week's count + 1); each waits in Momo's Tasks ("Legs") until you place it.
`A.open(id)` (Momo's "Open in Badgermole"): a `session:` id opens Home and that day's pop-up on the session; a `next:` one
shows Home with Next up flashing.

## Invariants
- Stats, PRs, bests, the next routine and the streak are worked out, never stored. "Today" is `K.util.todayStr()`; a session's
  `started`, `finished` and each set's `at` are `K.util.now()` (time travel works); `Date.now()` is only for `at` and `u` stamps.
- Bests: a weighted set's estimated one-rep max (Epley, in kg), a bodyweight one's reps then added weight, compared within the
  exercise and kind; ties go to the earliest. A set is a PR when an earlier one of its exercise exists and it beats them all (the
  first ever never is); the session in progress comes after every stored one.
- Prefill: this session's latest set of the exercise; else the last session with it (its set with the same number, else its
  last), one step up (the exercise's `step`, "↑ +5 lb from last time"; a bodyweight one +1 rep) when every planned set of it
  reached the routine's reps (the minimum, for a line to failure); else the routine's line. Weights in another unit convert
  to the nearest 0.5. A set's logged reps are what was typed (for a line to failure: the good reps).
- Programs: one followed at a time, picked by hand (a tap); a new one starts empty and is followed once saved; deleting the
  one followed follows the first one left. Picking one (a tap, a new one, a deletion) stamps `since`, so it starts from its
  first routine; edits of its rotation keep `since`. Deleting a routine takes it out of every program.
- Supersets: ✓ (not Log all sets, nor re-logging a set tapped to change) on an exercise whose partner has planned sets left
  goes to the partner; with the partner done it stays. Moving a linked line up or down in the routine pop-up unlinks it, and
  a pair a move or removal splits is unlinked. Colours: `.pair-1` to `.pair-5` (the number, round again).
- The streak judges every week (Monday to Sunday) by the current target; this week counts once hit and never breaks it while open.
- The dot on the icon (`A.attention`): once a routine is in the program, when today's workout is needed to keep this week's target
  (workouts left ≥ days left, today included) and none is logged today yet; it clears once one is.
- A routine's length is typed (`minutes`), never worked out from its sessions (one logged after the fact lasts a minute or
  two by the clock): Momo's cards take it, planned and logged alike. A session's own clock time stays in the day pop-up, the
  session screen and its card's details ("took 42 min"). An older copy drops `minutes` when it saves, and while one still
  syncs it can put a routine back to 60 even untouched (a copy with the same `u` wins by its text, and "60" sorts after
  "45"; saving it again here doesn't hold): hence the changelog's "reload on every device".
- A session left running over `STALE_HOURS` ends at its last set; its minutes are capped at `MAX_SESSION_MINUTES`. A session
  past midnight stays on the day it started. One at a time per device: a reload resumes it.
- The steppers' typing is stored when a field is left (− / + at once), so it survives a reload without a write per key.
- Deleting an exercise takes it out of every routine (their `u` bumps); deleting a routine takes it out of the program; sessions
  keep the names. Dangling ids are skipped wherever they're read, since sync can bring them back.
- Every cleaner drops what it can't use, so a damaged file never breaks the app. Weeks run Monday to Sunday, as in Momo.
- Not now: workout or rest timers, charts, imports, warm-up sets, a target history, notifications.
- Bug reports and console messages hold counts only: never exercise or routine names.
