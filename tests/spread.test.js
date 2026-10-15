/* Kyoshi · tests/spread.test.js — "Spread out due dates" (Developer Mode's, in Pabu and Appa; core/level.js works out the
 * plan, core/spread.js shows it). Made-up data, as of TODAY (Wed Sep 30; weeks Monday to Sunday):
 *   Pabu: 8 monthly calls of 30m (Friend 0 to 7, last talked 29 days ago, so all due Thu Oct 1) and 2 weekly texts of 10m (Pat,
 *   due Sun Oct 4; Quinn, talked yesterday, due Tue Oct 6). Now: the week of Sep 28 holds 8 × 30 + 10 = 250 min (4.25 h, to
 *   the quarter hour), the next 10 m. Weeks are compared by the minutes a day they have left (this one counts from today,
 *   5 days; the others 7), the calls placed one at a time, in order, in the lighter week: Friend 0 goes to next week (10 min
 *   in it against 10 in this one over fewer days), 1 stays, 2 goes, 3 stays, 4 goes, 5 stays, 6 and 7 go: five calls move to
 *   Mon Oct 5, leaving 3 × 30 + 10 = 100 min (1.75 h) this week and 5 × 30 + 10 = 160 min (2.75 h) next. The texts come
 *   every 7 days, so can move by 1 day at most: they never move.
 *   A smaller one (4 calls last talked 24 days ago, all due Tue Oct 6; each can move 7 days either way): Friend 2 goes back
 *   to Sun Oct 4, Friend 1 on to Mon Oct 12, Friend 0 and 3 stay: 30 m, 1 h, 30 m in three weeks.
 *   Appa: 6 jobs of 60 min every 3 months on one thing, last done Jul 1, all due Oct 1 (each can move 14 days, so three
 *   weeks are open): Job 1 and 3 go to Oct 5, Job 2 and 4 to Oct 12; Job 0 and 5 stay: 2 h in each week. */
"use strict";
const { TODAY, DESKTOP, eq, ok, has, lacks, open, switchTo, importBackup, exportBackup, devPanel, lastDialog, addDays } = require("./lib");
const gen = require("./generate");
const pb = require("./pabu");
const mo = require("./momo");

const M = "#kMount";
const friends = (n, ago) => Array.from({ length: n }, (_, i) => ({ id: `sp-f${i}`, name: `Friend ${i}`, every: "month", how: "call", minutes: 30, talks: [ago] }));
const BIG = friends(8, 29).concat([
  { id: "sp-pat", name: "Pat", every: "week", how: "text", minutes: 10, talks: [3] },
  { id: "sp-quinn", name: "Quinn", every: "week", how: "text", minutes: 10, talks: [1] }
]);
const SMALL = friends(4, 24);
const READING = { date: addDays(TODAY, 1), title: "Reading", hours: 1 }; // a card of yours: Momo's week is planned
const OCT12 = { from: "2026-10-01", to: "2026-10-12" };
const OCT5 = { from: "2026-10-01", to: "2026-10-05" };
const MOVES5 = [0, 2, 4, 6, 7]; // the calls the plan moves to Oct 5 in the big world

// --- The shared pop-up ---
// Developer Mode's button for the app on screen, then the pop-up it opens.
async function openSpread(tab, btn) {
  await devPanel(tab, true);
  await tab.page.click(`#kDevAppTools #${btn}`);
  await tab.page.waitForSelector("#kSpreadOverlay.open");
}
const spreadOpen = tab => tab.page.locator("#kSpreadOverlay").evaluate(el => el.classList.contains("open"));
// As shown: the weeks' columns [Week of, Now, Spread out], a row per week, the moves' lines ("Call Friend 1: Oct 1 → Oct 5"),
// the line when there is nothing to move, and whether Apply is off.
const spread = tab => tab.page.evaluate(() => {
  const txt = el => el.textContent.trim();
  return {
    head: [...document.querySelectorAll("#kSpreadWeeks .spread-head > span")].map(txt),
    rows: [...document.querySelectorAll("#kSpreadWeeks .spread-row:not(.spread-head)")].map(r => [...r.children].map(txt)),
    moves: [...document.querySelectorAll("#kSpreadMoves .spread-move")].map(txt),
    nothing: (document.querySelector("#kSpreadMoves .note") || { textContent: "" }).textContent.trim(),
    off: document.getElementById("kSpreadApply").disabled
  };
});
async function closed(tab) { await tab.page.waitForSelector("#kSpreadOverlay:not(.open)", { state: "attached" }); }
// Cancel, or Apply (the question it asks answered Yes, or No when no is true), or Put them back (same).
async function cancel(tab) { await tab.page.click("#kSpreadCancel"); await closed(tab); }
async function apply(tab, { no = false } = {}) {
  if (no) tab.answers.push(false);
  await tab.page.click("#kSpreadApply");
  if (!no) await closed(tab);
}
async function putBack(tab, btn, { no = false } = {}) {
  await devPanel(tab, true);
  if (no) tab.answers.push(false);
  await tab.page.click(`#kDevAppTools #${btn}`);
}
const devButtons = tab => tab.page.$$eval("#kDevAppTools .dev-block button", els => els.map(b => b.id));
const devHints = tab => tab.page.$$eval("#kDevAppTools .dev-hint", els => els.map(e => e.textContent.trim()));

