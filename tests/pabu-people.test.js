/* Kyoshi · tests/pabu-people.test.js — Pabu on its own, as the user uses it: quick add on a phone (its chips keeping the
 * keyboard up, the line saying what was added, Enter, birthday only), This week (soonest first, overdue in red, ✓ adds
 * today and the line keeps its place until Sunday, ✓ again takes that day off), the person pop-up (a box per call, text
 * or visit: how brings its minutes, how often, ✕, the days you talked, "Talked on" and Add, + Add one; the group's
 * spelling in use, notes, Save and Enter, Cancel, Esc asking first; the birthday's three fields and what Save can't take,
 * said above it and marked; a "Talked on" day at Save; Delete leaving a marker), Save writing the whole person over
 * another tab's change, People (a line per person A to Z, group chips), backups (Export gives back what came in, version
 * 1 imports, a damaged file keeps what's usable, others change nothing), and time travel (a call comes due again, the
 * Birthdays strip follows the days). */
"use strict";
const { TODAY, PHONE, DESKTOP, eq, ok, has, lacks, open, lastDialog, importBackup, exportBackup, travel, addDays } = require("./lib");
const gen = require("./generate");
const pb = require("./pabu");

const D = n => addDays(TODAY, n);
// People's line for someone (by name), and This week's lines as one string.
const line = async (tab, name) => (await pb.people(tab)).find(l => l.startsWith(`${name} · `)) || "";
const weekText = async tab => ((await pb.thisWeek(tab)) || { lines: [] }).lines.join(" | ");

