/* Kyoshi · tests/appa-upkeep.test.js — Appa's maintenance a month: one line on the home (and each thing's on its page) with what
 * its jobs take in an average month (365.25 / 12 days), worked out and never stored. The world: a Car (miles, 12,000 a year)
 * with an oil change every 6 months at 60 min and a meter job every 5,000 mi at 45 min; a Robot vacuum with a filter every
 * 2 weeks at 15 min; a Mower with a job in 2 seasons at 30 min and a job with no minutes.
 *   60 ÷ 6 = 10 · 15 × 30.4375 ÷ 14 = 32.6 · 30 × 2 ÷ 12 = 5 · 45 × (12,000 ÷ 12 ÷ 5,000 = 0.2) = 9 → 56.6 min a month,
 *   shown in hours by quarters: 56.6 ÷ 15 = 3.8 quarters, so "About 1 h" (under 7½ minutes, "Under ¼ h"). */
"use strict";
const { TODAY, PHONE, DESKTOP, eq, ok, open, importBackup } = require("./lib");
const gen = require("./generate");

const M = "#kMount";
const THINGS = [{ id: "car1", name: "Car", meter: "mi", pace: 12000 }, { id: "vac1", name: "Robot vacuum" }, { id: "mow1", name: "Mower" }];
const JOBS = [
  { id: "oil1", thingId: "car1", name: "Oil change", every: [6, "m"], from: { date: TODAY }, est: 60 },
  { id: "rot1", thingId: "car1", name: "Rotate tires", meterEvery: 5000, from: { date: TODAY }, est: 45 },
  { id: "fil1", thingId: "vac1", name: "Clean the filter", every: [2, "w"], from: { date: TODAY }, est: 15 },
  { id: "sea1", thingId: "mow1", name: "Sharpen the blade", seasons: [0, 2], from: { date: TODAY }, est: 30 },
  { id: "nom1", thingId: "mow1", name: "Check the bolts", every: [1, "y"], from: { date: TODAY } }
];
const world = (tweak = b => b) => tweak(gen.appaWorld({ things: THINGS, jobs: JOBS }));
// The home line's text and tooltip ("" and null while it's hidden), and a thing's.
const line = (tab, id) => tab.page.evaluate(sel => {
  const el = document.querySelector(sel);
  return el.hidden ? ["", null] : [el.textContent, el.querySelector("[title]").getAttribute("title")];
}, `${M} #${id}`);

