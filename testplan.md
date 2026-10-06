# Kyoshi flow test: simulated lives through Momo
A test campaign, not a phase: a few made-up people live with Kyoshi for a year or more, the real page driven through time, to find where the flow breaks or rubs before the owner's own final testing. Run by one session, start to finish: build the simulator, run the lives, report, discuss with the owner, then build the agreed changes. Read the root CLAUDE.md (automatic), then this file, then **Read first**.

**Status (2026-10-02): cut short by the owner.** The simulator was built (`tests/sim/`, `tests/momo.js`) and lives 4–6 ran a year or two, 1–3 a few weeks each: no crash, console error or data loss. No report or bundles were written; the discussion went straight to the findings, and its decisions are `roadmap/roadmap.md`'s Phase 8 "Flow fixes". The simulator stays for rechecking (`node tests/sim/run.js`, or one life: `node tests/sim/run.js planner --weeks 6`). Phase 8 is built: the simulator reads Momo's window (from this Monday), checks cards' late marks, and finds done needs by their own ids too; the "How the flow works today" notes below describe the flow before it.

**Since v4 Phase 7 (2026-10-04): the simulator lags the app**, a follow-up before its next run (`node tests/run.js` doesn't run it). Turtleduck now sends Momo nothing until a week is confirmed (the plan's Confirm, a week at a time), its meals fill the baseline's slot cards (one per meal and day, made from its Times & trips) and its cooking sessions and extra trips are pinned cards of their own. So the evening sitting (`tests/sim/day.js`) should confirm this week and next once it plans them, and `tests/sim/world.js`'s baseline should drop its Breakfast, Lunch, Dinner, Cooking and Groceries blocks (the slots take their place), as well as its Workout, Errands and Keep in touch blocks, which nothing has filled since v4 Phase 1 (each need a card of its own).

## What we're testing for
Two things the owner must get from the system, in their words:
1. **Where I stand, per app, at a glance.** Am I behind? It should be obvious without digging: the switcher's dot, the app's own header line, Momo's board and Today.
2. **Momo as the source of truth** for everything I need to do this week and next. YNAB's "know your true expenses", in hours: every commitment, the irregular-but-certain ones included (a seasonal job, a quarterly visit, a season review, a birthday), shows up with its cost before it's due, lands in a block or in Tasks, and is never lost, doubled or silently dropped. Done in the app shows ✓ in Momo. What didn't happen is visible.

Everything else (looks, performance tuning, sync folder) is out of scope unless it breaks those two.

## Read first
- `roadmap/roadmap.md`: Status, Decisions, "The shape of the system", "What each app sends Momo", Verification.
- `apps/momo/CLAUDE.md`, then the headers of `apps/momo/inbox.js`, `tasks.js`, `closeout.js`, `today.js`, `agenda.js`.
- The headers of `core/inbox.js` (the contract), `core/meetings.js`, `core/agenda.js`, `core/shell.js` (attention, dots, the minute tick).
- `tests/run.js`, `tests/lib.js`, `tests/generate.js`, and `tests/pabu-momo.test.js` as the pattern for a Momo test. The screen helpers `tests/badgermole.js`, `tests/turtleduck.js`, `tests/pabu.js`.
- Each feeder's `apps/<id>/CLAUDE.md` and `share.js` as you build its part of a life.

