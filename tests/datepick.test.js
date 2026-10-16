/* Kyoshi · tests/datepick.test.js — Kyoshi's own calendar for every date box (core/datepick.js, the 2026-10-15 bug
 * report: weeks start on Monday, the weekend on the right): a click on a date box opens it at the box's month, Monday
 * first, today and the day in the box marked, days before the box's min not to be picked; ‹ › and « » move by month and
 * year; a day picked fills the box as typing would (the app hears it); Esc closes it and leaves the pop-up under it
 * open; typing in the box closes it; Clear empties the box; Hawky's Pick a day opens it by itself. */
"use strict";
const { TODAY, DESKTOP, PHONE, eq, ok, open, addDays } = require("./lib");
const hk = require("./hawky");

const M = "#kMount";
// The calendar as shown: { open, title, weekdays, first (the first day shown), days: [picked, today], disabled (days
// not to be picked, in the month shown) }.
const calendar = tab => tab.page.evaluate(() => {
  const c = document.querySelector(".datepick"), b = sel => [...c.querySelectorAll(sel)].map(e => e.dataset.day);
  if (!c || c.hidden) return { open: false };
  return {
    open: true, title: c.querySelector(".dp-title").textContent, weekdays: [...c.querySelectorAll(".dp-wd")].map(e => e.textContent),
    first: c.querySelector(".dp-day").dataset.day, picked: b(".dp-day.picked"), today: b(".dp-day.today"), disabled: b(".dp-day:not(.out):disabled").length
  };
});
const day = (tab, d) => tab.page.click(`.datepick .dp-day[data-day="${d}"]`);

module.exports = [
  {
    name: "date picker: Monday first, the weekend on the right; a day picked fills the box as typed (the app hears it); Esc closes it alone; typing closes it; Clear; months and years",
    async run(t) {
      const tab = await open(t, { app: "hawky", size: DESKTOP }), p = tab.page;
      await hk.addErrand(tab, "Return the drill", { day: "week" });
      await p.click(`${M} .errand-text >> nth=0`);
      await p.waitForSelector(`${M} #errandOverlay.open`);
      const due = await p.inputValue(`${M} #errandDue`);
      await p.click(`${M} #errandDue`);
      let c = await calendar(tab);
      eq(c.weekdays, ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"], "Monday first, Saturday and Sunday on the right");
      eq(new Date(`${c.first}T00:00:00Z`).getUTCDay(), 1, "its first day shown is a Monday");
      eq([c.open, c.picked, c.today], [true, [due], [TODAY]], "open at the box's month: its day and today marked");
      const pick = addDays(TODAY, 2);
      await day(tab, pick);
      eq([(await calendar(tab)).open, await p.inputValue(`${M} #errandDue`)], [false, pick], "a day picked: in the box, closed");
      await p.click(`${M} #errandForm button[type=submit]`);
      eq(await p.evaluate(() => Kyoshi.apps.hawky.live()[0].due), pick, "saved as picked");

      // Esc: the calendar alone; the pop-up stays.
      await p.click(`${M} .errand-text >> nth=0`);
      await p.click(`${M} #errandDue`);
      await p.keyboard.press("Escape");
      eq([(await calendar(tab)).open, await p.evaluate(() => document.querySelector("#kMount #errandOverlay").classList.contains("open"))], [false, true], "Esc closes the calendar, the pop-up stays");
      // Months and years, then Clear.
      await p.click(`${M} #errandDue`);
      const title = (await calendar(tab)).title;
      await p.click('.datepick .dp-nav[data-months="1"]');
      await p.click('.datepick .dp-nav[data-months="12"]');
      await p.click('.datepick .dp-nav[data-months="-12"]');
      ok((await calendar(tab)).title !== title, "› shows the next month");
      await p.click('.datepick .dp-nav[data-months="-1"]');
      eq((await calendar(tab)).title, title, "‹ and « » bring it back");
      await p.click('.datepick button:text-is("Clear")');
      eq(await p.inputValue(`${M} #errandDue`), "", "Clear empties the box");
      // Typing closes it.
      await p.click(`${M} #errandDue`);
      await p.fill(`${M} #errandDue`, addDays(TODAY, 5));
      eq((await calendar(tab)).open, false, "typing in the box closes it");
    }
  },
  {
    name: "date picker: Hawky's Pick a day opens it by itself, days before today not to be picked; the day picked is the errand's",
    async run(t) {
      const tab = await open(t, { app: "hawky", size: PHONE }), p = tab.page;
      await p.fill(`${M} #addText`, "Book the dentist");
      await p.click(`${M} #addDays [data-day="pick"]`);
      const c = await calendar(tab);
      eq([c.open, c.disabled], [true, +TODAY.slice(8) - 1], "open at once; the days before today can't be picked");
      const box = await p.locator(".datepick").boundingBox();
      ok(box.x >= 0 && box.x + box.width <= PHONE.width, "it fits the phone");
      const pick = addDays(TODAY, 1);
      await day(tab, pick);
      await p.click(`${M} #addBtn`);
      eq(await p.evaluate(() => Kyoshi.apps.hawky.live()[0].due), pick, "the errand is due that day");
    }
  }
];
