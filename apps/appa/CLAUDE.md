# Appa — preventive maintenance & records (a Kyoshi app)
Takes the mental load of looking after your things: a car (miles), a robot vacuum, a floor jack, battery tools…
Each job is entered once from the manual, with its **source** (which manual, which page). Appa works out when each is
due (by time, season or meter, whichever comes first) and sends it to **Momo** up to two weeks ahead (within the weeks Momo plans), sized to how long
it takes, as a card of its own ("Car: Oil change") waiting in its Tasks until you place it. While you do it, the **job view** shows your own notes
(bullets: parts, specs, steps) with a Start/Finish timer, and **Done** is one tap. There are no checklists. Timed jobs teach the estimate. Records keep optional
proof (photos, PDFs, links) and become a minimal **PDF report** (newest first, each job's proof right after it)
for a buyer or an insurer. Named after Aang's flying sky bison (the icon is Lucide Lab's bull-head, in bison brown).
Rules, versioning and the app contract: the root `CLAUDE.md`. Version & changelog: `changelog.js`.

## Files (load order)
| File | What's in it |
|---|---|
| `app.js` | `Kyoshi.register` (name, title, icon, 780px wide, backup note); constants (`METERS`, `UNITS`, `LEAD_DAYS` 14, `SOON_DAYS`, reading rules, `ESTIMATE_RUNS`, limits, `ICONS`, `DATA_SCHEMA_VERSION`); state `A.S`; helpers (`niceMinutes`, `fmtMinutes`, `parseMinutes`, `fmtReading`, `fmtMoney`/`parseMoney` in cents, `fmtDay`, `safeLink`, `sourceLink` (#page=N)) |
| `markup.js` | the page: three views (home, a thing, a job) and the pop-ups (thing, job, record, reading, report) |
| `changelog.js` | version history |
| `model.js` | **the data model** (header comment documents it): cleaners for every list, lookups (`thingById`, `jobsOf`, `recordsOf`, `workOf`…) |
| `data.js` | storage (`load`, `persist`, `save`, `storeTimer`), backups and sync merge (`A.data`, incl. `files()` for folder sync) |
| `schedule.js` | the maths, never stored, memoized by `S.version` and today: readings & pace, next due (`dueOf`: time/season/meter), `statusOf`, `minutesOf` (the estimate), `readingAsk`, `upcoming`, and the words (`dueText`, `everyText`…) |
| `share.js` | what Momo reads (`inbox`) and opens (`open`) |
| `render.js` | `showView`, `renderAll`: home (Coming up, Things, Records), a thing (reading, sources, Schedule, History), the records tables, the timer bar |
| `job-view.js` | the job view (notes as bullets, last time), the timer (`start`/`finish`/`stopTimer`, this device only; it tells `K.wakeLock` when it starts and stops) |
| `proof.js` | photos (upright JPEGs ≤ 2000 px on white), PDFs (`K.pdf.inspect`: protected or unreadable ones flagged), links, thumbnails |
| `record.js` | the record pop-up (done / log / full: see its header) and the reading pop-up (`saveReading`) |
| `thing-editor.js` | the thing pop-up: name, about, serial, meter (fixed once it has readings), pace, sources; archive; delete |
| `job-editor.js` | the job pop-up: how often (every N / each season / meter only, plus every N on the meter), last done, how long, source + page, notes |
| `report.js` | the report pop-up and gathering (`gather`) |
| `report-pdf.js` | the report's layout with `K.pdf` (`buildReport`) |
| `events.js` | `A.init` wiring and the hooks: `onShow`, `awake` (a running timer keeps the screen on: core/wakelock.js), `onTick`, `onKeydown` (Enter saves), `onReload`, `attention` (overdue, a reading asked for), `renderDev` (photos & PDFs), `bugState` |
| `appa.css` | styles under `.app-appa` |

## State (`A.S`)
Saved: `things`, `jobs`, `records`, `readings`, `files`, `settings` (shapes in `model.js`) · this device's `timer` { jobId, start } ·
`version` (counts changes, for the memo) · UI: `view` "home"|"thing"|"job", `thingId`, `jobId`, `page`, `allRecords`, `editing` (thing or
job pop-up), `rec` (record pop-up: mode, jobIds, files in memory until Done, links), `reading`, `report`, `knownToday`.

## Storage (`A.store`), files and backups
Keys: `things`, `jobs`, `records`, `readings`, `files`, `settings`, `timer` (this device's; never synced or backed up), `sync` and `meetings` (core's).
Photos and PDFs themselves live in `A.files` (core/files.js: IndexedDB "kyoshi-files"), and folder sync copies them as plain
files, `<folder>/appa/files/<id>.jpg|pdf`; cloud sync never carries them, only the records (a photo that isn't here shows "Not on
this device", and a report leaves it out after saying so). **Backups are data only**: `{ schemaVersion: 1, appVersion, things, jobs, records,
readings, files, settings }`, where `files` holds the file records, not their bytes. The backup note says so.
A record's own `minutes` (1.363: other work alone keeps the time typed; a record with jobs keeps it on them) is new: an
older file has none (Momo gets the usual 30), and an older copy of Appa drops it when it saves: reload Appa on every device.

## Shared with other apps
`A.inbox(from, to)` (core/inbox.js; read-only copies), all `fill: "card"` (each a card of its own in Momo, titled with its thing:
"<name>: <job>", the name cut to `MAX_THING`): one need per job overdue, or due within `LEAD_DAYS` and by `to`, on each thing in
use `{ id (job), title ("Car: Oil change"), details: [due text], minutes, due, overdue }`, plus `{ id: "reading:<thingId>", title:
"Car: Check the odometer", … }` when a reading is asked for, each waiting in Momo's Tasks until you place it; then each job recorded
between `from` and `to` (up to today), done on its record's day: `{ id: "done:<recordId>:<jobId>" (a record of other work alone:
"done:<recordId>", titled with its title, as long as its own `minutes`, else 30), title (the thing and the job as it's called now, or was then), details: ["Recorded Oct 1
· by"], minutes (the record's, else its estimate), date, done: true, of: "<jobId>" }`, so ✓ shows on the job's card, or Momo places
one on the record's day. `A.open(id)` (Momo's "Open in Appa") shows that job (or the thing's reading pop-up, or a recorded job's record).

## Invariants
- Due dates, statuses and estimates are worked out, never stored. "Today" is `K.util.todayStr()` (time travel works);
  `Date.now()` is only for `at` / `u` stamps and the timer's real minutes.
- A job counts from its latest record, else `from` (the day and reading given, else the day it was added). A reading
  left out is estimated, never stored as read. Months stop at the month's end, and seasons use `K.seasons.seasonStart`.
- The meter is fixed once a thing has readings or meter jobs, and a reading out of step with the others is questioned.
- A new record's photos and PDFs are kept (`A.files.put`) before the record that names them. Deleting a record or thing
  marks its files deleted (sync removes them everywhere), and nothing else deletes files.
- Merged item by item by `u` (settings too). Deleted things, jobs, records, readings and files stay as markers.
- A record keeps each job's name as it was then, for once the job is deleted.
- Bug reports and console messages hold counts only: never names, notes, readings, costs or file names.
