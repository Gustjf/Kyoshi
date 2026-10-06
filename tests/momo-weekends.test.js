/* Kyoshi · tests/momo-weekends.test.js — Momo's days off around a weekend (Phase 7 of plan_2026-10-05): a weekend's
 * pop-up takes days off before it (Friday, then Thursday…) and after it (Monday, then Tuesday…) by halves, the − / + by
 * half a day and the days they take in words under each; saved, the weekend's tile runs over them after a small gold sun,
 * its tooltip spelling them out, and each day off has the sun on the board's heading (this week's and next week's, never
 * the baseline's; faded for half a day: the afternoon before, the morning after; never a Saturday or Sunday) and on
 * Today's; the fold counts the days off ahead. Esc asks before discarding them, Enter saves, Clear takes them away (kept
 * as none, with its time), a number that isn't one is refused; Export and Import JSON keep them, an older backup (plans
 * only) and a damaged one import cleanly; two weekends reaching one day make it a whole day off; time travel moves
 * "ahead" on; on a phone Today's dates carry the sun and Before and After sit side by side. */
"use strict";
const { TODAY, DESKTOP, PHONE, eq, ok, has, lacks, open, lastDialog, importBackup, exportBackup, addDays, travel } = require("./lib");
const gen = require("./generate");
const mo = require("./momo");

const SAT = addDays(TODAY, 3); // this weekend's Saturday, Oct 3 (TODAY is Wednesday Sep 30)
const stored = (tab, sat = SAT) => tab.page.evaluate(s => Kyoshi.apps.momo.S.data.weekends[s] || null, sat);
const offs = async tab => (await mo.offMarks(tab)).map(m => m.off);

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
  }
];