// --- Pabu as kept ---
// Every person: name, u (the moment of their last change), and each call, text or visit's `moved` (null for none).
const kept = tab => tab.page.evaluate(() => Kyoshi.apps.pabu.S.people.map(p => ({ name: p.name, u: p.u, moved: p.cadences.map(c => c.moved || null) })));
// Those with a move: [name, move].
const movedOf = list => list.filter(p => p.moved.some(Boolean)).map(p => [p.name, p.moved[0]]);
// A person's first call, text or visit: its usual due, whether a move holds, and its due as Pabu works with it.
const dues = (tab, name) => tab.page.evaluate(x => {
  const A = Kyoshi.apps.pabu, p = A.live().find(q => q.name === x), c = p.cadences[0];
  return { usual: A.usualDue(p, c), moved: A.isMoved(p, c), due: A.dueOf(p, c), keeps: c.moved || null };
}, name);
const bugLines = (tab, id) => tab.page.evaluate(x => Kyoshi.apps[x].bugState(), id);
const movedLine = lines => lines.filter(l => l.startsWith("- Moved due dates"));

// Pabu on screen with its people (and Momo with a planned week, when momo is true); the spread pop-up open.
async function pabuWith(t, people, { momo = false } = {}) {
  const tab = await open(t, { app: "pabu", size: DESKTOP });
  await importBackup(tab, gen.pabu(people));
  if (momo) {
    await switchTo(tab, "momo");
    await importBackup(tab, gen.momo([], [READING]));
    await switchTo(tab, "pabu");
  }
  return tab;
}
// Pabu's tasks on Momo's board on screen: [what it says before " — drag", hours].
const pabuTasks = async tab => (await mo.tasks(tab)).tasks.filter(x => x.key.startsWith("n:pabu:")).map(x => [x.label.replace(/ — drag.*$/, ""), x.hours]);

// --- Appa ---
const HOUSE = { id: "home1", name: "House" };
const CAR = { id: "car1", name: "Car", meter: "mi", pace: 12000 };
const jobId = i => `job${i}a`;
const JOBS = Array.from({ length: 6 }, (_, i) => ({ id: jobId(i), thingId: HOUSE.id, name: `Job ${i}`, every: [3, "m"], from: { date: "2026-07-01" }, est: 60 }))
  // A job by the meter alone (Appa guesses its day from the pace): the plan leaves it out.
  .concat([{ id: "tires", thingId: CAR.id, name: "Rotate tires", meterEvery: 5000, from: { date: TODAY, reading: 1000 }, est: 60 }]);
const appaWorld = () => gen.appaWorld({ things: [HOUSE, CAR], jobs: JOBS });
// Each live job: [name, the move it keeps (null), whether it holds, its due text on the home].
const jobs = tab => tab.page.evaluate(() => {
  const A = Kyoshi.apps.appa;
  return A.live(A.S.jobs).map(j => ({ name: j.name, keeps: j.moved || null, holds: A.dueOf(j).moved, usual: A.dueOf(j).usual, date: A.dueOf(j).date, text: A.dueText(j), u: j.u }));
});
// What Coming up says: a line per job, "House — Job 1 · Due in 5 days (spread out)" (its title, then its due words).
const comingUp = tab => tab.page.$$eval(`${M} #comingUp .job-row`, rows => rows.map(r => `${r.querySelector(".row-title").textContent.replace(/\s+/g, " ").trim()} · ${r.querySelector(".row-sub > span").textContent.trim()}`));

