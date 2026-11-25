/* Kyoshi · tests/bosco-medications.test.js — Bosco's GLP-1 medications taken side by side (10.137, the owner's request:
 * Tirzepatide and Retatrutide at once): start-up info picks as many as you take, and shows each one's dosing (its plan,
 * anchor dose and active vial) a button each, what's typed kept while another shows; each has its own schedule (days
 * between, weekly dose) and its own Upcoming section (its next dose, 10.237 on) with its vial's units; every medication's doses go through the
 * injection sites in one rotation, in the order they fall (two the same day on opposite sides); the pop-up asks about
 * one due dose at a time (Not yet on one, the other asks); History lists a day's doses in one row, and deleting it names
 * them; Export carries each medication's plan and vial and a day's other doses (`more`), the first medication's as
 * before for older copies; Momo's board has each one's doses ("dose:<date>" for the first, "dose:<med>:<date>" for
 * another's); two devices each logging another medication the same day keep both, and an older copy's save (no list,
 * no `more`) loses neither. */
"use strict";
const { TODAY, DESKTOP, PHONE, eq, has, open, importBackup, exportBackup, addDays, lastDialog } = require("./lib");
const gen = require("./generate");

const M = "#kMount";
const D = n => addDays(TODAY, n);

// The Upcoming sections: [heading, its vial card's strength, [[date, dose, site]] of its next dose] each.
const sections = tab => tab.page.$$eval(`${M} #upcomingDosesSection section`, ss => ss.map(s => [
  s.querySelector("h2").textContent, (s.querySelector(".vial-stat .lbl") || { textContent: "" }).textContent.split("|")[0],
  [...s.querySelectorAll(".next-dose")].map(c => [c.querySelector(".val .nowrap").textContent, (c.querySelector(".dose") || { textContent: "" }).textContent,
    (c.querySelector(".lbl.site") || { textContent: "" }).textContent])
]));
// A medication's doses worked out ahead (the schedule's three): [date, site].
const ahead = (tab, med) => tab.page.evaluate(m => Kyoshi.apps.bosco.doseSchedule(m).map(d => [d.date, Kyoshi.apps.bosco.siteLabel(d.site)]), med);
// The dose pop-up: open, its text, its dose and units, its site picked.
const popup = tab => tab.page.evaluate(m => {
  const o = document.querySelector(`${m} #doseOverlay`), sel = o.querySelector("#doseSiteSelect");
  return { open: o.classList.contains("open"), text: o.querySelector("#doseModalText").textContent, mg: o.querySelector("#doseModalMg").textContent,
    units: o.querySelector("#doseModalUnits").hidden ? "" : o.querySelector("#doseModalUnits").textContent, site: sel.selectedOptions[0] ? sel.selectedOptions[0].textContent : "" };
}, M);
const history = tab => tab.page.$$eval(`${M} #historyBody tr`, rows => rows.map(r => [r.cells[0].textContent.trim(), r.cells[3].innerText.trim()]));
// Start-up info's dosing: the medication buttons [text, lit], its heading, and its fields.
const dosing = tab => tab.page.evaluate(m => {
  const q = s => document.querySelector(`${m} ${s}`);
  return { meds: [...q("#dosingMedToggle").children].map(b => [b.textContent, b.classList.contains("active")]), shown: !q("#dosingMedToggle").hidden,
    title: q("#dosingTitle").textContent, every: q("#doseIntervalInput").value, weekly: q("#weeklyDoseInput").value, vialMg: q("#vialEditor").hidden ? null : q("#vialMgInput").value };
}, M);
const bugLine = (tab, start) => tab.page.evaluate(s => Kyoshi.apps.bosco.bugState().find(l => l.startsWith(s)), start);
// Bosco's events on Momo's board on those days: [id, title, note, done].
const board = (tab, from, to) => tab.page.evaluate(([f, t]) => Kyoshi.agenda(f, t).filter(e => e.app === "bosco").map(e => [e.id, e.title, e.note, e.done]), [from, to]);
// Sync's combine of a save (raw) as the other device's, the newer one; true if it changed anything here.
const combine = (tab, raw) => tab.page.evaluate(r => {
  const A = Kyoshi.apps.bosco, c = A.data.combine(r, { replace: false, plain: false, mine: { savedAt: "1", device: "a" }, theirs: { savedAt: "2", device: "b" } });
  const changed = c.apply();
  if (changed) A.data.afterSync();
  return changed;
}, raw);

