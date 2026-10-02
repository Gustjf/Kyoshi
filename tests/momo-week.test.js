/* Kyoshi · tests/momo-week.test.js — Momo as the record of the week (roadmap Phase 8): this week's past days show what was
 * done on them (Momo asks from Monday) while open needs start today, a card holding something late is red-edged and says
 * so on the board, in its pop-up and on Today, an errand due in a month takes none of this week's room; Tasks come in a
 * chunk per app, each week's board lists only what can go on it, and "all assigned ✓" waits until Tasks are empty; the
 * true cost: each week's asks are kept, the Baseline tab shows what the baseline is short of, a drag covers it, and Momo
 * no longer saves itself just for starting. */
"use strict";
const { TODAY, DESKTOP, PHONE, eq, ok, has, open, switchTo, importBackup, exportBackup, addDays, lastDialog } = require("./lib");
const gen = require("./generate");
const mo = require("./momo");
const bm = require("./badgermole");

const D = n => addDays(TODAY, n);
const MONDAY = D(-2);
// Momo's cards by id (card-0 …) and their labels, without the hours and times.
const cards = tab => tab.page.$$eval("#kMount #board .card[data-id^='card-']", els => Object.fromEntries(els.map(e => [e.dataset.id, (e.querySelector(":scope > .card-own") || e).getAttribute("aria-label").replace(/, [\d.]+[hm]\b.*$/, "")])));
// Tasks, chunk by chunk: [{ app (its name), sum (its head), tasks: [labels before " — drag"] }].
const chunks = tab => tab.page.$$eval("#kMount #taskCards .task-app", els => els.map(c => ({
  app: c.querySelector(".task-app-name").textContent.trim(), sum: c.querySelector(".task-app-sum").textContent.trim(),
  tasks: [...c.querySelectorAll(".task")].map(t => t.getAttribute("aria-label").replace(/ — drag.*$/, ""))
})));
const tick = (tab, id) => tab.page.click(`#kMount [data-act="tick"][data-id="${id}"]`);

