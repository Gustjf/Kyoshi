# Kyoshi — plan for the 2026-10-08 feedback batch (6 feature requests, 2 bugs)

Planned 2026-10-08 by the architect model from `kyoshi-bug-reports-2026-10-08.md` (the owner's 8 reports, Kyoshi 5.170 ·
Bosco 7.500 · Wan Shi Tong 2.472 · Hawky 2.230 · Badgermole 2.221 · Pabu 2.121). Six phases, each sized for one coding
session, grouped by the app or core file they touch; the two "bugs" are feature requests in all but name (one was filed
before the Bug / Feature request pick existed). All six phases are built (2026-10-09): see *Status*.

**The owner runs a phase by saying:** `Execute phase N of roadmap/2026-10-08_feedback_batch_plan.md`. The strategic
decisions are made (under *Decisions*: the architect's, since no question was put to the owner this time; each has one
line to change if wrong), so nothing is left to decide before a phase runs.

## How to use this file (you, the executing model — Claude Opus 5.5)
1. Read the root `CLAUDE.md` (automatic), then **only** this file's top sections (down to the first phase) and **your
   phase**; skip the other phases. Then the phase's **Read first** list, and nothing else up front: every file's header
   comment says what it holds, and `apps/<id>/CLAUDE.md` has each app's map and data model. Don't scan the workspace.
   Let a Haiku scout (below) read the long files for you where the phase says so.
2. **Decisions:** D1–D8 below are settled; each phase's text already follows them. Everything else is settled here or is
   yours to judge (small UI details, exact wording in the owner's voice). A choice that would change how data is kept or
   what the owner sees in a way this plan doesn't settle → ask the owner in plain terms (they're a layman), in plan
   mode, and wait; don't guess.
3. Build the phase as one unit. Keep every change targeted: no rewrites, no renames of what works, no touching apps the
   phase doesn't name, files stay under ~400 lines (split along a clear seam where a phase says). Reuse what's there
   (helpers named in each phase).
4. **Before pushing, every phase:** (a) a changelog line per change in each touched app's `changelog.js` and/or
   `core/changelog.js`, newest first, one new version per app per phase, bumped by the largest tier among its changes
   (+0.001 fix · +0.010 tiny tweak · +0.100 small feature · +1 large feature; the version each phase expects is in its
   title); (b) update the touched app's `CLAUDE.md` (files, state, storage, shared, invariants) and the root `CLAUDE.md`
   only where core's contract or map changed; (c) a new build stamp:
   `sed -i "s/?v=[0-9][0-9-]*/?v=$(date -u +%Y%m%d-%H%M)/g" index.html`; (d) tests: add or refresh the ones the phase
   names (made-up data only: the repo is public; `tests/lib.js`, `tests/generate.js`, the app's `tests/<app>.js` screen
   helpers), then `node tests/run.js` must be green (filter by name while iterating, e.g. `node tests/run.js hawky`; the
   full run once before pushing); (e) check by hand from disk: open `index.html`, switch to each touched app, console
   clean, phone width (≤ 640 px), Developer Mode time travel +1 day and +1 week; Export then Import JSON for an app whose
   data shape changed (an old backup must still import); (f) the Haiku **checklist** and **closer** runs (below) came
   back clean, or what they found was fixed or judged wrong, in writing; (g) commit with a clear message and push to
   `main` (the owner's rule; no branch unless the phase says so). Don't check the live site.
5. **After pushing:** tick the phase under *Status* with a line of what was decided along the way, and tell the owner
   which reports it closes (numbers from the table below) so they can mark them done.
6. Data rules that always apply: never rename or drop a stored key without carrying its data over; new fields are
   additive and every cleaner keeps accepting older shapes; older copies of an app drop fields they don't know when they
   save → when a phase adds a stored field, its changelog says "reload on every device after updating". No personal data
   anywhere in the repo (tests use made-up names). Bug reports and console lines hold counts, never the owner's words.
7. Phases are independent. Do them in the numbered order unless the owner says otherwise; one phase per session.

## Haiku helpers: cheap second pairs of eyes (you spawn them; they never decide or write)
*Phase 6 ran without them (the owner, 2026-10-09: no agents unless necessary or too hard otherwise): the executing model
went through the checklist, fresh eyes and closer by hand.*
Claude Haiku 5.5 is cheap and fast. Use it freely for **looking, counting and comparing**, never for deciding, designing,
wording the owner's text, or writing code or tests. Spawn one with the Agent tool, `subagent_type: "Explore"` (read-only:
no Edit or Write) and `model: "haiku"`; several at once in one message when they don't depend on each other. A helper
sees nothing of your conversation: its brief must be self-contained (the goal, the exact files or the `git diff`, the
checklist, the output shape). Give it the artifact and a question, never your conclusion to confirm. **Every claim it
returns is a lead, not a finding:** open the file at the line it names and judge for yourself before changing anything;
a lead you reject gets one line saying why in your own notes, not a fix. Budget: 4–8 runs per phase.

**Keep every helper's context under 100k tokens** (the owner's note, 2026-10-08: Haiku is penalised past that; aim for
60k). Everything counts: your brief, the diff you paste, and every file or grep result the helper reads on its own.
Kyoshi's lines are long: reckon **30 tokens a line**, so a helper may read about **2,000 lines in all**, brief included. Hence:
give line ranges, never whole long files; name at most three files a helper may open and say "open nothing else"; split a
diff by file (`git diff -- apps/hawky/lists.js apps/hawky/events.js`) so no run gets more than ~600 lines of diff, and run
the halves side by side; never let a helper grep the whole repo (name the paths); the runner's output goes in by failed
test, never a whole run. Size a brief first (`git diff --stat`, `wc -l`): a helper that would need more is two helpers.
The five jobs:

1. **Scout** (before building, one run): "Read these files: … For each function named here (…) give its line range and
   signature; the exact current text of these strings (…); every element id in this markup block; the signatures of
   these test helpers (…). At most 60 lines. Quote, don't paraphrase. Open nothing but these files." Use it on the
   phase's longest Read-first files so you open them at the right lines instead of reading them whole: at most three
   files, or ~1,200 lines, per scout (the line ranges the phase gives, where it gives them); a longer list is two
   scouts. A scout's quotes are to be re-read in the file before you edit next to them.
2. **Checklist** (after building, before the full test run; runs in parallel, each with the whole list of rules, which is
   short, and a slice of the diff of at most ~600 lines, split by file; plus one run with only `index.html`'s stamps,
   the changelogs and the `CLAUDE.md` files for rules 1–3 and 11): "Here is the diff of these files (and the list of every
   touched file). For each rule, PASS, FAIL with file:line evidence, or NOT IN THIS SLICE; no opinions. Open nothing
   else." The rules: (1) every touched app has a new top changelog entry with today's date and exactly one tier bump from the
   previous top version; (2) `core/changelog.js` bumped iff a file under `core/` changed; (3) every `?v=` stamp in
   `index.html` is the same new value; (4) no file over 400 lines; (5) every changed file's header comment still
   describes what it holds; (6) no `document.getElementById` / `document.querySelector` in `apps/` (only `A.$` /
   `A.root.querySelector`); (7) no `Date.now()` used as a calendar day (only `K.util.todayStr()` / `now()`), `Date.now()`
   only for `at` / `u` / `savedAt`; (8) no CDN links, no `fetch` of the site's own files, no ES modules, no deprecated
   APIs; (9) a new stored field is read by its cleaner with a default for older data and the changelog says "reload on
   every device"; (10) no real names, weights, dates of birth or addresses in tests or fixtures (made-up names only);
   (11) the touched app's `CLAUDE.md` mentions each new field, hook, id scheme or invariant the diff adds; (12) every
   new `confirm`/`alert` string is a full sentence that says what will happen; (13) every id the diff stores is one the
   plan names (and `SITES`-like id tables are untouched); (14) new CSS is under `.app-<id>` (apps) or in
   `core/kyoshi.css` (core), with no new colours that aren't theme tokens unless the plan names a hex.
3. **Fresh eyes** (after building, in parallel with the checklist): "Here is the diff of these files (≤ ~600 lines; the
   app's files, not the tests). You may open these two files to trace callers: …; nothing else. Read it adversarially
   against these questions (the phase's **Haiku asks** list, plus always: what happens with an older backup that lacks
   the new field? with two devices changing the same thing before they sync? in test mode / time travel? on a 390 px
   phone?). Return at most 8 leads, each: file:line, the claim, one concrete input → wrong outcome. No style remarks."
   A bigger diff is two runs, each with the questions that touch its files.
