# Kyoshi — the codebase audit: where the complexity lives, and what was done about it

**Done 2026-10-08** (the owner picked "A then B": the seven confirmed bugs, then sync hardening), over two sessions on
`claude/festive-franklin-jbhxft`, merged into `main`:
- **B1** folder sync stores another device's save in the same write as its counters (Kyoshi 5.280; tests/sync-folder.test.js).
- **B7** a tab in test mode still follows other tabs' bug reports (Kyoshi 5.280; tests/shell.test.js).
- **Option B, the shared merge:** K.util `newer` / `mergeById` / `mergeKeys` in place of ten copies (Kyoshi 5.280 and seven apps);
  the sync engine's decisions tested in Node (tests/sync-engine.test.js). Momo keeps its own tie rule (apps/momo/CLAUDE.md says why).
- **B5** Turtleduck reads "1½ hours", "1 1/2 hours", "1-1/2 hours", "1/2 hour" (2.521, through ingredients.js `readAmount`, which
  now reads "1-1/2 cups" as 1½ too).
- **B3** Momo never nests a card inside a fixed card, and un-nests one found there (10.485).
- **B4** an app that didn't start, or whose routine or needs fail (or aren't a list), keeps its cards in Momo as they are
  (`K.routine.unreadable`, `K.inbox.unreadable`; Save as baseline keeps its slots), and no past week closes unreviewed meanwhile
  (the reported Iroh close-out item; Kyoshi 5.281, Momo 10.485).
