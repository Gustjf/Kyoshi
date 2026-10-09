/* Kyoshi · tests/hawky-lists.test.js — Hawky's shopping lists and their errands (the 2026-10-08 feedback batch's Phase 5):
 * Bought on an open list (a question first; every item bought today, the list into Done, kept as a 1-day lock unlocked
 * early that day; un-ticking one there makes it ready; never an errand); a list whose wait is over gets one errand ("Buy
 * <topic> at <store>", due this Sunday, 30 minutes, a task of its own in Momo, "Open in Hawky" showing the list) that
 * mirrors it: its ✓ buys the list and back (only that day's items, else those bought last), Tick all and an item
 * un-ticked in Done tick and untick it, deleting the list deletes it; from a backup, an errand for each ready list
 * (Unlock early too, even the day it was locked; a long name cut at a word's end; none for a Bought one, one done before
 * or one still locked), kept through a reload and an Export, one on two devices, where a copy made by a device that
 * hadn't synced yet never undoes what was done to it; deleted, it stays deleted and the list stays ready, also over
 * three devices where one, syncing late, had changed it as its list was done on another. */
"use strict";
const { TODAY, DESKTOP, PHONE, eq, ok, open, lastDialog, switchTo, importBackup, exportBackup, addDays } = require("./lib");
const gen = require("./generate");
const hk = require("./hawky");
const mo = require("./momo");

const D = n => addDays(TODAY, n); // TODAY is a Wednesday: this Sunday is D(4)
const T = Date.parse("2026-09-01T08:00:00Z");
const fitsScreen = tab => tab.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
const errands = tab => tab.page.evaluate(() => Kyoshi.apps.hawky.S.items.map(i => ({ id: i.id, text: i.text, due: i.due, minutes: i.minutes, done: i.done, deleted: i.deleted })));
const showErrands = tab => tab.page.click('#kMount #nav [data-view="errands"]');
async function reload(tab) {
  await tab.page.reload();
  await tab.page.waitForFunction(() => window.Kyoshi && Kyoshi.active() && Kyoshi.active().started && Kyoshi.active() === Kyoshi.apps.hawky);
}
// Another device's save combined into a tab, as sync does (then afterSync): its errands as [id, deleted, minutes], by id.
const combineIn = (tab, raw) => tab.page.evaluate(x => {
  const H = Kyoshi.apps.hawky, r = H.data.combine(x, { replace: false, plain: false });
  r.apply();
  H.data.afterSync();
  return H.S.items.map(i => [i.id, i.deleted, i.minutes]).sort();
}, raw);
// A Hawky backup with shopping lists, each { id, vendor, topic, items: [words], lock, unlocked, done (every item bought
// that day) }, and no errands.
const listsBackup = lists => ({
  schemaVersion: 2, appVersion: "2.240", items: [],
  lists: lists.map((l, k) => ({
    id: l.id, vendor: l.vendor, topic: l.topic, lock: l.lock || null, unlocked: l.unlocked || "", done: l.done || "", deleted: false, at: T + k * 10, u: T + k * 10,
    items: l.items.map((text, j) => ({ id: `${l.id}-${j}`, text, note: "", at: T + k * 10 + j, bought: l.done || "", deleted: false }))
  }))
});

