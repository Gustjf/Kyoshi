# Kyoshi — plan: the end-to-end tests, faster and side by side (one session)

Planned 2026-10-08 from a measured baseline (a Claude cloud session: 4 cores, 16 GB, Node 22, Playwright's Chromium).
Nothing is built yet. One coding session, in order; steps 1, 3 and 5 fan out to Haiku 5.5 helpers (see *Helpers*).

**The owner runs it by saying:** `Execute roadmap/2026-10-08_tests_speed_plan.md`. The defaults under *Decisions* hold
unless the owner says otherwise first; nothing is left to decide before the session runs.

## How to use this file (you, the executing model — Claude Opus, effort high)
1. Read the root `CLAUDE.md` (automatic), this file, then **Read first**. Nothing else up front; don't scan the workspace.
2. **Nothing the tests check changes.** A test's name, its steps, its checks, its made-up data: untouched unless a step
   names it. The runner's contract stays: `node tests/run.js [words]` filters by name, prints a ✓/✗ line per test with its
   time, a summary line, exit code 1 on any failure, screenshots of failed tabs in the system temp folder.
3. **Not the app.** No file under `core/` or `apps/` changes (one optional exception, D4b), so no changelog line, no version
   bump, no build stamp. `tests/sim/` is out of scope.
4. You own `tests/run.js` and `tests/lib.js` yourself. Helpers audit, make the small mechanical edits a step hands them, and
   triage; each one's work is checked by a command named in its brief, and you read every diff they make.
5. Only one full run of the suite at a time, ever (yours): two at once would skew the timings this plan is about.
6. Push when green, straight to `main` (the owner's rule for finished, checked work; test tooling can't touch stored data),
   or to the branch your session names if it names one.

## The baseline (measured 2026-10-08)
| What | Measured |
|---|---|
| Tests | 121 in 27 files (`tests/*.test.js`), plus 8 helper files |
| Full run, one test at a time | **206.9 s** reported; the tests' own times sum to 206.2 s, so the runner adds nothing between them (browser launch 0.07 s, close 0.05 s, requiring every file 0.07 s) |
| **The process lives on ~90 s after the last line** | the 90 s timeout timer made for each test (`Promise.race` in `run.js`) is never cleared, so Node waits for the last one to fire. `node tests/run.js "bosco goals"` (2 tests, 1.7 s) takes **91 s** wall; a full run ~297 s wall |
| A test | average 1.7 s; 100 of 121 under 2.5 s; 8 over 3.5 s; the slowest 7.3 s (cloud upkeep's history) |
| `open()` (a fresh profile, the fake clock, `index.html`'s ~150 scripts from `file://`, the app started) | 250–350 ms, 126 times ≈ 35–45 s |
| Fixed sleeps | `importBackup`'s 150 ms × 133 calls ≈ 20 s; 11 other `waitForTimeout`s (100–800 ms) ≈ 4 s; together ~12 % |
| Fake-clock jumps (`clock.fastForward`, 72 minutes in all) | free |
| Hardware | 4 cores; one test keeps ~1.2 of them busy (Node + one renderer); a context is tens of MB |
| Already side by side | `tests/sim/run.js` runs lives `--parallel 3`: a worker queue over one browser — the pattern to copy |

By group (seconds): cloud 24.6 (13 tests) · badgermole history 12.3 · shell 11.9 · pabu 11.0 · turtleduck plan 10.1 · cloud
upkeep 9.6 · momo time off 9.1 · momo week 8.9 · cloud backups 8.8 · the other 21 groups 1.5–7.9 each.

So: the time is in the tests themselves, spread evenly, and the machine is three-quarters idle. Running them beside one
another is the win; clearing the timer is a free 90 s; the sleeps are the flake risk once the CPU is busy.

## Goal
`node tests/run.js` green in **≤ 75 s wall** on this machine (from ~297), the process exiting the moment the summary prints,
the same lines as today, and **no flakes**: 5 full runs in a row green at the default width, 2 at double the width, 1
serial. A filtered run (`node tests/run.js hawky`) exits in the time its tests take.

## Decisions (defaults the owner may overrule; otherwise they hold)
- **D1 One process, one browser, N tests at once** as contexts of that browser, through a worker queue (as `sim/run.js`),
  not child processes. Chromium already splits renderers into processes, so one Node process gets the CPU use without
  the cost; output, screenshots and the exit code stay simple; nothing is shared between tests but the browser (step 1
  checks that).
- **D2 Width.** Flags `--parallel N` and `--serial` (= 1); the remaining words are the filter, as today. Default: the best
  N measured in step 2 on 4 cores (start from `Math.min(4, os.cpus().length)`; the measurement decides, and if a width
  above the core count wins, the default is written in terms of `os.cpus().length` so the owner's machine gets the same
  rule).
- **D3 `serial: true`** on a test's object means it runs alone, after the pool drains. For the two timing checks in
  `badgermole-history.test.js` ("ten years": import under 4000 ms, a redraw under 300 ms), whose thresholds stay as they
  are, and anything else step 1 finds that measures speed.
- **D4 `importBackup`'s 150 ms sleep** becomes a wait on what the import does: (a) first choice, without touching core,
  wait for the page to show the import happened — a dialog answered, or the app's stored keys / state changed (read through
  `Kyoshi.apps[id]`), with the sleep kept only as a bounded fallback for an import the test expects to be refused;
  (b) if (a) can't be made solid for every call, a one-line hook in `core/backup.js` (`K.backup.importing`: a promise of
  the last import, set where `onFile` hands the file to `importText` / `importAllText`, `core/backup.js` line 179) is allowed — then
  Kyoshi gets a changelog line and a +0.010 bump, and the build stamp; say in the summary which one you did.
- **D5 Order and output.** Longest first, from the last run's times kept in `os.tmpdir()/kyoshi-tests/times.json`
  (written after every run; missing → file order), so the long cloud tests don't end up last and alone. Each result prints
  as it finishes (so the order varies run to run; every line carries its name, as today); a failure's message block goes
  out in one `console.log` so lines never interleave. The summary line stays, followed by one line naming the 3 slowest.
- **D6 Timeout.** 90 s per test stays; the timer is cleared in a `finally` (or `.unref()`'d).
- **D7 No test file is rewritten.** Only step 3's sleep → condition edits, each verified, each read by you.
- **D8 The sim** (`tests/sim/run.js`) stays as it is.

## Helpers: Claude Haiku 5.5 (`claude-haiku-5-5`)
Released this week: $0.10 in / $0.50 out per million tokens (a tenth of Haiku 4.5), 1M context, quick. **Use them
freely**, many at once, wherever the job is many-of-the-same and checkable by a command: one agent per file, launched
together in one message, `model: "haiku"` in the Agent tool. A brief: the one file, the recipe, the exact command that
proves the work, the report format, a line limit (≤ 20 lines back). Read-only unless the step says edit. **Never**
`run.js`, `lib.js`, or a full run of the suite (see rule 5). Not for: the runner's design, judging a flake's root cause
beyond triage, or anything that needs the whole picture — that's yours. Thirty-odd Haiku audits cost less than one of
your turns; don't economize on them, economize on your own reading.

## Read first
- `tests/run.js` (all of it, 60 lines) and `tests/lib.js`: `open`, `importBackup`, `exportBackup`, `travel`.
- `tests/sim/run.js` lines 80–90: the worker queue over one browser.
- `tests/cloud.js`: the header and `fake.route` (one fake GitHub per browser context: safe side by side).
- `tests/badgermole-history.test.js` lines 63–78: the timing checks.
- `grep -n waitForTimeout tests/*.js`: the 12 fixed waits.
- Root `CLAUDE.md` "Checking a change" and the `tests/` lines of its map; `roadmap/roadmap.md` "How we work" step 3.

## Steps

### Step 1 — Measure, and audit every test file (you + ~35 Haiku, read-only)
- You: `time node tests/run.js > <scratch>/baseline.txt 2>&1` once (expect ~207 s reported, ~297 s wall). Keep the
  per-test times for the before/after table.
- Haiku, one per file, all at once: the 27 `*.test.js` and the 8 helpers (`lib.js`, `generate.js`, `cloud.js`, `momo.js`,
  `badgermole.js`, `turtleduck.js`, `pabu.js`, `hawky.js`, `wanshitong.js`). Each reports, in a fixed format:
  (1) module-level mutable state (`let`/`var` at top level, counters, caches, objects or arrays mutated after creation);
  (2) every fixed wait (`waitForTimeout`, `setTimeout`, `clock.*` with real time), with its line and what it is waiting
  for; (3) checks that measure speed or read the real clock (`Date.now`, `performance.now`); (4) files written outside the
  browser (paths); (5) anything that leans on another test having run first; (6) anything else that breaks when another
  test runs beside it in the same process (`process.*`, `console` overrides, env vars, a shared temp path).
  Known already, to confirm: `generate.js`'s `random(seed)` is per call; `cloud.js`'s fake is per call; the two timing
  checks; the 12 waits. Merge the reports into `<scratch>/audit.md`: the list step 3 works from and the `serial: true`
  list for step 4.

### Step 2 — The runner (you alone)
Rewrite `tests/run.js` (~100 lines; header kept current):
- Parse `--parallel N` / `--serial`; the rest is the filter, joined by spaces as today.
- Build the queue: every test, filtered, sorted longest first by `times.json` (D5); those with `serial: true` set aside.
- `runOne(test)`: today's loop body as a function — the `t` object, `Promise.race` with the timeout **cleared in
  `finally`**, the console-clean check, the ✓/✗ line (a failure's whole block in one `console.log`), screenshots, the
  contexts closed; returns `{ name, ok, ms }`.
- N workers: `while (queue.length) await runOne(queue.shift())`, `Promise.all`; then the serial ones one by one.
- Write `times.json`; the summary line as today plus the 3 slowest; `browser.close()`; `process.exitCode`.
- Measure full runs at `--parallel 1, 2, 3, 4, 6, 8`, one after another, never two at once; a table in your summary; set the
  default (D2). Expect ~3–3.5× at 4 on 4 cores (renderers are CPU-bound); take what the table says.
- Check the filtered run exits at once: `time node tests/run.js "bosco goals"` → about 2 s wall.

### Step 3 — The fixed waits (you for `lib.js`; Haiku for the rest, editing)
- You: `importBackup` per D4. Run the files that import most (`momo week`, `turtleduck plan`, `pabu`) at the default width
  3× and serial once.
- Haiku, one per file holding a `waitForTimeout` (9 files, 11 waits), editing: replace each with a wait on the condition the
  audit named (`page.waitForFunction`, `waitForSelector`, or a `clock.fastForward` where the page's own timer is what the
  test waits for, as in `wakelock.test.js`'s 800 ms). Each verifies with `node tests/run.js <file's words> --parallel 4`
  3× and `--serial` once, all green, and reports the diff. You read every diff; a wait that guards something no condition
  can see stays, with a comment saying what it waits for.

### Step 4 — The speed checks
- `serial: true` on `badgermole-history`'s "ten years" test and anything step 1 listed. Its thresholds stay. Run the file
  at the default width 3×.

### Step 5 — Shake-out (you run; Haiku triages)
- 5 full runs at the default width, 2 at double, 1 `--serial`, one after another. Every failure → one Haiku agent per
  failing test: run it alone 3× (`node tests/run.js "<words from its name>"`), then its file at `--parallel 8` 3×, open
  its screenshot in the temp folder, and report: fails alone / only beside others / not reproduced, the check that failed
  and what the page showed. You fix the cause (a wait, a selector race, a shared path): never a loosened check, never a
  sleep added as the fix. After any fix, the 8 runs again from the top.

### Step 6 — Docs (you)
- `tests/run.js`'s header: the flags, the default width and why, `serial: true`, `times.json`. `lib.js`'s header if it
  changed.
- Root `CLAUDE.md`: the map's `tests/` line (`run.js (how to run; tests side by side, --serial for one at a time)`);
  "Checking a change" keeps `node tests/run.js`. `apps/_template/CLAUDE.md` step 5: one clause on `serial: true` for a
  test that measures speed. `roadmap/roadmap.md` needs nothing.
- Only if D4b touched `core/backup.js`: its changelog line, Kyoshi +0.010, the build stamp on `index.html`.

### Step 7 — Push and report
- Push (rule 6). Then move this file to `roadmap/archive/` with a *Done* line at the top: the before/after table (wall
  time serial, at the chosen width, the filtered run's exit), the width chosen and the width table, the 8 shake-out runs,
  which of D4a/D4b, what the helpers did (how many, what they found and changed).

## Risks, and where the plan already meets them
- **A busy CPU stretches races the sleeps used to hide** → step 3 turns them into conditions; step 5 proves it 8 runs over.
- **Speed checks fail under load** → D3's `serial: true`, thresholds untouched.
- **Output in a varying order** → every line is named; a failure's block is one write; the summary is the same.
- **Memory** → 8 contexts of a few tabs each is well under a gigabyte; fine on 16 GB and on a laptop.
- **Shared files** → `exportBackup`'s downloads are per context (Playwright's temp files); screenshots are named by test;
  `times.json` is written once, after the runs. Step 1 looks for anything else.
- **Playwright's fake clock** → installed per context; contexts don't see one another's.

## Out of scope
Making tests share pages or merging them; speeding `index.html`'s own load (250–350 ms an open, already tight); the sim's
runner (already side by side); CI (there is none: the tests run in Claude's sessions and on the owner's machine).

## Stretch (only with everything above green and time left)
- `--repeat N` on `run.js` for flake hunting (the same filter N times, one summary).
- `tests/sim/run.js`: default `--parallel` from `os.cpus().length` (keep 3 as the floor).
