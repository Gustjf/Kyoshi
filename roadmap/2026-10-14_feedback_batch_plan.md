# Kyoshi — plan for the 2026-10-14 feedback batch (3 feature requests, 1 bug)

Planned 2026-10-14 by the architect model from the owner's 4 reports (Kyoshi 5.281 · Momo 10.485 · Appa 1.365 · Pabu
2.242; line numbers as of commit `b9ff975`). Four phases, each sized for one coding session, grouped by the app or core
file they touch. Nothing is built yet.

**The owner runs a phase by saying:** `Execute phase N of roadmap/2026-10-14_feedback_batch_plan.md`. The decisions are
made (D1–D9 below, the architect's: no question was put to the owner this time; each has one line to change if wrong),
so nothing is left to decide before a phase runs. **Helper agents are back on** for this plan (the owner, 2026-10-14:
"authorize Sonnet and Haiku agents"), replacing the 2026-10-09 rule of none unless necessary: *Helpers* below says
exactly which model does what, phase by phase.

## How to use this file (you, the executing model — the model each phase's title names)
1. Read the root `CLAUDE.md` (automatic), then **only** this file's top sections (down to the first phase) and **your
   phase**; skip the other phases. Then the phase's **Read first** list, and nothing else up front: every file's header
   comment says what it holds, and `apps/<id>/CLAUDE.md` has each app's map and data model. Don't scan the workspace.
   Where the phase names a scout, let it read the long files for you and open them at the lines it gives.
2. **Decisions:** D1–D9 are settled; each phase's text already follows them. Everything else is settled in the phase or
   is yours to judge (small UI details, exact wording in the owner's plain voice). A choice that would change how data is
   kept, or what the owner sees in a way this plan doesn't settle → ask the owner in plain terms (they're a layman) and
   wait; don't guess.
3. Build the phase as one unit. Targeted edits: no rewrites, no renames of what works, no touching apps the phase doesn't
   name, every file under ~400 lines (split along the seam the phase gives). Reuse what's there (helpers named in each
   phase).
4. **Before pushing, every phase:** (a) a changelog entry per touched app (`apps/<id>/changelog.js`) and/or
   `core/changelog.js`, newest first, one new version per app per phase, bumped by the largest tier among its changes
   (+0.001 fix · +0.010 tiny tweak · +0.100 small feature · +1 large feature; the phase title says which), a brief
   sentence per change in the owner's words, and "Reload <App> on every device after updating." where the phase stores
   something new; (b) the touched app's `CLAUDE.md` current (files, state, storage, shared, invariants), the root
   `CLAUDE.md` only where core's map or contract changed; (c) a new build stamp:
   `sed -i "s/?v=[0-9][0-9-]*/?v=$(date -u +%Y%m%d-%H%M)/g" index.html`; (d) tests: the ones the phase names (made-up
   data only: the repo is public), then `node tests/run.js` green (filter while iterating, e.g. `node tests/run.js
   weekends`; the full run once before pushing); (e) by hand from disk: open `index.html`, switch to each touched app,
   console clean at desktop and phone width (≤ 640 px), Developer Mode time travel +1 day and +1 week, Export then Import
   JSON for an app whose data shape changed (an old backup must still import); (f) the phase's helper runs came back
   clean, or what they found was fixed or judged wrong in writing (*Helpers*); (g) commit with a clear message and push
   to `main` (the owner's rule; no branch unless the phase says so). Don't check the live site.
5. **After pushing:** tick the phase under *Status* with a line of what was decided along the way (and which helpers ran
   on which model), and tell the owner which reports it closes (R1–R4, the table below) so they can mark them done.
6. Data rules that always apply: never rename or drop a stored key without carrying its data over; new fields are
   additive and every cleaner keeps accepting older shapes and files without the field; older copies drop fields they
   don't know when they save → the changelog says to reload every device. No personal data anywhere in the repo (tests
   use made-up names and holidays). Bug reports and console lines hold counts, never names, dates or the owner's words.