// Tirzepatide weekly (its last dose a week ago: one due today) and Retatrutide every 5 days from today (its anchor
// dose), start-up info answered: both due today.
function both() {
  const base = gen.bosco({ lastDose: D(-7) });
  return { ...base, name: "Sam", paceGoal: { dir: "lose", weeklyPct: 1, rangePct: 0.25 }, asked: { medication: true, dosing: 4 },
    medications: ["tirzepatide", "retatrutide"],
    dosePlans: [base.dosePlan, { medication: "retatrutide", intervalDays: 5, weeklyMg: 2.8, doseTime: null, nextDose: { after: "", date: TODAY }, savedAt: "2026-01-05T00:00:00.000Z" }],
    vials: [{ medication: "retatrutide", mgPerMl: 10, vialMg: 20, bacMl: 2, savedAt: "2026-01-05T00:00:00.000Z" }] };
}

module.exports = [
  {
    name: "bosco medications: two picked in start-up info, each its dosing and vial; an Upcoming section each, one site rotation; the pop-up one at a time; History, Export, Momo, delete",
    async run(t) {
      const tab = await open(t, { app: "bosco", size: DESKTOP }), p = tab.page;
      // Tirzepatide due today; its pop-up waits (Not yet) while start-up info is answered.
      await importBackup(tab, gen.bosco({ lastDose: D(-7) }));
      eq((await popup(tab)).open, true, "Tirzepatide's dose asks");
      await p.click(`${M} #doseSnoozeBtn`);
      eq((await popup(tab)).open, false, "not yet");
      await p.evaluate(() => Kyoshi.apps.bosco.renderOneTimeInfo(true)); // as Developer Mode's Edit start-up info (the doses answered the medication)
      eq(await dosing(tab), { meds: [["Tirzepatide", true]], shown: false, title: "Tirzepatide dosing", every: "7", weekly: "5", vialMg: null }, "one medication: no buttons");

      // Retatrutide too: a button each; Tirzepatide's dosing as saved, Retatrutide's empty.
      await p.click(`${M} #oneTimeInput_medication button[data-pick="retatrutide"]`);
      eq(await p.$$eval(`${M} #oneTimeInput_medication button.active`, bs => bs.map(b => b.textContent)), ["Tirzepatide", "Retatrutide"], "both lit");
      let d = await dosing(tab);
      eq([d.meds, d.shown, d.title], [[["Tirzepatide", true], ["Retatrutide", false]], true, "Tirzepatide dosing"], "a button each");
      await p.click(`${M} #dosingMedToggle button[data-dosing-med="retatrutide"]`);
      eq(await dosing(tab), { meds: [["Tirzepatide", false], ["Retatrutide", true]], shown: true, title: "Retatrutide dosing", every: "", weekly: "", vialMg: null }, "Retatrutide's, empty");
      // Its own schedule (every 5 days, 2.8 mg a week: 2 mg a dose) from an anchor dose today, and its own vial.
      await p.fill(`${M} #doseIntervalInput`, "5");
      await p.fill(`${M} #weeklyDoseInput`, "2.8");
      await p.click(`${M} #setAnchorBtn`);
      await p.fill(`${M} #anchorDateInput`, TODAY);
      await p.click(`${M} #changeVialBtn`);
      await p.fill(`${M} #vialMgInput`, "20");
      has(await p.locator(`${M} #eachDoseNote`).innerText(), "2 mg", "each dose");
      // What's typed stays while Tirzepatide's shows.
      await p.click(`${M} #dosingMedToggle button[data-dosing-med="tirzepatide"]`);
      eq(await dosing(tab), { meds: [["Tirzepatide", true], ["Retatrutide", false]], shown: true, title: "Tirzepatide dosing", every: "7", weekly: "5", vialMg: null }, "Tirzepatide's as saved");
      await p.click(`${M} #dosingMedToggle button[data-dosing-med="retatrutide"]`);
      d = await dosing(tab);
      eq([d.every, d.weekly, d.vialMg], ["5", "2.8", "20"], "Retatrutide's as typed");
      eq(await p.inputValue(`${M} #anchorDateInput`), TODAY, "its anchor dose too");
      await p.fill(`${M} #oneTimeInput_name`, "Sam");
      await p.click(`${M} #oneTimeInfoSaveBtn`);
      eq(await p.locator(`${M} #oneTimeInfoSection`).isHidden(), true, "saved");

      // An Upcoming section each, on its own schedule, Retatrutide's units from its vial (10 mg/mL). Both today: one
      // rotation, so on opposite sides (Tirzepatide's first, the order the medications are listed in).
      const ABD0 = "Abdomen · left, upper", TH1 = "Thigh · right outer, middle", TH2 = "Thigh · left outer, lower";
      let s = await sections(tab);
      eq(s.map(x => [x[0], x[1]]), [["Next Tirzepatide Dose", ""], ["Next Retatrutide Dose", "10 mg/mL"]], "a section each, its vial");
      eq(s.map(x => x[2].map(c => c[0])), [["Sep 30"], ["Sep 30"]], "the next dose only");
      eq((await ahead(tab, "tirzepatide")).map(d => d[0]), [TODAY, D(7), D(14)], "Tirzepatide weekly");
      eq((await ahead(tab, "retatrutide")).map(d => d[0]), [TODAY, D(5), D(10)], "Retatrutide every 5 days");
      eq(s[1][2][0][1], "2 mg|20 units", "its units");
      eq([s[0][2][0][2], s[1][2][0][2], (await ahead(tab, "retatrutide"))[1][1]], [ABD0, TH1, TH2], "one rotation: today's on opposite sides, then on");
      eq(await bugLine(tab, "- GLP-1"), "- GLP-1 medication: tirzepatide, retatrutide", "the bug report's medications");
      eq(await bugLine(tab, "- Dosing plan"), "- Dosing plan / active vial saved: yes, yes / no, yes", "and their plans and vials");

      // Tirzepatide's put off: Retatrutide's asks. Logged, Tirzepatide's asks once its hour is up, on the other side.
      let pop = await popup(tab);
      eq([pop.open, pop.mg, pop.units, pop.site], [true, "2 mg", "20 units on a U‑100 syringe", TH1], "Retatrutide's asks, at its card's site");
      has(pop.text, "Retatrutide dose", "named");
      await p.click(`${M} #doseLogBtn`);
      eq((await popup(tab)).open, false, "logged; Tirzepatide's still put off");
      await tab.ctx.clock.fastForward(3600000 + 61000);
      pop = await popup(tab);
      eq([pop.open, pop.mg, pop.units, pop.site], [true, "5 mg", "", ABD0], "then Tirzepatide's (no vial), at its card's, on the other side");
      has(pop.text, "Tirzepatide dose", "named");
      await p.click(`${M} #doseLogBtn`);
      eq((await popup(tab)).open, false, "both logged");
      eq(await p.locator(`${M} #doseColumnHead`).textContent(), "Doses", "History's column");
      eq((await history(tab))[0], ["Sep 30", "2 mg (Retatrutide)|Thigh R outer middle\n5 mg (Tirzepatide)|Abd L upper"], "both in one row, in the order logged");
      s = await sections(tab);
      eq([s[0][2][0][0], s[1][2][0][0]], ["Oct 7", "Oct 5"], "each on from its own dose");

      // Export: each medication's plan and vial, the day's other dose; the first medication's as before, for older copies.
      const backup = await exportBackup(tab), day = backup.entries.find(e => e.date === TODAY);
      eq([backup.medication, backup.medications, backup.dosePlan.medication, backup.vial], ["tirzepatide", ["tirzepatide", "retatrutide"], "tirzepatide", null], "the first's as before");
      eq([backup.dosePlans.map(x => [x.medication, x.intervalDays, x.weeklyMg]), backup.vials.map(x => [x.medication, x.mgPerMl])],
        [[["tirzepatide", 7, 5], ["retatrutide", 5, 2.8]], [["retatrutide", 10]]], "each medication's");
      eq([day.doseMg, day.medication, day.site, day.more.map(x => [x.doseMg, x.medication, x.site])], [2, "retatrutide", "thigh-r-side-middle", [[5, "tirzepatide", "abd-l-upper"]]], "the day's doses");

      // Momo's board: each one's doses, the first's ids as before.
      eq(await board(tab, D(0), D(7)), [["dose:retatrutide:2026-09-30", "Retatrutide dose", "2 mg", true], ["dose:2026-09-30", "Tirzepatide dose", "5 mg", true],
        ["dose:retatrutide:2026-10-05", "Retatrutide dose", "2 mg", false], ["dose:2026-10-07", "Tirzepatide dose", "5 mg", false]], "each one's, done and to come");

      // Deleting the day names both doses (No keeps them).
      tab.answers.push(false);
      await p.click(`${M} #historyBody button[data-date="${TODAY}"]`);
      has(lastDialog(tab), "Delete the 2 mg Retatrutide and 5 mg Tirzepatide doses logged", "both named");
      eq((await history(tab))[0][0], "Sep 30", "kept");

      // Imported on a phone: as it was here, nothing asked.
      const phone = await open(t, { app: "bosco", size: PHONE });
      await importBackup(phone, backup);
      eq([(await history(phone))[0], await phone.page.locator(`${M} #oneTimeInfoSection`).isHidden()], [(await history(tab))[0], true], "the same day, start-up info answered");
      eq((await sections(phone)).map(x => x[0]), ["Next Tirzepatide Dose", "Next Retatrutide Dose"], "both sections");
    }
  },
  {
    name: "bosco medications: two devices each log another medication the same day and keep both; an older copy's save loses neither; None, then one medication again",
    async run(t) {
      // Two devices with both due today.
      const one = await open(t, { app: "bosco", size: DESKTOP }), two = await open(t, { app: "bosco", size: PHONE });
      await importBackup(one, both());
      await importBackup(two, both());
      // The computer logs Tirzepatide's (it asks first) and puts off Retatrutide's; the phone puts off Tirzepatide's and logs Retatrutide's.
      has((await popup(one)).text, "Tirzepatide", "the computer: Tirzepatide's first");
      await one.page.click(`${M} #doseLogBtn`);
      has((await popup(one)).text, "Retatrutide", "then Retatrutide's");
      await one.page.click(`${M} #doseSnoozeBtn`);
      await two.page.click(`${M} #doseSnoozeBtn`);
      has((await popup(two)).text, "Retatrutide", "the phone: Retatrutide's next");
      await two.page.click(`${M} #doseLogBtn`);
      eq([(await history(one))[0][1], (await history(two))[0][1]], ["5 mg (Tirzepatide)|Abd L upper", "2 mg (Retatrutide)|Thigh R outer middle"], "one each, at their cards' sites");

      // Combined: both, in the order logged; neither asks again.
      const save = d => d.page.evaluate(() => JSON.parse(JSON.stringify(Kyoshi.apps.bosco.data.build())));
      eq(await combine(two, await save(one)), true, "combined");
      const row = (await history(two))[0][1];
      has(row, "5 mg (Tirzepatide)", "Tirzepatide's");
      has(row, "2 mg (Retatrutide)", "Retatrutide's");
      eq((await sections(two)).map(x => x[2][0][0]), ["Oct 7", "Oct 5"], "neither due");

      // An older copy's save (before 10.137: one medication, one plan and vial, a day's first dose only) loses neither.
      const older = await save(one);
      delete older.medications; delete older.dosePlans; delete older.vials;
      older.entries.forEach(e => delete e.more);
      await combine(two, older);
      const kept = (await exportBackup(two)).entries.find(e => e.date === TODAY);
      eq([kept.medication, (kept.more || []).map(x => x.medication)].flat().sort(), ["retatrutide", "tirzepatide"], "both doses kept");
      eq((await exportBackup(two)).dosePlans.map(x => x.medication), ["tirzepatide", "retatrutide"], "both plans kept");

      // None: no sections. One medication again: its doses only, History names the other's as before.
      const p = one.page;
      await one.page.evaluate(() => { Kyoshi.apps.bosco.renderOneTimeInfo(true); });
      await p.click(`${M} #oneTimeInput_medication button[data-pick="none"]`);
      eq(await p.$$eval(`${M} #oneTimeInput_medication button.active`, bs => bs.map(b => b.textContent)), ["None"], "None alone");
      eq(await p.locator(`${M} #dosingBox`).isHidden(), true, "no dosing");
      await p.click(`${M} #oneTimeInput_medication button[data-pick="retatrutide"]`);
      eq(await p.$$eval(`${M} #oneTimeInput_medication button.active`, bs => bs.map(b => b.textContent)), ["Retatrutide"], "None off");
      await p.click(`${M} #oneTimeInfoSaveBtn`);
      eq((await sections(one)).map(x => x[0]), ["Next Retatrutide Dose"], "its section only");
      eq([await p.locator(`${M} #doseColumnHead`).textContent(), (await history(one))[0][1]], ["Retatrutide Dose", "5 mg (Tirzepatide)|Abd L upper"], "the other's named");
      eq((await exportBackup(one)).medication, "retatrutide", "the first medication now");
    }
  }
];
