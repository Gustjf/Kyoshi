# Hawky — errands and shopping lists (a Kyoshi app)
Gets things out of your head, on the phone, in seconds. Two tabs: **Errands** and **Shopping** (it opens on Errands;
Shopping says how many lists are ready to buy).
**Errands** are one-off tasks and things promised: the text, a tap for the day (Today, Pick a day, or none), one for how
long (15 min, 30 min, 1 hour, Other) and, after + Note, a note. The list shows them by when they're due: Overdue, Today,
This week (by Sunday) and Later (dated beyond, soonest first, then the undated, oldest first, each saying how long it
has waited); ✓ ticks one off, and the done ones fold away. **Momo** decides when: every open errand due by the end of
next week (or undated) is a card of its own there, waiting in its Tasks until you drag it onto a day; a ticked one shows ✓.
**Shopping lists** hold the products you spot (not groceries: Turtleduck's) for a cooling-off period before buying: each
item goes on its store and topic's list, one list per topic; once everything's on it, a list is locked for 30 or 7 days,
and while it's locked items can only come off (an amber Unlock early warns first); then each item is ticked as it's
bought, and the done list folds away. Lists never go to Momo.
Named after Sokka's messenger hawk (the icon is Lucide's bird, in teal).
Rules, versioning and the app contract: the root `CLAUDE.md`. Version & changelog: `changelog.js`.

