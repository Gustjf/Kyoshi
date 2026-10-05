/* Kyoshi · tests/turtleduck-groceries.test.js — Turtleduck's shopping, as the user does it: trips placed on the days with
 * the cart, a list per trip from its day to the next trip's (merged by name and unit: g with kg, "2 cups" with "1 cup";
 * scaled by a batch's ×; a leftover adds nothing; "salt" a row with no amount), in store sections (set once by name),
 * groceries added by hand, ticks that sink into Bought and come back when a later meal needs the thing again, a trip
 * removed (the lists re-cut, the ticks kept), the Now list before the first trip, no trip at all, a past trip after
 * time travel, a phone's thumbs, and two tabs; a store-bought item (its count on hand used up by the plan, then on the
 * list by count; never on the Cook row; a quick card in Momo) and a recipe with no lines (on the list by its name). */
"use strict";
const { TODAY, DESKTOP, PHONE, eq, ok, has, lacks, open, importBackup, addDays, travel } = require("./lib");
const gen = require("./generate");
const td = require("./turtleduck");

const D = n => addDays(TODAY, n);
const SAT = D(3), NMON = D(5), NWED = D(7);
// Chili ×2 on Saturday, its leftover on Sunday, Fried rice next Monday; Rice bowl and Salad next Thursday and Friday.
const PLAN = [
  { id: "chili", date: SAT, meal: "dinner", recipeId: "rc-chili", scale: 2 }, { date: D(4), meal: "lunch", recipeId: "rc-chili", leftover: true, from: "chili" },
  { date: NMON, meal: "dinner", recipeId: "rc-friedrice" }, { date: D(8), meal: "lunch", recipeId: "rc-bowl" }, { date: D(9), meal: "lunch", recipeId: "rc-salad" }
];

// Made up: a store-bought item, 2 on hand as of today, and a recipe typed with no ingredient lines.
const SHAKE = { id: "rc-shake", name: "Protein shake", meal: "snack", servings: 1, kcal: 160, protein: 30, ingredients: [], steps: "", bought: true, stock: { count: 2, date: TODAY } };
const YOGURT = { id: "rc-yogurt", name: "Greek yogurt", meal: "breakfast", servings: 1, kcal: 150, protein: 15, ingredients: [], steps: "" };

async function withPlan(t, data = {}, size = DESKTOP) {
  const tab = await open(t, { app: "turtleduck", size });
  await importBackup(tab, gen.turtleduck({ plan: PLAN, ...data }));
  return tab;
}

