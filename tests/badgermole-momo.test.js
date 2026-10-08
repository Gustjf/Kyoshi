/* Kyoshi · tests/badgermole-momo.test.js — Badgermole and Momo together, as the user sees them on the board: each of
 * the week's workouts waits in Momo's Tasks, a task of its own titled by its routine, in program order this week and
 * next (the rotation running on); dragged onto a day it's a card of its own, a logged session shows ✓ on the card of
 * the workout it stands for while the others wait, "Open in Badgermole" (a done card: its day; a planned one: Next up),
 * a deleted session plans its workout on that card again, an empty program asks for nothing; and two tabs of one
 * browser (a finished session reaches the other's Momo, on a card of its own on its day; one in progress isn't counted,
 * and resumes on reload). */
"use strict";
const { TODAY, DESKTOP, eq, ok, has, lacks, open, switchTo, importBackup, addDays } = require("./lib");
const gen = require("./generate");
const bm = require("./badgermole");
const momo = require("./momo");

const MONDAY = addDays(TODAY, -2);
// Badgermole's tasks on the board on screen (its routines' names), and the labels of a day's cards (0 = Monday), hours on cut off.
const workouts = async tab => (await momo.tasks(tab)).tasks.filter(x => x.key.startsWith("n:badgermole:")).map(x => x.title);
const onDay = async (tab, d) => (await momo.days(tab))[d].cards.map(c => c.label.replace(/, [\d.]+[hm]\b.*$/, ""));
// A Badgermole card's editor, then its "Open in Badgermole".
async function openFrom(tab, day) {
  const id = (await momo.days(tab))[day].cards[0].id;
  await momo.openCard(tab, id);
  await tab.page.click('#kMount #cardFrom a[data-app="badgermole"]');
  await tab.page.waitForFunction(() => Kyoshi.active().id === "badgermole");
}
// The weekly target, set in Badgermole's Settings; then back to Momo.
async function target(tab, n) {
  await switchTo(tab, "badgermole");
  await bm.openFold(tab, "settings");
  await tab.page.fill("#targetInput", String(n));
  await tab.page.locator("#targetInput").blur();
  await switchTo(tab, "momo");
}

// Badgermole with last week's Push, Pull and Legs (so Push is next), and Momo with a card of the user's this week and
// next (Thursday's and Monday's Reading: the weeks are planned).
async function both(t, size = DESKTOP) {
  const tab = await open(t, { size });
  await importBackup(tab, gen.history({ weeks: 1 }));
  await switchTo(tab, "momo");
  await importBackup(tab, gen.momo([], [{ date: addDays(TODAY, 1), title: "Reading", hours: 1 }, { date: addDays(TODAY, 5), title: "Reading", hours: 1 }]));
  return tab;
}

