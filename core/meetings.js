/* Kyoshi · core/meetings.js — each app's checkup or regular meetings with you, as K.meetings: YNAB's "last reconciled".
 * The header shows the app on screen's meetings under its subtitle (#kMeeting: "Meeting: Trend and doses · every month ·
 * last met 12 days ago", Done ✓); tapping one opens its settings (#kMeetOverlay: how often, how long, last time).
 * An app names its meetings' defaults when it registers (K.register):
 *   meetings: [{ id, title, every, minutes, after }]
 * id: a-z, 0-9 and -, unique within the app; title: what it's about ("Trend and doses"); every: "whenever" | "week" |
 * "month" | "quarter" | "year" | "off"; minutes: how long (5–240); after: true to come after the others in Momo (Momo's
 * own, which plans what they sent).
 * "whenever" (no schedule) is a checkup: its line just says when you last did it ("Last checkup: 12 days ago", from its
 * title) with Done ✓, and it's never due, so no dot and nothing in Momo. Picking a schedule in its settings makes it a
 * meeting. The current apps each have a checkup, as they're used daily.
 * Kept in each app's store under core's key "meetings" (like core's "sync"): { id: { every, minutes, last, since, u } }.
 * last: the day last met ("" if never); since: the day it was first seen, its first due day; u: when it last changed
 * (the later change wins). It travels with the app's sync file and backups, beside its data (core/sync.js,
 * core/backup.js); a meeting this version doesn't name is kept as it is.
 * Due (on a schedule): last met + every (months stop at the month's end), else since; overdue once that day has
 * passed, which puts a dot on the app's icon (core/shell.js). For Momo (core/inbox.js): each meeting due by the end of
 * next week fills a card titled "Meeting" in the week before it's due (from), or the soonest once overdue (or never
 * had yet); one met in those two weeks shows ✓ on its day. "Open in <App>" shows the app with its meeting line
 * flashing (reveal). */
