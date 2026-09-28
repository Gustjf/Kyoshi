# Wan Shi Tong — media tracker for recommendations (a Kyoshi app)
A lightweight place to offload every recommendation (novels, textbooks, movies, TV/anime, eLearning and
in-person courses) instead of keeping them in browser tabs. Its point: open it and see something worthwhile
to do instead of mindless consuming. **In progress** and **Up next** (one of each, across all media) sit on
top as reference points; everything else waits in the **magazine**, grouped by category, to be loaded into
them. Finishing In progress moves Up next into it, like the next round loading; finished ones go to a
fold-away **Finished** list. Named after the owl spirit who keeps the library of all knowledge (the icon is
Lucide Lab's owl). Not to be confused with the GitHub repo Project-Wan-Shi-Tong, which is Bosco's standalone.
Rules, versioning and the app contract: the root `CLAUDE.md`. Version & changelog: `changelog.js`.

## Files (load order)
| File | What's in it |
|---|---|
| `app.js` | `Kyoshi.register` (name, title, owl icon, 780px wide); constants (`CATS`, `OTHER`, `HAVE`, limits, `DATA_SCHEMA_VERSION`); state `A.S`; helpers (formatting, Google links, where each item is: `nowItem`, `nextItem`, `magazine`, `finished`, `setSlot`) |
| `markup.js` | the page: In progress & Up next, Magazine, Finished, Backup & sync, and the add / edit pop-up |
| `changelog.js` | version history |
| `data.js` | storage (`load`, `save`), cleaning, backups and sync merge (`A.data`) |
| `render.js` | `renderAll`: the two spots, the magazine's groups (`buildGroups`, made once), Finished |
| `editor.js` | the add / edit pop-up: category, name, info, Have it?, cost (courses), why; Add another; delete; duplicate check |
| `events.js` | `A.init` wiring; moving items (start, up next, done → promotes Up next, back to magazine, put back); hooks `onTick`, `onKeydown`, `onReload`, `bugState` |
| `wanshitong.css` | styles under `.app-wanshitong` |

## State (`A.S`)
`items` [{ id, cat, name, info, have, cost, why, added, started, done, deleted, at, u }]:
`cat` a `CATS` id (an unknown one from a newer version is kept and shown as Other) · `info` just enough to find it
(author, year…) · `have` "" (not yet) | "downloaded" | "borrowed" | "owned" (courses call it Enrolled) ·
`cost` dollars, 0 = free, null = unknown (courses only) · `why` optional note · `added` / `started` / `done`
"YYYY-MM-DD" or "" (`done` set = finished) · deleted ones stay as markers · `at` when added, `u` when last changed.
`slots` { now, next }: each { id ("" = empty), u } — In progress and Up next. An item is in the magazine when it
isn't finished and neither slot holds it; so there's never more than one of each by construction.
UI: `folded` (magazine groups folded on this device), `editing`, `lastCat`, `knownToday`.

## Storage (`A.store`) and backups
Keys: `items`, `slots`, `folded` (this device's; not synced or backed up), `sync` (core's).
Backup JSON: `{ schemaVersion: 1, appVersion, items, slots }`.

## Invariants
- A slot whose item is gone or finished counts as empty, and Up next never shows the item In progress shows
  (two devices can leave them that way): see `nowItem` / `nextItem`. Nothing needs repairing after a sync.
- Sync merges items one by one and each slot on its own, the later `u` winning (same result on every device).
- Dates come from `K.util.todayStr()` (time-travel aware); `Date.now()` only for `at` / `u`.
- Bug reports never include names, info or notes: counts only.
