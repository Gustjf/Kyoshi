/* Kyoshi · tests/pabu.js — Pabu's screens as the tests read and use them: This week (a line per call, text or visit due,
 * its ✓, the count, the red ones), quick add with its chips and status line, the Birthdays strip, People (the group chips,
 * a line per person), the person pop-up (its fields, a box per call, text or visit with the days you talked, what Save
 * said above it and the fields it marked: read, filled in, saved, cancelled, deleted), Set up (Developer Mode's: who
 * you're with and the anniversary), the flash Momo's "Open in Pabu" leaves, and a person as Pabu keeps them (for checks).
 * Lines are found by what they say ("Call Mom", "Mom"), as the user finds them. Selectors live here, so a markup change
 * is fixed in one place. */
"use strict";
const { devPanel } = require("./lib");

const M = "#kMount";

// --- This week ---
// As shown: { count: "1 of 4 done" ("4"; "" for none), lines: a ticked one with "✓ " first ["✓ Text Sam · talked yesterday ·
// 10m", "Visit Gran · overdue 9 days · 2h"], late: the red ones' titles, empty: "No one's due this week." while it says so };
// null while it's hidden (no one has a call, text or visit).
const thisWeek = tab => tab.page.evaluate(() => {
  const $ = id => document.querySelector(`#kMount #${id}`), flat = s => s.replace(/\s+/g, " ").trim();
  if ($("weekSection").hidden) return null;
  const rows = [...$("weekList").querySelectorAll(".due-row")];
  return {
    count: $("weekCount").textContent.trim(),
    lines: rows.map(li => `${li.classList.contains("done") ? "✓ " : ""}${flat(li.querySelector(".row-title").textContent)} · ${flat(li.querySelector(".row-meta").textContent)}`),
    late: rows.filter(li => li.classList.contains("overdue")).map(li => flat(li.querySelector(".row-title").textContent)),
    empty: $("weekEmpty").hidden ? "" : flat($("weekEmpty").textContent)
  };
});
const weekLine = title => `${M} #weekList .due-row:has(.row-title:text-is("${title}"))`;
// ✓ on This week's line for a call, text or visit ("Call Mom"): talked today; on a ticked one, that day taken off.
const tick = (tab, title) => tab.page.click(`${weekLine(title)} .tick`);

// --- Quick add ---
// The name, then the chips given ({ every: "week", how: "text" }), then Add (or Enter in the field; add: false stops before).
async function quickAdd(tab, name, { every, how, enter = false, add = true } = {}) {
  const p = tab.page;
  await p.fill(`${M} #addName`, name);
  if (every) await p.click(`${M} #addEvery [data-every="${every}"]`);
  if (how) await p.click(`${M} #addHow [data-how="${how}"]`);
  if (add) await submitAdd(tab, { enter });
}
const submitAdd = (tab, { enter = false } = {}) => (enter ? tab.page.press(`${M} #addName`, "Enter") : tab.page.click(`${M} #addBtn`));
// Quick add as it is: the chips pressed, the field, whether it has the focus (the phone's keyboard up), and the line under
// it (bad: said in red).
const addState = tab => tab.page.evaluate(() => {
  const $ = id => document.querySelector(`#kMount #${id}`), pressed = box => [...$(box).querySelectorAll(".active")].map(b => b.dataset.every || b.dataset.how);
  return { every: pressed("addEvery"), how: pressed("addHow"), name: $("addName").value, focused: document.activeElement === $("addName"), status: $("addStatus").textContent, bad: $("addStatus").classList.contains("bad") };
});

