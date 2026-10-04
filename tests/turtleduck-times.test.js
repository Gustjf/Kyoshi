/* Kyoshi · tests/turtleduck-times.test.js — when things happen in Turtleduck (v4 Phase 7): Times & trips (the usual
 * times and lengths, a trip schedule; its checks: the 15-minute grid, the lengths, a weekday once; Esc asks; the phone's
 * way in from Settings), a day's own time from a meal's pop-up and from a trip's list (Usual puts it back, kept as ""),
 * the schedule's trips this week and next (the cart skips one and brings it back, in two tabs), the lists cut by moments
 * (a 6 pm trip: that day's lunch on the list before, its dinner on its own; ticks by day), a cooked meal's groceries mark
 * (amber: no trip before it; red once its trip is past with things not bought; buying clears it), the dot until this
 * week is confirmed and from Friday until next week is, and Export / Import carrying it all, a damaged file cleaned. */
"use strict";
const { TODAY, DESKTOP, eq, ok, has, open, importBackup, exportBackup, lastDialog, addDays, travel } = require("./lib");
const gen = require("./generate");
const td = require("./turtleduck");
const mo = require("./momo");

const D = n => addDays(TODAY, n); // TODAY: Wednesday Sep 30
const TARGETS = { kcal: null, protein: null, carbs: null, fat: null, fiber: null };
const SCHEDULE = { targets: TARGETS, units: "entered", schedule: [{ day: 1, time: "18:00" }, { day: 6, time: "08:00" }], u: 1 }; // Tue 6 pm, Sun 8 am
const settings = tab => tab.page.evaluate(() => { const s = Kyoshi.apps.turtleduck.S.settings; return { times: s.times, lengths: s.lengths, schedule: s.schedule }; });
const stored = (tab, key) => tab.page.evaluate(k => JSON.parse(JSON.stringify(Kyoshi.apps.turtleduck.S[k])), key);

async function withPlan(t, data) {
  const tab = await open(t, { app: "turtleduck", size: DESKTOP });
  await importBackup(tab, gen.turtleduck(data));
  return tab;
}

