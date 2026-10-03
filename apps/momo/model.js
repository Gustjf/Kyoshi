/* Momo · model.js — the data model (A.S.data) and the rules for moving cards around in it:
 * weeks, the baseline, budgets, and how cards merge, nest, and move between days.
 * Pure data — nothing here draws or saves (render.js draws, data.js saves).
 *
 * weeks:    { "YYYY-MM-DD" (Monday): { cards, closed, u, events, spent } }
 * events:   { "app:id": { at } } — only while you've moved any of other apps' events that
 *           week (see agenda.js): the time on its own day you moved it to, in hours after
 *           midnight on the 15-minute grid. The events themselves aren't stored.
 * spent:    { "title as typed": hours } — a closed week's close-out (closeout.js): where its
 *           hours went for the titles the close-out reviews — the goals whose hours spread
 *           over its cards (Iroh's) — by title (any case once), on the 15-minute grid; {} when
 *           none was done; none on a week closed quietly (no goals) or before the close-out
 *           logged hours. Iroh reads it (hoursSpent). Reopening the week takes it off.
 * baseline: { cards, u } — the default week, loaded into weeks in one click
 * asks:     { "YYYY-MM-DD" (Monday): { by: { "<app>|<block title>": minutes }, u } } — what the apps asked of
 *           that week, as last seen while it was this week (truecost.js), for the true cost; "<app>|" (no
 *           title) is that app's own cards (its fill "card" needs), all together. A week Momo wasn't opened
 *           has none. Kept apart from the weeks, so recording it never touches a week's cards or their sync.
 * weekends: { "YYYY-MM-DD" (Saturday): { plan, u } } — a weekend's plan (weekends.js): a brief note on one line, at most
 *           PLAN_MAX characters; "" once cleared, kept so the clearing wins when two devices combine. Past weekends'
 *           stay. Apart from the weeks too; it takes no hours.
 * goals:    [{ id, name, target, perWeek, start, due, maxWeek, log: { weekKey: hours }, deleted, u }]
 *           — Momo's long-term goals from before they moved to Iroh: kept as they were,
 *           in backups and sync too, but nothing reads them any more
 * colors:   { key: { c, u } } — each title's colour (see colors.js)
 * card:     { id, title, hours, day: 0-6 | null (parked), goalId, base, parentId, pos, pin, need, app, auto }
 *           — goalId: the old goal it was for, kept as it was; nothing sets one any more
 *           — need: "<app>:<need id>" on a card of its own for another app's need (fill "card", core/inbox.js:
 *           an errand, a meal…), else null; app: that app's id (its icon, and its colour: colors.js), else
 *           null — a pasted copy keeps app but not need; auto: true while Momo placed it (place.js: a need
 *           with a day) and you haven't moved, resized, pinned or edited it since, else false
 * A day's cards show in the order they're listed, which sets their times
 * (see times.js). `u` is when that week, baseline, goal, colour, week's asks or weekend's plan
 * last changed, which is how sync combines two devices' edits.
 * A card on its own on a day can be pinned: pin is the time it starts, in
 * hours after midnight (23.5 is 2330). Otherwise pin is null.
 * A card can sit inside another on the same day (lunch inside work): parentId
 * is that card's id, and pos is where in it: "top", "middle" (the card's own
 * part splits around it) or "bottom". Each keeps its own hours, and together
 * they show as one block, as tall as all of them. Only one level deep. */
(function (K, A) {
  "use strict";
  const S = A.S;
  const { sum } = K.util;
  const { DAY_HOURS, DAYS, AUTO, thisWeekKey, nextWeekKey, firstDay } = A;

  function emptyData() { return { weeks: {}, baseline: { cards: [], u: 0 }, goals: [], colors: {}, asks: {}, weekends: {} }; }
  const blankWeek = () => ({ cards: [], closed: false, u: 0 });
  const weekOf = key => S.data.weeks[key] || blankWeek(); // for reading: a week not planned yet reads as empty
  const ensureWeek = key => S.data.weeks[key] || (S.data.weeks[key] = blankWeek());
  const viewKey = () => (S.view === "this" ? thisWeekKey() : S.view === "next" ? nextWeekKey() : null);
  const shownKey = () => viewKey() || "base";
  const readList = key => (key === "base" ? S.data.baseline : weekOf(key));
  const listFor = key => (key === "base" ? S.data.baseline : ensureWeek(key)); // for changing
  const shownList = () => readList(shownKey());
  const isLocked = () => S.view !== "base" && shownList().closed;
  const hasData = d => d.goals.length > 0 || d.baseline.cards.length > 0 || Object.values(d.weeks).some(w => w.cards.length > 0) ||
    Object.values(d.weekends).some(w => w.plan);

  const pinned = c => typeof c.pin === "number";
  const dayTotal = (list, d) => sum(list.cards.filter(c => c.day === d).map(c => c.hours));
  // The cards inside a card, and the hours of the whole block.
  const innerCards = (list, card) => list.cards.filter(c => c.parentId === card.id);
  const blockHours = (list, card) => card.hours + sum(innerCards(list, card).map(c => c.hours));

  // A board's budget. Each day is its own account: one day's free hours can't
  // cover another day's overbooking, so both are counted per day. This week
  // only counts today onward — earlier hours are already spent. Other apps'
  // events count toward their days too (agenda.js agendaHours).
  function budgetOf(list, key) {
    const first = firstDay(key), extra = A.agendaHours(key, list).extra;
    const days = DAYS.filter(d => d >= first);
    const totals = DAYS.map(d => dayTotal(list, d) + extra[d]);
    return {
      days, totals, first,
      pool: days.length * DAY_HOURS,
      free: sum(days.map(d => Math.max(0, DAY_HOURS - totals[d]))),
      over: days.filter(d => totals[d] > DAY_HOURS).map(d => ({ d, by: totals[d] - DAY_HOURS })),
      parked: sum(list.cards.filter(c => c.day === null).map(c => c.hours))
    };
  }

  // Cards are consolidated: one block per activity at a time. A card dropped
  // or created right next to a matching card (same title, any case) on its own
  // — just above or below it — or at the same position inside the same card
  // folds into it, unless that would make a card longer than a day. Apart
  // they stay apart (Sleep at both ends of a day), as do pinned and parked
  // cards. The spot on its own is before the card beforeId, else at the end.
  // A card for another app's need is one of a kind: it never folds, nor is it
  // any card's twin (drag.js, card-editor.js).
  const sameKind = (a, b) => !a.need && !b.need && a.title.toLowerCase() === b.title.toLowerCase();
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
    pinned, dayTotal, innerCards, blockHours, budgetOf,
    sameKind, inPlace, mergeTarget, neighbours, absorb, canHold, tidyNesting, insertCard, moveCard, settle
  });
})(Kyoshi, Kyoshi.apps.momo);
