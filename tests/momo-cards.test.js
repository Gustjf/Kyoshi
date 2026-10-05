/* Kyoshi · tests/momo-cards.test.js — Momo's cards with time before and after inside them (Phase 5 of
 * plan_2026-10-05): a card's Before & after in its pop-up (a commute by default, none unless set), the same both ways or
 * not, made of ordinary cards inside it (on each day it's put on, counted in the day's total, renamed with their title,
 * gone at 0, a card in its middle left alone; not offered for a card going inside another, nor for one inside a card;
 * "discard changes?" knows them; kept through Export and Import), and every card showing when it ends as well as when
 * it starts: on the board (a block in its parts: Commute 0900–0930 · Work 0930–1730 · Commute 1730–1800), for other
 * apps' events, and on Today. */
"use strict";
const { DESKTOP, eq, ok, open, lastDialog, importBackup, exportBackup } = require("./lib");
const mo = require("./momo");

// A day's cards on the board in time order, each as "Title 0900–0930".
const block = d => d.cards.filter(c => c.time).sort((a, b) => a.time.localeCompare(b.time)).map(c => `${c.title} ${c.time}`);
// The baseline's cards as stored, in order: [title, hours, day, where it is inside its card ("top of Work"), pin].
const stored = tab => tab.page.evaluate(() => {
  const cards = Kyoshi.apps.momo.S.data.baseline.cards, byId = new Map(cards.map(c => [c.id, c]));
  return cards.map(c => [c.title, c.hours, c.day, c.parentId ? `${c.pos} of ${byId.get(c.parentId).title}` : "", c.pin]);
});
// Today's rows under a heading, each as [when, end, title].
const rowsUnder = async (tab, head) => ((await mo.today(tab)).sections.find(s => s.head === head) || { rows: [] }).rows.map(r => [r.when, r.end, r.title]);

