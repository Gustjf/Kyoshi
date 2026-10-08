/* Badgermole · share.js — what Badgermole shares with other apps. Momo reads inbox() (core/inbox.js; read-only
 * copies), each a card of its own in Momo (fill "card"), as long as its routine says (typed in its pop-up): each
 * session done between from and to, on its day (how long it took in its details), completing that week's planned
 * workout of its rank (the week's 2nd session: of "next:<Monday>:2"), so ✓ shows on that card, or on one of its own on
 * that day at the time it started; then — once a routine is in the program — for each week from from's to to's, the
 * weekly target less the sessions done that week, in program order from the next routine (by that week's Sunday), each
 * waiting in Momo's Tasks ("Legs") until you place it. Momo's "Open in Badgermole" calls open(id): a done session's
 * day pop-up, or Home's Next up. The needs' ids are "session:<id>" and "next:<Monday>:<slot>": change open() along
 * with them (apps/badgermole/CLAUDE.md). */
(function (K, A) {
  "use strict";
  const S = A.S;
  const { addDays, todayStr, pad2 } = K.util;
  const { MIN_ROUTINE_MINUTES, DEFAULT_MINUTES, plural, fmtMinutes, fmtDay, mondayOf } = A;
  const DONE = "session:";

  // A done session: on its day, ✓, the k-th of its week (the slot it took), from the time it started ("HH:MM", this
  // device's clock), as long as its routine says (one logged after the fact took a minute or two by the clock); its
  // routine gone, as long as it took, unless that's under 5 minutes or unknown (then 60). How long it took is in its
  // details.
  const doneNeed = (s, k) => {
    const m = A.sessionMinutes(s), r = A.routineById(s.routineId), at = s.started ? new Date(s.started) : null;
    return {
      id: `${DONE}${s.id}`, title: s.name || "Workout", fill: "card", date: s.date, done: true,
      minutes: r ? r.minutes : m >= MIN_ROUTINE_MINUTES ? m : DEFAULT_MINUTES,
      of: `next:${mondayOf(s.date)}:${k}`, time: at ? `${pad2(at.getHours())}:${pad2(at.getMinutes())}` : null,
      details: [plural(A.exerciseCount(s), "exercise"), m ? `took ${fmtMinutes(m)}` : ""].filter(Boolean)
    };
  };
  // A workout to do that week (slot n of its target): the routine, as long as it says, when it was last done.
  const plannedNeed = (r, monday, n) => {
    const last = A.lastOf(r.id);
    return {
      id: `next:${monday}:${n}`, title: r.name, fill: "card", minutes: r.minutes,
      from: monday, due: addDays(monday, 6),
      details: [plural(A.routineItems(r).length, "exercise"), last ? `Last: ${fmtDay(last.date)}` : "Not done yet"]
    };
  };

  // [{ id, title, fill: "card", … }]: made afresh on every call, so Momo can't change Badgermole's data through them.
  // A week's slots keep their ids as sessions are logged (logging takes the lowest, and the k-th session done completes
  // slot k), and the rotation carries on from one week to the next.
  function inbox(from, to) {
    const today = todayStr(), target = S.settings.weeklyTarget, rank = new Map(), seen = new Map();
    A.sessions().forEach(s => { const m = mondayOf(s.date), k = (seen.get(m) || 0) + 1; seen.set(m, k); rank.set(s, k); });
    const out = A.sessions().filter(s => s.date >= from && s.date <= to).map(s => doneNeed(s, rank.get(s)));
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
