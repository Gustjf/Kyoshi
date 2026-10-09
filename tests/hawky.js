/* Kyoshi · tests/hawky.js — Hawky's screens as the tests read and use them: quick add with its chips and status line, the
 * open errands by group (each line's text, its meta line, whether it has Tomorrow →), Tomorrow → and ✓ themselves, an
 * errand as Hawky keeps it (for checks), and the Shopping tab's add row (its boxes, typed in and read), its stores (each
 * with its colour and its lists' edges), a list's card (its state, buttons, line and items; its buttons and its items' ✓
 * pressed) and the Done fold's lists. Errands are found by their ids, lists by their topics. Selectors live here, so a
 * markup change is fixed in one place. */
"use strict";

const M = "#kMount";

// --- Errands ---
// Quick add: the text, a day chip ("today" | "week" | "nextweek" | "pick" with date | "none") and a minutes chip (5, 15,
// 30, 60 or "other" with other), then Add.
async function addErrand(tab, text, { day = "none", date = "", minutes = 15, other = "" } = {}) {
  const p = tab.page;
  await p.fill(`${M} #addText`, text);
  await p.click(`${M} #addDays [data-day="${day}"]`);
  if (day === "pick") await p.fill(`${M} #addDate`, date);
  await p.click(`${M} #addMinutes [data-minutes="${minutes}"]`);
  if (minutes === "other") await p.fill(`${M} #addOther`, String(other));
  await p.click(`${M} #addBtn`);
}
// Quick add with the chips as they are: the text, then Enter.
async function quickAdd(tab, text) {
  await tab.page.fill(`${M} #addText`, text);
  await tab.page.press(`${M} #addText`, "Enter");
}
// The chips pressed: { day, minutes } (their data- values).
const chips = tab => tab.page.evaluate(() => ({
  day: document.querySelector("#kMount #addDays .active").dataset.day,
  minutes: document.querySelector("#kMount #addMinutes .active").dataset.minutes
}));
// The line under quick add.
const status = tab => tab.page.locator(`${M} #addStatus`).innerText();

// The open errands as shown, by group (only those with any): { overdue: [{ id, text, meta, postpone, warn }], today, week,
// later }; meta is the line under the text ("postponed 4× · Yesterday · 15m"), postpone whether it has Tomorrow →, warn
// whether its line has the warning mark.
const groups = tab => tab.page.$$eval(`${M} #groups .group`, els => Object.fromEntries(els.map(g => [
  [...g.classList].find(c => c !== "group"),
  [...g.querySelectorAll(".errand")].map(li => ({
    id: li.dataset.id, text: li.querySelector(".errand-text").textContent, meta: li.querySelector(".errand-meta").textContent,
    postpone: !!li.querySelector('[data-act="postpone"]'), warn: !!li.querySelector(".errand-meta .warn-mark")
  }))
])));
// Tomorrow → on an errand's line.
const postpone = (tab, id) => tab.page.click(`${M} .errand[data-id="${id}"] [data-act="postpone"]`);
// ✓ on an errand's line: done, or (a done one, in the Done fold) not done after all.
const tickErrand = (tab, id) => tab.page.click(`${M} .errand[data-id="${id}"] .tick`);
// An errand as Hawky keeps it (deleted ones too).
const item = (tab, id) => tab.page.evaluate(x => Kyoshi.apps.hawky.S.items.find(i => i.id === x) || null, id);

