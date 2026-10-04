/* Turtleduck · share.js — what Turtleduck shares with other apps, and what it reads of Momo.
 * routine() (core/routine.js): the slots Momo keeps in its baseline — breakfast, lunch and dinner each day at their usual
 * times (Times & trips: times.js), as long as their usual lengths, and Groceries on each weekday of the trip schedule.
 * inbox() (core/inbox.js; read-only copies), only for the weeks confirmed for Momo (confirm.js): each a card of its own
 * (fill "card"), set here (fixed: Momo pins it at its time and won't move it), on its day: each day's breakfast, lunch and
 * dinner (snacks never; a skipped meal sends nothing), titled with the meal and its names joined ("Dinner: Chili +
 * Salad"), filling that day's slot (slot "dinner:3", block "Dinner") at the day's time for it and as long as the meal
 * takes; a day's Cook row ("Cook: Curry ×1½ · Chili") at its time, a card of its own; each trip ("Groceries"), at its
 * time, filling its weekday's slot when it's on the schedule (else a card of its own), ✓ once its list is bought (a trip
 * with nothing on its list yet isn't ✓: there's still the trip). Momo asks from this Monday, so this week's past meals
 * are on their days too, as the record of the week (meals carry no done: the plan is taken as eaten). Momo's "Open in
 * Turtleduck" calls open(id): a meal's recipes in the cook view (or the plan's cell, flashing), a Cook row's in the cook
 * view, a trip's list; a slot's id ("dinner:3", "groceries:6") or "times", Times & trips. The needs' ids are
 * "meal:<date>:<meal>", "cook:<date>" and "groceries:<date>": change open() along with them (apps/turtleduck/CLAUDE.md).
 * momoStatus(monday): Momo's weekStatus for that week (whether its meals have their slots there), or null. */
