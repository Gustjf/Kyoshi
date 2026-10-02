# Kyoshi roadmap: a life system with Momo at the center
The plan for the next phases and apps, agreed 2026-10-02. Read it when starting a phase; tick the phase off when it's done.

## Status
Each finished phase gets a line saying what was decided along the way.
- [ ] Phase 0: Momo's inbox and blocks
- [ ] Phase 1: Momo Today
- [ ] Phase 2: Meetings
- [ ] Phase 3: Hawky (errands)
- [ ] Phase 4: Iroh (goals ladder)
- [ ] Phase 5: Badgermole (workouts)
- [ ] Phase 6: Turtleduck (meals and groceries)
- [ ] Phase 7: People (keep in touch)

## How we work (each phase)
1. **Start a new session** and say "Phase N of roadmap.md". This file and CLAUDE.md carry the context.
2. **Big phases (0, 2, 4, 5, 6) start in plan mode.** Read only the files the phase touches. Phases 1, 3 and 7 go straight to building.
3. **Before pushing:** build, then review the diff (`/code-review`). Check in the browser: the console, phone width, and time travel. Then push to `main`, or to a branch where the phase says so.
4. **After pushing:** tick the phase here, note the decisions made, and keep each app's CLAUDE.md current.
5. **The user** lives with each phase for a few days, then sends notes in one batch.
6. **Model:** use the strongest model for 0, 2 and 4 (shared code, sync, stored data). A lighter model is fine for 3, 7 and small tweaks.

## Why
Stop spinning wheels:
- **Direction:** know what matters.
- **Allocation:** give it real hours. Every hour has a job, downtime included.
- **Execution:** run each day from the phone, with details one tap away.
- **Feedback:** set meetings with each app, so everything keeps flowing into Momo.

## Decisions
- **Momo is strictly the next two weeks:** this week and next (Mon–Sun), as now. Nothing further out goes into it.
- **Goals live in Iroh,** hours a week included.
  - Momo's own Goals section is removed, and Momo's brief changes with it.
  - Anything already saved there stays in the data and backups, untouched. There is no copy-over.
- **Blocks in Momo:** Momo decides *when*. Each app fills the user's blocks with *what*.
- **What actually happened** is reviewed weekly, by exception, at Momo's close-out: the plan is assumed to have happened, and you fix what didn't.
- **Phone:** Android with Chrome. Folder sync carries everything between phone and computer.
- **Card length:** a card with no length of its own starts at 60 minutes. Momo's `DRAW_HOURS` goes from 1.5 to 1.
- **Meetings:** every app has its own meeting with the user at a set interval.
- **Build order:** daily flow first.
- **Shared functions:** approved; see below.

## The shape of the system
```
WHY      Iroh          10-yr → 5-yr → year → quarter (hours a week), each goal reconciled
WHAT     Hawky errands · Badgermole workouts · Turtleduck meals · People · Appa · Wan Shi Tong · Bosco
            │  each lists what it needs this week and next, plus its meetings
WHEN     Momo          baseline + this week + next · blocks get filled · Today on the phone
            │  hours spent flow back (read-only)
REVIEW   Momo's weekly close-out · each app's meeting · Iroh's quarter & year
```
No app writes another app's data. Names are suggestions until the app is built.

## Meetings (defaults, each adjustable or off in its app)
| App | Meeting | Every | About |
|---|---|---|---|
| Turtleduck | Plan the next two weeks' meals and groceries | week | 15 min |
| Hawky | Sweep: due dates, estimates, drop stale ones | week | 10 min |
| Momo (last) | Close out last week, plan the next two | week | 20 min |
| Iroh | Reconcile the goals | month | 20 min |
| Badgermole · People · Wan Shi Tong · Bosco | Program check · who's due · prune the backlog · trend and doses | month | 10 min each |
| Iroh · Turtleduck · Appa | Quarter review · recipe bank (add, keep, cut) · new things and records | quarter | 60 · 45 · 15 min |
| Iroh | Re-read the vision, set the year | year | 2 h |

That adds up to about 45 minutes each Sunday, about an hour a month and about two hours a quarter. Daily: glance at Today, and drop errands into Hawky as they come up.

## Phases (each gets its own detailed plan when started)

