# Pabu — keep in touch (a Kyoshi app)
The people you want to stay close to, each with how often you mean to reach them (every week, 2 weeks, month, quarter or
year, or birthday only) and how (a call, a text, a visit, each with its minutes). The list shows who's due: Due now (due
today or overdue), Coming up (within two weeks) and Later (birthday-only people at its end); ✓ says you talked today, and
the days you talked are kept. A Birthdays strip shows those in the next 30 days. **Momo** decides when: whoever's due fills
your "Keep in touch" cards there, soonest due first, each whole and up to 6 days early; what doesn't fit is one Keep in
touch task in Momo's Tasks; birthdays are events on its board. Named after Bolin's fire ferret (the icon is Lucide's
heart-handshake, in rose). Rules, versioning and the app contract: the root `CLAUDE.md`. Version & changelog: `changelog.js`.

## Files (load order)
| File | What's in it |
|---|---|
| `app.js` | `Kyoshi.register` (name, title, icon, 780px wide, backup note, its checkup); constants (`MAX_NAME` 40, `MAX_NOTE` 300, minutes 5–480, `MAX_TALKS` 200, `EVERY`, `HOW` with each one's minutes, `BLOCK` "Keep in touch", `WINDOW_DAYS` 6, `SOON_DAYS` 14, `BIRTHDAY_DAYS` 30, `DOT_WHEN_OVERDUE`, `DATA_SCHEMA_VERSION`); state `A.S`; helpers (text and minutes, `everyOf`/`howOf`, `lastTalk`, `nextDue`, `dueOf`, `groupOf`, `byDue`, the words for days, birthdays: `parseBirthday`, `birthdayIn`, `nextBirthday`, `ageOn`, `fmtBirthday`) |
| `markup.js` | the page: quick add with its chips, the Birthdays strip, the list, Backup & sync, the person pop-up |
| `changelog.js` | version history |
| `data.js` | storage (`load`, `save`), cleaning (`cleanPeople`, `cleanTalks`, `cleanBirthday`), backups and sync merge (`A.data`) |
| `share.js` | what Momo reads (`inbox`, `agenda`) and opens (`open`) |
| `render.js` | `renderAll`, `renderAdd`: the chips, the Birthdays strip, the groups (each with how many and their time) |
| `editor.js` | the person pop-up: name, how often, how, minutes, the birthday's three fields, note, the days you talked; Save (Enter), Cancel, Delete |
| `events.js` | `A.init` wiring (quick add, ✓ and its undo) and the hooks: `onTick` (a new day), `onReload`, `attention` (anyone overdue), `bugState` |
| `pabu.css` | styles under `.app-pabu` |

## State (`A.S`)
Saved: `people` [{ id, name, every, how, minutes, talks, note, birthday, deleted, at, u }]: `name` ≤ 40; `every` "week" |
"2weeks" | "month" | "quarter" | "year" | "none" (birthday only: never due); `how` "call" | "text" | "visit"; `minutes` 5–480
(how's usual length until changed: 30, 10, 120); `talks` the days you talked, "YYYY-MM-DD", newest first, each once, at
most 200; `note` ≤ 300 (lines kept); `birthday` "MM-DD", "YYYY-MM-DD" (with the year born) or ""; `at` when they were
added (time travel aware, from `K.util.now()`: due that day until you first talk); `u` when they last changed (the later
wins in sync). Deleted ones stay as markers, with nothing personal (no name, talks, note or birthday).
This device only: `add` (quick add's chips: `every`, `how`; back to every month and a call after each add), `editing` (the
pop-up: its working list of days, the how last picked, and its fields and days as opened: Save writes only what was
changed there, the days as added and taken off, over the person as kept now, so another tab's ✓ meanwhile stays),
`knownToday`.

## Storage (`A.store`) and backups
Key: `people` (plus core's `sync` and `meetings`). Backup JSON: `{ schemaVersion: 1, appVersion, people }` (plus core's
`meetings`). Merged person by person by `u`, deleted ones kept as markers (Hawky's merge): the later change to a person wins
whole, so a ✓ on one device and an edit of the same person on another, before they sync, keep only the later (the owner's
choice; joining the days would bring back a ✓ taken off). `looksLike` checks that each live person has a name. Import
JSON refuses a file with nobody in it, says so for a newer version's, and asks with the counts
("Replace your 3 people with the 8 people in this backup?").
Cleaning keeps an `every` or `how` this version doesn't know when it's a short id (a newer version's, so it survives a
round trip; `everyOf`/`howOf` read it as every month and a call, and the pop-up leaves it be unless changed there).

## Shared with other apps
`A.inbox(from, to)` (core/inbox.js; read-only copies): everyone with a schedule who's due by `to`, soonest first, each
`{ id: "p:<id>", title: "Call Mom", block: "Keep in touch", minutes, due, from (6 days before due; null once overdue),
overdue, details: ["Every month · last talked 5 weeks ago", the note's first line] }` ("never talked · added Sep 27" before
the first talk); then their talk days between `from` and `to` (by day, then title), `{ id: "p:<id>:<day>", …, date, done:
true }`. Birthday-only people send none. Momo fills its "Keep in touch" cards with them by time, each whole: on a day from
`from` up to `due` (any day once overdue); what doesn't fit is one task; a talk takes its minutes on its day's card, with
✓ (the card says done once everyone on it is) and never goes to Tasks.
`A.agenda(from, to)` (core/agenda.js): each birthday in the range, `{ id: "bday:<id>:<year>", title: "Mom's birthday", date,
time: null, minutes: 15, note: "Turns 60 · Call", done: talked that day }`: an icon in the day's heading on Momo's board, an
"any time" row on Today.
`A.open(id)` (Momo's "Open in Pabu") takes any of the three ids, scrolls to the person and flashes them.

## Invariants
- Due, groups and the words for days are worked out, never stored. Due = the last talk on or before today (`lastTalk`; a
  day ahead from a device whose clock was wrong is kept but never counts) + every (`addDays` 7 or 14, `addMonths` 1, 3 or
  12, as core's meetings); never talked, the day added. A birthday never makes anyone due.
- "Today" is `K.util.todayStr()` (time travel works); `Date.now()` is only for the `u` stamps.
- Birthdays: Feb 29 is kept, and falls on Feb 28 in a year without it; the pop-up checks the day against the month (and
  the year, when given: 1900 to this one). Titles stay within Momo's limits by construction ("Visit " + 40; "'s birthday").
- The dot on the icon (`A.attention`, "2 people overdue") goes away with `DOT_WHEN_OVERDUE: false` in `app.js`.
- Not now: snooze, groups or tags, phone numbers or other contact details, importing contacts, notifications, message
  history, anniversaries or other dates.
- Bug reports and console messages hold counts only: never names, notes or birthdays.
