/* Momo · model.js — the data model (A.S.data) and the rules for moving cards around in it:
 * weeks, the baseline, goals, budgets, and how cards merge, nest, and move between days.
 * Pure data — nothing here draws or saves (render.js draws, data.js saves).
 *
 * weeks:    { "YYYY-MM-DD" (Monday): { cards, closed, u } }
 * baseline: { cards, u } — the default week, loaded into weeks in one click
 * goals:    [{ id, name, target, perWeek, start, due, maxWeek, log: { weekKey: hours }, deleted, u }]
 *           — a total to reach (target, maybe by a due date), or instead hours
 *           a week (perWeek, with no target or due date), judged week by week
 * colors:   { key: { c, u } } — each title's and goal's colour (see colors.js)
 * card:     { id, title, hours, day: 0-6 | null (parked), goalId, base, parentId, pos, pin }
 * A day's cards show in the order they're listed, which sets their times
 * (see times.js). `u` is when that week, baseline, goal or colour last
 * changed, which is how sync combines two devices' edits.
 * A card on its own on a day can be pinned: pin is the time it starts, in
 * hours after midnight (23.5 is 2330). Otherwise pin is null.
 * A card can sit inside another on the same day (lunch inside work): parentId
 * is that card's id, and pos is where in it: "top", "middle" (the card's own
 * part splits around it) or "bottom". Each keeps its own hours, and together
 * they show as one block, as tall as all of them. Only one level deep. */
