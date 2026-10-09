/* Hawky · share.js — what Hawky shares with other apps. Momo reads inbox() (core/inbox.js; read-only
 * copies): every open errand due by `to` (so one due in a month asks nothing of these weeks yet), soonest
 * due first, and the undated, oldest first, then those ticked between from and to (on their day), each a
 * card of its own in Momo (fill "card"), titled by its text and as long as it takes: an open one waits in
 * Momo's Tasks until you place it; a done one (the same id) shows ✓ on its card, or gets one on the day it
 * was ticked. Momo's "Open in Hawky" calls open(id), which brings the errand into view and flashes it (a
 * ready list's errand, its list). The needs' ids are the errands' own: change open() along with them
 * (apps/hawky/CLAUDE.md). Shopping lists are never shared, except through a ready list's errand (id
 * LIST_ERRAND + the list's id, lists.js), an errand like any other. */
(function (K, A) {
  "use strict";
  const S = A.S;
  const { localDate, todayStr } = K.util;
  const { DONE_PAGE, POSTPONE_WARN, LIST_ERRAND, fmtDay, firstLine } = A;

  // A need's details: "Due Oct 7", or "No date · added Sep 30"; then the note's first line, if it has one; then
  // "Postponed 4×" once it's been postponed more than POSTPONE_WARN times.
  const details = i => [
    i.due ? `Due ${fmtDay(i.due)}` : `No date${i.at ? ` · added ${fmtDay(localDate(new Date(i.at)))}` : ""}`,
    firstLine(i.note),
    i.postponed > POSTPONE_WARN ? `Postponed ${i.postponed}×` : ""
  ].filter(Boolean);
  const need = (i, today) => ({
    id: i.id, title: i.text, fill: "card", details: details(i), minutes: i.minutes, due: i.due || null,
    overdue: !i.done && !!i.due && i.due < today, done: !!i.done, date: i.done || null
  });

  // [{ id, title, fill: "card", details, minutes, due (or null), overdue, done, date (done ones) }]: made
  // afresh on every call, so Momo can't change Hawky's data through them.
  function inbox(from, to) {
    const today = todayStr();
    const done = A.live().filter(i => i.done && i.done >= from && i.done <= to).sort((a, b) => a.done.localeCompare(b.done) || a.at - b.at);
    return A.openItems().filter(i => !i.due || i.due <= to).concat(done).map(i => need(i, today));
  }

  // From Momo's "Open in Hawky" (core/inbox.js puts Hawky on screen first): Errands comes on screen, and the errand
  // comes into view and flashes, a done one in the Done fold (opened, showing enough to reach it); nothing once it's
  // deleted. A ready list's errand brings its list instead, in Shopping, the same way, while the list is there.
  function open(id) {
    const l = typeof id === "string" && id.startsWith(LIST_ERRAND) ? A.listById(id.slice(LIST_ERRAND.length)) : null;
    if (l) return openList(l);
    const i = A.itemById(id);
    if (!i) return;
    S.view = "errands";
    if (i.done) S.doneShown = Math.max(S.doneShown, Math.ceil((A.doneItems().indexOf(i) + 1) / DONE_PAGE) * DONE_PAGE);
    A.renderAll();
    if (i.done) A.$("doneBox").open = true;
    flash(A.root.querySelector(`.errand[data-id="${CSS.escape(i.id)}"]`));
  }
  function openList(l) {
    S.view = "lists";
    if (l.done) S.listsDoneShown = Math.max(S.listsDoneShown, Math.ceil((A.doneLists().indexOf(l) + 1) / DONE_PAGE) * DONE_PAGE);
    A.renderAll();
    if (l.done) A.$("listsDoneBox").open = true;
    flash(A.root.querySelector(`.slist[data-id="${CSS.escape(l.id)}"]`));
  }
  function flash(el) {
    if (!el) return;
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    el.classList.remove("flash");
    void el.offsetWidth; // so the flash starts again
    el.classList.add("flash");
  }

  Object.assign(A, { inbox, open });
})(Kyoshi, Kyoshi.apps.hawky);