module.exports = [
  {
    name: "turtleduck groceries: trips by the cart, a list each merged in base units, sections, added by hand, ticks that come back",
    async run(t) {
      const tab = await withPlan(t), p = tab.page;
      await td.view(tab, "groceries");
      has(await p.locator("#kMount #lists").innerText(), "No trip yet: tap the cart on a day in the plan.", "no trip yet");
      eq((await td.lists(tab)).map(l => [l.title, l.meta]), [["Everything planned", "for meals Sep 30 – Oct 11"]], "everything planned, through next Sunday");

      // Trips on Saturday and next Wednesday, by their carts (next week's on its tab).
      await td.view(tab, "plan");
      await td.cart(tab, SAT);
      ok(await p.locator(`#kMount .cart[data-date="${SAT}"]`).evaluate(el => el.classList.contains("on")), "Saturday's cart is filled");
      await td.week(tab, "next");
      await td.cart(tab, NWED);
      await td.view(tab, "groceries");
      let [sat, wed] = await td.lists(tab);
      eq([sat.title, sat.meta, wed.title, wed.meta], ["Sat Oct 3", "for meals Oct 3 – 6", "Wed Oct 7", "for meals Oct 7 – 11"], "a list per trip, up to the next one");
      eq(sat.rows, ["2 onion · Chili · Produce", "1 kg ground beef · Chili · Meat & fish", "2 eggs · Fried rice · Dairy & eggs", "1 cup frozen peas · Fried rice · Frozen",
        "4 cans kidney beans · Chili · Pantry", "1.4 kg rice · Chili, Fried rice · Pantry", "salt · Chili · Pantry", "2 tbsp soy sauce · Fried rice · Pantry"],
        "Saturday's: the batch ×2, 400 g + 1 kg of rice, salt with no amount, the leftover adding nothing");
      eq(sat.sections, ["Produce", "Meat & fish", "Dairy & eggs", "Frozen", "Pantry"], "in store sections");
      eq(wed.rows, ["1 avocado · Rice bowl · Produce", "1 head lettuce · Salad · Produce", "2 tomatoes · Salad · Produce", "3 cups rice · Rice bowl, Salad · Pantry"], "2 cups and 1 cup of rice make 3 cups");
      eq([sat.count, wed.count], ["0 of 8", "0 of 4"], "nothing bought yet");

      // A section set by hand is remembered by name, on every list.
      await td.setSection(tab, SAT, "1.4 kg rice", "Other");
      [sat, wed] = await td.lists(tab);
      ok(sat.rows[sat.rows.length - 1] === "1.4 kg rice · Chili, Fried rice · Other" && wed.rows[wed.rows.length - 1] === "3 cups rice · Rice bowl, Salad · Other", "rice is in Other on both lists");

      // Added by hand: at the top of the first trip's list (Now has nothing), tagged; the field keeps its focus.
      await p.fill("#kMount #manualText", "olive oil");
      await p.keyboard.press("Enter");
      ok(await p.evaluate(() => document.activeElement.id === "manualText" && !document.activeElement.value), "cleared, and still focused for the next one");
      [sat] = await td.lists(tab);
      eq([sat.sections[0], sat.rows[0], sat.count], ["Added by hand", "olive oil · added by hand · by hand", "0 of 9"], "olive oil, by hand");

      // Ticks sink into Bought: "2 of 9".
      await td.tickRow(tab, SAT, "1.4 kg rice");
      await td.tickRow(tab, SAT, "4 cans kidney beans");
      [sat] = await td.lists(tab);
      eq([sat.count, sat.bought], ["2 of 9", ["4 cans kidney beans · Chili · Pantry", "1.4 kg rice · Chili, Fried rice · Other"]], "bought");
      lacks(sat.rows.join(" | "), "kg rice", "rice is out of the list to buy");

      // A meal after Wednesday that needs rice brings it back on Wednesday's list, unticked; Saturday's stays bought.
      await td.view(tab, "plan");
      await td.dragRecipe(tab, "rc-friedrice", D(10), "dinner");
      await td.view(tab, "groceries");
      [sat, wed] = await td.lists(tab);
      has(wed.rows.join(" | "), "1 kg rice · Fried rice · Other", "rice back on Wednesday's list");
      eq(sat.count, "2 of 9", "Saturday's ticks stay");
      // Each list's tick is its own: unticking Saturday's rice leaves Wednesday's bought, and ticking Wednesday's
      // never marks Saturday's.
      await td.tickRow(tab, NWED, "1 kg rice");
      await td.openBought(tab, SAT);
      await td.tickRow(tab, SAT, "1.4 kg rice");
      [sat, wed] = await td.lists(tab);
      eq([sat.count, wed.bought], ["1 of 9", ["1 kg rice · Fried rice · Other"]], "Saturday's rice unticked, Wednesday's still bought");
      await td.tickRow(tab, SAT, "1.4 kg rice");

      // Next Wednesday's trip taken off: Saturday's list runs to next Sunday; what was bought for each part stays ticked,
      // and a meal on a day nobody shopped for comes back.
      await td.view(tab, "plan");
      await td.cart(tab, NWED);
      await td.view(tab, "groceries");
      const lists = await td.lists(tab);
      eq([lists.length, lists[0].meta], [1, "for meals Oct 3 – 11"], "one list now");
      has(lists[0].bought.join(" | "), "4 cans kidney beans", "the beans stay bought");
      has(lists[0].bought.join(" | "), "2.4 kg rice · Chili, Fried rice · Other", "rice was bought for both parts");
      has(lists[0].rows.join(" | "), "3 cups rice · Rice bowl, Salad · Other", "the cups of rice weren't");
      // Unticking (in Bought): back on the list.
      await td.openBought(tab, SAT);
      await td.tickRow(tab, SAT, "4 cans kidney beans");
      lacks((await td.lists(tab))[0].bought.join(" | "), "kidney beans", "unticked");
      ok(tab.problems.length === 0, "a clean console");
    }
  },
  {
    name: "turtleduck groceries: the Now list before the first trip, a past trip after time travel, a phone's thumbs",
    async run(t) {
      const plan = [{ date: TODAY, meal: "breakfast", recipeId: "rc-oats" }, { date: D(1), meal: "dinner", recipeId: "rc-salad" }, { date: D(2), meal: "dinner", recipeId: "rc-curry" }];
      const tab = await withPlan(t, { plan, trips: [D(1), SAT] }, PHONE), p = tab.page;
      ok(await p.locator("#kMount #groceriesView").isVisible(), "the phone's home");
      let lists = await td.lists(tab);
      eq(lists.map(l => [l.title, l.meta, l.count]), [["Needed before Thu's trip", "for meals Sep 30", "0 of 3"], ["Thu Oct 1", "for meals Oct 1 – 2", "0 of 7"], ["Sat Oct 3", "for meals Oct 3 – 11", ""]],
        "Now (today's oats), then each trip's");
      has(await p.locator("#kMount .g-list[data-list='" + SAT + "']").innerText(), "Nothing to buy for these meals.", "a trip with nothing to buy says so");
      // Thumb-sized rows and ticks.
      const row = await p.locator("#kMount .g-row").first().boundingBox(), boxSize = await p.locator("#kMount .g-box").first().boundingBox();
      ok(row.height >= 48 && boxSize.width >= 26, `rows ${row.height}px tall, ticks ${boxSize.width}px`);
      await td.tickRow(tab, "now", "50 g oats");
      eq((await td.lists(tab))[0].count, "1 of 3", "ticked on the phone");

      // Two days on: Thursday's trip is past, so what it left unbought (Friday's curry) is needed now.
      await travel(tab, 2);
      lists = await td.lists(tab);
      eq(lists.map(l => [l.title, l.meta]), [["Needed before Sat's trip", "for meals Oct 2"], ["Sat Oct 3", "for meals Oct 3 – 11"]], "the past trip is gone");
      eq(lists[0].rows.length, 4, "the curry's four ingredients");
      const wide = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      ok(wide <= 1, `no sideways scrolling (${wide}px over)`);
    }
  },
  {
    name: "turtleduck groceries: two tabs — a tick, a trip and an added grocery in one show in the other",
    async run(t) {
      const a = await withPlan(t, { trips: [SAT] }), b = await open(t, { ctx: a.ctx, app: "turtleduck", size: DESKTOP });
      await td.view(a, "groceries");
      await td.view(b, "groceries");
      await td.tickRow(a, SAT, "1.4 kg rice");
      await a.page.fill("#kMount #manualText", "coffee");
      await a.page.keyboard.press("Enter");
      // Both changes, each saved (and passed on) on its own: the tick, then the grocery added by hand.
      await b.page.waitForFunction(() => document.querySelectorAll("#kMount .g-bought .g-row").length === 1 &&
        [...document.querySelectorAll("#kMount .g-row .g-what")].some(w => w.textContent.trim() === "coffee"), null, { timeout: 5000 });
      const [sat] = await td.lists(b);
      eq([sat.count, sat.rows[0], sat.bought], ["1 of 13", "coffee · added by hand · by hand", ["1.4 kg rice · Chili, Fried rice · Pantry"]], "the other tab has both");
      // A trip placed in the other tab re-cuts this one's lists.
      await td.view(b, "plan");
      await td.week(b, "next");
      await td.cart(b, NWED);
      await a.page.waitForFunction(() => document.querySelectorAll("#kMount .g-list").length === 2, null, { timeout: 5000 });
      eq((await td.lists(a)).map(l => l.title), ["Sat Oct 3", "Wed Oct 7"], "two trips in the first tab");
    }
  },
  {
    name: "turtleduck groceries: a store-bought item — its count on hand used up by the plan, then on the list by count; never on the Cook row; a quick card in Momo; a recipe with no lines shops by its name",
    async run(t) {
      // The shake at lunch Thursday to Saturday (2 on hand: the third isn't covered), the yogurt Sunday morning.
      const plan = [D(1), D(2), D(3)].map(date => ({ date, meal: "lunch", recipeId: "rc-shake" })).concat([{ date: D(4), meal: "breakfast", recipeId: "rc-yogurt" }]);
      const tab = await withPlan(t, { recipes: gen.RECIPES.map(r => r.id).concat([SHAKE, YOGURT]), plan }), p = tab.page;
      await td.view(tab, "plan");
      ok(await p.locator(td.chip(D(1), "lunch", "Protein shake")).evaluate(el => el.classList.contains("bought") && !!el.querySelector(".glyph")), "a bag, not the pot");
      eq([await td.coverage(tab, D(1), "lunch", "Protein shake"), await td.coverage(tab, D(2), "lunch", "Protein shake")], [{ mark: "", meta: "160 · P 30" }, { mark: "", meta: "160 · P 30" }],
        "the two on hand cover Thursday and Friday: no trip needed");
      eq(await td.coverage(tab, D(3), "lunch", "Protein shake"), { mark: "none", meta: "160 · P 30 · no trip before this" }, "Saturday's needs buying, with no trip before it");
      await td.openEntry(tab, D(2), "lunch", "Protein shake");
      has(await td.entryText(tab), "Store-bought · 0 on hand after this", "its pop-up counts down");
      ok((await p.locator('#kMount #entryOverlay [data-entry="also"]').count()) === 0 && (await td.entryText(tab)).includes("Portions"), "portions, and no Also on…");
      await td.closeEntry(tab);
      await td.openEntry(tab, D(3), "lunch", "Protein shake");
      has(await td.entryText(tab), "No trip before this: tap the cart on a day before it. Store-bought · on hand runs out before this", "Saturday's says it runs out");
      await td.closeEntry(tab);
      await td.view(tab, "recipes");
      eq((await td.recipeRows(tab)).filter(r => /shake|yogurt/i.test(r)), ["Greek yogurt · 150 kcal · P 15", "Protein shake · store-bought · runs out Sat Oct 3 · 160 kcal · P 30"], "the list says when it runs out");

      // A trip on Friday: Saturday's shake is on its list, by count, and so is the yogurt, by its name.
      await td.view(tab, "plan");
      await td.cart(tab, D(2));
      eq((await td.coverage(tab, D(3), "lunch", "Protein shake")).mark, "", "a trip before it now");
      await td.view(tab, "groceries");
      let lists = await td.lists(tab);
      eq(lists.map(l => [l.title, l.meta, l.rows]), [["Fri Oct 2", "for meals Oct 2 – 11", ["Greek yogurt · Greek yogurt · Dairy & eggs", "1 Protein shake · store-bought · Other"]]],
        "one shake to buy (two on hand), and the yogurt by name; Thursday's shake needs nothing before the trip");
      // Ticked, it's bought for the list's days, as any row: a fourth shake on Sunday is counted in (2), still bought.
      await td.tickRow(tab, D(2), "1 Protein shake");
      eq((await td.lists(tab))[0].bought, ["1 Protein shake · store-bought · Other"], "bought");
      await td.view(tab, "plan");
      await td.openPicker(tab, D(4), "lunch");
      has((await td.pickList(tab)).join(" | "), "Protein shake 160 kcal", "in the picker for a meal");
      await td.pickRecipe(tab, "Protein shake");
      await td.view(tab, "groceries");
      lists = await td.lists(tab);
      eq([lists[0].rows, lists[0].bought], [["Greek yogurt · Greek yogurt · Dairy & eggs"], ["2 Protein shake · store-bought · Other"]], "two to buy now");

      // Never on the Cook row: the drag finds no cell lit, the picker leaves it out.
      await td.view(tab, "plan");
      await td.dragRecipe(tab, "rc-shake", D(1), "cook");
      eq(await td.chips(tab, D(1), "cook"), [], "not dropped on the Cook row");
      await td.openPicker(tab, D(1), "cook");
      lacks((await td.pickList(tab)).join(" | "), "Protein shake", "not in the Cook row's picker");
      has((await td.pickList(tab)).join(" | "), "Greek yogurt", "a recipe with no lines still cooks");
      await p.keyboard.press("Escape");

      // Confirmed for Momo: a day's lunch of the shake is a quick card, not a cooking session.
      await td.confirmWeek(tab, "this");
      const need = await p.evaluate(([from, to]) => Kyoshi.inbox(from, to).filter(n => n.app === "turtleduck" && n.id === `meal:${from}:lunch`).map(n => [n.minutes, n.details.slice(1)]), [D(1), D(1)]);
      eq(need, [[await p.evaluate(() => Kyoshi.apps.turtleduck.QUICK_MINUTES), ["Store-bought"]]], "Momo's card: as long as a quick meal, store-bought");
      ok(tab.problems.length === 0, "a clean console");
    }
  }
];
