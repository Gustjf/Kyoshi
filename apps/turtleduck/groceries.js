/* Turtleduck · groceries.js — shopping. Trips are on the plan's days (one a day at most): the schedule's every week
 * (Times & trips: times.js; worked out, app.js liveTrips; the cart skips one, or brings it back) and any placed by hand
 * with the cart, each at its time (a day's own time, set from its list, else its weekday's on the schedule, else the
 * usual time for other trips). Each has its grocery list, worked out from the plan by moments (a day and a time): every
 * recipe cooked from that trip's moment up to the next trip's (the last one through next Sunday), a meal at its slot's
 * time (a snack at SNACK_TIME) — so a trip at 6 pm covers that evening's dinner, and that day's lunch belongs to the
 * list before — its ingredient lines scaled and merged by name (plurals too: "onions" with "onion") and unit (every
 * weight together, every volume together; a line with no amount is a row with none), in store sections, the amounts
 * shown as entered, metric or US (Settings). A tick is "bought" for every planned use in that list's days, so a meal
 * added later past them brings the item back; a tick on one list leaves the others as they were. Ticks go by days, so a
 * day two lists share (a 6 pm trip) counts for both: what's needed only that day shows bought on both once either is
 * ticked. The Now list is what's needed before the first trip (normally empty); groceries added by hand ("running out
 * of…") ride on it when it has anything, else on the first trip's. A past trip is gone from the screen: what it left
 * unbought shows up in Now. A cooked meal's coverage (coverageOf): the trip before it, and whether its ingredients were
 * bought once that trip is past. Also here: each ingredient's section (guessed, or set with a tap and remembered by name),
 * the Groceries view, and Settings (how amounts show, the day's targets). Ticks and sections set before 1.300 merged
 * plurals and units are found under the keys the lines had then, until the new key gets its own. */
