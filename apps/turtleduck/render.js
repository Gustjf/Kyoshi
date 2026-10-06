/* Turtleduck · render.js — what's on screen: one view at a time (showView) — Plan (plan-view.js), Recipes (recipes.js),
 * Groceries (groceries.js) or the cook view (cook.js, with the nav out of the way) — the nav under
 * the header, and the open pop-ups redrawn after a change (plan-popups.js). reveal(el) brings something into view with
 * core's flash. */
(function (K, A) {
  "use strict";
  const S = A.S, $ = A.$;
  const { todayStr } = K.util;
  const VIEWS = { plan: "planView", recipes: "recipesView", groceries: "groceriesView", cook: "cookView" };

  // Puts a view on screen: "plan", "recipes", "groceries", or "cook" while there's something to read (openCook).
  function showView(view) {
    if (view !== "cook") S.cooking = null;
    S.view = VIEWS[view] && (view !== "cook" || S.cooking) ? view : "plan";
    S.menu = false;
    renderAll();
    window.scrollTo(0, 0);
    K.wakeLock.check(); // the cook view keeps the screen on (A.awake)
  }

  function renderAll() {
    S.knownToday = todayStr();
    if (S.view === "cook" && !S.cooking) S.view = S.back && S.back !== "cook" ? S.back : "plan";
    Object.entries(VIEWS).forEach(([v, id]) => { $(id).hidden = v !== S.view; });
    A.root.classList.toggle("cooking", S.view === "cook");
    $("nav").querySelectorAll("button[data-view]").forEach(b => {
      b.classList.toggle("active", b.dataset.view === S.view);
      b.setAttribute("aria-pressed", String(b.dataset.view === S.view));
    });
    if (S.view === "plan") A.renderPlan();
    else if (S.view === "recipes") A.renderRecipes();
    else if (S.view === "groceries") A.renderGroceries();
    else A.renderCook();
    A.refreshPopups();
  }

  // Brings an element into view, with core's flash.
  function reveal(el) {
    if (!el) return;
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    el.classList.remove("flash");
    void el.offsetWidth; // so the flash starts again
    el.classList.add("flash");
  }

  Object.assign(A, { showView, renderAll, reveal });
})(Kyoshi, Kyoshi.apps.turtleduck);