module.exports = [
  {
    name: "hawky lists: Bought marks an open list's items bought without the wait (a question first; No keeps it open), into Done; un-ticking one there makes it ready; never an errand",
    async run(t) {
      const tab = await open(t, { app: "hawky", size: PHONE }), p = tab.page;
      await hk.showLists(tab);
      await hk.addItem(tab, "Bookshop", "Gifts", "Atlas");
      await hk.addItem(tab, "Bookshop", "Gifts", "Fountain pen");
      await hk.addItem(tab, "Hardware Store", "Garden", "Hose");
      let gifts = await hk.listCard(tab, "Gifts");
      eq([gifts.state, gifts.actions, gifts.note], ["open", ["Lock 30 days", "Lock 7 days", "Bought"], ""], "an open list: Bought after the two locks");
      const buttons = await p.$$eval(`#kMount .slist[data-id="${await hk.cardOf(tab, "Gifts")}"] .slist-actions button`, els => els.map(b => b.getBoundingClientRect()).map(r => [r.left, r.right, r.height]));
      ok(buttons.length === 3 && buttons.every(([left, right, height]) => left >= 0 && right <= PHONE.width && height >= 42), "on a phone the three buttons are thumb-sized and on screen");
      ok(await fitsScreen(tab), "nothing wider than the phone");

      tab.answers.push(false);
      await hk.pressList(tab, "Gifts", "Bought");
      eq(lastDialog(tab), "Mark all 2 items on this list bought, without the cooling-off wait? The list moves to Done.", "it asks first");
      eq((await hk.listCard(tab, "Gifts")).state, "open", "No: it stays open");
      await hk.pressList(tab, "Gifts", "Bought");
      gifts = await hk.listCard(tab, "Gifts");
      eq([gifts.state, gifts.meta, gifts.items], ["done", "2 items · done today", [{ text: "Atlas", bought: true }, { text: "Fountain pen", bought: true }]], "Yes: every item bought, the list done today");
      eq(await hk.doneLists(tab), [{ topic: "Gifts", meta: "2 items · done today" }], "in the Done fold");
      const kept = await p.evaluate(() => Kyoshi.apps.hawky.S.lists.find(l => l.topic === "Gifts"));
      eq([kept.lock, kept.unlocked, kept.done, kept.items.map(i => i.bought)], [{ at: TODAY, days: 1 }, TODAY, TODAY, [TODAY, TODAY]], "kept as a 1-day lock unlocked early today: nothing new stored");
      eq(await errands(tab), [], "no errand");
      tab.answers.push(false);
      await hk.pressList(tab, "Garden", "Bought");
      eq(lastDialog(tab), "Mark the item on this list bought, without the cooling-off wait? The list moves to Done.", "one item: the item");

      // Un-ticked in Done: ready, with Tick all and no locks; still no errand, as it never waited.
      await p.click("#kMount #listsDoneBox summary");
      await hk.tickItem(tab, "Gifts", "Atlas");
      gifts = await hk.listCard(tab, "Gifts");
      eq([gifts.state, gifts.actions, gifts.note, gifts.items.map(i => i.bought)], ["ready", ["Tick all"], "", [false, true]], "un-ticked in Done: ready, Tick all, no locks");
      eq(await errands(tab), [], "still no errand");
      await hk.tickItem(tab, "Gifts", "Atlas");
      eq([(await hk.listCard(tab, "Gifts")).state, await errands(tab)], ["done", []], "ticked again: done, and no errand");
    }
  },
  {
    name: "hawky lists: a list whose wait is over gets an errand (Buy … at …, this Sunday, 30 min; a task of its own in Momo, Open in Hawky shows the list); its ✓ buys the list and back, Tick all and an un-tick follow it, deleting the list deletes it",
    async run(t) {
      const tab = await open(t, { app: "hawky", size: DESKTOP }), p = tab.page;
      await hk.showLists(tab);
      await hk.addItem(tab, "REI", "Shoes", "Trail runners");
      await hk.addItem(tab, "REI", "Shoes", "Wool socks");
      await hk.pressList(tab, "Shoes", "Lock 7 days");
      eq([(await hk.listCard(tab, "Shoes")).state, await errands(tab)], ["locked", []], "locked: no errand while it cools off");

      // A week on (Wednesday, Oct 7; the minute's tick sees the new day): ready, and its errand, due Sunday Oct 11.
      await tab.ctx.clock.fastForward(7 * 86400000);
      const listId = await hk.cardOf(tab, "Shoes"), id = `list:${listId}`;
      let shoes = await hk.listCard(tab, "Shoes");
      eq([shoes.state, shoes.actions, shoes.note], ["ready", ["Tick all"], "Its errand waits in Errands and Momo."], "ready, saying where its errand waits");
      eq(await errands(tab), [{ id, text: "Buy Shoes at REI", due: D(11), minutes: 30, done: "", deleted: false }], "its errand: this Sunday, 30 minutes, the list's id in its own");
      await showErrands(tab);
      eq((await hk.groups(tab)).week.map(i => [i.id, i.text, i.meta]), [[id, "Buy Shoes at REI", "Sunday · 30m"]], "in This week");
      await p.click(`#kMount .errand[data-id="${id}"] .errand-text`);
      eq(await p.locator("#kMount #errandListNote").innerText(), "For the Shoes list at REI: ✓ buys the list.", "its pop-up names the list");
      await p.click("#kMount #errandCancelBtn");

      // In Momo, a task of its own; placed on Sunday, its card's Open in Hawky shows the list.
      await switchTo(tab, "momo");
      await importBackup(tab, gen.momo([], [{ date: D(7), title: "Sleep", hours: 8 }]));
      eq((await mo.tasks(tab)).tasks.filter(x => x.key === `n:hawky:${id}`).map(x => [x.title, x.due, x.hours]), [["Buy Shoes at REI", "due Sun", 0.5]], "in Momo's Tasks: due Sunday, half an hour");
      ok(await mo.dragTask(tab, `n:hawky:${id}`, 6), "dragged onto Sunday");
      await mo.openCard(tab, (await mo.days(tab))[6].cards.find(c => c.title === "Buy Shoes at REI").id);
      await mo.openInApp(tab, "hawky", id);
      eq(await p.evaluate(() => [Kyoshi.apps.hawky.S.view, [...document.querySelectorAll("#kMount .slist.flash")].map(c => c.dataset.id)]), ["lists", [listId]], "Open in Hawky: Shopping, the list flashing");

      // One item bought today; a day on, the errand's ✓ buys the rest: the list done that day, the errand in Done.
      await hk.tickItem(tab, "Shoes", "Wool socks");
      await tab.ctx.clock.fastForward(86400000);
      await showErrands(tab);
      await hk.tickErrand(tab, id);
      eq(await hk.status(tab), "Bought the Shoes list at REI.", "the line says so");
      const bought = () => p.evaluate(x => Kyoshi.apps.hawky.S.lists.find(l => l.id === x).items.filter(i => !i.deleted).map(i => i.bought), listId);
      eq([(await hk.listCard(tab, "Shoes")).state, await bought(), (await hk.item(tab, id)).done], ["done", [D(8), D(7)], D(8)], "its ✓ buys the list: done today, the rest bought today");
      ok(!(await hk.groups(tab)).week, "out of This week");

      // ✓ again: only today's item isn't bought any more, the list ready, the errand open.
      await p.click("#kMount #doneBox summary");
      await hk.tickErrand(tab, id);
      eq(await hk.status(tab), "The Shoes list at REI is ready again.", "the line says so");
      eq([(await hk.listCard(tab, "Shoes")).state, await bought(), (await hk.item(tab, id)).done], ["ready", ["", D(7)], ""], "the list ready, yesterday's item still bought, the errand open");

      // Tick all on the list: the errand done that day; an item un-ticked in Done: open again.
      await hk.showLists(tab);
      await hk.pressList(tab, "Shoes", "Tick all");
      eq(lastDialog(tab), "Tick the last item as bought? The list moves to Done.", "Tick all asks first");
      eq([(await hk.listCard(tab, "Shoes")).state, (await hk.item(tab, id)).done], ["done", D(8)], "Tick all: the errand done today");
      await p.click("#kMount #listsDoneBox summary");
      await hk.tickItem(tab, "Shoes", "Wool socks");
      eq([(await hk.listCard(tab, "Shoes")).state, (await hk.item(tab, id)).done], ["ready", ""], "an item un-ticked in Done: the list ready, its errand open");

      // A day on, its last item not bought taken off: the list done that day with nothing bought that day; the errand's ✓
      // taken back un-buys what was bought last.
      await tab.ctx.clock.fastForward(86400000);
      await p.click(`#kMount .slist[data-id="${listId}"] .sitem:has(.sitem-text:text-is("Wool socks")) .sitem-x`);
      eq(lastDialog(tab), "Take “Wool socks” off this list?", "taking it off asks first");
      eq([(await hk.listCard(tab, "Shoes")).state, (await hk.item(tab, id)).done], ["done", D(9)], "done today, and its errand");
      await showErrands(tab);
      await hk.tickErrand(tab, id);
      eq([(await hk.listCard(tab, "Shoes")).state, await bought(), (await hk.item(tab, id)).done], ["ready", [""], ""], "taken back: the item bought last isn't, the list ready");
      await hk.showLists(tab);

      // The list deleted (its pop-up): its errand too.
      await hk.pressList(tab, "Shoes", "Rename");
      await p.click("#kMount #listDeleteBtn");
      lastDialog(tab);
      eq((await errands(tab)).map(e => [e.id, e.text, e.deleted]), [[id, "", true]], "the list deleted: its errand a marker");
      await showErrands(tab);
      eq(await hk.groups(tab), {}, "gone from the errands");
    }
  },
  {
    name: "hawky lists: a backup's ready lists get an errand each (Unlock early too; kept through a reload, carried by Export, one on two devices, a late copy never undoing a change; none for a Bought list, one done before or still locked); deleted, it stays deleted and the list stays ready",
    async run(t) {
      const tab = await open(t, { app: "hawky", size: PHONE }), p = tab.page;
      const backup = listsBackup([
        { id: "sl-shoes", vendor: "REI", topic: "Shoes", items: ["Trail runners"], lock: { at: D(-10), days: 7 } },          // ready since Sunday
        { id: "sl-tent", vendor: "REI", topic: "Camping", items: ["Tent"], lock: { at: D(-2), days: 7 } },                   // still locked
        { id: "sl-books", vendor: "Bookshop", topic: "Books", items: ["Atlas"], lock: { at: D(-20), days: 7 }, done: D(-5) }, // done before
        { id: "sl-stove", vendor: "The Great Outdoors Company Store", topic: "Camping gear for the long weekend trip", items: ["Stove"],
          lock: { at: D(-3), days: 30 }, unlocked: D(-1) },                                                                  // unlocked early
        { id: "sl-lamp", vendor: "Hardware Store", topic: "Lighting", items: ["Desk lamp"], lock: { at: D(-2), days: 30 }, unlocked: D(-2) }, // unlocked the day it was locked
        { id: "sl-desk", vendor: "Wholesalefurniture Warehouse", topic: "Standing desk with electric motor", items: ["Desk"], lock: { at: D(-9), days: 7 } },
        { id: "sl-gift", vendor: "Bookshop", topic: "Gifts", items: ["Fountain pen"], lock: { at: D(-2), days: 1 }, unlocked: D(-2) } // Bought, then un-ticked
      ]);
      await importBackup(tab, backup);
      const made = [
        { id: "list:sl-desk", text: "Buy Standing desk with electric motor at Wholesalefurniture…", due: D(4), minutes: 30, done: "", deleted: false },
        { id: "list:sl-lamp", text: "Buy Lighting at Hardware Store", due: D(4), minutes: 30, done: "", deleted: false },
        { id: "list:sl-shoes", text: "Buy Shoes at REI", due: D(4), minutes: 30, done: "", deleted: false },
        { id: "list:sl-stove", text: "Buy Camping gear for the long weekend trip at The Great…", due: D(4), minutes: 30, done: "", deleted: false }
      ];
      const byId = list => list.sort((a, b) => (a.id < b.id ? -1 : 1));
      eq(byId(await errands(tab)), made, "an errand for each ready list but the Bought one, long ones cut at a word's end");
      eq((await hk.groups(tab)).week.map(i => [i.text, i.meta]).sort(), made.map(e => [e.text, "Sunday · 30m"]).sort(), "in This week");
      await reload(tab);
      eq(byId(await errands(tab)), made, "the same after a reload");
      const back = await exportBackup(tab);
      eq(back.items.map(i => Object.keys(i).sort().join(" ")), made.map(() => "at deleted done due id minutes note postponed text u"), "Export carries them as plain errands");

      // Another device with the same lists makes the same errands, an hour later. Here, Shoes' is deleted from its pop-up;
      // there, Desk's is changed (45 minutes). Combined both ways: one errand each, the deletion and the change kept (a copy
      // made by a device that hadn't synced yet never undoes them).
      const other = await open(t, { app: "hawky", size: PHONE, time: Date.parse(`${TODAY}T08:00:00Z`) });
      await importBackup(other, backup);
      await p.click('#kMount .errand[data-id="list:sl-shoes"] .errand-text');
      await p.click("#kMount #errandDeleteBtn");
      eq(lastDialog(tab), "Delete “Buy Shoes at REI”? This can't be undone.", "it asks first");
      await other.page.click('#kMount .errand[data-id="list:sl-desk"] .errand-text');
      await other.page.fill("#kMount #errandMinutes", "45");
      await other.page.click('#kMount #errandForm [type="submit"]');
      const [mine, theirs] = [await exportBackup(tab), await exportBackup(other)];
      const both = [["list:sl-desk", false, 45], ["list:sl-lamp", false, 30], ["list:sl-shoes", true, 30], ["list:sl-stove", false, 30]];
      eq(await combineIn(tab, theirs), both, "here: one errand each, Shoes' still deleted, Desk's 45 minutes");
      eq(await combineIn(other, mine), both, "there: the same");

      // After a reload, no errand comes back for Shoes, and the list stays ready.
      await reload(tab);
      eq(byId(await errands(tab)).map(e => [e.id, e.deleted]), [["list:sl-desk", false], ["list:sl-lamp", false], ["list:sl-shoes", true], ["list:sl-stove", false]], "after a reload: its marker, no new errand");
      await hk.showLists(tab);
      const shoes = await hk.listCard(tab, "Shoes"), gift = await hk.listCard(tab, "Gifts");
      eq([shoes.state, shoes.note], ["ready", ""], "the list stays ready, with no line about an errand");
      eq([gift.state, gift.note], ["ready", ""], "the Bought list un-ticked: ready, no errand");
      eq((await hk.listCard(tab, "Lighting")).note, "Its errand waits in Errands and Momo.", "the one unlocked early the day it was locked: its errand waits");
    }
  },
  {
    name: "hawky lists: three devices — an errand deleted on one stays deleted everywhere, though another, syncing late, had changed it while its list was done on the third",
    async run(t) {
      const backup = listsBackup([{ id: "sl-shoes", vendor: "REI", topic: "Shoes", items: ["Trail runners", "Wool socks"], lock: { at: D(-10), days: 7 } }]);
      const clock = hm => Date.parse(`${TODAY}T${hm}:00Z`);
      const c = await open(t, { app: "hawky", size: DESKTOP, time: clock("07:00") });
      const b = await open(t, { app: "hawky", size: DESKTOP, time: clock("07:10") });
      const a = await open(t, { app: "hawky", size: DESKTOP, time: clock("07:20") });
      for (const tab of [a, b, c]) await importBackup(tab, backup);

      // None synced yet: C ticks the list off (its errand done with it), B changes the errand's note, A deletes it.
      await hk.showLists(c);
      await hk.pressList(c, "Shoes", "Tick all");
      await b.page.click('#kMount .errand[data-id="list:sl-shoes"] .errand-text');
      await b.page.fill("#kMount #errandNote", "The blue ones");
      await b.page.click('#kMount #errandForm [type="submit"]');
      await a.page.click('#kMount .errand[data-id="list:sl-shoes"] .errand-text');
      await a.page.click("#kMount #errandDeleteBtn");

      // Half an hour on, B takes C's save (the list done: B's errand follows it), then A's; then A and C take B's.
      await b.ctx.clock.fastForward(30 * 60000);
      const [fromA, fromC] = [await exportBackup(a), await exportBackup(c)];
      await combineIn(b, fromC);
      eq((await hk.item(b, "list:sl-shoes")).done, TODAY, "B: its errand done with the list");
      await combineIn(b, fromA);
      const fromB = await exportBackup(b);
      await combineIn(a, fromB);
      await combineIn(c, fromB);
      for (const [tab, who] of [[a, "A"], [b, "B"], [c, "C"]]) {
        eq((await hk.item(tab, "list:sl-shoes")).deleted, true, `${who}: the errand stays deleted (the last change made to it)`);
        eq(await tab.page.evaluate(() => Kyoshi.apps.hawky.stateOf(Kyoshi.apps.hawky.S.lists[0])), "done", `${who}: the list done`);
      }
    }
  }
];
