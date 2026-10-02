/* Kyoshi · tests/pabu-people.test.js — Pabu on its own, as the user uses it: quick add on the phone (the chips, the line
 * saying what was added, Enter, birthday only), ✓ and its undo, the person pop-up (a new how brings its minutes, the
 * birthday's three fields, the days you talked, Esc asking first, Delete leaving a marker), backups (Export gives back
 * what came in, a damaged file keeps what's usable, other apps' and empty ones change nothing), and time travel (people
 * come due again, the Birthdays strip follows the days). */
"use strict";
const { TODAY, PHONE, DESKTOP, eq, ok, has, open, lastDialog, importBackup, exportBackup, travel, addDays } = require("./lib");
const gen = require("./generate");
const pb = require("./pabu");

// The fixture's list as of TODAY (generate.js PEOPLE).
const LIST = {
  "Due now": [
    "Gran · Visit · every month · last talked 5 weeks ago · overdue 9 days",
    "Mom · Call · every month · last talked 5 weeks ago · overdue 4 days · 🎂 Oct 12 · turns 60",
    "Ana · Call · every 2 weeks · never talked · overdue 3 days"
  ],
  "Coming up": [
    "Sam · Text · every week · last talked yesterday · due in 6 days",
    "Jo · Call · every 2 weeks · last talked 4 days ago · due in 10 days"
  ],
  "Later": [
    "Lee · Visit · every quarter · last talked 10 days ago · due Dec 20",
    "Kai · Call · birthday only · never talked · 🎂 Oct 1"
  ]
};
const ids = tab => tab.page.evaluate(() => Object.fromEntries(Kyoshi.apps.pabu.live().map(p => [p.name, p.id])));
const person = (tab, id) => tab.page.evaluate(x => { const p = Kyoshi.apps.pabu.personById(x); return p && { ...p }; }, id);

