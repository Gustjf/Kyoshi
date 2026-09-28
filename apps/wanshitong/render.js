/* Wan Shi Tong · render.js — draws the page from A.S: In progress and Up next, the magazine
 * (a fold-away group per category, newest first) and the Finished list. */
(function (K, A) {
  "use strict";
  const S = A.S, $ = A.$;
  const { esc, SEP, todayStr } = K.util;
  const { CATS, OTHER, catOf, groupOf, haveLabel, fmtCost, fmtDay, searchUrl } = A;

  // The "search" icon from Lucide (lucide.dev) — ISC License, Copyright (c) Lucide Icons and Contributors.
  const SEARCH_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m21 21-4.34-4.34"/><circle cx="11" cy="11" r="8"/></svg>';

  // --- An item's parts ---
  // Its name (click to edit), its info, and a Google search for it.
  const nameLine = (i, cls) => `<div class="name-line">` +
    `<button type="button" class="${cls}" data-act="edit" data-id="${esc(i.id)}" title="Edit">${esc(i.name)}</button>` +
    (i.info ? `<span class="item-info">${esc(i.info)}</span>` : "") +
    `<a class="search-link" href="${esc(searchUrl(i))}" target="_blank" rel="noopener noreferrer" title="Look it up on Google" aria-label="Look up ${esc(i.name)} on Google">${SEARCH_ICON}</a></div>`;
  // Have it, its cost, and dates ([label, day]), "|" between.
  function metaLine(i, dates, first = "") {
    const have = haveLabel(i.cat, i.have);
    const bits = [first, have ? `<span class="badge have-${esc(i.have)}">${esc(have)}</span>` : "", esc(fmtCost(i.cost))]
      .concat(dates.map(([label, d]) => (d ? `${label} ${fmtDay(d)}` : "")))
      .filter(Boolean);
    return bits.length ? `<div class="item-meta">${bits.join(SEP)}</div>` : "";
  }
  const whyLine = i => (i.why ? `<div class="item-why">${esc(i.why)}</div>` : "");

  // --- In progress and Up next ---
  function spotCard(i, dates, actions) {
    return `<div class="spot-cat">${esc(catOf(i.cat).label)}</div>${nameLine(i, "spot-name")}${metaLine(i, dates)}${whyLine(i)}` +
      `<div class="spot-actions">${actions}</div>`;
  }

  function renderSpots() {
    const now = A.nowItem(), next = A.nextItem(), loaded = A.magazine().length > 0;
    $("nowBody").innerHTML = now
      ? spotCard(now, [["Started", now.started]],
        `<button data-act="done" data-id="${esc(now.id)}">Done</button>` +
        `<button class="secondary" data-act="unload" data-slot="now" title="Put it back in the magazine for later">Back to magazine</button>`)
      : `<div class="empty-msg">${next ? "Nothing in progress. Start your Up next when you're ready."
        : loaded ? "Nothing in progress. Start something from the magazine below." : "Nothing in progress yet."}</div>`;
    $("nextBody").innerHTML = next
      ? spotCard(next, [["Added", next.added]],
        (now ? "" : `<button data-act="start" data-id="${esc(next.id)}">Start now</button>`) +
        `<button class="secondary" data-act="unload" data-slot="next" title="Put it back in the magazine for later">Back to magazine</button>`)
      : `<div class="empty-msg">${loaded ? "Nothing up next. Load something from the magazine below with its Up next button." : "Nothing up next yet."}</div>`;
  }

  // --- The magazine: one fold-away group per category, made once (buildGroups, at start) so each
  // stays open or folded as the list is redrawn. Other holds any category from a newer version. ---
  function buildGroups() {
    $("magazineGroups").innerHTML = CATS.concat(OTHER).map(c => `<details class="group" data-cat="${c.id}">` +
      `<summary><span class="group-title">${esc(c.group)}</span><span class="count"></span></summary><ul class="items"></ul></details>`).join("");
  }

  const itemRow = i => `<li class="item">
    <div class="item-main">${nameLine(i, "item-name")}${metaLine(i, [["Added", i.added]])}${whyLine(i)}</div>
    <div class="item-actions">
      <button class="secondary small" data-act="next" data-id="${esc(i.id)}" title="Load it into Up next">Up next</button>
      <button class="secondary small" data-act="start" data-id="${esc(i.id)}" title="Start it now (In progress)">Start</button>
    </div>
  </li>`;

  function renderMagazine() {
    const items = A.magazine().sort(A.byNewest), any = A.live().length > 0;
    $("magazineCount").textContent = items.length || "";
    $("magazineEmpty").hidden = items.length > 0;
    $("magazineEmpty").textContent = any ? "Everything here is loaded above or finished. Add the next recommendation you hear about."
      : "Empty for now. Add the recommendations you've been keeping in browser tabs: books, films, shows and courses.";
    $("magazineHint").hidden = !items.length;
    A.root.querySelectorAll("#magazineGroups .group").forEach(g => {
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
      <div class="item-actions"><button class="secondary small" data-act="putback" data-id="${esc(i.id)}" title="Back to the magazine">Put back</button></div>
    </li>`).join("");
  }

  function renderAll() {
    S.knownToday = todayStr();
    renderSpots();
    renderMagazine();
    renderFinished();
  }

  Object.assign(A, { buildGroups, renderAll });
})(Kyoshi, Kyoshi.apps.wanshitong);
