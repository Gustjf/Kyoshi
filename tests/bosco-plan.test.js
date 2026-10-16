/* Kyoshi · tests/bosco-plan.test.js — Bosco's dosing plan and its doses: start-up info's dosing (days between doses and
 * the weekly dose checked as typed, each dose worked out, the usual dose time), the vial calculator (vial mg + BAC water,
 * or a known mg/mL; checked; one active vial, changing it asks), the anchor dose (nothing to count from until one is set;
 * never on or before the last dose, and one sooner than the days between doses asks); the schedule it makes (each dose
 * in syringe units, due at the usual time, Momo's board with them); and the dose pop-up as days go by: Not yet and Esc put
 * it off an hour, a late one is logged on its day or today, Postpone moves it to tomorrow, and one three intervals old is
 * missed. */
"use strict";
const { TODAY, DESKTOP, eq, has, open, importBackup, exportBackup, lastDialog, at } = require("./lib");
const { M, D, history, doseCards, dosePopup, startupShown, saveStartup, editStartup, bugLine, saved } = require("./bosco");
const gen = require("./generate");

// Start-up info's dosing, as shown: its title, the fields, the notes under them, the anchor's line and the vial's.
const dosing = tab => tab.page.evaluate(m => {
  const $ = id => document.querySelector(`${m} #${id}`), note = id => ($(id).hidden ? "" : $(id).textContent);
  return {
    title: $("dosingTitle").textContent, every: $("doseIntervalInput").value, weekly: $("weeklyDoseInput").value, time: $("doseTimeInput").value,
    each: note("eachDoseNote"), anchor: $("anchorSummary").textContent, vial: $("vialSummary").hidden ? null : $("vialSummaryText").textContent,
    units: note("vialUnitsNote"), calc: $("vialEditor").hidden ? null : note("vialCalcNote")
  };
}, M);
const fill = (tab, id, value) => tab.page.fill(`${M} #${id}`, String(value));
// The doses on Momo's board on those days (Bosco's): [id, time, minutes, note, done].
const board = (tab, from, to) => tab.page.evaluate(([f, t]) => Kyoshi.agenda(f, t).filter(e => e.app === "bosco").map(e => [e.id, e.time, e.minutes, e.note, e.done]), [from, to]);
const travel = (tab, days) => tab.page.evaluate(n => Kyoshi.dev.travel(n), days); // the pop-up may cover Developer Mode's badge

