/* Momo · today.js — Today, the plan on a phone: what's on now with the time left, then what's next, the
 * rest of today in order and tomorrow, free time (time no card has) included. Momo opens on it on a phone
 * and on the board on a computer; the Week and Today buttons switch at any time (S.today). Its times are
 * the board's (times.js): a card with cards inside it shows in its parts around them, and other apps'
 * events (agenda.js) sit at their times, with free time split around them. A card holding something late
 * is red-edged and says "Late", as on the board. Tapping a card shows its pop-up (#detailOverlay): when,
 * and what fills it (inbox.js fromHTML) with "Open in <App>", and a way to edit it; tapping an event opens
 * its own (triage.js). Nothing here is stored. */
(function (K, A) {
  "use strict";
  const S = A.S, $ = A.$;
  const { esc, addDays, todayStr, fmtDate } = K.util;
  const { DAY_HOURS, DAY_LONG, fmtClock, dayIndex, weekKeyOf, thisWeekKey } = A;

  const PHONE = "(max-width: 640px)"; // a phone, as momo.css has it
  const isPhone = () => window.matchMedia(PHONE).matches;

  // How long, or how long until then, in whole minutes rounded up: "45m", "1h", "3h 45m".
  function fmtLong(h) {
    const m = Math.max(1, Math.ceil(h * 60 - 1e-6));
    return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ""}`;
  }
  const span = it => `${fmtClock(it.s)}–${fmtClock(it.e)}`;

  // What fills a card in a week (inbox.js fill, as last drawn): its needs, or none.
  function fillsOf(key, card) {
    const b = S.fill && S.fill.blocks.find(x => x.key === key && x.card.id === card.id);
    return b ? b.needs : [];
  }

  // Free time from s to e, less the time other apps' events take in it.
  function freeAround(s, e, evs) {
    const out = [];
    let t = s;
    evs.filter(ev => ev.start < e && ev.end > s).sort((a, b) => a.start - b.start).forEach(ev => {
      if (ev.start > t) out.push({ free: true, s: t, e: ev.start });
      t = Math.max(t, ev.end);
    });
    if (t < e) out.push({ free: true, s: t, e });
    return out;
  }

  // A day as Today shows it: { key: its week, closed, planned: it has cards, items, any }. items are in
  // time order, each from s to e (hours after midnight): a card on its own or a part of a block around
  // the cards inside it ({ card }: the board's pieces, times.js dayPieces), time no card has ({ free }),
  // and other apps' events ({ ev }); any: their events at any time that day. agendaOf(key): a week's events.
  function dayLine(date, agendaOf) {
    const key = weekKeyOf(date), d = dayIndex(date), list = A.readList(key);
    const { rows, end } = A.daySchedule(list, d), byId = new Map(list.cards.map(c => [c.id, c]));
    const evs = agendaOf(key).filter(ev => ev.day === d), timed = evs.filter(ev => ev.at !== null), items = [];
    A.dayPieces(list, rows, A.startTimes(list, rows), end, false).forEach(p => {
      const m = /^(own|rest|gap):(.+)$/.exec(p.key), card = byId.get(m ? m[2] : p.key);
      if (p.e <= p.s) return;
      if (p.key === "end" || (m && m[1] === "gap")) items.push(...freeAround(p.s, p.e, timed));
      else if (card && (m || !A.innerCards(list, card).length)) items.push({ card, s: p.s, e: p.e }); // not a block's outline: its parts are in
    });
    timed.forEach(ev => items.push({ ev, s: ev.start, e: ev.end }));
    items.sort((a, b) => a.s - b.s || (a.ev ? 1 : 0) - (b.ev ? 1 : 0)); // a card before an event at the same time
    return { key, closed: !!list.closed, planned: rows.length > 0, items, any: evs.filter(ev => ev.at === null).map(ev => ({ ev, s: null, e: null })) };
  }

  // What an item is: its colour, title (after a card's apps' icons, or an event's app's), the line under
  // it (what fills a card, an event's note), whether it's done, its words for a tooltip, what tapping it
  // opens (none for free time, or an event that's done or on a closed week), and its classes (cls: free
  // time, an event, one in conflict, done).
  function about(day, it) {
    if (it.free) return { color: A.colorCss("slate"), title: "Free", sub: "", done: false, label: `Free, ${span(it)}`, tap: "", cls: " t-free" };
    const when = it.s === null ? "any time" : span(it);
    if (it.ev) {
      const ev = it.ev, app = K.apps[ev.app];
      return {
        color: A.keyColor(A.titleKey(ev.title)), title: `<span class="app-icon" aria-hidden="true">${app ? app.meta.icon : ""}</span>${esc(ev.title)}`, sub: esc(ev.note), done: ev.done,
        label: `${ev.title}${ev.note ? ` (${ev.note})` : ""}, ${when}, from ${app ? app.meta.name : ev.app}${ev.done ? " — done ✓" : ev.flag ? ` — conflicts with ${A.names(ev.clash)}` : ""}`,
        tap: ev.done || day.closed ? "" : `data-week="${day.key}" data-ev="${esc(ev.key)}"`, cls: ` t-event${ev.flag ? " clash" : ""}${ev.done ? " done" : ""}`
      };
    }
    const c = it.card, needs = fillsOf(day.key, c), fill = needs.length ? A.fillParts(c, needs) : null, done = !!fill && fill.done, late = !!fill && fill.late;
    return {
      color: A.cardColor(c), title: `${fill ? fill.icons : c.app ? A.iconsHTML([{ app: c.app }]) : ""}${esc(c.title)}`, done,
      sub: `${late ? `<span class="t-late">Late</span>${fill.names ? " · " : ""}` : ""}${fill ? esc(fill.names) : ""}`,
      label: `${c.title}${fill ? ` (${fill.text})` : ""}, ${when}`, tap: `data-week="${day.key}" data-card="${esc(c.id)}"`, cls: done ? " done" : late ? " late" : ""
    };
  }
  const tagOpen = (a, cls) => `${a.tap ? `button type="button" ${a.tap} aria-label="${esc(a.label)}"` : "div"} class="${cls}${a.cls}" title="${esc(a.label)}" style="--c:${a.color}"`;
  const tick = a => (a.done ? ` <span class="ev-done" aria-hidden="true">✓</span>` : "");

  // A row: when it starts, what it is with the line under it, and how long (a ✓ once done).
  function rowHTML(day, it, cls = "") {
    const a = about(day, it), tag = a.tap ? "button" : "div";
    return `<${tagOpen(a, `t-row${cls}`)}><span class="t-when${it.s === null ? " any" : ""}">${it.s === null ? "any time" : fmtClock(it.s)}</span>` +
      `<span class="t-what"><span class="t-title">${a.title}</span>${a.sub ? `<span class="t-sub">${a.sub}</span>` : ""}</span>` +
      `<span class="t-len">${fmtLong(it.ev ? it.ev.dur : it.e - it.s)}${tick(a)}</span></${tag}>`;
  }
  const rowsHTML = (day, items) => (items.length ? `<div class="t-rows">${items.map(it => rowHTML(day, it)).join("")}</div>` : "");

  // Now: what's on, big, with the time left and a bar of how much has gone; under it, anything else on now.
  function nowHTML(day, it, now, also) {
    const a = about(day, it), tag = a.tap ? "button" : "div", gone = Math.min(100, Math.max(0, (now - it.s) / (it.e - it.s) * 100));
    return `<section class="t-now${it.free ? " t-free" : ""}" style="--c:${a.color}"><h2>Now</h2>` +
      `<${tagOpen(a, "t-big")}><span class="t-title">${a.title}${tick(a)}</span>${a.sub ? `<span class="t-sub">${a.sub}</span>` : ""}</${tag}>` +
      `<div class="t-left"><strong>${fmtLong(it.e - now)}</strong> left · until ${it.e > DAY_HOURS ? `${fmtClock(it.e - DAY_HOURS)} tomorrow` : fmtClock(it.e)}</div>` +
      `<div class="t-bar" aria-hidden="true"><span style="width:${gone.toFixed(1)}%"></span></div>` + rowsHTML(day, also) + `</section>`;
  }

  // Draws Today, or the board (render.js renderAll calls it last): Now and Next, the rest of today (a day
  // without cards: only its events), then tomorrow.
  function renderToday() {
    $("boardView").hidden = S.today;
    $("todayView").hidden = !S.today;
    if (!S.today) return;
    const today = todayStr(), tomorrow = addDays(today, 1), now = A.hoursNow(), weeks = new Map();
    const agendaOf = key => weeks.get(key) || weeks.set(key, A.weekAgenda(key)).get(key);
    const td = dayLine(today, agendaOf), tm = dayLine(tomorrow, agendaOf);
    $("todayDate").textContent = fmtDate(today, { weekday: "long", month: "long", day: "numeric" });
    let html = "", list = "";
    if (td.planned) {
      // Now: the card or free time on now (the latest to start, when one runs into another), else an event
      // taking that free time; anything else on now goes under it.
      const on = td.items.filter(it => it.s <= now && now < it.e);
      const cur = on.filter(it => !it.ev).pop() || on[on.length - 1];
      const also = on.filter(it => it !== cur && !(it.ev && it.ev.done));
      const [next, ...rest] = td.items.filter(it => it.s > now);
      if (cur) html += nowHTML(td, cur, now, also);
      if (next) list += `<h2>Next <span class="t-in">in ${fmtLong(next.s - now)}</span></h2>` + `<div class="t-rows">${rowHTML(td, next, " next")}</div>`;
      if (rest.length || td.any.length) list += `<h2>Later today</h2>` + rowsHTML(td, td.any.concat(rest));
    } else {
      html += `<section class="t-empty"><p>Nothing's planned for today yet.</p><button type="button" data-plan>Plan this week</button></section>`;
      const evs = td.any.concat(td.items.filter(it => it.ev && it.e > now));
      if (evs.length) list += `<h2>Later today</h2>` + rowsHTML(td, evs);
    }
    if (list) html += `<section class="t-list">${list}</section>`;
    html += `<section class="t-list"><h2>Tomorrow <span class="t-in">${esc(fmtDate(tomorrow, { weekday: "long", month: "short", day: "numeric" }))}</span></h2>` +
      rowsHTML(tm, tm.any.concat(tm.items.filter(it => tm.planned || it.ev))) + (tm.planned ? "" : `<p class="empty-msg">Nothing's planned yet.</p>`) + `</section>`;
    $("todayBody").innerHTML = html;
  }

  // Every minute (events.js onTick): the time left, and what's now and next.
  function tickToday() {
    if (A.isActive() && S.today) renderToday();
  }

  function setToday(on) {
    S.today = on;
    A.renderAll();
  }

  // Today's pop-ups are the board's, which work on the week its tab shows: a week this week or next is
  // put on it first (drawn again if that changes).
  function showWeek(key) {
    const view = key === thisWeekKey() ? "this" : "next";
    if (S.view === view) return;
    S.view = view;
    A.renderAll();
  }

  function onTodayClick(e) {
    if (e.target.closest("[data-plan]")) {
      S.view = "this";
      return setToday(false);
    }
    const el = e.target.closest("[data-week]");
    if (!el) return;
    if (el.dataset.ev) {
      showWeek(el.dataset.week);
      return A.openEvent(el.dataset.ev);
    }
    openDetail(el.dataset.week, el.dataset.card);
  }

  // ==========================================================================
  // A CARD'S POP-UP
  // ==========================================================================
  const overlay = () => $("detailOverlay");
  function closeDetail() {
    S.detail = null;
    K.modal.close(overlay());
  }

  // A card's day and times (a block's, with the cards inside it), and what fills it, with "Open in
  // <App>"; Edit opens it in the card editor (not on a closed week).
  function openDetail(key, id) {
    const list = A.readList(key), card = list.cards.find(c => c.id === id);
    const parent = card && card.parentId ? list.cards.find(c => c.id === card.parentId) : null;
    const rows = card && card.day !== null ? A.daySchedule(list, card.day).rows : [], row = rows.find(r => r.card === (parent || card));
    if (!row) return A.renderAll(); // gone meanwhile: changed in another tab, say
    const at = parent ? A.startTimes(list, rows).get(card.id).at : row.start, end = parent ? at + card.hours : row.end;
    const inner = A.innerCards(list, card), needs = fillsOf(key, card);
    const date = addDays(key, card.day), today = todayStr();
    const day = date === today ? "Today" : date === addDays(today, 1) ? "Tomorrow" : DAY_LONG[card.day];
    S.detail = { key, id };
    $("detailDot").style.setProperty("--c", A.cardColor(card));
    $("detailTitle").textContent = card.title;
    $("detailWhen").textContent = `${day}, ${fmtClock(at)}–${fmtClock(end)} · ${fmtLong(end - at)}` +
      (inner.length ? `, with ${A.names(inner)} inside` : parent ? `, inside ${parent.title}` : "");
    $("detailFrom").hidden = !needs.length;
    $("detailFrom").innerHTML = A.fromHTML(needs);
    $("detailEditBtn").hidden = !!list.closed;
    K.modal.open(overlay());
  }

  function editDetail() {
    const d = S.detail;
    closeDetail();
    if (!d) return;
    showWeek(d.key);
    A.openCardEditor(d.id);
  }

  // Momo opens on Today on a phone, and on the board on a computer.
  function initToday() {
    S.today = isPhone();
    $("todayBtn").addEventListener("click", () => setToday(true));
    $("weekBtn").addEventListener("click", () => setToday(false));
    $("todayBody").addEventListener("click", onTodayClick);
    K.modal.define(overlay(), { dismiss: closeDetail });
    $("detailEditBtn").addEventListener("click", editDetail);
    $("detailCloseBtn").addEventListener("click", closeDetail);
    // "Open in Appa" (or any app): the pop-up closes on the way, and the app shows what it needs (core/inbox.js).
    $("detailFrom").addEventListener("click", e => {
      const link = e.target.closest("a[data-app]");
      if (!link) return;
      e.preventDefault();
      closeDetail();
      K.inbox.open(link.dataset.app, link.dataset.id);
    });
  }

  Object.assign(A, { isPhone, renderToday, tickToday, initToday });
})(Kyoshi, Kyoshi.apps.momo);
