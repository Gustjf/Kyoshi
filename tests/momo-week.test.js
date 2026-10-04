/* Kyoshi · tests/momo-week.test.js — Momo as the record of the week (roadmap Phase 8, with v4's cards of their own): this
 * week's past days show what was done on them (Momo asks from Monday: a done errand gets a card on its day) while open
 * needs wait in Tasks from today, a card holding something late is red-edged and says so on the board, in its pop-up and
 * on Today, an errand due in a month takes none of this week's room; Tasks come in a chunk per app, each week's board
 * lists only what can go on it, and "all assigned ✓" waits until Tasks are empty and every day balances; the true cost:
 * each week's asks are kept (an app's own cards together, a block by its title), the Baseline tab shows the free time
 * the baseline leaves for the apps' cards and what block it's short of, a drag covers it, and Momo no longer saves
 * itself just for starting. */
"use strict";
const { TODAY, DESKTOP, PHONE, eq, ok, has, open, switchTo, importBackup, exportBackup, addDays, lastDialog } = require("./lib");
const gen = require("./generate");
const mo = require("./momo");
const bm = require("./badgermole");

const D = n => addDays(TODAY, n);
const MONDAY = D(-2);
// The labels of a day's cards (0 = Monday), without the hours and times.
const onDay = async (tab, d) => (await mo.days(tab))[d].cards.map(c => c.label.replace(/, [\d.]+[hm]\b.*$/, ""));
// Tasks, chunk by chunk: [{ app (its name), sum (its head), tasks: [labels before " — drag"] }].
const chunks = tab => tab.page.$$eval("#kMount #taskCards .task-app", els => els.map(c => ({
  app: c.querySelector(".task-app-name").textContent.trim(), sum: c.querySelector(".task-app-sum").textContent.trim(),
  tasks: [...c.querySelectorAll(".task")].map(t => t.getAttribute("aria-label").replace(/ — drag.*$/, ""))
})));
const tick = (tab, id) => tab.page.click(`#kMount [data-act="tick"][data-id="${id}"]`);