module.exports = [
  {
    name: "pabu: quick add on a phone — the chips and what was added, Enter, birthday only, ✓ and its undo",
    async run(t) {
      const tab = await open(t, { app: "pabu", size: PHONE }), p = tab.page;
      ok(await p.locator("#kMount #listEmpty").isVisible(), "no one yet: the list says so");
      await pb.quickAdd(tab, "   ");
      eq((await pb.addState(tab)).status, "Type a name first.", "a name of spaces asks for one");

      // The chips start at every month and a call; a new person is due the day they're added.
      await pb.quickAdd(tab, "Mom");
      eq(await pb.addState(tab), { every: ["month"], how: ["call"], name: "", focused: true, status: "Added Mom: a call every month." }, "added with the chips as they start");
      eq(await pb.groups(tab), { "Due now": ["Mom · Call · every month · never talked · due today"] }, "due today");

      // Other chips: the line says so, then the field is empty with the focus kept, and the chips go back.
      await pb.quickAdd(tab, "Sam", { every: "week", how: "text" });
      eq(await pb.addState(tab), { every: ["month"], how: ["call"], name: "", focused: true, status: "Added Sam: a text every week." }, "a text every week, then the chips go back");
      await pb.quickAdd(tab, "Kai", { every: "none", enter: true });
      eq((await pb.addState(tab)).status, "Added Kai, birthday only: tap the name to add the birthday.", "Enter adds; birthday only");
      eq(await pb.groups(tab), {
        "Due now": ["Mom · Call · every month · never talked · due today", "Sam · Text · every week · never talked · due today"],
        "Later": ["Kai · Call · birthday only · never talked"]
      }, "birthday-only people wait in Later");
      eq(await pb.heads(tab), { "Due now": "2 · 40m", "Later": "1" }, "each group: how many, and the time Momo fits in");
      eq(await p.locator("#kMount #peopleCount").innerText(), "3", "the heading's count");

      // ✓: talked today, so the next is a week (Sam) or a month (Mom) on; ✓ again takes today off.
      const id = await ids(tab);
      await pb.tick(tab, id.Mom);
      await pb.tick(tab, id.Sam);
      eq(await pb.groups(tab), {
        "Coming up": ["Sam · Text · every week · talked today · due in 7 days"],
        "Later": ["Mom · Call · every month · talked today · due Oct 30", "Kai · Call · birthday only · never talked"]
      }, "talked today: on to Coming up and Later");
      ok(await p.locator(`#kMount .person[data-id="${id.Mom}"]`).evaluate(el => el.classList.contains("done")), "Mom's ✓ is filled");
      eq((await person(tab, id.Mom)).talks, [TODAY], "today is kept as a day you talked");
      await pb.tick(tab, id.Mom);
      eq((await pb.groups(tab))["Due now"], ["Mom · Call · every month · never talked · due today"], "✓ again: due today again");
      eq((await person(tab, id.Mom)).talks, [], "and today is gone");

      // Kept: after a reload, the same.
      await p.reload();
      await p.waitForFunction(() => Kyoshi.active() && Kyoshi.active().started);
      eq((await pb.groups(tab))["Coming up"], ["Sam · Text · every week · talked today · due in 7 days"], "kept through a reload");
      const wide = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      ok(wide <= 1, `no sideways scrolling at 390px (${wide}px over)`);
    }
  },
  {
    name: "pabu: the pop-up — how brings its minutes, the birthday's fields, the days you talked, Esc asks, Delete leaves a marker",
    async run(t) {
      const tab = await open(t, { app: "pabu", size: PHONE }), p = tab.page;
      await importBackup(tab, gen.pabu());
      await pb.openPerson(tab, "pp-mom");
      eq(await pb.popup(tab), {
        name: "Mom", every: "month", how: "call", minutes: "30", month: "10", day: "12", year: "1966",
        note: "Ask about the garden.\nShe's back from the lake on Friday.", talks: ["Aug 26", "Jul 22"], hint: ""
      }, "Mom, as kept");

      // A new how brings its usual minutes, unless they were changed.
      await pb.fill(tab, { how: "text" });
      eq((await pb.popup(tab)).minutes, "10", "a text: 10 minutes");
      await pb.fill(tab, { minutes: 45 });
      await pb.fill(tab, { how: "visit" });
      eq((await pb.popup(tab)).minutes, "45", "minutes typed in stay");

      // The days you talked: a day ahead and one already there are refused, under the list; Enter in the day's field adds
      // it (without saving); ✕ takes one off.
      await pb.addTalk(tab, addDays(TODAY, 1));
      eq((await pb.popup(tab)).hint, "That day hasn't come yet: pick today or a day before.", "a day after today is refused");
      await pb.addTalk(tab, addDays(TODAY, -35));
      eq((await pb.popup(tab)).hint, "Aug 26 is already there.", "a day already there");
      await pb.addTalk(tab, addDays(TODAY, -2), { enter: true });
      ok(await pb.isOpen(tab), "Enter in the day's field doesn't save");
      await pb.removeTalk(tab, addDays(TODAY, -70));
      eq(await pb.popup(tab).then(x => [x.talks, x.hint]), [["Sep 28", "Aug 26"], ""], "added, and the oldest taken off");

      // The birthday: an impossible one is refused (and so is Feb 29 in a year without it); then a real one with a year.
      await pb.fill(tab, { month: 2, day: 30 });
      await pb.save(tab);
      eq(lastDialog(tab), "February 1966 has 28 days: pick a day from 1 to 28.", "Feb 30 is refused");
      await pb.fill(tab, { day: 29, year: "" });
      await pb.save(tab);
      ok(!(await pb.isOpen(tab)), "Feb 29 without a year is fine");
      eq((await person(tab, "pp-mom")).birthday, "02-29", "kept without a year");
      await pb.openPerson(tab, "pp-mom");
      await pb.fill(tab, { day: 30 });
      await pb.save(tab);
      eq(lastDialog(tab), "February has 29 days: pick a day from 1 to 29.", "Feb 30 is refused without a year too");
      await pb.fill(tab, { month: "", day: "", year: 1970 });
      await pb.save(tab);
      eq(lastDialog(tab), "Pick the month and day of the birthday too, or clear the year.", "a year alone");
      await pb.fill(tab, { month: 10, day: 20, year: 2030 });
      await pb.save(tab);
      eq(lastDialog(tab), "The year born should be from 1900 to 2026, or left empty.", "a year to come");
      await pb.fill(tab, { year: 1970 });
      await pb.save(tab);
      ok(!(await pb.isOpen(tab)), "saved");
      eq(await pb.row(tab, "pp-mom"), "Mom · Visit · every month · last talked 2 days ago · due Oct 28 · 🎂 Oct 20 · turns 56", "the row follows");
      eq(await pb.birthdays(tab), ["Kai · Oct 1 · tomorrow", "Mom · Oct 20 · in 20 days · turns 56"], "and the strip");
      const mom = await person(tab, "pp-mom");
      eq([mom.how, mom.minutes, mom.birthday, mom.talks], ["visit", 45, "1970-10-20", [addDays(TODAY, -2), addDays(TODAY, -35)]], "as kept");

      // A name of spaces is refused.
      await pb.openPerson(tab, "pp-jo");
      await pb.fill(tab, { name: "  " });
      await pb.save(tab);
      eq(lastDialog(tab), "Type their name.", "a name first");
      // Esc with changes asks first: No keeps them, Yes drops them.
      await pb.fill(tab, { name: "Joanna" });
      tab.answers.push(false);
      await p.keyboard.press("Escape");
      eq(lastDialog(tab), "Discard your changes to this person?", "Esc asks");
      ok(await pb.isOpen(tab), "No: still open");
      await p.keyboard.press("Escape");
      eq(lastDialog(tab), "Discard your changes to this person?", "asked again");
      ok(!(await pb.isOpen(tab)), "Yes: closed");
      has(await pb.row(tab, "pp-jo"), "Jo · Call", "nothing was saved");
      // Without changes, Esc just closes.
      await pb.openPerson(tab, "pp-jo");
      await p.keyboard.press("Escape");
      ok(!(await pb.isOpen(tab)) && !tab.dialogs.length, "no question without changes");

      // Delete asks first; then the row is gone, and the backup keeps a marker with nothing personal in it.
      await pb.openPerson(tab, "pp-lee");
      tab.answers.push(false);
      await p.click("#kMount #personDeleteBtn");
      eq(lastDialog(tab), "Delete Lee, and the days you talked? This can't be undone.", "Delete asks");
      ok(await pb.isOpen(tab), "No: Lee stays");
      await p.click("#kMount #personDeleteBtn");
      ok(!(await pb.isOpen(tab)), "Yes: closed");
      eq(await pb.row(tab, "pp-lee"), "", "Lee's row is gone");
      const marker = (await exportBackup(tab)).people.find(x => x.id === "pp-lee");
      eq([marker.deleted, marker.name, marker.talks, marker.note, marker.birthday], [true, "", [], "", ""], "the export carries the marker");
    }
  },
  {
    name: "pabu: the pop-up saves only what was changed there — another tab's ✓ meanwhile stays; — takes a birthday off",
    async run(t) {
      const flo = { id: "pp-flo", name: "Great-aunt Flo", every: "year", how: "visit", minutes: 120, talks: [200], birthday: "1850-03-01" };
      const a = await open(t, { app: "pabu", size: DESKTOP }), p = a.page;
      await importBackup(a, gen.pabu(gen.PEOPLE.concat(flo)));
      const b = await open(t, { ctx: a.ctx, app: "pabu", size: DESKTOP });

      // Mom's pop-up is open here while she gets her ✓ in the other tab: changing her note keeps that ✓.
      await pb.openPerson(a, "pp-mom");
      await pb.tick(b, "pp-mom");
      await p.waitForFunction(() => Kyoshi.apps.pabu.personById("pp-mom").talks.length === 3, null, { timeout: 5000 });
      await pb.fill(a, { note: "Ask about the trip." });
      await pb.save(a);
      const mom = await person(a, "pp-mom");
      eq([mom.note, mom.talks, mom.birthday], ["Ask about the trip.", [TODAY, addDays(TODAY, -35), addDays(TODAY, -70)], "1966-10-12"], "the note, and the other tab's ✓ kept");

      // A half-typed day isn't lost without a word.
      await pb.openPerson(a, "pp-mom");
      await p.click("#kMount #personTalkDate");
      await p.keyboard.type("09");
      await pb.save(a);
      eq([await pb.isOpen(a), (await pb.popup(a)).hint], [true, "Finish the day, or clear it."], "a half-typed day");
      await p.fill("#kMount #personTalkDate", "");

      // "—" for the month takes the birthday off, its day and year with it.
      await pb.fill(a, { month: "" });
      eq(await pb.popup(a).then(x => [x.month, x.day, x.year]), ["", "", ""], "the day and year go too");
      await pb.save(a);
      eq((await person(a, "pp-mom")).birthday, "", "no birthday");
      eq(await pb.row(a, "pp-mom"), "Mom · Call · every month · talked today · due Oct 30", "no 🎂 line");
      eq(await pb.birthdays(a), ["Kai · Oct 1 · tomorrow"], "nor in the strip");

      // A birthday kept with a year the pop-up wouldn't take (from a backup) stands while something else is changed…
      await pb.openPerson(a, "pp-flo");
      await pb.fill(a, { minutes: 90 });
      await pb.save(a);
      eq([await pb.isOpen(a), (await person(a, "pp-flo")).minutes, (await person(a, "pp-flo")).birthday], [false, 90, "1850-03-01"], "saved, the birthday as it was");
      // …and is checked once it's changed.
      await pb.openPerson(a, "pp-flo");
      await pb.fill(a, { day: 2 });
      await pb.save(a);
      eq(lastDialog(a), "The year born should be from 1900 to 2026, or left empty.", "a changed birthday is checked");
    }
  },
  {
    name: "pabu: backups — Export gives back what came in, a damaged file keeps what's usable, other apps' and empty ones change nothing",
    async run(t) {
      const tab = await open(t, { app: "pabu", size: DESKTOP }), data = gen.pabu();
      await importBackup(tab, data);
      eq(tab.dialogs, [], "a first import asks nothing");
      eq(await pb.groups(tab), LIST, "the list");
      eq(await pb.heads(tab), { "Due now": "3 · 3h", "Coming up": "2 · 40m", "Later": "2 · 2h" }, "the groups' heads");
      eq(await pb.birthdays(tab), ["Kai · Oct 1 · tomorrow", "Mom · Oct 12 · in 12 days · turns 60"], "the Birthdays strip");
      const back = await exportBackup(tab);
      eq([back.schemaVersion, back.appVersion, back.people], [1, "1.000", data.people], "Export gives back the people (and the marker) as they came in");

      // A damaged file: only what's usable, with the counts asked first.
      await importBackup(tab, gen.damagedPabu());
      eq(lastDialog(tab), "Replace your 7 people with the 3 people in this backup? This can't be undone.", "the counts");
      eq(await pb.groups(tab), {
        "Due now": [`${"N".repeat(40)} · Visit · every week · never talked · due today · 🎂 Feb 28`, "Old clock · Text · every month · never talked · due today"],
        "Later": ["Rae Lynn · Call · every month · last talked 3 days ago · due Oct 27"]
      }, "three people: names tidied and cut, a day ahead ignored, a newer version's how often read as every month");
      eq(await pb.heads(tab), { "Due now": "2 · 2h 13m", "Later": "1 · 30m" }, "minutes out of range: how's usual; 12.6 rounds to 13");
      const kept = Object.fromEntries((await exportBackup(tab)).people.map(x => [x.id, x]));
      eq(Object.keys(kept), ["d1", "d2", "d3", "d4"], "the unusable ones are gone");
      eq([kept.d1.every, kept.d1.talks, kept.d1.birthday, kept.d1.note], ["fortnight", [addDays(TODAY, 2), addDays(TODAY, -3)], "", ""], "a newer version's how often survives; the day ahead too");
      eq([kept.d2.birthday, kept.d2.minutes, kept.d4.at, kept.d4.u], ["02-29", 120, 0, 0], "Feb 29 is a birthday; no number: how's minutes; moments no date can hold are dropped");
      eq(kept.d3, { id: "d3", name: "", every: "month", how: "call", minutes: 30, talks: [], note: "", birthday: "", deleted: true, at: 1, u: 1 }, "a deleted marker keeps nothing personal");

      // Other apps' backups, and ones with nobody in them, change nothing.
      for (const other of [gen.hawky(), gen.turtleduck()]) {
        await importBackup(tab, other);
        eq(lastDialog(tab), "That file doesn't look like a Pabu backup.", "another app's backup is refused");
      }
      for (const people of [[], [{ id: "x", deleted: true }]]) {
        await importBackup(tab, { schemaVersion: 1, people });
        eq(lastDialog(tab), "That backup has no people in it, so nothing was changed.", "nobody in it");
      }
      eq(Object.values(await pb.groups(tab)).flat().length, 3, "still the three");

      // A newer version's backup: a heads-up, then it's in.
      await importBackup(tab, { ...gen.pabu(gen.PEOPLE.slice(0, 1)), schemaVersion: 2 });
      eq(tab.dialogs.map(d => d[1]), [
        "Heads up: this backup was made by a newer version of Pabu. Importing it anyway, but some data may not carry over.",
        "Replace your 3 people with the 1 person in this backup? This can't be undone."
      ], "a heads-up, then the counts");
      eq(await pb.groups(tab), { "Due now": [LIST["Due now"][0]] }, "Gran alone");
    }
  },
  {
    name: "pabu: time travel — talked today moves people on, they come due again, the Birthdays strip follows the days",
    async run(t) {
      const tab = await open(t, { app: "pabu", size: PHONE });
      await importBackup(tab, gen.pabu());
      await pb.tick(tab, "pp-sam");
      await pb.tick(tab, "pp-mom");
      eq((await pb.groups(tab))["Due now"], [LIST["Due now"][0], LIST["Due now"][2]], "Sam and Mom leave Due now");
      eq(await pb.row(tab, "pp-sam"), "Sam · Text · every week · talked today · due in 7 days", "Sam: a week on");
      eq(await pb.row(tab, "pp-mom"), "Mom · Call · every month · talked today · due Oct 30 · 🎂 Oct 12 · turns 60", "Mom: a month on");

      await travel(tab, 1); // Thursday, Oct 1: Kai's birthday
      eq(await pb.birthdays(tab), ["Kai · Oct 1 · today", "Mom · Oct 12 · in 11 days · turns 60"], "Kai's birthday is today");
      eq(await pb.row(tab, "pp-kai"), "Kai · Call · birthday only · never talked · 🎂 today", "on the row too");
      eq(await pb.row(tab, "pp-sam"), "Sam · Text · every week · last talked yesterday · due in 6 days", "a day on");

      await travel(tab, 6); // Wednesday, Oct 7
      eq(await pb.row(tab, "pp-sam"), "Sam · Text · every week · last talked 7 days ago · due today", "Sam is due again");
      ok((await pb.groups(tab))["Due now"].some(x => x.startsWith("Sam ·")), "in Due now");
      eq(await pb.birthdays(tab), ["Mom · Oct 12 · in 5 days · turns 60"], "Kai's has passed");

      await travel(tab, 10); // Saturday, Oct 17
      eq(await pb.row(tab, "pp-mom"), "Mom · Call · every month · last talked 2 weeks ago · due in 13 days · 🎂 Oct 12 · turns 61", "Mom comes up");
      ok((await pb.groups(tab))["Coming up"].some(x => x.startsWith("Mom ·")), "in Coming up");
      eq(await pb.birthdays(tab), [], "no birthday in the next 30 days: the strip is hidden");

      await travel(tab, 14); // Saturday, Oct 31
      eq(await pb.row(tab, "pp-mom"), "Mom · Call · every month · last talked 4 weeks ago · overdue 1 day · 🎂 Oct 12 · turns 61", "Mom is overdue again");
      eq(await pb.row(tab, "pp-gran"), "Gran · Visit · every month · last talked 2 months ago · overdue 40 days", "Gran, long overdue");
    }
  }
];
