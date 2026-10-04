/* Kyoshi · tests/turtleduck.js — Turtleduck's screens as the tests read and use them: the nav, the plan's grid (cells
 * and their chips, the cart, a day's totals), the sidebar (recipes, the shelf of portions), dragging, copy and paste by
 * the mouse, the picker and a planned meal's pop-up, the recipe pop-up, the grocery lists (rows, ticks, sections, added
 * by hand), the cook view, Times & trips, a week's Confirm and its line about Momo, a day's own time (a meal's, a
 * trip's) and a meal's groceries mark. Selectors live here, so a markup change is fixed in one place. */
"use strict";

const view = async (tab, v) => { await tab.page.click(`#kMount #nav [data-view="${v}"]`); await tab.page.waitForSelector(`#kMount #${v}View:not([hidden])`); };
const week = (tab, w) => tab.page.click(`#kMount #weekToggle [data-week="${w}"]`);
const cell = (date, meal) => `#kMount #planGrid .cell[data-date="${date}"][data-meal="${meal}"]`;
const flat = s => s.replace(/\s+/g, " ").trim();
// A cell's chips, each its name ("Chili"), in order.
const chips = (tab, date, meal) => tab.page.$$eval(`${cell(date, meal)} .chip`, els => els.map(e => e.querySelector(".chip-name").innerText.trim()));
// A chip by name in a cell (the first with it).
const chip = (date, meal, name) => `${cell(date, meal)} .chip:has(.chip-name:text-is("${name}"))`;
// The shelf: "Chili · 3 left · Mon", in order.
const shelf = tab => tab.page.$$eval("#kMount #sideShelf .chip", els => els.map(e => e.innerText.replace(/\s+/g, " ").trim()));
// A day's totals under its column, as one line ("1,170 kcal P 65 · C 110 …"), and which parts are past a target.
async function totals(tab, date) {
  const i = await tab.page.$$eval("#kMount #planGrid .day-head", (els, d) => els.findIndex(e => e.querySelector(".cart").dataset.date === d), date);
  const box = tab.page.locator("#kMount #planGrid .tot").nth(i);
  return { text: flat(await box.innerText()), warn: await box.locator(".warn").allInnerTexts() };
}

// Dragging with the mouse (the browser's drag and drop).
const dragRecipe = (tab, id, date, meal) => tab.page.locator(`#kMount #sideRecipes .side-recipe[data-id="${id}"]`).dragTo(tab.page.locator(cell(date, meal)));
const dragPortion = (tab, text, date, meal) => tab.page.locator(`#kMount #sideShelf .chip:has-text("${text}")`).first().dragTo(tab.page.locator(cell(date, meal)));
const dragChip = (tab, from, name, date, meal) => tab.page.locator(chip(from.date, from.meal, name)).first().dragTo(tab.page.locator(cell(date, meal)));

// Copy, cut and paste: the mouse over a chip or cell, then the keys.
async function key(tab, selector, combo) {
  await tab.page.hover(selector, { position: { x: 12, y: 8 } });
  await tab.page.keyboard.press(combo);
}

// The picker on a cell (its +), then a pick.
async function openPicker(tab, date, meal) {
  await tab.page.click(`${cell(date, meal)} .cell-add`);
  await tab.page.waitForSelector("#kMount #pickOverlay.open");
}
const pickRecipe = (tab, name) => tab.page.click(`#kMount #pickList [data-pick="recipe"]:has(.pi-name:text-is("${name}"))`);
const pickPortion = (tab, name) => tab.page.click(`#kMount #pickList [data-pick="portion"]:has(.pi-name:text-is("${name}"))`);
// The picker's headings and items, as shown ("LEFTOVERS", "Chili · 3 left · cooked Mon", …).
const pickList = tab => tab.page.$$eval("#kMount #pickList > *", els => els.map(e => (e.matches(".pick-item") ? [".pi-name", ".pi-meta"].map(c => e.querySelector(c)).filter(Boolean).map(x => x.innerText.trim()).join(" ") : e.innerText.trim())));
async function quickMeal(tab, kind, name, nums = {}) {
  const f = kind === "quick" ? "quick" : "out", p = tab.page;
  await p.click(`#kMount #${kind === "quick" ? "quickBox" : "outBox"} > summary`);
  if (name) await p.fill(`#kMount #${f}Text`, name);
  for (const [k, v] of Object.entries(nums)) await p.fill(`#kMount #${f}${k[0].toUpperCase()}${k.slice(1)}`, String(v));
  await p.click(`#kMount #${f === "quick" ? "quickForm" : "outForm"} button[type="submit"]`);
}

