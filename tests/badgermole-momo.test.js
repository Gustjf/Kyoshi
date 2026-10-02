/* Kyoshi · tests/badgermole-momo.test.js — Badgermole and Momo together, as the user sees them on the board: Workout
 * cards fill in program order this week and next (the rotation running on), a workout no card has room for waits in
 * Tasks ("Workout · Push"), a logged session shows ✓ on its day's card while the other cards keep their routines,
 * "Open in Badgermole" (a done card: its day; a planned one: Next up), an empty program asks for nothing; and two tabs
 * of one browser (a finished session reaches the other's Momo; one in progress isn't counted, and resumes on reload). */
"use strict";
const { TODAY, DESKTOP, eq, ok, has, lacks, open, switchTo, importBackup, addDays } = require("./lib");
const gen = require("./generate");
const bm = require("./badgermole");

// This week: Workout cards Wed (today), Fri and Sun; next week Mon, Wed and Fri (card-0 … card-5).
const CARDS = [0, 2, 4, 5, 7, 9].map(n => addDays(TODAY, n));
// Momo's board: each Workout card's label (what fills it), and Tasks' labels.
const cards = tab => tab.page.$$eval("#kMount .card[data-id^='card-']", els => Object.fromEntries(els.map(e => [e.dataset.id, e.getAttribute("aria-label").replace(/, 1h.*$/, "")])));
const tasks = tab => tab.page.$$eval("#taskCards .task", els => els.map(e => e.getAttribute("aria-label").replace(/ \(.*$/, "")).filter(x => x.startsWith("Workout")));
const week = (tab, which) => tab.page.click(`#kMount [data-view="${which}"]`);

// Badgermole with last week's Push, Pull and Legs (so Push is next), and Momo with the Workout cards.
async function both(t, size = DESKTOP) {
  const tab = await open(t, { size });
  await importBackup(tab, gen.history({ weeks: 1 }));
  await switchTo(tab, "momo");
  await importBackup(tab, gen.momo(CARDS));
  return tab;
}

module.exports = [
  {
    name: "momo: Workout cards fill in program order, extras go to Tasks, a logged one shows ✓, the rotation runs on",
    async run(t) {
      const tab = await both(t), p = tab.page;
      eq(await cards(tab), { "card-0": "Workout (Push from Badgermole)", "card-1": "Workout (Pull from Badgermole)", "card-2": "Workout (Legs from Badgermole)" }, "this week, in program order");
      await week(tab, "next");
      eq(await cards(tab), { "card-3": "Workout (Push from Badgermole)", "card-4": "Workout (Pull from Badgermole)", "card-5": "Workout (Legs from Badgermole)" }, "next week carries on");
      await week(tab, "this");

      // Four a week: the fourth has no card, so it waits in Tasks (this week's Push, and next week's, the rotation on: Pull).
      await switchTo(tab, "badgermole");
      await bm.openFold(tab, "settings");
      await p.fill("#targetInput", "4");
      await p.locator("#targetInput").blur();
      await switchTo(tab, "momo");
      eq(await tasks(tab), ["Workout · Push", "Workout · Pull"], "the fourth workouts are tasks");

      // Log Push today: ✓ on today's card; Pull and Legs keep their cards; Push still waits in Tasks.
      await switchTo(tab, "badgermole");
      await bm.doSession(tab, "Push");
      await switchTo(tab, "momo");
      eq(await cards(tab), { "card-0": "Workout (Push from Badgermole — done ✓)", "card-1": "Workout (Pull from Badgermole)", "card-2": "Workout (Legs from Badgermole)" }, "after logging Push");
      eq(await tasks(tab), ["Workout · Push", "Workout · Pull"], "the fourths still wait");

      // Back to three a week: no task; next week goes on from where this one ends.
      await switchTo(tab, "badgermole");
      await p.fill("#targetInput", "3");
      await p.locator("#targetInput").blur();
      await switchTo(tab, "momo");
      eq(await tasks(tab), [], "three a week: nothing left over");
      await week(tab, "next");
      eq(Object.values(await cards(tab)), ["Workout (Push from Badgermole)", "Workout (Pull from Badgermole)", "Workout (Legs from Badgermole)"], "next week, the rotation runs on");
      await week(tab, "this");

      // "Open in Badgermole": a planned card shows Next up (flashing); a done one opens its day.
      await p.click('#kMount .card[data-id="card-1"]');
      await p.click('#cardOverlay a[data-app="badgermole"]');
      await p.waitForFunction(() => Kyoshi.active().id === "badgermole");
      ok(await p.locator("#nextUp").evaluate(el => el.classList.contains("flash")), "Next up flashes");
      has(await bm.nextUp(tab), "Pull", "Next up is the planned one");
      await switchTo(tab, "momo");
      await p.click('#kMount .card[data-id="card-0"]');
      await p.click('#cardOverlay a[data-app="badgermole"]');
      await p.waitForSelector("#dayOverlay.open");
      ok(await p.locator("#daySessions .day-session.focus").count() === 1, "the day pop-up, on the session");
      // Deleting it there: Momo plans Push again on today's card.
      await p.click('#daySessions .day-session.focus [data-day="delete"]');
      await switchTo(tab, "momo");
      eq((await cards(tab))["card-0"], "Workout (Push from Badgermole)", "Momo follows a deleted session");
      await switchTo(tab, "badgermole");
      await bm.doSession(tab, "Push");

      // An empty program: nothing planned, the done one stays.
      await bm.openFold(tab, "program");
      for (let i = 0; i < 3; i++) await p.click('#programList [data-act="prog-remove"][data-i="0"]');
      await switchTo(tab, "momo");
      eq(await cards(tab), { "card-0": "Workout (Push from Badgermole — done ✓)", "card-1": "Workout", "card-2": "Workout" }, "no program: only what's done");
      await week(tab, "next");
      eq(Object.values(await cards(tab)), ["Workout", "Workout", "Workout"], "nothing asked for next week");
    }
  },
  {
    name: "momo: two tabs — a finished session reaches the other tab's Momo; one in progress isn't counted and resumes on reload",
    async run(t) {
      const a = await both(t), b = await open(t, { ctx: a.ctx, app: "momo", size: DESKTOP });
      await switchTo(a, "badgermole");
      await bm.doSession(a, "Push");
      // The save reaches the other tab (its Badgermole reloads), then Momo looks for other apps' changes within a minute.
      await b.page.waitForFunction(() => Kyoshi.apps.badgermole.sessions().length === 4, null, { timeout: 5000 });
      await b.ctx.clock.fastForward(61000);
      await b.page.waitForFunction(() => /done ✓/.test(document.querySelector('#kMount .card[data-id="card-0"]').getAttribute("aria-label")), null, { timeout: 5000 });
      await switchTo(b, "badgermole");
      eq(Object.keys(await bm.filledDays(b)), [addDays(TODAY, -9), addDays(TODAY, -7), addDays(TODAY, -5), TODAY], "the other tab's calendar");
      eq((await bm.stats(b)).week, "1 of 3", "and its week");

      await bm.start(a, "Pull");
      await a.page.click("#logBtn");
      await b.page.waitForTimeout(300);
      eq((await bm.stats(b)).week, "1 of 3", "a session in progress isn't counted");
      await switchTo(b, "momo");
      lacks((await cards(b))["card-1"], "done", "nor done in Momo");
      await a.page.reload();
      await a.page.waitForSelector("#sessionView:not([hidden])");
      eq((await bm.screen(a)).logged.length, 1, "a reload resumes it");
    }
  }
];
