/* Kyoshi · tests/momo.js — Momo's screens as the tests read and use them: the week tabs and their statuses, the bank
 * (To Be Budgeted, its line and message), Tasks (each task's title, hours, apps and overdue edge; parked cards), the
 * board's days and cards (title, hours, what fills them, ✓, start–end), dragging a task onto a day (Momo drags with
 * Pointer Events: the mouse down, a few moves past its threshold, up), New card and the card editor's Before & after,
 * the bank's actions (Load or Reload baseline, Copy previous week, Fill gaps with Free time, Save as baseline, Clear), the
 * sleep routine's pop-up (its fields and status line, Save, Remove), Upcoming weekends (the fold's line and tiles, a
 * weekend's pop-up with its days off, the days-off marks on the board and on Today), the close-out (its banner, the
 * pop-up's rows, the Done stepper, Confirm, Later; Close out this week; Reopen), Today (its sections and rows, a card's
 * pop-up), the card editor's From section, "Open in <App>" and read-only state (a card set in its app), and the
 * switcher's dots with their tooltips; for cards set in their app: the baseline's and a week's cards as stored, how a
 * card looks, trying to drag one, Alt+click and the clipboard's shortcuts. What Momo drew from (its fill of other apps'
 * needs) is read too, for checks. Selectors live here, so a markup change is fixed in one place. */
"use strict";

const M = "#kMount";
const flat = s => String(s || "").replace(/\s+/g, " ").trim();
// "1h" → 1, "30m" → 0.5, "1.5h" → 1.5.
const hoursOf = s => { const m = /^([\d.]+)(h|m)$/.exec(flat(s)); return m ? (m[2] === "m" ? +m[1] / 60 : +m[1]) : null; };

// --- Where Momo is: the board or Today, and which week's tab ---
const isToday = tab => tab.page.evaluate(() => !document.querySelector("#kMount #todayView").hidden);
async function showBoard(tab) { if (await isToday(tab)) await tab.page.click(`${M} #weekBtn`); }
async function showToday(tab) { if (!(await isToday(tab))) await tab.page.click(`${M} #todayBtn`); }
// The week tab on screen: "this", "next" or "base"; view(tab, which) picks one.
const shown = tab => tab.page.evaluate(() => (document.querySelector("#kMount #viewToggle .mode-btn.active") || {}).dataset?.view || "");
async function view(tab, which) {
  await showBoard(tab);
  if ((await shown(tab)) !== which) await tab.page.click(`${M} #viewToggle [data-view="${which}"]`);
}

