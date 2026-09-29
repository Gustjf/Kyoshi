/* Momo · triage.js — an event's pop-up (#eventOverlay): where it's from, what it conflicts with, a
 * quick fix (the nearest clear time that day, earlier or later: one click), or any time that day in
 * 15-minute steps; and back to its app's time once moved. It stays on its own day: when that day has
 * no clear time, its conflict stays flagged. Moving it changes only Momo's board, never its app. */
(function (K, A) {
  "use strict";
  const S = A.S, $ = A.$;
  const { esc } = K.util;
  const { DAY_HOURS, DAY_LONG, STEP, fmtClock } = A;

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
  // "Work (0700–1500) and Vet (0800–0830)".
  const clashText = list => A.names(list.map(o => ({ title: `${o.title} (${fmtClock(o.start)}–${fmtClock(o.end)})` })));
  const at = h => (h === null ? "any time" : fmtClock(h));

  function openEvent(evKey) {
    const key = A.shownKey(), ev = S.agenda.find(x => x.key === evKey);
    if (!ev || ev.done || A.isLocked()) return;
    const app = K.apps[ev.app], fixes = ev.flag ? A.quickFixes(key, ev) : [];
    S.triage = { key, ev: ev.key, at: ev.at };
    $("eventIcon").innerHTML = app ? app.meta.icon : "";
    $("eventTitle").textContent = ev.title;
    // Its app's name goes there (core/shell.js switches apps on the #id).
    $("eventFrom").innerHTML = `From <a href="#${esc(ev.app)}">${esc(app ? app.meta.name : ev.app)}</a>: ${esc(DAY_LONG[ev.day])} at ${at(ev.home)}` +
      (ev.note ? `<span class="sep">|</span>${esc(ev.note)}` : "") + (ev.moved ? `<br>You moved it to ${at(ev.at)}.` : "");
    $("eventClash").hidden = !ev.flag;
    $("eventClashText").textContent = `Conflicts with ${clashText(ev.clash)}.`;
    $("eventFixes").innerHTML = fixes.length
      ? `<span>Quick fix:</span>${fixes.map(t => `<button type="button" class="secondary small" data-at="${t}" title="Move it to ${fmtClock(t)}">${fmtClock(t)}</button>`).join("")}`
      : `<span>${esc(DAY_LONG[ev.day])} has no free time to move it to, so it stays flagged.</span>`;
    $("eventResetBtn").hidden = !ev.moved;
    $("eventResetBtn").textContent = `Back to ${at(ev.home)}`;
    $("eventTime").value = ev.at === null ? "" : fmtClock(ev.at);
    renderChoice();
    K.modal.open(overlay());
  }

  // Under the time picked, once it's another: whether the event would conflict there.
  function renderChoice() {
    const t = S.triage, ev = current();
    if (!t || !ev) return;
    const list = A.readList(t.key);
    const hits = t.at === null ? [] : A.obstacles(A.weekAgenda(t.key, list), A.dayParts(list, ev.day), ev.day, ev.key).filter(o => A.overlaps({ start: t.at, end: t.at + ev.dur }, o));
    $("eventNote").hidden = t.at === ev.at;
    $("eventNote").textContent = hits.length ? `At ${at(t.at)} it conflicts with ${clashText(hits)}.` : `At ${at(t.at)} it's clear ✓`;
    $("eventNote").className = `note ${hits.length ? "bad" : "good"}`;
  }

  // − / + move the time 15 minutes, onto the grid first if it's off it (with no time yet: 0900).
  function stepEventTime(dir) {
    const t = S.triage, ev = current();
    if (!t || !ev) return;
    const to = t.at === null ? 9 : dir > 0 ? Math.floor(t.at / STEP + 1e-9) * STEP + STEP : Math.ceil(t.at / STEP - 1e-9) * STEP - STEP;
    t.at = Math.min(DAY_HOURS - ev.dur, Math.max(0, to));
    $("eventTime").value = fmtClock(t.at);
    renderChoice();
  }

  // A time typed goes on the 15-minute grid as it's typed; tidy (on leaving the field) shows it
  // that way. Empty is any time that day, but only for an event its app gave no time.
  function onEventTime(tidy) {
    const t = S.triage, ev = current();
    if (!t || !ev) return;
    const to = A.readClock("eventTime");
    if (to === null ? ev.home === null : !Number.isNaN(to)) t.at = to === null ? null : Math.min(DAY_HOURS - ev.dur, to);
    if (tidy) $("eventTime").value = t.at === null ? "" : fmtClock(t.at);
    renderChoice();
  }

  // Puts the event at a time on its day: noted in its week unless that's its app's own time.
  function place(to) {
    const t = S.triage, ev = current();
    closeEvent();
    if (!ev || A.readList(t.key).closed) return A.renderAll(); // gone meanwhile (a dose logged, say), or its week closed
    const list = A.ensureWeek(t.key), events = { ...list.events };
    if (to !== ev.home) events[ev.key] = { at: to };
    else delete events[ev.key];
    if (Object.keys(events).length) list.events = Object.fromEntries(Object.keys(events).sort().map(k => [k, events[k]]));
    else delete list.events;
    A.save();
    A.renderAll();
  }
  const moveEvent = () => { if (S.triage) place(S.triage.at); };
  function resetEvent() { const ev = current(); if (ev) place(ev.home); }
  function onFixClick(e) {
    const btn = e.target.closest("button[data-at]");
    if (btn && S.triage) place(+btn.dataset.at);
  }

  Object.assign(A, { defineEventOverlay, closeEvent, openEvent, stepEventTime, onEventTime, moveEvent, resetEvent, onFixClick });
})(Kyoshi, Kyoshi.apps.momo);
