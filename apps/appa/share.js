/* Appa · share.js — what Appa shares with other apps. Momo's Tasks read momoTasks() (read-only copies):
 * one task per thing with anything to do in the next LEAD_DAYS days (or overdue), each item with the
 * minutes it takes, and a meter check when a fresh reading is asked for. Momo's "Open in Appa" calls
 * openFromMomo(id), which shows the thing's first due job (or the reading pop-up). Keep momoTasks'
 * shape, or change Momo's tasks.js along with it (apps/appa/CLAUDE.md). */
(function (K, A) {
  "use strict";
  const { LEAD_DAYS, DEFAULT_MINUTES, READING_MINUTES, meterOf, momoTitle } = A;

  // [{ id (the thing's), title ("<name> maintenance"), items: [{ id (a job's, or "reading"), name, minutes,
  // due ("YYYY-MM-DD" or ""), overdue }] }], things in name order, their items soonest first.
  const tasks = () => A.remember("momo", () => A.activeThings().map(thing => {
    const items = A.jobsOf(thing.id).map(job => ({ job, due: A.dueOf(job) }))
      .filter(x => x.due.overdue || (x.due.date && x.due.days <= LEAD_DAYS))
      .sort((a, b) => b.due.overdue - a.due.overdue || (a.due.date || "").localeCompare(b.due.date || ""))
      .map(({ job, due }) => ({ id: job.id, name: job.name, minutes: A.minutesOf(job) || DEFAULT_MINUTES, due: due.date || "", overdue: due.overdue }));
    if (A.readingAsk(thing)) items.push({ id: "reading", name: `Check the ${meterOf(thing).reading.toLowerCase()}`, minutes: READING_MINUTES, due: "", overdue: false });
    return items.length ? { id: thing.id, title: momoTitle(thing), items } : null;
  }).filter(Boolean));
  const momoTasks = () => JSON.parse(JSON.stringify(tasks())); // copies: Momo can't change Appa's data through them

  // From Momo's "Open in Appa": the thing's first due job in the job view (the rest follow it, see
  // job-view.js), else its reading pop-up when a reading is all that's asked for, else the thing.
  function openFromMomo(thingId) {
    K.show(A.id);
    const thing = A.thingById(thingId);
    if (!thing) return A.showView("home");
    const task = tasks().find(t => t.id === thingId), jobs = task ? task.items.filter(i => i.id !== "reading") : [];
    if (jobs.length) return A.openJob(jobs[0].id);
    if (task) { A.showView("thing", thingId); return A.openReading(thingId); }
    A.showView("thing", thingId);
  }

  Object.assign(A, { momoTasks, openFromMomo });
})(Kyoshi, Kyoshi.apps.appa);
