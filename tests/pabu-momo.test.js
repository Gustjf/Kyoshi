/* Kyoshi · tests/pabu-momo.test.js — Pabu and Momo together, as the user sees them: each call, text or visit due waits
 * in Momo's Tasks, a task of its own ("Call Mom"), soonest due first and never more than 6 days early; dragged onto a day
 * it's a card of its own, as long as it takes; a talk (✓ in Pabu) shows ✓ on its card, keeping its minutes, or gets a
 * card of its own on the talk's day, and a ✓ taken back takes that back; birthdays as icons in the board's day headings
 * (✓ once you talked that day; Feb 29 on Feb 28 in other years) and as any-time rows on Today on a phone; "Open in Pabu"
 * (the call flashing on This week, else the person on People, the chips back to All); and two tabs (a ✓ in one reaches
 * the other's Momo within a minute). */
"use strict";
const { TODAY, DESKTOP, PHONE, eq, ok, has, open, switchTo, importBackup, travel, addDays } = require("./lib");
const gen = require("./generate");
const pb = require("./pabu");
const mo = require("./momo");

const D = n => addDays(TODAY, n);
// Reading on Thursday: a card of yours, so this week is planned (Momo places cards of their own only in a planned week).
const READING = { date: D(1), title: "Reading", hours: 1 };
// A card in Momo holding one of Pabu's calls (its need "p:<person>:c1": people from a version 1 backup have "c1").
const holding = (date, title, id) => ({ date, title, hours: 0.5, app: "pabu", need: `pabu:p:${id}:c1` });
// Pabu's tasks on the board on screen: [what it says (before " — drag"), hours, red-edged]; or just their titles.
const tasks = async tab => (await mo.tasks(tab)).tasks.filter(x => x.key.startsWith("n:pabu:")).map(x => [x.label.replace(/ — drag.*$/, ""), x.hours, x.overdue]);
const taskTitles = async tab => (await tasks(tab)).map(x => x[0].replace(/ \(.*$/, ""));
// The labels of a day's cards (0 = Monday), hours and times cut off; or [label, hours, ✓].
const onDay = async (tab, d) => (await mo.days(tab))[d].cards.map(c => c.label.replace(/, [\d.]+[hm]\b.*$/, ""));
const cardsOn = async (tab, d) => (await mo.days(tab))[d].cards.map(c => [c.label.replace(/, [\d.]+[hm]\b.*$/, ""), c.hours, c.done]);
// The board's birthdays: the icons in its day headings, by their words (a done one's ✓ is in them), and whether each is a
// button (a done one has nothing to click).
const marks = tab => tab.page.$$eval("#kMount #board .ev-mark", els => els.map(e => ({ title: e.getAttribute("title"), done: e.classList.contains("done"), button: e.tagName === "BUTTON" })));

// Pabu with its people (gen.PEOPLE, or others), and Momo with cards (Reading on Thursday, or others: card-0, card-1…).
async function both(t, { size = DESKTOP, people = gen.PEOPLE, cards = [READING] } = {}) {
  const tab = await open(t, { app: "pabu", size });
  await importBackup(tab, gen.pabu(people));
  await switchTo(tab, "momo");
  await importBackup(tab, gen.momo([], cards));
  return tab;
}

module.exports = [
  {
    name: "pabu momo: each call, text or visit due waits in Tasks, soonest due first, never more than 6 days early; on a day it's a card of its own, ✓ once you've talked (keeping its minutes)",
    async run(t) {
      const bo = { id: "pp-bo", name: "Bo", every: "2weeks", how: "text", minutes: 10, talks: [3] }; // due next Sunday, Oct 11
      const tab = await open(t, { app: "pabu", size: DESKTOP });
      await importBackup(tab, gen.pabu(gen.PEOPLE.concat(bo)));
      await switchTo(tab, "momo");
      // A week with no card of yours isn't planned yet: Momo places nothing in it, not even for Sam's text yesterday.
      eq((await mo.days(tab)).map(d => d.cards.length), [0, 0, 0, 0, 0, 0, 0], "nothing placed in a week not planned");
      // Planned (Reading on Thursday), Momo places its cards on the minute: Sam's text yesterday, a card of its own there, done.
      await importBackup(tab, gen.momo([], [READING]));
      await tab.ctx.clock.fastForward(61000);
      eq(await cardsOn(tab, 1), [["Text Sam (from Pabu — done ✓)", 0.25, true]], "yesterday's talk: a card of its own on its day, ✓");
      eq(await tasks(tab), [
        ["Visit Gran (from Pabu, overdue)", 2, true], ["Call Mom (from Pabu, overdue)", 0.5, true], ["Call Ana (from Pabu, overdue)", 0.5, true],
        ["Text Sam (from Pabu, due Oct 6)", 0.25, false], ["Call Jo (from Pabu, due Oct 10)", 0.5, false]
      ], "a task each, as long as it takes, soonest due first, the overdue red-edged; Jo's can go on Sunday, 6 days early, Bo's (due Oct 11) can't; Lee's isn't due till December, and Kai is birthday only");
      await mo.view(tab, "next");
      eq(await taskTitles(tab), ["Visit Gran", "Call Mom", "Call Ana", "Text Sam", "Call Jo", "Text Bo"], "next week's board: Bo's too");
      await mo.view(tab, "this");

      // Mom's call dragged onto today: a card of its own, its 30 minutes, red-edged while overdue.
      ok(await mo.dragTask(tab, "n:pabu:p:pp-mom:c1", 2), "dragged onto today");
      const [card] = (await mo.days(tab))[2].cards;
      eq([await cardsOn(tab, 2), card.late], [[["Call Mom (from Pabu — late)", 0.5, false]], true], "a card of its own, late");
      eq(await taskTitles(tab), ["Visit Gran", "Call Ana", "Text Sam", "Call Jo"], "her task is gone");

      // Talked to Mom, and to Ana, whose call had no card (✓ in Pabu): ✓ on Mom's card, still 30 minutes; Ana's talk gets a
      // card of its own on today.
      await switchTo(tab, "pabu");
      await pb.tick(tab, "Call Mom");
      await pb.tick(tab, "Call Ana");
      await switchTo(tab, "momo");
      eq(await cardsOn(tab, 2), [["Call Mom (from Pabu — done ✓)", 0.5, true], ["Call Ana (from Pabu — done ✓)", 0.5, true]], "✓ on Mom's card; Ana's talk, a card of its own");
      eq((await mo.openCard(tab, card.id)).from, [{ app: "pabu", id: `p:pp-mom:c1:${TODAY}`, title: "Call Mom", done: true, details: ["Every month · talked today", "Ask about the garden."] }],
        "its pop-up: ✓ done, how often and the last talk, her note's first line");
      await mo.closeCard(tab);
      eq(await taskTitles(tab), ["Visit Gran", "Text Sam", "Call Jo"], "neither waits in Tasks (their next aren't due by next Sunday)");

      // Both taken back in Pabu: Mom's card is late again; Ana's card goes, and her task is back.
      await switchTo(tab, "pabu");
      await pb.tick(tab, "Call Mom");
      await pb.tick(tab, "Call Ana");
      await switchTo(tab, "momo");
      eq(await onDay(tab, 2), ["Call Mom (from Pabu — late)"], "Mom's card late again, Ana's taken back");
      eq(await taskTitles(tab), ["Visit Gran", "Call Ana", "Text Sam", "Call Jo"], "Ana's call waits again");
    }
  },
  {
    name: "pabu momo: birthdays in the board's day headings, ✓ once you talked that day, Feb 29 on Feb 28 in other years; Open in Pabu flashes the call on This week, else the person on People",
    async run(t) {
      const leap = { id: "pp-leap", name: "Lee Ann", every: "month", how: "text", minutes: 10, talks: [5], birthday: "2000-02-29" };
      const tab = await both(t, { people: gen.PEOPLE.concat(leap), cards: [READING, holding(D(0), "Call Mom", "pp-mom"), holding(D(4), "Call Jo", "pp-jo")] });
      eq(await marks(tab), [{ title: "Kai's birthday, Thu any time, from Pabu", done: false, button: true }], "Kai's birthday tomorrow, in Thursday's heading");
      eq((await mo.days(tab))[3].total, 1, "Thursday's hours: Reading's, none for the birthday");

      // Open in Pabu from the card holding Mom's call: Pabu, her call flashing on This week.
      await mo.openCard(tab, "card-1");
      await mo.openInApp(tab, "pabu", "p:pp-mom:c1");
      eq(await pb.flashing(tab), ["week pp-mom c1"], "Mom's call flashes on This week");
      // Jo's call isn't due this week: his line on People flashes, the chips back to All when they hid him.
      await pb.openPerson(tab, "Mom");
      await pb.fill(tab, { group: "Family" });
      await pb.save(tab);
      await pb.pickChip(tab, "Family");
      await switchTo(tab, "momo");
      await mo.openCard(tab, "card-2");
      await mo.openInApp(tab, "pabu", "p:pp-jo:c1");
      eq([await pb.flashing(tab), (await pb.chips(tab)).on], [["person pp-jo"], "All"], "Jo's line flashes, on All");

      // Monday, Oct 12: Mom's birthday, she turns 60; talked to her that day, its icon has its ✓ (and nothing to click).
      await travel(tab, 12);
      await switchTo(tab, "momo");
      eq(await marks(tab), [{ title: "Mom's birthday (Turns 60 · Call), Mon any time, from Pabu", done: false, button: true }], "Mom's birthday, on Monday");
      await switchTo(tab, "pabu");
      await pb.tick(tab, "Call Mom");
      await switchTo(tab, "momo");
      eq(await marks(tab), [{ title: "Mom's birthday (Turns 60 · Call), Mon any time, from Pabu — done ✓", done: true, button: false }], "done ✓");

      // Feb 29 falls on Feb 28 in a year without it (a Sunday in 2027), and on Feb 29 in 2028 (a Tuesday: next week's board).
      await travel(tab, 133); // Monday, Feb 22, 2027
      eq(await marks(tab), [{ title: "Lee Ann's birthday (Turns 27 · Text), Sun any time, from Pabu", done: false, button: true }], "Feb 28 in 2027");
      await travel(tab, 364); // Monday, Feb 21, 2028
      await mo.view(tab, "next");
      eq(await marks(tab), [{ title: "Lee Ann's birthday (Turns 28 · Text), Tue any time, from Pabu", done: false, button: true }], "Feb 29 in 2028");
    }
  },
  {
    name: "pabu momo: on the phone, Today shows tomorrow's birthday as an any-time row, and the card holding an overdue call says Late till you talk",
    async run(t) {
      const tab = await both(t, { size: PHONE, cards: [{ date: D(0), title: "Sleep", hours: 8 }, holding(D(0), "Call Mom", "pp-mom")] }), p = tab.page;
      await p.waitForSelector("#kMount #todayView:not([hidden])");
      const rows = async head => (await mo.today(tab)).sections.find(s => s.head === head).rows.map(r => [r.when, r.title, r.sub, r.len, r.done, r.label]);
      eq(await rows("Tomorrow"), [["any time", "Kai's birthday", "", "15m", false, "Kai's birthday, any time, from Pabu"]], "Kai's birthday, tomorrow, at any time");
      eq(await rows("Next"), [["0800", "Call Mom", "Late", "30m", false, "Call Mom (from Pabu — late), 0800–0830"]], "next, after Sleep: Mom's call, late");
      // The birthday's row opens its pop-up.
      await p.click('#kMount #todayBody .t-row.t-event[data-ev="pabu:bday:pp-kai:2026"]');
      await p.waitForSelector("#kMount #eventOverlay.open");
      has(await p.locator("#kMount #eventOverlay").innerText(), "Kai's birthday", "its pop-up");
      await p.keyboard.press("Escape");
      // Talked to Mom: her row has its ✓, no longer late.
      await switchTo(tab, "pabu");
      await pb.tick(tab, "Call Mom");
      await switchTo(tab, "momo");
      eq(await rows("Next"), [["0800", "Call Mom", "", "30m ✓", true, "Call Mom (from Pabu — done ✓), 0800–0830"]], "done ✓");
    }
  },
  {
    name: "pabu momo: two tabs — a ✓ in one reaches the other's Momo within a minute (✓ on the call's card, a card of its own for a talk without one)",
    async run(t) {
      const a = await both(t, { cards: [READING, holding(D(0), "Call Mom", "pp-mom")] }), b = await open(t, { ctx: a.ctx, app: "momo", size: DESKTOP });
      eq(await onDay(b, 2), ["Call Mom (from Pabu — late)"], "the other tab's Momo: Mom's call today, late");
      await switchTo(a, "pabu");
      await pb.tick(a, "Call Mom");
      await pb.tick(a, "Call Ana");
      // The save reaches the other tab (its Pabu reloads), then its Momo looks for other apps' changes within a minute.
      await b.page.waitForFunction(() => Kyoshi.apps.pabu.personById("pp-ana").cadences[0].talks.length === 1, null, { timeout: 5000 });
      await b.ctx.clock.fastForward(61000);
      await b.page.waitForFunction(() => [...document.querySelectorAll('#kMount #board .col[data-day="2"] .card[data-id]')].some(c => /^Call Ana \(from Pabu — done ✓\)/.test(c.getAttribute("aria-label"))), null, { timeout: 5000 });
      eq(await onDay(b, 2), ["Call Mom (from Pabu — done ✓)", "Call Ana (from Pabu — done ✓)"], "✓ on Mom's card; Ana's talk, a card of its own");
      eq(await taskTitles(b), ["Visit Gran", "Text Sam", "Call Jo"], "its Tasks follow");
    }
  }
];
