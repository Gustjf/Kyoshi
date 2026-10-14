/* Kyoshi · core/level.js — K.level: evens out the coming weeks for the apps that keep schedules (Pabu's calls, texts and
 * visits; Appa's jobs). Given items, each with its next due day, its minutes and how often it comes, K.level.plan moves
 * some of those due days a few days earlier or later, so each Monday-to-Sunday week of the next LEVEL_WEEKS carries
 * about the same minutes: an item moves at most a quarter of its interval (MOVE_FRACTION) and at most MOVE_MAX_DAYS,
 * never before today nor past the last week; one that can move less than 2 days either way (a weekly call), or is
 * overdue (it weighs in this week), or takes no time, stays and only weighs in its week. The items that can move least
 * are placed first, each in the week it can reach with the fewest minutes a day left (this week counts from today; a
 * tie: its own week, then the one nearer it, then the later), on the day there nearest its due. The same
 * items give the same plan on every device. K.level.weeks gives each week's minutes before and after, for the apps'
 * pop-ups. No UI, no storage: each app shows the plan (core/spread.js) and keeps the moves on its items (their `moved`).
 * An app hands in each item's usual due (as if nothing had been moved) and replaces every move it kept with the new plan,
 * so spreading again gives the same plan, and no date drifts further than its reach. */
(function (K) {
  "use strict";
  const { isDate, isNum, addDays, daysBetween } = K.util;
  const LEVEL_WEEKS = 8;
  const MOVE_FRACTION = 0.25;
  const MOVE_MAX_DAYS = 14;

  const mondayOf = d => addDays(d, -((new Date(`${d}T00:00:00Z`).getUTCDay() + 6) % 7));
  const byId = (a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  const later = (a, b) => (a > b ? a : b);
  const sooner = (a, b) => (a < b ? a : b);

  // The weeks looked at: { first (this week's Monday), end (the last week's Sunday), weeks, weekOf(date) }.
  function span(today, weeks = LEVEL_WEEKS) {
    const first = mondayOf(today);
    return { first, end: addDays(first, 7 * weeks - 1), weeks, weekOf: d => Math.floor(daysBetween(first, d) / 7) };
  }
  // The items due by the last week's Sunday, with sound fields (minutes 0 when missing); one overdue counts today
  // (overdue: it never moves, and weighs in this week).
  const inRange = (items, today, s) => items.filter(i => i && typeof i.id === "string" && isDate(i.due) && i.due <= s.end)
    .map(i => ({ id: i.id, due: later(i.due, today), overdue: i.due < today, minutes: isNum(i.minutes) && i.minutes > 0 ? i.minutes : 0,
      interval: isNum(i.intervalDays) ? i.intervalDays : 0 }));

  // items: [{ id, due ("YYYY-MM-DD"), minutes, intervalDays }]; today: "YYYY-MM-DD". → [{ id, from, to }] for the items
  // that move, by id.
  function plan(items, { today, weeks = LEVEL_WEEKS } = {}) {
    if (!isDate(today) || !Array.isArray(items)) return [];
    const s = span(today, weeks), load = new Array(weeks).fill(0), movable = [];
    // The days each week has left (this one from today), so a weekend's last two days don't look like an empty week:
    // weeks are compared by their minutes a day (cross-multiplied, so a tie is a tie).
    const days = Array.from({ length: weeks }, (_, w) => (w ? 7 : daysBetween(today, addDays(s.first, 6)) + 1));
    const lighter = (a, b) => load[a] * days[b] < load[b] * days[a], same = (a, b) => load[a] * days[b] === load[b] * days[a];
    inRange(items, today, s).forEach(i => {
      const reach = Math.min(MOVE_MAX_DAYS, Math.floor(i.interval * MOVE_FRACTION));
      const lo = later(today, addDays(i.due, -reach)), hi = sooner(s.end, addDays(i.due, reach));
      if (i.overdue || reach < 2 || daysBetween(lo, hi) < 2 || !i.minutes) load[s.weekOf(i.due)] += i.minutes;
      else movable.push({ ...i, lo, hi, room: daysBetween(lo, hi) });
    });
    const moves = [];
    movable.sort((a, b) => a.room - b.room || b.minutes - a.minutes || byId(a, b)).forEach(i => {
      const own = s.weekOf(i.due);
      let best = own;
      for (let w = s.weekOf(i.lo); w <= s.weekOf(i.hi); w++) {
        const better = lighter(w, best) || (same(w, best) && best !== own &&
          (Math.abs(w - own) < Math.abs(best - own) || (Math.abs(w - own) === Math.abs(best - own) && w > best)));
        if (better) best = w;
      }
      load[best] += i.minutes;
      if (best === own) return;
      // The day in that week nearest its due, within its reach.
      const from = later(i.lo, addDays(s.first, 7 * best)), to = sooner(i.hi, addDays(s.first, 7 * best + 6));
      moves.push({ id: i.id, from: i.due, to: i.due < from ? from : to });
    });
    return moves.sort(byId);
  }

  // Each week's minutes before and after the moves: { mondays, before, after } (arrays of `weeks`).
  function weeks(items, moves, { today, weeks: n = LEVEL_WEEKS } = {}) {
    const s = span(today, n), before = new Array(n).fill(0), after = new Array(n).fill(0);
    const to = new Map((moves || []).map(m => [m.id, m.to]));
    inRange(items, today, s).forEach(i => {
      before[s.weekOf(i.due)] += i.minutes;
      const d = to.get(i.id) || i.due;
      if (d >= today && d <= s.end) after[s.weekOf(d)] += i.minutes;
    });
    return { mondays: Array.from({ length: n }, (_, k) => addDays(s.first, 7 * k)), before, after };
  }

  K.level = { plan, weeks, mondayOf, LEVEL_WEEKS, MOVE_FRACTION, MOVE_MAX_DAYS };
})(Kyoshi);
