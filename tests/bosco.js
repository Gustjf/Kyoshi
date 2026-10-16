/* Kyoshi · tests/bosco.js — Bosco's screens as the tests read and use them: History's rows, the upcoming doses' cards
 * and sites, the dose pop-up, start-up info (shown, saved), a weigh-in typed in, a day deleted, the bug report's lines,
 * a reload; and its data as kept (`saved`, without a download: Export itself is lib.js's exportBackup) and as sync's
 * combine takes another device's save (`combine`). Selectors live here, so a markup change is fixed in one place. */
"use strict";
const { TODAY, addDays } = require("./lib");

const M = "#kMount";
const D = n => addDays(TODAY, n);

// --- History: [date, dose] per row (the dose cell's text, "5 mg|Abd R upper" with a site); weights: the weigh-ins shown ---
const history = tab => tab.page.$$eval(`${M} #historyBody tr:not(.blank)`, rows => rows.map(r => [r.cells[0].textContent.trim(), r.cells[3].innerText.trim()]));
const weights = tab => tab.page.$$eval(`${M} #historyBody tr:not(.blank)`, rows => rows.map(r => r.cells[1].textContent.trim()));
// A weigh-in typed in (date and weight), then Add (or Enter in the weight field).
async function weighIn(tab, date, weight, { enter = false } = {}) {
  await tab.page.fill(`${M} #dateInput`, date);
  await tab.page.fill(`${M} #weightInput`, String(weight));
  await (enter ? tab.page.press(`${M} #weightInput`, "Enter") : tab.page.click(`${M} #addBtn`));
}
// History's Delete on a day (it asks: tab.answers says what to answer).
const remove = (tab, date) => tab.page.click(`${M} #historyBody button[data-date="${date}"]`);

// --- Upcoming doses: each card's site ("" for none); the cards [weekday, date, dose line, due] ---
const cardSites = tab => tab.page.$$eval(`${M} #upcomingDosesGrid .stat`, cards => cards.map(c => (c.querySelector(".lbl.site") || { textContent: "" }).textContent));
const doseCards = tab => tab.page.$$eval(`${M} #upcomingDosesGrid .stat:has(.dose)`,
  cards => cards.map(c => [c.querySelector(".val").textContent, c.querySelector(".lbl").textContent, c.querySelector(".dose").textContent, c.classList.contains("due")]));
// The dose pop-up: open, its text, its buttons shown, the site field shown, the site picked, and the site menu's groups
// [label, [sites]] (the parts', then Other).
const dosePopup = tab => tab.page.evaluate(m => {
  const o = document.querySelector(`${m} #doseOverlay`), sel = o.querySelector("#doseSiteSelect"), text = el => el.textContent;
  return {
    open: o.classList.contains("open"), text: text(o.querySelector("#doseModalText")),
    buttons: [...o.querySelectorAll(".modal-actions button")].filter(b => !b.hidden).map(text),
    shown: !o.querySelector("#doseSiteField").hidden, picked: sel.selectedOptions[0] ? text(sel.selectedOptions[0]) : "",
    groups: [...sel.children].map(g => [g.label, [...g.children].map(text)])
  };
}, M);

// --- Start-up info: [shown, the dosing shown]; saved (naming you first if it asks: a made-up name); opened to edit it all ---
const startupShown = tab => tab.page.evaluate(m => [!document.querySelector(`${m} #oneTimeInfoSection`).hidden, !document.querySelector(`${m} #dosingBox`).hidden], M);
async function saveStartup(tab) {
  const name = tab.page.locator(`${M} #oneTimeInput_name`);
  if (await name.count()) await name.fill("Sam");
  await tab.page.click(`${M} #oneTimeInfoSaveBtn`);
}
const editStartup = tab => tab.page.evaluate(() => Kyoshi.apps.bosco.renderOneTimeInfo(true));

// --- The bug report's line starting with `start` ---
const bugLine = (tab, start) => tab.page.evaluate(s => Kyoshi.apps.bosco.bugState().find(l => l.startsWith(s)), start);

// --- Reload: the page again, once Bosco has started ---
async function reload(tab) {
  await tab.page.reload();
  await tab.page.waitForFunction(() => window.Kyoshi && Kyoshi.ready && Kyoshi.apps.bosco.started);
}

// --- Data ---
// Bosco's data as Export would write it (A.data.build()), read without a download.
const saved = tab => tab.page.evaluate(() => JSON.parse(JSON.stringify(Kyoshi.apps.bosco.data.build())));
// Sync's combine of another device's save: this device's own (saved), changed by edit (in Node: raw => { … }), as a save
// from device b (savedAt "2"; `mine` "1" by default: this device saved earlier) or, with replace, taken whole. Applied as
// sync applies it; returns [same, changed].
async function combine(tab, edit = () => {}, { replace = false, mine = "1" } = {}) {
  const raw = await saved(tab);
  edit(raw);
  return tab.page.evaluate(([raw, replace, mine]) => {
    const A = Kyoshi.apps.bosco, c = A.data.combine(raw, { replace, plain: false, mine: { savedAt: mine, device: "a" }, theirs: { savedAt: "2", device: "b" } });
    const changed = c.apply();
    if (changed) A.data.afterSync();
    return [c.same, changed];
  }, [raw, replace, mine]);
}

module.exports = { M, D, history, weights, weighIn, remove, cardSites, doseCards, dosePopup, startupShown, saveStartup, editStartup, bugLine, reload, saved, combine };
