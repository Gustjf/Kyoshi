# Hawky — errands and pop-up tasks (a Kyoshi app)
Errands are jotted down the moment they come up, on the phone in seconds: the text, a tap for the day (Today, Tomorrow,
Pick a day, or none) and one for how long (15 min, 30 min, 1 hour, Other). The list shows them by when they're due:
Overdue, Today, This week (by Sunday), Later and Someday (no date); ✓ ticks one off, and the done ones fold away.
**Momo** decides when: every open errand due by the end of next week (or undated) is a card of its own there, waiting
in its Tasks until you drag it onto a day; a ticked one shows ✓ on it. Named after Sokka's messenger hawk (the icon is Lucide's bird, in teal).
Rules, versioning and the app contract: the root `CLAUDE.md`. Version & changelog: `changelog.js`.

## Files (load order)
| File | What's in it |
|---|---|
| `app.js` | `Kyoshi.register` (name, title, icon, 780px wide, backup note, its checkup); constants (`MAX_TEXT` 60, minutes 5–480 with `DEFAULT_MINUTES` 15, `DONE_PAGE`, `DOT_WHEN_OVERDUE`, `DATA_SCHEMA_VERSION`); state `A.S`; helpers (`cleanLine`, `cleanMinutes`, `readMinutes`, `fmtMinutes`, `sundayOf`, `fmtDay`, `dayWords`, `GROUPS`/`groupOf`, `openItems`, `overdueItems`, `doneItems`) |
| `markup.js` | the page: quick add, the list, the Done fold, Backup & sync, the errand pop-up |
| `changelog.js` | version history |
| `data.js` | storage (`load`, `save`), cleaning, backups and sync merge (`A.data`) |
| `share.js` | what Momo reads (`inbox`) and opens (`open`) |
| `render.js` | `renderAll`, `renderAdd`: the chips, the groups (each with its total time), the Done fold (a page at a time) |
| `editor.js` | the errand pop-up: text, due, minutes; Save (Enter), Cancel, Delete |
| `events.js` | `A.init` wiring (quick add, ✓ and undo) and the hooks: `onTick` (a new day), `onReload`, `attention` (overdue), `bugState` |
| `hawky.css` | styles under `.app-hawky` |

## State (`A.S`)
Saved: `items` [{ id, text, due, minutes, done, deleted, at, u }]: `text` ≤ 60 (the need's title in Momo), `due` "YYYY-MM-DD"
or "" (no date), `minutes` 5–480, `done` the day it was ticked or "" while open, `at` when it was added (the undated's order),
`u` when it last changed (the later wins in sync). Deleted ones stay as markers. Done ones are kept for good.
This device only: `add` (quick add's chips: `day` "none"|"today"|"tomorrow"|"pick", `minutes` 15|30|60|"other"; back to no day and
15 after each add), `editing` (the pop-up), `doneShown`, `knownToday`.

## Storage (`A.store`) and backups
Key: `items` (plus core's `sync` and `meetings`). Backup JSON: `{ schemaVersion: 1, appVersion, items }` (plus core's `meetings`).
Merged errand by errand by `u`, deleted ones kept as markers (the template's merge). Wan Shi Tong's backups keep `items` too, so
`looksLike` also checks that each live item has `text` (theirs have `name`), and Import JSON refuses a file with no errands in it.

## Shared with other apps
`A.inbox(from, to)` (core/inbox.js; read-only copies): every open errand due by `to` (one due later asks nothing of Momo
yet), soonest due first (so overdue ones lead), then the undated oldest first, then those done between `from` and `to`, each `{ id (the errand's), title (its text), fill: "card",
details: ["Due Oct 7"] or ["No date · added Sep 30"], minutes, due (or null), overdue (due before today), done, date (the day done;
null while open) }`; "added" is the real day, from `at`. Each is a card of its own in Momo, titled by its text and as long as
it takes: an open one waits in Momo's Tasks (from today to its due day, any day once overdue) until you place it; a done one
keeps the errand's id, so ✓ shows on its card, or Momo places one on the day it was ticked; it never goes to Tasks.
`A.open(id)` (Momo's "Open in Hawky") scrolls to the errand and flashes it, opening the Done fold for a done one.

## Invariants
- Groups, overdue and the words for days are worked out, never stored. "Today" is `K.util.todayStr()` (time travel works);
  `Date.now()` is only for the `at` / `u` stamps. Weeks run Monday to Sunday, as in Momo.
- The dot on the icon (`A.attention`, "2 errands overdue") goes away with `DOT_WHEN_OVERDUE: false` in `app.js`.
- Not now: recurring errands (Appa's job), tags, projects, sharing.
- Bug reports and console messages hold counts only: never the errands' text.
