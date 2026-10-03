/* Momo · weekends.js — Upcoming weekends, so they get spent on purpose: a folded line under the board and under Today
 * ("Upcoming weekends · 4 of 13 planned · next without a plan: Oct 18"), closed at first, opening into the next
 * WEEKENDS weekends from this one (on a Saturday or Sunday, the one it's in; else the coming one): each its days and
 * its plan, cut short, in green, or "No plan" in red. The board's Saturday heading (this week's and next week's) shows
 * the plan too. Tapping a weekend, or that plan, opens its pop-up (#weekendOverlay) to type a brief one: Save, Clear,
 * Cancel. A plan is just a note, kept by its Saturday (data.weekends, model.js): it takes none of the week's hours. */
(function (K, A) {
  "use strict";
  const S = A.S, $ = A.$;
  const { esc, addDays, todayStr, fmtShort } = K.util;
  const { WEEKENDS, PLAN_MAX, DAY_NAMES, cleanText, dayIndex } = A;

  const SHORT = 40; // a plan's length on its weekend's tile, cut beyond it

  // This weekend's Saturday (today's or yesterday's on a weekend, else the coming one), then the next ones.
  function upcomingWeekends() {
    const today = todayStr(), d = dayIndex(today), sat = addDays(today, d === 6 ? -1 : 5 - d);
    return Array.from({ length: WEEKENDS }, (_, i) => addDays(sat, 7 * i));
  }
  const planOf = sat => (S.data.weekends[sat] ? S.data.weekends[sat].plan : "");

  // "Oct 11–12" (across a month: "Oct 31–Nov 1"), and "Sat Oct 11 – Sun Oct 12".
  function daysOf(sat) {
    const sun = addDays(sat, 1);
    return `${fmtShort(sat)}–${sat.slice(5, 7) === sun.slice(5, 7) ? +sun.slice(8) : fmtShort(sun)}`;
  }
  const longDays = sat => `${DAY_NAMES[5]} ${fmtShort(sat)} – ${DAY_NAMES[6]} ${fmtShort(addDays(sat, 1))}`;
  const cut = s => ([...s].length > SHORT ? `${[...s].slice(0, SHORT - 1).join("").trimEnd()}…` : s);

  // A weekend's tile: its days, then its plan (cut short) or "No plan".
  function tileHTML(sat) {
    const plan = planOf(sat);
    return `<button type="button" class="weekend" data-weekend="${sat}" title="${esc(`${longDays(sat)}: ${plan || "no plan yet"}`)}">` +
      `<span class="we-days">${esc(daysOf(sat))}</span><span class="we-plan${plan ? "" : " none"}">${esc(plan ? cut(plan) : "No plan")}</span></button>`;
  }

  // Both folds (render.js renderAll): how many of the weekends have a plan and the first without one, then the tiles.
  // Each stays open or closed as it is.
  let drawn = "";
  function renderWeekends() {
    const sats = upcomingWeekends(), next = sats.find(sat => !planOf(sat));
    const summary = `<span class="we-head">Upcoming weekends</span> · ${sats.filter(planOf).length} of ${sats.length} planned` +
      (next ? ` · next without a plan: ${esc(fmtShort(next))}` : "");
    const tiles = sats.map(tileHTML).join(""), boxes = A.root.querySelectorAll("details.weekends");
    if (!boxes.length || summary + tiles === drawn) return; // unchanged: a tile keeps its focus
    drawn = summary + tiles;
    boxes.forEach(box => {
      box.querySelector("summary").innerHTML = summary;
      box.querySelector(".weekend-list").innerHTML = tiles;
    });
  }

  // The board's heading for a day of a week (render.js renderBoard): on Saturday its weekend's plan (tapping it opens
  // the pop-up), on the other days an empty line as tall, so every day's cards still start level. None without a plan.
  function headPlanHTML(key, d) {
    const sat = key === "base" ? "" : addDays(key, 5), plan = sat ? planOf(sat) : "";
    if (!plan) return "";
    return d !== 5 ? `<div class="col-plan" aria-hidden="true"></div>`
      : `<button type="button" class="col-plan" data-weekend="${sat}" title="${esc(`${longDays(sat)}: ${plan}`)}">${esc(plan)}</button>`;
  }

  // ==========================================================================
  // A WEEKEND'S POP-UP
  // ==========================================================================
  const overlay = () => $("weekendOverlay");
  const typed = () => cleanText($("weekendPlan").value, PLAN_MAX);

  function openWeekend(sat) {
    S.weekend = sat;
    $("weekendTitle").textContent = longDays(sat);
    $("weekendPlan").value = planOf(sat);
    $("weekendClearBtn").hidden = !planOf(sat);
    K.modal.open(overlay());
    $("weekendPlan").focus();
  }
  function closeWeekend() {
    S.weekend = null;
    K.modal.close(overlay());
  }

  // Keeps a weekend's plan, or "" once cleared: with its time (save() stamps it), so clearing it wins over an older
  // copy's plan on another device too. An empty Save clears it.
  function setPlan(sat, plan) {
    const had = S.data.weekends[sat];
    if ((had ? had.plan : "") === plan) return;
    S.data.weekends[sat] = { plan, u: had ? had.u : 0 };
    A.save();
    A.renderAll();
  }
  function saveWeekend() {
    const sat = S.weekend, plan = typed();
    closeWeekend();
    if (sat) setPlan(sat, plan);
  }
  function clearWeekend() {
    const sat = S.weekend;
    closeWeekend();
    if (sat) setPlan(sat, "");
  }

  // Esc, × and a click beside it ask first if the plan was changed (core/modal.js); Cancel doesn't. A weekend's tile,
  // or its plan on the board, opens it (Alt+click, which deletes cards on the board, doesn't).
  function initWeekends() {
    K.modal.define(overlay(), {
      dismiss: closeWeekend,
      pending: () => !!S.weekend && typed() !== planOf(S.weekend),
      ask: "Discard your changes to this weekend's plan?"
    });
    $("weekendSaveBtn").addEventListener("click", saveWeekend);
    $("weekendClearBtn").addEventListener("click", clearWeekend);
    $("weekendCancelBtn").addEventListener("click", () => K.modal.dismiss(overlay()));
    A.root.addEventListener("click", e => {
      const el = e.target.closest("[data-weekend]");
      if (el && !e.altKey && !S.suppressClick) openWeekend(el.dataset.weekend);
    });
  }

  Object.assign(A, { upcomingWeekends, planOf, renderWeekends, headPlanHTML, saveWeekend, initWeekends });
})(Kyoshi, Kyoshi.apps.momo);
