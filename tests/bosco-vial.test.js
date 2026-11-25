/* Kyoshi · tests/bosco-vial.test.js — Bosco's vial card (the owner's request, 2026-11-25): beside each medication's next
 * dose (the only one shown: Today, Tomorrow or its weekday; the medications' panels side by side), its active vial's strength, mg and BAC water, the day mixed (the day saved), the doses left
 * (and the mg over) counting every dose of its medication from the day mixed, the last dose it covers and the dose a new
 * vial is needed by; past its expiry (Tirzepatide 12 weeks, Retatrutide 6, Semaglutide 8, from mixing) the dates stop
 * there and a red line says how much goes unused; amber with a dose or none left, or expired; a Known mg/mL vial has no
 * count; Mixed a new one saves the same recipe today (asking first), Change vial asks first, then opens start-up info's calculator (Cancel: nothing opens). */
"use strict";
const { TODAY, DESKTOP, PHONE, DAY_MS, eq, has, lacks, open, importBackup, exportBackup, addDays, lastDialog } = require("./lib");
const gen = require("./generate");

const M = "#kMount";
const D = n => addDays(TODAY, n); // TODAY is Wednesday, Sep 30
const noon = n => `${D(n)}T12:00:00.000Z`;

// A medication's backup with its vial, start-up info answered.
function world(opts, vial) {
  const base = gen.bosco(opts), medication = base.medication;
  return { ...base, name: "Sam", paceGoal: { dir: "lose", weeklyPct: 1, rangePct: 0.25 }, asked: { medication: true, dosing: 4 },
    medications: [medication], dosePlans: [base.dosePlan], vials: [{ medication, ...vial }] };
}
// A medication's vial (the lower part of its panel): its headline, the strength and recipe under it, its dates [label, day]
// (those in red marked "!"), its warning ("" for none), amber or not.
const card = (tab, med) => tab.page.evaluate(([m, med]) => {
  const c = document.querySelector(`${m} #upcomingDosesSection section[data-med="${med}"] .vial-stat`);
  return c && { head: c.querySelector(".val").textContent, sub: c.querySelector(".lbl").textContent,
    dates: [...c.querySelectorAll(".vial-dates > div")].map(d => [d.querySelector("dt").textContent + (d.classList.contains("bad") ? "!" : ""), d.querySelector("dd").textContent]),
    warn: (c.querySelector(".vial-warn") || { textContent: "" }).textContent, amber: c.classList.contains("due") };
}, [M, med]);
// The next dose's day as its panel says it ("Today, Sep 30").
const nextDay = (tab, med) => tab.page.textContent(`${M} #upcomingDosesSection section[data-med="${med}"] .next-dose .val`);
const nextCards = tab => tab.page.$$eval(`${M} #upcomingDosesSection .next-dose`, cs => cs.length);

