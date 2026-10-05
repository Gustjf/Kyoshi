/* Kyoshi · tests/turtleduck-plan.test.js — Turtleduck's plan, as the user lays it out: recipes dragged onto the grid
 * (cooked there, their other portions on the shelf), portions dragged onto later days (never before their cook day),
 * Also on…, two meals in a cell, the ×; copy, cut and paste by the mouse (5 s to paste, then nothing); the Cook row; a
 * batch moved after its leftovers; the picker (shelf first, a meal's recipes, search, quick meal, restaurant, skip,
 * Replace…); a day's totals against the targets ("?" for a recipe without kcal) and the week's average; Copy last week,
 * templates and Clear week; a phone's list (tapping only); and a batch's portions: Also on… two on a day, never more than
 * it yields (refused, saying why), short leftovers once it's overdrawn, ×2 on chips and in Momo, the carts' marks (placed
 * by hand, skipped) and "Quality protein". TODAY is a Wednesday: this week has days before it. */
"use strict";
const { TODAY, DESKTOP, PHONE, eq, ok, has, lacks, open, importBackup, addDays, mondayOf, lastDialog } = require("./lib");
const gen = require("./generate");
const td = require("./turtleduck");

const MON = mondayOf(TODAY), D = n => addDays(TODAY, n);
const TUE = D(-1), THU = D(1), FRI = D(2), SAT = D(3), SUN = D(4), NMON = D(5);

// Turtleduck on a computer, with the made-up recipes and anything else given.
async function withRecipes(t, data = {}, size = DESKTOP) {
  const tab = await open(t, { app: "turtleduck", size });
  await importBackup(tab, gen.turtleduck(data));
  return tab;
}