module.exports = [
  {
    name: "pabu: quick add on a phone — its chips keep the keyboard up, the line says what was added, Enter, birthday only; This week's ✓ adds today, ✓ again takes it off",
    async run(t) {
      const tab = await open(t, { app: "pabu", size: PHONE }), p = tab.page;
      eq([await pb.thisWeek(tab), await pb.peopleHead(tab)], [null, { count: "", empty: "No one yet. Add the people you want to stay close to above." }], "no one yet: no This week, and People says so");
      await pb.quickAdd(tab, "   ");
      eq(await pb.addState(tab), { every: ["month"], how: ["call"], name: "   ", focused: true, status: "Type a name first.", bad: true }, "a name of spaces asks for one");

      // The chips start at every month and a call; then the field is empty, with the focus kept, for the next one.
      await pb.quickAdd(tab, "Mom");
      eq(await pb.addState(tab), { every: ["month"], how: ["call"], name: "", focused: true, status: "Added Mom: a call every month.", bad: false }, "added with the chips as they start");
      // Tapping chips leaves the focus in the field (the phone's keyboard stays up); after the add they go back.
      await pb.quickAdd(tab, "Sam", { every: "week", how: "text", add: false });
      eq(await pb.addState(tab), { every: ["week"], how: ["text"], name: "Sam", focused: true, status: "", bad: false }, "every week and a text, the focus still in the field");
      await pb.submitAdd(tab);
      eq(await pb.addState(tab), { every: ["month"], how: ["call"], name: "", focused: true, status: "Added Sam: a text every week.", bad: false }, "said, then the chips go back");
      await pb.quickAdd(tab, "Kai", { every: "none", enter: true });
      eq((await pb.addState(tab)).status, "Added Kai, birthday only: tap the name to add the birthday.", "Enter adds; birthday only");

      // A new call or text is due the day it's added; Kai, birthday only, has none.
      eq(await pb.thisWeek(tab), { count: "2", lines: ["Call Mom · due today · 30m", "Text Sam · due today · 10m"], late: [], empty: "" }, "This week");
      eq([await pb.people(tab), (await pb.peopleHead(tab)).count], [["Kai · Birthday only", "Mom · Call monthly · due today", "Sam · Text weekly · due today"], "3"], "People: a line each, A to Z, and how many");

      // ✓: talked today, so Mom's call is next due in a month, but its line keeps its place, ticked; ✓ again takes today off.
      await pb.tick(tab, "Call Mom");
      eq(await pb.thisWeek(tab), { count: "1 of 2 done", lines: ["✓ Call Mom · talked today · 30m", "Text Sam · due today · 10m"], late: [], empty: "" }, "ticked, in its place");
      eq(await line(tab, "Mom"), "Mom · Call monthly · due Oct 30", "a month on");
      eq((await pb.person(tab, "Mom")).cadences[0].talks, [TODAY], "today is kept as a day you talked");
      await pb.tick(tab, "Call Mom");
      eq([(await pb.thisWeek(tab)).lines[0], await line(tab, "Mom")], ["Call Mom · due today · 30m", "Mom · Call monthly · due today"], "✓ again: due today again");
      eq((await pb.person(tab, "Mom")).cadences[0].talks, [], "and today is gone");

      // Kept: after a reload, the same.
      await pb.tick(tab, "Text Sam");
      await p.reload();
      await p.waitForFunction(() => Kyoshi.active() && Kyoshi.active().started);
      eq((await pb.thisWeek(tab)).lines, ["Call Mom · due today · 30m", "✓ Text Sam · talked today · 10m"], "kept through a reload");
      ok(await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth <= 1), "no sideways scrolling at 390px");
    }
  },
  {
    name: "pabu: the pop-up — a box per call, text or visit (how brings its minutes, how often, ✕, the days talked, Talked on and Add), + Add one; group and notes, Save and Enter, Cancel, Esc asks first",
    async run(t) {
      const tab = await open(t, { app: "pabu", size: PHONE }), p = tab.page;
      await importBackup(tab, gen.pabu());
      await pb.openPerson(tab, "Mom");
      eq(await pb.popup(tab), {
        name: "Mom", group: "", offered: [], month: "10", day: "12", year: "1966", note: "Ask about the garden.\nShe's back from the lake on Friday.",
        boxes: [{ how: "call", every: "month", minutes: "30", last: "Last talked 5 weeks ago · overdue 4 days", talks: ["Aug 26", "Jul 22"], hint: "" }],
        none: false, more: true
      }, "Mom as kept: her one call, carried over from a version 1 backup");

      // A new how brings its usual minutes, unless they were changed; a new how often changes when it's due.
      await pb.setBox(tab, 1, { how: "text" });
      eq((await pb.popup(tab)).boxes[0].minutes, "10", "a text: 10 minutes");
      await pb.setBox(tab, 1, { how: "visit" });
      eq((await pb.popup(tab)).boxes[0].minutes, "120", "a visit: 120");
      await pb.setBox(tab, 1, { minutes: 45, how: "call" });
      eq((await pb.popup(tab)).boxes[0].minutes, "45", "minutes typed in stay");
      await pb.setBox(tab, 1, { every: "week" });
      eq((await pb.popup(tab)).boxes[0].last, "Last talked 5 weeks ago · overdue 28 days", "every week: due a week after the last talk");

      // The days you talked: a day ahead, one already there, or none is refused under them; Enter in "Talked on" adds the day
      // (without saving); ✕ takes one off.
      for (const [day, why] of [[D(1), "That day hasn't come yet: pick today or a day before."], [D(-35), "Aug 26 is already there."], ["", "Pick the day first."]]) {
        await pb.talkedOn(tab, 1, day);
        eq((await pb.popup(tab)).boxes[0].hint, why, `"${day}" refused`);
      }
      await pb.talkedOn(tab, 1, D(-2), { enter: true });
      ok(await pb.isOpen(tab), "Enter in Talked on doesn't save");
      await pb.removeTalk(tab, 1, D(-70));
      eq((await pb.popup(tab)).boxes[0], { how: "call", every: "week", minutes: "45", last: "Last talked 2 days ago · due in 5 days", talks: ["Sep 28", "Aug 26"], hint: "" }, "Monday's added, July's taken off");

      // + Add a call, text or visit: a call every month, due today until you talk; ✕ takes it off; six at most.
      await pb.addBox(tab);
      eq((await pb.popup(tab)).boxes[1], { how: "call", every: "month", minutes: "30", last: "Never talked · due today", talks: [], hint: "" }, "a new box");
      await pb.removeBox(tab, 2);
      eq((await pb.popup(tab)).boxes.length, 1, "✕ takes it off");
      for (let i = 0; i < 5; i++) await pb.addBox(tab);
      eq([(await pb.popup(tab)).boxes.length, (await pb.popup(tab)).more], [6, false], "six: no more + Add");
      for (let n = 6; n > 2; n--) await pb.removeBox(tab, n);
      await pb.setBox(tab, 2, { how: "text", every: "2weeks" });

      // Save writes it all at once: her line, This week (both her calls and texts), and her as kept.
      await pb.fill(tab, { group: "  Family ", note: "Ask about the garden.\n\n\n\nShe's   back on Friday." });
      await pb.save(tab);
      ok(!(await pb.isOpen(tab)), "saved and closed");
      eq(await line(tab, "Mom"), "Mom · Family · Call weekly · Text every 2 weeks · due today · 🎂 Oct 12 · turns 60", "her line");
      eq((await pb.thisWeek(tab)).lines, ["✓ Text Sam · talked yesterday · 10m", "✓ Call Mom · talked Mon · 45m", "Visit Gran · overdue 9 days · 2h", "Call Ana · overdue 3 days · 30m", "Text Mom · due today · 10m"], "This week: her call talked Monday, her new text due today");
      const mom = await pb.person(tab, "Mom");
      eq([mom.group, mom.note, mom.cadences.map(c => [c.every, c.how, c.minutes, c.talks])], ["Family", "Ask about the garden.\n\nShe's back on Friday.", [["week", "call", 45, [D(-2), D(-35)]], ["2weeks", "text", 10, []]]], "as kept, the note's lines tidied");
      ok(mom.cadences[0].id === "c1" && /^[a-z0-9]{1,12}$/.test(mom.cadences[1].id) && mom.cadences[1].id !== "c1", "the call keeps its id, the text has one of its own");

      // A group typed in other capitals takes the spelling in use (offered as you type); Enter saves. With groups, chips.
      await pb.openPerson(tab, "Jo");
      eq((await pb.popup(tab)).offered, ["Family"], "the groups in use, offered");
      await pb.fill(tab, { group: "FAMILY" });
      await pb.save(tab, { enter: true });
      eq([await pb.isOpen(tab), (await pb.person(tab, "Jo")).group, await pb.chips(tab)], [false, "Family", { shown: ["All", "Family", "No group"], on: "All" }], "Enter saved, as Family; the chips");

      // Esc with changes asks first: No keeps them, Yes drops them; Cancel drops them without asking; unchanged, Esc just closes.
      await pb.openPerson(tab, "Sam");
      await pb.fill(tab, { name: "Samuel" });
      tab.answers.push(false);
      await p.keyboard.press("Escape");
      eq([lastDialog(tab), await pb.isOpen(tab)], ["Discard your changes to this person?", true], "Esc asks; No: still open");
      await p.keyboard.press("Escape");
      eq([lastDialog(tab), await pb.isOpen(tab)], ["Discard your changes to this person?", false], "Yes: closed");
      await pb.openPerson(tab, "Sam");
      await pb.fill(tab, { name: "Samuel" });
      await pb.cancel(tab);
      eq([tab.dialogs, await pb.isOpen(tab)], [[], false], "Cancel asks nothing");
      await pb.openPerson(tab, "Sam");
      await p.keyboard.press("Escape");
      eq([tab.dialogs, await pb.isOpen(tab), await pb.person(tab, "Samuel")], [[], false, null], "unchanged: Esc just closes; nothing was saved");

      // Kai is birthday only, and the pop-up says so; + Add gives him a call, due today.
      await pb.openPerson(tab, "Kai", "birthdays");
      eq([(await pb.popup(tab)).none, (await pb.popup(tab)).boxes], [true, []], "birthday only: no boxes");
      await pb.addBox(tab);
      await pb.save(tab);
      eq(await line(tab, "Kai"), "Kai · Call monthly · due today · 🎂 Oct 1", "his line");
      has(await weekText(tab), "Call Kai · due today · 30m | Text Mom · due today · 10m", "his call on This week (the same day: by title)");
    }
  },
  {
    name: "pabu: the pop-up's checks — the birthday's three fields, what Save can't take said above it and marked, a Talked on day picked, unfinished or to come; Delete leaves a marker",
    async run(t) {
      const tab = await open(t, { app: "pabu", size: PHONE }), p = tab.page, data = gen.pabu();
      await importBackup(tab, data);
      await pb.openPerson(tab, "Mom");
      // What Save can't take is said right above it, in view at the pop-up's foot; that field is marked and takes the focus,
      // and typing there again clears both.
      await pb.fill(tab, { name: "  " });
      await pb.save(tab);
      eq([await pb.said(tab), await pb.focused(tab)], [{ hint: "Type their name.", saved: false, marked: ["name"] }, "name"], "no name");
      ok(await pb.hintInView(tab), "the line above Save is in view");
      await pb.fill(tab, { name: "Mom" });
      eq(await pb.said(tab), { hint: "", saved: false, marked: [] }, "typing again clears it");

      // The birthday: the month and day go together, the day must be in its month (Feb 29 in a leap year only, when the
      // year is given), and the year is from 1900 to this one. Minutes: 5 to 480.
      for (const [f, hint, field] of [
        [{ month: 2, day: 30 }, "February 1966 has 28 days: pick a day from 1 to 28.", "day"],
        [{ day: 29 }, "February 1966 has 28 days: pick a day from 1 to 28.", "day"],
        [{ day: 30, year: "" }, "February has 29 days: pick a day from 1 to 29.", "day"],
        [{ month: "", year: 1970 }, "Pick the month and day of the birthday too, or clear the year.", "month"],
        [{ month: 10 }, "Type the day of the birthday too.", "day"],
        [{ month: "", day: 20 }, "Pick the month of the birthday too.", "month"],
        [{ month: 10, day: 20, year: 2030 }, "The year born should be from 1900 to 2026, or left empty.", "year"],
        [{ year: 1899 }, "The year born should be from 1900 to 2026, or left empty.", "year"]
      ]) {
        await pb.fill(tab, f);
        await pb.save(tab);
        eq([await pb.said(tab), await pb.focused(tab)], [{ hint, saved: false, marked: [field] }, field], `${JSON.stringify(f)}: said, and marked`);
      }
      await pb.fill(tab, { year: 1970 });
      await pb.setBox(tab, 1, { minutes: 4 });
      await pb.save(tab);
      eq([await pb.said(tab), await pb.focused(tab)], [{ hint: "How long does the call take? From 5 to 480 minutes.", saved: false, marked: ["minutes 1"] }, "minutes 1"], "4 minutes");
      await pb.setBox(tab, 1, { minutes: 481, how: "visit" });
      await pb.save(tab);
      eq((await pb.said(tab)).hint, "How long does the visit take? From 5 to 480 minutes.", "481, for a visit");
      eq([await pb.isOpen(tab), (await pb.person(tab, "Mom")).birthday], [true, "1966-10-12"], "nothing saved meanwhile");

      // Feb 29 without a year is a birthday (on Feb 28 next year); then Oct 20, 1970.
      await pb.fill(tab, { month: 2, day: 29, year: "" });
      await pb.setBox(tab, 1, { minutes: 30, how: "call" });
      await pb.save(tab);
      eq([await pb.isOpen(tab), (await pb.person(tab, "Mom")).birthday, await line(tab, "Mom")], [false, "02-29", "Mom · Call monthly · overdue 4 days · 🎂 Feb 28"], "saved");
      await pb.openPerson(tab, "Mom");
      eq([(await pb.popup(tab)).month, (await pb.popup(tab)).day, (await pb.popup(tab)).year], ["2", "29", ""], "as kept");
      await pb.fill(tab, { month: 10, day: 20, year: 1970 });
      await pb.save(tab);
      eq([await line(tab, "Mom"), await pb.birthdays(tab)], ["Mom · Call monthly · overdue 4 days · 🎂 Oct 20 · turns 56", ["Kai · Oct 1 · tomorrow", "Mom · Oct 20 · in 20 days · turns 56"]], "her line and the strip follow");

      // A "Talked on" day picked but not added goes in with Save (Ana's pop-up, from her call's name on This week).
      await pb.openPerson(tab, "Call Ana", "week");
      await pb.talkedOn(tab, 1, D(-1), { add: false });
      await pb.save(tab);
      eq([await pb.isOpen(tab), (await pb.person(tab, "Ana")).cadences[0].talks], [false, [D(-1)]], "saved with the day picked");
      has(await weekText(tab), "✓ Call Ana · talked yesterday · 30m", "This week has it");
      // One unfinished, or not come yet, is left out: the rest is saved, and the pop-up stays open to say so.
      await pb.openPerson(tab, "Ana");
      await pb.typeTalk(tab, 1, "09");
      await pb.fill(tab, { note: "Likes jazz." });
      await pb.save(tab);
      eq(await pb.said(tab), { hint: "Saved, without the unfinished “Talked on” day (Call).", saved: true, marked: ["talked on 1"] }, "an unfinished day");
      eq((await pb.person(tab, "Ana")).note, "Likes jazz.", "the note is in");
      await p.keyboard.press("Escape");
      eq([tab.dialogs, await pb.isOpen(tab)], [[], false], "closing it now asks nothing");
      await pb.openPerson(tab, "Ana");
      await pb.talkedOn(tab, 1, D(2), { add: false });
      await pb.fill(tab, { note: "Likes jazz and tea." });
      await pb.save(tab);
      eq(await pb.said(tab), { hint: "Saved, without the “Talked on” day that hasn't come yet (Call).", saved: true, marked: ["talked on 1"] }, "a day to come");
      const ana = await pb.person(tab, "Ana");
      eq([ana.note, ana.cadences[0].talks], ["Likes jazz and tea.", [D(-1)]], "the note in, the day not");
      await pb.cancel(tab);

      // An unchanged Save saves nothing.
      const jo = await pb.person(tab, "Jo");
      await pb.openPerson(tab, "Jo");
      await pb.save(tab);
      eq([await pb.isOpen(tab), await pb.person(tab, "Jo")], [false, jo], "Jo as he was, his change stamp too");

      // Delete asks first; then Mom is gone, and the backup keeps a marker with nothing personal in it.
      await pb.openPerson(tab, "Mom");
      tab.answers.push(false);
      await pb.remove(tab);
      eq([lastDialog(tab), await pb.isOpen(tab)], ["Delete Mom, and the days you talked? This can't be undone.", true], "Delete asks; No: Mom stays");
      await pb.remove(tab);
      ok(!(await pb.isOpen(tab)), "Yes: closed");
      eq([await pb.names(tab), await pb.birthdays(tab)], [["Ana", "Gran", "Jo", "Kai", "Lee", "Sam"], ["Kai · Oct 1 · tomorrow"]], "gone from People and the strip");
      lacks(await weekText(tab), "Mom", "and from This week");
      const marker = (await exportBackup(tab)).people.find(x => x.id === "pp-mom");
      eq({ ...marker, u: 0 }, { id: "pp-mom", name: "", group: "", note: "", birthday: "", cadences: [], deleted: true, at: data.people[1].at, u: 0 }, "the export's marker: nothing personal");
      ok(marker.u > data.people[1].u, "stamped, so sync takes it");
    }
  },
  {
    name: "pabu: the pop-up's Save writes the whole person as shown over the person as kept now (another tab's ✓ meanwhile goes; unchanged here, nothing written; deleted meanwhile, nothing saved); — takes a birthday off",
    async run(t) {
      const flo = { id: "pp-flo", name: "Great-aunt Flo", every: "year", how: "visit", minutes: 120, talks: [200], birthday: "1850-03-01" };
      const a = await open(t, { app: "pabu", size: DESKTOP }), p = a.page;
      await importBackup(a, gen.pabu(gen.PEOPLE.concat(flo)));
      const b = await open(t, { ctx: a.ctx, app: "pabu", size: DESKTOP });

      // Mom's pop-up is open here while her call gets its ✓ in the other tab: This week here shows it, the pop-up as opened.
      await pb.openPerson(a, "Mom");
      await pb.tick(b, "Call Mom");
      await p.waitForFunction(() => Kyoshi.apps.pabu.personById("pp-mom").cadences[0].talks.length === 3, null, { timeout: 5000 });
      has(await weekText(a), "✓ Call Mom · talked today · 30m", "the other tab's ✓, here");
      eq((await pb.popup(a)).boxes[0].talks, ["Aug 26", "Jul 22"], "the pop-up as it was opened");
      // Save writes the whole person as the pop-up shows them: the new note, and the days talked as shown (the ✓ goes).
      await pb.fill(a, { note: "Ask about the trip." });
      await pb.save(a);
      const mom = await pb.person(a, "Mom");
      eq([mom.note, mom.cadences[0].talks, mom.birthday], ["Ask about the trip.", [D(-35), D(-70)], "1966-10-12"], "the whole person, as shown");
      await b.page.waitForFunction(() => Kyoshi.apps.pabu.personById("pp-mom").note === "Ask about the trip.", null, { timeout: 5000 });
      has(await weekText(b), "Call Mom · overdue 4 days · 30m", "the other tab follows: no ✓");
      // Nothing changed here: Save writes nothing, so the other tab's change meanwhile stands.
      await pb.openPerson(a, "Sam");
      await pb.openPerson(b, "Sam");
      await pb.fill(b, { group: "Work" });
      await pb.save(b);
      await p.waitForFunction(() => Kyoshi.apps.pabu.personById("pp-sam").group === "Work", null, { timeout: 5000 });
      const sam = await pb.person(a, "Sam");
      await pb.save(a);
      eq([await pb.isOpen(a), await pb.person(a, "Sam")], [false, sam], "closed; Sam as the other tab left him");

      // Someone deleted in the other tab while their pop-up is open here: Save says so, and saves nothing.
      await pb.openPerson(a, "Jo");
      await pb.openPerson(b, "Jo");
      await pb.remove(b);
      await p.waitForFunction(() => !Kyoshi.apps.pabu.personById("pp-jo"), null, { timeout: 5000 });
      await pb.fill(a, { note: "Likes jazz." });
      await pb.save(a);
      eq([lastDialog(a), await pb.isOpen(a), await pb.person(a, "Jo")], ["That person was deleted on another device, so nothing was saved.", false, null], "said, closed, still deleted");

      // "—" for the month takes the birthday off, its day and year with it.
      await pb.openPerson(a, "Mom");
      await pb.fill(a, { month: "" });
      eq([(await pb.popup(a)).day, (await pb.popup(a)).year], ["", ""], "the day and year go too");
      await pb.save(a);
      eq([(await pb.person(a, "Mom")).birthday, await line(a, "Mom"), await pb.birthdays(a)], ["", "Mom · Call monthly · overdue 4 days", ["Kai · Oct 1 · tomorrow"]], "no birthday: none on her line, nor in the strip");

      // A birthday kept with a year the pop-up wouldn't take (a backup's) stands while something else is changed…
      await pb.openPerson(a, "Great-aunt Flo");
      await pb.setBox(a, 1, { minutes: 90 });
      await pb.save(a);
      const kept = await pb.person(a, "Great-aunt Flo");
      eq([await pb.isOpen(a), kept.cadences[0].minutes, kept.birthday], [false, 90, "1850-03-01"], "saved, the birthday as it was");
      // …and is checked once it's changed.
      await pb.openPerson(a, "Great-aunt Flo");
      await pb.fill(a, { day: 2 });
      await pb.save(a);
      eq(await pb.said(a), { hint: "The year born should be from 1900 to 2026, or left empty.", saved: false, marked: ["year"] }, "a changed birthday is checked");
    }
  },
  {
    name: "pabu: backups — what came in (This week soonest first, People A to Z with group chips, the strip), Export gives it back, version 1 imports, a damaged file keeps what's usable, others change nothing",
    async run(t) {
      const tab = await open(t, { app: "pabu", size: DESKTOP }), data = gen.pabuCircle();
      await importBackup(tab, data);
      eq(tab.dialogs, [], "a first import asks nothing");
      eq(await pb.thisWeek(tab), { count: "1 of 5 done", lines: ["Visit Mom · overdue 9 days · 2h", "Text Bo · overdue 2 days · 10m", "✓ Text Dad · talked yesterday · 10m",
        "Call Mom · due today · 30m", "Call Raj · due Sat · 30m"], late: ["Visit Mom", "Text Bo"], empty: "" }, "This week: each call, text or visit due by Sunday or overdue, soonest first (Zoe's visit isn't due till Oct 12)");
      eq(await pb.people(tab), ["Bo · Text weekly · overdue 2 days", "Dad · family · Text every 2 weeks · due in 13 days", "Ivy · Birthday only · 🎂 Feb 28 · turns 27",
        "Mom · Family · Call weekly · Visit monthly · overdue 9 days · 🎂 Oct 12 · turns 60", "Raj · Work · Call monthly · due in 3 days", "Zoe · Friends · Visit quarterly · due in 12 days · 🎂 Oct 15"],
      "People: a line each, A to Z (Ivy's Feb 29 falls on Feb 28 next year)");
      eq(await pb.birthdays(tab), ["Mom · Oct 12 · in 12 days · turns 60", "Zoe · Oct 15 · in 15 days"], "the strip: the next 30 days");
      // The chips: each group once, whatever its case; one group at a time.
      eq(await pb.chips(tab), { shown: ["All", "Family", "Friends", "Work", "No group"], on: "All" }, "the chips");
      for (const [chip, who] of [["Family", ["Dad", "Mom"]], ["No group", ["Bo", "Ivy"]], ["Work", ["Raj"]]]) {
        await pb.pickChip(tab, chip);
        eq([(await pb.chips(tab)).on, await pb.names(tab)], [chip, who], `${chip}'s`);
      }
      const back = await exportBackup(tab);
      eq([back.schemaVersion, back.appVersion, back.people], [2, await tab.page.evaluate(() => Kyoshi.apps.pabu.VERSION), data.people], "Export gives back the people (and the marker) as they came in");

      // A version 1 backup (one schedule per person, at the top): each becomes one call, text or visit, "c1", with its days.
      const v1 = gen.pabu();
      await importBackup(tab, v1);
      has(lastDialog(tab), "Replace your 6 people with the 7 people in this backup? This backup is from ", "the counts, then the backup's date");
      eq([await pb.chips(tab), await pb.names(tab)], [{ shown: [], on: null }, ["Ana", "Gran", "Jo", "Kai", "Lee", "Mom", "Sam"]], "no groups now: no chips, and Work's is gone, so everyone shows");
      const kept = Object.fromEntries((await exportBackup(tab)).people.map(x => [x.id, x])), src = v1.people[1];
      eq(kept["pp-mom"], { id: "pp-mom", name: "Mom", group: "", note: src.note, birthday: "1966-10-12", cadences: [{ id: "c1", every: "month", how: "call", minutes: 30,
        talks: [D(-35), D(-70)], at: src.at }], deleted: false, at: src.at, u: src.u }, "Mom's one call, c1, with its days; the old keys at the top aren't written");
      eq([kept["pp-kai"].cadences, kept["pp-kai"].birthday], [[], "10-01"], "birthday only: none");

      // A damaged file: only what's usable, with the counts asked first.
      await importBackup(tab, gen.damagedPabu());
      const asked = lastDialog(tab);
      has(asked, "Replace your 7 people with the 3 people in this backup? This backup is from ", "the counts, then the backup's date");
      has(asked, "This can't be undone.", "and that it can't be undone");
      eq(await pb.people(tab), [`${"N".repeat(40)} · Visit weekly · due today · 🎂 Feb 28`, "Old clock · Text monthly · due today", "Rae Lynn · Call monthly · due Oct 27"],
        "three people: names tidied and cut, a day ahead ignored, a newer version's how often read as every month");
      const fixed = Object.fromEntries((await exportBackup(tab)).people.map(x => [x.id, x]));
      eq(Object.keys(fixed), ["d1", "d2", "d3", "d4"], "the unusable ones are gone");
      eq(fixed.d1.cadences, [{ id: "c1", every: "fortnight", how: "call", minutes: 30, talks: [D(2), D(-3)], at: 0 }], "a newer version's how often survives, the day ahead too; minutes out of range: a call's usual");
      eq([fixed.d1.birthday, fixed.d1.note, fixed.d2.birthday, fixed.d2.cadences[0].minutes, fixed.d4.cadences[0].minutes, fixed.d4.at, fixed.d4.u], ["", "", "02-29", 120, 13, 0, 0],
        "an impossible birthday dropped, Feb 29 kept; no number: how's minutes; 12.6 rounds to 13; moments no date can hold are dropped");
      eq(fixed.d3, { id: "d3", name: "", group: "", note: "", birthday: "", cadences: [], deleted: true, at: 1, u: 1 }, "a deleted marker keeps nothing personal");
      // The pop-up reads that how often as every month, and leaves it as it came unless it's changed there.
      await pb.openPerson(tab, "Rae Lynn");
      eq((await pb.popup(tab)).boxes[0].every, "month", "read as every month");
      await pb.fill(tab, { note: "Met at the lake." });
      await pb.save(tab);
      eq((await pb.person(tab, "Rae Lynn")).cadences[0].every, "fortnight", "kept as it came");

      // Other apps' backups, broken files and ones with nobody in them change nothing.
      for (const other of [gen.hawky(), gen.turtleduck()]) {
        await importBackup(tab, other);
        eq(lastDialog(tab), "That file doesn't look like a Pabu backup.", "another app's backup is refused");
      }
      await importBackup(tab, "{ not json");
      eq(lastDialog(tab), "That file isn't a valid Pabu backup (it couldn't be read as JSON).", "a broken file");
      for (const people of [[], [{ id: "x", deleted: true }]]) {
        await importBackup(tab, { schemaVersion: 2, people });
        eq(lastDialog(tab), "That backup has no people in it, so nothing was changed.", "nobody in it");
      }
      eq((await pb.people(tab)).length, 3, "still the three");

      // A newer version's backup: a heads-up, then it's in.
      await importBackup(tab, { ...gen.pabuCircle(gen.CIRCLE.slice(0, 1)), schemaVersion: 3 });
      eq(tab.dialogs.map(d => d[1].replace(/ This backup is from .*? This can't/, " This can't")), [
        "Heads up: this backup was made by a newer version of Pabu. Importing it anyway, but some data may not carry over.",
        "Replace your 3 people with the 1 person in this backup? This can't be undone."
      ], "a heads-up, then the counts (and the backup's date)");
      eq(await pb.names(tab), ["Mom"], "Mom alone");
    }
  },
  {
    name: "pabu: time travel — talked today moves a call on till it comes due again, a ticked line keeps its place on This week until Sunday (✓ again takes that day off), the Birthdays strip follows the days",
    async run(t) {
      const tab = await open(t, { app: "pabu", size: PHONE });
      await importBackup(tab, gen.pabu());
      eq(await pb.thisWeek(tab), { count: "1 of 4 done", lines: ["✓ Text Sam · talked yesterday · 10m", "Visit Gran · overdue 9 days · 2h", "Call Mom · overdue 4 days · 30m",
        "Call Ana · overdue 3 days · 30m"], late: ["Visit Gran", "Call Mom", "Call Ana"], empty: "" }, "Sam's text, due as the week began and talked yesterday, then the overdue ones, soonest first (Jo's isn't due till Oct 10)");
      await pb.tick(tab, "Call Mom");
      eq([(await pb.thisWeek(tab)).lines[2], await line(tab, "Mom")], ["✓ Call Mom · talked today · 30m", "Mom · Call monthly · due Oct 30 · 🎂 Oct 12 · turns 60"], "Mom's call, ticked, in its place: a month on");

      await travel(tab, 1); // Thursday, Oct 1: Kai's birthday
      eq(await pb.birthdays(tab), ["Kai · Oct 1 · today", "Mom · Oct 12 · in 11 days · turns 60"], "Kai's birthday is today");
      eq(await line(tab, "Kai"), "Kai · Birthday only · 🎂 today", "on his line too");
      eq((await pb.thisWeek(tab)).lines, ["✓ Text Sam · talked Tue · 10m", "Visit Gran · overdue 10 days · 2h", "✓ Call Mom · talked yesterday · 30m", "Call Ana · overdue 4 days · 30m"], "the ticked ones keep their places");
      // ✓ again takes off the day that ticked it (yesterday); ✓ once more is today.
      await pb.tick(tab, "Call Mom");
      eq([(await pb.thisWeek(tab)).lines[2], (await pb.person(tab, "Mom")).cadences[0].talks], ["Call Mom · overdue 5 days · 30m", [D(-35), D(-70)]], "yesterday's taken off");
      await pb.tick(tab, "Call Mom");
      eq((await pb.person(tab, "Mom")).cadences[0].talks, [D(1), D(-35), D(-70)], "today's instead: due Nov 1");

      await travel(tab, 3); // Sunday, Oct 4: still this week
      eq((await pb.thisWeek(tab)).lines, ["✓ Text Sam · talked Tue · 10m", "Visit Gran · overdue 13 days · 2h", "✓ Call Mom · talked Thu · 30m", "Call Ana · overdue 7 days · 30m"], "Sunday: as they were");
      eq(await pb.birthdays(tab), ["Mom · Oct 12 · in 8 days · turns 60"], "Kai's has passed");

      await travel(tab, 1); // Monday, Oct 5: a new week
      eq(await pb.thisWeek(tab), { count: "4", lines: ["Visit Gran · overdue 14 days · 2h", "Call Ana · overdue 8 days · 30m", "Text Sam · due tomorrow · 10m", "Call Jo · due Sat · 30m"], late: ["Visit Gran", "Call Ana"], empty: "" },
        "a new week: Mom's call is a month off; Sam's and Jo's come up");
      await travel(tab, 2); // Wednesday, Oct 7
      eq([(await pb.thisWeek(tab)).lines[2], await line(tab, "Sam")], ["Text Sam · overdue 1 day · 10m", "Sam · Text weekly · overdue 1 day"], "Sam's text comes due again, and is overdue");

      await travel(tab, 10); // Saturday, Oct 17
      eq(await line(tab, "Mom"), "Mom · Call monthly · due Nov 1 · 🎂 Oct 12 · turns 61", "Mom turned 60: next year, 61");
      eq(await pb.birthdays(tab), [], "no birthday in the next 30 days: the strip is hidden");
      await travel(tab, 15); // Sunday, Nov 1
      eq(await line(tab, "Mom"), "Mom · Call monthly · due today · 🎂 Oct 12 · turns 61", "Mom's call is due again");
      has(await weekText(tab), "Call Mom · due today · 30m", "on This week");
    }
  }
];
