# Wan Shi Tong — media tracker for recommendations (a Kyoshi app)
A lightweight place to offload every recommendation (books, movies, TV/anime and games)
instead of keeping them in browser tabs. Its point: open it and see something
worthwhile to do instead of mindless consuming. **In progress** (up to three at once, of any kind: a book and
a game side by side) and **Up next** (one, across all media) sit on top as reference points; everything else
waits in the **backlog**, grouped by category. Starting a fourth asks which one goes back to make room;
finishing one moves Up next into its spot; finished ones go to a fold-away **Finished** list. Named after the
owl spirit who keeps the library of all knowledge (the icon is Lucide Lab's owl). Not to be confused with the
GitHub repo Project-Wan-Shi-Tong, which is Bosco's standalone.
Rules, versioning and the app contract: the root `CLAUDE.md`. Version & changelog: `changelog.js`.

## Files (load order)
| File | What's in it |
|---|---|
| `app.js` | `Kyoshi.register` (name, title, owl icon, 780px wide); constants (`CATS`, `OTHER`, `NOW_SPOTS`, `SLOTS`, `HAVE`, limits, `DATA_SCHEMA_VERSION`); state `A.S`; helpers (formatting, Google links, where each item is: `nowSpots`, `nowItems`, `spotOf`, `freeSpot`, `nextItem`, `backlog`, `finished`, `setSlot`, `unslot`); `inProgress()` for other apps |
| `markup.js` | the page: In progress & Up next, Backlog, Finished, Backup & sync, the add / edit pop-up, and "In progress is full" |
| `changelog.js` | version history |
| `data.js` | storage (`load`, `save`), cleaning, backups and sync merge (`A.data`) |
| `render.js` | `renderAll`: In progress (and its free spots) & Up next, the backlog's groups (`buildGroups`, made once), Finished |
| `editor.js` | the add / edit pop-up: category, name, info, Have it?, why; Add another; delete; duplicate check |
| `events.js` | `A.init` wiring; moving items (start → a free spot, or the "In progress is full" pop-up to swap one out; up next; done → Up next takes its spot; back to backlog; put back); hooks `onTick`, `onKeydown`, `onReload`, `bugState` |
| `wanshitong.css` | styles under `.app-wanshitong` |

## State (`A.S`)
`items` [{ id, cat, name, info, have, why, added, started, done, deleted, at, u }]:
`cat` a `CATS` id (an unknown one from a newer version is kept and shown as Other) · `info` just enough to find it
(author, year…) · `have` "" (not yet) | "downloaded" | "borrowed" | "owned" ·
`why` optional note · `added` / `started` / `done`
"YYYY-MM-DD" or "" (`done` set = finished) · deleted ones stay as markers · `at` when added, `u` when last changed.
`slots` { now, now2, now3, next }: each { id ("" = empty), u } — In progress's spots (`NOW_SPOTS`) and Up next.
Before 2.000 there was only `now`, so older data and backups fill the first spot. In progress lists its items
in the order they went in (their spot's `u`). An item is in the backlog when it isn't finished and no spot
holds it; so there are never more than three in progress and one up next, by construction.
UI: `folded` (backlog groups folded on this device), `editing`, `swapping` (the id to start once one makes
room), `lastCat`, `knownToday`.

## Storage (`A.store`) and backups
Keys: `items`, `slots`, `folded` (this device's; not synced or backed up), `sync` (core's).
Backup JSON: `{ schemaVersion: 1, appVersion, items, slots }`.

## Shared with other apps
`A.inProgress()` (read-only): what's in progress, in order, as copies `[{ id, name, kind }]` (`kind`: the category's label).
Momo's Tasks read it. Keep its shape, or change Momo's `tasks.js` along with it.

## Invariants
- A spot whose item is gone or finished counts as free, one item in two spots counts in the first, and Up next
  never shows an item that's in progress (two devices can leave them that way): see `nowSpots` / `nextItem`.
  Nothing needs repairing after a sync.
- Sync merges items one by one and each slot on its own, the later `u` winning (same result on every device).
- Dates come from `K.util.todayStr()` (time-travel aware); `Date.now()` only for `at` / `u`.
- Bug reports never include names, info or notes: counts only.
