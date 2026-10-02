/* Kyoshi · tests/pabu-momo.test.js — Pabu and Momo together, as the user sees them: who's due fills the "Keep in touch"
 * cards soonest first, each person whole and never more than 6 days early, someone no card has room for waits in Tasks,
 * a talk today keeps its minutes on today's card with ✓ (the card done once everyone on it is), birthdays as icons in
 * the board's day headings and as any-time rows on Today (✓ once you talked that day), Feb 29 on Feb 28 in other years,
 * "Open in Pabu" (the person flashing), and two tabs (a ✓ in one reaches the other's Momo within a minute). */
"use strict";
const { TODAY, DESKTOP, PHONE, eq, ok, has, open, switchTo, importBackup, travel, addDays } = require("./lib");
const gen = require("./generate");
const pb = require("./pabu");

const D = n => addDays(TODAY, n);
// Momo's "Keep in touch" cards, an hour each: today (Wednesday), Saturday, and next Thursday (card-0 … card-2).
const CARDS = [0, 3, 8].map(n => ({ date: D(n), title: "Keep in touch", hours: 1 }));
const cards = tab => tab.page.$$eval("#kMount .card[data-id^='card-']", els => Object.fromEntries(els.map(e => [e.dataset.id, e.getAttribute("aria-label").replace(/, 1h.*$/, "")])));
const tasks = tab => tab.page.$$eval("#taskCards .task", els => els.map(e => e.getAttribute("aria-label").replace(/ — drag.*$/, "")).filter(x => x.startsWith("Keep in touch")));
const week = (tab, which) => tab.page.click(`#kMount [data-view="${which}"]`);
// The board's birthdays: the icons in its day headings, by their words (a done one's ✓ is in its title).
const marks = tab => tab.page.$$eval("#kMount .ev-mark", els => els.map(e => ({ title: e.getAttribute("title"), done: e.classList.contains("done"), button: e.tagName === "BUTTON" })));
// What Pabu asks of Momo for this week and next: [id, due, from, overdue], or [id, date, done] for a talk.
const needs = tab => tab.page.evaluate(([from, to]) => Kyoshi.apps.pabu.inbox(from, to).map(n => (n.done ? [n.id, n.date, true] : [n.id, n.due, n.from, n.overdue])), [TODAY, D(11)]);
const AS_BEFORE = { "card-0": "Keep in touch (Call Mom and Call Ana from Pabu)", "card-1": "Keep in touch (Text Sam from Pabu)" };

// Pabu with its people (gen.PEOPLE), and Momo with the Keep in touch cards.
async function both(t, size = DESKTOP, people = gen.pabu()) {
  const tab = await open(t, { app: "pabu", size });
  await importBackup(tab, people);
  await switchTo(tab, "momo");
  await importBackup(tab, gen.momo([], CARDS));
  return tab;
}