// --- The board ---
// The tabs: { this: { date, status, cls }, next: …, base: … }.
const tabs = tab => tab.page.$$eval(`${M} #viewToggle .mode-btn`, els => Object.fromEntries(els.map(b => {
  const st = b.querySelector(".vb-status");
  return [b.dataset.view, { date: b.querySelector(".vb-date").textContent.trim(), status: st.textContent.trim(), cls: st.className.replace("vb-status", "").trim() }];
})));
// The bank: { label, num (hours), of, msg, msgCls, buttons: the actions shown }.
const bank = tab => tab.page.evaluate(() => {
  const $ = id => document.querySelector(`#kMount #${id}`), h = s => { const m = /^([\d.]+)(h|m)$/.exec(s.trim()); return m ? (m[2] === "m" ? +m[1] / 60 : +m[1]) : null; };
  return {
    label: $("bankLabel").textContent.trim(), num: h($("bankNum").textContent), of: $("bankOf").textContent.trim(),
    msg: $("bankMsg").textContent.trim(), msgCls: $("bankMsg").className.replace("bank-msg", "").trim(),
    buttons: [...document.querySelectorAll("#kMount .bank-actions button")].filter(b => !b.hidden).map(b => b.textContent.trim())
  };
});
// Tasks: [{ key, title, label (its words, as a screen reader says them), hours, overdue, ongoing, apps }], then the
// parked cards [{ id, title, hours }].
const tasks = tab => tab.page.evaluate(() => {
  const h = s => { const m = /^([\d.]+)(h|m)$/.exec((s || "").trim()); return m ? (m[2] === "m" ? +m[1] / 60 : +m[1]) : null; };
  const box = document.querySelector("#kMount #taskCards");
  return {
    hidden: document.querySelector("#kMount #tasks").hidden,
    tasks: [...box.querySelectorAll(".task")].map(t => ({
      key: t.dataset.task, title: t.querySelector(".card-title").childNodes.length ? [...t.querySelector(".card-title").childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join("").trim() : "",
      label: t.getAttribute("aria-label"), hours: h((t.querySelector(".task-hours") || {}).textContent), overdue: t.classList.contains("late"),
      ongoing: !t.querySelector(".task-hours"), apps: t.querySelectorAll(":scope > .app-icon").length
    })),
    parked: [...box.querySelectorAll(".card.parked:not(.task)")].map(c => ({ id: c.dataset.id, title: c.querySelector(".card-title").textContent.trim(), hours: h((c.querySelector(".card-hours") || {}).textContent) })),
    total: document.querySelector("#kMount #tasksTotal").textContent.trim()
  };
});
// The board's days: [{ day (0 = Monday), date ("Today", "Oct 6" or ""), total, over, cards: [{ id, title, hours, label, done,
// inner, parent, time: "0900–1700" (start to end; "" without a time), noEnd: its end left out for room }], events: [{ key,
// title, done, flag, time }], marks: any-time events in the heading [{ title, done }] }].
const days = tab => tab.page.$$eval(`${M} #board .col`, cols => cols.map(col => {
  const h = s => { const m = /^([\d.]+)(h|m)$/.exec((s || "").trim()); return m ? (m[2] === "m" ? +m[1] / 60 : +m[1]) : null; };
  const own = c => c.querySelector(":scope > .card-own") || c;
  return {
    day: +col.dataset.day, date: (col.querySelector(".col-date") || {}).textContent || "", total: +col.dataset.total, over: col.classList.contains("over"),
    cards: [...col.querySelectorAll(".col-body .card[data-id]")].map(c => {
      const o = own(c), title = o.querySelector(".card-title");
      return {
        id: c.dataset.id, title: title ? [...title.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join("").trim() : "",
        fill: ((title && title.querySelector(".card-fill")) || {}).textContent?.replace(/^\s*·\s*/, "") || "",
        hours: h((o.querySelector(":scope > .card-hours") || {}).textContent), label: o.getAttribute("aria-label") || "",
        done: !!o.querySelector(".card-time .ev-done"), late: c.classList.contains("late"), inner: c.classList.contains("inner"), parent: c.classList.contains("inner") ? c.parentElement.closest(".card").dataset.id : null,
        time: (o.querySelector(":scope > .card-time .clock") || {}).textContent || "", noEnd: !!o.querySelector(":scope > .card-time.no-end")
      };
    }),
    events: [...col.querySelectorAll(".event")].map(e => ({ key: e.dataset.ev || "", title: e.getAttribute("title"), done: e.classList.contains("done"), flag: e.classList.contains("clash"), time: (e.querySelector(".clock") || {}).textContent || "" })),
    marks: [...col.querySelectorAll(".ev-mark")].map(e => ({ title: e.getAttribute("title"), done: e.classList.contains("done") }))
  };
}));
// The whole board on screen at once.
async function board(tab) {
  return { view: await shown(tab), tabs: await tabs(tab), bank: await bank(tab), tasks: await tasks(tab), days: await days(tab), banner: await banner(tab) };
}

// --- What Momo drew from: its fill of other apps' needs (inbox.js), as last drawn ---
// { today, thisKey, nextKey, view, needs: [{ key "app:id", app, id, title, block, fill, minutes, date, due, from, overdue, done }],
//   blocks: [{ key (week), date, card, title, room, used, needs: ["app:id"] }], short: [{ key, minutes }], tasks: { this, next }:
//   each board's tasks [{ key, title, hours, needs: ["app:id"], overdue }] }.
const model = tab => tab.page.evaluate(() => {
  const A = Kyoshi.apps.momo, S = A.S, f = S.fill || A.fill(), k = n => `${n.app}:${n.id}`;
  const task = t => ({ key: t.key, title: t.title, hours: t.hours, needs: t.needs.map(k), overdue: !!t.overdue, ongoing: !!t.ongoing });
  return {
    today: Kyoshi.util.todayStr(), thisKey: A.thisWeekKey(), nextKey: A.nextWeekKey(), view: S.view, todayView: S.today,
    needs: f.needs.map(n => ({ key: k(n), app: n.app, id: n.id, title: n.title, block: n.block, fill: n.fill, minutes: n.minutes, date: n.date, due: n.due, from: n.from, overdue: n.overdue, done: n.done })),
    blocks: f.blocks.map(b => ({ key: b.key, date: b.date, card: b.card.id, title: b.card.title, room: b.room, used: b.used, needs: b.needs.map(k) })),
    short: f.short.map(n => ({ key: k(n), minutes: n.minutes })),
    tasks: { this: A.tasks(f, A.thisWeekKey()).map(task), next: A.tasks(f, A.nextWeekKey()).map(task) }
  };
});

// --- Drag a task onto a day: the mouse down on it, a few moves past Momo's 4-pixel threshold, then over the day's free
// time at its end (so the new card goes last, on its own), and up. The board on screen gets the card. ---
async function dragTask(tab, key, day) {
  const p = tab.page, task = p.locator(`${M} #taskCards .task[data-task="${key}"]`).first();
  if (!(await task.isVisible())) return false;
  await task.scrollIntoViewIfNeeded({ timeout: 5000 });
  const from = await task.boundingBox();
  if (!from) return false;
  const col = p.locator(`${M} #board .col[data-day="${day}"]`);
  const end = col.locator(".col-body > .free.end");
  const box = (await end.count()) ? await end.boundingBox() : await col.locator(".col-body").boundingBox();
  if (!box) return false;
  const [x0, y0] = [from.x + Math.min(20, from.width / 2), from.y + from.height / 2];
  const [x1, y1] = [box.x + box.width / 2, box.y + Math.min(box.height - 4, Math.max(4, box.height / 2))];
  await p.mouse.move(x0, y0);
  await p.mouse.down();
  for (let i = 1; i <= 3; i++) await p.mouse.move(x0 + i * 4, y0 + i * 3);
  await p.mouse.move(x1, y1, { steps: 4 });
  await p.mouse.up();
  return p.evaluate(() => !Kyoshi.apps.momo.S.drag);
}
// A task tapped (the phone's way): a new card like the ones it draws, on the days picked, then Save.
async function placeTask(tab, key, dayList) {
  const p = tab.page;
  await p.click(`${M} #taskCards .task[data-task="${key}"]`);
  await p.waitForSelector(`${M} #cardOverlay.open`);
  for (const d of dayList) await p.click(`${M} #cardDays .day-pill[data-day="${d}"]`);
  await p.click(`${M} #cardSaveBtn`);
  return !(await p.locator(`${M} #cardOverlay`).evaluate(el => el.classList.contains("open")));
}

// --- Cards ---
// + New card: a title, hours and days (none: it waits in Tasks); on the baseline a time it's pinned at ("0900"), and its
// before & after (as setSides).
async function newCard(tab, { title, hours = 1, days: on = [], pin = "", sides: around = null }) {
  const p = tab.page;
  await p.click(`${M} #addTaskBtn`);
  await p.waitForSelector(`${M} #cardOverlay.open`);
  await p.fill(`${M} #cardTitle`, title);
  await p.fill(`${M} #cardHours`, String(hours));
  if (on.length) {
    for (const d of on) await p.click(`${M} #cardDays .day-pill[data-day="${d}"]`);
    if (await p.locator(`${M} #cardDays .day-pill.active[data-day=""]`).count()) await p.click(`${M} #cardDays .day-pill[data-day=""]`);
  }
  if (pin) await p.fill(`${M} #cardPin`, pin);
  if (around) await setSides(tab, around);
  await p.click(`${M} #cardSaveBtn`);
}
// The card editor's Before & after: { shown, title, before, after (minutes), same (Same both ways ticked), afterOff (After
// can't be changed) }.
const sides = tab => tab.page.evaluate(() => {
  const $ = id => document.querySelector(`#kMount #${id}`);
  return { shown: !$("cardSidesField").hidden, title: $("cardSideTitle").value, before: +$("cardBefore").value, after: +$("cardAfter").value, same: $("cardSidesSame").checked, afterOff: $("cardAfter").disabled };
});
// Sets them as the user does: the title typed, Same both ways ticked or not, then the minutes typed and the field left.
async function setSides(tab, { title, same, before, after } = {}) {
  const p = tab.page;
  if (title !== undefined) await p.fill(`${M} #cardSideTitle`, title);
  if (same !== undefined) await p.setChecked(`${M} #cardSidesSame`, same);
  for (const [id, v] of [["cardBefore", before], ["cardAfter", after]]) {
    if (v === undefined) continue;
    await p.fill(`${M} #${id}`, String(v));
    await p.press(`${M} #${id}`, "Tab");
  }
}
const saveCard = tab => tab.page.click(`${M} #cardSaveBtn`);
// A card's editor, by its id: { title, hours, from: what fills it, by app [{ app, needs: [{ title, done, id, details }] }],
// readonly (a card set in its app: no Save, fields off), change: "Change it in …" / "Set in …" ("" when hidden), changeId:
// what its link opens, close: the Cancel button's words }.
async function openCard(tab, id) {
  const p = tab.page, card = `${M} #board .card[data-id="${id}"]`;
  await p.click((await p.locator(`${card} > .card-own`).count()) ? `${card} > .card-own` : card, { position: { x: 12, y: 8 } });
  await p.waitForSelector(`${M} #cardOverlay.open`);
  const more = await p.evaluate(() => {
    const $ = s => document.querySelector(`#kMount ${s}`), ch = $("#cardChange"), a = ch.querySelector("a");
    return { readonly: $("#cardSaveBtn").hidden && $("#cardTitle").disabled, change: ch.hidden ? "" : ch.textContent.trim(), changeId: a ? a.dataset.id : "", close: $("#cardCancelBtn").textContent.trim(), canDelete: !$("#cardDeleteBtn").hidden };
  });
  return { title: await p.inputValue(`${M} #cardTitle`), hours: +(await p.inputValue(`${M} #cardHours`)), from: await fromList(tab, "cardFrom"), ...more };
}
// The baseline's cards as stored, in order: [{ id, title, hours, day, pin, slot, fixed, auto, app }].
const baselineCards = tab => tab.page.evaluate(() => Kyoshi.apps.momo.S.data.baseline.cards.map(c => ({ id: c.id, title: c.title, hours: c.hours, day: c.day, pin: c.pin, slot: c.slot, fixed: c.fixed, auto: c.auto, app: c.app })));
// A week's cards as stored (key: its Monday), in order, the same way.
const weekCards = (tab, key) => tab.page.evaluate(k => (Kyoshi.apps.momo.S.data.weeks[k] || { cards: [] }).cards.map(c => ({ id: c.id, title: c.title, hours: c.hours, day: c.day, pin: c.pin, slot: c.slot, fixed: c.fixed, auto: c.auto, app: c.app, need: c.need })), key);
// How a card on the board looks set in its app: { set (its class), grip, pin (a pin to click), sign (the pin that's only a sign) }.
const cardLook = (tab, id) => tab.page.$eval(`${M} #board .card[data-id="${id}"]`, c => ({
  set: c.classList.contains("set"), grip: !!c.querySelector(":scope > .grip, :scope > .card-own > .grip"), pin: !!c.querySelector(".pin"), sign: !!c.querySelector(".set-pin")
}));
// Tries to drag a card on the board by the mouse onto another day's free time at its end: whether it went (its day after).
async function tryDrag(tab, id, day) {
  const p = tab.page, card = p.locator(`${M} #board .card[data-id="${id}"]`).first();
  const from = await card.boundingBox(), end = p.locator(`${M} #board .col[data-day="${day}"] .col-body > .free.end`);
  const box = (await end.count()) ? await end.boundingBox() : await p.locator(`${M} #board .col[data-day="${day}"] .col-body`).boundingBox();
  const [x0, y0] = [from.x + Math.min(30, from.width / 2), from.y + Math.min(10, from.height / 2)];
  await p.mouse.move(x0, y0);
  await p.mouse.down();
  for (let i = 1; i <= 3; i++) await p.mouse.move(x0 + i * 4, y0 + i * 3);
  await p.mouse.move(box.x + box.width / 2, box.y + Math.min(box.height - 4, 10), { steps: 4 });
  await p.mouse.up();
  return p.evaluate(([cid, d]) => { const S = Kyoshi.apps.momo.S, c = Kyoshi.apps.momo.shownList().cards.find(x => x.id === cid); return !!c && c.day === d && !S.drag; }, [id, day]);
}
// Alt+click on a card (deletes one of yours).
async function altClick(tab, id) {
  const p = tab.page, card = p.locator(`${M} #board .card[data-id="${id}"]`).first();
  await card.click({ modifiers: ["Alt"], position: { x: 12, y: 8 } });
}
// Ctrl+C / Ctrl+X / Ctrl+V with the mouse over an element, scrolled into view (Momo's clipboard goes by where the mouse is).
async function shortcut(tab, key, selector) {
  const p = tab.page, el = p.locator(selector).first();
  await el.scrollIntoViewIfNeeded();
  const box = await el.boundingBox();
  await p.mouse.move(box.x + Math.min(12, box.width / 2), box.y + Math.min(8, box.height / 2));
  await p.keyboard.press(`Control+${key}`);
}
// The From section of the card editor ("cardFrom") or of Today's card pop-up ("detailFrom").
const fromList = (tab, id) => tab.page.$$eval(`${M} #${id} .from-needs li`, els => els.map(li => {
  const a = li.querySelector("a[data-app]");
  return { app: a ? a.dataset.app : "", id: a ? a.dataset.id : "", title: li.querySelector("strong").textContent.trim(), done: !!li.querySelector(".from-done"), details: [...li.querySelectorAll(".from-detail")].map(d => d.textContent.trim()) };
}));
const closeCard = tab => tab.page.click(`${M} #cardCancelBtn`);
// "Open in <App>" from the card editor (or Today's pop-up: where = "detailFrom"); waits for that app on screen.
async function openInApp(tab, app, id, where = "cardFrom") {
  await tab.page.click(`${M} #${where} a[data-app="${app}"][data-id="${id}"]`);
  await tab.page.waitForFunction(x => Kyoshi.active().id === x, app);
}

// --- The bank's actions (a confirm, if any, is answered by the tab's dialog handler: lib.js) ---
const action = (tab, id) => tab.page.click(`${M} #${id}`);
const visible = (tab, id) => tab.page.locator(`${M} #${id}`).isVisible();
const loadBaseline = tab => action(tab, "loadBaselineBtn");
const copyPrevious = tab => action(tab, "copyPrevBtn");
const fillGaps = tab => action(tab, "fillGapsBtn");
const saveAsBaseline = tab => action(tab, "saveAsBaseBtn");
const clearWeek = tab => action(tab, "clearBtn");

// --- The sleep routine (the Baseline tab's Sleep routine…: sleep.js) ---
// Its pop-up as it is: { open, bed, wake, nights (the days picked, 0 = Monday), wind, windTitle, rise, riseTitle, title (the
// cards'), note (the night's length), status, remove (Remove shown), cancel (that button's words) }.
const sleepForm = tab => tab.page.evaluate(() => {
  const $ = id => document.querySelector(`#kMount #${id}`);
  return {
    open: $("sleepOverlay").classList.contains("open"), bed: $("sleepBed").value, wake: $("sleepWake").value,
    nights: [...document.querySelectorAll("#kMount #sleepNights .day-pill.active")].map(b => +b.dataset.night),
    wind: +$("sleepWind").value, windTitle: $("sleepWindTitle").value, rise: +$("sleepRise").value, riseTitle: $("sleepRiseTitle").value,
    title: $("sleepName").value, note: $("sleepNote").textContent.trim(), status: $("sleepStatus").textContent.trim(),
    remove: !$("sleepRemoveBtn").hidden, cancel: $("sleepCancelBtn").textContent.trim()
  };
});
// Opens it from the bank (the Baseline tab on screen), unless it's open, and fills in what's given as the user does (typed,
// then the field left; nights: the days to pick, the rest unpicked): { bed: "2200", wake, nights, wind (minutes), windTitle,
// rise, riseTitle, title }. Then Save, unless save is false. The pop-up after, as sleepForm reads it.
async function sleepRoutine(tab, fields = {}, save = true) {
  const p = tab.page, ids = { bed: "sleepBed", wake: "sleepWake", wind: "sleepWind", windTitle: "sleepWindTitle", rise: "sleepRise", riseTitle: "sleepRiseTitle", title: "sleepName" };
  if (!(await p.locator(`${M} #sleepOverlay.open`).count())) {
    await p.click(`${M} #sleepBtn`);
    await p.waitForSelector(`${M} #sleepOverlay.open`);
  }
  for (const [k, v] of Object.entries(fields)) {
    if (k !== "nights") {
      await p.fill(`${M} #${ids[k]}`, String(v));
      await p.press(`${M} #${ids[k]}`, "Tab");
    } else {
      for (let d = 0; d < 7; d++) {
        if ((await p.locator(`${M} #sleepNights .day-pill.active[data-night="${d}"]`).count() > 0) !== v.includes(d)) await p.click(`${M} #sleepNights .day-pill[data-night="${d}"]`);
      }
    }
  }
  if (save) await p.click(`${M} #sleepSaveBtn`);
  return sleepForm(tab);
}
const removeSleep = tab => tab.page.click(`${M} #sleepRemoveBtn`);
const closeSleep = tab => tab.page.click(`${M} #sleepCancelBtn`);

// --- Upcoming weekends and their days off (weekends.js) ---
// The fold on screen (under the board, or under Today), opened as the user does: { summary, tiles: [{ sat, days, plan, none
// ("No plan"), sun (the days-off mark before its days), title (its tooltip) }] }.
async function weekends(tab) {
  const box = tab.page.locator(`${M} ${(await isToday(tab)) ? "#todayView" : "#boardView"} details.weekends`);
  if (!(await box.evaluate(d => d.open))) await box.locator("summary").click();
  return box.evaluate(el => ({
    summary: el.querySelector("summary").textContent.replace(/\s+/g, " ").trim(),
    tiles: [...el.querySelectorAll(".weekend")].map(b => ({ sat: b.dataset.weekend, days: b.querySelector(".we-days").textContent.trim(), plan: b.querySelector(".we-plan").textContent.trim(),
      none: b.querySelector(".we-plan").classList.contains("none"), sun: !!b.querySelector(".we-days .off-sun"), title: b.getAttribute("title") }))
  }));
}
// A weekend's pop-up, opened from its tile (by its Saturday) in the fold on screen.
async function openWeekend(tab, sat) {
  await weekends(tab);
  await tab.page.click(`${M} ${(await isToday(tab)) ? "#todayView" : "#boardView"} details.weekends [data-weekend="${sat}"]`);
  await tab.page.waitForSelector(`${M} #weekendOverlay.open`);
}
// The pop-up as it is: { open, title, plan, before, after (as the fields show them), beforeNote, afterNote (the days they
// take, in words), clear (Clear shown) }.
const weekendForm = tab => tab.page.evaluate(() => {
  const $ = id => document.querySelector(`#kMount #${id}`), text = id => $(id).textContent.trim();
  return { open: $("weekendOverlay").classList.contains("open"), title: text("weekendTitle"), plan: $("weekendPlan").value, before: $("weekendBefore").value,
    after: $("weekendAfter").value, beforeNote: text("weekendBeforeNote"), afterNote: text("weekendAfterNote"), clear: !$("weekendClearBtn").hidden };
});
// Its − / + beside Before or After ("before" | "after"), n times (n < 0: −); typing in { plan, before, after }, each field
// then left, as the user does; its buttons.
const stepOff = async (tab, which, n) => { for (let i = 0; i < Math.abs(n); i++) await tab.page.click(`${M} .stepper:has(#weekend${which === "before" ? "Before" : "After"}) [data-step="${Math.sign(n)}"]`); };
async function fillWeekend(tab, fields) {
  for (const [k, v] of Object.entries(fields)) {
    const f = tab.page.locator(`${M} #weekend${k[0].toUpperCase()}${k.slice(1)}`);
    await f.fill(String(v));
    await f.press("Tab");
  }
}
const [saveWeekend, clearWeekend, cancelWeekend] = ["Save", "Clear", "Cancel"].map(b => tab => tab.page.click(`${M} #weekend${b}Btn`));
// The days-off marks (a sun) on the board's headings, Monday first, and on Today ([by its date, by Tomorrow's]): { off: "" |
// "whole" | "am" | "pm", tip, half (faded) } each.
const offMarks = tab => tab.page.$$eval(`${M} #board .col`, cols => cols.map(c => c.querySelector(".col-date .off-sun"))
  .map(s => ({ off: s ? s.dataset.off : "", tip: s ? s.title : "", half: !!s && s.classList.contains("half") })));
const todayOff = tab => tab.page.evaluate(() => {
  const h2 = [...document.querySelectorAll("#kMount #todayBody h2")].find(h => /^Tomorrow/.test(h.textContent.trim()));
  return [document.querySelector("#kMount #todayDate .off-sun"), h2 && h2.querySelector(".off-sun")]
    .map(s => ({ off: s ? s.dataset.off : "", tip: s ? s.title : "", half: !!s && s.classList.contains("half") }));
});

// --- The close-out ---
// The banner's words ("" while it's hidden).
async function banner(tab) {
  const b = tab.page.locator(`${M} #closeOutBanner`);
  return (await b.isVisible()) ? flat(await tab.page.locator(`${M} #closeOutBannerText`).innerText()) : "";
}
const review = tab => tab.page.click(`${M} #closeOutBannerBtn`);
// The pop-up: { open, title, rows: [{ title, detail, done (its field) }] }.
const closeOut = tab => tab.page.evaluate(() => {
  const o = document.querySelector("#kMount #closeOutOverlay"), open = !!o && o.classList.contains("open");
  return {
    open, title: open ? o.querySelector("#closeOutTitle").textContent.trim() : "",
    rows: open ? [...o.querySelectorAll(".co-row")].map(r => ({ title: r.querySelector(".co-name").textContent.trim(), detail: r.querySelector(".co-detail").textContent.trim(), done: +r.querySelector("input").value })) : []
  };
});
// A row's Done: typed (hours), then the field left, as the user does.
async function setDone(tab, i, hours) {
  const f = tab.page.locator(`${M} #coDone${i}`);
  await f.fill(String(hours));
  await f.press("Tab");
}
const step = (tab, i, dir) => tab.page.click(`${M} #closeOutRows .co-row >> nth=${i} >> [data-step="${dir > 0 ? 1 : -1}"]`);
const confirmCloseOut = tab => tab.page.click(`${M} #closeOutConfirmBtn`);
const later = tab => tab.page.click(`${M} #closeOutLaterBtn`);
const closeOutNow = tab => action(tab, "closeOutNowBtn");
const reopen = tab => action(tab, "reopenBtn");

// --- Today ---
// Its sections in order: [{ head: "Now" | "Next" | "Later today" | "Tomorrow", rows: [{ when (it starts: "0900", or "any
// time"), end ("1700", under it; "" for any time), title, sub, len, done, kind: "card" | "event" | "free", card (its id),
// week, ev }] }], plus empty: "Nothing's planned for today yet." when shown.
const today = tab => tab.page.evaluate(() => {
  const body = document.querySelector("#kMount #todayBody"), out = [];
  const row = el => ({
    when: [...(el.querySelector(".t-when") || { childNodes: [] }).childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join("").trim(),
    end: ((el.querySelector(".t-when .t-end") || {}).textContent || "").replace(/^–/, ""), title: [...(el.querySelector(".t-title") || { childNodes: [] }).childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join("").trim(),
    sub: (el.querySelector(".t-sub") || {}).textContent || "", len: (el.querySelector(".t-len") || {}).textContent || "", done: !!el.querySelector(".ev-done"),
    kind: el.classList.contains("t-free") ? "free" : el.classList.contains("t-event") ? "event" : "card", card: el.dataset.card || "", week: el.dataset.week || "", ev: el.dataset.ev || "",
    label: el.getAttribute("title") || ""
  });
  body.querySelectorAll(":scope > section").forEach(sec => {
    if (sec.classList.contains("t-now")) out.push({ head: "Now", rows: [...sec.querySelectorAll(".t-big, .t-row")].map(row) });
    else sec.querySelectorAll(":scope > h2").forEach(h => {
      const rows = h.nextElementSibling && h.nextElementSibling.matches(".t-rows") ? [...h.nextElementSibling.querySelectorAll(".t-row")].map(row) : [];
      out.push({ head: [...h.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join("").trim(), rows });
    });
  });
  const empty = body.querySelector(".t-empty p");
  return { date: document.querySelector("#kMount #todayDate").textContent.trim(), sections: out, empty: empty ? empty.textContent.trim() : "" };
});
// A card's pop-up on Today (tapped by its card id): { title, when, from }.
async function openTodayCard(tab, id) {
  const p = tab.page;
  await p.click(`${M} #todayBody [data-card="${id}"] >> nth=0`);
  await p.waitForSelector(`${M} #detailOverlay.open`);
  return { title: (await p.locator(`${M} #detailTitle`).innerText()).trim(), when: (await p.locator(`${M} #detailWhen`).innerText()).trim(), from: await fromList(tab, "detailFrom") };
}
const closeTodayCard = tab => tab.page.click(`${M} #detailCloseBtn`);

// --- The switcher: each app's dot and why ({ id: reason }), read from its list (opened, then closed) ---
async function dots(tab) {
  const p = tab.page;
  await p.click("#kSwitchBtn");
  const out = await p.$$eval("#kSwitchMenu .switch-item", els => Object.fromEntries(els.map(b => [b.dataset.app, (b.querySelector(".attn-dot") || {}).getAttribute?.("aria-label") || ""]).filter(([, why]) => why)));
  await p.click("#kSwitchBtn");
  return out;
}
// The switch button's tooltip: "Switch app (Hawky: 2 errands overdue; …)".
const switchTip = tab => tab.page.getAttribute("#kSwitchBtn", "title");

module.exports = {
  flat, hoursOf, isToday, showBoard, showToday, shown, view, tabs, bank, tasks, days, board, model, dragTask, placeTask,
  newCard, sides, setSides, saveCard, openCard, baselineCards, weekCards, cardLook, tryDrag, altClick, shortcut,
  fromList, closeCard, openInApp, loadBaseline, copyPrevious, fillGaps, saveAsBaseline, clearWeek, visible, sleepForm, sleepRoutine, removeSleep, closeSleep,
  weekends, openWeekend, weekendForm, stepOff, fillWeekend, saveWeekend, clearWeekend, cancelWeekend, offMarks, todayOff,
  banner, review, closeOut, setDone, step, confirmCloseOut, later, closeOutNow, reopen, today, openTodayCard, closeTodayCard, dots, switchTip
};
