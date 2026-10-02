/* Kyoshi · tests/momo.js — Momo's screens as the tests read and use them: the week tabs and their statuses, the bank
 * (To Be Budgeted, its line and message), Tasks (each task's title, hours, apps and overdue edge; parked cards), the
 * board's days and cards (title, hours, what fills them, ✓), dragging a task onto a day (Momo drags with Pointer
 * Events: the mouse down, a few moves past its threshold, up), New card, the bank's actions (Load or Reload baseline,
 * Copy previous week, Fill gaps with Free time, Save as baseline, Clear), the close-out (its banner, the pop-up's rows,
 * the Done stepper, Confirm, Later; Close out this week; Reopen), Today (its sections and rows, a card's pop-up), the
 * card editor's From section and "Open in <App>", and the switcher's dots with their tooltips. What Momo drew from
 * (its fill of other apps' needs) is read too, for checks. Selectors live here, so a markup change is fixed in one place. */
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
// inner, parent }], events: [{ key, title, done, flag, at }], marks: any-time events in the heading [{ title, done }] }].
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
        done: !!o.querySelector(".card-time .ev-done"), inner: c.classList.contains("inner"), parent: c.classList.contains("inner") ? c.parentElement.closest(".card").dataset.id : null
      };
    }),
    events: [...col.querySelectorAll(".event")].map(e => ({ key: e.dataset.ev || "", title: e.getAttribute("title"), done: e.classList.contains("done"), flag: e.classList.contains("clash") })),
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
// + New card: a title, hours and days (none: it waits in Tasks).
async function newCard(tab, { title, hours = 1, days: on = [] }) {
  const p = tab.page;
  await p.click(`${M} #addTaskBtn`);
  await p.waitForSelector(`${M} #cardOverlay.open`);
  await p.fill(`${M} #cardTitle`, title);
  await p.fill(`${M} #cardHours`, String(hours));
  if (on.length) {
    for (const d of on) await p.click(`${M} #cardDays .day-pill[data-day="${d}"]`);
    if (await p.locator(`${M} #cardDays .day-pill.active[data-day=""]`).count()) await p.click(`${M} #cardDays .day-pill[data-day=""]`);
  }
  await p.click(`${M} #cardSaveBtn`);
}
// A card's editor, by its id: { title, hours, from: what fills it, by app [{ app, needs: [{ title, done, id, details }] }] }.
async function openCard(tab, id) {
  const p = tab.page, card = `${M} #board .card[data-id="${id}"]`;
  await p.click((await p.locator(`${card} > .card-own`).count()) ? `${card} > .card-own` : card, { position: { x: 12, y: 8 } });
  await p.waitForSelector(`${M} #cardOverlay.open`);
  return { title: await p.inputValue(`${M} #cardTitle`), hours: +(await p.inputValue(`${M} #cardHours`)), from: await fromList(tab, "cardFrom") };
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
// Its sections in order: [{ head: "Now" | "Next" | "Later today" | "Tomorrow", rows: [{ when, title, sub, len, done, kind:
// "card" | "event" | "free", card (its id), week, ev }] }], plus empty: "Nothing's planned for today yet." when shown.
const today = tab => tab.page.evaluate(() => {
  const body = document.querySelector("#kMount #todayBody"), out = [];
  const row = el => ({
    when: (el.querySelector(".t-when") || {}).textContent || "", title: [...(el.querySelector(".t-title") || { childNodes: [] }).childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join("").trim(),
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
  newCard, openCard, fromList, closeCard, openInApp, loadBaseline, copyPrevious, fillGaps, saveAsBaseline, clearWeek, visible,
  banner, review, closeOut, setDone, step, confirmCloseOut, later, closeOutNow, reopen, today, openTodayCard, closeTodayCard, dots, switchTip
};
