/* Pabu · spread.js — Spread out due dates (Developer Mode): calls, texts and visits entered on one evening all come due
 * the same week, and again in step every month after; this moves the next due date of some by a few days so the coming
 * weeks are even (core/level.js works it out; core/spread.js shows it and asks). A move is kept on the call, text or
 * visit as `moved: { from, to }` (data.js), and holds while its usual due is still `from` (app.js isMoved): once you
 * talk, or change how often, the next counts from what you did, so the spread holds by itself. Weekly ones never move.
 * Apply replaces every move kept with the new plan (stamping only the people whose moves change; one save), so spreading
 * again gives the same plan. Put them back lets every move go, after a question. */
(function (K, A) {
  "use strict";
  const S = A.S;
  const { esc, todayStr } = K.util;

  const DAYS = { week: 7, "2weeks": 14, month: 30, quarter: 91, year: 365 }; // how often, in days (a week's can't move: core/level.js)
  const key = (p, c) => `${p.id}:${c.id}`;
  // Every call, text or visit with its usual due (as if nothing were moved): the weekly ones only weigh in their week.
  function items(today) {
    return A.live().flatMap(p => p.cadences.filter(c => DAYS[A.everyOf(c)]).map(c => ({
      id: key(p, c), title: A.needTitle(p, c), due: A.usualDue(p, c, today), minutes: c.minutes, intervalDays: DAYS[A.everyOf(c)]
    })));
  }
  const movedNow = today => A.live().flatMap(p => p.cadences.filter(c => A.isMoved(p, c, today)).map(c => ({ id: key(p, c), to: c.moved.to })));
  const kept = () => A.live().reduce((k, p) => k + p.cadences.filter(c => c.moved).length, 0); // stale ones too

  // Each call, text or visit takes its move from the plan, or none; people whose moves change are stamped; one save.
  function keep(moves) {
    const by = new Map(moves.map(m => [m.id, { from: m.from, to: m.to }]));
    let changed = false;
    A.live().forEach(p => {
      let mine = false;
      p.cadences = p.cadences.map(c => {
        const m = by.get(key(p, c)) || null, had = c.moved || null;
        if (JSON.stringify(m) === JSON.stringify(had)) return c;
        mine = true;
        const { moved, ...rest } = c;
        return m ? { ...rest, moved: m } : rest;
      });
      if (mine) { p.u = Date.now(); changed = true; }
    });
    if (changed) A.save();
    A.renderAll();
    A.refreshDev();
  }

  function open() {
    const today = todayStr();
    K.dev.toggle(); // the pop-up is the page's, over it
    K.spread.show({ what: "calls, texts and visits", items: items(today), current: movedNow(today), apply: keep });
  }
  function putBack() {
    const n = kept();
    if (!n || !confirm(`Put the ${n} moved due date${n > 1 ? "s" : ""} back where ${n > 1 ? "they were" : "it was"}?`)) return;
    keep([]);
  }

  // Developer Mode's block (events.js renderDev): the button, and Put them back while any is moved.
  function spreadDevHTML() {
    const n = movedNow(todayStr()).length;
    return `<div class="dev-block"><button class="secondary small" id="pabuSpreadBtn">Spread out due dates…</button>` +
      (kept() ? ` <button class="secondary small" id="pabuSpreadBack">Put them back</button>` : "") +
      `<div class="dev-hint">${n ? esc(`${n} due date${n > 1 ? "s are" : " is"} moved now. `) : ""}Evens out the coming weeks when many calls, texts and visits come due together.</div></div>`;
  }
  function wireSpread(box) {
    box.querySelector("#pabuSpreadBtn").addEventListener("click", open);
    const back = box.querySelector("#pabuSpreadBack");
    if (back) back.addEventListener("click", putBack);
  }

  Object.assign(A, { spreadDevHTML, wireSpread });
})(Kyoshi, Kyoshi.apps.pabu);
