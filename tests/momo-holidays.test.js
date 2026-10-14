/* Kyoshi · tests/momo-holidays.test.js — Momo's holidays (2026-10-14 plan, Phase 2): Developer Mode's Time off block has
 * Holidays…, which closes it and opens Momo's pop-up to paste a list (a date, then its name; a run of days) or pick a
 * calendar file (.ics), shows what it read ("5 holidays: …; 1 line not understood (line 4).") before Add keeps it, then
 * lists the holidays from today on, each with ✕. A holiday touching a weekend runs its tile over it after a violet sun
 * (its tooltip names it); one no weekend reaches is a row of its own among the tiles, by its date, with its plan; the
 * fold counts "· N holidays ahead". Each holiday carries a violet sun on the board's heading and on Today's dates, and a
 * day off on one costs no PTO. ✕ keeps a marker (the removal wins when two devices combine) and Undo brings it back;
 * Export and Import JSON keep them, an older backup has none, a damaged one is cleaned; bug reports count them and
 * never name one; the pop-up's Esc asks, Close doesn't, and it fits a phone. */
"use strict";
const { TODAY, DESKTOP, PHONE, eq, ok, has, lacks, open, lastDialog, devPanel, importBackup, exportBackup, addDays, travel } = require("./lib");
const gen = require("./generate");
const mo = require("./momo");

// The made-up list the first tests use: Nov 27 (the Friday after a weekend), Nov 11 (a Wednesday on its own), a run over
// Dec 24–26 (the Saturday of the last of the 13 weekends); the fourth line is no date.
const LIST = "2026-11-27 Day after\nNov 11 Lone day\nDec 24 – Dec 26 Winter break\nthis is not a date";
const SAT_NOV = "2026-11-28", SAT_DEC = "2026-12-26"; // Nov 27 is the Friday before the first; Dec 26 is the second itself
// The backup of a Momo with holidays (made up), as an import brings it in.
const withHolidays = holidays => Object.assign(gen.momo([]), { holidays });
const FIVE = { "2026-11-11": { name: "Lone day", plan: "", u: 5 }, "2026-11-27": { name: "Day after", plan: "", u: 5 },
  "2026-12-24": { name: "Winter break", plan: "", u: 5 }, "2026-12-25": { name: "Winter break", plan: "", u: 5 }, "2026-12-26": { name: "Winter break", plan: "", u: 5 } };
const tileOf = (w, sat) => w.tiles.find(x => x.sat === sat);
const rowsOf = w => w.tiles.filter(x => !x.sat); // a lone holiday's row has no Saturday
const ics = events => ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Made up//EN", ...events.flat(), "END:VCALENDAR"].join("\r\n");

