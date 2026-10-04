/* Turtleduck · data.js — the saved data: cleaning, loading, saving, backups, and combining with other devices' saves.
 * A.data is the adapter core/backup.js (Export/Import JSON) and core/sync.js (folder sync) use. Storage keys (A.store):
 * recipes, plan, trips, manual and templates (lists, merged item by item), checked, sections, slotTimes, tripSkips and
 * confirmed (key by key), settings (whole); sync and meetings are core's. */
(function (K, A) {
  "use strict";
  const S = A.S;
  const { isObj, isNum, isPos, isDate, newId } = K.util;
  const { DATA_SCHEMA_VERSION, MAX_NAME, MAX_LINES, MAX_LINE, MAX_STEPS, MAX_QUICK, MAX_MINUTES, MAX_SERVINGS, MIN_SCALE, MAX_SCALE,
    MAX_KCAL, MAX_GRAMS, MAX_LINK, MAX_TEMPLATE_NAME, MAX_MANUAL, MAX_CHIPS, MEALS, TYPES, SECTIONS, UNIT_MODES, SLOTS, DEFAULT_TIMES, DEFAULT_LENGTHS,
    MIN_LENGTH, MAX_LENGTH, cleanLine, cleanText, clampInt, numIn, plural, own, onGrid, dayIndex } = A;
  const LISTS = ["recipes", "plan", "trips", "manual", "templates"];
  const MAPS = ["checked", "sections", "slotTimes", "tripSkips", "confirmed"];
  const KEYS = LISTS.concat(MAPS, "settings");
  const KINDS = ["recipe", "quick", "restaurant", "skipped"];
  const MEAL_KEYS = MEALS.map(m => m[0]), TYPE_KEYS = TYPES.map(t => t[0]);
  const MAX_MS = 8.64e15;  // the last moment a date can hold
  const MAX_KEY = 120;     // a grocery key's characters ("<name>|<unit>")
  const MAX_RANGES = 20;   // a tick's ranges

  // ==========================================================================
  // CLEANING: saved, imported and new data all pass through here, so every copy has the same shape (two copies compare
  // alike) and anything unusable is dropped (a damaged file can't break the app). A deleted item keeps only what sync
  // needs: { id, deleted, at, u }.
  // ==========================================================================
  const idOf = v => (typeof v === "string" && v ? v.slice(0, 40) : "");
  const msOf = v => (isPos(v) && v < MAX_MS ? v : 0);
  const uOf = x => msOf(x.u);
  const objects = list => (Array.isArray(list) ? list : []).filter(isObj);
  // Keeps the first of each id, and those still worth keeping.
  const unique = (list, keep) => { const ids = new Set(); return list.filter(x => keep(x) && !ids.has(x.id) && ids.add(x.id)); };
  const marker = x => ({ id: idOf(x.id) || newId(), deleted: true, at: msOf(x.at), u: uOf(x) });
  // Per serving (a recipe's) or for the whole meal (a quick one's): kcal whole, grams to a decimal; null when unknown.
  const nutrition = x => ({ kcal: numIn(x.kcal, 0, MAX_KCAL), protein: numIn(x.protein, 0, MAX_GRAMS, 1), carbs: numIn(x.carbs, 0, MAX_GRAMS, 1), fat: numIn(x.fat, 0, MAX_GRAMS, 1), fiber: numIn(x.fiber, 0, MAX_GRAMS, 1) });
  const NONE = { kcal: null, protein: null, carbs: null, fat: null, fiber: null };
  const scaleOf = v => (isNum(v) ? Math.min(MAX_SCALE, Math.max(MIN_SCALE, Math.round(v * 2) / 2)) : 1);

  // Ingredient lines, one each as typed (a line of text, or text in one piece; { qty, unit, name } becomes a line too).
  const lineOf = l => (isObj(l) ? [isNum(l.qty) ? String(l.qty) : "", typeof l.unit === "string" ? l.unit : "", typeof l.name === "string" ? l.name : ""].join(" ") : isNum(l) ? String(l) : l);
  const cleanLines = v => (typeof v === "string" ? v.split(/\r\n?|\n/) : Array.isArray(v) ? v : []).map(l => cleanLine(lineOf(l), MAX_LINE)).filter(Boolean).slice(0, MAX_LINES);

  function cleanRecipes(list) {
    return unique(objects(list).map(r => (r.deleted === true ? marker(r) : {
      id: idOf(r.id) || newId(),
      name: cleanLine(r.name, MAX_NAME),
      meal: TYPE_KEYS.includes(r.meal) ? r.meal : "any",
      ingredients: cleanLines(r.ingredients),
      steps: cleanText(r.steps, MAX_STEPS),
      prepMin: numIn(r.prepMin, 0, MAX_MINUTES), cookMin: numIn(r.cookMin, 0, MAX_MINUTES),
      servings: clampInt(r.servings, 1, MAX_SERVINGS, 1), // the yield at ×1
      ...nutrition(r),
      link: cleanLine(r.link, MAX_LINK),
      archived: r.archived === true, // hidden from the sidebar and the picker, not gone
      deleted: false, at: msOf(r.at), u: uOf(r)
    })), r => r.deleted || r.name);
  }

  // A planned meal: a recipe cooked there (on a meal, or on the Cook row: nothing else goes there) or a leftover portion
  // of one (from: that cooked entry), a quick meal or a restaurant (with its own numbers), or a skipped one. name: the
  // recipe's as placed (shown once it's deleted), or the text.
  function cleanEntry(e) {
    if (e.deleted === true) return marker(e);
    const kind = KINDS.includes(e.kind) ? e.kind : "recipe", cooked = kind === "recipe" && e.leftover !== true;
    const meal = MEAL_KEYS.includes(e.meal) && (e.meal !== "cook" || cooked) ? e.meal : "";
    return {
      id: idOf(e.id) || newId(),
      date: isDate(e.date) ? e.date : "",
      meal, kind,
      recipeId: kind === "recipe" ? idOf(e.recipeId) : "",
      name: kind === "skipped" ? "" : cleanLine(e.name, kind === "recipe" ? MAX_NAME : MAX_QUICK),
      leftover: kind === "recipe" && !cooked,
      from: kind === "recipe" && !cooked ? idOf(e.from) : "",
      scale: cooked ? scaleOf(e.scale) : 1,
      // Portions eaten there: a recipe's (none on the Cook row), else one meal.
      servings: kind !== "recipe" ? 1 : meal === "cook" ? 0 : clampInt(e.servings, 1, MAX_SERVINGS, 1),
      ...(kind === "quick" || kind === "restaurant" ? nutrition(e) : NONE),
      deleted: false, at: msOf(e.at), u: uOf(e)
    };
  }
  const usable = e => e.deleted || (e.date && e.meal && (e.kind !== "recipe" || e.recipeId || e.name));
  const cleanPlan = list => unique(objects(list).map(cleanEntry), usable);

  const cleanTrips = list => unique(objects(list).map(t => (t.deleted === true ? marker(t) : {
    id: idOf(t.id) || newId(), date: isDate(t.date) ? t.date : "", deleted: false, at: msOf(t.at), u: uOf(t)
  })), t => t.deleted || t.date);

  // Groceries added by hand ("running out of…"); done: the day it was ticked.
  const cleanManual = list => unique(objects(list).map(m => (m.deleted === true ? marker(m) : {
    id: idOf(m.id) || newId(), text: cleanLine(m.text, MAX_MANUAL), done: isDate(m.done) ? m.done : "", deleted: false, at: msOf(m.at), u: uOf(m)
  })), m => m.deleted || m.text);

  // A week's meals by weekday (0 = Monday); a leftover's from is the index of its cooked entry in the list, or -1.
  function cleanTemplateEntries(list) {
    const kept = [], index = new Map();
    objects(list).slice(0, 7 * MEALS.length * MAX_CHIPS).forEach((x, i) => {
      const e = cleanEntry({ ...x, id: "t", date: "2000-01-03", from: "", deleted: false, at: 0, u: 0 });
      if (!usable(e)) return;
      index.set(i, kept.length);
      kept.push({
        day: clampInt(x.day, 0, 6, 0), meal: e.meal, kind: e.kind, recipeId: e.recipeId, name: e.name, leftover: e.leftover,
        from: e.leftover && Number.isInteger(x.from) ? x.from : -1, scale: e.scale, servings: e.servings,
        kcal: e.kcal, protein: e.protein, carbs: e.carbs, fat: e.fat, fiber: e.fiber
      });
    });
    kept.forEach(e => {
      const j = e.from >= 0 ? index.get(e.from) : undefined;
      e.from = j !== undefined && kept[j].kind === "recipe" && !kept[j].leftover ? j : -1;
    });
    return kept;
  }
  const cleanTemplates = list => unique(objects(list).map(t => (t.deleted === true ? marker(t) : {
    id: idOf(t.id) || newId(), name: cleanLine(t.name, MAX_TEMPLATE_NAME), entries: cleanTemplateEntries(t.entries), deleted: false, at: msOf(t.at), u: uOf(t)
  })), t => t.deleted || t.name);

  // "<name>|<unit>" -> { ranges: [[from, until], …] (bought for every planned use from–until; none: unticked), u }.
  const range = r => Array.isArray(r) && isDate(r[0]) && isDate(r[1]) && r[0] <= r[1];
  function cleanChecked(v) {
    const out = {};
    if (isObj(v)) Object.keys(v).sort().forEach(k => {
      const x = v[k];
      if (k.length > MAX_KEY || !k.includes("|") || !isObj(x)) return;
      const ranges = (Array.isArray(x.ranges) ? x.ranges : []).filter(range).map(r => [r[0], r[1]]);
      out[k] = { ranges: ranges.sort((a, b) => a[0].localeCompare(b[0]) || a[1].localeCompare(b[1])).slice(0, MAX_RANGES), u: uOf(x) };
    });
    return out;
  }
  // "<name>" -> { section, u }: an ingredient's store section, set by hand.
  function cleanSections(v) {
    const out = {};
    if (isObj(v)) Object.keys(v).sort().forEach(k => {
      if (k && k !== "__proto__" && k.length <= MAX_KEY && isObj(v[k]) && SECTIONS.includes(v[k].section)) out[k] = { section: v[k].section, u: uOf(v[k]) };
    });
    return out;
  }

  // A day's own times, by "<date>:<kind>" ("" = back to the usual, kept so the clearing wins when two devices combine).
  const TIME_KINDS = ["breakfast", "lunch", "dinner", "cook", "trip"];
  function cleanSlotTimes(v) {
    const out = {};
    if (isObj(v)) Object.keys(v).sort().forEach(k => {
      const x = v[k], [date, kind] = k.split(":");
      if (k === `${date}:${kind}` && isDate(date) && TIME_KINDS.includes(kind) && isObj(x)) out[k] = { time: onGrid(x.time) ? x.time : "", u: uOf(x) };
    });
    return out;
  }
  // A scheduled trip's day skipped (skip: false once it's back on), by date.
  function cleanTripSkips(v) {
    const out = {};
    if (isObj(v)) Object.keys(v).sort().forEach(k => { if (isDate(k) && isObj(v[k])) out[k] = { skip: v[k].skip === true, u: uOf(v[k]) }; });
    return out;
  }
  // A week confirmed for Momo, by its Monday: since at (0: un-confirmed, kept so that wins too).
  function cleanConfirmed(v) {
    const out = {};
    if (isObj(v)) Object.keys(v).sort().forEach(k => { if (isDate(k) && dayIndex(k) === 0 && isObj(v[k])) out[k] = { at: msOf(v[k].at), u: uOf(v[k]) }; });
    return out;
  }

  // The day's targets, each optional (null: none); how the grocery lists show amounts (units: "entered" when a file
  // has none, as before 1.300); the usual times (each on the 15-minute grid, else its default), the meals' usual lengths
  // (5 to 240 minutes in 5-minute steps, else the default) and the weekly trips (a weekday each at most, by day; none in
  // a file from before 2.300).
  const target = (v, max) => (isNum(v) && v > 0 ? Math.min(max, Math.round(v)) : null);
  const lengthOf = (v, fallback) => (Number.isInteger(v) && v >= MIN_LENGTH && v <= MAX_LENGTH && v % 5 === 0 ? v : fallback);
  function cleanSchedule(list) {
    const days = new Set();
    return objects(list).filter(s => Number.isInteger(s.day) && s.day >= 0 && s.day <= 6 && onGrid(s.time) && !days.has(s.day) && days.add(s.day))
      .map(s => ({ day: s.day, time: s.time })).sort((a, b) => a.day - b.day);
  }
  const cleanSettings = s => {
    const ok = isObj(s), t = ok && isObj(s.targets) ? s.targets : {}, times = ok && isObj(s.times) ? s.times : {}, lengths = ok && isObj(s.lengths) ? s.lengths : {};
    return {
      targets: { kcal: target(t.kcal, 4 * MAX_KCAL), protein: target(t.protein, 2 * MAX_GRAMS), carbs: target(t.carbs, 2 * MAX_GRAMS), fat: target(t.fat, 2 * MAX_GRAMS), fiber: target(t.fiber, 2 * MAX_GRAMS) },
      units: ok && UNIT_MODES.some(([k]) => k === s.units) ? s.units : UNIT_MODES[0][0],
      times: Object.fromEntries(TIME_KINDS.map(k => [k, onGrid(times[k]) ? times[k] : DEFAULT_TIMES[k]])),
      lengths: Object.fromEntries(SLOTS.map(k => [k, lengthOf(lengths[k], DEFAULT_LENGTHS[k])])),
      schedule: cleanSchedule(ok ? s.schedule : null),
      u: ok ? uOf(s) : 0
    };
  };

  const cleanAll = raw => ({
    recipes: cleanRecipes(raw.recipes), plan: cleanPlan(raw.plan), trips: cleanTrips(raw.trips), manual: cleanManual(raw.manual),
    templates: cleanTemplates(raw.templates), checked: cleanChecked(raw.checked), sections: cleanSections(raw.sections),
    slotTimes: cleanSlotTimes(raw.slotTimes), tripSkips: cleanTripSkips(raw.tripSkips), confirmed: cleanConfirmed(raw.confirmed), settings: cleanSettings(raw.settings)
  });

  // ==========================================================================
  // STORING
  // ==========================================================================
  // Keeps everything in storage (each key only when it changed); every change counts up S.version, so what's worked
  // out from the data is worked out again.
  function persist() {
    KEYS.forEach(k => { const text = JSON.stringify(S[k]); if (text !== A.store.get(k)) A.store.set(k, text); });
    S.version++;
  }
  // A change made on this device: stored, then counted for sync and autosaved.
  function save() {
    persist();
    A.changed();
  }

  // Reads everything from storage (at start, and when another tab saved).
  function load() {
    const raw = {};
    KEYS.forEach(k => { raw[k] = A.store.json(k); });
    Object.assign(S, cleanAll(raw));
    S.version++;
  }

  // ==========================================================================
  // BACKUPS (Export / Import JSON): all eleven (a file from before 2.300 has no times, skips or weeks confirmed)
  // ==========================================================================
  // No other app keeps both lists (Badgermole: exercises and sessions; Hawky and Wan Shi Tong: items).
  const looksLike = raw => Array.isArray(raw.recipes) && Array.isArray(raw.plan);

  function buildBackup() {
    return {
      schemaVersion: DATA_SCHEMA_VERSION, appVersion: A.VERSION, recipes: S.recipes, plan: S.plan, trips: S.trips,
      checked: S.checked, manual: S.manual, sections: S.sections, templates: S.templates,
      slotTimes: S.slotTimes, tripSkips: S.tripSkips, confirmed: S.confirmed, settings: S.settings
    };
  }

  // Replaces all eleven with the backup's, after checking it has recipes or planned meals in it (so a bad file never
  // changes anything) and asking first (unless ask is false: Import all already did) if there's anything to lose.
  // True once it's in.
  function importBackup(raw, ask = true) {
    if (!raw || !looksLike(raw)) {
      alert("That file doesn't look like a Turtleduck backup.");
      return false;
    }
    const next = cleanAll(raw), count = d => `${plural(A.live(d.recipes).length, "recipe")} and ${plural(A.live(d.plan).length, "planned meal")}`;
    if (!A.live(next.recipes).length && !A.live(next.plan).length) {
      alert("That backup has no recipes or planned meals in it, so nothing was changed.");
      return false;
    }
    if (isNum(raw.schemaVersion) && raw.schemaVersion > DATA_SCHEMA_VERSION) {
      alert("Heads up: this backup was made by a newer version of Turtleduck. Importing it anyway, but some data may not carry over.");
    }
    const mine = A.live(S.recipes).length || A.live(S.plan).length;
    if (ask && mine && !K.backup.ask(A, raw, `Replace your ${count(S)} with the ${count(next)} in this backup?`)) return false;
    Object.assign(S, next);
    persist();
    A.changed(false); // it's from a backup, so there's nothing new to export
    A.renderAll();
    return true;
  }

  // ==========================================================================
  // FOLDER SYNC (the app side of core/sync.js)
  // ==========================================================================
  // A save from the sync folder: taken whole, or combined with ours — the lists item by item, the ticks, sections, days'
  // own times, skipped trips and weeks confirmed key by key, the settings whole — the later change winning. The same on
  // every device, so two combining at once agree.
  const newer = (a, b) => a.u > b.u || (a.u === b.u && JSON.stringify(a) > JSON.stringify(b));
  const inOrder = list => list.slice().sort((a, b) => a.at - b.at || (a.id < b.id ? -1 : 1));
  function merge(mine, theirs) {
    const byId = new Map(mine.map(i => [i.id, i]));
    theirs.forEach(i => { const o = byId.get(i.id); if (!o || newer(i, o)) byId.set(i.id, i); });
    return inOrder([...byId.values()]);
  }
  function mergeKeys(mine, theirs) {
    const out = {};
    [...new Set(Object.keys(mine).concat(Object.keys(theirs)))].sort().forEach(k => {
      const a = own(mine, k) ? mine[k] : null, b = own(theirs, k) ? theirs[k] : null;
      out[k] = !a ? b : !b ? a : newer(b, a) ? b : a;
    });
    return out;
  }
  const sorted = o => Object.keys(o).sort().map(k => [k, o[k]]);
  const dataKey = d => JSON.stringify(LISTS.map(k => inOrder(d[k])).concat(MAPS.map(k => sorted(d[k])), [d.settings]));
  function combine(raw, { replace, plain }) {
    const their = cleanAll(raw);
    if (plain && !their.recipes.length && !their.plan.length) return null;
    const next = replace ? their : {
      ...Object.fromEntries(LISTS.map(k => [k, merge(S[k], their[k])])),
      ...Object.fromEntries(MAPS.map(k => [k, mergeKeys(S[k], their[k])])),
      settings: newer(their.settings, S.settings) ? their.settings : S.settings
    };
    return {
      same: dataKey(next) === dataKey(their),
      apply() {
        if (dataKey(next) === dataKey(S)) return false; // nothing new here
        Object.assign(S, next);
        S.version++;
        return true;
      }
    };
  }

  // Other devices' data came in from the folder: keep it, and show it.
  function afterSync() {
    persist();
    A.renderAll();
  }

  A.load = load;
  A.data = {
    schemaVersion: DATA_SCHEMA_VERSION, build: buildBackup, looksLike,
    hasData: () => LISTS.some(k => S[k].length > 0),
    importBackup, combine, afterSync
  };
  Object.assign(A, { cleanRecipes, cleanEntry, cleanPlan, cleanTrips, cleanManual, cleanTemplates, save, persist });
})(Kyoshi, Kyoshi.apps.turtleduck);