- **B6** an Appa record with no jobs keeps its own `minutes` (1.363; tests/appa.test.js, Appa's first).
- **B2** Bosco's weigh-ins and doses carry their own change stamps (`wu`, `du`), and a deleted day leaves a marker of what it deleted
  (`gone`: the stamps it took); sync takes each part's later change, a part only one side has comes along, and a marker deletes only
  the versions it saw (a dose logged meanwhile elsewhere stays); an import counts as a change made now, so a restore sticks (7.601;
  tests/bosco-sync.test.js). Bosco keeps its own merge (by date and part; the newer save for unstamped days), not K.util's. A first
  cut with one stamp per day lost such a dose on delete and undid restores: the review caught both before `main`.
- **Option B, the folder's guard:** a save made by a newer Kyoshi stops folder sync until the page is reloaded, as the cloud does
  (Kyoshi 5.281).

**Still open (not done, for a later session):**
- Momo merges whole weeks by `u`, and its own automatic placements stamp the week too: an automatic change on one device can win
  over a hand edit made earlier on another. A per-card merge would fix it: **the owner's call** (apps/momo/CLAUDE.md, Invariants).
- The "Reported by exploration" items below were never re-verified line by line (but the first, the folder's guard, and the
  eighth, Iroh's close-outs, are done; the sixth is Momo's whole-week merge, above).
- Load baseline and Copy previous week drop Momo's cards for an app that can't be read at that moment; they come back by themselves
  once it can (place.js), so it was left.
- Every stamp is `Date.now()` on its device: a clock far off can still put one change before another (as in every app).
- Options C (close the test gaps) and D (reduce duplication) weren't picked.

The audit as it was approved follows (line numbers as of that morning's `main`).

## Context
The owner is auditing Kyoshi (vanilla HTML/JS, no build step; ~36k lines over 207 JS files: ~5.5k core, ~20k apps,
~10.7k tests). This document is the audit's map: the most complicated logical components, the bugs found on the way,
the cross-cutting weaknesses, and several options for acting on it. Nothing has been changed. Every bug marked
**confirmed** was re-read in the source by me; the rest came from the exploration pass and are marked **reported**.

## Size at a glance (lines of JS)
| Area | Lines | Note |
|---|---|---|
| tests/ | 10,738 | 27 Playwright files (~200 end-to-end cases) + a flow simulator (tests/sim) |
| apps/momo | 5,596 | the center of the system, 27 files |
| core/ | 5,451 | sync, cloud, storage, PDF, shell |
| apps/turtleduck | 3,351 | meals, plan grid, groceries |
| apps/appa | 2,478 | maintenance + hand-made PDF reports |
| apps/bosco | 2,231 | weight + dosing |
| apps/badgermole | 1,958 | workouts |
| hawky / pabu / iroh / wanshitong | 0.8k–1.4k each | simpler |

Good news first: the file discipline holds (all files under ~440 lines, headers everywhere), no app breaks the
`document.getElementById` rule, feature detection is thorough, and the cloud transport is well tested.

## The 7 most complicated components, ranked

1. **The sync engine's merge decision** — `core/sync.js:91-115` (`incorporate`) plus each app's `combine()`.
   Per-device change counters decide "load theirs / ignore / combine". Small code, big consequences: any mismatch
   between stored counters and stored data makes a device believe it has changes it doesn't. Tested only end to end
   through the cloud; no unit test of the counter comparison; **folder sync has no tests at all** (it needs a real
   folder picker).

2. **Momo's "what fills which card" pipeline** — `apps/momo/inbox.js` (`assign`, `fill`), `place.js`, `routine.js`,
   `tasks.js` (`canGo`). Five fill kinds (card / time / block / hours / ongoing), needs matched to cards by slot, then
   by id, then by `of`; app start order (`K.order`) silently decides who gets a contested block. Nothing is stored, so
   it reruns on every draw. Well tested for the normal paths; failure paths (an app that fails to start) are not.

3. **Cloud sync's state machine** — `core/cloud.js` (433 lines, ~23 module-level variables), plus
   `cloud-upkeep.js` (rewrites Git history daily) and `cloud-backups.js`. Generation stamps to drop stale checks,
   browser locks across tabs, ETag listing, backoff timers, save-clash retries. Best-tested part of the repo
   (`tests/cloud*.test.js`), but the trim's catch-up loop and its race with a daily backup are untested.

4. **Momo's card model and drag/drop** — `model.js` (fold, nest one level, `moveCard`), `drag.js`, `drop.js`,
   `card-editor.js` (`saveCard` is 97 lines). The 16-field card object is written out by hand in 8 places.
   **Almost no tests**: nothing drives a card-to-card drag, group drag, drop inside a card, fold, resize, or pin.

5. **Turtleduck's groceries, portions and parsing** — `groceries.js` (lists by "date time" moments, ticks kept as
   day ranges shared across lists), `app.js:252-312` + `plan.js` (batch yield, leftovers, store-bought stock running
   down), `ingredients.js` + `paste.js` (unit folding, plural guessing, two keys per line for back-compat).
   Well tested through the UI; the parsers have no direct tests.

6. **The hand-written PDF stack** — `core/pdf-*.js` (~1,100 lines): an inflate port, xref/object-stream parsing with
   rebuild-by-scanning, page import by copying object graphs. **Zero tests.** Risks: per-stream memory cap only
   (128 MB), the rescue scan can match `N G obj` inside binary data.

7. **Date and schedule maths spread across apps** — Appa `schedule.js` (time/season/meter pace, 182 / 365.25 / 30.44
   constants), Bosco `doses.js` (missed doses, site rotation), Badgermole `stats.js` (next routine from a rotation
   with repeats, Epley PRs across units), Iroh `app.js` (season weeks, expected vs spent), core `meetings.js` +
   `seasons.js`. Appa has **no test file at all**; Iroh, seasons and meetings are tested only indirectly.

## Bugs found

### Confirmed (re-read in the source)
| # | Where | What | Impact |
|---|---|---|---|
| B1 | `core/sync-folder.js:63-74`, `core/sync.js:105-112` | `incorporate` stores the new counters at once, but the data is only persisted in `settle()` after the loop; an early return at `:66` (folder disconnected or test mode turned on mid-pass) or a tab closing in between leaves counters ahead of data. The cloud does both in one step. | Narrow window, but silent data loss that then spreads on the next save |
| B2 | `apps/bosco/data.js:244` | Per-day conflicts are decided by the whole save's `savedAt`, which core refreshes on any combine (`sync.js:71,107`); a device that merely combined beats a real offline edit elsewhere. Bosco has no per-entry `u` stamps (every other app does) and no deletion markers (comment at `:239-241` admits deletions come back). | Lost weigh-in or dose edits in two-device use |
| B3 | `apps/momo/card-editor.js:295-299` | `holderOn` picks the "Inside" parent by title only, no `canHold`/`isFixed` check, so a card can nest inside Turtleduck's Dinner slot card on days where you have no Dinner card of your own. | Violates Momo's own invariant ("never inside a fixed card") |
| B4 | `core/shell.js:59`, `core/routine.js:33-37`, `apps/momo/routine.js:41-45` | `K.ready` is set even when an app failed to start; a failed or throwing app's routine reads as empty; `syncSlots` then takes back all its slot cards in the baseline and `placeCards` the week copies, and saves + syncs that. | One bad start of Turtleduck deletes its meal slots everywhere |
| B5 | `apps/turtleduck/paste.js:26-32` | `minutesOf("1½ hours")` → 1 minute; `"1 1/2 hours"` → 120; `"1/2 hour"` → 120. | Wrong prep/cook times on pasted recipes |
| B6 | `apps/appa/record.js:157-166` | A record with no jobs ("other work") has nowhere to keep the typed time: `fields` carries minutes only per job, so Momo gets the default. | Lost data on a common record type |
| B7 | `core/storage.js:154` + `core/record.js` | A test-mode tab ignores every other tab's change, including the hidden Kyoshi app's real bug log; its next real write overwrites the other tab's newer reports. | Minor (dev tool), but real |

### Reported by exploration (plausible; not re-verified line by line)
- Folder sync has no "saved by a newer Kyoshi" guard (`sync-folder.js:68` vs `cloud.js:304`): an older copy can strip
  fields and then win the merge. Momo's CLAUDE.md only says "reload on every device".
- `cloud-upkeep.js:94-101`: a commit landing between the head check and the branch move is dropped from history; a
  daily backup hit that way is not retried (its device already marked the day done).
- Two tabs editing within the 50 ms reload debounce (`shell.js:267`) both bump the same device counter; last writer wins.
- Iroh stamps a new goal with real `Date.now()` but counts its first week from it, so under time travel it starts in
  the real week (`goal-editor.js:124` vs `app.js:155`); `spent` sums the whole season while `closed` counts from the
  goal's week (`app.js:158-159`).
- A season meeting done just before a new season is due again in that season's first week (`meetings.js:104-105`).
- Momo weeks merge whole by `u`; Momo's own automatic placements stamp the week too, so an automatic edit on one
  device can override a hand edit on another (`data.js:346`, `place.js:119`). Worth a deliberate decision.
- `cleanCard` keeps `fixed` on an app card with neither `need` nor `slot` (`momo/data.js:98`): such a card can never
  be deleted, cleared or dragged.
- If Iroh's inbox throws, past weeks close quietly with no review (`closeout.js:81-84`).
- Appa's `agenda`/Bosco: missed doses are ignored by `agenda`, so they show undone on Momo's past days (`doses.js`).
- Over 20 tick ranges, Turtleduck drops the newest, not the oldest (`turtleduck/data.js:129`).

## Cross-cutting weaknesses
- **Duplicated merge helper.** The "later change wins" comparator `newer` is copy-pasted 10 times (8 `apps/*/data.js`,
  `core/record.js:171`, `core/meetings.js:197`); Momo uses its own `pick` with a *different* tie-break. The
  merge-by-id loop repeats ~9 times. Bosco is the odd one out (no per-item stamps).
- **Duplicated date/text helpers.** `mondayOf` in 4 apps, "N days ago" in 3 places, `cleanLine` in 7, `fmtDay` in 6,
  `fmtMinutes` in 5, `plural` in 4, the `remember` memo in 4. Candidates for `core/util.js`.
- **Hidden ordering dependencies.** `K.ready` guards in 4 Momo files; `syncSlots` must run before `assign`;
  `renderAll` must set `S.agenda`/`S.fill` before the bank draws; `cloud-backups.js:37` grabs `cloud.afterCheck` at
  script load (depends on `index.html` order); `renderAll` itself saves (`render.js:16,21`), so drawing has side effects.
- **No unit-level tests.** Every test drives the real page. The pure functions (parsers, inflate, counter comparison,
  Epley/next-routine, due-date maths) have no direct tests, which is how B5 slipped through. No CI, no linter.
- **Coverage holes by area:** folder sync (none), PDF stack (none), Appa (none), Momo drag/drop (almost none),
  Iroh/seasons/meetings (indirect), Bosco postpone/missed doses/projections (thin).

## Options (pick one or stack them)

**Option A — Fix the confirmed bugs, nothing else.** B1–B7 above. Each is a small, local change with a test:
B1 persist data before storing counters (or `settle` per file); B2 give Bosco per-entry `u` stamps + deletion markers
(a stored-data change: branch); B3 add `canHold` to `holderOn`; B4 skip `syncSlots`/`takeBack` for an app whose start
failed or whose routine threw (and never take slots back when a routine read fails); B5 handle "½" and "a b/c";
B6 give a record its own `minutes`; B7 let test mode still refresh non-testable keys. ~1–2 sessions.
Lowest risk, highest value per hour.

**Option B — Harden sync (data safety first).** Option A's B1/B2 plus: the newer-version guard on folder sync; one
shared `K.util.mergeById(mine, theirs)` + `newer` used by every app and core (ends the 10 copies and the tie-break
drift); a decision on Momo's whole-week merge vs. automatic placements; a Node-only test file for `compareClocks`
and `incorporate` (they are pure enough to run without a browser). Medium effort; touches every app's data.js, so a
branch and a two-device try.

**Option C — Close the test gaps.** A `tests/unit/` harness (plain Node, no Playwright) for pure functions: the paste
and ingredient parsers, `pdf-inflate` against a few known PDFs, Badgermole `stats.js`, Appa `schedule.js`, the sync
counters. Plus an `appa.test.js`, a Momo drag/drop test (Playwright's mouse API) and a GitHub Actions workflow that
runs `node tests/run.js` on push (CI is outside the site, so the "no build tools" rule still holds). Medium effort,
no behavior change, pays off on every later change.

**Option D — Reduce duplication.** Move the shared helpers into `core/util.js`; one `A.newCard(fields)` factory in Momo
in place of 8 hand-written card objects. Low risk per edit but a wide diff; best done after C so the tests catch slips.

**Option E — Record and move on.** Keep this document as `roadmap/audit_2026-10-08.md`, fix only B3/B4/B5 (an hour),
and schedule the rest as a phase. Cheapest; leaves B1/B2 data-loss windows open.

## Recommended first step
A, then B. B4 (slot wipe) and B1/B2 (silent sync loss) are the ones that can cost the owner data; the rest can wait
for C. Do B2 on a branch (stored-data change); everything else can go to `main`. Bump the changed apps' and core's
changelogs per the project rule.

## Verification (for whichever option is picked)
- `node tests/run.js` passes; add a test per fixed bug (B5 and the sync counters can be plain Node asserts).
- Open `index.html` from disk, Developer Mode (Ctrl+9): time travel across a week with Turtleduck confirmed, check
  the console and that Momo's slot cards survive a reload with an app forced to fail (temporarily throw in its `load`).
- For B1/B2: two browser profiles on one sync folder (a scratch folder, never the real one), edit the same Bosco day
  offline on both, sync, and check the later edit wins.

## How this was checked
Line counts via `wc`; grep for `document.getElementById` under apps/ (none); grep for `newer`/`pick` comparators
(10 copies); grep tests/ for `showDirectoryPicker` (none, so folder sync is untested); three read-only exploration
passes over core, Momo, and the other apps + tests; every "confirmed" row re-read at the cited lines.