// A planned meal's pop-up: open it by its chip, read it, use it.
async function openEntry(tab, date, meal, name) {
  await tab.page.click(chip(date, meal, name));
  await tab.page.waitForSelector("#kMount #entryOverlay.open");
}
const entryText = async tab => flat(await tab.page.locator("#kMount #entryOverlay .modal").innerText());
const entryAct = (tab, act, extra = "") => tab.page.click(`#kMount #entryOverlay [data-entry="${act}"]${extra}`);
const closeEntry = tab => tab.page.click("#kMount #entryDoneBtn");

// The recipe pop-up: fill in what's given ({ name, meal, servings, prep, cook, kcal, protein, carbs, fat, fiber, link,
// ingredients: [lines], steps }).
async function fillRecipe(tab, r) {
  const p = tab.page, ids = { name: "recipeName", servings: "recipeServings", prep: "recipePrep", cook: "recipeCook", kcal: "recipeKcal", protein: "recipeProtein", carbs: "recipeCarbs", fat: "recipeFat", fiber: "recipeFiber", link: "recipeLink", steps: "recipeSteps" };
  for (const [k, id] of Object.entries(ids)) if (r[k] !== undefined) await p.fill(`#kMount #${id}`, String(r[k]));
  if (r.ingredients) await p.fill("#kMount #recipeIngredients", r.ingredients.join("\n"));
  if (r.meal) await p.click(`#kMount #recipeTypes [data-type="${r.meal}"]`);
}
// The Recipes view's rows: "Chili · 650 kcal · …", by group heading.
const recipeRows = (tab, box = "recipeGroups") => tab.page.$$eval(`#kMount #${box} .recipe-row .rr-main`, els => els.map(e => [".rr-name", ".rr-meta"].map(c => e.querySelector(c).textContent.trim()).filter(Boolean).join(" · ")));
// A chip as words: "Chili 650 · P 45".
const chipWords = (tab, selector) => tab.page.$eval(selector, e => [".chip-name", ".chip-meta"].map(c => e.querySelector(c)).filter(Boolean).map(x => x.innerText.trim()).join(" "));

// The grocery lists: each { title, meta, count, sections, rows: ["1.4 kg rice · Chili, Fried rice · Pantry"], bought: [...] }
// (the words as written: Bought may be folded).
async function lists(tab) {
  return tab.page.$$eval("#kMount #lists .g-list", els => els.map(l => {
    const words = (el, sel) => el.querySelector(sel).textContent.trim();
    const row = r => [words(r, ".g-what"), words(r, ".g-for, .g-tag"), r.querySelector("select") ? r.querySelector("select").value : "by hand"].filter(Boolean).join(" · ");
    return {
      id: l.dataset.list, title: words(l, ".g-title"), meta: words(l, ".g-meta"), count: words(l, ".g-count"),
      sections: [...l.querySelectorAll(":scope > .g-head-sec")].map(h => h.textContent.trim()),
      rows: [...l.querySelectorAll(":scope > .g-row")].map(row), bought: [...l.querySelectorAll(".g-bought .g-row")].map(row)
    };
  }));
}
// Ticks a row (by its words, "1.4 kg rice") in a list ("now" or a trip's day).
const tickRow = (tab, list, what) => tab.page.click(`#kMount .g-list[data-list="${list}"] .g-row:has(.g-what:text-is("${what}")) .g-box`);
// Opens a list's Bought fold (it stays as left through redraws).
async function openBought(tab, list) {
  const fold = tab.page.locator(`#kMount .g-list[data-list="${list}"] .g-bought`);
  if (!(await fold.evaluate(el => el.open))) await fold.locator(":scope > summary").click();
}
const setSection = (tab, list, what, section) => tab.page.selectOption(`#kMount .g-list[data-list="${list}"] .g-row:has(.g-what:text-is("${what}")) select`, section);
const cart = (tab, date) => tab.page.click(`#kMount #planGrid .cart[data-date="${date}"]`);

