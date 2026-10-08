/* Kyoshi · tests/momo-slots.test.js — Momo's side of the apps' routines (v4 Phase 7), with a stand-in routine and
 * inbox for Turtleduck (set in the page): the baseline gets a card per slot, pinned at its time with your cards left
 * where they were (one running into it is flagged), following the routine as it changes; cards set in their app
 * (fixed) can't be dragged, resized, pinned, Alt+clicked away, cut or deleted (their pop-up is read-only, its colour
 * the app's), a copy of one is yours; Clear keeps them, Save as baseline keeps one per slot; a fixed need gets a pinned
 * card of its own in any open week (one not planned yet too) and never goes to Tasks, and once the baseline is loaded
 * it fills its slot's card, which takes its title, length and time (an exception) and goes back to its slot's when
 * the need goes; a card going Inside a title goes inside your card of it, never a slot's (one already there goes back
 * on its own); slot and fixed survive Export and Import, and a backup of nothing but Momo's own cards has nothing to
 * import. */
"use strict";
const { DESKTOP, eq, ok, has, open, importBackup, exportBackup, lastDialog, at, TODAY } = require("./lib");
const gen = require("./generate");
const mo = require("./momo");

// Turtleduck's routine and needs, stood in for: window.__routine and window.__needs, read afresh on every call.
async function standIn(tab, routine, needs = []) {
  await tab.page.evaluate(([r, n]) => {
    window.__routine = r;
    window.__needs = n;
    const T = Kyoshi.apps.turtleduck;
    T.routine = () => JSON.parse(JSON.stringify(window.__routine));
    T.inbox = (from, to) => JSON.parse(JSON.stringify(window.__needs)).filter(x => !x.date || (x.date >= from && x.date <= to));
  }, [routine, needs]);
}
// Every app's minute tick (Momo places, follows and takes back), then the board as drawn.
const tick = tab => tab.page.evaluate(() => Kyoshi.tick());
const slot = (meal, day, time, minutes) => ({ id: `${meal}:${day}`, title: meal[0].toUpperCase() + meal.slice(1), day, time, minutes });
const titles = d => d.cards.map(c => c.title);

