/* Turtleduck · recipes.js — the Recipes view and the recipe pop-up. The view: New recipe, Paste recipes… (paste.js) and
 * a search; the recipes by meal type, each row "Chili · 650 kcal · P 45 · 60 min · last cooked Sep 12 · 5×" (a
 * store-bought item's "store-bought · 3 on hand · … · last had Sep 12": or "runs out Sat Oct 3", or "0 on hand" in red;
 * tap: its pop-up; Cook (Read for a store-bought item): the cook view), Archived folded at the bottom. The pop-up
 * (#recipeOverlay): name, meal type, Cooked or Store-bought (with how many are on hand, if you track it), serves, prep
 * and cook minutes, kcal and macros per serving, ingredients (a line each, as the grocery list reads them; none: the list
 * has the recipe's name), steps (as you like), a link; Save (Enter in a field, Ctrl+Enter anywhere), Save & add another,
 * Cancel, Archive / Unarchive and Delete (planned meals keep its name). */
(function (K, A) {
  "use strict";
  const S = A.S, $ = A.$;
  const { esc, newId, todayStr, readNumber } = K.util;
  const { MAX_NAME, MAX_LINES, MAX_LINE, MAX_STEPS, MAX_LINK, MAX_SERVINGS, MAX_STOCK, MAX_MINUTES, MAX_KCAL, MAX_GRAMS, TYPES,
    cleanLine, cleanText, plural, sameName, fmtKcal, fmtG, fmtMinutes, fmtDay, fmtFull } = A;
  const overlay = () => $("recipeOverlay");
  const FIELDS = ["recipeName", "recipeStock", "recipeServings", "recipePrep", "recipeCook", "recipeKcal", "recipeProtein", "recipeCarbs", "recipeFat", "recipeFiber", "recipeLink", "recipeIngredients", "recipeSteps"];

  // ==========================================================================
  // THE RECIPES VIEW
  // ==========================================================================
  // "650 kcal · P 45 · 60 min · last cooked Sep 12 · 5×"; a store-bought item "store-bought · 3 on hand · 160 kcal · … ·
  // last had Sep 12 · 5×" (on hand after today's meals: "runs out Sat Oct 3" when the plan uses more later, "0 on hand"
  // in red once it has used more), as HTML.
  function metaHTML(r) {
    const last = A.lastCooked(r.id), times = A.cookedTimes(r.id), minutes = (r.prepMin || 0) + (r.cookMin || 0), hand = A.onHand(r), out = A.runsOut(r);
    const words = list => list.filter(Boolean).map(esc);
    const stock = hand === null ? [] : hand < 0 ? [`<span class="bad">0 on hand</span>`] : words([out ? `runs out ${fmtFull(out)}` : `${hand} on hand`]);
    return [...words([r.bought ? "store-bought" : ""]), ...stock, ...words([r.kcal !== null ? `${fmtKcal(r.kcal)} kcal` : "", r.protein !== null ? `P ${fmtG(r.protein)}` : "",
      minutes ? fmtMinutes(minutes) : "", last ? `last ${r.bought ? "had" : "cooked"} ${fmtDay(last)}` : "", times ? `${times}×` : ""])].join(" · ");
  }
  const rowHTML = r => `<div class="recipe-row"><button type="button" class="rr-main" data-act="recipe" data-id="${esc(r.id)}"><span class="rr-name">${esc(r.name)}</span>` +
    `<span class="rr-meta">${metaHTML(r)}</span></button><button type="button" class="more-link rr-cook" data-act="cook" data-id="${esc(r.id)}" aria-label="${esc(`${r.bought ? "Read" : "Cook"} ${r.name}`)}">${r.bought ? "Read" : "Cook"}</button></div>`;

  function renderRecipes() {
    const q = S.listSearch.trim().toLowerCase(), all = A.liveRecipes(), shown = all.filter(r => !r.archived && (!q || r.name.toLowerCase().includes(q)));
    const archived = all.filter(r => r.archived);
    $("recipesEmpty").hidden = shown.length > 0;
    $("recipesEmpty").textContent = all.length ? (q ? "No recipe called that." : "Every recipe is archived.") : "No recipes yet. Add one, or paste a batch of them at once, written out as the Paste pop-up shows.";
    $("recipeGroups").innerHTML = q ? shown.map(rowHTML).join("") : TYPES.map(([type, title]) => {
      const list = shown.filter(r => r.meal === type);
      return list.length ? `<div class="r-group"><h2>${title} <span class="count">${list.length}</span></h2>${list.map(rowHTML).join("")}</div>` : "";
    }).join("");
    $("archivedSection").hidden = !archived.length;
    $("archivedCount").textContent = `(${archived.length})`;
    $("archivedList").innerHTML = archived.map(rowHTML).join("");
  }

  // ==========================================================================
  // THE RECIPE POP-UP
  // ==========================================================================
  // What the pop-up holds, to tell whether closing it would lose something.
  const formState = () => JSON.stringify(FIELDS.map(id => $(id).value).concat(S.editing.meal, S.editing.bought));
  const num = v => (v === null ? "" : String(v));
  // The meal type and Cooked · Store-bought as picked; On hand with Store-bought only.
  function renderTypes() {
    const ed = S.editing, press = (b, on) => { b.classList.toggle("active", on); b.setAttribute("aria-pressed", String(on)); };
    $("recipeTypes").querySelectorAll("button").forEach(b => press(b, b.dataset.type === ed.meal));
    $("recipeMade").querySelectorAll("button").forEach(b => press(b, (b.dataset.made === "bought") === ed.bought));
    $("recipeStockBox").hidden = $("recipeStockHint").hidden = !ed.bought;
  }
  function fill(r) {
    $("recipeName").value = r ? r.name : "";
    // On hand: what's left before today's meals (as typed, the day it's typed), 0 once the plan has used more.
    $("recipeStock").value = r && A.stockStart(r) !== null ? Math.max(0, A.stockStart(r)) : "";
    if (S.editing) S.editing.stockTyped = false;
    $("recipeServings").value = r ? r.servings : "";
    $("recipePrep").value = r ? num(r.prepMin) : "";
    $("recipeCook").value = r ? num(r.cookMin) : "";
    [["recipeKcal", "kcal"], ["recipeProtein", "protein"], ["recipeCarbs", "carbs"], ["recipeFat", "fat"], ["recipeFiber", "fiber"]].forEach(([id, k]) => { $(id).value = r ? num(r[k]) : ""; });
    $("recipeLink").value = r ? r.link : "";
    $("recipeIngredients").value = r ? r.ingredients.join("\n") : "";
    $("recipeSteps").value = r ? r.steps : "";
  }

  // Opens the pop-up on a recipe, or (no id) a new one.
  function openRecipe(id) {
    const r = id ? A.recipeById(id) : null;
    if (id && !r) return;
    S.editing = { id: r ? r.id : "", meal: r ? r.meal : S.lastType || "any", bought: r ? r.bought : S.lastBought === true, stockTyped: false };
    $("recipeTitle").textContent = r ? "Recipe" : "New recipe";
    fill(r);
    renderTypes();
    const planned = r ? A.liveEntries().filter(e => e.kind === "recipe" && e.recipeId === r.id && e.date >= todayStr()).length : 0;
    const done = r && r.bought ? ["Had", "Not had yet"] : ["Cooked", "Not cooked yet"];
    const use = r ? [A.cookedTimes(r.id) ? `${done[0]} ${A.cookedTimes(r.id)}×, last ${fmtDay(A.lastCooked(r.id))}` : done[1], planned ? `planned ${plural(planned, "time")} from today` : "", r.archived ? "archived" : ""].filter(Boolean).join(" · ") : "";
    $("recipeUse").textContent = use;
    $("recipeUse").hidden = !use;
    $("recipeStatus").textContent = "";
    $("recipeAnotherBtn").hidden = !!r;
    $("recipeArchiveBtn").hidden = $("recipeDeleteBtn").hidden = !r;
    $("recipeArchiveBtn").textContent = r && r.archived ? "Unarchive" : "Archive";
    S.editing.snapshot = formState();
    K.modal.open(overlay());
    if (!r) $("recipeName").focus();
  }
  const closeRecipe = () => { K.modal.close(overlay()); S.editing = null; };

  // A number field: empty (null when it may be), or a number in range (whole when it must be); undefined after saying so.
  function field(id, what, min, max, { whole = false, empty = null } = {}) {
    const el = $(id), v = readNumber(el);
    if (v === null) return empty;
    if (!(v >= min && v <= max) || (whole && !Number.isInteger(v))) {
      el.focus();
      alert(`${what}: ${whole ? "a whole number " : ""}from ${min} to ${max}${empty === null ? ", or empty" : ""}.`);
      return undefined;
    }
    return v;
  }

  // Saves what's in the pop-up; close false (Save & add another) clears it for the next one instead.
  function saveRecipe(close = true) {
    const ed = S.editing;
    if (!ed) return;
    const r = ed.id ? A.recipeById(ed.id) : null;
    if (ed.id && !r) { closeRecipe(); A.renderAll(); return alert("That recipe was deleted on another device, so nothing was saved."); }
    const name = cleanLine($("recipeName").value, MAX_NAME);
    if (!name) { $("recipeName").focus(); return alert("Give the recipe a name."); }
    if (A.liveRecipes().some(x => x !== r && sameName(x.name, name))) { $("recipeName").focus(); return alert(`There's already a recipe called “${name}”.`); }
    const lines = $("recipeIngredients").value.split("\n").map(l => cleanLine(l, MAX_LINE)).filter(Boolean);
    if (lines.length > MAX_LINES) { $("recipeIngredients").focus(); return alert(`A recipe holds up to ${MAX_LINES} ingredient lines.`); }
    const nums = {
      servings: field("recipeServings", "Serves", 1, MAX_SERVINGS, { whole: true, empty: 1 }),
      prepMin: field("recipePrep", "Prep minutes", 0, MAX_MINUTES, { whole: true }), cookMin: field("recipeCook", "Cook minutes", 0, MAX_MINUTES, { whole: true }),
      kcal: field("recipeKcal", "Kcal per serving", 0, MAX_KCAL), protein: field("recipeProtein", "Quality protein per serving (g)", 0, MAX_GRAMS),
      carbs: field("recipeCarbs", "Carbs per serving (g)", 0, MAX_GRAMS), fat: field("recipeFat", "Fat per serving (g)", 0, MAX_GRAMS), fiber: field("recipeFiber", "Fiber per serving (g)", 0, MAX_GRAMS)
    };
    if (Object.values(nums).some(v => v === undefined)) return;
    // On hand (store-bought): typed or changed, counted from today; as it was (its day) when left alone; empty, not tracked.
    const count = ed.bought ? field("recipeStock", "On hand", 0, MAX_STOCK, { whole: true }) : null;
    if (count === undefined) return;
    const stock = count === null ? null : r && r.stock && (!ed.stockTyped || count === A.stockStart(r)) ? r.stock : { count, date: todayStr() };
    const fields = { name, meal: ed.meal, bought: ed.bought, stock, ingredients: lines, steps: cleanText($("recipeSteps").value, MAX_STEPS), link: cleanLine($("recipeLink").value, MAX_LINK), ...nums };
    const t = Date.now();
    if (r) {
      const next = A.cleanRecipes([{ ...r, ...fields }])[0];
      if (JSON.stringify(next) !== JSON.stringify(r)) { Object.assign(r, next, { u: t }); A.save(); }
    } else {
      S.recipes.push(A.cleanRecipes([{ id: newId(), ...fields, archived: false, at: t, u: t }])[0]);
      S.lastType = ed.meal;
      S.lastBought = ed.bought;
      A.save();
    }
    A.renderAll();
    if (close || r) return closeRecipe();
    // Save & add another: the same meal type, Cooked or Store-bought as picked, a clean form.
    fill(null);
    $("recipeStatus").textContent = `Added “${name}”.`;
    ed.snapshot = formState();
    $("recipeName").focus();
  }

  // Archived: off the sidebar and the picker (kept, with its history); back with Unarchive.
  function archiveRecipe() {
    const r = S.editing && A.recipeById(S.editing.id);
    if (!r) return;
    Object.assign(r, { archived: !r.archived, u: Date.now() });
    A.save();
    closeRecipe();
    A.renderAll();
  }

  // A deleted recipe stays as a marker (so sync can't bring it back); planned meals keep its name, and leave the lists.
  function deleteRecipe() {
    const r = S.editing && A.recipeById(S.editing.id);
    if (!r) return;
    const planned = A.liveEntries().filter(e => e.kind === "recipe" && e.recipeId === r.id);
    if (!confirm(`Delete “${r.name}”?${planned.length ? ` It's planned ${plural(planned.length, "time")}: those days keep its name.` : ""} This can't be undone.`)) return;
    const t = Date.now();
    planned.forEach(e => { if (e.name !== r.name) Object.assign(e, { name: r.name, u: t }); });
    S.recipes = S.recipes.map(x => (x === r ? { id: r.id, deleted: true, at: r.at, u: t } : x));
    A.save();
    closeRecipe();
    A.renderAll();
  }

  function wireRecipes() {
    // Esc, × and a click beside it ask first if something was changed (core/modal.js); Cancel doesn't.
    K.modal.define(overlay(), {
      dismiss: closeRecipe,
      pending: () => !!S.editing && formState() !== S.editing.snapshot,
      ask: "Discard your changes to this recipe?"
    });
    $("recipeForm").addEventListener("submit", e => { e.preventDefault(); saveRecipe(true); });
    // Ctrl+Enter (⌘+Enter) saves from anywhere in it, the steps and ingredients too.
    $("recipeForm").addEventListener("keydown", e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); saveRecipe(true); } });
    $("recipeTypes").addEventListener("click", e => { const b = e.target.closest("button[data-type]"); if (b && S.editing) { S.editing.meal = b.dataset.type; renderTypes(); } });
    $("recipeMade").addEventListener("click", e => { const b = e.target.closest("button[data-made]"); if (b && S.editing) { S.editing.bought = b.dataset.made === "bought"; renderTypes(); } });
    $("recipeStock").addEventListener("input", () => { if (S.editing) S.editing.stockTyped = true; });
    $("recipeAnotherBtn").addEventListener("click", () => saveRecipe(false));
    $("recipeCancelBtn").addEventListener("click", closeRecipe);
    $("recipeArchiveBtn").addEventListener("click", archiveRecipe);
    $("recipeDeleteBtn").addEventListener("click", deleteRecipe);
    $("newRecipeBtn").addEventListener("click", () => openRecipe(""));
    $("pasteBtn").addEventListener("click", A.openPaste);
    $("recipeSearch").addEventListener("input", () => { S.listSearch = $("recipeSearch").value; renderRecipes(); });
  }

  Object.assign(A, { renderRecipes, openRecipe, wireRecipes });
})(Kyoshi, Kyoshi.apps.turtleduck);
