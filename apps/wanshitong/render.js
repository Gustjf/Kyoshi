/* Wan Shi Tong · render.js — draws the page from A.S: Active media (up to three), the backlog
 * (a fold-away group per category, newest first) and the Finished list. */
(function (K, A) {
  "use strict";
  const S = A.S, $ = A.$;
  const { esc, SEP, todayStr } = K.util;
  const { CATS, OTHER, NOW_SPOTS, HAVE, catOf, groupOf, fmtDay, searchUrl } = A;

  // The "search" icon from Lucide (lucide.dev) — ISC License, Copyright (c) Lucide Icons and Contributors.
  const SEARCH_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m21 21-4.34-4.34"/><circle cx="11" cy="11" r="8"/></svg>';

  // --- An item's parts ---
  // Its name (click to edit), a movie's "Director, Year" then its info, and a Google search for it.
  function nameLine(i, cls) {
    const credits = [i.director, i.year].filter(Boolean).join(", ");
    const info = [credits, i.info].filter(Boolean).map(esc).join(SEP);
    return `<div class="name-line">` +
      `<button type="button" class="${cls}" data-act="edit" data-id="${esc(i.id)}" title="Edit">${esc(i.name)}</button>` +
      (info ? `<span class="item-info">${info}</span>` : "") +
      `<a class="search-link" href="${esc(searchUrl(i))}" target="_blank" rel="noopener noreferrer" title="Look it up on Google" aria-label="Look up ${esc(i.name)} on Google">${SEARCH_ICON}</a></div>`;
  }
  // Available now, and dates ([label, day]), "|" between.
  function metaLine(i, dates, first = "") {
    const bits = [first, i.have ? `<span class="badge have">${esc(HAVE[i.have] || HAVE.yes)}</span>` : ""]
      .concat(dates.map(([label, d]) => (d ? `${label} ${fmtDay(d)}` : "")))
      .filter(Boolean);
    return bits.length ? `<div class="item-meta">${bits.join(SEP)}</div>` : "";
  }
  const whyLine = i => (i.why ? `<div class="item-why">${esc(i.why)}</div>` : "");

  // --- Active media ---
  function spotCard(i, dates, actions) {
    return `<div class="spot-cat">${esc(catOf(i.cat).label)}</div>${nameLine(i, "spot-name")}${metaLine(i, dates)}${whyLine(i)}` +
      `<div class="spot-actions">${actions}</div>`;
  }
  const backBtn = i => `<button class="secondary" data-act="unload" data-id="${esc(i.id)}" title="Put it back in the backlog for later">Back to backlog</button>`;

  // Active media: what's going, in the order it went in, then how many spots are free and what could fill them.
  function renderSpots() {
    const now = A.nowItems(), waiting = A.backlog().length > 0, free = NOW_SPOTS.length - now.length;
    const fill = waiting ? "Start something from your backlog below." : "";
    const freeMsg = now.length ? `${free} free spot${free === 1 ? "" : "s"}.` : fill ? "No active media." : "No active media yet.";
    $("nowCount").textContent = now.length ? `${now.length} of ${NOW_SPOTS.length}` : "";
    $("nowBody").innerHTML = now.map(i => `<div class="now-item">${spotCard(i, [["Started", i.started]],
      `<button data-act="done" data-id="${esc(i.id)}">Done</button>${backBtn(i)}`)}</div>`).join("") +
      (free ? `<div class="free-spots">${esc(`${freeMsg} ${fill}`.trim())}</div>` : "");
  }

  // --- The backlog: one fold-away group per category, each in its own colour (wanshitong.css, by
  // data-cat), made once (buildGroups, at start) so each stays open or folded as the list is
  // redrawn. Other holds any category from a newer version. ---
  function buildGroups() {
    $("backlogGroups").innerHTML = CATS.concat(OTHER).map(c => `<details class="group" data-cat="${c.id}">` +
      `<summary><span class="group-title">${esc(c.group)}</span><span class="count"></span></summary><ul class="items"></ul></details>`).join("");
  }

  const itemRow = i => `<li class="item">
    <div class="item-main">${nameLine(i, "item-name")}${metaLine(i, [["Added", i.added]])}${whyLine(i)}</div>
    <div class="item-actions">
      <button class="secondary small" data-act="start" data-id="${esc(i.id)}" title="Start it now (Active media)">Start</button>
    </div>
  </li>`;

  function renderBacklog() {
    const items = A.backlog().sort(A.byNewest), any = A.live().length > 0;
    $("backlogCount").textContent = items.length || "";
    $("backlogEmpty").hidden = items.length > 0;
    $("backlogEmpty").textContent = any ? "Everything here is active or finished. Add the next recommendation you hear about."
      : "Empty for now. Add the recommendations you've been keeping in browser tabs: books, films, shows and games.";
    $("backlogHint").hidden = !items.length;
    A.root.querySelectorAll("#backlogGroups .group").forEach(g => {
      const mine = items.filter(i => groupOf(i.cat) === g.dataset.cat);
      g.hidden = !mine.length;
      g.open = !S.folded.includes(g.dataset.cat);
      g.querySelector(".count").textContent = mine.length;
      g.querySelector(".items").innerHTML = mine.map(itemRow).join("");
    });
  }

  // --- Finished: newest first, folded away until opened ---
  function renderFinished() {
    const items = A.finished();
    $("finishedSection").hidden = !items.length;
    $("finishedCount").textContent = items.length;
    $("finishedList").innerHTML = items.map(i => `<li class="item">
      <div class="item-main">${nameLine(i, "item-name")}${metaLine(i, [["Finished", i.done]], `<span class="badge cat">${esc(catOf(i.cat).label)}</span>`)}</div>
      <div class="item-actions"><button class="secondary small" data-act="putback" data-id="${esc(i.id)}" title="Back to the backlog">Put back</button></div>
    </li>`).join("");
  }

  function renderAll() {
    S.knownToday = todayStr();
    renderSpots();
    renderBacklog();
    renderFinished();
  }

  Object.assign(A, { buildGroups, renderAll });
})(Kyoshi, Kyoshi.apps.wanshitong);
