/* Momo · routine.js — the apps' slots in the baseline (Turtleduck's), and what Momo offers other apps.
 * An app's routine (K.routine, core/routine.js: Turtleduck's breakfast, lunch and dinner each day at its times, its
 * scheduled grocery trips) is kept in the baseline as a card per slot (model.js slot "<app>:<id>"): on its day,
 * pinned at its time, as long as the slot says, titled by it, with its app's icon and colour, auto and fixed (set in
 * its app: no drag, resize, pin, cut or delete here). syncSlots keeps them following the routine: a slot gone is
 * taken back, a new one added, a changed one updated, matched by slot and never by id (two devices make their own),
 * in a set order, so two devices that know the same routine come to the same baseline; an app whose routine can't
 * be read now (it didn't start, or its list failed: K.routine.unreadable) keeps its cards as they are. Loading the
 * baseline copies them into a week like any card: there the need naming a slot fills its card on its date (inbox.js
 * assign), which then takes that need's title, length and time, and with nothing in it follows its slot again (place.js).
 * weekStatus(monday, app) tells another app (Turtleduck) about a week here: whether Momo has it, planned or closed,
 * and which of the app's slots it holds. */
(function (K, A) {
  "use strict";
  const S = A.S;
  const { newId, isDate } = K.util;
  const { DAY_HOURS, STEP, snap, cleanText, weekKeyOf } = A;

  // A slot's time "HH:MM" as a pin: hours after midnight on the 15-minute grid.
  const pinOf = time => Math.min(DAY_HOURS - STEP, snap(A.hoursOf(time)));
  // What a slot's card shows while nothing fills it.
  const slotFields = r => ({ title: cleanText(r.title), hours: A.upHours(r.minutes), day: r.day, pin: pinOf(r.time) });
  // The apps' slots now, by key "<app>:<id>".
  const slotsNow = () => new Map(K.routine().map(r => [`${r.app}:${r.id}`, r]));

  // Puts a card pinned at a time its app sets back among its day's cards, at its time without moving the others
  // (times.js timeSpot); any card inside it goes along.
  function putAt(list, card) {
    list.cards = list.cards.filter(c => c !== card);
    A.innerCards(list, card).forEach(c => { c.day = card.day; });
    card.parentId = null;
    A.insertCard(list, card, A.timeSpot(list, card.day, card));
  }

  // Brings the baseline's slot cards in line with the routines (see the header). Never from A.init: until every app
  // has started (K.ready) the routines are empty, and every slot card would be taken back. Nor are an app's taken back
  // while its routine can't be read (it didn't start, or its list failed: K.routine.unreadable): they stay as they are.
  // True if anything changed; the caller saves.
  function syncSlots() {
    if (!K.ready || !S.data) return false;
    const list = S.data.baseline, slots = slotsNow(), unread = K.routine.unreadable(), seen = new Set();
    let changed = false;
    list.cards.filter(c => c.slot).forEach(c => {
      if ((slots.has(c.slot) || unread.has(c.app)) && !seen.has(c.slot)) return seen.add(c.slot);
      A.takeBack(list, c); // its slot is gone, or it's a second card for one
      changed = true;
    });
    [...slots.keys()].sort().forEach(key => {
      const r = slots.get(key), f = slotFields(r), card = list.cards.find(c => c.slot === key);
      if (!card) {
        const c = { id: newId(), title: f.title, hours: f.hours, day: f.day, goalId: null, base: false, parentId: null, pos: "bottom", pin: f.pin, need: null, app: r.app, auto: true, slot: key, fixed: true, sleep: false };
        A.insertCard(list, c, A.timeSpot(list, c.day, c));
        changed = true;
        return;
      }
      if (card.title === f.title && card.hours === f.hours && card.day === f.day && card.pin === f.pin && !card.parentId && card.app === r.app && card.auto && card.fixed) return;
      const moved = card.day !== f.day || card.pin !== f.pin || !!card.parentId;
      Object.assign(card, { title: f.title, hours: f.hours, day: f.day, pin: f.pin, app: r.app, auto: true, fixed: true });
      if (moved) putAt(list, card);
      changed = true;
    });
    return changed;
  }

  // A week as Momo has it, for another app (Turtleduck shows whether its meals' slots are there): { exists, planned (a
  // card on a day besides those Momo placed for the apps' needs), closed, slots: the routine ids of app's slots its
  // cards hold (every app's "<app>:<id>" when app is null) }. Any day of the week will do. A fresh object every call.
  function weekStatus(monday, app = null) {
    const w = isDate(monday) && S.data ? S.data.weeks[weekKeyOf(monday)] : null;
    if (!w) return { exists: false, planned: false, closed: false, slots: [] };
    const mine = c => c.slot && c.day !== null && (!app || c.app === app);
    return { exists: true, planned: A.isPlanned(w), closed: w.closed, slots: w.cards.filter(mine).map(c => (app ? c.slot.slice(app.length + 1) : c.slot)) };
  }

  Object.assign(A, { pinOf, slotFields, slotsNow, putAt, syncSlots, weekStatus });
})(Kyoshi, Kyoshi.apps.momo);