// --- The Birthdays strip: ["Kai · Oct 1 · tomorrow", "♥ Mom · Oct 4 · in 4 days · 5 years" (the anniversary), "Mom · Oct 12 ·
// in 12 days · turns 60"]; [] while it's hidden. Its heading: "Birthdays & Anniversary", "Anniversary" or "Birthdays" ---
async function birthdays(tab) {
  if (await tab.page.locator(`${M} #bdaySection`).isHidden()) return [];
  return tab.page.$$eval(`${M} #bdayList .bday`, els => els.map(e => `${e.classList.contains("anniv") ? "♥ " : ""}${e.querySelector(".bday-name").textContent.trim()} · ${e.querySelector(".bday-when").textContent.trim()}`));
}
const stripTitle = tab => tab.page.$eval(`${M} #bdayTitle`, e => e.textContent.trim());

// --- People ---
// A line per person as listed: "Mom · Family · Call monthly · overdue 4 days · 🎂 Oct 12 · turns 60" (name, group, their
// calls, texts and visits with the next due, birthday); the one you're with "Mom ♥ · … · ♥ Oct 4 · 5 years" (a heart by
// the name, the anniversary last).
const people = tab => tab.page.$$eval(`${M} #roster .person`, els => els.map(li => [".person-name", ".person-group", ".person-meta", ".person-bday", ".person-anniv"]
  .map(c => li.querySelector(c)).filter(Boolean).map(e => [...e.childNodes].map(n => (n.nodeName === "svg" ? "♥" : n.textContent)).join("").replace(/\s+/g, " ").trim()).join(" · ")));
// Just the names listed.
const names = async tab => (await people(tab)).map(line => line.split(" · ")[0]);
// The heading's count ("7"; "" for none) and the empty list's words ("" while hidden).
const peopleHead = tab => tab.page.evaluate(() => {
  const $ = id => document.querySelector(`#kMount #${id}`);
  return { count: $("peopleCount").textContent.trim(), empty: $("listEmpty").hidden ? "" : $("listEmpty").textContent.trim() };
});
// The group chips: { shown: ["All", "Family", "No group"], on: the pressed one } ({ shown: [], on: null } while hidden).
const chips = tab => tab.page.evaluate(() => {
  const box = document.querySelector("#kMount #groupChips"), all = box.hidden ? [] : [...box.querySelectorAll(".chip")];
  const on = all.find(b => b.classList.contains("active") && b.getAttribute("aria-pressed") === "true");
  return { shown: all.map(b => b.textContent.trim()), on: on ? on.textContent.trim() : null };
});
const pickChip = (tab, label) => tab.page.click(`${M} #groupChips .chip:text-is("${label}")`);

