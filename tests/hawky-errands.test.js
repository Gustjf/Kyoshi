/* Kyoshi · tests/hawky-errands.test.js — Hawky's errands and its shopping lists (plan_2026-10-05 Phase 2, and the
 * 2026-10-06 feedback batch's Phase 2): quick add's 5 min chip and This week / Next week (due that Sunday; on a Sunday
 * This week is today), This week from the start and again after each add, its days three then two on a phone;
 * Tomorrow → on an overdue errand (due tomorrow, counted; past three times a warning on its line, a line in its pop-up
 * and in Momo's details; the count kept through Export and Import, gone with a deleted errand); each store's lists in
 * its own colour, by the order stores were first used (a dot by its name, the left edge of its lists, ready and done
 * ones' too; kept as new stores come, the same on another device); the add row's topic cleared, once, by another
 * store typed after an add. */
"use strict";
const { TODAY, DESKTOP, PHONE, eq, ok, open, importBackup, exportBackup, addDays, travel } = require("./lib");
const gen = require("./generate");
const hk = require("./hawky");

const D = n => addDays(TODAY, n); // TODAY is a Wednesday: this Sunday is D(4), next week's D(11)
const fitsScreen = tab => tab.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
const [BLUE, ORANGE, GREEN, PINK] = ["#3b82f6", "#f97316", "#22c55e", "#ec4899"]; // the first four store colours, in order