7. Do the phases in the numbered order unless the owner says otherwise, one per session. They don't depend on one
   another, except that Phase 4 goes after Phase 3 when both are pending (both touch Appa's `schedule.js`). The target
   versions in the titles assume that order; the version you write is always one tier up from the top changelog entry.

## Helpers: which model does what (the owner, 2026-10-14: Sonnet and Haiku are authorized)
Three models, each where it pays. **Opus** (the strongest) builds whatever touches stored data, sync, core or a
scheduling rule (Phases 2 and 4) and makes every judgment call. **Sonnet 5.5** is the workhorse: it builds the two
phases that store nothing (1 and 3) as the executing model, and in the Opus phases it reviews diffs, writes the test
file from the phase's exact list, and benches the Phase 4 algorithm. **Haiku 5.5** is the cheap pair of eyes: it looks,
quotes, counts and compares, and never judges a design, words what the owner sees, or writes a line of code or test.

Spawn a helper with the Agent tool. `model: "haiku"` or `model: "sonnet"`; `subagent_type: "Explore"` (read-only: no
Edit or Write) for every job but **Test writer** and **Bench** (`general-purpose`); several at once in one message when they don't
depend on each other, in the background, while you keep working. A helper sees nothing of your conversation: its brief
is self-contained (the goal, the exact files or the `git diff`, the checklist, the output shape, "open nothing else").
Give it the artifact and a question, never your conclusion to confirm. **Every claim a helper returns is a lead, not a
finding:** open the file at the line it names and judge before changing anything; a lead you reject gets one line in
*Status* saying why. Helpers never commit, push, edit a `CLAUDE.md`, a changelog or `index.html`, and never touch app
code (the test writer only the test files its brief names).

**Context caps** (Kyoshi's lines are long: reckon 30 tokens a line, brief included). Haiku: under 60k tokens, so about
**2,000 lines in all**: at most three files, given as line ranges; a diff split by file, no slice over ~600 lines.
Sonnet: under 120k, so about **4,000 lines**: a diff up to ~1,500 lines plus up to six files it may open to trace
callers, named in the brief. Size a brief first (`git diff --stat`, `wc -l`); one that would need more is two helpers.
Never let a helper grep the whole repo (name the paths); the test runner's output goes in by failed test, never a whole
run.

| Job | Model | When | Brief (the shape; the phase fills in the files and questions) |
|---|---|---|---|
| **Scout** | Haiku | before building, where the phase names one | "Read only these files (line ranges): …. For each function named (…): its line range and signature; quote whole these bodies (…); the exact current text of these strings (…). At most 90 lines. Quote, don't paraphrase. Open nothing else." Re-read a quote in the file before you edit next to it. |
| **Checklist** | Haiku | after building, before the full test run; one run per ~600-line slice of the diff, plus one for the docs | The 14 rules below, each answered PASS, FAIL with file:line, or NOT IN THIS SLICE; no opinions. The docs run gets `index.html`'s stamps, the changelogs' top entries and the `CLAUDE.md` diffs (rules 1–3, 11). |
| **Fresh eyes** | Sonnet | after building, in parallel with the checklist; one per app or core file touched (Opus phases only) | "Here is the diff of …. You may open these files to trace callers: … (≤ 6); nothing else. Read it adversarially against these questions (the phase's **Fresh eyes asks**, plus always: an older backup without the new field? two devices changing the same thing before they sync? an older copy of the app saving over it? test mode and time travel? a 390 px phone?). Return at most 8 leads, each: file:line, the claim, one concrete input → wrong outcome. No style remarks." A second, smaller run on your fixes when the first found something real. |
| **Test writer** | Sonnet (`general-purpose`) | Opus phases, once the app code is done and you've tried it by hand | "Write `tests/<file>.test.js` (and only the helpers named in `tests/<app>.js`) to this exact list: …. Model it on `tests/<neighbour>.test.js` lines …; helpers from `tests/lib.js` (exports at line …) and `tests/generate.js` (…). Made-up data only. Run `node tests/run.js <word>` until it passes or you can say why it can't; never change app code, never weaken a check to pass, never skip a test. Report: what each test checks, and any check that fails because the app seems wrong (file:line)." Then **you** read every line of the new tests (does each check what the list says, with an exact expected value?), fix or reject, and run them. |
| **Bench** | Sonnet (`general-purpose`) | Phase 4 only, before you wire the apps | Runs `core/level.js` under `node` in the scratchpad (never committed) on made-up item sets and reports the numbers the phase asks for. |
| **Closer** | Sonnet | last, one run | "The owner's request, quoted: «…». The diff of the app's files (not tests or docs; ≤ ~1,500 lines, else the changed functions' new bodies) and the new changelog lines. Answer only: (a) anything asked for that the diff doesn't do; (b) anything it does that wasn't asked for; (c) any changelog line that promises what the diff doesn't deliver, or uses a word the owner didn't. Open nothing." |
| **Test triage** | Haiku | only when the full run prints more than a screen of failures | "Here are the failed tests' blocks, nothing else. For each: its name, the failing check's words, the likely file:line in the app or the test, and whether that test file was touched in this diff (list: …). Open at most these test files: …." You fix; a Haiku never edits a test. |

**The checklist's rules** (Haiku answers each): (1) every touched app has a new top changelog entry dated today, exactly
one tier up from the previous top version; (2) `core/changelog.js` bumped iff a file under `core/` changed; (3) every
`?v=` stamp in `index.html` is the same new value; (4) no file over 400 lines; (5) every changed file's header comment
still says what it holds; (6) no `document.getElementById` / `document.querySelector` in `apps/` (only `A.$` /
`A.root.querySelector`); (7) no `Date.now()` used as a calendar day (only `K.util.todayStr()` / `now()`), `Date.now()`
only for `at` / `u` / `savedAt`; (8) no CDN links, no `fetch` of the site's own files, no ES modules, no deprecated APIs;
(9) a new stored field is read by its cleaner with a default for older data, and the changelog says "reload on every
device"; (10) no real names, dates of birth or addresses in tests or fixtures; (11) the touched app's `CLAUDE.md`
mentions each new field, function, id scheme or invariant the diff adds; (12) every new `confirm`/`alert` string is a
full sentence that says what will happen; (13) every stored key or id scheme in the diff is one the plan names; (14) new
CSS is under `.app-<id>` (apps) or in `core/kyoshi.css` (core), with no new colour that isn't a theme token unless the
plan names the hex.

**Per phase, at a glance:**
| Phase | Executing model | Helpers (model × runs) |
|---|---|---|
| 1 — Momo: weekends open | **Sonnet** | Haiku checklist ×1 (diff and docs in one run: it's small). No scout, no fresh eyes, no closer: a one-line change of default. |
| 2 — Momo: holidays | **Opus** | Haiku scout ×2 · Sonnet test writer ×1 · Haiku checklist ×2–3 · Sonnet fresh eyes ×2 (data and PTO; the folds and pop-ups) · Sonnet closer ×1 |
| 3 — Appa: upkeep a month | **Sonnet** | Haiku scout ×1 · Haiku checklist ×1 · Sonnet closer ×1 (in a separate run: the builder doesn't close its own work). Should anything need a stored field, stop and hand the phase to Opus. |
| 4 — core, Pabu, Appa: spread out | **Opus** | Haiku scout ×2 · Sonnet bench ×1 · Sonnet test writer ×1 · Haiku checklist ×3 · Sonnet fresh eyes ×3 (core/level.js; Pabu; Appa) · Sonnet closer ×1 |

Why so: the risk in this batch is in Phases 2 and 4 (a new stored record in Momo that changes PTO; a field that moves
due dates in two apps, through sync). A wrong merge or a PTO that silently drifts is what the owner would never spot, so
Opus builds them and Sonnet, not Haiku, reads them adversarially. Phases 1 and 3 store nothing and change only what's
drawn: a Sonnet session does them at a fraction of the cost, and a mistake shows on screen at once.

## The 4 reports → phases
| # | App | Report (the owner's words) | Phase |
|---|---|---|---|
| R1 | Appa | "Add a minimal feature with the average maintenance burden per month in terms of hours." | 3 |
| R2 | Appa, Pabu | "Add a perturbation feature to level items per week. For example, if I tend to add things at the start of the month because that's when I remember to enter them, in the dev options put a perturbation feature to spread out the dates to distribute it better throughout the average month. For things that happen on a schedule like pabu and appa." | 4 |
| R3 | Momo | "Add a feature where I can import my current holidays and free days off so they are included on the weekend without reducing PTO. If it's not attached to the weekend, then include it in the sequence with a special detonation that it isn't a weekeend - some sort of symbol that is purple..matching the other existing symbol" | 2 |
| R4 | Momo | (bug) "Keep the upcoming weekends section expanded automatically" | 1 |

Why R2 reads as it does: a call, text or visit never talked is due the day it was added (Pabu `dueOf`), and an Appa job
with no record counts from the day it was added, so everything entered on one evening comes due in the same week, and
again in step every month after. Done on time, each stays in step forever. One nudge of each next due date (D7) breaks
the lockstep for good: once you talk or record it, the next due counts from that day.

## Status (tick each phase off here, with what was decided)
- [x] Phase 1 — Momo: Upcoming weekends open at first (Momo +0.010 → 10.495) — done 2026-10-14: both `details.weekends`
  carry `open`; the comments and `apps/momo/CLAUDE.md` (also its markup.js row) say "open at first"; one new test (open under
  the board and under Today, a tap closes one, a redraw leaves it closed: the redraw sets a plan in the page and calls
  `renderAll`, since `mo.openWeekend` reopens the fold first). No existing test needed a change; full run 161 passed.
  Built by Sonnet (as a `general-purpose` agent, Opus reviewing the diff and pushing); a Haiku checklist, whose one FAIL
  (a bare `?v=`) is `index.html`'s comment about the stamps, not a stamp.
- [ ] Phase 2 — Momo: holidays and free days off (Momo +0.100 → 10.595)
- [ ] Phase 3 — Appa: the upkeep a month, in hours (Appa +0.100 → 1.465)
- [ ] Phase 4 — core, Pabu, Appa: Spread out due dates (Kyoshi +0.100 → 5.381 · Pabu +0.100 → 2.342 · Appa +0.100 → 1.565)

## Decisions (the architect's, 2026-10-14; the executing model adds its own small ones under Status)
- **D1 — R4: both Upcoming weekends folds start open.** Under the board and under Today, on every load. Closing one keeps
  it closed until the page reloads (as now, only the default flips); nothing is stored. *(Change: remember a closed fold
  on this device, `K.storage`, if the owner wants it to stay shut.)*
- **D2 — R3: holidays are a record of their own in Momo's data.** `data.holidays: { "YYYY-MM-DD": { name, plan, u } }`:
  `name` ≤ 40 ("Thanksgiving"; "Holiday" when the import gives none), `plan` ≤ `PLAN_MAX` (only a holiday on its own
  uses it: D5), `u` its change stamp. Removing one keeps `{ name: "", plan: "", u }` (as a weekend's Clear), so the
  removal wins over an older copy's when two devices combine. Merged key by key by `u` (`byKey`, as `weekends`), saved
  through `save()` (undo, sync, backups). `DATA_SCHEMA_VERSION` stays 2; older files have none; an older copy of Momo
  drops them → reload Momo on every device. Apart from the weeks: a holiday takes no hours and changes no card.
- **D3 — R3: the import lives with Time off in Developer Mode.** A **Holidays…** button in the Time off block opens a
  pop-up: a box to paste a list (one per line: a date, then an optional name; "2026-11-26 Thanksgiving", "11/26/2026",
  "Nov 26, 2026", "November 26", "Dec 24 – Dec 26 Winter break" for a run of days; a day without a year is its next
  one from today) **or** Choose a file… (`.ics` from a work calendar: its all-day events, `DTSTART;VALUE=DATE` to
  `DTEND` (the end not included) with `SUMMARY`; or `.txt` / `.csv`, read as pasted). It shows what it read before
  anything is kept ("8 holidays: Nov 26 Thanksgiving, …; 1 line not understood: line 4") and **Add** keeps them (a date
  already there takes the new name). Under it, the holidays from today on, each with ✕ (removed after no question:
  ✕ is undone by Momo's Undo). Past ones stay, unshown. Nothing goes over the network.
- **D4 — R3: a holiday next to a weekend joins it and costs no PTO.** A weekend's span grows over the holidays touching
  it: from Friday back and from Monday on, day by day, while the day is a holiday or one of its days off. Days off keep
  meaning what they mean now (counted back from Friday, on from Monday), so nothing the owner already set moves when
  holidays come in; a day that is both a day off and a holiday costs **no PTO** (`offHours` skips holidays), which gives
  back the PTO of a day off entered for what turns out to be a holiday. (Monday a holiday and Tuesday wanted off: 2 days
  after, and the pop-up's PTO line says it takes 1 day.) The weekend pop-up's notes name the holidays in its span
  ("Mon Nov 30 · Holiday: Cyber Monday").
- **D5 — R3: a holiday on its own is a row in the sequence.** A holiday no weekend's span reaches (a Wednesday) is a row
  among the weekend tiles, by date, within the folds' 13 weekends: the purple mark, its day ("Wed Nov 11"), its name,
  and its plan or "No plan"; a tap opens the weekend pop-up in a holiday's form (title "Wed Nov 11 · Veterans Day", the
  plan only: no days off, no PTO line; Clear clears the plan, not the holiday). It doesn't count in "4 of 13 planned";
  the line gains "· 2 holidays ahead" (holidays from today on within the 13 weekends, joined or not). A holiday on a
  Saturday or Sunday only shows in its weekend's tooltip. *(Change: no plan on a lone holiday's row, if it should be a
  marker only.)*
- **D6 — R3: the mark is the same sun, in violet.** Lucide's sun as now (`#i-sun`, 12 px), Momo's palette violet
  `#8b5cf6`, wherever a holiday is: after the date on this week's and next week's day headings, on Today's date and
  Tomorrow's, before the dates on a weekend tile whose span holds a holiday, and on a lone holiday's row; tooltip
  "Holiday: Thanksgiving". A day both off and a holiday shows the violet one only. *(Change: another Lucide icon in one
  constant, e.g. `party-popper`, if the owner wants the shape to differ too.)*
- **D7 — R2: Spread out moves each next due date once; the next talk or record does the rest.** A call, text or visit
  (Pabu) and a job by time or by season (Appa) gains an optional `moved: { from, to }` ("YYYY-MM-DD" both): while its
  due worked out as usual is `from`, it's due `to` instead (to Momo too: its Tasks, its cards, the inbox's `due` and
  `from`). Once you talk, record it, or change how often, the usual due is another day, `moved` no longer applies, and
  the next due counts from what you did, so the spread holds by itself. Nothing else changes; a stale `moved` is
  harmless and dropped the next time the item is saved from its pop-up. Merged as now (Pabu: the whole person by `u`;
  Appa: the job by `u`); an older copy drops it → reload Pabu and Appa on every device. **Never moved:** weekly calls,
  texts and visits (a week has no room), jobs by the meter alone, and anything overdue. *(Change: `MOVE_FRACTION` and
  `MOVE_MAX_DAYS` in `core/level.js`.)*
- **D8 — R2: one leveling rule in core, a tool in each app's Developer Mode.** `core/level.js` (`K.level`, no UI, no
  storage) does the maths for both apps; each app's Developer Mode gets **Spread out due dates…**: a pop-up shows each
  week's minutes for the next 8 weeks before and after (a row of small bars or numbers), the moves it would make
  ("Call Sam: Nov 2 → Nov 8"), and **Apply** (one save, its own question) or Cancel; nothing is kept until Apply.
  While anything is moved, the block also offers **Put them back** (clears every `moved`, asked first). Each app levels
  its own items only. *(Change: count the other app's due items as fixed weight in each week, from `K.inbox`.)*
- **D9 — R1: the upkeep a month is one line, worked out, never stored.** On Appa's home, under the Coming up heading:
  "About 3½ h a month of upkeep" (its tooltip: "From 8 jobs on 4 things; 2 by the meter left out until Appa knows the
  pace"); on a thing's page, under Schedule: "About 40 min a month". Each live job on a thing in use (not archived)
  counts its minutes (`minutesOf`: the timed average, else the guess; none: left out and said in the tooltip) times how
  often it comes in an average month (below). Shown in hours by quarters from 1 h ("1¼ h"), in minutes under it, to the nearest 5
  (`niceMinutes`: "40 min"); none at all while no job counts.
- Assumptions, each one line to change if wrong:
  1. R1: a month is 365.25 / 12 days; every N days/weeks/months/years comes 30.44 / (its days) times a month, months
     and years by calendar (1 month = once, 1 year = 1/12); each season picked comes once a year (2 seasons: 1/6);
     by the meter, the thing's pace (`pace`, per day) × 30.44 / `meterEvery`; time and meter together, the more often
     of the two. *(Phase 3)*
  2. R2: a move is at most a quarter of the item's interval and at most 14 days, earlier or later, never before today
     (`MOVE_FRACTION` .25, `MOVE_MAX_DAYS` 14): a monthly call moves up to 7 days, a quarterly job 14, a 2-weekly text 3.
     *(Phase 4)*
  3. R2: the leveling looks 8 weeks ahead (`LEVEL_WEEKS`), Monday to Sunday as Momo's, weighing each item by its minutes.
     *(Phase 4)*
  4. R3: a holiday is a whole day; half-day holidays aren't asked for. *(Phase 2)*

## Versions when planned
Kyoshi 5.281 · Momo 10.485 · Appa 1.365 · Pabu 2.242. Work each bump out from the app's top changelog entry when you get
there (phases may run out of order).

---

## Phase 1 — Momo: Upcoming weekends open at first (Momo +0.010 → 10.495) · Sonnet
Closes R4 (D1). Momo only. **Executing model: Sonnet 5.5** (the owner picks it for the session); one Haiku checklist.

**Read first:** `apps/momo/markup.js` lines 20–30 and 70–76 (the two `<details class="weekends">`, L25 and L74),
`apps/momo/weekends.js` lines 98–113 (`renderWeekends`: "Each stays open or closed as it is"), `tests/momo.js` lines
282–300 (`weekends()` opens the fold only when it's closed: it keeps working), `tests/momo-weekends.test.js` (grep
`summary` for a check that taps the fold to open it; a tap on an open fold now *closes* it).

- `markup.js`: both `<details class="weekends">` gain `open`. `renderWeekends` only rewrites the summary and the list, so
  the browser's own toggle keeps a fold closed once tapped, until the page reloads. `weekends.js`'s comment above
  `renderWeekends`: "Both start open; each stays open or closed as you leave it until the page reloads."; the file's
  header (L1–2: "a folded line", "closed at first") and the markup comment at L73 ("folded") say the same.
  `apps/momo/CLAUDE.md` Invariants → Weekends: "(closed at first)" → "(open at first)"; Purpose line 15: "a folded line"
  → "a line, open at first,".
- Tests: in `tests/momo-weekends.test.js`, one check on a fresh page (desktop and phone): `details.weekends` is open under
  the board and under Today before anything is tapped; a tap on its summary closes it, and a redraw (a weekend saved)
  leaves it closed. Fix any test that clicked the summary to open it.
- Changelog: "Upcoming weekends start open, under the board and under Today."
- Haiku checklist (one run: the whole diff, the changelog, `index.html`'s stamps, the `CLAUDE.md` diff), rules 1–8 and 11.

---

## Phase 2 — Momo: holidays and free days off (Momo +0.100 → 10.595) · Opus
Closes R3 (D2–D6, assumption 4). Momo only. **Executing model: Opus** (a new stored record that changes PTO).

**Read first:** `apps/momo/CLAUDE.md` (Weekends, Days off, Time off, Sync), `apps/momo/model.js` lines 1–35 (the header:
`weekends`, `timeOff`) and 60–80 (`emptyData`, `hasData`), `apps/momo/weekends.js` (whole, 230 lines), `apps/momo/timeoff.js`
(whole, 105 lines), `apps/momo/data.js` lines 30–40 (stamping), 176–215 (`cleanWeekends`, `cleanTimeOff`,
`normalizeData`), 289–300 (`buildBackup`, exported as `build` at L381), 333–365 (`mergeVersions` with its local
`byKey`, `dataKey`, apply), `apps/momo/markup.js` lines 8–12 (`#i-sun`),
215–255 (`#weekendOverlay`), `apps/momo/momo.css` lines 285–292 (`.off-sun`), `apps/momo/render.js` line 212 and
`apps/momo/today.js` lines 115 and 133 (where `offHTML` is called), `tests/momo-weekends.test.js` lines 1–60 (a model
test), `tests/momo.js` lines 282–330 and its exports (line ~437).
**Scouts (Haiku, two in parallel):** (a) `apps/momo/data.js`: line ranges and signatures of every function, quote whole
`cleanWeekends`, `normalizeData`, `buildBackup`, `mergeVersions` (its local `byKey`), `dataKey`, the stamping lines 30–40, and `importBackup`'s question;
(b) `apps/momo/events.js` `renderDev` and `checkDev` (line ranges, quoted), `timeoff.js` `devHTML` / `wireTimeOff`
(quoted), `tests/momo.js` lines 282–437 (every helper's name and signature, and its exports line).

**New file `apps/momo/holidays.js`** (after `timeoff.js` in `index.html`; header comment), ≤ 400 lines; split
`holidays-import.js` (the parsing and the pop-up) off it if it grows past ~300:
- Model: `holidayOn(date)` → its name or ""; `holidaysFrom(from, to)` → `[{ date, name }]` by date (live ones: `name`
  not ""); `setHoliday(date, name)`, `removeHoliday(date)` (keeps the marker, D2), `setHolidayPlan(date, plan)`, all
  through `save()`.
- Parsing, `readHolidays(text)` → `{ found: [{ date, name }], bad: [line numbers] }`: a line's date first (ISO; M/D/YYYY;
  "Nov 26, 2026"; "November 26"; a run "Dec 24 – Dec 26" or "2026-12-24 to 2026-12-26", at most 14 days), the rest of
  the line its name (trimmed of separators `-–:,|`, cut to 40; "Holiday" when nothing is left); blank lines and lines starting `#` skipped. An `.ics`
  (text with `BEGIN:VCALENDAR`) is read by events instead: `DTSTART` (all-day `VALUE=DATE` or a date-time, its date),
  `DTEND` (exclusive; none: one day), `SUMMARY` (unfolded: a line starting with a space continues the last; none: "Holiday"), at most
  400 events; anything else ignored. A day without a year → its next from `todayStr()` (today counts). Dates outside
  today −1 year … today +3 years are left out and counted as not understood.
- The pop-up `#holidaysOverlay` (markup in `markup.js`, `K.modal`): a textarea, Choose a file… (`<input type="file"
  accept=".ics,.txt,.csv,text/calendar,text/plain">`, read with `K.util.readFile` or `File.text()`), a preview line under
  them updated as you type, **Add** (disabled while nothing was read), and the list from today on (date, name, ✕). Esc /
  × with text typed asks "Discard the holidays you've pasted?" (`K.modal`'s `pending`).
- `timeoff.js` `devHTML`: a **Holidays…** button and a hint "Your work's days off: they join a weekend and cost no PTO."
  in the Time off block (shown whether or not PTO is set up); `K.dev.toggle()` first, as Pabu's Set up… does.

**Changes elsewhere in Momo:**
- `model.js` header (`holidays`), `emptyData` (`holidays: {}`), `hasData` (a live holiday counts). `data.js`:
  `cleanHolidays` (keys ISO dates; `name` text ≤ 40; `plan` ≤ `PLAN_MAX`; a marker kept only with `u > 0`), in
  `normalizeData`, the stamping (as `weekends`, line ~37), `build`, `combine` (`byKey`), `dataKey`, and the apply line.
- `weekends.js`: `firstOff` / `lastOff` grow over holidays (D4: walk from Friday back / Monday on while `holidayOn(d)` or
  `d` is one of this weekend's days off; stop at a weekday that's neither; at most 14 days each way). `offHTML(date)`:
  a holiday → the violet sun (`class="off-sun holiday"`, tooltip `Holiday: <name>`), else as now. `tileHTML`: the violet
  sun before the dates when the span holds a holiday (the gold one when it holds a day off only; both → violet),
  tooltip naming the holidays. `renderWeekends`: the lone holidays' rows (D5) merged in by date
  (`<button class="weekend holiday" data-holiday="YYYY-MM-DD">`), and "· N holidays ahead" before the time off's words.
  The pop-up: `openWeekend` takes a holiday's date too (`S.weekend` gains `holiday: date | null`): title "Wed Nov 11 ·
  Veterans Day", the days-off fields and `#weekendPto` hidden, Save → `setHolidayPlan`, Clear clears the plan. The
  before/after notes name holidays in the span. `offAhead` counts days off that aren't holidays.
- `timeoff.js`: `offHours` leaves out holidays (`!A.holidayOn(d)`), so `ptoLeft`, `ptoToday` and the pop-up's PTO line
  follow by themselves.
- `momo.css`: `.app-momo .off-sun.holiday { color: #8b5cf6; }`, `.app-momo .weekend.holiday` (the tile's look, its
  violet mark); the pop-up's list rows.
- `events.js` `bugState`: "Holidays: N ahead (M joined to a weekend)" (counts only). `CLAUDE.md`: files (`holidays.js`),
  state (`S.weekend.holiday`), storage (`holidays`, the reload note), Invariants (D2–D6 in a "Holidays" paragraph beside
  Days off; Time off: "a holiday costs no PTO").

**Tests** (a new `tests/momo-holidays.test.js`; Sonnet test writer from this list, `tests/momo-weekends.test.js` as the
model; made-up holidays only): paste three lines (a Friday "2026-11-27 Day after", a Wednesday "Nov 11 Lone day", a run
"Dec 24 – Dec 26 Winter break") plus one bad line → the preview says 5 holidays and line 4 not understood; Add → the
Nov 27 weekend's tile reads from Fri with the violet sun, its tooltip names it; the Nov 11 row sits between the Nov 7
and Nov 14 tiles with "No plan", its pop-up saves a plan; the line says "· 5 holidays ahead"; the board's Friday heading
(time travel to that week) and Today on the day show the violet sun with "Holiday: …"; PTO set to 40 h, a weekend with 1
day before on a holiday Friday → PTO still 5 days, the pop-up's line says it takes 0; then 2 days before → 4 days left;
✕ removes Nov 11 and Undo brings it back; an `.ics` file (two all-day events, one two days long, a folded SUMMARY) via
the file input; Export then Import keeps them; an older backup (none) imports; two devices: one removes a holiday, the
other renames it earlier, the removal wins after they sync (`tests/cloud.js` or the folder, as `momo-weekends.test.js`
does); `bugState` holds counts only.

**Fresh eyes asks (Sonnet, two runs):** (1) `data.js` + `holidays.js` model and parsing: a removed holiday and an older
copy's live one, which wins? a holiday on a date that's also a weekend's day off, then the holiday removed: does the PTO
come back off? Feb 29 without a year, "Dec 31 – Jan 2", a DTSTART with a time zone, a 400+ event `.ics`, a CSV with
quotes; (2) `weekends.js` + `timeoff.js`: can `firstOff`/`lastOff` loop or run into the weekend before/after (two
weekends both claiming a holiday Monday-to-Friday week)? does `offOn` still never call a Saturday off? `offHours` with a
pop-up's typed days off over a holiday; the folds' `drawn` cache when only a holiday changed.
**Closer (Sonnet):** R3 quoted verbatim; it should check "included on the weekend", "without reducing PTO", "in the
sequence", "purple", "matching the other existing symbol".
- Changelog (owner's words): "Holidays: paste your work's holidays or pick its calendar file (Developer Mode → Time
  off → Holidays…); one next to a weekend joins it and costs no PTO, one on its own shows among Upcoming weekends with a
  purple sun." · "A day off that falls on a holiday gives its PTO back." · "Reload Momo on every device after updating."

---

## Phase 3 — Appa: the upkeep a month, in hours (Appa +0.100 → 1.465) · Sonnet
Closes R1 (D9, assumption 1). Appa only. **Executing model: Sonnet 5.5.** Nothing is stored; if anything seems to need a
stored field, stop and say so (the phase goes to Opus).

**Read first:** `apps/appa/CLAUDE.md`, `apps/appa/schedule.js` lines 1–120 (`pace` L36–46, `after` L58, `nextSeason`
L60–66, `baseOf` L75–81, `dueOf` L87–106, `minutesOf` L117–120) and its exports at the end, `apps/appa/model.js` lines 1–16
(the job's shape: `every { n, unit }`, `seasons`, `meterEvery`) and 58–72 (`cleanJobs`), `apps/appa/render.js` lines 43–55
(`renderHome`) and 96–115 (`renderThing`), `apps/appa/markup.js` lines 10–22 and 56–60 (the Coming up, Things and Schedule
headings), `apps/appa/app.js` (`niceMinutes`, `fmtMinutes`), `tests/appa.test.js` (whole, 76 lines), `tests/generate.js`
`appaWorld` (L327) and `appa` (L121).
**Scout (Haiku):** `apps/appa/app.js` (constants and helpers: names, line ranges, `fmtMinutes`'s body quoted) and
`tests/generate.js` lines 121–200 and 327–365 (what `appa()` and `appaWorld()` make: things, jobs with their `every` /
`seasons` / `meterEvery` / `est`).

- `schedule.js`: `perMonth(job)` → times in an average month (assumption 1) or null (a meter job without a pace; a job on
  a thing without a meter but with only `meterEvery`); `upkeep(thingId = "")` → `{ minutes, jobs, left: { noTime,
  noPace } }` over live jobs of active things (one thing's when given). Memoized like the rest (`remember`).
- `render.js`: `upkeepHTML(u)` → "About 3½ h a month of upkeep" (hours by quarters from 60 minutes: "1¼ h", "3½ h";
  under 60, `niceMinutes`' 5-minute steps: "40 min"), with its tooltip (D9); drawn in `renderHome` into a new `<div class="upkeep" id="upkeepLine">`
  under the Coming up heading (hidden while no job counts), and in `renderThing` under Schedule ("About 40 min a month").
- `appa.css`: `.app-appa .upkeep` (muted, small, like the other hints).
- `events.js` `bugState`: the Jobs line gains "; upkeep about N min a month (K left out)". `CLAUDE.md`: schedule.js'
  line (`perMonth`, `upkeep`), Invariants ("The upkeep a month is worked out, never stored: …").
- Tests (extend `tests/appa.test.js` or a new `tests/appa-upkeep.test.js`): a world with an oil change every 6 months at
  60 min, a filter every 2 weeks at 15 min, one seasonal job at 30 min (2 seasons), a meter job (every 5,000 mi, pace
  12,000 a year, 45 min) and one with no minutes → the home line's exact text and tooltip, worked by hand in the test's
  comment: 60 ÷ 6 + 15 × 30.44 ÷ 14 + 30 × 2 ÷ 12 + 45 × (12,000 ÷ 365.25 × 30.44 ÷ 5,000) = 10 + 32.6 + 5 + 9 =
  56.6 → "About 55 min a month of upkeep" (under an hour, to the nearest 5 minutes); tooltip "From 4 jobs on 3 things; 1
  without minutes left out"); archiving the thing
  drops its jobs; a timed record replaces the guess; the thing's page line; phone width.
- Changelog: "Appa shows the upkeep a month, in hours, on its home (and each thing's on its page): what its jobs take in an
  average month."
- Haiku checklist (one run, rules 1–8, 11); Sonnet closer in its own run with R1 quoted.

---

## Phase 4 — core, Pabu, Appa: Spread out due dates (Kyoshi +0.100 → 5.381 · Pabu +0.100 → 2.342 · Appa +0.100 → 1.565) · Opus
Closes R2 (D7, D8, assumptions 2–3). **Executing model: Opus** (a stored field in two apps that changes due dates, and
what Momo receives). Do Phase 3 first if both are pending (both touch Appa's `schedule.js`).

**Read first:** `apps/pabu/CLAUDE.md` (State, Storage, Shared, Invariants), `apps/pabu/app.js` lines 140–180 (`lastTalk`
L148, `nextDue` L150, `addedDay` L153, `dueOf` L155–158, `allDue` L162–165, `thisWeek` L171–174), `apps/pabu/data.js`
lines 41–59 (`cleanCadences`) and 64–82 (`cleanPeople`), `apps/pabu/editor.js` (grep the Save that writes a cadence back),
`apps/pabu/events.js` lines 100–123 (`renderDev`, `bugState`), `apps/pabu/share.js` (whole, 82 lines: `inbox`'s `due` /
`from`); `apps/appa/CLAUDE.md`, `apps/appa/schedule.js` lines 55–120 (`after`, `nextSeason`, `baseOf`, `dueOf`,
`statusOf`, `minutesOf`), `apps/appa/model.js` lines 1–16, 58–72 (`cleanJobs`), `apps/appa/job-editor.js` (grep its
save), `apps/appa/events.js` lines 89–118 (`renderDev`, `bugState`); `core/agenda.js` lines 1–20 (a small core file's
shape, for `core/level.js`), `index.html` (where `core/routine.js` loads; `level.js` goes after `util.js`),
`tests/pabu-momo.test.js` lines 1–40 and `tests/appa.test.js` (models).
**Scouts (Haiku, two in parallel):** (a) `apps/pabu/editor.js` + `apps/pabu/share.js`: where a cadence is rebuilt on
Save (quote it), `inbox`'s lines setting `due`/`from`/`overdue`; (b) `apps/appa/job-editor.js` + `apps/appa/share.js`:
the save that builds the job (quote it), `inbox`'s lines setting `due`/`overdue`.

**`core/level.js`** (`K.level`, header comment; root `CLAUDE.md` map line): `K.level.plan(items, { today, weeks =
LEVEL_WEEKS })` → `[{ id, from, to }]`. `items`: `[{ id, due, minutes, intervalDays }]`. Rules: only items due from
today to the end of the last week (Monday-to-Sunday weeks from this one); none overdue; a window of ±min(`MOVE_MAX_DAYS`,
⌊intervalDays × `MOVE_FRACTION`⌋) around `due`, cut at today; a window under 2 days → not moved. Greedy: the items with
the narrowest window first (ties: the larger minutes, then the id), each to the week with the fewest minutes so far that
its window reaches (ties: the week nearer its due, then the later), its day in that week the one nearest its due inside
the window. Items not moved still weigh in their own week. Deterministic (same items → same plan on every device). Also
`K.level.weeks(items, moves, opts)` → `{ before: [minutes per week], after: […], mondays }` for the pop-ups.
Constants `LEVEL_WEEKS` 8, `MOVE_FRACTION` .25, `MOVE_MAX_DAYS` 14, exported for the tests.
**Bench (Sonnet, before wiring the apps):** "Load `core/util.js` and `core/level.js` in node with a stub `window`
(scratchpad script, not committed). Make 30 made-up items: 12 monthly calls (30 min) all due within 3 days of the 1st, 6
quarterly visits (120 min), 8 two-weekly texts (10 min), 4 jobs every 3 months (60 min). Report the minutes per week
before and after, the largest week ÷ the average week before and after, the biggest move in days, and whether two runs
give the same plan. Then the same with every item due on one day, and with an empty list." Expect a clear drop in the
largest week; if not, revisit the greedy order before wiring anything.

**Pabu:** a cadence's `moved` (`cleanCadences`: `{ from, to }` both ISO dates, `to` within `MOVE_MAX_DAYS` of `from`,
else null). `dueOf`: the usual due (`last ? nextDue(…) : addedDay(…)`), then `moved && moved.from === usual ? moved.to :
usual`. The pop-up's Save keeps `moved` on a cadence whose every and talks it didn't change, else drops it. Developer
Mode: **Spread out due dates…** under Set up…, its pop-up `#spreadOverlay` (markup in `markup.js`; logic in a new
`apps/pabu/spread.js`), items = each cadence not weekly (`intervalDays`: 14, 30, 91, 365), weight = its minutes; Apply →
each moved cadence's person stamped and saved once ("Move 7 due dates to even out your weeks?"); **Put them back**
(only while one applies). This week's list, the inbox and `attention` follow `dueOf` by themselves. bugState: "Moved
due dates: N".
**Appa:** a job's `moved` (`cleanJobs`, the same rule). `dueOf`: `timeDate` is the usual one; when `moved.from ===
timeDate`, `timeDate = moved.to`; then the sooner of time and meter as now. Jobs by the meter alone never move; a job
with both moves only while time is the sooner. The job pop-up's Save drops `moved` when how often or last done changed.
Developer Mode: **Spread out due dates…** beside the photos' block (a new `apps/appa/spread.js`; the pop-up in
`markup.js`), items = live jobs on active things with a time or season due (`intervalDays`: from `every`, a season job
91), weight = `minutesOf` (30 when unknown). The memo (`remember`) resets on `S.version` as now. bugState: "Moved due
dates: N".
- Both apps: a moved item's line says so where its due shows (Pabu: "due Nov 10 (spread out)"; Appa's `dueText` the
  same), so the owner can tell it from a real due day. `CLAUDE.md` for each: the field, the pop-up, the invariant (D7).
- Changelogs: Kyoshi "Spread out due dates: the maths that evens out your weeks for the apps that keep schedules (Pabu,
  Appa)."; Pabu and Appa "Developer Mode → Spread out due dates…: moves the next due date of calls, texts and visits
  (jobs) by a few days so the coming weeks are even; once done, the next counts from that day as always. Put them back
  undoes it." · "Reload <App> on every device after updating."

**Tests** (Sonnet test writer, from this list; `tests/pabu-momo.test.js` and `tests/appa.test.js` as models): a new
`tests/spread.test.js`: Pabu with 10 made-up people, 8 monthly calls (30 min) last talked Sep 1, so due Oct 1, and 2 weekly
texts (the tests' TODAY is 2026-09-30, `tests/lib.js` L12) → the pop-up shows 8 weeks, before has 240 min in the week of
Sep 28; Apply → 120 min in each of that week and the next (the only two their windows reach: Sep 30 to Oct 8), no move over 7 days, no weekly text moved,
nothing before today; Momo's Tasks show the moved dues; a ✓ on a moved call → its next due is a month after the ✓ and
`moved` no longer applies; Put them back → the original dues; Export then Import keeps `moved`; an older backup imports
with none. Appa: 6 jobs every 3 months added the same day, one meter-only job → after Apply the meter job is untouched,
the others spread within 14 days; recording one ends its move; editing how often drops it. `K.level.plan` called in the
page with an overdue item (never moved), an empty list, and twice the same input (same plan).
**Fresh eyes asks (Sonnet, three runs):** (1) `core/level.js`: a window cut by today to under 2 days; an item due on the
last day of the 8th week; the tie-breaks really deterministic (no `Math.random`, no object-key order of numbers)?
(2) Pabu: a ✓ taken back (talk removed) after a move: is `moved` live again, and is that right? two devices, one
spreads, the other talks with the same person before they sync; the pop-up's Save on a person with one moved cadence and
one changed; (3) Appa: a season job's `nextSeason` ⇄ `moved.from`; a record dated before `moved.from` added later; a job
with time and meter where the meter becomes the sooner after a reading.
**Closer (Sonnet):** R2 quoted; check "level items per week", "spread out the dates", "in the dev options", "pabu and
appa".
