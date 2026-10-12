# Kyoshi — plan: retinoid build-up reminders in Bosco (tazarotene, tretinoin), 2026-10-11

Planned 2026-10-11 by the architect model from the owner's ask (Bosco 7.601 · Kyoshi 5.281; line numbers as of commit
`ed4e6d1`). Two phases, each sized for one coding session. Nothing is built yet.

**The owner's ask, quoted:** «add retinoid tracking to Bosco. I want to acclimatize myself to Tazarotene .1% cream and
Tretinoin .05% cream. Copy the "Upcoming Tirzepatide Doses" and name it "Upcoming X Doses" (if it's just Taz, only put
Taz, if it's just Tret only put Tret, if it's both put "Retinoid" in the title). Include in the set-up menu the retinoid
itself (generic name only) and the prescription strengths available. I want this to be minimally intrusive and not
clutter up Bosco too much. The main functionality would be a dose reminder and standard dosage time similar to
Tirzepatide. I usually use Taz on my face and Tret on my body now. I use them on different cadences usually, but not
always. I want a simple acclimatization program for Taz .1% that makes sense and is clear what it is doing and how it is
progressing, with parameters for me to change in the set-up window.»

**The owner runs a phase by saying:** `Execute phase N of roadmap/2026-10-11_bosco_retinoids_plan.md`. The decisions are
made (D1–D12 below, the architect's; each has one line to change if wrong), so nothing is left to decide before a phase
runs. Phase 1 is the feature; Phase 2 adds the one-tap controls (Hold a week, Undo), a few days later.

## How to use this file (you, the executing model — Claude Opus, high reasoning effort)
1. Read the root `CLAUDE.md` (automatic), then **only** this file's top sections (down to the first phase) and **your
   phase**; skip the other phase. Then the phase's **Read first** list, and nothing else up front: every file's header
   says what it holds, and `apps/bosco/CLAUDE.md` has Bosco's map and data model. Don't scan the workspace.
2. **Decisions:** D1–D12 are settled; the phases follow them. Everything else is settled in the phase text or is yours to
   judge (small UI details, exact wording in the owner's plain voice). A choice that would change how data is kept, or
   what the owner sees in a way this plan doesn't settle → ask the owner in plain terms (they're a layman) and wait;
   don't guess.
3. Build the phase as one unit. Targeted edits: no rewrites, no renames of what works, nothing outside Bosco (and the
   files this plan names), every file under ~400 lines (the two new files split along the seam this plan gives). Reuse
   what's there: the dose code is the model for everything here, so copy its shapes (`doseSchedule` → `walk`,
   `promptDueDose` → `promptDueApplication`, the vial editor → the retinoid editor).
