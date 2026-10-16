/* Kyoshi · tests/hawky-quantity.test.js — Hawky's shopping list quantities and the locked look (the 2026-10-15
 * feature requests): an item's quantity starts at 1, is typed or stepped with ‹ › (never below 1 nor above 999), shows
 * as "3 ×" past 1, goes back to 1 after each add, is changed in the item's pop-up, survives a reload, and an item from
 * before quantities reads as 1; a locked list is tinted amber with a lock before its days, its items still shown and
 * still taken off. */
"use strict";
const { DESKTOP, PHONE, eq, ok, open, importBackup } = require("./lib");
const hk = require("./hawky");

const M = "#kMount";
// The items as kept: [text, qty], in the order added.
const kept = tab => tab.page.evaluate(() => Kyoshi.apps.hawky.S.lists.flatMap(l => Kyoshi.apps.hawky.liveItemsOf(l).map(i => [i.text, i.qty])));
// The items as shown on a list's card: [quantity words ("" at 1), text].
const shownQty = async (tab, topic) => tab.page.$$eval(`${M} .slist[data-id="${await hk.cardOf(tab, topic)}"] .sitem`, els => els.map(e => [(e.querySelector(".sitem-qty") || {}).textContent || "", e.querySelector(".sitem-text").textContent]));
// One of a quantity box's arrows: ‹ (-1) or › (1).
const step = (tab, box, dir) => tab.page.click(`${M} .qty:has(#${box}) .qty-step[data-step="${dir}"]`);

module.exports = [
  {
    name: "hawky quantity: 1 to start, typed or stepped with the arrows (1 to 999), shown past 1, back to 1 after an add, changed in the pop-up, kept; an old item reads 1",
    async run(t) {
      const tab = await open(t, { app: "hawky", size: PHONE }), p = tab.page;
      await hk.showLists(tab);
      eq(await p.inputValue(`${M} #listQty`), "1", "the add row's quantity starts at 1");
      ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "the add row fits the phone");
      await step(tab, "listQty", "-1");
      eq(await p.inputValue(`${M} #listQty`), "1", "never below 1");
      await step(tab, "listQty", "1");
      await step(tab, "listQty", "1");
      eq(await p.inputValue(`${M} #listQty`), "3", "› twice: 3");
      await hk.addItem(tab, "Hardware Store", "Garden", "Hose clamp");
      eq(await p.inputValue(`${M} #listQty`), "1", "back to 1 after the add");
      await hk.addItem(tab, "Hardware Store", "Garden", "Gloves");
      await p.fill(`${M} #listItem`, "Seed packets");
      await p.fill(`${M} #listQty`, "12");
      await p.press(`${M} #listQty`, "Enter");
      eq(await kept(tab), [["Hose clamp", 3], ["Gloves", 1], ["Seed packets", 12]], "kept: 3, 1 and the 12 typed (Enter adds)");
      eq(await shownQty(tab, "Garden"), [["3 ×", "Hose clamp"], ["", "Gloves"], ["12 ×", "Seed packets"]], "shown past 1 only");
      await p.fill(`${M} #listQty`, "5000");
      await p.locator(`${M} #listQty`).dispatchEvent("change");
      eq(await p.inputValue(`${M} #listQty`), "999", "never above 999");
      await p.fill(`${M} #listQty`, "1");

      // The item's pop-up: its quantity, stepped down, then saved.
      await p.click(`${M} .sitem-text:text-is("Hose clamp")`);
      await p.waitForSelector(`${M} #itemOverlay.open`);
      eq(await p.inputValue(`${M} #itemQty`), "3", "the pop-up shows its quantity");
      await step(tab, "itemQty", "-1");
      await p.click(`${M} #itemForm button[type=submit]`);
      eq((await kept(tab))[0], ["Hose clamp", 2], "saved as 2");
      await p.reload();
      await p.waitForFunction(() => window.Kyoshi && Kyoshi.active() && Kyoshi.active().started);
      eq(await kept(tab), [["Hose clamp", 2], ["Gloves", 1], ["Seed packets", 12]], "kept through a reload");

      // A backup from before quantities: its items read as 1.
      await importBackup(tab, { schemaVersion: 2, appVersion: "2.340", items: [], lists: [{ id: "old", vendor: "Bookshop", topic: "Gifts", lock: null, unlocked: "", done: "", deleted: false, at: 1, u: 1, items: [{ id: "o1", text: "Atlas", note: "", at: 1, bought: "", deleted: false }] }] });
      eq(await kept(tab), [["Atlas", 1]], "an item from before quantities: 1");
    }
  },
  {
    name: "hawky locked look: a locked list is tinted amber with a lock before its days; its items still show and can still come off",
    async run(t) {
      const tab = await open(t, { app: "hawky", size: DESKTOP }), p = tab.page;
      await hk.showLists(tab);
      await hk.addItem(tab, "Bookshop", "Gifts", "Atlas");
      await hk.addItem(tab, "Bookshop", "Gifts", "Fountain pen");
      await hk.addItem(tab, "Bookshop", "Maps", "Globe");
      const ids = { Gifts: await hk.cardOf(tab, "Gifts"), Maps: await hk.cardOf(tab, "Maps") };
      const look = topic => p.$eval(`${M} .slist[data-id="${ids[topic]}"]`, c => ({ bg: getComputedStyle(c).backgroundColor, stripes: getComputedStyle(c, "::after").backgroundImage !== "none", lock: !!c.querySelector(".slist-state .lock-icon") }));
      const before = await look("Gifts");
      await hk.pressList(tab, "Gifts", "Lock 7 days");
      const locked = await look("Gifts"), open_ = await look("Maps");
      ok(locked.bg !== before.bg && locked.stripes && locked.lock, `locked: tinted (${locked.bg}), striped, a lock by its days`);
      eq([open_.stripes, open_.lock], [false, false], "an open list: none of it");
      eq((await hk.listCard(tab, "Gifts")).meta, "2 items · locked · 7 days", "its line reads as before");
      eq((await hk.listCard(tab, "Gifts")).items.map(i => i.text), ["Atlas", "Fountain pen"], "its items still show");
      await p.click(`${M} .slist[data-id="${ids.Gifts}"] .sitem-x >> nth=0`);
      eq((await hk.listCard(tab, "Gifts")).items.map(i => i.text), ["Fountain pen"], "and can still be taken off (the stripes don't catch the tap)");
    }
  }
];
