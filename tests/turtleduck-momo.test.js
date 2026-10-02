/* Kyoshi · tests/turtleduck-momo.test.js — Turtleduck and Momo together, as the user sees them: the day's breakfast,
 * lunch and dinner fill its Breakfast, Lunch and Dinner cards ("Chili + Salad"; a leftover's and a restaurant's too), a
 * snack and a skipped meal send nothing, the Cook row fills a Cooking card, a dinner on a day with no card waits in Tasks
 * ("Dinner · Fried rice"), each trip fills its day's Groceries card (✓ once its list is bought), what's needed before the
 * first trip is a Groceries need due the day before (overdue the day after), the card pop-ups' details, and "Open in
 * Turtleduck" — the cook view (paging a day's recipes), the plan's cell for a meal with no recipe, a trip's list — on a
 * computer and from Today on the phone. */
"use strict";
const { TODAY, DESKTOP, PHONE, eq, ok, has, lacks, open, switchTo, importBackup, addDays, travel } = require("./lib");
const gen = require("./generate");
const td = require("./turtleduck");

const D = n => addDays(TODAY, n);
const PLAN = [
  { date: TODAY, meal: "breakfast", recipeId: "rc-oats" }, { date: TODAY, meal: "lunch", kind: "quick", name: "Shake", kcal: 300, protein: 30, recipeId: "" },
  { date: TODAY, meal: "snack", recipeId: "rc-oats" },
  { id: "chili", date: D(1), meal: "dinner", recipeId: "rc-chili" }, { date: D(1), meal: "dinner", recipeId: "rc-salad" },
  { date: D(2), meal: "dinner", recipeId: "rc-friedrice" },
  { date: D(3), meal: "lunch", recipeId: "rc-chili", leftover: true, from: "chili" }, { date: D(3), meal: "dinner", kind: "restaurant", name: "", recipeId: "" },
  { date: D(4), meal: "cook", recipeId: "rc-curry", scale: 1.5 }, { date: D(4), meal: "cook", recipeId: "rc-chili" },
  { date: D(5), meal: "breakfast", kind: "skipped", recipeId: "" }
];
// Momo's cards (card-0 …): Wednesday's Breakfast and Lunch, Thursday's Dinner, Saturday's Lunch, Dinner and Groceries,
// Sunday's Cooking, next Monday's Breakfast. Friday has no Dinner card.
const CARDS = [[0, "Breakfast", 0.5], [0, "Lunch", 1], [1, "Dinner", 1], [3, "Lunch", 1], [3, "Dinner", 1.5], [3, "Groceries", 1], [4, "Cooking", 3], [5, "Breakfast", 0.5]]
  .map(([n, title, hours]) => ({ date: D(n), title, hours }));
const cards = tab => tab.page.$$eval("#kMount .card[data-id^='card-']", els => Object.fromEntries(els.map(e => [e.dataset.id, e.getAttribute("aria-label").replace(/, [\d.]+[hm]\b.*$/, "")])));
const tasks = tab => tab.page.$$eval("#taskCards .task", els => els.map(e => e.getAttribute("aria-label").replace(/ — drag.*$/, "")).filter(x => !x.startsWith("Meeting")));

async function both(t, size = DESKTOP, plan = PLAN, trips = [D(3)]) {
  const tab = await open(t, { app: "turtleduck", size });
  await importBackup(tab, gen.turtleduck({ plan, trips }));
  await switchTo(tab, "momo");
  await importBackup(tab, gen.momo([], CARDS));
  return tab;
}

