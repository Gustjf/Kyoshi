# Kyoshi — plan for the 2026-10-06 feedback batch (5 bugs, 9 feature requests)

Planned 2026-10-06 by the architect model from `kyoshi-bug-reports-2026-10-06.md` (the owner's 14 reports, Kyoshi 4.960 ·
Momo 10.374 · Bosco 7.400 · Hawky 2.220 · Wan Shi Tong 2.372). Seven phases, each sized for one coding session; the bugs
first (Phases 1–2), then the feature requests, grouped by the app or core file they touch. Nothing is built yet.

**The owner runs a phase by saying:** `Execute phase N of roadmap/2026-10-06_feedback_batch_plan.md` (with answers where the
phase says *Decide first*: "…, D1 as proposed, D3 all categories").

## How to use this file (you, the executing model — Claude Opus)
1. Read the root `CLAUDE.md` (automatic), then **only** this file's top sections (down to the first phase) and **your phase**;
   skip the other phases. Then the phase's **Read first** list, and nothing else up front: every file's header comment says
   what it holds, and `apps/<id>/CLAUDE.md` has each app's map and data model. Don't scan the workspace.
2. **Decide-first items:** a phase that lists any under *Decide first* needs the owner's answer before you code. Look for it in
   the owner's request and under *Decisions* below; if it isn't there, ask the owner in plain terms (they're a layman), in plan
   mode, and wait. Everything else is settled here or is yours to judge (small UI details). A choice that would change how
   data is kept or what the owner sees in a way this plan doesn't settle → ask, don't guess.
3. Build the phase as one unit. Keep every change targeted: no rewrites, no renames of what works, no touching apps the phase
   doesn't name, files stay under ~400 lines (split a file along a clear seam if a phase would push it over; the phases say
   where). Reuse what's there (helpers named in each phase).
