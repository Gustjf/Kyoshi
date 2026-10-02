/* Hawky · share.js — what Hawky shares with other apps. Momo reads inbox() (core/inbox.js; read-only
 * copies): every open errand due by `to` (so one due in a month takes none of this week's room), soonest
 * due first, and the undated, oldest first, then those ticked between from and to (on their day, so ✓
 * shows on that day's block), all filling Momo's cards titled "Errands",
 * each errand whole; what doesn't fit is one Errands task in Momo's Tasks. Momo's "Open in Hawky" calls
 * open(id), which brings the errand into view and flashes it. The needs' ids are the errands' own:
 * change open() along with them (apps/hawky/CLAUDE.md). */
(function (K, A) {
  "use strict";
  const S = A.S;
  const { localDate, todayStr } = K.util;
  const { BLOCK, DONE_PAGE, fmtDay } = A;

  // A need's one line of details: "Due Oct 7", or "No date · added Sep 30".
  const details = i => [i.due ? `Due ${fmtDay(i.due)}` : `No date${i.at ? ` · added ${fmtDay(localDate(new Date(i.at)))}` : ""}`];
  const need = (i, today) => ({
    id: i.id, title: i.text, block: BLOCK, details: details(i), minutes: i.minutes, due: i.due || null,
    overdue: !i.done && !!i.due && i.due < today, done: !!i.done, date: i.done || null
  });

  // [{ id, title, block: "Errands", details, minutes, due (or null), overdue, done, date (done ones) }]: made
  // afresh on every call, so Momo can't change Hawky's data through them.
  function inbox(from, to) {
    const today = todayStr();
    const done = A.live().filter(i => i.done && i.done >= from && i.done <= to).sort((a, b) => a.done.localeCompare(b.done) || a.at - b.at);
    return A.openItems().filter(i => !i.due || i.due <= to).concat(done).map(i => need(i, today));
  }

  // From Momo's "Open in Hawky" (core/inbox.js puts Hawky on screen first): the errand comes into view and
  // flashes, a done one in the Done fold (opened, showing enough to reach it); nothing once it's deleted.
  function open(id) {
    const i = A.itemById(id);
    if (!i) return;
    if (i.done) {
      S.doneShown = Math.max(S.doneShown, Math.ceil((A.doneItems().indexOf(i) + 1) / DONE_PAGE) * DONE_PAGE);
      A.renderAll();
      A.$("doneBox").open = true;
    }
    const row = A.root.querySelector(`.errand[data-id="${CSS.escape(i.id)}"]`);
    if (!row) return;
    row.scrollIntoView({ block: "center", behavior: "smooth" });
    row.classList.remove("flash");
    void row.offsetWidth; // so the flash starts again
    row.classList.add("flash");
  }

  Object.assign(A, { inbox, open });
})(Kyoshi, Kyoshi.apps.hawky);
