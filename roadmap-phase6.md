# Phase 6: Turtleduck (meals and groceries) — the detailed plan
Planned with the owner on 2026-10-02 (40 questions; the answers are folded into Decisions). Read it when building Phase 6,
after roadmap.md's top sections and its Phase 6 section. **Where this plan and the roadmap's Phase 6 section differ, this
plan wins:** it drops the roadmap's "no drag and drop" decision (dragging with a mouse on the computer, tapping
everywhere), makes the Plan screen computer-first (the phone gets a list and opens on Groceries), adds bulk recipe
entry, portions of a batch to place where you like, a batch-cooking row, shopping trips you place on the days, and sends
breakfast, lunch, dinner and cooking to Momo. Once Phase 6 is ticked in roadmap.md (its Status line holds the
decisions), fix the two "no drag and drop" lines there (Decisions, Builder notes) and the "What each app sends Momo"
row, and delete this file. Work on `main` as the roadmap says (plan mode first): one small core commit (the header),
then one app commit.

**The owner's brief, in one line:** make a lot of recipes at once (a weekend's batch, written out by hand in a text
format), drag them onto the two weeks on the computer, and use the phone for the grocery list and as a recipe stand
while cooking. **Minimal and unobtrusive, modular:** every feature below is one small thing; when in doubt, leave it out.

## Context
Kyoshi is a home for small vanilla HTML/JS apps sharing one core (`core/`), with Momo (a weekly time budget) at the
centre: each app lists what it needs this week and next (`A.inbox`, core/inbox.js) and Momo fills the user's cards with
it. Phases 0–5 built the inbox, Today, meetings, Hawky (errands), Iroh (goals) and Badgermole (workouts). Phase 6 adds
**Turtleduck**: recipes (typed, or pasted in bulk in a plain-text format), a two-week plan laid out on the computer by
dragging recipes onto a Mon–Sun grid (tapping works too, and is how the phone does it), portions of anything cooked in
bulk kept on a shelf to place on later days, the day's kcal and macros against targets, shopping trips placed on the
days with a grocery list per trip worked out from the plan (merged by name and unit, in store sections, ticked on the
phone), a cook view that keeps the screen on, and Momo's Breakfast, Lunch, Dinner and Cooking cards filled with the
day's meals plus a Groceries card on each trip's day. One core change, apart: the header keeps one width in every app
so the switcher never moves (below). Nothing in Momo changes: `fill: "block"` needs with a `date` and `fill: "time"`
needs with a `date` or `due` are handled (apps/momo/inbox.js; a shortfall becomes a "Dinner · Chili" task,
apps/momo/tasks.js), card pop-ups show details, and `A.awake()` keeps the screen on (core/wakelock.js). The drag and
drop is Turtleduck's own, the browser's HTML5 drag and drop (mouse), not Momo's pointer code: nothing shared.

**Read first** (as the roadmap says; every file's header says what's in it): root `CLAUDE.md` (rules, contract),
`roadmap.md` top sections + Phase 6 + Builder notes, `apps/_template/CLAUDE.md`, `apps/badgermole/*` (the newest app:
app.js, data.js, share.js, render.js, editors.js, day.js, events.js, markup.js, badgermole.css, CLAUDE.md),
`apps/hawky/share.js` (a `due`/`overdue` feeder) and `apps/hawky/editor.js` + `apps/hawky/events.js` (quick add that
keeps the phone's keyboard up), `apps/wanshitong/editor.js` (Add another), `apps/momo/clipboard.js` (copy and paste by
the mouse's position, `CLIP_MS`) and `apps/momo/events.js:64–65` (`S.mouse`), `apps/momo/today.js` `initToday` (opening
on a phone view by width), `apps/appa/data.js:75–95` (merge by `u`), `core/inbox.js` header, `apps/momo/inbox.js`
header, `core/modal.js` header, `core/wakelock.js` header, `core/util.js` exports (`newId`, `esc`, `fmtNum`, `addDays`,
`todayStr`, `fmtShort`, `fmtWeekday`), `core/kyoshi.css:28` and `:100–114` (the shell and header), `core/shell.js:106`
(`--app-width`), `tests/lib.js` and `tests/badgermole-momo.test.js` (the shape of a test).