4. **Closer** (last, one run): "Here is the owner's original request, quoted: «…». Here is the diff of the app's files
   (not the tests, not the docs; ≤ ~600 lines, else the changed functions' new bodies only) and the changelog lines.
   Answer only: (a) anything asked for that the diff doesn't do; (b) anything the diff does that wasn't asked for;
   (c) any changelog line that promises something the diff doesn't deliver, or uses a word the owner didn't. Open
   nothing." Paste the report's text from the table below verbatim.
5. **Test triage** (only when `node tests/run.js` prints more than a screen of failures): "Here are the failed tests'
   blocks from the runner (each failure prints as one block; `node tests/run.js <word>` narrows a run), nothing else.
   For each: its name, the failing check's words, the likely file:line in the app or the test, and whether that test
   was changed in this diff (list of touched test files: …). Open at most these test files: …." Then you fix; a Haiku
   never edits a test.

A Haiku can be wrong in both directions (it will miss things and invent things). Its value is that it is cheap enough to
ask narrow questions you wouldn't spend your own context on, and that it reads without your assumptions.

## The 8 reports → phases
| # | App | Report (the owner's words, short) | Phase |
|---|---|---|---|
| F1 | core | "Add a minimal way to delete feature request and bugs." | 1 |
| F2 | core, Bosco | "Keep preferences the same on the cloud as well. I noticed this specifically when having to select injection sites again. If it needs to route through an app that isn't visible, ensure that app is Kyoshi. Kyoshi will act as a catch-all app for anything that needs it and can't go in core. Kyoshi should not be visible." | 1 (core), 3 (Bosco) |
| F3 | Bosco | "I would like to have the chart on Bosco not look as continuous and smooth. I am ok with discrete data points with linear lines drawn between them. … it will look more real." | 3 |
| F4 | Wan Shi Tong | "Remove the combined 'Year or director' field for Movies. … make it so that the input boxes for Wan Shi Tong no longer pre-populates with a movie. I don't need examples for this and it's a bit distracting. Also remove the instance of 'where to watch' for TV - I have one source that I go to for everything and don't hop between services." | 4 |
| F5 | Hawky | "Add a way to mark the shopping list as bought without going through the 30 day or 7 day locking portion. Some things I just buy without going through the waiting period." | 5 |
| F6 | Pabu | "Allow me to designate one person I am in a relationship with in the setup window. When that person as designated as in a relationship with me, allow me to input an anniversary date. Have this function similar to birthdays - there should be a symbol for anniversary with the date beside the name. I want this to be visible when it comes up, much like how upcoming birthdays are visible. Ensure that it is minimal yet something I will notice. Take Bosco's setup window in the developer options as inspiration. No need to ask for my name or anything." | 6 |
| B1 | Hawky | "Add a task to errands when shopping list has gone through its waiting period. Then auto complete list when errand is checked off and also complete errand when shopping list is closed out." (filed 2026-10-04 on the phone, Hawky 2.110, before the Bug / Feature request pick existed; it surfaced with the log's move to the cloud) | 5 |
| B2 | Badgermole | "The way the cards are calculated for workout times is incorrect. I want to enter how long each routine takes manually in minutes in badgermole." | 2 |

Why B2 reads as it does: a planned workout's card takes the average length of the routine's last five sessions
(`stats.js usualMinutes`), and a session logged after the fact (every set at once) takes a minute or two, so the cards
came out far too short. A number the owner types is the right source.

## Status (tick each phase off here, with what was decided)
- [x] Phase 1 — core: a report can be deleted; the theme follows you through the hidden Kyoshi app — done 2026-10-08 (Kyoshi 5.270): the preferences combine by `u` everywhere, imports included (a backup's older pick, or none, doesn't undo a later one; the plan's "taken from a backup" read that way); a pick's `u` is past every pick the device has seen (`max(now, last u + 1)`), so a device whose clock runs behind still wins with a later tap (the tests' two profiles needed it); a pick is a quiet change (an import's question doesn't call the data newer for it); `onReload` adds no `applyPrefs` (`load` runs it); a tap while storage opens isn't kept (said in `setPref`'s comment, not worth more code); Delete asks nothing for a report cleared meanwhile (it says so); the pop-up's hint says "edit it or delete it"; the changelog adds that a theme picked before the update stays on its device until the first tap after it, and to reload every device; one more shell test (the theme through Export all / Import all, and test mode). Kept as it was: `tests/cloud.test.js` over 400 lines (525 before; tests aren't site files).
- [x] Phase 2 — Badgermole: how long each routine takes, typed — done 2026-10-08 (Badgermole 2.321): the field sits under Name (120 px, as the weekly target) with its hint "Momo makes its cards this long."; Next up keeps the minutes where "usually" was ("Not done yet · 1 h · 3 exercises") and every routine's row shows them (60 reads "1 h"); `niceMinutes` went with `usualMinutes` (no other reader); a done session whose routine is deleted takes its clock minutes only from 5 up, else 60 (the closer and fresh eyes both flagged a 1–2 minute card there, the very complaint); the changelog adds "shown beside it on Home", says "from Start to Finish" for the old estimate and what an older copy would drop; tests: a 42-minute routine (the field's step of 5 is only for its arrows: the form is `novalidate`), a minutes-only change asks before it's thrown away, a session logged in a minute is a 45-minute card ("took 1 min") and 60 once its routine is deleted, the damaged backup's routine carries 1e9 minutes (kept to 300, "5 h"), Momo week's Badgermole chunk reads 3h (60 each; it was the estimate). Kept as they were: the refusal "How long does it take? From 5 to 300 minutes." (the plan's words, like its neighbours "sets go from 1 to 10."; the checklist wanted a full sentence); an older copy still syncing can put typed minutes back to 60 even untouched (a tie in `u` goes by the text, and "60" sorts after "45"): the plan's reload note covers it, and `apps/badgermole/CLAUDE.md` says so. Helpers ran on Sonnet (the owner's choice for this phase).
- [x] Phase 3 — Bosco: the progress image in straight lines; start-up answers travel with the data — done 2026-10-08 (Bosco 7.600): the image's line goes straight from weigh-in to weigh-in, a dot at each in a white ring, the latest bigger, the fill kept; every ring is drawn before any dot (a ring drawn over the dots before it turned a long daily history into white speckles: fresh eyes), over the line so each weigh-in stands apart, but under it for a weigh-in close to the one before or after (under 13 px along the dates, or a line under 20 px between: a long or steady history), where the rings would whiten the line; the changelog says "with a dot at each" (hundreds overlap) and "follow you to your other devices … your injection sites" (the closer). The save's `asked` is the plan's `{ medication: true|false, dosing }`; cleaned, it also holds the save's own medication as `answer` when this version knows it ("none" too): a device that hadn't answered takes it with the flag (else it stopped asking yet sat on Tirzepatide, the default: the doses' rule only covered a save with doses), and the doses' rule doesn't override an answer just taken; one that answered keeps its own; the dosing version is taken only if the medication question was answered by the device or by the save (one a dose answers just now leaves the dosing questions asked, as before); `dataKey` counts the answers as asked or not and the version, so two different answers, or a later version's medication unknown here, never keep two devices saving back and forth; a save taken whole joins them too (as its plan and vial), so `kept` needs nothing; an older copy's save (no `asked`) isn't saved back for (stamped now, that would outrank its next edit in a combine); start-up info asks the dosing questions unless `dosingAsked >= DOSING_QUESTIONS_VERSION` (was `!==`) and Save never lowers it, so a device given a later version's answer doesn't ask forever; bugState "- Start-up asked: medication yes/no, dosing v4"; the changelog adds "Reload Bosco on every device after updating.". Tests: the image by a canvas spy and its pixels (no curves; the line ends at every weigh-in; a short history's rings cut the line, a 200-day and a steady weekly one stay blue; one weigh-in), a new doses test over six devices (Import and sync, None, two answers, an older copy, a later version, an unknown medication with and without doses, a damaged file), and the sync test's older copy drops `asked` too. Helpers: a Haiku scout, two Haiku checklists and the closer; fresh eyes on Opus (the owner's choice for this phase): two, a second pass on the fixes and a last one on the sync. Kept: the 0–99 range (a hand-edited 50 would hold off later bumps); while a device can't take a later version's answer, the answered one saves back once per change (it settles; that's how the answers stay in the cloud's file). For later (as before this phase): a medication switched on one device doesn't reach one that already answered, and one that answered None with doses in its log is turned back on by the doses' rule when a save with something new comes (the owner's call: it needs a stored field); once a medication is added, an older copy drops a plan or vial for it and the two copies may save back and forth (`cleanDosePlan` / `cleanVial`).
- [x] Phase 4 — Wan Shi Tong: no "Year or director" box for movies, no examples, TV's box reads "Year" — done 2026-10-09 (Wan Shi Tong 2.582: the top was 2.482 by then): `CATS` movie `info: ""`, TV's "Year", `nameEg` / `infoEg` and the three markup placeholders gone; the info box (`#itemInfoField`) shows when the category asks for info or the item held info as it opened (`S.editing.hadInfo`, read at open: the box stays while the pop-up is open even once cleared, and is gone the next time), labelled "Note from before" when the category asks for none (a book switched to Movie too: what it holds is never hidden and dropped), its text saved only while it shows. An older show's info stays in its box, now labelled "Year" (nothing stored tells an older note from a year typed since), so the changelog gives "Note from before" to movies only and says a show's stays (the plan's line said both); three lines, no reload note (nothing new is stored). Tests: the box per category and no placeholder anywhere (add and edit); info typed under Book then Movie left out; a movie turned into a book takes an edition; the older backup on a phone with a show ("Year", holding "2023, StreamCo") beside the movie ("Note from before"); a new test: the note kept through an edit, then moved into Director and Year and cleared, no box the next time nor after a reload. Helpers (Haiku): two checklists, fresh eyes, the closer. Judged and kept: a note synced in while the pop-up is open is overwritten by its Save (the whole form wins by `u`, every field, as before; the old box held the same "" it opened with) and Esc asks after only a category or Yes / No tap (as before, intended: Esc would lose it), both fresh eyes'; "Miyazaki" / "Susanna Clarke" in the tests (public credits, already there and the plan's own example, not personal data) and `#itemInfoField` not in `CLAUDE.md` (it lists no element ids), the checklists'; the closer's "a box still shows for an older movie" and "Note from before isn't the owner's word" (D4: the label the owner sees, so the changelog names it).
- [x] Phase 5 — Hawky: Bought without the wait; a ready list's errand, each completing the other — done 2026-10-09 (Hawky 2.340: the top was 2.240 by then): Bought is an open list's third button (secondary, after the locks; on a phone it wraps under them), with the plan's question ("the item" for one); it's kept as a 1-day lock (`BOUGHT_LOCK_DAYS`, a length no button offers) unlocked early that day, not the plan's 7-day one, so a Bought list is told apart from one locked and unlocked early the same day (fresh eyes): D5's "never an errand" holds even once an un-ticked item makes it ready, and Unlock early makes one on any day (D6). The errand (id `list:<list id>`, lists.js `keepErrands`) is made stamped `u` 0, "never changed", and what the mirror changes is stamped when the list changed (just after the errand's own last change, if later), not now: a device that hadn't synced yet made the errand afresh, or mirrored a list done elsewhere, and outranked a deletion or an edit made meanwhile (fresh eyes, twice; a three-device test now covers it); two fresh copies settle the same way everywhere (`newer`'s tie). It's kept in step from `touch`, `init`, a new day's `onTick`, `onReload`, `afterSync` (saving what it made) and, beyond the plan's list, `importBackup` (else a backup's ready list had none until the next start). The mirror also follows a done list's day when the two differ (after a sync), and an errand the list reopens, its day passed, is due this Sunday again (an item un-ticked weeks later brought it back overdue; the errand's own ✓ taken back keeps its day, as any errand's undo). "Buy <topic> at <store>" is cut at a word's end with "…" past 60, not mid-word (`cleanLine`); a list id over 35 characters (from a file only) makes none (the errand's id would be cut to 40 and lose its list). The errand's ✓ goes through `tickAll` (ready lists only, else it ticks the errand alone); taken back, `unbuy(l, the errand's day)`, or the items bought last when none was that day (the list done by taking its last item off: fresh eyes); one save. "Open in Hawky" on it shows the list while the list is there (the lists' Done fold opened, enough shown, for a done one), else the errand as before. The ready card's line sits after Tick all; the pop-up's says "For the Shoes list at REI: ✓ buys the list." only while the list is ready (fresh eyes), else just "For the … list at ….", and wraps a long name. The footnote's "nothing goes to Momo" went, as did the root map's "not in Momo"; bugState counts the lists' errands. The changelog is in the owner's words (the closer: "waiting period", "completes", "checks off"; Bought "not locked yet"; ✓ again undoes it); no reload note (nothing new is stored). Tests: a new `tests/hawky-lists.test.js` (Bought; the errand through a week's wait, Momo's task and its card's Open in Hawky, ✓ and back by the day, Tick all, an un-tick, the last item taken off and the ✓ taken back, the list deleted; a backup's ready lists: Unlock early on a later day and on the day, a Bought list un-ticked, long names, a reload, Export, two devices where a late copy never undoes a deletion or an edit, the errand deleted; three devices syncing late) and the plan's helpers in `tests/hawky.js` (`listCard`, `pressList`, `tickItem`, `doneLists`, plus `cardOf`, `tickErrand`); the fake clock moves the week (`fastForward`), not time travel, where a reload follows (test mode keeps nothing). Helpers ran on Sonnet (the owner's choice for this phase): a scout, three checklists, two fresh eyes and a second pass on the fixes, the closer. Judged and kept: a list deleted on one device and changed on another before they sync may come back without its errand (the deletion's marker stays; `apps/hawky/CLAUDE.md` says so); the errand's words are set once (a renamed list's keeps them); "…and Momo" stays while its due day is moved past next week (it reaches Momo when due); Open in Hawky shows the list even once its errand was deleted; a 1-day lock from a hand-edited file reads as Bought (no button makes one; `app.js` says to pick another length should one ever).
- [x] Phase 6 — Pabu: the one you're with, and your anniversary — done 2026-10-09 (Pabu 2.231: the top was 2.131 by then): Set up… (`#pabuSetupBtn`, Bosco's model: Developer Mode closes first) opens `#setupOverlay` (`apps/pabu/setup.js`, new): "— no one" then everyone A to Z, the anniversary's month · day · optional year, off while no one is picked. Beyond the plan: picking someone shows *their* anniversary as kept (none but the partner's), so naming a new partner never carries the last one's date over; left untouched, a kept date is kept as it came (as the birthday's). Save makes the one picked the partner, clears both from everyone else, stamps only those changed; nothing changed just closes; someone deleted meanwhile, the editor's alert. `readBirthday` became `A.readDayFields(month, day, year, word, say)` (`say`: Set up marks its own fields and says why above its Save; "The year should be from 1900 to …" for the anniversary, "year born" kept for the birthday). The anniversary counts only on the partner (`anniversaryOf`); the date helpers take the kept value (`dayIn`, `nextDay`, `yearsSince`), `birthdayIn` / `nextBirthday` / `ageOn` and their anniversary twins thin wrappers. The heart after the name follows a no-break space (never wraps alone), labelled "Your partner"; "♥ Oct 4 · 5 years" under the 🎂 line, labelled "Anniversary"; the strip's row starts with the heart, sorted with the birthdays by day (a birthday first on the same day), its heading `#bdayTitle`. Momo gets "Our anniversary" (`anniv:<id>:<year>`, note "5 years · Mom") beside the birthday: distinct keys on one day (checked by hand). `partner` and `anniversary` sit after `birthday` in a person (`cleanPeople`, quick add, Delete's marker, `gen.pabuCircle`, so Export still gives back what came in); an older copy's save with the same `u` loses the tie (`"partner":true` sorts after `false`), so ours writes back once and settles. bugState "- Partner: set/none; anniversary: yes/no". Tests: a new `tests/pabu-setup.test.js` (`pabu-people.test.js` was already 412 lines): from Developer Mode (no one, fields off), what Save can't take, Mom on Oct 4, 2021 (her heart and line, the strip, Export, only her stamped), Momo's Sunday heading, Set up as kept, Dad shows none and Mom hers again, Esc asks and Cancel doesn't, Dad with no date, no one, then on the day ("today", ✓ on the board once talked); backups (an older one: no one; a damaged one: "yes" isn't true, an impossible day dropped, a marker keeps neither; no one left: only "— no one", Save just closes); `tests/pabu.js` gained `openSetup`, `setup`, `fillSetup`, `saveSetup`, `cancelSetup`, `setupOpen`, `stripTitle`, its `people()` / `birthdays()` read the heart as "♥"; pabu-people.test.js's three exact-shape checks gained the two fields. No helper agents this phase (the owner's call, 2026-10-09): the checklist, fresh eyes and closer were done by hand against the plan's lists, nothing found beyond the tie above.

## Decisions (the architect's, 2026-10-08; the executing model adds its own small ones under Status)
- **D1 — F1: Delete lives in a report's edit view, not on every row.** Tap a report (it opens for editing, as now), and a
  Delete button sits beside Save and Cancel; one question, then it's a marker, gone from every device once they sync.
  Minimal: the list gains nothing. This reverses the owner's 2026-10-05 "no Done per item" only this far: Clear stays the
  way to empty the log; a Done ✓ per item isn't coming back.
- **D2 — F2: where a preference lives.** A preference that should be the same on every device travels **with its app's
  own data** (its `A.data.build()`: Bosco's start-up answers, Phase 3). A preference of **core's** travels in **the hidden
  Kyoshi app's record** (`core/record.js`, already the catch-all the owner describes: never shown, synced and backed up
  as an app's data), under a key of its own, `prefs`. A device's own things stay on the device: the last app open,
  Developer Mode, a session in progress, Momo's Later, Wan Shi Tong's folds, the Bug / Feature request pick. **The theme
  is the one core preference that syncs** in Phase 1 (assumption 1); the rule goes into the root `CLAUDE.md`.
- **D3 — F3: the progress image only.** The page's chart already draws straight lines between the weigh-ins, and the
  owner likes it as it is (2026-10-08): it doesn't change. The progress image (`image.js`) draws a smoothed curve through
  them: it becomes straight segments between visible points, keeping its soft fill (assumption 5).
- **D4 — F4: movies lose the info box; TV's reads "Year".** A movie's Director and Year are its own fields, so its "Year or
  director" box goes. TV/Anime's "Year or where to watch" box stays as **"Year"** (the owner struck "where to watch", not
  the year; assumption 4). What an older movie or TV item already holds in `info` is never dropped: it shows under the
  name as now, and its pop-up shows the box, labelled **"Note from before"**, only while it holds something, so it can
  be moved into Director / Year or cleared. No example placeholder anywhere in the pop-up.
- **D5 — F5: Bought, one tap and a question.** An open list's card gets **Bought** beside Lock 30 days / Lock 7 days: "Mark
  all 3 items bought, without the cooling-off wait?" → every item bought today, the list done today. Nothing new is
  stored: the list is recorded as locked and unlocked early the same day (`lock` + `unlocked`), so `stateOf`, the Done
  fold and un-ticking an item (ready again) all work as they do. A list bought this way never makes an errand (D6).
- **D6 — B1: a ready list's errand, the link being the id.** When a list's wait is over (its lock ran out, or Unlock early),
  Hawky makes one errand for it: id **`list:<list id>`** (the same on every device, so two devices make one errand, not
  two; the id is the link, no new field), text "Buy <topic> at <store>", due this Sunday, 30 minutes (assumption 2). The
  errand mirrors its list: open while the list is ready, done on the list's done day once every item is bought (Tick all
  included), open again if an item is un-ticked; ✓ on the errand buys the list (every item bought today); ✓ again
  un-buys that day's items and the list is ready again. Deleting the list deletes its errand; deleting the errand leaves
  the list alone and no new one is made (the marker keeps the id). Momo needs nothing: the errand is a card of its own
  there like any errand, and "Open in Hawky" shows the list. Lists done without ever being ready (Bought, or done before
  this version) get no errand.
- **D7 — B2: minutes per routine, used everywhere Momo asks.** Each routine gets `minutes` (5–300, 60 until typed), in
  its pop-up under its name. Momo's cards take it for the week's planned workouts **and** for logged sessions (a session
  logged after the fact has no honest clock time; assumption 6); the session's own time stays in the card's details
  ("took 42 min") and in Badgermole's own views. The five-session estimate goes.
- **D8 — F6: the partner and the anniversary live on the person, set in a Set up pop-up from Developer Mode.** Two
  fields on a person: `partner: true` (at most one, by construction of the pop-up: picking someone clears the last) and
  `anniversary` ("", "MM-DD" or "YYYY-MM-DD", the birthday's shape and cleaner). The pop-up is Pabu's "Set up…" in its
  Developer Mode tools (Bosco's "Edit start-up info" is the model): who, and the anniversary as month · day · optional
  year. Nothing asks for the owner's name. Shown: a small rose heart (Lucide `heart`) after the partner's name on People,
  with the next anniversary and the years ("Oct 12 · 5 years", like "🎂 Oct 12 · turns 60"); in the strip when it's
  within 30 days (the heading reads "Birthdays & anniversary" while one is set); and on Momo's board as an event on its
  day, "Our anniversary", like a birthday, ✓ once you talked with them that day.
- Assumptions, each one line to change if wrong:
  1. F2: the theme you pick on one device is the theme on all of them (if the phone should keep its own, Phase 1 leaves `theme` out of `prefs` and nothing else changes). *(Phase 1)*
  2. B1: a ready list's errand is due this Sunday (quick add's own default) and takes 30 minutes; both can be changed in the errand's pop-up like any errand's. *(Phase 5)*
  3. F6: "5 years" shows only when the anniversary's year is given, as a birthday's age does. *(Phase 6)*
  4. F4: TV/Anime keeps one optional box, "Year" (set `tv.info` to "" in `CATS` for none, as the movie's). *(Phase 4)*
  5. F3: the progress image keeps its soft blue fill under the line; the dots are the weigh-ins, the last one bigger as now. *(Phase 3)*
  6. B2: a logged session's card in Momo is as long as its routine says, not as long as the session ran. *(Phase 2)*
  7. F2: Bosco's own display choices (rate mode, the trend and average windows) stay as they are: not stored, 7 on every load, by the owner's earlier choice. *(Phase 3)*

## Versions when planned
Kyoshi 5.170 · Bosco 7.500 · Wan Shi Tong 2.472 · Hawky 2.230 · Badgermole 2.221 · Pabu 2.121. Work each bump out from the
app's top changelog entry when you get there (phases may run out of order).

---

## Phase 1 — core: a report can be deleted; the theme follows you through the hidden Kyoshi app (Kyoshi +0.100 → 5.270)
Closes F1 and core's part of F2 (D1, D2, assumption 1). Core only, plus the root `CLAUDE.md` and three test files.

**Read first:** `core/bugs.js` (whole: `editing`, `edit`, `leave`, `saveEdit`, `setMode`, `unsaved`, `init`), `core/record.js`
(whole: `marker`, `save`, `clean`, `combine`, `hasData`, `init`), `core/shell.js` lines 1–45 (`K.register`, `changed`) and
203–213 (`applyTheme`, `setTheme`, `initTheme`), `core/storage.js` lines 1–20 and 59 (`PREFS`: `kyoshi.theme` stays a
localStorage preference), `index.html` lines 156–169 (`#kBugOverlay`: `.modal-actions` holds Submit and Cancel) and the
header's `#kThemeToggle`, `core/kyoshi.css` lines 155–156 (`.modal-actions`, `.spacer`) and 165–175 (`.bug-*`),
`tests/shell.test.js` (the two Bugs & requests tests, ~lines 140–230: `stored`, `rows`), `tests/cloud.test.js` lines 1–50
(`computerWithCloud`, `phoneWith`) and the test "cloud: Bugs & requests" (~lines 450–525: `data/kyoshi.json`, `exportAll`),
`tests/cloud.js` exports (`syncNow`, `settled`). Scout: `core/record.js` and `core/bugs.js` line ranges for the names above.

### 1.1 Delete a report (F1, D1)
- `core/record.js`: `remove(id)` → the live report with that id becomes `marker(r, Date.now())`, `save()`, true; false once
  it's gone already (cleared or deleted elsewhere). Export it on `K.record`. The header comment's "Clear turns each report
  into a marker" gains "so does Delete, one at a time".
- `core/bugs.js`: a **Delete** button, `#kBugDelete` (`class="danger"`, after a `<span class="spacer"></span>` in
  `#kBugOverlay`'s `.modal-actions`, `hidden` in submit mode like `#kBugCancel`; `setMode` shows it only while `editing`).
  Click → `confirm(\`Delete this ${appName(r.app)} ${isRequest(r) ? "request" : "bug"} from ${dayOf(r.timestamp)}? It goes from
  every device once they sync, and can't be undone.\`)` → `K.record.remove(editing.id)` → `leave()` → status "Deleted." (good),
  or "That report was cleared meanwhile." (bad) when `remove` returned false. The question comes first, before any
  "discard your changes?" (there's nothing of the owner's to keep: the words in the box are the report's). The header
  comment: "Nothing is ticked off one by one" → "A report opened for editing can be deleted (Delete beside Save); the
  rest wait until the owner sits down to plan…". The list's rows change nothing (the shell test's "nothing to tick off
  one by one" check still holds: Delete isn't in `#kBugList`).
- Changelog: "Bugs & requests: a report opened from the list can be deleted (Delete beside Save, after a question); it
  goes from every device once they sync."

### 1.2 The theme follows you (F2's core part, D2, assumption 1)
- `core/record.js` keeps a second thing beside the log: **`prefs`**, `{ theme: "" | "light" | "dark", u }` (`u` 0 until the
  owner picks one), in its own store key `prefs` (`R.store`), carried in the save as `prefs` beside `bugReports`
  (`build()`), cleaned (`cleanPrefs(raw)`: a known theme word or "", `u` a positive number or 0; `{ theme: "", u: 0 }` when
  the save has none: older copies), combined **whole by `u`** (the later wins; equal `u` → the JSON-larger, as `newer`
  does for reports) in `combine` (`same` and `apply` compare prefs too), taken from a backup in `importBackup`,
  `hasData()` true when `prefs.u > 0` as well. `K.record.pref(name)` reads one; `K.record.setPref(name, value)` sets it
  with `u = Date.now()` and `save()` (test mode: kept and `pending`, as the log is). `applyPrefs()`: when `prefs.theme`
  is a theme word and differs from `document.documentElement.dataset.theme`, `K.setTheme(prefs.theme)` (below) — called
  from `load` (after the carry-over), `afterSync`, `importBackup` and `onReload`. Header comment: the record now holds
  the log and `prefs`; the save `{ schemaVersion: 1, appVersion, bugReports, prefs }`.
- `core/shell.js`: expose `K.setTheme = setTheme` (applies and writes `kyoshi.theme`, as now: the page still draws from
  localStorage at start, with no flash and no dependence on the record). The toggle's click handler does
  `setTheme(next); K.record.setPref("theme", next)`. `initTheme`'s first-load guess by the hour is **not** a pick: it
  doesn't touch `prefs`. Another tab's `storage` event keeps applying as now (harmless beside `onReload`).
- Root `CLAUDE.md`, under Rules for app code → Storage, one sentence (D2): "A preference that should be the same on
  every device goes with its app's data (its `A.data.build()`); core's go in the hidden Kyoshi app's record
  (`core/record.js`, `prefs`: the theme); a device's own things (the last app open, Developer Mode, a session in
  progress, Momo's Later, the folds, the Bug / Feature request pick) stay on the device." And the map's `record.js`
  line: "…holding the bug log and core's synced preferences (the theme)".
- Changelog: "The theme you pick follows you to your other devices (through cloud sync, the sync folder and Export all,
  kept in Kyoshi's own record); a device that never picked one keeps its own until you do."

### Docs & tests
- `tests/shell.test.js`: in the editing test (or a third small one): open a report from the list → Delete is visible;
  `lastDialog` holds "Delete this Hawky request from <TODAY>?"; after Yes the list is empty, the footer link reads "Bugs &
  requests", the status says "Deleted.", `stored(p)` holds one marker (`deleted: true`, no words); in submit mode Delete
  is hidden. Answer No once (`tab.answers.push(false)`) → the report stays.
- `tests/cloud.test.js`, a new test with the fake GitHub: the computer taps `#kThemeToggle` → `data-theme` flips; after
  the phone's check (`cl.syncNow` / `cl.settled`, as the neighbouring tests wait) the phone shows the same theme and its
  localStorage `kyoshi.theme` agrees; the phone taps → the computer follows at its next check; `data/kyoshi.json`
  decrypted holds `prefs.theme`; Export all holds `apps.kyoshi.prefs`. A fresh profile that never tapped keeps its own
  theme until a synced pick arrives.
- Root `CLAUDE.md` as above; `core/record.js` and `core/bugs.js` headers.

**Haiku asks (fresh eyes):** a device whose log is empty but whose `prefs.u > 0`: does `hasData` make its file go up and
come down as intended, and does a cleared log still travel? Can `applyPrefs` and the `storage` event fight (a loop) when
two tabs are open? Does `importBackup` in test mode leave prefs alone as it leaves the log? Is the Delete question
reachable by keyboard from the row (focus order)?

---

## Phase 2 — Badgermole: how long each routine takes, typed (Badgermole +0.100 → 2.321)
Closes B2 (D7, assumption 6). Badgermole only (Momo reads the minutes through `share.js`, unchanged in shape).

**Read first:** `apps/badgermole/CLAUDE.md`, `app.js` lines 40–60 (`DEFAULT_MINUTES`, `ESTIMATE_RUNS`,
`MAX_SESSION_MINUTES`) and 86–101 (`wholeIn`, `fmtMinutes`, `niceMinutes`), `data.js` lines 40–64 (`cleanItems`,
`cleanRoutines`, `clampInt`), `stats.js` lines 34–41 (`sessionMinutes`, `usualMinutes`), `share.js` (whole: `doneNeed`,
`plannedNeed`), `editors.js` lines 89–200 (the routine pop-up: `rtState`, `openRoutine`, `saveRoutine`), `markup.js` lines
139–161 (`#routineOverlay`), `render.js` lines 29–50 (`nextUpHTML`'s "usually") and ~100–106 (the Routines fold's rows),
`day.js` (grep `sessionMinutes`: the day pop-up keeps the clock time), `tests/badgermole.js`, `tests/badgermole-setup.test.js`
lines 1–45 (`addRoutine`), `tests/badgermole-momo.test.js` lines 1–45 (`both`, `workouts`), `tests/generate.js` `setup` /
`ROUTINES` (lines 15–60). Scout: `editors.js` and `render.js` for the names above; `grep -n "usualMinutes\|ESTIMATE_RUNS\|niceMinutes" apps/badgermole tests`.

### 2.1 Data
- `routines[]` gain **`minutes`**: a whole number from `MIN_ROUTINE_MINUTES` 5 to `MAX_SESSION_MINUTES` 300,
  `DEFAULT_MINUTES` (60) when missing or unusable (`cleanRoutines`: `clampInt(r.minutes, 5, MAX_SESSION_MINUTES,
  DEFAULT_MINUTES)`; a deleted marker keeps none). Backups and sync carry it (routines merge whole by `u`, so nothing else
  changes); `schemaVersion` stays 1; the changelog says to reload on every device (an older copy drops it: the card goes
  back to 60 until the routine is saved again here).

### 2.2 The pop-up (`markup.js`, `editors.js`)
- Under Name, a field **"How long it takes (minutes)"**: `#routineMinutes`, `type="number"`, `min` 5, `max` 300, `step` 5,
  `inputmode="numeric"`, with a short `.modal-hint` line: "Momo makes its cards this long." `openRoutine` fills it with
  `r.minutes` (60 for a new routine); `rtState` includes it (the discard question); `saveRoutine` reads it with
  `wholeIn(value, 5, MAX_SESSION_MINUTES)` and refuses with `alert("How long does it take? From 5 to 300 minutes.")`
  (the field focused) before the lines are checked; the saved routine carries `minutes`.

### 2.3 What uses it (`share.js`, `render.js`, `stats.js`)
- `share.js plannedNeed`: `minutes: r.minutes`. `doneNeed`: `minutes: the session's routine's minutes` (`A.routineById(s.routineId)`,
  live) else the session's clock minutes when known, else `DEFAULT_MINUTES`; details become `["6 exercises", "took 42 min"]`
  (the clock time, when known; D7). The header comment: "as long as its routine says".
- `render.js`: Next up's "usually 45 min" becomes the routine's "45 min" always (`fmtMinutes(r.minutes)`), and so does the
  Routines fold's row meta ("3 exercises · 45 min"); nothing reads `usualMinutes` any more → remove it and `ESTIMATE_RUNS`
  (and `niceMinutes` only if the grep finds no other reader; `sessionMinutes` stays: the day pop-up and the details use it).
- `bugState`: nothing new (counts only). `backupNote` unchanged.
- Changelog: "Each routine has how long it takes, typed in its pop-up (60 minutes until you do): Momo's workout cards are
  that long, planned and logged alike, instead of an average of the last sessions' clock times. Reload on every device
  after updating: an older copy drops it."

### Docs & tests
- `CLAUDE.md`: State (`routines[].minutes`), Shared (`minutes` on both needs), Invariants (the estimate is gone; "took"
  in details), the file table (`stats.js`, `editors.js`).
- `tests/badgermole-setup.test.js`: `addRoutine` takes `minutes` (fills `#routineMinutes`; left out → 60); a routine saved
  with 45 reads "Upper · 3 exercises · 45 min" in the fold and Next up says "45 min"; 4 or 301 is refused with the alert;
  Export carries `minutes`; `gen.setup()`'s older routines (no `minutes`) import with 60.
- `tests/badgermole-momo.test.js`: a routine set to 45 minutes → its task in Momo is 45 minutes (`momo.tasks`' hours) and a
  session logged for it shows a 45-minute card with ✓ whose details say "took <n> min".

**Haiku asks:** does any test or `tests/sim` read "usually" or `usualMinutes`? Is a routine from a newer version with
`minutes` outside 5–300 clamped, not dropped? Does the session screen or the day pop-up still show the clock time?

---

## Phase 3 — Bosco: the progress image in straight lines; start-up answers travel with the data (Bosco +0.100 → 7.600)
Closes F3 and Bosco's part of F2 (D2, D3, assumptions 5 and 7). Bosco only; the page's chart isn't touched.

**Read first:** `apps/bosco/CLAUDE.md`, `image.js` lines 1–31 (the header, `tracePath`) and 96–121 (the curve, the fill, the
end dot), `data.js` lines 36–68 (`normalizeBackup`), 126–169 (`load`), 174–212 (`buildBackup`, `applyBackup`), 243–287
(`mergeVersions`, `dataKey`, `combine`), `setup.js` lines 12–39 (`renderOneTimeInfo`: line 20 reads `dosingAsked`) and
250–289 (`saveOneTimeInfo`: lines 262–268 set the asked flags), `app.js` lines 68–70 (`DOSING_QUESTIONS_VERSION`),
`events.js` lines 209–225 (`bugState`), `tests/bosco-doses.test.js` (the start-up info and import checks),
`tests/bosco-goals.test.js` lines 1–20 (a model for the image check), `tests/generate.js` `bosco()` (line 307). Scout:
`data.js` for the line ranges above.

### 3.1 The progress image: straight lines, points you can see (F3, D3)
- `image.js tracePath`: `moveTo` the first point, then `lineTo` each next one (the midpoint-quadratic curve goes; the
  function's comment too). The fill stays (assumption 5). After the stroke, a dot at **every** weigh-in: radius 5, filled
  `ACCENT`, a 3 px white stroke (as the end dot has), the last one radius 7 as now; with hundreds of weigh-ins the dots
  overlap on the image's 1080 px width, which is fine (they read as a beaded line). The file's header ("a minimal
  weigh-in curve") follows.
- The page's chart (`render.js renderChart`, `bosco.css`) is **not** touched: the owner likes it as it is.
- Changelog: "The progress image draws straight lines between the weigh-ins, each a point you can see, instead of a
  smoothed curve."

### 3.2 Start-up answers travel with the data (F2's Bosco part, D2)
- Why the sites were asked again: `profile.dosingAsked` (the dosing questions' version answered) and
  `profile.medicationAsked` live in `profile` but not in the backup, so a second device, having received the sites by
  sync, still asked. They join the save as **`asked: { medication: true|false, dosing: 0–99 }`**:
  - `buildBackup`: `asked: { medication: !!S.profile.medicationAsked, dosing: S.profile.dosingAsked || 0 }`.
  - `normalizeBackup`: `asked: cleanAsked(raw.asked)` → `undefined` when the file has none (older copies), else
    `{ medication: raw.asked.medication === true, dosing: a whole number 0–99 else 0 }`.
  - The join is **monotone** (once asked anywhere, asked everywhere; the version only grows), so no `u` is needed:
    `applyBackup(clean)`: when `clean.asked` is defined, `medicationAsked = ours || theirs`, `dosingAsked = max(ours,
    theirs)` (an older file leaves ours alone); `mergeVersions`: the same join of the two (one undefined → the other);
    `dataKey` includes `asked`; `combine`'s `kept` carries ours when `next.asked` is undefined. The import's own
    "doses prove a medication" rule (lines 208–211) stays.
  - `afterSync` and `importBackup` already call `renderOneTimeInfo()`, which hides the dosing box once
    `dosingAsked === DOSING_QUESTIONS_VERSION`; `saveOneTimeInfo` still sets the flags here (line 266–268) and a save
    counts for sync as any does. When a later version bumps `DOSING_QUESTIONS_VERSION`, the first device to answer
    answers for all (max wins).
- `bugState`: "Start-up asked: medication yes/no, dosing v4" (numbers only).
- Changelog: "Start-up info's answers travel with your data: once you've answered it on one device (your sites, your
  medication), your other devices don't ask again."

### Docs & tests
- `CLAUDE.md`: Storage and backups (`asked`, its join), Invariants (the progress image: straight lines between the
  weigh-ins, a dot each; the answers travel).
- `tests/bosco-doses.test.js`: (a) the computer answers start-up info (sites changed, dosing answered), Export → a fresh
  profile importing that file shows no dosing box (`#dosingBox` hidden, `#oneTimeInfoSection` as the import leaves it) and
  Export from it carries `asked` with `dosing: 4`; (b) a backup from before (`gen.bosco()`, no `asked`) imported over an
  answered profile leaves the answers; (c) combine (as the sync test does, `page.evaluate` on `A.data.combine`): one save
  with `dosing: 4` and one with none → 4.
- `tests/bosco-goals.test.js` (or the doses test): the image draws without error with the goals fixture and with a single
  weigh-in (`page.evaluate(() => Kyoshi.apps.bosco.drawReport(Kyoshi.apps.bosco.model()).width)` → 1080); the page's
  chart checks stay exactly as they are.

**Haiku asks:** is every read of `profile.dosingAsked` / `medicationAsked` still consistent with the join (a device with
`dosing: 4` taking a `replace` save with `dosing: 0`: does it keep 4)? Does `applyBackup` with `backupUnit` still answer
Units first? Does the image draw with one weigh-in (two points needed for a line)?

---

## Phase 4 — Wan Shi Tong: no "Year or director" box for movies, no examples, TV's box reads "Year" (Wan Shi Tong +0.100 → 2.572)
Closes F4 (D4, assumption 4). Wan Shi Tong only.

**Read first:** `apps/wanshitong/CLAUDE.md`, `app.js` lines 25–36 (`CATS`, `OTHER`: `info`, `nameEg`, `infoEg`), `editor.js`
(whole: `FIELDS`, `renderCatFields`, `openEditor`, `saveItem`), `markup.js` lines 31–80 (`#itemOverlay`: the fields and their
placeholders on lines 46, 50, 66), `render.js` lines 12–21 (`nameLine`), `tests/wanshitong.js` (`BOX`, `editor()`),
`tests/wanshitong.test.js` (whole), `tests/sim/acts.js` (grep `wanshitong` / `itemInfo`: whether the simulator fills a
movie's info).

### 4.1 The categories and the pop-up
- `app.js CATS`: `movie.info` becomes `""` (no box); `tv.info` becomes `"Year"`; `nameEg` and `infoEg` go from every entry
  and from `OTHER`. `markup.js`: the `placeholder` attributes on `#itemDirector`, `#itemYear` and `#itemWhy` go; the info
  field's `.field` gets `id="itemInfoField"`.
- `editor.js renderCatFields`: the two placeholder lines go. The info box shows when the category has an `info` label
  **or** the item being edited holds `info` (an older movie's "Miyazaki, 2001"; the add form never does): then its label
  is the category's, or **"Note from before"** when the category has none; otherwise `#itemInfoField` is hidden.
  `saveItem`: `info` is read from the box only while it's shown, else `""` (so a new movie writes "", an older one keeps
  or clears what it had, and text typed under Book then switched to Movie is left out, as Director and Year are for
  non-movies). Add another: the box follows the category as now (hidden for a movie).
- `render.js nameLine` needs nothing: with `info` "" a movie shows "Director, Year" alone; a TV item shows its year as it
  showed its info. `searchUrl` needs nothing.
- Changelog: "Movies no longer have a “Year or director” box (Director and Year are their own); TV/Anime's box asks for
  the year only; a note an older movie or show already holds still shows under its name, and its pop-up shows it as
  “Note from before” until you move or clear it. The pop-up no longer shows example movies in its boxes."

### Docs & tests
- `CLAUDE.md`: State (`info`: books' and games' details, TV's year; a movie's only from before 2.572, shown until
  cleared), the pop-up's rules.
- `tests/wanshitong.js editor()`: add `infoShown` (the box's `.field` not hidden) and `placeholders` (the count of
  `[placeholder]` inside the pop-up). `tests/wanshitong.test.js`: on Movie the box is hidden and the add has no
  placeholders; on TV it shows as "Year"; on Book "Author or edition"; an older movie imported with `info`
  (`gen.library`, items in the pre-2.472 shape) opens with the box shown, labelled "Note from before", the line under
  its name as before; clearing it and saving drops it from the line and the box hides next time; a new movie saved writes
  `info: ""`.

**Haiku asks:** does `tests/sim` or any test fill `#itemInfo` for a movie (it would now type into a hidden box)? Does the
"already on your list" question still find a movie by name? Is `#itemInfoLabel` still a `label for` the box (a11y)?

---

## Phase 5 — Hawky: Bought without the wait; a ready list's errand, each completing the other (Hawky +0.100 → 2.330)
Closes F5 and B1 (D5, D6, assumption 2). Hawky only; Momo reads the new errand through `share.js` as any errand.

**Read first:** `apps/hawky/CLAUDE.md`, `lists.js` (whole: `stateOf`, `settle`, `touch`, `gone`, `lockList`, `unlockEarly`,
`tickItem`, `tickAll`, `deleteList`), `lists-view.js` lines 48–84 (`stateWords`, `cardHTML`) and 246–265 (`ACTS`, `onTap`),
`events.js` (whole: `tick`, `ACTS`, `A.init`, `onTick`, `onReload`), `data.js` lines 24–43 (`cleanItems`: ids ≤ 40 characters,
markers keep theirs) and 150–154 (`afterSync`), `share.js` (whole), `render.js` lines 34–49 (`errandHTML`), `editor.js`
(the errand pop-up: `openEditor`, the note line under the fields), `markup.js` (the Shopping view: `#listsView`, the Done
fold's ids, the footnote on line 81), `app.js` lines 24–43 (constants) and 92 (`sundayOf`), `hawky.css` lines 65–100
(`.slist*`, `.slist-actions`, `.warn-btn`) and the phone block (~110–115), `core/sync.js` lines 79–86 (`changed`: a save
from `afterSync` only marks and schedules), `tests/hawky.js`, `tests/hawky-errands.test.js` (the shopping test),
`tests/momo.js` (`tasks`, `days`), `tests/momo-week.test.js` lines 1–45 (how Hawky's errands reach Momo in tests). Scout:
`lists-view.js`, `editor.js` and `markup.js` for the names above.

### 5.1 Bought, without the wait (F5, D5)
- `lists.js`: `buy(l, day)`: every live item not bought → `bought = day`; `done = day`; `touch(l)`. `tickAll(l)` keeps its
  "ready" check and then calls `buy(l, today)`. **`buyNow(l)`** (open lists only, else false): `lock = { at: today, days:
  LOCK_DAYS[LOCK_DAYS.length - 1] }`, `unlocked = today`, then `buy(l, today)` — recorded as locked and unlocked early the
  same day, so no new field, `stateOf` reads done, and un-ticking an item in Done makes it ready as for any done list.
  `unbuy(l, day)`: every item with `bought === day` → `""`; `done = ""`; `touch(l)` (for the errand's undo, 5.2).
- `lists-view.js cardHTML`: an open list's actions gain a third button, **Bought** (`class="secondary"`,
  `data-act="list-bought"`), after the two locks; `ACTS["list-bought"]`: `confirm(\`Mark ${n === 1 ? "the item" : \`all ${n}
  items\`} on this list bought, without the cooling-off wait? The list moves to Done.\`) && A.buyNow(l)`. On a phone the
  three buttons wrap onto two lines (the phone block already sizes `.slist-actions button`); check they do.
- `markup.js`' footnote (line 81) gains "…or tap Bought for something you bought without the wait." The header comments of
  `lists.js` and `lists-view.js` follow.
- Changelog: "A shopping list can be marked Bought without the 30- or 7-day wait (a question first): every item bought
  today, the list into Done."

### 5.2 A ready list's errand (B1, D6)
- `app.js`: `LIST_ERRAND_MINUTES: 30`, `LIST_ERRAND: "list:"` (the id prefix; the link between a list and its errand).
- `lists.js keepErrands(today = todayStr())` → whether anything changed (the caller saves):
  - for each active list in state **ready** with no errand whose id is `LIST_ERRAND + l.id` (live **or marker**: `S.items`,
    not `itemById`), push `{ id, text: cleanLine(\`Buy ${l.topic} at ${l.vendor}\`, MAX_TEXT), note: "", due: sundayOf(today),
    minutes: LIST_ERRAND_MINUTES, done: "", postponed: 0, deleted: false, at: now, u: now }`;
  - for each live errand whose id starts with `LIST_ERRAND`: its list is `S.lists.find` by the rest of the id (deleted
    lists too); the list gone, deleted, or **never found** → the errand becomes a marker (as `editor.js`' Delete makes
    one); the list done and the errand open → `done = l.done`; the list ready and the errand done → `done = ""`; each
    with `u = Date.now()`. A list that's open or locked with an errand (a sync oddity) leaves the errand as it is.
  Called where a list can change state: at the top of `touch` (every list change, before its save), in `events.js`
  `A.init` (after wiring, before the first draw: `if (A.keepErrands()) A.save()`), in `onTick` when the day changed (a lock
  runs out at midnight), in `onReload`, and in `data.js afterSync` after `persist()` (a save from there is fine: `K.sync.changed`
  only marks and schedules, and the other device makes the same id, so the two converge in one round). Test mode: `A.save`
  no-ops as everywhere.
- `events.js tick(id, done)`: for an id starting with `LIST_ERRAND` whose list is live: done → `A.buy(l, today)` after
  setting the errand; undo → `A.unbuy(l, the day the errand was done)` after clearing it; one save for both (the `touch`
  inside `buy` / `unbuy` saves: skip `kept`'s own save, or let `touch` not save when told; your call, one save). The
  status line: "Bought the Running shoes list at REI." / "The Running shoes list at REI is ready again." (`setStatus`).
- `share.js open(id)`: an id starting with `LIST_ERRAND` → `S.view = "lists"`, `renderAll`, the list's card
  (`.slist[data-id]`) scrolled into view and flashed (a `.slist.flash` rule in hawky.css, as `.errand.flash`); a done list's
  fold opened first (`A.$("listsDoneBox").open = true`, as `doneBox` is for a done errand; `S.listsDoneShown` raised to
  reach it, as `doneShown` is). `inbox` needs nothing.
- `lists-view.js cardHTML`: a **ready** list whose errand is live and open shows one muted line in its actions row (the
  `.slist-lock` style): "Its errand waits in Errands and Momo." `editor.js openEditor`: an errand of a list shows a muted
  line under the fields (a sibling of `#errandPostponedNote`, markup.js ~line 117): "For the Running shoes list at REI:
  ✓ buys the list." (the list named while it's live, "For a shopping list" once gone).
- `CLAUDE.md`: Invariants (the link by id, the mirror both ways, who makes it and when, no errand for Bought or older done
  lists), Shared ("Shopping lists are never shared" → "…except through a ready list's errand, an errand like any other"),
  Not now (drop "anything sent to Momo from the lists"). The `share.js` and `lists.js` headers.
- Changelog: "When a list's wait is over, Hawky adds an errand for it (“Buy Running shoes at REI”, due this Sunday, 30
  minutes), a card of its own in Momo like any errand: ✓ on the errand buys the whole list, and the list bought item by
  item ticks the errand; “Open in Hawky” shows the list."

### Docs & tests
- `tests/hawky.js`: `listCard(tab, topic)` → `{ state, actions: [button words], note }`, `pressList(tab, topic, act)`,
  `tickItem(tab, topic, text)`, `doneLists(tab)`.
- `tests/hawky-errands.test.js` (or a new `tests/hawky-lists.test.js`, helpers shared): (a) Bought on an open list of two
  items: the question's words (`lastDialog`), both bought today, the list in Done reading "done today", `lock` and
  `unlocked` both today in the kept list, no errand made; un-tick one in Done → ready, the Lock buttons gone, Tick all there;
  No keeps it open. (b) a list locked 7 days → `travel(tab, 7)` → ready, and an errand "Buy Shoes at REI" in This week with
  `30m`, id `list:<id>`, with the pop-up's line; in Momo (`switchTo`) a task of its own saying "due Sun"; ✓ the errand →
  the list done, both items bought today, the errand in Done; ✓ again → the list ready, the items unbought, the errand
  open; Tick all on the list → the errand done on that day; Delete the list (its pop-up) → the errand a marker and gone
  from the groups; Delete the errand (its pop-up) on another ready list → the list stays ready and no new errand comes
  after a reload. (c) a backup (`gen.hawkyItems` + lists, or `importBackup` with a ready list and no errand) → exactly one
  errand after the import and still one after `p.reload()`; Export carries it as a plain errand.

**Haiku asks:** can `keepErrands` run before `S.lists` is loaded (order of `load`, `init`)? Does `touch` → `keepErrands` →
(no `touch`) avoid recursion? With an errand's text edited by the owner, does the mirror still find its list (by id, not
text)? Is "Buy <topic> at <store>" cut to 60 without splitting a word badly (cleanLine)? Does Momo's "Open in Hawky" for a
done list's errand open the Done fold?

---

## Phase 6 — Pabu: the one you're with, and your anniversary (Pabu +0.100 → 2.221)
Closes F6 (D8, assumption 3). Pabu only; Momo reads the event through `share.js agenda` as a birthday.

**Read first:** `apps/pabu/CLAUDE.md`, `app.js` lines 176–204 (birthdays: `parseBirthday`, `birthdayIn`, `nextBirthday`,
`ageOn`, `fmtBirthday`, `talkedOn`), `render.js` lines 52–63 (`renderBirthdays`) and 82–91 (`personHTML`), `share.js` lines
38–74 (`agenda`, `open`), `editor.js` lines 14–17 (`BDAY`, `FIELDS`), 176–189 (`readBirthday`) and 302–303 (the month's
"—"), `data.js` lines 27–32 (`cleanBirthday`) and 60–78 (`cleanPeople`), `events.js` lines 100–110 (`bugState`; no
`renderDev` yet), `markup.js` lines 68–89 (the birthday's three fields: the model for the pop-up's) and 52–56 (a pop-up's
frame), `pabu.css` lines 17–22 (`.bday*`) and 55–59 (`.person-*`), `apps/bosco/events.js` lines 186–207 (`renderDev`: the
model), `core/dev.js` lines 44–52 (`refreshTools`), `index.html` lines 375–382 (Pabu's scripts), `tests/pabu.js`
(`people`, `birthdays`, `openPerson`, `fill`), `tests/pabu-people.test.js` (one test as a model), `tests/pabu-momo.test.js`
(grep `bday`: how the board shows a birthday), `tests/generate.js` `CIRCLE` / `pabuCircle` (lines 237–261). Scout:
`editor.js` for `readBirthday` and the fields; `tests/momo.js` for how a day's events are read (`days`, grep `event`).

### 6.1 Data
- A person gains **`partner`** (true for the one you're with; false otherwise and on markers) and **`anniversary`** ("",
  "MM-DD" or "YYYY-MM-DD": the birthday's shape, cleaned by `cleanBirthday`, kept as `cleanDay` if you rename it for both).
  `cleanPeople` reads both (missing → false / ""); a deleted marker keeps neither. People merge whole by `u`, backups carry
  them, `schemaVersion` stays 2; the changelog says to reload on every device (an older copy drops them). At most one
  partner by construction of the pop-up (6.2); should sync ever leave two, both show (nothing breaks).

### 6.2 The Set up pop-up (`apps/pabu/setup.js`, new, after `editor.js` in `index.html`; `#setupOverlay` in `markup.js`)
- `events.js A.renderDev = box => …`: one `.dev-block` with a **Set up…** button (`#pabuSetupBtn`) and the hint "Who you're
  in a relationship with, and your anniversary: a heart by their name, in the strip when it's near, on Momo's board." Click
  → `K.dev.toggle()` then `A.openSetup()` (Bosco's model).
- The pop-up (`.modal`, title "Set up"): **"Who are you in a relationship with?"** → `<select id="setupPartner">`: "— no one"
  then everyone live, A to Z (`byName`), the current partner selected; **"Anniversary (optional)"** → month · day · year
  fields exactly like the birthday's (`#setupMonth`, `#setupDay`, `#setupYear`; the month's "—" clears the other two, as the
  birthday's does), disabled while "no one" is picked; a hint "It shows like a birthday: beside their name, in the strip
  when it's within 30 days, and on Momo's board." Save, Cancel; Esc asks "Discard your changes?" when the fields differ
  from how it opened (`K.modal.define` with `pending` / `ask`).
- Reading the date: move the logic of `editor.js readBirthday` into a shared `A.readDayFields(monthEl, dayEl, yearEl, word)`
  (exported from editor.js; `word` "birthday" / "anniversary" in its messages, the `stop` marking as now) and call it from
  both; the editor's behaviour doesn't change.
- Save: the person picked gets `partner: true` and the anniversary read; every other person with `partner` or an
  `anniversary` gets `false` / `""`; only people whose fields change get `u = Date.now()`; "no one" clears all. Then
  `A.save()`, `A.renderAll()`, close. Nothing asks for the owner's name.

### 6.3 Where it shows (`render.js`, `share.js`, `app.js`)
- `app.js`: `anniversaryIn(p, year)`, `nextAnniversary(p, today)` and `yearsOn(p, date)` are the birthday helpers with the
  other field (generalise `birthdayIn` / `nextBirthday` / `ageOn` to take the field, keeping their names as thin wrappers);
  `fmtAnniversary(p, today)`: "Oct 12 · 5 years" / "today · 5 years" / "Oct 12" ("" without an anniversary).
- `personHTML`: the partner's name is followed by a small heart (Lucide `heart`, 12 px, stroke `#f43f5e`, `aria-label`
  "Your partner", `class="heart"`), and a `.person-anniv` line (the `.person-bday` style) with the heart again and
  `fmtAnniversary` when there's a date. One or two lines under a name, as a birthday makes one.
- `renderBirthdays`: the strip lists the anniversary as a row too when it's within `BIRTHDAY_DAYS`, sorted with the
  birthdays by day: the heart, the name, "Oct 12 · in 4 days · 5 years" (`.bday.anniv`); the section's heading reads
  "Birthdays & anniversary" while any live person has an anniversary, else "Birthdays". Tapping the name opens the person
  as now.
- `share.js agenda`: beside each birthday, the partner's anniversary in the range as `{ id: "anniv:<id>:<year>", title:
  "Our anniversary", date, time: null, minutes: 15, note: "5 years · Sam" (the years when known, then their name), done:
  talkedOn(p, date) }`. `open` already takes the person's id from the second part of any id: nothing to change (say so in
  its header). Momo needs nothing: it draws the event as it draws a birthday.
- `bugState`: "- Partner: set/none; anniversary: yes/no" (counts only, no names or dates).
- Changelog: "Set up… in Pabu's Developer Mode tools names the one you're in a relationship with and your anniversary: a
  heart by their name with the date, in the strip when it's within 30 days, and on Momo's board on the day, like a
  birthday. Reload on every device after updating: an older copy drops them."

### Docs & tests
- `CLAUDE.md`: Files (`setup.js`), State (`partner`, `anniversary`), Shared (`agenda`'s anniversary id), Invariants (one
  partner, set only in Set up; the strip's heading), Not now (drop "anniversaries").
- `tests/pabu.js`: `openSetup(tab)` (Developer Mode → Set up…), `setup(tab)` → `{ partner, month, day, year }`,
  `fillSetup(tab, { partner, month, day, year })`, `saveSetup`, `cancelSetup`; `people()` includes `.person-anniv` and a
  "♥" mark for the heart; `birthdays()` marks anniversary rows.
- `tests/pabu-people.test.js`, one new test (desktop; `gen.pabuCircle()`; the tests' TODAY is Wed 2026-09-30): Set up →
  Mom, Oct 4 (D(+4)) with the year 2021 → People's Mom line has the heart and "Oct 4 · 5 years"; the strip reads
  "Birthdays & anniversary" with Mom's anniversary row "in 4 days · 5 years" above her birthday row (Oct 12); `switchTo`
  Momo: Sunday's heading holds the any-time mark "Our anniversary (5 years · Mom), Sun any time, from Pabu" (read with
  `marks` as `tests/pabu-momo.test.js` reads a birthday's); Set up →
  Dad, no date → Mom's heart gone, Dad's there, no anniversary line, the strip's heading back to "Birthdays"; "no one" →
  none; Esc with a change asks; Export carries `partner` and `anniversary`; `gen.pabuCircle()` (no fields) imports with
  none; a damaged file with `partner: "yes"` and `anniversary: "13-45"` reads false and "".

**Haiku asks:** with no live people, does the pop-up open sensibly (only "no one")? Does `readDayFields` still mark the
right field in the person pop-up after the refactor? Does Momo's board handle two events on one day from Pabu (a
birthday and the anniversary) with distinct ids? Does `open("anniv:…")` reach the person when the chips hide them?