## Files (load order)
| File | What's in it |
|---|---|
| `app.js` | `Kyoshi.register` (name, title, icon, 780px wide, backup note, its checkup); constants (`MAX_TEXT` 60, `MAX_NOTE` 200, minutes 5–480 with `DEFAULT_MINUTES` 15, `DONE_PAGE`, `DOT_WHEN_OVERDUE`; the lists' `MAX_VENDOR` and `MAX_TOPIC` 40, `MAX_ITEM` 100, `MAX_ITEM_NOTE` 300, `LOCK_DAYS` [30, 7], `MAX_LOCK_DAYS`; `DATA_SCHEMA_VERSION`); state `A.S`; helpers (`cleanLine`, `cleanText`, `firstLine`, `cleanMinutes`, `readMinutes`, `fmtMinutes`, `sundayOf`, `fmtDay`, `dayWords`, `waited`, `GROUPS`/`groupOf`, `openItems`, `overdueItems`, `doneItems`) |
| `markup.js` | the page: the nav, Errands (quick add, the list, the Done fold), Shopping (the add row, the lists, their Done fold), Backup & sync, the pop-ups (errand, list, item) |
| `changelog.js` | version history |
| `data.js` | storage (`load`, `save`), cleaning (errands, lists and their items), backups and sync merge (`A.data`) |
| `share.js` | what Momo reads (`inbox`) and opens (`open`) |
| `lists.js` | the shopping lists' model (its header documents it): lookups (`listFor`, `activeLists`, `doneLists`, `clashOf`, the names the add row suggests), `stateOf` (open, locked, ready, done), `unlockDay`, `daysLeft`, and the changes (`addItem`, `editItem`, `removeItem`, `lockList`, `unlockEarly`, `tickItem`, `tickAll`, `renameList`, `deleteList`) |
| `lists-view.js` | the Shopping view (`renderLists`): the add row and its suggestions, the lists by store as cards, the Done fold; the list pop-up (Rename, Delete list) and the item pop-up (words, note, Remove); its taps (`wireLists`) |
| `render.js` | `renderAll` (the nav and both views), `showView`, `renderAdd`: the chips and the note line, the groups (each with its total time), the Done fold (a page at a time) |
| `editor.js` | the errand pop-up: text, note, due, minutes; Save (Enter), Cancel, Delete |
| `events.js` | `A.init` wiring (the nav, quick add with + Note, ✓ and undo) and the hooks: `onTick` (a new day), `onReload`, `attention` (overdue), `bugState` |
| `hawky.css` | styles under `.app-hawky` |

## State (`A.S`)
Saved:
- `items` [{ id, text, note, due, minutes, done, deleted, at, u }]: errands. `text` ≤ 60 (the need's title in Momo), `note`
  ≤ 200 (lines kept; "" for none, as in errands from before notes), `due` "YYYY-MM-DD" or "" (no date), `minutes` 5–480,
  `done` the day it was ticked or "" while open, `at` when it was added (the undated's order and how long they've waited),
  `u` when it last changed (the later wins in sync). Deleted ones stay as markers. Done ones are kept for good.
- `lists` [{ id, vendor, topic, items, lock, unlocked, done, deleted, at, u }]: shopping lists. `vendor` (the store) and
  `topic` ≤ 40 each; `items` [{ id, text ≤ 100, note ≤ 300 (a note or a web link, lines kept), at (when added: their order
  and how long they've waited), bought ("" or the day ticked), deleted }]; `lock` null while open, else { at: the day it
  was locked, days: 30 or 7 (any whole number up to 365 is kept from a file) }; `unlocked` the day it was unlocked early,
  or ""; `done` the day it was done, or ""; `u` when it or any of its items last changed. Deleted lists and items stay as
  markers. Done lists are kept for good.
This device only: `view` ("errands" | "lists"; it opens on errands), `add` (quick add: `day` "none"|"today"|"pick",
`minutes` 15|30|60|"other", `note` its note line shown; back to no day, 15 and no note after each add), `listNote` (the
add row's note line shown), `editing` (the errand pop-up), `listEditing` and `itemEditing` (theirs), `doneShown`,
`listsDoneShown`, `knownToday`.

## Storage (`A.store`) and backups
Keys: `items`, `lists` (plus core's `sync` and `meetings`). Backup JSON: `{ schemaVersion: 2, appVersion, items, lists }`
(plus core's `meetings`). Version 1 had no `lists`: importing one replaces the errands only and leaves the lists here as
they are (its question says so). Errands are merged errand by errand by `u`, lists list by list by `u` (a list whole,
items and all, like Pabu's people), deleted ones kept as markers; a sync save with no `lists` (from a version before
them) leaves ours be, even when it's taken whole, and the folder gets them back. Wan Shi Tong's backups keep `items` too,
so `looksLike` also checks that each live item has `text` (theirs have `name`). Import JSON refuses a file with no
errands or lists in it and asks with the counts ("Replace your 3 errands and 2 shopping lists with …"). `hasData`: any
errand or list.

## Shared with other apps
`A.inbox(from, to)` (core/inbox.js; read-only copies): every open errand due by `to` (one due later asks nothing of Momo
yet), soonest due first (so overdue ones lead), then the undated oldest first, then those done between `from` and `to`, each `{ id (the errand's), title (its text), fill: "card",
details: ["Due Oct 7"] or ["No date · added Sep 30"], then the note's first line if it has one, minutes, due (or null),
overdue (due before today), done, date (the day done; null while open) }`; "added" is the real day, from `at`. Each is a
card of its own in Momo, titled by its text and as long as it takes: an open one waits in Momo's Tasks (from today to its
due day, any day once overdue) until you place it; a done one keeps the errand's id, so ✓ shows on its card, or Momo
places one on the day it was ticked; it never goes to Tasks.
`A.open(id)` (Momo's "Open in Hawky") puts Errands on screen, scrolls to the errand and flashes it, opening the Done fold
for a done one. Shopping lists are never shared.

## Invariants
- Groups, overdue, a list's state, how long something has waited and the words for days are worked out, never stored.
  "Today" is `K.util.todayStr()` (time travel works); `Date.now()` is only for the `at` / `u` stamps. Weeks run Monday
  to Sunday, as in Momo.
- A list's state (`stateOf`): done once `done` is set; else open with no `lock`; else locked while today is before the
  lock's day + its days and it wasn't unlocked early; else ready. Open: items added, changed, taken off; Lock 30 days or
  Lock 7 days. Locked: items only come off, and one added for its store and topic is refused (the owner's choice); Unlock
  early asks first. Ready: ✓ each, or Tick all (asks first); items can still be added, changed or taken off. Every item
  bought → done that day, into the Done fold (newest first); un-ticking one there makes it ready again.
- One list per store and topic (case-insensitive) among those not done: adding finds it, a done one's store and topic
  start a new list, Rename refuses another's (no merging), and a store typed in other capitals keeps the spelling already
  used. Two made on two devices before they synced both stay (adding goes to the one not locked).
- A list with no items left goes. Taking an item off asks first; deleting a list (its pop-up) too.
- A note's web addresses (http and https only) show as the site's name and open in a new tab; the rest is plain text.
- The dot on the icon (`A.attention`, "2 errands overdue") goes away with `DOT_WHEN_OVERDUE: false` in `app.js`; lists
  never dot it.
- Not now: recurring errands (Appa's job), tags, projects, sharing; prices or tax on lists; anything sent to Momo from
  the lists, or events placed by Hawky.
- Bug reports and console messages hold counts only: never the errands' or lists' words.
