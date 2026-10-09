/* Kyoshi · tests/pabu-setup.test.js — Pabu's Set up (Developer Mode's Set up…): who you're in a relationship with and
 * your anniversary, as the user sees it: a heart by their name with the date and the years on People, a row in the strip
 * when it's within 30 days (its heading "Birthdays & anniversary"), "Our anniversary" on Momo's board on its day (✓ once
 * you talked that day); what Save can't take, said and marked; picking someone shows theirs; Esc asks first; another
 * person, then no one; only those changed are stamped; backups (Export carries it, an older one imports with none, a
 * damaged one keeps what's usable). */
"use strict";
const { TODAY, DESKTOP, eq, ok, open, lastDialog, importBackup, exportBackup, switchTo, travel } = require("./lib");
const gen = require("./generate");
const pb = require("./pabu");

// People's line for someone (by name, a heart after it or not).
const line = async (tab, name) => (await pb.people(tab)).find(l => l.split(" · ")[0].replace(/ ♥$/, "") === name) || "";
// The board's events at any time of day, in its day headings, by their words (as tests/pabu-momo.test.js reads them).
const marks = tab => tab.page.$$eval("#kMount #board .ev-mark", els => els.map(e => ({ title: e.getAttribute("title"), done: e.classList.contains("done") })));
// Who's the partner, and the anniversary, in the backup Export gives: [[id, partner, anniversary]] for those with either.
const together = async tab => (await exportBackup(tab)).people.filter(x => x.partner || x.anniversary).map(x => [x.id, x.partner, x.anniversary]);

