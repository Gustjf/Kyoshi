/* Turtleduck · events.js — loads last: wires the page (A.init) — the pop-ups (plan-popups.js, recipes.js, paste.js), the
 * grocery list (groceries.js), dragging (drag.js), the nav and the plan's tabs and ⋯ menu, the buttons and chips drawn
 * into the page (data-act; Enter or Space on a chip opens it too), the searches, the plan's shape (a grid wider than
 * PLAN_PX, a list narrower), the mouse's place for Ctrl+C / X / V, and the first view (Groceries on a phone, Momo's
 * rule) — and the hooks Kyoshi calls: onShow, onHide, onTick (a new day), onReload (another tab saved; the cook view
 * stays), onKeydown (copy, cut and paste; Esc), awake (the cook view keeps the screen on: core/wakelock.js), attention
 * (a dot while this week isn't confirmed for Momo, from Friday while next week isn't, else while today or tomorrow has no
 * dinner planned) and bugState (counts only: never recipe names, ingredients or meals). */
(function (K, A) {
  "use strict";
  const S = A.S, $ = A.$;
  const { todayStr, addDays } = K.util;
  const { PLAN_PX, PHONE } = A;

  // Buttons and chips drawn into the page say what they do in data-act (and whose, in data-id or data-date).
  const ACTS = {
    cell: el => A.openPicker(el.dataset.date, el.dataset.meal), // a cell's empty space, or a phone's slot
    pick: el => A.openPicker(el.dataset.date, el.dataset.meal),
    entry: el => A.openEntry(el.dataset.id),
    remove: el => A.removeEntry(el.dataset.id),
    cart: el => A.toggleTrip(el.dataset.date),
    recipe: el => A.openRecipe(el.dataset.id),
    cook: el => A.openCook([{ recipeId: el.dataset.id, scale: 1 }]),
    "manual-remove": el => A.removeManual(el.dataset.id),
    "cook-back": () => A.closeCook(),
    "cook-prev": () => A.pageCook(-1),
    "cook-next": () => A.pageCook(1),
    "copy-last": () => { A.toggleMenu(false); A.copyLastWeek(); },
    "save-template": () => { A.toggleMenu(false); A.openTemplateName(); },
    "load-template": el => { A.toggleMenu(false); A.loadTemplate(el.dataset.id); },
    "delete-template": el => A.deleteTemplate(el.dataset.id),
    "clear-week": () => { A.toggleMenu(false); A.clearWeek(); },
    times: () => { A.toggleMenu(false); A.openTimes(); },
    "confirm-week": el => A.confirmWeek(el.dataset.week || S.week),
    "unconfirm-week": () => { A.toggleMenu(false); A.unconfirmWeek(S.week); },
    "trip-time-usual": el => A.setSlotTime(el.dataset.date, "trip", "")
  };

  A.init = () => {
    A.wirePopups();
    A.wireTimes();
    A.wireRecipes();
    A.wirePaste();
    A.wireGroceries();
    A.wireDrag();
    S.sideClosed = new Set();
    A.root.addEventListener("click", e => {
      const el = e.target.closest("[data-act]");
      if (el && A.root.contains(el) && ACTS[el.dataset.act]) ACTS[el.dataset.act](el);
    });
    // A chip (a div, so it can be dragged) opens on Enter or Space too.
    A.root.addEventListener("keydown", e => {
      const el = e.target;
      if ((e.key === "Enter" || e.key === " ") && el.matches && el.matches('[role="button"][data-act]')) { e.preventDefault(); el.click(); }
    });
    $("nav").addEventListener("click", e => { const b = e.target.closest("button[data-view]"); if (b) A.showView(b.dataset.view); });
    $("weekToggle").addEventListener("click", e => {
      const b = e.target.closest("button[data-week]");
      if (!b || b.dataset.week === S.week) return;
      S.week = b.dataset.week;
      A.renderPlan();
    });
    $("menuBtn").addEventListener("click", () => A.toggleMenu());
    A.listen(document, "pointerdown", e => { if (S.menu && !e.target.closest(".menu-wrap")) A.toggleMenu(false); });
    $("sideSearch").addEventListener("input", () => { S.search = $("sideSearch").value; A.renderSidebar(); });
    // The sidebar's groups stay open or folded as left, through redraws.
    $("sideRecipes").addEventListener("toggle", e => {
      const d = e.target;
      if (d.matches && d.matches("details.side-group")) S.sideClosed[d.open ? "delete" : "add"](d.dataset.type);
    }, true);
    // The plan is a grid on a computer, a list on a phone: redrawn when the window crosses PLAN_PX.
    A.listen(window.matchMedia(`(max-width: ${PLAN_PX}px)`), "change", () => { if (S.view === "plan") A.renderPlan(); });
    // Copy, cut and paste go by where the mouse is (none once it's left the window).
    A.listen(document, "pointermove", e => { if (e.pointerType === "mouse") S.mouse = { x: e.clientX, y: e.clientY }; });
    A.listen(document, "mouseout", e => { if (!e.relatedTarget) S.mouse = null; });
    // A phone opens on Groceries (its home); a computer on the plan.
    if (window.matchMedia(PHONE).matches) S.view = "groceries";
    A.renderAll();
  };

  A.onShow = () => A.renderAll();

  // Leaving for another app: nothing stays copied, dragged or open in the ⋯ menu.
  A.onHide = () => {
    A.clearClip();
    A.clearDrag();
    S.menu = false;
  };

  // Every minute, and when the page is back in view: a new day moves the plan's list, the trips, the shelf and the lists.
  A.onTick = () => {
    if (todayStr() === S.knownToday) return;
    A.clearClip();
    A.renderAll();
  };

  // Another tab saved (A.load has read it): show it (the cook view stays on what it's reading).
  A.onReload = () => A.renderAll();

  // Ctrl/⌘+C, X and V copy, cut and paste meals on the grid (outside text fields; the browser's own otherwise); Esc
  // closes the ⋯ menu, drops what's copied, or leaves the cook view. Kyoshi handles the rest of Esc (pop-ups).
  A.onKeydown = e => {
    const top = K.modal.top(A.root);
    if (e.key === "Escape") {
      if (top) return false;
      if (S.menu) A.toggleMenu(false);
      else if (S.clip) A.clearClip();
      else if (S.view === "cook") A.closeCook();
      else return false;
      return true;
    }
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable;
    const key = (e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && !typing && !top && S.view === "plan" && A.wide() ? e.key.toLowerCase() : "";
    if (key !== "c" && key !== "x" && key !== "v") return false;
    if (!(key === "v" ? A.pasteClip() : A.clipChip(key === "x"))) return false;
    e.preventDefault();
    return true;
  };

  // The screen stays on while a recipe is open in the cook view (core/wakelock.js; showView tells it).
  A.awake = () => S.view === "cook";

  // A dot on the icon while this week isn't confirmed for Momo, or from Friday on while next week isn't (confirm.js); else
  // while today or tomorrow has no dinner planned (anything in its slot counts, Skipped too); it clears once one is. Not
  // before Turtleduck is in use (a recipe or a planned meal).
  A.attention = () => {
    if (!A.liveRecipes().length && !A.liveEntries().length) return "";
    const week = A.unconfirmed();
    if (week) return `${week} week's meals aren't confirmed`;
    const today = todayStr(), none = [today, addDays(today, 1)].filter(d => !A.entriesOn(d, "dinner").length);
    return !none.length ? "" : `no dinner planned ${none.length === 2 ? "today or tomorrow" : none[0] === today ? "today" : "tomorrow"}`;
  };

  // Bug reports: counts and settings only — never recipe names, ingredients or meals.
  A.bugState = () => {
    const entries = A.liveEntries(), days = A.weekDates(A.thisMonday()), lists = A.lists(), recipes = A.liveRecipes();
    const kinds = ["recipe", "quick", "restaurant", "skipped"].map(k => `${k} ${entries.filter(e => e.kind === k).length}`).join(", ");
    return [
      `- Recipes: ${recipes.length} (${recipes.filter(r => r.archived).length} archived); store-bought ${recipes.filter(r => r.bought).length} (${recipes.filter(r => r.stock).length} counted on hand, ${recipes.filter(r => A.onHand(r) !== null && A.onHand(r) < 0).length} short); with no lines ${recipes.filter(r => !r.bought && !r.ingredients.length).length}; templates: ${A.liveTemplates().length}; deleted markers ${["recipes", "plan", "trips", "manual", "templates"].map(k => S[k].filter(x => x.deleted).length).join("/")}`,
      `- Planned: ${entries.length} (${kinds}; ${entries.filter(e => e.leftover).length} leftovers); this week ${entries.filter(e => e.date >= days[0] && e.date <= days[6]).length}; batches on the shelf ${A.shelf().length}`,
      `- Trips: ${A.liveTrips().length} (${lists.trips.length} upcoming, Now ${lists.now ? `${lists.now.open} open` : "none"}); ticks ${Object.keys(S.checked).length}; by hand ${A.live(S.manual).length}; sections set ${Object.keys(S.sections).length}; targets ${A.NUTRIENTS.filter(([k]) => S.settings.targets[k] !== null).length}`,
      `- View: ${S.view}${S.view === "plan" ? ` (${A.wide() ? `grid, ${S.week} week` : "list"})` : ""}; pop-ups: ${[S.editing && "recipe", S.picking && "picker", S.entry && "meal", S.paste && "paste", S.timesSnapshot && "times"].filter(Boolean).join(", ") || "none"}; copied: ${S.clip ? (S.clip.cut ? "cut" : "copy") : "no"}`,
      `- Times: trip schedule ${S.settings.schedule.length} day(s) (${A.liveTrips().filter(t => t.sched).length} scheduled trips shown); days' own times ${Object.values(S.slotTimes).filter(x => x.time).length} (${Object.keys(S.slotTimes).length} kept); skips ${Object.values(S.tripSkips).filter(x => x.skip).length}; confirmed: this week ${A.isConfirmed(A.thisMonday()) ? "yes" : "no"}, next ${A.isConfirmed(A.nextMonday()) ? "yes" : "no"} (${Object.values(S.confirmed).filter(x => x.at).length} kept); Momo has this week's slots: ${(A.momoStatus(A.thisMonday()) || { slots: [] }).slots.length}`
    ];
  };
})(Kyoshi, Kyoshi.apps.turtleduck);