module.exports = [
  {
    name: "pabu momo: Keep in touch cards fill soonest due first, each whole and not too early; a talk keeps its minutes, with ✓",
    async run(t) {
      const tab = await both(t), p = tab.page;
      eq(await needs(tab), [
        ["p:pp-gran", D(-9), null, true], ["p:pp-mom", D(-4), null, true], ["p:pp-ana", D(-3), null, true],
        ["p:pp-sam", D(6), D(0), false], ["p:pp-jo", D(10), D(4), false]
      ], "who's due by Sunday week, soonest first (Lee isn't yet; Kai, birthday only, never is)");
      eq(await cards(tab), AS_BEFORE, "today: Mom and Ana (Gran's visit is too long); Saturday: Sam");
      eq(await tasks(tab), ["Keep in touch (Visit Gran from Pabu, overdue)"], "Gran's 2-hour visit fits no card: a task");
      await week(tab, "next");
      eq(await cards(tab), { "card-2": "Keep in touch (Call Jo from Pabu)" }, "Jo can't go on Saturday (more than 6 days early): next Thursday");
      await week(tab, "this");

      // Talked to Mom today: her talk keeps its 30 minutes on today's card, with ✓ in the pop-up; her next isn't due by
      // Sunday week.
      await switchTo(tab, "pabu");
      await pb.tick(tab, "pp-mom");
      eq((await needs(tab)).map(n => n[0]), ["p:pp-gran", "p:pp-ana", "p:pp-sam", "p:pp-jo", `p:pp-mom:${TODAY}`], "Mom's talk, done");
      await switchTo(tab, "momo");
      eq(await cards(tab), AS_BEFORE, "the same names: done only once everyone on the card is");
      await p.click('#kMount .card[data-id="card-0"]');
      has((await p.locator("#cardOverlay .from-needs").innerText()).replace(/\s*\n\s*/g, " | "), "Call Mom ✓ done · Open in Pabu | Every month · talked today | Ask about the garden. | Call Ana · Open in Pabu", "Mom's ✓ in the pop-up");
      await p.keyboard.press("Escape");

      // Ana too: everyone on today's card is done.
      await switchTo(tab, "pabu");
      await pb.tick(tab, "pp-ana");
      await switchTo(tab, "momo");
      eq((await cards(tab))["card-0"], "Keep in touch (Call Ana and Call Mom from Pabu — done ✓)", "done ✓ (talks on a day by name)");
      // Both taken back: as before.
      await switchTo(tab, "pabu");
      await pb.tick(tab, "pp-mom");
      await pb.tick(tab, "pp-ana");
      await switchTo(tab, "momo");
      eq(await cards(tab), AS_BEFORE, "as before");
      eq(await tasks(tab), ["Keep in touch (Visit Gran from Pabu, overdue)"], "Gran still waits");
    }
  },
  {
    name: "pabu momo: birthdays in the board's day headings, ✓ once talked that day, Feb 29 in other years; Open in Pabu",
    async run(t) {
      const leap = { id: "pp-leap", name: "Lee Ann", every: "none", how: "text", minutes: 10, talks: [], birthday: "2000-02-29" };
      const tab = await both(t, DESKTOP, gen.pabu(gen.PEOPLE.concat(leap))), p = tab.page;
      eq(await marks(tab), [{ title: "Kai's birthday (Call), Thu any time, from Pabu", done: false, button: true }], "Kai's birthday tomorrow, in Thursday's heading");
      // Feb 29 falls on Feb 28 in a year without it.
      const bday = range => p.evaluate(([from, to]) => Kyoshi.apps.pabu.agenda(from, to).map(e => [e.id, e.date, e.title, e.note, e.time]), range);
      eq(await bday(["2027-02-01", "2027-03-31"]), [["bday:pp-leap:2027", "2027-02-28", "Lee Ann's birthday", "Turns 27 · Text", null]], "Feb 28 in 2027");
      eq((await bday(["2028-02-01", "2028-03-31"]))[0][1], "2028-02-29", "Feb 29 in 2028");

      // Open in Pabu from today's card: Pabu, with Mom flashing.
      await p.click('#kMount .card[data-id="card-0"]');
      await p.click('#cardOverlay a[data-app="pabu"][data-id="p:pp-mom"]');
      await p.waitForFunction(() => Kyoshi.active().id === "pabu");
      ok(await pb.isFlashing(tab, "pp-mom"), "Mom's row flashes");

      // The next day: talked to Kai on his birthday, so its icon has its ✓ (and nothing to click).
      await travel(tab, 1);
      await pb.tick(tab, "pp-kai");
      await switchTo(tab, "momo");
      eq(await marks(tab), [{ title: "Kai's birthday (Call), Thu any time, from Pabu — done ✓", done: true, button: false }], "done ✓");

      // A week on, Mom's birthday (Monday, Oct 12) is on next week's board: she turns 60.
      await travel(tab, 6);
      await week(tab, "next");
      eq((await marks(tab)).map(m => m.title), ["Mom's birthday (Turns 60 · Call), Mon any time, from Pabu"], "Mom's birthday");
    }
  },
  {
    name: "pabu momo: on the phone, Today shows tomorrow's birthday as an any-time row",
    async run(t) {
      const tab = await both(t, PHONE), p = tab.page;
      await p.waitForSelector("#kMount #todayView:not([hidden])");
      const row = p.locator(`#kMount #todayBody .t-row.t-event[title^="Kai's birthday"]`);
      eq(await row.getAttribute("title"), "Kai's birthday (Call), any time, from Pabu", "Kai's birthday, tomorrow");
      has(await row.innerText(), "any time", "at any time");
      ok(await row.evaluate(el => el.tagName === "BUTTON"), "it opens its pop-up");
    }
  },
  {
    name: "pabu momo: two tabs — a ✓ in one reaches the other's Momo within a minute",
    async run(t) {
      const a = await both(t), b = await open(t, { ctx: a.ctx, app: "momo", size: DESKTOP });
      eq(await cards(b), AS_BEFORE, "the other tab's Momo");
      await switchTo(a, "pabu");
      await pb.tick(a, "pp-mom");
      await pb.tick(a, "pp-ana");
      // The save reaches the other tab (its Pabu reloads), then Momo looks for other apps' changes within a minute.
      await b.page.waitForFunction(() => Kyoshi.apps.pabu.personById("pp-ana").talks.length === 1, null, { timeout: 5000 });
      await b.ctx.clock.fastForward(61000);
      await b.page.waitForFunction(() => /done ✓/.test(document.querySelector('#kMount .card[data-id="card-0"]').getAttribute("aria-label")), null, { timeout: 5000 });
      eq((await cards(b))["card-0"], "Keep in touch (Call Ana and Call Mom from Pabu — done ✓)", "✓ in the other tab");
    }
  }
];
