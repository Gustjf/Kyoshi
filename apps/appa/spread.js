/* Appa · spread.js — Spread out due dates (Developer Mode): jobs entered on one evening come due the same week, and again
 * in step after; this moves the next due day of some by a few days so the coming weeks are even (core/level.js works it
 * out; core/spread.js shows it and asks). Only a job's day by time or season moves, while it's the sooner of time and
 * meter: a job by the meter alone never does. A move is kept on the job as `moved: { from, to }` (model.js) and holds
 * while the usual day by time is still `from` (schedule.js dueOf): a record, or a new schedule, makes it another day and
 * the next counts from that as always. Apply replaces every move kept with the new plan (stamping only the jobs whose
 * moves change; one save), so spreading again gives the same plan. Put them back lets every move go, after a question. */
(function (K, A) {
  "use strict";
  const S = A.S;
  const { esc, todayStr } = K.util;

  const UNIT_DAYS = { d: 1, w: 7, m: 30, y: 365 };
  // How often a job comes by time, in days (a season job: a year over its seasons); null for none.
  const intervalOf = job => (job.every ? job.every.n * UNIT_DAYS[job.every.unit] : job.seasons.length ? Math.round(365 / job.seasons.length) : null);
  // The live jobs on the things in use whose next day by time can move, with that usual day (as if nothing were moved).
  function items() {
    return A.activeThings().flatMap(t => A.jobsOf(t.id).map(job => ({ t, job, d: A.dueOf(job) }))
      .filter(({ job, d }) => d.usual && intervalOf(job) && (!d.meterDate || d.usual <= d.meterDate))
      .map(({ t, job, d }) => ({ id: job.id, title: `${t.name}: ${job.name}`, due: d.usual, minutes: A.minutesOf(job) || 30, intervalDays: intervalOf(job) })));
  }
  // The moves that hold and matter: the day by time is the one due (not a sooner meter).
  const holds = job => { const d = A.dueOf(job); return d.moved && d.by === "time"; };
  const movedNow = () => A.live(S.jobs).filter(holds).map(job => ({ id: job.id, to: job.moved.to }));
  const kept = () => A.live(S.jobs).filter(job => job.moved).length; // stale ones too

  // Each job takes its move from the plan, or none; the jobs whose moves change are stamped; one save.
  function keep(moves) {
    const by = new Map(moves.map(m => [m.id, { from: m.from, to: m.to }])), now = Date.now();
    let changed = false;
    A.live(S.jobs).forEach(job => {
      const m = by.get(job.id) || null;
      if (JSON.stringify(m) === JSON.stringify(job.moved || null)) return;
      if (m) job.moved = m; else delete job.moved;
      job.u = now;
      changed = true;
    });
    if (changed) A.save();
    A.renderAll();
    A.refreshDev();
  }

  function open() {
    K.dev.toggle(); // the pop-up is the page's, over it
    K.spread.show({ what: "jobs", items: items(), current: movedNow(), apply: keep });
  }
  function putBack() {
    const n = kept();
    if (!n || !confirm(`Put the ${n} moved due date${n > 1 ? "s" : ""} back where ${n > 1 ? "they were" : "it was"}?`)) return;
    keep([]);
  }

  // Developer Mode's block (events.js renderDev): the button, and Put them back while any is moved.
  function spreadDevHTML() {
    const n = movedNow().length;
    return `<div class="dev-block"><button class="secondary small" id="appaSpreadBtn">Spread out due dates…</button>` +
      (kept() ? ` <button class="secondary small" id="appaSpreadBack">Put them back</button>` : "") +
      `<div class="dev-hint">${n ? esc(`${n} due date${n > 1 ? "s are" : " is"} moved now. `) : ""}Evens out the coming weeks when many jobs come due together.</div></div>`;
  }
  function wireSpread(box) {
    box.querySelector("#appaSpreadBtn").addEventListener("click", open);
    const back = box.querySelector("#appaSpreadBack");
    if (back) back.addEventListener("click", putBack);
  }

  Object.assign(A, { spreadDevHTML, wireSpread });
})(Kyoshi, Kyoshi.apps.appa);