### Phase 0: Momo's inbox and blocks (core + Momo · straight to `main`)
- **One inbox:** any app lists what it needs this week and next. Core gathers the lists the way `K.agenda` gathers events, so a new app needs no new Momo code. Each need has:
  - a title and a few detail lines
  - a length, or "one per block"
  - a day, a place in a sequence, or a due date
- **Blocks:** a card with the same title gets filled.
  - **One per block:** workouts and meals.
  - **By time:** errands, goal hours, maintenance and meetings, as many as fit.
  - A need with a day fills that day's block. A sequence fills the next blocks in time order. If a block moves, its work follows.
  - The filled card shows the details, "Open in <App>", and a ✓ once the app says it's done.
  - Filling a block adds no hours and causes no conflict.
- **Shortfalls:** anything no block covers shows in Tasks. A card drawn from Tasks takes the need's own length, or 60 minutes if it has none.
- **What stays the same:** Bosco's doses stay events. Appa and Wan Shi Tong move onto the inbox and behave as before.

### Phase 1: Momo Today (Momo · `main`)
- **The view:** phone-first and large.
  - Now, with the time left, then Next.
  - The rest of today in order, then tomorrow.
  - Free time shows too.
- **Tap a card** for its details and "Open in <App>". For example: the workout's exercises, the meal's nutrition and recipe, the errands list, or a goal's why and next step.
- **Week button:** shows the board as it is now (This week, Next week, Baseline). Momo opens on Today on a phone and on the board on a computer. Either can switch at any time.

### Phase 2: Meetings (core + every app · on a branch, since meeting dates travel with sync and backups)
- **Each app** shows "Last met 12 days ago · every month" with a Done ✓ button. It's YNAB's "last reconciled", for every app.
- **When a meeting is due** within the two weeks, it goes to Momo's inbox and fills the **Meeting** block (e.g. Sunday 6–7 pm in the baseline).
  - Momo's own meeting comes last, after everything else has flowed in.
  - Anything that doesn't fit goes to Tasks.
- **Overdue:** a dot appears on that app's icon.

### Phase 3: Hawky, errands and pop-up tasks (new app · `main`)
- **Quick add on the phone in seconds:**
  - what it is
  - an optional due date: today, tomorrow, or pick one
  - an optional estimate: 15 minutes unless changed
- **The list:** overdue, today, this week, later and someday. Done ones fold away.
- **Into Momo:** errands fill the **Errands** blocks by time.
  - Overdue first, then by due date, then the oldest without a date.
  - Anything that can't fit before its due date shows in Tasks.
  - The block lists its errands. Tapping one opens Hawky to tick it off.

### Phase 4: Iroh, the goals ladder (new app + Momo · on a branch)
- **The ladder:**
  - **Vision:** a 10-year picture and 5-year milestones, for each life area the user picks.
  - **This year:** 3–5 goals, each with "done when" and why.
  - **This quarter:** a few goals serving the year's. Each has "done when", next steps, and hours a week (or a total by the quarter's end).
  - Still open, for this phase's plan: calendar quarters, or seasons?
- **Reconcile, YNAB-style:** each goal shows "reconciled 23 days ago" and a Reconcile button. It turns amber once it's past its interval.
- **Into Momo:**
  - Each goal's hours for this week and next fill blocks with the same title, by time. The rest goes to Tasks as 60-minute cards.
  - The card shows its chain and its next step, e.g. "Spanish → Conversational by June → Bilingual by 2030".
- **Back from Momo:**
  - The close-out logs the hours, and Iroh shows progress ("22 of 60 h, on pace").
  - The close-out also gains "where the week went": hours by title, and planned vs. done for what the apps sent.
- **Momo's Goals section is removed:**
  - Its goal files leave Momo, and Momo's CLAUDE.md brief changes to the two-week scope.
  - Saved goal data stays and still imports.

### Phase 5: Badgermole, workouts (new app · `main`)
- **Setup:**
  - **Exercises:** the user's own, plus a small starter set.
  - **Routines:** sets × reps × weight.
  - **Program:** routines in order, e.g. Push → Pull → Legs.
- **Made for a glance between sets:**
  - The current exercise shows big, with "set 2 of 3" and last time's weight × reps already filled in.
  - Tap ✓ to log it as is, or adjust with − / + first. Log one set or the whole exercise.
  - "Next: Rows" is always visible, so the order is clear.
