# Hawky — errands and shopping lists (a Kyoshi app)
Gets things out of your head, on the phone, in seconds. Two tabs: **Errands** and **Shopping** (it opens on Errands;
Shopping says how many lists are ready to buy).
**Errands** are one-off tasks and things promised: the text, a tap for the day (Today, This week or Next week: due that
Sunday, Pick a day, or none; This week unless another is tapped), one for how long (5 min, 15 min, 30 min, 1 hour, Other;
15 min unless another is tapped) and, after + Note, a note. The list shows them by when they're due: Overdue, Today,
This week (by Sunday) and Later (dated beyond, soonest first, then the undated, oldest first, each saying how long it
has waited); ✓ ticks one off, and the done ones fold away. An overdue one has Tomorrow →, which moves it to tomorrow and
counts; past three times its line carries a warning mark ("postponed 4×").
**Momo** decides when: every open errand due by the end of next week (or undated) is a card of its own there, waiting in
its Tasks until you drag it onto a day; a ticked one shows ✓.
**Shopping lists** hold the products you spot (not groceries: Turtleduck's) for a cooling-off period before buying: each
item goes on its store and topic's list, one list per topic; once everything's on it, a list is locked for 30 or 7 days,
and while it's locked items can only come off (an amber Unlock early warns first); then each item is ticked as it's
bought, and the done list folds away; Bought marks an open list's items bought without the wait. Once a list's wait is
over, Hawky adds an errand to buy it (a card in Momo like any errand), and the two complete each other. Each store has its
own colour (a dot by its name, the left edge of its lists). The add row keeps the store and topic for the next item;
typing another store clears that topic.
Named after Sokka's messenger hawk (the icon is Lucide's bird, in teal).
Rules, versioning and the app contract: the root `CLAUDE.md`. Version & changelog: `changelog.js`.

