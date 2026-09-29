/* Momo · triage.js — an event's pop-up (#eventOverlay): where it's from, what it conflicts with,
 * and moving it within its week: a quick fix (the nearest time or day clear of conflicts, one
 * click) or any day and time picked, in 15-minute steps. A conflict that's fine can be kept, and
 * a moved event put back where its app has it. Moving one changes only Momo's board: its app
 * keeps its own day and time. */
(function (K, A) {
  "use strict";
  const S = A.S, $ = A.$;
  const { esc, todayStr } = K.util;
  const { DAY_HOURS, DAYS, DAY_NAMES, DAY_LONG, STEP, fmtClock, dayIndex, firstDay, thisWeekKey } = A;

  const overlay = () => $("eventOverlay");
  // Esc, × and a click beside it just close it: nothing moves until a button says so.
  function defineEventOverlay() {
    K.modal.define(overlay(), { dismiss: closeEvent });
  }
  function closeEvent() {
    S.triage = null;
    K.modal.close(overlay());
  }

  // The pop-up's event as it is now, fresh from its app; null once it's gone.
  const current = () => (S.triage && A.weekAgenda(S.triage.key).find(ev => ev.key === S.triage.ev)) || null;
  // "Gym (0800–0900) and Vet (0800–0815)".
  const clashText = list => A.names(list.map(o => ({ title: `${o.title} (${fmtClock(o.start)}–${fmtClock(o.end)})` })));

  function openEvent(evKey) {
    const key = A.shownKey(), ev = S.agenda.find(x => x.key === evKey);
    if (!ev || ev.done || A.isLocked()) return;
    const app = K.apps[ev.app], fixes = ev.flag ? quickFixes(key, ev) : [];
    S.triage = { key, ev: ev.key, day: ev.day, at: ev.at };
    $("eventIcon").innerHTML = app ? app.meta.icon : "";
    $("eventTitle").textContent = ev.title;
    // Its app's name goes there (core/shell.js switches apps on the #id).
    $("eventFrom").innerHTML = `From <a href="#${esc(ev.app)}">${esc(app ? app.meta.name : ev.app)}</a>: ${esc(A.when(ev.home))}` +
      (ev.note ? `<span class="sep">|</span>${esc(ev.note)}` : "") + (ev.moved ? `<br>You moved it to ${esc(A.when(ev))}.` : "");
    $("eventClash").hidden = !ev.clash.length;
    $("eventClash").classList.toggle("kept", ev.keep);
    $("eventClashText").textContent = ev.keep ? `It overlaps ${clashText(ev.clash)}, and you kept it here.` : `Conflicts with ${clashText(ev.clash)}.`;
    $("eventFixes").hidden = !fixes.length;
    $("eventFixList").innerHTML = fixes.map(f => `<button type="button" class="secondary small" data-day="${f.day}" data-at="${f.at}" title="Move it to ${DAY_LONG[f.day]} at ${fmtClock(f.at)}">` +
      `${f.day === ev.day ? "" : `${DAY_NAMES[f.day]} `}${fmtClock(f.at)}</button>`).join("");
    $("eventKeepBtn").hidden = !ev.flag;
    $("eventResetBtn").hidden = !ev.moved;
    $("eventResetBtn").textContent = `Back to ${DAY_NAMES[ev.home.day]} ${ev.home.at === null ? "(any time)" : fmtClock(ev.home.at)}`;
    $("eventTime").value = ev.at === null ? "" : fmtClock(ev.at);
    renderChoice();
    K.modal.open(overlay());
  }

  // Where the event would be clear of conflicts, nearest first: the closest earlier and later
  // times that day (on the 15-minute grid), then the same time the day before and after — within
  // its week, and not in the past.
  function quickFixes(key, ev) {
    const list = A.readList(key), evs = A.weekAgenda(key, list), first = firstDay(key);
    const today = key === thisWeekKey() ? dayIndex(todayStr()) : -1;
    const clear = (d, at) => at >= (d === today ? A.hoursNow() : 0) && at + ev.dur <= DAY_HOURS &&
      !A.obstacles(evs, list, d, ev.key).some(o => A.overlaps({ start: at, end: at + ev.dur }, o));
    const out = [];
    for (let t = Math.ceil(ev.at / STEP - 1e-9) * STEP - STEP; t >= 0; t -= STEP) if (clear(ev.day, t)) { out.push({ day: ev.day, at: t }); break; }
    for (let t = Math.floor(ev.at / STEP + 1e-9) * STEP + STEP; t + ev.dur <= DAY_HOURS; t += STEP) if (clear(ev.day, t)) { out.push({ day: ev.day, at: t }); break; }
    [ev.day - 1, ev.day + 1].forEach(d => { if (d >= first && d <= 6 && clear(d, ev.at)) out.push({ day: d, at: ev.at }); });
    return out;
  }

  // The day and time picked below, and what the event would conflict with there.
  function renderChoice() {
    const t = S.triage, ev = current();
    if (!t || !ev) return;
    const first = firstDay(t.key), list = A.readList(t.key), changed = t.day !== ev.day || t.at !== ev.at;
    $("eventDays").innerHTML = DAYS.map(d => `<button type="button" class="day-pill${d === t.day ? " active" : ""}" data-day="${d}"${d < first ? " disabled" : ""}>${DAY_NAMES[d]}</button>`).join("");
    const hits = t.at === null ? [] : A.obstacles(A.weekAgenda(t.key, list), list, t.day, ev.key).filter(o => A.overlaps({ start: t.at, end: t.at + ev.dur }, o));
    $("eventNote").hidden = !changed;
    $("eventNote").textContent = hits.length ? `${A.when(t)} conflicts with ${clashText(hits)}.` : `${A.when(t)} is clear ✓`;
    $("eventNote").className = `note ${hits.length ? "bad" : "good"}`;
  }

  function onEventDay(e) {
    const btn = e.target.closest(".day-pill");
    if (!btn || btn.disabled || !S.triage) return;
    S.triage.day = +btn.dataset.day;
    renderChoice();
  }

  // − / + move the time 15 minutes, onto the grid first if it's off it (with no time yet: 0900).
  function stepEventTime(dir) {
    const t = S.triage, ev = current();
    if (!t || !ev) return;
    const at = t.at === null ? 9 : dir > 0 ? Math.floor(t.at / STEP + 1e-9) * STEP + STEP : Math.ceil(t.at / STEP - 1e-9) * STEP - STEP;
    t.at = Math.min(DAY_HOURS - ev.dur, Math.max(0, at));
    $("eventTime").value = fmtClock(t.at);
    renderChoice();
  }

  // A time typed goes on the 15-minute grid as it's typed; tidy (on leaving the field) shows it
  // that way. Empty is any time that day, but only for an event its app gave no time.
  function onEventTime(tidy) {
    const t = S.triage, ev = current();
    if (!t || !ev) return;
    const at = A.readClock("eventTime");
    if (at === null ? ev.home.at === null : !Number.isNaN(at)) t.at = at === null ? null : Math.min(DAY_HOURS - ev.dur, at);
    if (tidy) $("eventTime").value = t.at === null ? "" : fmtClock(t.at);
    renderChoice();
  }

  // Puts the event on a day and at a time of its week (keep: a conflict there is fine). Only what
  // differs from where its app has it is kept (week.events).
  function place(day, at, keep = false) {
    const t = S.triage, ev = current();
    closeEvent();
    if (!ev || A.readList(t.key).closed) return A.renderAll(); // gone meanwhile (a dose logged, say), or its week closed
    const list = A.ensureWeek(t.key), events = { ...list.events }, entry = {};
    if (day !== ev.home.day) entry.day = day;
    if (at !== ev.home.at) entry.at = at;
    if (keep) entry.keep = true;
    if (Object.keys(entry).length) events[ev.key] = entry;
    else delete events[ev.key];
    if (Object.keys(events).length) list.events = Object.fromEntries(Object.keys(events).sort().map(k => [k, events[k]]));
    else delete list.events;
    A.save();
    A.renderAll();
  }
  const moveEvent = () => { if (S.triage) place(S.triage.day, S.triage.at); };
  function keepEvent() { const ev = current(); if (ev) place(ev.day, ev.at, true); }
  function resetEvent() { const ev = current(); if (ev) place(ev.home.day, ev.home.at); }
  function onFixClick(e) {
    const btn = e.target.closest("button[data-day]");
    if (btn && S.triage) place(+btn.dataset.day, +btn.dataset.at);
  }

  Object.assign(A, { defineEventOverlay, closeEvent, openEvent, onEventDay, stepEventTime, onEventTime, moveEvent, keepEvent, resetEvent, onFixClick });
})(Kyoshi, Kyoshi.apps.momo);
