/* Turtleduck · share.js — what Turtleduck shares with other apps. Momo reads inbox() (core/inbox.js; read-only copies),
 * one need a card: each day's breakfast, lunch and dinner (snacks never; a skipped meal sends nothing) fill that day's
 * "Breakfast", "Lunch" or "Dinner" card, the meal's names joined ("Chili + Salad"); a day's Cook row fills its
 * "Cooking" card; each shopping trip fills a "Groceries" card on its day, ✓ once its list is bought, and while the Now
 * list has anything left to buy, a Groceries need is due the day before the first meal that needs it (a trip with nothing
 * on its list yet isn't ✓: there's still the trip). Momo asks from
 * this Monday, so this week's past meals fill their days' cards too, as the record of the week (meals carry no done:
 * the plan is taken as eaten), and never go to its Tasks. What no card covers from today on is a "Dinner · Chili" task
 * in Momo. Momo's "Open in Turtleduck" calls open(id): a meal's recipes in the cook view (or the
 * plan's cell, flashing), a Cook row's in the cook view, a trip's list. The needs' ids are "meal:<date>:<meal>",
 * "cook:<date>", "groceries:<date>" and "groceries:now": change open() along with them (apps/turtleduck/CLAUDE.md). */
(function (K, A) {
  "use strict";
  const { addDays, todayStr, isDate, sum } = K.util;
  const { MOMO_MEALS, BLOCK_COOKING, BLOCK_GROCERIES, GROCERY_MINUTES, QUICK_MINUTES, plural, fmtScale, fmtWd, fmtRange, mealTitle } = A;
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

  // The day's breakfast, lunch or dinner: one need for all that's planned there, but what's skipped.
  function mealNeed(date, meal) {
    const list = A.entriesOn(date, meal).filter(e => e.kind !== "skipped");
    if (!list.length) return null;
    const total = A.addUp(list), macros = A.fmtMacros(total, true);
    return {
      id: `meal:${date}:${meal}`, title: cut(list.map(A.nameOf).join(" + "), 60), block: mealTitle(meal), fill: "block", date,
      minutes: sum(list.map(A.entryMinutes)) || QUICK_MINUTES,
      details: [macros ? `${macros}${total.unknown ? " · some not counted" : ""}` : ""]
        .concat(list.map(e => `${list.length > 1 ? `${A.nameOf(e)}: ` : ""}${describe(e)}`)).filter(Boolean).slice(0, 8)
    };
  }

  // The day's batch cooking: its recipes, how long they take, what they make.
  function cookNeed(date) {
    const list = A.entriesOn(date, "cook");
    if (!list.length) return null;
    const portions = sum(list.map(A.yieldOf));
    return {
      id: `cook:${date}`, title: cut(list.map(A.nameOf).join(" + "), 60), block: BLOCK_COOKING, fill: "block", date,
      minutes: sum(list.map(A.entryMinutes)),
      details: [`${plural(list.length, "recipe")} · ${plural(portions, "portion")}`, list.map(e => `${A.nameOf(e)} ×${fmtScale(e.scale)}`).join(" · ")]
    };
  }

  // [{ id, title, block, fill, date / due, minutes, details, done }]: made afresh on every call, so Momo can't change
  // Turtleduck's data through them.
  function inbox(from, to) {
    if (!isDate(from) || !isDate(to) || to < from) return [];
    const out = [], today = todayStr(), last = to < addDays(from, MAX_DAYS) ? to : addDays(from, MAX_DAYS);
    for (let d = from; d <= last; d = addDays(d, 1)) {
      MOMO_MEALS.forEach(meal => { const n = mealNeed(d, meal); if (n) out.push(n); });
      const c = cookNeed(d);
      if (c) out.push(c);
    }
    const { now, trips } = A.lists();
    trips.filter(l => l.date >= from && l.date <= to).forEach(l => out.push({
      id: `groceries:${l.date}`, title: BLOCK_GROCERIES, block: BLOCK_GROCERIES, minutes: GROCERY_MINUTES, date: l.date,
      details: [l.total ? plural(l.total, "item") : "Nothing to buy yet", `for meals ${fmtRange(l.from, l.through)}`], done: l.total > 0 && l.open === 0
    }));
    // What's needed before the first trip: due the day before the first meal that needs it (today once that's passed).
    if (now && now.open > 0) {
      const firsts = now.rows.filter(r => !r.ticked).map(r => r.first).sort(), first = firsts[0] || "";
      const day = first ? addDays(first, -1) : "";
      out.push({
        id: "groceries:now", title: BLOCK_GROCERIES, block: BLOCK_GROCERIES, minutes: GROCERY_MINUTES,
        due: day ? (day < today ? today : day) : null, overdue: !!day && day < today,
        details: [`${plural(now.open, "item")} needed ${trips.length ? `before ${fmtWd(trips[0].date)}'s trip` : "for the meals planned"}`]
      });
    }
    return out;
  }

  // From Momo's "Open in Turtleduck" (core/inbox.js puts Turtleduck on screen first): a meal's recipes, or a Cook row's,
  // in the cook view (none: that cell of the plan, flashing); a Groceries need, its list.
  function open(id) {
    const s = String(id), m = /^(meal|cook):(\d{4}-\d{2}-\d{2})(?::([a-z]+))?$/.exec(s);
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

  Object.assign(A, { inbox, open });
})(Kyoshi, Kyoshi.apps.turtleduck);
