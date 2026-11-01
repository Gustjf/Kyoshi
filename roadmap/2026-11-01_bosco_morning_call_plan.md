# Kyoshi — plan: Bosco's morning call (eat fully · eat normally · eat a bit lighter), 2026-11-01

Planned 2026-11-01 by the architect model from the owner's ask (Bosco 9.137 · Kyoshi 5.481; line numbers as of commit
`2ed5a4d`). Two phases, each sized for one coding session, and a third that needs the owner's say first. Nothing is
built yet.

**The owner's ask, in short:** each morning, right after weighing in, one simple call for the day — eat fully, eat
normally, or eat a bit lighter — to train intuitive eating against a target pace of loss (1% of body weight a week, the
pace goal Bosco already keeps), not to count calories. The owner is on a GLP-1 (a dose every 5 days), so appetite is
suppressed and **under-eating is the bigger risk**. They brought an approach (an exponential moving average of the
scale, α = 0.2; the day's call from how far this morning's scale sits from yesterday's average; a weekly check of the
average's pace) and asked for it to be critiqued and improved: is Holt's double smoothing or a Kalman filter clearly
better; what daily rule gives few false flips; should the dose cycle be corrected for; how should the pace goal change
as weight drops. The owner's 53 days of weigh-ins were used to decide all of this and **stay out of the repo** (the
repo is public): the numbers below are errors, counts and rates, never a weight.

