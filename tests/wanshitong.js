/* Kyoshi · tests/wanshitong.js — Wan Shi Tong's screens as the tests read and use them: the add / edit pop-up (opened to
 * add or by a tap on a name; its category pills, a movie's Director and Year row, its boxes, filled in and read back,
 * whether the info box shows and what it asks for, any example text; Add, Add another, Save, Cancel), the line under
 * each name (the name, its muted info, the magnifier's search) in
 * Active media, the backlog and Finished, Start on a backlog line, and an item as Wan Shi Tong keeps it. Items are found
 * by their names. Selectors live here, so a markup change is fixed in one place. */
"use strict";

const M = "#kMount";
const POP = `${M} #itemOverlay`;
// The pop-up's boxes, by what they hold.
const BOX = { name: "#itemName", director: "#itemDirector", year: "#itemYear", info: "#itemInfo", why: "#itemWhy" };
// Where names show: Active media, the backlog's groups, Finished.
const WHERE = { now: "#nowBody", backlog: "#backlogGroups", finished: "#finishedList" };

// Opens the pop-up: to add (no name), or to edit the item by that name (a tap on its name, wherever it shows).
async function openEditor(tab, name = "") {
  await tab.page.click(name ? `${M} [data-act="edit"]:text-is("${name}")` : `${M} #addBtn`);
  await tab.page.waitForSelector(`${POP}.open`);
}
// Fills the pop-up: { cat (a pill's data-cat), name, director, year, info, why }, only what's given, in that order.
async function fill(tab, fields) {
  if (fields.cat) await tab.page.click(`${POP} #itemCats [data-cat="${fields.cat}"]`);
  for (const [k, sel] of Object.entries(BOX)) if (fields[k] !== undefined) await tab.page.fill(`${POP} ${sel}`, fields[k]);
}
// The pop-up's buttons: Add or Save ("save"), Add another ("another"), Cancel ("cancel").
const press = (tab, btn) => tab.page.click(`${POP} #${{ save: "itemSaveBtn", another: "itemAnotherBtn", cancel: "itemCancelBtn" }[btn]}`);
// The pop-up as it reads: { open, cat (its pressed pill), row (whether the Director and Year row shows), name, director,
// year, info, infoShown (whether the info box shows), infoLabel (what it asks for), placeholders (how many of its boxes
// have example text), status (the line under the buttons) }.
const editor = tab => tab.page.evaluate(pop => {
  const o = document.querySelector(pop), $ = id => o.querySelector(`#${id}`);
  return {
    open: o.classList.contains("open"), cat: o.querySelector("#itemCats .active").dataset.cat,
    row: getComputedStyle($("itemMovieRow")).display !== "none",
    name: $("itemName").value, director: $("itemDirector").value, year: $("itemYear").value, info: $("itemInfo").value,
    infoShown: getComputedStyle($("itemInfoField")).display !== "none", infoLabel: $("itemInfoLabel").textContent,
    placeholders: o.querySelectorAll("[placeholder]").length, status: $("itemStatus").textContent
  };
}, POP);

// The names' lines in one place ("now", "backlog" or "finished"), in order: [{ name, info (the muted text after it, a
// "|" between a movie's "Director, Year" and its info), q (what the magnifier searches Google for) }].
const lines = (tab, where) => tab.page.$$eval(`${M} ${WHERE[where]} .name-line`, els => els.map(l => ({
  name: l.querySelector("[data-act=edit]").textContent,
  info: (l.querySelector(".item-info") || { textContent: "" }).textContent,
  q: new URL(l.querySelector(".search-link").href).searchParams.get("q")
})));
// The line of the item by that name, in one place (null when it isn't there).
const line = async (tab, where, name) => (await lines(tab, where)).find(l => l.name === name) || null;

// Start on a backlog line: into Active media.
const start = (tab, name) => tab.page.locator(`${M} #backlogGroups .item`)
  .filter({ has: tab.page.locator(`[data-act="edit"]:text-is("${name}")`) }).locator('[data-act="start"]').click();
// An item as Wan Shi Tong keeps it (by its name; the first if two share it).
const item = (tab, name) => tab.page.evaluate(n => Kyoshi.apps.wanshitong.S.items.find(i => i.name === n) || null, name);

module.exports = { POP, openEditor, fill, press, editor, lines, line, start, item };
