/* Kyoshi · tests/pabu.js — Pabu's screens as the tests read and use them: the list's groups (each person as one line)
 * and their heads, the Birthdays strip, quick add with its chips and status line, ✓, the person pop-up (its fields and
 * the days you talked, read and filled in), and the flash Momo's "Open in Pabu" leaves. Selectors live here, so a markup
 * change is fixed in one place. */
"use strict";

// The list by group: { "Due now": ["Mom · Call · every month · last talked 5 weeks ago · overdue 4 days · 🎂 Oct 12 · turns
// 60", …], "Coming up": […], "Later": […] } (only the groups shown).
const groups = tab => tab.page.$$eval("#kMount #groups .group", els => Object.fromEntries(els.map(g => [
  g.querySelector(".group-title").textContent.trim(),
  [...g.querySelectorAll(".person")].map(r => [".person-name", ".person-meta", ".person-bday"].map(c => r.querySelector(c)).filter(Boolean)
    .map(x => x.textContent.replace(/\s+/g, " ").trim()).join(" · "))
])));
// Each group's head: { "Due now": "3 · 3h", … } (how many, and their time).
const heads = tab => tab.page.$$eval("#kMount #groups .group", els => Object.fromEntries(els.map(g => [g.querySelector(".group-title").textContent.trim(), g.querySelector(".group-sum").textContent.trim()])));
// A person's row as one line (as in groups), or "" when they're not on the list.
async function row(tab, id) {
  const all = Object.values(await groups(tab)).flat(), name = await tab.page.$eval(`#kMount .person[data-id="${id}"] .person-name`, e => e.textContent.trim()).catch(() => null);
  return name === null ? "" : all.find(line => line.startsWith(`${name} · `)) || "";
}
// The Birthdays strip: ["Kai · Oct 1 · tomorrow", "Mom · Oct 12 · in 12 days · turns 60"]; [] while it's hidden.
async function birthdays(tab) {
  if (await tab.page.locator("#kMount #bdaySection").isHidden()) return [];
  return tab.page.$$eval("#kMount #bdayList .bday", els => els.map(e => `${e.querySelector(".bday-name").textContent.trim()} · ${e.querySelector(".bday-when").textContent.trim()}`));
}

// Quick add: the name, the chips given ({ every: "week", how: "text" }), then Add (or Enter in the field).
async function quickAdd(tab, name, { every, how, enter = false } = {}) {
  const p = tab.page;
  await p.fill("#kMount #addName", name);
  if (every) await p.click(`#kMount #addEvery [data-every="${every}"]`);
  if (how) await p.click(`#kMount #addHow [data-how="${how}"]`);
  if (enter) await p.press("#kMount #addName", "Enter");
  else await p.click("#kMount #addBtn");
}
// Quick add as it is: the chips pressed, the field, whether it has the focus, and the line under it.
const addState = tab => tab.page.evaluate(() => {
  const $ = id => document.querySelector(`#kMount #${id}`), pressed = box => [...$(box).querySelectorAll(".active")].map(b => b.dataset.every || b.dataset.how);
  return { every: pressed("addEvery"), how: pressed("addHow"), name: $("addName").value, focused: document.activeElement === $("addName"), status: $("addStatus").textContent };
});

// ✓ on a person's row: talked today (again: undo).
const tick = (tab, id) => tab.page.click(`#kMount .person[data-id="${id}"] .tick`);

// The pop-up, opened by tapping the name.
async function openPerson(tab, id) {
  await tab.page.click(`#kMount .person[data-id="${id}"] .person-name`);
  await tab.page.waitForSelector("#kMount #personOverlay.open");
}
const isOpen = tab => tab.page.locator("#kMount #personOverlay").evaluate(el => el.classList.contains("open"));
// The pop-up as it is: its fields' values, the days you talked (as shown) and the line under them.
const popup = tab => tab.page.evaluate(() => {
  const $ = id => document.querySelector(`#kMount #${id}`);
  return {
    name: $("personName").value, every: $("personEvery").value, how: $("personHow").value, minutes: $("personMinutes").value,
    month: $("personBdayMonth").value, day: $("personBdayDay").value, year: $("personBdayYear").value, note: $("personNote").value,
    talks: [...$("personTalks").querySelectorAll("li")].map(li => (li.querySelector("span") || li).textContent.trim()),
    hint: $("personHint").hidden ? "" : $("personHint").textContent
  };
});
// Fills in the pop-up's fields given ({ name, every, how, minutes, month, day, year, note }); month by its number ("10").
async function fill(tab, f) {
  const p = tab.page, ids = { name: "personName", minutes: "personMinutes", day: "personBdayDay", year: "personBdayYear", note: "personNote" };
  for (const k of ["every", "how", "month"]) if (f[k] !== undefined) await p.selectOption(`#kMount #person${{ every: "Every", how: "How", month: "BdayMonth" }[k]}`, String(f[k]));
  for (const [k, id] of Object.entries(ids)) if (f[k] !== undefined) await p.fill(`#kMount #${id}`, String(f[k]));
}
// Adds a day you talked ("YYYY-MM-DD") with Add a day (or Enter in its field); removes one by its ✕.
async function addTalk(tab, day, { enter = false } = {}) {
  await tab.page.fill("#kMount #personTalkDate", day);
  if (enter) await tab.page.press("#kMount #personTalkDate", "Enter");
  else await tab.page.click("#kMount #personTalkAdd");
}
const removeTalk = (tab, day) => tab.page.click(`#kMount #personTalks [data-act="talk-remove"][data-day="${day}"]`);
const save = tab => tab.page.click('#kMount #personForm button[type="submit"]');

// Whether a person's row is flashing (Momo's "Open in Pabu").
const isFlashing = (tab, id) => tab.page.locator(`#kMount .person[data-id="${id}"]`).evaluate(el => el.classList.contains("flash"));

module.exports = { groups, heads, row, birthdays, quickAdd, addState, tick, openPerson, isOpen, popup, fill, addTalk, removeTalk, save, isFlashing };
