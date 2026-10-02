/* Hawky · render.js — draws the page from A.S: quick add's chips (and the field the picked one asks
 * for), the list in its groups (each errand: ✓, its text, when it's due and how long; each group's
 * total time), and the Done fold (newest first, DONE_PAGE at a time). */
(function (K, A) {
  "use strict";
  const S = A.S, $ = A.$;
  const { esc, sum, todayStr } = K.util;
  const { GROUPS, DONE_PAGE, fmtMinutes, dayWords, groupOf } = A;

  // The "check" icon from Lucide (ISC license), in the ✓ button's circle.
  const CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';
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
  }

  // One errand: ✓ (filled once done, and tapping it again undoes), its text (opens its pop-up), then
  // when (the day it's due, but today's, or the day it was done) and how long.
  function errandHTML(i, today) {
    const when = i.done ? `Done ${dayWords(i.done, today)}` : i.due && i.due !== today ? cap(dayWords(i.due, today)) : "";
    const tick = i.done ? "Not done yet" : "Done";
    return `<li class="errand${i.done ? " done" : ""}" data-id="${esc(i.id)}">` +
      `<button type="button" class="tick" data-act="${i.done ? "undo" : "tick"}" data-id="${esc(i.id)}" title="${tick}" aria-label="${tick}: ${esc(i.text)}"><span class="box">${CHECK}</span></button>` +
      `<div class="errand-main"><button type="button" class="errand-text" data-act="edit" data-id="${esc(i.id)}">${esc(i.text)}</button>` +
      `<span class="errand-meta">${esc([when, fmtMinutes(i.minutes)].filter(Boolean).join(" · "))}</span></div></li>`;
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

  function renderAll() {
    const today = S.knownToday = todayStr();
    renderAdd();
    renderList(today);
    renderDone(today);
  }

  Object.assign(A, { renderAll, renderAdd });
})(Kyoshi, Kyoshi.apps.hawky);