- **Best sets and PRs** for each exercise. A PR badge appears the moment one is beaten.
- **Streaks:** a Hevy-style month calendar with workout days filled in.
  - The streak counts weeks in a row that hit the weekly target (e.g. 3 sessions).
  - Rest days never break it.
- **Into Momo:**
  - One session per Workout block, in program order ("Workout · Pull A"). Extra sessions go to Tasks.
  - A logged session shows ✓ and counts as done at the close-out.
- **Not now:** workout or rest timers, charts, imports.

### Phase 6: Turtleduck, meals and groceries (new app · `main`)
- **Recipe bank:**
  - Each recipe has ingredients, steps, prep and cook minutes, servings, nutrition per serving (calories, protein, carbs, fat) and an optional link. No photos.
  - Recipes can be kept, archived or deleted.
  - Quick meals without a recipe (a shake, eating out) are allowed too.
- **Meal cards:**
  - Each card shows its nutrition. Drag it onto a day in the next two weeks, under Breakfast, Lunch, Dinner or Snack.
  - For leftovers, drop the same card again.
  - Each day shows its totals against optional daily targets (calories, protein).
- **Groceries:** a list built from the plan, with quantities merged and staples left off. Tick items off on the phone.
- **Into Momo:**
  - Meal times live in the baseline; that's the eating routine.
  - Each planned meal fills that day's block of the same name, e.g. "Dinner · Chili · 650 kcal · 45 g protein". Tap it for the recipe.
  - Groceries fill a **Groceries** block before the first day that needs them, or go to Tasks.

### Phase 7: People, keep in touch (new app · `main`; name to be picked, e.g. Pabu)
- **Each person:**
  - how often to keep in touch (every week, month, quarter…)
  - how (call, text, visit)
  - the last contact, a note, and an optional birthday
- **"Talked ✓"** resets that person's clock.
- **Into Momo:** people coming due fill the **Keep in touch** blocks by time. A birthday puts a call on its day. The rest go to Tasks.

## Shared between apps (approved)
- **Every app** may list needs for Momo's inbox, and may offer `open(id)`. `open(id)` generalizes Appa's `openFromMomo`.
- **Momo → Iroh:** read-only hours spent per Iroh goal, per week.
- **Meetings** are core's own feature, not shared between apps.

## Builder notes
- **New apps:**
  - Start from `apps/_template/`.
  - Layouts are phone-first: narrow screens, big tap targets.
- **Inbox:**
  - It follows `core/agenda.js` (`K.agenda`), `apps/momo/tasks.js` (`readApp`, funding by title, `checkTasks`) and `apps/appa/share.js`.
  - Details on click build on `apps/momo/triage.js` and `apps/momo/card-editor.js`.
- **Today view:** reuses Momo's `times.js` (`daySchedule`, `startTimes`), `cardHTML` and `eventHTML`.
- **Meetings:**
  - Core adds meeting dates to the sync file, next to `savedAt` and `sync` (`core/sync.js`).
  - Each app's `attention()` gives the dot.
- **Turtleduck's drag and drop** borrows Momo's touch-hold approach (`drag.js`).
- **Badgermole's calendar** is a plain month grid.
- **Momo changes:**
  - `DRAW_HOURS` goes from 1.5 to 1.
  - The goal pieces (`goal-editor.js`, plus goals in `tasks.js`, `closeout.js`, `render.js` and `markup.js`) are removed in Phase 4.
  - The root CLAUDE.md contract table gains the inbox and `open` hooks in Phase 0, and meetings in Phase 2.
- **Versions:**
  - Each phase bumps every app it touches.
  - New apps start at 1.000, with a line in Kyoshi's changelog.

## Verification (every phase)
- **Console check:** open `index.html` from disk, switch to each app, and the console stays clean.
- **Phone:** check in a narrow window, and on the Android phone through the sync folder.
  - the Today view
  - Badgermole's set logging
  - Turtleduck's drag by touch
- **Time travel (Developer Mode):** jump a day, a week, a month and a quarter, then check:
  - blocks fill and shortfalls show in Tasks
  - meetings come due, with dots and the Meeting block
  - the close-out logs the hours
- **Old backups** import unchanged, including Momo backups that hold goals.
- **Two tabs, or phone and computer:** a change in a feeding app shows in Momo within a minute.
