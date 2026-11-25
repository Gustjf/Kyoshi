/* Kyoshi · tests/bosco-vial.test.js — Bosco's vial card (the owner's request, 2026-11-25): beside each medication's next
 * dose (the only one shown), its active vial's strength, mg and BAC water, the day mixed (the day saved), the doses left
 * (and the mg over) counting every dose of its medication from the day mixed, the last dose it covers and the dose a new
 * vial is needed by; past its expiry (Tirzepatide 12 weeks, Retatrutide 6, Semaglutide 8, from mixing) the dates stop
 * there and a red line says how much goes unused; amber with a dose or none left, or expired; a Known mg/mL vial has no
 * count; Mixed a new one saves the same recipe today (asking first), Change vial opens start-up info's calculator. */
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
// A medication's vial card: its lines, amber or not, its warning ("" for none).
const card = (tab, med) => tab.page.evaluate(([m, med]) => {
  const c = document.querySelector(`${m} #upcomingDosesSection section[data-med="${med}"] .vial-stat`);
  return c && { lines: c.innerText.split("\n").map(l => l.trim()).filter(l => l && !/^(Mixed a new one|Change vial)$/.test(l)),
    amber: c.classList.contains("due"), warn: (c.querySelector(".vial-warn") || { textContent: "" }).textContent };
}, [M, med]);
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
      eq(await card(tab, "tirzepatide"), { lines: ["20 mg/mL", "40 mg + 2 mL", "Mixed Thu, Sep 10", "2 doses left + 2.5 mg",
        "Last dose Thu, Oct 8", "New vial by Thu, Oct 15", "Expires Thu, Dec 3"], amber: false, warn: "" }, "the card");

      // Mixed a new one: asked first, then the same recipe today, its doses left counted from today.
      await p.click(`${M} [data-vial-again][data-med="tirzepatide"]`);
      has(lastDialog(tab), "Mixed a new 40 mg + 2 mL Tirzepatide vial today?", "asked first");
      eq((await card(tab, "tirzepatide")).lines, ["20 mg/mL", "40 mg + 2 mL", "Mixed Wed, Sep 30", "5 doses left + 2.5 mg",
        "Last dose Thu, Oct 29", "New vial by Thu, Nov 5", "Expires Wed, Dec 23"], "a new vial today");
      eq((await exportBackup(tab)).vials.map(v => [v.vialMg, v.bacMl, v.savedAt.slice(0, 10)]), [[40, 2, TODAY]], "saved today");
      tab.answers.push(false);
      await p.click(`${M} [data-vial-again][data-med="tirzepatide"]`);
      eq((await exportBackup(tab)).vials.length, 1, "Cancel changes nothing");

      // Tomorrow's dose logged: it comes out of the vial.
      await tab.ctx.clock.fastForward(DAY_MS);
      await p.waitForSelector(`${M} #doseOverlay.open`);
      await p.click(`${M} #doseLogBtn`);
      eq((await card(tab, "tirzepatide")).lines.slice(3, 6), ["4 doses left + 2.5 mg", "Last dose Thu, Oct 29", "New vial by Thu, Nov 5"], "one dose fewer, the same dates");
    }
  },
  {
    name: "bosco vial: past its expiry the dates stop there and a warning says what goes unused; expired; used up; Known mg/mL; Change vial; on a phone",
    async run(t) {
      const tab = await open(t, { app: "bosco", size: DESKTOP });
      // Retatrutide 2 mg a week, doses Sep 16 and 23, one due today; a 20 mg vial mixed Sep 16: 16 mg left, 8 doses, but it
      // expires 6 weeks after mixing (Oct 28): 5 doses (today to Oct 28), 6 mg unused.
      await importBackup(tab, world({ medication: "retatrutide", weeklyMg: 2, lastDose: D(-7), doses: 2 }, { mgPerMl: 10, vialMg: 20, bacMl: 2, savedAt: noon(-14) }));
      eq(await card(tab, "retatrutide"), { lines: ["10 mg/mL", "20 mg + 2 mL", "Mixed Wed, Sep 16", "8 doses left", "Last dose Wed, Oct 28", "New vial by Wed, Nov 4",
        "Expires Wed, Oct 28, 6 weeks after mixing: 6 mg will go unused."], amber: false, warn: "Expires Wed, Oct 28, 6 weeks after mixing: 6 mg will go unused." }, "stops at its expiry");

      // Mixed 7 weeks ago: expired, amber, a new one needed by today's dose.
      const tab3 = await open(t, { app: "bosco", size: DESKTOP });
      await importBackup(tab3, world({ medication: "retatrutide", weeklyMg: 2, lastDose: D(-7), doses: 2 }, { mgPerMl: 10, vialMg: 20, bacMl: 2, savedAt: noon(-49) }));
      eq(await card(tab3, "retatrutide"), { lines: ["10 mg/mL", "20 mg + 2 mL", "Mixed Wed, Aug 12", "8 doses left", "New vial by Wed, Sep 30",
        "Expired Wed, Sep 23, 6 weeks after mixing."], amber: true, warn: "Expired Wed, Sep 23, 6 weeks after mixing." }, "expired");

      // A 15 mg Tirzepatide vial, two 7.5 mg doses since it was mixed: used up, amber.
      const tab2 = await open(t, { app: "bosco", size: PHONE }), p2 = tab2.page;
      await importBackup(tab2, world({ weeklyMg: 7.5, lastDose: D(-6), doses: 3 }, { mgPerMl: 10, vialMg: 15, bacMl: 1.5, savedAt: noon(-13) }));
      eq(await card(tab2, "tirzepatide"), { lines: ["10 mg/mL", "15 mg + 1.5 mL", "Mixed Thu, Sep 17", "Vial used up", "New vial by Thu, Oct 1", "Expires Thu, Dec 10"],
        amber: true, warn: "" }, "used up");
      eq(await p2.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, "fits a phone");
      // One dose left: amber too.
      const tab4 = await open(t, { app: "bosco", size: PHONE }), p4 = tab4.page;
      await importBackup(tab4, world({ weeklyMg: 7.5, lastDose: D(-6), doses: 3 }, { mgPerMl: 10, vialMg: 22.5, bacMl: 2.25, savedAt: noon(-13) }));
      eq([(await card(tab4, "tirzepatide")).lines[3], (await card(tab4, "tirzepatide")).amber], ["1 dose left", true], "one left");

      // Change vial: start-up info's calculator, asked first, its warning saying a new vial starts today.
      await p4.click(`${M} [data-change-vial][data-med="tirzepatide"]`);
      has(lastDialog(tab4), "Saving starts a new vial mixed today", "asked first");
      eq([await p4.locator(`${M} #vialEditor`).isVisible(), await p4.locator(`${M} #vialMgInput`).inputValue()], [true, "22.5"], "the calculator, its recipe");

      // Known mg/mL: no total, so no count and no dates but its expiry.
      const tab5 = await open(t, { app: "bosco", size: DESKTOP });
      await importBackup(tab5, world({ lastDose: D(-5) }, { mgPerMl: 10, vialMg: null, bacMl: null, savedAt: noon(-3) }));
      const known = await card(tab5, "tirzepatide");
      eq(known, { lines: ["10 mg/mL", "Active vial", "Mixed Sun, Sep 27", "Expires Sun, Dec 20"], amber: false, warn: "" }, "Known mg/mL");
      lacks(known.lines.join(" "), "left", "no count");
    }
  }
];
