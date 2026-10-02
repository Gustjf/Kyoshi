/* Badgermole · share.js — what Badgermole shares with other apps. Momo reads inbox() (core/inbox.js; read-only
 * copies), filling your cards titled "Workout", one need a card: each session done between from and to, on its day
 * (✓ on that day's card), then — once a routine is in the program — for each week from from's to to's, the weekly
 * target less the sessions done that week, in program order from the next routine (by that week's Sunday); what
 * doesn't fit is a "Workout · Legs" task in Momo's Tasks. Momo's "Open in Badgermole" calls open(id): a done
 * session's day pop-up, or Home's Next up. The needs' ids are "session:<id>" and "next:<Monday>:<slot>": change
 * open() along with them (apps/badgermole/CLAUDE.md). */
(function (K, A) {
  "use strict";
  const S = A.S;
  const { addDays, todayStr } = K.util;
  const { BLOCK, plural, fmtMinutes, fmtDay, mondayOf } = A;
  const DONE = "session:";

  // A done session: on its day, ✓.
  const doneNeed = s => {
    const m = A.sessionMinutes(s);
    return {
      id: `${DONE}${s.id}`, title: s.name || BLOCK, block: BLOCK, fill: "block", date: s.date, done: true,
      details: [plural(A.exerciseCount(s), "exercise"), m ? fmtMinutes(m) : ""].filter(Boolean)
    };
  };
  // A workout to do that week (slot n of its target): the routine, how long it usually takes, when it was last done.
  const plannedNeed = (r, monday, n) => {
    const last = A.lastOf(r.id);
    return {
      id: `next:${monday}:${n}`, title: r.name, block: BLOCK, fill: "block", minutes: A.usualMinutes(r.id),
      from: monday, due: addDays(monday, 6),
      details: [plural(A.routineItems(r).length, "exercise"), last ? `Last: ${fmtDay(last.date)}` : "Not done yet"]
    };
  };

  // [{ id, title, block: "Workout", fill: "block", … }]: made afresh on every call, so Momo can't change Badgermole's
  // data through them. A week's slots keep their ids as sessions are logged (logging takes the lowest), and the
  // rotation carries on from one week to the next.
  function inbox(from, to) {
    const today = todayStr(), target = S.settings.weeklyTarget;
    const out = A.sessions().filter(s => s.date >= from && s.date <= to).map(doneNeed);
    if (A.nextIndex() < 0) return out; // nothing planned until a routine is in the program
    let offset = 0;
    for (let monday = mondayOf(from); monday <= to; monday = addDays(monday, 7)) {
      if (addDays(monday, 6) < today) continue;
      const done = A.weekCount(monday);
      for (let n = done + 1; n <= target; n++) out.push(plannedNeed(A.upNext(offset++), monday, n));
    }
    return out;
  }

  // From Momo's "Open in Badgermole" (core/inbox.js puts Badgermole on screen first): a done session's day pop-up
  // (nothing once it's deleted), else Home with Next up flashing.
  function open(id) {
    const s = String(id);
    A.showView("home");
    if (!s.startsWith(DONE)) return A.reveal(A.$("nextUp"));
    const session = A.sessionById(s.slice(DONE.length));
    if (session) A.openDay(session.date, session.id);
  }

  Object.assign(A, { inbox, open });
})(Kyoshi, Kyoshi.apps.badgermole);