module.exports = [
  {
    name: "pabu setup: the one you're with and your anniversary — a heart by their name with the years, the strip, Momo's board on the day (✓ once you talked); what Save can't take; Esc asks; another person, no one",
    async run(t) {
      const tab = await open(t, { app: "pabu", size: DESKTOP }), p = tab.page, data = gen.pabuCircle();
      await importBackup(tab, data);
      // No one yet: the anniversary's fields are off; everyone, A to Z. Developer Mode closes for it.
      await pb.openSetup(tab);
      eq(await pb.setup(tab), { partner: "— no one", offered: ["— no one", "Bo", "Dad", "Ivy", "Mom", "Raj", "Zoe"], month: "", day: "", year: "", off: true, hint: "", marked: [] }, "no one yet");
      ok(!(await p.evaluate(() => document.body.classList.contains("dev-mode"))), "Developer Mode closed");

      // Mom: what Save can't take is said above it, the field marked; nothing is saved till it can.
      await pb.fillSetup(tab, { partner: "Mom", month: 10 });
      eq((await pb.setup(tab)).off, false, "picking someone turns the fields on");
      await pb.saveSetup(tab);
      eq(await pb.setup(tab), { partner: "Mom", offered: ["— no one", "Bo", "Dad", "Ivy", "Mom", "Raj", "Zoe"], month: "10", day: "", year: "", off: false, hint: "Type the day of the anniversary too.", marked: ["day"] }, "the day");
      await pb.fillSetup(tab, { day: 4, year: 2027 });
      await pb.saveSetup(tab);
      eq([(await pb.setup(tab)).hint, (await pb.setup(tab)).marked], ["The year should be from 1900 to 2026, or left empty.", ["year"]], "a year to come");
      await pb.fillSetup(tab, { year: 2021 });
      await pb.saveSetup(tab);
      ok(!(await pb.setupOpen(tab)), "saved: closed");
      eq(await line(tab, "Mom"), "Mom ♥ · Family · Call weekly · Visit monthly · overdue 9 days · 🎂 Oct 12 · turns 60 · ♥ Oct 4 · 5 years", "a heart by her name, the anniversary with the years");
      eq([await pb.stripTitle(tab), await pb.birthdays(tab)], ["Birthdays & anniversary", ["♥ Mom · Oct 4 · in 4 days · 5 years", "Mom · Oct 12 · in 12 days · turns 60", "Zoe · Oct 15 · in 15 days"]],
        "the strip: the anniversary first, by day");
      const kept = (await exportBackup(tab)).people;
      eq(kept.filter(x => x.partner || x.anniversary).map(x => [x.id, x.partner, x.anniversary]), [["pc-mom", true, "2021-10-04"]], "Export carries it, on Mom alone");
      eq(kept.filter(x => x.u !== data.people.find(y => y.id === x.id).u).map(x => x.id), ["pc-mom"], "only Mom is stamped");

      // Momo: Sunday's heading.
      await switchTo(tab, "momo");
      eq(await marks(tab), [{ title: "Our anniversary (5 years · Mom), Sun any time, from Pabu", done: false }], "Our anniversary, on Sunday");
      await switchTo(tab, "pabu");

      // Set up opens as kept; picking someone shows theirs (none), Mom again hers. Esc asks first; Cancel doesn't.
      await pb.openSetup(tab);
      eq(await pb.setup(tab), { partner: "Mom", offered: ["— no one", "Bo", "Dad", "Ivy", "Mom", "Raj", "Zoe"], month: "10", day: "4", year: "2021", off: false, hint: "", marked: [] }, "as kept");
      await pb.fillSetup(tab, { partner: "Dad" });
      eq([(await pb.setup(tab)).month, (await pb.setup(tab)).day, (await pb.setup(tab)).year], ["", "", ""], "Dad has none");
      tab.answers.push(false);
      await p.keyboard.press("Escape");
      eq([lastDialog(tab), await pb.setupOpen(tab)], ["Discard your changes?", true], "Esc asks; No keeps it open");
      await pb.fillSetup(tab, { partner: "Mom" });
      eq([(await pb.setup(tab)).month, (await pb.setup(tab)).day, (await pb.setup(tab)).year], ["10", "4", "2021"], "Mom's again");
      await pb.cancelSetup(tab);
      eq([lastDialog(tab), await pb.setupOpen(tab)], ["", false], "Cancel asks nothing");

      // Dad, no date: Mom's heart and anniversary go, Dad's heart comes; the strip is Birthdays again.
      await pb.openSetup(tab);
      await pb.fillSetup(tab, { partner: "Dad" });
      await pb.saveSetup(tab);
      eq([await line(tab, "Mom"), await line(tab, "Dad")], ["Mom · Family · Call weekly · Visit monthly · overdue 9 days · 🎂 Oct 12 · turns 60", "Dad ♥ · family · Text every 2 weeks · due in 13 days"],
        "Dad's heart, no anniversary line");
      eq([await pb.stripTitle(tab), await pb.birthdays(tab)], ["Birthdays", ["Mom · Oct 12 · in 12 days · turns 60", "Zoe · Oct 15 · in 15 days"]], "the strip");
      eq(await together(tab), [["pc-dad", true, ""]], "kept: Dad, no anniversary");
      // No one: nobody.
      await pb.openSetup(tab);
      await pb.fillSetup(tab, { partner: "— no one" });
      eq((await pb.setup(tab)).off, true, "the fields are off");
      await pb.saveSetup(tab);
      ok((await pb.people(tab)).every(l => !l.includes("♥")), "no hearts");
      eq(await together(tab), [], "kept: no one");

      // On the day (Sunday, Oct 4): "today"; talked to her that day, ✓ on the board.
      await pb.openSetup(tab);
      await pb.fillSetup(tab, { partner: "Mom", month: 10, day: 4, year: 2021 });
      await pb.saveSetup(tab);
      await travel(tab, 4);
      eq([(await line(tab, "Mom")).split(" · ").slice(-2).join(" · "), (await pb.birthdays(tab))[0]], ["♥ today · 5 years", "♥ Mom · Oct 4 · today · 5 years"], "today");
      await pb.tick(tab, "Call Mom");
      await switchTo(tab, "momo");
      eq(await marks(tab), [{ title: "Our anniversary (5 years · Mom), Sun any time, from Pabu — done ✓", done: true }], "done ✓");
    }
  },
  {
    name: "pabu setup: backups — an older backup imports with no one, a damaged one keeps what's usable, a deleted marker keeps neither; no one at all, Set up offers only no one",
    async run(t) {
      const tab = await open(t, { app: "pabu", size: DESKTOP });
      // Before 2.231 there was neither field.
      const older = gen.pabuCircle();
      older.people.forEach(x => { delete x.partner; delete x.anniversary; });
      await importBackup(tab, older);
      eq(await together(tab), [], "an older backup: no one");
      eq((await exportBackup(tab)).people.map(x => [x.partner, x.anniversary]).filter(([a, b]) => a !== false || b !== ""), [], "each false and \"\"");

      await importBackup(tab, { schemaVersion: 2, people: [
        { id: "x1", name: "Ann", partner: "yes", anniversary: "13-45" },
        { id: "x2", name: "Ben", partner: true, anniversary: "02-30" },
        { id: "x3", name: "Cy", partner: false, anniversary: `${TODAY.slice(0, 4)}-02-29` },
        { id: "x4", deleted: true, partner: true, anniversary: "10-04" }
      ] });
      eq((await exportBackup(tab)).people.map(x => [x.id, x.partner, x.anniversary]), [["x1", false, ""], ["x2", true, ""], ["x3", false, ""], ["x4", false, ""]],
        "\"yes\" isn't true, an impossible day is dropped (Feb 29 in a year without it too), a marker keeps neither");
      eq([await line(tab, "Ben"), await pb.stripTitle(tab)], ["Ben ♥ · Call monthly · due today", "Birthdays"], "Ben's heart, no anniversary");

      // With no one at all (the last one deleted), Set up offers only no one.
      await importBackup(tab, { schemaVersion: 2, people: [{ id: "x5", name: "Dee", partner: true }] });
      await pb.openPerson(tab, "Dee");
      await pb.remove(tab);
      eq([lastDialog(tab), await pb.people(tab)], ["Delete Dee, and the days you talked? This can't be undone.", []], "Dee deleted");
      eq(await together(tab), [], "her marker keeps neither");
      await pb.openSetup(tab);
      eq([(await pb.setup(tab)).offered, (await pb.setup(tab)).off], [["— no one"], true], "only no one");
      await pb.saveSetup(tab);
      ok(!(await pb.setupOpen(tab)), "Save just closes");
    }
  }
];
