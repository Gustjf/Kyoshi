# Momo — weekly time budget, YNAB-style for hours (a Kyoshi app)
Rules, versioning and the app contract: the root `CLAUDE.md`. Version & changelog: `changelog.js` (continues the standalone's).

## Project information / original prompt
Reference this when it makes sense, unless explicitly told otherwise. Confirm when commands that are given grievously violate this.

use LocalStore and JSON import/export with auto sync. Use my other project, located in the currently connected github, Bosco (Gustjf/Bosco), as a reference for a lot of the UI aspects. Do not modify Bosco in any way. It is read only. This application is supposed to be a "YNAB" style budgeting method but for time. Spend some extra time thinking about the best way to apply that - that is the most important philosophy. i want something very simple, minimalist that I can use to organize my thoughts.

- Kanban-Style Board: The primary interface relies on a drag-and-drop card system rather than a spreadsheet grid.
- The "To Be Budgeted" Bank: A staging area holding any unassigned hours from the weekly 168-hour pool.
- Seven Daily Columns: Monday through Sunday layout. Each column features a strict capacity tracker (e.g., Total: 24/24).
- Task Cards: Time commitments exist as consolidated, dynamically sized blocks based on duration (e.g., a single 8-hour "Work" card rather than eight individual 1-hour cards).
- Visual Constraints: Columns provide immediate visual feedback (e.g., turning red) if drag-and-drop actions push a specific day over its 24-hour limit.

Core Application Workflows
- One-Week-Ahead Planning: Budgeting is strictly proactive, focusing on allocating hours for the upcoming week rather than the current day.
- Baseline Template (Auto-Funding): A one-click mechanism to load a saved configuration of recurring weekly commitments (sleep schedules, typical work shifts). This instantly deducts those hours from the 168-hour pool, leaving only discretionary time in the "To Be Budgeted" bank.
- Mid-Week Adjustments (Rolling with the Punches): Users can freely drag task cards from one day to another to cover unexpected events, as long as all days balance back to 24 hours.
- Long-Term Goals (Sinking Funds): Users can establish target hourly goals for multi-month or multi-year projects.
- Weekly Close-Out Reconciliation: Before opening a new week, a modal prompts the user to review the past week's goal-oriented tasks. The app assumes successful completion by default and deducts those hours from the long-term master goals. If a user did not finish the planned time, they can manually add those unworked hours back to the master goal. The "lost" hours are discarded without requiring the user to categorize where the time actually went.

## Files (load order)
| File | What's in it |
|---|---|
| `app.js` | `Kyoshi.register` (name, title, icon, 1180px wide); constants (days, 15-min `STEP`, `DRAW_HOURS`, `PALETTE`, drag thresholds, `DATA_SCHEMA_VERSION`, `SAMPLE_BASELINE`); state `A.S`; helpers (hours `fmtH`/`snap`, week keys, `fmtClock`) |
| `markup.js` | the page: close-out banner, week tabs, bank & Tasks, board, goals, Backup & sync, card/goal/close-out pop-ups |
| `changelog.js` | version history |
| `model.js` | **the data model** (header comment documents it): weeks, baseline, goals, budgets, and how cards merge, nest and move (`moveCard`, `mergeTarget`, `insertCard`, `settle`) |
| `times.js` | times of day (`daySchedule`, `startTimes`, `autoSpot`) and the board's ruler (heights that line cards up across days) |
| `colors.js` | colours by title/goal key, auto-assigning and swapping (`ensureColors`, `pickColor`) |
| `data.js` | storage (`load` incl. first-run carry-over from the standalone, `save` with undo, `persist`), cleaning (`normalizeData`), undo, backups and sync merge (`A.data`) |
| `render.js` | `renderAll`: tabs, bank, board (cards, free time, other apps' events), goals |
| `tasks.js` | **Tasks**, the strip under the bank: a task per goal still to reach and per thing in progress in Wan Shi Tong (`tasks`, read through its `inProgress()`), drawing a card from one (`drawCard`, `DRAW_HOURS`), clicking one (`openTask`), the week's cards without a day, and redrawing when Wan Shi Tong's change (`checkTasks`) |
| `agenda.js` | **Events** from other apps (`K.agenda`: Bosco's doses, …): a week's events where they are, moved or not (`weekAgenda`), the hours they add to their days (`agendaHours`), their conflicts (`obstacles`, `flag`) and same-day `quickFixes`, laying them into a day (`layEvents`: a piece of the day in free time, else drawn over it) and drawing them (`eventHTML`, `overlaysHTML`, `headEventsHTML`), and redrawing when they change (`checkAgenda`) |
| `drag.js` | pointer handling: pick up (a task: a new card drawn from it), group drag (Ctrl / long hold), find the drop target |
| `drop.js` | drop previews & lines, auto-scroll, commit the drop, resize by the grip, board & Tasks clicks & keys, pins |
| `clipboard.js` | copy / cut / paste cards (Ctrl+C / X / V) |
| `card-editor.js` | card pop-up (days or No day, goal, pin, inside, colour; a new card from a task), shared colour swatches, hours & clock parsing |
| `goal-editor.js` | goal pop-up (total or hours a week, finish-by date & season buttons, colour) |
| `triage.js` | an event's pop-up: its conflict and quick fix (nearest clear time that day), any time that day, back to its app's time (`place` notes it in `week.events`) |
| `baseline.js` | bank actions: load baseline, copy previous week, save as baseline, fill gaps, clear, sample |
| `closeout.js` | weekly close-out pop-up, pending weeks, reopen, rollover (new day/week) |
| `events.js` | `A.init` wiring and the hooks: `onKeydown` (Esc, undo, copy/paste, Enter), `onShow`/`onHide`, `onTick` (new day/week; Tasks; events), `onReload`, `attention` (a week to close out, an event's conflict), `renderDev` (Undo), `bugState` |
| `momo.css` | styles under `.app-momo`; page-wide `--momo-hour`, `--momo-slate`, `--momo-tint` |

## State (`A.S`)
`data` { weeks, baseline, goals, colors } — shape in `model.js` · `view` "this"|"next"|"base" · `undoStack`, `lastSavedJSON`, `lastSaved` ·
close-out: `closing`, `closeOutLater`, `knownToday` · editors: `editing`, `editingGoal`, `triage` (an event's pop-up) · pointer: `press`, `stuck`, `drag` (`draw`: a card drawn from a task), `resize`, `suppressClick`, `renderPending` · `clip`, `mouse` · `ruler` · `tasksKey` · `agenda` (the shown week's events), `agendaKey`.
Note `A.S.data` is Momo's data; `A.data` is the backup/sync adapter Kyoshi calls.

## Storage (`A.store`) and backups
Key: `data` (plus core's `sync`). First open reads the standalone's `momoData_v1` (never changes it).
Backup JSON = the standalone's format, so old backups import as-is: `{ schemaVersion: 2, appVersion, weeks, baseline, goals, colors }`.
A week has `events` only once you've moved one of other apps' events in it (shape in `model.js`).
Every change goes through `save()` (colours, `u` timestamps, undo, then storage + `A.changed()`).

## Invariants
- Hours sit on the 15-minute grid (`snap`); one card holds at most 24h; a day is its own account (no borrowing between days).
- A day's cards are ordered; that order sets their times, except pinned cards. Nesting is one level deep (`tidyNesting`).
- Sync merges whole weeks / goals / colours by their `u` (the later change wins); goal logs from both sides are kept.
- Past weeks are closed out (goal hours logged); this week only counts today onward.
- Tasks aren't stored: they're read afresh from the goals and Wan Shi Tong (`K.apps.wanshitong.inProgress()`, read-only; none if it's missing). A drawn card is an ordinary card, parked until it moves onto a day. A card without a day (`day: null`, "parked") sits in Tasks; the baseline has none.
- Events from other apps aren't stored: they're read afresh (`K.agenda`), and only the times you moved them to on their own day are kept (`week.events`, by "app:id"). Moving one never changes its app, and cards never move for one.
- An event counts toward its day's 24 hours: it takes time no card has, or Free time lends it the hours. Anywhere else it conflicts (with those cards, and any event it overlaps), from today onward; a conflict with no clear time that day stays flagged.
- Bug reports never include card titles, goal names or what events are.
