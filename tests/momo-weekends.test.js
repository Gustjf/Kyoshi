/* Kyoshi · tests/momo-weekends.test.js — Momo's days off around a weekend (Phase 7 of plan_2026-10-05): a weekend's
 * pop-up takes days off before it (Friday, then Thursday…) and after it (Monday, then Tuesday…) by halves, the − / + by
 * half a day and the days they take in words under each; saved, the weekend's tile runs over them after a small gold sun,
 * its tooltip spelling them out, and each day off has the sun on the board's heading (this week's and next week's, never
 * the baseline's; faded for half a day: the afternoon before, the morning after; never a Saturday or Sunday) and on
 * Today's; the fold counts the days off ahead. Esc asks before discarding them, Enter saves, Clear takes them away (kept
 * as none, with its time), a number that isn't one is refused; Export and Import JSON keep them, an older backup (plans
 * only) and a damaged one import cleanly; two weekends reaching one day make it a whole day off; time travel moves
 * "ahead" on; on a phone Today's dates carry the sun and Before and After sit side by side.
 * PTO and sick time (Phase 7 of the 2026-10-06 feedback plan): set in Developer Mode's Time off block, they end both
 * folds' lines in 8-hour days by halves ("PTO 5½ days · Sick 2 days", "1 day 2h", below 0 in red); days off entered on a
 * weekend come off PTO from the day they were saved on (those ahead too, not those before), live in the pop-up as typed,
 * and come back when changed or cleared; the block's fields hold today's hours (saving them as they are changes nothing),
 * −½ day / −1 day, Enter saves, a field that isn't a number is refused, what's typed stays while Momo redraws, Clear asks
 * (kept as cleared, with its time) and Undo brings it back; Export and Import JSON keep it, an older backup has none, a
 * damaged one is kept within bounds; another tab's Save, and another device's save combined (the later wins, a Clear
 * too); on a phone the block fits; a week on, the days taken still count. */
"use strict";
const { TODAY, DESKTOP, PHONE, eq, ok, has, lacks, open, lastDialog, devPanel, importBackup, exportBackup, addDays, travel } = require("./lib");
const gen = require("./generate");
const mo = require("./momo");

const SAT = addDays(TODAY, 3); // this weekend's Saturday, Oct 3 (TODAY is Wednesday Sep 30)
const stored = (tab, sat = SAT) => tab.page.evaluate(s => Kyoshi.apps.momo.S.data.weekends[s] || null, sat);
const offs = async tab => (await mo.offMarks(tab)).map(m => m.off);
// The time off at the end of the fold's line ("· PTO 5½ days · Sick 2 days"; "" without), as kept, and what's shown in red.
const timeOffOf = s => (/· PTO .*$/.exec(s) || [""])[0];
const keptOff = tab => tab.page.evaluate(() => Kyoshi.apps.momo.S.data.timeOff);
const red = tab => tab.page.$$eval("#kMount :is(#boardView, #todayView) details.weekends summary .neg, #kMount #weekendPto .neg", els => els.filter(e => e.offsetParent).map(e => e.textContent));
// Both folds' time off: the board's, then Today's (back on the board after).
async function folds(tab) {
  const board = timeOffOf((await mo.weekends(tab)).summary);
  await mo.showToday(tab);
  const today = timeOffOf((await mo.weekends(tab)).summary);
  await mo.showBoard(tab);
  return [board, today];
}

