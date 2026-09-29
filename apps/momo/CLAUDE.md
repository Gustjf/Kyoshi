# Momo — weekly time budget, YNAB-style for hours (a Kyoshi app)
Rules, versioning and the app contract: the root `CLAUDE.md`. Version & changelog: `changelog.js` (continues the standalone's).

## Purpose (the original brief — keep to it; tell me if a request clearly goes against it)
YNAB-style budgeting, but for time: simple, minimalist, for organizing my thoughts. The YNAB philosophy matters most.
- A drag-and-drop card board (not a grid): a "To Be Budgeted" bank of unassigned hours from the week's 168, then Mon–Sun columns, each strictly 24h (turns red when over).
- Cards are consolidated blocks sized by duration (one 8h "Work", not eight 1h cards).
- Plan the week ahead; a baseline template auto-funds recurring commitments (sleep, work) in one click.
- Mid-week, drag cards between days as long as every day balances back to 24h.
- Long-term goals are sinking funds of target hours.
- Weekly close-out: before a new week, review the past week's goal cards; done by default (hours deducted from the goal); unworked hours can go back to the goal; lost hours are just dropped.

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
| `tasks.js` | **Tasks** strip under the bank: one per Appa thing with maintenance coming up (`momoTasks()`, sized to its jobs), per goal still to reach and per Wan Shi Tong item in progress (`inProgress()`); drawing a card from one (`drawCard`: Appa's hours, else `DRAW_HOURS`), `openTask`, `appaFor` (a card's "Open in Appa" line), parked cards, `checkTasks` |
| `agenda.js` | **Events** from other apps (`K.agenda`): the week's events (`weekAgenda`), hours they add (`agendaHours`), conflicts (`obstacles`, `flag`), `reach`/`quickFix`, laying and drawing them (`layEvents`, `eventHTML`, …), `checkAgenda` |
| `drag.js` | pointer handling: pick up (a task: a new card drawn from it), group drag (Ctrl / long hold), find the drop target |
| `drop.js` | drop previews & lines, auto-scroll, commit the drop, resize by the grip, board & Tasks clicks & keys, pins |
| `clipboard.js` | copy / cut / paste cards (Ctrl+C / X / V) |
| `card-editor.js` | card pop-up (days or No day, goal, pin, inside, colour; a new card from a task, with Appa's hours and "Open in Appa" line), shared colour swatches, hours & clock parsing |
| `goal-editor.js` | goal pop-up (total or hours a week, finish-by date & season buttons, colour) |
| `triage.js` | an event's pop-up: its quick fix while it conflicts, else a time within `EVENT_WINDOW` hours, or back to its app's time (`place` → `week.events`) |
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
- Tasks aren't stored: they're read afresh from Appa (`K.apps.appa.momoTasks()`), the goals and Wan Shi Tong (`K.apps.wanshitong.inProgress()`), read-only; none from an app that's missing. A drawn card is an ordinary card, parked until it moves onto a day. A card without a day (`day: null`, "parked") sits in Tasks; the baseline has none, and shows no Appa tasks.
- Appa's task for a thing ("<name> maintenance") needs its jobs' minutes (snapped, 15m at least) and is **funded** by cards with the same title (any case) on days from today on, this week and next (closed weeks count). It shows only while funding falls short and draws a card of what's left, so merged, resized or pasted cards, missed days and jobs that come due later just work. "Open in Appa" closes the editor, then `openFromMomo`; Momo never changes Appa's data.
- Events from other apps aren't stored: they're read afresh (`K.agenda`), and only the times you moved them to on their own day are kept (`week.events`, by "app:id"). Moving one never changes its app, and cards never move for one.
- An event counts toward its day's 24 hours: it takes time no card has, or Free time lends it the hours. Anywhere else it conflicts (with those cards, and any event it overlaps), from today onward; a conflict with no clear time within `EVENT_WINDOW` (3) hours of its app's time stays flagged. It never moves further than that, nor to another day.
- Bug reports never include card titles, goal names or what events are.