module.exports = [
  {
    name: "turtleduck plan: drag recipes onto days, portions onto later ones (never before the cook day), Also on…, two in a cell, ×",
    async run(t) {
      const tab = await withRecipes(t), p = tab.page;
      eq(await td.shelf(tab), [], "nothing on the shelf yet");
      await td.dragRecipe(tab, "rc-chili", MON, "dinner");
      eq(await td.chips(tab, MON, "dinner"), ["Chili"], "Chili cooked on Monday");
      ok(await p.locator(td.chip(MON, "dinner", "Chili")).evaluate(el => el.classList.contains("cooked")), "as a cooked chip");
      eq(await td.shelf(tab), ["Chili · 3 left · Mon"], "its other three portions wait on the shelf");
      await td.openEntry(tab, MON, "dinner", "Chili");
      has(await td.entryText(tab), "3 portions left", "its pop-up says so");
      await td.closeEntry(tab);

      // A portion onto today's lunch: a leftover.
      await td.dragPortion(tab, "Chili", TODAY, "lunch");
      eq(await td.chips(tab, TODAY, "lunch"), ["Chili"], "a portion for lunch");
      ok(await p.locator(td.chip(TODAY, "lunch", "Chili")).evaluate(el => el.classList.contains("leftover")), "as a leftover");
      eq(await td.shelf(tab), ["Chili · 2 left · Mon"], "two left");

      // Also on… Thursday and Friday (dinner, as the batch): none left, and the shelf is empty.
      await td.openEntry(tab, MON, "dinner", "Chili");
      await td.entryAct(tab, "also", `[data-date="${THU}"]`);
      await td.entryAct(tab, "also", `[data-date="${FRI}"]`);
      has(await td.entryText(tab), "No portions left", "every portion placed");
      eq(await p.$$eval('#kMount #entryOverlay [data-entry="also"][aria-pressed="true"]', els => els.map(e => e.dataset.date)), [THU, FRI], "Thursday and Friday ticked");
      await td.entryAct(tab, "also-less", `[data-date="${FRI}"]`);
      has(await td.entryText(tab), "1 portion left", "its − takes one back");
      await td.entryAct(tab, "also", `[data-date="${FRI}"]`);
      await td.closeEntry(tab);
      eq([await td.chips(tab, THU, "dinner"), await td.chips(tab, FRI, "dinner")], [["Chili"], ["Chili"]], "leftovers on both days");
      eq(await td.shelf(tab), [], "the shelf has nothing left of it");

      // Curry (serves 6) on Thursday: a portion of it won't go on Tuesday, before it's cooked.
      await td.dragRecipe(tab, "rc-curry", THU, "dinner");
      eq(await td.chips(tab, THU, "dinner"), ["Chili", "Curry"], "two meals share a cell");
      await td.dragPortion(tab, "Curry", TUE, "lunch");
      eq(await td.chips(tab, TUE, "lunch"), [], "no portion before its cook day");
      await td.dragPortion(tab, "Curry", SAT, "lunch");
      eq(await td.chips(tab, SAT, "lunch"), ["Curry"], "a portion after it");
      eq(await td.shelf(tab), ["Curry · 4 left · Thu"], "four left");
      // Next week takes portions too.
      await td.week(tab, "next");
      await td.dragPortion(tab, "Curry", NMON, "lunch");
      eq(await td.chips(tab, NMON, "lunch"), ["Curry"], "next Monday's lunch");
      await td.week(tab, "this");

      // Salad onto Monday's dinner beside the Chili, then its × takes it off.
      await td.dragRecipe(tab, "rc-salad", MON, "dinner");
      eq(await td.chips(tab, MON, "dinner"), ["Chili", "Salad"], "Chili and Salad");
      await p.hover(td.chip(MON, "dinner", "Salad"));
      await p.click(`${td.chip(MON, "dinner", "Salad")} .chip-x`);
      eq(await td.chips(tab, MON, "dinner"), ["Chili"], "the × removes the Salad");
      // A planned meal dragged to another day moves.
      await td.dragChip(tab, { date: SAT, meal: "lunch" }, "Curry", SUN, "lunch");
      eq([await td.chips(tab, SAT, "lunch"), await td.chips(tab, SUN, "lunch")], [[], ["Curry"]], "moved to Sunday");
      eq((await td.entries(tab)).length, 7, "seven meals planned");
    }
  },
  {
    name: "turtleduck plan: copy, cut and paste by the mouse (5 s each time), the Cook row, a batch moved after its leftovers",
    async run(t) {
      const tab = await withRecipes(t, { plan: [{ id: "chili-mon", date: MON, meal: "dinner", recipeId: "rc-chili" }] }), p = tab.page;
      // Ctrl+C over Monday's Chili, Ctrl+V over Tuesday's and Wednesday's dinners: cooked again each time.
      await td.key(tab, td.chip(MON, "dinner", "Chili"), "Control+c");
      ok(await p.locator(td.chip(MON, "dinner", "Chili")).evaluate(el => el.classList.contains("clipped")), "shaded while it waits");
      await td.key(tab, td.cell(TUE, "dinner"), "Control+v");
      await td.key(tab, td.cell(TODAY, "dinner"), "Control+v");
      eq([await td.chips(tab, TUE, "dinner"), await td.chips(tab, TODAY, "dinner")], [["Chili"], ["Chili"]], "pasted on two days");
      eq(await td.shelf(tab), ["Chili · 3 left · Mon", "Chili · 3 left · Tue", "Chili · 3 left · Wed"], "each a batch of its own");
      ok(await p.locator(td.chip(MON, "dinner", "Chili")).evaluate(el => el.classList.contains("clipped")), "still shaded");
      // 5 s after the last paste, it's gone: nothing to paste.
      await tab.ctx.clock.fastForward(5100);
      ok(!(await p.locator(td.chip(MON, "dinner", "Chili")).evaluate(el => el.classList.contains("clipped"))), "the shading clears");
      await td.key(tab, td.cell(THU, "dinner"), "Control+v");
      eq(await td.chips(tab, THU, "dinner"), [], "nothing pastes after 5 s");
      // Ctrl+X then Ctrl+V moves it (the same meal), then copies.
      const tueId = (await td.entries(tab)).find(e => e.date === TUE).id;
      await td.key(tab, td.chip(TUE, "dinner", "Chili"), "Control+x");
      await td.key(tab, td.cell(FRI, "dinner"), "Control+v");
      const fri = (await td.entries(tab)).filter(e => e.date === FRI);
      eq([await td.chips(tab, TUE, "dinner"), fri.map(e => e.id)], [[], [tueId]], "moved, keeping it");
      await td.key(tab, td.cell(SAT, "dinner"), "Control+v");
      ok((await td.entries(tab)).filter(e => e.date === SAT && e.id !== tueId).length === 1, "then a copy");
      await p.keyboard.press("Escape");
      ok(!(await p.locator(".chip.clipped").count()), "Esc drops it");

      // The Cook row: Curry cooked on Sunday for later. All six portions go on the shelf; Sunday eats nothing.
      await td.dragRecipe(tab, "rc-curry", SUN, "cook");
      eq(await td.chips(tab, SUN, "cook"), ["Curry"], "on Sunday's Cook row");
      has((await td.shelf(tab)).join(" | "), "Curry · 6 left · Sun", "six on the shelf");
      eq((await td.totals(tab, SUN)).text, "", "nothing eaten on Sunday");
      // A portion of it is a leftover, which a Cook row won't take, by dragging or pasting.
      await td.dragPortion(tab, "Curry", SUN, "dinner");
      await td.dragPortion(tab, "Curry", SUN, "cook");
      eq(await td.chips(tab, SUN, "cook"), ["Curry"], "no leftover on the Cook row");
      await td.key(tab, td.chip(SUN, "dinner", "Curry"), "Control+c");
      await td.key(tab, td.cell(SAT, "cook"), "Control+v");
      eq(await td.chips(tab, SAT, "cook"), [], "nor pasted there");
      await p.keyboard.press("Escape");
      // A quick meal can't go on the Cook row either; a Cook row batch can go on a meal (eaten there then).
      await td.dragChip(tab, { date: SUN, meal: "cook" }, "Curry", SAT, "lunch");
      const curry = (await td.entries(tab)).find(e => e.name === "Curry" && !e.leftover);
      eq([curry.date, curry.meal, curry.servings], [SAT, "lunch", 1], "cooked Saturday lunch now, one portion eaten");

      // Monday's batch: a portion on Tuesday's lunch, then the batch dragged to Wednesday leaves it before its cook day.
      await td.dragPortion(tab, "Chili · 3 left · Mon", TUE, "lunch");
      await td.dragChip(tab, { date: MON, meal: "dinner" }, "Chili", TODAY, "lunch");
      ok(await p.locator(td.chip(TODAY, "lunch", "Chili")).evaluate(el => el.classList.contains("warn")), "the batch is marked");
      ok(await p.locator(td.chip(TUE, "lunch", "Chili")).evaluate(el => el.classList.contains("warn")), "and so is the portion");
      await td.openEntry(tab, TODAY, "lunch", "Chili");
      has(await td.entryText(tab), "1 portion placed before the cook day", "its pop-up says what's wrong");
      await td.closeEntry(tab);
    }
  },
  {
    name: "turtleduck plan: the picker (shelf first, search), quick meal, restaurant, skip, Replace…; totals against targets; the week's average",
    async run(t) {
      const settings = { targets: { kcal: 1500, protein: 150, carbs: null, fat: null, fiber: null }, u: 1 };
      const tab = await withRecipes(t, { settings, plan: [{ date: TUE, meal: "dinner", recipeId: "rc-chili" }] }), p = tab.page;
      await td.openPicker(tab, TODAY, "breakfast");
      eq(await p.locator("#kMount #pickTitle").innerText(), "Breakfast, Wed Sep 30", "the picker names the cell");
      const items = await td.pickList(tab);
      eq([items[0], items[1].startsWith("Chili"), items[2]], ["LEFTOVERS", true, "BREAKFAST RECIPES"], "the shelf first, then breakfast recipes");
      has(items.join(" | "), "OTHER RECIPES", "then the rest");
      lacks(items.join(" | "), "Old soup", "archived recipes aren't offered");
      await p.fill("#kMount #pickSearch", "oat");
      eq(await td.pickList(tab), ["RECIPES", "Overnight oats 400 kcal"], "searching");
      await td.quickMeal(tab, "quick", "Shake", { kcal: 300, protein: 30 });
      eq(await td.chips(tab, TODAY, "breakfast"), ["Shake"], "a quick meal");

      await td.openPicker(tab, TODAY, "lunch");
      await td.pickRecipe(tab, "Salad");
      await td.openEntry(tab, TODAY, "lunch", "Salad");
      await td.entryAct(tab, "replace");
      await p.waitForSelector("#kMount #pickOverlay.open");
      eq(await p.locator("#kMount #pickTitle").innerText(), "Replace Salad: Lunch, Wed Sep 30", "Replace… opens the picker");
      await td.quickMeal(tab, "restaurant", "", { kcal: 900, protein: 40 });
      eq(await td.chips(tab, TODAY, "lunch"), ["Restaurant"], "the restaurant took the salad's place");
      await td.openPicker(tab, TODAY, "snack");
      await p.click("#kMount #skipBtn");
      eq(await td.chips(tab, TODAY, "snack"), ["Skipped"], "a skipped snack");

      // Totals: a recipe without kcal makes them "?", and they turn amber past a target.
      await td.openPicker(tab, TODAY, "dinner");
      await td.pickRecipe(tab, "Mystery stew");
      let tot = await td.totals(tab, TODAY);
      eq([tot.text, tot.warn], ["1,200? kcal P 70", ["P 70"]], "a stew without numbers, protein under its target");
      await td.openPicker(tab, TODAY, "dinner");
      await td.pickPortion(tab, "Chili");
      tot = await td.totals(tab, TODAY);
      eq([tot.text, tot.warn], ["1,850? kcal P 115 · C 40 · F 30 · Fi 8", ["1,850? kcal", "P 115"]], "the Chili's portion counts; kcal over its target");
      eq(await p.locator("#kMount #weekAvg").innerText(), "Week average (2 days planned): 1,250 kcal · P 80 · C 40 · F 30 · Fi 8 · some meals not counted", "the week's average");
      has(await p.locator('#kMount #weekToggle [data-week="this"]').innerText(), "avg 1,250 kcal", "and under its tab");

      // The quick meal's numbers can be changed in its pop-up; a restaurant's name too.
      await td.openEntry(tab, TODAY, "breakfast", "Shake");
      await p.fill('#kMount #entryBody [data-own="kcal"]', "350");
      await p.locator('#kMount #entryBody [data-own="kcal"]').blur();
      await td.closeEntry(tab);
      has((await td.totals(tab, TODAY)).text, "1,900? kcal", "the shake's new kcal");

      // The Cook row's picker offers recipes only.
      await td.openPicker(tab, SUN, "cook");
      ok(await p.locator("#kMount #pickOwn").isHidden(), "no quick meal, restaurant or skip");
      eq((await td.pickList(tab))[0], "RECIPES TO COOK", "just recipes");
      await p.click("#kMount #pickOverlay .modal-close");

      // Replace… left open past the end of the week: that day is off the plan, so nothing is replaced.
      await td.openEntry(tab, TUE, "dinner", "Chili");
      await td.entryAct(tab, "replace");
      await p.waitForSelector("#kMount #pickOverlay.open");
      await p.evaluate(() => Kyoshi.dev.travel(7));
      tab.dialogs.length = 0;
      await td.pickRecipe(tab, "Salad");
      eq(tab.dialogs.map(d => d[1]), ["That day isn't on the plan any more."], "it says so");
      ok((await td.entries(tab)).some(e => e.date === TUE && e.name === "Chili"), "and the chili stays");
    }
  },
  {
    name: "turtleduck plan: Copy last week (a batch and its leftovers re-linked), Save as template, Clear week, Load template",
    async run(t) {
      const plan = [
        { id: "b1", date: MON, meal: "breakfast", recipeId: "rc-oats" }, { id: "b2", date: TUE, meal: "breakfast", recipeId: "rc-oats" },
        { id: "b3", date: TODAY, meal: "breakfast", kind: "quick", name: "Shake", kcal: 300, recipeId: "" },
        { id: "c1", date: MON, meal: "dinner", recipeId: "rc-chili", scale: 2 }, { id: "c2", date: TUE, meal: "lunch", recipeId: "rc-chili", leftover: true, from: "c1" }
      ];
      const tab = await withRecipes(t, { plan }), p = tab.page;
      const menu = async act => { await p.click("#kMount #menuBtn"); await p.click(`#kMount #planMenu [data-act="${act}"]`); };
      await td.week(tab, "next");
      await menu("copy-last");
      const next = (await td.entries(tab)).filter(e => e.date >= NMON);
      eq(next.map(e => `${e.date.slice(8)} ${e.meal} ${e.name}`).sort(), ["05 breakfast Overnight oats", "05 dinner Chili", "06 breakfast Overnight oats", "06 lunch Chili", "07 breakfast Shake"], "last week's meals, on next week's days");
      const batch = next.find(e => e.name === "Chili" && !e.leftover), left = next.find(e => e.leftover);
      eq([batch.scale, left.from], [2, batch.id], "the batch keeps its ×, the leftover follows the new batch");

      // Save next week as a template, clear it (asked first), and load the template back.
      await menu("save-template");
      await p.fill("#kMount #templateName", "Usual week");
      await p.click('#kMount #templateForm button[type="submit"]');
      await menu("clear-week");
      has(tab.dialogs.pop()[1], "Take all 5 meals off next week?", "Clear week asks first");
      eq((await td.entries(tab)).filter(e => e.date >= NMON).length, 0, "next week is empty");
      await p.click("#kMount #menuBtn");
      eq(await p.$$eval('#kMount #planMenu [data-act="load-template"]', els => els.map(e => e.innerText.replace(/\s+/g, " ").trim())), ["Usual week 5"], "the template, with its count");
      await p.click('#kMount #planMenu [data-act="load-template"]');
      const back = (await td.entries(tab)).filter(e => e.date >= NMON);
      eq(back.length, 5, "the template's five meals");
      eq(back.find(e => e.leftover).from, back.find(e => e.name === "Chili" && !e.leftover).id, "re-linked again");
      // Loading adds (nothing is replaced): this week gets them too, by weekday.
      await td.week(tab, "this");
      await menu("load-template");
      eq(await td.chips(tab, MON, "breakfast"), ["Overnight oats", "Overnight oats"], "added beside what's there");
      // Deleting the template (asked) leaves the meals.
      await p.click("#kMount #menuBtn");
      await p.click('#kMount #planMenu [data-act="delete-template"]');
      has(tab.dialogs.pop()[1], "Delete the template “Usual week”?", "asked first");
      has(await p.locator("#kMount #planMenu").innerText(), "None yet", "no templates");
      eq((await td.entries(tab)).length, 15, "the meals stay");
    }
  },
  {
    name: "turtleduck plan: a phone — Groceries first, the plan a list from today, tap a slot to pick, a chip for its pop-up, no dragging",
    async run(t) {
      const tab = await withRecipes(t, { plan: [{ date: TUE, meal: "dinner", recipeId: "rc-chili" }] }, PHONE), p = tab.page;
      ok(await p.locator("#kMount #groceriesView").isVisible(), "a phone opens on Groceries");
      await td.view(tab, "plan");
      ok(await p.locator("#kMount #planGrid .cell").count() === 0 && await p.locator("#kMount #planBar").isHidden(), "no grid or tabs");
      const days = await p.$$eval("#kMount #planList .day-name", els => els.map(e => e.innerText));
      eq([days[0], days[1], days.length], ["Today · Wed Sep 30", "Tomorrow · Thu Oct 1", 12], "today to next Sunday");
      await p.click(`#kMount .slot[data-date="${TODAY}"][data-meal="dinner"]`);
      await p.waitForSelector("#kMount #pickOverlay.open");
      ok(await p.evaluate(() => document.activeElement.id !== "pickSearch"), "the keyboard stays down on a phone");
      await td.pickPortion(tab, "Chili");
      eq(await td.chipWords(tab, `#kMount .slot[data-date="${TODAY}"][data-meal="dinner"] .chip`), "Chili 650 · P 45", "the portion, with its numbers");
      eq(await p.locator(`#kMount .slot[data-date="${TODAY}"][data-meal="dinner"] .chip`).getAttribute("draggable"), "false", "no dragging on a phone");
      await p.click(`#kMount .slot[data-date="${TODAY}"][data-meal="dinner"] .chip`);
      await p.waitForSelector("#kMount #entryOverlay.open");
      has(await td.entryText(tab), "Leftover of Tue's Chili", "its pop-up");
      await td.closeEntry(tab);
      // Thumb-sized: the slots' + and the cart.
      const box = await p.locator(`#kMount .slot[data-date="${TODAY}"][data-meal="lunch"] .slot-add`).boundingBox();
      ok(box.width >= 40 && box.height >= 40, `a big + (${box.width}×${box.height})`);
      const wide = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      ok(wide <= 1, `no sideways scrolling (${wide}px over)`);
    }
  },
  {
    name: "turtleduck plan: Also on… two portions a day, never more than a batch yields (refused, saying why); short leftovers; ×2 on chips and in Momo; trips by hand and skipped; Quality protein",
    async run(t) {
      // Chili serves 3 here, cooked Monday (one eaten there); Curry cooked Thursday. Trips: Friday's every week, and one
      // placed by hand on Thursday.
      const settings = { targets: { kcal: null, protein: null, carbs: null, fat: null, fiber: null }, units: "entered", schedule: [{ day: 4, time: "10:00" }], u: 1 };
      const data = gen.turtleduck({ plan: [{ id: "chili-mon", date: MON, meal: "dinner", recipeId: "rc-chili" }, { id: "curry-thu", date: THU, meal: "dinner", recipeId: "rc-curry" }], trips: [THU], settings });
      data.recipes.find(r => r.id === "rc-chili").servings = 3;
      const tab = await open(t, { app: "turtleduck", size: DESKTOP }), p = tab.page;
      await importBackup(tab, data);
      const NONE_LEFT = "No portions of Mon's Chili left: it yields 3 and 3 are placed. Raise its × on its cook day, or take a portion off another day.";

      // Also on… Tuesday twice: two portions there, in one leftover.
      await td.openEntry(tab, MON, "dinner", "Chili");
      await td.entryAct(tab, "also", `[data-date="${TUE}"]`);
      await td.entryAct(tab, "also", `[data-date="${TUE}"]`);
      eq(await td.alsoDays(tab), ["Tue 29 ×2"], "Tuesday holds two portions");
      has(await td.entryText(tab), "No portions left", "all three placed");
      eq((await td.entries(tab)).filter(e => e.leftover).map(e => [e.date, e.servings]), [[TUE, 2]], "one leftover of two portions");
      // A fourth is refused, saying why: on Wednesday, or one more eaten on Monday.
      lastDialog(tab);
      await td.entryAct(tab, "also", `[data-date="${TODAY}"]`);
      eq(lastDialog(tab), NONE_LEFT, "Wednesday refused, saying why");
      eq(await td.alsoDays(tab), ["Tue 29 ×2"], "nothing placed on Wednesday");
      await td.entryAct(tab, "servings", '[data-dir="1"]');
      eq(lastDialog(tab), NONE_LEFT, "nor one more portion eaten on Monday");
      // − takes one off Tuesday; tapping the day puts it back.
      await td.entryAct(tab, "also-less", `[data-date="${TUE}"]`);
      eq(await td.alsoDays(tab), ["Tue 29"], "− takes one off");
      has(await td.entryText(tab), "1 portion left", "one left again");
      await td.entryAct(tab, "also", `[data-date="${TUE}"]`);
      await td.closeEntry(tab);
      eq(await td.chipWords(tab, td.chip(TUE, "dinner", "Chili")), "Chili ×2 · 1,300 · P 90", "the grid's chip says ×2");
      eq(await td.chipWords(tab, td.chip(MON, "dinner", "Chili")), "Chili 650 · P 45", "one portion says nothing");
      // A copy of Tuesday's leftover pasted on Saturday: refused too.
      await td.key(tab, td.chip(TUE, "dinner", "Chili"), "Control+c");
      await td.key(tab, td.cell(SAT, "lunch"), "Control+v");
      eq([lastDialog(tab), await td.chips(tab, SAT, "lunch")], [NONE_LEFT, []], "the paste refused, saying why");
      await p.keyboard.press("Escape");

      // The recipe now serves 1 (its pop-up's protein reads "Quality protein"): Tuesday's leftover is short, still counted.
      await td.openEntry(tab, MON, "dinner", "Chili");
      await td.entryAct(tab, "edit");
      await p.waitForSelector("#kMount #recipeOverlay.open");
      eq(await p.locator('#kMount #recipeOverlay label.own-num:has(#recipeProtein) span').innerText(), "Quality protein (g)", "Quality protein");
      await p.fill("#kMount #recipeServings", "1");
      await p.click('#kMount #recipeForm button[type="submit"]');
      const tue = p.locator(td.chip(TUE, "dinner", "Chili"));
      eq([await tue.evaluate(el => el.classList.contains("short")), await tue.locator(".chip-shop").innerText()], [true, "no portion left"], "Tuesday's leftover is short");
      ok(!(await p.locator(td.chip(MON, "dinner", "Chili")).evaluate(el => el.classList.contains("short"))), "the batch itself isn't");
      has((await td.totals(tab, TUE)).text, "1,300 kcal", "still counted in Tuesday's totals");
      await td.openEntry(tab, TUE, "dinner", "Chili");
      has(await td.entryText(tab), "The batch ran out before this day: 3 portions placed of 1.", "its pop-up says so");
      await td.closeEntry(tab);
      await td.openEntry(tab, MON, "dinner", "Chili");
      has(await td.entryText(tab), "Placed 3 portions of 1: -2 left", "the batch's says what's over");
      await td.closeEntry(tab);

      // Curry eaten as two portions on Thursday: ×2 on its chip, and in Momo's card once the week is confirmed.
      await td.openEntry(tab, THU, "dinner", "Curry");
      await td.entryAct(tab, "servings", '[data-dir="1"]');
      await td.closeEntry(tab);
      eq(await td.chipWords(tab, td.chip(THU, "dinner", "Curry")), "Curry ×2 · 1,400 · P 80", "×2 on a meal cooked there");
      await td.confirmWeek(tab, "this");
      const details = await p.evaluate(ids => Kyoshi.inbox(ids[0], ids[1]).filter(n => n.app === "turtleduck" && n.id.startsWith("meal:")).map(n => [n.id, n.details.slice(1)]), [TUE, THU]);
      eq(details, [[`meal:${TUE}:dinner`, ["Leftovers of Mon's Chili · 2 portions"]], [`meal:${THU}:dinner`, ["Cooked here · serves 6 · 2 eaten here"]]], "Momo's details");

      // Trips: Thursday's placed by hand has a dot; Friday's every week, skipped, a slash until it's back.
      eq([(await td.cartMarks(tab))[THU], (await td.cartMarks(tab))[FRI]], ["by-hand", ""], "a dot on the trip placed by hand, the schedule's as it was");
      await td.cart(tab, FRI);
      eq((await td.cartMarks(tab))[FRI], "skipped", "Friday's skipped: a slash");
      has(await p.locator(`#kMount #planGrid .cart[data-date="${FRI}"]`).getAttribute("aria-label"), "skipped: tap to bring it back", "and says so");
      await td.cart(tab, FRI);
      eq([(await td.carts(tab))[FRI], (await td.cartMarks(tab))[FRI]], ["10:00 AM", ""], "back on, no mark");
    }
  }
];