// --- The person pop-up ---
// Opened by tapping their line on People (from: "week", a line's name on This week ("Call Mom"); "birthdays", the strip).
async function openPerson(tab, name, from = "people") {
  const at = {
    people: `${M} #roster .person:has(.person-name:text-is("${name}")) .person-row`,
    week: `${weekLine(name)} .row-title`,
    birthdays: `${M} #bdayList .bday-name:text-is("${name}")`
  }[from];
  await tab.page.click(at);
  await tab.page.waitForSelector(`${M} #personOverlay.open`);
}
const isOpen = tab => tab.page.locator(`${M} #personOverlay`).evaluate(el => el.classList.contains("open"));
// The pop-up as it is: its fields, the groups it offers, a box per call, text or visit ({ how, every, minutes, last: "Last
// talked 5 weeks ago · overdue 4 days", talks: ["Aug 26"], hint: the line under its "Talked on" }), none: "Birthday only"
// shows, more: "+ Add a call, text or visit" shows.
const popup = tab => tab.page.evaluate(() => {
  const $ = id => document.querySelector(`#kMount #${id}`), shown = el => (el.hidden ? "" : el.textContent.trim());
  return {
    name: $("personName").value, group: $("personGroup").value, offered: [...$("personGroupList").options].map(o => o.value),
    month: $("personBdayMonth").value, day: $("personBdayDay").value, year: $("personBdayYear").value, note: $("personNote").value,
    boxes: [...$("personCadences").querySelectorAll(".cadence")].map(b => ({
      how: b.querySelector(".c-how").value, every: b.querySelector(".c-every").value, minutes: b.querySelector(".c-minutes").value,
      last: b.querySelector(".cadence-last").textContent.trim(), talks: b.querySelector(".talks").hidden ? [] : [...b.querySelectorAll(".talks li > span")].map(s => s.textContent.trim()),
      hint: shown(b.querySelector(".talk-hint"))
    })),
    none: !$("personNoCadence").hidden, more: !$("personCadenceAdd").hidden
  };
});
// The pop-up's form as Save left it: the line above Save, whether it was said once saved (not as a problem), the fields
// marked and the one with the focus, by name ("name", "group", "month", "day", "year", "note"; in a box "minutes 1",
// "talked on 1", box 1 the first; "" for anything else).
const formSaid = tab => tab.page.evaluate(() => {
  const form = document.querySelector("#kMount #personForm"), hint = form.querySelector("#personHint"), boxes = [...form.querySelectorAll(".cadence")];
  const ids = { personName: "name", personGroup: "group", personBdayMonth: "month", personBdayDay: "day", personBdayYear: "year", personNote: "note" };
  const named = el => {
    if (!el || !form.contains(el)) return "";
    const box = el.closest(".cadence"), what = el.matches(".c-minutes") ? "minutes" : el.matches(".c-day") ? "talked on" : "";
    return ids[el.id] || (box && what ? `${what} ${boxes.indexOf(box) + 1}` : "");
  };
  return { hint: hint.hidden ? "" : hint.textContent, saved: hint.classList.contains("saved"), marked: [...form.querySelectorAll("[aria-invalid]")].map(named), focus: named(document.activeElement) };
});
// What Save said: { hint ("" while hidden), saved, marked }.
const said = async tab => { const { hint, saved, marked } = await formSaid(tab); return { hint, saved, marked }; };
// The field with the focus, by name.
const focused = async tab => (await formSaid(tab)).focus;
// Whether the line above Save is in view: within the window and the pop-up as it's scrolled.
const hintInView = tab => tab.page.evaluate(() => {
  const r = document.querySelector("#kMount #personHint").getBoundingClientRect(), m = document.querySelector("#kMount #personOverlay .modal").getBoundingClientRect();
  return r.height > 0 && r.top >= Math.max(0, m.top) && r.bottom <= Math.min(window.innerHeight, m.bottom);
});
// Fills in the fields given ({ name, group, month ("10"; "" for —), day, year, note }); the month first, as it clears the day
// and year when set to —.
async function fill(tab, f) {
  const p = tab.page, ids = { name: "personName", group: "personGroup", day: "personBdayDay", year: "personBdayYear", note: "personNote" };
  if (f.month !== undefined) await p.selectOption(`${M} #personBdayMonth`, String(f.month));
  for (const [k, id] of Object.entries(ids)) if (f[k] !== undefined) await p.fill(`${M} #${id}`, String(f[k]));
}
// A call, text or visit's box (1 for the first): its how, how often and minutes, as given ({ how, every, minutes }).
const box = n => `${M} #personCadences .cadence:nth-child(${n})`;
async function setBox(tab, n, { how, every, minutes } = {}) {
  const p = tab.page;
  if (minutes !== undefined) await p.fill(`${box(n)} .c-minutes`, String(minutes));
  if (how) await p.selectOption(`${box(n)} .c-how`, how);
  if (every) await p.selectOption(`${box(n)} .c-every`, every);
}
const addBox = tab => tab.page.click(`${M} #personCadenceAdd`);
const removeBox = (tab, n) => tab.page.click(`${box(n)} [data-act="cadence-remove"]`);
// A box's "Talked on": a day ("YYYY-MM-DD") picked, then Add (or Enter there; add: false leaves it picked).
async function talkedOn(tab, n, day, { enter = false, add = true } = {}) {
  const p = tab.page;
  await p.fill(`${box(n)} .c-day`, day);
  if (enter) await p.press(`${box(n)} .c-day`, "Enter");
  else if (add) await p.click(`${box(n)} [data-act="talk-add"]`);
}
// Typed into a box's "Talked on" as from the keyboard ("09": a day not finished).
async function typeTalk(tab, n, keys) {
  await tab.page.click(`${box(n)} .c-day`);
  await tab.page.keyboard.type(keys);
}
const removeTalk = (tab, n, day) => tab.page.click(`${box(n)} [data-act="talk-remove"][data-day="${day}"]`);
// Save (or Enter in the name field, enter: true).
const save = (tab, { enter = false } = {}) => (enter ? tab.page.press(`${M} #personName`, "Enter") : tab.page.click(`${M} #personForm button[type="submit"]`));
const cancel = tab => tab.page.click(`${M} #personCancelBtn`);
const remove = tab => tab.page.click(`${M} #personDeleteBtn`);

