# Phase 5: Badgermole (workouts) — the detailed plan
Planned with the owner on 2026-10-02 (the questions and answers are folded into Decisions). Read it when building Phase 5,
after roadmap.md's top sections and its Phase 5 section. **Where this plan and the roadmap's Phase 5 section differ, this
plan wins.** Once Phase 5 is ticked in roadmap.md (its Status line holds the decisions), delete this file.
Work on `main` as the roadmap says: one app commit, then one small follow-up commit (Momo first in the switcher).

## Context
Kyoshi is a home for small vanilla HTML/JS apps sharing one core (`core/`), with Momo (a weekly time budget) at the
centre: each app lists what it needs this week and next (`A.inbox`, core/inbox.js) and Momo fills the user's cards with
it. Phases 0–4b built the inbox, Today, meetings, Hawky (errands) and Iroh (goals). Phase 5 adds **Badgermole**, a
workout tracker: routines in a rotation ("program"), a session screen made for logging a set with one thumb between
sets, PRs, a streak, and workouts into Momo's "Workout" cards. No core or Momo change is needed: `fill: "block"` needs
with `date`/`done`/`from`/`due` are already handled (apps/momo/inbox.js; a block shortfall becomes a "Workout · Legs"
task, apps/momo/tasks.js:33), and card pop-ups show details (nothing to add in Momo).

**Read first** (as the roadmap says; every file's header says what's in it): root `CLAUDE.md` (rules, contract),
`roadmap.md` top sections + Phase 5 + Builder notes, `apps/_template/CLAUDE.md`, `apps/hawky/*` (the model app:
app.js, data.js, share.js, render.js, editor.js, events.js, markup.js, hawky.css, CLAUDE.md), `apps/appa/data.js`
(the device-only `timer` key: lines 35–39), `apps/appa/job-view.js` (`keepAwake`, the timer), `apps/appa/app.js`
(`niceMinutes`, `ESTIMATE_RUNS`), `apps/appa/schedule.js:12` (`remember`, the memo), `apps/appa/render.js:12`
(`showView`), `core/inbox.js` header, `apps/momo/inbox.js`, `apps/iroh/share.js` (weekly ids), `core/util.js`.

