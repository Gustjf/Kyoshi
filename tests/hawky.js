/* Kyoshi · tests/hawky.js — Hawky's screens as the tests read and use them: quick add with its chips and status line, the
 * open errands by group (each line's text, its meta line, whether it has Tomorrow →), Tomorrow → itself, an errand as
 * Hawky keeps it (for checks), and the Shopping tab's add row and its stores (each with its colour and its lists' edges).
 * Errands are found by their ids, lists by their topics. Selectors live here, so a markup change is fixed in one place. */
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
// An errand as Hawky keeps it (deleted ones too).
const item = (tab, id) => tab.page.evaluate(x => Kyoshi.apps.hawky.S.items.find(i => i.id === x) || null, id);

// --- Shopping ---
const showLists = tab => tab.page.click(`${M} #nav [data-view="lists"]`);
// The add row: store, topic and item, then Add.
async function addItem(tab, store, topic, text) {
  const p = tab.page;
  await p.fill(`${M} #listVendor`, store);
  await p.fill(`${M} #listTopic`, topic);
  await p.fill(`${M} #listItem`, text);
  await p.click(`${M} #listAddBtn`);
}
// The stores as shown, each { name, color (its --store), dot (its name's dot, as computed), lists: [{ topic, edge (the left
// border's colour and width, as computed) }] }; colours as the browser computes them ("rgb(20, 184, 166)").
const stores = tab => tab.page.$$eval(`${M} #vendors .vendor`, els => els.map(v => ({
  name: v.querySelector(".vendor-name").textContent, color: v.style.getPropertyValue("--store"),
  dot: getComputedStyle(v.querySelector(".vendor-name"), "::before").backgroundColor,
  lists: [...v.querySelectorAll(".slist")].map(c => ({ topic: c.querySelector(".slist-topic").textContent, edge: `${getComputedStyle(c).borderLeftColor} ${getComputedStyle(c).borderLeftWidth}` }))
})));
// A "#rrggbb" colour as the browser computes it.
const rgb = hex => `rgb(${[1, 3, 5].map(k => parseInt(hex.slice(k, k + 2), 16)).join(", ")})`;

module.exports = { addErrand, chips, status, groups, postpone, item, showLists, addItem, stores, rgb };
