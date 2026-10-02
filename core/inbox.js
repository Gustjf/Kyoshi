/* Kyoshi · core/inbox.js — what apps need done this week and next, as K.inbox (Momo fills blocks with it).
 * An app with work for the user (Appa's maintenance, …) lists it in A.inbox(from, to): what's needed
 * between `from` and `to` ("YYYY-MM-DD", both included), as copies, in the order it should happen, each
 *   { id, title, block, details, fill, minutes, date, due, from, overdue, done }
 * id: the same for the same need every time (unique within the app); title: what it is ("Oil change");
 * block: the title of the cards it fills in Momo ("Car maintenance"), its title if left out; details: a few
 * short lines for its pop-up; fill: "time" (the default: blocks take as many as fit their hours), "block"
 * (one per block, e.g. a workout), "ongoing" (never used up: it shows on every block with its title and
 * stays in Tasks to draw from) or "hours" (spread over the blocks with its title in turn, each taking the
 * room it has, until its minutes are used; the cards with its title on days before today, from its from day
 * on, count as done; what's left is one shortfall, for its week: Iroh's goals, a need a week); minutes: how
 * long (with "block" and "ongoing", just a drawn card's length; with "hours", up to a week's);
 * date: that day only, else due: on or before that day (once it's passed, the soonest), else any day —
 * the first listed taking the soonest block (a sequence); from: not before that day (with or without due);
 * overdue: true when it's late though no date says so (a meter reading); done: true once done (✓ on its
 * block; give it its date, so it stays where it was). Only id and title are needed.
 * K.inbox(from, to) gathers every started app's, checked and tagged with the app's id (app), each app's in
 * its own order, then the apps' meetings (core/meetings.js: ids "meeting:…", never an app's own, filling
 * "Meeting" blocks); an id listed twice counts once, and one dated outside from–to is left out. An app whose
 * list fails is left out.
 * K.inbox.open(app, id) shows that app and its need (its A.open(id), if it has one; a meeting, its line).
 * No app changes another's data. */
(function (K) {
  "use strict";
  const { isObj, isDate } = K.util;
  const FILLS = ["time", "block", "ongoing", "hours"];
  const MAX_DETAILS = 8;
  const warned = new Set(); // apps whose list failed, said once

  // Text from another app: runs of spaces become one, cut to max without splitting an emoji.
  const text = (s, max) => (typeof s === "string" ? [...s.replace(/\s+/g, " ").trim()].slice(0, max).join("").trim() : "");

  function clean(A, n, from, to) {
    if (!isObj(n)) return null;
    const id = text(n.id, 80), title = text(n.title, 60), date = isDate(n.date) ? n.date : null;
    if (!id || !title || (date && (date < from || date > to))) return null;
    const fill = FILLS.includes(n.fill) ? n.fill : "time";
    return {
      app: A.id, id, title,
      block: text(n.block, 60) || title,
      details: (Array.isArray(n.details) ? n.details : []).map(s => text(s, 100)).filter(Boolean).slice(0, MAX_DETAILS),
      fill,
      minutes: Number.isInteger(n.minutes) && n.minutes > 0 ? Math.min(n.minutes, (fill === "hours" ? 7 : 1) * 24 * 60) : null,
      date,
      due: !date && isDate(n.due) ? n.due : null,
      from: !date && isDate(n.from) ? n.from : null,
      overdue: n.overdue === true,
      done: n.done === true
    };
  }

  function own(A, from, to) {
    try {
      const list = A.inbox(from, to);
      return (Array.isArray(list) ? list : []).map(n => clean(A, n, from, to)).filter(n => n && !n.id.startsWith("meeting:")); // core's ids
    } catch (err) {
      if (!warned.has(A.id)) console.warn(`Couldn't read what ${A.meta.name} needs.`, err);
      warned.add(A.id);
      return [];
    }
  }

  K.inbox = (from, to) => {
    const ids = new Set(), once = n => n && !ids.has(`${n.app}:${n.id}`) && ids.add(`${n.app}:${n.id}`);
    return K.order.map(id => K.apps[id]).filter(A => A.started && typeof A.inbox === "function").flatMap(A => own(A, from, to))
      .concat(K.meetings.needs(from, to).map(({ A, need }) => clean(A, need, from, to))).filter(once);
  };

  // "Open in <App>": the app comes on screen, then shows the need (or just its home, without A.open).
  K.inbox.open = (app, id) => {
    const A = K.apps[app];
    if (!A || !A.started) return;
    K.show(app);
    if (String(id).startsWith("meeting:")) return K.meetings.reveal(A);
    if (typeof A.open !== "function") return;
    try { A.open(id); } catch (err) { console.error(`${A.meta.name} couldn't open that.`, err); }
  };
})(Kyoshi);
