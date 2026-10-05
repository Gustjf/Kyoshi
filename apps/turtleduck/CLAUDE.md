# Turtleduck — meals and groceries (a Kyoshi app)
Meals for this week and next. Recipes are typed in, or written out by the batch in a plain text format and pasted
(Paste recipes). On the computer they're dragged onto a Mon–Sun grid; tapping works everywhere, and it's how the phone
plans. A recipe on a meal is cooked and eaten there, and its other portions wait on the shelf (Leftovers) to drag onto
later days. A recipe on the Cook row is cooked that day for later. A store-bought item (a recipe marked so) is eaten where
it's placed, never cooked; how many are on hand can be tracked, used up by the plan. Each day shows its kcal and macros
against the targets. Shopping trips are placed on the days, each with its grocery list worked out from the meals until
the next trip: merged by name (plurals too) and unit (any weight together, any volume together; a recipe with no lines
by its name, a store-bought item by count once what's on hand runs out), in store sections, the amounts shown as
entered, metric or US, ticked on the phone (it opens on Groceries). The cook view is a phone stand that keeps the screen
on. **Times & trips** sets when you usually eat and cook, how long meals take, and your grocery trips
every week (each day can differ); the lists go by those times. **Momo** keeps the meals and the scheduled trips in its
baseline at those times, fixed there; once a week is confirmed here its meals fill them (a cooking session or an extra trip
a pinned card of its own). Named after Zuko's turtleducks (the icon is Lucide's cooking-pot, in amber).
Rules, versioning and the app contract: the root `CLAUDE.md`. Version & changelog: `changelog.js`.