module.exports = [
  {
    name: "bosco vial: the next dose only, its vial's doses left from the day mixed, the last dose and when a new one's needed; Mixed a new one; a dose logged counts",
    async run(t) {
      const tab = await open(t, { app: "bosco", size: DESKTOP }), p = tab.page;
      // 7.5 mg a week, doses Sep 3, 10, 17, 24; a 40 mg vial mixed Sep 10: three doses out of it (22.5 mg), 17.5 mg left.
      await importBackup(tab, world({ weeklyMg: 7.5, lastDose: D(-6), doses: 4 }, { mgPerMl: 20, vialMg: 40, bacMl: 2, savedAt: noon(-20) }));
      eq(await nextCards(tab), 1, "the next dose only");
      eq(await p.locator(`${M} #upcomingDosesSection h2`).textContent(), "Next Tirzepatide Dose", "its heading");
      eq(await card(tab, "tirzepatide"), { head: "2 doses left + 2.5 mg", sub: "20 mg/mL|40 mg + 2 mL",
        dates: [["Mixed", "Thu, Sep 10"], ["Last dose", "Thu, Oct 8"], ["New vial by", "Thu, Oct 15"], ["Expires", "Thu, Dec 3"]], warn: "", amber: false }, "the card");
      eq(await nextDay(tab, "tirzepatide"), "Tomorrow, Oct 1", "the next dose tomorrow");

      // Mixed a new one: asked first, then the same recipe today, its doses left counted from today.
      await p.click(`${M} [data-vial-again][data-med="tirzepatide"]`);
      has(lastDialog(tab), "Mixed a new 40 mg + 2 mL Tirzepatide vial today?", "asked first");
      const fresh = await card(tab, "tirzepatide");
      eq([fresh.head, fresh.dates], ["5 doses left + 2.5 mg", [["Mixed", "Wed, Sep 30"],
        ["Last dose", "Thu, Oct 29"], ["New vial by", "Thu, Nov 5"], ["Expires", "Wed, Dec 23"]]], "a new vial today");
      eq((await exportBackup(tab)).vials.map(v => [v.vialMg, v.bacMl, v.savedAt.slice(0, 10)]), [[40, 2, TODAY]], "saved today");
      tab.answers.push(false);
      await p.click(`${M} [data-vial-again][data-med="tirzepatide"]`);
      eq((await exportBackup(tab)).vials.length, 1, "Cancel changes nothing");

      // Tomorrow's dose logged: it comes out of the vial.
      await tab.ctx.clock.fastForward(DAY_MS);
      await p.waitForSelector(`${M} #doseOverlay.open`);
      await p.click(`${M} #doseLogBtn`);
      const after = await card(tab, "tirzepatide");
      eq([after.head, after.dates.slice(1, 3)], ["4 doses left + 2.5 mg", [["Last dose", "Thu, Oct 29"], ["New vial by", "Thu, Nov 5"]]], "one dose fewer, the same dates");
      eq(await nextDay(tab, "tirzepatide"), "Thursday, Oct 8", "the next dose a week on: its weekday");
    }
  },
  {
    name: "bosco vial: past its expiry the dates stop there and a warning says what goes unused; expired; used up; Known mg/mL; Change vial; on a phone",
    async run(t) {
      const tab = await open(t, { app: "bosco", size: DESKTOP });
      // Retatrutide 2 mg a week, doses Sep 16 and 23, one due today; a 20 mg vial mixed Sep 16: 16 mg left, 8 doses, but it
      // expires 6 weeks after mixing (Oct 28): 5 doses (today to Oct 28), 6 mg unused.
      await importBackup(tab, world({ medication: "retatrutide", weeklyMg: 2, lastDose: D(-7), doses: 2 }, { mgPerMl: 10, vialMg: 20, bacMl: 2, savedAt: noon(-14) }));
      eq(await card(tab, "retatrutide"), { head: "8 doses left", sub: "10 mg/mL|20 mg + 2 mL",
        dates: [["Mixed", "Wed, Sep 16"], ["Last dose", "Wed, Oct 28"], ["New vial by", "Wed, Nov 4"], ["Expires!", "Wed, Oct 28"]],
        warn: "Expires 6 weeks after mixing, before it's used up: 6 mg will go unused.", amber: false }, "stops at its expiry");
      eq(await nextDay(tab, "retatrutide"), "Today, Sep 30", "the next dose today");

      // Mixed 7 weeks ago: expired, amber, a new one needed by today's dose.
      const tab3 = await open(t, { app: "bosco", size: DESKTOP });
      await importBackup(tab3, world({ medication: "retatrutide", weeklyMg: 2, lastDose: D(-7), doses: 2 }, { mgPerMl: 10, vialMg: 20, bacMl: 2, savedAt: noon(-49) }));
      eq(await card(tab3, "retatrutide"), { head: "Vial expired 8 doses unused", sub: "10 mg/mL|20 mg + 2 mL",
        dates: [["Mixed", "Wed, Aug 12"], ["New vial by", "Wed, Sep 30"], ["Expired!", "Wed, Sep 23"]], warn: "Past its 6 weeks: mix a new one.", amber: true }, "expired");

      // A 15 mg Tirzepatide vial, two 7.5 mg doses since it was mixed: used up, amber.
      const tab2 = await open(t, { app: "bosco", size: PHONE }), p2 = tab2.page;
      await importBackup(tab2, world({ weeklyMg: 7.5, lastDose: D(-6), doses: 3 }, { mgPerMl: 10, vialMg: 15, bacMl: 1.5, savedAt: noon(-13) }));
      eq(await card(tab2, "tirzepatide"), { head: "Vial used up", sub: "10 mg/mL|15 mg + 1.5 mL",
        dates: [["Mixed", "Thu, Sep 17"], ["New vial by", "Thu, Oct 1"], ["Expires", "Thu, Dec 10"]], warn: "", amber: true }, "used up");
      eq(await p2.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, "fits a phone");
      // One dose left: amber too.
      const tab4 = await open(t, { app: "bosco", size: PHONE }), p4 = tab4.page;
      await importBackup(tab4, world({ weeklyMg: 7.5, lastDose: D(-6), doses: 3 }, { mgPerMl: 10, vialMg: 22.5, bacMl: 2.25, savedAt: noon(-13) }));
      eq([(await card(tab4, "tirzepatide")).head, (await card(tab4, "tirzepatide")).amber], ["1 dose left", true], "one left");

      // Change vial: asked first, before anything opens; Cancel leaves the page as it was.
      tab4.answers.push(false);
      await p4.click(`${M} [data-change-vial][data-med="tirzepatide"]`);
      has(lastDialog(tab4), "Saving starts a new vial mixed today", "asked first");
      eq([await p4.locator(`${M} #oneTimeInfoSection`).isHidden(), await p4.locator(`${M} #vialEditor`).isHidden()], [true, true], "Cancel: start-up info stays closed");
      // OK: start-up info's calculator, its recipe filled in, without asking again.
      await p4.click(`${M} [data-change-vial][data-med="tirzepatide"]`);
      eq(tab4.dialogs.length, 1, "asked once");
      has(lastDialog(tab4), "Saving starts a new vial mixed today", "the same question");
      eq([await p4.locator(`${M} #vialEditor`).isVisible(), await p4.locator(`${M} #vialMgInput`).inputValue()], [true, "22.5"], "the calculator, its recipe");

      // Known mg/mL: no total, so no count and no dates but its expiry.
      const tab5 = await open(t, { app: "bosco", size: DESKTOP });
      await importBackup(tab5, world({ lastDose: D(-5) }, { mgPerMl: 10, vialMg: null, bacMl: null, savedAt: noon(-3) }));
      const known = await card(tab5, "tirzepatide");
      eq(known, { head: "10 mg/mL", sub: "Known strength", dates: [["Mixed", "Sun, Sep 27"], ["Expires", "Sun, Dec 20"]], warn: "", amber: false }, "Known mg/mL");
      lacks(known.head, "left", "no count");

      // A last dose History's first page no longer shows: a line atop its panel; its next dose late, by its weekday.
      const tab6 = await open(t, { app: "bosco", size: PHONE });
      const weights = Array.from({ length: 8 }, (_, i) => ({ date: D(i - 7), weight: 200 - i / 10 }));
      await importBackup(tab6, world({ lastDose: D(-8), doses: 2, weights }, { mgPerMl: 10, vialMg: 20, bacMl: 2, savedAt: noon(-8) }));
      eq(await tab6.page.textContent(`${M} #upcomingDosesSection .last-taken`), "Last dose taken: 5 mg|Sep 22", "the last dose taken");
      eq(await nextDay(tab6, "tirzepatide"), "Tuesday, Sep 29", "a late dose: its weekday");
      eq((await card(tab6, "tirzepatide")).head, "3 doses left", "its vial");
    }
  }
];
