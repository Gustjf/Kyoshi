# Turtleduck — meals and groceries (a Kyoshi app)
Meals for this week and next. Recipes are typed in, or written out by the batch in a plain text format and pasted
(Paste recipes). On the computer they're dragged onto a Mon–Sun grid; tapping works everywhere, and it's how the phone
plans. A recipe on a meal is cooked and eaten there, and its other portions wait on the shelf (Leftovers) to drag onto
later days. A recipe on the Cook row is cooked that day for later. Each day shows its kcal and macros against the
targets. Shopping trips are placed on the days, each with its grocery list worked out from the meals until the next trip:
merged by name (plurals too) and unit (any weight together, any volume together), in store sections, the amounts shown as
entered, metric or US, ticked on the phone (it opens on Groceries). The cook view is a phone stand
that keeps the screen on. **Times & trips** sets when you usually eat and cook, how long meals take, and your grocery trips
every week (each day can differ); the lists go by those times. **Momo** keeps the meals and the scheduled trips in its
baseline at those times, fixed there; once a week is confirmed here its meals fill them (a cooking session or an extra trip
a pinned card of its own). Named after Zuko's turtleducks (the icon is Lucide's cooking-pot, in amber).
Rules, versioning and the app contract: the root `CLAUDE.md`. Version & changelog: `changelog.js`.

