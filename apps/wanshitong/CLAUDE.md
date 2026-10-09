# Wan Shi Tong — media tracker for recommendations (a Kyoshi app)
A lightweight place to offload every recommendation (books, movies, TV/anime and games)
instead of keeping them in browser tabs. Its point: open it and see something
worthwhile to do instead of mindless consuming. **Active media** (up to three at once, of any kind: a book and
a game side by side; all in the owl's purple) sits on top as the reference point; everything else waits in the
**backlog**, grouped by category, each group in its own colour. Starting a fourth asks which one goes back to
make room; finishing one frees its spot; finished ones go to a fold-away **Finished** list. Named after the
owl spirit who keeps the library of all knowledge (the icon is Lucide Lab's owl). Not to be confused with the
GitHub repo Project-Wan-Shi-Tong, which is Bosco's standalone.
Rules, versioning and the app contract: the root `CLAUDE.md`. Version & changelog: `changelog.js`.

## Files (load order)
| File | What's in it |
|---|---|
| `app.js` | `Kyoshi.register` (name, title, owl icon, 780px wide); constants (`CATS`, `OTHER`, `NOW_SPOTS`, `SLOTS`, `HAVE`, limits, `DATA_SCHEMA_VERSION`); state `A.S`; helpers (formatting, Google links, where each item is: `nowSpots`, `nowItems`, `spotOf`, `freeSpot`, `backlog`, `finished`, `setSlot`, `unslot`); `inbox()` and `open(id)` for Momo |
| `markup.js` | the page: Active media, Backlog, Finished, the add / edit pop-up, and "Active media is full" |
| `changelog.js` | version history |
| `data.js` | storage (`load`, `save`), cleaning, backups and sync merge (`A.data`) |
| `render.js` | `renderAll`: Active media (and its free spots), the backlog's groups (`buildGroups`, made once), Finished |
| `editor.js` | the add / edit pop-up: category, name, a movie's Director and Year (a row shown for movies only), info (the box its category asks for: none for a movie, "Note from before" for an older movie's), Available to me now (Yes / No), why; Add another; delete; duplicate check |
| `events.js` | `A.init` wiring; moving items (start → a free spot, or the "Active media is full" pop-up to swap one out; done frees its spot; back to backlog; put back); hooks `onTick`, `onKeydown`, `onReload`, `bugState` |
| `wanshitong.css` | styles under `.app-wanshitong`: Active media's violet, each backlog group's colour (by `data-cat`) |

## State (`A.S`)
`items` [{ id, cat, name, director, year, info, have, why, added, started, done, deleted, at, u }]:
`cat` a `CATS` id (an unknown one from a newer version is kept and shown as Other) · `director` (≤ `MAX_DIRECTOR` 80)
and `year` (as typed, ≤ `MAX_YEAR` 12: "2001", "1984–1985"): a movie's own, optional, since 2.472; "" for every other
category (saving one writes "") and in older data · `info` just enough to find it, what its category's box asks for
(`CATS[].info`: a book's author or edition, TV's year, a game's platform, Other's details); a movie has no box since
2.582, so a new one writes "", and an older movie's (an older "Miyazaki, 2001") stays as it is, nothing split or moved:
under its name, and in its pop-up as "Note from before" until it's moved into Director / Year or cleared · the line under the name reads
"Director, Year", then `info` after a "|" (only `info` when there's no director or year: books, TV and games look as
before); the magnifier's search adds both · `have` "" (not yet) | "yes" (available to me now; older values "downloaded" | "borrowed" |
"owned" are kept and read as yes, and saving the item writes "yes") · `why` optional note · `added` / `started` / `done`
"YYYY-MM-DD" or "" (`done` set = finished) · deleted ones stay as markers · `at` when added, `u` when last changed.
`slots` { now, now2, now3, next }: each { id ("" = empty), u } — Active media's spots (`NOW_SPOTS`), and `next`:
Up next's until 2.362, now unused but kept in storage, backups and sync (never dropped); an item it still holds
shows in the backlog, and starting it clears `next`. Before 2.000 there was only `now`, so older data and backups
fill the first spot. Active media lists its items in the order they went in (their spot's `u`). An item is in the
backlog when it isn't finished and no Active media spot holds it; so there are never more than three active, by
construction.
UI: `folded` (backlog groups folded on this device), `editing` (the pop-up: `hadInfo`, whether the item held info
when it opened), `swapping` (the id to start once one makes room), `lastCat`, `knownToday`.

## Storage (`A.store`) and backups
Keys: `items`, `slots`, `folded` (this device's; not synced or backed up), `sync` and `meetings` (core's).
Backup JSON: `{ schemaVersion: 1, appVersion, items, slots }`.

## Shared with other apps
`A.inbox()` (core/inbox.js; read-only copies): what's in Active media, in order, each `{ id, title: name, fill: "ongoing", details: ["Active · <Kind>"] }`:
Momo's Tasks keep each to draw from, and its cards with that title show it. `A.open(id)` (Momo's "Open in Wan Shi Tong") opens the item's pop-up.

## Invariants
- A spot whose item is gone or finished counts as free, and one item in two spots counts in the first (two
  devices can leave them that way): see `nowSpots`. Nothing needs repairing after a sync.
- Sync merges items one by one and each slot on its own, the later `u` winning (same result on every device).
- The pop-up's info box shows when the category asks for info, or when the item held info as it opened ("Note from
  before" when its category asks for none: an older movie's); its text is saved only while it shows, else "" (as a
  movie's Director and Year are for the rest). No box shows example text (the owner's choice, 2.582).
- Dates come from `K.util.todayStr()` (time-travel aware); `Date.now()` only for `at` / `u`.
- Bug reports never include names, info or notes: counts only.
