/* Momo · baseline.js — the bank's quick actions: load (auto-fund) the baseline into a week,
 * copy the previous week, save a week as the baseline, fill gaps with Free time, clear a
 * board, and start the baseline from a sample. Other apps' cards (model.js need) belong to
 * their week: copying a week or saving one as the baseline leaves them out, and the ones Momo
 * placed go back in at their times once a week has your cards (place.js). The apps' slot cards
 * (model.js slot, routine.js) are Momo's to keep: loading and copying bring them along, and
 * saving a week as the baseline or clearing the baseline gets them back as the routines say. */
(function (K, A) {
  "use strict";
  const S = A.S;
  const { isNum, addDays, newId } = K.util;
  const { DAY_HOURS, DAYS, FREE_TIME, SAMPLE_BASELINE, fmtWeek } = A;

  // Copies of cards with new ids, each inside the copy of the card it was inside.
  function copyCards(cards, fields = {}) {
    const ids = new Map(cards.map(c => [c.id, newId()]));
    return cards.map(c => ({ ...c, id: ids.get(c.id), parentId: ids.get(c.parentId) || null, ...fields }));
  }

  // Auto-funding: the baseline's cards go into each day, pinned ones at their
  // times, marked as from the baseline. Loading again swaps those for fresh
  // copies. Your own cards stay (on their own, if they were inside one of the
  // old copies): a pinned one goes back in at its time, and another before
  // the first card that starts at or after the time it started. The cards
  // Momo placed for other apps (and you haven't touched) are placed again, at
  // their times among the baseline's.
  function loadBaseline() {
    const key = A.viewKey();
    if (!key || !S.data.baseline.cards.length) return;
    const week = A.ensureWeek(key), reload = week.cards.some(c => c.base);
    if (reload && !confirm("Reload the baseline? Its cards already in this week are replaced by fresh copies, including any changes you made to them. Cards you added yourself stay.")) return;
    const starts = new Map();
    DAYS.forEach(d => A.startTimes(week, A.daySchedule(week, d).rows).forEach((w, id) => starts.set(id, w.at)));
    const own = week.cards.filter(c => !c.base && !c.auto), ids = new Set(own.map(c => c.id));
    own.forEach(c => { if (c.parentId && !ids.has(c.parentId)) c.parentId = null; });
    week.cards = copyCards(S.data.baseline.cards, { base: true });
    own.filter(c => !c.parentId).forEach(c => {
      const at = starts.get(c.id), next = c.day !== null && !A.pinned(c) && isNum(at) && A.daySchedule(week, c.day).rows.find(r => r.start >= at);
      A.insertCard(week, c, c.day !== null && A.pinned(c) ? A.autoSpot(week, c.day, c) : next ? next.card.id : null);
    });
    own.filter(c => c.parentId).forEach(c => A.insertCard(week, c, null));
    A.tidyNesting(week);
    A.placeCards({ save: false });
    A.save();
    A.renderAll();
  }

  // Copies the week before's plan into the week on screen, replacing what's
  // there (after asking): your cards, not other apps' (their own come in for
  // this week).
  function copyPrevWeek() {
    const key = A.viewKey();
    if (!key) return;
    const prev = A.weekOf(addDays(key, -7)), week = A.ensureWeek(key), cards = prev.cards.filter(c => !c.need);
    if (!cards.length || week.closed) return;
    const had = week.cards.filter(c => !(c.auto && c.need)).length; // not the cards Momo placed for the apps: they come back
    if (had && !confirm(`Replace this week's ${had} card${had === 1 ? "" : "s"} with a copy of ${fmtWeek(addDays(key, -7))}?`)) return;
    week.cards = copyCards(cards);
    A.placeCards({ save: false });
    A.save();
    A.renderAll();
  }

  // Makes the week on screen the new baseline: its cards on days (not parked)
  // replace the baseline's, but not other apps' (those come and go each week)
  // nor their slots' (the routines put the baseline's back at once; an app's
  // that can't be read now, routine.js, are kept as they were).
  function saveAsBaseline() {
    const key = A.viewKey(), week = key && A.weekOf(key);
    const cards = week ? week.cards.filter(c => c.day !== null && !c.need && !c.slot) : [];
    if (!cards.length) return;
    const had = S.data.baseline.cards.filter(c => !c.slot).length;
    if (had && !confirm(`Replace your baseline (${had} cards) with this week's ${cards.length} cards?`)) return;
    A.slotsNow();
    const unread = K.routine.unreadable(), kept = S.data.baseline.cards.filter(c => c.slot && unread.has(c.app));
    S.data.baseline.cards = copyCards(cards, { base: false });
    kept.forEach(c => A.putAt(S.data.baseline, c));
    A.syncSlots();
    A.save();
    A.renderAll();
  }

  // Gives every counted day's free hours the job "Free time" — the deliberate
  // buffer you shrink when something unexpected comes up: the free time
  // before each pinned card, then at the end of the day, as far as the day's
  // free hours go. Other apps' events in that free time end up in Free time,
  // which lends them their hours, so it gets theirs too (loose).
  function fillGaps() {
    const key = A.viewKey();
    if (!key) return;
    const week = A.ensureWeek(key), b = A.budgetOf(week, key), { loose } = A.agendaHours(key, week);
    let added = 0;
    b.days.forEach(d => {
      let room = DAY_HOURS - b.totals[d] + loose[d];
      const { rows, end } = A.daySchedule(week, d);
      const gaps = rows.filter(r => r.gap > 0).map(r => [r.gap, r.card.id]).concat(end < DAY_HOURS ? [[DAY_HOURS - end, null]] : []);
      gaps.forEach(([gap, beforeId]) => {
        const hours = Math.min(gap, room);
        if (hours <= 0) return;
        const c = { id: newId(), title: FREE_TIME, hours, day: d, goalId: null, base: false, parentId: null, pos: "bottom", pin: null, need: null, app: null, auto: false, slot: null, fixed: false, sleep: false };
        const into = A.mergeTarget(week, c, d, null, "bottom", beforeId);
        if (into) into.hours += hours;
        else A.insertCard(week, c, beforeId);
        room -= hours;
        added += hours;
      });
    });
    if (!added) return;
    A.save();
    A.renderAll();
  }

  // Clears a board, but for the cards set in other apps (model.js fixed): they stay, as those apps put them.
  function clearBoard() {
    const key = A.shownKey(), list = A.readList(key), n = list.cards.filter(c => !A.isFixed(c)).length;
    if (!n || A.isLocked()) return;
    const stay = list.cards.some(A.isFixed) ? " Cards set in other apps stay." : "";
    if (!confirm(key === "base" ? `Clear the whole baseline?${stay}` : `Remove all ${n} cards from this week?${stay}`)) return;
    A.listFor(key).cards = list.cards.filter(A.isFixed);
    A.placeCards({ save: false }); // and anything they'd lost comes back (place.js, routine.js)
    A.save();
    A.renderAll();
  }

  // The sample's titles take its colours, where no other title has them.
  function startSampleBaseline() {
    S.data.baseline.cards = DAYS.flatMap(d => SAMPLE_BASELINE.filter(s => s.days.includes(d))
      .map(s => ({ id: newId(), title: s.title, hours: s.hours, day: d, goalId: null, base: false, parentId: null, pos: "bottom", pin: null, need: null, app: null, auto: false, slot: null, fixed: false, sleep: false })));
    SAMPLE_BASELINE.forEach(s => {
      const key = A.titleKey(s.title);
      if (!S.data.colors[key] && !Object.values(S.data.colors).some(e => e.c === s.color)) S.data.colors[key] = { c: s.color, u: 0 };
    });
    A.save();
    A.renderAll();
  }

  Object.assign(A, { copyCards, loadBaseline, copyPrevWeek, saveAsBaseline, fillGaps, clearBoard, startSampleBaseline });
})(Kyoshi, Kyoshi.apps.momo);
