/* Hawky · render.js — draws the page from A.S: the nav and the view on screen (showView; the Shopping view is
 * lists-view.js's), quick add's chips (and the field the picked one asks for, and the note line), the list in its
 * groups (each errand: ✓, its text, when it's due or how long it has waited, how long it takes, its note's first
 * line, a warning once it's been postponed often, and Tomorrow → while it's overdue; each group's total time), and
 * the Done fold (newest first, DONE_PAGE at a time). */
(function (K, A) {
  "use strict";
  const S = A.S, $ = A.$;
  const { esc, sum, todayStr } = K.util;
  const { GROUPS, DONE_PAGE, POSTPONE_WARN, fmtMinutes, dayWords, waited, firstLine, groupOf } = A;

  // The "check" icon from Lucide (ISC license), in the ✓ button's circle.
  const CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';
  // The "triangle-alert" icon from Lucide (ISC license), before "postponed 4×".
  const ALERT = '<svg class="warn-mark" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>';
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  const total = list => fmtMinutes(sum(list.map(i => i.minutes)));

  // Quick add's chips as picked, with the date field for Pick a day and the number field for Other.
  function renderAdd() {
    const pressed = (box, key, value) => box.querySelectorAll("button").forEach(b => {
      b.classList.toggle("active", b.dataset[key] === value);
      b.setAttribute("aria-pressed", String(b.dataset[key] === value));
    });
    pressed($("addDays"), "day", S.add.day);
    pressed($("addMinutes"), "minutes", String(S.add.minutes));
    $("addDate").hidden = S.add.day !== "pick";
    $("addDate").min = todayStr();
    $("addOther").hidden = S.add.minutes !== "other";
    $("addNote").hidden = !S.add.note;
    $("addNoteBtn").hidden = S.add.note;
  }

  // One errand: ✓ (filled once done, and tapping it again undoes), its text (opens its pop-up), then
  // when (the day it's due, but today's; how long an undated one has waited; or the day it was done), how
  // long it takes, and its note's first line. Postponed more than POSTPONE_WARN times, its line starts with a
  // warning and how often; while it's overdue, Tomorrow → at the row's end postpones it.
  function errandHTML(i, today) {
    const when = i.done ? `Done ${dayWords(i.done, today)}` : i.due ? (i.due !== today ? cap(dayWords(i.due, today)) : "") : cap(waited(i.at, today));
    const tick = i.done ? "Not done yet" : "Done", note = firstLine(i.note);
    const slipped = i.postponed > POSTPONE_WARN ? `<span class="slipped">${ALERT}postponed ${i.postponed}×</span> · ` : "";
    return `<li class="errand${i.done ? " done" : ""}" data-id="${esc(i.id)}">` +
      `<button type="button" class="tick" data-act="${i.done ? "undo" : "tick"}" data-id="${esc(i.id)}" title="${tick}" aria-label="${tick}: ${esc(i.text)}"><span class="box">${CHECK}</span></button>` +
      `<div class="errand-main"><button type="button" class="errand-text" data-act="edit" data-id="${esc(i.id)}">${esc(i.text)}</button>` +
      `<span class="errand-meta">${slipped}${esc([when, fmtMinutes(i.minutes)].filter(Boolean).join(" · "))}</span>` +
      (note ? `<span class="errand-note">${esc(note)}</span>` : "") + `</div>` +
      (!i.done && groupOf(i, today) === "overdue" ? `<button type="button" class="secondary small postpone" data-act="postpone" data-id="${esc(i.id)}" title="Postpone to tomorrow" aria-label="Postpone to tomorrow: ${esc(i.text)}">Tomorrow →</button>` : "") +
      `</li>`;
  }

  // The open errands, in their groups (only those with any), each with its total time.
  function renderList(today) {
    const open = A.openItems();
    $("listEmpty").hidden = open.length > 0;
    $("openCount").textContent = open.length ? `${open.length} · ${total(open)}` : "";
    $("groups").innerHTML = GROUPS.map(([key, title]) => {
      const list = open.filter(i => groupOf(i, today) === key);
      return list.length ? `<div class="group ${key}"><div class="group-head"><span class="group-title">${title}</span><span class="group-sum">${total(list)}</span></div>` +
        `<ul class="errands">${list.map(i => errandHTML(i, today)).join("")}</ul></div>` : "";
    }).join("");
  }

  // Done (12): newest first, a page at a time.
  function renderDone(today) {
    const done = A.doneItems(), shown = done.slice(0, S.doneShown);
    $("doneSection").hidden = !done.length;
    $("doneCount").textContent = `(${done.length})`;
    $("doneList").innerHTML = shown.map(i => errandHTML(i, today)).join("");
    $("doneMore").hidden = shown.length >= done.length;
    $("doneMore").textContent = `Show ${Math.min(DONE_PAGE, done.length - shown.length)} more`;
  }

  // The nav (Shopping says how many lists are ready to buy) and the view it shows.
  function renderNav(today) {
    const ready = A.activeLists().filter(l => A.stateOf(l, today) === "ready").length;
    $("errandsView").hidden = S.view !== "errands";
    $("listsView").hidden = S.view !== "lists";
    $("nav").querySelectorAll("button[data-view]").forEach(b => {
      b.classList.toggle("active", b.dataset.view === S.view);
      b.setAttribute("aria-pressed", String(b.dataset.view === S.view));
    });
    $("navReady").textContent = ready ? ` · ${ready} ready` : "";
  }

  function renderAll() {
    const today = S.knownToday = todayStr();
    renderNav(today);
    renderAdd();
    renderList(today);
    renderDone(today);
    A.renderLists(today);
  }

  // Puts a view on screen: "errands" or "lists" (Shopping).
  function showView(view) {
    S.view = view === "lists" ? "lists" : "errands";
    renderAll();
    window.scrollTo(0, 0);
  }

  Object.assign(A, { renderAll, renderAdd, showView });
})(Kyoshi, Kyoshi.apps.hawky);