module.exports = [
  {
    name: "momo slots: the routine's slots go into the baseline at their times, yours stay put; set in their app there; Clear and Save as baseline keep one per slot",
    async run(t) {
      const tab = await open(t, { app: "momo", size: DESKTOP }), p = tab.page;
      await importBackup(tab, gen.momoWorld({ baseline: [{ title: "Sleep", hours: 8, days: [0, 1, 2, 3, 4, 5, 6] }, { title: "Work", hours: 8, days: [0, 1, 2, 3, 4] }, { title: "Gym", hours: 3, days: [0] }] }));
      await standIn(tab, [slot("dinner", 0, "18:00", 45), slot("breakfast", 1, "07:30", 20), { id: "groceries:6", title: "Groceries", day: 6, time: "08:00", minutes: 45 }]);
      await tick(tab);
      await mo.view(tab, "base");
      let days = await mo.days(tab);
      eq([titles(days[0]), titles(days[1]), titles(days[6])], [["Sleep", "Work", "Gym", "Dinner"], ["Sleep", "Breakfast", "Work"], ["Sleep", "Groceries"]], "each slot at its time among your cards");
      const dinner = days[0].cards[3];
      eq([dinner.hours, dinner.label], [0.75, "Dinner, 45m, pinned at 1800 — the cards above run 1h into it, set in Turtleduck"], "pinned, as long as the slot, Gym running into it flagged");
      eq(days[1].cards[1].label, "Breakfast, 30m, pinned at 0730 — the cards above run 30m into it, set in Turtleduck", "Sleep runs into breakfast");
      eq(days[1].cards[2].label, "Work, 8h, from 0800", "Work still starts at 8");
      eq((await mo.bank(tab)).msg, "The cards on Mon, Tue don't fit around their pinned times — move some into free time or trim them.", "the bank says so, for you to arrange once");
      eq((await mo.baselineCards(tab)).filter(c => c.slot).map(c => [c.slot, c.pin, c.fixed, c.auto, c.app]),
        [["turtleduck:dinner:0", 18, true, true, "turtleduck"], ["turtleduck:breakfast:1", 7.5, true, true, "turtleduck"], ["turtleduck:groceries:6", 8, true, true, "turtleduck"]], "stored as slot cards");

      // Set in Turtleduck: no grip, a pin that's only a sign; it can't be dragged, Alt+clicked away or cut.
      eq(await mo.cardLook(tab, dinner.id), { set: true, grip: false, pin: false, sign: true }, "how it looks");
      eq(await mo.tryDrag(tab, dinner.id, 2), false, "a drag leaves it where it is");
      await mo.altClick(tab, dinner.id);
      ok((await mo.baselineCards(tab)).some(c => c.id === dinner.id), "Alt+click leaves it be");
      await mo.shortcut(tab, "x", `#kMount #board .card[data-id="${dinner.id}"]`);
      eq(await p.evaluate(() => Kyoshi.apps.momo.S.clip), null, "Ctrl+X: nothing cut");
      await mo.shortcut(tab, "c", `#kMount #board .card[data-id="${dinner.id}"]`);
      await mo.shortcut(tab, "v", '#kMount #board .col[data-day="2"] .col-body > .free.end');
      days = await mo.days(tab);
      const copy = days[2].cards.find(c => c.title === "Dinner");
      ok(!!copy, "Ctrl+C, Ctrl+V: a copy on Wednesday");
      eq(await mo.cardLook(tab, copy.id), { set: false, grip: true, pin: true, sign: false }, "the copy is yours");
      eq((await mo.baselineCards(tab)).find(c => c.id === copy.id), { id: copy.id, title: "Dinner", hours: 0.75, day: 2, pin: 18, slot: null, fixed: false, auto: false, app: "turtleduck" }, "its app's colour, no slot");
      await mo.altClick(tab, copy.id);
      ok(!(await mo.baselineCards(tab)).some(c => c.id === copy.id), "and Alt+click deletes it");

      // A card of yours titled like a slot stays a card of its own.
      await mo.newCard(tab, { title: "Dinner", hours: 1, days: [0] });
      eq(titles((await mo.days(tab))[0]), ["Sleep", "Work", "Gym", "Dinner", "Dinner"], "your Dinner beside the slot, not folded in");
      eq(await p.evaluate(() => { const A = Kyoshi.apps.momo; return A.sameKind({ title: "Dinner", slot: "turtleduck:dinner:0" }, { title: "dinner" }); }), false, "never the same kind");
      await mo.altClick(tab, (await mo.days(tab))[0].cards[4].id);

      // Its pop-up: read-only, Close, "Set in Turtleduck" at its slot; the colour (the app's) changes at once.
      const ed = await mo.openCard(tab, dinner.id);
      eq([ed.title, ed.readonly, ed.close, ed.canDelete, ed.change, ed.changeId], ["Dinner", true, "Close", false, "Set in Turtleduck", "dinner:0"], "read-only, where it's set");
      await p.click('#kMount #cardColors .swatch[data-color="teal"]');
      eq(await p.evaluate(() => Kyoshi.apps.momo.S.data.colors["a:turtleduck"].c), "teal", "picked: Turtleduck's cards are teal at once");
      ok(await p.locator("#kMount #cardOverlay.open").count(), "the pop-up stays open");
      await p.keyboard.press("Escape");
      eq([await p.locator("#kMount #cardOverlay.open").count(), tab.dialogs.length], [0, 0], "Esc closes it without asking");

      // Loaded into next week, the slots come along; that week saved as the baseline keeps one card per slot.
      await mo.view(tab, "next");
      await mo.loadBaseline(tab);
      const next = await p.evaluate(() => Kyoshi.apps.momo.nextWeekKey());
      eq((await mo.weekCards(tab, next)).filter(c => c.slot).map(c => [c.slot, c.fixed, c.auto]), [["turtleduck:dinner:0", true, true], ["turtleduck:breakfast:1", true, true], ["turtleduck:groceries:6", true, true]], "copies of the slots");
      await mo.saveAsBaseline(tab);
      has(lastDialog(tab), "Replace your baseline (13 cards) with this week's 13 cards?", "your cards counted, not the slots");
      const base = await mo.baselineCards(tab);
      eq([base.length, base.filter(c => c.slot).map(c => c.slot).sort()], [16, ["turtleduck:breakfast:1", "turtleduck:dinner:0", "turtleduck:groceries:6"]], "one card per slot");

      // The routine changes: the baseline and next week's empty copy follow; a slot gone goes from both.
      await p.evaluate(() => { window.__routine[0].time = "19:00"; window.__routine[0].minutes = 60; window.__routine.splice(1, 1); });
      await tick(tab);
      eq((await mo.baselineCards(tab)).filter(c => c.slot).map(c => [c.slot, c.pin, c.hours]), [["turtleduck:dinner:0", 19, 1], ["turtleduck:groceries:6", 8, 0.75]], "the baseline follows");
      eq((await mo.weekCards(tab, next)).filter(c => c.slot).map(c => [c.slot, c.pin, c.hours]), [["turtleduck:dinner:0", 19, 1], ["turtleduck:groceries:6", 8, 0.75]], "so does next week's copy");

      // Clear baseline: yours go, the slots stay.
      await mo.view(tab, "base");
      await mo.clearWeek(tab);
      eq(lastDialog(tab), "Clear the whole baseline? Cards set in other apps stay.", "asked, saying so");
      eq((await mo.baselineCards(tab)).map(c => c.slot), ["turtleduck:dinner:0", "turtleduck:groceries:6"], "only the slots are left");
      ok(await mo.visible(tab, "sampleBaselineBtn"), "Start from a sample is back: nothing of yours");
      ok(!(await mo.visible(tab, "clearBtn")), "nothing to clear");

      // Inside "Dinner": your own Dinner holds a card, the slot's never does (a day with only that one: on its own).
      await mo.newCard(tab, { title: "Dinner", hours: 1, days: [1] });
      await mo.newCard(tab, { title: "Call home", hours: 0.25, days: [0, 1], inside: "Dinner" });
      eq(await p.evaluate(() => { const cards = Kyoshi.apps.momo.S.data.baseline.cards, byId = id => cards.find(c => c.id === id); return cards.filter(c => c.title === "Call home").map(c => [c.day, c.parentId && [byId(c.parentId).title, byId(c.parentId).fixed]]); }),
        [[0, null], [1, ["Dinner", false]]], "Monday's on its own beside the slot, Tuesday's inside your Dinner");
    }
  },
  {
    name: "momo slots: a fixed need gets a pinned card in a week not planned yet, never Tasks; loaded, it fills its slot, which follows its time and goes back",
    async run(t) {
      const tab = await open(t, { app: "momo", size: DESKTOP, time: at(TODAY, "08:00") }), p = tab.page;
      await importBackup(tab, gen.momoWorld({ baseline: [{ title: "Sleep", hours: 8, days: [0, 1, 2, 3, 4, 5, 6] }, { title: "Work", hours: 8, days: [0, 1, 2, 3, 4] }] }));
      const meal = { id: "meal:2026-10-05:dinner", title: "Dinner: Chili", fill: "card", date: "2026-10-05", time: "18:00", minutes: 60, slot: "dinner:0", block: "Dinner", fixed: true };
      const cook = { id: "cook:2026-10-08", title: "Cook: Curry", fill: "card", date: "2026-10-08", time: "16:00", minutes: 60, fixed: true };
      const soup = { id: "cook:2026-09-30", title: "Cook: Soup", fill: "card", date: "2026-09-30", time: "20:00", minutes: 45, fixed: true };
      await standIn(tab, [0, 1, 2, 3, 4, 5, 6].map(d => slot("dinner", d, "18:00", 45)), [soup, meal, cook]);
      await tick(tab);
      const tk = await p.evaluate(() => Kyoshi.apps.momo.thisWeekKey()), nk = await p.evaluate(() => Kyoshi.apps.momo.nextWeekKey());
      eq((await mo.baselineCards(tab)).filter(c => c.slot).length, 7, "a Dinner slot each day");

      // Next week isn't planned: the meal and the cooking session are pinned cards of their own anyway, nothing in Tasks.
      await mo.view(tab, "next");
      let b = await mo.board(tab);
      eq(b.tabs.next.status, "not planned yet", "still not planned: those are Momo's");
      has(b.bank.msg, "Start with your baseline", "so the bank says to load it");
      eq([titles(b.days[0]), titles(b.days[3])], [["Dinner: Chili"], ["Cook: Curry"]], "each on its day");
      eq([b.days[0].cards[0].label, b.days[3].cards[0].label], ["Dinner: Chili (from Turtleduck), 1h, pinned at 1800, set in Turtleduck", "Cook: Curry (from Turtleduck), 1h, pinned at 1600, set in Turtleduck"], "pinned at their times");
      eq(b.tasks.tasks.length, 0, "nothing of Turtleduck's in Tasks");
      const cookId = b.days[3].cards[0].id;
      eq(await mo.tryDrag(tab, cookId, 4), false, "a drag leaves it");
      const ed = await mo.openCard(tab, cookId);
      eq([ed.readonly, ed.change, ed.changeId, ed.from.map(n => n.title)], [true, "Change it in Turtleduck", "cook:2026-10-08", ["Cook: Curry"]], "read-only, changed in Turtleduck");
      await mo.closeCard(tab);

      // Load baseline: the meal fills Monday's slot (its own card goes), which takes its title, length and time; the
      // cooking session comes back at its time.
      await mo.loadBaseline(tab);
      b = await mo.board(tab);
      eq([titles(b.days[0]), titles(b.days[3])], [["Sleep", "Work", "Dinner: Chili"], ["Sleep", "Work", "Cook: Curry", "Dinner"]], "in its slot, and the cooking before Thursday's");
      const week = await mo.weekCards(tab, nk);
      eq(week.filter(c => c.day === 0 && c.app).map(c => [c.title, c.hours, c.pin, c.slot, c.need]), [["Dinner: Chili", 1, 18, "turtleduck:dinner:0", null]], "one card: the slot's, holding the meal");
      eq(b.tabs.next.status !== "not planned yet", true, "planned now");

      // A day's exception moves the slot's card; with the meal gone it's the slot again.
      await p.evaluate(() => { window.__needs[1].time = "19:30"; });
      await tick(tab);
      eq((await mo.weekCards(tab, nk)).filter(c => c.slot === "turtleduck:dinner:0").map(c => [c.title, c.pin]), [["Dinner: Chili", 19.5]], "at the exception's time");
      await p.evaluate(() => { window.__needs.splice(1, 1); });
      await tick(tab);
      eq((await mo.weekCards(tab, nk)).filter(c => c.slot === "turtleduck:dinner:0").map(c => [c.title, c.hours, c.pin]), [["Dinner", 0.75, 18]], "back to the slot");

      // Today: this week wasn't planned either, yet tonight's cooking is there; its pop-up has no Edit, only where to change it.
      await mo.showToday(tab);
      const row = (await mo.today(tab)).sections.flatMap(s => s.rows).find(r => r.title === "Cook: Soup");
      ok(!!row && row.when === "2000", "tonight's cooking on Today, at 8 pm");
      await mo.openTodayCard(tab, row.card);
      eq(await p.evaluate(() => { const $ = s => document.querySelector(`#kMount ${s}`); return [$("#detailEditBtn").hidden, $("#detailChange").hidden, $("#detailChange").textContent.trim()]; }), [true, false, "Change it in Turtleduck"], "no Edit; Change it in Turtleduck");
      await mo.closeTodayCard(tab);
      eq((await mo.weekCards(tab, tk)).map(c => [c.title, c.pin, c.fixed]), [["Cook: Soup", 20, true]], "this week holds just that one");
    }
  },
  {
    name: "momo slots: slot and fixed survive Export and Import, junk is cleaned, and a backup of Momo's own cards alone has nothing to import",
    async run(t) {
      const tab = await open(t, { app: "momo", size: DESKTOP }), p = tab.page;
      const world = gen.momoWorld({ baseline: [{ title: "Sleep", hours: 8, days: [0] }] }), tk = "2026-09-28";
      world.baseline.cards.push(
        { id: "s1", title: "Dinner", hours: 0.75, day: 0, pin: 18, app: "turtleduck", slot: "turtleduck:dinner:0", fixed: true, auto: true },
        { id: "s2", title: "Lunch", hours: 0.5, day: 0, pin: 12, app: "turtleduck", slot: "hawky:lunch:0", fixed: true, auto: true },
        { id: "s3", title: "Tea", hours: 0.5, day: 0, pin: 15, slot: "turtleduck:tea:0", fixed: true, auto: true },
        { id: "n1", title: "Call", hours: 0.25, day: 0, parentId: "s1", pos: "middle" }, { id: "n2", title: "Read", hours: 0.5, day: 0, parentId: "bl0", pos: "bottom" });
      world.weeks[tk] = { cards: [{ id: "w1", title: "Cook: Soup", hours: 1, day: 3, pin: 16, need: "turtleduck:cook:2026-10-01", app: "turtleduck", auto: true, fixed: true, slot: null }], closed: false, u: 1 };
      await importBackup(tab, world);
      const out = await exportBackup(tab);
      eq(out.baseline.cards.map(c => [c.id, c.slot, c.fixed, c.auto, c.app]), [["bl0", null, false, false, null], ["s1", "turtleduck:dinner:0", true, true, "turtleduck"], ["s2", null, true, false, "turtleduck"], ["s3", null, false, false, null], ["n1", null, false, false, null], ["n2", null, false, false, null]],
        "a slot kept with its app's prefix; another app's prefix or no app is dropped, and auto with it");
      eq(out.baseline.cards.filter(c => c.parentId).map(c => [c.id, c.parentId]), [["n2", "bl0"]], "a card inside a slot's goes back on its own; inside yours it stays");
      eq(out.weeks[tk].cards.map(c => [c.need, c.fixed, c.auto, c.pin]), [["turtleduck:cook:2026-10-01", true, true, 16]], "a fixed need's card kept");

      // Nothing of yours: slot cards and cards Momo placed.
      await importBackup(tab, { schemaVersion: 2, weeks: { [tk]: { cards: [{ id: "a1", title: "Cook", hours: 1, day: 2, need: "turtleduck:cook:x", app: "turtleduck", auto: true }], closed: false, u: 1 } },
        baseline: { cards: [{ id: "b1", title: "Dinner", hours: 1, day: 0, pin: 18, app: "turtleduck", slot: "turtleduck:dinner:0", fixed: true, auto: true }], u: 1 }, goals: [], colors: {} });
      eq(lastDialog(tab), "That backup has nothing in it Momo can use.", "refused");
      eq(await p.evaluate(() => Kyoshi.apps.momo.data.hasData()), true, "what's here stays");
    }
  }
];