module.exports = [
  {
    name: "turtleduck momo: meals fill Breakfast, Lunch, Dinner and Cooking cards, Groceries on the trip's day, the rest in Tasks",
    async run(t) {
      const tab = await both(t), p = tab.page;
      eq(await cards(tab), {
        "card-0": "Breakfast (Overnight oats from Turtleduck)", "card-1": "Lunch (Shake from Turtleduck)", "card-2": "Dinner (Chili + Salad from Turtleduck)",
        "card-3": "Lunch (Chili from Turtleduck)", "card-4": "Dinner (Restaurant from Turtleduck)", "card-5": "Groceries (from Turtleduck)", "card-6": "Cooking (Curry + Chili from Turtleduck)"
      }, "this week's cards, filled (the snack sends nothing)");
      eq(await tasks(tab), ["Dinner · Fried rice (from Turtleduck)", "Groceries (from Turtleduck, overdue)"], "Friday's dinner has no card; today's breakfast needed groceries yesterday");
      await p.click('#kMount [data-view="next"]');
      eq((await cards(tab))["card-7"], "Breakfast", "a skipped breakfast leaves its card empty, and asks for nothing");
      await p.click('#kMount [data-view="this"]');

      // The pop-up's details: what's in it, numbers and how it's made.
      await p.click('#kMount .card[data-id="card-2"]');
      const from = (await p.locator("#cardOverlay .from-needs").innerText()).replace(/\s*\n\s*/g, " | ");
      eq(from, "Chili + Salad · Open in Turtleduck | 900 kcal · 53 g protein · 60 g carbs · 45 g fat · 14 g fiber | Chili: Cooked here · serves 4 | Salad: Cooked here · serves 1", "Thursday's dinner");
      // Open in Turtleduck: the cook view on its recipes, a page each.
      await p.click('#cardOverlay a[data-app="turtleduck"]');
      await p.waitForFunction(() => Kyoshi.active().id === "turtleduck");
      let c = await td.cook(tab);
      eq([c.name, c.pager], ["Chili", "‹ 1 of 2 · Next: Salad ›"], "the cook view, on the first of two");
      await p.click('#kMount [data-act="cook-next"]');
      eq((await td.cook(tab)).name, "Salad", "the next page");
      await p.click('#kMount [data-act="cook-back"]');

      // The Cooking card's details, and its Open in Turtleduck.
      await switchTo(tab, "momo");
      await p.click('#kMount .card[data-id="card-6"]');
      has((await p.locator("#cardOverlay .from-needs").innerText()).replace(/\s*\n\s*/g, " | "), "2 recipes · 13 portions | Curry ×1½ · Chili ×1", "what Sunday's cooking makes");
      await p.click('#cardOverlay a[data-app="turtleduck"]');
      c = await td.cook(tab);
      eq([c.name, c.meta, c.pager], ["Curry", "×1½ · 9 portions · prep 20 min · cook 40 min", "‹ 1 of 2 · Next: Chili ›"], "the batch, scaled");
      await p.keyboard.press("Escape");

      // A restaurant has nothing to read: its cell of the plan, flashing.
      await switchTo(tab, "momo");
      await p.click('#kMount .card[data-id="card-4"]');
      await p.click('#cardOverlay a[data-app="turtleduck"]');
      await p.waitForFunction(() => Kyoshi.active().id === "turtleduck");
      ok(await p.locator(td.cell(D(3), "dinner")).evaluate(el => el.classList.contains("flash")), "Saturday's dinner flashes on the plan");

      // Saturday's Groceries: its list, flashing; once all of it is bought, ✓ in Momo.
      await switchTo(tab, "momo");
      await p.click('#kMount .card[data-id="card-5"]');
      has(await p.locator("#cardOverlay .from-needs").innerText(), "for meals Oct 3 – 11", "the trip's range");
      await p.click('#cardOverlay a[data-app="turtleduck"]');
      await p.waitForSelector("#kMount #groceriesView:not([hidden])");
      ok(await p.locator(`#kMount .g-list[data-list="${D(3)}"]`).evaluate(el => el.classList.contains("flash")), "its list flashes");
      const n = await p.locator(`#kMount .g-list[data-list="${D(3)}"] > .g-row`).count();
      for (let i = 0; i < n; i++) await p.click(`#kMount .g-list[data-list="${D(3)}"] > .g-row .g-box`);
      await switchTo(tab, "momo");
      eq((await cards(tab))["card-5"], "Groceries (from Turtleduck — done ✓)", "bought: ✓");
      ok(tab.problems.length === 0, "a clean console");
    }
  },
  {
    name: "turtleduck momo: what's needed before the first trip is due the day before its meal, overdue after; a change shows within a minute",
    async run(t) {
      const plan = [{ date: D(2), meal: "dinner", recipeId: "rc-chili" }];
      const tab = await both(t, DESKTOP, plan), p = tab.page;
      const now = () => p.evaluate(d => Kyoshi.apps.turtleduck.inbox(Kyoshi.util.todayStr(), d).filter(n => n.id === "groceries:now").map(n => [n.due, n.overdue, n.details[0]]), D(11));
      eq(await now(), [[D(1), false, "5 items needed before Sat's trip"]], "Friday's chili: due Thursday");
      const trip = await p.evaluate(d => Kyoshi.apps.turtleduck.inbox(Kyoshi.util.todayStr(), d).find(n => n.id === `groceries:${d}`), D(3));
      eq([trip.done, trip.details[0]], [false, "Nothing to buy yet"], "a trip with nothing on its list isn't done: there's still the trip");
      eq(await tasks(tab), ["Dinner · Chili (from Turtleduck)", `Groceries (from Turtleduck, due Oct 1)`], "Momo has it in Tasks, by Thursday");
      await travel(tab, 2);
      eq(await now(), [[D(2), true, "5 items needed before Sat's trip"]], "on Friday: overdue, due today");
      // A meal placed in Turtleduck reaches Momo within a minute (its minute tick).
      await switchTo(tab, "turtleduck");
      await td.view(tab, "plan");
      await td.dragRecipe(tab, "rc-salad", D(3), "lunch");
      await switchTo(tab, "momo");
      await tab.ctx.clock.fastForward(61000);
      eq((await cards(tab))["card-3"], "Lunch (Salad from Turtleduck)", "Saturday's lunch is filled");
    }
  },
  {
    name: "turtleduck momo: on the phone, Today's meal cards open Turtleduck's cook view",
    async run(t) {
      const tab = await both(t, PHONE), p = tab.page;
      await p.waitForSelector("#kMount #todayView:not([hidden])");
      const row = p.locator('#kMount #todayBody [data-card="card-2"]');
      has(await row.getAttribute("aria-label"), "Dinner (Chili + Salad from Turtleduck)", "tomorrow's dinner on Today");
      await row.click();
      await p.waitForSelector("#kMount #detailOverlay.open");
      has(await p.locator("#kMount #detailFrom").innerText(), "900 kcal", "its details");
      await p.click('#kMount #detailFrom a[data-app="turtleduck"]');
      await p.waitForFunction(() => Kyoshi.active().id === "turtleduck");
      const c = await td.cook(tab);
      eq([c.name, c.pager], ["Chili", "‹ 1 of 2 · Next: Salad ›"], "the cook view, from the phone");
      lacks(await p.locator("#kMount #cookBox").innerText(), "Backup", "nothing but the recipe");
    }
  }
];