(function (K) {
  "use strict";
  const { isObj, isPos, isDate, esc, todayStr, addDays, addMonths, daysBetween, fmtShort, fmtWeekday, readNumber } = K.util;
  const $ = id => document.getElementById(id);
  const KEY = "meetings";
  const BLOCK = "Meeting";   // the title of Momo's cards they fill
  const WINDOW_DAYS = 6;     // a meeting goes in a block from this many days before it's due
  const EVERY = { whenever: "whenever", week: "every week", month: "every month", quarter: "every quarter", year: "every year", off: "off" };
  const MONTHS = { month: 1, quarter: 3, year: 12 };
  const MIN_MINUTES = 5, MAX_MINUTES = 240;
  const isId = id => typeof id === "string" && /^[a-z0-9-]{1,20}$/.test(id);
  const cleanMinutes = m => (Number.isInteger(m) && m >= MIN_MINUTES && m <= MAX_MINUTES ? m : 0);
  const scheduled = every => every !== "whenever" && every !== "off";
  let editing = null; // the settings pop-up: { A, id, start (its fields as opened) }

  // The meetings an app named when it registered, checked (an unusable one is left out).
  function defsOf(A) {
    if (A._meetDefs) return A._meetDefs;
    const ids = new Set();
    return (A._meetDefs = (Array.isArray(A.meta.meetings) ? A.meta.meetings : [])
      .filter(d => isObj(d) && isId(d.id) && typeof d.title === "string" && d.title.trim() && !ids.has(d.id) && ids.add(d.id))
      .map(d => ({ id: d.id, title: d.title.trim(), every: Object.hasOwn(EVERY, d.every) ? d.every : "month", minutes: cleanMinutes(d.minutes) || 15, after: d.after === true })));
  }

  // --- What's kept ---
  // Records by meeting id, in id order and each in the same shape (so two copies compare alike); an unusable one is
  // left out. How often from a newer version is kept as it is (the meeting's own default stands in for it, see stateOf).
  function cleanAll(raw) {
    const out = {};
    if (isObj(raw)) Object.keys(raw).sort().forEach(id => {
      const r = raw[id];
      if (!isId(id) || !isObj(r) || !isId(r.every) || !cleanMinutes(r.minutes)) return;
      out[id] = { every: r.every, minutes: r.minutes, last: isDate(r.last) ? r.last : "", since: isDate(r.since) ? r.since : "", u: isPos(r.u) ? r.u : 0 };
    });
    return out;
  }
  const store = A => A.store.set(KEY, JSON.stringify(A._meet));

  // Reads an app's meetings (at start, and when another tab saved). One never seen before (or kept without its start)
  // starts today, its first due day, kept quietly: it isn't a change of yours to sync, and any device's start will do.
  function load(A) {
    const recs = cleanAll(A.store.json(KEY)), today = todayStr();
    const fresh = defsOf(A).filter(d => !recs[d.id] || !recs[d.id].since);
    fresh.forEach(d => { recs[d.id] = recs[d.id] ? { ...recs[d.id], since: today } : { every: d.every, minutes: d.minutes, last: "", since: today, u: 0 }; });
    A._meet = cleanAll(recs);
    if (fresh.length) store(A);
  }

  // A change made here (Done, or the settings): kept, then counted for sync and autosaved.
  function save(A, id, rec) {
    A._meet = cleanAll({ ...A._meet, [id]: { ...rec, u: Date.now() } });
    store(A);
    A.changed();
    refresh();
  }

  // --- Where each stands ---
  const after = (date, every) => (every === "week" ? addDays(date, 7) : addMonths(date, MONTHS[every]));
  const recOf = (A, d) => (A._meet && A._meet[d.id]) || { every: d.every, minutes: d.minutes, last: "", since: "", u: 0 };

  // A meeting today: { def, every, minutes, last, due ("" without a schedule), from (the first day of its week), overdue, soon
  // (in its week, not overdue: it says when), metToday }.
  function stateOf(A, d) {
    const r = recOf(A, d), today = todayStr(), every = Object.hasOwn(EVERY, r.every) ? r.every : d.every;
    const due = !scheduled(every) ? "" : r.last ? after(r.last, every) : r.since || today;
    const from = due && addDays(due, -WINDOW_DAYS), overdue = !!due && due < today;
    return { def: d, every, minutes: r.minutes, last: r.last, due, from, overdue, soon: !!due && !overdue && from <= today, metToday: r.last === today };
  }
  const states = A => (A && A.started ? defsOf(A).map(d => stateOf(A, d)) : []);

  // "today", "yesterday", "12 days ago".
  const ago = date => { const n = daysBetween(date, todayStr()); return n === 0 ? "today" : n === 1 ? "yesterday" : n > 0 ? `${n} days ago` : `on ${fmtShort(date)}`; };
  const lastText = s => (s.metToday ? "met today ✓" : s.last ? `last met ${ago(s.last)}` : "not met yet");
  const dueText = s => (s.overdue ? `overdue since ${fmtShort(s.due)}` : !s.soon ? "" : s.due === todayStr() ? "due today" : `due ${fmtWeekday(s.due)}`);

  // What an app's meetings ask of Momo between from and to (core/inbox.js checks them), as [{ A, need, after, at }]: one
  // met then shows done ✓ on its day; the next, once due by `to`, fills a block in its week, or the soonest once
  // overdue. One never had yet is wanted now: the soonest block.
  function needsOf(A, from, to) {
    const today = todayStr();
    return states(A).filter(s => s.due).flatMap(s => {
      const d = s.def, every = EVERY[s.every], out = [], now = !s.last && s.due <= today;
      const base = { title: d.title, block: BLOCK, minutes: s.minutes, details: [`${every[0].toUpperCase()}${every.slice(1)} · ${lastText(s)}`] };
      if (s.last && s.last >= from && s.last <= to) out.push({ ...base, id: `meeting:${d.id}:${s.last}`, date: s.last, done: true });
      if (s.due <= to) out.push({ ...base, id: `meeting:${d.id}:${s.due}`, due: now ? null : s.due, from: now || s.overdue ? null : s.from, overdue: s.overdue });
      return out.map(need => ({ A, need, after: d.after, at: need.date || s.due }));
    });
  }

  // Every started app's, as [{ A, need }]: soonest first, and those that come after (Momo's) after all the others.
  const needs = (from, to) => K.order.map(id => K.apps[id]).filter(A => A.started).flatMap(A => needsOf(A, from, to))
    .sort((a, b) => a.after - b.after || a.at.localeCompare(b.at))
    .map(({ A, need }) => ({ A, need }));

  // A dot on the app's icon while a meeting is overdue (core/shell.js).
  const attention = A => (states(A).some(s => s.overdue) ? "its meeting is overdue" : "");

  // For bug reports: how each stands, without dates.
  function bugLine(A) {
    const today = todayStr();
    return states(A).map(s => `${s.def.id} ${scheduled(s.every) ? `every ${s.every}` : s.every}, ${s.last ? `met ${daysBetween(s.last, today)} days ago` : "not met yet"}` +
      (!s.due ? "" : s.overdue ? `, overdue by ${daysBetween(s.due, today)} days` : `, due in ${daysBetween(today, s.due)} days`)).join("; ") || "none";
  }

  // --- The header line ---
  // The app on screen's meetings: each one's words (a button to its settings) and Done ✓ (not once met today, nor when off).
  // A checkup (no schedule) just says when you last did it: "Last checkup: 12 days ago".
  let shown = null; // the line as last drawn, so the minute tick leaves it (and focus on its buttons) alone
  function render() {
    const A = K.active(), list = states(A), box = $("kMeeting");
    const html = list.map(s => {
      const off = s.every === "off", words = s.every === "whenever"
        ? `Last ${s.def.title.toLowerCase()}: ${s.metToday ? "today ✓" : s.last ? ago(s.last) : "not yet"}`
        : [`Meeting: ${s.def.title}`, EVERY[s.every]].concat(off ? [] : [lastText(s), dueText(s)]).filter(Boolean).join(" · ");
      return `<div class="meeting${s.overdue ? " overdue" : s.due === todayStr() ? " due" : off ? " off" : ""}">` +
        `<button type="button" class="meeting-text" data-meet="${esc(s.def.id)}" title="Settings">${esc(words)}</button>` +
        (off || s.metToday ? "" : `<button type="button" class="secondary small" data-done="${esc(s.def.id)}" title="Mark it done today">Done ✓</button>`) + `</div>`;
    }).join("");
    box.hidden = !list.length;
    if (html !== shown) box.innerHTML = shown = html;
  }
  // After a change here: every app catches up as on the minute tick, so Momo's blocks show it at once, then the
  // line and the dots (K.tick does both).
  const refresh = () => K.tick();

  // Done ✓: met today.
  function done(A, id) {
    const d = defsOf(A).find(x => x.id === id);
    if (d) save(A, id, { ...recOf(A, d), last: todayStr() });
  }

  // "Open in <App>" for a meeting (core/inbox.js shows the app first): its line comes into view and flashes.
  function reveal(A) {
    if (K.active() !== A) return;
    const box = $("kMeeting");
    box.scrollIntoView({ block: "center", behavior: "smooth" });
    box.classList.remove("flash");
    void box.offsetWidth; // so the flash starts again
    box.classList.add("flash");
  }

  // --- Sync and backups ---
  // For the app's sync file and backups: its meetings as kept.
  const build = A => ({ ...(A._meet || {}) });

  // Another copy's meetings (a sync folder save, or a backup) with ours: for each, the later change wins, the same on
  // every device. { same: the result is theirs, apply(): keeps the result, false if nothing changed here }.
  const newer = (a, b) => a.u > b.u || (a.u === b.u && JSON.stringify(a) > JSON.stringify(b));
  function merge(A, raw) {
    const theirs = cleanAll(raw), ours = A._meet || {}, next = { ...ours };
    Object.keys(theirs).forEach(id => { if (!next[id] || newer(theirs[id], next[id])) next[id] = theirs[id]; });
    const result = JSON.stringify(cleanAll(next));
    return {
      same: result === JSON.stringify(theirs),
      apply() {
        if (result === JSON.stringify(cleanAll(ours))) return false;
        A._meet = JSON.parse(result);
        store(A);
        return true;
      }
    };
  }

  // A backup was imported into the app (Import JSON, Import all): its meetings join ours, the later change winning,
  // so an older backup never sets a meeting back.
  function take(A, raw) {
    if (merge(A, raw).apply()) refresh(); // the app's import already counted the change (A.changed), and its autosave carries these
  }

  // --- The settings pop-up ---
  const overlay = () => $("kMeetOverlay");
  const fields = () => [$("kMeetEvery").value, $("kMeetMinutes").value, $("kMeetLast").value].join("|");

  function openSettings(A, id) {
    const d = defsOf(A).find(x => x.id === id);
    if (!d) return;
    const s = stateOf(A, d);
    $("kMeetTitle").textContent = `${A.meta.name}: ${d.title}`;
    $("kMeetEvery").value = s.every;
    $("kMeetMinutes").value = s.minutes;
    $("kMeetLast").value = s.last;
    $("kMeetLast").max = todayStr();
    setStatus("");
    editing = { A, id, start: fields() };
    K.modal.open(overlay());
    $("kMeetEvery").focus();
  }

  function setStatus(text) {
    $("kMeetStatus").textContent = text;
    $("kMeetStatus").className = `modal-status${text ? " bad" : ""}`;
  }

  function saveSettings() {
    if (!editing) return;
    const { A, id } = editing, d = defsOf(A).find(x => x.id === id);
    const every = $("kMeetEvery").value, minutes = Math.round(readNumber($("kMeetMinutes"))), last = $("kMeetLast").value;
    if (!cleanMinutes(minutes)) return setStatus(`How long: ${MIN_MINUTES} to ${MAX_MINUTES} minutes.`);
    if (last && (!isDate(last) || last > todayStr() || last < "2000-01-01")) return setStatus("Last time: a day from 2000 up to today, or leave it empty.");
    close();
    if (!d || !Object.hasOwn(EVERY, every)) return;
    const s = stateOf(A, d), r = recOf(A, d);
    // Clearing last met starts it afresh, wanted now, rather than overdue since it was first seen.
    if (every !== s.every || minutes !== s.minutes || last !== s.last) save(A, id, { ...r, every, minutes, last, since: !last && s.last ? todayStr() : r.since });
  }

  function close() {
    editing = null;
    K.modal.close(overlay());
  }

  function init() {
    $("kMeetEvery").innerHTML = Object.keys(EVERY).map(k => `<option value="${k}">${k === "off" ? "Off" : k === "whenever" ? "Whenever" : `Every ${k}`}</option>`).join("");
    K.modal.define(overlay(), {
      dismiss: close,
      pending: () => !!editing && fields() !== editing.start,
      ask: "Discard your changes?"
    });
    $("kMeetSave").addEventListener("click", saveSettings);
    $("kMeetCancel").addEventListener("click", () => K.modal.requestDismiss(overlay()));
    overlay().addEventListener("keydown", e => {
      if (e.key === "Enter" && e.target.tagName === "INPUT") { e.preventDefault(); saveSettings(); }
    });
    $("kMeeting").addEventListener("click", e => {
      const A = K.active(), btn = e.target.closest("button");
      if (!A || !btn) return;
      if (btn.dataset.done) done(A, btn.dataset.done);
      else if (btn.dataset.meet) openSettings(A, btn.dataset.meet);
    });
  }

  K.meetings = { BLOCK, init, load, needs, attention, bugLine, render, reveal, build, merge, take };
})(Kyoshi);
