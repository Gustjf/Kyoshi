# Phase 6: Turtleduck (meals and groceries) — the detailed plan (DRAFT: open questions at the end)
Drafted with the owner on 2026-10-02 from roadmap.md's Phase 6 section and the owner's brief: **make a lot of recipes at
once (a weekend's batch), then drag and drop them onto the week on the computer; the phone is for the grocery list and
for seeing what's being cooked.** Every open question at the end has a proposed default, and the plan is written as if
each default were chosen. **Once the owner answers, fold the answers into Decisions, change whatever they overturn, and
delete the questions section.** Read it when building Phase 6, after roadmap.md's top sections and its Phase 6 section.
**Where this plan and the roadmap's Phase 6 section differ, this plan wins:** it drops the roadmap's "no drag and drop"
decision (dragging with a mouse on the computer, tapping everywhere), makes the Plan screen computer-first (the phone
gets a list), adds bulk recipe entry, and sends only dinners to Momo by default. Once Phase 6 is ticked in roadmap.md
(its Status line holds the decisions), fix the two "no drag and drop" lines there (Decisions, Builder notes) and delete
this file. Work on `main` as the roadmap says (plan mode first): one app commit.

## Context
Kyoshi is a home for small vanilla HTML/JS apps sharing one core (`core/`), with Momo (a weekly time budget) at the
centre: each app lists what it needs this week and next (`A.inbox`, core/inbox.js) and Momo fills the user's cards with
it. Phases 0–5 built the inbox, Today, meetings, Hawky (errands), Iroh (goals) and Badgermole (workouts). Phase 6 adds
**Turtleduck**: recipes (typed, or pasted in bulk in a plain-text format an LLM can write), a two-week meal plan laid
out on the computer by dragging recipes onto a Mon–Sun grid (tapping works too, and is how the phone does it), the
day's kcal and protein against targets, a grocery list worked out from the plan (merged by name and unit, staples left
off, ticked on the phone), a cook view that keeps the screen on, and Momo's "Dinner" cards filled with the day's meal
plus a "Groceries" card before the shopping. No core or Momo change is needed: `fill: "block"` needs with a `date` and
`fill: "time"` needs with a `due` are handled (apps/momo/inbox.js; a block shortfall becomes a "Dinner · Chili" task,
apps/momo/tasks.js), card pop-ups show details, and `A.awake()` keeps the screen on (core/wakelock.js). The drag and
drop is Turtleduck's own, the browser's HTML5 drag and drop (mouse), not Momo's pointer code: nothing shared.

