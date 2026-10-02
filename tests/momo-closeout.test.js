/* Kyoshi · tests/momo-closeout.test.js — the weekly close-out after roadmap Phase 8: on a computer it pops up, Later
 * puts it off until tomorrow (a reload doesn't bring it back today), a goal's row says what of its hours had no card,
 * Close all as planned closes every week waiting, and a week never planned counts 0 hours for the goals (hoursSpent),
 * so Iroh shows them behind and dots its icon; on a phone it waits in its banner until tapped, then goes on to the next. */
"use strict";
const { DESKTOP, PHONE, eq, ok, has, open, switchTo, importBackup, at } = require("./lib");
const gen = require("./generate");
const mo = require("./momo");

const DAY = "2026-10-21"; // a Wednesday in fall 2026, the season's fourth week
// Iroh: a fall goal, Read, 5 h a week. Momo: Read cards in the weeks of Sep 28 (2 h) and Oct 12 (2 h Mon, 2 h Wed); the
// week of Oct 5 was never planned (a holiday).
const IROH = gen.iroh({ areas: [{ id: "a1", name: "Mind" }], goals: [{ id: "g1", period: "2026-fall", title: "Read", hoursWeek: 5 }] });
const MOMO = gen.momo([], [{ date: "2026-09-28", title: "Read", hours: 2 }, { date: "2026-10-12", title: "Read", hours: 2 }, { date: "2026-10-14", title: "Read", hours: 2 }]);

async function both(t, size) {
  const tab = await open(t, { app: "iroh", size, time: at(DAY) });
  await importBackup(tab, IROH);
  await switchTo(tab, "momo");
  await importBackup(tab, MOMO);
  return tab;
}
// A reload, back on Momo (the last app), settled.
async function reload(tab) {
  await tab.page.reload();
  await tab.page.waitForFunction(() => window.Kyoshi && Kyoshi.active() && Kyoshi.active().started && Kyoshi.active().id === "momo");
}

module.exports = [
  {
    name: "momo close-out: Later lasts until tomorrow, a row says what had no card, Close all as planned, a week never planned counts 0",
    async run(t) {
      const tab = await both(t, DESKTOP), p = tab.page;
      eq((await mo.closeOut(tab)).open, false, "not straight after an import");
      await reload(tab);
      let co = await mo.closeOut(tab);
      eq([co.title, co.rows], ["Close out Sep 28 – Oct 4", [{ title: "Read", detail: "Planned 2h · Mon · 3h had no card", done: 2 }]], "the oldest week, Read's 3 hours with no card said");
      ok(await mo.visible(tab, "closeOutAllBtn"), "two weeks wait: Close all as planned is there");
      eq(await p.locator("#kMount #closeOutAllBtn").innerText(), "Close all 2 as planned", "it says how many");

      // Later: put off until tomorrow, even across a reload.
      await mo.later(tab);
      eq(await mo.banner(tab), "2 past weeks are ready to close out, starting with Sep 28 – Oct 4.", "the banner stands in for it");
      await reload(tab);
      eq((await mo.closeOut(tab)).open, false, "a reload the same day doesn't bring it back");
      ok(await p.evaluate(() => Kyoshi.apps.momo.store.get("later") === "2026-10-21"), "kept on this device");
      eq(await p.evaluate(() => Kyoshi.apps.momo.data.build().later), undefined, "not in its backup or sync");

      // Iroh: the week never planned counts 0, so Read is behind already, by more than a week's 5 hours: a dot.
      eq(await p.evaluate(() => Kyoshi.apps.momo.hoursSpent("Read")), { "2026-10-05": 0 }, "the holiday week counts 0 (the others aren't closed yet)");

      // Tomorrow it comes back; Close all as planned closes both weeks as they were planned.
      await p.evaluate(() => Kyoshi.dev.travel(1)); // time travel (asked first), without the panel: the close-out comes up over it
      co = await mo.closeOut(tab);
      eq(co.title, "Close out Sep 28 – Oct 4", "tomorrow it's back");
      await p.click("#kMount #closeOutAllBtn");
      has(tab.dialogs.map(d => d[1]).join(" | "), "Close all 2 weeks? Each one's goals are logged as they were planned.", "asked first");
      eq((await mo.closeOut(tab)).open, false, "closed");
      eq(await mo.banner(tab), "", "nothing waits");
      eq(await p.evaluate(() => Kyoshi.apps.momo.hoursSpent("Read")), { "2026-09-28": 2, "2026-10-05": 0, "2026-10-12": 4 }, "each week as planned, the holiday 0");
      const why = (await mo.dots(tab)).iroh || "";
      has(why, "a goal is more than a week behind", "Iroh's dot: 6 of 15 hours");
      await switchTo(tab, "iroh");
      has(await p.locator("#kMount .goal-progress").first().innerText(), "9 h behind", "Iroh says how far");
    }
  },
  {
    name: "momo close-out: on a phone it waits in its banner until tapped, then goes on to the next week",
    async run(t) {
      const tab = await both(t, PHONE), p = tab.page;
      await reload(tab);
      ok(await mo.isToday(tab), "Today, on the phone");
      eq((await mo.closeOut(tab)).open, false, "no pop-up over Today");
      eq(await mo.banner(tab), "2 past weeks are ready to close out, starting with Sep 28 – Oct 4.", "the banner waits");
      await mo.review(tab);
      eq((await mo.closeOut(tab)).title, "Close out Sep 28 – Oct 4", "tapped: the oldest");
      await mo.setDone(tab, 0, 1.5);
      await mo.confirmCloseOut(tab);
      const co = await mo.closeOut(tab);
      eq([co.open, co.title, co.rows.map(r => r.detail)], [true, "Close out Oct 12 – 18", ["Planned 4h · Mon, Wed · 1h had no card"]], "the next one comes up: you're closing out");
      ok(!(await mo.visible(tab, "closeOutAllBtn")), "one left: no Close all");
      await mo.confirmCloseOut(tab);
      eq([(await mo.closeOut(tab)).open, await mo.banner(tab)], [false, ""], "all closed");
      eq(await p.evaluate(() => Kyoshi.apps.momo.hoursSpent("Read")), { "2026-09-28": 1.5, "2026-10-05": 0, "2026-10-12": 4 }, "as reviewed");
    }
  }
];