module.exports = [
  {
    name: "momo week: past days show what was done, open needs start today, a late card says so, a far-off errand stays out",
    async run(t) {
      const tab = await open(t, { app: "hawky", size: DESKTOP }), p = tab.page;
      await importBackup(tab, gen.hawkyItems([
        { text: "Return library books", due: D(-2), minutes: 30 }, // overdue: today's card, late
        { text: "Buy stamps", due: D(1), minutes: 15 },            // due tomorrow
        { text: "Renew passport form", due: D(30), minutes: 60 },  // a month out: not this week's
        { text: "Mail the form", done: D(-1), minutes: 15 }        // done yesterday
      ]));
      await switchTo(tab, "momo");
      // Errands yesterday (card-0), then Sleep and Errands today (card-1, card-2).
      await importBackup(tab, gen.momo([], [{ date: D(-1), title: "Errands", hours: 1 }, { date: D(0), title: "Sleep", hours: 8 }, { date: D(0), title: "Errands", hours: 1 }]));
      eq(await cards(tab), {
        "card-0": "Errands (Mail the form from Hawky — done ✓)", "card-1": "Sleep", "card-2": "Errands (Return library books and Buy stamps from Hawky — late)"
      }, "yesterday's errand done on yesterday's card; today's card holds the late one");
      const days = await mo.days(tab);
      eq([days[1].cards[0].done, days[2].cards[1].late, days[2].cards[0].late], [true, true, false], "✓ on Tuesday's card, today's errands card red-edged");
      eq((await mo.tasks(tab)).tasks, [], "nothing left over");
      const asked = await p.evaluate(([from, to]) => Kyoshi.inbox(from, to).map(n => n.title), [MONDAY, D(11)]);
      eq(asked, ["Return library books", "Buy stamps", "Mail the form"], "Momo asks from Monday; the passport form, due in a month, isn't sent");

      // The pop-up says which one is late.
      const card = await mo.openCard(tab, "card-2");
      eq(card.from.map(n => n.title), ["Return library books", "Buy stamps"], "what fills it");
      has(await p.locator("#kMount #cardFrom").innerText(), "Return library books late", "the late one says so");
      await mo.closeCard(tab);

      // Ticked today: off today's card, ✓ on it instead; the card isn't late any more.
      await switchTo(tab, "hawky");
      await tick(tab, "hk0000");
      await switchTo(tab, "momo");
      eq((await cards(tab))["card-2"], "Errands (Return library books and Buy stamps from Hawky)", "done today: no longer late, not all done");
    }
  },
  {
    name: "momo week: on the phone, Today's row for a card holding something late says Late",
    async run(t) {
      const tab = await open(t, { app: "hawky", size: PHONE }), p = tab.page;
      await importBackup(tab, gen.hawkyItems([{ text: "Return library books", due: D(-2), minutes: 30 }]));
      await switchTo(tab, "momo");
      await importBackup(tab, gen.momo([], [{ date: D(0), title: "Sleep", hours: 8 }, { date: D(0), title: "Errands", hours: 1 }]));
      await p.waitForSelector("#kMount #todayView:not([hidden])");
      const row = p.locator('#kMount #todayBody [data-card="card-1"]').first();
      ok(await row.evaluate(el => el.classList.contains("late")), "red-edged");
      has(await row.innerText(), "Late · Return library books", "it says Late");
      await row.click();
      await p.waitForSelector("#kMount #detailOverlay.open");
      has(await p.locator("#kMount #detailFrom").innerText(), "Return library books late", "and its pop-up");
    }
  },
  {
    name: "momo week: Tasks in a chunk per app, each week only what can go on it, all assigned once they're placed",
    async run(t) {
      const tab = await open(t, { app: "hawky", size: DESKTOP }), p = tab.page;
      await importBackup(tab, gen.hawkyItems([
        { text: "Pick up dry cleaning", due: D(2), minutes: 30 }, // by Friday: this week only
        { text: "Buy stamps", minutes: 15 },                      // no date: either week
        { text: "Get a key cut", due: D(7), minutes: 60 }          // by next Wednesday: either week
      ]));
      await switchTo(tab, "badgermole");
      await importBackup(tab, gen.history({ weeks: 1 }));
      await switchTo(tab, "momo");
      // Every hour from today to Sunday has a job (Free time), and no Errands or Workout card anywhere.
      await importBackup(tab, gen.momo([], [0, 1, 2, 3, 4].map(n => ({ date: D(n), title: "Free time", hours: 24 }))));
      const now = await chunks(tab);
      eq(now.map(c => [c.app, c.tasks.map(x => x.replace(/ \(.*$/, ""))]), [["Hawky", ["Errands"]], ["Badgermole", ["Workout · Push", "Workout · Pull", "Workout · Legs"]]], "a chunk per app, in the switcher's order");
      eq(now[0].sum, "1 to place · 1.75h", "each chunk's head: how many, how long");
      has(now[1].sum, "3 to place · ", "Badgermole's three");
      eq(now[0].tasks[0], "Errands (Pick up dry cleaning, Get a key cut and Buy stamps from Hawky, due Oct 2)", "all three errands can go this week");
      const tabs = await mo.tabs(tab), bank = await mo.bank(tab);
      eq(tabs.this.status, "4 to place", "every hour has a job, but not all assigned");
      eq(bank.msg, "Every hour has a job — but 4 more still need a place: see Tasks.", "the bank says so");
      has(await p.locator("#kMount #tasksTotal").innerText(), "4 to place", "and the Tasks head");

      await mo.view(tab, "next");
      eq((await chunks(tab)).map(c => [c.app, c.tasks.map(x => x.replace(/ \(.*$/, ""))]), [["Hawky", ["Errands"]], ["Badgermole", ["Workout · Push", "Workout · Pull", "Workout · Legs"]]], "next week's own");
      eq((await chunks(tab))[0].tasks[0], "Errands (Get a key cut and Buy stamps from Hawky, due Oct 7)", "the dry cleaning can't wait for next week");
      await mo.view(tab, "this");

      // Done in Hawky, the program emptied in Badgermole: nothing left to place, so the week is all assigned.
      await switchTo(tab, "hawky");
      for (const id of ["hk0000", "hk0001", "hk0002"]) await tick(tab, id);
      await switchTo(tab, "badgermole");
      await bm.openFold(tab, "program");
      for (let i = 0; i < 3; i++) await p.click('#programList [data-act="prog-remove"][data-i="0"]');
      await switchTo(tab, "momo");
      eq((await mo.tasks(tab)).tasks, [], "Tasks are empty");
      eq([(await mo.tabs(tab)).this.status, (await mo.bank(tab)).msg], ["all assigned ✓", "Every hour has a job ✓"], "all assigned ✓");
    }
  },
  {
    name: "momo week: the true cost — this week's asks are kept, the baseline's Tasks show what it's short of, a drag covers it",
    async run(t) {
      const tab = await open(t, { app: "hawky", size: DESKTOP }), p = tab.page;
      await importBackup(tab, gen.hawkyItems([1, 2, 3, 4].map(n => ({ text: `Errand ${n}`, due: D(1), minutes: 30 }))));
      await switchTo(tab, "momo");
      await importBackup(tab, gen.momoWorld({ baseline: [{ title: "Errands", hours: 1, days: [5] }] }));
      const asks = await p.evaluate(() => Kyoshi.apps.momo.S.data.asks);
      eq([Object.keys(asks), asks[MONDAY].by], [[MONDAY], { "hawky|Errands": 120 }], "this week's asks, by app and block title");
      ok(asks[MONDAY].u > 0, "stamped, for sync");

      await mo.view(tab, "base");
      eq((await chunks(tab)).map(c => [c.app, c.sum, c.tasks]), [["Hawky", "about 2h a week", ["Errands: Hawky asks about 2h a week, your baseline gives 1h"]]], "the baseline gives errands 1h of the 2h a week they ask");
      has(await p.locator("#kMount #taskCards .task.cost").innerText(), "+1h", "the gap, to drag in");
      has((await mo.bank(tab)).msg, "the apps ask for more than your baseline gives Errands", "the bank says so");
      has(await p.locator("#kMount #tasksTotal").innerText(), "True cost", "the head says what it is");
      ok(await mo.dragTask(tab, "c:errands", 1), "dragged onto Tuesday");
      eq(await p.evaluate(() => Kyoshi.apps.momo.S.data.baseline.cards.filter(c => c.title === "Errands").map(c => [c.day, c.hours]).sort()), [[1, 1], [5, 1]], "a 1h Errands card on Tuesday");
      eq((await chunks(tab)).map(c => [c.app, c.tasks.length]), [["Hawky", 0]], "covered: no task");
      has(await p.locator("#kMount #taskCards .cost-ok").innerText(), "Errands · 2h ✓", "a quiet ✓");

      // Backups carry the asks.
      const back = await exportBackup(tab);
      eq(Object.keys(back.asks), [MONDAY], "Export JSON has them");

      // Momo's own bookkeeping isn't a change of yours: an errand added in Hawky changes this week's asks, kept quietly, and
      // importing the backup made before still says nothing here has changed since.
      await tab.ctx.clock.fastForward(3600000);
      await switchTo(tab, "hawky");
      await p.fill("#kMount #addText", "Errand 5");
      await p.press("#kMount #addText", "Enter");
      await switchTo(tab, "momo");
      eq(await p.evaluate(k => Kyoshi.apps.momo.S.data.asks[k].by["hawky|Errands"], MONDAY), 135, "the new errand's 15 minutes are in this week's asks");
      await importBackup(tab, back);
      has(lastDialog(tab), "Nothing here has changed since", "the import doesn't count the asks as a change of yours");
    }
  },
  {
    name: "momo week: starting Momo saves nothing when nothing changed (other apps' event colours are kept through the load)",
    async run(t) {
      const tab = await open(t, { app: "pabu", size: DESKTOP }), p = tab.page;
      await importBackup(tab, gen.pabu()); // Kai's birthday tomorrow: an event on Momo's board, with its own colour
      await switchTo(tab, "momo");
      await importBackup(tab, gen.momo([], [{ date: D(0), title: "Keep in touch", hours: 1 }]));
      await tab.ctx.clock.fastForward(61000);
      const state = () => p.evaluate(() => ({ clock: JSON.stringify(Kyoshi.apps.momo._sync.meta.clock), data: Kyoshi.apps.momo.store.get("data") }));
      const before = await state();
      ok(/kai's birthday/.test(before.data), "the birthday's colour is kept");
      for (let i = 0; i < 2; i++) {
        await p.reload();
        await p.waitForFunction(() => window.Kyoshi && Kyoshi.active() && Kyoshi.active().started && Kyoshi.active().id === "momo");
        await tab.ctx.clock.fastForward(61000);
        eq(await state(), before, `reload ${i + 1}: no save, the colours as they were`);
      }
    }
  }
];
