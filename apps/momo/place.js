/* Momo · place.js — cards Momo places by itself for dated needs, and takes back.
 * Another app's need for a card of its own with a day of its own (fill "card", core/inbox.js: a meal, a
 * cooking session, a grocery trip, or something already done — a logged workout, a call, an errand ticked
 * off, a job recorded) gets a card on that day, from this Monday to next Sunday, when none holds it
 * (inbox.js assign): titled by it, as long as it says (else an hour), as near its time (its `time`, else
 * the day's end) as the day's cards allow — before one of them, in the middle of one on its own (lunch in
 * Work), or at the end — and marked `auto` (model.js). Only in a week with cards of yours (one not planned
 * yet keeps them in Tasks until you load the baseline or copy a week, which place them), never a closed one.
 * While a card is auto it follows its need (title and length), and once nothing it holds is asked for any
 * more it's taken back, on today or later (past days keep theirs: the record of the week). Moving,
 * resizing, pinning or editing one makes it yours (drop.js, clipboard.js, card-editor.js): it stays put.
 * Runs only with every app started (K.ready) and Momo on screen: when it's shown, every minute, after
 * another tab's save (events.js), and when a week is loaded or copied (baseline.js); what it changes is
 * Momo's own bookkeeping, saved quietly (still synced, as the true cost's asks are). */
(function (K, A) {
  "use strict";
  const S = A.S;
  const { newId, addDays, todayStr } = K.util;
  const { cleanText, dayIndex, weekKeyOf, thisWeekKey, nextWeekKey } = A;

  // A time of day "HH:MM" in hours after midnight; null without one.
  const hoursOf = t => (t ? +t.slice(0, 2) + +t.slice(3) / 60 : null);

  // Where a new card goes on its day to start as near `at` (hours after midnight) as it can: before a card on its own,
  // in the middle of one that can hold it (not another app's), or at the end, each tried on a copy of the day (the
  // first of the nearest). Without a time, at the end. { parentId, pos, beforeId }
  function spotFor(list, card, at) {
    const end = { parentId: null, pos: "bottom", beforeId: null };
    if (at === null) return end;
    const spots = [];
    A.daySchedule(list, card.day).rows.forEach(r => {
      spots.push({ parentId: null, pos: "bottom", beforeId: r.card.id });
      if (!r.card.need && A.canHold(list, r.card, card)) spots.push({ parentId: r.card.id, pos: "middle", beforeId: null });
    });
    spots.push(end);
    let best = end, off = Infinity;
    spots.forEach(spot => {
      const sim = { cards: list.cards.filter(c => c.day === card.day).map(c => ({ ...c })) }, c = { ...card, parentId: spot.parentId, pos: spot.pos };
      A.insertCard(sim, c, spot.beforeId);
      const when = A.startTimes(sim, A.daySchedule(sim, card.day).rows).get(c.id), d = when ? Math.abs(when.at - at) : Infinity;
      if (d < off) { best = spot; off = d; }
    });
    return best;
  }

  // A need's card, on its day in the week list, where spotFor puts it.
  function placeOne(list, n) {
    const card = { id: newId(), title: cleanText(n.title), hours: A.upHours(n.minutes || 60), day: dayIndex(n.date), goalId: null, base: false, parentId: null, pos: "bottom", pin: null, need: `${n.app}:${n.id}`, app: n.app, auto: true };
    const spot = spotFor(list, card, hoursOf(n.time));
    Object.assign(card, { parentId: spot.parentId, pos: spot.pos });
    A.insertCard(list, card, spot.beforeId);
  }

  // Takes a card off its week; the cards inside it stay on its day, on their own (as deleting one does).
  function takeBack(list, card) {
    const inner = A.innerCards(list, card);
    list.cards = list.cards.filter(c => c !== card);
    inner.forEach(c => { c.parentId = null; A.settle(list, c); });
  }

  // Places, follows and takes back Momo's cards for the needs as they are now (see the header). True if anything
  // changed. save: false leaves saving to the caller (loading the baseline or copying a week: one change, for undo).
  function placeCards({ save = true } = {}) {
    if (!K.ready || !A.isActive() || !S.data) return false;
    const keys = [thisWeekKey(), nextWeekKey()], today = todayStr();
    const needs = A.readNeeds().filter(n => n.fill === "card"), mine = A.assign(needs, A.blocks());
    const held = new Map([...mine].map(([n, b]) => [b.card, n])); // card -> the need it holds
    const open = key => { const w = S.data.weeks[key]; return w && !w.closed ? w : null; };
    let changed = false;
    keys.forEach(key => {
      const w = open(key);
      if (!w) return;
      w.cards.filter(c => c.auto && c.day !== null && addDays(key, c.day) >= today && !held.has(c)).forEach(c => {
        takeBack(w, c);
        changed = true;
      });
      w.cards.forEach(c => {
        const n = c.auto && held.get(c);
        if (!n || c.need !== `${n.app}:${n.id}`) return;
        const title = cleanText(n.title), hours = A.upHours(n.minutes || 60);
        if (c.title === title && c.hours === hours) return;
        Object.assign(c, { title, hours });
        changed = true;
      });
    });
    needs.filter(n => n.date && !mine.has(n)).forEach(n => {
      const key = weekKeyOf(n.date), w = keys.includes(key) && open(key);
      if (!w || !w.cards.some(c => !c.need && c.day !== null)) return; // not planned yet: it waits in Tasks
      placeOne(w, n);
      changed = true;
    });
    if (changed && save) A.save({ undo: false, quiet: true });
    return changed;
  }

  Object.assign(A, { placeCards });
})(Kyoshi, Kyoshi.apps.momo);
