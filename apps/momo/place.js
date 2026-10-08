/* Momo · place.js — cards Momo places by itself for dated needs, and takes back.
 * Another app's need for a card of its own with a day of its own (fill "card", core/inbox.js: a meal, a
 * cooking session, a grocery trip, or something already done — a logged workout, a call, an errand ticked
 * off, a job recorded) gets a card on that day, from this Monday to next Sunday, when none holds it
 * (inbox.js assign: a slot's card on its date first, routine.js), titled by it, as long as it says (else an
 * hour), and marked `auto` (model.js). One its app sets (fixed: Turtleduck's) is pinned at its time, the day's
 * other cards staying where they are (times.js timeSpot: one running into it is flagged), in any open week (one
 * not planned yet too), and stays put (fixed). Any other goes as near its time (its `time`, else
 * the day's end) as the day's cards allow — before one of them, in the middle of one on its own (lunch in
 * Work), or at the end — and only in a week with cards of yours (one not planned yet keeps them in Tasks until
 * you load the baseline or copy a week, which place them). Never in a closed week.
 * While a card is auto it follows what it holds (title and length; a slot's card or a fixed one, its time
 * too), a slot's card with nothing in it follows its slot again, and a card holding nothing any more is taken
 * back, on today or later (past days keep theirs: the record of the week) — but not a slot's card while its
 * slot is still in its app's routine (it's the day's slot). Moving, resizing, pinning or editing one that
 * isn't fixed makes it yours (drop.js, clipboard.js, card-editor.js): it stays put.
 * Runs only with every app started (K.ready) and Momo on screen: when it's shown, every minute, after another
 * tab's save (events.js), and when a week is loaded, copied or cleared (baseline.js), after keeping the
 * baseline's slot cards up to date (routine.js syncSlots); what it changes is Momo's own bookkeeping, saved
 * quietly (still synced, as the true cost's asks are). */
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
      if (!r.card.need && !r.card.slot && A.canHold(list, r.card, card)) spots.push({ parentId: r.card.id, pos: "middle", beforeId: null });
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

  // A need's card, on its day in the week list: one its app sets, pinned at its time (in time order); any other where
  // spotFor puts it.
  function placeOne(list, n) {
    const card = { id: newId(), title: cleanText(n.title), hours: A.upHours(n.minutes || 60), day: dayIndex(n.date), goalId: null, base: false, parentId: null, pos: "bottom", pin: null, need: `${n.app}:${n.id}`, app: n.app, auto: true, slot: null, fixed: n.fixed, sleep: false };
    if (n.fixed && n.time) {
      card.pin = A.pinOf(n.time);
      return A.insertCard(list, card, A.timeSpot(list, card.day, card));
    }
    const spot = spotFor(list, card, hoursOf(n.time));
    Object.assign(card, { parentId: spot.parentId, pos: spot.pos });
    A.insertCard(list, card, spot.beforeId);
  }

  // Takes a card off its list; the cards inside it stay on its day, on their own (as deleting one does).
  function takeBack(list, card) {
    const inner = A.innerCards(list, card);
    list.cards = list.cards.filter(c => c !== card);
    inner.forEach(c => { c.parentId = null; A.settle(list, c); });
  }

  // What an auto card should look like now: held by a need, its title and length (and its time, on a slot's card or a
  // fixed one); a slot's card holding nothing, its slot's; else null (nothing to follow).
  function follows(c, n, slots) {
    if (n && (c.slot || c.need === `${n.app}:${n.id}`)) {
      const pin = (c.slot || n.fixed) && n.time ? A.pinOf(n.time) : c.pin;
      return { title: cleanText(n.title), hours: A.upHours(n.minutes || 60), pin, fixed: !!c.slot || n.fixed };
    }
    if (!n && c.slot && slots.has(c.slot)) {
      const s = A.slotFields(slots.get(c.slot));
      return { title: s.title, hours: s.hours, pin: s.pin, fixed: true };
    }
    return null;
  }

  // Places, follows and takes back Momo's cards for the needs as they are now (see the header), after the baseline's
  // slot cards; an app's are left as they are while it can't be read. True if anything changed. save: false leaves
  // saving to the caller (loading the baseline, copying a week, clearing one: one change, for undo).
  function placeCards({ save = true } = {}) {
    if (!K.ready || !A.isActive() || !S.data) return false;
    let changed = A.syncSlots();
    const keys = [thisWeekKey(), nextWeekKey()], today = todayStr(), slots = A.slotsNow(), noRoutine = K.routine.unreadable();
    const needs = A.readNeeds().filter(n => n.fill === "card"), noInbox = K.inbox.unreadable(), mine = A.assign(needs, A.blocks());
    const held = new Map([...mine].map(([n, b]) => [b.card, n])); // card -> the need it holds
    // The cards of an app that can't be read now (it didn't start, or its list failed: core/inbox.js, core/routine.js)
    // stay as they are: what it needs and its slots aren't gone, just out of reach.
    const reads = c => !noInbox.has(c.app) && !(c.slot && noRoutine.has(c.app));
    const open = key => { const w = S.data.weeks[key]; return w && !w.closed ? w : null; };
    keys.forEach(key => {
      const w = open(key);
      if (!w) return;
      w.cards.filter(c => c.auto && c.day !== null && addDays(key, c.day) >= today && !held.has(c) && !(c.slot && slots.has(c.slot)) && reads(c)).forEach(c => {
        takeBack(w, c);
        changed = true;
      });
      w.cards.forEach(c => {
        const f = c.auto && c.day !== null && reads(c) ? follows(c, held.get(c), slots) : null;
        if (!f || (c.title === f.title && c.hours === f.hours && c.pin === f.pin && c.fixed === f.fixed && !(f.pin !== null && c.parentId))) return;
        const moved = c.pin !== f.pin || (f.pin !== null && !!c.parentId);
        Object.assign(c, f);
        if (moved) A.putAt(w, c); // at its time, the others where they are
        changed = true;
      });
    });
    needs.filter(n => n.date && !mine.has(n)).forEach(n => {
      const key = weekKeyOf(n.date), had = S.data.weeks[key];
      if (!keys.includes(key) || (had && had.closed)) return;
      if (!n.fixed && !(had && had.cards.some(c => !c.need && c.day !== null))) return; // not planned yet: it waits in Tasks
      placeOne(A.ensureWeek(key), n);
      changed = true;
    });
    if (changed && save) A.save({ undo: false, quiet: true });
    return changed;
  }

  Object.assign(A, { hoursOf, takeBack, placeCards });
})(Kyoshi, Kyoshi.apps.momo);
