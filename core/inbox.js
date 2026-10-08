/* Kyoshi · core/inbox.js — what apps need done this week and next, as K.inbox (Momo makes cards of it, or fills blocks).
 * An app with work for the user (Appa's maintenance, …) lists it in A.inbox(from, to): what's needed
 * between `from` and `to` ("YYYY-MM-DD", both included), as copies, in the order it should happen, each
 *   { id, title, block, details, fill, minutes, date, due, from, overdue, done, of, time, slot, fixed }
 * id: the same for the same need every time (unique within the app); title: what it is ("Oil change");
 * block: the title of the cards it fills in Momo ("Car maintenance"), its title if left out; details: a few
 * short lines for its pop-up; fill: "card" (a card of its own in Momo, titled by its title: its block is
 * ignored), "time" (the default: blocks take as many as fit their hours), "block"
 * (one per block, e.g. a workout), "ongoing" (never used up: it shows on every block with its title and
 * stays in Tasks to draw from) or "hours" (spread over the blocks with its title in turn, each taking the
 * room it has, until its minutes are used; the cards with its title on days before today, from its from day
 * on, count as done; what's left is one shortfall, for its week: Iroh's goals, a need a week); minutes: how
 * long (a card's length, 60 when left out; with "block" and "ongoing", just a drawn card's length; with
 * "hours", up to a week's);
 * date: that day only, else due: on or before that day (once it's passed, the soonest), else any day —
 * the first listed taking the soonest block (a sequence); from: not before that day (with or without due);
 * overdue: true when it's late though no date says so (a meter reading); done: true once done (✓ on its
 * block; give it its date, so it stays where it was). Only id and title are needed.
 * A "card" need with a date lands on that day by itself (Momo places its card, and takes it back once the
 * need is gone); one with due or from (or neither) waits in Momo's Tasks for you to place; a done one with
 * its date shows ✓ on its card, placed on that day if it has none. of: for a done need, the id of the open
 * need it completes (a session for "this week's workout 2"): the card made for that one shows ✓. time:
 * "HH:MM", where in its day Momo puts the card it makes for a dated need (else at the day's end).
 * A dated "card" need may also carry slot: the id of the app's routine slot it fills on its date (core/routine.js:
 * "dinner:3"; its block then names the slot's title, "Dinner"), so it goes on that slot's card; and fixed: true when
 * the app sets its day, time and length (Momo pins its card at its time and won't let it be moved, resized or
 * deleted there).
 * K.inbox(from, to) gathers every started app's, checked and tagged with the app's id (app), each app's in
 * its own order, then the apps' meetings (core/meetings.js: ids "meeting:…", never an app's own, filling
 * "Meeting" blocks); an id listed twice counts once, and one dated outside from–to is left out. An app whose
 * list fails is left out. K.inbox.unreadable(): the apps whose needs the last K.inbox() couldn't read (a Set of ids):
 * one that didn't start, or whose list failed; what they need isn't gone, so Momo leaves their cards as they are.
 * K.inbox.open(app, id) shows that app and its need (its A.open(id), if it has one; a meeting, its line); id may
 * also be one of its routine slots' ids (an empty slot's card: where it's set).
 * No app changes another's data: an app asks another for a change only through a function that one offers. */
(function (K) {
  "use strict";
  const { isObj, isDate, isTime } = K.util;
  const FILLS = ["time", "block", "ongoing", "hours", "card"];
  const MAX_DETAILS = 8;
  const warned = new Set(); // apps whose list failed, said once
  let failed = new Set();   // apps whose list failed on the last K.inbox()

  // Text from another app: runs of spaces become one, cut to max without splitting an emoji.
  const text = (s, max) => (typeof s === "string" ? [...s.replace(/\s+/g, " ").trim()].slice(0, max).join("").trim() : "");

  function clean(A, n, from, to) {
    if (!isObj(n)) return null;
    const id = text(n.id, 80), title = text(n.title, 60), date = isDate(n.date) ? n.date : null;
    if (!id || !title || (date && (date < from || date > to))) return null;
    const fill = FILLS.includes(n.fill) ? n.fill : "time", card = fill === "card" && !!date; // slot and fixed: a dated card's only
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
      done: n.done === true,
      of: text(n.of, 80) || null,
      time: isTime(n.time) ? n.time : null,
      slot: (card && text(n.slot, 80)) || null,
      fixed: card && n.fixed === true
    };
  }

  function own(A, from, to, bad) {
    try {
      const list = A.inbox(from, to);
      return (Array.isArray(list) ? list : []).map(n => clean(A, n, from, to)).filter(n => n && !n.id.startsWith("meeting:")); // core's ids
    } catch (err) {
      if (!warned.has(A.id)) console.warn(`Couldn't read what ${A.meta.name} needs.`, err);
      warned.add(A.id);
      bad.add(A.id);
      return [];
    }
  }

  K.inbox = (from, to) => {
    const ids = new Set(), once = n => n && !ids.has(`${n.app}:${n.id}`) && ids.add(`${n.app}:${n.id}`), bad = new Set();
    const all = K.order.map(id => K.apps[id]).filter(A => A.started && typeof A.inbox === "function").flatMap(A => own(A, from, to, bad))
      .concat(K.meetings.needs(from, to).map(({ A, need }) => clean(A, need, from, to))).filter(once);
    failed = bad;
    return all;
  };
  K.inbox.unreadable = () => new Set(K.order.filter(id => !K.apps[id].started || failed.has(id)));

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