## Files (load order)
| File | What's in it |
|---|---|
| `app.js` | `Kyoshi.register` (name, title, icon, 1180px wide, backup note, its checkup); constants (limits, `MEALS` with Cook last, `TYPES`, `MOMO_MEALS`, `SLOTS` (the meals with a slot in Momo's baseline), `DEFAULT_TIMES`, `DEFAULT_LENGTHS`, `MIN_LENGTH`/`MAX_LENGTH`, `SNACK_TIME` (a snack, for the lists), the minutes of Momo's cards: `GROCERY_MINUTES` 45, `DEFAULT_COOK_MINUTES` 45, `QUICK_MINUTES` 20, `RESTAURANT_MINUTES` 60; `SHELF_DAYS` 28, `SECTIONS`, `UNIT_MODES` (how the lists show amounts), `NUTRIENTS`, `CLIP_MS` 5000, `PAGE` 30, `PLAN_PX` 900, `PHONE`); state `A.S`; helpers (text, numbers, days: `mondayOf`, `thisMonday`, `planEnd`, `inPlan`, `dayIndex`, formats; times: `onGrid`, `scheduleOn`, `usualTime`, `slotTime`, `isOwnTime`, `slotMinutes`, `tripTime`, `mealTime`, `moment`, `nowMoment`; `isConfirmed`); lookups remembered by `S.version` and the day (`remember`): recipes, entries, cells, trips (the schedule's worked out: `liveTrips`, `isSkipped`), templates, `nameOf`, `lastCooked`/`cookedTimes`, `yieldOf`, `leftoversOf`, `portionsLeft`, `shelf`, `addUp` (nutrition), `fmtMacros`, `entryMinutes` |
| `markup.js` | the page: the nav, Plan (tabs, Confirm and the line about Momo, ⋯ menu, grid, sidebar, the phone's list), Recipes, Groceries (add by hand, the lists, Settings with Times & trips…), the cook view, Backup & sync, and the pop-ups (picker, a meal's, recipe, Paste recipes, Save as template, Times & trips) |
| `changelog.js` | version history |
| `data.js` | cleaning (every copy, new ones too: `cleanSettings` with the times, lengths and schedule, `cleanSlotTimes`, `cleanTripSkips`, `cleanConfirmed`), `load`, `persist`/`save` (each key only when changed), backups and sync merge (`A.data`) |
| `times.js` | Times & trips (`openTimes`, its checks, Save; `wireTimes`) and a day's own time (`setSlotTime`: a meal's row, the Cook row, a trip) |
| `ingredients.js` | `parseLine` ("2 cups rice, rinsed" → qty, unit, name, note, norm (last word singular: `singular`), key (norm and base unit), plural, oldKey (the key before 1.300)), the units (oz, lb, fl oz, pint, quart, gallon, stick too) and base units (every weight in g, every volume in ml; counts their own), `fmtAmount`/`fmtLine` (as entered, metric or US), `scaledLine` (the cook view, in the line's own unit), `guessSection` |
| `paste.js` | `parsePaste` (the format) and the Paste recipes pop-up (preview, ticks, Add) |
| `groceries.js` | the lists (`lists`: Now and each trip's, by moments, rows merged and ticked), trips (`toggleTrip`: one placed by hand, or the schedule's skipped and back), a meal's groceries (`coverageOf`), ticks, groceries added by hand, sections, the Groceries view (a trip's time on its list), Settings (amounts: `setUnits`; targets) |
| `share.js` | what Momo reads (`routine`, `inbox`) and opens (`open`); what Turtleduck reads of Momo (`momoStatus`) |
| `confirm.js` | a week confirmed for Momo: `weekSummary`, `confirmWeek` (asks, saying what goes and what's missing), `unconfirmWeek`, `statusLine` (the line about Momo), `unconfirmed` (for the dot), `mondayFor` |
| `plan.js` | the plan's changes (`canPlace`, `addRecipe`, `addPortion`, `addOwn`, `moveEntry`, `copyEntry`, `dropEntry`/`removeEntry`, `updateEntry`, `alsoOn`), sums (`dayTotals`, `weekAverage`, `pastTarget`), the ⋯ menu's actions (Copy last week, templates, Clear week) |
| `plan-view.js` | draws the Plan view: the tabs (confirmed or not), Confirm and the line about Momo, the grid (chips with their groceries mark, carts with their trip's time, totals), the sidebar (search, shelf, recipes), the phone's list (each week headed by its line and Confirm), the ⋯ menu (Times & trips…, Un-confirm week); `revealCell` |
| `plan-popups.js` | the picker, a planned meal's pop-up (that day's time for its row and Usual, its groceries, ×, portions, Also on…, Read, Edit recipe, Replace…, Remove), Save as template |
| `drag.js` | the browser's drag and drop on the grid (mouse only): recipes, portions, planned meals |
| `clipboard.js` | Momo's copy, cut and paste by the mouse's place (Ctrl/⌘+C, X, V; `CLIP_MS`) |
| `recipes.js` | the Recipes view and the recipe pop-up (Save, Save & add another, Archive, Delete) |
| `cook.js` | the cook view: `openCook`, paging a day's recipes, Back |
| `render.js` | `showView` (plan, recipes, groceries or cook), `renderAll`, `reveal` |
| `events.js` | `A.init` wiring and the hooks: `onShow`, `onHide`, `onTick`, `onReload`, `onKeydown`, `awake` (the cook view keeps the screen on: core/wakelock.js), `attention` (a dot while a week isn't confirmed, else while today or tomorrow has no dinner), `bugState` |
| `turtleduck.css` | styles under `.app-turtleduck` (`--turtleduck-amber` page-wide) |

## State (`A.S`)
Saved and synced (each list item keeps `deleted`, `at` and `u`; a deleted one keeps only those, as a marker):
- `recipes` [{ id, name ≤ 40, meal ("breakfast" | "lunch" | "dinner" | "snack" | "any": the only tag), ingredients (lines as
  typed, ≤ 60 of ≤ 100: parsed when read, so a better parser improves them all), steps (≤ 4000, as typed), prepMin, cookMin
  (0–600 or null), servings (1–50: the yield at ×1), kcal, protein, carbs, fat, fiber (per serving, null when unknown),
  link, archived, deleted, at, u }]: archived is hidden from the sidebar, the picker and the list (folded), still live.
- `plan` [{ id, date, meal ("breakfast" | "lunch" | "dinner" | "snack" | "cook"), kind ("recipe" | "quick" | "restaurant" |
  "skipped"), recipeId, name (the recipe's as placed, shown once it's deleted; a quick meal's or restaurant's text),
  leftover, from (a leftover's batch: its cooked entry), scale (a batch's ×, 0.5–10 in halves), servings (portions eaten
  there: 1 unless changed; 0 on the Cook row), kcal, protein, carbs, fat, fiber (a quick meal's or restaurant's own, for
  the whole meal), deleted, at, u }]: at orders a cell (a moved meal goes last).
- `trips` [{ id, date, deleted, at, u }]: a shopping trip; one a day (the earliest placed wins, both go on untick).
- `checked` { "<name>|<unit>": { ranges: [[from, until], …], u } }: bought for every planned use in those days. Ticking in a
  list adds its days (joined with any they touch); unticking takes them out, so the other lists stay as they were. Days
  before today are let go at the next tick. No ranges: unticked (kept, so sync carries the untick). A key with no entry
  goes by its lines' keys before 1.300 (`oldKey`: bought when each is, for its own days); its first tick starts from the
  lists that showed it bought, so they stay so.
- `manual` [{ id, text ≤ 60, done (the day ticked, ""), deleted, at, u }]: added by hand; shown until the day after it's ticked.
- `sections` { "<name>": { section, u } }: a store section set by hand, by ingredient name (the norm; else the names its
  lines had before 1.300; else guessed). New writes use the norm.
- `templates` [{ id, name ≤ 30, entries: [{ day 0–6, meal, kind, recipeId, name, leftover, from (an index in entries, or -1),
  scale, servings, kcal…fiber }], deleted, at, u }] (≤ 20).
- `settings` { targets: { kcal, protein, carbs, fat, fiber } (null: none), units ("entered" (default, and for files
  without it) | "metric" | "us": how the lists show amounts), times: { breakfast, lunch, dinner, cook, trip } (the usual
  times, "HH:MM" on the 15-minute grid; trip: one placed by hand), lengths: { breakfast, lunch, dinner } (minutes, 5–240 in
  5s: a slot's in Momo while no meal fills it), schedule: [{ day 0–6 (Monday first), time }] (a trip every week, a weekday
  each at most, by day), u } — a file from before 2.300: the defaults (07:30, 12:00, 18:00, 16:00, 10:00; 15, 30, 45; none).
- `slotTimes` { "<date>:<breakfast|lunch|dinner|cook|trip>": { time ("HH:MM", or "" once back to the usual: kept, so the
  clearing wins on sync), u } }: a day's own time.
- `tripSkips` { "<date>": { skip, u } }: a scheduled trip's day with no trip after all (false: back on, kept likewise).
- `confirmed` { "<Monday>": { at (when it was confirmed; 0: un-confirmed, kept likewise), u } }: that week's meals are on Momo.
This device only: `version` (counts changes, for `remember`), `view`, `back` (where the cook view goes back to), `week`,
`search`, `listSearch`, `editing`, `picking`, `entry`, `cooking`, `paste`, `clip`, `mouse`, `drag`, `menu`, `boughtOpen`,
`sideClosed`, `lastType`, `knownToday`, `timesSnapshot` (Times & trips' form as opened).

## Storage (`A.store`) and backups
Keys: `recipes`, `plan`, `trips`, `checked`, `manual`, `sections`, `templates`, `slotTimes`, `tripSkips`, `confirmed`,
`settings`, plus core's `sync` and `meetings`. Backup JSON: `{ schemaVersion: 1, appVersion, recipes, plan, trips, checked,
manual, sections, templates, slotTimes, tripSkips, confirmed, settings }` (plus core's `meetings`; still schema 1: a file
from before 2.300 has none of the three maps nor the settings' times, and reads as the defaults). `looksLike`: `recipes`
and `plan` are both lists (no other app keeps both). Import JSON refuses a file with no live recipes and no live planned
meals, warns on a newer `schemaVersion`, confirms with counts and replaces all eleven. Sync merges the five lists item by
item by `u` (Appa's merge), `checked`, `sections`, `slotTimes`, `tripSkips` and `confirmed` key by key by `u`, and
`settings` whole. An older copy drops the three maps and the settings' new fields when it saves: reload on every device.

## Its checkup
`meetings` in `app.js`: a 15-minute checkup, no schedule ("Last checkup: 12 days ago" with Done ✓; core/meetings.js).

## Shared with other apps
`A.routine()` (core/routine.js; fresh copies): the slots Momo keeps in its baseline — `{ id: "<meal>:<day>" (day 0 = Monday),
title: "Breakfast" | "Lunch" | "Dinner", day, time: the usual time, minutes: the usual length }` for each of the three meals
every day, and `{ id: "groceries:<day>", title: "Groceries", day, time, minutes: 45 }` for each weekday on the trip schedule.
Momo follows a change within a minute.
`A.inbox(from, to)` (core/inbox.js; read-only copies, made afresh each call): only for the days of a week confirmed here
(`S.confirmed`, its Monday's `at` > 0; trips too), all `fill: "card"`, `fixed: true` (Momo pins each at its `time`, never moves
it, and never puts it in Tasks), from `from` (Momo asks from this Monday, so this week's past meals are on their days too, as the
record of the week; meals carry no `done`: the plan is taken as eaten):
- each day's breakfast, lunch and dinner with anything but skipped meals: `{ id: "meal:<date>:<meal>", title: "Dinner: " and
  the names joined " + " (≤ 60), date, time: that day's (its own, else the usual), slot: "<meal>:<day>", block: "Dinner",
  minutes: the sum of `entryMinutes`, details: [the slot's nutrition, a line per meal: "Cooked here · serves 4", "Leftovers of
  Mon's Chili", "Quick meal", "Restaurant"] }`: it fills that day's slot card in Momo; snacks never.
- each day's Cook row: `{ id: "cook:<date>", title: "Cook: Curry ×1½ · Chili" (a batch's × when it isn't 1), date, time: that
  day's for the Cook row, minutes, details: ["2 recipes · 13 portions", "Curry ×1½ · Chili ×1"] }`: a card of its own.
- each trip from today on (the schedule's and those placed by hand): `{ id: "groceries:<date>", title: "Groceries", block:
  "Groceries", minutes: 45, date, time: its time, slot: "groceries:<day>" when its weekday is on the schedule (else a card of its
  own), details: ["12 items", "for meals Oct 3 – 11"], done: nothing left to buy on its list }`. The Now list never goes to Momo.
`A.open(id)` (Momo's "Open in Turtleduck"): a meal's recipes (cooked or leftover) in the cook view (none: its cell on the
plan, flashing); a Cook row's recipes in the cook view, paged; a Groceries need, its list on Groceries, flashing; a slot's id
("dinner:3", "groceries:6": Momo's "Set in Turtleduck" on an empty slot) or "times", Times & trips.
`A.momoStatus(monday)` reads Momo's `weekStatus(monday, "turtleduck")` (guarded: null until every app has started, or when
Momo can't be read), for the line under each week's tab.

## Invariants
- Worked out, never stored: portions left, the shelf, last cooked and cooked N× (cooked entries up to today, not portions),
  the lists, totals and averages. "Today" is `K.util.todayStr()`; `Date.now()` only for `at` and `u` stamps.
- A batch yields round(servings × scale); portions left = yield − eaten there − its leftovers' portions, and can go below
  zero (shown in red, never thrown). A portion goes only on a day on or after its batch's, never on the Cook row; a batch
  moved later than its leftovers leaves them (both marked, its pop-up says so). Copying a batch cooks it again.
- Trips: one placed by hand (the cart; one a day, the earliest placed wins) or the schedule's, worked out and never stored
  (`liveTrips`: each scheduled weekday from last Monday to the plan's end with none placed by hand and not skipped). The
  cart on a scheduled weekday skips that day's trip (`tripSkips`, `skip: true`; one placed by hand there goes too) and
  brings it back (`skip: false`); elsewhere it places or removes a trip. A trip's time: that day's own (`slotTimes`, set on
  its list), else its weekday's on the schedule, else `settings.times.trip`.
- Times: every one on the 15-minute grid (Times & trips, a day's own from a meal's pop-up or a trip's list, and the
  cleaners all check it), so Momo pins exactly where Turtleduck says. A day's own time is kept until set back to the usual
  (`""`, kept so the clearing wins on sync); a meal's row shares one time for everything in it; a snack is at `SNACK_TIME`
  for the lists. Time fields are kept once they're left (or on Enter): they report each digit typed as a change.
- The lists go by moments ("<date> <time>"): a trip's list holds the batches cooked from its moment up to the next trip's
  (the last through next Sunday's end), Now from today's start to the first trip's; a meal is at its row's time that day.
  Each keeps its days (`from`, `through`: the next trip's day when a meal it holds falls on it, else the day before) for its
  words and its ticks, so ticks still go by days: on a day two lists share (a 6 pm trip), what's needed only that day shows
  bought on both once either is ticked (accepted).
- A cooked meal's groceries (`coverageOf`, shown from today on): its trip is the last before it by moments (one placed by
  hand any day, the schedule's from last Monday); none → amber ("no trip before this"); that trip past and any of the
  recipe's lines not bought for the meal's day (its key's ticks, else its old key's) → red ("3 not bought": they're on
  Now); else no mark. Leftovers, quick meals, restaurants and skipped meals have none.
- Confirm (per week, by its Monday): asks first, saying what goes (its meals, cooking sessions and trips) and what to look at
  (days from today with no dinner; cooked meals with no trip before them), then confirms anyway; later changes follow by
  themselves; Un-confirm (the ⋯ menu) takes the week off Momo. The line under each week's tab: not confirmed → "Not on Momo
  until you confirm the week"; confirmed and Momo's week planned → "On Momo ✓"; confirmed and not → "On Momo, but its week has
  no baseline yet: load it there so the meals have their slots"; Momo unreadable → nothing.
- A list's rows: every live batch (not leftovers; recipe not deleted) cooked in its range, each line parsed and scaled,
  merged by `norm|base`: the name's last word singular ("ies" → y, "oes" → o, "ves" → f, "ches/shes/sses/xes" drop
  "es", else a trailing s goes unless "ss"; hummus, couscous, asparagus, molasses as they are; olives, chives, cloves,
  endives, cookies, brownies, veggies, pies, chilies, chillies, quiches named), every weight in g (kg, oz, lb) and every
  volume in ml (l, tsp, tbsp, fl oz, cup, pint, quart, gallon); counts (can, clove, slice, bunch, head, pkg, pinch,
  piece, stick) merge only with themselves; a line with no amount is a row with none. A row keeps the first spelling;
  a count over one shows the first plural spelling when a recipe wrote one ("3 onions"). A row is ticked when one of its
  key's ranges holds every use of it in that list (a trip moved or removed re-cuts the lists; ticks keep their days).
- Amounts by `settings.units`: "entered" shows a weight or volume in the unit its lines used when they agree (exact,
  neat fractions when spot on; g/kg and ml/l as metric), the US way when they're all US units, else metric; "metric":
  g → kg and ml → l from 1000; "us": oz under 16 oz, then lb, to a decimal; tsp under 3 tsp, tbsp under 4 tbsp, cups
  up to 4, then quarts, gallons from 4 quarts, to the nearest ¼ or ⅓ (under ⅛ as it is). Counts are shown as they are.
  The cook view scales each line in its own unit ("2 tbsp" doubled is "4 tbsp").
- A day's totals leave out the Cook row and skipped meals; "?" when a meal has no kcal. The week's average takes each
  nutrient over the days that have it. Targets warn: kcal, carbs and fat over theirs; protein and fiber under theirs.
- A deleted recipe: planned meals keep its name (refreshed to its last one at delete), add nothing to a list, and its
  portions leave the shelf; the cook view says it's gone. Dangling `recipeId`s and `from`s never throw.
- Drag and drop is the mouse's (HTML5); the phone taps. Copy and paste is Momo's: keys and the mouse's place, no buttons.
- Every cleaner drops what it can't use, so a damaged file never breaks the app. Weeks run Monday to Sunday, as in Momo.
- Not now: photos, importing from links, a pantry, nutrition databases, counts as weights (a stick of butter, a can),
  sizes ("2 large onions" is its own row), T/t/c for tbsp/tsp/cup, custom store sections, printing, timers, a favourite
  star, drag and drop on touch.
- The dot on the icon (`A.attention`): once Turtleduck is in use (a recipe or a planned meal), while this week isn't
  confirmed ("this week's meals aren't confirmed"), else from Friday while next week isn't ("next week's…"), else while
  today or tomorrow has no dinner planned (anything in its slot counts, Skipped too); it clears once one is.
- Bug reports and console messages hold counts only: never recipe names, ingredients or meals.