4. **Before pushing, every phase:** (a) a changelog entry in `apps/bosco/changelog.js`, newest first, one new version
   (the phase title says which), a brief sentence per change in the owner's words, and "Reload Bosco on every device
   after updating." where the phase says so; `core/changelog.js` only if a file under `core/` changed (none is planned);
   (b) `apps/bosco/CLAUDE.md` current (files, state, storage, shared, invariants) and the root `CLAUDE.md`'s map line
   for `apps/bosco/`; (c) a new build stamp: `sed -i "s/?v=[0-9][0-9-]*/?v=$(date -u +%Y%m%d-%H%M)/g" index.html`;
   (d) tests: the ones the phase names, made-up data only (the repo is public), then `node tests/run.js` green (filter by
   name while iterating: `node tests/run.js retinoid`; the full run once before pushing); (e) by hand from disk: open
   `index.html`, Bosco, console clean at desktop and phone width (≤ 640 px), Developer Mode time travel +1 day and +1
   week, Export then Import JSON (an old backup must still import); (f) the checklist under *Checks* below, by hand (no
   helper agents unless something is too hard otherwise: the owner's rule of 2026-10-09); (g) commit with a clear message
   and push to `main` (the owner's rule: the new key is additive and nothing migrates). Don't check the live site.
5. **After pushing:** tick the phase under *Status* with a line of what was decided along the way.
6. Data rules that always apply: never rename or drop a stored key without carrying its data over; new fields are
   additive and every cleaner keeps accepting older shapes and files without the field; older copies of Bosco drop fields
   they don't know when they save → the Phase 1 changelog says to reload every device. No personal data anywhere in the
   repo. Bug reports hold counts, never names, dates or strengths.

## Status (tick each phase off here, with what was decided)
- [ ] Phase 1 — Bosco: retinoids set up, their build-up schedule, the Upcoming section, the pop-up, storage, backups and
  sync (Bosco +1 → 8.601)
- [ ] Phase 2 — Bosco: Hold this step a week; Undo; Developer Mode's lines (Bosco +0.100 → 8.701)

## Decisions (the architect's, 2026-10-11; the executing model adds its own small ones under Status)
- **D1 — Where it lives: one section, nothing else on the page changes.** A section "Upcoming <X> Doses" right under
  "Upcoming Tirzepatide Doses", hidden while no retinoid is set up. No History column, no chart or progress-image change,
  no new start-up question. The title's X: the one retinoid in use ("Upcoming Tazarotene Doses"); more than one distinct
  retinoid → "Upcoming Retinoid Doses". Independent of the GLP-1 medication (works with "None" too: not inside `.med`).
- **D2 — Each retinoid you use is one "retinoid" in Bosco (a regimen in the code):** the retinoid (generic name), its
  strength, where it goes (a short word: face, body), its usual time, its start date, and its schedule. Up to 4.
  Taz on the face and Tret on the body are two; the same retinoid on two areas would be two as well.
- **D3 — Generic names and the cream strengths, as a pick list.** Tretinoin, tazarotene, adapalene, trifarotene (no
  brand names anywhere). The owner uses creams only (2026-10-12), so the list is each cream's prescription strengths and
  nothing says "cream" on the page: tretinoin 0.025% · 0.05% · 0.1%; tazarotene 0.05% · 0.1%; adapalene 0.1%;
  trifarotene 0.005% (trim or add in `RETINOIDS`, `app.js`). Stored as a number (`pct`), never the label. Should a gel
  or lotion ever come, a `form` field is additive.
- **D4 — The schedule is a ladder of steps, each "every N days for W weeks", the last "from then on".** One step is a
  steady schedule (Tret on the body: "every other day", or "every day"). The **build-up** (the acclimatization program)
  is several. Steps run by calendar weeks from the start date, so what's coming is plain: the editor lists each step with
  its dates, and the section says where you are ("Step 1 of 3 · every 3 days · week 1 of 2 · every other day from
  Wednesday, Oct 14"; days read as the anchor line does, `fmtWeekday` then `fmtDateBrief`). The interval that applies
  after an application is that of the step its day falls in (so the first
  application of a new step comes one old interval after the last of the old one; nothing stored).
- **D5 — The default build-up, for any new retinoid:** every 3 days for 2 weeks (about twice a week), then every other
  day for 2 weeks, then every day from then on. That's how a strong retinoid like tazarotene 0.1% is usually started:
  twice a week, every other night once the skin takes it, then nightly, each step about two weeks, stepping up only when
  the skin is fine. Every number is the owner's to change in the editor; a step can be added or removed, and Phase 2
  adds "Hold this step a week" (a week more on the step you're on, one tap).
- **D6 — The reminder works exactly like a dose's.** An application comes due on its day at the usual time (the start of
  the day without one), on this device's clock; its card turns amber with an "Applied ✓" button; a pop-up asks "Did you
  apply your Tazarotene?" with Applied · Applied it today (for a late one) · Not yet (an hour, this device) · Postpone to
  tomorrow (the schedule moves a day: that is how a night is skipped); the switcher dot while one waits; a late one is
  logged on its day or today and the schedule counts on from there; one not confirmed within three intervals counts as
  missed, as doses do. One pop-up at a time: a due dose's first, then one retinoid's; the next comes once that closes.
- **D7 — Usual time starts at 9:00 PM for a new retinoid** (they go on at night); blank means any time (due from the
  start of its day). Each retinoid has its own.
- **D8 — The log is kept, not shown.** Each application is a record `{ id: "<retinoid id>:<date>", r, date, u }` in
  `retinoids.log`; the section's heading says "last applied Tue, Oct 7"; bug reports count them. Nothing is deleted:
  an undo (Phase 2) or a removed retinoid is a marker (`x: true` with a newer `u`), so it stays undone on every device.
- **D9 — Storage, backups and sync:** one new store key `retinoids` = `{ regimens, log }`, the same key at the top of
  Bosco's backup; both lists merge record by record by the later change (`K.util.mergeById`); a file or save without the
  key (an older copy) leaves yours and isn't saved back for (as `asked` is handled); Import brings the backup's in over
  what's here (the backup wins where both have a record: its records are stamped now) and keeps what the backup doesn't
  know. `DATA_SCHEMA_VERSION` stays 4 (nothing migrates). `hasData` counts a retinoid too.
- **D10 — Nothing goes to Momo** (the owner, 2026-10-12): no event on the board, no need in the inbox, in either
  phase. `A.agenda` stays the doses' alone. The reminder is Bosco's own: the amber card, the pop-up and the switcher dot.
  `apps/bosco/CLAUDE.md` says so under *Shared with other apps*, so no later change adds them.
- **D11 — Not in this plan:** a History table of applications; irritation notes; short-contact mode (wash-off); fixed
  weeknights ("Mon & Thu": the ladder runs by days between applications, and the cards show the weekdays); pausing a
  retinoid (remove it, or postpone); notifications (Kyoshi has none). Any of these is a later phase if asked.
- **D12 — Versions:** Phase 1 Bosco 7.601 → 8.601 (+1: a new tracker with its own stored data); Phase 2 → 8.701.
  Core isn't touched.

## The shape of the data (both phases)
`A.S.retinoids = { regimens: [...], log: [...] }`, store key `retinoids`, backup key `retinoids` (the same object).
- A regimen: `{ id, retinoid, pct, where, time, start, steps, next, at, u, x? }` — `id`: `K.util.newId()`;
  `retinoid`: a key of `RETINOIDS` ("tazarotene"; an unknown plain id from a newer version is kept and shown as it is);
  `pct`: a number (0.1: the cream's strength, any positive number up to 5 from a file); `where`: text up to 24 characters, may be
  ""; `time`: "HH:MM" or null; `start`: "YYYY-MM-DD" (the first application's day; any day, past days included);
  `steps`: 1–6 of `{ every: 1–14 whole, weeks: 1–52 whole | null }`, only the last may be null and it always is (the
  cleaner forces it); `next`: `{ after: "" | date, date }` or null (postponed: the next application's day, counted from
  the last one applied when it was set, as `dosePlan.nextDose`); `at`: `Date.now()` when added (the list's order);
  `u`: `Date.now()` at its last change; `x: true`: removed (kept as a marker).
- A log record: `{ id: "<regimen id>:<date>", r, date, u, x? }` — one per retinoid per day; `x: true`: undone.
- Cleaning (`cleanRetinoids(raw)`, `retinoids.js`): `undefined` unless `raw` is an object (an older file: keeps ours);
  else each list filtered to valid records (the log's `id` rebuilt from `r` and `date`, never trusted), duplicates by
  `id` resolved by `K.util.newer`, regimens sorted by `at` then `id`, the log by `date` then `r`. Missing `u` or `at`
  read as 0.
- Merging (`mergeRetinoids(a, b)`): one side `undefined` → the other; else `{ regimens: mergeById(a.regimens,
  b.regimens), log: mergeById(a.log, b.log) }`, sorted as above. The same result on every device.
- Derived, never stored: `A.regimens()` (the live ones: no `x`, by `at`); `lastApplied(r)` (the latest log date on or
  before today without `x`, "" if none); `stepAt(r, date)` → `{ i, every, weeks, from, to }` (step `i`'s window from
  `start`: the weeks before it × 7 days; the last open-ended; a day before `start` is in step 0); `walk(r)` (the
  schedule, below).

**The schedule (`walk`, the copy of `doseSchedule`):** `from` = `next.date` while `next` is valid (`lastApplied <=
next.after`), else `lastApplied + stepAt(r, lastApplied).every`, else `start` (nothing applied yet: the first
application is on the start day). Then dates one after another, each the previous + `stepAt(r, previous).every`. Keep at
most `MAX_UPCOMING_APPLICATIONS` (3) dates on or before today (older ones are missed, dropped from the front, exactly
Tirzepatide's three-intervals rule) and fill up to 3 in all. Each date
→ `{ r, date, due: now() >= dueAt(date, r.time), after: lastApplied, step: stepAt(r, date) }`. Cap the loop at 2,000
days from `from` (a start years back with nothing logged).

---

## Phase 1 — Bosco: retinoids set up, their build-up schedule, the Upcoming section, the pop-up, storage, backups and sync (Bosco +1 → 8.601)
Bosco only. Two new files, small additions to six.

**Read first:** `apps/bosco/CLAUDE.md`; `app.js` lines 25–30 (`MEDICATIONS`), 61–100 (the constants), 103–120 (the
state), 131–190 (the helpers); `doses.js` whole (208 lines: the model for `retinoids.js`); `setup.js` lines 14–47
(`renderOneTimeInfo`), 113–127 (`renderVial`: the summary line), 188–216 (`openVialEditor`, `storeVial`, `saveVial`),
251–290 (`saveOneTimeInfo`); `render.js` lines 10–31 (`renderAll`), 70–96 (`renderUpcomingDoses`); `events.js` lines
70–146 (`A.init`), 149–152 (`onTick`), 170 (`attention`), 204–223 (`bugState`); `markup.js` lines 5–9 and 86–108 (the
start-up section's blocks and buttons), 125–131 (the doses section), 232–256 (the dose pop-up); `data.js` lines 17
(`persist`), 58–85 (`normalizeBackup`'s return), 176–231 (`load`), 233–253 (`buildBackup`), 255–283 (`applyBackup`),
285–318 (`importBackup`), 320–350 (`mergeVersions`' return), 352–381 (`dataKey`, `combine`), 390–397 (`A.data`);
`bosco.css` lines 14–17 and 82–98; `core/util.js` lines 66–88 (`newer`, `mergeById`); `tests/bosco-doses.test.js` lines
1–60 (the helpers) and the first test; `tests/lib.js` (whole); `tests/generate.js` lines 309–322 (`bosco()`).

### 1.1 Constants, state and helpers (`app.js`, ~35 lines)
- `RETINOIDS` next to `MEDICATIONS`: `{ tretinoin: { label: "Tretinoin", strengths: [0.025, 0.05, 0.1] }, tazarotene:
  { label: "Tazarotene", strengths: [0.05, 0.1] }, adapalene: { …, strengths: [0.1] }, trifarotene: { …, strengths:
  [0.005] } }` (D3: the creams' strengths, lowest first). A comment: generic names and cream strengths only; ids are
  stored, never change one.
- On `A`: `MAX_REGIMENS: 4`, `MAX_RETINOID_STEPS: 6`, `MAX_UPCOMING_APPLICATIONS: 3`, `DEFAULT_RETINOID_TIME: "21:00"`,
  `DEFAULT_STEPS: [{ every: 3, weeks: 2 }, { every: 2, weeks: 2 }, { every: 1, weeks: null }]` (D5), `RETINOIDS`.
- State: `retinoids: { regimens: [], log: [] }`, `retinoidEditing: null` (null, or `{ id }` with `id` "" for a new one,
  plus `steps`: the rows as edited), `applyAsking: null` (the scheduled application the pop-up is open for).
- Helpers: `retinoidLabel(id)` (the label, or the id with its first letter up); `strengthLabel(r)` → "0.1%"
  (`fmtNum(pct, 3)`); `regimenName(r)` → "Tazarotene 0.1%"; `regimenTitle(r)` → that plus " · face" when `where`
  is set (escaped with `K.util.esc` wherever it's put in HTML); `fmtEvery(n)` → "every day" / "every other day" / "every
  3 days"; `retinoidsTitle(list)` → the one distinct retinoid's label, else "Retinoid".

### 1.2 The model: `apps/bosco/retinoids.js` (new, ~200 lines; `index.html` after `doses.js`)
Header: the retinoids' data (cleaning, merging), their schedule (worked out, never stored) and the dose-like pop-up's
rules; no drawing. `cleanRetinoids`, `mergeRetinoids`, `regimens`, `lastApplied`, `stepAt`, `walk`, `allUpcoming()`
(every live regimen's `walk(r)`: `[{ r, list }]`), `progressLine(r)` (the words for the heading: before the start
"Starts Saturday, Oct 25 · step 1 of 3: every 3 days"; a timed step "Step 1 of 3 · every 3 days · week 1 of 2 · every
other day from Wednesday, Oct 14"; the last step of several "Step 3 of 3 · every day from Nov 8 on"; one step "Every
other day"),
`stepsNote(start, steps)` (the editor's live note: "Step 1: every 3 days, Oct 11 – Oct 24 · Step 2: every other day,
Oct 25 – Nov 7 · then every day from Nov 8"; with one step: "Every other day from Oct 11"), and the pop-up's state
rules copied from `doses.js`: `sameApplication(a, b)` (same `r`, `date`, `after`), `stillAsked()`, `confirmApplication
(today)` (a log record for its day or today, `u: Date.now()`, replacing one with that id: a marker undone by applying
again; `A.save()`; `S.currentPage` untouched), `postponeApplication()` (`r.next = { after: lastApplied(r), date:
tomorrow }`, `r.u = Date.now()`), `snoozeApplication()` (store key `retinoidSnooze`: `{ id: "<r>:<date>", until }`, this
device only, `DOSE_SNOOZE_MS`), `promptDueApplication(dueList)` (as `promptDueDose`, plus: opens nothing while any
pop-up is open: `K.modal.top()` or `K.bugs.isOpen()`), `openApplicationModal`, `closeApplicationModal`. `dueAt` comes
from `doses.js`: add it to that file's `Object.assign(A, …)`. The schedule's loop uses `addDays`, `daysBetween`,
`todayStr`, `now` from `K.util`; a regimen whose `start` is after today lists from its start.

### 1.3 The page: the section, the pop-up, the start-up block (`markup.js`, ~75 lines; `retinoids-ui.js`, new, ~300 lines; `bosco.css`, ~10 lines)
Both new files go in `index.html` after `doses.js` and before `image.js`: `retinoids.js`, then `retinoids-ui.js` (so
`events.js`, last, can call them).
- **Markup** — after `#upcomingDosesSection` (not `.med`):
  `<section id="upcomingRetinoidsSection" hidden><h2 id="upcomingRetinoidsTitle"></h2><div id="upcomingRetinoidsBody"></div></section>`.
  After `#paceBox`, a block `<div class="retinoids" id="retinoidBox" hidden>`: `<div class="subhead">Retinoids</div>`, a
  list `#retinoidList` (a `.summary-line` per live regimen: `regimenTitle` in bold, then muted the schedule in words
  (`stepsNote` shortened: "every 3 days for 2 weeks, every other day for 2 weeks, then every day · from Oct 11") and two
  buttons `data-edit-regimen` / `data-remove-regimen`, secondary small), a line `#retinoidAddLine` ("No retinoid yet."
  muted while none, else nothing; the button `#addRetinoidBtn` "Add retinoid", hidden at `MAX_REGIMENS`), and the editor
  `<div class="vial-card" id="retinoidEditor" hidden>`: the retinoid as a `.mode-toggle.many` of four buttons
  (`#retinoidKind`, `data-value`), a `.dose-fields` row: Strength (`<select id="retinoidStrength">`, the retinoid's
  list as "0.1%", value the number; a stored strength not on the list is added as an option so an edit keeps it), Where
  (`<input type="text" id="retinoidWhere" maxlength="24"
  placeholder="e.g. face">`), Usual time (`<input type="time" id="retinoidTime">`); a second row: Start date (`<input
  type="date" id="retinoidStart">`) with the note "The first application is on this day; a past day is fine if you're
  already on it."; then `<div class="subhead sites-head">Schedule</div>`, the steps `#retinoidSteps` (a `.step-row` per
  step: "every [N] days for [W] weeks ✕"; the last row "then every [N] days from then on"), a button `#addStepBtn` "Add a
  step" (hidden at `MAX_RETINOID_STEPS`), the live note `#retinoidStepsNote` (`stepsNote`), the note "Step up only
  when your skin is fine: give a step more weeks, or take a step out for a steady schedule.", and `.actions` with
  `#saveRetinoidBtn` "Save retinoid" and `#cancelRetinoidBtn` "Cancel" (secondary). After `#doseOverlay`, the pop-up
  `#retinoidOverlay`: `<h3 id="retinoidModalTitle">`, `<p class="modal-hint" id="retinoidModalText">`, a `.stat` with
  `.val #retinoidModalWhat` (the name and where) and `.lbl #retinoidModalStep` (the step's words), `.modal-actions`:
  `#retinoidLogBtn`, `#retinoidTodayBtn` (hidden), `#retinoidSnoozeBtn` "Not yet" (secondary), `#retinoidPostponeBtn`
  "Postpone to tomorrow" (secondary).
- **`retinoids-ui.js`** (header: the Upcoming section, the pop-up's text and buttons, the start-up block's list and
  editor; wired by `initRetinoids`, called from `A.init`):
  - `renderUpcomingRetinoids()`: hidden without a live regimen; the title "Upcoming " + `retinoidsTitle` + " Doses";
    per regimen a `.retinoid-group`: a `.summary-line.retinoid-head` (left: `regimenTitle` in bold, then muted
    " · last applied Tue, Oct 7" when there is one; right, muted: `progressLine`), then a `.stat-grid` of its `walk`:
    each card `.stat` (`.due` when due) with `.val` the weekday, `.lbl` the date and "· 9:00 PM" when timed,
    `.dose` the step's words ("Step 1 of 3 · every 3 days"; one step: `fmtEvery` with a capital), and on a due card
    `<button class="small" data-apply="<r>:<date>">Applied ✓</button>`. Then `promptDueApplication(every due one,
    earliest first by date then `at`)`. Called from `renderAll` right after `renderUpcomingDoses` (one line) and from
    `onTick` (one line).
  - The pop-up: title "Did you apply your <Retinoid>?"; text "<Name> on your <where> was due <Weekday>, <date> at
    <time>. It goes in your log once you confirm it." (without `where`: "<Name> was due…"); the stat's `.val`
    `regimenTitle`, its `.lbl` the step's words; the main button "Applied", or for a late one "Applied it <weekday>"
    (within the week) / "Applied it <date>", with `#retinoidTodayBtn` "Applied it today" shown then; `K.modal.define`
    with `dismiss: A.snoozeApplication`; `K.refreshSwitcher()` on open and close (the dot).
  - The start-up block: `renderRetinoidsSetup()` draws the list, the add line and the editor from `S.retinoidEditing`;
    shown whenever the start-up section is (`$("retinoidBox").hidden = $("oneTimeInfoSection").hidden`, set at the end
    of `renderOneTimeInfo`: one line in `setup.js`; `S.retinoidEditing = null` there too, as the vial's editor closes).
    `openRegimenEditor(id)`: a new one prefilled Tazarotene, its first strength (the owner picks), `where` "",
    `DEFAULT_RETINOID_TIME`, today, `DEFAULT_STEPS`; an existing one as kept. The retinoid buttons refill the strength
    list (keeping the pick when the new list has it); a step's ✕ removes its row (never the last); Add a step inserts
    a row before the last, copying the row above it; every input (`input` event on the editor) redraws the note.
    `enteredRegimen()` → the regimen or false after an alert: a strength picked; `where` trimmed (≤ 24: the field's
    `maxlength`, checked again); the time blank or complete (`validity.badInput` → "Please finish entering the usual
    time, or leave it blank."); a start date ("Please enter the start date."); each step's days a whole number 1–14
    and each timed step's weeks a whole number 1–52 ("Each step needs whole numbers: 1 to 14 days between applications,
    1 to 52 weeks."). `saveRegimen()`: new → `{ id: newId(), …, next: null, at: Date.now(), u: Date.now() }`
    appended; edited → the same `id`, `at` and `next`, `u` now; `A.save()`, the editor closed, the block and the
    section redrawn. `removeRegimen(id)`: `confirm("Remove <regimenTitle>? Its past applications stay in your data.")`
    → `x: true`, `u` now, `A.save()`, redraw. `saveOneTimeInfo` (`setup.js`, two lines at its top): an open retinoid
    editor is saved first (`if (S.retinoidEditing && !A.saveRegimen()) return;`), as the open vial calculator is
    (`saveRegimen` returns true once it's in, false after saying why).
  - `initRetinoids()`: the wiring (the section's `data-apply` buttons → `openApplicationModal` for that `walk` entry;
    the pop-up's four buttons; the block's add / edit / remove / add-step / ✕ / Save / Cancel; the retinoid toggle;
    the editor's `input`). One line in `events.js`'s `A.init`, before `renderOneTimeInfo()`.
- **CSS** (`bosco.css`): widen lines 14–17's selectors to cover `#upcomingRetinoidsSection .stat` (the same width,
  no-wrap and `.due` look); `.app-bosco .retinoids { margin-top: 12px; padding-top: 10px; border-top: 1px dashed
  var(--border); }`; `.retinoid-group + .retinoid-group { margin-top: 14px; }`; `.retinoid-head { font-size: .9em; }`;
  `.step-row { display: grid; grid-template-columns: auto 64px auto 64px auto 1fr; gap: 6px; align-items: center;
  margin-top: 6px; }` with `.step-row input { width: 100%; }` (on a phone the row still fits 390 px: check it).

### 1.4 Hooks and data (`events.js` ~8 lines, `data.js` ~10 lines)
- `attention`: `S.doseAsking ? … : S.applyAsking ? "a retinoid is waiting to be confirmed" : ""`.
- `bugState`: `- Retinoids: 2 (steps 3, 1); applications logged: 14; due now: 1` (counts only).
- `data.js`: `persist` adds `"retinoids"`; `load` sets `S.retinoids = A.cleanRetinoids(A.store.json("retinoids")) ||
  { regimens: [], log: [] }`; `normalizeBackup` returns `retinoids: A.cleanRetinoids(raw.retinoids)` (undefined when
  the file has none); `buildBackup` adds `retinoids: S.retinoids` (after `asked`); `applyBackup`: `if (clean.retinoids)
  S.retinoids = A.mergeRetinoids(S.retinoids, clean.retinoids)`; `importBackup`, before `applyBackup`: the backup's
  records stamped `u: Math.max(u, Date.now())` (D9: the backup wins where both have a record); `mergeVersions` returns
  `retinoids: A.mergeRetinoids(older.retinoids, newer.retinoids)`; `dataKey` adds `d.retinoids` (its lists already
  sorted, so the key is stable); `combine`: `ours` gets `retinoids: S.retinoids`, the `replace` branch gets
  `retinoids: A.mergeRetinoids(ours.retinoids, their.retinoids)` beside `asked` (so `same` sees the merged result and a
  regimen only this device has is saved back), `same` compares against
  `their.retinoids ? their : { ...their, retinoids: next.retinoids }` (as `asked`: an older copy's save isn't set apart,
  nor saved back for, by them alone — fold it into the existing expression), `kept` adds `retinoids: next.retinoids ||
  S.retinoids`; `hasData` adds `|| S.retinoids.regimens.length > 0`. `data.js` ends near 406 lines: fine (the rule is
  approximate; don't refactor to make room).
- Changelog (8.601, in the owner's words, five lines): the retinoids in start-up info (generic name, the cream's
  strength from its prescription list, where it goes, the usual time, the start date, the build-up as steps you set: every N
  days for W weeks, then from then on; the default twice a week, every other day, then every day, two weeks each);
  "Upcoming Tazarotene Doses" (or Tretinoin, or Retinoid for both) under the Tirzepatide doses, each next application
  with its step and where you are in the build-up; the pop-up when one is due, Applied / Not yet / Postpone to tomorrow,
  logged once confirmed, the dot while one waits; backups and sync carry them; "Reload Bosco on every device after
  updating."

### Docs & tests
- `apps/bosco/CLAUDE.md`: the two files in the table; State (`retinoids`, `retinoidEditing`, `applyAsking`); Storage
  (the `retinoids` key and backup key, D9's merge and import rules, `retinoidSnooze` this device's); Shared with other
  apps (the retinoids never go to Momo: the owner's choice, D10); Invariants (the
  schedule derived, never stored; steps by calendar weeks from the start, the interval of the step the last application
  falls in; the title rule; one pop-up at a time, the dose's first; a removed retinoid and an undone application are
  markers). Root `CLAUDE.md`: the map's `bosco/` line adds "and retinoid build-up reminders".
- `tests/generate.js`: `bosco()` takes `retinoids` (passed through as the backup's key when given); export nothing new.
- `tests/bosco-retinoids.test.js` (new; helpers at its top as `bosco-doses.test.js` has them: `groups(tab)` → each
  group's head text, progress text and its cards' `[weekday, date line, step line, due]`; `popup(tab)` → open, title,
  text, buttons shown; `editor(tab)`; `saveStartup`):
  1. **Set up, due, logged, two retinoids, the title, Export** (DESKTOP, clock at `TODAY` 07:00): a fresh profile's
     start-up info shows the block ("No retinoid yet."); Add retinoid → the editor prefilled (Tazarotene, 21:00,
     today, the three default rows, the note's dates: Sep 30 – Oct 13, Oct 14 – Oct 27, from Oct 28); pick "0.1%",
     type "face"; Save retinoid → the list line; the section "Upcoming Tazarotene Doses", one group: head
     "Tazarotene 0.1% · face", progress "Step 1 of 3 · every 3 days · week 1 of 2 · every other day from
     Wednesday, Oct 14", cards Wednesday Sep 30 · 9:00 PM, Saturday Oct 3, Tuesday Oct 6, each "Step 1 of 3 · every 3
     days", none due; `fastForward` to 21:01 → the first due, the pop-up ("Did you apply your Tazarotene?", "…on your
     face was due Wednesday, Sep 30 at 9:00 PM…"); Applied → closed, head says "last applied Wednesday, Sep 30"
     (brief dates as the cards: use `fmtDateBrief`), cards Oct 3, 6, 9; bug line "- Retinoids: 1 (steps 3);
     applications logged: 1; due now: 0". Then Add retinoid again (the section is still open: the name isn't
     answered yet): Tretinoin "0.05%", "body",
     two ✕ → one row "then every [2] days from then on" (note "Every other day from Sep 30"), Save → the title
     "Upcoming Retinoid Doses", two groups, Tretinoin's cards Sep 30, Oct 2, Oct 4 "Every other day". Remove
     Tazarotene (the confirm's words checked with `lastDialog`) → "Upcoming Tretinoin Doses". Export: `retinoids.regimens`
     two (Tazarotene with `x: true`), `log` one (`id` "<id>:2026-09-30`), `schemaVersion` 4.
  2. **The build-up over time; late, today, Not yet, Postpone, missed** (import `gen.bosco({ retinoids })` with a
     Tazarotene regimen started `D(-12)` (Sep 18), every 3 days × 2 weeks → every 2 × 2 → every day, log on D(-12),
     D(-9), D(-6), D(-3)): step 1 runs Sep 18 – Oct 1, so today's card is "Step 1 of 3" and the progress line
     "week 2 of 2 · every other day from Friday, Oct 2"; the next cards Oct 3 "Step 2 of 3 · every other day" (one
     old interval after today, D4), then Oct 5; `Kyoshi.dev.travel(1)` → Not yet closes
     the pop-up, `fastForward(61 min)` reopens it; "Applied it Wednesday" logs it on D(0) (the head), cards Oct 3, 5,
     7; travel to the first day of step 3 and log along the way at the pop-up (its text names the step); then 10 days
     without logging → three due cards, the earlier ones gone (missed), "Applied it today" logs today and the cards go
     on from tomorrow; Postpone to tomorrow moves the next card a day and `next` shows in Export; the progress line in
     the last step reads "Step 3 of 3 · every day from …".
  3. **Phone, older and damaged backups, Import, sync's combine** (PHONE): the editor open with the default rows →
     `document.documentElement.scrollWidth <= 390` and the section's text has the group; `gen.bosco()` (no key) imported
     over a set-up retinoid keeps it; a damaged file (a step with `every: 0`, weeks "two", a last step with weeks, an
     unknown retinoid "newstuff" with `pct` 0.2, a log record with a bad date, a regimen without `at`) → the bad step
     dropped, the last step's weeks null, "Newstuff 0.2%" shown as it is, the bad record gone; Import of a backup
     holding the same regimen with other steps replaces them (stamped now) and keeps a second regimen the backup
     lacks; `A.data.combine` as the doses test does it: another device's save with this regimen removed (`x: true`,
     a later `u`) while this one logged today → the regimen gone from the section, the record kept in Export; an older
     copy's save (no `retinoids` key) → `same` true, nothing changes; a newer save with a new regimen → it shows.

**Checks (by hand, before the full run):** every touched file's header still true; no `document.querySelector` in
Bosco; `Date.now()` only for `u` / `at`; the two new files under 400 lines; no new colours beyond the theme tokens; the
`where` text escaped everywhere it's rendered (the section, the list, the pop-up); the section hidden with no regimen
and with `medication: "none"` set; an old backup (`gen.bosco()`) imports unchanged; time travel +1 week in test mode
shows the next cards and saves nothing; two retinoids due at once open one pop-up, the next after it closes.

---

## Phase 2 — Bosco: Hold this step a week; Undo; Developer Mode's lines (Bosco +0.100 → 8.701)
Bosco only; nothing for Momo (D10). Run a few days after Phase 1.

**Read first:** `apps/bosco/CLAUDE.md` (as Phase 1 left it); `retinoids.js` (`walk`, `confirmApplication`,
`lastApplied`, `snoozeApplication`); `retinoids-ui.js` (`renderUpcomingRetinoids`'s heading, `initRetinoids`);
`events.js` `renderDev` (lines 181–202 as of `ed4e6d1`); `tests/bosco-retinoids.test.js` (Phase 1's helpers and
fixtures).

### 2.1 Hold this step a week; Undo (one tap each, on the section)
- The heading's right side gains, during a timed step (not the last), `<button class="secondary small"
  data-hold="<id>">Hold this step a week</button>`: `steps[i].weeks += 1` (up to 52), `u` now, `A.save()`, redraw; the
  progress line then shows the later date. A note isn't needed: the line says what changed.
- "Undo" after "last applied today" (only while the latest application is today): `<button class="secondary small"
  data-undo="<id>">Undo</button>` → that record `x: true`, `u` now, the snooze set for it (so the pop-up doesn't come
  straight back; the card's Applied ✓ is there), `A.save()`, redraw. On another device the marker wins (a later `u`).
- Changelog: "Hold this step a week keeps you on the build-up step you're on for one more week; Undo takes back an
  application confirmed today by mistake."

### 2.2 Developer Mode
- `renderDev`: under the next dose's block, a `.dev-block` listing each live regimen: "Next <Retinoid> (<where>):
  <weekday, date> · step 1 of 3" (read-only; from `walk`). Nothing to tap.

### Docs & tests
- `apps/bosco/CLAUDE.md`: Invariants (Hold adds a week to the current step; Undo is a marker). Root `CLAUDE.md`: nothing.
- `tests/bosco-retinoids.test.js`: a fourth test, on test 2's fixture — Hold this step a week moves "every other day
  from" seven days on and Export shows `weeks: 3`; Hold again, then the button gone once the last step is reached (time
  travel); Undo on an application confirmed today: the head loses "last applied", the card is due again without the
  pop-up (snoozed), Export shows the record with `x: true`; the other device's combine keeps the undo over its own copy
  of the record (an older `u`); `Kyoshi.agenda(D(-12), D(14))` has no id starting `retinoid:` (D10).

**Checks (by hand):** Hold hidden on the last step and on a steady schedule; Undo hidden unless the latest application
is today; the dev block holds no dates in bug reports (bugState stays counts); Momo's board and Today show nothing of
the retinoids.
