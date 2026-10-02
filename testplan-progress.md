# Flow test (testplan.md): where it stands
A handoff between sessions. Read `testplan.md` first, then this. Delete this file when the campaign is done (its
decisions end up in `roadmap.md`'s Phase 8).

## Start here (a new session)
1. The work so far is on the branch `claude/optimistic-goodall-ghgkfc`; `main` is untouched. Bring it into your branch:
   `git fetch origin claude/optimistic-goodall-ghgkfc && git merge origin/claude/optimistic-goodall-ghgkfc`
   (nothing to do if your session was told to develop on that branch).
2. `node tests/run.js` should pass (49 tests, ≈95 s).
3. Start the full run in the background at once — it takes about an hour:
   `node tests/sim/run.js > <your scratchpad>/all.log 2>&1`, and wait on it with Monitor or an until-loop on
   "done in" / "report:" (no polling with sleep). While it runs, read the simulator files you need (each header says what it does).

## Done
- testplan.md's "What to do" steps 1–5: the simulator in `tests/sim/`, `tests/momo.js` (Momo screen helper),
  `tests/generate.js` extended, `.gitignore` (`tests/sim/out/`), one line each in CLAUDE.md's map and README.md.
- Smoke run: life 1 for 6 weeks (≈90 s, screens daily). Every life trialled for a few weeks; every life event (join,
  rename, drop, baby, gap, reinstall, old import, two tabs, leap, new job, retire, replace things) exercised once.
- "Fix at once" (crash, console error, data loss): **none found so far** — no page error, no console error, nothing lost
  across reloads (fingerprint of every app's data before and after), Export all → fresh profile → Import all (same answers),
  two tabs, or an old backup through Import JSON's combine. If the full run finds one: minimal fix + test + version/changelog
  bump + build stamp + push, per testplan.md, and list it under "Fixed during the run".
- Tests only so far, no site change, so no version bump (versions are the apps' and core's).
- **Not done:** the full six-life run to the end, `report.md`, the curated screenshots, the bundles committed, the
  discussion, roadmap Phase 8, building the fixes.

## Next, in order
1. **Full run** (above). `node tests/sim/run.js planner --weeks 6` reruns one life to a point; other options:
   `--mode functions` (in-page calls, faster), `--no-shots`, `--parallel N` (default 3), `--out DIR`. Longest life first;
   each saves `tests/sim/out/<life>.json` every 4 weeks; 8 failed days in a row stop a life; `report.md` is written at the end.
   Expect: long ≈6 s/week (≈52 min), changes ≈12 s/week (≈30 min), seasons ≈14 s/week (≈36 min), each 1-year life ≈15 min.
   To stop a run, kill its node process by pid:
   `ps -eo pid,args | awk '/node tests\/sim\/run\.js/ && !/awk/ {print $1}' | xargs -r kill`
   (`pkill -f "node tests/sim/run.js"` kills your own shell too).
2. **Report**: rewrite it any time with `node -e "require('./tests/sim/report').write('tests/sim/out')"` — reads
   `out/*.json`, copies each finding's first screenshot to `tests/sim/shots/`, writes `tests/sim/report.md`. Its words come
   from `tests/sim/notes.js` (an entry per finding key, suspects 1–14, intro, ranking, agenda).
3. **Curated screenshots**: `node tests/sim/curated.js planner 2027-09-28T14:00:00Z` (then parent, light) →
   `tests/sim/shots/<life>-board-this / -board-next / -tasks-this / -phone-today.png`. Tested on life 6's bundle. The year-1
   bundle is saved on Sunday 2027-09-26, so set the clock after it (before it, the board shows odd things like a week
   "closed out" on its Wednesday). Look at them, keep the ones that show the top findings, and link them from report.md
   (e.g. a "What it looks like" part in notes.js's INTRO, or in `findingMD` in report.js).
4. **Read report.md end to end** as the owner would (a layman): plain words, numbers that tell the story. Fix notes.js where
   the full run changes the story. Suspect 10 (a week Momo never wrote to: lives 2 and 4 have the gaps) and 12 (the
   close-out shows today's goals: life 2 renames and drops one) were still waiting for data.
5. **Commit** `report.md`, `tests/sim/shots/`, `tests/sim/bundles/` (made-up data, compact JSON, each < 2 MB);
   `node tests/run.js` must pass; push to your branch. CLAUDE.md says finished work goes straight to `main` — this is tests
   only: ask the owner whether to merge it into `main`.
6. **The discussion** (testplan.md "The discussion"): a plain summary + the top five, then themes 1–5 one at a time, each with
   its findings, 2–3 options and a recommendation; at most five questions per batch (AskUserQuestion takes 4 a call); wait for
   the answers before the next batch.
7. **Record every decision** in `roadmap.md` as Phase 8 "Flow fixes" (Status style, like Phase 7) before building.
8. **Build**: targeted edits; tests in `tests/` using `tests/momo.js`; versions + changelogs (the app's, core's); new build
   stamp; `node tests/run.js` green; smoke run green (`node tests/sim/run.js planner --weeks 6`); console clean at phone and
   desktop width; push. Tick Phase 8, update the CLAUDE.md files that changed, and hand the owner the bundles (Import all
   into a browser profile that is **not** connected to the real sync folder).

## What the partial runs showed (check the full run against it)
Last partial run (lives 4–6, their first 25–57 weeks; lives 1–3 only in shorter trials):
- 0 console errors, 0 page errors, 0 data loss; every close-out on time.
- Findings (distinct cases): task-wrong-week 765 · done-no-card 552 (Pabu 258, Hawky 174, Badgermole 96, Iroh 23) ·
  colors-churn 472 · overdue-hidden 464 (Hawky 261, Pabu 146) · yesterday-tick 337 · far-due 244 (Hawky 127, Appa 117) ·
  same-shortfall 189 (Read 6 books 61, Keep in touch 29, Groceries 24, Errands 24, Bikes 22, Run training 19) ·
  all-assigned-with-tasks 182 · done-holds-room 154 · anytime-event-hours 131 · appa-no-done 109 · late-only-in-tasks 47 ·
  silent-behind 42 (Turtleduck 16, Iroh 12, Pabu 11) · hours-short-vanish 20 · open-in-loses-edit 3 · noisy-dot 2 (Hawky).
  Earlier trials also: today-24h, closeout-first-thing, later-forgotten, task-unused-app, old-import-replaces.
- Speed, life 6 at year 1 (53 weeks kept): K.inbox 9 ms, hoursSpent 1 ms, fill 10 ms, board redraw 22 ms, tab switch 163 ms,
  Today 184 ms, reload 654 ms, storage ≈1 MB, Export all 2.17 MB pretty (≈1 MB compact bundle), Import all 960 ms with the
  same answers after. Nothing slow.
- Suspects: 1–9 and 11 confirmed; 13 refuted (harmless); 14 measured; 10 and 12 need lives 2 and 4.

## The top five (draft — confirm against the full run)
1. **Falling behind is silent outside the app**: Badgermole, Turtleduck, Pabu and Iroh's goals never dot; checkups never nag.
2. **Momo forgets what got done**: yesterday's ✓ is gone (its window starts today); a need done with no card leaves no
   trace; Appa sends no ✓ at all (a recorded job just disappears).
3. **Late things are hidden**: once a need is on a card, nothing marks it late (cards, Today); Today never shows Tasks.
4. **Tasks and the ✓ status mislead**: tasks stand on weeks they can't go on; "all assigned ✓" shows with tasks left.
5. **The baseline doesn't carry the true cost**: the same shortfall comes back week after week (Read 6 books, Keep in touch…).

Theme 1 draft questions: which apps dot when behind; a one-line standing per app in the switcher; checkups nag after N
days; a red edge for late needs on cards and in Today; Hawky dots only after a few days late or several late errands.

## The simulator, file by file (each header says more)
`world.js` a life's starting data (via generate.js) · `lives.js` the six (seeds, devices, events) · `life.js` the Life (browser,
clock, devices, observe, reload guard, findings) · `day.js` a day (open, observe, close out, act, plan) · `plan.js` close-out
and planning sittings · `acts.js` what a person does in each app · `events.js` life events · `check.js` Momo's checks (A) ·
`standing.js` where I stand per app (B) · `robust.js` timings, import/export, reinstall, two tabs, dates, DST (D) ·
`run.js` the command · `report.js` + `notes.js` report.md · `curated.js` the report's screenshots.

## Gotchas already paid for
- Clock: Playwright's fake clock; set the day's time, then fastForward 61 s so Kyoshi's minute tick runs; never go back.
- The page's Math.random is seeded per page load from a localStorage counter (`sim.loads`): one seed for every load
  repeated Appa's ids within the same real minute.
- In functions mode, a form inside a detached app root doesn't submit: dispatch a "submit" event on it.
- The close-out pop-up covers the page: the observer goes through `Kyoshi.show` / `page.evaluate`; the person answers it first.
- `page.setDefaultTimeout(8000)`, so a stuck step fails fast.
- The reload guard compares canonical JSON of every app's `A.data.build()`. Momo re-stamps its colours' `u` on every start
  (finding colors-churn, cosmetic), so colours are compared on their own.
- Bundles are compact JSON (pretty-printed, life 6's year 1 was 2.17 MB).
- Life 6 steps a week at a time, so its standing and dot numbers are skewed; it's there for growth.
- An old Import all replaces data by design (Import JSON's combine keeps everything): a design question, not data loss.

## Git
Push to your session's branch; don't check the live site after pushing; the repo is public (made-up data only).