module.exports = [
  {
    name: "spread pabu: the pop-up shows each week now and spread out and the five moves; Cancel changes nothing; Apply keeps them (stamping only those five, never the texts), nothing more to change after, and Momo's tasks follow",
    async run(t) {
      const tab = await pabuWith(t, BIG, { momo: true });
      const before = await kept(tab);
      eq(movedOf(before), [], "no move yet");
      eq((await pb.thisWeek(tab)).lines.filter(l => l.includes("due tomorrow")).length, 8, "all eight calls due tomorrow, Thu Oct 1");
      // Momo before: every call due Oct 1, then Pat's text (Oct 4) and Quinn's (Oct 6).
      await switchTo(tab, "momo");
      eq(await pabuTasks(tab), [...Array(8).keys()].map(i => [`Call Friend ${i} (from Pabu, due Oct 1)`, 0.5])
        .concat([["Text Pat (from Pabu, due Oct 4)", 0.25], ["Text Quinn (from Pabu, due Oct 6)", 0.25]]), "Momo's tasks before");
      await switchTo(tab, "pabu");

      // The pop-up: 8 weeks; Now 250 min = 4.25 h, then 10 m; spread out 130 min = 2.25 h each.
      await openSpread(tab, "pabuSpreadBtn");
      const shown = await spread(tab);
      eq(shown.head, ["Week of", "Now", "Spread out"], "its columns");
      eq(shown.rows, [["Sep 28", "4.25h", "1.75h"], ["Oct 5", "10m", "2.75h"], ["Oct 12", "0", "0"], ["Oct 19", "0", "0"], ["Oct 26", "0", "0"], ["Nov 2", "0", "0"], ["Nov 9", "0", "0"], ["Nov 16", "0", "0"]], "the coming 8 weeks");
      eq(shown.moves, MOVES5.map(n => `Call Friend ${n}: Oct 1 → Oct 5`), "five of the calls move to Monday");
      eq([shown.nothing, shown.off], ["", false], "Apply is on");
      has(await tab.page.innerText("#kSpreadMoves .spread-moves-head"), "5 due dates would move:", "the heading counts them");
      eq(tab.dialogs, [], "nothing asked yet");

      // Cancel: nothing changes, nothing asked.
      await cancel(tab);
      eq([await spreadOpen(tab), tab.dialogs, await kept(tab)], [false, [], before], "Cancel: closed, nothing asked, no one touched");

      // Apply asks first; No changes nothing, Yes keeps the five moves.
      await openSpread(tab, "pabuSpreadBtn");
      await apply(tab, { no: true });
      eq(lastDialog(tab), "Move 5 due dates to even out your weeks?", "the question");
      eq([await spreadOpen(tab), await kept(tab)], [true, before], "No: the pop-up stays, nothing moved");
      await apply(tab);
      eq(lastDialog(tab), "Move 5 due dates to even out your weeks?", "asked again");
      const after = await kept(tab);
      eq(movedOf(after), MOVES5.map(n => [`Friend ${n}`, OCT5]), "exactly those five keep their move");
      eq(after.filter((p, i) => p.u !== before[i].u).map(p => p.name), MOVES5.map(n => `Friend ${n}`), "only their people are stamped");
      ok(after.every((p, i) => p.u >= before[i].u), "no stamp goes back");
      ok(after.flatMap(p => p.moved).filter(Boolean).every(m => m.to >= TODAY && m.from >= TODAY), "nothing moves before today");
      eq(["Pat", "Quinn"].map(n => after.find(p => p.name === n).moved), [[null], [null]], "the weekly texts never move");
      eq((await pb.thisWeek(tab)).lines, ["✓ Text Quinn · talked yesterday · 10m", "Call Friend 1 · due tomorrow · 30m", "Call Friend 3 · due tomorrow · 30m", "Call Friend 5 · due tomorrow · 30m", "Text Pat · due Sun · 10m"],
        "This week: the five moved calls are next week's now (Oct 5)");

      // Opened again: it is the same plan (counted from each call's usual due), so there is nothing more to change and
      // Apply is off; Now is the weeks as they are with the moves kept.
      await openSpread(tab, "pabuSpreadBtn");
      const again = await spread(tab);
      eq(again.rows.slice(0, 2), [["Sep 28", "1.75h", "1.75h"], ["Oct 5", "2.75h", "2.75h"]], "Now is the weeks as they are with the moves kept");
      eq([again.moves, again.nothing, again.off], [[], "Nothing to change: the coming weeks are as even as they can be.", true], "the same plan: nothing more to change, Apply off");
      await cancel(tab);
      eq(await kept(tab), after, "no one is stamped again");
      await devPanel(tab, true);
      eq((await devButtons(tab)).filter(id => id.startsWith("pabuSpread")), ["pabuSpreadBtn", "pabuSpreadBack"], "Put them back shows while a move holds");
      has((await devHints(tab)).join(" | "), "5 due dates are moved now.", "Developer Mode says how many");
      await devPanel(tab, false);

      // Momo: the five calls wait with their new due.
      await switchTo(tab, "momo");
      eq(await pabuTasks(tab), [
        ["Call Friend 1 (from Pabu, due Oct 1)", 0.5], ["Call Friend 3 (from Pabu, due Oct 1)", 0.5], ["Call Friend 5 (from Pabu, due Oct 1)", 0.5],
        ["Text Pat (from Pabu, due Oct 4)", 0.25],
        ["Call Friend 0 (from Pabu, due Oct 5)", 0.5], ["Call Friend 2 (from Pabu, due Oct 5)", 0.5], ["Call Friend 4 (from Pabu, due Oct 5)", 0.5], ["Call Friend 6 (from Pabu, due Oct 5)", 0.5], ["Call Friend 7 (from Pabu, due Oct 5)", 0.5],
        ["Text Quinn (from Pabu, due Oct 6)", 0.25]
      ], "Momo's tasks after: the moved calls due Oct 5");
    }
  },
  {
    name: "spread pabu: This week says (spread out) on a call moved into it, a ✓ ends the move (the next counts from today) and taking it back brings it back, the person pop-up keeps it for a note and drops it for a new schedule",
    async run(t) {
      const tab = await pabuWith(t, SMALL);
      const p = tab.page;
      eq((await pb.thisWeek(tab)).lines, [], "all four calls (SMALL) are due next week (Tue Oct 6): nothing this week");
      await openSpread(tab, "pabuSpreadBtn");
      const shown = await spread(tab);
      eq(shown.rows.slice(0, 3), [["Sep 28", "0", "30m"], ["Oct 5", "2h", "1h"], ["Oct 12", "0", "30m"]], "2 h in the week of Oct 5 become 30 m, 1 h and 30 m");
      eq(shown.moves, ["Call Friend 1: Oct 6 → Oct 12", "Call Friend 2: Oct 6 → Oct 4"], "one goes a week on, one back to Sunday");
      await apply(tab);
      eq(movedOf(await kept(tab)), [["Friend 1", { from: "2026-10-06", to: "2026-10-12" }], ["Friend 2", { from: "2026-10-06", to: "2026-10-04" }]], "kept");
      eq((await pb.thisWeek(tab)).lines, ["Call Friend 2 · due Sun (spread out) · 30m"], "This week: the one moved into it says so");
      eq(await dues(tab, "Friend 2"), { usual: "2026-10-06", moved: true, due: "2026-10-04", keeps: { from: "2026-10-06", to: "2026-10-04" } }, "Pabu's due");

      // The pop-up of the person says it too.
      await pb.openPerson(tab, "Call Friend 2", "week");
      has((await pb.popup(tab)).boxes[0].last, "due in 4 days (spread out)", "the pop-up's line");
      await p.keyboard.press("Escape");

      // ✓: the next counts a month from today; the move no longer holds. Taking it back: it holds again.
      await pb.tick(tab, "Call Friend 2");
      eq(await dues(tab, "Friend 2"), { usual: "2026-10-30", moved: false, due: "2026-10-30", keeps: { from: "2026-10-06", to: "2026-10-04" } }, "after the ✓: a month after today, no move holds (it is still kept)");
      eq((await pb.thisWeek(tab)).lines, ["✓ Call Friend 2 · talked today · 30m"], "ticked");
      has(movedLine(await bugLines(tab, "pabu"))[0], "Moved due dates (Spread out): 1; kept but no longer holding: 1", "bug report counts it");
      await pb.tick(tab, "Call Friend 2"); // the same button now takes it off
      eq(await dues(tab, "Friend 2"), { usual: "2026-10-06", moved: true, due: "2026-10-04", keeps: { from: "2026-10-06", to: "2026-10-04" } }, "the ✓ taken back: the move holds again");
      eq((await pb.thisWeek(tab)).lines, ["Call Friend 2 · due Sun (spread out) · 30m"], "back on This week as moved");

      // Save with only the note changed keeps the move.
      await pb.openPerson(tab, "Call Friend 2", "week");
      await pb.fill(tab, { note: "Likes jazz." });
      await pb.save(tab);
      eq([(await kept(tab)).find(x => x.name === "Friend 2").moved, await pb.isOpen(tab)], [[{ from: "2026-10-06", to: "2026-10-04" }], false], "a new note: the move stays");
      eq((await pb.person(tab, "Friend 2")).note, "Likes jazz.", "and the note is saved");
      // A new schedule (every 2 weeks) drops it.
      await pb.openPerson(tab, "Call Friend 2", "week");
      await pb.setBox(tab, 1, { every: "2weeks" });
      await pb.save(tab);
      const friend2 = await pb.person(tab, "Friend 2");
      eq([friend2.cadences[0].every, "moved" in friend2.cadences[0]], ["2weeks", false], "how often changed: no move kept");
      eq((await dues(tab, "Friend 2")).due, "2026-09-20", "it counts from the last talk as always (overdue now)");
      eq(movedOf(await kept(tab)).map(x => x[0]), ["Friend 1"], "Friend 1's move is untouched");
    }
  },
  {
    name: "spread pabu: spreading again after a change plans afresh — a kept move the new plan no longer needs is let go (\"back to\"), another taken, the others left alone",
    async run(t) {
      const tab = await pabuWith(t, SMALL);
      await openSpread(tab, "pabuSpreadBtn");
      await apply(tab);
      const first = movedOf(await kept(tab));
      eq(first, [["Friend 1", { from: "2026-10-06", to: "2026-10-12" }], ["Friend 2", { from: "2026-10-06", to: "2026-10-04" }]], "the first plan");
      // A new weekly call (30m, due today) weighs on this week, so Friend 2 is no longer better off there.
      await pb.quickAdd(tab, "Zed", { every: "week", how: "call" });
      eq((await pb.thisWeek(tab)).lines, ["Call Zed · due today · 30m", "Call Friend 2 · due Sun (spread out) · 30m"], "Zed is due today");
      const stamped = await kept(tab);
      await openSpread(tab, "pabuSpreadBtn");
      const shown = await spread(tab);
      eq(shown.rows.slice(0, 3), [["Sep 28", "1h", "30m"], ["Oct 5", "1h", "1h"], ["Oct 12", "30m", "1h"]], "now: Zed and Friend 2 this week; spread out: one call a half hour in each of the next two");
      eq(shown.moves, ["Call Friend 3: Oct 6 → Oct 12", "Call Friend 2: back to Oct 6"], "a new move, and the kept one let go (Friend 1's stays as it is, not listed)");
      has(await tab.page.innerText("#kSpreadMoves .spread-moves-head"), "2 due dates would move:", "both count");
      await apply(tab);
      eq(lastDialog(tab), "Move 2 due dates to even out your weeks?", "asked for both");
      const after = await kept(tab);
      eq(movedOf(after), [["Friend 1", { from: "2026-10-06", to: "2026-10-12" }], ["Friend 3", { from: "2026-10-06", to: "2026-10-12" }]], "kept: Friend 1 as it was, Friend 3 now, Friend 2 none");
      eq(after.filter((p, i) => p.u !== stamped[i].u).map(p => p.name), ["Friend 2", "Friend 3"], "only those two are stamped");
      eq((await pb.thisWeek(tab)).lines, ["Call Zed · due today · 30m"], "Friend 2 is back to next week");
      await openSpread(tab, "pabuSpreadBtn");
      const again = await spread(tab);
      eq([again.moves, again.nothing, again.off], [[], "Nothing to change: the coming weeks are as even as they can be.", true], "and that is the plan");
      eq(again.rows.slice(0, 3), [["Sep 28", "30m", "30m"], ["Oct 5", "1h", "1h"], ["Oct 12", "1h", "1h"]], "the weeks");
    }
  },
  {
    name: "spread pabu: Put them back asks first (No changes nothing) and lets all go; Export keeps the moves, an import in a new profile too, an older backup has none, damaged ones are dropped",
    async run(t) {
      const tab = await pabuWith(t, BIG);
      await openSpread(tab, "pabuSpreadBtn");
      await apply(tab);
      const moved5 = MOVES5.map(n => [`Friend ${n}`, OCT5]);
      eq(movedOf(await kept(tab)), moved5, "five moved");
      const stamped = await kept(tab);

      // Put them back: No first.
      await putBack(tab, "pabuSpreadBack", { no: true });
      eq(lastDialog(tab), "Put the 5 moved due dates back where they were?", "the question");
      eq([await kept(tab), (await devButtons(tab)).includes("pabuSpreadBack")], [stamped, true], "No: nothing changes");
      await putBack(tab, "pabuSpreadBack");
      eq(lastDialog(tab), "Put the 5 moved due dates back where they were?", "asked again");
      const back = await kept(tab);
      eq(movedOf(back), [], "no move left");
      eq(back.filter((p, i) => p.u !== stamped[i].u).map(p => p.name), MOVES5.map(n => `Friend ${n}`), "those five are stamped again, so the sync carries it");
      eq((await dues(tab, "Friend 1")).due, "2026-10-01", "due on Oct 1 again");
      eq((await pb.thisWeek(tab)).lines.filter(l => l.includes("due tomorrow")).length, 8, "all eight calls back on This week");
      eq([(await devButtons(tab)).includes("pabuSpreadBack"), (await devHints(tab)).join(" ").includes("moved now")], [false, false], "Put them back is gone, and the hint with it");
      await devPanel(tab, false);

      // Apply again; Export keeps the moves.
      await openSpread(tab, "pabuSpreadBtn");
      await apply(tab);
      const file = await exportBackup(tab);
      eq(file.people.filter(p => p.cadences.some(c => c.moved)).map(p => [p.name, p.cadences[0].moved]), moved5, "Export carries the moves");
      eq(file.people.find(p => p.name === "Pat").cadences[0].moved, undefined, "and none on the others");

      // Another profile: Import keeps them (and Export gives them back).
      const other = await open(t, { app: "pabu", size: DESKTOP });
      await importBackup(other, file);
      eq(movedOf(await kept(other)), moved5, "imported with their moves");
      eq((await pb.thisWeek(other)).lines.length, 5, "This week as moved: three calls and two texts");
      eq((await exportBackup(other)).people, file.people, "and exported again as they came");
      // An older backup (version 1) has none: importing it replaces them.
      await importBackup(other, gen.pabu(BIG));
      eq(movedOf(await kept(other)), [], "a version 1 backup has no moves");
      eq((await pb.thisWeek(other)).lines.length, 10, "every call due as usual");

      // Damaged moves: a day that isn't one, a move over 14 days (the 14th is fine, the 15th not), no move at all (from = to), text.
      const bad = JSON.parse(JSON.stringify(file));
      const set = (name, m) => { bad.people.find(p => p.name === name).cadences[0].moved = m; };
      set("Friend 0", { from: "x", to: "2026-10-05" });
      set("Friend 2", { from: "2026-10-01", to: "2026-12-30" });
      set("Friend 3", { from: "2026-10-01", to: "2026-10-15" });
      set("Friend 4", "soon");
      set("Friend 5", { from: "2026-10-01", to: "2026-10-16" });
      set("Friend 6", { from: "2026-10-01", to: "2026-10-01" });
      await importBackup(other, bad); // Friend 7's move is sound as it was
      eq(movedOf(await kept(other)), [["Friend 3", { from: "2026-10-01", to: "2026-10-15" }], ["Friend 7", OCT5]], "only the sound moves are kept (a move of 14 days is the longest)");
      eq(other.problems, [], "no console error");
    }
  },
  {
    name: "spread appa: six jobs due together spread over three weeks, \"(spread out)\" on the home, a job by the meter alone never moves, Put them back lets all go",
    async run(t) {
      const tab = await open(t, { app: "appa", size: DESKTOP });
      await importBackup(tab, appaWorld());
      eq((await comingUp(tab)).filter(l => l.includes("Due tomorrow")).length, 6, "six jobs due tomorrow, Oct 1");
      await openSpread(tab, "appaSpreadBtn");
      const shown = await spread(tab);
      eq(shown.rows.slice(0, 4), [["Sep 28", "6h", "2h"], ["Oct 5", "0", "2h"], ["Oct 12", "0", "2h"], ["Oct 19", "0", "0"]], "6 h in one week become 2 h in each of three");
      eq(shown.moves, ["House: Job 1: Oct 1 → Oct 5", "House: Job 2: Oct 1 → Oct 12", "House: Job 3: Oct 1 → Oct 5", "House: Job 4: Oct 1 → Oct 12"], "four jobs move, never the meter job");
      lacks(shown.moves.join(" "), "Rotate tires", "the job by the meter is not among them");
      await cancel(tab);
      eq((await jobs(tab)).filter(j => j.keeps), [], "Cancel changes nothing");
      await openSpread(tab, "appaSpreadBtn");
      await apply(tab, { no: true });
      eq(lastDialog(tab), "Move 4 due dates to even out your weeks?", "the question");
      eq((await jobs(tab)).filter(j => j.keeps), [], "No: nothing moved");
      const was = await jobs(tab);
      await apply(tab);
      const now = await jobs(tab);
      eq(now.filter(j => j.keeps).map(j => [j.name, j.keeps]), [["Job 1", OCT5], ["Job 2", OCT12], ["Job 3", OCT5], ["Job 4", OCT12]], "kept on those four");
      eq(now.filter((j, i) => j.u !== was[i].u).map(j => j.name), ["Job 1", "Job 2", "Job 3", "Job 4"], "only they are stamped");
      eq(now.filter(j => j.holds).length, 4, "all four hold");
      eq(now.find(j => j.name === "Rotate tires").holds, false, "the meter job: no move");
      const text = Object.fromEntries(now.map(j => [j.name, j.text]));
      eq([text["Job 0"], text["Job 1"], text["Job 2"]], ["Due tomorrow", "Due in 5 days (spread out)", "Due in 12 days (spread out)"], "the due words");
      eq((await comingUp(tab)).filter(l => l.includes("Job")), [
        "House — Job 0 · Due tomorrow", "House — Job 5 · Due tomorrow", "House — Job 1 · Due in 5 days (spread out)", "House — Job 3 · Due in 5 days (spread out)",
        "House — Job 2 · Due in 12 days (spread out)", "House — Job 4 · Due in 12 days (spread out)"
      ], "Coming up");
      // Opened again: the same plan, so nothing more to change (Apply off), the weeks as they are.
      await openSpread(tab, "appaSpreadBtn");
      const again = await spread(tab);
      eq([again.moves, again.nothing, again.off], [[], "Nothing to change: the coming weeks are as even as they can be.", true], "the same plan: nothing more to change");
      eq(again.rows.slice(0, 3), [["Sep 28", "2h", "2h"], ["Oct 5", "2h", "2h"], ["Oct 12", "2h", "2h"]], "Now is the weeks as they are with the moves kept");
      await cancel(tab);
      eq((await jobs(tab)).map(j => j.u), now.map(j => j.u), "no one is stamped again");
      await devPanel(tab, true);
      has((await devHints(tab)).join(" | "), "4 due dates are moved now.", "Developer Mode says how many");

      // Export keeps them; a damaged one is dropped.
      const file = await exportBackup(tab);
      eq(file.jobs.filter(j => j.moved).map(j => j.name), ["Job 1", "Job 2", "Job 3", "Job 4"], "Export carries the moves");
      const bad = JSON.parse(JSON.stringify(file));
      bad.jobs.find(j => j.name === "Job 1").moved = { from: "2026-10-01", to: "2027-01-30" };
      bad.jobs.find(j => j.name === "Job 2").moved = "soon";
      bad.jobs.find(j => j.name === "Job 3").moved = { from: "x", to: "2026-10-05" };
      bad.jobs.find(j => j.name === "Job 0").moved = { from: "2026-10-01", to: "2026-10-16" }; // 15 days: one too many
      bad.jobs.find(j => j.name === "Job 5").moved = { from: "2026-10-01", to: "2026-10-15" }; // 14 days: the longest
      await importBackup(tab, bad); // Job 4's is sound as it was
      eq((await jobs(tab)).filter(j => j.keeps).map(j => j.name), ["Job 4", "Job 5"], "damaged moves are dropped (a move of 14 days is the longest)");
      await importBackup(tab, file);
      eq((await jobs(tab)).filter(j => j.keeps).length, 4, "imported with their moves");

      // Put them back: No first.
      await putBack(tab, "appaSpreadBack", { no: true });
      eq(lastDialog(tab), "Put the 4 moved due dates back where they were?", "the question");
      eq((await jobs(tab)).filter(j => j.keeps).length, 4, "No: nothing changes");
      await putBack(tab, "appaSpreadBack");
      const back = await jobs(tab);
      eq(back.filter(j => j.keeps).length, 0, "no move left");
      eq(back.filter(j => j.name !== "Rotate tires").map(j => [j.date, j.text]), Array(6).fill(["2026-10-01", "Due tomorrow"]), "all due Oct 1 again");
      eq((await devButtons(tab)).includes("appaSpreadBack"), false, "Put them back is gone");
      eq(tab.problems, [], "no console error");
    }
  },
  {
    name: "spread appa: recording a moved job ends its move (the next counts from the record), the others hold",
    async run(t) {
      const tab = await open(t, { app: "appa", size: DESKTOP }), p = tab.page;
      await importBackup(tab, appaWorld());
      await openSpread(tab, "appaSpreadBtn");
      await apply(tab);
      await p.click(`${M} [data-act="open-thing"][data-id="${HOUSE.id}"]`);
      await p.click(`${M} #addRecordBtn`);
      await p.waitForSelector(`${M} #recOverlay.open`);
      await p.click(`${M} #rcJobs [data-job="${jobId(1)}"]`);
      await p.fill(`${M} #rcTook`, "45");
      await p.click(`${M} #rcSaveBtn`);
      const now = await jobs(tab), job1 = now.find(j => j.name === "Job 1");
      eq([job1.holds, job1.usual, job1.date, job1.text], [false, "2026-12-30", "2026-12-30", "Due Dec 30"], "its move ends: three months from today");
      eq(now.filter(j => j.holds).map(j => j.name), ["Job 2", "Job 3", "Job 4"], "the others still hold");
      has(movedLine(await bugLines(tab, "appa"))[0], "Moved due dates (Spread out): 3; kept but no longer holding: 1", "bug report counts it");
    }
  },
  {
    name: "spread level: overdue, weekly, 0-minute and out-of-range items never move; an empty list gives no moves; the same items give the same plan whatever the order or how often",
    async run(t) {
      const tab = await open(t, { app: "pabu", size: DESKTOP });
      const out = await tab.page.evaluate(({ today }) => {
        const L = Kyoshi.level, d = (id, due, minutes, intervalDays) => ({ id, due, minutes, intervalDays });
        const ids = ["a", "b", "c", "d", "e", "f"];
        const movable = ids.map(id => d(id, "2026-10-01", 60, 30));
        const others = [d("old", "2026-09-20", 60, 30), d("wk", "2026-10-01", 60, 7), d("zero", "2026-10-01", 0, 30), d("far", "2027-03-01", 60, 30)];
        const items = movable.concat(others);
        const plan = L.plan(items, { today });
        const rev = items.slice().reverse(), mid = items.slice(3).concat(items.slice(0, 3));
        // The edge of "weekly": with Sunday's week busy and the next empty, an item due every 7 days stays (a quarter is under 2
        // days) while one every 8 days (2 days either way) goes to Monday.
        const busy = d("busy", "2026-10-02", 60, 2), edge = L.plan([busy, d("wk7", "2026-10-04", 60, 7)], { today }).concat(L.plan([busy, d("wk8", "2026-10-04", 60, 8)], { today }));
        return {
          edge,
          plan, again: L.plan(items, { today }), reversed: L.plan(rev, { today }), rotated: L.plan(mid, { today }),
          doubled: L.plan(items.concat(items.map(i => ({ ...i }))), { today }),
          empty: L.plan([], { today }), noToday: L.plan(items, {}), notAList: L.plan(null, { today }),
          weeks: L.weeks(items, plan, { today }), constants: [L.LEVEL_WEEKS, L.MOVE_FRACTION, L.MOVE_MAX_DAYS],
          monday: L.mondayOf(today), untouched: JSON.stringify(items) === JSON.stringify(movable.concat(others))
        };
      }, { today: TODAY });
      // The overdue one (counted today) and the weekly one weigh 60 each in the week of Sep 28, which has 5 days left; each of
      // the six can reach 7 days (a quarter of 30) either way, Sep 30 to Oct 8, and goes to the week with fewer minutes a day:
      // a, b and c to next week (60, 120, 180 min: 8.6, 17.1, 25.7 a day, against 24 here), d stays (180 min = 36 a day here
      // against 25.7), then e and f go (34.3 and 42.9 a day there against 36).
      const to5 = id => ({ id, from: "2026-10-01", to: "2026-10-05" });
      eq(out.plan, ["a", "b", "c", "e", "f"].map(to5), "five of the six go to Monday Oct 5; old, wk, zero and far never");
      eq([out.again, out.reversed, out.rotated, out.doubled.filter(m => m.id.length === 1).length > 0], [out.plan, out.plan, out.plan, true], "the same plan again, reversed, rotated");
      eq([out.empty, out.noToday, out.notAList], [[], [], []], "an empty list, no today, no list: no moves");
      eq(out.weeks.before.slice(0, 3), [480, 0, 0], "before: six at 60, the weekly one and the overdue one (today); the 0-minute and the far one don't weigh");
      eq(out.weeks.after.slice(0, 3), [180, 300, 0], "after: the weekly, the overdue and d; then a, b, c, e and f");
      eq(out.weeks.mondays.length, 8, "eight weeks");
      eq([out.weeks.mondays[0], out.monday, out.constants], ["2026-09-28", "2026-09-28", [8, 0.25, 14]], "this week's Monday, the constants");
      eq(out.untouched, true, "the items handed in are left as they were");
      eq(out.edge, [{ id: "wk8", from: "2026-10-04", to: "2026-10-05" }], "a Sunday item every 7 days stays; every 8 days it can go to Monday");
    }
  },
  {
    name: "spread bug reports: both apps count the moved due dates and name nothing",
    async run(t) {
      const pabu = await pabuWith(t, BIG);
      eq(movedLine(await bugLines(pabu, "pabu")), ["- Moved due dates (Spread out): 0; kept but no longer holding: 0"], "Pabu before");
      await openSpread(pabu, "pabuSpreadBtn");
      await apply(pabu);
      const lines = await bugLines(pabu, "pabu");
      eq(movedLine(lines), ["- Moved due dates (Spread out): 5; kept but no longer holding: 0"], "Pabu: five");
      ["Friend", "Pat", "Quinn"].forEach(n => lacks(lines.join("\n"), n, "no name in Pabu's report"));

      const appa = await open(t, { app: "appa", size: DESKTOP });
      await importBackup(appa, appaWorld());
      eq(movedLine(await bugLines(appa, "appa")), ["- Moved due dates (Spread out): 0; kept but no longer holding: 0"], "Appa before");
      await openSpread(appa, "appaSpreadBtn");
      await apply(appa);
      const alines = await bugLines(appa, "appa");
      eq(movedLine(alines), ["- Moved due dates (Spread out): 4; kept but no longer holding: 0"], "Appa: four");
      ["House", "Job 1", "Rotate", "Car"].forEach(n => lacks(alines.join("\n"), n, "no name in Appa's report"));
    }
  }
];