// --- Set up (Developer Mode's Set up…): who you're in a relationship with, and the anniversary ---
async function openSetup(tab) {
  await devPanel(tab, true);
  await tab.page.click("#kDevAppTools #pabuSetupBtn");
  await tab.page.waitForSelector(`${M} #setupOverlay.open`);
}
const setupOpen = tab => tab.page.locator(`${M} #setupOverlay`).evaluate(el => el.classList.contains("open"));
// As it is: { partner: the name picked ("— no one"), offered: every choice, month, day, year, off: the anniversary's fields
// disabled, hint: the line above Save ("" while hidden), marked: the fields Save marked ("month", "day", "year") }.
const setup = tab => tab.page.evaluate(() => {
  const $ = id => document.querySelector(`#kMount #${id}`), pick = $("setupPartner"), days = { setupMonth: "month", setupDay: "day", setupYear: "year" };
  return {
    partner: pick.selectedOptions[0] ? pick.selectedOptions[0].textContent : "", offered: [...pick.options].map(o => o.textContent),
    month: $("setupMonth").value, day: $("setupDay").value, year: $("setupYear").value, off: Object.keys(days).every(id => $(id).disabled),
    hint: $("setupHint").hidden ? "" : $("setupHint").textContent, marked: [...$("setupForm").querySelectorAll("[aria-invalid]")].map(el => days[el.id] || el.id)
  };
});
// Fills in what's given ({ partner: a name or "— no one", month ("10"; "" for —), day, year }), the one picked first.
async function fillSetup(tab, f) {
  const p = tab.page;
  if (f.partner !== undefined) await p.selectOption(`${M} #setupPartner`, { label: f.partner });
  if (f.month !== undefined) await p.selectOption(`${M} #setupMonth`, String(f.month));
  if (f.day !== undefined) await p.fill(`${M} #setupDay`, String(f.day));
  if (f.year !== undefined) await p.fill(`${M} #setupYear`, String(f.year));
}
const saveSetup = tab => tab.page.click(`${M} #setupForm button[type="submit"]`);
const cancelSetup = tab => tab.page.click(`${M} #setupCancelBtn`);

// --- Momo's "Open in Pabu": what flashes, ["week pp-mom c1"] (This week's line) or ["person pp-jo"] (People's) ---
const flashing = tab => tab.page.$$eval(`${M} .flash`, els => els.map(e => (e.classList.contains("due-row") ? `week ${e.dataset.id} ${e.dataset.cid}` : `person ${e.dataset.id}`)));

// --- A person as Pabu keeps them (a copy), by name; null when there's no one by that name ---
const person = (tab, name) => tab.page.evaluate(x => { const p = Kyoshi.apps.pabu.live().find(q => q.name === x); return p ? JSON.parse(JSON.stringify(p)) : null; }, name);

module.exports = {
  thisWeek, tick, quickAdd, submitAdd, addState, birthdays, stripTitle, people, names, peopleHead, chips, pickChip, openPerson, isOpen, popup, said,
  focused, hintInView, fill, setBox, addBox, removeBox, talkedOn, typeTalk, removeTalk, save, cancel, remove, openSetup, setupOpen, setup, fillSetup,
  saveSetup, cancelSetup, flashing, person
};
