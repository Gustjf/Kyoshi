# Iroh — the goals ladder (a Kyoshi app)
Direction: know what matters, then give it real hours. **Vision**: the areas of your life (Health, Work, Family…), each with
its picture in 10 years and milestones 5 years out. **This year**: three to five goals, each with how you'll know it's done and
why it matters. **This season**: the goals you're working on now, each serving a year goal, with hours (a week, or in total),
a next step, and a reconcile at least monthly (amber after `RECONCILE_DAYS`). **Momo** makes the time: every open season goal
with hours fills your cards titled like it, its hours spread over them in turn; what doesn't fit is a task for that week; and
Momo's weekly close-out logs the hours each title got, which each season goal shows as its progress ("22 of 60 h, on pace"). Past
seasons fold into **Earlier**, where Carry over copies an open goal into this season. Iroh's periods are seasons
(core/seasons.js); a season belongs to the year most of it falls in, so the winter that starts in December is the next year's.
Named after Zuko's uncle, the Dragon of the West (the icon is Lucide's compass, in Fire Nation red).
Rules, versioning and the app contract: the root `CLAUDE.md`. Version & changelog: `changelog.js`.

## Files (load order)
| File | What's in it |
|---|---|
| `app.js` | `Kyoshi.register` (name, title, icon, 780px wide, backup note, its three meetings); constants (limits, `HOURS_STEP`, `RECONCILE_DAYS` 30, `DATA_SCHEMA_VERSION`); state `A.S`; helpers: text (`cleanLine`, `cleanText`), hours (`cleanHours`, `fmtHours`), seasons (`seasonOf`, `currentSeason`, `thisYear`, `startOf`/`endOf`, `seasonLabel`, `seasonsOf`, `yearOf`, `isPast`, `mondayOf`, `weeksOf`), lookups (`liveAreas`, `goalsIn`, `childrenOf`, `parentOf`, `areaOf`, `chainOf`, `isStale`, `ago`, `progressOf` and `behindBy` (Momo's logged hours), `weeklyMinutes`, `hoursText`) |
| `markup.js` | the page: This season, This year, Vision, Earlier (folded), Backup & sync; the goal, reconcile and area pop-ups |
| `changelog.js` | version history |
| `data.js` | storage (`load`, `save`), cleaning (`cleanAreas`, `cleanGoals`: new items are made through them too), backups and sync merge (`A.data`) |
| `share.js` | what Momo reads (`inbox`) and opens (`open`) |
| `render.js` | `renderAll`: the four sections (a season goal with its progress from Momo); `progressKey`; `reveal` (a goal into view, flashing) |
| `goal-editor.js` | the goal pop-up (title, year goal, area, hours, next step, done when, why, status; Delete) and the reconcile pop-up (next step; Reconciled ✓, Mark done, Drop) |
| `area-editor.js` | the area pop-up (name, in 10 years, in 5 years; Delete) and `moveArea` (↑ ↓) |
| `events.js` | `A.init` wiring (buttons carry `data-act`), Carry over, and the hooks: `onTick` and `onShow` (a new day, or Momo's logged hours changed), `onReload`, `bugState` |
| `iroh.css` | styles under `.app-iroh` |

## State (`A.S`)
Saved, deleted ones kept as markers (a marker keeps only `id`, `deleted`, `at`, `u`):
- `areas` [{ id, name ≤ 30, vision ≤ 1000 (in 10 years), milestones ≤ 1000 (in 5 years), order (its place in Vision), deleted, at, u }]
- `goals` [{ id, areaId, period ("2027" for a year, "2026-fall" for a season), title ≤ 40 (a season goal's is its Momo block title;
  unique in its period, any case), why ≤ 300, doneWhen ≤ 300, parentId (a season goal's year goal, or ""), hoursWeek or hoursTotal
  (on the 15-minute grid; one, or neither: 0), next ≤ 200 (the next step), reconciled ("YYYY-MM-DD" or ""), status "open" | "done" |
  "dropped", deleted, at, u }]

`at` is when it was added (the order within a period), `u` when it last changed (the later wins in sync). A season goal with a
year goal takes its area from it (`areaOf`; `areaId` is kept in step on save). New goals come reconciled today.
This device only: `editing`, `reconciling`, `areaEditing` (the pop-ups), `knownToday`, `progressKey` (Momo's hours as last drawn).

## Storage (`A.store`) and backups
Keys: `areas`, `goals` (plus core's `sync` and `meetings`). Backup JSON: `{ schemaVersion: 1, appVersion, areas, goals }` (plus core's
`meetings`). Merged item by item by `u`, list by list (Appa's way). Momo's backups keep `goals` too, so `looksLike` wants both `areas`
and `goals`; Import JSON refuses a file with neither in it.

## Its meetings
Named in `app.js` (core/meetings.js does the rest): Reconcile the goals (every month, 20 min), Season review (every season, 60 min:
due by the end of each new season's first week, so it comes up when This season is empty and Carry over is there), and Re-read the
vision, set the year (every year, 2 h). Each fills Momo's "Meeting" cards in the week before it's due, and an overdue one dots the icon.

## Shared with other apps
`A.inbox(from, to)` (core/inbox.js; read-only copies): for each week (Monday to Sunday) from `from`'s to `to`'s, every open goal with
hours in that week's season (its Monday's: "a week belongs to its Monday's season") gives `{ id: "goal:<goalId>:<Monday>", title,
block: title, fill: "hours", minutes (hoursWeek × 60; a total: what's left after the hours Momo logged, over the season's weeks from
this one on not closed yet, or without Momo the total over the season's weeks; rounded up to 15, 0 once reached), from: Monday, due:
Sunday, details: [the chain, "Next: …", "5 h a week"] }`. Momo spreads it over the cards with its title that week (its cards on the
days before today count as done) and makes what's left one task on that week's board. `A.open(id)` (Momo's "Open in Iroh") scrolls
to the goal and flashes it, opening Earlier if that's where it is.
Iroh reads Momo's `hoursSpent(title)` (apps/momo/CLAUDE.md; read-only), once Momo has started: `progressOf(g)`.

## Invariants
- Goals are added to this season or this year only (no planning ahead); Carry over copies an open goal from an earlier season into
  this one (new id, same year goal, hours and next step), once per title.
- "This season" goes by today's date; a week, for Momo and for counting a season's weeks, by its Monday's.
- Seasons, weeks, amber and the weekly minutes are worked out, never stored. "Today" is `K.util.todayStr()` (time travel works);
  `Date.now()` is only for the `at` / `u` stamps.
- Progress is Momo's close-out by title: spent is the hours in the season's closed weeks. A goal in hours a week shows "22 of 60 h"
  (out of hours a week × its weeks, from the week it was added), on pace while spent ≥ hours a week × the weeks closed since then − 1 h,
  else "6 h behind" (amber); a total shows what's left and the hours a week to finish (its head just "60 h in total"). Without Momo,
  the plan only. Renaming a goal leaves the hours logged under its old title behind. Iroh redraws on show and each minute when Momo's
  hours for this season's goals changed.
- Bug reports and console messages hold counts only: never the areas' or goals' words.
