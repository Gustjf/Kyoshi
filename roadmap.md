# Kyoshi roadmap: a life system with Momo at the center
The plan for the next phases and apps, agreed 2026-10-02; the detail for phases 3–7 was added the same day, once 0–2 were
built. Read it when starting a phase (the top sections and your own phase; skip the other phases); tick the phase off when it's done.

## Status
Each finished phase gets a line saying what was decided along the way.
- [x] Phase 0: Momo's inbox and blocks (2026-10-02). `K.inbox` (core/inbox.js) + `A.inbox`/`A.open`. A need names its `block` (the card title; its own title if left out) and its `fill`: "time", "block" or "ongoing" (never used up, for Wan Shi Tong's in progress). `date` = that day; `due` = on or before (overdue = soonest); else the app's order. Timed needs go in whole, never split. Timed shortfalls make one Tasks card per block title. Done needs show ✓ and never go to Tasks. Any card from today on is a block, baseline-loaded ones included, whole days for now. Appa sends one need per job. Momo's goals stay a Tasks source until Phase 4.
- [x] Phase 1: Momo Today (2026-10-02). `apps/momo/today.js`; `S.today` picks Today or the board (Today when the window is phone-narrow, ≤ 640px, at load). Today and tomorrow only; earlier today isn't shown. A card inside another shows as its own row, its block in parts around it. Free time is time no card has (a "Free time" card shows as a card), split around events; an unplanned day shows "Nothing's planned" instead of 24h free. Events in conflict are red-edged, as on the board. Tapping a card: its times, goal, what fills it with "Open in <App>", and Edit card (the board's editor); tapping an event: its board pop-up. Those pop-ups put the board's tab on that week first.
- [x] Phase 2: Meetings (2026-10-02, on a branch). `core/meetings.js` (K.meetings); each app names its meeting's defaults in `K.register` (`meetings`), and core does the rest. The line sits under the app's name: what it's about, how often, last met, Done ✓; tapping it changes how often, how long and last met. Kept under each app's `meetings` key (core's), carried in sync files and backups next to `savedAt`/`sync`, merged meeting by meeting by the latest change (an import never sets one back). First meetings are due right away and take the soonest Meeting block; the dot comes the next day. A meeting fills a "Meeting" card in the week before it's due (the inbox's new `from`), or the soonest once overdue; Momo's comes last. One met today shows ✓ on today's block. Time travel gained +1 month. Then Bosco, Momo, Wan Shi Tong and Appa dropped their meetings, as they're used daily, for a checkup each: `every: "whenever"` (no schedule) shows "Last checkup: 12 days ago" with Done ✓, never due and never in Momo; picking a schedule in its settings makes it a meeting again. Scheduled meetings stay for apps reviewed less often, likely just Iroh.
- [x] Phase 3: Hawky (2026-10-02). `apps/hawky/`, Lucide's bird in teal, a 15-minute checkup. Quick add: after each add the text clears and keeps its focus and the chips go back to no day and 15 min; tapping a chip or Add leaves the phone's keyboard up; Pick a day opens the browser's calendar where it can; Enter in the date or minutes field adds too; a short line says what was added. Weeks run Monday to Sunday, as in Momo. Each errand shows Tomorrow, its weekday this week, or its day, then its minutes; each group and the heading show their total time. Done: newest first, 50 at a time. Momo's "added" day is the real one (from `at`). The overdue dot is `DOT_WHEN_OVERDUE` in `app.js`. Hawky's and Wan Shi Tong's backups both keep `items`, so each one's Import JSON checks the items' shape (text or name) and refuses the other's, with counts in its confirm (Wan Shi Tong 2.252).
- [ ] Phase 4a: Iroh (goals ladder) + core: hours that spread, season meetings, +1 season
- [ ] Phase 4b: Momo logs hours at the close-out, goals leave Momo, Iroh shows progress
- [ ] Phase 5: Badgermole (workouts)
- [ ] Phase 6: Turtleduck (meals and groceries)
- [ ] Phase 7: People (keep in touch)

## How we work (each phase)
1. **Start a new session** and say "Phase N of roadmap.md". It reads the root CLAUDE.md (automatic), this file's top sections (Status through "What each app sends Momo") and its own phase, then the phase's **Read first** list. Nothing else up front: every file's header says what's in it.
2. **Plan mode for 4a, 4b, 5 and 6.** Phases 3 and 7 go straight to building.
3. **Before pushing:** build, then review the diff (`/code-review`). Check in the browser: the console, phone width, and time travel. Then push to `main`, or to a branch where the phase says so. A phase on a branch is merged (GitHub) before the next phase starts: each builds on the last.
4. **After pushing:** tick the phase here, note the decisions made, and keep the CLAUDE.md files current: the app's, Momo's when Momo changed, the root contract when core changed.
5. **The user** lives with each phase for a few days, then sends notes in one batch.
6. **Model:** the strongest for 4a and 4b (shared code, sync, stored data). 5 and 6 are big but self-contained: the strongest if the budget allows. A lighter model is fine for 3, 7 and small tweaks.

## Why
Stop spinning wheels:
- **Direction:** know what matters.
- **Allocation:** give it real hours. Every hour has a job, downtime included.
- **Execution:** run each day from the phone, with details one tap away.
- **Feedback:** use the apps daily, give each a checkup now and then, and review Iroh's goals at set meetings (month, season, year).

## Decisions
- **Momo is strictly the next two weeks:** this week and next (Mon–Sun), as now. Nothing further out goes into it.
- **Goals live in Iroh,** hours a week included.
  - Momo's own Goals section is removed, and Momo's brief changes with it.
  - Anything already saved there stays in the data and backups, untouched. There is no copy-over.
- **Blocks in Momo:** Momo decides *when*. Each app fills the user's blocks with *what*.
- **What actually happened** is reviewed weekly, by exception, at Momo's close-out: the plan is assumed to have happened, and you fix what didn't.
- **Phone:** Android with Chrome. Folder sync carries everything between phone and computer.
- **Card length:** a card with no length of its own starts at 60 minutes. Momo's `DRAW_HOURS` is 1 (done in Phase 0).
- **Meetings:** only for apps reviewed less often than daily, likely just Iroh. The rest are used daily and have a checkup instead: "Last checkup: 12 days ago" with Done ✓, no schedule or reminders.
- **Build order:** daily flow first.
- **Shared functions:** approved; see below.
- **Iroh's periods are seasons** (core/seasons.js: Spring, Summer, Fall and Winter, from the day each really starts). A season belongs to the year most of it falls in, so the winter that starts Dec 21, 2026 is "Winter 2027", the first of 2027's four. Iroh's season review is a meeting every season: core gains `every: "season"` in 4a.
- **The close-out reviews hours by card title.** Every title on the past week's board is listed with its planned hours; you lower what fell short and the rest stands. Momo keeps the result in the week (`spent`). Whether a workout, meal or errand happened is its own app's business (it already knows), so nothing is entered twice. With goals gone, the close-out comes up for every past week that had cards on days; Later still puts it off a week.
- **Momo → Iroh** is one read-only function, `Kyoshi.apps.momo.hoursSpent(title)`: hours per closed week for that title, as a copy.
- **Hours that spread** (`fill: "hours"`, 4a): a need that fills the blocks with its title in turn until its minutes are used up; what's left is one task. Timed needs still go in whole.
- **Tasks sizes a shortfall to the total** (as built in Phase 0): one task per block title, as long as what's missing, rather than 60-minute cards.
- **Turtleduck places meals by tapping** (tap a slot, pick; tap a meal to swap, remove or repeat it), no drag and drop.
- **Phase 4 is two phases:** 4a Iroh and core on `main`, so your goals exist in Iroh first; then 4b Momo's changes on a branch.
- **Birthdays are events** on their day (`A.agenda`, like a dose), not needs.
- **Limits for what apps send Momo:** block titles ≤ 40 characters (Momo's card titles), need titles ≤ 60, up to 8 detail lines of 100; ids stay the same for the same need; a done need carries its `date`.
- **Phases 0–3's briefs** came out of this file once built; their Status lines hold the decisions.

## The shape of the system
```
WHY      Iroh          10-yr → 5-yr → year → season (hours a week), each goal reconciled
WHAT     Hawky errands · Badgermole workouts · Turtleduck meals · People · Appa · Wan Shi Tong · Bosco
            │  each lists what it needs this week and next
WHEN     Momo          baseline + this week + next · blocks get filled · Today on the phone
            │  hours spent flow back (read-only)
REVIEW   each app daily, with a checkup now and then · Momo's weekly close-out (hours by title) · Iroh's meetings (month, season, year)
```
No app writes another app's data. Names are suggestions until the app is built.

## Meetings (defaults, each adjustable or off in its app)
Only for apps reviewed less often than daily. The others are used daily and have a checkup instead (no schedule: "Last
checkup: 12 days ago" with Done ✓; a schedule picked in its settings makes it a meeting). Core's meetings (`core/meetings.js`)
stay for the longer review periods, likely just Iroh's:
| App | Meeting | Every | About |
|---|---|---|---|
| Iroh | Reconcile the goals | month | 20 min |
| Iroh | Season review | season | 60 min |
| Iroh | Re-read the vision, set the year | year | 2 h |

`season` is new in core (4a): due at the first season start after the last time met. Daily: glance at Today, and drop
errands into Hawky as they come up.

## What each app sends Momo
Momo fills a card by its title (any case). The titles each app asks for, so you know what to call your cards:
| App | Block title | Fills it | ✓ shows when |
|---|---|---|---|
| core | Meeting | by time | met that day |
| Appa | `<Thing> maintenance` | by time, each job whole | recorded |
| Hawky | Errands | by time, each errand whole | ticked, on that day |
| Iroh | the goal's title | hours that spread over its cards | never: the close-out logs the hours |
| Badgermole | Workout | one session per block | logged, on that day |
| Turtleduck | Breakfast · Lunch · Dinner · Snack; Groceries | one meal per block, on its day; groceries by time | past days count as eaten; groceries once all ticked |
| People | Keep in touch (a birthday is an event on its day) | by time | Talked ✓, on that day |

Nothing to set up first: what no block covers shows in Tasks under the block's title, as long as what's missing; drag it onto a
day and the block exists, filled. Putting the routine blocks (Errands, Workout, the meals, Keep in touch, Meeting) in the
baseline saves the dragging each week.

## Phases (each gets its own detailed plan when started)

### Phase 4a: Iroh, the goals ladder (new app + core + one Momo file · `main` · plan mode · the strongest model)
- **Read first:** `core/inbox.js` (74 lines) and `fill()` in `apps/momo/inbox.js` (88 lines), for the new fill kind; in `core/meetings.js` the header, `EVERY`, `after()` and `stateOf()`; `core/seasons.js`; `travel` and `init` in `core/dev.js` with the time-travel buttons in `index.html`; `apps/_template/`; `apps/appa/share.js`. Not the rest of Momo.
- **Look:** Lucide's `compass`; 780 wide; meetings (below), no checkup.
- **Seasons** (helpers in `app.js` over `K.seasons.seasonStart`): a season's key is `"2026-fall"`, its label "Fall 2026"; `seasonOf(date)`, `yearOf(seasonKey)` (winter belongs to the year it mostly falls in: the next one), `currentSeason()`, `seasonsOf(year)` (winter, spring, summer, fall). A week belongs to its Monday's season.
- **Data** (keys `areas`, `goals`; backup `{ schemaVersion: 1, appVersion, areas, goals }`; merged item by item by `u` with delete markers, like Appa's lists):
  - `areas [{ id, name ≤ 30, vision ≤ 1000 (the 10-year picture), milestones ≤ 1000 (the 5-year ones), order, deleted, at, u }]`
  - `goals [{ id, areaId, period ("2027" for a year, "2026-fall" for a season), title ≤ 40 (it's Momo's block title), why ≤ 300, doneWhen ≤ 300, parentId (a season goal's year goal, or ""), hoursWeek or hoursTotal (one, or neither), next ≤ 200 (the next step), reconciled ("YYYY-MM-DD" or ""), status "open" | "done" | "dropped", deleted, at, u }]`
  - `RECONCILE_DAYS = 30`: a goal turns amber once it was reconciled longer ago.
- **Screens, phone-first:** **This season** on top (what you use): each open goal with its area, its chain ("→ Conversational by June → Bilingual by 2030": its year goal, then its area), hours a week or the total, next step, "reconciled 23 days ago" and Reconcile (sets today; also where the next step is edited and the goal marked done or dropped). **This year:** 3–5 goals with done-when and why, each listing its season goals. **Vision:** the areas, each with its picture and milestones; add, edit, reorder. Past seasons fold into **Earlier**; "Carry over" copies an open season goal into the new season (new id, same parent). In 4a a goal shows its planned hours only; progress comes in 4b.
- **Meetings** (`meetings` in `K.register`): `[{ id: "reconcile", title: "Reconcile the goals", every: "month", minutes: 20 }, { id: "season", title: "Season review", every: "season", minutes: 60 }, { id: "year", title: "Re-read the vision, set the year", every: "year", minutes: 120 }]`.
- **Core:**
  - `core/seasons.js` gains `seasonAfter(date)`: the first season start strictly after a day. `core/meetings.js`: `season` joins `EVERY` ("every season") and `after()`; a first meeting stays due right away (`since`).
  - `fill: "hours"` joins `FILLS` and the header in `core/inbox.js`: a need spread over the blocks with its title in turn, each taking the room it has, until its minutes are used; what's left is one timed shortfall. In `fill()` (`apps/momo/inbox.js`): for an hours need, go through the fitting blocks taking `min(room − used, remaining)` from each and adding the need to each; if `remaining > 0` and it isn't done, push `{ ...n, minutes: remaining }` to `short` (tasks.js already sizes the task from `minutes`).
  - Developer Mode's time travel gains **+1 season** (`core/dev.js`, `index.html`): to the next season's first day (`K.seasons.nextSeasons(1)[0].date`, time-travel aware).
- **Into Momo** (`apps/iroh/share.js`): for each open goal of a week's season with hours, one need per week whose Monday is in `from`–`to`: `{ id: "goal:<goalId>:<weekMonday>", title, block: title, fill: "hours", minutes: hoursWeek × 60 (a total: hoursTotal ÷ the season's weeks, rounded up to 15; 4b refines it to what's left ÷ the weeks left), from: Monday, due: Sunday, details: [the chain, "Next: …", "5 h a week"] }`. The card's pop-up shows the chain and the next step; what no card has room for is one task per goal, as long as what's missing. `A.open(id)`: show that goal.
- **Momo in 4a:** `inbox.js` only (the fill kind). Momo's own goals keep working until 4b; you enter your goals into Iroh by hand (no copy-over, as decided).
- **Verify:** one area, one year goal, two season goals (5 h a week; 20 h in total) → Momo cards titled the goal fill (a 2h card and a 1h card take 3h; the 2h left is one task), drag it → filled; tap a card → chain, next step, "Open in Iroh"; +1 week → next week's needs; +1 season → Season review due (Meeting card, dot the next day), This season empty, Carry over; +1 month → Reconcile amber; Export then Import; phone width; console clean.
- **Versions:** Iroh 1.000; Kyoshi +0.100 (Iroh, season meetings, hours that spread, +1 season); Momo +0.100.

### Phase 4b: Momo logs hours; goals leave Momo; Iroh shows progress (Momo + Iroh · on a branch, since stored data changes · plan mode · the strongest model)
- **Read first:** `apps/momo/CLAUDE.md`; `closeout.js` whole; `model.js`; `tasks.js`; in `data.js` `normalizeData`, `cleanGoal`, `buildBackup` and `mergeVersions`; the Goals section and goal pop-up in `markup.js` and `render.js`; the goal picker in `card-editor.js`; goal keys in `colors.js`; the goal line in `today.js`; `events.js`; `goal-editor.js` (to delete); goal styles in `momo.css`. Iroh: `app.js`, `render.js`, `share.js`.
- **Momo's data:** each week gains `spent: { "<title as typed>": hours }`, written at the close-out (15-minute grid; titles merged any case, the first spelling kept) and cleaned by `normalizeData` (titles ≤ 40, 0.25–168 h). It rides with the week's `u` (weeks merge whole in `mergeVersions`), so no new merge code. `goals` stays in the data, backups and merge exactly as now (`cleanGoal`, `mergeVersions`); nothing reads it. Cards keep `goalId` as read; the editor stops setting it. `DATA_SCHEMA_VERSION` stays 2: the change is additive, and old backups import unchanged.
- **The close-out** (`closeout.js`): due for every past week with cards on days. Its rows are the week's titles (cards on days, inner cards on their own; Free time and events left out) with their planned hours, a stepper each (0 to planned, 15-minute steps), Done = planned to start; Confirm writes `week.spent` and closes the week. Sunday's close-out-early stays; Reopen clears `spent`; a week with no cards closes quietly. The rows are "where the week went"; one line under them: hours planned on days, hours in no card.
- **Shared:** `A.hoursSpent(title)`: `{ "<weekMonday>": hours }` for the closed weeks, any case, a fresh copy. Momo's CLAUDE.md gets a "Shared with other apps" section for it, and the root CLAUDE.md's "Between apps" line adds "Iroh reads Momo's `hoursSpent`".
- **Goals leave Momo:** delete `goal-editor.js` and its script tag; take out the Goals section and goal pop-up (`markup.js`, `render.js`), the goal picker (`card-editor.js`), the goal line (`today.js`), goal tasks (`tasks.js`), goal wiring (`events.js`), goal styles (`momo.css`), and the goal maths in `model.js` (`liveGoals` through `weeklyNeed`) except what `cleanGoal` needs. `colors.js` keeps reading `g:` keys and stops offering them. Momo's CLAUDE.md: the brief loses "Long-term goals are sinking funds of target hours"; its close-out line becomes hours by title; the file map, State, Storage and Invariants follow.
- **Iroh shows progress** (`render.js`), under each season goal with hours: hours a week → "22 of 60 h, on pace" (spent = Momo's closed weeks in the season for that title; expected = hours a week × the weeks closed so far; on pace when spent ≥ expected − 1 h, else "6 h behind"); a total → "22 of 60 h · 38 h to go, 5 h a week to finish" (what's left over the weeks left, as Momo's old `weeklyNeed` did). Without Momo started, the plan only. `share.js`: a total's weekly need becomes (total − spent) ÷ the weeks left.
- **Verify:** time travel past a planned week → the close-out lists its titles; lower one; Confirm → `spent` in the Export; Iroh shows "4 of 5 h"; Reopen → gone again; an old Momo backup with goals imports, and exports them unchanged; no goals in Tasks or the card editor; two tabs: a close-out on one shows on the other; console clean.
- **Versions:** Momo +1 (goals out, the close-out rebuilt); Iroh +0.100; Kyoshi unchanged (only its CLAUDE.md).

### Phase 5: Badgermole, workouts (new app · `main` · plan mode)
- **Read first:** `apps/_template/`, the header of `core/inbox.js`, `apps/hawky/share.js` (the simplest feeder), `apps/appa/job-view.js` (the screen's wake lock), and `niceMinutes` with the timer's state in `apps/appa/app.js`.
- **Data** (keys `exercises`, `routines`, `program`, `sessions`, `settings`, plus `live`: this device's session in progress, never synced or backed up; the backup holds the five):
  - `exercises [{ id, name ≤ 40, bodyweight, deleted, at, u }]`, with a small starter set offered on first run (Squat, Bench press, Deadlift, Row, Overhead press, Pull-up…)
  - `routines [{ id, name ≤ 30 ("Pull A"), items: [{ exerciseId, sets, reps, weight }], deleted, at, u }]`
  - `program { order: [routineId…], u }`; the next routine is the one after the last logged session's (worked out, not stored)
  - `sessions [{ id, date, routineId, name (as it was), sets: [{ exerciseId, name, n, reps, weight }], started, finished, deleted, u }]`
  - `settings { unit: "lb" | "kg", weeklyTarget: 3, u }`
- **Screens:** Home: Next up ("Pull A", Start), this week N of the target, the streak, the month calendar (a plain grid, workout days filled in), and the setup sections (exercises, routines, program) folded on the phone. **Session, made for a glance between sets:** the current exercise big, "Set 2 of 3", weight × reps prefilled from the last session with that exercise (same set number, else the routine's), − / + (5 lb or 2.5 kg; one rep), ✓ logs the set as shown, "Log all sets" for the exercise, "Next: Rows" always visible, Finish. The screen stays awake while a session is on (Appa's wake lock). **PR badge** the moment a set beats the exercise's best: best = highest estimated one-rep max (Epley: weight × (1 + reps ÷ 30)); for bodyweight exercises, most reps. **Best sets** per exercise, with the date. **Streak:** weeks in a row that hit the weekly target, this week counting while it's still open; rest days never break it.
- **Into Momo** (`share.js`): sessions done between `from` and `to`: `{ id: "session:<id>", title: the routine's name, block: "Workout", fill: "block", date, done: true, details: ["6 exercises", "42 min"] }`; then, for this week and next, the weekly target minus the sessions done that week, in program order from the next routine: `{ id: "next:<weekMonday>:<n>", title: "<Routine>", block: "Workout", fill: "block", minutes: its usual length (the average of its last sessions; 60 before any), from: Monday, due: Sunday, details: ["6 exercises", "Last: Sep 28"] }`. Each takes an empty Workout block that week; extra ones go to Tasks as "Workout · Legs". `A.open(id)`: a done session's summary, or home with Start.
- **Not now:** workout or rest timers, charts, imports, supersets, warm-up sets.
- **Verify:** on the phone, log a set with one thumb; a heavier set shows the PR badge; +1 week three times with sessions logged → the streak counts; Momo: three Workout cards fill in program order and a fourth session goes to Tasks; log one → ✓ on its day's block; Export then Import; console clean.

### Phase 6: Turtleduck, meals and groceries (new app · `main` · plan mode)
- **Read first:** `apps/_template/`, the header of `core/inbox.js`, `apps/badgermole/share.js` (block needs with dates and done), `apps/wanshitong/editor.js` (an add/edit pop-up), `core/modal.js`.
- **Data** (keys `recipes`, `plan`, `checked`, `settings`; the backup holds all four):
  - `recipes [{ id, name ≤ 40, ingredients: [{ name, qty, unit }], steps ≤ 4000, prepMin, cookMin, servings, kcal, protein, carbs, fat (per serving), link, archived, deleted, at, u }]`. No photos.
  - `plan [{ id, date, meal: "breakfast" | "lunch" | "dinner" | "snack", recipeId or "", text (a quick meal without a recipe: "Shake", with its own kcal and protein if you like), servings, deleted, u }]`: one entry per planned meal; leftovers are another entry for the same recipe.
  - `checked { "<ingredient key>": { until: "YYYY-MM-DD", u } }`: ticked covers the planned uses up to `until`; a later meal that needs it un-ticks it.
  - `settings { kcalTarget, proteinTarget, staples: [names], u }`
- **Screens, phone-first:** **Plan:** 14 days from today, four slots a day (B · L · D · S) with the meal's name and kcal/protein, and the day's totals against the targets. Tap an empty slot → the recipe picker (search, recent first, "Quick meal…"); tap a planned meal → Remove · Swap · Also on… (pick days: leftovers) · Open recipe. **Recipes:** the list (search) and the pop-up: name, ingredient lines like "2 cups rice" (parsed to qty, unit and name; a line that doesn't parse is all name), steps, minutes, servings, nutrition, link; Archive or Delete; Archived folded. **Groceries:** the list from the plan, merged by name and unit, staples left off, tick boxes, "4 of 12", "from the plan through Oct 11". Meal times live in Momo's baseline: that's the eating routine.
- **Into Momo** (`share.js`): each plan entry between `from` and `to`: `{ id: "meal:<entryId>", title: the recipe (or the text), block: "Dinner" (the meal, capitalised), fill: "block", date, minutes: prep + cook (30 if none), details: ["650 kcal · 45 g protein", "Prep 15 · cook 30"], done: the day has passed }` → fills that day's Dinner block; a day without one → one "Dinner · Chili" task. Groceries, while unticked items remain: `{ id: "groceries:<firstDate>", title: "Groceries", block: "Groceries", minutes: 45, due: the day before the first planned meal that needs an unticked item (today if that's passed), overdue, details: ["12 items", "for Oct 5 – 11"] }`; once all are ticked, `done` with that day. `A.open(id)`: the recipe, or Groceries.
- **Not now:** photos, importing recipes from links, a pantry, nutrition databases (everything is typed in).
- **Verify:** plan three meals by tapping on the phone; the day's totals against targets; "2 cups rice" and "1 cup rice" merge into 3 cups; ticks stay and sync; Momo: the Dinner card reads "Chili · 650 kcal · 45 g protein", tap → the recipe; a Groceries card the day before; +1 day → yesterday's meals ✓; Export then Import; console clean.

### Phase 7: People, keep in touch (new app · `main` · straight to building · a lighter model is fine; name: Pabu, or Naga)
- **Read first:** `apps/_template/`, the headers of `core/inbox.js` and `core/agenda.js`, `apps/hawky/share.js`, `agenda` in `apps/bosco/doses.js` (an events feeder), `after()` in `core/meetings.js` (the cadence maths).
- **Data** (key `people`; backup `{ schemaVersion: 1, appVersion, people }`): `[{ id, name ≤ 40, every: "week" | "2weeks" | "month" | "quarter" | "year", how: "call" | "text" | "visit", minutes (text 10 · call 30 · visit 120, editable), last ("YYYY-MM-DD" or ""), note ≤ 300, birthday ("MM-DD", "YYYY-MM-DD" or ""), deleted, at, u }]`. Due = last + every (`addDays` / `addMonths`, as core's meetings do); never talked → due now.
- **Screens:** Due now (overdue, soonest first) · Coming up (within two weeks) · Later. Each person: name, "Call · every month · last 5 weeks ago", **Talked ✓** (last = today), "🎂 Oct 12 (turns 40)"; tap → the pop-up (the fields above, Delete). Add a person at the top.
- **Into Momo** (`share.js`): `A.inbox(from, to)`: everyone due by `to`, soonest first: `{ id: "p:<id>", title: "Call Mom", block: "Keep in touch", minutes, due, overdue, details: ["Every month · last 5 weeks ago", the note] }`; anyone talked to in the range: `{ ..., id: "p:<id>:<last>", date: last, done: true }`. What doesn't fit is one "Keep in touch · 1h" task. `A.agenda(from, to)`: birthdays in the range as events: `{ id: "bday:<id>:<year>", title: "Mom's birthday", date, time: null, minutes: 15, note: "Call", done: talked that day }` → on the board on its day, any time, and on Today. `A.open(id)`: scroll to the person, flash. `A.attention()`: "" (Momo carries it; one line to flip).
- **Not now:** importing contacts, notifications, message history.
- **Verify:** two people (every week, every month; one talked yesterday) → Keep in touch fills; Talked ✓ → ✓ in Momo; a birthday on the board and on Today; +1 month → due again; Export then Import; phone width; console clean.

## Shared between apps (approved)
- **Every app** may list needs for Momo's inbox, and may offer `open(id)`.
- **Momo → Iroh:** `hoursSpent(title)`, read-only hours per closed week for a title (4b).
- **Meetings** are core's own feature, not shared between apps.

## Builder notes
- **New apps:** the steps in `apps/_template/CLAUDE.md`. Layouts are phone-first: narrow screens, big tap targets. Their scripts go at the end of `index.html` (that's the switcher's order; the first app listed opens on a fresh device, so consider moving Momo first).
- **Inbox:** the contract is the header of `core/inbox.js`. Feeders to copy: `apps/appa/share.js` (timed, with due dates), Wan Shi Tong's `inbox` (ongoing), then Hawky (the simplest), Badgermole (one per block, with dates and done), Iroh (hours that spread). Every feeder keeps its `inbox` and `open` in a `share.js`. Limits: block titles ≤ 40, need titles ≤ 60, up to 8 detail lines of 100; ids stay the same for the same need; a done need carries its `date`.
- **Backups:** an app's `looksLike` checks what's inside, not just the key: Hawky's and Wan Shi Tong's both keep `items`.
- **Details on tap** come from Momo's card pop-up (`card-editor.js`, `fromHTML` in `inbox.js`) and Today's (`today.js`): nothing to add in Momo for a new app.
- **Meetings** are core's (`core/meetings.js`); `season` joins in 4a.
- **Badgermole's calendar** is a plain month grid. **Turtleduck** has no drag and drop.
- **Momo changes:** `DRAW_HOURS` is 1 (done). 4a: `fill: "hours"` in `inbox.js`. 4b: goals out, the close-out by title, `spent`, `hoursSpent`.
- **Time travel:** +1 season (4a).
- **Versions:** each phase bumps every app it touches. New apps start at 1.000, with a line in Kyoshi's changelog.

## Verification (every phase)
- **Console check:** open `index.html` from disk, switch to each app, and the console stays clean.
- **Phone:** check in a narrow window, and on the Android phone through the sync folder: Today, Hawky's quick add, Badgermole's set logging, Turtleduck's tapping.
- **Time travel (Developer Mode):** jump a day, a week, a month and a season, then check: blocks fill and shortfalls show in Tasks; Iroh's meetings come due, with the dot and the Meeting block; the close-out logs the hours.
- **Backups:** Export then Import JSON for the app; old backups import unchanged, including Momo backups that hold goals, which export them again.
- **Two tabs, or phone and computer:** a change in a feeding app shows in Momo within a minute; a need ticked done shows ✓.