4. **Before pushing, every phase:** (a) a changelog line per change in each touched app's `changelog.js` and/or
   `core/changelog.js`, newest first, one new version per app per phase, bumped by the largest tier among its changes
   (+0.001 fix · +0.010 tiny tweak · +0.100 small feature · +1 large feature; the version each phase expects is in its
   title); (b) update the touched app's `CLAUDE.md` (files, state, storage, shared, invariants) and the root `CLAUDE.md` only
   where core's contract or map changed; (c) a new build stamp:
   `sed -i "s/?v=[0-9][0-9-]*/?v=$(date -u +%Y%m%d-%H%M)/g" index.html`; (d) tests: add or refresh the ones the phase names
   (made-up data only: the repo is public; `tests/lib.js`, `tests/generate.js`, the app's `tests/<app>.js` screen helpers),
   then `node tests/run.js` must be green (filter by name while iterating, e.g. `node tests/run.js hawky`; the full run once
   before pushing); (e) check by hand from disk: open `index.html`, switch to each touched app, console clean, phone width
   (≤ 640 px), Developer Mode time travel +1 day and +1 week; Export then Import JSON for an app whose data shape changed (an
   old backup must still import); (f) commit with a clear message and push to `main` (the owner's rule; no branch unless the
   phase says so). Don't check the live site.
5. **After pushing:** tick the phase under *Status* with a line of what was decided along the way, and tell the owner which
   reports it closes (numbers from the table below) so they can mark them done.
6. Data rules that always apply: never rename or drop a stored key without carrying its data over; new fields are additive
   and every cleaner keeps accepting older shapes; older copies of an app drop fields they don't know when they save → when a
   phase adds a stored field, its changelog says "reload on every device after updating". No personal data anywhere in the
   repo (tests use made-up names). Bug reports and console lines hold counts, never the owner's words, weights or hours.
7. Phases are independent except **6 after 5** (the daily backup's all-in-one file then carries the bug log too, and both
   touch the same core files). Do them in the numbered order unless the owner says otherwise.

## The 14 reports → phases
| # | App | Report (short) | Phase |
|---|---|---|---|
| B1 | core | "Downloaded 7 apps, decrypted." stays in Developer Mode's Cloud block: clear it when Developer Mode closes, or after a while | 1 |
| B2 | Hawky | Stores' shopping lists must get colours that differ, the most different first, none alike side by side; dark theme first | 2 |
| B3 | Hawky | Typing a new store in the add row clears the topic kept from the last add | 2 |
| B4 | Hawky | Quick add's default day is This week, not No day | 2 |
| B5 | Momo | Hawky's cards in Tasks say when they're due, minimally, only while unplaced | 2 |
| F1 | Bosco | Thigh sites gain front/side; the rotation alternates legs, faces and heights (top, bottom, middle) in an X; a skip, in Bosco's Developer Mode tools | 3 |
| F2 | Bosco | A goal counts as reached when the 7-day rolling average passes it, not a single weigh-in | 3 |
| F4 | Bosco | A confirmation before deleting data | 3 |
| F3 | Wan Shi Tong | Year and Director as fields of their own (optional), shown "Director, Year" in the same style as the info line | 4 |
| F6 | core | Bugs & requests kept in the cloud and loaded with the rest of the data | 5 |
| F7 | core | A report's row opens it in the same pop-up, full length, to edit and save | 5 |
| F5 | core | A daily backup folder in the cloud, dated, today's + 7 days kept, each app and an all-in-one; encrypted files importable as they are | 6 |
| F8 | Momo | A lightweight PTO and sick-time tracker in Upcoming weekends: days by halves (8h / 4h), remainder in hours; days off come off PTO; set and adjusted in Developer Mode | 7 |
| F9 | core | Developer Mode's changelog shows the latest 3 entries | 1 |

Report F2's console line (`Appa couldn't start. TypeError: A.wireThingEditor is not a function`, Kyoshi 3.860) isn't a
current bug: `apps/appa/thing-editor.js` exports `wireThingEditor`; the owner's browser had kept an older `thing-editor.js`
while `events.js` was new, before the build stamp changed. Nothing to do; if it ever comes back, a hard reload fixes it.

## Status (tick each phase off here, with what was decided)
- [ ] Phase 1 — core: Developer Mode's two small things (Kyoshi 4.970)
- [ ] Phase 2 — Hawky & Momo: the four list fixes (Hawky 2.230, Momo 10.384)
- [ ] Phase 3 — Bosco: injection sites in an X with a skip, goals by the 7-day average, deletes that ask (Bosco 7.500)
- [ ] Phase 4 — Wan Shi Tong: a director (author, developer) and a year of their own (Wan Shi Tong 2.472)
- [ ] Phase 5 — core: Bugs & requests edited in place, and kept in the cloud (Kyoshi 5.070)
- [ ] Phase 6 — core: a daily backup folder in the cloud; encrypted files imported as they are (Kyoshi 5.170)
- [ ] Phase 7 — Momo: PTO and sick time, lightly (Momo 10.484)

## Decide first (the owner, before the phase runs; recommendations in bold)
- **D1 — Phase 3, the rotation.** The thighs become twelve sites: left/right × front/side × upper/middle/lower (front: the side
  facing the ceiling when sitting; side: between buttock and thigh). Proposed order, alternating legs every dose, heights
  always different from the dose before (top, bottom, middle on each leg), faces alternating on each leg:
  1 L front upper · 2 R side middle · 3 L side lower · 4 R front upper · 5 L front middle · 6 R side lower · 7 L side upper ·
  8 R front middle · 9 L front lower · 10 R side upper · 11 L side middle · 12 R front lower.
  The other regions stay where they are: Abdomen L → R first, the twelve thigh sites, then Upper arm L → R, Buttock L → R
  (sites off are skipped, as now). With the default sites on (abdomen and thighs) a round is 14 doses. **Confirm, or write
  the order you want** (any order of the 18 names is fine).
- **D3 — Phase 4, which categories.** The request names movies ("Movie Director, Year"). **Recommended: every category gets
  both fields, the first labelled for it** (Book: Author · Movie: Director · TV/Anime: Creator · Game: Developer · Other: By),
  the Year for all; the free "info" line stays for the rest (edition, where to watch, platform). Or: movies and TV/Anime only.
- **D4 — Phase 5, how the bug log reaches the cloud.** **Recommended: the log becomes a hidden app** (`id: "bugs"`, named
  "Bugs & requests", never in the switcher, no page), so the existing sync engine carries it like any app: the cloud
  (`data/bugs.json`), the sync folder (`bugs/`), Export all / Import all. Entries are combined by id across devices, and Clear
  leaves markers so a cleared report can't come back from another device. The alternative, a separate little sync path just
  for the log, would copy the engine's work. Approve, or say otherwise.
- **D5 — Phase 6, the backup folder.** **Recommended:** `backups/<YYYY-MM-DD>/<app>.json` (the same encrypted files as
  `data/`, that day's) plus `backups/<YYYY-MM-DD>/kyoshi.json` (an encrypted Export all file that Import all takes), made once
  a day as **one commit** by the first device whose check gets through that day, pointing at the files already in the
  repository (nothing uploaded again but the all-in-one). Folders older than 7 days before today leave in the same commit
  (the repository's history, trimmed to 8 days by Phase 3 of the cloud plan, keeps them a week longer). Kyoshi still has no
  call that deletes a file: a folder leaves because the new commit's tree no longer holds it. Approve, or say otherwise.
- **D6 — Phase 7, what the PTO number means.** You type the hours as of today (Developer Mode). **Recommended: Momo then
  subtracts every day off entered on a weekend from today on**, planned already or later, half a day = 4h (so type the
  balance your employer shows *before* approved future days are taken off). If your employer's number already has approved
  future days taken off, say so: Momo will then subtract only days off entered after you set the balance.

## Decisions (the owner's answers go here, newest first; the executing model adds its own small ones under Status)
- (none yet)
- Assumptions the architect made, each one line to change if wrong:
  1. B1: a good message in the Cloud block fades after 20 s; a refusal stays until Developer Mode closes or the next action. *(Phase 1)*
  2. F9: the changelog shows the latest 3 entries and one muted line saying how many older ones the file holds; no Show all. *(Phase 1)*
  3. B2: a store's colour is set by the order stores were **first used** (its oldest list), not by its name, so a store keeps its colour when new ones come; twelve colours before any two share one. *(Phase 2)*
  4. B3: the topic clears only when it's the one the **last add** used (so fixing a typo in the store while typing a fresh topic clears nothing). *(Phase 2)*
  5. B4: after each add, quick add goes back to **This week** (the new default), 15 min and no note. *(Phase 2)*
  6. B5: the due word shows on every app's "card of its own" task that has a due day (Hawky's errands, Appa's jobs), never on a placed card nor on a timed block's task. *(Phase 2)*
  7. F2: ETAs and the season projections also start from the latest 7-day average (not the last weigh-in); the chart's dots stay the real weigh-ins. *(Phase 3)*
  8. F1: a skip is one-time: the next dose passes over that site, and the skip is forgotten once a dose is logged; the rotation then follows the logged site as now. *(Phase 3)*
  9. F4: Delete (a weigh-in) and Remove (a goal) ask every time; replacing a weigh-in already asks. *(Phase 3)*
  10. F7: editing a report changes its words and its kind (Bug ↔ Feature request); the versions, state and console lines it captured stay as they were. No per-report delete (Clear stays the only way: the owner's 2026-10-05 decision). *(Phase 5)*
  11. F6: the hidden app's id is `bugs`; a report filed during time travel (test mode) is still kept, and goes to the cloud at the next start. *(Phase 5)*
  12. F5: "today" is the device's local date; the all-in-one holds this device's saves right after a check that got through (equal to the cloud's then). *(Phase 6)*
  13. F8: balances are kept in hours and shown in 8-hour days by halves; sick time never changes by itself. *(Phase 7)*

## Versions when planned
Kyoshi 4.960 · Hawky 2.220 · Momo 10.374 · Bosco 7.400 · Wan Shi Tong 2.372. Work each bump out from the app's top
changelog entry when you get there (phases may run out of order).

---

## Phase 1 — core: Developer Mode's two small things (Kyoshi +0.010 → 4.970)
Closes B1 and F9: one bug and one tiny request, both in the Developer panel, each a few lines.

**Read first:** `core/cloud-ui.js` (`said`, `say`, `act`, `render`), `core/dev.js` (`toggle`, `refresh`), `index.html` lines
86–103 (the Cloud block: `#kDevCloudSaid`) and 144–147 (`#kDevChangelog`), `core/kyoshi.css` lines 193–202 (`.dev-hint`,
`.changelog-entry`), `tests/cloud.test.js` (the test that takes a decrypted copy: grep `Download decrypted copy` /
`kDevCloudExport`), `tests/shell.test.js` (one test as a model).

### 1.1 The Cloud block's last word goes away (B1)
- `core/cloud-ui.js`: `SAID_MS = 20000`. `say(text, bad)` clears a `saidTimer` and, for a message that isn't bad, arms one that
  empties `said` and calls `render()` after `SAID_MS` (progress messages during an action go through `say` too: each resets
  the timer, so the final message is the one that fades). In `render()`, when Developer Mode is off (`!K.dev.isOn()`) empty
  `said` and clear the timer: `K.dev.toggle()` already calls `refresh()` → `K.cloudUI.render()`, so closing the panel clears
  the line at once; a refusal (`saidBad`) stays until then, or until the next action replaces it.
- Changelog: "Developer Mode's Cloud block no longer keeps its last word (“Downloaded 7 apps, decrypted.”) for good: it fades
  after 20 seconds, and goes when Developer Mode closes."