## How the flow works today (so you don't rediscover it)
- **Window:** Momo asks `K.inbox(today, next Sunday)` (`apps/momo/inbox.js:18`): 14 days on a Monday, 8 on a Sunday. Needs dated before today are dropped by core, done or not. Events come per week, Monday to Sunday (`apps/momo/agenda.js:50`).
- **Filling:** a need names its `block` (a card title, matched ignoring case) and `fill`: `time` (whole, first block with room), `block` (one per empty block), `ongoing` (every block, never used up), `hours` (Iroh: spreads over the title's blocks; earlier days this week count as done). Done needs still use room. What fits nowhere is a Tasks shortfall: one per block title for `time`, one per need for `block`, one per goal per week for `hours`. Dragging a task onto a day makes the card. Blocks are cards from today on, this week then next (`apps/momo/inbox.js:28-78`).
- **Due and overdue:** `due` = on or before; `from` = not before; a past `due` fits any block from today. `overdue` only draws a red edge in Tasks (`apps/momo/tasks.js:21`); a filled card shows nothing about due or overdue.
- **Done flows back one way:** no app writes another's data. ✓ comes from the source app's own data on the next minute tick. Momo's way back is "Open in <App>" (`K.inbox.open` → `A.open(id)`), from the card editor and Today.
- **Close-out** (`apps/momo/closeout.js`): stored weeks before this Monday that aren't closed. Rows are that week's `fill: "hours"` needs (Iroh's goals), planned hours from the cards by title; Confirm writes `spent`; a week with no goals closes quietly; "Later" lives in memory until the next week; Reopen only on the week on screen; "Close out this week" on Sundays. `hoursSpent(title)` lists every closed week; a week never written to is never closed and never listed. Never from `A.init` (Iroh starts after Momo).
- **Where I stand, as built:** Momo dots for a pending close-out or a conflict; Hawky for overdue errands; Appa for overdue jobs or a meter reading; Bosco while its dose pop-up is open; Iroh (and any app) for an overdue scheduled meeting. Badgermole, Turtleduck and Pabu never dot (Pabu's is `DOT_WHEN_OVERDUE = false`). A checkup (`every: "whenever"`) is never due: "Last checkup: 90 days ago" raises nothing.
- **Momo's board:** This week / Next week / Baseline; the bank ("To Be Budgeted", "Every hour has a job ✓"), each tab's status (`closed out ✓` · `N conflicts` · `Xh over` · `not planned yet` · `all assigned ✓` · `Xh left`), Tasks strip, seven columns with Total/24. Past weeks can't be shown. Today (the phone's default) lists the day's cards with what fills them.

### Already suspected from reading the code: confirm or refute each, with a life and a week
1. A need done yesterday never shows ✓ in Momo (the window starts today); only today's ✓ is ever visible.
2. Appa sends no `done`, so a recorded job disappears instead of showing ✓ (roadmap says ✓ "when recorded").
3. Overdue is invisible once a need is on a card; only Tasks shows it.
4. Done needs keep using a block's room, so a done errand can push the next one to Tasks.
5. An `hours` shortfall for last week vanishes at the week change with no trace ("time can't be saved" is by design; is it obvious?).
6. `time` and `block` shortfalls show on both the This week and Next week tabs whatever their `from`/`due`; a card drawn on the wrong week leaves the task standing.
7. Hawky sends every open errand whatever `to`, so an errand due in six weeks can fill this week's Errands block.
8. "Open in <App>" from the card editor drops unsaved edits without asking (`K.modal.dismiss`).
9. Today counts as a full 24h in To Be Budgeted however late it is; an event with no time adds its full length to the day.
10. A past week Momo never wrote to is never closed out and is absent from `hoursSpent`; Iroh's "expected" may count it or not.
11. Three feeders never dot and checkups never nag: "behind" in Badgermole, Turtleduck, Pabu, or a checkup months old, is visible only inside the app.
12. The close-out's rows are the goals as they are now, not as they were that week (a goal renamed or deleted since).
13. Block title limits disagree: core cuts at 60, the roadmap says 40 (Momo's card titles).
14. `K.inbox` and `K.agenda` are each called several times per Momo redraw; `hoursSpent` sums every closed week per call. Fine at week 10; measure at week 520.

## The lives (6)
All made up, from a seeded generator (the repo is public; names from a made-up list, no real numbers). Each life = an archetype + a seed → its world (people, errands stream, things and jobs, routines, recipes, goals per season, baseline cards, doses) + its behaviour (reliability per app, planning day, close-out habit, devices) + a timeline of life events. Start date: the tests' `TODAY`, 2026-09-30, a Wednesday eight days into fall, so the first week has days before today and the first season review comes 12 weeks in.

Why six, and why these spans: a year is the shortest span that runs every cadence once (weeks, months, four seasons, the year meeting, year end), and day-to-day friction shows in the first weeks, so the three 1-year lives are the main source of findings. Three years adds Feb 29 (2028), a gap-and-return and a device reinstall. Ten years only tests growth, so once is enough.

| # | Life | Span · steps · screens | What it's for |
|---|---|---|---|
| 1 | **Sunday planner** (owner-like): every app; computer Sunday evening (baseline reload, drag Tasks, fill Free time, close out early), phone every day (Today); reliability 0.9; Iroh 3 areas, 2 year goals, 4 season goals (3 by hours a week, 1 by total), meetings held; Appa house + car with meter, 12 jobs (3 seasonal); Pabu 15 people, birthdays; Badgermole Push/Pull/Legs ×3; Turtleduck full plan, one trip a week; Hawky ~5 errands a week; Bosco weekly dose; Wan Shi Tong 2 in progress. Events: one vacation week (nothing touched), one sick week (apps opened, nothing done). | 1 yr · daily · every week | The intended flow at its best: friction here is friction for the owner. |
| 2 | **Overloaded parent**: all but Bosco and Wan Shi Tong; phone most days, computer every other week; reliability 0.6; "Later" twice before confirming a close-out; no baseline until week 6; Hawky 10 errands a week, many overdue; Pabu 25 people with visits; Appa 20 jobs; Badgermole target 3, does 1–2; Turtleduck dinners only; Iroh 5 season goals at 10 h/wk, falls behind, meetings often skipped. Events: two weeks of nothing in month 4 then catching up, a goal abandoned, a goal renamed mid-season. | 1 yr · daily · every week | Behind and noisy: is "where I stand" honest and bearable? Does the backlog become a wall? |
| 3 | **Cold start, light**: starts with nothing; Momo, Hawky, Pabu, Badgermole only; no baseline ever, never "Fill gaps"; phone only; reliability 0.75; no Iroh until month 7 (two goals), Turtleduck added month 9. | 1 yr · daily · every week | The "nothing to set up first" promise; quiet close-outs; apps joining later. |
| 4 | **Life changes**: life 1's world, then year 2 week 10 a baby (baseline rewritten, goals paused a season, reliability 0.5 for three months); year 2 months 7–10 nothing used at all, then a return; year 3: device reinstall (Export all → fresh profile → Import all), an import of a year-1 backup over current data, one month on two tabs (phone tab + computer tab). | 3 yr · daily · 1 week in 4 + every event week | Returning after a gap; a baseline that must change; data that must survive moves. |
| 5 | **Seasons**: Iroh-centric: year goals each January at the year meeting, season goals from them each season (carry over, totals), monthly reconcile always held; Appa seasonal jobs (gutters, AC, furnace, tires) + 2 meters; Pabu quarterly and yearly cadences, a Feb 29 birthday (2028); Badgermole program changes each season; Turtleduck templates. | 3 yr · daily · 1 week in 4 + season and month-end weeks | Progress visibility over 12 seasons; due dates at month ends and season starts; carry-over. |
| 6 | **The long haul**: life 1 for ten years with its world evolving (people come and go, things replaced in year 4, a new job's baseline in year 6, retirement's in year 9); run in a DST time zone (e.g. `America/Chicago`), not UTC. | 10 yr · weekly (Monday 07:00 and Sunday 19:00) · milestone weeks only (each year's and season's first week, the last four) | Growth and edges: storage, speed, export size, Import all at years 1/5/10, 3 leap days, 40 season starts, 120 monthly meetings. |

Screens vs functions: on a "screens" week every action in every app goes through the real page (Playwright taps). On other weeks the feeding apps' actions call the app's own functions through `page.evaluate` (the same ones its buttons call; read-only for ground truth, the action functions for doing). Momo is always driven through its screens: it's the subject.

## The simulator: `tests/sim/`
Not part of the site; not picked up by `tests/run.js` (it only reads `tests/*.test.js`). Reuse `tests/lib.js` (`open`, `switchTo`, `importBackup`, `exportBackup`, `text`, the date helpers) and the screen helpers in `tests/badgermole.js`, `tests/turtleduck.js`, `tests/pabu.js`. Extend `tests/generate.js` with what's missing: `iroh()`, `bosco()`, `hawky()` with many errands, `appa()` with things, meters and seasonal jobs, `wanshitong()`, and meetings (`every`, `minutes`, `last`). Add screen helpers for the apps that have none (Hawky, Appa, Iroh, Bosco) only as far as the lives need them.

| File | Owns |
|---|---|
| `tests/sim/run.js` | `node tests/sim/run.js [life…] [--weeks N] [--parallel 3] [--out tests/sim/out]`: one browser, one context (profile) per life, lives side by side, its own timeouts (no 90 s cap), writes the outputs below. |
| `tests/sim/lives.js` | The six lives: archetype, seed, world, behaviour, timeline. |
| `tests/sim/life.js` | What this person does today in each app, and does it (screens or functions). The Momo planning routine (always screens). |
| `tests/sim/check.js` | The checks below, run every step; a failed check is a finding with its evidence. |
| `tests/sim/report.js` | Metrics and findings → `tests/sim/report.md`. |
| `tests/momo.js` | **The missing Momo screen helper**, written so the existing `*-momo.test.js` files could use it later: bank text, tabs and their statuses, Tasks (title, hours, overdue edge), cards per day with fills and ✓, drag a task to a day (Momo drags with Pointer Events, `apps/momo/drag.js` and `drop.js`: Playwright's mouse down, a few moves past the drag threshold, up), New card, Load/Reload baseline, Copy previous week, Fill gaps with Free time, Save as baseline, the close-out banner and pop-up (rows, Done stepper, Confirm, Later), Close out this week, Reopen, Today's rows and card pop-up, the card editor's "From" section and "Open in <App>", the switcher's dots with their tooltips. |

**Clock.** Playwright's fake clock, as `tests/lib.js` installs it, not Developer Mode's time travel (in memory, lost on reload). A day step: `ctx.clock.setSystemTime(day at 07:00)` then `ctx.clock.fastForward(61000)` so the shell's minute tick fires (`Kyoshi.tick`; Momo's rollover and close-out checks run on it). Check in the smoke run that `Kyoshi.util.todayStr()` moved and the tick ran; fall back to calling `Kyoshi.tick()` if not. Data persists in IndexedDB, so reloads are real: the person "closes the tab and comes back" (`page.reload()`, wait for the app to start) daily on the phone, on planning days on the computer. Changes in a feeding app reach Momo on the next tick: always `fastForward(61000)` before reading Momo.

**A day in the loop.**
1. Step the clock; tick. Reload if this person opens the app today.
2. Read standing for every app (ground truth from the app's own data through its functions, read-only; the signals: switcher dot and tooltip, the app's header line, Momo's Tasks, cards and Today). Record both.
3. If the close-out pop-up is up, answer it the way this person does (confirm with honest numbers from what the life actually did; "Later"; ignore for a month).
4. Run the Momo checks (below) against `Kyoshi.inbox(today, nextSunday)` and `Kyoshi.agenda(...)` read the same moment.
5. The person's actions in the apps, by reliability: today's workout if planned; errands due today; people due; the trip's groceries and the cook row; Appa jobs due (a record, sometimes with a time); the dose; Iroh's meeting when due (Done ✓ on its header line); new errands (a few a week, some undated, some overdue on arrival), a new person now and then, a recipe pasted, a meter reading.
6. On the planning day: Momo through its screens: Load/Reload baseline (or Copy previous week) for next week, drag each Tasks item onto a day with room (this person's planning skill: the share of tasks they place), Fill gaps with Free time, read the bank. Sundays: Close out this week for the diligent.
7. Count friction (below); screenshot at milestones (weeks 1, 2, 4, 13, 26, 52, each year end) and at every finding; Export all at each year end into `tests/sim/bundles/<life>-y<n>.json` (made-up data; keep each under 2 MB; these are for the owner's own testing: Import all into a browser profile that is **not** connected to the real sync folder).
8. On a weekly-step life (6): Monday 07:00 and Sunday 19:00 only, actions batched on those two days; screens on milestone weeks.

**Determinism.** One seed per life; the same seed replays the same life. Every finding cites life, seed, date and step, and `--weeks N` reruns to that point. Keep `tests/sim/out/` out of git (there is no `.gitignore` yet: create one with that line); commit `tests/sim/report.md` and the bundles the owner wants.

**Smoke first.** Life 1 for 6 weeks (`--weeks 6`), screens on: calibrate selectors, the day's cost, the clock step. Then all six. Measure after life 1; if the whole set would pass two hours, widen the sampling on lives 4–5 (1 week in 6) rather than cut a life.

## The checks (every step)
**A. Momo as the source of truth**
- *Complete:* every need `Kyoshi.inbox(today, nextSunday)` returns shows exactly once: on a card (its fill) or in Tasks, or it's done. Compare the lists, not just counts.
- *Nothing silently dropped:* things an app itself counts as due or overdue that aren't in the inbox or aren't visible in Momo. Known suspects: a need done yesterday (dropped as past-dated), Appa's recorded jobs (no `done`), any need with a past `date`, Pabu's birthday-only people (never due, by design: is that right?).
- *Nothing doubled:* a need on two cards, on a card and in Tasks, a meeting twice, a Pabu talk and its birthday counted as two, the same errand on this week's and next week's block.
- *Minutes add up:* a card's used minutes ≤ its room; `time` needs never split; `block` needs one per card; `hours` needs sum to their minutes across cards plus the shortfall; a missing `minutes` becomes 60 (is that right for the need?).
- *Due respected:* nothing lands after its `due` unless overdue, nothing before its `from`; an overdue need takes the soonest block; an overdue need is visibly overdue wherever it is.
- *Done:* ✓ on the right day; done needs never in Tasks; a card with every need done shows ✓; Today agrees with the board.
- *Events:* doses and birthdays on their day; a done event ✓; conflicts flagged only from today on; a moved event stays moved within its week.
- *Week change:* Sunday→Monday nothing is lost or doubled; next week's cards become this week's; what disappears (last week's shortfalls) is accounted for.
- *Close-out:* appears only at settled moments; its rows are that week's goals with the right planned hours (by title, Free time out, nested cards counted on their own); Confirm → `spent` → `hoursSpent` → Iroh's progress on its next draw; quiet close for weeks without goals; a backlog closes oldest first; "Later" resets on the new week; Reopen works on this week and nowhere else; the banner's count is right.
- *Baseline and copies:* loaded cards fill at once; reload swaps only `base` cards; pinned times hold.
- *Two tabs (life 4's month):* a change in one tab shows in the other's Momo within the minute; a close-out confirmed in one is dropped in the other.

**B. Where I stand, per app.** Each day, for each app, record `{truth, dot, headerLine, inMomo}` and classify:
- *silent-behind:* the app's own data says behind (overdue errands, people due, jobs overdue, sessions short of the target with fewer days left than sessions, unplanned dinners this week, a goal more than a week's share behind, a dose unlogged past its day, a meeting overdue, a checkup older than 60 days, a close-out pending) and nothing shows outside the app.
- *noisy:* a dot on more than half the days of a month, or one that never clears for a thing the person can't act on.
- *stale:* a signal lags the truth by more than one tick, or survives a reload wrongly.
- *contradictory:* Momo shows ✓ while the app says not done, or the reverse; a tab says "all assigned ✓" while Tasks has items for that week.
- *inside only:* the truth is visible, but only after opening the app and reading (count the taps to learn it).

**C. Friction, per life-week** (counts, with one example each in the report):
- taps and drags from a fresh week to "Every hour has a job ✓"; tasks still unplaced on Sunday night;
- the same shortfall title appearing in Tasks three weeks running (a baseline gap the app could point out);
- times the person had to open an app to learn why something is in Tasks or what a card holds; "Open in <App>" round trips; edits lost to "Open in <App>";
- confirm dialogs and pop-ups at a bad moment (mid-drag, first thing on the phone); the close-out asking about a week more than a month old;
- things only the computer can do that the phone person needed (pins, drag);
- lead time: how many days before its due date each kind of need first appeared in Momo (Appa 14, Pabu 6, meetings 6, Turtleduck's Now list 1, Hawky 0, Iroh the week itself); the share of weeks the baseline's room covered the apps' asks without a shortfall (the "true expenses" measure: does the baseline carry the average weekly cost of each app?).

**D. Robustness (life 6, and the year ends of 4 and 5).** Time `Kyoshi.inbox(today, nextSunday)`, `Kyoshi.apps.momo.hoursSpent(title)`, a board redraw (switch tab and back), Today's draw, a reload to started, at years 1, 5 and 10; storage used (the dev panel's line) and Export all's size; Import all's time and that `Kyoshi.inbox` and `hoursSpent` give the same answers after Export all → fresh profile → Import all; an old backup imported over current data loses nothing (`combine`); an older `schemaVersion` still imports; Feb 29, DST days (a 23 h and a 25 h day: no doubled or skipped rollover), Dec 31 → Jan 1, Dec 21 (winter belongs to the next year), meetings due on Jan 31 + 1 month.

**E. Console.** Anything in the console or a page error is a finding with the life, date and step (as `tests/run.js` treats it). A screen that won't draw is a crash.

## What gets fixed at once, and what waits
- **At once** (the owner's choice): a crash (page error, a screen that won't draw), a console error, and data loss or corruption (something stored that's gone or wrong after a reload, import, close-out, week change or two-tab save). Fix it minimally, add a test under `tests/` for the flow, bump the version and changelog, push per CLAUDE.md (straight to `main`; a branch, with the reason, if it touches stored data shapes or sync), then resume the run. List each in the report under "Fixed during the run".
- **Waits for the discussion:** everything else: flow friction, missing or noisy signals, design questions, feature gaps, the suspects above, performance.
- The simulator and `tests/momo.js` are the only other code written before the discussion. Existing tests stay untouched and `node tests/run.js` must pass at every push.

## The report: `tests/sim/report.md`
1. **Summary table, one row per life:** weeks run; weeks closed on time / late / never; tasks unplaced on Sunday night (average); taps to "every hour has a job" (average); silent-behind days per app; noisy-dot days per app; dropped, doubled, contradictory counts; console problems; crashes fixed. Then the robustness numbers (life 6).
2. **Findings, ranked**, each on its own: `F-nn · kind (bug · flow · signal · design question · feature gap) · severity (blocks the flow · daily rub · occasional · cosmetic)`; one line of what happened; what the person saw versus what they needed; life, seed, date, step; where in the code (file:line); the fix or the options, with a recommendation; the question for the owner, if any. Screenshots next to it. Group the suspects list's verdicts at the end: confirmed or refuted, with the evidence.
3. **Fixed during the run:** what, why it qualified, the commit, the test added.
4. **Out of scope and not exercised:** the sync folder (no File System Access API headless; two tabs stood in), photos and PDFs beyond a few, visual design.
5. **Discussion agenda** (below), filled in from the findings.

Plain words throughout: the owner is a layman. One screen per finding. No made-up jargon; name the apps and the screens.

## The discussion
Lead it. Open with the summary and the five findings that matter most. Then one theme at a time, each with its findings, two or three options and a recommendation, and at most five questions per batch; wait for the answers before the next batch. Themes to cover, whatever the findings add:
1. **Where I stand:** the dot policy (should Badgermole, Turtleduck and Pabu dot when behind? should a checkup nag after N days?); a standing line per app in the switcher or on Momo ("Hawky: 2 overdue · Pabu: 1 due · Workouts 1 of 3"); overdue on cards, not only in Tasks.
2. **Source of truth:** yesterday's ✓; Appa's ✓; done needs holding room; the week's lost shortfalls; a need with no block for three weeks (suggest a baseline card?); lead times; a "true cost" view (each app's average weekly ask over the last 13 weeks against the baseline's room).
3. **The close-out:** timing and interruptions, the backlog, past weeks on the board, Reopen's reach, what a quiet close hides.
4. **The phone:** what Today lacks for running the day; what only the computer can do.
5. **The obvious-fix list:** findings that need no decision; ask for a yes to the batch.
Record every decision in `roadmap/roadmap.md` as a new phase's brief (Phase 8 "Flow fixes", more if the owner splits them), in the Status style, before building anything.

## The changes
After the decisions: build the phase(s) as `roadmap/roadmap.md`'s "How we work" says: targeted edits, versions and changelogs bumped (the app's, core's, or both), a new build stamp in `index.html`, tests for each changed flow in `tests/` (using `tests/momo.js`), `node tests/run.js` green, the smoke run of life 1 green, the console clean at phone and desktop width, then push (`main`, or a branch with the reason). Tick the phase in `roadmap/roadmap.md` with what was decided, and update the CLAUDE.md files that changed. Hand the owner the bundles to import for their final testing and say which browser profile to use.

## Done when
- The six lives ran to the end, with every check's result in the report, screenshots and bundles in place; `tests/sim/` and `tests/momo.js` committed; `node tests/run.js` passes.
- Crashes, console errors and data loss found on the way are fixed, tested and pushed.
- The report is written in plain words, the discussion has happened, the decisions are in `roadmap/roadmap.md`, and the agreed changes are built, tested and pushed.
