/* Turtleduck · plan-popups.js — the plan's two pop-ups. The picker (#pickOverlay, "Dinner, Mon Oct 5"): a search field,
 * then the shelf's portions that can go on that day (Leftovers), that meal's recipes, then the rest (most recently
 * cooked first, PAGE at a time with More; a bag: store-bought); tap one and it's placed. Below: a quick meal (its text and
 * own numbers), a restaurant (a name if you like) and Skip this meal. The Cook row takes recipes only (never a
 * store-bought item). Replace… opens it for a planned meal, which gives way to what's picked. The planned meal's pop-up
 * (#entryOverlay): that day's time for its breakfast, lunch, dinner or Cook row (kept once the field is left; Usual while
 * it differs: times.js setSlotTime), and for a meal cooked there (or store-bought) whether there's a trip before it, or
 * what wasn't bought on that trip's list; a batch's × (halves), the portions eaten there, the portions left (in red when
 * below zero, or when some were placed before the cook day) and Also on… (later days as chips: a tap puts one more
 * portion there, its − one fewer); a store-bought item's portions and how many are on hand after it (or that it isn't
 * tracked); a leftover's portions (in red when its batch ran out before it); a quick meal's or restaurant's text and
 * numbers. A batch never gives more portions than it yields: one more is refused, saying why (plan.js refused). Changes
 * count at once. Then Read (the cook view), Edit recipe, Replace… and Remove. And Save as template… (#templateOverlay): a
 * name for the week on screen's meals. */