module.exports = [
  {
    name: "momo: each workout waits in Tasks in program order, the rotation running on; on a day it's a card, a logged one shows ✓",
    async run(t) {
      const tab = await both(t), p = tab.page;
      eq(await workouts(tab), ["Push", "Pull", "Legs"], "this week, in program order");
      await momo.view(tab, "next");
      eq(await workouts(tab), ["Push", "Pull", "Legs"], "next week carries on");
      await momo.view(tab, "this");

      // Four a week: Push again this week; next week goes on from Pull.
      await target(tab, 4);
      eq(await workouts(tab), ["Push", "Pull", "Legs", "Push"], "four this week");
      await momo.view(tab, "next");
      eq(await workouts(tab), ["Pull", "Legs", "Push", "Pull"], "and next week's, the rotation running on");
      await momo.view(tab, "this");

      // Push dragged onto today, Pull onto Friday: their cards; the others wait.
      ok(await momo.dragTask(tab, `n:badgermole:next:${MONDAY}:1`, 2), "Push dragged onto today");
      ok(await momo.dragTask(tab, `n:badgermole:next:${MONDAY}:2`, 4), "Pull onto Friday");
      eq(await onDay(tab, 2), ["Push (from Badgermole)"], "today's card");
      eq(await onDay(tab, 4), ["Pull (from Badgermole)"], "Friday's");
      eq(await workouts(tab), ["Legs", "Push"], "the others wait in Tasks");

      // Push logged today: ✓ on its card; Pull keeps Friday's; Legs and Push still wait.
      await switchTo(tab, "badgermole");
      await bm.doSession(tab, "Push");
      await switchTo(tab, "momo");
      eq(await onDay(tab, 2), ["Push (from Badgermole — done ✓)"], "after logging Push");
      eq(await onDay(tab, 4), ["Pull (from Badgermole)"], "Pull keeps its card");
      eq(await workouts(tab), ["Legs", "Push"], "the rest still wait");

      // Back to three a week: one task left; next week goes on from where this one ends.
      await target(tab, 3);
      eq(await workouts(tab), ["Legs"], "three a week: one left to place");
      await momo.view(tab, "next");
      eq(await workouts(tab), ["Push", "Pull", "Legs"], "next week, the rotation runs on");
      await momo.view(tab, "this");

      // "Open in Badgermole": a planned card shows Next up (flashing); a done one opens its day.
      await openFrom(tab, 4);
      ok(await p.locator("#nextUp").evaluate(el => el.classList.contains("flash")), "Next up flashes");
      has(await bm.nextUp(tab), "Pull", "Next up is the planned one");
      await switchTo(tab, "momo");
      await openFrom(tab, 2);
      await p.waitForSelector("#dayOverlay.open");
      ok(await p.locator("#daySessions .day-session.focus").count() === 1, "the day pop-up, on the session");
      // Deleting it there: Momo plans Push on today's card again.
      await p.click('#daySessions .day-session.focus [data-day="delete"]');
      await switchTo(tab, "momo");
      eq(await onDay(tab, 2), ["Push (from Badgermole)"], "Momo follows a deleted session");
      await switchTo(tab, "badgermole");
      await bm.doSession(tab, "Push");

      // An empty program: nothing planned (Friday's card holds nothing now), the done one stays.
      await bm.openFold(tab, "program");
      for (let i = 0; i < 3; i++) await p.click('#programList [data-act="prog-remove"][data-i="0"]');
      await switchTo(tab, "momo");
      eq(await onDay(tab, 2), ["Push (from Badgermole — done ✓)"], "no program: only what's done");
      eq(await onDay(tab, 4), ["Pull"], "a card you placed stays, holding nothing");
      eq(await workouts(tab), [], "nothing asked for this week");
      await momo.view(tab, "next");
      eq(await workouts(tab), [], "nor next week");
    }
  },
  {
    name: "momo: two tabs — a finished session reaches the other tab's Momo; one in progress isn't counted and resumes on reload",
    async run(t) {
      const a = await both(t), b = await open(t, { ctx: a.ctx, app: "momo", size: DESKTOP });
      await switchTo(a, "badgermole");
      await bm.doSession(a, "Push");
      // The save reaches the other tab (its Badgermole reloads), then Momo looks for other apps' changes within a minute:
      // a card of its own on today, done.
      await b.page.waitForFunction(() => Kyoshi.apps.badgermole.sessions().length === 4, null, { timeout: 5000 });
      await b.ctx.clock.fastForward(61000);
      await b.page.waitForFunction(() => [...document.querySelectorAll('#kMount #board .col[data-day="2"] .card')].some(c => /^Push \(from Badgermole — done ✓\)/.test(c.getAttribute("aria-label"))), null, { timeout: 5000 });
      eq(await workouts(b), ["Pull", "Legs"], "the other two still wait");
      await switchTo(b, "badgermole");
      eq(Object.keys(await bm.filledDays(b)), [addDays(TODAY, -9), addDays(TODAY, -7), addDays(TODAY, -5), TODAY], "the other tab's calendar");
      eq((await bm.stats(b)).week, "1 of 3", "and its week");

      await bm.start(a, "Pull");
      await a.page.click("#logBtn");
      await b.page.waitForFunction(() => Kyoshi.apps.badgermole.S.live && Kyoshi.apps.badgermole.S.live.sets.length === 1);
      eq((await bm.stats(b)).week, "1 of 3", "a session in progress isn't counted");
      await switchTo(b, "momo");
      eq(await workouts(b), ["Pull", "Legs"], "nor done in Momo: Pull still waits");
      lacks((await onDay(b, 2)).join(" "), "Pull", "and has no card");
      await a.page.reload();
      await a.page.waitForSelector("#sessionView:not([hidden])");
      eq((await bm.screen(a)).logged.length, 1, "a reload resumes it");
    }
  }
];