// The cook view as shown: name, meta line, ingredients, steps (paragraphs and bullets), the pager.
async function cook(tab) {
  const p = tab.page;
  await p.waitForSelector("#kMount #cookView:not([hidden])");
  return {
    name: await p.locator("#kMount .cook-name").innerText(),
    meta: await p.locator("#kMount .cook-meta").first().innerText(),
    ingredients: await p.$$eval("#kMount .cook-ings li", els => els.map(e => e.innerText.trim())),
    steps: await p.$$eval("#kMount .cook-steps p, #kMount .cook-steps li", els => els.map(e => `${e.tagName === "LI" ? "• " : ""}${e.innerText.trim()}`)),
    pager: flat(await p.locator("#kMount #cookPager").innerText())
  };
}

// The data, read from the page (counts and shapes only; the tests' own made-up data).
const S = (tab, fn) => tab.page.evaluate(fn);
const entries = tab => S(tab, () => Kyoshi.apps.turtleduck.liveEntries().map(e => ({ id: e.id, date: e.date, meal: e.meal, kind: e.kind, name: Kyoshi.apps.turtleduck.nameOf(e), leftover: e.leftover, from: e.from, scale: e.scale, servings: e.servings })));

// --- Times & trips, a week confirmed for Momo, a day's own time, a trip's, a meal's groceries ---
// Times & trips: opened from the ⋯ menu (a computer) or Groceries → Settings ("settings": a phone).
async function openTimes(tab, via = "menu") {
  const p = tab.page;
  if (via === "menu") {
    await view(tab, "plan");
    await p.click("#kMount #menuBtn");
    await p.click('#kMount #planMenu [data-act="times"]');
  } else {
    await view(tab, "groceries");
    if (!(await p.locator("#kMount #settingsBox").evaluate(el => el.open))) await p.click("#kMount #settingsBox > summary");
    await p.click('#kMount #settingsBox [data-act="times"]');
  }
  await p.waitForSelector("#kMount #timesOverlay.open");
}
// The pop-up as filled in: { breakfast, lunch, dinner, cook, trip (times), lengths: { breakfast, lunch, dinner }, trips: [[weekday 0–6, time]], status }.
const times = tab => tab.page.evaluate(() => {
  const $ = s => document.querySelector(`#kMount ${s}`), v = id => $(`#${id}`).value;
  return {
    breakfast: v("time_breakfast"), lunch: v("time_lunch"), dinner: v("time_dinner"), cook: v("time_cook"), trip: v("time_trip"),
    lengths: { breakfast: +v("len_breakfast"), lunch: +v("len_lunch"), dinner: +v("len_dinner") },
    trips: [...document.querySelectorAll("#kMount #tripRows .trip-row")].map(r => [+r.querySelector("select").value, r.querySelector("input").value]),
    status: $("#timesStatus").textContent.trim()
  };
});
// Fills the pop-up ({ breakfast, …, lengths: { … }, trips: [[weekday, time]] }: what's given), then Save; whether it closed.
async function setTimes(tab, f, save = true) {
  const p = tab.page;
  for (const k of ["breakfast", "lunch", "dinner", "cook", "trip"]) if (f[k] !== undefined) await p.fill(`#kMount #time_${k}`, f[k]);
  for (const [k, n] of Object.entries(f.lengths || {})) await p.fill(`#kMount #len_${k}`, String(n));
  if (f.trips) {
    while (await p.locator("#kMount #tripRows [data-trip-remove]").count()) await p.click("#kMount #tripRows [data-trip-remove] >> nth=0");
    for (const [day, time] of f.trips) {
      await p.click("#kMount #tripAddBtn");
      const row = p.locator("#kMount #tripRows .trip-row").last();
      await row.locator("select").selectOption(String(day));
      await row.locator("input").fill(time);
    }
  }
  if (!save) return true;
  await p.click("#kMount #timesSaveBtn");
  return !(await p.locator("#kMount #timesOverlay").evaluate(el => el.classList.contains("open")));
}
// The plan bar's Confirm for the week on screen (week(tab, w) first), or a phone's list's for this or next week.
async function confirmWeek(tab, which = "this") {
  const p = tab.page;
  if (await p.locator("#kMount #planBar").isVisible()) {
    await week(tab, which);
    await p.click("#kMount #confirmBtn");
  } else await p.click(`#kMount #planList .week-head [data-act="confirm-week"][data-week="${which}"]`);
}
// Where the weeks stand with Momo: { this, next: the tabs' words after the dates, line: the bar's line, heads: a phone's list's lines }.
const weekStatus = tab => tab.page.evaluate(() => {
  const sub = w => document.querySelector(`#kMount #weekSub_${w}`).textContent.split(" · ").pop();
  return { this: sub("this"), next: sub("next"), line: document.querySelector("#kMount #momoLine").textContent.trim(), heads: [...document.querySelectorAll("#kMount #planList .week-status")].map(e => e.textContent.trim()) };
});
// The meal's pop-up's time row (open it first): { label, time, usual: the Usual button's words or "" } (null without one).
const entryTime = tab => tab.page.evaluate(() => {
  const row = document.querySelector("#kMount #entryBody .entry-time");
  if (!row) return null;
  const u = row.querySelector('[data-entry="time-usual"]');
  return { label: row.querySelector("label").textContent.trim(), time: row.querySelector("input").value, usual: u ? u.textContent.trim() : "" };
});
// Types a time into the meal's pop-up, then Enter (a time field keeps Tab for its own parts): kept once it's left;
// Usual puts it back.
async function setEntryTime(tab, time) {
  await tab.page.fill("#kMount #entryTime", time);
  await tab.page.press("#kMount #entryTime", "Enter");
}
const entryTimeUsual = tab => tab.page.click('#kMount #entryBody [data-entry="time-usual"]');
// A trip's time on its list (Groceries): { time, usual: whether Usual shows }; set: typed, then the field left.
const tripTime = (tab, date) => tab.page.evaluate(d => {
  const l = document.querySelector(`#kMount .g-list[data-list="${d}"]`);
  return l ? { time: l.querySelector("[data-trip-time]").value, usual: !!l.querySelector('[data-act="trip-time-usual"]') } : null;
}, date);
async function setTripTime(tab, date, time) {
  const f = `#kMount .g-list[data-list="${date}"] [data-trip-time]`;
  await tab.page.fill(f, time);
  await tab.page.press(f, "Enter");
}
// A chip's groceries mark on the grid: "none" (amber: no trip before it), "unbought" (red) or "" — and its words.
const coverage = (tab, date, meal, name) => tab.page.$eval(chip(date, meal, name), e => ({
  mark: e.classList.contains("nocover") ? "none" : e.classList.contains("unbought") ? "unbought" : "",
  meta: [".chip-meta", ".chip-shop"].map(c => e.querySelector(c)).filter(Boolean).map(x => x.textContent).join(" · ")
}));
// The carts on the grid's days: { date: time or "" when off }.
const carts = tab => tab.page.$$eval("#kMount #planGrid .cart", els => Object.fromEntries(els.map(b => [b.dataset.date, b.classList.contains("on") ? (b.querySelector(".cart-time") || {}).textContent || "" : ""])));

module.exports = {
  view, week, cell, chips, chip, shelf, totals, dragRecipe, dragPortion, dragChip, key, openPicker, pickRecipe, pickPortion, pickList, quickMeal,
  openEntry, entryText, entryAct, closeEntry, fillRecipe, recipeRows, chipWords, lists, tickRow, openBought, setSection, cart, cook, entries,
  openTimes, times, setTimes, confirmWeek, weekStatus, entryTime, setEntryTime, entryTimeUsual, tripTime, setTripTime, coverage, carts
};