**Read first** (as the roadmap says; every file's header says what's in it): root `CLAUDE.md` (rules, contract),
`roadmap.md` top sections + Phase 6 + Builder notes, `apps/_template/CLAUDE.md`, `apps/badgermole/*` (the newest app:
app.js, data.js, share.js, render.js, editors.js, day.js, events.js, markup.js, badgermole.css, CLAUDE.md),
`apps/hawky/share.js` (a `due`/`overdue` feeder) and `apps/hawky/editor.js` + `apps/hawky/events.js` (quick add that
keeps the phone's keyboard up), `apps/wanshitong/editor.js` (Add another), `apps/appa/data.js:75–95` (merge by `u`),
`core/inbox.js` header, `apps/momo/inbox.js` header, `core/modal.js` header, `core/wakelock.js` header, `core/util.js`
exports (`newId`, `esc`, `fmtNum`, `addDays`, `todayStr`, `fmtShort`, `fmtWeekday`, `copyText`), `tests/lib.js` and
`tests/badgermole-momo.test.js` (the shape of a test).

## Decisions (proposed defaults; the Q numbers point at the open questions)
| Topic | Proposed |
|---|---|
| Who it's for | One person eating (Q1). Each plan entry is one serving eaten unless changed. |
| Plan range | **This week and Next week**, Mon–Sun, as Momo (Q3). Past days of this week stay editable; nothing further ahead. |
| Placing a meal | **Drag a recipe from the sidebar onto a slot** with the mouse (HTML5 drag and drop); **tap an empty slot → the picker** on any device (Q14). Drag a planned meal to move it; "Also on…" copies it to other days as leftovers; × removes (Q16). |
| Slots | Breakfast · Lunch · Dinner · Snack, all optional (Q5). **Several entries may share a slot** (chili + salad) (Q17). |
| Cook vs leftovers | A dropped recipe is **cooked there** (`cook: true`): its ingredients go on the grocery list, × its `scale`. "Also on…" adds **leftover** entries (`cook: false`): no ingredients, same nutrition (Q4, Q18, Q19). |
| Quick meals | A slot can hold text instead of a recipe ("Shake", "Eating out") with its own kcal and protein (Q6). |
| Nutrition | Per serving: kcal, protein, carbs, fat, each optional. Day totals show **kcal and protein against daily targets**; a week average under each tab (Q7, Q22). **Nutrition lives in Turtleduck only, never in Bosco** (the owner, 2026-10-02): no function for Bosco to read, nothing of it in Bosco's screens. |
| Bulk recipes | A **Paste recipes** pop-up taking the plain-text format below, with a preview and a **copyable prompt for Claude** that asks for recipes in that format (Q8, Q9). |
| Recipe fields | name, tags (free text, ≤ 6), ingredients (one line each), steps (one line each), prep, cook, servings, kcal, protein, carbs, fat, link (Q10). No photos (Q12). |
| Units | Lines parse to quantity, unit and name ("2 cups rice"); units are normalised (cups → cup, tbsp/tablespoon → tbsp); **merging only within the same unit, no conversion** (Q11). |
| Sidebar | Search, tag chips, **least recently cooked first** (variety), each chip "Chili · 650 · 45 g · 60 min" (Q21). |
| Phone | Plan as a **list, today first**; Groceries and Recipes one tap away in the top nav (Q23). A **cook view**: big ingredients (scaled) and steps, screen kept on, ingredients greyed by tapping (not stored) (Q24). |
| Grocery list | Cook entries from today through a date (default: the day before the next shop day when one is set, else today + 6), merged by name and unit, **alphabetical**, each row naming its recipes (Q25); **extras** typed by hand (Q26); **staples** never listed (Q28). |
| Ticks | A tick = bought for every planned use through the list's end date; a meal added later past that date brings the item back (Q27). |
| Into Momo | **Only Dinner by default** (a setting per meal): one need per day and slot, the names joined (Q29). Length prep + cook (30 without; leftovers and quick meals 15) (Q30). **Groceries**: due the day before the first meal that needs something unbought, or on the shop day when one is set, 45 min (Q31). Nothing to tick as eaten (Q32). "Open in Turtleduck" → the recipe's cook view; a quick meal → the plan (Q33). |
| Icon | Lucide **"cooking-pot"** in amber `#d97706` (Q34); 1180 px wide like Momo (Q35); a 15-minute checkup, never a dot (Q36). |

**The architect's own calls** (small; flip them if the owner objects at review):
- Ingredients are kept as **lines of text** and parsed on read (memoised), so a better parser later improves every recipe; a line that doesn't parse is all name (a quantity-less row on the list).
- A plan entry keeps the recipe's **name as placed** (`name`), used when the recipe is deleted; while the recipe exists its live name shows.
- `cook` is explicit on the entry (not worked out from the order), so it syncs and survives a moved day.
- Momo asks for needs from today on (apps/momo/inbox.js `readNeeds`), so the roadmap's "+1 day → yesterday's meals ✓" can't show on the board: meal needs carry no `done` at all. Past meals simply count as eaten (the plan is taken as done, as elsewhere in Kyoshi).
- The Groceries need is **one** need (`groceries:<through>`), by time (45 min), never two: the list is one list.
- Staples match by normalised name only ("olive oil" hides "2 tbsp olive oil" on every list); no plural folding anywhere ("tomato" and "tomatoes" are two rows: type consistently).
- Day totals show "?" beside a day when an entry's recipe has no kcal, rather than a silently low number.
- A paste never updates an existing recipe: its preview unticks a block whose name is already a live recipe (any case); ticking it adds a second one.
- Limits (Q39): name ≤ 40 (Momo's need titles are ≤ 60: two names joined are cut), ≤ 60 ingredient lines of ≤ 100, steps ≤ 4000 characters, tags ≤ 6 of ≤ 20, quick meal text ≤ 60, prep and cook 0–600, servings 1–50, scale 0.5–10 in halves, kcal 0–5000, grams 0–500, link ≤ 300, ≤ 200 recipes per paste, extras ≤ 60 characters, staples ≤ 100 names.

## Data (keys in `A.store`; core's `sync` and `meetings` beside them)
```
recipes  [{ id, name ≤ 40, tags: [≤ 6], ingredients: ["2 cups rice", …] (≤ 60 lines), steps ("one per line", ≤ 4000),
            prepMin, cookMin, servings (1–50, the yield), kcal, protein, carbs, fat (per serving; null when unknown),
            link, archived, deleted, at, u }]
plan     [{ id, date, meal: "breakfast" | "lunch" | "dinner" | "snack", recipeId ("" for a quick meal), name (the recipe's
            as placed, or the quick meal's text), kcal, protein (a quick meal's own; null otherwise), servings (eaten, 1),
            cook (true: cooked here, its ingredients on the list), scale (1; × the recipe when cook), deleted, at, u }]
checked  { "<name>|<unit>": { until: "YYYY-MM-DD" ("" = unticked, a marker), u } }   — the grocery ticks
extras   [{ id, text ≤ 60, done ("" | the day ticked), deleted, at, u }]            — items not from recipes
settings { kcalTarget, proteinTarget (null = none), staples: [names], inMomo: { breakfast, lunch, dinner, snack } (dinner true),
           shopDay (0 Mon – 6 Sun, or null), u }
```
- Deleted items keep only `{ id, deleted, at, u }` (markers, so sync can't bring them back); an archived recipe is a live one hidden from the sidebar and the picker.
- This device only (`A.S`, not stored): `view` ("plan" | "recipes" | "groceries" | "cook"), `week` ("this" | "next"), `through` (the list's end date), `search`, `tag`, `editing` (the recipe pop-up), `picking` (the picker: date + meal), `entry` (the entry pop-up), `cooking` ({ recipeId, scale, greyed: Set }), `drag` (what's being dragged), `knownToday`, `version` (counts changes, for the memos).
- **Backup**: `{ schemaVersion: 1, appVersion, recipes, plan, checked, extras, settings }` (core adds `meetings`). `looksLike = Array.isArray(raw.recipes) && Array.isArray(raw.plan)` (no other app has both). Import JSON refuses a file with no live recipes *and* no live plan entries, warns on a newer `schemaVersion`, confirms with counts ("your 48 recipes and 31 planned meals"), then replaces the five.
- **Sync** (`combine`): `recipes`, `plan` and `extras` merged item by item by `u` (copy `apps/appa/data.js` `merge`/`newer`/`inOrder`), `checked` key by key by `u`, `settings` whole, the newer `u` winning; `plain && no recipes && no plan → null`. Every cleaner (`cleanRecipe`, `cleanEntry`, `cleanChecked`, `cleanExtra`, `cleanSettings`) drops what it can't use and runs on new items too.
- `at` is a recipe's or entry's order of creation; "last cooked" and "cooked N times" are worked out from `plan` (cook entries before today, not deleted), never stored (Q37).

## The maths (ingredients.js and groceries.js; worked out, never stored; memoised by `S.version|today|through`)
- **Parsing a line** `parseLine(text)` → `{ qty, unit, name, note }`: `qty` from a leading number ("2", "1.5", "1/2", "1 1/2", "½", "2-3" → 2), else null; `unit` the next word when it's in `UNITS` (cup, tbsp, tsp, oz, lb, g, kg, ml, l, can, clove, slice, bunch, head, pkg, stick, pinch, piece, with their plurals and long forms mapped to one spelling), else ""; `name` the rest up to the first comma, lower-cased and spaces collapsed for the key, shown as typed; `note` after the comma ("drained"). "2 eggs" → qty 2, unit "", name "eggs". "salt" → qty null. `fmtLine({ qty, unit, name })` → "3 cups rice", "5 eggs", "salt"; quantities as fractions where neat (½ ¼ ¾ ⅓ ⅔), else `fmtNum` to 2 decimals.
- **Scaling** a recipe's lines by `scale`: qty × scale (null stays null). The cook view shows the scaled lines.
- **The list** `groceryRows(from, through)`: every live cook entry with `from ≤ date ≤ through` and a live recipe; each ingredient line parsed; staples skipped (`settings.staples` by normalised name); rows merged by key `name|unit`: qty summed (null + 2 = 2, null + null = null), `recipes` (names, unique), `last` (the latest date that needs it). Sorted by name. A row is **ticked** when `checked[key].until >= row.last`. Ticking sets `{ until: through, u }`; unticking `{ until: "", u }`. The count: "4 of 12", extras included. `through` defaults to the day before the next shop day strictly after today (`settings.shopDay`), else today + 6; the user can move it (a date field; never before today).
- **Day totals** `dayTotals(date)` → `{ kcal, protein, unknown }`: over the day's live entries: a recipe entry adds recipe.kcal × servings and recipe.protein × servings (`unknown` when the recipe has no kcal); a quick meal its own. Shown "1,850 · 120 g" (`fmtNum`), with "?" when `unknown`; `.warn` when kcal is over `kcalTarget` or protein under `proteinTarget` (only with targets). The week average: the days with any entry.
- **Meal minutes** `entryMinutes(e)` = cook ? (prepMin + cookMin || 30) : 15; a slot's = the sum of its entries'.
- **Sidebar order**: `lastCooked(recipeId)` (the latest cook entry before today); never cooked first (newest `at` first), then the longest ago; search matches name and tags (any case); a tag chip filters.
- **Bulk paste** `parsePaste(text)` → `{ recipes: [cleaned], problems: ["Block 3 has no name", …] }`. The format (forgiving: keys any order, any case, a colon optional, "min"/"minutes" optional, the `Ingredients:`/`Steps:` headings optional: `-`/`*`/`•` lines are ingredients, numbered lines are steps):
  ```
  # Chili
  Tags: dinner, beef, batch
  Serves: 4
  Prep: 15 min
  Cook: 45 min
  Per serving: 650 kcal, 45 g protein, 40 g carbs, 30 g fat
  Link: https://example.com/chili
  Ingredients:
  - 1 lb ground beef
  - 2 cans kidney beans, drained
  Steps:
  1. Brown the beef.
  2. Add the beans and simmer 30 min.
  ```
  A recipe starts at a line beginning with `#`; "Calories: 650", "Protein: 45 g" on their own lines are accepted too; anything unrecognised before the first ingredient is ignored. A block with no name, or with neither ingredients nor steps, is reported and skipped. The **prompt for Claude** (a Copy button in the pop-up, `K.util.copyText`): "Give me N recipes for … as plain text, one after another, in exactly this format and nothing else: <the format>. Every recipe needs servings, prep and cook minutes, and kcal, protein, carbs and fat per serving." — the user replaces N and the dots.

## Screens (1180 px wide; a top nav Plan · Recipes · Groceries as a `.mode-toggle` under the header; `showView`)
**Plan** (`#planView`), computer (> 900 px): tabs **This week · Next week** (Momo's `.window-pills` look), then the grid: a column per day Mon–Sun (the header "Mon 5", today marked, past days dimmed) and a row per meal (Breakfast, Lunch, Dinner, Snack), each cell a drop target holding its entries as chips: the name, "650 · 45 g" small, a pot glyph for a cook entry or ↩ for leftovers, an × on hover. Under each column its totals "1,850 · 120 g" (`.warn` past a target); under the grid "Week average: 1,790 kcal · 115 g protein". Beside the grid the **sidebar** (300 px): a search field, the tag chips, the recipe chips (draggable), "Quick meal" at the top (drag it onto a slot → the entry pop-up asks for the text). An empty cell shows a faint + on hover; **tapping an empty cell opens the picker**; tapping a chip opens the entry pop-up.
Phone (≤ 900 px): no sidebar, no grid: the 14 days as a list from **today** (past days of this week hidden), each day its four slots as rows ("Dinner · Chili · 650 · 45 g"; an empty slot "Dinner · —"), the day's totals on its head; tap a slot → the picker; tap an entry → the entry pop-up.
- **Drag and drop** (drag.js): `draggable="true"` on sidebar chips (`dataTransfer`: `recipe:<id>`) and on planned chips (`entry:<id>`); cells take `dragover` (preventDefault, `.drop-target`) and `drop`: a recipe → a new cook entry there (several per slot: it's added, not swapped); an entry → moved there (its `date`/`meal` change, `u` bumps). Mouse only, by design: the phone taps. `dragend` clears the classes.
- **The picker** (`#pickOverlay`): "Dinner, Mon Oct 5": a search field (focused), the recipes (same order as the sidebar, 30 at a time + More), tap one → placed (cook entry) and the pop-up closes; "Quick meal" at the bottom: a text field with kcal and protein fields and Add.
- **The entry pop-up** (`#entryOverlay`): the name; **Cook it here (serves 4) · Leftovers** (`.mode-toggle`); scale "×" (number, 0.5 steps; shown only for cook); "Servings eaten" (number); **Also on…** (the other 13 days as chips, same meal; ticked ones get leftover entries, unticked ones lose theirs); **Read** (the cook view) · **Edit recipe** (the recipe pop-up); **Swap…** (the picker, replacing this entry); **Remove**. A quick meal shows its text, kcal and protein instead of the toggle.

**Recipes** (`#recipesView`): "New recipe" · "Paste recipes…" · a search field · tag chips; the list: "Chili · beef, batch · 650 kcal · 45 g · 60 min · last cooked Sep 12 · 5×" rows (tap → the recipe pop-up), **Archived** folded at the bottom (count). Phone: the same, one row per line.
- **The recipe pop-up** (`#recipeOverlay`, `.modal.wide`): name, tags (comma-separated), servings, prep, cook, kcal, protein, carbs, fat, link, **Ingredients** (a textarea, one per line; the hint "2 cups rice · 1 can beans, drained · salt"), **Steps** (a textarea, one per line); **Save** (Enter in a field) · **Save & add another** (Wan Shi Tong's) · Cancel · **Archive** / Unarchive · **Delete** ("planned 3 times: those days keep its name"). `pending`/`ask` as apps/hawky/editor.js.
- **Paste recipes** (`#pasteOverlay`, `.modal.wide`): a big textarea, the format folded in a `<details>` with the **Copy a prompt for Claude** button; **Preview** → one row per block with a checkbox (unticked when the name exists: "already have Chili"), its counts ("9 ingredients · 6 steps · 650 kcal") and the problems in red; **Add 12 recipes**.

**Groceries** (`#groceriesView`), phone-first: "Groceries **through Fri Oct 10**" (the date tappable: a date field, never before today) · "4 of 12" · the Momo line ("Shopping by Sat Oct 4" or "No shopping needed"); an **Add** field at the top for extras (Hawky's quick add: Enter adds, the field keeps focus); the rows: a checkbox, "3 cups rice", small "Chili, Fried rice"; extras first, then the merged rows alphabetically; ticked rows sink to a **Bought** fold (count). "Settings": targets, staples (a textarea of names with "Add the usual staples" when empty: salt, pepper, olive oil, butter, sugar, flour, garlic, onion, soy sauce, vinegar), which meals go to Momo (four checkboxes), the shop day (a `<select>`: none, Mon … Sun).

**Cook** (`#cookView`, `S.view = "cook"`, Badgermole's `showView` pattern; the nav hidden): the name big, "Serves 4 · ×1" (a × stepper rescales the lines), the link, the **ingredients** as tappable rows (a tap greys one; not stored), the **steps** numbered in big type, **← Back**. `A.awake()` is true while the cook view is on screen (`K.wakeLock.check()` on enter and leave). Opened by Read, by a recipe row's "Cook" link, and by Momo's "Open in Turtleduck".

**Backup & sync** (`<section data-kyoshi="backup">`) at the end of every view's page (one section, below the views).

## Into Momo (share.js: `inbox(from, to)`, `open(id)`; copies made afresh each call)
```
meals:     for each date from–to, each meal with settings.inMomo[meal], with live entries that day and slot →
           { id: "meal:<date>:<meal>", title: the entries' names joined " + " (≤ 60), block: "Dinner" (the slot's title),
             fill: "block", date, minutes: the sum of entryMinutes, details: ["650 kcal · 45 g protein", "Prep 15 · cook 45"
             or "Leftovers" or "Quick meal", "Serves 4 · ×1" (cook entries), one line per extra entry] }
groceries: rows = groceryRows(today, through) unticked + open extras; none → nothing (or, with a shop day, nothing either).
           { id: "groceries:<through>", title: "Groceries", block: "Groceries", minutes: 45,
             date: the next shop day on or after today (when set) — else due: the day before the earliest unbought row's
             first use (today when that's passed), overdue: that day < today,
             details: ["12 items to buy", "for meals through Oct 10"] }
```
- A day's Dinner card reads "Dinner (Chili from Turtleduck)"; a day with a planned dinner and no Dinner card gives a "Dinner · Chili" task (apps/momo/tasks.js); breakfast, lunch and snack stay out unless switched on in Settings. No `done` on meals (see the architect's calls). Momo's Today shows the meal with "Open in Turtleduck".
- The Groceries need fills a "Groceries" card by time (Hawky's way): on or before its due day, the soonest; or on the shop day. Once everything is ticked the need goes (nothing to show: `done` with no date is dropped by Momo; with a shop day, a done need dated that day would show ✓ — send `{ …, date: shopDay, done: true }` then, so the card reads ✓).
- Limits hold: block ≤ 40, title ≤ 60, details ≤ 8 × 100; ids stay the same for the same slot and list.
- `open(id)`: `"meal:<date>:<meal>"` → the slot's first entry with a recipe → `showView("cook")` on it (scale from the entry); none → the plan on that week (`S.week`), that cell flashing (Hawky's `flash`); `"groceries:…"` → `showView("groceries")`.

## Files (`apps/turtleduck/`, load order; each ≤ ~400 lines, a header saying what it owns)
| File | What's in it (and what to copy) |
|---|---|
| `app.js` | `K.register({ id: "turtleduck", name: "Turtleduck", title: "Turtleduck — Meals", subtitle, width: 1180, backupNote, meetings: [{ id: "checkup", title: "Checkup", every: "whenever", minutes: 15 }], icon })`. Constants: `DATA_SCHEMA_VERSION 1`, the limits, `MEALS` ([key, title] in order), `BLOCK_GROCERIES "Groceries"`, `GROCERY_MINUTES 45`, `DEFAULT_COOK_MINUTES 30`, `LEFTOVER_MINUTES 15`, `LIST_DAYS 6`, `USUAL_STAPLES`, `PAGE 30`. State `A.S` (above). Helpers: `cleanLine`, `cleanNum`, `fmtDay`, `mondayOf`, `thisMonday`/`nextMonday`, `fmtMinutes`, `fmtKcal` ("650 kcal · 45 g protein"), lookups (`liveRecipes`, `recipeById`, `entryById`, `entriesOn(date, meal)`, `liveExtras`, `nameOf(entry)`), `lastCooked`, `cookedTimes`, `version++` on change. |
| `markup.js` | `A.markup`: the nav, `#planView` (tabs, grid, sidebar, the phone list), `#recipesView`, `#groceriesView` (with Settings folded), `#cookView` (hidden), the backup section, the pop-ups (picker, entry, recipe, paste). Ids unique within the app (`A.$`). |
| `changelog.js` | 1.000, 2026-10-02 (Hawky's format). |
| `data.js` | Cleaners, `load`, `persist`, `save`, `A.data = { schemaVersion, build, looksLike, hasData, importBackup, combine, afterSync }`. Copy apps/badgermole/data.js (lists + a whole-object key + settings) and Hawky's import checks. |
| `ingredients.js` | `UNITS`, `parseLine`, `normName`, `keyOf`, `fmtQty`, `fmtLine`, `scaleLines`. Pure functions, memoised per recipe by `u`. |
| `paste.js` | `parsePaste`, the Paste pop-up (preview, add), the prompt text and its Copy button. |
| `groceries.js` | `defaultThrough`, `groceryRows`, `isTicked`, `tick`/`untick`, extras (add, tick, remove), `renderGroceries`, Settings' wiring (targets, staples, inMomo, shopDay). |
| `share.js` | `inbox`, `open` (apps/badgermole/share.js shape; Hawky's `due`/`overdue`). |
| `plan.js` | `renderPlan` (the grid or the phone list, totals, the sidebar), `addEntry(date, meal, recipeId | text)`, `moveEntry`, `removeEntry`, `alsoOn`, `dayTotals`, `weekAverage`, the picker and entry pop-ups. Split the pop-ups into `entry-editor.js` if it passes ~400 lines. |
| `drag.js` | HTML5 drag and drop on the grid: `dragstart` (chips), `dragover`/`dragleave`/`drop` (cells), `dragend`; calls `addEntry`/`moveEntry`. Mouse only. |
| `recipes.js` | `renderRecipes` (the list, search, tags, Archived fold), the recipe pop-up (`openRecipe`, Save, Save & add another, Archive, Delete), `recipeFromForm`. |
| `cook.js` | `openCook(recipeId, scale)`, `renderCook`, the × stepper, greying rows, Back; `A.awake`. |
| `render.js` | `showView`, `renderAll` (the view on screen + the nav), `reveal` (flash). |
| `events.js` | `A.init`: `K.modal` wiring via the pop-ups, click delegation by `data-act` (apps/hawky/events.js `ACTS`), the nav, tabs, search/tag inputs, the through date, `matchMedia("(max-width: 900px)")` for the plan's shape; hooks: `onShow` (renderAll + `K.wakeLock.check`), `onHide` (check), `onTick` (a new day → `through` default and renderAll), `onReload` (renderAll; the cook view stays), `onKeydown` (Esc handled by core; Enter in the quick add), `awake`, `bugState` (counts only: recipes, archived, plan entries, this week's, ticked, extras, view). No `attention`. |
| `turtleduck.css` | Under `.app-turtleduck`: the nav, the grid (`grid-template-columns: repeat(7, 1fr)`, cells min-height, `.drop-target`, chips with the pot/↩ glyph, the × on hover, `.warn` totals), the sidebar (sticky, scrolling), the phone list, the recipe rows, the grocery rows (44 px tap targets, big checkboxes), the cook view (big type), the paste preview; `@media (max-width: 900px)` for the list layout, `(max-width: 640px)` for thumbs. |
| `CLAUDE.md` | In Badgermole's shape: purpose (Zuko's turtleducks; Lucide cooking-pot in amber), Files, State, Storage & backups, Its checkup, Shared with other apps (both need shapes, ids, `open`), Invariants. |

Icon (Lucide "cooking-pot", ISC; from the architect's notes — **verify against lucide.dev if the network allows**, else use as is):
```
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12h20"/><path d="M20 12v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8"/><path d="m4 8 16-4"/><path d="m8.86 6.78-.45-1.81a2 2 0 0 1 1.45-2.43l1.94-.48a2 2 0 0 1 2.43 1.46l.45 1.8"/></svg>
```

## Edge cases to honour
- **A recipe deleted or archived while planned**: entries keep `name`; the chip shows it; the cook view says "This recipe was deleted" with Back; it adds nothing to the list. Dangling `recipeId`s never throw.
- **Two devices**: ticks merge by `u` per key (the later tick or untick wins); the same recipe pasted on both devices is two recipes (documented, no guard); an entry moved on one and removed on the other: the later `u` wins.
- **The list's date moved earlier** than a tick's `until`: still ticked (bought is bought). A meal added later with a date past `until`: the row comes back unticked, with its full quantity (the list doesn't know what's in the fridge: documented).
- **Today changes** (`onTick`): `through` goes back to its default when it was at the default; the phone list drops yesterday; the sidebar's order may change.
- **Time travel / test mode**: `A.store` writes stay in memory; dates from `todayStr()`.
- **Momo**: a day with two dinners (chili + salad) is one need, "Chili + Salad"; a planned dinner on a day whose Dinner card was deleted becomes a task; switching a meal off in Settings removes its needs at the next draw. Momo asks from today, so past meals never reach it.
- **Drag and drop**: a drop on a cell already holding that entry is a no-op; a drop outside any cell does nothing (the chip snaps back); `dragover` on the sidebar isn't a target. Touch: no drag (Android Chrome's is unreliable); tapping does everything.
- **Paste**: a 10 000-line paste parses in one go (no UI during); Windows line ends; a block whose name repeats within the paste gets "(2)"; a header line like "## Chili" counts as a name.
- **Odd lines**: "1 (15 oz) can tomatoes" → qty 1, unit "", name "(15 oz) can tomatoes" (documented: write "1 can tomatoes (15 oz)"); "to taste" → a name row; "2-3 cloves garlic" → 2 cloves.
- **Numbers**: `fmtNum` never shows "2.0000000001"; fractions only for the five neat ones.
- **Damaged data** never throws: every cleaner drops what it can't use.
- Bug reports and console messages hold counts only: never recipe names, ingredients or meals.

## index.html, versions, docs
- `index.html`: `<link rel="stylesheet" href="apps/turtleduck/turtleduck.css?v=…">` after Badgermole's; the scripts after Badgermole's block (app.js, markup.js, changelog.js, data.js, ingredients.js, paste.js, groceries.js, share.js, plan.js, drag.js, recipes.js, cook.js, render.js, events.js), before `Kyoshi.start()`; then the build stamp: `sed -i "s/?v=[0-9][0-9-]*/?v=$(date -u +%Y%m%d-%H%M)/g" index.html`.
- `core/changelog.js`: new top entry **3.220** (3.120 + 0.100): "Added Turtleduck, for meals: recipes typed or pasted in bulk, a two-week plan laid out by dragging them onto the days, the grocery list worked out from it, and a cook view; Momo fills your "Dinner" cards with the day's meal and a "Groceries" card before the shopping."
- Root `CLAUDE.md` map: `turtleduck/  meals: recipes (pasted in bulk), the two-week plan by drag and drop, groceries from it, a cook view (dinners into Momo's Dinner cards, a Groceries card)`. Momo's and core's CLAUDE.md need no change.
- `roadmap.md`: tick Phase 6 with a Status line holding the decisions (as earlier phases did); fix the Decisions line "Turtleduck places meals by tapping… no drag and drop" and the Builder note "Turtleduck has no drag and drop" (dragging on the computer, tapping on the phone); the "What each app sends Momo" row (Dinner by default, the others optional); drop the pointer to this file and delete it.
- Commit: "Turtleduck 1.000: meals and groceries, recipes pasted in bulk, the plan by drag and drop, into Momo's Dinner and Groceries cards (Kyoshi 3.220)".

## Verification (before pushing; roadmap's list, plus this plan's)
1. Open `index.html` from disk; switch to every app; console clean. Turtleduck at phone width: the plan is a list from today, the grocery rows thumb-sized, the nav reachable.
2. Recipes: New recipe → Save & add another twice; Paste recipes with three blocks (one without a name, one named like an existing recipe) → the preview reports the one and unticks the other; Add → the rest appear; Copy a prompt puts text on the clipboard; Archive hides one from the sidebar and the picker; Delete a planned one → its chip keeps the name.
3. Plan: drag Chili onto Mon Dinner → a cook chip; drag it to Tue → moved; "Also on…" Wed and Thu → two leftover chips (↩); drop Salad on Tue Dinner too → two chips; tap an empty Breakfast → the picker → a quick meal "Shake" with 300 kcal; the day totals and the week average follow, `.warn` past the targets, "?" for a recipe without kcal; Next week tab; phone width: the list, tap → the picker.
4. Groceries: Chili (2 cups rice) on Mon and Fried rice (1 cup rice) on Thu → "3 cups rice · Chili, Fried rice"; "salt" hidden as a staple; add "paper towels" by hand; tick rice → sinks to Bought, "1 of N"; move the date earlier → still ticked; add Fried rice again on Oct 12 (past the date) → rice comes back unticked; two tabs: a tick in one shows in the other within a minute.
5. Momo: Dinner cards Mon–Sun → "Dinner (Chili from Turtleduck)", a day with chili + salad reads "Chili + Salad", a Dinner planned on a day with no card → "Dinner · Chili" in Tasks; breakfast stays out until switched on in Settings; a Groceries card the day before the first unbought meal (then on the shop day once one is set); tap a Dinner card → the pop-up's details and "Open in Turtleduck" → the cook view; from Today on the phone the same; the Groceries card → the list.
6. Cook view: the × stepper rescales "2 cups" to "4 cups"; a tapped ingredient greys; the screen stays on (the lock is wanted while on screen, let go on Back); Momo's wake lock test pattern (tests/wakelock.test.js) covers it.
7. Time travel: +1 day → the plan's list starts on the new today, the sidebar's "last cooked" updates, the grocery date moves on; +1 week → next week's plan is this week's.
8. Export JSON → Import JSON (counts in the confirm); Import all; a Badgermole or Hawky backup is refused ("doesn't look like a Turtleduck backup").
9. Phone (Android Chrome, through the sync folder): the grocery list ticks with a thumb; the quick add keeps the keyboard up; the cook view reads from across the counter.
10. `node tests/run.js` passes with the new tests: `tests/turtleduck.js` (screens and selectors), `tests/turtleduck-recipes.test.js` (editor, paste, archive, delete), `tests/turtleduck-plan.test.js` (drag with Playwright's `dragTo`, tap to pick, Also on…, totals, phone list), `tests/turtleduck-groceries.test.js` (merge, staples, extras, ticks and the date, two tabs), `tests/turtleduck-momo.test.js` (Dinner cards, the task, Groceries card, Open in Turtleduck, settings); made-up recipes, a plan and Momo weeks with Dinner and Groceries cards in `tests/generate.js`.
11. `/code-review` on the diff, then push to `main` (no checking the live site), tick the roadmap, update the CLAUDE.md files.

## Not now (the roadmap's list, kept, plus this plan's)
Photos, importing recipes from links, a pantry (what's in the fridge), nutrition databases (everything is typed or pasted), unit conversion when merging, plural folding, store sections, copying a week or saving one as a template, a rotation of dinners, a dot on the icon, marking a meal eaten or skipped, printing, timers in the cook view. Nutrition never goes to Bosco (decided).

## Open questions for the owner (answer in one batch; the default in brackets is what the plan assumes)
**You and your week**
1. Who eats: just you, or others too? [just you; servings eaten default to 1]
2. How do you shop: one trip a week on a set day (which?), several small trips, delivery? [no set day: the list runs a week ahead and Momo's Groceries card lands the day before the first meal that needs something; a shop day in Settings switches to that day]
3. When do you plan: a week at a time, the weekend before? Two weeks? [This week and Next week tabs, Mon–Sun like Momo, nothing further]
4. Cooking style: cook most nights, or batch-cook a few things and eat leftovers for days? [both work: a dropped recipe is cooked there; "Also on…" adds leftover days]
5. Which meals do you actually plan? All four? Is breakfast the same most days? [four slots, all optional; nothing repeats by itself]
6. Eating out or skipping a meal: record it ("Eating out" as a quick meal) or leave the slot empty? [either; a quick meal can carry its own kcal]
7. Nutrition: kcal and protein only, or carbs and fat too? Daily targets? Will you really type nutrition for every recipe, or let Claude supply it in the paste? [kcal, protein, carbs, fat per serving, all optional; day totals show kcal and protein against daily targets]

**Making recipes in bulk**
8. Where do recipes come from: your head, websites, cookbooks, Claude/ChatGPT? [a paste box in a plain-text format an LLM writes easily, plus a copyable prompt for Claude]
9. Is the paste format in the plan right? Would you rather paste JSON (the backup shape)? [the text format only]
10. Fields: name, tags, ingredients, steps, prep, cook, servings, nutrition, link. Anything else: cuisine, rating, notes? Tags as free text? [free-text tags, up to 6]
11. Units: US (cups, tbsp, oz, lb), metric, or mixed? Should "1 lb" and "8 oz" merge? [mixed accepted; merging only within the same unit, no conversion]
12. No photos, as the roadmap says? [none]
13. The editor: a pop-up with ingredients and steps as one-per-line text boxes and "Save & add another"? [yes]

**Planning on the computer**
14. The roadmap said tap only; you now want drag and drop. Proposed: drag with the mouse on the computer, tap-to-pick everywhere (no drag on the phone). OK? [yes]
15. Layout: days as columns, meals as rows, the recipe list beside it; tabs This week / Next week. Or days as rows? Or 14 days from today? [the grid as described]
16. Dragging a planned meal moves it; leftovers via "Also on…"; × removes. Want Ctrl-drag to copy? [no]
17. Several things in one slot (chili + salad) or one per slot? [several; Momo gets one need per slot, "Chili + Salad"]
18. When you drop a 4-serving recipe, should it offer the next days as leftovers by itself, or do you add them? [you add them, via "Also on…"]
19. Scaling: cook ×2 → grocery quantities double? [yes, a × on the cook entry]
20. Copy last week, save a week as a template, a rotation of dinners? [none of those now]
21. Sidebar order: recent first, A–Z, least recently cooked, by tag? Show kcal · protein · minutes on each chip? [least recently cooked first; search and tag chips; yes to the numbers]
22. Day totals under each day against the targets, plus a week average? [yes]

**On the phone**
23. What would you open Turtleduck for on the phone: the groceries, tonight's recipe, the week? Which screen should it open on? [the plan as a list, today first; Groceries one tap away; Momo's Today already names the meal with "Open in Turtleduck"]
24. A cook view: the recipe full-screen, ingredients scaled, big steps, screen kept on, ingredients greyed by tapping? [yes to all; nothing stored]
25. Grocery list order: by store section (produce, meat, dairy…), alphabetical, or by recipe? With sections, you'd assign each ingredient's section once. [alphabetical, each row naming its recipes; sections not now]
26. Extra items not from recipes (milk, paper towels): a quick add on the list? [yes]
27. A tick means bought, for every planned use through the list's end date; a meal added later past that date brings the item back; "already have it" is the same tick. OK? [yes]
28. Staples never listed (salt, oil…): a list in Settings with an "Add the usual staples" button? [yes]

**Momo**
29. Which meals get Momo cards? All four means up to 56 needs over two weeks, and days without a Breakfast card make "Breakfast · Oats" tasks. [only Dinner, a setting per meal]
30. The card's length: prep + cook, 30 without; leftovers and quick meals 15? [yes]
31. The Groceries card: the day before the first meal that needs something (roadmap), or on your shop day (Q2)? 45 min? [the roadmap's rule; a shop day switches to that day]
32. Nothing to tick as eaten: past meals just count. Want a "didn't cook" mark? [no]
33. "Open in Turtleduck" from a Dinner card: the recipe (cook view) or the plan with that slot? [the recipe; a quick meal → the plan]

**Small things**
34. Icon and colour: Lucide "cooking-pot" in amber? [yes]
35. 1180 px wide like Momo (the grid needs it)? [yes]
36. A 15-minute checkup, no schedule; never a dot on the icon (Momo carries the Groceries card)? [yes]
37. "Last cooked Sep 12 · 5×" on recipes, from the plan? A favourite star? [last cooked only]
38. Printing the week or the list (core has K.pdf): not now? [not now]
39. Limits: name ≤ 40, ≤ 60 ingredient lines, steps ≤ 4000 characters, tags ≤ 6, up to 200 recipes per paste. OK? [yes]
40. Anything in the roadmap's "not now" list (photos, importing from links, a pantry, nutrition databases) you'd pull forward? [no]
