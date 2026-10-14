/* Kyoshi · core/spread.js — K.spread: the "Spread out due dates" pop-up (#kSpreadOverlay, in index.html), opened from
 * the Developer Mode tools of an app that keeps schedules (Pabu, Appa). The app hands it its items (what's due when, how
 * long it takes, how often it comes) and what to do with the moves; K.level (level.js) works out the plan. It shows each
 * of the coming weeks' time before and after (a bar each, in hours), then each move ("Call Sam: Nov 2 → Nov 8"), and
 * Apply (after a question) hands the moves to the app, which keeps them on its items (their `moved`) and saves once.
 * Cancel, Esc, × or a click beside it change nothing. Nothing is kept here. */
(function (K) {
  "use strict";
  const $ = id => document.getElementById(id);
  const { esc, fmtShort, todayStr } = K.util;
  let open = null; // while it's open: { moves, apply }

  const hours = m => (m >= 60 ? `${Math.round(m / 15) / 4}h` : m ? `${Math.round(m)}m` : "0");
  const bar = (m, most) => `<span class="spread-bar"><span style="width:${most ? Math.round((100 * m) / most) : 0}%"></span></span>`;

  // spec: { what ("calls, texts and visits"), items: [{ id, title, due (the usual one, as if nothing were moved), minutes,
  // intervalDays }], current: the moves kept now ([{ id, to }]), apply(moves): keeps these, every other move let go }.
  function show(spec) {
    const today = todayStr(), moves = K.level.plan(spec.items, { today }), w = K.level.weeks(spec.items, moves, { today });
    const now = K.level.weeks(spec.items, spec.current || [], { today }).after;
    w.before = now; // the weeks as they are now, the moves kept included
    const most = Math.max(1, ...w.before, ...w.after), titles = new Map(spec.items.map(i => [i.id, i.title]));
    open = { moves, apply: spec.apply };
    $("kSpreadHint").textContent = `Moves the next due date of some ${spec.what} a few days, earlier or later, so the coming ` +
      `${w.mondays.length} weeks are even. Once done, the next one counts from that day as always.`;
    $("kSpreadWeeks").innerHTML = `<div class="spread-row spread-head"><span>Week of</span><span>Now</span><span>Spread out</span></div>` +
      w.mondays.map((d, k) => `<div class="spread-row"><span>${esc(fmtShort(d))}</span>` +
        `<span>${bar(w.before[k], most)}${hours(w.before[k])}</span><span>${bar(w.after[k], most)}${hours(w.after[k])}</span></div>`).join("");
    // What Apply changes: each move the plan makes that isn't kept already, then each kept move it lets go ("back to").
    const kept = new Map((spec.current || []).map(m => [m.id, m.to])), planned = new Set(moves.map(m => m.id));
    const usual = new Map(spec.items.map(i => [i.id, i.due]));
    const lines = moves.filter(m => kept.get(m.id) !== m.to).map(m => `${titles.get(m.id) || ""}: ${fmtShort(m.from)} → ${fmtShort(m.to)}`)
      .concat([...kept.keys()].filter(id => !planned.has(id) && usual.has(id)).map(id => `${titles.get(id) || ""}: back to ${fmtShort(usual.get(id))}`));
    open.changes = lines.length;
    $("kSpreadMoves").innerHTML = lines.length
      ? `<div class="spread-moves-head">${lines.length} due date${lines.length > 1 ? "s" : ""} would move:</div>` + lines.map(l => `<div class="spread-move">${esc(l)}</div>`).join("")
      : `<div class="note">Nothing to change: the coming weeks are as even as they can be.</div>`;
    $("kSpreadApply").disabled = !lines.length;
    K.modal.open($("kSpreadOverlay"));
  }
  function close() {
    open = null;
    K.modal.close($("kSpreadOverlay"));
  }
  function apply() {
    if (!open || !open.changes) return;
    const { moves, apply: keep } = open, n = open.changes;
    if (!confirm(`Move ${n} due date${n > 1 ? "s" : ""} to even out your weeks?`)) return;
    close();
    keep(moves);
  }

  function init() {
    K.modal.define($("kSpreadOverlay"), { dismiss: close });
    $("kSpreadApply").addEventListener("click", apply);
    $("kSpreadCancel").addEventListener("click", close);
  }
  K.spread = { show, init };
})(Kyoshi);
