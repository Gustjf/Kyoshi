/* Kyoshi · core/routine.js — the slots apps keep at the same time every week, as K.routine (Momo keeps a card in its
 * baseline for each).
 * An app whose things happen at set times week after week (Turtleduck's breakfast, lunch and dinner each day, its
 * scheduled grocery trips) lists them in A.routine(): as copies, each
 *   { id, title, day, time, minutes }
 * id: the same for the same slot every time (unique within the app, e.g. "dinner:3"); title: short ("Dinner");
 * day: 0 = Monday … 6 = Sunday; time: "HH:MM" (24-hour), when it starts, on Momo's 15-minute grid; minutes: how
 * long while nothing fills it (60 if left out). A need naming the slot (core/inbox.js slot) fills its card on its date.
 * K.routine() gathers every started app's, checked and tagged with the app's id (app), in app order, then day and
 * time; an id listed twice counts once, and a slot without a time is left out (its card is pinned at it). An app
 * whose list fails (or isn't a list) is left out.
 * K.routine.unreadable(): the apps whose slots the last K.routine() couldn't read (a Set of ids): one that didn't start,
 * or whose list failed. Their slots aren't gone, just out of reach: Momo keeps their cards as they are meanwhile. */
(function (K) {
  "use strict";
  const { isObj, isTime } = K.util;
  const MINUTES = 60; // a slot that doesn't say how long it is
  const warned = new Set(); // apps whose list failed, said once
  let failed = new Set();   // apps whose list failed on the last read

  // Text from another app: runs of spaces become one, cut to max without splitting an emoji.
  const text = (s, max) => (typeof s === "string" ? [...s.replace(/\s+/g, " ").trim()].slice(0, max).join("").trim() : "");

  function clean(A, r) {
    if (!isObj(r) || !Number.isInteger(r.day) || r.day < 0 || r.day > 6 || !isTime(r.time)) return null;
    const id = text(r.id, 80), title = text(r.title, 60);
    if (!id || !title) return null;
    return { app: A.id, id, title, day: r.day, time: r.time, minutes: Number.isInteger(r.minutes) && r.minutes > 0 ? Math.min(r.minutes, 24 * 60) : MINUTES };
  }

  K.routine = () => {
    const bad = new Set();
    const all = K.order.map(id => K.apps[id]).filter(A => A.started && typeof A.routine === "function").flatMap(A => {
      try {
        const list = A.routine(), ids = new Set();
        if (!Array.isArray(list)) throw new TypeError("its routine isn't a list");
        return list.map(r => clean(A, r)).filter(r => r && !ids.has(r.id) && ids.add(r.id))
          .sort((a, b) => a.day - b.day || a.time.localeCompare(b.time));
      } catch (err) {
        if (!warned.has(A.id)) console.warn(`Couldn't read ${A.meta.name}'s routine.`, err);
        warned.add(A.id);
        bad.add(A.id);
        return [];
      }
    });
    failed = bad;
    return all;
  };
  K.routine.unreadable = () => new Set(K.order.filter(id => !K.apps[id].started || failed.has(id)));
})(Kyoshi);