module.exports = [
  {
    name: "momo holidays: pasted, read before Add, joined to a weekend or a row of their own with a plan, the fold's count",
    async run(t) {
      const tab = await open(t, { app: "momo", size: DESKTOP }), p = tab.page;
      eq(await mo.weekends(tab).then(w => rowsOf(w).length), 0, "no holiday rows at first");
      lacks((await mo.weekends(tab)).summary, "holiday", "nothing ahead at first");

      // Holidays… closes Developer Mode and opens the pop-up, empty: nothing read, Add off, none from today on.
      await mo.openHolidays(tab);
      ok(!(await p.evaluate(() => document.body.classList.contains("dev-mode"))), "Developer Mode closed");
      eq(await mo.holidaysForm(tab), { open: true, text: "", read: "", bad: false, canAdd: false, rows: [] }, "empty");
      eq(await p.textContent("#kMount #holidaysList"), "None from today on.", "none yet");

      // Typed (all at once), it says what it read, sorted by date, and what it did not understand; Add is on.
      await mo.pasteHolidays(tab, LIST, { add: false });
      eq(await mo.holidaysForm(tab).then(f => [f.read, f.bad, f.canAdd]),
        ["5 holidays: Wed Nov 11 Lone day, Fri Nov 27 Day after, Thu Dec 24 – Sat Dec 26 Winter break; 1 line not understood (line 4).", false, true], "what it read");
      eq((await mo.keptHolidays(tab)), {}, "nothing kept before Add");
      await p.click("#kMount #holidaysAddBtn");
      let f = await mo.holidaysForm(tab);
      eq([f.text, f.read, f.canAdd], ["", "", false], "the box is emptied after Add");
      eq(f.rows, [
        { date: "2026-11-11", day: "Wed Nov 11", name: "Lone day" }, { date: "2026-11-27", day: "Fri Nov 27", name: "Day after" },
        { date: "2026-12-24", day: "Thu Dec 24 – Sat Dec 26", name: "Winter break" }], "listed by date, a run of days as one");
      const kept = await mo.keptHolidays(tab);
      eq(Object.keys(kept), ["2026-11-11", "2026-11-27", "2026-12-24", "2026-12-25", "2026-12-26"], "5 kept");
      eq([kept["2026-11-27"].name, kept["2026-11-27"].plan], ["Day after", ""], "a name and no plan");
      ok(kept["2026-11-27"].u > 0, "with its time");
      await mo.closeHolidays(tab);
      eq(lastDialog(tab), "", "Close asks nothing");

      // The Nov 28 weekend runs over its Friday after a violet sun, its tooltip naming it; the Dec 26 weekend (itself a
      // holiday) starts on Dec 24 and ends Sunday.
      let w = await mo.weekends(tab);
      eq(w.tiles.length, 14, "13 weekends and a lone holiday's row");
      eq([tileOf(w, SAT_NOV).days, tileOf(w, SAT_NOV).sun, tileOf(w, SAT_NOV).title], ["Nov 27–29", true, "Fri Nov 27 – Sun Nov 29 · Fri Day after: no plan yet"], "the Nov 28 weekend");
      eq(await p.locator(`#kMount #boardView details.weekends [data-weekend="${SAT_NOV}"] .we-days .off-sun.holiday`).count(), 1, "the violet sun, before the dates");
      eq([tileOf(w, SAT_DEC).days, tileOf(w, SAT_DEC).sun, tileOf(w, SAT_DEC).title],
        ["Dec 24–27", true, "Thu Dec 24 – Sun Dec 27 · Thu Winter break, Fri Winter break, Sat Winter break: no plan yet"], "the Dec 26 weekend");
      eq([tileOf(w, "2026-11-21").days, tileOf(w, "2026-11-21").sun], ["Nov 21–22", false], "the weekend before as it was");

      // Nov 11 is its own row, between the Nov 7 and Nov 14 tiles, "No plan" and the violet sun.
      const i = w.tiles.findIndex(x => x.sat === "2026-11-07");
      eq(w.tiles.slice(i, i + 3).map(x => [x.sat || "", x.days]), [["2026-11-07", "Nov 7–8"], ["", "Wed Nov 11 · Lone day"], ["2026-11-14", "Nov 14–15"]], "in date order");
      eq(rowsOf(w).map(x => [x.plan, x.none, x.sun, x.title]), [["No plan", true, true, "Wed Nov 11 · Lone day: no plan yet"]], "its row");
      eq(await p.getAttribute('#kMount #boardView details.weekends button.weekend.holiday[data-holiday="2026-11-11"]', "data-holiday"), "2026-11-11", "button.weekend.holiday");

      // Its pop-up is the weekend's without days off: titled by the day and the name; the plan, saved with Enter, shows.
      await mo.openHoliday(tab, "2026-11-11");
      const form = await mo.weekendForm(tab);
      eq([form.title, form.plan, form.clear], ["Wed Nov 11 · Lone day", "", false], "its pop-up");
      ok(await p.locator("#kMount #weekendOffField").isHidden(), "no days off");
      await p.fill("#kMount #weekendPlan", "Museum");
      await p.press("#kMount #weekendPlan", "Enter");
      eq((await mo.weekendForm(tab)).open, false, "Enter saved");
      w = await mo.weekends(tab);
      eq(rowsOf(w).map(x => [x.days, x.plan, x.none, x.title]), [["Wed Nov 11 · Lone day", "Museum", false, "Wed Nov 11 · Lone day: Museum"]], "the row shows the plan");
      eq((await mo.keptHolidays(tab))["2026-11-11"].plan, "Museum", "kept");
      // Opened again: as saved, Clear shown; Clear takes the plan away and the holiday stays.
      await mo.openHoliday(tab, "2026-11-11");
      eq(await mo.weekendForm(tab).then(x => [x.plan, x.clear]), ["Museum", true], "as saved");
      await mo.clearWeekend(tab);
      eq(rowsOf(await mo.weekends(tab)).map(x => [x.days, x.plan]), [["Wed Nov 11 · Lone day", "No plan"]], "cleared: the holiday stays");
      await mo.openHoliday(tab, "2026-11-11");
      await p.fill("#kMount #weekendPlan", "Museum");
      await p.press("#kMount #weekendPlan", "Enter");

      // The fold counts them (all 5, joined or not), and not as days off.
      w = await mo.weekends(tab);
      has(w.summary, "· 5 holidays ahead", "the fold's line");
      lacks(w.summary, "off ahead", "a holiday isn't a day off");
      has(w.summary, "0 of 13 planned", "plans are weekends' only");
      eq(await p.evaluate(() => Kyoshi.apps.momo.S.data.weekends), {}, "no weekend record was made");
    }
  },
  {
    name: "momo holidays: a violet sun on the board's heading and on Today's dates, titled Holiday: <name>",
    async run(t) {
      // The board: the week of Nov 23, Friday's heading (Nov 27); the week of Dec 21 (Dec 24, 25 and 26: a Saturday too).
      const tab = await open(t, { app: "momo", size: DESKTOP });
      await importBackup(tab, withHolidays(FIVE));
      eq((await mo.offMarks(tab)).map(m => m.off), ["", "", "", "", "", "", ""], "none this week");
      await travel(tab, 56); // Wed Nov 25
      eq((await mo.offMarks(tab)).map(m => m.off), ["", "", "", "", "holiday", "", ""], "the week of Nov 23");
      eq((await mo.offMarks(tab))[4], { off: "holiday", tip: "Holiday: Day after", half: false }, "Friday's sun");
      eq(await tab.page.$eval('#kMount #board .col[data-day="4"] .col-date .off-sun', e => e.classList.contains("holiday")), true, "violet");
      await travel(tab, 28); // Wed Dec 23
      eq((await mo.offMarks(tab)).map(m => m.off), ["", "", "", "holiday", "holiday", "holiday", ""], "the week of Dec 21");
      eq((await mo.offMarks(tab))[3].tip, "Holiday: Winter break", "Thursday's tip");
      await mo.view(tab, "base");
      eq((await mo.offMarks(tab)).map(m => m.off), ["", "", "", "", "", "", ""], "never on the baseline");

      // Today (a phone): on Thursday Nov 26 it's Tomorrow's date; on Friday the 27th it's today's.
      const phone = await open(t, { app: "momo", size: PHONE });
      await importBackup(phone, withHolidays(FIVE));
      ok(await mo.isToday(phone), "on Today");
      eq((await mo.todayOff(phone)).map(m => m.off), ["", ""], "none today or tomorrow");
      await travel(phone, 57); // Thu Nov 26
      eq((await mo.todayOff(phone)).map(m => [m.off, m.tip]), [["", ""], ["holiday", "Holiday: Day after"]], "tomorrow's date");
      await travel(phone, 1); // Fri Nov 27
      eq((await mo.todayOff(phone)).map(m => [m.off, m.tip]), [["holiday", "Holiday: Day after"], ["", ""]], "today's date");
      eq(await phone.page.$eval("#kMount #todayDate .off-sun", e => e.classList.contains("holiday")), true, "violet");
    }
  },
  {
    name: "momo holidays: a day off on a holiday costs no PTO, in the fold and live in the weekend's pop-up",
    async run(t) {
      const tab = await open(t, { app: "momo", size: DESKTOP }), p = tab.page;
      await importBackup(tab, withHolidays(FIVE));
      await mo.setTimeOff(tab, { pto: 40, sick: 0 });
      has((await mo.weekends(tab)).summary, "· PTO 5 days · Sick 0", "40 hours: 5 days");

      // The Nov 28 weekend's Friday is the holiday: one day before takes none.
      await mo.openWeekend(tab, SAT_NOV);
      eq(await mo.ptoLine(tab), "PTO: 5 days now, 5 days after this weekend", "nothing typed");
      await mo.fillWeekend(tab, { before: 1 });
      const f = await mo.weekendForm(tab);
      eq(f.beforeNote, "1 day: Fri · Holiday: Fri Nov 27 Day after", "the note names the holiday it reaches");
      eq(await mo.ptoLine(tab), "PTO: 5 days now, 5 days after this weekend", "takes none");
      await mo.saveWeekend(tab);
      let w = await mo.weekends(tab);
      has(w.summary, "· PTO 5 days · Sick 0", "the fold: PTO stays 5 days");
      lacks(w.summary, "off ahead", "and a holiday isn't a day off ahead");
      eq([tileOf(w, SAT_NOV).days, tileOf(w, SAT_NOV).sun, tileOf(w, SAT_NOV).title], ["Nov 27–29", true, "Fri Nov 27 – Sun Nov 29 · 1 day off · Fri Day after: no plan yet"], "its tile");
      eq((await p.evaluate(s => Kyoshi.apps.momo.S.data.weekends[s].off, SAT_NOV)), { before: 1, after: 0 }, "kept as 1 day before");
      eq((await mo.timeOff(tab)).pto, "40", "the block's field is today's 40 hours");

      // Two days before: Thursday costs a day, Friday none.
      await mo.openWeekend(tab, SAT_NOV);
      await mo.fillWeekend(tab, { before: 2 });
      eq(await mo.ptoLine(tab), "PTO: 5 days now, 4 days after this weekend", "2 days typed: one day taken");
      await mo.saveWeekend(tab);
      w = await mo.weekends(tab);
      has(w.summary, "· 1 day off ahead", "the fold: one day off ahead");
      has(w.summary, "· PTO 4 days · Sick 0", "the fold: PTO 4 days");
      eq([tileOf(w, SAT_NOV).days, tileOf(w, SAT_NOV).title], ["Nov 26–29", "Thu Nov 26 – Sun Nov 29 · 2 days off · Fri Day after: no plan yet"], "its tile");

      // The holiday removed: Friday costs a day again (and nothing goes red).
      await p.evaluate(() => Kyoshi.apps.momo.removeHoliday("2026-11-27"));
      w = await mo.weekends(tab);
      has(w.summary, "· 2 days off ahead", "two days off ahead");
      has(w.summary, "· 4 holidays ahead · PTO 3 days · Sick 0", "Friday costs again");
      eq([tileOf(w, SAT_NOV).days, tileOf(w, SAT_NOV).sun], ["Nov 26–29", true], "the days off still run Thursday to Sunday");
    }
  },
  {
    name: "momo holidays: ✕ removes one (kept as a marker with no name) and Undo brings it back",
    async run(t) {
      const tab = await open(t, { app: "momo", size: DESKTOP }), p = tab.page;
      await mo.openHolidays(tab);
      await mo.pasteHolidays(tab, "Nov 11 Lone day\nNov 27 Day after");
      eq(await mo.holidaysForm(tab).then(f => f.rows.map(r => r.date)), ["2026-11-11", "2026-11-27"], "two listed");
      has((await mo.weekends(tab)).summary, "· 2 holidays ahead", "two ahead");

      await p.click('#kMount #holidaysList [data-remove="2026-11-11"]');
      eq(await mo.holidaysForm(tab).then(f => f.rows.map(r => r.date)), ["2026-11-27"], "gone from the list");
      const marker = (await mo.keptHolidays(tab))["2026-11-11"];
      eq([marker.name, marker.plan], ["", ""], "kept as a marker, no name");
      ok(marker.u > 0, "with its time");
      await mo.closeHolidays(tab);
      let w = await mo.weekends(tab);
      eq(rowsOf(w).length, 0, "its row is gone");
      has(w.summary, "· 1 holiday ahead", "the fold counts one (singular)");

      // Undo (Ctrl+Z, the pop-up closed) brings it back, name and row.
      await p.keyboard.press("Control+z");
      eq((await mo.keptHolidays(tab))["2026-11-11"].name, "Lone day", "back");
      w = await mo.weekends(tab);
      eq(rowsOf(w).map(x => x.days), ["Wed Nov 11 · Lone day"], "its row is back");
      has(w.summary, "· 2 holidays ahead", "two ahead again");
      eq(tileOf(w, SAT_NOV).days, "Nov 27–29", "the other still joined to its weekend");
    }
  },
  {
    name: "momo holidays: a calendar file (.ics) is read, its all-day events (a run of days, a folded name) named before Add",
    async run(t) {
      const tab = await open(t, { app: "momo", size: DESKTOP }), p = tab.page;
      const file = ics([
        ["BEGIN:VEVENT", "UID:a@made.up", "DTSTART;VALUE=DATE:20261112", "DTEND;VALUE=DATE:20261113", "SUMMARY:Founders Day obse", " rved", "END:VEVENT"],
        ["BEGIN:VEVENT", "UID:b@made.up", "DTSTART;VALUE=DATE:20261231", "DTEND;VALUE=DATE:20270102", "SUMMARY:Year end\\, closed", "END:VEVENT"],
        ["BEGIN:VEVENT", "UID:c@made.up", "DTSTART:20261120T090000Z", "DTEND:20261120T120000Z", "SUMMARY:Half day", "END:VEVENT"],
        ["BEGIN:VEVENT", "UID:d@made.up", "SUMMARY:No date", "END:VEVENT"],
        ["BEGIN:VEVENT", "UID:e@made.up", "DTSTART;VALUE=DATE:20261203", "DTEND;VALUE=DATE:20261204", "SUMMARY:Cancelled one", "STATUS:CANCELLED", "END:VEVENT"]
      ]);
      await mo.openHolidays(tab);
      await p.setInputFiles("#kMount #holidaysFile", { name: "work.ics", mimeType: "text/calendar", buffer: Buffer.from(file) });
      await p.waitForFunction(() => document.querySelector("#kMount #holidaysRead").textContent.trim() !== "");
      let f = await mo.holidaysForm(tab);
      eq([f.read, f.canAdd, f.text], ["From work.ics: 3 holidays: Thu Nov 12 Founders Day observed, Thu Dec 31 – Fri Jan 1 Year end, closed; 2 events not understood; 1 timed event left out (only all-day ones are holidays).", true, ""], "what it read");
      eq(await mo.keptHolidays(tab), {}, "nothing kept before Add");
      await p.click("#kMount #holidaysAddBtn");
      f = await mo.holidaysForm(tab);
      eq(f.rows, [
        { date: "2026-11-12", day: "Thu Nov 12", name: "Founders Day observed" },
        { date: "2026-12-31", day: "Thu Dec 31 – Fri Jan 1", name: "Year end, closed" }], "kept, the run as one");
      eq([f.read, f.canAdd], ["", false], "the reading is cleared after Add");
      eq(await p.$eval("#kMount #holidaysFile", e => e.value), "", "the file is let go");
      await mo.closeHolidays(tab);
      // Nov 12 is a Thursday no weekend reaches: a row of its own; the timed event (Nov 20, a meeting) and the cancelled one are left out.
      const w = await mo.weekends(tab);
      eq(rowsOf(w).map(x => x.days), ["Thu Nov 12 · Founders Day observed"], "its row");
      eq([tileOf(w, "2026-11-21").days, tileOf(w, "2026-11-21").sun], ["Nov 21–22", false], "the timed event isn't a holiday");
      eq(Object.keys(await mo.keptHolidays(tab)), ["2026-11-12", "2026-12-31", "2027-01-01"], "kept");
    }
  },
  {
    name: "momo holidays: Export JSON and Import JSON keep them; an older backup has none; a damaged one is cleaned",
    async run(t) {
      const tab = await open(t, { app: "momo", size: DESKTOP }), p = tab.page;
      await mo.openHolidays(tab);
      await mo.pasteHolidays(tab, "Nov 11 Lone day\n2026-11-27 Day after");
      await mo.closeHolidays(tab);
      await mo.openHoliday(tab, "2026-11-11");
      await p.fill("#kMount #weekendPlan", "Museum");
      await p.press("#kMount #weekendPlan", "Enter");

      const backup = await exportBackup(tab);
      eq(Object.keys(backup.holidays), ["2026-11-11", "2026-11-27"], "in the backup");
      eq([backup.holidays["2026-11-11"].name, backup.holidays["2026-11-11"].plan, backup.holidays["2026-11-27"].name], ["Lone day", "Museum", "Day after"], "names and plans");
      ok(backup.holidays["2026-11-11"].u > 0, "with its time");

      // A fresh device imports it: the same holidays, the tiles and the row.
      const other = await open(t, { app: "momo", size: DESKTOP });
      await importBackup(other, backup);
      eq(await mo.keptHolidays(other), backup.holidays, "on a fresh device");
      let w = await mo.weekends(other);
      eq([tileOf(w, SAT_NOV).days, rowsOf(w).map(x => [x.days, x.plan])], ["Nov 27–29", [["Wed Nov 11 · Lone day", "Museum"]]], "their tiles");

      // An older backup (no holidays key) replaces them with none.
      const older = gen.momo([TODAY]);
      ok(!("holidays" in older), "the older backup has no holidays");
      await importBackup(other, older);
      eq(await mo.keptHolidays(other), {}, "an older backup: none");
      w = await mo.weekends(other);
      eq([w.tiles.length, tileOf(w, SAT_NOV).days], [13, "Nov 28–29"], "no row, the weekend as it was");
      lacks(w.summary, "holiday", "none ahead");

      // A damaged one: a key that isn't a date, a name that isn't text, a record that isn't one, a plan that isn't text
      // (the holiday stays), a marker (its plan goes), a name too long (cut to 40), a time that isn't one (0).
      const damaged = withHolidays({
        nope: { name: "Bad key", plan: "", u: 5 }, "2026-11-11": { name: 5 }, "2026-11-12": "x", "2026-11-13": { name: "Good", plan: 7, u: 5 },
        "2026-11-16": { name: "", plan: "left over", u: 9 }, "2026-11-17": { name: "N".repeat(60), plan: "Walk", u: 3 }, "2026-11-18": { name: "Neg", u: -4 }
      });
      await importBackup(other, damaged);
      eq(await mo.keptHolidays(other), {
        "2026-11-13": { name: "Good", plan: "", u: 5 }, "2026-11-16": { name: "", plan: "", u: 9 },
        "2026-11-17": { name: "N".repeat(40), plan: "Walk", u: 3 }, "2026-11-18": { name: "Neg", plan: "", u: 0 }
      }, "cleaned");
      eq(await other.page.evaluate(() => Kyoshi.apps.momo.holidaysIn("2026-09-30", "2027-12-31").map(h => h.date)), ["2026-11-13", "2026-11-17", "2026-11-18"], "the marker isn't a holiday");
      // Nov 13 is the Friday of the Nov 14 weekend: joined to it; the others are rows of their own.
      const w2 = await mo.weekends(other);
      eq(rowsOf(w2).map(x => x.days), [`Tue Nov 17 · ${"N".repeat(40)}`, "Wed Nov 18 · Neg"], "their rows");
      eq(tileOf(w2, "2026-11-14").days, "Nov 13–15", "Good joins its weekend");
    }
  },
  {
    name: "momo holidays: two devices combine, the removal wins over an older rename and a later re-add over the removal",
    async run(t) {
      const tab = await open(t, { app: "momo", size: DESKTOP }), p = tab.page;
      await mo.openHolidays(tab);
      await mo.pasteHolidays(tab, "Nov 11 Lone day");
      await mo.closeHolidays(tab);
      await mo.openHoliday(tab, "2026-11-11");
      await p.fill("#kMount #weekendPlan", "Museum");
      await p.press("#kMount #weekendPlan", "Enter");
      // Adding the date again renames it and keeps the plan.
      await mo.openHolidays(tab);
      await mo.pasteHolidays(tab, "Nov 11 Renamed");
      await mo.closeHolidays(tab);
      const kept = (await mo.keptHolidays(tab))["2026-11-11"];
      eq([kept.name, kept.plan], ["Renamed", "Museum"], "renamed, the plan kept");

      // Another device's save (the sync folder, the cloud): its record for Nov 11, combined as the engine does.
      const combine = (date, record) => p.evaluate(({ date, record }) => {
        const A = Kyoshi.apps.momo, raw = JSON.parse(JSON.stringify(A.data.build()));
        if (record) raw.holidays[date] = record;
        else delete raw.holidays[date];
        const c = A.data.combine(raw, { replace: false, plain: false, mine: { savedAt: "2", device: "b" }, theirs: { savedAt: "1", device: "a" } });
        const changed = c.apply();
        if (changed) A.data.afterSync();
        return changed;
      }, { date, record });
      const u = kept.u, date = "2026-11-11";
      eq(rowsOf(await mo.weekends(tab)).map(x => x.days), ["Wed Nov 11 · Renamed"], "the rename shows");

      // The other device removed it after this one renamed it: the removal wins.
      eq(await combine(date, { name: "", plan: "", u: u + 1000 }), true, "a later removal");
      eq(await mo.keptHolidays(tab).then(h => h[date]), { name: "", plan: "", u: u + 1000 }, "kept as a marker");
      eq(rowsOf(await mo.weekends(tab)).length, 0, "its row is gone");
      lacks((await mo.weekends(tab)).summary, "holiday", "none ahead");
      // An older copy of the rename (before the removal) changes nothing.
      eq(await combine(date, { name: "Old name", plan: "", u: u + 500 }), false, "an older rename changes nothing");
      eq(await mo.keptHolidays(tab).then(h => h[date].name), "", "still removed");
      // A later re-add on the other device wins over the removal.
      eq(await combine(date, { name: "Back again", plan: "", u: u + 2000 }), true, "a later re-add");
      eq(await mo.keptHolidays(tab).then(h => h[date]), { name: "Back again", plan: "", u: u + 2000 }, "back");
      eq(rowsOf(await mo.weekends(tab)).map(x => x.days), ["Wed Nov 11 · Back again"], "its row is back");
      // A copy of Momo's without the key (an older Momo) changes nothing.
      eq(await combine(date, null), false, "an older copy without it changes nothing");
      // And the reverse: this device removes it, an older rename from the other changes nothing.
      await p.evaluate(d => Kyoshi.apps.momo.removeHoliday(d), date);
      const removedU = (await mo.keptHolidays(tab))[date].u;
      eq(await combine(date, { name: "Stale", plan: "", u: removedU - 1 }), false, "an older rename after this device's removal");
      eq(await mo.keptHolidays(tab).then(h => h[date].name), "", "removed here too");
    }
  },
  {
    name: "momo holidays: bug reports count them and never name one",
    async run(t) {
      const tab = await open(t, { app: "momo", size: DESKTOP }), p = tab.page;
      const state = () => p.evaluate(() => Kyoshi.apps.momo.bugState());
      eq((await state()).filter(l => l.startsWith("- Holidays")), ["- Holidays: 0 from today on (0 joined to the next 13 weekends, 0 on their own); kept: 0 (+0 removed)"], "none");
      await importBackup(tab, withHolidays(FIVE));
      let lines = await state();
      eq(lines.filter(l => l.startsWith("- Holidays")), ["- Holidays: 5 from today on (4 joined to the next 13 weekends, 1 on their own); kept: 5 (+0 removed)"], "five");
      for (const name of ["Day after", "Lone day", "Winter break"]) lacks(lines.join("\n"), name, `no name (${name})`);
      // A removed one is still kept (a marker) but no longer ahead.
      await p.evaluate(() => Kyoshi.apps.momo.removeHoliday("2026-11-11"));
      lines = await state();
      eq(lines.filter(l => l.startsWith("- Holidays")), ["- Holidays: 4 from today on (4 joined to the next 13 weekends, 0 on their own); kept: 4 (+1 removed)"], "one removed");
      lacks(lines.join("\n"), "Lone day", "still no name");
    }
  },
  {
    name: "momo holidays: the pop-up's reading of many formats, runs and what it can't read; Esc asks, Close doesn't",
    async run(t) {
      const tab = await open(t, { app: "momo", size: DESKTOP }), p = tab.page;
      await mo.openHolidays(tab);

      // Nothing readable says so (red), Add stays off; a date long gone is not understood either.
      await mo.pasteHolidays(tab, "nothing here", { add: false });
      eq(await mo.holidaysForm(tab).then(f => [f.read, f.bad, f.canAdd]), ["No holidays found; 1 line not understood (line 1).", true, false], "no holidays");
      await mo.pasteHolidays(tab, "2025-01-01 Long ago", { add: false });
      eq(await mo.holidaysForm(tab).then(f => [f.read, f.canAdd]), ["No holidays found; 1 line not understood (line 1).", false], "more than a year ago");

      // Formats: ISO, M/D/YYYY, M/D, a month's name (with st/th), day first, after a weekday, a CSV's date after its name,
      // a name left out ("Holiday"), a run Dec 20–22; a comment and a blank line skipped; the last line for a date wins.
      const lines = ["# my list", "2026-12-01 ISO", "12/2/2026 Slash year", "12/3 Slash short", "December 4th, 2026 Long", "5 Dec 2026 Day first", "Mon, Dec 7 Weekday",
        "Boxing,2026-12-08", "Dec 14", "Dec 20–22 Short run", "", "2025-01-01 Long ago", "Dec 1 ISO again"];
      await mo.pasteHolidays(tab, lines.join("\n"), { add: false });
      eq(await mo.holidaysForm(tab).then(f => f.read),
        `11 holidays: Tue Dec 1 ISO again, Wed Dec 2 Slash year, Thu Dec 3 Slash short, Fri Dec 4 Long, Sat Dec 5 Day first, Mon Dec 7 Weekday, and 3 more; 1 line not understood (line ${lines.indexOf("2025-01-01 Long ago") + 1}).`, "what it read");
      await p.click("#kMount #holidaysAddBtn");
      const kept = await mo.keptHolidays(tab);
      eq(Object.entries(kept).map(([d, h]) => [d, h.name]), [["2026-12-01", "ISO again"], ["2026-12-02", "Slash year"], ["2026-12-03", "Slash short"], ["2026-12-04", "Long"], ["2026-12-05", "Day first"],
        ["2026-12-07", "Weekday"], ["2026-12-08", "Boxing"], ["2026-12-14", "Holiday"], ["2026-12-20", "Short run"], ["2026-12-21", "Short run"], ["2026-12-22", "Short run"]], "kept");

      // Esc with something typed asks (No keeps the box); with the answer Yes it closes, and the box is empty next time.
      await p.fill("#kMount #holidaysText", "Nov 11 Lone day");
      tab.answers.push(false);
      await p.keyboard.press("Escape");
      eq([lastDialog(tab), (await mo.holidaysForm(tab)).open, (await mo.holidaysForm(tab)).text], ["Discard the holidays you've pasted or picked?", true, "Nov 11 Lone day"], "Esc asks first; No keeps it");
      await p.keyboard.press("Escape");
      eq([lastDialog(tab), (await mo.holidaysForm(tab)).open], ["Discard the holidays you've pasted or picked?", false], "Yes closes");
      eq(await mo.keptHolidays(tab).then(h => Object.keys(h).includes("2026-11-11")), false, "nothing was added");
      await mo.openHolidays(tab);
      eq(await mo.holidaysForm(tab).then(f => [f.text, f.read]), ["", ""], "opened empty again");
      // The × asks the same; Close doesn't, and neither does Esc with nothing typed.
      await p.fill("#kMount #holidaysText", "Nov 11 Lone day");
      tab.answers.push(false);
      await p.click("#kMount #holidaysOverlay .modal-close");
      eq([lastDialog(tab), (await mo.holidaysForm(tab)).open], ["Discard the holidays you've pasted or picked?", true], "× asks");
      await mo.closeHolidays(tab);
      eq([tab.dialogs.length, (await mo.holidaysForm(tab)).open], [0, false], "Close doesn't ask");
      await mo.openHolidays(tab);
      await p.keyboard.press("Escape");
      eq([tab.dialogs.length, (await mo.holidaysForm(tab)).open], [0, false], "Esc with nothing typed doesn't ask");

      // A picked file counts as pending too, and typing in the box lets go of it.
      await mo.openHolidays(tab);
      const file = ics([["BEGIN:VEVENT", "DTSTART;VALUE=DATE:20261112", "DTEND;VALUE=DATE:20261113", "SUMMARY:Founders Day", "END:VEVENT"]]);
      await p.setInputFiles("#kMount #holidaysFile", { name: "work.ics", mimeType: "text/calendar", buffer: Buffer.from(file) });
      await p.waitForFunction(() => document.querySelector("#kMount #holidaysRead").textContent.trim() !== "");
      eq(await mo.holidaysForm(tab).then(f => f.read), "From work.ics: 1 holiday: Thu Nov 12 Founders Day.", "a file, singular");
      tab.answers.push(false);
      await p.keyboard.press("Escape");
      eq([lastDialog(tab), (await mo.holidaysForm(tab)).open], ["Discard the holidays you've pasted or picked?", true], "a picked file asks too");
      await p.fill("#kMount #holidaysText", "Nov 5 Typed");
      eq(await mo.holidaysForm(tab).then(f => f.read), "1 holiday: Thu Nov 5 Typed.", "typing lets go of the file");

      // A day already past (within a year) is read and kept for the time off, but not listed.
      await mo.pasteHolidays(tab, "2026-09-01 Labor Day week", { add: false });
      eq(await mo.holidaysForm(tab).then(f => f.read), "1 holiday: Tue Sep 1 Labor Day week; 1 already past (kept for your time off, not listed).", "already past");
      await p.click("#kMount #holidaysAddBtn");
      eq(await mo.keptHolidays(tab).then(h => h["2026-09-01"].name), "Labor Day week", "kept");
      eq(await mo.holidaysForm(tab).then(f => f.rows.some(r => r.date === "2026-09-01")), false, "not listed");
    }
  },
  {
    name: "momo holidays: on a phone the pop-up and its list fit and the page doesn't scroll sideways",
    async run(t) {
      const tab = await open(t, { app: "momo", size: PHONE }), p = tab.page;
      await importBackup(tab, withHolidays({ ...FIVE, "2026-11-12": { name: "A holiday with quite a long name indeed", plan: "", u: 5 } }));
      await mo.openHolidays(tab);
      const box = await p.locator("#kMount #holidaysOverlay .modal").boundingBox();
      ok(box.x >= 0 && box.x + box.width <= PHONE.width, "the pop-up is on the screen");
      const rows = await p.$$eval("#kMount #holidaysList .holiday-row", els => els.map(e => { const r = e.getBoundingClientRect(), x = e.querySelector("[data-remove]").getBoundingClientRect(); return [r.left >= 0 && r.right <= window.innerWidth, x.left >= 0 && x.right <= window.innerWidth]; }));
      eq(rows.length, 4, "four rows (Dec 24–26 is one)");
      ok(rows.every(r => r[0] && r[1]), "each row and its ✕ on the screen");
      ok(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), "no sideways scroll");
      await mo.closeHolidays(tab);
      // The lone holiday's row among Today's tiles fits too.
      const w = await mo.weekends(tab);
      eq(rowsOf(w).map(x => x.days), ["Wed Nov 11 · Lone day", "Thu Nov 12 · A holiday with quite a long name indeed"], "Today's fold has the rows");
      ok(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), "still no sideways scroll");
    }
  }
];
