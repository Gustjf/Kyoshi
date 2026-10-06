/* Turtleduck · app.js — registers Turtleduck with Kyoshi, plus its constants (limits, the meals, the usual times and
 * lengths, the minutes Momo's cards take, the store sections), state (A.S) and small helpers: text and numbers, days and
 * weeks (the plan is this week and next, Monday to Sunday, as in Momo), times of day (the usual ones, a day's own, a
 * trip's) and moments, a week confirmed for Momo, nutrition and minutes as words, and lookups — which recipe, planned
 * meal or shopping trip is which (the schedule's trips worked out too), worked out once until the data or the day
 * changes (remember): "last cooked" and "cooked N×",
 * a batch's portions left, the leftovers it can't give (short) and the shelf, a store-bought item's count on hand (what
 * its stock covers, and what's left to buy), what a meal adds to its day and how long it takes. Loads first of the
 * app's files: the others destructure what's here at the top, and call functions from each other as A.name(). File
 * map and data model: apps/turtleduck/CLAUDE.md. */
(function (K) {
  "use strict";
  const { isNum, isTime, dateMs, addDays, fmtDate, fmtShort, fmtNum, todayStr } = K.util;

  const A = K.register({
    id: "turtleduck",
    name: "Turtleduck",
    title: "Turtleduck — Meals",
    subtitle: "Recipes, the two weeks' meals and the grocery list, for Momo to fit into your week.",
    width: 1180,
    // Its checkup (core/meetings.js): when you last looked it over in depth; no schedule, so no reminders.
    meetings: [{ id: "checkup", title: "Checkup", every: "whenever", minutes: 15 }],
    // The "cooking-pot" icon from Lucide (ISC license) — Zuko's turtleducks, fed by the pond — in amber.
    icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12h20"/><path d="M20 12v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8"/><path d="m4 8 16-4"/><path d="m8.86 6.78-.45-1.81a2 2 0 0 1 1.45-2.43l1.94-.48a2 2 0 0 1 2.43 1.46l.45 1.8"/></svg>'
  });

  // ==========================================================================
  // CONSTANTS
  // ==========================================================================
  Object.assign(A, {
    // Backup file format. Bump only when import has to migrate the data.
    DATA_SCHEMA_VERSION: 1,
    MAX_NAME: 40,            // a recipe's name (Momo's need titles are ≤ 60: names joined are cut)
    MAX_LINES: 60,           // ingredient lines in a recipe
    MAX_LINE: 100,           // characters in an ingredient line
    MAX_STEPS: 4000,         // a recipe's steps, as typed
    MAX_QUICK: 60,           // a quick meal's or restaurant's text
    MAX_MINUTES: 600,        // prep, and cook
    MAX_SERVINGS: 50,        // a recipe's yield at ×1, and portions in one place
    MAX_STOCK: 999,          // a store-bought item's count on hand
    MIN_SCALE: 0.5,
    MAX_SCALE: 10,           // a batch's ×, in halves
    MAX_KCAL: 5000,
    MAX_GRAMS: 500,          // protein, carbs, fat and fiber
    MAX_LINK: 300,
    MAX_PASTE: 200,          // recipes in one paste
    MAX_TEMPLATES: 20,
    MAX_TEMPLATE_NAME: 30,
    MAX_MANUAL: 60,          // a grocery added by hand
    MAX_CHIPS: 12,           // meals in one cell of the plan
    // The plan's rows, in order: the four meals, then Cook (batch cooking that day: cooked, not eaten there).
    MEALS: [["breakfast", "Breakfast"], ["lunch", "Lunch"], ["dinner", "Dinner"], ["snack", "Snack"], ["cook", "Cook"]],
    // A recipe's meal type, the only "tag": the sidebar and the recipe list group by it.
    TYPES: [["breakfast", "Breakfast"], ["lunch", "Lunch"], ["dinner", "Dinner"], ["snack", "Snack"], ["any", "Any"]],
    MOMO_MEALS: ["breakfast", "lunch", "dinner"], // snacks never go to Momo
    SLOTS: ["breakfast", "lunch", "dinner"],      // the meals with a slot of their own in Momo's baseline, each day (share.js routine)
    // The usual times ("Times & trips": times.js), on Momo's 15-minute grid, and the meals' usual lengths in minutes (a
    // slot's while no meal fills it). A snack has no slot: for the grocery lists it's at SNACK_TIME.
    DEFAULT_TIMES: { breakfast: "07:30", lunch: "12:00", dinner: "18:00", cook: "16:00", trip: "10:00" },
    DEFAULT_LENGTHS: { breakfast: 15, lunch: 30, dinner: 45 },
    MIN_LENGTH: 5, MAX_LENGTH: 240, // a usual length, in 5-minute steps
    SNACK_TIME: "15:00",
    GROCERY_MINUTES: 45,
    DEFAULT_COOK_MINUTES: 45,  // a meal cooked there, when its recipe gives no prep or cook minutes
    QUICK_MINUTES: 20,         // a leftover or a quick meal
    RESTAURANT_MINUTES: 60,    // eating out takes longer
    SHELF_DAYS: 28,            // a batch's portions wait on the shelf this long after it's cooked
    SECTIONS: ["Produce", "Meat & fish", "Dairy & eggs", "Bakery", "Frozen", "Pantry", "Drinks", "Other"],
    // How the grocery lists show amounts (Groceries → Settings): the first is the default.
    UNIT_MODES: [["entered", "As entered"], ["metric", "Metric"], ["us", "US"]],
    // Per serving, typed in: [key, short label, word] ("P 45", "45 g protein").
    NUTRIENTS: [["kcal", "kcal", "kcal"], ["protein", "P", "protein"], ["carbs", "C", "carbs"], ["fat", "F", "fat"], ["fiber", "Fi", "fiber"]],
    CLIP_MS: 5000,             // a copied or cut meal waits this long for Ctrl+V (each paste gives another)
    PAGE: 30,                  // recipes shown at a time in the picker
    PLAN_PX: 900,              // the plan is a grid wider than this, a list of days at most this wide
    PHONE: "(max-width: 640px)" // a phone (as Momo has it): Turtleduck opens on Groceries
  });

  // ==========================================================================
  // STATE
  // ==========================================================================
  const S = Object.assign(A.S, {
    // Saved and synced (CLAUDE.md has their shapes). Deleted items stay as markers so sync can't bring them back.
    recipes: [], plan: [], trips: [], manual: [], templates: [],
    checked: {},   // "<name>|<unit>" -> { ranges, u }: bought for every planned use in those days
    sections: {},  // "<name>" -> { section, u }: set by hand in the grocery list
    slotTimes: {}, // "<date>:<breakfast|lunch|dinner|cook|trip>" -> { time ("" = the usual), u }: a day's own time
    tripSkips: {}, // "<date>" -> { skip, u }: a scheduled trip's day with no trip after all (false: back on)
    confirmed: {}, // "<Monday>" -> { at (0: not any more), u }: that week's meals are on Momo since at
    settings: { targets: { kcal: null, protein: null, carbs: null, fat: null, fiber: null }, units: "entered",
      times: { ...A.DEFAULT_TIMES }, lengths: { ...A.DEFAULT_LENGTHS }, schedule: [], u: 0 },
    version: 0,    // counts every change to the stored data, so what's worked out is worked out again (remember)
    // On screen (this device only)
    view: "plan",  // "plan" | "recipes" | "groceries" | "cook"
    back: "plan",  // the view the cook view goes back to
    week: "this",  // the plan's tab: "this" | "next"
    search: "",    // the plan's sidebar
    listSearch: "", // the Recipes view
    editing: null, // the recipe pop-up (recipes.js)
    picking: null, // the picker: { date, meal, replace, shown, query } (plan-popups.js)
    entry: null,   // the planned meal's pop-up: { id }
    cooking: null, // the cook view: { items: [{ recipeId, scale, name }], index }
    paste: null,   // Paste recipes' preview (paste.js)
    clip: null,    // a meal copied or cut: { id, cut, timer } (clipboard.js)
    mouse: null,   // where the mouse is, for Ctrl+C / X / V
    drag: null,    // what's being dragged: { what: "recipe" | "portion" | "entry", id } (drag.js)
    menu: false,   // the plan's ⋯ menu is open
    timesSnapshot: null, // Times & trips' form as opened, to tell whether closing it would lose changes (times.js)
    knownToday: "" // today as of the last draw, to redraw when the date changes
  });

  // ==========================================================================
  // HELPERS: text and numbers
  // ==========================================================================
  // A line as it's kept: runs of spaces and line breaks become one space, cut to max characters without splitting an
  // emoji.
  const cleanLine = (v, max) => (typeof v === "string" ? [...v.replace(/\s+/g, " ").trim()].slice(0, max).join("").trim() : "");
  // Text with its lines kept (a recipe's steps): Windows line ends and trailing spaces go, at most two blank lines in a row.
  const cleanText = (v, max) => (typeof v === "string" ? [...v.replace(/\r\n?/g, "\n").replace(/[ \t]+$/gm, "").replace(/\n{4,}/g, "\n\n\n").trim()].slice(0, max).join("").trim() : "");
  // A whole number from min to max, or fallback when it's no number.
  const clampInt = (v, min, max, fallback) => (isNum(v) ? Math.min(max, Math.max(min, Math.round(v))) : fallback);
  // A number from min to max to `places` decimals, or null when it's no number (unknown).
  const numIn = (v, min, max, places = 0) => (isNum(v) ? +Math.min(max, Math.max(min, v)).toFixed(places) : null);
  const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  const sameName = (a, b) => a.toLowerCase() === b.toLowerCase();
  // An object's own key (never one every object has, like "constructor").
  const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  // A change made here: stored, counted for sync, and drawn (data.js save, render.js renderAll).
  const kept = () => { A.save(); A.renderAll(); };
  // "1,850" and "45": kcal whole, grams to a decimal.
  const fmtKcal = v => Math.round(v).toLocaleString("en-US");
  const fmtG = v => fmtNum(v, 1);
  // A batch's ×: "½", "1", "1½", "2".
  const fmtScale = v => `${Math.floor(v) || ""}${v % 1 ? "½" : ""}` || "0";
  // "45 min", "1 h 15 min", "2 h".
  function fmtMinutes(m) {
    const h = Math.floor(m / 60), r = Math.round(m % 60);
    return h ? `${h} h${r ? ` ${r} min` : ""}` : `${r} min`;
  }

  // ==========================================================================
  // HELPERS: days. The plan is this week and next, Monday to Sunday, as in Momo.
  // ==========================================================================
  const mondayOf = d => addDays(d, -((new Date(dateMs(d)).getUTCDay() + 6) % 7));
  const thisMonday = () => mondayOf(todayStr());
  const nextMonday = () => addDays(thisMonday(), 7);
  const planEnd = () => addDays(nextMonday(), 6); // next week's Sunday: nothing is planned beyond it
  const weekDates = monday => Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const inPlan = d => d >= thisMonday() && d <= planEnd();
  // A day, with its year only when it isn't this year: "Sep 28", "Mar 3, 2025".
  const fmtDay = d => (d.slice(0, 4) === todayStr().slice(0, 4) ? fmtShort(d) : fmtDate(d));
  const fmtWd = d => fmtDate(d, { weekday: "short" });           // "Mon"
  const fmtHead = d => `${fmtWd(d)} ${+d.slice(8)}`;               // "Mon 5"
  const fmtFull = d => `${fmtWd(d)} ${fmtDay(d)}`;                 // "Mon Oct 5"
  // "Oct 5", "Oct 5 – 9", "Sep 30 – Oct 2".
  const fmtRange = (a, b) => (a === b ? fmtDay(a) : a.slice(0, 7) === b.slice(0, 7) ? `${fmtDay(a)} – ${+b.slice(8)}` : `${fmtDay(a)} – ${fmtDay(b)}`);
  const mealTitle = meal => (A.MEALS.find(m => m[0] === meal) || ["", "Meal"])[1];
  const mealIndex = meal => A.MEALS.findIndex(m => m[0] === meal);
  const dayIndex = d => (new Date(dateMs(d)).getUTCDay() + 6) % 7; // 0 = Monday, as in Momo

  // ==========================================================================
  // HELPERS: times of day ("HH:MM", on Momo's 15-minute grid), as "Times & trips" sets them (times.js), and moments
  // ("<date> <time>", which sort as text: the grocery lists and coverage go by them)
  // ==========================================================================
  const onGrid = t => isTime(t) && +t.slice(3) % 15 === 0;
  // A scheduled trip's weekday (0 = Monday): { day, time }, or null.
  const scheduleOn = day => S.settings.schedule.find(s => s.day === day) || null;
  // The usual time of a meal's slot ("breakfast", "lunch", "dinner"), the Cook row ("cook") or a trip ("trip": its
  // weekday's on the schedule, else the usual time for other trips).
  const usualTime = (kind, date = null) => (kind === "trip" && date && scheduleOn(dayIndex(date)) ? scheduleOn(dayIndex(date)).time : S.settings.times[kind]);
  // A day's own time for it (set from the meal's pop-up, or a trip's list), else the usual.
  const slotTime = (date, kind) => { const x = own(S.slotTimes, `${date}:${kind}`) && S.slotTimes[`${date}:${kind}`].time; return x || usualTime(kind, date); };
  const isOwnTime = (date, kind) => own(S.slotTimes, `${date}:${kind}`) && !!S.slotTimes[`${date}:${kind}`].time;
  // A meal slot's usual length (minutes): its card's in Momo while no meal fills it.
  const slotMinutes = meal => S.settings.lengths[meal];
  const tripTime = t => slotTime(t.date, "trip");
  // When a planned meal happens (a snack: SNACK_TIME); a moment to compare.
  const mealTime = (date, meal) => (meal === "snack" ? A.SNACK_TIME : slotTime(date, meal));
  const moment = (date, time) => `${date} ${time}`;
  const nowMoment = () => { const t = new Date(); return moment(todayStr(), `${String(t.getHours()).padStart(2, "0")}:${String(t.getMinutes()).padStart(2, "0")}`); };
  // A week's meals are on Momo once confirmed (confirm.js).
  const isConfirmed = monday => own(S.confirmed, monday) && S.confirmed[monday].at > 0;

  // ==========================================================================
  // LOOKUPS, worked out once until the data (S.version) or the day changes. Deleted items are only markers.
  // ==========================================================================
  let memoKey = "", memo = new Map();
  function remember(key, fn) {
    const k = `${S.version}|${todayStr()}`;
    if (k !== memoKey) { memoKey = k; memo = new Map(); }
    if (!memo.has(key)) memo.set(key, fn());
    return memo.get(key);
  }

  const live = list => list.filter(x => !x.deleted);
  const byAdded = (a, b) => a.at - b.at || (a.id < b.id ? -1 : 1);
  const byName = (a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }) || byAdded(a, b);
  // Every live recipe (archived ones too: they're hidden from the sidebar and the picker, not gone), by name.
  const liveRecipes = () => remember("recipes", () => live(S.recipes).sort(byName));
  const shownRecipes = () => remember("shown", () => liveRecipes().filter(r => !r.archived));
  const recipeById = id => (id && remember("recipeIds", () => new Map(liveRecipes().map(r => [r.id, r]))).get(id)) || null;
  // Every live planned meal, in the order it was placed.
  const liveEntries = () => remember("entries", () => live(S.plan).sort(byAdded));
  const entryById = id => (id && remember("entryIds", () => new Map(liveEntries().map(e => [e.id, e]))).get(id)) || null;
  const cells = () => remember("cells", () => {
    const out = new Map();
    liveEntries().forEach(e => { const k = `${e.date}|${e.meal}`; (out.get(k) || out.set(k, []).get(k)).push(e); });
    return out;
  });
  const entriesOn = (date, meal) => cells().get(`${date}|${meal}`) || [];
  // One trip a day: two devices placing one on the same day keep the earliest placed. Then the schedule's (worked out,
  // never stored: { id: "sched:<date>", date, sched: true }): each scheduled weekday from last Monday to the plan's end
  // with no trip placed by hand and not skipped (tripSkips). By date.
  const isSkipped = date => own(S.tripSkips, date) && S.tripSkips[date].skip === true;
  const liveTrips = () => remember("trips", () => {
    const out = new Map(), end = planEnd();
    live(S.trips).sort(byAdded).forEach(t => { if (!out.has(t.date)) out.set(t.date, t); });
    for (let d = addDays(thisMonday(), -7); d <= end; d = addDays(d, 1)) {
      if (!out.has(d) && scheduleOn(dayIndex(d)) && !isSkipped(d)) out.set(d, { id: `sched:${d}`, date: d, sched: true });
    }
    return [...out.values()].sort((a, b) => a.date.localeCompare(b.date));
  });
  const hasTrip = date => liveTrips().some(t => t.date === date);
  const liveTemplates = () => remember("templates", () => live(S.templates).sort(byName));

  // A planned meal's name: its recipe's (the name as placed once the recipe is deleted), the text, or what it is.
  function nameOf(e) {
    if (e.kind === "skipped") return "Skipped";
    if (e.kind === "recipe") { const r = recipeById(e.recipeId); return r ? r.name : e.name || "Recipe"; }
    return e.name || (e.kind === "restaurant" ? "Restaurant" : "Quick meal");
  }
  // Cooked there (a recipe placed on a meal, or on the Cook row), rather than a leftover portion of one.
  const isCooked = e => e.kind === "recipe" && !e.leftover;

  // --- History: cooked entries up to today, counted (not portions) ---
  const history = () => remember("history", () => {
    const today = todayStr(), out = new Map();
    liveEntries().forEach(e => {
      if (!isCooked(e) || e.date > today) return;
      const h = out.get(e.recipeId) || out.set(e.recipeId, { last: "", times: 0 }).get(e.recipeId);
      h.times++;
      if (e.date > h.last) h.last = e.date;
    });
    return out;
  });
  const lastCooked = id => (history().get(id) || { last: "" }).last;
  const cookedTimes = id => (history().get(id) || { times: 0 }).times;

  // --- A batch's portions: a cooked entry yields its recipe's servings × its scale; what isn't eaten there or placed as
  // leftovers waits on the shelf. Its recipe deleted, or store-bought, it yields nothing (no portions on the shelf). ---
  const yieldAt = (r, scale) => Math.max(1, Math.round(r.servings * scale)); // a recipe's portions at a ×
  const yieldOf = e => { const r = isCooked(e) && recipeById(e.recipeId); return r && !r.bought ? yieldAt(r, e.scale) : 0; };
  const leftoversOf = id => remember("leftovers", () => {
    const out = new Map();
    liveEntries().forEach(e => { if (e.kind === "recipe" && e.leftover && e.from) (out.get(e.from) || out.set(e.from, []).get(e.from)).push(e); });
    return out;
  }).get(id) || [];
  // Can go below 0 (two devices placing portions, or a smaller ×): shown as it is.
  const portionsLeft = e => yieldOf(e) - e.servings - leftoversOf(e.id).reduce((n, x) => n + x.servings, 0);
  // The leftovers a batch can't give, once it's overdrawn (a lowered ×, a recipe's servings changed, two devices placing
  // portions): what's eaten where it's cooked counts first, then its leftovers by day, meal and placing order; from where
  // its yield runs out, every one is short (marked on the plan, still counted in its day's totals). A set of their ids.
  const shortPortions = () => remember("short", () => {
    const out = new Set(), order = (a, b) => a.date.localeCompare(b.date) || mealIndex(a.meal) - mealIndex(b.meal) || byAdded(a, b);
    liveEntries().forEach(c => {
      const y = yieldOf(c);
      let n = c.servings;
      if (y) [...leftoversOf(c.id)].sort(order).forEach(x => { n += x.servings; if (n > y) out.add(x.id); });
    });
    return out;
  });
  // The shelf: batches with portions left, cooked within SHELF_DAYS before today through the end of the plan, cook day first.
  const shelf = () => remember("shelf", () => {
    const from = addDays(todayStr(), -A.SHELF_DAYS), to = planEnd();
    return liveEntries().filter(e => isCooked(e) && e.date >= from && e.date <= to && portionsLeft(e) > 0)
      .sort((a, b) => a.date.localeCompare(b.date) || mealIndex(a.meal) - mealIndex(b.meal) || byAdded(a, b));
  });

  // --- A store-bought item (its recipe's bought): placed like a recipe, never cooked, so it yields no portions. Its stock,
  // when tracked, is the count typed on its day (stock.date), run down by its meals from that day on, in date, meal and
  // placing order — worked out, never stored: after each meal, what's left (below 0 once it has run out); start, what's
  // left before today's meals (the recipe pop-up's On hand); hand, after them; runsOut, the first day after today it
  // doesn't cover. ---
  const isBought = e => { const r = isCooked(e) && recipeById(e.recipeId); return !!r && r.bought; };
  const stocks = () => remember("stock", () => {
    const out = new Map(), today = todayStr(), order = (a, b) => a.date.localeCompare(b.date) || mealIndex(a.meal) - mealIndex(b.meal) || byAdded(a, b);
    liveRecipes().forEach(r => { if (r.bought && r.stock) out.set(r.id, { from: r.stock.date, left: r.stock.count, start: r.stock.count, hand: r.stock.count, runsOut: "", after: new Map() }); });
    liveEntries().filter(e => e.kind === "recipe" && out.has(e.recipeId) && e.date >= out.get(e.recipeId).from).sort(order).forEach(e => {
      const s = out.get(e.recipeId);
      s.left -= e.servings;
      s.after.set(e.id, s.left);
      if (e.date < today) s.start = s.left;
      if (e.date <= today) s.hand = s.left;
      else if (s.left < 0 && !s.runsOut) s.runsOut = e.date;
    });
    return out;
  });
  const stockOf = r => (r && stocks().get(r.id)) || null;
  // On hand after today's meals, or before them (null: not tracked). Either can go below 0: shown as 0, in red.
  const onHand = r => (stockOf(r) ? stockOf(r).hand : null);
  const stockStart = r => (stockOf(r) ? stockOf(r).start : null);
  const runsOut = r => (stockOf(r) ? stockOf(r).runsOut : "");
  // What's left once this meal is eaten (null: not tracked, or a meal from before it was counted).
  const stockAfter = e => { const s = e.kind === "recipe" && stocks().get(e.recipeId); return s && s.after.has(e.id) ? s.after.get(e.id) : null; };
  // A store-bought meal's portions its stock doesn't cover, to buy (all of them while it isn't tracked); 0 for a meal
  // that isn't store-bought.
  function toBuy(e) {
    if (!isBought(e)) return 0;
    const after = stockAfter(e);
    return after === null ? e.servings : Math.min(e.servings, Math.max(0, -after));
  }

  // --- What meals add to their day: per serving × portions (a recipe's), a quick meal's or restaurant's own; the Cook
  // row and skipped meals nothing. A nutrient nobody typed stays null; unknown: a meal without its kcal. ---
  function addUp(entries) {
    const t = { kcal: null, protein: null, carbs: null, fat: null, fiber: null, unknown: false, count: 0 };
    entries.forEach(e => {
      if (e.meal === "cook" || e.kind === "skipped") return;
      const src = e.kind === "recipe" ? recipeById(e.recipeId) : e, times = e.kind === "recipe" ? e.servings : 1;
      t.count++;
      if (!src || !isNum(src.kcal)) t.unknown = true;
      if (src) A.NUTRIENTS.forEach(([k]) => { if (isNum(src[k])) t[k] = (t[k] || 0) + src[k] * times; });
    });
    return t;
  }
  // "650 kcal · P 45 · C 40 · F 30 · Fi 8" (what's known); long, as Momo shows it: "650 kcal · 45 g protein · …".
  const fmtMacros = (t, long = false) => A.NUTRIENTS.filter(([k]) => isNum(t[k]))
    .map(([k, short, word]) => (k === "kcal" ? `${fmtKcal(t.kcal)} kcal` : long ? `${fmtG(t[k])} g ${word}` : `${short} ${fmtG(t[k])}`)).join(" · ");

  // --- How long a meal takes, for Momo: cooked there, its recipe's prep + cook (DEFAULT_COOK_MINUTES when it gives
  // none); a leftover, a quick meal or a store-bought item QUICK_MINUTES; a restaurant RESTAURANT_MINUTES; skipped
  // nothing. ---
  function entryMinutes(e) {
    if (e.kind === "skipped") return 0;
    if (e.kind === "restaurant") return A.RESTAURANT_MINUTES;
    const r = e.kind === "recipe" ? recipeById(e.recipeId) : null;
    if (e.kind === "quick" || e.leftover || (r && r.bought)) return A.QUICK_MINUTES;
    const m = r ? (r.prepMin || 0) + (r.cookMin || 0) : 0;
    return m > 0 ? m : A.DEFAULT_COOK_MINUTES;
  }

  Object.assign(A, {
    cleanLine, cleanText, clampInt, numIn, plural, cap, sameName, own, kept, fmtKcal, fmtG, fmtScale, fmtMinutes,
    mondayOf, thisMonday, nextMonday, planEnd, weekDates, inPlan, fmtDay, fmtWd, fmtHead, fmtFull, fmtRange, mealTitle, mealIndex, dayIndex,
    onGrid, scheduleOn, usualTime, slotTime, isOwnTime, slotMinutes, tripTime, mealTime, moment, nowMoment, isConfirmed,
    remember, live, byAdded, liveRecipes, shownRecipes, recipeById, liveEntries, entryById, entriesOn, isSkipped, liveTrips, hasTrip, liveTemplates,
    nameOf, isCooked, lastCooked, cookedTimes, yieldAt, yieldOf, leftoversOf, portionsLeft, shortPortions, shelf,
    isBought, onHand, stockStart, runsOut, stockAfter, toBuy, addUp, fmtMacros, entryMinutes
  });
})(Kyoshi);
