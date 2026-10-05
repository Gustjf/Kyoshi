/* Kyoshi · tests/turtleduck-recipes.test.js — Turtleduck's recipes, as the user keeps them: the pop-up (Save & add
 * another, its checks, Esc asking first), the list by meal type with "last cooked" and "5×", Archive (out of the sidebar
 * and the picker), Delete (planned meals keep the name; the lists and the cook view know it's gone); Paste recipes (a
 * block without a name, one you already have, one repeated in the paste); the cook view (the steps as typed, a batch's
 * scaled amounts); store-bought items (Cooked · Store-bought, On hand kept, counted again or emptied, "last had", the
 * paste key, the cook view); and the data: Export then Import, other apps' backups and an empty one refused, a damaged
 * one cleaned, bug reports with counts only. */
"use strict";
const { TODAY, DESKTOP, eq, ok, has, lacks, open, importBackup, exportBackup, lastDialog, switchTo, addDays, mondayOf, travel } = require("./lib");
const gen = require("./generate");
const td = require("./turtleduck");

const D = n => addDays(TODAY, n);

module.exports = [
  {
    name: "turtleduck recipes: New recipe, Save & add another, the checks, the list by meal type, Archive, Delete a planned one",
    async run(t) {
      const tab = await open(t, { app: "turtleduck", size: DESKTOP }), p = tab.page;
      await td.view(tab, "recipes");
      has(await p.locator("#kMount #recipesEmpty").innerText(), "No recipes yet", "nothing yet");
      await p.click("#kMount #newRecipeBtn");
      await td.fillRecipe(tab, { name: "Chili", meal: "dinner", servings: 4, prep: 15, cook: 45, kcal: 650, protein: 45, ingredients: ["500 g ground beef", "200 g rice", "salt"], steps: "Brown the beef.\n- Simmer" });
      await p.click("#kMount #recipeAnotherBtn");
      eq(await p.locator("#kMount #recipeStatus").innerText(), "Added “Chili”.", "added, and the pop-up stays for the next");
      eq([await p.locator("#kMount #recipeName").inputValue(), await p.locator('#kMount #recipeTypes .active').innerText()], ["", "Dinner"], "a clean form, the same meal type");
      await td.fillRecipe(tab, { name: "Tacos", kcal: 500, ingredients: ["8 tortillas"] });
      await p.click("#kMount #recipeAnotherBtn");
      // The checks: a name you have (any case), a number out of range.
      await td.fillRecipe(tab, { name: "chili" });
      await p.click('#kMount #recipeForm button[type="submit"]');
      eq(lastDialog(tab), "There's already a recipe called “chili”.", "names are unique");
      await td.fillRecipe(tab, { name: "Pancakes", meal: "breakfast", servings: 0 });
      await p.press("#kMount #recipeName", "Enter");
      eq(lastDialog(tab), "Serves: a whole number from 1 to 50.", "serves 1 to 50");
      await td.fillRecipe(tab, { servings: 2, kcal: 350 });
      await p.press("#kMount #recipeServings", "Enter");
      ok(!(await p.locator("#kMount #recipeOverlay").evaluate(el => el.classList.contains("open"))), "Enter saves and closes");
      eq(await p.$$eval("#kMount #recipeGroups .r-group h2", els => els.map(e => e.textContent.trim())), ["Breakfast 1", "Dinner 2"], "grouped by meal type");
      eq(await td.recipeRows(tab), ["Pancakes · 350 kcal", "Chili · 650 kcal · P 45 · 1 h", "Tacos · 500 kcal"], "each with its numbers");

      // Esc on a changed pop-up asks first; saying no keeps it open.
      await p.click('#kMount #recipeGroups [data-act="recipe"]:has-text("Tacos")');
      await p.fill("#kMount #recipeName", "Tacos al pastor");
      tab.answers.push(false);
      await p.keyboard.press("Escape");
      eq(lastDialog(tab), "Discard your changes to this recipe?", "asked first");
      ok(await p.locator("#kMount #recipeOverlay").evaluate(el => el.classList.contains("open")), "still open");
      // Archive: out of the list (into Archived), the sidebar and the picker.
      await p.fill("#kMount #recipeName", "Tacos");
      await p.click("#kMount #recipeArchiveBtn");
      eq(await td.recipeRows(tab), ["Pancakes · 350 kcal", "Chili · 650 kcal · P 45 · 1 h"], "Tacos is archived");
      eq([await p.locator("#kMount #archivedCount").innerText(), await td.recipeRows(tab, "archivedList")], ["(1)", ["Tacos · 500 kcal"]], "in the Archived fold");
      await td.view(tab, "plan");
      lacks(await p.locator("#kMount #sideRecipes").innerText(), "Tacos", "not in the sidebar");
      await td.openPicker(tab, TODAY, "dinner");
      lacks((await td.pickList(tab)).join(" | "), "Tacos", "nor the picker");
      await td.pickRecipe(tab, "Chili");

      // Delete a planned recipe: asked, with how often it's planned; the meal keeps its name; the lists drop it.
      await td.view(tab, "recipes");
      await p.click('#kMount #recipeGroups [data-act="recipe"]:has-text("Chili")');
      has(await p.locator("#kMount #recipeUse").innerText(), "planned 1 time from today", "the pop-up says it's planned");
      await p.click("#kMount #recipeDeleteBtn");
      eq(lastDialog(tab), "Delete “Chili”? It's planned 1 time: those days keep its name. This can't be undone.", "asked first");
      await td.view(tab, "plan");
      eq(await td.chips(tab, TODAY, "dinner"), ["Chili"], "the planned meal keeps the name");
      await td.openEntry(tab, TODAY, "dinner", "Chili");
      has(await td.entryText(tab), "This recipe was deleted", "its pop-up says so");
      ok(await p.locator('#kMount #entryOverlay [data-entry="read"]').isHidden(), "nothing to read");
      await td.closeEntry(tab);
      await td.view(tab, "groceries");
      lacks(await p.locator("#kMount #lists").innerText(), "ground beef", "nothing on the grocery list from it");
    }
  },
  {
    name: "turtleduck recipes: Paste recipes (no name, one you have, one repeated), last cooked and 5×, the cook view",
    async run(t) {
      const past = [-21, -14, -7, -2].map((n, i) => ({ date: D(n), meal: "dinner", recipeId: "rc-chili", id: `past-${i}` }));
      const tab = await open(t, { app: "turtleduck", size: DESKTOP }), p = tab.page;
      await importBackup(tab, gen.turtleduck({ plan: past.concat([{ date: D(1), meal: "dinner", recipeId: "rc-chili", scale: 2 }, { date: D(2), meal: "dinner", recipeId: "rc-chili" }]) }));
      await td.view(tab, "recipes");
      has((await td.recipeRows(tab)).join(" | "), "Chili · 650 kcal · P 45 · 1 h · last cooked Sep 28 · 4×", "cooked 4 times up to today, the planned ones not yet");
      await p.click("#kMount #pasteBtn");
      await p.fill("#kMount #pasteText", [
        "# Chili", "- 1 egg", "",
        "#", "- 2 eggs", "",
        "# Pancakes", "Meal: breakfast", "Serves 2", "Prep: 15-20 min", "Per serving: 350 kcal, 12 g protein", "- 200 g flour", "- 2 eggs", "Mix and fry.", "",
        "# Pancakes", "- 1 cup milk", "",
        "# Toast", "Toast the bread."
      ].join("\r\n"));
      await p.click("#kMount #pastePreviewBtn");
      const rows = () => p.$$eval("#kMount #pasteRows .paste-row", els => els.map(e => `${e.querySelector("input").checked ? "[x]" : "[ ]"} ${e.querySelector(".paste-main").innerText.replace(/\s*\n\s*/g, " · ")}`));
      eq(await rows(), [
        "[ ] Chili · 1 ingredient · no steps · already have Chili",
        "[ ] Recipe 2 · Recipe 2 has no name after its #",
        "[x] Pancakes · 2 ingredients · 350 kcal",
        "[x] Pancakes · 1 ingredient · no steps · adds “Pancakes (2)”",
        "[x] Toast · 0 ingredients"
      ], "the preview");
      eq(await p.locator("#kMount #pasteAddBtn").innerText(), "Add 3 recipes", "three ticked");
      await p.click('#kMount #pasteRows input[data-n="1"]');
      has((await rows())[0], "adds “Chili (2)”", "a second Chili, if ticked");
      await p.click("#kMount #pasteAddBtn");
      eq(await p.evaluate(() => Kyoshi.apps.turtleduck.liveRecipes().filter(r => r.name === "Pancakes").map(r => [r.meal, r.servings, r.prepMin, r.kcal, r.protein, r.ingredients, r.steps])),
        [["breakfast", 2, 15, 350, 12, ["200 g flour", "2 eggs"], "Mix and fry."]], "read as written (a range of minutes: its lower end)");
      eq((await td.recipeRows(tab)).map(r => r.split(" · ")[0]), ["Overnight oats", "Pancakes", "Rice bowl", "Salad", "Chili", "Curry", "Fried rice", "Mystery stew", "Chili (2)", "Pancakes (2)", "Toast"], "added, by meal type (no Meal: line is Any)");

      // The cook view: the steps as typed (bullets as bullets), from a recipe's Cook.
      await p.click('#kMount #recipeGroups [data-act="cook"][data-id="rc-chili"]');
      let c = await td.cook(tab);
      eq([c.name, c.meta, c.ingredients, c.steps], ["Chili", "Serves 4 · prep 15 min · cook 45 min",
        ["500 g ground beef", "2 cans kidney beans, drained", "200 g rice", "1 onion, diced", "salt"], ["Brown the beef.", "• Add the beans", "• Simmer 30 min", "Season to taste."]], "the recipe, big");
      ok(await p.evaluate(() => Kyoshi.apps.turtleduck.awake()), "the screen stays on");
      ok(await p.locator("#kMount #nav").isHidden() && await p.locator('#kMount [data-kyoshi="backup"]').isHidden(), "nothing else to tap");
      await p.click('#kMount [data-act="cook-back"]');
      ok(await p.locator("#kMount #recipesView").isVisible() && !(await p.evaluate(() => Kyoshi.apps.turtleduck.awake())), "Back goes back, and lets the screen sleep");
      // A batch ×2, read from its pop-up: the amounts doubled.
      await td.view(tab, "plan");
      await td.openEntry(tab, D(1), "dinner", "Chili");
      await td.entryAct(tab, "read");
      c = await td.cook(tab);
      eq([c.meta, c.ingredients], ["×2 · 8 portions · prep 15 min · cook 45 min", ["1 kg ground beef", "4 cans kidney beans, drained", "400 g rice", "2 onion, diced", "salt"]], "scaled");
      await p.keyboard.press("Escape");
      ok(await p.locator("#kMount #planView").isVisible(), "Esc leaves it too");

      // Time travel: a week on, the planned ones are cooked too.
      await travel(tab, 7);
      await td.view(tab, "recipes");
      has((await td.recipeRows(tab)).join(" | "), `last cooked Oct 2 · 6×`, "last cooked and 6×");
    }
  },
  {
    name: "turtleduck recipes: store-bought — Cooked · Store-bought, On hand (kept, counted again, emptied), last had, Read, the paste key",
    async run(t) {
      const tab = await open(t, { app: "turtleduck", size: DESKTOP }), p = tab.page;
      await importBackup(tab, gen.turtleduck({ recipes: ["rc-chili"] }));
      await td.view(tab, "recipes");
      const row = name => `#kMount #recipeGroups .recipe-row:has(.rr-name:text-is("${name}"))`;
      const openRow = name => p.click(`${row(name)} [data-act="recipe"]`);
      const save = () => p.click('#kMount #recipeForm button[type="submit"]');
      const mine = () => p.evaluate(() => Kyoshi.apps.turtleduck.liveRecipes().filter(r => r.name !== "Chili").map(r => [r.name, r.bought, r.stock]));
      const rows = async () => (await td.recipeRows(tab)).filter(r => !r.startsWith("Chili"));

      // New: Cooked unless picked; Store-bought asks how many are on hand. Save & add another keeps the pick.
      await p.click("#kMount #newRecipeBtn");
      ok(await p.locator("#kMount #recipeStockBox").isHidden(), "Cooked: no On hand");
      await p.click('#kMount #recipeMade [data-made="bought"]');
      ok(await p.locator("#kMount #recipeStockBox").isVisible() && await p.locator("#kMount #recipeStockHint").isVisible(), "Store-bought: On hand, explained");
      await td.fillRecipe(tab, { name: "Protein shake", meal: "snack", kcal: 160, protein: 30 });
      await p.fill("#kMount #recipeStock", "6");
      await p.click("#kMount #recipeAnotherBtn");
      eq([await p.locator("#kMount #recipeMade .active").innerText(), await p.locator("#kMount #recipeStock").inputValue()], ["Store-bought", ""], "Store-bought kept, On hand cleared");
      await td.fillRecipe(tab, { name: "Granola bar", kcal: 200 });
      await p.fill("#kMount #recipeStock", "1.5");
      await save();
      eq(lastDialog(tab), "On hand: a whole number from 0 to 999, or empty.", "a whole number");
      await p.fill("#kMount #recipeStock", "");
      await save();
      eq(await rows(), ["Granola bar · store-bought · 200 kcal", "Protein shake · store-bought · 6 on hand · 160 kcal · P 30"], "store-bought, and how many are on hand");
      eq(await mine(), [["Granola bar", true, null], ["Protein shake", true, { count: 6, date: TODAY }]], "counted today; the bar isn't tracked");

      // Planned today and tomorrow: today's is taken as eaten.
      await td.view(tab, "plan");
      for (const d of [TODAY, D(1)]) { await td.openPicker(tab, d, "lunch"); await td.pickRecipe(tab, "Protein shake"); }
      await td.view(tab, "recipes");
      eq((await rows())[1], "Protein shake · store-bought · 5 on hand · 160 kcal · P 30 · last had Sep 30 · 1×", "5 on hand after today's, last had");
      // Its pop-up shows the count before today's meals; saved as it is, the count keeps its day.
      await openRow("Protein shake");
      eq([await p.locator("#kMount #recipeStock").inputValue(), await p.locator("#kMount #recipeUse").innerText()], ["6", "Had 1×, last Sep 30 · planned 2 times from today"], "as counted this morning");
      await save();
      eq((await mine())[1], ["Protein shake", true, { count: 6, date: TODAY }], "unchanged");

      // A day on: 4 on hand (5 this morning); counted again, from today.
      await travel(tab, 1);
      eq((await rows())[1], "Protein shake · store-bought · 4 on hand · 160 kcal · P 30 · last had Oct 1 · 2×", "a day on");
      await openRow("Protein shake");
      eq(await p.locator("#kMount #recipeStock").inputValue(), "5", "5 before today's");
      await p.fill("#kMount #recipeStock", "10");
      await save();
      eq([(await mine())[1], (await rows())[1]], [["Protein shake", true, { count: 10, date: D(1) }], "Protein shake · store-bought · 9 on hand · 160 kcal · P 30 · last had Oct 1 · 2×"], "counted again today");
      // Emptied: not tracked; Cooked: a recipe again.
      await openRow("Protein shake");
      await p.fill("#kMount #recipeStock", "");
      await save();
      eq((await mine())[1], ["Protein shake", true, null], "not tracked");
      eq(await p.locator(`${row("Protein shake")} [data-act="cook"]`).innerText(), "Read", "nothing to cook");
      await p.click(`${row("Protein shake")} [data-act="cook"]`);
      const c = await td.cook(tab);
      eq([c.name, c.meta, c.ingredients, c.steps], ["Protein shake", "Store-bought", [], []], "the cook view: just its name");
      await p.click('#kMount [data-act="cook-back"]');
      await openRow("Protein shake");
      await p.click('#kMount #recipeMade [data-made="cooked"]');
      ok(await p.locator("#kMount #recipeStockBox").isHidden(), "no On hand");
      await save();
      eq([(await mine())[1], (await rows())[1]], [["Protein shake", false, null], "Protein shake · 160 kcal · P 30 · last cooked Oct 1 · 2×"], "cooked");

      // Paste: Store-bought (or Bought, Ready-made) yes needs no ingredients or steps.
      await p.click("#kMount #pasteBtn");
      await p.fill("#kMount #pasteText", ["# Iced coffee", "Store-bought: yes", "Per serving: 90 kcal", "", "# Bar", "Bought: maybe", "", "# Hummus", "Ready-made", "- 1 tub hummus"].join("\n"));
      await p.click("#kMount #pastePreviewBtn");
      eq(await p.$$eval("#kMount #pasteRows .paste-row", els => els.map(e => `${e.querySelector("input").checked ? "[x]" : "[ ]"} ${e.querySelector(".paste-main").innerText.replace(/\s*\n\s*/g, " · ")}`)), [
        "[x] Iced coffee · store-bought · 90 kcal",
        "[ ] Bar · no ingredients or steps · Bought: couldn't read yes or no",
        "[x] Hummus · store-bought · 1 ingredient"
      ], "the preview");
      await p.click("#kMount #pasteAddBtn");
      eq((await mine()).filter(r => r[0] === "Iced coffee" || r[0] === "Hummus"), [["Hummus", true, null], ["Iced coffee", true, null]], "added, store-bought");
      ok(tab.problems.length === 0, "a clean console");
    }
  },
  {
    name: "turtleduck data: Export then Import, other apps' and empty backups refused, a damaged one cleaned, bug reports with counts only",
    async run(t) {
      const plan = [{ id: "c1", date: TODAY, meal: "dinner", recipeId: "rc-chili" }, { date: D(1), meal: "lunch", recipeId: "rc-chili", leftover: true, from: "c1" }];
      const tab = await open(t, { app: "turtleduck", size: DESKTOP }), p = tab.page;
      await importBackup(tab, gen.turtleduck({ plan, trips: [D(3)], manual: [{ id: "m1", text: "coffee", done: "", deleted: false, at: 1, u: 1 }] }));
      const backup = await exportBackup(tab);
      eq(Object.keys(backup).filter(k => k !== "meetings" && k !== "savedAt").sort(), ["appVersion", "checked", "confirmed", "manual", "plan", "recipes", "schemaVersion", "sections", "settings", "slotTimes", "templates", "tripSkips", "trips"], "all eleven, and the versions");
      eq([backup.recipes.length, backup.plan.length, backup.trips.length, backup.manual.length], [8, 2, 1, 1], "everything in it");

      // Into a fresh browser: asked with counts when there's something to replace.
      const fresh = await open(t, { app: "turtleduck", size: DESKTOP });
      await importBackup(fresh, gen.turtleduck({ recipes: ["rc-oats"] }));
      await importBackup(fresh, backup);
      has(lastDialog(fresh), "Replace your 1 recipe and 0 planned meals with the 8 recipes and 2 planned meals in this backup? This backup is from Sep 30, 2026, 7:00 AM.", "the confirm counts, and the backup's date");
      eq(await td.entries(fresh).then(l => l.map(e => e.name)), ["Chili", "Chili"], "the plan came in");

      // Other apps' backups, and one with nothing in it, change nothing.
      for (const other of [gen.hawky(), gen.history({ weeks: 1 }), gen.wanshitong()]) {
        await importBackup(tab, other);
        eq(lastDialog(tab), "That file doesn't look like a Turtleduck backup.", "another app's backup is refused");
      }
      await importBackup(tab, gen.turtleduck({ recipes: [] }));
      eq(lastDialog(tab), "That backup has no recipes or planned meals in it, so nothing was changed.", "an empty one too");
      await switchTo(tab, "badgermole");
      await importBackup(tab, backup);
      eq(lastDialog(tab), "That file doesn't look like a Badgermole backup.", "and Badgermole refuses Turtleduck's");
      await switchTo(tab, "turtleduck");

      // A damaged backup: only what can be used comes in, and nothing breaks.
      await importBackup(tab, gen.damagedTurtleduck());
      const got = await p.evaluate(() => { const A = Kyoshi.apps.turtleduck, S = A.S; return { recipes: A.liveRecipes().map(r => [r.name, r.meal, r.servings, r.kcal, r.protein, r.ingredients, r.bought, r.stock]), plan: A.liveEntries().map(e => [e.date, e.meal, e.kind, e.scale, e.servings, e.kcal]), trips: A.liveTrips().length, checked: Object.entries(S.checked).map(([k, v]) => [k, v.ranges]), manual: S.manual.map(m => m.text), sections: Object.keys(S.sections), tpl: S.templates.map(x => x.entries.map(e => [e.day, e.from])), targets: S.settings.targets }; });
      eq(got.recipes, [["Chili con carne", "any", 50, 0, null, ["2 eggs", "1 cup rice"], true, { count: 999, date: TODAY }], ["Oats", "any", 1, null, null, ["50 g oats", "7"], false, null]], "the recipes, cleaned");
      eq(got.plan, [[D(1), "dinner", "recipe", 10, 1, null], [TODAY, "lunch", "quick", 1, 1, 5000]], "the plan, cleaned");
      eq([got.trips, got.checked, got.manual, got.sections, got.tpl], [1, [["rice|cup", [[D(1), D(3)]]]], ["olive oil"], ["rice"], [[[6, -1], [1, -1]]]], "the rest, cleaned");
      eq(got.targets, { kcal: null, protein: 150, carbs: null, fat: null, fiber: null }, "the targets, cleaned");
      for (const v of ["plan", "recipes", "groceries"]) await td.view(tab, v);

      // Bug reports: counts, never names.
      await importBackup(tab, backup);
      await p.click("#kReportBug");
      await p.fill("#kBugText", "Testing the report");
      await p.click("#kBugSubmit");
      const report = await p.evaluate(() => Kyoshi.store.json("bugReports").pop().markdown);
      has(report, "state: Recipes: 8 (1 archived)", "the app's counts");
      has(report, "| Trips: 1 (1 upcoming", "and its trips");
      has(report, "| Times: trip schedule 0 day(s)", "and its times, counted");
      for (const name of ["Chili", "coffee", "ground beef", "Overnight"]) lacks(report, name, "no names in a bug report");
    }
  }
];
