/* Appa · share.js — what Appa shares with other apps. Momo reads inbox() (core/inbox.js; read-only copies):
 * each job due in the next LEAD_DAYS days (or overdue), with the minutes it takes, filling Momo's cards
 * titled "<name> maintenance" (each job whole), and a meter check when a fresh reading is asked for.
 * Momo's "Open in Appa" calls open(id), which shows the job (or the reading pop-up). Keep the needs' ids,
 * or change open() along with them (apps/appa/CLAUDE.md). */
(function (K, A) {
  "use strict";
  const { LEAD_DAYS, DEFAULT_MINUTES, READING_MINUTES, meterOf, momoTitle } = A;
  const READING = "reading:"; // a reading ask's id: this, then its thing's

  // [{ id (a job's, or READING and its thing's), title, block ("<name> maintenance"), details, minutes, due
  // ("YYYY-MM-DD" or ""), overdue }]: things in name order, each one's jobs soonest first, then its reading.
  const needs = () => A.remember("inbox", () => A.activeThings().flatMap(thing => {
    const block = momoTitle(thing);
    const list = A.jobsOf(thing.id).map(job => ({ job, due: A.dueOf(job) }))
      .filter(x => x.due.overdue || (x.due.date && x.due.days <= LEAD_DAYS))
      .sort((a, b) => b.due.overdue - a.due.overdue || (a.due.date || "").localeCompare(b.due.date || ""))
      .map(({ job, due }) => ({ id: job.id, title: job.name, block, details: [A.dueText(job)], minutes: A.minutesOf(job) || DEFAULT_MINUTES, due: due.date || "", overdue: due.overdue }));
    if (A.readingAsk(thing)) list.push({ id: READING + thing.id, title: `Check the ${meterOf(thing).reading.toLowerCase()}`, block, details: [], minutes: READING_MINUTES, due: "", overdue: false });
    return list;
  }));
  const inbox = () => JSON.parse(JSON.stringify(needs())); // copies: Momo can't change Appa's data through them

  // From Momo's "Open in Appa" (core/inbox.js puts Appa on screen first): the job in the job view (the
  // thing's other due jobs follow it, see job-view.js), or the thing's reading pop-up; home once it's gone.
  function open(id) {
    const s = String(id), thing = s.startsWith(READING) && A.thingById(s.slice(READING.length)), job = !thing && A.jobById(s);
    if (thing) {
      A.showView("thing", thing.id);
      return A.openReading(thing.id);
    }
    if (job && A.thingById(job.thingId)) return A.openJob(job.id);
    A.showView("home");
  }

  Object.assign(A, { inbox, open });
})(Kyoshi, Kyoshi.apps.appa);