**The owner runs a phase by saying:** `Execute phase N of roadmap/2026-11-01_bosco_morning_call_plan.md`. The
decisions are made (D1–D11 below, the architect's; each has one line to change if wrong) and the math is written out in
full, so nothing is left to derive before a phase runs.

## How to use this file (you, the executing model — Claude Opus, medium reasoning effort)
1. Read the root `CLAUDE.md` (automatic), then **only** this file's top sections (down to the first phase) and **your
   phase**; skip the other phases. Then the phase's **Read first** list, and nothing else up front: every file's header
   says what it holds, and `apps/bosco/CLAUDE.md` has Bosco's map and data model. Don't scan the workspace.
2. **Decisions:** D1–D11 are settled; the phases follow them. *The math* section is the specification: implement it as
   written (the constants, the order of the updates, the hysteresis, the two-morning confirmation); don't re-tune it.
   Everything else is settled in the phase text or is yours to judge (small UI details, exact wording in the owner's
   plain voice). A choice that would change how data is kept, or what the owner sees in a way this plan doesn't settle
   → ask the owner in plain terms (they're a layman) and wait; don't guess.
3. Build the phase as one unit. Targeted edits: no rewrites, no renames of what works, nothing outside Bosco (and the
   files this plan names), every file under ~400 lines (the new file is the seam). Reuse what's there: `averaged` in
   `trend.js` is the model for a per-weigh-in derived series, `renderStats` for a stat card, `paceGoal` / `fmtPaceGoal`
   / `fmtPaceBand` for the goal's words, `treatments.js` for a file that holds both a feature's math and its section.
4. **Before pushing, every phase:** (a) a changelog entry in `apps/bosco/changelog.js`, newest first, one new version
   (the phase title says which), a brief sentence per change in the owner's words; `core/changelog.js` only if a file
   under `core/` changed (none is planned); (b) `apps/bosco/CLAUDE.md` current (files, state, invariants) and the root
   `CLAUDE.md`'s map line for `apps/bosco/`; (c) a new build stamp:
   `sed -i "s/?v=[0-9][0-9-]*/?v=$(date -u +%Y%m%d-%H%M)/g" index.html`; (d) tests: the ones the phase names, made-up
   data only (the repo is public), then `node tests/run.js` green (filter by name while iterating: `node tests/run.js
   call`; the full run once before pushing); (e) by hand from disk: open `index.html`, Bosco, console clean at desktop
   and phone width (≤ 640 px), Developer Mode time travel +1 day and +1 week, Export then Import JSON (the file's shape
   doesn't change in this plan: it must come back identical); (f) the checklist under *Checks* below, by hand; (g)
   commit with a clear message and push to `main` (nothing stored changes, so no branch). Don't check the live site.
5. **After pushing:** tick the phase under *Status* with a line of what was decided along the way.
6. Data rules that always apply: this plan stores **nothing new** (D3): everything is derived from the weigh-ins and
   the pace goal on every render, so sync, backups, `combine`, `importBackup` and `DATA_SCHEMA_VERSION` are untouched.
   No personal data anywhere in the repo (tests generate made-up weigh-ins). Bug reports hold counts and states, never
   weights, dates or names.
7. **Helpers** (the owner's rule of 2026-10-14: Sonnet and Haiku are authorized): optional, one per phase — a Sonnet
   `Explore` agent reviewing the phase's `git diff` against *The math* and D1–D11 before you push, as a lead, not a
   finding. Write the tests yourself (the math is the point). No Haiku here.

## Status (tick each phase off here, with what was decided)
- [ ] Phase 1 — the morning call: the smoothed trend, the two-week pace, the call with hysteresis, its card (Bosco
  +0.100 → 9.237).
- [ ] Phase 2 — the trend on the chart; Developer Mode's walk and dose-cycle table (Bosco +0.100 → 9.337).
- [ ] Phase 3 — (needs the owner's say first) the pace goal stepping down at goals.

## What the numbers say (the critique, on the owner's 53 days; the architect, 2026-11-01)
The owner's EMA approach is sound in spirit and wrong in two places that matter: the smoothing lags, and the daily rule
acts on noise. Both are fixable without any new setting.

- **The scale's noise is about ±1.0 lb a day** (the standard deviation of the scale around a two-week fitted line).
  A day of eating 500 kcal over is 0.15 lb of fat: invisible under that. So **the scale cannot tell you about
  yesterday's eating; it can tell you about the last one to two weeks.** The right product is a *standing* call
  that the morning weigh-in confirms or, now and then, changes — not a call that could change every day.
- **The plain EMA (α = 0.2) sits 1.8 lb above the true trend on average and 3.5 lb above it at the end.** On a steady
  loss of 0.4 lb a day that's built in: an EMA has no notion of a slope. Its "7-day change" also lags: on the last
  morning it reported a pace of 1.2% a week when Bosco's own 7-day-average-against-the-previous-week said 0.85%, because
  the EMA was still carrying the faster week before. **Holt's double exponential smoothing (level + slope) fixes this
  outright:** with α = 0.2, β = 0.1 its level stays within 0.5 lb (root mean square) of a centered two-week fit, with a
  bias under 0.3 lb, and its one-day-ahead forecast error falls from 2.5 lb (the EMA's) to 0.96 lb — the scale's own
  noise floor, which is as good as any smoother can do. A Kalman filter with a local-linear-trend model is the same
  thing with gains that adapt; with daily weigh-ins and this little data it adds settings, not accuracy. **So: Holt,
  clearly, and α = 0.2, β = 0.1, with the slope seeded at the pace goal's own rate** (β = 0.05 tracks the slope a
  shade better but takes three weeks to learn it; and a slope seeded at zero starts the level above a falling line, so
  for four weeks the level's catch-up inflates the pace — an exactly on-pace series read 1.13% a week and would have
  been told "Eat fully". Seeded at the goal's rate, an on-pace series reads 1.00% from the first call, and a faster or
  slower one converges on its true pace within two weeks of its first call. The seed is forgotten by the fourth week.)
  With these settings on the owner's series: one-day forecast error 0.95 lb; the call changed once in 53 days (the
  first "Eat fully", which was true: the pace never dropped under 1.4% a week over any two weeks).
- **Bosco's own Current Trend is right on average and jumpy day to day.** On the owner's last week the 7-day
  weekly rate's status read Too fast, On pace, On pace, Slightly slow, Too slow, Slightly slow on six consecutive
  mornings, while the 14-day pill read Too fast on the same mornings the 7-day one read Too slow: nothing about eating
  changed, the scale wobbled and the colors followed. That's the gap the card fills: the same pace idea, steadied. In
  the same noise study as below, a call built straight on the existing 14-day rate with the plan's hysteresis would
  still change about 5 times in 8 weeks on an on-pace series, against 1.3 on the smoothed level: the smoothing earns
  its place.
- **The daily rule must not be the one-day gap.** The owner's rule (gap below −2.5 lb → fully, above −0.5 → lighter)
  flipped **23 times in 52 days**: it reads water. The pace of the smoothed level over 14 days, with the hysteresis
  below, flipped **0 times**; over 7 days, 3 times (two of them around a dose-day bump). The pace is read from the
  **level's change over 14 days**, not from Holt's slope, because the slope with a small β lags a change of pace by
  two to three weeks, while the level is accurate to about 0.5 lb every day: the 14-day change of the level is good to
  about ±0.17% a week (one standard error), a 7-day change to about ±0.34%.
- **Those error bars decide the bands.** The owner's on-pace range of 0.125% (confirmed: Bosco's `rangePct` is ± the
  green band, twice it the yellow, `paceStatus` in `trend.js`) is narrower than two weeks of weigh-ins can resolve:
  reading it literally would flip the call on noise. So the call **enters** a zone at a wider line and **leaves** it at
  a narrower one (hysteresis), and asymmetrically (D5): "eat fully" is the cheap mistake for someone whose appetite is
  suppressed, so it comes in at the green edge; "eat a bit lighter" is the costly one, so it waits for the yellow edge.
  A change of call also needs **two mornings in a row** asking for it (D6), so one wild morning never flips it.
  Measured on 300 made-up series each, scale noise ±1 lb, 8 weeks with a call: an **exactly on-pace** person with
  range 0.125% would see the call change **4.4 times** in those 8 weeks (31% of mornings a false "Eat fully"); with
  range **0.25%** (Bosco's default) **1.3 times** (13% false "fully", never a false "lighter"); a person losing 1.25% a
  week is told "Eat fully" 82% of mornings, one losing 1.5% 96%, one losing 0.5% "Eat a bit lighter" 84%. The
  symmetric rule (D5's alternative) at 0.25% never flips on pace but calls 1.25% "normally" 85% of the time. **So the
  recommendation to the owner is to set the on-pace range to 0.25% in start-up info**; the call follows whatever they
  set, and the card never hides this: it shows the pace and the goal.
- **The dose cycle: nothing to correct, yet.** By day of the 5-day cycle, the scale's departure from the trend averages
  between −0.3 and +0.4 lb on eight cycles, with a standard error of about 0.35 lb: indistinguishable from nothing. The
  hysteresis absorbed the one three-day flat spell around a dose without a flip. Phase 2 gives the owner a table of
  this in Developer Mode so a real, repeatable swing would show up after 12+ cycles; only then is a correction worth
  modeling (D8).
- **Calories go.** 3,500 kcal a pound is crude in general and wrong early on a GLP-1 (water and glycogen); the aim is
  intuitive eating, so the product shows pounds and a pace, never a kcal figure (D9).
- **The pace goal as weight drops.** 1% a week is at the top of the usual 0.5–1% guidance; in pounds it shrinks by
  itself (1% of 190 is 1.9 lb; of 145, 1.45 lb), which is the right direction. Most guidance tapers to about 0.5% a week
  over the last 10–15 lb to protect lean mass, all the more with a suppressed appetite. The plan's answer is a setting
  the owner changes by hand at each goal reached (start-up info already has it), with Phase 3 — a pace per goal, stepped
  down automatically — offered for the owner to accept or decline (D11). This is arithmetic on the owner's own data,
  not medical advice; the owner picks the numbers.

## Decisions (the architect's, 2026-11-01; the executing model adds its own small ones under Status)
- **D1 — Where it lives: one new section, "This morning", right under Add Entry** (before Upcoming Doses), hidden
  until there's a weigh-in. It's the first thing seen after typing the weigh-in. One card: the call in large type, a
  one-line reason, a small line with this morning's scale (the owner's choice, 2026-11-01: the smoothed trend's value
  stays off the card, it's Phase 2's chart line and Developer Mode's table), and, when a change is pending, what it's
  leaning to. Nothing else on the page changes in Phase 1 (Current Trend's weekly rate and rolling average stay: the
  owner knows them). Not inside `.med`: it works with no GLP-1 medication.
- **D2 — The trend is Holt's double exponential smoothing over calendar days**, α = 0.2, β = 0.1, level seeded at the
  first weigh-in, slope at the pace goal's rate (a loss of t% a week of that weight, per day; the sign flipped for a
  gain goal) (*The math*). So a change of the pace goal re-seeds the trend's first weeks only (the seed is forgotten by
  the fourth week); the trend's value isn't shown on the card (D1), so nothing on the page reads differently. It's a second derived
  series beside `averaged` (the 7-day averages), kept apart: **goals, ETAs, projections, the chart's goal tags and the
  progress image keep going by the 7-day average** (the invariant stands; changing what "reached" means is a separate
  decision the owner hasn't asked for).
- **D3 — Nothing is stored.** The trend, the pace, the call and its pending change are computed from the weigh-ins and
  the pace goal every render, by walking the weigh-ins from the first. So every device shows the same call, a corrected
  or deleted weigh-in simply recomputes, backups and sync don't change, and there's no new key. The walk is cheap
  (hundreds of weigh-ins, a handful of operations each).
- **D4 — The pace the call reads is the level's change over 14 days**, as % a week, compounded as `weeklyTrend` does,
  taken from the latest weigh-in back to the latest weigh-in at least 14 days older. No pace (and no call) until there
  is such a weigh-in and at least 10 weigh-ins in all; the card says so plainly until then.
- **D5 — The zones, from the pace goal already set (target t, range r, as `paceStatus` reads them):** the call toward
  eating *more* ("Eat fully": the pace is faster than a lose goal, slower than a gain goal) **enters** once the pace is
  more than `t + r` off in that direction and **leaves** once it's back to `t`; the call toward eating *less* ("Eat a
  bit lighter") **enters** past `t ± 2r` and **leaves** once back within `t ± r`. With r = 0 both lines coincide at t
  (the owner's choice to set r = 0; the default r is 0.25). Direction follows `paceGoal().dir` so a gain goal reads
  right. The architect's reasons: the cheap mistake comes in at the green edge, the costly one at the yellow edge; the
  measured flip rates are under *What the numbers say*, and the owner is advised to set r = 0.25. *To make it symmetric
  instead: enter both at `t ± 2r`, leave both at `t ± r`.*
- **D6 — Two mornings in a row.** A change of call takes effect only when two consecutive weigh-ins ask for the same
  new call; a single morning asking for it shows as "Leaning to …" on the card and is forgotten if the next morning
  doesn't agree. A jump straight from "fully" to "lighter" (or back) is allowed under the same rule.
- **D7 — The call belongs to the latest weigh-in's morning.** When that isn't today, the card labels it with the day
  ("Thursday's call") and says "Weigh in for today's". Nothing nags, no switcher dot (`attention` stays the doses').
- **D8 — No dose-cycle correction.** Not in the math, not as a setting. Phase 2 puts a read-out in Developer Mode (the
  scale's average departure from the trend by day since the last dose, with the count of cycles) so the owner can see
  whether one is ever warranted. The line to revisit this: a consistent swing of 0.5 lb or more on 12+ cycles.
- **D9 — No calories anywhere.** The card speaks in pounds (or kg) and % a week only.
- **D10 — Wording, the owner's three calls, verbatim:** "Eat fully", "Eat normally", "Eat a bit lighter". Colors from
  the theme tokens: fully in the accent blue, normally in `--good`, lighter in `--warn`; never `--bad` (nothing is
  wrong when you're behind pace). A gain goal uses the same three words.
- **D11 — The pace goal stays one number in this plan.** The owner lowers it by hand in start-up info at goals (the
  architect's suggestion, for the owner to take or leave: 1% to 170, 0.75% to 155, 0.5% to 145). Phase 3, a pace per
  goal that steps down on its own, touches stored data (`goals` / `goalsAsEntered` would gain a pace each) and sync, so
  it's only sketched here and waits for the owner's yes.

## The math (the specification for Phase 1; `apps/bosco/call.js`)
All of it runs over `w`, the weigh-ins sorted by date (`weightEntries()`), in `S.unit`; nothing here rounds until it's
shown. Constants in `app.js`: `CALL_ALPHA = 0.2`, `CALL_BETA = 0.1`, `CALL_DAYS = 14`, `CALL_MIN_WEIGHINS = 10`,
`CALL_RESTART_DAYS = 30`.

**1. The smoothed trend, `smoothed(w)` → `[{ date, level, slope }]`, one per weigh-in (parallel to `w`, like `averaged`).**
- The first: `level = weight`, `slope = seed(weight)` where `seed(x) = −x × t / 100 / 7` for a lose goal and
  `+x × t / 100 / 7` for a gain goal (`t = paceGoal().weeklyPct`): "assume on pace until the scale says otherwise".
- Each next weigh-in, with `g = daysBetween(previous.date, date)` (≥ 1; a missed day just makes g bigger):
  - forecast `F = level₋₁ + slope₋₁ × g`
  - `level = F + α × (weight − F)`
  - `slope = slope₋₁ + β × ((level − level₋₁) / g − slope₋₁)`
- A gap of more than `CALL_RESTART_DAYS` days starts over at that weigh-in (`level = weight`, `slope = seed(weight)`):
  a slope projected across a month of nothing means nothing.

**2. The pace at a weigh-in i, `paceAt(w, sm, i)` → `{ rate, apart }` or null.** Let j be the latest weigh-in with
`daysBetween(w[j].date, w[i].date) ≥ CALL_DAYS`; none, or fewer than `CALL_MIN_WEIGHINS` weigh-ins up to i, or a
restart between j and i → null. Else `apart = daysBetween(w[j].date, w[i].date)` and
`rate = 1 − (sm[i].level / sm[j].level) ^ (7 / apart)` (a fraction a week, positive = losing, as `weeklyTrend`).

**3. The call walk, `walk(w)` → the state after each weigh-in.** With `g = paceGoal()`, `t = g.weeklyPct`,
`r = g.rangePct`, and for each i with a pace, `pct` = the pace toward the goal in % (`rate × 100`, negated for a gain
goal, as `paceStatus` does; rounded to 2 places then compared less a hair, as there). Keep `state` ("normal" to start)
and `pending` (null to start). The zone the morning asks for, `wanted`:
- from any state: `pct > t + r` → "fully" wanted … *but* if `state` is already "fully" it stays wanted while `pct > t`;
- from any state: `pct < t − 2r` → "lighter" wanted … *but* if `state` is already "lighter" it stays wanted while
  `pct < t − r`;
- otherwise "normal" wanted.
Then: `wanted === state` → `pending = null`; else `wanted === pending` → `state = wanted, pending = null`; else
`pending = wanted`. A weigh-in without a pace leaves state and pending as they were. The function returns the list of
`{ date, state, pending, pct, level }` (null `pct` where there's no pace), and `morningCall()` the last one plus
`waiting` (what's missing, as words, when there's no call yet) and `scale` (the latest weight).

Worked checks (made-up, verified by the architect, for the tests; goal 1% ± 0.25% a week throughout):
- A straight line from 200 lb losing 0.4 lb a day, no noise → after 21 days the level is 0.10 lb above the line and
  the slope −0.39 lb/day (an EMA with α = 0.2 sits 1.6 lb above the line).
- A line losing exactly 1% a week from 190 lb, no noise → the pace reads 1.00% at every morning with one; the call is
  "Eat normally" and never leans. Losing 1.5% a week → the first morning with a pace (the 15th weigh-in) reads 1.44%
  and leans to "Eat fully", the next confirms it; 0.5% a week → 0.57%, leaning to "Eat a bit lighter", confirmed next
  morning (the pace then settles at 1.58% and 0.43%: the seed's memory, gone by the fourth week).
- The on-pace line, then the scale 4 lb up and staying up: the first such morning reads 0.79% → still "Eat normally",
  nothing leaning; the second 0.59% (leaning, with r = 0.125; nothing yet with 0.25); with r = 0.25 the third morning
  reads 0.43% and leans to "Eat a bit lighter", the fourth (0.28%) makes it the call.

## Phase 1 — the morning call: the smoothed trend, the two-week pace, the call, its card (Bosco +0.100 → 9.237)
**Goal:** after a weigh-in, one line says what to do today, and it changes rarely and for a reason the card states.

**Read first:** `apps/bosco/CLAUDE.md`; `app.js` lines 61–100 (the constants) and 103–122 (the state); `trend.js` in
full (124 lines: `weightEntries`, `weeklyTrend`, `paceGoal`, `fmtPaceGoal`, `fmtPaceBand`, `paceStatus`, `averaged`,
`model`); `render.js` lines 1–12 (the imports) and 110–132 (`renderStats`, the stat card to copy) and `renderAll`;
`markup.js` lines 118–127 (Add Entry: the new section goes right after it); `treatments.js` lines 1–30 (a file that
holds both math and its section, as `call.js` will); `events.js` lines 199–230 (`bugState`); `bosco.css` (108 lines);
`index.html` lines 301–311 (Bosco's scripts); `tests/bosco-goals.test.js` lines 1–20 and 55–80 (how a Bosco test
imports made-up weigh-ins: `gen.bosco({ weights })` through `importBackup`), `tests/lib.js` line 160 (what it exports:
`open`, `importBackup`, `travel`, `text`, `has`, `eq`), `tests/generate.js` lines 308–326 (`bosco`).

### 1.1 Constants (`app.js`, ~6 lines)
The five `CALL_*` constants from *The math* in `Object.assign(A, { … })`, with a comment each (what the owner would
read: "the trend's memory", "a change needs two mornings").

### 1.2 The model and the card: `apps/bosco/call.js` (new, ~170 lines; `index.html` after `trend.js`)
Header: what it owns (the morning call: the smoothed trend, the two-week pace, the call with its hysteresis, the card).
Wrapped as the other files; destructure `mean`, `daysBetween`, `fmtNum`, `fmtSigned`, `fmtWeekday`, `todayStr`, `SEP`
from `K.util` and the constants from `A`.
- `smoothed(w)`, `paceAt(w, sm, i)`, `walk(w)`, `morningCall()` exactly as *The math*; `model()` in `trend.js` gains
  `call: A.morningCall()` (one more line; the walk runs once per render, with `w` it already has — pass `w` in rather
  than refiltering).
- `renderCall({ w, call })`: `$("callSection").hidden = !w.length`. Three states of the card:
  - **waiting** (no pace yet): the big line reads "First call after 14 days of weigh-ins" (or "… after 10 weigh-ins",
    whichever is missing), the small line this morning's scale ("This morning 183.9 lb").
  - **a call**: the big line "Eat fully" / "Eat normally" / "Eat a bit lighter" (class `call-fully` / `call-normal` /
    `call-lighter`); the reason line: "Your trend is losing 1.52% a week over the last two weeks — faster than your 1%
    goal." (or "on your 1% goal", "slower than your 1% goal"; "gaining" for a gain goal; the goal from
    `fmtPacePct(g.weeklyPct)`); the small line "This morning 183.9 lb" (the scale, never the trend's value), and when
    `pending`: "Leaning to Eat normally — one more morning like this and it changes." The label above the big line:
    "Today's call", or when the latest weigh-in isn't today (D7) "Thursday's call" (`fmtWeekday`) with "Weigh in for
    today's" after the small line.
- Expose with `Object.assign(A, { smoothed, paceAt, walk, morningCall, renderCall })`; `renderAll` in `render.js`
  calls `A.renderCall(m)` right after `renderUpcomingDoses` (so the page reads top to bottom as the markup does).

### 1.3 The section (`markup.js`, ~10 lines; `bosco.css`, ~8 lines)
After Add Entry's `</section>`: `<section id="callSection" hidden><h2>This morning</h2><div class="stat call"> … </div>
</section>` with ids `callLabel`, `callText` (the big line, class `val`), `callWhy`, `callNote`, `callLean`. CSS under
`.app-bosco`: `.call .val` larger (about 1.5em) and the three colors (D10: `--accent`, `--good`, `--warn`); the card
full width (`.call { min-width: 100%; }`); nothing that breaks at phone width.

### 1.4 Hooks (`events.js`, ~2 lines)
`bugState` gains `- Morning call: ${call ? call.state + (call.pending ? " (leaning " + call.pending + ")" : "") : "waiting"}`
— a state, never a weight or a date.

### Docs & tests
- `apps/bosco/CLAUDE.md`: the files table gains `call.js`; the description line at the top mentions the morning call;
  *Invariants* gains one: "The morning call is derived, never stored: Holt's smoothing (α 0.2, β 0.1) over calendar
  days, the level's pace over 14 days against the pace goal, 'Eat fully' in at the green edge and out at the target,
  'Eat a bit lighter' in at the yellow edge and out at the green one, a change only on two mornings in a row; goals keep
  going by the 7-day average." The root `CLAUDE.md`'s `bosco/` map line gains "a morning call (eat fully / normally /
  a bit lighter) from a smoothed trend".
- `tests/bosco-call.test.js` (new; made-up weigh-ins built in the test from a line, no noise, so every number below is
  exact; each test imports them with `importBackup(tab, gen.bosco({ doses: 0, weights }))` with the backup's `paceGoal`
  set to `{ dir: "lose", weeklyPct: 1, rangePct: 0.25 }` unless a test says otherwise):
  1. **Waiting:** 9 weigh-ins over 13 days → the card says it's waiting (and which of the two it's waiting for); the
     14th day's weigh-in, the 10th, gives a call.
  2. **The three calls** (the worked checks): 28 days on a line losing 1.5% a week → "Eat fully"; on 1% → "Eat
     normally", never leaning, the pace on the card 1.00%; on 0.5% → "Eat a bit lighter"; the reason line names
     "faster than" / "on" / "slower than" the goal.
  3. **Holt's lag:** a straight line, 0.4 lb a day for 21 days from 200 → `Kyoshi.apps.bosco.smoothed(...)`'s last
     level within 0.3 lb of the line, slope within 0.05 of −0.4 (the worked check above).
  4. **One wild morning doesn't flip it:** on the on-pace series, a morning 4 lb up → still "Eat normally", nothing
     leaning; the scale staying 4 lb up → the third such morning leans, the fourth makes it "Eat a bit lighter" (the
     worked check). Then the first wild weigh-in corrected back (re-added in Add Entry, the confirm accepted) → the
     card recomputes from the corrected series.
  5. **Yesterday's call:** no weigh-in today → the label names the weekday and the card asks to weigh in; `travel(tab,
     1)` → the same, a day later.
  6. **A missed week:** a 7-day hole in the series → no console error, the pace uses the days actually apart (check
     `walk` returns a pace for the latest morning).
  7. **A gain goal:** the backup's `paceGoal` is `{ dir: "gain", weeklyPct: 0.5, rangePct: 0.125 }`; gaining 1% a
     week → "Eat a bit lighter"; gaining 0.5% → "Eat normally".
  8. **Export then import:** the backup comes back identical (no new key) and the call is the same.

**Checks (by hand, before the full run):** every touched file's header still true; no `document.querySelector` in
`call.js`; the card at phone width (the big line wraps, nothing overflows); time travel +1 day shows "<Weekday>'s call";
a weigh-in deleted from History recomputes the card; with a pace goal of range 0 nothing throws; `node tests/run.js
bosco` green with the old Bosco tests untouched.

## Phase 2 — the trend on the chart; Developer Mode's walk and dose-cycle table (Bosco +0.100 → 9.337)
**Goal:** the owner can see the trend the call reads, and judge the call's last two weeks and the dose cycle for
themselves.

**Read first:** `apps/bosco/CLAUDE.md` (as Phase 1 left it); `call.js`; `render.js` lines 180–216 (`renderChart`);
`events.js` lines 180–200 (`renderDev`, the `.dev-block` shape); `doses.js` for how a dose day is known
(`hasDose`, `S.entries`); `core/kyoshi.css` lines 220–235 (`.dev-block`, `.dev-hint`); `tests/bosco-goals.test.js`
lines 17–19 (how the chart is counted in a test).

### 2.1 The chart (`render.js`, ~6 lines; `bosco.css`, ~2 lines; `markup.js`, ~1 line)
A thin dashed path of `smoothed(w)`'s levels over the weigh-ins' dots (class `trend`; after the `line` path, before
the circles), and a legend entry "Trend". The progress image stays as it is (the owner's choice of 2026-10-08: straight
lines between weigh-ins).

### 2.2 Developer Mode (`call.js` or, if it would pass ~400 lines, a new `call-dev.js` after it; `events.js`, 1 line)
`renderDevCall(box)`, called from `renderDev` after the treatments' block, two `.dev-block`s:
- **The last 14 mornings:** a small table — date, scale, trend, pace (%/wk), wanted, state (and "leaning" where
  pending) — straight from `walk(w)`. The owner's way to see why the call is what it is.
- **The dose cycle:** for each day since the last dose (1 … the plan's interval; dose day morning counts as the full
  interval), the mean of (scale − trend) over the weigh-ins at that day of the cycle, with how many cycles it rests on;
  a `dev-hint` saying what would warrant a correction (D8: a consistent 0.5 lb on 12+ cycles) and that nothing is
  corrected. Doses come from `S.entries` (`hasDose`); fewer than 3 cycles → "Not enough dose days yet."

### Docs & tests
- `apps/bosco/CLAUDE.md`: `call.js`'s line (and `call-dev.js` if split); *Invariants*: the chart's trend line; D8 as a
  line. The root map line unchanged.
- `tests/bosco-call.test.js` gains: (9) the chart has a `path.trend` once there are 2+ weigh-ins, none with one;
  (10) Developer Mode shows the 14-row table with the state matching the card, and the dose-cycle block with a row per
  cycle day for a backup with doses every 5 days (`gen.bosco({ intervalDays: 5, doses: 4, weights })`), "Not enough"
  with 2 doses.

**Checks (by hand):** the dashed line sits through the dots (not above them, as an EMA would); the dev table at phone
width scrolls sideways rather than breaking the panel; a backup with no doses shows the cycle block's "Not enough".

## Phase 3 — the pace goal stepping down at goals (sketch; needs the owner's yes, then a phase written in full)
**What it would be:** each goal weight carries the pace to use *until it's reached* (default: the one pace goal, so
nothing changes for anyone who doesn't set them); `paceGoal()` returns the pace of the nearest goal not yet reached;
the morning call, Current Trend's colors and start-up info's note follow it. The owner's ladder, if they want the
architect's suggestion: 1% to 170, 0.75% to 155, 0.5% to 145 (lb).
**What it touches:** stored data — a pace on each goal (`goals` are bare numbers; `goalsAsEntered` is the parallel
list that could carry `{ weight, unit, pacePct, rangePct }` additively), so `normalizeBackup`, `combine` (goals are
joined from both saves; a pace on the same goal from two devices needs a rule: the later `savedAt`'s, as the dosing
plan does), `importBackup`, the goals table (a pace column or a note per row) and older copies of Bosco dropping the
field when they save (the changelog's "Reload Bosco on every device"). Bosco +1.
**Questions for the owner before planning it:** (a) do you want it at all, or will you lower the one pace goal by hand
at each goal? (b) a pace per goal, or a single rule ("drop by 0.25% at each goal from 170 down")? (c) should the
morning call's band widen as the pace drops (0.5% ± 0.125% is a tight band)?
