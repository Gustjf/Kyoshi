/* Kyoshi · tests/momo-holidays-template.test.js — the Holidays pop-up's Fill with a template (the next 12 months of common
 * US holidays, each on its day that year, as lines to edit) and Copy (the box, for keeping the list elsewhere): filled,
 * edited (a date changed, a line deleted, one added), read and added; asked before it replaces what's typed. Today is
 * Wed 2026-09-30 (tests/lib.js), so the template runs Columbus Day 2026 to Labor Day 2027. */
"use strict";
const { DESKTOP, eq, ok, open, lastDialog } = require("./lib");
const mo = require("./momo");

const M = "#kMount";
const TEMPLATE = [
  "2026-10-12 Columbus Day", "2026-11-11 Veterans Day", "2026-11-26 Thanksgiving", "2026-11-27 Day after Thanksgiving",
  "2026-12-24 Christmas Eve", "2026-12-25 Christmas Day", "2026-12-31 New Year's Eve", "2027-01-01 New Year's Day",
  "2027-01-18 Martin Luther King Jr. Day", "2027-02-15 Presidents' Day", "2027-05-31 Memorial Day", "2027-06-19 Juneteenth",
  "2027-07-04 Independence Day", "2027-09-06 Labor Day"
];
const box = tab => tab.page.inputValue(`${M} #holidaysText`);

module.exports = [
  {
    name: "momo holidays: Fill with a template gives the next 12 months of US holidays on their days, to edit and Add; Copy copies the box",
    async run(t) {
      const tab = await open(t, { app: "momo", size: DESKTOP }), p = tab.page;
      await tab.ctx.grantPermissions(["clipboard-read", "clipboard-write"]).catch(() => {});
      await mo.openHolidays(tab);
      await p.click(`${M} #holidaysCopyBtn`);
      eq(await p.textContent(`${M} #holidaysCopied`), "Nothing to copy.", "an empty box");
      await p.click(`${M} #holidaysTemplateBtn`);
      eq(tab.dialogs.length, 0, "an empty box isn't asked about");
      const lines = (await box(tab)).trim().split("\n");
      ok(lines[0].startsWith("# "), "a comment on top, ignored when read");
      eq(lines.slice(1), TEMPLATE, "the next 12 months, in date order, each on its day");
      eq((await mo.holidaysForm(tab)).read.slice(0, 50), "14 holidays: Mon Oct 12 Columbus Day, Wed Nov 11 V", "read as typed");
      // Edited as the owner would: Veterans Day off the list, Columbus Day moved, a day of their own added.
      const edited = (await box(tab)).replace("2026-11-11 Veterans Day\n", "").replace("2026-10-12 Columbus", "2026-10-13 Columbus") + "2026-12-28 Office closed\n";
      await mo.pasteHolidays(tab, edited, { add: false });
      ok((await mo.holidaysForm(tab)).read.startsWith("14 holidays: Tue Oct 13 Columbus Day, Thu Nov 26 Thanksgiving"), "the edits read");
      await p.click(`${M} #holidaysCopyBtn`);
      await p.waitForFunction(() => document.querySelector("#kMount #holidaysCopied").textContent !== ""); // the clipboard answers later
      const copied = await p.textContent(`${M} #holidaysCopied`);
      ok(copied === "Copied." || copied === "Couldn't copy: select the text and copy it.", `Copy says what happened: ${copied}`);
      if (copied === "Copied.") eq(await p.evaluate(() => navigator.clipboard.readText()), edited, "the box, as it is");
      await p.click(`${M} #holidaysAddBtn`);
      const kept = await mo.keptHolidays(tab);
      eq(Object.keys(kept).length, 14, "14 kept");
      eq([kept["2026-10-13"].name, kept["2026-12-28"].name, "2026-11-11" in kept, "2026-10-12" in kept], ["Columbus Day", "Office closed", false, false], "as edited");
      // With something in the box, the template asks first: No keeps it, Yes replaces it.
      await mo.pasteHolidays(tab, "2027-03-01 Mine", { add: false });
      tab.answers.push(false);
      await p.click(`${M} #holidaysTemplateBtn`);
      eq([lastDialog(tab), await box(tab)], ["Replace what's in the box with the template?", "2027-03-01 Mine"], "No keeps it");
      await p.click(`${M} #holidaysTemplateBtn`);
      eq((await box(tab)).trim().split("\n").slice(1), TEMPLATE, "Yes replaces it");
      eq(await p.textContent(`${M} #holidaysCopied`), "", "Copy's note goes once the box changes");
    }
  }
];