module.exports = [
  {
    name: "hawky errands: quick add's 5 min, This week (from the start and after each add) and Next week (due that Sunday; on a Sunday, today); the days three then two on a phone",
    async run(t) {
      const tab = await open(t, { app: "hawky", size: PHONE }), p = tab.page;
      const days = await p.$$eval("#kMount #addDays .chip", els => els.map(b => [b.dataset.day, Math.round(b.getBoundingClientRect().top)]));
      eq(days.map(d => d[0]), ["today", "week", "nextweek", "pick", "none"], "the day chips, in order");
      ok(days[0][1] === days[1][1] && days[1][1] === days[2][1] && days[3][1] === days[4][1] && days[3][1] > days[0][1], "Today, This week and Next week on a line, Pick a day and No day under them");
      eq(await p.$$eval("#kMount #addMinutes .chip", els => els.map(b => b.dataset.minutes)), ["5", "15", "30", "60", "other"], "5 min first, then as before");
      eq(await hk.chips(tab), { day: "week", minutes: "15" }, "quick add starts on This week and 15 min");
      ok(await fitsScreen(tab), "nothing wider than the phone");

      await hk.addErrand(tab, "Buy stamps", { day: "week", minutes: 5 });
      eq(await hk.status(tab), "Added “Buy stamps” for Sunday, 5m.", "the line says when");
      eq((await hk.groups(tab)).week.map(i => [i.text, i.meta]), [["Buy stamps", "Sunday · 5m"]], "in This week, due Sunday, 5 minutes");
      eq(await hk.chips(tab), { day: "week", minutes: "15" }, "the chips go back to This week and 15 min");
      await hk.addErrand(tab, "Renew passport form", { day: "nextweek", minutes: 60 });
      eq(await hk.status(tab), "Added “Renew passport form” for Oct 11, 1h.", "next week's Sunday, as a date");
      eq((await hk.groups(tab)).later.map(i => [i.text, i.meta]), [["Renew passport form", "Oct 11 · 1h"]], "in Later");
      eq(await hk.chips(tab), { day: "week", minutes: "15" }, "back to This week after Next week too");
      await hk.quickAdd(tab, "Buy a birthday card");
      eq(await hk.status(tab), "Added “Buy a birthday card” for Sunday, 15m.", "with no chip tapped, it's due this Sunday");
      eq(await p.evaluate(() => Kyoshi.apps.hawky.openItems().map(i => [i.due, i.minutes])), [[D(4), 5], [D(4), 15], [D(11), 60]], "kept: due this Sunday and next");

      // On a Sunday, This week is today.
      await travel(tab, 4);
      await hk.addErrand(tab, "Mail the form", { day: "week" });
      eq(await hk.status(tab), "Added “Mail the form” for today, 15m.", "due today");
      eq((await hk.groups(tab)).today.map(i => i.text), ["Buy stamps", "Buy a birthday card", "Mail the form"], "in Today, with this week's");
    }
  },
  {
    name: "hawky errands: Tomorrow → postpones an overdue errand and counts; past three times a warning (its line, its pop-up, Momo); Export and Import keep the count",
    async run(t) {
      const tab = await open(t, { app: "hawky", size: PHONE }), p = tab.page;
      await importBackup(tab, gen.hawkyItems([
        { text: "Return library books", due: D(-2), minutes: 30 }, // overdue; the file has no count, as before postponing
        { text: "Call the dentist", due: D(-1), postponed: 4 },    // overdue, postponed four times
        { text: "Buy stamps", due: D(1) }                           // not overdue
      ]));
      let g = await hk.groups(tab);
      eq(g.overdue.map(i => [i.text, i.meta, i.postpone, i.warn]), [
        ["Return library books", "Sep 28 · 30m", true, false],
        ["Call the dentist", "postponed 4× · Yesterday · 15m", true, true]
      ], "both overdue ones have Tomorrow →; four times postponed says so, with the warning mark");
      eq(g.week.map(i => [i.text, i.postpone]), [["Buy stamps", false]], "one not overdue has none");
      const box = await p.locator('#kMount .errand[data-id="hk0000"] [data-act="postpone"]').boundingBox();
      ok(box.height >= 34 && box.x + box.width <= PHONE.width, "on a phone, Tomorrow → is thumb-sized and on screen");
      ok(await fitsScreen(tab), "nothing wider than the phone");

      await hk.postpone(tab, "hk0000");
      eq(await hk.status(tab), "Postponed “Return library books” to tomorrow (1×).", "the line says so");
      const books = await hk.item(tab, "hk0000");
      eq([books.due, books.postponed], [D(1), 1], "kept: due tomorrow, postponed once");
      g = await hk.groups(tab);
      eq(g.overdue.map(i => i.text), ["Call the dentist"], "out of Overdue");
      eq(g.week.map(i => [i.text, i.meta, i.postpone, i.warn]), [["Return library books", "Tomorrow · 30m", false, false], ["Buy stamps", "Tomorrow · 15m", false, false]],
        "into This week, quietly (three times or fewer: no mark)");
      await hk.postpone(tab, "hk0001");
      eq((await hk.item(tab, "hk0001")).postponed, 5, "the dentist: five times");
      g = await hk.groups(tab);
      ok(!g.overdue, "nothing overdue: no Overdue group");
      eq(g.week.filter(i => i.id === "hk0001").map(i => [i.meta, i.warn]), [["postponed 5× · Tomorrow · 15m", true]], "still marked, in This week");

      // Its pop-up says how often; one never postponed says nothing.
      await p.click('#kMount .errand[data-id="hk0001"] .errand-text');
      eq(await p.locator("#kMount #errandPostponedNote").innerText(), "Postponed 5 times.", "the pop-up says how often");
      await p.click("#kMount #errandCancelBtn");
      await p.click('#kMount .errand[data-id="hk0002"] .errand-text');
      ok(await p.locator("#kMount #errandPostponedNote").isHidden(), "nothing for one never postponed");
      await p.click("#kMount #errandCancelBtn");

      // Momo's card for it says so too, in its details.
      const needs = await p.evaluate(([from, to]) => Kyoshi.inbox(from, to).filter(n => n.app === "hawky").map(n => [n.title, n.details]), [D(-2), D(11)]);
      eq(needs, [["Return library books", ["Due Oct 1"]], ["Call the dentist", ["Due Oct 1", "Postponed 5×"]], ["Buy stamps", ["Due Oct 1"]]], "Momo's details: Postponed 5× past three");

      // Export, then Import: the counts come back.
      const back = await exportBackup(tab);
      eq(back.items.map(i => i.postponed), [1, 5, 0], "the backup carries them");
      await importBackup(tab, back);
      eq(await p.evaluate(() => Kyoshi.apps.hawky.S.items.map(i => i.postponed)), [1, 5, 0], "and they come back");

      // Deleted, it keeps no count.
      await p.click('#kMount .errand[data-id="hk0001"] .errand-text');
      await p.click("#kMount #errandDeleteBtn");
      const gone = await hk.item(tab, "hk0001");
      eq([gone.deleted, gone.text, gone.postponed], [true, "", 0], "a deleted errand's marker has no count");
    }
  },
  {
    name: "hawky shopping: each store in its own colour by the order stores were first used (a dot by its name, the left edge of its lists, ready and done ones' too), kept as new stores come, the same on another device",
    async run(t) {
      const tab = await open(t, { app: "hawky", size: DESKTOP }), p = tab.page;
      await hk.showLists(tab);
      // Three stores, first used in this order (a minute apart), which isn't A to Z.
      for (const [store, topic, item] of [["Hardware Store", "Garden", "Hose"], ["Bookshop", "Gifts", "Atlas"], ["Garden Centre", "Seeds", "Tomatoes"]]) {
        await hk.addItem(tab, store, topic, item);
        await tab.ctx.clock.fastForward(60000);
      }
      await hk.addItem(tab, "Hardware Store", "Tools", "Drill");
      const stores = await hk.stores(tab);
      eq(stores.map(s => [s.name, s.lists.map(l => l.topic)]), [["Bookshop", ["Gifts"]], ["Garden Centre", ["Seeds"]], ["Hardware Store", ["Garden", "Tools"]]], "three stores, A to Z");
      eq(stores.map(s => s.color), [ORANGE, GREEN, BLUE], "each its own colour, by first use: Hardware Store blue, Bookshop orange, Garden Centre green");
      stores.forEach(s => {
        eq(s.dot, hk.rgb(s.color), `${s.name}: the dot by its name`);
        s.lists.forEach(l => eq(l.edge, `${hk.rgb(s.color)} 3px`, `${s.name}'s ${l.topic} list: its left edge`));
      });

      // A fourth store, first from A to Z: the fourth colour, and the first three keep theirs.
      await hk.addItem(tab, "Art Supplies", "Paint", "Brushes");
      eq((await hk.stores(tab)).map(s => [s.name, s.color]), [["Art Supplies", PINK], ["Bookshop", ORANGE], ["Garden Centre", GREEN], ["Hardware Store", BLUE]],
        "a new store takes the next colour; the others keep theirs");

      // Locked 7 days, then ready: green on the other sides, the store's colour stays on the left.
      await p.click('#kMount .slist:has(.slist-topic:text-is("Gifts")) [data-act="list-lock"][data-days="7"]');
      await tab.ctx.clock.fastForward(7 * 86400000);
      const ready = await p.$eval("#kMount #vendors .slist.ready", c => [getComputedStyle(c).borderLeftColor, getComputedStyle(c).borderTopColor]);
      eq(ready[0], hk.rgb(ORANGE), "ready: the left edge stays the store's");
      ok(ready[1] !== ready[0], "and the other sides are green");

      // Ticked off: in the Done fold, with its store's edge; the store keeps its place, so no other store's colour moves.
      await p.click('#kMount .slist.ready [data-act="list-tickall"]');
      await p.click("#kMount #listsDoneBox summary");
      eq(await p.$eval("#kMount #listsDone .slist", c => `${getComputedStyle(c).borderLeftColor} ${getComputedStyle(c).borderLeftWidth}`), `${hk.rgb(ORANGE)} 3px`,
        "the Done fold's list keeps its store's edge");
      eq((await hk.stores(tab)).map(s => [s.name, s.color]), [["Art Supplies", PINK], ["Garden Centre", GREEN], ["Hardware Store", BLUE]],
        "Bookshop's lists are done: the stores left above keep their colours");

      // Another device with the same lists draws the same colours.
      const other = await open(t, { app: "hawky", size: DESKTOP });
      await importBackup(other, await exportBackup(tab));
      await hk.showLists(other);
      eq((await hk.stores(other)).map(s => [s.name, s.color]), [["Art Supplies", PINK], ["Garden Centre", GREEN], ["Hardware Store", BLUE]], "the same colours on another device");
    }
  },
  {
    name: "hawky shopping: another store typed after an add clears the topic kept from that add, once (a topic typed since stays)",
    async run(t) {
      const tab = await open(t, { app: "hawky", size: PHONE }), p = tab.page;
      await hk.showLists(tab);
      await hk.addItem(tab, "Hardware Store", "Garden", "Hose");
      eq(await hk.addRow(tab), { store: "Hardware Store", topic: "Garden", item: "" }, "the store and topic stay for the next item");

      // The first key that changes the store clears the topic; typing the same store back brings nothing back.
      await p.locator(hk.ROW.store).press("End");
      await p.locator(hk.ROW.store).press("Backspace");
      eq(await hk.addRow(tab), { store: "Hardware Stor", topic: "", item: "" }, "a key that changes the store clears the topic");
      await hk.typeIn(tab, "store", "Bokshop");
      await hk.typeIn(tab, "store", "Hardware Store");
      eq((await hk.addRow(tab)).topic, "", "the same store typed back: the topic stays empty");
      eq(await hk.topics(tab), ["Garden"], "its topics are still suggested");

      // A topic typed since stays, through a typo fixed in the store.
      await hk.typeIn(tab, "store", "Bokshop");
      await hk.typeIn(tab, "topic", "Garden");
      await hk.typeIn(tab, "store", "Bookshop");
      eq(await hk.addRow(tab), { store: "Bookshop", topic: "Garden", item: "" }, "the topic typed since stays");
      await hk.addItem(tab, "Bookshop", "Garden", "Atlas");
      eq(await hk.listStatus(tab), "Added “Atlas” to Garden at Bookshop.", "added to the new store");

      // The same store in other capitals keeps the topic; so does another store once a fresh topic was typed.
      await hk.typeIn(tab, "store", "BOOKSHOP");
      eq((await hk.addRow(tab)).topic, "Garden", "the same store, in other capitals: the topic stays");
      await hk.typeIn(tab, "topic", "Gifts");
      await hk.typeIn(tab, "store", "Hardware Store");
      eq(await hk.addRow(tab), { store: "Hardware Store", topic: "Gifts", item: "" }, "a fresh topic stays when the store changes");
      eq((await hk.stores(tab)).map(s => [s.name, s.lists.map(l => l.topic)]), [["Bookshop", ["Garden"]], ["Hardware Store", ["Garden"]]], "a list at each store");
    }
  }
];