module.exports = [
  {
    name: "momo cards: a commute before and after inside a card, the same both ways or not; start–end on the board and on Today",
    async run(t) {
      const tab = await open(t, { app: "momo", size: DESKTOP }), p = tab.page;
      // No meal slots from Turtleduck's routine (their cards go on the minute's tick): the board holds only these cards.
      await p.evaluate(() => { Kyoshi.apps.turtleduck.routine = () => []; Kyoshi.tick(); });
      await mo.view(tab, "base");

      // Work 8h pinned at 0900 on Wednesday and Thursday, a commute of 30 minutes before (the same both ways, the default).
      await p.click("#kMount #addTaskBtn");
      await p.waitForSelector("#kMount #cardOverlay.open");
      eq(await mo.sides(tab), { shown: true, title: "Commute", before: 0, after: 0, same: true, afterOff: true }, "a new card: Commute, none either way, the same both ways");
      await mo.closeCard(tab);
      await mo.newCard(tab, { title: "Work", hours: 8, days: [2, 3], pin: "0900", sides: { before: 30 } });
      let days = await mo.days(tab);
      eq(block(days[2]), ["Commute 0900–0930", "Work 0930–1730", "Commute 1730–1800"], "the block in its parts, each start to end");
      eq(block(days[3]), ["Commute 0900–0930", "Work 0930–1730", "Commute 1730–1800"], "on each day it's put on");
      eq([days[2].total, days[3].total], [9, 9], "the day's total counts them");
      const work = days[2].cards.find(c => c.title === "Work");
      eq(work.label, "Work, 8h + Commute 30m + Commute 30m = 9h, pinned at 0900", "pinned at 0900: where its block starts");
      eq(days[2].cards.filter(c => c.inner).map(c => c.label), ["Commute, 30m, at the top of Work, from 0900", "Commute, 30m, at the bottom of Work, from 1730"], "inside it, at its top and its bottom");
      ok(days[2].cards.every(c => !c.noEnd), "every end fits on a computer");
      eq(await stored(tab), [["Work", 8, 2, "", 9], ["Commute", 0.5, 2, "top of Work", null], ["Commute", 0.5, 2, "bottom of Work", null],
        ["Work", 8, 3, "", 9], ["Commute", 0.5, 3, "top of Work", null], ["Commute", 0.5, 3, "bottom of Work", null]], "ordinary cards inside it");

      // Reopened: 30 both ways. Not the same both ways, 15 after: on that day only.
      await mo.openCard(tab, work.id);
      eq(await mo.sides(tab), { shown: true, title: "Commute", before: 30, after: 30, same: true, afterOff: true }, "reopened: After follows Before");
      await mo.setSides(tab, { same: false, after: 15 });
      await mo.saveCard(tab);
      days = await mo.days(tab);
      eq(block(days[2]), ["Commute 0900–0930", "Work 0930–1730", "Commute 1730–1745"], "the one after is 15m");
      eq([days[2].total, days[3].total], [8.75, 9], "Thursday's stays as it was");
      await mo.openCard(tab, work.id);
      eq(await mo.sides(tab), { shown: true, title: "Commute", before: 30, after: 15, same: false, afterOff: false }, "unequal: Same both ways is off");

      // None before: the one at the top goes, and Work starts at its pin.
      await mo.setSides(tab, { before: 0 });
      await mo.saveCard(tab);
      days = await mo.days(tab);
      eq(block(days[2]), ["Work 0900–1700", "Commute 1700–1715"], "the top one is gone");
      eq(days[2].total, 8.25, "and its time");

      // A Lunch in its middle: going inside Work, it isn't offered a before & after of its own; then left alone by Work's,
      // whose own part runs around it.
      await p.click("#kMount #addTaskBtn");
      await p.waitForSelector("#kMount #cardOverlay.open");
      await p.fill("#kMount #cardTitle", "Lunch");
      await p.fill("#kMount #cardHours", "1");
      await p.click('#kMount #cardDays .day-pill[data-day="2"]');
      await p.selectOption("#kMount #cardIn", "work");
      await p.selectOption("#kMount #cardPos", "middle");
      eq((await mo.sides(tab)).shown, false, "a card going inside another holds none");
      await mo.saveCard(tab);
      eq(block((await mo.days(tab))[2]), ["Work 0900–1800", "Lunch 1300–1400", "Commute 1800–1815"], "Work's own part ends after the Lunch inside it");

      // Renamed and the same both ways again: Drive, 30 minutes each; the Lunch stays.
      const after = (await mo.days(tab))[2].cards.find(c => c.title === "Commute").id;
      await mo.openCard(tab, work.id);
      eq(await mo.sides(tab), { shown: true, title: "Commute", before: 0, after: 15, same: false, afterOff: false }, "its after only");
      await mo.setSides(tab, { title: "Drive", same: true, before: 30 });
      eq(await mo.sides(tab), { shown: true, title: "Drive", before: 30, after: 30, same: true, afterOff: true }, "ticked: After follows Before");
      await mo.saveCard(tab);
      days = await mo.days(tab);
      eq(block(days[2]), ["Drive 0900–0930", "Work 0930–1830", "Lunch 1330–1430", "Drive 1830–1900"], "renamed, both ways");
      eq(days[2].total, 10, "8h + 1h + 30m + 30m");
      eq((await stored(tab)).filter(c => c[2] === 2), [["Work", 8, 2, "", 9], ["Drive", 0.5, 2, "bottom of Work", null], ["Lunch", 1, 2, "middle of Work", null], ["Drive", 0.5, 2, "top of Work", null]],
        "one made before, the one after renamed, the Lunch as it was");
      eq(days[2].cards.find(c => c.label.startsWith("Drive, 30m, at the bottom")).id, after, "renamed: the same card");

      // Changed and closed with Esc: asked first, and nothing changes.
      await mo.openCard(tab, work.id);
      await mo.setSides(tab, { before: 45 });
      await p.keyboard.press("Escape");
      eq(lastDialog(tab), "Discard your changes to this card?", "Esc asks first");
      eq(block((await mo.days(tab))[2]), ["Drive 0900–0930", "Work 0930–1830", "Lunch 1330–1430", "Drive 1830–1900"], "discarded");
      // A card inside another holds none: its pop-up has no Before & after.
      await mo.openCard(tab, days[2].cards.find(c => c.title === "Drive").id);
      eq((await mo.sides(tab)).shown, false, "not for a card inside a card");
      await mo.closeCard(tab);
      // Two fields that can't be saved: the minutes, and the card's own name for its before & after.
      await mo.openCard(tab, work.id);
      await p.fill("#kMount #cardBefore", "");
      await p.type("#kMount #cardBefore", "e"); // a number field takes it, as the start of 1e2: not a number yet
      await mo.saveCard(tab);
      eq(lastDialog(tab), "Enter the minutes before and after, e.g. 30 (in 15-minute steps), or 0 for none.", "not a number");
      await mo.setSides(tab, { before: 30, title: "Work" });
      await mo.saveCard(tab);
      eq(lastDialog(tab), "Give the time before and after a name of its own, e.g. Commute.", "the card's own name");
      await mo.closeCard(tab);
      eq(block((await mo.days(tab))[2]), ["Drive 0900–0930", "Work 0930–1830", "Lunch 1330–1430", "Drive 1830–1900"], "neither saved");

      // Into this week (Wednesday is today), with other apps' events: start–end on the board and on Today.
      await p.evaluate(() => {
        Kyoshi.apps.bosco.agenda = () => [
          { id: "dose", title: "Dose", date: "2026-09-30", time: "19:30", minutes: 15, note: "" },
          { id: "bday", title: "Birthday", date: "2026-09-30", time: null, note: "" }
        ];
      });
      await mo.view(tab, "this");
      await mo.loadBaseline(tab);
      days = await mo.days(tab);
      eq(block(days[2]), ["Drive 0900–0930", "Work 0930–1830", "Lunch 1330–1430", "Drive 1830–1900"], "this week's block");
      eq([days[2].events.map(e => e.time), days[2].marks.length], [["1930–1945"], 1], "an event at a time: start to end; one any time that day: none");
      await mo.showToday(tab);
      eq(await rowsUnder(tab, "Next"), [["0900", "0930", "Drive"]], "Next, start and end");
      eq(await rowsUnder(tab, "Later today"), [["any time", "", "Birthday"], ["0930", "1330", "Work"], ["1330", "1430", "Lunch"], ["1430", "1830", "Work"], ["1830", "1900", "Drive"],
        ["1900", "1930", "Free"], ["1930", "1945", "Dose"], ["1945", "2400", "Free"]], "the rest of today, each with its end");

      // Nothing new is stored: Export and Import bring the block back as it was.
      const back = await exportBackup(tab);
      await importBackup(tab, back);
      await mo.showBoard(tab);
      eq(block((await mo.days(tab))[2]), ["Drive 0900–0930", "Work 0930–1830", "Lunch 1330–1430", "Drive 1830–1900"], "through a backup");
    }
  }
];
