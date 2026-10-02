/* Turtleduck · groceries.js — shopping. Trips are placed on the plan's days (the cart toggle; one a day at most), and each
 * has its grocery list, worked out from the plan: every recipe cooked from that trip's day up to the day before the next
 * trip (the last one through next Sunday), its ingredient lines scaled and merged by name and unit (kg with g, l with
 * ml; a line with no amount is a row with none), in store sections. A tick is "bought" for every planned use in that
 * list's days, so a meal added later past them brings the item back; a tick on one list leaves the others as they were.
 * The Now list is what's needed before the first trip (normally empty); groceries added by hand ("running out of…") ride
 * on it when it has anything, else on the first trip's. A past trip is gone from the screen: what it left unbought shows
 * up in Now. Also here: each ingredient's section (guessed, or set with a tap and remembered by name), the Groceries
 * view, and Settings (the day's targets). */
(function (K, A) {
  "use strict";
  const S = A.S, $ = A.$;
  const { esc, newId, addDays, todayStr, readNumber } = K.util;
  const { SECTIONS, MAX_MANUAL, MAX_KCAL, MAX_GRAMS, NUTRIENTS, cleanLine, own, kept, fmtRange, fmtFull, fmtWd } = A;

  // ==========================================================================
  // THE LISTS
  // ==========================================================================
  const sectionOf = norm => (own(S.sections, norm) ? S.sections[norm].section : A.guessSection(norm));
  // Bought: a tick's days cover every use of it in the list.
  const isTicked = row => own(S.checked, row.key) && S.checked[row.key].ranges.some(([a, b]) => a <= row.first && row.last <= b);

  // The rows for the recipes cooked from–through: { key, norm, name (the first spelling), unit and qty (base units; qty
  // null when no line gave one), recipes (names), first and last (the days needing it), section, ticked }, by section.
  function rowsFor(from, through) {
    const rows = new Map();
    A.liveEntries().filter(e => A.isCooked(e) && e.date >= from && e.date <= through).sort((a, b) => a.date.localeCompare(b.date) || A.byAdded(a, b)).forEach(e => {
      const r = A.recipeById(e.recipeId);
      if (!r) return; // a deleted recipe adds nothing
      r.ingredients.forEach(line => {
        const p = A.parseLine(line), b = A.toBase(p);
        let row = rows.get(p.key);
        if (!row) rows.set(p.key, row = { key: p.key, norm: p.norm, name: p.name, unit: b.unit, qty: null, recipes: [], first: e.date, last: e.date });
        if (b.qty !== null) row.qty = (row.qty || 0) + b.qty * e.scale;
        if (!row.recipes.includes(r.name)) row.recipes.push(r.name);
        row.last = e.date;
      });
    });
    return [...rows.values()].map(row => ({ ...row, section: sectionOf(row.norm), ticked: isTicked(row) }))
      .sort((a, b) => SECTIONS.indexOf(a.section) - SECTIONS.indexOf(b.section) || a.norm.localeCompare(b.norm));
  }

  // { now, trips }: each list { id ("now" or the trip's day), kind, date, from, through, rows, manual (groceries added by
  // hand, on one list only), total, open (not bought yet) }. now is null when a trip is today.
  const lists = () => A.remember("lists", () => {
    const today = todayStr(), end = A.planEnd();
    const trips = A.liveTrips().filter(t => t.date >= today && t.date <= end);
    const manual = A.live(S.manual).filter(m => !m.done || m.done >= today).sort(A.byAdded);
    const make = (kind, date, from, through) => ({ id: kind === "now" ? "now" : date, kind, date, from, through, rows: rowsFor(from, through), manual: [] });
    const out = trips.map((t, i) => make("trip", t.date, t.date, i + 1 < trips.length ? addDays(trips[i + 1].date, -1) : end));
    const now = trips.length && trips[0].date === today ? null : make("now", "", today, trips.length ? addDays(trips[0].date, -1) : end);
    const host = now && (now.rows.length || !out.length) ? now : out[0] || now;
    if (host) host.manual = manual;
    [now, ...out].filter(Boolean).forEach(l => {
      l.total = l.rows.length + l.manual.length;
      l.open = l.rows.filter(r => !r.ticked).length + l.manual.filter(m => !m.done).length;
    });
    return { now, trips: out };
  });
  const listById = id => { const { now, trips } = lists(); return id === "now" ? now : trips.find(l => l.id === id) || null; };

  // ==========================================================================
  // CHANGES
  // ==========================================================================

  // The cart on a day: a trip there, or none (two devices may have placed one each: both go).
  function toggleTrip(date) {
    if (!A.inPlan(date) || date < todayStr()) return;
    const t = Date.now();
    if (A.hasTrip(date)) S.trips = S.trips.map(x => (!x.deleted && x.date === date ? { id: x.id, deleted: true, at: x.at, u: t } : x));
    else S.trips.push(A.cleanTrips([{ id: newId(), date, at: t, u: t }])[0]);
    kept();
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
  function tick(key, on, listId) {
    const l = listById(listId);
    if (!l || !key.includes("|")) return;
    const today = todayStr(), was = (own(S.checked, key) ? S.checked[key].ranges : []).filter(([, b]) => b >= today);
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
    if (!SECTIONS.includes(section) || !norm || norm === "__proto__" || sectionOf(norm) === section) return;
    S.sections[norm] = { section, u: Date.now() };
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
        return alert(`A day's ${k === "kcal" ? "kcal" : `${k} (g)`}: from 1 to ${max}, or empty for no target.`);
      }
      targets[k] = v === null ? null : Math.round(v);
    }
    if (JSON.stringify(targets) === JSON.stringify(S.settings.targets)) return;
    S.settings = { targets, u: Date.now() };
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
    const what = A.fmtLine(row);
    return `<div class="g-row${row.ticked ? " ticked" : ""}" data-key="${esc(row.key)}"><label class="g-main">${box(`data-tick="${esc(row.key)}" data-list="${esc(l.id)}"`, row.ticked, what)}` +
      `<span class="g-text"><span class="g-what">${esc(what)}</span><span class="g-for">${esc(row.recipes.join(", "))}</span></span></label>${sectionPick(row)}</div>`;
  }
  const manualHTML = m => `<div class="g-row manual${m.done ? " ticked" : ""}"><label class="g-main">${box(`data-manual="${esc(m.id)}"`, !!m.done, m.text)}` +
    `<span class="g-text"><span class="g-what">${esc(m.text)}</span><span class="g-tag">added by hand</span></span></label>` +
    `<button type="button" class="icon-btn g-remove" data-act="manual-remove" data-id="${esc(m.id)}" aria-label="${esc(`Remove ${m.text}`)}">&times;</button></div>`;

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
    return `<section class="g-list" data-list="${esc(l.id)}"><div class="g-top"><h2 class="g-title">${esc(title)}</h2>` +
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
    NUTRIENTS.forEach(([k]) => { const el = $(TARGET_IDS[k]); if (document.activeElement !== el) el.value = S.settings.targets[k] === null ? "" : S.settings.targets[k]; });
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
    // Bought stays open or folded as left, through redraws.
    $("lists").addEventListener("toggle", e => {
      const d = e.target;
      if (d.matches && d.matches("details.g-bought")) S.boughtOpen[d.open ? "add" : "delete"](d.dataset.list);
    }, true);
    Object.values(TARGET_IDS).forEach(id => $(id).addEventListener("change", setTargets));
  }

  Object.assign(A, { lists, toggleTrip, removeManual, renderGroceries, revealList, wireGroceries });
})(Kyoshi, Kyoshi.apps.turtleduck);