(function (K, A) {
  "use strict";
  const S = A.S;
  const { addDays, isDate, sum } = K.util;
  const { MOMO_MEALS, SLOTS, GROCERY_MINUTES, QUICK_MINUTES, plural, fmtScale, fmtWd, fmtRange, mealTitle, mondayOf, dayIndex, slotTime, usualTime,
    slotMinutes, scheduleOn, isConfirmed } = A;
  const MAX_DAYS = 62; // a longer range is cut: Momo asks for two weeks at most
  const cut = (s, max) => { const c = [...s]; return c.length > max ? `${c.slice(0, max - 1).join("").trim()}…` : s; };

  // A meal in a few words, for its card's pop-up.
  function describe(e) {
    if (e.kind === "quick") return "Quick meal";
    if (e.kind === "restaurant") return "Restaurant";
    if (e.leftover) {
      const from = A.entryById(e.from);
      return `Leftovers${from ? ` of ${fmtWd(from.date)}'s ${A.nameOf(from)}` : ""}${e.servings > 1 ? ` · ${e.servings} portions` : ""}`;
    }
    const r = A.recipeById(e.recipeId);
    return !r ? "Cooked here" : e.scale === 1 ? `Cooked here · serves ${r.servings}` : `Cooked here · ×${fmtScale(e.scale)} · ${plural(A.yieldOf(e), "portion")}`;
  }

  // The day's breakfast, lunch or dinner: one need for all that's planned there, but what's skipped, in that day's slot.
  function mealNeed(date, meal) {
    const list = A.entriesOn(date, meal).filter(e => e.kind !== "skipped");
    if (!list.length) return null;
    const total = A.addUp(list), macros = A.fmtMacros(total, true);
    return {
      id: `meal:${date}:${meal}`, title: cut(`${mealTitle(meal)}: ${list.map(A.nameOf).join(" + ")}`, 60), fill: "card", date, time: slotTime(date, meal),
      slot: `${meal}:${dayIndex(date)}`, block: mealTitle(meal), fixed: true,
      minutes: sum(list.map(A.entryMinutes)) || QUICK_MINUTES,
      details: [macros ? `${macros}${total.unknown ? " · some not counted" : ""}` : ""]
        .concat(list.map(e => `${list.length > 1 ? `${A.nameOf(e)}: ` : ""}${describe(e)}`)).filter(Boolean).slice(0, 8)
    };
  }

  // The day's batch cooking: its recipes (a batch's × when it isn't 1), how long they take, what they make.
  function cookNeed(date) {
    const list = A.entriesOn(date, "cook");
    if (!list.length) return null;
    const portions = sum(list.map(A.yieldOf));
    return {
      id: `cook:${date}`, title: cut(`Cook: ${list.map(e => `${A.nameOf(e)}${e.scale === 1 ? "" : ` ×${fmtScale(e.scale)}`}`).join(" · ")}`, 60), fill: "card", date,
      time: slotTime(date, "cook"), fixed: true,
      minutes: sum(list.map(A.entryMinutes)),
      details: [`${plural(list.length, "recipe")} · ${plural(portions, "portion")}`, list.map(e => `${A.nameOf(e)} ×${fmtScale(e.scale)}`).join(" · ")]
    };
  }

  // The slots Momo keeps in its baseline: [{ id, title, day, time, minutes }], fresh copies.
  function routine() {
    const meals = SLOTS.flatMap(meal => [0, 1, 2, 3, 4, 5, 6].map(day => ({ id: `${meal}:${day}`, title: mealTitle(meal), day, time: usualTime(meal), minutes: slotMinutes(meal) })));
    return meals.concat(S.settings.schedule.map(s => ({ id: `groceries:${s.day}`, title: "Groceries", day: s.day, time: s.time, minutes: GROCERY_MINUTES })));
  }

  // [{ id, title, fill: "card", date, time, slot?, block?, fixed, minutes, details, done }]: the confirmed weeks' only,
  // made afresh on every call, so Momo can't change Turtleduck's data through them.
  function inbox(from, to) {
    if (!isDate(from) || !isDate(to) || to < from) return [];
    const out = [], last = to < addDays(from, MAX_DAYS) ? to : addDays(from, MAX_DAYS), on = d => isConfirmed(mondayOf(d));
    for (let d = from; d <= last; d = addDays(d, 1)) {
      if (!on(d)) continue;
      MOMO_MEALS.forEach(meal => { const n = mealNeed(d, meal); if (n) out.push(n); });
      const c = cookNeed(d);
      if (c) out.push(c);
    }
    A.lists().trips.filter(l => l.date >= from && l.date <= to && on(l.date)).forEach(l => out.push({
      id: `groceries:${l.date}`, title: "Groceries", fill: "card", minutes: GROCERY_MINUTES, date: l.date, time: l.time,
      ...(scheduleOn(dayIndex(l.date)) ? { slot: `groceries:${dayIndex(l.date)}` } : {}), block: "Groceries", fixed: true,
      details: [l.total ? plural(l.total, "item") : "Nothing to buy yet", `for meals ${fmtRange(l.from, l.through)}`], done: l.total > 0 && l.open === 0
    }));
    return out;
  }

  // From Momo's "Open in Turtleduck" (core/inbox.js puts Turtleduck on screen first): a meal's recipes, or a Cook row's,
  // in the cook view (none: that cell of the plan, flashing); a Groceries need, its list; a slot (or "times"), Times & trips.
  function open(id) {
    const s = String(id), m = /^(meal|cook):(\d{4}-\d{2}-\d{2})(?::([a-z]+))?$/.exec(s);
    if (s === "times" || /^(breakfast|lunch|dinner|groceries):[0-6]$/.test(s)) return A.openTimes();
    if (m) {
      const meal = m[1] === "cook" ? "cook" : m[3], list = A.entriesOn(m[2], meal).filter(e => e.kind === "recipe");
      if (list.length) return A.openCook(list.map(e => ({ recipeId: e.recipeId, scale: e.leftover ? 1 : e.scale, name: A.nameOf(e) })));
      return A.revealCell(m[2], meal);
    }
    if (s.startsWith("groceries:")) {
      A.showView("groceries");
      A.revealList(s.slice("groceries:".length));
    }
  }

  // Momo's word on a week (apps/momo routine.js weekStatus: whether it has the week, planned, and which of Turtleduck's
  // slots are in it), or null while Momo can't be read.
  function momoStatus(monday) {
    const M = K.apps.momo;
    if (!K.ready || !M || !M.started || typeof M.weekStatus !== "function") return null;
    try { return M.weekStatus(monday, A.id); } catch (err) { return null; }
  }

  Object.assign(A, { routine, inbox, open, momoStatus });
})(Kyoshi, Kyoshi.apps.turtleduck);