## Files (load order)
| File | What's in it |
|---|---|
| `app.js` | `Kyoshi.register` (name, title, icon, 780px wide, its checkup); constants (`MAX_TEXT` 60, `MAX_NOTE` 200, minutes 5–480 with `DEFAULT_MINUTES` 15, `DEFAULT_DAY` "week", `DONE_PAGE`, `DOT_WHEN_OVERDUE`, `POSTPONE_WARN` 3; the lists' `MAX_VENDOR` and `MAX_TOPIC` 40, `MAX_ITEM` 100, `MAX_ITEM_NOTE` 300, `LOCK_DAYS` [30, 7], `MAX_LOCK_DAYS`, `BOUGHT_LOCK_DAYS` 1 (how Bought is kept); a ready list's errand: `LIST_ERRAND` "list:" (its id's start), `LIST_ERRAND_MINUTES` 30; `DATA_SCHEMA_VERSION`); state `A.S`; helpers (`cleanLine`, `cleanText`, `firstLine`, `cleanMinutes`, `readMinutes`, `fmtMinutes`, `sundayOf`, `fmtDay`, `dayWords`, `waited`, `GROUPS`/`groupOf`, `openItems`, `overdueItems`, `doneItems`) |
| `markup.js` | the page: the nav, Errands (quick add, the list, the Done fold), Shopping (the add row, the lists, their Done fold), the pop-ups (errand, list, item) |
| `changelog.js` | version history |
| `data.js` | storage (`load`, `save`), cleaning (errands, lists and their items), backups and sync merge (`A.data`) |
| `share.js` | what Momo reads (`inbox`) and opens (`open`: an errand, or a ready list's errand's list) |
| `lists.js` | the shopping lists' model (its header documents it): lookups (`listFor`, `activeLists`, `doneLists`, `clashOf`, the names the add row suggests), `stateOf` (open, locked, ready, done), `unlockDay`, `daysLeft`, the changes (`addItem`, `editItem`, `removeItem`, `lockList`, `unlockEarly`, `tickItem`, `tickAll`, `buyNow` (Bought), `unbuy` (an errand's ✓ taken back), `renameList`, `deleteList`), and a ready list's errand (`keepErrands`, `listOfErrand`) |
| `lists-view.js` | the Shopping view (`renderLists`): the add row and its suggestions (another store typed after an add clears its topic: `storeTyped`), the lists by store as cards (an open one's Lock 30 days, Lock 7 days and Bought; a ready one's line while its errand waits), each store in its colour (`storeColors`), the Done fold; the list pop-up (Rename, Delete list) and the item pop-up (words, note, Remove); its taps (`wireLists`) |
| `render.js` | `renderAll` (the nav and both views), `showView`, `renderAdd`: the chips and the note line, the groups (each with its total time; Tomorrow → on overdue errands, the warning mark past `POSTPONE_WARN`), the Done fold (a page at a time) |
| `editor.js` | the errand pop-up: text, note, due, minutes, how often it was postponed, the list a ready list's errand is for; Save (Enter), Cancel, Delete |
| `events.js` | `A.init` wiring (the nav, quick add with + Note, ✓ and undo (a list's errand buys its list, and back), Tomorrow →) and the hooks: `onTick` (a new day), `onReload`, `attention` (overdue), `bugState`; the first draw, a new day and `onReload` keep the lists' errands in step (`keepErrands`) |
| `hawky.css` | styles under `.app-hawky` |

## State (`A.S`)
Saved:
- `items` [{ id, text, note, due, minutes, done, postponed, deleted, at, u }]: errands. `text` ≤ 60 (the need's title in
  Momo), `note` ≤ 200 (lines kept; "" for none, as in errands from before notes), `due` "YYYY-MM-DD" or "" (no date),
  `minutes` 5–480, `done` the day it was ticked or "" while open, `postponed` how many times Tomorrow → moved it (a whole
  number, up to 999 from a file; 0 before any, in errands from before it, and in a deleted one), `at` when it was added
  (the undated's order and how long they've waited), `u` when it last changed (the later wins in sync). Deleted ones stay
  as markers. Done ones are kept for good (but a list's errand goes with its list). One whose id is `list:<a list's id>`
  is that list's errand (Invariants).
- `lists` [{ id, vendor, topic, items, lock, unlocked, done, deleted, at, u }]: shopping lists. `vendor` (the store) and
  `topic` ≤ 40 each; `items` [{ id, text ≤ 100, note ≤ 300 (a note or a web link, lines kept), at (when added: their order
  and how long they've waited), bought ("" or the day ticked), deleted }]; `lock` null while open, else { at: the day it
  was locked, days: 30 or 7 (any whole number up to 365 is kept from a file) }; `unlocked` the day it was unlocked early,
  or ""; `done` the day it was done, or ""; `u` when it or any of its items last changed. Deleted lists and items stay as
  markers. Done lists are kept for good. Bought is kept as a 1-day lock (`BOUGHT_LOCK_DAYS`: no button offers it) unlocked
  early the day it was locked (nothing new stored).
This device only: `view` ("errands" | "lists"; it opens on errands), `add` (quick add: `day` "none"|"today"|"week"|
"nextweek"|"pick", `minutes` 5|15|30|60|"other", `note` its note line shown; This week, 15 and no note at first, and
back to them after each add), `listNote` (the add row's note line shown), `listLast` ({ vendor, topic } of the add row's
last add; `topic` emptied once another store typed has cleared it from the row), `editing` (the errand pop-up),
`listEditing` and `itemEditing` (theirs), `doneShown`, `listsDoneShown`, `knownToday`.

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
details: ["Due Oct 7"] or ["No date · added Sep 30"], then the note's first line if it has one, then "Postponed 4×" once
it's been postponed more than `POSTPONE_WARN` (3) times, minutes, due (or null),
overdue (due before today), done, date (the day done; null while open) }`; "added" is the real day, from `at`. Each is a
card of its own in Momo, titled by its text and as long as it takes: an open one waits in Momo's Tasks (from today to its
due day, any day once overdue) until you place it; a done one keeps the errand's id, so ✓ shows on its card, or Momo
places one on the day it was ticked; it never goes to Tasks.
`A.open(id)` (Momo's "Open in Hawky") puts Errands on screen, scrolls to the errand and flashes it, opening the Done fold
for a done one; for a ready list's errand (`list:<id>`), Shopping and the list instead, the lists' Done fold opened for a
done one, while the list is there. Shopping lists are never shared, except through a ready list's errand, an errand like
any other.

## Invariants
- Groups, overdue, a list's state, how long something has waited, the words for days and a store's colour are worked
  out, never stored. "Today" is `K.util.todayStr()` (time travel works); `Date.now()` is only for the `at` / `u` stamps.
  Weeks run Monday to Sunday, as in Momo: quick add's This week and Next week are due that week's Sunday (on a Sunday,
  This week is today).
- Tomorrow → shows only on an open errand that's overdue: due becomes tomorrow (from today, not from its old due day) and
  `postponed` goes up by one. Changing the day in its pop-up isn't counted. Past `POSTPONE_WARN` its line (open or done)
  starts with Lucide's triangle-alert and "postponed 4×", and Momo's details say so; up to it, only the pop-up says
  "Postponed 2 times".
- A store's colour (`storeColors` in lists-view.js, once per draw): one of twelve (`STORE_COLORS`, the most different
  first, read on dark and light), given in the order stores were first used: stores (any capitals) by their oldest
  list's `at`, done lists too, then by name; the i-th takes the i-th colour. So a store keeps its colour as new ones
  come, every device with the same lists agrees, and no two share one until there are more than twelve (a store whose
  lists are all deleted gives its place up).
- The add row (lists-view.js): after an add, the store and topic stay; typing a store that isn't that add's (any
  capitals) empties the topic box while it still holds that add's topic, once (`listLast.topic` emptied): a topic typed
  since stays, and typing the same store back brings nothing back.
- A list's state (`stateOf`): done once `done` is set; else open with no `lock`; else locked while today is before the
  lock's day + its days and it wasn't unlocked early; else ready. Open: items added, changed, taken off; Lock 30 days or
  Lock 7 days. Locked: items only come off, and one added for its store and topic is refused (the owner's choice); Unlock
  early asks first. Ready: ✓ each, or Tick all (asks first); items can still be added, changed or taken off. Every item
  bought → done that day, into the Done fold (newest first); un-ticking one there makes it ready again. Bought (open
  lists, a question first): every item bought today and the list done, kept as a 1-day lock unlocked early that same
  day, so the Done fold and un-ticking work as for any list.
- A ready list's errand (lists.js `keepErrands`): a list in state ready gets one errand, id `LIST_ERRAND` + the list's
  id (the link: no new field, and the same on every device, so two devices make one errand), "Buy <topic> at <store>"
  (cut at a word's end, with "…", past 60), due this Sunday, 30 minutes, stamped `u` 0 ("never changed": a device that
  hadn't synced yet makes it too, and that copy mustn't outrank what was done to it elsewhere, deleted, edited or
  ticked; two such copies settle the same way everywhere); its words are set when it's made (a list renamed later
  doesn't rename it). It mirrors its list both ways: open while the list is ready (reopened by the list, an item
  un-ticked or a sync, it's due this Sunday again if its day has passed), done on the list's done day (Tick all and ✓
  item by item included), a marker once the list goes (deleted, or its last item taken off); ✓ on the errand buys the
  list (every item bought today, as Tick all, no question), ✓ again un-buys the items bought that day (none bought
  that day, as when the list was done by taking its last item off: those bought last) and the list is ready again (the
  errand keeps its due day, as any errand's undo); an errand whose list is open or locked (a sync oddity) is left as
  it is, and its ✓ ticks it alone. Deleting the errand leaves the list, and its marker keeps the id, so no other is
  made. No errand for a Bought list, which never waited (a 1-day lock unlocked the day it was locked: `neverWaited`),
  not even once an item un-ticked makes it ready (Unlock early makes one, any day), nor for one done before this
  (until it's ready again), nor for a list whose id is too long for an errand's 40 characters (from a file). Run by
  every list change (`touch`), the first draw, a new day, another tab's save, sync (`afterSync`, which saves what it
  made: the other device makes the same id) and an import; the caller saves. Its pop-up says which list it's for; a
  ready list's card says "Its errand waits in Errands and Momo." while it's open. Known: a list deleted on one device
  and changed on another before they sync comes back (the later change wins) without its errand (the deletion's
  marker stays).
- One list per store and topic (case-insensitive) among those not done: adding finds it, a done one's store and topic
  start a new list, Rename refuses another's (no merging), and a store typed in other capitals keeps the spelling already
  used. Two made on two devices before they synced both stay (adding goes to the one not locked).
- A list with no items left goes. Taking an item off asks first; deleting a list (its pop-up) too.
- A note's web addresses (http and https only) show as the site's name and open in a new tab; the rest is plain text.
- The dot on the icon (`A.attention`, "2 errands overdue") goes away with `DOT_WHEN_OVERDUE: false` in `app.js`; lists
  never dot it (a list's errand does once it's overdue, as any errand).
- Not now: recurring errands (Appa's job), tags, projects, sharing; prices or tax on lists; events placed by Hawky.
- Bug reports and console messages hold counts only: never the errands' or lists' words.
