/* Kyoshi · core/agenda.js — events at set times that apps share, as K.agenda (Momo's board shows them).
 * An app with things that happen at a time (Bosco's doses, …) lists them in A.agenda(from, to):
 * those on days from `from` to `to` ("YYYY-MM-DD", both included), as copies, each
 *   { id, title, date, time, minutes, note, done }
 * id: the same for the same occurrence every time (unique within the app), so a move in Momo
 * sticks; title: short, e.g. "Tirzepatide dose"; date: "YYYY-MM-DD"; time: "HH:MM" (24-hour),
 * or null for any time that day; minutes: how long (15 if left out); note: a short detail
 * ("5 mg"); done: true once it has happened (a dose logged). Only id, title and date are needed.
 * K.agenda(from, to) gathers every started app's, checked and tagged with the app's id (app), in
 * day and time order; an id listed twice counts once. An app whose list fails is left out. No app
 * changes another's events. */
(function (K) {
  "use strict";
  const { isObj, isDate, isTime } = K.util;
  const MINUTES = 15; // an event that doesn't say how long it is
  const warned = new Set(); // apps whose list failed, said once

  // Text from another app: runs of spaces become one, cut to max without splitting an emoji.
  const text = (s, max) => (typeof s === "string" ? [...s.replace(/\s+/g, " ").trim()].slice(0, max).join("").trim() : "");

  function clean(A, e, from, to) {
    if (!isObj(e) || !isDate(e.date) || e.date < from || e.date > to) return null;
    const id = text(e.id, 80), title = text(e.title, 60);
    if (!id || !title) return null;
    return {
      app: A.id, id, title, date: e.date,
      time: isTime(e.time) ? e.time : null,
      minutes: Number.isInteger(e.minutes) && e.minutes > 0 ? Math.min(e.minutes, 24 * 60) : MINUTES,
      note: text(e.note, 60),
      done: e.done === true
    };
  }

  K.agenda = (from, to) => K.order.map(id => K.apps[id]).filter(A => A.started && typeof A.agenda === "function").flatMap(A => {
    try {
      const list = A.agenda(from, to), ids = new Set();
      return (Array.isArray(list) ? list : []).map(e => clean(A, e, from, to)).filter(e => e && !ids.has(e.id) && ids.add(e.id));
    } catch (err) {
      if (!warned.has(A.id)) console.warn(`Couldn't read ${A.meta.name}'s events.`, err);
      warned.add(A.id);
      return [];
    }
  }).sort((a, b) => (a.date + (a.time || "")).localeCompare(b.date + (b.time || "")));
})(Kyoshi);
