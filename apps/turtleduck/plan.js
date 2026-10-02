/* Turtleduck · plan.js — the plan's changes and sums. Placing: a recipe (cooked there; on the Cook row, all its portions
 * go on the shelf), a portion of a batch (a leftover: never before its cook day, never on the Cook row), a quick meal, a
 * restaurant or a skipped meal; moving, copying (Ctrl+C / V) and removing them; "Also on…" (a batch's portions on later
 * days, in one go); what may go where (canPlace: for dragging, pasting and the picker); a day's totals, a week's average
 * and what's past a target; and the ⋯ menu's Copy last week, templates (save the week on screen, load one into it) and
 * Clear week, which add or take away meals and never change the rest. Every change bumps u and saves. */
(function (K, A) {
  "use strict";
  const S = A.S;
  const { newId, addDays } = K.util;
  const { MAX_CHIPS, MAX_TEMPLATES, MAX_TEMPLATE_NAME, MEALS, NUTRIENTS, cleanLine, plural, kept } = A;
  const EATEN = MEALS.map(m => m[0]).filter(m => m !== "cook");

  // Stamps in placing order, so meals placed together keep their order in a cell.
  let lastStamp = 0;
  const stamp = () => (lastStamp = Math.max(Date.now(), lastStamp + 1));

  // The week on screen's Monday (the plan's tab).
  const shownMonday = () => (S.week === "next" ? A.nextMonday() : A.thisMonday());

  // ==========================================================================
  // WHAT MAY GO WHERE: d = { what: "recipe" | "portion" | "entry" (moved) | "copy", id }
  // ==========================================================================
  // An entry in a cell: the Cook row only takes what's cooked there; a leftover never goes before its batch's day.
  function fits(e, date, meal) {
    if (meal === "cook") return A.isCooked(e);
    if (!e.leftover) return true;
    const from = A.entryById(e.from);
    return !from || date >= from.date;
  }
  function canPlace(d, date, meal) {
    if (!d || !A.inPlan(date) || A.mealIndex(meal) < 0) return false;
    const full = A.entriesOn(date, meal).length >= MAX_CHIPS, e = d.what === "recipe" ? null : A.entryById(d.id);
    if (d.what === "recipe") return !full && !!A.recipeById(d.id);
    if (!e) return false;
    if (d.what === "entry") return !(e.date === date && e.meal === meal) && !full && fits(e, date, meal);
    if (d.what === "portion") return !full && A.isCooked(e) && meal !== "cook" && date >= e.date;
    return d.what === "copy" && !full && fits(e, date, meal);
  }

  // ==========================================================================
  // CHANGES
  // ==========================================================================
  function place(fields) {
    const t = stamp();
    const e = A.cleanEntry({ kind: "recipe", recipeId: "", name: "", leftover: false, from: "", scale: 1, servings: 1, ...fields, id: newId(), deleted: false, at: t, u: t });
    S.plan.push(e);
    S.version++; // what's worked out from the plan is worked out again, before the save
    return e;
  }
  // Portions eaten in a cell: none on the Cook row; one when a batch comes off it; else as they were.
  const servingsIn = (e, meal) => (meal === "cook" ? 0 : e.meal === "cook" ? 1 : e.servings);

  // A recipe on a cell: cooked there (eaten there too, but on the Cook row).
  function addRecipe(id, date, meal) {
    const r = A.recipeById(id);
    if (!canPlace({ what: "recipe", id }, date, meal)) return null;
    const e = place({ date, meal, recipeId: r.id, name: r.name, servings: meal === "cook" ? 0 : 1 });
    kept();
    return e;
  }
  // A portion of a batch on a later day (or the same one): a leftover.
  function addPortion(cookId, date, meal) {
    if (!canPlace({ what: "portion", id: cookId }, date, meal)) return null;
    const c = A.entryById(cookId), e = place({ date, meal, recipeId: c.recipeId, name: A.nameOf(c), leftover: true, from: c.id });
    kept();
    return e;
  }
  // A quick meal or a restaurant (fields: name and its own numbers), or a skipped meal.
  function addOwn(kind, date, meal, fields = {}) {
    if (meal === "cook" || !A.inPlan(date) || A.entriesOn(date, meal).length >= MAX_CHIPS) return null;
    const e = place({ ...fields, date, meal, kind });
    kept();
    return e;
  }

  // Moved to another cell (it goes last there). A batch moved after its leftovers' days leaves them be: its pop-up says so.
  function moveEntry(id, date, meal) {
    if (!canPlace({ what: "entry", id }, date, meal)) return false;
    const e = A.entryById(id), t = stamp();
    Object.assign(e, A.cleanEntry({ ...e, date, meal, servings: servingsIn(e, meal), at: t, u: t }));
    kept();
    return true;
  }
  // A copy in a cell: a batch cooked again (its own ingredients), another portion of a leftover's batch, or the same
  // quick meal, restaurant or skip.
  function copyEntry(id, date, meal) {
    if (!canPlace({ what: "copy", id }, date, meal)) return null;
    const e = A.entryById(id), c = place({ ...e, date, meal, servings: servingsIn(e, meal) });
    kept();
    return c;
  }

  // Taken off the plan, as markers (so sync can't bring them back). A batch's leftovers stay, counting nothing.
  function dropEntries(ids) {
    const gone = new Set(ids.filter(id => A.entryById(id))), t = stamp();
    if (!gone.size) return false;
    S.plan = S.plan.map(x => (!x.deleted && gone.has(x.id) ? { id: x.id, deleted: true, at: x.at, u: t } : x));
    S.version++;
    return true;
  }
  const dropEntry = id => dropEntries([id]);
  function removeEntry(id) { if (dropEntry(id)) kept(); }

  // A change to a planned meal (its ×, its portions, a quick meal's text and numbers). False when nothing changed.
  function updateEntry(id, fields) {
    const e = A.entryById(id);
    if (!e) return false;
    const next = A.cleanEntry({ ...e, ...fields, u: e.u }), same = JSON.stringify(next) === JSON.stringify(e);
    if (same) return false;
    Object.assign(e, next, { u: stamp() });
    kept();
    return true;
  }

  // "Also on…": a batch's portion on a day (ticked), or the last one placed there taken off (unticked).
  function alsoOn(cookId, date, meal, on) {
    const c = A.entryById(cookId);
    if (!c || !A.isCooked(c)) return;
    if (on) return void addPortion(cookId, date, meal);
    const there = A.leftoversOf(c.id).filter(x => x.date === date && x.meal === meal);
    if (there.length) removeEntry(there[there.length - 1].id);
  }

  // ==========================================================================
  // SUMS
  // ==========================================================================
  // A day's totals: its meals, the Cook row left out.
  const dayTotals = date => A.remember(`day:${date}`, () => A.addUp(EATEN.flatMap(m => A.entriesOn(date, m))));
  // A week's average, over its days with any meal planned (null when there are none): each nutrient over the days that
  // have it (a day of restaurants with no numbers doesn't pull it down), in whole numbers.
  function weekAverage(monday) {
    const days = A.weekDates(monday).map(dayTotals).filter(t => t.count);
    if (!days.length) return null;
    const avg = { unknown: days.some(t => t.unknown), count: days.length };
    NUTRIENTS.forEach(([k]) => { const known = days.filter(t => t[k] !== null); avg[k] = known.length ? Math.round(known.reduce((n, t) => n + t[k], 0) / known.length) : null; });
    return avg;
  }
  // What's past its target, with targets set: kcal, carbs and fat over theirs, protein and fiber under theirs.
  function pastTarget(t) {
    const g = S.settings.targets, out = new Set();
    NUTRIENTS.forEach(([k]) => {
      if (g[k] === null || t[k] === null) return;
      if (k === "protein" || k === "fiber" ? t[k] < g[k] : t[k] > g[k]) out.add(k);
    });
    return out;
  }

  // ==========================================================================
  // THE ⋯ MENU: Copy last week, templates, Clear week (on the week on screen)
  // ==========================================================================
  // A week's meals as a template's entries: by weekday, a leftover's from as the index of its batch among them (or -1).
  function weekEntries(monday) {
    const days = A.weekDates(monday), list = A.liveEntries().filter(e => e.date >= days[0] && e.date <= days[6]);
    return list.map(e => ({
      day: days.indexOf(e.date), meal: e.meal, kind: e.kind, recipeId: e.recipeId, name: e.kind === "skipped" ? "" : A.nameOf(e),
      leftover: e.leftover, from: e.leftover ? list.findIndex(x => x.id === e.from) : -1, scale: e.scale, servings: e.servings,
      kcal: e.kcal, protein: e.protein, carbs: e.carbs, fat: e.fat, fiber: e.fiber
    }));
  }
  // Template entries onto a week's days, as new meals (nothing is replaced; a full cell takes no more), a batch's
  // leftovers linked to its new copy. How many were added.
  function addEntries(entries, monday) {
    const days = A.weekDates(monday), made = entries.map(x => {
      const date = days[x.day];
      if (!date || A.entriesOn(date, x.meal).length >= MAX_CHIPS) return null;
      const { day, ...fields } = x;
      return place({ ...fields, date, from: "" });
    });
    entries.forEach((x, i) => { if (made[i] && x.leftover && x.from >= 0 && made[x.from]) made[i].from = made[x.from].id; });
    S.version++; // the leftovers' links changed in place
    return made.filter(Boolean).length;
  }

  function copyLastWeek() {
    const monday = shownMonday(), entries = weekEntries(addDays(monday, -7));
    if (!entries.length) return alert("The week before has no meals to copy.");
    const n = addEntries(entries, monday);
    kept();
    if (n < entries.length) alert(`${plural(entries.length - n, "meal")} didn't fit: a cell holds up to ${MAX_CHIPS}.`);
  }

  // Saves the week on screen as a template (one with the same name is replaced, after asking). "" once saved, else why not.
  function saveTemplate(name) {
    const n = cleanLine(name, MAX_TEMPLATE_NAME), entries = weekEntries(shownMonday());
    if (!n) return "Give the template a name.";
    if (!entries.length) return "This week has no meals to save yet.";
    const same = A.liveTemplates().find(t => t.name.toLowerCase() === n.toLowerCase()), t = stamp();
    if (!same && A.liveTemplates().length >= MAX_TEMPLATES) return `You can keep up to ${MAX_TEMPLATES} templates: delete one first.`;
    if (same && !confirm(`Replace the template “${same.name}” with this week's meals?`)) return "cancelled";
    if (same) Object.assign(same, A.cleanTemplates([{ ...same, name: n, entries, u: t }])[0]);
    else S.templates.push(A.cleanTemplates([{ id: newId(), name: n, entries, at: t, u: t }])[0]);
    kept();
    return "";
  }
  function loadTemplate(id) {
    const tpl = A.liveTemplates().find(t => t.id === id);
    if (!tpl) return;
    const n = addEntries(tpl.entries, shownMonday());
    kept();
    if (n < tpl.entries.length) alert(`${plural(tpl.entries.length - n, "meal")} didn't fit: a cell holds up to ${MAX_CHIPS}.`);
  }
  function deleteTemplate(id) {
    const tpl = A.liveTemplates().find(t => t.id === id);
    if (!tpl || !confirm(`Delete the template “${tpl.name}”? The meals already planned from it stay.`)) return;
    S.templates = S.templates.map(x => (x === tpl ? { id: tpl.id, deleted: true, at: tpl.at, u: stamp() } : x));
    kept();
  }
  // Every meal of the week on screen off the plan (after asking); its shopping trips stay.
  function clearWeek() {
    const days = A.weekDates(shownMonday()), list = A.liveEntries().filter(e => e.date >= days[0] && e.date <= days[6]);
    if (!list.length) return;
    if (!confirm(`Take all ${plural(list.length, "meal")} off ${S.week === "next" ? "next" : "this"} week? The shopping trips stay.`)) return;
    dropEntries(list.map(e => e.id));
    kept();
  }

  Object.assign(A, {
    shownMonday, canPlace, addRecipe, addPortion, addOwn, moveEntry, copyEntry, dropEntry, removeEntry, updateEntry, alsoOn,
    dayTotals, weekAverage, pastTarget, copyLastWeek, saveTemplate, loadTemplate, deleteTemplate, clearWeek
  });
})(Kyoshi, Kyoshi.apps.turtleduck);