(function (K, A) {
  "use strict";
  const S = A.S;
  const { sum, daysBetween } = K.util;
  const { DAY_HOURS, DAYS, STEP, AUTO, thisWeekKey, nextWeekKey, weekKeyOf, firstDay } = A;

  function emptyData() { return { weeks: {}, baseline: { cards: [], u: 0 }, goals: [], colors: {} }; }
  const blankWeek = () => ({ cards: [], closed: false, u: 0 });
  const weekOf = key => S.data.weeks[key] || blankWeek(); // for reading: a week not planned yet reads as empty
  const ensureWeek = key => S.data.weeks[key] || (S.data.weeks[key] = blankWeek());
  const viewKey = () => (S.view === "this" ? thisWeekKey() : S.view === "next" ? nextWeekKey() : null);
  const shownKey = () => viewKey() || "base";
  const readList = key => (key === "base" ? S.data.baseline : weekOf(key));
  const listFor = key => (key === "base" ? S.data.baseline : ensureWeek(key)); // for changing
  const shownList = () => readList(shownKey());
  const isLocked = () => S.view !== "base" && shownList().closed;
  const hasData = d => d.goals.length > 0 || d.baseline.cards.length > 0 || Object.values(d.weeks).some(w => w.cards.length > 0);

  // Goals. Hours done = what it started with plus every closed-out week's hours.
  // One in hours a week has no total, so it's never reached.
  const liveGoals = () => S.data.goals.filter(g => !g.deleted);
  const goalById = id => (id && S.data.goals.find(g => g.id === id && !g.deleted)) || null;
  const isWeekly = g => g.perWeek > 0;
  const goalDone = g => Math.max(0, g.start + sum(Object.values(g.log)));
  const goalLeft = g => Math.max(0, g.target - goalDone(g));
  const isReached = g => !isWeekly(g) && goalDone(g) >= g.target;
  // Weeks from the given week to a goal's finish-by week, both included.
  const weeksLeft = (g, key) => Math.floor(daysBetween(key, weekKeyOf(g.due)) / 7) + 1;

  const pinned = c => typeof c.pin === "number";
  const dayTotal = (list, d) => sum(list.cards.filter(c => c.day === d).map(c => c.hours));
  // The cards inside a card, and the hours of the whole block.
  const innerCards = (list, card) => list.cards.filter(c => c.parentId === card.id);
  const blockHours = (list, card) => card.hours + sum(innerCards(list, card).map(c => c.hours));
  // Goal hours scheduled on a board's days (parked cards aren't scheduled).
  const plannedFor = (list, goalId) => sum(list.cards.filter(c => c.goalId === goalId && c.day !== null).map(c => c.hours));

  // A board's budget. Each day is its own account: one day's free hours can't
  // cover another day's overbooking, so both are counted per day. This week
  // only counts today onward — earlier hours are already spent.
  function budgetOf(list, key) {
    const first = firstDay(key);
    const days = DAYS.filter(d => d >= first);
    const totals = DAYS.map(d => dayTotal(list, d));
    return {
      days, totals, first,
      pool: days.length * DAY_HOURS,
      free: sum(days.map(d => Math.max(0, DAY_HOURS - totals[d]))),
      over: days.filter(d => totals[d] > DAY_HOURS).map(d => ({ d, by: totals[d] - DAY_HOURS })),
      parked: sum(list.cards.filter(c => c.day === null).map(c => c.hours))
    };
  }

  // Hours a week a goal needs from the given week on to finish by its date:
  // what's left after closed-out work and earlier open weeks' plans, spread over
  // the weeks remaining. null when it has no date.
  function weeklyNeed(g, key) {
    if (!g.due) return null;
    const earlier = sum(Object.keys(S.data.weeks).filter(k => k < key && !S.data.weeks[k].closed).map(k => plannedFor(S.data.weeks[k], g.id)));
    const left = Math.max(0, g.target - goalDone(g) - earlier);
    return Math.ceil(left / Math.max(1, weeksLeft(g, key)) / STEP) * STEP;
  }

  // Cards are consolidated: one block per activity at a time. A card dropped
  // or created right next to a matching card (same title and goal) on its own
  // — just above or below it — or at the same position inside the same card
  // folds into it, unless that would make a card longer than a day. Apart
  // they stay apart (Sleep at both ends of a day), as do pinned and parked
  // cards. The spot on its own is before the card beforeId, else at the end.
  const sameKind = (a, b) => a.title.toLowerCase() === b.title.toLowerCase() && (a.goalId || null) === (b.goalId || null);
  const inPlace = (c, day, parentId, pos) => c.day === day && c.parentId === parentId && (!parentId || c.pos === pos);
  function mergeTarget(list, card, day, parentId = null, pos = "bottom", beforeId = null) {
    if (day === null || pinned(card)) return null;
    const fits = c => !!c && c !== card && !pinned(c) && sameKind(c, card) && c.hours + card.hours <= DAY_HOURS;
    if (parentId) return list.cards.find(c => fits(c) && inPlace(c, day, parentId, pos)) || null;
    return neighbours(list, day, beforeId, card).find(fits) || null;
  }

  // The cards on their own just above and below a spot on a day (before the
  // card beforeId, else at the end), leaving out skip.
  function neighbours(list, day, beforeId, skip) {
    const own = list.cards.filter(c => c.day === day && !c.parentId && c !== skip);
    const i = beforeId ? own.findIndex(c => c.id === beforeId) : -1, k = i < 0 ? own.length : i;
    return [own[k - 1], own[k]];
  }

  // Folds a card into a matching one: its hours, and any cards inside it.
  function absorb(list, into, card) {
    into.hours += card.hours;
    list.cards = list.cards.filter(c => c !== card);
    innerCards(list, card).forEach(c => {
      const twin = mergeTarget(list, c, into.day, into.id, c.pos);
      if (twin) absorb(list, twin, c);
      else Object.assign(c, { day: into.day, parentId: into.id });
    });
  }

  // What can hold a card: one on its own that isn't the same kind, while the
  // card has nothing inside it (one level deep).
  const canHold = (list, parent, card) => !!parent && parent !== card && !parent.parentId && !sameKind(parent, card) && !innerCards(list, card).length;

  // Keeps nesting sound after anything that could break it (a card taken
  // away, a damaged file): a card inside another must be on the same day as
  // that card, which is on its own; otherwise it goes back on its own. Only a
  // card on its own on a day can be pinned.
  function tidyNesting(list) {
    const byId = new Map(list.cards.map(c => [c.id, c]));
    list.cards.forEach(c => {
      const p = byId.get(c.parentId);
      if (!p || p === c || p.day !== c.day) c.parentId = null;
    });
    const nested = new Set(list.cards.filter(c => c.parentId).map(c => c.id));
    list.cards.forEach(c => {
      if (nested.has(c.parentId)) c.parentId = null;
      if (c.parentId || c.day === null) c.pin = null;
    });
  }

  // Puts a card before the card beforeId, or else last: after the cards
  // already inside its card, or after the last card on its day.
  function insertCard(list, card, beforeId) {
    let i = beforeId ? list.cards.findIndex(c => c.id === beforeId) : -1;
    if (i < 0) {
      const after = card.parentId ? c => c.id === card.parentId || c.parentId === card.parentId : c => c.day === card.day;
      i = list.cards.map(after).lastIndexOf(true) + 1 || list.cards.length;
    }
    list.cards.splice(i, 0, card);
  }

  // Moves a card to a day (null = parked): inside the card parentId at
  // position pos, or on its own; before the card beforeId (else last, or
  // with AUTO where autoSpot puts it). A pinned card on its own goes in time
  // order; anywhere else it isn't pinned any more. Cards inside it go along.
  // Returns the card it merged into, if it did.
  function moveCard(list, id, day, beforeId, parentId = null, pos = "bottom") {
    const card = list.cards.find(c => c.id === id);
    if (!card) return null;
    const inner = innerCards(list, card);
    if (inner.length) parentId = null;
    if (!parentId) pos = card.pos; // only means something inside a card
    if (parentId || day === null) card.pin = null;
    if (!parentId && day !== null && (pinned(card) || beforeId === AUTO)) beforeId = A.autoSpot(list, day, card);
    if (beforeId === AUTO) beforeId = null;
    const into = parentId && inPlace(card, day, parentId, pos) ? null : mergeTarget(list, card, day, parentId, pos, beforeId);
    if (into) {
      absorb(list, into, card);
      return into;
    }
    list.cards = list.cards.filter(c => c !== card);
    Object.assign(card, { day, parentId, pos });
    inner.forEach(c => { c.day = day; });
    insertCard(list, card, beforeId);
    return null;
  }

  // After a card is edited where it is, folds it into a matching card there.
  function settle(list, card) {
    const own = list.cards.filter(c => c.day === card.day && !c.parentId), next = own[own.indexOf(card) + 1];
    const into = mergeTarget(list, card, card.day, card.parentId, card.pos, next ? next.id : null);
    if (!into) return null;
    absorb(list, into, card);
    return into;
  }

  Object.assign(A, {
    emptyData, blankWeek, weekOf, ensureWeek, viewKey, shownKey, readList, listFor, shownList, isLocked, hasData,
    liveGoals, goalById, isWeekly, goalDone, goalLeft, isReached, weeksLeft,
    pinned, dayTotal, innerCards, blockHours, plannedFor, budgetOf, weeklyNeed,
    sameKind, inPlace, mergeTarget, neighbours, absorb, canHold, tidyNesting, insertCard, moveCard, settle
  });
})(Kyoshi, Kyoshi.apps.momo);