module.exports = [
  {
    name: "appa upkeep: the home line adds each job's minutes times how often it comes — about 1 h a month, with what was left out",
    async run(t) {
      const tab = await open(t, { app: "appa", size: DESKTOP });
      await importBackup(tab, world());
      eq(await line(tab, "upkeepLine"), ["About 1 h of maintenance a month", "From 4 jobs on 3 things; 1 without minutes left out"], "home line");
      eq(await tab.page.evaluate(() => Kyoshi.apps.appa.upkeep().minutes.toFixed(1)), "56.6", "worked out");
    }
  },
  {
    name: "appa upkeep: a meter job whose thing has no pace is left out and said so; hours come by quarters",
    async run(t) {
      const tab = await open(t, { app: "appa", size: DESKTOP });
      await importBackup(tab, world(b => { b.things[0].pace = 0; return b; }));
      // 10 + 32.6 + 5 = 47.6 → 3 quarters: ¾ h
      eq(await line(tab, "upkeepLine"), ["About ¾ h of maintenance a month", "From 3 jobs on 3 things; 1 by the meter left out until Appa knows the pace; 1 without minutes left out"], "no pace");
      // Every week at 4 hours: 240 × 30.4375 ÷ 7 = 1043.6 min = 17.39 h, nearest quarter 17½ h
      await importBackup(tab, gen.appaWorld({ things: [{ id: "car1", name: "Car" }], jobs: [{ id: "big1", thingId: "car1", name: "Deep clean", every: [1, "w"], from: { date: TODAY }, est: 240 }] }));
      eq(await line(tab, "upkeepLine"), ["About 17½ h of maintenance a month", "From 1 job on 1 thing"], "hours by quarters");
    }
  },
  {
    name: "appa upkeep: archiving a thing drops its jobs from the line",
    async run(t) {
      const tab = await open(t, { app: "appa", size: DESKTOP });
      await importBackup(tab, world(b => { b.things[0].archived = true; return b; }));
      // 32.6 + 5 = 37.6 → 2.5 quarters, to 3: ¾ h
      eq(await line(tab, "upkeepLine"), ["About ¾ h of maintenance a month", "From 2 jobs on 2 things; 1 without minutes left out"], "without the Car");
    }
  },
  {
    name: "appa upkeep: a timed record replaces the guess",
    async run(t) {
      const tab = await open(t, { app: "appa", size: DESKTOP });
      await importBackup(tab, world(b => {
        b.records.push({ id: "rec1", thingId: "vac1", date: TODAY, reading: null, title: "", jobs: [{ jobId: "fil1", name: "Clean the filter", minutes: 30, timed: true }], by: "", cost: null, notes: "", files: [], links: [], deleted: false, at: 5, u: 5 });
        return b;
      }));
      // The filter takes 30 now: 10 + 65.2 + 5 + 9 = 89.2 → 1½ h
      eq(await line(tab, "upkeepLine"), ["About 1½ h of maintenance a month", "From 4 jobs on 3 things; 1 without minutes left out"], "timed");
    }
  },
  {
    name: "appa upkeep: a thing's page shows its own line, shorter; hidden when none of its jobs count",
    async run(t) {
      const tab = await open(t, { app: "appa", size: DESKTOP }), p = tab.page;
      await importBackup(tab, world());
      const go = async id => { if (await p.locator(`${M} .back-link:visible`).count()) await p.locator(`${M} .back-link:visible`).first().click(); await p.click(`${M} [data-act="open-thing"][data-id="${id}"]`); };
      await go("car1");
      eq(await line(tab, "thingUpkeep"), ["About ¼ h a month", "From 2 jobs on 1 thing"], "Car: 10 + 9 = 19 → 1 quarter: ¼ h");
      await go("mow1");
      eq(await line(tab, "thingUpkeep"), ["Under ¼ h a month", "From 1 job on 1 thing; 1 without minutes left out"], "Mower: 5 → under ¼ h");
      await importBackup(tab, gen.appaWorld({ things: [{ id: "car1", name: "Car" }], jobs: [{ id: "nom1", thingId: "car1", name: "Check", every: [1, "y"], from: { date: TODAY } }] }));
      await go("car1");
      eq(await line(tab, "thingUpkeep"), ["", null], "no minutes: hidden");
    }
  },
  {
    name: "appa upkeep: a world with no jobs, or only jobs without minutes, hides the line",
    async run(t) {
      const tab = await open(t, { app: "appa", size: DESKTOP });
      await importBackup(tab, gen.appaWorld({ things: [{ id: "car1", name: "Car" }] }));
      eq(await line(tab, "upkeepLine"), ["", null], "no jobs");
      await importBackup(tab, gen.appaWorld({ things: [{ id: "car1", name: "Car" }], jobs: [{ id: "nom1", thingId: "car1", name: "Check", every: [1, "y"], from: { date: TODAY } }] }));
      eq(await line(tab, "upkeepLine"), ["", null], "no minutes");
    }
  },
  {
    name: "appa upkeep: at phone width the line shows, with no sideways scroll",
    async run(t) {
      const tab = await open(t, { app: "appa", size: PHONE });
      await importBackup(tab, world());
      eq(await line(tab, "upkeepLine"), ["About 1 h of maintenance a month", "From 4 jobs on 3 things; 1 without minutes left out"], "phone line");
      ok(await tab.page.locator(`${M} #upkeepLine`).isVisible(), "visible");
      eq(await tab.page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), true, "no sideways scroll");
      eq(tab.problems, [], "console clean");
    }
  },
];