module.exports = [
  {
    name: "turtleduck times: Times & trips — usual times and lengths, the checks, a trip schedule; a day's own time from a meal and from a trip's list, and Usual",
    async run(t) {
      const tab = await withPlan(t, { plan: [{ date: D(1), meal: "dinner", recipeId: "rc-chili" }, { date: D(1), meal: "lunch", recipeId: "rc-salad" }] }), p = tab.page;
      await td.openTimes(tab);
      eq(await td.times(tab), { breakfast: "07:30", lunch: "12:00", dinner: "18:00", cook: "16:00", trip: "10:00", lengths: { breakfast: 15, lunch: 30, dinner: 45 }, trips: [], status: "" }, "the defaults");
      has(await p.locator("#kMount #tripRows").innerText(), "None yet", "no trips every week yet");

      // The checks: each says what's wrong and the pop-up stays.
      eq(await td.setTimes(tab, { breakfast: "07:40" }), false, "off the grid: not saved");
      eq((await td.times(tab)).status, "Breakfast: times go in 15-minute steps (:00, :15, :30 or :45), as in Momo.", "said so");
      eq(await td.setTimes(tab, { breakfast: "07:45", lengths: { lunch: 7 } }), false, "a length off its steps");
      eq((await td.times(tab)).status, "Lunch: a usual length from 5 to 240 minutes, in 5-minute steps.", "said so");
      eq(await td.setTimes(tab, { lengths: { lunch: 40 }, trips: [[6, "08:00"], [6, "09:00"]] }), false, "a weekday twice");
      eq((await td.times(tab)).status, "Sunday is there twice: one trip a day.", "said so");
      eq(await td.setTimes(tab, { trips: [[1, "18:00"], [6, "08:00"]] }), true, "saved");
      eq(await settings(tab), { times: { breakfast: "07:45", lunch: "12:00", dinner: "18:00", cook: "16:00", trip: "10:00" }, lengths: { breakfast: 15, lunch: 40, dinner: 45 },
        schedule: [{ day: 1, time: "18:00" }, { day: 6, time: "08:00" }] }, "kept, the schedule by weekday");

      // Esc with a change asks first; Cancel doesn't. The phone's way in: Groceries → Settings.
      await td.openTimes(tab);
      eq((await td.times(tab)).trips, [[1, "18:00"], [6, "08:00"]], "opens as saved");
      await td.setTimes(tab, { dinner: "19:00" }, false);
      tab.answers.push(false);
      await p.keyboard.press("Escape");
      eq(lastDialog(tab), "Discard your changes to the times?", "Esc asks");
      ok(await p.locator("#kMount #timesOverlay.open").count(), "kept open when you say no");
      await p.click("#kMount #timesCancelBtn");
      eq((await settings(tab)).times.dinner, "18:00", "Cancel keeps nothing");
      await td.openTimes(tab, "settings");
      await p.click("#kMount #timesCancelBtn");

      // A day's own time, from the meal's pop-up: kept once the field is left; Usual takes it back (kept as "").
      await td.view(tab, "plan");
      await td.openEntry(tab, D(1), "dinner", "Chili");
      eq(await td.entryTime(tab), { label: "Dinner at", time: "18:00", usual: "" }, "the usual time");
      await td.setEntryTime(tab, "19:10");
      eq(lastDialog(tab), "Times go in 15-minute steps (:00, :15, :30 or :45), as in Momo.", "off the grid: said so");
      eq((await td.entryTime(tab)).time, "18:00", "and put back");
      await td.setEntryTime(tab, "19:30");
      eq(await td.entryTime(tab), { label: "Dinner at", time: "19:30", usual: "Usual (6:00 PM)" }, "Thursday's dinner at 7:30");
      eq((await stored(tab, "slotTimes"))[`${D(1)}:dinner`].time, "19:30", "kept for that day");
      await td.entryTimeUsual(tab);
      eq(await td.entryTime(tab), { label: "Dinner at", time: "18:00", usual: "" }, "back to the usual");
      eq((await stored(tab, "slotTimes"))[`${D(1)}:dinner`].time, "", "kept as the usual, so it wins on sync");
      await td.closeEntry(tab);

      // A trip's time, from its list.
      await td.view(tab, "groceries");
      eq(await td.tripTime(tab, D(4)), { time: "08:00", usual: false }, "Sunday's trip at its schedule's time");
      await td.setTripTime(tab, D(4), "09:15");
      eq(await td.tripTime(tab, D(4)), { time: "09:15", usual: true }, "that Sunday at 9:15");
      await p.click(`#kMount .g-list[data-list="${D(4)}"] [data-act="trip-time-usual"]`);
      eq(await td.tripTime(tab, D(4)), { time: "08:00", usual: false }, "Usual: back to 8");
    }
  },
  {
    name: "turtleduck times: the schedule's trips this week and next, skipped and back in two tabs; the lists go by moments; a past trip's meals red until bought",
    async run(t) {
      const plan = [{ date: TODAY, meal: "breakfast", recipeId: "rc-oats" }, { date: D(5), meal: "dinner", recipeId: "rc-friedrice" },
        { date: D(6), meal: "lunch", recipeId: "rc-salad" }, { date: D(6), meal: "dinner", recipeId: "rc-chili" }];
      const a = await withPlan(t, { plan, settings: SCHEDULE }), p = a.page;
      const thisWeek = await td.carts(a);
      eq([thisWeek[D(-1)], thisWeek[D(0)], thisWeek[D(4)]], ["6:00 PM", "", "8:00 AM"], "Tuesday's (gone by) and Sunday's, with their times");
      await td.week(a, "next");
      const nextWeek = await td.carts(a);
      eq([nextWeek[D(5)], nextWeek[D(6)], nextWeek[D(11)]], ["", "6:00 PM", "8:00 AM"], "next week's too");
      await td.week(a, "this");

      // The lists go by moments: Tuesday's 6 pm trip covers that dinner; that day's lunch is on Sunday's list.
      await td.view(a, "groceries");
      let lists = await td.lists(a);
      eq(lists.map(l => [l.title, l.meta]), [["Needed before Sun's trip", "for meals Sep 30 – Oct 3"], ["Sun Oct 4", "for meals Oct 4 – 6"], ["Tue Oct 6", "for meals Oct 6 – 10"], ["Sun Oct 11", "for meals Oct 11"]], "a list a trip, by moments");
      has(lists[1].rows.join(" | "), "1 head lettuce · Salad · Produce", "Tuesday's lunch on Sunday's list");
      ok(!lists[1].rows.join(" | ").includes("ground beef") && lists[2].rows.join(" | ").includes("500 g ground beef · Chili · Meat & fish"), "Tuesday's dinner on its own");

      // Today's breakfast came after Tuesday's trip (gone by) and nothing's bought: red, until it's ticked on Now.
      await td.view(a, "plan");
      eq(await td.coverage(a, TODAY, "breakfast", "Overnight oats"), { mark: "unbought", meta: "400 · P 25 · 3 not bought" }, "red: 3 not bought");
      await td.view(a, "groceries");
      for (const what of ["50 g oats", "200 ml milk", "1 banana"]) await td.tickRow(a, "now", what);
      await td.view(a, "plan");
      eq(await td.coverage(a, TODAY, "breakfast", "Overnight oats"), { mark: "", meta: "400 · P 25" }, "bought: no mark");
      await td.week(a, "next");
      eq(await td.coverage(a, D(5), "dinner", "Fried rice"), { mark: "", meta: "520 · P 20" }, "Monday's dinner: Sunday's trip is still ahead");
      await td.week(a, "this");

      // The cart skips Sunday's trip (in the other tab too), and brings it back.
      const b = await open(t, { ctx: a.ctx, app: "turtleduck", size: DESKTOP });
      await td.view(b, "groceries");
      await td.cart(a, D(4));
      eq((await stored(a, "tripSkips"))[D(4)].skip, true, "skipped, kept for that day");
      await b.page.waitForFunction(() => document.querySelectorAll("#kMount .g-list").length === 3, null, { timeout: 5000 });
      eq((await td.lists(b)).map(l => l.title), ["Needed before Tue's trip", "Tue Oct 6", "Sun Oct 11"], "the other tab's lists, without Sunday's");
      await td.cart(a, D(4));
      eq((await stored(a, "tripSkips"))[D(4)].skip, false, "back on (kept, so it wins on sync)");
      await b.page.waitForFunction(() => document.querySelectorAll("#kMount .g-list").length === 4, null, { timeout: 5000 });
      ok((await td.carts(a))[D(4)] === "8:00 AM", "the cart's on again");
    }
  },
  {
    name: "turtleduck times: the dot until this week is confirmed, from Friday until next week is; amber with no trip before a meal, red once it's past, cleared when bought",
    async run(t) {
      const plan = [{ date: TODAY, meal: "dinner", recipeId: "rc-chili" }, { date: D(1), meal: "dinner", recipeId: "rc-friedrice" }, { date: D(2), meal: "dinner", recipeId: "rc-stew" }, { date: D(3), meal: "dinner", recipeId: "rc-salad" }];
      const tab = await withPlan(t, { plan }), p = tab.page;
      eq((await mo.dots(tab)).turtleduck, "this week's meals aren't confirmed", "the dot, any day while this week isn't");
      eq(await td.coverage(tab, TODAY, "dinner", "Chili"), { mark: "none", meta: "650 · P 45 · no trip before this" }, "amber: no trip before it");
      await td.cart(tab, TODAY);
      eq(await td.coverage(tab, TODAY, "dinner", "Chili"), { mark: "", meta: "650 · P 45" }, "a trip at 10 this morning, still ahead");

      // Confirm says what goes and what's missing, then confirms anyway.
      eq((await td.weekStatus(tab)).this, "not confirmed", "its tab says so");
      eq((await td.weekStatus(tab)).line, "Not on Momo until you confirm the week", "and its line");
      await td.confirmWeek(tab, "this");
      eq(lastDialog(tab), "Confirm this week's meals for Momo? 4 meals, 0 cooking sessions, 1 trip. No dinner on Sun. They'll be on Momo at their times; later changes follow by themselves.", "the question");
      const st = await td.weekStatus(tab);
      eq([st.this, st.line], ["confirmed ✓", "On Momo, but its week has no baseline yet: load it there so the meals have their slots"], "confirmed; Momo has no week yet");
      ok(!(await p.locator("#kMount #confirmBtn").isVisible()), "no Confirm any more");
      eq((await mo.dots(tab)).turtleduck, undefined, "no dot on a Wednesday with dinners today and tomorrow");

      // A day on, the morning's trip is past: Thursday's dinner is red until its groceries are ticked (on Now).
      await travel(tab, 1);
      eq(await td.coverage(tab, D(1), "dinner", "Fried rice"), { mark: "unbought", meta: "520 · P 20 · 4 not bought" }, "red: 4 not bought");
      await td.view(tab, "groceries");
      for (const what of ["1 kg rice", "2 eggs", "1 cup frozen peas", "2 tbsp soy sauce"]) await td.tickRow(tab, "now", what);
      await td.view(tab, "plan");
      eq((await td.coverage(tab, D(1), "dinner", "Fried rice")).mark, "", "bought: cleared");

      // Friday: next week isn't confirmed: the dot, until it is (the phone's way: its list's week head).
      await travel(tab, 1);
      eq((await mo.dots(tab)).turtleduck, "next week's meals aren't confirmed", "from Friday");
      await p.setViewportSize({ width: 390, height: 844 });
      await td.view(tab, "plan");
      eq((await td.weekStatus(tab)).heads, ["On Momo, but its week has no baseline yet: load it there so the meals have their slots", "Not on Momo until you confirm the week"], "the phone's list heads each week");
      await td.confirmWeek(tab, "next");
      has(lastDialog(tab), "Confirm next week's meals for Momo? 0 meals, 0 cooking sessions, 0 trips.", "asked");
      eq((await mo.dots(tab)).turtleduck, undefined, "no dot");
    }
  },
  {
    name: "turtleduck times: Export and Import carry the times, a day's own times, trips skipped and weeks confirmed; a damaged file is cleaned",
    async run(t) {
      const data = {
        plan: [{ date: D(1), meal: "dinner", recipeId: "rc-chili" }], confirmed: [D(-2), D(5)],
        slotTimes: { [`${D(1)}:dinner`]: { time: "19:30", u: 5 } }, tripSkips: { [D(4)]: { skip: true, u: 5 } },
        settings: { ...SCHEDULE, times: { breakfast: "08:00", lunch: "12:30", dinner: "19:00", cook: "15:00", trip: "09:00" }, lengths: { breakfast: 20, lunch: 30, dinner: 60 } }
      };
      const tab = await withPlan(t, data);
      const backup = await exportBackup(tab);
      eq([backup.slotTimes, backup.tripSkips, Object.keys(backup.confirmed), backup.settings.times, backup.settings.lengths, backup.settings.schedule],
        [data.slotTimes, data.tripSkips, [D(-2), D(5)], data.settings.times, data.settings.lengths, SCHEDULE.schedule], "all in the backup");
      const fresh = await open(t, { app: "turtleduck", size: DESKTOP });
      await importBackup(fresh, backup);
      for (const k of ["slotTimes", "tripSkips", "confirmed", "settings"]) eq(await stored(fresh, k), await stored(tab, k), `${k} came back the same`);

      // A damaged file: what can be used is kept, the rest goes back to the defaults or is dropped.
      await importBackup(fresh, {
        ...gen.turtleduck({ plan: data.plan }),
        slotTimes: { [`${D(1)}:dinner`]: { time: "19:10", u: 1 }, [`${D(2)}:brunch`]: { time: "11:00" }, x: 5, [`${D(3)}:lunch`]: "noon", [`${D(4)}:trip`]: { time: "09:15", u: 2 } },
        tripSkips: { [D(4)]: { skip: "yes", u: 1 }, soon: { skip: true } },
        confirmed: { [D(-1)]: { at: 5, u: 1 }, [D(-2)]: { at: -3 }, [D(5)]: { at: 7, u: 2 } },
        settings: { targets: TARGETS, times: { breakfast: "07:40", lunch: "12:00", dinner: "25:00", cook: 16, trip: "10:15" }, lengths: { breakfast: 12, lunch: 300, dinner: 50 },
          schedule: [{ day: 6, time: "08:00" }, { day: 6, time: "09:00" }, { day: 9, time: "10:00" }, { day: 1, time: "18:10" }, { day: 2, time: "07:00" }, "x"] }
      });
      eq(await stored(fresh, "slotTimes"), { [`${D(1)}:dinner`]: { time: "", u: 1 }, [`${D(4)}:trip`]: { time: "09:15", u: 2 } }, "a day's own times, cleaned");
      eq(await stored(fresh, "tripSkips"), { [D(4)]: { skip: false, u: 1 } }, "skips, cleaned");
      eq(await stored(fresh, "confirmed"), { [D(-2)]: { at: 0, u: 0 }, [D(5)]: { at: 7, u: 2 } }, "weeks confirmed: Mondays only");
      eq(await settings(fresh), { times: { breakfast: "07:30", lunch: "12:00", dinner: "18:00", cook: "16:00", trip: "10:15" }, lengths: { breakfast: 15, lunch: 30, dinner: 50 },
        schedule: [{ day: 2, time: "07:00" }, { day: 6, time: "08:00" }] }, "the settings, cleaned");
      for (const v of ["plan", "groceries"]) await td.view(fresh, v);
    }
  }
];