### 1.2 The changelog shows the latest three entries (F9)
- `core/dev.js` `refresh()`: `LOG_ENTRIES = 3`; `#kDevChangelog` draws `log.slice(0, LOG_ENTRIES)` as now, then, when the log
  is longer, one `<div class="dev-hint">… and N older entries, in apps/<id>/changelog.js</div>` (or `core/changelog.js` for
  Kyoshi's). The pills stay.
- Changelog: "Developer Mode's changelog shows the latest three entries, and says how many older ones the file holds."

### Tests
- `tests/cloud.test.js`, in the decrypted-copy test: after the block says "Downloaded …", close Developer Mode
  (`devPanel(tab, false)`) and open it again → `#kDevCloudSaid` is hidden and empty; take the copy again, then
  `await p.clock.runFor(SAID_MS + 1000)` (the tests install a fake clock) → the line is gone while the panel stays open.
- `tests/shell.test.js`, a small new test or a few lines in an existing one: with Developer Mode open on Momo,
  `#kDevChangelog .changelog-entry` count is 3 and the hint names the older count (Momo's log has far more than three).

---

## Phase 2 — Hawky & Momo: the four list fixes (Hawky +0.010 → 2.230, Momo +0.010 → 10.384)
Closes B2, B3, B4 (Hawky) and B5 (Momo, about Hawky's cards). Two apps, each a handful of lines.

**Read first:** `apps/hawky/CLAUDE.md`, `apps/hawky/app.js` (state `add`, `listNote`; helpers), `events.js` (`add`,
`pickDay`, `chipDay`), `render.js` (`renderAdd`), `lists-view.js` (`STORE_COLORS`, `storeColor`, `cardHTML`, `renderLists`,
the add row's `add` and `wireLists`' `input` handler), `hawky.css` lines 65–80 (`--store`), `tests/hawky.js` (helpers:
`addErrand`, `chips`, `addItem`, `stores`), `tests/hawky-errands.test.js` (lines 1–40 and the shopping test), `tests/sim/acts.js`
lines 20–30 (its quick add clicks a chip explicitly: nothing to change); `apps/momo/tasks.js` (`taskHTML`, `late`),
`apps/momo/momo.css` (`.card.parked.task`, `.task-hours`), `apps/hawky/share.js` and `apps/appa/share.js` lines 17–24 (the
needs' `due`), `tests/momo-week.test.js` lines 1–45 (how Hawky's errands reach Momo in tests).

### 2.1 Stores' colours that differ (B2)
- `lists-view.js`: `STORE_COLORS` becomes twelve, in an order where neighbours differ as much as they can (cool · warm · cool …),
  each readable as a dot and a 3 px edge on the dark theme first, then the light: blue `#3b82f6`, orange `#f97316`, green
  `#22c55e`, pink `#ec4899`, gold `#d4a017`, violet `#8b5cf6`, teal `#14b8a6`, red `#ef4444`, sky `#38bdf8`, lime `#a3e635`,
  magenta `#c026d3`, brown `#a16207`. Look at them on both themes with six made-up stores and adjust a hex if two read alike.
- The colour is no longer a hash of the name (two stores could share one, and alike shades could land side by side). New
  `storeColors()`: every live list, done ones too (`A.liveLists()` + `A.doneLists()`, or whatever lists.js offers), grouped
  by `vendor.toLowerCase()`, the groups ordered by the earliest `at` among each store's lists (then by name), the i-th store
  → `STORE_COLORS[i % 12]`. Worked out once per `renderLists` and handed to `cardHTML(l, today, colors)` and the vendor
  groups, so the Done fold's cards and the active groups agree. Stores are drawn A–Z as now; with twelve colours by first
  use, neighbours differ until you have more than twelve stores.
- `CLAUDE.md` (Invariants: the store colour rule). Changelog: "Each store's colour is one of twelve, given in the order stores
  were first used (so a store keeps its colour as new ones come), the most different shades first; no two stores share one
  until you have more than twelve."

### 2.2 A new store clears the topic (B3)
- `app.js` state: `listLast: { vendor: "", topic: "" }` (this device only: the store and topic of the last add in the row).
  `lists-view.js add()`: after a successful add, `S.listLast = { vendor: r.list.vendor, topic: r.list.topic }`. The
  `input` handler in `wireLists` (the one that already calls `renderTopics()` for `listVendor`): when the typed store, cleaned
  and lower-cased, differs from `listLast.vendor` lower-cased, and the topic box still holds `listLast.topic` → empty the
  topic box first, then `renderTopics()`. Typing the same store back restores nothing.
- `CLAUDE.md` (State: `listLast`). Changelog: "In the shopping add row, typing a different store after an add clears the
  topic kept from that add, so a new store starts with a fresh topic."

### 2.3 This week is the default day (B4)
- `app.js`: `add: { day: "week", … }`; `events.js add()`: back to `{ day: "week", minutes: DEFAULT_MINUTES, note: false }`;
  the comments in both, and `CLAUDE.md` (State: `add`; the quick add paragraph: "back to This week, 15 and no note").
  `markup.js` keeps the chips' order (Today · This week · Next week / Pick a day · No day); `renderAdd` marks the pressed
  chip already. On a Sunday, This week is today (as now). The status line after an add already says "for Sunday".
- Changelog: "Quick add starts on This week (due this Sunday) instead of No day, and goes back to it after each add."

### 2.4 Momo's Tasks say when a card is due (B5)
- `apps/momo/tasks.js taskHTML`: for a task that is a card of its own (`t.need`) with a `due`, add
  `<span class="task-due${t.overdue ? " late" : ""}">overdue</span>` or `due <when>` between the title and `.task-hours`;
  `when` = "today", "tomorrow", the weekday ("Fri") within the six days after tomorrow, else `fmtShort` ("Oct 14"). Only
  here: `cardHTML` (a placed card) and the timed blocks' tasks (`b:` groups) show nothing new (their aria-label already says
  the due day). Every app's card tasks with a `due` get it: Hawky's errands and Appa's jobs (Pabu's needs carry `due` too, if
  share.js sets it; fine).
- `momo.css`: `.task-due { margin-left: auto; font-size: .72em; color: var(--muted); white-space: nowrap; }`,
  `.task-due.late { color: var(--bad); }` (the task already has the red `.late` edge). Check a long errand title still wraps
  and the hours stay at the right on a phone.
- `CLAUDE.md` (tasks.js line). Changelog: "A task for an errand or job says when it's due (“due Fri”, “overdue”) while it
  waits in Tasks; its card says nothing more once placed."

### Tests
- `tests/hawky-errands.test.js`: (a) the chips: `hk.chips(tab)` reads `{ day: "week", minutes: "15" }` at open and after an
  add (line 28's expectation changes); (b) shopping: three stores → three different `--store` values and dots; a fourth store
  added later → the first three unchanged; a done list carries its store's colour; (c) add an item at store A, topic T; type
  store B in the store box → the topic box is empty; type T again, then fix a typo in B → T stays.
- `tests/momo-week.test.js` (or a new test in `tests/momo-cards.test.js`): an errand due in three days → its task's
  `.task-due` reads "due <weekday>"; an overdue one reads "overdue" with `.late`; after dragging it onto a day, the card has
  no `.task-due`.

---

## Phase 3 — Bosco: injection sites in an X with a skip, goals by the 7-day average, deletes that ask (Bosco +0.100 → 7.500)
Closes F1, F2, F4. Bosco only. **Decide first: D1** (the rotation order).

**Read first:** `apps/bosco/CLAUDE.md`, `app.js` (`SITES`, `DEFAULT_SITES`, `DOSING_QUESTIONS_VERSION`, `activeSites`,
`siteLabel`, `siteShort`), `doses.js` (`lastSite`, `nextSite`, `doseSchedule`, `renderDoseSite`, `confirmDose`), `setup.js`
lines 60–70 (`renderSites`) and 245–285 (`saveOneTimeInfo`), `data.js` (`normalizeBackup` ~40–67, `cleanSites` line 71,
`load` ~110–135, `buildBackup` / `applyBackup` (grep), `mergeVersions` / `combine` 225–266), `trend.js` (whole), `render.js`
(`renderHistory`'s Delete, `renderGoals`, `renderChart`), `events.js` (the history Delete and goals Remove handlers,
`renderDev`, `bugState`), `bosco.css` (`.site`, `#sitePills`), `tests/bosco-doses.test.js`, `tests/generate.js` `bosco()`.

### 3.1 The sites, in an X (F1)
- `app.js` `SITES` becomes 18 entries in rotation order (D1): `abd-l`, `abd-r`; the twelve thigh ids
  `thigh-<l|r>-<front|side>-<upper|middle|lower>` in the order D1 settles (labels "Thigh · left front, upper", short "Thigh L
  front upper"); `arm-l`, `arm-r`, `glute-l`, `glute-r`. `DEFAULT_SITES` (`/^(abd|thigh)-/`) still gives the abdomen and
  every thigh site.
- The six old thigh ids (`thigh-l-upper` … `thigh-r-lower`) are stored in entries and in `profile.sites`, so they're kept
  forever: a `LEGACY_SITES` table `[id, label, short, standsFor]` where `standsFor` is the new *front* id of the same leg and
  height. `siteLabel` / `siteShort` look in `SITES` then `LEGACY_SITES` (an old dose still reads "Thigh · left, upper": its
  face wasn't known). `nextSite(after)` takes an old id's place from its `standsFor`. `data.js cleanSites(list)` maps each old
  id to **both** faces' new ids before filtering to `SITES` order (so the thighs stay on), de-duplicated.
- `DOSING_QUESTIONS_VERSION: 4`, so start-up info asks once more on every device. `setup.js renderSites`: 18 pills; group
  them by region with a small muted heading each ("Abdomen", "Thighs", "Upper arms", "Buttocks") and shorter pill text inside
  ("L front upper"), four to a row on a computer, two on a phone, as the current pills are sized. The rotation order is the
  order within each region.
- **The skip** (`profile.skipSites`, an array of site ids or null): `doses.js doseSchedule` walks `site = nextSite(site)` and
  while `skipSites` holds it, steps on again (at most `SITES.length` steps). `events.js A.renderDev`: a second `.dev-block`
  "Injection sites": "Next dose: Thigh · left front, upper" (from `doseSchedule()[0]`, or "no dose scheduled"), a **Skip this
  site** button (adds that id to `skipSites`, `A.save()`, `A.refreshDev()`, `A.renderAll()`; a second press skips the new
  next one too), **Undo skips** when any, and the hint "For when a site isn't a good candidate this week: the next dose goes to
  the site after it. Forgotten once a dose is logged." `confirmDose` sets `S.profile.skipSites = null` before saving.
  `data.js`: `normalizeBackup` cleans it (known ids only; null when absent), `buildBackup` carries it beside `sites`,
  `applyBackup` sets it, `mergeVersions` takes the newer save's value whenever that save knows the field
  (`newer.skipSites === undefined ? older.skipSites : newer.skipSites`: a device that logged the dose and cleared it wins),
  `dataKey` includes it. The dose pop-up needs no change: the dose's `site` already carries the skip's result. `bugState`
  adds "Sites skipped: n".
- Changelog: "The thighs are twelve sites (left/right, front/side, upper/middle/lower), and doses rotate in an X: the other
  leg every time, a different height than the dose before, the faces alternating on each leg; start-up info asks once more
  for your sites. A dose logged at an old thigh site still reads as it did." and "Bosco's Developer Mode tools can skip the
  next site (for a week when it isn't a good candidate); the skip is forgotten once the dose is logged." Plus "Reload Bosco on
  every device after updating."

### 3.2 A goal is reached by the 7-day average (F2)
- `app.js`: `GOAL_AVG_DAYS: 7` (fixed: the Average window toggle on the page starts at 7 on every load and isn't stored, so
  a goal's status mustn't follow it). `trend.js`: `averaged(w)` → the same dates with each weight replaced by the mean of the
  weigh-ins in the `GOAL_AVG_DAYS` days ending that day (the first days average what there is); `model()` adds it (`wa`).
  `reachedDate(goal, wa)` and `goalStatus(goal, wa, rate)` run on the averaged series: Reached on the first day the average
  crossed the goal; the ETA's weeks count from the latest average (assumption 7). `render.js renderGoals` and `renderChart`
  pass `m.wa` where they used `w` for goals (`reachedDate`, the goal lines' `active`, the goal tags' side); the chart's dots
  and line stay the real weigh-ins; the season projections start from the latest average (assumption 7). A short note under
  the goals table: "A goal counts as reached once the 7-day average passes it."
- Changelog: "A goal reads Reached once the 7-day rolling average passes it, not a single day's weigh-in; projections start
  from that average too."

### 3.3 Deleting asks first (F4)
- `events.js`: History's Delete always asks: a weigh-in alone "Delete the weigh-in of 185.4 lb on Oct 3? This can't be
  undone."; a day with a dose keeps the current text (dose, and the weigh-in if any). Goals' Remove asks "Remove the 175.0 lb
  goal? This can't be undone." (Replacing a weigh-in already asks; nothing else deletes.)
- Changelog: "Deleting a weigh-in or removing a goal asks first."

### Docs & tests
- `CLAUDE.md`: `SITES` (18, the X order, `LEGACY_SITES`), `profile.skipSites`, Invariants (the rotation; a goal by the
  average; deletes ask).
- `tests/bosco-doses.test.js`, new tests (desktop, time travel): (a) with the default sites, confirm doses as they come due
  through a round → the sites follow Abdomen L, R, then the twelve in D1's order; (b) an older backup with
  `sites: ["abd-l", "thigh-l-upper"]` and an entry at `thigh-r-middle` → sites on = Abdomen L plus both left-upper faces;
  History shows "Thigh R middle"; the next dose's site is the one after R front middle's place; (c) Skip this site in
  Developer Mode moves the next card's site, a second press moves it again, Undo skips puts it back; logging the dose clears
  `skipSites`; Export carries it; (d) Delete on a weigh-in asks (dialog text has "Delete the weigh-in"), No keeps it; Remove
  on a goal asks; (e) goals: weigh-ins where one day dips under a goal but the 7-day average doesn't → "In progress"; a week
  of days under it → "Reached" on the day the average crossed. Extend `gen.bosco()` for the entries each needs.

---

## Phase 4 — Wan Shi Tong: a director (author, developer) and a year of their own (Wan Shi Tong +0.100 → 2.472)
Closes F3. Wan Shi Tong only. **Decide first: D3** (which categories).

**Read first:** `apps/wanshitong/CLAUDE.md`, `app.js` (`CATS`, `OTHER`, limits, `searchUrl`), `markup.js` (`#itemOverlay`),
`editor.js` (`FIELDS`, `renderCatFields`, `openEditor`, `saveItem`), `render.js` (`nameLine`, `metaLine`), `data.js`
(`cleanItems`, `looksLike`, `combine`), `wanshitong.css` (`.item-info`, `.name-line`), `tests/lib.js`, `tests/generate.js`
(grep `wanshitong`: add a small generator if there is none; no test file exists for this app yet).

### 4.1 Data
- Items gain `by` (the director / author / developer, ≤ 80 characters, `MAX_BY`) and `year` (as typed, ≤ 12 characters,
  `MAX_YEAR`: "2021", "1994–2004"); `cleanItems` keeps both as lines ("" when missing, emptied on a deleted marker); backups
  and sync carry them (items merge whole by `u`, so nothing else changes); `schemaVersion` stays 1; the changelog says to
  reload on every device (an older copy drops them).

### 4.2 The pop-up (`markup.js`, `editor.js`)
- Under Name, one `.field-row`: **`itemBy`** (text, `maxlength` 80; its label from the category: `CATS[].by` — Book
  "Author", Movie "Director", TV/Anime "Creator", Game "Developer", Other "By"; placeholder from `byEg`, e.g. "Denis
  Villeneuve") and **`itemYear`** (text, `inputmode="numeric"`, `maxlength` 12, placeholder "e.g. 2021"). Both optional.
  The info line stays, relabelled now that the year and maker have fields: Book "Edition", Movie "Where to watch", TV/Anime
  "Where to watch", Game "Platform" (`infoEg` to match). `FIELDS` gains both ids (the discard snapshot), `openEditor` fills
  them, `saveItem` reads them through `cleanLine`, Add another clears them. D3's other answer (movies and TV/Anime only): the
  row is hidden for the other categories and their values left "".

### 4.3 The line under the name (`render.js`, `app.js`)
- `nameLine`: after the name, one `.item-info` span (the same class and look as today) reading `[by, year].filter(Boolean).join(", ")`,
  then `info` after `SEP` when present: "Dune Denis Villeneuve, 2021 · Netflix"; with only the old `info`, as today. Active
  media, the backlog and Finished all use `nameLine`. `searchUrl` adds `by` and `year` to the search. Momo's details ("Active ·
  Movie") don't change.
- Changelog: "A recommendation has a Director (Author, Creator, Developer) and a Year of its own, optional, shown under its
  name as “Director, Year” before the rest. Reload on every device after updating: an older copy drops them."

### Docs & tests
- `CLAUDE.md`: State (`by`, `year`), the pop-up's fields, `CATS` (`by`, `byEg`).
- New `tests/wanshitong.test.js` (and `tests/wanshitong.js` helpers if two tests share selectors): add a movie with a director
  and a year → the backlog line reads the name, then "Denis Villeneuve, 2021"; a book with an author only → "Susanna Clarke";
  Start it → Active media shows the same line; Export JSON holds `by` and `year`; a fresh profile imports an older backup
  without them (its `info` shows as before); editing keeps them; the magnifier's `href` holds both words.

---

## Phase 5 — core: Bugs & requests edited in place, and kept in the cloud (Kyoshi +0.100 → 5.070)
Closes F6, F7. Core only (plus three test files). **Decide first: D4** (the hidden-app approach).

**Read first:** `core/bugs.js` (whole), `core/shell.js` (`K.register`, `K.start`, `startApp`, `show`, `renderSwitcher`,
`renderMenu`, `onStoreChange`), `core/sync.js` (header, `apps`, `loadMeta`, `changed`, `incorporate`), `core/storage.js`
(header's note on test mode, `scoped`, `K.store` on line 233), `core/backup.js` (`running`, `exportAll`, `importAllText`),
`core/cloud.js` lines 40–45 (`APP_FILE`) and `readSave`, `core/cloud-key.js` `GUIDE`, `index.html` lines 135–166 (the Bugs
block and `#kBugOverlay`), `core/kyoshi.css` lines 165–175, `apps/wanshitong/data.js` (`combine` with deleted markers: the
model to copy), `tests/shell.test.js` (the two bug tests, the switcher test, the every-app test), `tests/cloud.test.js`
(`computerWithCloud`, `phoneWith`, `onlyText`), `tests/cloud.js`.

### 5.1 The log becomes a hidden app, `bugs` (F6)
- `core/shell.js K.register` accepts `meta.hidden: true`: the app has no page and is never shown. `renderSwitcher` and
  `renderMenu` leave hidden apps out; `show()` refuses one (`#bugs` in the URL, or as the last app, falls back to the first
  app that isn't hidden; `K.start`'s default too); its store is `K.storage.scoped(prefix, !meta.hidden)`, so its writes are
  kept in test mode, as bug reports are today (the header note in storage.js changes with it). Everything else that walks
  `K.order` already checks for the hook it needs (`inbox`, `agenda`, `routine`, `onTick`), and `K.meetings.load` is fine with
  an app that names no meetings.
- `core/bugs.js init()` registers it (shell.js has loaded by then): `K.register({ id: "bugs", name: "Bugs & requests",
  hidden: true })`, then `A.VERSION = K.VERSION`, `A.CHANGELOG = K.CHANGELOG`, `A.load` (the `reports` key; the **first
  time**, when that key is missing, it carries `K.store "bugReports"` over, giving each report `u = Date.parse(timestamp) ||
  Date.now()`, then removes the old key), `A.onReload` (another tab saved: redraw the list and the counts), and `A.data`:
  `schemaVersion: 1`, `build()` → `{ schemaVersion, appVersion: K.VERSION, reports }`, `looksLike(raw)` →
  `Array.isArray(raw.reports)`, `hasData()` → any report that isn't a marker, `importBackup(raw, ask)` → replaces the log
  (asking through `K.backup.ask(A, raw, "Replace your N bugs and requests with the M in this backup?")`; reached by Import all
  only, as it's never the app on screen), `combine(raw, how)` → by id, the later `u` wins (an older copy's report without `u`
  counts its timestamp), markers kept, `same` / `apply` as Wan Shi Tong's, `afterSync()` → store and redraw.
- A report: `{ id, timestamp, app, description, markdown, kind, u, edited ("" or an ISO moment), deleted }`. **Clear** turns
  every live report into a marker (`deleted: true`, `description` and `markdown` emptied, `u = Date.now()`), so a cleared
  report can't come back from a device that still had it; markers older than `MARKER_DAYS` (60) are dropped on load.
  `BUG_REPORTS_MAX` counts live reports. The header comment: what the file is now (the log as a hidden app, the pop-up).
- Every change (`submit`, an edit, Clear) stores and calls `A.changed()` → the cloud, the sync folder and Export all's
  highlight follow. In test mode `A.changed()` does nothing, so set `A.store.set("pending", "1")` then; at the next start
  outside test mode, `A.load` sees it, calls `A.changed()` once and removes it (assumption 11).
- `shell.js onStoreChange`: drop the `kyoshi.bugReports` line (the loop over `K.order` reloads the app by its prefix and calls
  `onReload`). `core/cloud-key.js GUIDE`: "`data/<app>.json`: one file per app (momo, bosco, hawky, …; `bugs` is the Bugs &
  requests log)". `core/backup.js` needs nothing: `running()` includes it, so Export all writes `apps.bugs` and Import all
  takes it back.
- If `core/bugs.js` would pass ~380 lines, split along the seam: `core/bugs-data.js` (the hidden app: register, load, the
  carry-over, markers, `A.data`; loaded before `bugs.js`, exposing `K.bugsData`) and `core/bugs.js` (the pop-up, the list,
  Developer Mode's exports). Put the new file in `index.html` and the root `CLAUDE.md` map.

### 5.2 A report opens in the pop-up to edit (F7)
- The list's rows become buttons (`<button type="button" class="bug-row" data-id="…">`, the tag and the text inside; keyboard
  reachable). Tapping one puts the pop-up in **edit mode** (`editing = { id, snapshot }`): the pills show the report's kind,
  the textarea its whole description (it scrolls; the full length is readable there), the title reads "Bugs & requests ·
  editing", `#kBugSubmit` reads **Save**, a new secondary **Cancel** (`#kBugCancel`, hidden in submit mode) shows, the status
  line says "Editing the Hawky request from 2026-10-06. What it captured (versions, state, console) stays as it was.", and the
  row gets `.editing`. **Save**: `description` ← the textarea (trimmed), `kind` ← the pills; `markdown` rebuilt from the old
  one: the first line's kind word swapped (`· bug` ↔ `· feature request`, right after "app day …"), the description block
  (everything between the first line and the first `\nenv: `) replaced, the rest kept; `u = Date.now()`, `edited` set; store,
  `A.changed()`, back to submit mode with "Saved the change." **Cancel**: back to submit mode, the box emptied. The modal's
  `pending` in edit mode: the text or the kind differs from the report's → "Discard your changes to this report?"; `dismiss`
  leaves edit mode. A row whose report was edited shows " · edited" after its day. Submit mode is unchanged. No per-report
  delete (assumption 10).
- `core/kyoshi.css`: `.bug-row` as a full-width button (no border or background, the same layout, a hover tint,
  `.bug-row.editing` with the accent's outline); `#kBugCancel` sits beside Save.
- Changelog (three lines): the log in the cloud / sync folder / Export all, cleared everywhere at once; a report opens for
  editing with Save; "Reload on every device after updating: the log moved to a store of its own."

### Docs & tests
- Root `CLAUDE.md`: the contract (`hidden: true` in `K.register`: no page, never shown, writes kept in test mode; only core
  uses it, for the bug log), the map (bugs.js's line; bugs-data.js if split), Storage ("`K.store` is core's own: the device
  id"; the bug log is the hidden app's).
- `tests/shell.test.js`: the every-app and switcher tests filter `Kyoshi.order` to apps that aren't hidden
  (`!Kyoshi.apps[id].meta.hidden`) and check the menu never lists `bugs`; the request test reads
  `Kyoshi.apps.bugs.store.json("reports")` instead of `Kyoshi.store.json("bugReports")`; the exports test still plants the
  old key before the first `load()` and sees it carried over (the stored copy has `u`), and after Clear the stored reports
  are markers (`deleted: true`, no words); a new edit test: tap the row → the box holds the whole description (two lines),
  change the text and the kind, Save → the row reads the new first line with "R" → "B" and " · edited", the stored
  `markdown`'s first line ends with " · bug", its description is the new text, and its `env:` line is unchanged; tap the row,
  change a word, Esc → the discard question, No keeps editing, Cancel leaves it; opening `index.html#bugs` shows Momo.
- `tests/cloud.test.js`, one new test: a report filed on the computer → `data/bugs.json` appears in the fake (`onlyText`
  holds: it's a data/ file), decrypts (`decryptInNode`) to `{ reports: [ … ] }` with no device words but the typed
  description; the phone lists it after its check; Clear on the phone → the computer's list and footer count empty after a
  check; Export all on either has `apps.bugs`.
- `tests/sim`: grep `Kyoshi.order` (life.js, check.js, robust.js, curated.js): where the simulator switches to or checks each
  app, skip hidden ones; `node tests/sim/run.js` isn't part of the test run, but it must still start.

---

## Phase 6 — core: a daily backup folder in the cloud; encrypted files imported as they are (Kyoshi +0.100 → 5.170) — after Phase 5
Closes F5. Core only. **Decide first: D5** (the layout and the one-commit approach).

**Read first:** `core/cloud.js` (header: the safety rules; `listing` / `list`, `pass`, `checkNow` → `afterCheck`, the
`K.cloud` object), `core/cloud-upkeep.js` (whole: the once-a-day pattern, the key record's fields through `cloud.keep`,
`navigator.locks`, `TIDY_GAP_MS`), `core/github.js` (whole), `core/cloud-key.js` (`GUIDE`, `exportDecrypted`, `decryptFile`),
`core/cloud-ui.js` (`BUTTONS`, `render`, `act`), `core/backup.js` (`importText`, `importAllText`, `onFile`),
`core/cloud-crypto.js` (`seal`, `open`, `isEnvelope`: grep), `index.html` lines 86–103, `tests/cloud.js` (the fake: `trees`,
`blobs`, `commitFiles`, the `/git/commits` and `/git/refs` routes, `plant`), `tests/cloud-upkeep.test.js` (whole: its commit
counts), `tests/cloud.test.js` (`onlyText`; the decrypted-copy and Decrypt a file tests), `tools/decrypt.html` lines 70–95.

### 6.1 What the repository holds
- `backups/<YYYY-MM-DD>/<app>.json`: that day's `data/<app>.json`, the very same encrypted file (the tree points at the blob
  already there); `backups/<YYYY-MM-DD>/kyoshi.json`: an envelope with `app: "kyoshi"` whose plain text is an Export all file
  `{ kyoshiVersion, exportedAt, cloud: true, apps: { <id>: save } }` (every app with data, `K.sync.saveOf(A)`; after a check
  got through, this device's saves are the cloud's). Kept: today's folder and the seven days before it (8 folders); older
  folders leave in the same commit. Nothing in `backups/` is ever read by the sync (`APP_FILE` matches `data/` only).

### 6.2 New file `core/cloud-backups.js` (after `cloud-upkeep.js` in `index.html`; adds to `K.cloud`)
- Chained on `afterCheck` (keep upkeep's: `const prev = cloud.afterCheck; cloud.afterCheck = c => { prev(c); daily(c); }`): once
  a day, after a check got through, when the key record's `backupDay` isn't today (the device's local date; never in test
  mode) and no backup is running (one tab at a time: `navigator.locks` "kyoshi-cloud-backup", stale when the key changes):
  1. `listDir("backups/<today>")`: files already there (another device made it) → record `backupDay` and stop.
  2. `branch()` → the head's `sha` and `tree`. The data files' blob shas from the check just done (`K.cloud.files()`, a new
     accessor returning a copy of cloud.js's `listing`) → entries `{ path: "backups/<today>/<app>.json", mode: "100644", type:
     "blob", sha }`. The all-in-one: sealed here (`C.seal(allInOne, secret, "kyoshi")`), `newBlob(base64)` → one entry.
  3. Retention: `listDir("backups")`'s `dirs` whose name is a date before today − 7 → each one's files (`listDir` of it) as
     entries with `sha: null` (dropped from the tree).
  4. `newTree(head.tree, entries)` → `newCommit(treeSha, "Kyoshi: daily backup <today>", [head.sha])` →
     `moveBranch(sha, { force: false })`. Another device saved meanwhile → GitHub refuses (422): nothing recorded, tried again
     at the next check that gets through (at most `BACKUP_TRIES` 3 a day, counted in the key record).
  5. On success `cloud.keep({ backupDay: today, backupAt: iso(now), backupTries: 0 })`; `cloud.ui()`.
  Pauses between the writes as the tidy does (`TIDY_GAP_MS`); a `GithubError` other than a refusal: the next check. Exposes
  `K.cloud.backupNow(tell)` (Developer Mode's button: the same steps now, "Backed up 9 apps into backups/2026-10-06." or a
  refusal, "Today's backup is already there." when it is) and `K.cloud.backups()` → `{ day, at, tries }`.
- `core/github.js` gains `newBlob(base64)` (POST `/git/blobs` → sha), `newTree(baseTree, entries)` (POST `/git/trees` with
  `base_tree`; an entry with `sha: null` drops that path), `listDir` also returning `dirs` (the names of `type === "dir"`
  entries), and `moveBranch(sha, { force = true } = {})`. Its header: the calls, and "There is still no call that deletes a
  file: a `backups/` folder past the retention leaves because the day's tree no longer holds it (core/cloud-backups.js)".
- `core/cloud.js` header, the safety rules: "Only `data/<app>.json`, `KYOSHI.md` and `backups/<date>/…` are ever written …;
  `backups/` is written once a day and never read by the sync". `K.cloud.files()` added.
- `core/cloud-ui.js`: a hint line `#kDevCloudBackups` under the History line, shown while on: "Daily backups: the last 8 days
  in backups/ in the repository; today's is in (3:04 PM)." / "…today's hasn't been made yet: it's made after a check gets
  through." A **Back up now** button (`#kDevCloudBackup`, in `BUTTONS.on`) → `act(tell => K.cloud.backupNow(tell))`.
- `core/cloud-key.js GUIDE`: a `backups/` section (what's there, 8 days, one commit a day; how to bring one back: Import JSON /
  Import all take these files as they are once the key is entered on that device, or `tools/decrypt.html`). `writeGuide`
  rewrites `KYOSHI.md` once on every device, as it does when the text differs.

### 6.3 Encrypted files imported as they are
- `core/backup.js`: `importText` and `importAllText` become `async`. After `JSON.parse`, when `K.cloudCrypto.isEnvelope(raw)`:
  no key held (`K.cloud.held()` null) → `alert("That file is encrypted. Enter the cloud key first (Developer Mode → Cloud sync →
  Enter key…), or use Decrypt a file… there.")`; else `raw = await K.cloudCrypto.open(raw, await held.lock)` (code "key" →
  `alert("That file can't be read with this device's key: it was locked with another one.")`), then on as today: an app's
  envelope goes through its import, the all-in-one's plain text is an Export all file (the `raw.apps` branch). `onFile`
  already awaits the file; the callers (`importText(K.active(), text, date)`, `importAllText`) just return the promise.
- `tools/decrypt.html` (lines 84–92): an envelope with `app: "kyoshi"` is already an Export all file: write it out as it is
  (one file, named `kyoshi-cloud-<date>.json`) rather than nesting it under `apps.kyoshi`; the "every app above in one file"
  line then leaves it out.
- Changelog (three lines): the daily backup folder (what, how many days, one commit a day, Back up now); Import JSON and
  Import all take the cloud's encrypted files as they are (with the key entered); `tools/decrypt.html` hands an all-in-one
  file back as it is.

### Docs & tests
- Root `CLAUDE.md` map: `cloud-backups.js` line; cloud.js's line gains "and a dated backup folder a day (backups/)".
- New `tests/cloud-backups.test.js` (made-up data; `tests/cloud.js` helpers): a computer with Hawky's and Momo's data sets the
  cloud up on day D → after the check: `backups/D/hawky.json`, `…/momo.json` and `…/bugs.json` hold the same shas as their
  `data/` files (`fake.files`), `backups/D/kyoshi.json` decrypts (`decryptInNode`) to `{ apps: { hawky, momo, bugs } }` with
  Hawky's errands inside, the history gained one commit, `fake.odd` is 0; another check the same day adds nothing; a phone
  the same day finds the folder and makes nothing (`fake.made` unchanged); the clock moved to D+1 and Sync now → a second
  folder; plant files under `backups/<D−8>/` and `backups/<D−9>/` (`fake.plant`) → gone after the next day's backup while
  `backups/<D−7>/` stays; Back up now with today's in → "already there"; a `moveBranch` with `force: false` the fake refuses
  once (hold a save so the head moves: `fake.hold`) → the next check makes it; Import JSON of `backups/D/hawky.json`'s text on a
  fresh device with the key → the errands come in; without a key → the alert's words; Import all of `kyoshi.json` → asks once
  with every app's name, both apps in; `tools/decrypt.html` given `kyoshi.json` → an Export all file.
- `tests/cloud.js`, the fake GitHub: POST `/git/blobs` (store bytes → sha), POST `/git/trees` (`base_tree` copied, entries
  applied, `sha: null` drops a path, → a new tree sha in `trees`), GET `contents/<dir>` for a folder with subfolders
  (`backups` → entries of `type: "dir"` by the folders' names; `backups/<date>` → its files; `data` stays as it is), PATCH
  `refs/heads/main` with `force: false` → 422 when the new commit's parent isn't the head. `fake.odd` keeps counting anything
  else.
- `tests/cloud.test.js onlyText`: the pattern also allows `backups/\d{4}-\d{2}-\d{2}/[a-z0-9]+\.json`.
  `tests/cloud-upkeep.test.js`: its commit counts gain the daily backup's commit where a day's first check makes one (the
  "five saves" line and the trim's "three commits left"); re-derive each count from the fake's history rather than guessing.

---

## Phase 7 — Momo: PTO and sick time, lightly (Momo +0.100 → 10.484)
Closes F8. Momo only. **Decide first: D6** (what the PTO balance means).

**Read first:** `apps/momo/CLAUDE.md` (Purpose: weekends; Invariants: Weekends, Days off), `model.js` header (`weekends`,
`emptyData`), `data.js` (`cleanWeekends` ~180, `normalizeData`, `buildBackup`, `mergeVersions` / `dataKey` / `combine`
322–356; `hasData` in model.js), `weekends.js` (whole: `offDays`, `offOn`, `offAhead`, `renderWeekends`, the pop-up,
`readOff`, `renderOffNotes`), `events.js` (`renderDev`, `bugState`, `onStepper`), `markup.js` (`details.weekends` lines ~25
and ~74, `#weekendOverlay` 215–250), `momo.css` (`.weekends`, `.we-head`, `.off-row`, `.note`), `tests/momo-weekends.test.js`,
`tests/momo.js` (weekend helpers ~280–300), `tests/lib.js` (`devPanel`).

### 7.1 Data (`model.js`, `data.js`)
- `data.timeOff`: `null`, or `{ pto, sick, asOf, u }`: the balances **in hours** as typed on `asOf` ("YYYY-MM-DD"), kept to
  the quarter hour, −999 to 9999 (a negative balance is allowed and shown in red). `emptyData` adds `timeOff: null`;
  `cleanTimeOff(raw)` (null unless both hours are numbers and `asOf` a date); `normalizeData` sets it; `buildBackup` carries
  it; `mergeVersions` picks the later `u` (as the baseline's `pick`); `dataKey` includes it; `hasData` counts a record as
  yours. No schema bump; the changelog says to reload on every device (an older copy drops it). `data.js` is at 376 lines:
  if this pushes it past ~400, move `cleanAsks`, `cleanWeekends` and `cleanTimeOff` into a new `apps/momo/clean.js` (loaded
  before `data.js`), exposed on `A`.

### 7.2 Worked out, never decremented in storage (new `apps/momo/timeoff.js`, after `weekends.js`)
- `ptoLeft()` = `timeOff.pto` − the hours of every day off on or after `asOf` over all weekend records (not just the
  upcoming ones): the set of dates from `offDays(sat)` of each weekend with days off, each counted once by `offOn(date)`
  (whole 8h, a half 4h; a day two weekends reach counts once). `sickLeft()` = `timeOff.sick` (manual only). D6's other
  answer: count only weekends whose `u` is after `timeOff.u`.
- `fmtTimeOff(hours)`: 8-hour days by halves: "5½ days", "1 day", "½ day", "0"; a remainder that isn't a half: "1 day 2h"
  ("2h" alone under a day, "1 day 30m" never: hours to the quarter show as "2.25h"); negative with "−", in red (`.neg`).
- Where it shows (only once `timeOff` is set): the end of both Upcoming weekends summary lines (`renderWeekends`): "· PTO 5½
  days · Sick 2 days"; in the weekend pop-up, under Days off's note, a live line "PTO: 5½ days now, 4 days after this
  weekend" that follows the Before / After fields (red when it would go below 0). Nothing on the board or Today: days off
  still take no hours.

### 7.3 Developer Mode (`events.js renderDev`)
- A second `.dev-block` "Time off": two number fields, **PTO hours** and **Sick hours** (step 4, prefilled with `ptoLeft()`
  and `sickLeft()` when set, else empty), **−½ day** / **−1 day** buttons beside each (they lower the field by 4 / 8), **Save
  as of today** (`timeOff = { pto, sick, asOf: todayStr(), u }` through `A.save()`: undo, sync, backups; a field that isn't a
  number is refused with an alert), **Clear** (`timeOff = null`, asked first), and the hint "Days off entered on a weekend
  come off PTO from the day you save this. Sick time only changes here." Saving re-bases: the numbers typed are the truth as
  of today, and planned days off from today on come off them (D6).
- `bugState`: "Time off: set up" or "not set up" (never the hours). Changelog: "Upcoming weekends shows your PTO and sick time
  left, in days by halves (8h a day, a remainder in hours), once you set the hours in Momo's Developer Mode tools; days off
  entered on a weekend come off PTO as you enter them (the pop-up says what's left), sick time changes only there." and
  "Reload Momo on every device after updating: an older copy would drop the balances."

### Docs & tests
- `CLAUDE.md`: Purpose (one line), files (`timeoff.js`; `clean.js` if split), State / Storage (`timeOff`; the reload note),
  Invariants (worked out, never decremented; what's subtracted; where it shows).
- `tests/momo-weekends.test.js`, new tests: set 44h PTO and 16h sick in Developer Mode → both folds' lines end "PTO 5½ days ·
  Sick 2 days"; a weekend with 1½ days off after today → "PTO 4 days", and its pop-up's live line says "4 days after this
  weekend" while typing; a day off dated before today (on an earlier weekend) changes nothing; 10h → "1 day 2h"; −½ day on
  sick, Save → "Sick 1½ days"; Export JSON holds `timeOff`, a fresh device imports it; an older backup without it imports and
  shows nothing of it; Clear asks and takes it off; two tabs: the later Save wins after a reload (or `combine` through
  `page.evaluate`, as the sim's robust.js does). Add `tests/momo.js` helpers for the dev block's fields.

---

## How to run this plan, and the result
**Running the plan:** one phase per session, in order, with the owner's answers to the phase's *Decide first* items:
`Execute phase N of roadmap/2026-10-06_feedback_batch_plan.md` (e.g. "Execute phase 3 …, D1 as proposed"). Each phase ends
pushed to `main`, ticked under *Status*, with the reports it closes named. When every phase is ticked, move this file to
`roadmap/archive/` (same name) with one commit.

**Running and checking the result** (after any phase, and once all seven are done):
- **Live:** GitHub Pages serves `main` a minute or two after the push: open the site (or `index.html` from a Download ZIP
  for a branch), and hard-reload once if a page looks stale. **From disk:** open `index.html` by double-click.
- **Developer Mode:** Ctrl+9 or the DEV badge. There you'll find Bosco's "Injection sites" block (Phase 3), the Cloud block's
  fading line, Daily backups line and Back up now (Phases 1, 6), the three-entry changelog (Phase 1), Momo's "Time off" block
  (Phase 7), and Bugs & requests' exports.
- **A quick tour per phase:** 1 — take a decrypted copy, close the panel, open it: the line is gone. 2 — Hawky → Shopping:
  stores in distinct colours; quick add opens on This week; type a new store after an add: the topic clears; Momo's Tasks
  show "due Fri" on an errand. 3 — Bosco: start-up info asks for your sites (the twelve thigh ones); the next doses follow
  the X; Delete asks. 4 — Wan Shi Tong: add a movie with a director and year. 5 — tap a bug report's row, edit, Save; file one
  on the phone, see it on the computer after a minute. 6 — Developer Mode → Cloud sync: today's backup; on GitHub, the
  repository's `backups/` folder; Import JSON of one of its files. 7 — Momo → Upcoming weekends: PTO and sick time on the
  fold; enter a day off on a weekend and watch PTO go down.
- **Tests:** `node tests/run.js` runs everything (Node 18+ and Playwright with its Chromium: installed in Claude's cloud
  sessions; elsewhere `npm i -g playwright && npx playwright install chromium`); `node tests/run.js cloud` or `… bosco`
  filters by name. Cloud tests run against a fake GitHub; nothing reaches the real one. The flow simulator,
  `node tests/sim/run.js`, writes `report.md` and is optional.
- **Phones:** reload Kyoshi on every device after Phases 3, 4, 5 and 7 (each adds a stored field an older copy would drop).