module.exports = [
  {
    name: "momo week: past days show what was done, open needs wait from today, a late card says so, a far-off errand stays out",
    async run(t) {
      const tab = await open(t, { app: "hawky", size: DESKTOP }), p = tab.page;
      await importBackup(tab, gen.hawkyItems([
        { text: "Return library books", due: D(-2), minutes: 30 }, // overdue: late
        { text: "Buy stamps", due: D(1), minutes: 15 },            // due tomorrow
        { text: "Renew passport form", due: D(30), minutes: 60 },  // a month out: not this week's
        { text: "Mail the form", done: D(-1), minutes: 15 }        // done yesterday
      ]));
      await switchTo(tab, "momo");
      // Reading yesterday, Sleep today: the week is planned. Momo places its cards on the minute.
      await importBackup(tab, gen.momo([], [{ date: D(-1), title: "Reading", hours: 1 }, { date: D(0), title: "Sleep", hours: 8 }]));
      await tab.ctx.clock.fastForward(61000);
      eq(await onDay(tab, 1), ["Reading", "Mail the form (from Hawky — done ✓)"], "yesterday's errand, done: a card of its own on yesterday");
      eq((await mo.days(tab))[1].cards[1].done, true, "✓ on it");
      eq((await mo.tasks(tab)).tasks.map(x => [x.title, x.overdue]), [["Return library books", true], ["Buy stamps", false]], "the open ones wait in Tasks, the late one red-edged");
      const asked = await p.evaluate(([from, to]) => Kyoshi.inbox(from, to).map(n => n.title), [MONDAY, D(11)]);
      eq(asked, ["Return library books", "Buy stamps", "Mail the form"], "Momo asks from Monday; the passport form, due in a month, isn't sent");

      // Placed on today, the late one's card says so, and so does its pop-up.
      ok(await mo.placeTask(tab, "n:hawky:hk0000", [2]), "placed on today");
      const late = (await mo.days(tab))[2].cards.find(c => c.title === "Return library books");
      eq([late.label.replace(/, [\d.]+[hm]\b.*$/, ""), late.late], ["Return library books (from Hawky — late)", true], "red-edged, and it says late");
      const card = await mo.openCard(tab, late.id);
      eq(card.from.map(n => n.title), ["Return library books"], "what it holds");
      has(await p.locator("#kMount #cardFrom").innerText(), "Return library books late", "the pop-up says so");
      await mo.closeCard(tab);

      // Ticked today: ✓ on its card, no longer late.
      await switchTo(tab, "hawky");
      await tick(tab, "hk0000");
      await switchTo(tab, "momo");
      const done = (await mo.days(tab))[2].cards.find(c => c.id === late.id);
      eq([done.label.replace(/, [\d.]+[hm]\b.*$/, ""), done.late, done.done], ["Return library books (from Hawky — done ✓)", false, true], "done today: ✓, no longer late");
    }
  },
  {
    name: "momo week: on the phone, Today's row for a card holding something late says Late",
    async run(t) {
      const tab = await open(t, { app: "hawky", size: PHONE }), p = tab.page;
      await importBackup(tab, gen.hawkyItems([{ text: "Return library books", due: D(-2), minutes: 30 }]));
      await switchTo(tab, "momo");
      await importBackup(tab, gen.momo([], [{ date: D(0), title: "Sleep", hours: 8 }, { date: D(0), title: "Return library books", hours: 0.5, app: "hawky", need: "hawky:hk0000" }]));
      await p.waitForSelector("#kMount #todayView:not([hidden])");
      const row = p.locator('#kMount #todayBody [data-card="card-1"]').first();
      ok(await row.evaluate(el => el.classList.contains("late")), "red-edged");
      eq(await row.locator(".t-late").innerText(), "Late", "it says Late");
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
      // Every hour from today to Sunday has a job (Free time: today's is card-0).
      await importBackup(tab, gen.momo([], [0, 1, 2, 3, 4].map(n => ({ date: D(n), title: "Free time", hours: 24 }))));
      const now = await chunks(tab);
      eq(now.map(c => [c.app, c.tasks.map(x => x.replace(/ \(.*$/, ""))]), [["Hawky", ["Pick up dry cleaning", "Get a key cut", "Buy stamps"]], ["Badgermole", ["Push", "Pull", "Legs"]]], "a chunk per app, in the switcher's order, a task each");
      eq([now[0].sum, now[1].sum], ["3 to place · 1.75h", "3 to place · 2.5h"], "each chunk's head: how many, how long");
      eq(now[0].tasks[0], "Pick up dry cleaning (from Hawky, due Oct 2)", "each says when it's due");
      const tabs = await mo.tabs(tab), bank = await mo.bank(tab);
      eq(tabs.this.status, "6 to place", "every hour has a job, but not all assigned");
      eq(bank.msg, "Every hour has a job — but 6 more still need a place: see Tasks.", "the bank says so");
      has(await p.locator("#kMount #tasksTotal").innerText(), "6 to place", "and the Tasks head");

      await mo.view(tab, "next");
      eq((await chunks(tab)).map(c => [c.app, c.tasks.map(x => x.replace(/ \(.*$/, ""))]), [["Hawky", ["Get a key cut", "Buy stamps"]], ["Badgermole", ["Push", "Pull", "Legs"]]], "next week's own: the dry cleaning can't wait for it");
      await mo.view(tab, "this");

      // The errands placed on today: it's overbooked until its Free time gives way.
      for (const id of ["hk0000", "hk0001", "hk0002"]) ok(await mo.placeTask(tab, `n:hawky:${id}`, [2]), `${id} placed`);
      eq((await mo.days(tab))[2].over, true, "today is over");
      eq((await mo.bank(tab)).msg, "Wednesday is overbooked by 1.75h — move or trim a card to balance it.", "the bank says by how much");
      await mo.openCard(tab, "card-0");
      await p.fill("#kMount #cardHours", "22.25");
      await p.click("#kMount #cardSaveBtn");
      eq((await mo.days(tab))[2].over, false, "balanced again");

      // The program emptied in Badgermole: nothing left to place, so the week is all assigned.
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
      // Four errands (2h of cards of Hawky's own), and its checkup put on a weekly schedule: an hour's "Meeting" block.
      await importBackup(tab, gen.hawkyItems([1, 2, 3, 4].map(n => ({ text: `Errand ${n}`, due: D(1), minutes: 30 })), gen.meetings({ checkup: { every: "week", minutes: 60 } })));
      await switchTo(tab, "momo");
      await importBackup(tab, gen.momoWorld({ baseline: [{ title: "Meeting", hours: 0.5, days: [5] }] }));
      const asks = await p.evaluate(() => Kyoshi.apps.momo.S.data.asks);
      eq([Object.keys(asks), asks[MONDAY].by], [[MONDAY], { "hawky|": 120, "hawky|Meeting": 60 }], "this week's asks: Hawky's own cards, and its block by title");
      ok(asks[MONDAY].u > 0, "stamped, for sync");

      await mo.view(tab, "base");
      has(await p.locator("#kMount #taskCards .cost-apps").innerText(), "Your apps ask about 2h a week — Hawky 2h. The baseline leaves 167.5h free ✓", "the apps' own cards against the free time the baseline leaves");
      eq((await chunks(tab)).map(c => [c.app, c.sum, c.tasks]), [["Hawky", "about 1h a week", ["Meeting: Hawky asks about 1h a week, your baseline gives 30m"]]], "the baseline gives its meeting 30m of the hour a week it asks");
      has(await p.locator("#kMount #taskCards .task.cost").innerText(), "+30m", "the gap, to drag in");
      has((await mo.bank(tab)).msg, "the apps ask for more than your baseline gives Meeting", "the bank says so");
      has(await p.locator("#kMount #tasksTotal").innerText(), "True cost", "the head says what it is");
      ok(await mo.dragTask(tab, "c:meeting", 1), "dragged onto Tuesday");
      eq(await p.evaluate(() => Kyoshi.apps.momo.S.data.baseline.cards.filter(c => c.title === "Meeting").map(c => [c.day, c.hours]).sort()), [[1, 0.5], [5, 0.5]], "a 30m Meeting card on Tuesday");
      eq((await chunks(tab)).map(c => [c.app, c.tasks.length]), [["Hawky", 0]], "covered: no task");
      has(await p.locator("#kMount #taskCards .cost-ok").innerText(), "Meeting · 1h ✓", "a quiet ✓");

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
      eq(await p.evaluate(k => Kyoshi.apps.momo.S.data.asks[k].by["hawky|"], MONDAY), 135, "the new errand's 15 minutes are in this week's asks");
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
