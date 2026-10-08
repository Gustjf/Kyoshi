/* Appa · share.js — what Appa shares with other apps. Momo reads inbox(from, to) (core/inbox.js; read-only copies):
 * each job due in the next LEAD_DAYS days and by `to` (or overdue), and a meter check when a fresh reading is asked
 * for, each a card of its own in Momo (fill "card": "Car: Oil change", as long as it takes), waiting in Momo's Tasks
 * until you place it; then each job recorded between from and to, done on its record's day and completing that job's
 * (of: its id), so ✓ shows on its card, or on one of its own on that day, instead of the job vanishing.
 * Momo's "Open in Appa" calls open(id), which shows the job (or the reading pop-up, or the record). Keep the needs'
 * ids, or change open() along with them (apps/appa/CLAUDE.md). */
(function (K, A) {
  "use strict";
  const { todayStr } = K.util;
  const { LEAD_DAYS, DEFAULT_MINUTES, READING_MINUTES, MAX_THING, meterOf, fmtDay } = A;
  const READING = "reading:"; // a reading ask's id: this, then its thing's
  const DONE = "done:";       // a recorded job's: this, its record's id, ":" and its job's (or the record's alone, for other work)
  // A card's title in Momo: the thing, then what's to do ("Car: Oil change"), so two things' jobs are told apart.
  const titled = (thing, what) => `${[...thing.name].slice(0, MAX_THING).join("")}: ${what}`;

  // [{ id (a job's, or READING and its thing's), title ("<name>: <job>"), fill: "card", details, minutes, due
  // ("YYYY-MM-DD" or ""), overdue }]: things in name order, each one's jobs soonest first, then its reading.
  const needs = () => A.remember("inbox", () => A.activeThings().flatMap(thing => {
    const list = A.jobsOf(thing.id).map(job => ({ job, due: A.dueOf(job) }))
      .filter(x => x.due.overdue || (x.due.date && x.due.days <= LEAD_DAYS))
      .sort((a, b) => b.due.overdue - a.due.overdue || (a.due.date || "").localeCompare(b.due.date || ""))
      .map(({ job, due }) => ({ id: job.id, title: titled(thing, job.name), fill: "card", details: [A.dueText(job)], minutes: A.minutesOf(job) || DEFAULT_MINUTES, due: due.date || "", overdue: due.overdue }));
    if (A.readingAsk(thing)) list.push({ id: READING + thing.id, title: titled(thing, `Check the ${meterOf(thing).reading.toLowerCase()}`), fill: "card", details: [], minutes: READING_MINUTES, due: "", overdue: false });
    return list;
  }));

  // The jobs recorded between from and to (up to today), each done on its record's day: [{ id, title (the thing and the
  // job as it's called now, or was then), fill: "card", details, minutes (the record's, else its estimate), date, done,
  // of (the job's id) }], by day.
  function recorded(from, to) {
    const today = todayStr();
    return A.recordsOf("").filter(r => r.date >= from && r.date <= to && r.date <= today && A.thingById(r.thingId)).reverse().flatMap(r => {
      const thing = A.thingById(r.thingId), base = { fill: "card", details: [`Recorded ${fmtDay(r.date)}${r.by ? ` · ${r.by}` : ""}`], date: r.date, done: true };
      const jobs = r.jobs.map(x => {
        const job = A.jobById(x.jobId);
        return { ...base, id: `${DONE}${r.id}:${x.jobId}`, title: titled(thing, (job || x).name || "A deleted job"), minutes: x.minutes || (job && A.minutesOf(job)) || DEFAULT_MINUTES, of: x.jobId };
      });
      return jobs.length ? jobs : [{ ...base, id: `${DONE}${r.id}`, title: titled(thing, r.title), minutes: r.minutes || DEFAULT_MINUTES }];
    });
  }

  // Copies, so Momo can't change Appa's data through them: what's due by `to`, then what was recorded from `from` on.
  function inbox(from, to) {
    const open = needs().filter(n => !to || n.overdue || !n.due || n.due <= to);
    return JSON.parse(JSON.stringify(open)).concat(from && to ? recorded(from, to) : []);
  }

  // From Momo's "Open in Appa" (core/inbox.js puts Appa on screen first): the job in the job view (the thing's other due
  // jobs follow it, see job-view.js), the thing's reading pop-up, or a record; home once it's gone.
  function open(id) {
    const s = String(id), thing = s.startsWith(READING) && A.thingById(s.slice(READING.length)), job = !thing && !s.startsWith(DONE) && A.jobById(s);
    if (thing) {
      A.showView("thing", thing.id);
      return A.openReading(thing.id);
    }
    if (job && A.thingById(job.thingId)) return A.openJob(job.id);
    const record = s.startsWith(DONE) && A.recordById(s.slice(DONE.length).split(":")[0]);
    if (record && A.thingById(record.thingId)) {
      A.showView("thing", record.thingId);
      return A.openRecord({ mode: "full", id: record.id });
    }
    A.showView("home");
  }

  Object.assign(A, { inbox, open });
})(Kyoshi, Kyoshi.apps.appa);
