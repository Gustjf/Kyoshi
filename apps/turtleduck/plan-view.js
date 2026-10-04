/* Turtleduck · plan-view.js — draws the Plan view. On a computer (wider than PLAN_PX): the tabs This week · Next week
 * (each with its dates, week average and whether it's confirmed for Momo), the week on screen's Confirm and its line
 * about Momo (confirm.js), and the ⋯ menu; the grid, a column a day Mon–Sun (its date, today marked, past days dimmed,
 * the cart toggle for a shopping trip with its time, its totals under it) and a row a meal (Breakfast, Lunch, Dinner,
 * Snack, Cook), each cell holding its meals as chips (a pot: cooked there; ↩ a leftover; a fork: a restaurant; Skipped;
 * a cooked one amber with no trip before it, red with things not bought once its trip is past) with + to add; the
 * week's average; and the sidebar: search, the shelf (Leftovers: portions of a batch waiting to be placed) and the
 * recipes by meal type, all draggable (drag.js). On a phone: the days from today to next Sunday as a list, each week
 * headed by its line about Momo and Confirm, each day with its cart, totals and meals (the Cook row only when it has
 * something). Tapping a cell's + (or the cell) opens the picker, tapping a chip its pop-up (plan-popups.js). */
(function (K, A) {
  "use strict";
  const S = A.S, $ = A.$;
  const { esc, addDays, todayStr, fmtTime } = K.util;
  const { MEALS, TYPES, NUTRIENTS, PLAN_PX, plural, fmtKcal, fmtG, fmtScale, fmtHead, fmtFull, fmtRange, fmtMacros, isConfirmed } = A;
  const wide = () => !window.matchMedia(`(max-width: ${PLAN_PX}px)`).matches;

  // Icons from Lucide (ISC license): cooking-pot (cooked there), undo-2 (a leftover), utensils (a restaurant),
  // shopping-cart (a trip), plus, ellipsis.
  const svg = (d, cls = "") => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const ICONS = {
    cooked: svg('<path d="M2 12h20"/><path d="M20 12v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8"/><path d="m4 8 16-4"/><path d="m8.86 6.78-.45-1.81a2 2 0 0 1 1.45-2.43l1.94-.48a2 2 0 0 1 2.43 1.46l.45 1.8"/>', "glyph"),
    leftover: svg('<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11"/>', "glyph"),
    restaurant: svg('<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/>', "glyph"),
    cart: svg('<path d="m2.05 2.05 1.099-.028a1 1 0 0 1 1.008.815l2.69 14.347A1 1 0 0 0 7.83 18H18"/><path d="M4.563 5h16.435a1 1 0 0 1 .981 1.204l-1.026 6.226A2 2 0 0 1 18.962 14H6.25"/><circle cx="18" cy="20" r="2"/><circle cx="8" cy="20" r="2"/>'),
    plus: svg('<path d="M5 12h14"/><path d="M12 5v14"/>'),
    more: svg('<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>')
  };

  // ==========================================================================
  // PIECES
  // ==========================================================================
  // A planned meal's chip: its glyph, name and "650 · P 45" (a batch on the Cook row: its × and portions), and for a
  // meal cooked there its groceries (groceries.js coverageOf): amber with no trip before it, red with things not bought
  // once its trip is past (from today on: a day gone by was shopped for or not). Draggable on a computer; the × takes it
  // off (mouse only: its pop-up has Remove).
  function chipHTML(e, drag = wide()) {
    const kind = e.kind === "recipe" ? (e.leftover ? "leftover" : "cooked") : e.kind, name = A.nameOf(e), cov = e.date >= todayStr() ? A.coverageOf(e) : null;
    const t = A.addUp([e]), meta = e.meal === "cook" ? `×${fmtScale(e.scale)} · ${plural(A.yieldOf(e), "portion")}`
      : e.kind === "skipped" ? "" : [t.kcal !== null ? fmtKcal(t.kcal) : "?", t.protein !== null ? `P ${fmtG(t.protein)}` : ""].filter(Boolean).join(" · ");
    const warn = (A.isCooked(e) && A.leftoversOf(e.id).some(x => x.date < e.date)) || (e.leftover && A.entryById(e.from) && e.date < A.entryById(e.from).date);
    const words = { cooked: e.meal === "cook" ? "cooked for later" : "cooked here", leftover: "leftover", quick: "quick meal", restaurant: "restaurant", skipped: "" }[kind];
    const shop = !cov ? "" : cov.state === "none" ? "no trip before this" : cov.state === "unbought" ? `${cov.missing} not bought` : "";
    const mark = !cov || cov.state === "ok" ? "" : cov.state === "none" ? " nocover" : " unbought";
    return `<div class="chip ${kind}${warn ? " warn" : ""}${mark}" draggable="${drag}" data-drag="entry" data-act="entry" data-id="${esc(e.id)}" role="button" tabindex="0" ` +
      `aria-label="${esc([name, words, meta, shop].filter(Boolean).join(", "))}">` +
      `<span class="chip-name">${ICONS[kind] || ""}${esc(name)}</span>${meta ? `<span class="chip-meta">${esc(meta)}</span>` : ""}${shop ? `<span class="chip-shop">${esc(shop)}</span>` : ""}` +
      `<span class="chip-x" data-act="remove" data-id="${esc(e.id)}" title="Remove" aria-hidden="true">&times;</span></div>`;
  }

  // The cart on a day: filled when there's a trip (the schedule's, or placed by hand), with its time; past days can't
  // have one placed.
  const cartHTML = (date, today) => {
    const trip = A.liveTrips().find(t => t.date === date), time = trip ? fmtTime(A.tripTime(trip)) : "";
    const label = trip ? `Shopping trip on ${fmtFull(date)} at ${time}${trip.sched ? " (every week): tap to skip it" : ""}` : `Place a shopping trip on ${fmtFull(date)}`;
    return `<button type="button" class="cart${trip ? " on" : ""}" data-act="cart" data-date="${date}" aria-pressed="${!!trip}" aria-label="${esc(label)}" title="${esc(label)}"${date < today ? " disabled" : ""}>${ICONS.cart}` +
      (trip ? `<span class="cart-time">${esc(time)}</span>` : "") + `</button>`;
  };

  // A week's line about Momo and its Confirm (which: "this" | "next"), for the plan bar or a phone's list.
  function weekHeadHTML(which) {
    const monday = A.mondayFor(which), line = A.statusLine(monday), on = isConfirmed(monday);
    return `<div class="week-head${on ? " on" : ""}"><span class="week-status">${esc(line)}</span>` +
      (on ? "" : `<button type="button" class="confirm-btn" data-act="confirm-week" data-week="${which}">Confirm ${which} week</button>`) + `</div>`;
  }

  // A day's totals: "1,850 kcal" then "P 120 · C 180 · F 60 · Fi 28", "?" when a meal has no kcal, past a target marked.
  function totalsHTML(date, long = false) {
    const t = A.dayTotals(date);
    if (!t.count) return "";
    const past = A.pastTarget(t), part = (k, text) => `<span class="${past.has(k) ? "warn" : ""}">${text}</span>`;
    const kcal = t.kcal !== null ? part("kcal", `${fmtKcal(t.kcal)}${t.unknown ? "?" : ""} kcal`) : `<span>? kcal</span>`;
    const rest = NUTRIENTS.slice(1).filter(([k]) => t[k] !== null).map(([k, short]) => part(k, `${short} ${fmtG(t[k])}`)).join(" · ");
    return long ? `${kcal}${rest ? ` · ${rest}` : ""}` : `<div class="tot-kcal">${kcal}</div>${rest ? `<div class="tot-rest">${rest}</div>` : ""}`;
  }

  // ==========================================================================
  // THE GRID (a computer)
  // ==========================================================================
  function renderTabs() {
    [["this", A.thisMonday()], ["next", A.nextMonday()]].forEach(([w, monday]) => {
      const avg = A.weekAverage(monday);
      $(`weekSub_${w}`).textContent = `${fmtRange(monday, addDays(monday, 6))}${avg && avg.kcal !== null ? ` · avg ${fmtKcal(avg.kcal)} kcal` : ""} · ${isConfirmed(monday) ? "confirmed ✓" : "not confirmed"}`;
      const b = $("weekToggle").querySelector(`[data-week="${w}"]`);
      b.classList.toggle("active", S.week === w);
      b.setAttribute("aria-pressed", String(S.week === w));
    });
    // The week on screen: Confirm while it isn't, and where it stands with Momo.
    const monday = A.shownMonday(), on = isConfirmed(monday);
    $("confirmBtn").hidden = on;
    $("confirmBtn").dataset.week = S.week;
    $("confirmBtn").textContent = `Confirm ${S.week === "next" ? "next" : "this"} week`;
    $("momoLine").textContent = A.statusLine(monday);
    $("momoLine").classList.toggle("on", on);
  }

  function renderGrid(today) {
    const days = A.weekDates(A.shownMonday());
    const head = `<div class="corner"></div>` + days.map(d => `<div class="day-head${d === today ? " today" : ""}${d < today ? " past" : ""}"><span class="dh-name">${esc(fmtHead(d))}</span>${cartHTML(d, today)}</div>`).join("");
    const rows = MEALS.map(([meal, title]) => `<div class="row-head${meal === "cook" ? " cook" : ""}">${title}</div>` + days.map(d => {
      const list = A.entriesOn(d, meal), label = `${title}, ${fmtFull(d)}`;
      return `<div class="cell${list.length ? "" : " empty"}${d < today ? " past" : ""}${meal === "cook" ? " cook" : ""}" data-act="cell" data-date="${d}" data-meal="${meal}">` +
        list.map(e => chipHTML(e, true)).join("") + `<button type="button" class="cell-add" data-act="pick" data-date="${d}" data-meal="${meal}" aria-label="${esc(`Add to ${label}`)}" title="${esc(`Add to ${label}`)}">${ICONS.plus}</button></div>`;
    }).join("")).join("");
    const totals = `<div class="row-head tot-head">Totals</div>` + days.map(d => `<div class="tot${d < today ? " past" : ""}">${totalsHTML(d)}</div>`).join("");
    $("planGrid").innerHTML = head + rows + totals;
    const avg = A.weekAverage(days[0]);
    $("weekAvg").innerHTML = avg ? `Week average (${plural(avg.count, "day")} planned): ${esc(fmtMacros(avg)) || "?"}${avg.unknown ? " · some meals not counted" : ""}` : "";
  }

  // The sidebar: search, the shelf (portions to place), the recipes by meal type (each group folds; a search shows the
  // matches in one list). Archived recipes aren't here.
  function renderSidebar() {
    const q = S.search.trim().toLowerCase(), shelf = A.shelf();
    $("sideShelf").innerHTML = shelf.length ? `<h2>Leftovers</h2><div class="side-chips">${shelf.map(e => {
      const n = A.portionsLeft(e), text = `${A.nameOf(e)} · ${n} left · ${A.fmtWd(e.date)}`;
      return `<div class="chip shelf" draggable="true" data-drag="portion" data-act="entry" data-id="${esc(e.id)}" role="button" tabindex="0" title="Drag onto a later day" aria-label="${esc(`${text}: open its batch`)}"><span class="chip-name">${ICONS.leftover}${esc(text)}</span></div>`;
    }).join("")}</div>` : "";
    const recipes = A.shownRecipes().filter(r => !q || r.name.toLowerCase().includes(q));
    const item = r => `<div class="side-recipe" draggable="true" data-drag="recipe" data-act="recipe" data-id="${esc(r.id)}" role="button" tabindex="0" title="Drag onto a day, or tap to open">` +
      `<span class="sr-name">${esc(r.name)}</span>${r.kcal !== null ? `<span class="sr-meta">${fmtKcal(r.kcal)} kcal</span>` : ""}</div>`;
    if (!A.shownRecipes().length) { $("sideRecipes").innerHTML = `<div class="empty-msg">No recipes yet: add some in Recipes, then drag them onto the days.</div>`; return; }
    if (q) { $("sideRecipes").innerHTML = recipes.map(item).join("") || `<div class="empty-msg">No recipe called that.</div>`; return; }
    $("sideRecipes").innerHTML = TYPES.map(([type, title]) => {
      const list = recipes.filter(r => r.meal === type);
      return list.length ? `<details class="side-group" data-type="${type}"${S.sideClosed && S.sideClosed.has(type) ? "" : " open"}><summary>${title} <span class="count">${list.length}</span></summary>${list.map(item).join("")}</details>` : "";
    }).join("");
  }

  // ==========================================================================
  // THE LIST (a phone): today to next Sunday
  // ==========================================================================
  function renderList(today) {
    const end = A.planEnd(), out = [weekHeadHTML("this")];
    for (let d = today; d <= end; d = addDays(d, 1)) {
      if (d === A.nextMonday() && d !== today) out.push(`<h2 class="list-week">Next week</h2>${weekHeadHTML("next")}`);
      const name = d === today ? `Today · ${fmtFull(d)}` : d === addDays(today, 1) ? `Tomorrow · ${fmtFull(d)}` : fmtFull(d);
      const slots = MEALS.filter(([meal]) => meal !== "cook" || A.entriesOn(d, "cook").length).map(([meal, title]) => {
        const list = A.entriesOn(d, meal);
        return `<div class="slot${list.length ? "" : " empty"}" data-act="cell" data-date="${d}" data-meal="${meal}"><span class="slot-name">${title}</span>` +
          `<div class="slot-items">${list.length ? list.map(e => chipHTML(e, false)).join("") : `<span class="slot-none">&mdash;</span>`}</div>` +
          `<button type="button" class="slot-add" data-act="pick" data-date="${d}" data-meal="${meal}" aria-label="${esc(`Add to ${title}, ${fmtFull(d)}`)}">${ICONS.plus}</button></div>`;
      }).join("");
      const tot = totalsHTML(d, true);
      out.push(`<section class="day" data-date="${d}"><div class="day-top"><h2 class="day-name">${esc(name)}</h2>${cartHTML(d, today)}</div>` +
        (tot ? `<div class="day-tot">${tot}</div>` : "") + slots + `</section>`);
    }
    $("planList").innerHTML = out.join("");
  }

  // ==========================================================================
  // THE ⋯ MENU: Times & trips… · Copy last week · Save as template… · Load template (each with ✕) · Un-confirm week
  // (while confirmed) · Clear week
  // ==========================================================================
  function renderMenu() {
    $("menuBtn").setAttribute("aria-expanded", String(S.menu));
    $("planMenu").hidden = !S.menu;
    if (!S.menu) return;
    const tpls = A.liveTemplates(), on = isConfirmed(A.shownMonday());
    $("planMenu").innerHTML = `<button type="button" class="menu-item" role="menuitem" data-act="times">Times &amp; trips&hellip;</button>` +
      `<button type="button" class="menu-item" role="menuitem" data-act="copy-last">Copy last week</button>` +
      `<button type="button" class="menu-item" role="menuitem" data-act="save-template">Save as template&hellip;</button>` +
      `<div class="menu-label">Load template</div>` +
      (tpls.map(t => `<div class="menu-tpl"><button type="button" class="menu-item" role="menuitem" data-act="load-template" data-id="${esc(t.id)}">${esc(t.name)} <span class="count">${t.entries.length}</span></button>` +
        `<button type="button" class="icon-btn tpl-x" data-act="delete-template" data-id="${esc(t.id)}" aria-label="${esc(`Delete the template ${t.name}`)}">&times;</button></div>`).join("") ||
        `<div class="menu-none">None yet: save a week as one.</div>`) +
      (on ? `<button type="button" class="menu-item unconfirm-item" role="menuitem" data-act="unconfirm-week">Un-confirm week <span class="count">off Momo</span></button>` : "") +
      `<button type="button" class="menu-item danger-item" role="menuitem" data-act="clear-week">Clear week&hellip;</button>`;
  }
  function toggleMenu(open = !S.menu) {
    S.menu = open;
    renderMenu();
  }

  function renderPlan() {
    const today = todayStr(), big = wide();
    $("planBar").hidden = !big;
    $("momoLine").hidden = !big; // a phone's list heads each week with its own
    $("planBody").hidden = !big;
    $("planList").hidden = big;
    if (big) {
      renderTabs();
      renderGrid(today);
      renderSidebar();
      renderMenu();
      $("planList").innerHTML = "";
    } else {
      S.menu = false;
      renderList(today);
      $("planGrid").innerHTML = "";
    }
    A.paintClip();
  }

  // From Momo (a meal with no recipe to read) or anywhere: the plan, on that day's week, its cell flashing.
  function revealCell(date, meal) {
    if (A.inPlan(date)) S.week = date >= A.nextMonday() ? "next" : "this";
    A.showView("plan");
    const el = A.root.querySelector(`.cell[data-date="${date}"][data-meal="${meal}"], .slot[data-date="${date}"][data-meal="${meal}"]`) ||
      A.root.querySelector(`.day[data-date="${date}"]`);
    A.reveal(el);
  }

  Object.assign(A, { ICONS, wide, renderPlan, renderMenu, toggleMenu, renderSidebar, revealCell });
})(Kyoshi, Kyoshi.apps.turtleduck);