## Decisions (the owner's answers, 2026-10-02)
| Topic | Decision |
|---|---|
| Who | **Just the owner.** A placed meal is one portion eaten unless changed. |
| Plan range | **This week and Next week**, Mon–Sun, as Momo. Past days of this week stay editable; nothing further ahead. |
| The grid | **Days as columns**, Mon–Sun; rows Breakfast · Lunch · Dinner · Snack · **Cook** (batch cooking that day: cooked, not eaten there); the recipe sidebar beside it. |
| Placing | **Drag a recipe from the sidebar onto a cell** (mouse, HTML5 drag and drop); **tap an empty cell → the picker** anywhere (the phone taps only). Drag a planned chip to move it. **Several chips may share a cell** (chili + salad). |
| Copy and paste | **Momo's, exactly:** Ctrl/⌘+C copies the chip under the mouse, Ctrl/⌘+X cuts it, Ctrl/⌘+V puts it in the cell under the mouse; the chip is shaded while it waits, and each paste gives another `CLIP_MS` (5 s) for the next; Esc or the timer clears it. Keyboard and mouse position only, no buttons. |
| Cooking vs eating | A recipe dropped on a meal cell is **cooked and eaten there** (`leftover: false`). Its other portions (servings × scale − 1) go on the **shelf** (below) to place on any later day as a **leftover** chip (`leftover: true`, linked by `from`): no ingredients, 20 minutes. A recipe dropped twice is cooked twice. The **Cook row** holds recipes cooked that day and eaten on other days: all its portions go on the shelf. |
| The shelf | Portions cooked but not yet placed, as chips in the sidebar ("Chili · 3 left · cooked Mon") and at the top of the picker, from cook entries of the last `SHELF_DAYS` (28). A portion goes only on a day **on or after** its cook day. **"Also on…"** on a cooked chip places its portions on chosen later days (same meal) in one go. |
| Scaling | A **× on the cooked chip's pop-up** (halves, 0.5–10): the yield and the grocery quantities scale; nothing else asks about it. |
| Quick meals | A cell can hold **a quick meal** (text, with its own kcal and macros), **a restaurant** (text optional, macros optional) or **Skipped** (nothing counted, nothing to Momo). Replace does the swap: the picker lists them at the bottom. |
| Four meals | All four are planned; some repeat: **Copy last week** and **week templates** (save the shown week; load one into a week) cover that, from a small ⋯ menu on the tabs row. |
| Nutrition | **kcal, protein, carbs, fat, fiber per serving, typed by the owner** (worked out elsewhere). Day totals against daily targets (each optional), a week average under each tab. **Nutrition lives in Turtleduck only, never Bosco.** |
| Recipes in bulk | The owner writes them out in the plain-text format below (from cookbooks) and pastes them: a **Paste recipes** pop-up with a preview. No prompt for an LLM, no link import. |
| Recipe fields | name, **meal type** (breakfast / lunch / dinner / snack / any: the only "tag"; the sidebar groups by it), ingredients (one line each, the grocery list's source), steps (free text: bullets or a paragraph, as typed), prep, cook, servings, kcal, protein, carbs, fat, fiber, link. No photos. |
| Units | **Metric.** Lines parse to quantity, unit and name; g/kg and ml/l merge (shown in kg or l from 1000); other units merge only with themselves; counts ("2 eggs") merge. |
| Editor | A pop-up: fields, ingredients and steps as one-per-line text boxes, **Save & add another**. |
| Shopping | **Two trips a week, no set day:** the owner **places trips on the days** (a cart toggle in the day's header, the grid and the phone list alike). The list is **one per upcoming trip**: the meals from that day until the next trip; a **Now** list for what's needed before the next trip (normally empty). No staples list: only what the planned meals need, plus **manual adds** ("running out of…", marked *added by hand*), food only in spirit. |
| Grocery order | **By store section** (Produce, Meat & fish, Dairy & eggs, Bakery, Frozen, Pantry, Drinks, Other), guessed from the name and set once per ingredient with a tap, remembered by name. |
| Ticks | A tick = bought for every planned use through the trip's range; a meal added later past that brings the item back. "Already have it" is the same tick. |
| Phone | Opens on **Groceries** when phone-narrow at load (Momo's rule); Plan (a list from today) and Recipes in the top nav. **Cook view:** the recipe on a phone stand, never touched: ingredients (scaled) and the steps as typed, big type, screen kept on. Nothing to tick while cooking. |
| Into Momo | **Breakfast, Lunch and Dinner cards**, one need per day and meal (names joined), 45 minutes when cooked there (the recipe's prep + cook when given), 20 for leftovers and quick meals; **a "Cooking" card** for the Cook row (the recipes' cook minutes summed); snacks never. **Groceries** on each trip's day, 45 minutes, ✓ once its list is bought; a Now list that isn't empty is a need due the day before the first meal that needs it. Nothing to tick as eaten. "Open in Turtleduck" → the cook view. |
| Recipe history | "Last cooked Sep 12 · 5×" on recipe rows: cook entries counted, not portions. |
| Icon, width | Lucide **"cooking-pot"** in amber `#d97706`; **1180 px** wide like Momo. **The switcher must not hop:** the header keeps one width in every app (the core change below). |
| Checkup | The usual 15-minute checkup (one muted line under the name, "Last checkup: 12 days ago" with Done ✓, no schedule, never a reminder), as every daily app has; never a dot on the icon. |
| Not now | Printing, photos, importing from links, a pantry, nutrition databases, a favourite star, Bosco reading anything. |

**The architect's own calls** (small; flip them if the owner objects at review):
- **The header change (core, first commit):** `.header { max-width: var(--header-width, 780px); margin-left: auto; margin-right: auto; }` in core/kyoshi.css (the shell keeps the app's width), so the title, the checkup line, the switcher and Theme sit in the same place in every app (Momo's board is wider than its header; it already is wider than a phone). Kyoshi 3.130 ("The header keeps one width in every app, so the app switcher stays put when you switch"). A shell test checks the switcher's x position is the same in Momo and Hawky at desktop width.
- Ingredients are kept as **lines of text** and parsed on read (memoised), so a better parser later improves every recipe; a line that doesn't parse is all name (a quantity-less row on the list).
- A plan entry keeps the recipe's **name as placed**, used when the recipe is deleted; while the recipe exists its live name shows.
- A restaurant meal is **60 minutes** in Momo (`RESTAURANT_MINUTES`); the owner said 20 for quick meals and leftovers, and eating out takes longer. One constant to change.
- Momo asks for needs from today on (apps/momo/inbox.js `readNeeds`), so meal needs carry no `done`; past meals count as eaten, as the plan is taken as done elsewhere in Kyoshi.
- A trip covers the meals **from its day up to the day before the next trip** (the last one through next Sunday). The Now list covers today up to the day before the next trip (or through next Sunday with no trip). A past trip is gone from the screen; what it left unbought shows up in Now.
- Section guesses are a small keyword table (~60 words: chicken, beef, pork, salmon → Meat & fish; milk, cheese, yogurt, butter, egg → Dairy & eggs; onion, garlic, tomato, pepper, lettuce, apple, lemon, herbs → Produce; bread, tortilla → Bakery; frozen → Frozen; drinks → Drinks; rice, pasta, flour, oil, canned, spices → Pantry); anything else lands in Other. A section set by hand wins and is remembered by name.
- Day totals show "?" beside a day when an entry's recipe has no kcal, rather than a silently low number. Warnings: kcal, carbs and fat over their target, protein and fiber under theirs, only with targets set.
- A paste never updates an existing recipe: its preview unticks a block whose name is already a live recipe (any case); ticking it adds a second one. A name repeated within the paste gets "(2)".
- Copy last week and Load template **add** entries to the shown week (nothing removed; a cooked chip and its leftovers come along, re-linked); Clear week sits in the same menu for a fresh start (confirm).
- Limits: name ≤ 40 (Momo's need titles are ≤ 60: joined names are cut), ≤ 60 ingredient lines of ≤ 100, steps ≤ 4000 characters, quick meal text ≤ 60, prep and cook 0–600, servings 1–50, scale 0.5–10 in halves, kcal 0–5000, grams 0–500, link ≤ 300, ≤ 200 recipes per paste, templates ≤ 20 of ≤ 30 characters, manual adds ≤ 60 characters, ≤ 12 chips a cell.

## Data (keys in `A.store`; core's `sync` and `meetings` beside them)
```
recipes   [{ id, name ≤ 40, meal: "breakfast" | "lunch" | "dinner" | "snack" | "any", ingredients: ["200 g rice", …] (≤ 60),
             steps (text ≤ 4000, as typed), prepMin, cookMin, servings (1–50, the yield at ×1), kcal, protein, carbs, fat, fiber
             (per serving; null when unknown), link, archived, deleted, at, u }]
plan      [{ id, date, meal: "breakfast" | "lunch" | "dinner" | "snack" | "cook", kind: "recipe" | "quick" | "restaurant" | "skipped",
             recipeId ("" unless recipe), name (the recipe's as placed, or the text), leftover (bool), from (the cooked entry's id
             for a leftover, else ""), scale (1; cooked entries), servings (portions eaten here: 1; 0 in the cook row),
             kcal, protein, carbs, fat, fiber (quick / restaurant: their own; null otherwise), deleted, at, u }]
trips     [{ id, date, deleted, at, u }]                                      — a shopping trip on a day (one a day at most)
checked   { "<name>|<unit>": { until: "YYYY-MM-DD" ("" = unticked, a marker), u } }
manual    [{ id, text ≤ 60, done ("" | the day ticked), deleted, at, u }]   — added by hand ("running out of…")
sections  { "<name>": { section (one of SECTIONS), u } }                      — set by the owner, by ingredient name
templates [{ id, name ≤ 30, entries: [{ day 0–6, meal, kind, recipeId, name, leftover, from (an index into this list, or -1),
             scale, servings, kcal, protein, carbs, fat, fiber }], deleted, at, u }]
settings  { targets: { kcal, protein, carbs, fat, fiber } (null = none), u }
```
- Deleted items keep only `{ id, deleted, at, u }` (markers, so sync can't bring them back); an archived recipe is a live one hidden from the sidebar and the picker. A cooked entry's `name` is the recipe's at placement; a quick or restaurant entry's `name` is its text ("Restaurant" when empty).
- This device only (`A.S`, not stored): `view` ("plan" | "recipes" | "groceries" | "cook"), `week` ("this" | "next"), `search`, `editing` (the recipe pop-up), `picking` ({ date, meal }), `entry` (the entry pop-up), `cooking` ({ recipeIds, index, scale }), `clip` ({ id, cut, timer }), `mouse` ({ x, y }), `drag` (what's being dragged), `knownToday`, `version` (counts changes, for the memos).
- **Backup**: `{ schemaVersion: 1, appVersion, recipes, plan, trips, checked, manual, sections, templates, settings }` (core adds `meetings`). `looksLike = Array.isArray(raw.recipes) && Array.isArray(raw.plan)` (no other app has both). Import JSON refuses a file with no live recipes *and* no live plan entries, warns on a newer `schemaVersion`, confirms with counts ("your 48 recipes and 31 planned meals"), then replaces the eight.
- **Sync** (`combine`): `recipes`, `plan`, `trips`, `manual` and `templates` merged item by item by `u` (copy `apps/appa/data.js` `merge`/`newer`/`inOrder`), `checked` and `sections` key by key by `u`, `settings` whole, the newer `u` winning; `plain && no recipes && no plan → null`. Every cleaner (`cleanRecipe`, `cleanEntry`, `cleanTrip`, `cleanChecked`, `cleanManual`, `cleanSections`, `cleanTemplate`, `cleanSettings`) drops what it can't use and runs on new items too.
- Worked out, never stored: "last cooked" and "cooked N×" (cooked entries up to today), portions left, the lists, the totals.

## The maths (ingredients.js, groceries.js, plan.js; memoised by `S.version|today`)
- **Parsing a line** `parseLine(text)` → `{ qty, unit, name, note }`: `qty` from a leading number ("2", "1.5", "1,5", "1/2", "1 1/2", "½", "2-3" → 2), else null; `unit` the next word when it's in `UNITS` (g, kg, ml, l, tbsp, tsp, cup, can, clove, slice, bunch, head, pkg, pinch, piece, with plurals and long forms mapped to one spelling: grams → g, litre/liter → l, tablespoon → tbsp…), else ""; `name` the rest up to the first comma, lower-cased and spaces collapsed for the key, shown as typed; `note` after the comma ("drained"). "2 eggs" → qty 2, unit "", name "eggs". "salt" → qty null. **Base units:** kg → g × 1000, l → ml × 1000 before merging; `fmtQty` shows ≥ 1000 g as kg and ≥ 1000 ml as l (1 decimal), fractions where neat (½ ¼ ¾ ⅓ ⅔), else `fmtNum` to 2 decimals. `fmtLine` → "1.5 kg rice", "5 eggs", "salt".
- **Scaling** a recipe's lines by `scale`: qty × scale (null stays null). The cook view and the lists use the scaled lines.
- **Yield and portions**: a cooked entry yields `round(recipe.servings × scale)`; `portionsLeft(e)` = yield − e.servings − the `servings` of live leftover entries with `from = e.id`. The shelf lists cooked entries with `portionsLeft > 0` dated within `SHELF_DAYS` (28) before today through next Sunday, cook day first.
- **Trips** `tripRanges()`: live trips from today on, by date: each `{ date, through: the day before the next trip, or next week's Sunday }`; the **Now** range: today through the day before the first trip (or next Sunday) — empty when a trip is today.
- **A list** `groceryRows(range)`: every live cooked entry (`kind: "recipe"`, not leftover) with a recipe and `range.from ≤ date ≤ range.through`; each ingredient line parsed and scaled; rows merged by key `name|unit` (base units): qty summed (null + 2 = 2), `recipes` (names, unique), `last` (the latest date needing it), `section` (sections[name] or the guess). A row is **ticked** when `checked[key].until >= row.last`. Ticking sets `{ until: range.through, u }`; unticking `{ until: "", u }`. Manual adds ride on the Now list when it's non-empty, else the first trip's, in a section of their own at the top ("Added by hand"), each with its own tick (`done`). The count: "4 of 12". Sorted by section (SECTIONS' order) then name.
- **Day totals** `dayTotals(date)` → `{ kcal, protein, carbs, fat, fiber, unknown }` over the day's live entries, the Cook row left out: a recipe entry (cooked or leftover) adds the recipe's per-serving values × `servings` (`unknown` when the recipe has no kcal); quick and restaurant their own; skipped nothing. Shown "1,850 kcal · P 120 · C 180 · F 60 · Fi 28" (grams), "?" when `unknown`, `.warn` on a value past its target. The week average: the days with any entry.
- **Meal minutes** `entryMinutes(e)`: cooked → recipe prep + cook, else `DEFAULT_COOK_MINUTES` (45); leftover or quick → `QUICK_MINUTES` (20); restaurant → `RESTAURANT_MINUTES` (60); skipped → 0. A cell's = the sum.
- **Sidebar**: grouped by meal type (Breakfast, Lunch, Dinner, Snack, Any; each a `<details>`, open), within a group by name; the search field (name, any case) flattens the groups to matches. The picker for a cell shows the shelf's portions placeable that day first, then that meal type's recipes, then the rest, then Quick meal · Restaurant · Skip.
- **Copy and paste** (clipboard.js, Momo's): `S.mouse` from `pointermove` (mouse only); Ctrl+C/X on the chip under the mouse (`document.elementFromPoint`), Ctrl+V on the cell under it: a copy of a cooked chip is a new cooked entry (cooked again: its own ingredients); of a leftover, another portion of the same cook (`from` kept); a cut moves the entry. `CLIP_MS` 5000, shading `.clipped`, Esc clears.
- **Bulk paste** `parsePaste(text)` → `{ recipes: [cleaned], problems: ["Block 3 has no name", …] }`. The format (forgiving: keys any order, any case, a colon optional, "min"/"minutes" optional, the `Ingredients:` and `Steps:` headings optional: `-`/`*`/`•` lines are ingredients; everything after the ingredients, or after `Steps:`, is the steps as typed):
  ```
  # Chili
  Meal: dinner
  Serves: 4
  Prep: 15 min
  Cook: 45 min
  Per serving: 650 kcal, 45 g protein, 40 g carbs, 30 g fat, 8 g fiber
  Link: https://example.com/chili
  Ingredients:
  - 500 g ground beef
  - 2 cans kidney beans, drained
  Steps:
  Brown the beef. Add the beans and simmer 30 min.
  Season to taste.
  ```
  A recipe starts at a line beginning with `#`; "Calories: 650", "Protein: 45 g", "Fiber: 8 g" on their own lines are accepted too; "Serves" / "Servings" / "Yield" alike. A block with no name, or with neither ingredients nor steps, is reported and skipped.
- **Templates**: `saveTemplate(name)` copies the shown week's live entries with `day = weekday`, `from` turned into an index (or -1); `loadTemplate(id, week)` makes new entries on that week's dates (new ids, `from` re-linked); `copyLastWeek(week)` does the same from the previous week's entries. A dangling `recipeId` stays as it is (the name shows; no ingredients).

## Screens (1180 px wide; a top nav Plan · Recipes · Groceries as a `.mode-toggle` under the header; `showView`)
**Plan** (`#planView`), computer (> 900 px): tabs **This week · Next week** (Momo's `.window-pills` look) with a small **⋯** menu at the right (Copy last week · Save as template… · Load template ▸ names, each with a tiny ✕ · Clear week). The grid: a column per day Mon–Sun (the header "Mon 5", today marked, past days dimmed, a **cart toggle** on each day: filled when a trip is placed there) and a row per meal (Breakfast, Lunch, Dinner, Snack, **Cook**), each cell a drop target holding its chips: the name, "650 · P 45" small, a glyph: a pot for a cooked chip, ↩ for a leftover, 🍴 for a restaurant, muted "Skipped"; an × on hover. Under each column its totals (`.warn` past a target; the Cook row doesn't count); under the grid the week average. Beside the grid the **sidebar** (300 px, sticky): a search field; **Leftovers** (the shelf's portions as chips "Chili · 3 left · Mon"); then the recipes grouped by meal type, all draggable. An empty cell shows a faint + on hover; **tapping an empty cell opens the picker**; tapping a chip opens the entry pop-up.
Phone (≤ 900 px): no sidebar, no grid: the 14 days as a list from **today** (past days of this week hidden), each day its head (date, the cart toggle, totals) and its slots as rows ("Dinner · Chili · 650 · P 45"; an empty slot "Dinner · —"; the Cook row only when it has something); tap a slot → the picker; tap an entry → the entry pop-up.
- **Drag and drop** (drag.js): `draggable="true"` on sidebar chips (`dataTransfer`: `recipe:<id>` or `portion:<cookEntryId>`) and on planned chips (`entry:<id>`); cells take `dragover` (preventDefault, `.drop-target`; a portion before its cook day, or anything onto the Cook row that isn't a recipe, isn't a target) and `drop`: a recipe → a new cooked entry there (added, not swapped); a portion → a leftover entry there; an entry → moved there (`date`/`meal` change, `u` bumps; a leftover never before its cook day; a cooked entry moved later than its placed leftovers takes them along? **No:** they stay; the pop-up shows "2 portions placed before the cook day" in red until fixed). Mouse only, by design: the phone taps. `dragend` clears the classes.
- **The picker** (`#pickOverlay`): "Dinner, Mon Oct 5": a search field (focused), the shelf's portions placeable that day, then that meal's recipes, then the rest (30 at a time + More), tap one → placed and the pop-up closes; at the bottom **Quick meal** (text, kcal, P, C, F, Fi fields, Add), **Restaurant** (name optional, the same fields) and **Skip this meal**. For the Cook row: recipes only.
- **The entry pop-up** (`#entryOverlay`): the name; a cooked chip: "Cooked here · serves 4 · **×** [1]" (halves), "Portions eaten here" [1] (0 and read-only in the Cook row), "**3 portions left**", **Also on…** (the later days through next Sunday as chips, same meal; ticked ones hold a portion; ticking places one, unticking removes it); a leftover: "Leftover of Mon's Chili", "Portions" [1]; a quick or restaurant: its text and numbers. Then **Read** (the cook view) · **Edit recipe** · **Replace…** (the picker, this entry removed on a pick) · **Remove**.

**Recipes** (`#recipesView`): "New recipe" · "Paste recipes…" · a search field; the list grouped by meal type: "Chili · 650 kcal · P 45 · 60 min · last cooked Sep 12 · 5×" rows (tap → the recipe pop-up; a small **Cook** link → the cook view), **Archived** folded at the bottom (count). Phone: the same, one row per line.
- **The recipe pop-up** (`#recipeOverlay`, `.modal.wide`): name, meal type (`.mode-toggle` of five), servings, prep, cook, kcal, protein, carbs, fat, fiber, link, **Ingredients** (a textarea, one per line; the hint "200 g rice · 1 can beans, drained · salt"), **Steps** (a textarea, as you like); **Save** (Enter in a field) · **Save & add another** · Cancel · **Archive** / Unarchive · **Delete** ("planned 3 times: those days keep its name"). `pending`/`ask` as apps/hawky/editor.js.
- **Paste recipes** (`#pasteOverlay`, `.modal.wide`): a big textarea, the format folded in a `<details>`; **Preview** → one row per block with a checkbox (unticked when the name exists: "already have Chili"), its counts ("9 ingredients · 650 kcal") and the problems in red; **Add 12 recipes**.

**Groceries** (`#groceriesView`), phone-first, the phone's home: the **Now** list first when it has anything ("Needed before Sat's trip" · "2 of 3"), then one block per upcoming trip: "**Sat Oct 4** · for meals Oct 4 – Tue 7 · 4 of 12" (a trip with nothing to buy says so); each block's rows by section (a section head, then rows: a big checkbox, "1.5 kg rice", small "Chili, Fried rice", the section tappable to change it: a `<select>` of SECTIONS); ticked rows sink to a **Bought** fold per block. An **Add** field above the first block ("Running out of…", Enter adds, the field keeps focus): manual adds, in their own "Added by hand" section at the top, each tagged *added by hand*. No trip placed: "No trip yet: tap the cart on a day in the plan" and the Now list through next Sunday. **Settings** folded at the bottom: the five targets.

**Cook** (`#cookView`, `S.view = "cook"`, Badgermole's `showView` pattern; the nav hidden): the name big, "×2 · 8 portions" when scaled, the link, the **ingredients** (scaled), the **steps as typed** (each line its own paragraph; a line starting with - or • a bullet), big type, generous spacing; a batch day: "1 of 3 · Next: Curry ›" at the top; **← Back**. `A.awake()` is true while the cook view is on screen (`K.wakeLock.check()` on enter and leave). Opened by Read, a recipe row's Cook, and Momo's "Open in Turtleduck". Nothing to tap while cooking.

**Backup & sync** (`<section data-kyoshi="backup">`) once, below the views.

## Into Momo (share.js: `inbox(from, to)`, `open(id)`; copies made afresh each call)
```
meals:     for each date from–to, each meal in MOMO_MEALS ("breakfast", "lunch", "dinner"), with live entries that day and slot
           that aren't skipped →
           { id: "meal:<date>:<meal>", title: the entries' names joined " + " (≤ 60), block: "Dinner" (the slot's title),
             fill: "block", date, minutes: the sum of entryMinutes, details: ["650 kcal · 45 g protein · 40 g carbs · 30 g fat · 8 g fiber",
             "Cooked here · serves 4 ×1" | "Leftovers of Mon's Chili" | "Quick meal" | "Restaurant", one line per further entry] }
cooking:   for each date with live Cook-row entries →
           { id: "cook:<date>", title: names joined, block: "Cooking", fill: "block", date, minutes: the sum of entryMinutes,
             details: ["3 recipes · 12 portions", "Chili ×2 · Curry ×1", …] }
groceries: for each trip from–to → { id: "groceries:<date>", title: "Groceries", block: "Groceries", minutes: 45, date,
             details: ["12 items", "for meals Oct 4 – 7"], done: nothing unbought on its list (date kept, so ✓ shows) }
           and, while the Now list has unbought rows or open manual adds →
           { id: "groceries:now", title: "Groceries", block: "Groceries", minutes: 45, due: the day before the earliest
             row's first use (today when that's passed), overdue: that day < today, details: ["3 items needed before Sat"] }
```
- A day's Dinner card reads "Dinner (Chili from Turtleduck)"; a planned dinner on a day with no Dinner card gives a "Dinner · Chili" task (apps/momo/tasks.js); a Cook-row day with no Cooking card, a "Cooking · Chili + Curry" task; snacks never go. No `done` on meals (see the architect's calls). Momo's Today shows the meal with "Open in Turtleduck".
- The Groceries need fills a "Groceries" card by time (Hawky's way) on the trip's day; the Now need the soonest on or before its due day.
- Limits hold: block ≤ 40, title ≤ 60, details ≤ 8 × 100; ids stay the same for the same slot, day and trip.
- `open(id)`: `"meal:<date>:<meal>"` → the slot's recipe entries (cooked or leftover) → `showView("cook")` on them (scale from a cooked entry, ×1 for a leftover); none → the plan on that week, that cell flashing (Hawky's `flash`); `"cook:<date>"` → the cook view on that day's Cook-row recipes, in order; `"groceries:…"` → `showView("groceries")`, that trip's block flashing.

## Files (`apps/turtleduck/`, load order; each ≤ ~400 lines, a header saying what it owns)
| File | What's in it (and what to copy) |
|---|---|
| `app.js` | `K.register({ id: "turtleduck", name: "Turtleduck", title: "Turtleduck — Meals", subtitle, width: 1180, backupNote, meetings: [{ id: "checkup", title: "Checkup", every: "whenever", minutes: 15 }], icon })`. Constants: `DATA_SCHEMA_VERSION 1`, the limits, `MEALS` ([key, title] in order, Cook last), `MOMO_MEALS`, `BLOCK_COOKING "Cooking"`, `BLOCK_GROCERIES "Groceries"`, `GROCERY_MINUTES 45`, `DEFAULT_COOK_MINUTES 45`, `QUICK_MINUTES 20`, `RESTAURANT_MINUTES 60`, `SHELF_DAYS 28`, `SECTIONS`, `CLIP_MS 5000`, `PAGE 30`, `PHONE_PX 900`. State `A.S` (above). Helpers: `cleanLine`, `cleanNum`, `fmtDay`, `mondayOf`, `thisMonday`/`nextMonday`, `fmtMinutes`, `fmtMacros` ("650 kcal · P 45 · C 40 · F 30 · Fi 8"), lookups (`liveRecipes`, `recipeById`, `entryById`, `entriesOn(date, meal)`, `liveTrips`, `nameOf(entry)`), `lastCooked`, `cookedTimes`, `portionsLeft`, `shelf`, `version++` on change. |
| `markup.js` | `A.markup`: the nav, `#planView` (tabs + ⋯ menu, grid, sidebar, the phone list), `#recipesView`, `#groceriesView` (Settings folded), `#cookView` (hidden), the backup section, the pop-ups (picker, entry, recipe, paste, template name). Ids unique within the app (`A.$`). |
| `changelog.js` | 1.000, 2026-10-02 (Hawky's format). |
| `data.js` | Cleaners, `load`, `persist`, `save`, `A.data = { schemaVersion, build, looksLike, hasData, importBackup, combine, afterSync }`. Copy apps/badgermole/data.js (lists + whole-object keys + settings) and Hawky's import checks. |
| `ingredients.js` | `UNITS`, `BASE` (kg → g, l → ml), `parseLine`, `normName`, `keyOf`, `fmtQty`, `fmtLine`, `scaleLines`, `GUESS` and `guessSection`. Pure functions, memoised per recipe by `u`. |
| `paste.js` | `parsePaste`, the Paste pop-up (preview, add). |
| `groceries.js` | `tripRanges`, `groceryRows`, `isTicked`, `tick`/`untick`, trips (`toggleTrip(date)`), manual adds (add, tick, remove), sections (set), `renderGroceries`, Settings' wiring (the targets). |
| `share.js` | `inbox`, `open` (apps/badgermole/share.js shape; Hawky's `due`/`overdue`). |
| `plan.js` | `renderPlan` (the grid or the phone list, totals, the sidebar with the shelf), `addEntry(date, meal, what)`, `placePortion`, `moveEntry`, `removeEntry`, `alsoOn`, `dayTotals`, `weekAverage`, the ⋯ menu's actions (`copyLastWeek`, `saveTemplate`, `loadTemplate`, `clearWeek`). |
| `plan-popups.js` | The picker and the entry pop-up. |
| `drag.js` | HTML5 drag and drop on the grid: `dragstart` (chips), `dragover`/`dragleave`/`drop` (cells), `dragend`; calls plan.js. Mouse only. |
| `clipboard.js` | Momo's copy, cut and paste by the mouse's position, for chips and cells (`S.mouse`, `S.clip`, `CLIP_MS`). |
| `recipes.js` | `renderRecipes` (the grouped list, search, Archived fold), the recipe pop-up (`openRecipe`, Save, Save & add another, Archive, Delete), `recipeFromForm`. |
| `cook.js` | `openCook(recipeIds, scale)`, `renderCook`, ‹ › on a batch day, Back; `A.awake`. |
| `render.js` | `showView`, `renderAll` (the view on screen + the nav), `reveal` (flash). |
| `events.js` | `A.init`: `K.modal` wiring via the pop-ups, click delegation by `data-act` (apps/hawky/events.js `ACTS`), the nav, tabs and the ⋯ menu, search inputs, the cart toggles, `matchMedia("(max-width: 900px)")` for the plan's shape, `S.mouse` tracking (Momo's two listeners), the phone's first view (Groceries when ≤ 640 px at load, Momo's rule); hooks: `onShow` (renderAll + `K.wakeLock.check`), `onHide` (check; drop the clip), `onTick` (a new day → renderAll), `onReload` (renderAll; the cook view stays), `onKeydown` (Ctrl+C/X/V, Esc clears the clip; Enter in the quick add), `awake`, `bugState` (counts only: recipes, archived, plan entries, this week's, trips, ticked, manual, templates, view). No `attention`. |
| `turtleduck.css` | Under `.app-turtleduck`: the nav, the tabs row and ⋯ menu, the grid (`grid-template-columns: repeat(7, 1fr)`, cells min-height, `.drop-target`, chips with glyphs, `.clipped` shading, the × on hover, `.warn` totals, the cart toggle), the sidebar (sticky, scrolling, the shelf), the phone list, the recipe rows, the grocery blocks and rows (44 px tap targets, big checkboxes, section heads, *added by hand* tag), the cook view (big type, wide spacing), the paste preview; `@media (max-width: 900px)` for the list layout, `(max-width: 640px)` for thumbs. |
| `CLAUDE.md` | In Badgermole's shape: purpose (Zuko's turtleducks; Lucide cooking-pot in amber), Files, State, Storage & backups, Its checkup, Shared with other apps (the need shapes, ids, `open`), Invariants. |

Icon (Lucide "cooking-pot", ISC; from the architect's notes — **verify against lucide.dev if the network allows**, else use as is):
```
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12h20"/><path d="M20 12v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8"/><path d="m4 8 16-4"/><path d="m8.86 6.78-.45-1.81a2 2 0 0 1 1.45-2.43l1.94-.48a2 2 0 0 1 2.43 1.46l.45 1.8"/></svg>
```

## Edge cases to honour
- **A recipe deleted or archived while planned**: entries keep `name`; the chip shows it; the cook view says "This recipe was deleted" with Back; it adds nothing to a list; its portions leave the shelf. Dangling `recipeId`s and `from`s never throw.
- **Portions**: a leftover whose cooked entry is removed stays (its name kept) and counts nothing; a cooked entry moved after its leftovers shows the red line in its pop-up and the chips get `.warn`; scaling down below the placed portions shows "placed 3, left −1" (nothing is removed by itself). Portions placed from two devices: the later `u` wins per entry, and `portionsLeft` can go negative (shown, never thrown).
- **Trips**: two devices placing trips on the same day → two trips: `liveTrips` keeps one a day (the earliest `at`) and the toggle removes both. A trip today: Now is empty. Moving or removing a trip re-cuts the ranges; ticks survive (`until` is a date).
- **Ticks**: a list's range moved earlier than a tick's `until`: still ticked (bought is bought). A meal added later past `until`: the row comes back unticked with its full quantity (the list doesn't know what's in the fridge: documented).
- **Today changes** (`onTick`): the phone list drops yesterday; past trips leave the screen; the shelf window moves; the clip is dropped.
- **Time travel / test mode**: `A.store` writes stay in memory; dates from `todayStr()`.
- **Momo**: a day with two dinners is one need, "Chili + Salad"; a skipped meal sends nothing (an empty Breakfast card is no task); a Cook-row day with no Cooking card becomes a task; Momo asks from today, so past meals never reach it; a trip's need is ✓ once its list is bought.
- **Drag and drop**: a drop on the cell an entry is already in is a no-op; a drop outside any cell does nothing; the sidebar isn't a target; a portion dragged before its cook day gets no highlight and no drop. Touch: no drag (Android Chrome's is unreliable); tapping does everything.
- **Copy and paste**: Ctrl+C over nothing does nothing; a paste over a cell of the Cook row with a leftover in the clip does nothing; a cut chip pasted keeps its id (moved), then copies.
- **Paste**: a 10 000-line paste parses in one go; Windows line ends; "## Chili" counts as a name.
- **Odd lines**: "1 (400 g) can tomatoes" → qty 1, unit "", name "(400 g) can tomatoes" (documented: write "1 can tomatoes (400 g)"); "to taste" → a name row; "2-3 cloves garlic" → 2 cloves; "1,5 kg" → 1.5 kg.
- **Numbers**: `fmtNum` never shows "2.0000000001"; fractions only for the five neat ones; grams never as fractions.
- **Damaged data** never throws: every cleaner drops what it can't use.
- Bug reports and console messages hold counts only: never recipe names, ingredients or meals.

## index.html, versions, docs
- **Commit 1 (core):** `core/kyoshi.css` `.header` gets `max-width: var(--header-width, 780px); margin-left: auto; margin-right: auto;` (nothing else moves; the shell keeps `--app-width`); `core/changelog.js` top entry **3.130**: "The header keeps one width in every app, so the app switcher and Theme stay put when you switch apps."; `tests/shell.test.js` gains the switcher-position check (Momo vs Hawky at DESKTOP); new build stamp. Commit: "Kyoshi 3.130: the header keeps one width in every app, so the switcher stays put".
- **Commit 2 (the app):** `index.html`: `<link rel="stylesheet" href="apps/turtleduck/turtleduck.css?v=…">` after Badgermole's; the scripts after Badgermole's block (app.js, markup.js, changelog.js, data.js, ingredients.js, paste.js, groceries.js, share.js, plan.js, plan-popups.js, drag.js, clipboard.js, recipes.js, cook.js, render.js, events.js), before `Kyoshi.start()`; then the build stamp: `sed -i "s/?v=[0-9][0-9-]*/?v=$(date -u +%Y%m%d-%H%M)/g" index.html`.
- `core/changelog.js`: new top entry **3.230** (3.130 + 0.100): "Added Turtleduck, for meals: recipes typed or pasted in bulk, a two-week plan laid out by dragging them onto the days (portions of a batch kept to place later), shopping trips with a grocery list each, and a cook view; Momo fills your Breakfast, Lunch, Dinner and Cooking cards with the day's meals and a Groceries card on each trip's day."
- Root `CLAUDE.md` map: `turtleduck/  meals: recipes (pasted in bulk), the two-week plan by drag and drop with batch portions, trips with a grocery list each, a cook view (meals into Momo's Breakfast/Lunch/Dinner/Cooking cards, Groceries on trip days)`. Momo's CLAUDE.md needs no change; the root contract's map line for `kyoshi.css` needs none either (the header width is a style).
- `roadmap.md`: tick Phase 6 with a Status line holding the decisions (as earlier phases did); fix the Decisions line "Turtleduck places meals by tapping… no drag and drop" and the Builder note "Turtleduck has no drag and drop" (dragging on the computer, tapping on the phone, Momo's copy and paste); the "What each app sends Momo" row: `Breakfast · Lunch · Dinner; Cooking; Groceries | one meal per block, on its day; cooking by day; groceries by time on trip days | never (meals); groceries once all ticked`; drop the pointer to this file and delete it.
- Commit 2: "Turtleduck 1.000: meals and groceries, recipes pasted in bulk, the plan by drag and drop, into Momo's meal, Cooking and Groceries cards (Kyoshi 3.230)".

## Verification (before pushing; roadmap's list, plus this plan's)
1. Open `index.html` from disk; switch to every app; console clean; the switcher and Theme don't move between Momo, Hawky and Turtleduck. Turtleduck at phone width: opens on Groceries, the plan is a list from today, rows thumb-sized, the nav reachable.
2. Recipes: New recipe → Save & add another twice; Paste recipes with three blocks (one without a name, one named like an existing recipe) → the preview reports the one and unticks the other; Add → the rest appear, grouped by meal type; Archive hides one from the sidebar and the picker; Delete a planned one → its chip keeps the name.
3. Plan: drag Chili (serves 4) onto Mon Dinner → a cooked chip, "3 portions left", the shelf shows "Chili · 3 left"; drag a portion onto Wed Lunch → a leftover chip, "2 left"; "Also on…" Thu and Fri → 0 left, the shelf entry gone; a portion dragged onto Sun of last week's days (before Mon) refuses; drop Salad on Mon Dinner too → two chips; × the Salad; Ctrl+C over Chili, Ctrl+V over Tue Dinner → a second cooked Chili (shaded while it waits; after 5 s nothing pastes); Ctrl+X then Ctrl+V moves one; drop Curry on Sun's Cook row → portions on the shelf, nothing eaten Sun; tap an empty Breakfast → the picker → Quick meal "Shake" 300 kcal; Replace a lunch with Restaurant; Skip a snack; the day totals (five numbers, "?" for a recipe without kcal, `.warn` past a target) and the week average follow; Next week tab; Copy last week adds this week's meals there; Save as template "Breakfasts", Clear week, Load template brings them back; phone width: the list, tap → the picker.
4. Groceries: place trips on Sat and Wed (the cart toggles); Chili (200 g rice, scale ×2) on Sat and Fried rice (1 kg rice) on Mon → Sat's trip: "1.4 kg rice · Chili, Fried rice" under Pantry; Wed's trip lists the later meals; a leftover adds nothing; "salt" is a quantity-less row; set an ingredient's section → remembered on the next list; add "olive oil" by hand → "Added by hand" at the top, tagged; tick rice → it sinks to Bought, "1 of N"; add a meal after Wed needing rice → rice comes back on Wed's list unticked; remove Wed's trip → Sat's covers through Sunday, the tick holds; two tabs: a tick in one shows in the other within a minute.
5. Momo: Breakfast, Lunch and Dinner cards Mon–Sun → "Dinner (Chili from Turtleduck)", a day with chili + salad reads "Chili + Salad", a leftover's details say so, a Dinner planned on a day with no card → "Dinner · Chili" in Tasks; a snack never shows; Sun's Cook row → "Cooking (Chili + Curry from Turtleduck)" or a "Cooking · …" task; a Groceries card on Sat and Wed, ✓ once a trip's list is bought; a Now item → a Groceries need due the day before its meal, overdue the day after; tap a Dinner card → details and "Open in Turtleduck" → the cook view; from Today on the phone the same; the Groceries card → that trip's block.
6. Cook view: the scaled lines read "400 g rice"; the steps as typed, line by line; nothing tappable but Back; the screen stays on (the lock is wanted while on screen, let go on Back); a batch day pages "1 of 2 · Next: Curry".
7. Time travel: +1 day → the plan's list starts on the new today, a past trip leaves the screen and its leftovers go to Now, "last cooked" and "5×" update; +1 week → next week's plan is this week's; +28 days → old portions leave the shelf.
8. Export JSON → Import JSON (counts in the confirm); Import all; a Badgermole or Hawky backup is refused ("doesn't look like a Turtleduck backup").
9. Phone (Android Chrome, through the sync folder): the grocery list ticks with a thumb; the manual add keeps the keyboard up; the cook view reads from across the counter and stays on.
10. `node tests/run.js` passes with the new tests: `tests/turtleduck.js` (screens and selectors), `tests/turtleduck-recipes.test.js` (editor, paste, archive, delete), `tests/turtleduck-plan.test.js` (drag with Playwright's `dragTo`, portions and the shelf, Also on…, copy and paste, the Cook row, quick/restaurant/skipped, totals, templates, the phone list), `tests/turtleduck-groceries.test.js` (trips, merging in base units, sections, manual adds, ticks across a range change, two tabs), `tests/turtleduck-momo.test.js` (the meal cards, Cooking, the tasks, Groceries on trip days and the Now need, Open in Turtleduck); made-up recipes, a plan with trips and Momo weeks with meal, Cooking and Groceries cards in `tests/generate.js`; the switcher check in `tests/shell.test.js`.
11. `/code-review` on the diff, then push to `main` (no checking the live site), tick the roadmap, update the CLAUDE.md files.

## Not now (the roadmap's list, kept, plus this plan's)
Photos, importing recipes from links, a pantry (what's in the fridge), nutrition databases (everything is typed), unit conversion beyond g/kg and ml/l, plural folding, custom store sections or their order, a rotation of dinners, a dot on the icon, marking a meal eaten or skipped after the fact, printing, timers in the cook view, a favourite star, drag and drop on touch, an LLM prompt for recipes. Nutrition never goes to Bosco (decided).
