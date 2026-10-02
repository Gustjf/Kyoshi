/* Turtleduck · drag.js — dragging with a mouse on the computer's grid, with the browser's own drag and drop: a recipe from
 * the sidebar onto a cell (cooked there), a portion from the shelf (a leftover there: never before its cook day, never on
 * the Cook row), a planned meal onto another cell (moved). A cell that can take what's dragged is highlighted while it's
 * over it; one that can't takes nothing. The phone taps instead (drag and drop on touch isn't reliable), and tapping
 * works on the computer too. What's dragged is kept in S.drag (a drag's data can't be read until the drop); a drag
 * carries TYPE, so one from outside the page (a file, a link) is never taken for a stale S.drag. */
(function (K, A) {
  "use strict";
  const S = A.S, $ = A.$;

  function clear() {
    S.drag = null;
    A.root.querySelectorAll(".drop-target, .dragging").forEach(el => el.classList.remove("drop-target", "dragging"));
  }
  const TYPE = "application/x-turtleduck";
  const cellOf = e => (e.target.closest ? e.target.closest("#planGrid .cell") : null);
  const ours = e => !!S.drag && !!e.dataTransfer && [...e.dataTransfer.types].includes(TYPE);

  function wireDrag() {
    const box = $("planView");
    box.addEventListener("dragstart", e => {
      const el = e.target.closest ? e.target.closest("[data-drag]") : null;
      clear();
      if (!el || !A.wide()) return e.preventDefault();
      S.drag = { what: el.dataset.drag, id: el.dataset.id };
      el.classList.add("dragging");
      e.dataTransfer.effectAllowed = S.drag.what === "entry" ? "move" : "copy";
      e.dataTransfer.setData(TYPE, `${S.drag.what}:${S.drag.id}`);
      // Dropped on a text field elsewhere, it's the name.
      e.dataTransfer.setData("text/plain", (el.querySelector(".chip-name, .sr-name") || el).textContent.trim());
    });
    box.addEventListener("dragover", e => {
      const cell = cellOf(e);
      if (!cell || !ours(e) || !A.canPlace(S.drag, cell.dataset.date, cell.dataset.meal)) return;
      e.preventDefault(); // this cell takes it
      e.dataTransfer.dropEffect = S.drag.what === "entry" ? "move" : "copy";
      if (!cell.classList.contains("drop-target")) {
        A.root.querySelectorAll(".drop-target").forEach(x => x.classList.remove("drop-target"));
        cell.classList.add("drop-target");
      }
    });
    box.addEventListener("dragleave", e => {
      const cell = cellOf(e);
      if (cell && !cell.contains(e.relatedTarget)) cell.classList.remove("drop-target");
    });
    box.addEventListener("drop", e => {
      const cell = cellOf(e), d = S.drag;
      if (!cell || !ours(e)) return;
      e.preventDefault();
      clear();
      const { date, meal } = cell.dataset;
      if (d.what === "recipe") A.addRecipe(d.id, date, meal);
      else if (d.what === "portion") A.addPortion(d.id, date, meal);
      else if (d.what === "entry") A.moveEntry(d.id, date, meal);
    });
    box.addEventListener("dragend", clear);
  }

  Object.assign(A, { wireDrag, clearDrag: clear });
})(Kyoshi, Kyoshi.apps.turtleduck);
