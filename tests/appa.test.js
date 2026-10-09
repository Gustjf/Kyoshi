/* Kyoshi · tests/appa.test.js — Appa's records, as the user keeps them: other work logged with no job keeps the time
 * typed (opened again, Took shows it; Export carries it; Momo's card for it is that long), while a record of jobs
 * shares its time between them; an older backup's record of other work, with no time of its own, imports fine and
 * gives Momo the usual 30 minutes. */
"use strict";
const { TODAY, DESKTOP, eq, open, importBackup, exportBackup, switchTo } = require("./lib");
const gen = require("./generate");
const mo = require("./momo");

const M = "#kMount";
const world = () => gen.appaWorld({ things: [{ id: "car1", name: "Car" }], jobs: [{ id: "oil1", thingId: "car1", name: "Oil change", every: [6, "m"], from: { date: TODAY }, est: 30 }] });
// The records as kept: [title, how many jobs, the record's own minutes, each job's].
const records = tab => tab.page.evaluate(() => Kyoshi.apps.appa.S.records.filter(r => !r.deleted).map(r => [r.title, r.jobs.length, r.minutes, r.jobs.map(x => x.minutes)]));
// What Appa gives Momo for this week and next: [id, minutes].
const needs = tab => tab.page.evaluate(() => Kyoshi.inbox("2026-09-28", "2026-10-11").filter(n => n.app === "appa").map(n => [n.id.replace(/^(done:)[a-z0-9]+/, "$1rec"), n.minutes]));

module.exports = [
  {
    name: "appa records: other work with no job keeps its time — shown again, exported, as long in Momo; a job's record shares it",
    async run(t) {
      const tab = await open(t, { app: "appa", size: DESKTOP }), p = tab.page;
      await importBackup(tab, world());
      await p.click(`${M} [data-act="open-thing"][data-id="car1"]`);
      // Other work, no job: 1:15.
      await p.click(`${M} #addRecordBtn`);
      await p.waitForSelector(`${M} #recOverlay.open`);
      await p.fill(`${M} #rcWhat`, "Washed the seats");
      await p.fill(`${M} #rcTook`, "1:15");
      await p.click(`${M} #rcSaveBtn`);
      // The oil change done: 45 minutes, on the job.
      await p.click(`${M} #addRecordBtn`);
      await p.click(`${M} #rcJobs [data-job="oil1"]`);
      await p.fill(`${M} #rcTook`, "45");
      await p.click(`${M} #rcSaveBtn`);
      eq(await records(tab), [["Washed the seats", 0, 75, []], ["", 1, null, [45]]], "other work keeps its time, a job's record on its job");

      // Opened again, Took shows it.
      await p.click(`${M} tr[data-act="open-record"]:has-text("Washed the seats")`);
      await p.waitForSelector(`${M} #recOverlay.open`);
      eq(await p.locator(`${M} #rcTook`).inputValue(), "1h 15m", "Took as typed");
      await p.keyboard.press("Escape");
      eq((await exportBackup(tab)).records.map(r => [r.title, r.minutes]), [["Washed the seats", 75], ["", null]], "Export carries it");
      eq(await needs(tab), [["done:rec", 75], ["done:rec:oil1", 45]], "Momo is told how long each took");

      // In Momo (the week has a card of yours): each a card of its own today, as long as it took.
      await switchTo(tab, "momo");
      await importBackup(tab, gen.momo([], [{ date: TODAY, title: "Reading", hours: 1 }]));
      await tab.ctx.clock.fastForward(61000);
      eq((await mo.weekCards(tab, "2026-09-28")).filter(c => c.app === "appa").map(c => [c.title, c.hours]).sort(), [["Car: Oil change", 0.75], ["Car: Washed the seats", 1.25]], "1h 15m and 45m");
    }
  },
  {
    name: "appa records: an older backup's other work (no time of its own) imports fine, and Momo gets the usual 30 minutes",
    async run(t) {
      const tab = await open(t, { app: "appa", size: DESKTOP });
      const old = world();
      old.records.push({ id: "rec1", thingId: "car1", date: TODAY, reading: null, title: "Washed the seats", jobs: [], by: "", cost: null, notes: "", files: [], links: [], deleted: false, at: 5, u: 5 });
      await importBackup(tab, old);
      eq(await records(tab), [["Washed the seats", 0, null, []]], "no time of its own");
      eq(await needs(tab), [["done:rec", 30]], "the usual 30 minutes");
      eq((await exportBackup(tab)).records.map(r => r.minutes), [null], "exported as none");
    }
  },
  {
    name: "appa things: a thing's Next line keeps a date's capital (Dec 9), and words like \"in 9 days\" stay lowercase",
    async run(t) {
      const tab = await open(t, { app: "appa", size: DESKTOP }), p = tab.page;
      await importBackup(tab, gen.appaWorld({ things: [{ id: "car1", name: "Car" }], jobs: [{ id: "oil1", thingId: "car1", name: "Oil change", every: [6, "m"], from: { date: TODAY }, est: 30 }] }));
      const sub = () => p.locator(`${M} .thing-row .row-sub`).first().textContent();
      const far = await sub();
      eq(/Next: Oil change, [A-Z][a-z]{2} \d/.test(far), true, "a far date keeps its capital: " + far);
      await importBackup(tab, gen.appaWorld({ things: [{ id: "car1", name: "Car" }], jobs: [{ id: "oil1", thingId: "car1", name: "Oil change", every: [6, "m"], from: { date: "2026-04-10" }, est: 30 }] }));
      eq(/Next: Oil change, [a-z]/.test(await sub()), true, "a near one reads lowercase: " + await sub());
    }
  },
];
