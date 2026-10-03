# Turtleduck — meals and groceries (a Kyoshi app)
Meals for this week and next. Recipes are typed in, or written out by the batch in a plain text format and pasted
(Paste recipes). On the computer they're dragged onto a Mon–Sun grid; tapping works everywhere, and it's how the phone
plans. A recipe on a meal is cooked and eaten there, and its other portions wait on the shelf (Leftovers) to drag onto
later days. A recipe on the Cook row is cooked that day for later. Each day shows its kcal and macros against the
targets. Shopping trips are placed on the days, each with its grocery list worked out from the meals until the next trip:
merged by name and unit, in store sections, ticked on the phone (it opens on Groceries). The cook view is a phone stand
that keeps the screen on. **Momo** shows the plan: each meal, cooking session and trip is a card of its own that lands on
its day by itself, near its usual time, to move as you like. Named after Zuko's turtleducks (the icon is Lucide's cooking-pot, in amber).
Rules, versioning and the app contract: the root `CLAUDE.md`. Version & changelog: `changelog.js`.

## Files (load order)
| File | What's in it |
|---|---|
| `app.js` | `Kyoshi.register` (name, title, icon, 1180px wide, backup note, its checkup); constants (limits, `MEALS` with Cook last, `TYPES`, `MOMO_MEALS`, the minutes of Momo's cards: `GROCERY_MINUTES` 45, `DEFAULT_COOK_MINUTES` 45, `QUICK_MINUTES` 20, `RESTAURANT_MINUTES` 60; `SHELF_DAYS` 28, `SECTIONS`, `NUTRIENTS`, `CLIP_MS` 5000, `PAGE` 30, `PLAN_PX` 900, `PHONE`); state `A.S`; helpers (text, numbers, days: `mondayOf`, `thisMonday`, `planEnd`, `inPlan`, formats); lookups remembered by `S.version` and the day (`remember`): recipes, entries, cells, trips, templates, `nameOf`, `lastCooked`/`cookedTimes`, `yieldOf`, `leftoversOf`, `portionsLeft`, `shelf`, `addUp` (nutrition), `fmtMacros`, `entryMinutes` |
| `markup.js` | the page: the nav, Plan (tabs and ⋯ menu, grid, sidebar, the phone's list), Recipes, Groceries (add by hand, the lists, Settings), the cook view, Backup & sync, and the pop-ups (picker, a meal's, recipe, Paste recipes, Save as template) |
| `changelog.js` | version history |
| `data.js` | cleaning (every copy, new ones too), `load`, `persist`/`save` (each key only when changed), backups and sync merge (`A.data`) |
| `ingredients.js` | `parseLine` ("2 cups rice, rinsed" → qty, unit, name, note, key), units and base units (kg → g, l → ml), `fmtAmount`/`fmtLine`, `scaledLine` (the cook view), `guessSection` |
| `paste.js` | `parsePaste` (the format) and the Paste recipes pop-up (preview, ticks, Add) |
| `groceries.js` | the lists (`lists`: Now and each trip's, rows merged and ticked), trips (`toggleTrip`), ticks, groceries added by hand, sections, the Groceries view, Settings (targets) |
| `share.js` | what Momo reads (`inbox`) and opens (`open`) |
| `plan.js` | the plan's changes (`canPlace`, `addRecipe`, `addPortion`, `addOwn`, `moveEntry`, `copyEntry`, `dropEntry`/`removeEntry`, `updateEntry`, `alsoOn`), sums (`dayTotals`, `weekAverage`, `pastTarget`), the ⋯ menu's actions (Copy last week, templates, Clear week) |
| `plan-view.js` | draws the Plan view: the tabs, the grid (chips, carts, totals), the sidebar (search, shelf, recipes), the phone's list, the ⋯ menu; `revealCell` |
| `plan-popups.js` | the picker, a planned meal's pop-up (×, portions, Also on…, Read, Edit recipe, Replace…, Remove), Save as template |
| `drag.js` | the browser's drag and drop on the grid (mouse only): recipes, portions, planned meals |
| `clipboard.js` | Momo's copy, cut and paste by the mouse's place (Ctrl/⌘+C, X, V; `CLIP_MS`) |
| `recipes.js` | the Recipes view and the recipe pop-up (Save, Save & add another, Archive, Delete) |
| `cook.js` | the cook view: `openCook`, paging a day's recipes, Back |
| `render.js` | `showView` (plan, recipes, groceries or cook), `renderAll`, `reveal` |
| `events.js` | `A.init` wiring and the hooks: `onShow`, `onHide`, `onTick`, `onReload`, `onKeydown`, `awake` (the cook view keeps the screen on: core/wakelock.js), `attention` (a dot while today or tomorrow has no dinner), `bugState` |
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
  before today are let go at the next tick. No ranges: unticked (kept, so sync carries the untick).
- `manual` [{ id, text ≤ 60, done (the day ticked, ""), deleted, at, u }]: added by hand; shown until the day after it's ticked.
- `sections` { "<name>": { section, u } }: a store section set by hand, by ingredient name (else guessed).
- `templates` [{ id, name ≤ 30, entries: [{ day 0–6, meal, kind, recipeId, name, leftover, from (an index in entries, or -1),
  scale, servings, kcal…fiber }], deleted, at, u }] (≤ 20).
- `settings` { targets: { kcal, protein, carbs, fat, fiber } (null: none), u }
This device only: `version` (counts changes, for `remember`), `view`, `back` (where the cook view goes back to), `week`,
`search`, `listSearch`, `editing`, `picking`, `entry`, `cooking`, `paste`, `clip`, `mouse`, `drag`, `menu`, `boughtOpen`,
`sideClosed`, `lastType`, `knownToday`.

## Storage (`A.store`) and backups
Keys: `recipes`, `plan`, `trips`, `checked`, `manual`, `sections`, `templates`, `settings`, plus core's `sync` and
`meetings`. Backup JSON: `{ schemaVersion: 1, appVersion, recipes, plan, trips, checked, manual, sections, templates,
settings }` (plus core's `meetings`). `looksLike`: `recipes` and `plan` are both lists (no other app keeps both). Import
JSON refuses a file with no live recipes and no live planned meals, warns on a newer `schemaVersion`, confirms with counts
and replaces all eight. Sync merges the five lists item by item by `u` (Appa's merge), `checked` and `sections` key by key
by `u`, and `settings` whole.

## Its checkup
`meetings` in `app.js`: a 15-minute checkup, no schedule ("Last checkup: 12 days ago" with Done ✓; core/meetings.js).

## Shared with other apps
`A.inbox(from, to)` (core/inbox.js; read-only copies, made afresh each call), all `fill: "card"` (each a card of its own in
Momo), from `from` (Momo asks from this Monday, so this week's past meals are on their days too, as the record of the week, and
never go to its Tasks; meals carry no `done`: the plan is taken as eaten). A dated one lands on its day by itself, at its
`time` (share.js `TIMES`) as near as the day's cards allow, once that week has cards of yours in Momo:
- each day's breakfast, lunch and dinner with anything but skipped meals: `{ id: "meal:<date>:<meal>", title: "Dinner: " and
  the names joined " + " (≤ 60), date, time: 07:30 / 12:00 / 18:00, minutes: the sum of `entryMinutes`, details: [the slot's
  nutrition, a line per meal: "Cooked here · serves 4", "Leftovers of Mon's Chili", "Quick meal", "Restaurant"] }`; snacks never.
- each day's Cook row: `{ id: "cook:<date>", title: "Cook: Curry ×1½ · Chili" (a batch's × when it isn't 1), date, time: 16:00,
  minutes, details: ["2 recipes · 13 portions", "Curry ×1½ · Chili ×1"] }`.
- each trip: `{ id: "groceries:<date>", title: "Groceries", minutes: 45, date, time: 10:00, details: ["12 items", "for meals Oct
  3 – 11"], done: nothing left to buy on its list }`; and while the Now list has something to buy: `{ id: "groceries:now", …,
  due: the day before the first meal needing it (today once that's passed), overdue: that day is past }`, waiting in Momo's
  Tasks until you place it.
`A.open(id)` (Momo's "Open in Turtleduck"): a meal's recipes (cooked or leftover) in the cook view (none: its cell on the
plan, flashing); a Cook row's recipes in the cook view, paged; a Groceries need, its list on Groceries, flashing.

## Invariants
- Worked out, never stored: portions left, the shelf, last cooked and cooked N× (cooked entries up to today, not portions),
  the lists, totals and averages. "Today" is `K.util.todayStr()`; `Date.now()` only for `at` and `u` stamps.
- A batch yields round(servings × scale); portions left = yield − eaten there − its leftovers' portions, and can go below
  zero (shown in red, never thrown). A portion goes only on a day on or after its batch's, never on the Cook row; a batch
  moved later than its leftovers leaves them (both marked, its pop-up says so). Copying a batch cooks it again.
- A list's rows: every live batch (not leftovers; recipe not deleted) cooked in its range, each line parsed and scaled,
  merged by `name|unit` with kg → g and l → ml (shown in kg or l from 1000); a line with no amount is a row with none.
  Other units merge only with themselves; no plural folding ("2 onion"). A row is ticked when one of its key's ranges holds
  every use of it in that list (a trip moved or removed re-cuts the lists; ticks keep their days).
- A day's totals leave out the Cook row and skipped meals; "?" when a meal has no kcal. The week's average takes each
  nutrient over the days that have it. Targets warn: kcal, carbs and fat over theirs; protein and fiber under theirs.
- A deleted recipe: planned meals keep its name (refreshed to its last one at delete), add nothing to a list, and its
  portions leave the shelf; the cook view says it's gone. Dangling `recipeId`s and `from`s never throw.
- Drag and drop is the mouse's (HTML5); the phone taps. Copy and paste is Momo's: keys and the mouse's place, no buttons.
- Every cleaner drops what it can't use, so a damaged file never breaks the app. Weeks run Monday to Sunday, as in Momo.
- Not now: photos, importing from links, a pantry, nutrition databases, unit conversion beyond g/kg and ml/l, plural
  folding, custom store sections, printing, timers, a favourite star, drag and drop on touch.
- The dot on the icon (`A.attention`): once Turtleduck is in use (a recipe or a planned meal), while today or tomorrow has no
  dinner planned (anything in its slot counts, Skipped too); it clears once one is.
- Bug reports and console messages hold counts only: never recipe names, ingredients or meals.