module.exports = [
  {
    name: "bosco plan: the dosing plan and vial in start-up info, checked as typed; the anchor dose starts the schedule, in syringe units, due at the usual time; Momo's board",
    async run(t) {
      const tab = await open(t, { app: "bosco", size: DESKTOP }), p = tab.page;
      // A weigh-in and Tirzepatide's plan (every 7 days, 5 mg a week), no dose yet: nothing to count from.
      await importBackup(tab, gen.bosco({ doses: 0, weights: [{ date: D(-1), weight: 190 }] }));
      eq(await startupShown(tab), [true, true], "start-up info asks, with the dosing");
      eq(await dosing(tab), { title: "Tirzepatide dosing", every: "7", weekly: "5", time: "", each: "Each dose: 5 mg", anchor: "No dose to count from yet.", vial: "No active vial yet.",
        units: "", calc: null }, "the plan as it stands");
      eq(await doseCards(tab), [], "no dose scheduled");
      has(await p.locator(`${M} #upcomingDosesGrid`).innerText(), "No dose to count from yet.", "the upcoming doses say why");

      // Checked as typed: days between doses a whole number up to 14, a positive weekly dose; each dose as typed.
      await fill(tab, "doseIntervalInput", 15);
      await saveStartup(tab);
      eq(lastDialog(tab), "Days between doses must be a whole number from 1 to 14.", "15 days");
      await fill(tab, "doseIntervalInput", 3);
      await fill(tab, "weeklyDoseInput", -5);
      eq((await dosing(tab)).each, "", "no dose from a negative weekly dose");
      await saveStartup(tab);
      eq(lastDialog(tab), "Please enter a valid positive weekly dose, or leave it blank.", "a negative weekly dose");
      eq(await startupShown(tab), [true, true], "nothing saved: still asked");
      await fill(tab, "weeklyDoseInput", 5);
      await fill(tab, "doseTimeInput", "08:00");
      eq((await dosing(tab)).each, "Each dose: 2.143 mg", "5 mg a week every 3 days");

      // The vial calculator: 10 mg with 2 mL of BAC water (the slider's start) is 5 mg/mL; a known mg/mL with more than
      // three decimals is refused; 2.5 mg/mL saved.
      await p.click(`${M} #changeVialBtn`);
      await fill(tab, "vialMgInput", 10);
      eq((await dosing(tab)).calc, "Concentration: 5 mg/mL|2.143 mg = 43 units (42.86) on a U‑100 syringe", "mixed");
      await p.click(`${M} #vialModeToggle button[data-vial-mode="known"]`);
      await fill(tab, "vialConcInput", "2.5555");
      await p.click(`${M} #saveVialBtn`);
      eq(lastDialog(tab), "Enter the concentration in mg per mL, with up to three decimal places.", "four decimals");
      await fill(tab, "vialConcInput", "2.5");
      eq((await dosing(tab)).calc, "2.143 mg = 85.5 units (85.72) on a U‑100 syringe", "known");
      await p.click(`${M} #saveVialBtn`);
      let d = await dosing(tab);
      eq([d.vial, d.units, d.calc], ["2.5 mg/mL|saved Sep 30", "2.143 mg = 85.5 units (85.72) on a U‑100 syringe", null], "the active vial");
      // Changing it asks first (only one vial is active); No keeps it.
      tab.answers.push(false);
      await p.click(`${M} #changeVialBtn`);
      eq(lastDialog(tab), "Change your active Tirzepatide vial (2.5 mg/mL)? Upcoming doses work out their syringe units from it, so only change it when you start a new vial.", "asked");
      eq((await dosing(tab)).calc, null, "the calculator stays closed");

      // The anchor dose: today. Saved, the schedule starts from it, every 3 days, at 8 AM.
      await p.click(`${M} #setAnchorBtn`);
      await fill(tab, "anchorDateInput", TODAY);
      await saveStartup(tab);
      eq(await startupShown(tab), [false, false], "answered");
      eq(await doseCards(tab), [["Wednesday", "Sep 30", "2.143 mg|85.5 units (85.72)", false], ["Saturday", "Oct 3", "2.143 mg|85.5 units (85.72)", false],
        ["Tuesday", "Oct 6", "2.143 mg|85.5 units (85.72)", false]], "the doses, in syringe units, not due before 8 AM");
      eq(await board(tab, TODAY, D(6)), [["dose:2026-09-30", "08:00", 15, "2.143 mg", false], ["dose:2026-10-03", "08:00", 15, "2.143 mg", false], ["dose:2026-10-06", "08:00", 15, "2.143 mg", false]],
        "Momo's board: each at the usual time");
      eq(await bugLine(tab, "- Dosing plan"), "- Dosing plan / active vial saved: yes / yes", "the bug line");
      const backup = await exportBackup(tab);
      eq([backup.dosePlan.intervalDays, backup.dosePlan.weeklyMg, backup.dosePlan.doseTime, backup.dosePlan.nextDose], [3, 5, "08:00", { after: "", date: TODAY }], "Export's plan");
      eq([backup.vial.medication, backup.vial.mgPerMl, backup.vial.vialMg, backup.vial.bacMl], ["tirzepatide", 2.5, null, null], "Export's vial");

      // 8:01 AM: due. The pop-up says when and how much; logged, Momo's board has it done.
      await tab.ctx.clock.fastForward(at(TODAY, "08:01") - at(TODAY));
      const pop = await dosePopup(tab);
      eq([pop.open, pop.text, pop.buttons], [true, "Your Tirzepatide dose was due Wednesday, Sep 30 at 8:00 AM. It goes in your log once you confirm it.", ["Log dose", "Not yet", "Postpone to tomorrow"]], "the pop-up");
      eq(await p.evaluate(m => [document.querySelector(`${m} #doseModalMg`).textContent, document.querySelector(`${m} #doseModalUnits`).textContent, document.querySelector(`${m} #doseModalVial`).textContent], M),
        ["2.143 mg", "85.5 units (85.72) on a U‑100 syringe", "Vial 2.5 mg/mL"], "the dose, its units, the vial they're from");
      eq(await p.evaluate(() => Kyoshi.apps.bosco.attention()), "a dose is waiting to be confirmed", "the switcher's dot");
      await p.click(`${M} #doseLogBtn`);
      eq((await board(tab, TODAY, TODAY))[0][4], true, "done on Momo's board");
      eq((await saved(tab)).cumulativeDoseMgByMedication, { tirzepatide: 2.14 }, "the total taken, to the hundredth");
    }
  },
  {
    name: "bosco plan: the anchor dose is never on or before the last dose, asks when sooner than the days between doses, and moves the schedule",
    async run(t) {
      const tab = await open(t, { app: "bosco", size: DESKTOP }), p = tab.page;
      // The last dose two days ago, every 7 days: the next on Oct 5.
      await importBackup(tab, gen.bosco({ lastDose: D(-2) }));
      eq((await doseCards(tab)).map(c => c[1]), ["Oct 5", "Oct 12", "Oct 19"], "counting from the last dose");
      await editStartup(tab);
      eq((await dosing(tab)).anchor, "Counting from your last dose, Monday, Sep 28.", "the anchor's line");
      await p.click(`${M} #setAnchorBtn`);
      await fill(tab, "anchorDateInput", D(-2));
      await saveStartup(tab);
      eq(lastDialog(tab), "An anchor dose has to come after your last dose (Sep 28, 2026).", "on the last dose's day");
      await fill(tab, "anchorDateInput", D(1));
      tab.answers.push(false);
      await saveStartup(tab);
      eq(lastDialog(tab), "Your last dose was Sep 28, 2026, only 3 days before this anchor dose, and your doses are 7 days apart. Set the anchor dose anyway?", "sooner: asked");
      eq((await startupShown(tab))[0], true, "No: nothing saved");
      await saveStartup(tab); // Yes
      eq((await doseCards(tab)).map(c => c[1]), ["Oct 1", "Oct 8", "Oct 15"], "from the anchor dose");
      await editStartup(tab);
      eq((await dosing(tab)).anchor, "Next dose set for Thursday, Oct 1.", "the anchor's line");
      eq((await saved(tab)).dosePlan.nextDose, { after: D(-2), date: D(1) }, "kept with the plan");
    }
  },
  {
    name: "bosco plan: the dose pop-up as days go by — Not yet and Esc for an hour, late (on its day or today), Postpone to tomorrow, missed ones after three",
    async run(t) {
      const tab = await open(t, { app: "bosco", size: DESKTOP }), p = tab.page;
      await importBackup(tab, gen.bosco({ lastDose: D(-7) })); // today's due (no usual time: from the start of the day)
      eq((await dosePopup(tab)).open, true, "today's due");
      // Not yet: an hour; Esc: the same.
      await p.click(`${M} #doseSnoozeBtn`);
      eq([(await dosePopup(tab)).open, await p.evaluate(() => Kyoshi.apps.bosco.attention())], [false, ""], "put off, no dot");
      eq((await doseCards(tab))[0][3], true, "its card still due");
      await tab.ctx.clock.fastForward(59 * 60000);
      eq((await dosePopup(tab)).open, false, "not within the hour");
      await tab.ctx.clock.fastForward(2 * 60000);
      eq((await dosePopup(tab)).open, true, "asked again after it");
      await p.keyboard.press("Escape");
      eq((await dosePopup(tab)).open, false, "Esc puts it off too");
      await p.click(`${M} #upcomingDosesGrid button[data-confirm-dose]`);
      eq((await dosePopup(tab)).open, true, "Confirm dose on its card opens it at once");
      await p.click(`${M} #doseSnoozeBtn`);

      // The next day: late. Took it today logs it today, and the schedule counts on from today.
      await travel(tab, 1);
      let pop = await dosePopup(tab);
      eq([pop.text.split(".")[0], pop.buttons], ["Your Tirzepatide dose was due Wednesday, Sep 30", ["Took it Wednesday", "Took it today", "Not yet", "Postpone to tomorrow"]], "late");
      await p.click(`${M} #doseTodayBtn`);
      eq((await history(tab))[0][0], "Oct 1", "logged today");
      eq((await doseCards(tab)).map(c => c[1]), ["Oct 8", "Oct 15", "Oct 22"], "on from today");

      // A week on: Postpone to tomorrow moves it and the ones after; nothing logged.
      await travel(tab, 7);
      eq((await dosePopup(tab)).open, true, "Oct 8's due");
      await p.click(`${M} #dosePostponeBtn`);
      eq([(await dosePopup(tab)).open, (await doseCards(tab)).map(c => [c[1], c[3]])], [false, [["Oct 9", false], ["Oct 16", false], ["Oct 23", false]]], "a day later");
      eq([(await saved(tab)).dosePlan.nextDose, (await history(tab))[0][0]], [{ after: "2026-10-01", date: "2026-10-09" }, "Oct 1"], "kept with the plan, nothing logged");

      // A month without: the last three still asked for (the older ones missed), the earliest first, by its date.
      await travel(tab, 30);
      eq((await doseCards(tab)).map(c => [c[1], c[3]]), [["Oct 23", true], ["Oct 30", true], ["Nov 6", true]], "three due");
      pop = await dosePopup(tab);
      eq([pop.text.split(".")[0], pop.buttons[0]], ["Your Tirzepatide dose was due Friday, Oct 23", "Took it Oct 23"], "over a week late: by its date");
      await p.click(`${M} #doseLogBtn`);
      eq([(await history(tab))[0][0], (await doseCards(tab)).map(c => [c[1], c[3]])], ["Oct 23", [["Oct 30", true], ["Nov 6", true], ["Nov 13", false]]], "logged on its day; the next one asks");
      eq((await dosePopup(tab)).open, true, "Oct 30's");
    }
  }
];