module.exports = [
  {
    name: "momo weekends: days off before and after, its tile over them, a sun on the board and on Today, Clear, export and import",
    async run(t) {
      const tab = await open(t, { app: "momo", size: DESKTOP }), p = tab.page;

      // This weekend's pop-up: no days off at first, each saying which way it goes; nothing to clear.
      await mo.openWeekend(tab, SAT);
      let f = await mo.weekendForm(tab);
      eq([f.title, f.before, f.after, f.beforeNote, f.afterNote, f.clear], ["Sat Oct 3 – Sun Oct 4", "0", "0", "Friday, Thursday…", "Monday, Tuesday…", false], "none at first");

      // − / + by half a day: Before 1½ (Thursday afternoon and Friday), then 1; After ½ (Monday morning).
      await mo.stepOff(tab, "before", 3);
      eq((await mo.weekendForm(tab)).beforeNote, "1½ days: Thu afternoon – Fri", "1½ days before");
      await mo.stepOff(tab, "before", -1);
      await mo.stepOff(tab, "after", 1);
      f = await mo.weekendForm(tab);
      eq([f.before, f.beforeNote, f.after, f.afterNote], ["1", "1 day: Fri", "0.5", "½ day: Mon morning"], "1 day before, ½ after");

      // Esc asks before throwing them away (No keeps them); Save keeps them.
      tab.answers.push(false);
      await p.keyboard.press("Escape");
      eq([lastDialog(tab), (await mo.weekendForm(tab)).open], ["Discard your changes to this weekend?", true], "Esc asks first");
      await mo.saveWeekend(tab);
      eq((await mo.weekendForm(tab)).open, false, "saved");

      // Its tile runs from Friday to Monday after the sun, its tooltip spells it out, and the fold counts them.
      let w = await mo.weekends(tab);
      eq([w.tiles[0].days, w.tiles[0].sun, w.tiles[0].title], ["Oct 2–5", true, "Fri Oct 2 – Mon morning Oct 5 · 1½ days off: no plan yet"], "the tile");
      eq([w.tiles[1].days, w.tiles[1].sun], ["Oct 10–11", false], "the next weekend as it was");
      has(w.summary, "· 1½ days off ahead", "the fold's line");
      // The board: this week's Friday is a day off (Saturday and Sunday never are); next week's Monday a morning off,
      // its sun faded; nothing on the baseline.
      eq(await offs(tab), ["", "", "", "", "whole", "", ""], "this week");
      eq((await mo.offMarks(tab))[4], { off: "whole", tip: "Day off", half: false }, "Friday's sun");
      await mo.view(tab, "next");
      eq(await offs(tab), ["am", "", "", "", "", "", ""], "next week");
      eq((await mo.offMarks(tab))[0], { off: "am", tip: "Morning off", half: true }, "Monday's, faded");
      await mo.view(tab, "base");
      eq(await offs(tab), ["", "", "", "", "", "", ""], "the baseline");
      await mo.view(tab, "this");
      const kept = await stored(tab);
      eq([kept.plan, kept.off], ["", { before: 1, after: 0.5 }], "kept by its Saturday");
      ok(kept.u > 0, "with its time");

      // Opened again as saved (Clear shown); from Wednesday afternoon, with a plan, Enter saving: today and tomorrow are off.
      await mo.openWeekend(tab, SAT);
      f = await mo.weekendForm(tab);
      eq([f.before, f.after, f.clear], ["1", "0.5", true], "as saved");
      await mo.fillWeekend(tab, { before: 2.5, plan: "Lake trip" });
      eq((await mo.weekendForm(tab)).beforeNote, "2½ days: Wed afternoon – Fri", "typed");
      await p.press("#kMount #weekendPlan", "Enter");
      eq((await mo.weekendForm(tab)).open, false, "Enter saved");
      eq(await offs(tab), ["", "", "pm", "whole", "whole", "", ""], "from Wednesday afternoon");
      eq((await mo.offMarks(tab))[2], { off: "pm", tip: "Afternoon off", half: true }, "today's, faded");
      w = await mo.weekends(tab);
      eq([w.tiles[0].days, w.tiles[0].plan, w.tiles[0].title], ["Sep 30–Oct 5", "Lake trip", "Wed afternoon Sep 30 – Mon morning Oct 5 · 3 days off: Lake trip"], "across a month");
      has(w.summary, "· 3 days off ahead", "the fold's line");
      eq(await p.getAttribute('#kMount #board .col[data-day="5"] .col-plan', "title"), "Wed afternoon Sep 30 – Mon morning Oct 5 · 3 days off: Lake trip", "Saturday's plan says so too");
      await mo.showToday(tab);
      eq((await mo.todayOff(tab)).map(m => [m.off, m.tip]), [["pm", "Afternoon off"], ["whole", "Day off"]], "Today's date and Tomorrow's");
      await mo.showBoard(tab);

      // Export JSON carries them; Clear takes the plan and the days off away (kept as none, with its time); Import brings
      // them back.
      const backup = await exportBackup(tab);
      eq(backup.weekends[SAT].off, { before: 2.5, after: 0.5 }, "in the backup");
      await mo.openWeekend(tab, SAT);
      await mo.clearWeekend(tab);
      w = await mo.weekends(tab);
      eq([w.tiles[0].days, w.tiles[0].sun, w.tiles[0].plan], ["Oct 3–4", false, "No plan"], "cleared");
      lacks(w.summary, "off ahead", "none ahead");
      eq(await offs(tab), ["", "", "", "", "", "", ""], "no sun this week");
      const cleared = await stored(tab);
      eq([cleared.plan, cleared.off], ["", { before: 0, after: 0 }], "kept as none");
      ok(cleared.u > 0, "with its time");
      await importBackup(tab, backup);
      eq(await offs(tab), ["", "", "pm", "whole", "whole", "", ""], "back from the backup");
      eq((await stored(tab)).off, { before: 2.5, after: 0.5 }, "stored again");

      // A week on (time travel): this week's board has Monday's morning off; gone by, so none is ahead.
      await travel(tab, 7);
      eq(await offs(tab), ["am", "", "", "", "", "", ""], "Monday, a week on");
      lacks((await mo.weekends(tab)).summary, "off ahead", "none ahead now");
    }
  },
  {
    name: "momo weekends: older and damaged backups, two weekends reaching one day, a number that isn't one, halves and at most 5",
    async run(t) {
      const tab = await open(t, { app: "momo", size: DESKTOP }), p = tab.page;
      // An older backup's plan has no days off; damaged ones are none, or by halves up to 5; a date that isn't a Saturday goes.
      const data = gen.momo([]);
      data.weekends = {
        "2026-10-10": { plan: "Rest", u: 5 },
        "2026-10-17": { plan: "", off: { before: 9, after: "x" }, u: 5 },
        "2026-10-24": { plan: "", off: { before: 0.3, after: 1.2 } },
        "2026-10-29": { plan: "Not a Saturday", off: { before: 1, after: 1 }, u: 5 }
      };
      await importBackup(tab, data);
      eq(await p.evaluate(() => Kyoshi.apps.momo.S.data.weekends), {
        "2026-10-10": { plan: "Rest", off: { before: 0, after: 0 }, u: 5 },
        "2026-10-17": { plan: "", off: { before: 5, after: 0 }, u: 5 },
        "2026-10-24": { plan: "", off: { before: 0.5, after: 1 }, u: 0 }
      }, "cleaned");
      eq((await mo.weekends(tab)).tiles.slice(1, 4).map(x => [x.days, x.sun, x.plan]), [["Oct 10–11", false, "Rest"], ["Oct 12–18", true, "No plan"], ["Oct 23–26", true, "No plan"]], "their tiles");

      // Oct 10's days after it (4½: Monday to Thursday, and Friday morning) meet Oct 17's before it (½: Friday afternoon):
      // that Friday is off all day.
      await mo.openWeekend(tab, "2026-10-17");
      await mo.fillWeekend(tab, { before: 0.5 });
      await mo.saveWeekend(tab);
      await mo.openWeekend(tab, "2026-10-10");
      await mo.fillWeekend(tab, { after: 4.5 });
      eq((await mo.weekendForm(tab)).afterNote, "4½ days: Mon – Fri morning", "in words");
      await mo.saveWeekend(tab);
      eq(await p.evaluate(() => ["2026-10-12", "2026-10-15", "2026-10-16", "2026-10-17", "2026-10-19"].map(Kyoshi.apps.momo.offOn)), ["whole", "whole", "whole", "", ""], "Friday morning and afternoon: all day");

      // In the pop-up: a number that isn't one is refused (the field says what it takes); more than 5 is 5, a third a half.
      await mo.openWeekend(tab, SAT);
      await p.focus("#kMount #weekendBefore");
      await p.keyboard.type("e");
      eq((await mo.weekendForm(tab)).beforeNote, "In days, e.g. 1.5", "says what it takes");
      await mo.saveWeekend(tab);
      eq([lastDialog(tab), (await mo.weekendForm(tab)).open], ["Enter the days off as a number of days, by halves (1.5), or 0 for none.", true], "refused");
      await mo.fillWeekend(tab, { before: 7, after: 0.3 });
      const f = await mo.weekendForm(tab);
      eq([f.before, f.beforeNote, f.after, f.afterNote], ["5", "5 days: Mon – Fri", "0.5", "½ day: Mon morning"], "by halves, at most 5");
      // Cancel asks nothing and keeps nothing.
      await mo.cancelWeekend(tab);
      eq([tab.dialogs.length, (await mo.weekendForm(tab)).open, await stored(tab)], [0, false, null], "cancelled");
    }
  },
  {
    name: "momo weekends: on a phone, Today's dates carry the sun and the pop-up's Before and After sit side by side",
    async run(t) {
      const tab = await open(t, { app: "momo", size: PHONE }), p = tab.page;
      const data = gen.momo([]);
      data.weekends = { [SAT]: { plan: "Lake trip", off: { before: 2, after: 0 }, u: 5 } }; // Thursday and Friday
      await importBackup(tab, data);
      ok(await mo.isToday(tab), "Momo opens on Today on a phone");
      eq((await mo.todayOff(tab)).map(m => m.off), ["", "whole"], "today, Wednesday, isn't off; tomorrow is");
      eq((await mo.weekends(tab)).tiles[0].days, "Oct 1–4", "its tile under Today");
      await mo.openWeekend(tab, SAT);
      const [before, after] = await Promise.all(["weekendBefore", "weekendAfter"].map(id => p.locator(`#kMount #${id}`).boundingBox()));
      ok(Math.abs(before.y - after.y) < 2 && before.x + before.width <= after.x, "side by side");
      ok(after.x + after.width <= PHONE.width, "on the screen");
      await mo.stepOff(tab, "after", 2);
      eq((await mo.weekendForm(tab)).afterNote, "1 day: Mon", "a day after");
      await mo.saveWeekend(tab);
      eq((await mo.weekends(tab)).tiles[0].days, "Oct 1–5", "Monday too");
      ok(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), "no sideways scroll");
    }
  },
  {
    name: "momo time off: PTO and sick time from Developer Mode on both folds, days off coming off PTO and back, the block's fields, Clear",
    async run(t) {
      const tab = await open(t, { app: "momo", size: DESKTOP }), p = tab.page;
      // Nothing at first: no words on the folds, nothing in the block.
      eq(await folds(tab), ["", ""], "nothing at first");
      eq(await mo.timeOff(tab), { head: "not set up", pto: "", sick: "", clear: false }, "the block, empty");

      // 44h of PTO and 16h of sick time, saved as of today: in days by halves at the end of both folds' lines.
      await mo.setTimeOff(tab, { pto: 44, sick: 16 });
      eq(await folds(tab), ["· PTO 5½ days · Sick 2 days", "· PTO 5½ days · Sick 2 days"], "both folds");
      eq(await mo.timeOff(tab), { head: "PTO 5½ days · Sick 2 days", pto: "44", sick: "16", clear: true }, "the block");
      const kept = await keptOff(tab);
      eq([kept.pto, kept.sick, kept.asOf], [44, 16, TODAY], "kept as of today");
      ok(kept.u > 0, "with its time");

      // This weekend's pop-up says what's left, live as the days off are typed; saved, they come off PTO.
      await mo.openWeekend(tab, SAT);
      eq(await mo.ptoLine(tab), "PTO: 5½ days now, 5½ days after this weekend", "nothing typed");
      await mo.fillWeekend(tab, { before: 1.5 });
      eq(await mo.ptoLine(tab), "PTO: 5½ days now, 4 days after this weekend", "1½ days typed");
      await mo.saveWeekend(tab);
      eq(await folds(tab), ["· PTO 4 days · Sick 2 days", "· PTO 4 days · Sick 2 days"], "1½ days off ahead");
      has((await mo.weekends(tab)).summary, "· 1½ days off ahead · PTO 4 days", "after the days off ahead");
      // The block's fields hold the hours today, before the days off ahead: saving them as they are changes nothing.
      eq(await mo.timeOff(tab), { head: "PTO 4 days · Sick 2 days", pto: "44", sick: "16", clear: true }, "today's hours");
      await mo.setTimeOff(tab, {});
      eq([(await folds(tab))[0], (await keptOff(tab)).u], ["· PTO 4 days · Sick 2 days", kept.u], "saved as it was: nothing changed");

      // Days off before today don't count (Monday and Tuesday of 5 before); below 0 is red; clearing them gives them back.
      await mo.openWeekend(tab, SAT);
      eq(await mo.ptoLine(tab), "PTO: 4 days now, 4 days after this weekend", "as saved");
      await mo.fillWeekend(tab, { before: 5 });
      eq(await mo.ptoLine(tab), "PTO: 4 days now, 2½ days after this weekend", "Wednesday to Friday only");
      await mo.fillWeekend(tab, { after: 5 });
      eq([await mo.ptoLine(tab), await red(tab)], ["PTO: 4 days now, −2½ days after this weekend", ["−2½ days"]], "below 0, in red");
      await mo.saveWeekend(tab);
      eq([(await folds(tab))[0], await red(tab)], ["· PTO −2½ days · Sick 2 days", ["−2½ days"]], "the fold, in red");
      await mo.openWeekend(tab, SAT);
      await mo.clearWeekend(tab);
      eq([(await folds(tab))[0], await red(tab)], ["· PTO 5½ days · Sick 2 days", []], "the weekend cleared: back");

      // Days by halves, a remainder in hours: 10h is a day and 2h; −½ day on sick, then −1 day on PTO.
      eq(await p.evaluate(() => [44, 16, 10, 6, 4, 2, 2.25, 0.5, 0, -4, -10].map(Kyoshi.apps.momo.fmtTimeOff)),
        ["5½ days", "2 days", "1 day 2h", "½ day 2h", "½ day", "2h", "2.25h", "0.5h", "0", "−½ day", "−1 day 2h"], "the words");
      await mo.setTimeOff(tab, { pto: 10 });
      eq((await folds(tab))[0], "· PTO 1 day 2h · Sick 2 days", "10h");
      await mo.setTimeOff(tab, {}, { less: [["sick", "half"]] });
      eq((await folds(tab))[0], "· PTO 1 day 2h · Sick 1½ days", "−½ day on sick");
      await mo.setTimeOff(tab, {}, { less: [["pto", "day"]] });
      eq([(await folds(tab))[0], (await mo.timeOff(tab)).pto], ["· PTO 2h · Sick 1½ days", "2"], "−1 day on PTO");

      // What's typed stays while Momo redraws; Developer Mode opened again shows what's saved. Enter saves; a field that
      // isn't a number is refused.
      await mo.setTimeOff(tab, { pto: 30 }, { save: false, open: true });
      await p.evaluate(() => Kyoshi.apps.momo.renderAll());
      eq(await p.inputValue("#kDevAppTools #momoPto"), "30", "kept through a redraw");
      await devPanel(tab, false);
      eq((await mo.timeOff(tab)).pto, "2", "opened again: as saved");
      await mo.setTimeOff(tab, { pto: 12 }, { save: false, open: true });
      await p.press("#kDevAppTools #momoSick", "Enter");
      await devPanel(tab, false);
      eq((await folds(tab))[0], "· PTO 1½ days · Sick 1½ days", "Enter saved");
      await mo.setTimeOff(tab, { sick: "" });
      eq([lastDialog(tab), (await folds(tab))[0]], ["Enter your PTO and sick time in hours (0 for none).", "· PTO 1½ days · Sick 1½ days"], "refused");
      eq(await p.evaluate(() => Kyoshi.apps.momo.bugState().filter(l => l.startsWith("- Time off"))), ["- Time off: set up"], "bug reports: no hours");

      // Clear asks first (No keeps it); then it's kept as cleared, with its time, and nothing shows. Undo brings it back.
      tab.answers.push(false);
      await mo.clearTimeOff(tab);
      eq([lastDialog(tab), (await folds(tab))[0]], ["Clear your PTO and sick time? Upcoming weekends stops showing them.", "· PTO 1½ days · Sick 1½ days"], "No keeps it");
      const before = (await keptOff(tab)).u;
      await mo.clearTimeOff(tab);
      eq(await folds(tab), ["", ""], "cleared");
      eq(await mo.timeOff(tab), { head: "not set up", pto: "", sick: "", clear: false }, "the block, empty again");
      const cleared = await keptOff(tab);
      eq([cleared.pto, cleared.sick, cleared.asOf], [0, 0, ""], "kept as cleared");
      ok(cleared.u >= before, "with its time");
      await p.keyboard.press("Control+z");
      eq((await folds(tab))[0], "· PTO 1½ days · Sick 1½ days", "Undo");
    }
  },
  {
    name: "momo time off: an earlier weekend's days off, export and import, older and damaged backups, another tab's Save, another device's save combined",
    async run(t) {
      const tab = await open(t, { app: "momo", size: DESKTOP }), p = tab.page;
      // An earlier weekend's days off (Monday and Tuesday, Sep 21–22) were taken before the hours were saved: no change.
      const data = gen.momo([]);
      data.weekends = { "2026-09-19": { plan: "", off: { before: 0, after: 2 }, u: 5 } };
      await importBackup(tab, data);
      await mo.setTimeOff(tab, { pto: 44, sick: 16 });
      eq((await folds(tab))[0], "· PTO 5½ days · Sick 2 days", "an earlier weekend's days off change nothing");

      // Export JSON carries it; a fresh device imports it; an older backup (none) replaces it: nothing shows.
      const backup = await exportBackup(tab);
      eq([backup.timeOff.pto, backup.timeOff.sick, backup.timeOff.asOf], [44, 16, TODAY], "in the backup");
      ok(backup.timeOff.u > 0, "with its time");
      const other = await open(t, { app: "momo", size: DESKTOP });
      await importBackup(other, backup);
      eq([(await folds(other))[0], (await mo.timeOff(other)).pto], ["· PTO 5½ days · Sick 2 days", "44"], "on a fresh device");
      await importBackup(other, gen.momo([TODAY]));
      eq([(await folds(other))[0], await keptOff(other)], ["", null], "an older backup: none");
      // A damaged one: within −999 and 9999 hours, on the quarter hour; hours that aren't a number, or no day, are none.
      const damaged = gen.momo([TODAY]);
      damaged.timeOff = { pto: 12345, sick: -1.1, asOf: TODAY, u: 5 };
      await importBackup(other, damaged);
      eq([await keptOff(other), (await folds(other))[0], await red(other)], [{ pto: 9999, sick: -1, asOf: TODAY, u: 5 }, "· PTO 1249½ days 3h · Sick −1h", ["−1h"]], "kept within bounds");
      damaged.timeOff = { pto: "x", sick: 4, asOf: TODAY, u: 5 };
      await importBackup(other, damaged);
      eq(await keptOff(other), null, "not a number: none");

      // Another tab of the same browser: its Save shows here.
      const second = await open(t, { app: "momo", size: DESKTOP, ctx: tab.ctx });
      await mo.setTimeOff(second, { pto: 24, sick: 8 });
      await p.waitForFunction(() => Kyoshi.apps.momo.S.data.timeOff.pto === 24);
      eq((await folds(tab))[0], "· PTO 3 days · Sick 1 day", "the other tab's Save");

      // Another device's save (the sync folder, the cloud): the later change wins, a Clear too; an older one, or an older
      // copy of Momo's without it, changes nothing.
      const combine = timeOff => p.evaluate(to => {
        const A = Kyoshi.apps.momo, raw = JSON.parse(JSON.stringify(A.data.build()));
        if (to) raw.timeOff = to;
        else delete raw.timeOff;
        const c = A.data.combine(raw, { replace: false, plain: false, mine: { savedAt: "2", device: "b" }, theirs: { savedAt: "1", device: "a" } });
        const changed = c.apply();
        if (changed) A.data.afterSync();
        return changed;
      }, timeOff);
      const u = (await keptOff(tab)).u;
      eq(await combine({ pto: 20, sick: 8, asOf: TODAY, u: u + 1000 }), true, "a later save");
      eq((await folds(tab))[0], "· PTO 2½ days · Sick 1 day", "its hours");
      eq(await combine({ pto: 40, sick: 40, asOf: TODAY, u: u + 500 }), false, "an older save changes nothing");
      eq(await combine(null), false, "nor an older copy of Momo's, without it");
      eq(await combine({ pto: 0, sick: 0, asOf: "", u: u + 2000 }), true, "a later Clear");
      eq((await folds(tab))[0], "", "cleared");
      eq(await combine({ pto: 20, sick: 8, asOf: TODAY, u: u + 1000 }), false, "the clearing wins over the copy before it");
    }
  },
  {
    name: "momo time off: on a phone, Today's fold and the pop-up show it and the block fits; a day and a week on, the days taken still count",
    async run(t) {
      const tab = await open(t, { app: "momo", size: PHONE }), p = tab.page;
      await mo.setTimeOff(tab, { pto: 44, sick: 16 });
      ok(await mo.isToday(tab), "on Today");
      eq(timeOffOf((await mo.weekends(tab)).summary), "· PTO 5½ days · Sick 2 days", "Today's fold");
      // The block fits the panel: each row's label, field and buttons side by side, inside it.
      await devPanel(tab, true);
      const fits = await p.evaluate(() => {
        const panel = document.querySelector("#kDevPanel").getBoundingClientRect();
        return [...document.querySelectorAll("#kDevAppTools .momo-off-field")].map(row => [...row.children].map(el => el.getBoundingClientRect()))
          .every(r => r.every(b => b.left >= panel.left && b.right <= panel.right && Math.abs(b.top + b.height / 2 - (r[0].top + r[0].height / 2)) < 3));
      });
      ok(fits, "the block fits");
      await devPanel(tab, false);
      // The pop-up's line, on the screen; saved, PTO goes down.
      await mo.openWeekend(tab, SAT);
      await mo.stepOff(tab, "before", 3);
      eq(await mo.ptoLine(tab), "PTO: 5½ days now, 4 days after this weekend", "1½ days");
      const line = await p.locator("#kMount #weekendPto").boundingBox();
      ok(line.x >= 0 && line.x + line.width <= PHONE.width, "on the screen");
      await mo.saveWeekend(tab);
      eq(timeOffOf((await mo.weekends(tab)).summary), "· PTO 4 days · Sick 2 days", "saved");
      // A day on (Thursday afternoon and Friday are today and tomorrow): the same; the field still today's 44h.
      await travel(tab, 1);
      eq([timeOffOf((await mo.weekends(tab)).summary), (await mo.timeOff(tab)).pto], ["· PTO 4 days · Sick 2 days", "44"], "a day on");
      // A week on: the days taken still count, and they've come off the hours today; saving those changes nothing.
      await travel(tab, 7);
      eq([timeOffOf((await mo.weekends(tab)).summary), (await mo.timeOff(tab)).pto], ["· PTO 4 days · Sick 2 days", "32"], "a week on");
      await mo.setTimeOff(tab, {});
      eq([timeOffOf((await mo.weekends(tab)).summary), (await keptOff(tab)).asOf], ["· PTO 4 days · Sick 2 days", addDays(TODAY, 8)], "saved as of then");
      ok(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), "no sideways scroll");
    }
  }
];
