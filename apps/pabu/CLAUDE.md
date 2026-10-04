# Pabu — keep in touch (a Kyoshi app)
The people you want to stay close to: each with a group (Family, Work…), notes, a birthday, and their calls, texts and
visits, each on its own schedule (every week, 2 weeks, month, quarter or year) with its own minutes and the days you
talked; none means birthday only. **This week** (at the top) lists every call, text or visit due by Sunday or overdue,
soonest first, with ✓ (talked today; a ticked one stays until the week ends, and ✓ again undoes it). Then quick add, a
Birthdays strip (the next 30 days), and **People**: group chips and one line per person, A to Z; tapping one opens the
pop-up where everything about them is edited and saved at once. **Momo** decides when: each call, text or visit due is
a card of its own there ("Call Mom"), waiting in its Tasks up to 6 days early until you drag it onto a day, ✓ once
you've talked; birthdays are events on its board. Named after Bolin's fire ferret (the icon is Lucide's
heart-handshake, in rose). Rules, versioning and the app contract: the root `CLAUDE.md`. Version & changelog: `changelog.js`.

## Files (load order)
| File | What's in it |
|---|---|
| `app.js` | `Kyoshi.register` (name, title, icon, 780px wide, backup note, its checkup); constants (`MAX_NAME` 40, `MAX_GROUP` 30, `MAX_NOTE` 1000, `MAX_CADENCES` 6, minutes 5–480, `MAX_TALKS` 200, `EVERY`, `OFTEN`, `HOW` with each one's minutes, `WINDOW_DAYS` 6, `SOON_DAYS` 14, `BIRTHDAY_DAYS` 30, `DOT_WHEN_OVERDUE`, `DATA_SCHEMA_VERSION`); state `A.S`; helpers (text and minutes, `everyOf`/`howOf`/`cadenceWords`, `needTitle`, `groupsInUse`, `lastTalk`, `nextDue`, `dueOf`, `allDue`, `nextDueOf`, `thisWeek`, `mondayOf`, the words for days, birthdays: `parseBirthday`, `birthdayIn`, `nextBirthday`, `ageOn`, `fmtBirthday`, `talkedOn`) |
| `markup.js` | the page: This week, quick add with its chips, the Birthdays strip, People (group chips, the list), Backup & sync, the person pop-up (its foot, the hint and Save, Cancel, Delete, kept in view) |
| `changelog.js` | version history |
| `data.js` | storage (`load`, `save`), cleaning (`cleanPeople`, `cleanCadences`: carries a version 1 person's one schedule over, `cleanTalks`, `cleanBirthday`), backups and sync merge (`A.data`) |
| `share.js` | what Momo reads (`inbox`, `agenda`) and opens (`open`) |
| `render.js` | `renderAll`, `renderAdd`: This week, the chips, the Birthdays strip, People (the group chips, each person's line) |
| `editor.js` | the person pop-up: name, group (a datalist of those in use), the birthday's three fields, notes, a box per call, text or visit (how, how often, ✕; minutes, last talked and due; its days, each with ✕; "Talked on" and Add), "+ Add a call, text or visit"; Save (Enter), Cancel, Delete |
| `events.js` | `A.init` wiring (quick add, This week's ✓ and its undo, the group chips) and the hooks: `onTick` (a new day), `onReload`, `attention` (calls, texts and visits overdue), `bugState` |
| `pabu.css` | styles under `.app-pabu` |

## State (`A.S`)
Saved: `people` [{ id, name, group, note, birthday, cadences, deleted, at, u }]: `name` ≤ 40; `group` ≤ 30 ("" for none;
one person, one group); `note` ≤ 1000 (lines kept); `birthday` "MM-DD", "YYYY-MM-DD" (with the year born) or "";
`cadences` their calls, texts and visits, at most 6 (none: birthday only, never due), each { id, every, how, minutes,
talks, at }: `id` a short id of its own within the person ("c1" for one carried over from version 1); `every` "week" |
"2weeks" | "month" | "quarter" | "year"; `how` "call" | "text" | "visit"; `minutes` 5–480 (how's usual length until
changed: 30, 10, 120); `talks` the days you talked that way, "YYYY-MM-DD", newest first, each once, at most 200; `at`
when it was added (due that day until you first talk; the person's, for one carried over). The person's `at` is when
they were added (time travel aware, from `K.util.now()`), `u` when they last changed (the later wins in sync). Deleted
ones stay as markers, with nothing personal (no name, group, note, birthday or calls, texts and visits).
This device only: `add` (quick add's chips: `every`, `how`; back to every month and a call after each add), `filter`
(People's chip: null for All, "" for No group, else a group, any case; back to All when its group is gone), `editing`
(the pop-up: the person's id and `at`, the birthday and its fields as opened, working copies of their calls, texts and
visits, each with the how last picked there, and the snapshot that tells whether closing would lose something),
`knownToday`.

## Storage (`A.store`) and backups
Key: `people` (plus core's `sync` and `meetings`). Backup JSON: `{ schemaVersion: 2, appVersion, people }` (plus core's
`meetings`). Version 1 (one schedule per person, at the top: `every`, `how`, `minutes`, `talks`) still imports, and
syncs: `cleanPeople` makes it one call, text or visit, "c1", with those days (none for birthday only, `every: "none"`);
the old top-level keys are no longer written. Merged person by person by `u`, deleted ones kept as markers (Hawky's
merge): the later change to a person wins whole, so a ✓ on one device and an edit of the same person on another, before
they sync, keep only the later (the owner's choice; joining the days would bring back a ✓ taken off). `looksLike`
checks that each live person has a name. Import JSON refuses a file with nobody in it, says so for a newer version's,
and asks with the counts ("Replace your 3 people with the 8 people in this backup?").
Cleaning keeps an `every` or `how` this version doesn't know when it's a short id (a newer version's, so it survives a
round trip; `everyOf`/`howOf` read it as every month and a call, and the pop-up leaves it be unless changed there). A
call, text or visit with no usable id, or one already used, gets the first free of c1, c2… (the same on every device).

## Shared with other apps
`A.inbox(from, to)` (core/inbox.js; read-only copies): every call, text or visit due by `to`, soonest first, each
`{ id: "p:<id>:<cid>", title: "Call Mom", fill: "card", minutes, due, from (6 days before due; null once overdue),
overdue, details: ["Every month · last talked 5 weeks ago", the note's first line] }` ("never talked · added Sep 27"
before the first talk); then the days you talked that way between `from` and `to` (by day, then title),
`{ id: "p:<id>:<cid>:<day>", …, date, done: true, of: "p:<id>:<cid>" }`. Birthday-only people send none. Each is a card
of its own in Momo, as long as it takes: one due waits in Momo's Tasks (from `from` up to `due`, any day once overdue)
until you place it; a talk completes its own call, text or visit (`of`), so ✓ shows on its card, or Momo places one on
the talk's day; it never goes to Tasks. (A weekly one talked this week can be due again next week: that's a new task,
for a new card.)
`A.agenda(from, to)` (core/agenda.js): each birthday in the range, `{ id: "bday:<id>:<year>", title: "Mom's birthday", date,
time: null, minutes: 15, note: "Turns 60 · Call" (their first call, text or visit), done: talked that day, any way }`:
an icon in the day's heading on Momo's board, an "any time" row on Today.
`A.open(id)` (Momo's "Open in Pabu") reads the person's id from the second part of any of the three ids: a call, text or
visit on This week scrolls into view there and flashes, else the person on People (the chips go back to All if they
hid them).

## Invariants
- Due, This week, the groups in use and the words for days are worked out, never stored. A call, text or visit is due
  its last talk on or before today (`lastTalk`; a day ahead from a device whose clock was wrong is kept but never
  counts) + every (`addDays` 7 or 14, `addMonths` 1, 3 or 12, as core's meetings); never talked, the day it was added.
  A birthday never makes anyone due. A person's next due is the soonest of theirs.
- This week runs Monday to Sunday (as Momo's): each call, text or visit due by Sunday, or overdue, as the week began
  (its talks before Monday), soonest first; done when you talked that way any day this week, so a ticked one keeps its
  place, ✓, until Sunday. ✓ adds today to that one only; ✓ again takes off the day that ticked it.
- Save in the pop-up writes the whole person at once (name, group, notes, birthday, calls, texts and visits as shown)
  over the person as kept now, and never stops without saying why: no name, a birthday that can't be, or minutes
  outside 5–480 are said in `#personHint`, right above Save (kept in view at the pop-up's foot), and that field is
  marked; a "Talked on" day picked but not added goes in; one unfinished, or not come yet, is left out, everything else
  saved, and the pop-up stays open to say so. An unchanged Save (nothing changed in the pop-up since it opened) just
  closes, writing nothing, so a change made to them meanwhile on another device stands.
- A group typed as one in use in other capitals takes that one's spelling; the chips show each group once (any case).
- "Today" is `K.util.todayStr()` (time travel works); `Date.now()` is only for the `u` stamps.
- Birthdays: Feb 29 is kept, and falls on Feb 28 in a year without it; the pop-up checks the day against the month (and
  the year, when given: 1900 to this one). Titles stay within Momo's limits by construction ("Visit " + 40; "'s birthday").
- The dot on the icon (`A.attention`, "1 call and 2 texts overdue") goes away with `DOT_WHEN_OVERDUE: false` in `app.js`.
- Not now: snooze, several groups or tags per person, phone numbers or other contact details, importing contacts,
  notifications, message history, anniversaries or other dates.
- Bug reports and console messages hold counts only: never names, groups, notes or birthdays.