(function (K, A) {
  "use strict";
  const S = A.S, $ = A.$;
  const { esc, newId, addDays, todayStr, readNumber, fmtTime } = K.util;
  const { SECTIONS, UNIT_MODES, MAX_MANUAL, MAX_KCAL, MAX_GRAMS, NUTRIENTS, cleanLine, own, kept, fmtRange, fmtFull, fmtWd, moment, mealTime, tripTime, onGrid, dayIndex } = A;

  // ==========================================================================
  // THE LISTS
  // ==========================================================================
  // A row's section: set by hand under its name, or else under a name its lines had before 1.300; else guessed.
  function sectionOf(row) {
    const set = [row.norm, ...[...row.olds.keys()].map(k => k.slice(0, k.lastIndexOf("|")))].find(n => own(S.sections, n));
    return set === undefined ? A.guessSection(row.norm) : S.sections[set].section;
  }
  // Bought: a tick's days cover every use of it in the list. A key never ticked since 1.300 goes by its lines' old
  // keys: bought when each of them is, for its own days.
  const covers = (key, a, b) => own(S.checked, key) && S.checked[key].ranges.some(([x, y]) => x <= a && b <= y);
  const isTicked = row => (own(S.checked, row.key) ? covers(row.key, row.first, row.last) : [...row.olds].every(([k, [a, b]]) => covers(k, a, b)));

  // When a planned meal happens, as a moment.
  const at = e => moment(e.date, mealTime(e.date, e.meal));
  // The recipes cooked from one moment up to (not at) another, by moment.
  const cookedIn = (fromM, toM) => A.liveEntries().filter(e => A.isCooked(e) && at(e) >= fromM && at(e) < toM).sort((a, b) => at(a).localeCompare(at(b)) || A.byAdded(a, b));

  // The rows for the recipes cooked from fromM up to toM (moments): { key, norm, name (the first spelling), many (the
  // first plural spelling, "" when none), unit and qty (base units; qty null when no line gave one), units (the units
  // its amounts were typed in), recipes (names), first and last (the days needing it), olds (its lines' keys before
  // 1.300, each with its first and last day), section, ticked }, by section.
  function rowsFor(fromM, toM) {
    const rows = new Map();
    cookedIn(fromM, toM).forEach(e => {
      const r = A.recipeById(e.recipeId);
      if (!r) return; // a deleted recipe adds nothing
      r.ingredients.forEach(line => {
        const p = A.parseLine(line), b = A.toBase(p);
        let row = rows.get(p.key);
        if (!row) rows.set(p.key, row = { key: p.key, norm: p.norm, name: p.name, many: "", unit: b.unit, qty: null, units: [], recipes: [], first: e.date, last: e.date, olds: new Map() });
        if (b.qty !== null) {
          row.qty = (row.qty || 0) + b.qty * e.scale;
          if (!row.units.includes(p.unit)) row.units.push(p.unit);
        }
        if (p.plural && !row.many) row.many = p.name;
        if (!row.recipes.includes(r.name)) row.recipes.push(r.name);
        const old = row.olds.get(p.oldKey);
        if (old) old[1] = e.date; else row.olds.set(p.oldKey, [e.date, e.date]);
        row.last = e.date;
      });
    });
    return [...rows.values()].map(row => ({ ...row, section: sectionOf(row), ticked: isTicked(row) }))
      .sort((a, b) => SECTIONS.indexOf(a.section) - SECTIONS.indexOf(b.section) || a.norm.localeCompare(b.norm));
  }

  // { now, trips }: each list { id ("now" or the trip's day), kind, date, time (a trip's), fromM and toM (the moments it
  // covers, toM not included), from and through (its days, for its words and its ticks: through is toM's day when a
  // meal it covers falls on it, else the day before), rows, manual (groceries added by hand, on one list only), total,
  // open (not bought yet) }. Now runs from today's start to the first trip (or to the end), and shows only with
  // something on it.
  const lists = () => A.remember("lists", () => {
    const today = todayStr(), end = A.planEnd(), endM = moment(end, "24:00");
    const trips = A.liveTrips().filter(t => t.date >= today && t.date <= end);
    const manual = A.live(S.manual).filter(m => !m.done || m.done >= today).sort(A.byAdded);
    const make = (kind, trip, fromM, toM) => {
      const from = fromM.slice(0, 10), toDay = toM.slice(0, 10), rows = rowsFor(fromM, toM);
      const last = toM === endM || cookedIn(moment(toDay, "00:00"), toM).length ? toDay : addDays(toDay, -1);
      return { id: trip ? trip.date : "now", kind, date: trip ? trip.date : "", time: trip ? tripTime(trip) : "", fromM, toM, from, through: last < from ? from : last, rows, manual: [] };
    };
    const moments = trips.map(t => moment(t.date, tripTime(t)));
    const out = trips.map((t, i) => make("trip", t, moments[i], i + 1 < trips.length ? moments[i + 1] : endM));
    const now = make("now", null, moment(today, "00:00"), moments.length ? moments[0] : endM);
    const host = now.rows.length || !out.length ? now : out[0];
    host.manual = manual;
    [now, ...out].forEach(l => {
      l.total = l.rows.length + l.manual.length;
      l.open = l.rows.filter(r => !r.ticked).length + l.manual.filter(m => !m.done).length;
    });
    return { now, trips: out };
  });
  const listById = id => { const { now, trips } = lists(); return id === "now" ? now : trips.find(l => l.id === id) || null; };

  // ==========================================================================
  // CHANGES
  // ==========================================================================

  // The cart on a day: a trip there, or none. A trip placed by hand goes (two devices may have placed one each: both go);
  // on a weekday of the schedule, its trip is skipped that day (tripSkips), and tapped again it's back.
  function toggleTrip(date) {
    if (!A.inPlan(date) || date < todayStr()) return;
    const t = Date.now(), on = A.hasTrip(date), sched = !!A.scheduleOn(dayIndex(date));
    if (on) S.trips = S.trips.map(x => (!x.deleted && x.date === date ? { id: x.id, deleted: true, at: x.at, u: t } : x));
    if (sched) S.tripSkips[date] = { skip: on, u: t };
    else if (!on) S.trips.push(A.cleanTrips([{ id: newId(), date, at: t, u: t }])[0]);
    kept();
  }

  // A cooked meal's groceries (A.isCooked; else null: a leftover, a quick meal, a restaurant, a skipped one): { state:
  // "none" (no trip before it), "unbought" (its trip is past and missing of its ingredients weren't bought for its day)
  // or "ok", missing, trip }. Its trip: the last before it, by moments (one placed by hand any day, the schedule's from
  // last Monday).
  function coverageOf(e) {
    const r = A.isCooked(e) && A.recipeById(e.recipeId);
    if (!r) return null;
    const when = at(e), trip = A.liveTrips().filter(t => moment(t.date, tripTime(t)) <= when).pop();
    if (!trip) return { state: "none", missing: 0, trip: null };
    if (moment(trip.date, tripTime(trip)) > A.nowMoment()) return { state: "ok", missing: 0, trip };
    const keys = [...new Map(r.ingredients.map(line => { const p = A.parseLine(line); return [p.key, p.oldKey]; }))];
    const missing = keys.filter(([key, old]) => !(own(S.checked, key) ? covers(key, e.date, e.date) : covers(old, e.date, e.date))).length;
    return { state: missing ? "unbought" : "ok", missing, trip };
  }

  // A tick's days, as ranges [[from, until], …]: ticked in a list, its days join them (with any they touch); unticked,
  // they're taken out (the rest stay). Days before today are let go.
  function joined(ranges) {
    const out = [];
    ranges.slice().sort((x, y) => x[0].localeCompare(y[0])).forEach(([a, b]) => {
      const last = out[out.length - 1];
      if (last && a <= addDays(last[1], 1)) { if (b > last[1]) last[1] = b; } else out.push([a, b]);
    });
    return out;
  }
  const without = ([a, b], from, through) => [
    a < from ? [a, b < from ? b : addDays(from, -1)] : null,
    b > through ? [a > through ? a : addDays(through, 1), b] : null
  ].filter(Boolean);
  // A key never ticked since 1.300 starts from the lists showing it bought (by its lines' old keys), so they stay so.
  function shownBought(key) {
    const { now, trips } = lists();
    return [now, ...trips].filter(l => l && l.rows.some(r => r.key === key && r.ticked)).map(l => [l.from, l.through]);
  }
  function tick(key, on, listId) {
    const l = listById(listId);
    if (!l || !key.includes("|")) return;
    const today = todayStr(), was = (own(S.checked, key) ? S.checked[key].ranges : shownBought(key)).filter(([, b]) => b >= today);
    const ranges = on ? joined(was.concat([[l.from, l.through]])) : was.flatMap(r => without(r, l.from, l.through));
    S.checked[key] = { ranges, u: Date.now() };
    kept();
  }

  function addManual(text) {
    const t = cleanLine(text, MAX_MANUAL);
    if (!t) return false;
    const now = Date.now();
    S.manual.push(A.cleanManual([{ id: newId(), text: t, done: "", at: now, u: now }])[0]);
    kept();
    return true;
  }
  function tickManual(id, on) {
    const m = A.live(S.manual).find(x => x.id === id);
    if (!m || !!m.done === on) return;
    Object.assign(m, { done: on ? todayStr() : "", u: Date.now() });
    kept();
  }
  function removeManual(id) {
    const t = Date.now();
    S.manual = S.manual.map(x => (x.id === id && !x.deleted ? { id: x.id, deleted: true, at: x.at, u: t } : x));
    kept();
  }

  // An ingredient's section, set by hand: remembered by its name, on every list from now on.
  function setSection(norm, section) {
    if (!SECTIONS.includes(section) || !norm || norm === "__proto__" || (own(S.sections, norm) && S.sections[norm].section === section)) return;
    S.sections[norm] = { section, u: Date.now() };
    kept();
  }

  // Settings: how the lists show amounts ("entered", "metric" or "us").
  function setUnits(mode) {
    if (!UNIT_MODES.some(([k]) => k === mode) || mode === S.settings.units) return;
    S.settings = { ...S.settings, units: mode, u: Date.now() };
    kept();
  }

  // Settings: the day's targets, each optional (empty: none).
  const TARGET_IDS = { kcal: "targetKcal", protein: "targetProtein", carbs: "targetCarbs", fat: "targetFat", fiber: "targetFiber" };
  function setTargets() {
    const targets = {};
    for (const [k] of NUTRIENTS) {
      const el = $(TARGET_IDS[k]), v = readNumber(el), max = k === "kcal" ? 4 * MAX_KCAL : 2 * MAX_GRAMS;
      if (v !== null && !(v > 0 && v <= max)) {
        el.value = S.settings.targets[k] === null ? "" : S.settings.targets[k];
        return alert(`A day's ${k === "kcal" ? "kcal" : k === "protein" ? "quality protein (g)" : `${k} (g)`}: from 1 to ${max}, or empty for no target.`);
      }
      targets[k] = v === null ? null : Math.round(v);
    }
    if (JSON.stringify(targets) === JSON.stringify(S.settings.targets)) return;
    S.settings = { ...S.settings, targets, u: Date.now() };
    kept();
  }

  // ==========================================================================
  // THE GROCERIES VIEW: Add by hand, then Now (when it has anything) and each trip's list; ticked rows sink into Bought
  // ==========================================================================
  const CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';
  const box = (attrs, on, label) => `<input type="checkbox" class="g-check" ${attrs}${on ? " checked" : ""} aria-label="${esc(label)}"><span class="g-box" aria-hidden="true">${CHECK}</span>`;
  const sectionPick = row => `<select class="g-sec" data-section="${esc(row.norm)}" aria-label="${esc(`Store section for ${row.name}`)}">` +
    SECTIONS.map(s => `<option${s === row.section ? " selected" : ""}>${esc(s)}</option>`).join("") + `</select>`;
  function rowHTML(l, row) {
    const what = A.fmtLine(row, S.settings.units);
    return `<div class="g-row${row.ticked ? " ticked" : ""}" data-key="${esc(row.key)}"><label class="g-main">${box(`data-tick="${esc(row.key)}" data-list="${esc(l.id)}"`, row.ticked, what)}` +
      `<span class="g-text"><span class="g-what">${esc(what)}</span><span class="g-for">${esc(row.recipes.join(", "))}</span></span></label>${sectionPick(row)}</div>`;
  }
  const manualHTML = m => `<div class="g-row manual${m.done ? " ticked" : ""}"><label class="g-main">${box(`data-manual="${esc(m.id)}"`, !!m.done, m.text)}` +
    `<span class="g-text"><span class="g-what">${esc(m.text)}</span><span class="g-tag">added by hand</span></span></label>` +
    `<button type="button" class="icon-btn g-remove" data-act="manual-remove" data-id="${esc(m.id)}" aria-label="${esc(`Remove ${m.text}`)}">&times;</button></div>`;

  // A trip's time on its list: to change that day's (back to the usual with Usual).
  function timeHTML(l) {
    const mine = A.isOwnTime(l.date, "trip"), usual = A.usualTime("trip", l.date);
    return `<span class="g-when">· <input type="time" class="g-time" step="900" data-trip-time="${esc(l.date)}" value="${esc(l.time)}" aria-label="${esc(`Time of ${fmtFull(l.date)}'s trip`)}">` +
      (mine ? `<button type="button" class="secondary small g-usual" data-act="trip-time-usual" data-date="${esc(l.date)}" title="${esc(`Back to ${fmtTime(usual)}`)}">Usual</button>` : "") + `</span>`;
  }

  function listHTML(l, firstTrip) {
    const title = l.kind === "trip" ? fmtFull(l.date) : firstTrip ? `Needed before ${fmtWd(firstTrip.date)}'s trip` : "Everything planned";
    const open = l.rows.filter(r => !r.ticked), bought = l.rows.filter(r => r.ticked);
    const manualOpen = l.manual.filter(m => !m.done), manualDone = l.manual.filter(m => m.done);
    const groups = [];
    if (manualOpen.length) groups.push(`<div class="g-head-sec">Added by hand</div>${manualOpen.map(manualHTML).join("")}`);
    SECTIONS.forEach(s => {
      const rows = open.filter(r => r.section === s);
      if (rows.length) groups.push(`<div class="g-head-sec">${esc(s)}</div>${rows.map(r => rowHTML(l, r)).join("")}`);
    });
    const done = bought.length + manualDone.length;
    const empty = !l.total ? `<div class="empty-msg">${l.kind === "trip" ? "Nothing to buy for these meals." : "Nothing planned to buy yet."}</div>` : "";
    return `<section class="g-list" data-list="${esc(l.id)}"><div class="g-top"><h2 class="g-title">${esc(title)}</h2>${l.kind === "trip" ? timeHTML(l) : ""}` +
      `<span class="g-meta">for meals ${esc(fmtRange(l.from, l.through))}</span><span class="g-count">${l.total ? `${done} of ${l.total}` : ""}</span></div>` +
      empty + groups.join("") +
      (done ? `<details class="g-bought" data-list="${esc(l.id)}"${S.boughtOpen && S.boughtOpen.has(l.id) ? " open" : ""}><summary>Bought (${done})</summary>` +
        manualDone.map(manualHTML).join("") + bought.map(r => rowHTML(l, r)).join("") + `</details>` : "") + `</section>`;
  }

  function renderGroceries() {
    const { now, trips } = lists();
    const out = [];
    if (!trips.length) out.push(`<div class="g-note">No trip yet: tap the cart on a day in the plan.</div>`);
    if (now && (now.total || !trips.length)) out.push(listHTML(now, trips[0]));
    trips.forEach(l => out.push(listHTML(l)));
    $("lists").innerHTML = out.join("");
    $("unitsToggle").querySelectorAll(".mode-btn").forEach(b => {
      b.classList.toggle("active", b.dataset.units === S.settings.units);
      b.setAttribute("aria-pressed", String(b.dataset.units === S.settings.units));
    });
    NUTRIENTS.forEach(([k]) => { const el = $(TARGET_IDS[k]); if (document.activeElement !== el) el.value = S.settings.targets[k] === null ? "" : S.settings.targets[k]; });
  }

  // A trip's time typed on its list: that day's own (on the 15-minute grid, else it's put back as it was).
  function setTripTime(el) {
    const date = el.dataset.tripTime, trip = A.liveTrips().find(t => t.date === date);
    if (!trip) return A.renderAll();
    if (el.value === tripTime(trip)) return;
    if (el.validity.badInput || !onGrid(el.value)) {
      el.value = tripTime(trip);
      return alert("A trip's time goes in 15-minute steps (:00, :15, :30 or :45), as in Momo.");
    }
    A.setSlotTime(date, "trip", el.value);
  }

  // From Momo's "Open in Turtleduck": a trip's list (or Now) comes into view, flashing.
  function revealList(id) {
    const el = A.root.querySelector(`.g-list[data-list="${CSS.escape(id)}"]`) || A.root.querySelector(".g-list");
    A.reveal(el);
  }

  function wireGroceries() {
    S.boughtOpen = new Set();
    // Add by hand: Enter or Add adds it, and the field keeps its focus (tapping Add leaves the phone's keyboard up).
    $("manualForm").addEventListener("submit", e => {
      e.preventDefault();
      if (addManual($("manualText").value)) $("manualText").value = "";
      $("manualText").focus();
    });
    $("manualForm").addEventListener("mousedown", e => { if (e.target.closest("button")) e.preventDefault(); });
    $("lists").addEventListener("change", e => {
      const el = e.target;
      if (el.dataset.tick) tick(el.dataset.tick, el.checked, el.dataset.list);
      else if (el.dataset.manual) tickManual(el.dataset.manual, el.checked);
      else if (el.dataset.section !== undefined) setSection(el.dataset.section, el.value);
    });
    // A trip's time is kept once its field is left (or on Enter): a time field reports each digit typed as a change.
    $("lists").addEventListener("focusout", e => { if (e.target.dataset && e.target.dataset.tripTime) setTripTime(e.target); });
    $("lists").addEventListener("keydown", e => { if (e.key === "Enter" && e.target.dataset && e.target.dataset.tripTime) { e.preventDefault(); e.target.blur(); } });
    // Bought stays open or folded as left, through redraws.
    $("lists").addEventListener("toggle", e => {
      const d = e.target;
      if (d.matches && d.matches("details.g-bought")) S.boughtOpen[d.open ? "add" : "delete"](d.dataset.list);
    }, true);
    $("unitsToggle").addEventListener("click", e => { const b = e.target.closest("[data-units]"); if (b) setUnits(b.dataset.units); });
    Object.values(TARGET_IDS).forEach(id => $(id).addEventListener("change", setTargets));
  }

  Object.assign(A, { lists, toggleTrip, coverageOf, removeManual, renderGroceries, revealList, wireGroceries });
})(Kyoshi, Kyoshi.apps.turtleduck);