## Decisions (the owner's answers, 2026-10-02)
| Topic | Decision |
|---|---|
| Units | **Each set and routine line keeps the unit it was typed in** (`unit: "lb"|"kg"` on it). `settings.unit` only picks the unit for new sets and for display; values in the other unit show converted (1 decimal). Nothing is ever converted in storage. |
| Program | **Repeats allowed** in `program.order` (e.g. Upper, Lower, Upper, Lower). The next routine is still **worked out, never stored** (the suffix-match rule below), so it syncs by itself and self-heals when you do a routine out of order. |
| First run | A button **"Add the starter exercises"** in the empty Exercises section (never automatic: two devices adding would duplicate after sync): Squat, Bench press, Deadlift, Overhead press, Barbell row, Pull-up (bodyweight), Push-up (bodyweight). No sample routine. |
| Past sessions | **Editable**: the day pop-up lets you change any set's weight × reps, remove a set, add a set, and delete the session. PRs are computed, so history rewrites itself. |
| Session navigation | **Next and Back buttons, plus the routine's exercise list** on the session screen ("Squat 3/3 ✓ · Bench 1/3 · Rows 0/3"), tap one to jump. Unlogged sets just aren't stored. |
| Typing | The big weight and reps numbers are **number fields** (tap to type, phone number pad) with − / + beside them. |
| Bodyweight exercises | **Reps plus an optional added weight** (0 by default, smaller stepper). Best = most reps, ties by more added weight. |
| Best sets | On **each exercise's row** in the Exercises section: "Bench press · best 185 lb × 5 (est. 1RM 216) · Sep 12". No separate section. |
| Momo with no program | **Nothing** goes to Momo until at least one routine is in the program (done sessions always go). |
| Calendar | Month grid, **‹ › months back**, tap a day with workouts → that day's pop-up. No separate history list. |
| Dot on the icon | **Never** (no `A.attention`). |
| Icon | Lucide **"dumbbell"** in Earth Kingdom green `#65a30d`. |
| Progression | **Auto +1 step when all sets hit**: if last time every planned set of an exercise reached the routine's reps, the prefill is one step heavier (5 lb / 2.5 kg; a bodyweight exercise: +1 rep), with a small "↑ from last time" note. |
| Routine lines | `{ exerciseId, sets, reps, weight, unit }`: the same reps for every set. |
| Switcher | Badgermole **last** (after Iroh); then a **separate small commit moves Momo first** (styles and scripts) so it opens first on a new device. |
| Next up | Just the next routine with Start (no list of the week's rest). |
| Prefill | (1) **This session's latest logged set of that exercise** first (a change you typed carries on), else (2) the last stored session with that exercise: its set with the same number, else its last set of it — converted to the current unit and rounded to the nearest 0.5, with the progression rule applied — else (3) the routine's line. |
| After the last planned set | **The screen stays** on the exercise, showing "Set 4" (extra sets are allowed: ✓ logs "Set 4", "Set 5"…); "Next: Rows" is the only way on. No auto-advance, even after "Log all sets". |
| After Finish | Home comes back and **the day's pop-up opens on the session just logged** (its sets, PR marks, length; typos fixable right there). |

**The architect's own calls** (small; flip them if the owner objects at review):
- Finish with no set logged asks "Nothing was logged. Discard this session?" and stores nothing. "Cancel the session" (a link, confirm) always discards. A session left running for over `STALE_HOURS` (6) finishes at its last set's time (or started + 1 min), and `sessionMinutes` is capped at 300, so a forgotten session can't blow up the usual length.
- A session's `date` is the day it started; sets after midnight belong to it. `started`, `finished` and each set's `at` use `K.util.now()` (time-travel aware, as the day is); `u` stays `Date.now()`.
- The streak judges every week by the **current** target (no target history). Weeks run Monday–Sunday.
- The first set ever of an exercise is not a PR (nothing to beat).
- Deleting an exercise removes it from every routine's lines (those routines' `u` bump); sessions keep its name. Deleting a routine removes it from `program.order`. Dangling ids are also skipped wherever they're read, since sync can bring them back in another device's copy.
- The routine editor shows and saves weights in the current unit (a line's unit becomes the current one when the routine is saved after a change).
- Limits: exercise name ≤ 40, routine name ≤ 30 (Momo's need titles; "Workout" is the block), ≤ 20 lines a routine (an exercise once per routine), sets 1–10, reps 1–100 (0 allowed in a stored set only when editing), weight 0–2000 at up to 2 decimals, `weeklyTarget` 1–14 (default 3), `program.order` ≤ 50, ≤ 200 sets a session, checkup 15 min.

## Data (keys in `A.store`; core's `sync` and `meetings` beside them)
```
exercises [{ id, name ≤ 40, bodyweight: bool, deleted, at, u }]
routines  [{ id, name ≤ 30, items: [{ exerciseId, sets, reps, weight, unit }], deleted, at, u }]
program   { order: [routineId…] (repeats allowed), u }
sessions  [{ id, date, routineId, name (the routine's, as it was), sets: [{ exerciseId, name, bodyweight, n, reps, weight, unit, at }],
             started, finished, deleted, u }]        — `started` is its order (the lists' `at`)
settings  { unit: "lb" | "kg", weeklyTarget, u }     — defaults lb, 3
live      this device's session in progress, or null — NEVER synced, backed up, combined or counted:
          { id, date, routineId, name, started, items: [{ exerciseId, name, bodyweight, sets, reps, weight, unit }] (a copy of the
            routine's lines at start, so a routine or exercise edited or deleted meanwhile doesn't matter),
            sets: [the logged sets, as in a session], pos: { item, set }, show: { weight, reps } (the steppers as left) }
```
- A deleted item keeps only `{ id, deleted, at|started, u }` (markers, so sync can't bring it back).
- A set's `bodyweight` is the exercise's flag when it was logged (so `weight` means "added weight" for good); `n` is the set's number within that exercise in that session (1-based).
- **Backup**: `{ schemaVersion: 1, appVersion, exercises, routines, program, sessions, settings }` (core adds `meetings`). `looksLike = Array.isArray(raw.exercises) && Array.isArray(raw.sessions)` (no other app has both). Import JSON refuses a file with no live exercises *and* no live sessions (Hawky's "nothing in it" check), warns on a newer `schemaVersion`, confirms with counts ("your 12 exercises and 40 sessions"), then replaces the five; `live` stays.
- **Sync** (`combine`): the three lists merged item by item by `u` (copy `apps/appa/data.js:merge/newer/inOrder/dataKey`), `program` and `settings` whole, the newer `u` winning; `plain && no exercises && no sessions → null`. `live` is loaded apart in `load()` (`cleanLive(A.store.json("live"))`, like Appa's `timer`), written by `storeLive()` (`A.store.set` / `A.store.remove`; **no** `A.changed()`), and absent from `persist`, `build`, `combine`, `hasData`.
- `S.version` counts every change (persist, load, combine apply, storeLive) for the memo in stats.js (Appa's `remember`).

## The maths (stats.js; worked out, never stored; memoized by `S.version|today`)
- **Session order**: by `date`, then `started`, then `id`; sets within in array order. The live session's logged sets come after every stored session (for PRs during the session).
- `sessionMinutes(s)` = clamp(round((finished − started) / 60000), 1, 300). `usualMinutes(routineId)` = `niceMinutes(mean)` of the last `ESTIMATE_RUNS` (5) sessions of that routine; none → 60 (`DEFAULT_MINUTES`).
- `weekCount(monday)` = live sessions whose `mondayOf(date)` is that Monday (the live session doesn't count until finished). "This week N of target" = `weekCount(mondayOf(today))`.
- **Streak**: `n = weekCount(thisMonday) >= target ? 1 : 0`; then for each earlier Monday while `weekCount >= target`, `n++`; stop at the first short week. So this week counts once it hits the target and never breaks the streak while open; rest days are irrelevant. Shown "Streak: 4 weeks" / "No streak yet".
- **Next routine** (`nextIndex()`): `order` = `program.order` with dangling ids skipped; empty → none. `recent` = the routine ids of live sessions, latest first, keeping only ids in `order`, at most `order.length` of them; none → 0. For every position `p` with `order[p] === recent[0]`, count `k` while `order[(p − k) mod len] === recent[k]` (cycling backwards); take the `p` with the largest `k` (ties: the smallest `p`); next = `(p + 1) mod len`. `rotation(count)` = `order[(next + i) mod len]` for `i` in 0..count−1 (titles may repeat; that's fine).
- **Scores** (`scoreOf(set)`): weighted exercise → Epley on the weight in kg: `kg × (1 + reps / 30)`; bodyweight → compare reps, then added weight in kg. `bestOf(exerciseId)` = the top-scoring stored set (ties → the earliest), with its session date. `isPR(set, earlier)` = at least one earlier set of that exercise exists and this one beats them all; "earlier" = stored sessions before it in session order plus this session's sets logged before it. Computed at log time for the badge and recomputed for the day pop-up's marks.
- **Prefill** (`prefill(item, n)`): the rule in Decisions, returning `{ weight, reps, up: bool }` in the current unit (`up` = the progression step was added). Progression test: the last stored session with that exercise has ≥ `item.sets` sets of it and every one has `reps >= item.reps`.
- Units: `toKg(w, unit)`, `fromKg`, `convert(w, from, to)` (`LB_PER_KG = 2.2046226218`), `roundHalf`, `fmtWeight(w, unit)` → "185 lb" / "61.2 kg" in the current unit (1 decimal, no trailing zeros via `K.util.fmtNum`).
- Calendar: `monthCells("YYYY-MM")` → 6×7 cells from the Monday on or before the 1st, each `{ date, inMonth, sessions }`.

## Screens (phone-first: narrow, big tap targets; 780 px wide)
**Home** (`#homeView`), top to bottom:
1. **Next up** card: "Next up: Pull A" · "Last: Sep 28 · usually 45 min · 6 exercises" · big **Start** · "Pick another routine…" (a pop-up listing every live routine, one big button each → Start). With a `live` session instead: "Pull A in progress · 23 min · 3 sets" · **Resume** · "Discard". With routines but an empty program: "Add a routine to the program to see what's next" + "Pick a routine…"; with no routines: "Add your exercises and a routine below."
2. Two `.stat`s: **This week** "1 of 3" · **Streak** "4 weeks".
3. **Calendar**: "September 2026" with ‹ ›, a 7-column Mon–Sun grid; a day with sessions is filled (accent; "×2" when more); today outlined; other months' days muted. Tap a filled day → the day pop-up.
4. Setup sections, each a `<details>` (Hawky's folded `summary` style), **open on a wide window, folded ≤ 640 px** (set the `open` attribute at init from `window.innerWidth`):
   - **Exercises**: rows "Bench press · best 185 lb × 5 (est. 216) · Sep 12" (bodyweight: "best 12 reps +25 lb · Sep 3"), tap → the exercise pop-up; "Add exercise"; while none: "Add the starter exercises".
   - **Routines**: rows "Pull A · 6 exercises · usually 45 min", tap → the routine pop-up; "Add routine".
   - **Program**: the order as rows "1. Push · 2. Pull · 3. Legs" with ↑ ↓ ✕; "Add to program" (`<select>` of live routines + Add; repeats fine). Footnote: "Workouts go in this order, round and round. Momo asks for 3 a week in it."
   - **Settings**: unit (`.mode-toggle` lb / kg), weekly target (number 1–14). Changing the unit converts nothing (see Units).
5. Backup & sync (`<section data-kyoshi="backup">`).

**Session** (`#sessionView`, `S.view = "session"`, Appa's `showView` pattern; Home is hidden meanwhile):
- Head: routine name · "23 min" (elapsed, every 15 s) · "Exercise 2 of 6".
- The current exercise's name **big**; "Set 2 of 3" (beyond the plan: "Set 4").
- Weight: `−` [number field, `inputmode="decimal"`] `+` with the unit (step 5 lb / 2.5 kg); for a bodyweight exercise a smaller "Added weight" stepper (0 by default). Reps: `−` [number field] `+` (step 1). The prefill's "↑ from last time" note under the weight when `up`.
- Big **✓ Log set** · "Log all sets" (the remaining planned sets at the shown values; disabled once none remain). Neither moves on: after the planned sets the head reads "Set 4" and the exercise list "3/3 ✓", and only Next (or the list) changes exercise. Logged sets of this exercise listed under it ("1 · 135 lb × 5 ✓", "PR" badge when `isPR`); tapping one puts it back in the steppers and removes it (re-log).
- The routine's exercise list: "Squat 3/3 ✓ · Bench press 1/3 · Rows 0/3", the current one highlighted, tap to jump.
- Sticky bottom bar: **Back** · **Next: Rows** (on the last: "Last exercise") · **Finish**. "Cancel the session" link below.
- Finish: ≥ 1 set → the session is stored (`finished = now`, or the stale rule), `live` cleared, Home shown, and the day pop-up opens on it (its PR marks); 0 sets → discard after confirm.
- The screen stays awake while `live` and the app is on screen (copy `keepAwake` from apps/appa/job-view.js; `onShow`/`onHide`/`visibilitychange` as in apps/appa/events.js:53–63).

**Pop-ups** (`.overlay > .modal`, `K.modal.define` once with `pending`/`ask` like apps/hawky/editor.js):
- **Exercise**: name, "Bodyweight exercise" checkbox; Save (Enter) / Cancel / Delete ("used in 2 routines: it'll be removed from them; your logged sets keep its name").
- **Routine** (`.modal.wide`): name; a line per exercise: `<select>` (live exercises), sets, reps, weight (label shows the unit; "added weight" for a bodyweight one), ↑ ↓ ✕; "Add exercise" line; Save / Cancel / Delete ("it comes out of the program too").
- **Day** (`#dayOverlay`): "Tue, Sep 28": each session that day (routine name, "7:05–7:50 pm · 45 min"); its sets grouped by exercise, each a row with weight × reps number fields and ✕, "+ set" per exercise, "PR" marks; Delete session (confirm). Save / Cancel (pending check). Opened by the calendar, by Finish, and by Momo's "Open in Badgermole" (that session highlighted).
- **Pick a routine**: one button per live routine → starts it.

## Into Momo (share.js: `inbox(from, to)`, `open(id)`; copies made afresh each call)
```
done:    every live session with from ≤ date ≤ to, in session order →
         { id: "session:<id>", title: name || "Workout", block: "Workout", fill: "block", date, done: true,
           details: ["6 exercises", "42 min"] }
planned: only while liveOrder() has a routine. offset = 0; for monday = mondayOf(from); monday ≤ to; monday += 7 days:
           skip the week when addDays(monday, 6) < today; done = weekCount(monday); for k = 1 .. max(0, target − done):
           r = rotation[offset++]; n = done + k →
         { id: "next:<monday>:<n>", title: r.name, block: "Workout", fill: "block", minutes: usualMinutes(r.id),
           from: monday, due: addDays(monday, 6), details: ["6 exercises", last ? "Last: Sep 28" : "Not done yet"] }
```
- `rotation` starts at the next routine after the latest session overall, and `offset` runs on across weeks, so next week continues after this week's planned ones (order Push/Pull/Legs, target 3, Push done: this week Pull, Legs; next week Push, Pull, Legs).
- Ids are the week's slots (`n = done + k`): logging a session removes the lowest slot (its `session:` need, done, replaces it on that day) and the others keep their ids and titles; raising the target mid-week adds a slot, lowering removes the last.
- Momo does the rest: each need takes an empty "Workout" card between `from` and `due` (today onward), the surplus is a task "Workout · Legs" (apps/momo/tasks.js:33), a done one shows ✓ on its day's card and never goes to Tasks. Limits hold: block ≤ 40, title ≤ 60, details ≤ 8 × 100.
- `open(id)`: `"session:<id>"` → `showView("home")` then the day pop-up on that session (nothing if deleted); anything else (`"next:…"`) → `showView("home")`, scroll the Next up card into view and flash it (Hawky's `share.js:38–43`, core's `meeting-flash`).

## Files (`apps/badgermole/`, load order; each ≤ ~400 lines, a header saying what it owns)
| File | What's in it (and what to copy) |
|---|---|
| `app.js` | `K.register({ id: "badgermole", name: "Badgermole", title: "Badgermole — Workouts", subtitle, width: 780, backupNote (…"a session in progress stays on the device it started on"), meetings: [{ id: "checkup", title: "Checkup", every: "whenever", minutes: 15 }], icon })`. Constants: `DATA_SCHEMA_VERSION 1`, the limits above, `STEP { lb: 5, kg: 2.5 }`, `LB_PER_KG`, `BLOCK "Workout"`, `DEFAULT_MINUTES 60`, `ESTIMATE_RUNS 5`, `MAX_SESSION_MINUTES 300`, `STALE_HOURS 6`, `STARTER [...]`. State `A.S`: the five, `live`, `version`, `view`, `month`, `editing`, `day`, `knownToday`. Helpers: `cleanLine`, `fmtMinutes`, `fmtDay`, `sundayOf` (apps/hawky/app.js), `mondayOf` (apps/iroh/app.js:105), `niceMinutes` (apps/appa/app.js:89), the unit helpers, lookups (`liveList`, `exerciseById`, `routineById`, `sessionById`, `liveOrder`, `routineItems` (dangling exercises dropped, name/bodyweight attached), `sortedSessions`). |
| `markup.js` | `A.markup`: `#homeView`, `#sessionView` (hidden), the backup section, the four pop-ups. Ids unique within the app (`A.$`). |
| `changelog.js` | 1.000, 2026-10-02 (Hawky's format: a sentence on the app, one on Momo's Workout cards). |
| `data.js` | Cleaners (`cleanExercises`, `cleanRoutines`, `cleanProgram`, `cleanSessions`, `cleanSettings`, `cleanLive`; new items pass through them too), `load`, `persist`, `save`, `storeLive`, `A.data = { schemaVersion, build, looksLike, hasData, importBackup, combine, afterSync }`. Copy apps/appa/data.js (lists + settings merge, the device-only key) and Hawky's import checks. |
| `stats.js` | The maths above, with Appa's `remember` memo. |
| `share.js` | `inbox`, `open` (apps/hawky/share.js shape; the week loop of apps/iroh/share.js). |
| `render.js` | `showView`, `renderAll`, `renderHome` (next up, stats, calendar, exercises, routines, program, settings), `reveal` (flash). |
| `session.js` | `startSession(routineId)`, `resume`, `renderSession`, `step`, `logSet`, `logAll`, `relog`, `jumpTo`, `finish`, `discard`, `keepAwake`, `updateElapsed`. |
| `editors.js` | The exercise and routine pop-ups, the starter set, program edits (`addToProgram`, `moveInProgram`, `removeFromProgram`), the Pick a routine pop-up. Split in two (`exercise-editor.js`, `routine-editor.js`) if it passes ~400 lines. |
| `day.js` | The day pop-up: `openDay(date, sessionId?)`, editing sets, add/remove, delete session, Save. |
| `events.js` | `A.init`: `K.modal` wiring via the editors, click delegation by `data-act` (apps/hawky/events.js `ACTS`), settings changes, calendar ‹ ›, `setInterval(A.updateElapsed, 15000)`, `A.listen(document, "visibilitychange", …)`, folds open by width; hooks: `onShow` (renderAll + keepAwake), `onHide` (keepAwake off), `onTick` (a new day → renderAll; else updateElapsed), `onReload` (renderAll; a session view stays), `bugState` (counts only: exercises, routines, program length, sessions, live yes/no + sets logged, view, unit, target). No `attention`. |
| `badgermole.css` | Under `.app-badgermole`: the Next up card, stats, the calendar grid (7 columns, square-ish cells, filled days), the session screen (big type, 56 px steppers and ✓, the sticky bottom bar, the exercise list), the day pop-up's set rows, `.pr` badge (core's `.badge`), Hawky's `summary` chevron; `@media (max-width: 640px)` for thumbs. |
| `CLAUDE.md` | In Hawky's shape: purpose (Toph's badgermoles; Lucide dumbbell in green), Files, State, Storage & backups (incl. `live`), Its checkup, Shared with other apps (both need shapes, ids, `open`), Invariants. |

Icon (Lucide "dumbbell", ISC; from the architect's notes — **verify against lucide.dev if the network allows**, else use as is: it draws correctly):
```
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#65a30d" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.4 14.4 9.6 9.6"/><path d="M18.657 21.485a2 2 0 1 1-2.829-2.828l-1.767 1.768a2 2 0 1 1-2.829-2.829l6.364-6.364a2 2 0 1 1 2.829 2.829l-1.768 1.767a2 2 0 1 1 2.828 2.829z"/><path d="m21.5 21.5-1.4-1.4"/><path d="M3.9 3.9 2.5 2.5"/><path d="M6.404 12.768a2 2 0 1 1-2.829-2.829l1.768-1.767a2 2 0 1 1-2.828-2.829l2.828-2.828a2 2 0 1 1 2.829 2.828l1.767-1.768a2 2 0 1 1 2.829 2.829z"/></svg>
```

## Edge cases to honour
- **Two devices**: a live session never syncs; each device's Finish stores its own session (different ids), both count (documented, no guard). An exercise deleted on one device while another's routine still lists it: `routineItems` skips it everywhere, the routine editor shows "(deleted)" and drops it on Save, the live session is self-contained, sessions keep names. `program.order` naming a deleted routine: skipped by `liveOrder`. `program`/`settings` merge whole: the later `u` wins.
- **Import while live**: the five are replaced; `live` stays and Finish stores normally. A backup made by a newer version imports with the warning.
- **Time travel / test mode**: `A.store` writes stay in memory, so "+1 week three times with sessions" works and nothing persists; `date` from `todayStr()`, moments from `K.util.now()`.
- **Momo**: a done session dated outside `from–to` is left out (core/inbox.js drops it anyway); Momo asks from today, so earlier sessions still only reduce this week's planned count. A session done today with no Workout card today is dropped quietly (done needs never go to Tasks). Needs' `from: Monday` is before today for this week: fine, blocks exist from today on.
- **Wake lock**: `navigator.wakeLock` may be missing (file://, old browsers) or refuse: caught, nothing shown. Re-request on `visibilitychange` and `onShow`; release on `onHide`, Finish, Discard.
- **Midnight / forgotten**: the session keeps its start `date`; `onTick` at a new day redraws Home only; the stale rule on Finish.
- **Dangling and odd data** never throw: every cleaner drops what it can't use (a damaged file can't break the app), and every lookup tolerates a missing id.
- Bug reports and console messages: counts only, never exercise or routine names.

## index.html, versions, docs
- `index.html`: `<link rel="stylesheet" href="apps/badgermole/badgermole.css?v=…">` after Iroh's; the scripts after Iroh's block (app.js, markup.js, changelog.js, data.js, stats.js, share.js, render.js, session.js, editors.js, day.js, events.js), before `Kyoshi.start()`; then the build stamp: `sed -i "s/?v=[0-9][0-9-]*/?v=$(date -u +%Y%m%d-%H%M)/g" index.html`.
- `core/changelog.js`: new top entry **3.010** (2.910 + 0.100, as Hawky's and Iroh's additions): "Added Badgermole, for workouts: routines in a rotation, sets logged with one thumb between them, PRs and a streak; Momo fills your "Workout" cards with the week's sessions."
- Root `CLAUDE.md` map: `badgermole/  workouts: routines in rotation, set logging on the phone, PRs & streak (sessions into Momo's Workout cards)`. Momo's and core's CLAUDE.md need no change.
- `roadmap.md`: tick Phase 5 with a Status line holding the decisions above (as earlier phases did), drop its pointer to this file and delete this file; the Phase 6 "Read first" already names `apps/badgermole/share.js`.
- Commit 1: "Badgermole 1.000: workouts, sets logged on the phone, into Momo's Workout cards (Kyoshi 3.010)". Commit 2 (separate): move Momo's `<link>` and script block first among the apps in `index.html`, new stamp, Kyoshi **3.020** with "Momo comes first in the switcher and opens first on a new device."; nothing else depends on the order (K.order only sets the switcher, Export all and the inbox's app order).

## Verification (before pushing; roadmap's list, plus this plan's)
1. Open `index.html` from disk; switch to every app; console clean. Badgermole at phone width (≤ 640 px): setup sections folded, Next up and the steppers thumb-sized.
2. First run: "Add the starter exercises" → 7 exercises (2 bodyweight). Add a routine (3 lines), add it to the program twice with another in between (repeats): Next up names the right one; "Pick another routine" starts any.
3. Session: Start → prefill from the routine; ✓ logs a set with one thumb; set 2 prefills from the set 1 just logged; tap the number and type; Log all sets logs the rest and the screen stays ("Set 4") until Next; Back; jump from the list; a heavier set than the exercise's best shows PR (the first ever set doesn't); Finish → the day pop-up opens on the session with its PR marks; the calendar day fills; "This week 1 of 3".
4. Next session of the same routine: set 1 prefills from last time's set 1; after a session where every planned set hit the reps, the prefill is one step up with "↑ from last time"; a bodyweight exercise prefills +1 rep.
5. Units: switch to kg; old sets show converted (1 decimal), new sets log in kg; the best line and the day pop-up convert; switch back: the lb sets are exactly as typed.
6. Time travel (Developer Mode): +1 week three times with sessions logged each week → the streak counts; a short week breaks it; this week open doesn't.
7. Momo: target 3, program Push/Pull/Legs, three "Workout" cards this week → they fill in program order; a fourth Workout slot (target 4) goes to Tasks as "Workout · Push"; log one → ✓ on its day's card and the next slots keep their titles; next week's cards continue the rotation; with the program emptied, no Workout needs (done ones stay). "Open in Badgermole" from a done card → the day pop-up; from a planned one → Home's Next up flashes.
8. Day pop-up: fix a set's reps, remove one, add one, delete a session → the calendar, bests and Momo follow.
9. Export JSON → Import JSON (counts in the confirm; `live` untouched); Import all; a Hawky or Wan Shi Tong backup is refused ("doesn't look like a Badgermole backup").
10. Two tabs: a session finished in one shows in the other's calendar and in Momo within a minute; a session in progress stays in its own tab (reload: it resumes).
11. Phone (Android Chrome, through the sync folder): the screen stays on during a session; the number pad opens on tapping a number; the sticky bar stays reachable.
12. `/code-review` on the diff, then push to `main` (no checking the live site), tick the roadmap, update the CLAUDE.md files.

## Not now (the roadmap's list, kept)
Workout or rest timers, charts, imports, supersets, warm-up sets, a target history for the streak, a Momo need before a program exists, notifications.
