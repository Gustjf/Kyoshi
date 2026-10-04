/* Turtleduck · times.js — when things usually happen, for Momo's baseline (share.js routine): the "Times & trips" pop-up
 * (#timesOverlay: from the plan's ⋯ menu, Groceries → Settings, and Momo's "Set in Turtleduck") with each meal's usual
 * time and length, the Cook row's usual time, the grocery trips every week (a weekday each, at a time) and the usual time
 * of a trip placed by hand; and a day's own time for a meal, the Cook row or a trip (setSlotTime: from the meal's pop-up
 * or a trip's list; the usual time again clears it, kept as "" so the clearing wins when two devices combine). Every
 * time sits on Momo's 15-minute grid. */
(function (K, A) {
  "use strict";
  const S = A.S, $ = A.$;
  const { esc } = K.util;
  const { SLOTS, MIN_LENGTH, MAX_LENGTH, own, kept, onGrid, usualTime, mealTitle } = A;
  const overlay = () => $("timesOverlay");
  const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

  // A day's own time for a meal's slot, the Cook row or a trip (kind: "breakfast" … "cook", "trip"); the usual time (or
  // "") puts it back to the usual. Nothing changes when it's already so.
  function setSlotTime(date, kind, time) {
    const key = `${date}:${kind}`, usual = usualTime(kind, date), next = !time || time === usual ? "" : time;
    if (next && !onGrid(next)) return;
    if (own(S.slotTimes, key) ? S.slotTimes[key].time === next : !next) return;
    S.slotTimes[key] = { time: next, u: Date.now() };
    kept();
  }

  // ==========================================================================
  // THE POP-UP
  // ==========================================================================
  // A weekly trip's row: its weekday and time, and ✕.
  const tripRowHTML = (s, i) => `<div class="trip-row" data-row="${i}"><select data-trip-day aria-label="Trip day">${DAYS.map((d, k) => `<option value="${k}"${k === s.day ? " selected" : ""}>${d}</option>`).join("")}</select>` +
    `<input type="time" step="900" data-trip-time value="${esc(s.time)}" aria-label="Trip time"><button type="button" class="icon-btn" data-trip-remove aria-label="Take this trip day off">&times;</button></div>`;
  const rows = () => [...$("tripRows").querySelectorAll(".trip-row")].map(r => ({ day: +r.querySelector("select").value, time: r.querySelector("input").value }));
  function renderTripRows(list) {
    $("tripRows").innerHTML = list.map(tripRowHTML).join("") || `<div class="times-none">None yet: trips go on the days you tap the cart.</div>`;
    $("tripAddBtn").disabled = list.length >= 7;
  }
  // What's on the form, to tell whether closing it would lose changes.
  const formState = () => JSON.stringify([[...SLOTS, "cook", "trip"].map(k => $(`time_${k}`).value), SLOTS.map(k => $(`len_${k}`).value), rows()]);

  function openTimes() {
    const st = S.settings;
    [...SLOTS, "cook", "trip"].forEach(k => { $(`time_${k}`).value = st.times[k]; });
    SLOTS.forEach(k => { $(`len_${k}`).value = String(st.lengths[k]); });
    renderTripRows(st.schedule);
    $("timesStatus").textContent = "";
    S.timesSnapshot = formState();
    K.modal.open(overlay());
  }
  const closeTimes = () => { K.modal.close(overlay()); S.timesSnapshot = null; };

  // Another weekday's trip, at the usual time for other trips: the first weekday without one.
  function addTripRow() {
    const list = rows(), free = [5, 6, 0, 1, 2, 3, 4].find(d => !list.some(s => s.day === d));
    if (free === undefined) return;
    renderTripRows(list.concat([{ day: free, time: $("time_trip").value || S.settings.times.trip }]));
  }

  // Checks the form and keeps it, or says what's wrong (and marks the field).
  function saveTimes() {
    const say = (el, why) => { $("timesStatus").textContent = why; if (el) el.focus(); };
    const time = el => (el.validity.badInput || !el.value ? null : el.value);
    const times = {}, lengths = {};
    for (const k of [...SLOTS, "cook", "trip"]) {
      const el = $(`time_${k}`), t = time(el), name = k === "trip" ? "Other trips" : k === "cook" ? "Cooking" : mealTitle(k);
      if (!t) return say(el, `${name}: give it a time.`);
      if (!onGrid(t)) return say(el, `${name}: times go in 15-minute steps (:00, :15, :30 or :45), as in Momo.`);
      times[k] = t;
    }
    for (const k of SLOTS) {
      const el = $(`len_${k}`), v = el.validity.badInput ? NaN : Number(el.value);
      if (!el.value || !Number.isInteger(v) || v < MIN_LENGTH || v > MAX_LENGTH || v % 5) return say(el, `${mealTitle(k)}: a usual length from ${MIN_LENGTH} to ${MAX_LENGTH} minutes, in 5-minute steps.`);
      lengths[k] = v;
    }
    const schedule = [], els = [...$("tripRows").querySelectorAll(".trip-row")];
    for (const r of els) {
      const day = +r.querySelector("select").value, input = r.querySelector("input"), t = time(input);
      if (schedule.some(s => s.day === day)) return say(r.querySelector("select"), `${DAYS[day]} is there twice: one trip a day.`);
      if (!t || !onGrid(t)) return say(input, `${DAYS[day]}'s trip: a time in 15-minute steps (:00, :15, :30 or :45).`);
      schedule.push({ day, time: t });
    }
    schedule.sort((a, b) => a.day - b.day);
    const st = S.settings, same = JSON.stringify([st.times, st.lengths, st.schedule]) === JSON.stringify([times, lengths, schedule]);
    closeTimes();
    if (same) return;
    S.settings = { ...st, times, lengths, schedule, u: Date.now() };
    kept();
  }

  function wireTimes() {
    K.modal.define(overlay(), { dismiss: closeTimes, pending: () => !!S.timesSnapshot && formState() !== S.timesSnapshot, ask: "Discard your changes to the times?" });
    $("timesSaveBtn").addEventListener("click", saveTimes);
    $("timesCancelBtn").addEventListener("click", closeTimes);
    $("tripAddBtn").addEventListener("click", addTripRow);
    $("tripRows").addEventListener("click", e => {
      const b = e.target.closest("[data-trip-remove]");
      if (!b) return;
      const i = +b.closest(".trip-row").dataset.row;
      renderTripRows(rows().filter((_, k) => k !== i));
    });
    // Enter in a field saves.
    overlay().addEventListener("keydown", e => { if (e.key === "Enter" && e.target.matches("input")) { e.preventDefault(); saveTimes(); } });
  }

  Object.assign(A, { setSlotTime, openTimes, wireTimes });
})(Kyoshi, Kyoshi.apps.turtleduck);
