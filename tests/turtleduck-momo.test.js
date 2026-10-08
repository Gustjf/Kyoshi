/* Kyoshi · tests/turtleduck-momo.test.js — Turtleduck and Momo together (v4 Phase 7), as the user sees them: Momo's
 * baseline holds Turtleduck's slots (breakfast, lunch and dinner each day, Groceries on the schedule's weekday), pinned
 * at Turtleduck's times and following a change within a minute; nothing of a week goes to Momo until it's confirmed
 * (empty slots, nothing in Tasks); confirmed and loaded, each meal fills its day's slot (its title and minutes, a day's
 * own time), the scheduled trip its slot, while a cooking session and a trip off the schedule get pinned cards of their
 * own (in a week not planned yet too); the cards set in Turtleduck can't be dragged, resized, Alt+clicked away or cut (a
 * copy is yours), their pop-ups are read-only ("Change it in Turtleduck", "Set in Turtleduck" opening Times & trips) and
 * Today's has no Edit but opens the cook view; a meal taken off empties its slot; Save as baseline and Copy previous week
 * keep one card per slot; the true cost counts each slot's title against its slots; Turtleduck's line says where each
 * week stands with Momo; and two tabs. */
"use strict";
const { TODAY, DESKTOP, PHONE, eq, ok, has, open, switchTo, importBackup, addDays, lastDialog } = require("./lib");
const gen = require("./generate");
const td = require("./turtleduck");
const mo = require("./momo");

const D = n => addDays(TODAY, n); // TODAY: Wednesday Sep 30; this week Sep 28 – Oct 4, next Oct 5 – 11
const PLAN = [
  { date: TODAY, meal: "breakfast", recipeId: "rc-oats" }, { date: TODAY, meal: "lunch", kind: "quick", name: "Shake", kcal: 300, protein: 30, recipeId: "" },
  { date: TODAY, meal: "snack", recipeId: "rc-oats" },
  { id: "chili", date: D(1), meal: "dinner", recipeId: "rc-chili" }, { date: D(1), meal: "dinner", recipeId: "rc-salad" },
  { date: D(2), meal: "dinner", recipeId: "rc-friedrice" },
  { date: D(3), meal: "lunch", recipeId: "rc-chili", leftover: true, from: "chili" }, { date: D(3), meal: "dinner", kind: "restaurant", name: "", recipeId: "" },
  { date: D(4), meal: "cook", recipeId: "rc-curry", scale: 1.5 }, { date: D(4), meal: "cook", recipeId: "rc-chili" },
  { date: D(5), meal: "breakfast", kind: "skipped", recipeId: "" }, { date: D(7), meal: "cook", recipeId: "rc-curry" }
];
// Trips: Saturday's every week (10 am), and one placed by hand on Thursday (off the schedule).
const SETTINGS = { targets: { kcal: null, protein: null, carbs: null, fat: null, fiber: null }, units: "entered", schedule: [{ day: 5, time: "10:00" }], u: 1 };
const BASELINE = gen.momoWorld({ baseline: [{ title: "Sleep", hours: 7, days: [0, 1, 2, 3, 4, 5, 6] }] });
const tick = tab => tab.page.evaluate(() => Kyoshi.tick());
const titles = d => d.cards.map(c => c.title);
const key = tab => tab.page.evaluate(() => [Kyoshi.apps.momo.thisWeekKey(), Kyoshi.apps.momo.nextWeekKey()]);

// Turtleduck's plan (confirmed: the Mondays given), then Momo's baseline with its slots; Momo on screen.
async function both(t, { size = DESKTOP, confirmed = [] } = {}) {
  const tab = await open(t, { app: "turtleduck", size });
  await importBackup(tab, gen.turtleduck({ plan: PLAN, trips: [D(1)], settings: SETTINGS, confirmed }));
  await switchTo(tab, "momo");
  await importBackup(tab, BASELINE);
  await tick(tab); // the baseline's slots (routine.js syncSlots)
  return tab;
}