(function (K, A) {
  "use strict";
  const S = A.S, $ = A.$;
  const { esc, addDays, readNumber, todayStr, fmtTime } = K.util;
  const { MEALS, NUTRIENTS, PAGE, MAX_QUICK, MAX_KCAL, MAX_GRAMS, MAX_SERVINGS, MIN_SCALE, MAX_SCALE, PHONE,
    cleanLine, plural, fmtKcal, fmtScale, fmtFull, fmtHead, fmtDay, fmtWd, mealTitle, onGrid } = A;
  const TIMED = ["breakfast", "lunch", "dinner", "cook"]; // the rows with a time of their own each day
  const pickOverlay = () => $("pickOverlay"), entryOverlay = () => $("entryOverlay");
  const NUM_IDS = { kcal: "Kcal", protein: "Protein", carbs: "Carbs", fat: "Fat", fiber: "Fiber" };

  // ==========================================================================
  // THE PICKER
  // ==========================================================================
  // Opens the picker for a cell (replace: a planned meal to give way to what's picked).
  function openPicker(date, meal, replace = "") {
    if (!A.inPlan(date) || A.mealIndex(meal) < 0) return;
    S.picking = { date, meal, replace, shown: PAGE, query: "" };
    const was = replace && A.entryById(replace);
    $("pickTitle").textContent = `${was ? `Replace ${A.nameOf(was)}: ` : ""}${mealTitle(meal)}, ${fmtFull(date)}`;
    $("pickSearch").value = "";
    $("pickOwn").hidden = meal === "cook";
    ["quick", "out"].forEach(f => { $(`${f}Text`).value = ""; NUTRIENTS.forEach(([k]) => { $(`${f}${NUM_IDS[k]}`).value = ""; }); });
    $("quickBox").open = $("outBox").open = false;
    renderPicker();
    K.modal.open(pickOverlay());
    if (!window.matchMedia(PHONE).matches) $("pickSearch").focus(); // a phone's keyboard would hide the list
  }
  const closePicker = () => { K.modal.close(pickOverlay()); S.picking = null; };

  // Most recently cooked first, then by name (the lists come by name).
  const recent = (a, b) => A.lastCooked(b.id).localeCompare(A.lastCooked(a.id));
  function renderPicker() {
    const p = S.picking;
    if (!p) return;
    const q = p.query.trim().toLowerCase(), has = name => !q || name.toLowerCase().includes(q);
    const shelf = p.meal === "cook" ? [] : A.shelf().filter(e => e.date <= p.date && e.id !== p.replace && has(A.nameOf(e)));
    const recipes = A.shownRecipes().filter(r => has(r.name) && !(p.meal === "cook" && r.bought)).sort(recent);
    const mine = q || p.meal === "cook" ? recipes : recipes.filter(r => r.meal === p.meal), rest = q || p.meal === "cook" ? [] : recipes.filter(r => r.meal !== p.meal);
    let left = p.shown;
    const recipeBtn = r => {
      const last = A.lastCooked(r.id), meta = [r.kcal !== null ? `${fmtKcal(r.kcal)} kcal` : "", last ? `last ${fmtDay(last)}` : ""].filter(Boolean).join(" · ");
      return `<button type="button" class="pick-item" data-pick="recipe" data-id="${esc(r.id)}">${r.bought ? A.ICONS.bought : ""}<span class="pi-name">${esc(r.name)}</span>${meta ? `<span class="pi-meta">${esc(meta)}</span>` : ""}</button>`;
    };
    const group = (title, list) => {
      const shown = list.slice(0, Math.max(0, left));
      left -= shown.length;
      return shown.length ? `<div class="pick-head">${esc(title)}</div>${shown.map(recipeBtn).join("")}` : "";
    };
    const out = [];
    if (shelf.length) out.push(`<div class="pick-head">Leftovers</div>` + shelf.map(e => `<button type="button" class="pick-item portion" data-pick="portion" data-id="${esc(e.id)}">` +
      `${A.ICONS.leftover}<span class="pi-name">${esc(A.nameOf(e))}</span><span class="pi-meta">${esc(`${A.portionsLeft(e)} left · cooked ${fmtWd(e.date)}`)}</span></button>`).join(""));
    out.push(group(q ? "Recipes" : p.meal === "cook" ? "Recipes to cook" : `${mealTitle(p.meal)} recipes`, mine), group("Other recipes", rest));
    $("pickList").innerHTML = out.join("") || `<div class="empty-msg">${A.shownRecipes().length ? "No recipe called that." : "No recipes yet: add some in Recipes."}</div>`;
    const total = mine.length + rest.length;
    $("pickMore").hidden = total <= p.shown;
    $("pickMore").textContent = `Show ${Math.min(PAGE, total - p.shown)} more`;
  }

  // Whether the cell can take one more (the meal being replaced gives way), saying why not and closing if it can't.
  function roomFor(p) {
    const why = !A.inPlan(p.date) ? "That day isn't on the plan any more." : A.entriesOn(p.date, p.meal).filter(e => e.id !== p.replace).length >= A.MAX_CHIPS
      ? `That ${mealTitle(p.meal).toLowerCase()} is full: a cell holds up to ${A.MAX_CHIPS}.` : "";
    if (!why) return true;
    closePicker();
    A.renderAll();
    alert(why);
    return false;
  }
  // What's picked goes in, a planned meal being replaced giving way. Checked before anything changes.
  function pick(what, id) {
    const p = S.picking;
    if (!p) return;
    const c = what === "portion" && A.entryById(id), r = what === "recipe" && A.recipeById(id);
    const ok = what === "recipe" ? !!r && !(p.meal === "cook" && r.bought) : !!c && A.isCooked(c) && !A.isBought(c) && p.meal !== "cook" && p.date >= c.date;
    if (!ok || (c && A.refused(c))) return renderPicker(); // a batch with none left (placed on another device) says so
    if (!roomFor(p)) return;
    if (p.replace) A.dropEntry(p.replace);
    if (what === "recipe") A.addRecipe(id, p.date, p.meal);
    else A.addPortion(id, p.date, p.meal);
    closePicker();
  }

  // A meal's own numbers from its fields ("" for none), or null after saying what's wrong.
  function readNums(prefix) {
    const out = {};
    for (const [k] of NUTRIENTS) {
      const el = $(`${prefix}${NUM_IDS[k]}`), v = readNumber(el), max = k === "kcal" ? MAX_KCAL : MAX_GRAMS;
      if (v !== null && !(v >= 0 && v <= max)) { el.focus(); alert(`${k === "kcal" ? "kcal" : k === "protein" ? "Quality protein (g)" : `${A.cap(k)} (g)`}: from 0 to ${max}, or empty.`); return null; }
      out[k] = v;
    }
    return out;
  }
  // A quick meal (its text needed) or a restaurant (a name if you like), with their own numbers.
  function addOwn(kind) {
    const p = S.picking, f = kind === "quick" ? "quick" : "out";
    if (!p) return;
    const name = cleanLine($(`${f}Text`).value, MAX_QUICK), nums = readNums(f);
    if (kind === "quick" && !name) { $("quickText").focus(); return alert("Say what the quick meal is, like “Shake”."); }
    if (!nums || !roomFor(p)) return;
    if (p.replace) A.dropEntry(p.replace);
    A.addOwn(kind, p.date, p.meal, { name, ...nums });
    closePicker();
  }
  function skip() {
    const p = S.picking;
    if (!p || !roomFor(p)) return;
    if (p.replace) A.dropEntry(p.replace);
    A.addOwn("skipped", p.date, p.meal);
    closePicker();
  }

  // ==========================================================================
  // A PLANNED MEAL'S POP-UP: changes count at once
  // ==========================================================================
  function openEntry(id) {
    const e = A.entryById(id);
    if (!e) return;
    S.entry = { id: e.id, alsoMeal: e.meal === "cook" ? defaultMeal(e) : e.meal };
    renderEntry();
    K.modal.open(entryOverlay());
  }
  const closeEntry = () => { K.modal.close(entryOverlay()); S.entry = null; };
  // A batch on the Cook row puts its portions on its recipe's meal by default (dinner for "any").
  const defaultMeal = e => { const r = A.recipeById(e.recipeId); return r && r.meal !== "any" ? r.meal : "dinner"; };

  // label − value + (shown: the value as words, "1½"; readonly: just the value).
  const stepper = (field, label, value, min, max, { readonly = false, shown = String(value) } = {}) => `<div class="entry-step"><span class="es-label">${esc(label)}</span>` +
    (readonly ? `<span class="es-val">${esc(shown)}</span>` : `<button type="button" class="icon-btn" data-entry="${field}" data-dir="-1" aria-label="${esc(`${label}: less`)}"${value <= min ? " disabled" : ""}>&minus;</button>` +
      `<span class="es-val" id="entry_${field}">${esc(shown)}</span>` +
      `<button type="button" class="icon-btn" data-entry="${field}" data-dir="1" aria-label="${esc(`${label}: more`)}"${value >= max ? " disabled" : ""}>+</button>`) + `</div>`;

  // Also on…: the later days to the end of the plan (a batch on the Cook row: from its own day, on a meal picked here),
  // each ticked while a portion of it is there (×2: two portions there, its leftovers' portions added up); tapping one
  // puts one more portion there, its − takes one off.
  function alsoHTML(e) {
    const meal = S.entry.alsoMeal, from = e.meal === "cook" ? e.date : addDays(e.date, 1), days = [];
    for (let d = from < A.thisMonday() ? A.thisMonday() : from; d <= A.planEnd(); d = addDays(d, 1)) days.push(d);
    if (!days.length) return "";
    const here = A.leftoversOf(e.id);
    const meals = e.meal === "cook" ? `<div class="mode-toggle many also-meals" role="group" aria-label="On which meal">${MEALS.filter(([m]) => m !== "cook").map(([m, title]) =>
      `<button type="button" class="mode-btn${m === meal ? " active" : ""}" data-entry="also-meal" data-meal="${m}" aria-pressed="${m === meal}">${title}</button>`).join("")}</div>` : "";
    return `<div class="subhead">Also on&hellip; <span class="also-hint">(${mealTitle(meal).toLowerCase()}; tap a day for a portion, again for one more)</span></div>${meals}<div class="also-days">` + days.map(d => {
      const n = here.filter(x => x.date === d && x.meal === meal).reduce((s, x) => s + x.servings, 0);
      return `<span class="also-day"><button type="button" class="pill also${n ? " active" : ""}" data-entry="also" data-date="${d}" aria-pressed="${!!n}">${esc(fmtHead(d))}${n > 1 ? ` &times;${n}` : ""}</button>` +
        (n ? `<button type="button" class="pill also-less" data-entry="also-less" data-date="${d}" aria-label="${esc(`One portion fewer on ${fmtWd(d)}`)}" title="One portion fewer">&minus;</button>` : "") + `</span>`;
    }).join("") + `</div>`;
  }

  // That day's time for the meal's row (the same for everything in it), and Usual while it's a time of its own.
  function timeHTML(e) {
    if (e.kind === "skipped" || !TIMED.includes(e.meal)) return "";
    const kind = e.meal, mine = A.isOwnTime(e.date, kind);
    return `<div class="entry-step entry-time"><label class="es-label" for="entryTime">${kind === "cook" ? "Cooking at" : `${mealTitle(kind)} at`}</label>` +
      `<input type="time" id="entryTime" step="900" data-own="time" data-slot-time="${kind}" value="${esc(A.slotTime(e.date, kind))}">` +
      (mine ? `<button type="button" class="secondary small" data-entry="time-usual">Usual (${esc(fmtTime(A.usualTime(kind)))})</button>` : "") + `</div>`;
  }
  // A meal cooked there, from today on: no trip before it (amber), or its trip is past with things not bought (red).
  function coverHTML(e) {
    const c = e.date >= todayStr() ? A.coverageOf(e) : null;
    if (!c || c.state === "ok") return "";
    return c.state === "none" ? `<p class="entry-cover none">No trip before this: tap the cart on a day before it.</p>`
      : `<p class="entry-cover unbought">${esc(`${plural(c.missing, "item")} not bought since the trip on ${fmtWd(c.trip.date)} ${fmtDay(c.trip.date)}: they're on Groceries' first list.`)}</p>`;
  }

  const bodyHTML = e => timeHTML(e) + coverHTML(e) + mealHTML(e);
  // A store-bought item's stock after it: what's left on hand, or that it runs out first (its groceries say the rest).
  function stockWords(e, r) {
    const after = A.stockAfter(e);
    return !r.stock ? "on hand not tracked" : after === null ? "" : after >= 0 ? `${after} on hand after this` : "on hand runs out before this";
  }
  function mealHTML(e) {
    const r = e.kind === "recipe" ? A.recipeById(e.recipeId) : null, gone = e.kind === "recipe" && !r ? `<p class="entry-note bad">This recipe was deleted: its name stays here.</p>` : "";
    if (A.isBought(e)) return `<p class="entry-line">${esc(["Store-bought", stockWords(e, r)].filter(Boolean).join(" · "))}</p>` + stepper("servings", "Portions", e.servings, 1, MAX_SERVINGS);
    if (A.isCooked(e)) {
      const left = A.portionsLeft(e), placed = A.leftoversOf(e.id), early = placed.filter(x => x.date < e.date).length;
      const leftLine = !r ? "" : left < 0 ? `<p class="entry-left bad">${esc(`Placed ${plural(placed.reduce((n, x) => n + x.servings, 0) + e.servings, "portion")} of ${A.yieldOf(e)}: ${left} left`)}</p>`
        : `<p class="entry-left">${esc(left ? `${plural(left, "portion")} left` : "No portions left")}</p>`;
      return gone + `<p class="entry-line">${esc(e.meal === "cook" ? "Cooked here for other days" : "Cooked here")}${r ? ` · serves ${r.servings} at ×1` : ""}</p>` +
        (r ? stepper("scale", "Batch ×", e.scale, MIN_SCALE, MAX_SCALE, { shown: fmtScale(e.scale) }) : "") +
        stepper("servings", "Portions eaten here", e.servings, 1, MAX_SERVINGS, { readonly: e.meal === "cook" }) + leftLine +
        (early ? `<p class="entry-left bad">${esc(`${plural(early, "portion")} placed before the cook day: move ${early === 1 ? "it" : "them"}, or this.`)}</p>` : "") +
        (r ? alsoHTML(e) : "");
    }
    if (e.kind === "recipe") {
      const from = A.entryById(e.from), placed = from ? A.yieldOf(from) - A.portionsLeft(from) : 0;
      return gone + `<p class="entry-line">${esc(from ? `Leftover of ${fmtWd(from.date)}'s ${A.nameOf(from)}` : "Leftover (its batch is off the plan)")}</p>` +
        (from && e.date < from.date ? `<p class="entry-left bad">This is before the day it's cooked.</p>` : "") +
        (A.shortPortions().has(e.id) ? `<p class="entry-left bad">${esc(`The batch ran out before this day: ${plural(placed, "portion")} placed of ${A.yieldOf(from)}.`)}</p>` : "") +
        stepper("servings", "Portions", e.servings, 1, MAX_SERVINGS);
    }
    if (e.kind === "skipped") return `<p class="entry-line">Skipped: nothing counted, and nothing for Momo.</p>`;
    const num = (k, label) => `<label class="own-num"><span>${label}</span><input type="number" data-own="${k}" min="0" max="${k === "kcal" ? MAX_KCAL : MAX_GRAMS}" step="any" inputmode="decimal" value="${e[k] === null ? "" : e[k]}"></label>`;
    return `<p class="entry-line">${e.kind === "quick" ? "Quick meal" : "Restaurant"}: its own numbers, for the whole meal.</p>` +
      `<div class="field"><label for="entryText">${e.kind === "quick" ? "What" : "Where (optional)"}</label><input type="text" id="entryText" data-own="name" maxlength="${MAX_QUICK}" value="${esc(e.name)}"></div>` +
      `<div class="own-nums">${num("kcal", "kcal")}${num("protein", "Quality protein")}${num("carbs", "Carbs")}${num("fat", "Fat")}${num("fiber", "Fiber")}</div>`;
  }

  function renderEntry() {
    const e = S.entry && A.entryById(S.entry.id);
    if (!e) return S.entry && closeEntry();
    const r = e.kind === "recipe" ? A.recipeById(e.recipeId) : null;
    $("entryTitle").textContent = A.nameOf(e);
    $("entryWhere").textContent = `${mealTitle(e.meal)}, ${fmtFull(e.date)}`;
    // Typing in a field stays put while the rest redraws.
    const typing = document.activeElement && entryOverlay().contains(document.activeElement) && document.activeElement.dataset.own;
    if (!typing) $("entryBody").innerHTML = bodyHTML(e);
    entryOverlay().querySelector('[data-entry="read"]').hidden = !r;
    entryOverlay().querySelector('[data-entry="edit"]').hidden = !r;
  }

  // The pop-up's buttons: steppers, Also on…, Read, Edit recipe, Replace…, Remove.
  function onEntryClick(ev) {
    const b = ev.target.closest("[data-entry]"), e = S.entry && A.entryById(S.entry.id);
    if (!b || !e) return;
    const act = b.dataset.entry, dir = +b.dataset.dir;
    if (act === "scale") A.updateEntry(e.id, { scale: Math.min(MAX_SCALE, Math.max(MIN_SCALE, e.scale + dir / 2)) });
    else if (act === "servings") { if (dir < 0 || !A.refused(e.leftover ? A.entryById(e.from) : e)) A.updateEntry(e.id, { servings: Math.min(MAX_SERVINGS, Math.max(1, e.servings + dir)) }); }
    else if (act === "also") A.alsoOn(e.id, b.dataset.date, S.entry.alsoMeal, 1);
    else if (act === "also-less") A.alsoOn(e.id, b.dataset.date, S.entry.alsoMeal, -1);
    else if (act === "also-meal") { S.entry.alsoMeal = b.dataset.meal; renderEntry(); }
    else if (act === "read") { closeEntry(); A.openCook([{ recipeId: e.recipeId, scale: e.leftover ? 1 : e.scale, name: A.nameOf(e) }]); }
    else if (act === "edit") { closeEntry(); A.openRecipe(e.recipeId); }
    else if (act === "replace") { closeEntry(); openPicker(e.date, e.meal, e.id); }
    else if (act === "remove") { closeEntry(); A.removeEntry(e.id); }
    else if (act === "time-usual") A.setSlotTime(e.date, e.meal, "");
  }
  // A quick meal's or restaurant's text and numbers, kept as each field is left.
  function onEntryChange(ev) {
    const el = ev.target, e = S.entry && A.entryById(S.entry.id), k = el.dataset.own;
    if (!e || !k || k === "time") return; // the time is kept once its field is left (setEntryTime)
    if (k === "name") return void A.updateEntry(e.id, { name: cleanLine(el.value, MAX_QUICK) || (e.kind === "quick" ? e.name : "") });
    const v = readNumber(el), max = k === "kcal" ? MAX_KCAL : MAX_GRAMS;
    if (v !== null && !(v >= 0 && v <= max)) { el.value = e[k] === null ? "" : e[k]; return alert(`From 0 to ${max}, or empty.`); }
    A.updateEntry(e.id, { [k]: v });
  }
  // The day's time for the meal's row, once its field is left (a time field reports each digit typed as a change): on
  // the 15-minute grid, else it's put back as it was.
  function setEntryTime(el) {
    const e = S.entry && A.entryById(S.entry.id), kind = el.dataset.slotTime;
    if (!e || el.value === A.slotTime(e.date, kind)) return;
    if (el.validity.badInput || !onGrid(el.value)) {
      el.value = A.slotTime(e.date, kind);
      return alert("Times go in 15-minute steps (:00, :15, :30 or :45), as in Momo.");
    }
    A.setSlotTime(e.date, kind, el.value);
  }

  // ==========================================================================
  // SAVE AS TEMPLATE… (#templateOverlay): the week on screen's meals, by weekday, under a name (the ⋯ menu loads it)
  // ==========================================================================
  const tplOverlay = () => $("templateOverlay");
  function openTemplateName() {
    $("templateName").value = "";
    $("templateStatus").textContent = "";
    $("templateWeek").textContent = S.week === "next" ? "Next week's" : "This week's";
    K.modal.open(tplOverlay());
    $("templateName").focus();
  }
  function saveTemplateName() {
    const why = A.saveTemplate($("templateName").value);
    if (why === "cancelled") return;
    if (why) { $("templateStatus").textContent = why; return $("templateName").focus(); }
    K.modal.close(tplOverlay());
  }

  // Both, redrawn after a change (here, or from another tab).
  function refreshPopups() {
    if (S.picking && K.modal.isOpen(pickOverlay())) renderPicker();
    if (S.entry && K.modal.isOpen(entryOverlay())) renderEntry();
  }

  function wirePopups() {
    K.modal.define(pickOverlay(), { dismiss: closePicker });
    K.modal.define(entryOverlay(), { dismiss: closeEntry });
    $("pickSearch").addEventListener("input", () => { if (S.picking) { S.picking.query = $("pickSearch").value; S.picking.shown = PAGE; renderPicker(); } });
    $("pickList").addEventListener("click", ev => { const b = ev.target.closest("[data-pick]"); if (b) pick(b.dataset.pick, b.dataset.id); });
    $("pickMore").addEventListener("click", () => { if (S.picking) { S.picking.shown += PAGE; renderPicker(); } });
    $("quickForm").addEventListener("submit", ev => { ev.preventDefault(); addOwn("quick"); });
    $("outForm").addEventListener("submit", ev => { ev.preventDefault(); addOwn("restaurant"); });
    $("skipBtn").addEventListener("click", skip);
    $("entryOverlay").addEventListener("click", onEntryClick);
    $("entryBody").addEventListener("change", onEntryChange);
    $("entryBody").addEventListener("focusout", ev => { if (ev.target.dataset && ev.target.dataset.own === "time") setEntryTime(ev.target); });
    $("entryBody").addEventListener("keydown", ev => { if (ev.key === "Enter" && ev.target.dataset && ev.target.dataset.own === "time") { ev.preventDefault(); ev.target.blur(); } });
    $("entryDoneBtn").addEventListener("click", closeEntry);
    K.modal.define(tplOverlay(), { pending: () => !!$("templateName").value.trim(), ask: "Discard the template's name?" });
    $("templateForm").addEventListener("submit", ev => { ev.preventDefault(); saveTemplateName(); });
    $("templateCancelBtn").addEventListener("click", () => K.modal.close(tplOverlay()));
  }

  Object.assign(A, { openPicker, openEntry, openTemplateName, refreshPopups, wirePopups });
})(Kyoshi, Kyoshi.apps.turtleduck);
