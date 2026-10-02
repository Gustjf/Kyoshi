/* Turtleduck · clipboard.js — copy, cut and paste planned meals on the grid, as Momo does its cards (keyboard and mouse
 * only): Ctrl/⌘+C copies the meal under the mouse and Ctrl/⌘+X cuts it; it's shaded while Ctrl/⌘+V puts it in the cell
 * under the mouse — a copy (a batch cooked again, another portion of a leftover's batch, the same quick meal, restaurant
 * or skip), or after a cut the meal itself, then copies of it. Each paste gives another CLIP_MS for the next, so a meal
 * can go onto several days in a row; the shading clears on Esc, or CLIP_MS after the last copy, cut or paste, and then
 * there's nothing left to paste. A cell that can't take it (a leftover on the Cook row) takes nothing. */
(function (K, A) {
  "use strict";
  const S = A.S;
  const { CLIP_MS } = A;

  const under = () => (S.mouse ? document.elementFromPoint(S.mouse.x, S.mouse.y) : null);

  // The meal to paste, for the next CLIP_MS.
  function hold(id, cut) {
    if (S.clip) clearTimeout(S.clip.timer);
    S.clip = { id, cut, timer: setTimeout(clearClip, CLIP_MS) };
    paintClip();
  }
  function clearClip() {
    if (!S.clip) return;
    clearTimeout(S.clip.timer);
    S.clip = null;
    paintClip();
  }
  // Shades the meal copied or cut, when it's on the grid on screen.
  function paintClip() {
    A.root.querySelectorAll(".chip.clipped").forEach(el => el.classList.remove("clipped", "cut"));
    const c = S.clip, el = c && [...A.root.querySelectorAll("#planGrid .chip[data-id]")].find(x => x.dataset.id === c.id);
    if (!el) return;
    el.classList.add("clipped");
    el.classList.toggle("cut", c.cut);
  }

  // Ctrl+C or Ctrl+X over a meal on the grid. False when the mouse isn't over one.
  function clipChip(cut) {
    const el = under(), chip = el && el.closest("#planGrid .chip[data-id]"), e = chip && A.entryById(chip.dataset.id);
    if (!e) return false;
    hold(e.id, cut);
    return true;
  }
  // Ctrl+V over a cell: a cut meal moves there (its own cell: it stays), a copy is added. Then it's ready for the next
  // paste, as a copy. False when there's nothing to paste, or the cell can't take it.
  function pasteClip() {
    const c = S.clip;
    if (!c) return false;
    const e = A.entryById(c.id);
    if (!e) { clearClip(); return false; }
    const el = under(), cell = el && el.closest("#planGrid .cell");
    if (!cell) return false;
    const { date, meal } = cell.dataset;
    const ok = c.cut ? (e.date === date && e.meal === meal) || A.moveEntry(e.id, date, meal) : !!A.copyEntry(e.id, date, meal);
    if (!ok) return false;
    hold(e.id, false);
    return true;
  }

  Object.assign(A, { clipChip, pasteClip, clearClip, paintClip });
})(Kyoshi, Kyoshi.apps.turtleduck);