// --- Shopping ---
const showLists = tab => tab.page.click(`${M} #nav [data-view="lists"]`);
// The add row's boxes.
const ROW = { store: `${M} #listVendor`, topic: `${M} #listTopic`, item: `${M} #listItem` };
// The add row: store, topic and item, then Add.
async function addItem(tab, store, topic, text) {
  const p = tab.page;
  await p.fill(ROW.store, store);
  await p.fill(ROW.topic, topic);
  await p.fill(ROW.item, text);
  await p.click(`${M} #listAddBtn`);
}
// Types into one of the add row's boxes ("store", "topic" or "item") in place of what it holds, as the user does.
const typeIn = (tab, box, text) => tab.page.fill(ROW[box], text);
// The add row's boxes as they read: { store, topic, item }.
const addRow = tab => tab.page.evaluate(row => Object.fromEntries(Object.entries(row).map(([k, sel]) => [k, document.querySelector(sel).value])), ROW);
// The topics the add row suggests (for the store in its box).
const topics = tab => tab.page.$$eval(`${M} #hawkyTopics option`, els => els.map(o => o.value));
// The line under the add row.
const listStatus = tab => tab.page.locator(`${M} #listStatus`).innerText();
// The stores as shown, each { name, color (its --store), dot (its name's dot, as computed), lists: [{ topic, edge (the left
// border's colour and width, as computed) }] }; colours as the browser computes them ("rgb(20, 184, 166)").
const stores = tab => tab.page.$$eval(`${M} #vendors .vendor`, els => els.map(v => ({
  name: v.querySelector(".vendor-name").textContent, color: v.style.getPropertyValue("--store"),
  dot: getComputedStyle(v.querySelector(".vendor-name"), "::before").backgroundColor,
  lists: [...v.querySelectorAll(".slist")].map(c => ({ topic: c.querySelector(".slist-topic").textContent, edge: `${getComputedStyle(c).borderLeftColor} ${getComputedStyle(c).borderLeftWidth}` }))
})));
// A "#rrggbb" colour as the browser computes it.
const rgb = hex => `rgb(${[1, 3, 5].map(k => parseInt(hex.slice(k, k + 2), 16)).join(", ")})`;

// A list's card by its topic (the first, should two share it; a done one too, in the Done fold): its list's id, or "".
const cardOf = (tab, topic) => tab.page.$$eval(`${M} .slist`, (els, t) => {
  const c = els.find(e => e.querySelector(".slist-topic").firstChild.textContent === t);
  return c ? c.dataset.id : "";
}, topic);
// A list as shown: { state (open | locked | ready | done), meta (its line: "2 items · ready"), actions: [its buttons' words],
// note (the line among them: "Unlocks Oct 7", "Its errand waits in Errands and Momo."; "" for none), items: [{ text,
// bought }] }; null when there's no such list.
const listCard = (tab, topic) => tab.page.$$eval(`${M} .slist`, (els, t) => {
  const c = els.find(e => e.querySelector(".slist-topic").firstChild.textContent === t);
  if (!c) return null;
  const acts = c.querySelector(".slist-actions"), note = acts && acts.querySelector(".slist-lock");
  return {
    state: ["open", "locked", "ready", "done"].find(s => c.classList.contains(s)), meta: c.querySelector(".slist-meta").textContent,
    actions: acts ? [...acts.querySelectorAll("button")].map(b => b.textContent) : [], note: note ? note.textContent : "",
    items: [...c.querySelectorAll(".sitem")].map(i => ({ text: i.querySelector(".sitem-text").textContent, bought: i.classList.contains("bought") }))
  };
}, topic);
// One of a list's buttons, by its words ("Lock 7 days", "Bought", "Unlock early", "Tick all", "Rename"); a done list's
// only once the Done fold is open.
const pressList = async (tab, topic, words) => tab.page.click(`${M} .slist[data-id="${await cardOf(tab, topic)}"] button:text-is("${words}")`);
// An item's ✓ on a list: bought, or not bought after all.
const tickItem = async (tab, topic, text) => tab.page.click(`${M} .slist[data-id="${await cardOf(tab, topic)}"] .sitem:has(.sitem-text:text-is("${text}")) .tick`);
// The Done fold's lists, newest first: [{ topic, meta }].
const doneLists = tab => tab.page.$$eval(`${M} #listsDone .slist`, els => els.map(c => ({ topic: c.querySelector(".slist-topic").firstChild.textContent, meta: c.querySelector(".slist-meta").textContent })));

module.exports = {
  addErrand, quickAdd, chips, status, groups, postpone, tickErrand, item, showLists, ROW, addItem, typeIn, addRow, topics, listStatus, stores, rgb,
  cardOf, listCard, pressList, tickItem, doneLists
};