module.exports = [
  {
    name: "turtleduck momo: the baseline's slots at Turtleduck's times, following a change within a minute; nothing until a week's confirmed; then meals fill their slots, cooking and an extra trip pinned on their own",
    async run(t) {
      const tab = await both(t), p = tab.page, [tk, nk] = await key(tab);
      await mo.view(tab, "base");
      const slots = (await mo.baselineCards(tab)).filter(c => c.slot);
      eq(slots.length, 22, "21 meal slots and Saturday's trip");
      const one = s => { const c = slots.find(x => x.slot === `turtleduck:${s}`); return [c.title, c.day, c.pin, c.hours, c.fixed, c.auto, c.app]; };
      eq([one("breakfast:0"), one("lunch:3"), one("dinner:6"), one("groceries:5")], [["Breakfast", 0, 7.5, 0.25, true, true, "turtleduck"], ["Lunch", 3, 12, 0.5, true, true, "turtleduck"],
        ["Dinner", 6, 18, 0.75, true, true, "turtleduck"], ["Groceries", 5, 10, 0.75, true, true, "turtleduck"]], "pinned at the usual times, their usual lengths");
      eq(titles((await mo.days(tab))[5]), ["Sleep", "Breakfast", "Groceries", "Lunch", "Dinner"], "Saturday: the trip at 10 among the meals");
      eq((await mo.days(tab))[1].cards[1].label, "Breakfast, 15m, pinned at 0730, set in Turtleduck", "set in Turtleduck");

      // A usual time changed in Turtleduck (another tab) moves its slots within a minute.
      const other = await open(t, { ctx: tab.ctx, app: "turtleduck", size: DESKTOP });
      await td.openTimes(other);
      ok(await td.setTimes(other, { lunch: "12:30" }), "lunch at 12:30 from now on");
      // Waits for the other tab's save to reach this tab's Turtleduck state (its lunch time), then the minute.
      await p.waitForFunction(() => Kyoshi.apps.turtleduck.S.settings.times.lunch === "12:30");
      await tab.ctx.clock.fastForward(61000);
      eq((await mo.baselineCards(tab)).filter(c => c.slot && c.slot.startsWith("turtleduck:lunch:")).map(c => c.pin), [12.5, 12.5, 12.5, 12.5, 12.5, 12.5, 12.5], "every lunch slot moved");
      await other.page.close();

      // This week isn't confirmed: loaded, its slots stay empty and nothing of Turtleduck's is in Tasks.
      await mo.view(tab, "this");
      await mo.loadBaseline(tab);
      let b = await mo.board(tab);
      eq(titles(b.days[3]), ["Sleep", "Breakfast", "Lunch", "Dinner"], "Thursday: the empty slots");
      eq(b.tasks.tasks.filter(x => x.label.includes("Turtleduck")).length, 0, "nothing in Tasks");

      // Confirm (it says what goes and what's missing), with Thursday's dinner at 7:30 that day: the slots fill.
      await switchTo(tab, "turtleduck");
      await td.view(tab, "plan");
      await td.openEntry(tab, D(1), "dinner", "Chili");
      await td.setEntryTime(tab, "19:30");
      await td.closeEntry(tab);
      await td.confirmWeek(tab, "this");
      eq(lastDialog(tab), "Confirm this week's meals for Momo? 6 meals, 1 cooking session, 2 trips. No dinner on Wed and Sun. They'll be on Momo at their times; later changes follow by themselves.", "the question");
      await switchTo(tab, "momo");
      b = await mo.board(tab);
      eq([titles(b.days[2]), titles(b.days[3]), titles(b.days[5]), titles(b.days[6])], [
        ["Sleep", "Breakfast: Overnight oats", "Lunch: Shake", "Dinner"],
        ["Sleep", "Breakfast", "Groceries", "Lunch", "Dinner: Chili + Salad"],
        ["Sleep", "Breakfast", "Groceries", "Lunch: Chili", "Dinner: Restaurant"],
        ["Sleep", "Breakfast", "Lunch", "Cook: Curry ×1½ · Chili", "Dinner"]
      ], "the meals in their slots (the snack sends nothing), Thursday's trip and Sunday's cooking on their own");
      const thu = b.days[3].cards;
      eq([thu[4].hours, thu[4].label], [1.25, "Dinner: Chili + Salad (from Turtleduck), 1.25h, pinned at 1930, set in Turtleduck"], "Thursday's dinner: its minutes, that day's time");
      eq(thu[2].label, "Groceries (from Turtleduck), 45m, pinned at 1000, set in Turtleduck", "the trip off the schedule, pinned on its own");
      const week = await mo.weekCards(tab, tk);
      eq(week.filter(c => c.day === 3 && c.app).map(c => [c.title, c.slot, c.need]), [["Breakfast", "turtleduck:breakfast:3", null], ["Groceries", null, `turtleduck:groceries:${D(1)}`],
        ["Lunch", "turtleduck:lunch:3", null], ["Dinner: Chili + Salad", "turtleduck:dinner:3", null]], "slot cards hold the meals; the extra trip is a card of its own");
      eq(b.tasks.tasks.filter(x => x.label.includes("Turtleduck")).length, 0, "still nothing in Tasks");

      // Next week, not planned in Momo: once confirmed, its cooking and its scheduled trip are there anyway, pinned.
      await switchTo(tab, "turtleduck");
      await td.confirmWeek(tab, "next");
      await switchTo(tab, "momo");
      await mo.view(tab, "next");
      b = await mo.board(tab);
      eq([titles(b.days[2]), titles(b.days[5]), b.tabs.next.status], [["Cook: Curry"], ["Groceries"], "not planned yet"], "pinned on their own; the week still not planned");
      eq([b.days[2].cards[0].label, b.days[5].cards[0].label], ["Cook: Curry (from Turtleduck), 1h, pinned at 1600, set in Turtleduck", "Groceries (from Turtleduck), 45m, pinned at 1000, set in Turtleduck"], "at their times");
      eq((await mo.weekCards(tab, nk)).map(c => c.fixed), [true, true], "set in Turtleduck");
    }
  },
  {
    name: "turtleduck momo: Turtleduck's cards are fixed in Momo — no drag, Alt+click or cut, a plain copy, read-only pop-ups; a meal taken off empties its slot; one card per slot kept; the true cost",
    async run(t) {
      const tab = await both(t, { confirmed: [D(-2)] }), p = tab.page, [tk, nk] = await key(tab);
      await mo.view(tab, "this");
      await mo.loadBaseline(tab);
      let days = await mo.days(tab);
      const dinner = days[3].cards.find(c => c.title === "Dinner: Chili + Salad");
      eq(await mo.cardLook(tab, dinner.id), { set: true, grip: false, pin: false, sign: true }, "no grip; its pin only a sign");
      eq(await mo.tryDrag(tab, dinner.id, 4), false, "a drag leaves it");
      await mo.altClick(tab, dinner.id);
      ok((await mo.weekCards(tab, tk)).some(c => c.id === dinner.id), "Alt+click leaves it");
      await mo.shortcut(tab, "x", `#kMount #board .card[data-id="${dinner.id}"]`);
      eq(await p.evaluate(() => Kyoshi.apps.momo.S.clip), null, "Ctrl+X cuts nothing");
      await mo.shortcut(tab, "c", `#kMount #board .card[data-id="${dinner.id}"]`);
      await mo.shortcut(tab, "v", '#kMount #board .col[data-day="6"] .col-body > .free.end');
      const copy = (await mo.weekCards(tab, tk)).find(c => c.day === 6 && c.title === "Dinner: Chili + Salad");
      eq(copy && [copy.slot, copy.fixed, copy.auto, copy.need, copy.app], [null, false, false, null, "turtleduck"], "Ctrl+C, Ctrl+V: a plain copy, yours");
      await mo.altClick(tab, copy.id);

      // Its pop-up: read-only, Change it in Turtleduck; an empty slot's: Set in Turtleduck, which opens Times & trips.
      let ed = await mo.openCard(tab, dinner.id);
      eq([ed.readonly, ed.close, ed.canDelete, ed.change, ed.changeId, ed.from.map(n => n.title)], [true, "Close", false, "Change it in Turtleduck", `meal:${D(1)}:dinner`, ["Dinner: Chili + Salad"]], "read-only");
      await mo.closeCard(tab);
      const wed = (await mo.days(tab))[2].cards.find(c => c.title === "Dinner");
      ed = await mo.openCard(tab, wed.id);
      eq([ed.change, ed.changeId], ["Set in Turtleduck", "dinner:2"], "an empty slot: where it's set");
      await p.click('#kMount #cardChange a[data-app="turtleduck"]');
      await p.waitForFunction(() => Kyoshi.active().id === "turtleduck");
      ok(await p.locator("#kMount #timesOverlay.open").count(), "Times & trips, in Turtleduck");
      await p.click("#kMount #timesCancelBtn");

      // Friday's dinner taken off in Turtleduck: Momo's slot is just "Dinner" again.
      await td.view(tab, "plan");
      await td.openEntry(tab, D(2), "dinner", "Fried rice");
      await td.entryAct(tab, "remove");
      await switchTo(tab, "momo");
      days = await mo.days(tab);
      eq(days[4].cards.filter(c => c.title.startsWith("Dinner")).map(c => [c.title, c.hours]), [["Dinner", 0.75]], "the slot, as the routine has it");

      // The true cost: each slot's title against its slots; the cooking and the extra trip as Turtleduck's own.
      eq(await p.evaluate(k => Kyoshi.apps.momo.S.data.asks[k].by, tk), { "turtleduck|": 165, "turtleduck|Breakfast": 5, "turtleduck|Dinner": 130, "turtleduck|Groceries": 45, "turtleduck|Lunch": 40 }, "this week's asks");
      const cost = await p.evaluate(() => { const c = Kyoshi.apps.momo.trueCost(); return { rows: c.rows.map(r => [r.title, Math.round(r.minutes), r.room, r.slot]), apps: c.apps }; });
      eq(cost, { rows: [["Breakfast", 5, 105, true], ["Dinner", 130, 315, true], ["Groceries", 45, 45, true], ["Lunch", 40, 210, true]], apps: [{ id: "turtleduck", minutes: 165 }] }, "slot rows against the slots' room");

      // Save as baseline keeps one card per slot; Copy previous week carries the slots, which follow next week's (none).
      await mo.saveAsBaseline(tab);
      eq(lastDialog(tab), "Replace your baseline (7 cards) with this week's 7 cards?", "your cards counted");
      const base = await mo.baselineCards(tab);
      eq([base.length, new Set(base.filter(c => c.slot).map(c => c.slot)).size, base.filter(c => c.slot).length], [29, 22, 22], "7 of yours, one card per slot");
      await mo.view(tab, "next");
      await mo.copyPrevious(tab);
      const next = await mo.weekCards(tab, nk);
      eq(next.filter(c => c.slot === "turtleduck:dinner:3").map(c => [c.title, c.hours, c.pin, c.fixed]), [["Dinner", 0.75, 18, true]], "Thursday's slot, empty next week");
      eq(next.filter(c => c.slot).length, 22, "every slot came along");
    }
  },
  {
    name: "turtleduck momo: Turtleduck's line says where each week stands with Momo; two tabs; on the phone, Today's meal opens the cook view",
    async run(t) {
      const tab = await both(t);
      await switchTo(tab, "turtleduck");
      await td.view(tab, "plan");
      eq((await td.weekStatus(tab)).line, "Not on Momo until you confirm the week", "not confirmed");
      await td.confirmWeek(tab, "this");
      eq((await td.weekStatus(tab)).line, "On Momo, but its week has no baseline yet: load it there so the meals have their slots", "confirmed, Momo's week not planned");
      await switchTo(tab, "momo");
      await mo.view(tab, "this");
      await mo.loadBaseline(tab);
      await switchTo(tab, "turtleduck");
      eq((await td.weekStatus(tab)).line, "On Momo ✓", "and once it is");

      // Two tabs: a dinner placed in Turtleduck reaches the other tab's Momo within a minute.
      const m = await open(t, { ctx: tab.ctx, app: "momo", size: DESKTOP });
      await td.dragRecipe(tab, "rc-curry", TODAY, "dinner");
      // Waits for the other tab's dinner to reach this tab's Turtleduck state, then the minute.
      await m.page.waitForFunction(d => Kyoshi.apps.turtleduck.S.plan.some(e => !e.deleted && e.date === d && e.meal === "dinner" && e.recipeId === "rc-curry"), TODAY);
      await m.ctx.clock.fastForward(61000);
      eq(titles((await mo.days(m))[2]).slice(-1), ["Dinner: Curry"], "Wednesday's dinner slot, filled");

      // On the phone: Today's row for tomorrow's dinner; its pop-up has no Edit, and opens the cook view.
      await m.page.setViewportSize(PHONE);
      await mo.showToday(m);
      const row = (await mo.today(m)).sections.find(s => s.head === "Tomorrow").rows.find(r => r.title === "Dinner: Chili + Salad");
      ok(!!row && row.when === "1800", "tomorrow's dinner at 6 pm");
      await mo.openTodayCard(m, row.card);
      eq(await m.page.evaluate(() => [document.querySelector("#kMount #detailEditBtn").hidden, document.querySelector("#kMount #detailChange").textContent.trim()]), [true, "Change it in Turtleduck"], "no Edit");
      await mo.openInApp(m, "turtleduck", `meal:${D(1)}:dinner`, "detailFrom");
      const c = await td.cook(m);
      eq([c.name, c.pager], ["Chili", "‹ 1 of 2 · Next: Salad ›"], "the cook view");
      ok(m.problems.length === 0, "a clean console");
    }
  }
];