## Files (load order)
| File | What's in it |
|---|---|
| `app.js` | `Kyoshi.register` (name, title, icon, 1180px wide, backup note, its checkup); constants (limits, `MEALS` with Cook last, `TYPES`, `MOMO_MEALS`, `SLOTS` (the meals with a slot in Momo's baseline), `DEFAULT_TIMES`, `DEFAULT_LENGTHS`, `MIN_LENGTH`/`MAX_LENGTH`, `SNACK_TIME` (a snack, for the lists), the minutes of Momo's cards: `GROCERY_MINUTES` 45, `DEFAULT_COOK_MINUTES` 45, `QUICK_MINUTES` 20, `RESTAURANT_MINUTES` 60; `SHELF_DAYS` 28, `MAX_STOCK` 999, `SECTIONS`, `UNIT_MODES` (how the lists show amounts), `NUTRIENTS`, `CLIP_MS` 5000, `PAGE` 30, `PLAN_PX` 900, `PHONE`); state `A.S`; helpers (text, numbers, days: `mondayOf`, `thisMonday`, `planEnd`, `inPlan`, `dayIndex`, formats; times: `onGrid`, `scheduleOn`, `usualTime`, `slotTime`, `isOwnTime`, `slotMinutes`, `tripTime`, `mealTime`, `moment`, `nowMoment`; `isConfirmed`); lookups remembered by `S.version` and the day (`remember`): recipes, entries, cells, trips (the schedule's worked out: `liveTrips`, `isSkipped`), templates, `nameOf`, `lastCooked`/`cookedTimes`, `yieldOf`, `leftoversOf`, `portionsLeft`, `shortPortions` (the leftovers an overdrawn batch can't give), `shelf`, a store-bought item's stock (`isBought`, `onHand`, `stockStart`, `runsOut`, `stockAfter`, `toBuy`), `addUp` (nutrition), `fmtMacros`, `entryMinutes` |
| `markup.js` | the page: the nav, Plan (tabs, Confirm and the line about Momo, ⋯ menu, grid, sidebar, the phone's list), Recipes, Groceries (add by hand, the lists, Settings with Times & trips…), the cook view, Backup & sync, and the pop-ups (picker, a meal's, recipe, Paste recipes, Save as template, Times & trips) |
| `changelog.js` | version history |
| `data.js` | cleaning (every copy, new ones too: `cleanSettings` with the times, lengths and schedule, `cleanSlotTimes`, `cleanTripSkips`, `cleanConfirmed`), `load`, `persist`/`save` (each key only when changed), backups and sync merge (`A.data`) |
| `times.js` | Times & trips (`openTimes`, its checks, Save; `wireTimes`) and a day's own time (`setSlotTime`: a meal's row, the Cook row, a trip) |
| `ingredients.js` | `parseLine` ("2 cups rice, rinsed" → qty, unit, name, note, norm (last word singular: `singular`), key (norm and base unit), plural, oldKey (the key before 1.300)), the units (oz, lb, fl oz, pint, quart, gallon, stick too) and base units (every weight in g, every volume in ml; counts their own), `fmtAmount`/`fmtLine` (as entered, metric or US), `scaledLine` (the cook view, in the line's own unit), `guessSection` |
| `paste.js` | `parsePaste` (the format, `Store-bought: yes` too) and the Paste recipes pop-up (preview, ticks, Add) |
| `groceries.js` | the lists (`lists`: Now and each trip's, by moments, rows merged and ticked; `needs`: a meal's lines, a recipe with no lines its name, a store-bought item its count to buy), trips (`toggleTrip`: one placed by hand, or the schedule's skipped and back), a meal's groceries (`coverageOf`), ticks, groceries added by hand, sections, the Groceries view (a trip's time on its list), Settings (amounts: `setUnits`; targets) |
| `share.js` | what Momo reads (`routine`, `inbox`) and opens (`open`); what Turtleduck reads of Momo (`momoStatus`) |
| `confirm.js` | a week confirmed for Momo: `weekSummary`, `confirmWeek` (asks, saying what goes and what's missing), `unconfirmWeek`, `statusLine` (the line about Momo), `unconfirmed` (for the dot), `mondayFor` |
| `plan.js` | the plan's changes (`canPlace`, `hasRoom`/`refused` (a batch's portions to give), `addRecipe`, `addPortion`, `addOwn`, `moveEntry`, `copyEntry`, `dropEntry`/`removeEntry`, `updateEntry`, `alsoOn`), sums (`dayTotals`, `weekAverage`, `pastTarget`), the ⋯ menu's actions (Copy last week, templates, Clear week) |
| `plan-view.js` | draws the Plan view: the tabs (confirmed or not), Confirm and the line about Momo, the grid (chips with ×2, their groceries mark, short leftovers, a bag for store-bought; carts with their trip's time, a dot when placed by hand, a slash when the schedule's is skipped; totals), the sidebar (search, shelf, recipes), the phone's list (each week headed by its line and Confirm), the ⋯ menu (Times & trips…, Un-confirm week); `revealCell` |
| `plan-popups.js` | the picker, a planned meal's pop-up (that day's time for its row and Usual, its groceries, ×, portions, Also on… (a tap one more portion, − one fewer), a store-bought item's line (on hand after it), a short leftover's line, Read, Edit recipe, Replace…, Remove), Save as template |
| `drag.js` | the browser's drag and drop on the grid (mouse only): recipes, portions, planned meals |
| `clipboard.js` | Momo's copy, cut and paste by the mouse's place (Ctrl/⌘+C, X, V; `CLIP_MS`) |
| `recipes.js` | the Recipes view (a store-bought item's on hand or the day it runs out) and the recipe pop-up (Cooked · Store-bought and On hand, Save, Save & add another, Archive, Delete) |
| `cook.js` | the cook view: `openCook`, paging a day's recipes (a store-bought item: its name, unscaled), Back |
| `render.js` | `showView` (plan, recipes, groceries or cook), `renderAll`, `reveal` |
| `events.js` | `A.init` wiring and the hooks: `onShow`, `onHide`, `onTick`, `onReload`, `onKeydown`, `awake` (the cook view keeps the screen on: core/wakelock.js), `attention` (a dot while a week isn't confirmed, else while today or tomorrow has no dinner), `bugState` |
| `turtleduck.css` | styles under `.app-turtleduck` (`--turtleduck-amber` page-wide) |

## State (`A.S`)
Saved and synced (each list item keeps `deleted`, `at` and `u`; a deleted one keeps only those, as a marker):
- `recipes` [{ id, name ≤ 40, meal ("breakfast" | "lunch" | "dinner" | "snack" | "any": the only tag), ingredients (lines as
  typed, ≤ 60 of ≤ 100: parsed when read, so a better parser improves them all), steps (≤ 4000, as typed), prepMin, cookMin
  (0–600 or null), servings (1–50: the yield at ×1), kcal, protein, carbs, fat, fiber (per serving, null when unknown),
  link, archived, bought (a store-bought item, not cooked), stock (a store-bought item's count on hand: { count 0–999,
  date: the day it was counted }, or null: not tracked; always null when not bought), deleted, at, u }]: archived is
  hidden from the sidebar, the picker and the list (folded), still live. A file from before 2.500 has neither: cooked.
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
`sideClosed`, `lastType`, `lastBought` (Cooked or Store-bought, for the next new recipe), `knownToday`, `timesSnapshot`
(Times & trips' form as opened).

## Storage (`A.store`) and backups
Keys: `recipes`, `plan`, `trips`, `checked`, `manual`, `sections`, `templates`, `slotTimes`, `tripSkips`, `confirmed`,
`settings`, plus core's `sync` and `meetings`. Backup JSON: `{ schemaVersion: 1, appVersion, recipes, plan, trips, checked,
manual, sections, templates, slotTimes, tripSkips, confirmed, settings }` (plus core's `meetings`; still schema 1: a file
from before 2.300 has none of the three maps nor the settings' times, and reads as the defaults). `looksLike`: `recipes`
and `plan` are both lists (no other app keeps both). Import JSON refuses a file with no live recipes and no live planned
meals, warns on a newer `schemaVersion`, confirms with counts and replaces all eleven. Sync merges the five lists item by
item by `u` (Appa's merge), `checked`, `sections`, `slotTimes`, `tripSkips` and `confirmed` key by key by `u`, and
`settings` whole. An older copy drops the three maps, the settings' new fields and a recipe's `bought` and `stock` when it
saves: reload on every device.

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
  minutes: the sum of `entryMinutes` (a store-bought item's `QUICK_MINUTES`), details: [the slot's nutrition, a line per
  meal: "Cooked here · serves 4" ("· 2 eaten here" when it's more than one portion), "Store-bought" ("· 2 portions"),
  "Leftovers of Mon's Chili" ("· 2 portions"), "Quick meal", "Restaurant"] }`: it fills that day's slot card in Momo;
  snacks never.
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
  zero (a lowered ×, a recipe's servings changed, two devices placing portions: shown in red, never thrown). A portion goes
  only on a day on or after its batch's, never on the Cook row; a batch moved later than its leftovers leaves them (both
  marked, its pop-up says so). Copying a batch cooks it again.
- A batch never gives more portions than it yields (`hasRoom`): one more is refused with an alert saying why (`refused`:
  a portion picked, Also on…, a pasted copy of a leftover, the Portions + of a leftover or of the batch itself; a drag finds
  no cell lit, as canPlace counts them too). Not refused: a batch moved off the Cook row onto a meal (it eats one there), Copy last
  week and templates (whole weeks), and a batch off the plan or whose recipe was deleted (nothing to count). Once a batch
  is overdrawn, its leftovers past the yield are short (`shortPortions`: the batch's own portions first, then its
  leftovers by day, meal and placing order): dashed red, "no portion left", their pop-up says so, and they still count in
  their days' totals (a warning, not an erasure).
- Also on… shows a day's portions of the batch added up ("Tue ×2", however many leftovers hold them); a tap puts one more
  there (onto the last leftover placed there, else a new one), its − takes one off (that leftover goes at none).
- A meal eaten as more than one portion shows ×2 first in its chip's numbers (the Cook row's chips show the batch's ×).
- A store-bought item (`bought`) is placed like a recipe (`isCooked`, "had" in its words) but never cooked: a bag on its
  chip (a grey bar, not the pot's amber), never placed on the Cook row (`canPlace`, the picker; one there from before it
  was marked stays, yielding nothing), yields no portions (no shelf, leftovers or Also on…), and takes `QUICK_MINUTES` in
  Momo. Its count on hand is worked out, never stored: the count typed on its day (`stock.date`), less the portions its
  meals take from that day on, in date, meal and placing order (`stockAfter`): today's are taken as eaten, so On hand in its
  pop-up is the count before today's meals (as typed, the day it's typed) and the list's "3 on hand" what's left after
  them; "runs out Sat Oct 3" when a later meal isn't covered; "0 on hand" in red once the plan has used more than there
  was. Saving the pop-up keeps the count and its day unless the field was changed (then counted from today); emptied, not
  tracked. Buying doesn't add to it: the owner counts again.
- Protein is typed and read as "Quality protein" (complete proteins only): the fields, the recipe's, a quick meal's and the
  targets'; the short "P" on chips and rows, Momo's "45 g protein" and the paste key "Protein" stay.
- Trips: one placed by hand (the cart; one a day, the earliest placed wins) or the schedule's, worked out and never stored
  (`liveTrips`: each scheduled weekday from last Monday to the plan's end with none placed by hand and not skipped). The
  cart on a scheduled weekday skips that day's trip (`tripSkips`, `skip: true`; one placed by hand there goes too) and
  brings it back (`skip: false`); elsewhere it places or removes a trip. A trip's time: that day's own (`slotTimes`, set on
  its list), else its weekday's on the schedule, else `settings.times.trip`. The unusual stands out on the plan, quietly:
  a trip placed by hand carries a small dot on its cart, a scheduled weekday whose trip is skipped a slash (the schedule's
  trips, as they should be, carry nothing).
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
  Now); else no mark. A store-bought one goes by its item's row, and needs none while its stock covers it (no mark, on no
  list); a recipe with no lines by its name's row. Leftovers, quick meals, restaurants and skipped meals have none.
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
  piece, stick) merge only with themselves; a line with no amount is a row with none. A recipe with no lines is one line
  of its name, with no amount (the whole name, even with a number or a comma in it). A store-bought item is a row of its
  own (key `bought:<recipe id>|`, found by its name for its section, "store-bought" under it), counting the portions its
  stock doesn't cover (every one while it isn't tracked; the one where it runs out, only what's missing). A row keeps the
  first spelling; a count over one shows the first plural spelling when a recipe wrote one ("3 onions"). A row is ticked
  when one of its key's ranges holds every use of it in that list (a trip moved or removed re-cuts the lists; ticks keep
  their days).
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
- Not now: photos, importing from links, a full pantry (only a store-bought item's count on hand), nutrition databases,
  counts as weights (a stick of butter, a can),
  sizes ("2 large onions" is its own row), T/t/c for tbsp/tsp/cup, custom store sections, printing, timers, a favourite
  star, drag and drop on touch.
- The dot on the icon (`A.attention`): once Turtleduck is in use (a recipe or a planned meal), while this week isn't
  confirmed ("this week's meals aren't confirmed"), else from Friday while next week isn't ("next week's…"), else while
  today or tomorrow has no dinner planned (anything in its slot counts, Skipped too); it clears once one is.
- Bug reports and console messages hold counts only: never recipe names, ingredients or meals.
